import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Search, Star, MapPin, Info, Users, List, Map as MapIcon, Sparkles, 
  Loader2, SlidersHorizontal, X, ChevronDown, Building2, Palmtree, 
  Tent, Home, BedDouble, Leaf, Coffee, LayoutGrid, ArrowUpDown,
  Waves, Landmark, Sailboat, PiggyBank, 
  Check, ShieldCheck, Flame, ArrowRight, RotateCcw
} from 'lucide-react';
import { AccommodationCard, PROPERTY_TYPE_LABEL } from './AccommodationCard';
import { AccommodationDetailView } from './AccommodationDetailView';
import { AccommodationsMap } from './AccommodationsMap';
import { useTrip } from '../../context/TripContext';
import { NoResultsState } from '../common/NoResultsState';
import { ErrorState } from '../common/ErrorState';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { ConciergePageHeader } from '../concierge/ConciergePageHeader';
import { useDestination } from '../../context/DestinationContext';
import { EarlyStaysBrowse } from '../places/EarlyCatalogueBrowse';
import { StaySearchBar } from './StaySearchBar';
import type { AccommodationCatalogueResponse, PropertyType } from '../../shared/types/commerce';

type HotelCategory = 'budget' | 'mid-range' | 'boutique' | 'resort';
type HotelPriceBand = 'budget' | 'moderate' | 'premium';
type SortOption = 'recommended' | 'rating' | 'price-asc' | 'price-desc' | 'reviews';

const PROPERTY_TYPE_ORDER: PropertyType[] = [
  'hotel', 'resort', 'boutique-hotel', 'hostel', 'apartment', 'studio', 'villa', 'guesthouse', 'camp', 'eco-lodge'
];
const CATEGORY_ORDER: HotelCategory[] = ['budget', 'mid-range', 'boutique', 'resort'];
const BAND_ORDER: HotelPriceBand[] = ['budget', 'moderate', 'premium'];

const PROPERTY_TYPE_ICONS: Record<PropertyType, React.ComponentType<{ className?: string }>> = {
  hotel: Building2,
  resort: Palmtree,
  'boutique-hotel': Sparkles,
  hostel: Users,
  apartment: Home,
  studio: BedDouble,
  villa: Home,
  guesthouse: Coffee,
  camp: Tent,
  'eco-lodge': Leaf,
  chalet: Home,
};

function chipColor(band: HotelPriceBand): string {
  if (band === 'budget') return '#5f7042';
  if (band === 'moderate') return '#9a5a26';
  return '#5d5036';
}

function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
function readCsvParam<T extends string>(name: string): Set<T> {
  const raw = readParam(name);
  return raw ? new Set(raw.split(',').filter(Boolean) as T[]) : new Set();
}

