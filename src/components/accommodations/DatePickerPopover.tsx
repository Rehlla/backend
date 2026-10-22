import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const nightsLabel = (n: number, l: 'ar' | 'en') =>
  l === 'ar'
    ? n === 1
      ? 'ليلة واحدة'
      : n === 2
      ? 'ليلتين'
      : n >= 3 && n <= 10
      ? `${n} لياليا`
      : `${n} ليلة`
    : n === 1
    ? '1 night'
    : `${n} nights`.replace('{n}', String(n));

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysISO(s: string, days: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffNights(checkIn: string, checkOut: string): number {
  return Math.round((parseISODate(checkOut).getTime() - parseISODate(checkIn).getTime()) / 86400000);
}

interface DatePickerPopoverProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  onClose: () => void;
}

/**
 * Range datepicker flyout for the stay booking card. Theme-token styled so
 * it adapts to all six Dahab themes (no hardcoded dark/light surfaces).
 * Click sets check-in, a second click sets check-out (auto-swapped when
 * earlier); a third click restarts the range. Past dates are disabled.
 */
export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  checkIn,
  checkOut,
  onChange,
  onClose,
}) => {
  const { language, t, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const locale = isAr ? 'ar-EG' : 'en-US';

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [viewYear, setViewYear] = useState(() => parseISODate(checkIn).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseISODate(checkIn).getMonth());
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nights = diffNights(checkIn, checkOut);

  const weeks = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    // Monday-first columns; offset for the weekday of the 1st.
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(viewYear, viewMonth, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth]);

  const weekdayNames = useMemo(() => {
    // 2026-09-14 is a Monday; take 7 consecutive short names.
    return Array.from({ length: 7 }, (_, i) =>
      new Date(2026, 8, 14 + i).toLocaleDateString(locale, { weekday: 'narrow' })
    );
  }, [locale]);

  const stepMonth = (dir: 1 | -1) => {
    const next = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const pick = (iso: string) => {
    if (iso < todayISO) return;
    if (checkIn === checkOut || iso <= checkIn) {
      // Fresh range (or clicked on/before check-in): restart from this day.
      onChange(iso, addDaysISO(iso, 1));
    } else {
      onChange(checkIn, iso);
    }
  };

  const fmtShort = (iso: string) =>
    parseISODate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const caption = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-label={t('hotels.bookingSelectDates')}
      tabIndex={-1}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="absolute start-0 end-0 top-full z-30 mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-[var(--text-primary)] shadow-[0_8px_28px_rgba(0,0,0,0.28)] outline-none"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          aria-label={isAr ? 'الشهر السابق' : 'Previous month'}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--btn-util-hover)] hover:text-[var(--text-primary)]"
        >
          <ChevronLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
        <span className="text-sm font-semibold">{caption}</span>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          aria-label={isAr ? 'الشهر التالي' : 'Next month'}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--btn-util-hover)] hover:text-[var(--text-primary)]"
        >
          <ChevronRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center" role="row">
        {weekdayNames.map((w, i) => (
          <span key={i} className="py-1 text-[11px] font-medium text-[var(--text-secondary)]">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.flat().map((iso, i) => {
          if (!iso) return <span key={`e${i}`} />;
          const disabled = iso < todayISO;
          const isIn = iso === checkIn;
          const isOut = iso === checkOut;
          const isMid = iso > checkIn && iso < checkOut;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => pick(iso)}
              aria-label={parseISODate(iso).toLocaleDateString(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              aria-pressed={isIn || isOut}
              className={`flex h-9 cursor-pointer items-center justify-center text-[13px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-30 ${
                isIn || isOut
                  ? 'rounded-full bg-[var(--accent-primary)] font-bold text-[var(--accent-primary-ink)]'
                  : isMid
                    ? 'bg-[var(--accent-primary)]/15 font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-primary)]/25'
                    : 'rounded-full font-normal text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)]'
              }`}
            >
              {parseISODate(iso).getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-secondary)]">
            {t('hotels.bookingCheckIn')}:{' '}
            <span className="font-semibold text-[var(--text-primary)]">{fmtShort(checkIn)}</span>
          </span>
          <span className="text-[var(--text-secondary)]">
            {t('hotels.bookingCheckOut')}:{' '}
            <span className="font-semibold text-[var(--text-primary)]">{fmtShort(checkOut)}</span>
          </span>
        </div>
        {nights > 0 && (
          <span className="block rounded-full bg-[var(--accent-primary)] px-2.5 py-1 text-center text-[11px] font-bold text-[var(--accent-primary-ink)]">
            {nightsLabel(nights, language === 'ar' ? 'ar' : 'en')}
          </span>
        )}
      </div>
    </div>
  );
};
