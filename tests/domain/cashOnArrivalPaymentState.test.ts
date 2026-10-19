import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { paymentService, PaymentService } from '../../server/services/paymentService';
import { commerceService } from '../../server/services/commerceService';
import { ledgerService } from '../../server/services/ledgerService';
import { rentalService } from '../../server/services/rentalService';
import { cancelBooking } from '../../server/services/bookingService';
import { supplierService } from '../../server/services/supplierService';
import { transferService } from '../../server/services/transferService';
import { futureDate, heldItem, resetDb, seedSku, seedTrip, seedRentalListing, nextIdempotencyKey } from '../helpers/fixtures';

/**
 * CASH_ON_ARRIVAL payment-state regression tests.
 *
 * The semantic contract:
 *   CASH_ON_ARRIVAL → booking may be CONFIRMED, payment must NOT be CAPTURED,
 *   ledger must NOT represent money as settled, cancellation must not attempt
 *   a refund of money that was never captured.
 *
 * Escrow: the traveller pays the provider in person, so the cash never enters
 * PLATFORM_ESCROW_MAIN. Checkout used to write a HOLD_ESCROW entry crediting
 * escrow for money that had not (and never would) arrive, which let payouts
 * for other bookings draw on it. Nothing is written at checkout now; on
 * completion the platform's 15% is booked as a receivable from the supplier
 * and no payout is scheduled (the supplier already holds the cash).
 *
 * This regression was introduced when the rental checkout flow hardcoded
 * `paymentState: 'CAPTURED'` after processCheckout returned PENDING for
 * CASH_ON_ARRIVAL. The payment service was correct; the consumers were not.
 */

// ---------------------------------------------------------------------------
// Commerce-service (multi-vertical checkout) path
// ---------------------------------------------------------------------------

