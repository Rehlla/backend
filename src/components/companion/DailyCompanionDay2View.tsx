import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { CategoryIcon, type CategoryKind } from '../common/CategoryIcon';
import { 
  Wind, 
  Waves, 
  Eye, 
  Sun, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Calendar, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Compass, 
  HelpCircle, 
  Utensils, 
  Coffee, 
  Footprints, 
  ChevronRight, 
  ShieldCheck, 
  X, 
  Info,
  SlidersHorizontal,
  Flame,
  Plus,
  RefreshCw,
  AlertTriangle,
  Sailboat,
  Zap
} from 'lucide-react';
import { TravelerNav } from '../mytrip/TravelerNav';
import { BookNowCommerceModal } from '../commerce/BookNowCommerceModal';

interface DailyCompanionDay2ViewProps {
  onBackToMyTrip: () => void;
  onNavigateToChangeRecovery?: () => void;
  onNavigateToWhatShouldIDoNow?: () => void;
  onNavigateToFoodNow?: () => void;
  onNavigateToFirstTwoHours?: () => void;
  onNavigateToEarlyArrival?: () => void;
  onExploreClick?: () => void;
  onOpenHelp?: () => void;
}

interface TimelineActivityItem {
  id: string;
  time: string;
  title: string;
  subtitle?: string;
  status: 'Confirmed' | 'Suggested' | 'Open' | 'Added';
  icon: CategoryKind;
  category: 'activity' | 'food' | 'free' | 'chill';
  details?: string;
}

interface SmartSuggestion {
  id: string;
  tag: 'Chill' | 'Explore' | 'Adventure';
  title: string;
  desc: string;
  duration: string;
  priceRange: string;
  distance: string;
  icon: CategoryKind;
  timeSlot: string;
  weatherSafe: boolean;
}

