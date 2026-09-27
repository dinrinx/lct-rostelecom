import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { distance } from 'fastest-levenshtein';
import ExcelJS from 'exceljs';
import { ImportJobStatus as PrismaImportJobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ImportColumnMappingDto,
  ImportJobDto,
  ImportJobStatusDto,
  ImportPreviewResultDto,
  ImportPreviewRowDto,
  ImportRowMatchDto,
  UniversityImportFieldDto,
} from '../dto/import-job.dto';

// Похожесть ниже этого порога — считаем разными названиями (NEW), не фаззи-дублем.
// 1 - normalizedDistance, где normalizedDistance = levenshteinDistance / max(len).
const FUZZY_MATCH_THRESHOLD = 0.82;

// previewId живёт только в памяти процесса — MVP: без отдельной таблицы под
// "черновики импорта" в БД, без пересборки после рестарта backend. Для
// хакатон-масштаба (одна сессия preview -> commit подряд) этого достаточно;
// если понадобится переживать рестарт — нужна отдельная таблица/Redis.
const PREVIEW_TTL_MS = 30 * 60 * 1000;

interface StoredPreviewRow {
  rowNumber: number;
  match: ImportRowMatchDto;
  matchedUniversityId: string | null;
  values: {
    universityName: string;
    inn?: string;
    region?: string;
    website?: string;
  };
}

interface StoredPreview {
  fileName: string;
  mapping: ImportColumnMappingDto[];
  rows: StoredPreviewRow[];
  expiresAt: number;
}

// Ключевые слова для авто-подсказки маппинга — реальный xlsx-файл, на котором
// это тестировалось (fixtures/import/users-template.xlsx, шаблон оргкомитета
// "Загрузка пользователей"), устроен вообще не про вузы: 30 колонок про ФИО/
// паспорт/СНИЛС/диплом. Из них ближе всего к "название вуза" — колонка
// "Учебное заведение по диплому", остальные не находят соответствия вообще
// (и не должны — это ожидаемый результат стресс-теста, не баг).
const FIELD_KEYWORDS: Record<UniversityImportFieldDto, string[]> = {
  [UniversityImportFieldDto.UNIVERSITY_NAME]: ['вуз', 'университет', 'учебн', 'образовательн', 'название'],
  [UniversityImportFieldDto.INN]: ['инн'],
  [UniversityImportFieldDto.REGION]: ['регион'],
  [UniversityImportFieldDto.WEBSITE]: ['сайт', 'website', 'url'],
};

@Injectable()
export class UniversityImportService {
  private readonly logger = new Logger(UniversityImportService.name);
  private readonly previews = new Map<string, StoredPreview>();

  constructor(private readonly prisma: PrismaService) {}

  async preview(
    file: Express.Multer.File | undefined,
    mapping: ImportColumnMappingDto[] | undefined,
    fileNameOverride?: string,
  ): Promise<ImportPreviewResultDto> {
    if (!file) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Нужен multipart-файл в поле "file"' });
    }

    this.sweepExpired();

