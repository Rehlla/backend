/**
 * Locale-aware display formatting for Dahab.
 *
 * P1-16: the UI mixed Arabic-Indic and Western digits, and printed "EGP" inside
 * the Arabic UI. One system is enforced here instead of being re-derived at
 * every call site:
 *   - digits are always Western (0-9). They are far easier to scan in prices,
 *     phone numbers and booking references, and `ar-EG-u-nu-latn` makes them
 *     render LTR-correctly inside Arabic sentences.
 *   - the currency reads "16,500 ج.م" in Arabic and "EGP 16,500" in English, so
 *     "EGP" never leaks into the Arabic UI.
 */

/** Western digits regardless of locale, so prices/phone numbers stay scannable. */
export const toWesternDigits = (value: string | number): string =>
  String(value).replace(/[٠-٩۰-۹]/g, d => {
    const code = d.charCodeAt(0);
    // Arabic-Indic U+0660.. and Extended Arabic-Indic U+06F0..
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });

export type CurrencyCode = 'EGP' | 'USD' | 'EUR';

const CURRENCY_LABEL: Record<'ar' | 'en', Record<CurrencyCode, string>> = {
  ar: { EGP: 'ج.م', USD: '$', EUR: '€' },
  en: { EGP: 'EGP', USD: 'USD', EUR: 'EUR' },
};

/**
 * Formats a price with Western digits in both languages.
 *
 * Arabic puts the currency after the number, which reads naturally right-to-left
 * and avoids the "16,500 EGP" bidi mess.
 */
export function formatPrice(
  amount: number,
  language: 'ar' | 'en',
  currency: CurrencyCode = 'EGP'
): string {
  const grouped = toWesternDigits(
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)
  );
  const label = CURRENCY_LABEL[language][currency];
  return language === 'ar' ? `${grouped} ${label}` : `${label} ${grouped}`;
}

/** Formats a date with Western digits via Intl, per P1-16. */
export function formatDate(
  date: Date | string,
  language: 'ar' | 'en',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  // ar-EG-u-nu-latn forces the latn numbering system inside Arabic, so the
  // month name stays Arabic while the digits stay Western.
  return toWesternDigits(
    new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn', options).format(d)
  );
}