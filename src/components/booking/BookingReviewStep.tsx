import React, { useState } from 'react';
import {
  Building,
  Car,
  Waves,
  Compass,
  Check,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Info,
  Loader2,
  AlertCircle,
  FileText,
  User,
  Users,
  SunMedium,
  Plane,
  ChevronRight
} from 'lucide-react';
import {
  HotelOption,
  TransferOption,
  DivingOption,
  SafariOption
} from './bookingData';
import { BookingReviewTermsModal } from './BookingReviewTermsModal';
import { useLanguage } from '../../i18n/LanguageContext';
import { IMG_P154455176346a013bb70d5_HERO } from '../../shared/placeholderImagery';

interface BookingReviewStepProps {
  selectedHotel: HotelOption | null;
  selectedTransfer: TransferOption | null;
  selectedDiving: DivingOption | null;
  selectedSafari: SafariOption | null;
  flightNumber?: string;
  divingDay?: number;
  divingTime?: string;
  safariDay?: number;
  safariTime?: string;
  onEditHotel: () => void;
  onEditTransfer: () => void;
  onEditDiving: () => void;
  onEditSafari: () => void;
  onBackToSafari: () => void;
  onContinueToPayment?: () => void;
}

export const BookingReviewStep: React.FC<BookingReviewStepProps> = ({
  selectedHotel,
  selectedTransfer,
  selectedDiving,
  selectedSafari,
  flightNumber = '',
  divingDay = 2,
  divingTime = '09:00 AM',
  safariDay = 3,
  safariTime = '02:00 PM',
  onEditHotel,
  onEditTransfer,
  onEditDiving,
  onEditSafari,
  onBackToSafari,
  onContinueToPayment,
}) => {
  const { language, isRTL, t } = useLanguage();
  const isAr = language === 'ar';

  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPreparedForPayment, setIsPreparedForPayment] = useState<boolean>(false);

  // Price calculations
  const hotelPrice = selectedHotel ? selectedHotel.priceTotalEGP : 7500;
  const transferPrice = selectedTransfer ? selectedTransfer.priceEGP : 1200;
  const divingPrice = selectedDiving ? selectedDiving.pricePerPersonEGP * 2 : 3000;
  const safariPrice = selectedSafari ? selectedSafari.pricePerPersonEGP * 2 : 2800;
  const totalEstimatedPrice = hotelPrice + transferPrice + divingPrice + safariPrice;

  // Handle "Confirm & Continue"
  const handleConfirmAndContinue = () => {
    if (!agreedToTerms || isProcessing) return;

    setIsProcessing(true);

    // Transition smoothly to the Payment stage
    setTimeout(() => {
      setIsProcessing(false);
      if (onContinueToPayment) {
        onContinueToPayment();
      } else {
        setIsPreparedForPayment(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 1200);
  };

  // Localized Titles
  const hotelName = isAr && selectedHotel?.nameAr ? selectedHotel.nameAr : (selectedHotel?.name || (isAr ? 'فندق خليج دهب' : 'Dahab Bay Hotel'));
  const hotelLocation = isAr && selectedHotel?.locationAr ? selectedHotel.locationAr : (selectedHotel?.location || (isAr ? 'منطقة اللايت هاوس، دهب' : 'Lighthouse Area, Dahab'));
  const hotelRoomType = isAr && selectedHotel?.roomTypeAr ? selectedHotel.roomTypeAr : (selectedHotel?.roomType || (isAr ? 'غرفة مزدوجة قياسية' : 'Standard Double Room'));

  const transferTitle = isAr && selectedTransfer?.titleAr ? selectedTransfer.titleAr : (selectedTransfer?.title || (isAr ? 'سيارة خاصة' : 'Private Car'));
  
  const divingTitle = isAr && selectedDiving?.titleAr ? selectedDiving.titleAr : (selectedDiving?.title || (isAr ? 'تجربة غطس إرشادية' : 'Guided Diving Experience'));
  
  const safariTitle = isAr && selectedSafari?.titleAr ? selectedSafari.titleAr : (selectedSafari?.title || (isAr ? 'سفاري وادي جني والصحراء' : 'Desert Safari'));

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] pb-28 lg:pb-16">
      {/* 1. TOP DAHAB BRANDING & PROGRESS BAR */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--surface-container)] text-white flex items-center justify-center font-bold text-sm">
              {isAr ? 'د' : 'D'}
            </div>
            <div>
              <span className="text-xs font-black text-[var(--text-secondary)] block">
                {isAr ? 'دهب' : 'DAHAB'}
              </span>
              <h1 className="text-sm font-bold text-[var(--text-primary)]">
                {isAr ? 'مراجعة رحلتك' : 'Review your trip'}
              </h1>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1 text-xs">
            {/* Step 01 */}
            <button
              type="button"
              onClick={onEditHotel}
              className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">
                ✓
              </span>
              <span>{isAr ? '٠١ الفندق' : '01 Hotel'}</span>
            </button>

            <div className="w-2.5 h-px bg-emerald-400 flex-shrink-0" />

            {/* Step 02 */}
            <button
              type="button"
              onClick={onEditTransfer}
              className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">
                ✓
              </span>
              <span>{isAr ? '٠٢ الانتقالات' : '02 Transfer'}</span>
            </button>

            <div className="w-2.5 h-px bg-emerald-400 flex-shrink-0" />

            {/* Step 03 */}
            <button
              type="button"
              onClick={onEditDiving}
              className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">
                ✓
              </span>
              <span>{isAr ? '٠٣ الغطس' : '03 Diving'}</span>
            </button>

            <div className="w-2.5 h-px bg-emerald-400 flex-shrink-0" />

            {/* Step 04 */}
            <button
              type="button"
              onClick={onEditSafari}
              className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0 transition-colors cursor-pointer"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px]">
                ✓
              </span>
              <span>{isAr ? '٠٤ السفاري' : '04 Safari'}</span>
            </button>

            <div className="w-2.5 h-px bg-[var(--surface-container)] flex-shrink-0" />

            {/* Review Step (Active) */}
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold bg-[var(--surface-container)]/10 px-3 py-1 rounded-full border border-[var(--text-secondary)]/30 flex-shrink-0 ring-1 ring-[var(--text-secondary)]/20">
              <Sparkles className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>{isAr ? 'المراجعة' : 'Review'}</span>
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
            id="back-to-safari-btn"
            onClick={onBackToSafari}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-[var(--surface-card)] px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>{isAr ? 'العودة لاختيار السفاري' : 'Back to Safari Selection'}</span>
          </button>
        </div>

        {/* Page Heading & Status */}
        <div className="mb-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] text-xs font-bold border border-[var(--accent-primary)]/30 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{isAr ? 'جاهز للحجز' : 'Ready to book'}</span>
            </span>
            <span className="text-xs text-[var(--text-primary)]/60 font-semibold">
              {isAr ? 'الخطوة ٥ من ٥ · المراجعة النهائية' : 'Step 5 of 5 · Final Verification'}
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl chart-heading font-bold text-[var(--text-primary)] tracking-tight">
            {isAr ? 'هل كل شيء جاهز وعلى ما يرام؟' : 'Everything looks good?'}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-primary)]/70 max-w-3xl leading-relaxed">
            {isAr
              ? 'راجع تفاصيل رحلتك وخدماتك المنسقة قبل الانتقال إلى تأكيد الحجز.'
              : 'Review your trip details before we confirm your bookings.'}
          </p>
        </div>

        {/* POST-PROCESSING NOTICE: Stage Ready for Final Payment */}
        {isPreparedForPayment && (
          <div
            id="prepared-for-payment-banner"
            className="mb-8 p-6 sm:p-7 rounded-3xl bg-[var(--surface-card)] border-2 border-[var(--accent-primary)]/40 text-[var(--text-primary)] shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200 aurora-glow"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
                  {isAr ? 'تم التحقق من التوافر وتجهيز الحجوزات' : 'Availability Checked & Bookings Prepared'}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                  {isAr
                    ? 'تم تنسيق إقامتك الفندقية وانتقالات المطار ورحلة الغطس وسفاري الصحراء معاً. نحن مستعدون للانتقال لخطوة الدفع وتأكيد الحجز النهائي.'
                    : 'Your hotel stay, airport transfer, guided diving session, and desert safari have been coordinated. We are ready to proceed to the final Payment & Booking Confirmation stage.'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold text-[var(--text-primary)] block">
                  {isAr ? 'المرحلة التالية: الدفع الآمن واستلام وثيقة الرحلة' : 'Next stage: Secure Payment & Itinerary Handover'}
                </span>
                <span className="text-[var(--text-primary)]/60 text-[12px]">
                  {isAr
                    ? 'لم يتم خصم أي مبالغ حتى الآن. اختيار طريقة الدفع يتم في الخطوة التالية.'
                    : 'No charges have been placed yet. Payment method selection will be completed in the next stage.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreparedForPayment(false)}
                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 self-start sm:self-auto cursor-pointer"
              >
                {isAr ? 'تعديل اختيارات الرحلة' : 'Modify Trip Selections'}
              </button>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* 1. TRIP OVERVIEW HERO CARD */}
            <div
              id="trip-overview-hero"
              className="rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-xs relative"
            >
              <div className="relative h-56 sm:h-64 w-full bg-[var(--surface-container)]/10">
                <img
                  src={IMG_P154455176346a013bb70d5_HERO}
                  alt="Dahab coastal mountains and Red Sea turquoise waters"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />

                {/* Top Location & Traveler Badge */}
                <div className="absolute top-4 start-4 flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-[var(--btn-util-bg)] backdrop-blur-md text-[var(--text-primary)] text-xs font-black tracking-wide shadow-2xs">
                    {isAr ? 'دهب' : 'Dahab'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isAr ? '٥ أيام · فردين بالغين' : '5 Days · 2 Adults'}</span>
                  </span>
                </div>

                {/* Bottom Content & Tags */}
                <div className={`absolute bottom-4 ${isRTL ? 'right-4 left-4' : 'left-4 right-4'} text-white space-y-2`}>
                  <div>
                    <h3 className="text-2xl sm:text-3xl chart-heading font-bold tracking-tight">
                      {isAr ? 'دهب، جنوب سيناء' : 'Dahab, South Sinai'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 font-medium">
                      {isAr
                        ? 'رحلة متكاملة ومنسقة لمدة ٥ أيام · غطس البحر الأحمر ووديان الصحراء'
                        : '5-day coordinated journey · Red Sea diving & desert canyons'}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--btn-util-bg)] backdrop-blur-md text-white text-[12px] font-bold border border-[var(--border-subtle)]">
                      {isAr ? 'غطس' : 'Diving'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--btn-util-bg)] backdrop-blur-md text-white text-[12px] font-bold border border-[var(--border-subtle)]">
                      {isAr ? 'مغامرة' : 'Adventure'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--btn-util-bg)] backdrop-blur-md text-white text-[12px] font-bold border border-[var(--border-subtle)]">
                      {isAr ? 'طعام محلي' : 'Food'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/30 backdrop-blur-md text-amber-200 text-[12px] font-bold border border-amber-400/40">
                      {isAr ? 'متوازن' : 'Balanced'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TRIP TIMELINE */}
            <div
              id="trip-timeline-summary"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--text-primary)]/8 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
                  <h3 className="text-base sm:text-lg chart-heading font-bold text-[var(--text-primary)]">
                    {isAr ? 'الجدول الزمني للرحلة' : 'Trip Timeline Overview'}
                  </h3>
                </div>
                <span className="text-[12px] text-[var(--text-primary)]/50 font-medium">
                  {isAr ? '٥ أيام منسقة' : '5 Coordinated Days'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
                {/* Day 1 */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[var(--text-secondary)]">
                      {isAr ? 'اليوم ١' : 'Day 1'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[var(--surface-container)]/40" />
                  </div>
                  <ul className="text-xs text-[var(--text-primary)]/80 space-y-1">
                    <li className="font-semibold text-[var(--text-primary)]">{isAr ? 'الوصول' : 'Arrival'}</li>
                    <li>{isAr ? 'تسجيل دخول الفندق' : 'Hotel check-in'}</li>
                    <li>{isAr ? 'عشاء ترحيبي' : 'Dinner'}</li>
                  </ul>
                </div>

                {/* Day 2 */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-300/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900">
                      {isAr ? 'اليوم ٢' : 'Day 2'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  </div>
                  <ul className="text-xs text-emerald-950 space-y-1">
                    <li className="font-bold text-emerald-900 flex items-center gap-1">
                      <Waves className="w-3 h-3 text-emerald-700" />
                      <span>{isAr ? 'رحلة غطس' : 'Diving'}</span>
                    </li>
                    <li>{isAr ? 'غداء على البحر' : 'Lunch'}</li>
                    <li>{isAr ? 'وقت حر' : 'Free time'}</li>
                  </ul>
                </div>

                {/* Day 3 */}
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-300/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900">
                      {isAr ? 'اليوم ٣' : 'Day 3'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                  </div>
                  <ul className="text-xs text-amber-950 space-y-1">
                    <li className="font-bold text-amber-900 flex items-center gap-1">
                      <Compass className="w-3 h-3 text-amber-700" />
                      <span>{isAr ? 'سفاري صحراوي' : 'Desert Safari'}</span>
                    </li>
                    <li>{isAr ? 'مشاهدة الغروب' : 'Sunset'}</li>
                    <li>{isAr ? 'عشاء بدوي' : 'Dinner'}</li>
                  </ul>
                </div>

                {/* Day 4 */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[var(--text-secondary)]">
                      {isAr ? 'اليوم ٤' : 'Day 4'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[var(--surface-container)]/40" />
                  </div>
                  <ul className="text-xs text-[var(--text-primary)]/80 space-y-1">
                    <li className="font-semibold text-[var(--text-primary)]">{isAr ? 'قارب / وقت حر' : 'Boat / free time'}</li>
                    <li>{isAr ? 'مأكولات محلية' : 'Local food'}</li>
                    <li>{isAr ? 'استكشاف دهب' : 'Explore Dahab'}</li>
                  </ul>
                </div>

                {/* Day 5 */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[var(--text-secondary)]">
                      {isAr ? 'اليوم ٥' : 'Day 5'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[var(--surface-container)]/40" />
                  </div>
                  <ul className="text-xs text-[var(--text-primary)]/80 space-y-1">
                    <li className="font-semibold text-[var(--text-primary)]">{isAr ? 'تسجيل الخروج' : 'Checkout'}</li>
                    <li className="font-bold text-[var(--text-secondary)] flex items-center gap-1">
                      <Car className="w-3 h-3" />
                      <span>{isAr ? 'انتقال للمطار' : 'Transfer'}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. FOUR MAJOR BOOKING COMPONENTS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                  {isAr ? 'خدمات الرحلة المختارة' : 'Your Selected Trip Services'}
                </h3>
                <span className="text-xs text-emerald-800 bg-emerald-100 font-bold px-2.5 py-0.5 rounded-full">
                  {isAr ? 'تم تنسيق جميع الخدمات الـ ٤' : 'All 4 Services Coordinated'}
                </span>
              </div>

              {/* 01 — HOTEL */}
              <div
                id="review-card-hotel"
                className="bg-[var(--surface-card)] rounded-3xl p-5 sm:p-6 border border-[var(--border-subtle)] shadow-xs hover:border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)]/10 text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[12px] font-black text-[var(--text-secondary)] block">
                        {isAr ? '٠١ — الفندق' : '01 — Hotel'}
                      </span>
                      <h4 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
                        {hotelName}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isAr ? 'تم الاختيار ✓' : 'Selected ✓'}</span>
                    </span>

                    <button
                      type="button"
                      id="edit-hotel-btn"
                      onClick={onEditHotel}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 px-2 py-1 transition-colors cursor-pointer"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-[var(--text-primary)]/6 items-center">
                  <div className="sm:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-[var(--text-primary)]/80">
                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'الموقع' : 'Location'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {hotelLocation}
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'نوع الغرفة' : 'Room Type'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {hotelRoomType}
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'مدة الإقامة' : 'Stay Duration'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{isAr ? '٥ ليالٍ · فردين' : '5 nights · 2 adults'}</span>
                    </div>
                  </div>

                  <div className={`sm:col-span-4 ${isRTL ? 'sm:text-start text-end flex flex-col sm:items-start' : 'sm:text-end text-start flex flex-col sm:items-end'} justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--text-primary)]/6`}>
                    <span className="text-xs text-[var(--text-primary)]/50">{isAr ? 'إجمالي سعر الإقامة' : 'Total Stay Price'}</span>
                    <span className="text-xl font-black text-[var(--text-primary)]">
                      {isAr ? `${hotelPrice.toLocaleString()} ج.م` : `EGP ${hotelPrice.toLocaleString()}`}
                    </span>
                    <span className="text-[11px] text-[var(--text-primary)]/60">{isAr ? '٥ ليالٍ لشخصين' : '5 nights for 2 guests'}</span>
                  </div>
                </div>
              </div>

              {/* 02 — TRANSFER */}
              <div
                id="review-card-transfer"
                className="bg-[var(--surface-card)] rounded-3xl p-5 sm:p-6 border border-[var(--border-subtle)] shadow-xs hover:border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)]/10 text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[12px] font-black text-[var(--text-secondary)] block">
                        {isAr ? '٠٢ — الانتقالات' : '02 — Transfer'}
                      </span>
                      <h4 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
                        {transferTitle}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isAr ? 'تم الاختيار ✓' : 'Selected ✓'}</span>
                    </span>

                    <button
                      type="button"
                      id="edit-transfer-btn"
                      onClick={onEditTransfer}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 px-2 py-1 transition-colors cursor-pointer"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-[var(--text-primary)]/6 items-center">
                  <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-[var(--text-primary)]/80">
                    <div className="sm:col-span-2">
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'خط السير' : 'Route'}</span>
                      <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1">
                        <span>{isAr ? 'مطار شرم الشيخ' : 'Sharm El Sheikh Airport'}</span>
                        <ChevronRight className="w-3 h-3 text-[var(--text-secondary)] rtl:rotate-180" />
                        <span>{isAr ? 'الفندق في دهب' : 'Hotel'}</span>
                      </span>
                      {flightNumber && (
                        <span className="text-[11px] text-[var(--text-secondary)] font-medium block mt-0.5">
                          {isAr ? `رقم الرحلة: ${flightNumber}` : `Flight: ${flightNumber}`}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'المسافرون' : 'Travelers'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{isAr ? 'فردين بالغين' : '2 adults'}</span>
                    </div>
                  </div>

                  <div className={`sm:col-span-4 ${isRTL ? 'sm:text-start text-end flex flex-col sm:items-start' : 'sm:text-end text-start flex flex-col sm:items-end'} justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--text-primary)]/6`}>
                    <span className="text-xs text-[var(--text-primary)]/50">{isAr ? 'سعر الانتقال' : 'Transfer Price'}</span>
                    <span className="text-xl font-black text-[var(--text-primary)]">
                      {isAr ? `${transferPrice.toLocaleString()} ج.م` : `EGP ${transferPrice.toLocaleString()}`}
                    </span>
                    <span className="text-[11px] text-[var(--text-primary)]/60">{isAr ? 'توصيل خاص مباشر' : 'Private direct ride'}</span>
                  </div>
                </div>
              </div>

              {/* 03 — DIVING */}
              <div
                id="review-card-diving"
                className="bg-[var(--surface-card)] rounded-3xl p-5 sm:p-6 border border-[var(--border-subtle)] shadow-xs hover:border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                      <Waves className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[12px] font-black text-emerald-900 block">
                        {isAr ? '٠٣ — الغطس' : '03 — Diving'}
                      </span>
                      <h4 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
                        {divingTitle}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isAr ? 'تم الاختيار ✓' : 'Selected ✓'}</span>
                    </span>

                    <button
                      type="button"
                      id="edit-diving-btn"
                      onClick={onEditDiving}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 px-2 py-1 transition-colors cursor-pointer"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-[var(--text-primary)]/6 items-center">
                  <div className="sm:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-[var(--text-primary)]/80">
                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'الموعد' : 'Schedule'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {isAr ? `اليوم ${divingDay} · ${divingTime}` : `Day ${divingDay} · ${divingTime}`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'المسافرون' : 'Travelers'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{isAr ? 'فردين بالغين' : '2 adults'}</span>
                    </div>

                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'للفرد الواحد' : 'Per Person'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {isAr ? `${selectedDiving ? selectedDiving.pricePerPersonEGP.toLocaleString() : '1,500'} ج.م` : `EGP ${selectedDiving ? selectedDiving.pricePerPersonEGP.toLocaleString() : '1,500'}`}
                      </span>
                    </div>
                  </div>

                  <div className={`sm:col-span-4 ${isRTL ? 'sm:text-start text-end flex flex-col sm:items-start' : 'sm:text-end text-start flex flex-col sm:items-end'} justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--text-primary)]/6`}>
                    <span className="text-xs text-[var(--text-primary)]/50">{isAr ? 'سعر الغطس التقديري' : 'Estimated Diving Price'}</span>
                    <span className="text-xl font-black text-[var(--text-primary)]">
                      {isAr ? `${divingPrice.toLocaleString()} ج.م` : `EGP ${divingPrice.toLocaleString()}`}
                    </span>
                    <span className="text-[11px] text-[var(--text-primary)]/60">{isAr ? 'الإجمالي لغواصين اثنين' : 'Total for 2 divers'}</span>
                  </div>
                </div>
              </div>

              {/* 04 — SAFARI */}
              <div
                id="review-card-safari"
                className="bg-[var(--surface-card)] rounded-3xl p-5 sm:p-6 border border-[var(--border-subtle)] shadow-xs hover:border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center flex-shrink-0">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[12px] font-black text-amber-900 block">
                        {isAr ? '٠٤ — السفاري' : '04 — Safari'}
                      </span>
                      <h4 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
                        {safariTitle}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isAr ? 'تم الاختيار ✓' : 'Selected ✓'}</span>
                    </span>

                    <button
                      type="button"
                      id="edit-safari-btn"
                      onClick={onEditSafari}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 px-2 py-1 transition-colors cursor-pointer"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-[var(--text-primary)]/6 items-center">
                  <div className="sm:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-[var(--text-primary)]/80">
                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'الموعد' : 'Schedule'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {isAr ? `اليوم ${safariDay} · ${safariTime}` : `Day ${safariDay} · ${safariTime}`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'المسافرون' : 'Travelers'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{isAr ? 'فردين بالغين' : '2 adults'}</span>
                    </div>

                    <div>
                      <span className="text-[var(--text-primary)]/50 block text-[12px]">{isAr ? 'للفرد الواحد' : 'Per Person'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {isAr ? `${selectedSafari ? selectedSafari.pricePerPersonEGP.toLocaleString() : '1,400'} ج.م` : `EGP ${selectedSafari ? selectedSafari.pricePerPersonEGP.toLocaleString() : '1,400'}`}
                      </span>
                    </div>
                  </div>

                  <div className={`sm:col-span-4 ${isRTL ? 'sm:text-start text-end flex flex-col sm:items-start' : 'sm:text-end text-start flex flex-col sm:items-end'} justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--text-primary)]/6`}>
                    <span className="text-xs text-[var(--text-primary)]/50">{isAr ? 'سعر السفاري التقديري' : 'Estimated Safari Price'}</span>
                    <span className="text-xl font-black text-[var(--text-primary)]">
                      {isAr ? `${safariPrice.toLocaleString()} ج.م` : `EGP ${safariPrice.toLocaleString()}`}
                    </span>
                    <span className="text-[11px] text-[var(--text-primary)]/60">{isAr ? 'الإجمالي لضيفين' : 'Total for 2 guests'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. TRIP COORDINATION NOTICE */}
            <div
              id="trip-coordination-notice"
              className="p-5 sm:p-6 rounded-3xl bg-amber-50/70 border border-amber-200/80 text-amber-950 space-y-2 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-700" />
                <h4 className="text-sm sm:text-base font-bold text-amber-950">
                  {isAr ? 'رحلتك منسقة بالكامل كوحدة واحدة' : 'Your trip is coordinated'}
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed font-normal">
                {isAr
                  ? 'يتم تنظيم هذه الخدمات كرحلة واحدة موحدة، لذا فإن أي تغيير أو تعديل على أي نشاط ينعكس تلقائياً على بقية جدول الرحلة دون ارتباك.'
                  : 'These services are being organized as one trip, so changes to one activity can be reflected in the rest of your itinerary.'}
              </p>
            </div>

            {/* 5. IMPORTANT CONFIRMATION INFORMATION CHECKLIST */}
            <div
              id="confirmation-checklist"
              className="bg-[var(--surface-card)] rounded-3xl p-5 sm:p-6 border border-[var(--border-subtle)] shadow-xs space-y-3"
            >
              <h4 className="text-xs font-bold text-[var(--text-secondary)]">
                {isAr ? 'قبل التأكيد، يرجى التأكد من الآتي:' : 'Before confirming, make sure:'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[var(--text-primary)]/85 font-medium">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </span>
                  <span>{isAr ? 'الفندق وتفاصيل الغرفة صحيحة' : 'Your hotel is correct'}</span>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </span>
                  <span>{isAr ? 'الانتقال متوافق مع وقت وصول رحلتك' : 'Your transfer matches your arrival'}</span>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </span>
                  <span>{isAr ? 'مواعيد الأنشطة تناسب جدولك' : 'Your activities fit your schedule'}</span>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </span>
                  <span>{isAr ? 'عدد المسافرين (فردين) صحيح' : 'Your traveler count is correct'}</span>
                </div>
              </div>
            </div>

            {/* 6. TERMS / AGREEMENT CHECKBOX */}
            <div
              id="booking-terms-agreement-card"
              className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs space-y-3"
            >
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="agree-terms-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-[var(--border-subtle)] cursor-pointer"
                />
                <div className="text-xs sm:text-sm text-[var(--text-primary)]/90 leading-relaxed font-medium">
                  <span>{isAr ? 'أوافق على شروط الحجز وسياسات الإلغاء والتعديل.' : 'I agree to the booking terms and cancellation policies.'}</span>
                  <div className="mt-1">
                    <button
                      type="button"
                      id="view-booking-terms-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTermsModal(true);
                      }}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 cursor-pointer"
                    >
                      {isAr ? 'عرض شروط وسياسات الحجز' : 'View booking terms'}
                    </button>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Right Column: Price Summary + Primary CTA */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-6">
            {/* PRICE SUMMARY CARD */}
            <div
              id="booking-review-price-summary-sidebar"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-sm space-y-6 text-[var(--text-primary)]"
            >
              {/* Header */}
              <div className="border-b border-[var(--text-primary)]/8 pb-4">
                <span className="text-[12px] font-bold text-[var(--text-secondary)] block">
                  {isAr ? 'تفاصيل السعر' : 'Price Breakdown'}
                </span>
                <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)] mt-1">
                  {isAr ? 'ملخص تكلفة الرحلة' : 'Trip Summary'}
                </h3>
                <p className="text-xs text-[var(--text-primary)]/60 mt-0.5">
                  {isAr ? 'دهب، مصر · ٥ أيام · فردين بالغين' : 'Dahab, Egypt · 5 days · 2 adults'}
                </p>
              </div>

              {/* Line items */}
              <div className="space-y-3 text-xs text-[var(--text-primary)]/80">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--text-primary)]/80">
                    <Building className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span>{isAr ? 'الفندق (٥ ليالٍ)' : 'Hotel (5 nights)'}</span>
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {isAr ? `${hotelPrice.toLocaleString()} ج.م` : `EGP ${hotelPrice.toLocaleString()}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--text-primary)]/80">
                    <Car className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span>{isAr ? 'الانتقال (المطار ← الفندق)' : 'Transfer (Airport → Hotel)'}</span>
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {isAr ? `${transferPrice.toLocaleString()} ج.م` : `EGP ${transferPrice.toLocaleString()}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--text-primary)]/80">
                    <Waves className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{isAr ? 'الغطس (فردين)' : 'Diving (2 adults)'}</span>
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {isAr ? `${divingPrice.toLocaleString()} ج.م` : `EGP ${divingPrice.toLocaleString()}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--text-primary)]/80">
                    <Compass className="w-3.5 h-3.5 text-amber-700" />
                    <span>{isAr ? 'السفاري (فردين)' : 'Safari (2 adults)'}</span>
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {isAr ? `${safariPrice.toLocaleString()} ج.م` : `EGP ${safariPrice.toLocaleString()}`}
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-[var(--border-subtle)] pt-4" />

                {/* Total */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {isAr ? 'إجمالي السعر التقديري:' : 'Estimated trip total:'}
                    </span>
                    <span className="text-2xl font-black text-[var(--text-primary)]">
                      {isAr ? `${totalEstimatedPrice.toLocaleString()} ج.م` : `EGP ${totalEstimatedPrice.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--text-primary)]/60 font-semibold">
                    {isAr ? 'التكلفة الإجمالية التقديرية لمسافرين اثنين' : 'Estimated total for 2 travelers'}
                  </div>
                </div>

                {/* Transparent pricing note */}
                <div className="pt-2 border-t border-[var(--text-primary)]/6">
                  <p className="text-[12px] text-[var(--text-primary)]/60 italic leading-relaxed">
                    {isAr ? 'يتم تأكيد الأسعار النهائية والتوافر قبل سداد الدفعة.' : 'Final prices and availability will be confirmed before payment.'}
                  </p>
                </div>
              </div>

              {/* Primary & Secondary CTA Actions */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  id="confirm-and-continue-btn"
                  disabled={!agreedToTerms || isProcessing}
                  onClick={handleConfirmAndContinue}
                  className={`w-full py-4 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer ${
                    agreedToTerms && !isProcessing
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98'
                      : 'bg-[var(--surface-container)]/10 text-[var(--text-primary)]/40 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isAr ? 'جارٍ تأكيد رحلتك...' : 'Confirming your trip...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isAr ? 'تأكيد ومتابعة للدفع' : 'Confirm & Continue'}</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </>
                  )}
                </button>

                {!agreedToTerms && (
                  <p className="text-[12px] text-amber-800 text-center font-medium">
                    {isAr ? 'يرجى الموافقة على شروط الحجز للمتابعة.' : 'Please agree to the booking terms to proceed.'}
                  </p>
                )}

                <button
                  type="button"
                  id="keep-editing-btn"
                  onClick={onBackToSafari}
                  className="w-full py-2.5 px-4 rounded-full font-bold text-xs text-[var(--text-primary)]/70 hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]/5 border border-[var(--border-subtle)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{isAr ? 'مواصلة التعديل' : 'Keep Editing'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. MOBILE FIXED BOTTOM ACTION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--btn-util-bg)] backdrop-blur-md border-t border-[var(--border-subtle)] p-4 shadow-lg flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-emerald-800">
            {isAr ? 'جاهز للحجز' : 'Ready to book'}
          </div>
          <div className="text-base font-black text-[var(--text-primary)]">
            {isAr ? `${totalEstimatedPrice.toLocaleString()} ج.م تقديري` : `EGP ${totalEstimatedPrice.toLocaleString()} estimated`}
          </div>
          <div className="text-[11px] text-[var(--text-primary)]/60 font-medium">
            {isAr ? 'مسافران · ٤ خدمات' : '2 travelers · 4 services'}
          </div>
        </div>

        <button
          type="button"
          id="mobile-confirm-and-continue-btn"
          disabled={!agreedToTerms || isProcessing}
          onClick={handleConfirmAndContinue}
          className={`px-5 py-3 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
            agreedToTerms && !isProcessing
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
              : 'bg-[var(--surface-container)]/10 text-[var(--text-primary)]/40 cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{isAr ? 'جارٍ التأكيد...' : 'Confirming...'}</span>
            </>
          ) : (
            <>
              <span>{isAr ? 'تأكيد ومتابعة' : 'Confirm & Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </>
          )}
        </button>
      </div>

      {/* 4. PROCESSING OVERLAY MODAL */}
      {isProcessing && (
        <div
          id="booking-processing-overlay"
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-review-step-dialog-1-title"
    >
          <div className="bg-[var(--surface-card)] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[var(--border-subtle)] text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
              <Loader2 className="w-8 h-8 animate-spin stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h3 id="booking-review-step-dialog-1-title" className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                {isAr ? 'جارٍ تأكيد وتجهيز رحلتك...' : 'Confirming your trip...'}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-primary)]/70 leading-relaxed">
                {isAr ? 'نتحقق من التوافر ونجهز حجوزاتك المنسقة.' : "We're checking availability and preparing your bookings."}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 text-[12px] text-[var(--text-primary)]/60 flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>{isAr ? 'تنسيق الفندق والانتقالات والغطس والسفاري' : 'Coordinating Hotel, Transfer, Diving, and Safari'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. TERMS MODAL */}
      {showTermsModal && (
        <BookingReviewTermsModal onClose={() => setShowTermsModal(false)} />
      )}
    </div>
  );
};

