import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';
import { FileAttachmentDto, FileDownloadUrlDto } from './dto/file-attachment.dto';

const DOWNLOAD_URL_EXPIRY_SECONDS = 600;

function toFileAttachmentDto(file: {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedById: string;
  interactionInstanceId: string | null;
  licenseId: string | null;
  createdAt: Date;
}): FileAttachmentDto {
  return {
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    storageKey: file.storageKey,
    uploadedById: file.uploadedById,
    interactionInstanceId: file.interactionInstanceId,
    licenseId: file.licenseId,
    createdAt: file.createdAt.toISOString(),
  };
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async listFiles(interactionInstanceId?: string, licenseId?: string): Promise<FileAttachmentDto[]> {
    const files = await this.prisma.fileAttachment.findMany({
      where: {
        ...(interactionInstanceId ? { interactionInstanceId } : {}),
        ...(licenseId ? { licenseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return files.map(toFileAttachmentDto);
  }

  async uploadFile(
    file: Express.Multer.File | undefined,
    uploadedById: string,
    interactionInstanceId?: string,
    licenseId?: string,
  ): Promise<FileAttachmentDto> {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Нужен multipart-файл в поле "file"',
      });
    }

    // Ключ в бакете не совпадает с id записи в БД специально — так исходное
    // имя файла (может содержать что угодно от пользователя) не попадает в
    // storage-путь напрямую, только расширение.
    const extension = file.originalname.includes('.') ? `.${file.originalname.split('.').pop()}` : '';
    const storageKey = `attachments/${randomUUID()}${extension}`;

    await this.withStorage(() => this.minio.putObject(storageKey, file.buffer, file.mimetype));

    const created = await this.prisma.fileAttachment.create({
      data: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
        uploadedById,
        interactionInstanceId: interactionInstanceId ?? null,
        licenseId: licenseId ?? null,
      },
    });

    return toFileAttachmentDto(created);
  }

  async getFileById(id: string): Promise<FileAttachmentDto> {
    const file = await this.findOrThrow(id);
    return toFileAttachmentDto(file);
  }

  // Отдаём только presigned-ссылку — содержимое файла через backend не
  // проксируется, клиент качает напрямую из MinIO.
  async getDownloadUrl(id: string): Promise<FileDownloadUrlDto> {
    const file = await this.findOrThrow(id);
    const url = await this.withStorage(() =>
      this.minio.presignedDownloadUrl(file.storageKey, DOWNLOAD_URL_EXPIRY_SECONDS, file.fileName),
    );

    return {
      fileId: file.id,
      url,
      expiresAt: new Date(Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000).toISOString(),
    };
  }

  // MinIO может быть недоступен (не поднят контейнер, сеть). Не даём
  // сырой сетевой ошибке всплыть 500-кой — единая схема кодов ошибок должна
  // соблюдаться и здесь.
  private async withStorage<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const err = error as { message?: string; code?: string };
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: `Хранилище файлов (MinIO) недоступно: ${err?.message || err?.code || String(error)}`,
      });
    }
  }

  private async findOrThrow(id: string) {
    const file = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: `Файл с id "${id}" не найден`,
      });
    }
    return file;
  }
}
