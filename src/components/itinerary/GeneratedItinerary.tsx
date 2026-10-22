import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  MapPin, 
  Calendar, 
  Users, 
  Wallet, 
  Gauge, 
  Compass, 
  ArrowRight, 
  ArrowLeft, 
  SlidersHorizontal, 
  Info, 
  Waves, 
  Tag, 
  Share2, 
  Check, 
  ShieldCheck, 
  Download, 
  Heart,
  MessageSquareQuote,
  Clock
} from 'lucide-react';
import { ItineraryDayCard, DayItinerary } from './ItineraryDayCard';
import { ActivityDetailModal, ActivityDetailData } from './ActivityDetailModal';
import { AlternativesModal, AlternativeItem } from './AlternativesModal';
import { TripCustomizeModal } from './TripCustomizeModal';
import { TripDynamicType } from '../planner/StepTravelers';
import { BudgetTier } from '../planner/StepBudget';
import { InterestId, INTERESTS_DATA } from '../planner/StepInterests';
import { PaceType } from '../planner/StepPace';
import { TripBriefCard } from '../tripos/TripBriefCard';
import { TripBriefModal } from '../tripos/TripBriefModal';
import { TripHealthModal } from '../tripos/TripHealthModal';
import { BudgetBreakdownModal } from '../tripos/BudgetBreakdownModal';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { IMG_P1509316975850ff9c5deb0cd9_CARD, IMG_P154455176346a013bb70d5_CARD, IMG_P154455176346a013bb70d5_HERO, IMG_P16826872200634742bd7fd538_CARD } from '../../shared/placeholderImagery';

/**
 * The shape POST /api/trip/generate returns for one trip (already
 * availability-enriched server-side: real DB prices, bookability flags).
 */
export interface AiGeneratedPlan {
  tripTitle?: string;
  tripTitleAr?: string;
  summary?: string;
  summaryAr?: string;
  totalEstimatedEGP?: number;
  fitScore?: number;
  days?: Array<{
    dayNumber?: number;
    title?: string;
    titleAr?: string;
    theme?: string;
    activities?: Array<{
      id?: string;
      title?: string;
      titleAr?: string;
      timeSlot?: string;
      location?: string;
      category?: string;
      estimatedPriceEGP?: number;
      description?: string;
      descriptionAr?: string;
    }>;
  }>;
}

interface GeneratedItineraryProps {
  durationLabel: string;
  /** The traveler's chosen duration option id ('2-3' | '4-5' | '6-7' | '8+' | 'custom'), or null when derived from dates. */
  durationOptionId?: string | null;
  /** A resolved AI plan (from the building screen's generation call). When present it IS the itinerary shown for approval; otherwise the compiled editorial plan is shaped to the duration choice. */
  aiPlan?: AiGeneratedPlan | null;
  adultsCount: number;
  childrenCount: number;
  tripDynamic: TripDynamicType | null;
  selectedBudget: BudgetTier;
  selectedInterests: InterestId[];
  selectedPace: PaceType;
  onEditPreferences: () => void;
  onReturnHome: () => void;
  onContinueToBooking: () => void;
}

