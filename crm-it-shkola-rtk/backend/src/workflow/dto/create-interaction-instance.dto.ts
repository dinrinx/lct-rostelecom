import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Создаёт инстанс сразу на активной версии активного шаблона workflow —
// шаблон/версия не выбираются вручную (в системе предполагается один
// действующий CLM-цикл). Начальный статус — статус с минимальным order
// в этой версии.
export class CreateInteractionInstanceDto {
  @ApiProperty({ example: 'a5000000-0000-4000-8000-000000000001', description: 'id вуза (University)' })
  universityId!: string;

  @ApiPropertyOptional({ example: 'a3000000-0000-4000-8000-000000000001', nullable: true })
  itProductId?: string | null;

  @ApiPropertyOptional({
    example: 'c0000000-0000-4000-8000-000000000001',
    description: 'Ответственный КАМ; если не указан — берётся University.kamId',
  })
  responsibleUserId?: string;
}
