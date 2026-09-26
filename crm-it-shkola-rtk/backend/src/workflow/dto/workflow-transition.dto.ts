import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkflowTransitionDto {
  @ApiProperty({ example: 'b2000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiPropertyOptional({ example: 'Отправить на согласование' })
  name?: string | null;

  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000002' })
  workflowTemplateVersionId!: string;

  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000001' })
  fromStatusId!: string;

  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  toStatusId!: string;
}
