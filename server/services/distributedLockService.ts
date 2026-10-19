import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, Database } from '../db/database';
import { DistributedLockEntity } from '../db/schema';
import { lockRepository } from '../db/repositories/DistributedLockRepository';
import { LOCKS_DIR } from '../db/paths';

export interface LockLease {
  lockKey: string;
  leaseId: string;
  owner: string;
  acquiredAt: number;
  expiresAt: number;
  fencingToken: number;
  version: number;
}

export class DistributedLockService {
  private static instance: DistributedLockService;
  private waitQueues: Map<string, Array<() => void>> = new Map();
  private defaultOwner: string;
  private locksDir: string;
  private lastFileSweepAt = 0;

  /**
   * Grace period before an unreadable lock file is treated as an orphan.
   *
   * tryAcquire creates the file with openSync(path, 'wx') and writes the lease
   * a moment later, so there is a window in which it exists but is empty or
   * half-written. Deleting it inside that window would hand the same lock to
   * two owners. The window is microseconds wide; five minutes sits far outside
   * it, and anything still unreadable after that came from a process that died
   * part-way through acquiring.
   */
  private static readonly ORPHAN_GRACE_MS = 5 * 60_000;

  /**
   * The disk sweep walks a directory and stats files, so it runs on a much
   * slower cadence than the in-memory pass. Leftover files waste space; they do
   * not block anyone, because an expired file is already reclaimed on demand by
   * tryAcquire.
   */
  private static readonly FILE_SWEEP_INTERVAL_MS = 60_000;

