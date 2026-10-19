import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { importDahabMenus } from '../../server/db/seeds/importDahabMenus';
import { EXPANDED_DINING_VENUES } from '../../server/data/dkosExpansionDataPart2';
import {
  DiningOrderError,
  diningOrderService
} from '../../server/services/diningOrderService';
import { DiningVenueEntity } from '../../server/db/schema';
import {
  FIXTURE_DELIVERY_VENUE_ID,
  FIXTURE_FAR_OUT_VENUE_ID,
  FIXTURE_PICKUP_ONLY_VENUE_ID,
  installDiningFixtureVenues
} from '../helpers/diningFixtureVenues';

/**
 * The price is the server's, never the client's.
 *
 * The hold/checkout spine answers a mismatched amount with 409 PRICE_CHANGED
 * rather than silently correcting it at settlement. A food order has no hold
 * step, so this is the only place that guarantee can be made: if a cart total
 * could be honoured, everything downstream would be honest-looking fiction.
 */

let venueId: string;
let deliveryVenueId: string;
let pickupOnlyVenueId: string;
let menuItemId: string;
let cheapItemId: string;
let cheapest: { id: string; priceEGP: number };

beforeAll(() => {
  if (db.diningVenues.length === 0) {
    db.diningVenues.push(...(EXPANDED_DINING_VENUES as DiningVenueEntity[]));
  }
  importDahabMenus();
  installDiningFixtureVenues();
  venueId = 'dining_ali_baba_seafood';
  deliveryVenueId = FIXTURE_DELIVERY_VENUE_ID;
  pickupOnlyVenueId = FIXTURE_PICKUP_ONLY_VENUE_ID;
  const items = db.diningMenuItems.filter(m => m.venueId === venueId && m.available);
  cheapest = items.reduce((a, b) => (b.priceEGP < a.priceEGP ? b : a));
  cheapItemId = cheapest.id;
  menuItemId = items.find(i => i.priceEGP > 300)!.id;
});

const traveller = { userId: 'user-dining-1', role: 'Traveler' };

function deliveryQuote(items = [{ menuItemId, quantity: 2 }]) {
  return diningOrderService.quote({
    venueId,
    items,
    fulfillment: 'DELIVERY',
    zoneId: 'lighthouse',
    locationSource: 'geo'
  });
}

