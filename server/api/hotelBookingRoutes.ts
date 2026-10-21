import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import {
  optionalString,
  optionalCount,
  pickAllowedKeys,
  rejectRawCardData,
  requiredString,
  requiredEnum,
  requiredCalendarDate,
  requiredCount,
  requiredArray,
  requiredObject,
  STAY_RESERVE_KEYS,
} from '../middleware/bodyParams';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { dataPath } from '../db/paths';
import { MediaUploadError, validateImageUpload } from '../services/mediaUpload';
import type { HotelGuestDetail } from '../db/schema';
import {
  cancelStay,
  getStayByRef,
  recordPaymentProof,
  claimWalletPayment,
  rescheduleStay,
  reserveStay,
  staysForTrip,
  staysForUser,
  STAY_PAYMENT_METHODS,
} from '../services/hotelBookingService';

export const hotelBookingRouter = Router();

/**
 * Traveller-side stays: reserve, pay proof, cancel, move, read.
 *
 * Identity is the session, never the body — the traveller name, phone and email
 * on a reservation come from the signed-in account, so a forged payload cannot
 * file a stay against somebody else. Only what a traveller may choose (dates,
 * rooms, payment method, notes) is read from the request.
 */

const isStaff = (role?: string) => role === 'Operations' || role === 'Admin';

/** Who is asking: the session user, or nobody. The phone is not on the session,
 *  so it comes from the account row. */
function actor(req: AuthenticatedRequest): { userId: string; role: string; name: string; phone: string; email: string } | null {
  const user = req.user;
  if (!user) return null;
  const account = db.users.find(u => u.id === user.userId);
  return {
    userId: user.userId,
    role: user.role,
    name: user.name,
    phone: account?.phone ?? '',
    email: user.email,
  };
}

/**
 * Reserve rooms and open a reservation awaiting its deposit.
 *
 * Public-facing enough that an unauthenticated caller gets 401 rather than a
 * half-formed error from deeper in.
 */
hotelBookingRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const who = actor(req);
    if (!who) return res.status(401).json({ error: 'Sign in to reserve a stay.' });

    rejectRawCardData(req.body);
    const body = pickAllowedKeys(req.body, STAY_RESERVE_KEYS, 'body');

    const guestDetails = body.guestDetails === undefined
      ? []
      : requiredArray(body.guestDetails, 'guestDetails', 20).map((raw, i) => {
          const g = requiredObject(raw, `guestDetails.${i}`);
          return {
            fullName: requiredString(g.fullName, `guestDetails.${i}.fullName`, 120),
            isChild: g.isChild === true,
            age: g.age === undefined ? undefined : requiredCount(g.age, `guestDetails.${i}.age`, 0, 17),
          } satisfies HotelGuestDetail;
        });

    // A trip id from the body is only honoured for the caller's own trip:
    // filing a stay under someone else's trip would leak it into their view.
    let tripId: string | undefined;
    if (body.tripId !== undefined) {
      tripId = requiredString(body.tripId, 'tripId', 128);
      const trip = db.trips.find(t => t.id === tripId);
      if (!trip) return res.status(404).json({ error: 'Trip not found.' });
      if (trip.userId !== who.userId) return res.status(403).json({ error: 'This trip is not yours.' });
    }

    const booking = reserveStay(
      {
        accommodationId: requiredString(body.accommodationId, 'accommodationId', 128),
        roomTypeId: requiredString(body.roomTypeId, 'roomTypeId', 128),
        checkIn: requiredCalendarDate(body.checkIn, 'checkIn'),
        checkOut: requiredCalendarDate(body.checkOut, 'checkOut'),
        rooms: requiredCount(body.rooms, 'rooms', 1, 20),
        adults: requiredCount(body.adults, 'adults', 1, 30),
        children: optionalCount(body.children, 'children', 0, 20) ?? 0,
        guestDetails,
        specialRequests: optionalString(body.specialRequests, 'specialRequests', 1000),
        arrivalTime: optionalString(body.arrivalTime, 'arrivalTime', 32),
        paymentMethod: requiredEnum(body.paymentMethod, STAY_PAYMENT_METHODS, 'paymentMethod'),
        idempotencyKey: requiredString(body.idempotencyKey, 'idempotencyKey', 128),
        tripId,
      },
      who
    );

    res.status(201).json({ booking });
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({
      error: status >= 500 ? 'Could not reserve this stay.' : err?.message || 'Invalid reservation.',
      code: err?.code,
    });
  }
});

