import crypto from 'crypto';
import { db } from '../db/database';
import { BookingEntity, ReviewEntity } from '../db/schema';
import { notificationService } from './notificationService';
import { serviceEndAt } from './serviceTime';

/**
 * Machine-readable rejection used by the route layer to map to a 4xx.
 * status 404 = no such booking (or not yours — indistinguishable on purpose),
 * 403 = the booking exists but is not the reviewer's, 409 = not completed yet.
 */
export class ReviewRejectedError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Verified-stay review integrity (blueprint row #14).
 *
 * "No reviews module? → Trust moat"
 *
 * The core rule: only a traveler who completed a real booking may review the
 * supplier they booked. The bookingRef is the proof — the service verifies
 * the booking exists, belongs to the reviewer, and the service happened
 * (COMPLETED, or accepted and past its scheduled end) before accepting it. One review per
 * booking; duplicate submissions replace the previous review.
 *
 * Moderation: every new review starts as `pending`. Operations approves,
 * flags, or hides it. Approved reviews are public; flagged/hidden are not.
 * Suppliers may respond once to each approved review.
 */

export interface SubmitReviewInput {
  bookingRef: string;
  userId: string;
  rating: number;
  title?: string;
  body: string;
  bodyAr?: string;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * States in which the supplier accepted the booking and it was not called
 * off. Once the service end passes, a booking still in one of these was
 * delivered as far as the platform can tell. PENDING_CONFIRMATION (never
 * accepted) and CANCELLED / REJECTED / EXPIRED / FAILED never qualify.
 */
const ACCEPTED_LIVE_STATES: ReadonlyArray<BookingEntity['supplierState']> = [
  'CONFIRMED', 'ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'IN_PROGRESS', 'ARRIVED',
  'READY_FOR_PICKUP', 'ACTIVE', 'RETURNED'
];

function findBooking(bookingRef: string) {
  return db.bookings.find(b => b.bookingRef === bookingRef);
}

function verifyStay(
  bookingRef: string,
  userId: string,
): { ok: true; booking: BookingEntity } | { ok: false; status: number; reason: string } {
  const booking = findBooking(bookingRef);
  // 404 for a booking that is not the caller's too: confirming that a booking
  // exists would itself leak that the ref is real.
  if (!booking) return { ok: false, status: 404, reason: 'Booking not found.' };
  // Booking → trip → userId. The traveler who owns the trip is the only one
  // authorized to review — BookingEntity carries no userId of its own; the
  // trip is the ownership boundary every other service asserts through.
  // A stay booked straight from a hotel page has no trip (its core booking
  // carries the stay reference as tripId), so for stays the hotel booking's
  // own userId is the ownership proof; for everything else, the trip.
  const stay = booking.serviceType === 'hotel' ? db.hotelBookings.find(h => h.bookingRef === bookingRef) : undefined;
  const trip = db.trips.find(t => t.id === booking.tripId);
  const owner = stay ? stay.userId : trip?.userId;
  if (!owner || owner !== userId) return { ok: false, status: 403, reason: 'Booking does not belong to this user.' };
  // The service must actually have happened: the supplier marked it
  // COMPLETED, or the supplier accepted it and its scheduled end has passed
  // (suppliers do not always close bookings out).
  //
  // This accepted `paymentState === 'CAPTURED'` too, and card checkout
  // captures at purchase — so a traveller could review a dive the moment they
  // paid for it, weeks before getting in the water.
  const completed = booking.supplierState === 'COMPLETED';
  const ended = ACCEPTED_LIVE_STATES.includes(booking.supplierState) && (() => {
    const sku = db.productSkus.find(s => s.id === booking.skuId);
    const end = serviceEndAt(booking, sku?.durationMinutes);
    return end !== null && end.getTime() <= Date.now();
  })();
  if (!completed && !ended) return { ok: false, status: 409, reason: 'Booking is not yet completed — reviews require a finished stay.' };
  return { ok: true, booking };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function submitReview(input: SubmitReviewInput): ReviewEntity {
  const verification = verifyStay(input.bookingRef, input.userId);
  if (!verification.ok) throw new ReviewRejectedError(verification.reason, verification.status);

  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const now = new Date().toISOString();
  const booking = verification.booking;

  // One review per booking: replace if exists.
  const existing = db.reviews.find(r => r.bookingRef === input.bookingRef && r.userId === input.userId);
  if (existing) {
    existing.rating = rating;
    existing.title = input.title?.trim() || existing.title;
    existing.body = input.body.trim();
    existing.bodyAr = input.bodyAr?.trim() || existing.bodyAr;
    existing.moderationStatus = 'pending';
    existing.moderationNote = undefined;
    existing.updatedAt = now;
    db.logAudit('ReviewService', 'System', 'REVIEW_UPDATED', 'Review', existing.id, {
      bookingRef: input.bookingRef,
      userId: input.userId,
      rating,
    });
    return existing;
  }

  const id = `REV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const review: ReviewEntity = {
    id,
    bookingRef: input.bookingRef,
    userId: input.userId,
    supplierId: booking.supplierId,
    rating,
    ...(input.title ? { title: input.title.trim() } : {}),
    body: input.body.trim(),
    ...(input.bodyAr ? { bodyAr: input.bodyAr.trim() } : {}),
    moderationStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  db.runInTransaction(() => {
    db.reviews.unshift(review);
    db.logAudit('ReviewService', 'System', 'REVIEW_SUBMITTED', 'Review', id, {
      bookingRef: input.bookingRef,
      userId: input.userId,
      supplierId: booking.supplierId,
      rating,
    });
  });

  // Invitation follow-through: when the traveler finally writes the review the
  // COMPLETE event invited, mark that invitation consumed so their bookings
  // list stops showing the CTA.
  notificationService.markReviewInvitationConsumed(input.userId, input.bookingRef);

  return review;
}

export function moderateReview(
  reviewId: string,
  status: 'approved' | 'flagged' | 'hidden',
  note?: string,
): ReviewEntity | null {
  const review = db.reviews.find(r => r.id === reviewId);
  if (!review) return null;
  const now = new Date().toISOString();
  review.moderationStatus = status;
  review.moderationNote = note || undefined;
  review.updatedAt = now;
  db.logAudit('ReviewService', 'System', `REVIEW_${status.toUpperCase()}`, 'Review', reviewId, {
    supplierId: review.supplierId,
    rating: review.rating,
    note,
  });
  return review;
}

export function supplierRespond(reviewId: string, supplierId: string, response: string): ReviewEntity | null {
  const review = db.reviews.find(r => r.id === reviewId);
  if (!review) return null;
  if (review.supplierId !== supplierId) return null;
  if (review.moderationStatus !== 'approved') return null;
  const now = new Date().toISOString();
  review.supplierResponse = response.trim();
  review.supplierResponseAt = now;
  review.updatedAt = now;
  return review;
}

/** Public reviews for a supplier (approved only). */
export function reviewsForSupplier(supplierId: string): ReviewEntity[] {
  return db.reviews.filter(r => r.supplierId === supplierId && r.moderationStatus === 'approved');
}

/** The caller's own review for a booking, if any (drives the bookings CTA state). */
export function reviewForBooking(bookingRef: string, userId: string): ReviewEntity | null {
  return db.reviews.find(r => r.bookingRef === bookingRef && r.userId === userId) || null;
}

/** Pending reviews for moderation (ops). */
export function pendingReviews(): ReviewEntity[] {
  return db.reviews.filter(r => r.moderationStatus === 'pending');
}

/** Average rating for a supplier (approved reviews only). */
export function averageRating(supplierId: string): { average: number; count: number } {
  const approved = reviewsForSupplier(supplierId);
  if (approved.length === 0) return { average: 0, count: 0 };
  const sum = approved.reduce((s, r) => s + r.rating, 0);
  return { average: Math.round((sum / approved.length) * 10) / 10, count: approved.length };
}

export const reviewService = {
  submitReview,
  moderateReview,
  supplierRespond,
  reviewsForSupplier,
  reviewForBooking,
  pendingReviews,
  averageRating,
};
