import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTrip } from '../context/TripContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useApiResource } from '../hooks/useApiResource';
import { api } from '../services/api';
import type { RentalCategory, RentalCatalogueResponse, RentalListingView, RentalZone } from '../shared/types/commerce';
import { RentalCard } from '../components/rentals/RentalCard';
import { RentalDetail } from '../components/rentals/RentalDetail';
import { MyRentalBookings } from '../components/rentals/MyRentalBookings';
import { ConciergePageHeader } from '../components/concierge/ConciergePageHeader';
import { Search, Bike, MapPin, X, ChevronDown, Clock } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'featured', labelEn: 'Featured', labelAr: 'مميز' },
  { value: 'price_asc', labelEn: 'Price: Low to High', labelAr: 'السعر: من الأقل للأعلى' },
  { value: 'price_desc', labelEn: 'Price: High to Low', labelAr: 'السعر: من الأعلى للأقل' },
  { value: 'rating', labelEn: 'Top Rated', labelAr: 'الأعلى تقييماً' },
] as const;

const PAGE_SIZE = 12;

export const RentalsPage: React.FC = () => {
  const { navigateTo, selectedRentalSlug } = useTrip();
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';

  const isBookingsView = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('myBookings') === 'true';

  // ── Show My Bookings when ?myBookings=true ──────────────────────────
  if (isBookingsView) {
    return <MyRentalBookings />;
  }

  // ── Show detail when a slug is selected ──────────────────────────────
  if (selectedRentalSlug) {
    return (
      <RentalDetail
        rentalSlug={selectedRentalSlug}
        onBackToList={() => navigateTo('/rentals')}
      />
    );
  }

  // ── URL-sync filters ─────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  });

  // Sync URL ?rentalSlug into TripContext so the detail view picks it up
  // after a refresh or direct deep link.
  useEffect(() => {
    const slug = searchParams.get('rentalSlug');
    if (slug && typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
      setSearchParams(prev => { prev.delete('rentalSlug'); return prev; });
    }
  }, []);

  const activeCategories = useMemo<Set<RentalCategory>>(() => {
    const raw = searchParams.get('category');
    if (!raw || raw === 'all') return new Set<RentalCategory>(['bike', 'e-bike']);
    return new Set(raw.split(',').filter(Boolean) as RentalCategory[]);
  }, [searchParams]);

  const activeZone = useMemo<string | null>(() => {
    const raw = searchParams.get('zone');
    return raw && raw !== 'all' ? raw : null;
  }, [searchParams]);

  const priceMax = useMemo(() => {
    const raw = searchParams.get('priceMax');
    const n = parseInt(raw || '', 10);
    return (n > 0 && n <= 10000) ? n : 10000;
  }, [searchParams]);

  const sort = useMemo(() => {
    const raw = searchParams.get('sort');
    if (raw && SORT_OPTIONS.some(o => o.value === raw)) return raw;
    return 'featured';
  }, [searchParams]);

  const searchQuery = useMemo(() => searchParams.get('q') || '', [searchParams]);

  // ── Fetch rentals ────────────────────────────────────────────────────
  const corpus = useApiResource<RentalCatalogueResponse>(
    useCallback((signal) => api.getRentals(undefined, signal), [])
  );

  const [rentals, setRentals] = useState<RentalListingView[]>([]);
  const [zones, setZones] = useState<RentalZone[]>([]);

  useEffect(() => {
    if (corpus.data) {
      setRentals(corpus.data.rentals || []);
      setZones(corpus.data.zones || []);
    }
  }, [corpus.data]);

  // ── Filter + sort ────────────────────────────────────────────────────
  const filtered = useMemo<RentalListingView[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rentals.filter(r => {
      if (!activeCategories.has(r.category)) return false;
      if (activeZone) {
        const inPickup = r.pickupZoneId === activeZone;
        const inDelivery = r.deliveryZones.some(z => z.zoneId === activeZone);
        if (!inPickup && !inDelivery) return false;
      }
      if (r.dailyRateEGP > priceMax) return false;
      if (q) {
        const haystack = [
          r.name, r.nameAr, r.tagline, r.taglineAr,
          r.supplier?.businessName, r.supplier?.businessNameAr,
        ].filter(Boolean).map((s) => (s as string).toLowerCase()).join(' ');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'price_asc') list.sort((a, b) => a.dailyRateEGP - b.dailyRateEGP);
    else if (sort === 'price_desc') list.sort((a, b) => b.dailyRateEGP - a.dailyRateEGP);
    else if (sort === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

    return list;
  }, [rentals, activeCategories, activeZone, priceMax, sort, searchQuery]);

  const displayed = useMemo(() => filtered.slice(0, PAGE_SIZE), [filtered]);
  const hasMore = filtered.length > PAGE_SIZE;

  // ── URL sync helpers ─────────────────────────────────────────────────
  const updateURL = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '') next.delete(key);
      else next.set(key, val);
    }
    window.history.replaceState(null, '', `?${next.toString()}`);
    setSearchParams(next);
  }, [searchParams]);

  const setCategoryFilter = useCallback((cats: Set<RentalCategory>) => {
    const next = new URLSearchParams(searchParams);
    if (cats.size === 2) next.set('category', 'all');
    else next.set('category', [...cats].join(','));
    next.delete('q');
    window.history.replaceState(null, '', `?${next.toString()}`);
    setSearchParams(next);
  }, [searchParams]);

  const setZoneFilter = useCallback((zone: string | null) => {
    updateURL({ zone: zone ?? 'all' });
  }, [updateURL]);

  const setPriceMax = useCallback((max: number) => {
    updateURL({ priceMax: String(max) });
  }, [updateURL]);

  const setSort = useCallback((s: string) => {
    updateURL({ sort: s });
  }, [updateURL]);

  const setSearch = useCallback((q: string) => {
    updateURL({ q: q || null });
  }, [updateURL]);

  const resetFilters = useCallback(() => {
    const next = new URLSearchParams();
    window.history.replaceState(null, '', `?${next.toString()}`);
    setSearchParams(next);
  }, []);

  const toggleCategory = (cat: RentalCategory) => {
    const next = new Set(activeCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setCategoryFilter(next);
  };

  const handleViewDetail = useCallback((slug: string) => {
    navigateTo('/rentals', { rentalSlug: slug });
  }, [navigateTo]);

  const showActiveCategories = activeCategories.size === 2;
  const showAllZones = activeZone === null;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col ${isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'}`}>
      {/* Header */}
      <ConciergePageHeader
        eyebrow={t('rentals.title')}
        title={t('rentals.title')}
        subtitle={t('rentals.subtitle', { count: rentals.length })}
        image="/images/hero/golden-beach.jpg"
        imageAlt="Dahab rentals"
        bright
        actions={
          <button
            type="button"
            onClick={() => { const q = new URLSearchParams(window.location.search); q.set('myBookings', 'true'); navigateTo('/rentals'); window.history.pushState(null, '', '/rentals?' + q.toString()); }}
            className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full bg-[var(--text-primary)]/15 hover:bg-[var(--text-primary)]/25 text-xs font-bold text-[var(--text-primary)] backdrop-blur-sm transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {t('rentals.myBookings')}
          </button>
        }
      />

      {/* Filters Bar */}
      <div className="relative z-20 mx-auto -mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.16)] sm:p-5">
          {/* Search */}
          <div className="relative">
            <Search className={`pointer-events-none absolute ${isAr ? 'left-4' : 'right-4'} top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-secondary)]/60`} />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('rentals.searchPlaceholder')}
              className={`min-h-[54px] w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] ps-12 pe-4 text-base text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10 ${isAr ? 'pl-12 pr-4' : 'pl-4 pr-12'}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--surface-container)]`}
              >
                <X className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter(new Set(['bike', 'e-bike']))}
              aria-pressed={showActiveCategories}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                showActiveCategories
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            {(['bike', 'e-bike'] as RentalCategory[]).map(cat => {
              const active = activeCategories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                    active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-container)] text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)]'
                  }`}
                >
                  {isAr ? (cat === 'e-bike' ? 'عجلة كهربائية' : 'دراجة عادية') : (cat === 'e-bike' ? 'E-bike' : 'Bike')}
                </button>
              );
            })}
          </div>

          {/* Zones */}
          {zones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setZoneFilter(null)}
                aria-pressed={showAllZones}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  showAllZones
                    ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)] text-white'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'جميع المناطق' : 'All zones'}
              </button>
              {zones.map(zone => {
                const active = activeZone === zone.id;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setZoneFilter(active ? null : zone.id)}
                    aria-pressed={active}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      active
                        ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)] text-white'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-container)] text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isAr ? zone.nameAr : zone.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Price + Sort */}
          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[var(--text-secondary)]">{t('rentals.filter')}</span>
              <input
                type="range"
                min={100}
                max={5000}
                step={100}
                value={priceMax}
                onChange={e => setPriceMax(Number(e.target.value))}
                className="w-32 sm:w-40"
              />
              <span className="text-xs font-bold text-[var(--accent-primary)]">
                {isAr ? `حتى ${priceMax.toLocaleString()} ج.م` : `Up to ${priceMax.toLocaleString()} EGP`}
              </span>
              {(activeZone || priceMax < 10000 || !showActiveCategories || searchQuery) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                >
                  <ChevronDown className="w-3 h-3 rtl:rotate-180" />
                  {isAr ? 'إعادة تعيين' : 'Reset'}
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="mt-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 flex-1">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--accent-primary)]">{t('rentals.showing')}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              {t('rentals.results')} ({filtered.length})
            </h2>
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                const per = Math.min(PAGE_SIZE + 12, 60);
                next.set('per', String(per));
                window.history.replaceState(null, '', `?${next.toString()}`);
                setSearchParams(next);
              }}
              className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold cursor-pointer"
            >
              {t('rentals.loadMore')}
            </button>
          )}
        </div>

        {displayed.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            <Bike className="w-10 h-10 mx-auto text-[var(--text-secondary)]/30 mb-4" />
            <p className="text-sm text-[var(--text-secondary)]">{t('rentals.noMatches')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayed.map(rental => (
              <RentalCard
                key={rental.id}
                rental={rental}
                onOpen={() => handleViewDetail(rental.slug)}
                isDark={isDark}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default RentalsPage;
