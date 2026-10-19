/**
 * One-off codemod for remediation plan §6e: replaces every inline
 * `images.unsplash.com` URL literal in `src/` with an import from
 * `src/shared/placeholderImagery`.
 *
 * Transform params differ per width across the corpus; the registry's
 * normalized `?q=80&w=<size>&auto=format&fit=crop` replaces all of them.
 * Photos that appear in >2 distinct URL variants generate both a `card`
 * and a `hero` width constant; single-variant photos generate one constant
 * preserving the original width.
 *
 * Skipped deliberately:
 * - `src/components/booking/BookingPaymentStep.tsx` (payment files are never
 *   touched — remediation plan §1/§3 exclusion),
 * - `src/shared/placeholderImagery.ts` itself (the registry),
 * - CmsContentDashboard/CmsPageEditor matches (input placeholders, not URLs).
 *
 * Run once: `npx tsx scripts/codemod-unsplash-registry.ts`
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const OUT_OF_SCOPE = new Set([
  'src/components/booking/BookingPaymentStep.tsx',
  'src/shared/placeholderImagery.ts'
]);

const PLACEHOLDER_MODULE = '../../shared/placeholderImagery';
const PLACEHOLDER_MODULE_DEEP = '../../shared/placeholderImagery';

const files = execSync('git ls-files --cached --others --exclude-standard "src/**/*.tsx" "src/**/*.ts"', {
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean)
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f, i, all) => all.indexOf(f) === i)
  // Deleted-but-still-indexed paths and out-of-scope files are skipped.
  .filter((f) => !OUT_OF_SCOPE.has(f))
  .filter((f) => existsSync(f));

const URL_RE = /https:\/\/images\.unsplash\.com\/(photo-[a-zA-Z0-9-]+)(\?[^'"`\s]*)?/g;

interface Variant {
  params: string;
  width: number | null;
}
const variantsByFile = new Map<string, Map<string, Variant[]>>();
const photoVariants = new Map<string, Map<string, Variant[]>>(); // photo -> file -> variants

// Pass 1: collect distinct (photo, params) pairs per file.
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('images.unsplash.com')) continue;
  const perFile = new Map<string, Variant[]>();
  for (const m of src.matchAll(URL_RE)) {
    const [, id, params = ''] = m;
    const widthMatch = params.match(/[?&]w=(\d+)/);
    const variant: Variant = { params, width: widthMatch ? Number(widthMatch[1]) : null };
    const list = perFile.get(id) || [];
    if (!list.some((v) => v.params === variant.params)) list.push(variant);
    perFile.set(id, list);
  }
  if (perFile.size) variantsByFile.set(file, perFile);
  for (const [id, variants] of perFile) {
    const all = photoVariants.get(id) || new Map<string, Variant[]>();
    all.set(file, variants);
    photoVariants.set(id, all);
  }
}

// Decide constant names globally: photos with >2 width variants get a card +
// hero pair; others get a single constant named after their width.
const constantFor = new Map<string, string>(); // photoId+params -> constant name
const photoWidths = new Map<string, Set<number>>();
for (const [id, allFiles] of photoVariants) {
  const widths = new Set<number>();
  for (const variants of allFiles.values()) for (const v of variants) if (v.width) widths.add(v.width);
  photoWidths.set(id, widths);
}

function camelCase(id: string): string {
  const raw = id.replace('photo-', '');
  // Name by a stable slug: P + digits keeps it deterministic and readable.
  return 'P' + raw.replace(/[^a-zA-Z0-9]/g, '');
}

const generated: string[] = [];
for (const [id, allFiles] of photoVariants) {
  const widths = photoWidths.get(id)!;
  const base = camelCase(id);
  if (widths.size > 2 || widths.has(1200) || widths.has(1400) || widths.has(1600)) {
    // hero + card pair using the registry's normalized params.
    constantFor.set(id + '|hero', `IMG_${base}_HERO`);
    constantFor.set(id + '|card', `IMG_${base}_CARD`);
    generated.push(`export const IMG_${base}_HERO = \`https://images.unsplash.com/${id}?q=80&w=1600&auto=format&fit=crop\`;`);
    generated.push(`export const IMG_${base}_CARD = \`https://images.unsplash.com/${id}?q=80&w=800&auto=format&fit=crop\`;`);
  } else {
    const width = [...widths][0] ?? 800;
    constantFor.set(id + '|' + width, `IMG_${base}_${width}`);
    generated.push(`export const IMG_${base}_${width} = \`https://images.unsplash.com/${id}?q=80&w=${width}&auto=format&fit=crop\`;`);
  }
}

// Pass 2: rewrite files.
let touched = 0;
const neededImports = new Map<string, Set<string>>();

for (const [file, perFile] of variantsByFile) {
  let src = readFileSync(file, 'utf8');

  for (const [id, variants] of perFile) {
    const widths = photoWidths.get(id)!;
    const multi = widths.size > 2 || widths.has(1200) || widths.has(1400) || widths.has(1600);

    for (const v of variants) {
      const key = multi ? (v.width && v.width >= 1000 ? id + '|hero' : id + '|card') : id + '|' + (v.width ?? 800);
      const name = constantFor.get(key)!;
      const params = v.params || '';
      const full = `https://images.unsplash.com/${id}${params}`;
      src = src.split(full).join(name);
      const importPath = file.includes('/components/') || file.includes('/hooks/') || file.includes('/data/') || file.includes('/services/')
        ? PLACEHOLDER_MODULE
        : PLACEHOLDER_MODULE_DEEP;
      const set = neededImports.get(file) || new Set<string>();
      set.add(importPath);
      for (const n of [name]) set.add(`${importPath}::${n}`);
      neededImports.set(file, set);
    }
  }

  if (src !== readFileSync(file, 'utf8')) {
    writeFileSync(file, src);
    touched++;
    console.log(`  ${file}`);
  }
}

// Pass 3: add imports.
for (const [file, set] of neededImports) {
  const names = [...set].filter((s) => s.includes('::')).map((s) => s.split('::')[1]).sort();
  const importPath = [...set].find((s) => !s.includes('::'))!;
  let src = readFileSync(file, 'utf8');
  const importStmt = `import { ${names.join(', ')} } from '${importPath}';\n`;
  if (src.includes(`from '${importPath}'`)) continue; // manual fixup needed
  // Insert after the last top-of-file import line.
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    if (/^import[\s'{]/.test(lines[i])) lastImport = i;
  }
  lines.splice(lastImport + 1, 0, importStmt.trimEnd());
  writeFileSync(file, lines.join('\n'));
}

console.log(`\n${touched} file(s) rewritten; ${generated.length} constants needed.`);
if (generated.length) {
  console.log('\n// Append to src/shared/placeholderImagery.ts:\n');
  console.log(generated.join('\n'));
}
