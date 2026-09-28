import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildErrorCodesMarkdown } from '../src/common/error-codes';

// Синхронизирует docs/backend-plan.md с src/common/error-codes.ts (единственный
// источник правды) — вставляет актуальную таблицу между маркерами. Тот же
// markdown уходит и в description Swagger (main.ts/generate-openapi.ts),
// так что оба места документации гарантированно не расходятся.
const START = '<!-- ERROR_CODES:START (генерируется npm run docs:error-codes, не правьте руками) -->';
const END = '<!-- ERROR_CODES:END -->';

function main() {
  const docPath = join(__dirname, '..', '..', 'docs', 'backend-plan.md');
  const original = readFileSync(docPath, 'utf-8');
  const block = `${START}\n\n${buildErrorCodesMarkdown()}\n\n${END}`;

  let updated: string;
  if (original.includes(START) && original.includes(END)) {
    const before = original.slice(0, original.indexOf(START));
    const after = original.slice(original.indexOf(END) + END.length);
    updated = before + block + after;
  } else {
    const marker = '## Правила синхронизации команды';
    if (!original.includes(marker)) {
      throw new Error(`Не нашёл якорь "${marker}" в docs/backend-plan.md — вставьте блок вручную`);
    }
    updated = original.replace(marker, `${block}\n\n${marker}`);
  }

  writeFileSync(docPath, updated);
  console.log(`docs/backend-plan.md обновлён: ${docPath}`);
}

main();
