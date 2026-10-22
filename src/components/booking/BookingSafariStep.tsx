import React, { useState } from 'react';
import { 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Building, 
  Car, 
  Waves, 
  Compass, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldCheck 
} from 'lucide-react';
import { 
  CURATED_SAFARI_OPTIONS, 
  SafariOption, 
  HotelOption, 
  TransferOption, 
  DivingOption 
} from './bookingData';
import { SafariOptionCard } from './SafariOptionCard';
import { SafariDetailModal } from './SafariDetailModal';
import { SafariDayScheduler } from './SafariDayScheduler';
import { BookingSafariSummarySidebar } from './BookingSafariSummarySidebar';
import { useLanguage } from '../../i18n/LanguageContext';

interface BookingSafariStepProps {
  selectedHotel: HotelOption | null;
  selectedTransfer: TransferOption | null;
  selectedDiving: DivingOption | null;
  selectedSafariId: string;
  onSelectSafariId: (id: string) => void;
  selectedSafariDay: number;
  onSelectSafariDay: (day: number) => void;
  selectedSafariTime: string;
  onSelectSafariTime: (time: string) => void;
  onBackToDiving: () => void;
  onContinueToReview?: () => void;
}

export const BookingSafariStep: React.FC<BookingSafariStepProps> = ({
  selectedHotel,
  selectedTransfer,
  selectedDiving,
  selectedSafariId,
  onSelectSafariId,
  selectedSafariDay,
  onSelectSafariDay,
  selectedSafariTime,
  onSelectSafariTime,
  onBackToDiving,
  onContinueToReview,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const [activeDetailSafari, setActiveDetailSafari] = useState<SafariOption | null>(null);
  const [showReviewPromptModal, setShowReviewPromptModal] = useState<boolean>(false);

  // Selected safari object
  const currentSelectedSafari =
    CURATED_SAFARI_OPTIONS.find((s) => s.id === selectedSafariId) ||
    CURATED_SAFARI_OPTIONS[0];

  const currentSafariTitle = isAr && currentSelectedSafari?.titleAr ? currentSelectedSafari.titleAr : currentSelectedSafari?.title;
  const hotelDisplayName = isAr && selectedHotel?.nameAr ? selectedHotel.nameAr : (selectedHotel?.name || (isAr ? 'فندق دهب باي' : 'Dahab Bay Hotel'));
  const transferDisplayName = isAr && selectedTransfer?.titleAr ? selectedTransfer.titleAr : (selectedTransfer?.title || (isAr ? 'سيارة خاصة' : 'Private Car'));
  const divingDisplayName = isAr && selectedDiving?.titleAr ? selectedDiving.titleAr : (selectedDiving?.title || (isAr ? 'غطس إرشادي' : 'Guided Diving'));

  const handleReviewClick = () => {
    if (onContinueToReview) {
      onContinueToReview();
    } else {
      setShowReviewPromptModal(true);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] pb-24 lg:pb-16">
      {/* 1. TOP DAHAB BRANDING & PROGRESS BAR */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] flex items-center justify-center font-bold text-sm">
              {isAr ? 'د' : 'D'}
            </div>
            <div>
              <span className="text-xs font-black text-[var(--accent-primary)] block">
                {isAr ? 'دهب' : 'DAHAB'}
              </span>
              <h1 className="text-sm font-bold text-[var(--text-primary)]">
                {isAr ? 'تأكيد وحجز خدمات رحلتك' : 'Booking your trip'}
              </h1>
            </div>
          </div>

          {/* Progress Indicator: 01 Hotel ✓, 02 Transfer ✓, 03 Diving ✓, 04 Safari (Active) */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1 text-xs">
            {/* Step 01 */}
            <div className="flex items-center gap-1.5 text-[var(--accent-primary)] font-bold bg-[var(--surface-container)] px-2.5 py-1 rounded-full border border-[var(--accent-primary)]/30 flex-shrink-0">
              <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] flex items-center justify-center text-[11px]">
                ✓
              </span>
              <span>{isAr ? '٠١ الفندق' : '01 Hotel'}</span>
            </div>

            <div className="w-3 h-px bg-[var(--accent-primary)]/40 flex-shrink-0" />

            {/* Step 02 */}
            <div className="flex items-center gap-1.5 text-[var(--accent-primary)] font-bold bg-[var(--surface-container)] px-2.5 py-1 rounded-full border border-[var(--accent-primary)]/30 flex-shrink-0">
              <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] flex items-center justify-center text-[11px]">
                ✓
              </span>
              <span>{isAr ? '٠٢ الانتقالات' : '02 Transfer'}</span>
            </div>

            <div className="w-3 h-px bg-[var(--accent-primary)]/40 flex-shrink-0" />

            {/* Step 03 */}
            <div className="flex items-center gap-1.5 text-[var(--accent-primary)] font-bold bg-[var(--surface-container)] px-2.5 py-1 rounded-full border border-[var(--accent-primary)]/30 flex-shrink-0">
              <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] flex items-center justify-center text-[11px]">
                ✓
              </span>
              <span>{isAr ? '٠٣ الغطس' : '03 Diving'}</span>
            </div>

            <div className="w-3 h-px bg-[var(--accent-primary)] flex-shrink-0" />

            {/* Step 04 (Active) */}
            <div className="flex items-center gap-1.5 text-[var(--accent-primary-ink)] font-bold bg-[var(--accent-primary)] px-3 py-1 rounded-full border border-[var(--accent-primary)] flex-shrink-0 shadow-xs">
              <span className="w-4 h-4 rounded-full bg-[var(--surface-card)] text-[var(--accent-primary)] flex items-center justify-center text-[11px]">
                {isAr ? '٤' : '4'}
              </span>
              <span>{isAr ? '٠٤ السفاري' : '04 Safari'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb / Back Button */}
        <div className="mb-6">
          <button
            type="button"
            id="top-back-to-diving-btn"
            onClick={onBackToDiving}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-[var(--surface-card)] px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>{isAr ? 'العودة لاختيار باقة الغطس' : 'Back to Diving Selection'}</span>
          </button>
        </div>

        {/* Hero Section */}
        <div className="mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] text-xs font-bold border border-[var(--accent-secondary)]/40 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>{isAr ? 'موصى به لرحلتك المنسقة' : 'Recommended for your trip'}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl chart-heading font-bold text-[var(--text-primary)] tracking-tight">
            {isAr ? 'أضف مغامرة صحراوية ساحرة لرحلتك في دهب.' : 'Add an adventure to your Dahab trip.'}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)]/70 max-w-3xl leading-relaxed">
            {isAr
              ? 'اخترنا باقات سفاري تناسب أسلوب سفرك وتوقيتات رحلتك. اكتشف سحر أودية جنوب سيناء والوديان الصخرية وتأمل أروع مشاهد الغروب الذهبي.'
              : 'We found safari options that fit your travel style and schedule. Discover the majestic South Sinai desert valleys, sandstone canyons, and golden sunset viewpoints.'}
          </p>
        </div>

        {/* 2-Column Responsive Layout: Left = Safari Cards + Scheduler, Right = Sticky Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Safari List & Scheduling (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Safari Options Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                  {isAr ? 'تجارب السفاري المنتقاة' : 'Curated Safari Experiences'}
                </h3>
                <span className="text-xs text-[var(--text-secondary)]/60 font-medium">
                  {isAr ? '٣ مغامرات محلية معتمدة' : '3 verified local adventures'}
                </span>
              </div>

              <div className="space-y-5">
                {CURATED_SAFARI_OPTIONS.map((safari) => (
                  <SafariOptionCard
                    key={safari.id}
                    safari={safari}
                    isSelected={safari.id === selectedSafariId}
                    onSelect={(id) => onSelectSafariId(id)}
                    onViewDetails={(s) => setActiveDetailSafari(s)}
                  />
                ))}
              </div>
            </div>

            {/* When would you like to go? (Day Scheduler & Schedule Preview) */}
            <SafariDayScheduler
              selectedDay={selectedSafariDay}
              onSelectDay={(day) => onSelectSafariDay(day)}
              selectedTime={selectedSafariTime}
              divingDay={2}
            />
          </div>

          {/* Right Column: Sticky Summary Sidebar (lg:col-span-4) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-20">
            <BookingSafariSummarySidebar
              selectedHotel={selectedHotel}
              selectedTransfer={selectedTransfer}
              selectedDiving={selectedDiving}
              selectedSafari={currentSelectedSafari}
              selectedSafariDay={selectedSafariDay}
              selectedSafariTime={selectedSafariTime}
              onReviewTrip={handleReviewClick}
              onBack={onBackToDiving}
            />
          </div>
        </div>
      </main>

      {/* 3. MOBILE FIXED BOTTOM ACTION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] p-4 shadow-lg flex items-center justify-between gap-4">
        <div>
          <div className="text-[12px] font-bold text-[var(--accent-primary)]">
            {isAr ? 'تم اختيار ٤/٤ خدمات' : '4/4 Services Selected'}
          </div>
          <div className="text-base font-black text-[var(--text-primary)]">
            {currentSafariTitle}
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]/60 font-medium">
            {isAr
              ? `اليوم ${selectedSafariDay} · ${selectedSafariTime} · تقديري ${(currentSelectedSafari.pricePerPersonEGP * 2).toLocaleString()} ج.م`
              : `Day ${selectedSafariDay} · ${selectedSafariTime} · Est. EGP ${(currentSelectedSafari.pricePerPersonEGP * 2).toLocaleString()}`}
          </div>
        </div>

        <button
          type="button"
          id="mobile-review-trip-btn"
          onClick={handleReviewClick}
          className="px-6 py-3 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md flex items-center gap-1.5 cursor-pointer flex-shrink-0"
        >
          <span>{isAr ? 'مراجعة الرحلة' : 'Review Trip'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>

      {/* 4. DETAIL MODAL */}
      {activeDetailSafari && (
        <SafariDetailModal
          safari={activeDetailSafari}
          isSelected={activeDetailSafari.id === selectedSafariId}
          onSelect={(id) => onSelectSafariId(id)}
          onClose={() => setActiveDetailSafari(null)}
        />
      )}

      {/* 5. CONFIRMATION / REVIEW MODAL PREVIEW */}
      {showReviewPromptModal && (
        <div
          id="review-trip-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-trip-preview-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReviewPromptModal(false);
          }}
        >
          <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[var(--border-subtle)] space-y-6 text-[var(--text-primary)]">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 id="review-trip-preview-modal-title" className="text-2xl chart-heading font-bold text-[var(--text-primary)]">
                {isAr ? 'خدمات رحلتك جاهزة للمراجعة' : 'Your trip services are ready'}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]/70">
                {isAr ? 'تم تنسيق الفندق، الانتقالات، الغطس، والسفاري بنجاح.' : 'Hotel, transfer, diving, and safari are ready to review.'}
              </p>
            </div>

            {/* Summary List */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="font-bold flex items-center gap-1.5 text-[var(--accent-primary)]">
                  <Building className="w-3.5 h-3.5" />
                  <span>{isAr ? '٠١ الفندق' : '01 Hotel'}</span>
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {hotelDisplayName}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="font-bold flex items-center gap-1.5 text-[var(--accent-primary)]">
                  <Car className="w-3.5 h-3.5" />
                  <span>{isAr ? '٠٢ الانتقالات' : '02 Transfer'}</span>
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {transferDisplayName}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="font-bold flex items-center gap-1.5 text-[var(--accent-primary)]">
                  <Waves className="w-3.5 h-3.5" />
                  <span>{isAr ? '٠٣ الغطس' : '03 Diving'}</span>
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {divingDisplayName} ({isAr ? 'اليوم ٢' : 'Day 2'})
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="font-bold flex items-center gap-1.5 text-[var(--accent-primary)]">
                  <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{isAr ? '٠٤ السفاري' : '04 Safari'}</span>
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {currentSafariTitle} ({isAr ? `اليوم ${selectedSafariDay}` : `Day ${selectedSafariDay}`})
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                type="button"
                id="modal-close-confirm-btn"
                onClick={() => setShowReviewPromptModal(false)}
                className="w-full py-3.5 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] font-bold text-xs sm:text-sm transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer"
              >
                {isAr ? 'تم تحديد كافة الخدمات الـ ٤ بنجاح ✓' : 'All 4 Services Configured ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
