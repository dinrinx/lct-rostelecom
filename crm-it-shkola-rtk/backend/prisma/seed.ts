import 'dotenv/config';
import { CACHE_NAMESPACES, createNamespacedCache, waitUntilCacheReady } from '../src/cache/caches';
import { join } from 'path';
import { PrismaClient, WorkflowPhase } from '@prisma/client';
import ExcelJS from 'exceljs';
import { Client as MinioClient } from 'minio';

const prisma = new PrismaClient();

const VENDORS_XLSX_PATH = join(__dirname, 'seed-data', 'vendors.xlsx');

// «Название» -> Название (убираем внешние кавычки-ёлочки, не трогаем содержимое)
function stripGuillemets(value: string): string {
  return value.trim().replace(/^«(.*)»$/, '$1').trim();
}

// «RT.DataLake», «RT.Warehouse» -> ['RT.DataLake', 'RT.Warehouse']
function splitProducts(cell: string): string[] {
  return cell
    .split(',')
    .map((part) => stripGuillemets(part))
    .filter((name) => name.length > 0);
}

interface VendorRow {
  company: string;
  products: string[];
  fullName: string;
  phone: string;
  email: string;
  contactMethod: string;
}

async function readVendorRows(): Promise<VendorRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(VENDORS_XLSX_PATH);
  const sheet = workbook.worksheets[0];

  const rows: VendorRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // заголовок: Компания, Продукт, ФИО, Телефон, Почта, Способ связи

    const cell = (col: number) => String(row.getCell(col).value ?? '').trim();

    const company = cell(1);
    const productsCell = cell(2);
    if (!company || !productsCell) return;

    rows.push({
      company,
      products: splitProducts(productsCell),
      fullName: cell(3),
      phone: cell(4),
      email: cell(5),
      contactMethod: cell(6),
    });
  });

  return rows;
}

// Детерминированные id (те же, что в демо-фикстурах фронта frontend/prototype/crm-data.js):
// ссылки из прототипа, Swagger-примеров и seed совпадают, и режим «демо без
// бэкенда» показывает ту же картину, что и живой API.
const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();
// hour — час суток (условно), чтобы события одного дня не сливались в одну точку
const daysAgo = (days: number, hour = 12) => new Date(NOW - days * DAY_MS + (hour - 12) * 60 * 60 * 1000);
const daysAhead = (days: number) => new Date(NOW + days * DAY_MS);

const DIRECTION_SEEDS = [
  'DevOps',
  'Анализ данных',
  'Разработка ПО',
  'Инфраструктура и облака',
  'Информационная безопасность',
];

// В реестре вендоров нет разбивки по ИТ-направлениям — раскладываем продукты
// вручную; продукт, которого нет в таблице, попадает в «Разработка ПО».
const PRODUCT_DIRECTION: Record<string, string> = {
  'Базис Dynamix': 'Инфраструктура и облака',
  'RT.DataLake': 'Анализ данных',
  'RT.Warehouse': 'Анализ данных',
  'RT.DataVision': 'Анализ данных',
  AKOLA: 'DevOps',
  'Яга': 'DevOps',
  Web3Gate: 'Разработка ПО',
  'Аврора SDK': 'Разработка ПО',
  'Нейрошлюз': 'Информационная безопасность',
};

async function seedVendorsCatalog(rows: VendorRow[]) {
  const directionIds = new Map<string, string>();
  for (let i = 0; i < DIRECTION_SEEDS.length; i++) {
    const direction = await prisma.itDirection.create({
      data: { id: id('a1000000', i + 1), name: DIRECTION_SEEDS[i] },
    });
    directionIds.set(direction.name, direction.id);
  }

  const vendorsByName = new Map<string, string>(); // name -> id
  const productIds: string[] = []; // в порядке строк файла

  for (const row of rows) {
    let vendorId = vendorsByName.get(row.company);
    if (!vendorId) {
      // Контакт вендора — первая строка компании в файле (остальные строки той же
      // компании — контакты по конкретным продуктам, они идут в ResponsiblePerson).
      const vendor = await prisma.vendor.create({
        data: {
          id: id('a2000000', vendorsByName.size + 1),
          name: row.company,
          contactName: row.fullName || null,
          contactPhone: row.phone || null,
          contactEmail: row.email || null,
          contactChannel: row.contactMethod || null,
        },
      });
      vendorId = vendor.id;
      vendorsByName.set(row.company, vendorId);
    }

    for (const productName of row.products) {
      const itProduct = await prisma.itProduct.create({
        data: {
          id: id('a3000000', productIds.length + 1),
          name: productName,
          vendorId,
          itDirectionId: directionIds.get(PRODUCT_DIRECTION[productName] ?? 'Разработка ПО')!,
        },
      });
      productIds.push(itProduct.id);

      await prisma.responsiblePerson.create({
        data: {
          fullName: row.fullName,
          phone: row.phone || null,
          email: row.email || null,
          contactMethod: row.contactMethod || null,
          itProductId: itProduct.id,
        },
      });
    }
  }

  return { productIds };
}

