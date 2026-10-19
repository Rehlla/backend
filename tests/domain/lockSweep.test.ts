import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DistributedLockService } from '../../server/services/distributedLockService';

/**
 * data/locks accumulated 75 files from processes that had exited hours before.
 *
 * The in-memory GC dropped the expired rows from db.locks every 5 seconds but
 * never touched the files mirroring them, and tryAcquire only reclaims a stale
 * file when the SAME key is acquired again. Many keys are used exactly once —
 * the swarm slots are `lock:swarm:slot:<timestamp>` — so those files were never
 * revisited by anything.
 *
 * Every instance here gets its own temp directory: the sweep deletes files, and
 * pointing it at the real data/locks would be deleting the locks of whatever
 * server happens to be running.
 */

let locksDir: string;
let service: DistributedLockService;

const lockFileFor = (lockKey: string) =>
  path.join(locksDir, `${crypto.createHash('sha256').update(lockKey).digest('hex')}.lock`);

/** Writes a lock file directly, bypassing acquire, so expiry can be dictated. */
const writeLockFile = (lockKey: string, expiresAt: number) => {
  const file = lockFileFor(lockKey);
  fs.writeFileSync(
    file,
    JSON.stringify({
      id: lockKey,
      lockKey,
      leaseId: 'LEASE-test',
      owner: 'test-owner',
      acquiredAt: expiresAt - 10_000,
      expiresAt,
      fencingToken: 1,
      version: 1
    }),
    'utf-8'
  );
  return file;
};

beforeEach(() => {
  locksDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-locks-'));
  service = DistributedLockService.createInstance('sweep-test', locksDir);
});

afterEach(() => {
  fs.rmSync(locksDir, { recursive: true, force: true });
});

describe('stale lock file sweep', () => {
  it('removes a lock file whose lease has expired', () => {
    const file = writeLockFile('lock:swarm:slot:1787948973767', Date.now() - 60_000);

    expect(service.sweepExpiredLockFiles()).toBe(1);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('leaves a live lease alone, because that file IS the lock', () => {
    const file = writeLockFile('lock:booking:active', Date.now() + 60_000);

    expect(service.sweepExpiredLockFiles()).toBe(0);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('does not delete an empty file from an acquire still in flight', () => {
    // tryAcquire opens the file with 'wx' and writes the lease a moment later.
    // Deleting inside that window would hand the same lock to two owners.
    const file = path.join(locksDir, 'aaaa.lock');
    fs.writeFileSync(file, '', 'utf-8');

    expect(service.sweepExpiredLockFiles()).toBe(0);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('removes an unreadable file once it is older than the grace period', () => {
    const file = path.join(locksDir, 'bbbb.lock');
    fs.writeFileSync(file, 'not json{', 'utf-8');
    const old = Date.now() - 10 * 60_000;
    fs.utimesSync(file, new Date(old), new Date(old));

    expect(service.sweepExpiredLockFiles()).toBe(1);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('ignores files that are not locks', () => {
    const keep = path.join(locksDir, 'README.txt');
    fs.writeFileSync(keep, 'not a lock', 'utf-8');

    expect(service.sweepExpiredLockFiles()).toBe(0);
    expect(fs.existsSync(keep)).toBe(true);
  });

  it('sweeps a backlog on construction, so a crashed run does not leak forever', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-locks-boot-'));
    const expired = Date.now() - 60_000;
    for (let i = 0; i < 20; i++) {
      const key = `lock:swarm:slot:${i}`;
      const file = path.join(dir, `${crypto.createHash('sha256').update(key).digest('hex')}.lock`);
      fs.writeFileSync(file, JSON.stringify({ lockKey: key, expiresAt: expired }), 'utf-8');
    }
    expect(fs.readdirSync(dir)).toHaveLength(20);

    DistributedLockService.createInstance('boot-test', dir);

    expect(fs.readdirSync(dir)).toHaveLength(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not reclaim a live lock that a real acquire is holding', () => {
    const lease = service.tryAcquire('lock:real:acquire', 60_000);
    expect(lease).not.toBeNull();

    expect(service.sweepExpiredLockFiles()).toBe(0);
    expect(fs.existsSync(lockFileFor('lock:real:acquire'))).toBe(true);
  });
});