export const INITIAL_5_DAY_ITINERARY: DayItinerary[] = [
  {
    dayNumber: 1,
    title: 'Arrival & Slow Start',
    theme: 'Arrival & Coastline Stroll',
    badge: 'Easy start',
    summary: 'Arrive in Sinai, check in by the sea, and enjoy an unhurried sunset walk along the Lighthouse promenade.',
    items: [
      {
        id: 'd1-1',
        time: '10:00 AM',
        name: 'Arrival in Sharm El Sheikh',
        description: 'Flight arrival at SSH Airport with meet-and-greet assistance.',
        location: 'Sharm El Sheikh International Airport (SSH)',
        category: 'Transfer',
        status: 'suggested',
        details: {
          fullDetails: 'Private air-conditioned transfer awaiting your arrival outside the terminal with luggage assistance.',
          included: ['Private AC vehicle', 'Driver meet-and-greet', 'Water bottles on board'],
          tips: 'Keep your passport handy for standard Sinai highway checkpoints along the coast.',
        },
      },
      {
        id: 'd1-2',
        time: '11:30 AM',
        name: 'Transfer to Dahab',
        description: 'Scenic 1-hour coastal drive winding between Sinai red granite mountains and the Gulf of Aqaba.',
        location: 'Sinai Coastal Highway',
        category: 'Transfer',
        status: 'suggested',
      },
      {
        id: 'd1-3',
        time: '1:00 PM',
        name: 'Check-in / Leave bags',
        description: 'Settle into your beachfront accommodation in the peaceful Lighthouse / Eel Garden area.',
        location: 'Lighthouse Waterfront Lodge',
        category: 'Stay',
        status: 'suggested',
      },
      {
        id: 'd1-4',
        time: '2:00 PM',
        name: 'Lunch near the hotel',
        description: 'Casual open-air lunch with fresh Egyptian meze, grilled halloumi, and fresh mango juice.',
        location: 'Seaside Promenade Cafe',
        category: 'Food',
        status: 'suggested',
      },
      {
        id: 'd1-5',
        time: '4:00 PM',
        name: 'Beach & Lighthouse walk',
        description: 'Unwind with an easy seaside walk from Lighthouse Bay to Eel Garden as the late afternoon light softens.',
        location: 'Lighthouse Bay & Coral Promenade',
        category: 'Leisure',
        status: 'free_time',
      },
      {
        id: 'd1-6',
        time: '7:30 PM',
        name: 'Local dinner',
        description: 'Authentic local dinner under warm Bedouin lanterns featuring slow-cooked lamb and freshly baked bread.',
        location: 'Ali Baba / Bedouin Lodge Restaurant',
        category: 'Food',
        status: 'suggested',
      },
    ],
  },
  {
    dayNumber: 2,
    title: 'Dive & Explore',
    theme: 'World-Class Reefs & Seaside Rhythm',
    summary: 'Discover Dahab’s legendary underwater world in the morning, followed by relaxing seaside cafes.',
    items: [
      {
        id: 'd2-1',
        time: '9:00 AM',
        name: 'Diving experience',
        description: 'Guided morning dive at Lighthouse Reef & Eel Garden with certified local dive masters.',
        location: 'Blue Hole / Lighthouse Reef Area',
        category: 'Diving',
        status: 'suggested',
        isHighlight: true,
        image: IMG_P16826872200634742bd7fd538_CARD,
        details: {
          fullDetails: 'Experience Dahab’s vibrant coral gardens and rich marine life. Includes comprehensive briefing, full scuba equipment, and dedicated dive guides suited for both certified divers and beginners.',
          included: ['Full dive gear (tanks, BCD, wetsuit, regulator)', 'Certified dive guide', 'Marine park entry permits', 'Post-dive debrief & log verification'],
          tips: 'Stay well hydrated and bring your certification card or logbook if you are certified.',
        },
      },
      {
        id: 'd2-2',
        time: '1:00 PM',
        name: 'Lunch',
        description: 'Post-dive seaside lunch with freshly caught fish, tahina, and bedouin bread right by the water.',
        location: 'Eel Garden Waterfront Restaurant',
        category: 'Food',
        status: 'suggested',
      },
      {
        id: 'd2-3',
        time: '3:00 PM',
        name: 'Free time',
        description: 'Nap in a seafront hammock, read, or take a gentle swim in the clear shallow reef pools.',
        location: 'Lighthouse Beach Huts',
        category: 'Leisure',
        status: 'free_time',
      },
      {
        id: 'd2-4',
        time: '5:00 PM',
        name: 'Coffee by the sea',
        description: 'Sip authentic Habak herbal tea or specialty espresso at an open-air bohemian seaside lounge.',
        location: 'Everyday Cafe / Ralph’s German Bakery',
        category: 'Food',
        status: 'suggested',
      },
      {
        id: 'd2-5',
        time: '8:00 PM',
        name: 'Dinner',
        description: 'Seafood barbecue along the illuminated water’s edge with relaxed acoustic music in the background.',
        location: 'El Fanar Seafood Grill',
        category: 'Food',
        status: 'suggested',
      },
    ],
  },
  {
    dayNumber: 3,
    title: 'Desert Adventure',
    theme: 'Sinai Canyons & Bedouin Campfire',
    summary: 'A lazy morning to recharge, then head deep into the Sinai mountains for a 4x4 desert canyon safari and sunset dinner.',
    items: [
      {
        id: 'd3-1',
        time: '9:00 AM',
        name: 'Slow breakfast',
        description: 'Relaxed breakfast with fresh fruit, shakshuka, and coffee listening to the morning tide.',
        location: 'Waterfront Terrace',
        category: 'Food',
        status: 'free_time',
      },
      {
        id: 'd3-2',
        time: '11:00 AM',
        name: 'Free morning',
        description: 'Free hours for snorkeling, paddleboarding, or exploring local boutique dive shops.',
        location: 'Dahab Bay',
        category: 'Leisure',
        status: 'free_time',
      },
      {
        id: 'd3-3',
        time: '2:00 PM',
        name: 'Desert Safari',
        description: '4x4 expedition through the dramatic sandstone gorges of Colored Canyon and hidden desert wadis.',
        location: 'Sinai Desert Canyons & Protected Valley',
        category: 'Adventure',
        status: 'suggested',
        isHighlight: true,
        hasAlternatives: true,
        alternativeCount: 3,
        alternativeName: 'canyon-4x4',
        image: IMG_P1509316975850ff9c5deb0cd9_CARD,
        details: {
          fullDetails: 'Venture into the heart of the South Sinai mountains in a private 4x4 safari Jeep accompanied by local Bedouin trackers. Hike through sculpted natural rock passages and sandstone formations.',
          included: ['4x4 Land Cruiser transport with driver', 'Bedouin local wilderness guide', 'Desert tea brewed over acacia wood', 'Protected area conservation fees'],
          tips: 'Wear sturdy closed-toe walking shoes or trainers for the canyon walks.',
        },
      },
      {
        id: 'd3-4',
        time: '6:00 PM',
        name: 'Sunset',
        description: 'Watch the sun drop behind the jagged Sinai ridges as the desert turns shades of amber, violet, and gold.',
        location: 'Wadi Gnai Canyon Lookout',
        category: 'Adventure',
        status: 'suggested',
      },
      {
        id: 'd3-5',
        time: '8:00 PM',
        name: 'Dinner',
        description: 'Traditional Bedouin feast prepared underground and over hot desert coals under thousands of stars.',
        location: 'Bedouin Mountain Desert Camp',
        category: 'Food',
        status: 'suggested',
      },
    ],
  },
  {
    dayNumber: 4,
    title: 'Sea & Local Life',
    theme: 'Ras Abu Galum & Bedouin Coastal Living',
    summary: 'Boat ride to remote coastal lagoons, pristine coral snorkeling, and evening exploration of Dahab’s local artisan village.',
    items: [
      {
        id: 'd4-1',
        time: '9:00 AM',
        name: 'Breakfast',
        description: 'Fresh pastries, warm falafel, and freshly pressed pomegranate juice in Assalah village.',
        location: 'Assalah Local Bakery',
        category: 'Food',
        status: 'suggested',
      },
      {
        id: 'd4-2',
        time: '11:00 AM',
        name: 'Boat / snorkeling experience',
        description: 'Boat excursion from Blue Hole to Ras Abu Galum nature reserve and the crystal turquoise Blue Lagoon.',
        location: 'Ras Abu Galum & Blue Lagoon',
        category: 'Water Activities',
        status: 'suggested',
        image: IMG_P154455176346a013bb70d5_CARD,
        details: {
          fullDetails: 'Sail along the dramatic sea cliffs north of Dahab to Ras Abu Galum, a tranquil Bedouin fishing community with some of the clearest waters in Egypt. Swim and snorkel in virgin coral gardens.',
          included: ['Speedboat return transfer from Blue Hole', 'Snorkeling mask & fins', 'Bedouin shade hut access in Blue Lagoon', 'National Park conservation permit'],
          tips: 'Bring reef-safe sunscreen and a light windbreaker for the boat ride.',
        },
      },
      {
        id: 'd4-3',
        time: '2:00 PM',
        name: 'Local lunch',
        description: 'Fresh grilled fish caught by local fishermen served with Bedouin salad and rice on woven beach carpets.',
        location: 'Ras Abu Galum Beach Huts',
        category: 'Food',
        status: 'suggested',
      },
      {
        id: 'd4-4',
        time: '4:00 PM',
        name: 'Free time',
        description: 'Swim in the flat turquoise lagoon or simply unwind in the quiet desert breeze.',
        location: 'Blue Lagoon Shoreline',
        category: 'Leisure',
        status: 'free_time',
      },
      {
        id: 'd4-5',
        time: '7:00 PM',
        name: 'Explore Dahab',
        description: 'Wander through Assalah and Mashraba, discovering silver artisans, organic spices, and handmade rugs.',
        location: 'Assalah & Mashraba Markets',
        category: 'Local Life',
        status: 'suggested',
      },
    ],
  },
  {
    dayNumber: 5,
    title: 'Last Morning',
    theme: 'Farewell Swim & Smooth Departure',
    badge: 'Departure',
    summary: 'A final morning dip in the Red Sea, relaxed packing, and private airport transfer back to Sharm El Sheikh.',
    items: [
      {
        id: 'd5-1',
        time: '9:00 AM',
        name: 'Breakfast',
        description: 'Final breakfast on the seaside terrace with fresh coffee and sea breeze.',
        location: 'Lighthouse Seaside Cafe',
        category: 'Food',
        status: 'suggested',
      },
      {
        id: 'd5-2',
        time: '10:30 AM',
        name: 'Final beach time',
        description: 'Last morning swim in the clear waters of Lighthouse Bay.',
        location: 'Lighthouse Beach',
        category: 'Leisure',
        status: 'free_time',
      },
      {
        id: 'd5-3',
        time: '11:00 AM',
        name: 'Checkout',
        description: 'Pack bags and complete checkout at hotel reception.',
        location: 'Lighthouse Waterfront Lodge',
        category: 'Stay',
        status: 'suggested',
      },
      {
        id: 'd5-4',
        time: '1:00 PM',
        name: 'Transfer',
        description: 'Private transfer from Dahab back to Sharm El Sheikh International Airport for return departure.',
        location: 'Direct transfer to SSH Airport',
        category: 'Transfer',
        status: 'suggested',
      },
    ],
  },
];

