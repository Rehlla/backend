import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';

/**
 * A month calendar with drag-select (web) for the rate and slot editors.
 * Press on a day, drag across, release: the inclusive range is reported to
 * the parent. A click selects one day; shift+click extends from the anchor.
 * Dates are plain `YYYY-MM-DD` strings (calendar days, no time zone).
 */

export interface DateRange {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(y: number, m0: number, d: number): string {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthBounds(month: string): DateRange {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: isoDate(y, m - 1, 1), to: isoDate(y, m - 1, days) };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Orders two days into an inclusive range. */
export function orderedRange(a: string, b: string): DateRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function inRange(day: string, r: DateRange | null): boolean {
  return !!r && day >= r.from && day <= r.to;
}

export function rangeLength(r: DateRange): number {
  const a = Date.parse(`${r.from}T00:00:00Z`);
  const b = Date.parse(`${r.to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

interface MonthGridProps {
  month: string;
  onMonthChange: (month: string) => void;
  selection: DateRange | null;
  onSelect: (range: DateRange | null) => void;
  renderCell?: (day: string) => React.ReactNode;
  /** Days dimmed out by the weekday toggles. */
  isDimmed?: (day: string) => boolean;
}

export function MonthGrid({ month, onMonthChange, selection, onSelect, renderCell, isDimmed }: MonthGridProps) {
  const { t, language } = useLanguage();
  const anchor = useRef<string | null>(null);
  const dragging = useRef(false);
  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';

  useEffect(() => {
    const end = () => { dragging.current = false; };
    window.addEventListener('mouseup', end);
    return () => window.removeEventListener('mouseup', end);
  }, []);

  const { cells, title, weekdayNames } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = first.getUTCDay();
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) list.push(isoDate(y, m - 1, d));
    while (list.length % 7 !== 0) list.push(null);
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const wd = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    // 2023-01-01 was a Sunday.
    const names = Array.from({ length: 7 }, (_, i) => wd.format(new Date(Date.UTC(2023, 0, 1 + i))));
    return { cells: list, title: fmt.format(first), weekdayNames: names };
  }, [month, locale]);

  const down = (day: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey && anchor.current) {
      onSelect(orderedRange(anchor.current, day));
      return;
    }
    anchor.current = day;
    dragging.current = true;
    onSelect({ from: day, to: day });
  };
  const enter = (day: string) => {
    if (dragging.current && anchor.current) onSelect(orderedRange(anchor.current, day));
  };
  const up = (day: string) => {
    if (dragging.current && anchor.current) onSelect(orderedRange(anchor.current, day));
    dragging.current = false;
  };

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label={t('cat.cal.prev')} className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] cursor-pointer">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180 text-[var(--text-muted)]" />
        </button>
        <span className="text-sm font-bold text-[var(--text-primary)]" aria-live="polite">{title}</span>
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label={t('cat.cal.next')} className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] cursor-pointer">
          <ChevronRight className="w-4 h-4 rtl:rotate-180 text-[var(--text-muted)]" />
        </button>
      </div>
      <div role="grid" aria-label={title} className="grid grid-cols-7 gap-1">
        {weekdayNames.map(n => (
          <div key={n} role="columnheader" className="text-center text-[10px] font-bold text-[var(--text-muted)] py-1">{n}</div>
        ))}
        {cells.map((day, i) =>
          day ? (
            <div
              key={day}
              role="gridcell"
              data-date={day}
              aria-selected={inRange(day, selection)}
              tabIndex={0}
              onMouseDown={e => down(day, e)}
              onMouseEnter={() => enter(day)}
              onMouseUp={() => up(day)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (e.shiftKey && anchor.current) onSelect(orderedRange(anchor.current, day));
                  else { anchor.current = day; onSelect({ from: day, to: day }); }
                }
              }}
              className={`min-h-[3.25rem] rounded-lg border p-1 text-[10px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                inRange(day, selection)
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15'
                  : 'border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
              } ${isDimmed?.(day) ? 'opacity-40' : ''}`}
            >
              <div className="font-bold text-[var(--text-primary)] tabular-nums">{Number(day.slice(8))}</div>
              {renderCell?.(day)}
            </div>
          ) : (
            <div key={`pad-${i}`} aria-hidden="true" />
          )
        )}
      </div>
    </div>
  );
}

/** Seven toggles, Sunday first; the selection limits a range change to those days. */
export function WeekdayToggles({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const { t, language } = useLanguage();
  const wd = new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', timeZone: 'UTC' });
  return (
    <div role="group" aria-label={t('cat.cal.weekdays')} className="flex flex-wrap gap-1">
      {Array.from({ length: 7 }, (_, d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter(x => x !== d) : [...value, d].sort())}
            className={`px-2 py-1 rounded-md border text-[10px] font-bold cursor-pointer ${on ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}
          >
            {wd.format(new Date(Date.UTC(2023, 0, 1 + d)))}
          </button>
        );
      })}
    </div>
  );
}

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
