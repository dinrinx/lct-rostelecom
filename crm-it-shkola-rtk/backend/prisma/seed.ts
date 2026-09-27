import 'dotenv/config';
import { join } from 'path';
import { PrismaClient, WorkflowPhase } from '@prisma/client';
import ExcelJS from 'exceljs';

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

async function seedVendorsCatalog(rows: VendorRow[]) {
  // Каталожный раздел под продукты, импортированные из реестра вендоров
  // (в исходном файле нет разбивки по ИТ-направлениям).
  const importedDirection = await prisma.itDirection.create({
    data: {
      name: 'Импортированные продукты (реестр вендоров)',
      description: 'Автоматически создано из backend/prisma/seed-data/vendors.xlsx',
    },
  });

  const vendorsByName = new Map<string, string>(); // name -> id
  const productsByName = new Map<string, string>(); // "vendorId::productName" -> itProduct id

  for (const row of rows) {
    let vendorId = vendorsByName.get(row.company);
    if (!vendorId) {
      const vendor = await prisma.vendor.create({
        data: { name: row.company },
      });
      vendorId = vendor.id;
      vendorsByName.set(row.company, vendorId);
    }

    for (const productName of row.products) {
      const key = `${vendorId}::${productName}`;
      let itProductId = productsByName.get(key);
      if (!itProductId) {
        const itProduct = await prisma.itProduct.create({
          data: {
            name: productName,
            vendorId,
            itDirectionId: importedDirection.id,
          },
        });
        itProductId = itProduct.id;
        productsByName.set(key, itProductId);
      }

      await prisma.responsiblePerson.create({
        data: {
          fullName: row.fullName,
          phone: row.phone || null,
          email: row.email || null,
          contactMethod: row.contactMethod || null,
          itProductId,
        },
      });
    }
  }

  return { productsByName };
}

// Реальные User-записи под RBAC: без них некому быть "ответственным КАМом" —
// University.kamId остался бы null навсегда, и построчную видимость (КАМ видит
// только свои вузы, Руководитель — команду) было бы не на чем продемонстрировать.
// Email — канонические, те же что в dev-режиме авторизации (DevRoleGuard) и в
// realm-export.json тестовых пользователей Keycloak (test-kam и т.д. используют
// другие email вида test-kam@it-school-crm.local — это НЕ те же записи; матчинг
// в keycloak-режиме идёт по email из токена, так что для сквозного теста через
// Keycloak реальным test-* пользователям нужны соответствующие User-записи —
// см. README/условия задачи).
async function seedUsers() {
  const administrator = await prisma.user.create({
    data: {
      email: 'admin@it-shkola-rtk.ru',
      fullName: 'Администратор Платформы',
      role: 'ADMINISTRATOR',
    },
  });

  const rukovoditel = await prisma.user.create({
    data: {
      email: 'rukovoditel@it-shkola-rtk.ru',
      fullName: 'Петров Сергей Николаевич',
      role: 'RUKOVODITEL',
    },
  });

  const kam1 = await prisma.user.create({
    data: {
      email: 'kam@it-shkola-rtk.ru',
      fullName: 'Иванова Мария Сергеевна',
      role: 'KAM',
      managerId: rukovoditel.id,
    },
  });

  const kam2 = await prisma.user.create({
    data: {
      email: 'kam2@it-shkola-rtk.ru',
      fullName: 'Сидорова Ольга Викторовна',
      role: 'KAM',
      managerId: rukovoditel.id,
    },
  });

  return { administrator, rukovoditel, kam1, kam2 };
}

