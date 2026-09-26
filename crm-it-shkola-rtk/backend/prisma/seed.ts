import 'dotenv/config';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
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
}

async function resetSeedManagedTables() {
  // Порядок важен из-за внешних ключей. Затрагиваем только то, что заполняет этот seed.
  // University.kamId ссылается на User — university.deleteMany() обязан идти раньше user.deleteMany().
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
  await seedDemoUniversitiesAndLicenses(productsByName, { kam1: kam1.id, kam2: kam2.id });

  console.log(
    `Готово: вендоров и продуктов из ${rows.length} строк файла, плюс синтетические вузы/лицензии, плюс 4 демо-пользователя (admin/rukovoditel/kam/kam2).`,
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
