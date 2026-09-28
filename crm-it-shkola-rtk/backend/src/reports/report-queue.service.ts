import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import type { CatalogScope } from '../catalogs/catalog-scope.interceptor';
import { UserRoleDto } from '../auth/dto/user.dto';
import { CreateReportJobDto, ReportJobDto, ReportJobStatusDto, ReportTypeDto } from './dto/report-job.dto';
import { ExportFormat, GeneratedReportFile, InteractionReportFilters, ReportsService } from './reports.service';

const QUEUE_NAME = 'reports';

interface ReportJobData {
  type: ReportTypeDto;
  format: ExportFormat;
  filters: InteractionReportFilters;
  // Scope фиксируется в момент постановки: КАМ/Руководитель получают ровно то,
  // что видели бы синхронно (RBAC на уровне данных, а не только на входе).
  scope: CatalogScope;
  requestedById: string;
}

// Redis-соединение для BullMQ строится из того же REDIS_URL, что и RedisService.
function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
  };
}

// Очередь и воркер живут в одном процессе (для хакатона проще, чем отдельный
// worker-контейнер); concurrency — REPORT_WORKER_CONCURRENCY (NFR: 10 параллельных отчётов).
// Как и остальные инфраструктурные сервисы, не валит старт при недоступном Redis:
// постановка задачи тогда вернёт 503 REPORT_QUEUE_UNAVAILABLE, остальное API работает.
@Injectable()
export class ReportQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportQueueService.name);
  private queue!: Queue<ReportJobData, GeneratedReportFile>;
  private worker!: Worker<ReportJobData, GeneratedReportFile>;

  constructor(private readonly reports: ReportsService) {}

  onModuleInit() {
    // Queue: без offline-очереди add() падает сразу, а не висит, если Redis лежит.
    this.queue = new Queue(QUEUE_NAME, {
      connection: { ...redisConnection(), enableOfflineQueue: false },
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    });
    this.queue.on('error', () => undefined);

    this.worker = new Worker(QUEUE_NAME, (job) => this.process(job), {
      connection: { ...redisConnection(), maxRetriesPerRequest: null },
      concurrency: Number(process.env.REPORT_WORKER_CONCURRENCY ?? 10),
    });
    this.worker.on('error', (error) => this.logger.warn(`Очередь отчётов: ${error.message}`));
    this.worker.on('failed', (job, error) => this.logger.warn(`Отчёт ${job?.id} упал: ${error.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async process(job: Job<ReportJobData, GeneratedReportFile>): Promise<GeneratedReportFile> {
    const { type, format, filters, scope } = job.data;
    if (type === ReportTypeDto.INTERACTIONS_EXPORT) {
      return this.reports.generateInteractionsFile(scope, filters, format);
    }
    return this.reports.generateRadarFile(type, scope);
  }

  async enqueue(dto: CreateReportJobDto, scope: CatalogScope): Promise<ReportJobDto> {
    const data: ReportJobData = {
      type: dto.type,
      format: dto.format && ['xls', 'xlsx', 'pdf'].includes(dto.format) ? dto.format : 'xlsx',
      filters: {
        from: dto.from,
        to: dto.to,
        universityId: dto.universityId,
        itDirectionId: dto.itDirectionId,
        itProductId: dto.itProductId,
        responsibleUserId: dto.responsibleUserId,
        onlyOverdue: dto.onlyOverdue,
      },
      scope,
      requestedById: scope.currentUserId ?? '',
    };
    try {
      const job = await this.queue.add(dto.type, data);
      return this.toDto(job, ReportJobStatusDto.QUEUED);
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'REPORT_QUEUE_UNAVAILABLE',
        message: `Очередь отчётов (Redis) недоступна: ${(error as Error).message}`,
      });
    }
  }

  async getStatus(jobId: string, scope: CatalogScope): Promise<ReportJobDto> {
    let job: Job<ReportJobData, GeneratedReportFile> | undefined;
    try {
      job = await this.queue.getJob(jobId);
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'REPORT_QUEUE_UNAVAILABLE',
        message: `Очередь отчётов (Redis) недоступна: ${(error as Error).message}`,
      });
    }
    if (!job) {
      throw new NotFoundException({
        code: 'REPORT_JOB_NOT_FOUND',
        message: `Задание отчёта "${jobId}" не найдено (или уже удалено по сроку хранения)`,
      });
    }
    // Файл содержит данные в зоне видимости заказчика — чужие задания не отдаём
    // (Администратор видит все).
    if (scope.role !== UserRoleDto.ADMINISTRATOR && job.data.requestedById !== (scope.currentUserId ?? '')) {
      throw new ForbiddenException({
        code: 'REPORT_JOB_FORBIDDEN',
        message: 'Это задание отчёта создано другим пользователем',
      });
    }

    const state = await job.getState();
    const status =
      state === 'completed'
        ? ReportJobStatusDto.SUCCESS
        : state === 'failed'
          ? ReportJobStatusDto.FAILED
          : state === 'active'
            ? ReportJobStatusDto.PROCESSING
            : ReportJobStatusDto.QUEUED;

    const dto = this.toDto(job, status);
    if (status === ReportJobStatusDto.SUCCESS && job.returnvalue) {
      dto.resultUrl = await this.reports.presignExport(job.returnvalue.storageKey, job.returnvalue.fileName);
      dto.fileName = job.returnvalue.fileName;
      dto.rowCount = job.returnvalue.rowCount;
    }
    if (status === ReportJobStatusDto.FAILED) {
      dto.error = job.failedReason ?? 'Неизвестная ошибка';
    }
    return dto;
  }

  private toDto(job: Job<ReportJobData, GeneratedReportFile>, status: ReportJobStatusDto): ReportJobDto {
    return {
      id: String(job.id),
      type: job.data.type,
      status,
      requestedById: job.data.requestedById,
      createdAt: new Date(job.timestamp).toISOString(),
      updatedAt: new Date(job.finishedOn ?? job.processedOn ?? job.timestamp).toISOString(),
      resultUrl: null,
    };
  }
}
