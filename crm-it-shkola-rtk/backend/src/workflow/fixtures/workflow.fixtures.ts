import { WorkflowTemplateDto, WorkflowTemplateVersionDto } from '../dto/workflow-template.dto';
import { WorkflowPhaseDto, WorkflowStatusDto } from '../dto/workflow-status.dto';
import { WorkflowTransitionDto } from '../dto/workflow-transition.dto';

// WORKFLOW_TEMPLATE_FIXTURES больше не используется в контроллере (GET
// /workflow/templates теперь реальный, см. workflow.service.ts), но нужен
// как example-данные для WORKFLOW_TEMPLATE_VERSION_FIXTURES ниже.
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
