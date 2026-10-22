import React, { useCallback, useEffect, useState } from 'react';
import {
  BedDouble, CalendarClock, CheckCircle2, XCircle, Ban, RefreshCw,
  Loader2, Search, ClipboardList, Wallet, LogIn,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { RoomsRatesPanel } from './RoomsRatesPanel';

/**
 * The stays console: fill in the rooms nobody counted, watch the payment queue,
 * and drive a reservation to confirmation.
 *
 * Three tabs, because the same platform does three different jobs here:
 *
 *   1. **Inventory** — half the catalogue has `rooms: 0`, which means the
 *      importer never learned a number. Those properties are deliberately not
 *      bookable, and this queue is where staff give them a real capacity. The
 *      alternative — guessing — would publish a scarcity claim ("only 3 rooms
 *      left") that nobody measured.
 *
 *   2. **Bookings** — the platform moves no money. A traveller pays a deposit
 *      outside the system and staff record it here, so the queue is ordered by
 *      what is blocking a guest right now rather than by when it arrived.
 *
 *   3. **Rooms & rates** — room types and the per-night calendar (RoomsRatesPanel).
 */

const STAY_STATUSES = [
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'IN_HOUSE',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'NO_SHOW',
] as const;

const STATUS_STYLE: Record<string, { key: string; cls: string }> = {
  PENDING_PAYMENT: { key: 'opsStays.status.pendingPayment', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  PENDING_CONFIRMATION: { key: 'opsStays.status.pendingConfirmation', cls: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  CONFIRMED: { key: 'opsStays.status.confirmed', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  IN_HOUSE: { key: 'opsStays.status.inHouse', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  COMPLETED: { key: 'opsStays.status.completed', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  CANCELLED: { key: 'opsStays.status.cancelled', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  REJECTED: { key: 'opsStays.status.rejected', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  EXPIRED: { key: 'opsStays.status.expired', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  NO_SHOW: { key: 'opsStays.status.noShow', cls: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
};

const fmtEGP = (n: unknown) => (typeof n === 'number' ? n.toLocaleString() : '—');
const fmtDate = (iso: unknown) =>
  typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : '—';

type Tab = 'bookings' | 'inventory' | 'rooms';

export const StaysConsole: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('bookings');
  const tabs: Array<[Tab, string]> = [
    ['bookings', t('opsStays.tab.bookings')],
    ['rooms', t('opsStays.tab.rooms')],
    ['inventory', t('opsStays.tab.inventory')],
  ];
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-[var(--text-primary)]">{t('opsStays.title')}</h1>
          <p className="text-xs text-[var(--text-secondary)]">{t('opsStays.subtitle')}</p>
        </div>
        <div role="tablist" className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === id ? 'bg-[var(--surface-card)] text-[var(--accent-primary)] shadow-xs' : 'text-[var(--text-secondary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'bookings' ? <BookingsQueue /> : tab === 'rooms' ? <RoomsRatesPanel /> : <InventoryQueue />}
    </div>
  );
};

const InventoryQueue: React.FC = () => {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetInventoryQueue();
      setQueue(data.queue as Array<Record<string, unknown>>);
    } catch (e: any) {
      setError(String(e?.message || t('opsStays.queueFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const giveCapacity = async (row: Record<string, unknown>, units: number) => {
    const accommodationId = String(row.accommodationId);
    setSaving(accommodationId);
    setSaved(null);
    try {
      const roomTypeIds = (row.roomTypeIds as string[]) ?? [];
      // Prefer fixing the room type the backfill made; fall back to creating one.
      if (roomTypeIds[0]) {
        await api.adminUpdateRoomType(roomTypeIds[0], {
          totalUnits: units,
          minNights: 1,
          maxNights: 30,
          cancellationPolicyHours: 48,
          active: units > 0,
        });
      } else {
        await api.adminCreateRoomType({
          accommodationId,
          code: 'STD',
          name: String(row.name),
          nameAr: String(row.nameAr),
          maxGuestsPerUnit: 2,
          // The listing's own nightly price, not a placeholder.
          baseNightlyEGP: Number(row.perNightEGP) > 0 ? Number(row.perNightEGP) : 1000,
          totalUnits: units,
          minNights: 1,
          maxNights: 30,
          cancellationPolicyHours: 48,
        });
      }
      setSaved(accommodationId);
      await load();
    } catch (e: any) {
      setError(String(e?.message || t('opsStays.capacityFailed')));
    } finally {
      setSaving(null);
    }
  };

  const filtered = queue.filter(r => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(r.name).toLowerCase().includes(q) ||
      String(r.nameAr).includes(query.trim()) ||
      String(r.slug).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border p-4 ${queue.length > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
        <p className="text-sm font-bold text-[var(--text-primary)]">
          {loading ? t('opsStays.loading') : t('opsStays.queueCount', { count: queue.length })}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('opsStays.queueExplainer')}</p>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('opsStays.filterPlaceholder')}
          aria-label={t('opsStays.filterPlaceholder')}
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-2.5 ps-9 pe-3 text-sm outline-none focus:border-[var(--accent-primary)]"
        />
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
      {saved && <p role="status" className="text-xs text-emerald-600">{t('opsStays.capacitySaved')}</p>}

      {loading ? (
        <div className="flex justify-center py-10 text-[var(--text-secondary)]"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-container)] text-xs text-[var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-start font-bold">{t('opsStays.col.property')}</th>
                <th className="px-3 py-2 text-start font-bold">{t('opsStays.col.type')}</th>
                <th className="px-3 py-2 text-start font-bold">{t('opsStays.col.price')}</th>
                <th className="px-3 py-2 text-end font-bold">{t('opsStays.col.giveCapacity')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(row => {
                const id = String(row.accommodationId);
                const busy = saving === id;
                const customValue = custom[id] ?? '';
                return (
                  <tr key={id} className="border-t border-[var(--border-subtle)]">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-[var(--text-primary)]">{isAr && row.nameAr ? String(row.nameAr) : String(row.name)}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{String(row.slug)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{String(row.propertyType)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-[var(--text-secondary)]">
                      {Number(row.perNightEGP) > 0 ? `${fmtEGP(row.perNightEGP)} EGP` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {[1, 2, 5, 10, 20].map(n => (
                          <button
                            key={n}
                            type="button"
                            disabled={busy}
                            onClick={() => void giveCapacity(row, n)}
                            aria-label={t('opsStays.giveUnits', { count: n })}
                            className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
                          >
                            {n}
                          </button>
                        ))}
                        {/* Any other count — a 34-room hotel is not 20. */}
                        <input
                          type="number"
                          min={1}
                          max={2000}
                          value={customValue}
                          onChange={e => setCustom(c => ({ ...c, [id]: e.target.value }))}
                          aria-label={t('opsStays.customUnits')}
                          placeholder="#"
                          className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          disabled={busy || !(Number(customValue) > 0)}
                          onClick={() => void giveCapacity(row, Math.round(Number(customValue)))}
                          className="rounded-lg bg-[var(--accent-primary)] px-2.5 py-1 text-xs font-bold text-[var(--surface-container)] disabled:opacity-40"
                        >
                          {t('opsStays.set')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]">
                    {queue.length === 0 ? t('opsStays.queueEmpty') : t('opsStays.noMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 50 && (
        <p className="text-[11px] text-[var(--text-secondary)]">{t('opsStays.showingFirst', { count: filtered.length })}</p>
      )}
    </div>
  );
};

const BookingsQueue: React.FC = () => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<string>('PENDING_PAYMENT');
  // "Deposit received" moves money into escrow: one click arms it, a second
  // confirms, so a stray tap on the wrong row cannot confirm a payment.
  const [armedPaid, setArmedPaid] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminListStayBookings(status || undefined);
      setRows(data.bookings as Array<Record<string, unknown>>);
    } catch (e: any) {
      setError(String(e?.message || t('opsStays.bookingsFailed')));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => { void load(); }, [load]);

  const act = async (ref: string, fn: () => Promise<unknown>) => {
    setBusy(ref);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(String(e?.message || t('opsStays.actionFailed')));
    } finally {
      setBusy(null);
    }
  };

  const btn = 'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-40';
  const quiet = `${btn} border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {['', ...STAY_STATUSES].map(s => (
            <button
              key={s || 'all'}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                status === s
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s ? t(STATUS_STYLE[s]?.key ?? s) : t('opsStays.all')}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ms-auto flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('opsStays.refresh')}
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10 text-[var(--text-secondary)]"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-[var(--text-secondary)]" aria-hidden="true" />
          <p className="text-sm font-bold">{t('opsStays.nothingWaiting')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(row => {
            const ref = String(row.bookingRef);
            const bd = (row.priceBreakdown ?? {}) as Record<string, unknown>;
            const pi = (row.paymentInstructions ?? {}) as { method?: unknown; payerNumber?: unknown; payerReference?: unknown };
            const s = String(row.status);
            const busyRow = busy === ref;
            // Settled at the property: the button gives way to a badge, so the
            // desk can see at a glance that the money is in.
            const balancePaid = Boolean(row.balanceSettledAt);
            const settleButton = !balancePaid && (
              <button type="button" disabled={busyRow} onClick={() => void act(ref, () => api.adminSettleStayBalance(ref, {}))} className={quiet}>
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                {t('opsStays.balanceSettled')}
              </button>
            );
            return (
              <div key={ref} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-[var(--text-primary)]">{ref}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[s]?.cls ?? 'bg-[var(--surface-container)] text-[var(--text-secondary)]'}`}>
                        {t(STATUS_STYLE[s]?.key ?? s)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{fmtDate(row.checkIn)} → {fmtDate(row.checkOut)}</span>
                      <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden="true" />{t('opsStays.roomsNights', { rooms: String(row.rooms), nights: String(row.nights) })}</span>
                      <span className="flex items-center gap-1">{String(row.travelerName)}{row.travelerPhone ? ` · ${String(row.travelerPhone)}` : ''}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-bold text-[var(--accent-primary)]">{t('opsStays.deposit', { amount: fmtEGP(row.depositEGP) })}</span>
                      <span className="text-[var(--text-secondary)]">{t('opsStays.total', { amount: fmtEGP(bd.totalEGP) })}</span>
                      {balancePaid ? (
                        <span className="font-bold text-emerald-500">{t('opsStays.balancePaid', { amount: fmtEGP(bd.balanceDueEGP) })}</span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">{t('opsStays.balance', { amount: fmtEGP(bd.balanceDueEGP) })}</span>
                      )}
                    </div>
                    {typeof row.paymentProofUrl === 'string' && (
                      <a href={String(row.paymentProofUrl)} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] font-bold text-sky-600 underline">
                        {t('opsStays.viewReceipt')}
                      </a>
                    )}
                    {/* What the guest said they sent: the wallet app shows "from 010…",
                        so this is the line the desk matches against. */}
                    {(typeof pi.payerNumber === 'string' || typeof pi.payerReference === 'string') && (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-amber-600">
                        <span>{t(`payment.${String(pi.method ?? '').toLowerCase().replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())}`)}</span>
                        {typeof pi.payerNumber === 'string' && <span className="font-mono">{t('opsStays.paidFrom', { number: String(pi.payerNumber) })}</span>}
                        {typeof pi.payerReference === 'string' && <span className="font-mono">{t('opsStays.payerRef', { ref: String(pi.payerReference) })}</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {s === 'PENDING_PAYMENT' && (
                      armedPaid === ref ? (
                        <>
                          <button
                            type="button"
                            disabled={busyRow}
                            onClick={() => {
                              setArmedPaid(null);
                              void act(ref, () => api.adminMarkStayPaid(ref, typeof pi.payerReference === 'string' ? { reference: String(pi.payerReference) } : {}));
                            }}
                            className={`${btn} bg-emerald-600 text-white`}
                          >
                            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('opsStays.confirmDepositReceived', { amount: fmtEGP(row.depositEGP) })}
                          </button>
                          <button type="button" onClick={() => setArmedPaid(null)} className={quiet}>
                            {t('opsStays.notYet')}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => setArmedPaid(ref)}
                          className={`${btn} bg-[var(--accent-primary)] text-[var(--surface-container)]`}
                        >
                          <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('opsStays.depositReceived')}
                        </button>
                      )
                    )}
                    {s === 'PENDING_CONFIRMATION' && (
                      <>
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => void act(ref, () => api.adminRespondToStay(ref, { approve: true }))}
                          className={`${btn} bg-emerald-600 text-white`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('opsStays.approve')}
                        </button>
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => void act(ref, () => api.adminRespondToStay(ref, { approve: false, reason: 'declined' }))}
                          className={`${btn} border border-rose-500/40 text-rose-600`}
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('opsStays.decline')}
                        </button>
                      </>
                    )}
                    {s === 'CONFIRMED' && (
                      <>
                        <button type="button" disabled={busyRow} onClick={() => void act(ref, () => api.adminStayCheckIn(ref))} className={quiet}>
                          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('opsStays.checkIn')}
                        </button>
                        {settleButton}
                        {/* The server refuses before the check-in date. */}
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => void act(ref, () => api.adminMarkStayNoShow(ref))}
                          className={`${btn} border border-rose-500/30 text-rose-500 hover:bg-rose-500/10`}
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('opsStays.noShow')}
                        </button>
                      </>
                    )}
                    {s === 'IN_HOUSE' && settleButton}
                    {s === 'IN_HOUSE' && (
                      <button
                        type="button"
                        disabled={busyRow}
                        onClick={() => void act(ref, () => api.adminCompleteStay(ref))}
                        className={`${btn} bg-emerald-600 text-white`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('opsStays.complete')}
                      </button>
                    )}
                    {/* Cancel from the desk. It used to call "decline", which the
                        server only allows for a paid, unconfirmed stay, so it
                        failed for every other status it was shown on. */}
                    {(s === 'PENDING_PAYMENT' || s === 'PENDING_CONFIRMATION' || s === 'CONFIRMED') && (
                      confirmCancel === ref ? (
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => {
                            setConfirmCancel(null);
                            void act(ref, () => api.adminCancelStay(ref, 'cancelled by staff'));
                          }}
                          className={`${btn} bg-rose-600 text-white`}
                        >
                          {t('opsStays.confirmCancel')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => setConfirmCancel(ref)}
                          aria-label={t('opsStays.cancelStay', { ref })}
                          title={t('opsStays.cancelStay', { ref })}
                          className="flex items-center rounded-xl px-2.5 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-rose-600 disabled:opacity-40"
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaysConsole;
