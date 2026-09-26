import { WorkflowTemplateDto, WorkflowTemplateVersionDto } from '../dto/workflow-template.dto';
import { WorkflowPhaseDto, WorkflowStatusDto } from '../dto/workflow-status.dto';
import { WorkflowTransitionDto } from '../dto/workflow-transition.dto';
import { InteractionInstanceDto, StatusHistoryEntryDto } from '../dto/interaction-instance.dto';

export const WORKFLOW_TEMPLATE_FIXTURES: WorkflowTemplateDto[] = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    name: 'Типовой цикл внедрения ИТ-продукта',
    description: 'Базовый CLM-шаблон для вузов',
  },
];

const STATUS_FIXTURES: WorkflowStatusDto[] = [
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    name: 'Инициирован контакт',
    phase: WorkflowPhaseDto.INITIATION,
    order: 1,
    workflowTemplateVersionId: 'b0000000-0000-4000-8000-000000000002',
  },
  {
    id: 'b1000000-0000-4000-8000-000000000002',
    name: 'Согласование договора',
    phase: WorkflowPhaseDto.CONTRACTING,
    order: 2,
    workflowTemplateVersionId: 'b0000000-0000-4000-8000-000000000002',
  },
  {
    id: 'b1000000-0000-4000-8000-000000000003',
    name: 'Внедрение',
    phase: WorkflowPhaseDto.IMPLEMENTATION,
    order: 3,
    workflowTemplateVersionId: 'b0000000-0000-4000-8000-000000000002',
  },
];

const TRANSITION_FIXTURES: WorkflowTransitionDto[] = [
  {
    id: 'b2000000-0000-4000-8000-000000000001',
    name: 'Отправить на согласование',
    workflowTemplateVersionId: 'b0000000-0000-4000-8000-000000000002',
    fromStatusId: STATUS_FIXTURES[0].id,
    toStatusId: STATUS_FIXTURES[1].id,
  },
  {
    id: 'b2000000-0000-4000-8000-000000000002',
    name: 'Договор подписан',
    workflowTemplateVersionId: 'b0000000-0000-4000-8000-000000000002',
    fromStatusId: STATUS_FIXTURES[1].id,
    toStatusId: STATUS_FIXTURES[2].id,
  },
];

export const WORKFLOW_TEMPLATE_VERSION_FIXTURES: WorkflowTemplateVersionDto[] = [
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    versionNumber: 2,
    isActive: true,
    workflowTemplateId: WORKFLOW_TEMPLATE_FIXTURES[0].id,
    statuses: STATUS_FIXTURES,
    transitions: TRANSITION_FIXTURES,
  },
];

export const INTERACTION_INSTANCE_FIXTURES: InteractionInstanceDto[] = [
  {
    id: 'b3000000-0000-4000-8000-000000000001',
    universityId: 'a5000000-0000-4000-8000-000000000001',
    itProductId: 'a3000000-0000-4000-8000-000000000001',
    workflowTemplateVersionId: WORKFLOW_TEMPLATE_VERSION_FIXTURES[0].id,
    currentStatusId: STATUS_FIXTURES[1].id,
    responsibleUserId: 'c0000000-0000-4000-8000-000000000001',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-20T14:30:00.000Z',
  },
];

export const STATUS_HISTORY_FIXTURES: StatusHistoryEntryDto[] = [
  {
    id: 'b4000000-0000-4000-8000-000000000001',
    interactionInstanceId: INTERACTION_INSTANCE_FIXTURES[0].id,
    fromStatusId: null,
    toStatusId: STATUS_FIXTURES[0].id,
    comment: 'Заявка создана из интеграции',
    changedById: 'c0000000-0000-4000-8000-000000000001',
    changedAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'b4000000-0000-4000-8000-000000000002',
    interactionInstanceId: INTERACTION_INSTANCE_FIXTURES[0].id,
    fromStatusId: STATUS_FIXTURES[0].id,
    toStatusId: STATUS_FIXTURES[1].id,
    comment: 'Отправили проект договора',
    changedById: 'c0000000-0000-4000-8000-000000000001',
    changedAt: '2026-09-20T14:30:00.000Z',
  },
];
