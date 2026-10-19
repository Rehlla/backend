import { db } from '../db/database';
import type { DahabPartyEntity } from '../db/schema';
import {
  PARTY_CATEGORY_COLORS,
  PARTY_ZONE_INFO,
  partyWhatsappMessage,
  partyWhatsappUrl,
  type PartyBookIntentResponse,
  type PartyCategory,
  type PartyListResponse,
  type PartyTonightResponse,
  type PartyView,
  type PartyZoneSummary,
  type PartyZone,
} from '../../src/shared/dahabParties';

/**
 * Dahab parties & nightlife — the domain logic.
 *
 * The product rules this encodes (docs/PARTIES_FEATURE.md):
 *
 *   - MEETING POINTS, NEVER HOTEL PICKUPS. The Sharm/Hurghada "we collect you
 *     from your hotel at 21:00" model does not exist here; a party row carries
 *     a meeting point + optional priced transport instead.
 *   - CASH ON THE SPOT OR WHATSAPP. There is no card gateway in this feature
 *     by design — Dahab's real nightlife books over WhatsApp and pays at the
 *     door.
 *   - THE PUBLIC CATALOGUE ONLY EVER SERVES licenseVerified ROWS. The licence
 *     flag is the gate the admin panel sets after checking CDWS / Ministry of
 *     Tourism paperwork.
 *   - TONIGHT'S LIST IS CACHED FOR 6 HOURS. Dahab internet is weak; the
 *     acceptance criteria price tonight's list in <2s on a cold client.
 */

export class PartyServiceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Tonight logic
// ---------------------------------------------------------------------------

const DAY_INDEX_TO_NAME = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
] as const;

/** Local calendar date 'YYYY-MM-DD'. Tests inject `now` for determinism. */
function localCalendarDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whether a party happens on the given calendar date.
 *
 *   daily     → always
 *   weekly    → the date's weekday is in `days`
 *   monthly/one_time → `nextDate` matches the date exactly
 */
export function partyOccursOn(party: DahabPartyEntity, date: string): boolean {
  if (party.frequency === 'daily') return true;
  if (party.frequency === 'weekly') {
    const dayName = DAY_INDEX_TO_NAME[new Date(`${date}T12:00:00`).getDay()];
    return party.days.includes(dayName);
  }
  return party.nextDate === date;
}

// ---------------------------------------------------------------------------
// View projection
// ---------------------------------------------------------------------------

/** Wire projection. licenseVerified is asserted for public reads, not copied. */
function toView(party: DahabPartyEntity): PartyView {
  return {
    id: party.id,
    category: party.category,
    zone: party.zone,
    nameEn: party.nameEn,
    nameAr: party.nameAr,
    descriptionEn: party.descriptionEn,
    descriptionAr: party.descriptionAr,
    venueName: party.venueName,
    durationHours: party.durationHours,
    frequency: party.frequency,
    days: party.days,
    ...(party.nextDate ? { nextDate: party.nextDate } : {}),
    startTime: party.startTime,
    priceModel: party.priceModel,
    priceEgp: party.priceEgp,
    ...(party.transportEgp !== undefined ? { transportEgp: party.transportEgp } : {}),
    ...(party.priceUsd !== undefined ? { priceUsd: party.priceUsd } : {}),
    entryType: party.entryType,
    musicGenres: party.musicGenres,
    vibeTags: party.vibeTags,
    includes: party.includes,
    meetingPointName: party.meetingPointName,
    meetingPointLat: party.meetingPointLat,
    meetingPointLng: party.meetingPointLng,
    bookingType: party.bookingType,
    ...(party.whatsappNumber ? { whatsappNumber: party.whatsappNumber } : {}),
    audience: party.audience,
    isFeatured: party.isFeatured,
    imageUrls: party.imageUrls,
    ...(party.organizerInstagram ? { organizerInstagram: party.organizerInstagram } : {}),
    licenseVerified: party.licenseVerified,
    bookingIntentCount: party.bookingIntentCount
  };
}

// ---------------------------------------------------------------------------
// The 6-hour catalogue cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry<T> {
  payload: T;
  cachedAt: number;
  cachedUntil: string;
}

/** Injectable for tests; the service owns the real clock. */
let clock: () => number = () => Date.now();

