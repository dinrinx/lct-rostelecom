import { Controller, Get, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LicenseRadarResultDto } from './dto/license-radar.dto';
import { SlaRadarResultDto } from './dto/sla-radar.dto';
import { HealthScoreItemDto } from './dto/health-score.dto';
import { ReportsService } from './reports.service';
import { ANY_ROLE } from './reports.controller';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from '../catalogs/catalog-scope.interceptor';
import { ReadCacheInterceptor } from '../cache/read-cache.interceptor';
import { Cacheable } from '../cache/cacheable.decorator';
import { DASHBOARD_TTL_MS } from '../cache/cache-ttl';
import { Roles } from '../auth/decorators/roles.decorator';
import { parsePositiveInt } from '../common/positive-int';

// Killer-фича: радар лицензий и SLA. Отдельный префикс /dashboard, но живёт
// в модуле reports — считается по тем же данным (License, StatusHistoryEntry)
// и с той же видимостью по роли, что и реестр.
@ApiTags('dashboard')
@ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
@Roles(...ANY_ROLE)
@Cacheable('reports', DASHBOARD_TTL_MS)
@UseInterceptors(ReadCacheInterceptor, CatalogScopeInterceptor)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('license-radar')
  @ApiOperation({ summary: 'Лицензии, истекающие в ближайшие 60/30/7 дней (и просроченные)' })
  @ApiOkResponse({ type: LicenseRadarResultDto })
  getLicenseRadar(@Req() request: RequestWithCatalogScope): Promise<LicenseRadarResultDto> {
    return this.reportsService.getLicenseRadar(request.catalogScope!);
  }

  @Get('sla-radar')
  @ApiOperation({ summary: 'Взаимодействия, зависшие на одном статусе дольше SLA-порога этого статуса' })
  @ApiOkResponse({ type: SlaRadarResultDto })
  getSlaRadar(@Req() request: RequestWithCatalogScope): Promise<SlaRadarResultDto> {
    return this.reportsService.getSlaRadar(request.catalogScope!);
  }

  @Get('health-score')
  @ApiOperation({
    summary: 'Рейтинг здоровья вузов, видимых роли (лицензия/SLA/активность/needsReview) — худшие первые',
    description:
      'Считает HealthScoreService.calculateHealthScore по агрегатам, переиспользуя запросы license-radar/sla-radar ' +
      '(без дублирования их логики выборки/RBAC). Сортировка — по score по возрастанию (0 — максимальный риск).',
  })
  @ApiQuery({ name: 'limit', required: false, example: 5, description: 'Топ-N худших; не передано — все вузы в зоне видимости' })
  @ApiOkResponse({ type: HealthScoreItemDto, isArray: true })
  getHealthScore(
    @Req() request: RequestWithCatalogScope,
    @Query('limit') limit?: string,
  ): Promise<HealthScoreItemDto[]> {
    return this.reportsService.getHealthScore(request.catalogScope!, parsePositiveInt('limit', limit));
  }
}
