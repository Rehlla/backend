import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import {
  createJournalEntry, updateJournalEntry, deleteJournalEntry,
  getJournalEntries, getAllJournalEntries, autoCaptureJournalEntry,
  addPlaceVisited, getPlacesVisited, autoCapturePlaceVisited, getTravelFootprint,
} from '../../server/services/tripJournalService';
import type { TripEntity, BookingEntity, SupplierEntity } from '../../server/db/schema';

const now = '2026-01-01T00:00:00.000Z';

function seedTestData() {
  const trip: TripEntity = {
    id: 'TRIP-1', userId: 'USR-1', title: 'Test Trip', titleAr: 'رحلة اختبار',
    status: 'CONFIRMED', createdAt: now, updatedAt: now,
  };
  const supplier: SupplierEntity = {
    id: 'SUP-1', businessName: 'Dive Center', businessNameAr: 'مركز الغوص',
    category: 'diving', tier: 'Vetted Local Partner', status: 'Active',
    area: 'dahab', createdAt: now,
  };
  const booking: BookingEntity = {
    id: 'BK-1', tripId: 'TRIP-1', skuId: 'SKU-1', supplierId: 'SUP-1',
    userId: 'USR-1', status: 'CONFIRMED', quantity: 1, amountEGP: 500,
    currency: 'EGP', paymentState: 'CAPTURED', supplierState: 'COMPLETED',
    holdId: 'HOLD-1', createdAt: now, updatedAt: now,
  };
  db.trips.push(trip);
  db.suppliers.push(supplier);
  db.bookings.push(booking);
}

describe('tripJournalService', () => {
  beforeEach(() => {
    const adapter = new InMemoryPersistenceAdapter();
    db.setAdapter(adapter);
    seedTestData();
  });

  describe('createJournalEntry', () => {
    it('creates a journal entry for a trip', () => {
      const entry = createJournalEntry({
        tripId: 'TRIP-1', userId: 'USR-1',
        title: 'Amazing Dive', body: 'Saw a turtle today!',
        locationName: 'Blue Hole',
      });
      expect(entry.id).toMatch(/^JOURNAL-/);
      expect(entry.title).toBe('Amazing Dive');
      expect(entry.body).toBe('Saw a turtle today!');
    });

    it('throws for non-existent trip', () => {
      expect(() => createJournalEntry({
        tripId: 'TRIP-999', userId: 'USR-1', body: 'test',
      })).toThrow('not found');
    });

    it('throws when journaling another user trip', () => {
      expect(() => createJournalEntry({
        tripId: 'TRIP-1', userId: 'USR-999', body: 'test',
      })).toThrow('your own trips');
    });
  });

  describe('updateJournalEntry', () => {
    it('updates a journal entry', () => {
      const entry = createJournalEntry({
        tripId: 'TRIP-1', userId: 'USR-1', body: 'Original',
      });
      const updated = updateJournalEntry(entry.id, 'USR-1', { title: 'Updated Title' });
      expect(updated.title).toBe('Updated Title');
      expect(updated.body).toBe('Original');
    });

    it('throws when editing another users entry', () => {
      const entry = createJournalEntry({
        tripId: 'TRIP-1', userId: 'USR-1', body: 'My entry',
      });
      expect(() => updateJournalEntry(entry.id, 'USR-999', { title: 'Hacked' })).toThrow('your own');
    });
  });

  describe('deleteJournalEntry', () => {
    it('deletes a journal entry', () => {
      const entry = createJournalEntry({
        tripId: 'TRIP-1', userId: 'USR-1', body: 'Delete me',
      });
      expect(deleteJournalEntry(entry.id, 'USR-1')).toBe(true);
      expect(getJournalEntries('TRIP-1', 'USR-1')).toHaveLength(0);
    });

    it('returns false for non-existent entry', () => {
      expect(deleteJournalEntry('JOURNAL-999', 'USR-1')).toBe(false);
    });
  });

  describe('getJournalEntries', () => {
    it('returns entries for a specific trip in chronological order', () => {
      createJournalEntry({ tripId: 'TRIP-1', userId: 'USR-1', body: 'First' });
      createJournalEntry({ tripId: 'TRIP-1', userId: 'USR-1', body: 'Second' });
      const entries = getJournalEntries('TRIP-1', 'USR-1');
      expect(entries).toHaveLength(2);
      expect(entries[0].body).toBe('First');
    });
  });

  describe('autoCaptureJournalEntry', () => {
    it('auto-captures a journal entry from a booking', () => {
      const entry = autoCaptureJournalEntry('TRIP-1', 'USR-1', 'BK-1', 'Blue Hole', 'الحفرة الزرقاء');
      expect(entry).not.toBeNull();
      expect(entry!.autoCaptured).toBe(true);
      expect(entry!.locationName).toBe('Blue Hole');
    });

    it('does not duplicate auto-captures for the same booking', () => {
      autoCaptureJournalEntry('TRIP-1', 'USR-1', 'BK-1', 'Blue Hole');
      const second = autoCaptureJournalEntry('TRIP-1', 'USR-1', 'BK-1', 'Blue Hole');
      expect(second).toBeNull();
    });
  });

  describe('addPlaceVisited', () => {
    it('adds a place visited', () => {
      const place = addPlaceVisited({
        tripId: 'TRIP-1', userId: 'USR-1', placeName: 'Blue Hole',
        latitude: 28.5, longitude: 34.5,
      });
      expect(place.id).toMatch(/^PLACE-VISITED-/);
      expect(place.placeName).toBe('Blue Hole');
    });

    it('deduplicates places for the same trip', () => {
      addPlaceVisited({ tripId: 'TRIP-1', userId: 'USR-1', placeName: 'Blue Hole' });
      const second = addPlaceVisited({ tripId: 'TRIP-1', userId: 'USR-1', placeName: 'Blue Hole' });
      expect(second.placeName).toBe('Blue Hole'); // returns existing
      expect(getPlacesVisited('TRIP-1', 'USR-1')).toHaveLength(1);
    });
  });

  describe('autoCapturePlaceVisited', () => {
    it('auto-captures a place from a booking', () => {
      const place = autoCapturePlaceVisited('TRIP-1', 'USR-1', 'BK-1', 'Blue Hole');
      expect(place).not.toBeNull();
      expect(place!.bookingId).toBe('BK-1');
    });

    it('does not duplicate for the same booking', () => {
      const first = autoCapturePlaceVisited('TRIP-1', 'USR-1', 'BK-1', 'Blue Hole');
      const second = autoCapturePlaceVisited('TRIP-1', 'USR-1', 'BK-1', 'Blue Hole');
      expect(second).not.toBeNull();
      expect(second!.id).toBe(first!.id);
      expect(getPlacesVisited('TRIP-1', 'USR-1')).toHaveLength(1);
    });
  });

  describe('getTravelFootprint', () => {
    it('returns all places a user has visited', () => {
      addPlaceVisited({ tripId: 'TRIP-1', userId: 'USR-1', placeName: 'Blue Hole' });
      addPlaceVisited({ tripId: 'TRIP-1', userId: 'USR-1', placeName: 'The Gardens' });
      const footprint = getTravelFootprint('USR-1');
      expect(footprint).toHaveLength(2);
    });
  });
});
