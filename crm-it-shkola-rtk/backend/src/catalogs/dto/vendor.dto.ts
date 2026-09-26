import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';

export class VendorDto {
  @ApiProperty({ example: 'a3f0c2f0-4444-4a11-9a11-000000000030' })
  id!: string;

  @ApiProperty({ example: 'ООО «Базис»' })
  name!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  contactInfo?: string | null;

  @ApiPropertyOptional({ example: 'Иванов Иван Иванович' })
  contactName?: string | null;

  @ApiPropertyOptional({ example: '+7 (900) 111-22-33' })
  contactPhone?: string | null;

  @ApiPropertyOptional({ example: 'ivanov.ii@example.ru' })
  contactEmail?: string | null;

  @ApiPropertyOptional({ example: 'Почта, Чат в ТГ' })
  contactChannel?: string | null;

  @ApiProperty({ example: '2026-09-26T11:29:07.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-26T11:29:07.000Z' })
  updatedAt!: string;
}

export class CreateVendorDto extends OmitType(VendorDto, ['id', 'createdAt', 'updatedAt'] as const) {}

export class UpdateVendorDto extends PartialType(CreateVendorDto) {}
