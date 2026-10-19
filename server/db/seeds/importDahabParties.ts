import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import type { DahabPartyEntity } from '../schema';
import {
  PARTY_CATEGORIES,
  PARTY_ZONES,
  type PartyCategory,
  type PartyZone
} from '../../../src/shared/dahabParties';

export interface ImportPartiesResult {
  success: boolean;
  importedAt: string;
  total: number;
  created: number;
  updated: number;
  /** Importer-owned rows removed because the seed no longer holds them. */
  pruned: number;
  summary: string;
}

/** One row of data/dahab_parties.json. */
interface PartySeed {
  id: string;
  category: PartyCategory;
  zone: PartyZone;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  venueName: string;
  durationHours: number;
  frequency: DahabPartyEntity['frequency'];
  days: string[];
  nextDate?: string;
  startTime: string;
  priceModel: DahabPartyEntity['priceModel'];
  priceEgp: number;
  transportEgp?: number;
  priceUsd?: number;
  entryType: DahabPartyEntity['entryType'];
  musicGenres: DahabPartyEntity['musicGenres'];
  vibeTags: DahabPartyEntity['vibeTags'];
  includes: DahabPartyEntity['includes'];
  meetingPointName: string;
  meetingPointLat: number;
  meetingPointLng: number;
  bookingType: DahabPartyEntity['bookingType'];
  whatsappNumber?: string;
  audience: DahabPartyEntity['audience'];
  isFeatured: boolean;
  imageUrls: string[];
  organizerInstagram?: string;
  licenseVerified: boolean;
}

const DAY_NAMES = new Set([
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]);

/** Structural validation the catalogue leans on (filters, tonight logic, UI). */
function validateSeedRow(entry: PartySeed): void {
  if (!entry.id || !/^[a-z0-9_]+$/.test(entry.id)) {
    throw new Error(`Party seed row has a missing or malformed id: ${JSON.stringify(entry.id)}`);
  }
  if (!entry.nameEn || !entry.nameAr) {
    throw new Error(`Party seed row ${entry.id} is missing nameEn or nameAr.`);
  }
  if (!PARTY_CATEGORIES.includes(entry.category)) {
    throw new Error(`Party seed row ${entry.id} has unknown category: ${entry.category}`);
  }
  if (!PARTY_ZONES.includes(entry.zone)) {
    throw new Error(`Party seed row ${entry.id} has unknown zone: ${entry.zone}`);
  }
  if (entry.frequency === 'weekly' && entry.days.length === 0) {
    throw new Error(`Party seed row ${entry.id} is weekly but declares no days.`);
  }
  if (entry.days.some(d => !DAY_NAMES.has(d))) {
    throw new Error(`Party seed row ${entry.id} declares a day outside Monday..Sunday: ${entry.days.join(',')}`);
  }
  if ((entry.frequency === 'monthly' || entry.frequency === 'one_time') && !entry.nextDate) {
    throw new Error(`Party seed row ${entry.id} is ${entry.frequency} but has no nextDate.`);
  }
  if (!/^\d{2}:\d{2}$/.test(entry.startTime)) {
    throw new Error(`Party seed row ${entry.id} has a malformed startTime: ${entry.startTime}`);
  }
  if (typeof entry.priceEgp !== 'number' || entry.priceEgp < 0) {
    throw new Error(`Party seed row ${entry.id} has a malformed priceEgp.`);
  }
  if (entry.bookingType === 'whatsapp' && !entry.whatsappNumber) {
    throw new Error(`Party seed row ${entry.id} books via WhatsApp but has no whatsappNumber.`);
  }
}

/**
 * Idempotent import of the curated Dahab parties catalogue.
 *
 * Reads the committed data/dahab_parties.json (boot-critical: THROWS when
 * missing, matching importDahabRestaurants' discipline) and converges it onto
 * db.dahabParties:
 *
 *   - a seed row describing no stored party CREATES it;
 *   - a seed row describing a stored party REFRESHES its seed-owned fields
 *     (everything except bookingIntentCount and the admin audit fields, which
 *     belong to the running system, not to the catalogue);
 *   - a stored, seed-owned row whose id left the seed is PRUNED.
 *
 * Ownership follows the restaurants importer's prefix discipline: every row
 * the admin CRUD creates carries the `party_admin_` prefix, and this importer
 * never prunes that prefix. Everything else in the table is seed-owned.
 */
