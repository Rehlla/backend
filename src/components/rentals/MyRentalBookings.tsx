import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Bike, Calendar, MapPin, Clock, Check, X, Loader2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import type { RentalBookingView } from '../../shared/types/commerce';

const STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  PENDING_PAYMENT: { en: 'Awaiting payment', ar: 'في انتظار الدفع' },
  PENDING_CONFIRMATION: { en: 'Awaiting shop confirmation', ar: 'في انتظار تأكيد المحل' },
  CONFIRMED: { en: 'Confirmed', ar: 'مؤكد' },
  READY_FOR_PICKUP: { en: 'Ready for pickup', ar: 'جاهز للاستلام' },
  ACTIVE: { en: 'With you', ar: 'معك' },
  OVERDUE: { en: 'Overdue', ar: 'متأخر' },
  RETURNED: { en: 'Returned', ar: 'تم الإرجاع' },
  COMPLETED: { en: 'Completed', ar: 'مكتمل' },
  CANCELLED: { en: 'Cancelled', ar: 'ملغي' },
  REJECTED: { en: 'Rejected', ar: 'مرفوض' },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'amber',
  PENDING_CONFIRMATION: 'amber',
  CONFIRMED: 'emerald',
  READY_FOR_PICKUP: 'blue',
  ACTIVE: 'blue',
  OVERDUE: 'red',
  RETURNED: 'slate',
  COMPLETED: 'slate',
  CANCELLED: 'slate',
  REJECTED: 'rose',
};

const DARK_COLOR_CLASSES: Record<string, string> = {
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const LIGHT_COLOR_CLASSES: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  slate: 'bg-slate-50 text-slate-600 border-slate-200',
};

