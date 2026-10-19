import crypto from 'crypto';
import { db } from '../db/database';
import { TripItemEntity, BookingEntity } from '../db/schema';
import { ledgerService } from './ledgerService';
import { paymentService } from './paymentService';
import { notificationService } from './notificationService';

export interface SubstitutionParams {
  tripId: string;
  originalItemId: string;
  alternativeTitle: string;
  alternativeServiceType: 'hotel' | 'transfer' | 'diving' | 'safari' | 'activity';
  newScheduledTime: string;
  newDayNumber?: number;
  newPriceEGP?: number;
  reason: string;
  idempotencyKey: string;
}

export class RecoveryService {
  // Substitute an existing trip item due to weather/disruption with automatic ledger reconciliation
  public substituteItem(params: SubstitutionParams): {
    success: boolean;
    tripItem: TripItemEntity;
    previousStatus: string;
    newBookingRef: string;
    ledgerReconciled: boolean;
    priceVarianceEGP: number;
  } {
    const trip = db.trips.find(t => t.id === params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found`);

    const originalItem = db.tripItems.find(i => i.id === params.originalItemId && i.tripId === params.tripId);
    if (!originalItem) throw new Error(`Trip item ${params.originalItemId} not found in trip ${params.tripId}`);

    const now = new Date().toISOString();
    const previousStatus = originalItem.status;
    const oldPrice = originalItem.priceEGP;
    const newPrice = params.newPriceEGP !== undefined ? params.newPriceEGP : oldPrice;
    const priceVariance = oldPrice - newPrice; // Positive = refund due to traveler; Negative = additional charge
    // The previous title must be captured before the item is overwritten, or
    // the recovery history records the new title as the "previous" one.
    const previousTitle = originalItem.title;

    const newBookingRef = `DHB-RECOV-${Date.now().toString().slice(-4)}`;
    const transactionId = `TXN-RECOV-${Date.now()}`;

    db.runInTransaction(() => {
      // 1. Update Trip Item with new alternative
      originalItem.title = params.alternativeTitle;
      originalItem.timeSlot = params.newScheduledTime;
      if (params.newDayNumber) originalItem.dayNumber = params.newDayNumber;
      originalItem.status = 'CONFIRMED';
      originalItem.priceEGP = newPrice;
      originalItem.updatedAt = now;
      originalItem.metadata = {
        ...(originalItem.metadata || {}),
        recoveryReason: params.reason,
        recoveredAt: now,
        previousTitle
      };

      // 2. Cancel or update previous booking if exists
      if (originalItem.bookingId) {
        const oldBooking = db.bookings.find(b => b.id === originalItem.bookingId);
        if (oldBooking) {
          oldBooking.supplierState = 'CANCELLED';
          oldBooking.specialRequests = `Cancelled due to auto-recovery: ${params.reason}`;
          oldBooking.updatedAt = now;
        }
      }

      // 3. Double-entry ledger adjustment
      if (priceVariance > 0) {
        // Price of alternative is lower: issue a refund of the difference.
        //
        // This used to pass bookingId: newBookingRef, a booking that is never
        // created — the trip item is mutated in place and no booking is filed
        // with that ref. refundableAmountEGP matched PAYMENT_CAPTURED entries by
        // bookingRef, found none, and threw 409, failing every cheaper
        // substitution. The refund is keyed to the trip's captured funds ("what
        // was captured and not yet refunded"), which is what a price-variance
        // refund actually draws against.
        paymentService.processRefund({
          tripId: params.tripId,
          amountEGP: priceVariance,
          reason: `Automatic price variance refund for itinerary substitution: ${params.reason}`,
          idempotencyKey: `REF-VAR-${params.idempotencyKey}`
        });
      } else {
        // Neutral substitution ledger event
        ledgerService.recordDoubleEntry({
          transactionId,
          idempotencyKey: params.idempotencyKey,
          bookingRef: newBookingRef,
          tripId: params.tripId,
          type: 'RECOVERY_CREDIT',
          amountEGP: newPrice,
          debitAccount: 'PLATFORM_RECOVERY_POOL',
          creditAccount: 'PLATFORM_ESCROW_MAIN',
          metadata: {
            reason: params.reason,
            originalItemId: params.originalItemId,
            substitutedWith: params.alternativeTitle
          }
        });
      }

      // 4. Send Traveler Notification
      notificationService.sendNotification({
        userId: trip.userId,
        type: 'EXCEPTION_ALERT',
        channel: 'WHATSAPP',
        title: 'Itinerary Updated · Weather Adaptation',
        message: `Your experience has been smoothly updated to "${params.alternativeTitle}" (${params.newScheduledTime}). Everything is confirmed!`,
        metadata: { recipientPhone: '+20 100 234 5678', tripId: params.tripId, newItem: params.alternativeTitle }
      });

      db.logAudit('ChangeEngine', 'System', 'ITINERARY_RECOVERY_EXECUTED', 'TripItem', originalItem.id, {
        reason: params.reason,
        substitutedWith: params.alternativeTitle,
        priceVariance
      });
    });

    return {
      success: true,
      tripItem: originalItem,
      previousStatus,
      newBookingRef,
      ledgerReconciled: true,
      priceVarianceEGP: priceVariance
    };
  }
}

export const recoveryService = new RecoveryService();
