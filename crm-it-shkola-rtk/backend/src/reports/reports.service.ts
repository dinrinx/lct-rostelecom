import { randomUUID } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';
import type { CatalogScope } from '../catalogs/catalog-scope.interceptor';
import { universityWhereForScope } from '../catalogs/catalogs.service';
import { InteractionReportItemDto, InteractionsReportExportDto } from './dto/interaction-report-item.dto';
import { ChartSlicePointDto, ChartTimeSeriesPointDto, ChartsResponseDto } from './dto/charts.dto';
import { WorkflowPhaseDto } from '../workflow/dto/workflow-status.dto';
import { renderInteractionsPdf, renderInteractionsXlsx } from './report-export';
import { LicenseRadarBucketDto, LicenseRadarItemDto, LicenseRadarResultDto } from './dto/license-radar.dto';
import { SlaRadarItemDto, SlaRadarResultDto } from './dto/sla-radar.dto';

const EXPORT_DOWNLOAD_URL_EXPIRY_SECONDS = 600;
// Порог из НФТ проекта ("отклик API < 1с") — выше него синхронная генерация
// в самом запросе уже не годится, нужна очередь (BullMQ, см. план, шаг 3.6).
// Пока держим синхронно и логируем факт превышения — если это будет
// происходить регулярно на реальных объёмах, тогда и оборачиваем в очередь,
// не раньше (незачем городить очередь под данные, которые рендерятся за
// миллисекунды).
const EXPORT_SLOW_THRESHOLD_MS = 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SLA_THRESHOLD_DAYS = 5;

