import crypto from 'crypto';
import { db } from '../db/database';
import { ReefPositiveLogEntity } from '../db/schema';

/**
 * Reef-Positive Conservation Tracking Service
 *
 * Tracks eco-actions (reef-safe sunscreen, coral planting, beach cleanup,
 * dive against debris, marine education, plastic-free days) logged against
 * completed bookings. Each action earns points; suppliers accumulate a
 * reefScore that surfaces in their profile.
 *
 * Points per action type:
 *   reef_safe_sunscreen: 5
 *   coral_planting: 20
 *   beach_cleanup: 15
 *   dive_against_debris: 20
 *   marine_education: 10
 *   plastic_free_day: 5
 *   other: 5
 */

const ACTION_POINTS: Record<ReefPositiveLogEntity['actionType'], number> = {
  reef_safe_sunscreen: 5,
  coral_planting: 20,
  beach_cleanup: 15,
  dive_against_debris: 20,
  marine_education: 10,
  plastic_free_day: 5,
  other: 5,
};

const nowIso = () => new Date().toISOString();
const genId = (prefix: string) => `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

/**
 * Log a reef-positive action against a completed booking.
 * The booking must exist and be in a terminal state (CAPTURED or COMPLETED).
 *
 * Permission contract (enforced by the caller / route):
 *  - 'traveler': the trip owner logging their own experience.
 *  - 'operator': Operations/Admin acting on a trip they may act on.
 *  - 'supplier': the booking's own supplier logging an action they delivered.
 *
 * Conservation points are always credited to the TRIP OWNER (booking → trip →
 * trip.userId), even when a supplier or operator logs on the traveler's behalf,
 * so the traveler's own eco-record reflects actions they took part in.
 */
export function logReefAction(input: {
  bookingId: string;
  tripId: string;
  supplierId: string;
  userId: string;
  actionType: ReefPositiveLogEntity['actionType'];
  description: string;
  descriptionAr?: string;
  photoUrl?: string;
  loggedBy: 'traveler' | 'operator' | 'supplier';
  verifiedByUserId?: string;
  creditedUserId?: string;
}): ReefPositiveLogEntity {
  // Verify the booking exists and is in a terminal state.
  const booking = db.bookings.find(b => b.id === input.bookingId);
  if (!booking) {
    throw new Error(`Booking ${input.bookingId} not found.`);
  }
  if (booking.paymentState !== 'CAPTURED' && booking.supplierState !== 'COMPLETED') {
    throw new Error('Reef actions can only be logged against completed or captured bookings.');
  }

  // Cross-check consistency: the booking must belong to the trip it claims.
  const trip = db.trips.find(tr => tr.id === booking.tripId);
  if (trip && input.tripId !== booking.tripId) {
    throw new Error('Booking does not belong to the given trip.');
  }

  // Points are always credited to the trip owner.
  const creditedUserId = input.creditedUserId ?? trip?.userId ?? input.userId;

  const pointsAwarded = ACTION_POINTS[input.actionType] || 5;

  const log: ReefPositiveLogEntity = {
    id: genId('REEF'),
    bookingId: input.bookingId,
    tripId: input.tripId,
    supplierId: input.supplierId,
    userId: creditedUserId,
    actionType: input.actionType,
    description: input.description,
    descriptionAr: input.descriptionAr,
    photoUrl: input.photoUrl,
    pointsAwarded,
    loggedBy: input.loggedBy,
    verifiedByUserId: input.verifiedByUserId,
    creditedUserId,
    createdAt: nowIso(),
  };

  db.reefPositiveLogs.push(log);
  db.saveToDisk();

  // Update the supplier's reef score.
  recalcSupplierReefScore(input.supplierId);

  return log;
}

/**
 * Recalculate a supplier's total reef score from all verified logs.
 * Score = total points from all verified logs (operator-verified or traveler-logged).
 */
export function recalcSupplierReefScore(supplierId: string): number {
  const supplier = db.suppliers.find(s => s.id === supplierId);
  if (!supplier) return 0;

  const logs = db.reefPositiveLogs.filter(l => l.supplierId === supplierId);
  const score = logs.reduce((sum, l) => sum + l.pointsAwarded, 0);

  supplier.reefScore = score;
  db.saveToDisk();
  return score;
}

/**
 * Get all reef-positive logs for a booking.
 */
export function getLogsForBooking(bookingId: string): ReefPositiveLogEntity[] {
  return db.reefPositiveLogs
    .filter(l => l.bookingId === bookingId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/**
 * Get all reef-positive logs for a user (across all trips).
 */
export function getLogsForUser(userId: string): ReefPositiveLogEntity[] {
  return db.reefPositiveLogs
    .filter(l => l.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/**
 * Get the total reef score for a supplier.
 */
export function getSupplierReefScore(supplierId: string): number {
  const supplier = db.suppliers.find(s => s.id === supplierId);
  return supplier?.reefScore ?? 0;
}

/**
 * Get all suppliers with a reef score > 0, sorted by score descending.
 */
export function getReefPositiveSuppliers(): Array<{ supplierId: string; businessName: string; reefScore: number }> {
  return db.suppliers
    .filter(s => (s.reefScore ?? 0) > 0)
    .map(s => ({
      supplierId: s.id,
      businessName: s.businessName,
      reefScore: s.reefScore!,
    }))
    .sort((a, b) => b.reefScore - a.reefScore);
}

/**
 * Get a user's total conservation points across all trips.
 */
export function getUserConservationPoints(userId: string): number {
  return db.reefPositiveLogs
    .filter(l => l.userId === userId)
    .reduce((sum, l) => sum + l.pointsAwarded, 0);
}

/**
 * Action type metadata for display.
 */
export const REEF_ACTION_TYPES = {
  reef_safe_sunscreen: { label: 'Reef-Safe Sunscreen', labelAr: 'واقي شمس آمن للشعاب', points: 5 },
  coral_planting: { label: 'Coral Planting', labelAr: 'زراعة مرجان', points: 20 },
  beach_cleanup: { label: 'Beach Cleanup', labelAr: 'تنظيف الشاطئ', points: 15 },
  dive_against_debris: { label: 'Dive Against Debris', labelAr: 'غوص ضد القمامة', points: 20 },
  marine_education: { label: 'Marine Education', labelAr: 'تعليم البحريات', points: 10 },
  plastic_free_day: { label: 'Plastic-Free Day', labelAr: 'يوم بلا بلاستيك', points: 5 },
  other: { label: 'Other Eco-Action', labelAr: 'إجراء بيئي آخر', points: 5 },
} as const;
