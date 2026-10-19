import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const REAL_DATA_DIR = process.env.DAHAB_DATA_DIR;

let dir: string;

function seedSource(): string {
  const file = path.join(dir, 'dahab.sqlite');
  const sqlite = new Database(file);
  sqlite.exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT)');
  sqlite.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('USR-1', 'a@example.test');
  sqlite.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('USR-2', 'b@example.test');
  sqlite.close();
  return file;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-backup-'));
  process.env.DAHAB_DATA_DIR = dir;
});

afterEach(() => {
  if (REAL_DATA_DIR === undefined) delete process.env.DAHAB_DATA_DIR;
  else process.env.DAHAB_DATA_DIR = REAL_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

import {
  runBackup,
  pruneBackups,
  listBackups,
  verifyBackup,
  scheduledBackupPass,
  backupConfig,
} from '../../server/services/backupService';

describe('backup service', () => {
  it('writes a verified backup of the source database', () => {
    seedSource();
    const result = runBackup();
    expect(result.integrityOk).toBe(true);
    expect(result.users).toBe(2);
    expect(result.file.endsWith('.sqlite')).toBe(true);
    expect(fs.existsSync(result.file)).toBe(true);
    expect(result.sizeMB).toBeGreaterThan(0);
  });

  it('throws instead of keeping an unverifiable copy', () => {
    expect(() => runBackup()).toThrow(/No database/);
  });

  it('prunes to the newest N but never deletes the last backup', () => {
    seedSource();
    const made: string[] = [];
    for (let i = 0; i < 4; i++) {
      // Distinct timestamps order the rotation deterministically.
      made.push(runBackup(new Date(Date.now() + i * 1000)).file);
      expect(made[i]).toBeTruthy();
    }
    expect(listBackups()).toHaveLength(4);
    const { kept, removed } = pruneBackups(2);
    expect(kept).toHaveLength(2);
    expect(removed).toHaveLength(2);
    expect(listBackups()).toHaveLength(2);
    // keep=0 is clamped to 1: an empty rotation is data loss by policy.
    const again = pruneBackups(0);
    expect(again.kept).toHaveLength(1);
    expect(listBackups()).toHaveLength(1);
  });

  it('restores: the backup opens standalone with all rows (restore drill)', () => {
    seedSource();
    const { file } = runBackup();
    const restored = new Database(file, { readonly: true });
    try {
      expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
      const rows = restored.prepare('SELECT id FROM users ORDER BY id').all() as { id: string }[];
      expect(rows.map(r => r.id)).toEqual(['USR-1', 'USR-2']);
    } finally {
      restored.close();
    }
  });

  it('scheduled pass backs up, prunes, and never throws', () => {
    seedSource();
    const pass = scheduledBackupPass();
    expect(pass).not.toBeNull();
    expect(pass!.integrityOk).toBe(true);
    expect(pass!.pruned).toEqual([]);
  });

  it('scheduled pass is a quiet no-op without a source database', () => {
    expect(scheduledBackupPass()).toBeNull();
  });

  it('reads schedule config from env with sane defaults', () => {
    delete process.env.BACKUP_INTERVAL_HOURS;
    delete process.env.BACKUP_KEEP_COUNT;
    expect(backupConfig()).toEqual({ intervalHours: 6, keep: 7 });
    process.env.BACKUP_INTERVAL_HOURS = '1';
    process.env.BACKUP_KEEP_COUNT = '3';
    expect(backupConfig()).toEqual({ intervalHours: 1, keep: 3 });
    process.env.BACKUP_INTERVAL_HOURS = 'junk';
    process.env.BACKUP_KEEP_COUNT = '-5';
    expect(backupConfig()).toEqual({ intervalHours: 6, keep: 7 });
    delete process.env.BACKUP_INTERVAL_HOURS;
    delete process.env.BACKUP_KEEP_COUNT;
  });

  it('verifyBackup reports integrity and user count', () => {
    seedSource();
    const { file } = runBackup();
    expect(verifyBackup(file)).toEqual({ integrityOk: true, users: 2 });
  });
});
