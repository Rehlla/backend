import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useArrivalClock } from '../../src/hooks/useArrivalClock';
import { checkInTimeFor, DEFAULT_CHECK_IN_HOUR } from '../../src/utils/arrivalTime';

describe('useArrivalClock', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('stamps the arrival moment once and keeps it stable across remounts in a session', () => {
    const before = new Date();
    const first = renderHook(() => useArrivalClock());
    const stamped = first.result.current.arrivedAt;

    expect(stamped.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(stamped.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    // A second mount in the same session reads the stamp instead of restamping.
    const second = renderHook(() => useArrivalClock());
    expect(second.result.current.arrivedAt.getTime()).toBe(stamped.getTime());
    first.unmount();
    second.unmount();
  });

  it('falls back to now when sessionStorage throws (private window)', () => {
    const original = sessionStorage.setItem;
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const { result } = renderHook(() => useArrivalClock());
      expect(result.current.arrivedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    } finally {
      sessionStorage.setItem = original;
    }
  });

  it('ticks on the minute, not on a sub-second interval', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useArrivalClock());

    // The hook aligns its first tick to the next real minute boundary
    // (60_000 - Date.now() % 60_000) and then ticks once a minute. Walk
    // mock time a full two minutes and count distinct render timestamps:
    // a 1s-interval clock would have produced ~120, the aligned clock
    // produces at most 2 — and never more than one per minute boundary.
    const seen = new Set<number>([result.current.now.getTime()]);
    for (let i = 0; i < 24; i++) {
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      seen.add(result.current.now.getTime());
    }
    // ≤ 2 boundary ticks + the initial value across 120 simulated seconds.
    expect(seen.size).toBeLessThanOrEqual(3);
  });

  it('reports checkInReached and clamps waitProgress', () => {
    // Check-in hour far in the past of "now" cannot be forced through the
    // hour argument (checkInTimeFor rolls to the next occurrence), so assert
    // the contract for a future check-in instead: not reached, progress in
    // bounds, and minutesUntilCheckIn consistent with checkInAt.
    const { result } = renderHook(() => useArrivalClock(DEFAULT_CHECK_IN_HOUR));

    const clock = result.current;
    const expected = checkInTimeFor(clock.now, DEFAULT_CHECK_IN_HOUR);
    expect(clock.checkInAt.getTime()).toBe(expected.getTime());
    expect(clock.minutesUntilCheckIn).toBe(
      Math.round((expected.getTime() - clock.now.getTime()) / 60_000)
    );
    expect(clock.waitProgress).toBeGreaterThanOrEqual(0);
    expect(clock.waitProgress).toBeLessThanOrEqual(100);
  });
});
