import { Controller, Get, Req, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LicenseRadarResultDto } from './dto/license-radar.dto';
import { SlaRadarResultDto } from './dto/sla-radar.dto';
import { ReportsService } from './reports.service';
import { ANY_ROLE } from './reports.controller';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from '../catalogs/catalog-scope.interceptor';
import { Roles } from '../auth/decorators/roles.decorator';

// Killer-фича: радар лицензий и SLA. Отдельный префикс /dashboard, но живёт
// в модуле reports — считается по тем же данным (License, StatusHistoryEntry)
// и с той же видимостью по роли, что и реестр.
@ApiTags('dashboard')
@ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
@Roles(...ANY_ROLE)
@UseInterceptors(CatalogScopeInterceptor)
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
}
