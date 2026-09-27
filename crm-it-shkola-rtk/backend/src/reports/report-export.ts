import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { InteractionReportItemDto } from './dto/interaction-report-item.dto';

// pdfkit со стандартными 14 PDF-шрифтами (Helvetica и т.п.) поддерживает
// только WinAnsi — кириллицы там физически нет, текст превращается в мусор
// при экстракции/копировании. DejaVu Sans — свободный TTF с полным покрытием
// кириллицы, подключаем явно вместо булт-инных имён шрифтов.
const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

// Та же библиотека, что и в импорте каталогов (prisma/seed.ts читает ею
// vendors.xlsx) — здесь она же, но на запись.
export async function renderInteractionsXlsx(items: InteractionReportItemDto[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Взаимодействия');

  sheet.columns = [
    { header: 'Вуз', key: 'universityName', width: 30 },
    { header: 'ИТ-направление', key: 'itDirectionName', width: 30 },
    { header: 'ИТ-продукт', key: 'itProductName', width: 25 },
    { header: 'Статус', key: 'currentStatusName', width: 25 },
    { header: 'Макростадия', key: 'currentPhase', width: 20 },
    { header: 'Ответственный', key: 'responsibleUserName', width: 25 },
    { header: 'Создано', key: 'createdAt', width: 20 },
    { header: 'Обновлено', key: 'updatedAt', width: 20 },
    { header: 'Дней в статусе', key: 'daysInCurrentStatus', width: 15 },
    { header: 'Просрочено', key: 'isOverdue', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const item of items) {
    sheet.addRow({
      universityName: item.universityName,
      itDirectionName: item.itDirectionName ?? '',
      itProductName: item.itProductName ?? '',
      currentStatusName: item.currentStatusName,
      currentPhase: item.currentPhase,
      responsibleUserName: item.responsibleUserName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      daysInCurrentStatus: item.daysInCurrentStatus,
      isOverdue: item.isOverdue ? 'да' : 'нет',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// MVP: простая табличная раскладка без дизайна (по заданию) — фиксированные
// колонки, перенос на новую страницу по мере заполнения. Не финальный отчёт
// для заказчика, только для проверки данных на фронте.
const PDF_COLUMNS: Array<{ label: string; width: number; get: (item: InteractionReportItemDto) => string }> = [
  { label: 'Вуз', width: 140, get: (i) => i.universityName ?? '— (требует проверки)' },
  { label: 'Продукт', width: 110, get: (i) => i.itProductName ?? '—' },
  { label: 'Статус', width: 130, get: (i) => i.currentStatusName },
  { label: 'Ответственный', width: 140, get: (i) => i.responsibleUserName ?? '—' },
  { label: 'Дней в статусе', width: 90, get: (i) => String(i.daysInCurrentStatus) },
  { label: 'Просрочено', width: 90, get: (i) => (i.isOverdue ? 'да' : 'нет') },
];
const PDF_ROW_HEIGHT = 18;

export async function renderInteractionsPdf(items: InteractionReportItemDto[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    doc.registerFont('Body', FONT_REGULAR);
    doc.registerFont('Bold', FONT_BOLD);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(14).font('Bold').text('Реестр взаимодействий', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(8);

    const startX = doc.page.margins.left;
    let y = doc.y;

    const drawRow = (values: string[], bold: boolean) => {
      let x = startX;
      doc.font(bold ? 'Bold' : 'Body');
      for (let i = 0; i < PDF_COLUMNS.length; i++) {
        doc.text(values[i], x, y, { width: PDF_COLUMNS[i].width, ellipsis: true });
        x += PDF_COLUMNS[i].width;
      }
      y += PDF_ROW_HEIGHT;
    };

    drawRow(PDF_COLUMNS.map((c) => c.label), true);

    for (const item of items) {
      if (y > doc.page.height - doc.page.margins.bottom - PDF_ROW_HEIGHT) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      drawRow(
        PDF_COLUMNS.map((c) => c.get(item)),
        false,
      );
    }

    if (items.length === 0) {
      doc.font('Body').text('Нет данных по заданным фильтрам', startX, y);
    }

    doc.end();
  });
}
