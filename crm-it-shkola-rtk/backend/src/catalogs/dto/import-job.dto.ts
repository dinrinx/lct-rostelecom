import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImportJobStatusDto {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// DUPLICATE_FUZZY = «требует проверки» — совпадение похоже, но не точное,
// коммит его не применяет автоматически (см. UniversityImportService.commit).
export enum ImportRowMatchDto {
  NEW = 'NEW',
  DUPLICATE_EXACT = 'DUPLICATE_EXACT',
  DUPLICATE_FUZZY = 'DUPLICATE_FUZZY',
}

// Поля University, на которые можно смаппить колонку файла. kamId сюда
// намеренно не включён — назначение ответственного КАМа через xlsx-импорт
// потребовало бы отдельного маппинга email/id в файле, это за рамками MVP.
export enum UniversityImportFieldDto {
  UNIVERSITY_NAME = 'universityName',
  INN = 'inn',
  REGION = 'region',
  WEBSITE = 'website',
}

export class ImportColumnMappingDto {
  @ApiProperty({ example: 'Название вуза', description: 'Точный заголовок колонки в файле' })
  column!: string;

  @ApiProperty({ enum: UniversityImportFieldDto, example: UniversityImportFieldDto.UNIVERSITY_NAME })
  field!: UniversityImportFieldDto;
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

  @ApiPropertyOptional({ example: 0.86, description: 'Оценка схожести названия с matchedUniversityId (0..1), только для DUPLICATE_FUZZY' })
  similarity?: number;
}

export class ImportPreviewResultDto {
  @ApiProperty({ example: 'h0000000-0000-4000-8000-000000000001' })
  previewId!: string;

  @ApiProperty({ example: 'Загрузка пользователей.xlsx' })
  fileName!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['Название вуза', 'ИНН', 'Регион', 'Сайт'],
    description: 'Заголовки колонок первого листа файла — кандидаты для маппинга',
  })
  availableColumns?: string[];

  @ApiPropertyOptional({
    type: ImportColumnMappingDto,
    isArray: true,
    description:
      'Маппинг, который реально применён к rows. Если запрос пришёл без mapping — это авто-подобранное ' +
      'предположение (по ключевым словам в заголовках), а rows пустой: сначала подтвердите/поправьте ' +
      'маппинг и вызовите preview повторно с ним же в теле запроса.',
  })
  appliedMapping?: ImportColumnMappingDto[];

  @ApiProperty({
    example: false,
    description: 'true — маппинг не был передан явно, это только предложенный вариант; rows ещё пустой',
  })
  isMappingSuggestion!: boolean;

  @ApiProperty({ type: ImportPreviewRowDto, isArray: true })
  rows!: ImportPreviewRowDto[];

  @ApiProperty({ example: 30, description: 'Строк с данными в файле (без учёта строки заголовка)' })
  totalRows!: number;

  @ApiProperty({ example: 3 })
  duplicateRows!: number;

  @ApiProperty({
    example: 1,
    description: 'Строки, пропущенные из rows — пустое значение в колонке, смапленной на universityName',
  })
  skippedRows!: number;
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
