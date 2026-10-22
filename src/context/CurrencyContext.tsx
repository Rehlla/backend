import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type FxRatesWire } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * Display currency (plan §09). Everything is priced and charged in EGP; a
 * visitor additionally sees the amount in their own currency, marked "≈"
 * while rates are indicative. The traveler picks the currency in Account;
 * until then it is guessed from the browser locale.
 */

export const DISPLAY_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'RUB'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

const STORAGE_KEY = 'dahab_display_currency';

/** Indicative fallback so the first paint can already show "≈ $29". */
const FALLBACK: FxRatesWire = {
  base: 'EGP',
  egpPerUnit: { EGP: 1, USD: 48.5, EUR: 56.4, GBP: 65.2, SAR: 12.9, AED: 13.2, RUB: 0.6 },
  asOf: '2026-10-01',
  indicative: true,
};

export function guessCurrency(locale: string | undefined): DisplayCurrency {
  const l = (locale || '').toLowerCase();
  if (l.startsWith('ar-sa')) return 'SAR';
  if (l.startsWith('ar-ae')) return 'AED';
  if (l.startsWith('ar')) return 'EGP';
  if (l.startsWith('ru')) return 'RUB';
  if (l === 'en-gb' || l.startsWith('en-gb')) return 'GBP';
  if (/^(de|fr|it|es|nl|pt|pl|cs|sk|fi|el|at|be|ie)/.test(l)) return 'EUR';
  if (l.startsWith('en')) return 'USD';
  return 'USD';
}

interface FormatOptions {
  /** Force a currency instead of the traveler's choice. */
  currency?: DisplayCurrency;
  /** Compact form for map pins: 1.4K. */
  compact?: boolean;
}

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  rates: FxRatesWire;
  /** Converts an EGP amount into the display currency (no formatting). */
  convert: (amountEGP: number, to?: DisplayCurrency) => number;
  /** "EGP 1,400" — always the charged amount. */
  formatEGP: (amountEGP: number, opts?: { compact?: boolean }) => string;
  /** "$29" / "29 €" — the converted amount, or null when currency is EGP. */
  formatDisplay: (amountEGP: number, opts?: FormatOptions) => string | null;
  /** True while rates are not live: the UI prefixes converted amounts with "≈". */
  approximate: boolean;
}

const emptyCurrencyContext: CurrencyContextValue = {
  currency: 'EGP',
  setCurrency: () => {},
  rates: FALLBACK,
  convert: (amountEGP: number) => amountEGP,
  formatEGP: (amountEGP: number) => `${amountEGP} EGP`,
  formatDisplay: (amountEGP: number) => null,
  approximate: true,
};

const CurrencyContext = createContext<CurrencyContextValue>(emptyCurrencyContext);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language } = useLanguage();
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as DisplayCurrency | null;
      if (saved && (DISPLAY_CURRENCIES as readonly string[]).includes(saved)) return saved;
    } catch {
      // storage blocked: fall through to the locale guess
    }
    return guessCurrency(typeof navigator !== 'undefined' ? navigator.language : undefined);
  });
  const [rates, setRates] = useState<FxRatesWire>(FALLBACK);

  useEffect(() => {
    const ctrl = new AbortController();
    api.getFxRates(ctrl.signal).then(setRates).catch(() => {
      // Offline or older server: the indicative fallback stands.
    });
    return () => ctrl.abort();
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // per-run choice only
    }
  }, []);

  // Western digits in both languages (the convention for prices in Egypt);
  // the locale only decides symbol placement and grouping.
  const numberLocale = language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';

  const value = useMemo<CurrencyContextValue>(() => {
    const convert = (amountEGP: number, to: DisplayCurrency = currency) => {
      const perUnit = rates.egpPerUnit[to] || FALLBACK.egpPerUnit[to] || 1;
      return amountEGP / perUnit;
    };
    const fmt = (amount: number, code: DisplayCurrency, compact?: boolean) => {
      try {
        return new Intl.NumberFormat(numberLocale, {
          style: 'currency',
          currency: code,
          currencyDisplay: code === 'EGP' ? 'code' : 'narrowSymbol',
          maximumFractionDigits: code === 'EGP' || amount >= 100 ? 0 : 2,
          minimumFractionDigits: 0,
          notation: compact ? 'compact' : 'standard',
        }).format(amount);
      } catch {
        return `${code} ${Math.round(amount).toLocaleString('en-US')}`;
      }
    };
    return {
      currency,
      setCurrency,
      rates,
      convert,
      approximate: rates.indicative,
      formatEGP: (amountEGP, opts) => fmt(amountEGP, 'EGP', opts?.compact),
      formatDisplay: (amountEGP, opts) => {
        const code = opts?.currency ?? currency;
        if (code === 'EGP') return null;
        return fmt(convert(amountEGP, code), code, opts?.compact);
      },
    };
  }, [currency, setCurrency, rates, numberLocale]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextValue => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
};