/** The caller's own stays, newest first — including ones booked straight
 *  from a hotel page with no trip, which the trip-scoped list cannot see. */
hotelBookingRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const who = actor(req);
  if (!who) return res.status(401).json({ error: 'Sign in to view your stays.' });
  res.json({ stays: staysForUser(who.userId) });
});

/** A reservation by reference — the traveller's own, or any for staff. */
hotelBookingRouter.get('/:ref', (req: AuthenticatedRequest, res: Response) => {
  const who = actor(req);
  if (!who) return res.status(401).json({ error: 'Sign in to view a reservation.' });

  const booking = getStayByRef(req.params.ref);
  if (!isStaff(who.role) && booking.userId !== who.userId) {
    return res.status(403).json({ error: 'This reservation is not yours to view.' });
  }
  res.json({ booking });
});

/** The traveller shows how they paid. Staff still verify before confirming. */
hotelBookingRouter.post('/:ref/payment-proof', (req: AuthenticatedRequest, res: Response) => {
  try {
    const who = actor(req);
    if (!who) return res.status(401).json({ error: 'Sign in to attach a payment proof.' });

    rejectRawCardData(req.body);
    const body = pickAllowedKeys(req.body, ['proofUrl', 'method', 'reference'], 'body');

    // A link the staff will open: https only, never javascript:, data: or a
    // plain-http page that could be swapped in transit.
    const proofUrl = requiredString(body.proofUrl, 'proofUrl', 500);
    if (!/^https:\/\/[^\s]+$/i.test(proofUrl)) {
      return res.status(400).json({ error: 'The receipt link must start with https://.' });
    }
    const booking = recordPaymentProof(req.params.ref, who, {
      proofUrl,
      method: body.method === undefined ? undefined : requiredEnum(body.method, STAY_PAYMENT_METHODS, 'method'),
      reference: optionalString(body.reference, 'reference', 128),
    });
    res.json({ booking });
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ error: status >= 500 ? 'Could not record the proof.' : err?.message || 'Invalid proof.', code: err?.code });
  }
});

/** "I've sent it": the wallet number (and/or transaction id) the deposit came from. */
hotelBookingRouter.post('/:ref/payment-claim', (req: AuthenticatedRequest, res: Response) => {
  try {
    const who = actor(req);
    if (!who) return res.status(401).json({ error: 'Sign in to report a payment.' });

    rejectRawCardData(req.body);
    const body = pickAllowedKeys(req.body ?? {}, ['payerNumber', 'payerReference'], 'body');
    const booking = claimWalletPayment(req.params.ref, who, {
      payerNumber: optionalString(body.payerNumber, 'payerNumber', 20),
      payerReference: optionalString(body.payerReference, 'payerReference', 64),
    });
    res.json({ booking });
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ error: status >= 500 ? 'Could not record the payment.' : err?.message || 'Invalid request.', code: err?.code });
  }
});

hotelBookingRouter.post('/:ref/cancel', (req: AuthenticatedRequest, res: Response) => {
  try {
    const who = actor(req);
    if (!who) return res.status(401).json({ error: 'Sign in to cancel a reservation.' });

    // `reason` is optional, so an empty body is a valid "cancel it".
    const raw = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const body = raw.reason === undefined ? {} : pickAllowedKeys(raw, ['reason'], 'body');
    const result = cancelStay(req.params.ref, who, {
      reason: optionalString(body.reason, 'reason', 500),
    });
    res.json(result);
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ error: status >= 500 ? 'Could not cancel.' : err?.message || 'Invalid cancellation.', code: err?.code });
  }
});

