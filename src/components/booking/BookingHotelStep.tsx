import React, { useState, useMemo } from 'react';
import { 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  MapPin, 
  SlidersHorizontal, 
  ShieldCheck, 
  CheckCircle2, 
  Info,
  Calendar,
  Users,
  Wallet,
  Building,
  Car,
  Waves,
  Compass
} from 'lucide-react';
import { CURATED_HOTELS, HotelOption, HotelSortOption } from './bookingData';
import { HotelCard } from './HotelCard';
import { HotelDetailModal } from './HotelDetailModal';
import { BookingSummarySidebar } from './BookingSummarySidebar';
import { useLanguage } from '../../i18n/LanguageContext';

interface BookingHotelStepProps {
  selectedHotelId?: string;
  onSelectHotelId?: (id: string) => void;
  onReturnToItinerary: () => void;
  onReturnHome: () => void;
  onContinueToTransfer?: (hotelId: string) => void;
}

export const BookingHotelStep: React.FC<BookingHotelStepProps> = ({
  selectedHotelId: initialSelectedHotelId,
  onSelectHotelId,
  onReturnToItinerary,
  onReturnHome,
  onContinueToTransfer,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  // Hotel selection state: defaults to recommended hotel for Ahmed's convenience, but can be switched or unselected
  const [internalSelectedHotelId, setInternalSelectedHotelId] = useState<string>(
    initialSelectedHotelId || 'dahab-bay-hotel'
  );
  const selectedHotelId = initialSelectedHotelId !== undefined ? initialSelectedHotelId : internalSelectedHotelId;
  
  // Sorting state: 'recommended' | 'price'
  const [sortBy, setSortBy] = useState<HotelSortOption>('recommended');
  
  // Detail modal state
  const [detailModalHotel, setDetailModalHotel] = useState<HotelOption | null>(null);

  // Step continuation notice state
  const [showNextStepNotice, setShowNextStepNotice] = useState<boolean>(false);

  // Find currently selected hotel object
  const selectedHotel = useMemo(() => {
    return CURATED_HOTELS.find((h) => h.id === selectedHotelId) || null;
  }, [selectedHotelId]);

  // Sorted hotels list
  const sortedHotels = useMemo(() => {
    const list = [...CURATED_HOTELS];
    if (sortBy === 'price') {
      return list.sort((a, b) => a.priceTotalEGP - b.priceTotalEGP);
    }
    // Default 'recommended' (recommended hotel first)
    return list.sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0));
  }, [sortBy]);

  const handleSelectHotel = (hotelId: string) => {
    if (onSelectHotelId) {
      onSelectHotelId(hotelId);
    }
    setInternalSelectedHotelId(hotelId);
  };

  const handleContinue = () => {
    if (!selectedHotel) return;
    if (onContinueToTransfer) {
      onContinueToTransfer(selectedHotelId);
    } else {
      setShowNextStepNotice(true);
    }
  };


  return (
    <div
      id="booking-hotel-screen"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col pb-28 lg:pb-16"
    >
      {/* 1. Global Navigation & Booking Progress Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/95 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Brand & Context Label */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onReturnHome}
              className="text-xl font-black text-[var(--text-primary)] hover:opacity-80 transition-opacity cursor-pointer"
            >
              DAHAB
            </button>
            <span className="text-[var(--text-muted)]">/</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] inline-block shadow-[0_0_8px_var(--accent-primary)]" />
              <span className="text-xs font-bold text-[var(--accent-primary)]">
                {isAr ? 'حجز رحلتك' : 'Booking your trip'}
              </span>
            </div>
          </div>

          {/* Progress Indicator: 01 Hotel → 02 Transfer → 03 Diving → 04 Safari */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 text-xs">
            {/* Step 01: Hotel (ACTIVE) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] font-bold whitespace-nowrap shadow-xs">
              <span className="w-4 h-4 rounded-full bg-[var(--surface-card)]/20 text-[11px] flex items-center justify-center font-bold">
                1
              </span>
              <span>{isAr ? 'الفندق' : 'Hotel'}</span>
            </div>

            <span className={`text-[var(--text-muted)] font-bold ${isRTL ? 'rotate-180' : ''}`}>→</span>

            {/* Step 02: Transfer */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[var(--text-muted)] font-medium whitespace-nowrap">
              <span className="text-[12px] font-bold">02</span>
              <span>{isAr ? 'الانتقالات' : 'Transfer'}</span>
            </div>

            <span className={`text-[var(--text-muted)] font-bold ${isRTL ? 'rotate-180' : ''}`}>→</span>

            {/* Step 03: Diving */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[var(--text-muted)] font-medium whitespace-nowrap">
              <span className="text-[12px] font-bold">03</span>
              <span>{isAr ? 'الغطس' : 'Diving'}</span>
            </div>

            <span className={`text-[var(--text-muted)] font-bold ${isRTL ? 'rotate-180' : ''}`}>→</span>

            {/* Step 04: Safari */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[var(--text-muted)] font-medium whitespace-nowrap">
              <span className="text-[12px] font-bold">04</span>
              <span>{isAr ? 'السفاري' : 'Safari'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Booking Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 flex-1 w-full">
        {/* Back link to Itinerary */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            id="back-to-itinerary-link"
            onClick={onReturnToItinerary}
            className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)] transition-colors py-1 cursor-pointer"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            <span>{isAr ? 'العودة لبرنامج الرحلة المعتمد' : 'Back to approved itinerary'}</span>
          </button>

          <span className="text-xs text-[var(--text-secondary)]/50 hidden sm:inline">
            {isAr ? 'الخطوة ١ من ٤ · اختيار الإقامة' : 'Step 1 of 4 · Accommodation'}
          </span>
        </div>

        {/* Header Block */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
                  {isAr ? 'اختيار مقر الإقامة' : 'Accommodation Selection'}
                </span>
                <span className="text-xs font-semibold text-[var(--text-secondary)]/80 bg-[var(--surface-card)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
                  {isAr ? '٥ أيام · فردين · ميزانية متوازنة' : '5 days · 2 adults · Moderate budget'}
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
                {isAr ? 'اختر مكان إقامتك في دهب' : 'Choose your stay in Dahab'}
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)]/70 mt-1.5 max-w-2xl font-normal">
                {isAr ? 'اخترنا لك أفضل أماكن الإقامة التي تناسب جدول رحلتك وميزانيتك وقربك من الشاطئ.' : 'We found stays that fit your trip, budget, and location.'}
              </p>
            </div>

            {/* Simple Sort Control */}
            <div className="flex items-center gap-2 self-start md:self-auto bg-[var(--surface-card)] p-1.5 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
              <span className="text-xs font-semibold text-[var(--text-secondary)]/60 px-2">
                {isAr ? 'ترتيب حسب:' : 'Sort by:'}
              </span>
              <button
                type="button"
                onClick={() => setSortBy('recommended')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  sortBy === 'recommended'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)]'
                }`}
              >
                {isAr ? 'الموصى به' : 'Recommended'}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('price')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  sortBy === 'price'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)]'
                }`}
              >
                {isAr ? 'السعر' : 'Price'}
              </button>
              {/* Removed: a "sort by rating" control ordering hotels by an
                  invented 4.5–4.8 that was written into the data file. Sorting
                  by a number nobody measured is not a feature. */}
            </div>
          </div>
        </div>

        {/* Two-Column Booking Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Stays Options Area (8 Columns on desktop) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Curated Stays Count & Framing Banner */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                <span className="font-bold text-[var(--text-primary)]">
                  {isAr ? '٣ فنادق مختارة بعناية تتوافق مع خطة رحلتك المعتمدة' : '3 curated hotel options matching your approved itinerary'}
                </span>
              </div>
              <span className="text-[var(--text-secondary)]/60 font-normal">
                {isAr ? 'جميع الأسعار لـ ٥ ليالي لفردين شاملة الضرائب' : 'All prices include 5 nights for 2 adults'}
              </span>
            </div>

            {/* Hotel Cards List */}
            <div className="space-y-6">
              {sortedHotels.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  isSelected={selectedHotelId === hotel.id}
                  onSelect={handleSelectHotel}
                  onViewDetails={(h) => setDetailModalHotel(h)}
                />
              ))}
            </div>

            {/* Context Note on Dahab Hospitality */}
            <div className="p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-secondary)]/90 space-y-2">
              <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'لماذا ٣ خيارات فندقية فقط؟' : 'Why only 3 curated stays?'}</span>
              </h4>
              <p className="leading-relaxed font-normal text-xs text-[var(--text-secondary)]/70">
                {isAr ? 'بدلاً من تشتيتك بمئات العروض، قمنا بفرز وترشيح الفنادق الأنسب لجدول رحلتك وموقع الغطس باللايتهاوس والغرف المريحة لفردين.' : 'Instead of overwhelming you with endless listings, our Dahab platform specifically filtered accommodations matching your 5-day schedule, proximity to Lighthouse dive sites, and friend-friendly double/twin configurations.'}
              </p>
            </div>
          </div>

          {/* Desktop Sticky Summary Sidebar (4 Columns) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-24">
            <BookingSummarySidebar
              selectedHotel={selectedHotel}
              onContinue={handleContinue}
              onViewSelectedHotelDetails={() => {
                if (selectedHotel) setDetailModalHotel(selectedHotel);
              }}
            />
          </div>
        </div>
      </main>

      {/* 3. Mobile Sticky Bottom Action / Summary Bar */}
      <div
        id="mobile-hotel-bottom-bar"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] p-3.5 sm:p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[var(--accent-primary)] block truncate">
              {selectedHotel ? (isAr ? 'تم اختيار الفندق ✓' : 'Hotel selected ✓') : (isAr ? 'لم يتم الاختيار' : 'No hotel selected')}
            </span>
            <div className="text-sm font-bold text-[var(--text-primary)] truncate">
              {selectedHotel ? (isAr && selectedHotel.nameAr ? selectedHotel.nameAr : selectedHotel.name) : (isAr ? 'اختر فندقك من الأعلى' : 'Select a stay above')}
            </div>
            <div className="text-xs font-semibold text-[var(--text-secondary)]/70">
              {selectedHotel ? `${selectedHotel.priceTotalEGP.toLocaleString()} ${isAr ? 'جنيه إجمالي' : 'EGP total'}` : (isAr ? '٥ ليالي' : '5 nights')}
            </div>
          </div>

          <button
            type="button"
            id="mobile-continue-hotel-btn"
            disabled={!selectedHotel}
            onClick={handleContinue}
            className={`inline-flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-full text-xs font-bold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] whitespace-nowrap ${
              selectedHotel
                ? 'bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] font-bold cursor-pointer active:scale-95'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <span>{isAr ? 'متابعة' : 'Continue'}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Hotel Detail Modal */}
      <HotelDetailModal
        hotel={detailModalHotel}
        isSelected={detailModalHotel ? selectedHotelId === detailModalHotel.id : false}
        onSelect={handleSelectHotel}
        onClose={() => setDetailModalHotel(null)}
      />

      {/* 5. Next Step Notice Dialog (Seamless flow to future step 02) */}
      {showNextStepNotice && selectedHotel && (
        <div
          id="next-step-notice-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="next-step-notice-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNextStepNotice(false);
          }}
        >
          <div className="bg-[var(--surface-card)] text-[var(--text-primary)] w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-[var(--border-subtle)] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
                {isAr ? 'تم حفظ اختيار الفندق' : 'Stay Selected & Saved'}
              </span>
              <h3 id="next-step-notice-modal-title" className="text-xl chart-heading font-bold text-[var(--text-primary)] pt-1">
                {isAr && selectedHotel.nameAr ? selectedHotel.nameAr : selectedHotel.name}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]/70">
                {isAr && selectedHotel.roomTypeAr ? selectedHotel.roomTypeAr : selectedHotel.roomType} · {isAr ? '٥ ليالي' : '5 nights'} ({selectedHotel.priceTotalEGP.toLocaleString()} {isAr ? 'جنيه' : 'EGP'})
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-start text-xs space-y-2">
              <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Car className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'الخطوة التالية: ٠٢ توصيل المطار الخاص' : 'Next: 02 Private Airport Transfer'}</span>
              </div>
              <p className="text-[var(--text-secondary)]/70 leading-relaxed text-[12px]">
                {isAr ? 'تم حفظ فندقك ضمن خطة رحلتك لدهب. في الخطوة التالية سنقوم بضبط وتأكيد سيارة الاستقبال والتوصيل من مطار شرم الشيخ (SSH).' : 'Your hotel selection is saved as part of your 5-day Dahab trip. In the next step, we will configure your Sharm El Sheikh (SSH) airport pickup & return transfer.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowNextStepNotice(false)}
                className="w-full py-3 rounded-full text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                {isAr ? 'تغيير الفندق' : 'Change stay'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNextStepNotice(false);
                  if (onContinueToTransfer) {
                    onContinueToTransfer(selectedHotelId);
                  }
                }}
                className="w-full py-3 rounded-full text-xs font-bold text-[var(--accent-primary-ink)] bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                {isAr ? 'فهمت، تابع' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

