import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Banknote,
  Building,
  Car,
  Waves,
  Compass,
  Check,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Share2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Copy,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Smartphone,
  Mail,
  User,
  HeartHandshake,
  QrCode,
  Send,
  Zap,
  MessageSquare
} from 'lucide-react';
import {
  HotelOption,
  TransferOption,
  DivingOption,
  SafariOption
} from './bookingData';
import { BookingReviewTermsModal } from './BookingReviewTermsModal';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { formatTripDateRange } from '../../utils/tripDates';
import { api } from '../../services/api';
import { useHeldCheckout } from '../../hooks/useHeldCheckout';
import { newAttemptKey, type CheckoutLine, type HeldCheckoutOutcome } from '../../services/heldCheckout';
import { CheckoutIssuePanel } from '../commerce/CheckoutIssuePanel';
import {
  PLANNER_HOTEL_SLOT,
  PLANNER_SKUS,
  PLANNER_TRANSFER_SLOT,
  TRANSFER_HOLD_STORAGE_KEY,
  matchingTransferHold,
  transferSkuFor,
  tripDayDate,
} from '../../services/plannerCheckout';
import { analytics } from '../../services/analytics';
import type { PriceExplanation } from '../../services/api';
import { IMG_BLUE_HOLE_HERO } from '../../shared/placeholderImagery';

interface BookingPaymentStepProps {
  selectedHotel: HotelOption | null;
  selectedTransfer: TransferOption | null;
  selectedDiving: DivingOption | null;
  selectedSafari: SafariOption | null;
  flightNumber?: string;
  divingDay?: number;
  divingTime?: string;
  safariDay?: number;
  safariTime?: string;
  onBackToReview: () => void;
  onViewMyTrip?: () => void;
}

