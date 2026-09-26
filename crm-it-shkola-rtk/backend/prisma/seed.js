"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const client_1 = require("@prisma/client");
const exceljs_1 = __importDefault(require("exceljs"));
const prisma = new client_1.PrismaClient();
const VENDORS_XLSX_PATH = (0, path_1.join)(__dirname, 'seed-data', 'vendors.xlsx');
function stripGuillemets(value) {
    return value.trim().replace(/^«(.*)»$/, '$1').trim();
}
function splitProducts(cell) {
    return cell
        .split(',')
        .map((part) => stripGuillemets(part))
        .filter((name) => name.length > 0);
}
async function readVendorRows() {
    const workbook = new exceljs_1.default.Workbook();
    await workbook.xlsx.readFile(VENDORS_XLSX_PATH);
    const sheet = workbook.worksheets[0];
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
            return;
        const cell = (col) => String(row.getCell(col).value ?? '').trim();
        const company = cell(1);
        const productsCell = cell(2);
        if (!company || !productsCell)
            return;
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
async function seedVendorsCatalog(rows) {
    const importedDirection = await prisma.itDirection.create({
        data: {
            name: 'Импортированные продукты (реестр вендоров)',
            description: 'Автоматически создано из backend/prisma/seed-data/vendors.xlsx',
        },
    });
    const vendorsByName = new Map();
    const productsByName = new Map();
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
async function seedDemoUniversitiesAndLicenses(productsByName) {
    const productIds = [...productsByName.values()];
    const demoDirection = await prisma.itDirection.create({
        data: {
            name: 'Демо-направление (синтетические данные)',
            description: 'Используется только для синтетических университетов/лицензий',
        },
    });
    void demoDirection;
    const universities = await Promise.all(['СПбГУ (демо)', 'МГТУ им. Баумана (демо)', 'НГУ (демо)'].map((name) => prisma.university.create({
        data: {
            name,
            region: 'демо-регион',
        },
    })));
    const now = new Date();
    const daysFromNow = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
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
    await prisma.license.deleteMany();
    await prisma.responsiblePerson.deleteMany();
    await prisma.itProduct.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.itDirection.deleteMany();
    await prisma.university.deleteMany();
}
async function main() {
    await resetSeedManagedTables();
    const rows = await readVendorRows();
    const { productsByName } = await seedVendorsCatalog(rows);
    await seedDemoUniversitiesAndLicenses(productsByName);
    console.log(`Готово: вендоров и продуктов из ${rows.length} строк файла, плюс синтетические вузы/лицензии.`);
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map