import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { smsGatewayService, smsDispatchLogs } from '../../server/services/smsGatewayService';
import { transferService } from '../../server/services/transferService';
import type { BookingEntity } from '../../server/db/schema';
import { runMigrationsAndSeed } from '../../server/db/migrations';
import { resetDb } from '../helpers/fixtures';

/**
 * Booking SMS goes to the people actually on the booking — nobody invented.
 *
 * Every single checkout texted '+20 100 876 5432' ("Mahmoud Salem") and
 * '+20 101 445 6677' ("Omar Soliman") — hasDiving/hasSafari were hardcoded
 * true — so two fictional numbers (real phones, belonging to someone) got the
 * traveller's name and phone on every booking. The traveller message also
 * claimed a driver was assigned when nobody had been.
 */

const FICTIONAL = ['+20 100 876 5432', '+20 101 445 6677', '+20 100 123 4567'];
const savedTwilio = { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN };

function booking(over: Partial<BookingEntity> = {}): BookingEntity {
  const now = new Date().toISOString();
  return {
    id: 'DHB-TRF-SMS-1', bookingRef: 'DHB-TRF-SMS-1', tripId: 'TRIP-TEST', supplierId: 'SUP-SMS',
    skuId: 'SKU-TRF-TEST', serviceType: 'transfer', amountEGP: 1400, paymentState: 'PENDING',
    supplierState: 'PENDING_CONFIRMATION', travelerName: 'Real Traveler', travelerPhone: '+201000000009',
    travelerEmail: 't@example.test', passengersCount: 2, scheduledDate: '2027-01-15', scheduledTime: '10:30 AM',
    confirmationCode: 'DHB-SMS-OK', createdAt: now, updatedAt: now, ...over
  };
}

function seedSupplier(phone?: string) {
  db.suppliers.push({
    id: 'SUP-SMS', businessName: 'Real Shuttle Co', businessNameAr: 'شركة النقل', category: 'transfer',
    tier: 'Vetted Local Partner', status: 'Active', area: 'lighthouse', ...(phone ? { phone } : {})
  });
}

const sentTo = (ref: string) => smsDispatchLogs.filter(r => r.referenceBookingId === ref).map(r => r.recipientPhone);

describe('booking SMS recipients', () => {
  beforeEach(() => {
    resetDb();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    smsDispatchLogs.splice(0, smsDispatchLogs.length);
  });
  afterEach(() => {
    if (savedTwilio.sid !== undefined) process.env.TWILIO_ACCOUNT_SID = savedTwilio.sid;
    if (savedTwilio.token !== undefined) process.env.TWILIO_AUTH_TOKEN = savedTwilio.token;
  });

  it('texts the supplier contact on record and the traveller, never a hardcoded number', async () => {
    seedSupplier('+201222222222');
    await smsGatewayService.dispatchBookingSms(booking());
    const to = sentTo('DHB-TRF-SMS-1');
    expect(to.sort()).toEqual(['+201000000009', '+201222222222'].sort());
    FICTIONAL.forEach(n => expect(to).not.toContain(n));
  });

  it('texts the assigned driver when one has been assigned', async () => {
    seedSupplier('+201222222222');
    await smsGatewayService.dispatchBookingSms(booking({
      assignedResource: { driverName: 'Assigned Driver', driverPhone: '+201333333333' }
    }));
    expect(sentTo('DHB-TRF-SMS-1')).toContain('+201333333333');
    expect(sentTo('DHB-TRF-SMS-1')).not.toContain('+201222222222');
  });

  it('sends no provider SMS when nobody on record has a phone', async () => {
    seedSupplier();
    await smsGatewayService.dispatchBookingSms(booking());
    expect(sentTo('DHB-TRF-SMS-1')).toEqual(['+201000000009']);
  });

  it('does not invent a traveller number when the booking has none', async () => {
    seedSupplier('+201222222222');
    await smsGatewayService.dispatchBookingSms(booking({ travelerPhone: '' }));
    expect(sentTo('DHB-TRF-SMS-1')).toEqual(['+201222222222']);
  });

  it('does not tell the traveller a driver is assigned when none is', async () => {
    seedSupplier('+201222222222');
    await smsGatewayService.dispatchBookingSms(booking());
    const travellerSms = smsDispatchLogs.find(r => r.recipientRole === 'TRAVELER')!;
    expect(travellerSms.message).not.toMatch(/driver assigned/i);
  });
});

describe('transfer telemetry for a booking with no record yet', () => {
  beforeEach(() => resetDb());

  it('says honestly that no driver is assigned instead of returning a canned one', () => {
    const t = transferService.telemetryFor('DHB-TRF-UNKNOWN');
    expect(t.assigned).toBe(false);
    expect(t.status).toBe('NOT_ASSIGNED');
    expect(t.driverName).toBeNull();
    expect(t.driverPhone).toBeNull();
    expect(JSON.stringify(t)).not.toContain('Mahmoud');
    expect(JSON.stringify(t)).not.toContain('876 5432');
  });

  it('returns the stored record when one exists', () => {
    db.transferTelemetry.push({
      bookingId: 'DHB-TRF-REAL', referenceCode: 'DHB-TRF-REAL', driverName: 'Real Driver', driverPhone: '+201444444444',
      vehicleModel: 'Van', vehiclePlate: 'ABC', pickupLocation: 'SSH', dropoffLocation: 'Dahab', scheduledTime: '10:30 AM',
      flightStatus: 'ON_TIME', status: 'DISPATCHED', lastGpsUpdate: 'now', updatedAt: new Date().toISOString()
    });
    const t = transferService.telemetryFor('DHB-TRF-REAL');
    expect(t.assigned).toBe(true);
    expect(t.driverName).toBe('Real Driver');
  });
});

describe('seeded supplier records', () => {
  it('carry none of the invented contact numbers after boot reconcile', () => {
    resetDb();
    // A store seeded by an older build still has the invented number on file.
    db.suppliers.push({
      id: 'SUP-SHUTTLE-01', businessName: 'Old seed', businessNameAr: 'قديم', category: 'transfer',
      tier: 'Tier 1 Certified', status: 'Active', area: 'x', phone: '+20 100 876 5432'
    });
    runMigrationsAndSeed();
    const phones = db.suppliers.flatMap(s => [s.phone, s.whatsapp]).filter(Boolean);
    FICTIONAL.forEach(n => expect(phones).not.toContain(n));
  });
});
