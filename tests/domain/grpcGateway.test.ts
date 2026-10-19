import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { startGrpcServer, loadDahabGrpcPackage } from '../../server/grpc/server';
import { authService } from '../../server/services/authService';
import { db } from '../../server/db/database';

/**
 * gRPC gateway, slice 1 — a real client against a real in-process server.
 *
 * Pins the same contracts as the GraphQL tests: identity comes from a
 * validated Bearer session token (the exact authService path Express uses —
 * never a caller-supplied id), threads are isolated per user, and task
 * lookups keep the REST flat-404 semantics (NOT_FOUND for a missing task and
 * for somebody else's alike).
 */

const createdMessageIds: string[] = [];
const registeredUserIds: string[] = [];
const registeredSessionTokens: string[] = [];
const grpcSeededAccommodationIds: string[] = [];
const grpcSeededRoomTypeIds: string[] = [];

type ServerHandle = Awaited<ReturnType<typeof startGrpcServer>>;
let serverHandle: ServerHandle = null;
let client: any;

beforeAll(async () => {
  // A random high port; a collision makes startGrpcServer resolve null and
  // we simply try another (the same graceful posture as the boot wiring).
  for (let attempt = 0; attempt < 6 && !serverHandle; attempt++) {
    serverHandle = await startGrpcServer(39000 + Math.floor(Math.random() * 5000), '127.0.0.1');
  }
  expect(serverHandle, 'the gRPC gateway must boot on at least one port').not.toBeNull();
  const pkg = loadDahabGrpcPackage();
  client = new pkg.dahab.v1.DahabService(serverHandle!.endpoint, grpc.credentials.createInsecure());
});

afterAll(async () => {
  try {
    client?.close();
  } catch {
    /* already gone */
  }
  await serverHandle?.shutdown();
  // Leave the shared in-memory store exactly as found (same discipline as the
  // GraphQL test): later files count db.supportMessages and db.users.
  for (const id of createdMessageIds) {
    const idx = db.supportMessages.findIndex((m) => m.id === id);
    if (idx >= 0) db.supportMessages.splice(idx, 1);
  }
  for (const token of registeredSessionTokens) {
    const idx = db.sessions.findIndex((s) => s.token === token);
    if (idx >= 0) db.sessions.splice(idx, 1);
  }
  for (const id of registeredUserIds) {
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx >= 0) db.users.splice(idx, 1);
  }
  for (const id of grpcSeededAccommodationIds) {
    const idx = db.accommodations.findIndex((a) => a.id === id);
    if (idx >= 0) db.accommodations.splice(idx, 1);
  }
  for (const id of grpcSeededRoomTypeIds) {
    const idx = db.roomTypes.findIndex((rt) => rt.id === id);
    if (idx >= 0) db.roomTypes.splice(idx, 1);
  }
});

function rpc<T = any>(method: string, request: unknown, token?: string): Promise<{ err: any; res: T }> {
  const metadata = new grpc.Metadata();
  if (token) metadata.set('authorization', `Bearer ${token}`);
  return new Promise((resolve) => {
    client[method](request, metadata, (err: any, res: any) => resolve({ err, res }));
  });
}

function register(email: string) {
  const result = authService.register('gRPC Gateway Test', email, '', 'Grpc-Smoke-2026-Test!', 'Traveler');
  registeredUserIds.push(result.user.id);
  registeredSessionTokens.push(result.session.token);
  return result;
}

