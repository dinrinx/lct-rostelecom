import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkflowPhaseDto {
  INITIATION = 'INITIATION',
  NEGOTIATION = 'NEGOTIATION',
  CONTRACTING = 'CONTRACTING',
  IMPLEMENTATION = 'IMPLEMENTATION',
  ACTIVE_USE = 'ACTIVE_USE',
  RENEWAL = 'RENEWAL',
  TERMINATION = 'TERMINATION',
}

export class WorkflowStatusDto {
  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Согласование договора' })
  name!: string;

  @ApiProperty({ enum: WorkflowPhaseDto, example: WorkflowPhaseDto.CONTRACTING })
  phase!: WorkflowPhaseDto;

  @ApiProperty({ example: 3 })
  order!: number;

  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000002' })
  workflowTemplateVersionId!: string;

  @ApiPropertyOptional({ example: 21, nullable: true, description: 'Норматив SLA, дней в статусе; null — без норматива' })
  slaDays!: number | null;

  @ApiProperty({ example: 14, description: 'Минимальная длительность этапа, дней (для критического пути)' })
  minDays!: number;

  @ApiProperty({ example: false, description: 'Необязательный этап — не удлиняет критический путь' })
  isOptional!: boolean;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['b1000000-0000-4000-8000-000000000002'],
    description: 'id статусов этой же версии, после которых может начаться этап',
  })
  dependsOnStatusIds!: string[];
}
