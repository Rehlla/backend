import React from 'react';
import { 
  Star, 
  MapPin, 
  Check, 
  Sparkles, 
  Waves, 
  Info, 
  BedDouble, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  Eye
} from 'lucide-react';
import { HotelOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';

interface HotelCardProps {
  hotel: HotelOption;
  isSelected: boolean;
  onSelect: (hotelId: string) => void;
  onViewDetails: (hotel: HotelOption) => void;
}

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  isSelected,
  onSelect,
  onViewDetails,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const hotelName = isAr && hotel.nameAr ? hotel.nameAr : hotel.name;
  const hotelLoc = isAr && hotel.locationAr ? hotel.locationAr : hotel.location;
  const hotelDesc = isAr && hotel.descriptionAr ? hotel.descriptionAr : hotel.description;
  const hotelReason = isAr && hotel.recommendationReasonAr ? hotel.recommendationReasonAr : hotel.recommendationReason;
  const hotelRoomType = isAr && hotel.roomTypeAr ? hotel.roomTypeAr : hotel.roomType;
  const hotelDistance = isAr && hotel.distanceToDivingAr ? hotel.distanceToDivingAr : hotel.distanceToDiving;
  const hotelNeighborhood = isAr && hotel.neighborhoodAr ? hotel.neighborhoodAr : hotel.neighborhood;
  const hotelAmenities = isAr && hotel.amenitiesAr ? hotel.amenitiesAr : hotel.amenities;
  const hotelStatus = isAr && hotel.availabilityStatusAr ? hotel.availabilityStatusAr : hotel.availabilityStatus;

  return (
    <div
      id={`hotel-card-${hotel.id}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 overflow-hidden bg-[var(--surface-card)] text-[var(--text-primary)] ${
        isSelected
          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30 shadow-lg aurora-glow'
          : hotel.isRecommended
          ? 'border-[var(--accent-secondary)]/40 hover:border-[var(--accent-secondary)] shadow-md aurora-hover'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] shadow-md aurora-hover'
      }`}
    >
      {/* Recommended Header Bar */}
      {hotel.isRecommended && (
        <div className="bg-[var(--surface-container)] border-b border-[var(--accent-secondary)]/30 px-5 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-secondary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)] fill-[var(--accent-secondary)]" />
            <span>{isAr ? 'مرشح ومثالي لرحلتك' : 'Recommended for your trip'}</span>
          </div>
          <span className="text-[12px] font-medium text-[var(--accent-secondary)]/80 hidden sm:inline">
            {hotelReason}
          </span>
        </div>
      )}

      {/* Main Card Grid */}
      <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Hotel Image (md:col-span-5) */}
        <div className="md:col-span-5 relative">
          <div className="relative h-52 sm:h-56 md:h-64 w-full rounded-2xl overflow-hidden bg-black/40">
            <img
              src={hotel.image}
              alt={hotelName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            />

            {/* Rating badge — only when there is a measured rating. */}
            {typeof hotel.rating === 'number' && (
            <div className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} bg-black/75 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs border border-[var(--border-subtle)]`}>
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{hotel.rating}</span>
              {typeof hotel.reviewCount === 'number' && (
                <span className="text-[var(--text-muted)] text-[11px] font-normal">({hotel.reviewCount})</span>
              )}
            </div>
            )}

            {/* Selected Status Overlay badge */}
            {isSelected && (
              <div className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-[12px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md animate-in zoom-in-90 duration-150`}>
                <Check className="w-3.5 h-3.5" />
                <span>{isAr ? 'تم الاختيار' : 'Selected'}</span>
              </div>
            )}

            {/* Neighborhood Pill */}
            <div className={`absolute bottom-3 ${isRTL ? 'right-3' : 'left-3'} bg-[var(--surface-card)]/85 backdrop-blur-md text-[var(--text-primary)] text-[12px] font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-[var(--border-subtle)] shadow-xs`}>
              <MapPin className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>{hotelNeighborhood}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Hotel Details & Pricing (md:col-span-7) */}
        <div className="md:col-span-7 flex flex-col justify-between h-full space-y-4">
          <div>
            {/* Title & Location */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)] leading-tight">
                  {hotelName}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]/70 flex items-center gap-1 mt-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{hotelLoc}</span>
                </p>
              </div>

              {/* Mobile quick price indicator */}
              <div className="md:hidden text-start">
                <div className="text-lg font-black text-[var(--accent-secondary)]">
                  {hotel.priceTotalEGP.toLocaleString()} {isAr ? 'جنيه' : 'EGP'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]/60 font-medium">{isAr ? 'إجمالي ٥ ليالي' : 'total for 5 nights'}</div>
              </div>
            </div>

            {/* Short Description */}
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/90 mt-2.5 leading-relaxed font-normal">
              {hotelDesc}
            </p>

            {/* Room Type & Proximity Note */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold">
                <BedDouble className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{hotelRoomType}</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-secondary)]/80 font-medium text-[12px]">
                <Waves className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>{hotelDistance}</span>
              </span>
            </div>

            {/* Key Amenities */}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]/80 flex-wrap">
              <span className="font-semibold text-[var(--text-primary)]">{isAr ? 'المميزات:' : 'Amenities:'}</span>
              <span>{hotelAmenities.slice(0, 4).join(' · ')}</span>
            </div>

            {/* Availability Status */}
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--accent-primary)] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] inline-block animate-pulse" />
              <span>{hotelStatus}</span>
            </div>
          </div>

          {/* Pricing Row & Actions */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Pricing Details */}
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-[var(--accent-secondary)]">
                  {hotel.priceTotalEGP.toLocaleString()} {isAr ? 'جنيه' : 'EGP'}
                </span>
                <span className="text-xs font-bold text-[var(--text-secondary)]/60 tracking-wide">
                  {isAr ? 'الإجمالي' : 'total'}
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)]/70 font-medium">
                {isAr ? '٥ ليالي · فردين' : '5 nights · 2 adults'} <span className="text-[var(--text-muted)]">|</span> {hotel.pricePerNightEGP.toLocaleString()} {isAr ? 'جنيه / الليلة' : 'EGP / night'}
              </div>
            </div>

            {/* Buttons: View details & Select */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                id={`hotel-view-details-btn-${hotel.id}`}
                onClick={() => onViewDetails(hotel)}
                className="px-4 py-2.5 rounded-full text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)] border border-[var(--border-subtle)] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isAr ? 'عرض التفاصيل' : 'View details'}</span>
              </button>

              <button
                type="button"
                id={`hotel-select-btn-${hotel.id}`}
                onClick={() => onSelect(hotel.id)}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] font-bold shadow-lg shadow-[var(--accent-primary)]/20'
                    : 'bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-primary-ink)] font-bold hover:shadow'
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isAr ? 'تم الاختيار ✓' : 'Selected ✓'}</span>
                  </>
                ) : (
                  <span>{isAr ? 'اختيار' : 'Select'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

