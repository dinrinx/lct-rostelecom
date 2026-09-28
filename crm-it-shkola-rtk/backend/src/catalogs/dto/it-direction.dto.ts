import { ApiPropertyOptional, ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ItDirectionDto {
  @ApiProperty({ example: 'a3f0c2f0-5555-4a11-9a11-000000000040' })
  id!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Импортированные продукты (реестр вендоров)' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Автоматически создано из backend/prisma/seed-data/vendors.xlsx' })
  description?: string | null;
}

export class CreateItDirectionDto extends OmitType(ItDirectionDto, ['id'] as const) {}

export class UpdateItDirectionDto extends PartialType(CreateItDirectionDto) {}
