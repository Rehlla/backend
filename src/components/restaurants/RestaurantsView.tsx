import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search, Star, Clock, MapPin, ChevronRight, Heart,
  Bot, Info, X, Sparkles, SlidersHorizontal, ArrowUpDown,
  Utensils, Flame, Loader2, ShoppingBag, ChevronLeft, ChevronDown,
  Check, ArrowRight, Zap, Fish, Sandwich, Pizza, CookingPot, Soup, Leaf,
  Coffee, Wallet, Wine, Moon
} from 'lucide-react';
import { WhatsAppIcon } from '../common/icons/WhatsAppIcon';
import { NoResultsState } from '../common/NoResultsState';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { ConciergePageHeader } from '../concierge/ConciergePageHeader';
import { useDestination } from '../../context/DestinationContext';
import { EarlyRestaurantsBrowse } from '../places/EarlyCatalogueBrowse';
import { toCuisineList } from '../../shared/diningVenue';
import { DiningVenueMenuView } from './DiningVenueMenuView';
import { DiningOrderTracking } from './DiningOrderTracking';

// ---------------------------------------------------------------------------
// Types (mirror askdahab.com restaurant shape)
// ---------------------------------------------------------------------------

interface Restaurant {
  id: string;
  name: string;
  nameAr: string;
  cuisine: string[];
  cuisineAr: string[];
  priceBand: 'Budget ($)' | 'Moderate ($$)' | 'Premium ($$$)';
  averageMealPriceEGP: number;
  rating?: number;
  reviewCount?: number;
  openingHours: string;
  openingHoursAr?: string;
  dietaryOptions: {
    vegan: boolean;
    vegetarian: boolean;
    halal: boolean;
    freshSeafoodCatch: boolean;
  };
  areaId: string;
  areaName?: string;
  areaNameAr?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  description?: string;
  descriptionAr?: string;
  coordinates?: { lat: number; lng: number };
  /** CMS catalog-binding cover override (dining_venue), when published. */
  coverImageUrl?: string;
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  language: 'en' | 'ar';
  isDark: boolean;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function priceTierLabel(band: Restaurant['priceBand'], language: 'en' | 'ar'): string {
  if (language === 'ar') {
    if (band === 'Budget ($)') return 'ميزانية ($)';
    if (band === 'Moderate ($$)') return 'متوسط ($$)';
    return 'فاخر ($$$)';
  }
  return band;
}

const RESTAURANT_FALLBACK_IMAGES = [
  '/images/restaurants/ali-baba-restaurant.jpg',
  '/images/restaurants/the-roof-restaurant.jpg',
  '/images/restaurants/boho-beach-cafe.jpg',
  '/images/restaurants/breakfast-by-the-sea.jpg',
  '/images/hero/boho-cafe-dreams.jpg',
  '/images/hero/gulf-sunset.jpg',
];

function getRestaurantImage(r: { id: string; name?: string; coverImageUrl?: string }): string {
  // A published CMS cover override always wins; the heuristics below are the
  // compiled fallback (unchanged behavior until an editor publishes).
  if (r.coverImageUrl) return r.coverImageUrl;
  const key = (r.id || '').toLowerCase();
  const name = (r.name || '').toLowerCase();
  if (key.includes('ali') || name.includes('ali')) return '/images/restaurants/ali-baba-restaurant.jpg';
  if (key.includes('roof') || name.includes('roof')) return '/images/restaurants/the-roof-restaurant.jpg';
  if (name.includes('breakfast') || name.includes('bakery')) return '/images/restaurants/breakfast-by-the-sea.jpg';
  if (name.includes('seafood') || name.includes('fish')) return '/images/restaurants/ali-baba-restaurant.jpg';

  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return RESTAURANT_FALLBACK_IMAGES[hash % RESTAURANT_FALLBACK_IMAGES.length];
}

// ---------------------------------------------------------------------------
// Cuisine Category Carousel data
// ---------------------------------------------------------------------------

const CUISINE_CATEGORIES = [
  { key: 'all',           icon: Utensils,  labelEn: 'All',           labelAr: 'الكل' },
  { key: 'seafood',       icon: Fish,  labelEn: 'Seafood',       labelAr: 'مأكولات بحرية' },
  { key: 'egyptian',      icon: Sandwich,  labelEn: 'Egyptian',      labelAr: 'مصري' },
  { key: 'italian',       icon: Pizza,  labelEn: 'Italian',       labelAr: 'إيطالي' },
  { key: 'indian',        icon: CookingPot,  labelEn: 'Indian',        labelAr: 'هندي' },
  { key: 'asian',         icon: Soup,  labelEn: 'Asian',         labelAr: 'آسيوي' },
  { key: 'mediterranean', icon: Leaf,  labelEn: 'Mediterranean', labelAr: 'متوسطي' },
  { key: 'brunch',        icon: Coffee,  labelEn: 'Brunch',        labelAr: 'برانش' },
  { key: 'cheap',         icon: Wallet,  labelEn: 'Budget',        labelAr: 'اقتصادي' },
  { key: 'datenight',     icon: Wine,  labelEn: 'Date Night',    labelAr: 'رومانسي' },
  { key: 'openlate',      icon: Moon,  labelEn: 'Open Late',     labelAr: 'يفتح متأخر' },
];

type SortOption = 'recommended' | 'rating' | 'price-asc' | 'price-desc' | 'reviews';

// ---------------------------------------------------------------------------
// Loading skeleton card
// ---------------------------------------------------------------------------

const SkeletonCard: React.FC<{ isDark: boolean }> = () => (
  <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-card)] animate-pulse motion-reduce:animate-none" aria-hidden="true">
    <div className="aspect-[4/3] bg-[var(--surface-container)]" />
    <div className="p-4 space-y-2.5">
      <div className="h-5 rounded-lg w-3/4 bg-[var(--surface-container)]" />
      <div className="h-3 rounded-lg w-1/2 bg-[var(--surface-container)]" />
      <div className="h-10 rounded-xl bg-[var(--surface-container)] mt-3" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Restaurant Card — modern smart redesign
