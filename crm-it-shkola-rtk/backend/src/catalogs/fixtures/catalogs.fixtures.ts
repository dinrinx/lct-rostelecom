import { VendorDto } from '../dto/vendor.dto';
import { ItDirectionDto } from '../dto/it-direction.dto';
import { ItProductDto } from '../dto/it-product.dto';
import { UniversityDto } from '../dto/university.dto';
import { ResponsiblePersonDto } from '../dto/responsible-person.dto';
import { LicenseDto, LicenseStatusDto } from '../dto/license.dto';
// Фикстуры повторяют записи, попадающие в БД из backend/prisma/seed-data/vendors.xlsx
// (см. backend/prisma/seed.ts). Контактные поля вендора берутся из первой строки
// реестра для этой компании — в самом файле контакт указан на уровне продукта.

const now = '2026-09-26T11:29:07.000Z';

export const IT_DIRECTION_FIXTURES: ItDirectionDto[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'Импортированные продукты (реестр вендоров)',
    description: 'Автоматически создано из backend/prisma/seed-data/vendors.xlsx',
  },
];

export const VENDOR_FIXTURES: VendorDto[] = [
  {
    id: 'a2000000-0000-4000-8000-000000000001',
    name: 'ООО «Базис»',
    contactInfo: null,
    contactName: 'Иванов Иван Иванович',
    contactPhone: '+7 (900) 111-22-33',
    contactEmail: 'ivanov.ii@example.ru',
    contactChannel: 'Почта, Чат в ТГ',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'a2000000-0000-4000-8000-000000000002',
    name: 'ООО «ТДата»',
    contactInfo: null,
    contactName: 'Смирнова Анна Петровна',
    contactPhone: '+7 (911) 222-33-44',
    contactEmail: 'smirnova.ap@example.ru',
    contactChannel: 'Чат в ТГ',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'a2000000-0000-4000-8000-000000000003',
    name: 'ПАО «Ростелеком»',
    contactInfo: null,
    contactName: 'Кузнецов Дмитрий Сергеевич',
    contactPhone: '+7 (922) 333-44-55',
    contactEmail: 'kuznetsov.ds@example.ru',
    contactChannel: 'Чат в ТГ',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'a2000000-0000-4000-8000-000000000004',
    name: 'ООО «РТК ИТ Плюс»',
    contactInfo: null,
    contactName: 'Попова Мария Владимировна',
    contactPhone: '+7 (933) 444-55-66',
    contactEmail: 'popova.mv@example.ru',
    contactChannel: 'Чат в ТГ',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'a2000000-0000-4000-8000-000000000005',
    name: 'ООО «РТК ИТ»',
    contactInfo: null,
    contactName: 'Лебедева Елена Дмитриевна',
    contactPhone: '+7 (955) 666-77-88',
    contactEmail: 'lebedeva.ed@example.ru',
    contactChannel: 'Чат в ТГ',
    createdAt: now,
    updatedAt: now,
  },
];

export const IT_PRODUCT_FIXTURES: ItProductDto[] = [
  {
    id: 'a3000000-0000-4000-8000-000000000001',
    name: 'Базис Dynamix',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[0].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000002',
    name: 'RT.DataLake',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[1].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000003',
    name: 'RT.Warehouse',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[1].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000004',
    name: 'RT.DataVision',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[2].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000005',
    name: 'AKOLA',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[3].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000006',
    name: 'Яга',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[3].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000007',
    name: 'Web3Gate',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[4].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000008',
    name: 'Аврора SDK',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[4].id,
  },
  {
    id: 'a3000000-0000-4000-8000-000000000009',
    name: 'Нейрошлюз',
    itDirectionId: IT_DIRECTION_FIXTURES[0].id,
    vendorId: VENDOR_FIXTURES[4].id,
  },
];