// Реальные User-записи под RBAC: без них некому быть "ответственным КАМом", и
// построчную видимость (КАМ видит только свои вузы, Руководитель — команду) было
// бы не на чем продемонстрировать. Email первых трёх — канонические для dev-режима
// авторизации (DevRoleGuard): X-Dev-Role=kam|rukovoditel|administrator резолвится
// именно в них. Остальных КАМов можно «примерить» через X-Dev-User-Id.
// Тестовые пользователи Keycloak (test-kam@it-school-crm.local и т.д.) — другие
// записи; для сквозного теста через Keycloak им нужны соответствующие User.
const RUKOVODITEL_ID = id('c0000000', 2);
const USER_SEEDS: Array<{ email: string; fullName: string; role: 'KAM' | 'RUKOVODITEL' | 'ADMINISTRATOR'; isActive?: boolean; managerId?: string }> = [
  { email: 'kam@it-shkola-rtk.ru', fullName: 'Иванова Мария Сергеевна', role: 'KAM', managerId: RUKOVODITEL_ID },
  { email: 'rukovoditel@it-shkola-rtk.ru', fullName: 'Петров Сергей Николаевич', role: 'RUKOVODITEL' },
  { email: 'admin@it-shkola-rtk.ru', fullName: 'Администратор Платформы', role: 'ADMINISTRATOR' },
  { email: 'orlov.da@it-shkola-rtk.ru', fullName: 'Орлов Дмитрий Андреевич', role: 'KAM', managerId: RUKOVODITEL_ID },
  { email: 'vasilieva.ai@it-shkola-rtk.ru', fullName: 'Васильева Анна Игоревна', role: 'KAM', managerId: RUKOVODITEL_ID },
  { email: 'gromov.po@it-shkola-rtk.ru', fullName: 'Громов Павел Олегович', role: 'KAM', managerId: RUKOVODITEL_ID },
  { email: 'sidorova.el@it-shkola-rtk.ru', fullName: 'Сидорова Екатерина Львовна', role: 'KAM', managerId: RUKOVODITEL_ID },
  { email: 'fedorov.iv@it-shkola-rtk.ru', fullName: 'Фёдоров Илья Викторович', role: 'KAM', isActive: false, managerId: RUKOVODITEL_ID },
];

async function seedUsers() {
  // Руководитель создаётся первым — на него ссылаются managerId КАМов.
  const isRukovoditel = (index: number) => Number(USER_SEEDS[index].role === 'RUKOVODITEL');
  const order = [...USER_SEEDS.keys()].sort((a, b) => isRukovoditel(b) - isRukovoditel(a));
  for (const index of order) {
    const seed = USER_SEEDS[index];
    await prisma.user.create({
      data: {
        id: id('c0000000', index + 1),
        email: seed.email,
        fullName: seed.fullName,
        role: seed.role,
        isActive: seed.isActive ?? true,
        managerId: seed.managerId ?? null,
      },
    });
  }
  // Активные КАМы по порядку — на них распределяются вузы.
  return USER_SEEDS.map((seed, index) => ({ ...seed, id: id('c0000000', index + 1) }))
    .filter((user) => user.role === 'KAM' && user.isActive !== false)
    .map((user) => user.id);
}

