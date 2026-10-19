import { describe, expect, it } from 'vitest';
import { readCache, writeCache, dedupe, invalidateCache, clearCache, cacheSize } from '../../src/services/queryCache';

describe('queryCache', () => {
  it('round-trips data and reports freshness by ttl', () => {
    writeCache('k', { n: 1 });

    expect(readCache('k', 60_000)).toEqual({ data: { n: 1 }, stale: false });
    // A negative ttl is always expired — deterministic staleness without sleeps.
    expect(readCache('k', -1)?.stale).toBe(true);

    clearCache();
    expect(readCache('k', 60_000)).toBeNull();
  });

  it('dedupes concurrent fetchers of the same key into one run', async () => {
    let calls = 0;
    const first = dedupe('d', async () => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'a';
    });
    const second = dedupe('d', async () => {
      calls++;
      return 'b';
    });

    expect(await Promise.all([first, second])).toEqual(['a', 'a']);
    expect(calls).toBe(1);

    // Once settled, the same key runs again for a new caller.
    const third = dedupe('d', async () => {
      calls++;
      return 'c';
    });
    expect(await third).toBe('c');
    expect(calls).toBe(2);
  });

  it('invalidates by prefix across store and in-flight', async () => {
    writeCache('auth.me', { u: 1 });
    writeCache('cms.nav', []);
    invalidateCache('auth.');

    expect(readCache('auth.me', 60_000)).toBeNull();
    expect(readCache('cms.nav', 60_000)).not.toBeNull();

    // In-flight work for the prefix is dropped too: a new caller re-runs.
    let calls = 0;
    const inflight = dedupe('auth.me', async () => {
      calls++;
      return 'x';
    });
    invalidateCache('auth.');
    const after = dedupe('auth.me', async () => {
      calls++;
      return 'y';
    });

    expect(await Promise.all([inflight, after])).toEqual(['x', 'y']);
    expect(calls).toBe(2);
  });

  it('retries with a fresh flight when the shared flight aborts', async () => {
    // React StrictMode mount/unmount/remount: the first mount's signal-bound
    // fetch is aborted by its own cleanup while the second mount is still
    // joining it via dedupe. The joiner must get a fresh run, not the
    // cancellation.
    let calls = 0;
    const abortErr = new DOMException('aborted', 'AbortError');
    const first = dedupe('a', async () => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 5));
      throw abortErr;
    });
    const second = dedupe('a', async () => {
      calls++;
      return 'recovered';
    });

    await expect(first).rejects.toBe(abortErr);
    await expect(second).resolves.toBe('recovered');
    expect(calls).toBe(2);
  });

  it('still shares non-abort rejections without re-running', async () => {
    let calls = 0;
    const failure = new Error('boom');
    const first = dedupe('e', async () => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 5));
      throw failure;
    });
    const second = dedupe('e', async () => {
      calls++;
      return 'never';
    });

    await expect(first).rejects.toBe(failure);
    await expect(second).rejects.toBe(failure);
    expect(calls).toBe(1);
  });

  it('cacheSize tracks live entries', () => {
    clearCache();
    writeCache('a', 1);
    writeCache('b', 2);
    expect(cacheSize()).toBe(2);
    clearCache();
    expect(cacheSize()).toBe(0);
  });
});