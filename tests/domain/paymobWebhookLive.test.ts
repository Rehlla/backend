import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { paymentService } from '../../server/services/paymentService';
import { commerceService } from '../../server/services/commerceService';
import { heldItem, resetDb, seedSku, seedTrip, nextIdempotencyKey } from '../helpers/fixtures';

/**
 * Paymob webhook end-to-end: signed acceptance, tamper rejection, replay
 * idempotency, and failure transitions.
 *
 * Runs ONLY with an explicit secret — the secret is read at module load, so
 * stubbing process.env mid-file cannot enable it, and setting it globally
 * would break the fail-closed tests in payments.test.ts. Run standalone:
 *
 *   PAYMOB_HMAC_SECRET=test-secret-xyz npx vitest run tests/domain/paymobWebhookLive.test.ts
 *
 * Never point this at a real Paymob secret: the signed fixtures below would
 * then be indistinguishable from forged callbacks in logs.
 */
const LIVE_SECRET = process.env.PAYMOB_HMAC_SECRET || '';
const describeLive = LIVE_SECRET ? describe : describe.skip;

const checkout = (over: Record<string, unknown> = {}) =>
  commerceService.completeMultiServiceCheckout({
    tripId: 'TRIP-TEST',
    travelerUserId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+201000000000',
    travelerEmail: 'traveler@example.test',
    items: [heldItem()],
    paymentParams: { idempotencyKey: nextIdempotencyKey() },
    ...over
  });

const successPayload = (id: number, txn: string) => ({
  id,
  transaction_id: txn,
  amount_cents: 120000,
  created_at: '2026-09-10T08:00:00Z',
  currency: 'EGP',
  error_occured: false,
  has_parent_transaction: false,
  integration_id: 123,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: false,
  is_voided: false,
  order: { id: 9 },
  owner: 321,
  pending: false,
  source_data: { pan: '512345', sub_type: 'Mastercard', type: 'card' },
  success: true,
});

describeLive('paymob webhook end-to-end (LIVE_SECRET set)', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('accepts a correctly signed success callback for a real payment', () => {
    checkout();
    const payment = db.payments[db.payments.length - 1];
    const payload = successPayload(1001, payment.transactionId);
    const hmac = paymentService.calculatePaymobWebhookHmac(payload);
    expect(paymentService.verifyPaymobWebhookHmac(payload, hmac)).toBe(true);
    const result = paymentService.handleWebhook(payload, hmac);
    expect(result.success).toBe(true);
    expect(db.payments.find(p => p.id === payment.id)!.state).toBe('CAPTURED');
  });

  it('rejects a tampered payload even with a valid-looking signature shape', () => {
    checkout();
    const payment = db.payments[db.payments.length - 1];
    const payload = successPayload(1002, payment.transactionId);
    const hmac = paymentService.calculatePaymobWebhookHmac(payload);
    const tampered = { ...payload, amount_cents: 100 };
    expect(paymentService.verifyPaymobWebhookHmac(tampered, hmac)).toBe(false);
    const result = paymentService.handleWebhook(tampered, hmac);
    expect(result.success).toBe(false);
  });

  it('ignores duplicate deliveries of the same event (idempotent replay)', () => {
    checkout();
    const payment = db.payments[db.payments.length - 1];
    const payload = successPayload(1003, payment.transactionId);
    const hmac = paymentService.calculatePaymobWebhookHmac(payload);
    const first = paymentService.handleWebhook(payload, hmac);
    const eventsAfterFirst = db.payments.find(p => p.id === payment.id)!.webhookEvents.length;
    const second = paymentService.handleWebhook(payload, hmac);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.message).toMatch(/uplicate|idempotent/i);
    // The replay changes nothing: no second event row, no state churn.
    expect(db.payments.find(p => p.id === payment.id)!.webhookEvents).toHaveLength(eventsAfterFirst);
  });

  it('transitions a payment to FAILED on a signed failure callback', () => {
    checkout();
    const payment = db.payments[db.payments.length - 1];
    const payload = { ...successPayload(1004, payment.transactionId), success: false };
    const hmac = paymentService.calculatePaymobWebhookHmac(payload);
    const result = paymentService.handleWebhook(payload, hmac);
    expect(result.success).toBe(true);
    expect(db.payments.find(p => p.id === payment.id)!.state).toBe('FAILED');
  });

  it('drops unsigned callbacks even with a configured secret', () => {
    checkout();
    const payment = db.payments[db.payments.length - 1];
    const payload = successPayload(1005, payment.transactionId);
    const result = paymentService.handleWebhook(payload, undefined);
    expect(result.success).toBe(false);
  });
});
