import { describe, it, expect, afterAll } from 'vitest';
import { graphql, parse } from 'graphql';
import { schema } from '../../server/graphql/schema';
import { rootValue } from '../../server/graphql/resolvers';
import { queryDepth } from '../../server/graphql/handler';
import { db } from '../../server/db/database';
import type { AccommodationEntity, RoomTypeEntity } from '../../server/db/schema';

/**
 * GraphQL gateway, slice 1.
 *
 * These tests execute the schema directly — the same resolvers the Express
 * handler runs — so they pin the resolver contract: identity comes from the
 * context (never the payload) and ownership rules match REST exactly.
 */

const createdMessageIds: string[] = [];
const seededAccommodationIds: string[] = [];
const seededRoomTypeIds: string[] = [];

/** Minimal sellable property so the quote path runs against real domain math. */
function seedQuoteProperty() {
  if (db.accommodations.some((a) => a.id === 'ACC-GRAPHQL-QUOTE')) return;
  const accommodation: AccommodationEntity = {
    id: 'ACC-GRAPHQL-QUOTE',
    slug: 'graphql-quote-test-villa',
    name: 'Quote Test Villa',
    nameAr: 'فيلا اختبار السعر',
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
    skuId: 'SKU-GRAPHQL-QUOTE',
    active: true,
    featured: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  const roomType: RoomTypeEntity = {
    id: 'RT-GRAPHQL-QUOTE',
    accommodationId: accommodation.id,
    skuId: accommodation.skuId,
    supplierId: 'SUP-GRAPHQL-QUOTE',
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
  };
  db.accommodations.push(accommodation);
  db.roomTypes.push(roomType);
  seededAccommodationIds.push(accommodation.id);
  seededRoomTypeIds.push(roomType.id);
}

const futureDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function run(
  source: string,
  actor: { userId: string; role: string } | null,
  variableValues?: Record<string, unknown>
) {
  return graphql({
    schema,
    rootValue,
    source,
    contextValue: { actor },
    variableValues
  });
}

afterAll(() => {
  // Leave the shared in-memory store exactly as found: supportEscalation
  // counts every message in db.supportMessages and must never see ours, and
  // other suites walk the accommodations/roomTypes collections.
  for (const id of createdMessageIds) {
    const idx = db.supportMessages.findIndex(m => m.id === id);
    if (idx >= 0) db.supportMessages.splice(idx, 1);
  }
  for (const id of seededAccommodationIds) {
    const idx = db.accommodations.findIndex(a => a.id === id);
    if (idx >= 0) db.accommodations.splice(idx, 1);
  }
  for (const id of seededRoomTypeIds) {
    const idx = db.roomTypes.findIndex(rt => rt.id === id);
    if (idx >= 0) db.roomTypes.splice(idx, 1);
  }
});

describe('GraphQL gateway (slice 1)', () => {
  it('answers the platform query without a session', async () => {
    const r = await run(
      '{ platform { status service adapter ledgerBalanced ledgerChainIntact } }',
      null
    );
    expect(r.errors).toBeUndefined();
    const platform = (r.data as any).platform;
    expect(platform.status).toBe('ok');
    expect(typeof platform.ledgerBalanced).toBe('boolean');
    expect(typeof platform.ledgerChainIntact).toBe('boolean');
  });

  it('files a support message for the session user and keeps threads isolated', async () => {
    const travelerA = { userId: 'USR-GRAPHQL-A', role: 'Traveler' };

    const created = await run(
      'mutation($input: SupportMessageInput!) { supportCreateMessage(input: $input) { id userId message urgent status } }',
      travelerA,
      { input: { message: 'Is a late checkout possible?', urgent: true } }
    );
    expect(created.errors).toBeUndefined();
    const message = (created.data as any).supportCreateMessage;
    // Identity is the session actor's, never a field the client sent.
    expect(message.userId).toBe('USR-GRAPHQL-A');
    expect(message.status).toBe('OPEN');
    expect(message.urgent).toBe(true);
    createdMessageIds.push(message.id);

    const mine = await run('{ support { openCount messages { userId } } }', travelerA);
    expect(mine.errors).toBeUndefined();
    const threadA = (mine.data as any).support;
    expect(threadA.openCount).toBeGreaterThan(0);
    expect(threadA.messages.every((m: any) => m.userId === 'USR-GRAPHQL-A')).toBe(true);

    const other = await run(
      '{ support { messages { userId } } }',
      { userId: 'USR-GRAPHQL-B', role: 'Traveler' }
    );
    expect((other.data as any).support.messages).toEqual([]);
  });

  it('refuses support reads without a session (defence in depth)', async () => {
    const r = await run('{ support { openCount } }', null);
    expect(r.errors?.[0]?.message).toContain('Authentication required');
  });

  it('keeps DayGI flat-null semantics for missing tasks and auto-creates first-time memory', async () => {
    const traveler = { userId: 'USR-GRAPHQL-A', role: 'Traveler' };
    const r = await run(
      '{ daygi { task(taskId: "TASK-DOES-NOT-EXIST") { taskId } tasks(tripId: "TRIP-DOES-NOT-EXIST") { taskId } memory { userId preferences { pace } } } }',
      traveler
    );
    expect(r.errors).toBeUndefined();
    const daygi = (r.data as any).daygi;
    // Null for a missing task — and the same null for a foreign one, so the
    // field never confirms a task exists.
    expect(daygi.task).toBeNull();
    expect(daygi.tasks).toEqual([]);
    expect(daygi.memory.userId).toBe('USR-GRAPHQL-A');
    expect(daygi.memory.preferences.pace).toBe('Balanced');
  });

  it('answers public catalogue card queries without a session (slice 2)', async () => {
    const r = await run(
      '{ accommodationCards { stats { total averageRating totalReviews } cards { id slug name perNightEGP packageTotalEGP propertyType } areas { id name } } }',
      null
    );
    // Public like GET /api/accommodations?view=card — the policy exception is
    // resolver-gated, and these fields are the anonymous browsing surface.
    expect(r.errors).toBeUndefined();
    const result = (r.data as any).accommodationCards;
    expect(Array.isArray(result.cards)).toBe(true);
    expect(Array.isArray(result.areas)).toBe(true);
    expect(typeof result.stats.total).toBe('number');
    // Card invariants: priced, typed, and the compact projection.
    for (const card of result.cards) {
      expect(typeof card.id).toBe('string');
      expect(typeof card.slug).toBe('string');
      expect(typeof card.perNightEGP).toBe('number');
      expect(card.packageTotalEGP).toBeGreaterThanOrEqual(0);
    }
  });

  it('answers the areas guide without a session', async () => {
    const r = await run('{ areas { id name nameAr } }', null);
    expect(r.errors).toBeUndefined();
    expect(Array.isArray((r.data as any).areas)).toBe(true);
  });

  it('applies card filters exactly like REST — a nonsense amenity matches nothing', async () => {
    const r = await run(
      'query($f: AccommodationCardFilters) { accommodationCards(filters: $f) { stats { total } } }',
      null,
      { f: { mustHaveAmenities: ['helipad-with-a-marina-and-a-waterfall'] } }
    );
    expect(r.errors).toBeUndefined();
    expect((r.data as any).accommodationCards.stats.total).toBe(0);
  });

  it('prices a real stay through the same validation ladder as REST (slice 3)', async () => {
    seedQuoteProperty();

    const types = await run(
      '{ roomTypes(slug: "graphql-quote-test-villa") { accommodationId roomTypes { id name baseNightlyEGP totalUnits maxGuestsPerUnit } heldBack } }',
      null
    );
    expect(types.errors).toBeUndefined();
    const roomTypes = (types.data as any).roomTypes;
    expect(roomTypes.accommodationId).toBe('ACC-GRAPHQL-QUOTE');
    expect(roomTypes.roomTypes).toHaveLength(1);
    expect(roomTypes.roomTypes[0].id).toBe('RT-GRAPHQL-QUOTE');
    expect(roomTypes.heldBack).toBe(false);

    const quoted = await run(
      'query($slug: String!, $input: StayQuoteInput!) { stayQuote(slug: $slug, input: $input) { nights baseEGP totalEGP currency rooms adults minNights } }',
      null,
      {
        slug: 'graphql-quote-test-villa',
        input: { roomTypeId: 'RT-GRAPHQL-QUOTE', checkIn: futureDate(3), checkOut: futureDate(5), rooms: 1, adults: 2, children: 0 }
      }
    );
    expect(quoted.errors).toBeUndefined();
    const quote = (quoted.data as any).stayQuote;
    expect(quote.nights).toBe(2);
    expect(quote.baseEGP).toBe(200); // 2 nights × 100 EGP base nightly rate
    expect(quote.totalEGP).toBeGreaterThanOrEqual(200);
    expect(quote.currency).toBe('EGP');
    expect(quote.minNights).toBe(1);

    // Flat-null for an unknown slug — the resolver confirms nothing.
    const missing = await run('{ roomTypes(slug: "no-such-property") { accommodationId } }', null);
    expect(missing.errors).toBeUndefined();
    expect((missing.data as any).roomTypes).toBeNull();

    const missingQuote = await run(
      'query($slug: String!, $input: StayQuoteInput!) { stayQuote(slug: $slug, input: $input) { totalEGP } }',
      null,
      { slug: 'no-such-property', input: { roomTypeId: 'RT-X', checkIn: futureDate(3), checkOut: futureDate(5), rooms: 1, adults: 2 } }
    );
    expect((missingQuote.data as any).stayQuote).toBeNull();

    // Bad dates on a real property surface the REST route's own error text.
    const badDates = await run(
      'query($slug: String!, $input: StayQuoteInput!) { stayQuote(slug: $slug, input: $input) { totalEGP } }',
      null,
      { slug: 'graphql-quote-test-villa', input: { roomTypeId: 'RT-GRAPHQL-QUOTE', checkIn: futureDate(5), checkOut: futureDate(3), rooms: 1, adults: 2 } }
    );
    expect(badDates.errors?.[0]?.message).toMatch(/Check-out must be after check-in/);
  });

  it('caps query depth before execution (parse-level DoS guard)', async () => {
    // Deeply nested garbage: the depth cap must refuse this class of query
    // before validation or execution ever matters.
    const deep = parse('{ a { b { c { d { e { f { g { h { i { j { k { l { m } } } } } } } } } } } } }');
    expect(queryDepth(deep)).toBe(13);
    // A schema-shaped query sits well under the cap.
    const shallow = parse('{ daygi { tasks(tripId: "T") { steps { state } } } }');
    expect(queryDepth(shallow)).toBe(4);
  });
});
