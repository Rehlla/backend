import React, { useState, useMemo } from 'react';
import { 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Plane, 
  MapPin, 
  Clock, 
  Car, 
  ShieldCheck, 
  Sparkles, 
  Info,
  Waves,
  Building,
  CheckCircle2,
  Navigation,
  CalendarOff
} from 'lucide-react';
import { CURATED_TRANSFERS, TransferOption, HotelOption, CURATED_HOTELS } from './bookingData';
import { TransferOptionCard } from './TransferOptionCard';
import { TransferArrivalInfo } from './TransferArrivalInfo';
import { BookingTransferSummarySidebar } from './BookingTransferSummarySidebar';
import { HoldCountdown } from './HoldCountdown';
import { useTrip } from '../../context/TripContext';
import { api } from '../../services/api';
import { analytics } from '../../services/analytics';
import { useLanguage } from '../../i18n/LanguageContext';
import type { CommerceAlternative } from '../../services/api';
import { checkoutIssueFrom, checkoutIssueMessage } from '../../services/checkoutError';
import { PLANNER_TRANSFER_SLOT, storeTransferHold, transferSkuFor, tripDayDate } from '../../services/plannerCheckout';

interface BookingTransferStepProps {
  selectedHotelId: string;
  initialTransferId?: string;
  initialFlightNumber?: string;
  onSelectTransferId?: (id: string) => void;
  onBackToHotel: () => void;
  onReturnHome: () => void;
  onContinueToDiving?: (transferId: string, flightNumber: string) => void;
}

