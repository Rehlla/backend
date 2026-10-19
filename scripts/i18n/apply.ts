/**
 * §5 i18n codemod — APPLY pass.
 *
 * Consumes an approved manifest (from extract.ts), converts every auto node in
 * the requested batch to t('key'[, { vars }]), glues `t` into useLanguage()
 * destructuring when missing, and appends new catalog entries under a generated
 * banner (never hand-built literals — values escaped via JSON.stringify).
 *
 * Safety:
 *   - every replacement is validated against the node's cooked en/ar first
 *   - byte-preserving offset splice (only the conditional's text changes)
 *   - files without useLanguage() are skipped loudly and recorded
 *   - keys that already exist are reused ONLY if text-identical, else conflict-skip
 *
 * Usage:
 *   tsx scripts/i18n/apply.ts --manifest <path> --batch tripos,navigation \
 *       --applied <out.json> [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';
import {
  ROOT,
  scanFile,
  listSrcFiles,
  namespaceFor,
  TGlueInfo,
  ExprRec,
} from './scan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (name: string): boolean => process.argv.includes(`--${name}`);

const manifestPath = arg('manifest');
const batchArg = arg('batch') ?? 'all';
const appliedPath = arg('applied');
const dryRun = has('dry-run');

if (!manifestPath || !appliedPath) {
  console.error('usage: apply.ts --manifest <json> --batch <names> --applied <out.json> [--dry-run]');
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  nodes: ManifestNode[];
};
interface ManifestNode {
  file: string;
  line: number;
  start: number;
  end: number;
  en: string;
  ar: string;
  kind: 'mechanical' | 'vars';
  auto: boolean;
}

const BATCH_DIRS: Record<string, string> = {
  tripos: 'src/components/tripos/',
  navigation: 'src/components/navigation/',
  common: 'src/components/common/',
  arrival: 'src/components/arrival/',
  spontaneous: 'src/components/spontaneous/',
  food: 'src/components/food/',
  operations: 'src/components/operations/',
  intelligence: 'src/components/intelligence/',
  booking: 'src/components/booking/',
  commerce: 'src/components/commerce/',
  bookings: 'src/components/bookings/',
  mytrip: 'src/components/mytrip/',
  hotels: 'src/components/hotels/',
  explore: 'src/components/explore/',
  home: 'src/components/home/',
  planner: 'src/components/planner/',
  departure: 'src/components/departure/',
  recovery: 'src/components/recovery/',
  attractions: 'src/components/attractions/',
  gallery: 'src/components/gallery/',
  live: 'src/components/live/',
  itinerary: 'src/components/itinerary/',
  programs: 'src/components/programs/',
  profile: 'src/components/profile/',
  supplier: 'src/components/supplier/',
  posttrip: 'src/components/posttrip/',
  help: 'src/components/help/',
  daygi: 'src/components/daygi/',
  briefing: 'src/components/briefing/',
  experiences: 'src/components/experiences/',
  app: 'src/App.tsx',
};

const batchNames = batchArg.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
const prefixes = batchNames.map((n) =>
  n.startsWith('src/') ? n : BATCH_DIRS[n] ?? `src/components/${n}/`
);

const inBatch = (file: string): boolean =>
  prefixes.some((p) => (p.endsWith('.tsx') ? file === p : file.startsWith(p)));

// ---------------------------------------------------------------------------
// Key naming
// ---------------------------------------------------------------------------
function slugFromEn(en: string): string {
  const words = en
    .replace(/\{[^}]+\}/g, '')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
    .slice(0, 4);
  let out = '';
  for (const [i, w] of words.entries()) {
    const clean = w.replace(/[^A-Za-z0-9]/g, '');
    if (!clean) continue;
    out += i === 0 ? clean.charAt(0).toLowerCase() + clean.slice(1) : clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return out.slice(0, 40);
}

// existing catalog
const translationsPath = path.join(ROOT, 'src/i18n/translations.ts');
const translationsText = fs.readFileSync(translationsPath, 'utf8');
const translationsSf = ts.createSourceFile(translationsPath, translationsText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const existing = new Map<string, { en: string; ar: string }>();
const visitCatalog = (n: ts.Node) => {
  if (
    ts.isVariableDeclaration(n) &&
    ts.isIdentifier(n.name) &&
    n.name.text === 'TRANSLATIONS' &&
    ts.isObjectLiteralExpression(n.initializer)
  ) {
    for (const p of n.initializer.properties) {
      if (ts.isPropertyAssignment(p) && ts.isObjectLiteralExpression(p.initializer)) {
        const key = p.name as ts.Identifier | ts.StringLiteral;
        const en = p.initializer.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(translationsSf) === 'en');
        const ar = p.initializer.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(translationsSf) === 'ar');
        if (en && ts.isPropertyAssignment(en) && ts.isStringLiteral(en.initializer) && ar && ts.isPropertyAssignment(ar) && ts.isStringLiteral(ar.initializer)) {
          existing.set((key as ts.StringLiteral).text ?? key.text, { en: (en.initializer as ts.StringLiteral).text, ar: (ar.initializer as ts.StringLiteral).text });
        }
      }
    }
  }
  ts.forEachChild(n, visitCatalog);
};
visitCatalog(translationsSf);
let catalogEnd = -1;
const findCatalogEnd = (n: ts.Node) => {
  if (
    ts.isVariableDeclaration(n) &&
    ts.isIdentifier(n.name) &&
    n.name.text === 'TRANSLATIONS' &&
    ts.isObjectLiteralExpression(n.initializer)
  ) {
    catalogEnd = n.initializer.end;
  }
  ts.forEachChild(n, findCatalogEnd);
};
findCatalogEnd(translationsSf);
if (catalogEnd < 0) throw new Error('TRANSLATIONS object not found');

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------
const textMap = new Map<string, string>(); // {en}\u0000{ar} -> key
const slugSeen = new Map<string, number>();

function computeKey(ns: string, en: string, ar: string): string {
  const fp = `${en}\u0000${ar}`;
  const hit = textMap.get(fp);
  if (hit) return hit;
  const base = `${ns}${slugFromEn(en) || '_item_'}`;
  const n = slugSeen.get(base);
  const final = n === undefined ? base : `${base}-${n + 1}`;
  slugSeen.set(base, (n ?? 0) + 1);
  slugSeen.set(final, 1);
  textMap.set(fp, final);
  return final;
}

function buildCall(key: string, recs: ExprRec[]): string {
  if (recs.length === 0) return `t('${key}')`;
  const varsStr = recs.map((r) => (r.isIdent ? r.name : `${r.name}: ${r.text}`)).join(', ');
  return `t('${key}', { ${varsStr} })`;
}

// manifest approved set
const approved = new Map<string, ManifestNode>();
for (const n of manifest.nodes) approved.set(`${n.file}:${n.start}:${n.end}`, n);

const applied: Array<{ file: string; start: number; end: number; line: number; key: string; kind: string; en: string; ar: string }> = [];
const newCatalogEntries: Array<{ ns: string; key: string; en: string; ar: string }> = [];
const conflicts: Record<string, string[]> = {};
const skipped: Record<string, string[]> = {};
const reused: Array<{ file: string; key: string }> = [];

const files = listSrcFiles();

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (!inBatch(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const { nodes, glue } = scanFile(rel, text);

  const targetNodes = nodes.filter((n) => {
    const m = approved.get(`${n.file}:${n.start}:${n.end}`);
    return m && (m.kind === 'mechanical' || m.auto);
  });
  if (targetNodes.length === 0) continue;

  if (!glue.hasUseLanguage) {
    (skipped.noUseLanguage ??= []).push(`${rel} (${targetNodes.length} nodes)`);
    continue;
  }

  // A converted file needs `t` in EVERY scope that will call it. Files often
  // declare one scoped useLanguage() destructure per nested component, so patch
  // all of them (safe: no noUnusedLocals), not just the first scan records.
  let gluePatches: Array<{ start: number; end: number; replacement: string }> = [];
  const needGlue = !glue.hasT;
  if (needGlue) {
    const useLangRe = /\{\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\s*:\s*[a-zA-Z_][a-zA-Z0-9_]*)?(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\s*:\s*[a-zA-Z_][a-zA-Z0-9_]*)?)*\s*\}\s*=\s*useLanguage\(\)/g;
    let found = 0;
    for (const m of text.matchAll(useLangRe)) {
      const inner = m[0].slice(m[0].indexOf('{') + 1, m[0].indexOf('}'));
      if (/(^|,)\s*t\s*($|,)/.test(inner)) continue; // already destructures t
      const at = m.index + m[0].indexOf('}');
      gluePatches.push({ start: at, end: at, replacement: ', t' });
      found++;
    }
    if (found === 0) {
      (skipped.noTScope ??= []).push(`${rel} (${targetNodes.length} nodes, no patchable useLanguage binding)`);
      continue;
    }
  }

  const edits: Array<{ start: number; end: number; replacement: string }> = [];
  const fileApplied: typeof applied = [];

  for (const node of targetNodes) {
    const ns = namespaceFor(node.file);
    const key = computeKey(ns, node.en, node.ar);
    const existingEntry = existing.get(key);
    if (existingEntry) {
      if (existingEntry.en === node.en && existingEntry.ar === node.ar) {
        reused.push({ file: node.file, key });
      } else {
        (conflicts[key] ??= []).push(`${node.file}:${node.line} (en/ar differ from existing '${key}')`);
        continue;
      }
    } else {
      newCatalogEntries.push({ ns, key, en: node.en, ar: node.ar });
      existing.set(key, { en: node.en, ar: node.ar });
    }
    const replacement = buildCall(key, node.enRecs.length ? node.enRecs : node.arRecs);
    edits.push({ start: node.start, end: node.end, replacement });
    fileApplied.push({ file: node.file, start: node.start, end: node.end, line: node.line, key, kind: node.kind, en: node.en, ar: node.ar });
  }

  if (edits.length === 0) continue;
  if (needGlue) edits.push(...gluePatches);

  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }
  if (!dryRun) fs.writeFileSync(file, out);
  applied.push(...fileApplied);
}

// ---------------------------------------------------------------------------
// Catalog append
// ---------------------------------------------------------------------------
if (newCatalogEntries.length > 0) {
  const byNs = new Map<string, typeof newCatalogEntries>();
  for (const e of newCatalogEntries) {
    const arr = byNs.get(e.ns) ?? [];
    arr.push(e);
    byNs.set(e.ns, arr);
  }
  const banner = `\n  // =========================================================================\n  // §5 i18n codemod — ${batchNames.join(', ')} — GENERATED\n  // =========================================================================`;
  const lines: string[] = [];
  for (const [ns, entries] of byNs) {
    lines.push(`  // ${ns || '(root)'}`);
    for (const e of entries) {
      lines.push(`  ${JSON.stringify(e.key)}: { en: ${JSON.stringify(e.en)}, ar: ${JSON.stringify(e.ar)} },`);
    }
  }
  lines.push('');
  const snippet = `${banner}\n${lines.join('\n')}`;
  const insertPos = catalogEnd - 1;
  if (!dryRun) {
    const updated = translationsText.slice(0, insertPos) + snippet + translationsText.slice(insertPos);
    fs.writeFileSync(translationsPath, updated);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (appliedPath) {
  fs.mkdirSync(path.dirname(appliedPath), { recursive: true });
  fs.writeFileSync(
    appliedPath,
    JSON.stringify(
      { batch: batchNames, applied, reused: reused.map((r) => `${r.file} → ${r.key}`), skipped, conflicts, newKeys: newCatalogEntries.map((e) => e.key) },
      null,
      2
    )
  );
}

console.log(`batch              ${batchNames.join(', ')}`);
console.log(`nodes converted    ${applied.length}${dryRun ? ' (dry run — nothing written)' : ''}`);
console.log(`new catalog keys   ${newCatalogEntries.length}`);
console.log(`reused keys        ${reused.length}`);
console.log(`conflicts          ${Object.keys(conflicts).length} (skipped:`);
for (const [k, v] of Object.entries(conflicts)) console.log(`  ${k}: ${v.join('; ')}`);
console.log(`skipped files      ${Object.values(skipped).flat().length}`);
for (const [reason, files] of Object.entries(skipped)) console.log(`  ${reason}: ${files.slice(0, 20).join('; ')}${files.length > 20 ? ` (+${files.length - 20})` : ''}`);