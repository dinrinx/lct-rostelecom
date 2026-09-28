import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ItProductDto {
  @ApiProperty({ example: 'a3f0c2f0-6666-4a11-9a11-000000000050' })
  id!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Базис Dynamix' })
  name!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'a3f0c2f0-5555-4a11-9a11-000000000040' })
  itDirectionId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'a3f0c2f0-4444-4a11-9a11-000000000030' })
  vendorId!: string;
}

export class CreateItProductDto extends OmitType(ItProductDto, ['id'] as const) {}

export class UpdateItProductDto extends PartialType(CreateItProductDto) {}
