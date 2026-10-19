import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { dataDir } from '../db/paths';

/**
 * Scheduled, retained, verifiable SQLite backups.
 *
 * `db:backup` was a manual CLI with no schedule, no retention and no restore
 * drill — backs up hope, not data. This service is the importable core: the
 * CLI delegates to it, the server schedules it, and the test suite restores
 * from it. Same mechanism throughout (VACUUM INTO: transactional, online-safe,
 * WAL-complete), verified on every write.
 */

export interface BackupResult {
  file: string;
  sizeMB: number;
  users: number;
  integrityOk: boolean;
}

function sourceFile(): string {
  // dataDir() (not SQLITE_FILE()) so tests can repoint per call via env.
  return path.join(dataDir(), 'dahab.sqlite');
}

function dir(): string {
  return path.join(dataDir(), 'backups');
}

function timestampedName(now = new Date()): string {
  return `dahab-${now.toISOString().replace(/[:.]/g, '-')}.sqlite`;
}

/** Every backup file in the directory, oldest first. */
export function listBackups(): string[] {
  if (!fs.existsSync(dir())) return [];
  return fs
    .readdirSync(dir())
    .filter(f => f.endsWith('.sqlite'))
    .sort()
    .map(f => path.join(dir(), f));
}

/** Verify a backup opens, passes integrity_check, and carries a users table. */
export function verifyBackup(file: string): { integrityOk: boolean; users: number } {
  const verify = new Database(file, { readonly: true });
  try {
    const ok = verify.pragma('integrity_check', { simple: true });
    const rows = verify.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return { integrityOk: ok === 'ok', users: rows.n };
  } finally {
    verify.close();
  }
}

/**
 * Write a verified backup. Throws when the source is missing or the copy
 * fails verification — a backup that cannot be opened is reported, not kept.
 */
export function runBackup(now = new Date()): BackupResult {
  const source = sourceFile();
  if (!fs.existsSync(source)) {
    throw new Error(`No database at ${source}. Run: npm run db:migrate`);
  }
  if (!fs.existsSync(dir())) fs.mkdirSync(dir(), { recursive: true });

  const target = path.join(dir(), timestampedName(now));
  const sqlite = new Database(source, { readonly: true });
  try {
    sqlite.prepare('VACUUM INTO ?').run(target);
  } finally {
    sqlite.close();
  }

  const { integrityOk, users } = verifyBackup(target);
  if (!integrityOk) {
    try { fs.unlinkSync(target); } catch { /* keep the evidence out of the rotation */ }
    throw new Error(`Backup wrote to ${target} but failed integrity_check; removed.`);
  }
  const sizeMB = fs.statSync(target).size / 1048576;
  return { file: target, sizeMB, users, integrityOk: true };
}

/**
 * Keep the newest `keep` backups, delete the rest. Returns what was removed.
 * Never deletes the last remaining backup, even if keep is 0 — an empty
 * rotation is how data loss stories start.
 */
export function pruneBackups(keep: number): { kept: string[]; removed: string[] } {
  const all = listBackups();
  const effectiveKeep = Math.max(1, Math.floor(keep));
  const kept = all.slice(-effectiveKeep);
  const removed: string[] = [];
  for (const file of all.slice(0, Math.max(0, all.length - effectiveKeep))) {
    try {
      fs.unlinkSync(file);
      removed.push(file);
    } catch {
      // A backup we cannot delete is kept by definition; report the rest.
    }
  }
  return { kept, removed };
}

export function backupConfig(): { intervalHours: number; keep: number } {
  const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS);
  const keep = Number(process.env.BACKUP_KEEP_COUNT);
  return {
    intervalHours: Number.isFinite(intervalHours) && intervalHours > 0 ? intervalHours : 6,
    keep: Number.isFinite(keep) && keep > 0 ? Math.floor(keep) : 7,
  };
}

/**
 * One scheduled pass: backup, prune, log. Throws nothing — a failed backup
 * must page logs, not crash the server. Returns the result for tests.
 */
export function scheduledBackupPass(now = new Date()): (BackupResult & { pruned: string[] }) | null {
  // Quiet no-op for non-sqlite adapters (no source file to back up).
  if (!fs.existsSync(sourceFile())) return null;
  const { keep } = backupConfig();
  try {
    const result = runBackup(now);
    const { removed } = pruneBackups(keep);
    console.log(
      `[Backup] ${result.file} (${result.sizeMB.toFixed(2)} MB, integrity ok, ${result.users} users)` +
        (removed.length > 0 ? `, pruned ${removed.length} old backup(s)` : '')
    );
    return { ...result, pruned: removed };
  } catch (err: any) {
    console.error('[Backup] Scheduled backup failed:', err?.message || err);
    return null;
  }
}

/** Interval handle for the server boot sequence (unref'd: never hold the process open). */
export function startBackupSchedule(): NodeJS.Timeout {
  const { intervalHours } = backupConfig();
  return setInterval(() => {
    scheduledBackupPass();
  }, intervalHours * 60 * 60 * 1000).unref();
}
