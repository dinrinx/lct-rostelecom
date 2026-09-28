import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthDto, HealthStatusDto } from './dto/health.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Проверка живости сервиса: по одному лёгкому пингу Postgres, Redis, MinIO (+Keycloak при AUTH_MODE=keycloak)',
    description: '200 — все обязательные зависимости доступны; 503 — хотя бы одна недоступна (тело то же, поля db/redis/minio показывают какая).',
  })
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({ type: HealthDto, description: 'Одна из зависимостей недоступна (status=degraded)' })
  async getHealth(@Res({ passthrough: true }) response: Response): Promise<HealthDto> {
    const health = await this.healthService.check();
    if (health.status !== HealthStatusDto.OK) response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return health;
  }
}