const ADMIN_ROW_PREFIX = 'party_admin_';

export function importDahabParties(): ImportPartiesResult {
  const datasetPath = seedPath('dahab_parties.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(
      `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the parties directory.`
    );
  }

  let raw: { parties?: PartySeed[] };
  try {
    raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
  }

  const entries = raw.parties || [];
  const seenIds = new Set<string>();
  for (const entry of entries) {
    validateSeedRow(entry);
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate party id in seed: ${entry.id}.`);
    }
    seenIds.add(entry.id);
  }

  let created = 0;
  let updated = 0;

  const toEntity = (entry: PartySeed): DahabPartyEntity => ({
    id: entry.id,
    category: entry.category,
    zone: entry.zone,
    nameEn: entry.nameEn,
    nameAr: entry.nameAr,
    descriptionEn: entry.descriptionEn,
    descriptionAr: entry.descriptionAr,
    venueName: entry.venueName,
    durationHours: entry.durationHours,
    frequency: entry.frequency,
    days: entry.days,
    ...(entry.nextDate ? { nextDate: entry.nextDate } : {}),
    startTime: entry.startTime,
    priceModel: entry.priceModel,
    priceEgp: entry.priceEgp,
    ...(entry.transportEgp !== undefined ? { transportEgp: entry.transportEgp } : {}),
    ...(entry.priceUsd !== undefined ? { priceUsd: entry.priceUsd } : {}),
    entryType: entry.entryType,
    musicGenres: entry.musicGenres,
    vibeTags: entry.vibeTags,
    includes: entry.includes,
    meetingPointName: entry.meetingPointName,
    meetingPointLat: entry.meetingPointLat,
    meetingPointLng: entry.meetingPointLng,
    bookingType: entry.bookingType,
    ...(entry.whatsappNumber ? { whatsappNumber: entry.whatsappNumber } : {}),
    audience: entry.audience,
    isFeatured: entry.isFeatured,
    imageUrls: entry.imageUrls,
    ...(entry.organizerInstagram ? { organizerInstagram: entry.organizerInstagram } : {}),
    licenseVerified: entry.licenseVerified,
    bookingIntentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  for (const entry of entries) {
    const prior = db.dahabParties.find(p => p.id === entry.id);
    if (!prior) {
      db.dahabParties.push(toEntity(entry));
      created += 1;
      continue;
    }
    // Seed-owned fields refresh; system-owned fields (bookingIntentCount,
    // createdAt, updatedBy, updatedAt) do not — the catalog's authority stops
    // at content. A re-import with identical content must be a no-op, so the
    // comparison ignores the audit stamps a previous run wrote.
    const next = toEntity(entry);
    next.bookingIntentCount = prior.bookingIntentCount;
    next.createdAt = prior.createdAt;
    next.updatedBy = prior.updatedBy;
    const stripAudit = (p: DahabPartyEntity) => {
      const copy: Record<string, unknown> = { ...p };
      delete copy.updatedAt;
      return JSON.stringify(copy);
    };
    if (stripAudit(prior) !== stripAudit(next)) {
      next.updatedAt = new Date().toISOString();
      db.dahabParties[db.dahabParties.indexOf(prior)] = next;
      updated += 1;
    }
  }

  // Prune seed-owned rows whose id left the seed. Admin-created rows carry the
  // party_admin_ prefix and are never this importer's to remove.
  let pruned = 0;
  for (let i = db.dahabParties.length - 1; i >= 0; i--) {
    const row = db.dahabParties[i];
    if (!row.id.startsWith(ADMIN_ROW_PREFIX) && !seenIds.has(row.id)) {
      db.dahabParties.splice(i, 1);
      pruned += 1;
    }
  }

  // Persist like every other importer: converging in memory and vanishing on
  // the next restart is the exact defect the restaurants importer documents.
  db.saveToDisk();

  return {
    success: true,
    importedAt: new Date().toISOString(),
    total: entries.length,
    created,
    updated,
    pruned,
    summary:
      `Dahab parties catalogue imported: ${entries.length} rows ` +
      `(${created} created, ${updated} refreshed, ${pruned} pruned).`
  };
}