describe('CASH_ON_ARRIVAL — commerce checkout', () => {
  beforeEach(() => {
    resetDb();
    seedSku();
    seedTrip();
  });

  it('checkout: booking CONFIRMED, payment ≠ CAPTURED, ledger ≠ PAYMENT_CAPTURED', () => {
    const result = commerceService.completeMultiServiceCheckout({
      tripId: 'TRIP-TEST',
      travelerUserId: 'USR-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'cash@traveler.test',
      items: [heldItem()],
      paymentParams: {
        idempotencyKey: nextIdempotencyKey(),
        provider: 'CASH_ON_ARRIVAL',
      },
    });

    expect(result.success).toBe(true);

    // Booking row exists and is in a live state (supplier not yet seen it).
    const booking = result.bookings[0];
    expect(booking.supplierState).toBe('PENDING_CONFIRMATION');
    // The booking is "confirmed" from the traveler's perspective (they committed).
    expect(result.totalAmountEGP).toBe(1200);

    // Payment is NOT captured — money has not moved.
    expect(result.paymentState).toBe('PENDING');

    // The payment row confirms PENDING.
    const payment = db.payments.find(
      (p) => p.idempotencyKey === result.transactionId || p.tripId === 'TRIP-TEST'
    );
    expect(payment).toBeDefined();
    expect(payment!.state).toBe('PENDING');
    expect(payment!.provider).toBe('CASH_ON_ARRIVAL');
    expect(payment!.paymentMethodType).toBe('CASH');

    // No PAYMENT_CAPTURED entry, and nothing credits escrow: no money moved.
    const capturedEntries = db.ledgerEntries.filter(
      (e) => e.type === 'PAYMENT_CAPTURED' && e.tripId === 'TRIP-TEST'
    );
    expect(capturedEntries).toHaveLength(0);
    expect(db.ledgerEntries.filter((e) => e.creditAccount === 'PLATFORM_ESCROW_MAIN')).toHaveLength(0);
    expect(ledgerService.verifyLedgerIntegrity().escrowBalanceEGP).toBe(0);

    // No commission entry (money has not settled).
    const commissionEntries = db.ledgerEntries.filter(
      (e) => e.type === 'PLATFORM_COMMISSION' && e.tripId === 'TRIP-TEST'
    );
    expect(commissionEntries).toHaveLength(0);
  });

  it('cancel: does not attempt to refund money that was never captured', () => {
    const result = commerceService.completeMultiServiceCheckout({
      tripId: 'TRIP-TEST',
      travelerUserId: 'USR-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'cash@traveler.test',
      items: [heldItem()],
      paymentParams: {
        idempotencyKey: nextIdempotencyKey(),
        provider: 'CASH_ON_ARRIVAL',
      },
    });

    const booking = result.bookings[0];
    const bookingRef = booking.bookingRef;

    // Confirm no REFUND_ISSUED entries exist before cancellation.
    const preCancelRefunds = db.ledgerEntries.filter(
      (e) => e.type === 'REFUND_ISSUED' && e.bookingRef === bookingRef
    );
    expect(preCancelRefunds).toHaveLength(0);

    // Cancel the booking via the booking service.
    // For CASH_ON_ARRIVAL the paymentState is PENDING (not CAPTURED),
    // so the cancellation path must NOT attempt a refund.
    const cancelResult = cancelBooking({
      bookingId: bookingRef,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      userRole: 'Traveler',
      reason: 'Changed my mind',
      cancellationKey: booking.confirmationCode,
    });

    expect(cancelResult.success).toBe(true);
    expect(cancelResult.refunded).toBe(false);

    // No REFUND_ISSUED ledger entries were created.
    const postCancelRefunds = db.ledgerEntries.filter(
      (e) => e.type === 'REFUND_ISSUED' && e.bookingRef === bookingRef
    );
    expect(postCancelRefunds).toHaveLength(0);

    // Refundable amount is zero — nothing was captured.
    const refundable = paymentService.refundableAmountEGP({
      tripId: 'TRIP-TEST',
    });
    expect(refundable).toBe(0);
  });

  it('refundableAmountEGP reports zero for a trip paid with CASH_ON_ARRIVAL', () => {
    commerceService.completeMultiServiceCheckout({
      tripId: 'TRIP-TEST',
      travelerUserId: 'USR-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'cash@traveler.test',
      items: [heldItem()],
      paymentParams: {
        idempotencyKey: nextIdempotencyKey(),
        provider: 'CASH_ON_ARRIVAL',
      },
    });

    expect(paymentService.refundableAmountEGP({ tripId: 'TRIP-TEST' })).toBe(0);
  });

  it('processRefund rejects a refund against a CASH_ON_ARRIVAL trip (nothing to refund)', () => {
    commerceService.completeMultiServiceCheckout({
      tripId: 'TRIP-TEST',
      travelerUserId: 'USR-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'cash@traveler.test',
      items: [heldItem()],
      paymentParams: {
        idempotencyKey: nextIdempotencyKey(),
        provider: 'CASH_ON_ARRIVAL',
      },
    });

    expect(() =>
      paymentService.processRefund({
        tripId: 'TRIP-TEST',
        amountEGP: 1200,
        reason: 'Should not work',
        idempotencyKey: nextIdempotencyKey(),
      })
    ).toThrow(/exceeds what was captured/);
  });
});

