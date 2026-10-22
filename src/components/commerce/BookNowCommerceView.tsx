import React, { useState, useMemo, useEffect, useRef } from 'react';
import { api, RichAvailabilityResponse } from '../../services/api';
import {
  Waves,
  Car,
  Compass,
  Coffee,
  Flame,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Phone,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ChevronRight,
  Search,
  Check,
  Luggage,
  Loader2,
  X
} from 'lucide-react';
import { availabilitySlotViews, AvailabilitySlotView, bookingActionError, BookingErrorInfo } from '../../services/bookingManage';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConfirmedBookingItem, TimelineActivity } from '../../types';
import { IN_DESTINATION_SERVICES, InDestinationServiceOption, BookNowCategory } from './BookNowCommerceModal';
import { INITIAL_LIVE_DAHAB_CONDITIONS } from '../../data/dahabGeography';
import { analytics } from '../../services/analytics';
import type { ProductSkuEntity } from '../../shared/types/commerce';
import { useCurrency } from '../../context/CurrencyContext';
import { useHeldCheckout } from '../../hooks/useHeldCheckout';
import { newAttemptKey, type HeldCheckoutOutcome } from '../../services/heldCheckout';
import { checkoutIssueFrom, checkoutIssueMessage } from '../../services/checkoutError';
import { quoteLine } from '../../services/pricingQuote';
import { createPlanningTrip } from '../../services/tripLifecycle';
import { CheckoutIssuePanel } from './CheckoutIssuePanel';

/** YYYY-MM-DD in the traveler's local timezone — how the UI labels dates. */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Maps a thrown failure to its user-facing sentence — never the raw backend text. */
function liveErrorText(err: unknown, t: (key: string) => string): string {
  const info = bookingActionError(err);
  switch (info.code) {
    case 'unauthorized': return t('bookings.error.unauthorized');
    case 'forbidden': return t('bookings.error.forbidden');
    case 'notFound': return t('bookings.error.notFound');
    case 'conflict': return t('bookings.error.conflict');
    case 'invalidState': return t('bookings.error.invalidState');
    case 'rateLimited': return t('bookings.error.rateLimited');
    case 'server': return t('bookings.error.server');
    case 'network': return t('bookings.error.network');
    default: return t('bookings.error.unknown');
  }
}

