import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';

// Receipts are written under dataPath(); point it at a throwaway directory so
// this suite never touches the real data/ folder.
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-stay-sec-'));
vi.mock('../../server/db/paths', async importOriginal => {
  const actual = await importOriginal<typeof import('../../server/db/paths')>();
  return { ...actual, dataPath: (...segments: string[]) => path.join(tmpData, ...segments) };
});

import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { hotelBookingRouter } from '../../server/api/hotelBookingRoutes';
import { adminHotelRouter } from '../../server/api/adminHotelRoutes';
import { reserveStay } from '../../server/services/hotelBookingService';
import { apiAccessPolicy } from '../../server/middleware/apiAccessPolicy';
import type { RoomTypeEntity } from '../../server/db/schema';

/**
 * Stay endpoints, over real HTTP: who may read, change or upload against a
 * reservation. A stay reference exposes a name, a phone number and what
 * someone paid, so every route is checked against the session, never against
 * an id in the request.
 *
 * The session is simulated by a test header (x-test-user: id:role) in place of
 * the cookie middleware; everything after it — access policy and routers — is
 * the production code.
 */

const ONE_PX_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let server: Server;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use((req, _res, next) => {
    const who = req.header('x-test-user');
    if (who) {
      const [userId, role] = who.split(':');
      (req as any).user = { userId, role, name: userId, email: `${userId}@example.com` };
    }
    next();
  });
  app.use('/api', apiAccessPolicy);
  app.use('/api/hotel-bookings', hotelBookingRouter);
  app.use('/api/admin/hotel', adminHotelRouter);
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(tmpData, { recursive: true, force: true });
});

