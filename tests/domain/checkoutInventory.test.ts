import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService, UnknownSkuError } from '../../server/services/commerceService';
import { heldItem, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * A booking must name inventory that exists.
 *
 * `completeMultiServiceCheckout` used to resolve an unknown skuId to *any* SKU
 * of the same service type, and an unresolvable supplier to a hardcoded
 * 'SUP-SHUTTLE-01'. The Book Now catalogue sent its own card ids as skuIds for
 * all eight of its services, none of which are in db.productSkus — so a 180 EGP
 * gear delivery became a real booking dispatched to a real dive centre for a
 * service that dive centre does not sell.
 */
const checkout = (over: { skuId?: string; serviceType?: 'diving' | 'transfer' | 'hotel' | 'safari'; pax?: number } = {}) => {
  const skuId = over.skuId ?? 'SKU-DIVE-TEST';
  // A catalogue SKU is checked out the real way, through a hold. An unknown
  // one cannot be held, and must be refused before any hold is even looked at.
  const line = db.productSkus.some(s => s.id === skuId)
    ? heldItem({ skuId, time: '09:00 AM', pax: over.pax })
    : { skuId, scheduledDate: '2026-09-10', scheduledTime: '09:00 AM', amountEGP: 1200 };
  return commerceService.completeMultiServiceCheckout({
    tripId: 'TRIP-TEST',
    travelerUserId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'test@example.com',
    items: [{ ...line, serviceType: over.serviceType ?? 'diving' }],
    paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' }
  });
};

describe('checkout inventory resolution', () => {
  beforeEach(() => {
    resetDb();
    seedSku();
    seedTrip();
  });

  it('creates the booking against the SKU that was actually named', () => {
    const result = checkout();
    expect(result.success).toBe(true);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0].skuId).toBe('SKU-DIVE-TEST');
    expect(result.bookings[0].supplierId).toBe('SUP-TEST');
  });

  it('refuses a SKU that is not in the catalogue', () => {
    expect(() => checkout({ skuId: 'now-gear-delivery' })).toThrow(UnknownSkuError);
  });

  it('names the offending SKU, and reports it as a bad request rather than sold out', () => {
    try {
      checkout({ skuId: 'now-gear-delivery' });
      expect.unreachable('checkout should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownSkuError);
      const unknown = error as UnknownSkuError;
      expect(unknown.status).toBe(400);
      expect(unknown.message).toContain('now-gear-delivery');
    }
  });

  it('does not substitute another supplier for an unknown SKU', () => {
    // The old fallback resolved to the first SKU of the same service type and
    // then to 'SUP-SHUTTLE-01'. Nothing may be created at all.
    expect(() => checkout({ skuId: 'now-afternoon-dive' })).toThrow();
    expect(db.bookings).toHaveLength(0);
  });

  it('refuses a real SKU booked as the wrong service type', () => {
    // SKU-DIVE-TEST is a diving product; booking it as a transfer would file a
    // dive against a driver.
    expect(() => checkout({ serviceType: 'transfer' })).toThrow(UnknownSkuError);
  });

  it('takes no money when the SKU is unknown', () => {
    // This is the ordering that matters. processCheckout runs outside
    // db.runInTransaction and writes a payment plus its ledger entries, so a
    // rejection discovered later would leave the traveler charged for a
    // booking that was never created.
    expect(() => checkout({ skuId: 'does-not-exist' })).toThrow();
    expect(db.payments).toHaveLength(0);
    expect(db.ledgerEntries).toHaveLength(0);
    expect(db.bookings).toHaveLength(0);
  });

  it('still records the payment for a valid SKU', () => {
    checkout();
    expect(db.payments.length).toBeGreaterThan(0);
    // Cash on arrival: the payment row is the commitment. No ledger entry —
    // the cash goes to the supplier in person and never reaches escrow.
    expect(db.payments[0].state).toBe('PENDING');
    expect(db.ledgerEntries).toHaveLength(0);
  });
});

