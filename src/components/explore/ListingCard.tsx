import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap, Star, MapPin, Calendar, ShoppingBag,
  Heart, Clock, Utensils, Waves, Sparkles,
  Search, Grid3X3, Map as MapIcon, List
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { ReliabilityBadge } from '../common/ReliabilityBadge';
import { ReefBadge } from '../common/ReefBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListingType = 'event' | 'basic-services' | 'health-wellness' | 'activities' | 'food-drink' | 'real-estate';
export type ListingLevel = 'featured' | 'normal';
export type SortingMode = 'default' | 'random' | 'rating' | 'popular';
export type ListingCardProps = {
  item: ListingItem;
  isFeatured?: boolean;
  isFav?: boolean;
  onToggleFav?: (id: string) => void;
  onViewDetails?: (item: ListingItem) => void;
  horizontal?: boolean;
};

export interface ListingItem {
  id: string;
  slug: string;
  type: ListingType;
  level: ListingLevel;
  thumbnail: string;
  marker?: string;
  cover?: string;
  titleEn: string;
  titleAr: string;
  categoryLabelEn?: string;
  categoryLabelAr?: string;
  rating?: number;
  reviewCount?: number;
  dates?: string;
  location?: { address: string; lat: string; lng: string };
  price?: string;
  tags?: string[];
  /** Supplier id when this listing represents a business — drives trust badges. */
  supplierId?: string;
}

// ---------------------------------------------------------------------------
// DEMO_LISTINGS (fallback when corpus is empty / unreachable)
// ---------------------------------------------------------------------------

