import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

// S3-совместимое хранилище вложений (MinIO). Бакет — единый на всё приложение,
// имя берётся из .env (MINIO_BUCKET), а не хардкодится, чтобы стенды не путали
// данные друг друга.
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'crm-attachments';
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'crm-minio',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'crm-minio-secret',
    });
  }

  // Ошибки соединения от minio-клиента иногда приходят без .message (пустая
  // строка) — code/errno несут больше сигнала для логов и STORAGE_UNAVAILABLE.
  private describeError(error: unknown): string {
    const err = error as { message?: string; code?: string; errno?: string | number };
    return err?.message || err?.code || String(err?.errno) || String(error);
  }

  // Как и PrismaService/RedisService — не валим процесс, если MinIO ещё не
  // поднят при старте; /health и реальные загрузки просто будут падать, пока
  // хранилище не появится, без падения всего backend.
  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Бакет "${this.bucket}" создан`);
      }
    } catch (error) {
      this.logger.warn(`MinIO недоступен при старте: ${this.describeError(error)}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.bucketExists(this.bucket);
      return true;
    } catch (error) {
      this.logger.warn(`MinIO health check failed: ${this.describeError(error)}`);
      return false;
    }
  }

  async putObject(storageKey: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async presignedDownloadUrl(storageKey: string, expirySeconds: number): Promise<string> {
    return this.client.presignedGetObject(this.bucket, storageKey, expirySeconds);
  }
}
