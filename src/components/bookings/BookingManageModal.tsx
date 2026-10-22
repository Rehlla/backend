import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Loader2,
  Lock,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
  Waves,
  Bike,
  Phone,
  X
} from 'lucide-react';
import { api, BookingDetail } from '../../services/api';
import { ApiError } from '../../services/apiError';
import {
  availabilitySlotViews,
  AvailabilitySlotView,
  bookingActionError,
  BookingErrorInfo,
  cancellationEligibility,
  freeCancellationView,
  rescheduleEligibility
} from '../../services/bookingManage';
import { Badge } from '../ui/badge';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ConfirmedBookingItem } from '../../types';
import { BookingTimeline } from './BookingTimeline';

interface BookingManageModalProps {
  booking: ConfirmedBookingItem;
  hasTrip: boolean;
  onClose: () => void;
  /** Called after the server confirms a change so the list re-reads the trip. */
  onBookingChanged: () => void;
}

type DetailState = 'loading' | 'ready' | 'missing' | 'error';

type ManageError = BookingErrorInfo | null;

/** A date string safe to put in <input type="date"> (local time, not UTC). */
function inputDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfToday(): string {
  return inputDate(new Date());
}

const ICONS: Record<string, React.ReactNode> = {
  building: <Building className="w-5 h-5" />,
  car: <Car className="w-5 h-5" />,
  waves: <Waves className="w-5 h-5" />,
  compass: <Compass className="w-5 h-5" />,
  sparkles: <Sparkles className="w-5 h-5" />,
  utensils: <Utensils className="w-5 h-5" />,
  bike: <Bike className="w-5 h-5" />
};

