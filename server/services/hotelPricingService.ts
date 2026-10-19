import { db } from '../db/database';
import type {
  HotelNightCharge,
  HotelPriceBreakdown,
  RoomRateNightEntity,
  RoomTypeEntity,
} from '../db/schema';

/**
 * Prices a stay, night by night, from the rate calendar.
 *
 * This is the rule the stay engine charges by, and it is the piece that was
 * missing when "book this stay" charged a fixed five-night package whatever
 * the traveller asked for. One night, one price; the dates come from the
 * booking, the rate comes from the calendar.
 *
 * ---------------------------------------------------------------------------
 * The quote is stateless, and that is deliberate
 * ---------------------------------------------------------------------------
 * `quoteStay` computes a breakdown and nothing else — no token, no stored row.
 * The reservation re-prices through this same function at hold time and
 * snapshots the result onto the booking, so the traveller is charged exactly
 * what a booking row records, never what an earlier page render showed. A price
 * that moved between quote and reserve surfaces as a re-confirm, the same way
 * the held-checkout flow already treats a moved transfer price — rather than as
 * a signed promise that has to be honoured or argued with later.
 *
 * ---------------------------------------------------------------------------
 * What pricing does and does not know about
 * ---------------------------------------------------------------------------
 * Closed nights are a pricing concern (a closed night has no price, so the
 * quote refuses); how many units remain is an availability concern and lives in
 * hotelAvailabilityService. A quote can therefore be valid for a stay that is
 * sold out — the reservation is the step that puts the two together.
 */

/** Share of the total collected as a deposit before arrival. */
export const STAY_DEPOSIT_PERCENT = 0.2;
/** Platform service fee on the stay subtotal. Zero until a pricing decision exists. */
export const STAY_SERVICE_FEE_PERCENT = 0;
/** Tax on the stay subtotal. Zero until a pricing decision exists. */
export const STAY_TAX_PERCENT = 0;

/** How long a quoted figure is presented as current. Matches the hold TTL family. */
export const QUOTE_TTL_MINUTES = 15;

