import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BedDouble, Users, CalendarDays, Loader2, AlertTriangle, Info, Baby } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../context/TripContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { DatePickerPopover, diffNights } from './DatePickerPopover';

/**
 * The booking sidebar for a stay — the whole reservation in one column.
 *
 * Built around one question: "what will I pay?" The answer reads top to
 * bottom — when, who, then a total with the deposit called out — so nothing
 * needs comparing across columns. Three steppers side by side overflowed a
 * 320px sidebar and cut "Children" off; rows keep every control reachable.
 */

export interface RoomTypeOption {
  id: string;
  name: string;
  nameAr: string;
  maxGuestsPerUnit: number;
  baseNightlyEGP: number;
  totalUnits: number;
  inventorySource: string;
  heldBack?: boolean;
}

interface StayBookingPanelProps {
  accommodationSlug: string;
  /** The property's nightly fallback, shown only when no room types are on sale. */
  fallbackNightlyEGP: number;
  onReserve: (params: {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    rooms: number;
    adults: number;
    children: number;
  }) => void;
}

/** One labelled row: name on the left, the − value + stepper on the right. */
const GuestRow = ({
  icon,
  label,
  value,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      {icon}
      <span>{label}</span>
    </span>
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`− ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] text-base font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--btn-util-hover)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        −
      </button>
      <span className="w-7 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`+ ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] text-base font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--btn-util-hover)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        +
      </button>
    </span>
  </div>
);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const StayBookingPanel: React.FC<StayBookingPanelProps> = ({
  accommodationSlug,
  fallbackNightlyEGP,
  onReserve,
}) => {
  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();
  const { navigateTo } = useTrip();
  const isAr = language === 'ar';

  const roomTypesRes = useApiResource<{
    accommodationId: string;
    heldBack: boolean;
    roomTypes: RoomTypeOption[];
  }>(
    useMemo(
      () => signal => api.getRoomTypes(accommodationSlug, signal),
      [accommodationSlug]
    )
  );

  const [checkIn, setCheckIn] = useState<string>(todayIso());
  const [checkOut, setCheckOut] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const roomTypes = roomTypesRes.data?.roomTypes ?? [];
  const sellableTypes = roomTypes.filter(rt => rt.totalUnits > 0);
  const selected = sellableTypes.find(rt => rt.id === selectedRoomTypeId) ?? sellableTypes[0] ?? null;

  const nights = diffNights(checkIn, checkOut);

  // A fresh room-type list invalidates a selection that no longer exists.
  React.useEffect(() => {
    if (sellableTypes.length === 0) {
      setSelectedRoomTypeId(null);
    } else if (!sellableTypes.some(rt => rt.id === selectedRoomTypeId)) {
      setSelectedRoomTypeId(sellableTypes[0].id);
    }
  }, [sellableTypes, selectedRoomTypeId]);

  const fetchQuote = async (rtId: string) => {
    setQuoting(true);
    setQuoteError(null);
    setQuote(null);
    try {
      const data = (await api.quoteStay(accommodationSlug, {
        roomTypeId: rtId,
        checkIn,
        checkOut,
        rooms,
        adults,
        children,
      })) as { quote: Record<string, unknown> };
      setQuote(data.quote);
    } catch (e: any) {
      setQuoteError(String(e?.message || t('hotels.quoteFailed')));
    } finally {
      setQuoting(false);
    }
  };

  // Quoting is live: any change in the window or the party re-prices.
  React.useEffect(() => {
    if (!selected || nights < 1) return;
    const handle = setTimeout(() => {
      void fetchQuote(selected.id);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, checkIn, checkOut, rooms, adults, children]);

  const totalEGP = typeof quote?.totalEGP === 'number' ? quote.totalEGP : null;
  const depositEGP = typeof quote?.depositEGP === 'number' ? quote.depositEGP : null;
  const balanceDueEGP = typeof quote?.balanceDueEGP === 'number' ? quote.balanceDueEGP : null;
  const longStayDiscountEGP = typeof quote?.longStayDiscountEGP === 'number' ? quote.longStayDiscountEGP : 0;

  if (sellableTypes.length === 0) {
    // Two very different reasons for an empty list: the property genuinely has
    // no confirmed capacity yet (held back by the backfill), or the fetch
    // failed. Telling a traveller "this stay cannot be booked" because a
    // request aborted is a lie about the property — only the held-back truth
    // gets that sentence; a network failure gets a retry instead. Nor is a
    // list still in flight: on a slow link the held-back notice flashed for
    // seconds before the real panel replaced it.
    if (roomTypesRes.status === 'idle' || roomTypesRes.status === 'loading') {
      return (
        <div
          aria-busy="true"
          className="rounded-2xl border p-5 space-y-3 bg-[var(--surface-card)] border-[var(--border-subtle)]"
        >
          <div className="h-8 w-40 rounded-lg bg-[var(--border-subtle)] animate-pulse" />
          <div className="h-16 rounded-xl bg-[var(--border-subtle)] animate-pulse" />
          <div className="h-10 rounded-xl bg-[var(--border-subtle)] animate-pulse" />
        </div>
      );
    }
    if (roomTypesRes.status === 'error') {
      return (
        <div className={`rounded-2xl border p-5 space-y-3 ${isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'}`}>
          <div className={`text-2xl font-black ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
            {fallbackNightlyEGP.toLocaleString()} EGP
            <span className={`text-sm font-normal text-[var(--text-secondary)]`}>
              {' '}/ {isAr ? 'الليلة' : 'night'}
            </span>
          </div>
          <div role="alert" className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
            <span>{t('hotels.roomTypesFailed')}</span>
          </div>
          <button
            type="button"
            onClick={() => roomTypesRes.reload()}
            className="w-full rounded-xl border border-[var(--border-subtle)] py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t('hotels.retry')}
          </button>
        </div>
      );
    }
    return (
      <div className={`rounded-2xl border p-5 space-y-3 ${isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'}`}>
        <div className={`text-2xl font-black ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
          {fallbackNightlyEGP.toLocaleString()} EGP
          <span className={`text-sm font-normal text-[var(--text-secondary)]`}>
            {' '}/ {isAr ? 'الليلة' : 'night'}
          </span>
        </div>
        <div role="status" className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--accent-primary)]" />
          <span>{t('hotels.stayHeldBack')}</span>
        </div>
      </div>
    );
  }

  // Not gated on `quoting`: every change re-prices, and the button blinking
  // disabled for each request swallowed clicks that landed mid-quote. The
  // checkout re-prices on arrival, so nothing stale can be charged.
  const canReserve = selected && nights >= 1;
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const maxRooms = Math.max(1, selected?.totalUnits ?? 1);

  return (
    <motion.div
      dir={isRTL ? 'rtl' : 'ltr'}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      data-testid="stay-booking-panel"
      className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'}`}
    >
      {/* 1 — When */}
      <div className="relative space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {t('hotels.stayDates')}
        </h3>
        <button
          type="button"
          data-testid="stay-date-field"
          onClick={() => setCalendarOpen(v => !v)}
          aria-expanded={calendarOpen}
          className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 text-start text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--btn-util-hover)]"
        >
          <CalendarDays className="h-5 w-5 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
          <span className="font-medium">
            {nights > 0 ? `${fmtDay(checkIn)} → ${fmtDay(checkOut)}` : t('hotels.stayPickDates')}
          </span>
          {nights > 0 && (
            <span className="ms-auto rounded-full bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]">
              {t('hotels.bookingNightsCount', { count: nights })}
            </span>
          )}
        </button>
        {calendarOpen && (
          <DatePickerPopover
            checkIn={checkIn}
            checkOut={checkOut}
            onChange={(ci, co) => {
              setCheckIn(ci);
              setCheckOut(co);
              setQuote(null);
            }}
            onClose={() => setCalendarOpen(false)}
          />
        )}
      </div>

      {/* 2 — Who */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] pb-1">
          {t('hotels.stayRoomsGuests')}
        </h3>
        <GuestRow
          icon={<BedDouble className="h-4 w-4" aria-hidden="true" />}
          label={t('hotels.roomsLabel')}
          value={rooms}
          min={1}
          max={maxRooms}
          onChange={v => { setRooms(v); setQuote(null); }}
        />
        <GuestRow
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          label={t('hotels.bookingGuests')}
          value={adults}
          min={1}
          max={selected?.maxGuestsPerUnit ?? 10}
          onChange={v => { setAdults(v); setQuote(null); }}
        />
        <GuestRow
          icon={<Baby className="h-4 w-4" aria-hidden="true" />}
          label={t('hotels.childrenLabel')}
          value={children}
          min={0}
          max={10}
          onChange={v => { setChildren(v); setQuote(null); }}
        />
      </div>

      {/* Room type — only when there is a choice to make */}
      {sellableTypes.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('hotels.stayRoomType')}
          </h3>
          <div className="space-y-2">
            {sellableTypes.map(rt => (
              <button
                key={rt.id}
                type="button"
                onClick={() => setSelectedRoomTypeId(rt.id)}
                aria-pressed={selected?.id === rt.id}
                className={`w-full rounded-xl border p-3 text-start transition-colors ${
                  selected?.id === rt.id
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--btn-util-hover)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {isAr ? rt.nameAr : rt.name}
                  </span>
                  <span className="text-sm font-black text-[var(--accent-primary)]">
                    {rt.baseNightlyEGP.toLocaleString()} EGP
                    <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                      {' '}/ {isAr ? 'الليلة' : 'night'}
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span>{t('hotels.sleepsUpTo', { count: rt.maxGuestsPerUnit })}</span>
                  {rt.totalUnits <= 3 && (
                    <span className="font-bold text-[var(--accent-primary)]">
                      {t('hotels.onlyNLeft', { count: rt.totalUnits })}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 — What I pay. The total leads; the math that produced it sits under
          it in small print, and the only number asked for now is the deposit. */}
      <div className={`rounded-xl border p-3.5 space-y-2 ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-container)]' : 'border-[var(--border-subtle)] bg-[var(--surface-container)]'}`}>
        {quoting ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('hotels.quoting')}
          </div>
        ) : quoteError ? (
          <div role="alert" className="text-xs text-rose-500">{quoteError}</div>
        ) : quote && totalEGP !== null ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-[var(--text-primary)]">{t('hotels.stayTotal')}</span>
              <span className="text-2xl font-black text-[var(--text-primary)]">
                {totalEGP.toLocaleString()} EGP
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {(selected?.baseNightlyEGP ?? 0).toLocaleString()} EGP × {nights} {isAr ? 'ليلة' : 'nights'} × {rooms} {isAr ? 'غرفة' : 'room(s)'}
            </div>
            {longStayDiscountEGP > 0 && (
              <div className="flex justify-between text-[11px] text-emerald-600">
                <span>{t('hotels.longStayDiscount')}</span>
                <span>−{longStayDiscountEGP.toLocaleString()} EGP</span>
              </div>
            )}
            <div className="border-t border-[var(--border-subtle)] pt-2 space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-[var(--accent-primary)]/10 px-2.5 py-1.5">
                <span className="text-xs font-bold text-[var(--text-primary)]">{t('hotels.depositNow')}</span>
                <span className="text-sm font-black text-[var(--accent-primary)]">
                  {depositEGP?.toLocaleString()} EGP
                </span>
              </div>
              <div className="flex justify-between px-2.5 text-[11px] text-[var(--text-secondary)]">
                <span>{t('hotels.balanceOnArrival')}</span>
                <span className="font-bold">{balanceDueEGP?.toLocaleString()} EGP</span>
              </div>
            </div>
          </>
        ) : (
          <div className={`flex items-start gap-2 text-[11px] ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]/70'}`}>
            <Info className="h-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{t('hotels.stayQuoteHint')}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid="stay-reserve-submit"
        disabled={!canReserve}
        onClick={() => {
          if (!selected) return;
          navigateTo('/hotels/checkout', {
            accommodationSlug,
            roomTypeId: selected.id,
            checkIn,
            checkOut,
            rooms,
            adults,
            children,
          });
        }}
        className="w-full rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--surface-container)] py-3.5 text-sm font-bold shadow-xs transition-all active:scale-[0.98]"
      >
        {t('hotels.reserveNow')}
      </button>

      <p className={`text-[10px] leading-relaxed ${isDark ? 'text-[var(--text-secondary)]/50' : 'text-[var(--text-secondary)]/50'}`}>
        {t('hotels.reserveNote')}
      </p>
    </motion.div>
  );
};
