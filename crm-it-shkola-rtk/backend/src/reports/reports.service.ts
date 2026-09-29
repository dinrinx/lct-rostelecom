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
import { HealthScoreItemDto, HealthScoreLevelDto } from './dto/health-score.dto';
import { HealthScoreService } from './health-score/health-score.service';
import { renderInteractionsPdf } from './report-export';

const DAY_MS = 24 * 60 * 60 * 1000;
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

export interface GeneratedReportFile {
  storageKey: string;
  fileName: string;
  mimeType: string;
  rowCount: number;
}

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
// видит и процессы вузов, у которых ответственного сняли). Инстансы вовсе без
// вуза (needsReview из интеграции, см. integrations/sync) — та же политика,
// что и для University без kamId: КАМ не видит (не его вуз, разбирать нечего),
// Руководитель видит и берёт на себя триаж (includeUnassigned).
function interactionWhereForScope(scope: CatalogScope): Prisma.InteractionInstanceWhereInput {
  if (scope.visibleKamIds === null) {
    return {};
  }
  return {
    OR: [
      { responsibleUserId: { in: scope.visibleKamIds } },
      { university: universityWhereForScope(scope) },
      ...(scope.includeUnassigned ? [{ universityId: null }] : []),
    ],
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
    private readonly healthScore: HealthScoreService,
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
        universityName: instance.university?.name ?? null,
        itDirectionId: instance.itProduct?.itDirection.id ?? null,
        itDirectionName: instance.itProduct?.itDirection.name ?? null,
        itProductId: instance.itProductId,
        itProductName: instance.itProduct?.name ?? null,
        currentStatusId: instance.currentStatusId,
        currentStatusName: instance.currentStatus.name,
        currentPhase: instance.currentStatus.phase as WorkflowPhaseDto,
        responsibleUserId: instance.responsibleUserId,
        responsibleUserName: instance.responsibleUser?.fullName ?? null,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
        daysInCurrentStatus,
        isOverdue: slaDays !== null && daysInCurrentStatus > slaDays,
        needsReview: instance.needsReview,
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

  // Файл кладём в бакет MinIO/Garage (префикс exports/) и отдаём ссылку на
  // сам backend (/reports/interactions/export/download), не presigned-ссылку
  // на хранилище — та подписана на внутренний Docker-хост Garage и не
  // открывается из браузера (см. MinioService.getObjectStream). xlsx —
  // ExcelJS (та же библиотека, что и в импорте каталогов); xls — HTML-таблица
  // с MIME Excel (бинарный BIFF exceljs не пишет, Excel такой файл открывает
  // штатно); pdf — простой табличный рендер через pdfkit с шрифтом DejaVu Sans
  // (встроенные PDF-шрифты кириллицу не поддерживают — текст превращался бы
  // в мусор при копировании, см. report-export.ts).
  async exportInteractions(
    scope: CatalogScope,
    filters: InteractionReportFilters,
    format: ExportFormat,
  ): Promise<InteractionsReportExportDto> {
    const generatedAt = new Date();
    const file = await this.generateInteractionsFile(scope, filters, format);
    const url = `/reports/interactions/export/download?key=${encodeURIComponent(file.storageKey)}&name=${encodeURIComponent(file.fileName)}`;
    return { format, fileName: file.fileName, url, generatedAt: generatedAt.toISOString(), rowCount: file.rowCount };
  }

  // Общий путь для синхронного GET /reports/interactions/export и для BullMQ-воркера
  // (report-queue.service.ts): строит файл, кладёт в хранилище, возвращает ключ.
  // Ссылка НЕ генерируется здесь — в асинхронном режиме она выдаётся заново при
  // каждом GET /reports/export-status, чтобы не протухать, пока файл лежит.
  async generateInteractionsFile(
    scope: CatalogScope,
    filters: InteractionReportFilters,
    format: ExportFormat,
  ): Promise<GeneratedReportFile> {
    const rows = await this.listInteractions(scope, filters);
    const fileName = `reestr-vzaimodeystviy-${new Date().toISOString().slice(0, 10)}.${format}`;

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

    const storageKey = await this.storeExport(buffer, mimeType, format);
    return { storageKey, fileName, mimeType, rowCount: rows.length };
  }

  // Радары в очереди отдаются JSON-файлом с тем же телом, что и синхронные
  // GET /dashboard/*-radar — фронт разбирает один и тот же формат.
  async generateRadarFile(type: 'LICENSE_RADAR' | 'SLA_RADAR', scope: CatalogScope): Promise<GeneratedReportFile> {
    const result = type === 'LICENSE_RADAR' ? await this.getLicenseRadar(scope) : await this.getSlaRadar(scope);
    const buffer = Buffer.from(JSON.stringify(result, null, 2), 'utf-8');
    const fileName = `${type === 'LICENSE_RADAR' ? 'radar-licenziy' : 'radar-sla'}-${new Date().toISOString().slice(0, 10)}.json`;
    const storageKey = await this.storeExport(buffer, 'application/json', 'json');
    return { storageKey, fileName, mimeType: 'application/json', rowCount: result.items.length };
  }

  // storageKey ограничен префиксом exports/ на уровне вызывающего контроллера
  // (reports.controller.ts) — этот метод сам по себе отдаёт любой объект
  // бакета по ключу, доступ к нему не завязан на RBAC-scope запроса.
  async streamExport(storageKey: string): Promise<{ stream: NodeJS.ReadableStream; size: number }> {
    try {
      return await this.minio.getObjectStream(storageKey);
    } catch (error) {
      throw this.storageUnavailable(error);
    }
  }

  private async storeExport(buffer: Buffer, mimeType: string, extension: string): Promise<string> {
    const storageKey = `exports/${randomUUID()}.${extension}`;
    try {
      await this.minio.putObject(storageKey, buffer, mimeType);
    } catch (error) {
      throw this.storageUnavailable(error);
    }
    return storageKey;
  }

  private storageUnavailable(error: unknown): ServiceUnavailableException {
    const err = error as { message?: string; code?: string };
    return new ServiceUnavailableException({
      code: 'STORAGE_UNAVAILABLE',
      message: `Хранилище файлов (MinIO) недоступно: ${err?.message || err?.code || String(error)}`,
    });
  }

  // Общий запрос лицензий в зоне видимости роли — переиспользуется getLicenseRadar
  // (окно 60 дней) и getHealthScore (без окна: нужна ближайшая лицензия вуза
  // независимо от горизонта радара, иначе уже подкрученный healthScoreConfig
  // с yellowDays > 60 молча не сработал бы). Сортировка по endDate asc общая —
  // и радару, и health-score нужны сначала самые срочные/просроченные.
  private licensesInScope(scope: CatalogScope, extraWhere: Prisma.LicenseWhereInput = {}) {
    return this.prisma.license.findMany({
      where: {
        ...(scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) }),
        ...extraWhere,
      },
      orderBy: { endDate: 'asc' },
      include: { university: { select: { name: true } }, itProduct: { select: { name: true } } },
    });
  }

  async getLicenseRadar(scope: CatalogScope): Promise<LicenseRadarResultDto> {
    const now = Date.now();
    const licenses = await this.licensesInScope(scope, { endDate: { lte: new Date(now + LICENSE_RADAR_HORIZON_DAYS * DAY_MS) } });

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

  // Переиспользует запросы license-radar (licensesInScope — без 60-дневного окна:
  // health-score должна видеть реальные дни до истечения независимо от
  // горизонта радара) и sla-radar (listInteractions + карта slaDays по статусу),
  // не дублируя их логику построения RBAC-зоны видимости. На каждый вуз
  // агрегируем: ближайшую по сроку лицензию, "худшее" по просрочке SLA
  // взаимодействие (максимальный daysInCurrentStatus/slaThresholdDays),
  // минимальный daysInCurrentStatus по всем инстансам вуза как proxy для
  // "дней с последней активности" (в нашей схеме это одно и то же — see
  // StatusHistoryEntry, она пишется только на переходах) и число needsReview.
  // Инстансы без вуза (needsReview из sync, universityId=null) не относятся
  // ни к какому конкретному вузу — не участвуют в его агрегатах.
  async getHealthScore(scope: CatalogScope, limit?: number): Promise<HealthScoreItemDto[]> {
    const [universities, licenses, instances] = await Promise.all([
      this.prisma.university.findMany({
        where: scope.visibleKamIds === null ? {} : universityWhereForScope(scope),
        select: { id: true, name: true },
      }),
      this.licensesInScope(scope),
      this.listInteractions(scope, {}),
    ]);

    const now = Date.now();
    const nearestLicenseDaysByUniversity = new Map<string, number>();
    for (const license of licenses) {
      // licensesInScope отсортирован по endDate asc — первая встреченная запись
      // на universityId и есть самая срочная (или самая просроченная) лицензия.
      if (!nearestLicenseDaysByUniversity.has(license.universityId)) {
        nearestLicenseDaysByUniversity.set(license.universityId, Math.floor((license.endDate.getTime() - now) / DAY_MS));
      }
    }

    const thresholds = await this.prisma.workflowStatus.findMany({
      where: { id: { in: [...new Set(instances.map((row) => row.currentStatusId))] } },
      select: { id: true, slaDays: true },
    });
    const slaByStatus = new Map(thresholds.map((status) => [status.id, status.slaDays]));

    const worstByUniversity = new Map<string, { daysInCurrentStatus: number; slaThresholdDays: number | null }>();
    const minDaysSinceActivityByUniversity = new Map<string, number>();
    const needsReviewCountByUniversity = new Map<string, number>();

    for (const row of instances) {
      if (!row.universityId) continue;
      const slaThresholdDays = slaByStatus.get(row.currentStatusId) ?? null;
      const ratio = slaThresholdDays !== null && slaThresholdDays > 0 ? row.daysInCurrentStatus / slaThresholdDays : 0;
      const worst = worstByUniversity.get(row.universityId);
      const worstRatio =
        worst && worst.slaThresholdDays !== null && worst.slaThresholdDays > 0
          ? worst.daysInCurrentStatus / worst.slaThresholdDays
          : 0;
      if (!worst || ratio > worstRatio) {
        worstByUniversity.set(row.universityId, { daysInCurrentStatus: row.daysInCurrentStatus, slaThresholdDays });
      }

      const previousMin = minDaysSinceActivityByUniversity.get(row.universityId);
      minDaysSinceActivityByUniversity.set(
        row.universityId,
        previousMin === undefined ? row.daysInCurrentStatus : Math.min(previousMin, row.daysInCurrentStatus),
      );

      if (row.needsReview) {
        needsReviewCountByUniversity.set(row.universityId, (needsReviewCountByUniversity.get(row.universityId) ?? 0) + 1);
      }
    }

    const items = universities.map((university): HealthScoreItemDto => {
      const worst = worstByUniversity.get(university.id);
      const { score, level, reasons } = this.healthScore.calculateHealthScore({
        licenseDaysUntilExpiry: nearestLicenseDaysByUniversity.get(university.id) ?? null,
        daysInCurrentStatusWithoutChange: worst?.daysInCurrentStatus ?? 0,
        slaThresholdDays: worst?.slaThresholdDays ?? null,
        daysSinceLastActivity: minDaysSinceActivityByUniversity.get(university.id) ?? null,
        needsReviewCount: needsReviewCountByUniversity.get(university.id) ?? 0,
      });
      return { vuzId: university.id, vuzName: university.name, score, level: level as HealthScoreLevelDto, reasons };
    });

    // Худшие — первые (score по возрастанию); при равном score — стабильно по имени,
    // чтобы порядок в топ-N не прыгал между запросами без реальных изменений данных.
    items.sort((a, b) => a.score - b.score || a.vuzName.localeCompare(b.vuzName, 'ru'));
    return limit !== undefined ? items.slice(0, limit) : items;
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
