import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Создаёт инстанс сразу на активной версии активного шаблона workflow —
// шаблон/версия не выбираются вручную (в системе предполагается один
// действующий CLM-цикл). Начальный статус — статус с минимальным order
// в этой версии.
export class CreateInteractionInstanceDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'a5000000-0000-4000-8000-000000000001', description: 'id вуза (University)' })
  universityId!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'a3000000-0000-4000-8000-000000000001', nullable: true })
  itProductId?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'c0000000-0000-4000-8000-000000000001',
    description: 'Ответственный КАМ; если не указан — берётся University.kamId',
  })
  responsibleUserId?: string;
}
