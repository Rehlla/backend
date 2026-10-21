import { describe, it, expect } from 'vitest';
import { buildDeterministicDays } from '../../server/services/tripPlannerCore';

/**
 * POST /api/trip/generate used to title the itinerary "<durationDays>-Day"
 * while hardcoding its days array to exactly two days — the fallback body
 * disagreed with its own title for any duration other than 2. The
 * deterministic builder must cover every sane duration honestly.
 */
describe('buildDeterministicDays', () => {
  it('returns exactly durationDays days for common durations', () => {
    for (const n of [1, 2, 3, 4, 5, 7, 10, 14]) {
      expect(buildDeterministicDays(n)).toHaveLength(n);
    }
  });

  it('numbers days sequentially from 1 with no gaps', () => {
    const days = buildDeterministicDays(7);
    days.forEach((d, i) => expect(d.dayNumber).toBe(i + 1));
  });

  it('opens with the arrival day and closes with the airport transfer day', () => {
    const days = buildDeterministicDays(5);
    expect(days[0].title).toContain('Arrival');
    const last = days[days.length - 1];
    expect(last.activities.some(a => a.category === 'transfer' && a.location.includes('SSH Airport'))).toBe(true);
  });

  it('cycles the middle days across diving, safari and wellness templates', () => {
    const days = buildDeterministicDays(6);
    const themes = days.map(d => d.theme);
    expect(themes).toContain('World-Class Diving');
    expect(themes).toContain('Sinai Safari');
    expect(themes).toContain('Slow Dahab');
  });

  it('keeps activity ids unique across the whole trip', () => {
    const days = buildDeterministicDays(10);
    const ids = days.flatMap(d => d.activities.map(a => a.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('clamps degenerate durations into a sane range', () => {
    expect(buildDeterministicDays(0)).toHaveLength(1);
    expect(buildDeterministicDays(-3)).toHaveLength(1);
    expect(buildDeterministicDays(999)).toHaveLength(14);
    expect(buildDeterministicDays(NaN as any)).toHaveLength(5);
  });

  it('every activity carries a price estimate the availability join can replace', () => {
    const days = buildDeterministicDays(4);
    for (const day of days) {
      for (const act of day.activities) {
        expect(act.estimatedPriceEGP).toBeGreaterThan(0);
        expect(act.location.length).toBeGreaterThan(0);
      }
    }
  });
});
