import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import {
  optionalString,
  optionalCount,
  optionalNumber,
  optionalEnum,
  pickAllowedKeys,
  rejectRawCardData,
  requiredString,
  requiredNumber,
  requiredCount,
  requiredCalendarDate,
  requiredEnum,
  InvalidRequestBodyError,
} from '../middleware/bodyParams';
import { db } from '../db/database';
import type { InventorySource, RoomRateNightEntity, RoomTypeEntity } from '../db/schema';
import { ensureNightlySku } from '../db/seeds/backfillRoomTypes';
import { buildRateCalendar } from '../services/hotelRateCalendarService';
import {
  cancelStay,
  checkInStay,
  markNoShow,
  completeStay,
  getStayByRef,
  markPaid,
  respondToStay,
  settleBalance,
  STAY_PAYMENT_METHODS,
  StayBookingError,
} from '../services/hotelBookingService';

export const adminHotelRouter = Router();

/**
 * Staff surface for the stay engine: room types, the rate calendar, and the
 * booking queue. Every route here is Operations/Admin — the apiAccessPolicy
 * role rule is the gate; these handlers re-check because a route that reads
 * money must not depend on one middleware alone.
 */

const STAFF_ROLES = new Set(['Operations', 'Admin']);

function requireStaff(req: AuthenticatedRequest): { userId: string; role: string } {
  const user = req.user;
  if (!user || !STAFF_ROLES.has(user.role)) {
    throw new StayBookingError('Staff access is required for this action.', 'FORBIDDEN', {}, 403);
  }
  return { userId: user.userId, role: user.role };
}

function onError(res: Response, err: any) {
  const status = err?.status ?? 400;
  res.status(status).json({
    error: status >= 500 ? 'The hotel admin action failed.' : err?.message || 'Invalid request.',
    code: err?.code,
  });
}

// ---------------------------------------------------------------------------
// Room types
// ---------------------------------------------------------------------------

