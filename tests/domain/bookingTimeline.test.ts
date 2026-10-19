import { describe, it, expect } from 'vitest';
import {
  bookingTimeline,
  type TimelineStage,
} from '../../src/shared/bookingTimeline';

function states(stages: TimelineStage[]): string[] {
  return stages.map(s => `${s.key}:${s.state}`);
}

describe('bookingTimeline', () => {
  it('walks requested → confirmed → in service → completed', () => {
    expect(states(bookingTimeline('PENDING_CONFIRMATION').stages)).toEqual([
      'requested:current',
      'confirmed:todo',
      'inservice:todo',
      'completed:todo',
    ]);
    expect(states(bookingTimeline('CONFIRMED').stages)).toEqual([
      'requested:done',
      'confirmed:current',
      'inservice:todo',
      'completed:todo',
    ]);
  });

  it('collapses every mid-lifecycle state into "in service"', () => {
    for (const s of [
      'ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'IN_PROGRESS', 'ARRIVED',
      'READY_FOR_PICKUP', 'ACTIVE', 'RETURNED',
    ]) {
      const { stages, terminal } = bookingTimeline(s);
      expect(terminal).toBeNull();
      expect(states(stages)).toEqual([
        'requested:done',
        'confirmed:done',
        'inservice:current',
        'completed:todo',
      ]);
    }
  });

  it('renders terminal verdicts instead of the stepper', () => {
    expect(bookingTimeline('COMPLETED')).toEqual({
      stages: [],
      terminal: { terminal: true, labelKey: 'bookings.status.COMPLETED', tone: 'good' },
    });
    expect(bookingTimeline('CANCELLED').terminal).toMatchObject({
      labelKey: 'bookings.status.CANCELLED',
      tone: 'bad',
    });
    // A refunded booking reports the money truth even mid-lifecycle.
    expect(bookingTimeline('CONFIRMED', true).terminal).toMatchObject({
      labelKey: 'bookings.status.REFUNDED',
      tone: 'bad',
    });
  });

  it('fails closed on unknown or failed states', () => {
    const { stages, terminal } = bookingTimeline('SOME_FUTURE_STATE');
    expect(terminal).toBeNull();
    expect(stages[0]).toEqual({ key: 'requested', state: 'current' });
    expect(bookingTimeline('FAILED').terminal?.tone).toBe('bad');
    expect(bookingTimeline('EXPIRED').terminal?.tone).toBe('bad');
    expect(bookingTimeline('REJECTED').terminal?.tone).toBe('bad');
  });

  it('is case-insensitive to server casing variants', () => {
    expect(bookingTimeline('confirmed').stages[1]).toEqual({ key: 'confirmed', state: 'current' });
  });
});
