import crypto from 'crypto';
import { db } from '../db/database';
import { BookingEntity, SupplierEntity } from '../db/schema';
import { ledgerService } from './ledgerService';
import { notificationService } from './notificationService';
import { reliabilityService } from './reliabilityService';
import { payoutService } from './payoutService';
import { payoutsForSupplier } from './payoutService';
import { PaymentService } from './paymentService';
import { assertTransition } from './bookingLifecycle';
import { publishStaffEvent } from './staffEventStream';

export class SupplierService {
  public getSupplierDashboard(supplierId: string): {
    supplier: SupplierEntity | null;
    activeBookings: BookingEntity[];
    pastBookings: BookingEntity[];
    stats: {
      totalBookingsCount: number;
      pendingActionCount: number;
      confirmedCount: number;
      totalEarningsEGP: number;
      escrowPendingEGP: number;
      /** The supplier's rating, or null when none has been collected. */
      reliabilityScore: number | null;
      /** Null: no response-time measurement exists in this system yet. */
      slaResponseRate: string | null;
    };
  } {
    const supplier = db.suppliers.find(s => s.id === supplierId) || null;
    const allBookings = db.bookings.filter(b => b.supplierId === supplierId);

    const activeBookings = allBookings.filter(b => b.supplierState !== 'COMPLETED' && b.supplierState !== 'CANCELLED');
    const pastBookings = allBookings.filter(b => b.supplierState === 'COMPLETED' || b.supplierState === 'CANCELLED');

    const totalEarningsEGP = allBookings
      .filter(b => b.supplierState === 'COMPLETED' || b.paymentState === 'CAPTURED')
      .reduce((acc, b) => acc + Math.round(b.amountEGP * 0.85), 0); // 85% supplier payout

    const escrowPendingEGP = activeBookings
      .reduce((acc, b) => acc + Math.round(b.amountEGP * 0.85), 0);

    const pendingActionCount = allBookings.filter(b => b.supplierState === 'PENDING_CONFIRMATION').length;
    const confirmedCount = allBookings.filter(b => b.supplierState === 'CONFIRMED' || b.supplierState === 'DISPATCHED').length;

    return {
      supplier,
      activeBookings,
      pastBookings,
      stats: {
        totalBookingsCount: allBookings.length,
        pendingActionCount,
        confirmedCount,
        totalEarningsEGP,
        escrowPendingEGP,
        // Null, not a flattering default. `supplier?.rating || 4.9` invented a
        // 4.9 for any supplier with no rating and showed it back to that
        // supplier as their own score; and nothing in this system measures
        // response time, so the constant '99.4%' was a claim with no
        // observation behind it. The portal renders "—" for both when absent.
        reliabilityScore: typeof supplier?.rating === 'number' ? supplier.rating : null,
        slaResponseRate: null
      }
    };
  }

