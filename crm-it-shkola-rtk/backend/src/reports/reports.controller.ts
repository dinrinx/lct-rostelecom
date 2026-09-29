import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportFormat, InteractionReportFilters, ReportsService } from './reports.service';
import { CreateReportJobDto, ReportJobDto, ReportTypeDto } from './dto/report-job.dto';
import { ReportQueueService } from './report-queue.service';
import { InteractionReportItemDto, InteractionsReportExportDto } from './dto/interaction-report-item.dto';
import { ChartsResponseDto } from './dto/charts.dto';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from '../catalogs/catalog-scope.interceptor';
import { ReadCacheInterceptor } from '../cache/read-cache.interceptor';
import { Cacheable } from '../cache/cacheable.decorator';
import { CHARTS_TTL_MS } from '../cache/cache-ttl';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';

export const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

// Реестр/графики/экспорт видят ровно те взаимодействия, что доступны роли:
// КАМ — свои, Руководитель — команды, Администратор — все (scope считает
// CatalogScopeInterceptor так же, как для каталогов).
@ApiTags('reports')
@ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
@Roles(...ANY_ROLE)
@UseInterceptors(ReadCacheInterceptor, CatalogScopeInterceptor)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportQueue: ReportQueueService,
  ) {}

  @Get('interactions')
  @ApiOperation({ summary: 'Реестр взаимодействий с фильтрами (период/вуз/направление/продукт/ответственный)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-09-30' })
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itDirectionId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiQuery({ name: 'responsibleUserId', required: false })
  @ApiQuery({ name: 'onlyOverdue', required: false, type: Boolean })
  @ApiOkResponse({ type: InteractionReportItemDto, isArray: true })
  getInteractionsReport(
    @Req() request: RequestWithCatalogScope,
    @Query() query: Record<string, string | undefined>,
  ): Promise<InteractionReportItemDto[]> {
    return this.reportsService.listInteractions(request.catalogScope!, parseFilters(query));
  }

  @Get('interactions/export')
  @ApiOperation({ summary: 'Экспорт отфильтрованного реестра взаимодействий (файл в MinIO + временная ссылка)' })
  @ApiQuery({ name: 'format', required: true, enum: ['xls', 'xlsx', 'pdf'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itDirectionId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiQuery({ name: 'responsibleUserId', required: false })
  @ApiQuery({ name: 'onlyOverdue', required: false, type: Boolean })
  @ApiOkResponse({ type: InteractionsReportExportDto })
  exportInteractionsReport(
    @Req() request: RequestWithCatalogScope,
    @Query() query: Record<string, string | undefined>,
  ): Promise<InteractionsReportExportDto> {
    const format = (['xls', 'xlsx', 'pdf'].includes(query.format ?? '') ? query.format : 'xlsx') as ExportFormat;
    return this.reportsService.exportInteractions(request.catalogScope!, parseFilters(query), format);
  }

  // Ссылка из InteractionsReportExportDto.url ведёт сюда — content стримится
  // с backend, не отдаётся presigned-ссылкой на Garage напрямую (её внутренний
  // Docker-хост недостижим из браузера). key ограничен префиксом exports/,
  // чтобы эндпоинт нельзя было превратить в чтение произвольного объекта бакета.
  @Get('interactions/export/download')
  @ApiOperation({ summary: 'Скачать файл, полученный из GET /reports/interactions/export' })
  @ApiQuery({ name: 'key', required: true })
  @ApiQuery({ name: 'name', required: true })
  @ApiProduces('application/octet-stream')
  async downloadExportFile(
    @Query('key') key: string,
    @Query('name') name: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!key || !key.startsWith('exports/') || !name) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Некорректные параметры key/name' });
    }
    const { stream, size } = await this.reportsService.streamExport(key);
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mimeType =
      ext === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ext === 'pdf'
          ? 'application/pdf'
          : ext === 'json'
            ? 'application/json'
            : 'application/vnd.ms-excel';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    stream.pipe(res);
  }

  // Кэшируется только charts: реестр и экспорт зависят от произвольных фильтров и порождают файлы.
  @Get('charts')
  @Cacheable('reports', CHARTS_TTL_MS)
  @ApiOperation({ summary: 'Данные для графиков отчётного дашборда (pie/line/bar)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-09-30' })
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itDirectionId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiQuery({ name: 'responsibleUserId', required: false })
  @ApiOkResponse({ type: ChartsResponseDto })
  getCharts(
    @Req() request: RequestWithCatalogScope,
    @Query() query: Record<string, string | undefined>,
  ): Promise<ChartsResponseDto> {
    return this.reportsService.getCharts(request.catalogScope!, parseFilters(query));
  }

  // Асинхронные отчёты (BullMQ): POST сразу отдаёт jobId, файл готовится в
  // воркере и кладётся в хранилище. Синхронный GET /reports/interactions/export
  // остаётся как fallback для небольших выгрузок.
  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Поставить отчёт/экспорт в очередь (INTERACTIONS_EXPORT xls|xlsx|pdf, LICENSE_RADAR, SLA_RADAR)',
    description: 'Возвращает job (id = jobId). Статус и ссылка на файл — GET /reports/export-status/{jobId}.',
  })
  @ApiBody({ type: CreateReportJobDto })
  @ApiOkResponse({ type: ReportJobDto })
  createReportJob(
    @Req() request: RequestWithCatalogScope,
    @Body() dto: CreateReportJobDto,
  ): Promise<ReportJobDto> {
    if (!Object.values(ReportTypeDto).includes(dto?.type)) {
      throw new BadRequestException({
        code: 'REPORT_TYPE_INVALID',
        message: `type должен быть одним из: ${Object.values(ReportTypeDto).join(', ')}`,
      });
    }
    return this.reportQueue.enqueue(dto, request.catalogScope!);
  }

  @Get('export-status/:jobId')
  @ApiOperation({
    summary: 'Статус задания отчёта; при SUCCESS — временная ссылка на файл (resultUrl)',
    description: 'Задание видит его автор и Администратор. Готовые задания хранятся ~1 час, затем 404.',
  })
  @ApiParam({ name: 'jobId', example: '42' })
  @ApiOkResponse({ type: ReportJobDto })
  getExportStatus(@Req() request: RequestWithCatalogScope, @Param('jobId') jobId: string): Promise<ReportJobDto> {
    return this.reportQueue.getStatus(jobId, request.catalogScope!);
  }

  // resultUrl из ReportJobDto (при status=SUCCESS) ведёт сюда — те же правила
  // доступа, что у статуса (автор задания или Администратор), контент стримится
  // с backend напрямую.
  @Get('export-status/:jobId/download')
  @ApiOperation({ summary: 'Скачать готовый файл задания (после status=SUCCESS)' })
  @ApiParam({ name: 'jobId', example: '42' })
  @ApiProduces('application/octet-stream')
  async downloadJobResult(
    @Req() request: RequestWithCatalogScope,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, size, fileName, mimeType } = await this.reportQueue.streamResult(jobId, request.catalogScope!);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    stream.pipe(res);
  }
}

function parseDate(name: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (Number.isNaN(new Date(value).getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Параметр "${name}" должен быть датой в формате YYYY-MM-DD (получено "${value}")`,
    });
  }
  return value;
}

export function parseFilters(query: Record<string, string | undefined>): InteractionReportFilters {
  return {
    from: parseDate('from', query.from),
    to: parseDate('to', query.to),
    universityId: query.universityId || undefined,
    itDirectionId: query.itDirectionId || undefined,
    itProductId: query.itProductId || undefined,
    responsibleUserId: query.responsibleUserId || undefined,
    onlyOverdue: query.onlyOverdue === 'true' || query.onlyOverdue === '1',
  };
}
