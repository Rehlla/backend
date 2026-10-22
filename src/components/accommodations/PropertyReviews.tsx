import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Star, ChevronLeft, ShieldCheck, Quote } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';

/**
 * What guests who stayed here said.
 *
 * The catalogue's own rating is a Tripadvisor number - a marketing figure that
 * predates this platform. These are the platform's own reviews, and every one
 * is tied to a booking the supplier actually completed
 * (reviewService.submitReview refuses an unfinished stay), so the section can
 * say "verified stay" and mean it.
 *
 * Until the first guest leaves one, the section says that plainly instead of
 * borrowing the catalogue's stars to look busy.
 */

interface PropertyReviewsProps {
  accommodationSlug: string;
  catalogueRating?: number;
  catalogueReviewCount?: number;
  /** Where the catalogue figures come from (Tripadvisor, Google reviews, …). */
  catalogueRatingSource?: string;
}

const Stars: React.FC<{ value: number; size?: string }> = ({ value, size = 'w-4 h-4' }) => (
  <span className="flex items-center gap-0.5" aria-label={`${value} / 5`}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-subtle)]'}`}
      />
    ))}
  </span>
);

export const PropertyReviews: React.FC<PropertyReviewsProps> = ({
  accommodationSlug,
  catalogueRating,
  catalogueReviewCount,
  catalogueRatingSource,
}) => {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';

  const [page, setPage] = useState(1);
  const data = useApiResource(
    useMemo(
      () => signal => api.getAccommodationReviews(accommodationSlug, { page, limit: 5 }, signal),
      [accommodationSlug, page]
    )
  );

  const reviews = data.data?.reviews ?? [];
  const average = data.data?.platformAverage ?? null;
  const count = data.data?.platformCount ?? 0;

  const authorLabel = (r: { authorFirstName: string; authorInitial?: string }) =>
    r.authorInitial ? `${r.authorFirstName} ${r.authorInitial}.` : r.authorFirstName;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' });

  return (
    <section data-testid="property-reviews">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
          {t('hotels.reviewsTitle')}
        </h2>
        {count > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={average ?? 0} />
            <span className="text-sm font-black">{average?.toFixed(1)}</span>
            <span className="text-xs text-[var(--text-secondary)]">
              ({count} {isAr ? 'تقييم مؤكد' : 'verified'})
            </span>
          </div>
        )}
      </div>

      {data.status === 'loading' && reviews.length === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="h-32 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] animate-pulse" />
          ))}
        </div>
      )}

      {data.status !== 'loading' && count === 0 && (
        <div className="flex items-start gap-3 max-w-prose">
          <Quote className="w-5 h-5 mt-0.5 shrink-0 text-[var(--text-secondary)]/60" aria-hidden="true" />
          <div>
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-0.5">{t('hotels.reviewsEmptyTitle')}</p>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            {t('hotels.reviewsEmptyBody')}
          </p>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {reviews.map((r, i) => (
            <motion.article
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <Stars value={r.rating} size="w-3.5 h-3.5" />
                <span className="text-[11px] text-[var(--text-secondary)]">{fmtDate(r.createdAt)}</span>
              </div>
              {r.title && <h3 className="text-sm font-bold text-[var(--text-primary)]">{r.title}</h3>}
              <p className="text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-4">
                {isAr ? (r.bodyAr ?? r.body) : r.body}
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                  {authorLabel(r)}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <ShieldCheck className="w-3 h-3" />
                  {t('hotels.reviewVerifiedStay')}
                </span>
              </div>
              {r.supplierResponse && (
                <div className="mt-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-2.5">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] mb-0.5">
                    {t('hotels.reviewSupplierReply')}
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {r.supplierResponse}
                  </p>
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}

      {count > 5 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-40 hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className={`w-3.5 h-3.5 ${isAr ? '' : 'rotate-180'}`} />
            {t('common.back')}
          </button>
          <span className="text-xs text-[var(--text-secondary)]">
            {page} / {Math.max(1, Math.ceil(count / 5))}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => (data.data?.hasMore ? p + 1 : p))}
            disabled={!data.data?.hasMore}
            className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-40 hover:text-[var(--text-primary)]"
          >
            {t('hotels.reviewsNext')}
            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      )}

      {catalogueRating !== undefined && catalogueRatingSource && (
        <p className="mt-4 text-[11px] text-[var(--text-secondary)]/70">
          {t('hotels.catalogueRatingNote', {
            rating: catalogueRating.toFixed(1),
            count: (catalogueReviewCount ?? 0).toLocaleString(),
            source: catalogueRatingSource,
          })}
        </p>
      )}
    </section>
  );
};

export default PropertyReviews;
