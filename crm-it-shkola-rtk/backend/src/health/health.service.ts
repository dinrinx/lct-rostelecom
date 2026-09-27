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

  async check(): Promise<HealthDto> {
    const [dbOk, redisOk, minioOk] = await Promise.all([
      this.prisma.checkConnection(),
      this.redis.checkConnection(),
      this.minio.checkConnection(),
    ]);

    return {
      status: dbOk && redisOk && minioOk ? HealthStatusDto.OK : HealthStatusDto.DEGRADED,
      db: dbOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      redis: redisOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      minio: minioOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      uptime: process.uptime(),
    };
  }
}