export const BookingPaymentStep: React.FC<BookingPaymentStepProps> = ({
  selectedHotel,
  selectedTransfer,
  selectedDiving,
  selectedSafari,
  flightNumber = '',
  divingDay = 2,
  divingTime = '09:00 AM',
  safariDay = 3,
  safariTime = '02:00 PM',
  onBackToReview,
  onViewMyTrip,
}) => {
  const { language, isRTL, t } = useLanguage();
  const { recordLedgerEntry, showToast, navigateTo, setIntendedRoute, isSignedIn, sessionUser, profile, activeTrip, arePaymentsSimulated } = useTrip();
  // Payment Method Selection: 'card' (default) | 'wallet' | 'instapay' | 'arrival' | 'cash'
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | 'instapay' | 'arrival' | 'cash'>('card');
  const [cardGateway, setCardGateway] = useState<'PAYMOB' | 'STRIPE'>('PAYMOB');
  const [walletProvider, setWalletProvider] = useState<'vodafone' | 'orange' | 'etisalat' | 'wepay'>('vodafone');
  const [walletPhone, setWalletPhone] = useState<string>('');
  const [instapayAddress, setInstapayAddress] = useState<string>('');

  // Card form. Deliberately empty.
  //
  // These four fields used to arrive pre-filled with 'Sherif Ahmed',
  // '1234 5678 9012 3456', '09 / 28' and CVV '842'. A payment form that opens
  // holding a card number invites a traveler to submit it without noticing it
  // is not theirs, and it is the reason a walkthrough of this flow could reach
  // the pay button without anyone entering a card at all.
  // The party size the traveler actually configured. Was "2 Adults (Ahmed &
  // Companion)" for everyone, including a solo traveler.
  const travelers = activeTrip?.travelersCount ?? profile.travelersCount ?? 1;
  const travelersLabel =
    `${travelers} ${travelers === 1 ? t('booking.adults') : t('booking.adultsPlural')}`;

  const [cardholderName, setCardholderName] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');

  // Billing details, pre-filled from the traveler's own session record rather
  // than from a fictional 'sherif.ahmed@example.com'.
  const [billingName, setBillingName] = useState<string>(profile.name || sessionUser?.name || '');
  const [billingEmail, setBillingEmail] = useState<string>(profile.email || sessionUser?.email || '');
  const [billingPhone, setBillingPhone] = useState<string>(profile.phone || sessionUser?.phone || '');

  // Terms agreement
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  // Processing & Confirmation State
  const checkout = useHeldCheckout({
    keyPrefix: 'PLAN',
    onConfirmed: outcome => recordSettledTrip(outcome),
  });
  /** Holding and settling — drives the processing overlay. */
  const isProcessing = checkout.busy;
  /** What the server actually charged, which a re-confirmed price can change. */
  const [chargedTotalEGP, setChargedTotalEGP] = useState<number | null>(null);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  /**
   * Why the settlement failed, if it did.
   *
   * Before this, the catch below logged "settled locally" and the component
   * then set isConfirmed(true) unconditionally. An end-to-end test signed out
   * produced two 401s from /api/commerce/checkout and the traveller was still
   * shown "Confirmed ✓" with a booking reference that existed nowhere.
   */
  const [settlementError, setSettlementError] = useState<string | null>(null);
  // Removed: `smsDispatched`, which defaulted to true and was never read after
  // the client-side SMS dispatch above was taken out.

  // Success view details toggle & share modal
  const [showDetailsVoucher, setShowDetailsVoucher] = useState<boolean>(false);
  const [showShareToast, setShowShareToast] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // P4 trust: the backend-authoritative price explanation. Fetched lazily on
  // first expand — catalogue truth (per-person vs per-stay basis, unit
  // prices, cancellation windows), never client arithmetic.
  const [priceExplanation, setPriceExplanation] = useState<PriceExplanation | null>(null);
  const [showPriceExplainer, setShowPriceExplainer] = useState<boolean>(false);
  const [priceExplanationError, setPriceExplanationError] = useState<boolean>(false);

  // Price calculations
  const hotelPrice = selectedHotel ? selectedHotel.priceTotalEGP : 7500;
  const transferPrice = selectedTransfer ? selectedTransfer.priceEGP : 1200;
  const divingPrice = selectedDiving ? selectedDiving.pricePerPersonEGP * travelers : 3000;
  const safariPrice = selectedSafari ? selectedSafari.pricePerPersonEGP * travelers : 2800;
  const totalTripPrice = hotelPrice + transferPrice + divingPrice + safariPrice;

  /**
   * The traveler's own trip.
   *
   * Two literals used to stand in for it: every money path filed against
   * 'DHB-TRIP-894' (the seeded demo trip), so a booking, its payment and its
   * ledger rows all attached to somebody else's itinerary; and the confirmation
   * screen displayed 'DHB-8942-SINA', a reference that existed nowhere.
   *
   * A traveler reaching this screen has a trip — the planner created one and
   * sign-in is required before booking — so this is their id. The fallback is
   * empty rather than a demo id: an empty reference on screen is a visible
   * problem, a plausible wrong one is not.
   */
  const tripId = activeTrip?.id || '';
  const bookingTripId = tripId;

  /** P4 trust: explain the total from the SKU catalogue (backend truth). */
  const togglePriceExplainer = () => {
    const next = !showPriceExplainer;
    setShowPriceExplainer(next);
    if (next && !priceExplanation && !priceExplanationError && bookingTripId) {
      analytics.track('price_explainer_opened', {});
      const skuIds = [
        selectedHotel ? 'SKU-HTL-001' : null,
        selectedTransfer ? (selectedTransfer.id === 'private-car' ? 'SKU-TRF-001' : 'SKU-TRF-002') : null,
        selectedDiving ? 'SKU-DIV-001' : null,
        selectedSafari ? 'SKU-SAF-001' : null,
      ].filter((s): s is string => Boolean(s));
      api.explainPrice({
        tripId: bookingTripId,
        items: skuIds.map(skuId => ({
          skuId,
          passengersCount: travelers,
        })),
      })
        .then(setPriceExplanation)
        .catch(() => setPriceExplanationError(true));
    }
  };

  /**
   * Every service on this page, as checkout lines.
   *
   * This page used to settle only the transfer hold through the single-item
   * checkout while showing — and recording in the ledger — the total for all
   * four services, so the hotel, dive and safari were "confirmed" without
   * being booked. Now each selected service is held for the trip's party on
   * its trip day and the lot settles in one multi-service checkout.
   */
  const buildCheckoutLines = (): CheckoutLine[] => {
    const lines: CheckoutLine[] = [];
    const arrivalDate = tripDayDate(activeTrip, 1);
    if (selectedHotel) {
      lines.push({
        serviceType: 'hotel',
        skuId: PLANNER_SKUS.hotel,
        scheduledDate: arrivalDate,
        scheduledTime: PLANNER_HOTEL_SLOT,
        passengersCount: travelers,
        amountEGP: hotelPrice,
        dropoffLocation: selectedHotel.name,
      });
    }
    if (selectedTransfer) {
      const skuId = transferSkuFor(selectedTransfer.id);
      // The seat the transfer step already held, when it is still good for
      // exactly this line; otherwise it is held again here.
      const existing = matchingTransferHold({
        skuId,
        tripId: bookingTripId,
        date: arrivalDate,
        timeSlot: PLANNER_TRANSFER_SLOT,
        passengersCount: travelers,
      });
      lines.push({
        serviceType: 'transfer',
        skuId,
        scheduledDate: arrivalDate,
        scheduledTime: PLANNER_TRANSFER_SLOT,
        passengersCount: travelers,
        amountEGP: transferPrice,
        pickupLocation: 'Sharm El Sheikh Intl Airport (SSH) Terminal 1',
        dropoffLocation: selectedHotel ? selectedHotel.name : undefined,
        specialRequests: flightNumber ? `Flight ${flightNumber}` : undefined,
        existingHold: existing ?? undefined,
      });
    }
    if (selectedDiving) {
      lines.push({
        serviceType: 'diving',
        skuId: PLANNER_SKUS.diving,
        scheduledDate: tripDayDate(activeTrip, divingDay),
        scheduledTime: divingTime,
        passengersCount: travelers,
        amountEGP: divingPrice,
      });
    }
    if (selectedSafari) {
      lines.push({
        serviceType: 'safari',
        skuId: PLANNER_SKUS.safari,
        scheduledDate: tripDayDate(activeTrip, safariDay),
        scheduledTime: safariTime,
        passengersCount: travelers,
        amountEGP: safariPrice,
      });
    }
    return lines;
  };

  const handlePayAndConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms || checkout.busy) return;
    setSettlementError(null);
    checkout.reset();

    if (!isSignedIn) {
      setSettlementError(t('checkout.error.signIn'));
      return;
    }
    if (!bookingTripId) {
      // Nothing can be held or paid without the traveller's trip; saying so
      // beats a server 404 dressed up as a payment failure.
      setSettlementError(t('checkout.error.noTrip'));
      return;
    }

    const paymentProvider = paymentMethod === 'card' ? cardGateway : paymentMethod === 'wallet' ? 'PAYMOB' : 'CASH_ON_ARRIVAL';
    await checkout.submit({
      tripId: bookingTripId,
      traveler: { name: billingName, phone: billingPhone, email: billingEmail },
      lines: buildCheckoutLines(),
      payment: {
        provider: paymentProvider,
        // Only the last four digits leave the browser. The full PAN, expiry and
        // CVV must never reach our API — a real integration replaces these
        // fields with a hosted gateway iframe and sends its token instead.
        cardLast4: paymentMethod === 'card' ? cardNumber.replace(/\D/g, '').slice(-4) : undefined,
        cardBrand: paymentMethod === 'card' ? cardGateway : undefined,
        cardHolderName: paymentMethod === 'card' ? cardholderName : billingName,
      },
      attemptKey: newAttemptKey('PLAN'),
    });
  };

  /** The server settled every line: record what it charged, under its reference. */
  function recordSettledTrip(outcome: Extract<HeldCheckoutOutcome, { kind: 'confirmed' }>) {
    const chargedEGP = outcome.held.reduce((sum, line) => sum + line.amountEGP, 0);
    const bookingRef = outcome.result.bookings?.[0]?.bookingRef || outcome.result.transactionId;
    try {
      sessionStorage.removeItem(TRANSFER_HOLD_STORAGE_KEY);
    } catch {
      // The stale hold is ignored by matchingTransferHold anyway.
    }

    /*
      Removed: two SMS dispatches fired from the browser on every checkout.
      Supplier dispatch belongs on the server, after checkout, to the supplier
      the SKU actually resolves to — which is where it now happens.
    */

    const debitAccount = paymentMethod === 'card'
      ? `TRAVELER_CARD_${cardNumber.slice(-4)}`
      : paymentMethod === 'wallet'
      ? `TRAVELER_WALLET_${walletProvider.toUpperCase()}`
      : paymentMethod === 'instapay'
      ? `INSTAPAY_IPA_${instapayAddress.split('@')[0]}`
      : 'TRAVELER_CASH_ON_ARRIVAL';

    recordLedgerEntry({
      transactionId: outcome.result.transactionId,
      idempotencyKey: `${outcome.result.transactionId}-LOCAL`,
      bookingRef,
      tripId: outcome.tripId,
      type: 'PAYMENT_CAPTURED',
      amountEGP: chargedEGP,
      debitAccount,
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      status: outcome.result.paymentState === 'CAPTURED' ? 'SETTLED' : 'PENDING',
      metadata: {
        serviceType: 'all',
        travelerName: billingName,
        method: paymentMethod,
        gateway: cardGateway,
        reason: `Full Trip Checkout Settlement (${selectedHotel?.name || 'Hotel'}, Transfer, Diving, Safari)`
      }
    });
    setChargedTotalEGP(chargedEGP);
    // Only now, with the backend having actually settled, is this confirmed.
    setIsConfirmed(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleShareClick = () => {
    navigator.clipboard?.writeText?.(`https://dahab.travel/trip/${tripId}`);
    setCopiedLink(true);
    setShowShareToast(true);
    setTimeout(() => {
      setCopiedLink(false);
    }, 3000);
  };

  /* ========================================================================
     SUCCESS STATE (Trip Confirmed)
     ======================================================================== */
  if (isConfirmed) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] font-['SF_Arabic',sans-serif] pb-28 lg:pb-16 animate-in fade-in duration-300"
      >
        {/* Top Minimal Dahab Bar */}
        <header className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] sticky top-0 z-30 shadow-2xs">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--surface-container)] text-[var(--text-primary)] flex items-center justify-center font-bold text-sm">
                D
              </div>
              <div>
                <span className="text-[11px] font-black tracking-widest uppercase text-[var(--text-secondary)] block">
                  DAHAB
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {t('booking.tripConfirmation')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t('booking.confirmed')}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-8">
          {/* 1. HERO SUCCESS BANNER */}
          <div
            id="confirmation-hero-banner"
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-800 ring-8 ring-emerald-50 mb-1 shadow-sm">
              <Check className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
                {t('booking.tripConfirmedMsg')}
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-primary)]/75 max-w-xl mx-auto leading-relaxed">
                {t('booking.tripConfirmedDesc')}
              </p>
            </div>

            {arePaymentsSimulated && (
              <div
                role="note"
                className="max-w-xl mx-auto rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
              >
                <p className="text-sm text-amber-900 leading-relaxed">
                  {language === 'ar'
                    ? 'ملاحظة مهمة: مفيش أي مبلغ اتخصم من كارتك. الحجز اتسجّل ووصل للمزوّد، والدفع بيتم معاه مباشرة.'
                    : 'Important: your card was not charged. The booking is recorded and has gone to the provider — you pay them directly.'}
                </p>
              </div>
            )}

            <div className="inline-flex items-center gap-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] px-4 py-1.5 rounded-full text-xs text-[var(--text-primary)]/70 shadow-2xs font-mono">
              <span>{t('booking.tripId')}</span>
              <span className="font-bold text-[var(--text-primary)]">{tripId}</span>
            </div>
          </div>

          {/* 2. ONE TRIP MAIN UNIFIED CONTAINER */}
          <div
            id="confirmed-trip-card"
            className="bg-[var(--surface-card)] rounded-3xl border border-[var(--border-subtle)] shadow-sm overflow-hidden"
          >
            {/* Visual Cover Header */}
            <div className="relative h-44 sm:h-52 w-full bg-[var(--surface-container)]/10">
              <img
                src={IMG_BLUE_HOLE_HERO}
                alt="Dahab turquoise sea and coastal mountains"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              <div className="absolute top-4 end-4">
                <button
                  type="button"
                  id="share-trip-header-btn"
                  onClick={handleShareClick}
                  className="px-3 py-1.5 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-bold backdrop-blur-md shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span>{t('booking.shareTrip')}</span>
                </button>
              </div>

              <div className="absolute bottom-4 left-4 right-4 text-white">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <span>{t('booking.myTrip')}</span>
                  <span>•</span>
                  <span>{t('booking.dahabSouthSinai')}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl chart-heading font-bold mt-0.5">
                  Dahab · 5 Days
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium mt-0.5">
                  {t('booking.tripSummaryLine').replace('${days}', '5').replace('${travelers}', String(travelers)).replace('${travelerWord}', travelers === 1 ? t('booking.traveler') : t('booking.travelersPlural'))}
                </p>
              </div>
            </div>

            {/* Trip Status Bar */}
            <div className="p-4 sm:p-5 bg-[var(--surface-card)] border-b border-[var(--text-primary)]/8 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[var(--text-primary)]/50 block text-[12px]">{t('booking.status')}</span>
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span>Confirmed ✓</span>
                  </span>
                </div>

                <div className="h-6 w-px bg-[var(--surface-container)]/10" />

                <div>
                  <span className="text-[var(--text-primary)]/50 block text-[12px]">{t('booking.travelers')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{travelersLabel}</span>
                </div>
              </div>

              <div className="text-end">
                <span className="text-[var(--text-primary)]/50 block text-[12px]">{t('booking.totalPaidConfirmed')}</span>
                <span className="text-sm font-black text-[var(--text-primary)]">
                  EGP {(chargedTotalEGP ?? totalTripPrice).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Confirmed Services List (Clean & Unified to Same Trip) */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  {t('booking.confirmedServices')}
                </h3>
                <span className="text-xs text-emerald-800 font-semibold">
                  {t('booking.coordinatedByDahab')}
                </span>
              </div>

              <div className="space-y-3">
                {/* 01 HOTEL */}
                <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 flex items-start justify-between gap-3 hover:border-[var(--border-subtle)] transition-all">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--surface-container)]/10 text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Building className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {selectedHotel ? selectedHotel.name : 'Dahab Bay Hotel'}
                        </h4>
                        <span className="text-[12px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full">
                          Confirmed ✓
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70">
                        {selectedHotel ? selectedHotel.location : 'Lighthouse Area, Dahab'} · 5 nights
                      </p>
                    </div>
                  </div>
                  <div className="text-end flex-shrink-0 text-xs font-bold text-[var(--text-primary)]">
                    EGP {hotelPrice.toLocaleString()}
                  </div>
                </div>

                {/* 02 TRANSFER */}
                <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 flex items-start justify-between gap-3 hover:border-[var(--border-subtle)] transition-all">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--surface-container)]/10 text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Car className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {selectedTransfer ? selectedTransfer.title : 'Private Car'}
                        </h4>
                        <span className="text-[12px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full">
                          Confirmed ✓
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70">
                        Sharm El Sheikh Airport → Dahab Hotel {flightNumber ? `· Flight ${flightNumber}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-end flex-shrink-0 text-xs font-bold text-[var(--text-primary)]">
                    EGP {transferPrice.toLocaleString()}
                  </div>
                </div>

                {/* 03 DIVING */}
                <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 flex items-start justify-between gap-3 hover:border-[var(--border-subtle)] transition-all">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Waves className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {selectedDiving ? selectedDiving.title : 'Guided Diving Experience'}
                        </h4>
                        <span className="text-[12px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full">
                          Confirmed ✓
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70">
                        Day {divingDay} · {divingTime} · {travelers} {travelers === 1 ? 'Diver' : 'Divers'}
                      </p>
                    </div>
                  </div>
                  <div className="text-end flex-shrink-0 text-xs font-bold text-[var(--text-primary)]">
                    EGP {divingPrice.toLocaleString()}
                  </div>
                </div>

                {/* 04 SAFARI */}
                <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 flex items-start justify-between gap-3 hover:border-[var(--border-subtle)] transition-all">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {selectedSafari ? selectedSafari.title : 'Desert Safari'}
                        </h4>
                        <span className="text-[12px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full">
                          Confirmed ✓
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70">
                        Day {safariDay} · {safariTime} · {travelers} {travelers === 1 ? 'Guest' : 'Guests'}
                      </p>
                    </div>
                  </div>
                  <div className="text-end flex-shrink-0 text-xs font-bold text-[var(--text-primary)]">
                    EGP {safariPrice.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Expandable Booking Details / Voucher */}
              <div className="pt-3">
                <button
                  type="button"
                  id="toggle-booking-details-btn"
                  onClick={() => setShowDetailsVoucher(!showDetailsVoucher)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]/5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showDetailsVoucher ? 'Hide Booking Details' : 'View Booking Details & Provider References'}</span>
                  {showDetailsVoucher ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDetailsVoucher && (
                  <div className="mt-3 p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 text-xs text-[var(--text-primary)]/80 space-y-2.5 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[var(--text-primary)]/50 text-[12px] block">{t('booking.leadTraveler')}</span>
                        <span className="font-semibold text-[var(--text-primary)]">{billingName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-primary)]/50 text-[12px] block">{t('booking.contactEmail')}</span>
                        <span className="font-semibold text-[var(--text-primary)]">{billingEmail || sessionUser?.email || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-primary)]/50 text-[12px] block">{t('booking.paymentMethod')}</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {paymentMethod === 'card'
                            ? `${t('booking.card')} ${cardNumber ? `•••• ${cardNumber.replace(/\D/g, '').slice(-4)}` : ''}`.trim()
                            : paymentMethod === 'arrival'
                              ? t('booking.payOnArrival')
                              : t('booking.cash')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-primary)]/50 text-[12px] block">{t('booking.internalBookingToken')}</span>
                        {/* Was the literal 'DHB-VCH-8942-AUTH' on every booking. */}
                        <span className="font-mono text-[var(--text-secondary)] font-bold">{tripId || '—'}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[var(--text-primary)]/8 text-[12px] text-[var(--text-primary)]/60">
                      {t('booking.voucherNote')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. CONFIRMATION MESSAGE & INTRODUCING NEXT PHASE */}
            <div className="p-6 sm:p-7 bg-[var(--surface-container)]/10 border-t border-[var(--text-secondary)]/20 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--text-secondary)]" />
                <h4 className="text-base chart-heading font-bold text-[var(--text-primary)]">
                  {t('booking.tripNowLiveMsg')}
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-primary)]/80 leading-relaxed">
                {t('booking.tripNowLiveDesc')}
              </p>

              {/*
                Removed: a green badge reading "Twilio SMS Alerts Dispatched",
                "Driver (Mahmoud) & Dive Center received instant booking
                manifests" and a DELIVERED pill. This component sends no SMS —
                /api/sms/* is Operations-only and answers a traveler with 403,
                so it could not have — and the driver it named is the same
                invented one the booking record used to carry. Supplier dispatch
                is the supplier's acceptance step, and the booking now correctly
                starts at PENDING_CONFIRMATION until that happens.
              */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)]/5 border border-[var(--text-secondary)]/20 flex items-center gap-2.5 text-xs">
                <div className="w-7 h-7 rounded-xl bg-[var(--surface-container)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <span className="text-[var(--text-primary)]/80 leading-relaxed">
                  {language === 'ar'
                    ? 'الحجز راح للمزوّد، وهتوصلك رسالة أول ما يأكّده.'
                    : 'Your booking has gone to the provider. You will hear from us as soon as they confirm it.'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. PRIMARY & SECONDARY ACTIONS */}
          <div className="space-y-3 pt-2 text-center">
            <button
              type="button"
              id="view-my-trip-btn"
              onClick={() => {
                if (onViewMyTrip) {
                  onViewMyTrip();
                } else {
                  alert('Transitioning to My Trip workspace (next phase).');
                }
              }}
              className="w-full sm:w-auto min-w-[280px] px-8 py-4 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] font-bold text-sm sm:text-base transition-all shadow-md active:scale-98 inline-flex items-center justify-center gap-2.5 cursor-pointer mx-auto"
            >
              <span>{t('booking.viewMyTrip')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div>
              <button
                type="button"
                id="share-trip-bottom-btn"
                onClick={handleShareClick}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-2 px-4 rounded-full hover:bg-[var(--surface-card)] cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Trip Link Copied! ✓' : 'Share Trip with Companion'}</span>
              </button>
            </div>
          </div>

          {/* Share notification toast */}
          {showShareToast && (
            <div className="fixed bottom-24 end-4 z-50 bg-[var(--surface-container)] text-[var(--text-primary)] text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Trip link copied to clipboard! Share it with your companion.</span>
            </div>
          )}
        </main>
      </div>
    );
  }

  /* ========================================================================
     PAYMENT & FINAL BOOKING SCREEN (Before Confirming)
     ======================================================================== */
  return (
    <div className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] font-['SF_Arabic',sans-serif] pb-28 lg:pb-16">
      {/* 1. TOP DAHAB BRANDING & COMPACT PROGRESS BAR */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--surface-container)] text-[var(--text-primary)] flex items-center justify-center font-bold text-sm">
              D
            </div>
            <div>
              <span className="text-[11px] font-black tracking-widest uppercase text-[var(--text-secondary)] block">
                DAHAB
              </span>
              <h1 className="text-sm font-bold text-[var(--text-primary)]">
                {t('booking.completeBooking')}
              </h1>
            </div>
          </div>

          {/* Compact Progress Indicator: Trip ✓, Hotel ✓, Transfer ✓, Activities ✓, Payment ● */}
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto py-1 text-xs">
            <div className="flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0">
              <span className="text-[11px]">✓</span>
              <span>{t('booking.trip')}</span>
            </div>

            <span className="text-[var(--text-primary)]/30 text-xs flex-shrink-0">›</span>

            <div className="flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0">
              <span className="text-[11px]">✓</span>
              <span>{language === 'ar' ? 'الفندق' : 'Hotel'}</span>
            </div>

            <span className="text-[var(--text-primary)]/30 text-xs flex-shrink-0">›</span>

            <div className="flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0">
              <span className="text-[11px]">✓</span>
              <span>{language === 'ar' ? 'الانتقالات' : 'Transfer'}</span>
            </div>

            <span className="text-[var(--text-primary)]/30 text-xs flex-shrink-0">›</span>

            <div className="flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-shrink-0">
              <span className="text-[11px]">✓</span>
              <span>{language === 'ar' ? 'الأنشطة' : 'Activities'}</span>
            </div>

            <span className="text-[var(--text-primary)]/30 text-xs flex-shrink-0">›</span>

            {/* Payment Active */}
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold bg-[var(--surface-container)]/10 px-3 py-1 rounded-full border border-[var(--text-secondary)]/30 flex-shrink-0 ring-1 ring-[var(--text-secondary)]/20">
              <Lock className="w-3 h-3 text-[var(--text-secondary)]" />
              <span>Payment ●</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb / Back Button */}
        <div className="mb-6">
          <button
            type="button"
            id="back-to-review-btn"
            onClick={onBackToReview}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-[var(--surface-card)] px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('booking.backToReview')}</span>
          </button>
        </div>

        {/* Page Heading & Supporting Text */}
        <div className="mb-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-container)]/10 text-[var(--text-secondary)] text-xs font-bold border border-[var(--text-secondary)]/20 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('booking.finalStep')}</span>
            </span>
            <span className="text-xs text-[var(--text-primary)]/60 font-semibold">
              {t('booking.oneStepAway')}
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl chart-heading font-bold text-[var(--text-primary)] tracking-tight">
            {language === 'ar' ? 'إتمام الحجز' : 'Complete your booking'}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-primary)]/70 max-w-3xl leading-relaxed">
            {t('booking.confirmDetailsPay')}
          </p>
        </div>

        {/* 2-Column Responsive Layout: Left = Forms & Trust, Right = Trip Summary & Price */}
        <form onSubmit={handlePayAndConfirm} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Payment Methods, Card Form, Billing Info, Trust & Terms (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-8">
            {/* 1. PAYMENT METHOD SELECTION */}
            <div
              id="payment-method-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5"
            >
              <div className="border-b border-[var(--text-primary)]/8 pb-3">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  {t('booking.paymentOptions')}
                </span>
                <h3 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)] mt-0.5">
                  {t('booking.howToPayQuestion')}
                </h3>
              </div>

              {/* Honesty banner: no payment gateway is integrated yet. The card
                  form still accepts digits so a traveler can rehearse checkout,
                  but it must never read as a working online payment. */}
              {arePaymentsSimulated && (
                <div
                  role="status"
                  className="p-3.5 rounded-2xl border border-amber-300/60 bg-amber-50/80 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    {language === 'ar'
                      ? 'الدفع الإلكتروني في وضع تجريبي حاليًا — بطاقتك لن تُخصم ولن يتواصل أي بوابة دفع. لو حابب تأكد حجزك فعلًا، اختار «الدفع عند الوصول».'
                      : 'Online payment is in demo mode right now — no card is charged and no payment gateway is contacted. To secure your booking for real, choose “Pay on arrival”.'}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {/* Option 1: Card (Paymob / Stripe Gateway) */}
                <label
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start justify-between cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-[var(--text-secondary)] bg-[var(--surface-card)] shadow-xs'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-card)]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="mt-1 w-4 h-4 text-[var(--text-secondary)] focus:ring-[var(--text-secondary)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">{language === 'ar' ? 'بطاقة (Paymob / Stripe)' : 'Card (Paymob / Stripe)'}</span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70 font-medium">
                        {language === 'ar'
                          ? 'فيزا، ماستركارد، ميزة · بنبعت آخر ٤ أرقام بس'
                          : 'Visa, Mastercard, Meeza · only the last 4 digits are sent'}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {language === 'ar' ? 'حجز فوري' : 'Instant Hold'}
                  </span>
                </label>

                {/* Option 2: Mobile Wallets (Vodafone Cash, Orange, Etisalat, WE) */}
                <label
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start justify-between cursor-pointer ${
                    paymentMethod === 'wallet'
                      ? 'border-[var(--text-secondary)] bg-[var(--surface-card)] shadow-xs'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-card)]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="wallet"
                      checked={paymentMethod === 'wallet'}
                      onChange={() => setPaymentMethod('wallet')}
                      className="mt-1 w-4 h-4 text-[var(--text-secondary)] focus:ring-[var(--text-secondary)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">{language === 'ar' ? 'فودافون كاش ومحافظ مصر' : 'Vodafone Cash / Egypt Wallets'}</span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70 font-medium">
                        {language === 'ar' ? 'فودافون كاش، أورنج موني، اتصالات كاش، وي باي (بيطلب الرقم السري فورًا)' : 'Vodafone Cash, Orange Money, Etisalat Cash, WE Pay (Instant PIN Prompt)'}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {language === 'ar' ? 'محافظ محلية' : 'Local Wallets'}
                  </span>
                </label>

                {/* Option 3: InstaPay Egypt (IPA / Instant Bank Transfer) */}
                <label
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start justify-between cursor-pointer ${
                    paymentMethod === 'instapay'
                      ? 'border-[var(--text-secondary)] bg-[var(--surface-card)] shadow-xs'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-card)]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="instapay"
                      checked={paymentMethod === 'instapay'}
                      onChange={() => setPaymentMethod('instapay')}
                      className="mt-1 w-4 h-4 text-[var(--text-secondary)] focus:ring-[var(--text-secondary)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">{language === 'ar' ? 'إنستاباي مصر (IPN)' : 'InstaPay Egypt (IPN)'}</span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70 font-medium">
                        {language === 'ar' ? 'تحويل فوري بدون رسوم عبر شبكة البنك المركزي المصري' : 'Instant zero-fee transfer via Central Bank of Egypt IPN network'}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {language === 'ar' ? 'بدون رسوم' : 'Zero Fees'}
                  </span>
                </label>

                {/* Option 4: Pay on arrival */}
                <label
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start justify-between cursor-pointer ${
                    paymentMethod === 'arrival'
                      ? 'border-[var(--text-secondary)] bg-[var(--surface-card)] shadow-xs'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-card)]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="arrival"
                      checked={paymentMethod === 'arrival'}
                      onChange={() => setPaymentMethod('arrival')}
                      className="mt-1 w-4 h-4 text-[var(--text-secondary)] focus:ring-[var(--text-secondary)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">{language === 'ar' ? 'ادفع عند الوصول (في دهب)' : 'Pay on arrival (Dahab Check-in)'}</span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70">
                        {language === 'ar' ? 'احجز بقسيمة ضمان، وادفع في الفندق أو مركز الغطس' : 'Hold with booking guarantee voucher, settle in hotel / dive center'}
                      </p>
                    </div>
                  </div>
                </label>

                {/* Option 5: Cash */}
                <label
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start justify-between cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'border-[var(--text-secondary)] bg-[var(--surface-card)] shadow-xs'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-card)]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                      className="mt-1 w-4 h-4 text-[var(--text-secondary)] focus:ring-[var(--text-secondary)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">{language === 'ar' ? 'كاش للمرشد البدوي أو السائق' : 'Cash to Bedouin Guide / Driver'}</span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]/70">
                        {language === 'ar' ? 'الدفع كاش وقت المقابلة (جنيه، دولار، أو يورو)' : 'Settle directly in cash (EGP, USD, or EUR) upon meetup'}
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              {/* Realistic Policy Notice */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 flex items-start gap-2.5 text-xs text-[var(--text-primary)]/75">
                <Info className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
                <p>
                  All bookings trigger real-time Twilio SMS confirmations to drivers and dive masters for flawless synchronization.
                </p>
              </div>
            </div>

            {/* 2. SPECIFIC PAYMENT FORM DETAILS */}
            {paymentMethod === 'card' && (
              <div
                id="card-payment-form-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between border-b border-[var(--text-primary)]/8 pb-3">
                  <div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                      {language === 'ar' ? 'بيانات البطاقة' : 'Card Details'}
                    </span>
                    <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)] mt-0.5">
                      {language === 'ar' ? 'بوابة بطاقات الائتمان والخصم' : 'Credit & Debit Card Gateway'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex bg-[var(--surface-card)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs">
                      <button
                        type="button"
                        onClick={() => setCardGateway('PAYMOB')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${cardGateway === 'PAYMOB' ? 'bg-[var(--surface-container)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-primary)]/70'}`}
                      >
                        Paymob
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardGateway('STRIPE')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${cardGateway === 'STRIPE' ? 'bg-[var(--surface-container)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-primary)]/70'}`}
                      >
                        Stripe
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                      <Lock className="w-3 h-3 text-emerald-700" />
                      <span>
                        {language === 'ar' ? 'رقم الكارت مبيخرجش من جهازك' : 'Card number stays on your device'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="cardholder-name-input" className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                      {language === 'ar' ? 'اسم حامل البطاقة' : 'Cardholder name'}
                    </label>
                    <input
                      type="text"
                      id="cardholder-name-input"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      placeholder={language === 'ar' ? 'الاسم كما هو على البطاقة' : 'Name as printed on the card'}
                      className="w-full px-4 py-3 rounded-2xl border border-[var(--text-primary)]/15 focus:outline-none focus:border-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--text-secondary)] bg-[var(--surface-card)] text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                      {language === 'ar' ? 'رقم البطاقة' : 'Card number'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="card-number-input"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        className="w-full px-4 py-3 rounded-2xl border border-[var(--text-primary)]/15 focus:outline-none focus:border-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--text-secondary)] bg-[var(--surface-card)] text-sm font-mono"
                        required
                      />
                      <div className="absolute end-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <CreditCard className="w-4 h-4 text-[var(--text-primary)]/40" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                        {language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry date'}
                      </label>
                      <input
                        type="text"
                        id="card-expiry-input"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM / YY"
                        maxLength={7}
                        className="w-full px-4 py-3 rounded-2xl border border-[var(--text-primary)]/15 focus:outline-none focus:border-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--text-secondary)] bg-[var(--surface-card)] text-sm text-center font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                        CVV
                      </label>
                      <input
                        type="password"
                        id="card-cvv-input"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-4 py-3 rounded-2xl border border-[var(--text-primary)]/15 focus:outline-none focus:border-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--text-secondary)] bg-[var(--surface-card)] text-sm text-center font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)] block">
                        Verified by {cardGateway}
                      </span>
                      <p className="text-xs text-[var(--text-primary)]/70 leading-relaxed">
                        {language === 'ar' ? 'معالجة فورية للدفع مع تحقق 3D Secure.' : 'Instant payment processing with 3D Secure verification.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'wallet' && (
              <div
                id="wallet-payment-form-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5 animate-in fade-in duration-200"
              >
                <div className="border-b border-[var(--text-primary)]/8 pb-3">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-red-700 block">
                    {language === 'ar' ? 'المحفظة الإلكترونية - مصر' : 'Mobile Wallet Egypt'}
                  </span>
                  <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)] mt-0.5">
                    {language === 'ar' ? 'فودافون كاش ومحافظ شركات الاتصالات' : 'Vodafone Cash & Telecom Wallets'}
                  </h3>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {([
                    { id: 'vodafone', name: 'Vodafone', color: 'border-red-500 text-red-700' },
                    { id: 'orange', name: 'Orange', color: 'border-orange-500 text-orange-700' },
                    { id: 'etisalat', name: 'Etisalat', color: 'border-emerald-500 text-emerald-700' },
                    { id: 'wepay', name: 'WE Pay', color: 'border-purple-500 text-purple-700' }
                  ] as const).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWalletProvider(w.id)}
                      className={`p-2.5 rounded-2xl border text-xs font-bold text-center transition-all ${
                        walletProvider === w.id
                          ? 'border-[var(--text-secondary)] bg-[var(--surface-container)] text-[var(--text-primary)] shadow-xs'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)]/80 hover:border-[var(--border-subtle)]'
                      }`}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    {language === 'ar' ? 'رقم المحفظة المسجّل (مثال: ٠١٠، ٠١١، ٠١٢، ٠١٥)' : 'Registered Wallet Number (e.g. 010, 011, 012, 015)'}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      id="wallet-phone-input"
                      value={walletPhone}
                      onChange={(e) => setWalletPhone(e.target.value)}
                      placeholder="0100 123 4567"
                      className="w-full px-4 py-3 rounded-2xl border border-[var(--text-primary)]/15 focus:outline-none focus:border-[var(--text-secondary)] font-mono text-sm"
                      required
                    />
                    <Smartphone className="w-4 h-4 text-[var(--text-primary)]/40 absolute end-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-[12px] text-[var(--text-primary)]/65">
                    You will receive an instant push authorization request or OTP on your mobile wallet app.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'instapay' && (
              <div
                id="instapay-payment-form-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5 animate-in fade-in duration-200"
              >
                <div className="border-b border-[var(--text-primary)]/8 pb-3">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-secondary)] block">
                    {language === 'ar' ? 'شبكة الدفع الفوري - البنك المركزي' : 'Central Bank Instant Payment Network'}
                  </span>
                  <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)] mt-0.5">
                    {language === 'ar' ? 'إنستاباي مصر (عنوان IPA)' : 'InstaPay Egypt (IPA Handle)'}
                  </h3>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    {language === 'ar' ? 'عنوان الإنستاباي بتاعك (IPA)' : 'Your InstaPay Address (IPA)'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="instapay-handle-input"
                      value={instapayAddress}
                      onChange={(e) => setInstapayAddress(e.target.value)}
                      placeholder="username@instapay"
                      className="w-full px-4 py-3 rounded-2xl border border-[var(--text-primary)]/15 focus:outline-none focus:border-[var(--text-secondary)] font-mono text-sm"
                      required
                    />
                    <Zap className="w-4 h-4 text-[var(--accent-secondary)] absolute end-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                    <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0" />
                    <span>{language === 'ar' ? 'خصم فوري بدون رسوم مباشرة من حسابك البنكي المصري.' : 'Instant debit with 0% transaction fees directly from your Egyptian bank account.'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. BILLING INFORMATION (Optional / Pre-filled) */}
            <div
              id="billing-info-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-4"
            >
              <div className="border-b border-[var(--text-primary)]/8 pb-3">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  {language === 'ar' ? 'بيانات التواصل' : 'Traveler Contact'}
                </span>
                <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)] mt-0.5">
                  {language === 'ar' ? 'بيانات الفوترة' : 'Billing information'}
                </h3>
                <p className="text-xs text-[var(--text-primary)]/60">
                  {language === 'ar' ? 'متعبّية من ملفك الشخصي' : 'Pre-filled from your traveler profile'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    {language === 'ar' ? 'الاسم بالكامل' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    id="billing-name-input"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-[var(--text-primary)]/15 bg-[var(--surface-card)] text-sm focus:outline-none focus:border-[var(--text-secondary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    {language === 'ar' ? 'إيميل التأكيد' : 'Email for Confirmation'}
                  </label>
                  <input
                    type="email"
                    id="billing-email-input"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-[var(--text-primary)]/15 bg-[var(--surface-card)] text-sm focus:outline-none focus:border-[var(--text-secondary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    {language === 'ar' ? 'الموبايل (تحديثات واتساب)' : 'Phone (WhatsApp updates)'}
                  </label>
                  <input
                    type="tel"
                    id="billing-phone-input"
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-[var(--text-primary)]/15 bg-[var(--surface-card)] text-sm focus:outline-none focus:border-[var(--text-secondary)]"
                  />
                </div>
              </div>
            </div>

            {/* 4. BOOKING PROTECTION / TRUST */}
            <div
              id="booking-protection-trust-card"
              className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {language === 'ar' ? 'حماية الحجز' : 'Booking Protection'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--text-primary)]/85 font-medium">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8">
                  <Check className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                  <span>{language === 'ar' ? 'دفع آمن' : 'Secure checkout'}</span>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8">
                  <Check className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                  <span>{language === 'ar' ? 'البيانات محفوظة في رحلتك' : 'Details saved in trip'}</span>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8">
                  <Check className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                  <span>{language === 'ar' ? 'دعم لو خططك اتغيّرت' : 'Support if plans change'}</span>
                </div>
              </div>
            </div>

            {/* 5. TERMS CONFIRMATION CHECKBOX */}
            <div
              id="payment-terms-agreement-card"
              className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs space-y-3"
            >
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="payment-agree-terms-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-[var(--border-subtle)] cursor-pointer"
                />
                <div className="text-xs sm:text-sm text-[var(--text-primary)]/90 leading-relaxed font-medium">
                  <span>{language === 'ar' ? 'أوافق على شروط الحجز وسياسات الإلغاء.' : 'I agree to the booking terms and cancellation policies.'}</span>
                  <div className="mt-1">
                    <button
                      type="button"
                      id="view-payment-terms-modal-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTermsModal(true);
                      }}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 cursor-pointer"
                    >
                      {language === 'ar' ? 'اعرض الشروط' : 'View terms'}
                    </button>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* RIGHT COLUMN: Trip Summary + Price Breakdown + Sticky CTA (lg:col-span-5) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-6">
            {/* 1. COMPACT TRIP SUMMARY AT TOP */}
            <div
              id="payment-trip-summary-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between border-b border-[var(--text-primary)]/8 pb-3">
                <div>
                  <span className="text-[11px] font-black tracking-wider uppercase text-[var(--text-secondary)] block">
                    {language === 'ar' ? 'الملخّص' : 'Summary'}
                  </span>
                  <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                    {language === 'ar' ? 'رحلة دهب' : 'Dahab Trip'}
                  </h3>
                  <p className="text-xs text-[var(--text-primary)]/60 mt-0.5">
                    {[
                      `${activeTrip?.lengthDays ?? profile.lengthDays ?? 5} ${language === 'ar' ? 'أيام' : 'Days'}`,
                      travelersLabel,
                      formatTripDateRange(activeTrip?.startDate, activeTrip?.endDate, language === 'ar' ? 'ar' : 'en')
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <button
                  type="button"
                  id="edit-trip-from-payment-btn"
                  onClick={onBackToReview}
                  className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 cursor-pointer"
                >
                  {language === 'ar' ? 'تعديل الرحلة' : 'Edit trip'}
                </button>
              </div>

              {/* 4 Compact Component List */}
              <div className="space-y-2.5 text-xs text-[var(--text-primary)]/85">
                <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Building className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span>{selectedHotel ? selectedHotel.name : 'Dahab Bay Hotel'}</span>
                  </span>
                  <span className="text-[var(--text-primary)]/60 text-[12px]">5 nights</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Car className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span>{selectedTransfer ? selectedTransfer.title : 'Private Car'}</span>
                  </span>
                  <span className="text-[var(--text-primary)]/60 text-[12px]">Airport → Hotel</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Waves className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{selectedDiving ? selectedDiving.title : 'Guided Diving'}</span>
                  </span>
                  <span className="text-[var(--text-primary)]/60 text-[12px]">Day {divingDay} · {divingTime}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-card)] border border-[var(--text-primary)]/6">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Compass className="w-3.5 h-3.5 text-amber-700" />
                    <span>{selectedSafari ? selectedSafari.title : 'Desert Safari'}</span>
                  </span>
                  <span className="text-[var(--text-primary)]/60 text-[12px]">Day {safariDay} · {safariTime}</span>
                </div>
              </div>
            </div>

            {/* 2. PRICE SUMMARY CARD */}
            <div
              id="payment-price-breakdown-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-sm space-y-5"
            >
              <div className="border-b border-[var(--text-primary)]/8 pb-3">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  {language === 'ar' ? 'تفاصيل التكلفة' : 'Cost Breakdown'}
                </span>
                <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)] mt-0.5">
                  {language === 'ar' ? 'إجمالي الرحلة' : 'Trip Total'}
                </h3>
              </div>

              {/* Exact Line Items without invented fees */}
              <div className="space-y-3 text-xs text-[var(--text-primary)]/80">
                <div className="flex items-center justify-between">
              <span>{t('booking.hotel')}</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    EGP {hotelPrice.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>{language === 'ar' ? 'الانتقالات' : 'Transfer'}</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    EGP {transferPrice.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>{language === 'ar' ? 'الغطس' : 'Diving'}</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    EGP {divingPrice.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>{language === 'ar' ? 'السفاري' : 'Safari'}</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    EGP {safariPrice.toLocaleString()}
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-[var(--border-subtle)] pt-3" />

                {/* Trip Total */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {language === 'ar' ? 'إجمالي الرحلة:' : 'Trip total:'}
                    </span>
                    <span className="text-2xl font-black text-[var(--text-primary)]">
                      EGP {totalTripPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--text-primary)]/60 font-semibold">
                    {language === 'ar'
                      ? `الإجمالي التقديري لـ${travelersLabel}`
                      : `Estimated total for ${travelersLabel.toLowerCase()}`}
                  </div>

                  {/* P4 trust: why is the total the total — catalogue truth,
                      not arithmetic. */}
                  <button
                    type="button"
                    id="price-explainer-toggle"
                    onClick={togglePriceExplainer}
                    aria-expanded={showPriceExplainer}
                    className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[var(--accent-primary)] hover:underline underline-offset-4 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{language === 'ar' ? 'ليه الإجمالي كده؟' : 'Why this total?'}</span>
                  </button>
                  {showPriceExplainer && (
                    <div className="mt-2 p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-2">
                      {priceExplanation ? (
                        // Amounts shown are the storefront charge lines this
                        // checkout will actually settle (hotelPrice,
                        // transferPrice, …) — the same numbers in the
                        // breakdown above. The backend contributes the
                        // pricing BASIS (per-person vs per-stay) and the
                        // supplier's cancellation window, so the why comes
                        // from catalogue truth while the what-you-pay comes
                        // from the charge itself.
                        [
                          { key: 'hotel', skuId: 'SKU-HTL-001', label: language === 'ar' ? 'الفندق' : 'Hotel', basis: 'per_stay', unit: null as number | null, amount: hotelPrice, policy: priceExplanation.lines.find(l => l.skuId === 'SKU-HTL-001')?.cancellationPolicyHours ?? 48 },
                          { key: 'transfer', skuId: selectedTransfer?.id === 'private-car' ? 'SKU-TRF-001' : 'SKU-TRF-002', label: language === 'ar' ? 'الانتقالات' : 'Transfer', basis: 'per_person', unit: Math.round(transferPrice / travelers), amount: transferPrice, policy: priceExplanation.lines.find(l => l.skuId === (selectedTransfer?.id === 'private-car' ? 'SKU-TRF-001' : 'SKU-TRF-002'))?.cancellationPolicyHours ?? 24 },
                          { key: 'diving', skuId: 'SKU-DIV-001', label: language === 'ar' ? 'الغطس' : 'Diving', basis: 'per_person', unit: Math.round(divingPrice / travelers), amount: divingPrice, policy: priceExplanation.lines.find(l => l.skuId === 'SKU-DIV-001')?.cancellationPolicyHours ?? 24 },
                          { key: 'safari', skuId: 'SKU-SAF-001', label: language === 'ar' ? 'السفاري' : 'Safari', basis: 'per_person', unit: Math.round(safariPrice / travelers), amount: safariPrice, policy: priceExplanation.lines.find(l => l.skuId === 'SKU-SAF-001')?.cancellationPolicyHours ?? 24 },
                        ].filter(item => item.amount > 0).map(item => (
                          <div key={item.key} className="flex items-start justify-between gap-2 text-[12px]">
                            <span className="min-w-0">
                              <span className="block font-bold text-[var(--text-primary)]">{item.label}</span>
                              <span className="block text-[var(--text-secondary)]">
                                {language === 'ar'
                                  ? item.basis === 'per_stay'
                                    ? `سعر الإقامة كاملة · إلغاء قبل ${item.policy} ساعة`
                                    : `${travelers} × ${item.unit?.toLocaleString()} ج.م للفرد · إلغاء قبل ${item.policy} ساعة`
                                  : item.basis === 'per_stay'
                                    ? `Whole-stay price · free cancellation ${item.policy}h before`
                                    : `${travelers} × EGP ${item.unit?.toLocaleString()} per person · free cancellation ${item.policy}h before`}
                              </span>
                            </span>
                            <span className="font-bold text-[var(--text-primary)] flex-shrink-0 tabular-nums">
                              EGP {item.amount.toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : priceExplanationError ? (
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          {language === 'ar'
                            ? 'مش قادرين نجيب تفاصيل الأسعار دلوقتي — جرّب تاني.'
                            : 'Could not load the price details right now — try again.'}
                        </p>
                      ) : (
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          {language === 'ar' ? 'جاري الحساب…' : 'Calculating…'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* A failed settlement has to be visible here. The traveller
                  previously saw the confirmation screen regardless. */}
              {(checkout.phase === 'priceChanged' || checkout.phase === 'failed') && checkout.outcome && checkout.outcome.kind !== 'confirmed' && (
                <CheckoutIssuePanel
                  className="mt-4"
                  priceChange={checkout.outcome.kind === 'priceChanged' ? checkout.outcome : null}
                  issue={checkout.outcome.kind === 'failed' ? checkout.outcome.issue : null}
                  busy={checkout.busy}
                  onConfirmPrice={() => { void checkout.confirmPrice(); }}
                  onRehold={() => { void checkout.rehold(); }}
                  onRetry={() => { void checkout.rehold(); }}
                  onSignIn={() => { setIntendedRoute('/trip-builder'); navigateTo('/auth/sign-in'); }}
                  onContactSupport={() => navigateTo('/help')}
                  onPickAnotherDate={onBackToReview}
                  onDismiss={checkout.reset}
                  alternativesQuery={(() => {
                    const failed = checkout.outcome.kind === 'failed' ? checkout.outcome : null;
                    const line = failed && checkout.lastRequest?.lines.find(l => l.skuId === failed.issue.skuId);
                    return line && bookingTripId
                      ? { tripId: bookingTripId, skuId: line.skuId, date: line.scheduledDate, timeSlot: line.scheduledTime, passengersCount: line.passengersCount }
                      : null;
                  })()}
                />
              )}

              {settlementError && (
                <div
                  role="alert"
                  className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 space-y-2"
                >
                  <p className="font-bold text-sm">
                    {isRTL ? 'لم يتم إتمام الحجز' : 'Your booking was not completed'}
                  </p>
                  <p className="text-sm leading-relaxed">{settlementError}</p>
                  {/^.*(سجّل دخولك|sign in).*$/i.test(settlementError) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIntendedRoute('/trip-builder');
                        navigateTo('/auth/sign-in');
                      }}
                      className="mt-1 px-4 py-2 rounded-full bg-rose-900 text-white text-xs font-bold cursor-pointer"
                    >
                      {isRTL ? 'تسجيل الدخول' : 'Sign in'}
                    </button>
                  )}
                </div>
              )}

              {/* No gateway is integrated, so nothing is charged. The traveler
                  is told before they press the button, not after — the flow
                  otherwise takes a card number, says "Confirmed" and leaves
                  them believing they have paid. */}
              {arePaymentsSimulated && (
                <div
                  role="note"
                  className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 space-y-1"
                >
                  <p className="text-sm font-bold text-amber-900">
                    {language === 'ar'
                      ? 'مفيش أي مبلغ هيتخصم دلوقتي'
                      : 'No money will be taken now'}
                  </p>
                  <p className="text-xs text-amber-900/80 leading-relaxed">
                    {language === 'ar'
                      ? 'المنصّة لسه مش موصولة ببوابة دفع. الحجز هيتسجّل وهيوصل للمزوّد، والدفع بيتم معاه مباشرة.'
                      : 'This platform is not connected to a payment gateway yet. Your booking is recorded and sent to the provider, and you pay them directly.'}
                  </p>
                </div>
              )}

              {/* Primary & Secondary CTA Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  id="pay-and-confirm-trip-btn"
                  disabled={!agreedToTerms || isProcessing}
                  className={`w-full py-4 px-6 rounded-full font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                    agreedToTerms && !isProcessing
                      ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] active:scale-98'
                      : 'bg-[var(--surface-container)]/10 text-[var(--text-primary)]/40 cursor-not-allowed'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {arePaymentsSimulated
                      ? language === 'ar'
                        ? `أكّد الحجز (${totalTripPrice.toLocaleString()} ج.م تُدفع للمزوّد)`
                        : `Confirm Booking (EGP ${totalTripPrice.toLocaleString()}, paid to the provider)`
                      : language === 'ar'
                        ? `ادفع وأكّد الرحلة (${totalTripPrice.toLocaleString()} ج.م)`
                        : `Pay & Confirm Trip (EGP ${totalTripPrice.toLocaleString()})`}
                  </span>
                </button>

                <button
                  type="button"
                  id="payment-back-to-review-btn"
                  onClick={onBackToReview}
                  className="w-full py-2.5 px-4 rounded-full font-bold text-xs text-[var(--text-primary)]/70 hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]/5 border border-[var(--border-subtle)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'الرجوع للمراجعة' : 'Back to Review'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* 3. MOBILE FIXED BOTTOM ACTION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--btn-util-bg)] backdrop-blur-md border-t border-[var(--border-subtle)] p-4 shadow-lg flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            {language === 'ar' ? `الإجمالي لـ${travelersLabel}` : `Total for ${travelersLabel.toLowerCase()}`}
          </div>
          <div className="text-base font-black text-[var(--text-primary)]">
            EGP {totalTripPrice.toLocaleString()}
          </div>
        </div>

        <button
          type="button"
          id="mobile-pay-and-confirm-btn"
          disabled={!agreedToTerms || isProcessing}
          onClick={handlePayAndConfirm}
          className={`px-6 py-3 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
            agreedToTerms && !isProcessing
              ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-primary)]'
              : 'bg-[var(--surface-container)]/10 text-[var(--text-primary)]/40 cursor-not-allowed'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'ادفع وأكّد' : 'Pay & Confirm'}</span>
        </button>
      </div>

      {/* 4. REALISTIC PROCESSING STATE MODAL */}
      {isProcessing && (
        <div
          id="payment-processing-modal"
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-payment-step-dialog-1-title"
    >
          <div className="bg-[var(--surface-card)] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[var(--border-subtle)] text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-[var(--surface-container)]/10 text-[var(--text-secondary)] flex items-center justify-center mx-auto ring-8 ring-[var(--text-secondary)]/5 animate-pulse">
              <Sparkles className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h3 id="booking-payment-step-dialog-1-title" className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                {language === 'ar' ? 'بنأكد حجز رحلتك في دهب...' : 'Confirming your Dahab trip...'}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-primary)]/70 leading-relaxed">
                {language === 'ar'
                  ? 'بنقفل حجوزاتك ونجمعها كلها في كارت رحلة واحد منظم.'
                  : "We're confirming your bookings and putting everything together in one trip."}
              </p>
            </div>

            {/* Micro Activity Checkpoints */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--text-primary)]/8 text-[12px] text-[var(--text-primary)]/70 space-y-1.5 text-start">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {language === 'ar' ? 'الأوضة اتأكدت مع فندق دهب باي' : 'Hotel room locked with Dahab Bay Hotel'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {language === 'ar' ? 'اتعينلك سواق خاص للمطار ومستنيك' : 'Private airport driver assigned'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {language === 'ar' ? 'معدات الغطس والمرشد اتحجزوا' : 'Diving gear & guide reserved'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {language === 'ar' ? 'تصريح السفاري البدوي اتجهز' : 'Desert Bedouin safari permit issued'}
                </span>
              </div>
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
