import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';
import type { CatalogScope } from '../catalogs/catalog-scope.interceptor';
import { universityWhereForScope } from '../catalogs/catalogs.service';
import { WorkflowPhaseDto } from '../workflow/dto/workflow-status.dto';
import { InteractionReportItemDto, InteractionsReportExportDto } from './dto/interaction-report-item.dto';
import { ChartsResponseDto } from './dto/charts.dto';
import { LicenseRadarBucketDto, LicenseRadarResultDto } from './dto/license-radar.dto';
import { SlaRadarResultDto } from './dto/sla-radar.dto';
import { renderInteractionsPdf } from './report-export';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPORT_URL_EXPIRY_SECONDS = 600;
const LICENSE_RADAR_HORIZON_DAYS = 60;

export interface InteractionReportFilters {
  from?: string;
  to?: string;
  universityId?: string;
  itDirectionId?: string;
  itProductId?: string;
  responsibleUserId?: string;
  onlyOverdue?: boolean;
}

export type ExportFormat = 'xls' | 'xlsx' | 'pdf';

// Колонки выгрузки — те же, что в таблице реестра на фронте.
const EXPORT_COLUMNS: Array<{ header: string; key: keyof InteractionReportItemDto; width: number }> = [
  { header: 'Наименование вуза', key: 'universityName', width: 36 },
  { header: 'ИТ-направление', key: 'itDirectionName', width: 28 },
  { header: 'ИТ-продукт', key: 'itProductName', width: 24 },
  { header: 'Статус работы с вузом', key: 'currentStatusName', width: 34 },
  { header: 'Ответственный', key: 'responsibleUserName', width: 32 },
  { header: 'Дней в статусе', key: 'daysInCurrentStatus', width: 16 },
];

// Видимость взаимодействий по роли: Администратор — все; КАМ/Руководитель —
// где ответственный из их зоны видимости ИЛИ вуз из их зоны (так Руководитель
// видит и процессы вузов, у которых ответственного сняли).
function interactionWhereForScope(scope: CatalogScope): Prisma.InteractionInstanceWhereInput {
  if (scope.visibleKamIds === null) {
    return {};
  }
  return {
    OR: [{ responsibleUserId: { in: scope.visibleKamIds } }, { university: universityWhereForScope(scope) }],
  };
}

function licenseBucket(endDate: Date, now: number): LicenseRadarBucketDto | null {
  const daysLeft = Math.ceil((endDate.getTime() - now) / DAY_MS);
  if (daysLeft < 0) return LicenseRadarBucketDto.OVERDUE;
  if (daysLeft <= 7) return LicenseRadarBucketDto.DUE_IN_7_DAYS;
  if (daysLeft <= 30) return LicenseRadarBucketDto.DUE_IN_30_DAYS;
  if (daysLeft <= LICENSE_RADAR_HORIZON_DAYS) return LicenseRadarBucketDto.DUE_IN_60_DAYS;
  return null;
}