  // Supplier accepts, rejects, or dispatches resource
  public updateBookingState(params: {
    bookingId: string;
    supplierId: string;
    action: 'ACCEPT' | 'REJECT' | 'DISPATCH' | 'COMPLETE';
    assignedResource?: any;
    reason?: string;
  }): BookingEntity {
    const booking = db.bookings.find(b => b.id === params.bookingId || b.bookingRef === params.bookingId);
    if (!booking) throw new Error(`Booking ${params.bookingId} not found`);

    // Ownership check. Without it, any caller could mark any booking COMPLETE,
    // and COMPLETE writes an 85% SUPPLIER_PAYOUT entry to the ledger — i.e. an
    // arbitrary caller could credit an arbitrary supplier's payable account.
    if (booking.supplierId !== params.supplierId) {
      const err = new Error('This booking belongs to a different supplier.') as Error & { status?: number };
      err.status = 403;
      throw err;
    }

    // Lifecycle validation, the same state machine the /status route uses.
    // COMPLETE used to apply from any state — straight from
    // PENDING_CONFIRMATION — and schedule a payout for a service nobody had
    // accepted, let alone delivered. Validated before any write.
    const target = ({ ACCEPT: 'CONFIRMED', REJECT: 'REJECTED', DISPATCH: 'DISPATCHED', COMPLETE: 'COMPLETED' } as const)[params.action];
    if (!target) {
      const err = new Error(`Unknown action "${params.action}".`) as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    // DISPATCH with a resource from CONFIRMED is assign-then-dispatch: the
    // assignment is the ASSIGNED step, so both steps are validated.
    if (params.action === 'DISPATCH' && booking.supplierState === 'CONFIRMED' && params.assignedResource) {
      assertTransition(booking.supplierState, 'ASSIGNED');
      assertTransition('ASSIGNED', target);
    } else {
      assertTransition(booking.supplierState, target);
    }

    const now = new Date().toISOString();

    db.runInTransaction(() => {
      if (params.action === 'ACCEPT') {
        booking.supplierState = 'CONFIRMED';
      } else if (params.action === 'DISPATCH') {
        booking.supplierState = 'DISPATCHED';
        if (params.assignedResource) {
          booking.assignedResource = params.assignedResource;
        }
      } else if (params.action === 'COMPLETE') {
        booking.supplierState = 'COMPLETED';
        this.settleCompletion(booking);
      } else if (params.action === 'REJECT') {
        booking.supplierState = 'REJECTED';
        booking.specialRequests = `Rejected by supplier: ${params.reason || 'Capacity constraint'}`;
      }

      // Record supplier metric for reliability scoring.
      // Response time = minutes from booking creation to this decision.
      const responseMinutes = booking.createdAt
        ? Math.round((Date.now() - new Date(booking.createdAt).getTime()) / 60000)
        : undefined;
      const eventMap: Record<string, 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'> = {
        ACCEPT: 'ACCEPTED',
        REJECT: 'REJECTED',
        CANCEL: 'CANCELLED',
        COMPLETE: 'COMPLETED',
      };
      const metricEvent = eventMap[params.action];
      if (metricEvent) {
        reliabilityService.recordSupplierMetric(
          booking.supplierId,
          booking.bookingRef,
          metricEvent,
          responseMinutes,
        );
        // Refresh the supplier's cached score.
        reliabilityService.refreshSupplierScore(booking.supplierId);
      }

      booking.updatedAt = now;

      // Notification
      notificationService.sendNotification({
        // Was the literal demo traveler, so every supplier status update the
        // platform has ever produced was filed against one account. The owner
        // of the trip this booking belongs to is who it concerns.
        userId: db.trips.find(t => t.id === booking.tripId)?.userId || 'UNATTRIBUTED',
        type: 'SUPPLIER_CONFIRMED',
        channel: 'WHATSAPP',
        title: `Booking Update: ${booking.serviceType.toUpperCase()}`,
        message: `Your booking ${booking.bookingRef} status is now: ${booking.supplierState}.`,
        metadata: { recipientPhone: booking.travelerPhone, purpose: 'traveler', bookingRef: booking.bookingRef, supplierState: booking.supplierState }
      });

      // Review invitation on completion (blueprint row #14). The verified-stay
      // review only has a funnel if the traveler is actually invited the
      // moment the stay is over — the bookings surface shows the CTA off this
      // notification.
      if (booking.supplierState === 'COMPLETED') {
        const ownerId = db.trips.find(t => t.id === booking.tripId)?.userId;
        if (ownerId) {
          notificationService.sendReviewInvitation({
            userId: ownerId,
            bookingRef: booking.bookingRef,
            supplierId: booking.supplierId,
            serviceType: booking.serviceType,
          });
        }
      }

      db.logAudit(params.supplierId, 'Supplier', 'BOOKING_STATE_MUTATED', 'Booking', booking.id, {
        action: params.action,
        supplierState: booking.supplierState,
        assignedResource: params.assignedResource
      });
    });

    // A supplier turning a booking down is an ops exception: the traveller
    // needs a replacement (GET /api/stream, topic `exceptions`).
    if (params.action === 'REJECT') {
      publishStaffEvent('ExceptionRaised', {
        entityType: 'Booking', entityId: booking.id, supplierId: booking.supplierId,
        summary: `Supplier rejected ${booking.bookingRef}`,
      }, params.supplierId);
    }

    return booking;
  }

