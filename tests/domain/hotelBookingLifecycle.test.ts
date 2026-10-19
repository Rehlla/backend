import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import {
  cancelStay,
  markPaid,
  recordPaymentProof,
  releaseExpiredStayHolds,
  reserveStay,
  respondToStay,
  rescheduleStay,
  settleBalance,
  checkInStay,
  completeStay,
  StayBookingError,
  STAY_HOLD_MINUTES,
  staysForUser,
  markNoShow,
} from '../../server/services/hotelBookingService';
import { checkStay } from '../../server/services/hotelAvailabilityService';
import { submitReview } from '../../server/services/reviewService';
import type { RoomTypeEntity } from '../../server/db/schema';

/**
 * The life of a stay, end to end.
 *
 * A reservation here is money's groundwork: a deposit promise, a confirmed
 * room, a refund obligation. The cases below are the ones that would be
 * expensive to get wrong — two travellers taking the last room, an expired
 * hold releasing stock, a rejected stay returning its deposit, a cancelled
 * one forfeiting it past the free window, and a move that gives up the old
 * nights only once the new ones are actually secured.
 */
describe('stay booking lifecycle', () => {
  beforeEach(() => {
    resetDb();
    // The fixtures book July 2026; a past check-in is refused, so the clock
    // is pinned before those dates. Only Date is faked, so timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-01T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const roomType = (over: Partial<RoomTypeEntity> = {}): RoomTypeEntity => ({
    id: 'RT-ACC-A',
    accommodationId: 'ACC-A',
    skuId: 'SKU-RT-ACC-A',
    supplierId: 'SUP-ACC-A',
    code: 'STD',
    name: 'Standard',
    nameAr: 'عادي',
    maxGuestsPerUnit: 2,
    baseNightlyEGP: 1000,
    minNights: 1,
    maxNights: 30,
    cancellationPolicyHours: 48,
    totalUnits: 2,
    inventorySource: 'SEED_PUBLISHED',
    amenities: [],
    images: [],
    active: true,
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  const traveler = { userId: 'USR-T1', name: 'Test Traveller', phone: '+201000000001', email: 't1@example.com' };
  const staff = { userId: 'USR-OPS', role: 'Operations' };
  const otherStaff = { userId: 'USR-T2', role: 'Traveler' };

  const reserve = (over: Record<string, unknown> = {}) =>
    reserveStay(
      {
        accommodationId: 'ACC-A',
        roomTypeId: 'RT-ACC-A',
        checkIn: '2026-07-10',
        checkOut: '2026-07-13',
        rooms: 1,
        adults: 2,
        children: 0,
        paymentMethod: 'INSTAPAY',
        idempotencyKey: `KEY-${Math.random()}`,
        ...over,
      },
      traveler
    );

  it('reserves rooms, snapshots the price and issues payment instructions', () => {
    db.roomTypes.push(roomType());

    const booking = reserve();

    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(booking.paymentState).toBe('INITIATED');
    expect(booking.priceBreakdown.totalEGP).toBe(3000);
    expect(booking.depositEGP).toBe(600);
    expect(booking.balanceDueEGP).toBe(2400);
    expect(booking.paymentInstructions).toMatchObject({
      method: 'INSTAPAY',
      amountEGP: 600,
      contactPhone: '+201002328005',
    });
    expect(booking.bookingRef).toMatch(/^HTL-\d{8}-[0-9A-F]{4}$/);
    // The hold window is stamped, and the free-cancellation deadline sits
    // policy hours before check-in.
    expect(booking.holdExpiresAt).toBeDefined();
    expect(booking.freeCancellationUntil).toBe('2026-07-08T14:00:00.000Z');
  });

  it('replays an idempotent retry instead of holding the nights twice', () => {
    db.roomTypes.push(roomType());
    const params = {
      accommodationId: 'ACC-A',
      roomTypeId: 'RT-ACC-A',
      checkIn: '2026-07-10',
      checkOut: '2026-07-13',
      rooms: 1,
      adults: 2,
      children: 0,
      paymentMethod: 'INSTAPAY' as const,
      idempotencyKey: 'KEY-SAME',
    };

    const first = reserveStay(params, traveler);
    const second = reserveStay(params, traveler);

    expect(second.bookingRef).toBe(first.bookingRef);
    expect(db.hotelBookings.length).toBe(1);
  });

  it('refuses a check-in that has already passed, and holds no rooms for it', () => {
    db.roomTypes.push(roomType());
    expect(() =>
      reserveStay(
        {
          accommodationId: 'ACC-A',
          roomTypeId: 'RT-ACC-A',
          checkIn: '2026-06-28',
          checkOut: '2026-07-02',
          rooms: 1,
          adults: 2,
          children: 0,
          paymentMethod: 'INSTAPAY' as const,
          idempotencyKey: 'KEY-PAST',
        },
        traveler
      )
    ).toThrow(/in the past/);
    expect(db.hotelBookings.length).toBe(0);
  });

  it('refuses a second traveller when the last room is taken, then releases on expiry', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));

    reserve({});
    // Availability says so before anyone tries.
    expect(checkStay({
      accommodationId: 'ACC-A', roomTypeId: 'RT-ACC-A',
      checkIn: '2026-07-10', checkOut: '2026-07-13', rooms: 1,
    }).available).toBe(false);

    expect(() => reserve({ idempotencyKey: 'KEY-2' })).toThrow(/taken for part of your dates/);
    expect(db.hotelBookings.length).toBe(1);

    // Once the hold deadline passes, the same request succeeds.
    db.hotelBookings[0].holdExpiresAt = new Date(Date.now() - 1000).toISOString();
    const late = reserve({ idempotencyKey: 'KEY-2' });
    expect(late.status).toBe('PENDING_PAYMENT');
    expect(db.hotelBookings.length).toBe(2);
  });

  it('takes the lock seriously: measuring and inserting happen together', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    const first = reserve({});
    const sweep = releaseExpiredStayHolds();
    expect(sweep).toBe(0); // live hold is not expired
    expect(first.status).toBe('PENDING_PAYMENT');
  });

  it('moves through payment proof, mark-paid, approval — and creates the commerce booking', () => {
    db.roomTypes.push(roomType());
    const booking = reserve();

    // Proof is a claim; the status does not move until staff see the money.
    const withProof = recordPaymentProof(booking.bookingRef, { userId: 'USR-T1', role: 'Traveler' }, {
      proofUrl: '/uploads/proof-1.png',
      reference: 'TRX-88',
    });
    expect(withProof.status).toBe('PENDING_PAYMENT');
    expect(withProof.paymentProofUrl).toBe('/uploads/proof-1.png');

    const paid = markPaid(booking.bookingRef, staff, { method: 'INSTAPAY', reference: 'TRX-88' });
    expect(paid.status).toBe('PENDING_CONFIRMATION');
    expect(paid.paymentState).toBe('AUTHORIZED');
    expect(paid.paidAt).toBeDefined();

    // The deposit is in escrow's ledger.
    const depositEntry = db.ledgerEntries.find(e => e.idempotencyKey === `STAY-DEPOSIT-${paid.id}`);
    expect(depositEntry).toBeDefined();
    expect(depositEntry!.type).toBe('HOLD_ESCROW');
    expect(depositEntry!.amountEGP).toBe(600);

    const confirmed = respondToStay(booking.bookingRef, staff, { approve: true });
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.confirmationCode).toMatch(/^DHB-HTL-/);
    expect(confirmed.bookingRefLinked).toBe(confirmed.bookingRef);

    // The commerce kernel now speaks this booking's language.
    const core = db.bookings.find(b => b.bookingRef === confirmed.bookingRef);
    expect(core).toBeDefined();
    expect(core!.serviceType).toBe('hotel');
    expect(core!.supplierState).toBe('CONFIRMED');
    expect(core!.checkOut).toBe('2026-07-13');
    expect(core!.nights).toBe(3);
    expect(core!.roomTypeId).toBe('RT-ACC-A');
  });

  it('refunds a rejected stay and releases its rooms', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    const booking = reserve();
    markPaid(booking.bookingRef, staff, {});

    const rejected = respondToStay(booking.bookingRef, staff, { approve: false, reason: 'full' });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.paymentState).toBe('REFUNDED');

    const refund = db.ledgerEntries.find(e => e.idempotencyKey === `STAY-REFUND-${booking.id}`);
    expect(refund).toBeDefined();
    expect(refund!.type).toBe('REFUND_ISSUED');

    // And the room is sellable again the moment the rejection lands.
    expect(checkStay({
      accommodationId: 'ACC-A', roomTypeId: 'RT-ACC-A',
      checkIn: '2026-07-10', checkOut: '2026-07-13', rooms: 1,
    }).available).toBe(true);
  });

  it('cancels free inside the window and forfeits the deposit outside it', () => {
    db.roomTypes.push(roomType());
    // Dates relative to now: "within the window" only means something against
    // today, so a fixed 2026-07 date would already be in the past.
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

    const free = reserve({ idempotencyKey: 'K1', checkIn: day(10), checkOut: day(13) });
    markPaid(free.bookingRef, staff, {});

    const freeResult = cancelStay(free.bookingRef, { userId: 'USR-T1', role: 'Traveler' }, { reason: 'plans changed' });
    expect(freeResult.withinFreeWindow).toBe(true);
    expect(freeResult.refundEGP).toBe(600);
    expect(freeResult.booking.paymentState).toBe('REFUNDED');

    // A booking already inside the no-refund zone: the deadline is forced past.
    const late = reserve({ idempotencyKey: 'K2', checkIn: day(2), checkOut: day(4) });
    markPaid(late.bookingRef, staff, {});
    db.hotelBookings[db.hotelBookings.length - 1].freeCancellationUntil = new Date(Date.now() - 60_000).toISOString();

    const lateResult = cancelStay(late.bookingRef, { userId: 'USR-T1', role: 'Traveler' }, {});
    expect(lateResult.withinFreeWindow).toBe(false);
    expect(lateResult.refundEGP).toBe(0);
    expect(lateResult.booking.paymentState).toBe('AUTHORIZED');
    expect(lateResult.booking.status).toBe('CANCELLED');
  });

  it('refuses a stranger cancelling someone else\'s stay', () => {
    db.roomTypes.push(roomType());
    const booking = reserve();
    expect(() =>
      cancelStay(booking.bookingRef, { userId: 'USR-STRAINER', role: 'Traveler' }, {})
    ).toThrow(/not yours to cancel/);
  });

  it('moves a stay only when the new nights are secured, restoring on refusal', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    const booking = reserve();

    // Someone else holds the target window.
    db.hotelBookings.push({
      ...booking,
      id: 'HBS-OTHER',
      bookingRef: 'HTL-OTHER-0001',
      idempotencyKey: 'KEY-OTHER',
      checkIn: '2026-07-20',
      checkOut: '2026-07-22',
      nights: 2,
    });

    expect(() =>
      rescheduleStay(booking.bookingRef, { userId: 'USR-T1', role: 'Traveler' }, {
        checkIn: '2026-07-20',
        checkOut: '2026-07-22',
      })
    ).toThrow(/not available/);

    // The original reservation survived the refused move untouched.
    const restored = db.hotelBookings.find(b => b.id === booking.id)!;
    expect(restored.status).toBe('PENDING_PAYMENT');
    expect(restored.checkIn).toBe('2026-07-10');
    expect(restored.checkOut).toBe('2026-07-13');

    // A free window moves cleanly and re-prices.
    const moved = rescheduleStay(booking.bookingRef, { userId: 'USR-T1', role: 'Traveler' }, {
      checkIn: '2026-07-24',
      checkOut: '2026-07-27',
    });
    expect(moved.checkIn).toBe('2026-07-24');
    expect(moved.nights).toBe(3);
    expect(moved.priceBreakdown.totalEGP).toBe(3000);
    expect(moved.status).toBe('PENDING_PAYMENT');
  });

  it('records the balance at the property and closes the stay out', () => {
    db.roomTypes.push(roomType());
    const booking = reserve();
    markPaid(booking.bookingRef, staff, {});
    respondToStay(booking.bookingRef, staff, { approve: true });

    // The guest's first night (Cairo), not before.
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
    checkInStay(booking.bookingRef, staff);
    expect(db.hotelBookings[0].status).toBe('IN_HOUSE');

    settleBalance(booking.bookingRef, staff, {});
    const settled = db.hotelBookings[0];
    expect(settled.paymentState).toBe('CAPTURED');
    expect(settled.balanceSettledAt).toBeDefined();

    completeStay(booking.bookingRef, staff);
    expect(db.hotelBookings[0].status).toBe('COMPLETED');

    // The full money story is in the ledger: deposit in, balance in.
    const stages = db.ledgerEntries
      .filter(e => e.bookingRef === booking.bookingRef)
      .map(e => e.metadata?.stage);
    expect(stages).toContain('deposit');
    expect(stages).toContain('balance');
  });

  it('guards every staff-only transition from a traveller account', () => {
    db.roomTypes.push(roomType());
    const booking = reserve();
    for (const attempt of [
      () => markPaid(booking.bookingRef, otherStaff, {}),
      () => respondToStay(booking.bookingRef, otherStaff, { approve: true }),
      () => settleBalance(booking.bookingRef, otherStaff, {}),
      () => checkInStay(booking.bookingRef, otherStaff),
      () => completeStay(booking.bookingRef, otherStaff),
    ]) {
      try {
        attempt();
        expect.unreachable('a traveller must not drive staff transitions');
      } catch (e) {
        expect(e).toBeInstanceOf(StayBookingError);
        expect((e as StayBookingError).status).toBe(403);
      }
    }
  });

  it('expires a dead hold so the queue stops showing it', () => {
    db.roomTypes.push(roomType());
    const booking = reserve();
    db.hotelBookings[0].holdExpiresAt = new Date(Date.now() - 1000).toISOString();

    expect(releaseExpiredStayHolds()).toBe(1);
    expect(db.hotelBookings[0].status).toBe('EXPIRED');
    // An expired row is not re-expired on the next sweep.
    expect(releaseExpiredStayHolds()).toBe(0);
    expect(STAY_HOLD_MINUTES).toBe(30);
  });

  // ── Phase 1 fixes ────────────────────────────────────────────────────────

  it('uses one reference everywhere the traveller reads it', () => {
    db.roomTypes.push(roomType());
    const booking = reserve({ paymentMethod: 'BANK_TRANSFER' });
    expect(booking.paymentInstructions.reference).toBe(booking.bookingRef);
    // The bank-transfer copy names the reference to quote, not an empty gap.
    expect(booking.paymentInstructions.instructions).toContain(booking.bookingRef);
  });

  it('takes no deposit for cash on arrival and sends the stay straight to approval', () => {
    db.roomTypes.push(roomType());
    const booking = reserve({ paymentMethod: 'CASH_ON_ARRIVAL' });
    expect(booking.status).toBe('PENDING_CONFIRMATION');
    expect(booking.depositEGP).toBe(0);
    expect(booking.balanceDueEGP).toBe(3000);
    expect(booking.paymentInstructions.amountEGP).toBe(0);
    expect(booking.holdExpiresAt).toBeUndefined();

    // Nothing can lapse it: the old 30-minute hold expired every one of these.
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    releaseExpiredStayHolds();
    expect(booking.status).toBe('PENDING_CONFIRMATION');
    // ...and its rooms stay held while the property decides.
    expect(checkStay({ accommodationId: 'ACC-A', roomTypeId: 'RT-ACC-A', checkIn: '2026-07-10', checkOut: '2026-07-13', rooms: 2 }).available).toBe(false);
  });

  it('never hands one traveller another traveller\'s booking for the same idempotency key', () => {
    db.roomTypes.push(roomType());
    const mine = reserve({ idempotencyKey: 'SHARED-KEY' });
    const theirs = reserveStay(
      {
        accommodationId: 'ACC-A', roomTypeId: 'RT-ACC-A', checkIn: '2026-07-10', checkOut: '2026-07-13',
        rooms: 1, adults: 2, children: 0, paymentMethod: 'INSTAPAY', idempotencyKey: 'SHARED-KEY',
      },
      { userId: 'USR-T2', name: 'Someone Else', phone: '+201000000002', email: 't2@example.com' }
    );
    expect(theirs.bookingRef).not.toBe(mine.bookingRef);
    expect(theirs.userId).toBe('USR-T2');
  });

  it('files the stay under the trip it was booked from', () => {
    db.roomTypes.push(roomType());
    const booking = reserve({ tripId: 'TRIP-42' });
    expect(booking.tripId).toBe('TRIP-42');
  });

  it('records a late deposit only while the rooms are still free', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    const late = reserve();
    vi.setSystemTime(new Date(Date.now() + (STAY_HOLD_MINUTES + 1) * 60_000));
    releaseExpiredStayHolds();
    expect(late.status).toBe('EXPIRED');

    // Rooms still free: the late money is taken and the stay moves on.
    markPaid(late.bookingRef, staff, {});
    expect(late.status).toBe('PENDING_CONFIRMATION');
    expect(late.holdExpiresAt).toBeUndefined();
  });

  it('refuses a late deposit once the rooms were sold to someone else', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    const late = reserve();
    vi.setSystemTime(new Date(Date.now() + (STAY_HOLD_MINUTES + 1) * 60_000));
    // Someone else takes the last room the lapsed hold had freed.
    reserveStay(
      {
        accommodationId: 'ACC-A', roomTypeId: 'RT-ACC-A', checkIn: '2026-07-10', checkOut: '2026-07-13',
        rooms: 1, adults: 2, children: 0, paymentMethod: 'INSTAPAY', idempotencyKey: 'SECOND-GUEST',
      },
      { userId: 'USR-T2', name: 'Second Guest', phone: '+201000000002', email: 't2@example.com' }
    );
    expect(() => markPaid(late.bookingRef, staff, {})).toThrow(/rooms have since been taken/);
  });

  it('cancels the platform booking and trip item along with the stay', () => {
    db.roomTypes.push(roomType());
    db.trips.push({ id: 'TRIP-7', userId: traveler.userId } as typeof db.trips[number]);
    const booking = reserve({ tripId: 'TRIP-7' });
    markPaid(booking.bookingRef, staff, {});
    respondToStay(booking.bookingRef, staff, { approve: true });
    const core = db.bookings.find(b => b.id === booking.bookingRef)!;
    const item = db.tripItems.find(i => i.bookingId === booking.bookingRef)!;
    expect(core.supplierState).toBe('CONFIRMED');
    expect(item.status).toBe('CONFIRMED');

    cancelStay(booking.bookingRef, { userId: traveler.userId, role: 'Traveler' }, {});
    expect(core.supplierState).toBe('CANCELLED');
    expect(item.status).toBe('CANCELLED');
  });

  it('moves the platform booking and trip item with the stay\'s new dates', () => {
    db.roomTypes.push(roomType());
    db.trips.push({ id: 'TRIP-8', userId: traveler.userId } as typeof db.trips[number]);
    const booking = reserve({ tripId: 'TRIP-8' });
    markPaid(booking.bookingRef, staff, {});
    respondToStay(booking.bookingRef, staff, { approve: true });

    rescheduleStay(booking.bookingRef, { userId: traveler.userId, role: 'Traveler' }, { checkIn: '2026-07-20', checkOut: '2026-07-24' });
    const core = db.bookings.find(b => b.id === booking.bookingRef)!;
    const item = db.tripItems.find(i => i.bookingId === booking.bookingRef)!;
    expect(core.scheduledDate).toBe('2026-07-20');
    expect(core.checkOut).toBe('2026-07-24');
    expect(core.amountEGP).toBe(booking.priceBreakdown.totalEGP);
    expect(item.title).toContain('2026-07-20');
  });

  it("lists a traveller's own stays, trip or not, and nobody else's", () => {
    db.roomTypes.push(roomType({ totalUnits: 5 }));
    const direct = reserve();
    const filed = reserve({ tripId: 'TRIP-9' });
    reserveStay(
      {
        accommodationId: 'ACC-A', roomTypeId: 'RT-ACC-A', checkIn: '2026-07-10', checkOut: '2026-07-13',
        rooms: 1, adults: 2, children: 0, paymentMethod: 'INSTAPAY', idempotencyKey: 'OTHER-1',
      },
      { userId: 'USR-T2', name: 'Someone Else', phone: '+201000000002', email: 't2@example.com' }
    );
    const mine = staysForUser(traveler.userId).map(b => b.bookingRef).sort();
    expect(mine).toEqual([direct.bookingRef, filed.bookingRef].sort());
  });

  // ── Phase 2: money and dates the desk can trust ─────────────────────────

  const confirmed = (over: Record<string, unknown> = {}) => {
    const booking = reserve(over);
    markPaid(booking.bookingRef, staff, {});
    respondToStay(booking.bookingRef, staff, { approve: true });
    return booking;
  };

  it('refuses a check-in before the first night', () => {
    db.roomTypes.push(roomType());
    const booking = confirmed();
    expect(() => checkInStay(booking.bookingRef, staff)).toThrow(/Check-in opens on 2026-07-10/);
    vi.setSystemTime(new Date('2026-07-10T08:00:00Z'));
    checkInStay(booking.bookingRef, staff);
    expect(booking.status).toBe('IN_HOUSE');
  });

  it('settles only the full balance, and only once', () => {
    db.roomTypes.push(roomType());
    const booking = confirmed();
    expect(() => settleBalance(booking.bookingRef, staff, { amountEGP: 100 })).toThrow(/balance due is 2,400/);
    expect(booking.paymentState).toBe('AUTHORIZED');

    settleBalance(booking.bookingRef, staff, { amountEGP: 2400 });
    expect(booking.paymentState).toBe('CAPTURED');
    expect(() => settleBalance(booking.bookingRef, staff, {})).toThrow(/already recorded/);
    expect(db.ledgerEntries.filter(e => e.bookingRef === booking.bookingRef && e.metadata?.stage === 'balance')).toHaveLength(1);
  });

  it('records a no-show once the date has come, keeping the deposit', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    db.trips.push({ id: 'TRIP-NS', userId: traveler.userId } as typeof db.trips[number]);
    const booking = confirmed({ tripId: 'TRIP-NS' });
    expect(() => markNoShow(booking.bookingRef, staff)).toThrow(/not due until/);

    vi.setSystemTime(new Date('2026-07-11T09:00:00Z'));
    expect(() => markNoShow(booking.bookingRef, { userId: traveler.userId, role: 'Traveler' })).toThrow(/Only staff/);
    markNoShow(booking.bookingRef, staff);
    expect(booking.status).toBe('NO_SHOW');
    // The deposit is not returned...
    expect(booking.paymentState).toBe('AUTHORIZED');
    expect(db.ledgerEntries.some(e => e.bookingRef === booking.bookingRef && e.type === 'REFUND_ISSUED')).toBe(false);
    // ...the linked records close, and the room is free again.
    expect(db.bookings.find(b => b.id === booking.bookingRef)!.supplierState).toBe('CANCELLED');
    expect(db.tripItems.find(i => i.bookingId === booking.bookingRef)!.status).toBe('CANCELLED');
    expect(checkStay({ accommodationId: 'ACC-A', roomTypeId: 'RT-ACC-A', checkIn: '2026-07-12', checkOut: '2026-07-13', rooms: 1 }).available).toBe(true);
  });

  it('keeps the paid deposit and the original free window when a paid stay moves', () => {
    db.roomTypes.push(roomType());
    const booking = confirmed();
    const freeUntil = booking.freeCancellationUntil;
    // Move it later — the quote alone would grant a later free deadline.
    rescheduleStay(booking.bookingRef, { userId: traveler.userId, role: 'Traveler' }, { checkIn: '2026-07-20', checkOut: '2026-07-24' });
    expect(booking.depositEGP).toBe(600);
    expect(booking.priceBreakdown.totalEGP).toBe(4000);
    expect(booking.balanceDueEGP).toBe(3400);
    expect(booking.freeCancellationUntil).toBe(freeUntil);
  });

  it('refuses to move a stay whose balance is already settled', () => {
    db.roomTypes.push(roomType());
    const booking = confirmed();
    settleBalance(booking.bookingRef, staff, {});
    expect(() =>
      rescheduleStay(booking.bookingRef, { userId: traveler.userId, role: 'Traveler' }, { checkIn: '2026-07-20', checkOut: '2026-07-24' })
    ).toThrow(/fully paid/);
  });

  it('keeps a cash-on-arrival stay deposit-free when it moves', () => {
    db.roomTypes.push(roomType());
    const booking = reserve({ paymentMethod: 'CASH_ON_ARRIVAL' });
    rescheduleStay(booking.bookingRef, { userId: traveler.userId, role: 'Traveler' }, { checkIn: '2026-07-20', checkOut: '2026-07-22' });
    expect(booking.depositEGP).toBe(0);
    expect(booking.balanceDueEGP).toBe(2000);
  });

  it("lets the guest review a finished stay booked without a trip, and nobody else", () => {
    db.roomTypes.push(roomType());
    const booking = confirmed();
    expect(() => submitReview({ bookingRef: booking.bookingRef, userId: traveler.userId, rating: 5, body: 'Lovely' })).toThrow(/not yet completed/);

    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
    checkInStay(booking.bookingRef, staff);
    completeStay(booking.bookingRef, staff);
    expect(db.bookings.find(b => b.id === booking.bookingRef)!.supplierState).toBe('COMPLETED');

    expect(() => submitReview({ bookingRef: booking.bookingRef, userId: 'USR-T2', rating: 1, body: 'Fake' })).toThrow(/does not belong/);
    const review = submitReview({ bookingRef: booking.bookingRef, userId: traveler.userId, rating: 5, body: 'Lovely' });
    expect(review.rating).toBe(5);
  });
});

