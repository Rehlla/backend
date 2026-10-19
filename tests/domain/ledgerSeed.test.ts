import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/db/database';
import { ledgerService } from '../../server/services/ledgerService';
import { buildSeedLedgerEntries, LEDGER_GENESIS_HASH } from '../../server/db/migrations';

/**
 * Ledger seed integrity — release gate for the /api/health ledger check.
 *
 * The seed once shipped hardcoded placeholder signatureHash values with no
 * previousHash at all, so every fresh boot failed its own integrity check
 * (5/5 "signature does not match its contents") while the unit suite stayed
 * green — the suite only ever exercised recordDoubleEntry, never the seed.
 * These tests pin the seed to the verifier.
 */
describe('ledger seed integrity', () => {
  beforeEach(() => {
    db.ledgerEntries.length = 0;
  });

  afterEach(() => {
    db.ledgerEntries.length = 0;
  });

  it('builds five chained entries carrying previousHash', () => {
    const seed = buildSeedLedgerEntries();
    expect(seed).toHaveLength(5);
    expect(seed.map(e => e.id)).toEqual([
      'LEDGER-001',
      'LEDGER-002',
      'LEDGER-003',
      'LEDGER-004',
      'LEDGER-005',
    ]);
    for (const entry of seed) {
      // Genesis is the historical 40-zero constant shared with
      // LedgerService (recordDoubleEntry/repairAndSealLedgerChain); every
      // link after it is a full 64-hex sha256.
      const hashPattern = entry.id === 'LEDGER-001'
        ? LEDGER_GENESIS_HASH
        : /^sha256:[0-9a-f]{64}$/;
      if (typeof hashPattern === 'string') {
        expect(entry.previousHash, `${entry.id} previousHash`).toBe(hashPattern);
      } else {
        expect(entry.previousHash, `${entry.id} previousHash`).toMatch(hashPattern);
      }
      expect(entry.signatureHash, `${entry.id} signatureHash`).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    for (let i = 1; i < seed.length; i++) {
      expect(seed[i].previousHash).toBe(seed[i - 1].signatureHash);
    }
  });

  it('verifies clean through the real verifier (fresh-boot gate)', () => {
    db.ledgerEntries.push(...buildSeedLedgerEntries());
    const result = ledgerService.verifyLedgerIntegrity();
    expect(result.integrityFailures).toEqual([]);
    expect(result.chainIntact).toBe(true);
    expect(result.balanced).toBe(true);
    expect(result.totalEntries).toBe(5);
  });

  it('documents the legacy defect: placeholder hashes with no chain fail', () => {
    db.ledgerEntries.push(
      {
        id: 'LEDGER-001',
        transactionId: 'TXN-984102-PAY',
        idempotencyKey: 'IDEMP-PAY-001-894',
        bookingRef: 'DHB-HTL-2026-081',
        tripId: 'DHB-TRIP-894',
        type: 'PAYMENT_CAPTURED',
        amountEGP: 12500,
        debitAccount: 'TRAVELER_CC_TOKEN_4910',
        creditAccount: 'PLATFORM_ESCROW_MAIN',
        currency: 'EGP',
        timestamp: '2026-08-23 14:15:22',
        status: 'SETTLED',
        signatureHash: 'sha256:4a8b79e192f81498bca120934fa12480bcae8124',
      } as never,
      {
        id: 'LEDGER-002',
        transactionId: 'TXN-984103-PAY',
        idempotencyKey: 'IDEMP-PAY-002-894',
        bookingRef: 'DHB-TRF-2026-042',
        tripId: 'DHB-TRIP-894',
        type: 'PAYMENT_CAPTURED',
        amountEGP: 1400,
        debitAccount: 'TRAVELER_CC_TOKEN_4910',
        creditAccount: 'PLATFORM_ESCROW_MAIN',
        currency: 'EGP',
        timestamp: '2026-08-23 14:15:23',
        status: 'SETTLED',
        signatureHash: 'sha256:88bc410294f91048bc8190234fa9912048bac912',
      } as never
    );
    const result = ledgerService.verifyLedgerIntegrity();
    expect(result.chainIntact).toBe(false);
    expect(result.balanced).toBe(false);
    expect(result.integrityFailures.join(' ')).toMatch(/signature does not match/i);
  });
});