async function seedDemoUniversitiesAndLicenses(
  productsByName: Map<string, string>,
  kamIds: { kam1: string; kam2: string },
) {
  const productIds = [...productsByName.values()];

  const demoDirection = await prisma.itDirection.create({
    data: {
      name: 'Демо-направление (синтетические данные)',
      description: 'Используется только для синтетических университетов/лицензий',
    },
  });
  void demoDirection; // направление создано для полноты каталога, продукты берём реальные

  // Разнесены по двум КАМам одной команды, чтобы построчная видимость (RBAC) была
  // видна сразу: kam1 — 2 вуза, kam2 — 1, Руководитель (их менеджер) — все 3.
  const universitySeeds: Array<{ name: string; kamId: string }> = [
    { name: 'СПбГУ (демо)', kamId: kamIds.kam1 },
    { name: 'МГТУ им. Баумана (демо)', kamId: kamIds.kam2 },
    { name: 'НГУ (демо)', kamId: kamIds.kam1 },
  ];

  const universities = await Promise.all(
    universitySeeds.map(({ name, kamId }) =>
      prisma.university.create({
        data: {
          name,
          region: 'демо-регион',
          kamId,
        },
      }),
    ),
  );

  const now = new Date();
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Разброс сроков окончания, чтобы был толк в радаре лицензий/SLA:
  // просрочена, истекает через 7/30/60 дней, и одна «спокойная».
  const endDateOffsets = [-5, 7, 30, 60, 400];

  let cursor = 0;
  for (const university of universities) {
    for (let i = 0; i < 2 && productIds.length > 0; i++) {
      const itProductId = productIds[cursor % productIds.length];
      const endOffset = endDateOffsets[cursor % endDateOffsets.length];
      cursor += 1;

      await prisma.license.create({
        data: {
          universityId: university.id,
          itProductId,
          contractNumber: `DEMO-${university.id.slice(0, 8)}-${i + 1}`,
          startDate: daysFromNow(-180),
          endDate: daysFromNow(endOffset),
          seats: 50 + i * 25,
          status: endOffset < 0 ? 'TERMINATED' : 'ACTIVE',
        },
      });
    }
  }

  return { universities };
}

// 7 CLM-макростадий (WorkflowPhase) — по одному представительному статусу на
// стадию, в порядке прохождения. Название шаблона и первого статуса совпадают
// со stub-фикстурами workflow.controller.ts (WORKFLOW_TEMPLATE_FIXTURES) —
// это уже согласованный с фронтом контракт, менять не нужно.
const WORKFLOW_STATUS_SEEDS: Array<{ name: string; phase: WorkflowPhase }> = [
  { name: 'Первый контакт', phase: 'INITIATION' },
  { name: 'Переговоры условий', phase: 'NEGOTIATION' },
  { name: 'Согласование договора', phase: 'CONTRACTING' },
  { name: 'Внедрение', phase: 'IMPLEMENTATION' },
  { name: 'Активное использование', phase: 'ACTIVE_USE' },
  { name: 'Продление', phase: 'RENEWAL' },
  { name: 'Завершение сотрудничества', phase: 'TERMINATION' },
];

