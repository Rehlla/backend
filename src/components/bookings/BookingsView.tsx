import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Building, 
  Car, 
  Waves, 
  Compass, 
  Check, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  FileText, 
  ExternalLink, 
  Download, 
  QrCode, 
  X,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Wifi,
  WifiOff,
  Lock,
  Receipt,
  Utensils,
  Bike
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { ConfirmedBookingItem } from '../../types';
import type { CommerceServiceType } from '../../shared/types/commerce';
import { useLanguage } from '../../i18n/LanguageContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { offlineStorage } from '../../utils/offlineStorage';
import { BookingManageModal } from './BookingManageModal';
import { ReviewInvitations } from './ReviewInvitations';
import { Badge } from '../ui/badge';
import { api } from '../../services/api';
import { freeCancellationView } from '../../services/bookingManage';

export const BookingsView: React.FC = () => {
  const { profile, user, bookings, activeTrip, isTripLoading, tripLoadError, reloadTrip, selectedBookingId, setSelectedBookingId, navigateTo, showToast } = useTrip();
  const { language, isRTL, t, formatEGP } = useLanguage();
  
  const travelerName = profile.name || user?.displayName;
  const travelerTitle = travelerName
    ? t('bookings.travelerTitle', { displayName: travelerName })
    : t('bookings.yourDahabBookings');
  
  const [filterType, setFilterType] = useState<'all' | CommerceServiceType>('all');
  const [selectedBooking, setSelectedBooking] = useState<ConfirmedBookingItem | null>(() => {
    if (selectedBookingId) {
      return bookings.find((b) => b.id === selectedBookingId) || null;
    }
    return null;
  });
  /** When true the real manage modal (cancel / reschedule / live status) is open. */
  const [manageModalOpen, setManageModalOpen] = useState(false);

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Free-cancellation deadlines by booking id, from the detailed bookings
   * read (the trip bookings feed behind these cards does not carry them).
   * A failed read just leaves the line off — nothing is promised.
   */
  const [cancellationDeadlines, setCancellationDeadlines] = useState<Record<string, string | null>>({});
  useEffect(() => {
    const tripId = activeTrip?.id;
    if (!tripId) {
      setCancellationDeadlines({});
      return;
    }
    let cancelled = false;
    api.getTripBookingsDetailed(tripId)
      .then(({ bookings: detailed }) => {
        if (cancelled) return;
        setCancellationDeadlines(
          Object.fromEntries((detailed || []).map(d => [d.id, d.freeCancellationUntil ?? null]))
        );
      })
      .catch(() => {
        if (!cancelled) setCancellationDeadlines({});
      });
    return () => {
      cancelled = true;
    };
  }, [activeTrip?.id, bookings]);

  /** "Free cancellation until Thu 12 Nov, 09:30", or null when the server gave no deadline. */
  const freeCancellationBadge = (bookingId: string) => {
    const view = freeCancellationView(cancellationDeadlines[bookingId], language === 'ar' ? 'ar' : 'en');
    if (!view) return null;
    return (
      <Badge tone={view.kind === 'until' ? 'positive' : 'neutral'}>
        {view.kind === 'until'
          ? t('bookings.freeCancellation.until', { when: view.when })
          : t('bookings.freeCancellation.ended', { when: view.when })}
      </Badge>
    );
  };

  // Save vouchers to offline storage whenever bookings change
  useEffect(() => {
    if (bookings.length > 0) {
      offlineStorage.saveVouchers(bookings);
    }
  }, [bookings]);

  const filteredBookings = bookings.filter((b) => {
    if (filterType === 'all') return true;
    return b.serviceType === filterType;
  });

  /** Sum only non-cancelled bookings — cancelled ones already refunded or voided. */
  const totalSpentEGP = bookings
    .filter((b) => !/cancelled|refunded/i.test(b.status))
    .reduce((sum, b) => sum + b.priceEGP, 0);

  const getBookingIcon = (iconType: ConfirmedBookingItem['iconType']) => {
    switch (iconType) {
      case 'building':
        return <Building className="w-5 h-5 text-[var(--accent-secondary)]" />;
      case 'car':
        return <Car className="w-5 h-5 text-[var(--accent-primary)]" />;
      case 'waves':
        return <Waves className="w-5 h-5 text-[var(--accent-primary)]" />;
      case 'compass':
        return <Compass className="w-5 h-5 text-[var(--accent-secondary)]" />;
      case 'sparkles':
        return <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />;
      case 'utensils':
        return <Utensils className="w-5 h-5 text-[var(--accent-secondary)]" />;
      case 'bike':
        return <Bike className="w-5 h-5 text-[var(--accent-primary)]" />;
    }
  };

  const handleOpenVoucher = (booking: ConfirmedBookingItem) => {
    setSelectedBooking(booking);
    setManageModalOpen(false);
    setSelectedBookingId(booking.id);
  };

  const handleOpenManage = (booking: ConfirmedBookingItem) => {
    setSelectedBooking(booking);
    setSelectedBookingId(booking.id);
    setManageModalOpen(true);
  };

  /**
   * Card records carry their status as a literal English sentence the client
   * wrote at booking time ('Confirmed ✓', 'Pending'), and the list used to
   * print it raw — an English chip on an Arabic screen. The record stays as
   * written; only the displayed word goes through the catalog. Values this
   * page has never produced fall back to the raw text rather than a wrong
   * translation.
   */
  const bookingStatusLabel = (raw: string): string => {
    const s = raw.trim().toLowerCase();
    if (s.startsWith('confirmed')) return t('bookings.cardStatus.confirmed');
    if (s.startsWith('pending')) return t('bookings.cardStatus.pending');
    if (s.startsWith('cancel')) return t('bookings.cardStatus.cancelled');
    if (s.startsWith('changed')) return t('bookings.cardStatus.changed');
    return raw;
  };

  return (
    <div id="bookings-hub-view" className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] pb-24">
      <h1 className="sr-only">{t('bookings.empty.srHeading')}</h1>
      {/* 1. Top Header */}
      <section className="bg-[var(--surface-card)] text-[var(--text-primary)] border-b border-[var(--border-subtle)] pt-10 pb-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[var(--accent-secondary)]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto space-y-5 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                  <Briefcase className="w-3.5 h-3.5 inline-block me-1.5 -mt-0.5" aria-hidden="true" />
                  <span>{t('bookings.connectedTripBookings')}</span>
                </p>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  isOnline ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                }`}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  <span>{isOnline ? (t('bookings.cloudSyncActive')) : (t('bookings.offlineMode'))}</span>
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-balance text-[var(--text-primary)]">
                {travelerTitle}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] font-normal leading-relaxed">
                {t('bookings.everythingConfirmedUnderOne')}{' '}
                <strong className="font-mono text-[var(--accent-secondary)] bg-[var(--surface-container)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                  {/* This used to read 'DHB-2026-OCT-894' — a reference that
                      existed nowhere, shown next to the word "confirmed"
                      regardless of what the traveler had actually booked. */}
                  {activeTrip
                    ? activeTrip.id
                    : t('bookings.noTripYet')}
                </strong>
              </p>
            </div>

            {/* Total booked */}
            <div className="flex items-center gap-3">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-end">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/70 block">
                  {t('bookings.totalBooked')}
                </span>
                <span className="text-xl font-mono font-bold text-[var(--accent-secondary)]">
                  {formatEGP(totalSpentEGP)}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-2">
              {([
                { id: 'all', label: t('bookings.filterAll', { count: bookings.length }) },
                { id: 'hotel', label: t('bookings.filterHotel') },
                { id: 'transfer', label: t('bookings.filterTransfer') },
                { id: 'diving', label: t('bookings.filterDiving') },
                { id: 'safari', label: t('bookings.filterSafari') },
                { id: 'wellness', label: t('bookings.filterWellness') },
                { id: 'dining', label: t('bookings.filterDining') },
              ] as const).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id)}
                  aria-pressed={filterType === f.id}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                    filterType === f.id
                      ? 'bg-[var(--accent-secondary)] text-[var(--accent-secondary-ink)] shadow-md font-extrabold'
                      : 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigateTo('/my-trip')}
              className="text-xs font-bold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] flex items-center gap-1 cursor-pointer transition-colors py-2 -my-2"
            >
              <span>{t('bookings.viewInTimeline')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Main Content Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* A load that is still running, or that failed, is said plainly.
            Silence here is what let the page show an empty list next to the
            word "confirmed" while the request was in flight or rejected. */}
        {isTripLoading && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-5 py-4 text-sm text-[var(--text-secondary)]"
          >
            <span
              aria-hidden="true"
              className="w-4 h-4 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin"
            />
            <span>{t('bookings.loadingYourBookings')}</span>
          </div>
        )}

        {tripLoadError && !isTripLoading && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 px-5 py-4"
          >
            <p className="text-sm font-semibold text-amber-200">{tripLoadError}</p>
            <button
              type="button"
              onClick={reloadTrip}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-card)] text-sm font-bold cursor-pointer"
            >
              {t('bookings.tryAgain')}
            </button>
          </div>
        )}

        {/* Verified-stay review invitations (blueprint row #14): completed
            bookings the traveler has not reviewed yet. Renders nothing when
            there is nothing to review. */}
        {!isTripLoading && !tripLoadError && (
          <ReviewInvitations tripId={activeTrip?.id ?? null} />
        )}

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="py-16 text-center">
            <h2 className="text-3xl font-display font-semibold text-[var(--text-primary)] mb-3">{t('bookings.empty.title')}</h2>
            <p className="text-[var(--text-secondary)] mb-6">{t('bookings.empty.description')}</p>
            <button onClick={() => navigateTo('/explore')} className="px-8 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-bold">{t('bookings.empty.cta')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The cards are h3 and the page's only other heading is the h1, so
                the grid needs a region heading of its own. Visually hidden:
                the filter tabs above already label this area on screen. */}
            <h2 className="sr-only">
              {t('bookings.yourConfirmedBookings')}
            </h2>
            {filteredBookings.map((b) => (
            <div
              key={b.id}
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-lg hover:border-[var(--accent-primary)]/40 transition-[background-color,border-color,color,box-shadow,transform,opacity] flex flex-col justify-between space-y-5"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-center">
                      {getBookingIcon(b.iconType)}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[var(--accent-primary)] block">
                        {b.title}
                      </span>
                      <h3 className="font-bold text-base sm:text-lg text-[var(--text-primary)]">
                        {b.subtitle}
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      b.status === 'Confirmed ✓'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                        : b.status === 'Pending'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                          : 'bg-red-500/10 text-red-300 border-red-500/40'
                    }`}>
                      {bookingStatusLabel(b.status)}
                    </span>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="py-4 space-y-2.5 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]/60">{t('bookings.card.datesSchedule')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{b.datesOrTime}</span>
                  </div>
                  {freeCancellationBadge(b.id) && (
                    <div className="flex justify-end">{freeCancellationBadge(b.id)}</div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]/60">{t('bookings.card.provider')}</span>
                    <span className="font-semibold text-[var(--text-primary)]">{b.provider}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]/60">{t('bookings.card.location')}</span>
                    <span className="font-medium text-[var(--text-primary)]">{b.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]/60">{t('bookings.card.confirmationCode')}</span>
                    <span className="font-mono font-bold text-[var(--accent-secondary)] bg-[var(--surface-container)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                      {b.confirmationCode}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                  <p className="font-medium">{b.details}</p>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-mono font-bold text-[var(--accent-secondary)]">
                    {formatEGP(b.priceEGP)}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]/60">{t('bookings.card.totalInclTaxes')}</span>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenVoucher(b)}
                    className="px-4 py-2 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{t('bookings.card.viewVoucher')}</span>
                    <QrCode className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  </button>
                  {/* Hide manage button for cancelled/completed bookings — they're already settled. */}
                  {b.serviceType !== 'rental' && activeTrip && !/cancelled|completed|refunded/i.test(b.status) && (
                    <button
                      type="button"
                      onClick={() => handleOpenManage(b)}
                      className="px-4 py-2 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-primary-ink)] border border-[var(--accent-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{t('bookings.card.cancelReschedule')}</span>
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            ))}
          </div>
        )}

        {/* Integration Callout — only meaningful when the traveler has something
            they could change. With zero bookings the disabled button just
            confused people ("why is this greyed out?"). */}
        {bookings.some(b => b.serviceType !== 'rental' && !/cancelled|completed|refunded/i.test(b.status)) && (
        <div className="p-6 rounded-3xl bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-secondary)]">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-secondary)]" />
              <span>{t('bookings.escrowProtection')}</span>
            </div>
            <h2 className="font-bold text-base sm:text-lg text-[var(--text-primary)]">
              {t('bookings.needToChange')}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
              {t('bookings.managedLiveBody')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const target = bookings.find(b => b.serviceType !== 'rental' && !/cancelled|completed|refunded/i.test(b.status));
              if (target) handleOpenManage(target);
            }}
            className="px-5 py-3 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-extrabold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex-shrink-0 z-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('bookings.cancelOrRescheduleCta')}
          </button>
        </div>
        )}
      </main>

      {/* 3. VOUCHER & QR CODE MODAL */}
      {selectedBooking && !manageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookings-view-dialog-1-title"
    >
          <div className="bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-[var(--border-subtle)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                  {t('bookings.officialVoucher')}
                </span>
                <h3 id="bookings-view-dialog-1-title" className="chart-heading font-bold text-2xl text-[var(--text-primary)]">
                  {selectedBooking.subtitle}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {t('bookings.providedBy', { provider: selectedBooking.provider })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                aria-label={t('common.close')}
                className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Offline-Ready Standalone SVG QR Code */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-center space-y-2">
              <div className="w-32 h-32 bg-[var(--surface-card)] p-2 rounded-xl border border-[var(--border-subtle)] shadow-md flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full text-[var(--surface-card)]">
                  <rect x="5" y="5" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                  <rect x="11" y="11" width="14" height="14" fill="currentColor" rx="1" />
                  <rect x="69" y="5" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                  <rect x="75" y="11" width="14" height="14" fill="currentColor" rx="1" />
                  <rect x="5" y="69" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                  <rect x="11" y="75" width="14" height="14" fill="currentColor" rx="1" />
                  <rect x="36" y="8" width="5" height="5" fill="currentColor" />
                  <rect x="46" y="8" width="5" height="5" fill="currentColor" />
                  <rect x="56" y="8" width="5" height="5" fill="currentColor" />
                  <rect x="36" y="18" width="5" height="5" fill="currentColor" />
                  <rect x="56" y="18" width="5" height="5" fill="currentColor" />
                  <rect x="8" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="24" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="40" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="56" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="72" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="86" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="38" y="68" width="6" height="6" fill="currentColor" />
                  <rect x="52" y="68" width="6" height="6" fill="currentColor" />
                  <rect x="68" y="68" width="6" height="6" fill="currentColor" />
                  <rect x="82" y="68" width="6" height="6" fill="currentColor" />
                </svg>
              </div>
              <span className="font-mono text-sm font-bold text-[var(--accent-secondary)]">
                {selectedBooking.confirmationCode}
              </span>
              <span className="text-[12px] text-[var(--text-secondary)]/70">
                {t('bookings.presentPass')}
              </span>
            </div>

            {/* Schedule & Price details */}
            <div className="space-y-2.5 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]/60">{t('bookings.card.schedule')}</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedBooking.datesOrTime}</span>
              </div>
              {freeCancellationBadge(selectedBooking.id) && (
                <div className="flex justify-end">{freeCancellationBadge(selectedBooking.id)}</div>
              )}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]/60">{t('bookings.card.location')}</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedBooking.location}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]/60">{t('bookings.card.amount')}</span>
                <span className="font-mono font-bold text-[var(--accent-primary)]">
                  {formatEGP(selectedBooking.priceEGP)}
                </span>
              </div>
            </div>

            {/* Live management — real backend cancel / reschedule */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                <span>
                  {t('bookings.liveManagementNote')}
                </span>
              </div>
              <button
                type="button"
                disabled={!activeTrip}
                onClick={() => handleOpenManage(selectedBooking)}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-primary-ink)] text-xs font-extrabold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <span>{t('bookings.manageBookingCta')}</span>
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  offlineStorage.saveVouchers(bookings);
                  showToast(t('bookings.voucherCachedToast'));
                }}
                className="px-4 py-2.5 rounded-full border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('bookings.saveOffline')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedBooking(null);
                  navigateTo('/my-trip');
                }}
                className="px-5 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold cursor-pointer"
              >
                {t('bookings.viewInItinerary')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live manage modal — real booking detail / cancel / reschedule */}
      {manageModalOpen && selectedBooking && (
        <BookingManageModal
          booking={selectedBooking}
          hasTrip={Boolean(activeTrip)}
          onClose={() => {
            setManageModalOpen(false);
            setSelectedBooking(null);
            setSelectedBookingId(null);
          }}
          onBookingChanged={reloadTrip}
        />
      )}
    </div>
  );
};

