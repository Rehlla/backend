import { describe, expect, it } from 'vitest';
import { mapsContextService } from '../../server/services/mapsContextService';

/**
 * The fit-window reply carries a human context line in both languages. It used
 * to disagree with itself: English floored the window to hours ("0h" for forty
 * minutes) while Arabic always read minutes, and both claimed "3 activities"
 * even when the window was too short for any. The message must reflect the
 * count actually returned to the traveler and the same window in both labels.
 */
describe('fit-window context line', () => {
  it('reports zero options honestly for a sub-hour window', () => {
    const r = mapsContextService.getFitWindowOptions('lighthouse', 40);
    expect(r.options).toHaveLength(0);
    expect(r.recommendedContextEn).toBe('No activities fit your 40 min window.');
    expect(r.recommendedContextAr).toBe('لم نجد أنشطة مناسبة لوقتك المتاح (40 دقيقة).');
  });

  it('reports the displayed count, not the eligible count', () => {
    const r = mapsContextService.getFitWindowOptions('lighthouse', 120);
    expect(r.options.length).toBeLessThanOrEqual(3);
    expect(r.recommendedContextEn).toBe(`Found ${r.options.length} activities that fit your 120 min window.`);
    expect(r.recommendedContextAr).toContain(`${r.options.length} أنشطة`);
  });

  it('uses minutes in both languages for a sub-hour window', () => {
    const r = mapsContextService.getFitWindowOptions('lighthouse', 55);
    expect(r.recommendedContextEn).toContain('55 min window');
    expect(r.recommendedContextAr).toContain('(55 دقيقة)');
    expect(r.recommendedContextEn).not.toContain('0h');
  });
});