// Простое правило по датам без ML (см. CLAUDE.md, killer-фича радара SLA):
// единый порог на все статусы/фазы (per-статусного поля под SLA в схеме нет —
// если понадобится тонкая настройка, это отдельная миграция), но
// переопределяемый через .env — одно и то же значение для sla-радара и для
// ?onlyOverdue в /reports/interactions, это одно и то же понятие "просрочено".
function getSlaThresholdDays(): number {
  const raw = Number.parseInt(process.env.SLA_THRESHOLD_DAYS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SLA_THRESHOLD_DAYS;
}

// Дальше этого горизонта лицензия ещё не попадает на радар — иначе он
// превратился бы в полный список лицензий, а не в набор "требует внимания".
const LICENSE_RADAR_HORIZON_DAYS = 60;

function licenseBucketFor(daysLeft: number): LicenseRadarBucketDto | null {
  if (daysLeft < 0) return LicenseRadarBucketDto.OVERDUE;
  if (daysLeft <= 7) return LicenseRadarBucketDto.DUE_IN_7_DAYS;
  if (daysLeft <= 30) return LicenseRadarBucketDto.DUE_IN_30_DAYS;
  if (daysLeft <= LICENSE_RADAR_HORIZON_DAYS) return LicenseRadarBucketDto.DUE_IN_60_DAYS;
  return null;
}

export interface ReportsFilters {
  from?: string;
  to?: string;
  universityId?: string;
  itDirectionId?: string;
  itProductId?: string;
  responsibleUserId?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  // Общий where для InteractionInstance — используется и реестром, и
  // графиками statusDistribution/interactionsOverTime, чтобы фильтры и
  // видимость по роли были ровно теми же, что и в самом реестре.
  private buildInteractionWhere(filters: ReportsFilters, scope: CatalogScope): Prisma.InteractionInstanceWhereInput {
    return {
      ...(scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) }),
      ...(filters.universityId ? { universityId: filters.universityId } : {}),
      ...(filters.itProductId ? { itProductId: filters.itProductId } : {}),
      ...(filters.itDirectionId ? { itProduct: { itDirectionId: filters.itDirectionId } } : {}),
      ...(filters.responsibleUserId ? { responsibleUserId: filters.responsibleUserId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };
  }

  async getInteractionsReport(
    filters: ReportsFilters,
    onlyOverdue: boolean,
    scope: CatalogScope,
  ): Promise<InteractionReportItemDto[]> {
    const instances = await this.prisma.interactionInstance.findMany({
      where: this.buildInteractionWhere(filters, scope),
      include: {
        university: true,
        itProduct: { include: { itDirection: true } },
        currentStatus: true,
        responsibleUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const statusSinceByInstance = await this.getStatusSinceByInstance(instances.map((i) => i.id));
    const now = Date.now();
    const slaThresholdDays = getSlaThresholdDays();

    const items: InteractionReportItemDto[] = instances.map((instance) => {
      const statusSince = statusSinceByInstance.get(instance.id) ?? instance.createdAt;
      const daysInCurrentStatus = Math.floor((now - statusSince.getTime()) / MS_PER_DAY);

      return {
        interactionInstanceId: instance.id,
        universityId: instance.universityId,
        universityName: instance.university.name,
        itDirectionId: instance.itProduct?.itDirectionId ?? null,
        itDirectionName: instance.itProduct?.itDirection.name ?? null,
        itProductId: instance.itProductId,
        itProductName: instance.itProduct?.name ?? null,
        currentStatusId: instance.currentStatusId,
        currentStatusName: instance.currentStatus.name,
        currentPhase: instance.currentStatus.phase as unknown as WorkflowPhaseDto,
        responsibleUserId: instance.responsibleUserId,
        responsibleUserName: instance.responsibleUser.fullName,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
        daysInCurrentStatus,
        isOverdue: daysInCurrentStatus > slaThresholdDays,
      };
    });

    return onlyOverdue ? items.filter((item) => item.isOverdue) : items;
  }

  // Killer-фича: лицензии, истекающие в ближайшие 60/30/7 дней (+ уже
  // просроченные, но ещё не закрытые администратором — TERMINATED вручную
  // помечает, что лицензией уже занялись, и она больше не требует внимания
  // радара). Видимость — та же построчная модель по University.kamId.
  async getLicenseRadar(scope: CatalogScope): Promise<LicenseRadarResultDto> {
    const now = new Date();
    const horizon = new Date(now.getTime() + LICENSE_RADAR_HORIZON_DAYS * MS_PER_DAY);

    const licenses = await this.prisma.license.findMany({
      where: {
        ...(scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) }),
        status: { not: 'TERMINATED' },
        endDate: { lte: horizon },
      },
      include: { university: true, itProduct: true },
      orderBy: { endDate: 'asc' },
    });

    const items: LicenseRadarItemDto[] = [];
    for (const license of licenses) {
      const daysLeft = Math.floor((license.endDate.getTime() - now.getTime()) / MS_PER_DAY);
      const bucket = licenseBucketFor(daysLeft);
      if (!bucket) continue; // horizon в where уже отсекает "слишком далеко", это защитная проверка

      items.push({
        licenseId: license.id,
        contractNumber: license.contractNumber ?? '',
        universityId: license.universityId,
        universityName: license.university.name,
        itProductId: license.itProductId,
        itProductName: license.itProduct.name,
        endDate: license.endDate.toISOString(),
        bucket,
      });
    }

    return { jobId: randomUUID(), generatedAt: new Date().toISOString(), items };
  }

  // Killer-фича: взаимодействия, зависшие в одном статусе дольше SLA-порога.
  // Тот же порог и тот же признак "просрочено", что и у ?onlyOverdue в
  // /reports/interactions — это одно и то же понятие, посчитанное здесь
  // без фильтров периода/направления/продукта (радар — по всей видимой зоне).
  async getSlaRadar(scope: CatalogScope): Promise<SlaRadarResultDto> {
    const slaThresholdDays = getSlaThresholdDays();

    const instances = await this.prisma.interactionInstance.findMany({
      where: scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) },
      include: { university: true, currentStatus: true, responsibleUser: true },
    });

    const statusSinceByInstance = await this.getStatusSinceByInstance(instances.map((i) => i.id));
    const now = Date.now();

    const items: SlaRadarItemDto[] = [];
    for (const instance of instances) {
      const statusSince = statusSinceByInstance.get(instance.id) ?? instance.createdAt;
      const daysInStatus = Math.floor((now - statusSince.getTime()) / MS_PER_DAY);
      if (daysInStatus <= slaThresholdDays) continue;

      items.push({
        interactionInstanceId: instance.id,
        universityId: instance.universityId,
        universityName: instance.university.name,
        currentStatusId: instance.currentStatusId,
        currentStatusName: instance.currentStatus.name,
        phase: instance.currentStatus.phase as unknown as WorkflowPhaseDto,
        responsibleUserId: instance.responsibleUserId,
        responsibleUserName: instance.responsibleUser.fullName,
        statusSince: statusSince.toISOString(),
        daysInStatus,
        slaThresholdDays,
      });
    }

    items.sort((a, b) => b.daysInStatus - a.daysInStatus);

    return { generatedAt: new Date().toISOString(), items };
  }

  // xls отдельного бинарного формата не пишем (ExcelJS его не поддерживает,
  // как и большинство современных библиотек) — тот же .xlsx-контент, только
  // имя файла/mimeType под запрошенный format; Excel и подобные открывают
  // такой файл нормально независимо от расширения.
  async exportInteractionsReport(
    filters: ReportsFilters,
    format: 'xls' | 'xlsx' | 'pdf',
    onlyOverdue: boolean,
    scope: CatalogScope,
  ): Promise<InteractionsReportExportDto> {
    const items = await this.getInteractionsReport(filters, onlyOverdue, scope);

    const startedAt = Date.now();
    const buffer =
      format === 'pdf' ? await renderInteractionsPdf(items) : await renderInteractionsXlsx(items);
    const renderMs = Date.now() - startedAt;
    if (renderMs > EXPORT_SLOW_THRESHOLD_MS) {
      this.logger.warn(
        `Экспорт отчёта занял ${renderMs}мс на ${items.length} строк (format=${format}) — порог ${EXPORT_SLOW_THRESHOLD_MS}мс превышен, стоит вынести в очередь (BullMQ, см. план 3.6)`,
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `reestr-vzaimodeystviy-${today}.${format}`;
    const mimeType =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const storageKey = `exports/${randomUUID()}.${format === 'xls' ? 'xlsx' : format}`;

    // Как и в files.service.ts — сетевая недоступность хранилища не должна
    // всплывать сырой 500-кой, единая схема ошибок соблюдается и здесь.
    let url: string;
    try {
      await this.minio.putObject(storageKey, buffer, mimeType);
      url = await this.minio.presignedDownloadUrl(storageKey, EXPORT_DOWNLOAD_URL_EXPIRY_SECONDS);
    } catch (error) {
      const err = error as { message?: string; code?: string };
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: `Хранилище файлов (MinIO) недоступно: ${err?.message || err?.code || String(error)}`,
      });
    }

    return {
      format,
      fileName,
      url,
      generatedAt: new Date().toISOString(),
      rowCount: items.length,
    };
  }

  async getCharts(filters: ReportsFilters, scope: CatalogScope): Promise<ChartsResponseDto> {
    const where = this.buildInteractionWhere(filters, scope);

    const instances = await this.prisma.interactionInstance.findMany({
      where,
      select: { createdAt: true, currentStatus: { select: { name: true } } },
    });

    const statusDistribution = this.toSliceChart(instances.map((i) => i.currentStatus.name));
    const interactionsOverTime = this.toMonthlyTimeSeries(instances.map((i) => i.createdAt));

    // Лицензии — тот же набор фильтров, где это осмысленно для License:
    // universityId/itProductId — напрямую, itDirectionId — через ItProduct,
    // period — по License.createdAt, responsibleUserId — через University.kamId
    // (у License нет собственного "ответственного", это всегда КАМ вуза).
    const licenseWhere: Prisma.LicenseWhereInput = {
      ...(scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) }),
      ...(filters.universityId ? { universityId: filters.universityId } : {}),
      ...(filters.itProductId ? { itProductId: filters.itProductId } : {}),
      ...(filters.itDirectionId ? { itProduct: { itDirectionId: filters.itDirectionId } } : {}),
      ...(filters.responsibleUserId ? { university: { kamId: filters.responsibleUserId } } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const licenses = await this.prisma.license.findMany({
      where: licenseWhere,
      select: { itProduct: { select: { name: true } } },
    });

    const licensesByProduct = this.toSliceChart(licenses.map((l) => l.itProduct.name));

    return { statusDistribution, interactionsOverTime, licensesByProduct };
  }

  // Последняя (по времени) запись истории на инстанс — момент входа в
  // текущий статус. StatusHistoryEntry append-only и всегда создаётся вместе
  // с обновлением currentStatusId (см. WorkflowService.transition/createInstance),
  // поэтому просто самая свежая запись = "с какого момента текущий статус".
  private async getStatusSinceByInstance(instanceIds: string[]): Promise<Map<string, Date>> {
    if (instanceIds.length === 0) return new Map();

    const entries = await this.prisma.statusHistoryEntry.findMany({
      where: { interactionInstanceId: { in: instanceIds } },
      orderBy: { changedAt: 'desc' },
      select: { interactionInstanceId: true, changedAt: true },
    });

    const result = new Map<string, Date>();
    for (const entry of entries) {
      if (!result.has(entry.interactionInstanceId)) {
        result.set(entry.interactionInstanceId, entry.changedAt);
      }
    }
    return result;
  }

  private toSliceChart(labels: string[]): ChartSlicePointDto[] {
    const counts = new Map<string, number>();
    for (const label of labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }

  // Бакет по месяцу создания (YYYY-MM-01) — грубее дня, но читаемо на line-графике
  // и достаточно для демо-объёмов данных (не тысячи точек).
  private toMonthlyTimeSeries(dates: Date[]): ChartTimeSeriesPointDto[] {
    const counts = new Map<string, number>();
    for (const date of dates) {
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }
}
