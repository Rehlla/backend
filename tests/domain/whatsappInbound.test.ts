import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { whatsappInboundRouter } from '../../server/services/whatsappInboundService';
import { transferHubService } from '../../server/services/transferHubService';
import { resetDb, seedSku } from '../helpers/fixtures';

/**
 * What an inbound WhatsApp message does to the domain.
 *
 * The transport is only half the feature: the other half is that "5 min" from a
 * driver becomes a live ride update, "yes" against a party books it, and
 * anything else lands in the support queue instead of a void.
 */

const driverPhone = '+20 100 555 1234';
const partyNumber = '+20 100 999 8888';

const seedTransferBooking = () => {
  const booking = {
    id: 'DHB-HUB-TEST-1',
    bookingRef: 'DHB-HUB-TEST-1',
    tripId: 'trip-x',
    supplierId: 'SUP-SHUTTLE-01',
    skuId: 'SKU-TRF-HUB-ssh-private',
    serviceType: 'transfer' as const,
    amountEGP: 4805,
    paymentState: 'CAPTURED' as const,
    supplierState: 'PENDING_CONFIRMATION' as const,
    travelerName: 'Nour Hassan',
    travelerPhone: '01000000001',
    travelerEmail: 'nour@example.com',
    passengersCount: 2,
    pickupLocation: 'Sharm Airport',
    dropoffLocation: 'Masbat & Lighthouse',
    scheduledDate: '2026-11-05',
    scheduledTime: '14:00',
    confirmationCode: 'DHB-HUB-CCC0001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignedResource: { driverName: 'Ahmed', driverPhone },
    hubQuote: { originId: 'ssh', destinationId: 'masbat' }
  } as never;
  db.bookings.push(booking);
  return booking;
};

beforeEach(() => {
  resetDb();
  seedSku({ id: 'SKU-TRF-HUB-ssh-private', serviceType: 'transfer', basePriceEGP: 4805 });
});

describe('driver replies', () => {
  it('turns "5 min" into a live ride update', () => {
    seedTransferBooking();
    whatsappInboundRouter('message.received', { from: driverPhone, body: '5 minutes away' });
    const telemetry = db.transferTelemetry.find(row => row.bookingId === 'DHB-HUB-TEST-1');
    expect(telemetry).toBeTruthy();
    expect(telemetry!.status).toBe('EN_ROUTE');
    expect((telemetry as never as { etaMinutes?: number }).etaMinutes).toBe(5);
    // The ride stops being "pending supplier confirmation" the moment the driver
    // says they are on the way.
    const booking = db.bookings.find(b => b.id === 'DHB-HUB-TEST-1')!;
    expect(booking.supplierState).toBe('CONFIRMED');
  });

  it('records a status phrase without inventing a number', () => {
    seedTransferBooking();
    whatsappInboundRouter('message.received', { from: driverPhone, body: 'وصلت' });
    const telemetry = db.transferTelemetry.find(row => row.bookingId === 'DHB-HUB-TEST-1')!;
    expect(telemetry.status).toBe('EN_ROUTE');
    expect((telemetry as never as { etaMinutes?: number }).etaMinutes).toBeUndefined();
    expect((telemetry as never as { etaNote?: string }).etaNote).toContain('وصلت');
  });
});

describe('party confirmations', () => {
  it('counts a "yes" from the party number as a booking intent', () => {
    db.dahabParties.push({
      id: 'party-x',
      whatsappNumber: partyNumber,
      bookingIntentCount: 0,
      licenseVerified: true
    } as never);
    whatsappInboundRouter('message.received', { from: partyNumber, body: 'ايوه' });
    const party = db.dahabParties.find(row => row.id === 'party-x')!;
    expect(party.bookingIntentCount).toBe(1);
  });

  it('does not count a "yes" from an unrelated number', () => {
    db.dahabParties.push({
      id: 'party-x',
      whatsappNumber: partyNumber,
      bookingIntentCount: 0,
      licenseVerified: true
    } as never);
    whatsappInboundRouter('message.received', { from: '+20 100 111 2222', body: 'yes' });
    expect(db.dahabParties.find(row => row.id === 'party-x')!.bookingIntentCount).toBe(0);
  });
});

describe('everything else', () => {
  it('appends an unknown message to the support queue', () => {
    db.supportMessages.push({
      id: 'SUP-MSG-TEST-1',
      userId: 'USR-1',
      travelerPhone: '+20 100 777 8888',
      travelerEmail: 'nour@example.com',
      message: 'first message',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as never);
    whatsappInboundRouter('message.received', { from: '+20 100 777 8888', body: 'عايز أأكد ميعاد الرحلة' });
    const thread = db.supportMessages.find(row => row.id === 'SUP-MSG-TEST-1')!;
    expect((thread as never as { replies?: unknown[] }).replies).toHaveLength(1);
    expect(thread.status).toBe('OPEN');
  });

  it('records a message from a stranger instead of dropping it', () => {
    const before = db.auditEvents.length;
    whatsappInboundRouter('message.received', { from: '+20 100 333 4444', body: 'hello there' });
    const found = db.auditEvents.slice(before).some(event => event.action === 'WHATSAPP_INBOUND_ROUTED_SUPPORT');
    expect(found).toBe(true);
  });
});

describe('non-message events', () => {
  it('ignores a session event it does not know', () => {
    expect(() => whatsappInboundRouter('something.else', {})).not.toThrow();
  });

  it('mirrors a session status onto our session rows', () => {
    db.whatsappSessions.push({
      id: 'WAS-1',
      openwaSessionId: 'pilot',
      label: 'Pilot',
      phone: '201000000001',
      purpose: 'traveler',
      isDefault: true,
      status: 'QR_READY',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as never);
    whatsappInboundRouter('session.status', { sessionId: 'pilot', status: 'CONNECTED' });
    expect(db.whatsappSessions.find(row => row.id === 'WAS-1')!.status).toBe('CONNECTED');
  });
});
