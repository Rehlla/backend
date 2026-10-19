import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { futureDate, resetDb, seedTrip } from '../helpers/fixtures';
import {
  submitReview,
  moderateReview,
  supplierRespond,
  reviewsForSupplier,
  reviewForBooking,
  pendingReviews,
  averageRating,
  ReviewRejectedError,
} from '../../server/services/reviewService';
import { notificationService } from '../../server/services/notificationService';
import type { BookingEntity } from '../../server/db/schema';

/**
 * Verified-stay review integrity (blueprint row #14).
 *
 * The gate under test: only the traveler who owns the booking's trip may
 * review it, and only once the booking is COMPLETED or paid. Ownership is
 * asserted through the trip (BookingEntity carries no userId), mirroring
 * bookingService.requireOwnership. Rejections are machine-readable so the
 * route maps them to 404/403/409.
 */

let bookingSeq = 0;

function seedCompletedBooking(over: {
  bookingRef?: string;
  tripId?: string;
  supplierId?: string;
  supplierState?: BookingEntity['supplierState'];
  paymentState?: BookingEntity['paymentState'];
  scheduledDate?: string;
} = {}): BookingEntity {
  bookingSeq += 1;
  const booking: BookingEntity = {
    id: `BK-REVIEW-TEST-${bookingSeq}`,
    bookingRef: over.bookingRef ?? `BKR-${bookingSeq}`,
    tripId: over.tripId ?? 'TRIP-REVIEW-TEST',
    supplierId: over.supplierId ?? 'SUP-REVIEW-TEST',
    skuId: 'SKU-REVIEW-TEST',
    serviceType: 'diving',
    amountEGP: 1200,
    paymentState: over.paymentState ?? 'CAPTURED',
    supplierState: over.supplierState ?? 'COMPLETED',
    travelerName: 'Review Tester',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'reviewer@test.test',
    passengersCount: 2,
    scheduledDate: over.scheduledDate ?? '2026-09-10',
    scheduledTime: '08:30',
    confirmationCode: `CC-${bookingSeq}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.bookings.push(booking);
  return booking;
}

const OWNER = 'USR-REVIEW-TEST';

describe('verified-stay review gate', () => {
  beforeEach(() => {
    resetDb();
    seedTrip({ id: 'TRIP-REVIEW-TEST', userId: OWNER });
    bookingSeq = 0;
  });

  it('accepts a review from the trip owner for a completed booking', () => {
    const booking = seedCompletedBooking();

    const review = submitReview({
      bookingRef: booking.bookingRef,
      userId: OWNER,
      rating: 5,
      body: 'The canyon dive was unreal — guide knew every current.',
    });

    expect(review.id).toMatch(/^REV-/);
    expect(review.moderationStatus).toBe('pending');
    expect(review.supplierId).toBe(booking.supplierId);
    expect(db.reviews).toHaveLength(1);
  });

  it('rejects a reviewer who does not own the booking (403, not 404)', () => {
    const booking = seedCompletedBooking();

    expect(() =>
      submitReview({ bookingRef: booking.bookingRef, userId: 'USR-OTHER', rating: 5, body: 'not mine' }),
    ).toThrowError(ReviewRejectedError);

    try {
      submitReview({ bookingRef: booking.bookingRef, userId: 'USR-OTHER', rating: 5, body: 'not mine' });
    } catch (err) {
      expect((err as ReviewRejectedError).status).toBe(403);
    }
  });

  it('reports 404 for an unknown booking ref without leaking existence', () => {
    expect(() =>
      submitReview({ bookingRef: 'BKR-DOES-NOT-EXIST', userId: OWNER, rating: 4, body: 'never happened' }),
    ).toThrowError(ReviewRejectedError);

    try {
      submitReview({ bookingRef: 'BKR-DOES-NOT-EXIST', userId: OWNER, rating: 4, body: 'never happened' });
    } catch (err) {
      expect((err as ReviewRejectedError).status).toBe(404);
    }
  });

  it('rejects an in-progress booking with 409', () => {
    const booking = seedCompletedBooking({ supplierState: 'CONFIRMED', paymentState: 'PENDING', scheduledDate: futureDate(10) });

    try {
      submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 4, body: 'too early' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ReviewRejectedError);
      expect((err as ReviewRejectedError).status).toBe(409);
    }
    expect(db.reviews).toHaveLength(0);
  });

  it('rejects a captured booking whose service has not happened yet (paying is not experiencing)', () => {
    const booking = seedCompletedBooking({ supplierState: 'CONFIRMED', paymentState: 'CAPTURED', scheduledDate: futureDate(10) });
    expect(() => submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 4, body: 'Too early.' }))
      .toThrow(ReviewRejectedError);
  });

  it('accepts an accepted, not-yet-closed booking once its service date has passed', () => {
    const booking = seedCompletedBooking({ supplierState: 'CONFIRMED', paymentState: 'CAPTURED', scheduledDate: futureDate(-3) });

    const review = submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 4, body: 'Solid day out.' });
    expect(review.rating).toBe(4);
  });

  it('clamps out-of-range ratings instead of storing them', () => {
    const booking = seedCompletedBooking();

    expect(submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 99, body: 'too much' }).rating).toBe(5);
    expect(submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 0, body: 'too little' }).rating).toBe(1);
  });

  it('replaces the review on resubmission and sends it back to moderation', () => {
    const booking = seedCompletedBooking();
    submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 2, body: 'mixed feelings' });
    moderateReview(db.reviews[0].id, 'approved');

    const updated = submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 5, body: 'actually, changed my mind' });

    expect(db.reviews).toHaveLength(1);
    expect(updated.rating).toBe(5);
    expect(updated.moderationStatus).toBe('pending');
  });

  it('only counts approved reviews in the public supplier feed and the aggregate', () => {
    const a = seedCompletedBooking({ supplierId: 'SUP-AGG' });
    const b = seedCompletedBooking({ supplierId: 'SUP-AGG' });

    submitReview({ bookingRef: a.bookingRef, userId: OWNER, rating: 5, body: 'great' });
    submitReview({ bookingRef: b.bookingRef, userId: OWNER, rating: 3, body: 'fine' });
    // One approved, one still pending.
    moderateReview(db.reviews.find(r => r.rating === 5)!.id, 'approved');

    expect(reviewsForSupplier('SUP-AGG')).toHaveLength(1);
    expect(averageRating('SUP-AGG')).toEqual({ average: 5, count: 1 });
    expect(pendingReviews()).toHaveLength(1);
  });
});

describe('moderation and supplier response', () => {
  beforeEach(() => {
    resetDb();
    seedTrip({ id: 'TRIP-REVIEW-TEST', userId: OWNER });
    bookingSeq = 0;
  });

  it('lets the supplier answer an approved review of their own business only', () => {
    const booking = seedCompletedBooking({ supplierId: 'SUP-ANSWER' });
    submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 5, body: 'legendary trip' });
    const review = moderateReview(db.reviews[0].id, 'approved');

    expect(supplierRespond(review!.id, 'SUP-OTHER', 'hijack attempt')).toBeNull();
    const answered = supplierRespond(review!.id, 'SUP-ANSWER', 'Thanks — see you next season!');
    expect(answered?.supplierResponse).toBe('Thanks — see you next season!');
    expect(answered?.supplierResponseAt).toBeTruthy();

    // Answering a pending review is refused — publish first.
    const b2 = seedCompletedBooking({ supplierId: 'SUP-ANSWER' });
    submitReview({ bookingRef: b2.bookingRef, userId: OWNER, rating: 4, body: 'still unmoderated' });
    expect(supplierRespond(db.reviews[0].id, 'SUP-ANSWER', 'too early')).toBeNull();
  });

  it('hides flagged reviews from the public feed', () => {
    const booking = seedCompletedBooking({ supplierId: 'SUP-HIDE' });
    submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 1, body: 'avoid' });
    moderateReview(db.reviews[0].id, 'flagged', 'spam');

    expect(reviewsForSupplier('SUP-HIDE')).toHaveLength(0);
    expect(averageRating('SUP-HIDE')).toEqual({ average: 0, count: 0 });
  });
});

describe('review invitation lifecycle', () => {
  beforeEach(() => {
    resetDb();
    seedTrip({ id: 'TRIP-REVIEW-TEST', userId: OWNER });
    bookingSeq = 0;
  });

  it('invitation fires on completion, shows open, and is consumed by the review', () => {
    const booking = seedCompletedBooking();

    notificationService.sendReviewInvitation({
      userId: OWNER,
      bookingRef: booking.bookingRef,
      supplierId: booking.supplierId,
      serviceType: booking.serviceType,
    });
    expect(notificationService.hasOpenReviewInvitation(OWNER, booking.bookingRef)).toBe(true);

    // The CTA state endpoint would see invitation=true, review=null here.
    expect(reviewForBooking(booking.bookingRef, OWNER)).toBeNull();

    submitReview({ bookingRef: booking.bookingRef, userId: OWNER, rating: 5, body: 'went above and beyond' });

    expect(notificationService.hasOpenReviewInvitation(OWNER, booking.bookingRef)).toBe(false);
    expect(reviewForBooking(booking.bookingRef, OWNER)?.rating).toBe(5);
  });

  it('marking an invitation consumed is idempotent and safe when none exists', () => {
    expect(() => notificationService.markReviewInvitationConsumed(OWNER, 'BKR-NONE')).not.toThrow();

    const booking = seedCompletedBooking();
    notificationService.sendReviewInvitation({
      userId: OWNER,
      bookingRef: booking.bookingRef,
      supplierId: booking.supplierId,
      serviceType: booking.serviceType,
    });
    notificationService.markReviewInvitationConsumed(OWNER, booking.bookingRef);
    notificationService.markReviewInvitationConsumed(OWNER, booking.bookingRef);
    expect(notificationService.hasOpenReviewInvitation(OWNER, booking.bookingRef)).toBe(false);
  });

  it('one traveler’s invitation never lights another traveler’s CTA', () => {
    const booking = seedCompletedBooking();
    notificationService.sendReviewInvitation({
      userId: 'USR-SOMEONE-ELSE',
      bookingRef: booking.bookingRef,
      supplierId: booking.supplierId,
      serviceType: booking.serviceType,
    });

    expect(notificationService.hasOpenReviewInvitation(OWNER, booking.bookingRef)).toBe(false);
  });
});
