import { WorkflowPhaseDto } from './workflow-status.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InteractionInstanceDto {
  @ApiProperty({ example: 'b3000000-0000-4000-8000-000000000001' })
  id!: string;

  // Nullable: инстансы из внешней интеграции (POST /integrations/sync) не
  // содержат вуза явно, только курс — пока курс/вуз не сопоставлены вручную,
  // universityId=null и needsReview=true (см. ниже).
  @ApiPropertyOptional({ example: 'a5000000-0000-4000-8000-000000000001', nullable: true })
  universityId?: string | null;

  @ApiPropertyOptional({ example: 'a3000000-0000-4000-8000-000000000001', nullable: true })
  itProductId?: string | null;

  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000002' })
  workflowTemplateVersionId!: string;

  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  currentStatusId!: string;

  // Nullable по той же причине — интеграция не назначает ответственного
  // автоматически, только руководитель/админ вручную.
  @ApiPropertyOptional({ example: 'c0000000-0000-4000-8000-000000000001', nullable: true })
  responsibleUserId?: string | null;

  @ApiPropertyOptional({
    example: 'ORD-20260313051569-OYJRVN',
    nullable: true,
    description: '«Номер заявки» из внешней интеграции — ключ дедупа. null для инстансов, созданных вручную.',
  })
  externalId?: string | null;

  @ApiProperty({
    example: false,
    description: 'true — требует ручной проверки (вуз/направление не удалось определить автоматически из интеграции)',
  })
  needsReview!: boolean;

  @ApiPropertyOptional({
    example: 'Ждём подпись ректора до конца месяца',
    nullable: true,
    description: 'Свободная заметка к взаимодействию (PATCH /workflow/instances/{id}); не то же самое, что comment перехода в истории',
  })
  note?: string | null;

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

  // Имена/фаза денормализованы: процесс мог переехать на новую версию шаблона
  // (migrateInstances), а история ссылается на статусы той версии, где был переход.
  @ApiProperty({ example: 'Оформление партнёрства' })
  toStatusName!: string;

  @ApiProperty({ enum: WorkflowPhaseDto, example: WorkflowPhaseDto.CONTRACTING })
  toStatusPhase!: WorkflowPhaseDto;

  @ApiPropertyOptional({ example: 'Переговоры', nullable: true })
  fromStatusName?: string | null;

  @ApiPropertyOptional({ example: 'Договор подписан, переходим к внедрению' })
  comment?: string | null;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  changedById!: string;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Файл, приложенный к этому переходу' })
  attachmentId?: string | null;

  @ApiProperty({ example: '2026-09-20T14:30:00.000Z' })
  changedAt!: string;
}
