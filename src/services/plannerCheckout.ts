import type { CommerceHold } from './api';
import { localCalendarDate } from './heldCheckout';

/**
 * The planner's booking wizard (hotel → transfer → diving → safari → pay)
 * books these catalogue SKUs. The transfer step holds the transfer seat; the
 * payment step holds the rest and settles everything in one checkout. Both
 * must hold on the same date, slot and party size, or checkout refuses the
 * transfer hold as HOLD_MISMATCH — so the rules live here once.
 */
export const PLANNER_SKUS = {
  hotel: 'SKU-HTL-001',
  transferPrivate: 'SKU-TRF-001',
  transferShared: 'SKU-TRF-002',
  diving: 'SKU-DIV-001',
  safari: 'SKU-SAF-001',
} as const;

export const PLANNER_HOTEL_SLOT = 'Check-in 14:00';
export const PLANNER_TRANSFER_SLOT = '10:30 AM';

export const transferSkuFor = (transferId: string): string =>
  transferId === 'private-car' ? PLANNER_SKUS.transferPrivate : PLANNER_SKUS.transferShared;

/**
 * The calendar date of trip day `dayNumber` (1-based), from the trip's start
 * date. Never earlier than today: a slot cannot be held in the past, and a
 * trip whose start has passed is being booked for what is left of it.
 */
export function tripDayDate(trip: { startDate?: string } | null | undefined, dayNumber: number, now: Date = new Date()): string {
  const today = localCalendarDate(0, now);
  const start = trip?.startDate && /^\d{4}-\d{2}-\d{2}/.test(trip.startDate) ? trip.startDate.slice(0, 10) : today;
  const [y, m, d] = start.split('-').map(Number);
  const date = localCalendarDate(Math.max(0, dayNumber - 1), new Date(y, m - 1, d));
  return date < today ? today : date;
}

/** The transfer hold the transfer step took, as the payment step needs to recognise it. */
export interface StoredTransferHold {
  holdToken: string;
  amountEGP: number;
  expiresAt?: string;
  skuId: string;
  tripId: string;
  date: string;
  timeSlot: string;
  passengersCount: number;
}

export const TRANSFER_HOLD_STORAGE_KEY = 'current_transfer_hold';

export function storeTransferHold(hold: CommerceHold, line: Omit<StoredTransferHold, 'holdToken' | 'amountEGP' | 'expiresAt'>): void {
  const record: StoredTransferHold = { holdToken: hold.holdToken, amountEGP: hold.amountEGP, expiresAt: hold.expiresAt, ...line };
  try {
    sessionStorage.setItem(TRANSFER_HOLD_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable: the payment step simply holds the seat itself.
  }
}

/**
 * The stored transfer hold, when it is still usable for exactly this line.
 * A hold for another date, slot, party or trip — or one past its expiry —
 * would be refused at checkout, so it is not offered.
 */
export function matchingTransferHold(
  line: Omit<StoredTransferHold, 'holdToken' | 'amountEGP' | 'expiresAt'>,
  now: number = Date.now()
): StoredTransferHold | null {
  let stored: Partial<StoredTransferHold> | null = null;
  try {
    const raw = sessionStorage.getItem(TRANSFER_HOLD_STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as Partial<StoredTransferHold>) : null;
  } catch {
    return null;
  }
  if (!stored?.holdToken || typeof stored.amountEGP !== 'number') return null;
  if (stored.expiresAt && Date.parse(stored.expiresAt) <= now) return null;
  const same =
    stored.skuId === line.skuId &&
    stored.tripId === line.tripId &&
    stored.date === line.date &&
    stored.timeSlot === line.timeSlot &&
    stored.passengersCount === line.passengersCount;
  return same ? (stored as StoredTransferHold) : null;
}