export const RESPONSIBLE_PERSON_FIXTURES: ResponsiblePersonDto[] = [
  {
    id: 'a4000000-0000-4000-8000-000000000001',
    fullName: 'Иванов Иван Иванович',
    position: null,
    email: 'ivanov.ii@example.ru',
    phone: '+7 (900) 111-22-33',
    contactMethod: 'Почта, Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[0].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000002',
    fullName: 'Смирнова Анна Петровна',
    position: null,
    email: 'smirnova.ap@example.ru',
    phone: '+7 (911) 222-33-44',
    contactMethod: 'Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[1].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000003',
    fullName: 'Смирнова Анна Петровна',
    position: null,
    email: 'smirnova.ap@example.ru',
    phone: '+7 (911) 222-33-44',
    contactMethod: 'Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[2].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000004',
    fullName: 'Кузнецов Дмитрий Сергеевич',
    position: null,
    email: 'kuznetsov.ds@example.ru',
    phone: '+7 (922) 333-44-55',
    contactMethod: 'Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[3].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000005',
    fullName: 'Попова Мария Владимировна',
    position: null,
    email: 'popova.mv@example.ru',
    phone: '+7 (933) 444-55-66',
    contactMethod: 'Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[4].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000006',
    fullName: 'Соколов Алексей Андреевич',
    position: null,
    email: 'sokolov.aa@example.ru',
    phone: '+7 (944) 555-66-77',
    contactMethod: 'Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[5].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000007',
    fullName: 'Лебедева Елена Дмитриевна',
    position: null,
    email: 'lebedeva.ed@example.ru',
    phone: '+7 (955) 666-77-88',
    contactMethod: 'Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[6].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000008',
    fullName: 'Козлов Максим Игоревич',
    position: null,
    email: 'kozlov.mi@example.ru',
    phone: '+7 (966) 777-88-99',
    contactMethod: 'Чат в ТГ',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[7].id,
  },
  {
    id: 'a4000000-0000-4000-8000-000000000009',
    fullName: 'Новикова Ольга Александровна',
    position: null,
    email: 'novikova.oa@example.ru',
    phone: '+7 (977) 888-99-00',
    contactMethod: 'Почта',
    universityId: null,
    itProductId: IT_PRODUCT_FIXTURES[8].id,
  },
];

export const UNIVERSITY_FIXTURES: UniversityDto[] = [
  {
    id: 'a5000000-0000-4000-8000-000000000001',
    name: 'СПбГУ (демо)',
    inn: null,
    region: 'демо-регион',
    website: null,
    kamId: null,
  },
  {
    id: 'a5000000-0000-4000-8000-000000000002',
    name: 'МГТУ им. Баумана (демо)',
    inn: null,
    region: 'демо-регион',
    website: null,
    kamId: null,
  },
  {
    id: 'a5000000-0000-4000-8000-000000000003',
    name: 'НГУ (демо)',
    inn: null,
    region: 'демо-регион',
    website: null,
    kamId: null,
  },
];

// Смещения от «сегодня» повторяют seed.ts (endDateOffsets), чтобы демо-фикстура
// сразу покрывала пороги радара лицензий/SLA: просрочена, 7/30/60 дней, «спокойная».
const NOW = new Date('2026-09-26T11:29:07.000Z');
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

export const LICENSE_FIXTURES: LicenseDto[] = [
  {
    id: 'a6000000-0000-4000-8000-000000000001',
    contractNumber: 'DEMO-a5000000-1',
    status: LicenseStatusDto.TERMINATED,
    seats: 50,
    startDate: daysFromNow(-180),
    endDate: daysFromNow(-5),
    universityId: UNIVERSITY_FIXTURES[0].id,
    itProductId: IT_PRODUCT_FIXTURES[0].id,
    createdAt: daysFromNow(-180),
    updatedAt: daysFromNow(-5),
  },
  {
    id: 'a6000000-0000-4000-8000-000000000002',
    contractNumber: 'DEMO-a5000000-2',
    status: LicenseStatusDto.ACTIVE,
    seats: 75,
    startDate: daysFromNow(-180),
    endDate: daysFromNow(7),
    universityId: UNIVERSITY_FIXTURES[0].id,
    itProductId: IT_PRODUCT_FIXTURES[1].id,
    createdAt: daysFromNow(-180),
    updatedAt: daysFromNow(-180),
  },
  {
    id: 'a6000000-0000-4000-8000-000000000003',
    contractNumber: 'DEMO-a5000000-3',
    status: LicenseStatusDto.ACTIVE,
    seats: 50,
    startDate: daysFromNow(-180),
    endDate: daysFromNow(30),
    universityId: UNIVERSITY_FIXTURES[1].id,
    itProductId: IT_PRODUCT_FIXTURES[2].id,
    createdAt: daysFromNow(-180),
    updatedAt: daysFromNow(-180),
  },
  {
    id: 'a6000000-0000-4000-8000-000000000004',
    contractNumber: 'DEMO-a5000000-4',
    status: LicenseStatusDto.ACTIVE,
    seats: 75,
    startDate: daysFromNow(-180),
    endDate: daysFromNow(60),
    universityId: UNIVERSITY_FIXTURES[1].id,
    itProductId: IT_PRODUCT_FIXTURES[3].id,
    createdAt: daysFromNow(-180),
    updatedAt: daysFromNow(-180),
  },
  {
    id: 'a6000000-0000-4000-8000-000000000005',
    contractNumber: 'DEMO-a5000000-5',
    status: LicenseStatusDto.ACTIVE,
    seats: 50,
    startDate: daysFromNow(-180),
    endDate: daysFromNow(400),
    universityId: UNIVERSITY_FIXTURES[2].id,
    itProductId: IT_PRODUCT_FIXTURES[4].id,
    createdAt: daysFromNow(-180),
    updatedAt: daysFromNow(-180),
  },
];
