import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/db/database';
import { paymentService, PaymentService } from '../../server/services/paymentService';
import { commerceService } from '../../server/services/commerceService';
import { heldItem, resetDb, seedSku, seedTrip, nextIdempotencyKey } from '../helpers/fixtures';

// Each checkout holds its own slot: the reference test books 200 times, far
// past one slot's capacity.
let slotSeq = 0;

/**
 * Payment settlement and webhook trust — CRIT-5 and CRIT-7.
 *
 * processCheckout never contacts a gateway: it marks the payment CAPTURED and
 * writes ledger entries, so a "successful" checkout collects no money while
 * issuing a real voucher and dispatching a real SMS to a driver. It must
 * therefore be impossible to run in production by accident.
 *
 * Separately, webhook verification used to fall back to a hardcoded secret
 * committed to this repository, which meant anyone who could read the source
 * could forge a signed "payment succeeded" callback.
 */

const checkout = (over: Record<string, unknown> = {}) =>
  commerceService.completeMultiServiceCheckout({
    tripId: 'TRIP-TEST',
    travelerUserId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+201000000000',
    travelerEmail: 'traveler@example.test',
    items: [heldItem({ time: `SLOT-${++slotSeq}` })],
    paymentParams: { idempotencyKey: nextIdempotencyKey() },
    ...over
  });

describe('simulated settlement gating', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOverride = process.env.ALLOW_SIMULATED_PAYMENTS;

  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalOverride === undefined) delete process.env.ALLOW_SIMULATED_PAYMENTS;
    else process.env.ALLOW_SIMULATED_PAYMENTS = originalOverride;
  });

  it('refuses to settle in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_SIMULATED_PAYMENTS;
    expect(PaymentService.simulationAllowed()).toBe(false);

    let status: number | undefined;
    let message = '';
    try {
      paymentService.processCheckout({ idempotencyKey: nextIdempotencyKey(), tripId: 'TRIP-TEST', amountEGP: 1200 });
    } catch (e) {
      status = (e as Error & { status?: number }).status;
      message = (e as Error).message;
    }
    expect(status).toBe(503);
    expect(message).toMatch(/not configured|unavailable/i);
    expect(db.payments).toHaveLength(0);
  });

  it('takes no money and writes no ledger entry when it refuses', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_SIMULATED_PAYMENTS;
    expect(() => checkout()).toThrow();
    expect(db.bookings).toHaveLength(0);
    expect(db.ledgerEntries).toHaveLength(0);
  });

  it('runs in production only behind an explicit override', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
    expect(PaymentService.simulationAllowed()).toBe(true);
  });

  it('marks what it produced as simulated rather than settled', () => {
    const { payment } = paymentService.processCheckout({
      idempotencyKey: nextIdempotencyKey(), tripId: 'TRIP-TEST', amountEGP: 1200
    });
    expect(payment.simulated).toBe(true);
  });

  it('never persists a full PAN — only the last four digits are in the contract', () => {
    const { payment } = paymentService.processCheckout({
      idempotencyKey: nextIdempotencyKey(), tripId: 'TRIP-TEST', amountEGP: 1200, cardLast4: '4242'
    });
    // Assert on the stored record's shape, not on a digit-count regex over the
    // whole object: ids embed a millisecond timestamp, which is itself 13 digits.
    const cardFields = Object.keys(payment).filter(k => /card|pan|cvv|cvc|expiry|expiration/i.test(k));
    expect(cardFields.sort()).toEqual(['cardBrand', 'cardLast4']);
    expect(payment.cardLast4).toBe('4242');
    expect(String(payment.cardLast4)).toHaveLength(4);
  });
});

describe('paymob webhook verification', () => {
  const payload = { id: 1, amount_cents: 120000, success: true, order: { id: 9 } };

  it('rejects every webhook when no secret is configured, instead of using a built-in one', () => {
    expect(process.env.PAYMOB_HMAC_SECRET).toBeUndefined();
    expect(paymentService.verifyPaymobWebhookHmac(payload, 'anything')).toBe(false);
  });

  it('refuses to compute a signature without a secret rather than returning a guessable one', () => {
    expect(() => paymentService.calculatePaymobWebhookHmac(payload)).toThrow(/PAYMOB_HMAC_SECRET/);
  });

  it('rejects a signature computed with the old hardcoded fallback secret', () => {
    const forged = paymentService.calculatePaymobWebhookHmac(payload, 'dahab_paymob_hmac_secret_2026_prod');
    expect(paymentService.verifyPaymobWebhookHmac(payload, forged)).toBe(false);
  });
});

describe('booking references', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('issues a unique reference per booking', () => {
    const refs = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const result = checkout();
      result.bookings.forEach(b => refs.add(b.bookingRef));
    }
    // The old scheme had 900 possible refs per service type; 200 draws from it
    // collide with near-certainty. This asserts the property, not the format.
    expect(refs.size).toBe(200);
  });

  it('uses the reference as the booking id, so a collision would return the wrong booking', () => {
    const { bookings } = checkout();
    const ref = bookings[0].bookingRef;
    expect(bookings[0].id).toBe(ref);
    expect(db.bookings.filter(b => b.id === ref)).toHaveLength(1);
  });

  it('is idempotent: replaying a payment key does not charge or book twice', () => {
    const key = nextIdempotencyKey();
    checkout({ paymentParams: { idempotencyKey: key } });
    const paymentsAfterFirst = db.payments.length;
    checkout({ paymentParams: { idempotencyKey: key } });
    expect(db.payments).toHaveLength(paymentsAfterFirst);
  });
});
