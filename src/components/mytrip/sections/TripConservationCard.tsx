import React, { useCallback, useEffect, useState } from 'react';
import { Leaf, Sprout } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { ReefActionForm, toEligibleBookings, type EligibleBooking } from '../../common/ReefActionForm';

interface ReefLog {
  id: string;
  bookingId: string;
  tripId: string;
  supplierId: string;
  actionType: string;
  description: string;
  pointsAwarded: number;
  loggedBy: string;
  createdAt: string;
}

/**
 * TripConservationCard — the traveler's mirror of the reef loop: their own
 * conservation points, the eco-actions logged against THIS trip's completed
 * bookings, and the shared logging form so guests can record actions they took
 * part in (suppliers/operators can already do this from the portal).
 *
 * Truth rules (same as the supplier panel):
 *  - Points render only when the server returned them; an unreachable record
 *    shows an em dash, never an invented zero.
 *  - Only COMPLETED/CAPTURED bookings of this trip are offered to log against.
 */
export const TripConservationCard: React.FC<{ tripId?: string }> = ({ tripId }) => {
  const { t, language } = useLanguage();
  const [logs, setLogs] = useState<ReefLog[] | null>(null);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [bookings, setBookings] = useState<EligibleBooking[] | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    let cancelled = false;
    api.getMyReefLogs().then(data => {
      if (cancelled) return;
      if (data) {
        setLogs(data.logs);
        setTotalPoints(data.totalPoints);
      } else {
        setLogs([]);
        setTotalPoints(null);
      }
    });
    api.getTripBookings(tripId)
      .then(data => { if (!cancelled) setBookings(toEligibleBookings(data.bookings)); })
      .catch(() => { if (!cancelled) setBookings([]); });
    return () => { cancelled = true; };
  }, [tripId]);

  useEffect(() => load(), [load]);

  if (!tripId) return null;

  const tripLogs = (logs ?? []).filter(l => l.tripId === tripId);
  const pointsKnown = totalPoints != null;
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-6 sm:p-8 rounded-3xl border bg-[var(--surface-card)] border-[var(--border-subtle)] shadow-xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-extrabold text-emerald-400">
            {t('trip.conservation.subtitle')}
          </span>
          <h3 className="text-xl chart-heading font-bold mt-1 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            {t('trip.conservation.title')}
          </h3>
        </div>
        <div className="text-end">
          <span className={`text-2xl font-bold chart-heading ${pointsKnown ? 'text-emerald-400' : 'text-[var(--text-primary)]/30'}`}>
            {pointsKnown ? totalPoints : '—'}
          </span>
          <span className="block text-[10px] font-bold text-[var(--text-secondary)]">{t('supplier.trust.reefPoints')}</span>
        </div>
      </div>

      {tripLogs.length > 0 ? (
        <ul className="space-y-2.5">
          {tripLogs.map(l => (
            <li key={l.id} className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  {t(`reefLogger.action.${l.actionType}`)}
                </p>
                {l.description && (
                  <p className="text-[11px] text-[var(--text-primary)]/60 mt-0.5 line-clamp-2">{l.description}</p>
                )}
                <span className="text-[10px] text-[var(--text-primary)]/40">{fmtDate(l.createdAt)}</span>
              </div>
              <span className="shrink-0 text-xs font-bold text-emerald-400">+{l.pointsAwarded}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--text-primary)]/50">
          {logs == null ? t('trip.conservation.unavailable') : t('trip.conservation.empty')}
        </p>
      )}

      <ReefActionForm bookings={bookings} onLogged={load} />
    </div>
  );
};