// [название, регион, индекс активного КАМа | null — ответственный не назначен]
const UNIVERSITY_SEEDS: Array<[string, string, number | null]> = [
  ['СПбГУ', 'Санкт-Петербург', 0],
  ['МГТУ им. Н. Э. Баумана', 'Москва', 0],
  ['НГУ', 'Новосибирская область', 1],
  ['УрФУ', 'Свердловская область', 1],
  ['Университет ИТМО', 'Санкт-Петербург', 0],
  ['КФУ', 'Республика Татарстан', 2],
  ['ТГУ', 'Томская область', 2],
  ['ДВФУ', 'Приморский край', 3],
  ['СФУ', 'Красноярский край', 3],
  ['МФТИ', 'Московская область', 4],
  ['ЮФУ', 'Ростовская область', 4],
  ['ННГУ им. Лобачевского', 'Нижегородская область', null],
  // Индексы 12-15 — вузы специально под демонстрацию /dashboard/health-score
  // на защите: без них health score у всех 12 «обычных» вузов колеблется
  // в узком диапазоне, и на реальном экране не сразу видно, что виджет вообще
  // умеет показывать все три цвета. Заведены на канонического демо-КАМа
  // (kamIds[0] = kam@it-shkola-rtk.ru), чтобы быть видны сразу под ролью KAM,
  // без переключения на Руководителя/Администратора.
  ['ВГУ', 'Воронежская область', 0], // red: лицензия истекает через 3 дня + давно нет активности (см. INTERACTION_SEEDS)
  ['СГУ им. Н. Г. Чернышевского', 'Саратовская область', 0], // yellow: только лицензия через 20 дней, больше никаких сигналов риска
  ['ЮУрГУ', 'Челябинская область', 0], // green: лицензия далеко, свежее взаимодействие без просрочек
  ['АлтГУ', 'Алтайский край', 0], // red по другой причине: критическая просрочка SLA (>2x норматива), лицензии нет вовсе — показывает, что health score не сводится к одним лицензиям
];

async function seedUniversities(kamIds: string[]) {
  const universities = [];
  for (let i = 0; i < UNIVERSITY_SEEDS.length; i++) {
    const [name, region, kamIndex] = UNIVERSITY_SEEDS[i];
    universities.push(
      await prisma.university.create({
        data: { id: id('a5000000', i + 1), name, region, kamId: kamIndex === null ? null : kamIds[kamIndex] },
      }),
    );
  }
  return universities;
}

// [смещение окончания в днях от сегодня, индекс вуза, индекс продукта] — разброс
// под все корзины радара: просроченные, ≤7, ≤30, ≤60 дней и «спокойные».
const LICENSE_SEEDS: Array<[number, number, number]> = [
  [-12, 0, 0], [-5, 1, 1], [-2, 3, 4], [3, 0, 1], [6, 2, 2], [12, 5, 6], [19, 1, 2], [27, 7, 5],
  [35, 4, 7], [44, 9, 8], [52, 6, 0], [58, 10, 6], [120, 3, 2], [210, 8, 3], [400, 2, 4],
  // Демо health score (см. комментарий у UNIVERSITY_SEEDS, индексы 12-15): АлтГУ (15)
  // намеренно без лицензии вовсе — её red целиком из-за просрочки SLA.
  [3, 12, 0], [20, 13, 1], [180, 14, 2],
];

async function seedLicenses(universityIds: string[], productIds: string[]) {
  for (let i = 0; i < LICENSE_SEEDS.length; i++) {
    const [offset, universityIndex, productIndex] = LICENSE_SEEDS[i];
    await prisma.license.create({
      data: {
        id: id('a6000000', i + 1),
        contractNumber: `ИТШ-${2025 + (i % 2)}/${String(117 + i * 7).padStart(4, '0')}`,
        status: offset < 0 ? 'TERMINATED' : 'ACTIVE',
        seats: 25 + (i % 4) * 25,
        startDate: daysAgo(365 - offset),
        endDate: daysAhead(offset),
        universityId: universityIds[universityIndex],
        itProductId: productIds[productIndex % productIds.length],
        createdAt: daysAgo(365),
      },
    });
  }
}

// Статусы типового CLM-цикла: [название, фаза, норматив SLA (дней), мин. длительность
// (дней), зависимости (индексы статусов) — по умолчанию предыдущий].
// «Подготовка к запуску обучения» может идти параллельно с передачей материалов и
// внедрением (зависит только от оформления партнёрства), а «Проведение обучения»
// ждёт и внедрения, и подготовки — отсюда нетривиальный критический путь.
const STATUS_SEEDS: Array<[string, WorkflowPhase, number | null, number, number[]?]> = [
  ['Инициация', 'INITIATION', 10, 3],
  ['Переговоры', 'NEGOTIATION', 14, 7],
  ['Оформление партнёрства', 'CONTRACTING', 21, 14],
  ['Передача материалов и лицензий', 'IMPLEMENTATION', 10, 5],
  ['Внедрение продукта', 'IMPLEMENTATION', 30, 14],
  ['Подготовка к запуску обучения', 'ACTIVE_USE', 21, 10, [2]],
  ['Проведение обучения', 'ACTIVE_USE', 120, 30, [4, 5]],
  ['Сопровождение и актуализация', 'RENEWAL', 60, 14],
  ['Завершено', 'TERMINATION', null, 0],
];

