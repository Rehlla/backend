import React, { useEffect, useMemo, useState } from 'react';
import { PenLine, Star, X } from 'lucide-react';
import { api, BookingReviewState } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { ApiError } from '../../services/apiError';
import { isReviewEligible } from '../../services/bookingManage';

/**
 * Verified-stay review invitations (blueprint row #14).
 *
 * Reads the session's completed bookings through the detailed bookings API
 * (same server-side ownership scoping as the manage modal), checks each for
 * an open review invitation via GET /api/bookings/:ref/review, and offers an
 * inline 1–5 star + text form that POSTs the verified review. After a
 * successful submit the invitation is consumed server-side, so the CTA and
 * the form both disappear — the review exists, the invitation is done.
 *
 * Kept self-contained on purpose: the ConfirmedBookingItem cards on this
 * surface come from a mapper that has no bookingRef, so reusing them would
 * need a wider type change. This panel owns its own fetch + state instead.
 */

interface CompletedBooking {
  bookingRef: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string;
  supplierId: string;
}

const STAR_KEYS = ['review.star1', 'review.star2', 'review.star3', 'review.star4', 'review.star5'] as const;
/**
 * Bilingual service-type labels. Keyed per language because this is a tiny
 * closed set (7 verticals) used in one place — a key family of 7×2 entries
 * in translations.ts would be wider than the win.
 */
const SERVICE_LABEL: Record<string, { en: string; ar: string }> = {
  hotel: { en: 'Stay', ar: 'إقامة' },
  transfer: { en: 'Transfer', ar: 'تنقلات' },
  diving: { en: 'Diving', ar: 'غطس' },
  safari: { en: 'Safari', ar: 'سفاري' },
  wellness: { en: 'Wellness', ar: 'عافية' },
  dining: { en: 'Dining', ar: 'مطاعم' },
  rental: { en: 'Rental', ar: 'تأجير' },
};

const StarButton: React.FC<{
  value: number;
  active: boolean;
  label: string;
  onSelect: (v: number) => void;
}> = ({ value, active, label, onSelect }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    aria-label={label}
    onClick={() => onSelect(value)}
    className={`p-1.5 rounded-full cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
      active ? 'text-amber-400' : 'text-[var(--text-secondary)]/40 hover:text-amber-300'
    }`}
  >
    <Star className="w-6 h-6" fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>
);

export const ReviewInvitations: React.FC<{ tripId: string | null }> = ({ tripId }) => {
  const { t, language } = useLanguage();
  const serviceLabel = (s: string) => (SERVICE_LABEL[s] ? SERVICE_LABEL[s][language === 'ar' ? 'ar' : 'en'] : s);

  const [completed, setCompleted] = useState<CompletedBooking[]>([]);
  const [states, setStates] = useState<Record<string, BookingReviewState>>({});
  const [loaded, setLoaded] = useState(false);
  const [openFormFor, setOpenFormFor] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const detailed = await api.getTripBookingsDetailed(tripId);
        // Only services that have happened. paymentState CAPTURED used to
        // qualify, and card checkout captures at purchase — so a traveller was
        // invited to review a dive weeks before it, and the server now
        // refuses that review (409). Same rule as the server: COMPLETED, or
        // accepted and its day in Dahab is over.
        const done = (detailed.bookings || []).filter(b => isReviewEligible(b));
        if (cancelled) return;
        setCompleted(done as CompletedBooking[]);
        const found: Record<string, BookingReviewState> = {};
        await Promise.all(
          done.map(async b => {
            try {
              found[b.bookingRef] = await api.getBookingReview(b.bookingRef);
            } catch {
              // A missing review state never blocks the surface.
            }
          }),
        );
        if (!cancelled) {
          setStates(found);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const invitations = useMemo(
    () =>
      completed.filter(b => {
        const s = states[b.bookingRef];
        // Show when the server says there is an open invitation; if the state
        // lookup failed entirely, fall back to "no review yet".
        return s ? s.invitation && !s.review : !s;
      }),
    [completed, states],
  );

  const openForm = (bookingRef: string) => {
    setOpenFormFor(bookingRef);
    setRating(0);
    setBody('');
    setError(null);
    setThanks(false);
  };

  const submit = async () => {
    if (!openFormFor || rating < 1 || body.trim().length < 10) {
      setError(t('review.needRatingAndWords'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.submitBookingReview(openFormFor, { rating, body: body.trim() });
      setStates(prev => ({
        ...prev,
        [openFormFor]: { review: null, invitation: false },
      }));
      setCompleted(prev => prev.filter(b => b.bookingRef !== openFormFor));
      setOpenFormFor(null);
      setThanks(true);
    } catch (err: unknown) {
      // 409: the server does not consider the service finished yet. Say that
      // plainly rather than echoing its sentence.
      setError(
        err instanceof ApiError && err.status === 409
          ? t('review.notFinishedYet')
          : t('review.submitFailed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) return null;
  if (completed.length === 0 && !thanks) return null;

  const formBooking = completed.find(b => b.bookingRef === openFormFor);

  return (
    <section
      aria-labelledby="review-invitations-heading"
      className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-6 shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id="review-invitations-heading" className="font-bold text-base sm:text-lg text-[var(--text-primary)]">
            {t('review.invitationsHeading')}
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">{t('review.invitationsSub')}</p>
        </div>
        {thanks && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <PenLine className="w-4 h-4" aria-hidden="true" />
            {t('review.thanksPublished')}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {formBooking && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-[var(--accent-primary)] block">
                  {serviceLabel(formBooking.serviceType)}
                </span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{formBooking.bookingRef}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenFormFor(null)}
                aria-label={t('review.cancel')}
                className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div role="radiogroup" aria-label={t('review.yourRating')} className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(v => (
                <StarButton
                  key={v}
                  value={v}
                  active={v <= rating}
                  label={t(STAR_KEYS[v - 1])}
                  onSelect={setRating}
                />
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--text-secondary)]">{t('review.yourWords')}</span>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={4}
                maxLength={2000}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
                placeholder={t('review.placeholder')}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </label>

            {error && (
              <p role="alert" className="text-xs font-semibold text-red-300">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--text-secondary)]/70">{t('review.verifiedBadgeNote')}</span>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="px-5 py-2.5 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-primary-ink)] text-xs font-extrabold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('review.sending') : t('review.submit')}
              </button>
            </div>
          </div>
        )}

        {!formBooking && invitations.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)]">{t('review.allCaughtUp')}</p>
        )}

        {!formBooking &&
          invitations.map(b => (
            <div
              key={b.bookingRef}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3"
            >
              <div>
                <span className="text-[11px] font-bold text-[var(--accent-primary)] block">
                  {serviceLabel(b.serviceType)}
                </span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{b.bookingRef}</span>
              </div>
              <button
                type="button"
                onClick={() => openForm(b.bookingRef)}
                className="px-4 py-2 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-primary-ink)] text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                {t('review.writeCta')}
              </button>
            </div>
          ))}
      </div>
    </section>
  );
};
