import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowPhaseDto } from '../../workflow/dto/workflow-status.dto';

// Взаимодействие, зависшее на одном статусе дольше SLA-порога для его фазы
// (простое правило по датам из StatusHistoryEntry, без ML).
export class SlaRadarItemDto {
  @ApiProperty({ example: 'b3000000-0000-4000-8000-000000000001' })
  interactionInstanceId!: string;

  // Nullable — заявки из интеграции с needsReview=true могут быть без вуза.
  @ApiPropertyOptional({ example: 'a5000000-0000-4000-8000-000000000001', nullable: true })
  universityId?: string | null;

  @ApiPropertyOptional({ example: 'СПбГУ (демо)', nullable: true })
  universityName?: string | null;

  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  currentStatusId!: string;

  @ApiProperty({ example: 'Согласование договора' })
  currentStatusName!: string;

  @ApiProperty({ enum: WorkflowPhaseDto, example: WorkflowPhaseDto.CONTRACTING })
  phase!: WorkflowPhaseDto;

  @ApiPropertyOptional({ example: 'c0000000-0000-4000-8000-000000000001', nullable: true })
  responsibleUserId?: string | null;

  @ApiPropertyOptional({ example: 'Иванова Мария Сергеевна', nullable: true })
  responsibleUserName?: string | null;

  @ApiProperty({ example: '2026-09-06T14:30:00.000Z' })
  statusSince!: string;

  @ApiProperty({ example: 20, description: 'Сколько дней взаимодействие находится в текущем статусе' })
  daysInStatus!: number;

  @ApiProperty({ example: 14, description: 'SLA-порог (дней) для данной фазы' })
  slaThresholdDays!: number;
}

export class SlaRadarResultDto {
  @ApiProperty({ example: '2026-09-26T10:05:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ type: SlaRadarItemDto, isArray: true })
  items!: SlaRadarItemDto[];
}
