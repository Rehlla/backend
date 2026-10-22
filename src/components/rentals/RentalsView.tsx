import React, { useCallback, useMemo, useState } from 'react';
import { Search, Bike, MapPin } from 'lucide-react';
import { RentalCard } from './RentalCard';
import { RentalDetailView } from './RentalDetailView';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { ConciergePageHeader } from '../concierge/ConciergePageHeader';
import type { RentalCategory, RentalCatalogueResponse, RentalListingView } from '../../shared/types/commerce';

const CATEGORY_ORDER: RentalCategory[] = ['bike', 'e-bike'];
const SORT_OPTIONS = ['featured', 'price_asc', 'price_desc', 'rating'] as const;

export const RentalsView: React.FC = () => {
  const { navigateTo, selectedRentalSlug } = useTrip();
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';

  const corpus = useApiResource<RentalCatalogueResponse>(
    useCallback((signal) => api.getRentals(undefined, signal), [])
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<Set<RentalCategory>>(() => new Set(CATEGORY_ORDER));
  const [activeZones, setActiveZones] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>('featured');

  const rentals = corpus.data?.rentals ?? [];
  const zones = corpus.data?.zones ?? [];

  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    set(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleCategory = (cat: RentalCategory) => toggle(setActiveCategories, cat);
  const toggleZone = (zoneId: string) => toggle(setActiveZones, zoneId);

  const filtered = useMemo<RentalListingView[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = rentals.filter(r => {
      if (!activeCategories.has(r.category)) return false;
      if (activeZones.size > 0) {
        const inPickupZone = activeZones.has(r.pickupZoneId);
        const inDeliveryZone = r.deliveryZones.some(z => activeZones.has(z.zoneId));
        if (!inPickupZone && !inDeliveryZone) return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.nameAr || '').toLowerCase().includes(q) ||
        (r.tagline || '').toLowerCase().includes(q) ||
        (r.taglineAr || '').toLowerCase().includes(q) ||
        (r.supplier?.businessName || '').toLowerCase().includes(q)
      );
    });
    if (sort === 'price_asc') return [...list].sort((a, b) => a.dailyRateEGP - b.dailyRateEGP);
    if (sort === 'price_desc') return [...list].sort((a, b) => b.dailyRateEGP - a.dailyRateEGP);
    if (sort === 'rating') return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.rating || 0) - (a.rating || 0));
  }, [rentals, activeCategories, activeZones, searchQuery, sort]);

  const stats = corpus.data?.stats;

  /**
   * Detail page wins when the URL carries a rental slug.
   *
   * This must run after every hook above (useApiResource, the four useState
   * calls, useMemo) — an early return before them made the hook count differ
   * between the list and detail routes ("Rendered fewer hooks than expected"),
   * which threw the whole view into its error boundary on every rental card
   * click. React hooks must run unconditionally, in the same order, every
   * render; only the JSX returned may branch.
   */
  if (selectedRentalSlug) {
    return (
      <RentalDetailView
        rentalSlug={selectedRentalSlug}
        onBackToList={() => navigateTo('/rentals')}
      />
    );
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
      }`}
    >
      {/* Concierge photographic band — one product voice across discovery */}
      <ConciergePageHeader
        eyebrow={t('rentals.title')}
        title={t('rentals.title')}
        subtitle={t('rentals.subtitle', { count: stats?.total ?? rentals.length })}
        image="/images/hero/golden-beach.jpg"
        imageAlt="Dahab bike rentals"
        compact
        meta={
          stats ? (
            <>
              <span className="font-semibold text-white/70">{stats.total} · {t('rentals.statsRentals')}</span>
              {stats.averageRating > 0 && (
                <span className="font-semibold text-white/70">{stats.averageRating.toFixed(1)}★ · {t('rentals.statsAvgRating')}</span>
              )}
            </>
          ) : undefined
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Search */}
        <div className="max-w-md mb-6">
          <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 ${isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'}`}>
            <Search className={`w-4 h-4 ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`} />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('rentals.searchPlaceholder')}
              aria-label={t('rentals.searchPlaceholder')}
              className={`w-full bg-transparent text-sm outline-none ${isDark ? 'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60' : 'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60'}`}
            />
          </div>
        </div>
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
              {t('rentals.categories')}:
            </span>
            {CATEGORY_ORDER.map(cat => {
              const active = activeCategories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-transparent'
                      : isDark
                        ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/40'
                        : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  {isAr ? CATEGORY_LABEL[cat].ar : CATEGORY_LABEL[cat].en}
                </button>
              );
            })}
          </div>

          {zones.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`flex items-center gap-1 text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                <MapPin className="w-3 h-3" />
                {t('rentals.zones')}:
              </span>
              {zones.map(zone => {
                const active = activeZones.has(zone.id);
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => toggleZone(zone.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                      active
                        ? 'bg-[var(--accent-secondary)] text-white border-transparent'
                        : isDark
                          ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-secondary)]/40'
                          : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-secondary)]'
                    }`}
                  >
                    {isAr ? zone.nameAr : zone.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className={`text-xs font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
              {filtered.length} {t('rentals.results')}
            </span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as (typeof SORT_OPTIONS)[number])}
              className={`text-xs font-bold rounded-lg border px-2.5 py-1.5 outline-none cursor-pointer ${isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'}`}
            >
              <option value="featured">{isAr ? 'مميز أولاً' : 'Featured first'}</option>
              <option value="price_asc">{isAr ? 'السعر: الأقل أولاً' : 'Price: low to high'}</option>
              <option value="price_desc">{isAr ? 'السعر: الأعلى أولاً' : 'Price: high to low'}</option>
              <option value="rating">{isAr ? 'الأعلى تقييماً' : 'Top rated'}</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(rental => (
              <RentalCard
                key={rental.id}
                rental={rental}
                isDark={isDark}
                onOpen={slug => navigateTo('/rentals', { rentalSlug: slug })}
              />
            ))}
          </div>
        ) : (
          <div className={`text-center py-16 text-sm ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
            {t('rentals.noMatches')}
          </div>
        )}
      </main>
    </div>
  );
};

const CATEGORY_LABEL: Record<RentalCategory, { en: string; ar: string }> = {
  'bike': { en: 'Bike', ar: 'دراجة' },
  'e-bike': { en: 'E-bike', ar: 'عجلة كهربائية' },
};