const DEMO_LISTINGS: ListingItem[] = [
  {
    id: 'listing-id-60618',
    slug: '6-day-hiking-expedition-across-the-deserts-and-mountains-of-saint-catherine',
    type: 'event',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2026/09/IMG_0450-1-2-768x576.jpg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2026/09/HUNAK-logo-COLOR-vector-_page-0001-2-150x150.jpg',
    cover: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2026/09/IMG_0450-1-2-768x576.jpg',
    titleEn: '6-Day Hiking Expedition Across the Deserts and Mountains of Saint Catherine',
    titleAr: 'رحلة مشي ٦ أيام في صحراء وجبال سانت كاترين',
    categoryLabelEn: 'Trip',
    categoryLabelAr: 'رحلة',
    dates: '23/10/2026 00:00 - 30/10/2026 15:00',
    price: 'From 2,800 EGP',
  },
  {
    id: 'listing-id-5444',
    slug: 'piercing-by-shahenda',
    type: 'basic-services',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2025/01/FB_IMG_1737456758807.jpg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2024/12/IMG_8385-150x150.png',
    titleEn: 'Piercing by Shahenda',
    titleAr: 'بيرسينج عند شندة',
    categoryLabelEn: 'Beauty/Cosmetic',
    categoryLabelAr: 'جمال وتجميل',
    rating: 5,
    reviewCount: 12,
    location: { address: 'Al Salam Road, 46, Dahab, South Sinai, Egypt', lat: '28.50054', lng: '34.51563' },
  },
  {
    id: 'listing-id-60622',
    slug: 'transpersonal-psychology-and-archetypal-healing',
    type: 'health-wellness',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/2026/09/WhatsApp-Image-2026-06-26-at-17.09.38-1-150x150.jpeg',
    marker: 'https://dailydahab.com/wp-content/uploads/2026/09/WhatsApp-Image-2026-06-26-at-17.09.38-1-150x150.jpeg',
    titleEn: 'Transpersonal Psychology and Archetypal Healing',
    titleAr: 'علم النفس التجريبي والشفاء بالنماذج الأصلية',
    location: { address: 'Dahab, South Sinai', lat: '28.50000', lng: '34.51500' },
  },
  {
    id: 'listing-id-8017',
    slug: 'freedive-dahab-freediving-center',
    type: 'activities',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2025/11/312023699_5484000158365275_6974599266340209554_n-768x959.jpg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2024/09/FDD-LEMON-MILK-2-2024-2-150x150.png',
    titleEn: 'FREEDIVE DAHAB Freediving Center',
    titleAr: 'فريدايفينج دهب مركز الغطس الحر',
    categoryLabelEn: 'Freediving',
    categoryLabelAr: 'فريدايفينج وغطس حر',
    location: { address: 'شارع الفنار، ٤٦، دهب، جنوب سيناء، مصر', lat: '28.49990', lng: '34.51926' },
  },
  {
    id: 'listing-id-16716',
    slug: 'sansuna-touch-of-dahab-professional-massage-therapist',
    type: 'health-wellness',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2026/07/IMG-20260715-WA0004-768x414.jpg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2024/04/DD-1-copy-7-150x150.png',
    titleEn: 'Sansuna Touch Of Dahab - Professional Massage Therapist',
    titleAr: 'سانسونا توش دهب - معالجة مساج محترفة',
    categoryLabelEn: 'Massage & Wellness',
    categoryLabelAr: 'تدليك وصحة',
    rating: 5,
    reviewCount: 28,
  },
  {
    id: 'listing-id-13322',
    slug: 'nour-wellbeing-center',
    type: 'health-wellness',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2025/11/studio-1.jpg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2025/02/306527918_456792816473279_7100353135792795133_n-150x150.jpg',
    titleEn: 'Nour Wellbeing Center',
    titleAr: 'مركز نورة للرفاهية',
    location: { address: 'Coral Coast Hotel, El Melal St, Dahab, South Sinai 46, Egypt', lat: '28.50342', lng: '34.51988' },
  },
  {
    id: 'listing-id-22581',
    slug: 'traditional-thai-massage-bio-touch-somatic-sessions',
    type: 'health-wellness',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2025/10/IMG-20251021-WA0085-1-768x995.jpg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2026/01/IMG_20260101_174652-150x150.jpg',
    titleEn: 'Traditional Thai Massage | Bio-Touch Somatic Sessions',
    titleAr: 'تدليك تايلندي تقليدي | جلسات بيو تاتش السوماتيكية',
    rating: 5,
    reviewCount: 22,
  },
  {
    id: 'listing-id-60436',
    slug: 'octopus-5-days-deep-water-dance-retreat',
    type: 'event',
    level: 'featured',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2026/08/703726968_122179979156912772_1532684158862289761_n-768x432.jpg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2024/04/DD-1-copy-7-150x150.png',
    titleEn: 'OCTOPUS - 5 Days (Deep) Water Dance Retreat',
    titleAr: 'أوكتوبوس - رحلة ٥ أيام رقص على الماء العميق',
    categoryLabelEn: 'Retreat',
    categoryLabelAr: 'رحلة روحانية',
    dates: '23/09/2026 10:00 - 27/09/2026 20:00',
    price: 'From 3,500 EGP',
  },
  {
    id: 'listing-id-60549',
    slug: 'the-open-house-learning-growing-gathering',
    type: 'basic-services',
    level: 'normal',
    thumbnail: 'https://dailydahab.com/wp-content/uploads/listing-uploads/cover/2026/08/IMG_1450-768x1024.jpeg',
    marker: 'https://dailydahab.com/wp-content/uploads/listing-uploads/logo/2026/08/a9349917-1cee-4912-81b4-f685619c7170-150x150.jpeg',
    titleEn: 'The Open House - Learning, growing, gathering',
    titleAr: 'البيت المفتوح - تعلم، تنمو، تجتمع',
    categoryLabelEn: 'Kids',
    categoryLabelAr: 'أطفال',
  },
];

// ---------------------------------------------------------------------------
// ListingCard (single card)
// ---------------------------------------------------------------------------

