import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Star, MapPin, BedDouble, Users, CalendarDays, Info, Sparkles,
  Check, AlertTriangle, SkipBack, Loader2, ExternalLink, Compass
} from 'lucide-react';
import { WhatsAppIcon } from '../common/icons/WhatsAppIcon';
import { CmsImage } from '../common/CmsImage';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { localCalendarDate } from '../../services/heldCheckout';
import { useApiResource } from '../../hooks/useApiResource';
import type { AccommodationEntity, AccommodationDetailResponse, PropertySourceEntity } from '../../shared/types/commerce';
import { PROPERTY_TYPE_LABEL } from './AccommodationCard';
import { StayBookingPanel } from './StayBookingPanel';
import { PropertyReviews } from './PropertyReviews';
import { AccommodationCard } from './AccommodationCard';

const CATEGORY_LABEL: Record<AccommodationEntity['category'], { en: string; ar: string }> = {
  'budget': { en: 'Budget', ar: 'ميزانية' },
  'mid-range': { en: 'Mid-range', ar: 'متوسط' },
  'boutique': { en: 'Boutique', ar: 'بوتيك' },
  'resort': { en: 'Resort', ar: 'منتجع' },
};

const BAND_LABEL: Record<AccommodationEntity['priceBand'], { en: string; ar: string }> = {
  budget: { en: 'Budget stay', ar: 'إقامة اقتصادية' },
  moderate: { en: 'Moderate', ar: 'متوسط' },
  premium: { en: 'Premium', ar: 'فاخر' },
};

const SOURCE_LABEL: Record<PropertySourceEntity['sourceType'], { en: string; ar: string }> = {
  WHATSAPP: { en: 'Message on WhatsApp', ar: 'راسل عبر واتساب' },
  INSTAGRAM: { en: 'Also on Instagram', ar: 'أيضًا على إنستغرام' },
  WEBSITE: { en: 'Visit website', ar: 'زيارة الموقع' },
  BOOKING_COM: { en: 'Also listed on Booking.com', ar: 'مُدرج أيضًا على Booking.com' },
  AIRBNB: { en: 'Also listed on Airbnb', ar: 'مُدرج أيضًا على Airbnb' },
  OTHER: { en: 'More information', ar: 'مزيد من المعلومات' }
};

const HOTEL_GALLERIES: Record<string, string[]> = {
  'jaz-dahabeya': ['/images/hotels/le-meridien.jpg', '/images/hotels/le-meridien-2.jpg', '/images/hero/coral-reef-split.jpg'],
  'safir-dahab-resort': ['/images/hotels/le-meridien-2.jpg', '/images/hotels/tropitel-dahab-oasis-pool.jpg', '/images/hotels/swiss-inn-resort-2.jpg'],
  'the-bridge-dahab-hotel': ['/images/hotels/el-primo.jpg', '/images/restaurants/boho-beach-cafe.jpg', '/images/hero/gulf-sunset.jpg'],
  'brother-hotel-dahab': ['/images/hotels/ganet-sinai.jpg', '/images/hotels/sindbad-camp.jpg', '/images/hero/boho-cafe-dreams.jpg'],
  'dahab-paradise-hotel': ['/images/hotels/dahab-paradise.jpg', '/images/hotels/dahab-paradise-2.jpg', '/images/hotels/dahab-paradise-3.jpg'],
  'sheikh-ali-dahab-resort': ['/images/hotels/bedouin-moon.jpg', '/images/hotels/ghazala-hotel.jpg', '/images/restaurants/breakfast-by-the-sea.jpg'],
  'tree-house-hotel-dahab': ['/images/hotels/daniela-village.jpg', '/images/hotels/daniela-village-2.jpg', '/images/attractions/bouldering-wadi-gnai.jpg'],
  'tropitel-dahab-oasis': ['/images/hotels/tropitel-dahab-oasis.jpg', '/images/hotels/tropitel-dahab-oasis-2.jpg', '/images/hotels/tropitel-dahab-oasis-3.jpg', '/images/hotels/tropitel-dahab-oasis-pool.jpg'],
  'dahab-lagoon-club-resort': ['/images/hotels/ibis-styles-lagoon.jpg', '/images/hotels/ibis-styles-lagoon-2.jpg', '/images/hero/blue-lagoon-kitesurf.jpg'],
  'swiss-inn-resort-dahab': ['/images/hotels/swiss-inn-resort.jpg', '/images/hotels/swiss-inn-resort-2.jpg', '/images/hotels/swiss-inn-resort-3.jpg'],
  'penguin-village-dahab': ['/images/hotels/ghazala-hotel.jpg', '/images/hotels/sindbad-camp.jpg', '/images/restaurants/the-roof-restaurant.jpg'],
  'carmine-hotel-dahab': ['/images/hotels/red-rock.jpg', '/images/hotels/sea-sun-hotel.jpg', '/images/hero/golden-beach.jpg'],
  'golden-europe-hotel': ['/images/hotels/sindbad-camp.jpg', '/images/hotels/bedouin-moon.jpg', '/images/hero/camels-beach.jpg'],
};
const DEFAULT_GALLERY = ['/images/hotels/swiss-inn-resort.jpg', '/images/hotels/swiss-inn-resort-2.jpg', '/images/hero/coral-reef-split.jpg'];

