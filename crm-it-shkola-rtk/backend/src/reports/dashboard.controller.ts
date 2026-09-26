import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LicenseRadarResultDto } from './dto/license-radar.dto';
import { SlaRadarResultDto } from './dto/sla-radar.dto';
import { LICENSE_RADAR_RESULT_FIXTURE, SLA_RADAR_RESULT_FIXTURE } from './fixtures/reports.fixtures';

// Killer-фича: радар лицензий и SLA. Отдельный префикс /dashboard, но живёт
// в модуле reports — считается по тем же данным (License, StatusHistoryEntry).
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  @Get('license-radar')
  @ApiOperation({ summary: 'Лицензии, истекающие в ближайшие 60/30/7 дней (и просроченные)' })
  @ApiOkResponse({ type: LicenseRadarResultDto })
  getLicenseRadar(): LicenseRadarResultDto {
    return LICENSE_RADAR_RESULT_FIXTURE;
  }

  @Get('sla-radar')
  @ApiOperation({ summary: 'Взаимодействия, зависшие на одном статусе дольше SLA-порога' })
  @ApiOkResponse({ type: SlaRadarResultDto })
  getSlaRadar(): SlaRadarResultDto {
    return SLA_RADAR_RESULT_FIXTURE;
  }
}
