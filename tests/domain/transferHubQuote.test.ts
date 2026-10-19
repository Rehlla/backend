import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { transferHubService } from '../../server/services/transferHubService';
import { resetDb, seedTrip, nextIdempotencyKey } from '../helpers/fixtures';
import type { HubQuoteInput } from '../../server/services/transferHubService';

const NOW = new Date(2026, 5, 1, 9, 0, 0, 0);

function quoteInput(over: Partial<HubQuoteInput> = {}): HubQuoteInput {
  return {
    originId: 'cairo',
    destinationId: 'masbat',
    tierId: 'private',
    tripType: 'one',
    date: '2026-06-02',
    time: '09:30',
    passengers: 1,
    luggage: 'small',
    addonIds: [],
    mode: 'private',
    now: NOW,
    ...over
  };
}

describe('transfer hub quote', () => {
  beforeEach(() => {
    resetDb();
  });

  it('prices Masbat local at 90 / 160 / 235 and multiplies shared by passengers', () => {
    const shared = transferHubService.quotePublic(quoteInput({ originId: 'ZONE-MASBAT', tierId: 'shared' }));
    const privateCar = transferHubService.quotePublic(quoteInput({ originId: 'ZONE-MASBAT', tierId: 'private' }));
    const premium = transferHubService.quotePublic(quoteInput({ originId: 'ZONE-MASBAT', tierId: 'premium' }));
    expect(shared.sellEGP).toBe(90);
    expect(privateCar.sellEGP).toBe(160);
    expect(premium.sellEGP).toBe(235);
    const two = transferHubService.quotePublic(quoteInput({ originId: 'ZONE-MASBAT', tierId: 'shared', passengers: 2 }));
    expect(two.sellEGP).toBe(180);
    expect(shared).not.toHaveProperty('supplierCostEGP');
  });

  it('prices Cairo private at 2500 and bus plus last-mile at 650 with margins 400 and 120', () => {
    const direct = transferHubService.quoteOps(quoteInput());
    expect(direct.sellEGP).toBe(2500);
    expect(direct.marginEGP).toBe(400);
    expect(direct.supplierCostEGP).toBe(2100);

    const bus = transferHubService.quoteOps(quoteInput({ mode: 'bus' }));
    expect(bus.sellEGP).toBe(650);
    expect(bus.busLastMileEGP).toBe(650);
    expect(bus.marginEGP).toBe(120);

    const pub = transferHubService.quotePublic(quoteInput());
    expect(pub).not.toHaveProperty('supplierCostEGP');
    expect(pub).not.toHaveProperty('marginEGP');
  });

  it('prices Mansoura private at 3200 and bus plus last-mile at 780', () => {
    const direct = transferHubService.quotePublic(quoteInput({ originId: 'mans' }));
    expect(direct.sellEGP).toBe(3200);
    const bus = transferHubService.quotePublic(quoteInput({ originId: 'mans', mode: 'bus' }));
    expect(bus.sellEGP).toBe(780);
    expect(transferHubService.busesFor('mans').map(row => row.operatorId).sort()).toEqual(['eastdelta', 'gobus']);
    expect(transferHubService.busesFor('lux')).toEqual([]);
  });

  it('adds the return leg, an extra stop, an add-on, and the 12% early cut', () => {
    const round = transferHubService.quotePublic(quoteInput({ tripType: 'round', returnDate: '2026-06-08', returnTime: '14:00' }));
    expect(round.returnEGP).toBe(2125);
    expect(round.sellEGP).toBe(4625);

    const stop = transferHubService.quotePublic(quoteInput({ tripType: 'multi', stops: ['bluehole'] }));
    expect(stop.sellEGP).toBe(2750);

    const meet = transferHubService.quotePublic(quoteInput({ addonIds: ['meet'] }));
    expect(meet.sellEGP).toBe(2650);

    const early = transferHubService.quotePublic(quoteInput({ date: '2026-06-06', time: '09:30' }));
    expect(early.earlyDiscountEGP).toBe(300);
    expect(early.sellEGP).toBe(2200);
  });

  it('locks a pending cash booking, repeats on the same key, and closes cancellation inside 24 hours', () => {
    seedTrip();
    db.users.push({
      id: 'USR-TEST',
      email: 'traveler@example.test',
      name: 'Test Traveler',
      phone: '+201000000000',
      passwordHash: 'x',
      role: 'Traveler',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString()
    });

    const input = quoteInput({ date: '2026-06-08', time: '09:30' });
    const priced = transferHubService.quotePublic(input);
    const key = nextIdempotencyKey();
    const first = transferHubService.lock({
      travelerId: 'USR-TEST',
      tripId: 'TRIP-TEST',
      input,
      expectedSellEGP: priced.sellEGP,
      idempotencyKey: key
    });
    expect(first.booking.paymentState).toBe('PENDING');
    expect(first.booking.supplierState).toBe('PENDING_CONFIRMATION');
    expect(first.booking.amountEGP).toBe(priced.sellEGP);
    expect(first.booking.hubQuote?.supplierCostEGP).toBe(2100);

    transferHubService.lock({
      travelerId: 'USR-TEST',
      tripId: 'TRIP-TEST',
      input,
      expectedSellEGP: priced.sellEGP,
      idempotencyKey: key
    });
    expect(db.bookings).toHaveLength(1);

    const cancelled = transferHubService.cancel({
      bookingId: first.booking.id,
      travelerId: 'USR-TEST',
      role: 'Traveler',
      now: new Date(2026, 5, 2, 9, 0, 0, 0)
    });
    expect(cancelled.supplierState).toBe('CANCELLED');

    const soon = quoteInput({ date: '2026-06-01', time: '12:00' });
    const soonPrice = transferHubService.quotePublic(soon);
    const held = transferHubService.lock({
      travelerId: 'USR-TEST',
      tripId: 'TRIP-TEST',
      input: soon,
      expectedSellEGP: soonPrice.sellEGP,
      idempotencyKey: nextIdempotencyKey()
    });
    expect(() => transferHubService.cancel({
      bookingId: held.booking.id,
      travelerId: 'USR-TEST',
      role: 'Traveler',
      now: NOW
    })).toThrow(/24 hours/);
  });

  it('rejects a lock when the client total does not match the server', () => {
    seedTrip();
    expect(() => transferHubService.lock({
      travelerId: 'USR-TEST',
      tripId: 'TRIP-TEST',
      input: quoteInput(),
      expectedSellEGP: 1,
      idempotencyKey: nextIdempotencyKey()
    })).toThrow(/price changed/i);
  });
});
