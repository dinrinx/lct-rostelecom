import { Controller, Get, HttpCode, HttpStatus, Param, Post, Body, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportJobDto, ReportJobDto } from './dto/report-job.dto';
import { LicenseRadarResultDto } from './dto/license-radar.dto';
import { InteractionReportItemDto, InteractionsReportExportDto } from './dto/interaction-report-item.dto';
import { ChartsResponseDto } from './dto/charts.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from '../catalogs/catalog-scope.interceptor';
import { LICENSE_RADAR_RESULT_FIXTURE, REPORT_JOB_FIXTURE } from './fixtures/reports.fixtures';

const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

@ApiTags('reports')
@Controller('reports')
@UseInterceptors(CatalogScopeInterceptor)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('interactions')
  @ApiOperation({ summary: 'Реестр взаимодействий с фильтрами (период/вуз/направление/продукт/ответственный)' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-09-30' })
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itDirectionId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiQuery({ name: 'responsibleUserId', required: false })
  @ApiQuery({ name: 'onlyOverdue', required: false, type: Boolean })
  @ApiOkResponse({ type: InteractionReportItemDto, isArray: true })
  @Roles(...ANY_ROLE)
  getInteractionsReport(
    @Req() request: RequestWithCatalogScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('universityId') universityId?: string,
    @Query('itDirectionId') itDirectionId?: string,
    @Query('itProductId') itProductId?: string,
    @Query('responsibleUserId') responsibleUserId?: string,
    @Query('onlyOverdue') onlyOverdue?: string,
  ): Promise<InteractionReportItemDto[]> {
    return this.reportsService.getInteractionsReport(
      { from, to, universityId, itDirectionId, itProductId, responsibleUserId },
      onlyOverdue === 'true',
      request.catalogScope!,
    );
  }

  @Get('interactions/export')
  @ApiOperation({
    summary:
      'Экспорт отфильтрованного реестра взаимодействий (тот же набор фильтров, что у /reports/interactions). ' +
      'xlsx/xls — тот же ExcelJS, что и в импорте каталогов (xls физически тоже .xlsx-контент — библиотека ' +
      'легаси-бинарный формат не пишет). pdf — простая табличная раскладка без дизайна (MVP). Отдаёт не файл ' +
      'напрямую, а presigned-ссылку на скачивание из хранилища (как /files/:id).',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiQuery({ name: 'format', required: true, enum: ['xls', 'xlsx', 'pdf'] })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-09-30' })
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itDirectionId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiQuery({ name: 'responsibleUserId', required: false })
  @ApiQuery({ name: 'onlyOverdue', required: false, type: Boolean })
  @ApiOkResponse({ type: InteractionsReportExportDto })
  @Roles(...ANY_ROLE)
  exportInteractionsReport(
    @Req() request: RequestWithCatalogScope,
    @Query('format') format: 'xls' | 'xlsx' | 'pdf' = 'xlsx',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('universityId') universityId?: string,
    @Query('itDirectionId') itDirectionId?: string,
    @Query('itProductId') itProductId?: string,
    @Query('responsibleUserId') responsibleUserId?: string,
    @Query('onlyOverdue') onlyOverdue?: string,
  ): Promise<InteractionsReportExportDto> {
    return this.reportsService.exportInteractionsReport(
      { from, to, universityId, itDirectionId, itProductId, responsibleUserId },
      format,
      onlyOverdue === 'true',
      request.catalogScope!,
    );
  }

  @Get('charts')
  @ApiOperation({
    summary:
      'Данные для графиков отчётного дашборда, готовые к отрисовке (массивы {label,value}/{date,value}, ' +
      'фронту агрегировать не нужно): pie — statusDistribution, line — interactionsOverTime, ' +
      'bar — licensesByProduct. Фильтры те же, что и у /reports/interactions.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiQuery({ name: 'from', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-09-30' })
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itDirectionId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiQuery({ name: 'responsibleUserId', required: false })
  @ApiOkResponse({ type: ChartsResponseDto })
  @Roles(...ANY_ROLE)
  getCharts(
    @Req() request: RequestWithCatalogScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('universityId') universityId?: string,
    @Query('itDirectionId') itDirectionId?: string,
    @Query('itProductId') itProductId?: string,
    @Query('responsibleUserId') responsibleUserId?: string,
  ): Promise<ChartsResponseDto> {
    return this.reportsService.getCharts(
      { from, to, universityId, itDirectionId, itProductId, responsibleUserId },
      request.catalogScope!,
    );
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
