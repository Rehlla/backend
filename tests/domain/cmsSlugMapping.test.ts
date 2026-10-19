import { describe, it, expect } from 'vitest';
import { canonicalProgrammeKey } from '../../src/hooks/useReadyProgrammes';

describe('canonicalProgrammeKey', () => {
  it('normalizes the CMS-seeded dahab-* spelling to its suffix', () => {
    expect(canonicalProgrammeKey('dahab-first-timer')).toBe('first-timer');
    expect(canonicalProgrammeKey('dahab-adventure')).toBe('adventure');
  });

  it('normalizes the legacy programme-* spelling', () => {
    expect(canonicalProgrammeKey('programme-first-timer')).toBe('first-timer');
    expect(canonicalProgrammeKey('programme-slow-dahab')).toBe('slow-dahab');
  });

  it('passes a bare, unprefixed slug through (the seeded couples-escape)', () => {
    expect(canonicalProgrammeKey('couples-escape')).toBe('couples-escape');
  });

  it('normalizes the served feed ids, including the bare Couples Escape id', () => {
    // The served feed is prefixed for four programmes ("dahab-first-timer")
    // and bare for Couples Escape ("couples-escape") — both normalize to the
    // same key space, which is the whole point of the canonical key.
    expect(canonicalProgrammeKey('dahab-couples-escape')).toBe(
      canonicalProgrammeKey('couples-escape')
    );
    expect(canonicalProgrammeKey('dahab-first-timer')).toBe(
      canonicalProgrammeKey('programme-first-timer')
    );
  });

  it('returns null for empty values; unrelated slugs just match nothing', () => {
    expect(canonicalProgrammeKey('')).toBeNull();
    expect(canonicalProgrammeKey(null)).toBeNull();
    expect(canonicalProgrammeKey(undefined)).toBeNull();
    expect(canonicalProgrammeKey('faq')).toBe('faq'); // harmless: matches no programme
  });

  it('strips exactly one prefix (no dahab-dahab collapse)', () => {
    // A seeded "dahab-dahab-x" keeps its first segment — the regex strips
    // exactly one prefix occurrence, never two.
    expect(canonicalProgrammeKey('dahab-dahab-x')).toBe('dahab-x');
  });
});