function fmtDate(isAr: boolean, dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isAr) {
    return `${d.getDate()} / ${d.getMonth() + 1} / ${d.getFullYear()}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const MyRentalBookings: React.FC = () => {
  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';

  const [bookings, setBookings] = useState<RentalBookingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getMyRentalBookings(controller.signal);
        if (!cancelled) {
          setBookings(data.bookings || []);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setError(e?.message || 'Could not load bookings');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const cancelable = useMemo(
    () => bookings.filter(b => ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(b.status)),
    [bookings]
  );

  const active = useMemo(
    () => bookings.filter(b => ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'OVERDUE'].includes(b.status)),
    [bookings]
  );

  const past = useMemo(
    () => bookings.filter(b => ['RETURNED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status)),
    [bookings]
  );

  const handleCancel = useCallback(async (bookingId: string) => {
    setActingId(bookingId);
    setError(null);
    try {
      await api.cancelRentalBooking(bookingId, cancelReason || undefined);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'CANCELLED' } : b));
      setShowCancelForm(null);
      setCancelReason('');
    } catch (e: any) {
      setError(e?.message || 'Cancellation failed');
    } finally {
      setActingId(null);
    }
  }, [cancelReason]);

  const statusColorClass = (status: string): string => {
    const color = STATUS_COLORS[status] ?? 'slate';
    const c = color as keyof typeof DARK_COLOR_CLASSES;
    if (isDark) {
      return DARK_COLOR_CLASSES[c];
    }
    return LIGHT_COLOR_CLASSES[c];
  };

  if (loading) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className={`min-h-[60vh] flex items-center justify-center ${isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'}`}>
        <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
        <span className="ml-2 text-sm text-[var(--text-secondary)]">{t('cmd.loading')}</span>
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className={`min-h-[60vh] flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'}`}>
        <AlertTriangle className="w-6 h-6 text-red-500" />
        <p className="text-sm text-red-500 font-bold">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-sm font-bold cursor-pointer"
        >
          {isAr ? 'إعادة محاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col ${isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'}`}>
      <div className={`sticky top-0 z-20 border-b backdrop-blur-md ${isDark ? 'bg-[var(--surface-card)]/90 border-[var(--border-subtle)]' : 'bg-[var(--surface-card)]/90 border-[var(--border-subtle)]'}`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-bold">{t('rentals.myBookings')}</h1>
          <span className="text-xs text-[var(--text-secondary)]">{bookings.length} {isAr ? 'حجز' : 'bookings'}</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        {bookings.length === 0 ? (
          <div className="py-16 text-center">
            <Bike className="w-12 h-12 mx-auto text-[var(--text-secondary)]/30 mb-4" />
            <p className="text-sm text-[var(--text-secondary)]">{t('rentals.noBookings')}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <section>
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {isAr ? 'حجوزاتي النشطة' : 'Active bookings'} ({active.length})
                </h2>
                <div className="space-y-3">
                  {active.map(booking => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isAr={isAr}
                      isDark={isDark}
                      statusLabel={STATUS_LABEL}
                      statusBg={statusColorClass}
                      t={t}
                      onCancel={handleCancel}
                      actingId={actingId}
                      showCancelForm={showCancelForm}
                      cancelReason={cancelReason}
                      setCancelReason={setCancelReason}
                      setShowCancelForm={setShowCancelForm}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  {isAr ? 'السجل السابق' : 'Past bookings'} ({past.length})
                </h2>
                <div className="space-y-3">
                  {past.map(booking => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isAr={isAr}
                      isDark={isDark}
                      statusLabel={STATUS_LABEL}
                      statusBg={statusColorClass}
                      t={t}
                      onCancel={handleCancel}
                      actingId={actingId}
                      showCancelForm={showCancelForm}
                      cancelReason={cancelReason}
                      setCancelReason={setCancelReason}
                      setShowCancelForm={setShowCancelForm}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

interface BookingCardProps {
  booking: RentalBookingView;
  isAr: boolean;
  isDark: boolean;
  statusLabel: Record<string, { en: string; ar: string }>;
  statusBg: (s: string) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onCancel: (id: string) => void;
  actingId: string | null;
  showCancelForm: string | null;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  setShowCancelForm: (v: string | null) => void;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  isAr,
  isDark,
  statusLabel,
  statusBg,
  t,
  onCancel,
  actingId,
  showCancelForm,
  cancelReason,
  setCancelReason,
  setShowCancelForm,
}) => {
  const listingName = isAr && booking.listing?.nameAr ? booking.listing.nameAr : booking.listing?.name || t('rentals.bike');
  const bn = booking.priceBreakdown;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] shadow-xs'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
            <Bike className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 className="font-bold text-sm">{listingName}</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)] mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {fmtDate(isAr, booking.startDate)} — {fmtDate(isAr, booking.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {booking.quantity} {t('rentals.quantity')}
              </span>
              {booking.deliveryMode === 'DELIVERY' && booking.deliveryAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {isAr ? 'توصيل' : 'Delivery'}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${statusBg(booking.status)}`}>
          {isAr ? statusLabel[booking.status]?.ar : statusLabel[booking.status]?.en}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-[var(--text-secondary)]/60">{isAr ? 'اليومي' : 'Daily'}</span>
          <p className="font-bold text-[var(--text-primary)]">{bn.dailyRateEGP.toLocaleString()} EGP</p>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]/60">{isAr ? 'الأساس' : 'Base'}</span>
          <p className="font-bold text-[var(--text-primary)]">{bn.baseEGP.toLocaleString()} EGP</p>
        </div>
        {bn.discountEGP > 0 && (
          <div>
            <span className="text-emerald-500">{isAr ? 'الخصم' : 'Discount'}</span>
            <p className="font-bold text-emerald-500">−{bn.discountEGP.toLocaleString()} EGP</p>
          </div>
        )}
        <div className={`border-t ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'} pt-1`}>
          <span className="font-bold text-sm">{isAr ? 'الإجمالي' : 'Total'}</span>
          <p className="font-bold text-[var(--accent-primary)]">{bn.totalEGP.toLocaleString()} EGP</p>
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-secondary)]/50">
        {isAr ? `العارة: ${bn.depositEGP.toLocaleString()} ج.م (تسدّد عند الاستلام)` : `Deposit: ${bn.depositEGP.toLocaleString()} EGP (payable at pickup)`}
      </p>

      {['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(booking.status) && (
        <div className="flex gap-2 pt-1">
          {showCancelForm === booking.id ? (
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder={isAr ? 'سبب الإلغاء (اختياري)' : 'Cancellation reason (optional)'}
                rows={2}
                className={`text-xs rounded-xl border px-3 py-2 outline-none ${isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'}`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onCancel(booking.id)}
                  disabled={actingId === booking.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {actingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  {actingId === booking.id ? (isAr ? 'جاري الإلغاء…' : 'Cancelling…') : t('bookings.cancel.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCancelForm(null); setCancelReason(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${isDark ? 'bg-[var(--surface-container)] text-[var(--text-secondary)]' : 'bg-[var(--surface-card)] text-[var(--text-secondary)]'}`}
                >
                  {t('bookings.cancel.keepBooking')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelForm(booking.id)}
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200"
            >
              <X className="w-3 h-3" />
              {isAr ? 'إلغاء الحجز' : 'Cancel booking'}
            </button>
          )}
        </div>
      )}

      <div className="text-[10px] text-[var(--text-secondary)]/40 pt-1 border-t border-dashed border-[var(--border-subtle)]">
        {isAr ? `رقم الحجز: ${booking.bookingRef}` : `Booking ref: ${booking.bookingRef}`}
      </div>
    </div>
  );
};
