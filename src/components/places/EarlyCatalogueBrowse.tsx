import React, { useCallback, useMemo, useState } from 'react';
import { ExternalLink, Search, Star } from 'lucide-react';
import { useDestination } from '../../context/DestinationContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useApiResource } from '../../hooks/useApiResource';
import { api } from '../../services/api';
import { ConciergePageHeader } from '../concierge/ConciergePageHeader';
import type { BrowseRestaurant, BrowseStay } from '../../shared/placeBrowse';

function usePlaceName(): string {
  const { destination } = useDestination();
  const { language } = useLanguage();
  return destination.name[language === 'ar' ? 'ar' : 'en'];
}

const EarlyShell: React.FC<{
  titleKey: 'places.early.staysTitle' | 'places.early.restaurantsTitle';
  noteKey: 'places.early.staysNote' | 'places.early.restaurantsNote';
  count: number;
  query: string;
  onQuery: (value: string) => void;
  children: React.ReactNode;
}> = ({ titleKey, noteKey, count, query, onQuery, children }) => {
  const { destination } = useDestination();
  const { language, t } = useLanguage();
  const place = usePlaceName();
  const isAr = language === 'ar';
  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <ConciergePageHeader
        eyebrow={t('places.early.browseOnly')}
        title={t(titleKey, { place })}
        subtitle={t('places.early.count', { count })}
        image={destination.heroImage}
        imageAlt={place}
        compact
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">{t(noteKey, { place })}</p>
        <label className="relative block max-w-xl">
          <Search className={`pointer-events-none w-4 h-4 absolute top-1/2 -translate-y-1/2 text-[var(--text-secondary)] ${isAr ? 'right-3' : 'left-3'}`} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={t('places.early.search')}
            aria-label={t('places.early.search')}
            className={`w-full min-h-12 ${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'} rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40`}
          />
        </label>
        {children}
      </div>
    </div>
  );
};

const Rating: React.FC<{ rating: number }> = ({ rating }) => {
  const { t } = useLanguage();
  return (
    <span className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-[var(--text-primary)]" aria-label={t('places.early.rating', { rating })}>
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      {rating}
    </span>
  );
};

const StatusBlock: React.FC<{ status: string; error: string | null; onRetry: () => void; cards?: boolean }> = ({ status, error, onRetry, cards = false }) => {
  const { t } = useLanguage();
  const place = usePlaceName();
  if (status === 'loading') {
    return (
      <div role="status" aria-label={t('places.early.loading')} className={cards ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-3'}>
        {Array.from({ length: cards ? 6 : 4 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden">
            {cards && <div className="aspect-[4/3] bg-[var(--surface-container)] motion-safe:animate-pulse" />}
            <div className="p-4 space-y-2">
              <div className="h-4 w-2/3 rounded bg-[var(--surface-container)] motion-safe:animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-[var(--surface-container)] motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div role="alert" className="py-12 px-4 rounded-3xl border border-[var(--border-subtle)] text-center bg-[var(--surface-card)] space-y-4">
        <p className="text-base text-[var(--text-secondary)]">{error || t('places.early.failed')}</p>
        <button type="button" onClick={onRetry} className="min-h-11 px-5 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40">
          {t('hotels.retry')}
        </button>
      </div>
    );
  }
  return <p role="status" className="text-base text-[var(--text-secondary)]">{t('places.early.empty', { place })}</p>;
};

export const EarlyStaysBrowse: React.FC = () => {
  const { destinationId } = useDestination();
  const { t } = useLanguage();
  const place = usePlaceName();
  const [query, setQuery] = useState('');
  const [hiddenPhotos, setHiddenPhotos] = useState<Set<string>>(() => new Set());
  const browse = useApiResource(
    useCallback((signal) => api.getPlaceBrowse(destinationId, 'stay', signal), [destinationId]),
    { cacheKey: `places:${destinationId}:stay`, ttlMs: 60_000 },
  );
  const stays = (browse.data?.places ?? []) as BrowseStay[];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stays;
    return stays.filter((stay) => stay.name.toLowerCase().includes(q) || (stay.locality ?? '').toLowerCase().includes(q));
  }, [stays, query]);

  return (
    <EarlyShell titleKey="places.early.staysTitle" noteKey="places.early.staysNote" count={stays.length} query={query} onQuery={setQuery}>
      {browse.status !== 'ready' ? (
        <StatusBlock status={browse.status} error={browse.error} onRetry={browse.reload} cards />
      ) : visible.length === 0 ? (
        <p role="status" className="text-base text-[var(--text-secondary)]">{stays.length === 0 ? t('places.early.empty', { place }) : t('places.early.noMatch')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((stay) => (
            <article key={stay.id} className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-card)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--accent-primary)]/50 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/40">
              <div className="relative aspect-[4/3] bg-[var(--surface-container)]">
                {!hiddenPhotos.has(stay.id) && (
                  <img
                    src={stay.photoUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={() => setHiddenPhotos((current) => new Set(current).add(stay.id))}
                  />
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display font-semibold text-base sm:text-lg leading-snug line-clamp-2">{stay.name}</h2>
                  <Rating rating={stay.rating} />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {[stay.propertyType, stay.locality, stay.reviewCount > 0 ? t('places.early.reviews', { count: stay.reviewCount }) : null].filter(Boolean).join(' · ')}
                </p>
                {stay.url && (
                  <a
                    href={stay.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[var(--accent-primary)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40 rounded-lg"
                  >
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    {t('places.early.source')}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </EarlyShell>
  );
};

export const EarlyRestaurantsBrowse: React.FC = () => {
  const { destinationId } = useDestination();
  const { t } = useLanguage();
  const place = usePlaceName();
  const [query, setQuery] = useState('');
  const browse = useApiResource(
    useCallback((signal) => api.getPlaceBrowse(destinationId, 'restaurant', signal), [destinationId]),
    { cacheKey: `places:${destinationId}:restaurant`, ttlMs: 60_000 },
  );
  const restaurants = (browse.data?.places ?? []) as BrowseRestaurant[];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(q) || restaurant.cuisines.some((cuisine) => cuisine.toLowerCase().includes(q)),
    );
  }, [restaurants, query]);

  return (
    <EarlyShell titleKey="places.early.restaurantsTitle" noteKey="places.early.restaurantsNote" count={restaurants.length} query={query} onQuery={setQuery}>
      {browse.status !== 'ready' ? (
        <StatusBlock status={browse.status} error={browse.error} onRetry={browse.reload} />
      ) : visible.length === 0 ? (
        <p role="status" className="text-base text-[var(--text-secondary)]">{restaurants.length === 0 ? t('places.early.empty', { place }) : t('places.early.noMatch')}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((restaurant) => (
            <li key={restaurant.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-2 transition-[border-color,box-shadow] duration-200 hover:border-[var(--accent-primary)]/50">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display font-semibold text-base sm:text-lg leading-snug">{restaurant.name}</h2>
                {restaurant.rating != null ? <Rating rating={restaurant.rating} /> : (
                  <span className="shrink-0 text-sm text-[var(--text-secondary)]">{t('places.early.unreviewed')}</span>
                )}
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                {[restaurant.cuisines.join(', '), restaurant.priceBand, restaurant.reviewCount > 0 ? t('places.early.reviews', { count: restaurant.reviewCount }) : null].filter(Boolean).join(' · ')}
              </p>
              {restaurant.quote && (
                <blockquote className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">"{restaurant.quote}"</blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </EarlyShell>
  );
};
