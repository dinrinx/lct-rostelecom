import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportTypeDto {
  LICENSE_RADAR = 'LICENSE_RADAR',
  SLA_RADAR = 'SLA_RADAR',
  INTERACTIONS_EXPORT = 'INTERACTIONS_EXPORT',
}

export enum ReportJobStatusDto {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// Отчёты формируются асинхронно (BullMQ) — POST сразу отдаёт job (id = jobId),
// а статус и ссылка на готовый файл забираются через GET /reports/export-status/{jobId}.
// Фильтры — те же, что у GET /reports/interactions; для радаров игнорируются
// (радары всегда считаются по всей зоне видимости роли).
export class CreateReportJobDto {
  @ApiProperty({ enum: ReportTypeDto, example: ReportTypeDto.INTERACTIONS_EXPORT })
  type!: ReportTypeDto;

  @ApiPropertyOptional({
    enum: ['xls', 'xlsx', 'pdf'],
    example: 'xlsx',
    description: 'Только для INTERACTIONS_EXPORT (по умолчанию xlsx). Радары отдаются файлом JSON.',
  })
  format?: 'xls' | 'xlsx' | 'pdf';

  @ApiPropertyOptional({ example: '2026-09-01' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  to?: string;

  @ApiPropertyOptional() universityId?: string;
  @ApiPropertyOptional() itDirectionId?: string;
  @ApiPropertyOptional() itProductId?: string;
  @ApiPropertyOptional() responsibleUserId?: string;
  @ApiPropertyOptional({ type: Boolean }) onlyOverdue?: boolean;
}

export class ReportJobDto {
  @ApiProperty({ example: '42', description: 'jobId очереди BullMQ' })
  id!: string;

  @ApiProperty({ enum: ReportTypeDto, example: ReportTypeDto.INTERACTIONS_EXPORT })
  type!: ReportTypeDto;

  @ApiProperty({ enum: ReportJobStatusDto, example: ReportJobStatusDto.QUEUED })
  status!: ReportJobStatusDto;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  requestedById!: string;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'http://localhost:3900/crm-attachments/exports/....xlsx?X-Amz-Expires=600&...',
    description: 'Временная ссылка на готовый файл в хранилище (только при status=SUCCESS); при каждом GET выдаётся заново',
  })
  resultUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'reestr-vzaimodeystviy-2026-09-26.xlsx' })
  fileName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 120 })
  rowCount?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Причина ошибки (только при status=FAILED)' })
  error?: string | null;
}