    const workbook = new ExcelJS.Workbook();
    // @types/node@26 сделал Buffer дженериком, а типы exceljs (не обновлялись
    // под это) ждут старую нестрогую сигнатуру — на рантайме это тот же самый
    // Buffer, конфликт чисто в объявлениях типов двух пакетов. any точечно,
    // не вместо структурной проверки, а как выход из версийной нестыковки.
    await workbook.xlsx.load(file.buffer as any);
    // Берём первый лист с данными — как в users-template.xlsx, второй лист
    // там (Лист2) — просто справочник допустимых значений для выпадающих
    // списков (Пол/Образование), не строки для импорта, и не должен читаться как данные.
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException({ code: 'IMPORT_EMPTY_WORKBOOK', message: 'В файле нет ни одного листа' });
    }

    const headerRow = sheet.getRow(1);
    const availableColumns: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value).trim();
      if (value) availableColumns.push(value);
    });

    const fileName = fileNameOverride ?? file.originalname;

    if (!mapping || mapping.length === 0) {
      // Маппинг не передан — отдаём заголовки + предположение, rows пустой.
      // Фронт даёт админу поправить и вызвать preview повторно уже с mapping.
      const suggested = this.suggestMapping(availableColumns);
      return {
        previewId: randomUUID(),
        fileName,
        availableColumns,
        appliedMapping: suggested,
        isMappingSuggestion: true,
        rows: [],
        totalRows: Math.max(0, sheet.rowCount - 1),
        duplicateRows: 0,
        skippedRows: 0,
      };
    }

    const nameColumn = mapping.find((m) => m.field === UniversityImportFieldDto.UNIVERSITY_NAME)?.column;
    if (!nameColumn) {
      throw new BadRequestException({
        code: 'IMPORT_NAME_MAPPING_REQUIRED',
        message: `Маппинг обязан включать колонку для поля ${UniversityImportFieldDto.UNIVERSITY_NAME} — без неё не на чем строить дедуп`,
      });
    }

    const columnIndexByHeader = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = cell.value == null ? '' : String(cell.value).trim();
      if (value) columnIndexByHeader.set(value, colNumber);
    });

    for (const m of mapping) {
      if (!columnIndexByHeader.has(m.column)) {
        throw new BadRequestException({
          code: 'IMPORT_COLUMN_NOT_FOUND',
          message: `Колонка "${m.column}" из маппинга не найдена среди заголовков файла`,
        });
      }
    }

    const existingUniversities = await this.prisma.university.findMany({ select: { id: true, name: true } });

    const readCell = (row: ExcelJS.Row, header: string | undefined): string | undefined => {
      if (!header) return undefined;
      const idx = columnIndexByHeader.get(header);
      if (!idx) return undefined;
      const raw = row.getCell(idx).value;
      if (raw == null) return undefined;
      // ExcelJS отдаёт email/ссылки как {text, hyperlink} — берём text.
      const text = typeof raw === 'object' && raw !== null && 'text' in raw ? String((raw as { text: unknown }).text) : String(raw);
      const trimmed = text.trim();
      return trimmed || undefined;
    };

    const mappingByField = new Map(mapping.map((m) => [m.field, m.column]));

    const rows: ImportPreviewRowDto[] = [];
    const storedRows: StoredPreviewRow[] = [];
    let skippedRows = 0;
    let duplicateRows = 0;
    const totalRows = Math.max(0, sheet.rowCount - 1);

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const universityName = readCell(row, nameColumn);

      if (!universityName) {
        skippedRows++;
        continue;
      }

      const inn = readCell(row, mappingByField.get(UniversityImportFieldDto.INN));
      const region = readCell(row, mappingByField.get(UniversityImportFieldDto.REGION));
      const website = readCell(row, mappingByField.get(UniversityImportFieldDto.WEBSITE));

      const { match, matchedUniversityId, similarity } = this.matchUniversity(universityName, existingUniversities);
      if (match !== ImportRowMatchDto.NEW) duplicateRows++;

      rows.push({
        rowNumber,
        universityName,
        match,
        matchedUniversityId,
        ...(similarity !== undefined ? { similarity } : {}),
      });
      storedRows.push({
        rowNumber,
        match,
        matchedUniversityId,
        values: { universityName, inn, region, website },
      });
    }

    const previewId = randomUUID();
    this.previews.set(previewId, {
      fileName,
      mapping,
      rows: storedRows,
      expiresAt: Date.now() + PREVIEW_TTL_MS,
    });

    return {
      previewId,
      fileName,
      availableColumns,
      appliedMapping: mapping,
      isMappingSuggestion: false,
      rows,
      totalRows,
      duplicateRows,
      skippedRows,
    };
  }

  // DUPLICATE_FUZZY ("требует проверки") коммит НЕ применяет автоматически —
  // похожее название ещё не значит "то же самое", а тихо смержить два разных
  // вуза или создать неточный дубль хуже, чем оставить строку на ручной разбор.
  async commit(previewId: string, initiatedById: string): Promise<ImportJobDto> {
    const preview = this.previews.get(previewId);
    if (!preview || preview.expiresAt < Date.now()) {
      this.previews.delete(previewId);
      throw new NotFoundException({
        code: 'IMPORT_PREVIEW_NOT_FOUND',
        message: `Превью импорта с id "${previewId}" не найдено или истекло (превью живёт ${PREVIEW_TTL_MS / 60000} минут) — прогоните preview заново`,
      });
    }

    let created = 0;
    let updated = 0;
    let needsReview = 0;
    let failed = 0;

    for (const row of preview.rows) {
      try {
        if (row.match === ImportRowMatchDto.NEW) {
          await this.prisma.university.create({
            data: {
              name: row.values.universityName,
              inn: row.values.inn ?? null,
              region: row.values.region ?? null,
              website: row.values.website ?? null,
            },
          });
          created++;
        } else if (row.match === ImportRowMatchDto.DUPLICATE_EXACT && row.matchedUniversityId) {
          await this.prisma.university.update({
            where: { id: row.matchedUniversityId },
            data: {
              ...(row.values.inn ? { inn: row.values.inn } : {}),
              ...(row.values.region ? { region: row.values.region } : {}),
              ...(row.values.website ? { website: row.values.website } : {}),
            },
          });
          updated++;
        } else {
          needsReview++;
        }
      } catch (error) {
        failed++;
        this.logger.warn(`Ошибка применения строки импорта ${row.rowNumber}: ${(error as Error).message}`);
      }
    }

    this.previews.delete(previewId);

    const status =
      failed > 0 && created + updated === 0 ? PrismaImportJobStatus.FAILED : PrismaImportJobStatus.SUCCESS;
    const resultSummary = { created, matchedExisting: updated, needsReview, failed };

    const job = await this.prisma.importJob.create({
      data: {
        fileName: preview.fileName,
        status,
        resultSummary: resultSummary as Prisma.InputJsonValue,
        initiatedById,
      },
    });

    return {
      id: job.id,
      fileName: job.fileName,
      status: job.status as unknown as ImportJobStatusDto,
      resultSummary: job.resultSummary as Record<string, unknown>,
      initiatedById: job.initiatedById,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  private suggestMapping(availableColumns: string[]): ImportColumnMappingDto[] {
    const suggestions: ImportColumnMappingDto[] = [];
    const used = new Set<string>();

    for (const field of Object.values(UniversityImportFieldDto)) {
      const keywords = FIELD_KEYWORDS[field];
      const found = availableColumns.find(
        (col) => !used.has(col) && keywords.some((kw) => col.toLowerCase().includes(kw)),
      );
      if (found) {
        suggestions.push({ column: found, field });
        used.add(found);
      }
    }

    return suggestions;
  }

  private matchUniversity(
    name: string,
    existing: Array<{ id: string; name: string }>,
  ): { match: ImportRowMatchDto; matchedUniversityId: string | null; similarity?: number } {
    const normalized = name.trim().toLowerCase();

    const exact = existing.find((u) => u.name.trim().toLowerCase() === normalized);
    if (exact) {
      return { match: ImportRowMatchDto.DUPLICATE_EXACT, matchedUniversityId: exact.id };
    }

    let best: { id: string; similarity: number } | null = null;
    for (const u of existing) {
      const candidate = u.name.trim().toLowerCase();
      const maxLen = Math.max(normalized.length, candidate.length) || 1;
      const similarity = 1 - distance(normalized, candidate) / maxLen;
      if (!best || similarity > best.similarity) {
        best = { id: u.id, similarity };
      }
    }

    if (best && best.similarity >= FUZZY_MATCH_THRESHOLD) {
      return {
        match: ImportRowMatchDto.DUPLICATE_FUZZY,
        matchedUniversityId: best.id,
        similarity: Math.round(best.similarity * 100) / 100,
      };
    }

    return { match: ImportRowMatchDto.NEW, matchedUniversityId: null };
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [id, preview] of this.previews) {
      if (preview.expiresAt < now) this.previews.delete(id);
    }
  }
}