/** The work queue: every active property still without a known capacity. */
/** Every room type, optionally scoped to one property. */
adminHotelRouter.get('/room-types', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    const accommodationId = typeof req.query.accommodationId === 'string' ? req.query.accommodationId : undefined;
    const roomTypes = db.roomTypes
      .filter(rt => (accommodationId ? rt.accommodationId === accommodationId : true))
      .sort((a, b) => a.accommodationId.localeCompare(b.accommodationId) || a.displayOrder - b.displayOrder);
    res.json({ roomTypes, total: roomTypes.length });
  } catch (err) {
    onError(res, err);
  }
});
adminHotelRouter.get('/room-types/needs-inventory', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    const queue = db.accommodations
      .filter(a => {
        const types = db.roomTypes.filter(rt => rt.accommodationId === a.id);
        return a.active && (types.length === 0 || types.every(rt => rt.totalUnits <= 0));
      })
      .map(a => ({
        accommodationId: a.id,
        slug: a.slug,
        name: a.name,
        nameAr: a.nameAr,
        propertyType: a.propertyType,
        catalogueRooms: a.rooms,
        // The listing's nightly price, so a capacity given from the queue
        // starts at the property's real rate instead of a placeholder.
        perNightEGP: a.perNightEGP,
        roomTypeIds: db.roomTypes.filter(rt => rt.accommodationId === a.id).map(rt => rt.id),
      }));
    res.json({ queue, total: queue.length });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.post('/room-types', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    rejectRawCardData(req.body);
    const body = pickAllowedKeys(req.body, ROOM_TYPE_KEYS, 'body');

    const accommodationId = requiredString(body.accommodationId, 'accommodationId', 128);
    const accommodation = db.accommodations.find(a => a.id === accommodationId);
    if (!accommodation) throw new InvalidRequestBodyError('accommodationId', 'does not match any property.');

    const totalUnits = requiredCount(body.totalUnits, 'totalUnits', 0, 2000);
    const roomType: RoomTypeEntity = {
      id: `RT-${accommodationId}-${requiredString(body.code, 'code', 32).toUpperCase()}`,
      accommodationId,
      skuId: `SKU-RT-${accommodationId}-${requiredString(body.code, 'code', 32).toUpperCase()}`,
      supplierId: db.productSkus.find(s => s.id === accommodation.skuId)?.supplierId ?? `SUP-${accommodationId}`,
      code: requiredString(body.code, 'code', 32),
      name: requiredString(body.name, 'name', 200),
      nameAr: requiredString(body.nameAr, 'nameAr', 200),
      description: optionalString(body.description, 'description', 3000),
      descriptionAr: optionalString(body.descriptionAr, 'descriptionAr', 3000),
      maxGuestsPerUnit: requiredCount(body.maxGuestsPerUnit, 'maxGuestsPerUnit', 1, 30),
      bedType: optionalString(body.bedType, 'bedType', 64),
      bedCount: optionalCount(body.bedCount, 'bedCount', 0, 20),
      sizeSqm: optionalNumber(body.sizeSqm, 'sizeSqm', 1, 5000),
      view: optionalString(body.view, 'view', 64),
      baseNightlyEGP: requiredNumber(body.baseNightlyEGP, 'baseNightlyEGP', 0, 1_000_000),
      weeklyRateEGP: optionalNumber(body.weeklyRateEGP, 'weeklyRateEGP', 0, 5_000_000),
      monthlyRateEGP: optionalNumber(body.monthlyRateEGP, 'monthlyRateEGP', 0, 20_000_000),
      minNights: optionalCount(body.minNights, 'minNights', 1, 30) ?? 1,
      maxNights: optionalCount(body.maxNights, 'maxNights', 1, 365) ?? 30,
      cancellationPolicyHours: optionalCount(body.cancellationPolicyHours, 'cancellationPolicyHours', 0, 720) ?? 48,
      totalUnits,
      // A capacity typed by a human is a verified one — that is the whole
      // distinction the backfill queue exists to close.
      inventorySource: 'ADMIN_VERIFIED' satisfies InventorySource,
      amenities: [],
      images: [],
      active: totalUnits > 0,
      displayOrder: optionalCount(body.displayOrder, 'displayOrder', 0, 1000) ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (db.roomTypes.some(rt => rt.id === roomType.id)) {
      throw new InvalidRequestBodyError('code', 'is already used for this property.');
    }
    db.roomTypes.push(roomType);
    ensureNightlySku(roomType, db.productSkus);

    res.status(201).json({ roomType, createdBy: staff.userId });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.put('/room-types/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    rejectRawCardData(req.body);
    const body = pickAllowedKeys(req.body, ROOM_TYPE_KEYS, 'body');
    const rt = db.roomTypes.find(r => r.id === req.params.id);
    if (!rt) return res.status(404).json({ error: 'Room type not found.' });

    const code = body.code === undefined ? rt.code : requiredString(body.code, 'code', 32);
    rt.code = code;
    if (body.name !== undefined) rt.name = requiredString(body.name, 'name', 200);
    if (body.nameAr !== undefined) rt.nameAr = requiredString(body.nameAr, 'nameAr', 200);
    if (body.description !== undefined) rt.description = optionalString(body.description, 'description', 3000);
    if (body.descriptionAr !== undefined) rt.descriptionAr = optionalString(body.descriptionAr, 'descriptionAr', 3000);
    if (body.maxGuestsPerUnit !== undefined) rt.maxGuestsPerUnit = requiredCount(body.maxGuestsPerUnit, 'maxGuestsPerUnit', 1, 30);
    if (body.bedType !== undefined) rt.bedType = optionalString(body.bedType, 'bedType', 64);
    if (body.bedCount !== undefined) rt.bedCount = optionalCount(body.bedCount, 'bedCount', 0, 20);
    if (body.sizeSqm !== undefined) rt.sizeSqm = optionalNumber(body.sizeSqm, 'sizeSqm', 1, 5000);
    if (body.view !== undefined) rt.view = optionalString(body.view, 'view', 64);
    if (body.baseNightlyEGP !== undefined) rt.baseNightlyEGP = requiredNumber(body.baseNightlyEGP, 'baseNightlyEGP', 0, 1_000_000);
    if (body.weeklyRateEGP !== undefined) rt.weeklyRateEGP = optionalNumber(body.weeklyRateEGP, 'weeklyRateEGP', 0, 5_000_000);
    if (body.monthlyRateEGP !== undefined) rt.monthlyRateEGP = optionalNumber(body.monthlyRateEGP, 'monthlyRateEGP', 0, 20_000_000);
    if (body.minNights !== undefined) rt.minNights = requiredCount(body.minNights, 'minNights', 1, 30);
    if (body.maxNights !== undefined) rt.maxNights = requiredCount(body.maxNights, 'maxNights', 1, 365);
    if (body.cancellationPolicyHours !== undefined) {
      rt.cancellationPolicyHours = requiredCount(body.cancellationPolicyHours, 'cancellationPolicyHours', 0, 720);
    }
    if (body.totalUnits !== undefined) rt.totalUnits = requiredCount(body.totalUnits, 'totalUnits', 0, 2000);
    if (body.active !== undefined) rt.active = body.active === true;
    if (body.displayOrder !== undefined) rt.displayOrder = requiredCount(body.displayOrder, 'displayOrder', 0, 1000);

    // A human touched the capacity; the seed must never stamp a placeholder back.
    rt.inventorySource = 'ADMIN_VERIFIED';
    // Zero units are not sellable — the same rule the backfill applies, so the
    // admin panel cannot publish a room type that has nothing to sell.
    if (rt.totalUnits <= 0) rt.active = false;
    rt.updatedAt = new Date().toISOString();
    ensureNightlySku(rt, db.productSkus);

    res.json({ roomType: rt });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.delete('/room-types/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    const rt = db.roomTypes.find(r => r.id === req.params.id);
    if (!rt) return res.status(404).json({ error: 'Room type not found.' });

    // Retire, never delete: stays reference this row and travellers paid
    // against it. The FK is RESTRICT for exactly this reason.
    rt.active = false;
    rt.updatedAt = new Date().toISOString();
    const sku = db.productSkus.find(s => s.id === rt.skuId);
    if (sku) sku.active = false;

    res.json({ roomType: rt });
  } catch (err) {
    onError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Rate calendar
// ---------------------------------------------------------------------------

const RATE_NIGHT_KEYS = ['nightlyEGP', 'minNights', 'closed', 'closedReason'] as const;

/**
 * The rate calendar for one room type: per night, the price that will be
 * charged (override or base), whether the night is closed, and how many of
 * its rooms are already held — so the desk edits prices looking at demand.
 * Window capped at 62 nights.
 */
adminHotelRouter.get('/room-types/:id/calendar', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    const roomType = db.roomTypes.find(rt => rt.id === req.params.id);
    if (!roomType) return res.status(404).json({ error: 'Room type not found.' });
    res.json(buildRateCalendar(roomType, requiredCalendarDate(req.query.from, 'from'), requiredCalendarDate(req.query.to, 'to')));
  } catch (err) {
    onError(res, err);
  }
});

/** Upsert one date's override for a room type. */
adminHotelRouter.post('/room-types/:id/rate-nights', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    const body = pickAllowedKeys(req.body, ['date', ...RATE_NIGHT_KEYS], 'body');
    const rt = db.roomTypes.find(r => r.id === req.params.id);
    if (!rt) return res.status(404).json({ error: 'Room type not found.' });

    const date = requiredCalendarDate(body.date, 'date');
    const row = upsertRateNight(rt, date, body, staff.userId);
    res.status(201).json({ rateNight: row });
  } catch (err) {
    onError(res, err);
  }
});

/** Apply one override across a date range. Capped at 62 days: a season, not a year. */
adminHotelRouter.post('/room-types/:id/rate-nights/bulk', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    const body = pickAllowedKeys(req.body, ['from', 'to', ...RATE_NIGHT_KEYS], 'body');
    const rt = db.roomTypes.find(r => r.id === req.params.id);
    if (!rt) return res.status(404).json({ error: 'Room type not found.' });

    const from = requiredCalendarDate(body.from, 'from');
    const to = requiredCalendarDate(body.to, 'to');
    if (to <= from) throw new InvalidRequestBodyError('to', 'must be after from.');

    const dates: string[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t < Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
      dates.push(new Date(t).toISOString().slice(0, 10));
      if (dates.length > 62) {
        throw new InvalidRequestBodyError('to', 'spans more than 62 days — split the range.');
      }
    }

    const rows = dates.map(date => upsertRateNight(rt, date, body, staff.userId));
    res.json({ applied: rows.length, rateNights: rows });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.delete('/room-types/:id/rate-nights/:date', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    const date = requiredCalendarDate(req.params.date, 'date');
    const at = db.roomRateNights.findIndex(r => r.roomTypeId === req.params.id && r.date === date);
    if (at < 0) return res.status(404).json({ error: 'No override for that date.' });
    db.roomRateNights.splice(at, 1);
    res.json({ removed: true });
  } catch (err) {
    onError(res, err);
  }
});

