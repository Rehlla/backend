import { describe, it, expect } from 'vitest';
import { hexToRgb, relativeLuminance, contrastRatio, wcagBadge } from '../../src/utils/contrast';

describe('contrast helpers', () => {
  it('parses 3- and 6-digit hex', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#10B981')).toEqual([16, 185, 129]);
    expect(hexToRgb('red')).toBeNull();
    expect(hexToRgb('#12345')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });

  it('computes WCAG ratios on known pairs', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 3);
    expect(contrastRatio('#777777', '#ffffff')).toBeGreaterThan(4);
    expect(contrastRatio('nope', '#ffffff')).toBeNull();
  });

  it('is symmetric and delegates luminance', () => {
    const ab = contrastRatio('#10B981', '#050B0A')!;
    const ba = contrastRatio('#050B0A', '#10B981')!;
    expect(ab).toBeCloseTo(ba, 6);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 3);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 3);
    expect(relativeLuminance('nope')).toBeNull();
  });

  it('badges normal-text thresholds', () => {
    expect(wcagBadge(21)).toBe('AAA');
    expect(wcagBadge(7)).toBe('AAA');
    expect(wcagBadge(4.5)).toBe('AA');
    expect(wcagBadge(3)).toBe('AA Large');
    expect(wcagBadge(2.9)).toBe('Fail');
    expect(wcagBadge(null)).toBeNull();
  });
});