export const BookNowCommerceView: React.FC = () => {
  const {
    navigateTo,
    recordBooking,
    recordLedgerEntry,
    showToast,
    profile,
    tripDays,
    bookings,
    isSignedIn,
    sessionUser,
    activeTrip,
    setIntendedRoute,
    selectedSkuId,
    reloadTrip,
    openTrip
  } = useTrip();
  const { language, isRTL , t} = useLanguage();
  const { formatEGP } = useCurrency();
  /** A trip created for this booking, kept so a retry does not create another. */
  const createdTripIdRef = useRef<string | null>(null);
  const checkout = useHeldCheckout({
    keyPrefix: 'BOOKNOW',
    onConfirmed: outcome => recordConfirmedBooking(outcome),
  });
  /** Why the instant booking failed, if it did. Shown instead of a voucher. */
  const [instantBookingError, setInstantBookingError] = useState<string | null>(null);
  const instantBookingErrorRef = useRef<HTMLParagraphElement>(null);
  const travelerPhoneInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (instantBookingError) {
      instantBookingErrorRef.current?.focus();
    }
  }, [instantBookingError]);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<BookNowCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all');

  // Currently configuring service for checkout
  const [activeService, setActiveService] = useState<InDestinationServiceOption | null>(null);
  /** Set when this page was opened on a product that is not one of the eight cards. */
  const [requestedSku, setRequestedSku] = useState<ProductSkuEntity | null>(null);
  const [skuLookupFailed, setSkuLookupFailed] = useState<boolean>(false);

  // Booking configuration options
  const [guestsCount, setGuestsCount] = useState<number>(1);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('immediate');
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [shoeSize, setShoeSize] = useState<string>('42 EU');
  const [specialNotes, setSpecialNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'arrival' | 'instapay'>('arrival');
  /**
   * Contact phone for the booking.
   *
   * `travelerPhone` is a server-required field — a blank used to reach the
   * checkout endpoint and come back as a 400 the panel reported as a generic
   * "couldn't complete" retry loop. Sign-up does not collect a phone and the
   * profile dialog is where one gets added, so the panel owns the field now
   * and pre-fills it from every source the session can offer.
   */
  const [travelerPhone, setTravelerPhone] = useState<string>(() => profile.phone || sessionUser?.phone || '');

  // Completed voucher state
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBookingItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // Live availability for the selected product — server-reported only.
  // The backend owns the numbers (including held seats folded into
  // availableCapacity); this page only presents them and never decides
  // capacity itself. The slot views are re-derived whenever the party size or
  // product changes, and the CTA re-checks with the server at submit time so a
  // slot that sold out mid-configuration is caught there.
  // ---------------------------------------------------------------------------
  const [liveAvailability, setLiveAvailability] = useState<{ views: AvailabilitySlotView[]; response: RichAvailabilityResponse } | null>(null);
  const [liveState, setLiveState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [liveError, setLiveError] = useState<BookingErrorInfo | null>(null);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [pickedLiveSlot, setPickedLiveSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!activeService?.skuId || !activeService.serviceType) {
      setLiveAvailability(null);
      setLiveState('idle');
      setPickedLiveSlot(null);
      return;
    }
    let cancelled = false;
    setLiveState('loading');
    setLiveError(null);
    void (async () => {
      try {
        const response = await api.checkRichAvailability({
          serviceType: activeService.serviceType,
          skuId: activeService.skuId,
          date: localToday(),
          passengers: guestsCount
        });
        if (cancelled) return;
        setLiveAvailability({ views: availabilitySlotViews(response, guestsCount), response });
        setLiveState('ready');
        setPickedLiveSlot(null);
      } catch (err) {
        if (cancelled) return;
        setLiveError(bookingActionError(err));
        setLiveState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeService?.skuId, activeService?.serviceType, guestsCount, availabilityRetry]);

  /** True when the server says today has slots but none fit this party. */
  const liveNoFitToday =
    liveState === 'ready' &&
    liveAvailability !== null &&
    liveAvailability.views.length > 0 &&
    liveAvailability.views.every(v => v.kind === 'sold-out' || v.kind === 'fits-no-party');

  /**
   * Opens this page on the product the traveler actually chose.
   *
   * Book Now only ever opened on its own grid of eight hardcoded cards, so
   * "book this experience" and "book this itinerary line" had nowhere to point
   * and therefore did not exist. A `sku` in the URL is resolved here: first
   * against the eight cards, then — for anything that came from the catalogue
   * rather than this file — against the live inventory the server serves.
   */
  useEffect(() => {
    if (!selectedSkuId) {
      setRequestedSku(null);
      setSkuLookupFailed(false);
      return;
    }

    const card = IN_DESTINATION_SERVICES.find(svc => svc.skuId === selectedSkuId);
    if (card) {
      setActiveService(card);
      setRequestedSku(null);
      setSkuLookupFailed(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      // The vertical is not known from the id, so the verticals that have
      // inventory are asked in turn. Small and cached by the browser; a
      // dedicated by-id endpoint would be better if this grows.
      const verticals = ['diving', 'safari', 'transfer', 'hotel', 'wellness', 'dining'];
      const results = await Promise.allSettled(
        verticals.map(v => api.getInventory(v, controller.signal))
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const match = result.value.skus.find(sku => sku.id === selectedSkuId);
          if (match && !cancelled) {
            setRequestedSku(match);
            setSkuLookupFailed(false);
            return;
          }
        }
      }
      if (!cancelled) {
        setRequestedSku(null);
        setSkuLookupFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedSkuId]);

  /**
   * The chosen product rendered as a card, so the rest of this page — pricing,
   * guest count, checkout — works on it unchanged.
   *
   * Only fields the SKU actually carries are filled. The editorial texture the
   * eight hardcoded cards have (what to bring, meeting point, the supplier's
   * phone) has no equivalent on a SKU, and inventing it here is what would put
   * a fabricated meeting point in front of somebody who has paid.
   */
  const skuAsService: InDestinationServiceOption | null = useMemo(() => {
    if (!requestedSku) return null;
    return {
      id: requestedSku.id,
      category:
        requestedSku.serviceType === 'transfer'
          ? 'transport'
          : requestedSku.serviceType === 'diving'
          ? 'watersports'
          : requestedSku.serviceType === 'dining'
          ? 'dining'
          : requestedSku.serviceType === 'wellness'
          ? 'wellness'
          : 'tonight',
      title: requestedSku.title,
      titleAr: requestedSku.titleAr,
      subtitle: [requestedSku.routeFrom, requestedSku.routeTo].filter(Boolean).join(' → '),
      subtitleAr: [requestedSku.routeFrom, requestedSku.routeTo].filter(Boolean).join(' ← '),
      description: requestedSku.description,
      descriptionAr: requestedSku.description,
      basePriceEGP: requestedSku.basePriceEGP,
      currency: requestedSku.currency,
      durationStr: requestedSku.durationMinutes ? `${requestedSku.durationMinutes} minutes` : '',
      durationStrAr: requestedSku.durationMinutes ? `${requestedSku.durationMinutes} دقيقة` : '',
      pickupWindow: '',
      pickupWindowAr: '',
      availabilityBadge: 'Instant Ready',
      availabilityBadgeAr: 'متاح للحجز',
      locationArea: requestedSku.routeTo || 'Dahab',
      locationAreaAr: requestedSku.routeTo || 'دهب',
      supplierName: requestedSku.supplierId,
      supplierNameAr: requestedSku.supplierId,
      supplierPhone: '',
      meetingPoint: requestedSku.routeFrom || '',
      meetingPointAr: requestedSku.routeFrom || '',
      icon: Compass,
      whatToBring: requestedSku.includedItems || [],
      whatToBringAr: requestedSku.includedItems || [],
      skuId: requestedSku.id,
      serviceType: requestedSku.serviceType as InDestinationServiceOption['serviceType'],
      pricingBasis: requestedSku.pricingBasis
    };
  }, [requestedSku]);

  useEffect(() => {
    if (skuAsService) setActiveService(skuAsService);
  }, [skuAsService]);

  // Categories definition
  const categories: { id: BookNowCategory; labelEn: string; labelAr: string; icon: any }[] = [
    { id: 'all', labelEn: 'All Services', labelAr: 'جميع الخدمات', icon: Compass },
    { id: 'watersports', labelEn: 'Water & Diving', labelAr: 'الغوص والبحر', icon: Waves },
    { id: 'transport', labelEn: 'Desert Cabs & 4x4', labelAr: 'سيارات وسفاري', icon: Car },
    { id: 'tonight', labelEn: 'Tonight & Camps', labelAr: 'سهرات الليلة', icon: Flame },
    { id: 'wellness', labelEn: 'Massage & Recovery', labelAr: 'مساج وريكفري', icon: Sparkles },
    { id: 'dining', labelEn: 'Dinner Tables', labelAr: 'طاولات ومطاعم', icon: Coffee },
  ];

  // Filtered services
  const filteredServices = useMemo(() => {
    return IN_DESTINATION_SERVICES.filter((svc) => {
      // Category match
      if (selectedCategory !== 'all' && svc.category !== selectedCategory) {
        return false;
      }
      // Availability filter
      if (selectedAvailability !== 'all' && svc.availabilityBadge !== selectedAvailability) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = svc.title.toLowerCase().includes(q) || svc.titleAr.includes(q);
        const matchesLoc = svc.locationArea.toLowerCase().includes(q) || svc.locationAreaAr.includes(q);
        const matchesSupplier = svc.supplierName.toLowerCase().includes(q) || svc.supplierNameAr.includes(q);
        const matchesDesc = svc.description.toLowerCase().includes(q) || svc.descriptionAr.includes(q);
        return matchesTitle || matchesLoc || matchesSupplier || matchesDesc;
      }
      return true;
    });
  }, [selectedCategory, selectedAvailability, searchQuery]);

  // Handle service selection for booking
  const handleSelectService = (svc: InDestinationServiceOption) => {
    setActiveService(svc);
    setConfirmedBooking(null);
    checkout.reset();
    setPickupLocation(profile?.savedPlaces?.[0] || 'Lighthouse Promenade / My Hotel');
    // Smooth scroll to booking details drawer if on mobile
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const el = document.getElementById('instant-checkout-panel');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  /**
   * What checkout will actually be charged.
   *
   * Delegates to the shared rule so this cannot drift from the server's
   * `priceSkuLine`; see tests/domain/pricingQuoteParity.test.ts. It used to be
   * `basePriceEGP * guestsCount` unconditionally, so any hotel reached through
   * this page — AccommodationDetailView sends a hotel sku here — quoted double
   * the server's figure for a room booked for two, and was rejected with 409
   * PRICE_CHANGED at the last step.
   *
   * null means the basis cannot be priced from a party size (a per-night room
   * rate needs the dates), so the figure is withheld rather than guessed.
   */
  const calculatedPrice = useMemo(() => {
    if (!activeService) return null;
    return quoteLine(activeService.basePriceEGP, activeService.pricingBasis, guestsCount);
  }, [activeService, guestsCount]);

  /**
   * The slot the hold is taken on: a live server slot when the traveller
   * picked one (so the hold lands on that exact inventory), otherwise today's
   * "right now" or evening request.
   */
  const instantSlot = useMemo(() => {
    const live = pickedLiveSlot ? liveAvailability?.views.find(v => v.id === pickedLiveSlot) : undefined;
    return {
      date: localToday(),
      timeSlot: live?.timeSlot ?? (selectedTimeSlot === 'sunset' ? '05:00 PM' : 'ASAP'),
    };
  }, [pickedLiveSlot, liveAvailability, selectedTimeSlot]);

  const instantSlotLabel = () =>
    instantSlot.timeSlot === 'ASAP'
      ? t('commerce.slot.todayAsap')
      : t('commerce.slot.todayAt', { time: instantSlot.timeSlot });

  // Execute instant escrow booking
  /**
   * Books for real.
   *
   * This was a setTimeout that minted a reference locally and showed
   * "تم تأكيد الحجز الفوري!" — an end-to-end test recorded **zero network
   * calls** and nothing written anywhere; the booking vanished on refresh. It
   * now settles through /api/commerce/checkout/multi, the same audited endpoint
   * the planner uses, and the reference shown is the server's.
   */
  const handleConfirmInstantBooking = async () => {
    if (!activeService || isSubmitting || checkout.busy) return;
    checkout.reset();

    if (!isSignedIn) {
      setIntendedRoute('/book-now');
      showToast(
        t('commerce.signInToComplete')
      );
      navigateTo('/auth/sign-in');
      return;
    }

    // A card with no SKU behind it. All eight now have one, so this is a guard
    // for whatever is added next rather than the normal path — but it stays,
    // because the alternative is sending a skuId the catalogue does not contain
    // and the server answering with a 400 the traveler cannot act on.
    if (!activeService.skuId) {
      setInstantBookingError(
        t('commerce.notBookableOnlineYet', {
          supplierName: language === 'ar' ? activeService.supplierNameAr : activeService.supplierName,
          supplierPhone: activeService.supplierPhone,
        })
      );
      return;
    }

    // A per-night product cannot be quoted from a party size, and a stay has
    // to come from the server quote that knows the dates. Refusing here is the
    // point: sending `amountEGP: basePriceEGP` would look like a confirmed price
    // for one night and be rejected at settlement anyway.
    if (calculatedPrice === null) {
      setInstantBookingError(t('commerce.priceNeedsDates'));
      return;
    }

    // Contact phone: the provider has to reach this traveler at the gate. The
    // server rejects an empty `travelerPhone` with a 400; refusing here (with
    // the field darkened by focus) replaces a generic retry with something the
    // traveler can fix in one move.
    const phone = travelerPhone.trim();
    if (!phone) {
      setInstantBookingError(t('commerce.contactPhoneRequired'));
      (travelerPhoneInputRef.current ?? instantBookingErrorRef.current)?.focus();
      return;
    }
    if (!/^\+?[\d\s\-()]{7,24}$/.test(phone)) {
      setInstantBookingError(t('profile.phoneInvalid'));
      (travelerPhoneInputRef.current ?? instantBookingErrorRef.current)?.focus();
      return;
    }
    if (phone !== travelerPhone) setTravelerPhone(phone);

    setInstantBookingError(null);
    setIsSubmitting(true);

    // The SKU's own vertical, not one derived from the card's browse category.
    // The old derivation filed a quad safari as a transfer (both are
    // 'transport') and a massage and a restaurant table as safaris.
    const serviceType = activeService.serviceType ?? 'safari';

    // Pre-check availability against the rich endpoint before attempting to
    // book — if the slot sold out (or the party grew past it) while the user
    // was configuring, it is caught here instead of at payment time, and the
    // slot list refreshes so the traveler sees the new reality.
    try {
      const availability = await api.checkRichAvailability({
        serviceType,
        skuId: activeService.skuId,
        date: localToday(),
        passengers: guestsCount
      });
      const fits = availability.slots.some(
        s => s.status !== 'SOLD_OUT' && s.availableCapacity >= guestsCount
      );
      if (!availability.available || !fits) {
        setIsSubmitting(false);
        setAvailabilityRetry(r => r + 1);
        setInstantBookingError(
          t('commerce.slotNoLongerAvailable')
        );
        return;
      }
    } catch {
      // Availability check is advisory — proceed with the booking even
      // if the check fails (network error, server down, etc.). The server
      // still refuses a genuinely unavailable slot at checkout.
    }

    // The trip this booking is filed against. It used to fall back to an
    // invented `TRIP-INSTANT-<userId>` that no trip record carried, so the
    // server refused it ("Trip not found") — or, worse, an older build filed
    // money against a trip that did not exist. A traveller without a trip now
    // gets a real one-day plan, created through the same path as every other
    // "start a trip" button, and the booking lands in it.
    let tripId = activeTrip?.id || createdTripIdRef.current;
    if (!tripId) {
      try {
        const trip = await createPlanningTrip({
          title: language === 'ar' ? activeService.titleAr : activeService.title,
          lengthDays: 1,
          travelersCount: guestsCount,
          startsInDays: 0,
          idPrefix: 'TRIP-NOW',
        });
        tripId = trip.id;
        createdTripIdRef.current = trip.id;
      } catch (err) {
        setIsSubmitting(false);
        setInstantBookingError(checkoutIssueMessage(checkoutIssueFrom(err), t, formatEGP));
        return;
      }
    }

    setIsSubmitting(false);
    await checkout.submit({
      tripId,
      // These three used to fall back to 'Dahab Traveler',
      // '+20 100 000 0000' and 'traveler@dahab.travel'. They are written
      // into the booking record and sent to the supplier who has to meet
      // this traveler, so a placeholder phone number here is a driver
      // waiting at an airport with no way to call anyone. The panel now
      // carries a required, validated phone input and this value always
      // refers to it.
      traveler: {
        name: sessionUser?.name || profile.name,
        phone,
        email: sessionUser?.email || profile.email,
      },
      // Held first, then settled: checkout only settles a hold, for the
      // party size and slot the hold reserved.
      lines: [{
        serviceType,
        skuId: activeService.skuId,
        scheduledDate: instantSlot.date,
        scheduledTime: instantSlot.timeSlot,
        passengersCount: guestsCount,
        amountEGP: calculatedPrice,
        pickupLocation: pickupLocation || undefined,
        specialRequests: specialNotes || undefined,
      }],
      payment: { provider: 'CASH_ON_ARRIVAL' },
      attemptKey: newAttemptKey('BOOKNOW'),
    });
  };

  /**
   * The server settled the booking. Everything recorded here uses the
   * server's reference and the amount actually charged — after a price
   * re-confirmation that is the new price, not the card's.
   */
  function recordConfirmedBooking(outcome: Extract<HeldCheckoutOutcome, { kind: 'confirmed' }>) {
    if (!activeService) return;
    const booked = outcome.result.bookings?.[0];
    const bookingId = booked?.bookingRef || booked?.id || outcome.result.transactionId;
    const confirmationCode = booked?.confirmationCode || bookingId;
    const chargedEGP = outcome.held.reduce((sum, line) => sum + line.amountEGP, 0);
    const whenLabel = instantSlotLabel();

    const newBooking: ConfirmedBookingItem = {
      id: bookingId,
      serviceType: activeService.serviceType ?? 'safari',
      title: language === 'ar' ? activeService.titleAr : activeService.title,
      subtitle: language === 'ar' ? activeService.locationAreaAr : activeService.locationArea,
      details: `Instant In-Destination: ${guestsCount} pax. Pickup: ${pickupLocation}. ${specialNotes}`,
      datesOrTime: whenLabel,
      priceEGP: chargedEGP,
      provider: language === 'ar' ? activeService.supplierNameAr : activeService.supplierName,
      confirmationCode,
      status: 'Confirmed ✓',
      location: language === 'ar' ? activeService.locationAreaAr : activeService.locationArea,
      iconType: activeService.category === 'transport' ? 'car' : activeService.category === 'watersports' ? 'waves' : 'compass',
      phone: activeService.supplierPhone,
    };

    // 1. Save to trip context
    recordBooking(newBooking);

    // 2. Record in the double-entry ledger. The booking is pay-on-arrival, so
    // it is a pending escrow hold rather than a captured payment.
    recordLedgerEntry({
      transactionId: outcome.result.transactionId || `TXN-INST-${Date.now()}`,
      idempotencyKey: `IDEMP-INST-${bookingId}`,
      bookingRef: bookingId,
      tripId: outcome.tripId,
      type: 'HOLD_ESCROW',
      amountEGP: chargedEGP,
      debitAccount: 'TRAVELER_CASH_ON_ARRIVAL',
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      status: 'PENDING',
      metadata: {
        serviceType: activeService.category,
        supplierId: activeService.id,
        reason: `Instant in-destination booking (${guestsCount} guests). Pay upon arrival.`,
        supplierName: language === 'ar' ? activeService.supplierNameAr : activeService.supplierName,
        supplierPhone: activeService.supplierPhone,
        serviceTitle: language === 'ar' ? activeService.titleAr : activeService.title
      }
    });

    setConfirmedBooking(newBooking);

    analytics.track('booking_completed', {
      sourceMode: selectedSkuId ? 'sku_deeplink' : 'book_now_grid',
      metadata: { skuId: activeService.skuId, bookingRef: bookingId }
    } as any);

    // The itinerary line this booking fulfils was flipped to CONFIRMED
    // server-side; re-read the trip so My Trip shows it. A trip created for
    // this booking becomes the one the app is about.
    if (createdTripIdRef.current && !activeTrip) {
      openTrip(createdTripIdRef.current);
    } else {
      reloadTrip();
    }

    showToast(
      t('commerce.bookingConfirmedVoucher', {
        title: language === 'ar' ? activeService.titleAr : activeService.title,
        code: confirmationCode,
      })
    );
  }

  /**
   * On a phone the checkout panel sits below eight cards, so tapping "Book"
   * used to scroll the traveler into a form they could not see arrive. Once
   * something is selected the panel leads the page instead; on desktop the two
   * columns keep their normal order.
   */
  const checkoutLeadsOnMobile = Boolean(activeService || confirmedBooking);

  const availabilityTone = (badge: InDestinationServiceOption['availabilityBadge']): string => {
    if (badge === 'Instant Ready') {
      return 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]';
    }
    if (badge === 'Weather Optimal') {
      return 'bg-[var(--accent-primary)]/12 text-[var(--text-primary)] border-[var(--accent-primary)]/40';
    }
    return 'bg-[var(--surface-container)] text-[var(--text-secondary)] border-[var(--border-subtle)]';
  };

  const fieldClass =
    'rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity]';

  return (
    <div
      id="quick-book-commerce-page"
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-28 md:pb-16"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ========================================================================= */}
      {/* 1. HEADER & LIVE SEA CONDITIONS                                           */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div
          aria-hidden="true"
          className="absolute -top-40 -end-32 w-[30rem] h-[30rem] rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -start-32 w-[30rem] h-[30rem] rounded-full bg-[var(--accent-secondary)]/10 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-9 space-y-6">
          {/* Breadcrumb + bookings hub */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => navigateTo('/home')}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer rounded py-2 -my-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {t('commerce.home')}
              </button>
              <span aria-hidden="true" className="text-[var(--text-secondary)]/40">
                /
              </span>
              <span aria-current="page" className="text-[var(--text-primary)] font-bold">
                {t('commerce.instantBooking')}
              </span>
            </nav>

            <button
              type="button"
              onClick={() => navigateTo('/bookings')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Receipt className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>{t('commerce.myBookings')}</span>
              {bookings.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-[11px] font-extrabold tabular-nums">
                  {bookings.length}
                </span>
              )}
            </button>
          </div>

          {/* Title + live conditions */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                <Sparkles className="w-3.5 h-3.5 inline-block me-1.5 -mt-0.5" aria-hidden="true" />
                <span>{t('commerce.dahabLiveCommerce')}</span>
              </p>

              <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-balance">
                {t('commerce.bookLocalDahabServices')}
              </h1>

              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                {t('commerce.diveGearDelivered4x4')}
              </p>
            </div>

            {/* Live sea & wind */}
            <div className="shrink-0 lg:min-w-[19rem] rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[var(--border-subtle)]">
                <span className="flex items-center gap-2 text-xs font-extrabold text-[var(--text-primary)]">
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse"
                  />
                  {t('commerce.liveSeaWind')}
                </span>
              </div>

              <dl className="grid grid-cols-3 gap-3">
                {[
                  {
                    labelEn: 'Water',
                    labelAr: 'الحرارة',
                    value: `${INITIAL_LIVE_DAHAB_CONDITIONS.waterTempC}°C`
                  },
                  {
                    labelEn: 'Wind',
                    labelAr: 'الرياح',
                    value: `${INITIAL_LIVE_DAHAB_CONDITIONS.windSpeedKnots} kts`
                  },
                  {
                    labelEn: 'Visibility',
                    labelAr: 'الرؤية',
                    value: `${INITIAL_LIVE_DAHAB_CONDITIONS.waterVisibilityMeters} m`
                  }
                ].map((stat) => (
                  <div key={stat.labelEn}>
                    <dt className="text-xs font-bold text-[var(--text-secondary)]">
                      {language === 'ar' ? stat.labelAr : stat.labelEn}
                    </dt>
                    <dd className="text-lg font-mono font-bold text-[var(--text-primary)] tabular-nums">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
                <span>{t('commerce.noPrepaymentPayOn')}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. FILTERS                                                                */}
      {/* ========================================================================= */}
      <section
        aria-label={t('commerce.filterAndSearchServices')}
        className="sticky top-16 sm:top-20 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/92 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1 -mx-1 px-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-md'
                      : 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{language === 'ar' ? cat.labelAr : cat.labelEn}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 xl:ms-auto">
            <div className="relative flex-1 xl:w-64 xl:flex-none">
              <Search
                className="w-4 h-4 text-[var(--text-secondary)] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('commerce.searchServicesAndLocations')}
                placeholder={t('commerce.searchGear4x4Safari')}
                className={`${fieldClass} w-full ps-9 pe-3 py-2.5`}
              />
            </div>

            <select
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
              aria-label={t('commerce.filterByAvailabilityWindow')}
              className={`${fieldClass} px-3 py-2.5 font-bold cursor-pointer shrink-0`}
            >
              <option value="all">{t('commerce.allWindows')}</option>
              <option value="Instant Ready">{t('commerce.instantReady')}</option>
              <option value="Evening Slot">{t('commerce.eveningSlots')}</option>
              <option value="Weather Optimal">{t('commerce.weatherOptimal')}</option>
              <option value="Limited Slots">{t('commerce.limitedSlots')}</option>
            </select>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. CATALOG + CHECKOUT                                                     */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* ================================================================= */}
          {/* Catalog                                                           */}
          {/* ================================================================= */}
          <section
            aria-label={t('commerce.availableServices')}
            className={`lg:col-span-7 xl:col-span-8 space-y-4 ${
              checkoutLeadsOnMobile ? 'order-2' : 'order-1'
            } lg:order-1`}
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl chart-heading font-bold">
                  {t('commerce.availableRightNow')}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('commerce.availableNowCount', { count: filteredServices.length })}
                </p>
              </div>

              {activeService && (
                <button
                  type="button"
                  onClick={() => setActiveService(null)}
                  className="text-xs font-bold text-[var(--accent-primary)] hover:underline cursor-pointer shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {t('commerce.clearSelection')}
                </button>
              )}
            </div>

            {filteredServices.length === 0 ? (
              <div className="p-10 sm:p-12 text-center bg-[var(--surface-card)] rounded-3xl border border-[var(--border-subtle)] space-y-3">
                <Compass className="w-10 h-10 text-[var(--accent-primary)] mx-auto opacity-60" aria-hidden="true" />
                <h3 className="text-lg chart-heading font-bold">
                  {t('commerce.noMatchingServices')}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                  {t('commerce.tryDifferentKeywordsOr')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setSelectedAvailability('all');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] text-xs font-extrabold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {t('commerce.resetFilters')}
                </button>
              </div>
            ) : (
              <ul className="space-y-4">
                {filteredServices.map((svc) => {
                  const Icon = svc.icon;
                  const isSelected = activeService?.id === svc.id;
                  const bringList = language === 'ar' ? svc.whatToBringAr : svc.whatToBring;
                  const meetingPoint = language === 'ar' ? svc.meetingPointAr : svc.meetingPoint;
                  const duration = language === 'ar' ? svc.durationStrAr : svc.durationStr;

                  return (
                    <li key={svc.id}>
                      <article
                        id={`service-card-${svc.id}`}
                        className={`bg-[var(--surface-card)] rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 overflow-hidden ${
                          isSelected
                            ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/25 shadow-xl'
                            : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 hover:shadow-lg'
                        }`}
                      >
                        <div className="p-5 sm:p-6 space-y-4">
                          {/* Meta row */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold ${availabilityTone(
                                svc.availabilityBadge
                              )}`}
                            >
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              <span>{language === 'ar' ? svc.availabilityBadgeAr : svc.availabilityBadge}</span>
                            </span>

                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                              <span>{language === 'ar' ? svc.supplierNameAr : svc.supplierName}</span>
                            </span>
                          </div>

                          {/* Title block */}
                          <div className="flex items-start gap-4">
                            <span
                              aria-hidden="true"
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                                  : 'bg-[var(--surface-container)] text-[var(--accent-primary)]'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </span>

                            <div className="min-w-0 space-y-1.5">
                              <h3 className="text-lg sm:text-xl chart-heading font-bold leading-snug">
                                {language === 'ar' ? svc.titleAr : svc.title}
                              </h3>
                              <p className="text-sm font-semibold text-[var(--accent-primary)]">
                                {language === 'ar' ? svc.subtitleAr : svc.subtitle}
                              </p>
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                {language === 'ar' ? svc.descriptionAr : svc.description}
                              </p>
                            </div>
                          </div>

                          {/* Detail chips */}
                          <div className="flex flex-wrap items-center gap-2">
                            {duration && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
                                <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                                <span>{duration}</span>
                              </span>
                            )}
                            {meetingPoint && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
                                <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                                <span>{meetingPoint}</span>
                              </span>
                            )}
                            {svc.weatherConditionCheck && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/25 text-xs font-semibold text-[var(--text-primary)]">
                                <Waves className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                                <span>
                                  {language === 'ar' ? svc.weatherConditionCheckAr : svc.weatherConditionCheck}
                                </span>
                              </span>
                            )}
                          </div>

                          {/* What to bring — omitted entirely when the product carries none */}
                          {bringList.length > 0 && (
                            <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-3 space-y-2">
                              <span className="block text-[11px] font-extrabold text-[var(--text-secondary)]">
                                {t('commerce.whatToBring')}
                              </span>
                              <ul className="flex flex-wrap gap-1.5">
                                {bringList.map((item, idx) => (
                                  <li
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                                  >
                                    <Check className="w-3 h-3 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Price + CTA footer */}
                        <div className="px-5 sm:px-6 py-4 bg-[var(--surface-container)] border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <span className="block text-[11px] font-bold text-[var(--text-secondary)]">
                              {t('commerce.officialRatePerPerson')}
                            </span>
                            <span className="text-2xl font-mono font-bold tabular-nums">
                              {svc.basePriceEGP.toLocaleString()}{' '}
                              <span className="text-sm font-bold text-[var(--text-secondary)]">{svc.currency}</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectService(svc)}
                            aria-pressed={isSelected}
                            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-extrabold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container)] ${
                              isSelected
                                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]'
                                : 'bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] shadow-md'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-4 h-4" aria-hidden="true" />
                                <span>{t('commerce.selected')}</span>
                              </>
                            ) : (
                              <>
                                <span>{t('commerce.bookNow')}</span>
                                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                              </>
                            )}
                          </button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ================================================================= */}
          {/* Checkout / voucher                                                */}
          {/* ================================================================= */}
          <section
            id="instant-checkout-panel"
            aria-label={t('commerce.bookingPanel')}
            className={`lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-44 ${
              checkoutLeadsOnMobile ? 'order-1' : 'order-2'
            } lg:order-2`}
          >
            {confirmedBooking ? (
              /* ---------------- Confirmed voucher ---------------- */
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--accent-primary)]/40 shadow-2xl space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg chart-heading font-bold">
                    {t('commerce.bookingConfirmed')}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t('commerce.theVoucherHasReached')}
                  </p>
                </div>

                <div className="bg-[var(--surface-container)] rounded-2xl p-4 border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      {t('commerce.voucherRef')}
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--accent-primary)]">
                      {confirmedBooking.confirmationCode}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-base font-bold">{confirmedBooking.title}</span>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                      <span>{confirmedBooking.datesOrTime}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                      <span>{confirmedBooking.location}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-subtle)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      {t('commerce.dueAtArrival')}
                    </span>
                    <span className="text-lg font-mono font-bold tabular-nums">
                      {confirmedBooking.priceEGP.toLocaleString()} EGP
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href={`https://wa.me/${confirmedBooking.phone?.replace(/\D/g, '') || '201002348899'}?text=Hello%20${encodeURIComponent(
                      confirmedBooking.provider || 'Dahab Support'
                    )}%20I%20have%20confirmed%20voucher%20${confirmedBooking.confirmationCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-2xl bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] font-extrabold text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Phone className="w-4 h-4" aria-hidden="true" />
                    <span>{t('commerce.whatsAppTheProvider')}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => navigateTo('/my-trip')}
                    className="w-full py-2.5 px-4 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Luggage className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                    <span>{t('commerce.viewInMyItinerary')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedBooking(null);
                      setActiveService(null);
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    {t('commerce.bookAnotherService')}
                  </button>
                </div>
              </div>
            ) : activeService ? (
              /* ---------------- Configure & book ---------------- */
              <div className="bg-[var(--surface-card)] rounded-3xl border border-[var(--border-subtle)] shadow-xl overflow-hidden flex flex-col lg:max-h-[calc(100vh-13rem)]">
                <div className="p-5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <span className="text-[11px] font-extrabold text-[var(--accent-primary)]">
                      {t('commerce.configureBook')}
                    </span>
                    <h2 className="text-base chart-heading font-bold mt-1 leading-snug">
                      {language === 'ar' ? activeService.titleAr : activeService.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveService(null)}
                    aria-label={t('commerce.closeBookingPanel')}
                    className="w-8 h-8 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="p-5 space-y-5 lg:overflow-y-auto lg:flex-1 lg:min-h-0">
                  {/* Guests */}
                  <fieldset>
                    <legend className="text-xs font-bold mb-2">
                      {t('commerce.howManyPeople')}
                    </legend>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const on = guestsCount === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setGuestsCount(num)}
                            aria-pressed={on}
                            className={`py-2.5 rounded-xl text-sm font-bold tabular-nums transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                              on
                                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)] shadow-md'
                                : 'bg-[var(--surface-container)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Timing */}
                  <fieldset>
                    <legend className="text-xs font-bold mb-2">
                      {t('commerce.whenShouldItStart')}
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          id: 'immediate',
                          titleEn: 'Right now',
                          titleAr: 'حالاً',
                          hint: language === 'ar' ? activeService.pickupWindowAr : activeService.pickupWindow
                        },
                        {
                          id: 'sunset',
                          titleEn: 'Sunset / evening',
                          titleAr: 'الغروب / المساء',
                          hint: '05:00 PM – 07:00 PM'
                        }
                      ].map((slot) => {
                        const on = selectedTimeSlot === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot.id)}
                            aria-pressed={on}
                            className={`p-3 rounded-xl text-start border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                              on
                                ? 'bg-[var(--accent-primary)]/12 border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/30'
                                : 'bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                            }`}
                          >
                            <span className="block text-xs font-bold">
                              {language === 'ar' ? slot.titleAr : slot.titleEn}
                            </span>
                            {slot.hint && (
                              <span className="block text-xs text-[var(--text-secondary)] mt-0.5">{slot.hint}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Live availability — real backend slots for today */}
                  <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--text-secondary)]">
                        <span
                          aria-hidden="true"
                          className={`w-2 h-2 rounded-full ${liveState === 'ready' ? 'bg-[var(--accent-primary)] animate-pulse' : 'bg-[var(--text-secondary)]/40'}`}
                        />
                        {t('commerce.liveAvailability')}
                      </span>
                      {liveState === 'error' && (
                        <button
                          type="button"
                          onClick={() => setAvailabilityRetry(r => r + 1)}
                          className="text-[11px] font-bold text-[var(--accent-primary)] hover:underline cursor-pointer"
                        >
                          {t('bookings.manage.retry')}
                        </button>
                      )}
                    </div>

                    {liveState === 'loading' && (
                      <p role="status" className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        {t('commerce.liveChecking')}
                      </p>
                    )}

                    {liveState === 'error' && liveError && (
                      <p role="alert" className="text-xs text-red-300 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{liveErrorText(liveError, t)}</span>
                      </p>
                    )}

                    {liveState === 'ready' && liveAvailability && liveAvailability.views.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {t('commerce.liveEmptySchedule')}
                      </p>
                    )}

                    {liveState === 'ready' && liveAvailability && liveAvailability.views.length > 0 && (
                      <div className="space-y-2">
                        <ul className="flex flex-wrap gap-1.5" aria-label={t('bookings.reschedule.slotHint')}>
                          {liveAvailability.views.map(slot => {
                            const fits = slot.kind === 'available' || slot.kind === 'limited';
                            const selected = pickedLiveSlot === slot.id;
                            return (
                              <li key={slot.id}>
                                <button
                                  type="button"
                                  disabled={!fits}
                                  onClick={() => setPickedLiveSlot(slot.id)}
                                  aria-pressed={selected}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-55 disabled:cursor-not-allowed ${
                                    selected
                                      ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                                      : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                                  }`}
                                >
                                  <Clock className="w-3 h-3" aria-hidden="true" />
                                  <span dir="ltr">{slot.timeSlot}</span>
                                  {slot.kind === 'limited' ? (
                                    <span className="text-amber-300 font-bold">{t('bookings.reschedule.slotLimited', { count: slot.capacityRemaining })}</span>
                                  ) : slot.kind === 'sold-out' || slot.kind === 'fits-no-party' ? (
                                    <span className="text-red-400 font-bold">{t('bookings.reschedule.slotSoldOut')}</span>
                                  ) : (
                                    <span className="text-emerald-400 font-bold">{t('bookings.reschedule.slotAvailable')}</span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        {liveNoFitToday ? (
                          <p role="alert" className="flex items-start gap-1.5 text-xs text-amber-300">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{t('commerce.liveNoneFitToday', { count: guestsCount })}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-[var(--text-secondary)]/80 leading-relaxed">
                            {t('commerce.liveFitHint')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contact phone — required: the provider arranges the
                      meeting at the gate with this number. Previously no
                      input existed and an empty phone reached the server as
                      a 400 the panel could only report generically. */}
                  <div>
                    <label htmlFor="booknow-contact-phone" className="block text-xs font-bold mb-2">
                      {t('commerce.contactPhone')} <span aria-hidden="true" className="text-[var(--brand-coral)]">*</span>
                    </label>
                    <input
                      id="booknow-contact-phone"
                      ref={travelerPhoneInputRef}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={travelerPhone}
                      onChange={(e) => setTravelerPhone(e.target.value)}
                      placeholder="+20 100 123 4567"
                      aria-required="true"
                      className={`${fieldClass} w-full px-3 py-2.5`}
                      dir="ltr"
                    />
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                      {t('commerce.contactPhoneHint')}
                    </p>
                  </div>

                  {/* Pickup */}
                  <div>
                    <label htmlFor="pickup-location-input" className="block text-xs font-bold mb-2">
                      {t('commerce.pickupMeetingPoint')}
                    </label>
                    <input
                      id="pickup-location-input"
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      placeholder={
                        t('commerce.egCoralCoastHotel')
                      }
                      className={`${fieldClass} w-full px-3 py-2.5`}
                    />
                  </div>

                  {/* Shoe size, gear only */}
                  {activeService.category === 'watersports' && (
                    <div>
                      <label htmlFor="shoe-size-input" className="block text-xs font-bold mb-2">
                        {t('commerce.bootiesFinShoeSize')}
                      </label>
                      <input
                        id="shoe-size-input"
                        type="text"
                        value={shoeSize}
                        onChange={(e) => setShoeSize(e.target.value)}
                        placeholder="42 EU / 9 US"
                        className={`${fieldClass} w-full px-3 py-2.5`}
                      />
                    </div>
                  )}

                  {/* Price summary */}
                  <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>{t('commerce.ratePerPerson')}</span>
                      <span className="font-mono font-bold tabular-nums text-[var(--text-primary)]">
                        {activeService.basePriceEGP.toLocaleString()} EGP
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>{t('commerce.people')}</span>
                      <span className="font-bold tabular-nums text-[var(--text-primary)]">×{guestsCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>{t('commerce.serviceDispatchFee')}</span>
                      <span className="font-bold text-[var(--accent-primary)]">
                        {t('commerce.free')}
                      </span>
                    </div>
                    <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-baseline justify-between">
                      <span className="text-sm font-bold">{t('commerce.total')}</span>
                      <span className="text-2xl font-mono font-bold tabular-nums">
                        {calculatedPrice === null
                          ? t('commerce.priceOnRequest')
                          : calculatedPrice.toLocaleString()}{' '}
                        {calculatedPrice !== null && (
                          <span className="text-sm text-[var(--text-secondary)]">EGP</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Escrow */}
                  <p className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/25 text-xs text-[var(--text-primary)] leading-relaxed">
                    <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      {t('commerce.nothingIsChargedNow')}
                    </span>
                  </p>

                </div>

                {/* Pinned action footer */}
                <div className="p-5 pt-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card)] space-y-3 shrink-0">
                  {instantBookingError && (
                    <p
                      ref={instantBookingErrorRef}
                      tabIndex={-1}
                      role="alert"
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--brand-coral)]/12 border border-[var(--brand-coral)]/40 text-sm text-[var(--text-primary)] leading-relaxed"
                    >
                      <AlertCircle className="w-4 h-4 text-[var(--brand-coral)] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{instantBookingError}</span>
                    </p>
                  )}

                  {(checkout.phase === 'priceChanged' || checkout.phase === 'failed') && checkout.outcome && checkout.outcome.kind !== 'confirmed' && (
                    <CheckoutIssuePanel
                      priceChange={checkout.outcome.kind === 'priceChanged' ? checkout.outcome : null}
                      issue={checkout.outcome.kind === 'failed' ? checkout.outcome.issue : null}
                      busy={checkout.busy}
                      onConfirmPrice={() => { void checkout.confirmPrice(); }}
                      onRehold={() => { void checkout.rehold(); }}
                      onRetry={() => { void handleConfirmInstantBooking(); }}
                      onSignIn={() => { setIntendedRoute('/book-now'); navigateTo('/auth/sign-in'); }}
                      onContactSupport={() => navigateTo('/help')}
                      onDismiss={checkout.reset}
                      alternativesQuery={
                        activeService.skuId && checkout.lastRequest
                          ? {
                              tripId: checkout.lastRequest.tripId,
                              skuId: activeService.skuId,
                              date: instantSlot.date,
                              timeSlot: instantSlot.timeSlot,
                              passengersCount: guestsCount,
                            }
                          : null
                      }
                      onPickAlternative={alt => { checkout.reset(); navigateTo('/book-now', { skuId: alt.skuId }); }}
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleConfirmInstantBooking}
                    disabled={isSubmitting || checkout.busy || checkout.phase === 'priceChanged' || liveNoFitToday}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] font-extrabold text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                  >
                    {isSubmitting || checkout.busy ? (
                      <span className="animate-pulse">
                        {t('commerce.confirming')}
                      </span>
                    ) : (
                      <>
                        <span>
                          {t('commerce.confirmBooking', {
                            price: calculatedPrice === null
                              ? t('commerce.priceOnRequest')
                              : calculatedPrice.toLocaleString(),
                          })}
                        </span>
                        <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* ---------------- Nothing selected ---------------- */
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] text-center space-y-3">
                {/*
                  A link pointed here naming a product that is not on sale. Saying
                  so beats silently showing the grid, which would leave the traveler
                  believing they were configuring the thing they clicked.
                */}
                {skuLookupFailed && (
                  <p
                    role="alert"
                    className="text-start flex items-start gap-2.5 p-3 rounded-xl bg-[var(--accent-secondary)]/12 border border-[var(--accent-secondary)]/35 text-xs text-[var(--text-primary)] leading-relaxed"
                  >
                    <AlertCircle className="w-4 h-4 text-[var(--accent-secondary)] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      {t('commerce.thatExperienceIsNot')}
                    </span>
                  </p>
                )}

                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/12 text-[var(--accent-primary)] flex items-center justify-center mx-auto">
                  <Receipt className="w-6 h-6" aria-hidden="true" />
                </div>
                <h2 className="text-lg chart-heading font-bold">
                  {t('commerce.pickAServiceTo')}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {t('commerce.tapBookNowOn')}
                </p>
                <p className="pt-3 border-t border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                  <span>{t('commerce.standardisedLocalDahabRates')}</span>
                </p>
              </div>
            )}

            {/* Field coordinator */}
            <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Phone className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('commerce.needACustomDispatch')}</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t('commerce.sinaiCoordinatorsAreAvailable')}
              </p>
              <a
                href="https://wa.me/201002348899?text=Hello%20Dahab%20Travel%20OS%20Dispatch,%20I%20need%20custom%20assistance"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--accent-primary)] hover:underline rounded py-2 -my-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <span>{t('commerce.chatWithADahab')}</span>
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