export function upsertRateNight(
  rt: RoomTypeEntity,
  date: string,
  body: Record<string, string | number | boolean | string[] | Array<Record<string, unknown>>>,
  userId: string
): RoomRateNightEntity {
  const existing = db.roomRateNights.find(r => r.roomTypeId === rt.id && r.date === date);
  const row: RoomRateNightEntity = {
    id: existing?.id ?? `RRN-${rt.id}-${date}`,
    accommodationId: rt.accommodationId,
    roomTypeId: rt.id,
    date,
    nightlyEGP: body.nightlyEGP === undefined ? existing?.nightlyEGP : requiredNumber(body.nightlyEGP, 'nightlyEGP', 0, 1_000_000),
    minNights: body.minNights === undefined ? existing?.minNights : requiredCount(body.minNights, 'minNights', 1, 30),
    closed: body.closed === undefined ? (existing?.closed ?? false) : body.closed === true,
    closedReason: body.closedReason === undefined ? existing?.closedReason : optionalString(body.closedReason, 'closedReason', 200),
    createdByUserId: userId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existing) db.roomRateNights[db.roomRateNights.indexOf(existing)] = row;
  else db.roomRateNights.push(row);
  return row;
}

// ---------------------------------------------------------------------------
// Booking queue
// ---------------------------------------------------------------------------

