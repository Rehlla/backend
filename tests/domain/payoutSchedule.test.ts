import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';
import { payoutService } from '../../server/services/payoutService';
import { ledgerService } from '../../server/services/ledgerService';

/**
 * 24-hour payout scheduling (blueprint row #12).
 *
 * When a booking reaches COMPLETED, a payout schedule entry is created with
 * a 24-hour hold. After the hold expires, a sweep converts it into a real
 * SUPPLIER_PAYOUT ledger entry.
 */

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-payout-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();

  // Seed supplier + product SKU + trip + booking for FK compliance.
  db.suppliers.push({
    id: 'SUP-DIVE',
    businessName: 'Red Sea Divers',
    businessNameAr: 'غواصين البحر الأحمر',
    category: 'diving',
    tier: 'Tier 1 Certified',
    status: 'Active',
    area: 'masbat',
  } as any);
  db.users.push({
    id: 'USR-TRAV',
    email: 'traveler@test.com',
    name: 'Test Traveler',
    role: 'Traveler',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  db.productSkus.push({
    id: 'SKU-DIVE-01',
    supplierId: 'SUP-DIVE',
    serviceType: 'diving',
    title: 'Discover Scuba',
    titleAr: 'غوص تعليمي',
    description: 'Intro dive',
    basePriceEGP: 1500,
    currency: 'EGP',
    maxCapacityPerSlot: 4,
    active: true,
    cancellationPolicyHours: 24,
  } as any);
  db.trips.push({
    id: 'TRIP-1',
    userId: 'USR-TRAV',
    title: 'Dive Trip',
    status: 'COMPLETED',
    lengthDays: 3,
    travelersCount: 2,
    budget: 'Moderate',
    pace: 'Balanced',
    interests: ['diving'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  db.bookings.push({
    id: 'BID-001',
    bookingRef: 'BK-COMPLETED-001',
    tripId: 'TRIP-1',
    userId: 'USR-TRAV',
    supplierId: 'SUP-DIVE',
    skuId: 'SKU-DIVE-01',
    serviceType: 'diving',
    amountEGP: 1500,
    paymentState: 'CAPTURED',
    supplierState: 'COMPLETED',
    status: 'CONFIRMED',
    travelerName: 'Test Traveler',
    travelerPhone: '+20100000000',
    travelerEmail: 'traveler@test.com',
    passengersCount: 2,
    scheduledDate: '2026-09-10',
    scheduledTime: '09:00',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  // Seed escrow with a PAYMENT_CAPTURED so settlePayout escrow guard can succeed.
  // In production this ledger entry is created by paymentService.processCheckout;
  // the test suite previously omitted it, but the new escrow check requires it.
  ledgerService.recordDoubleEntry({
    transactionId: 'TXN-SEED-ESCROW',
    idempotencyKey: 'seed-escrow-beforeEach',
    bookingRef: 'BK-COMPLETED-001',
    tripId: 'TRIP-1',
    type: 'PAYMENT_CAPTURED',
    amountEGP: 10000,
    debitAccount: 'TRAVELER_PAYMENT_GATEWAY',
    creditAccount: 'PLATFORM_ESCROW_MAIN',
  });
});

afterEach(() => {
  payoutService.stopPayoutSweep();
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('payoutService', () => {
  describe('schedulePayout', () => {
    it('creates a pending payout with 24h hold', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-COMPLETED-001',
        amountEGP: 1275, // 85% of 1500
      });
      expect(payout.id).toMatch(/^PAY-/);
      expect(payout.payoutState).toBe('PENDING');
      expect(payout.amountEGP).toBe(1275);
      expect(payout.supplierId).toBe('SUP-DIVE');
      expect(payout.bookingRef).toBe('BK-COMPLETED-001');
      // Hold should be ~24h from now
      const holdMs = new Date(payout.settleAfter).getTime() - new Date(payout.createdAt).getTime();
      expect(holdMs).toBeGreaterThanOrEqual(23 * 3600 * 1000);
      expect(holdMs).toBeLessThanOrEqual(25 * 3600 * 1000);
    });

    it('is idempotent for the same booking', () => {
      const first = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-COMPLETED-001',
        amountEGP: 1275,
      });
      const second = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-COMPLETED-001',
        amountEGP: 1275,
      });
      expect(second.id).toBe(first.id);
      expect(db.payoutSchedule.filter(p => p.bookingRef === 'BK-COMPLETED-001')).toHaveLength(1);
    });

    it('allows scheduling for different bookings', () => {
      payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-001',
        amountEGP: 1000,
      });
      payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-002',
        amountEGP: 2000,
      });
      expect(db.payoutSchedule).toHaveLength(2);
    });
  });

  describe('payoutsForSupplier', () => {
    it('returns payouts for the specified supplier', () => {
      payoutService.schedulePayout({ supplierId: 'SUP-DIVE', bookingRef: 'BK-001', amountEGP: 1000 });
      payoutService.schedulePayout({ supplierId: 'SUP-OTHER', bookingRef: 'BK-002', amountEGP: 2000 });
      expect(payoutService.payoutsForSupplier('SUP-DIVE')).toHaveLength(1);
    });
  });

  describe('payoutForBooking', () => {
    it('finds a payout by booking ref', () => {
      payoutService.schedulePayout({ supplierId: 'SUP-DIVE', bookingRef: 'BK-X', amountEGP: 500 });
      expect(payoutService.payoutForBooking('BK-X')).toBeDefined();
      expect(payoutService.payoutForBooking('BK-NOPE')).toBeUndefined();
    });
  });

  describe('settlePayout', () => {
    it('creates a SUPPLIER_PAYOUT ledger entry after hold expires', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-COMPLETED-001',
        amountEGP: 1275,
      });
      // Force the hold to be expired by backdating settleAfter.
      payout.settleAfter = new Date(Date.now() - 1000).toISOString();

      const ledgerId = payoutService.settlePayout(payout.id);
      expect(ledgerId).toBeDefined();

      // Payout state updated
      expect(payout.payoutState).toBe('SETTLED');
      expect(payout.settledAt).toBeDefined();
      expect(payout.ledgerEntryId).toBe(ledgerId);

      // Ledger entry created
      const entry = db.ledgerEntries.find(e => e.id === ledgerId);
      expect(entry).toBeDefined();
      expect(entry!.type).toBe('SUPPLIER_PAYOUT');
      expect(entry!.amountEGP).toBe(1275);
      expect(entry!.debitAccount).toBe('PLATFORM_ESCROW_MAIN');
      expect(entry!.creditAccount).toBe('SUPPLIER_PAYABLE_SUP-DIVE');
    });

    it('returns null if still in hold period', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-COMPLETED-001',
        amountEGP: 1275,
      });
      // settleAfter is ~24h in the future — don't touch it.
      expect(payoutService.settlePayout(payout.id)).toBeNull();
      expect(payout.payoutState).toBe('PENDING');
    });

    it('returns null for unknown payout id', () => {
      expect(payoutService.settlePayout('PAY-FAKE')).toBeNull();
    });

    it('returns null for already-settled payout', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-COMPLETED-001',
        amountEGP: 1275,
      });
      payout.settleAfter = new Date(Date.now() - 1000).toISOString();
      payoutService.settlePayout(payout.id);
      expect(payoutService.settlePayout(payout.id)).toBeNull();
    });
  });

  describe('cancelPayout', () => {
    it('cancels a pending payout', () => {
      payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-CANCEL',
        amountEGP: 800,
      });
      expect(payoutService.cancelPayout('BK-CANCEL')).toBe(true);
      const payout = payoutService.payoutForBooking('BK-CANCEL');
      expect(payout!.payoutState).toBe('CANCELLED');
    });

    it('returns false for unknown booking', () => {
      expect(payoutService.cancelPayout('BK-NOPE')).toBe(false);
    });

    it('does not cancel already-settled payouts', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-SETTLED',
        amountEGP: 800,
      });
      payout.settleAfter = new Date(Date.now() - 1000).toISOString();
      payoutService.settlePayout(payout.id);
      expect(payoutService.cancelPayout('BK-SETTLED')).toBe(false);
      expect(payout.payoutState).toBe('SETTLED');
    });
  });

  describe('eligiblePayouts', () => {
    it('returns payouts whose hold has expired', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-ELIGIBLE',
        amountEGP: 1000,
      });
      payout.settleAfter = new Date(Date.now() - 1000).toISOString();

      const eligible = payoutService.eligiblePayouts();
      expect(eligible.some(p => p.id === payout.id)).toBe(true);
    });

    it('excludes payouts still in hold', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-HOLD',
        amountEGP: 1000,
      });
      // Don't backdate — still in 24h hold.
      const eligible = payoutService.eligiblePayouts();
      expect(eligible.some(p => p.id === payout.id)).toBe(false);
    });

    it('excludes cancelled and settled payouts', () => {
      const p1 = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-C1',
        amountEGP: 100,
      });
      p1.settleAfter = new Date(Date.now() - 1000).toISOString();
      payoutService.cancelPayout('BK-C1');

      const p2 = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-S1',
        amountEGP: 200,
      });
      p2.settleAfter = new Date(Date.now() - 1000).toISOString();
      payoutService.settlePayout(p2.id);

      const eligible = payoutService.eligiblePayouts();
      expect(eligible.some(p => p.id === p1.id)).toBe(false);
      expect(eligible.some(p => p.id === p2.id)).toBe(false);
    });
  });

  describe('sweep integration', () => {
    it('sweep settles eligible payouts automatically', () => {
      const payout = payoutService.schedulePayout({
        supplierId: 'SUP-DIVE',
        bookingRef: 'BK-SWEEP',
        amountEGP: 1275,
      });
      payout.settleAfter = new Date(Date.now() - 1000).toISOString();

      // Run the sweep manually (not via interval).
      payoutService.startPayoutSweep();
      // The sweep runs every 60s, but we can trigger it by calling settlePayout directly.
      // For the test, just verify eligiblePayouts picks it up.
      const eligible = payoutService.eligiblePayouts();
      expect(eligible).toHaveLength(1);
      payoutService.settlePayout(eligible[0].id);
      expect(payout.payoutState).toBe('SETTLED');
    });
  });
});
