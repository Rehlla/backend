import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Lock, Unlock, XCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';

/**
 * The hotel owner's own stays (supplier portal → Stays).
 *
 * Two jobs: answer guests waiting for the property's confirmation, and keep
 * the calendar honest by closing nights the property cannot sell (a private
 * event, a renovation, a weekend sold elsewhere). Prices stay with the desk.
 * Everything here is scoped by the server to the account's own supplier.
 */

interface Stay {
  bookingRef: string; status: string; checkIn: string; checkOut: string; nights: number; rooms: number;
  adults: number; children: number; travelerName: string; travelerPhone: string; arrivalTime?: string;
  specialRequests?: string; paymentMethod: string; depositEGP: number; balanceDueEGP: number; totalEGP: number;
  balanceSettled: boolean;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};

export const PropertyStaysPanel: React.FC = () => {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';

  const [stays, setStays] = useState<Stay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStays((await api.getPropertyStays()).stays as unknown as Stay[]);
    } catch (e: any) {
      setError(String(e?.message || t('propertyStays.loadFailed')));
      setStays([]);
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const respond = async (ref: string, approve: boolean) => {
    setBusy(ref);
    setError(null);
    try {
      await api.respondPropertyStay(ref, approve, approve ? undefined : 'declined by the property');
      await load();
    } catch (e: any) {
      setError(String(e?.message || t('propertyStays.actionFailed')));
    } finally {
      setBusy(null);
    }
  };

  // ── calendar
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string; nameAr: string; totalUnits: number }>>([]);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [nights, setNights] = useState<Array<{ date: string; closed: boolean; closedReason?: string; booked: number }> | null>(null);
  const [totalUnits, setTotalUnits] = useState(0);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getPropertyRoomTypes()
      .then(r => {
        setRoomTypes(r.roomTypes);
        setRoomTypeId(r.roomTypes[0]?.id ?? null);
      })
      .catch(() => setRoomTypes([]));
  }, []);

  const monthEnd = useMemo(() => {
    const d = new Date(`${month}T00:00:00`);
    return iso(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, [month]);

  const loadCalendar = useCallback(async () => {
    if (!roomTypeId) return;
    try {
      const r = await api.getPropertyCalendar(roomTypeId, month, monthEnd);
      setNights(r.nights);
      setTotalUnits(r.totalUnits);
    } catch (e: any) {
      setError(String(e?.message || t('propertyStays.loadFailed')));
    }
  }, [roomTypeId, month, monthEnd, t]);
  useEffect(() => {
    setNights(null);
    setStart(null);
    setEnd(null);
    void loadCalendar();
  }, [loadCalendar]);

  const lo = start && end ? (start < end ? start : end) : start;
  const hi = start && end ? (start < end ? end : start) : start;
  const pick = (d: string) => {
    if (!start || end) { setStart(d); setEnd(null); } else setEnd(d);
  };
  const setClosed = async (closed: boolean) => {
    if (!roomTypeId || !lo || !hi) return;
    setSaving(true);
    setError(null);
    try {
      await api.setPropertyNightsClosed(roomTypeId, { from: lo, to: addDays(hi, 1), closed, reason: closed ? reason.trim() || undefined : undefined });
      await loadCalendar();
    } catch (e: any) {
      setError(String(e?.message || t('propertyStays.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = new Date(`${month}T00:00:00`).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' });
  const shiftMonth = (n: number) => {
    const d = new Date(`${month}T00:00:00`);
    setMonth(iso(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };
  const leadBlanks = new Date(`${month}T00:00:00`).getDay();
  const waiting = (stays ?? []).filter(s => s.status === 'PENDING_CONFIRMATION');
  const upcoming = (stays ?? []).filter(s => s.status !== 'PENDING_CONFIRMATION');

  const stayCard = (s: Stay, actions: boolean) => (
    <li key={s.bookingRef} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {s.travelerName} <span className="font-mono text-[11px] text-[var(--text-secondary)]">{s.bookingRef}</span>
          </p>
          <p className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{s.checkIn} → {s.checkOut}</span>
            <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden="true" />{t('propertyStays.party', { rooms: s.rooms, adults: s.adults, children: s.children })}</span>
            {s.travelerPhone && <a href={`tel:${s.travelerPhone}`} className="underline">{s.travelerPhone}</a>}
          </p>
          {(s.arrivalTime || s.specialRequests) && (
            <p className="text-xs text-[var(--text-secondary)]">
              {s.arrivalTime && t('propertyStays.arrival', { time: s.arrivalTime })}
              {s.arrivalTime && s.specialRequests && ' · '}
              {s.specialRequests}
            </p>
          )}
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {s.balanceSettled
              ? t('propertyStays.paidInFull', { total: s.totalEGP.toLocaleString() })
              : t('propertyStays.dueAtDesk', { amount: s.balanceDueEGP.toLocaleString(), total: s.totalEGP.toLocaleString() })}
          </p>
        </div>
        {actions ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy === s.bookingRef}
              onClick={() => void respond(s.bookingRef, true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('propertyStays.confirm')}
            </button>
            <button
              type="button"
              disabled={busy === s.bookingRef}
              onClick={() => void respond(s.bookingRef, false)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-40"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t('propertyStays.decline')}
            </button>
          </div>
        ) : (
          <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
            {t(`propertyStays.status.${s.status}`)}
          </span>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('propertyStays.waiting', { count: waiting.length })}</h3>
        {stays === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-secondary)]" /></div>
        ) : waiting.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t('propertyStays.noneWaiting')}</p>
        ) : (
          <ul className="space-y-2">{waiting.map(s => stayCard(s, true))}</ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('propertyStays.allStays')}</h3>
          <ul className="space-y-2">{upcoming.map(s => stayCard(s, false))}</ul>
        </section>
      )}

      {roomTypes.length > 0 && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('propertyStays.calendar')}</h3>
            <div className="flex items-center gap-2">
              {roomTypes.length > 1 && (
                <select
                  value={roomTypeId ?? ''}
                  onChange={e => setRoomTypeId(e.target.value)}
                  aria-label={t('propertyStays.roomType')}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] px-2 py-1.5 text-xs"
                >
                  {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{isAr ? rt.nameAr : rt.name}</option>)}
                </select>
              )}
              <button type="button" onClick={() => shiftMonth(-1)} aria-label={t('opsRooms.prevMonth')} className="rounded-lg border border-[var(--border-subtle)] p-1.5">
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </button>
              <span className="min-w-[8rem] text-center text-sm font-bold">{monthLabel}</span>
              <button type="button" onClick={() => shiftMonth(1)} aria-label={t('opsRooms.nextMonth')} className="rounded-lg border border-[var(--border-subtle)] p-1.5">
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">{t('propertyStays.calendarHint')}</p>

          {nights === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-secondary)]" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadBlanks }, (_, i) => <div key={`b${i}`} />)}
              {nights.map(n => {
                const selected = lo !== null && hi !== null && n.date >= lo && n.date <= hi;
                return (
                  <button
                    key={n.date}
                    type="button"
                    onClick={() => pick(n.date)}
                    aria-pressed={selected}
                    title={n.closedReason || undefined}
                    className={`min-h-[52px] rounded-lg border p-1.5 text-start ${
                      selected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15'
                        : n.closed ? 'border-rose-500/40 bg-rose-500/10' : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    <span className="block text-[11px] font-bold text-[var(--text-secondary)]">{Number(n.date.slice(8))}</span>
                    <span className={`block text-[10px] ${n.closed ? 'font-bold text-rose-500' : 'text-[var(--text-secondary)]'}`}>
                      {n.closed ? t('opsRooms.closed') : `${n.booked}/${totalUnits}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {lo && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--accent-primary)]/40 p-3">
              <p className="w-full text-xs font-bold">{t('opsRooms.selection', { from: lo, to: hi ?? lo })}</p>
              <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                <span>{t('opsRooms.closeReason')}</span>
                <input value={reason} onChange={e => setReason(e.target.value)} className="w-48 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] px-2.5 py-2 text-sm" />
              </label>
              <button type="button" disabled={saving} onClick={() => void setClosed(true)} className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-500 disabled:opacity-40">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {t('opsRooms.closeNights')}
              </button>
              <button type="button" disabled={saving} onClick={() => void setClosed(false)} className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-40">
                <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                {t('opsRooms.reopenNights')}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default PropertyStaysPanel;
