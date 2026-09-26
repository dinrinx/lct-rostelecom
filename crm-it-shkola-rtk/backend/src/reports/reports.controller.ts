import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportJobDto, ReportJobDto } from './dto/report-job.dto';
import { LicenseRadarResultDto } from './dto/license-radar.dto';
import { InteractionReportItemDto, InteractionsReportExportDto } from './dto/interaction-report-item.dto';
import { ChartsResponseDto } from './dto/charts.dto';
import {
  CHARTS_RESPONSE_FIXTURE,
  INTERACTIONS_EXPORT_FIXTURE,
  INTERACTION_REPORT_FIXTURES,
  LICENSE_RADAR_RESULT_FIXTURE,
  REPORT_JOB_FIXTURE,
} from './fixtures/reports.fixtures';

@ApiTags('reports')
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
    @Query('from') _from?: string,
    @Query('to') _to?: string,
    @Query('universityId') _universityId?: string,
    @Query('itDirectionId') _itDirectionId?: string,
    @Query('itProductId') _itProductId?: string,
    @Query('responsibleUserId') _responsibleUserId?: string,
    @Query('onlyOverdue') _onlyOverdue?: string,
  ): InteractionReportItemDto[] {
    return INTERACTION_REPORT_FIXTURES;
  }

  @Get('interactions/export')
  @ApiOperation({ summary: 'Экспорт отфильтрованного реестра взаимодействий' })
  @ApiQuery({ name: 'format', required: true, enum: ['xls', 'xlsx', 'pdf'] })
  @ApiOkResponse({ type: InteractionsReportExportDto })
  exportInteractionsReport(@Query('format') format: 'xls' | 'xlsx' | 'pdf' = 'xlsx'): InteractionsReportExportDto {
    return {
      format,
      fileName: INTERACTIONS_EXPORT_FIXTURE.fileName(format),
      url: INTERACTIONS_EXPORT_FIXTURE.url(format),
      generatedAt: INTERACTIONS_EXPORT_FIXTURE.generatedAt,
      rowCount: INTERACTION_REPORT_FIXTURES.length,
    };
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
    @Query('from') _from?: string,
    @Query('to') _to?: string,
    @Query('universityId') _universityId?: string,
    @Query('itDirectionId') _itDirectionId?: string,
    @Query('itProductId') _itProductId?: string,
    @Query('responsibleUserId') _responsibleUserId?: string,
  ): ChartsResponseDto {
    return CHARTS_RESPONSE_FIXTURE;
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
