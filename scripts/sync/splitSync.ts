/**
 * Split-sync: publish the monorepo to the two split repos (Rehlla/web, Rehlla/backend).
 *
 * The monorepo (this directory) is the source of truth. `Rehlla/web` and
 * `Rehlla/backend` are VIEWS of it, split along the server/client line:
 *
 *   web      <- src/, public/, docs/, index.html, vite.config.ts, tsconfig*.json, package.json
 *   backend  <- server/, server.ts, tests/, scripts/, data/ (seeds only), configs
 *
 * SOURCE OF TRUTH = `git ls-files`. The monorepo's own .gitignore is the
 * allow/deny policy: seeds are re-admitted one by one, everything else under
 * data/ is runtime state (user records, live session tokens, traveler PII,
 * supplier payout IBANs) and never leaves the machine. Using `git ls-files`
 * instead of a hand-maintained denylist means the split repos can never
 * publish something the monorepo itself refuses to commit.
 *
 * DELETIONS are manifest-driven. Each split repo carries
 * `.split-sync-manifest.json` listing the files this script manages. A file is
 * removed from the split repo only when it was in the previous manifest and
 * is no longer in the source — a file a human added to the split repo by hand
 * is never touched.
 *
 * Usage:
 *   npm run sync:split                 # sync + commit + push both repos
 *   npm run sync:split -- --dry-run    # show what would change, write nothing
 *   npm run sync:split -- --no-push    # sync + commit locally, push nothing
 *   npm run sync:split -- --only=web   # only one target
 *
 * Auth: set GITHUB_TOKEN (or GH_TOKEN) in the environment to push. The token
 * is never written to disk and never embedded in the remote URL on disk.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const MANIFEST_NAME = '.split-sync-manifest.json';

/** A target split repo: which monorepo paths it receives. */
interface Target {
  id: 'web' | 'backend';
  /** Directories mirrored wholesale (only git-tracked files inside them). */
  dirs: string[];
  /** Individual files at the split repo's root. */
  files: string[];
}

const WEB: Target = {
  id: 'web',
  dirs: ['src', 'public', 'docs'],
  files: [
    'index.html',
    'vite.config.ts',
    'tsconfig.json',
    'tsconfig.test.json',
    'package.json',
    '.env.example',
  ],
};

const BACKEND: Target = {
  id: 'backend',
  dirs: ['server', 'tests', 'scripts', 'data', 'docs'],
  files: [
    'server.ts',
    'package.json',
    'tsconfig.json',
    'tsconfig.test.json',
    'vitest.config.ts',
    'vitest.ui.config.ts',
    'playwright.config.ts',
    '.env.example',
    'Dockerfile',
    '.dockerignore',
  ],
};

const TARGETS: Target[] = [WEB, BACKEND];

// ── CLI flags ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const NO_PUSH = argv.includes('--no-push');
const onlyIdx = argv.indexOf('--only');
const onlyEq = argv.find((a) => a.startsWith('--only='));
const ONLY = onlyEq ? onlyEq.slice('--only='.length) : onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

const WORKTREE_ROOT = process.env.SPLIT_WORKTREE_ROOT
  ? path.resolve(process.env.SPLIT_WORKTREE_ROOT)
  : path.resolve(REPO_ROOT, '..', '.split-sync');

function remoteUrl(id: 'web' | 'backend'): string {
  return `https://github.com/Rehlla/${id}.git`;
}

/**
 * Git auth header for a push, so the token never has to live in .git/config.
 * GitHub's basic auth takes "x-access-token:<token>" as the username/password
 * pair; git base64-encodes it for the Authorization header.
 */
function authHeader(): string[] {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return [];
  const encoded = Buffer.from(`x-access-token:${token}`).toString('base64');
  return ['-c', `http.extraheader=Authorization: Basic ${encoded}`];
}

// ── source discovery ─────────────────────────────────────────────────────────

