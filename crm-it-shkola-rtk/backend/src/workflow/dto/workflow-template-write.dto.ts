import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowPhaseDto } from './workflow-status.dto';

export class WorkflowStatusInputDto {
  @ApiProperty({ example: 'Согласование договора' })
  name!: string;

  @ApiProperty({ enum: WorkflowPhaseDto, example: WorkflowPhaseDto.CONTRACTING })
  phase!: WorkflowPhaseDto;

  @ApiProperty({ example: 2 })
  order!: number;
}

export class WorkflowTransitionInputDto {
  @ApiPropertyOptional({ example: 'Отправить на согласование' })
  name?: string;

  @ApiProperty({ example: 1, description: 'order статуса-источника среди statuses этого запроса' })
  fromStatusOrder!: number;

  @ApiProperty({ example: 2, description: 'order статуса-назначения среди statuses этого запроса' })
  toStatusOrder!: number;
}

// Создание шаблона сразу заводит его первую версию (statuses+transitions).
export class CreateWorkflowTemplateDto {
  @ApiProperty({ example: 'Типовой цикл внедрения ИТ-продукта' })
  name!: string;

  @ApiPropertyOptional({ example: 'Базовый CLM-шаблон для вузов' })
  description?: string;

  @ApiProperty({ type: WorkflowStatusInputDto, isArray: true })
  statuses!: WorkflowStatusInputDto[];

  @ApiProperty({ type: WorkflowTransitionInputDto, isArray: true })
  transitions!: WorkflowTransitionInputDto[];
}

// Правки шаблона версионируемые — PUT не изменяет существующую версию,
// а создаёт новую WorkflowTemplateVersion с обновлённым набором статусов/переходов.
export class UpdateWorkflowTemplateDto {
  @ApiPropertyOptional({ example: 'Типовой цикл внедрения ИТ-продукта (v3)' })
  name?: string;

  @ApiPropertyOptional({ example: 'Добавлен статус приёмки после внедрения' })
  description?: string;

  @ApiProperty({ type: WorkflowStatusInputDto, isArray: true })
  statuses!: WorkflowStatusInputDto[];

  @ApiProperty({ type: WorkflowTransitionInputDto, isArray: true })
  transitions!: WorkflowTransitionInputDto[];
}
