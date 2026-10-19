import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';
import type { HotelBookingEntity } from '../db/schema';
import { optionalString, requiredCalendarDate, InvalidRequestBodyError } from '../middleware/bodyParams';
import { respondToStay } from '../services/hotelBookingService';
import { buildRateCalendar, setNightsClosed } from '../services/hotelRateCalendarService';

/**
 * The property's own view of its stays — the hotel owner answering their
 * guests without going through the desk.
 *
 * Identity is the session's supplier link, never a query or body field: a
 * Supplier account sees and acts only on stays booked with its own supplierId.
 * Staff may look at any property by passing ?supplierId=. What an owner sees
 * is what running the property needs (names, phone, dates, party, arrival
 * time, requests, money due at the desk) — not the guest's email or payment
 * receipt, which stay with the platform.
 *
 * An owner may confirm or decline a waiting stay and close or reopen nights on
 * their own calendar. Prices stay with the desk (they carry the platform's
 * commission terms).
 */
export const propertyStayRouter = Router();

const STAFF = new Set(['Operations', 'Admin']);

function propertyScope(req: AuthenticatedRequest): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'Supplier') return user.supplierId || null;
  if (STAFF.has(user.role)) return typeof req.query.supplierId === 'string' ? req.query.supplierId : null;
  return null;
}

function forOwner(b: HotelBookingEntity) {
  return {
    bookingRef: b.bookingRef,
    status: b.status,
    roomTypeId: b.roomTypeId,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    rooms: b.rooms,
    adults: b.adults,
    children: b.children,
    travelerName: b.travelerName,
    travelerPhone: b.travelerPhone,
    guestDetails: b.guestDetails,
    arrivalTime: b.arrivalTime,
    specialRequests: b.specialRequests,
    paymentMethod: b.paymentInstructions.method,
    depositEGP: b.depositEGP,
    balanceDueEGP: b.balanceDueEGP,
    totalEGP: b.priceBreakdown.totalEGP,
    balanceSettled: Boolean(b.balanceSettledAt),
    confirmationCode: b.confirmationCode,
  };
}

function ownRoomType(req: AuthenticatedRequest, res: Response) {
  const supplierId = propertyScope(req);
  if (!supplierId) {
    res.status(403).json({ error: 'This account is not linked to a property.' });
    return null;
  }
  const roomType = db.roomTypes.find(rt => rt.id === req.params.id);
  // Same answer for "not yours" and "does not exist": no probing other ids.
  if (!roomType || roomType.supplierId !== supplierId) {
    res.status(404).json({ error: 'Room type not found.' });
    return null;
  }
  return roomType;
}

function fail(res: Response, err: any) {
  const status = err?.status ?? (err instanceof InvalidRequestBodyError ? 400 : 400);
  res.status(status).json({ error: status >= 500 ? 'The request failed.' : err?.message || 'Invalid request.', code: err?.code });
}

/** The property's stays, soonest arrival first; waiting ones on top. */
propertyStayRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const supplierId = propertyScope(req);
  if (!supplierId) return res.status(403).json({ error: 'This account is not linked to a property.' });
  const rank = (s: string) => (s === 'PENDING_CONFIRMATION' ? 0 : s === 'CONFIRMED' || s === 'IN_HOUSE' ? 1 : 2);
  const stays = db.hotelBookings
    .filter(b => b.supplierId === supplierId && b.status !== 'PENDING_PAYMENT' && b.status !== 'EXPIRED')
    .sort((a, b) => rank(a.status) - rank(b.status) || a.checkIn.localeCompare(b.checkIn))
    .map(forOwner);
  res.json({ stays });
});

/** Confirm or decline a waiting stay booked with this property. */
propertyStayRouter.post('/:ref/respond', (req: AuthenticatedRequest, res: Response) => {
  try {
    const supplierId = propertyScope(req);
    if (!supplierId) return res.status(403).json({ error: 'This account is not linked to a property.' });
    const booking = db.hotelBookings.find(b => b.bookingRef === req.params.ref);
    if (!booking || booking.supplierId !== supplierId) return res.status(404).json({ error: 'Stay not found.' });
    if (typeof req.body?.approve !== 'boolean') {
      return res.status(400).json({ error: '"approve" must be true or false.' });
    }
    const updated = respondToStay(
      booking.bookingRef,
      { userId: req.user!.userId, role: req.user!.role, supplierId: req.user!.role === 'Supplier' ? supplierId : undefined },
      { approve: req.body.approve, reason: optionalString(req.body.reason, 'reason', 500) }
    );
    res.json({ stay: forOwner(updated) });
  } catch (err) {
    fail(res, err);
  }
});

/** The property's room types. */
propertyStayRouter.get('/room-types', (req: AuthenticatedRequest, res: Response) => {
  const supplierId = propertyScope(req);
  if (!supplierId) return res.status(403).json({ error: 'This account is not linked to a property.' });
  const roomTypes = db.roomTypes
    .filter(rt => rt.supplierId === supplierId)
    .map(rt => ({ id: rt.id, name: rt.name, nameAr: rt.nameAr, totalUnits: rt.totalUnits, baseNightlyEGP: rt.baseNightlyEGP, active: rt.active }));
  res.json({ roomTypes });
});

/** One of the property's own room types, night by night. */
propertyStayRouter.get('/room-types/:id/calendar', (req: AuthenticatedRequest, res: Response) => {
  try {
    const roomType = ownRoomType(req, res);
    if (!roomType) return;
    res.json(buildRateCalendar(roomType, requiredCalendarDate(req.query.from, 'from'), requiredCalendarDate(req.query.to, 'to')));
  } catch (err) {
    fail(res, err);
  }
});

/** Close (or reopen) a run of nights [from, to) on the property's own calendar. */
propertyStayRouter.post('/room-types/:id/availability', (req: AuthenticatedRequest, res: Response) => {
  try {
    const roomType = ownRoomType(req, res);
    if (!roomType) return;
    if (typeof req.body?.closed !== 'boolean') {
      return res.status(400).json({ error: '"closed" must be true or false.' });
    }
    const changed = setNightsClosed(
      roomType,
      requiredCalendarDate(req.body.from, 'from'),
      requiredCalendarDate(req.body.to, 'to'),
      req.body.closed,
      optionalString(req.body.reason, 'reason', 200),
      req.user!.userId
    );
    res.json({ changed });
  } catch (err) {
    fail(res, err);
  }
});