const HISTORY_COMMENTS = [
  'Взаимодействие создано',
  'Провели встречу, согласовали состав программ',
  'Договор о партнёрстве подписан',
  'Лицензии и методички переданы вузу',
  'Развернули стенд в лаборатории вуза',
  'Программа и расписание утверждены',
  'Стартовал поток на 48 студентов',
  'Обновили документацию и материалы',
  'Цикл закрыт, отчёт отправлен',
];

// [индекс вуза, индекс продукта, индекс текущего статуса, дней в текущем статусе]
const INTERACTION_SEEDS: Array<[number, number, number, number]> = [
  [0, 0, 2, 26], [0, 3, 4, 12], [1, 2, 1, 18], [1, 1, 5, 18], [4, 0, 0, 14], [4, 7, 3, 4], [1, 6, 2, 9], [0, 1, 7, 40],
  [2, 1, 1, 5], [2, 3, 4, 35], [3, 4, 5, 30], [3, 5, 0, 11], [2, 2, 7, 12],
  [5, 6, 3, 14], [5, 7, 1, 2], [6, 8, 6, 36], [6, 6, 0, 4],
  [7, 4, 3, 19], [7, 5, 1, 12], [8, 3, 2, 1], [8, 2, 6, 14], [7, 0, 8, 6],
  [9, 7, 2, 25], [9, 8, 3, 9], [10, 6, 0, 3], [10, 1, 4, 13], [9, 0, 6, 60], [11, 3, 1, 6],
  // Демо health score (см. UNIVERSITY_SEEDS 12-15): ВГУ (12) — 45 дней на статусе
  // "Сопровождение" (SLA-норматив 60, просрочки формально ещё нет) — красный вуз
  // остаётся красным исключительно из-за лицензии, а не смешивается с SLA-просрочкой.
  // ЮУрГУ (14) — только что созданное взаимодействие (2 дня), явно "живой" зелёный
  // вуз, а не просто пустая карточка без единого процесса. АлтГУ (15) — 50 дней на
  // статусе "Оформление партнёрства" (SLA-норматив 21, ratio ≈2.4x) — критическая
  // просрочка SLA без единого дня лицензионного риска.
  [12, 0, 7, 45], [14, 2, 0, 2], [15, 0, 2, 50],
];

// Минимальные валидные файлы-вложения, чтобы ссылки на скачивание из истории
// реально открывались (объекты кладутся в MinIO).
const PLACEHOLDER_FILES = {
  pdf: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  ),
  zip: Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]),
  jpeg: Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  ),
};

function createMinioClient() {
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'crm-minio',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'crm-minio-secret',
    // Как и в storage/minio.service.ts: Garage (в отличие от MinIO/scality)
    // реально проверяет регион в подписи запроса против своего s3_region.
    region: process.env.MINIO_REGION || undefined,
  });
}