describe('gRPC gateway (slice 1)', () => {
  it('answers platform health without a session (public, like GET /api/health)', async () => {
    const { err, res } = await rpc('GetPlatformHealth', {});
    expect(err).toBeNull();
    expect(res.status).toBe('ok');
    expect(typeof res.ledgerBalanced).toBe('boolean');
  });

  it('refuses support reads without a token (deny-by-default)', async () => {
    const { err } = await rpc('GetSupportThread', {});
    expect(err?.code).toBe(grpc.status.UNAUTHENTICATED);
  });

  it('resolves identity from the Bearer session token and keeps threads isolated', async () => {
    const travelerA = register('grpc.a@test.dahab');
    const travelerB = register('grpc.b@test.dahab');

    const created = await rpc('CreateSupportMessage', {
      message: 'Is the dive center open on Fridays?',
      urgent: true
    }, travelerA.session.token);
    expect(created.err).toBeNull();
    // Identity is the token's user, never a caller-supplied field.
    expect(created.res.userId).toBe(travelerA.user.id);
    expect(created.res.status).toBe('OPEN');
    expect(created.res.urgent).toBe(true);
    createdMessageIds.push(created.res.id);

    const mine = await rpc('GetSupportThread', {}, travelerA.session.token);
    expect(mine.err).toBeNull();
    expect(mine.res.openCount).toBeGreaterThanOrEqual(1);
    expect(mine.res.messages.every((m: any) => m.userId === travelerA.user.id)).toBe(true);

    const theirs = await rpc('GetSupportThread', {}, travelerB.session.token);
    expect(theirs.err).toBeNull();
    expect(theirs.res.messages).toEqual([]);
  });

  it('rejects a lifted token that is not a session (invalid credentials)', async () => {
    const { err } = await rpc('GetSupportThread', {}, 'not-a-real-token');
    expect(err?.code).toBe(grpc.status.UNAUTHENTICATED);
  });

  it('returns the caller DayGI memory, auto-created on first read', async () => {
    const traveler = register('grpc.memory@test.dahab');
    const { err, res } = await rpc('GetDayGiMemory', {}, traveler.session.token);
    expect(err).toBeNull();
    expect(res.userId).toBe(traveler.user.id);
    expect(res.preferences.pace).toBe('Balanced');
  });

  it('answers public catalogue reads without a session (slice 2)', async () => {
    // Public like GET /api/accommodations?view=card — no token required.
    const cards = await rpc('ListAccommodationCards', { propertyTypes: ['hotel'] });
    expect(cards.err).toBeNull();
    expect(Array.isArray(cards.res.cards)).toBe(true);
    expect(Array.isArray(cards.res.areas)).toBe(true);
    expect(typeof cards.res.stats.total).toBe('number');
    for (const card of cards.res.cards) {
      expect(typeof card.id).toBe('string');
      expect(typeof card.slug).toBe('string');
      expect(typeof card.perNightEgp).toBe('number');
    }

    const areas = await rpc('ListAreas', {});
    expect(areas.err).toBeNull();
    expect(Array.isArray(areas.res.areas)).toBe(true);

    // Zero-valued scalars mean "unset"; a nonsense amenity matches nothing.
    const none = await rpc('ListAccommodationCards', { mustHaveAmenities: ['helipad-with-a-marina-and-a-waterfall'] });
    expect(none.err).toBeNull();
    expect(none.res.stats.total).toBe(0);
  });

  it('prices a real stay like REST: room types, quote, NOT_FOUND, INVALID_ARGUMENT (slice 3)', async () => {
    // Seed a minimal sellable property (same fixture idea as the GraphQL test).
    if (!db.accommodations.some((a) => a.id === 'ACC-GRPC-QUOTE')) {
      db.accommodations.push({
        id: 'ACC-GRPC-QUOTE',
        slug: 'grpc-quote-test-villa',
        name: 'gRPC Quote Test Villa',
        nameAr: 'فيلة اختبار gRPC',
        propertyType: 'hotel',
        category: 'boutique',
        priceBand: 'moderate',
        areaId: 'area-lighthouse',
        area: 'lighthouse',
        areaName: 'Lighthouse',
        areaNameAr: 'الفنار',
        rating: 4.5,
        reviewCount: 10,
        typeChips: [],
        typeChipsAr: [],
        tagline: 'Quiet',
        taglineAr: 'هادئ',
        description: 'Test property',
        descriptionAr: 'مبيت للاختبار',
        amenities: [],
        amenitiesAr: [],
        perNightEGP: 100,
        packageNights: 3,
        rooms: 4,
        maxGuests: 2,
        bestFor: '',
        bestForAr: '',
        note: '',
        noteAr: '',
        skuId: 'SKU-GRPC-QUOTE',
        active: true,
        featured: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      } as any);
      db.roomTypes.push({
        id: 'RT-GRPC-QUOTE',
        accommodationId: 'ACC-GRPC-QUOTE',
        skuId: 'SKU-GRPC-QUOTE',
        supplierId: 'SUP-GRPC-QUOTE',
        code: 'STD',
        name: 'Standard',
        nameAr: 'قياسي',
        maxGuestsPerUnit: 2,
        baseNightlyEGP: 100,
        minNights: 1,
        maxNights: 30,
        cancellationPolicyHours: 48,
        totalUnits: 3,
        inventorySource: 'ADMIN_VERIFIED',
        amenities: [],
        images: [],
        active: true,
        displayOrder: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      } as any);
      grpcSeededAccommodationIds.push('ACC-GRPC-QUOTE');
      grpcSeededRoomTypeIds.push('RT-GRPC-QUOTE');
    }

    const futureDate = (offsetDays: number) =>
      new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

    const types = await rpc('ListRoomTypes', { slug: 'grpc-quote-test-villa' });
    expect(types.err).toBeNull();
    expect(types.res.accommodationId).toBe('ACC-GRPC-QUOTE');
    expect(types.res.roomTypes).toHaveLength(1);
    expect(types.res.roomTypes[0].id).toBe('RT-GRPC-QUOTE');
    expect(types.res.heldBack).toBe(false);

    const quoted = await rpc('QuoteStay', {
      slug: 'grpc-quote-test-villa',
      roomTypeId: 'RT-GRPC-QUOTE',
      checkIn: futureDate(3),
      checkOut: futureDate(5),
      rooms: 1,
      adults: 2,
      children: 0
    });
    expect(quoted.err).toBeNull();
    expect(quoted.res.nights).toBe(2);
    expect(quoted.res.baseEgp).toBe(200);
    expect(quoted.res.totalEgp).toBeGreaterThanOrEqual(200);
    expect(quoted.res.currency).toBe('EGP');
    expect(quoted.res.nightsDetail).toHaveLength(2);
    expect(quoted.res.nightsDetail[0].nightlyEgp).toBe(100);

    // NOT_FOUND for an unknown slug — the rpc confirms nothing.
    const missing = await rpc('ListRoomTypes', { slug: 'no-such-property' });
    expect(missing.err?.code).toBe(grpc.status.NOT_FOUND);

    const missingQuote = await rpc('QuoteStay', {
      slug: 'no-such-property', roomTypeId: 'RT-X',
      checkIn: futureDate(3), checkOut: futureDate(5), rooms: 1, adults: 2
    });
    expect(missingQuote.err?.code).toBe(grpc.status.NOT_FOUND);

    // Bad dates on a real property map to INVALID_ARGUMENT, mirroring REST's 400.
    const badDates = await rpc('QuoteStay', {
      slug: 'grpc-quote-test-villa',
      roomTypeId: 'RT-GRPC-QUOTE',
      checkIn: futureDate(5),
      checkOut: futureDate(3),
      rooms: 1,
      adults: 2
    });
    expect(badDates.err?.code).toBe(grpc.status.INVALID_ARGUMENT);
    expect(badDates.err?.message).toMatch(/Check-out must be after check-in/);
  });

  it('keeps the REST flat-404 semantics: NOT_FOUND for missing AND foreign tasks', async () => {
    const traveler = register('grpc.tasks@test.dahab');
    const missing = await rpc('GetDayGiTask', { taskId: 'TASK-DOES-NOT-EXIST' }, traveler.session.token);
    expect(missing.err?.code).toBe(grpc.status.NOT_FOUND);

    const empty = await rpc('ListDayGiTasks', { tripId: 'TRIP-DOES-NOT-EXIST' }, traveler.session.token);
    expect(empty.err).toBeNull();
    expect(empty.res.tasks).toEqual([]);

    const noTrip = await rpc('ListDayGiTasks', {}, traveler.session.token);
    expect(noTrip.err?.code).toBe(grpc.status.INVALID_ARGUMENT);
  });
});
