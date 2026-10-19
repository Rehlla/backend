import crypto from 'crypto';
import { db } from '../db/database';
import type { SupplierAvailabilityBlockEntity } from '../db/schema';

/**
 * Supplier availability calendar (blueprint row #12).
 *
 * Suppliers block date ranges when they cannot fulfill bookings. Any active
 * block overlapping a requested date rejects the booking at checkout time.
 * Blocks are per-supplier (all SKUs) — a diving centre on holiday cannot
 * accept any diving, transfer, or safari booking for those dates.
 */

export interface BlockInput {
  supplierId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD, inclusive
  reason: string;
  createdBy: string;  // userId or 'System'
}

/** Creates a new availability block. Overlapping blocks are allowed (they stack). */
export function createBlock(input: BlockInput): SupplierAvailabilityBlockEntity {
  if (!input.supplierId) throw new Error('supplierId is required.');
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new Error('startDate must be YYYY-MM-DD.');
  }
  if (!input.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    throw new Error('endDate must be YYYY-MM-DD.');
  }
  if (input.startDate > input.endDate) {
    throw new Error('startDate must not be after endDate.');
  }
  if (!input.reason?.trim()) throw new Error('reason is required.');
  if (!input.createdBy) throw new Error('createdBy is required.');

  const supplier = db.suppliers.find(s => s.id === input.supplierId);
  if (!supplier) throw new Error('Supplier not found.');

  const block: SupplierAvailabilityBlockEntity = {
    id: `BLK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    supplierId: input.supplierId,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason.trim(),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  db.supplierAvailabilityBlocks.push(block);
  return block;
}

/** Removes a block by id. Returns true if deleted. */
export function deleteBlock(blockId: string, supplierId?: string): boolean {
  const idx = db.supplierAvailabilityBlocks.findIndex(b => {
    if (b.id !== blockId) return false;
    if (supplierId && b.supplierId !== supplierId) return false;
    return true;
  });
  if (idx === -1) return false;
  db.supplierAvailabilityBlocks.splice(idx, 1);
  return true;
}

/** Returns all active blocks for a supplier. */
export function blocksForSupplier(supplierId: string): SupplierAvailabilityBlockEntity[] {
  return db.supplierAvailabilityBlocks.filter(b => b.supplierId === supplierId);
}

/** Whether the supplier record itself exists. The public availability view
 *  must answer 404 for unknown suppliers rather than render an invented
 *  "free every day" calendar for one that does not exist. */
export function supplierExists(supplierId: string): boolean {
  return db.suppliers.some(s => s.id === supplierId);
}

/**
 * Returns true if a given date is blocked for a supplier.
 * A date is blocked if any block's [startDate, endDate] range contains it.
 */
export function isDateBlocked(supplierId: string, date: string): boolean {
  return db.supplierAvailabilityBlocks.some(
    b => b.supplierId === supplierId && b.startDate <= date && b.endDate >= date
  );
}

/**
 * Returns true if any date in a range [start, end] is blocked for a supplier.
 * Used by booking validation to reject reservations during blocked periods.
 */
export function isRangeBlocked(supplierId: string, start: string, end: string): boolean {
  return db.supplierAvailabilityBlocks.some(
    b => b.supplierId === supplierId && b.startDate <= end && b.endDate >= start
  );
}

/**
 * Returns a 30-day availability map for a supplier's calendar widget.
 * Keys are YYYY-MM-DD, values are { blocked: boolean, reason?: string }.
 */
export function monthlyAvailability(supplierId: string, monthStart: string): Record<string, { blocked: boolean; reason?: string }> {
  const start = new Date(monthStart);
  const result: Record<string, { blocked: boolean; reason?: string }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const block = db.supplierAvailabilityBlocks.find(
      b => b.supplierId === supplierId && b.startDate <= key && b.endDate >= key
    );
    result[key] = block
      ? { blocked: true, reason: block.reason }
      : { blocked: false };
  }
  return result;
}

export const supplierCalendarService = {
  createBlock,
  deleteBlock,
  blocksForSupplier,
  supplierExists,
  isDateBlocked,
  isRangeBlocked,
  monthlyAvailability,
};
