import React, { useState } from 'react';
import { Leaf, ChevronDown, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

export type ReefActionType = 'reef_safe_sunscreen' | 'coral_planting' | 'beach_cleanup' | 'dive_against_debris' | 'marine_education' | 'plastic_free_day' | 'other';

/** Mirrors reefPositiveService.REEF_ACTION_TYPES — kept in sync by the domain test. */
export const REEF_ACTION_OPTIONS: Array<{ value: ReefActionType; points: number }> = [
  { value: 'coral_planting', points: 20 },
  { value: 'dive_against_debris', points: 20 },
  { value: 'beach_cleanup', points: 15 },
  { value: 'marine_education', points: 10 },
  { value: 'reef_safe_sunscreen', points: 5 },
  { value: 'plastic_free_day', points: 5 },
  { value: 'other', points: 5 },
];

export interface EligibleBooking {
  id: string;
  bookingRef: string;
  tripId: string;
  supplierId: string;
  serviceType: string;
  scheduledDate: string;
}

/**
 * The single eligibility rule both surfaces apply: a booking can carry an
 * eco-action once it is terminal (paid) or completed. The server enforces the
 * same rule again — this is purely the picker's filter.
 */
export function toEligibleBookings(records: Array<Record<string, any>>): EligibleBooking[] {
  return records
    .filter(b => b.paymentState === 'CAPTURED' || b.supplierState === 'COMPLETED')
    .map(b => ({
      id: b.id,
      bookingRef: b.bookingRef,
      tripId: b.tripId,
      supplierId: b.supplierId,
      serviceType: b.serviceType,
      scheduledDate: b.scheduledDate,
    }));
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; points: number }
  | { kind: 'error'; message: string };

/**
 * ReefActionForm — the shared "log an eco-action" form used by suppliers
 * (ReefActionLogger, against their own bookings) and travelers (against their
 * trip's completed bookings).
 *
 * Truth rules:
 *  - Only COMPLETED/CAPTURED bookings are eligible (server enforces too).
 *  - The payload always carries the SELECTED BOOKING's trip/supplier ids, so
 *    points land on the right trip and supplier.
 *  - Server resolves the trip owner; points credit the traveler who took part.
 *  - Errors surface verbatim (e.g. "not completed yet") — never swallowed.
 *
 * @param bookings null while the parent loads them (renders the loading state).
 */
export const ReefActionForm: React.FC<{
  bookings: EligibleBooking[] | null;
  onLogged?: () => void;
}> = ({ bookings, onLogged }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [actionType, setActionType] = useState<ReefActionType>('coral_planting');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const canSubmit = bookingId !== '' && description.trim().length > 0 && state.kind !== 'submitting';

  const submit = async () => {
    const booking = bookings?.find(b => b.id === bookingId);
    if (!booking) return;
    setState({ kind: 'submitting' });
    try {
      const data = await api.logReefAction({
        bookingId: booking.id,
        tripId: booking.tripId,
        supplierId: booking.supplierId,
        actionType,
        description: description.trim(),
      });
      setState({ kind: 'success', points: data.log.pointsAwarded });
      setDescription('');
      setBookingId('');
      onLogged?.();
    } catch (err: any) {
      setState({ kind: 'error', message: err?.message ?? 'Failed to log reef action' });
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]';

  return (
    <div className="pt-3 border-t border-[var(--border-subtle)]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] rounded-lg px-1 py-0.5"
      >
        <Leaf className="w-3.5 h-3.5" aria-hidden="true" />
        {open ? t('reefLogger.hide') : t('reefLogger.title')}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {state.kind === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" role="status">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="text-xs font-medium">{t('reefLogger.success', { points: String(state.points) })}</p>
            </div>
          )}
          {state.kind === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="text-xs font-medium break-words">{state.message}</p>
            </div>
          )}

          <div>
            <label htmlFor="reef-booking" className="block text-[11px] font-bold text-[var(--text-primary)]/70 mb-1">
              {t('reefLogger.bookingLabel')}
            </label>
            <select
              id="reef-booking"
              value={bookingId}
              onChange={e => { setBookingId(e.target.value); if (state.kind === 'error') setState({ kind: 'idle' }); }}
              className={inputCls}
            >
              <option value="">{bookings == null ? t('reefLogger.loading') : bookings.length === 0 ? t('reefLogger.noBookings') : t('reefLogger.pickBooking')}</option>
              {(bookings ?? []).map(b => (
                <option key={b.id} value={b.id}>
                  {b.bookingRef} · {b.serviceType} · {b.scheduledDate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reef-action-type" className="block text-[11px] font-bold text-[var(--text-primary)]/70 mb-1">
              {t('reefLogger.actionLabel')}
            </label>
            <select
              id="reef-action-type"
              value={actionType}
              onChange={e => setActionType(e.target.value as ReefActionType)}
              className={inputCls}
            >
              {REEF_ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {t(`reefLogger.action.${opt.value}`)} (+{opt.points})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reef-description" className="block text-[11px] font-bold text-[var(--text-primary)]/70 mb-1">
              {t('reefLogger.descriptionLabel')}
            </label>
            <textarea
              id="reef-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={t('reefLogger.descriptionPlaceholder')}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-[var(--text-primary)]/45">{t('reefLogger.creditNote')}</p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-primary)]"
            >
              {state.kind === 'submitting' && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {state.kind === 'submitting' ? t('reefLogger.submitting') : t('reefLogger.submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};