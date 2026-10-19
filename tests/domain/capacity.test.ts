import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService, InsufficientCapacityError } from '../../server/services/commerceService';
import { resetDb, seedSku, nextIdempotencyKey } from '../helpers/fixtures';

/**
 * Capacity enforcement — regression cover for CRIT-9.
 *
 * createHold used to respond to an over-capacity request by RAISING
 * slot.totalCapacity by passengersCount * 4 and proceeding. Inventory was
 * therefore unbounded: every booking was confirmed regardless of what the
 * supplier could actually take, and the hold/lock/TTL machinery around it was
 * decorative. Travellers would arrive at a full dive boat holding a valid
 * voucher.
 */

const hold = (passengersCount: number, over: Record<string, unknown> = {}) =>
  commerceService.createHold({
    skuId: 'SKU-DIVE-TEST',
    tripId: 'TRIP-TEST',
    travelerId: 'USR-TEST',
    date: '2026-09-10',
    timeSlot: '08:30 AM (Morning Dive)',
    passengersCount,
    idempotencyKey: nextIdempotencyKey(),
    ...over
  });

const slot = () =>
  db.inventorySlots.find(s => s.skuId === 'SKU-DIVE-TEST' && s.date === '2026-09-10');

describe('inventory capacity', () => {
  beforeEach(() => {
    resetDb();
    seedSku({ maxCapacityPerSlot: 8 });
  });

  it('accepts a hold that fits and reserves exactly what was asked for', () => {
    const h = hold(2);
    expect(h.status).toBe('ACTIVE');
    expect(h.passengersCount).toBe(2);
    expect(slot()!.heldCapacity).toBe(2);
    expect(slot()!.totalCapacity).toBe(8);
  });

  it('REJECTS a hold larger than the slot instead of inventing capacity', () => {
    expect(() => hold(999)).toThrow(InsufficientCapacityError);
  });

  it('does not raise totalCapacity on a rejected hold — the exact CRIT-9 behaviour', () => {
    hold(2);
    const before = slot()!.totalCapacity;
    expect(() => hold(999)).toThrow(InsufficientCapacityError);
    expect(slot()!.totalCapacity).toBe(before);
    // The old code would have set this to 8 + 999*4 = 4004.
    expect(slot()!.totalCapacity).toBe(8);
  });

  it('leaves held capacity untouched when a hold is rejected', () => {
    hold(6);
    expect(slot()!.heldCapacity).toBe(6);
    expect(() => hold(5)).toThrow(InsufficientCapacityError);
    expect(slot()!.heldCapacity).toBe(6);
  });

  it('fills a slot exactly to capacity, then refuses the next seat', () => {
    hold(5);
    hold(3);
    expect(slot()!.heldCapacity).toBe(8);
    expect(() => hold(1)).toThrow(InsufficientCapacityError);
  });

  it('reports the remaining seats in the rejection so the caller can act on it', () => {
    hold(6);
    let error: InsufficientCapacityError | undefined;
    try { hold(5); } catch (e) { error = e as InsufficientCapacityError; }
    expect(error).toBeInstanceOf(InsufficientCapacityError);
    expect(error!.message).toMatch(/2/);
  });

  it('is idempotent: replaying a key returns the same hold and reserves once', () => {
    const key = nextIdempotencyKey();
    const first = hold(3, { idempotencyKey: key });
    const second = hold(3, { idempotencyKey: key });
    expect(second.id).toBe(first.id);
    expect(db.holds.filter(h => h.status === 'ACTIVE')).toHaveLength(1);
    expect(slot()!.heldCapacity).toBe(3);
  });

  it('returns seats to the pool when a hold expires', () => {
    hold(8);
    expect(() => hold(1)).toThrow(InsufficientCapacityError);

    // Age the hold past its TTL rather than waiting 15 real minutes.
    db.holds[0].expiresAt = new Date(Date.now() - 1000).toISOString();

    const afterExpiry = hold(1);
    expect(afterExpiry.status).toBe('ACTIVE');
    expect(slot()!.heldCapacity).toBe(1);
  });
});
