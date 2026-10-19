import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vite alias resolution gate.
 *
 * Two resolvers disagree about `@/…` in client code:
 *
 *   - tsc (tsconfig.json) maps `@/*` to `./*` and then `./src/*`;
 *   - Vite (vite.config.ts) matches an ordered alias map — one key per src/
 *     subpath plus the bare `@` → repo root — with NO `src/` fallback.
 *
 * Any src/ subpath missing from that map is a silent split resolution: tsc
 * finds `src/context/…` and stays green while Vite resolves `@/context/…` to
 * `<repo>/context/…`, finds nothing, and lets the request fall through to
 * Express's 404. There is no type error, so `npm run lint` cannot catch it: the
 * module simply never loads. Both failure shapes have now happened here — the
 * image accordion demo page shipped broken for one round, and a batch of new
 * `src/sections/home/*` files blanked the entire app, because main.tsx applies
 * no catch to `import('./App')` before `createRoot().render()`.
 *
 * Alias *values* are read out of vite.config.ts rather than assumed, so
 * repointing an alias is covered; the parse only understands this file's
 * `'key': path.resolve(__dirname, …)` shape and fails loudly if that changes.
 *
 * The gate resolves every client `@/…` import the way Vite does — longest
 * matching alias key wins, no `src/` fallback — and requires the target to
 * exist. It also requires every src/ subdirectory to HAVE an alias key, so the
 * next new directory fails here instead of at runtime.
 *
 * `server/` is deliberately out of scope: it resolves through tsconfig paths
 * (tsx), not through the Vite alias map, and currently imports nothing via `@/`.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SRC = join(ROOT, 'src');
const VITE_CONFIG = join(ROOT, 'vite.config.ts');

/** Extensions Vite/Node would try, in order, for an extensionless import. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
/** Bare-directory imports resolve through an index file, not the directory. */
const INDEX_FILES = EXTENSIONS.map((ext) => `index${ext}`);

/**
 * Reads `'<key>': path.resolve(__dirname, 'a', 'b'),` out of vite.config.ts and
 * turns each into an absolute directory.
 */
function readAliases(): Map<string, string> {
  const source = readFileSync(VITE_CONFIG, 'utf8');
  const entry = /'([^']+)':\s*path\.resolve\(\s*__dirname\s*((?:,\s*'[^']*')*)\s*\)/g;
  const aliases = new Map<string, string>();

  for (const match of source.matchAll(entry)) {
    const [, key, rawSegments] = match;
    const segments = [...rawSegments.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    aliases.set(key, resolve(ROOT, ...segments));
  }

  return aliases;
}

/** The alias Vite would use: the longest key the specifier starts with. */
function targetFor(specifier: string, aliases: Map<string, string>): string | null {
  let best: string | null = null;

  for (const key of aliases.keys()) {
    const matches = specifier === key || specifier.startsWith(`${key}/`);
    if (matches && (best === null || key.length > best.length)) best = key;
  }

  if (best === null) return null;

  const rest = specifier.slice(best.length).replace(/^\/+/, '');
  return join(aliases.get(best)!, rest);
}

function resolvesToFile(target: string): boolean {
  const candidates = [target, ...EXTENSIONS.map((ext) => target + ext)];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return true;
    } catch {
      // Not this one.
    }
  }
  try {
    if (statSync(target).isDirectory()) {
      return INDEX_FILES.some((file) => {
        try {
          return statSync(join(target, file)).isFile();
        } catch {
          return false;
        }
      });
    }
  } catch {
    // Nothing at the path at all.
  }
  return false;
}

function collectSourceFiles(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Every module specifier a file imports, however it spells the import. */
function importedSpecifiers(source: string): string[] {
  const patterns = [
    /(?:^|[^.\w])from\s*['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[\s;])import\s*['"]([^'"]+)['"]/g,
  ];
  const found: string[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function clientAliasImports(): { file: string; specifier: string; target: string | null }[] {
  const aliases = readAliases();
  const rows: { file: string; specifier: string; target: string | null }[] = [];

  for (const file of collectSourceFiles(SRC, [])) {
    for (const specifier of importedSpecifiers(readFileSync(file, 'utf8'))) {
      // `@/` is the project alias. A bare `@radix-ui/…` is an npm scoped
      // package and must not be dragged through the alias map.
      if (!specifier.startsWith('@/')) continue;
      rows.push({
        file: file.slice(ROOT.length + 1).replace(/\\/g, '/'),
        specifier,
        target: targetFor(specifier, aliases),
      });
    }
  }
  return rows;
}

describe('vite alias resolution', () => {
  it('reads a real alias map out of vite.config.ts', () => {
    const aliases = readAliases();
    expect(aliases.has('@')).toBe(true);
    expect(aliases.get('@')).toBe(ROOT);
    // The specific subpath aliases are what keep client code off the bare `@`.
    expect(aliases.has('@/components')).toBe(true);
    expect(aliases.get('@/components')).toBe(join(ROOT, 'src', 'components'));
  });

  it('resolves every client @/ import the way Vite does', () => {
    const rows = clientAliasImports();
    expect(rows.length).toBeGreaterThan(0);

    const broken = rows.filter((row) => row.target === null || !resolvesToFile(row.target));
    expect(
      broken.map((row) => `${row.file}: ${row.specifier} -> ${row.target ?? '(no alias)'}`),
    ).toEqual([]);
  });

  it('requires an alias for every src/ subdirectory', () => {
    // Preventive half: the reactive check above can only catch a specifier that
    // somebody already wrote. This one fails the moment a new src/ directory
    // exists without its alias, which is the state that blanked the app.
    const aliases = readAliases();
    const dirs = readdirSync(SRC).filter((name) => statSync(join(SRC, name)).isDirectory());
    expect(dirs.length).toBeGreaterThan(0);

    const missing = dirs.filter((name) => !aliases.has(`@/${name}`));
    expect(missing).toEqual([]);
  });

  it('detects the tsc-accepts / Vite-404s split it exists for', () => {
    // The regression this gate exists for, exercised against a REDUCED alias map
    // (bare `@` only) so the assertion tests the DETECTOR instead of tracking
    // today's alias list — `@/context` is aliased now, which is the point: this
    // must keep failing whenever a src/ subpath is missing from the map.
    const reduced = new Map<string, string>([['@', ROOT]]);
    const specifier = '@/context/TripContext';

    expect(resolvesToFile(join(ROOT, 'src', 'context', 'TripContext'))).toBe(true);
    expect(targetFor(specifier, reduced)).toBe(join(ROOT, 'context', 'TripContext'));
    expect(resolvesToFile(targetFor(specifier, reduced)!)).toBe(false);
  });
});
