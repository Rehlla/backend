import React from 'react';
import { 
  Building, 
  Car, 
  Waves, 
  Compass, 
  Users, 
  Calendar, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  ShieldCheck, 
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';
import { HotelOption, TransferOption, DivingOption, SafariOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';

interface BookingSafariSummarySidebarProps {
  selectedHotel: HotelOption | null;
  selectedTransfer: TransferOption | null;
  selectedDiving: DivingOption | null;
  selectedSafari: SafariOption | null;
  selectedSafariDay: number;
  selectedSafariTime: string;
  onReviewTrip: () => void;
  onBack: () => void;
}

export const BookingSafariSummarySidebar: React.FC<BookingSafariSummarySidebarProps> = ({
  selectedHotel,
  selectedTransfer,
  selectedDiving,
  selectedSafari,
  selectedSafariDay,
  selectedSafariTime,
  onReviewTrip,
  onBack,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const estimatedSafariCost = selectedSafari ? selectedSafari.pricePerPersonEGP * 2 : 0;

  const hotelName = isAr && selectedHotel?.nameAr ? selectedHotel.nameAr : (selectedHotel?.name || (isAr ? 'فندق دهب باي' : 'Dahab Bay Hotel'));
  const hotelRoomType = isAr && selectedHotel?.roomTypeAr ? selectedHotel.roomTypeAr : (selectedHotel?.roomType || (isAr ? 'غرفة مزدوجة قياسية' : 'Standard Double Room'));
  const transferTitle = isAr && selectedTransfer?.titleAr ? selectedTransfer.titleAr : (selectedTransfer?.title || (isAr ? 'سيارة خاصة' : 'Private Car'));
  const divingTitle = isAr && selectedDiving?.titleAr ? selectedDiving.titleAr : (selectedDiving?.title || (isAr ? 'تجربة غطس إرشادي' : 'Guided Diving Experience'));
  const safariTitle = isAr && selectedSafari?.titleAr ? selectedSafari.titleAr : (selectedSafari?.title || (isAr ? 'سفاري الصحراء' : 'Desert Safari'));

  return (
    <div
      id="booking-safari-summary-sidebar"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-sm space-y-6 text-[var(--text-primary)]"
    >
      {/* 1. Header & Progress Badge */}
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[var(--accent-primary)]" />
            <span>{isAr ? 'تم تحديد ٤ من ٤ خدمات' : '4 of 4 trip services selected'}</span>
          </span>
          <span className="text-xs text-[var(--text-secondary)]/50 font-medium">{isAr ? 'الخطوة الأخيرة' : 'Final Step'}</span>
        </div>
        <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)] mt-2">
          {isAr ? 'رحلتك إلى دهب' : 'Your Dahab trip'}
        </h3>
        <p className="text-xs text-[var(--text-secondary)]/60 mt-0.5">
          {isAr ? 'دهب، مصر · ٥ أيام · شخصين بالغين' : 'Dahab, Egypt · 5 days · 2 adults'}
        </p>
      </div>

      {/* 2. Step 01 Saved: Hotel */}
      <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5" />
            <span>{isAr ? '٠١ الفندق' : '01 Hotel'}</span>
          </span>
          <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3 stroke-[2.5]" />
            <span>{isAr ? 'تم الحفظ ✓' : 'Saved ✓'}</span>
          </span>
        </div>
        <div>
          <div className="text-xs font-bold text-[var(--text-primary)]">
            {hotelName}
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]/60">
            {hotelRoomType} · {isAr ? '٥ ليالٍ' : '5 nights'}
          </div>
        </div>
      </div>

      {/* 3. Step 02 Saved: Transfer */}
      <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5" />
            <span>{isAr ? '٠٢ الانتقالات' : '02 Transfer'}</span>
          </span>
          <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3 stroke-[2.5]" />
            <span>{isAr ? 'تم الحفظ ✓' : 'Saved ✓'}</span>
          </span>
        </div>
        <div>
          <div className="text-xs font-bold text-[var(--text-primary)]">
            {transferTitle}
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]/60">
            {isAr ? 'شرم الشيخ ← فندق دهب' : 'Sharm El Sheikh → Dahab Hotel'}
          </div>
        </div>
      </div>

      {/* 4. Step 03 Saved: Diving */}
      <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{isAr ? '٠٣ الغطس' : '03 Diving'}</span>
          </span>
          <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3 stroke-[2.5]" />
            <span>{isAr ? 'تم الحفظ ✓' : 'Saved ✓'}</span>
          </span>
        </div>
        <div>
          <div className="text-xs font-bold text-[var(--text-primary)]">
            {divingTitle}
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]/60">
            {isAr ? 'اليوم ٢ · ٠٩:٠٠ صباحاً · شخصين' : 'Day 2 · 09:00 AM · 2 adults'}
          </div>
        </div>
      </div>

      {/* 5. Step 04 Active: Safari */}
      <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--accent-primary)]/40 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{isAr ? '٠٤ السفاري' : '04 Safari'}</span>
          </span>
          <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded-full">
            {isAr ? 'قيد التحديد' : 'Active selection'}
          </span>
        </div>

        {selectedSafari ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
              <span>{safariTitle}</span>
              <span className="text-sm font-black text-[var(--text-primary)]">
                {estimatedSafariCost.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
              </span>
            </div>

            <div className="space-y-1 text-[12px] text-[var(--text-secondary)]/70">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]/50">{isAr ? 'الموعد' : 'Schedule'}</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {isAr ? `اليوم ${selectedSafariDay} · ${selectedSafariTime}` : `Day ${selectedSafariDay} · ${selectedSafariTime}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]/50">{isAr ? 'المسافرون' : 'Travelers'}</span>
                <span className="font-semibold text-[var(--text-primary)]">{isAr ? 'شخصين بالغين' : '2 adults'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]/50">{isAr ? 'للفرد' : 'Per Person'}</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedSafari.pricePerPersonEGP.toLocaleString()} {isAr ? 'ج.م' : 'EGP'} × 2
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-secondary)]/60 italic py-1">
            {isAr ? 'يرجى اختيار تجربة سفاري' : 'Please choose a safari experience'}
          </div>
        )}
      </div>

      {/* 6. Estimated Safari Cost Box */}
      <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--text-primary)] block">
              {isAr ? 'التكلفة التقديرية للسفاري' : 'Estimated Safari cost'}
            </span>
            <span className="text-[11px] font-semibold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
              {isAr ? 'تقديري' : 'Estimated'}
            </span>
          </div>
          <span className="text-xl font-black text-[var(--text-primary)]">
            {selectedSafari
              ? `${estimatedSafariCost.toLocaleString()} ${isAr ? 'ج.م' : 'EGP'}`
              : '—'}
          </span>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]/50 italic">
          {isAr ? 'سعر إرشادي شامل المسافرين الإثنين.' : 'Sample price shown for demonstration.'}
        </p>
      </div>

      {/* 7. Primary & Secondary CTA Buttons */}
      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          id="review-trip-btn"
          disabled={!selectedSafari}
          onClick={onReviewTrip}
          className={`w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer ${
            selectedSafari
              ? 'bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] active:scale-98'
              : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-not-allowed'
          }`}
        >
          <span>{isAr ? 'مراجعة وتأكيد الرحلة' : 'Review Trip'}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>

        <button
          type="button"
          id="back-to-diving-btn"
          onClick={onBack}
          className="w-full py-2.5 px-4 rounded-full font-bold text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)] border border-[var(--border-subtle)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          <span>{isAr ? 'العودة لاختيار باقة الغطس' : 'Back to Diving Selection'}</span>
        </button>
      </div>
    </div>
  );
};
