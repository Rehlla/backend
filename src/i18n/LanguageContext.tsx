import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { interpolate } from './interpolate';
import { ensureDictionarySync, getInstalledView, translateFrom, type I18nLang } from './translator';
import { getBootLanguage } from './boot';
import { api } from '@/services/api';
import type { DictView, TVars } from './resolve';

interface LanguageContextType {
  language: I18nLang;
  isRTL: boolean;
  setLanguage: (lang: I18nLang) => void;
  toggleLanguage: () => void;
  t: {
    (key: string): string;
    (key: string, fallback?: string): string;
    (key: string, vars: TVars, fallback?: string): string;
  };
  /** Format a number with proper locale (Arabic-Indic numerals in AR) */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Format EGP amount with currency suffix */
  formatEGP: (amount: number) => string;
  /** Format a date with proper locale */
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  /** Short date (e.g., "18 Oct" / "١٨ أكتوبر") */
  formatShortDate: (date: Date | string) => string;
  /** Long date with weekday */
  formatLongDate: (date: Date | string) => string;
  /** Date with time (e.g., "18 Oct, 09:30") */
  formatDateTime: (date: Date | string) => string;
  /** Relative time (e.g., "in 2 hours" / "خلال ساعتان") */
  formatRelative: (date: Date | string) => string;
  /** Format price with EGP suffix */
  formatPrice: (amount: number) => string;
  /** Format count */
  formatCount: (count: number) => string;
}

const emptyLanguageContext: LanguageContextType = {
  language: 'ar',
  isRTL: true,
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string) => key,
  formatNumber: (value: number) => value.toString(),
  formatEGP: (amount: number) => `${amount} EGP`,
  formatDate: (date: Date | string) => String(date),
  formatShortDate: (date: Date | string) => String(date),
  formatLongDate: (date: Date | string) => String(date),
  formatDateTime: (date: Date | string) => String(date),
  formatRelative: (date: Date | string) => `منذ ${new Date(date).toLocaleDateString()}`,
  formatPrice: (amount: number) => `${amount} EGP`,
  formatCount: (count: number) => count.toString(),
};

const LanguageContext = createContext<LanguageContextType>(emptyLanguageContext);

type StringOverrides = Record<string, { en: string; ar: string }>;

const STRINGS_CACHE_KEY = 'dahab_strings_bundle_v1';

