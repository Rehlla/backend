/**
 * §5 i18n codemod — shared scanner (used by extract / apply / verify).
 *
 * Gates (the safe triple from the plan — never isRTL):
 *   1. condition  = /^(language|lang|locale|currentLanguage|siteLanguage)\s*===\s*['"]ar['"]$/
 *   2. branches   = StringLiteral | NoSubstitutionTemplateLiteral | TemplateExpression
 *   3. ar branch actually contains Arabic chars [\u0600-\u06FF]
 *
 * Mandatory exclusions: src/lib/firebase.ts · src/components/booking/BookingPaymentStep.tsx
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const SRC = path.join(ROOT, 'src');

export const EXCLUDE = new Set(['src/lib/firebase.ts', 'src/components/booking/BookingPaymentStep.tsx']);

export const CONDITION_RE = /^(?:language|lang|locale|currentLanguage|siteLanguage)\s*===\s*['"]ar['"]$/;
export const ARABIC_RE = /[\u0600-\u06FF]/;
export const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface ExprRec {
  name: string;
  text: string;
  isIdent: boolean;
}

export interface ScannedNode {
  file: string;
  line: number;
  start: number;
  end: number;
  en: string;
  ar: string;
  kind: 'mechanical' | 'vars';
  auto: boolean;
  enRecs: ExprRec[];
  arRecs: ExprRec[];
}

export interface TGlueInfo {
  hasUseLanguage: boolean;
  hasT: boolean;
  bindingStart: number | null;
  destructureEnd: number | null;
}

export interface FileScan {
  nodes: ScannedNode[];
  glue: TGlueInfo;
}

// namespace prefixes (fixed table — matches actual catalog usage)
const NAMESPACE_TABLE: Array<[RegExp, string]> = [
  [/^src\/components\/operations\/command-center\//, 'cmd.'],
  [/^src\/components\/operations\//, 'ops.'],
  [/^src\/components\/intelligence\//, 'intel.'],
  [/^src\/components\/tripos\//, 'tripos.'],
  [/^src\/components\/arrival\//, 'arrival.'],
  [/^src\/components\/spontaneous\//, 'spontaneous.'],
  [/^src\/components\/food\//, 'food.'],
  [/^src\/components\/navigation\//, 'nav.'],
  [/^src\/components\/booking\//, 'booking.'],
  [/^src\/components\/commerce\//, 'commerce.'],
  [/^src\/components\/bookings\//, 'bookings.'],
  [/^src\/components\/mytrip\//, 'myTrip.'],
  [/^src\/components\/hotels\//, 'hotels.'],
  [/^src\/components\/explore\//, 'explore.'],
  [/^src\/components\/home\//, 'home.'],
  [/^src\/components\/planner\//, 'planner.'],
  [/^src\/components\/departure\//, 'departure.'],
  [/^src\/components\/recovery\//, 'recovery.'],
  [/^src\/components\/attractions\//, 'attractions.'],
  [/^src\/components\/gallery\//, 'gallery.'],
  [/^src\/components\/live\//, 'live.'],
  [/^src\/components\/itinerary\//, 'itinerary.'],
  [/^src\/components\/programs\//, 'programs.'],
  [/^src\/components\/profile\//, 'profile.'],
  [/^src\/components\/supplier\//, 'supplier.'],
  [/^src\/components\/auth\//, 'auth.'],
  [/^src\/components\/posttrip\//, 'postTrip.'],
  [/^src\/components\/common\//, 'common.'],
  [/^src\/components\/help\//, 'help.'],
  [/^src\/components\/director\//, 'director.'],
  [/^src\/components\/daygi\//, 'daygi.'],
  [/^src\/components\/briefing\//, 'briefing.'],
  [/^src\/components\/experiences\//, 'experiences.'],
  [/^src\/App\.tsx$/, 'app.'],
  [/^src\//, ''],
];

export function namespaceFor(relFile: string): string {
  for (const [re, ns] of NAMESPACE_TABLE) {
    if (re.test(relFile)) return ns;
  }
  return '';
}

export function listSrcFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(SRC);
  return files;
}

function escaper(s: string): string {
  return s.replace(/[^A-Za-z0-9_]/g, '_');
}

function placeholderName(expr: ts.Expression): string {
  if (ts.isIdentifier(expr)) return escaper(expr.text);
  const text = expr.getText().trim();
  const lastSegment = text.split(/[.\]]/).pop() ?? text;
  return escaper(lastSegment.replace(/[^A-Za-z0-9_]/g, '_'));
}

function cookedTemplateText(tpl: ts.TemplateExpression, recs: ExprRec[]): { text: string; names: string[] } {
  const names: string[] = [];
  let out = tpl.head.text;
  for (const span of tpl.templateSpans) {
    const exprText = span.expression.getText();
    const name = placeholderName(span.expression);
    names.push(name);
    recs.push({ name, text: exprText, isIdent: ts.isIdentifier(span.expression) && exprText === name });
    out += `{${name}}`;
    out += span.literal.text;
  }
  return { text: out, names };
}

function branchText(node: ts.Expression, recs: ExprRec[]): { text: string; names: string[] } {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, names: [] };
  }
  if (ts.isTemplateExpression(node)) {
    return cookedTemplateText(node, recs);
  }
  return { text: node.getText(), names: [] };
}

function computeAuto(kind: 'mechanical' | 'vars', enRecs: ExprRec[], arRecs: ExprRec[]): boolean {
  if (kind === 'mechanical') return true;
  const enNames = enRecs.map((r) => r.name);
  const arNames = arRecs.map((r) => r.name);
  const hasDup = new Set(enNames).size !== enNames.length || new Set(arNames).size !== arNames.length;
  if (hasDup) return false;
  const allIdent = [...enRecs, ...arRecs].every((r) => r.isIdent);
  if (!allIdent) return false;
  return enNames.length === arNames.length && arNames.every((n) => enNames.includes(n));
}

export function scanFile(relFile: string, text: string): FileScan {
  const scriptKind = relFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(relFile, text, ts.ScriptTarget.Latest, true, scriptKind);

  const raw: ScannedNode[] = [];
  const glue: TGlueInfo = { hasUseLanguage: false, hasT: false, bindingStart: null, destructureEnd: null };

  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useLanguage') {
      glue.hasUseLanguage = true;
      if (ts.isVariableDeclaration(n.parent) && ts.isObjectBindingPattern(n.parent.name)) {
        const binding = n.parent.name;
        glue.bindingStart = binding.getStart(sf);
        glue.destructureEnd = binding.getEnd();
        glue.hasT = binding.elements.some((el) => {
          const key = el.propertyName ? el.propertyName.getText(sf) : el.name.getText(sf);
          if (key === 't' && el.propertyName) return false; // aliased (t: otherName) — not callable as t
          return key === 't';
        });
      }
    }
    if (ts.isConditionalExpression(n)) {
      const cond = n.condition.getText(sf).trim();
      if (!CONDITION_RE.test(cond)) {
        ts.forEachChild(n, visit);
        return;
      }
      const arRecs: ExprRec[] = [];
      const enRecs: ExprRec[] = [];
      const arCooked = branchText(n.whenTrue, arRecs);
      const enCooked = branchText(n.whenFalse, enRecs);
      if (!ARABIC_RE.test(arCooked.text)) {
        ts.forEachChild(n, visit);
        return;
      }
      const kind = ts.isTemplateExpression(n.whenTrue) || ts.isTemplateExpression(n.whenFalse) ? 'vars' : 'mechanical';
      raw.push({
        file: relFile,
        line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        start: n.getStart(sf),
        end: n.getEnd(),
        en: enCooked.text,
        ar: arCooked.text,
        kind,
        auto: computeAuto(kind, enRecs, arRecs),
        enRecs,
        arRecs,
      });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  // containment: drop nodes nested inside another matched node (outer edit covers them)
  const sorted = [...raw].sort((a, b) => a.start - b.start);
  const kept: ScannedNode[] = [];
  for (const node of sorted) {
    const inside = kept.some((k) => node.start >= k.start && node.end <= k.end);
    if (!inside) kept.push(node);
  }
  return { nodes: kept.sort((a, b) => a.start - b.start), glue };
}

let cache: { nodes: ScannedNode[]; glueByFile: Map<string, TGlueInfo> } | null = null;

export function scanSrc(): { nodes: ScannedNode[]; glueByFile: Map<string, TGlueInfo> } {
  if (cache) return cache;
  const nodes: ScannedNode[] = [];
  const glueByFile = new Map<string, TGlueInfo>();
  for (const file of listSrcFiles()) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (EXCLUDE.has(rel)) continue;
    const { nodes: fileNodes, glue } = scanFile(rel, fs.readFileSync(file, 'utf8'));
    glueByFile.set(rel, glue);
    nodes.push(...fileNodes);
  }
  cache = { nodes, glueByFile };
  return cache;
}

export function liveCatalogKeys(): Set<string> {
  const file = path.join(SRC, 'i18n/translations.ts');
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys = new Set<string>();
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'TRANSLATIONS' &&
      ts.isObjectLiteralExpression(n.initializer)
    ) {
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
          keys.add(p.name.text);
        }
      }
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return keys;
}