import React from 'react';
import { 
  Check, 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Users, 
  BedDouble, 
  ShieldCheck, 
  Sparkles, 
  Lock,
  Compass,
  CheckCircle2,
  Info
} from 'lucide-react';
import { HotelOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';

interface BookingSummarySidebarProps {
  selectedHotel: HotelOption | null;
  onContinue: () => void;
  onViewSelectedHotelDetails?: () => void;
}

export const BookingSummarySidebar: React.FC<BookingSummarySidebarProps> = ({
  selectedHotel,
  onContinue,
  onViewSelectedHotelDetails,
}) => {
  const isSelected = selectedHotel !== null;
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const hotelName = isSelected && isAr && selectedHotel.nameAr ? selectedHotel.nameAr : selectedHotel?.name;
  const hotelNeighborhood = isSelected && isAr && selectedHotel.neighborhoodAr ? selectedHotel.neighborhoodAr : selectedHotel?.neighborhood;
  const hotelRoomType = isSelected && isAr && selectedHotel.roomTypeAr ? selectedHotel.roomTypeAr : selectedHotel?.roomType;

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Primary Trip Booking Summary Card */}
      <div
        id="desktop-booking-summary-card"
        className="rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-md space-y-5 text-[var(--text-primary)]"
      >
        {/* Header Title */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <span className="text-[11px] font-bold text-[var(--accent-primary)] block">
              {isAr ? 'ضمن رحلتك لدهب' : 'Part of your Dahab trip'}
            </span>
            <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)] mt-0.5">
              {isAr ? 'ملخص رحلتك' : 'Your trip'}
            </h3>
          </div>
          <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
            {isAr ? 'دهب' : 'Dahab'}
          </span>
        </div>

        {/* Trip Baseline Specs */}
        <div className="space-y-2.5 text-xs text-[var(--text-secondary)]/80">
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--text-secondary)]/60 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{isAr ? 'المدة' : 'Duration'}</span>
            </span>
            <span className="font-bold text-[var(--text-primary)]">{isAr ? '٥ أيام' : '5 days'}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--text-secondary)]/60 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{isAr ? 'المسافرون' : 'Travelers'}</span>
            </span>
            <span className="font-bold text-[var(--text-primary)]">{isAr ? 'فردين بالغين' : '2 adults'}</span>
          </div>
        </div>

        {/* Selected Component: Hotel Block */}
        <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-secondary)]/60">
              {isAr ? '٠١ الإقامة والفندق' : '01 Accommodation'}
            </span>
            {isSelected ? (
              <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Check className="w-3 h-3 text-[var(--accent-primary)]" />
                {isAr ? 'تم اختيار الفندق ✓' : 'Hotel selected ✓'}
              </span>
            ) : (
              <span className="text-[12px] font-medium text-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 border border-[var(--accent-secondary)]/30 px-2 py-0.5 rounded-full">
                {isAr ? 'لم يتم الاختيار بعد' : 'No hotel selected'}
              </span>
            )}
          </div>

          {isSelected && selectedHotel ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                    {hotelName}
                  </h4>
                  <p className="text-[12px] text-[var(--text-secondary)]/60 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[var(--accent-primary)]" />
                    <span>{hotelNeighborhood}</span>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]/60">{isAr ? 'الغرفة:' : 'Room:'}</span>
                <span className="font-semibold text-[var(--text-primary)] text-start truncate max-w-[170px]">
                  {hotelRoomType}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]/60">{isAr ? 'الإقامة:' : 'Stay:'}</span>
                <span className="font-semibold text-[var(--text-primary)]">{isAr ? '٥ ليالي' : '5 nights'}</span>
              </div>

              {onViewSelectedHotelDetails && (
                <button
                  type="button"
                  onClick={onViewSelectedHotelDetails}
                  className="text-[12px] font-semibold text-[var(--accent-secondary)] hover:underline pt-1 inline-block cursor-pointer"
                >
                  {isAr ? 'عرض تفاصيل الفندق' : 'View stay details'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed font-normal py-1">
              {isAr ? 'اختر أحد الفنادق المرشحة لرحلتك من القائمة للمتابعة.' : 'Choose one of the 3 curated stays on the left that matches your approved 5-day pace.'}
            </p>
          )}
        </div>

        {/* Pricing Subtotal Section */}
        <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)]/60">
              {isAr ? 'إجمالي تكلفة الإقامة' : 'Total Hotel Cost'}
            </span>
            <div className="text-start">
              <span className="text-xl font-black text-[var(--accent-secondary)]">
                {isSelected && selectedHotel ? `${selectedHotel.priceTotalEGP.toLocaleString()} ${isAr ? 'جنيه' : 'EGP'}` : '—'}
              </span>
            </div>
          </div>

          <div className="text-[12px] text-[var(--text-secondary)]/50 flex items-center justify-between">
            <span>{isAr ? '٥ ليالي · فردين' : '5 nights · 2 adults'}</span>
            <span>{isSelected ? (isAr ? 'شامل الضرائب والإفطار' : 'Taxes & breakfast included') : (isAr ? 'في انتظار الاختيار' : 'Pending selection')}</span>
          </div>
        </div>

        {/* Primary Continue CTA */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            id="desktop-sidebar-continue-btn"
            disabled={!isSelected}
            onClick={onContinue}
            className={`w-full inline-flex items-center justify-center gap-2.5 py-4 rounded-full text-sm font-bold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
              isSelected
                ? 'bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] font-bold cursor-pointer active:scale-[0.98]'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <span>{isAr ? 'متابعة الخطوة التالية' : 'Continue'}</span>
            <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          </button>

          {!isSelected && (
            <p className="text-center text-[12px] text-[var(--text-secondary)]/50">
              {isAr ? 'يرجى اختيار الفندق للانتقال للخطوة الثانية' : 'Please select a stay above to proceed to step 02'}
            </p>
          )}
        </div>
      </div>

      {/* Trust & Next Steps Info Box */}
      <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-2.5 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>{isAr ? 'حجز واضح ومضمون' : 'Transparent Dahab Journey'}</span>
        </div>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]/70 font-normal">
          {isAr ? 'أنت تبني خدمات رحلتك خطوة بخطوة. لا يتم سداد أي مبالغ حتى تراجع جميع الخدمات الأربعة معاً.' : 'You are building your trip services step by step. No payment is taken until you review all 4 services together.'}
        </p>

        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-2 text-[12px] text-[var(--accent-primary)] font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{isAr ? 'الخطوة التالية: ٠٢ توصيل المطار الخاص' : 'Next up: 02 Private Airport Transfer'}</span>
        </div>
      </div>
    </div>
  );
};