function readCachedBundle(): { version: string; strings: StringOverrides } | null {
  try {
    const raw = localStorage.getItem(STRINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.version !== 'string' || typeof parsed?.strings !== 'object' || !parsed.strings) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Views kept for the synchronous switch path (see below). The boot language's
 * view is guaranteed installed by main.tsx BEFORE App is imported; the other
 * view is filled by the idle preload and makes EN available as the
 * cross-language fallback and AR switches instant.
 */
const views: { [K in I18nLang]: DictView | undefined } = { en: undefined, ar: undefined };

function rememberView(lang: I18nLang): DictView | undefined {
  const view = getInstalledView(lang);
  if (view) views[lang] = view;
  return views[lang];
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // main.tsx already decided the boot language (and installed its dictionary)
  // through boot.ts; reusing getBootLanguage() here means both sites agree by
  // construction instead of re-reading storage with a second decision tree.
  const [language, setLanguageState] = useState<I18nLang>(() => getBootLanguage());

  // Dashboard-published copy overrides (merged over compiled defaults by t()).
  // Loaded lazily so first paint never waits on it; the cached bundle applies
  // synchronously on the next visit.
  const [overrides, setOverrides] = useState<StringOverrides>(() => readCachedBundle()?.strings || {});

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedBundle();
    const params = cached?.version ? { v: cached.version } : {};
    api.getStrings(params)
      .then(data => {
        if (cancelled || !data) return;
        if (data.unchanged) return;
        const strings = (data.strings || {}) as StringOverrides;
        setOverrides(strings);
        try {
          localStorage.setItem(STRINGS_CACHE_KEY, JSON.stringify({ version: data.version, strings }));
        } catch {
          // Storage full or blocked — the live bundle is already in state.
        }
      })
      .catch(() => {
        // Offline or server unreachable: compiled defaults + cache still render.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isRTL = language === 'ar';

  // Format utilities — memoized per language switch
  const formatNumber = useMemo(
    () => (value: number, options?: Intl.NumberFormatOptions) => {
      if (!Number.isFinite(value)) return '—';
      return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        ...options,
      }).format(value);
    },
    [language]
  );

  const formatEGP = useMemo(
    () => (amount: number) => {
      if (!Number.isFinite(amount)) return language === 'ar' ? '— ج.م' : '— EGP';
      const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
      return language === 'ar' ? `${formatted} ج.م` : `EGP ${formatted}`;
    },
    [language]
  );

  const formatDate = useMemo(
    () => (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '—';
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...options,
      }).format(dateObj);
    },
    [language]
  );

  const formatShortDate = useMemo(
    () => (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '—';
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        day: 'numeric',
        month: 'short',
      }).format(dateObj);
    },
    [language]
  );

  const formatLongDate = useMemo(
    () => (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '—';
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dateObj);
    },
    [language]
  );

  const formatDateTime = useMemo(
    () => (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '—';
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dateObj);
    },
    [language]
  );

  const formatRelative = useMemo(
    () => (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '—';
      const rtf = new Intl.RelativeTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { numeric: 'auto' });
      const diffMs = new Date(date).getTime() - Date.now();
      const diffSec = Math.round(diffMs / 1000);
      const diffMin = Math.round(diffSec / 60);
      const diffHour = Math.round(diffMin / 60);
      const diffDay = Math.round(diffHour / 24);
      
      if (Math.abs(diffSec) < 45) return language === 'ar' ? 'الآن' : 'now';
      if (Math.abs(diffMin) < 45) return new Intl.RelativeTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { numeric: 'auto' }).format(diffMin, 'minute');
      if (Math.abs(diffHour) < 24) return new Intl.RelativeTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { numeric: 'auto' }).format(diffHour, 'hour');
      return new Intl.RelativeTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { numeric: 'auto' }).format(diffDay, 'day');
    },
    [language]
  );

  const formatPrice = useMemo(
    () => (amount: number) => {
      if (!Number.isFinite(amount)) return language === 'ar' ? '— ج.م' : '— EGP';
      const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
      return language === 'ar' ? `${formatted} ج.م` : `EGP ${formatted}`;
    },
    [language]
  );

  const formatCount = useMemo(
    () => (count: number) => {
      if (!Number.isFinite(count)) return '—';
      return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(count);
    },
    [language]
  );

  // Capture the installed view for the current language (mount + switches).
  // After a switch to the other language this picks up the idle-preloaded
  // view, so the NEXT switch back is synchronous. Runs after render on
  // purpose: reading the registry here, not during it.
  useEffect(() => {
    rememberView(language);
  }, [language]);

  const applyLanguageAttributes = (lang: I18nLang) => {
    const isArabic = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    if (isArabic) {
      document.documentElement.classList.add('rtl');
      document.documentElement.classList.remove('ltr');
    } else {
      document.documentElement.classList.add('ltr');
      document.documentElement.classList.remove('rtl');
    }
  };

  useEffect(() => {
    applyLanguageAttributes(language);
    try {
      localStorage.setItem('dahab_os_lang', language);
    } catch {
      // ignore
    }
  }, [language]);

  /**
   * Switches install the target dictionary SYNCHRONOUSLY inside the state
   * updater: the idle preload has already loaded the other language's view
   * (held in `views`), so the toggle commit re-renders from a fully installed
   * dictionary — a missing string can never be visible for a frame. If the
   * view is somehow absent (preload cancelled before a rapid toggle), the
   * switch still happens; t() then degrades to the per-call fallback / EN
   * cross-language fallback and the preload's setDictionary lands before the
   * next paint via the context-value change.
   */
  const setLanguage = (lang: I18nLang) => {
    setLanguageState((prev) => {
      const view = views[lang];
      if (view) ensureDictionarySync(lang, view);
      return lang;
    });
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      const view = views[next];
      if (view) ensureDictionarySync(next, view);
      return next;
    });
  };

  const t = useCallback(
    (key: string, arg2?: TVars | string, arg3?: string): string => {
      // Dashboard override wins over the compiled default in both languages.
      // An override is the editor's explicit value, so it also wins over the
      // per-call fallback string.
      const override = overrides[key]?.[language];
      if (override) {
        if (typeof arg2 === 'object') return interpolate(override, arg2);
        return override;
      }
      // Registry-backed resolution: active language's view with the EN view
      // (when installed) as the cross-language fallback — same contract as
      // the compiled translate(), from per-language data.
      const active = rememberView(language);
      const enView = language === 'en' ? active : rememberView('en');
      if (typeof arg2 === 'object') {
        return translateFrom(active, enView, key, language, arg2, arg3);
      }
      return translateFrom(
        active,
        enView,
        key,
        language,
        undefined,
        typeof arg2 === 'string' ? arg2 : undefined
      );
    },
    [language, overrides]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        isRTL,
        setLanguage,
        toggleLanguage,
        t,
        formatNumber,
        formatEGP,
        formatDate,
        formatShortDate,
        formatLongDate,
        formatDateTime,
        formatRelative,
        formatPrice,
        formatCount,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