function makeCacheEntry<T>(payload: T, now: number): CacheEntry<T> {
  return {
    payload,
    cachedAt: now,
    cachedUntil: new Date(now + CACHE_TTL_MS).toISOString()
  };
}

function readCache<T>(entry: CacheEntry<T> | undefined, now: number): { payload: T; cachedUntil: string; fromCache: boolean } | null {
  if (!entry) return null;
  if (now - entry.cachedAt >= CACHE_TTL_MS) return null;
  return { payload: entry.payload, cachedUntil: entry.cachedUntil, fromCache: true };
}

/** Cache per filter-signature: one entry per distinct query, list + tonight. */
const listCache = new Map<string, CacheEntry<PartyListResponse['parties']>>();
const tonightCache = new Map<string, CacheEntry<PartyTonightResponse['parties']>>();

/** Any admin write invalidates every cached list — the catalogue changed. */
function invalidateCaches(): void {
  listCache.clear();
  tonightCache.clear();
}

export function resetPartyCacheForTests(nowProvider?: () => number): void {
  listCache.clear();
  tonightCache.clear();
  clock = nowProvider ?? (() => Date.now());
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface PartyListFilters {
  zone?: PartyZone;
  category?: PartyCategory;
  vibe?: string;
  date?: string;
  priceMaxEgp?: number;
  freeOnly?: boolean;
  featuredOnly?: boolean;
  tonight?: boolean;
  q?: string;
}

function filterSignature(filters: PartyListFilters): string {
  return JSON.stringify(filters);
}

/** Sort: featured first, then earlier start, then name for determinism. */
function sortForDisplay(list: DahabPartyEntity[]): DahabPartyEntity[] {
  return [...list].sort((a, b) =>
    (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) ||
    a.startTime.localeCompare(b.startTime) ||
    a.nameEn.localeCompare(b.nameEn)
  );
}

function applyFilters(list: DahabPartyEntity[], filters: PartyListFilters, date: string): DahabPartyEntity[] {
  return list.filter(p => {
    if (filters.zone && p.zone !== filters.zone) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.vibe && !p.vibeTags.includes(filters.vibe as DahabPartyEntity['vibeTags'][number])) return false;
    if (filters.featuredOnly && !p.isFeatured) return false;
    if (filters.freeOnly && p.priceModel !== 'free') return false;
    if (filters.priceMaxEgp !== undefined && p.priceEgp > filters.priceMaxEgp) return false;
    if (filters.tonight && !partyOccursOn(p, date)) return false;
    if (filters.date && !filters.tonight && !partyOccursOn(p, filters.date)) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = [p.nameEn, p.nameAr, p.venueName, p.descriptionEn, p.descriptionAr]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Public catalogue reads
// ---------------------------------------------------------------------------

export function listParties(filters: PartyListFilters = {}): PartyListResponse {
  const now = clock();
  const signature = filterSignature(filters);
  const cached = readCache(listCache.get(signature), now);
  if (cached) {
    return { status: 'success', parties: cached.payload, count: cached.payload.length, cachedUntil: cached.cachedUntil, fromCache: true };
  }

  // The licence gate: unverified rows never leave the server on public reads.
  const verified = db.dahabParties.filter(p => p.licenseVerified);
  const filtered = sortForDisplay(applyFilters(verified, filters, localCalendarDate(new Date(now))));

  const entry = makeCacheEntry(filtered.map(toView), now);
  listCache.set(signature, entry);
  return {
    status: 'success',
    parties: entry.payload,
    count: entry.payload.length,
    cachedUntil: entry.cachedUntil,
    fromCache: false
  };
}

export function getPartyById(id: string): PartyView {
  const party = db.dahabParties.find(p => p.id === id && p.licenseVerified);
  if (!party) {
    throw new PartyServiceError(404, 'PARTY_NOT_FOUND', 'This party is not in tonight’s catalogue.');
  }
  return toView(party);
}

export function listTonightParties(dateOverride?: string): PartyTonightResponse {
  const now = clock();
  const date = dateOverride ?? localCalendarDate(new Date(now));
  const cached = readCache(tonightCache.get(date), now);
  if (cached) {
    return { status: 'success', date, parties: cached.payload, count: cached.payload.length, cachedUntil: cached.cachedUntil, fromCache: true };
  }

  const tonight = sortForDisplay(
    db.dahabParties.filter(p => p.licenseVerified && partyOccursOn(p, date))
  );

  const entry = makeCacheEntry(tonight.map(toView), now);
  tonightCache.set(date, entry);
  return {
    status: 'success',
    date,
    parties: entry.payload,
    count: entry.payload.length,
    cachedUntil: entry.cachedUntil,
    fromCache: false
  };
}

export function listZones(): { zones: PartyZoneSummary[] } {
  const verified = db.dahabParties.filter(p => p.licenseVerified);
  const zones: PartyZoneSummary[] = (Object.keys(PARTY_ZONE_INFO) as PartyZone[]).map(zoneId => {
    const info = PARTY_ZONE_INFO[zoneId];
    return {
      id: zoneId,
      nameEn: info.nameEn,
      nameAr: info.nameAr,
      lat: info.lat,
      lng: info.lng,
      partyCount: verified.filter(p => p.zone === zoneId).length
    };
  });
  return { zones };
}

/** Category legend for the map pins — the UI colours come from the shared
 * constant, so this stays data-only. */
export function listCategories(): { categories: { id: PartyCategory; color: string }[] } {
  return {
    categories: (Object.keys(PARTY_CATEGORY_COLORS) as PartyCategory[]).map(id => ({ id, color: PARTY_CATEGORY_COLORS[id] }))
  };
}

// ---------------------------------------------------------------------------
// Booking intent → WhatsApp
// ---------------------------------------------------------------------------

/**
 * Logs one booking intent and returns the ready-to-open WhatsApp link.
 *
 * The message is rendered server-side from the party row (name, date,
 * persons) — never from client-supplied text — so a tampered browser cannot
 * make an organizer receive a forged request. Public on purpose: WhatsApp
 * conversion is the booking flow, and demanding an account before showing a
 * phone number is how GetYourGuide lost this market.
 */
export function recordBookIntent(
  partyId: string,
  params: { targetDate: string; persons: number; language: 'en' | 'ar'; userId?: string }
): PartyBookIntentResponse {
  const party = db.dahabParties.find(p => p.id === partyId);
  if (!party || !party.licenseVerified) {
    throw new PartyServiceError(404, 'PARTY_NOT_FOUND', 'This party is not in tonight’s catalogue.');
  }
  if (party.bookingType !== 'whatsapp' || !party.whatsappNumber) {
    throw new PartyServiceError(
      409,
      'NOT_WHATSAPP_BOOKABLE',
      'This party does not take WhatsApp bookings — walk in instead.'
    );
  }

  const message = partyWhatsappMessage(party, params.language, {
    date: params.targetDate,
    persons: params.persons
  });
  const whatsappUrl = partyWhatsappUrl(party.whatsappNumber, message);

  party.bookingIntentCount += 1;
  party.updatedAt = new Date().toISOString();
  db.dahabPartyIntents.push({
    id: `party_intent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    partyId: party.id,
    targetDate: params.targetDate,
    persons: params.persons,
    language: params.language,
    ...(params.userId ? { userId: params.userId } : {}),
    createdAt: new Date().toISOString()
  });
  db.saveToDisk();

  return { whatsappUrl, message, intentCount: party.bookingIntentCount };
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

function requireParty(id: string): DahabPartyEntity {
  const party = db.dahabParties.find(p => p.id === id);
  if (!party) {
    throw new PartyServiceError(404, 'PARTY_NOT_FOUND', `No party with id ${id}.`);
  }
  return party;
}

/** Full-shape validation shared by create and update. */
function assertWriteShape(payload: Record<string, unknown>, { partial }: { partial: boolean }): void {
  const requiredText: [string, number][] = [
    ['nameEn', 160],
    ['nameAr', 160],
    ['venueName', 160],
    ['meetingPointName', 200],
    ['startTime', 5]
  ];
  for (const [field, max] of requiredText) {
    if (partial && payload[field] === undefined) continue;
    const value = payload[field];
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
      throw new PartyServiceError(400, 'VALIDATION', `${field} must be a non-empty string of at most ${max} characters.`);
    }
  }
  if (!partial || payload.meetingPointLat !== undefined) {
    const lat = Number(payload.meetingPointLat);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new PartyServiceError(400, 'VALIDATION', 'meetingPointLat must be a valid latitude.');
    }
  }
  if (!partial || payload.meetingPointLng !== undefined) {
    const lng = Number(payload.meetingPointLng);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new PartyServiceError(400, 'VALIDATION', 'meetingPointLng must be a valid longitude.');
    }
  }
  if (!partial || payload.durationHours !== undefined) {
    const hours = Number(payload.durationHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      throw new PartyServiceError(400, 'VALIDATION', 'durationHours must be between 0 and 24.');
    }
  }
  if (payload.priceEgp !== undefined) {
    const egp = Number(payload.priceEgp);
    if (!Number.isFinite(egp) || egp < 0 || egp > 100000) {
      throw new PartyServiceError(400, 'VALIDATION', 'priceEgp must be a non-negative amount.');
    }
  }
  if (payload.transportEgp !== undefined) {
    const egp = Number(payload.transportEgp);
    if (!Number.isFinite(egp) || egp < 0 || egp > 100000) {
      throw new PartyServiceError(400, 'VALIDATION', 'transportEgp must be a non-negative amount.');
    }
  }
  if (payload.priceUsd !== undefined && (typeof payload.priceUsd !== 'number' || payload.priceUsd < 0)) {
    throw new PartyServiceError(400, 'VALIDATION', 'priceUsd must be a non-negative number.');
  }
}

const ENUM_FIELDS: [string, readonly string[]][] = [
  ['category', Object.keys(PARTY_CATEGORY_COLORS)],
  ['zone', Object.keys(PARTY_ZONE_INFO)],
  ['frequency', ['daily', 'weekly', 'monthly', 'one_time']],
  ['priceModel', ['free', 'ticket', 'whatsapp', 'donation']],
  ['entryType', ['free', 'free_min_2_persons', 'ticket_includes_drink']],
  ['bookingType', ['walkin', 'whatsapp', 'local_ticket']],
  ['audience', ['backpackers', 'egyptian_youth', 'digital_nomads', 'couples', 'all']]
];

function applyEnumFields(entity: Partial<DahabPartyEntity>, payload: Record<string, unknown>, partial: boolean): void {
  for (const [field, allowed] of ENUM_FIELDS) {
    // Audience defaults to "all" on create. The other enums stay required.
    if (payload[field] === undefined && (partial || field === 'audience')) continue;
    const value = payload[field];
    if (!allowed.includes(String(value))) {
      throw new PartyServiceError(400, 'VALIDATION', `${field} must be one of: ${allowed.join(', ')}.`);
    }
    (entity as unknown as Record<string, unknown>)[field] = value;
  }
}

/** Admin list sees everything, including unverified rows awaiting paperwork. */
export function adminListParties(): { parties: DahabPartyEntity[] } {
  return { parties: sortForDisplay([...db.dahabParties]) };
}

export function adminCreateParty(
  payload: Record<string, unknown>,
  actingUserId: string
): DahabPartyEntity {
  assertWriteShape(payload, { partial: false });
  const id = String(payload.id || '').trim() || `party_admin_${Date.now().toString(36)}`;
  if (db.dahabParties.some(p => p.id === id)) {
    throw new PartyServiceError(409, 'PARTY_ID_TAKEN', `A party with id ${id} already exists.`);
  }
  if (String(payload.bookingType) === 'whatsapp' && !payload.whatsappNumber) {
    throw new PartyServiceError(400, 'VALIDATION', 'A WhatsApp-bookable party needs a whatsappNumber.');
  }

  const entity = {} as DahabPartyEntity;
  applyEnumFields(entity, payload, false);
  entity.id = id;
  entity.nameEn = String(payload.nameEn);
  entity.nameAr = String(payload.nameAr);
  entity.descriptionEn = String(payload.descriptionEn || '');
  entity.descriptionAr = String(payload.descriptionAr || '');
  entity.venueName = String(payload.venueName);
  entity.durationHours = Number(payload.durationHours);
  entity.frequency = entity.frequency || 'daily';
  entity.days = Array.isArray(payload.days) ? payload.days.map(String) : [];
  if (typeof payload.nextDate === 'string' && payload.nextDate) entity.nextDate = payload.nextDate;
  entity.startTime = String(payload.startTime);
  entity.priceModel = entity.priceModel || 'free';
  entity.priceEgp = payload.priceEgp === undefined ? 0 : Number(payload.priceEgp);
  if (payload.transportEgp !== undefined) entity.transportEgp = Number(payload.transportEgp);
  if (typeof payload.priceUsd === 'number') entity.priceUsd = payload.priceUsd;
  entity.entryType = entity.entryType || 'free';
  entity.musicGenres = (Array.isArray(payload.musicGenres) ? payload.musicGenres : []) as DahabPartyEntity['musicGenres'];
  entity.vibeTags = (Array.isArray(payload.vibeTags) ? payload.vibeTags : []) as DahabPartyEntity['vibeTags'];
  entity.includes = (Array.isArray(payload.includes) ? payload.includes : []) as DahabPartyEntity['includes'];
  entity.meetingPointName = String(payload.meetingPointName);
  entity.meetingPointLat = Number(payload.meetingPointLat);
  entity.meetingPointLng = Number(payload.meetingPointLng);
  entity.bookingType = entity.bookingType || 'walkin';
  if (typeof payload.whatsappNumber === 'string' && payload.whatsappNumber) entity.whatsappNumber = payload.whatsappNumber;
  entity.audience = entity.audience || 'all';
  entity.isFeatured = Boolean(payload.isFeatured);
  entity.imageUrls = (Array.isArray(payload.imageUrls) ? payload.imageUrls : []).map(String);
  if (typeof payload.organizerInstagram === 'string' && payload.organizerInstagram) entity.organizerInstagram = payload.organizerInstagram;
  entity.licenseVerified = Boolean(payload.licenseVerified);
  entity.bookingIntentCount = 0;
  entity.createdAt = new Date().toISOString();
  entity.updatedAt = new Date().toISOString();
  entity.updatedBy = actingUserId;

  db.dahabParties.push(entity);
  db.saveToDisk();
  invalidateCaches();
  return entity;
}

export function adminUpdateParty(
  id: string,
  payload: Record<string, unknown>,
  actingUserId: string
): DahabPartyEntity {
  const party = requireParty(id);
  assertWriteShape(payload, { partial: true });
  applyEnumFields(party, payload, true);

  const record = party as unknown as Record<string, unknown>;
  const TEXT_FIELD_LIMITS: Record<string, number> = {
    nameEn: 160, nameAr: 160, descriptionEn: 2000, descriptionAr: 2000,
    venueName: 160, meetingPointName: 200, startTime: 5,
    nextDate: 10, whatsappNumber: 32, organizerInstagram: 200
  };
  for (const [field, max] of Object.entries(TEXT_FIELD_LIMITS)) {
    const value = payload[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > max) {
      throw new PartyServiceError(400, 'VALIDATION', `${field} must be a string of at most ${max} characters.`);
    }
    if (value) record[field] = value;
  }
  for (const field of ['durationHours', 'priceEgp', 'transportEgp', 'priceUsd', 'meetingPointLat', 'meetingPointLng']) {
    const value = payload[field];
    if (value === undefined) continue;
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new PartyServiceError(400, 'VALIDATION', `${field} must be a number.`);
    }
    record[field] = num;
  }
  for (const field of ['days', 'musicGenres', 'vibeTags', 'includes', 'imageUrls']) {
    const value = payload[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      throw new PartyServiceError(400, 'VALIDATION', `${field} must be an array.`);
    }
    record[field] = value;
  }
  if (payload.isFeatured !== undefined) party.isFeatured = Boolean(payload.isFeatured);

  party.updatedAt = new Date().toISOString();
  party.updatedBy = actingUserId;
  db.saveToDisk();
  invalidateCaches();
  return party;
}

export function adminSetLicenseVerified(
  id: string,
  verified: boolean,
  actingUserId: string
): DahabPartyEntity {
  const party = requireParty(id);
  party.licenseVerified = verified;
  party.updatedAt = new Date().toISOString();
  party.updatedBy = actingUserId;
  db.saveToDisk();
  invalidateCaches();
  return party;
}

export function adminDeleteParty(id: string, actingUserId: string): void {
  const party = requireParty(id);
  db.dahabParties.splice(db.dahabParties.indexOf(party), 1);
  // Intent rows are an ops ledger of real interest; they stay after the party
  // is gone, exactly like ledger entries outlive a booking.
  db.saveToDisk();
  invalidateCaches();
}
