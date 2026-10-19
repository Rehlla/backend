import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { importDahabMenus } from '../../server/db/seeds/importDahabMenus';
import { EXPANDED_DINING_VENUES } from '../../server/data/dkosExpansionDataPart2';
import {
  DiningOrderError,
  allowedOrderTransitions,
  diningOrderService,
  isCancellable
} from '../../server/services/diningOrderService';
import { DiningOrderEntity, DiningVenueEntity } from '../../server/db/schema';

/**
 * Order state machine, ownership, and who is allowed to drive it.
 *
 * Two failure modes this covers that are invisible in the happy path:
 *
 *  - A transition table that is too permissive. A double-clicked status button
 *    must not be able to skip the kitchen straight to DELIVERED, and an order
 *    that is already cooked must not be silently cancellable (the food exists).
 *  - Ownership leaks. Reading someone else's order must 404, not 403, because
 *    confirming the reference exists is itself the disclosure.
 */

const VENUE = 'dining_ali_baba_seafood';
const ITEM = 'AB-05';
const traveller = { userId: 'user-life-1', role: 'Traveler' };
const stranger = { userId: 'user-life-2', role: 'Traveler' };
const ops = { userId: 'user-ops-1', role: 'Operations' };

let counter = 0;

function placeOrder(overrides: Record<string, unknown> = {}): DiningOrderEntity {
  return diningOrderService.createOrder(traveller, {
    venueId: VENUE,
    items: [{ menuItemId: ITEM, quantity: 2 }],
    fulfillment: 'DELIVERY',
    zoneId: 'lighthouse',
    idempotencyKey: `life-${counter++}`,
    ...overrides
  } as any);
}

beforeAll(() => {
  if (db.diningVenues.length === 0) {
    db.diningVenues.push(...(EXPANDED_DINING_VENUES as DiningVenueEntity[]));
  }
  importDahabMenus();
});

beforeEach(() => {
  // Each test starts from a clean slice so an order left mid-flow by one test
  // cannot make the next one pass or fail for the wrong reason.
  db.diningOrders.splice(0, db.diningOrders.length);
});

describe('order state machine', () => {
  it('starts at PENDING_CONFIRMATION with nothing decided', () => {
    const order = placeOrder();
    expect(order.status).toBe('PENDING_CONFIRMATION');
    expect(allowedOrderTransitions('PENDING_CONFIRMATION')).toContain('CONFIRMED');
  });

  it('walks a delivery from confirmation to delivered', () => {
    const order = placeOrder();
    const path = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

    for (const next of path) {
      const moved = diningOrderService.advanceStatus(order.id, next);
      expect(moved.status).toBe(next);
    }
    expect(diningOrderService.findOrder(order.id)!.status).toBe('DELIVERED');
  });

  it('walks a pickup order without a delivery leg', () => {
    const order = placeOrder({ fulfillment: 'PICKUP', zoneId: undefined });
    diningOrderService.advanceStatus(order.id, 'CONFIRMED');
    diningOrderService.advanceStatus(order.id, 'PREPARING');
    const ready = diningOrderService.advanceStatus(order.id, 'READY_FOR_PICKUP');
    expect(ready.status).toBe('READY_FOR_PICKUP');

    // A pickup order cannot be "out for delivery" — there is nobody carrying
    // it, so the state would be a lie the traveler sees on their screen.
    expect(() => diningOrderService.advanceStatus(order.id, 'OUT_FOR_DELIVERY')).toThrow(/pickup/i);
  });

  it('refuses to skip the kitchen', () => {
    const order = placeOrder();
    expect(() => diningOrderService.advanceStatus(order.id, 'DELIVERED')).toThrow(DiningOrderError);
    expect(diningOrderService.findOrder(order.id)!.status).toBe('PENDING_CONFIRMATION');
  });

  it('refuses the same transition twice', () => {
    const order = placeOrder();
    diningOrderService.advanceStatus(order.id, 'CONFIRMED');
    expect(() => diningOrderService.advanceStatus(order.id, 'CONFIRMED')).toThrow(/cannot move/i);
  });

  it('treats a delivered order as final', () => {
    const order = placeOrder();
    for (const next of ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const) {
      diningOrderService.advanceStatus(order.id, next);
    }
    expect(() => diningOrderService.advanceStatus(order.id, 'CANCELLED')).toThrow(/cannot move/i);
    expect(allowedOrderTransitions('DELIVERED')).toEqual([]);
  });

  it('lets operations reject an order with a reason', () => {
    const order = placeOrder();
    const rejected = diningOrderService.advanceStatus(order.id, 'REJECTED', 'Kitchen is full tonight');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.cancellationReason).toBe('Kitchen is full tonight');
  });
});

