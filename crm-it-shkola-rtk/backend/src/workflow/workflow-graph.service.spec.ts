import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowPhaseDto } from './dto/workflow-status.dto';
import type { UpdateWorkflowGraphDto } from './dto/workflow-graph.dto';

// Мок только того, что реально трогает updateTemplateGraph() — тот же подход,
// что в workflow.service.spec.ts (изолированно от Nest/БД).
function createPrismaMock() {
  const tx = {
    workflowTemplateVersion: { updateMany: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
    workflowStatus: { create: jest.fn(), update: jest.fn() },
    workflowTransition: { create: jest.fn() },
  };
  return {
    workflowTemplate: { findUnique: jest.fn() },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    tx,
  };
}

const TEMPLATE_ID = 'template-1';

function baseGraph(overrides: Partial<UpdateWorkflowGraphDto> = {}): UpdateWorkflowGraphDto {
  return {
    statuses: [
      { id: 'st-1', name: 'Инициация', phase: WorkflowPhaseDto.INITIATION, order: 1 },
      { id: 'st-2', name: 'Переговоры', phase: WorkflowPhaseDto.NEGOTIATION, order: 2, dependsOnStatusIds: ['st-1'] },
    ],
    transitions: [{ fromStatusId: 'st-1', toStatusId: 'st-2', name: 'Далее' }],
    ...overrides,
  };
}

describe('WorkflowService.updateTemplateGraph — валидация', () => {
  it('отклоняет переход, ссылающийся на несуществующий statusId', async () => {
    const prisma = createPrismaMock();
    const service = new WorkflowService(prisma as any);
    const dto = baseGraph({ transitions: [{ fromStatusId: 'st-1', toStatusId: 'st-999' }] });
    await expect(service.updateTemplateGraph(TEMPLATE_ID, dto)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_GRAPH_TRANSITION_UNKNOWN_STATUS' },
    });
    expect(prisma.workflowTemplate.findUnique).not.toHaveBeenCalled();
  });

  it('отклоняет dependsOnStatusIds на несуществующий id', async () => {
    const prisma = createPrismaMock();
    const service = new WorkflowService(prisma as any);
    const dto = baseGraph({
      statuses: [
        { id: 'st-1', name: 'Инициация', phase: WorkflowPhaseDto.INITIATION, order: 1 },
        { id: 'st-2', name: 'Переговоры', phase: WorkflowPhaseDto.NEGOTIATION, order: 2, dependsOnStatusIds: ['ghost'] },
      ],
    });
    await expect(service.updateTemplateGraph(TEMPLATE_ID, dto)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_STATUS_DEPENDENCY_INVALID' },
    });
  });

  it('отклоняет статус без валидной макростадии (phase)', async () => {
    const prisma = createPrismaMock();
    const service = new WorkflowService(prisma as any);
    const dto = baseGraph({ statuses: [{ id: 'st-1', name: 'Мимо enum', phase: 'НЕ_МАКРОСТАДИЯ' as WorkflowPhaseDto, order: 1 }], transitions: [] });
    await expect(service.updateTemplateGraph(TEMPLATE_ID, dto)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_STATUS_PHASE_REQUIRED' },
    });
  });

  it('отклоняет дублирующиеся id статусов', async () => {
    const prisma = createPrismaMock();
    const service = new WorkflowService(prisma as any);
    const dto = baseGraph({
      statuses: [
        { id: 'st-1', name: 'A', phase: WorkflowPhaseDto.INITIATION, order: 1 },
        { id: 'st-1', name: 'B', phase: WorkflowPhaseDto.NEGOTIATION, order: 2 },
      ],
      transitions: [],
    });
    await expect(service.updateTemplateGraph(TEMPLATE_ID, dto)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_GRAPH_DUPLICATE_STATUS_ID' },
    });
  });

  it('404, если шаблон не найден', async () => {
    const prisma = createPrismaMock();
    prisma.workflowTemplate.findUnique.mockResolvedValue(null);
    const service = new WorkflowService(prisma as any);
    await expect(service.updateTemplateGraph(TEMPLATE_ID, baseGraph())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('валидный граф: создаёт новую версию одной транзакцией, статусы/переходы ссылаются по db-id', async () => {
    const prisma = createPrismaMock();
    prisma.workflowTemplate.findUnique.mockResolvedValue({ id: TEMPLATE_ID, versions: [{ versionNumber: 2 }] });
    prisma.tx.workflowTemplateVersion.create.mockResolvedValue({ id: 'version-3' });
    prisma.tx.workflowStatus.create
      .mockResolvedValueOnce({ id: 'db-st-1', name: 'Инициация', phase: 'INITIATION', order: 1, workflowTemplateVersionId: 'version-3', slaDays: null, minDays: 0, isOptional: false, dependsOnStatusIds: [] })
      .mockResolvedValueOnce({ id: 'db-st-2', name: 'Переговоры', phase: 'NEGOTIATION', order: 2, workflowTemplateVersionId: 'version-3', slaDays: null, minDays: 0, isOptional: false, dependsOnStatusIds: [] });
    prisma.tx.workflowTransition.create.mockResolvedValue({ id: 'db-tr-1', fromStatusId: 'db-st-1', toStatusId: 'db-st-2' });
    prisma.tx.workflowTemplateVersion.findUniqueOrThrow.mockResolvedValue({ id: 'version-3', versionNumber: 3, isActive: true, workflowTemplateId: TEMPLATE_ID });

    const service = new WorkflowService(prisma as any);
    const result = await service.updateTemplateGraph(TEMPLATE_ID, baseGraph());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tx.workflowTemplateVersion.updateMany).toHaveBeenCalledWith({
      where: { workflowTemplateId: TEMPLATE_ID, isActive: true },
      data: { isActive: false },
    });
    expect(prisma.tx.workflowStatus.update).toHaveBeenCalledWith({
      where: { id: 'db-st-2' },
      data: { dependsOnStatusIds: ['db-st-1'] },
    });
    expect(prisma.tx.workflowTransition.create).toHaveBeenCalledWith({
      data: { name: 'Далее', workflowTemplateVersionId: 'version-3', fromStatusId: 'db-st-1', toStatusId: 'db-st-2' },
    });
    expect(result.versionNumber).toBe(3);
  });
});