adminHotelRouter.get('/bookings', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    const status = optionalEnum(
      req.query.status,
      STAY_STATUSES as unknown as readonly string[],
      'status'
    );
    const limit = optionalCount(req.query.limit, 'limit', 1, 500) ?? 100;

    const rows = db.hotelBookings
      .filter(b => (status ? b.status === status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    res.json({ bookings: rows, total: rows.length });
  } catch (err) {
    onError(res, err);
  }
});

/**
 * For actions whose every field is optional (mark-paid, settle-balance,
 * cancel): an empty body is a valid request — "the deposit arrived", with no
 * reference to add. pickAllowedKeys alone refuses `{}`, which is what the
 * dashboard's one-tap buttons send, so the reception actions all failed.
 */
function optionalFields(body: unknown, allowed: readonly string[]) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  return allowed.some(key => source[key] !== undefined) ? pickAllowedKeys(source, allowed, 'body') : {};
}

adminHotelRouter.post('/bookings/:ref/mark-paid', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    const body = optionalFields(req.body, ['method', 'reference']);
    const booking = markPaid(req.params.ref, staff, {
      method: body.method === undefined ? undefined : requiredEnum(body.method, STAY_PAYMENT_METHODS, 'method'),
      reference: optionalString(body.reference, 'reference', 128),
    });
    res.json({ booking });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.post('/bookings/:ref/respond', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    const body = pickAllowedKeys(req.body, ['approve', 'reason'], 'body');
    if (typeof body.approve !== 'boolean') {
      throw new InvalidRequestBodyError('approve', 'must be true or false.');
    }
    const booking = respondToStay(req.params.ref, staff, {
      approve: body.approve,
      reason: optionalString(body.reason, 'reason', 500),
    });
    res.json({ booking });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.post('/bookings/:ref/settle-balance', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    const body = optionalFields(req.body, ['amountEGP']);
    const booking = settleBalance(req.params.ref, staff, {
      amountEGP: body.amountEGP === undefined ? undefined : requiredNumber(body.amountEGP, 'amountEGP', 0, 1_000_000),
    });
    res.json({ booking });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.post('/bookings/:ref/check-in', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    res.json({ booking: checkInStay(req.params.ref, staff) });
  } catch (err) {
    onError(res, err);
  }
});

/** The guest never arrived (on or after their check-in date). */
adminHotelRouter.post('/bookings/:ref/no-show', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    res.json({ booking: markNoShow(req.params.ref, staff) });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.post('/bookings/:ref/complete', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    res.json({ booking: completeStay(req.params.ref, staff) });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.get('/bookings/:ref', (req: AuthenticatedRequest, res: Response) => {
  try {
    requireStaff(req);
    res.json({ booking: getStayByRef(req.params.ref) });
  } catch (err) {
    onError(res, err);
  }
});

adminHotelRouter.post('/bookings/:ref/cancel', (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = requireStaff(req);
    const body = optionalFields(req.body, ['reason']);
    const result = cancelStay(req.params.ref, staff, {
      reason: optionalString(body.reason, 'reason', 500),
    });
    res.json(result);
  } catch (err) {
    onError(res, err);
  }
});

const STAY_STATUSES = [
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'IN_HOUSE',
  'COMPLETED',
  'NO_SHOW',
] as const;

const ROOM_TYPE_KEYS = [
  'accommodationId',
  'code',
  'name',
  'nameAr',
  'description',
  'descriptionAr',
  'maxGuestsPerUnit',
  'bedType',
  'bedCount',
  'sizeSqm',
  'view',
  'baseNightlyEGP',
  'weeklyRateEGP',
  'monthlyRateEGP',
  'minNights',
  'maxNights',
  'cancellationPolicyHours',
  'totalUnits',
  'active',
  'displayOrder',
] as const;
