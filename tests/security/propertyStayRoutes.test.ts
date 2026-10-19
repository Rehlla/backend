import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { propertyStayRouter } from '../../server/api/propertyStayRoutes';
import { apiAccessPolicy } from '../../server/middleware/apiAccessPolicy';
import { markPaid, reserveStay } from '../../server/services/hotelBookingService';
import { checkStay } from '../../server/services/hotelAvailabilityService';
import type { RoomTypeEntity } from '../../server/db/schema';

/**
 * The hotel owner's portal (/api/property-stays), over real HTTP.
 *
 * The supplier link on the session is the only key: an owner sees and acts on
 * stays booked with their own supplierId, never another property's, and never
 * the guest's email or payment receipt. Session simulated by x-test-user
 * (id:role[:supplierId]); the access policy and router are production code.
 */

let server: Server;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const who = req.header('x-test-user');
    if (who) {
      const [userId, role, supplierId] = who.split(':');
      (req as any).user = { userId, role, supplierId: supplierId || undefined, name: userId, email: `${userId}@example.com` };
    }
    next();
  });
  app.use('/api', apiAccessPolicy);
  app.use('/api/property-stays', propertyStayRouter);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const roomType = (id: string, supplierId: string): RoomTypeEntity => ({
  id, accommodationId: `ACC-${id}`, skuId: `SKU-${id}`, supplierId,
  code: 'STD', name: 'Standard', nameAr: 'عادي', maxGuestsPerUnit: 2, baseNightlyEGP: 1000,
  minNights: 1, maxNights: 30, cancellationPolicyHours: 48, totalUnits: 2,
  inventorySource: 'SEED_PUBLISHED', amenities: [], images: [], active: true, displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

const OWNER = 'USR-OWNER:Supplier:SUP-MINE';
const OTHER_OWNER = 'USR-OTHER:Supplier:SUP-THEIRS';
const staff = { userId: 'USR-OPS', role: 'Operations' };
const guest = { userId: 'USR-G', name: 'Guest G', phone: '+201000000009', email: 'guest@example.com' };

const call = (method: string, url: string, user?: string, body?: unknown) =>
  fetch(`${base}${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let mine = '';
let theirs = '';

beforeEach(() => {
  resetDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-01T09:00:00Z'));
  db.roomTypes.push(roomType('RT-MINE', 'SUP-MINE'), roomType('RT-THEIRS', 'SUP-THEIRS'));
  const book = (rt: string) => {
    const b = reserveStay(
      { accommodationId: `ACC-${rt}`, roomTypeId: rt, checkIn: '2026-07-10', checkOut: '2026-07-12', rooms: 1, adults: 2, children: 0, paymentMethod: 'INSTAPAY', idempotencyKey: `K-${rt}` },
      guest
    );
    markPaid(b.bookingRef, staff, {});
    return b.bookingRef;
  };
  mine = book('RT-MINE');
  theirs = book('RT-THEIRS');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('who may use the portal', () => {
  it('refuses travellers and anonymous callers', async () => {
    expect((await call('GET', '/api/property-stays', 'USR-G:Traveler')).status).toBe(403);
    expect((await call('GET', '/api/property-stays')).status).toBe(401);
  });

  it('refuses a Supplier account that is not linked to a property', async () => {
    expect((await call('GET', '/api/property-stays', 'USR-X:Supplier')).status).toBe(403);
  });
});

describe('an owner\'s stays', () => {
  it('lists only the owner\'s own stays, without the guest\'s email or receipt', async () => {
    const { stays } = await (await call('GET', '/api/property-stays', OWNER)).json();
    expect(stays.map((s: { bookingRef: string }) => s.bookingRef)).toEqual([mine]);
    expect(stays[0]).toMatchObject({ status: 'PENDING_CONFIRMATION', travelerName: 'Guest G', travelerPhone: '+201000000009' });
    expect(JSON.stringify(stays[0])).not.toContain('guest@example.com');
    expect(stays[0]).not.toHaveProperty('paymentProofUrl');
  });

  it('lets the owner confirm their own stay', async () => {
    const res = await call('POST', `/api/property-stays/${mine}/respond`, OWNER, { approve: true });
    expect(res.status).toBe(200);
    expect((await res.json()).stay.status).toBe('CONFIRMED');
  });

  it('answers 404 for another property\'s stay, so refs cannot be probed', async () => {
    expect((await call('POST', `/api/property-stays/${theirs}/respond`, OWNER, { approve: true })).status).toBe(404);
    expect(db.hotelBookings.find(b => b.bookingRef === theirs)!.status).toBe('PENDING_CONFIRMATION');
  });

  it('lets the desk look at a property by supplierId', async () => {
    const { stays } = await (await call('GET', '/api/property-stays?supplierId=SUP-THEIRS', 'USR-OPS:Operations')).json();
    expect(stays.map((s: { bookingRef: string }) => s.bookingRef)).toEqual([theirs]);
  });
});

describe('an owner\'s calendar', () => {
  it('lists only the owner\'s room types', async () => {
    const { roomTypes } = await (await call('GET', '/api/property-stays/room-types', OWNER)).json();
    expect(roomTypes.map((r: { id: string }) => r.id)).toEqual(['RT-MINE']);
  });

  it('shows the owner\'s calendar and hides another property\'s', async () => {
    const own = await call('GET', '/api/property-stays/room-types/RT-MINE/calendar?from=2026-07-09&to=2026-07-12', OWNER);
    expect(own.status).toBe(200);
    expect((await own.json()).nights.find((n: { date: string }) => n.date === '2026-07-10').booked).toBe(1);
    expect((await call('GET', '/api/property-stays/room-types/RT-THEIRS/calendar?from=2026-07-09&to=2026-07-12', OWNER)).status).toBe(404);
  });

  it('closes and reopens the owner\'s nights, which the booking engine honours', async () => {
    const close = await call('POST', '/api/property-stays/room-types/RT-MINE/availability', OWNER, { from: '2026-07-20', to: '2026-07-22', closed: true, reason: 'Renovation' });
    expect(close.status).toBe(200);
    const range = { accommodationId: 'ACC-RT-MINE', roomTypeId: 'RT-MINE', checkIn: '2026-07-20', checkOut: '2026-07-22', rooms: 1 };
    expect(checkStay(range).available).toBe(false);

    await call('POST', '/api/property-stays/room-types/RT-MINE/availability', OWNER, { from: '2026-07-20', to: '2026-07-22', closed: false });
    expect(checkStay(range).available).toBe(true);
  });

  it('cannot close another property\'s nights', async () => {
    const res = await call('POST', '/api/property-stays/room-types/RT-THEIRS/availability', OWNER, { from: '2026-07-20', to: '2026-07-22', closed: true });
    expect(res.status).toBe(404);
  });
});