export class StayQuoteError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(message: string, code: string, details: Record<string, unknown> = {}, status = 400) {
    super(message);
    this.name = 'StayQuoteError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Every night a stay occupies: `checkIn` through the night before `checkOut`.
 *
 * `checkOut` is the morning of departure, not a slept night — a stay of
 * 2026-04-10 → 2026-04-13 sleeps the 10th, 11th and 12th. Parsed on UTC so a
 * calendar date is never shifted by a timezone; these are dates, not moments.
 */
export function enumerateNights(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  for (let t = start; t < end; t += 86_400_000) {
    nights.push(new Date(t).toISOString().slice(0, 10));
  }
  return nights;
}

/**
 * The rate for one night: the calendar override when the admin priced that
 * date, otherwise the room type's standing nightly rate.
 */
export function nightlyRateFor(
  roomType: RoomTypeEntity,
  overridesByDate: Map<string, RoomRateNightEntity>,
  date: string
): number {
  const override = overridesByDate.get(date);
  if (override?.nightlyEGP != null) return override.nightlyEGP;
  return roomType.baseNightlyEGP;
}

/**
 * The fewest nights a stay of this window may be booked for: a date-level
 * override when the calendar sets one, else the room type's own minimum.
 * The strictest requirement across the window wins — a stay touching a
 * three-night-minimum event weekend must be at least three nights.
 */
export function requiredMinNights(
  roomType: RoomTypeEntity,
  overridesByDate: Map<string, RoomRateNightEntity>,
  nights: string[]
): number {
  let min = roomType.minNights;
  for (const date of nights) {
    const override = overridesByDate.get(date);
    if (override?.minNights != null && override.minNights > min) min = override.minNights;
  }
  return min;
}

/**
 * What the whole stay costs once long-stay blocks are applied.
 *
 * A full 28-night block prices at `monthlyRateEGP` and a full 7-night block at
 * `weeklyRateEGP` — the block is the product, the same convention the rentals
 * domain uses (weeks × weeklyRate + remainder × dailyRate). Blocks consume the
 * earliest nights first and the remainder is priced at each night's own rate,
 * so with no blocks set this reduces to the plain per-night sum.
 *
 * Rates are per unit; a two-room stay doubles every line.
 */
export function blockPricedTotalEGP(
  nightlyEGPs: number[],
  rooms: number,
  monthlyRateEGP?: number,
  weeklyRateEGP?: number
): number {
  let total = 0;
  let i = 0;

  if (monthlyRateEGP != null && monthlyRateEGP > 0) {
    const blocks = Math.floor(nightlyEGPs.length / 28);
    if (blocks >= 1) {
      total += blocks * monthlyRateEGP * rooms;
      i = blocks * 28;
    }
  }
  if (weeklyRateEGP != null && weeklyRateEGP > 0) {
    const blocks = Math.floor((nightlyEGPs.length - i) / 7);
    if (blocks >= 1) {
      total += blocks * weeklyRateEGP * rooms;
      i += blocks * 7;
    }
  }
  for (; i < nightlyEGPs.length; i++) {
    total += nightlyEGPs[i] * rooms;
  }
  return total;
}

export interface QuoteStayParams {
  accommodationId: string;
  roomTypeId: string;
  /** YYYY-MM-DD, the first slept night. */
  checkIn: string;
  /** YYYY-MM-DD, the morning of departure. Exclusive. */
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
}

export interface StayQuote extends HotelPriceBreakdown {
  accommodationId: string;
  roomTypeId: string;
  rooms: number;
  adults: number;
  children: number;
  /** Effective minimum for this window after date-level overrides. */
  minNights: number;
  /** Latest moment a free cancellation is still accepted, ISO. */
  freeCancellationUntil: string;
  /** When this figure stops being current. ISO. */
  expiresAt: string;
  /** Whether this room type's capacity is a verified figure. */
  inventorySource: RoomTypeEntity['inventorySource'];
}

/** Today's calendar date in Dahab (Africa/Cairo), as YYYY-MM-DD. */
export function dahabToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * A night that has already passed cannot be sold. Checked at the entry points
 * (quote, reserve, move) rather than inside `quoteStay`, which stays a pure
 * function of the calendar so an in-house stay can still be re-priced.
 * "Today" is Dahab's date, not the server's: a check-in for tonight stays
 * bookable until midnight in Cairo.
 */
export function assertCheckInNotPast(checkIn: string, now: Date = new Date()): void {
  const today = dahabToday(now);
  if (checkIn < today) {
    throw new StayQuoteError(
      'Check-in cannot be in the past.',
      'CHECK_IN_IN_PAST',
      { checkIn, today }
    );
  }
}

/**
 * Prices a stay. Throws `StayQuoteError` with a code the client can act on:
 * `UNKNOWN_ROOM_TYPE`, `INACTIVE_ROOM_TYPE`, `INVALID_DATES`, `INVALID_PARTY`,
 * `TOO_MANY_ROOMS`, `MIN_NIGHTS`, `MAX_NIGHTS`, `NIGHT_CLOSED`.
 */
export function quoteStay(params: QuoteStayParams): StayQuote {
  const roomType = db.roomTypes.find(r => r.id === params.roomTypeId);
  if (!roomType || roomType.accommodationId !== params.accommodationId) {
    throw new StayQuoteError(
      'This room type does not exist for the selected property.',
      'UNKNOWN_ROOM_TYPE',
      { roomTypeId: params.roomTypeId, accommodationId: params.accommodationId },
      404
    );
  }
  if (!roomType.active || roomType.totalUnits <= 0) {
    // An inactive type is one the backfill held back for want of a capacity, or
    // one an admin retired. Either way there is no price to give.
    throw new StayQuoteError(
      'This room type is not bookable online yet.',
      'INACTIVE_ROOM_TYPE',
      { roomTypeId: roomType.id, totalUnits: roomType.totalUnits },
      409
    );
  }

  const nights = enumerateNights(params.checkIn, params.checkOut);
  if (nights.length < 1) {
    throw new StayQuoteError(
      'Check-out must be after check-in.',
      'INVALID_DATES',
      { checkIn: params.checkIn, checkOut: params.checkOut }
    );
  }

  const adults = Math.floor(params.adults);
  const children = Math.floor(params.children);
  const rooms = Math.floor(params.rooms);
  if (!Number.isFinite(adults) || adults < 1 || children < 0 || rooms < 1) {
    throw new StayQuoteError(
      'A stay needs at least one adult and one room.',
      'INVALID_PARTY',
      { adults: params.adults, children: params.children, rooms: params.rooms }
    );
  }
  if (rooms > roomType.totalUnits) {
    throw new StayQuoteError(
      'That many rooms are not part of this room type.',
      'TOO_MANY_ROOMS',
      { rooms, totalUnits: roomType.totalUnits }
    );
  }
  const guests = adults + children;
  if (guests > rooms * roomType.maxGuestsPerUnit) {
    throw new StayQuoteError(
      `Each room sleeps up to ${roomType.maxGuestsPerUnit} guests.`,
      'INVALID_PARTY',
      { guests, rooms, maxGuestsPerUnit: roomType.maxGuestsPerUnit }
    );
  }

  const overridesByDate = new Map<string, RoomRateNightEntity>();
  for (const row of db.roomRateNights) {
    if (row.roomTypeId === roomType.id && nights.includes(row.date)) {
      overridesByDate.set(row.date, row);
    }
  }

  // A closed night has no price at any party size — the quote refuses rather
  // than silently pricing a night the property took off sale.
  const closed = [...overridesByDate.values()].find(row => row.closed);
  if (closed) {
    throw new StayQuoteError(
      'Part of this stay is not available for sale.',
      'NIGHT_CLOSED',
      { date: closed.date, reason: closed.closedReason },
      409
    );
  }

  const minNights = requiredMinNights(roomType, overridesByDate, nights);
  if (nights.length < minNights) {
    throw new StayQuoteError(
      `This stay needs at least ${minNights} nights.`,
      'MIN_NIGHTS',
      { nights: nights.length, minNights }
    );
  }
  if (nights.length > roomType.maxNights) {
    throw new StayQuoteError(
      `This stay can be booked for at most ${roomType.maxNights} nights.`,
      'MAX_NIGHTS',
      { nights: nights.length, maxNights: roomType.maxNights }
    );
  }

  const nightsDetail: HotelNightCharge[] = nights.map(date => {
    const nightlyEGP = nightlyRateFor(roomType, overridesByDate, date);
    return { date, nightlyEGP, rooms, totalEGP: nightlyEGP * rooms };
  });

  const baseEGP = nightsDetail.reduce((acc, n) => acc + n.totalEGP, 0);
  const blockPricedEGP = blockPricedTotalEGP(
    nightsDetail.map(n => n.nightlyEGP),
    rooms,
    roomType.monthlyRateEGP,
    roomType.weeklyRateEGP
  );
  // Never negative: block rates exist to be cheaper, but a mis-entered one must
  // not turn into a surcharge wearing a discount's name.
  const longStayDiscountEGP = Math.max(0, baseEGP - blockPricedEGP);
  const subtotalEGP = baseEGP - longStayDiscountEGP;

  const serviceFeeEGP = Math.round(subtotalEGP * STAY_SERVICE_FEE_PERCENT);
  const taxEGP = Math.round((subtotalEGP + serviceFeeEGP) * STAY_TAX_PERCENT);
  const totalEGP = subtotalEGP + serviceFeeEGP + taxEGP;
  const depositEGP = Math.round(totalEGP * STAY_DEPOSIT_PERCENT);
  const balanceDueEGP = totalEGP - depositEGP;

  const now = new Date();
  return {
    accommodationId: roomType.accommodationId,
    roomTypeId: roomType.id,
    rooms,
    adults,
    children,
    nights: nightsDetail.length,
    nightsDetail,
    baseEGP,
    longStayDiscountEGP,
    serviceFeeEGP,
    taxEGP,
    totalEGP,
    currency: 'EGP',
    depositEGP,
    balanceDueEGP,
    minNights,
    freeCancellationUntil: new Date(
      Date.parse(`${params.checkIn}T14:00:00Z`) - roomType.cancellationPolicyHours * 3_600_000
    ).toISOString(),
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MINUTES * 60_000).toISOString(),
    inventorySource: roomType.inventorySource,
  };
}