export const DailyCompanionDay2View: React.FC<DailyCompanionDay2ViewProps> = ({
  onBackToMyTrip,
  onNavigateToChangeRecovery,
  onNavigateToWhatShouldIDoNow,
  onNavigateToFoodNow,
  onNavigateToFirstTwoHours,
  onNavigateToEarlyArrival,
  onExploreClick,
  onOpenHelp,
}) => {
  const { navigateTo } = useTrip();
  const [activeTab, setActiveTab] = useState<'home' | 'mytrip' | 'explore' | 'bookings' | 'profile'>('mytrip');

  // Weather condition mode: 'calm' (ideal) vs 'rough' (weather adaptation simulation)
  const [seaCondition, setSeaCondition] = useState<'calm' | 'rough'>('calm');

  // Timeline activities on Day 2
  const [timeline, setTimeline] = useState<TimelineActivityItem[]>([
    {
      id: 'day2-diving',
      time: '09:00 AM',
      title: 'Diving Experience',
      subtitle: 'Canyon & Lighthouse Reefs · Certified Dive Master briefing',
      status: 'Confirmed',
      icon: 'dive',
      category: 'activity',
      details: 'Meeting at Dahab Divers Hub. Full equipment check at 08:45 AM. Transport to Canyon included.',
    },
    {
      id: 'day2-lunch',
      time: '01:00 PM',
      title: 'Lunch by the Bay',
      subtitle: 'Fresh catch & Bedouin salads · Ali Baba or Shams',
      status: 'Suggested',
      icon: 'food',
      category: 'food',
      details: 'Casual seaside terrace dining overlooking the bay. No reservation needed.',
    },
    {
      id: 'day2-afternoon',
      time: '03:00 PM',
      title: 'Free Time',
      subtitle: 'Open afternoon window (~2 hours available)',
      status: 'Open',
      icon: 'sparkles',
      category: 'free',
      details: 'Choose from personalized suggestions below to match your afternoon mood.',
    },
    {
      id: 'day2-dinner',
      time: 'Evening',
      title: 'Dinner Under the Stars',
      subtitle: 'Relaxed waterfront dinner along Lighthouse promenade',
      status: 'Suggested',
      icon: 'evening',
      category: 'food',
      details: 'Fresh seafood, mezze plates, and sea-breeze seating.',
    },
  ]);

  // Added activity tracker
  const [addedActivityId, setAddedActivityId] = useState<string | null>(null);

  // Modals & Drawers
  const [isBookNowOpen, setIsBookNowOpen] = useState(false);
  const [isDivingDetailOpen, setIsDivingDetailOpen] = useState(false);
  const [isWhatShouldIDoOpen, setIsWhatShouldIDoOpen] = useState(false);
  const [isFoodNowOpen, setIsFoodNowOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<SmartSuggestion | null>(null);
  const [selectedActivityDetail, setSelectedActivityDetail] = useState<TimelineActivityItem | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Base suggestions (when calm) vs adapted suggestions (when rough)
  const defaultSuggestions: SmartSuggestion[] = [
    {
      id: 'sugg-chill',
      tag: 'Chill',
      title: 'Lighthouse + Coffee',
      desc: 'Relax and take it easy with Bedouin tea or espresso overlooking the reef.',
      duration: '45 min',
      priceRange: '50–120 EGP ($1–$3)',
      distance: '150m',
      icon: 'coffee',
      timeSlot: '03:00 PM',
      weatherSafe: true,
    },
    {
      id: 'sugg-explore',
      tag: 'Explore',
      title: 'Walk + Local Spot',
      desc: 'Discover hidden artisan stalls and quiet alleyways along the coastal promenade.',
      duration: '1 hr',
      priceRange: 'Free',
      distance: '200m',
      icon: 'walk',
      timeSlot: '03:00 PM',
      weatherSafe: true,
    },
    {
      id: 'sugg-adventure',
      tag: 'Adventure',
      title: 'Snorkeling at Lighthouse Reef',
      desc: 'Add a little more activity with vibrant coral wall snorkeling right off the shore.',
      duration: '1.5 hr',
      priceRange: '150–250 EGP ($3–$5)',
      distance: '300m',
      icon: 'dive',
      timeSlot: '03:00 PM',
      weatherSafe: false, // will swap if sea condition turns rough
    },
  ];

  const roughWeatherSuggestions: SmartSuggestion[] = [
    {
      id: 'sugg-chill',
      tag: 'Chill',
      title: 'Lighthouse + Coffee',
      desc: 'Relax and take it easy with Bedouin tea or espresso overlooking the reef.',
      duration: '45 min',
      priceRange: '50–120 EGP ($1–$3)',
      distance: '150m',
      icon: 'coffee',
      timeSlot: '03:00 PM',
      weatherSafe: true,
    },
    {
      id: 'sugg-explore',
      tag: 'Explore',
      title: 'Walk + Local Spot',
      desc: 'Discover hidden artisan stalls and quiet alleyways along the coastal promenade.',
      duration: '1 hr',
      priceRange: 'Free',
      distance: '200m',
      icon: 'walk',
      timeSlot: '03:00 PM',
      weatherSafe: true,
    },
    {
      id: 'sugg-land-explore',
      tag: 'Adventure',
      title: 'Bedouin Herbal Tea & Old Town Stroll',
      desc: 'Scenic land-based exploration of Dahab old bazaar with local spice and tea tasting.',
      duration: '1 hr 15 min',
      priceRange: '80–150 EGP ($2–$3)',
      distance: '400m',
      icon: 'nature',
      timeSlot: '03:00 PM',
      weatherSafe: true,
    },
  ];

  const currentSuggestions = seaCondition === 'calm' ? defaultSuggestions : roughWeatherSuggestions;

  const handleAddActivity = (suggestion: SmartSuggestion) => {
    // Check for conflict simulation (e.g. if user tries to add at 09:00 AM)
    if (suggestion.timeSlot === '09:00 AM') {
      setIsConflictModalOpen(suggestion);
      return;
    }

    // Add to 03:00 PM timeline slot
    setTimeline(prev => prev.map(item => {
      if (item.time === '03:00 PM') {
        return {
          id: `added-${suggestion.id}`,
          time: '03:00 PM',
          title: suggestion.title,
          subtitle: `${suggestion.tag} · ${suggestion.duration} · ${suggestion.distance}`,
          status: 'Added',
          icon: suggestion.icon,
          category: 'chill',
          details: suggestion.desc,
        };
      }
      return item;
    }));

    setAddedActivityId(suggestion.id);
    showToast(`Added to your trip ✓ (${suggestion.title})`);
  };

  const handleResetTimeline = () => {
    setTimeline([
      {
        id: 'day2-diving',
        time: '09:00 AM',
        title: 'Diving Experience',
        subtitle: 'Canyon & Lighthouse Reefs · Certified Dive Master briefing',
        status: 'Confirmed',
        icon: 'dive',
        category: 'activity',
        details: 'Meeting at Dahab Divers Hub. Full equipment check at 08:45 AM. Transport to Canyon included.',
      },
      {
        id: 'day2-lunch',
        time: '01:00 PM',
        title: 'Lunch by the Bay',
        subtitle: 'Fresh catch & Bedouin salads · Ali Baba or Shams',
        status: 'Suggested',
        icon: 'food',
        category: 'food',
        details: 'Casual seaside terrace dining overlooking the bay. No reservation needed.',
      },
      {
        id: 'day2-afternoon',
        time: '03:00 PM',
        title: 'Free Time',
        subtitle: 'Open afternoon window (~2 hours available)',
        status: 'Open',
        icon: 'sparkles',
        category: 'free',
        details: 'Choose from personalized suggestions below to match your afternoon mood.',
      },
      {
        id: 'day2-dinner',
        time: 'Evening',
        title: 'Dinner Under the Stars',
        subtitle: 'Relaxed waterfront dinner along Lighthouse promenade',
        status: 'Suggested',
        icon: 'evening',
        category: 'food',
        details: 'Fresh seafood, mezze plates, and sea-breeze seating.',
      },
    ]);
    setAddedActivityId(null);
    showToast('Afternoon reset to Free Time');
  };

  const handleNavigate = (tab: 'home' | 'mytrip' | 'explore' | 'bookings' | 'profile') => {
    setActiveTab(tab);
    if (tab === 'home' || tab === 'mytrip') {
      onBackToMyTrip();
    } else if (tab === 'explore' && onExploreClick) {
      onExploreClick();
    } else if (tab === 'bookings') {
      onBackToMyTrip();
    } else if (tab === 'profile') {
      showToast('Logged in as Ahmed (ahmed.traveler@example.com)');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-container)] text-[var(--text-primary)] flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/20">
      
      {/* 1. TRAVELER TOP NAVIGATION (My Trip is active) */}
      <TravelerNav
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onOpenHelp={onOpenHelp}
      />

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow">
        
        {/* Top Breadcrumbs & Contextual Switcher */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="back-to-mytrip-overview-btn"
              onClick={onBackToMyTrip}
              className="inline-flex items-center gap-1.5 py-3.5 -my-2 text-xs font-semibold text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Full 5-Day Itinerary</span>
            </button>
            <span className="text-[var(--text-primary)]/20">•</span>
            {onNavigateToFirstTwoHours && (
              <button
                type="button"
                onClick={onNavigateToFirstTwoHours}
                className="text-xs font-medium text-[var(--text-secondary)]/50 hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
              >
                Day 1 (Arrival)
              </button>
            )}
          </div>

          {/* Weather Simulation Switcher for Prototyping Evaluation */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Companion Active</span>
            </div>

            <div className="inline-flex items-center gap-1 bg-[var(--surface-card)] border border-[var(--border-subtle)] p-0.5 rounded-full text-[12px] font-semibold text-[var(--text-secondary)]/70">
              <button
                type="button"
                onClick={() => {
                  setSeaCondition('calm');
                  showToast('Sea conditions: Calm (Ideal for diving & snorkeling)');
                }}
                className={`px-2.5 py-0.5 rounded-full transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${seaCondition === 'calm' ? 'bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-bold' : 'hover:text-[var(--text-primary)]'}`}
              >
                Calm Sea
              </button>
              <button
                type="button"
                onClick={() => {
                  setSeaCondition('rough');
                  showToast('Simulated rough sea: Adaptive suggestions applied');
                }}
                className={`px-2.5 py-0.5 rounded-full transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${seaCondition === 'rough' ? 'bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-bold' : 'hover:text-[var(--text-primary)]'}`}
              >
                Rough Sea (Adaptive)
              </button>
            </div>
          </div>
        </div>

        {/* 2. MAIN HEADER */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>Daily Trip Companion</span>
            </div>

            {/* Day Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>Day 2 of 5</span>
              <span className="text-[var(--text-primary)]/20">•</span>
              <span className="text-[var(--accent-secondary)] font-extrabold">Active Today</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] tracking-tight">
              Good morning, Ahmed
            </h1>
            <div className="flex items-center gap-2 text-xl sm:text-2xl font-semibold text-[var(--accent-primary)]">
              <span>Dahab Today</span>
            </div>
            <p className="text-base sm:text-lg text-[var(--text-secondary)]/80 max-w-2xl font-medium">
              Here's what your day looks like, based on your trip and today's conditions.
            </p>
          </div>
        </div>

        {/* 3. RESPONSIVE DASHBOARD LAYOUT (Main 7/12 vs Secondary 5/12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ============================================================ */}
          {/* MAIN COLUMN (7/12 on Desktop) */}
          {/* ============================================================ */}
          <div className="lg:col-span-7 space-y-6">

            {/* Contextual Trip Disruption & Recovery Alert Banner */}
            {onNavigateToChangeRecovery && (
              <div 
                id="companion-disruption-alert"
                onClick={onNavigateToChangeRecovery}
                className="bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer shadow-md space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-amber-300">
                          Schedule Update
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-extrabold border border-amber-500/30">
                          Action Ready
                        </span>
                      </div>
                      <h3 className=" font-bold text-lg text-[var(--text-primary)]">
                        Your boat trip has changed
                      </h3>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 leading-relaxed font-medium">
                        Sea conditions have changed, so your original boat trip can’t operate as planned. We’ve already found alternatives that fit your trip.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--accent-primary)]">
                    "Something changed. We fixed your day."
                  </span>
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-[var(--surface-container)] bg-[var(--accent-secondary)] px-3 py-1 rounded-full shadow-xs">
                    <span>View 3 Alternatives</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            )}

            {/* A. LIVE CONDITIONS & INTERPRETATION */}
            <section 
              id="live-conditions-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                    Real-Time Environment
                  </span>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    Live Conditions
                  </h2>
                </div>

                <span className="text-[12px] font-medium text-[var(--text-secondary)]/60 bg-[var(--surface-container)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
                  Conditions updated recently
                </span>
              </div>

              {/* 4 Conditions Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-1">
                  <Wind className="w-4 h-4 text-[var(--accent-primary)] mx-auto" />
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">Wind</span>
                  <span className="font-bold text-sm text-[var(--text-primary)]">18 knots</span>
                </div>

                <div className={`p-3 rounded-2xl border space-y-1 transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                  seaCondition === 'calm' ? 'bg-[var(--surface-container)] border-white/5' : 'bg-[var(--surface-container)] border-amber-500/40'
                }`}>
                  <Waves className={`w-4 h-4 mx-auto ${seaCondition === 'calm' ? 'text-[var(--accent-primary)]' : 'text-amber-400'}`} />
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">Sea</span>
                  <span className={`font-bold text-sm ${seaCondition === 'calm' ? 'text-[var(--text-primary)]' : 'text-amber-300'}`}>
                    {seaCondition === 'calm' ? 'Calm' : 'Choppy / Rough'}
                  </span>
                </div>

                {/* Removed: a "Visibility · Great (25m+)" tile. Nothing
                    measures underwater visibility, and this is a panel a diver
                    reads on the morning of a dive. */}

                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-1">
                  <Sun className="w-4 h-4 text-[var(--accent-secondary)] mx-auto" />
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">Temperature</span>
                  <span className="font-bold text-sm text-[var(--text-primary)]">Warm (28°C)</span>
                </div>
              </div>

              {/* Conditions Interpretation (Translates raw weather into travel insights) */}
              <div className={`p-4 rounded-2xl border space-y-3 transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                seaCondition === 'calm'
                  ? 'bg-[var(--surface-container)] border-[var(--accent-primary)]/30 text-[var(--text-primary)]'
                  : 'bg-[var(--surface-container)] border-amber-500/40 text-[var(--text-primary)]'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CategoryIcon kind="dive" className="w-4 h-4" />
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">
                      {seaCondition === 'calm' ? 'Good day for diving.' : 'Moderate conditions for sheltered dive sites.'}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed pl-6">
                    {seaCondition === 'calm' 
                      ? 'Sea conditions look comfortable and visibility is expected to be good throughout the morning.'
                      : 'Sea conditions have turned choppy outside the bay. The protected Canyon reef remains diveable, but open-water shore snorkeling is less comfortable.'}
                  </p>
                </div>

                {/* Additional activity readiness */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-card)] border border-white/5">
                    <span className="font-semibold text-[var(--text-secondary)]/80 flex items-center gap-1.5"><Wind className="w-3.5 h-3.5" /> Kitesurfing</span>
                    <span className="font-bold text-[var(--accent-primary)]">Good after 12 PM</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-card)] border border-white/5">
                    <span className="font-semibold text-[var(--text-secondary)]/80 flex items-center gap-1.5"><Sailboat className="w-3.5 h-3.5" /> Boat trips</span>
                    <span className="font-bold text-[var(--text-secondary)]/60">Limited</span>
                  </div>
                </div>
              </div>

              {/* Weather Change Warning Banner if Simulated */}
              {seaCondition === 'rough' && (
                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-bold block">Sea conditions changed</span>
                    <p className="text-[var(--text-secondary)]/80 leading-relaxed">
                      We adjusted your afternoon suggestions to comfortable land-based explorations so you don't fight the waves.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* B. TODAY'S HIGHLIGHT ("Best today") */}
            <section 
              id="todays-highlight-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border-2 border-[var(--accent-secondary)]/60 shadow-lg space-y-4 relative overflow-hidden"
            >
              {/* Highlight Ribbon */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] text-xs font-bold border border-[var(--border-subtle)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  <span>Best today</span>
                </div>

                <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] px-3 py-1 rounded-full border border-[var(--accent-primary)]/30">
                  Confirmed ✓
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <CategoryIcon kind="dive" className="w-7 h-7 sm:w-8 sm:h-8" />
                    <div>
                      <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">
                        09:00 AM
                      </span>
                      <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                        Diving Experience
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 leading-relaxed font-medium">
                    Your diving experience is scheduled for this morning at Canyon and Lighthouse reefs.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigateToWhatShouldIDoNow && (
                    <button
                      type="button"
                      id="open-what-should-i-do-now-from-highlight-btn"
                      onClick={onNavigateToWhatShouldIDoNow}
                      className="px-4 py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-[var(--accent-secondary)] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border border-[var(--border-subtle)] shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                      <span>Finished early? What to do now →</span>
                    </button>
                  )}
                  <button
                    type="button"
                    id="view-diving-details-btn"
                    onClick={() => setIsDivingDetailOpen(true)}
                    className="px-4 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span>View details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </section>

            {/* C. YOUR DAY TIMELINE */}
            <section 
              id="your-day-timeline-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                    Today's Schedule
                  </span>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    Your Day
                  </h2>
                </div>

                {addedActivityId && (
                  <button
                    type="button"
                    onClick={handleResetTimeline}
                    className="text-xs font-medium text-[var(--text-secondary)]/60 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset afternoon</span>
                  </button>
                )}
              </div>

              {/* Timeline list */}
              <div className="space-y-3.5 relative ps-3 sm:ps-4 before:absolute before:start-7 sm:before:start-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--surface-card)]/10">
                {timeline.map((item) => {
                  const isConfirmed = item.status === 'Confirmed';
                  const isAdded = item.status === 'Added';
                  const isOpen = item.status === 'Open';

                  return (
                    <div
                      key={item.id}
                      id={`day2-timeline-item-${item.id}`}
                      className={`relative flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                        isConfirmed
                          ? 'bg-[var(--surface-container)] border-[var(--accent-primary)]/40 ring-1 ring-[var(--accent-primary)]/10'
                          : isAdded
                            ? 'bg-[var(--surface-container)] border-emerald-400/50'
                            : isOpen
                              ? 'bg-[var(--surface-card)] border-dashed border-white/20'
                              : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center flex-shrink-0 z-10 text-base sm:text-lg shadow-2xs border border-[var(--border-subtle)] ${
                        isConfirmed
                          ? 'bg-[var(--surface-card)] text-[var(--accent-primary)]'
                          : isAdded
                            ? 'bg-[var(--accent-primary)] text-[var(--surface-container)]'
                            : isOpen
                              ? 'bg-[var(--surface-container)] text-[var(--accent-secondary)]'
                              : 'bg-[var(--surface-container)] text-[var(--text-secondary)]'
                      }`}>
                        <CategoryIcon kind={item.icon} className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">
                            {item.time}
                          </span>

                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isConfirmed
                              ? 'bg-[var(--surface-card)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/40'
                              : isAdded
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isOpen
                                  ? 'bg-[var(--surface-container)] text-amber-300 border border-amber-500/30'
                                  : 'bg-[var(--surface-container)] text-[var(--text-secondary)]/60 border border-white/5'
                          }`}>
                            {item.status} {isConfirmed && '✓'}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-[var(--text-primary)]">
                          {item.title}
                        </h4>

                        {item.subtitle && (
                          <p className="text-xs text-[var(--text-secondary)]/70">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* D. SMART RECOMMENDATION ("We have some time for you") */}
            <section 
              id="smart-recommendations-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5"
            >
              <div className="space-y-1 border-b border-[var(--border-subtle)] pb-4">
                <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                  Afternoon Opportunity
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                  We have some time for you
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]/70 font-medium">
                  You have approximately 2 hours free this afternoon.
                </p>
              </div>

              {/* 3 Choices Only */}
              <div className="grid grid-cols-1 gap-3.5">
                {currentSuggestions.map((sugg) => {
                  const isAlreadyAdded = addedActivityId === sugg.id;

                  return (
                    <div
                      key={sugg.id}
                      id={`smart-suggestion-card-${sugg.id}`}
                      className={`p-4 sm:p-5 rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-3 ${
                        isAlreadyAdded
                          ? 'bg-[var(--surface-container)] border-emerald-400/50'
                          : 'bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            sugg.tag === 'Chill'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : sugg.tag === 'Explore'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {sugg.tag}
                          </span>
                          <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">
                            {sugg.duration}
                          </span>
                          <span className="text-[var(--text-primary)]/20 text-xs">•</span>
                          <span className="text-xs text-[var(--text-secondary)]/60 font-medium">
                            {sugg.distance} away
                          </span>
                        </div>

                        <span className="text-xs font-semibold text-[var(--text-secondary)]/80">
                          {sugg.priceRange}
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <CategoryIcon kind={sugg.icon} className="w-6 h-6" />
                        <div className="space-y-0.5 flex-1">
                          <h4 className=" font-bold text-base text-[var(--text-primary)]">
                            {sugg.title}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                            {sugg.desc}
                          </p>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-[12px] text-[var(--text-secondary)]/50">
                          Fits slot: 03:00 PM – 05:00 PM
                        </span>

                        <button
                          type="button"
                          id={`add-to-trip-btn-${sugg.id}`}
                          onClick={() => handleAddActivity(sugg)}
                          disabled={isAlreadyAdded}
                          className={`px-4 py-2 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer ${
                            isAlreadyAdded
                              ? 'bg-[var(--surface-card)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 cursor-default'
                              : 'bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] shadow-xs'
                          }`}
                        >
                          {isAlreadyAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                              <span>Added to your trip ✓</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 text-[var(--surface-container)]" />
                              <span>Add to My Trip</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* WHY THESE? Contextual Intelligence Explanation */}
              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-[var(--accent-primary)] font-bold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Why these?</span>
                </div>
                <p className="text-[var(--text-secondary)]/80 leading-relaxed">
                  They're close to your current area, fit your budget, and leave enough time before your evening plans.
                </p>
              </div>
            </section>

          </div>

          {/* ============================================================ */}
          {/* SECONDARY COLUMN (5/12 on Desktop) */}
          {/* ============================================================ */}
          <div className="lg:col-span-5 space-y-6">

            {/* 1. TRIP PROGRESS */}
            <div 
              id="trip-progress-widget"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <h3 className=" font-bold text-base text-[var(--text-primary)]">
                    Trip Progress
                  </h3>
                </div>
                <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
                  Day 2 of 5
                </span>
              </div>

              {/* 5-Day Visual Progression (Trip Journey) */}
              <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                {/* Day 1 */}
                <div className="p-2 rounded-xl bg-[var(--surface-container)] border border-[var(--accent-primary)]/40 space-y-0.5">
                  <span className="text-[11px] font-bold text-[var(--accent-primary)]">Day 1</span>
                  <div className="w-5 h-5 mx-auto rounded-full bg-[var(--accent-primary)] text-[var(--surface-container)] flex items-center justify-center text-[11px] font-bold">
                    ✓
                  </div>
                  <span className="text-[11px] text-[var(--accent-primary)] font-medium block truncate">Arrival</span>
                </div>

                {/* Day 2 (Active Today) */}
                <div className="p-2 rounded-xl bg-[var(--accent-secondary)] text-[var(--surface-container)] space-y-0.5 shadow-md">
                  <span className="text-[11px] font-bold text-[var(--surface-container)]">Day 2</span>
                  <div className="w-5 h-5 mx-auto rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center text-[11px] font-black">
                    ●
                  </div>
                  <span className="text-[11px] text-[var(--surface-container)] font-bold block truncate">Diving</span>
                </div>

                {/* Day 3 */}
                <div className="p-2 rounded-xl bg-[var(--surface-container)] border border-white/5 space-y-0.5 text-[var(--text-secondary)]/50">
                  <span className="text-[11px] font-bold">Day 3</span>
                  <div className="w-5 h-5 mx-auto rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)]/60 flex items-center justify-center text-[11px]">
                    3
                  </div>
                  <span className="text-[11px] block truncate">Desert</span>
                </div>

                {/* Day 4 */}
                <div className="p-2 rounded-xl bg-[var(--surface-container)] border border-white/5 space-y-0.5 text-[var(--text-secondary)]/50">
                  <span className="text-[11px] font-bold">Day 4</span>
                  <div className="w-5 h-5 mx-auto rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)]/60 flex items-center justify-center text-[11px]">
                    4
                  </div>
                  <span className="text-[11px] block truncate">Lagoon</span>
                </div>

                {/* Day 5 */}
                <div className="p-2 rounded-xl bg-[var(--surface-container)] border border-white/5 space-y-0.5 text-[var(--text-secondary)]/50">
                  <span className="text-[11px] font-bold">Day 5</span>
                  <div className="w-5 h-5 mx-auto rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)]/60 flex items-center justify-center text-[11px]">
                    5
                  </div>
                  <span className="text-[11px] block truncate">Farewell</span>
                </div>
              </div>
            </div>

            {/* 2. TODAY'S BOOKINGS (Compact & Relevant Only to Today) */}
            <div 
              id="todays-bookings-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                  Today's Bookings
                </span>
                <span className="text-xs font-mono font-bold text-[var(--text-secondary)]/60">
                  1 Activity
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-card)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                    <CategoryIcon kind="dive" className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">
                      Diving Experience
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)]/60">
                      09:00 AM · Dahab Divers Hub
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2.5 py-0.5 rounded-full border border-[var(--accent-primary)]/30">
                  Confirmed ✓
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsDivingDetailOpen(true)}
                className="w-full py-2 px-3 rounded-full text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-card)]/5 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>View Voucher & Meeting Spot</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. PRIMARY ACTION: "What Should I Do Now?" */}
            <div 
              id="what-should-i-do-now-card"
              className="bg-gradient-to-br from-[var(--surface-container)] to-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl p-6 shadow-md space-y-4 border border-[var(--accent-primary)]/30"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] text-[11px] font-extrabold border border-[var(--border-subtle)]">
                  <Sparkles className="w-3 h-3 text-[var(--accent-secondary)]" />
                  <span>Spontaneous Mode</span>
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  What Should I Do Now?
                </h3>
                <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                  We'll suggest something based on where you are, the time, your mood, and the rest of your trip.
                </p>
              </div>

              <button
                type="button"
                id="what-should-i-do-now-btn"
                onClick={() => {
                  if (onNavigateToWhatShouldIDoNow) {
                    onNavigateToWhatShouldIDoNow();
                  } else {
                    setIsWhatShouldIDoOpen(true);
                  }
                }}
                className="w-full py-3 px-4 rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] font-bold text-xs shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Compass className="w-4 h-4 text-[var(--surface-container)]" />
                <span>What Should I Do Now?</span>
              </button>
            </div>

            {/* 3.5 LOCAL COMMERCE LAYER: "Book Now / احجز دلوقتي" */}
            <div
              id="book-now-commerce-shortcut-card"
              className="bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl p-6 shadow-md space-y-3.5 border border-[var(--accent-primary)]/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--accent-secondary)] text-[var(--surface-container)] flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className=" font-bold text-base text-[var(--text-primary)]">
                      Book Now · احجز دلوقتي
                    </h3>
                    <p className="text-[12px] text-[var(--accent-primary)] font-bold">
                      In-Destination Instant Fulfillment
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30">
                  Ready
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                Need gear, desert transport, sunset yoga, or authentic Bedouin dining right now? Instant confirmation backed by verified Dahab locals.
              </p>

              <button
                type="button"
                id="book-now-companion-btn"
                onClick={() => navigateTo('/quick-book')}
                className="w-full py-3 px-4 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 border border-[var(--accent-secondary)]/50 text-[var(--accent-secondary)] font-extrabold text-xs shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Browse &amp; Book Right Now</span>
                <ArrowRight className="w-4 h-4 text-[var(--accent-secondary)]" />
              </button>
            </div>

            {/* 4. FOOD SHORTCUT ("Hungry?") */}
            <div 
              id="food-now-shortcut-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span className="font-bold text-sm text-[var(--text-primary)]">Hungry?</span>
                </div>
                <span className="text-[11px] font-extrabold text-[var(--accent-primary)] bg-[var(--surface-container)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
                  Food Now
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed">
                Find something good nearby right now based on Dahab's authentic coastal kitchens.
              </p>

              <button
                type="button"
                id="find-food-btn"
                onClick={() => {
                  if (onNavigateToFoodNow) {
                    onNavigateToFoodNow();
                  } else {
                    setIsFoodNowOpen(true);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-xs font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Find food</span>
              </button>
            </div>

            {/* 5. HELP SHORTCUT ("Need help?") */}
            <div 
              id="help-shortcut-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-3"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-sm text-[var(--text-primary)]">Need help?</span>
              </div>

              <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed">
                Get immediate 24/7 concierge assistance for bookings, transport changes, hotel queries, or local advice.
              </p>

              <button
                type="button"
                id="help-me-now-btn"
                onClick={onOpenHelp}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--surface-container)] hover:bg-rose-950/40 text-xs font-bold text-rose-300 border border-rose-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Help Me Now</span>
              </button>
            </div>

          </div>

        </div>

      </main>

      {/* ============================================================ */}
      {/* MODALS & DRAWERS */}
      {/* ============================================================ */}

      {/* 1. DIVING DETAILS MODAL */}
      {isDivingDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                  <CategoryIcon kind="dive" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Diving Experience Details
                  </h3>
                  <span className="text-xs font-mono text-[var(--accent-secondary)] font-bold">09:00 AM · Today</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDivingDetailOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--surface-card)]/5 hover:bg-[var(--surface-card)]/10 flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[var(--text-secondary)]/80">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1.5">
                <span className="text-[11px] font-bold text-[var(--accent-primary)]">Dive Center & Meeting</span>
                <p className="font-bold text-sm text-[var(--text-primary)]">Dahab Divers Hub (Lighthouse Shore)</p>
                <p className="text-[var(--text-secondary)]/70">Equipment fitting starts at 08:45 AM. Briefing at 09:00 AM.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-[var(--surface-container)] border border-white/5">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">Guide</span>
                  <span className="font-bold text-[var(--text-primary)]">Tarek (PADI Master)</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-container)] border border-white/5">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">Equipment</span>
                  <span className="font-bold text-[var(--accent-primary)]">All Included (Tanks & BCD)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-container)] text-emerald-300 border border-emerald-500/30 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Certified reservation confirmed with local provider voucher.</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsDivingDetailOpen(false)}
                className="w-full py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-xs font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. "WHAT SHOULD I DO NOW?" ENTRY POINT PREVIEW MODAL */}
      {isWhatShouldIDoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-[var(--accent-secondary)]" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  What Should I Do Now?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatShouldIDoOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--surface-card)]/5 hover:bg-[var(--surface-card)]/10 flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-[var(--text-secondary)]/80 leading-relaxed">
              <p className="font-semibold text-[var(--text-primary)]">
                Got unexpected free time or finished your morning dive early?
              </p>
              <p>
                Our real-time companion instantly recalculates what makes sense right now—factoring your exact location in Lighthouse, remaining energy, budget, and afternoon commitments.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2 text-xs">
              <span className="text-[11px] font-bold text-[var(--accent-primary)]">Quick Instant Options</span>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsWhatShouldIDoOpen(false);
                    handleAddActivity(defaultSuggestions[0]);
                  }}
                  className="w-full text-start p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                >
                  <span className="font-bold inline-flex items-center gap-1.5"><CategoryIcon kind="coffee" className="w-4 h-4" /> Chill at Shams Bay</span>
                  <span className="text-[12px] text-[var(--accent-primary)] font-semibold">150m</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsWhatShouldIDoOpen(false);
                    if (onNavigateToFoodNow) {
                      onNavigateToFoodNow();
                    } else {
                      setIsFoodNowOpen(true);
                    }
                  }}
                  className="w-full text-start p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center justify-between cursor-pointer text-[var(--text-primary)]"
                >
                  <span className="font-bold inline-flex items-center gap-1.5"><CategoryIcon kind="food" className="w-4 h-4" /> Grab a coastal snack</span>
                  <span className="text-[12px] text-[var(--accent-primary)] font-semibold">5 min</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsWhatShouldIDoOpen(false)}
                className="w-full py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-xs font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. "FOOD NOW" SHORTCUT ENTRY MODAL */}
      {isFoodNowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[var(--accent-secondary)]" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Food Now · Nearby Dahab
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFoodNowOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--surface-card)]/5 hover:bg-[var(--surface-card)]/10 flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
              Here are 3 authentic coastal spots open right now near Lighthouse:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[var(--text-primary)]">Ali Baba Restaurant</span>
                  <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">Open Now</span>
                </div>
                <p className="text-[var(--text-secondary)]/70">Fresh red sea grilled fish, tahini & warm flatbreads right on the water.</p>
                <span className="text-[12px] font-semibold text-[var(--accent-secondary)]">120m away · 120–250 EGP</span>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[var(--text-primary)]">Shams Cafe & Juice Bar</span>
                  <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">Open Now</span>
                </div>
                <p className="text-[var(--text-secondary)]/70">Fresh squeezed mango & guava juice, shakshuka, and iced coffee.</p>
                <span className="text-[12px] font-semibold text-[var(--accent-secondary)]">180m away · 40–90 EGP</span>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[var(--text-primary)]">King Falafel</span>
                  <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">Open Now</span>
                </div>
                <p className="text-[var(--text-secondary)]/70">Crispy sesame falafel wraps, ful medames, and pickled eggplant.</p>
                <span className="text-[12px] font-semibold text-[var(--accent-secondary)]">300m away · 25–50 EGP</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsFoodNowOpen(false)}
                className="w-full py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-xs font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                Close Food Finder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ACTIVITY CONFLICT AWARENESS MODAL */}
      {isConflictModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2.5 text-amber-300 border-b border-[var(--border-subtle)] pb-3.5">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Schedule Conflict Detected
              </h3>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-amber-500/30 space-y-1 text-xs text-[var(--text-secondary)]/80">
              <p className="font-bold text-sm text-[var(--text-primary)]">
                This overlaps with your diving schedule.
              </p>
              <p>
                You already have a confirmed <strong className="text-[var(--text-primary)]">Diving Experience</strong> scheduled at 09:00 AM.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const target = isConflictModalOpen;
                  setIsConflictModalOpen(null);
                  handleAddActivity({ ...target, timeSlot: '03:00 PM' });
                }}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] text-xs font-bold transition-colors cursor-pointer"
              >
                Choose another time (03:00 PM Free Slot)
              </button>

              <button
                type="button"
                onClick={() => setIsConflictModalOpen(null)}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. LOCAL IN-DESTINATION COMMERCE MODAL (Book Now / احجز دلوقتي) */}
      <BookNowCommerceModal
        isOpen={isBookNowOpen}
        onClose={() => setIsBookNowOpen(false)}
      />

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-bold shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
