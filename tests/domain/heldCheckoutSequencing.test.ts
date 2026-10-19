import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/services/apiError';
import {
  localCalendarDate,
  runHeldCheckout,
  type CheckoutLine,
  type HeldCheckoutDeps,
  type HeldCheckoutRequest,
} from '../../src/services/heldCheckout';
import { tripDayDate } from '../../src/services/plannerCheckout';

/**
 * Hold first, then pay. /api/commerce/checkout/multi settles only ACTIVE
 * holds the caller owns, matching SKU/trip/slot/party, at the catalogue
 * price. These tests drive runHeldCheckout against a fake API and check the
 * order of calls and what each call carries.
 */

const line = (over: Partial<CheckoutLine> = {}): CheckoutLine => ({
  serviceType: 'diving',
  skuId: 'SKU-DIV-001',
  scheduledDate: '2026-11-12',
  scheduledTime: '09:00 AM',
  passengersCount: 3,
  amountEGP: 3600,
  ...over,
});

const request = (lines: CheckoutLine[]): HeldCheckoutRequest => ({
  tripId: 'TRIP-REAL-1',
  traveler: { name: 'Mona', phone: '+20 100 000 0001', email: 'mona@example.test' },
  lines,
  payment: { provider: 'CASH_ON_ARRIVAL' },
  attemptKey: 'ATTEMPT-1',
});

const confirmed = { bookings: [{ id: 'B1', bookingRef: 'DHB-1', confirmationCode: 'C1', amountEGP: 3600, skuId: 'SKU-DIV-001' }], totalAmountEGP: 3600, paymentState: 'PENDING', transactionId: 'TXN-1' };

function fakeDeps(opts: { holdAmount?: (skuId: string, pax: number) => number; checkout?: HeldCheckoutDeps['completeMultiCheckout'] } = {}) {
  const calls: string[] = [];
  let n = 0;
  const deps: HeldCheckoutDeps = {
    createHold: vi.fn(async (p) => {
      calls.push(`hold:${p.skuId}`);
      n += 1;
      return { holdToken: `HOLD-${n}`, amountEGP: opts.holdAmount ? opts.holdAmount(p.skuId, p.passengersCount) : 1200 * p.passengersCount, expiresAt: '2099-01-01T00:00:00Z' };
    }),
    completeMultiCheckout: vi.fn(async (p) => {
      calls.push('checkout');
      return opts.checkout ? opts.checkout(p) : confirmed;
    }),
  };
  return { deps, calls };
}

