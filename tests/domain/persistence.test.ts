import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JsonFilePersistenceAdapter } from '../../server/db/adapters/JsonFilePersistenceAdapter';

/**
 * Durable writes.
 *
 * saveDirect used to catch a failed atomic write (temp file + rename) and fall
 * back to writing dahab_db.json IN PLACE. That converts a recoverable failure
 * into an unrecoverable one: the temp copy is deleted, the real file is
 * truncated and rewritten, and a failure part-way through leaves a half-written
 * database — the file holding user records, live sessions and the ledger — with
 * nothing to restore from.
 *
 * These run against a throwaway directory, so they exercise the real
 * filesystem path rather than a mock of it.
 */

let dir: string;
let dbFile: string;
let adapter: JsonFilePersistenceAdapter;

const errno = (code: string) => {
  const err = new Error(`simulated ${code}`) as NodeJS.ErrnoException;
  err.code = code;
  return err;
};

const tempFiles = () => fs.readdirSync(dir).filter(f => f.endsWith('.tmp'));
const storedUsers = () => JSON.parse(fs.readFileSync(dbFile, 'utf-8')).users;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-persistence-'));
  dbFile = path.join(dir, 'dahab_db.json');
  adapter = new JsonFilePersistenceAdapter(dir);
  adapter.getState().users.push({ id: 'USR-BASELINE' } as never);
  adapter.save();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('atomic write', () => {
  it('persists state as readable JSON', () => {
    expect(storedUsers()).toHaveLength(1);
    expect(storedUsers()[0].id).toBe('USR-BASELINE');
  });

  it('leaves the previous file byte-identical when the write fails', () => {
    const before = fs.readFileSync(dbFile, 'utf-8');
    adapter.getState().users.push({ id: 'USR-LOST' } as never);

    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw errno('ENOSPC'); });
    expect(() => adapter.save()).toThrow(/Failed to persist/);
    vi.restoreAllMocks();

    // The removed fallback would have written USR-LOST here, non-atomically.
    expect(fs.readFileSync(dbFile, 'utf-8')).toBe(before);
    expect(storedUsers()).toHaveLength(1);
  });

  it('never writes the database file in place', () => {
    const inPlace: string[] = [];
    const realWrite = fs.writeFileSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementation(((target: never, ...rest: never[]) => {
      if (typeof target === 'string' && path.resolve(target) === dbFile) inPlace.push(target);
      return (realWrite as unknown as (...a: never[]) => void)(target, ...rest);
    }) as typeof fs.writeFileSync);
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw errno('ENOSPC'); });

    expect(() => adapter.save()).toThrow();
    expect(inPlace).toEqual([]);
  });

  it('flushes the temp file to disk before publishing it', () => {
    const order: string[] = [];
    const realFsync = fs.fsyncSync;
    const realRename = fs.renameSync;
    vi.spyOn(fs, 'fsyncSync').mockImplementation(((fd: never) => {
      order.push('fsync');
      return realFsync(fd);
    }) as typeof fs.fsyncSync);
    vi.spyOn(fs, 'renameSync').mockImplementation(((a: never, b: never) => {
      order.push('rename');
      return realRename(a, b);
    }) as typeof fs.renameSync);

    adapter.save();
    // rename is atomic only over bytes the filesystem has committed; publishing
    // an unflushed temp file can survive a crash as a truncated database.
    expect(order).toEqual(['fsync', 'rename']);
  });

  it('leaves no temp file behind after a failed write', () => {
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw errno('ENOSPC'); });
    expect(() => adapter.save()).toThrow();
    vi.restoreAllMocks();
    expect(tempFiles()).toEqual([]);
  });

  it('leaves no temp file behind after a successful write', () => {
    adapter.save();
    expect(tempFiles()).toEqual([]);
  });
});

describe('failure reporting', () => {
  it('throws synchronously, so a non-awaiting caller still sees the failure', () => {
    // save() is declared Promise<void> but all 54 call sites ignore the result.
    // While it was `async`, every write failure became an unhandled rejection.
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw errno('ENOSPC'); });
    let threw = false;
    try { adapter.save(); } catch { threw = true; }
    expect(threw).toBe(true);
  });

  it('still satisfies the Promise<void> contract on success', async () => {
    await expect(adapter.save()).resolves.toBeUndefined();
  });

  it('attaches the underlying cause and says the file is unchanged', () => {
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw errno('ENOSPC'); });
    let error: Error | undefined;
    try { adapter.save(); } catch (e) { error = e as Error; }
    expect(error!.message).toMatch(/previous contents are unchanged/);
    expect((error!.cause as NodeJS.ErrnoException).code).toBe('ENOSPC');
  });
});

