import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useApiResource } from '../../src/hooks/useApiResource';
import { ApiError } from '../../src/services/apiError';
import { clearCache, writeCache } from '../../src/services/queryCache';

afterEach(() => {
  clearCache();
});

/** These three behaviours are the hook's reason to exist (see its docblock):
 * cancellation, 401-vs-network separation, and data retention on error. */
describe('useApiResource', () => {
  it('resolves to ready with data', async () => {
    const fetcher = vi.fn((_signal: AbortSignal) => Promise.resolve({ value: 42 }));
    const { result } = renderHook(() => useApiResource(fetcher));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBeNull();
    expect(result.current.requiresSignIn).toBe(false);
  });

  it('aborts the in-flight request on unmount instead of setState-after-unmount', async () => {
    let aborted = false;
    const fetcher = (signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

    const { unmount } = renderHook(() => useApiResource(fetcher));
    unmount();

    expect(aborted).toBe(true);
  });

  it('maps a 401 to requiresSignIn and not a generic error', async () => {
    const fetcher = vi.fn((_signal: AbortSignal) =>
      Promise.reject(new ApiError('Session expired', 401))
    );
    const { result } = renderHook(() => useApiResource(fetcher));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.requiresSignIn).toBe(true);
    expect(result.current.error).toBe('Session expired');
  });

  it('keeps previously loaded data when a later request fails', async () => {
    let call = 0;
    let rejectNext: ((e: unknown) => void) | null = null;
    const fetcher = vi.fn((_signal: AbortSignal) => {
      call++;
      if (call === 1) return Promise.resolve({ page: 1 });
      return new Promise((_resolve, reject) => {
        rejectNext = reject;
      });
    });

    const { result } = renderHook(() => useApiResource(fetcher));
    await waitFor(() => expect(result.current.data).toEqual({ page: 1 }));

    act(() => result.current.reload());
    await waitFor(() => expect(rejectNext).not.toBeNull());
    rejectNext!(new Error('network down'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toEqual({ page: 1 }); // not blanked
  });

  it('stays idle when enabled is false and starts when it flips true', async () => {
    const fetcher = vi.fn((_signal: AbortSignal) => Promise.resolve('x'));
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useApiResource(fetcher, { enabled }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.status).toBe('idle');
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('useApiResource cache path', () => {
  it('serves a fresh cache hit without calling the fetcher', async () => {
    writeCache('t.fresh', { value: 1 });
    const fetcher = vi.fn((_signal: AbortSignal) => Promise.resolve({ value: 2 }));
    const { result } = renderHook(() => useApiResource(fetcher, { cacheKey: 't.fresh', ttlMs: 60_000 }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual({ value: 1 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('serves a stale cache hit immediately and refreshes in the background', async () => {
    writeCache('t.stale', { value: 1 });
    const fetcher = vi.fn((_signal: AbortSignal) => Promise.resolve({ value: 2 }));
    const { result } = renderHook(() => useApiResource(fetcher, { cacheKey: 't.stale', ttlMs: -1 }));

    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));
    expect(result.current.status).toBe('ready'); // data shown, not a spinner
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.data).toEqual({ value: 2 }));
    expect(result.current.error).toBeNull(); // silent refresh, stale data stands
  });

  it('dedupes concurrent callers of the same key into one request', async () => {
    let calls = 0;
    const fetcher = vi.fn((_signal: AbortSignal) => {
      calls++;
      return new Promise(resolve => setTimeout(() => resolve({ n: calls }), 20));
    });

    const first = renderHook(() => useApiResource(fetcher, { cacheKey: 't.dedupe' }));
    const second = renderHook(() => useApiResource(fetcher, { cacheKey: 't.dedupe' }));

    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(calls).toBe(1);
    expect(first.result.current.data).toEqual({ n: 1 });
    expect(second.result.current.data).toEqual({ n: 1 });
    first.unmount();
    second.unmount();
  });

  it('reload() bypasses a fresh cache and refreshes the entry', async () => {
    writeCache('t.reload', { value: 1 });
    const fetcher = vi.fn((_signal: AbortSignal) => Promise.resolve({ value: 2 }));
    const { result } = renderHook(() => useApiResource(fetcher, { cacheKey: 't.reload' }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fetcher).not.toHaveBeenCalled();

    act(() => result.current.reload());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.data).toEqual({ value: 2 }));
  });
});
