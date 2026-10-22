import React from 'react';
import { ChevronRight, MapPin, Bike } from 'lucide-react';
import type { RentalListingView } from '../../shared/types/commerce';
import { useLanguage } from '../../i18n/LanguageContext';

const CATEGORY_LABEL: Record<RentalListingView['category'], { en: string; ar: string }> = {
  'bike': { en: 'Bike', ar: 'دراجة' },
  'e-bike': { en: 'E-bike', ar: 'عجلة كهربائية' },
};

const CATEGORY_ACCENT: Record<RentalListingView['category'], string> = {
  bike: 'var(--accent-secondary)',
  'e-bike': 'var(--accent-secondary)',
};

/**
 * The rental catalogue carries no per-bike photographs (images: []), so the
 * header would render as an empty black box. Category-context photography —
 * the coast roads these bikes actually ride — stands in, with the category
 * badge always visible so it never poses as the exact bike.
 */
const CATEGORY_IMAGE: Record<RentalListingView['category'], string> = {
  bike: '/images/hero/golden-beach.jpg',
  'e-bike': '/images/attractions/mountain-ridge-bay.jpg',
};

interface RentalCardProps {
  rental: RentalListingView;
  isDark: boolean;
  onOpen: (slug: string) => void;
}

export const RentalCard: React.FC<RentalCardProps> = ({ rental, isDark, onOpen }) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const name = isAr && rental.nameAr ? rental.nameAr : rental.name;
  const tagline = isAr && rental.taglineAr ? rental.taglineAr : rental.tagline;
  const supplierName = isAr
    ? rental.supplier?.businessNameAr || rental.supplier?.businessName
    : rental.supplier?.businessName;
  const accent = CATEGORY_ACCENT[rental.category];
  const image = rental.images?.[0] || CATEGORY_IMAGE[rental.category];

  return (
    <button
      type="button"
      onClick={() => onOpen(rental.slug)}
      className={`text-start rounded-3xl border overflow-hidden transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 group w-full cursor-pointer hover:shadow-xl ${
        isDark
          ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
          : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
      }`}
    >
      {/* Header strip */}
      <div className="relative h-52 w-full bg-[var(--surface-container)] flex items-end p-4 overflow-hidden">
        <img
          src={image}
          alt={rental.images?.[0] ? name : `${isAr ? CATEGORY_LABEL[rental.category].ar : CATEGORY_LABEL[rental.category].en} — Dahab coast road`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        <div className="relative z-10 flex items-center justify-between w-full">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: accent, backgroundColor: 'rgba(255,255,255,0.18)' }}
          >
            {isAr ? CATEGORY_LABEL[rental.category].ar : CATEGORY_LABEL[rental.category].en}
          </span>
          {rental.rating != null && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-300 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
              <span className="text-amber-300">★</span>
              {rental.rating.toFixed(1)}
              {rental.reviewCount ? <span className="text-white/70">({rental.reviewCount})</span> : null}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-display font-semibold text-xl leading-snug line-clamp-2 ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
            {name}
          </h3>
          <div className="text-end shrink-0">
            <div className={`text-sm font-black ${isDark ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-primary)]'}`}>
              {rental.dailyRateEGP.toLocaleString()} <span className="text-[10px] font-bold opacity-70">EGP</span>
            </div>
            <div className={`text-[10px] font-semibold ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]/80'}`}>
              {isAr ? '/ اليوم' : '/ day'}
            </div>
          </div>
        </div>

        <p className={`mt-1 text-xs line-clamp-2 ${isDark ? 'text-[var(--text-secondary)]/80' : 'text-[var(--text-secondary)]'}`}>
          {tagline}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            {supplierName && (
              <span className={`flex items-center gap-1 text-[11px] font-semibold ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]/80'}`}>
                <MapPin className="w-3 h-3" />
                {supplierName}
              </span>
            )}
            <span className={`flex items-center gap-1 text-[11px] font-bold ${isDark ? 'text-[var(--accent-secondary)]' : 'text-[var(--accent-secondary)]'}`}>
              {rental.deliveryZones.length > 0 ? (
                <>{isAr ? 'توصيل لمكان إقامتك' : 'Delivery to your stay'}</>
              ) : (
                <>{isAr ? 'استلام من المحل' : 'Pickup from shop'}</>
              )}
            </span>
          </div>
          <span className={`flex items-center gap-0.5 text-xs font-bold transition-transform group-hover:translate-x-0.5 ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]/70'}`}>
            <Bike className="w-3.5 h-3.5" />
            {isAr ? 'العرض' : 'View'}
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </span>
        </div>
      </div>
    </button>
  );
};