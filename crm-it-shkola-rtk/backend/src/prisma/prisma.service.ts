import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Не роняем весь процесс, если Postgres недоступен при старте —
    // /health должен суметь отдать { status: degraded, db: error }, а не 500/crash.
    try {
      await this.$connect();
    } catch (error) {
      this.logger.warn(`Postgres connection failed on startup: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Лёгкая проверка соединения для /health — не блокирует запросы к БД.
  async checkConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(`Postgres health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}
