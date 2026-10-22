import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, BedDouble, Users, CalendarDays, Loader2, AlertTriangle, Info, Receipt,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../context/TripContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { createPlanningTrip } from '../../services/tripLifecycle';
import { CmsImage } from '../common/CmsImage';

/**
 * Full checkout for a stay — the page the traveller lands on from the sidebar.
 *
 * Everything the reservation needs is read from the URL (property, room type,
 * window, party) and the quote is re-quoted live: if the price moved between
 * the sidebar and here, this page says so before anything is held. The reserve
 * call re-prices again under its own lock, so this figure and the booking can
 * never be two different numbers.
 */

interface StayCheckoutViewProps {
  params: {
    accommodationSlug: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    rooms: number;
    adults: number;
    children: number;
  };
  onBack: () => void;
  onBooked: (ref: string) => void;
}

/* ── P0-01 FIX: removed reservation stub ── */
const PAYMENT_METHODS = [
  { id: 'INSTAPAY', labelKey: 'payment.instapay', detailKey: 'payment.instapayDetail', fast: true },
  { id: 'VODAFONE_CASH', labelKey: 'payment.vodafoneCash', detailKey: 'payment.vodafoneCashDetail', fast: true },
  { id: 'CASH_ON_ARRIVAL', labelKey: 'payment.cashOnArrival', detailKey: 'payment.cashOnArrivalDetail', fast: false },
  { id: 'BANK_TRANSFER', labelKey: 'payment.bankTransfer', detailKey: 'payment.bankTransferDetail', fast: false },
  { id: 'CASH_AT_PROPERTY', labelKey: 'payment.cashAtProperty', detailKey: 'payment.cashAtPropertyDetail', fast: false },
] as const;

