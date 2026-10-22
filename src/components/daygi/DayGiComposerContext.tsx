import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Users, Minus, Plus, X } from 'lucide-react';
import { useConciergeT } from './useConciergeT';
import { toISODate, formatDateRange } from '../../shared/daygiTravelDates';

/**
 * Composer context chips: travel dates + traveler count, TripAdvisor-style.
 * The date picker is a simple native two-month calendar; the traveler
 * counter is a stepper. Both feed the query context server-side so Gemini
 * and the reasoning pipeline can personalize (price per person, date-aware
 * recommendations, group-only offers).
 *
 * The state lives in the parent (DayGiConciergeView) so it persists across
 * messages. This component is a pure view + callbacks.
 */

export interface DayGiComposerContextProps {
  lang: 'en' | 'ar';
  travelDates: { start: string; end: string } | null;
  travelersCount: number;
  onDatesChange: (dates: { start: string; end: string } | null) => void;
  onTravelersChange: (count: number) => void;
}

export function DayGiComposerContext({
  lang,
  travelDates,
  travelersCount,
  onDatesChange,
  onTravelersChange
}: DayGiComposerContextProps) {
  // Follows the concierge's in-page language toggle via the `lang` prop,
  // not the site language.
  const t = useConciergeT(lang);
  const [dateOpen, setDateOpen] = useState(false);
  const [pickStart, setPickStart] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close date picker on outside click
  useEffect(() => {
    if (!dateOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDateOpen(false);
        setPickStart(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [dateOpen]);

  const handleDayClick = (iso: string) => {
    if (!pickStart) {
      setPickStart(iso);
      return;
    }
    if (iso < pickStart) {
      onDatesChange({ start: iso, end: pickStart });
    } else {
      onDatesChange({ start: pickStart, end: iso });
    }
    setPickStart(null);
    setDateOpen(false);
  };

  const clearDates = () => {
    onDatesChange(null);
    setPickStart(null);
  };

  // Build a simple 2-month grid
  const today = new Date();
  const months: Array<{ year: number; month: number; days: Array<{ iso: string; day: number; disabled: boolean } | null> }> = [];
  for (let m = 0; m < 2; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
    const days: Array<{ iso: string; day: number; disabled: boolean } | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        iso: toISODate(date),
        day,
        disabled: date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
      });
    }
    months.push({ year, month, days });
  }

  const isSelected = (iso: string) => {
    if (!travelDates) return false;
    return iso >= travelDates.start && iso <= travelDates.end;
  };

  const isPickStart = (iso: string) => pickStart === iso;

  return (
    <div className="flex items-center gap-1.5 flex-wrap" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Date chip */}
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setDateOpen(v => !v)}
          aria-haspopup="dialog"
          aria-expanded={dateOpen}
          className="dg-focus h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 bg-[var(--dg-tint)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)]"
        >
          <CalendarDays className="w-3 h-3" aria-hidden="true" />
          {travelDates
            ? formatDateRange(travelDates.start, travelDates.end, lang)
            : t('daygi.datesChip')}
        </button>
        {travelDates && (
          <button
            type="button"
            onClick={clearDates}
            aria-label={t('daygi.datesClear')}
            className="dg-focus ms-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[var(--dg-muted)] hover:text-[var(--dg-text)]"
          >
            <X className="w-2.5 h-2.5" aria-hidden="true" />
          </button>
        )}

        {dateOpen && (
          <div
            role="dialog"
            aria-label={t('daygi.datesChip')}
            className="absolute bottom-full mb-2 z-40 bg-[var(--dg-panel)] border border-[var(--dg-line)] rounded-xl shadow-2xl p-3 w-[280px]"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--dg-muted)] pb-2">
              {pickStart ? t('daygi.datesPickEnd') : t('daygi.datesPickStart')}
            </p>
            {months.map((m, mi) => (
              <div key={mi} className="mb-3 last:mb-0">
                <p className="text-[11px] font-bold text-[var(--dg-text)] pb-1">
                  {new Date(m.year, m.month, 1).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {(lang === 'ar'
                    ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
                    : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                  ).map((d, i) => (
                    <span key={i} className="text-[9px] text-[var(--dg-muted)] text-center py-0.5">{d}</span>
                  ))}
                  {m.days.map((day, i) =>
                    day ? (
                      <button
                        key={i}
                        type="button"
                        disabled={day.disabled}
                        onClick={() => handleDayClick(day.iso)}
                        className={`dg-focus w-7 h-7 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-25 ${
                          isPickStart(day.iso)
                            ? 'bg-[var(--dg-teal)] text-[var(--dg-gold-ink)]'
                            : isSelected(day.iso)
                              ? 'bg-[var(--dg-tint-2)] text-[var(--dg-text)]'
                              : 'text-[var(--dg-text-2)] hover:bg-[var(--dg-tint)]'
                        }`}
                      >
                        {day.day}
                      </button>
                    ) : (
                      <span key={i} />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Traveler counter chip */}
      <div className="inline-flex items-center gap-0.5 bg-[var(--dg-tint)] rounded-full h-7 px-1">
        <button
          type="button"
          onClick={() => onTravelersChange(Math.max(1, travelersCount - 1))}
          disabled={travelersCount <= 1}
          aria-label={t('daygi.travelersMinus')}
          className="dg-focus w-5 h-5 rounded-full flex items-center justify-center text-[var(--dg-text-2)] hover:text-[var(--dg-text)] disabled:opacity-30"
        >
          <Minus className="w-3 h-3" aria-hidden="true" />
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--dg-text)] px-1 min-w-[36px] justify-center">
          <Users className="w-3 h-3" aria-hidden="true" />
          <span className="dg-num">{travelersCount}</span>
        </span>
        <button
          type="button"
          onClick={() => onTravelersChange(Math.min(12, travelersCount + 1))}
          disabled={travelersCount >= 12}
          aria-label={t('daygi.travelersPlus')}
          className="dg-focus w-5 h-5 rounded-full flex items-center justify-center text-[var(--dg-text-2)] hover:text-[var(--dg-text)] disabled:opacity-30"
        >
          <Plus className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
