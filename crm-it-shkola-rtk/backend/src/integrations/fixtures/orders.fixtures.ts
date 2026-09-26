import { OrderDto } from '../dto/order.dto';
import { SyncRunDto, SyncRunStatusDto } from '../dto/sync-log.dto';
import { CourseMappingDto, CourseMappingStatusDto } from '../dto/course-mapping.dto';

// Повторяет форму реальной заявки из backend/fixtures/integrations/orders.json,
// уже преобразованную по маппингу, описанному в OrderDto.
export const ORDER_FIXTURES: OrderDto[] = [
  {
    externalId: 'ORD-2026-000145',
    course: 'Базис Dynamix: администрирование СУБД',
    lastName: 'Смирнова',
    firstName: 'Анна',
    middleName: 'Петровна',
    phone: '+7 (911) 222-33-44',
    email: 'smirnova.ap@example.ru',
    cohortNumber: 12,
  },
  {
    externalId: 'ORD-2026-000146',
    course: 'RT.DataLake: инженерия данных',
    lastName: 'Кузнецов',
    firstName: 'Дмитрий',
    middleName: 'Сергеевич',
    phone: '+7 (922) 333-44-55',
    email: 'kuznetsov.ds@example.ru',
    cohortNumber: 7,
  },
  {
    externalId: 'ORD-2026-000147',
    course: 'Нейрошлюз: интеграция с LMS',
    lastName: 'Новикова',
    firstName: 'Ольга',
    middleName: null,
    phone: '+7 (977) 888-99-00',
    email: 'novikova.oa@example.ru',
    cohortNumber: 3,
  },
];

export const SYNC_RUN_FIXTURES: SyncRunDto[] = [
  {
    id: 'f1000000-0000-4000-8000-000000000002',
    status: SyncRunStatusDto.PARTIAL,
    startedAt: '2026-09-26T09:00:00.000Z',
    finishedAt: '2026-09-26T09:00:03.000Z',
    createdCount: 1,
    updatedCount: 0,
    skippedDuplicateCount: 0,
    errors: [{ externalId: 'ORD-2026-000148', message: 'Курс "Устаревший курс" не найден в course-mapping' }],
  },
  {
    id: 'f1000000-0000-4000-8000-000000000001',
    status: SyncRunStatusDto.SUCCESS,
    startedAt: '2026-09-25T09:00:00.000Z',
    finishedAt: '2026-09-25T09:00:02.000Z',
    createdCount: 3,
    updatedCount: 0,
    skippedDuplicateCount: 0,
  },
];

export const COURSE_MAPPING_FIXTURES: CourseMappingDto[] = [
  {
    id: 'g0000000-0000-4000-8000-000000000001',
    course: 'Базис Dynamix: администрирование СУБД',
    itDirectionId: 'a1000000-0000-4000-8000-000000000001',
    itProductId: 'a3000000-0000-4000-8000-000000000001',
    status: CourseMappingStatusDto.MAPPED,
    updatedAt: '2026-09-20T10:00:00.000Z',
  },
  {
    id: 'g0000000-0000-4000-8000-000000000002',
    course: 'RT.DataLake: инженерия данных',
    itDirectionId: 'a1000000-0000-4000-8000-000000000001',
    itProductId: 'a3000000-0000-4000-8000-000000000002',
    status: CourseMappingStatusDto.MAPPED,
    updatedAt: '2026-09-20T10:00:00.000Z',
  },
  {
    id: 'g0000000-0000-4000-8000-000000000003',
    course: 'Нейрошлюз: интеграция с LMS',
    itDirectionId: null,
    itProductId: null,
    status: CourseMappingStatusDto.NEEDS_REVIEW,
    updatedAt: '2026-09-26T09:00:03.000Z',
  },
];
