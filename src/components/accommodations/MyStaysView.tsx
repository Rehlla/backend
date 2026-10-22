import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BedDouble, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../context/TripContext';
import { api } from '../../services/api';

/**
 * Every stay the traveller has, across their trips.
 *
 * Without this the only way to find a reservation was to remember a reference
 * that was on a page nobody keeps — so this is the hub that stays live by
 * reference and opens the same confirmation screen a fresh checkout lands on.
 */

interface StayRecord {
  bookingRef: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  travelerName: string;
  accommodationId?: string;
  depositEGP: number;
}

const STATUS_DOT: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-500',
  PENDING_CONFIRMATION: 'bg-amber-500',
  CONFIRMED: 'bg-emerald-500',
  REJECTED: 'bg-rose-500',
  CANCELLED: 'bg-rose-500',
  EXPIRED: 'bg-rose-500',
  IN_HOUSE: 'bg-emerald-500',
  COMPLETED: 'bg-emerald-500',
  NO_SHOW: 'bg-rose-500',
};

export const MyStaysView: React.FC = () => {
  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();
  const { navigateTo, sessionUser } = useTrip();
  const isAr = language === 'ar';

  const [stays, setStays] = useState<StayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;
    (async () => {
      try {
        // One call for every stay the traveller owns. Walking their trips
        // missed every stay booked straight from a hotel page (no trip), which
        // is most of them.
        const list = await api.getMyStays();
        const all: StayRecord[] = list.map(s => ({
          bookingRef: String(s.bookingRef ?? ''),
          status: String(s.status ?? ''),
          checkIn: String(s.checkIn ?? ''),
          checkOut: String(s.checkOut ?? ''),
          nights: Number(s.nights ?? 0),
          rooms: Number(s.rooms ?? 0),
          travelerName: String(s.travelerName ?? ''),
          /** Cash-on-arrival holds carry no deposit; the list needs it to
              avoid claiming "deposit received" for a booking where nothing
              was collected (the confirmation page already branches this). */
          depositEGP: Number(s.depositEGP ?? 0),
        }));
        if (!cancelled) setStays(all.sort((a, b) => b.checkIn.localeCompare(a.checkIn)));
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || 'failed'));
      }
    })();
    return () => { cancelled = true; };
  }, [sessionUser]);

  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`min-h-screen ${isDark ? 'bg-[var(--bg-canvas)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'}`}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <h1 className="font-display text-2xl font-semibold">{t('hotels.myStays')}</h1>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-3">
        {stays === null && !error && (
          <div className="flex items-center justify-center py-16 text-[var(--text-secondary)]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-500 text-center py-8">{t('hotels.staysFailed')}</p>
        )}

        {stays !== null && stays.length === 0 && (
          <div className={`rounded-2xl border p-8 text-center ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
            <BedDouble className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)]" />
            <p className="text-sm font-bold mb-1">{t('hotels.noStaysTitle')}</p>
            <p className="text-xs text-[var(--text-secondary)]">{t('hotels.noStaysBody')}</p>
          </div>
        )}

        {stays?.map(s => (
          <motion.button
            key={s.bookingRef}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            // Opens the reservation itself (pay, cancel, move). It used to
            // re-open this list with a ref the list never read.
            onClick={() => navigateTo('/hotels/checkout', { stayRef: s.bookingRef })}
            className={`w-full rounded-2xl border p-4 text-start transition-colors hover:bg-[var(--btn-util-hover)] ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[s.status] ?? 'bg-[var(--text-secondary)]'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black">{s.bookingRef}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-[var(--surface-container)]' : 'bg-[var(--surface-container)]'}`}>
                    {/* PENDING_CONFIRMATION maps to the catalogue, with the
                        zero-deposit split the confirmation page uses: a cash
                        on arrival hold must not announce "deposit received"
                        when nothing was collected. Raw statuses never render. */}
                    {s.status === 'PENDING_CONFIRMATION' && s.depositEGP === 0
                      ? t('hotels.statusAwaitingPropertyNoDeposit')
                      : t(`hotels.status${s.status.toLowerCase().replace(/(^|_)([a-z])/g, (_m, _p, c: string) => c.toUpperCase())}`)}
                  </span>
                </div>
                <div className={`mt-1 text-xs ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                  {fmtDay(s.checkIn)} → {fmtDay(s.checkOut)} · {s.nights} {isAr ? 'ليالٍ' : 'nights'} · {s.rooms} {isAr ? 'غرفة' : 'rooms'}
                </div>
              </div>
              <span className={`flex-shrink-0 ${isAr ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            </div>
          </motion.button>
        ))}
      </main>
    </div>
  );
};
