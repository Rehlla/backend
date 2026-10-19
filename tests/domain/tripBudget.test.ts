import { describe, expect, it } from 'vitest';
import { CATEGORY_MAP, summariseBudget } from '../../src/components/mytrip/tripBudget';
import type { LedgerEntry } from '../../src/shared/types/commerce';

const entry = (overrides: Partial<LedgerEntry>): LedgerEntry => ({
  id: 'l1',
  transactionId: 'tx1',
  idempotencyKey: 'ik1',
  bookingRef: 'BK-1',
  tripId: 'TRIP-1',
  type: 'PAYMENT_CAPTURED',
  amountEGP: 0,
  debitAccount: 'd',
  creditAccount: 'c',
  currency: 'EGP',
  timestamp: '2026-01-01T00:00:00.000Z',
  status: 'SETTLED',
  signatureHash: 'abc',
  ...overrides,
});

describe('summariseBudget', () => {
  it('reports a fully available budget for an empty ledger', () => {
    const s = summariseBudget([], 20800);
    expect(s.totalSpent).toBe(0);
    expect(s.totalRefunded).toBe(0);
    expect(s.remaining).toBe(20800);
    expect(s.percentSpent).toBe(0);
    expect(s.categories).toEqual([]);
  });

  it('subtracts refunds from the amount spent', () => {
    const s = summariseBudget(
      [
        entry({ id: 'a', type: 'PAYMENT_CAPTURED', amountEGP: 1000 }),
        entry({ id: 'b', type: 'REFUND_ISSUED', amountEGP: 300 }),
      ],
      20000
    );
    expect(s.totalRefunded).toBe(300);
    expect(s.totalSpent).toBe(700);
    expect(s.remaining).toBe(19300);
  });

  it('treats COMMISSION_REVERSAL and RECOVERY_CREDIT as refunds', () => {
    const s = summariseBudget(
      [
        entry({ id: 'a', type: 'PAYMENT_CAPTURED', amountEGP: 5000 }),
        entry({ id: 'b', type: 'COMMISSION_REVERSAL', amountEGP: 500 }),
        entry({ id: 'c', type: 'RECOVERY_CREDIT', amountEGP: 200 }),
      ],
      10000
    );
    expect(s.totalRefunded).toBe(700);
    expect(s.totalSpent).toBe(4300);
  });

  it('sorts categories descending by amount and exposes the canonical key', () => {
    const s = summariseBudget(
      [
        entry({ id: 'a', type: 'PAYMENT_CAPTURED', amountEGP: 500 }),
        entry({ id: 'b', type: 'SUPPLIER_PAYOUT', amountEGP: 1200 }),
      ],
      10000
    );
    expect(s.categories.map(c => c.key)).toEqual(['SUPPLIER_PAYOUT', 'PAYMENT_CAPTURED']);
    expect(s.categories[0]).toEqual({ key: 'SUPPLIER_PAYOUT', spent: 1200, color: 'bg-purple-500' });
  });

  it('omits refund-only categories from the breakdown', () => {
    const s = summariseBudget([entry({ id: 'a', type: 'REFUND_ISSUED', amountEGP: 900 })], 10000);
    expect(s.categories).toEqual([]);
  });

  it('handles a zero budget without dividing by zero', () => {
    const s = summariseBudget([entry({ id: 'a', type: 'PAYMENT_CAPTURED', amountEGP: 500 })], 0);
    expect(s.percentSpent).toBe(0);
    expect(s.remaining).toBe(-500);
  });

  it('rounds the percentage up like the abandoned component did', () => {
    const s = summariseBudget([entry({ id: 'a', type: 'PAYMENT_CAPTURED', amountEGP: 5000 })], 10000);
    expect(s.percentSpent).toBe(50);
  });

  it('keeps the corrected Arabic label for COMMISSION_REVERSAL', () => {
    expect(CATEGORY_MAP.COMMISSION_REVERSAL.ar).toBe('عكس عمولات');
  });
});