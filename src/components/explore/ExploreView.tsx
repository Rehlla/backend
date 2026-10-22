import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Compass, 
  MapPin, 
  Search, 
  Sparkles, 
  Heart, 
  Star, 
  Clock, 
  Plus, 
  Check, 
  ChevronRight, 
  ExternalLink, 
  Filter, 
  Navigation, 
  ArrowRight, 
  Eye, 
  Waves, 
  Sun, 
  Coffee, 
  Utensils, 
  Share2, 
  X, 
  Info, 
  Calendar, 
  Phone, 
  Flame, 
  ArrowLeft 
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { TravelerNav } from '../mytrip/TravelerNav';
import { ConciergePageHeader } from '../concierge/ConciergePageHeader';
import { CategoryIcon } from '../common/CategoryIcon';
import { ConditionsBadge, ConditionsVerdict } from '../common/ConditionsBadge';
import { EXPLORE_CATEGORIES } from '../../data/dahabContent';
import { NearMeItem } from '../../types';
import { sanitizeText } from '../../utils/sanitize';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { buildExploreItems } from '../../services/exploreMapper';
import { ExperienceCardSkeleton } from '../ui/skeleton';

export const NEAR_ME_DATA: NearMeItem[] = [
  {
    id: 'near-ralphs',
    name: "Ralph's German Bakery",
    nameAr: 'مخبز رالف الألماني',
    category: 'coffee',
    distance: '180m',
    walkMinutes: 2,
    priceLevel: '$$',
    tag: 'Artisan Bakery & Cafe',
    tagAr: 'مخبز يدوي وكافيه روقان',
    image: '/images/restaurants/breakfast-by-the-sea.jpg',
    description: 'Famous for freshly baked sourdough, apple strudel, pretzels, and fresh organic Sinai herbal teas.',
    descriptionAr: 'أشهر مخبز في دهب للعيش الساوردو الفريش، فطيرة التفاح (أبل شترودل)، البريتزل، وشاي الأعشاب السيناوية العضوية.',
    location: 'Lighthouse Area, Dahab',
    locationAr: 'منطقة اللايتهاوس، دهب',
    openHours: '07:00 AM – 10:00 PM',
    openHoursAr: '٠٧:٠٠ ص – ١٠:٠٠ م',
    bestFor: 'Breakfast & Afternoon Coffee',
    bestForAr: 'فطار الصبح وقهوة العصرية',
  },
  {
    id: 'near-ali-baba',
    name: 'Ali Baba Waterfront Restaurant',
    nameAr: 'مطعم علي بابا ع الممشى',
    category: 'food',
    distance: '320m',
    walkMinutes: 4,
    priceLevel: '$$',
    tag: 'Seafood & Bedouin Grill',
    tagAr: 'سي فود ومشاوي ع البحر',
    image: '/images/restaurants/ali-baba-restaurant.jpg',
    description: 'Pick your fresh Red Sea catch directly from the ice counter, grilled over charcoal right by the sea.',
    descriptionAr: 'اختار سمكتك الطازة من التلج مباشرة، وتتشوي ع الفحم وتجيلك على طاولة ممتدة ع البحر مع الشوربة والمقبلات.',
    location: 'Lighthouse Promenade',
    locationAr: 'ممشى اللايتهاوس السياحي',
    openHours: '12:00 PM – 12:00 AM',
    openHoursAr: '١٢:٠٠ ظ – ١٢:٠٠ منتصف الليل',
    bestFor: 'Seaside Catch of the Day',
    bestForAr: 'عشاء سمك طازة ومشاوي ع البحر',
  },
  {
    id: 'near-lighthouse-reef',
    name: 'Lighthouse Reef Shore Entry',
    nameAr: 'شاطئ ورصيف اللايتهاوس للغطس والسنوركلينج',
    category: 'beach',
    distance: '120m',
    walkMinutes: 1,
    priceLevel: '$',
    tag: 'Snorkeling & Coral Entry',
    tagAr: 'نزلة بحر وسنوركلينج شاطئي سهل',
    image: '/images/attractions/coral-gardens.jpg',
    description: 'One of the easiest shore dives and snorkeling spots with vibrant table corals, clownfish, and eagle rays.',
    descriptionAr: 'أسهل نزلة بحر شاطئية في دهب؛ مياه هادية، شعب مرجانية ملونة، سمك نيمو وشعاع الراي على بعد خطوات من الشاطئ.',
    location: 'Lighthouse Bay',
    locationAr: 'خليج اللايتهاوس',
    openHours: 'Open 24/7 (Best in Daylight)',
    openHoursAr: 'مفتوح ٢٤ ساعة (أفضل وقت بالنهار)',
    bestFor: 'Spontaneous Swim & Snorkel',
    bestForAr: 'غطسة سريعة أو عومة في أي وقت',
  },
  {
    id: 'near-everyday-cafe',
    name: 'Everyday Cafe & Music Lounge',
    nameAr: 'إيفري داي كافيه وسهرات العود',
    category: 'nightlife',
    distance: '250m',
    walkMinutes: 3,
    priceLevel: '$$',
    tag: 'Acoustic Music & Sea Terrace',
    tagAr: 'تراس بحري وموسيقى لايف',
    image: '/images/restaurants/the-roof-restaurant.jpg',
    description: 'Iconic seafront terrace with hanging swings over the water, live acoustic guitar and Bedouin tea.',
    descriptionAr: 'قعدة مريحة على البحر ومراجيح خشبية فوق المية، وعزف عود وجيتار هادئ مع شاي المرمية والشيشة.',
    location: 'Mashraba Promenade',
    locationAr: 'ممشى المشربة، دهب',
    openHours: '08:00 AM – 01:00 AM',
    openHoursAr: '٠٨:٠٠ ص – ٠١:٠٠ بعد منتصف الليل',
    bestFor: 'Sunset Chill & Live Music',
    bestForAr: 'قعدة غروب وسهرات رايقة',
  },
  {
    id: 'near-blue-hole',
    name: 'Blue Hole & Bells Marine Sanctuary',
    nameAr: 'محمية البلو هول والبلز للغطس الحر',
    category: 'experience',
    distance: '8.5km',
    walkMinutes: 15,
    priceLevel: '$$$',
    tag: 'World Heritage Dive Site',
    tagAr: 'أشهر موقع غطس عالمي',
    image: '/images/attractions/blue-hole.jpg',
    description: 'The legendary 120m deep blue submarine sinkhole surrounded by dramatic coral walls.',
    descriptionAr: 'الثقب الأزرق الأسطوري بعمق ١٢٠ متراً وجدران مرجانية عمودية تبهر الغطاسين من كل أنحاء العالم.',
    location: 'North Dahab Coastal Protected Zone',
    locationAr: 'شمال دهب (منطقة المحميات الساحلية)',
    openHours: '08:00 AM – 05:00 PM',
    openHoursAr: '٠٨:٠٠ ص – ٠٥:٠٠ م',
    bestFor: 'Deep Reef Snorkel & Scuba',
    bestForAr: 'سنوركلينج وغوص عميق',
  },
  {
    id: 'near-eel-garden',
    name: 'Eel Garden Marine Garden',
    nameAr: 'شاطئ وحديقة ثعابين البحر (إيل جاردن)',
    category: 'beach',
    distance: '650m',
    walkMinutes: 8,
    priceLevel: '$',
    tag: 'Natural Marine Phenomenon',
    tagAr: 'ظاهرة بحرية رملية ممتعة',
    image: '/images/attractions/underwater-elephant.jpg',
    description: 'Sandy bottom hosting hundreds of garden eels swaying like tall grass with gentle water currents.',
    descriptionAr: 'قاع رملي ساحر يضم مئات من ثعابين البحر الرملية المسالمة اللي بتتراقص مع تيار المية اللطيف.',
    location: 'Eel Garden Bay, Dahab',
    locationAr: 'خليج إيل جاردن، دهب',
    openHours: 'Open 24/7 (Morning Best)',
    openHoursAr: 'مفتوح دائماً (أفضل وقت صباحاً مع المد)',
    bestFor: 'Underwater Photography & Calm Swim',
    bestForAr: 'تصوير تحت المية وعومة هادية',
  }
];

