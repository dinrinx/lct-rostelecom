import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportTypeDto {
  LICENSE_RADAR = 'LICENSE_RADAR',
  SLA_RADAR = 'SLA_RADAR',
}

export enum ReportJobStatusDto {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// Отчёты формируются асинхронно (BullMQ) — эндпоинт постановки в очередь
// сразу отдаёт job, а результат забирается отдельным запросом по jobId.
export class CreateReportJobDto {
  @ApiProperty({ enum: ReportTypeDto, example: ReportTypeDto.LICENSE_RADAR })
  type!: ReportTypeDto;
}

export class ReportJobDto {
  @ApiProperty({ example: 'd0000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ enum: ReportTypeDto, example: ReportTypeDto.LICENSE_RADAR })
  type!: ReportTypeDto;

  @ApiProperty({ enum: ReportJobStatusDto, example: ReportJobStatusDto.QUEUED })
  status!: ReportJobStatusDto;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  requestedById!: string;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: '/reports/jobs/d0000000-0000-4000-8000-000000000001/result' })
  resultUrl?: string | null;
}
