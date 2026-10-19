import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { normaliseEgyptMobile, walletPayee } from '../../server/services/walletPayeeService';
import {
  claimWalletPayment,
  markPaid,
  recordPaymentProof,
  reserveStay,
} from '../../server/services/hotelBookingService';
import type { RoomTypeEntity } from '../../server/db/schema';

/**
 * InstaPay / Vodafone Cash deposits: the payee a booking names, the dial code
 * that pre-fills a Vodafone Cash transfer, and the traveller's "I've sent it"
 * claim the desk matches against the wallet's history.
 */

const ENV_KEYS = ['STAY_PAYEE_PHONE', 'INSTAPAY_PHONE', 'INSTAPAY_IPA', 'INSTAPAY_PAYMENT_LINK', 'VODAFONE_CASH_NUMBER', 'WALLET_PAYEE_NAME'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.useRealTimers();
});

describe('normaliseEgyptMobile', () => {
  it('accepts the international and local forms of an Egyptian mobile', () => {
    for (const raw of ['+201002328005', '201002328005', '01002328005', '010 0232 8005']) {
      expect(normaliseEgyptMobile(raw)).toEqual({ phone: '+201002328005', localPhone: '01002328005' });
    }
  });

  it('rejects landlines, short numbers and foreign numbers', () => {
    for (const raw of ['0223456789', '0100232800', '+447700900123', 'abc']) {
      expect(normaliseEgyptMobile(raw)).toBeNull();
    }
  });
});

describe('walletPayee', () => {
  it('falls back to the concierge line, and builds the Vodafone Cash transfer code', () => {
    expect(walletPayee('VODAFONE_CASH', 1560)).toEqual({
      phone: '+201002328005',
      localPhone: '01002328005',
      ussd: '*9*7*01002328005*1560#',
    });
    expect(walletPayee('INSTAPAY', 1560)).toEqual({ phone: '+201002328005', localPhone: '01002328005' });
    expect(walletPayee('CASH_ON_ARRIVAL', 1560)).toBeUndefined();
  });

  it('uses the configured wallets, address and name', () => {
    process.env.VODAFONE_CASH_NUMBER = '+201099990000';
    process.env.INSTAPAY_PHONE = '01188887777';
    process.env.INSTAPAY_IPA = 'dahab@instapay';
    process.env.WALLET_PAYEE_NAME = 'Dahab Travel';
    process.env.INSTAPAY_PAYMENT_LINK = 'https://ipn.eg/S/dahab/instapay/abc';

    expect(walletPayee('VODAFONE_CASH', 999.6)).toMatchObject({ localPhone: '01099990000', ussd: '*9*7*01099990000*1000#', accountName: 'Dahab Travel' });
    expect(walletPayee('INSTAPAY', 500)).toEqual({
      phone: '+201188887777',
      localPhone: '01188887777',
      ipa: 'dahab@instapay',
      accountName: 'Dahab Travel',
      paymentLink: 'https://ipn.eg/S/dahab/instapay/abc',
    });
  });

  it('never prints a payment link that is not InstaPay\'s own https host', () => {
    for (const link of ['http://ipn.eg/S/x', 'https://ipn.eg.evil.com/S/x', 'javascript:alert(1)', 'https://example.com']) {
      process.env.INSTAPAY_PAYMENT_LINK = link;
      expect(walletPayee('INSTAPAY', 500)).not.toHaveProperty('paymentLink');
    }
  });
});

