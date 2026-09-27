import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatusDto } from './workflow-status.dto';
import { WorkflowTransitionDto } from './workflow-transition.dto';

export class WorkflowTemplateDto {
  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Типовой цикл внедрения ИТ-продукта' })
  name!: string;

  @ApiPropertyOptional({ example: 'Базовый CLM-шаблон для вузов' })
  description?: string | null;
}

export class WorkflowTemplateVersionDto {
  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000002' })
  id!: string;

  @ApiProperty({ example: 2 })
  versionNumber!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 'b0000000-0000-4000-8000-000000000001' })
  workflowTemplateId!: string;

  @ApiProperty({ type: WorkflowStatusDto, isArray: true })
  statuses!: WorkflowStatusDto[];

  @ApiProperty({ type: WorkflowTransitionDto, isArray: true })
  transitions!: WorkflowTransitionDto[];
}

// Форма ответа GET /workflow/templates: шаблон + его текущая активная версия
// (статусы+переходы) — раньше GET отдавал только id/name/description без версии,
// это расширение контракта, а не совместимое дополнение.
export class WorkflowTemplateWithActiveVersionDto extends WorkflowTemplateDto {
  @ApiPropertyOptional({
    type: WorkflowTemplateVersionDto,
    nullable: true,
    description: 'Активная версия шаблона; null — если у шаблона ещё нет ни одной версии',
  })
  activeVersion?: WorkflowTemplateVersionDto | null;
}
