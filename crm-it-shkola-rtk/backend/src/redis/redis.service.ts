import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    super(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Переподключение с нарастающей паузой (до 2 с): раньше стояло null, и после
      // любого обрыва Redis /health оставался 503 до перезапуска приложения.
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    // Подавляем неотловленный 'error' от ioredis — соединение поднимается
    // лениво, ошибки обрабатываются в ping() при вызове /health.
    this.on('error', () => undefined);
  }

  async onModuleDestroy() {
    this.disconnect();
  }

  // Лёгкая проверка соединения для /health (не переопределяет ioredis .ping()).
  async checkConnection(): Promise<boolean> {
    try {
      const pong = await this.ping();
      return pong === 'PONG';
    } catch (error) {
      this.logger.warn(`Redis health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}
