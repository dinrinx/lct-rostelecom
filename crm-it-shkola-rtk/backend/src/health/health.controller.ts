import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthDto } from './dto/health.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Проверка живости сервиса и соединений с Postgres/Redis' })
  @ApiOkResponse({ type: HealthDto })
  getHealth(): Promise<HealthDto> {
    return this.healthService.check();
  }
}
