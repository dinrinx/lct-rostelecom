import { Controller, Get, Req, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { LicenseRadarResultDto } from './dto/license-radar.dto';
import { SlaRadarResultDto } from './dto/sla-radar.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from '../catalogs/catalog-scope.interceptor';

const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

// Killer-фича: радар лицензий и SLA. Отдельный префикс /dashboard, но живёт
// в модуле reports — считается по тем же данным (License, StatusHistoryEntry)
// и той же построчной видимости (КАМ/Руководитель/Админ), что и остальные reports.
@ApiTags('dashboard')
@Controller('dashboard')
@UseInterceptors(CatalogScopeInterceptor)
export class DashboardController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('license-radar')
  @ApiOperation({ summary: 'Лицензии, истекающие в ближайшие 60/30/7 дней (и просроченные, но не закрытые)' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiOkResponse({ type: LicenseRadarResultDto })
  @Roles(...ANY_ROLE)
  getLicenseRadar(@Req() request: RequestWithCatalogScope): Promise<LicenseRadarResultDto> {
    return this.reportsService.getLicenseRadar(request.catalogScope!);
  }

  @Get('sla-radar')
  @ApiOperation({
    summary:
      'Взаимодействия, зависшие на одном статусе дольше SLA-порога (SLA_THRESHOLD_DAYS в .env, по умолчанию 5 дней)',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiOkResponse({ type: SlaRadarResultDto })
  @Roles(...ANY_ROLE)
  getSlaRadar(@Req() request: RequestWithCatalogScope): Promise<SlaRadarResultDto> {
    return this.reportsService.getSlaRadar(request.catalogScope!);
  }
}