  /**
   * The money side of a booking reaching COMPLETED.
   *
   * - Paid through the platform (CAPTURED): schedule the supplier's 85% from
   *   escrow behind the 24h dispute hold. schedulePayout is idempotent per
   *   booking, so a second call never schedules a second payout.
   * - Cash on arrival (still PENDING): the supplier collected the cash in
   *   person, so it never entered escrow and there is nothing to pay out.
   *   COMPLETE used to stamp CAPTURED and schedule an 85% payout from escrow
   *   anyway — paying the supplier twice, from other travellers' money. The
   *   platform's commission is booked instead as a receivable owed by the
   *   supplier (SUPPLIER_RECEIVABLE_<id> → PLATFORM_REVENUE_COMMISSIONS), which
   *   leaves escrow untouched; collecting it is an ops settlement.
   * - Anything else (REFUNDED, FAILED, ...): no money to move.
   */
  public settleCompletion(booking: BookingEntity): void {
    if (booking.paymentState === 'PENDING') {
      booking.paymentState = 'CAPTURED'; // paid, in person, to the supplier
      // A hub lock already prices the platform spread into supplierCostEGP.
      // Booking 15% on top of that would take the margin twice.
      const hubMargin = booking.hubQuote
        ? Math.max(0, booking.hubQuote.sellEGP - booking.hubQuote.supplierCostEGP)
        : null;
      const commission = hubMargin !== null
        ? hubMargin
        : Math.round(booking.amountEGP * PaymentService.COMMISSION_RATE);
      if (commission > 0) {
        ledgerService.recordDoubleEntry({
          transactionId: `TXN-CASH-COMM-${booking.bookingRef}`,
          idempotencyKey: `LEDGER-CASH-COMM-${booking.bookingRef}`,
          bookingRef: booking.bookingRef,
          tripId: booking.tripId,
          type: 'PLATFORM_COMMISSION',
          amountEGP: commission,
          debitAccount: `SUPPLIER_RECEIVABLE_${booking.supplierId}`,
          creditAccount: 'PLATFORM_REVENUE_COMMISSIONS',
          metadata: {
            rate: hubMargin !== null ? 'resale-spread' : `${PaymentService.COMMISSION_RATE * 100}%`,
            reason: hubMargin !== null
              ? 'Hub price lock. Platform keeps the sell-minus-supplier spread. Cash is collected on site.'
              : 'Cash collected on site by the supplier; commission owed to the platform.'
          }
        });
      }
      return;
    }
    if (booking.paymentState === 'CAPTURED') {
      // 24h payout schedule: hold funds for dispute window before releasing.
      payoutService.schedulePayout({
        supplierId: booking.supplierId,
        bookingRef: booking.bookingRef,
        amountEGP: Math.round(booking.amountEGP * 0.85),
      });
    }
  }

