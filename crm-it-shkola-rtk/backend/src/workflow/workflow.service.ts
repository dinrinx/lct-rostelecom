import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkflowTemplateDto,
  UpdateWorkflowTemplateDto,
  WorkflowStatusInputDto,
  WorkflowTransitionInputDto,
} from './dto/workflow-template-write.dto';
import { WorkflowTemplateVersionDto, WorkflowTemplateWithActiveVersionDto } from './dto/workflow-template.dto';
import { WorkflowStatusDto } from './dto/workflow-status.dto';
import { CreateInteractionInstanceDto } from './dto/create-interaction-instance.dto';
import { TransitionInteractionInstanceDto } from './dto/transition-interaction-instance.dto';
import { InteractionInstanceDto, StatusHistoryEntryDto } from './dto/interaction-instance.dto';
import type { CatalogScope } from '../catalogs/catalog-scope.interceptor';
import { assertUniversityVisible, universityWhereForScope } from '../catalogs/catalogs.service';

function toInstanceDto(instance: {
  id: string;
  universityId: string;
  itProductId: string | null;
  workflowTemplateVersionId: string;
  currentStatusId: string;
  responsibleUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): InteractionInstanceDto {
  return {
    id: instance.id,
    universityId: instance.universityId,
    itProductId: instance.itProductId,
    workflowTemplateVersionId: instance.workflowTemplateVersionId,
    currentStatusId: instance.currentStatusId,
    responsibleUserId: instance.responsibleUserId,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}

function toHistoryEntryDto(entry: {
  id: string;
  interactionInstanceId: string;
  fromStatusId: string | null;
  toStatusId: string;
  comment: string | null;
  changedById: string;
  attachmentId: string | null;
  changedAt: Date;
  toStatus: { name: string; phase: string };
  fromStatus: { name: string } | null;
}): StatusHistoryEntryDto {
  return {
    id: entry.id,
    interactionInstanceId: entry.interactionInstanceId,
    fromStatusId: entry.fromStatusId,
    toStatusId: entry.toStatusId,
    toStatusName: entry.toStatus.name,
    toStatusPhase: entry.toStatus.phase as WorkflowStatusDto['phase'],
    fromStatusName: entry.fromStatus?.name ?? null,
    comment: entry.comment,
    changedById: entry.changedById,
    attachmentId: entry.attachmentId,
    changedAt: entry.changedAt.toISOString(),
  };
}

// Prisma-enum WorkflowPhase и Swagger-enum WorkflowPhaseDto имеют одинаковые
// строковые значения, но разные типы — приводим на границе маппинга в DTO
// (тот же приём, что и для LicenseStatus в catalogs.service.ts).
export function toStatusDto(status: {
  id: string;
  name: string;
  phase: string;
  order: number;
  workflowTemplateVersionId: string;
  slaDays: number | null;
  minDays: number;
  isOptional: boolean;
  dependsOnStatusIds: string[];
}): WorkflowStatusDto {
  return {
    id: status.id,
    name: status.name,
    phase: status.phase as WorkflowStatusDto['phase'],
    order: status.order,
    workflowTemplateVersionId: status.workflowTemplateVersionId,
    slaDays: status.slaDays,
    minDays: status.minDays,
    isOptional: status.isOptional,
    dependsOnStatusIds: status.dependsOnStatusIds,
  };
}

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(): Promise<WorkflowTemplateWithActiveVersionDto[]> {
    const templates = await this.prisma.workflowTemplate.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'asc' },
          include: {
            statuses: { orderBy: { order: 'asc' } },
            transitions: true,
            _count: { select: { interactionInstances: true } },
          },
        },
      },
    });

    return templates.map((template) => {
      const activeVersion = template.versions.find((version) => version.isActive);
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        activeVersion: activeVersion
          ? {
              id: activeVersion.id,
              versionNumber: activeVersion.versionNumber,
              isActive: activeVersion.isActive,
              workflowTemplateId: template.id,
              statuses: activeVersion.statuses.map(toStatusDto),
              transitions: activeVersion.transitions,
            }
          : null,
        versions: template.versions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNumber,
          isActive: version.isActive,
          createdAt: version.createdAt.toISOString(),
          instanceCount: version._count.interactionInstances,
        })),
      };
    });
  }

  // Версия (в том числе архивная) нужна карточке взаимодействия: инстанс
  // привязан к своей версии, и допустимые переходы/SLA берутся именно из неё.
  async getTemplateVersion(id: string): Promise<WorkflowTemplateVersionDto> {
    const version = await this.prisma.workflowTemplateVersion.findUnique({
      where: { id },
      include: { statuses: { orderBy: { order: 'asc' } }, transitions: true },
    });
    if (!version) {
      throw new NotFoundException({
        code: 'WORKFLOW_TEMPLATE_VERSION_NOT_FOUND',
        message: `Версия шаблона workflow с id "${id}" не найдена`,
      });
    }
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      isActive: version.isActive,
      workflowTemplateId: version.workflowTemplateId,
      statuses: version.statuses.map(toStatusDto),
      transitions: version.transitions,
    };
  }

  async createTemplate(dto: CreateWorkflowTemplateDto): Promise<WorkflowTemplateVersionDto> {
    this.assertStatusesAndTransitionsValid(dto.statuses, dto.transitions);

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.workflowTemplate.create({
        data: { name: dto.name, description: dto.description },
      });

      const version = await tx.workflowTemplateVersion.create({
        data: { workflowTemplateId: template.id, versionNumber: 1, isActive: true },
      });

      return this.createStatusesAndTransitions(tx, version.id, dto.statuses, dto.transitions);
    });
  }

  async updateTemplate(id: string, dto: UpdateWorkflowTemplateDto): Promise<WorkflowTemplateVersionDto> {
    this.assertStatusesAndTransitionsValid(dto.statuses, dto.transitions);

    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'WORKFLOW_TEMPLATE_NOT_FOUND',
        message: `Шаблон workflow с id "${id}" не найден`,
      });
    }

    const nextVersionNumber = (template.versions[0]?.versionNumber ?? 0) + 1;
    const previousActive = template.versions.find((version) => version.isActive);

    return this.prisma.$transaction(async (tx) => {
      // Правка НЕ мутирует текущую версию: старая версия помечается isActive=false
      // и остаётся в БД как есть — существующие InteractionInstance по-прежнему
      // ссылаются на её id (workflowTemplateVersionId) и не переезжают автоматически.
      await tx.workflowTemplateVersion.updateMany({
        where: { workflowTemplateId: id, isActive: true },
        data: { isActive: false },
      });

      if (dto.name !== undefined || dto.description !== undefined) {
        await tx.workflowTemplate.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
          },
        });
      }

      const version = await tx.workflowTemplateVersion.create({
        data: { workflowTemplateId: id, versionNumber: nextVersionNumber, isActive: true },
      });

      const created = await this.createStatusesAndTransitions(tx, version.id, dto.statuses, dto.transitions);

      if (dto.migrateInstances && previousActive) {
        await this.migrateInstances(tx, previousActive.id, version.id, dto.statuses, created.statuses);
      }

      return created;
    });
  }

  // Перенос процессов на новую версию (опция migrateInstances): статус нового
  // инстанса ищется по sourceStatusId — id статуса прежней версии, продолжением
  // которого является новый. Инстансы, чей текущий статус не перенесён в новую
  // версию (удалён), остаются на старой версии — молча терять их нельзя.
  // История переходов не переписывается: StatusHistoryEntry append-only и
  // продолжает ссылаться на статусы той версии, в которой переход был сделан.
  private async migrateInstances(
    tx: Prisma.TransactionClient,
    fromVersionId: string,
    toVersionId: string,
    inputs: WorkflowStatusInputDto[],
    createdStatuses: WorkflowStatusDto[],
  ): Promise<void> {
    const newIdByOrder = new Map(createdStatuses.map((status) => [status.order, status.id]));
    for (const input of inputs) {
      if (!input.sourceStatusId) continue;
      const newStatusId = newIdByOrder.get(input.order);
      if (!newStatusId) continue;
      // Сырой SQL, а не updateMany: Prisma проставила бы @updatedAt, и у всех процессов
      // «Обновлено» стало бы «сегодня» — хотя по самому процессу ничего не происходило.
      await tx.$executeRaw`
        UPDATE "InteractionInstance"
        SET "workflowTemplateVersionId" = ${toVersionId}, "currentStatusId" = ${newStatusId}
        WHERE "workflowTemplateVersionId" = ${fromVersionId} AND "currentStatusId" = ${input.sourceStatusId}`;
    }
  }

  // Видимость — та же построчная модель, что и в catalogs (КАМ — свои вузы,
  // Руководитель — команда, Админ — всё), т.к. instance наследует видимость
  // от своего University. Фильтр — на уровне Prisma-запроса (через связь
  // university), а не постфильтрацией уже полученной страницы.
  async listInstances(scope: CatalogScope): Promise<InteractionInstanceDto[]> {
    const instances = await this.prisma.interactionInstance.findMany({
      where: scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) },
      orderBy: { createdAt: 'desc' },
    });
    return instances.map(toInstanceDto);
  }

  async getInstanceById(id: string, scope: CatalogScope): Promise<InteractionInstanceDto> {
    const instance = await this.prisma.interactionInstance.findUnique({
      where: { id },
      include: { university: true },
    });
    if (!instance) {
      throw new NotFoundException({
        code: 'WORKFLOW_INSTANCE_NOT_FOUND',
        message: `Взаимодействие с id "${id}" не найдено`,
      });
    }
    assertUniversityVisible(instance.university, scope);
    return toInstanceDto(instance);
  }

  // Инстанс всегда заводится на активной версии активного шаблона — выбор
  // шаблона/версии вручную не поддерживается (в системе предполагается один
  // действующий CLM-цикл; если когда-нибудь понадобится несколько параллельных
  // шаблонов, тут придётся добавить явный workflowTemplateId в DTO).
  async createInstance(dto: CreateInteractionInstanceDto, scope: CatalogScope): Promise<InteractionInstanceDto> {
    const university = await this.prisma.university.findUnique({ where: { id: dto.universityId } });
    if (!university) {
      throw new NotFoundException({
        code: 'UNIVERSITY_NOT_FOUND',
        message: `Вуз с id "${dto.universityId}" не найден`,
      });
    }
    // КАМ заводит взаимодействие только для своего вуза (visibleKamIds=[свой id]
    // для КАМ) — та же проверка, что и на чтении, так что прямой POST с чужим
    // vuzId не обходит видимость через "создание".
    assertUniversityVisible(university, scope);

    const responsibleUserId = dto.responsibleUserId ?? university.kamId ?? undefined;
    if (!responsibleUserId) {
      throw new BadRequestException({
        code: 'INSTANCE_RESPONSIBLE_REQUIRED',
        message: 'Не указан responsibleUserId, и у вуза нет назначенного КАМа (University.kamId)',
      });
    }

    const activeVersion = await this.prisma.workflowTemplateVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { statuses: { orderBy: { order: 'asc' }, take: 1 } },
    });

    if (!activeVersion) {
      throw new ConflictException({
        code: 'WORKFLOW_NO_ACTIVE_TEMPLATE',
        message: 'Нет ни одного активного шаблона workflow — сначала создайте шаблон через POST /workflow/templates',
      });
    }

    const initialStatus = activeVersion.statuses[0];
    if (!initialStatus) {
      throw new ConflictException({
        code: 'WORKFLOW_TEMPLATE_EMPTY',
        message: 'Активная версия шаблона workflow не содержит ни одного статуса',
      });
    }

    const instance = await this.prisma.$transaction(async (tx) => {
      const created = await tx.interactionInstance.create({
        data: {
          universityId: dto.universityId,
          itProductId: dto.itProductId ?? null,
          workflowTemplateVersionId: activeVersion.id,
          currentStatusId: initialStatus.id,
          responsibleUserId,
        },
      });

      // Первая запись append-only истории — без неё GET .../history был бы
      // пустым сразу после создания, хотя фактический переход "в начальный
      // статус" уже произошёл.
      await tx.statusHistoryEntry.create({
        data: {
          interactionInstanceId: created.id,
          fromStatusId: null,
          toStatusId: initialStatus.id,
          comment: 'Взаимодействие создано',
          changedById: responsibleUserId,
        },
      });

      return created;
    });

    return toInstanceDto(instance);
  }

  async transition(
    instanceId: string,
    dto: TransitionInteractionInstanceDto,
    actorUserId: string,
    scope: CatalogScope,
  ): Promise<InteractionInstanceDto> {
    const instance = await this.prisma.interactionInstance.findUnique({
      where: { id: instanceId },
      include: { university: true },
    });
    if (!instance) {
      throw new NotFoundException({
        code: 'WORKFLOW_INSTANCE_NOT_FOUND',
        message: `Взаимодействие с id "${instanceId}" не найдено`,
      });
    }
    // Тот же вопрос видимости, что и на чтении: КАМ не может протолкнуть
    // переход по чужому вузу, даже зная id инстанса напрямую.
    assertUniversityVisible(instance.university, scope);

    // Единственный источник истины "можно ли перейти" — WorkflowTransition
    // этой конкретной версии. Проверяем ДО записи в историю, а не полагаемся
    // на FK — иначе ошибка была бы неотличима от "статус не существует".
    const allowedTransition = await this.prisma.workflowTransition.findFirst({
      where: {
        workflowTemplateVersionId: instance.workflowTemplateVersionId,
        fromStatusId: instance.currentStatusId,
        toStatusId: dto.toStatusId,
      },
    });

    if (!allowedTransition) {
      throw new BadRequestException({
        code: 'WORKFLOW_TRANSITION_NOT_ALLOWED',
        message: `Переход из текущего статуса (${instance.currentStatusId}) в статус "${dto.toStatusId}" не разрешён этой версией шаблона`,
      });
    }

    let historyEntry;
    try {
      historyEntry = await this.prisma.$transaction(async (tx) => {
        const entry = await tx.statusHistoryEntry.create({
          data: {
            interactionInstanceId: instanceId,
            fromStatusId: instance.currentStatusId,
            toStatusId: dto.toStatusId,
            comment: dto.comment ?? null,
            attachmentId: dto.attachmentId ?? null,
            changedById: actorUserId,
          },
        });

        await tx.interactionInstance.update({
          where: { id: instanceId },
          data: { currentStatusId: dto.toStatusId },
        });

        return entry;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException({
          code: 'WORKFLOW_ATTACHMENT_NOT_FOUND',
          message: `Файл с id "${dto.attachmentId}" не найден`,
        });
      }
      throw error;
    }
    void historyEntry;

    const updated = await this.prisma.interactionInstance.findUniqueOrThrow({ where: { id: instanceId } });
    return toInstanceDto(updated);
  }

  async getHistory(instanceId: string, scope: CatalogScope): Promise<StatusHistoryEntryDto[]> {
    const instance = await this.prisma.interactionInstance.findUnique({
      where: { id: instanceId },
      include: { university: true },
    });
    if (!instance) {
      throw new NotFoundException({
        code: 'WORKFLOW_INSTANCE_NOT_FOUND',
        message: `Взаимодействие с id "${instanceId}" не найдено`,
      });
    }
    assertUniversityVisible(instance.university, scope);

    // StatusHistoryEntry не хранит отдельного createdAt — changedAt и есть
    // момент записи (append-only, никаких update/delete), сортируем по нему.
    const entries = await this.prisma.statusHistoryEntry.findMany({
      where: { interactionInstanceId: instanceId },
      orderBy: { changedAt: 'asc' },
      include: { toStatus: { select: { name: true, phase: true } }, fromStatus: { select: { name: true } } },
    });

    return entries.map(toHistoryEntryDto);
  }

  // Базовая проверка целостности запроса — без неё transitions.create() упал бы
  // с невнятной ошибкой FK на несуществующий statusIdByOrder.get(...).
  private assertStatusesAndTransitionsValid(
    statuses: WorkflowStatusInputDto[],
    transitions: WorkflowTransitionInputDto[],
  ): void {
    if (!statuses?.length) {
      throw new BadRequestException({
        code: 'WORKFLOW_STATUSES_REQUIRED',
        message: 'Нужен хотя бы один статус (statuses)',
      });
    }

    const orders = new Set(statuses.map((status) => status.order));
    if (orders.size !== statuses.length) {
      throw new BadRequestException({
        code: 'WORKFLOW_STATUS_ORDER_DUPLICATE',
        message: 'Значения order у статусов должны быть уникальны в пределах запроса',
      });
    }

    for (const status of statuses) {
      for (const dependsOn of status.dependsOnOrders ?? []) {
        if (!orders.has(dependsOn) || dependsOn === status.order) {
          throw new BadRequestException({
            code: 'WORKFLOW_STATUS_DEPENDENCY_INVALID',
            message: `Статус "${status.name}" зависит от order ${dependsOn}, которого нет среди statuses (или ссылается сам на себя)`,
          });
        }
      }
    }

    for (const transition of transitions ?? []) {
      if (!orders.has(transition.fromStatusOrder) || !orders.has(transition.toStatusOrder)) {
        throw new BadRequestException({
          code: 'WORKFLOW_TRANSITION_UNKNOWN_STATUS',
          message: `Переход ссылается на order, отсутствующий среди statuses (${transition.fromStatusOrder} -> ${transition.toStatusOrder})`,
        });
      }
    }
  }

  private async createStatusesAndTransitions(
    tx: Prisma.TransactionClient,
    versionId: string,
    statusInputs: WorkflowStatusInputDto[],
    transitionInputs: WorkflowTransitionInputDto[],
  ): Promise<WorkflowTemplateVersionDto> {
    const statusIdByOrder = new Map<number, string>();
    const statuses = [];
    for (const input of statusInputs) {
      const status = await tx.workflowStatus.create({
        data: {
          name: input.name,
          phase: input.phase,
          order: input.order,
          slaDays: input.slaDays ?? null,
          minDays: input.minDays ?? 0,
          isOptional: input.isOptional ?? false,
          workflowTemplateVersionId: versionId,
        },
      });
      statusIdByOrder.set(input.order, status.id);
      statuses.push(status);
    }

    // Зависимости задаются через order (id новых статусов клиенту ещё не известны),
    // поэтому проставляем их вторым проходом, когда все id уже созданы.
    // Не указаны — этап идёт после предыдущего по order (линейная цепочка).
    const sortedOrders = [...statusIdByOrder.keys()].sort((a, b) => a - b);
    for (const status of statuses) {
      const input = statusInputs.find((candidate) => candidate.order === status.order)!;
      const previousOrder = sortedOrders[sortedOrders.indexOf(status.order) - 1];
      const dependsOnOrders = input.dependsOnOrders ?? (previousOrder !== undefined ? [previousOrder] : []);
      status.dependsOnStatusIds = dependsOnOrders.map((order) => statusIdByOrder.get(order)!);
      if (status.dependsOnStatusIds.length) {
        await tx.workflowStatus.update({
          where: { id: status.id },
          data: { dependsOnStatusIds: status.dependsOnStatusIds },
        });
      }
    }

    const transitions = [];
    for (const input of transitionInputs ?? []) {
      const transition = await tx.workflowTransition.create({
        data: {
          name: input.name,
          workflowTemplateVersionId: versionId,
          fromStatusId: statusIdByOrder.get(input.fromStatusOrder)!,
          toStatusId: statusIdByOrder.get(input.toStatusOrder)!,
        },
      });
      transitions.push(transition);
    }

    const version = await tx.workflowTemplateVersion.findUniqueOrThrow({ where: { id: versionId } });

    return {
      id: version.id,
      versionNumber: version.versionNumber,
      isActive: version.isActive,
      workflowTemplateId: version.workflowTemplateId,
      statuses: statuses.sort((a, b) => a.order - b.order).map(toStatusDto),
      transitions,
    };
  }
}
