import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VendorDto {
  @ApiProperty({ example: 'a3f0c2f0-4444-4a11-9a11-000000000030' })
  id!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'ООО «Базис»' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: null, nullable: true })
  contactInfo?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Иванов Иван Иванович' })
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+7 (900) 111-22-33' })
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ivanov.ii@example.ru' })
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Почта, Чат в ТГ' })
  contactChannel?: string | null;

  @ApiProperty({ example: '2026-09-26T11:29:07.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-26T11:29:07.000Z' })
  updatedAt!: string;
}

export class CreateVendorDto extends OmitType(VendorDto, ['id', 'createdAt', 'updatedAt'] as const) {}

export class UpdateVendorDto extends PartialType(CreateVendorDto) {}
