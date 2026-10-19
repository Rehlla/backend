/**
 * §5 i18n codemod — VERIFY pass.
 *
 * Proves, for every node the apply pass replaced, that the LIVE catalog entry
 * resolves to exactly the snapshot text for BOTH languages, and that nothing
 * else in the batch scope drifted.
 *
 * The empty-vars trick: translate(key, language, {}) leaves every {placeholder}
 * token intact (interpolate only substitutes present keys), so the resolved
 * string equals the catalog's cooked template — the same form the manifest
 * snapshot captured.
 *
 * Usage:
 *   tsx scripts/i18n/verify.ts --manifest <json> --applied <json> [--batch tripos,navigation]
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { ROOT, scanSrc } from './scan.js';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const manifestPath = arg('manifest');
const appliedPath = arg('applied');

if (!manifestPath || !appliedPath) {
  console.error('usage: verify.ts --manifest <json> --applied <json> [--batch names]');
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { nodes: any[] };
const appliedDoc = JSON.parse(fs.readFileSync(appliedPath, 'utf8')) as {
  batch: string[];
  applied: Array<{ file: string; start: number; end: number; line: number; key: string; kind: string }>;
};

const { translate } = await import(pathToFileURL(path.join(ROOT, 'src/i18n/translations.ts')).href);

const byPos = new Map<string, (typeof manifest.nodes)[number]>();
for (const n of manifest.nodes) byPos.set(`${n.file}:${n.start}:${n.end}`, n);
const byText = new Map<string, (typeof manifest.nodes)[number]>();
for (const n of manifest.nodes) {
  const key = `${n.file}\u0000${n.en}\u0000${n.ar}`;
  if (!byText.has(key)) byText.set(key, n);
}

const failures: string[] = [];

for (const a of appliedDoc.applied) {
  // Prefer byte-position identity (exact). Fall back to file+text identity so a
  // historical applied record can still be verified after the manifest was
  // regenerated post-batch (positions shift as files shrink).
  const mn = byPos.get(`${a.file}:${a.start}:${a.end}`)
    ?? (a.en !== undefined ? byText.get(`${a.file}\u0000${a.en}\u0000${a.ar}`) : undefined);
  if (!mn) {
    failures.push(`applied node missing from manifest: ${a.file}:${a.line}`);
    continue;
  }
  const en = translate(a.key, 'en', {});
  const ar = translate(a.key, 'ar', {});
  if (en !== mn.en) failures.push(`[en] '${a.key}' at ${a.file}:${a.line}\n    catalog: ${JSON.stringify(en)}\n    snapshot: ${JSON.stringify(mn.en)}`);
  if (ar !== mn.ar) failures.push(`[ar] '${a.key}' at ${a.file}:${a.line}\n    catalog: ${JSON.stringify(ar)}\n    snapshot: ${JSON.stringify(mn.ar)}`);
}

// ---------------------------------------------------------------------------
// Drift checks over the current source
// ---------------------------------------------------------------------------
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
const batchArg = arg('batch');
const prefixes = batchArg
  ? batchArg.split(',').map((s) => s.trim()).map((n) => (n.startsWith('src/') ? n : BATCH_DIRS[n] ?? `src/components/${n}/`))
  : [];
const inBatch = (file: string): boolean => prefixes.length === 0 || prefixes.some((p) => (p.endsWith('.tsx') ? file === p : file.startsWith(p)));

const live = scanSrc();
const appliedSet = new Set(appliedDoc.applied.map((a) => `${a.file}:${a.start}:${a.end}`));

for (const a of appliedDoc.applied) {
  if (live.nodes.some((n) => n.file === a.file && n.start === a.start && n.end === a.end)) {
    failures.push(`node still present after apply: ${a.file}:${a.line}`);
  }
}

// non-applied nodes in batch scope must still exist with identical text
const liveText = new Map<string, Set<string>>();
for (const n of live.nodes) {
  const set = liveText.get(n.file) ?? new Set();
  set.add(`${n.en}|||${n.ar}`);
  liveText.set(n.file, set);
}
for (const mn of manifest.nodes) {
  if (!inBatch(mn.file)) continue;
  if (appliedSet.has(`${mn.file}:${mn.start}:${mn.end}`)) continue;
  const present = liveText.get(mn.file)?.has(`${mn.en}|||${mn.ar}`);
  if (!present) failures.push(`untouched node drifted (expected to remain literal): ${mn.file}:${mn.line} ${JSON.stringify(mn.en)}`);
}

// ---------------------------------------------------------------------------
console.log(`verified ${appliedDoc.applied.length} converted nodes / ${manifest.nodes.length} manifest total`);
if (failures.length) {
  for (const f of failures.slice(0, 30)) console.error(f);
  if (failures.length > 30) console.error(`... ${failures.length - 30} more`);
  console.error(`VERIFY FAILED — ${failures.length} problem(s)`);
  process.exit(1);
}
console.log('VERIFY OK');