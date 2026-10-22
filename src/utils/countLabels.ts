/**
 * Counted nouns in both languages. Arabic agrees with the number — one, two,
 * a few (3–10) and many each take their own form — so "{n} days" cannot be a
 * single template string.
 */

type Lang = 'en' | 'ar';

function countLabel(n: number, language: Lang, en: [string, string], ar: [string, string, string, string]): string {
  if (language === 'en') return `${n} ${n === 1 ? en[0] : en[1]}`;
  if (n === 1) return ar[0];
  if (n === 2) return ar[1];
  return n <= 10 ? `${n} ${ar[2]}` : `${n} ${ar[3]}`;
}

export const daysLabel = (n: number, language: Lang) =>
  countLabel(n, language, ['day', 'days'], ['يوم واحد', 'يومان', 'أيام', 'يومًا']);

export const travelersLabel = (n: number, language: Lang) =>
  countLabel(n, language, ['traveler', 'travelers'], ['مسافر واحد', 'مسافران', 'مسافرين', 'مسافرًا']);
