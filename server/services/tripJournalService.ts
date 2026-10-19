import crypto from 'crypto';
import { db } from '../db/database';
import { TripJournalEntryEntity, TripPlaceVisitedEntity } from '../db/schema';

/**
 * Trip Journal & Memory Service
 *
 * Manages diary entries and places-visited records for trips. Entries are
 * ordered chronologically and surfaced in the post-trip memory hub.
 * The system can auto-capture entries when bookings are confirmed.
 */

const nowIso = () => new Date().toISOString();
const genId = (prefix: string) => `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------

/**
 * Create a journal entry for a trip.
 */
export function createJournalEntry(input: {
  tripId: string;
  userId: string;
  title?: string;
  body: string;
  bodyAr?: string;
  photoUrl?: string;
  locationName?: string;
  locationNameAr?: string;
  tags?: string[];
  autoCaptured?: boolean;
}): TripJournalEntryEntity {
  const trip = db.trips.find(t => t.id === input.tripId);
  if (!trip) throw new Error(`Trip ${input.tripId} not found.`);
  if (trip.userId !== input.userId) throw new Error('You can only journal your own trips.');

  const now = nowIso();
  const entry: TripJournalEntryEntity = {
    id: genId('JOURNAL'),
    tripId: input.tripId,
    userId: input.userId,
    title: input.title,
    body: input.body,
    bodyAr: input.bodyAr,
    photoUrl: input.photoUrl,
    locationName: input.locationName,
    locationNameAr: input.locationNameAr,
    tags: input.tags || [],
    autoCaptured: input.autoCaptured ?? false,
    createdAt: now,
    updatedAt: now,
  };

  db.tripJournalEntries.push(entry);
  db.saveToDisk();
  return entry;
}

/**
 * Update an existing journal entry (only the owner can update).
 */
export function updateJournalEntry(
  entryId: string,
  userId: string,
  patch: Partial<Pick<TripJournalEntryEntity, 'title' | 'body' | 'bodyAr' | 'photoUrl' | 'locationName' | 'locationNameAr' | 'tags'>>
): TripJournalEntryEntity {
  const entry = db.tripJournalEntries.find(e => e.id === entryId);
  if (!entry) throw new Error(`Journal entry ${entryId} not found.`);
  if (entry.userId !== userId) throw new Error('You can only edit your own journal entries.');

  Object.assign(entry, patch, { updatedAt: nowIso() });
  db.saveToDisk();
  return entry;
}

/**
 * Delete a journal entry (only the owner can delete).
 */
export function deleteJournalEntry(entryId: string, userId: string): boolean {
  const idx = db.tripJournalEntries.findIndex(e => e.id === entryId && e.userId === userId);
  if (idx === -1) return false;
  db.tripJournalEntries.splice(idx, 1);
  db.saveToDisk();
  return true;
}

/**
 * Get all journal entries for a trip, ordered chronologically (oldest first).
 */
export function getJournalEntries(tripId: string, userId: string): TripJournalEntryEntity[] {
  return db.tripJournalEntries
    .filter(e => e.tripId === tripId && e.userId === userId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * Get journal entries across all of a user's trips.
 */
export function getAllJournalEntries(userId: string): TripJournalEntryEntity[] {
  return db.tripJournalEntries
    .filter(e => e.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/**
 * Auto-capture a journal entry from a confirmed booking.
 */
export function autoCaptureJournalEntry(
  tripId: string,
  userId: string,
  bookingId: string,
  placeName: string,
  placeNameAr?: string
): TripJournalEntryEntity | null {
  // Don't duplicate if there's already an auto-capture for this booking.
  const existing = db.tripJournalEntries.find(
    e => e.tripId === tripId && e.autoCaptured && e.body.includes(bookingId)
  );
  if (existing) return null;

  return createJournalEntry({
    tripId,
    userId,
    title: `Visited ${placeName}`,
    body: `Booking ${bookingId} confirmed at ${placeName}.`,
    locationName: placeName,
    locationNameAr: placeNameAr,
    tags: ['auto-captured', 'booking'],
    autoCaptured: true,
  });
}

// ---------------------------------------------------------------------------
// Places Visited
// ---------------------------------------------------------------------------

/**
 * Add a place visited record.
 */
export function addPlaceVisited(input: {
  tripId: string;
  userId: string;
  placeName: string;
  placeNameAr?: string;
  latitude?: number;
  longitude?: number;
  bookingId?: string;
  visitedAt?: string;
}): TripPlaceVisitedEntity {
  // Deduplicate: don't add the same place for the same trip.
  const existing = db.tripPlacesVisited.find(
    p => p.tripId === input.tripId && p.userId === input.userId && p.placeName === input.placeName
  );
  if (existing) return existing;

  const now = nowIso();
  const record: TripPlaceVisitedEntity = {
    id: genId('PLACE-VISITED'),
    tripId: input.tripId,
    userId: input.userId,
    placeName: input.placeName,
    placeNameAr: input.placeNameAr,
    latitude: input.latitude,
    longitude: input.longitude,
    bookingId: input.bookingId,
    visitedAt: input.visitedAt || now,
    createdAt: now,
  };

  db.tripPlacesVisited.push(record);
  db.saveToDisk();
  return record;
}

/**
 * Get all places visited for a trip.
 */
export function getPlacesVisited(tripId: string, userId: string): TripPlaceVisitedEntity[] {
  return db.tripPlacesVisited
    .filter(p => p.tripId === tripId && p.userId === userId)
    .sort((a, b) => Date.parse(a.visitedAt) - Date.parse(b.visitedAt));
}

/**
 * Auto-capture a place visited from a confirmed booking.
 */
export function autoCapturePlaceVisited(
  tripId: string,
  userId: string,
  bookingId: string,
  placeName: string,
  placeNameAr?: string,
  latitude?: number,
  longitude?: number
): TripPlaceVisitedEntity | null {
  // Don't duplicate if there's already a place visited for this booking.
  const existing = db.tripPlacesVisited.find(p => p.bookingId === bookingId);
  if (existing) return existing;

  return addPlaceVisited({
    tripId,
    userId,
    placeName,
    placeNameAr,
    latitude,
    longitude,
    bookingId,
    visitedAt: new Date().toISOString(),
  });
}

/**
 * Get a user's full travel footprint — all unique places across all trips.
 */
export function getTravelFootprint(userId: string): TripPlaceVisitedEntity[] {
  return db.tripPlacesVisited
    .filter(p => p.userId === userId)
    .sort((a, b) => Date.parse(b.visitedAt) - Date.parse(a.visitedAt));
}