const ListingCard: React.FC<ListingCardProps> = ({
  item,
  isFeatured,
  isFav = false,
  onToggleFav,
  onViewDetails,
  horizontal = false,
}) => {
  const { language , t} = useLanguage();
  const { isDark } = useTheme();

  const title = language === 'ar' ? item.titleAr : item.titleEn;
  const categoryLabel = language === 'ar' ? item.categoryLabelAr : item.categoryLabelEn;
  const rtl = language === 'ar';

  // Category coding in three ink families (live teal excluded): water/action
  // on accent-primary, warmth/commerce on accent-secondary, land/calm on brass.
  const typeColor: Record<ListingType, string> = {
    event: 'var(--accent-primary)',
    'basic-services': 'var(--accent-secondary)',
    'health-wellness': 'var(--accent-secondary)',
    activities: 'var(--accent-primary)',
    'food-drink': 'var(--accent-secondary)',
    'real-estate': 'var(--accent-secondary)',
  };
  // Lighter ink variants for small colored text on dark surfaces (AA contrast).
  const typeTextColor: Record<ListingType, string> = {
    event: 'var(--accent-primary)',
    'basic-services': 'var(--accent-secondary)',
    'health-wellness': isDark ? '#E3C57C' : '#8F5F14',
    activities: 'var(--accent-primary)',
    'food-drink': isDark ? '#E3C57C' : '#8F5F14',
    'real-estate': 'var(--accent-secondary)',
  };

  if (horizontal) {
    return (
      <a
        href={`/${item.slug}`}
        onClick={(e) => { e.preventDefault(); onViewDetails?.(item); }}
        dir={rtl ? 'rtl' : 'ltr'}
        className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
          isDark
            ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 text-[var(--text-primary)]'
            : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)]'
        }`}
      >
        <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-[var(--surface-container)]">
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--surface-container)] to-[var(--surface-card)] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[var(--text-secondary)]/40" />
            </div>
          )}
          {isFeatured && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent-primary)]/90 flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-[var(--surface-container)]" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="chart-heading font-bold text-base truncate">{title}</h3>
            {item.rating && (
              <div className="flex items-center gap-1 text-xs font-bold flex-shrink-0">
                <Star className="w-3.5 h-3.5 fill-[var(--accent-secondary)] text-[var(--accent-secondary)]" />
                <span>{item.rating}</span>
                {item.reviewCount != null && item.reviewCount > 0 && <span className="text-[var(--text-secondary)]/60">({item.reviewCount})</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs mt-1.5">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: `${typeColor[item.type]}18`, color: typeTextColor[item.type] }}>
              {categoryLabel || item.type}
            </span>
            {item.dates && (
              <span className="flex items-center gap-1 text-[var(--text-secondary)]/70">
                <Calendar className="w-3 h-3" />
                <span className="truncate">{item.dates}</span>
              </span>
            )}
          </div>

          {item.location && (
            <div className="flex items-center gap-1.5 text-xs mt-1 text-[var(--text-secondary)]/60">
              <MapPin className="w-3 h-3 text-[var(--accent-secondary)]" />
              <span className="truncate">{item.location.address}</span>
            </div>
          )}

          {item.price && (
            <div className="text-xs font-bold mt-1 text-[var(--accent-primary)]">{item.price}</div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav?.(item.id); }}
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
            isFav ? 'bg-rose-500 text-white' : 'bg-black/40 text-white hover:bg-black/70'
          }`}
          aria-label={t(isFav ? 'a11y.removeFavorite' : 'a11y.saveFavorite', { title })}
          aria-pressed={isFav}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>
      </a>
    );
  }

  // Grid card
  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      className={`group relative rounded-xl border overflow-hidden transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
        isDark
          ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
          : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
      }`}
    >
      <a
        href={`/${item.slug}`}
        onClick={(e) => { e.preventDefault(); onViewDetails?.(item); }}
        className="block"
      >
        {/* Cover image */}
        <div className="relative h-44 w-full overflow-hidden bg-[var(--surface-container)]">
          {(item.cover || item.thumbnail) ? (
            <img
              src={item.cover || item.thumbnail}
              alt={title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Featured badge */}
          {isFeatured && (
            <span className="absolute top-2.5 end-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/90 text-[var(--surface-container)] text-[10px] font-bold">
              <Zap className="w-3 h-3" />
              Featured
            </span>
          )}

          {/* Type color corner */}
          <div
            className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1"
            style={{ backgroundColor: `color-mix(in srgb, ${typeColor[item.type]} 70%, #000)` }}
          >
            {item.type === 'event' && <Calendar className="w-3 h-3" />}
            {item.type === 'basic-services' && <ShoppingBag className="w-3 h-3" />}
            {item.type === 'health-wellness' && <Sparkles className="w-3 h-3" />}
            {item.type === 'activities' && <Waves className="w-3 h-3" />}
            {item.type === 'food-drink' && <Utensils className="w-3 h-3" />}
            {item.type === 'real-estate' && <MapPin className="w-3 h-3" />}
            <span className="capitalize">{item.type === 'basic-services' ? 'Services' : item.type === 'health-wellness' ? 'Wellness' : item.type === 'food-drink' ? 'Food' : item.type === 'real-estate' ? 'Property' : item.type}</span>
          </div>

          {/* Fav button */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav?.(item.id); }}
            className={`absolute bottom-2.5 end-2.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
              isFav ? 'bg-rose-500 text-white' : 'bg-black/50 text-white hover:bg-black/80'
            }`}
            aria-label={t(isFav ? 'a11y.removeFavorite' : 'a11y.saveFavorite', { title })}
            aria-pressed={isFav}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="chart-heading font-bold text-sm leading-snug line-clamp-2">{title}</h3>
            {item.rating && (
              <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent-secondary)] flex-shrink-0 mt-0.5">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{item.rating}</span>
                {item.reviewCount != null && item.reviewCount > 0 && <span className="text-[var(--text-secondary)]/60">({item.reviewCount})</span>}
              </div>
            )}
          </div>

          {categoryLabel && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-bold"
              style={{ color: typeTextColor[item.type], backgroundColor: `${typeColor[item.type]}15` }}>
              {categoryLabel}
            </span>
          )}

          {/* Trust badges — only for supplier-backed listings, only when real data exists */}
          {item.supplierId && (
            <div className="flex items-center gap-1.5 mt-2">
              <ReliabilityBadge supplierId={item.supplierId} />
              <ReefBadge supplierId={item.supplierId} />
            </div>
          )}

          {item.dates && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--text-secondary)]/80">
              <Clock className="w-3.5 h-3.5" />
              <span className="line-clamp-1">{item.dates}</span>
            </div>
          )}

          {item.location && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-[var(--text-secondary)]/60">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1">{item.location.address}</span>
            </div>
          )}

          {item.price && (
            <div className="mt-2 text-xs font-bold text-[var(--accent-primary)]">{item.price}</div>
          )}

          {/* Action row */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-secondary)]/50">
              {t('attractions.viewDetails')}
            </span>
            <span className="text-[10px] font-bold text-[var(--accent-primary)] group-hover:underline">
              →
            </span>
          </div>
        </div>
      </a>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ListingsView (the grid / list with filters, sort, search, pagination)