// ---------------------------------------------------------------------------

const RestaurantCard: React.FC<RestaurantCardProps & { isOrderable?: boolean }> = ({
  restaurant,
  language,
  isDark,
  isFav,
  onToggleFav,
  onViewDetails,
  isOrderable,
}) => {
  const { t } = useLanguage();
  const rtl = language === 'ar';
  const imgUrl = getRestaurantImage(restaurant);
  const name = language === 'ar' ? restaurant.nameAr : restaurant.name;
  const cuisines = (restaurant.cuisine || []).slice(0, 2).map((c, i) => (language === 'ar' ? restaurant.cuisineAr?.[i] || c : c));
  const area = restaurant.areaName ? (language === 'ar' ? restaurant.areaNameAr || restaurant.areaName : restaurant.areaName) : null;
  const hours = restaurant.openingHours ? (language === 'ar' ? restaurant.openingHoursAr || restaurant.openingHours : restaurant.openingHours) : null;
  const open = () => onViewDetails?.(restaurant.id);

  // Same anatomy as the stay card: photo with one status badge and the save
  // heart; then name + rating, one meta line, and a single action. Everything
  // else (full hours, all cuisines, WhatsApp) lives one tap away.
  return (
    <article
      dir={rtl ? 'rtl' : 'ltr'}
      onClick={open}
      className="group relative rounded-2xl overflow-hidden cursor-pointer bg-[var(--surface-card)] border border-[var(--border-subtle)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--accent-primary)]/50 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/40"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-container)]">
        <img
          src={imgUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {isOrderable && (
          <span className={`absolute top-3 ${rtl ? 'right-3' : 'left-3'} flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--accent-primary)] text-[var(--surface-container)]`}>
            <Zap className="w-3 h-3" aria-hidden="true" />
            {language === 'ar' ? 'اطلب أونلاين' : 'Order online'}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFav(restaurant.id); }}
          aria-label={isFav ? t('explore.removeFromFavourites') : t('explore.addToFavourites')}
          aria-pressed={isFav}
          className={`absolute z-10 top-2 ${rtl ? 'left-2' : 'right-2'} w-11 h-11 rounded-full flex items-center justify-center transition-[background-color,transform] active:scale-90 cursor-pointer ${
            isFav ? 'bg-rose-500 text-white' : 'bg-black/40 text-white hover:bg-black/55 backdrop-blur-sm'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display font-semibold text-base sm:text-lg leading-snug line-clamp-2 text-[var(--text-primary)]">
            {name}
          </h3>
          {restaurant.rating ? (
            <span
              className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-[var(--text-primary)]"
              aria-label={`${restaurant.rating.toFixed(1)} / 5${restaurant.reviewCount ? `, ${restaurant.reviewCount} ${language === 'ar' ? 'تقييم' : 'reviews'}` : ''}`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              {restaurant.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-xs text-[var(--text-secondary)] truncate">
          {[...cuisines, priceTierLabel(restaurant.priceBand, language)].join(' · ')}
        </p>
        {(area || hours) && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-secondary)] truncate">
            {area && (
              <>
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{area}</span>
              </>
            )}
            {area && hours && <span aria-hidden="true">·</span>}
            {hours && (
              <>
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{hours}</span>
              </>
            )}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); open(); }}
            className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-[filter,background-color,transform] active:scale-[0.98] cursor-pointer ${
              isOrderable
                ? 'bg-[var(--accent-primary)] text-[var(--surface-container)] hover:brightness-110'
                : 'bg-[var(--surface-container)] text-[var(--text-primary)] hover:bg-[var(--accent-primary)]/15'
            }`}
          >
            {isOrderable ? (
              <>
                <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                {/* The tap opens the venue's menu page (an order is placed
                    from there), so the label says that instead of promising
                    "Order Now" with no cart behind the click. Also lived
                    inline here; catalog keys are the only copy source. */}
                {t('dining.orderNowCta')}
              </>
            ) : (
              <>
                {t('viewRestaurant')}
                <ChevronRight className={`w-3.5 h-3.5 ${rtl ? 'rotate-180' : ''}`} aria-hidden="true" />
              </>
            )}
          </button>
          {restaurant.whatsapp && (
            <a
              href={`https://wa.me/${restaurant.whatsapp.replace(/[^0-9+]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`WhatsApp: ${name}`}
              className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border border-[var(--border-subtle)] text-emerald-500 hover:border-emerald-500 transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------------
// Restaurant detail modal
// ---------------------------------------------------------------------------

const RestaurantDetailModal: React.FC<{
  restaurant: Restaurant;
  language: 'en' | 'ar';
  isDark: boolean;
  onClose: () => void;
  onBook: (restaurant: Restaurant) => void;
  /** False when the kitchen has no menu seed, in which case the order CTA is
   *  withheld rather than shown to dead-end. The WhatsApp/website contacts
   *  above remain the honest way to reach that kitchen. */
  orderable?: boolean;
}> = ({ restaurant, language, isDark, onClose, onBook, orderable = false }) => {
  const { t } = useLanguage();
  const rtl = language === 'ar';

  const dietary = restaurant.dietaryOptions
    ? [
        { key: 'vegan', label: t('vegan'), value: restaurant.dietaryOptions.vegan },
        { key: 'vegetarian', label: t('vegetarian'), value: restaurant.dietaryOptions.vegetarian },
        { key: 'halal', label: t('halal'), value: restaurant.dietaryOptions.halal },
        { key: 'seafood', label: t('freshSeafood'), value: restaurant.dietaryOptions.freshSeafoodCatch },
      ].filter(d => d.value)
    : [];

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="restaurant-detail-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border animate-in zoom-in-95 duration-150 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'
        }`}
      >
        {/* Header photo */}
        <div className="relative h-48 bg-[var(--surface-container)] overflow-hidden flex items-end p-5 text-white">
          <img
            src={getRestaurantImage(restaurant)}
            alt={language === 'ar' ? restaurant.nameAr : restaurant.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
          <div className="relative z-10 flex items-end justify-between w-full gap-3">
            <div className="min-w-0">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1.5 backdrop-blur-md shadow-xs"
                style={{
                  color: '#ffffff',
              backgroundColor: restaurant.priceBand === 'Budget ($)' ? 'color-mix(in srgb, var(--accent-secondary) 80%, transparent)' : restaurant.priceBand === 'Moderate ($$)' ? 'color-mix(in srgb, var(--accent-primary) 80%, transparent)' : 'color-mix(in srgb, var(--text-secondary) 80%, transparent)',
                }}>
                {priceTierLabel(restaurant.priceBand, language)}
              </span>
              <h3 id="restaurant-detail-title" className="chart-heading font-bold text-xl leading-tight truncate text-white drop-shadow-sm">
                {language === 'ar' ? restaurant.nameAr : restaurant.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 text-white hover:bg-black/70 flex-shrink-0 cursor-pointer"
              aria-label={t('attractions.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`p-5 space-y-4 ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
          {/* Rating + price */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {restaurant.rating && (
              <span className="flex items-center gap-1 font-bold">
                <Star className="w-4 h-4 fill-[var(--accent-secondary)] text-[var(--accent-secondary)]" />
                {restaurant.rating.toFixed(1)}
                {restaurant.reviewCount != null && restaurant.reviewCount > 0 && <span className={`${isDark ? 'text-[var(--text-secondary)]/60' : 'text-[var(--text-secondary)]'}`}>({restaurant.reviewCount})</span>}
              </span>
            )}
            {restaurant.averageMealPriceEGP > 0 && (
              <span className={`font-bold ${isDark ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                {t('avgMeal')} {Math.round(restaurant.averageMealPriceEGP)} EGP
              </span>
            )}
          </div>

          {/* Cuisine tags */}
          {(restaurant.cuisine || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(restaurant.cuisine || []).slice(0, 6).map((c, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                  {language === 'ar' ? (restaurant.cuisineAr?.[i] || c) : c}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {restaurant.description && (
            <p className={`text-xs leading-relaxed ${isDark ? 'text-[var(--text-secondary)]/75' : 'text-[var(--text-secondary)]'}`}>
              {language === 'ar' ? restaurant.descriptionAr : restaurant.description}
            </p>
          )}

          {/* Fact grid */}
          <div className={`grid grid-cols-2 gap-2 text-xs`}>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)]' : 'bg-[var(--surface-container)] border-[var(--border-subtle)]'}`}>
              <div className={`flex items-center gap-1.5 mb-1 font-bold ${isDark ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-primary)]'}`}>
                <Clock className="w-3 h-3" />
                {t('hours')}
              </div>
              <span className={isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}>
                {language === 'ar' ? (restaurant.openingHoursAr || restaurant.openingHours) : restaurant.openingHours}
              </span>
            </div>
            {restaurant.areaName && (
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)]' : 'bg-[var(--surface-container)] border-[var(--border-subtle)]'}`}>
                <div className={`flex items-center gap-1.5 mb-1 font-bold ${isDark ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-primary)]'}`}>
                  <MapPin className="w-3 h-3" />
                  {t('attractions.area')}
                </div>
                <span className={isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}>
                  {language === 'ar' ? (restaurant.areaNameAr || restaurant.areaName) : restaurant.areaName}
                </span>
              </div>
            )}
          </div>

          {/* Dietary options */}
          {dietary.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dietary.map(d => (
                <span key={d.key} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                  ✓ {d.label}
                </span>
              ))}
            </div>
          )}

          {/* Contact actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {restaurant.whatsapp && (
              <a
                href={`https://wa.me/${restaurant.whatsapp.replace(/[^0-9+]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-[background-color,border-color,color,box-shadow,transform,opacity]"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                {t('whatsAppTheRestaurant')}
              </a>
            )}
            {restaurant.website && (
              <a
                href={restaurant.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:bg-[var(--surface-container)]"
              >
                {t('attractions.website')}
              </a>
            )}
          </div>

          {orderable && (
            <button
              type="button"
              onClick={() => onBook(restaurant)}
              className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-container)] text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              {t('bookATableOrder')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Cuisine Category Carousel
// ---------------------------------------------------------------------------

const CuisineCategoryCarousel: React.FC<{
  language: 'en' | 'ar';
  isDark: boolean;
  activeKey: string;
  onSelect: (key: string) => void;
}> = ({ language, isDark, activeKey, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => scroll('left')}
        className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-full border flex-shrink-0 transition-all ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
        }`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none pb-1 flex-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {CUISINE_CATEGORIES.map(cat => {
          const isActive = activeKey === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onSelect(cat.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all border ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-sm scale-105'
                  : isDark
                  ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/40'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-[var(--accent-primary)]/40 hover:bg-gray-50'
              }`}
            >
              <cat.icon className="w-4 h-4" aria-hidden="true" />
              <span>{language === 'ar' ? cat.labelAr : cat.labelEn}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => scroll('right')}
        className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-full border flex-shrink-0 transition-all ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
        }`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Before you arrive guide (kept, compact)
// ---------------------------------------------------------------------------

const BeforeYouArriveGuide: React.FC<{ language: 'en' | 'ar'; isDark: boolean }> = ({ language, isDark }) => {
  const { t } = useLanguage();
  const bullets = [t('restaurants.dahabBullet1'), t('restaurants.dahabBullet2'), t('restaurants.dahabBullet3')];
  const tips = [t('restaurants.whatsAppTip1'), t('restaurants.whatsAppTip2')];

  return (
    <section className={`rounded-2xl border p-5 ${
      isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]' : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
        <div className="space-y-3">
          <h3 className="chart-heading font-bold text-sm text-[var(--text-primary)]">
            {t('beforeYouArrive')}
          </h3>
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className={`text-xs leading-relaxed flex gap-2 ${
                isDark ? 'text-[var(--text-secondary)]/80' : 'text-[var(--text-secondary)]'
              }`}>
                <span className="text-[var(--accent-primary)] font-bold">•</span> {b}
              </li>
            ))}
          </ul>
          <div className="pt-1 space-y-1.5">
            {tips.map((tipItem, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold flex-shrink-0">
                  {t('tip')}
                </span>
                <span className={isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}>{tipItem}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Main RestaurantsView
// ---------------------------------------------------------------------------

const fetchRestaurantSuppliers = (signal: AbortSignal) => api.getCommerceSuppliers(signal).then(r => r.suppliers);

const LiveRestaurantsView: React.FC = () => {
  const { navigateTo, selectedVenueSlug, setSelectedVenueSlug } = useTrip();
  const { language , t} = useLanguage();
  const { isDark } = useTheme();

  // ---- Order flow ----
  // A venue slug from the address bar opens the MENU, not the old modal: a
  // menu a traveler is about to order from has to be its own URL, shareable
  // and refresh-safe, which '?restaurant=' in a query string never was.
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const openVenue = useCallback(
    (slug: string) => {
      setSelectedVenueSlug(slug);
      navigateTo('/restaurants', { venueSlug: slug });
    },
    [navigateTo, setSelectedVenueSlug]
  );
  const closeVenue = useCallback(() => {
    setSelectedVenueSlug(null);
    setActiveOrderId(null);
    navigateTo('/restaurants');
  }, [navigateTo, setSelectedVenueSlug]);

  // ---- State ----
  const [searchQuery, setSearchQuery] = useState('');
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(true);

  // Detail panel, carried in the URL like every other selection (?restaurant=id)
  // so a specific restaurant page is linkable and survives a refresh.
  const [detailId, setDetailId] = useState<string | null>(() => {
    const raw = new URLSearchParams(window.location.search).get('restaurant');
    return raw || null;
  });

  // Filter state, seeded from the URL once, then owned by React: a chip click
  // must re-render the grid immediately, not wait for a popstate event nobody
  // dispatches. Declared above the fetcher so the server-driven request below
  // can read them.
  const PRICE_BAND_COUNT = 3;

  const [activePriceBands, setActivePriceBands] = useState<Set<Restaurant['priceBand']>>(() => {
    const raw = new URLSearchParams(window.location.search).get('price');
    if (!raw || raw === 'all') return new Set(['Budget ($)', 'Moderate ($$)', 'Premium ($$$)']);
    return new Set(raw.split(',') as Restaurant['priceBand'][]);
  });

  const [activeCuisines, setActiveCuisines] = useState<Set<string>>(() => {
    const raw = new URLSearchParams(window.location.search).get('cuisine');
    if (!raw) return new Set();
    return new Set(raw.split(',').filter(Boolean));
  });

  // ---- Fetch ----
  // The server /api/dahab/food endpoint filters by cuisine / price / query, so
  // the fetcher is rebuilt (and the request re-run) whenever those change —
  // the documented useApiResource pattern for parameterised resources.
  const diningFetcher = useCallback(
    (signal: AbortSignal) =>
      api.getDahabDining(
        {
          q: searchQuery.trim() || undefined,
          price: activePriceBands.size === 3 ? undefined : [...activePriceBands],
        },
        signal
      ).then(r => r.venues),
    [searchQuery, activePriceBands]
  );
  const diningCorpus = useApiResource(diningFetcher);
  const suppliersCorpus = useApiResource(fetchRestaurantSuppliers);

  // ---- Which restaurants can actually take an order ----
  // The orderable list is the ONLY source of slugs: the /api/dahab/food corpus
  // this page renders predates menus and carries no slug. A venue absent from
  // it has no menu to open, so its card keeps the WhatsApp contact instead of
  // an order button that would dead-end.
  const orderableFetcher = useCallback(
    (signal: AbortSignal) => api.getDiningVenues(signal).then(r => r.venues),
    []
  );
  const orderable = useApiResource(orderableFetcher, { cacheKey: 'dining:venues', ttlMs: 60_000 });
  const slugByVenueId = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of orderable.data ?? []) {
      if (v.slug) map.set(v.id, v.slug);
    }
    return map;
  }, [orderable.data]);

  // A legacy ?restaurant=<id> link for a kitchen that now has a menu redirects
  // to that kitchen's page instead of opening the old modal. The slug map is
  // fetched, so this runs once it is available — the modal never flashes for a
  // venue the traveler can actually order from.
  useEffect(() => {
    if (!detailId) return;
    const slug = slugByVenueId.get(detailId);
    if (slug) {
      setDetailId(null);
      openVenue(slug);
    }
  }, [detailId, slugByVenueId, openVenue]);

  // ---- Merge restaurants ----
  // The wire shapes (DahabDiningVenue / SupplierEntity) carry the core fields;
  // the extras below — rating, reviewCount, phone, website, description — are
  // optional on the server record, so they are read defensively off a widened
  // view of each record rather than a hard type contract.
  const restaurants = useMemo<Restaurant[]>(() => {
    const out: Restaurant[] = [];

    // From dining corpus (primary)
    for (const raw of (diningCorpus.data || [])) {
      const v = raw as Record<string, any>;
      out.push({
        id: v.id,
        name: v.nameEn,
        nameAr: v.nameAr,
        // Coerced, not just defaulted: four corpus rows carry `cuisine` as a
        // string, and `.slice(0, 4).map(...)` on a string throws.
        cuisine: toCuisineList(v.cuisine).length ? toCuisineList(v.cuisine) : ['Dahab'],
        cuisineAr: v.cuisineAr || ['دهب'],
        priceBand: v.priceBand || 'Moderate ($$)',
        averageMealPriceEGP: v.averageMealPriceEGP || 0,
        rating: v.rating,
        reviewCount: v.reviewCount,
        openingHours: v.openingHours || 'Open daily',
        openingHoursAr: v.openingHoursAr,
        dietaryOptions: v.dietaryOptions || { vegan: false, vegetarian: false, halal: true, freshSeafoodCatch: false },
        areaId: v.areaId,
        areaName: v.areaName,
        areaNameAr: v.areaNameAr,
        phone: v.phone,
        whatsapp: v.whatsapp,
        website: v.website,
        instagram: v.instagram,
        description: v.description,
        descriptionAr: v.descriptionAr,
        coordinates: v.coordinates,
        coverImageUrl: v.coverImageUrl,
      });
    }

    // Supplement from commerce suppliers (restaurant-categorized)
    for (const rawS of (suppliersCorpus.data || [])) {
      const s = rawS as Record<string, any>;
      if ((s.category || '').toLowerCase() !== 'restaurant') continue;
      if (out.some(r => r.id === s.id)) continue;
      out.push({
        id: s.id,
        name: s.businessName || '',
        nameAr: s.businessNameAr || '',
        cuisine: (s.serviceTypes || []).filter(Boolean).slice(0, 4),
        cuisineAr: [],
        priceBand: s.tier && s.tier.toLowerCase().includes('tier 1') ? 'Premium ($$$)' : s.tier && s.tier.toLowerCase().includes('tier 2') ? 'Moderate ($$)' : 'Budget ($)',
        averageMealPriceEGP: s.averageMealPriceEGP || 0,
        rating: s.rating,
        reviewCount: s.reviewCount,
        openingHours: s.openingHours || 'Open daily',
        dietaryOptions: { vegan: false, vegetarian: false, halal: true, freshSeafoodCatch: false },
        areaId: s.area || '',
        areaName: s.area,
        phone: s.phone,
        whatsapp: s.whatsappNumber || s.whatsapp,
        website: s.website,
        instagram: s.instagram,
        description: s.businessType ? `Provided by ${s.businessType}.` : undefined,
        coordinates: s.coordinates ? { lat: s.coordinates.lat, lng: s.coordinates.lng } : undefined,
      });
    }

    return out;
  }, [diningCorpus.data, suppliersCorpus.data]);

  // ---- Filters ----

  // "Best for" chips carry semantic tags ("cheap", "open late", "brunch") that
  // are not cuisine names. Matching them naively against the cuisine list would
  // empty the grid — "Open late" matches no cuisine — so each key maps to a
  // rule: a cuisine name, or an hours/price heuristic.
  const matchesBestFor = useCallback((r: Restaurant): boolean => {
    if (activeCuisines.size === 0) return true;
    return [...activeCuisines].some(k => {
      if (k === 'cheap') return r.priceBand === 'Budget ($)';
      if (k === 'openlate') return /(00:00|24:00|midnight|1[2]?:00 AM|12:00 AM|01:00)/i.test(r.openingHours || '');
      if (k === 'brunch') return /(breakfast|morning|brunch|0[89]|1[01]:00)/i.test(r.openingHours || '');
      return (r.cuisine || []).some(c => c.toLowerCase() === k);
    });
  }, [activeCuisines]);

  const filtered = useMemo<Restaurant[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    /**
     * With every band selected there is no price filter to apply.
     *
     * Testing `activePriceBands.has(r.priceBand)` instead meant a venue whose
     * band was not one of the three display labels failed the check even in the
     * unfiltered state, and no chip could bring it back. Four venues stored
     * with the research importer's 'MID' spelling were invisible that way: the
     * stats tile counted 15 restaurants and the grid listed 11.
     */
    const priceFilterActive = activePriceBands.size < PRICE_BAND_COUNT;
    return restaurants.filter(r => {
      const matchesPrice = !priceFilterActive || activePriceBands.has(r.priceBand);
      const matchesCuisine = matchesBestFor(r);
      const matchesSearch = !q ||
        r.name.toLowerCase().includes(q) ||
        (r.nameAr && r.nameAr.toLowerCase().includes(q)) ||
        (r.cuisine || []).some(c => c.toLowerCase().includes(q));
      return matchesPrice && matchesCuisine && matchesSearch;
    });
  }, [restaurants, activePriceBands, matchesBestFor, searchQuery]);

  const toggleFav = useCallback((id: string) => {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const viewDetails = useCallback((id: string) => {
    // A kitchen with a menu goes straight to its own page — no popup. A modal
    // is a dead end for a traveler about to order: they tap it, read it, and
    // leave. The page IS the flow (menu → basket → checkout) and it is
    // shareable, which the old ?restaurant= query param never was.
    const slug = slugByVenueId.get(id);
    if (slug) {
      openVenue(slug);
      return;
    }
    // A venue with no menu seed keeps the modal, whose only action left is the
    // WhatsApp contact — the honest way to reach a kitchen that takes no orders.
    setDetailId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('restaurant', id);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [slugByVenueId, openVenue]);

  const closeDetails = useCallback(() => {
    setDetailId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('restaurant');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  const bookRestaurant = useCallback((r: Restaurant) => {
    // The CTA used to drop the restaurant on the floor and open /food generic —
    // the traveler lost the venue they had chosen. The menu IS the order flow
    // now, and it opens on the kitchen they tapped.
    const slug = slugByVenueId.get(r.id);
    if (slug) {
      setDetailId(null);
      openVenue(slug);
    }
  }, [slugByVenueId, openVenue]);

  const handleCuisineFilter = useCallback((cuisines: string[]) => {
    setActiveCuisines(new Set(cuisines.map(c => c.toLowerCase())));
    const params = new URLSearchParams(window.location.search);
    if (cuisines.length === 0) params.delete('cuisine');
    else params.set('cuisine', cuisines.join(','));
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  // ---- Render ----
  const favList = restaurants.filter(r => favs.has(r.id));

  /**
   * Both stats are derived from what the corpus actually carries.
   *
   * `Price tiers` was the literal 3, which would keep claiming three bands if
   * the corpus ever held two — and it is exactly that kind of unchecked
   * assumption about the band vocabulary that hid four restaurants here.
   */
  const priceTierCount = new Set(
    restaurants.map(r => r.priceBand).filter(Boolean)
  ).size;

  const mealPrices = restaurants
    .map(r => r.averageMealPriceEGP)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const avgMealPriceLabel = mealPrices.length
    ? `${Math.round(mealPrices.reduce((a, b) => a + b, 0) / mealPrices.length)} EGP`
    : '—';
  const visible = showAll ? filtered : favList;

  // ---- Active cuisine category (carousel) ----
  // These four hook calls used to live BELOW the early returns further down.
  // That breaks the Rules of Hooks: the list render ran N hooks, the venue
  // render ran fewer, and React threw "Rendered more hooks than during the
  // previous render" (minified #300) — the traveler saw the whole page die the
  // first time they tapped "Order online". Hooks must run in the same order on
  // every render of this component, so all of them sit above the returns.
  const [activeCuisineKey, setActiveCuisineKey] = useState<string>('all');
  const handleCategorySelect = useCallback((key: string) => {
    setActiveCuisineKey(key);
    if (key === 'all') {
      setActiveCuisines(new Set());
      handleCuisineFilter([]);
    } else {
      handleCuisineFilter([key]);
    }
  }, [handleCuisineFilter]);

  // ---- Sorting ----
  const [sortBy, setSortBy] = useState<SortOption>('recommended');

  const sorted = useMemo<Restaurant[]>(() => {
    const arr = [...visible];
    if (sortBy === 'rating') return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sortBy === 'price-asc') return arr.sort((a, b) => a.averageMealPriceEGP - b.averageMealPriceEGP);
    if (sortBy === 'price-desc') return arr.sort((a, b) => b.averageMealPriceEGP - a.averageMealPriceEGP);
    if (sortBy === 'reviews') return arr.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    // recommended: orderable first, then by rating
    return arr.sort((a, b) => {
      const ao = slugByVenueId.has(a.id) ? 1 : 0;
      const bo = slugByVenueId.has(b.id) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [visible, sortBy, slugByVenueId]);

  const isLoading = diningCorpus.status === 'loading' || suppliersCorpus.status === 'loading';

  // ---- Order flow takes over the page ----
  // AFTER every hook (the same ordering constraint RentalsView documents): this
  // is a return-branch, not a conditional hook, so the list's fetchers above
  // stay mounted and their cache stays warm for the back navigation.
  if (activeOrderId) {
    return (
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <DiningOrderTracking orderId={activeOrderId} onBack={closeVenue} onCancelled={() => setActiveOrderId(null)} />
      </div>
    );
  }

  if (selectedVenueSlug) {
    return (
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <DiningVenueMenuView slug={selectedVenueSlug} onBack={closeVenue} onOrderPlaced={setActiveOrderId} />
      </div>
    );
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'}
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
      }`}>

      {/* Hero header */}
      <ConciergePageHeader
        eyebrow={t('restaurants')}
        title={t('restaurantsInDahab')}
        subtitle={t('restaurants.heroCountMap', { count: restaurants.length })}
        image="/images/restaurants/boho-beach-cafe.jpg"
        imageAlt="Dahab Dining & Cafes"
        compact
        actions={
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 p-1 backdrop-blur-sm">
            <button type="button" onClick={() => setShowAll(true)} aria-pressed={showAll}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                showAll ? 'bg-[var(--accent-primary)] text-white' : 'text-white/75 hover:text-white'
              }`}>
              {t('all')}
            </button>
            <button type="button" onClick={() => setShowAll(false)} aria-pressed={!showAll}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                !showAll ? 'bg-white text-black' : 'text-white/75 hover:text-white'
              }`}>
              <Heart className="w-3 h-3 inline mr-1" />
              {t('favourites')} ({favList.length})
            </button>
          </div>
        }
        meta={
          <>
            <span className="font-semibold text-white/70">{restaurants.length} · {t('restaurants')}</span>
            <span className="font-semibold text-white/70">{priceTierCount} · {t('priceTiers')}</span>
            <span className="font-semibold text-white/70">{new Set(restaurants.flatMap(r => r.cuisine || [])).size} · {t('cuisines')}</span>
            <span className="font-semibold text-white/70">{avgMealPriceLabel} · {t('avgMeal-2')}</span>
          </>
        }
      />

      {/* ── Smart Search Hub ── */}
      <div className={`sticky top-0 z-20 border-b shadow-sm ${
        isDark ? 'bg-[var(--surface-card)]/95 border-[var(--border-subtle)] backdrop-blur-xl' : 'bg-white/95 border-gray-100 backdrop-blur-xl'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          {/* Search row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-primary)]`} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن مطعم أو مطبخ...' : 'Search restaurants, cuisines, areas...'}
                className={`w-full py-2.5 ${
                  language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'
                } rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 ${
                  isDark
                    ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent-primary)]'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[var(--accent-primary)] focus:bg-white'
                }`}
              />
            </div>

            {/* Sort */}
            <div className="relative flex-shrink-0">
              <select
                id="restaurant-sort"
                aria-label={t('restaurants.sortBy', 'رتّب حسب')}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className={`appearance-none pl-3 pr-8 py-2.5 rounded-xl border text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 ${
                  isDark
                    ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <option value="recommended">{language === 'ar' ? 'موصى به' : 'Recommended'}</option>
                <option value="rating">{language === 'ar' ? 'الأعلى تقييماً' : 'Top Rated'}</option>
                <option value="price-asc">{language === 'ar' ? 'الأرخص أولاً' : 'Price: Low'}</option>
                <option value="price-desc">{language === 'ar' ? 'الأغلى أولاً' : 'Price: High'}</option>
                <option value="reviews">{language === 'ar' ? 'الأكثر تقييماً' : 'Most Reviewed'}</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--text-secondary)]" />
            </div>

            {/* Price band chips */}
            <div className="hidden md:flex items-center gap-1.5">
              {(['Budget ($)', 'Moderate ($$)', 'Premium ($$$)'] as const).map(band => {
                const active = activePriceBands.has(band);
                const symbol = band === 'Budget ($)' ? '$' : band === 'Moderate ($$)' ? '$$' : '$$$';
                return (
                  <button key={band} type="button"
                    onClick={() => {
                      const next = new Set(activePriceBands);
                      if (next.has(band)) next.delete(band); else next.add(band);
                      setActivePriceBands(next);
                      const params = new URLSearchParams(window.location.search);
                      if (next.size === 3) params.delete('price'); else params.set('price', [...next].join(','));
                      window.history.replaceState(null, '', `?${params.toString()}`);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all border ${
                      active
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : isDark
                        ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/40'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-[var(--accent-primary)]/40'
                    }`}>
                    {symbol}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cuisine carousel */}
          <CuisineCategoryCarousel
            language={language as 'en' | 'ar'}
            isDark={isDark}
            activeKey={activeCuisineKey}
            onSelect={handleCategorySelect}
          />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">

        {/* Stats bar */}
        <div className={`flex items-center justify-between mb-5 flex-wrap gap-3`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${ isDark ? 'text-[var(--text-primary)]' : 'text-gray-900' }`}>
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                  {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                </span>
              ) : (
                <span>
                  <span className="text-[var(--accent-primary)] font-black">{sorted.length}</span>{' '}
                  {language === 'ar' ? 'مطعم' : sorted.length === 1 ? 'restaurant' : 'restaurants'}
                  {activeCuisineKey !== 'all' && (
                    <button
                      type="button"
                      onClick={() => handleCategorySelect('all')}
                      className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                      <X className="w-3 h-3" /> {language === 'ar' ? 'مسح الفلتر' : 'Clear filter'}
                    </button>
                  )}
                </span>
              )}
            </span>
            {!isLoading && slugByVenueId.size > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                <Zap className="w-3 h-3" />
                {slugByVenueId.size} {language === 'ar' ? 'يقبلون الطلبات' : 'accepting orders'}
              </span>
            )}
          </div>
        </div>

        {/* Favourites section */}
        {!showAll && (
          <section className="mb-8">
            <h2 className="font-display font-semibold text-xl mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-400" />
              {t('yourFavourites')}
            </h2>
            {favList.length === 0 ? (
              <div className={`py-12 rounded-2xl border text-center text-sm ${
                isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)]' : 'bg-white border-gray-100 text-gray-500'
              }`}>
                {t('noFavouritesYetTap')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favList.map(r => (
                  <RestaurantCard key={r.id} restaurant={r} language={language as 'en' | 'ar'} isDark={isDark}
                    isFav={true} onToggleFav={toggleFav} onViewDetails={viewDetails}
                    isOrderable={slugByVenueId.has(r.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Results grid */}
        <section className="mb-10">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} isDark={isDark} />)}
            </div>
          ) : sorted.length === 0 ? (
            /* Cause-aware empty state: a typed search must not be told to widen
               filters the user never set. */
            <NoResultsState
              cause={searchQuery.trim() ? 'search' : 'filter'}
              query={searchQuery.trim()}
              nounKey="common.noResults.nounRestaurants"
              onClear={() => {
                if (searchQuery.trim()) {
                  setSearchQuery('');
                } else {
                  // Clear every filter, not just the category chip, so the CTA
                  // actually matches its "شيل كل الفلاتر" label.
                  setActivePriceBands(new Set());
                  setActiveCuisines(new Set());
                  handleCategorySelect('all');
                }
              }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ contentVisibility: 'auto' } as React.CSSProperties}>
              {sorted.map(r => (
                <RestaurantCard key={r.id} restaurant={r} language={language as 'en' | 'ar'} isDark={isDark}
                  isFav={favs.has(r.id)} onToggleFav={toggleFav} onViewDetails={viewDetails}
                  isOrderable={slugByVenueId.has(r.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Info note */}
        <div className="mb-12">
          <BeforeYouArriveGuide language={language as 'en' | 'ar'} isDark={isDark} />
        </div>
      </div>

      {/* Restaurant detail page (for venues with a menu) or inline info for venues without a menu */}
      {detailId && (() => {
        const detailRestaurant = restaurants.find(r => r.id === detailId);
        if (!detailRestaurant) return null;
        const slug = slugByVenueId.get(detailRestaurant.id);
        if (slug) {
          // Venue has a menu - the page should be shown via the URL slug
          // This is handled by the useEffect above that redirects via openVenue
          return null;
        }
        // Venue has no menu - show inline info instead of a modal
        return (
          <div className="mx-auto max-w-2xl px-4 py-12 text-center">
            <h2 className="font-display font-semibold text-xl mb-4">
              {language === 'ar' ? detailRestaurant.nameAr : detailRestaurant.name}
            </h2>
            <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              {language === 'ar'
                ? 'هذا المطعم لا يحتوي على قائمة طعام إلكترونية حالياً. يمكنك التواصل معه مباشرة عبر واتساب.'
                : 'This restaurant does not have a digital menu yet. You can contact them directly via WhatsApp.'}
            </p>
            {detailRestaurant.whatsapp && (
              <a
                href={`https://wa.me/${detailRestaurant.whatsapp.replace(/[^0-9+]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                <WhatsAppIcon className="w-5 h-5" />
                {t('restaurants.whatsAppTheRestaurant')}
              </a>
            )}
            <button
              type="button"
              onClick={closeDetails}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        );
      })()}
    </div>
  );
};

export const RestaurantsView: React.FC = () => {
  const { destination } = useDestination();
  if (destination.catalogue === 'early') return <EarlyRestaurantsBrowse />;
  return <LiveRestaurantsView />;
};

export default RestaurantsView;