/** Presentation of a status from the server record — display only. */
function statusView(detail: BookingDetail): { labelKey: string; tone: string } {
  const TERMINAL = ['CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'];
  if (detail.paymentState === 'REFUNDED' || detail.paymentState === 'PARTIALLY_REFUNDED') {
    return { labelKey: 'bookings.status.REFUNDED', tone: 'bg-red-500/10 text-red-400 border-red-500/40' };
  }
  // Money truth beats lifecycle truth: a gateway-declared failure must never
  // sit behind a green "Confirmed" badge, even when the supplier leg is live.
  if (detail.paymentState === 'FAILED') {
    return { labelKey: 'bookings.status.FAILED', tone: 'bg-red-500/10 text-red-400 border-red-500/40' };
  }
  if (TERMINAL.includes(detail.supplierState)) {
    return { labelKey: 'bookings.status.CANCELLED', tone: 'bg-red-500/10 text-red-400 border-red-500/40' };
  }
  switch (detail.supplierState) {
    case 'COMPLETED':
      return { labelKey: 'bookings.status.COMPLETED', tone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40' };
    case 'PENDING_CONFIRMATION':
      return { labelKey: 'bookings.status.PENDING_CONFIRMATION', tone: 'bg-amber-500/10 text-amber-300 border-amber-500/40' };
    case 'CONFIRMED':
    case 'ASSIGNED':
    case 'DISPATCHED':
    case 'READY_FOR_PICKUP':
      return { labelKey: 'bookings.status.CONFIRMED', tone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40' };
    case 'IN_PROGRESS':
    case 'EN_ROUTE':
    case 'ARRIVED':
    case 'ACTIVE':
      return { labelKey: 'bookings.status.IN_PROGRESS', tone: 'bg-[var(--accent-primary)]/12 text-[var(--accent-primary)] border-[var(--accent-primary)]/40' };
    default:
      return { labelKey: 'bookings.status.default', tone: 'bg-[var(--surface-container)] text-[var(--text-secondary)] border-[var(--border-subtle)]' };
  }
}

function errorText(error: BookingErrorInfo, t: (key: string) => string): string {
  switch (error.code) {
    case 'unauthorized': return t('bookings.error.unauthorized');
    case 'forbidden': return t('bookings.error.forbidden');
    case 'notFound': return t('bookings.error.notFound');
    case 'conflict': return t('bookings.error.conflict');
    case 'invalidState': return t('bookings.error.invalidState');
    case 'rateLimited': return t('bookings.error.rateLimited');
    case 'server': return t('bookings.error.server');
    case 'network': return t('bookings.error.network');
    case 'badRequest': return t('bookings.error.invalidState');
    default: return t('bookings.error.unknown');
  }
}

const fieldRow =
  'flex items-start justify-between gap-4 text-xs';

export const BookingManageModal: React.FC<BookingManageModalProps> = ({
  booking,
  hasTrip,
  onClose,
  onBookingChanged
}) => {
  const { t, language, isRTL, formatEGP, formatNumber } = useLanguage();
  /** "Free cancellation until Thu 12 Nov, 09:30" — the server's deadline, in Dahab time. */
  const freeCancellationText = (until: string | null | undefined): string | null => {
    const view = freeCancellationView(until, language === 'ar' ? 'ar' : 'en');
    if (!view) return null;
    return view.kind === 'until'
      ? t('bookings.freeCancellation.until', { when: view.when })
      : t('bookings.freeCancellation.ended', { when: view.when });
  };

  // ---- booking record (the real backend detail) ----
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailState, setDetailState] = useState<DetailState>('loading');
  const [detailError, setDetailError] = useState<ManageError>(null);
  const [detailRetry, setDetailRetry] = useState(0);

  // ---- cancellation ----
  const [cancelPhase, setCancelPhase] = useState<'idle' | 'confirm' | 'working' | 'done'>('idle');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOutcome, setCancelOutcome] = useState<{ refunded: boolean; refundAmountEGP?: number } | null>(null);
  const [cancelError, setCancelError] = useState<ManageError>(null);

  // ---- rescheduling ----
  const [reschedulePhase, setReschedulePhase] = useState<'idle' | 'pick' | 'confirm' | 'working' | 'done'>('idle');
  const [rescheduleError, setRescheduleError] = useState<ManageError>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<AvailabilitySlotView[]>([]);
  const [chosenDate, setChosenDate] = useState('');
  const [chosenSlot, setChosenSlot] = useState<AvailabilitySlotView | null>(null);
  const [rescheduledDetail, setRescheduledDetail] = useState<BookingDetail | null>(null);

  const isRental = booking.serviceType === 'rental';
  const canManageOnline = hasTrip && !isRental;

  const defaultDate = (scheduledDate?: string): string => {
    const today = startOfToday();
    if (!scheduledDate || scheduledDate < today) return today;
    return scheduledDate.slice(0, 10);
  };

  const loadDetail = useCallback(async () => {
    if (!canManageOnline) {
      setDetailState(isRental ? 'missing' : 'error');
      if (!isRental) setDetailError({ code: 'network' });
      return;
    }
    setDetailState('loading');
    setDetailError(null);
    // The list id is the booking id for server-backed bookings; older seeded
    // itinerary lines carry an item id with no booking row, which 404s.
    const candidates = [booking.id, booking.confirmationCode].filter(
      (v, i, arr) => v && v !== '—' && v !== 'Unknown' && arr.indexOf(v) === i
    );
    for (const candidate of candidates) {
      try {
        const summary = await api.getBookingDetails(candidate);
        setDetail(summary);
        setDetailState('ready');
        setChosenDate(defaultDate(summary.scheduledDate));
        return;
      } catch (err) {
        const info = bookingActionError(err);
        if (info.code === 'notFound' && candidate !== candidates[candidates.length - 1]) continue;
        setDetailState(info.code === 'notFound' ? 'missing' : 'error');
        setDetailError(info);
        return;
      }
    }
  }, [booking.id, booking.confirmationCode, canManageOnline, isRental]);

  // Focus trap for accessibility — traps Tab inside the modal
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      (first ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
      const items = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      openerRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    loadDetail();
  }, [loadDetail, detailRetry]);

  const cancelAllowed = detail && cancellationEligibility(detail).allowed;
  const rescheduleAllowed = detail && rescheduleEligibility(detail).allowed;

  const beginCancel = () => {
    setCancelError(null);
    setCancelPhase('confirm');
  };

  const submitCancel = async () => {
    if (!detail) return;
    setCancelError(null);
    setCancelPhase('working');
    try {
      const reason = (cancelReason || 'Traveler request').slice(0, 500);
      const result = await api.cancelBooking({
        bookingId: detail.id,
        tripId: detail.tripId,
        reason,
        cancellationKey: detail.confirmationCode
      });
      setCancelOutcome({ refunded: result.refunded, refundAmountEGP: result.refundAmountEGP });
      setDetail(result.booking);
      setCancelPhase('done');
      onBookingChanged();
    } catch (err) {
      setCancelError(bookingActionError(err));
      setCancelPhase('confirm');
    }
  };

  const checkSlots = async () => {
    if (!detail || !chosenDate) return;
    setSlotsLoading(true);
    setRescheduleError(null);
    setSlots([]);
    setChosenSlot(null);
    try {
      const response = await api.checkRichAvailability({
        serviceType: detail.serviceType,
        skuId: detail.skuId,
        date: chosenDate,
        passengers: detail.passengersCount
      });
      setSlots(availabilitySlotViews(response, detail.passengersCount));
    } catch (err) {
      setRescheduleError(bookingActionError(err));
    } finally {
      setSlotsLoading(false);
    }
  };

  const beginReschedule = () => {
    setRescheduleError(null);
    setReschedulePhase('pick');
  };

  const pickSlot = (slot: AvailabilitySlotView) => {
    if (!detail) return;
    const isCurrent =
      slot.timeSlot === detail.scheduledTime && chosenDate === detail.scheduledDate;
    if (isCurrent || slot.kind === 'sold-out' || slot.kind === 'fits-no-party') return;
    setChosenSlot(slot);
    setRescheduleError(null);
    setReschedulePhase('confirm');
  };

  const submitReschedule = async () => {
    if (!detail || !chosenSlot) return;
    setRescheduleError(null);
    setReschedulePhase('working');
    try {
      const result = await api.rescheduleBooking(detail.id, {
        tripId: detail.tripId,
        newDate: chosenDate,
        newTime: chosenSlot.timeSlot,
        idempotencyKey: `RSCH-${detail.id}-${Date.now()}`
      });
      setRescheduledDetail(result.booking);
      setDetail(result.booking);
      setReschedulePhase('done');
      onBookingChanged();
    } catch (err) {
      const info = bookingActionError(err);
      setRescheduleError(info);
      if (info.code === 'conflict') {
        // The slot vanished between the check and the confirm. Stay on the
        // picker so the traveler chooses another slot; their old booking is
        // untouched (the server guarantees it).
        setReschedulePhase('pick');
      } else {
        setReschedulePhase('confirm');
      }
    }
  };

  const cancelling = cancelPhase === 'working';
  const rescheduling = reschedulePhase === 'working';
  const busy = cancelling || rescheduling || slotsLoading || detailState === 'loading';

  const pricePerPerson = detail && detail.passengersCount > 0 ? detail.amountEGP / detail.passengersCount : null;
  const slotPriceDiffers = chosenSlot && pricePerPerson != null && Math.abs(chosenSlot.priceEGP - pricePerPerson) > 0.5;

  const close = () => {
    if (busy) return;
    onClose();
  };

  const statusBadge = detail ? statusView(detail) : null;

  const guestLabel = language === 'ar' ? 'مسافر' : detail && detail.passengersCount === 1 ? t('bookings.cancel.guestOne') : t('bookings.cancel.guestMany');

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-manage-title"
    >
      <div className="bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[var(--border-subtle)] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--surface-card)] z-10">
          <div className="min-w-0 space-y-1">
            <span className="text-[11px] font-black text-[var(--accent-primary)] block uppercase tracking-wide">
              {t('bookings.manage.title')}
            </span>
            <h2 id="booking-manage-title" className="chart-heading font-bold text-lg sm:text-xl leading-snug truncate">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="w-8 h-8 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                  {ICONS[booking.iconType] ?? ICONS.compass}
                </span>
                <span className="truncate">{booking.subtitle || booking.title}</span>
              </span>
            </h2>
            {detail && statusBadge && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold ${statusBadge.tone}`}>
                {detail.supplierState === 'CANCELLED' || detail.paymentState === 'REFUNDED' ? <Lock className="w-3 h-3" aria-hidden="true" /> : <ShieldCheck className="w-3 h-3" aria-hidden="true" />}
                {t(statusBadge.labelKey)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label={t('bookings.manage.backToBookings')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Error / notice strip */}
        {!canManageOnline && hasTrip && isRental && (
          <div className="mx-5 sm:mx-6 mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            <Bike className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t('bookings.manage.rentalHint')}</span>
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-5" aria-live="polite">
          {detailState === 'loading' && (
            <div role="status" className="flex items-center gap-3 text-sm text-[var(--text-secondary)] py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>{t('bookings.manage.loadingDetail')}</span>
            </div>
          )}

          {detailState === 'missing' && (
            <div className="space-y-4 py-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" aria-hidden="true" />
              <h3 className="chart-heading font-bold text-lg">{t('bookings.manage.notFoundTitle')}</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">{t('bookings.manage.notFoundBody')}</p>
              <a
                href={`https://wa.me/${(booking.phone || '').replace(/\D/g, '') || '201002348899'}?text=${encodeURIComponent(
                  `Help with booking ${booking.confirmationCode || ''}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--btn-book-bg)] text-[var(--btn-book-text)] text-xs font-extrabold"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                WhatsApp support
              </a>
            </div>
          )}

          {detailState === 'error' && detailError && (
            <div role="alert" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-amber-500/40 bg-amber-950/40 text-sm text-amber-200">
              <span>{errorText(detailError, t)}</span>
              <button
                type="button"
                onClick={() => setDetailRetry(r => r + 1)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                {t('bookings.manage.retry')}
              </button>
            </div>
          )}

          {!hasTrip && detailState !== 'loading' && (
            <div role="alert" className="p-4 rounded-2xl border border-amber-500/40 bg-amber-950/40 text-sm text-amber-200">
              {t('bookings.manage.noTrip')}
            </div>
          )}

          {/* ------------------------------------------------ success screens */}
          {detail && cancelPhase === 'done' && cancelOutcome && (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" aria-hidden="true" />
              <h3 className="chart-heading font-bold text-xl">{t('bookings.cancel.successTitle')}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {t('bookings.cancel.successBody', { ref: detail.bookingRef || detail.confirmationCode })}
              </p>
              {cancelOutcome.refunded ? (
                <p className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {t('bookings.cancel.refunded', { amount: formatNumber(cancelOutcome.refundAmountEGP ?? 0) })}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">{t('bookings.cancel.noRefund')}</p>
              )}
              <div className="pt-2">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-extrabold">
                  {t('bookings.manage.backToBookings')}
                </button>
              </div>
            </div>
          )}

          {detail && reschedulePhase === 'done' && rescheduledDetail && (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" aria-hidden="true" />
              <h3 className="chart-heading font-bold text-xl">{t('bookings.reschedule.successTitle')}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {t('bookings.reschedule.successBody', { service: booking.subtitle || booking.title, when: `${rescheduledDetail.scheduledDate} · ${rescheduledDetail.scheduledTime}` })}
              </p>
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs space-y-1.5 max-w-sm mx-auto text-start">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--text-secondary)]/70">{t('bookings.reschedule.confirmFrom')}</span>
                  <span className="font-bold text-end" dir="ltr">{detail.scheduledDate} · {detail.scheduledTime}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--text-secondary)]/70">{t('bookings.reschedule.confirmTo')}</span>
                  <span className="font-bold text-emerald-300 text-end" dir="ltr">{rescheduledDetail.scheduledDate} · {rescheduledDetail.scheduledTime}</span>
                </div>
              </div>
              <div className="pt-2">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-extrabold">
                  {t('bookings.manage.backToBookings')}
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ detail + actions */}
          {detail && detailState === 'ready' && cancelPhase === 'idle' && reschedulePhase === 'idle' && (
            <div className="space-y-5">
              {/* Lifecycle timeline — one shared story of where this booking
                  stands (see src/shared/bookingTimeline.ts). */}
              <BookingTimeline
                supplierState={detail.supplierState}
                refunded={detail.paymentState === 'REFUNDED'}
              />
              {/* Key facts */}
              <dl className="space-y-2.5 text-xs">
                <div className={fieldRow}>
                  <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.detailLabel')}</dt>
                  <dd className="font-mono font-bold text-[var(--accent-secondary)] bg-[var(--surface-container)] px-2 py-0.5 rounded border border-[var(--border-subtle)]" dir="ltr">
                    {detail.bookingRef || detail.confirmationCode}
                  </dd>
                </div>
                <div className={fieldRow}>
                  <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.statusLabel')}</dt>
                  <dd className="font-bold">{detail.supplierState.replace(/_/g, ' ')}</dd>
                </div>
                <div className={fieldRow}>
                  <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.scheduleLabel')}</dt>
                  <dd className="font-semibold" dir="ltr">{detail.scheduledDate} · {detail.scheduledTime}</dd>
                </div>
                {freeCancellationText(detail.freeCancellationUntil) && (
                  <div className={fieldRow}>
                    <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.policyLabel')}</dt>
                    <dd>
                      <Badge tone={freeCancellationView(detail.freeCancellationUntil, language === 'ar' ? 'ar' : 'en')?.kind === 'until' ? 'positive' : 'neutral'}>
                        {freeCancellationText(detail.freeCancellationUntil)}
                      </Badge>
                    </dd>
                  </div>
                )}
                <div className={fieldRow}>
                  <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.travelersLabel')}</dt>
                  <dd className="font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                    {detail.passengersCount}
                  </dd>
                </div>
                <div className={fieldRow}>
                  <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.customerLabel')}</dt>
                  <dd className="font-semibold text-end">
                    {detail.travelerName}
                    <span className="block text-[11px] text-[var(--text-secondary)]/70 font-normal" dir="ltr">{detail.travelerEmail}</span>
                  </dd>
                </div>
                <div className={fieldRow}>
                  <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.supplierLabel')}</dt>
                  <dd className="font-semibold">{booking.provider || detail.supplierId}</dd>
                </div>
                {detail.pickupLocation && (
                  <div className={fieldRow}>
                    <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.locationLabel')}</dt>
                    <dd className="font-semibold text-end">{detail.pickupLocation}</dd>
                  </div>
                )}
                <div className={fieldRow}>
                  <dt className="text-[var(--text-secondary)]/70">{t('bookings.manage.amountLabel')}</dt>
                  <dd className="font-mono font-bold text-[var(--accent-primary)]">{formatEGP(detail.amountEGP)}</dd>
                </div>
              </dl>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={!rescheduleAllowed}
                  onClick={beginReschedule}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <Calendar className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                  {t('bookings.manage.rescheduleAction')}
                </button>
                <button
                  type="button"
                  disabled={!cancelAllowed}
                  onClick={beginCancel}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                  {t('bookings.manage.cancelAction')}
                </button>
              </div>
              {(!cancelAllowed || !rescheduleAllowed) && (
                <p className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                  {t('bookings.manage.notChangeable')}
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------------ cancel confirm */}
          {detail && (cancelPhase === 'confirm' || cancelling) && (
            <div className="space-y-5" aria-busy={cancelling}>
              <h3 className="chart-heading font-bold text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" aria-hidden="true" />
                {t('bookings.cancel.confirmTitle')}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t('bookings.cancel.confirmBody', {
                  service: booking.subtitle || booking.title,
                  when: `${detail.scheduledDate} · ${detail.scheduledTime}`,
                  guests: detail.passengersCount,
                  guestsLabel: guestLabel
                })}
              </p>
              <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--text-secondary)]/70">{t('bookings.manage.amountLabel')}</span>
                  <span className="font-mono font-bold">{formatEGP(detail.amountEGP)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--text-secondary)]/70">{t('bookings.manage.policyLabel')}</span>
                  <span className="text-[var(--text-secondary)] font-semibold text-end">{freeCancellationText(detail.freeCancellationUntil) ?? t('bookings.manage.noPolicy')}</span>
                </div>
              </div>
              <label className="block">
                <span className="block text-xs font-bold mb-2">{t('bookings.cancel.reasonLabel')}</span>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={t('bookings.cancel.reasonPlaceholder')}
                  className="w-full rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm p-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--accent-primary)]"
                />
              </label>

              {cancelError && (
                <p role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorText(cancelError, t)}</span>
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setCancelPhase('idle'); setCancelError(null); }}
                  disabled={cancelling}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-container)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('bookings.cancel.keepBooking')}
                </button>
                <button
                  type="button"
                  onClick={submitCancel}
                  disabled={cancelling}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-extrabold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {t('bookings.cancel.busy')}
                    </>
                  ) : (
                    t('bookings.cancel.submit')
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ reschedule: pick */}
          {detail && reschedulePhase === 'pick' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <Calendar className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="chart-heading font-bold text-lg">{t('bookings.reschedule.title')}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('bookings.reschedule.intro')}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex-1 block">
                  <span className="block text-xs font-bold mb-2">{t('bookings.reschedule.dateLabel')}</span>
                  <input
                    type="date"
                    min={startOfToday()}
                    value={chosenDate}
                    onChange={(e) => {
                      setChosenDate(e.target.value);
                      setSlots([]);
                      setChosenSlot(null);
                    }}
                    className="w-full rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm p-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </label>
                <div className="sm:self-end">
                  <button
                    type="button"
                    onClick={checkSlots}
                    disabled={!chosenDate || slotsLoading}
                    className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-primary-ink)] text-xs font-extrabold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {slotsLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Clock className="w-4 h-4" aria-hidden="true" />}
                    {t('bookings.reschedule.checkSlots')}
                  </button>
                </div>
              </div>

              {slotsLoading && (
                <div role="status" className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] p-3">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {t('bookings.reschedule.slotsLoading')}
                </div>
              )}

              {rescheduleError && (
                <p role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorText(rescheduleError, t)}</span>
                </p>
              )}

              {!slotsLoading && !rescheduleError && (
                <>
                  {slots.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1.5">
                      <Clock className="w-7 h-7 text-[var(--text-secondary)] mx-auto" aria-hidden="true" />
                      <p className="text-sm text-[var(--text-secondary)]">
                        {chosenDate
                          ? t('bookings.reschedule.slotsEmptyDate', { date: chosenDate })
                          : t('bookings.reschedule.slotsEmptyService')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-bold text-[var(--text-secondary)]">{t('bookings.reschedule.slotHint')}</p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {slots.map((slot) => {
                          const isCurrent = detail && slot.timeSlot === detail.scheduledTime && chosenDate === detail.scheduledDate;
                          const disabled = slot.kind === 'sold-out' || slot.kind === 'fits-no-party' || isCurrent;
                          return (
                            <li key={slot.id}>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => pickSlot(slot)}
                                aria-pressed={chosenSlot?.id === slot.id}
                                className={`w-full p-3.5 rounded-2xl border text-start transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed ${
                                  disabled
                                    ? 'opacity-55 border-[var(--border-subtle)] bg-[var(--surface-container)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-container)] hover:border-[var(--accent-primary)]/60'
                                }`}
                              >
                                <span className="flex items-center justify-between gap-2" dir="ltr">
                                  <span className="text-sm font-bold">{slot.timeSlot}</span>
                                  <span className="font-mono text-xs text-[var(--text-secondary)]">{formatEGP(slot.priceEGP)}</span>
                                </span>
                                <span className="block text-[11px] font-bold mt-1">
                                  {isCurrent ? (
                                    <span className="text-[var(--text-secondary)]">{t('bookings.reschedule.sameSlot')}</span>
                                  ) : slot.kind === 'sold-out' ? (
                                    <span className="text-red-400">{t('bookings.reschedule.slotSoldOut')}</span>
                                  ) : slot.kind === 'fits-no-party' ? (
                                    <span className="text-red-400">{t('bookings.reschedule.slotNoFit', { count: detail?.passengersCount ?? 0 })}</span>
                                  ) : slot.kind === 'limited' ? (
                                    <span className="text-amber-300">{t('bookings.reschedule.slotLimited', { count: slot.capacityRemaining })}</span>
                                  ) : (
                                    <span className="text-emerald-400 flex items-center gap-1">
                                      <Check className="w-3 h-3" aria-hidden="true" />
                                      {t('bookings.reschedule.slotAvailable')}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => { setReschedulePhase('idle'); setRescheduleError(null); }}
                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-2 -my-2 cursor-pointer"
              >
                {t('bookings.reschedule.goBack')}
              </button>
            </div>
          )}

          {/* ------------------------------------------------ reschedule: confirm */}
          {detail && (reschedulePhase === 'confirm' || rescheduling) && chosenSlot && (
            <div className="space-y-4" aria-busy={rescheduling}>
              <h3 className="chart-heading font-bold text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[var(--accent-primary)]" aria-hidden="true" />
                {t('bookings.reschedule.confirmTitle')}
              </h3>
              <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-4 text-xs space-y-2.5">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--text-secondary)]/70">{t('bookings.reschedule.confirmFrom')}</span>
                  <span className="font-bold text-end" dir="ltr">{detail.scheduledDate} · {detail.scheduledTime}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--text-secondary)]/70">{t('bookings.reschedule.confirmTo')}</span>
                  <span className="font-bold text-emerald-300 text-end" dir="ltr">{chosenDate} · {chosenSlot.timeSlot}</span>
                </div>
                <div className="flex justify-between gap-3 border-t border-[var(--border-subtle)] pt-2.5">
                  <span className="text-[var(--text-secondary)]/70">{t('bookings.manage.amountLabel')}</span>
                  <span className="font-mono font-bold">{formatEGP(detail.amountEGP)}</span>
                </div>
                {slotPriceDiffers && (
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {t('bookings.reschedule.priceNote', { price: formatNumber(chosenSlot.priceEGP) })}
                  </p>
                )}
              </div>

              {rescheduleError && (
                <p role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorText(rescheduleError, t)}</span>
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setReschedulePhase('pick'); setChosenSlot(null); setRescheduleError(null); }}
                  disabled={rescheduling}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-container)] cursor-pointer disabled:opacity-60"
                >
                  {t('bookings.reschedule.goBack')}
                </button>
                <button
                  type="button"
                  onClick={submitReschedule}
                  disabled={rescheduling}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] text-xs font-extrabold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {rescheduling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {t('bookings.reschedule.busy')}
                    </>
                  ) : (
                    <>
                      {t('bookings.reschedule.confirmSubmit')}
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
