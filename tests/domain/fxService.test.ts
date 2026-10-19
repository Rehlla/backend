import { describe, it, expect } from 'vitest';
import { getFxRates, DISPLAY_CURRENCIES } from '../../server/services/fxService';

describe('display currency rates', () => {
  it('serves every display currency with EGP pinned to 1 and flags defaults as indicative', () => {
    const fx = getFxRates({} as NodeJS.ProcessEnv);
    expect(fx.base).toBe('EGP');
    expect(fx.egpPerUnit.EGP).toBe(1);
    for (const c of DISPLAY_CURRENCIES) expect(fx.egpPerUnit[c]).toBeGreaterThan(0);
    expect(fx.indicative).toBe(true);
  });

  it('takes valid operator overrides and ignores junk', () => {
    const fx = getFxRates({
      FX_RATES_EGP_PER_UNIT: JSON.stringify({ USD: 50, EUR: -3, GBP: 'x', EGP: 9 }),
      FX_RATES_AS_OF: '2026-10-07',
    } as unknown as NodeJS.ProcessEnv);
    expect(fx.egpPerUnit.USD).toBe(50);
    expect(fx.egpPerUnit.EUR).toBeGreaterThan(0);
    expect(fx.egpPerUnit.EUR).not.toBe(-3);
    expect(fx.egpPerUnit.EGP).toBe(1);
    expect(fx.asOf).toBe('2026-10-07');
  });

  it('falls back to defaults on malformed JSON', () => {
    const fx = getFxRates({ FX_RATES_EGP_PER_UNIT: '{nope' } as unknown as NodeJS.ProcessEnv);
    expect(fx.egpPerUnit.USD).toBeGreaterThan(0);
  });
});
