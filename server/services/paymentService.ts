import crypto from 'crypto';
import { db } from '../db/database';
import { PaymentEntity } from '../db/schema';
import { ledgerService } from './ledgerService';
import { canTransition } from './bookingLifecycle';
import { adjustPayoutForRefund } from './payoutService';
import { PaymentState } from '../../src/shared';
import { settingsService } from './settingsService';

// No fallback: a hardcoded secret in source lets anyone who can read this repo
// forge signed "payment succeeded" webhooks. Absent config must fail closed.
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

export class PaymentService {
  /** Named once so capture and its reversal cannot drift apart. */
  public static readonly DEFAULT_COMMISSION_RATE = 0.15;

  /**
   * The platform commission, read from the `commerce.commissionRate` setting
   * (docs/OPS_API_CONTRACT.md) with 0.15 as the default. Still a static on
   * PaymentService so every existing caller (capture, reversal, supplier
   * payouts, tests) reads the same value the same way.
   */
  public static get COMMISSION_RATE(): number {
    const rate = settingsService.getNumber('commerce.commissionRate', PaymentService.DEFAULT_COMMISSION_RATE);
    return rate >= 0 && rate < 1 ? rate : PaymentService.DEFAULT_COMMISSION_RATE;
  }

  /**
   * Whether the simulated settlement path may run.
   *
   * Off in production unless explicitly overridden, so a deployment cannot
   * quietly confirm bookings it never charged for.
   */
  public static simulationAllowed(): boolean {
    if (process.env.ALLOW_SIMULATED_PAYMENTS === 'true') return true;
    return process.env.NODE_ENV !== 'production';
  }

