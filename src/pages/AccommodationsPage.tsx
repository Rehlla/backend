import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  MapPin,
  Users,
  ArrowUpDown,
  Loader2,
  Sparkles,
  Globe,
} from 'lucide-react';
import { AccommodationList } from '../components/accommodations/AccommodationList';
import { AccommodationDetailView } from '../components/accommodations/AccommodationDetailView';
import { useTrip } from '../context/TripContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import { useDestination } from '../context/DestinationContext';
import { api } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { ConciergePageHeader } from '../components/concierge/ConciergePageHeader';
import { DESTINATIONS, DESTINATION_IDS, DEFAULT_DESTINATION, type DestinationId } from '../design/destinations';
import type {
  AccommodationCatalogueResponse,
  PropertyType,
  HotelCategory,
  HotelPriceBand,
} from '../shared/types/commerce';

/** Order used when rendering filter chips and when no explicit sort is chosen. */
const PROPERTY_TYPE_ORDER: PropertyType[] = [
  'hotel', 'resort', 'boutique-hotel', 'hostel',
  'apartment', 'studio', 'villa', 'guesthouse', 'camp', 'eco-lodge',
];
const CATEGORY_ORDER: HotelCategory[] = ['budget', 'mid-range', 'boutique', 'resort'];
const BAND_ORDER: HotelPriceBand[] = ['budget', 'moderate', 'premium'];
const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance', labelAr: 'الملاءمة' },
  { id: 'rating', label: 'Rating', labelAr: 'التقييم' },
  { id: 'price_asc', label: 'Price: Low to High', labelAr: 'السعر: من الأرخص' },
  { id: 'price_desc', label: 'Price: High to Low', labelAr: 'السعر: من الأغلى' },
] as const;

/** Map areaId prefix to destination — no schema change needed. */
const AREA_PREFIX_TO_DESTINATION: Record<string, DestinationId> = {
  siwa: 'siwa',
  nuweiba: 'nuweiba',
  dahab: 'dahab',
};

function destinationForAreaId(areaId: string): DestinationId {
  const prefix = areaId.split('_')[0];
  return AREA_PREFIX_TO_DESTINATION[prefix] ?? DEFAULT_DESTINATION;
}

// ---------------------------------------------------------------------------
// URL-sync helpers — mirrors the ExploreView / AccommodationsView pattern:
// state owns the value, an effect pushes it into location.search.
// ---------------------------------------------------------------------------

function readParam(name: string): string | null {
  return typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(name);
}
function readCsvParam<T extends string>(name: string): Set<T> {
  const raw = readParam(name);
  return raw ? new Set(raw.split(',').filter(Boolean) as T[]) : new Set();
}

// ---------------------------------------------------------------------------

