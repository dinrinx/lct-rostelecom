import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export enum LicenseStatusDto {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  TERMINATED = 'TERMINATED',
}

export class LicenseDto {
  @ApiProperty({ example: 'a6000000-0000-4000-8000-000000000001' })
  id!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'DEMO-a5000000-1' })
  contractNumber?: string | null;

  @IsEnum(LicenseStatusDto)
  @ApiProperty({ enum: LicenseStatusDto, example: LicenseStatusDto.ACTIVE })
  status!: LicenseStatusDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 50, nullable: true })
  seats?: number | null;

  @IsDateString()
  @ApiProperty({ example: '2026-03-30T00:00:00.000Z' })
  startDate!: string;

  @IsDateString()
  @ApiProperty({ example: '2026-10-26T00:00:00.000Z' })
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'a5000000-0000-4000-8000-000000000001' })
  universityId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'a3000000-0000-4000-8000-000000000001' })
  itProductId!: string;

  @ApiProperty({ example: '2026-03-30T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-30T00:00:00.000Z' })
  updatedAt!: string;
}

export class CreateLicenseDto extends OmitType(LicenseDto, ['id', 'createdAt', 'updatedAt'] as const) {}

export class UpdateLicenseDto extends PartialType(CreateLicenseDto) {}