async function seedWorkflow(
  universities: Array<{ id: string; kamId: string | null }>,
  productIds: string[],
  kamIds: { kam1: string; kam2: string },
) {
  const template = await prisma.workflowTemplate.create({
    data: {
      name: 'Типовой цикл внедрения ИТ-продукта',
      description: 'Базовый CLM-шаблон для вузов',
    },
  });

  const version = await prisma.workflowTemplateVersion.create({
    data: {
      workflowTemplateId: template.id,
      versionNumber: 1,
      isActive: true,
    },
  });

  const statuses = [];
  for (let i = 0; i < WORKFLOW_STATUS_SEEDS.length; i++) {
    const { name, phase } = WORKFLOW_STATUS_SEEDS[i];
    statuses.push(
      await prisma.workflowStatus.create({
        data: {
          name,
          phase,
          order: i + 1,
          workflowTemplateVersionId: version.id,
        },
      }),
    );
  }

  // Линейная цепочка переходов между соседними статусами — минимальный
  // допустимый граф, достаточный для демонстрации истории и радара SLA.
  for (let i = 0; i < statuses.length - 1; i++) {
    await prisma.workflowTransition.create({
      data: {
        workflowTemplateVersionId: version.id,
        fromStatusId: statuses[i].id,
        toStatusId: statuses[i + 1].id,
      },
    });
  }

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 7 инстансов — по одному на каждую из 7 макростадий (statusIndex 0..6),
  // раскиданы по трём реальным демо-вузам (не абстрактным "Вуз N") и обоим
  // КАМам — чтобы сразу после seed было на чём проверить и построчную
  // видимость (RBAC), и радар SLA, и полный охват макростадий на фронте.
  // У 3 из них (statusIndex >= 4, самые длинные цепочки) — не общий шаблонный
  // комментарий на каждый шаг, а собственная бизнес-история перехода; файлы
  // (attachmentId) намеренно не прикладываем — для фронта не обязательны.
  const instanceSeeds: Array<{
    universityIndex: number;
    statusIndex: number;
    kamId: string;
    comments?: string[];
  }> = [
    { universityIndex: 0, statusIndex: 0, kamId: kamIds.kam1 }, // СПбГУ -> Первый контакт
    { universityIndex: 1, statusIndex: 1, kamId: kamIds.kam2 }, // МГТУ -> Переговоры условий
    { universityIndex: 2, statusIndex: 2, kamId: kamIds.kam1 }, // НГУ -> Согласование договора
    { universityIndex: 0, statusIndex: 3, kamId: kamIds.kam1 }, // СПбГУ -> Внедрение
    {
      universityIndex: 1,
      statusIndex: 4,
      kamId: kamIds.kam2, // МГТУ -> Активное использование
      comments: [
        'Связались с проректором по цифровизации МГТУ',
        'Обсудили условия лицензирования, вуз попросил скидку для факультета ИУ',
        'Договор согласован юротделом, подписан обеими сторонами',
        'Продукт развёрнут в тестовом контуре факультета',
        'Полноценная эксплуатация, около 120 активных пользователей',
      ],
    },
    {
      universityIndex: 2,
      statusIndex: 5,
      kamId: kamIds.kam1, // НГУ -> Продление
      comments: [
        'Первичный контакт с деканатом НГУ',
        'Переговоры по объёму лицензий на следующий учебный год',
        'Договор подписан обеими сторонами',
        'Внедрение завершено, продукт доступен всем кафедрам',
        'Год активной эксплуатации без инцидентов',
        'Инициировали продление лицензии на второй год',
      ],
    },
    {
      universityIndex: 0,
      statusIndex: 6,
      kamId: kamIds.kam1, // СПбГУ -> Завершение сотрудничества
      comments: [
        'Первый контакт по итогам конференции EdCrunch',
        'Переговоры по пилотному проекту для двух факультетов',
        'Договор согласован и подписан',
        'Внедрение продукта в инфраструктуру вуза',
        'Активная эксплуатация — более 300 пользователей',
        'Вуз не продлил лицензию по бюджетным причинам',
        'Сотрудничество завершено, доступ закрыт',
      ],
    },
  ];

  for (let i = 0; i < instanceSeeds.length; i++) {
    const seed = instanceSeeds[i];
    const university = universities[seed.universityIndex];
    if (!university || productIds.length === 0) continue;

    const itProductId = productIds[i % productIds.length];

    const instance = await prisma.interactionInstance.create({
      data: {
        universityId: university.id,
        itProductId,
        workflowTemplateVersionId: version.id,
        currentStatusId: statuses[seed.statusIndex].id,
        responsibleUserId: seed.kamId,
      },
    });

    // Append-only история: путь от начала цепочки до текущего статуса,
    // с разнесёнными по времени датами (для наглядности радара "зависших" статусов).
    for (let step = 0; step <= seed.statusIndex; step++) {
      const comment = seed.comments
        ? seed.comments[step]
        : step === 0
          ? 'Взаимодействие создано'
          : `Переход в статус «${statuses[step].name}»`;

      await prisma.statusHistoryEntry.create({
        data: {
          interactionInstanceId: instance.id,
          fromStatusId: step === 0 ? null : statuses[step - 1].id,
          toStatusId: statuses[step].id,
          comment,
          changedById: seed.kamId,
          changedAt: daysAgo((seed.statusIndex - step) * 10 + 1),
        },
      });
    }
  }

  return { template, version, statuses };
}

async function resetSeedManagedTables() {
  // Порядок важен из-за внешних ключей. Затрагиваем только то, что заполняет этот seed.
  // University.kamId ссылается на User — university.deleteMany() обязан идти раньше user.deleteMany().
  await prisma.fileAttachment.deleteMany();
  await prisma.statusHistoryEntry.deleteMany();
  await prisma.interactionInstance.deleteMany();
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
  await prisma.user.deleteMany();
}

async function main() {
  await resetSeedManagedTables();

  const { rukovoditel, kam1, kam2 } = await seedUsers();
  void rukovoditel;

  const rows = await readVendorRows();
  const { productsByName } = await seedVendorsCatalog(rows);
  const { universities } = await seedDemoUniversitiesAndLicenses(productsByName, {
    kam1: kam1.id,
    kam2: kam2.id,
  });
  await seedWorkflow(universities, [...productsByName.values()], { kam1: kam1.id, kam2: kam2.id });

  console.log(
    `Готово: вендоров и продуктов из ${rows.length} строк файла, плюс синтетические вузы/лицензии, плюс 4 демо-пользователя (admin/rukovoditel/kam/kam2), плюс workflow-шаблон с 7 статусами и 7 тестовых взаимодействий (по одному на каждую макростадию, у 3 — многошаговая история с комментариями).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
