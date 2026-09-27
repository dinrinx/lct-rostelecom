import { ApiPropertyOptional } from '@nestjs/swagger';

// Ручное назначение вуза/ответственного на инстанс, у которого их ещё нет
// (needsReview=true — как правило, инстансы из POST /integrations/sync,
// где заявка не содержит вуза). Оба поля необязательны по отдельности, но
// хотя бы одно должно быть передано — см. WORKFLOW_ASSIGNMENT_EMPTY.
export class AssignInteractionInstanceDto {
  @ApiPropertyOptional({ example: 'a5000000-0000-4000-8000-000000000001' })
  universityId?: string;

  @ApiPropertyOptional({ example: 'c0000000-0000-4000-8000-000000000001' })
  responsibleUserId?: string;
}