  private constructor(customOwner?: string, customLocksDir?: string) {
    this.defaultOwner = customOwner || `proc-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
    // customLocksDir exists so a test can point a throwaway instance at its own
    // directory. Without it the only lock directory is the real data/locks, and
    // a test of the sweep would be deleting files belonging to a running server.
    this.locksDir = customLocksDir || LOCKS_DIR();
    try {
      if (!fs.existsSync(this.locksDir)) {
        fs.mkdirSync(this.locksDir, { recursive: true });
      }
    } catch {}
    // Background garbage collection of expired leases every 5 seconds. Best
    // effort: a tick that lands while the store is closing (shutdown, or a test
    // tearing its database down) must not become an uncaught exception — the
    // next tick, or the next acquire, sweeps the same leases.
    setInterval(() => {
      try {
        this.cleanupExpiredLocks();
      } catch (err) {
        console.warn('[DistributedLock] lease cleanup skipped:', (err as Error)?.message ?? err);
      }
    }, 5000).unref();

    // One sweep at construction clears what the previous run left behind. A
    // crash between acquire and release leaks the file permanently otherwise,
    // because nothing revisits a key that is never acquired again.
    this.sweepExpiredLockFiles();
  }

  private getLockFilePath(lockKey: string): string {
    const safeName = crypto.createHash('sha256').update(lockKey).digest('hex');
    return path.join(this.locksDir, `${safeName}.lock`);
  }

  public static getInstance(owner?: string): DistributedLockService {
    if (!DistributedLockService.instance) {
      DistributedLockService.instance = new DistributedLockService(owner);
    }
    return DistributedLockService.instance;
  }

  /**
   * Factory method to create isolated service instances for multi-process or multi-client simulation.
   */
  public static createInstance(owner: string, locksDir?: string): DistributedLockService {
    return new DistributedLockService(owner, locksDir);
  }

  /**
   * Non-blocking attempt to acquire a lock backed by kernel-level atomic lockfiles and persistence layer.
   */
  public tryAcquire(
    lockKey: string,
    ttlMs: number = 10000,
    owner: string = this.defaultOwner
  ): LockLease | null {
    const now = Date.now();
    const lockFilePath = this.getLockFilePath(lockKey);
    let fd: number | null = null;

    try {
      fd = fs.openSync(lockFilePath, 'wx');
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        // Inspect if existing file is truly expired
        try {
          const content = fs.readFileSync(lockFilePath, 'utf-8');
          if (content && content.trim().length > 0) {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed.expiresAt === 'number' && parsed.expiresAt <= now) {
              try { fs.unlinkSync(lockFilePath); } catch {}
              try { fd = fs.openSync(lockFilePath, 'wx'); } catch {}
            }
          }
        } catch {
          // If parse fails (e.g. file is actively being written by winner), lock is busy, safely reject
          return null;
        }
      }
    }

    if (fd === null) {
      return null;
    }

    const leaseId = `LEASE-${crypto.randomBytes(8).toString('hex')}`;
    const fencingToken = db.nextFencingToken();
    const expiresAt = now + ttlMs;
    const existingIdx = db.locks.findIndex(l => l.lockKey === lockKey);
    const existing = existingIdx >= 0 ? db.locks[existingIdx] : null;
    const version = existing ? existing.version + 1 : 1;

    const leaseRecord: DistributedLockEntity = {
      id: lockKey,
      lockKey,
      leaseId,
      owner,
      acquiredAt: now,
      expiresAt,
      fencingToken,
      version
    };

    try {
      fs.writeFileSync(fd, JSON.stringify(leaseRecord), 'utf-8');
      fs.closeSync(fd);
    } catch {
      try { fs.closeSync(fd); } catch {}
    }

    // Mirror to database in-memory/disk state
    db.runInTransaction(() => {
      if (existingIdx >= 0) {
        db.locks[existingIdx] = leaseRecord;
      } else {
        db.locks.push(leaseRecord);
      }
      db.saveToDisk();
    });

    return { ...leaseRecord };
  }

  /**
   * Validates if a fencing token is still active and valid for the given lock key.
   * Protects against stale commits from preempted or expired workers.
   */
  public validateFencingToken(lockKey: string, fencingToken: number): boolean {
    const lockFilePath = this.getLockFilePath(lockKey);
    try {
      if (fs.existsSync(lockFilePath)) {
        const raw = fs.readFileSync(lockFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.fencingToken === fencingToken && parsed.expiresAt > Date.now()) {
          return true;
        }
      }
    } catch {}

    (db.getAdapter() as any).reloadFromDisk?.();
    const currentLock = db.locks.find(l => l.lockKey === lockKey);
    if (!currentLock) return false;
    return currentLock.fencingToken === fencingToken && currentLock.expiresAt > Date.now();
  }

  /**
   * Acquire lock with retry, exponential backoff and timeout queueing.
   */
  public async acquireWithTimeout(
    lockKey: string,
    ttlMs: number = 10000,
    timeoutMs: number = 5000,
    owner: string = this.defaultOwner
  ): Promise<LockLease> {
    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < timeoutMs) {
      const lease = this.tryAcquire(lockKey, ttlMs, owner);
      if (lease) {
        return lease;
      }

      attempt++;
      const backoff = Math.min(200, 20 + Math.pow(1.5, attempt) * 10);

      // Wait for release notification or backoff timer
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, backoff);
        if (!this.waitQueues.has(lockKey)) {
          this.waitQueues.set(lockKey, []);
        }
        this.waitQueues.get(lockKey)!.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    throw new Error(`Timeout: Failed to acquire distributed lock '${lockKey}' within ${timeoutMs}ms.`);
  }

  /**
   * Release lock safely with leaseId validation.
   */
  public release(lease: LockLease): boolean {
    let released = false;

    const lockFilePath = this.getLockFilePath(lease.lockKey);
    try {
      if (fs.existsSync(lockFilePath)) {
        const raw = fs.readFileSync(lockFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.leaseId === lease.leaseId) {
          fs.unlinkSync(lockFilePath);
        }
      }
    } catch {}

    db.runInTransaction(() => {
      const idx = db.locks.findIndex(l => l.lockKey === lease.lockKey);
      if (idx >= 0 && db.locks[idx].leaseId === lease.leaseId) {
        db.locks.splice(idx, 1);
        db.saveToDisk();
        released = true;
      }
    });

    if (released) {
      this.notifyWaiters(lease.lockKey);
    }
    return released;
  }

  /**
   * Renews an active lock lease, extending its TTL if the leaseId is valid and active.
   */
  public renew(lease: LockLease, extensionTtlMs: number = 10000): boolean {
    const now = Date.now();
    let renewed = false;

    db.runInTransaction(() => {
      const idx = db.locks.findIndex(l => l.lockKey === lease.lockKey);
      if (idx >= 0 && db.locks[idx].leaseId === lease.leaseId) {
        if (db.locks[idx].expiresAt > now) {
          db.locks[idx].expiresAt = now + extensionTtlMs;
          db.locks[idx].version += 1;
          lease.expiresAt = db.locks[idx].expiresAt;
          lease.version = db.locks[idx].version;
          db.saveToDisk();
          renewed = true;
        }
      }
    });

    return renewed;
  }

  /**
   * Execute critical section under distributed lock with fencing token support.
   */
  public async runWithLock<T>(
    lockKey: string,
    work: (lease: LockLease) => Promise<T> | T,
    ttlMs: number = 10000,
    timeoutMs: number = 5000,
    owner: string = this.defaultOwner
  ): Promise<T> {
    const lease = await this.acquireWithTimeout(lockKey, ttlMs, timeoutMs, owner);
    try {
      return await work(lease);
    } finally {
      this.release(lease);
    }
  }

  /**
   * Check if key is currently locked by an active lease.
   */
  public isLocked(lockKey: string): boolean {
    const now = Date.now();
    const lock = db.locks.find(l => l.lockKey === lockKey);
    if (!lock) return false;
    if (lock.expiresAt <= now) {
      this.cleanupKeyIfExpired(lockKey);
      return false;
    }
    return true;
  }

  /**
   * Get current lock entity if active.
   */
  public getLock(lockKey: string): DistributedLockEntity | null {
    const now = Date.now();
    const lock = db.locks.find(l => l.lockKey === lockKey);
    if (!lock || lock.expiresAt <= now) return null;
    return { ...lock };
  }

  private cleanupKeyIfExpired(lockKey: string) {
    const now = Date.now();
    let cleaned = false;

    db.runInTransaction(() => {
      const idx = db.locks.findIndex(l => l.lockKey === lockKey);
      if (idx >= 0 && db.locks[idx].expiresAt <= now) {
        db.locks.splice(idx, 1);
        db.saveToDisk();
        cleaned = true;
      }
    });

    if (cleaned) {
      this.notifyWaiters(lockKey);
    }
  }

  /**
   * Removes expired and orphaned .lock files from data/locks.
   *
   * cleanupExpiredLocks() below drops expired rows from db.locks, but nothing
   * ever removed the files that mirror them. tryAcquire only unlinks a stale
   * file when the SAME key is acquired again, and many keys are used exactly
   * once — the swarm slots are literally `lock:swarm:slot:<timestamp>`. So the
   * directory grew without bound: 75 files were found here, left by processes
   * that had exited hours earlier.
   *
   * A file holding a lease that has not yet expired is never touched; that file
   * IS the lock, and removing it would let a second owner in.
   *
   * Returns the number of files removed.
   */
  public sweepExpiredLockFiles(): number {
    const now = Date.now();
    let removed = 0;

    let entries: string[];
    try {
      entries = fs.readdirSync(this.locksDir);
    } catch {
      // The directory is created in the constructor; if it is unreadable there
      // is nothing to sweep and nothing to report.
      this.lastFileSweepAt = now;
      return 0;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.lock')) continue;
      const filePath = path.join(this.locksDir, entry);

      let expiresAt: number | null = null;
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.trim().length > 0) {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed.expiresAt === 'number') {
            expiresAt = parsed.expiresAt;
          }
        }
      } catch {
        // Unreadable, or being written right now. The mtime check below decides.
      }

      if (expiresAt !== null) {
        if (expiresAt > now) continue;
      } else if (now - this.fileMtimeMs(filePath) < DistributedLockService.ORPHAN_GRACE_MS) {
        continue;
      }

      try {
        fs.unlinkSync(filePath);
        removed++;
      } catch {
        // Raced with another sweeper, or with the owner's own release. Either
        // way the file is gone or not ours to force.
      }
    }

    this.lastFileSweepAt = now;
    return removed;
  }

  private fileMtimeMs(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      // Treat a file we cannot stat as brand new, so the grace period protects
      // it rather than the sweep deleting something it cannot reason about.
      return Date.now();
    }
  }

  private cleanupExpiredLocks() {
    const now = Date.now();
    const expiredKeys: string[] = [];

    if (now - this.lastFileSweepAt >= DistributedLockService.FILE_SWEEP_INTERVAL_MS) {
      this.sweepExpiredLockFiles();
    }

    db.runInTransaction(() => {
      const remaining: DistributedLockEntity[] = [];
      for (const lock of db.locks) {
        if (lock.expiresAt <= now) {
          expiredKeys.push(lock.lockKey);
        } else {
          remaining.push(lock);
        }
      }
      if (expiredKeys.length > 0) {
        db.locks.length = 0;
        db.locks.push(...remaining);
        db.saveToDisk();
      }
    });

    for (const key of expiredKeys) {
      this.notifyWaiters(key);
    }
  }

  private notifyWaiters(lockKey: string) {
    const queue = this.waitQueues.get(lockKey);
    if (queue && queue.length > 0) {
      const next = queue.shift();
      if (next) next();
    }
  }
}

export const distributedLockService = DistributedLockService.getInstance();
