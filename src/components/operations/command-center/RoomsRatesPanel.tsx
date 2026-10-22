import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, ChevronLeft, ChevronRight, Loader2, Plus, Search, Lock, Unlock, Eraser, Tag, Archive } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { api } from '../../../services/api';

/**
 * Rooms & rates — the desk's tool for what a property sells.
 *
 * The API had room-type CRUD and a per-night rate calendar from the start, but
 * no screen used them: a price change or a sold-out weekend meant a database
 * edit. This panel is that screen. Pick a property, shape its room types, then
 * paint the calendar: select a run of nights and set a price, close them, or
 * put them back to the base rate. Each night shows how many rooms are already
 * held, so prices are set looking at demand.
 */

interface Property { id: string; slug: string; name: string; nameAr?: string; propertyType?: string; areaName?: string }
interface RoomType {
  id: string; code: string; name: string; nameAr: string; maxGuestsPerUnit: number; totalUnits: number;
  baseNightlyEGP: number; minNights: number; maxNights: number; cancellationPolicyHours: number; active: boolean;
}
interface Night { date: string; nightlyEGP: number; overridden: boolean; closed: boolean; closedReason?: string; booked: number }

const EMPTY_FORM = {
  code: '', name: '', nameAr: '', maxGuestsPerUnit: 2, totalUnits: 1, baseNightlyEGP: 1000,
  minNights: 1, maxNights: 30, cancellationPolicyHours: 48,
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const inputCls = 'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] px-2.5 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]';

export const RoomsRatesPanel: React.FC = () => {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';

  // ── properties
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [query, setQuery] = useState('');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  useEffect(() => {
    api.adminListAccommodations()
      .then(r => setProperties((r.accommodations ?? []) as unknown as Property[]))
      .catch(() => setProperties([]));
  }, []);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = properties ?? [];
    return (q ? list.filter(p => p.name.toLowerCase().includes(q) || (p.nameAr ?? '').includes(q) || p.slug.includes(q)) : list).slice(0, 40);
  }, [properties, query]);
  const property = properties?.find(p => p.id === propertyId) ?? null;

  // ── room types
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState<string | null>(null);

  const loadRoomTypes = useCallback(async (accId: string) => {
    setRoomTypes(null);
    const r = await api.adminListRoomTypes(accId);
    const list = (r.roomTypes ?? []) as unknown as RoomType[];
    setRoomTypes(list);
    setRoomTypeId(prev => (prev && list.some(rt => rt.id === prev) ? prev : list[0]?.id ?? null));
  }, []);
  useEffect(() => {
    if (propertyId) void loadRoomTypes(propertyId);
  }, [propertyId, loadRoomTypes]);

  const startEdit = (rt?: RoomType) => {
    setFormError(null);
    if (rt) {
      setEditing(rt.id);
      setForm({
        code: rt.code, name: rt.name, nameAr: rt.nameAr, maxGuestsPerUnit: rt.maxGuestsPerUnit, totalUnits: rt.totalUnits,
        baseNightlyEGP: rt.baseNightlyEGP, minNights: rt.minNights, maxNights: rt.maxNights, cancellationPolicyHours: rt.cancellationPolicyHours,
      });
    } else {
      setEditing('new');
      setForm(EMPTY_FORM);
    }
  };

  const saveRoomType = async () => {
    if (!propertyId) return;
    setSaving(true);
    setFormError(null);
    try {
      const { code, ...rest } = form;
      if (editing === 'new') {
        await api.adminCreateRoomType({ accommodationId: propertyId, code, ...rest });
      } else if (editing) {
        await api.adminUpdateRoomType(editing, rest);
      }
      setEditing(null);
      await loadRoomTypes(propertyId);
    } catch (e: any) {
      setFormError(String(e?.message || t('opsRooms.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const retire = async (id: string) => {
    if (!propertyId) return;
    try {
      await api.adminRetireRoomType(id);
      setConfirmRetire(null);
      await loadRoomTypes(propertyId);
    } catch (e: any) {
      setFormError(String(e?.message || t('opsRooms.saveFailed')));
    }
  };

  // ── calendar
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [nights, setNights] = useState<Night[] | null>(null);
  const [totalUnits, setTotalUnits] = useState(0);
  const [calError, setCalError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [applying, setApplying] = useState(false);

  const monthEnd = useMemo(() => {
    const d = new Date(`${month}T00:00:00`);
    return iso(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, [month]);

  const loadCalendar = useCallback(async () => {
    if (!roomTypeId) return;
    setCalError(null);
    try {
      const r = await api.adminRoomTypeCalendar(roomTypeId, month, monthEnd);
      setNights(r.nights);
      setTotalUnits(r.totalUnits);
    } catch (e: any) {
      setCalError(String(e?.message || t('opsRooms.calendarFailed')));
    }
  }, [roomTypeId, month, monthEnd, t]);
  useEffect(() => {
    setNights(null);
    setRangeStart(null);
    setRangeEnd(null);
    void loadCalendar();
  }, [loadCalendar]);

  const lo = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeStart : rangeEnd) : rangeStart;
  const hi = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeEnd : rangeStart) : rangeStart;
  const inRange = (d: string) => lo !== null && hi !== null && d >= lo && d <= hi;
  const pick = (d: string) => {
    if (!rangeStart || rangeEnd) {
      setRangeStart(d);
      setRangeEnd(null);
    } else {
      setRangeEnd(d);
    }
  };

  const apply = async (body: { nightlyEGP?: number; closed?: boolean; closedReason?: string }) => {
    if (!roomTypeId || !lo || !hi) return;
    setApplying(true);
    setCalError(null);
    try {
      await api.adminBulkRateNights(roomTypeId, { from: lo, to: addDays(hi, 1), ...body });
      await loadCalendar();
    } catch (e: any) {
      setCalError(String(e?.message || t('opsRooms.saveFailed')));
    } finally {
      setApplying(false);
    }
  };
  const clearOverrides = async () => {
    if (!roomTypeId || !lo || !hi || !nights) return;
    setApplying(true);
    setCalError(null);
    try {
      for (const n of nights.filter(n => inRange(n.date) && (n.overridden || n.closed))) {
        await api.adminDeleteRateNight(roomTypeId, n.date);
      }
      await loadCalendar();
    } catch (e: any) {
      setCalError(String(e?.message || t('opsRooms.saveFailed')));
    } finally {
      setApplying(false);
    }
  };

  const monthLabel = new Date(`${month}T00:00:00`).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' });
  const weekdays = useMemo(() => {
    const base = new Date(2026, 0, 4); // a Sunday
    return Array.from({ length: 7 }, (_, i) =>
      new Date(base.getFullYear(), base.getMonth(), base.getDate() + i).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { weekday: 'short' })
    );
  }, [isAr]);
  const leadBlanks = new Date(`${month}T00:00:00`).getDay();
  const shiftMonth = (n: number) => {
    const d = new Date(`${month}T00:00:00`);
    setMonth(iso(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };
  const selectedType = roomTypes?.find(rt => rt.id === roomTypeId) ?? null;

  const field = (key: keyof typeof EMPTY_FORM, label: string, type: 'text' | 'number' = 'number', disabled = false) => (
    <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
      <span>{label}</span>
      <input
        type={type}
        disabled={disabled}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className={`${inputCls} disabled:opacity-50`}
      />
    </label>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Property picker */}
      <aside className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 space-y-2 lg:max-h-[75vh] lg:overflow-y-auto">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('opsRooms.searchProperty')}
            aria-label={t('opsRooms.searchProperty')}
            className={`${inputCls} ps-8`}
          />
        </div>
        {properties === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-secondary)]" /></div>
        ) : (
          <ul className="space-y-1">
            {matches.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { setPropertyId(p.id); setEditing(null); }}
                  aria-pressed={p.id === propertyId}
                  className={`w-full rounded-lg px-2.5 py-2 text-start text-sm transition-colors ${
                    p.id === propertyId ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-bold' : 'hover:bg-[var(--surface-container)] text-[var(--text-primary)]'
                  }`}
                >
                  <span className="block truncate">{isAr ? p.nameAr || p.name : p.name}</span>
                  <span className="block truncate text-[11px] text-[var(--text-secondary)]">{p.propertyType} · {p.areaName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="space-y-4 min-w-0">
        {!property ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-10 text-center text-sm text-[var(--text-secondary)]">
            <BedDouble className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />
            {t('opsRooms.pickProperty')}
          </div>
        ) : (
          <>
            {/* Room types */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{isAr ? property.nameAr || property.name : property.name} · {t('opsRooms.roomTypes')}</h3>
                <button
                  type="button"
                  onClick={() => startEdit()}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-[var(--surface-container)]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('opsRooms.addRoomType')}
                </button>
              </div>

              {roomTypes === null ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-secondary)]" /></div>
              ) : roomTypes.length === 0 && editing !== 'new' ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('opsRooms.noRoomTypes')}</p>
              ) : (
                <ul className="space-y-2">
                  {roomTypes.map(rt => (
                    <li
                      key={rt.id}
                      className={`rounded-xl border p-3 ${rt.id === roomTypeId ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onClick={() => setRoomTypeId(rt.id)} className="text-start min-w-0">
                          <span className="block text-sm font-bold text-[var(--text-primary)]">
                            {isAr ? rt.nameAr : rt.name}{' '}
                            <span className="font-mono text-[11px] text-[var(--text-secondary)]">{rt.code}</span>
                            {!rt.active && <span className="ms-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-500">{t('opsRooms.inactive')}</span>}
                          </span>
                          <span className="block text-xs text-[var(--text-secondary)]">
                            {t('opsRooms.summary', { units: rt.totalUnits, guests: rt.maxGuestsPerUnit, price: rt.baseNightlyEGP.toLocaleString(), min: rt.minNights, max: rt.maxNights })}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => startEdit(rt)} className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            {t('opsRooms.edit')}
                          </button>
                          {rt.active && (confirmRetire === rt.id ? (
                            <button type="button" onClick={() => void retire(rt.id)} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white">
                              {t('opsRooms.confirmRetire')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRetire(rt.id)}
                              aria-label={t('opsRooms.retire')}
                              title={t('opsRooms.retire')}
                              className="rounded-lg border border-rose-500/30 p-1.5 text-rose-500 hover:bg-rose-500/10"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {editing && (
                <div className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--surface-container)]/40 p-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {field('code', t('opsRooms.code'), 'text', editing !== 'new')}
                    {field('name', t('opsRooms.nameEn'), 'text')}
                    {field('nameAr', t('opsRooms.nameAr'), 'text')}
                    {field('totalUnits', t('opsRooms.units'))}
                    {field('maxGuestsPerUnit', t('opsRooms.guestsPerRoom'))}
                    {field('baseNightlyEGP', t('opsRooms.basePrice'))}
                    {field('minNights', t('opsRooms.minNights'))}
                    {field('maxNights', t('opsRooms.maxNights'))}
                    {field('cancellationPolicyHours', t('opsRooms.cancelHours'))}
                  </div>
                  {formError && <p role="alert" className="text-xs text-rose-500">{formError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveRoomType()}
                      className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-[var(--surface-container)] disabled:opacity-40"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {t('opsRooms.save')}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)]">
                      {t('opsRooms.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rate calendar */}
            {selectedType && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {t('opsRooms.calendarFor', { room: isAr ? selectedType.nameAr : selectedType.name })}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => shiftMonth(-1)} aria-label={t('opsRooms.prevMonth')} className="rounded-lg border border-[var(--border-subtle)] p-1.5">
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                    </button>
                    <span className="min-w-[9rem] text-center text-sm font-bold">{monthLabel}</span>
                    <button type="button" onClick={() => shiftMonth(1)} aria-label={t('opsRooms.nextMonth')} className="rounded-lg border border-[var(--border-subtle)] p-1.5">
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">{t('opsRooms.calendarHint')}</p>

                {nights === null && !calError ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-secondary)]" /></div>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {weekdays.map(w => (
                      <div key={w} className="pb-1 text-center text-[11px] font-bold text-[var(--text-secondary)]">{w}</div>
                    ))}
                    {Array.from({ length: leadBlanks }, (_, i) => <div key={`b${i}`} />)}
                    {(nights ?? []).map(n => {
                      const selected = inRange(n.date);
                      const full = totalUnits > 0 && n.booked >= totalUnits;
                      return (
                        <button
                          key={n.date}
                          type="button"
                          onClick={() => pick(n.date)}
                          aria-pressed={selected}
                          title={n.closedReason || undefined}
                          className={`min-h-[64px] rounded-lg border p-1.5 text-start transition-colors ${
                            selected
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15'
                              : n.closed
                                ? 'border-rose-500/40 bg-rose-500/10'
                                : 'border-[var(--border-subtle)] hover:border-[var(--text-secondary)]'
                          }`}
                        >
                          <span className="block text-[11px] font-bold text-[var(--text-secondary)]">{Number(n.date.slice(8))}</span>
                          {n.closed ? (
                            <span className="block text-[11px] font-bold text-rose-500">{t('opsRooms.closed')}</span>
                          ) : (
                            <span className={`block text-xs font-bold tabular-nums ${n.overridden ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                              {n.nightlyEGP.toLocaleString()}
                            </span>
                          )}
                          <span className={`block text-[10px] tabular-nums ${full ? 'font-bold text-amber-500' : 'text-[var(--text-secondary)]'}`}>
                            {n.booked}/{totalUnits}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {calError && <p role="alert" className="text-xs text-rose-500">{calError}</p>}

                {lo && (
                  <div className="rounded-xl border border-[var(--accent-primary)]/40 p-3 space-y-2">
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {t('opsRooms.selection', { from: lo, to: hi ?? lo })}
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>{t('opsRooms.priceForNights')}</span>
                        <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className={`${inputCls} w-32`} />
                      </label>
                      <button
                        type="button"
                        disabled={applying || price === ''}
                        onClick={() => void apply({ nightlyEGP: Number(price) })}
                        className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-[var(--surface-container)] disabled:opacity-40"
                      >
                        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('opsRooms.setPrice')}
                      </button>
                      <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>{t('opsRooms.closeReason')}</span>
                        <input type="text" value={closeReason} onChange={e => setCloseReason(e.target.value)} className={`${inputCls} w-44`} />
                      </label>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => void apply({ closed: true, closedReason: closeReason.trim() || undefined })}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-500 disabled:opacity-40"
                      >
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('opsRooms.closeNights')}
                      </button>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => void apply({ closed: false })}
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-40"
                      >
                        <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('opsRooms.reopenNights')}
                      </button>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => void clearOverrides()}
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-40"
                      >
                        <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('opsRooms.backToBase')}
                      </button>
                      {applying && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default RoomsRatesPanel;