/** Every file the monorepo tracks, as POSIX-relative paths. */
function trackedFiles(): Set<string> {
  const out = execFileSync('git', ['ls-files'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return new Set(out.split('\n').map((l) => l.trim()).filter(Boolean));
}

/**
 * The files a target should contain, as paths relative to the split repo root.
 * A tracked file under a mirrored dir keeps its path; a tracked root file is
 * taken as-is.
 */
function sourceSetFor(target: Target, tracked: Set<string>): string[] {
  const wanted: string[] = [];
  for (const dir of target.dirs) {
    const prefix = `${dir}/`;
    for (const file of tracked) {
      if (file.startsWith(prefix)) wanted.push(file);
    }
  }
  for (const file of target.files) {
    if (tracked.has(file)) wanted.push(file);
  }
  return wanted.sort();
}

// ── fs helpers ───────────────────────────────────────────────────────────────
function copyFile(src: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function readManifest(dir: string): string[] {
  const file = path.join(dir, MANIFEST_NAME);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed?.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

// ── git helpers ──────────────────────────────────────────────────────────────
function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function ensureWorktree(target: Target): string {
  const dir = path.join(WORKTREE_ROOT, target.id);
  if (fs.existsSync(path.join(dir, '.git'))) {
    if (!DRY_RUN) {
      try {
        git(dir, ['fetch', 'origin', '--quiet']);
        git(dir, ['checkout', 'main']);
        git(dir, ['reset', '--hard', 'origin/main']);
        git(dir, ['clean', '-fd']);
      } catch (err) {
        console.warn(`  ! could not refresh ${target.id}: ${(err as Error).message.split('\n')[0]}`);
      }
    }
    return dir;
  }

  console.log(`  cloning Rehlla/${target.id} → ${dir}`);
  if (!DRY_RUN) {
    fs.mkdirSync(WORKTREE_ROOT, { recursive: true });
    // Clone with the token in an Authorization header, then pin the remote to
    // the clean URL — the credential must not end up in .git/config.
    execFileSync(
      'git',
      [...authHeader(), 'clone', `https://github.com/Rehlla/${target.id}.git`, dir],
      { stdio: 'ignore' }
    );
    git(dir, ['remote', 'set-url', 'origin', `https://github.com/Rehlla/${target.id}.git`]);
    try {
      git(dir, ['checkout', 'main']);
    } catch {
      execFileSync('git', ['checkout', '-B', 'main'], { cwd: dir, stdio: 'ignore' });
    }
    git(dir, ['config', 'user.name', 'Dahab Ops']);
    git(dir, ['config', 'user.email', 'tia21040026-web@github.com']);
  }
  return dir;
}

/** The .gitignore body for a target — also used as the runtime-state denylist. */
function gitignoreRules(target: Target): string[] {
  return target.id === 'web'
    ? [
        'node_modules/',
        'build/',
        'dist/',
        'coverage/',
        '.idea/',
        '.vscode/',
        '*.log',
        '*.err.log',
        '*.bak',
        '.env',
        '.env.local',
        '.DS_Store',
        'qa-results/',
        'playwright-report/',
        '',
      ]
    : [
        'node_modules/',
        'build/',
        'dist/',
        'coverage/',
        '.data/',
        'run-*/',
        '.idea/',
        '.vscode/',
        '*.log',
        '*.err.log',
        '*.bak',
        '.env',
        '.env.local',
        '.DS_Store',
        '',
        '# Runtime state — never commit. Contains user records, live session',
        '# tokens, traveler phone/email and supplier payout IBANs.',
        'data/locks/',
        'data/backups/',
        'data/cms-media/',
        'data/payment-receipts/',
        'data/*.sqlite',
        'data/*.sqlite-shm',
        'data/*.sqlite-wal',
        'data/*.seq',
        'data/audit-archive-*.jsonl',
        'data/daygi_chats.json',
        'data/daygi_beta_telemetry.json',
        'data/daygi_tasks.json',
        '',
        '# E2E runtime artifacts — the Playwright server boots a throwaway',
        '# copy of the state dir here (seeds + sqlite), never the real data/.',
        'tests/e2e/.data/',
        'tests/e2e/snapshots/',
        'tests/browser-qa/screenshots/',
        '',
      ];
}

function writeGitignore(dir: string, target: Target): boolean {
  const next = gitignoreRules(target).join('\n');
  const file = path.join(dir, '.gitignore');
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return false;
  if (!DRY_RUN) fs.writeFileSync(file, next, 'utf8');
  return true;
}

// ── main ─────────────────────────────────────────────────────────────────────

/**
 * Remove tracked files that the split repo's own .gitignore now matches.
 * These are runtime state (sqlite copies, WAL files, lock dirs, e2e data
 * drops) that must never live in a published repo. Returns the removed paths.
 *
 * The rules are evaluated against a temporary excludes file rather than the
 * .gitignore on disk, so a dry-run reports the same files a real run would
 * untrack even before the .gitignore has been written.
 */
function untrackIgnored(dir: string, rules: string[]): string[] {
  let tracked: string[];
  try {
    tracked = git(dir, ['ls-files', '-z'])
      .split('\0')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }

  const excludesFile = path.join(os.tmpdir(), `split-sync-excludes-${process.pid}.gitignore`);
  fs.writeFileSync(excludesFile, rules.join('\n'), 'utf8');

  const removed: string[] = [];
  for (const rel of tracked) {
    let ignored = false;
    try {
      // --no-index: check-ignore skips TRACKED files by default, which is
      // exactly the case here (a stale runtime file that is still in the
      // index and therefore never reported as ignored).
      execFileSync(
        'git',
        ['-c', `core.excludesFile=${excludesFile}`, 'check-ignore', '-q', '--no-index', rel],
        { cwd: dir, stdio: 'ignore' }
      );
      ignored = true;
    } catch {
      ignored = false;
    }
    if (!ignored) continue;
    if (!DRY_RUN) {
      try {
        git(dir, ['rm', '--cached', '-q', '--ignore-unmatch', rel]);
        fs.rmSync(path.join(dir, rel), { force: true });
      } catch {
        continue;
      }
    }
    removed.push(rel);
  }

  try {
    fs.rmSync(excludesFile, { force: true });
  } catch {
    /* best effort */
  }
  return removed;
}

function syncTarget(target: Target, tracked: Set<string>): { dir: string; changed: string[] } {
  console.log(`\n▶ ${target.id}`);
  const dir = ensureWorktree(target);
  const wanted = sourceSetFor(target, tracked);
  const previous = readManifest(dir);
  const wantedSet = new Set(wanted);
  const changed: string[] = [];

  // Copy or update every wanted file.
  for (const rel of wanted) {
    const src = path.join(REPO_ROOT, rel);
    const dest = path.join(dir, rel);
    if (!fs.existsSync(src)) continue;
    if (!fs.existsSync(dest) || !fs.readFileSync(src).equals(fs.readFileSync(dest))) {
      if (!DRY_RUN) copyFile(src, dest);
      changed.push(rel);
    }
  }

  // Remove files this script previously managed but that the source dropped.
  for (const rel of previous) {
    if (wantedSet.has(rel)) continue;
    const dest = path.join(dir, rel);
    if (!fs.existsSync(dest)) continue;
    if (!DRY_RUN) fs.rmSync(dest, { force: true });
    changed.push(`- ${rel}`);
  }

  // The .gitignore must be written BEFORE the untrack pass: it defines what
  // "runtime state" means for this repo, and check-ignore reads it from disk.
  if (writeGitignore(dir, target)) {
    changed.push('.gitignore');
    console.log('  .gitignore updated');
  }

  // Untrack runtime state that a previous split committed before the denylist
  // existed. The manifest above only removes files this script managed, so a
  // repo seeded by hand (or by an older version of this script) can still
  // carry tracked runtime files. Anything the split repo's own .gitignore
  // matches is runtime by definition and must not stay in the index.
  const untracked = untrackIgnored(dir, gitignoreRules(target));
  for (const rel of untracked) {
    changed.push(`- ${rel}`);
  }
  if (untracked.length) {
    console.log(`  ${untracked.length} runtime file(s) untracked`);
  }

  if (changed.length) {
    const byTop = new Map<string, number>();
    for (const rel of changed) {
      const top = rel.startsWith('- ') ? rel.slice(2).split('/')[0] : rel.split('/')[0];
      byTop.set(top, (byTop.get(top) ?? 0) + 1);
    }
    console.log(
      `  ${changed.length} file(s) changed: ` +
        [...byTop.entries()].map(([k, v]) => `${k}(${v})`).join(', ')
    );
  } else {
    console.log('  no changes');
  }

  // The manifest is the contract for the next run's deletions.
  const manifest = { files: wanted, source: 'monorepo git ls-files' };
  const manifestPath = path.join(dir, MANIFEST_NAME);
  if (!DRY_RUN) fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return { dir, changed };
}

function commitAndPush(dir: string, target: Target, changed: string[]): void {
  if (!changed.length) {
    console.log(`  nothing to commit for ${target.id}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] would commit ${changed.length} file(s) to ${target.id}`);
    return;
  }

  git(dir, ['add', '-A']);
  const staged = git(dir, ['diff', '--cached', '--name-only']).trim();
  if (!staged) {
    console.log(`  nothing to commit for ${target.id}`);
    return;
  }

  let source = 'unknown';
  try {
    source = git(REPO_ROOT, ['rev-parse', '--short', 'HEAD']).trim();
  } catch {
    /* detached or empty repo — the message still reads fine */
  }
  const message = `chore(sync): mirror monorepo ${source} into ${target.id}`;
  git(dir, ['commit', '-m', message]);
  console.log(`  committed: ${message}`);

  if (NO_PUSH) {
    console.log('  [--no-push] skipping push');
    return;
  }
  // The token rides in an Authorization header rather than the remote URL, so
  // it never lands in .git/config on disk.
  execFileSync('git', [...authHeader(), 'push', 'origin', 'main'], { cwd: dir, stdio: 'inherit' });
  console.log(`  pushed to Rehlla/${target.id}`);
}

function main(): void {
  console.log(`Split-sync${DRY_RUN ? ' (dry run)' : ''}${NO_PUSH ? ' (no push)' : ''}`);
  console.log(`  source:    ${REPO_ROOT}`);
  console.log(`  worktrees: ${WORKTREE_ROOT}`);

  const targets = ONLY ? TARGETS.filter((t) => t.id === ONLY) : TARGETS;
  if (!targets.length) {
    console.error(`Unknown --only "${ONLY}". Valid: ${TARGETS.map((t) => t.id).join(', ')}`);
    process.exit(1);
  }

  const tracked = trackedFiles();
  console.log(`  tracked files in monorepo: ${tracked.size}`);

  for (const target of targets) {
    const { dir, changed } = syncTarget(target, tracked);
    commitAndPush(dir, target, changed);
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run — nothing was written or pushed)' : ''}.`);
}

main();
