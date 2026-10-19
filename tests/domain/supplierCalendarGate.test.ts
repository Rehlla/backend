import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService, SupplierDateBlockedError } from '../../server/services/commerceService';
import { supplierCalendarService } from '../../server/services/supplierCalendarService';
import { heldItem, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * Supplier calendar gate (blueprint row #12).
 *
 * The calendar service shipped with its full CRUD + query surface, but nothing
 * ever consulted it at booking time: `isDateBlocked`/`isRangeBlocked` had zero
 * call sites, so a supplier who blocked "I am closed these days" still sold
 * inventory for those days. These tests pin the gate at the two chokepoints
 * that create inventory obligations (hold, checkout) and the one that offers
 * recovery (alternatives) — plus the honest-404 contract of the public
 * availability view.
 */

const BLOCK_START = '2099-10-01';
const BLOCK_END = '2099-10-05';
const BLOCKED_DATE = '2099-10-03';
const FREE_DATE = '2099-11-10';
const BLOCK_REASON = 'Staff training';

const seedBlock = (supplierId = 'SUP-TEST') =>
  supplierCalendarService.createBlock({
    supplierId,
    startDate: BLOCK_START,
    endDate: BLOCK_END,
    reason: BLOCK_REASON,
    createdBy: supplierId,
  });

const checkout = (date: string) =>
  commerceService.completeMultiServiceCheckout({
    tripId: 'TRIP-TEST',
    travelerUserId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'test@example.test',
    // A blocked date cannot be held, so that line goes in bare — the calendar
    // gate must refuse it before the missing hold is even considered.
    items: [
      supplierCalendarService.isDateBlocked('SUP-TEST', date)
        ? { serviceType: 'diving', skuId: 'SKU-DIVE-TEST', scheduledDate: date, scheduledTime: '08:30 AM (Morning Dive)', amountEGP: 1200 }
        : heldItem({ date })
    ],
    paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' }
  });

const hold = (date: string) =>
  commerceService.createHold({
    skuId: 'SKU-DIVE-TEST',
    tripId: 'TRIP-TEST',
    travelerId: 'USR-TEST',
    date,
    timeSlot: '08:30 AM (Morning Dive)',
    passengersCount: 1,
    idempotencyKey: nextIdempotencyKey()
  });

describe('supplier calendar gate', () => {
  beforeEach(() => {
    resetDb();
    seedSku();
    seedTrip();
    // createBlock (and the calendar gate) resolve the supplier record.
    db.suppliers.push({
      id: 'SUP-TEST',
      businessName: 'Test Divers',
      businessNameAr: 'غواصو الاختبار',
      category: 'diving',
      status: 'Active'
    } as any);
  });

  describe('checkout refuses blocked dates before money moves', () => {
    it('rejects checkout for a blocked date with SupplierDateBlockedError', () => {
      seedBlock();
      expect(() => checkout(BLOCKED_DATE)).toThrow(SupplierDateBlockedError);
    });

    it('carries a 409 and the offending supplier/date/reason in the error', () => {
      seedBlock();
      try {
        checkout(BLOCKED_DATE);
        expect.unreachable('checkout should have thrown');
      } catch (error) {
        const blocked = error as SupplierDateBlockedError;
        expect(blocked.status).toBe(409);
        expect(blocked.details).toMatchObject({
          skuId: 'SKU-DIVE-TEST',
          supplierId: 'SUP-TEST',
          date: BLOCKED_DATE,
          reason: BLOCK_REASON
        });
        expect(blocked.message).toContain(BLOCK_REASON);
      }
    });

    it('charges nothing and files nothing for a blocked date', () => {
      // Ordering is the point: processCheckout writes money rows outside the
      // booking transaction, so the calendar gate must run before it.
      seedBlock();
      expect(() => checkout(BLOCKED_DATE)).toThrow();
      expect(db.payments).toHaveLength(0);
      expect(db.ledgerEntries).toHaveLength(0);
      expect(db.bookings).toHaveLength(0);
    });

    it('respects the block boundaries (start and end dates are inclusive)', () => {
      seedBlock();
      expect(() => checkout(BLOCK_START)).toThrow(SupplierDateBlockedError);
      expect(() => checkout(BLOCK_END)).toThrow(SupplierDateBlockedError);
    });

    it('lets checkout through on an unblocked date', () => {
      seedBlock();
      const result = checkout(FREE_DATE);
      expect(result.success).toBe(true);
      expect(db.bookings).toHaveLength(1);
    });

    it('lets checkout through when the calendar has no blocks at all', () => {
      const result = checkout(BLOCKED_DATE);
      expect(result.success).toBe(true);
      expect(db.bookings).toHaveLength(1);
    });

    it('rejects a multi-item checkout when only one item hits a blocked date', () => {
      seedBlock();
      seedSku({ id: 'SKU-SNORK-TEST', supplierId: 'SUP-FREE', serviceType: 'diving', title: 'Free Snorkel' });
      expect(
        () =>
          commerceService.completeMultiServiceCheckout({
            tripId: 'TRIP-TEST',
            travelerUserId: 'USR-TEST',
            travelerName: 'Test Traveler',
            travelerPhone: '+20 100 000 0000',
            travelerEmail: 'test@example.test',
            items: [
              { serviceType: 'diving', skuId: 'SKU-SNORK-TEST', scheduledDate: FREE_DATE, scheduledTime: '10:00 AM', amountEGP: 300 },
              { serviceType: 'diving', skuId: 'SKU-DIVE-TEST', scheduledDate: BLOCKED_DATE, scheduledTime: '08:30 AM (Morning Dive)', amountEGP: 1200 }
            ],
            paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' }
          })
      ).toThrow(SupplierDateBlockedError);
      expect(db.payments).toHaveLength(0);
      expect(db.bookings).toHaveLength(0);
    });
  });

  describe('hold respects the calendar', () => {
    it('refuses a hold for a blocked date', () => {
      seedBlock();
      expect(() => hold(BLOCKED_DATE)).toThrow(SupplierDateBlockedError);
    });

    it('creates no hold rows and reserves no capacity for a blocked date', () => {
      seedBlock();
      expect(() => hold(BLOCKED_DATE)).toThrow();
      expect(db.holds).toHaveLength(0);
      expect(db.inventorySlots).toHaveLength(0);
    });

    it('holds normally on an unblocked date', () => {
      seedBlock();
      const created = hold(FREE_DATE);
      expect(created.status).toBe('ACTIVE');
      expect(db.holds).toHaveLength(1);
    });
  });

  describe('alternatives skip blocked suppliers', () => {
    it('excludes candidates whose supplier blocked the requested date', () => {
      seedBlock(); // blocks SUP-TEST, the origin SKU's supplier
      seedSku({ id: 'SKU-DIVE-ALT', supplierId: 'SUP-FREE', title: 'Free Alt Dive' });
      const alternatives = commerceService.findAlternatives({
        skuId: 'SKU-DIVE-TEST',
        date: BLOCKED_DATE,
        passengersCount: 2
      });
      expect(alternatives.map(a => a.skuId)).toEqual(['SKU-DIVE-ALT']);
    });

    it('returns nothing when every same-type supplier blocked the date', () => {
      seedBlock();
      seedSku({ id: 'SKU-DIVE-ALT', supplierId: 'SUP-TEST' }); // same blocked supplier
      const alternatives = commerceService.findAlternatives({
        skuId: 'SKU-DIVE-TEST',
        date: BLOCKED_DATE,
        passengersCount: 2
      });
      expect(alternatives).toEqual([]);
    });

    it('still ranks normally when nobody is blocked', () => {
      seedSku({ id: 'SKU-DIVE-ALT', supplierId: 'SUP-FREE', title: 'Free Alt Dive', basePriceEGP: 1200 });
      const alternatives = commerceService.findAlternatives({
        skuId: 'SKU-DIVE-TEST',
        date: BLOCKED_DATE,
        passengersCount: 2
      });
      expect(alternatives).toHaveLength(1);
      expect(alternatives[0].skuId).toBe('SKU-DIVE-ALT');
    });
  });

  describe('public availability view must not invent a calendar', () => {
    it('reports whether a supplier exists (the route 404s on false)', () => {
      expect(supplierCalendarService.supplierExists('SUP-TEST')).toBe(true);
      expect(supplierCalendarService.supplierExists('SUP-NONEXISTENT')).toBe(false);
    });

    it('monthlyAvailability stays block-scoped (no supplier check by design)', () => {
      // The existence gate lives in the route, not the service: the service
      // maps blocks to days and must stay a pure read.
      expect(supplierCalendarService.monthlyAvailability('SUP-NONEXISTENT', '2099-10-01')['2099-10-01']).toEqual({ blocked: false });
    });
  });
});
