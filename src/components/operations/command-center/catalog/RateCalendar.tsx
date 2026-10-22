import React, { useMemo, useState } from 'react';
import { BedDouble, Lock, Unlock, Tag } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogEnvelope, CatalogRateNight, CatalogScope } from '../../../../types/catalog';
import { EmptyState } from '../ui';
import { NoticeBar, buttonClass, inputClass, primaryButtonClass, useLoader, useMutationRunner, useReasonPrompt } from '../control/controlShared';
import { ALL_WEEKDAYS, MonthGrid, WeekdayToggles, currentMonth, monthBounds, rangeLength, weekdayOf, inRange, type DateRange } from './MonthGrid';
import { formatEGP, isPriceJump, pickText } from './catalogShared';

/**
 * Per-room nightly rates for a hotel: a month grid where a drag selects a
 * range, then "Set price" / "Close" / "Reopen" applies to the selected
 * weekdays of that range (PUT .../hotel/:id/rates, at most 366 days). A price
 * more than 30% away from what the range had asks for a reason first.
 */

export interface RateCalendarProps {
  scope: CatalogScope;
  hotelId: string;
  rooms: CatalogEnvelope[];
  initialMonth?: string;
}

export function RateCalendar({ scope, hotelId, rooms, initialMonth }: RateCalendarProps) {
  const { t, language } = useLanguage();
  const [pickedRoom, setRoomId] = useState(rooms[0]?.id ?? '');
  const roomId = rooms.some(r => r.id === pickedRoom) ? pickedRoom : rooms[0]?.id ?? '';
  const [month, setMonth] = useState(initialMonth ?? currentMonth());
  const [selection, setSelection] = useState<DateRange | null>(null);
  const [price, setPrice] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>(ALL_WEEKDAYS);
  const { run, busy, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);

  const bounds = monthBounds(month);
  const { data, reload } = useLoader(
    signal => (roomId ? api.catalogGetRates(scope, hotelId, { roomId, from: bounds.from, to: bounds.to }, signal) : Promise.resolve({ nights: [] })),
    [scope, hotelId, roomId, month]
  );
  const byDate = useMemo(() => {
    const m = new Map<string, CatalogRateNight>();
    for (const n of data?.nights ?? []) if (!roomId || n.roomId === roomId) m.set(n.date, n);
    return m;
  }, [data, roomId]);

  if (rooms.length === 0) {
    return <EmptyState icon={BedDouble} title={t('cat.rates.noRooms')} />;
  }

  const allDays = weekdays.length === 7;
  const affects = (day: string) => inRange(day, selection) && weekdays.includes(weekdayOf(day));

  const apply = async (body: { nightlyEGP?: number; closed?: boolean }, reason?: string) => {
    if (!selection) return;
    await api.catalogPutRates(scope, hotelId, {
      roomId,
      from: selection.from,
      to: selection.to,
      ...body,
      ...(allDays ? {} : { weekdays }),
      ...(reason ? { reason } : {}),
    });
  };

  const setNightly = () => {
    const n = Number(price);
    if (!selection || !Number.isFinite(n) || n <= 0) return;
    const jump = [...byDate.values()].some(night => affects(night.date) && isPriceJump(night.nightlyEGP, n));
    if (jump) {
      ask({
        title: t('cat.price.jumpTitle'),
        description: t('cat.price.jumpBody'),
        run: reason => apply({ nightlyEGP: n }, reason),
        success: t('cat.rates.saved'),
        after: reload,
      });
      return;
    }
    void run(() => apply({ nightlyEGP: n }), t('cat.rates.saved')).then(ok => { if (ok) reload(); });
  };

  const setClosed = (closed: boolean) => {
    void run(() => apply({ closed }), t('cat.rates.saved')).then(ok => { if (ok) reload(); });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-bold text-[var(--text-muted)]" htmlFor="rate-room">{t('cat.rates.room')}</label>
        <select id="rate-room" className={inputClass + ' w-auto'} value={roomId} onChange={e => { setRoomId(e.target.value); setSelection(null); }}>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>{pickText(r.title, language) || r.id}</option>
          ))}
        </select>
      </div>
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <MonthGrid
          month={month}
          onMonthChange={m => { setMonth(m); setSelection(null); }}
          selection={selection}
          onSelect={setSelection}
          isDimmed={day => inRange(day, selection) && !weekdays.includes(weekdayOf(day))}
          renderCell={day => {
            const n = byDate.get(day);
            if (!n) return null;
            return n.closed ? (
              <div className="text-red-400 font-bold">{t('cat.rates.closed')}</div>
            ) : (
              <div className="text-[var(--text-muted)] tabular-nums truncate">{typeof n.nightlyEGP === 'number' ? n.nightlyEGP.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : ''}</div>
            );
          }}
        />
        <aside className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 h-fit">
          {selection ? (
            <p className="text-xs font-bold text-[var(--text-primary)]" data-testid="rate-selection">
              {t('cat.cal.selected', { from: selection.from, to: selection.to, count: rangeLength(selection) })}
            </p>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">{t('cat.cal.selectHint')}</p>
          )}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.cal.weekdays')}</span>
            <WeekdayToggles value={weekdays} onChange={setWeekdays} />
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.rates.price')}</span>
            <input type="number" min={1} inputMode="numeric" className={inputClass} value={price} onChange={e => setPrice(e.target.value)} placeholder={formatEGP(0, language)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} disabled={!selection || busy || !(Number(price) > 0) || weekdays.length === 0} onClick={setNightly}>
              <Tag className="w-3 h-3" /> {t('cat.rates.setPrice')}
            </button>
            <button type="button" className={buttonClass} disabled={!selection || busy || weekdays.length === 0} onClick={() => setClosed(true)}>
              <Lock className="w-3 h-3" /> {t('cat.rates.close')}
            </button>
            <button type="button" className={buttonClass} disabled={!selection || busy || weekdays.length === 0} onClick={() => setClosed(false)}>
              <Unlock className="w-3 h-3" /> {t('cat.rates.open')}
            </button>
          </div>
        </aside>
      </div>
      {dialog}
    </div>
  );
}

export default RateCalendar;