// 'xls' отдаём HTML-таблицей с MIME Excel — Excel открывает её штатно, а
// бинарный BIFF (.xls) exceljs не пишет.
function toExcelHtml(rows: InteractionReportItemDto[]): string {
  const escape = (value: unknown) =>
    String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  const head = EXPORT_COLUMNS.map((column) => `<th>${escape(column.header)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${EXPORT_COLUMNS.map((column) => `<td>${escape(row[column.key])}</td>`).join('')}</tr>`)
    .join('');
  return `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  // Денормализованный реестр. daysInCurrentStatus считается от последней записи
  // append-only истории (момент входа в текущий статус), isOverdue — сравнение
  // с нормативом WorkflowStatus.slaDays. Простые правила по датам, без ML.
  async listInteractions(scope: CatalogScope, filters: InteractionReportFilters): Promise<InteractionReportItemDto[]> {
    const where: Prisma.InteractionInstanceWhereInput = {
      AND: [
        interactionWhereForScope(scope),
        filters.universityId ? { universityId: filters.universityId } : {},
        filters.itProductId ? { itProductId: filters.itProductId } : {},
        filters.itDirectionId ? { itProduct: { itDirectionId: filters.itDirectionId } } : {},
        filters.responsibleUserId ? { responsibleUserId: filters.responsibleUserId } : {},
        filters.from ? { updatedAt: { gte: new Date(filters.from) } } : {},
        // «по» включительно — до конца указанного дня
        filters.to ? { updatedAt: { lt: new Date(new Date(filters.to).getTime() + DAY_MS) } } : {},
      ],
    };

    const instances = await this.prisma.interactionInstance.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        university: { select: { name: true } },
        itProduct: { select: { name: true, itDirection: { select: { id: true, name: true } } } },
        currentStatus: { select: { name: true, phase: true, slaDays: true } },
        responsibleUser: { select: { fullName: true } },
        statusHistoryEntries: { orderBy: { changedAt: 'desc' }, take: 1, select: { changedAt: true } },
      },
    });

    const now = Date.now();
    const rows = instances.map((instance): InteractionReportItemDto => {
      const since = instance.statusHistoryEntries[0]?.changedAt ?? instance.updatedAt;
      const daysInCurrentStatus = Math.max(0, Math.floor((now - since.getTime()) / DAY_MS));
      const slaDays = instance.currentStatus.slaDays;
      return {
        interactionInstanceId: instance.id,
        universityId: instance.universityId,
        universityName: instance.university.name,
        itDirectionId: instance.itProduct?.itDirection.id ?? null,
        itDirectionName: instance.itProduct?.itDirection.name ?? null,
        itProductId: instance.itProductId,
        itProductName: instance.itProduct?.name ?? null,
        currentStatusId: instance.currentStatusId,
        currentStatusName: instance.currentStatus.name,
        currentPhase: instance.currentStatus.phase as WorkflowPhaseDto,
        responsibleUserId: instance.responsibleUserId,
        responsibleUserName: instance.responsibleUser.fullName,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
        daysInCurrentStatus,
        isOverdue: slaDays !== null && daysInCurrentStatus > slaDays,
      };
    });

    return filters.onlyOverdue ? rows.filter((row) => row.isOverdue) : rows;
  }

  async getCharts(scope: CatalogScope, filters: InteractionReportFilters): Promise<ChartsResponseDto> {
    const rows = await this.listInteractions(scope, filters);

    const countBy = <T>(items: T[], key: (item: T) => string) => {
      const counts = new Map<string, number>();
      for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
      return counts;
    };

    const byStatus = countBy(rows, (row) => row.currentStatusName);
    const byMonth = countBy(rows, (row) => `${row.createdAt.slice(0, 7)}-01`);

    const licenses = await this.prisma.license.findMany({
      where: {
        ...(scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) }),
        ...(filters.universityId ? { universityId: filters.universityId } : {}),
        ...(filters.itProductId ? { itProductId: filters.itProductId } : {}),
        ...(filters.itDirectionId ? { itProduct: { itDirectionId: filters.itDirectionId } } : {}),
      },
      select: { itProduct: { select: { name: true } } },
    });
    const byProduct = countBy(licenses, (license) => license.itProduct.name);

    return {
      statusDistribution: [...byStatus].map(([label, value]) => ({ label, value })),
      interactionsOverTime: [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })),
      licensesByProduct: [...byProduct].map(([label, value]) => ({ label, value })),
    };
  }

  // Файл кладём в тот же бакет MinIO (префикс exports/) и отдаём presigned-ссылку —
  // содержимое через backend не проксируется, как и у вложений. xlsx — ExcelJS
  // (та же библиотека, что и в импорте каталогов); xls — HTML-таблица с
  // MIME Excel (бинарный BIFF exceljs не пишет, Excel такой файл открывает
  // штатно); pdf — простой табличный рендер через pdfkit с шрифтом DejaVu Sans
  // (встроенные PDF-шрифты кириллицу не поддерживают — текст превращался бы
  // в мусор при копировании, см. report-export.ts).
  async exportInteractions(
    scope: CatalogScope,
    filters: InteractionReportFilters,
    format: ExportFormat,
  ): Promise<InteractionsReportExportDto> {
    const rows = await this.listInteractions(scope, filters);
    const generatedAt = new Date();
    const fileName = `reestr-vzaimodeystviy-${generatedAt.toISOString().slice(0, 10)}.${format}`;

    let buffer: Buffer;
    let mimeType: string;
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Реестр');
      sheet.columns = EXPORT_COLUMNS.map(({ header, key, width }) => ({ header, key, width }));
      sheet.getRow(1).font = { bold: true };
      rows.forEach((row) => sheet.addRow(row));
      buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (format === 'pdf') {
      buffer = await renderInteractionsPdf(rows);
      mimeType = 'application/pdf';
    } else {
      buffer = Buffer.from(toExcelHtml(rows), 'utf-8');
      mimeType = 'application/vnd.ms-excel';
    }

    const storageKey = `exports/${randomUUID()}.${format}`;
    let url: string;
    try {
      await this.minio.putObject(storageKey, buffer, mimeType);
      url = await this.minio.presignedDownloadUrl(storageKey, EXPORT_URL_EXPIRY_SECONDS, fileName);
    } catch (error) {
      const err = error as { message?: string; code?: string };
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: `Хранилище файлов (MinIO) недоступно: ${err?.message || err?.code || String(error)}`,
      });
    }

    return { format, fileName, url, generatedAt: generatedAt.toISOString(), rowCount: rows.length };
  }

  async getLicenseRadar(scope: CatalogScope): Promise<LicenseRadarResultDto> {
    const now = Date.now();
    const licenses = await this.prisma.license.findMany({
      where: {
        ...(scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) }),
        endDate: { lte: new Date(now + LICENSE_RADAR_HORIZON_DAYS * DAY_MS) },
      },
      orderBy: { endDate: 'asc' },
      include: { university: { select: { name: true } }, itProduct: { select: { name: true } } },
    });

    return {
      jobId: randomUUID(),
      generatedAt: new Date(now).toISOString(),
      items: licenses.map((license) => ({
        licenseId: license.id,
        contractNumber: license.contractNumber ?? '—',
        universityId: license.universityId,
        universityName: license.university.name,
        itProductId: license.itProductId,
        itProductName: license.itProduct.name,
        endDate: license.endDate.toISOString(),
        bucket: licenseBucket(license.endDate, now)!,
      })),
    };
  }

  async getSlaRadar(scope: CatalogScope): Promise<SlaRadarResultDto> {
    const overdue = await this.listInteractions(scope, { onlyOverdue: true });
    const thresholds = await this.prisma.workflowStatus.findMany({
      where: { id: { in: [...new Set(overdue.map((row) => row.currentStatusId))] } },
      select: { id: true, slaDays: true },
    });
    const slaByStatus = new Map(thresholds.map((status) => [status.id, status.slaDays ?? 0]));
    const now = Date.now();

    return {
      generatedAt: new Date(now).toISOString(),
      items: overdue
        .sort((a, b) => b.daysInCurrentStatus - a.daysInCurrentStatus)
        .map((row) => ({
          interactionInstanceId: row.interactionInstanceId,
          universityId: row.universityId,
          universityName: row.universityName,
          currentStatusId: row.currentStatusId,
          currentStatusName: row.currentStatusName,
          phase: row.currentPhase,
          responsibleUserId: row.responsibleUserId,
          responsibleUserName: row.responsibleUserName,
          statusSince: new Date(now - row.daysInCurrentStatus * DAY_MS).toISOString(),
          daysInStatus: row.daysInCurrentStatus,
          slaThresholdDays: slaByStatus.get(row.currentStatusId) ?? 0,
        })),
    };
  }
}