describe('dining quote', () => {
  it('prices the dish from the catalogue, not from the request', () => {
    const quote = deliveryQuote();
    const line = quote.lines[0];
    const item = db.diningMenuItems.find(m => m.id === menuItemId)!;

    expect(line.unitPriceEGP).toBe(item.priceEGP);
    expect(line.lineTotalEGP).toBe(item.priceEGP * 2);
    expect(quote.priceBreakdown.subtotalEGP).toBe(item.priceEGP * 2);
  });

  it('adds the venue fee, the zone fee and packaging to reach a total', () => {
    const venue = db.diningVenues.find(v => v.id === venueId)!;
    const zone = venue.delivery!.zones.find(z => z.zoneId === 'lighthouse')!;
    const quote = deliveryQuote();

    const expectedServiceFee = Math.max(
      quote.priceBreakdown.subtotalEGP * (venue.delivery!.serviceFeePercent / 100),
      10
    );

    expect(quote.priceBreakdown.deliveryFeeEGP).toBe(zone.feeEGP);
    expect(quote.priceBreakdown.serviceFeeEGP).toBeCloseTo(expectedServiceFee, 2);
    expect(quote.priceBreakdown.totalEGP).toBe(
      quote.priceBreakdown.subtotalEGP + quote.priceBreakdown.deliveryFeeEGP + quote.priceBreakdown.serviceFeeEGP
    );
  });

  it('quotes in EGP, because every charge is EGP', () => {
    expect(deliveryQuote().priceBreakdown.currency).toBe('EGP');
  });

  it('charges nothing to deliver on a pickup order', () => {
    const quote = diningOrderService.quote({
      venueId,
      items: [{ menuItemId, quantity: 2 }],
      fulfillment: 'PICKUP'
    });
    expect(quote.priceBreakdown.deliveryFeeEGP).toBe(0);
    expect(quote.priceBreakdown.totalEGP).toBe(quote.priceBreakdown.subtotalEGP);
    expect(quote.deliveryLocation).toBeUndefined();
    // Pickup still promises a time — the kitchen's prep.
    expect(quote.etaMinutes).toBeGreaterThan(0);
  });

  it('quotes each zone at the venue\'s own price, not the zone\'s', () => {
    // Two kitchens, same zone, different fee: the zone only carries geography.
    const aliBaba = diningOrderService.quote({
      venueId,
      items: [{ menuItemId, quantity: 2 }],
      fulfillment: 'DELIVERY',
      zoneId: 'masbat'
    });
    const shark = diningOrderService.quote({
      venueId: 'dining_shark_restaurant',
      items: [{ menuItemId: mostExpensiveMenuItemFor('dining_shark_restaurant'), quantity: 1 }],
      fulfillment: 'DELIVERY',
      zoneId: 'masbat'
    });

    expect(aliBaba.priceBreakdown.deliveryFeeEGP).toBe(
      db.diningVenues.find(v => v.id === venueId)!.delivery!.zones.find(z => z.zoneId === 'masbat')!.feeEGP
    );
    expect(shark.priceBreakdown.deliveryFeeEGP).toBe(
      db.diningVenues.find(v => v.id === 'dining_shark_restaurant')!.delivery!.zones.find(z => z.zoneId === 'masbat')!.feeEGP
    );
  });

  it('refuses a delivery below the venue minimum, and says why', () => {
    const venue = db.diningVenues.find(v => v.id === deliveryVenueId)!;
    const quote = diningOrderService.quote({
      venueId: deliveryVenueId,
      items: [{ menuItemId: cheapestMenuItemFor(deliveryVenueId), quantity: 1 }],
      fulfillment: 'DELIVERY',
      zoneId: 'masbat'
    });
    expect(quote.refusal?.code).toBe('BELOW_MINIMUM');
    expect(quote.priceBreakdown.deliveryFeeEGP).toBe(0);
    expect(quote.refusal?.message).toContain(String(venue.delivery!.minOrderEGP));
  });

  it('refuses a venue that does not deliver, and offers pickup', () => {
    const quote = diningOrderService.quote({
      venueId: pickupOnlyVenueId,
      items: [{ menuItemId: cheapestMenuItemFor(pickupOnlyVenueId), quantity: 2 }],
      fulfillment: 'DELIVERY',
      zoneId: 'masbat'
    });
    expect(quote.refusal?.code).toBe('NO_DELIVERY');

    const pickup = diningOrderService.quote({
      venueId: pickupOnlyVenueId,
      items: [{ menuItemId: cheapestMenuItemFor(pickupOnlyVenueId), quantity: 2 }],
      fulfillment: 'PICKUP'
    });
    expect(pickup.refusal).toBeUndefined();
    expect(pickup.priceBreakdown.totalEGP).toBeGreaterThan(0);
  });

  it('refuses a zone the venue does not serve', () => {
    // The Blue Hole camp delivers nowhere near Masbat.
    const quote = diningOrderService.quote({
      venueId: FIXTURE_FAR_OUT_VENUE_ID,
      items: [{ menuItemId: cheapestMenuItemFor(FIXTURE_FAR_OUT_VENUE_ID), quantity: 3 }],
      fulfillment: 'DELIVERY',
      zoneId: 'masbat'
    });
    expect(quote.refusal?.code).toBe('ZONE_NOT_SERVED');
  });

  it('rejects an empty order and a nonsense quantity', () => {
    expect(() =>
      diningOrderService.quote({ venueId, items: [], fulfillment: 'PICKUP' })
    ).toThrow(DiningOrderError);

    expect(() =>
      diningOrderService.quote({
        venueId,
        items: [{ menuItemId, quantity: 0 }],
        fulfillment: 'PICKUP'
      })
    ).toThrow(/between 1 and 20/);

    expect(() =>
      diningOrderService.quote({
        venueId,
        items: [{ menuItemId, quantity: 2.7 }],
        fulfillment: 'PICKUP'
      })
    ).toThrow(/whole number/);
  });

  it('will not sell a dish that does not exist or is sold out', () => {
    expect(() =>
      diningOrderService.quote({
        venueId,
        items: [{ menuItemId: 'MENU-DOES-NOT-EXIST', quantity: 1 }],
        fulfillment: 'PICKUP'
      })
    ).toThrow(/not available/);

    const soldOut = db.diningMenuItems.find(m => m.available === false);
    if (soldOut) {
      expect(() =>
        diningOrderService.quote({
          venueId: soldOut.venueId,
          items: [{ menuItemId: soldOut.id, quantity: 1 }],
          fulfillment: 'PICKUP'
        })
      ).toThrow(/not available/);
    }
  });

  it('refuses a dish from another restaurant on this cart', () => {
    // Menu ids are globally unique, so this is a client bug worth catching: a
    // cart that mixes two kitchens is quoted by one of them and silently wrong.
    // Refused with the same "not available" a sold-out dish gets, so the cart
    // cannot be priced (or placed) with a dish this kitchen does not cook.
    const foreign = cheapestMenuItemFor('dining_red_cat_italian');
    const request = {
      venueId,
      items: [{ menuItemId: cheapestMenuItemFor(venueId) }, { menuItemId: foreign }].map(i => ({ ...i, quantity: 1 })),
      fulfillment: 'PICKUP' as const
    };
    expect(() => diningOrderService.quote(request)).toThrow(/not available/);
    expect(() => diningOrderService.createOrder(traveller, request)).toThrow(/not available/);
  });

  it('never returns a refusal and a total together', () => {
    for (const request of [
      { venueId: pickupOnlyVenueId, items: [{ menuItemId: cheapestMenuItemFor(pickupOnlyVenueId), quantity: 2 }], fulfillment: 'DELIVERY' as const, zoneId: 'masbat' },
      { venueId: deliveryVenueId, items: [{ menuItemId: cheapestMenuItemFor(deliveryVenueId), quantity: 1 }], fulfillment: 'DELIVERY' as const, zoneId: 'masbat' }
    ]) {
      const quote = diningOrderService.quote(request);
      if (quote.refusal) {
        expect(quote.priceBreakdown.deliveryFeeEGP).toBe(0);
        expect(quote.priceBreakdown.totalEGP).toBe(quote.priceBreakdown.subtotalEGP);
      }
    }
  });
});