const LiveAccommodationsView: React.FC = () => {
  const { navigateTo, selectedHotelSlug } = useTrip();
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';

  const [searchText, setSearchText] = useState(() => readParam('q') || '');
  const [searchQuery, setSearchQuery] = useState(() => readParam('q') || '');
  const [activePropertyTypes, setActivePropertyTypes] = useState<Set<PropertyType>>(() => {
    const fromUrl = readCsvParam<PropertyType>('propertyType');
    return fromUrl.size > 0 ? fromUrl : new Set(PROPERTY_TYPE_ORDER);
  });
  const [activeCategories, setActiveCategories] = useState<Set<HotelCategory>>(() => {
    const fromUrl = readCsvParam<HotelCategory>('category');
    return fromUrl.size > 0 ? fromUrl : new Set(CATEGORY_ORDER);
  });
  const [activeBands, setActiveBands] = useState<Set<HotelPriceBand>>(() => {
    const fromUrl = readCsvParam<HotelPriceBand>('priceBand');
    return fromUrl.size > 0 ? fromUrl : new Set(BAND_ORDER);
  });
  const [activeAreas, setActiveAreas] = useState<Set<string>>(() => readCsvParam<string>('areaId'));
  const [guests, setGuests] = useState<number>(() => {
    const raw = readParam('guests');
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  // The stay window. Absent by default: with no dates the page behaves exactly
  // as it did — a browse-by-name-and-price list. With dates it filters by real
  // availability, which needs the window to be part of the request.
  const [stayCheckIn, setStayCheckIn] = useState<string>('');
  const [stayCheckOut, setStayCheckOut] = useState<string>('');
  const [stayRooms, setStayRooms] = useState<number>(1);
  const [stayGuests, setStayGuests] = useState<number>(2);
  const [availabilityByProperty, setAvailabilityByProperty] = useState<Record<string, { available: boolean; minUnitsLeft: number }> | null>(null);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  // Read the window back out of the URL, so a shared or refreshed search keeps
  // its dates. Mirrors how every other filter on this page is restored.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ci = params.get('checkIn');
    const co = params.get('checkOut');
    if (ci && /^\d{4}-\d{2}-\d{2}$/.test(ci) && co && /^\d{4}-\d{2}-\d{2}$/.test(co) && co > ci) {
      setStayCheckIn(ci);
      setStayCheckOut(co);
    }
    const rooms = Number(params.get('rooms'));
    if (Number.isFinite(rooms) && rooms >= 1) setStayRooms(Math.min(9, rooms));
    const party = Number(params.get('party'));
    if (Number.isFinite(party) && party >= 1) setStayGuests(Math.min(20, party));
  }, []);

  // Modern view mode: 'grid' (expansive full-width card layout) vs 'split' (cards + sticky map)
  const [viewMode, setViewMode] = useState<'grid' | 'split'>('split');
  // Mobile map view toggle
  const [showMap, setShowMap] = useState(false);

  // The mobile list/map FAB hides while scrolling down and returns on scroll up
  // so it never sits on top of the filter chips or a card title.
  const [fabVisible, setFabVisible] = useState(true);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // Ignore sub-pixel jitter so the FAB does not flicker at rest.
      if (Math.abs(y - lastY) < 6) return;
      setFabVisible(y < lastY || y < 80);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sorting
  const [sortBy, setSortBy] = useState<SortOption>('recommended');

  // Filters modal/popover
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showFilterPanel) return;
    const onClick = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showFilterPanel]);

  // Natural-language search
  const [nlLoading, setNlLoading] = useState(false);
  const [nlSource, setNlSource] = useState<'gemini' | 'fallback' | null>(null);
  const [nlError, setNlError] = useState<string | null>(null);
  const [appliedNlQuery, setAppliedNlQuery] = useState<string | null>(null);

  // Quick prompt inspirations. Icons are Lucide components rather than typed
  // color emoji: src/ bans color emoji outright, and these used to be typed as
  // glyphs which rendered differently per platform and ignored the theme
  // palette.

  const quickPrompts = useMemo(() => {
    const specs = [
      { id: 'beachfront', Icon: Waves, labelEn: 'Beachfront with pool', labelAr: 'على البحر مع مسبح', query: 'beachfront stay with pool' },
      { id: 'boutique', Icon: Landmark, labelEn: 'Lighthouse boutique', labelAr: 'بوتيك في اللايتهاوس', query: 'boutique hotel in lighthouse' },
      { id: 'camp', Icon: Tent, labelEn: 'Desert camp & eco-lodge', labelAr: 'مخيم ونُزل بيئي', query: 'camp eco-lodge authentic dahab' },
      { id: 'lagoon', Icon: Sailboat, labelEn: 'Lagoon kitesurf villa', labelAr: 'فيلا اللاجونا', query: 'lagoon villa for 4 guests near sea' },
      { id: 'budget', Icon: PiggyBank, labelEn: 'Budget under 2,000 EGP', labelAr: 'اقتصادي أقل من ٢٠٠٠ ج', query: 'budget clean stay under 2000 egp' }
    ];
    return specs.map(s => ({ ...s, label: isAr ? s.labelAr : s.labelEn }));
  }, [isAr]);

  // Keep query params synced
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchQuery.trim()) params.set('q', searchQuery.trim()); else params.delete('q');
    if (activePropertyTypes.size > 0 && activePropertyTypes.size < PROPERTY_TYPE_ORDER.length) {
      params.set('propertyType', [...activePropertyTypes].join(','));
    } else params.delete('propertyType');
    if (activeCategories.size > 0 && activeCategories.size < CATEGORY_ORDER.length) {
      params.set('category', [...activeCategories].join(','));
    } else params.delete('category');
    if (activeBands.size > 0 && activeBands.size < BAND_ORDER.length) {
      params.set('priceBand', [...activeBands].join(','));
    } else params.delete('priceBand');
    if (activeAreas.size > 0) params.set('areaId', [...activeAreas].join(',')); else params.delete('areaId');
    if (guests > 0) params.set('guests', String(guests)); else params.delete('guests');
    if (stayCheckIn) params.set('checkIn', stayCheckIn); else params.delete('checkIn');
    if (stayCheckOut) params.set('checkOut', stayCheckOut); else params.delete('checkOut');
    if (stayRooms > 1) params.set('rooms', String(stayRooms)); else params.delete('rooms');
    if (stayGuests !== 2) params.set('party', String(stayGuests)); else params.delete('party');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [searchQuery, activePropertyTypes, activeCategories, activeBands, activeAreas, guests, stayCheckIn, stayCheckOut, stayRooms, stayGuests]);

  const corpus = useApiResource<AccommodationCatalogueResponse>(
    useCallback((signal) => api.getAccommodations({ view: 'card' }, signal), [])
  );

  const accommodationIds = useMemo(
    () => (corpus.data?.accommodations ?? []).map(a => a.id),
    [corpus.data]
  );

  /**
   * Which properties are actually free for the chosen window.
   *
   * Computed client-side per candidate is impossible — the browser would need
   * every booking in the platform to answer, so availability is asked of the
   * server once per search, keyed by the window and the party. Without dates
   * this never runs and the page stays a plain browse-by-name-and-price list.
   */
  useEffect(() => {
    if (!stayCheckIn || !stayCheckOut || stayCheckOut <= stayCheckIn || accommodationIds.length === 0) {
      setAvailabilityByProperty(null);
      setAvailabilityChecked(false);
      return;
    }
    let cancelled = false;
    setAvailabilityChecked(false);
    (async () => {
      try {
        const data = await api.getStaysAvailability({
          accommodationIds,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          rooms: stayRooms,
          guests: stayGuests,
        });
        if (!cancelled) {
          setAvailabilityByProperty(data);
          setAvailabilityChecked(true);
        }
      } catch {
        if (!cancelled) {
          // Availability is a narrowing filter, not a gate: on failure the page
          // shows everything it had rather than an empty result it cannot explain.
          setAvailabilityByProperty(null);
          setAvailabilityChecked(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [stayCheckIn, stayCheckOut, stayRooms, stayGuests, accommodationIds]);

  const accommodations = corpus.data?.accommodations ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = accommodations.filter(a => {
      if (!activePropertyTypes.has(a.propertyType)) return false;
      if (!activeCategories.has(a.category)) return false;
      if (!activeBands.has(a.priceBand)) return false;
      if (activeAreas.size > 0 && !activeAreas.has(a.areaId)) return false;
      if (guests > 0 && a.maxGuests < guests) return false;
      // With dates chosen, only stays the server says are free for that window
      // survive — the honest answer to "what is available", not "what exists".
      if (availabilityByProperty) {
        const stay = availabilityByProperty[a.id];
        if (!stay || !stay.available) return false;
      }
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.nameAr || '').toLowerCase().includes(q) ||
        (a.areaName || '').toLowerCase().includes(q) ||
        (a.areaNameAr || '').toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.perNightEGP - b.perNightEGP);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.perNightEGP - a.perNightEGP);
    } else if (sortBy === 'reviews') {
      result.sort((a, b) => b.reviewCount - a.reviewCount);
    } else {
      // recommended: balance rating and popularity
      result.sort((a, b) => (b.rating * Math.log10(b.reviewCount + 2)) - (a.rating * Math.log10(a.reviewCount + 2)));
    }

    return result;
  }, [accommodations, activePropertyTypes, activeCategories, activeBands, activeAreas, guests, searchQuery, sortBy, availabilityByProperty]);

  const secondaryFilterCount =
    (activeCategories.size < CATEGORY_ORDER.length ? 1 : 0) +
    (activeBands.size < BAND_ORDER.length ? 1 : 0) +
    (guests > 0 ? 1 : 0) +
    (activeAreas.size > 0 ? 1 : 0);

  // P1-21: rendering every match at once produced a ~586,000px page on 375px
// (1,358 cards, 1,358 <img> nodes). Cards are appended a page at a time so the
// first paint is cheap and the count below reflects what is actually loaded.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Any change to the query, filters or sort resets paging to the first page,
  // otherwise a "load more" from a previous result set silently hides matches.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filtered]);

  const [featuredHotel, restHotels] = useMemo(() => {
    if (filtered.length === 0) return [null, []] as const;
    const top = filtered[0];
    return [top, filtered.slice(1, visibleCount)] as const;
  }, [filtered, visibleCount]);

  const hasMore = filtered.length > visibleCount;

  if (selectedHotelSlug) {
    return (
      <AccommodationDetailView
        accommodationSlug={selectedHotelSlug}
        onBackToList={() => navigateTo('/hotels')}
      />
    );
  }

  const areas = corpus.data?.areas ?? [];

  const onOpenHotel = useCallback((slug: string) => navigateTo('/hotels', { hotelSlug: slug }), [navigateTo]);

  // Stable filter toggle to prevent extra renders
  const toggleProperty = useCallback((t: PropertyType) => setActivePropertyTypes(s => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; }), []);
  const toggleCategory = useCallback((c: HotelCategory) => setActiveCategories(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; }), []);
  const toggleBand = useCallback((b: HotelPriceBand) => setActiveBands(s => { const n = new Set(s); n.has(b) ? n.delete(b) : n.add(b); return n; }), []);

  const handleNlSearch = async (overrideQuery?: string) => {
    const query = (overrideQuery ?? searchText).trim();
    if (!query) return;
    setNlLoading(true);
    setNlError(null);
    try {
      const result = await api.parseAccommodationSearchIntent(query, isAr ? 'ar' : 'en');
      const f = result.filters;
      // Clear substring searchQuery so structured filters apply cleanly
      setSearchQuery('');
      setSearchText(query);
      setActivePropertyTypes(f.propertyTypes?.length ? new Set(f.propertyTypes) : new Set(PROPERTY_TYPE_ORDER));
      setActiveCategories(f.categories?.length ? new Set(f.categories) : new Set(CATEGORY_ORDER));
      setActiveBands(f.priceBands?.length ? new Set(f.priceBands) : new Set(BAND_ORDER));
      setActiveAreas(f.areaIds?.length ? new Set(f.areaIds) : new Set());
      setGuests(f.guests && f.guests > 0 ? f.guests : 0);
      setNlSource(result.source);
      setAppliedNlQuery(query);
    } catch (e: any) {
      setNlError(e?.message || (isAr ? 'تعذّر فهم هذا البحث.' : 'Could not understand that search.'));
    } finally {
      setNlLoading(false);
    }
  };

  const clearNlSearch = () => {
    setSearchText('');
    setSearchQuery('');
    setAppliedNlQuery(null);
    setNlSource(null);
    setNlError(null);
    setActivePropertyTypes(new Set(PROPERTY_TYPE_ORDER));
    setActiveCategories(new Set(CATEGORY_ORDER));
    setActiveBands(new Set(BAND_ORDER));
    setActiveAreas(new Set());
    setGuests(0);
  };

  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    set(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleSelectAllTypes = () => {
    if (activePropertyTypes.size === PROPERTY_TYPE_ORDER.length) {
      setActivePropertyTypes(new Set());
    } else {
      setActivePropertyTypes(new Set(PROPERTY_TYPE_ORDER));
    }
  };

  const stats = corpus.data?.stats;
  const disclaimer = corpus.data?.disclaimer;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
      }`}
    >
      <ConciergePageHeader
        eyebrow={`${t('hotels.title')} · ${t('hotels.ratingSource')}`}
        title={isAr ? 'أماكن الإقامة في دهب' : 'Places to stay in Dahab'}
        // P1-17: the hero count and the toolbar count must come from the same source.
        // They used to read `stats.total` and a hardcoded 1217 respectively, so
        // the page could advertise three different numbers for one result set.
        subtitle={
          corpus.status === 'loading' || corpus.status === 'error'
            ? t('hotels.subtitleLoading', 'أماكن الإقامة في دهب')
            : t('hotels.subtitle', { count: filtered.length })
        }
        image="/images/hotels/swiss-inn-resort.jpg"
        imageAlt="Dahab Stays"
        compact
        meta={
          stats ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-semibold text-white/80">
                {stats.averageRating.toFixed(1)}★ · {t('hotels.statsAvgRating')}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-white/80">
                {stats.totalReviews.toLocaleString()} · {t('hotels.statsReviews')}
              </span>
            </>
          ) : undefined
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        
        {/* ============================================================ */}
        {/* SEARCH — one field. A short query filters by name as you type; */}
        {/* a descriptive one (Enter or the sparkle) runs the smart search. */}
        {/* ============================================================ */}
        {/* ============================================================ */}
      {/* FILTERS + MAP TOGGLE */}
      {/* ============================================================ */}
      {/* Quick filter chips. Each chip drives the real filter state (and
          therefore the URL query) instead of being a dead button. Text comes
          from the i18n catalog so the Arabic UI never shows English. Active
          chips use --on-accent (#0B151C) on --accent-primary for 8.46:1
          contrast rather than white on teal (2.17:1). */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          {
            id: 'beachfront',
            label: t('hotels.chip.beachfront', 'على البحر'),
            active: searchQuery.trim().toLowerCase().includes('beachfront') || searchQuery.trim().includes('على البحر'),
            onClick: () => setSearchQuery('beachfront'),
          },
          {
            id: 'pool',
            label: t('hotels.chip.pool', 'حمام سباحة'),
            active: searchQuery.trim().toLowerCase().includes('pool') || searchQuery.trim().includes('مسبح'),
            onClick: () => setSearchQuery('pool'),
          },
          {
            id: 'freeCancel',
            label: t('hotels.chip.freeCancel', 'إلغاء مجاني'),
            active: searchQuery.trim().toLowerCase().includes('free cancellation') || searchQuery.trim().includes('إلغاء مجاني'),
            onClick: () => setSearchQuery('free cancellation'),
          },
          {
            id: 'under2000',
            label: t('hotels.chip.under2000', 'أقل من 2,000 ج.م'),
            active: activeBands.has('budget'),
            onClick: () => toggleBand('budget'),
          },
          {
            id: 'map',
            label: t('hotels.chip.map', 'الخريطة'),
            active: showMap,
            onClick: () => setShowMap(v => !v),
          },
        ] as const).map(chip => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            aria-pressed={chip.active}
            className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
              chip.active
                ? 'bg-[var(--accent-primary)] text-[var(--dg-on-accent)]'
                : 'bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mb-4 space-y-3">
          <div className="space-y-3 lg:space-y-0 lg:flex lg:items-stretch lg:gap-2">
          <div className="relative lg:flex-1 lg:min-w-0">
            <Search className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none`} aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchText.trim().includes(' ') && searchText.trim().length > 10) {
                    handleNlSearch(searchText);
                  }
                }
              }}
              aria-label={isAr ? 'ابحث عن إقامة' : 'Search stays'}
              placeholder={isAr ? 'اسم الفندق، أو صف ما تريد…' : 'Hotel name, or describe what you want…'}
              className={`w-full min-h-12 ${isAr ? 'pr-11 pl-24' : 'pl-11 pr-24'} rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 shadow-sm transition-[border-color,box-shadow] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/25 [&::-webkit-search-cancel-button]:hidden`}
            />
            <div className={`absolute ${isAr ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 flex items-center gap-1`}>
              {searchText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText('');
                    setSearchQuery('');
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-colors cursor-pointer"
                  aria-label={isAr ? 'مسح البحث' : 'Clear search'}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleNlSearch()}
                disabled={nlLoading || !searchText.trim()}
                title={isAr ? 'بحث ذكي بالذكاء الاصطناعي' : 'Smart AI Search'}
                aria-label={isAr ? 'بحث ذكي بالذكاء الاصطناعي' : 'Smart AI Search'}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] transition-[filter,opacity,transform] hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {nlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Stay window: dates, rooms and guests — with dates the listing
              narrows to real availability. */}
          <StaySearchBar
            checkIn={stayCheckIn}
            checkOut={stayCheckOut}
            rooms={stayRooms}
            guests={stayGuests}
            onDatesChange={(ci: string, co: string) => {
              setStayCheckIn(ci);
              setStayCheckOut(co);
            }}
            onRoomsChange={setStayRooms}
            onGuestsChange={setStayGuests}
            onClear={() => {
              setStayCheckIn('');
              setStayCheckOut('');
            }}
          />
          </div>

          {availabilityChecked && stayCheckIn && (
            <p className="text-xs font-bold text-[var(--accent-primary)]">
              {t('hotels.stayResultsForWindow', {
                count: filtered.length,
                dates: `${stayCheckIn} → ${stayCheckOut}`,
              })}
            </p>
          )}

          {/* Suggested searches: only while the field is empty, so they guide
              a first search instead of crowding a typed one. */}
          {!searchText && !appliedNlQuery && (
            <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
              {quickPrompts.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSearchText(p.query);
                    handleNlSearch(p.query);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <p.Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {appliedNlQuery && !nlError && (
            <div role="status" className="px-3 py-2 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-[var(--accent-primary)] font-bold min-w-0">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {isAr
                    ? `تم تطبيق البحث الذكي: "${appliedNlQuery}" (${filtered.length} نتيجة)`
                    : `AI filters active for "${appliedNlQuery}" (${filtered.length} matches)`}
                </span>
              </span>
              <button
                type="button"
                onClick={clearNlSearch}
                className="inline-flex items-center gap-1 px-2.5 min-h-[32px] rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isAr ? 'إعادة ضبط' : 'Reset'}</span>
              </button>
            </div>
          )}

          {nlError && (
            <div role="alert" className="text-xs text-rose-400 font-medium">
              {nlError}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* ONE STICKY ROW: type chips, then count · sort · filters · view */}
        {/* ============================================================ */}
        <div className="sticky top-[calc(var(--dg-safe-top,0px)+3.75rem)] z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-[var(--bg-canvas)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] shadow-[0_4px_30px_-12px_rgba(0,0,0,0.15)]">
          <div className="lg:flex lg:items-center lg:gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar lg:flex-1 lg:min-w-0">
            <button
              type="button"
              onClick={handleSelectAllTypes}
              aria-pressed={activePropertyTypes.size === PROPERTY_TYPE_ORDER.length}
              className={`px-3.5 min-h-[40px] rounded-full text-xs font-bold transition-all duration-200 border shadow-[0_1px_3px_rgba(0,0,0,0.08)] cursor-pointer shrink-0 ${
                activePropertyTypes.size === PROPERTY_TYPE_ORDER.length
                  ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-[var(--text-primary)] shadow-md'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            {PROPERTY_TYPE_ORDER.map(pt => {
              const active = activePropertyTypes.has(pt) && activePropertyTypes.size !== PROPERTY_TYPE_ORDER.length;
              const label = PROPERTY_TYPE_LABEL[pt];
              const IconComponent = PROPERTY_TYPE_ICONS[pt] || Building2;
              return (
                <button
                  key={pt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(setActivePropertyTypes, pt)}
                  className={`px-3 min-h-[40px] rounded-full text-xs font-bold transition-all duration-200 border shadow-[0_1px_3px_rgba(0,0,0,0.08)] cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    active
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-[var(--text-primary)] shadow-md'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{isAr ? label.ar : label.en}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 lg:mt-0 flex items-center justify-between gap-2 lg:shrink-0 lg:gap-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">
              {filtered.length.toLocaleString()}{' '}
              <span className="font-medium text-[var(--text-secondary)]">{isAr ? 'إقامة' : 'stays'}</span>
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className={`appearance-none min-h-[40px] ${isAr ? 'pl-8 pr-3' : 'pl-3 pr-8'} rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-xs font-bold text-[var(--text-primary)] cursor-pointer focus:outline-none focus:border-[var(--accent-primary)]`}
                  aria-label={isAr ? 'ترتيب الإقامات' : 'Sort stays'}
                >
                  <option value="recommended">{isAr ? 'المقترح لك' : 'Recommended'}</option>
                  <option value="rating">{isAr ? 'الأعلى تقييماً' : 'Highest rated'}</option>
                  <option value="price-asc">{isAr ? 'السعر: من الأقل للأعلى' : 'Price: low to high'}</option>
                  <option value="price-desc">{isAr ? 'السعر: من الأعلى للأقل' : 'Price: high to low'}</option>
                  <option value="reviews">{isAr ? 'الأكثر مراجعات' : 'Most reviewed'}</option>
                </select>
                <ArrowUpDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] pointer-events-none absolute ${isAr ? 'left-2.5' : 'right-2.5'}`} aria-hidden="true" />
              </div>

              <div className="relative" ref={filterPanelRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(v => !v)}
                  aria-expanded={showFilterPanel}
                  className={`px-3 min-h-[40px] rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    showFilterPanel || secondaryFilterCount > 0
                      ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                  <span>{isAr ? 'فلاتر' : 'Filters'}</span>
                  {secondaryFilterCount > 0 && (
                    <span className="text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent-primary)] text-[var(--surface-container)] flex items-center justify-center">
                      {secondaryFilterCount}
                    </span>
                  )}
                </button>

                {/* Filter Popover */}
                {showFilterPanel && (
                  <div
                    dir={isAr ? 'rtl' : 'ltr'}
                    className={`absolute z-40 mt-2 w-[min(90vw,380px)] ${isAr ? 'left-0' : 'right-0'} rounded-3xl border shadow-2xl p-5 space-y-4 backdrop-blur-md ${
                      isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-white border-[var(--border-subtle)]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold mb-2.5 text-[var(--text-secondary)]">
                        {t('hotels.categories')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORY_ORDER.map(cat => {
                          const active = activeCategories.has(cat);
                          const label = isAr
                            ? { budget: 'ميزانية', 'mid-range': 'متوسط', boutique: 'بوتيك', resort: 'منتجع' }[cat]
                            : cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => toggle(setActiveCategories, cat)}
                              className={`px-3 py-1.5 min-h-[36px] rounded-full text-xs font-bold border cursor-pointer transition-all ${
                                active
                                  ? 'bg-[var(--accent-primary)] text-[var(--surface-container)] border-[var(--accent-primary)] shadow-md'
                                  : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:-translate-y-0.5 shadow-sm'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold mb-2.5 text-[var(--text-secondary)]">
                        {t('hotels.priceBands')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {BAND_ORDER.map(band => {
                          const active = activeBands.has(band);
                          const label = isAr
                            ? { budget: 'اقتصادي', moderate: 'متوسط', premium: 'فاخر' }[band]
                            : band;
                          return (
                            <button
                              key={band}
                              type="button"
                              onClick={() => toggle(setActiveBands, band)}
                              className={`px-3 py-1.5 min-h-[36px] rounded-full text-xs font-bold border cursor-pointer transition-all ${
                                active ? 'text-white shadow-md' : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:-translate-y-0.5 shadow-sm'
                              }`}
                              style={active ? { backgroundColor: chipColor(band), borderColor: chipColor(band) } : undefined}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <Users className="w-3.5 h-3.5" />
                        {isAr ? 'عدد الضيوف' : 'Guests'}
                      </span>
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-container)]">
                        <button
                          type="button"
                          onClick={() => setGuests(g => Math.max(0, g - 1))}
                          className="w-7 h-7 rounded-full cursor-pointer hover:bg-black/10 flex items-center justify-center font-bold"
                          aria-label="Fewer guests"
                        >−</button>
                        <span className="text-xs font-black w-6 text-center">{guests || (isAr ? 'أي' : 'Any')}</span>
                        <button
                          type="button"
                          onClick={() => setGuests(g => Math.min(20, g + 1))}
                          className="w-7 h-7 rounded-full cursor-pointer hover:bg-black/10 flex items-center justify-center font-bold"
                          aria-label="More guests"
                        >+</button>
                      </div>
                    </div>

                    {areas.length > 0 && (
                      <div>
                        <div className="text-xs font-bold mb-2.5 flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <MapPin className="w-3.5 h-3.5" />
                          {t('hotels.areas')}
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          <button
                            type="button"
                            onClick={() => setActiveAreas(new Set())}
                            className={`px-3 py-1 min-h-[32px] rounded-full text-xs font-bold border cursor-pointer transition-all ${
                              activeAreas.size === 0
                                ? 'bg-[var(--accent-primary)] text-[var(--surface-container)] border-[var(--accent-primary)]'
                                : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {t('hotels.all')}
                          </button>
                          {areas.map(a => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => toggle(setActiveAreas, a.id)}
                              className={`px-3 py-1 min-h-[32px] rounded-full text-xs font-bold border cursor-pointer transition-all ${
                                activeAreas.has(a.id)
                                  ? 'bg-[var(--accent-primary)] text-[var(--surface-container)] border-[var(--accent-primary)]'
                                  : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {isAr ? a.nameAr : a.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {secondaryFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategories(new Set(CATEGORY_ORDER));
                          setActiveBands(new Set(BAND_ORDER));
                          setGuests(0);
                          setActiveAreas(new Set());
                        }}
                        className="w-full text-center text-xs font-bold py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-container)] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        {isAr ? 'مسح الفلاتر' : 'Clear filters'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop: grid vs list + map */}
              <div className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  className={`px-3 min-h-[32px] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-[var(--surface-container)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isAr ? 'شبكة' : 'Grid'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  aria-pressed={viewMode === 'split'}
                  className={`px-3 min-h-[32px] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'split' ? 'bg-[var(--surface-container)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isAr ? 'خريطة' : 'Map'}</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* LISTINGS & MAP VIEW CONTAINER                                */}
        {/* ============================================================ */}
        <section className="mb-12">
          {corpus.status === 'loading' && accommodations.length === 0 ? (
            <div className="space-y-6">
              <div className="h-64 rounded-3xl bg-[var(--surface-card)] animate-pulse border border-[var(--border-subtle)]" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="h-96 rounded-3xl bg-[var(--surface-card)] animate-pulse border border-[var(--border-subtle)]" />
                ))}
              </div>
            </div>
          ) : corpus.status === 'error' && accommodations.length === 0 ? (
            // A failed or timed-out catalogue is not "no stays match": saying
            // so sends the traveller off resetting filters that were never set.
            <ErrorState
              nounKey="common.noResults.nounHotels"
              onRetry={() => corpus.reload()}
            />
          ) : filtered.length === 0 ? (
            <NoResultsState
              cause={searchQuery.trim() ? 'search' : 'filter'}
              query={searchQuery.trim()}
              nounKey="common.noResults.nounHotels"
              onClear={() => {
                setActivePropertyTypes(new Set(PROPERTY_TYPE_ORDER));
                setActiveCategories(new Set(CATEGORY_ORDER));
                setActiveBands(new Set(BAND_ORDER));
                setActiveAreas(new Set());
                setSearchQuery('');
                setSearchText('');
                setAppliedNlQuery(null);
              }}
            />
          ) : viewMode === 'grid' ? (
            /* FULL-WIDTH EXPANSIVE GRID VIEW */
            <div className="space-y-6">
              {featuredHotel && (
                <AccommodationCard
                  key={featuredHotel.id}
                  accommodation={featuredHotel}
                  isDark={isDark}
                  featured
                  onOpen={onOpenHotel}
                />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}>
                {restHotels.map(a => (
                  <AccommodationCard key={a.id} accommodation={a} isDark={isDark} onOpen={onOpenHotel} />
                ))}
              </div>
            </div>
          ) : (
            /* SPLIT VIEW (CARDS + STICKY MAP) */
            <div className="lg:grid lg:grid-cols-[1fr_440px] lg:gap-6 lg:items-start">
              {/* Cards column */}
              <div className={showMap ? 'hidden lg:block' : 'block'}>
                <div className="space-y-5" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' }}>
                  {featuredHotel && (
                    <AccommodationCard
                      key={featuredHotel.id}
                      accommodation={featuredHotel}
                      isDark={isDark}
                      featured
                      onOpen={onOpenHotel}
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {restHotels.map(a => (
                      <AccommodationCard key={a.id} accommodation={a} isDark={isDark} onOpen={onOpenHotel} />
                    ))}
                  </div>
                </div>
                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                      className="h-11 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)]"
                    >
                      {t('hotels.loadMore', 'اعرض أكتر')}
                    </button>
                  </div>
                )}
              </div>

              {/* Sticky Map column with CartoDB Voyager tiles */}
              <div className={`${showMap ? 'block' : 'hidden'} lg:block h-[420px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24 rounded-3xl border border-[var(--border-subtle)] overflow-hidden shadow-lg`}>
                <AccommodationsMap
                  accommodations={filtered.filter(a => a.latitude !== undefined && a.longitude !== undefined)}
                  isDark={isDark}
                  isAr={isAr}
                  onSelect={(slug) => navigateTo('/hotels', { hotelSlug: slug })}
                />
              </div>
            </div>
          )}
        </section>

        {/* ============================================================ */}
        {/* EXPLORE AREAS IN DAHAB                                       */}
        {/* ============================================================ */}
        {areas.length > 0 && (
          <section className="mb-12">
            <h2 className="chart-heading font-bold text-lg mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[var(--accent-primary)]" />
              {t('hotels.exploreAreas')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {areas.map(a => (
                <div key={a.id} className="rounded-3xl border border-[var(--border-subtle)] p-5 bg-[var(--surface-card)] hover:border-[var(--accent-primary)]/40 hover:shadow-md transition-all">
                  <h3 className="font-bold text-sm mb-1.5 flex items-center gap-2 text-[var(--text-primary)]">
                    <Star className="w-4 h-4 text-amber-400 fill-current" />
                    {isAr ? a.nameAr : a.name}
                  </h3>
                  <p className="text-xs leading-relaxed line-clamp-3 text-[var(--text-secondary)]/80">
                    {isAr ? a.descriptionAr : a.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* EDITORIAL DISCLAIMER                                         */}
        {/* ============================================================ */}
        {disclaimer && (
          <div className="mb-12 rounded-3xl border border-[var(--border-subtle)] p-5 flex items-start gap-3 bg-[var(--surface-card)]">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-[var(--text-secondary)]" />
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]/70">
              {isAr ? disclaimer.ar : disclaimer.en}
            </p>
          </div>
        )}
      </div>

      {/* Floating list/map toggle — mobile only */}
      <button
        type="button"
        onClick={() => {
          // The mobile map lives in the split layout; grid mode has no map.
          setViewMode('split');
          setShowMap(v => !v);
        }}
        className={`lg:hidden fixed z-30 flex items-center gap-1.5 px-5 py-3 rounded-full text-xs font-bold shadow-2xl transition-all cursor-pointer active:scale-95 bg-[var(--accent-primary)] text-[var(--dg-on-accent)] ${
          isAr ? 'left-4' : 'right-4'
        }`}
        style={{
          // Sit clear of the bottom nav (64px) plus its safe-area inset, so the
          // FAB can never cover a filter chip or a card title on 375px.
          bottom: 'calc(64px + 16px + env(safe-area-inset-bottom))',
          opacity: fabVisible ? 1 : 0,
          pointerEvents: fabVisible ? 'auto' : 'none',
          transform: fabVisible ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        {showMap ? <List className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
        <span>{showMap ? (isAr ? 'القائمة' : 'List') : (isAr ? 'الخريطة' : 'Map')}</span>
      </button>
    </div>
  );
};

export const AccommodationsView: React.FC = () => {
  const { destination } = useDestination();
  if (destination.catalogue === 'early') return <EarlyStaysBrowse />;
  return <LiveAccommodationsView />;
};

export default AccommodationsView;