export const StayCheckoutView: React.FC<StayCheckoutViewProps> = ({ params, onBack, onBooked }) => {
  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();
  const { navigateTo, sessionUser, setIntendedRoute } = useTrip();
  const isAr = language === 'ar';

  const slug = params.accommodationSlug;
  const nights =
    params.checkOut > params.checkIn
      ? Math.round((Date.parse(params.checkOut) - Date.parse(params.checkIn)) / 86_400_000)
      : 0;

  const stay = useApiResource<import('../../shared/types/commerce').AccommodationDetailResponse>(
    useMemo(
      () => signal => api.getAccommodationBySlug(slug, signal),
      [slug]
    )
  );

  const roomTypesRes = useApiResource<{
    accommodationId: string;
    heldBack: boolean;
    roomTypes: Array<{ id: string; name: string; nameAr: string; baseNightlyEGP: number; maxGuestsPerUnit: number; totalUnits: number }>;
  }>(
    useMemo(() => signal => api.getRoomTypes(slug, signal), [slug])
  );

  const quote = useApiResource<{ quote: Record<string, unknown> } | null>(
    useMemo(
      () => async signal => {
        if (!slug || nights < 1) return null;
        return await api.quoteStay(slug, {
          roomTypeId: params.roomTypeId,
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          rooms: params.rooms,
          adults: params.adults,
          children: params.children,
          signal,
        });
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [slug, params]
    )
  );

  const accommodation = stay.data?.accommodation ?? null;
  const roomType = roomTypesRes.data?.roomTypes.find(r => r.id === params.roomTypeId) ?? null;

  const [paymentMethod, setPaymentMethod] = useState<string>('CASH_ON_ARRIVAL');
  // The signed-in account pre-fills the lead guest name: retyping "Ahmed
  // Mohamed" on every checkout asked the traveler to prove data the app
  // already holds. It stays editable — some stays are booked for someone
  // else — and the remaining guests stay blank.
  const [guestNames, setGuestNames] = useState<string[]>(() =>
    Array.from({ length: Math.max(1, params.adults + params.children) }, (_, i) =>
      i === 0 ? (sessionUser?.name ?? '') : ''
    )
  );
  const [specialRequests, setSpecialRequests] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the guest-name list in step with the party size from the URL.
  useEffect(() => {
    const want = Math.max(1, params.adults + params.children);
    setGuestNames(prev => {
      if (prev.length === want) return prev;
      return Array.from({ length: want }, (_, i) => prev[i] ?? '');
    });
  }, [params.adults, params.children]);

  const q = quote.data?.quote ?? null;
  const totalEGP = typeof q?.totalEGP === 'number' ? q.totalEGP : null;
  // Cash on arrival takes no deposit (the server books it that way too), so
  // the summary and the button must not ask for one.
  const noDeposit = paymentMethod === 'CASH_ON_ARRIVAL';
  const depositEGP = noDeposit ? (totalEGP === null ? null : 0) : typeof q?.depositEGP === 'number' ? q.depositEGP : null;
  const balanceDueEGP = noDeposit ? totalEGP : typeof q?.balanceDueEGP === 'number' ? q.balanceDueEGP : null;
  // The real cancellation deadline for these dates, not a blanket "48 hours".
  const freeUntil = typeof q?.freeCancellationUntil === 'string' ? q.freeCancellationUntil : null;
  const freeWindowOpen = freeUntil !== null && new Date(freeUntil).getTime() > Date.now();
  const cancellationNote = freeUntil === null
    ? t('hotels.freeCancellationNote')
    : freeWindowOpen
      ? t('hotels.freeCancellationUntil', {
          time: new Date(freeUntil).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        })
      : t('hotels.freeCancellationPassed');
  const currency = typeof q?.currency === 'string' ? q.currency : 'EGP';
  const selectedMethod = PAYMENT_METHODS.find(m => m.id === paymentMethod) ?? PAYMENT_METHODS[0];

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const guestDetails = guestNames
        .map((fullName, i) => ({ fullName, isChild: i >= params.adults }))
        .filter(g => g.fullName.trim().length > 0);

      // A stay is filed under its own trip. Without a tripId the reservation
      // still books, but nothing links it to an itinerary — no trip item on
      // confirmation, no appearance in My Trip — so the traveller would hold a
      // reference code and nothing else.
      let tripId: string | undefined;
      if (nights >= 1) {
        const start = new Date(`${params.checkIn}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startsInDays = Math.max(0, Math.round((start.getTime() - today.getTime()) / 86_400_000));
        const trip = await createPlanningTrip({
          title: `${t('hotels.tripTitle')} — ${isAr ? accommodation?.nameAr ?? '' : accommodation?.name ?? ''}`,
          lengthDays: nights,
          travelersCount: params.adults + params.children,
          startsInDays,
          totalEstimatedEGP: totalEGP ?? 0,
          idPrefix: 'TRIP-STAY',
        });
        tripId = trip.id;
      }

      const data = (await api.reserveStay({
        accommodationId: accommodation?.id ?? '',
        roomTypeId: params.roomTypeId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        rooms: params.rooms,
        adults: params.adults,
        children: params.children,
        guestDetails: guestDetails.length > 0 ? guestDetails : undefined,
        specialRequests: specialRequests.trim() || undefined,
        arrivalTime: arrivalTime.trim() || undefined,
        paymentMethod,
        idempotencyKey: `STAY-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        tripId,
      })) as { booking: { bookingRef: string } };

      onBooked(data.booking.bookingRef);
    } catch (e: any) {
      setError(String(e?.message || t('hotels.reserveFailed')));
      setSubmitting(false);
    }
  };

  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  if (!sessionUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-[var(--bg-canvas)]' : 'bg-[var(--bg-canvas)]'}`}>
        <div className="max-w-sm text-center space-y-4">
          <AlertTriangle className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h1 className="text-xl font-black">{t('hotels.signInToReserve')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('hotels.signInToReserveBody')}</p>
          <button
            type="button"
            onClick={() => {
              // Come back to this exact checkout (dates, room, party in the
              // URL) after signing in, instead of landing on My Trip.
              setIntendedRoute(`${window.location.pathname}${window.location.search}`);
              navigateTo('/auth/sign-in');
            }}
            className="rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] px-6 py-3 text-sm font-bold"
          >
            {t('shell.signIn')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`min-h-screen ${isDark ? 'bg-[var(--bg-canvas)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'}`}
    >
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {stay.status === 'loading' && !accommodation && (
          <div className="flex items-center justify-center py-16 text-[var(--text-secondary)]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {accommodation && (
          <>
            {/* Stay summary */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
              <div className="relative h-44">
                <CmsImage
                  src={accommodation.coverImageUrl ?? ''}
                  alt={isAr ? accommodation.nameAr : accommodation.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 start-4 end-4 text-white">
                  <h2 className="font-display text-2xl font-semibold">{isAr ? accommodation.nameAr : accommodation.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      {fmtDay(params.checkIn)} → {fmtDay(params.checkOut)}
                      <span className="opacity-80">({t('hotels.bookingNightsCount', { count: nights })})</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-4 h-4" />
                      {params.rooms} {isAr ? 'غرفة' : 'room(s)'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {params.adults + params.children}
                    </span>
                  </div>
                </div>
              </div>

              {roomType && (
                <div className="px-4 py-3 flex items-center justify-between border-t border-[var(--border-subtle)]">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {t('hotels.roomTypeLabel')}: {isAr ? roomType.nameAr : roomType.name}
                  </span>
                  <span className="text-sm font-black text-[var(--accent-primary)]">
                    {roomType.baseNightlyEGP.toLocaleString()} {currency} / {isAr ? 'الليلة' : 'night'}
                  </span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[var(--accent-primary)]" />
                {t('hotels.priceSummary')}
              </h3>
              {quote.status === 'loading' && !q ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('hotels.quoting')}
                </div>
              ) : q && totalEGP !== null ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">
                      {(roomType?.baseNightlyEGP ?? 0).toLocaleString()} {currency} × {nights} {isAr ? 'ليلة' : 'nights'} × {params.rooms} {isAr ? 'غرفة' : 'room(s)'}
                    </span>
                    <span className="font-bold">{Number(q.baseEGP ?? 0).toLocaleString()} {currency}</span>
                  </div>
                  {typeof q.longStayDiscountEGP === 'number' && q.longStayDiscountEGP > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>{t('hotels.longStayDiscount')}</span>
                      <span>−{q.longStayDiscountEGP.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  {typeof q.serviceFeeEGP === 'number' && q.serviceFeeEGP > 0 && (
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>{t('hotels.serviceFee')}</span>
                      <span>{q.serviceFeeEGP.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  {typeof q.taxEGP === 'number' && q.taxEGP > 0 && (
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>{t('hotels.tax')}</span>
                      <span>{q.taxEGP.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  <div className="border-t border-[var(--border-subtle)] pt-1.5 flex justify-between font-black">
                    <span>{t('hotels.stayTotal')}</span>
                    <span className="text-lg text-[var(--accent-primary)]">{totalEGP.toLocaleString()} {currency}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className={`rounded-xl border p-2.5 ${isDark ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5' : 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'}`}>
                      <div className={`text-[11px] ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                        {t('hotels.depositNow')}
                      </div>
                      <div className="text-base font-black text-[var(--accent-primary)]">
                        {depositEGP?.toLocaleString()} {currency}
                      </div>
                    </div>
                    <div className={`rounded-xl border p-2.5 ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}>
                      <div className={`text-[11px] ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                        {t('hotels.balanceOnArrival')}
                      </div>
                      <div className="text-base font-black">{balanceDueEGP?.toLocaleString()} {currency}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div role="alert" className="flex items-start gap-2 text-xs text-rose-500">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {t('hotels.quoteFailed')}
                </div>
              )}
            </div>

            {/* Guests */}
            <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
              <h3 className="text-sm font-bold">{t('hotels.whoIsComing')}</h3>
              <div className="space-y-2">
                {guestNames.map((name, i) => (
                  <label key={i} className="block">
                    <span className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                      {i === 0
                        ? t('hotels.primaryGuest')
                        : i < params.adults
                          ? t('hotels.adultN', { n: i + 1 })
                          : t('hotels.childN', { n: i - params.adults + 1 })}
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setGuestNames(prev => prev.map((v, j) => (j === i ? e.target.value : v)))}
                      placeholder={i === 0 ? t('hotels.fullNamePlaceholder') : ''}
                      className={`mt-1 w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                    />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                    {t('hotels.arrivalTime')}
                  </span>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={e => setArrivalTime(e.target.value)}
                    className={`mt-1 w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                  />
                </label>
                <label className="block">
                  <span className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                    {t('hotels.specialRequests')}
                  </span>
                  <input
                    type="text"
                    value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                    className={`mt-1 w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                  />
                </label>
              </div>
            </div>

            {/* Payment method */}
            <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
              <h3 className="text-sm font-bold">{t('hotels.paymentMethod')}</h3>
              <div className="space-y-2" role="radiogroup" aria-label={t('hotels.paymentMethod')}>
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`w-full rounded-xl border p-3 text-start transition-colors ${
                      paymentMethod === m.id
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                        : `border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--btn-util-hover)]`
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${paymentMethod === m.id ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                        {paymentMethod === m.id && <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />}
                      </span>
                      <span className="text-sm font-bold text-[var(--text-primary)]">{t(m.labelKey)}</span>
                      {m.fast && (
                        <span className="ms-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          {t('payment.fastestConfirm')}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <p className={`text-xs flex items-start gap-1.5 ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {t(selectedMethod.detailKey)}
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            <button
              type="button"
              data-testid="checkout-submit"
              disabled={submitting || nights < 1 || totalEGP === null}
              onClick={() => void submit()}
              className="w-full rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--surface-container)] py-3.5 text-sm font-bold shadow-xs transition-all active:scale-[0.99]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('hotels.reserving')}
                </span>
              ) : (
                noDeposit
                  ? t('hotels.confirmReservationNoDeposit')
                  : t('hotels.confirmReservation', { deposit: (depositEGP ?? 0).toLocaleString(), currency })
              )}
            </button>

            <p className={`text-[10px] leading-relaxed text-center ${isDark ? 'text-[var(--text-secondary)]/50' : 'text-[var(--text-secondary)]/50'}`}>
              {cancellationNote}
            </p>
          </>
        )}

        {!stay.data && stay.status !== 'loading' && (
          <div className="rounded-2xl border p-10 text-center bg-[var(--surface-card)] border-[var(--border-subtle)]">
            <h1 className="text-2xl font-display font-semibold text-[var(--text-primary)] mb-3">{t('checkout.linkExpired.title')}</h1>
            <p className="text-[var(--text-secondary)] mb-6">{t('checkout.linkExpired.body')}</p>
            <a href="/hotels/stays" className="inline-block px-6 py-2 rounded-xl bg-[var(--accent-primary)] text-white font-bold">{t('checkout.linkExpired.cta')}</a>
          </div>
        )}
      </main>
    </div>
  );
};
