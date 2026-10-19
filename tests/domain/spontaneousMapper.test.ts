import { describe, expect, it } from 'vitest';
import { isTightFit, mapFitWindowOptions, windowFitToSpontaneousOption } from '../../src/services/spontaneousMapper';
import type { WindowFitOption } from '../../src/shared/types/context';

/**
 * The "What Should I Do Now?" cards derive their whole local contract from the
 * /api/context/fit-window reply. The mapper used to (hypothetically) invent
 * three sentences for the three-layer "why" accordion, and an option whose
 * total time nearly filled the window told the traveler nothing about pressure.
 * The derivations here must stay lossless and honest: same reason at every
 * accordion depth, and a real tight-fit signal once the window is mostly gone.
 */

const candidate = (over: Partial<WindowFitOption> = {}): WindowFitOption => ({
  id: 'win-snork-eel',
  titleEn: 'Morning Drift Snorkel at Eel Garden',
  titleAr: 'سنوركلينج وانسياب صباحي في الإيل جاردن',
  category: 'dive',
  categoryLabelEn: 'Marine Sanctuary',
  categoryLabelAr: 'محمية بحرية',
  totalRequiredMinutes: 65,
  activityDurationMinutes: 50,
  travelMinutesOneWay: 5,
  transitMode: 'Walk',
  transitModeAr: '٥ دقائق مشي',
  locationNameEn: 'Eel Garden Marine Reserve',
  locationNameAr: 'محمية الإيل جاردن البحرية',
  costEgp: 220,
  fitHeadlineEn: 'Fits 1.5 hr window · 5 min walk',
  fitHeadlineAr: 'مناسب لنافذة ساعة ونص · ٥ دقائق مشي',
  reasonEn: 'The reef is 5 minutes away and you will finish before lunch.',
  reasonAr: 'الشعاب على بعد ٥ دقائق وستنتهي قبل موعد الغداء.',
  actionRoute: '/book-now',
  imageUrl: '',
  ...over
});

describe('isTightFit', () => {
  it('flags an option only once it consumes most of the window', () => {
    // 65 of 120 minutes is comfortably inside; 65 of 70 is tight.
    expect(isTightFit(65, 120)).toBe(false);
    expect(isTightFit(65, 70)).toBe(true);
  });

  it('draws the boundary at 85%', () => {
    // Exactly 85% is not tight; one minute more makes it tight.
    expect(isTightFit(51, 60)).toBe(false);
    expect(isTightFit(52, 60)).toBe(true);
  });
});

describe('windowFitToSpontaneousOption', () => {
  it('keeps the same honest reason at every accordion depth', () => {
    const mapped = windowFitToSpontaneousOption(candidate(), 120);
    expect(mapped.whyItFits).toBe(mapped.whyThisDetailed);
    expect(mapped.whyItWorks).toBe(mapped.whyThisDetailed);
    expect(mapped.whyItFitsAr).toBe(mapped.whyThisDetailedAr);
    expect(mapped.whyItWorksAr).toBe(mapped.whyThisDetailedAr);
  });

  it('derives mood and tag from the server category', () => {
    expect(windowFitToSpontaneousOption(candidate({ category: 'dive' }), 120).mood).toBe('adventure');
    expect(windowFitToSpontaneousOption(candidate({ category: 'desert' }), 120).tag).toBe('Adventure');
    expect(windowFitToSpontaneousOption(candidate({ category: 'sunset' }), 120).mood).toBe('chill');
    expect(windowFitToSpontaneousOption(candidate({ category: 'food' }), 120).mood).toBe('explore');
  });

  it('derives the price estimate from the raw cost', () => {
    const modest = windowFitToSpontaneousOption(candidate({ costEgp: 220 }), 120);
    expect(modest.priceLevel).toBe('Low');
    expect(modest.priceEstimate).toBe('EGP 220');

    const premium = windowFitToSpontaneousOption(candidate({ costEgp: 450 }), 120);
    expect(premium.priceLevel).toBe('Moderate');
    expect(premium.priceEstimateAr).toContain('ج.م');
  });

  it('carries the routing the server decided', () => {
    expect(windowFitToSpontaneousOption(candidate(), 120).actionRoute).toBe('/book-now');
  });

  it('keeps the total required time and the window buffer', () => {
    const mapped = windowFitToSpontaneousOption(candidate({ totalRequiredMinutes: 65 }), 120);
    expect(mapped.durationMinutes).toBe(65);
    expect(mapped.timeBufferMinutes).toBe(55);
  });
});

describe('mapFitWindowOptions', () => {
  it('maps an empty reply to an empty list — the honest empty state', () => {
    expect(mapFitWindowOptions([], 60)).toEqual([]);
  });

  it('maps every candidate', () => {
    const mapped = mapFitWindowOptions([candidate(), candidate({ id: 'win-tea', category: 'food', totalRequiredMinutes: 55 })], 60);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].id).toBe('win-snork-eel');
    expect(mapped[1].mood).toBe('explore');
  });
});