/**
 * Reads the destination corpus once. Defined outside the component because
 * useApiResource takes the fetcher as a dependency — an inline arrow would
 * re-request on every render.
 */
export const fetchDestinationCorpus = (signal: AbortSignal) =>
  Promise.all([
    api.getDahabActivities(signal).catch(() => ({ activities: [] })),
    api.getDahabPlaces(signal).catch(() => ({ places: [] })),
    api.getDahabAreas(signal).catch(() => ({ areas: [] }))
  ]).then(([activities, places, areas]) => ({
    activities: activities.activities,
    places: places.places,
    areas: areas.areas as Array<{
      id: string; nameEn: string; nameAr: string;
      atmosphere: string; atmosphereAr: string;
      walkabilityScore: number;
      noiseProfile: string;
      transportFriction: string;
      stayProfile: string; eveningProfile: string;
    }>
  }));

export const ExploreView: React.FC = () => {
  // `trip` was destructured but never used, and has never existed on the context.
  const { addActivityToDay, navigateTo, savedItems, setSavedItems } = useTrip();
  const { language, isRTL , t} = useLanguage();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'near_me' | 'areas' | 'categories'>('near_me');
  const [nearMeFilter, setNearMeFilter] = useState<'all' | 'food' | 'coffee' | 'beach' | 'experience' | 'nightlife'>('all');
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<
    | { matched: boolean; results: Array<{ type: string; id: string; name: string; nameAr?: string; description?: string; area?: string; category?: string; score?: number; whyEn?: string; whyAr?: string; bookable?: boolean; priceEGP?: number }>; suggestions: string[] }
    | null
>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Quick Add modal
  const [itemToAdd, setItemToAdd] = useState<any | null>(null);
  const [isDaySelectorOpen, setIsDaySelectorOpen] = useState(false);

  // Live marine conditions for the header strip + per-activity suitability
  // verdicts for the discovery cards (conditions-on-cards, P2). The verdict
  // is the server's: measured wind vs written thresholds, joined by activity
  // id — a card with no verdict shows no badge, never an invented calm.
  const [marine, setMarine] = useState<{
    seaState?: string; waterTempC?: number; windKnots?: number; windDirection?: string;
    suitability?: Array<{ activityId: string; verdict: ConditionsVerdict; reasons?: Array<{ en: string; ar: string }> }>;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.getMarineTelemetry().then(data => {
      if (!cancelled && data) setMarine({
        // The endpoint's shape: reading.{...} for the modeled sea state,
        // windKnots beside it, suitability per water activity. The previous
        // read of `data.spots?.[0]` never matched anything, so the live
        // strip was dead even when the model answered.
        seaState: undefined,
        waterTempC: data.reading?.waterTempC ?? undefined,
        windKnots: data.windKnots ?? undefined,
        windDirection: undefined,
        suitability: data.suitability,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Debounced search API call
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const results = await api.searchDahab(searchQuery);
        setSearchResults(results as typeof searchResults);
      } catch (error) {
        console.error('Search API error:', error);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // activityId → verdict lookup for card badges; language-aware reason text.
  const conditionsByActivity = useMemo(() => {
    const map = new Map<string, { verdict: ConditionsVerdict; reason?: string }>();
    for (const s of marine?.suitability ?? []) {
      if (!s || !s.activityId || !s.verdict) continue;
      const reason = s.reasons?.[0] ? (language === 'ar' ? s.reasons[0].ar : s.reasons[0].en) : undefined;
      map.set(s.activityId, { verdict: s.verdict, reason });
    }
    return map;
  }, [marine, language]);

  const tabListRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /**
   * One save system: hearts here write straight into the shared bucket list
   * the profile dossier reads, so a saved place actually appears under Saved.
   * The named toast stays local; setSavedItems itself stays silent, which is
   * what keeps a single toast per tap instead of two.
   */
  const toggleFavorite = (id: string, name: string) => {
    const exists = savedItems.includes(id);
    setSavedItems(exists ? savedItems.filter(item => item !== id) : [...savedItems, id]);
    showToast(exists ? t('explore.removedFromFavorites', { name }) : t('explore.savedToFavorites', { name }));
  };

  const handleQuickAddClick = (item: any) => {
    setItemToAdd(item);
    setIsDaySelectorOpen(true);
  };

  const handleOpenExperienceDetail = (item: NearMeItem) => {
    navigateTo('/experiences', { experienceSlug: item.id });
  };

  const confirmAddActivityToTargetDay = async (dayNumber: number) => {
    if (!itemToAdd) return;

    const priceEGP = typeof itemToAdd.basePriceEGP === 'number' ? itemToAdd.basePriceEGP : 0;

    setIsDaySelectorOpen(false);
    setItemToAdd(null);

    // No success message here. addActivityToDay is the only caller that knows
    // whether the write reached the server, and it reports the outcome itself.
    // Announcing success from both places is how "was not added" and "added
    // successfully" ended up on screen together.
    await addActivityToDay(dayNumber, {
      id: `explore-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: language === 'ar' && itemToAdd.nameAr ? itemToAdd.nameAr : itemToAdd.name || itemToAdd.title,
      time: '04:30 PM',
      type: 'Exploration',
      status: itemToAdd.skuId ? 'Suggested' : 'Added ✓',
      // Carried so this line can be booked from the trip timeline later.
      // Without them, anything added from Explore was a dead end.
      skuId: itemToAdd.skuId,
      serviceType: itemToAdd.serviceType,
      priceEGP,
      location: language === 'ar' && itemToAdd.locationAr ? itemToAdd.locationAr : itemToAdd.location || 'Dahab Promenade',
      // Was `approx. 150 EGP` on every card regardless of what it actually costs.
      notes: priceEGP > 0
        ? `${itemToAdd.priceLevel || ''} · ${priceEGP.toLocaleString()} EGP`.trim()
        : (t('explore.freeEntry'))
    });
  };

  /**
   * The real 22 activities and 17 places, with the six curated venues as the
   * fallback.
   *
   * Explore rendered NEAR_ME_DATA and nothing else while both endpoints sat
   * unused. The curated list is kept deliberately: it is what the page shows
   * when the request fails or the corpus is empty, so a bad connection
   * degrades the page instead of blanking it.
   */
  const corpus = useApiResource(fetchDestinationCorpus, { cacheKey: 'corpus.explore', ttlMs: 60_000 });

  const exploreItems = useMemo(() => {
    if (!corpus.data || corpus.data.activities.length === 0) return NEAR_ME_DATA;
    return buildExploreItems(corpus.data.activities, corpus.data.places, language === 'ar');
  }, [corpus.data, language]);

  const areaProfiles = useMemo(() => {
    return corpus.data?.areas ?? [];
  }, [corpus.data]);

  const areaFilterOptions = useMemo(() => {
    if (!areaProfiles.length) return [];
    return areaProfiles.map(a => ({
      id: a.id,
      label: language === 'ar' ? a.nameAr : a.nameEn,
      atmosphere: a.atmosphere,
      atmosphereAr: a.atmosphereAr,
    }));
  }, [areaProfiles, language]);

  // Build a lookup of area id → filtered items count for the UI
  const areaItemCounts = useMemo(() => {
    if (!areaProfiles.length) return {};
    const counts: Record<string, number> = {};
    areaProfiles.forEach(a => {
      const matching = exploreItems.filter(item => 
        item.location.includes(a.id) || item.locationAr?.includes(a.id)
      );
      counts[a.id] = matching.length;
    });
    return counts;
  }, [areaProfiles, exploreItems]);

const filteredNearMe = useMemo(() => {
    const cleanQuery = sanitizeText(searchQuery).toLowerCase().trim();
    return exploreItems.filter(item => {
      const matchesCategory = nearMeFilter === 'all' || item.category === nearMeFilter;
      const matchesSearch = !cleanQuery ||
        item.name.toLowerCase().includes(cleanQuery) ||
        (item.nameAr && item.nameAr.toLowerCase().includes(cleanQuery)) ||
        item.tag.toLowerCase().includes(cleanQuery) ||
        (item.tagAr && item.tagAr.toLowerCase().includes(cleanQuery)) ||
        item.location.toLowerCase().includes(cleanQuery);
      // Area filter: if an area is selected, only show items from that area
      const matchesArea = !selectedAreaId || 
        (item.location && item.location.includes(selectedAreaId)) || 
        (item.locationAr && item.locationAr.includes(selectedAreaId));
      return matchesCategory && matchesSearch && matchesArea;
    });
  }, [exploreItems, nearMeFilter, searchQuery, selectedAreaId]);

  // Discovery moods — photographic navigation over the REAL category
  // buckets the filter below matches on (item.category). Counts come from
  // the same corpus, so a mood never promises spots it cannot show.
  const moodCards = ([
    { id: 'food', label: t('explore.foodSeafood'), image: '/images/restaurants/ali-baba-restaurant.jpg' },
    { id: 'coffee', label: t('explore.artisanCoffee'), image: '/images/restaurants/breakfast-by-the-sea.jpg' },
    { id: 'beach', label: t('explore.reefBeach'), image: '/images/attractions/coral-gardens.jpg' },
    { id: 'nightlife', label: t('explore.eveningChill'), image: '/images/restaurants/the-roof-restaurant.jpg' },
    { id: 'experience', label: t('explore.experiences'), image: '/images/attractions/blue-hole.jpg' },
  ] as const).map((mood) => ({
    ...mood,
    count: exploreItems.filter((item) => item.category === mood.id).length,
  }));
  const activeMood = moodCards.find((m) => m.id === nearMeFilter) ?? null;
  const showFeatured = nearMeFilter === 'all' && sanitizeText(searchQuery).trim() === '' && filteredNearMe.length > 1;
  const [featuredPlace, ...restPlaces] = filteredNearMe;
  const gridPlaces = showFeatured ? restPlaces : filteredNearMe;

  // Plural helper for "spots available" — picks the right i18n key based on count.
  const spotsAvailableLabel = (count: number) => {
    if (count === 0) return t('explore.spotsAvailable_zero');
    if (count === 1) return t('explore.spotsAvailable_one');
    return t('explore.spotsAvailable_other', { count });
  };

  return (
    <div 
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`min-h-screen flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/20 ${
        isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
      }`}
    >
      {/* Traveler Top Navigation */}
      <TravelerNav
        activeTab="explore"
        onNavigate={(tab) => {
          if (tab === 'mytrip' || tab === 'home') navigateTo('/my-trip');
          else if (tab === 'explore') navigateTo('/explore');
          else if (tab === 'bookings') navigateTo('/my-trip');
        }}
      />

      {/* Concierge photographic band — imagery-forward discovery hero */}
      <ConciergePageHeader
        eyebrow={t('explore.dahabLiveDiscovery')}
        title={t('explore.curatedSpotsAroundYou')}
        subtitle={t('explore.handpickedCafesBeachEntries')}
        image="/images/hero/golden-beach.jpg"
        imageAlt="Dahab Live Discovery"
        bright
        actions={
          <>
            <button
              type="button"
              onClick={() => navigateTo('/food')}
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent-primary)] px-5 text-xs font-bold text-[var(--accent-primary-ink)] shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>{t('explore.foodNow')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('/my-trip')}
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-5 text-xs font-bold text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{t('explore.myTrip')}</span>
            </button>
          </>
        }
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 w-full flex-grow space-y-10">

        {/* Search — overlapping card pulling the hero into the page */}
        <div className="relative z-20 -mt-10 max-w-2xl">
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 shadow-xl">
            <div className="relative">
              <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]`} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('explore.searchDahabPlaces')}
                placeholder={t('explore.searchPlacesCafesSeafood')}
                className={`w-full py-3.5 ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} rounded-2xl bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`}
              />
            </div>
          </div>
        </div>

        {/* Live Conditions Strip */}
        {marine && (
          <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
              <Waves className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              {marine.seaState || 'Calm'}
            </span>
            {marine.waterTempC != null && (
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span className="font-mono font-bold text-[var(--accent-primary)]">{marine.waterTempC}°C</span>
                {t('explore.water')}
              </span>
            )}
            {marine.windKnots != null && (
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span className="font-mono font-bold">{marine.windKnots} kn</span>
                {marine.windDirection}
              </span>
            )}
          </div>
        )}

        {/* Discovery moods — photographic category navigation wired to the real filter */}
        <section aria-label={t('explore.experiences')} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
            {moodCards.map((mood) => {
              const selected = nearMeFilter === mood.id;
              return (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => setNearMeFilter(selected ? 'all' : mood.id)}
                  aria-pressed={selected}
                  className={`group relative h-36 cursor-pointer overflow-hidden rounded-3xl border text-start transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:h-44 ${
                    selected
                      ? 'border-[var(--accent-primary)] shadow-xl'
                      : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 hover:shadow-lg'
                  }`}
                >
                  <img
                    src={mood.image}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108 ${selected ? 'scale-105' : ''}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden="true" />
                  {selected && (
                    <span className="absolute top-2.5 end-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]" aria-hidden="true">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 p-3">
                    <span className="block text-sm font-bold text-white">{mood.label}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-white/65">
                      {mood.count} {spotsAvailableLabel(mood.count)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              {activeMood ? (
                <button
                  type="button"
                  onClick={() => setNearMeFilter('all')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent-primary)]/12 px-3 py-1 font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  {activeMood.label}
                </button>
              ) : (
                t('explore.allPlaces')
              )}
            </p>
            <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              {filteredNearMe.length} {spotsAvailableLabel(filteredNearMe.length)}
            </span>
          </div>
        </section>
          <section aria-label={t('explore.areas')} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {areaFilterOptions.map((area) => {
                const selected = selectedAreaId === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedAreaId(selected ? null : area.id)}
                    aria-pressed={!!selected}
                    className={`group relative h-10 cursor-pointer overflow-hidden rounded-full border text-start transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] text-[10px] font-medium ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary-ink)]'
                        : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 hover:text-[var(--accent-primary)]'
                    }`}
                  >
                    <span className="truncate">{area.label}</span>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[2px] opacity-0 ${
                      selected ? 'opacity-100' : ''
                    }">{areaItemCounts[area.id] ?? 0}+</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                {selectedAreaId ? (
                  <button
                    type="button"
                    onClick={() => setSelectedAreaId(null)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent-primary)]/12 px-3 py-1 font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    {t('explore.allAreas')}
                  </button>
                ) : (
                  t('explore.allAreas')
                )}
              </p>
              <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                {filteredNearMe.length} {spotsAvailableLabel(filteredNearMe.length)}
              </span>
            </div>
          </section>

        {/* Places Grid.
            The place names inside are correctly h3 — they are the items — but
            there was no h2 above them, so the page ran h1 straight to h3 with
            nothing naming the results. Visually hidden because the filter row
            immediately above already states the count on screen. */}
        <h2 className="sr-only">
          {t('explore.availablePlaces')}
        </h2>

        {/* Featured discovery — the top match gets an editorial spread, so the
            page opens with a place, not a grid of equals. */}
        {showFeatured && featuredPlace && (() => {
          const place = featuredPlace;
          const isFav = savedItems.includes(place.id);
          const placeName = language === 'ar' && place.nameAr ? place.nameAr : place.name;
          return (
            <article className="group grid grid-cols-1 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-xl lg:grid-cols-2">
              <div className="relative h-64 overflow-hidden sm:h-80 lg:h-full lg:min-h-[380px]">
                {place.image ? (
                  <img
                    src={place.image}
                    alt={placeName}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-container)] via-[var(--surface-card)] to-[var(--surface-container)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" aria-hidden="true" />
                <div className="absolute top-4 start-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--accent-primary)] px-3 py-1 text-[11px] font-bold text-[var(--accent-primary-ink)]">
                    {language === 'ar' ? 'مختاراتنا' : 'Featured pick'}
                  </span>
                  {place.distance && (
                    <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                      {place.distance}{place.walkMinutes ? ` (${place.walkMinutes} ${t('explore.minWalk')})` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
                    {language === 'ar' && place.tagAr ? place.tagAr : place.tag}
                  </p>
                  <h3
                    onClick={() => handleOpenExperienceDetail(place)}
                    className="mt-2 cursor-pointer font-display text-3xl font-semibold leading-tight text-[var(--text-primary)] transition-colors hover:text-[var(--accent-primary)] sm:text-4xl text-balance"
                  >
                    {placeName}
                  </h3>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                    {language === 'ar' && place.descriptionAr ? place.descriptionAr : place.description}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                    <MapPin className="h-3.5 w-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                    {language === 'ar' && place.locationAr ? place.locationAr : place.location}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenExperienceDetail(place)}
                    className="inline-flex min-h-[52px] cursor-pointer items-center gap-2 rounded-full bg-[var(--accent-primary)] px-7 text-sm font-bold text-[var(--accent-primary-ink)] shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    <span>{t('explore.details')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddClick(place)}
                    className="inline-flex min-h-[52px] cursor-pointer items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-container)] px-7 text-sm font-bold text-[var(--text-primary)] transition-colors duration-200 hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>{t('explore.addToTrip')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(place.id, placeName)}
                    aria-pressed={isFav}
                    aria-label={`${isFav ? t('explore.removeFromFavourites') : t('explore.addToFavourites')}: ${placeName}`}
                    className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${isFav ? 'bg-rose-500 text-white' : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-rose-400'}`}
                  >
                    <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          );
        })()}
        
        {/* Loading Skeletons */}
        {corpus.status === 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" aria-busy="true" aria-live="polite">
            {[...Array(6)].map((_, i) => (
              <ExperienceCardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        )}

        {/* Results Grid */}
        {corpus.status !== 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {gridPlaces.map((place) => {
            const isFav = savedItems.includes(place.id);
            return (
              <div
                key={place.id}
                className={`rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] overflow-hidden shadow-xl flex flex-col group aurora-hover ${
                  isDark
                    ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/40 text-[var(--text-primary)]'
                    : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)]'
                }`}
              >
                {/* Image Header */}
                <div className="relative h-60 w-full overflow-hidden bg-[var(--surface-card)]">
                  {/* Records from the destination corpus carry no photograph.
                      A tinted panel is the honest stand-in; a stock image
                      would imply the platform has a picture of this place. */}
                  {place.image ? (
                    <img
                      src={place.image}
                      alt={language === 'ar' && place.nameAr ? place.nameAr : place.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[var(--surface-container)] via-[var(--surface-card)] to-[var(--surface-container)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                  {/* Top Badges */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                    {place.distance ? (
                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-[var(--accent-secondary)] border border-[var(--border-subtle)]">
                        {place.distance}
                        {place.walkMinutes
                          ? ` (${place.walkMinutes} ${t('explore.minWalk')})`
                          : ''}
                      </span>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      onClick={() => toggleFavorite(place.id, language === 'ar' && place.nameAr ? place.nameAr : place.name)}
                      aria-pressed={isFav}
                      aria-label={`${isFav
                        ? (t('explore.removeFromFavourites'))
                        : (t('explore.addToFavourites'))}: ${language === 'ar' && place.nameAr ? place.nameAr : place.name}`}
                      className={`w-8 h-8 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                        isFav ? 'bg-rose-500 text-white' : 'bg-black/50 text-white hover:bg-black/80'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Bottom Image Tag */}
                  <div className="absolute bottom-2.5 inset-x-3 flex items-center gap-2">
                    <span className="text-[11px] font-black text-[var(--accent-primary)] block drop-shadow-md">
                      {language === 'ar' && place.tagAr ? place.tagAr : place.tag}
                    </span>
                    {/* Live suitability for water activities — only when the
                        server's marine payload carries a verdict for this id. */}
                    {(() => {
                      const conditions = conditionsByActivity.get(place.id);
                      return conditions ? (
                        <span className="ml-auto drop-shadow-md">
                          <ConditionsBadge verdict={conditions.verdict} reason={conditions.reason} />
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-display font-semibold text-xl leading-snug cursor-pointer hover:text-[var(--accent-primary)] transition-colors ${
                        isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                      }`}
                      onClick={() => handleOpenExperienceDetail(place)}
                      >
                        {language === 'ar' && place.nameAr ? place.nameAr : place.name}
                      </h3>
                      {typeof place.rating === 'number' && (
                        <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent-secondary)] flex-shrink-0">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{place.rating}</span>
                        </div>
                      )}
                    </div>

                    <p className={`text-xs leading-relaxed line-clamp-2 ${
                      isDark ? 'text-[var(--text-secondary)]/75' : 'text-[var(--text-secondary)]'
                    }`}>
                      {language === 'ar' && place.descriptionAr ? place.descriptionAr : place.description}
                    </p>

                    <div className={`flex items-center gap-2 text-xs pt-1 ${
                      isDark ? 'text-[var(--text-secondary)]/60' : 'text-[var(--text-secondary)]'
                    }`}>
                      <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>{language === 'ar' && place.locationAr ? place.locationAr : place.location}</span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className={`pt-3 border-t flex items-center gap-2 ${
                    isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'
                  }`}>
                    <button
                      type="button"
                      id={`explore-card-details-btn-${place.id}`}
                      onClick={() => handleOpenExperienceDetail(place)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-1.5 cursor-pointer border ${
                        isDark
                          ? 'bg-[var(--surface-container)] hover:bg-[#1a4038] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-white/5'
                          : 'bg-[var(--surface-container)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('explore.details')}</span>
                    </button>

                    <button
                      type="button"
                      id={`explore-card-add-btn-${place.id}`}
                      onClick={() => handleQuickAddClick(place)}
                      className="flex-1 py-2.5 rounded-xl bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('explore.addToTrip')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Area Profiles Section */}
        {areaProfiles.length > 0 && (
          <section className="space-y-4 pt-10 border-t border-[var(--border-subtle)]">
            <div className="max-w-2xl">
              <h2 className={`flex items-center gap-2.5 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-balance ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                <MapPin className="w-6 h-6 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                {t('explore.dahabAreas')}
              </h2>
              <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                {t('explore.exploreDahabNeighborhoodsBy')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {areaProfiles.map((area) => (
                <div
                  key={area.id}
                  className={`p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer hover:shadow-md ${
                    isDark
                      ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                      : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`chart-heading font-bold text-sm ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                      {language === 'ar' ? area.nameAr : area.nameEn}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] text-[10px] font-bold">
                      {area.walkabilityScore}/10
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed line-clamp-2 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
                    {language === 'ar' ? area.atmosphereAr : area.atmosphere}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-[var(--surface-container)] text-[var(--text-secondary)]/60' : 'bg-[var(--surface-container)] text-[var(--text-secondary)]'}`}>
                      {area.noiseProfile}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-[var(--surface-container)] text-[var(--text-secondary)]/60' : 'bg-[var(--surface-container)] text-[var(--text-secondary)]'}`}>
                      {area.transportFriction}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* QUICK ADD TO TARGET DAY MODAL */}
      {isDaySelectorOpen && itemToAdd && (
        <div 
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsDaySelectorOpen(false)}
        
      role="dialog"
      aria-modal="true"
      aria-labelledby="explore-view-dialog-2-title"
    >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border animate-in zoom-in-95 duration-150 text-start rtl:text-end ${
              isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-[var(--accent-primary)]">
                  {t('explore.addExperienceToItinerary')}
                </span>
                <h3 id="explore-view-dialog-2-title" className={`text-lg chart-heading font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                  {language === 'ar' && itemToAdd.nameAr ? itemToAdd.nameAr : itemToAdd.name || itemToAdd.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDaySelectorOpen(false)}
                aria-label={t('attractions.close')}
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)]/70 hover:bg-[var(--surface-card)]/10' : 'bg-[var(--surface-container)] text-[var(--text-primary)] hover:bg-[var(--surface-card)]'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className={`text-xs ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
              {t('explore.selectWhichDayIn')}
            </p>

            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => confirmAddActivityToTargetDay(d)}
                  className={`py-3 rounded-xl border text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex flex-col items-center gap-1 cursor-pointer group ${
                    isDark
                      ? 'bg-[var(--surface-container)] hover:bg-[var(--accent-secondary)] hover:text-[var(--surface-container)] text-[var(--text-secondary)] border-white/5'
                      : 'bg-[var(--surface-container)] hover:bg-[var(--accent-primary)] hover:text-[var(--surface-container)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                >
                  <span className={`text-[11px] group-hover:text-[var(--surface-container)]/80 font-normal ${isDark ? 'text-[var(--text-secondary)]/60' : 'text-[var(--text-secondary)]'}`}>
                    {t('explore.day')}
                  </span>
                  <span className="text-sm font-black">{d}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsDaySelectorOpen(false)}
              className={`w-full py-2.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                isDark ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-[var(--text-secondary)]' : 'bg-[var(--surface-container)] hover:bg-[var(--surface-card)] text-[var(--text-primary)]'
              }`}
            >
              {t('explore.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Global Toast Message */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200 border ${
          isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)] border-[var(--accent-secondary)]/40' : 'bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--accent-primary)] shadow-lg'
        }`}>
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
