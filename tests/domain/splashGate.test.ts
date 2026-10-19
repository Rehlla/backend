import { describe, expect, it } from 'vitest';
import { SPLASH_IMAGES, SPLASH_SEEN_KEY } from '../../src/components/splash/DahabSplash';
import { EN_VIEW, AR_VIEW } from '../../src/i18n/translations';

/**
 * Splash gate — non-browser guarantees.
 *
 * The component module must be importable with no window/document (server and
 * node test environments evaluate it), the asset list must stay at 6 curated
 * real paths, and every user-visible splash string must exist in BOTH
 * language views (the client resolves via t(), never raw keys).
 */
describe('splash gate (domain)', () => {
  it('keeps a 6-image sequence of app-relative asset paths', () => {
    expect(SPLASH_IMAGES).toHaveLength(6);
    expect(new Set(SPLASH_IMAGES).size).toBe(6);
    for (const src of SPLASH_IMAGES) {
      expect(src.startsWith('/images/')).toBe(true);
    }
  });

  it('uses a stable sessionStorage key shared with App', () => {
    expect(SPLASH_SEEN_KEY).toBe('dahab_splash_seen');
  });

  it('has EN + AR copy for every splash key', () => {
    for (const key of ['splash.eyebrow', 'splash.title', 'splash.subtitle', 'splash.scroll', 'splash.enter', 'splash.skip']) {
      expect(EN_VIEW[key], `missing EN: ${key}`).toBeTruthy();
      expect(AR_VIEW[key], `missing AR: ${key}`).toBeTruthy();
      expect(EN_VIEW[key]).not.toBe(key);
      expect(AR_VIEW[key]).not.toBe(key);
    }
  });
});
