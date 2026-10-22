import React, { useEffect, useRef, useState } from 'react';
import { Clock, TimerOff } from 'lucide-react';
import { analytics } from '../../services/analytics';

/**
 * HoldCountdown — P4 booking-trust.
 *
 * The backend holds real inventory for 15 minutes (HOLD_TTL_MINUTES in
 * server/services/commerceService.ts) and returns `expiresAt`. Until this
 * component existed, that deadline lived only in sessionStorage — the
 * traveler was never told their seat was expiring. This renders the truth:
 * a live MM:SS countdown, an urgency color shift near the end, and an
 * honest expired state that tells the traveler to re-select.
 *
 * The clock is clock-drift-safe against the traveler's device only insofar
 * as the server timestamp is parsed as-is; remaining time is computed from
 * Date.now() vs expiresAt, so a device clock far in the future shows an
 * expired hold — the safe direction (never promising time that isn't there).
 */

interface HoldCountdownProps {
  /** ISO timestamp from the hold response. */
  expiresAt: string;
  /** Called once when the countdown reaches zero. */
  onExpire?: () => void;
  isRTL?: boolean;
  /** Compact variant for sidebars. */
  compact?: boolean;
}

function formatRemaining(ms: number): { mm: string; ss: string } {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return { mm, ss };
}

export const HoldCountdown: React.FC<HoldCountdownProps> = ({
  expiresAt,
  onExpire,
  isRTL = false,
  compact = false,
}) => {
  const expiresMs = useRef(new Date(expiresAt).getTime());
  const [remainingMs, setRemainingMs] = useState(() => expiresMs.current - Date.now());
  const [expired, setExpired] = useState(() => expiresMs.current - Date.now() <= 0);
  const firedExpireRef = useRef(false);
  const viewedTrackedRef = useRef(false);

  useEffect(() => {
    // One analytics beat per mount: this capability's funnel evidence.
    if (!viewedTrackedRef.current && !expired) {
      viewedTrackedRef.current = true;
      analytics.track('hold_countdown_viewed', {
        metadata: { expiresAt },
      });
    }

    if (expired) return;

    const tick = () => {
      const remaining = expiresMs.current - Date.now();
      if (remaining <= 0) {
        setRemainingMs(0);
        setExpired(true);
        return;
      }
      setRemainingMs(remaining);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, expired]);

  useEffect(() => {
    if (expired && !firedExpireRef.current) {
      firedExpireRef.current = true;
      analytics.track('hold_expired', {
        metadata: { expiresAt },
      });
      onExpire?.();
    }
  }, [expired, expiresAt, onExpire]);

  if (expired) {
    return (
      <div
        role="status"
        className={`flex items-center gap-2.5 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <TimerOff className="w-4 h-4 text-rose-700 flex-shrink-0" aria-hidden="true" />
        <span className="font-bold text-rose-900">
          {isRTL
            ? 'انتهت مدة الحجز المؤقت — اختار تاني عشان نحجزلك المقعد من جديد.'
            : 'Your seat hold has expired — choose again and we will re-hold it.'}
        </span>
      </div>
    );
  }

  const { mm, ss } = formatRemaining(remainingMs);
  const minutesLeft = remainingMs / 60000;
  const urgencyClass =
    minutesLeft < 2
      ? 'border-rose-300 bg-rose-50 text-rose-900'
      : minutesLeft < 5
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-emerald-300 bg-emerald-50 text-emerald-900';
  const ariaLive = minutesLeft < 5 ? 'assertive' : 'polite';

  return (
    <div
      role="timer"
      aria-live={ariaLive}
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${urgencyClass} ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <Clock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span className="font-bold tabular-nums">
        {mm}:{ss}
      </span>
      <span className="font-semibold opacity-90">
        {isRTL ? 'المقعد محجوز ليك مؤقتاً — كمّل الدفع قبل انتهاء العد' : 'Your seat is held — complete payment before the countdown ends'}
      </span>
    </div>
  );
};

export default HoldCountdown;
