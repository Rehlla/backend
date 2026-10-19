/**
 * §7b(i) — server-side route inventory via the real TS compiler API.
 *
 * Counts every Express route registered with a StringLiteral first argument:
 *   · inline `app.<method>('/api/…', …)` calls in server.ts
 *   · router files mounted via `app.use('/api/…', routerIdent)` — the ident is
 *     resolved through server.ts imports to its file, that file is parsed, and
 *     every `<router>.<method>('/…')` is prefixed with the mount path.
 *
 * Middleware mounts (rate limiters, apiAccessPolicy, error handlers) are
 * skipped because they do not declare a `const X = Router()` with the same name.
 *
 * `:param` segments are normalised to `*` so client paths with `*` compare
 * across the contract. Query strings are not part of Express route paths.
 */
import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverTs = path.join(repoRoot, 'server.ts');

export interface ServerRoute {
  method: string;
  path: string;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all']);

function normPath(p: string): string {
  return p
    .split('?')[0]
    .replace(/\/:([A-Za-z0-9_]+)/g, '/*');
}

function firstArgString(node: ts.CallExpression): string | null {
  const arg = node.arguments[0];
  if (!arg) return null;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  return null;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Resolve an import specifier to an absolute file path using the real tsconfig. */
function resolveImport(specifier: string, fromFile: string, options: ts.CompilerOptions): string | null {
  const resolved = ts.resolveModuleName(specifier, fromFile, options, {
    fileExists: (f) => fs.existsSync(f),
    readFile: (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined),
    getCurrentDirectory: () => repoRoot,
  }).resolvedModule;
  return resolved && !resolved.resolvedFileName.includes(`${path.sep}node_modules${path.sep}`)
    ? path.normalize(resolved.resolvedFileName)
    : null;
}

function routerVarNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const st of source.statements) {
    if (ts.isVariableStatement(st)) {
      for (const decl of st.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const init = decl.initializer;
        if (init && ts.isCallExpression(init) && ts.isIdentifier(init.expression) && init.expression.text === 'Router') {
          names.add(decl.name.text);
        }
      }
    }
  }
  return names;
}

export function collectServerRoutes(): ServerRoute[] {
  const configFile = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tsconfig.json'), 'utf8'));
  const compilerOptions: ts.CompilerOptions = {
    ...(configFile.compilerOptions ?? {}),
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };

  const routes = new Map<string, ServerRoute>();
  const add = (method: string, p: string) => {
    const normalised = normPath(p.trim());
    if (!normalised.startsWith('/api')) return;
    routes.set(`${method.toUpperCase()} ${normalised}`, { method: method.toUpperCase(), path: normalised });
  };

  // 1. server.ts imports: ident → resolved router file (if it is a Router()).
  const serverSource = parse(serverTs);
  const importMap = new Map<string, string>();
  for (const st of serverSource.statements) {
    if (!ts.isImportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteralLike(st.moduleSpecifier)) continue;
    const resolved = resolveImport(st.moduleSpecifier.text, serverTs, compilerOptions);
    if (!resolved) continue;
    for (const clause of st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)
      ? st.importClause.namedBindings.elements
      : []) {
      const local = clause.name.text;
      const original = clause.propertyName ? clause.propertyName.text : local;
      if (routerVarNames(parse(resolved)).has(original)) importMap.set(local, resolved);
    }
  }

  // 2. Mounts: app.use('/api/…', RouterIdent)
  const mounts: Array<{ prefix: string; file: string; varName: string }> = [];
  const visitServer = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'app' && callee.name.text === 'use') {
        const prefix = firstArgString(node);
        const second = node.arguments[1];
        if (prefix && prefix.startsWith('/api') && second && ts.isIdentifier(second) && importMap.has(second.text)) {
          mounts.push({ prefix, file: importMap.get(second.text)!, varName: second.text });
        }
      }
    }
    ts.forEachChild(node, visitServer);
  };
  visitServer(serverSource);

  // 3. Inline app.<method> routes.
  const visitInline = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'app' && HTTP_METHODS.has(callee.name.text)) {
        const p = firstArgString(node);
        if (p) add(callee.name.text, p);
      }
    }
    ts.forEachChild(node, visitInline);
  };
  visitInline(serverSource);

  // 4. Router files: <router>.<method>('/…') under their mount prefix.
  for (const mount of mounts) {
    const routerSource = parse(mount.file);
    const visitRouter = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === mount.varName && HTTP_METHODS.has(callee.name.text)) {
          const p = firstArgString(node);
          if (p) add(callee.name.text, (mount.prefix + p));
        }
      }
      ts.forEachChild(node, visitRouter);
    };
    visitRouter(routerSource);
  }

  return [...routes.values()].sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}