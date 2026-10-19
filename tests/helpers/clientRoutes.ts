/**
 * §7b(i) — client-side route inventory.
 *
 * Two sources, both counted in the client↔server contract:
 *
 *   · `src/services/api.ts` — every `fetchWithTimeout('/api/…')` / `fetch('/api/…')`
 *     whose first argument is a StringLiteral or a template literal. Each
 *     `${…}` segment becomes `*` (server `:param` → `*` on the other side), and
 *     the HTTP method comes from an inline `{ method: 'POST' }` option literal
 *     (default GET). Query strings are stripped — Express route paths have none.
 *
 *   · the two CMS screens with a local `cmsFetch(path)` helper — those routes
 *     are NOT visible to a scan of api.ts, so they are counted explicitly here
 *     under their `/api/admin/content` base.
 *
 * Also exported: `collectOutOfBandFetches()` — every `fetch`/`fetchWithTimeout`
 * call outside `src/services/` whose first argument statically starts with
 * `/api`. After the §7b(i) migration the ONLY remaining ones are the two
 * documented `cmsFetch` helpers, and the contract test fails if any raw caller
 * appears. This is the "يلاقيهم أو يمنع الجداد" tripwire.
 */
import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const servicesDir = path.join(repoRoot, 'src', 'services');
const cmsBase = '/api/admin/content';
const cmsHelperFiles = [
  path.join(repoRoot, 'src', 'components', 'operations', 'command-center', 'CmsPageEditor.tsx'),
  path.join(repoRoot, 'src', 'components', 'operations', 'command-center', 'CmsContentDashboard.tsx'),
];

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export interface ClientRoute {
  method: string;
  path: string;
  source: 'services' | 'cms-helper';
}

export interface OutOfBandCall {
  file: string;
  line: number;
  text: string;
  kind: 'fetch' | 'fetchWithTimeout' | 'cmsFetch';
}

/** Build a path from a StringLiteral or a TemplateExpression, `${…}` → `*`. */
function argToPath(arg: ts.Expression): string | null {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  if (ts.isTemplateExpression(arg)) {
    let out = arg.head.text;
    for (const span of arg.templateSpans) {
      // `*` must be its own path segment — the contract matcher only treats a
      // standalone `*` as wildcard. Template heads like `/api/hotels${qs…}`
      // would otherwise glue into `/api/hotels*`, which can never match the
      // server's `/api/hotels` (query-style templates consume zero or one
      // server segment, so a trailing `/*` is exactly right).
      if (!out.endsWith('/')) out += '/';
      out += '*' + span.literal.text;
    }
    return out;
  }
  return null;
}

/** Name of the nearest enclosing function, used to recognise cmsFetch helper bodies. */
function enclosingFunctionName(node: ts.Node): string | null {
  let cur = node.parent;
  while (cur) {
    const name = (cur as { name?: ts.Identifier }).name;
    if ((ts.isFunctionDeclaration(cur) || ts.isFunctionExpression(cur) || ts.isArrowFunction(cur)) && name && ts.isIdentifier(name)) {
      return name.text;
    }
    cur = cur.parent;
  }
  return null;
}

function normalizeClientPath(p: string): string {
  return p.split('?')[0];
}

function methodOf(node: ts.CallExpression): string {
  const opts = node.arguments[1];
  if (opts && ts.isObjectLiteralExpression(opts)) {
    for (const prop of opts.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'method') {
        const v = prop.initializer;
        if (ts.isStringLiteral(v) && HTTP_METHODS.has(v.text.toLowerCase())) return v.text.toUpperCase();
      }
    }
  }
  return 'GET';
}

function* walk(node: ts.Node): Generator<ts.CallExpression> {
  if (ts.isCallExpression(node)) yield node;
  for (const child of node.getChildren()) yield* walk(child);
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function collectCall(
  file: string,
  calleeName: string,
  prefixBase: string | null
): { routes: ClientRoute[]; calls: OutOfBandCall[] } {
  const routes: ClientRoute[] = [];
  const calls: OutOfBandCall[] = [];
  const source = parse(file);
  for (const node of walk(source)) {
    if (!ts.isIdentifier(node.expression)) continue;
    const callee = node.expression.text;
    if (callee !== calleeName && callee !== 'fetch' && callee !== 'fetchWithTimeout') continue;
    const raw = argToPath(node.arguments[0]);
    if (raw == null) continue;
    const normalized = normalizeClientPath(prefixBase ? prefixBase + raw : raw);
    if (!normalized.startsWith('/api')) continue;

    const isHelper = callee === 'cmsFetch' || prefixBase != null;
    // The two CMS screens wrap `fetch` in a `cmsFetch` helper; calls inside that
    // helper body are part of the documented carve-out, not raw out-of-band calls.
    const kind =
      callee === 'cmsFetch' || (callee === 'fetch' && enclosingFunctionName(node) === 'cmsFetch')
        ? 'cmsFetch'
        : callee === 'fetch'
          ? 'fetch'
          : 'fetchWithTimeout';
    calls.push({
      file: path.relative(repoRoot, file),
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      text: `${callee}(${JSON.stringify(raw)})`.slice(0, 120),
      kind,
    });
    if (isHelper && callee === 'cmsFetch') routes.push({ method: methodOf(node), path: normalized, source: 'cms-helper' });
  }
  return { routes, calls };
}

export function collectClientRoutes(): ClientRoute[] {
  const routes: ClientRoute[] = [];

  const apiFile = path.join(servicesDir, 'api.ts');
  const source = parse(apiFile);
  for (const node of walk(source)) {
    if (!ts.isIdentifier(node.expression)) continue;
    if (node.expression.text !== 'fetchWithTimeout' && node.expression.text !== 'fetch') continue;
    const raw = argToPath(node.arguments[0]);
    if (raw == null) continue;
    const normalized = normalizeClientPath(raw);
    if (!normalized.startsWith('/api')) continue;
    routes.push({ method: methodOf(node), path: normalized, source: 'services' });
  }

  for (const file of cmsHelperFiles) {
    const { routes: cmsRoutes } = collectCall(file, 'cmsFetch', cmsBase);
    routes.push(...cmsRoutes);
  }

  return routes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

export function collectOutOfBandFetches(): OutOfBandCall[] {
  const results: OutOfBandCall[] = [];
  for (const file of cmsHelperFiles) {
    results.push(...collectCall(file, 'cmsFetch', cmsBase).calls);
  }

  const srcDir = path.join(repoRoot, 'src');
  const queue = [srcDir];
  while (queue.length) {
    const dir = queue.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'services' && entry.name !== 'node_modules') queue.push(full);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const { calls } = collectCall(full, '', null);
        results.push(...calls);
      }
    }
  }

  const seen = new Set<string>();
  return results.filter((c) => {
    const key = `${c.file}:${c.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}