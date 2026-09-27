import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MinioService } from '../storage/minio.service';
import { ConnectionStatusDto, HealthDto, HealthStatusDto } from './dto/health.dto';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly minio: MinioService,
  ) {}

  // Keycloak нужен только при AUTH_MODE=keycloak — в dev-режиме его недоступность
  // не делает стенд degraded, но в /health видна (экран «Техпросмотр» в админке).
  private async checkKeycloak(): Promise<boolean> {
    const baseUrl = (process.env.KEYCLOAK_URL ?? 'http://localhost:8080').replace(/\/$/, '');
    const realm = process.env.KEYCLOAK_REALM ?? 'it-school-crm';
    try {
      const response = await fetch(`${baseUrl}/realms/${realm}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(1500),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async check(): Promise<HealthDto> {
    const [dbOk, redisOk, minioOk, keycloakOk] = await Promise.all([
      this.prisma.checkConnection(),
      this.redis.checkConnection(),
      this.minio.checkConnection(),
      this.checkKeycloak(),
    ]);
    const keycloakRequired = (process.env.AUTH_MODE ?? 'dev') !== 'dev';

    return {
      status:
        dbOk && redisOk && minioOk && (keycloakOk || !keycloakRequired) ? HealthStatusDto.OK : HealthStatusDto.DEGRADED,
      db: dbOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      redis: redisOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      minio: minioOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      keycloak: keycloakOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      uptime: process.uptime(),
    };
  }
}
