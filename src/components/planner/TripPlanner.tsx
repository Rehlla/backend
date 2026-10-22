import React, { useState, useEffect } from 'react';
import { useTrip } from '../../context/TripContext';
import { StepDuration } from './StepDuration';
import { StepTravelers, TripDynamicType } from './StepTravelers';
import { StepBudget, BudgetTier } from './StepBudget';
import { StepInterests, InterestId } from './StepInterests';
import { StepPace, PaceType } from './StepPace';
import { BuildingTripState } from './BuildingTripState';
import { StepPlaceholder } from './StepPlaceholder';
import { GeneratedItinerary } from '../itinerary/GeneratedItinerary';
import { BookingHotelStep } from '../booking/BookingHotelStep';
import { BookingTransferStep } from '../booking/BookingTransferStep';
import { BookingDivingStep } from '../booking/BookingDivingStep';
import { BookingSafariStep } from '../booking/BookingSafariStep';
import { BookingReviewStep } from '../booking/BookingReviewStep';
import { BookingPaymentStep } from '../booking/BookingPaymentStep';
import { MyTripView } from '../mytrip/MyTripView';
import { CURATED_HOTELS, CURATED_TRANSFERS, CURATED_DIVING_OPTIONS, CURATED_SAFARI_OPTIONS } from '../booking/bookingData';
import { Compass, Sparkles, X, MapPin, ShieldCheck, Check, Users, Clock, Wallet, HeartHandshake, Gauge } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import type { AiGeneratedPlan } from '../itinerary/GeneratedItinerary';
import { IMG_P1507525428034b723cf961d3e_HERO, IMG_P15103123056538ed496efae75_HERO, IMG_P1539635278303d4002c07eae3_HERO, IMG_P154455176346a013bb70d5_HERO } from '../../shared/placeholderImagery';

interface TripPlannerProps {
  onExitToHome: () => void;
  /**
   * 'wizard' (the /trip-builder route) always starts fresh at step 1.
   * 'preview' (the /trip-preview route) is reached after PlanForMeView or
   * ProgramDetailView already collected answers into TravelerProfile and
   * called updateProfile() — it must render the generated itinerary
   * directly from that profile instead of silently resetting to a blank
   * step-1 wizard, which previously discarded everything the traveler had
   * just answered.
   */
  startMode?: 'wizard' | 'preview';
}

/** TravelerProfile.budget ('Budget'|'Moderate'|'Premium') -> this wizard's
 *  own lowercase BudgetTier. */
function budgetFromProfile(budget: string): BudgetTier {
  const map: Record<string, BudgetTier> = { Budget: 'budget', Moderate: 'moderate', Premium: 'premium' };
  return map[budget] || 'moderate';
}

/** TravelerProfile.pace ('Relaxed'|'Balanced'|'Active') -> this wizard's own
 *  differently-named PaceType. */
function paceFromProfile(pace: string): PaceType {
  const map: Record<string, PaceType> = { Relaxed: 'slow', Balanced: 'balanced', Active: 'packed' };
  return map[pace] || 'balanced';
}

/** PlanForMeView/ProgramDetailView write Title-Case interest labels
 *  ('Diving', 'Local Life', ...) into TravelerProfile; this wizard's own
 *  StepInterests uses a distinct kebab-case id set. Unmapped interests are
 *  dropped rather than guessed. */
function interestsFromProfile(interests: string[]): InterestId[] {
  const map: Record<string, InterestId> = {
    Diving: 'diving',
    Adventure: 'adventure',
    Beach: 'water',
    Food: 'food',
    'Local Life': 'local-life',
    Wellness: 'relax'
  };
  const mapped = interests.map(i => map[i]).filter((i): i is InterestId => Boolean(i));
  return mapped.length > 0 ? mapped : ['diving', 'adventure', 'food'];
}

/** TravelerProfile only carries a headcount, not the "who's traveling"
 *  descriptor — inferred the same way PlanForMeView's own party-size step
 *  presents it (1 solo, 2 couple, 3 friends, 4 family, 5+ group). */
