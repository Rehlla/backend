/**
 * Find unreachable modules using the real TypeScript resolution (tsconfig
 * paths, @/* alias) — not a hand-rolled resolver. Runs with `tsx`.
 *
 * Roots are harvested mechanically:
 *   src/main.tsx · server.ts · vite/vitest configs · every tests test script ·
 *   tests/setup.ts · server/test/run*.ts · the db scripts referenced by
 *   package.json · every *.d.ts.
 */
import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rootModules = process.argv.filter((a) => a.startsWith('ROOT=')).map((a) => a.slice(5));

function listFiles(dir: string, re: RegExp): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.data') continue;
      out.push(...listFiles(full, re));
    } else if (re.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const testFiles = listFiles(path.join(repoRoot, 'tests'), /\.test\.ts$/);
const setupFiles = [path.join(repoRoot, 'tests', 'setup.ts')];
const runScripts = listFiles(path.join(repoRoot, 'server', 'test'), /^run.*\.ts$/);
// All server/db files are entry points (package.json db:* scripts + research)
const dbFiles = listFiles(path.join(repoRoot, 'server', 'db'), /\.ts$/).filter(
  (f) => !f.endsWith('.d.ts')
);

const standardRoots = [
  'src/main.tsx',
  'server.ts',
  'vite.config.ts',
  'vitest.config.ts',
  'vitest.ui.config.ts',
].map((p) => path.join(repoRoot, p));

const allRoots = [...standardRoots, ...testFiles, ...setupFiles, ...runScripts, ...dbFiles, ...rootModules].filter((f) => fs.existsSync(f));

// Read compilerOptions via TypeScript's config parser so that composite
// tsconfigs, comments, and the @/* -> ["./*", "./src/*"] alias are honoured.
// Fallback to JSON parse if the TS API is unavailable (tsx environment).
let compilerOptions: ts.CompilerOptions;
const parsed = ts.readConfigFile(path.join(repoRoot, 'tsconfig.json'), (f) => fs.readFileSync(f, 'utf8'));
if (!parsed.error && parsed.config) {
  const converted = ts.parseJsonConfigFileContent(parsed.config, ts.sys, repoRoot);
  compilerOptions = converted.options;
} else {
  const configFile = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tsconfig.json'), 'utf8'));
  compilerOptions = {
    ...(configFile.compilerOptions ?? {}),
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
}

const host: ts.ModuleResolutionHost = {
  fileExists: (f) => fs.existsSync(f),
  readFile: (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined),
  getCurrentDirectory: () => repoRoot,
};

const reachable = new Set<string>();
const queue: string[] = [];
for (const r of allRoots) {
  if (!reachable.has(r)) queue.push(r);
}

function canonical(p: string): string {
  return path.normalize(p);
}

function addTargets(fromFile: string, moduleNames: string[]): void {
  for (const name of moduleNames) {
    if (name.startsWith('.') === false && name.startsWith('@/') === false) {
      // Package import — the entry is live regardless of the package internals.
      const resolved = ts.resolveModuleName(name, fromFile, compilerOptions, host).resolvedModule;
      if (resolved && !resolved.resolvedFileName.includes(`${path.sep}node_modules${path.sep}`)) {
        const f = canonical(resolved.resolvedFileName);
        if (fs.existsSync(f) && !reachable.has(f)) queue.push(f);
      }
      continue;
    }
    const resolved = ts.resolveModuleName(name, fromFile, compilerOptions, host).resolvedModule;
    if (!resolved) continue;
    const f = canonical(resolved.resolvedFileName);
    if (f.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (fs.existsSync(f) && !reachable.has(f)) queue.push(f);
  }
}

while (queue.length > 0) {
  const file = queue.pop()!;
  const norm = canonical(file);
  if (reachable.has(norm)) continue;
  reachable.add(norm);
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const mod = node.moduleSpecifier;
      if (mod && ts.isStringLiteralLike(mod)) imports.push(mod.text);
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (node.moduleReference && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression) {
        const e = node.moduleReference.expression;
        if (ts.isStringLiteralLike(e)) imports.push(e.text);
      }
    } else if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if ((ts.isIdentifier(expr) && expr.text === 'require') || (expr.kind === ts.SyntaxKind.ImportKeyword)) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) imports.push(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  addTargets(file, imports);
}

const roots = new Set(allRoots.map(canonical));
const candidatesCandidates = [
  ...listFiles(path.join(repoRoot, 'src'), /\.(ts|tsx)$/),
  ...listFiles(path.join(repoRoot, 'server'), /\.(ts|tsx)$/),
].filter((f) => !f.endsWith('.d.ts'));
const unreachable = candidatesCandidates.filter((f) => !reachable.has(canonical(f))).sort();

console.log(`roots: ${allRoots.length}`);
console.log(`reachable modules: ${reachable.size}`);
console.log(`unreachable src/ server/ files: ${unreachable.length}`);
for (const f of unreachable) {
  console.log(f.replace(repoRoot + path.sep, ''));
}