describe('retry policy', () => {
  it('retries a transient lock and succeeds — the case the fallback was papering over', () => {
    const realRename = fs.renameSync;
    let attempts = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation(((a: never, b: never) => {
      attempts++;
      // Windows fails a rename with EBUSY while another process holds the target.
      if (attempts < 3) throw errno('EBUSY');
      return realRename(a, b);
    }) as typeof fs.renameSync);

    adapter.getState().users.push({ id: 'USR-RETRIED' } as never);
    expect(() => adapter.save()).not.toThrow();
    expect(attempts).toBe(3);
    expect(storedUsers()).toHaveLength(2);
  });

  it('gives up after a bounded number of transient failures', () => {
    let attempts = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { attempts++; throw errno('EBUSY'); });
    expect(() => adapter.save()).toThrow(/Failed to persist/);
    expect(attempts).toBe(5);
  });

  it('does not retry a failure that will not fix itself', () => {
    let attempts = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { attempts++; throw errno('ENOSPC'); });
    expect(() => adapter.save()).toThrow();
    expect(attempts).toBe(1);
  });
});

describe('transaction commit', () => {
  it('rolls back in-memory state when the commit cannot be persisted', () => {
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw errno('ENOSPC'); });

    expect(() => adapter.runInTransaction(() => {
      adapter.getState().users.push({ id: 'USR-UNCOMMITTED' } as never);
    })).toThrow(/Failed to persist/);
    vi.restoreAllMocks();

    // commit() used to clear the rollback backup BEFORE writing, so a failed
    // write left the mutation in memory with nothing to restore: memory and
    // disk disagreed while the caller was told the write had failed.
    expect(adapter.getState().users.map((u: { id: string }) => u.id)).toEqual(['USR-BASELINE']);
    expect(storedUsers()).toHaveLength(1);
  });

  it('commits normally when the write succeeds', () => {
    adapter.runInTransaction(() => {
      adapter.getState().users.push({ id: 'USR-COMMITTED' } as never);
    });
    expect(storedUsers()).toHaveLength(2);
  });

  it('writes once for a nested transaction, not once per level', () => {
    const realRename = fs.renameSync;
    let writes = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation(((a: never, b: never) => {
      writes++;
      return realRename(a, b);
    }) as typeof fs.renameSync);

    adapter.runInTransaction(() => {
      adapter.runInTransaction(() => {
        adapter.getState().users.push({ id: 'USR-NESTED' } as never);
      });
    });
    expect(writes).toBe(1);
  });
});

describe('loading a damaged store', () => {
  it('preserves an unparseable file instead of replacing it with an empty database', () => {
    const damagedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-corrupt-'));
    const damagedFile = path.join(damagedDir, 'dahab_db.json');
    fs.writeFileSync(damagedFile, '{"users":[{"id":"USR-REAL"}], TRUNCATED', 'utf-8');

    try {
      // Previously this logged and called saveDirect(defaultState): one corrupt
      // byte replaced every user, session and ledger entry, unrecoverably.
      const recovered = new JsonFilePersistenceAdapter(damagedDir);
      expect(recovered.getState().users).toEqual([]);

      const preserved = fs.readdirSync(damagedDir).filter(f => f.includes('.corrupt-'));
      expect(preserved).toHaveLength(1);
      expect(fs.readFileSync(path.join(damagedDir, preserved[0]), 'utf-8')).toContain('USR-REAL');
    } finally {
      fs.rmSync(damagedDir, { recursive: true, force: true });
    }
  });

  it('starts clean when there is simply no file yet', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-empty-'));
    try {
      const fresh = new JsonFilePersistenceAdapter(emptyDir);
      expect(fresh.getState().users).toEqual([]);
      expect(fs.existsSync(path.join(emptyDir, 'dahab_db.json'))).toBe(true);
      expect(fs.readdirSync(emptyDir).filter(f => f.includes('.corrupt-'))).toEqual([]);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
