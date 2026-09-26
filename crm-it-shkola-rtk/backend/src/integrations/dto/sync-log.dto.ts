import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SyncRunStatusDto {
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export class SyncErrorDto {
  @ApiProperty({ example: 'ORD-2026-000148' })
  externalId!: string;

  @ApiProperty({ example: 'Курс "Устаревший курс" не найден в course-mapping' })
  message!: string;
}

// Результат запуска синхронизации заявок из мок-адаптера LMS/сайта.
// Дедуп выполняется по «Номер заявки» (externalId в OrderDto).
export class SyncRunDto {
  @ApiProperty({ example: 'f1000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ enum: SyncRunStatusDto, example: SyncRunStatusDto.SUCCESS })
  status!: SyncRunStatusDto;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  startedAt!: string;

  @ApiProperty({ example: '2026-09-26T10:00:02.000Z' })
  finishedAt!: string;

  @ApiProperty({ example: 2, description: 'Новые InteractionInstance, созданные из заявок' })
  createdCount!: number;

  @ApiProperty({ example: 1, description: 'Существующие заявки, обновлённые повторно (по externalId)' })
  updatedCount!: number;

  @ApiProperty({ example: 0, description: 'Пропущено как дубликат по «Номер заявки»' })
  skippedDuplicateCount!: number;

  @ApiPropertyOptional({ type: SyncErrorDto, isArray: true })
  errors?: SyncErrorDto[];
}
