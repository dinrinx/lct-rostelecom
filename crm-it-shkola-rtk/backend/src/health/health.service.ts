import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConnectionStatusDto, HealthDto, HealthStatusDto } from './dto/health.dto';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthDto> {
    const [dbOk, redisOk] = await Promise.all([this.prisma.checkConnection(), this.redis.checkConnection()]);

    return {
      status: dbOk && redisOk ? HealthStatusDto.OK : HealthStatusDto.DEGRADED,
      db: dbOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      redis: redisOk ? ConnectionStatusDto.OK : ConnectionStatusDto.ERROR,
      uptime: process.uptime(),
    };
  }
}
