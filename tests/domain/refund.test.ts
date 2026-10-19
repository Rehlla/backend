import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { paymentService } from '../../server/services/paymentService';
import { ledgerService } from '../../server/services/ledgerService';
import { resetDb, nextIdempotencyKey } from '../helpers/fixtures';

/**
 * Refund limits.
 *
 * processRefund had no cap at all: it debited PLATFORM_ESCROW_MAIN for whatever
 * amount it was handed, with no check that the money had ever been collected.
 * The handler above it computed that amount as `Number(req.body.amountEGP)`, so
 * an absent field became **NaN** and a NaN ledger row.
 *
 * The CRIT-12 escrow-overdraft check catches the consequence after the fact;
 * these assert it cannot be written in the first place.
 */

const capture = (amountEGP: number, tripId = 'TRIP-REFUND') =>
  paymentService.processCheckout({
    idempotencyKey: nextIdempotencyKey(),
    tripId,
    amountEGP,
    bookingId: 'BK-REFUND-1'
  });

const refund = (amountEGP: unknown, tripId = 'TRIP-REFUND') =>
  paymentService.processRefund({
    tripId,
    amountEGP: amountEGP as number,
    reason: 'test',
    idempotencyKey: nextIdempotencyKey()
  });

describe('refund limits', () => {
  beforeEach(resetDb);

  it('allows a refund up to what was captured', () => {
    capture(1000);
    const result = refund(1000);
    expect(result.amountEGP).toBe(1000);
    expect(result.status).toBe('SETTLED');
  });

  it('allows a partial refund', () => {
    capture(1000);
    expect(refund(250).amountEGP).toBe(250);
    expect(paymentService.refundableAmountEGP({ tripId: 'TRIP-REFUND' })).toBe(750);
  });

  it('refuses to refund more than was captured', () => {
    capture(1000);
    expect(() => refund(1001)).toThrow(/exceeds what was captured/);
  });

  it('refuses a second refund that would exceed the total together', () => {
    capture(1000);
    refund(600);
    expect(() => refund(600)).toThrow(/exceeds what was captured/);
    expect(refund(400).amountEGP).toBe(400);
  });

  it('refuses any refund when nothing was ever captured', () => {
    // The audit's scenario: an arbitrary refund against a trip that never paid.
    expect(() => refund(5000, 'TRIP-NEVER-PAID')).toThrow(/exceeds what was captured/);
  });

  it('refuses NaN, which is what an absent amount used to become', () => {
    capture(1000);
    expect(() => refund(Number(undefined))).toThrow(/positive number/);
    expect(() => refund(Number('not a number'))).toThrow(/positive number/);
  });

  it('refuses zero and negative amounts', () => {
    capture(1000);
    expect(() => refund(0)).toThrow(/positive number/);
    expect(() => refund(-500)).toThrow(/positive number/);
  });

  it('writes nothing to the ledger when it refuses', () => {
    capture(1000);
    const before = db.ledgerEntries.length;
    expect(() => refund(999999)).toThrow();
    expect(() => refund(Number(undefined))).toThrow();
    expect(db.ledgerEntries).toHaveLength(before);
  });

  it('leaves the escrow account solvent after a full refund', () => {
    capture(1000);
    refund(1000);
    const result = ledgerService.verifyLedgerIntegrity();
    expect(result.escrowBalanceEGP).toBeGreaterThanOrEqual(0);
    expect(result.integrityFailures).toEqual([]);
  });

  it('reports nothing refundable for a trip with no payments', () => {
    expect(paymentService.refundableAmountEGP({ tripId: 'TRIP-EMPTY' })).toBe(0);
  });

  it('returns the platform commission to escrow, not just the traveler amount', () => {
    // Capture writes the full amount into escrow and immediately moves 15% out
    // to PLATFORM_REVENUE_COMMISSIONS. Refunding without reversing that left
    // escrow short by exactly the fee: the platform kept its cut on money it
    // had given back.
    capture(1000);
    const afterCapture = ledgerService.verifyLedgerIntegrity().accountBalancesEGP;
    expect(afterCapture['PLATFORM_ESCROW_MAIN']).toBe(850);
    expect(afterCapture['PLATFORM_REVENUE_COMMISSIONS']).toBe(150);

    refund(1000);
    const afterRefund = ledgerService.verifyLedgerIntegrity().accountBalancesEGP;
    expect(afterRefund['PLATFORM_ESCROW_MAIN']).toBe(0);
    expect(afterRefund['PLATFORM_REVENUE_COMMISSIONS']).toBe(0);
  });

  it('reverses only the proportional commission on a partial refund', () => {
    capture(1000);
    refund(400);
    const balances = ledgerService.verifyLedgerIntegrity().accountBalancesEGP;
    // 850 in escrow, less 400 refunded, plus 60 commission returned.
    expect(balances['PLATFORM_ESCROW_MAIN']).toBe(510);
    expect(balances['PLATFORM_REVENUE_COMMISSIONS']).toBe(90);
  });
});
