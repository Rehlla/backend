import { describe, it, expect } from 'vitest';
import { localizeInterest } from '../../src/i18n/interests';

describe('localizeInterest', () => {
  it('leaves English copy untouched', () => {
    expect(localizeInterest('Diving', 'en')).toBe('Diving');
    expect(localizeInterest('Lagoon Chill', 'en')).toBe('Beach & Relax');
  });

  it('renders the taxonomy Arabic in the Arabic UI', () => {
    expect(localizeInterest('Diving', 'ar')).toBe('غطس وسكوبا');
    expect(localizeInterest('Adventure', 'ar')).toBe('مغامرة وكانيونز');
    expect(localizeInterest('Food', 'ar')).toBe('أكل ومطاعم');
  });

  it('normalizes every known free phrasing onto the taxonomy', () => {
    expect(localizeInterest('Diving & Marine', 'ar')).toBe('غطس وسكوبا');
    expect(localizeInterest('Diving & Red Sea reefs', 'ar')).toBe('غطس وسكوبا');
    expect(localizeInterest('Lagoon Chill', 'ar')).toBe('بحر وراحة بال');
    expect(localizeInterest('Bedouin culture & heritage', 'ar')).toBe('حياة دهب وأهلها');
    expect(localizeInterest('Seafood & local food', 'ar')).toBe('أكل ومطاعم');
  });

  it('passes unknown strings through rather than inventing Arabic', () => {
    expect(localizeInterest('Kitesurfing', 'ar')).toBe('Kitesurfing');
  });
});
