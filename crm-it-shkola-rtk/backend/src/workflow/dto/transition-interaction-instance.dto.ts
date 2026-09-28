import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransitionInteractionInstanceDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  toStatusId!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Договор подписан, переходим к внедрению' })
  comment?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Файл, приложенный к этому переходу (например, подписанный договор)',
  })
  attachmentId?: string | null;
}