  public processCheckout(params: {
    idempotencyKey: string;
    tripId: string;
    holdToken?: string;
    bookingId?: string;
    amountEGP: number;
    currency?: 'EGP' | 'USD' | 'EUR';
    provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
    paymentMethodType?: 'CARD' | 'WALLET' | 'CASH';
    /** Last four digits only — never a full PAN, and never expiry or CVV. */
    cardLast4?: string;
    cardBrand?: string;
    cardHolderName?: string;
    payerEmail?: string;
    payerPhone?: string;
  }): { payment: PaymentEntity; requires3DS?: boolean; redirectUrl?: string } {
    // This method does not contact a payment gateway. Card/wallet providers
    // are marked CAPTURED and written to the ledger as simulated settlements —
    // a "successful" checkout collects no money while issuing a real voucher.
    // CASH_ON_ARRIVAL is the honest exception: no money moved, so the payment
    // is recorded as PENDING and the ledger gets nothing at all.
    //
    // Until a gateway is integrated the card path must not run anywhere money
    // is expected. Set ALLOW_SIMULATED_PAYMENTS=true to use it in dev/demo.
    // Cash on arrival never touches a gateway, so the production simulation
    // gate does not apply. Card and wallet still refuse until a gateway exists.
    const requestedProvider = params.provider || 'PAYMOB';
    if (requestedProvider !== 'CASH_ON_ARRIVAL' && !PaymentService.simulationAllowed()) {
      const err = new Error(
        'Payment processing is not configured. Card settlement is unavailable: ' +
        'no payment gateway is integrated, and simulated payments are disabled.'
      ) as Error & { status?: number };
      err.status = 503;
      throw err;
    }

    // 1. Idempotency Check
    const existing = db.payments.find(p => p.idempotencyKey === params.idempotencyKey);
    if (existing) {
      return { payment: existing };
    }

    const transactionId = `TXN-PM-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    // cardLast4 is derived from a caller-supplied last-4 fragment, never a full
    // PAN. Accepting whole card numbers here put the entire application into
    // PCI-DSS scope; a real integration supplies a gateway token instead.
    const suppliedFragment = (params.cardLast4 || '').replace(/\D/g, '').slice(-4);
    const cardLast4 = suppliedFragment || '0000';
    const cardBrand = params.cardBrand || 'Unknown';
    const now = new Date().toISOString();

    const signatureSource = `${transactionId}:${params.idempotencyKey}:${params.amountEGP}:${params.tripId}:${now}`;
    const signatureHash = `sha256:${crypto.createHash('sha256').update(signatureSource).digest('hex')}`;
    const authCode = `AUTH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const provider = params.provider || 'PAYMOB';
    // Cash-on-arrival is a real commitment with no platform money movement:
    // the traveler pays the provider in person. Recording it CAPTURED would
    // put unsettled money into the books.
    const isCashOnArrival = provider === 'CASH_ON_ARRIVAL';

    const payment: PaymentEntity = {
      id: `PAY-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      transactionId,
      idempotencyKey: params.idempotencyKey,
      holdToken: params.holdToken,
      tripId: params.tripId,
      bookingId: params.bookingId,
      amountEGP: params.amountEGP,
      currency: params.currency || 'EGP',
      provider,
      paymentMethodType: isCashOnArrival ? 'CASH' : (params.paymentMethodType || 'CARD'),
      state: isCashOnArrival ? 'PENDING' : 'CAPTURED',
      authCode,
      signatureHash,
      cardLast4,
      cardBrand,
      payerName: params.cardHolderName || 'Authorized Traveler',
      payerEmail: params.payerEmail,
      payerPhone: params.payerPhone,
      // Marked so simulated money is never mistaken for settled money in
      // reconciliation or in the operations console.
      simulated: true,
      webhookEvents: [
        {
          eventId: `EVT-${Date.now()}`,
          type: 'TRANSACTION_APPROVED',
          timestamp: now,
          verified: false,
          rawPayloadHash: signatureHash
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    db.runInTransaction(() => {
      db.payments.push(payment);

      // Ledger: Credit Escrow, Debit Traveler — for money that actually moved.
      //
      // Cash-on-arrival used to write a HOLD_ESCROW entry crediting
      // PLATFORM_ESCROW_MAIN here. The traveller pays the provider in person,
      // so that cash never reaches escrow — yet the phantom credit counted in
      // the escrow balance settlePayout guards on, letting payouts for other
      // bookings draw on money that was never received. The cash side is
      // booked when the supplier completes the booking
      // (supplierService.settleCompletion): commission owed by the supplier,
      // no payout.
      if (!isCashOnArrival) {
        ledgerService.recordDoubleEntry({
          transactionId,
          idempotencyKey: `LEDGER-${params.idempotencyKey}`,
          bookingRef: params.bookingId || `TRIP-${params.tripId}`,
          tripId: params.tripId,
          type: 'PAYMENT_CAPTURED',
          amountEGP: params.amountEGP,
          debitAccount: `TRAVELER_GATEWAY_${cardLast4}`,
          creditAccount: 'PLATFORM_ESCROW_MAIN',
          metadata: {
            provider: payment.provider,
            authCode: payment.authCode,
            cardBrand: payment.cardBrand,
            payerEmail: payment.payerEmail
          }
        });
      }

      // Platform Commission Entry (15%)
      // Commission is recognized on settlement. A pending cash hold has not
      // settled, so booking one must not book revenue.
      const commissionAmount = Math.round(params.amountEGP * PaymentService.COMMISSION_RATE);
      if (!isCashOnArrival && commissionAmount > 0) {
        ledgerService.recordDoubleEntry({
          transactionId: `${transactionId}-COMM`,
          idempotencyKey: `LEDGER-COMM-${params.idempotencyKey}`,
          bookingRef: params.bookingId || `TRIP-${params.tripId}`,
          tripId: params.tripId,
          type: 'PLATFORM_COMMISSION',
          amountEGP: commissionAmount,
          debitAccount: 'PLATFORM_ESCROW_MAIN',
          creditAccount: 'PLATFORM_REVENUE_COMMISSIONS',
          metadata: {
            rate: `${PaymentService.COMMISSION_RATE * 100}%`,
            originalPaymentId: payment.id
          }
        });
      }

      db.logAudit(payment.payerName || 'Traveler', 'Traveler', 'PAYMENT_PROCESSED', 'Payment', payment.id, {
        amountEGP: payment.amountEGP,
        transactionId: payment.transactionId,
        provider: payment.provider
      });
    });

    return { payment };
  }

  /**
   * Computes the SHA-512 HMAC for Paymob webhook payload according to Paymob v1 protocol.
   */
  public calculatePaymobWebhookHmac(payload: any, secret = PAYMOB_HMAC_SECRET): string {
    const data = (payload && typeof payload === 'object' && payload.obj) ? payload.obj : (payload || {});
    const concatenated = [
      data.amount_cents ?? '',
      data.created_at ?? '',
      data.currency ?? '',
      data.error_occured ?? '',
      data.has_parent_transaction ?? '',
      data.id ?? '',
      data.integration_id ?? '',
      data.is_3d_secure ?? '',
      data.is_auth ?? '',
      data.is_capture ?? '',
      data.is_refunded ?? '',
      data.is_standalone_payment ?? '',
      data.is_voided ?? '',
      data.order?.id ?? '',
      data.owner ?? '',
      data.pending ?? '',
      data.source_data?.pan ?? '',
      data.source_data?.sub_type ?? '',
      data.source_data?.type ?? '',
      data.success ?? ''
    ].join('');

    if (!secret) {
      throw new Error('PAYMOB_HMAC_SECRET is not configured; cannot compute webhook signature.');
    }
    return crypto.createHmac('sha512', secret).update(concatenated).digest('hex');
  }

  /**
   * Timing-safe verification of Paymob webhook HMAC signature.
   * In strict mode (default in production and security-audited flows), unsigned requests are strictly rejected.
   */
  public verifyPaymobWebhookHmac(payload: any, receivedHmac?: string, allowUnsignedInDev = false): boolean {
    if (!PAYMOB_HMAC_SECRET) {
      // Fail closed and say why: without the shared secret no signature can be trusted.
      console.error('[PaymentService] PAYMOB_HMAC_SECRET is not configured; rejecting all webhooks.');
      return false;
    }
    if (!receivedHmac) {
      // Reject unsigned webhooks unless explicitly permitted in isolated dev mock
      if (allowUnsignedInDev && process.env.NODE_ENV !== 'production') {
        return true;
      }
      return false;
    }
    try {
      const calculatedHmac = this.calculatePaymobWebhookHmac(payload);
      const calculatedBuf = Buffer.from(calculatedHmac.toLowerCase(), 'utf8');
      const receivedBuf = Buffer.from(receivedHmac.toLowerCase(), 'utf8');

      if (calculatedBuf.length !== receivedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(calculatedBuf, receivedBuf);
    } catch {
      return false;
    }
  }

  public handleWebhook(payload: any, hmacSignature?: string, allowUnsignedInDev = false): { success: boolean; eventId: string; message: string } {
    const eventId = `WH-EVT-${payload.id || Date.now()}`;
    const isValid = this.verifyPaymobWebhookHmac(payload, hmacSignature, allowUnsignedInDev);

    if (!isValid) {
      db.logAudit('PaymobGateway', 'System', 'WEBHOOK_SIGNATURE_REJECTED', 'Webhook', eventId, {
        payloadId: payload.id,
        receivedHmac: hmacSignature ? hmacSignature.substring(0, 10) + '...' : 'NONE'
      });
      return { success: false, eventId, message: 'Invalid or missing HMAC signature.' };
    }

    const transactionId = payload.transaction_id || payload.id;
    const payment = db.payments.find(p => p.transactionId === transactionId || p.idempotencyKey === payload.order_id);

    if (payment) {
      // Replay protection: check if event already recorded
      const alreadyHandled = payment.webhookEvents.some(e => e.eventId === eventId);
      if (alreadyHandled) {
        return { success: true, eventId, message: 'Duplicate webhook event ignored (idempotent).' };
      }

      db.runInTransaction(() => {
        payment.webhookEvents.push({
          eventId,
          type: payload.success ? 'TRANSACTION_SUCCESS' : 'TRANSACTION_FAILED',
          timestamp: new Date().toISOString(),
          verified: isValid,
          rawPayloadHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
        });

        // The previous guard was inverted: payments are created CAPTURED (line
        // 87), so `state !== 'CAPTURED'` was false and a gateway-declared
        // failure could never mark the payment FAILED — it stayed CAPTURED
        // forever. The success branch re-asserts CAPTURED; a failure always
        // transitions to FAILED (unless already failed).
        if (payload.success) {
          payment.state = 'CAPTURED';
        } else if (payment.state !== 'FAILED') {
          payment.state = 'FAILED';
        }

        payment.updatedAt = new Date().toISOString();
        db.logAudit('PaymobGateway', 'System', 'WEBHOOK_PROCESSED', 'Payment', payment.id, {
          eventId,
          success: payload.success
        });
      });
    }

    return { success: true, eventId, message: 'Webhook processed.' };
  }

  /**
   * What may still be refunded for a booking or trip.
   *
   * processRefund had no cap: it debited PLATFORM_ESCROW_MAIN for whatever
   * amount it was handed, with no check that the money had ever been collected.
   * The CRIT-12 escrow-overdraft check catches the *result*, but a refund
   * larger than the capture should never be written in the first place.
   */
  public refundableAmountEGP(params: { bookingId?: string; tripId: string }): number {
    // Counted from the LEDGER, not from db.payments.
    //
    // The ledger is the authoritative double-entry record — that is what it is
    // for — and the two are not always in step: the seeded database carries
    // four PAYMENT_CAPTURED entries totalling 20,800 EGP with no payment rows
    // at all, so sourcing this from db.payments reported nothing refundable and
    // would have blocked every legitimate refund on existing bookings.
    const belongsHere = (entry: { bookingRef: string; tripId: string }) =>
      params.bookingId ? entry.bookingRef === params.bookingId : entry.tripId === params.tripId;

    const sumOf = (type: string) => db.ledgerEntries
      .filter(e => e.type === type && belongsHere(e))
      .reduce((total, e) => total + e.amountEGP, 0);

    return Math.max(0, sumOf('PAYMENT_CAPTURED') - sumOf('REFUND_ISSUED'));
  }

  public processRefund(params: {
    bookingId?: string;
    tripId: string;
    amountEGP: number;
    reason: string;
    idempotencyKey: string;
    initiatedBy?: string;
  }): { refundId: string; amountEGP: number; status: string; signatureHash: string } {
    if (!Number.isFinite(params.amountEGP) || params.amountEGP <= 0) {
      const err = new Error('Refund amount must be a positive number.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }

    const refundable = this.refundableAmountEGP({ bookingId: params.bookingId, tripId: params.tripId });
    if (params.amountEGP > refundable) {
      const err = new Error(
        `Refund of ${params.amountEGP} EGP exceeds what was captured and not yet refunded (${refundable} EGP).`
      ) as Error & { status?: number };
      err.status = 409;
      throw err;
    }

    const refundId = `REF-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const transactionId = `TXN-REF-${Date.now()}`;
    const now = new Date().toISOString();

    const signatureSource = `${transactionId}:${params.idempotencyKey}:${params.amountEGP}:${params.tripId}:${now}`;
    const signatureHash = `sha256:${crypto.createHash('sha256').update(signatureSource).digest('hex')}`;

    db.runInTransaction(() => {
      // Record double entry: Debit Platform Escrow, Credit Traveler Payment Method
      ledgerService.recordDoubleEntry({
        transactionId,
        idempotencyKey: params.idempotencyKey,
        bookingRef: params.bookingId || `TRIP-${params.tripId}`,
        tripId: params.tripId,
        type: 'REFUND_ISSUED',
        amountEGP: params.amountEGP,
        debitAccount: 'PLATFORM_ESCROW_MAIN',
        creditAccount: 'TRAVELER_CARD_REFUND',
        metadata: {
          refundId,
          reason: params.reason,
          initiatedBy: params.initiatedBy || 'System'
        }
      });

      // Reverse the platform's share of what is being refunded.
      //
      // Capture writes two entries: the full amount into escrow, and 15% of it
      // straight back out into PLATFORM_REVENUE_COMMISSIONS. A refund debited
      // escrow for the full amount without touching the commission, so refunding
      // a booking in full left escrow overdrawn by exactly the commission —
      // the platform kept its fee on money it had given back.
      const commissionToReverse = Math.round(params.amountEGP * PaymentService.COMMISSION_RATE);
      if (commissionToReverse > 0) {
        ledgerService.recordDoubleEntry({
          transactionId: `${transactionId}-COMM-REV`,
          idempotencyKey: `LEDGER-COMM-REV-${params.idempotencyKey}`,
          bookingRef: params.bookingId || `TRIP-${params.tripId}`,
          tripId: params.tripId,
          type: 'COMMISSION_REVERSAL',
          amountEGP: commissionToReverse,
          debitAccount: 'PLATFORM_REVENUE_COMMISSIONS',
          creditAccount: 'PLATFORM_ESCROW_MAIN',
          metadata: {
            rate: `${PaymentService.COMMISSION_RATE * 100}%`,
            refundId,
            reason: 'Refund of the underlying payment'
          }
        });
      }

      // If associated with a booking, mark payment as REFUNDED or PARTIALLY_REFUNDED
      if (params.bookingId) {
        const booking = db.bookings.find(b => b.id === params.bookingId || b.bookingRef === params.bookingId);
        if (booking) {
          booking.paymentState = 'REFUNDED';
          // Only a live booking becomes CANCELLED. A refund on a REJECTED or
          // COMPLETED booking used to rewrite it to CANCELLED, erasing that
          // the supplier refused it or delivered it.
          if (canTransition(booking.supplierState, 'CANCELLED')) {
            booking.supplierState = 'CANCELLED';
          }
          booking.updatedAt = now;

          // The supplier's pending payout must shrink with the refund. It was
          // never touched (cancelPayout had no caller), so a booking refunded
          // inside the 24h hold still had its full 85% settle from escrow —
          // paying the supplier with the money just returned. Cancelled on a
          // full refund, cut to the supplier share of the remainder on a
          // partial one.
          const remainingEGP = refundable - params.amountEGP;
          adjustPayoutForRefund(
            booking.bookingRef,
            remainingEGP - Math.round(remainingEGP * PaymentService.COMMISSION_RATE),
            refundId
          );
        }
      }

      db.logAudit(params.initiatedBy || 'System', 'Operations', 'REFUND_PROCESSED', 'Payment', refundId, {
        amountEGP: params.amountEGP,
        reason: params.reason,
        tripId: params.tripId,
        bookingId: params.bookingId
      });
    });

    return {
      refundId,
      amountEGP: params.amountEGP,
      status: 'SETTLED',
      signatureHash
    };
  }
}

export const paymentService = new PaymentService();
