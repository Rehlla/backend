import { describe, it, expect } from 'vitest';
import { scrimOpacityFromConfig, clampScrimOpacity } from '../../src/utils/heroOverlay';
import { sanitizeHomepageConfig } from '../../server/services/contentService';

describe('hero overlay control', () => {
  describe('scrimOpacityFromConfig (dashboard 0–100 → CSS 0–1)', () => {
    it('defaults to full scrims when unset or garbage', () => {
      expect(scrimOpacityFromConfig(undefined)).toBe(1);
      expect(scrimOpacityFromConfig(null)).toBe(1);
      expect(scrimOpacityFromConfig({})).toBe(1);
      expect(scrimOpacityFromConfig({ overlay_opacity: 'nonsense' })).toBe(1);
    });

    it('converts and clamps the authored percentage', () => {
      expect(scrimOpacityFromConfig({ overlay_opacity: 100 })).toBe(1);
      expect(scrimOpacityFromConfig({ overlay_opacity: 0 })).toBe(0);
      expect(scrimOpacityFromConfig({ overlay_opacity: 65 })).toBeCloseTo(0.65, 6);
      expect(scrimOpacityFromConfig({ overlay_opacity: 250 })).toBe(1);
      expect(scrimOpacityFromConfig({ overlay_opacity: -20 })).toBe(0);
      expect(scrimOpacityFromConfig({ overlay_opacity: '40' })).toBeCloseTo(0.4, 6);
    });
  });

  describe('clampScrimOpacity (component-level guard)', () => {
    it('passes valid values through and rescues the rest', () => {
      expect(clampScrimOpacity(0.5)).toBe(0.5);
      expect(clampScrimOpacity(undefined)).toBe(1);
      expect(clampScrimOpacity(NaN)).toBe(1);
      expect(clampScrimOpacity(7)).toBe(1);
      expect(clampScrimOpacity(-2)).toBe(0);
    });
  });

  describe('sanitizeHomepageConfig (server-side clamp)', () => {
    it('clamps hero overlay_opacity to integer 0–100', () => {
      expect(sanitizeHomepageConfig('hero', { overlay_opacity: 65.7, badge_en: 'X' }))
        .toEqual({ overlay_opacity: 66, badge_en: 'X' });
      expect(sanitizeHomepageConfig('hero', { overlay_opacity: 999 })!.overlay_opacity).toBe(100);
      expect(sanitizeHomepageConfig('hero', { overlay_opacity: -5 })!.overlay_opacity).toBe(0);
      expect(sanitizeHomepageConfig('hero', { overlay_opacity: 'garbage' })!.overlay_opacity).toBe(100);
    });

    it('leaves other sections and non-object configs alone', () => {
      const stats = { items: [1, 2] };
      expect(sanitizeHomepageConfig('stats', stats)).toEqual(stats);
      expect(sanitizeHomepageConfig('hero', { badge_en: 'X' })).toEqual({ badge_en: 'X' });
      expect(sanitizeHomepageConfig('hero', undefined)).toBeUndefined();
      expect(sanitizeHomepageConfig('hero', 'raw-string')).toBeUndefined();
      expect(sanitizeHomepageConfig('hero', [1])).toBeUndefined();
    });
  });
});
