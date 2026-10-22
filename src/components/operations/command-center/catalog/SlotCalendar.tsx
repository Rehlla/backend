import React, { useMemo, useState } from 'react';
import { CalendarCheck, Lock, Plus, X } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogScope, CatalogSlot } from '../../../../types/catalog';
import { NoticeBar, buttonClass, inputClass, primaryButtonClass, useLoader, useMutationRunner } from '../control/controlShared';
import { ALL_WEEKDAYS, MonthGrid, WeekdayToggles, currentMonth, inRange, monthBounds, orderedRange, rangeLength, weekdayOf, type DateRange } from './MonthGrid';

/**
 * Activity availability: pick a date range (drag on the month or type the
 * dates), the start times and the capacity, then save — PUT
 * .../activity/:id/slots generates or updates one inventory slot per time on
 * each selected weekday of the range. "Close" marks those slots unbookable.
 */

export function SlotCalendar({ scope, activityId, initialMonth }: { scope: CatalogScope; activityId: string; initialMonth?: string }) {
  const { t } = useLanguage();
  const [month, setMonth] = useState(initialMonth ?? currentMonth());
  const [selection, setSelection] = useState<DateRange | null>(null);
  const [times, setTimes] = useState<string[]>(['09:00']);
  const [capacity, setCapacity] = useState('10');
  const [weekdays, setWeekdays] = useState<number[]>(ALL_WEEKDAYS);
  const { run, busy, notice, clearNotice } = useMutationRunner();

  const bounds = monthBounds(month);
  const { data, reload } = useLoader(signal => api.catalogGetSlots(scope, activityId, bounds, signal), [scope, activityId, month]);
  const byDate = useMemo(() => {
    const m = new Map<string, CatalogSlot[]>();
    for (const s of data?.slots ?? []) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [data]);

  const cleanTimes = times.filter(x => /^\d{2}:\d{2}$/.test(x));
  const cap = Number(capacity);
  const valid = !!selection && cleanTimes.length > 0 && Number.isInteger(cap) && cap > 0 && weekdays.length > 0;

  const save = (closed: boolean) => {
    if (!selection) return;
    void run(
      () => api.catalogPutSlots(scope, activityId, {
        from: selection.from,
        to: selection.to,
        times: cleanTimes,
        capacity: cap,
        ...(weekdays.length === 7 ? {} : { weekdays }),
        ...(closed ? { closed: true } : {}),
      }),
      t('cat.slots.saved')
    ).then(ok => { if (ok) reload(); });
  };

  const setDate = (which: 'from' | 'to', v: string) => {
    if (!v) return;
    const other = selection ? selection[which === 'from' ? 'to' : 'from'] : v;
    setSelection(orderedRange(v, other));
  };

  return (
    <div className="space-y-3">
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <MonthGrid
          month={month}
          onMonthChange={m => setMonth(m)}
          selection={selection}
          onSelect={setSelection}
          isDimmed={day => inRange(day, selection) && !weekdays.includes(weekdayOf(day))}
          renderCell={day => {
            const slots = byDate.get(day);
            if (!slots || slots.length === 0) return null;
            const open = slots.filter(s => !s.closed);
            return open.length === 0 ? (
              <div className="text-red-400 font-bold">{t('cat.rates.closed')}</div>
            ) : (
              <div className="text-[var(--text-muted)] truncate">{t('cat.slots.count', { n: open.length })}</div>
            );
          }}
        />
        <aside className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 h-fit">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.slots.from')}</span>
              <input type="date" className={inputClass} value={selection?.from ?? ''} onChange={e => setDate('from', e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.slots.to')}</span>
              <input type="date" className={inputClass} value={selection?.to ?? ''} onChange={e => setDate('to', e.target.value)} />
            </label>
          </div>
          {selection && <p className="text-[11px] text-[var(--text-muted)]">{t('cat.cal.selected', { from: selection.from, to: selection.to, count: rangeLength(selection) })}</p>}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.cal.weekdays')}</span>
            <WeekdayToggles value={weekdays} onChange={setWeekdays} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.slots.times')}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {times.map((time, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                  <input type="time" className={inputClass + ' w-24'} value={time} aria-label={t('cat.time.n', { n: i + 1 })} onChange={e => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" aria-label={t('cat.time.remove')} onClick={() => setTimes(times.filter((_, j) => j !== i))} className="cursor-pointer text-[var(--text-muted)] hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button type="button" className={buttonClass} onClick={() => setTimes([...times, '14:00'])}>
                <Plus className="w-3 h-3" /> {t('cat.time.add')}
              </button>
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.slots.capacity')}</span>
            <input type="number" min={1} step={1} className={inputClass + ' w-24'} value={capacity} onChange={e => setCapacity(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} disabled={!valid || busy} onClick={() => save(false)}>
              <CalendarCheck className="w-3 h-3" /> {t('cat.slots.apply')}
            </button>
            <button type="button" className={buttonClass} disabled={!valid || busy} onClick={() => save(true)}>
              <Lock className="w-3 h-3" /> {t('cat.rates.close')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SlotCalendar;