describe('runHeldCheckout', () => {
  it('holds every line before the single checkout, and settles with each hold', async () => {
    const { deps, calls } = fakeDeps();
    const lines = [line(), line({ serviceType: 'safari', skuId: 'SKU-SAF-001', scheduledTime: '02:00 PM', amountEGP: 3600 })];
    const outcome = await runHeldCheckout(deps, request(lines));

    expect(calls).toEqual(['hold:SKU-DIV-001', 'hold:SKU-SAF-001', 'checkout']);
    expect(deps.createHold).toHaveBeenNthCalledWith(1, {
      skuId: 'SKU-DIV-001', tripId: 'TRIP-REAL-1', date: '2026-11-12', timeSlot: '09:00 AM', passengersCount: 3,
      idempotencyKey: 'ATTEMPT-1-HOLD-0-SKU-DIV-001',
    });
    const body = vi.mocked(deps.completeMultiCheckout).mock.calls[0][0];
    expect(body.tripId).toBe('TRIP-REAL-1');
    expect(body.items.map(i => [i.holdToken, i.passengersCount, i.scheduledDate, i.scheduledTime, i.amountEGP])).toEqual([
      ['HOLD-1', 3, '2026-11-12', '09:00 AM', 3600],
      ['HOLD-2', 3, '2026-11-12', '02:00 PM', 3600],
    ]);
    expect(body.paymentParams).toMatchObject({ idempotencyKey: 'ATTEMPT-1-PAY', provider: 'CASH_ON_ARRIVAL' });
    expect(outcome).toMatchObject({ kind: 'confirmed', tripId: 'TRIP-REAL-1' });
  });

  it('reuses a hold the caller already took instead of holding twice', async () => {
    const { deps, calls } = fakeDeps();
    const outcome = await runHeldCheckout(deps, request([line({ existingHold: { holdToken: 'HOLD-EARLIER', amountEGP: 3600 } })]));
    expect(calls).toEqual(['checkout']);
    expect(vi.mocked(deps.completeMultiCheckout).mock.calls[0][0].items[0].holdToken).toBe('HOLD-EARLIER');
    expect(outcome.kind).toBe('confirmed');
  });

  it('stops for re-confirmation when the hold costs more than was shown — nothing is paid', async () => {
    const { deps, calls } = fakeDeps({ holdAmount: () => 4500 });
    const outcome = await runHeldCheckout(deps, request([line()]));
    expect(calls).toEqual(['hold:SKU-DIV-001']);
    expect(outcome).toMatchObject({ kind: 'priceChanged', shownTotalEGP: 3600, currentTotalEGP: 4500 });

    // Confirming settles on the same hold at the held price, without re-holding.
    if (outcome.kind !== 'priceChanged') throw new Error('unreachable');
    const after = await runHeldCheckout(deps, request([line()]), { held: outcome.held, acceptCurrentPrice: true });
    expect(calls).toEqual(['hold:SKU-DIV-001', 'checkout']);
    expect(vi.mocked(deps.completeMultiCheckout).mock.calls[0][0].items[0]).toMatchObject({ holdToken: 'HOLD-1', amountEGP: 4500 });
    expect(after.kind).toBe('confirmed');
  });

  it('turns a server PRICE_CHANGED into a re-confirm on the same hold, then retries with the new amount', async () => {
    let attempts = 0;
    const { deps } = fakeDeps({
      checkout: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiError('price moved', 409, undefined, {
            code: 'PRICE_CHANGED',
            details: { skuId: 'SKU-DIV-001', quotedAmountEGP: 3600, currentAmountEGP: 3900 },
          });
        }
        return confirmed;
      },
    });
    const first = await runHeldCheckout(deps, request([line()]));
    expect(first).toMatchObject({ kind: 'priceChanged', shownTotalEGP: 3600, currentTotalEGP: 3900 });
    if (first.kind !== 'priceChanged') throw new Error('unreachable');
    expect(first.held[0].holdToken).toBe('HOLD-1');

    const second = await runHeldCheckout(deps, request([line()]), { held: first.held, acceptCurrentPrice: true });
    const retry = vi.mocked(deps.completeMultiCheckout).mock.calls[1][0];
    expect(retry.items[0]).toMatchObject({ holdToken: 'HOLD-1', amountEGP: 3900 });
    expect(retry.paymentParams.idempotencyKey).toBe('ATTEMPT-1-PAY');
    expect(deps.createHold).toHaveBeenCalledTimes(1);
    expect(second.kind).toBe('confirmed');
  });

  it('reports HOLD_EXPIRED as a re-hold, keeping nothing charged', async () => {
    const { deps } = fakeDeps({
      checkout: async () => {
        throw new ApiError('expired', 409, undefined, { code: 'HOLD_EXPIRED', details: { skuId: 'SKU-DIV-001' } });
      },
    });
    const outcome = await runHeldCheckout(deps, request([line()]));
    expect(outcome).toMatchObject({ kind: 'failed', issue: { code: 'HOLD_EXPIRED', recovery: 'rehold' } });
  });

  it('never calls checkout when a hold fails', async () => {
    const deps: HeldCheckoutDeps = {
      createHold: vi.fn(async () => {
        throw new ApiError('suspended', 409, undefined, { code: 'SUPPLIER_UNAVAILABLE', details: { supplierId: 'SUP-9', skuId: 'SKU-DIV-001' } });
      }),
      completeMultiCheckout: vi.fn(),
    };
    const outcome = await runHeldCheckout(deps, request([line()]));
    expect(deps.completeMultiCheckout).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ kind: 'failed', held: null, issue: { code: 'SUPPLIER_UNAVAILABLE', recovery: 'alternatives' } });
  });
});

describe('planner hold dates', () => {
  const now = new Date(2026, 9, 8, 12, 0); // 8 Oct 2026, local

  it('puts trip day N on start + N - 1', () => {
    expect(tripDayDate({ startDate: '2026-11-10' }, 1, now)).toBe('2026-11-10');
    expect(tripDayDate({ startDate: '2026-11-10' }, 3, now)).toBe('2026-11-12');
  });

  it('never holds in the past, and uses today without a trip start', () => {
    expect(tripDayDate({ startDate: '2026-01-01' }, 1, now)).toBe(localCalendarDate(0, now));
    expect(tripDayDate(null, 2, now)).toBe(localCalendarDate(1, now));
  });
});
