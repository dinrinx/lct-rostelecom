import { ApiProperty } from '@nestjs/swagger';

export enum LicenseRadarBucketDto {
  OVERDUE = 'OVERDUE',
  DUE_IN_7_DAYS = 'DUE_IN_7_DAYS',
  DUE_IN_30_DAYS = 'DUE_IN_30_DAYS',
  DUE_IN_60_DAYS = 'DUE_IN_60_DAYS',
}

export class LicenseRadarItemDto {
  @ApiProperty({ example: 'e0000000-0000-4000-8000-000000000001' })
  licenseId!: string;

  @ApiProperty({ example: 'DEMO-a5000000-1' })
  contractNumber!: string;

  @ApiProperty({ example: 'a5000000-0000-4000-8000-000000000001' })
  universityId!: string;

  @ApiProperty({ example: 'СПбГУ (демо)' })
  universityName!: string;

  @ApiProperty({ example: 'a3000000-0000-4000-8000-000000000001' })
  itProductId!: string;

  @ApiProperty({ example: 'Базис Dynamix' })
  itProductName!: string;

  @ApiProperty({ example: '2026-10-03T00:00:00.000Z' })
  endDate!: string;

  @ApiProperty({ enum: LicenseRadarBucketDto, example: LicenseRadarBucketDto.DUE_IN_7_DAYS })
  bucket!: LicenseRadarBucketDto;
}

export class LicenseRadarResultDto {
  @ApiProperty({ example: 'd0000000-0000-4000-8000-000000000001' })
  jobId!: string;

  @ApiProperty({ example: '2026-09-26T10:05:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ type: LicenseRadarItemDto, isArray: true })
  items!: LicenseRadarItemDto[];
}
