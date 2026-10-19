import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { ledgerService } from '../../server/services/ledgerService';

/**
 * Ledger integrity.
 *
 * Two defects motivated these:
 *  1. The service constructor called repairAndSealLedgerChain(), which recomputes
 *     every signature on boot — so tampering was silently re-sealed as valid and
 *     `chainIntact` could never report a break.
 *  2. `balanced` compared two counters incremented by the same value in the same
 *     loop, so it was a tautology that could never be false.
 */

const resetLedger = () => {
  db.ledgerEntries.length = 0;
};

const capture = (idempotencyKey: string, amountEGP: number) =>
  ledgerService.recordDoubleEntry({
    transactionId: `TXN-${idempotencyKey}`,
    idempotencyKey,
    bookingRef: `BK-${idempotencyKey}`,
    tripId: 'TRIP-TEST',
    type: 'PAYMENT_CAPTURED',
    amountEGP,
    debitAccount: 'TRAVELER_GATEWAY_4242',
    creditAccount: 'PLATFORM_ESCROW_MAIN'
  });

describe('ledger integrity', () => {
  beforeEach(resetLedger);

  it('reports a clean chain for untampered entries', () => {
    capture('A1', 1000);
    capture('A2', 500);
    const result = ledgerService.verifyLedgerIntegrity();
    expect(result.chainIntact).toBe(true);
    expect(result.integrityFailures).toEqual([]);
    expect(result.balanced).toBe(true);
  });

  it('DETECTS a tampered amount — the property the auto-reseal used to destroy', () => {
    capture('B1', 1000);
    capture('B2', 500);

    // Someone edits an amount directly in the JSON store.
    db.ledgerEntries[0].amountEGP = 999999;

    const result = ledgerService.verifyLedgerIntegrity();
    expect(result.chainIntact).toBe(false);
    expect(result.integrityFailures.join(' ')).toMatch(/signature does not match/i);
  });

  it('detects a broken previousHash link', () => {
    capture('C1', 1000);
    capture('C2', 500);
    db.ledgerEntries[1].previousHash = 'sha256:not-the-real-previous-hash';

    const result = ledgerService.verifyLedgerIntegrity();
    expect(result.chainIntact).toBe(false);
    expect(result.integrityFailures.join(' ')).toMatch(/previousHash/i);
  });

  it('flags an overdrawn escrow account', () => {
    capture('D1', 100);
    // Pay out more than was ever taken in.
    ledgerService.recordDoubleEntry({
      transactionId: 'TXN-D2',
      idempotencyKey: 'D2',
      bookingRef: 'BK-D2',
      tripId: 'TRIP-TEST',
      type: 'SUPPLIER_PAYOUT',
      amountEGP: 5000,
      debitAccount: 'PLATFORM_ESCROW_MAIN',
      creditAccount: 'SUPPLIER_PAYABLE_X'
    });

    const result = ledgerService.verifyLedgerIntegrity();
    expect(result.escrowBalanceEGP).toBeLessThan(0);
    expect(result.balanced).toBe(false);
    expect(result.integrityFailures.join(' ')).toMatch(/overdrawn/i);
  });

  it('is idempotent: the same idempotencyKey never double-posts', () => {
    const first = capture('E1', 250);
    const second = capture('E1', 250);
    expect(second.id).toBe(first.id);
    expect(db.ledgerEntries).toHaveLength(1);
  });

  it('exposes per-account balances that actually net out', () => {
    capture('F1', 1000);
    const { accountBalancesEGP } = ledgerService.verifyLedgerIntegrity();
    expect(accountBalancesEGP['PLATFORM_ESCROW_MAIN']).toBe(1000);
    expect(accountBalancesEGP['TRAVELER_GATEWAY_4242']).toBe(-1000);
  });
});