describe('checkout and the itinerary', () => {
  beforeEach(() => {
    resetDb();
    seedSku();
    // This block seeds its own trip, because it asserts on travellersCount: 4.
    db.trips.push({
      id: 'TRIP-TEST',
      userId: 'USR-TEST',
      title: 'Test trip',
      status: 'PLANNED',
      lengthDays: 3,
      travelersCount: 4,
      budget: 'Moderate',
      pace: 'Balanced',
      interests: [],
      totalEstimatedEGP: 0,
      totalPaidEGP: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });
  });

  const bookedItem = () =>
    db.tripItems.push({
      id: 'ITEM-EXISTING',
      tripId: 'TRIP-TEST',
      serviceType: 'diving',
      skuId: 'SKU-DIVE-TEST',
      title: 'Coral Canyon Guided Shore Dive',
      dayNumber: 2,
      timeSlot: '09:00 AM',
      priceEGP: 2700,
      status: 'CONFIRMED',
      bookingId: 'DHB-DIV-2026-118',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });

  it('does not re-point an already-booked itinerary line at a new booking', () => {
    // The exact conflict observed in the store: a 2,700 EGP line pointing at a
    // 180 EGP booking, because the match was tripId + serviceType and took the
    // first item of that type.
    bookedItem();
    checkout();

    const existing = db.tripItems.find(i => i.id === 'ITEM-EXISTING');
    expect(existing?.bookingId).toBe('DHB-DIV-2026-118');
    expect(existing?.priceEGP).toBe(2700);
    // The new booking gets a line of its own rather than stealing one.
    expect(db.tripItems).toHaveLength(2);
  });

  it('fills an unbooked line for the same product instead of duplicating it', () => {
    db.tripItems.push({
      id: 'ITEM-PLANNED',
      tripId: 'TRIP-TEST',
      serviceType: 'diving',
      skuId: 'SKU-DIVE-TEST',
      title: 'Planned dive',
      dayNumber: 2,
      priceEGP: 1200,
      status: 'SUGGESTED',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });
    checkout();

    expect(db.tripItems).toHaveLength(1);
    const filled = db.tripItems[0];
    expect(filled.id).toBe('ITEM-PLANNED');
    expect(filled.status).toBe('CONFIRMED');
    expect(filled.bookingId).toBeTruthy();
  });

  it('keeps the line price equal to what was actually charged', () => {
    db.tripItems.push({
      id: 'ITEM-PLANNED',
      tripId: 'TRIP-TEST',
      serviceType: 'diving',
      skuId: 'SKU-DIVE-TEST',
      title: 'Planned dive',
      dayNumber: 2,
      priceEGP: 999,
      status: 'SUGGESTED',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });
    checkout();
    expect(db.tripItems[0].priceEGP).toBe(1200);
  });

  it('does not match a line whose skuId is a location string, as Add to Trip used to write', () => {
    // The defect this whole seam exists to fix. addActivityToDay sent
    // `skuId: activity.location` — 'Blue Hole, Dahab' — so the line could never
    // be matched to the booking that fulfils it, and checkout silently created
    // a second line for the same experience. The traveler saw their dive twice:
    // once as a plan they could not book, once as a booking they did not plan.
    db.tripItems.push({
      id: 'ITEM-LOCATION-AS-SKU',
      tripId: 'TRIP-TEST',
      serviceType: 'diving',
      skuId: 'Blue Hole, Dahab',
      title: 'Planned dive',
      dayNumber: 2,
      priceEGP: 1200,
      status: 'SUGGESTED',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });
    checkout();

    expect(db.tripItems).toHaveLength(2);
    expect(db.tripItems.find(i => i.id === 'ITEM-LOCATION-AS-SKU')?.bookingId).toBeUndefined();
  });

  it('does not match a line that carries no product at all', () => {
    // An experience with no inventory behind it is added to the trip as a plan
    // and stays one. It must not be adopted by an unrelated booking.
    db.tripItems.push({
      id: 'ITEM-NO-SKU',
      tripId: 'TRIP-TEST',
      serviceType: 'diving',
      skuId: '',
      title: 'Ralph’s German Bakery',
      dayNumber: 2,
      priceEGP: 0,
      status: 'SUGGESTED',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });
    checkout();

    expect(db.tripItems.find(i => i.id === 'ITEM-NO-SKU')?.status).toBe('SUGGESTED');
    expect(db.tripItems.find(i => i.id === 'ITEM-NO-SKU')?.bookingId).toBeUndefined();
  });

  it('does not invent a driver, guide or vehicle for a booking nobody has accepted', () => {
    // Every transfer used to be created carrying "Mahmoud Salem", a phone
    // number and plate ط ج د 4821; every dive an invented PADI instructor.
    checkout();
    expect(db.bookings[0].assignedResource).toBeUndefined();
    expect(db.bookings[0].supplierState).toBe('PENDING_CONFIRMATION');
  });

  it('records the real party size rather than a hardcoded 2', () => {
    // The party that was held (and priced) — 3 here, not the trip's 4 and
    // not a hardcoded 2.
    checkout({ pax: 3 });
    expect(db.bookings[0].passengersCount).toBe(3);
    expect(db.bookings[0].amountEGP).toBe(1200 * 3);
  });
});
