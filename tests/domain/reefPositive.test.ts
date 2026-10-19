import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import {
  logReefAction, getLogsForBooking, getLogsForUser, getSupplierReefScore,
  getReefPositiveSuppliers, getUserConservationPoints, REEF_ACTION_TYPES,
} from '../../server/services/reefPositiveService';
import type { SupplierEntity, BookingEntity, TripEntity, UserEntity } from '../../server/db/schema';

const now = '2026-01-01T00:00:00.000Z';

function seedTestData() {
  const user: UserEntity = {
    id: 'USR-1', email: 'test@test.com', displayName: 'Test', role: 'Traveler',
    createdAt: now, updatedAt: now,
  };
  const supplier: SupplierEntity = {
    id: 'SUP-1', businessName: 'Dive Center', businessNameAr: 'مركز الغوص',
    category: 'diving', tier: 'Vetted Local Partner', status: 'Active',
    area: 'dahab', createdAt: now,
  };
  const trip: TripEntity = {
    id: 'TRIP-1', userId: 'USR-1', title: 'Test Trip', titleAr: 'رحلة اختبار',
    status: 'CONFIRMED', createdAt: now, updatedAt: now,
  };
  const booking: BookingEntity = {
    id: 'BK-1', tripId: 'TRIP-1', skuId: 'SKU-1', supplierId: 'SUP-1',
    userId: 'USR-1', status: 'CONFIRMED', quantity: 2, amountEGP: 1000,
    currency: 'EGP', paymentState: 'CAPTURED', supplierState: 'COMPLETED',
    holdId: 'HOLD-1', createdAt: now, updatedAt: now,
  };
  db.users.push(user);
  db.suppliers.push(supplier);
  db.trips.push(trip);
  db.bookings.push(booking);
}

describe('reefPositiveService', () => {
  beforeEach(() => {
    const adapter = new InMemoryPersistenceAdapter();
    db.setAdapter(adapter);
    seedTestData();
  });

  describe('logReefAction', () => {
    it('logs a reef action and awards points', () => {
      const log = logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'coral_planting', description: 'Planted 3 coral fragments',
        loggedBy: 'traveler',
      });
      expect(log.id).toMatch(/^REEF-/);
      expect(log.pointsAwarded).toBe(20);
      expect(log.actionType).toBe('coral_planting');
    });

    it('updates supplier reef score after logging', () => {
      logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'coral_planting', description: 'Planted corals', loggedBy: 'traveler',
      });
      expect(getSupplierReefScore('SUP-1')).toBe(20);
    });

    it('throws for non-existent booking', () => {
      expect(() => logReefAction({
        bookingId: 'BK-999', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'beach_cleanup', description: 'Cleaned beach', loggedBy: 'traveler',
      })).toThrow('not found');
    });

    it('throws for non-terminal booking', () => {
      db.bookings[0].paymentState = 'PENDING';
      db.bookings[0].supplierState = 'PENDING';
      expect(() => logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'beach_cleanup', description: 'Cleaned beach', loggedBy: 'traveler',
      })).toThrow('completed or captured');
    });
  });

  describe('getLogsForBooking', () => {
    it('returns logs for a specific booking', () => {
      logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'reef_safe_sunscreen', description: 'Used reef-safe', loggedBy: 'traveler',
      });
      logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'beach_cleanup', description: 'Beach cleanup', loggedBy: 'traveler',
      });
      const logs = getLogsForBooking('BK-1');
      expect(logs).toHaveLength(2);
    });
  });

  describe('getLogsForUser', () => {
    it('returns all logs for a user', () => {
      logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'plastic_free_day', description: 'No plastic today', loggedBy: 'traveler',
      });
      const logs = getLogsForUser('USR-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('USR-1');
    });
  });

  describe('getUserConservationPoints', () => {
    it('sums all points for a user', () => {
      logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'coral_planting', description: 'Coral', loggedBy: 'traveler',
      });
      logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'beach_cleanup', description: 'Beach', loggedBy: 'traveler',
      });
      expect(getUserConservationPoints('USR-1')).toBe(35); // 20 + 15
    });
  });

  describe('getReefPositiveSuppliers', () => {
    it('returns suppliers with reef score > 0', () => {
      logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'coral_planting', description: 'Coral', loggedBy: 'traveler',
      });
      const suppliers = getReefPositiveSuppliers();
      expect(suppliers).toHaveLength(1);
      expect(suppliers[0].reefScore).toBe(20);
    });
  });

  describe('REEF_ACTION_TYPES', () => {
    it('has correct point values', () => {
      expect(REEF_ACTION_TYPES.coral_planting.points).toBe(20);
      expect(REEF_ACTION_TYPES.reef_safe_sunscreen.points).toBe(5);
      expect(REEF_ACTION_TYPES.beach_cleanup.points).toBe(15);
    });
  });

  describe('crediting + consistency (supplier trust loop)', () => {
    it('credits the trip owner even when the supplier logs the action', () => {
      const log = logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'SUP-USER-1',
        actionType: 'beach_cleanup', description: 'Supplier-led cleanup',
        loggedBy: 'supplier',
      });
      // Points credit the traveler who took part, not the logging supplier.
      expect(log.userId).toBe('USR-1');
      expect(log.creditedUserId).toBe('USR-1');
      expect(log.loggedBy).toBe('supplier');
      expect(getUserConservationPoints('USR-1')).toBe(15);
      expect(getSupplierReefScore('SUP-1')).toBe(15);
    });

    it('throws when tripId does not match the booking\'s trip', () => {
      expect(() => logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-OTHER', supplierId: 'SUP-1', userId: 'USR-1',
        actionType: 'coral_planting', description: 'Mismatched trip',
        loggedBy: 'traveler',
      })).toThrow('does not belong');
    });

    it('accepts operator logging and credits the trip owner', () => {
      const log = logReefAction({
        bookingId: 'BK-1', tripId: 'TRIP-1', supplierId: 'SUP-1', userId: 'OPS-1',
        actionType: 'marine_education', description: 'Verified by ops',
        loggedBy: 'operator',
      });
      expect(log.userId).toBe('USR-1');
      expect(log.loggedBy).toBe('operator');
    });
  });
});
