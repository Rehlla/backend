import Database from 'better-sqlite3';
import path from 'path';
import { dataDir } from '../db/paths';

/**
 * Shared rate-limit buckets for multi-process deployments.
 *
 * The middleware's in-memory Map is correct on one replica and fiction on
 * two: each process counts only its own requests, so limits are neither
 * enforced nor consistent. This store keeps fixed-window counters in a tiny
 * dedicated SQLite file (same disk as the main store, WAL mode) so every
 * process on the machine shares one truth. Cross-machine still needs Redis —
 * see the returned `shared: false` contract below.
 *
 * Failure policy is fail-OPEN with a memory fallback: a rate limiter that
 * 500s when its store hiccups turns a hiccup into a self-inflicted outage,
 * while briefly under-counting only weakens abuse protection.
 */

export interface SharedVerdict {
  allowed: boolean;
  remaining: number;
  resetSec: number;
}

// One connection per database path (tests point DAHAB_DATA_DIR at temp dirs).
const connections = new Map<string, Database.Database>();

function storePath(): string {
  // dataDir() (not the DATA_DIR const) so tests and tooling can repoint the
  // store per call via DAHAB_DATA_DIR.
  return path.join(dataDir(), 'ratelimit.sqlite');
}

function connect(): Database.Database | null {
  if (process.env.RATE_LIMIT_STORE !== 'sqlite') return null;
  const file = storePath();
  try {
    const existing = connections.get(file);
    if (existing) return existing;
    const sqlite = new Database(file);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 2000');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_windows (
        key TEXT PRIMARY KEY NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        reset_at INTEGER NOT NULL DEFAULT 0
      )
    `);
    connections.set(file, sqlite);
    return sqlite;
  } catch {
    return null;
  }
}

/** Test hook: close cached connections (temp-dir isolation between tests). */
export function closeRateLimitStore(): void {
  for (const sqlite of connections.values()) {
    try { sqlite.close(); } catch { /* already closed */ }
  }
  connections.clear();
}

/**
 * Atomically consume one request from the window. Returns null when the
 * shared store is not configured or unavailable — the caller must fall back
 * to the in-memory limiter rather than fail the request.
 */
export function sharedAcquire(key: string, windowMs: number, maxRequests: number): SharedVerdict | null {
  const sqlite = connect();
  if (!sqlite) return null;
  const now = Date.now();
  try {
    const txn = sqlite.transaction(() => {
      const row = sqlite
        .prepare('SELECT count, reset_at AS resetAt FROM rate_limit_windows WHERE key = ?')
        .get(key) as { count: number; resetAt: number } | undefined;
      if (!row || now > row.resetAt) {
        const resetAt = now + windowMs;
        sqlite
          .prepare('INSERT INTO rate_limit_windows (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at')
          .run(key, resetAt);
        return { allowed: true, remaining: maxRequests - 1, resetSec: Math.ceil(resetAt / 1000) };
      }
      if (row.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetSec: Math.ceil(row.resetAt / 1000) };
      }
      sqlite.prepare('UPDATE rate_limit_windows SET count = count + 1 WHERE key = ?').run(key);
      return { allowed: true, remaining: maxRequests - (row.count + 1), resetSec: Math.ceil(row.resetAt / 1000) };
    });
    return txn();
  } catch {
    // Fail-open: a storage error must not become a 500 for legitimate traffic.
    // The caller (rateLimiter) will fall back to its in-memory limiter instead.
    return null;
  }
}

/** Delete expired windows. Returns rows removed. Runs opportunistically. */
export function sharedCollectGarbage(): number {
  const sqlite = connect();
  if (!sqlite) return 0;
  try {
    const result = sqlite.prepare('DELETE FROM rate_limit_windows WHERE reset_at < ?').run(Date.now());
    return Number(result.changes || 0);
  } catch {
    return 0;
  }
}

export function sharedStorePath(): string {
  return path.resolve(storePath());
}
