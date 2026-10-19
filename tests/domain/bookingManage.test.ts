import { describe, expect, it } from 'vitest';
import {
  cancellationEligibility,
  rescheduleEligibility,
  slotAvailabilityKind,
  availabilitySlotViews,
  bookingActionError
} from '../../src/services/bookingManage';
import { ApiError } from '../../src/services/apiError';

describe('cancellationEligibility', () => {
  it('allows cancellation of an active booking', () => {
    expect(cancellationEligibility({ supplierState: 'PENDING_CONFIRMATION', paymentState: 'CAPTURED' })).toEqual({ allowed: true });
    expect(cancellationEligibility({ supplierState: 'ASSIGNED', paymentState: 'CAPTURED' })).toEqual({ allowed: true });
  });

  it('blocks cancellation once the supplier state is terminal', () => {
    for (const state of ['CANCELLED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'FAILED']) {
      expect(cancellationEligibility({ supplierState: state, paymentState: 'CAPTURED' })).toEqual({
        allowed: false,
        reason: 'terminal'
      });
    }
  });

  it('blocks cancellation when the money side is already refunded', () => {
    expect(cancellationEligibility({ supplierState: 'CONFIRMED', paymentState: 'REFUNDED' })).toEqual({
      allowed: false,
      reason: 'noRefundPending'
    });
  });
});

describe('rescheduleEligibility', () => {
  it('allows rescheduling a live booking', () => {
    expect(rescheduleEligibility({ supplierState: 'CONFIRMED' })).toEqual({ allowed: true });
  });

  it('blocks rescheduling once terminal', () => {
    expect(rescheduleEligibility({ supplierState: 'CANCELLED' })).toEqual({ allowed: false, reason: 'terminal' });
    expect(rescheduleEligibility({ supplierState: 'COMPLETED' })).toEqual({ allowed: false, reason: 'terminal' });
  });
});

describe('slotAvailabilityKind', () => {
  it('labels an open slot available', () => {
    expect(slotAvailabilityKind({ availableCapacity: 6, status: 'AVAILABLE' }, 2)).toBe('available');
  });

  it('labels few seats left as limited', () => {
    expect(slotAvailabilityKind({ availableCapacity: 2, status: 'AVAILABLE' }, 2)).toBe('limited');
    expect(slotAvailabilityKind({ availableCapacity: 4, status: 'ALMOST_FULL' }, 2)).toBe('limited');
  });

  it('labels a sold-out slot sold out even when seats free up', () => {
    expect(slotAvailabilityKind({ availableCapacity: 6, status: 'SOLD_OUT' }, 2)).toBe('sold-out');
  });

  it('labels zero seats sold out and a partially-too-small party as fits-no-party', () => {
    expect(slotAvailabilityKind({ availableCapacity: 0, status: 'AVAILABLE' }, 2)).toBe('sold-out');
    expect(slotAvailabilityKind({ availableCapacity: 1, status: 'AVAILABLE' }, 2)).toBe('fits-no-party');
  });
});

describe('availabilitySlotViews', () => {
  it('maps every reported slot to a presentation row without inventing rows', () => {
    const views = availabilitySlotViews(
      {
        slots: [
          { id: 'S1', date: '2026-09-10', timeSlot: '08:30 AM', totalCapacity: 8, availableCapacity: 6, priceEGP: 1200, status: 'AVAILABLE' },
          { id: 'S2', date: '2026-09-10', timeSlot: '01:30 PM', totalCapacity: 8, availableCapacity: 1, priceEGP: 1200, status: 'AVAILABLE' }
        ]
      },
      2
    );
    expect(views).toHaveLength(2);
    expect(views[0].kind).toBe('available');
    expect(views[0].capacityRemaining).toBe(6);
    expect(views[1].kind).toBe('fits-no-party');
  });

  it('returns an empty list for a date with no scheduled slots', () => {
    expect(availabilitySlotViews({ slots: [] }, 2)).toEqual([]);
  });
});

describe('bookingActionError', () => {
  it('maps statuses to user-safe codes', () => {
    expect(bookingActionError(new ApiError('x', 401)).code).toBe('unauthorized');
    expect(bookingActionError(new ApiError('x', 403)).code).toBe('forbidden');
    expect(bookingActionError(new ApiError('x', 404)).code).toBe('notFound');
    expect(bookingActionError(new ApiError('x', 409)).code).toBe('conflict');
    expect(bookingActionError(new ApiError('x', 422)).code).toBe('invalidState');
    expect(bookingActionError(new ApiError('x', 429)).code).toBe('rateLimited');
    expect(bookingActionError(new ApiError('x', 503)).code).toBe('server');
    expect(bookingActionError(new ApiError('x', 418)).code).toBe('unknown');
  });

  it('treats timeout / offline errors as network failures, not server errors', () => {
    expect(bookingActionError(new Error('انتهت مهلة الاتصال بالشبكة')).code).toBe('network');
    expect(bookingActionError(new TypeError('Failed to fetch')).code).toBe('network');
  });

  it('keeps the raw backend message out of the surface decision', () => {
    const info = bookingActionError(new ApiError('Only 0 place(s) remain', 409));
    expect(info.code).toBe('conflict');
    expect(info.detail).toBe('Only 0 place(s) remain');
  });
});
