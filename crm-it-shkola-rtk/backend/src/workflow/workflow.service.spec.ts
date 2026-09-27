import { BadRequestException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

// Мок только тех методов PrismaService, которые реально трогает transition() —
// не поднимаем ни Nest-модуль, ни реальную БД, чтобы граф переходов проверялся
// изолированно от инфраструктуры.
function createPrismaMock() {
  return {
    interactionInstance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    workflowTransition: {
      findFirst: jest.fn(),
    },
    statusHistoryEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

const INSTANCE_ID = 'instance-1';
const VERSION_ID = 'version-1';
const CURRENT_STATUS_ID = 'status-negotiation';
const ACTOR_USER_ID = 'user-1';

describe('WorkflowService.transition', () => {
  it('отклоняет переход, которого нет в графе WorkflowTransition этой версии шаблона', async () => {
    const prisma = createPrismaMock();
    prisma.interactionInstance.findUnique.mockResolvedValue({
      id: INSTANCE_ID,
      workflowTemplateVersionId: VERSION_ID,
      currentStatusId: CURRENT_STATUS_ID,
    });
    // Нет строки WorkflowTransition для (versionId, fromStatusId, toStatusId) —
    // значит переход не входит в граф этой версии.
    prisma.workflowTransition.findFirst.mockResolvedValue(null);

    const service = new WorkflowService(prisma as any);

    let caught: unknown;
    try {
      await service.transition(INSTANCE_ID, { toStatusId: 'status-not-in-graph' }, ACTOR_USER_ID);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toMatchObject({
      code: 'WORKFLOW_TRANSITION_NOT_ALLOWED',
    });

    // Проверка графа ушла именно за ребро (fromStatusId=текущий -> запрошенный toStatusId)
    // этой конкретной версии, а не какой-то другой.
    expect(prisma.workflowTransition.findFirst).toHaveBeenCalledWith({
      where: {
        workflowTemplateVersionId: VERSION_ID,
        fromStatusId: CURRENT_STATUS_ID,
        toStatusId: 'status-not-in-graph',
      },
    });

    // Главное: раз переход не разрешён, ничего не должно быть записано —
    // ни история, ни обновление текущего статуса инстанса.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.statusHistoryEntry.create).not.toHaveBeenCalled();
    expect(prisma.interactionInstance.update).not.toHaveBeenCalled();
  });

  it('разрешает переход, который есть в графе WorkflowTransition этой версии шаблона', async () => {
    const prisma = createPrismaMock();
    const targetStatusId = 'status-contracting';

    prisma.interactionInstance.findUnique.mockResolvedValue({
      id: INSTANCE_ID,
      workflowTemplateVersionId: VERSION_ID,
      currentStatusId: CURRENT_STATUS_ID,
    });
    prisma.workflowTransition.findFirst.mockResolvedValue({
      id: 'transition-1',
      workflowTemplateVersionId: VERSION_ID,
      fromStatusId: CURRENT_STATUS_ID,
      toStatusId: targetStatusId,
    });
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        statusHistoryEntry: prisma.statusHistoryEntry,
        interactionInstance: prisma.interactionInstance,
      }),
    );
    prisma.statusHistoryEntry.create.mockResolvedValue({ id: 'history-1' });
    prisma.interactionInstance.update.mockResolvedValue(undefined);
    prisma.interactionInstance.findUniqueOrThrow.mockResolvedValue({
      id: INSTANCE_ID,
      universityId: 'uni-1',
      itProductId: null,
      workflowTemplateVersionId: VERSION_ID,
      currentStatusId: targetStatusId,
      responsibleUserId: ACTOR_USER_ID,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const service = new WorkflowService(prisma as any);
    const result = await service.transition(INSTANCE_ID, { toStatusId: targetStatusId }, ACTOR_USER_ID);

    expect(result.currentStatusId).toBe(targetStatusId);
    expect(prisma.statusHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        interactionInstanceId: INSTANCE_ID,
        fromStatusId: CURRENT_STATUS_ID,
        toStatusId: targetStatusId,
        changedById: ACTOR_USER_ID,
      }),
    });
  });
});
