import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import type { CatalogScope } from '../catalogs/catalog-scope.interceptor';

// Мок только тех методов PrismaService, которые реально трогает transition() —
// не поднимаем ни Nest-модуль, ни реальную БД, чтобы граф переходов проверялся
// изолированно от инфраструктуры.
function createPrismaMock() {
  return {
    interactionInstance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
// Этот тест — про граф переходов, а не про RBAC-видимость (см. отдельный
// тест на видимость), поэтому берём scope без ограничений (как ADMINISTRATOR),
// чтобы assertUniversityVisible не мешала проверять именно transition-логику.
const UNRESTRICTED_SCOPE: CatalogScope = { visibleKamIds: null, includeUnassigned: false };

describe('WorkflowService.transition', () => {
  it('отклоняет переход, которого нет в графе WorkflowTransition этой версии шаблона', async () => {
    const prisma = createPrismaMock();
    prisma.interactionInstance.findUnique.mockResolvedValue({
      id: INSTANCE_ID,
      workflowTemplateVersionId: VERSION_ID,
      currentStatusId: CURRENT_STATUS_ID,
      university: { kamId: 'kam-1' },
    });
    // Нет строки WorkflowTransition для (versionId, fromStatusId, toStatusId) —
    // значит переход не входит в граф этой версии.
    prisma.workflowTransition.findFirst.mockResolvedValue(null);

    const service = new WorkflowService(prisma as any);

    let caught: unknown;
    try {
      await service.transition(
        INSTANCE_ID,
        { toStatusId: 'status-not-in-graph' },
        ACTOR_USER_ID,
        UNRESTRICTED_SCOPE,
      );
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
      university: { kamId: 'kam-1' },
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
    prisma.interactionInstance.updateMany.mockResolvedValue({ count: 1 });
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
    const result = await service.transition(
      INSTANCE_ID,
      { toStatusId: targetStatusId },
      ACTOR_USER_ID,
      UNRESTRICTED_SCOPE,
    );

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

  // Регресс на гонку: двойной клик/параллельные запросы из одного статуса. Второй
  // запрос проходит проверку графа (читал устаревший currentStatusId), но
  // compare-and-swap в транзакции не находит строку -> 409 и НЕТ записи в историю.
  it('отклоняет параллельный переход, если статус уже изменился (409, история не дублируется)', async () => {
    const prisma = createPrismaMock();
    const targetStatusId = 'status-contracting';

    prisma.interactionInstance.findUnique.mockResolvedValue({
      id: INSTANCE_ID,
      workflowTemplateVersionId: VERSION_ID,
      currentStatusId: CURRENT_STATUS_ID,
      university: { kamId: 'kam-1' },
    });
    prisma.workflowTransition.findFirst.mockResolvedValue({ id: 'transition-1' });
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({ statusHistoryEntry: prisma.statusHistoryEntry, interactionInstance: prisma.interactionInstance }),
    );
    prisma.interactionInstance.updateMany.mockResolvedValue({ count: 0 });

    const service = new WorkflowService(prisma as any);
    await expect(
      service.transition(INSTANCE_ID, { toStatusId: targetStatusId }, ACTOR_USER_ID, UNRESTRICTED_SCOPE),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.interactionInstance.updateMany).toHaveBeenCalledWith({
      where: { id: INSTANCE_ID, currentStatusId: CURRENT_STATUS_ID },
      data: { currentStatusId: targetStatusId },
    });
    expect(prisma.statusHistoryEntry.create).not.toHaveBeenCalled();
  });

  // Проверка видимости — на уровне сервиса, не только в контроллере: даже если
  // переход разрешён графом WorkflowTransition, КАМ не может выполнить его над
  // чужим вузом (не своим по University.kamId).
  it('отклоняет переход по чужому вузу, даже если переход разрешён графом', async () => {
    const prisma = createPrismaMock();
    const targetStatusId = 'status-contracting';
    const kamScope: CatalogScope = { visibleKamIds: ['kam-own'], includeUnassigned: false };

    prisma.interactionInstance.findUnique.mockResolvedValue({
      id: INSTANCE_ID,
      workflowTemplateVersionId: VERSION_ID,
      currentStatusId: CURRENT_STATUS_ID,
      university: { kamId: 'kam-someone-else' },
    });
    prisma.workflowTransition.findFirst.mockResolvedValue({
      id: 'transition-1',
      workflowTemplateVersionId: VERSION_ID,
      fromStatusId: CURRENT_STATUS_ID,
      toStatusId: targetStatusId,
    });

    const service = new WorkflowService(prisma as any);

    let caught: unknown;
    try {
      await service.transition(INSTANCE_ID, { toStatusId: targetStatusId }, ACTOR_USER_ID, kamScope);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ForbiddenException);
    // Проверка видимости идёт раньше проверки графа переходов — не должно
    // даже дойти до попытки что-либо записать.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('WorkflowService.updateInstance (PATCH)', () => {
  const REST = { visibleKamIds: null, includeUnassigned: false } as CatalogScope;

  it.each(['currentStatusId', 'toStatusId', 'workflowTemplateVersionId'])(
    'не даёт сменить статус/версию через PATCH (%s) — только через transition',
    async (field) => {
      const prisma = createPrismaMock();
      const service = new WorkflowService(prisma as any);
      await expect(service.updateInstance(INSTANCE_ID, { [field]: 'x' } as any, REST)).rejects.toMatchObject({
        response: { code: 'WORKFLOW_STATUS_VIA_TRANSITION_ONLY' },
      });
      expect(prisma.interactionInstance.findUnique).not.toHaveBeenCalled();
      expect(prisma.workflowTransition.findFirst).not.toHaveBeenCalled();
    },
  );

  it('отклоняет пустой PATCH', async () => {
    const service = new WorkflowService(createPrismaMock() as any);
    await expect(service.updateInstance(INSTANCE_ID, {}, REST)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_PATCH_EMPTY' },
    });
  });

  it('КАМ не может сменить ответственного, но заметку своего взаимодействия правит', async () => {
    const prisma: any = createPrismaMock();
    prisma.interactionInstance.findUnique.mockResolvedValue({
      id: INSTANCE_ID,
      universityId: 'uni-1',
      responsibleUserId: 'kam-1',
      university: { kamId: 'kam-1' },
    });
    prisma.interactionInstance.update.mockResolvedValue({
      id: INSTANCE_ID, universityId: 'uni-1', itProductId: null, workflowTemplateVersionId: VERSION_ID,
      currentStatusId: CURRENT_STATUS_ID, responsibleUserId: 'kam-1', externalId: null, needsReview: false,
      note: 'ждём ректора', createdAt: new Date(), updatedAt: new Date(),
    });
    const kamScope = { role: 'KAM', visibleKamIds: ['kam-1'], includeUnassigned: false } as CatalogScope;
    const service = new WorkflowService(prisma);

    await expect(service.updateInstance(INSTANCE_ID, { responsibleUserId: 'kam-2' }, kamScope)).rejects.toBeInstanceOf(ForbiddenException);

    const result = await service.updateInstance(INSTANCE_ID, { note: '  ждём ректора  ' }, kamScope);
    expect(result.note).toBe('ждём ректора');
    expect(prisma.interactionInstance.update).toHaveBeenCalledWith({
      where: { id: INSTANCE_ID },
      data: { note: 'ждём ректора', needsReview: false },
    });
  });
});