export const AccommodationsPage: React.FC = () => {
  const { navigateTo, selectedHotelSlug } = useTrip();
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const { showToast } = useUI();
  const isAr = language === 'ar';

  // ---- URL-backed filter state ----
  const [searchQuery, setSearchQuery] = useState(() => readParam('q') || '');
  const [activePropertyTypes, setActivePropertyTypes] = useState<Set<PropertyType>>(
    () => {
      const fromUrl = readCsvParam<PropertyType>('propertyType');
      return fromUrl.size > 0 ? fromUrl : new Set(PROPERTY_TYPE_ORDER);
    }
  );
  const [activeCategories, setActiveCategories] = useState<Set<HotelCategory>>(
    () => {
      const fromUrl = readCsvParam<HotelCategory>('category');
      return fromUrl.size > 0 ? fromUrl : new Set(CATEGORY_ORDER);
    }
  );
  const [activeBands, setActiveBands] = useState<Set<HotelPriceBand>>(
    () => {
      const fromUrl = readCsvParam<HotelPriceBand>('priceBand');
      return fromUrl.size > 0 ? fromUrl : new Set(BAND_ORDER);
    }
  );
  const [activeAreas, setActiveAreas] = useState<Set<string>>(
    () => readCsvParam<string>('areaId')
  );
  const [guests, setGuests] = useState<number>(() => {
    const raw = readParam('guests');
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const [maxPerNightEGP, setMaxPerNightEGP] = useState<number>(() => {
    const raw = readParam('maxPerNightEGP');
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const [sort, setSort] = useState<string>(() => readParam('sort') || 'relevance');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const { destinationId: destination, setDestination } = useDestination();

  // Sync state → URL (replacing, same as ExploreView).
  const syncUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    else params.delete('q');
    if (activePropertyTypes.size > 0 &&
        activePropertyTypes.size < PROPERTY_TYPE_ORDER.length) {
      params.set('propertyType', [...activePropertyTypes].join(','));
    } else params.delete('propertyType');
    if (activeCategories.size > 0 &&
        activeCategories.size < CATEGORY_ORDER.length) {
      params.set('category', [...activeCategories].join(','));
    } else params.delete('category');
    if (activeBands.size > 0 && activeBands.size < BAND_ORDER.length) {
      params.set('priceBand', [...activeBands].join(','));
    } else params.delete('priceBand');
    if (activeAreas.size > 0) params.set('areaId', [...activeAreas].join(','));
    else params.delete('areaId');
    if (guests > 0) params.set('guests', String(guests));
    else params.delete('guests');
    if (maxPerNightEGP > 0) params.set('maxPerNightEGP', String(maxPerNightEGP));
    else params.delete('maxPerNightEGP');
    if (sort && sort !== 'relevance') params.set('sort', sort);
    else params.delete('sort');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [searchQuery, activePropertyTypes, activeCategories, activeBands,
      activeAreas, guests, maxPerNightEGP, sort]);

  // Push whenever any filter changes.
  useEffect(() => { syncUrl(); }, [
    searchQuery, activePropertyTypes, activeCategories, activeBands,
    activeAreas, guests, maxPerNightEGP, sort, syncUrl,
  ]);

  // ---- Fetch the catalogue ----
  const corpus = useApiResource<AccommodationCatalogueResponse>(
    useCallback((signal) => api.getAccommodations(undefined, signal), [])
  );

  const allAreas = corpus.data?.areas ?? [];
  const areas = useMemo(
    () => allAreas.filter(a => destinationForAreaId(a.id) === destination),
    [allAreas, destination]
  );

  // ---- Derive the filtered + sorted list ----
  const allAccommodations = useMemo(
    () => (corpus.data?.accommodations ?? []).filter(a => !a.slug.startsWith('example-')),
    [corpus.data?.accommodations]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allAccommodations.filter(a => {
      if (destinationForAreaId(a.areaId) !== destination) return false;
      if (!activePropertyTypes.has(a.propertyType)) return false;
      if (activeCategories.size < CATEGORY_ORDER.length &&
          !activeCategories.has(a.category as HotelCategory)) return false;
      if (!activeBands.has(a.priceBand)) return false;
      if (activeAreas.size > 0 && !activeAreas.has(a.areaId)) return false;
      if (guests > 0 && a.maxGuests < guests) return false;
      if (maxPerNightEGP > 0 && a.perNightEGP > maxPerNightEGP) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.nameAr || '').toLowerCase().includes(q) ||
        (a.areaName || '').toLowerCase().includes(q) ||
        (a.areaNameAr || '').toLowerCase().includes(q) ||
        (a.tagline || '').toLowerCase().includes(q)
      );
    });
  }, [allAccommodations, activePropertyTypes, activeCategories, activeBands,
      activeAreas, guests, maxPerNightEGP, searchQuery, destination]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case 'rating':
        list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
        break;
      case 'price_asc':
        list.sort((a, b) => a.perNightEGP - b.perNightEGP);
        break;
      case 'price_desc':
        list.sort((a, b) => b.perNightEGP - a.perNightEGP);
        break;
      default:
        // relevance — keep server order (already sorted by the backend).
        break;
    }
    return list;
  }, [filtered, sort]);

  // ---- Featured (top-rated) chip ----
  const [featuredId, rest] = useMemo(() => {
    if (sorted.length === 0) return [null, []] as const;
    const byRating = [...sorted].sort((a, b) =>
      b.rating - a.rating || b.reviewCount - a.reviewCount
    );
    const top = byRating[0];
    // Only promote when the traveler has not themselves narrowed to a single item
    // via propertyType/category/band/area — otherwise the featured strip feels
    // like a separate selection on top of their own.
    const narrowed =
      activePropertyTypes.size === 1 ||
      activeCategories.size < CATEGORY_ORDER.length ||
      activeBands.size < BAND_ORDER.length ||
      activeAreas.size > 0;
    const id = narrowed ? null : top.id;
    return [id, sorted.filter(a => a.id !== id)] as const;
  }, [sorted, activePropertyTypes, activeCategories, activeBands, activeAreas]);

  // ---- Filter panel secondary count (badge on "More filters" button) ----
  const secondaryFilterCount =
    (activeCategories.size < CATEGORY_ORDER.length ? 1 : 0) +
    (activeBands.size < BAND_ORDER.length ? 1 : 0) +
    (guests > 0 ? 1 : 0) +
    (maxPerNightEGP > 0 ? 1 : 0) +
    (activeAreas.size > 0 ? 1 : 0);

  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    set(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const clearFilters = () => {
    setActiveCategories(new Set(CATEGORY_ORDER));
    setActiveBands(new Set(BAND_ORDER));
    setGuests(0);
    setMaxPerNightEGP(0);
    setActiveAreas(new Set());
  };

  const setTypeFilter = (types: Set<PropertyType>) => {
    setActivePropertyTypes(types);
  };

  // ---- Render: detail page when a slug is selected ----
  if (selectedHotelSlug) {
    return (
      <AccommodationDetailView
        accommodationSlug={selectedHotelSlug}
        onBackToList={() => navigateTo('/accommodations')}
      />
    );
  }

  const stats = corpus.data?.stats;
  const disclaimer = corpus.data?.disclaimer;

  // ---- Filter-panel popover (More filters) ----
  const renderFilterPanel = () => (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      role="dialog"
      aria-label={t('accommodations.filters')}
      className={`fixed inset-x-4 bottom-24 z-[1000] max-h-[70svh] space-y-4 overflow-y-auto rounded-[1.75rem] border p-4 shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:mt-2 sm:w-[min(90vw,380px)] ${isAr ? 'sm:left-0' : 'sm:right-0'} ${
        isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-white border-[var(--border-subtle)]'
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <p className="text-sm font-extrabold text-[var(--text-primary)]">{t('accommodations.filters')}</p>
        <button
          type="button"
          onClick={() => setShowFilterPanel(false)}
          aria-label={t('common.close')}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Property type (full row, since it is the primary filter) */}
      <div>
        <div className="text-xs font-bold mb-2 text-[var(--text-secondary)]">
          {t('accommodations.propertyType')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTypeFilter(new Set(PROPERTY_TYPE_ORDER))}
            className={`min-h-10 rounded-full border px-3 text-xs font-bold ${
              activePropertyTypes.size === PROPERTY_TYPE_ORDER.length
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                : isDark
                  ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {t('accommodations.allTypes')}
          </button>
          {PROPERTY_TYPE_ORDER.map(pt => {
            const active = activePropertyTypes.has(pt);
            return (
              <button
                key={pt}
                type="button"
                onClick={() => {
                  const next = new Set(activePropertyTypes);
                  if (next.has(pt)) {
                    if (next.size === 1) return; // keep at least one selected
                    next.delete(pt);
                  } else next.add(pt);
                  setTypeFilter(next);
                }}
                className={`min-h-10 rounded-full border px-3 text-xs font-bold cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                    : isDark
                      ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {isAr ? (
                  {
                    hotel: 'فندق', hostel: 'نُزل', apartment: 'شقة', studio: 'استوديو',
                    villa: 'فيلا', guesthouse: 'بيت ضيافة', camp: 'مخيم',
                    'eco-lodge': 'نُزل بيئي', 'boutique-hotel': 'فندق بوتيك',
                    resort: 'منتجع', chalet: 'شاليه',
                  }[pt] ?? pt
                ) : (
                  pt.charAt(0).toUpperCase() + pt.slice(1).replace('-', ' ')
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category */}
      <div>
        <div className="text-xs font-bold mb-2 text-[var(--text-secondary)]">
          {t('accommodations.categories')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategories(new Set(CATEGORY_ORDER))}
            className={`min-h-10 rounded-full border px-3 text-xs font-bold ${
              activeCategories.size === CATEGORY_ORDER.length
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                : isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {t('accommodations.all')}
          </button>
          {CATEGORY_ORDER.map(cat => {
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  if (activeCategories.size === 1 && activeCategories.has(cat)) {
                    setActiveCategories(new Set(CATEGORY_ORDER));
                  } else {
                    setActiveCategories(new Set([cat]));
                  }
                }}
                className={`min-h-10 rounded-full border px-3 text-xs font-bold cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                    : isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {isAr ? ({ budget: 'ميزانية', 'mid-range': 'متوسط', boutique: 'بوتيك', resort: 'منتجع' }[cat] ?? cat) : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price band */}
      <div>
        <div className="text-xs font-bold mb-2 text-[var(--text-secondary)]">
          {t('accommodations.priceBands')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveBands(new Set(BAND_ORDER))}
            className={`min-h-10 rounded-full border px-3 text-xs font-bold ${
              activeBands.size === BAND_ORDER.length
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                : isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {t('accommodations.all')}
          </button>
          {BAND_ORDER.map(band => {
            const active = activeBands.has(band);
            return (
              <button
                key={band}
                type="button"
                onClick={() => {
                  if (activeBands.size === 1 && activeBands.has(band)) {
                    setActiveBands(new Set(BAND_ORDER));
                  } else {
                    setActiveBands(new Set([band]));
                  }
                }}
                className={`min-h-10 rounded-full border px-3 text-xs font-bold cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                    : isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {isAr ? ({ budget: 'اقتصادي', moderate: 'متوسط', premium: 'فاخر' }[band] ?? band) : band}
              </button>
            );
          })}
        </div>
      </div>

      {/* Guests stepper */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold flex items-center gap-1 text-[var(--text-secondary)]">
          <Users className="w-3.5 h-3.5" />
          {isAr ? 'الضيوف' : 'Guests'}
        </span>
        <div className={`flex items-center gap-2 px-2 py-1 rounded-full border ${isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)]' : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)]'}`}>
          <button
            type="button"
            onClick={() => setGuests(g => Math.max(0, g - 1))}
            className="w-8 h-8 rounded-md cursor-pointer hover:bg-black/5 text-sm font-bold"
            aria-label="Fewer guests"
          >−</button>
          <span className="text-xs font-black w-6 text-center">
            {guests || (isAr ? 'أي' : 'Any')}
          </span>
          <button
            type="button"
            onClick={() => setGuests(g => Math.min(20, g + 1))}
            className="w-8 h-8 rounded-md cursor-pointer hover:bg-black/5 text-sm font-bold"
            aria-label="More guests"
          >+</button>
        </div>
      </div>

      {/* Max price per night */}
      <div>
        <div className="text-xs font-bold mb-2 text-[var(--text-secondary)] flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5" />
          {isAr ? 'سعر أقصى ليله' : 'Max per night'}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">EGP</span>
            <input
              type="number"
              min="0"
              max="100000"
              value={maxPerNightEGP || ''}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaxPerNightEGP(Number.isFinite(v) && v >= 0 ? v : 0);
              }}
              placeholder={isAr ? 'السعر الأقصى' : 'Max price'}
              className={`w-full min-h-[42px] rounded-xl border text-sm pl-7 pr-3 py-2 ${
                isDark
                  ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent-primary)]'
              } focus:outline-none`}
            />
          </div>
          <button
            type="button"
            onClick={() => setMaxPerNightEGP(0)}
            className={`min-h-[42px] px-3 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
              maxPerNightEGP > 0
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                : isDark ? 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'
            }`}
          >
            {t('accommodations.clear')}
          </button>
        </div>
      </div>

      {/* Area */}
      {areas.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-2 flex items-center gap-1 text-[var(--text-secondary)]">
            <MapPin className="w-3.5 h-3.5" />
            {t('accommodations.areas')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveAreas(new Set())}
              className={`px-3 py-1 min-h-[32px] rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                activeAreas.size === 0
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                  : isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {t('accommodations.all')}
            </button>
            {areas.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(setActiveAreas, a.id)}
                className={`px-3 py-1 min-h-[32px] rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                  activeAreas.has(a.id)
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                    : isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {isAr ? a.nameAr : a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clear */}
      {secondaryFilterCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setActiveCategories(new Set(CATEGORY_ORDER));
            setActiveBands(new Set(BAND_ORDER));
            setGuests(0);
            setMaxPerNightEGP(0);
            setActiveAreas(new Set());
          }}
          className={`w-full text-center text-xs font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1 ${
            isDark ? 'text-[var(--text-secondary)] hover:bg-[var(--surface-container)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)]'
          }`}
        >
          <X className="w-3 h-3" />
          {isAr ? 'مسح الفلاتر' : 'Clear filters'}
        </button>
      )}
    </div>
  );

  // ---- Page shell ----
  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]"
    >
      <ConciergePageHeader
        eyebrow={t('accommodations.eyebrow')}
        title={t('accommodations.pageTitle')}
        subtitle={t('accommodations.subtitle', { count: stats?.total ?? allAccommodations.length })}
        image="/images/hotels/le-meridien.jpg"
        imageAlt={t('accommodations.heroImageAlt')}
        bright
        meta={
          stats ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-semibold text-white/80">
                {stats.averageRating.toFixed(1)}★ · {t('accommodations.avgRating')}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-white/80">
                {stats.totalReviews.toLocaleString()} · {t('accommodations.reviews')}
              </span>
            </>
          ) : undefined
        }
      />

      {/* Search + filter toolbar */}
      <div className="relative z-20 mx-auto -mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="space-y-4 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.16)] sm:p-5">
          {/* Search row */}
          <div className="relative">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-secondary)]/45" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('accommodations.searchPlaceholder')}
              className="min-h-[54px] w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] ps-12 pe-4 text-base text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-secondary)]/55 focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10"
            />
          </div>

          {/* Destination selector */}
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
            <div className="flex rounded-xl bg-[var(--surface-container)] p-1">
              {DESTINATION_IDS.map(destId => {
                const dest = DESTINATIONS[destId];
                const active = destination === destId;
                return (
                  <button
                    key={destId}
                    type="button"
                    onClick={() => setDestination(destId)}
                    aria-pressed={active}
                    className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      active
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isAr ? dest.name.ar : dest.name.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Property type pills (primary filter, always visible) */}
          <div className="relative">
            <div className="flex min-w-max items-center gap-2 overflow-x-auto py-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setTypeFilter(new Set(PROPERTY_TYPE_ORDER))}
                aria-pressed={activePropertyTypes.size === PROPERTY_TYPE_ORDER.length}
                className={`shrink-0 cursor-pointer pb-1.5 text-sm font-medium transition-colors duration-200 border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  activePropertyTypes.size === PROPERTY_TYPE_ORDER.length
                    ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                {t('accommodations.allTypes')}
              </button>
              {PROPERTY_TYPE_ORDER.map(pt => {
                const active = activePropertyTypes.has(pt);
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => {
                      const next = new Set(activePropertyTypes);
                      if (next.has(pt)) {
                        if (next.size === 1) return;
                        next.delete(pt);
                      } else next.add(pt);
                      setTypeFilter(next);
                    }}
                    aria-pressed={active}
                    className={`shrink-0 cursor-pointer pb-1.5 text-sm font-medium transition-colors duration-200 border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      active
                        ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isAr ? (
                      {
                        hotel: 'فندق', hostel: 'نُزل', apartment: 'شقة', studio: 'استوديو',
                        villa: 'فيلا', guesthouse: 'بيت ضيافة', camp: 'مخيم',
                        'eco-lodge': 'نُزل بيئي', 'boutique-hotel': 'فندق بوتيك',
                        resort: 'منتجع', chalet: 'شاليه',
                      }[pt] ?? pt
                    ) : (
                      pt.charAt(0).toUpperCase() + pt.slice(1).replace('-', ' ')
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort + More filters toolbar */}
          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Sort */}
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex min-w-max items-center gap-1 rounded-2xl bg-[var(--surface-container)] p-1">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSort(sort === opt.id ? 'relevance' : opt.id)}
                    aria-pressed={sort === opt.id}
                    className={`min-h-11 rounded-xl px-4 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      sort === opt.id
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isAr ? opt.labelAr : opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* More filters button */}
            <div className="flex items-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowFilterPanel(v => !v)}
                aria-expanded={showFilterPanel}
                aria-label={t('accommodations.moreFilters')}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  showFilterPanel
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
              {secondaryFilterCount > 0 && (
                <span className={`text-[10px] font-black w-5 h-5 min-w-[20px] min-h-[20px] rounded-full flex items-center justify-center ${
                  showFilterPanel ? 'bg-white/25' : 'bg-[var(--accent-primary)] text-white'
                }`}>
                  {secondaryFilterCount}
                </span>
              )}
            </div>
          </div>

          {/* Natural-language search — matches the existing AccommodationsView
              smart-search surface. */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]/70 border-t border-[var(--border-subtle)] pt-3">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('accommodations.smartTip')}</span>
          </div>
        </section>
      </div>

      {/* Results header */}
      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[var(--accent-primary)]">
              {t('accommodations.showing')}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
              {t('accommodations.resultsTitle')}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {sorted.length} {t('accommodations.results')}
              {sorted.length < filtered.length
                ? ` · +${filtered.length - sorted.length} ${t('accommodations.more')}`
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 flex-1">
        {corpus.status === 'loading' && !corpus.data ? (
          <div className="flex items-center justify-center py-36">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
          </div>
        ) : sorted.length === 0 ? (
          <div className={`py-16 text-center rounded-2xl border ${
            isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'
          }`}>
            <p className="text-sm text-[var(--text-secondary)]">
              {isAr
                ? 'لا توجد إقامات تلائم التصفية الحالية — جرّب توسيع النوع أو الفئة السعرية.'
                : 'No accommodations match those filters — try widening a filter.'}
            </p>
          </div>
        ) : (
          <AccommodationList
            accommodations={sorted}
            isDark={isDark}
            onOpen={(slug) => navigateTo('/accommodations', { hotelSlug: slug })}
            featuredId={featuredId}
          />
        )}
      </div>

      {/* Filter panel popover */}
      {showFilterPanel && renderFilterPanel()}

      {/* Backdrop for mobile filter panel */}
      {showFilterPanel && (
        <div
          className="fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm sm:hidden"
          onClick={() => setShowFilterPanel(false)}
          aria-hidden="true"
        />
      )}

      {/* Disclaimer */}
      {disclaimer && corpus.data && (
        <div className={`max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 rounded-2xl border p-5 flex items-start gap-3 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'
        }`}>
          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
            {isAr ? disclaimer.ar : disclaimer.en}
          </p>
        </div>
      )}
    </div>
  );
};

export default AccommodationsPage;