async function seedWorkflow(
  universities: Array<{ id: string; kamId: string | null }>,
  productIds: string[],
  fallbackKamId: string,
) {
  const template = await prisma.workflowTemplate.create({
    data: {
      id: id('b0000000', 1),
      name: 'Типовой цикл внедрения ИТ-продукта',
      description: 'Базовый CLM-шаблон для вузов',
    },
  });

  // Архивная v1 — первые 7 статусов без сопровождения. Нужна, чтобы в редакторе
  // шаблона была видна история версий; процессов на ней нет.
  const archived = await prisma.workflowTemplateVersion.create({
    data: { id: id('b0000000', 3), workflowTemplateId: template.id, versionNumber: 1, isActive: false, createdAt: daysAgo(200) },
  });
  const archivedStatusIds: string[] = [];
  for (let i = 0; i < 7; i++) {
    const [name, phase, slaDays, minDays] = STATUS_SEEDS[i];
    const status = await prisma.workflowStatus.create({
      data: { id: id('b1100000', i + 1), name, phase, order: i + 1, slaDays, minDays, workflowTemplateVersionId: archived.id },
    });
    archivedStatusIds.push(status.id);
  }
  for (let i = 0; i < archivedStatusIds.length; i++) {
    await prisma.workflowStatus.update({
      where: { id: archivedStatusIds[i] },
      data: { dependsOnStatusIds: i ? [archivedStatusIds[i - 1]] : [] },
    });
    if (i < 6) {
      await prisma.workflowTransition.create({
        data: { workflowTemplateVersionId: archived.id, fromStatusId: archivedStatusIds[i], toStatusId: archivedStatusIds[i + 1], name: 'Далее' },
      });
    }
  }

  const version = await prisma.workflowTemplateVersion.create({
    data: { id: id('b0000000', 2), workflowTemplateId: template.id, versionNumber: 2, isActive: true, createdAt: daysAgo(150) },
  });

  const statusIds = STATUS_SEEDS.map((_, i) => id('b1000000', i + 1));
  for (let i = 0; i < STATUS_SEEDS.length; i++) {
    const [name, phase, slaDays, minDays, deps] = STATUS_SEEDS[i];
    await prisma.workflowStatus.create({
      data: {
        id: statusIds[i],
        name,
        phase,
        order: i + 1,
        slaDays,
        minDays,
        dependsOnStatusIds: (deps ?? (i ? [i - 1] : [])).map((index) => statusIds[index]),
        workflowTemplateVersionId: version.id,
      },
    });
  }

  // Линейная цепочка «Далее» плюс два возврата: на переговоры (договор не
  // подписали) и из сопровождения в новый учебный поток.
  const transitionSeeds: Array<[number, number, string]> = [
    ...STATUS_SEEDS.slice(0, -1).map((_, i): [number, number, string] => [i, i + 1, 'Далее']),
    [2, 1, 'Вернуть на переговоры'],
    [7, 5, 'Новый учебный поток'],
  ];
  for (const [from, to, name] of transitionSeeds) {
    await prisma.workflowTransition.create({
      data: {
        id: id('b2000000', from * 100 + to),
        name,
        workflowTemplateVersionId: version.id,
        fromStatusId: statusIds[from],
        toStatusId: statusIds[to],
      },
    });
  }

  const minio = createMinioClient();
  const bucket = process.env.MINIO_BUCKET ?? 'crm-attachments';
  let storageAvailable = true;
  try {
    if (!(await minio.bucketExists(bucket))) await minio.makeBucket(bucket);
  } catch (error) {
    storageAvailable = false;
    console.warn(`MinIO недоступен — демо-вложения не будут созданы: ${(error as Error).message}`);
  }

  let fileCounter = 0;
  for (let i = 0; i < INTERACTION_SEEDS.length; i++) {
    const [universityIndex, productIndex, statusIndex, daysInStatus] = INTERACTION_SEEDS[i];
    const university = universities[universityIndex];
    // Вуз без КАМа — процесс ведёт последний активный КАМ команды (как в прототипе).
    const responsibleUserId = university.kamId ?? fallbackKamId;
    const createdDaysAgo = daysInStatus + statusIndex * 11 + 4;

    const instance = await prisma.interactionInstance.create({
      data: {
        id: id('b3000000', i + 1),
        universityId: university.id,
        itProductId: productIds[productIndex % productIds.length],
        workflowTemplateVersionId: version.id,
        currentStatusId: statusIds[statusIndex],
        responsibleUserId,
        createdAt: daysAgo(createdDaysAgo),
        updatedAt: daysAgo(daysInStatus, 14),
      },
    });

    // Append-only история: путь от начала цепочки до текущего статуса, по ~11 дней
    // на пройденный этап. Последняя запись — вход в текущий статус (от неё
    // считаются «дней в статусе» и просрочка SLA).
    for (let step = 0; step <= statusIndex; step++) {
      const changedAt = daysAgo(step === statusIndex ? daysInStatus : daysInStatus + (statusIndex - step) * 11, 11 + (step % 5));

      let attachmentId: string | null = null;
      if (storageAvailable && (step === 2 || step === 3 || step === 6)) {
        const [fileName, mimeType, content] =
          step === 2
            ? [`dogovor-${i + 1}-podpisan.pdf`, 'application/pdf', PLACEHOLDER_FILES.pdf]
            : step === 3
              ? ['paket-dokumentov.zip', 'application/zip', PLACEHOLDER_FILES.zip]
              : ['foto-obucheniya.jpeg', 'image/jpeg', PLACEHOLDER_FILES.jpeg];
        fileCounter += 1;
        const storageKey = `attachments/seed/${id('f0000000', fileCounter)}.${fileName.split('.').pop()}`;
        await minio.putObject(bucket, storageKey, content, content.length, { 'Content-Type': mimeType });
        const file = await prisma.fileAttachment.create({
          data: {
            id: id('f0000000', fileCounter),
            fileName,
            mimeType,
            size: content.length,
            storageKey,
            uploadedById: responsibleUserId,
            interactionInstanceId: instance.id,
            createdAt: changedAt,
          },
        });
        attachmentId = file.id;
      }

      await prisma.statusHistoryEntry.create({
        data: {
          id: id('b4000000', i * 20 + step + 1),
          interactionInstanceId: instance.id,
          fromStatusId: step === 0 ? null : statusIds[step - 1],
          toStatusId: statusIds[step],
          comment: HISTORY_COMMENTS[step],
          changedById: responsibleUserId,
          attachmentId,
          changedAt,
        },
      });
    }
  }

  return { statuses: statusIds.length, files: fileCounter };
}

