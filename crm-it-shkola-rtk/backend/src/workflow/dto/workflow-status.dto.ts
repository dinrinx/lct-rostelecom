import { ApiProperty } from '@nestjs/swagger';

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
}