  /**
   * P6 ops/supplier attention: the Revenue & Analytics feed for the supplier
   * portal's Revenue tab. Every number is derived from the same bookings the
   * dashboard reads — no client arithmetic, no invented baselines. Series are
   * bucketed by day for the last `days` days (default 30, capped at 90);
   * months with no bookings simply show zero, which is the honest shape.
   */
  public getSupplierRevenueAnalytics(supplierId: string, days = 30): {
    supplierId: string;
    windowDays: number;
    currency: 'EGP';
    totals: {
      grossBookingsEGP: number;
      payoutEGP: number;
      escrowPendingEGP: number;
      payoutScheduledEGP: number;
      bookingsCount: number;
      completedCount: number;
      cancelledCount: number;
      rejectedCount: number;
      /** completed / (completed + cancelled + rejected); null when nothing closed. */
      completionRate: number | null;
      avgBookingEGP: number | null;
    };
    byServiceType: Array<{ serviceType: string; bookingsCount: number; grossEGP: number; payoutEGP: number }>;
    daily: Array<{ date: string; bookingsCount: number; grossEGP: number; payoutEGP: number }>;
    topBookings: Array<{ bookingRef: string; serviceType: string; amountEGP: number; payoutEGP: number; supplierState: string; scheduledDate: string }>;
  } {
    const windowDays = Math.max(7, Math.min(days, 90));
    const allBookings = db.bookings.filter(b => b.supplierId === supplierId);
    const SHARE = 0.85; // must match getSupplierDashboard's payout share
    const payoutOf = (b: BookingEntity) => Math.round(b.amountEGP * SHARE);

    // Window for the daily series (UTC day boundaries; booking createdAt is ISO).
    const now = Date.now();
    const windowStart = now - windowDays * 24 * 60 * 60 * 1000;
    const dayKey = (iso: string) => iso.slice(0, 10);
    const buckets = new Map<string, { bookingsCount: number; grossEGP: number; payoutEGP: number }>();
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      buckets.set(d.toISOString().slice(0, 10), { bookingsCount: 0, grossEGP: 0, payoutEGP: 0 });
    }
    for (const b of allBookings) {
      const ts = b.createdAt ? Date.parse(b.createdAt) : NaN;
      if (!Number.isFinite(ts) || ts < windowStart) continue;
      const bucket = buckets.get(dayKey(b.createdAt!));
      if (!bucket) continue;
      bucket.bookingsCount += 1;
      bucket.grossEGP += b.amountEGP;
      bucket.payoutEGP += payoutOf(b);
    }

    const completed = allBookings.filter(b => b.supplierState === 'COMPLETED');
    const cancelled = allBookings.filter(b => b.supplierState === 'CANCELLED');
    const rejected = allBookings.filter(b => b.supplierState === 'REJECTED');
    const closedCount = completed.length + cancelled.length + rejected.length;
    const grossBookingsEGP = allBookings.reduce((acc, b) => acc + b.amountEGP, 0);

    const serviceTypes = [...new Set(allBookings.map(b => b.serviceType))];

    return {
      supplierId,
      windowDays,
      currency: 'EGP',
      totals: {
        grossBookingsEGP,
        payoutEGP: completed.reduce((acc, b) => acc + payoutOf(b), 0),
        escrowPendingEGP: allBookings
          .filter(b => b.supplierState !== 'COMPLETED' && b.supplierState !== 'CANCELLED' && b.supplierState !== 'REJECTED')
          .reduce((acc, b) => acc + payoutOf(b), 0),
        payoutScheduledEGP: payoutsForSupplier(supplierId)
          .filter(p => p.payoutState === 'PENDING')
          .reduce((acc, p) => acc + p.amountEGP, 0),
        bookingsCount: allBookings.length,
        completedCount: completed.length,
        cancelledCount: cancelled.length,
        rejectedCount: rejected.length,
        completionRate: closedCount > 0 ? completed.length / closedCount : null,
        avgBookingEGP: allBookings.length > 0 ? Math.round(grossBookingsEGP / allBookings.length) : null
      },
      byServiceType: serviceTypes.map(serviceType => {
        const rows = allBookings.filter(b => b.serviceType === serviceType);
        return {
          serviceType,
          bookingsCount: rows.length,
          grossEGP: rows.reduce((acc, b) => acc + b.amountEGP, 0),
          payoutEGP: rows.reduce((acc, b) => acc + payoutOf(b), 0)
        };
      }).sort((a, b) => b.grossEGP - a.grossEGP),
      daily: [...buckets.entries()].map(([date, v]) => ({ date, ...v })),
      topBookings: [...allBookings]
        .sort((a, b) => b.amountEGP - a.amountEGP)
        .slice(0, 5)
        .map(b => ({
          bookingRef: b.bookingRef,
          serviceType: b.serviceType,
          amountEGP: b.amountEGP,
          payoutEGP: payoutOf(b),
          supplierState: b.supplierState,
          scheduledDate: b.scheduledDate
        }))
    };
  }
}

export const supplierService = new SupplierService();
