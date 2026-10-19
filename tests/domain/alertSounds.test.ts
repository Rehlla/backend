import { describe, it, expect } from 'vitest';
import { newIds } from '../../src/components/operations/command-center/alertSounds';

/**
 * The command center rings when work arrives. Opening the dashboard must not
 * ring for everything already waiting, and a poll that sees the same queue
 * must stay silent.
 */
describe('alert arrivals', () => {
  it('records the baseline silently on the first poll', () => {
    expect(newIds(['DO-1', 'DO-2'], null)).toEqual([]);
  });

  it('reports only what was not there last time', () => {
    expect(newIds(['DO-1', 'DO-2', 'DO-3'], new Set(['DO-1', 'DO-2']))).toEqual(['DO-3']);
  });

  it('stays silent when an item leaves the queue', () => {
    expect(newIds(['DO-2'], new Set(['DO-1', 'DO-2']))).toEqual([]);
  });

  it('treats a stay moving to a new status as a new arrival', () => {
    // Stays are keyed ref:status, so "paid, waiting for approval" rings even
    // though the booking itself was already known as "awaiting deposit".
    const seen = new Set(['HTL-1:PENDING_PAYMENT']);
    expect(newIds(['HTL-1:PENDING_CONFIRMATION'], seen)).toEqual(['HTL-1:PENDING_CONFIRMATION']);
  });
});
