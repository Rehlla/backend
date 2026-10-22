import { useEffect, useMemo, useState } from 'react';
import {
  checkInTimeFor,
  minutesBetween,
  progressPercent,
  DEFAULT_CHECK_IN_HOUR
} from '../utils/arrivalTime';

const ARRIVED_AT_KEY = 'dahab_arrived_at';

/**
 * When this traveler landed in Dahab.
 *
 * There is no structured arrival timestamp anywhere in the platform, so the
 * best available signal is the first moment they opened an arrival page. It is
 * kept in sessionStorage — the same place BookingTransferStep keeps its hold —
 * so the timeline does not jump every time they move between /arrive and
 * /first-two-hours, and resets naturally with a new session.
 *
 * Storage can throw outright in a private window, so every access is guarded
 * and falls back to "now", which is correct if slightly less stable.
 */
function readOrStampArrival(now: Date): Date {
  try {
    const stored = sessionStorage.getItem(ARRIVED_AT_KEY);
    if (stored) {
      const parsed = new Date(stored);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    sessionStorage.setItem(ARRIVED_AT_KEY, now.toISOString());
  } catch {
    // No session storage available; the arrival moment is simply this render.
  }
  return now;
}

export interface ArrivalClock {
  /** Ticks once a minute, on the minute. */
  now: Date;
  arrivedAt: Date;
  checkInAt: Date;
  /** Midpoint of the wait — the "transition" marker on the timeline. */
  transitionAt: Date;
  minutesUntilCheckIn: number;
  /** True once check-in time has passed, so the UI can stop counting down. */
  checkInReached: boolean;
  /** 0–100, clamped. */
  waitProgress: number;
}

/**
 * A live clock for the arrival pages.
 *
 * Ticks on the minute rather than on a short interval: the audit found 36
 * timers across 26 files, one of them setting state 20 times a second on the
 * homepage. A minute is the resolution actually displayed here.
 */
export function useArrivalClock(checkInHour: number = DEFAULT_CHECK_IN_HOUR): ArrivalClock {
  const [now, setNow] = useState(() => new Date());
  const [arrivedAt] = useState(() => readOrStampArrival(new Date()));

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    const checkInAt = checkInTimeFor(now, checkInHour);
    const minutesUntilCheckIn = minutesBetween(now, checkInAt);
    return {
      now,
      arrivedAt,
      checkInAt,
      transitionAt: new Date(arrivedAt.getTime() + (checkInAt.getTime() - arrivedAt.getTime()) / 2),
      minutesUntilCheckIn,
      checkInReached: minutesUntilCheckIn <= 0,
      waitProgress: progressPercent(arrivedAt, checkInAt, now)
    };
  }, [now, arrivedAt, checkInHour]);
}