function tripDynamicFromCount(count: number): TripDynamicType {
  if (count <= 1) return 'Solo';
  if (count === 2) return 'Couple';
  if (count === 3) return 'Friends';
  if (count === 4) return 'Family';
  return 'Group';
}

interface StepMeta {
  number: number;
  labelKey: string;
  defaultLabel: string;
  defaultShortLabel: string;
}

const PLANNING_STEPS: StepMeta[] = [
  { number: 1, labelKey: 'planner.step1.short', defaultLabel: 'Duration', defaultShortLabel: 'Duration' },
  { number: 2, labelKey: 'planner.step2.short', defaultLabel: 'Travelers', defaultShortLabel: 'Travelers' },
  { number: 3, labelKey: 'planner.step3.short', defaultLabel: 'Budget', defaultShortLabel: 'Budget' },
  { number: 4, labelKey: 'planner.step4.short', defaultLabel: 'Interests', defaultShortLabel: 'Interests' },
  { number: 5, labelKey: 'planner.step5.short', defaultLabel: 'Pace', defaultShortLabel: 'Pace' },
];

export const TripPlanner: React.FC<TripPlannerProps> = ({ onExitToHome, startMode = 'wizard' }) => {
  const { t, isRTL, language } = useLanguage();
  const { isSignedIn, setIntendedRoute, navigateTo, showToast, profile } = useTrip();
  // Current active planning step (1 = Duration, 2 = Travelers, 3 = Budget, 4 = Interests, 5 = Pace Placeholder)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 5;

  // Step 1: Selected duration state (Default to '4-5' for Ahmed's scenario)
  const [selectedDurationId, setSelectedDurationId] = useState<string>('4-5');
  const [selectedDurationLabel, setSelectedDurationLabel] = useState<string>('4–5 days');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Step 2: Travelers state (Default to 2 adults, 0 children, 'Friends' for Ahmed)
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [tripDynamic, setTripDynamic] = useState<TripDynamicType | null>('Friends');

  // Step 3: Budget state (Default to 'moderate' for Ahmed)
  const [selectedBudget, setSelectedBudget] = useState<BudgetTier>('moderate');

  // Step 4: Interests state (Preselect 'diving', 'adventure', 'food' for Ahmed)
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>([
    'diving',
    'adventure',
    'food',
  ]);

  // Step 5: Pace state (Default to 'balanced' for Ahmed)
  const [selectedPace, setSelectedPace] = useState<PaceType>('balanced');

  // Building trip state transition flag
  const [isBuildingTrip, setIsBuildingTrip] = useState<boolean>(false);

  // The AI plan generated while the building screen plays — resolved from
  // /api/trip/generate and handed to the itinerary screen so the traveler
  // approves the *actual* generated plan, not a static template. null = the
  // call failed or hasn't resolved; the itinerary falls back to the compiled
  // editorial plan shaped by the duration choice.
  const [aiPlan, setAiPlan] = useState<AiGeneratedPlan | null>(null);

  // Chosen day count — upper bound of the duration option (2–3 → 3, 4–5 → 5,
  // 6–7 → 7, 8+ → 8). Drives the AI request, the building-screen copy and
  // the itinerary shaping. Dates entry derives it from the picked range.
  const durationDays = (() => {
    if (startDate && endDate) {
      const diff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      if (diff > 0) return Math.min(10, diff);
    }
    if (selectedDurationId === '2-3') return 3;
    if (selectedDurationId === '4-5') return 5;
    if (selectedDurationId === '6-7') return 7;
    if (selectedDurationId === '8+') return 8;
    return 5;
  })();

  /** Fire the AI generation once, when the building screen mounts. */
  const handleBuildTrip = () => {
    setIsBuildingTrip(true);
    setAiPlan(null);
    api
      .generateAiTrip({
        durationDays,
        adultsCount,
        childrenCount,
        dynamic: tripDynamic || 'Friends',
        budget: selectedBudget,
        interests: selectedInterests,
        pace: selectedPace,
        language,
      })
      .then((result) => {
        if (result?.trip?.days?.length) setAiPlan(result.trip);
      })
      .catch((e) => console.warn('AI trip generation unavailable, using compiled plan:', e));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Personalized Generated Itinerary screen view state
  const [showItinerary, setShowItinerary] = useState<boolean>(false);
  // Dedicated Booking Flow - Step 01: Hotel, Step 02: Transfer, Step 03: Diving, Step 04: Safari, Review, Payment, My Trip
  const [bookingStep, setBookingStep] = useState<'hotel' | 'transfer' | 'diving' | 'safari' | 'review' | 'payment' | 'mytrip' | null>(null);
  const [selectedBookingHotelId, setSelectedBookingHotelId] = useState<string>('dahab-bay-hotel');
  const [selectedBookingTransferId, setSelectedBookingTransferId] = useState<string>('private-car');
  const [bookingFlightNumber, setBookingFlightNumber] = useState<string>('');
  const [selectedBookingDivingId, setSelectedBookingDivingId] = useState<string>('guided-diving');
  const [bookingDivingDay, setBookingDivingDay] = useState<number>(2);
  const [bookingDivingTime, setBookingDivingTime] = useState<string>('09:00 AM');
  const [selectedBookingSafariId, setSelectedBookingSafariId] = useState<string>('desert-safari');
  const [bookingSafariDay, setBookingSafariDay] = useState<number>(3);
  const [bookingSafariTime, setBookingSafariTime] = useState<string>('02:00 PM');

  // /trip-preview is reached after PlanForMeView or ProgramDetailView already
  // wrote real answers into TravelerProfile via updateProfile() and
  // navigated here expecting to see the resulting itinerary. Without this,
  // this component (shared with /trip-builder) always reset to a blank step
  // 1, silently discarding those answers. Runs once on mount only — this is
  // an entry-mode decision, not something that should re-fire if the
  // traveler edits their profile elsewhere while this stays mounted.
  useEffect(() => {
    if (startMode !== 'preview') return;
    setSelectedDurationLabel(
      t('planner.durationDays', { count: profile.lengthDays })
    );
    setAdultsCount(profile.travelersCount || 2);
    setChildrenCount(0);
    setTripDynamic(tripDynamicFromCount(profile.travelersCount || 2));
    setSelectedBudget(budgetFromProfile(profile.budget));
    setSelectedInterests(interestsFromProfile(profile.interests || []));
    setSelectedPace(paceFromProfile(profile.pace));
    setShowItinerary(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMode]);

  const handleSelectDuration = (id: string, label: string) => {
    setSelectedDurationId(id);
    setSelectedDurationLabel(label);
  };

  const handleDatesChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = e.getTime() - s.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        setSelectedDurationLabel(`${diffDays} days (${start} to ${end})`);
      }
    }
  };

  const handleToggleInterest = (id: InterestId) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const goToNextStep = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onExitToHome();
    }
  };

  // Progress percentage calculation
  const progressPercent = (currentStep / totalSteps) * 100;

  // Visual assets & contextual messaging per step
  const getStepContextVisual = () => {
    switch (currentStep) {
      case 2:
        return {
          image: IMG_P1539635278303d4002c07eae3_HERO,
          alt: 'Friends enjoying a relaxing coastal journey and shared adventure along the Dahab seaside',
          badge: t('planner.visual.step2.badge', 'Dahab With Friends'),
          title: t('planner.visual.step2.title', 'Good trips start with knowing who\'s coming.'),
          quote: t('planner.visual.step2.cardText', 'Curating diving spots, seaside lounges, and Bedouin desert dinners sized perfectly for your party.'),
          cardTitle: t('planner.visual.step2.cardTitle', 'Party-Specific Curation'),
          cardText: t('planner.visual.step2.cardText', 'Accommodation layouts, boat charters, and dining spots are matched to your group dynamics.'),
        };
      case 3:
        return {
          image: IMG_P15103123056538ed496efae75_HERO,
          alt: 'Atmospheric Bedouin coastal fire gathering under the Sinai night sky',
          badge: t('planner.visual.step3.badge', 'Dahab Atmosphere'),
          title: t('planner.visual.step3.title', 'Comfort, adventure, and local soul.'),
          quote: t('planner.visual.step3.cardText', 'A great trip doesn\'t have to mean spending more.'),
          cardTitle: t('planner.visual.step3.cardTitle', 'Balanced Sinai Value'),
          cardText: t('planner.visual.step3.cardText', 'A great trip doesn\'t have to mean spending more. We prioritize memorable local experiences, soulful cafes, and welcoming stays.'),
        };
      case 4:
        return {
          image: IMG_P154455176346a013bb70d5_HERO,
          alt: 'Dahab coastline where pristine Red Sea coral reefs meet South Sinai desert mountains',
          badge: t('planner.visual.step4.badge', 'Sinai Experiences'),
          title: t('planner.visual.step4.title', 'Diving, desert safaris, and seaside pace.'),
          quote: t('planner.visual.step4.cardText', 'Your interests shape the trip we build for you.'),
          cardTitle: t('planner.visual.step4.cardTitle', 'Tailored to Your Passions'),
          cardText: t('planner.visual.step4.cardText', 'Your interests shape the trip we build for you. We curate reef diving, canyon trekking, and seaside cafes around what you love.'),
        };
      case 5:
        return {
          image: IMG_P1507525428034b723cf961d3e_HERO,
          alt: 'Serene Dahab coastline where the Red Sea meets Sinai mountains at golden hour',
          badge: t('planner.visual.step5.badge', 'Daily Rhythm'),
          title: t('planner.visual.step5.title', 'A little adventure. A little time to breathe.'),
          quote: t('planner.visual.step5.cardText', 'A little adventure. A little time to breathe.'),
          cardTitle: t('planner.visual.step5.cardTitle', 'Daily Rhythm & Free Time'),
          cardText: t('planner.visual.step5.cardText', 'A little adventure. A little time to breathe. We balance exciting diving and desert activities with plenty of room to unwind by the sea.'),
        };
      case 1:
      default:
        return {
          image: IMG_P154455176346a013bb70d5_HERO,
          alt: 'Scenic Dahab coastline where South Sinai desert mountains meet the turquoise Red Sea waters',
          badge: t('planner.visual.step1.badge', 'Dahab, South Sinai'),
          title: t('planner.visual.step1.title', 'Where the red mountains meet the pristine coral reefs.'),
          quote: t('planner.visual.step1.cardText', 'We\'ll use your answers to build a trip that fits you.'),
          cardTitle: t('planner.visual.step1.cardTitle', 'Personalized Trip Shaping'),
          cardText: t('planner.visual.step1.cardText', 'We\'ll use your answers to build a trip that fits you.'),
        };
    }
  };

  const stepVisual = getStepContextVisual();

  if (bookingStep === 'mytrip') {
    return (
      <MyTripView
        onBackToHome={() => {
          onExitToHome();
        }}
        onExploreClick={() => {
          onExitToHome();
        }}
      />
    );
  }

  if (bookingStep === 'payment') {
    const hotelObj = CURATED_HOTELS.find((h) => h.id === selectedBookingHotelId) || CURATED_HOTELS[0];
    const transferObj = CURATED_TRANSFERS.find((t) => t.id === selectedBookingTransferId) || CURATED_TRANSFERS[0];
    const divingObj = CURATED_DIVING_OPTIONS.find((d) => d.id === selectedBookingDivingId) || CURATED_DIVING_OPTIONS[0];
    const safariObj = CURATED_SAFARI_OPTIONS.find((s) => s.id === selectedBookingSafariId) || CURATED_SAFARI_OPTIONS[0];

    return (
      <BookingPaymentStep
        selectedHotel={hotelObj}
        selectedTransfer={transferObj}
        selectedDiving={divingObj}
        selectedSafari={safariObj}
        flightNumber={bookingFlightNumber}
        divingDay={bookingDivingDay}
        divingTime={bookingDivingTime}
        safariDay={bookingSafariDay}
        safariTime={bookingSafariTime}
        onBackToReview={() => {
          setBookingStep('review');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onViewMyTrip={() => {
          setBookingStep('mytrip');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (bookingStep === 'review') {
    const hotelObj = CURATED_HOTELS.find((h) => h.id === selectedBookingHotelId) || CURATED_HOTELS[0];
    const transferObj = CURATED_TRANSFERS.find((t) => t.id === selectedBookingTransferId) || CURATED_TRANSFERS[0];
    const divingObj = CURATED_DIVING_OPTIONS.find((d) => d.id === selectedBookingDivingId) || CURATED_DIVING_OPTIONS[0];
    const safariObj = CURATED_SAFARI_OPTIONS.find((s) => s.id === selectedBookingSafariId) || CURATED_SAFARI_OPTIONS[0];

    return (
      <BookingReviewStep
        selectedHotel={hotelObj}
        selectedTransfer={transferObj}
        selectedDiving={divingObj}
        selectedSafari={safariObj}
        flightNumber={bookingFlightNumber}
        divingDay={bookingDivingDay}
        divingTime={bookingDivingTime}
        safariDay={bookingSafariDay}
        safariTime={bookingSafariTime}
        onEditHotel={() => {
          setBookingStep('hotel');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onEditTransfer={() => {
          setBookingStep('transfer');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onEditDiving={() => {
          setBookingStep('diving');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onEditSafari={() => {
          setBookingStep('safari');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onBackToSafari={() => {
          setBookingStep('safari');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onContinueToPayment={() => {
          setBookingStep('payment');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (bookingStep === 'safari') {
    const hotelObj = CURATED_HOTELS.find((h) => h.id === selectedBookingHotelId) || CURATED_HOTELS[0];
    const transferObj = CURATED_TRANSFERS.find((t) => t.id === selectedBookingTransferId) || CURATED_TRANSFERS[0];
    const divingObj = CURATED_DIVING_OPTIONS.find((d) => d.id === selectedBookingDivingId) || CURATED_DIVING_OPTIONS[0];

    return (
      <BookingSafariStep
        selectedHotel={hotelObj}
        selectedTransfer={transferObj}
        selectedDiving={divingObj}
        selectedSafariId={selectedBookingSafariId}
        onSelectSafariId={setSelectedBookingSafariId}
        selectedSafariDay={bookingSafariDay}
        onSelectSafariDay={setBookingSafariDay}
        selectedSafariTime={bookingSafariTime}
        onSelectSafariTime={setBookingSafariTime}
        onBackToDiving={() => {
          setBookingStep('diving');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onContinueToReview={() => {
          setBookingStep('review');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (bookingStep === 'diving') {
    return (
      <BookingDivingStep
        selectedHotelId={selectedBookingHotelId}
        selectedTransferId={selectedBookingTransferId}
        initialDivingId={selectedBookingDivingId}
        initialDivingDay={bookingDivingDay}
        initialDivingTime={bookingDivingTime}
        onBackToTransfer={() => {
          setBookingStep('transfer');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onReturnHome={onExitToHome}
        onContinueToSafari={(divingId, day, time) => {
          setSelectedBookingDivingId(divingId);
          setBookingDivingDay(day);
          setBookingDivingTime(time);
          setBookingStep('safari');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (bookingStep === 'transfer') {
    return (
      <BookingTransferStep
        selectedHotelId={selectedBookingHotelId}
        initialTransferId={selectedBookingTransferId}
        initialFlightNumber={bookingFlightNumber}
        onSelectTransferId={setSelectedBookingTransferId}
        onBackToHotel={() => {
          setBookingStep('hotel');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onReturnHome={onExitToHome}
        onContinueToDiving={(transferId, flight) => {
          setSelectedBookingTransferId(transferId);
          setBookingFlightNumber(flight);
          setBookingStep('diving');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (bookingStep === 'hotel') {
    return (
      <BookingHotelStep
        selectedHotelId={selectedBookingHotelId}
        onSelectHotelId={setSelectedBookingHotelId}
        onReturnToItinerary={() => {
          setBookingStep(null);
          setShowItinerary(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onReturnHome={onExitToHome}
        onContinueToTransfer={(hotelId) => {
          setSelectedBookingHotelId(hotelId);
          setBookingStep('transfer');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (showItinerary) {
    return (
      <GeneratedItinerary
        durationLabel={selectedDurationLabel}
        durationOptionId={selectedDurationId}
        aiPlan={aiPlan}
        adultsCount={adultsCount}
        childrenCount={childrenCount}
        tripDynamic={tripDynamic}
        selectedBudget={selectedBudget}
        selectedInterests={selectedInterests}
        selectedPace={selectedPace}
        onEditPreferences={() => {
          setShowItinerary(false);
          setIsBuildingTrip(false);
          setCurrentStep(5);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onReturnHome={onExitToHome}
        onContinueToBooking={() => {
          // Every commerce endpoint requires a session. Without this gate a
          // traveller configured a whole trip, walked four booking steps and
          // only found out at the payment endpoint — which then returned 401
          // and, before the fix above, still told them it was confirmed.
          if (!isSignedIn) {
            setIntendedRoute('/trip-builder');
            showToast(
              isRTL
                ? 'سجّل دخولك عشان نكمّل الحجز — اختياراتك محفوظة.'
                : 'Sign in to complete your booking — your selections are kept.'
            );
            navigateTo('/auth/sign-in');
            return;
          }
          setShowItinerary(false);
          setBookingStep('hotel');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }


  if (isBuildingTrip) {
    return (
      <BuildingTripState
        durationLabel={selectedDurationLabel}
        durationDays={durationDays}
        adultsCount={adultsCount}
        tripDynamic={tripDynamic}
        selectedBudget={selectedBudget}
        selectedInterests={selectedInterests}
        selectedPace={selectedPace}
        onComplete={() => {
          setIsBuildingTrip(false);
          setShowItinerary(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onBackToPlanner={() => setIsBuildingTrip(false)}
        onReturnHome={onExitToHome}
      />
    );
  }

  return (
    <div
      id="trip-planner-screen"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col"
    >
      {/* 1. Planning Experience Top Header */}
      <header
        id="planner-header"
        className="sticky top-0 z-40 bg-[var(--surface-card)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* DAHAB Branding Logo */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={onExitToHome}
                id="planner-logo-home-btn"
                className="text-2xl font-black tracking-tighter text-[var(--text-primary)] hover:text-[var(--accent-secondary)] transition-colors cursor-pointer"
                title={t('planner.returnToHomepage')}
              >
                DAHAB
              </button>

              <div className="hidden md:block h-5 w-[1px] bg-[var(--btn-util-bg)]" />

              {/* Progress Title & Step Trail Indicator */}
              <div className="hidden md:flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[var(--accent-primary)]">
                    {t('planner.header.title', 'Plan your Dahab trip')}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]/70 font-semibold">
                    {t('planner.header.stepOf', 'Step')} {currentStep} {t('planner.header.of', 'of')} {totalSteps}
                  </span>
                </div>

                {/* Subtle Visual Step Indicator Trail */}
                <div className="flex items-center gap-2 pl-4 border-l border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]/60 rtl:border-l-0 rtl:border-r rtl:pr-4 rtl:pl-0">
                  {PLANNING_STEPS.map((step, idx) => {
                    const isCompleted = currentStep > step.number;
                    const isCurrent = currentStep === step.number;
                    return (
                      <React.Fragment key={step.number}>
                        <div
                          className={`flex items-center gap-1.5 transition-colors ${
                            isCurrent
                              ? 'text-[var(--accent-secondary)] font-bold'
                              : isCompleted
                              ? 'text-[var(--accent-primary)] font-bold'
                              : 'text-[var(--text-secondary)]/40'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[11px] ${
                              isCompleted
                                ? 'bg-[var(--accent-primary)] text-[var(--surface-card)] font-bold'
                                : isCurrent
                                ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold'
                                : 'bg-[var(--surface-container)] text-[var(--text-secondary)]/60 border border-[var(--border-subtle)]'
                            }`}
                          >
                            {isCompleted ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : step.number}
                          </span>
                          <span>{t(step.labelKey, step.defaultShortLabel)}</span>
                        </div>
                        {idx < PLANNING_STEPS.length - 1 && (
                          <span className="text-[var(--text-muted)] rtl:rotate-180">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mobile compact step counter */}
            <div className="md:hidden flex items-center gap-1.5 text-xs font-bold text-[var(--accent-primary)]">
              <span>{t('planner.header.stepOf', 'Step')} {currentStep}</span>
              <span className="text-[var(--text-muted)]">/ {totalSteps}</span>
            </div>

            {/* Exit Action */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                id="planner-exit-btn"
                onClick={onExitToHome}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3.5 py-2 rounded-full hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border border-transparent hover:border-[var(--border-subtle)]"
              >
                <span>{t('planner.header.exit', 'Exit')}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Subtle Progress Bar */}
        <div className="w-full bg-[var(--btn-util-bg)] h-1">
          <div
            id="planner-progress-bar"
            className="bg-[var(--accent-secondary)] h-1 transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500 ease-out shadow-[0_0_12px_rgba(244,195,108,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* 2. Main Planning Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          
          {/* Left Column: Focused Interactive Step Controls */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            {currentStep === 1 && (
              <StepDuration
                selectedDurationId={selectedDurationId}
                onSelectDuration={handleSelectDuration}
                startDate={startDate}
                endDate={endDate}
                onDatesChange={handleDatesChange}
                onContinue={goToNextStep}
                onBack={onExitToHome}
              />
            )}

            {currentStep === 2 && (
              <StepTravelers
                adultsCount={adultsCount}
                childrenCount={childrenCount}
                tripDynamic={tripDynamic}
                onAdultsChange={setAdultsCount}
                onChildrenChange={setChildrenCount}
                onTripDynamicChange={setTripDynamic}
                onContinue={goToNextStep}
                onBack={goToPreviousStep}
              />
            )}

            {currentStep === 3 && (
              <StepBudget
                selectedBudget={selectedBudget}
                onSelectBudget={setSelectedBudget}
                onContinue={goToNextStep}
                onBack={goToPreviousStep}
              />
            )}

            {currentStep === 4 && (
              <StepInterests
                selectedInterests={selectedInterests}
                onToggleInterest={handleToggleInterest}
                onContinue={goToNextStep}
                onBack={goToPreviousStep}
              />
            )}

            {currentStep === 5 && (
              <StepPace
                selectedPace={selectedPace}
                onSelectPace={setSelectedPace}
                onBuildTrip={handleBuildTrip}
                onBack={goToPreviousStep}
              />
            )}
          </div>

          {/* Right Column: Visual Representation of Dahab */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-28 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden shadow-2xl transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300">
              
              {/* Authentic High-Quality Dahab Imagery */}
              <div className="relative h-64 sm:h-80 lg:h-96 w-full overflow-hidden bg-[var(--surface-card)]">
                <img
                  key={stepVisual.image}
                  src={stepVisual.image}
                  alt={stepVisual.alt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center scale-102 hover:scale-105 transition-transform duration-700 ease-out opacity-90 animate-in fade-in duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-[var(--surface-card)]/40 to-transparent" />

                {/* Location / Dynamic Badge */}
                <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 z-10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-card)]/80 backdrop-blur-md border border-[var(--border-subtle)] text-[var(--text-primary)] text-[12px] font-bold">
                    <MapPin className="w-3 h-3 text-[var(--accent-secondary)]" />
                    <span>{stepVisual.badge}</span>
                  </div>
                </div>

                {/* Bottom Overlay Info in Image */}
                <div className="absolute bottom-4 left-4 right-4 z-10 text-white">
                    <span className="text-[11px] font-bold text-[var(--accent-secondary)] block mb-1">
                    {t('planner.common.authenticSinai', 'Authentic Sinai Travel')}
                  </span>
                  <p className="text-sm sm:text-base chart-heading-accent text-[var(--text-primary)] leading-snug">
                    {stepVisual.title}
                  </p>
                </div>
              </div>

              {/* Contextual Value Card */}
              <div className="p-6 sm:p-7 bg-[var(--surface-card)]">
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="w-9 h-9 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 shadow-inner">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      {stepVisual.cardTitle}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed font-normal">
                      {stepVisual.cardText}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-xs text-[var(--text-secondary)] font-medium">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
                  <span>{t('planner.common.flexiblePromise', 'No rigid tour packages · Tailored to your pace & preferences')}</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* 3. Simple Planning Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-6 bg-[var(--surface-card)] text-center text-xs text-[var(--text-secondary)]/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} DAHAB Travel Experience Platform</span>
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t('planner.common.curatedExpertise', 'Curated with local Sinai expertise')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