describe('placing an order', () => {
  let paymentsBefore: number;
  let ledgerBefore: number;

  beforeEach(() => {
    paymentsBefore = db.payments.length;
    ledgerBefore = db.ledgerEntries.length;
  });

  it('recomputes the price at placement time', () => {
    // A cart total the client sends is ignored, never honoured.
    const order = diningOrderService.createOrder(traveller, {
      venueId,
      items: [{ menuItemId, quantity: 2 }],
      fulfillment: 'DELIVERY',
      zoneId: 'lighthouse',
      // A tampered payload, exactly as a hostile client would send it.
      priceBreakdown: { subtotalEGP: 1, deliveryFeeEGP: 0, serviceFeeEGP: 0, totalEGP: 1, currency: 'EGP' }
    } as any);

    const item = db.diningMenuItems.find(m => m.id === menuItemId)!;
    expect(order.priceBreakdown.totalEGP).toBeGreaterThan(item.priceEGP);
    expect(order.priceBreakdown.totalEGP).not.toBe(1);
  });

  it('snapshots names and unit prices so a later menu edit cannot rewrite it', () => {
    const order = diningOrderService.createOrder(traveller, {
      venueId,
      items: [{ menuItemId, quantity: 1 }],
      fulfillment: 'PICKUP'
    });
    const originalName = order.lines[0].nameEn;
    const originalPrice = order.lines[0].unitPriceEGP;

    const item = db.diningMenuItems.find(m => m.id === menuItemId)!;
    const before = item.priceEGP;
    item.priceEGP = 999;
    try {
      const reread = diningOrderService.findOrder(order.id)!;
      expect(reread.lines[0].nameEn).toBe(originalName);
      expect(reread.lines[0].unitPriceEGP).toBe(originalPrice);
    } finally {
      item.priceEGP = before;
    }
  });

  it('binds the order to the session, not to a body userId', () => {
    const order = diningOrderService.createOrder(
      { userId: 'user-from-session', role: 'Traveler' },
      { venueId, items: [{ menuItemId, quantity: 1 }], fulfillment: 'PICKUP', userId: 'someone-else' } as any
    );
    expect(order.userId).toBe('user-from-session');
  });

  it('moves no money — no payment row, no ledger entry', () => {
    // Phase 4 owns the money path. Asserting it is absent now means a later
    // change cannot introduce a half-wired ledger by accident.
    const order = diningOrderService.createOrder(traveller, {
      venueId,
      items: [{ menuItemId, quantity: 1 }],
      fulfillment: 'PICKUP'
    });
    expect(order.paymentMethod).toBe('CASH_ON_ARRIVAL');
    expect(db.payments.length).toBe(paymentsBefore);
    expect(db.ledgerEntries.length).toBe(ledgerBefore);
  });

  it('replays an idempotency key instead of cooking twice', () => {
    const request = {
      venueId,
      items: [{ menuItemId, quantity: 1 }],
      fulfillment: 'PICKUP' as const,
      idempotencyKey: 'double-tap-key'
    };
    const first = diningOrderService.createOrder(traveller, request);
    const second = diningOrderService.createOrder(traveller, request);
    expect(second.id).toBe(first.id);
    expect(db.diningOrders.filter(o => o.idempotencyKey === 'double-tap-key')).toHaveLength(1);
  });

  it('refuses to place an order the quote refused', () => {
    expect(() =>
      diningOrderService.createOrder(traveller, {
        venueId: pickupOnlyVenueId,
        items: [{ menuItemId: cheapestMenuItemFor(pickupOnlyVenueId), quantity: 2 }],
        fulfillment: 'DELIVERY',
        zoneId: 'masbat'
      })
    ).toThrow(/does not deliver/i);
  });

  it('starts in PENDING_CONFIRMATION and records the promise', () => {
    const order = diningOrderService.createOrder(traveller, {
      venueId,
      items: [{ menuItemId, quantity: 2 }],
      fulfillment: 'DELIVERY',
      zoneId: 'lighthouse'
    });
    expect(order.status).toBe('PENDING_CONFIRMATION');
    expect(order.etaMinutes).toBeGreaterThan(0);
    expect(order.promisedAt).toBeTruthy();
    expect(order.deliveryLocation?.zoneId).toBe('lighthouse');
    expect(order.orderRef).toMatch(/^DNG-[A-Z0-9]{3}-\d{4}-[A-F0-9]{6}$/);
  });

  it('keeps the address the traveler typed', () => {
    const order = diningOrderService.createOrder(traveller, {
      venueId,
      items: [{ menuItemId, quantity: 2 }],
      fulfillment: 'DELIVERY',
      zoneId: 'masbat',
      addressText: 'Behind the mosque, blue door',
      locationSource: 'manual'
    });
    expect(order.deliveryLocation?.addressText).toBe('Behind the mosque, blue door');
    expect(order.deliveryLocation?.source).toBe('manual');
  });
});

function mostExpensiveMenuItemFor(venue: string): string {
  const items = db.diningMenuItems.filter(m => m.venueId === venue && m.available);
  return items.reduce((a, b) => (b.priceEGP > a.priceEGP ? b : a)).id;
}

function cheapestMenuItemFor(venue: string): string {
  const items = db.diningMenuItems.filter(m => m.venueId === venue && m.available);
  return items.reduce((a, b) => (b.priceEGP < a.priceEGP ? b : a)).id;
}