/**
 * Display currency rates (plan §09: "price in your currency, charged in EGP").
 *
 * Every amount the platform stores and charges is EGP. These rates exist only
 * so a visitor from Berlin or Riyadh can read "≈ €25" next to "EGP 1,400";
 * they never touch checkout, the ledger or payouts, and the UI always says
 * the charge happens in EGP.
 *
 * Source: FX_RATES_EGP_PER_UNIT (JSON, EGP per one unit of each currency,
 * maintained by operations), else the compiled indicative defaults below.
 * `indicative` stays true until a live rates feed is wired, and the client
 * shows "≈" whenever it is.
 */

export const DISPLAY_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'RUB'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** EGP per one unit. Indicative values; refresh via env, not code. */
const DEFAULT_EGP_PER_UNIT: Record<DisplayCurrency, number> = {
  EGP: 1,
  USD: 48.5,
  EUR: 56.4,
  GBP: 65.2,
  SAR: 12.9,
  AED: 13.2,
  RUB: 0.6,
};

const DEFAULT_AS_OF = '2026-10-01';

export interface FxRates {
  base: 'EGP';
  /** EGP per one unit of the currency. */
  egpPerUnit: Record<DisplayCurrency, number>;
  asOf: string;
  indicative: boolean;
}

function parseEnvRates(raw: string | undefined): Partial<Record<DisplayCurrency, number>> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const out: Partial<Record<DisplayCurrency, number>> = {};
    for (const code of DISPLAY_CURRENCIES) {
      const v = parsed[code];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[code] = v;
    }
    return out;
  } catch {
    return null;
  }
}

export function getFxRates(env: NodeJS.ProcessEnv = process.env): FxRates {
  const fromEnv = parseEnvRates(env.FX_RATES_EGP_PER_UNIT);
  return {
    base: 'EGP',
    egpPerUnit: { ...DEFAULT_EGP_PER_UNIT, ...(fromEnv || {}), EGP: 1 },
    asOf: (fromEnv && env.FX_RATES_AS_OF) || DEFAULT_AS_OF,
    indicative: env.FX_RATES_LIVE !== 'true',
  };
}