export const GeneratedItinerary: React.FC<GeneratedItineraryProps> = ({
  durationLabel,
  durationOptionId = null,
  aiPlan = null,
  adultsCount,
  childrenCount,
  tripDynamic,
  selectedBudget,
  selectedInterests,
  selectedPace,
  onEditPreferences,
  onReturnHome,
  onContinueToBooking,
}) => {
  const { t, language, isRTL } = useLanguage();
  // State for Trip Approval: false = Suggested Itinerary, true = Trip Approved
  const [isApproved, setIsApproved] = useState<boolean>(false);

  // Modals state
  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);
  const [selectedActivityForDetails, setSelectedActivityForDetails] = useState<ActivityDetailData | null>(null);
  
  // Alternatives modal state
  const [alternativesModalOpen, setAlternativesModalOpen] = useState<boolean>(false);
  const [currentAlternativeActivity, setCurrentAlternativeActivity] = useState<string>('');
  const [activeAlternativeId, setActiveAlternativeId] = useState<string>('canyon-4x4');

  // Active Itinerary state
  //
  // The plan the traveler is asked to approve must match the duration they
  // chose in Step 1. This used to render INITIAL_5_DAY_ITINERARY verbatim, so
  // picking "2–3 days" produced a DAY 1–5 plan — and the brief panel claimed
  // "5 Days / 4 Nights". The compiled days are real editorial content, so the
  // fix keeps them but shapes them to the choice: the option's upper bound
  // sets the day count, trailing days are dropped, and if anything was cut the
  // departure day (compiled Day 5: final swim → checkout → transfer) is
  // appended so the plan still ends with a proper goodbye.
  const chosenDays = (() => {
    if (durationOptionId === '2-3') return 3;
    if (durationOptionId === '4-5') return 5;
    if (durationOptionId === '6-7') return 7;
    if (durationOptionId === '8+') return 8;
    if (durationOptionId === 'custom') return 5;
    // No option id (dates entry or profile-driven preview): keep the previous
    // behaviour of showing the full compiled week.
    return INITIAL_5_DAY_ITINERARY.length;
  })();
  const shapedItinerary = (() => {
    if (chosenDays >= INITIAL_5_DAY_ITINERARY.length) return INITIAL_5_DAY_ITINERARY;
    const kept = INITIAL_5_DAY_ITINERARY.slice(0, chosenDays - 1);
    const departureDay = { ...INITIAL_5_DAY_ITINERARY[INITIAL_5_DAY_ITINERARY.length - 1] };
    // Renumber the departure day so the plan reads DAY 1..N without a gap.
    return [...kept, { ...departureDay, dayNumber: chosenDays }];
  })();

  /**
   * The AI plan from /api/trip/generate mapped onto the itinerary-day shape.
   * Used verbatim when the generation call resolved (the traveler then
   * approves what the AI actually produced); empty otherwise.
   */
  const aiItinerary: DayItinerary[] = aiPlan?.days?.length
    ? aiPlan.days.map((day, dayIdx) => ({
        dayNumber: day.dayNumber ?? dayIdx + 1,
        title: language === 'ar' && day.titleAr ? day.titleAr : day.title || `Day ${dayIdx + 1}`,
        theme: day.theme || '',
        badge: undefined,
        summary: language === 'ar' && aiPlan.summaryAr ? aiPlan.summaryAr : aiPlan.summary || '',
        items: (day.activities || []).map((act, actIdx) => ({
          id: act.id || `ai-d${dayIdx + 1}-${actIdx + 1}`,
          time: act.timeSlot || '',
          name: language === 'ar' && act.titleAr ? act.titleAr : act.title || 'Activity',
          description: language === 'ar' && act.descriptionAr ? act.descriptionAr : act.description,
          location: act.location,
          category: act.category || 'Activity',
          status: 'suggested' as const,
        })),
      }))
    : [];

  // Re-sync when the AI plan resolves after mount (the building screen plays
  // ~3s while the request is in flight) or when the duration choice changes.
  const aiKey = aiItinerary.length > 0 ? 'ai' : `compiled-${chosenDays}`;
  const [itineraryDays, setItineraryDays] = useState<DayItinerary[]>(aiItinerary.length ? aiItinerary : shapedItinerary);
  useEffect(() => {
    setItineraryDays(aiItinerary.length ? aiItinerary : shapedItinerary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiKey]);

  // Trip OS Context & Modal State
  const { tripHealth, activeTrip, profile } = useTrip();

  /**
   * The blueprint panel described a fixed trip.
   *
   * Budget, pace and interests were `t()` calls with literal fallbacks —
   * "Moderate Budget", "Balanced", "Diving, Adventure, Food" — so a traveler
   * who had just chosen Premium and Relaxed with an interest in food read back
   * somebody else's blueprint on the screen that asks them to approve it.
   */
  const chosenBudget = activeTrip?.budget || profile.budget;
  const chosenPace = activeTrip?.pace || profile.pace;
  const chosenInterests = (activeTrip?.interests?.length ? activeTrip.interests : profile.interests) || [];
  const [isTripBriefModalOpen, setIsTripBriefModalOpen] = useState<boolean>(false);
  const [isTripHealthModalOpen, setIsTripHealthModalOpen] = useState<boolean>(false);
  const [isBudgetBreakdownModalOpen, setIsBudgetBreakdownModalOpen] = useState<boolean>(false);

  const handleApproveTrip = () => {
    setIsApproved(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAlternative = (alt: AlternativeItem) => {
    setActiveAlternativeId(alt.id);
    // Swap the item the alternatives modal was opened for — matched by its own
    // id, not a hardcoded Day 3 slot, so the swap works wherever the modal was
    // opened from (and on AI-generated plans whose ids differ).
    setItineraryDays((prev) =>
      prev.map((day) => ({
        ...day,
        items: day.items.map((item) =>
          item.id === activeAlternativeId
            ? {
                ...item,
                name: alt.title,
                description: alt.description,
                alternativeName: alt.id,
              }
            : item
        ),
      }))
    );
  };

  const travelersSummary = `${adultsCount} ${adultsCount > 1 ? t('itinerary.adultPlural') : t('itinerary.adultSingle')}${
    tripDynamic ? ` · ${tripDynamic}` : ''
  }`;

  // ---- Honest label helpers ----
  // Budget/Pace labels that reflect the traveler's own selections instead of
  // hardcoded "Moderate" / "Balanced".
  const budgetLabel = (() => {
    const tier = String(selectedBudget).toLowerCase();
    if (tier === 'budget') return language === 'ar' ? 'اقتصادية' : 'Budget';
    if (tier === 'premium') return language === 'ar' ? 'فاخرة' : 'Premium';
    return language === 'ar' ? 'متوازنة' : 'Moderate';
  })();
  const paceLabel = (() => {
    if (selectedPace === 'slow') return language === 'ar' ? 'رايق' : 'Relaxed';
    if (selectedPace === 'packed') return language === 'ar' ? 'مليان' : 'Full';
    return language === 'ar' ? 'متوازن' : 'Balanced';
  })();
  const interestLabels = (selectedInterests.length ? selectedInterests : chosenInterests)
    .map((id) => {
      const item = INTERESTS_DATA.find((i) => i.id === id);
      if (item) return language === 'ar' ? (item.nameAr || item.name) : item.name;
      // If the id is a raw label string (e.g. from profile), use it directly.
      return id;
    });

  return (
    <div
      id="generated-itinerary-screen"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col pb-24 sm:pb-16"
    >
      {/* 1. Top Global Navigation Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onReturnHome}
              className="text-xl font-black text-[var(--text-primary)] hover:opacity-80 transition-opacity"
            >
              DAHAB
            </button>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-xs font-bold text-[var(--accent-secondary)] hidden sm:inline">
              {t('itinerary.badge.personalized', 'Personalized Trip')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Trip OS Health Status Pill */}
            <button
              type="button"
              id="header-trip-health-btn"
              onClick={() => setIsTripHealthModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
                tripHealth.criticalCount === 0 && tripHealth.warningCount === 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{tripHealth.statusLabel}</span>
            </button>

            <button
              type="button"
              id="header-edit-preferences-btn"
              onClick={onEditPreferences}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3.5 py-2 rounded-full hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer"
            >
              <span>{t('itinerary.btn.editPreferences', 'Edit preferences')}</span>
            </button>

            {!isApproved ? (
              <button
                type="button"
                id="header-approve-trip-btn"
                onClick={handleApproveTrip}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-card)] text-xs font-bold shadow-xs hover:shadow transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                <span>{t('itinerary.btn.approveTrip', 'Approve Trip')}</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('itinerary.btn.tripApproved', 'Trip Approved')}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Confirmation Message */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/20 text-xs font-bold mb-3.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('itinerary.badge.curatedForYou', 'Curated For Ahmed')}</span>
          </div>

          <h1
            id="itinerary-main-title"
            className="text-3xl sm:text-4xl md:text-5xl chart-heading text-[var(--text-primary)] tracking-tight leading-[1.12]"
          >
            {t('itinerary.mainTitle', 'We built this Dahab trip for you.')}
          </h1>

          <p
            id="itinerary-supporting-subtitle"
            className="mt-3 text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed font-normal max-w-3xl"
          >
            {t('itinerary.subTitle', 'A balanced experience with diving, adventure, local food, and enough time to slow down.')}
          </p>
        </div>

        {/* Status Notification Banner (Suggested vs Approved) */}
        {!isApproved ? (
          <div
            id="status-suggested-banner"
            className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-2xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] flex items-center justify-center flex-shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--accent-secondary)]">
                    {t('itinerary.status.label', 'Status')}
                  </span>
                  <span className="text-xs font-bold text-[var(--text-primary)] bg-[var(--btn-util-bg)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
                    {t('itinerary.status.suggested', 'Suggested itinerary')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 font-normal">
                  {t('itinerary.status.suggestedDesc', 'Review and approve your trip before booking. Everything is fully flexible.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-center">
              <button
                type="button"
                id="banner-customize-btn"
                onClick={() => setIsCustomizeOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] hover:text-[var(--text-primary)] bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] px-3.5 py-2 rounded-full border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{t('itinerary.btn.customize', 'Customize Trip')}</span>
              </button>

              <button
                type="button"
                id="banner-approve-btn"
                onClick={handleApproveTrip}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-card)] text-xs font-bold shadow-sm transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                <span>{t('itinerary.btn.approveTrip', 'Approve Trip')}</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            id="status-approved-banner"
            className="p-5 sm:p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-2xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-[var(--surface-card)] flex items-center justify-center flex-shrink-0 shadow-2xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-[var(--surface-card)]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-emerald-200">
                    {t('itinerary.status.approved', 'Trip approved')}
                  </h3>
                  <span className="text-[11px] font-bold bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                    {t('itinerary.status.readyForBooking', 'Ready for booking')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-300/90 mt-0.5 font-normal">
                  {t('itinerary.status.readyDesc', "Your itinerary is ready. Let's take care of the bookings.")}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="approved-continue-to-booking-btn"
              onClick={onContinueToBooking}
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[var(--surface-card)] text-sm font-bold shadow-md hover:shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer whitespace-nowrap self-start sm:self-center"
            >
              <span>{t('itinerary.btn.continueBooking', 'Continue to Booking')}</span>
              <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        {/*
          Removed from this page: TripFitScoreCard, MakeItBetterBar and, below,
          DayIntelligenceHeader and TripReadinessCard.

          Each rendered a score presented as computed for this trip — an
          overall fit of 94 with "Preference Coverage 96%", a readiness of 88,
          per-day intelligence and a set of trade-offs — read from fixed
          objects in src/data/tripOsDefaults.ts. There is no engine behind any
          of them: the numbers were identical for every traveler and every
          itinerary, and no code path ever recalculated one.

          The brief below is kept because it describes the trip rather than
          scoring it, and it is bound to the traveler's own trip record now.
          Trip health is kept too, and comes from
          GET /api/daygi/health/:tripId, which genuinely derives its issues
          from the trip's items, bookings and holds.
        */}
        <div className="space-y-6 mb-8">
          <TripBriefCard
            onOpenEditModal={() => setIsTripBriefModalOpen(true)}
            durationDaysOverride={chosenDays}
            travelersCountOverride={adultsCount + childrenCount}
          />
        </div>

        {/* 3. Hero Editorial Card Header with Tags & Metrics */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden shadow-xs mb-8 aurora-glass">
          {/* Hero Banner Image */}
          <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-black/30">
            <img
              src={IMG_P154455176346a013bb70d5_HERO}
              alt="Dahab coastline where South Sinai mountains meet the turquoise Red Sea waters"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-black/40 to-transparent" />

            {/* Top Right Floating Tags */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onEditPreferences}
                className="px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold border border-[var(--border-subtle)] transition-colors flex items-center gap-1.5"
              >
                <span>{t('itinerary.editPreferences')}</span>
              </button>
            </div>

            {/* Bottom Hero Details Overlay */}
            <div className="absolute bottom-6 left-6 right-6 text-white flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold">
                    {t('itinerary.southSinaiEgypt')}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    {durationLabel
                      ? t('itinerary.durationTravelers', { durationLabel, adultsCount })
                      : t('itinerary.5DaysTravelers', { adultsCount })}
                  </span>
                </div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl chart-heading font-bold text-[var(--text-primary)] tracking-tight leading-none">
                  {t('itinerary.dahab')}
                </h2>

                {/* Preference Tags — reflects the traveler's own selections */}
                <div className="flex flex-wrap items-center gap-2 mt-3.5">
                  {interestLabels.slice(0, 4).map((label) => (
                    <span
                      key={label}
                      className="px-3 py-1 rounded-full bg-[var(--btn-util-bg)] backdrop-blur-md text-[var(--text-primary)] text-xs font-semibold border border-[var(--border-subtle)]"
                    >
                      {label}
                    </span>
                  ))}
                  <span className="px-3 py-1 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold">
                    {paceLabel}
                  </span>
                </div>
              </div>

              {/* Quick Summary Pill on Desktop */}
              <div className="hidden md:flex items-center gap-3 bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                <div className="text-center px-2">
                  <span className="block font-bold text-sm text-[var(--text-primary)]">{durationLabel || t('itinerary.5Days')}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{t('attractions.duration')}</span>
                </div>
                <div className="w-px h-6 bg-[var(--btn-util-bg)]" />
                <div className="text-center px-2">
                  <span className="block font-bold text-sm text-[var(--text-primary)]">{t('itinerary.adults', { adultsCount })}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{t('itinerary.travelers')}</span>
                </div>
                <div className="w-px h-6 bg-[var(--btn-util-bg)]" />
                <div className="text-center px-2">
                  <span className="block font-bold text-sm text-[var(--text-primary)]">{budgetLabel}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{t('itinerary.budget')}</span>
                </div>
                <div className="w-px h-6 bg-[var(--btn-util-bg)]" />
                <div className="text-center px-2">
                  <span className="block font-bold text-sm text-[var(--text-primary)]">{paceLabel}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{t('itinerary.pace')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Metric Strip for All Viewports */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10 border-t border-[var(--border-subtle)] bg-[var(--surface-card)] text-xs">
            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-secondary)]">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">
                  {t('itinerary.tripDuration')}
                </span>
                <span className="font-bold text-[var(--text-primary)]">{durationLabel || t('itinerary.5Days')}</span>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-secondary)]">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">
                  {t('itinerary.travelers-2')}
                </span>
                <span className="font-bold text-[var(--text-primary)]">{travelersSummary}</span>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-secondary)]">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">
                  {t('itinerary.budgetLevel')}
                </span>
                <span className="font-bold text-[var(--text-primary)]">{budgetLabel}</span>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-secondary)]">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">
                  {t('itinerary.dailyRhythm')}
                </span>
                <span className="font-bold text-[var(--text-primary)]">{paceLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Two-Column Layout on Desktop: Left Itinerary Timeline, Right Trip Context Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Itinerary Content (Left 8 Columns) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Why This Trip AI Recommendation Box */}
            <div
              id="why-this-trip-card"
              className="p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <MessageSquareQuote className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base chart-heading font-bold text-[var(--text-primary)]">
                    {t('itinerary.whyThisTrip')}
                  </h3>
                  <span className="text-[11px] font-bold bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] px-2 py-0.5 rounded-full border border-[var(--accent-secondary)]/20">
                    {t('itinerary.tailoredLogic')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-normal">
                  {t('itinerary.youToldUsYou')}
                </p>
              </div>
            </div>

            {/* Customize Trip Action Banner */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 text-[var(--accent-secondary)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {t('itinerary.wantToAdjustDays')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(true)}
                className="px-4 py-1.5 rounded-full bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)] text-xs font-bold text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs"
              >
                {t('itinerary.customizeTrip')}
              </button>
            </div>

            {/* Vertical Timeline Day-by-Day */}
            <div className="space-y-8">
              {itineraryDays.map((day) => (
                <div key={day.dayNumber} className="space-y-3">
                  <ItineraryDayCard
                    day={day}
                    onOpenActivityDetails={(data) => setSelectedActivityForDetails(data)}
                    onOpenAlternatives={(activityTitle, currentId) => {
                      setCurrentAlternativeActivity(activityTitle);
                      setActiveAlternativeId(currentId);
                      setAlternativesModalOpen(true);
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Bottom Trip Actions Box */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs text-center flex flex-col items-center">
              {!isApproved ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] flex items-center justify-center mb-3.5">
                    <Compass className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)]">
                    {t('itinerary.bottom.readyTitle', 'Ready to lock in your Dahab journey?')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-md">
                    {t('itinerary.bottom.readyDesc', 'Review and approve this personalized blueprint. You will review accommodation and transfer booking details in the next step.')}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full sm:w-auto">
                    <button
                      type="button"
                      id="bottom-keep-editing-btn"
                      onClick={() => setIsCustomizeOpen(true)}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-full text-xs sm:text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                    >
                      {t('itinerary.btn.keepEditing', 'Keep Editing')}
                    </button>

                    <button
                      type="button"
                      id="bottom-approve-trip-btn"
                      onClick={handleApproveTrip}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold text-[var(--surface-card)] bg-[var(--accent-secondary)] hover:bg-amber-300 active:scale-[0.98] transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer aurora-warm-glow"
                    >
                      <span>{t('itinerary.btn.approveTrip', 'Approve Trip')}</span>
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3.5 border border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl sm:text-2xl chart-heading font-bold text-emerald-200">
                    {t('itinerary.status.approved', 'Trip approved')}
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-300/80 mt-1 max-w-md">
                    {t('itinerary.status.readyDesc', "Your itinerary is ready. Let's take care of the bookings.")}
                  </p>

                  <button
                    type="button"
                    id="bottom-continue-to-booking-btn"
                    onClick={onContinueToBooking}
                    className="mt-6 inline-flex items-center justify-center gap-2.5 px-9 py-4 rounded-full text-sm font-bold text-[var(--surface-card)] bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer"
                  >
                    <span>{t('itinerary.btn.continueBooking', 'Continue to Booking')}</span>
                    <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Sticky Sidebar (Desktop 4 Columns) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-24 space-y-6">
            {/* Trip Overview Panel */}
            <div className="p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-5">
                <span className="text-xs font-bold text-[var(--accent-secondary)]">
                  {t('itinerary.sidebar.blueprintTitle', 'Trip Blueprint')}
                </span>
                <span className="text-[12px] font-semibold text-[var(--text-secondary)]/70">
                  {isApproved ? t('itinerary.status.approved', 'Approved') : t('itinerary.status.suggested', 'Suggested')}
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-[var(--text-secondary)]/60">{t('itinerary.sidebar.destination', 'Destination')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{t('itinerary.sidebar.destinationVal', 'Dahab, South Sinai')}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-[var(--text-secondary)]/60">{t('itinerary.sidebar.duration', 'Duration')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{durationLabel || t('itinerary.sidebar.5days', '5 Days')}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-[var(--text-secondary)]/60">{t('itinerary.sidebar.travelers', 'Travelers')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{travelersSummary}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-[var(--text-secondary)]/60">{t('itinerary.sidebar.budget', 'Budget')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{budgetLabel}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                  <span className="text-[var(--text-secondary)]/60">{t('itinerary.sidebar.pace', 'Pace')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{paceLabel}</span>
                </div>
                <div className="flex items-start justify-between py-2">
                  <span className="text-[var(--text-secondary)]/60">{t('itinerary.sidebar.interests', 'Selected Interests')}</span>
                  <span className="font-bold text-[var(--text-primary)] text-end">{interestLabels.join(t('itinerary._item_')) || '—'}</span>
                </div>
              </div>

              {/* Primary Side Action */}
              <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
                {!isApproved ? (
                  <button
                    type="button"
                    onClick={handleApproveTrip}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-xs font-bold text-[var(--surface-card)] bg-[var(--accent-secondary)] hover:bg-amber-300 shadow-xs hover:shadow transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                  >
                    <span>{t('itinerary.btn.approveTrip', 'Approve Trip')}</span>
                    <Check className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onContinueToBooking}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-xs font-bold text-[var(--surface-card)] bg-emerald-500 hover:bg-emerald-400 shadow-xs hover:shadow transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                  >
                    <span>{t('itinerary.btn.continueBooking', 'Continue to Booking')}</span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCustomizeOpen(true)}
                  className="w-full mt-2 py-2.5 text-center text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] rounded-full transition-colors cursor-pointer border border-[var(--border-subtle)]"
                >
                  {t('itinerary.btn.customize', 'Customize Trip')}
                </button>
              </div>
            </div>

            {/* Dahab Local Support Note */}
            <div className="p-5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2 font-bold text-[var(--text-primary)] mb-1">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-secondary)]" />
                <span>{t('itinerary.sidebar.guaranteeTitle', 'Sinai Local Host Guarantee')}</span>
              </div>
              <p className="leading-relaxed font-normal text-[12px] text-[var(--text-secondary)]/80">
                {t('itinerary.sidebar.guaranteeDesc', 'All diving centers, desert drivers, and boat captains are vetted local Dahab professionals who prioritize safety and authentic hospitality.')}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* 5. Mobile Sticky Bottom Action Bar */}
      <div 
        id="mobile-sticky-action-bar"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] p-3 sm:p-4 shadow-lg flex items-center justify-between gap-3"
      >
        {!isApproved ? (
          <>
            <button
              type="button"
              id="mobile-keep-editing-btn"
              onClick={() => setIsCustomizeOpen(true)}
              className="flex-1 py-3 rounded-full text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] transition-colors cursor-pointer text-center"
            >
              {t('itinerary.btn.keepEditing', 'Keep Editing')}
            </button>

            <button
              type="button"
              id="mobile-approve-trip-btn"
              onClick={handleApproveTrip}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-full text-xs font-bold text-[var(--surface-card)] bg-[var(--accent-secondary)] hover:bg-amber-300 shadow-xs cursor-pointer text-center"
            >
              <span>{t('itinerary.btn.approveTrip', 'Approve Trip')}</span>
              <Check className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            id="mobile-continue-booking-btn"
            onClick={onContinueToBooking}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-xs font-bold text-[var(--surface-card)] bg-emerald-500 hover:bg-emerald-400 shadow-md cursor-pointer text-center"
          >
            <span>{t('itinerary.btn.continueBooking', 'Continue to Booking')}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* 6. Modals */}
      <TripBriefModal
        isOpen={isTripBriefModalOpen}
        onClose={() => setIsTripBriefModalOpen(false)}
      />

      <TripHealthModal
        isOpen={isTripHealthModalOpen}
        onClose={() => setIsTripHealthModalOpen(false)}
      />

      <BudgetBreakdownModal
        isOpen={isBudgetBreakdownModalOpen}
        onClose={() => setIsBudgetBreakdownModalOpen(false)}
      />

      <TripCustomizeModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        onApply={() => setIsCustomizeOpen(false)}
      />

      <ActivityDetailModal
        activity={selectedActivityForDetails}
        onClose={() => setSelectedActivityForDetails(null)}
      />

      <AlternativesModal
        isOpen={alternativesModalOpen}
        activityTitle={currentAlternativeActivity}
        currentAlternativeId={activeAlternativeId}
        onSelectAlternative={handleSelectAlternative}
        onClose={() => setAlternativesModalOpen(false)}
      />

      {/* 7. Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-6 text-center text-xs text-[var(--text-secondary)]/40 bg-[var(--surface-card)] mt-12">
        {t('itinerary.dahabTravelPlatformPersonalized')}
      </footer>
    </div>
  );
};
