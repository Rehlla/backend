import { useCallback, useRef, useState } from 'react';
import { api } from '../services/api';
import {
  bookingsOff,
  getCachedRemoteConfig,
  paymentsOff,
} from '../services/remoteConfig';
import {
  newAttemptKey,
  runHeldCheckout,
  type HeldCheckoutDeps,
  type HeldCheckoutOutcome,
  type HeldCheckoutRequest,
} from '../services/heldCheckout';

export type HeldCheckoutPhase = 'idle' | 'working' | 'priceChanged' | 'failed' | 'confirmed';

export interface UseHeldCheckoutOptions {
  /** Called once per successful settlement, including after a re-confirmed price. */
  onConfirmed: (outcome: Extract<HeldCheckoutOutcome, { kind: 'confirmed' }>) => void;
  /** Prefix for fresh attempt keys on re-hold, e.g. 'BOOKNOW'. */
  keyPrefix: string;
  deps?: HeldCheckoutDeps;
}

/**
 * React state around runHeldCheckout: submit, re-confirm a changed price on the
 * same holds, or hold again after a hold expired. The screen renders
 * `outcome` (via CheckoutIssuePanel) whenever `phase` is priceChanged/failed.
 */
export function useHeldCheckout({ onConfirmed, keyPrefix, deps = api }: UseHeldCheckoutOptions) {
  const [phase, setPhase] = useState<HeldCheckoutPhase>('idle');
  const [outcome, setOutcome] = useState<HeldCheckoutOutcome | null>(null);
  const requestRef = useRef<HeldCheckoutRequest | null>(null);
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
  const busyRef = useRef(false);

  const run = useCallback(
    async (req: HeldCheckoutRequest, resume?: Parameters<typeof runHeldCheckout>[2]) => {
      if (busyRef.current) return null;
      // Client-side remote-config gate (GET /api/config): when the desk froze
      // holds/bookings or payments, stop before taking holds or card details —
      // the server would 503 the same calls. The cache answers instantly;
      // a missing cache means "not yet fetched", never "switched off".
      const cached = getCachedRemoteConfig();
      if (cached && (bookingsOff(cached) || paymentsOff(cached))) {
        const blocked = {
          kind: 'failed',
          issue: {
            code: 'KILL_SWITCH',
            messageKey: 'checkout.error.killSwitch',
            recovery: 'retry',
            details: {},
          },
          held: null,
        } as const;
        setOutcome(blocked);
        setPhase('failed');
        return blocked;
      }
      busyRef.current = true;
      requestRef.current = req;
      setPhase('working');
      try {
        const next = await runHeldCheckout(deps, req, resume);
        setOutcome(next);
        setPhase(next.kind);
        if (next.kind === 'confirmed') onConfirmedRef.current(next);
        return next;
      } finally {
        busyRef.current = false;
      }
    },
    [deps]
  );

  const submit = useCallback((req: HeldCheckoutRequest) => run(req), [run]);

  /** The traveller accepted the new price: settle on the same holds. */
  const confirmPrice = useCallback(() => {
    if (!requestRef.current || outcome?.kind !== 'priceChanged') return Promise.resolve(null);
    return run(requestRef.current, { held: outcome.held, acceptCurrentPrice: true });
  }, [outcome, run]);

  /** The holds are gone (expired / mismatched): take fresh ones under a new key. */
  const rehold = useCallback(() => {
    const req = requestRef.current;
    if (!req) return Promise.resolve(null);
    return run({
      ...req,
      attemptKey: newAttemptKey(keyPrefix),
      lines: req.lines.map(({ existingHold: _dropped, ...line }) => line),
    });
  }, [keyPrefix, run]);

  const reset = useCallback(() => {
    setPhase('idle');
    setOutcome(null);
  }, []);

  return {
    phase,
    outcome,
    busy: phase === 'working',
    /** The request currently in flight or last run — e.g. to look up alternatives. */
    lastRequest: requestRef.current,
    submit,
    confirmPrice,
    rehold,
    reset,
  };
}