// ---------------------------------------------------------------------------

const TYPES: { id: ListingType; label: string; labelAr: string }[] = [
  { id: 'event', label: 'Events', labelAr: 'أحداث' },
  { id: 'basic-services', label: 'Services', labelAr: 'خدمات' },
  { id: 'health-wellness', label: 'Wellness', labelAr: 'صحة ورفاهية' },
  { id: 'activities', label: 'Activities', labelAr: 'أنشطة' },
  { id: 'food-drink', label: 'Food & Drink', labelAr: 'أكل ومشروبات' },
  { id: 'real-estate', label: 'Accommodation', labelAr: 'إقامة' },
];

const PAGE_SIZE = 12;

/**
 * The three corpus sources, fetched in parallel. Defined at module level
 * because useApiResource treats the fetcher as a dependency — an inline arrow
 * would re-request on every render. Failures degrade per-source to empty
 * arrays so one dead endpoint does not blank the page.
 */
const fetchListingsCorpus = (signal: AbortSignal) =>
  Promise.all([
    api.getDahabActivities(signal).catch(() => ({ activities: [] as unknown[] })),
    api.getCommerceSuppliers(signal).catch(() => ({ suppliers: [] as unknown[] })),
    api.getDahabPlaces(signal).catch(() => ({ places: [] as unknown[] }))
  ]).then(([activitiesRes, suppliersRes, placesRes]) => ({
    activities: activitiesRes.activities as Record<string, any>[],
    suppliers: suppliersRes.suppliers as Record<string, any>[],
    places: placesRes.places as Record<string, any>[]
  }));

