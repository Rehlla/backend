import crypto from 'crypto';
import { db, Database } from '../database';
import { DistributedLockEntity } from '../schema';
import { BaseRepository } from './BaseRepository';

export class DistributedLockRepository extends BaseRepository<DistributedLockEntity> {
  constructor() {
    super((database: Database) => database.locks);
  }

  /**
   * Cleans up expired locks atomically and returns count of purged locks.
   */
  public async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let purged = 0;
    db.runInTransaction(() => {
      const activeLocks = db.locks.filter(lock => lock.expiresAt > now);
      purged = db.locks.length - activeLocks.length;
      if (purged > 0) {
        db.locks.length = 0;
        db.locks.push(...activeLocks);
        db.saveToDisk();
      }
    });
    return purged;
  }

  /**
   * Non-blocking atomic Compare-And-Swap (CAS) acquire.
   * If lock is held by another active lease, fails safely.
   * If existing lease has expired, it atomically preempts the stale lock and issues a new monotonic fencing token.
   */
  public async tryAcquire(
    lockKey: string,
    owner: string,
    ttlMs: number = 10000
  ): Promise<{ success: boolean; lease?: DistributedLockEntity; reason?: string }> {
    const now = Date.now();
    let result: { success: boolean; lease?: DistributedLockEntity; reason?: string } = {
      success: false,
      reason: 'LOCKED'
    };

    db.runInTransaction(() => {
      const existingIdx = db.locks.findIndex(l => l.lockKey === lockKey);
      const existing = existingIdx >= 0 ? db.locks[existingIdx] : null;

      // If active and not expired
      if (existing && existing.expiresAt > now) {
        result = {
          success: false,
          reason: `Locked by owner '${existing.owner}' until ${new Date(existing.expiresAt).toISOString()}`
        };
        return;
      }

      const leaseId = `LEASE-${crypto.randomBytes(8).toString('hex')}`;
      const fencingToken = db.nextFencingToken();
      const version = existing ? existing.version + 1 : 1;

      const newLease: DistributedLockEntity = {
        id: lockKey,
        lockKey,
        leaseId,
        owner,
        acquiredAt: now,
        expiresAt: now + ttlMs,
        fencingToken,
        version
      };

      if (existingIdx >= 0) {
        db.locks[existingIdx] = newLease;
      } else {
        db.locks.push(newLease);
      }

      db.saveToDisk();
      result = {
        success: true,
        lease: JSON.parse(JSON.stringify(newLease))
      };
    });

    return result;
  }

  /**
   * Atomically releases a lock if the leaseId matches.
   */
  public async release(lockKey: string, leaseId: string): Promise<boolean> {
    let released = false;
    db.runInTransaction(() => {
      const idx = db.locks.findIndex(l => l.lockKey === lockKey);
      if (idx >= 0 && db.locks[idx].leaseId === leaseId) {
        db.locks.splice(idx, 1);
        db.saveToDisk();
        released = true;
      }
    });
    return released;
  }

  /**
   * Atomically extends/renews an active lease if caller holds the valid leaseId and it hasn't expired.
   */
  public async renew(lockKey: string, leaseId: string, extensionTtlMs: number = 10000): Promise<boolean> {
    const now = Date.now();
    let renewed = false;
    db.runInTransaction(() => {
      const idx = db.locks.findIndex(l => l.lockKey === lockKey);
      if (idx >= 0 && db.locks[idx].leaseId === leaseId) {
        if (db.locks[idx].expiresAt > now) {
          db.locks[idx].expiresAt = now + extensionTtlMs;
          db.locks[idx].version += 1;
          db.saveToDisk();
          renewed = true;
        }
      }
    });
    return renewed;
  }

  /**
   * Inspect current lock state for a given key.
   */
  public async getLock(lockKey: string): Promise<DistributedLockEntity | null> {
    const now = Date.now();
    const lock = db.locks.find(l => l.lockKey === lockKey);
    if (!lock) return null;
    if (lock.expiresAt <= now) {
      // Lazy cleanup
      this.cleanupExpired();
      return null;
    }
    return JSON.parse(JSON.stringify(lock));
  }
}

export const lockRepository = new DistributedLockRepository();
