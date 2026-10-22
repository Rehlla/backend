import React from 'react';
import { ChevronRight, MapPin, Heart, Star } from 'lucide-react';
import type { AccommodationEntity, PropertyType } from '../../shared/types/commerce';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { formatPrice } from '../../lib/format';

const CATEGORY_LABEL: Record<AccommodationEntity['category'], { en: string; ar: string }> = {
  'budget': { en: 'Budget', ar: 'ميزانية' },
  'mid-range': { en: 'Mid-range', ar: 'متوسط' },
  'boutique': { en: 'Boutique', ar: 'بوتيك' },
  'resort': { en: 'Resort', ar: 'منتجع' },
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, { en: string; ar: string }> = {
  hotel: { en: 'Hotel', ar: 'فندق' },
  hostel: { en: 'Hostel', ar: 'نُزل' },
  apartment: { en: 'Apartment', ar: 'شقة' },
  studio: { en: 'Studio', ar: 'استوديو' },
  villa: { en: 'Villa', ar: 'فيلا' },
  guesthouse: { en: 'Guesthouse', ar: 'بيت ضيافة' },
  camp: { en: 'Camp', ar: 'مخيم' },
  'eco-lodge': { en: 'Eco-lodge', ar: 'نُزل بيئي' },
  'boutique-hotel': { en: 'Boutique hotel', ar: 'فندق بوتيك' },
  resort: { en: 'Resort', ar: 'منتجع' },
  chalet: { en: 'Chalet', ar: 'شاليه' },
};

const BAND_ACCENT: Record<AccommodationEntity['priceBand'], string> = {
  budget: '#7a8c5c',
  moderate: '#c97b3c',
  premium: '#7a6a4a',
};

const HOTEL_IMAGES: Record<string, string> = {
  'jaz-dahabeya': '/images/hotels/le-meridien.jpg',
  'safir-dahab-resort': '/images/hotels/le-meridien-2.jpg',
  'the-bridge-dahab-hotel': '/images/hotels/el-primo.jpg',
  'brother-hotel-dahab': '/images/hotels/ganet-sinai.jpg',
  'dahab-paradise-hotel': '/images/hotels/dahab-paradise.jpg',
  'sheikh-ali-dahab-resort': '/images/hotels/bedouin-moon.jpg',
  'tree-house-hotel-dahab': '/images/hotels/daniela-village.jpg',
  'tropitel-dahab-oasis': '/images/hotels/tropitel-dahab-oasis.jpg',
  'dahab-lagoon-club-resort': '/images/hotels/ibis-styles-lagoon.jpg',
  'swiss-inn-resort-dahab': '/images/hotels/swiss-inn-resort.jpg',
  'penguin-village-dahab': '/images/hotels/ghazala-hotel.jpg',
  'carmine-hotel-dahab': '/images/hotels/red-rock.jpg',
  'golden-europe-hotel': '/images/hotels/sindbad-camp.jpg',
};

const FALLBACK_IMAGE = '/images/hotels/swiss-inn-resort.jpg';

interface AccommodationCardProps {
  accommodation: AccommodationEntity;
  isDark: boolean;
  onOpen: (slug: string) => void;
  /** Larger image, bigger title, room for a longer tagline — used for the
   *  single top-pick slot above the regular grid (see AccommodationsView). */
  featured?: boolean;
}

export const AccommodationCard: React.FC<AccommodationCardProps> = React.memo(({ accommodation, isDark, onOpen, featured = false }) => {
  const { language, t } = useLanguage();
  const { savedItems, toggleSaveItem, navigateTo } = useTrip();
  const isAr = language === 'ar';
  const chipped = isAr ? (accommodation.typeChipsAr?.length ? accommodation.typeChipsAr : accommodation.typeChips) : accommodation.typeChips;
  const image = accommodation.coverImageUrl || HOTEL_IMAGES[accommodation.slug] || FALLBACK_IMAGE;
  const typeLabel = PROPERTY_TYPE_LABEL[accommodation.propertyType];
  const isSaved = savedItems.includes(accommodation.id);
  const isStayLike = accommodation.propertyType === 'hotel' || accommodation.propertyType === 'resort' || accommodation.propertyType === 'boutique-hotel';

  const open = () => onOpen(accommodation.slug);
  const name = isAr ? accommodation.nameAr : accommodation.name;

  return (
    <a
      href={`/hotels/${accommodation.slug}`}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        navigateTo('/hotels', { hotelSlug: accommodation.slug });
      }}
      dir={isAr ? 'rtl' : 'ltr'}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer bg-[var(--surface-card)] border border-[var(--border-subtle)] transition-[border-color,box-shadow,transform] duration-200 hover:border-[var(--accent-primary)]/50 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/40 ${
        featured ? 'sm:flex sm:flex-row' : ''
      }`}
    >
      <div className={`relative overflow-hidden bg-[var(--surface-container)] ${featured ? 'aspect-[16/10] sm:aspect-auto sm:w-[46%] shrink-0' : 'aspect-[4/3] w-full'}`}>
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {featured && (
          <span className={`absolute top-3 ${isAr ? 'right-3' : 'left-3'} text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]`}>
            {isAr ? 'الأعلى تقييمًا' : 'Top pick'}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleSaveItem(accommodation.id); }}
          aria-pressed={isSaved}
          aria-label={isSaved ? (isAr ? 'إزالة من المحفوظات' : 'Remove from saved') : (isAr ? 'حفظ الإقامة' : 'Save stay')}
          className={`absolute z-10 top-2 ${isAr ? 'left-2' : 'right-2'} w-11 h-11 flex items-center justify-center rounded-full transition-[background-color,transform] cursor-pointer active:scale-90 ${
            isSaved
              ? 'bg-[var(--accent-secondary)] text-[var(--accent-secondary-ink)]'
              : 'bg-black/40 text-white hover:bg-black/55 backdrop-blur-sm'
          }`}
        >
          <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className={`p-4 ${featured ? 'sm:p-6 sm:flex sm:flex-col sm:justify-center sm:flex-1' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className={`font-display font-semibold leading-snug line-clamp-2 text-[var(--text-primary)] ${featured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
            {name}
          </h3>
          {accommodation.rating > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-[var(--text-primary)]" aria-label={`${accommodation.rating.toFixed(1)} / 5, ${accommodation.reviewCount} ${isAr ? 'مراجعة' : 'reviews'}`}>
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              {accommodation.rating.toFixed(1)}
            </span>
          )}
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {isAr ? accommodation.areaNameAr : accommodation.areaName}
            {' · '}
            {isAr ? typeLabel.ar : typeLabel.en}
            {' · '}
            {isStayLike
              ? `${accommodation.rooms} ${isAr ? 'غرفة' : 'rooms'}`
              : `${accommodation.maxGuests} ${isAr ? 'ضيوف' : 'guests'}`}
          </span>
        </p>

        {featured && accommodation.tagline && (
          <p className="text-sm mt-3 leading-relaxed line-clamp-3 text-[var(--text-secondary)]">
            {isAr ? accommodation.taglineAr || accommodation.tagline : accommodation.tagline}
          </p>
        )}
        {featured && chipped.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chipped.slice(0, 4).map((c, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--surface-container)] text-[var(--text-secondary)]">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className={`font-bold text-[var(--text-primary)] ${featured ? 'text-lg' : 'text-base'}`}>
                {formatPrice(accommodation.perNightEGP, isAr ? 'ar' : 'en')}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">/ {isAr ? 'الليلة' : 'night'}</span>
            </div>
            {accommodation.packageNights > 1 && (
              <div className="text-[12px] text-[var(--text-secondary)] truncate">
                {isAr ? `باقة ${accommodation.packageNights} ليالٍ` : `${accommodation.packageNights}-night pkg`} · {formatPrice(accommodation.packageTotalEGP, isAr ? 'ar' : 'en')}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); open(); }}
            aria-label={`${t('hotels.viewStay')}: ${name}`}
            className="shrink-0 inline-flex items-center gap-1 px-3.5 min-h-[40px] rounded-xl text-xs font-bold bg-[var(--accent-primary)] text-[var(--surface-container)] transition-[filter,transform] hover:brightness-110 active:scale-95 cursor-pointer"
          >
            {t('hotels.viewStay')}
            <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </a>
  );
});
