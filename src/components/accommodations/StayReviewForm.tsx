import React, { useEffect, useState } from 'react';
import { Star, Loader2, Check, PenLine } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

/**
 * Leave a review for a finished stay.
 *
 * The form exists only where the server would accept one: `submitReview`
 * verifies the booking belongs to the caller AND that the supplier marked it
 * completed (or its end has passed), so a stay still in progress renders
 * nothing rather than a form that would be rejected.
 */

const StayReviewForm: React.FC<{ bookingRef: string }> = ({ bookingRef }) => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [existing, setExisting] = useState<{ rating: number; title?: string; body: string; bodyAr?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the review already on file, so a correction is an edit
  // rather than a second review.
  useEffect(() => {
    let cancelled = false;
    api.getBookingReview(bookingRef).then(state => {
      if (cancelled || !state.review) return;
      setExisting({ rating: state.review.rating, title: state.review.title, body: state.review.body, bodyAr: state.review.bodyAr });
      setRating(state.review.rating);
      setTitle(state.review.title ?? '');
      setBody(state.review.body);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [bookingRef]);

  const submit = async () => {
    if (rating < 1 || body.trim().length < 3) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitBookingReview(bookingRef, {
        rating,
        body: body.trim(),
        title: title.trim() || undefined,
      });
      setDone(true);
    } catch (e: any) {
      setError(String(e?.message || t('hotels.reviewFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
        <Check className="mx-auto mb-2 h-7 w-7 text-emerald-600" />
        <p className="text-sm font-bold">{isAr ? 'تم إرسال تقييمك' : 'Your review is in'}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('hotels.reviewPendingNote')}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
      <div>
        <h3 className="text-sm font-black flex items-center gap-2">
          <PenLine className="h-4 w-4 text-[var(--accent-primary)]" />
          {existing ? t('hotels.reviewEditYours') : t('hotels.reviewTitle')}
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('hotels.reviewBodyHint')}</p>
      </div>

      <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t('hotels.reviewRating')}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} / 5`}
            onClick={() => setRating(n)}
            className="rounded-lg p-1 transition-transform hover:scale-110"
          >
            <Star className={`h-7 w-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-subtle)]'}`} />
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-[11px] font-bold text-[var(--text-secondary)]">{t('hotels.reviewHeadline')}</span>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder={t('hotels.reviewHeadlinePlaceholder')}
          className={`mt-1 w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-bold text-[var(--text-secondary)]">{t('hotels.reviewYourWords')}</span>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={t('hotels.reviewYourWordsPlaceholder')}
          className={`mt-1 w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
        />
      </label>

      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-[var(--text-secondary)]">{t('hotels.reviewVerifiedStay')}</p>
        <button
          type="button"
          disabled={submitting || rating < 1 || body.trim().length < 3}
          onClick={() => void submit()}
          className="rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-[var(--surface-container)] disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('hotels.reviewSubmit')}
        </button>
      </div>
    </div>
  );
};

export default StayReviewForm;
