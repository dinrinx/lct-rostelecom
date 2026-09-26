import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImportJobStatusDto {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum ImportRowMatchDto {
  NEW = 'NEW',
  DUPLICATE_EXACT = 'DUPLICATE_EXACT',
  DUPLICATE_FUZZY = 'DUPLICATE_FUZZY',
}

// Превью xlsx-импорта: показывает построчный маппинг колонок файла на поля
// University и результат дедуп/фаззи-матчинга по названию вуза до фактической записи в БД.
export class ImportPreviewRowDto {
  @ApiProperty({ example: 2, description: 'Номер строки в исходном файле' })
  rowNumber!: number;

  @ApiProperty({ example: 'СПбГУ' })
  universityName!: string;

  @ApiProperty({ enum: ImportRowMatchDto, example: ImportRowMatchDto.DUPLICATE_FUZZY })
  match!: ImportRowMatchDto;

  @ApiPropertyOptional({
    example: 'a5000000-0000-4000-8000-000000000001',
    description: 'ID существующего вуза, если найдено совпадение',
  })
  matchedUniversityId?: string | null;
}

export class ImportPreviewResultDto {
  @ApiProperty({ example: 'h0000000-0000-4000-8000-000000000001' })
  previewId!: string;

  @ApiProperty({ example: 'Загрузка пользователей.xlsx' })
  fileName!: string;

  @ApiProperty({ type: ImportPreviewRowDto, isArray: true })
  rows!: ImportPreviewRowDto[];

  @ApiProperty({ example: 30 })
  totalRows!: number;

  @ApiProperty({ example: 3 })
  duplicateRows!: number;
}

export class CommitImportDto {
  @ApiProperty({ example: 'h0000000-0000-4000-8000-000000000001' })
  previewId!: string;
}

export class ImportJobDto {
  @ApiProperty({ example: 'h1000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Загрузка пользователей.xlsx' })
  fileName!: string;

  @ApiProperty({ enum: ImportJobStatusDto, example: ImportJobStatusDto.SUCCESS })
  status!: ImportJobStatusDto;

  @ApiPropertyOptional({ example: { created: 27, matchedExisting: 3, failed: 0 }, nullable: true })
  resultSummary?: Record<string, unknown> | null;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000002' })
  initiatedById!: string;

  @ApiProperty({ example: '2026-09-27T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-27T10:00:05.000Z' })
  updatedAt!: string;
}