describe('cancellation', () => {
  it('is available until the food is made, and not after', () => {
    const early = placeOrder();
    expect(isCancellable(early.status)).toBe(true);

    const cooked = placeOrder();
    diningOrderService.advanceStatus(cooked.id, 'CONFIRMED');
    diningOrderService.advanceStatus(cooked.id, 'PREPARING');
    diningOrderService.advanceStatus(cooked.id, 'READY_FOR_PICKUP');

    // By now the fish is cooked. Refusing late is kinder than taking money for
    // a dish that is already on the way.
    expect(isCancellable(diningOrderService.findOrder(cooked.id)!.status)).toBe(false);
    expect(() => diningOrderService.cancelOrder(traveller, cooked.id)).toThrow(/cannot be cancelled/i);
  });

  it('refuses to cancel an order already on the way', () => {
    const order = placeOrder();
    for (const next of ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] as const) {
      diningOrderService.advanceStatus(order.id, next);
    }
    expect(() => diningOrderService.cancelOrder(traveller, order.id)).toThrow(DiningOrderError);
  });

  it('records why it was cancelled', () => {
    const order = placeOrder();
    const cancelled = diningOrderService.cancelOrder(traveller, order.id, 'Changed my mind');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toBe('Changed my mind');
  });
});

describe('ownership', () => {
  it('lets a traveler read their own order', () => {
    const order = placeOrder();
    expect(diningOrderService.mayRead(traveller, order)).toBe(true);
  });

  it('does not let one traveler read another\'s order', () => {
    const order = placeOrder();
    expect(diningOrderService.mayRead(stranger, order)).toBe(false);
  });

  it('answers 404, not 403, for someone else\'s order', () => {
    // The status is the point: 403 would confirm the reference exists.
    const order = placeOrder();
    let status = 0;
    try {
      diningOrderService.cancelOrder(stranger, order.id);
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(404);
    expect(diningOrderService.findOrder(order.id)!.status).toBe('PENDING_CONFIRMATION');
  });

  it('lets operations see every order', () => {
    const order = placeOrder();
    expect(diningOrderService.mayRead(ops, order)).toBe(true);
    expect(diningOrderService.mayRead({ userId: 'x', role: 'Admin' }, order)).toBe(true);
  });

  it('does not give a Supplier the operations read that Phase 4 will own', () => {
    const order = placeOrder();
    expect(diningOrderService.mayRead({ userId: 's', role: 'Supplier' }, order)).toBe(false);
  });
});

describe('listing orders', () => {
  it('returns a traveller only their own, newest first', () => {
    placeOrder({ idempotencyKey: 'a' });
    placeOrder({ idempotencyKey: 'b' });
    const strangerOrder = diningOrderService.createOrder(stranger, {
      venueId: VENUE,
      items: [{ menuItemId: ITEM, quantity: 1 }],
      fulfillment: 'PICKUP',
      idempotencyKey: 'c'
    });

    const mine = diningOrderService.listOrders(traveller);
    expect(mine.length).toBe(2);
    expect(mine.every(o => o.userId === traveller.userId)).toBe(true);
    expect(mine.map(o => o.createdAt)).toEqual([...mine.map(o => o.createdAt)].sort().reverse());
    expect(mine.some(o => o.id === strangerOrder.id)).toBe(false);
  });

  it('returns everything to operations', () => {
    placeOrder();
    placeOrder();
    diningOrderService.createOrder(stranger, {
      venueId: VENUE,
      items: [{ menuItemId: ITEM, quantity: 1 }],
      fulfillment: 'PICKUP',
      idempotencyKey: 'ops'
    });
    expect(diningOrderService.listOrders(ops).length).toBe(3);
  });

  it('finds an order by its quotable reference as well as its id', () => {
    // Support reads "DNG-XYZ-2026-ABC123" off the phone.
    const order = placeOrder();
    expect(diningOrderService.findOrder(order.orderRef)!.id).toBe(order.id);
    expect(diningOrderService.findOrder(order.orderRef.toLowerCase())!.id).toBe(order.id);
    expect(diningOrderService.findOrder('nope')).toBeUndefined();
  });
});

describe('the catalogue orders against', () => {
  it('only lists venues that actually have a menu', () => {
    const orderable = diningOrderService.listOrderableVenues();
    expect(orderable.length).toBeGreaterThan(0);
    // Every listed venue must be placeable, or the list advertises a dead end.
    for (const venue of orderable) {
      expect(diningOrderService.menuFor(venue.id).length).toBeGreaterThan(0);
      expect(venue.slug).toBeTruthy();
    }
  });

  it('exposes a table SKU for every orderable venue', () => {
    // This is what makes a reservation settle through /api/commerce/hold.
    for (const venue of diningOrderService.listOrderableVenues()) {
      const sku = diningOrderService.tableSkuFor(venue);
      expect(sku, venue.id).toBeTruthy();
      expect(sku!.serviceType).toBe('dining');
      expect(sku!.timeSlots?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('hides sold-out dishes but keeps them in the record', () => {
    const menu = diningOrderService.menuFor(VENUE);
    expect(menu.every(m => m.available)).toBe(true);
    const withSoldOut = diningOrderService.menuFor(VENUE, { includeUnavailable: true });
    expect(withSoldOut.length).toBeGreaterThanOrEqual(menu.length);
  });
});