const roomType = (): RoomTypeEntity => ({
  id: 'RT-W', accommodationId: 'ACC-W', skuId: 'SKU-W', supplierId: 'SUP-W',
  code: 'STD', name: 'Standard', nameAr: 'عادي', maxGuestsPerUnit: 2, baseNightlyEGP: 1000,
  minNights: 1, maxNights: 30, cancellationPolicyHours: 48, totalUnits: 2,
  inventorySource: 'SEED_PUBLISHED', amenities: [], images: [], active: true, displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

const guest = { userId: 'USR-G', name: 'Guest', phone: '+201000000001', email: 'g@example.com' };
const traveller = { userId: 'USR-G', role: 'Traveler' };
const staff = { userId: 'USR-OPS', role: 'Operations' };

function reserve(method: 'INSTAPAY' | 'VODAFONE_CASH', key = 'K1') {
  return reserveStay(
    { accommodationId: 'ACC-W', roomTypeId: 'RT-W', checkIn: '2026-07-10', checkOut: '2026-07-12', rooms: 1, adults: 2, children: 0, paymentMethod: method, idempotencyKey: key },
    guest
  );
}

describe('a wallet deposit, end to end', () => {
  beforeEach(() => {
    resetDb();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-01T09:00:00Z'));
    db.roomTypes.push(roomType());
  });

  it('names the wallet and the exact dial code on the booking', () => {
    process.env.VODAFONE_CASH_NUMBER = '01099990000';
    const b = reserve('VODAFONE_CASH');
    const pi = b.paymentInstructions;
    expect(pi.payee?.ussd).toBe(`*9*7*01099990000*${b.depositEGP}#`);
    expect(pi.contactPhone).toBe('+201099990000');
    expect(pi.instructionsAr).toContain('01099990000');
    expect(pi.instructions).not.toContain('{phone}');
  });

  it('records the number paid from, without moving the status or touching the booking reference', () => {
    const b = reserve('INSTAPAY');
    const claimed = claimWalletPayment(b.bookingRef, traveller, { payerNumber: '+20 100 000 0002', payerReference: 'IPN-778' });
    expect(claimed.status).toBe('PENDING_PAYMENT');
    expect(claimed.paymentInstructions).toMatchObject({ payerNumber: '01000000002', payerReference: 'IPN-778', reference: b.bookingRef });
    expect(claimed.paymentInstructions.claimedAt).toBeDefined();

    const paid = markPaid(b.bookingRef, staff, { reference: 'IPN-778' });
    expect(paid.status).toBe('PENDING_CONFIRMATION');
    // The desk's transaction id never replaces the reference the guest quotes.
    expect(paid.paymentInstructions).toMatchObject({ reference: b.bookingRef, payerReference: 'IPN-778' });
  });

  it('a receipt\'s transaction id no longer overwrites the booking reference', () => {
    const b = reserve('INSTAPAY');
    const withProof = recordPaymentProof(b.bookingRef, traveller, { proofUrl: 'https://example.com/r.png', reference: 'TRX-1' });
    expect(withProof.paymentInstructions.reference).toBe(b.bookingRef);
    expect(withProof.paymentInstructions.payerReference).toBe('TRX-1');
  });

  it('refuses a bad number, an empty claim, someone else\'s booking and a paid one', () => {
    const b = reserve('VODAFONE_CASH');
    expect(() => claimWalletPayment(b.bookingRef, traveller, { payerNumber: '12345' })).toThrow(expect.objectContaining({ code: 'INVALID_PAYER_NUMBER' }));
    expect(() => claimWalletPayment(b.bookingRef, traveller, {})).toThrow(expect.objectContaining({ code: 'CLAIM_EMPTY' }));
    expect(() => claimWalletPayment(b.bookingRef, { userId: 'USR-X', role: 'Traveler' }, { payerNumber: '01000000002' })).toThrow(expect.objectContaining({ code: 'NOT_YOUR_BOOKING' }));

    markPaid(b.bookingRef, staff, {});
    expect(() => claimWalletPayment(b.bookingRef, traveller, { payerNumber: '01000000002' })).toThrow(expect.objectContaining({ code: 'NOT_PENDING_PAYMENT' }));
  });

  it('still takes the claim after the hold lapsed, so late money can be matched', () => {
    const b = reserve('VODAFONE_CASH');
    db.hotelBookings.find(x => x.bookingRef === b.bookingRef)!.status = 'EXPIRED';
    expect(claimWalletPayment(b.bookingRef, traveller, { payerNumber: '01000000002' }).paymentInstructions.payerNumber).toBe('01000000002');
  });
});