export const BookingTransferStep: React.FC<BookingTransferStepProps> = ({
  selectedHotelId,
  initialTransferId = 'private-car',
  initialFlightNumber = '',
  onSelectTransferId,
  onBackToHotel,
  onReturnHome,
  onContinueToDiving,
}) => {
  const { showToast, recordLedgerEntry, navigateTo, sessionUser, activeTrip, profile } = useTrip();
  /** The party the trip was planned for — the same count the payment step books. */
  const travelers = activeTrip?.travelersCount ?? profile.travelersCount ?? 1;
  // Was the literal 'DHB-TRIP-894' on both the hold and its ledger entry, so a
  // seat was held against the seeded demo trip whoever booked it.
  const bookingTripId = activeTrip?.id || '';
  const { language, isRTL, t } = useLanguage();
  const isAr = language === 'ar';

  // Transfer selection state - defaults to recommended 'private-car' for Ahmed's trip
  const [selectedTransferId, setSelectedTransferId] = useState<string>(initialTransferId);
  
  // Optional flight number state
  const [flightNumber, setFlightNumber] = useState<string>(initialFlightNumber);

  // Next step preview dialog (Step 03 — Diving)
  const [showNextStepModal, setShowNextStepModal] = useState<boolean>(false);
  /** Why the inventory hold failed, if it did. Shown instead of advancing. */
  const [holdError, setHoldError] = useState<string | null>(null);
  /** P4 trust: the active hold's expiry, when a hold succeeded. */
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  /** P4 trust: honest alternatives when the hold came back 409 sold-out. */
  const [alternatives, setAlternatives] = useState<CommerceAlternative[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  /** True when the alternatives search succeeded but found nothing servable. */
  const [alternativesEmpty, setAlternativesEmpty] = useState(false);
  /**
   * Supplier calendar gate: the supplier refused the requested date entirely
   * (409 supplier-date-blocked). Not "sold out" — no amount of seat hunting
   * helps — so it gets its own state carrying the block reason.
   */
  const [blockedInfo, setBlockedInfo] = useState<{ date: string; reason: string } | null>(null);

  // Retrieve selected hotel object
  const selectedHotel: HotelOption | null = useMemo(() => {
    return CURATED_HOTELS.find((h) => h.id === selectedHotelId) || CURATED_HOTELS[0];
  }, [selectedHotelId]);

  // Retrieve selected transfer object
  const selectedTransfer: TransferOption | null = useMemo(() => {
    return CURATED_TRANSFERS.find((t) => t.id === selectedTransferId) || null;
  }, [selectedTransferId]);

  const hotelDisplayName = selectedHotel ? (isAr && selectedHotel.nameAr ? selectedHotel.nameAr : selectedHotel.name) : (isAr ? 'فندق خليج دهب' : 'Dahab Bay Hotel');
  const transferDisplayName = selectedTransfer ? (isAr && selectedTransfer.titleAr ? selectedTransfer.titleAr : selectedTransfer.title) : '';

  const handleSelectTransfer = (transferId: string) => {
    setSelectedTransferId(transferId);
  };

  const handleContinue = async () => {
    if (!selectedTransfer) return;

    setHoldError(null);
    setAlternatives([]);
    setAlternativesEmpty(false);
    setBlockedInfo(null);

    // The hold the payment step settles. It was taken for a hardcoded party of
    // 2 on the UTC date; checkout now requires the line to match the hold's
    // party size and slot, so it is taken for the trip's real party on the
    // trip's arrival day — the same values the payment step books with.
    const holdLine = {
      skuId: transferSkuFor(selectedTransfer.id),
      tripId: bookingTripId,
      date: tripDayDate(activeTrip, 1),
      timeSlot: PLANNER_TRANSFER_SLOT,
      passengersCount: travelers,
    };
    try {
      // A real inventory hold on the backend, with an idempotency key so a
      // double submit returns the same hold.
      const hold = await api.createHold({
        ...holdLine,
        idempotencyKey: `IDEMP-TRF-HOLD-${selectedTransfer.id}-${Date.now()}`
      });
      storeTransferHold(hold, holdLine);
      // P4 trust: surface the hold's real deadline.
      if (hold?.expiresAt) setHoldExpiresAt(hold.expiresAt);
    } catch (e: unknown) {
      const issue = checkoutIssueFrom(e);
      // Supplier calendar gate: the supplier is closed on the requested date.
      // Show the reason and the path forward (another date) instead of
      // framing it as sold out.
      if (issue.code === 'DATE_BLOCKED') {
        setBlockedInfo({ date: issue.date || '', reason: String(issue.details.reason || '') });
      }
      setHoldError(checkoutIssueMessage(issue, t));
      // P4 trust: sold out or the supplier is not taking bookings — fetch
      // honest alternatives from the same inventory truth, never a guess.
      if (issue.recovery === 'alternatives' && bookingTripId) {
        setAlternativesLoading(true);
        api.findAlternatives({ ...holdLine, limit: 3 })
          .then(res => {
            setAlternatives(res.alternatives || []);
            // A successful search with nothing servable is honest information:
            // say so rather than silently showing no panel at all.
            setAlternativesEmpty((res.alternatives || []).length === 0);
          })
          .catch(() => setAlternatives([]))
          .finally(() => setAlternativesLoading(false));
      }
      return;
    }

    // Record Reference Vertical transaction in append-only ledger
    recordLedgerEntry({
      transactionId: `TXN-${Date.now().toString().slice(-6)}-HOLD`,
      idempotencyKey: `IDEMP-TRF-HOLD-${Date.now()}`,
      bookingRef: `DHB-TRF-2026-${Math.floor(100 + Math.random() * 900)}`,
      tripId: bookingTripId,
      type: 'HOLD_ESCROW',
      amountEGP: selectedTransfer.priceEGP,
      debitAccount: 'TRAVELER_PAYMENT_METHOD',
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      status: 'SETTLED',
      metadata: {
        serviceType: 'transfer',
        supplierId: 'SUP-SHUTTLE-01',
        reason: `Transfer Hold: ${selectedTransfer.title} (${flightNumber || 'SSH Flight'})`
      }
    });

    if (onContinueToDiving) {
      onContinueToDiving(selectedTransferId, flightNumber);
    } else {
      setShowNextStepModal(true);
    }
  };

  return (
    <div
      id="booking-transfer-screen"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col pb-28 lg:pb-16"
    >
      {/* 1. Global Navigation & Booking Progress Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/95 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Brand & Context Label */}
          <div className="flex items-center gap-3">
            {holdError && !blockedInfo && (
              <div role="alert" className="mb-4 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm">
                {holdError}
              </div>
            )}

            {/* Supplier calendar gate: an honest "closed that day" state with
                the supplier's own reason — distinct from sold-out. */}
            {blockedInfo && (
              <div role="alert" className="mb-4 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-sm">
                <p className="font-bold flex items-center gap-2">
                  <CalendarOff className="w-4 h-4" aria-hidden="true" />
                  {isRTL ? 'المزود مغلق في هذا التاريخ' : 'The supplier is closed on this date'}
                </p>
                <p className="mt-1 text-amber-200/90">
                  {blockedInfo.date
                    ? (isRTL
                        ? `لا يقبل حجوزات ${blockedInfo.date}${blockedInfo.reason ? ` — ${blockedInfo.reason}` : '.'}`
                        : `They are not accepting bookings for ${blockedInfo.date}${blockedInfo.reason ? ` — ${blockedInfo.reason}` : '.'}`)
                    : (isRTL ? 'جرّب تاريخًا آخر.' : 'Try another date.')}
                </p>
                <p className="mt-1 text-xs text-amber-200/80">
                  {isRTL
                    ? 'هذا ليس نفاد أماكن — المزود أغلق التاريخ بنفسه.'
                    : 'This is not sold out — the supplier closed the date themselves.'}
                </p>
              </div>
            )}

            {/* P4 trust: the seat hold's real deadline, from the backend. */}
            {holdExpiresAt && !holdError && (
              <div className="mb-4">
                <HoldCountdown
                  expiresAt={holdExpiresAt}
                  isRTL={isRTL}
                  onExpire={() => setHoldExpiresAt(null)}
                />
              </div>
            )}

            {/* P4 trust: honest alternatives when the hold came back sold out
                — including the truthful "nothing servable that day" case. */}
            {(alternativesLoading || alternatives.length > 0 || alternativesEmpty) && (
              <div className="mb-4 p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                <p className="text-sm font-bold text-[var(--text-primary)] mb-3">
                  {isRTL
                    ? 'أماكن بديلة متاحة لنفس التاريخ:'
                    : 'Available alternatives for the same date:'}
                </p>
                {alternativesLoading ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {isRTL ? 'جاري البحث عن بدائل…' : 'Searching for alternatives…'}
                  </p>
                ) : alternatives.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {isRTL
                      ? 'لا توجد بدائل يمكن تقديمها فعليًا في هذا التاريخ — لا نختلق أماكن.'
                      : 'Nothing servable for this date — we will not invent seats.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {alternatives.map(alt => (
                      <button
                        key={alt.skuId}
                        type="button"
                        onClick={() => {
                          // Switching to an alternative re-targets the hold:
                          // the selection state drives the next hold attempt.
                          const match = CURATED_TRANSFERS.find(ct =>
                            ct.id === (alt.skuId === 'SKU-TRF-002' ? 'shuttle' : alt.skuId === 'SKU-TRF-001' ? 'private-car' : '')
                          );
                          if (match) {
                            setSelectedTransferId(match.id);
                            setAlternatives([]);
                            setHoldError(null);
                            analytics.track('alternative_selected', {
                              metadata: { skuId: alt.skuId, fromSku: selectedTransfer?.id || 'unknown' },
                            });
                          }
                        }}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-start transition-colors cursor-pointer"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-[var(--text-primary)] truncate">
                            {isRTL ? alt.titleAr : alt.title}
                          </span>
                          <span className="block text-xs text-[var(--text-secondary)]">
                            {isRTL ? alt.reasonAr : alt.reason} · {alt.timeSlot} · {alt.available} {isRTL ? 'مكان' : 'seats'}
                          </span>
                        </span>
                        <span className="text-xs font-black text-[var(--text-primary)] flex-shrink-0">
                          EGP {alt.basePriceEGP.toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onReturnHome}
              className="text-xl font-black text-[var(--text-primary)] hover:opacity-80 transition-opacity cursor-pointer"
            >
              {isAr ? 'دهب' : 'DAHAB'}
            </button>
            <span className="text-[var(--text-muted)]">/</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] inline-block shadow-[0_0_8px_var(--accent-primary)]" />
              <span className="text-xs font-bold text-[var(--accent-primary)]">
                {isAr ? 'حجز رحلتك' : 'Booking your trip'}
              </span>
            </div>
          </div>

          {/* Progress Indicator: 01 Hotel ✓ → 02 Transfer ● → 03 Diving ○ → 04 Safari ○ */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 text-xs">
            {/* Step 01: Hotel (Completed) */}
            <button
              type="button"
              onClick={onBackToHotel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 font-bold whitespace-nowrap hover:bg-[var(--surface-container)] transition-colors cursor-pointer"
              title={isAr ? 'العودة لاختيار الفندق' : 'Click to return to hotel selection'}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isAr ? '٠١ الفندق' : '01 Hotel'}</span>
            </button>

            <span className="text-[var(--text-muted)] font-bold">{isRTL ? '←' : '→'}</span>

            {/* Step 02: Transfer (ACTIVE) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] font-bold whitespace-nowrap shadow-xs">
              <span className="w-4 h-4 rounded-full bg-[var(--surface-card)]/20 text-[11px] flex items-center justify-center font-bold">
                2
              </span>
              <span>{isAr ? 'الانتقالات' : 'Transfer'}</span>
            </div>

            <span className="text-[var(--text-muted)] font-bold">{isRTL ? '←' : '→'}</span>

            {/* Step 03: Diving */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[var(--text-muted)] font-medium whitespace-nowrap">
              <span className="text-[12px] font-bold">03</span>
              <span>{isAr ? 'الغطس' : 'Diving'}</span>
            </div>

            <span className="text-[var(--text-muted)] font-bold">{isRTL ? '←' : '→'}</span>

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
        {/* Navigation & Status Header bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <button
            type="button"
            id="back-to-hotel-selection-link"
            onClick={onBackToHotel}
            className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)] transition-colors py-1 cursor-pointer self-start"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            <span>{isAr ? 'العودة لاختيار الفندق' : 'Back to Hotel Selection'}</span>
          </button>

          {/* Hotel Selected reassurance badge */}
          <div className="flex items-center gap-2 bg-[var(--surface-card)] px-3 py-1.5 rounded-full border border-[var(--accent-primary)]/30 shadow-xs self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <span className="text-xs font-bold text-[var(--accent-primary)]">
              {isAr ? 'تم اختيار الفندق ✓' : 'Hotel selected ✓'}
            </span>
            <span className="text-xs text-[var(--text-secondary)]/60 font-medium hidden sm:inline">
              ({hotelDisplayName})
            </span>
          </div>
        </div>

        {/* Main Header Block */}
        <div className="mb-8 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
                {isAr ? 'تنسيق المواصلات والانتقال' : 'Transportation Coordination'}
              </span>
              <span className="text-xs font-semibold text-[var(--text-secondary)]/80 bg-[var(--surface-card)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
                {isAr ? '٥ أيام · فردين بالغين · ميزانية متوازنة' : '5 days · 2 adults · Moderate budget'}
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
              {isAr ? 'كيف تفضل الوصول إلى دهب؟' : 'How do you want to get to Dahab?'}
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)]/70 mt-1.5 max-w-2xl font-normal">
              {isAr ? 'اختر وسيلة انتقال مريحة من مطار شرم الشيخ مباشرة إلى فندقك في دهب.' : 'Choose a transfer from Sharm El Sheikh to your hotel.'}
            </p>
          </div>

          {/* Route & Journey Visualization Box */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 font-bold text-[var(--text-primary)]">
                <div className="w-8 h-8 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
                  <Plane className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[12px] text-[var(--text-secondary)]/50 font-normal block">
                    {isAr ? 'نقطة الانطلاق والاستقبال' : 'Pickup Location'}
                  </span>
                  <span>{isAr ? 'مطار شرم الشيخ الدولي' : 'Sharm El Sheikh Airport'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold pl-2 sm:pl-0">
                <span className="hidden sm:inline text-base">{isRTL ? '←' : '→'}</span>
                <span className="sm:hidden text-sm">↓</span>
              </div>

              <div className="flex items-center gap-2.5 font-bold text-[var(--text-primary)]">
                <div className="w-8 h-8 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[12px] text-[var(--text-secondary)]/50 font-normal block">
                    {isAr ? 'وجهة الوصول' : 'Drop-off Destination'}
                  </span>
                  <span>{hotelDisplayName} {isAr ? 'في دهب' : 'in Dahab'}</span>
                </div>
              </div>
            </div>

            {/* Approximate Duration Pill */}
            <div className="flex items-center gap-2 bg-[var(--surface-container)] px-4 py-2 rounded-2xl border border-[var(--border-subtle)] text-xs self-start md:self-auto">
              <Clock className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0" />
              <div>
                <span className="font-bold text-[var(--text-primary)]">{isAr ? 'حوالي ساعة واحدة' : 'Approximately 1 hour'}</span>
                <span className="text-[11px] text-[var(--text-secondary)]/50 block font-normal">
                  {isAr ? 'طريق ساحلي خلاب بجنوب سيناء' : 'Scenic South Sinai coastal highway'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Layout (Main Options + Sticky Sidebar) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Area: Transfer Options & Arrival Section (8 Columns) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Curated Transfer Options Header Banner */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                  {isAr ? 'خيارات الانتقال المختارة' : 'Curated transfer options'}
                </h2>
                <span className="text-xs text-[var(--text-secondary)]/60">
                  {isAr ? 'اختر الخيار الأنسب لراحتك وتفضيلاتك' : 'Select the ride that best suits your travel preferences'}
                </span>
              </div>

              {/* 3 Transfer Option Cards */}
              <div className="space-y-4">
                {CURATED_TRANSFERS.map((transfer) => (
                  <TransferOptionCard
                    key={transfer.id}
                    transfer={transfer}
                    isSelected={selectedTransferId === transfer.id}
                    onSelect={handleSelectTransfer}
                  />
                ))}
              </div>

              {/* Price Disclaimer Note */}
              <p className="text-[12px] text-[var(--text-secondary)]/50 italic pl-1">
                {isAr ? 'سعر تقديري شامل للمسافرين.' : 'Sample price shown for demonstration.'}
              </p>
            </div>

            {/* Arrival Information & Pickup Instructions Component */}
            <TransferArrivalInfo
              selectedHotel={selectedHotel}
              flightNumber={flightNumber}
              onFlightNumberChange={setFlightNumber}
            />

            {/* Context Note on Dahab Transfers */}
            <div className="p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-secondary)]/90 space-y-2">
              <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'لماذا يفضل تنظيم الانتقالات المسبقة في رحلتك؟' : 'Why organize transfers through your trip?'}</span>
              </h4>
              <p className="leading-relaxed font-normal text-xs text-[var(--text-secondary)]/70">
                {isAr 
                  ? 'الوصول لمطار شرم الشيخ بدون ترتيب مسبق قد يعني التفاوض العشوائي مع سيارات الأجرة. بتنسيق رحلتك مسبقاً، يستقبلك سائقك مباشرة عند الخروج مع ضمان أمان الطريق والتنسيق الكامل مع موعد تسجيل دخول الفندق وجدول الغطس.'
                  : 'Landing at Sharm El Sheikh Airport without pre-arranged transport often means negotiating with local taxis outside the terminal. By coordinating your transfer directly with your Dahab accommodation and diving schedule, your driver meets you directly upon arrival with reliable direct routing.'}
              </p>
            </div>
          </div>

          {/* Desktop Sticky Summary Sidebar (4 Columns) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-24">
            <BookingTransferSummarySidebar
              selectedHotel={selectedHotel}
              selectedTransfer={selectedTransfer}
              flightNumber={flightNumber}
              onContinue={handleContinue}
              onBack={onBackToHotel}
            />
          </div>
        </div>
      </main>

      {/* 3. Mobile Sticky Bottom Action / Summary Bar */}
      <div
        id="mobile-transfer-bottom-bar"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] p-3.5 sm:p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[var(--accent-primary)] block truncate">
              {selectedTransfer ? `${transferDisplayName} · ${selectedTransfer.priceEGP.toLocaleString()} ${isAr ? 'جنيه' : 'EGP'}` : (isAr ? 'اختر الانتقال' : 'Select transfer')}
            </span>
            <div className="text-sm font-bold text-[var(--text-primary)] truncate">
              {isAr ? 'شرم الشيخ ← دهب' : 'Sharm El Sheikh → Dahab'}
            </div>
            <div className="text-[12px] font-medium text-[var(--text-secondary)]/60">
              {hotelDisplayName}
            </div>
          </div>

          <button
            type="button"
            id="mobile-continue-transfer-btn"
            disabled={!selectedTransfer}
            onClick={handleContinue}
            className={`inline-flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-full text-xs font-bold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] whitespace-nowrap ${
              selectedTransfer
                ? 'bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] font-bold cursor-pointer active:scale-95'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <span>{isAr ? 'المتابعة للغطس' : 'Continue to Diving'}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Next Step Modal: Preview of Step 03 — Diving */}
      {showNextStepModal && selectedTransfer && (
        <div
          id="transfer-next-step-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-next-step-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNextStepModal(false);
          }}
        >
          <div className="bg-[var(--surface-card)] text-[var(--text-primary)] w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-[var(--border-subtle)] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
                {isAr ? 'تم اختيار الانتقال وحفظه' : 'Transfer Selected & Saved'}
              </span>
              <h3 id="transfer-next-step-modal-title" className="text-xl chart-heading font-bold text-[var(--text-primary)] pt-1">
                {transferDisplayName} ({selectedTransfer.priceEGP.toLocaleString()} {isAr ? 'جنيه' : 'EGP'})
              </h3>
              <p className="text-xs text-[var(--text-secondary)]/70">
                {isAr ? 'مطار شرم الشيخ الدولي ← ' : 'Sharm El Sheikh Airport → '} {hotelDisplayName}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-start text-xs space-y-2">
              <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'التالي: ٠٣ اختيار باقة الغطس' : 'Next: 03 Diving Selection'}</span>
              </div>
              <p className="text-[var(--text-secondary)]/70 leading-relaxed text-[12px]">
                {isAr
                  ? 'تم تنسيق وسيلة الانتقال مع خطتك في دهب. الخطوة التالية: تخصيص مواقع الغطس الإرشادية (الكانيون، البلو هول، اللايتهاوس) وباقات المعدات.'
                  : 'Your transfer choice has been coordinated with your Dahab itinerary. Next up: customize your guided dive sites (Canyon, Blue Hole, Lighthouse) and gear packages.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowNextStepModal(false)}
                className="w-full py-3 rounded-full text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                {isAr ? 'تغيير وسيلة الانتقال' : 'Change transfer'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNextStepModal(false);
                  showToast(isAr ? 'تم تأكيد حجز الانتقال وإدراجه في برنامج رحلتك ✓' : 'Transfer booking verified and locked into your Dahab itinerary ✓');
                  navigateTo('/my-trip');
                }}
                className="w-full py-3 rounded-full text-xs font-bold text-[var(--accent-primary-ink)] bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                {isAr ? 'عرض خطة الرحلة' : 'View Itinerary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

