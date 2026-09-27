import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InteractionInstanceDto {
  @ApiProperty({ example: 'b3000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'a5000000-0000-4000-8000-000000000001' })
  universityId!: string;

  @ApiPropertyOptional({ example: 'a3000000-0000-4000-8000-000000000001', nullable: true })
  itProductId?: string | null;

  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000002' })
  workflowTemplateVersionId!: string;

  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  currentStatusId!: string;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  responsibleUserId!: string;

  @ApiProperty({ example: '2026-09-01T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-20T14:30:00.000Z' })
  updatedAt!: string;
}

export class StatusHistoryEntryDto {
  @ApiProperty({ example: 'b4000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'b3000000-0000-4000-8000-000000000001' })
  interactionInstanceId!: string;

  @ApiPropertyOptional({ example: 'b1000000-0000-4000-8000-000000000001', nullable: true })
  fromStatusId?: string | null;

  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  toStatusId!: string;

  @ApiPropertyOptional({ example: 'Договор подписан, переходим к внедрению' })
  comment?: string | null;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  changedById!: string;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Файл, приложенный к этому переходу' })
  attachmentId?: string | null;

  @ApiProperty({ example: '2026-09-20T14:30:00.000Z' })
  changedAt!: string;
}