const roomType: RoomTypeEntity = {
  id: 'RT-SEC', accommodationId: 'ACC-SEC', skuId: 'SKU-RT-SEC', supplierId: 'SUP-SEC',
  code: 'STD', name: 'Standard', nameAr: 'عادي', maxGuestsPerUnit: 2, baseNightlyEGP: 1000,
  minNights: 1, maxNights: 30, cancellationPolicyHours: 48, totalUnits: 3,
  inventorySource: 'SEED_PUBLISHED', amenities: [], images: [], active: true, displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const call = (method: string, url: string, user?: string, body?: unknown) =>
  fetch(`${base}${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let ref = '';

beforeEach(() => {
  resetDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-01T09:00:00Z'));
  db.roomTypes.push({ ...roomType });
  ref = reserveStay(
    {
      accommodationId: 'ACC-SEC', roomTypeId: 'RT-SEC', checkIn: '2026-07-10', checkOut: '2026-07-12',
      rooms: 1, adults: 2, children: 0, paymentMethod: 'INSTAPAY', idempotencyKey: `SEC-${Math.random()}`,
    },
    { userId: 'USR-A', name: 'Guest A', phone: '+201000000001', email: 'a@example.com' }
  ).bookingRef;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('reading a stay', () => {
  it('refuses an anonymous caller', async () => {
    expect((await call('GET', `/api/hotel-bookings/${ref}`)).status).toBe(401);
    expect((await call('GET', '/api/hotel-bookings')).status).toBe(401);
  });

  it('refuses another traveller (no IDOR by reference)', async () => {
    expect((await call('GET', `/api/hotel-bookings/${ref}`, 'USR-B:Traveler')).status).toBe(403);
  });

  it('lists only the caller\'s own stays', async () => {
    const mine = await (await call('GET', '/api/hotel-bookings', 'USR-A:Traveler')).json();
    const theirs = await (await call('GET', '/api/hotel-bookings', 'USR-B:Traveler')).json();
    expect(mine.stays.map((s: { bookingRef: string }) => s.bookingRef)).toEqual([ref]);
    expect(theirs.stays).toEqual([]);
  });

  it('lets the owner and staff read it', async () => {
    expect((await call('GET', `/api/hotel-bookings/${ref}`, 'USR-A:Traveler')).status).toBe(200);
    expect((await call('GET', `/api/hotel-bookings/${ref}`, 'USR-OPS:Operations')).status).toBe(200);
  });
});

describe('changing a stay', () => {
  it('refuses another traveller cancelling or moving it', async () => {
    expect((await call('POST', `/api/hotel-bookings/${ref}/cancel`, 'USR-B:Traveler', {})).status).toBe(403);
    expect(
      (await call('POST', `/api/hotel-bookings/${ref}/reschedule`, 'USR-B:Traveler', { checkIn: '2026-07-20', checkOut: '2026-07-22' })).status
    ).toBe(403);
  });

  it('refuses filing a reservation under someone else\'s trip', async () => {
    db.trips.push({ id: 'TRIP-B', userId: 'USR-B' } as typeof db.trips[number]);
    const res = await call('POST', '/api/hotel-bookings', 'USR-A:Traveler', {
      accommodationId: 'ACC-SEC', roomTypeId: 'RT-SEC', checkIn: '2026-07-10', checkOut: '2026-07-12',
      rooms: 1, adults: 2, paymentMethod: 'INSTAPAY', idempotencyKey: 'TRIP-STEAL', tripId: 'TRIP-B',
    });
    expect(res.status).toBe(403);
  });

  it('accepts only https:// receipt links', async () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com/r.png', 'data:image/png;base64,AAAA']) {
      const res = await call('POST', `/api/hotel-bookings/${ref}/payment-proof`, 'USR-A:Traveler', { proofUrl: bad });
      expect(res.status, bad).toBe(400);
    }
    const ok = await call('POST', `/api/hotel-bookings/${ref}/payment-proof`, 'USR-A:Traveler', { proofUrl: 'https://example.com/r.png' });
    expect(ok.status).toBe(200);
  });

  it("takes \"I've sent it\" from the owner only, with a real Egyptian mobile", async () => {
    expect((await call('POST', `/api/hotel-bookings/${ref}/payment-claim`, 'USR-B:Traveler', { payerNumber: '01000000002' })).status).toBe(403);
    expect((await call('POST', `/api/hotel-bookings/${ref}/payment-claim`, undefined, { payerNumber: '01000000002' })).status).toBe(401);
    expect((await call('POST', `/api/hotel-bookings/${ref}/payment-claim`, 'USR-A:Traveler', { payerNumber: 'not-a-number' })).status).toBe(400);
    // A smuggled status is dropped, never applied: a claim is not a payment.
    const ok = await call('POST', `/api/hotel-bookings/${ref}/payment-claim`, 'USR-A:Traveler', { payerNumber: '+201000000002', status: 'CONFIRMED' });
    expect(ok.status).toBe(200);
    const { booking } = await ok.json();
    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(booking.paymentInstructions.payerNumber).toBe('01000000002');
  });
});

describe('receipt photos', () => {
  it('stores an image for the owner and serves it back only to the owner and staff', async () => {
    const up = await call('POST', `/api/hotel-bookings/${ref}/payment-receipt`, 'USR-A:Traveler', { dataUrl: ONE_PX_PNG });
    expect(up.status).toBe(200);
    expect((await up.json()).booking.paymentProofUrl).toBe(`/api/hotel-bookings/${ref}/payment-receipt`);

    const own = await call('GET', `/api/hotel-bookings/${ref}/payment-receipt`, 'USR-A:Traveler');
    expect(own.status).toBe(200);
    expect(own.headers.get('cache-control')).toContain('no-store');
    expect((await call('GET', `/api/hotel-bookings/${ref}/payment-receipt`, 'USR-OPS:Operations')).status).toBe(200);
    expect((await call('GET', `/api/hotel-bookings/${ref}/payment-receipt`, 'USR-B:Traveler')).status).toBe(403);
    expect((await call('GET', `/api/hotel-bookings/${ref}/payment-receipt`)).status).toBe(401);
  });

  it('refuses another traveller uploading against the stay', async () => {
    const res = await call('POST', `/api/hotel-bookings/${ref}/payment-receipt`, 'USR-B:Traveler', { dataUrl: ONE_PX_PNG });
    expect(res.status).toBe(403);
  });

  it('refuses anything that is not a real image', async () => {
    const fake = 'data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64');
    const res = await call('POST', `/api/hotel-bookings/${ref}/payment-receipt`, 'USR-A:Traveler', { dataUrl: fake });
    expect(res.status).toBe(400);
  });
});

describe('staff-only stay actions', () => {
  it('refuses a traveller every desk action', async () => {
    for (const action of ['mark-paid', 'respond', 'settle-balance', 'check-in', 'no-show', 'complete', 'cancel']) {
      const res = await call('POST', `/api/admin/hotel/bookings/${ref}/${action}`, 'USR-A:Traveler', { approve: true });
      expect(res.status, action).toBe(403);
    }
    expect((await call('GET', '/api/admin/hotel/bookings', 'USR-A:Traveler')).status).toBe(403);
  });

  it('refuses an anonymous caller', async () => {
    expect((await call('GET', '/api/admin/hotel/bookings')).status).toBe(401);
  });

  it('lets Operations act', async () => {
    expect((await call('POST', `/api/admin/hotel/bookings/${ref}/mark-paid`, 'USR-OPS:Operations')).status).toBe(200);
  });
});

describe('rate calendar', () => {
  it('is staff-only', async () => {
    expect((await call('GET', '/api/admin/hotel/room-types/RT-SEC/calendar?from=2026-07-09&to=2026-07-13', 'USR-A:Traveler')).status).toBe(403);
  });

  it("shows each night's price, overrides, closures and rooms held", async () => {
    const ops = 'USR-OPS:Operations';
    // An override price on the 10th and a closed 12th.
    expect((await call('POST', '/api/admin/hotel/room-types/RT-SEC/rate-nights', ops, { date: '2026-07-10', nightlyEGP: 1500 })).status).toBe(201);
    expect((await call('POST', '/api/admin/hotel/room-types/RT-SEC/rate-nights', ops, { date: '2026-07-12', closed: true, closedReason: 'Private event' })).status).toBe(201);

    const res = await call('GET', '/api/admin/hotel/room-types/RT-SEC/calendar?from=2026-07-09&to=2026-07-13', ops);
    expect(res.status).toBe(200);
    const cal = await res.json();
    const night = (d: string) => cal.nights.find((n: { date: string }) => n.date === d);
    expect(cal.totalUnits).toBe(3);
    expect(night('2026-07-09')).toMatchObject({ nightlyEGP: 1000, overridden: false, booked: 0 });
    // The fixture stay holds 1 room on the 10th and 11th.
    expect(night('2026-07-10')).toMatchObject({ nightlyEGP: 1500, overridden: true, booked: 1 });
    expect(night('2026-07-11')).toMatchObject({ booked: 1 });
    expect(night('2026-07-12')).toMatchObject({ closed: true, closedReason: 'Private event', booked: 0 });
  });

  it('refuses a window longer than 62 nights', async () => {
    expect((await call('GET', '/api/admin/hotel/room-types/RT-SEC/calendar?from=2026-07-01&to=2026-10-01', 'USR-OPS:Operations')).status).toBe(400);
  });
});

describe('desk cancel', () => {
  it('cancels an awaiting-deposit stay (the old button called decline and failed)', async () => {
    const res = await call('POST', `/api/admin/hotel/bookings/${ref}/cancel`, 'USR-OPS:Operations', { reason: 'cancelled by staff' });
    expect(res.status).toBe(200);
    expect(db.hotelBookings.find(b => b.bookingRef === ref)!.status).toBe('CANCELLED');
  });
});