describe('CASH_ON_ARRIVAL — completion (cash collected on site)', () => {
  beforeEach(() => {
    resetDb();
    seedSku();
    seedTrip();
  });

  function completeCashBooking() {
    const result = commerceService.completeMultiServiceCheckout({
      tripId: 'TRIP-TEST',
      travelerUserId: 'USR-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'cash@traveler.test',
      items: [heldItem()],
      paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' },
    });
    const ref = result.bookings[0].bookingRef;
    supplierService.updateBookingState({ bookingId: ref, supplierId: 'SUP-TEST', action: 'ACCEPT' });
    for (const state of ['ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED'] as const) {
      transferService.updateSupplierStatus(ref, state);
    }
    supplierService.updateBookingState({ bookingId: ref, supplierId: 'SUP-TEST', action: 'COMPLETE' });
    return db.bookings.find((b) => b.bookingRef === ref)!;
  }

  it('schedules no payout from escrow for cash the supplier already holds', () => {
    const booking = completeCashBooking();
    expect(booking.supplierState).toBe('COMPLETED');
    expect(db.payoutSchedule.filter((p) => p.bookingRef === booking.bookingRef)).toHaveLength(0);
    expect(ledgerService.verifyLedgerIntegrity().escrowBalanceEGP).toBe(0);
  });

  it('books the platform commission as a receivable from the supplier, once', () => {
    const booking = completeCashBooking();
    const commission = db.ledgerEntries.filter(
      (e) => e.type === 'PLATFORM_COMMISSION' && e.bookingRef === booking.bookingRef
    );
    expect(commission).toHaveLength(1);
    expect(commission[0].amountEGP).toBe(Math.round(1200 * PaymentService.COMMISSION_RATE));
    expect(commission[0].debitAccount).toBe('SUPPLIER_RECEIVABLE_SUP-TEST');
    expect(commission[0].creditAccount).toBe('PLATFORM_REVENUE_COMMISSIONS');
    // The booking is now paid (in person); the ledger stays balanced.
    expect(booking.paymentState).toBe('CAPTURED');
    expect(ledgerService.verifyLedgerIntegrity().balanced).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SIMULATED CARD — explicit simulation disclosure
// ---------------------------------------------------------------------------

describe('SIMULATED CARD — settlement is simulated, not real', () => {
  beforeEach(() => {
    resetDb();
    seedSku();
    seedTrip();
  });

  it('PAYMOB checkout marks payment as CAPTURED and simulated: true', () => {
    const result = commerceService.completeMultiServiceCheckout({
      tripId: 'TRIP-TEST',
      travelerUserId: 'USR-TEST',
      travelerName: 'Card User',
      travelerPhone: '+201000000001',
      travelerEmail: 'card@traveler.test',
      items: [heldItem()],
      paymentParams: {
        idempotencyKey: nextIdempotencyKey(),
        provider: 'PAYMOB',
        cardLast4: '4242',
        cardBrand: 'Visa',
      },
    });

    expect(result.paymentState).toBe('CAPTURED');

    const payment = db.payments.find(
      (p) => p.tripId === 'TRIP-TEST' && p.provider === 'PAYMOB'
    );
    expect(payment).toBeDefined();
    expect(payment!.state).toBe('CAPTURED');
    // Simulation disclosure: the platform is not collecting real money.
    expect(payment!.simulated).toBe(true);

    // Ledger carries PAYMENT_CAPTURED + 15% commission.
    const capturedEntries = db.ledgerEntries.filter(
      (e) => e.type === 'PAYMENT_CAPTURED' && e.tripId === 'TRIP-TEST'
    );
    expect(capturedEntries.length).toBeGreaterThanOrEqual(1);

    const commissionEntries = db.ledgerEntries.filter(
      (e) => e.type === 'PLATFORM_COMMISSION' && e.tripId === 'TRIP-TEST'
    );
    expect(commissionEntries.length).toBeGreaterThanOrEqual(1);
    expect(commissionEntries[0].amountEGP).toBe(Math.round(1200 * 0.15)); // 180

    // Refundable amount equals what was captured.
    expect(paymentService.refundableAmountEGP({ tripId: 'TRIP-TEST' })).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// Rental-service CASH_ON_ARRIVAL — the original regression site
// ---------------------------------------------------------------------------

describe('CASH_ON_ARRIVAL — rental checkout (original regression)', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  it('rental checkout: paymentState = PENDING, not CAPTURED', () => {
    const listing = seedRentalListing();

    // Create a hold.
    const holdResult = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'Cash Renter',
      travelerPhone: '+201000000002',
      travelerEmail: 'cash.renter@test',
      startDate: futureDate(30),
      endDate: futureDate(32),
      quantity: 2,
      idempotencyKey: nextIdempotencyKey(),
    });

    // Checkout with CASH_ON_ARRIVAL.
    const checkoutResult = rentalService.checkoutRentalBooking({
      rentalBookingId: holdResult.booking.id,
      tripId: 'TRIP-TEST',
      travelerName: 'Cash Renter',
      travelerPhone: '+201000000002',
      travelerEmail: 'cash.renter@test',
      idempotencyKey: nextIdempotencyKey(),
      provider: 'CASH_ON_ARRIVAL',
    });

    expect(checkoutResult.success).toBe(true);

    // Rental booking row: status is PENDING_CONFIRMATION (provider hasn't seen it),
    // paymentState is PENDING (no money captured).
    const rentalBooking = db.rentalBookings.find(
      (b) => b.id === holdResult.booking.id
    )!;
    expect(rentalBooking.status).toBe('PENDING_CONFIRMATION');
    expect(rentalBooking.paymentState).toBe('PENDING');

    // Commerce booking row: also PENDING.
    const commerceBooking = db.bookings.find(
      (b) => b.bookingRef === checkoutResult.bookingRef
    )!;
    expect(commerceBooking.paymentState).toBe('PENDING');

    // Payment row: PENDING, CASH_ON_ARRIVAL.
    const payment = db.payments.find(
      (p) => p.tripId === 'TRIP-TEST' && p.provider === 'CASH_ON_ARRIVAL'
    );
    expect(payment).toBeDefined();
    expect(payment!.state).toBe('PENDING');

    // Ledger: no PAYMENT_CAPTURED, and no escrow credit for unreceived cash.
    const capturedEntries = db.ledgerEntries.filter(
      (e) =>
        e.type === 'PAYMENT_CAPTURED' &&
        e.bookingRef === checkoutResult.bookingRef
    );
    expect(capturedEntries).toHaveLength(0);
    expect(ledgerService.verifyLedgerIntegrity().escrowBalanceEGP).toBe(0);

    // No commission booked.
    const commissionEntries = db.ledgerEntries.filter(
      (e) =>
        e.type === 'PLATFORM_COMMISSION' &&
        e.bookingRef === checkoutResult.bookingRef
    );
    expect(commissionEntries).toHaveLength(0);
  });

  it('rental cancel: no refund for a cash-on-arrival booking', () => {
    const listing = seedRentalListing();

    const holdResult = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'Cash Renter',
      travelerPhone: '+201000000002',
      travelerEmail: 'cash.renter@test',
      startDate: futureDate(30),
      endDate: futureDate(32),
      quantity: 2,
      idempotencyKey: nextIdempotencyKey(),
    });

    rentalService.checkoutRentalBooking({
      rentalBookingId: holdResult.booking.id,
      tripId: 'TRIP-TEST',
      travelerName: 'Cash Renter',
      travelerPhone: '+201000000002',
      travelerEmail: 'cash.renter@test',
      idempotencyKey: nextIdempotencyKey(),
      provider: 'CASH_ON_ARRIVAL',
    });

    const cancelled = rentalService.cancelRentalBooking({
      bookingId: holdResult.booking.id,
      actor: { userId: 'USR-TEST', role: 'Traveler' },
      reason: 'Changed my mind',
    });

    expect(cancelled.status).toBe('CANCELLED');
    // No refund: the booking was not paid.
    expect(cancelled.paymentState).not.toBe('REFUNDED');

    // No REFUND_ISSUED entries in the ledger.
    const refundEntries = db.ledgerEntries.filter(
      (e) =>
        e.type === 'REFUND_ISSUED' &&
        e.bookingRef === cancelled.bookingRef
    );
    expect(refundEntries).toHaveLength(0);

    // Refundable amount is zero.
    expect(
      paymentService.refundableAmountEGP({ tripId: 'TRIP-TEST' })
    ).toBe(0);
  });
});
