/**
 * §5 i18n codemod — EXTRACT pass (read-only).
 * Writes a manifest JSON for human review. Never writes to source.
 *
 * Usage:
 *   tsx scripts/i18n/extract.ts --snapshot              # full scan, print lines
 *   tsx scripts/i18n/extract.ts --out <path>.json       # write manifest artifact
 */
import fs from 'fs';
import path from 'path';
import { EXCLUDE, scanSrc, ROOT, SRC } from './scan.js';

const isSnapshot = process.argv.includes('--snapshot');
const outIdx = process.argv.indexOf('--out');
const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : null;

const { nodes, glueByFile } = scanSrc();

const mechanical = nodes.filter((n) => n.kind === 'mechanical');
const vars = nodes.filter((n) => n.kind === 'vars');
const varsAuto = vars.filter((n) => n.auto);
const varsManual = vars.filter((n) => !n.auto);

const filesWithoutUseLanguage = [...glueByFile.entries()]
  .filter(([, g]) => !g.hasUseLanguage)
  .filter(([rel]) => !EXCLUDE.has(rel));

const useLangWithoutT = [...glueByFile.entries()]
  .filter(([, g]) => g.hasUseLanguage && !g.hasT)
  .map(([rel]) => rel);

console.log(`files scanned    ${glueByFile.size}`);
console.log(`files w/ matches ${new Set(nodes.map((n) => n.file)).size}`);
console.log(`total nodes      ${nodes.length}`);
console.log(`  mechanical     ${mechanical.length}`);
console.log(`  vars           ${vars.length}  (auto ${varsAuto.length} / manual ${varsManual.length})`);
console.log(`files w/o useLanguage()  ${filesWithoutUseLanguage.length}`);
console.log(`files w/ useLanguage but NO t  ${useLangWithoutT.length}`);

if (outPath) {
  const artifact = {
    generatedAt: new Date().toISOString(),
    mode: isSnapshot ? 'snapshot' : 'manifest',
    exclusions: [...EXCLUDE],
    nodes,
    useLangWithoutT,
    filesWithoutUseLanguage: filesWithoutUseLanguage.map(([r]) => r),
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`manifest written  ${outPath}`);
} else if (isSnapshot) {
  for (const n of nodes) {
    console.log(`${n.file}:${n.line}  [${n.kind}${n.auto ? '+auto' : ''}]`);
  }
}
