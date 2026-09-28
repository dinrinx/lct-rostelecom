import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExportFormat, InteractionReportFilters, ReportsService } from './reports.service';
import { CreateReportJobDto, ReportJobDto, ReportTypeDto } from './dto/report-job.dto';
import { ReportQueueService } from './report-queue.service';
import { InteractionReportItemDto, InteractionsReportExportDto } from './dto/interaction-report-item.dto';
import { ChartsResponseDto } from './dto/charts.dto';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from '../catalogs/catalog-scope.interceptor';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';

export const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

// Реестр/графики/экспорт видят ровно те взаимодействия, что доступны роли:
// КАМ — свои, Руководитель — команды, Администратор — все (scope считает
// CatalogScopeInterceptor так же, как для каталогов).
@ApiTags('reports')
@ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
@Roles(...ANY_ROLE)
@UseInterceptors(CatalogScopeInterceptor)
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

  @Get('charts')
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
}

export function parseFilters(query: Record<string, string | undefined>): InteractionReportFilters {
  return {
    from: query.from || undefined,
    to: query.to || undefined,
    universityId: query.universityId || undefined,
    itDirectionId: query.itDirectionId || undefined,
    itProductId: query.itProductId || undefined,
    responsibleUserId: query.responsibleUserId || undefined,
    onlyOverdue: query.onlyOverdue === 'true' || query.onlyOverdue === '1',
  };
}