interface AccommodationDetailViewProps {
  accommodationSlug: string;
  onBackToList: () => void;
}

export const AccommodationDetailView: React.FC<AccommodationDetailViewProps> = ({ accommodationSlug, onBackToList }) => {
  const { navigateTo, sessionUser } = useTrip();
  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';

  const detail = useApiResource<AccommodationDetailResponse>(
    useCallback((signal) => api.getAccommodationBySlug(accommodationSlug, signal), [accommodationSlug])
  );
  const accommodation = detail.data?.accommodation ?? null;

  // Dead-link recovery: when the slug doesn't resolve, surface a few live
  // top-rated stays so the visitor still lands somewhere bookable instead
  // of a dead end. Fetched once, only rendered in the not-found branch.
  const similar = useApiResource<import('../../shared/types/commerce').AccommodationCatalogueResponse>(
    useCallback((signal) => api.getAccommodations({ view: 'card' }, signal), [])
  );
  const similarStays = React.useMemo(() => {
    const all = similar.data?.accommodations ?? [];
    return [...all]
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      .slice(0, 4);
  }, [similar.data]);

  // The traveller's local calendar day. `new Date().toISOString().split('T')[0]`
  // is the UTC date, which in Dahab (UTC+2/+3) is still yesterday until
  // 02:00/03:00 — it would offer a check-in date the property cannot take.
  const [checking, setChecking] = useState(false);

  // Long-stay (nomad) pricing — fetched lazily at 28 nights; null when the stay has no monthly/weekly rates.
  const [longStay, setLongStay] = useState<{ savings: { dailyTotalEGP: number; longStayTotalEGP: number; savingsEGP: number; savingsPercent: number } | null; hasLongStayPricing: boolean } | null>(null);
  useEffect(() => {
    if (!accommodation) return;
    let cancelled = false;
    api.getLongStayPrice(accommodation.id, 28).then(data => {
      if (!cancelled && data) setLongStay({ savings: data.savings, hasLongStayPricing: data.hasLongStayPricing });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [accommodation?.id]);

  // The mobile price bar steps aside while the booking panel itself is on
  // screen, so there is never a second, identical Reserve button.
  const [bookingInView, setBookingInView] = useState(false);
  useEffect(() => {
    const target = document.getElementById('book-this-stay');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setBookingInView(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [accommodation?.id]);

  if (detail.status === 'loading' && !accommodation) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`} />
      </div>
    );
  }

  // A failed request is not a missing hotel: on a slow link (or a cold
  // server) the first fetch can time out, and "this stay isn't on the map"
  // sent travellers away from a page that exists.
  if (!accommodation && detail.status === 'error') {
    return (
      <div role="alert" className="max-w-3xl mx-auto px-4 py-14 text-center text-[var(--text-primary)]">
        <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-[var(--text-secondary)]" />
        <h1 className="chart-heading font-bold text-xl mb-2">{t('hotels.detailFailedTitle')}</h1>
        <p className="text-sm mb-6 text-[var(--text-secondary)]">{t('hotels.detailFailedBody')}</p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => detail.reload()}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] text-sm font-bold cursor-pointer"
          >
            {t('hotels.retry')}
          </button>
          <button
            type="button"
            onClick={onBackToList}
            className="px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm font-bold cursor-pointer"
          >
            {t('hotels.backToList')}
          </button>
        </div>
      </div>
    );
  }

  if (!accommodation) {
    return (
      <div className={`max-w-3xl mx-auto px-4 py-14 text-center ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
        <AlertTriangle className={`w-8 h-8 mx-auto mb-4 ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`} />
        <h1 className="chart-heading font-bold text-xl mb-2">{t('hotels.notFoundTitle')}</h1>
        <p className={`text-sm mb-6 ${isDark ? 'text-[var(--text-secondary)]/75' : 'text-[var(--text-secondary)]'}`}>
          {t('hotels.notFoundBody')}
        </p>
        <button
          type="button"
          onClick={onBackToList}
          className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          {t('hotels.backToList')}
        </button>

        {similarStays.length > 0 && (
          <div className="mt-12 text-start">
            <div className="flex items-center gap-2 mb-1">
              <Compass className={`w-5 h-5 ${isDark ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-primary)]'}`} />
              <h2 className="chart-heading font-bold text-lg">{t('hotels.similarTitle')}</h2>
            </div>
            <p className={`text-sm mb-5 ${isDark ? 'text-[var(--text-secondary)]/75' : 'text-[var(--text-secondary)]'}`}>
              {t('hotels.similarBody')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {similarStays.map(a => (
                <AccommodationCard
                  key={a.id}
                  accommodation={a}
                  isDark={isDark}
                  onOpen={(slug) => navigateTo('/hotels', { hotelSlug: slug })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { sku, areaGuide, sources, disclaimer } = detail.data!;
  const pageTitle = isAr ? accommodation.nameAr : accommodation.name;
  // P1-20: the seed data repeats the property type across type, category and tier
  // ("RESORT · RESORT · PREMIUM"). Deduplicate case-insensitively so each badge
  // word appears at most once.
  const chips = Array.from(
    new Set(
      (isAr ? (accommodation.typeChipsAr?.length ? accommodation.typeChipsAr : accommodation.typeChips) : accommodation.typeChips)
        .map(c => c.trim())
        .filter(Boolean)
        .map(c => (isAr ? c : c.toLowerCase()))
    )
  ).map(c => (isAr ? c : c.charAt(0).toUpperCase() + c.slice(1)));
  const amenities = isAr ? (accommodation.amenitiesAr?.length ? accommodation.amenitiesAr : accommodation.amenities) : accommodation.amenities;
  const typeLabel = PROPERTY_TYPE_LABEL[accommodation.propertyType];
  const isRoomBased = accommodation.propertyType === 'hotel' || accommodation.propertyType === 'resort' || accommodation.propertyType === 'boutique-hotel';



  const waNumber = '+201002328005';
  const waBody = encodeURIComponent(t('hotels.planWhatsAppBody', { hotel: accommodation.name }));

  const reasons = accommodation.bestFor
    ? accommodation.bestFor.split(/[.;،]/).map(s => s.trim()).filter(Boolean).slice(0, 5)
    : [];

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
      }`}
    >
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6 flex-1 w-full">
        <button
          type="button"
          onClick={onBackToList}
          className="mb-3 -ms-2 inline-flex items-center gap-1.5 px-2 min-h-[40px] rounded-lg text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          {t('hotels.backToList')}
        </button>
        {(() => {
          // CMS catalog-binding imagery wins when an editor published a cover
          // and/or gallery for this property; the slug-keyed literals below
          // are the compiled fallback (unchanged behavior until then).
          const cmsGallery = accommodation.coverImageUrl
            ? [accommodation.coverImageUrl, ...(accommodation.galleryImageUrls || [])]
            : null;
          const gallery = cmsGallery && cmsGallery.length > 0
            ? cmsGallery
            : (HOTEL_GALLERIES[accommodationSlug] || DEFAULT_GALLERY);
          const focal = accommodation.coverImageFocal;
          const srcSet = accommodation.coverImageSrcSet;
          // A listing with one photo used to show it three times. Only
          // distinct images make the mosaic; otherwise one wide hero.
          const photos = Array.from(new Set(gallery.filter(Boolean)));
          const hero = (
            <CmsImage src={photos[0]} alt={pageTitle} focalX={focal?.x} focalY={focal?.y} srcSet={srcSet} sizes="(max-width: 1024px) 100vw, 66vw" fetchPriority="high" loading="eager" className="w-full h-full object-cover" />
          );
          if (photos.length < 3) {
            return (
              <div className="mb-8 rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[21/9] bg-[var(--surface-card)]">
                {hero}
              </div>
            );
          }
          return (
            <div className="mb-8 grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 rounded-2xl overflow-hidden md:h-[440px]">
              <div className="md:col-span-3 md:row-span-2 aspect-[4/3] md:aspect-auto bg-[var(--surface-card)]">{hero}</div>
              {photos.slice(1, 3).map((src, i) => (
                <div key={src} className="hidden md:block bg-[var(--surface-card)]">
                  <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          );
        })()}

        {/* Desktop: every content section in the left column, the booking
            aside in the right one, sticky for the whole page — no empty gap
            beside a short intro. Mobile keeps the DOM order: intro, booking,
            then the sections. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-12 lg:[&>*:not(aside)]:col-start-1">
          <div className="space-y-2 mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {isAr ? typeLabel.ar : typeLabel.en}
              {' · '}
              {isAr ? CATEGORY_LABEL[accommodation.category].ar : CATEGORY_LABEL[accommodation.category].en}
              {' · '}
              {isAr ? BAND_LABEL[accommodation.priceBand].ar : BAND_LABEL[accommodation.priceBand].en}
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-semibold leading-[1.1] text-balance">{pageTitle}</h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                {accommodation.rating.toFixed(1)}
                <span className={`font-normal ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]/70'}`}>({accommodation.reviewCount})</span>
              </span>
              <span className={`flex items-center gap-1.5 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
                <MapPin className="w-4 h-4" />
                {isAr ? accommodation.areaNameAr : accommodation.areaName}
              </span>
              <span className={`flex items-center gap-1.5 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
                {isRoomBased ? <BedDouble className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {isRoomBased ? `${accommodation.rooms} ${isAr ? 'غرفة' : 'rooms'}` : `${isAr ? 'حتى' : 'up to'} ${accommodation.maxGuests} ${isAr ? 'ضيوف' : 'guests'}`}
              </span>
            </div>

            <p className="pt-2 text-[15px] leading-7 text-[var(--text-secondary)] max-w-prose">
              {isAr ? accommodation.descriptionAr : accommodation.description}
            </p>

          </div>

          <aside id="book-this-stay" className="mb-10 space-y-3 scroll-mt-24 lg:col-start-2 lg:row-start-1 lg:row-span-[24] lg:self-start lg:sticky lg:top-24">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-2xl text-[var(--text-primary)]">
                {accommodation.perNightEGP.toLocaleString()} EGP
              </span>
              <span className={`text-xs ${isDark ? 'text-[var(--text-secondary)]/60' : 'text-[var(--text-secondary)]/70'}`}>/ {isAr ? 'الليلة' : 'night'}</span>
            </div>
            {/* The legacy 5-night package line is deliberately gone: the stay
                engine prices per night from the calendar, and a fixed package
                total next to a nightly total read as three different prices
                for the same room. */}

            {/* Long-stay rate — real savings from the longStayService, shown only when they exist */}
            {longStay?.savings && (
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[var(--surface-container)]/60 border-[var(--accent-primary)]/25' : 'bg-[var(--surface-container)] border-[var(--accent-primary)]/25'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                    {t('hotels.longStayMonth')}
                  </span>
                  <span className="text-sm font-black text-[var(--accent-primary)]">
                    −{longStay.savings.savingsPercent}%
                  </span>
                </div>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]/70'}`}>
                  {(longStay.savings.longStayTotalEGP).toLocaleString()} EGP / {isAr ? 'شهر' : 'month'}
                  {' · '}{t('hotels.longStaySave')} {(longStay.savings.savingsEGP).toLocaleString()} EGP
                </p>
              </div>
            )}


            {/* The real reservation flow: window, party, room type and a live
                quote, reserving through /hotels/checkout with every choice
                intact. It replaces a lone check-in date, a "check availability"
                button that answered nothing, and a CTA that booked for today. */}
            <StayBookingPanel
              accommodationSlug={accommodationSlug}
              fallbackNightlyEGP={accommodation.perNightEGP}
              onReserve={() => undefined}
            />
            <a
              href={`https://wa.me/${waNumber.replace(/[^0-9]/g, '')}?text=${waBody}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-emerald-500 hover:text-emerald-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <WhatsAppIcon className="w-4 h-4 text-emerald-500" />
              {t('hotels.planWithConcierge')}
            </a>

            {/* The seed's catalogue-wide disclaimer names one source; listings
                actually come from four (Tripadvisor, Google, Booking.com,
                Airbnb), so name this listing's own source when it has one. */}
            {(accommodation.ratingSource || disclaimer) && (
              <p className={`text-[10px] leading-relaxed ${isDark ? 'text-[var(--text-secondary)]/50' : 'text-[var(--text-secondary)]/50'}`}>
                {accommodation.ratingSource
                  ? t('hotels.ratingSourceDisclaimer', { source: accommodation.ratingSource })
                  : isAr ? disclaimer!.ar : disclaimer!.en}
              </p>
            )}
          </aside>

        {amenities.length > 0 && (
          <section className="border-t border-[var(--border-subtle)] pt-8 mb-8">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">{isAr ? 'وسائل الراحة' : 'Amenities'}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {amenities.slice(0, 14).map((a, i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] text-[var(--text-primary)]">
                  <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(reasons.length > 0 || accommodation.bestFor) && (
          <section className="border-t border-[var(--border-subtle)] pt-8 mb-8">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">{t('hotels.whyTitle')}</h2>
            {(accommodation.bestFor || accommodation.bestForAr) && (
              <p className="text-[15px] leading-7 text-[var(--text-secondary)] max-w-prose">
                {isAr ? accommodation.bestForAr || accommodation.bestFor : accommodation.bestFor}
              </p>
            )}
            {reasons.length > 1 && (
              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {reasons.slice(1).map((r, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] text-[var(--text-secondary)]">
                    <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-1" aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="border-t border-[var(--border-subtle)] pt-8 mb-8">
        <PropertyReviews
          accommodationSlug={accommodationSlug}
          catalogueRating={accommodation.rating}
          catalogueReviewCount={accommodation.reviewCount}
          catalogueRatingSource={accommodation.ratingSource}
        />
        </div>

        {areaGuide && (
          <section className="border-t border-[var(--border-subtle)] pt-8 mb-8">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">{isAr ? `المنطقة: ${areaGuide.nameAr}` : `The area: ${areaGuide.name}`}</h2>
            <p className="text-[15px] leading-7 text-[var(--text-secondary)] max-w-prose">
              {isAr ? areaGuide.descriptionAr : areaGuide.description}
            </p>
          </section>
        )}

        {accommodation.note && (
          <section className="border-t border-[var(--border-subtle)] pt-8 mb-8">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">{t('hotels.goodToKnow')}</h2>
            <p className="text-[15px] leading-7 text-[var(--text-secondary)] max-w-prose">
              {isAr ? accommodation.noteAr || accommodation.note : accommodation.note}
            </p>
          </section>
        )}

        {sources.length > 0 && (
          <section className="border-t border-[var(--border-subtle)] pt-8 mb-8">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">{isAr ? 'روابط خارجية' : 'Also listed on'}</h2>
            <div className="flex flex-wrap gap-2">
              {sources.map(s => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
                >
                  {s.label || (isAr ? SOURCE_LABEL[s.sourceType].ar : SOURCE_LABEL[s.sourceType].en)}
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]/70 max-w-prose">
              {isAr
                ? 'روابط معلوماتية غير موثّقة تلقائيًا وليست شراكة رسمية — لا تعكس بالضرورة أفضل سعر متاح.'
                : 'Informational links, not automatically verified and not an official partnership — they do not necessarily reflect the best available price.'}
            </p>
          </section>
        )}
        </div>

        <div className="mb-14">
          <button
            type="button"
            onClick={onBackToList}
            className={`inline-flex items-center gap-1.5 text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${isDark ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {t('hotels.backToList')}
          </button>
        </div>
      </main>

      <div inert={bookingInView} className={`lg:hidden fixed inset-x-0 bottom-[calc(var(--dg-tabbar-h,64px)+var(--dg-safe-bottom,0px))] z-30 border-t border-[var(--border-subtle)] bg-[var(--surface-card)]/95 backdrop-blur-md transition-[transform,opacity] duration-200 motion-reduce:transition-none ${bookingInView ? 'translate-y-full opacity-0 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-[var(--text-primary)]">{accommodation.perNightEGP.toLocaleString()} EGP</span>
              <span className="text-xs text-[var(--text-secondary)]">/ {isAr ? 'الليلة' : 'night'}</span>
            </div>
            {accommodation.rating > 0 && (
              <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                {accommodation.rating.toFixed(1)} · {isAr ? accommodation.areaNameAr : accommodation.areaName}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('book-this-stay')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 px-5 min-h-[44px] rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] text-sm font-bold transition-[filter,transform] hover:brightness-110 active:scale-95 cursor-pointer"
          >
            {t('hotels.reserveNow')}
          </button>
        </div>
      </div>
      {/* Room for the bar above so it never covers the last section. */}
      <div className="lg:hidden h-16" aria-hidden="true" />
    </div>
  );
};
