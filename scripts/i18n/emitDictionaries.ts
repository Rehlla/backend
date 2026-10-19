/**
 * Emit the per-language client dictionaries from the authoring catalog.
 *
 * `src/i18n/translations.ts` is the single source of truth for copy (the
 * dashboard's string overrides edit around it, never fork it). The client,
 * however, must not download both languages before first paint — that was
 * ~50% of the pre-paint dictionary bytes for every first-time visitor. So the
 * catalog is SPLIT into one flat key→string file per language; translator.ts
 * lazy-loads only the active one.
 *
 * The generated files are checked in (same discipline as the generated DDL in
 * server/db/sql) so tests, tsc and Vite all see them without a build step.
 * This script is the drift gate: run plain, it FAILS when the checked-in
 * files no longer match the catalog; `--write` regenerates them.
 *
 * Usage:
 *   tsx scripts/i18n/emitDictionaries.ts            # verify (CI / pre-commit)
 *   tsx scripts/i18n/emitDictionaries.ts --write    # regenerate
 *   (npm run i18n:emit wraps the --write form)
 *
 * Editors: change copy in src/i18n/translations.ts, then run `npm run i18n:emit`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TRANSLATIONS } from '../../src/i18n/translations';

const LANGUAGES = ['en', 'ar'] as const;
type Lang = (typeof LANGUAGES)[number];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../src/i18n/dictionaries');

function render(lang: Lang): string {
  const entries = Object.entries(TRANSLATIONS)
    .map(([key, value]) => [key, value[lang]] as const)
    // Deterministic on both key and value: a copy edit that only reorders the
    // source file should not rewrite the generated chunk (stable diffs).
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const lines = entries.map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  const bytes = entries.reduce((n, [, v]) => n + v.length, 0);

  return `/**
 * GENERATED FILE — do not edit.
 *
 * Emitted from src/i18n/translations.ts (the authoring catalog) by
 * scripts/i18n/emitDictionaries.ts. To change copy, edit the catalog and run
 * \`npm run i18n:emit\`. The plain (no --write) run is the drift gate: it fails
 * when this file is stale, and tests/domain/i18nDictionarySync.test.ts
 * re-checks the same invariant inside the unit suite.
 *
 * Language: ${lang}. ${entries.length} keys. Loaded per language by
 * src/i18n/translator.ts so first paint downloads only the active language
 * (~${bytes.toLocaleString('en-US')} chars here instead of both languages).
 *
 * Importing this module IS installing it: the setDictionary call below runs
 * as a module side effect, so translator.ts's dynamic import both downloads
 * and registers the view in one step.
 */
import { setDictionary } from '../translator';

export const ${lang.toUpperCase()}: Record<string, string> = {
${lines.join('\n')}
};

setDictionary('${lang}', ${lang.toUpperCase()});
`;
}

function main(): void {
  const write = process.argv.includes('--write');
  const problems: string[] = [];

  for (const lang of LANGUAGES) {
    const expected = render(lang);
    const outFile = path.join(OUT_DIR, `${lang}.ts`);
    let current: string | null = null;
    try {
      current = fs.readFileSync(outFile, 'utf8');
    } catch {
      current = null;
    }
    if (current === expected) continue;
    if (write) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(outFile, expected);
      console.log(`[i18n:emit] dictionaries/${lang}.ts ${current === null ? 'created' : 'updated'}.`);
    } else if (current === null) {
      problems.push(`${lang}.ts is missing (run \`npm run i18n:emit\`).`);
    } else {
      problems.push(
        `dictionaries/${lang}.ts is stale relative to src/i18n/translations.ts ` +
          `(run \`npm run i18n:emit\`).`
      );
    }
  }

  if (problems.length) {
    for (const p of problems) console.error(`[i18n:emit] ${p}`);
    console.error(`[i18n:emit] ${problems.length} problem(s)`);
    process.exit(1);
  }
  if (!write) {
    console.log('[i18n:emit] dictionaries in sync with the catalog (en, ar).');
  }
}

main();