hotelBookingRouter.post('/:ref/reschedule', (req: AuthenticatedRequest, res: Response) => {
  try {
    const who = actor(req);
    if (!who) return res.status(401).json({ error: 'Sign in to move a reservation.' });

    const body = pickAllowedKeys(req.body, ['checkIn', 'checkOut'], 'body');
    const booking = rescheduleStay(req.params.ref, who, {
      checkIn: requiredCalendarDate(body.checkIn, 'checkIn'),
      checkOut: requiredCalendarDate(body.checkOut, 'checkOut'),
    });
    res.json({ booking });
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ error: status >= 500 ? 'Could not move the stay.' : err?.message || 'Invalid dates.', code: err?.code });
  }
});

/**
 * Payment receipts are private: they carry names, account numbers and
 * amounts. They live in the state dir (never under a public media path) and
 * are read back only through the GET below, by the owner or staff.
 */
const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;
const receiptDir = () => dataPath('payment-receipts');
const receiptFileFor = (bookingId: string): string | null => {
  try {
    const name = fs.readdirSync(receiptDir()).find(f => f.startsWith(`${bookingId}.`));
    return name ? path.join(receiptDir(), name) : null;
  } catch {
    return null;
  }
};

/** Upload a photo of the transfer receipt (base64 data URL, image only). */
hotelBookingRouter.post('/:ref/payment-receipt', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const who = actor(req);
    if (!who) return res.status(401).json({ error: 'Sign in to attach a receipt.' });
    const body = pickAllowedKeys(req.body, ['dataUrl'], 'body');
    const booking = getStayByRef(req.params.ref);
    if (!isStaff(who.role) && booking.userId !== who.userId) {
      return res.status(403).json({ error: 'This reservation is not yours to amend.' });
    }
    // Bytes are sniffed: the type comes from the file itself, never from the
    // client, and only raster images pass.
    const parsed = validateImageUpload(body.dataUrl, RECEIPT_MAX_BYTES);
    // The status and hold checks live in recordPaymentProof; run them before
    // anything touches the disk.
    const proofUrl = `/api/hotel-bookings/${encodeURIComponent(booking.bookingRef)}/payment-receipt`;
    const updated = recordPaymentProof(booking.bookingRef, who, { proofUrl });
    await fs.promises.mkdir(receiptDir(), { recursive: true });
    const previous = receiptFileFor(booking.id);
    if (previous) await fs.promises.unlink(previous).catch(() => {});
    await fs.promises.writeFile(path.join(receiptDir(), `${booking.id}.${parsed.extension}`), parsed.buffer);
    res.json({ booking: updated });
  } catch (err: any) {
    if (err instanceof MediaUploadError) return res.status(400).json({ error: err.message });
    const status = err?.status ?? 400;
    res.status(status).json({ error: status >= 500 ? 'Could not save the receipt.' : err?.message || 'Invalid receipt.', code: err?.code });
  }
});

/** The receipt image itself — the booking's owner or staff only. */
hotelBookingRouter.get('/:ref/payment-receipt', (req: AuthenticatedRequest, res: Response) => {
  try {
    const who = actor(req);
    if (!who) return res.status(401).json({ error: 'Sign in to view this receipt.' });
    const booking = getStayByRef(req.params.ref);
    if (!isStaff(who.role) && booking.userId !== who.userId) {
      return res.status(403).json({ error: 'This receipt is not yours to view.' });
    }
    const file = receiptFileFor(booking.id);
    if (!file) return res.status(404).json({ error: 'No receipt uploaded.' });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.sendFile(file);
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ error: err?.message || 'Could not read the receipt.', code: err?.code });
  }
});

/** Every stay filed under one of the traveller's trips. */
hotelBookingRouter.get('/trips/:tripId/stays', (req: AuthenticatedRequest, res: Response) => {
  const who = actor(req);
  if (!who) return res.status(401).json({ error: 'Sign in to view your stays.' });

  // Ownership asserted against the trip before anything is listed — a stay
  // reference reveals names, phones and what someone paid.
  const trip = db.trips.find(t => t.id === req.params.tripId);
  if (!trip) return res.status(404).json({ error: 'Trip not found.' });
  if (!isStaff(who.role) && trip.userId !== who.userId) {
    return res.status(403).json({ error: 'This trip is not yours to read.' });
  }

  res.json({ stays: staysForTrip(req.params.tripId) });
});

export default hotelBookingRouter;