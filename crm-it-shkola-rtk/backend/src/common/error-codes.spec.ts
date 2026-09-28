import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ERROR_CODES } from './error-codes';

// Обходит весь src и вытаскивает все встречающиеся в коде code: '...'/`...`
// (в т.ч. в тернарных выражениях) — свежий код без записи в ERROR_CODES
// провалит тест, значит документация не может незаметно устареть.
function collectCodesFromSource(): Set<string> {
  const codes = new Set<string>();
  const root = join(__dirname, '..');
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules') continue;
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.ts') || name.endsWith('.spec.ts') || name === 'error-codes.ts') continue;
      const text = readFileSync(full, 'utf-8');
      for (const m of text.matchAll(/code:\s*(?:'([A-Z_]+)'|`([A-Z_]+)`)/g)) {
        codes.add(m[1] ?? m[2]);
      }
    }
  };
  walk(root);
  return codes;
}

describe('ERROR_CODES — единый источник правды по кодам ошибок', () => {
  it('документирует каждый code, реально используемый в коде (кроме generic-фолбэков фильтра)', () => {
    const documented = new Set(ERROR_CODES.map((e) => e.code));
    const usedInSource = collectCodesFromSource();
    const missing = [...usedInSource].filter((c) => !documented.has(c));
    expect(missing).toEqual([]);
  });

  it('нет дублей и нет пустого meaning', () => {
    const codes = ERROR_CODES.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(ERROR_CODES.every((e) => e.meaning.trim().length > 0)).toBe(true);
  });
});
