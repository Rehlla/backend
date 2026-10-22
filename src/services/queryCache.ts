/**
 * queryCache — tiny TTL cache + in-flight dedup for idempotent reads.
 *
 * Why this exists (measured, not imagined):
 *   - Several surfaces fetch the same catalogue endpoints concurrently
 *     (SearchDrawer and Explore both list places; navbar and footer both read
 *     CMS nav/site-info), so one navigation can fire the same GET twice.
 *   - Route views remount on every visit, so a repeated visit refetches data
 *     that did not change (catalogue, health, me).
 *   - The offline pack (blueprint P7) needs a read-through cache to work at
 *     all on Sinai bandwidth.
 *
 * Contract:
 *   - Read-through, not a request layer: callers keep their own fetch and
 *     error/abort semantics; this module only stores results, shares
 *     in-flight promises, and expires entries.
 *   - `dedupe` never re-runs a fetcher while an identical key is in flight.
 *   - `invalidateCache(prefix)` clears both store and in-flight for a prefix
 *     (auth mutations must invalidate 'auth.' so a login/logout re-reads).
 *   - TTL is checked at read time (readCache returns `stale` instead of
 *     evicting), so a stale entry can still serve while a refresh is in
 *     flight — the caller decides what stale means for its resource.
 */

interface CacheEntry {
  data: unknown;
  at: number;
}

const store = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Read a cached value. `ttlMs` decides freshness: a fresh entry is returned
 * with `stale: false`; an expired one is still returned (data to show while
 * refreshing) with `stale: true`. Returns null when nothing was cached.
 */
export function readCache<T>(key: string, ttlMs: number): { data: T; stale: boolean } | null {
  const entry = store.get(key);
  if (!entry) return null;
  return { data: entry.data as T, stale: Date.now() - entry.at > ttlMs };
}

/** Store a successful read result. */
export function writeCache(key: string, data: unknown): void {
  store.set(key, { data, at: Date.now() });
}

/**
 * Run `fetcher`, sharing the in-flight promise with every caller that asks
 * for the same key before it settles. The fetcher runs exactly once for N
 * concurrent callers of the same key.
 *
 * Abort-aware: when the shared flight rejects with an AbortError, a late
 * joiner does NOT inherit the cancellation — it starts a fresh flight bound
 * to its own signal. Without this, React StrictMode's mount/unmount/remount
 * poisons the second mount: it dedupes onto the first mount's signal-bound
 * fetch, the first cleanup aborts it, and the second mount renders its
 * fallback forever (this is what kept /about and /faq on "Page Not Found"
 * in dev while the API served 200).
 */
export function dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return (existing as Promise<T>).catch((err: any) => {
      if (err?.name !== 'AbortError') throw err;
      const current = inFlight.get(key);
      if (current && current !== existing) return current as Promise<T>;
      return dedupe(key, fetcher);
    });
  }
  const promise = fetcher().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** Drop cached and in-flight entries whose key starts with `prefix`. */
export function invalidateCache(prefix: string): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of [...inFlight.keys()]) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
}

/** Drop everything. Used by tests and by explicit user-visible refreshes. */
export function clearCache(): void {
  store.clear();
  inFlight.clear();
}

/** Diagnostic count of live entries (health/console/debug only). */
export function cacheSize(): number {
  return store.size;
}