async function resetSeedManagedTables() {
  // Порядок важен из-за внешних ключей. Затрагиваем только то, что заполняет этот seed
  // (плюс журналы, ссылающиеся на пользователей, — иначе user.deleteMany() упадёт по FK).
  // University.kamId ссылается на User — university.deleteMany() обязан идти раньше user.deleteMany().
  await prisma.statusHistoryEntry.deleteMany();
  await prisma.fileAttachment.deleteMany();
  await prisma.interactionInstance.deleteMany();
  await prisma.integrationSyncRun.deleteMany();
  await prisma.courseMapping.deleteMany();
  await prisma.workflowTransition.deleteMany();
  await prisma.workflowStatus.deleteMany();
  await prisma.workflowTemplateVersion.deleteMany();
  await prisma.workflowTemplate.deleteMany();
  await prisma.license.deleteMany();
  await prisma.responsiblePerson.deleteMany();
  await prisma.itProduct.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.itDirection.deleteMany();
  await prisma.university.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

// Seed пишет в БД мимо API, поэтому кэш каталогов/дашборда после него устарел.
// Redis может быть не запущен — тогда сбрасывать нечего, это не ошибка.
async function flushCaches() {
  for (const namespace of CACHE_NAMESPACES) {
    const cache = createNamespacedCache(namespace, process.env.REDIS_URL ?? 'redis://localhost:6379');
    try {
      if (!(await waitUntilCacheReady(cache))) throw new Error('Redis недоступен');
      await cache.clear();
    } catch {
      console.warn(`Кэш "${namespace}" не сброшен (Redis недоступен) — он мог остаться от прошлых данных`);
    } finally {
      // force=true: graceful close() ждёт очередь команд и мог бы подвесить процесс seed.
      await Promise.all(
        cache.stores.map((store) => (store.store as { disconnect?: (force?: boolean) => Promise<void> }).disconnect?.(true).catch(() => undefined)),
      );
    }
  }
}

async function main() {
  await resetSeedManagedTables();

  const kamIds = await seedUsers();
  const rows = await readVendorRows();
  const { productIds } = await seedVendorsCatalog(rows);
  const universities = await seedUniversities(kamIds);
  await seedLicenses(
    universities.map((university) => university.id),
    productIds,
  );
  const workflow = await seedWorkflow(universities, productIds, kamIds[kamIds.length - 1]);

  console.log(
    `Готово: ${USER_SEEDS.length} пользователей, ${productIds.length} продуктов из ${rows.length} строк vendors.xlsx, ` +
      `${universities.length} вузов, ${LICENSE_SEEDS.length} лицензий, шаблон workflow (v2: ${workflow.statuses} статусов, архивная v1), ` +
      `${INTERACTION_SEEDS.length} взаимодействий с историей и ${workflow.files} вложений.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushCaches();
    await prisma.$disconnect();
    // Клиент Redis из flushCaches держит сокет открытым — без явного выхода seed не завершается.
    process.exit(process.exitCode ?? 0);
  });