export const ListingsView: React.FC = () => {
  const { navigateTo } = useTrip();
  const { language , t} = useLanguage();
  const { isDark } = useTheme();

  // ---- URL-sync state ----
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  });

  const activeTypes = useMemo<Set<ListingType>>(() => {
    const raw = searchParams.get('type');
    if (!raw || raw === 'show-all') return new Set(TYPES.map(t => t.id));
    return new Set(raw.split(',').filter(Boolean) as ListingType[]);
  }, [searchParams]);

  const sortingMode: SortingMode = useMemo(() => {
    const raw = searchParams.get('sort');
    if (raw === 'random' || raw === 'rating' || raw === 'popular') return raw as SortingMode;
    return 'default';
  }, [searchParams]);

  const viewMode = useMemo<'grid' | 'list' | 'map'>(() => {
    const raw = searchParams.get('view');
    if (raw === 'list' || raw === 'map') return raw as 'list' | 'map';
    return 'grid';
  }, [searchParams]);

  const searchQuery = useMemo(() => searchParams.get('q') || '', [searchParams]);
  const pageSize = useMemo(() => {
    const raw = searchParams.get('per');
    const n = parseInt(raw || '', 10);
    return (n >= 6 && n <= 48) ? n : PAGE_SIZE;
  }, [searchParams]);

  // ---- Fetch ----
  const corpus = useApiResource(fetchListingsCorpus, { cacheKey: 'corpus.listings', ttlMs: 60_000 });

  const allListings = useMemo<ListingItem[]>(() => {
    if (!corpus.data) return DEMO_LISTINGS;
    if (corpus.data.activities.length === 0 && corpus.data.suppliers.length === 0 && corpus.data.places.length === 0) {
      return DEMO_LISTINGS;
    }
    const base = buildListingsFromCorpus(corpus.data.activities, corpus.data.suppliers, corpus.data.places, language === 'ar');
    return base.length > 0 ? base : DEMO_LISTINGS;
  }, [corpus.data, language]);

  // ---- Filter ----
  const filteredListings = useMemo<ListingItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    return allListings.filter(item => {
      const matchesType = activeTypes.has(item.type);
      const matchesSearch = !q ||
        item.titleEn.toLowerCase().includes(q) ||
        item.titleAr.toLowerCase().includes(q) ||
        (item.categoryLabelEn && item.categoryLabelEn.toLowerCase().includes(q)) ||
        (item.categoryLabelAr && item.categoryLabelAr.toLowerCase().includes(q)) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(q)));
      return matchesType && matchesSearch;
    });
  }, [allListings, activeTypes, searchQuery]);

  // ---- Sort ----
  // Not capped here: the pagination layer below owns how many are shown, so
  // "Load more" actually adds rows instead of re-slicing the same first page.
  const sorted = useMemo<ListingItem[]>(() => {
    const list = [...filteredListings];

    if (sortingMode === 'rating') {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortingMode === 'popular') {
      list.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    } else if (sortingMode === 'random') {
      // Fisher-Yates shuffle
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }

    return list;
  }, [filteredListings, sortingMode]);

  // ---- Pagination ----
  const [loadedCount, setLoadedCount] = useState<number>(pageSize);

  // A new filter/sort/search starts the pager back at its first page, so
  // Load-more counts never outlive the result set they were measured against.
  useEffect(() => {
    setLoadedCount(pageSize);
  }, [pageSize, searchQuery, sortingMode, activeTypes]);

  const hasMore = filteredListings.length > loadedCount;
  const displayList = sorted.slice(0, loadedCount);

  const loadMore = useCallback(() => {
    setLoadedCount(prev => Math.min(prev + pageSize, filteredListings.length));
  }, [filteredListings.length, pageSize]);

  // ---- URL sync helpers ----
  const setTypeFilter = useCallback((types: Set<ListingType>) => {
    const next = new URLSearchParams(searchParams);
    if (types.size === TYPES.length) {
      next.set('type', 'show-all');
    } else {
      next.set('type', [...types].join(','));
    }
    next.delete('q');
    window.history.replaceState(null, '', `?${next.toString()}`);
    setSearchParams(next);
  }, [searchParams]);

  const setSort = useCallback((mode: SortingMode) => {
    const next = new URLSearchParams(searchParams);
    if (mode === 'default') next.delete('sort');
    else next.set('sort', mode);
    window.history.replaceState(null, '', `?${next.toString()}`);
    setSearchParams(next);
  }, [searchParams]);

  const setView = useCallback((mode: 'grid' | 'list' | 'map') => {
    const next = new URLSearchParams(searchParams);
    if (mode === 'grid') next.delete('view');
    else next.set('view', mode);
    window.history.replaceState(null, '', `?${next.toString()}`);
    setSearchParams(next);
  }, [searchParams]);

  const setSearch = useCallback((q: string) => {
    const next = new URLSearchParams(searchParams);
    if (q) next.set('q', q);
    else next.delete('q');
    window.history.replaceState(null, '', `?${next.toString()}`);
    setSearchParams(next);
  }, [searchParams]);

  // ---- Handlers ----
  const handleViewDetails = useCallback((item: ListingItem) => {
    // Route to the closest existing surface. supplier-portal is role-gated, so
    // services/wellness go to the general explore page instead of a login gate.
    if (item.type === 'event' || item.type === 'activities') {
      navigateTo('/experiences', { experienceSlug: item.slug });
    } else if (item.type === 'food-drink') {
      navigateTo('/food');
    } else {
      navigateTo('/explore');
    }
  }, [navigateTo]);

  const toggleFav = useCallback((id: string) => {
    // Stub: persist to localStorage, expand to session when auth exists
    const key = 'dahab_listing_favs';
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    const favs: string[] = raw ? JSON.parse(raw) : [];
    const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
    if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(next));
  }, []);

  // ---- Render helpers ----
  const showAllActive = activeTypes.size === TYPES.length;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'}
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
      }`}>

      {/* Header */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-balance">
              {t('explore.dahabListings')}
            </h1>
            <p className={`text-xs ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
              {t('explore.eventsServicesWellnessActivities')}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--surface-card)] rounded-xl p-1 border border-[var(--border-subtle)] shadow-xs">
            {(['grid', 'list', 'map'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setView(m)}
                aria-label={`${m} view`}
                aria-pressed={viewMode === m}
                className={`p-2 rounded-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                  viewMode === m
                    ? 'bg-[var(--accent-primary)] text-[var(--surface-container)]'
                    : isDark
                    ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#1a4038]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]'
                }`}>
                {m === 'grid' && <Grid3X3 className="w-4 h-4" />}
                {m === 'list' && <List className="w-4 h-4" />}
                {m === 'map' && <MapIcon className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-3">
        <div className={`flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
        }`}>
          <span>{filteredListings.length} {t('attractions.results')}</span>
          <span className="text-[var(--border-subtle)]">|</span>
          <span>{t('explore.showing')} {displayList.length}</span>
          {hasMore && (
            <span className="text-[var(--accent-primary)] font-bold">
              +{filteredListings.length - loadedCount} {t('explore.more')}
            </span>
          )}
        </div>
      </div>

      {/* Filters + search */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-4 space-y-3">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className={`absolute ${language === 'ar' ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[var(--text-secondary)]/40' : 'text-[var(--text-secondary)]/40'}`} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('explore.searchListings')}
            className={`w-full py-2.5 ${language === 'ar' ? 'pl-4 pr-10' : 'pl-10 pr-4'} rounded-xl border text-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
              isDark
                ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--accent-primary)]'
                : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent-primary)]'
            } focus:outline-none`}
          />
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button"
            onClick={() => setTypeFilter(new Set(TYPES.map(t => t.id)))}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] border ${
              showAllActive
                ? 'bg-[var(--accent-primary)] text-[var(--surface-container)] border-[var(--accent-primary)]'
                : isDark
                ? 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[#1a4038]'
                : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]'
            }`}>
            {t('explore.showAll')}
          </button>
          {TYPES.map(t => {
            const active = activeTypes.has(t.id);
            return (
              <button key={t.id} type="button"
                onClick={() => {
                  const next = new Set(activeTypes);
                  if (next.has(t.id)) next.delete(t.id);
                  else next.add(t.id);
                  setTypeFilter(next);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] border ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--surface-container)] border-[var(--accent-primary)]'
                    : isDark
                    ? 'bg-[var(--surface-card)] text-[var(--text-secondary)]/70 border-[var(--border-subtle)] opacity-60 hover:opacity-100'
                    : 'bg-[var(--surface-card)] text-[var(--text-secondary)]/70 border-[var(--border-subtle)] opacity-60 hover:opacity-100'
                }`}>
                {language === 'ar' ? t.labelAr : t.label}
              </button>
            );
          })}
        </div>

        {/* Sort + load more row */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 bg-[var(--surface-card)] rounded-xl p-1 border border-[var(--border-subtle)] shadow-xs">
            {(['default', 'random', 'rating', 'popular'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setSort(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                  sortingMode === m
                    ? 'bg-[var(--accent-primary)] text-[var(--surface-container)]'
                    : isDark
                    ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#1a4038]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]'
                }`}>
                {m === 'default' && (t('explore.default'))}
                {m === 'random' && (t('explore.random'))}
                {m === 'rating' && (t('explore.rating'))}
                {m === 'popular' && (t('explore.popular'))}
              </button>
            ))}
          </div>

          {viewMode === 'map' && (
            <div className={`text-xs px-3 py-1.5 rounded-xl border ${
              isDark ? 'bg-amber-500/10 text-amber-200 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {t('explore.mapViewComingSoon')}
            </div>
          )}
        </div>
      </div>

      {/* Grid / List container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 flex-1">
        {displayList.length === 0 ? (
          <div className={`py-16 text-center rounded-2xl border ${
            isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'
          }`}>
            <Sparkles className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-[var(--text-secondary)]/40' : 'text-[var(--text-secondary)]/40'}`} />
            <p className={`text-sm ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
              {t('explore.noListingsMatchThat')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" style={{ contentVisibility: 'auto' } as React.CSSProperties}>
            {displayList.map(item => (
              <ListingCard
                key={item.id}
                item={item}
                isFeatured={item.level === 'featured'}
                isFav={false}
                onToggleFav={toggleFav}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3" style={{ contentVisibility: 'auto' } as React.CSSProperties}>
            {displayList.map(item => (
              <ListingCard
                key={item.id}
                item={item}
                isFeatured={item.level === 'featured'}
                isFav={false}
                onToggleFav={toggleFav}
                onViewDetails={handleViewDetails}
                horizontal
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
          <button type="button"
            onClick={loadMore}
            className="px-6 py-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-container)] text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98]">
            {t('explore.loadMore')}
            <span className="text-xs opacity-70">
              ({loadedCount} → {Math.min(loadedCount + pageSize, filteredListings.length)})
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ListingsView;

// ---------------------------------------------------------------------------
// Mapper: build unified ListingItem[] from activities + suppliers + places
// ---------------------------------------------------------------------------

function listingTypeFor(category: string): ListingType {
  const map: Record<string, ListingType> = {
    diving: 'activities',
    water_sport: 'activities',
    safari: 'activities',
    wellness: 'health-wellness',
    culture: 'event',
    food: 'food-drink',
    restaurant: 'food-drink',
    hotel: 'real-estate',
    event: 'event',
  };
  return map[category] ?? 'event';
}

function slugify(titleEn: string): string {
  return titleEn
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/**
 * Maps the three corpus sources into a single ListingItem[].
 * Suppliers get rating + reviewCount from the commerce supplier records.
 */
export function buildListingsFromCorpus(
  activities: any[],
  suppliers: any[],
  places: any[],
  isAr: boolean
): ListingItem[] {
  const out: ListingItem[] = [];

  for (const a of activities) {
    const type = listingTypeFor(a.category);
    out.push({
      id: `act-${a.id}`,
      slug: slugify(a.titleEn),
      type,
      level: 'normal',
      thumbnail: a.images?.[0] || a.image || '',
      cover: a.images?.[0] || a.image || '',
      marker: a.images?.[0] || '',
      titleEn: a.titleEn,
      titleAr: a.titleAr,
      categoryLabelEn: isAr ? '' : a.experienceLevelRequired || '',
      categoryLabelAr: isAr ? (a.experienceLevelRequired || '') : '',
      rating: a.rating,
      reviewCount: a.reviewCount,
      dates: a.dates || undefined,
      location: a.coordinates ? {
        address: isAr ? (a.areaNameAr || a.areaId) : (a.areaNameEn || a.areaId),
        lat: String(a.coordinates.lat),
        lng: String(a.coordinates.lng),
      } : undefined,
      price: a.basePriceEGP ? `From ${a.basePriceEGP.toLocaleString()} EGP` : undefined,
      tags: a.tags,
    });
  }

  for (const s of suppliers) {
    out.push({
      id: `sup-${s.id}`,
      slug: slugify(s.businessName || s.id),
      type: listingTypeFor(s.category || ''),
      level: 'featured',
      thumbnail: s.image || s.logoUrl || '',
      cover: s.image || s.logoUrl || '',
      titleEn: s.businessName || '',
      titleAr: s.businessNameAr || '',
      rating: s.rating,
      reviewCount: s.reviewCount,
      location: s.coordinates ? {
        address: s.address || s.area || '',
        lat: String(s.coordinates.lat),
        lng: String(s.coordinates.lng),
      } : (s.area ? { address: s.area, lat: '', lng: '' } : undefined),
      price: s.priceRange || undefined,
      tags: s.serviceTypes,
      supplierId: s.id,
    });
  }

  for (const p of places) {
    const type = listingTypeFor(p.category);
    out.push({
      id: `place-${p.id}`,
      slug: slugify(p.nameEn || p.id),
      type,
      level: 'normal',
      thumbnail: p.imageUrl || p.photoUrl || '',
      cover: p.imageUrl || p.photoUrl || '',
      titleEn: p.nameEn || '',
      titleAr: p.nameAr || '',
      categoryLabelEn: p.category || '',
      categoryLabelAr: p.categoryAr || '',
      rating: p.rating,
      reviewCount: p.reviewCount,
      location: p.coordinates ? {
        address: p.formattedAddress || p.address || '',
        lat: String(p.coordinates.lat),
        lng: String(p.coordinates.lng),
      } : undefined,
      tags: p.tags,
    });
  }

  return out;
}
