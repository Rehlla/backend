import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REAL_DATA_DIR = process.env.DAHAB_DATA_DIR;
const REAL_STORE = process.env.RATE_LIMIT_STORE;

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-ratelimit-'));
  process.env.DAHAB_DATA_DIR = dir;
  process.env.RATE_LIMIT_STORE = 'sqlite';
});

afterEach(async () => {
  const { closeRateLimitStore } = await import('../../server/middleware/rateLimitStore');
  closeRateLimitStore();
  if (REAL_DATA_DIR === undefined) delete process.env.DAHAB_DATA_DIR;
  else process.env.DAHAB_DATA_DIR = REAL_DATA_DIR;
  if (REAL_STORE === undefined) delete process.env.RATE_LIMIT_STORE;
  else process.env.RATE_LIMIT_STORE = REAL_STORE;
  fs.rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

import {
  sharedAcquire,
  sharedCollectGarbage,
  sharedStorePath,
} from '../../server/middleware/rateLimitStore';

describe('shared rate-limit store', () => {
  it('stays inert unless explicitly enabled', () => {
    delete process.env.RATE_LIMIT_STORE;
    expect(sharedAcquire('k', 60000, 1)).toBeNull();
    expect(sharedCollectGarbage()).toBe(0);
    process.env.RATE_LIMIT_STORE = 'sqlite';
  });

  it('allows up to max then denies within the window', () => {
    const key = `qa-${Date.now()}`;
    const first = sharedAcquire(key, 60000, 2)!;
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    const second = sharedAcquire(key, 60000, 2)!;
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    const third = sharedAcquire(key, 60000, 2)!;
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('resets when the window passes', () => {
    vi.useFakeTimers();
    const key = `qa-reset-${Date.now()}`;
    expect(sharedAcquire(key, 30, 1)!.allowed).toBe(true);
    expect(sharedAcquire(key, 30, 1)!.allowed).toBe(false);
    vi.advanceTimersByTime(50);
    expect(sharedAcquire(key, 30, 1)!.allowed).toBe(true);
    vi.useRealTimers();
  });

  it('isolates keys from each other', () => {
    const a = `qa-a-${Date.now()}`;
    const b = `qa-b-${Date.now()}`;
    expect(sharedAcquire(a, 60000, 1)!.allowed).toBe(true);
    expect(sharedAcquire(a, 60000, 1)!.allowed).toBe(false);
    expect(sharedAcquire(b, 60000, 1)!.allowed).toBe(true);
  });

  it('collects expired windows', () => {
    vi.useFakeTimers();
    const key = `qa-gc-${Date.now()}`;
    sharedAcquire(key, 30, 5);
    vi.advanceTimersByTime(50);
    expect(sharedCollectGarbage()).toBeGreaterThanOrEqual(1);
    expect(sharedAcquire(key, 30, 5)!.remaining).toBe(4);
    vi.useRealTimers();
  });

  it('fails open (null) rather than throwing when the store is broken', () => {
    // Point at a path that cannot host sqlite files.
    process.env.DAHAB_DATA_DIR = path.join(dir, 'missing-parent', 'nested');
    expect(sharedAcquire('k', 60000, 1)).toBeNull();
    expect(sharedCollectGarbage()).toBe(0);
  });

  it('keeps the store file inside the configured data dir', () => {
    expect(sharedStorePath().startsWith(path.resolve(dir))).toBe(true);
  });
});
