import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';
import { reviewService } from '../../server/services/reviewService';

/**
 * Verified-stay review integrity (blueprint row #14).
 *
 * Only travelers who completed a booking can review the supplier they booked.
 * These tests verify the verification gate, moderation flow, supplier
 * response, and the one-review-per-booking rule.
 */

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-reviews-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();

  // Seed a supplier and a user.
  db.suppliers.push({
    id: 'SUP-DIVE',
    businessName: 'Red Sea Divers',
    businessNameAr: 'غواصين البحر الأحمر',
    category: 'diving',
    tier: 'Tier 1 Certified',
    status: 'Active',
    area: 'masbat',
  } as any);
  // Required: bookings.skuId references product_skus via FK.
  db.productSkus.push({
    id: 'SKU-DIVE-01',
    supplierId: 'SUP-DIVE',
    serviceType: 'diving',
    title: 'Discover Scuba Dive',
    titleAr: 'غوص تعليمي',
    description: 'A two-tank intro dive',
    basePriceEGP: 1500,
    currency: 'EGP',
    maxCapacityPerSlot: 4,
    active: true,
    cancellationPolicyHours: 24,
    includedItems: ['Equipment', 'Boat ride', 'Instructor'],
  } as any);
  db.productSkus.push({
    id: 'SKU-DIVE-02',
    supplierId: 'SUP-DIVE',
    serviceType: 'diving',
    title: 'Advanced Night Dive',
    titleAr: 'غوص ليلي متقدم',
    description: 'A night dive for certified divers',
    basePriceEGP: 2200,
    currency: 'EGP',
    maxCapacityPerSlot: 2,
    active: true,
    cancellationPolicyHours: 48,
    includedItems: ['Night gear', 'Torch', 'Boat ride'],
  } as any);
  db.users.push({
    id: 'USR-TRAV',
    email: 'traveler@test.com',
    name: 'Test Traveler',
    role: 'Traveler',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  // Link bookings to the user through trips.
  db.trips.push({
    id: 'TRIP-1',
    userId: 'USR-TRAV',
    title: 'Dive Trip',
    status: 'COMPLETED',
    lengthDays: 3,
    travelersCount: 2,
    budget: 'Moderate',
    pace: 'Balanced',
    interests: ['diving'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  db.trips.push({
    id: 'TRIP-2',
    userId: 'USR-TRAV',
    title: 'Active Trip',
    status: 'CONFIRMED',
    lengthDays: 2,
    travelersCount: 1,
    budget: 'Budget',
    pace: 'Active',
    interests: ['diving'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function completedBooking(overrides: Partial<{ bookingRef: string; userId: string; supplierId: string }> = {}) {
  const bookingRef = overrides.bookingRef || `BK-${Date.now()}`;
  db.bookings.push({
    id: `BID-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    bookingRef,
    tripId: 'TRIP-1',
    userId: overrides.userId || 'USR-TRAV',
    supplierId: overrides.supplierId || 'SUP-DIVE',
    skuId: 'SKU-DIVE-01',
    serviceType: 'diving',
    amountEGP: 1500,
    paymentState: 'CAPTURED',
    supplierState: 'COMPLETED',
    status: 'CONFIRMED',
    travelerName: 'Test Traveler',
    travelerPhone: '+20100000000',
    travelerEmail: 'traveler@test.com',
    passengersCount: 2,
    scheduledDate: '2026-09-10',
    scheduledTime: '09:00',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  return bookingRef;
}

function activeBooking(overrides: Partial<{ bookingRef: string; userId: string }> = {}) {
  const bookingRef = overrides.bookingRef || `BK-ACT-${Date.now()}`;
  db.bookings.push({
    id: `BID-ACT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    bookingRef,
    tripId: 'TRIP-2',
    userId: overrides.userId || 'USR-TRAV',
    supplierId: 'SUP-DIVE',
    skuId: 'SKU-DIVE-02',
    serviceType: 'diving',
    amountEGP: 1500,
    paymentState: 'PENDING',
    supplierState: 'PENDING',
    status: 'CONFIRMED',
    travelerName: 'Test Traveler',
    travelerPhone: '+20100000000',
    travelerEmail: 'traveler@test.com',
    passengersCount: 1,
    scheduledDate: '2026-09-15',
    scheduledTime: '10:00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  return bookingRef;
}

describe('reviewService', () => {
  describe('verified-stay gate', () => {
    it('accepts a review for a completed booking', () => {
      const ref = completedBooking();
      const review = reviewService.submitReview({
        bookingRef: ref,
        userId: 'USR-TRAV',
        rating: 5,
        body: 'Amazing dive!',
      });
      expect(review.id).toMatch(/^REV-/);
      expect(review.rating).toBe(5);
      expect(review.moderationStatus).toBe('pending');
    });

    it('rejects reviews for non-existent bookings', () => {
      expect(() =>
        reviewService.submitReview({ bookingRef: 'BK-FAKE', userId: 'USR-TRAV', rating: 5, body: 'x' })
      ).toThrow(/not found/i);
    });

    it('rejects reviews from non-owners of the booking', () => {
      const ref = completedBooking();
      expect(() =>
        reviewService.submitReview({ bookingRef: ref, userId: 'USR-OTHER', rating: 5, body: 'x' })
      ).toThrow(/does not belong/i);
    });

    it('rejects reviews for in-progress bookings', () => {
      const ref = activeBooking();
      expect(() =>
        reviewService.submitReview({ bookingRef: ref, userId: 'USR-TRAV', rating: 5, body: 'x' })
      ).toThrow(/not yet completed/i);
    });

    it('clamps ratings to 1–5', () => {
      const ref = completedBooking();
      const high = reviewService.submitReview({ bookingRef: ref, userId: 'USR-TRAV', rating: 10, body: 'x' });
      expect(high.rating).toBe(5);
      // Reset for next test
      db.reviews.splice(0, db.reviews.length);
      const ref2 = completedBooking({ bookingRef: 'BK2' });
      const low = reviewService.submitReview({ bookingRef: ref2, userId: 'USR-TRAV', rating: 0, body: 'x' });
      expect(low.rating).toBe(1);
    });
  });

  describe('one review per booking', () => {
    it('replaces the existing review on re-submission', () => {
      const ref = completedBooking();
      const first = reviewService.submitReview({ bookingRef: ref, userId: 'USR-TRAV', rating: 3, body: 'OK' });
      const second = reviewService.submitReview({ bookingRef: ref, userId: 'USR-TRAV', rating: 5, body: 'Actually amazing!' });
      expect(second.id).toBe(first.id);
      expect(second.rating).toBe(5);
      expect(second.body).toBe('Actually amazing!');
      expect(second.moderationStatus).toBe('pending');
      // Only one review exists.
      expect(db.reviews.filter(r => r.bookingRef === ref)).toHaveLength(1);
    });
  });

  describe('moderation', () => {
    it('starts pending, then approved/flagged/hidden', () => {
      const ref = completedBooking();
      const review = reviewService.submitReview({ bookingRef: ref, userId: 'USR-TRAV', rating: 4, body: 'Good' });
      expect(review.moderationStatus).toBe('pending');

      const approved = reviewService.moderateReview(review.id, 'approved', 'Looks real');
      expect(approved!.moderationStatus).toBe('approved');
      expect(approved!.moderationNote).toBe('Looks real');

      const flagged = reviewService.moderateReview(review.id, 'flagged', 'Suspicious');
      expect(flagged!.moderationStatus).toBe('flagged');
    });

    it('returns null for unknown review ids', () => {
      expect(reviewService.moderateReview('REV-FAKE', 'approved')).toBeNull();
    });
  });

  describe('supplier response', () => {
    it('allows the supplier to respond to approved reviews only', () => {
      const ref = completedBooking();
      const review = reviewService.submitReview({ bookingRef: ref, userId: 'USR-TRAV', rating: 4, body: 'Good dive' });
      // Cannot respond to pending review.
      expect(reviewService.supplierRespond(review.id, 'SUP-DIVE', 'Thanks!')).toBeNull();

      reviewService.moderateReview(review.id, 'approved');
      const responded = reviewService.supplierRespond(review.id, 'SUP-DIVE', 'Thank you for diving with us!');
      expect(responded!.supplierResponse).toBe('Thank you for diving with us!');
      expect(responded!.supplierResponseAt).toBeDefined();
    });

    it('rejects responses from the wrong supplier', () => {
      const ref = completedBooking();
      const review = reviewService.submitReview({ bookingRef: ref, userId: 'USR-TRAV', rating: 5, body: 'Great' });
      reviewService.moderateReview(review.id, 'approved');
      expect(reviewService.supplierRespond(review.id, 'SUP-OTHER', 'Spam')).toBeNull();
    });
  });

  describe('queries', () => {
    it('reviewsForSupplier returns only approved reviews', () => {
      const ref1 = completedBooking({ bookingRef: 'BK-R1' });
      const ref2 = completedBooking({ bookingRef: 'BK-R2' });
      const r1 = reviewService.submitReview({ bookingRef: ref1, userId: 'USR-TRAV', rating: 5, body: 'a' });
      reviewService.submitReview({ bookingRef: ref2, userId: 'USR-TRAV', rating: 3, body: 'b' });
      reviewService.moderateReview(r1.id, 'approved');

      expect(reviewService.reviewsForSupplier('SUP-DIVE')).toHaveLength(1);
      expect(reviewService.reviewsForSupplier('SUP-DIVE')[0].id).toBe(r1.id);
    });

    it('pendingReviews returns only pending reviews', () => {
      const ref1 = completedBooking({ bookingRef: 'BK-P1' });
      const ref2 = completedBooking({ bookingRef: 'BK-P2' });
      const r1 = reviewService.submitReview({ bookingRef: ref1, userId: 'USR-TRAV', rating: 5, body: 'a' });
      const r2 = reviewService.submitReview({ bookingRef: ref2, userId: 'USR-TRAV', rating: 4, body: 'b' });
      reviewService.moderateReview(r1.id, 'approved');

      expect(reviewService.pendingReviews()).toHaveLength(1);
      expect(reviewService.pendingReviews()[0].id).toBe(r2.id);
    });

    it('averageRating computes from approved reviews only', () => {
      const ref1 = completedBooking({ bookingRef: 'BK-A1' });
      const ref2 = completedBooking({ bookingRef: 'BK-A2' });
      const r1 = reviewService.submitReview({ bookingRef: ref1, userId: 'USR-TRAV', rating: 4, body: 'a' });
      reviewService.submitReview({ bookingRef: ref2, userId: 'USR-TRAV', rating: 2, body: 'b' });
      reviewService.moderateReview(r1.id, 'approved');

      expect(reviewService.averageRating('SUP-DIVE')).toEqual({ average: 4, count: 1 });
    });
  });
});
