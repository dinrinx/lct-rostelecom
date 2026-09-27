import { readFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SyncRunStatus as PrismaSyncRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderDto } from './dto/order.dto';
import { SyncErrorDto, SyncRunDto, SyncRunStatusDto } from './dto/sync-log.dto';
import { CourseMappingDto, CourseMappingStatusDto, UpsertCourseMappingDto } from './dto/course-mapping.dto';

const ORDERS_FIXTURE_PATH = join(__dirname, '..', '..', 'fixtures', 'integrations', 'orders.json');

// Форма строки backend/fixtures/integrations/orders.json — реальная заявка от
// организаторов (см. docs/backend-plan.md, Integrations). Ключи — русские
// заголовки исходной формы, camelCase-маппинг в OrderDto ниже.
interface RawOrder {
  'Номер заявки': string;
  Курс: string;
  Фамилия: string;
  Имя: string;
  Отчество?: string | null;
  Телефон: string;
  Email: string;
  'Номер потока': number;
}

function toOrderDto(raw: RawOrder): OrderDto {
  return {
    externalId: raw['Номер заявки'],
    course: raw['Курс'],
    lastName: raw['Фамилия'],
    firstName: raw['Имя'],
    middleName: raw['Отчество'] ?? null,
    phone: raw['Телефон'],
    email: raw['Email'],
    cohortNumber: raw['Номер потока'],
  };
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Мок-адаптер: в реальной интеграции здесь был бы вызов внешнего API сайта/
  // LMS (см. docs/backend-plan.md — "интерфейс + мок-реализация... контракт
  // принят самостоятельно"). Файл — тот самый настоящий экспорт заявок от
  // организаторов; первый элемент массива — null (артефакт исходного экспорта),
  // пропускаем его, а не падаем на нём.
  private async readOrders(): Promise<OrderDto[]> {
    const raw = await readFile(ORDERS_FIXTURE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Array<RawOrder | null>;
    return parsed.filter((row): row is RawOrder => row !== null).map(toOrderDto);
  }

  async getOrders(): Promise<OrderDto[]> {
    return this.readOrders();
  }

  // Открытое решение по итогам разбора orders.json (нет колонки вуза вообще —
  // только курс и номер потока): course-mapping резолвит ТОЛЬКО направление/
  // продукт, вуз никогда не выводится автоматически из заявки. Поэтому у
  // КАЖДОГО инстанса, созданного этой синхронизацией, universityId=null,
  // responsibleUserId=null и needsReview=true — руководитель/админ назначают
  // вуз и ответственного вручную (через существующий инструментарий каталогов/
  // workflow), это НЕ делает данный метод. Если такой маппинг не устраивает —
  // это специально помечено как обсуждаемое, а не тихо зафиксированное решение.
  async runSync(actorUserId: string): Promise<SyncRunDto> {
    const startedAt = new Date();
    const orders = await this.readOrders();

    const activeVersion = await this.prisma.workflowTemplateVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { statuses: { orderBy: { order: 'asc' }, take: 1 } },
    });
    if (!activeVersion || !activeVersion.statuses[0]) {
      throw new ConflictException({
        code: 'WORKFLOW_NO_ACTIVE_TEMPLATE',
        message: 'Нет активного шаблона workflow со статусами — сначала создайте шаблон через POST /workflow/templates',
      });
    }
    const initialStatusId = activeVersion.statuses[0].id;

    let created = 0;
    let updated = 0;
    let skippedDuplicate = 0;
    const errors: SyncErrorDto[] = [];

    for (const order of orders) {
      try {
        const mapping = await this.resolveCourseMapping(order.course);
        const resolvedItProductId = mapping?.itProductId ?? null;

        const existing = await this.prisma.interactionInstance.findUnique({
          where: { externalId: order.externalId },
        });

        if (existing) {
          // Sync никогда не трогает universityId/responsibleUserId/needsReview
          // на уже существующем инстансе — это поле человека (руководитель/
          // админ), а не интеграции. Единственное, что может "обновиться" —
          // itProductId, если его раньше не было, а маппинг курса появился позже.
          if (!existing.itProductId && resolvedItProductId) {
            await this.prisma.interactionInstance.update({
              where: { id: existing.id },
              data: { itProductId: resolvedItProductId },
            });
            updated++;
          } else {
            skippedDuplicate++;
          }
          continue;
        }

        const instance = await this.prisma.interactionInstance.create({
          data: {
            externalId: order.externalId,
            itProductId: resolvedItProductId,
            universityId: null,
            responsibleUserId: null,
            needsReview: true,
            workflowTemplateVersionId: activeVersion.id,
            currentStatusId: initialStatusId,
          },
        });
        await this.prisma.statusHistoryEntry.create({
          data: {
            interactionInstanceId: instance.id,
            fromStatusId: null,
            toStatusId: initialStatusId,
            comment: `Заявка получена из интеграции (мок-адаптер сайта/LMS), курс «${order.course}»`,
            changedById: actorUserId,
          },
        });
        created++;
      } catch (error) {
        errors.push({ externalId: order.externalId, message: (error as Error).message });
      }
    }

    const finishedAt = new Date();
    const status =
      errors.length === 0
        ? PrismaSyncRunStatus.SUCCESS
        : created + updated + skippedDuplicate === 0
          ? PrismaSyncRunStatus.FAILED
          : PrismaSyncRunStatus.PARTIAL;

    const run = await this.prisma.integrationSyncRun.create({
      data: {
        status,
        startedAt,
        finishedAt,
        createdCount: created,
        updatedCount: updated,
        skippedDuplicateCount: skippedDuplicate,
        errors: errors.length ? (errors as unknown as Prisma.InputJsonValue) : undefined,
      },
    });

    return this.toSyncRunDto(run);
  }

  async getSyncLog(): Promise<SyncRunDto[]> {
    const runs = await this.prisma.integrationSyncRun.findMany({ orderBy: { startedAt: 'desc' } });
    return runs.map((run) => this.toSyncRunDto(run));
  }

  private toSyncRunDto(run: {
    id: string;
    status: string;
    startedAt: Date;
    finishedAt: Date;
    createdCount: number;
    updatedCount: number;
    skippedDuplicateCount: number;
    errors: Prisma.JsonValue;
  }): SyncRunDto {
    return {
      id: run.id,
      status: run.status as unknown as SyncRunStatusDto,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt.toISOString(),
      createdCount: run.createdCount,
      updatedCount: run.updatedCount,
      skippedDuplicateCount: run.skippedDuplicateCount,
      errors: (run.errors as unknown as SyncErrorDto[] | null) ?? undefined,
    };
  }

  // Ищет соответствие курса. Если строки для этого курса ещё нет вообще —
  // заводит её сразу как NEEDS_REVIEW (itProductId=null), чтобы курс стал
  // виден в GET /integrations/course-mapping и админ мог его домаппить —
  // это и есть "курсы без совпадения помечаются статусом требует проверки".
  private async resolveCourseMapping(course: string) {
    const existing = await this.prisma.courseMapping.findUnique({ where: { course } });
    if (existing) return existing;

    return this.prisma.courseMapping.create({
      data: { course, itDirectionId: null, itProductId: null },
    });
  }

  async getCourseMapping(): Promise<CourseMappingDto[]> {
    const rows = await this.prisma.courseMapping.findMany({ orderBy: { course: 'asc' } });
    return rows.map((row) => this.toCourseMappingDto(row));
  }

  async createCourseMapping(dto: UpsertCourseMappingDto): Promise<CourseMappingDto> {
    const existing = await this.prisma.courseMapping.findUnique({ where: { course: dto.course } });
    if (existing) {
      throw new BadRequestException({
        code: 'COURSE_MAPPING_ALREADY_EXISTS',
        message: `Для курса "${dto.course}" уже есть соответствие — используйте PUT для изменения`,
      });
    }
    const itDirectionId = await this.resolveDirectionForProduct(dto.itProductId);
    const row = await this.prisma.courseMapping.create({
      data: { course: dto.course, itProductId: dto.itProductId, itDirectionId },
    });
    return this.toCourseMappingDto(row);
  }

  async updateCourseMapping(dto: UpsertCourseMappingDto): Promise<CourseMappingDto> {
    const existing = await this.prisma.courseMapping.findUnique({ where: { course: dto.course } });
    if (!existing) {
      throw new NotFoundException({
        code: 'COURSE_MAPPING_NOT_FOUND',
        message: `Соответствие для курса "${dto.course}" не найдено — используйте POST для создания`,
      });
    }
    const itDirectionId = await this.resolveDirectionForProduct(dto.itProductId);
    const row = await this.prisma.courseMapping.update({
      where: { course: dto.course },
      data: { itProductId: dto.itProductId, itDirectionId },
    });
    return this.toCourseMappingDto(row);
  }

  // itDirectionId в CourseMapping — денормализованное удобство для фронта
  // (не нужно джойнить через ItProduct), реальный источник истины — сам продукт.
  private async resolveDirectionForProduct(itProductId: string): Promise<string> {
    const product = await this.prisma.itProduct.findUnique({ where: { id: itProductId } });
    if (!product) {
      throw new BadRequestException({
        code: 'IT_PRODUCT_NOT_FOUND',
        message: `ИТ-продукт с id "${itProductId}" не найден`,
      });
    }
    return product.itDirectionId;
  }

  private toCourseMappingDto(row: {
    id: string;
    course: string;
    itDirectionId: string | null;
    itProductId: string | null;
    updatedAt: Date;
  }): CourseMappingDto {
    return {
      id: row.id,
      course: row.course,
      itDirectionId: row.itDirectionId,
      itProductId: row.itProductId,
      status: row.itProductId ? CourseMappingStatusDto.MAPPED : CourseMappingStatusDto.NEEDS_REVIEW,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
