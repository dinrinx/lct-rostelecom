import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExportFormat, InteractionReportFilters, ReportsService } from './reports.service';
import { CreateReportJobDto, ReportJobDto } from './dto/report-job.dto';
import { LicenseRadarResultDto } from './dto/license-radar.dto';
import { InteractionReportItemDto, InteractionsReportExportDto } from './dto/interaction-report-item.dto';
import { ChartsResponseDto } from './dto/charts.dto';
import { LICENSE_RADAR_RESULT_FIXTURE, REPORT_JOB_FIXTURE } from './fixtures/reports.fixtures';
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
  constructor(private readonly reportsService: ReportsService) {}

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

  // Отчёты формируются асинхронно (очередь BullMQ), поэтому запрос сразу
  // возвращает job без ожидания результата.
  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Поставить отчёт в очередь на формирование' })
  @ApiBody({ type: CreateReportJobDto })
  @ApiOkResponse({ type: ReportJobDto })
  createReportJob(@Body() _dto: CreateReportJobDto): ReportJobDto {
    return REPORT_JOB_FIXTURE;
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Статус отчёта по идентификатору задания' })
  @ApiParam({ name: 'id', example: REPORT_JOB_FIXTURE.id })
  @ApiOkResponse({ type: ReportJobDto })
  getReportJob(@Param('id') _id: string): ReportJobDto {
    return REPORT_JOB_FIXTURE;
  }

  @Get('jobs/:id/result')
  @ApiOperation({ summary: 'Результат отчёта «Радар лицензий и SLA»' })
  @ApiParam({ name: 'id', example: REPORT_JOB_FIXTURE.id })
  @ApiOkResponse({ type: LicenseRadarResultDto })
  getReportResult(@Param('id') _id: string): LicenseRadarResultDto {
    return LICENSE_RADAR_RESULT_FIXTURE;
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
