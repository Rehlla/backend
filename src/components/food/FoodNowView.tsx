import React, { useState } from 'react';
import { 
  Utensils, 
  Clock, 
  MapPin, 
  Sparkles, 
  ArrowLeft, 
  ArrowRight, 
  Check,
  ChevronRight,
  ChevronDown,
  Coffee,
  Bike,
  Heart,
  Sandwich,
  Soup,
  ShieldCheck, 
  AlertCircle, 
  X, 
  Plus, 
  Minus,
  Navigation,
  Star,
  ShoppingBag,
  ExternalLink,
  Flame,
  CheckCircle2,
  Calendar,
  Wallet,
  Users
} from 'lucide-react';
import { TravelerNav } from '../mytrip/TravelerNav';
import { useTrip } from '../../context/TripContext';
import { CategoryIcon } from '../common/CategoryIcon';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { buildDiningOptions } from '../../services/diningMapper';
import { useDestination } from '../../context/DestinationContext';
import { EarlyRestaurantsBrowse } from '../places/EarlyCatalogueBrowse';

interface FoodNowViewProps {
  onBackToMyTrip: () => void;
  onBackToCompanion?: () => void;
  onExploreClick?: () => void;
  onOpenHelp?: () => void;
  onMealAddedToTrip?: (meal: {
    title: string;
    time: string;
    duration: string;
    location: string;
    mode: 'dine-in' | 'delivery';
  }) => void;
}

// These moved to src/shared/types/food.ts. A service needed them
// (diningMapper), and importing a component from a service is a cycle: Vite's
// module graph broke and the whole app fell into its ErrorBoundary. Re-exported
// here so existing importers are unaffected.
export type { FoodCategory, FoodOption } from '../../shared/types/food';
import type { FoodCategory, FoodOption } from '../../shared/types/food';
import { IMG_P15172481354674c7edcad34c4_CARD, IMG_P15415447419380af808871cc0_800, IMG_P155593959458d7cb561ad1_800 } from '../../shared/placeholderImagery';

/** Stable so useApiResource does not re-request on every render. */
const fetchDiningVenues = (signal: AbortSignal) => api.getDahabDining(undefined, signal);

const LiveFoodNowView: React.FC<FoodNowViewProps> = ({
  onBackToMyTrip,
  onBackToCompanion,
  onExploreClick,
  onOpenHelp,
  onMealAddedToTrip,
}) => {
  const { language, isRTL, t } = useLanguage();
  // The greeting and the party line used to name "Ahmed" outright, in both
  // languages, for every traveler. The name comes from the session; with no
  // name the greeting is simply neutral rather than borrowed.
  const { profile, user, activeTrip, sessionUser, navigateTo } = useTrip();
  // First name only: a greeting reads as a greeting, not as a record
  // lookup. "جعان يا Ahmed Mansour؟" is not how anyone is addressed.
  const travelerName = (profile.name || user?.displayName || sessionUser?.name || '').trim().split(/\s+/)[0] || '';
  const partySize = activeTrip?.travelersCount ?? profile.travelersCount ?? 1;
  const [activeTab, setActiveTab] = useState<'home' | 'mytrip' | 'explore' | 'bookings' | 'profile'>('mytrip');

  // Selected Category filter
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');

  // Selected Restaurant for focused modal/screen
  const [selectedRestaurant, setSelectedRestaurant] = useState<FoodOption | null>(null);

  // Selected fulfillment mode inside modal: 'eat-here' | 'delivery'
  const [fulfillmentMode, setFulfillmentMode] = useState<'eat-here' | 'delivery'>('eat-here');

  // Full menu modal open state
  const [isFullMenuOpen, setIsFullMenuOpen] = useState(false);

  // Delivery order workflow state: 'none' | 'confirm' | 'tracking'
  const [deliveryWorkflow, setDeliveryWorkflow] = useState<'none' | 'confirm' | 'tracking'>('none');
  
  // Order items for delivery — starts empty; the traveler fills it.
  const [orderCart, setOrderCart] = useState<Record<string, number>>({});

  // Delivery Tracking Status: 'preparing' | 'picked_up' | 'on_the_way' | 'delivered'
  const [deliveryStatus, setDeliveryStatus] = useState<'preparing' | 'picked_up' | 'on_the_way' | 'delivered'>('preparing');

  // Eat here Added To Trip state
  const [addedEatHereMeal, setAddedEatHereMeal] = useState<{
    restaurantName: string;
    estimatedTime: string;
  } | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 3 Primary Curated Recommendations
  const recommendedOptions: FoodOption[] = [
    {
      id: 'rec-1',
      name: 'Al Fanar Local Kitchen',
      nameAr: 'مطعم ومطبخ الفنار البلدي',
      category: 'breakfast',
      categoryTag: 'Local Kitchen',
      categoryTagAr: 'أكل بلدي وشعبي',
      title: 'Authentic Sinai Breakfast & Mezze',
      titleAr: 'فطار ومقبلات سيناوية طازة',
      description: 'A relaxed local spot with freshly baked baladi bread, organic eggs, tahini, and authentic Bedouin tea.',
      descriptionAr: 'قعدة مريحة ع الممشى، عيش بلدي سخن من الفرن، فول مدمس بالزيت الحار، وفلافل مقرمشة بالسمسم مع شاي حبق.',
      distance: '0.6 km',
      distanceAr: '٦٠٠ متر',
      distanceKm: '0.6 km',
      estimatedTime: '45–60 min',
      estimatedTimeAr: '٤٥–٦٠ دقيقة',
      priceLevel: 'Low–Moderate',
      priceEstimate: 'EGP 120–250 per person',
      priceEstimateAr: '١٢٠–٢٥٠ ج.م للفرد',
      badge: 'Best fit',
      badgeAr: 'أنسب اختيار',
      cuisine: 'Egyptian · Bedouin · Coastal Breakfast',
      cuisineAr: 'مصري · بدوي · فطار ع البحر',
      openingStatus: 'Open now · Kitchen active',
      openingStatusAr: 'مفتوح دلوقتي · المطبخ شغال',
      diningDuration: '45–60 min',
      diningDurationAr: '٤٥–٦٠ دقيقة',
      deliveryTime: '35–45 min',
      deliveryTimeAr: '٣٥–٤٥ دقيقة',
      imageUrl: IMG_P15415447419380af808871cc0_800,
      popularDishes: [
        {
          id: 'dish-1',
          name: 'Egyptian Deluxe Breakfast',
          nameAr: 'صينية الفطار المصري الديلوكس',
          description: 'Authentic ful medames, crispy falafel, tahini, fresh warm baladi bread, and pickled vegetables.',
          descriptionAr: 'فول مدمس، فلافل مقرمشة بالسمسم، جبنة بالطماطم وزيت الزيتون، عيش سخن ومخلل بلدي.',
          price: 180,
        },
        {
          id: 'dish-2',
          name: 'Charcoal Grilled Half Chicken',
          nameAr: 'نصف فرخة مشوية ع الفحم',
          description: 'Charcoal grilled half-chicken served with herb-infused spiced rice, garlic toum, and salad.',
          descriptionAr: 'دجاج بلدي مشوي بتتبيلة الأعشاب مع أرز مبهر، ثومية، وسلطة بلدي خضرا.',
          price: 320,
        },
        {
          id: 'dish-3',
          name: 'Fresh Sinai Mango & Lemon Mint',
          nameAr: 'عصير مانجو أو ليمون نعناع فريش',
          description: 'Freshly pressed Sinai mango, guava, or iced lemon-mint cooler.',
          descriptionAr: 'مانجو طبيعي فريش أو ليمون نعناع مثلج منعش للشمس.',
          price: 90,
        },
      ],
    },
    {
      id: 'rec-2',
      name: 'Shams Falafel & Grill Express',
      nameAr: 'مطعم شمس للفلافل والمشاوي السريعة',
      category: 'quick',
      categoryTag: 'Quick Lunch',
      categoryTagAr: 'غداء سريع وعصري',
      title: 'Fast & Casual Coastal Wraps',
      titleAr: 'سندوتشات ومشاوي سريعة ع الممشى',
      description: 'A casual option nearby when you want something flavorful without spending too much time.',
      descriptionAr: 'اختيار سريع ولذيذ قريب منك جداً، مناسب لوقتك قبل النشاط بدون أي تعطيل.',
      distance: '0.9 km',
      distanceAr: '٩٠٠ متر',
      distanceKm: '0.9 km',
      estimatedTime: '30–45 min',
      estimatedTimeAr: '٣٠–٤٥ دقيقة',
      priceLevel: 'Moderate',
      priceEstimate: 'EGP 150–280 per person',
      priceEstimateAr: '١٥٠–٢٨٠ ج.م للفرد',
      badge: 'Quick',
      badgeAr: 'سريع وخفيف',
      cuisine: 'Fast Casual · Wraps & Mezze',
      cuisineAr: 'وجبات سريعة · لفائف ومقبلات',
      openingStatus: 'Open now · Fast service',
      openingStatusAr: 'مفتوح دلوقتي · خدمة فورية',
      diningDuration: '30–45 min',
      diningDurationAr: '٣٠–٤٥ دقيقة',
      deliveryTime: '25–35 min',
      deliveryTimeAr: '٢٥–٣٥ دقيقة',
      imageUrl: IMG_P155593959458d7cb561ad1_800,
      popularDishes: [
        {
          id: 'dish-2-1',
          name: 'Sesame Falafel & Halloumi Wrap',
          nameAr: 'سندوتش فلافل بحلوم مشوي',
          description: 'Hot falafel patties, grilled halloumi, arugula, tahini sauce in toasted pita.',
          descriptionAr: 'فلافل سمسم سخنة، جبنة حلوم مشوية، جرجير فريش وصوص طحينة في عيش محمص.',
          price: 140,
        },
        {
          id: 'dish-2-2',
          name: 'Kofta & Spiced Fries Plate',
          nameAr: 'طبق كفتة مشوية وبطاطس متبلة',
          description: 'Grilled lamb & beef skewers with golden spiced wedges and sumac salad.',
          descriptionAr: 'سيخين كفتة بلدي مشوية مع بطاطس مقلية متبلة وسلطة بصل بالسماق.',
          price: 290,
        },
        {
          id: 'dish-2-3',
          name: 'Iced Hibiscus Karkadeh',
          nameAr: 'كركديه أسواني مثلج بالنعناع',
          description: 'Chilled sweet Sinai hibiscus tea infused with fresh mint.',
          descriptionAr: 'كركديه بلدي مثلج مروق للدم مع لمسة نعناع فريش.',
          price: 65,
        },
      ],
    },
    {
      id: 'rec-3',
      name: 'Blue Beach Bayfront Lounge',
      nameAr: 'لاونج ومطعم بلو بيتش ع البحر',
      category: 'datenight',
      categoryTag: 'Sea View Lunch',
      categoryTagAr: 'غداء رايق ع الشاطئ',
      title: 'Fresh Catch with Azure Views',
      titleAr: 'سمك طازة وقعدة استجمام ع البحر',
      description: 'A slower lunch with a sea view if you want to relax and soak up the breeze before your afternoon.',
      descriptionAr: 'قعدة مريحة وممتدة ع البحر للاستمتاع بنسيم البحر الأحمر والسمك الطازة المشوي.',
      distance: '1.2 km',
      distanceAr: '١.٢ كم',
      distanceKm: '1.2 km',
      estimatedTime: '60–75 min',
      estimatedTimeAr: '٦٠–٧٥ دقيقة',
      priceLevel: 'Moderate',
      priceEstimate: 'EGP 220–400 per person',
      priceEstimateAr: '٢٢٠–٤٠٠ ج.م للفرد',
      badge: 'Relaxed',
      badgeAr: 'روقان ع البحر',
      cuisine: 'Red Sea Fresh Seafood · Mediterranean',
      cuisineAr: 'سي فود البحر الأحمر · متوسطي',
      openingStatus: 'Open now · Waterfront seating',
      openingStatusAr: 'مفتوح دلوقتي · طاولات شاطئية',
      diningDuration: '60–75 min',
      diningDurationAr: '٦٠–٧٥ دقيقة',
      deliveryTime: '40–50 min',
      deliveryTimeAr: '٤٠–٥٠ دقيقة',
      imageUrl: IMG_P15172481354674c7edcad34c4_CARD,
      popularDishes: [
        {
          id: 'dish-3-1',
          name: 'Catch of the Day (Grilled Seabass)',
          nameAr: 'سمكة قاروص مشوية ع الفحم (صيد اليوم)',
          description: 'Fresh local reef seabass chargrilled with lemon, olive oil, sayadieh rice, and cumin tahina.',
          descriptionAr: 'سمكة قاروص طازة مشوية بالزيت والليمون مع أرز صيادية وطحينة بالكمون.',
          price: 390,
        },
        {
          id: 'dish-3-2',
          name: 'Bedouin Mezze Platter',
          nameAr: 'مقبلات ومزة بدوية مشكلة',
          description: 'Smoked baba ghanoush, labneh with zaatar, hummus, stuffed vine leaves, and warm flatbread.',
          descriptionAr: 'بابا غنوج مدخن، لبنة بالزعتر البري، حمص بالكمون، ورق عنب وعيش صاج.',
          price: 240,
        },
        {
          id: 'dish-3-3',
          name: 'Sinai Mint Tea Pot',
          nameAr: 'براد شاي حبق بدوي ع الفحم',
          description: 'Traditional habak desert herb brewed tea served with date biscuits.',
          descriptionAr: 'شاي سيناوي بالأعشاب الطبيعية يقدم مع بسكويت التمر التراثي.',
          price: 75,
        },
      ],
    },
  ];

  // 5 Intent-Based Categories
  const categories: {
    id: FoodCategory;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    titleAr: string;
    subtitle: string;
    subtitleAr: string;
  }[] = [
    {
      id: 'breakfast',
      icon: Coffee,
      title: 'Breakfast',
      titleAr: 'فطار وروقان',
      subtitle: 'Light & local starters',
      subtitleAr: 'فول وفلافل وعيش سخن',
    },
    {
      id: 'quick',
      icon: Sandwich,
      title: 'Quick Bite',
      titleAr: 'سريع وخفيف',
      subtitle: 'Fast & casual wraps',
      subtitleAr: 'سندوتشات سريعة قبل النشاط',
    },
    {
      id: 'local',
      icon: Soup,
      title: 'Local',
      titleAr: 'أكل بدوي وسي فود',
      subtitle: 'Dahab authentic taste',
      subtitleAr: 'سمك ع الفحم ومطبخ سيناوي',
    },
    {
      id: 'datenight',
      icon: Sparkles,
      title: 'Sea View',
      titleAr: 'قعدة ع البحر',
      subtitle: 'Relaxed waterfront dining',
      subtitleAr: 'طاولات ممتدة ع الشاطئ',
    },
    {
      id: 'delivery',
      icon: Bike,
      title: 'Beach Delivery',
      titleAr: 'دليفري ع الشط',
      subtitle: 'Delivered to your shade',
      subtitleAr: 'يوصل لشلتتك أو فندقك',
    },
  ];

  /**
   * The three curated venues plus the ten the destination corpus holds.
   *
   * The curated three are kept rather than replaced because they carry the
   * menus the ordering flow needs; the corpus has none. The corpus venues are
   * appended, deduplicated by name — Ralph's German Bakery is in both — so the
   * page finally shows the real list instead of three hand-written cards.
   */
  const dining = useApiResource(fetchDiningVenues);

  // Which of these venues can actually take an order. The orderable list is
  // the only source of slugs; a venue without one keeps the demo flow rather
  // than deep-linking to a menu that does not exist.
  const orderableFetcher = React.useCallback(
    (signal: AbortSignal) => api.getDiningVenues(signal).then(r => r.venues),
    []
  );
  const orderable = useApiResource(orderableFetcher, { cacheKey: 'dining:venues', ttlMs: 60_000 });
  const slugByVenueId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const v of orderable.data ?? []) if (v.slug) map.set(v.id, v.slug);
    return map;
  }, [orderable.data]);

  const allOptions = React.useMemo(() => {
    if (!dining.data?.venues?.length) return recommendedOptions;
    const seen = new Set(recommendedOptions.map(o => o.name.toLowerCase().replace(/[^a-z]/g, '')));
    const fromCorpus = buildDiningOptions(dining.data.venues).filter(
      option => !seen.has(option.name.toLowerCase().replace(/[^a-z]/g, ''))
    );
    return [...recommendedOptions, ...fromCorpus];
  }, [dining.data]);

  // Filtered options based on category
  const filteredOptions = selectedCategory === 'all'
    ? allOptions
    : allOptions.filter(o => o.category === selectedCategory || (selectedCategory === 'local' && o.cuisine.toLowerCase().includes('bedouin')));

  // Helper calculations for cart
  const calculateCartTotals = (restaurant: FoodOption) => {
    let subtotal = 0;
    restaurant.popularDishes.forEach(dish => {
      const qty = orderCart[dish.id] || 0;
      subtotal += dish.price * qty;
    });
    const deliveryFee = 30; // standard EGP delivery in Dahab
    const total = subtotal > 0 ? subtotal + deliveryFee : 0;
    return { subtotal, deliveryFee, total };
  };

  const handleUpdateQty = (dishId: string, delta: number) => {
    setOrderCart(prev => {
      const current = prev[dishId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [dishId]: next };
    });
  };

  const handleOpenRestaurant = (option: FoodOption) => {
    setSelectedRestaurant(option);
    setFulfillmentMode('eat-here');
    setDeliveryWorkflow('none');
  };

  const handleProceedToDelivery = (option: FoodOption) => {
    // A real kitchen goes to the REAL order flow, where the price is computed
    // server-side and the order is stored — this screen's own confirm modal
    // invented a total and claimed it would be charged to the room, which no
    // payment path supports. The three hand-written demo venues have no kitchen
    // behind them, so they keep the demo flow rather than dead-ending.
    const slug = slugByVenueId.get(option.id);
    if (slug) {
      navigateTo('/restaurants', { venueSlug: slug });
      return;
    }
    setSelectedRestaurant(option);
    setFulfillmentMode('delivery');
    setDeliveryWorkflow('confirm');
  };

  const handlePlaceDeliveryOrder = () => {
    setDeliveryWorkflow('tracking');
    setDeliveryStatus('preparing');
    showToast(
      t('food.orderPlaced', {
        name: language === 'ar'
          ? (selectedRestaurant?.nameAr || selectedRestaurant?.name || '')
          : (selectedRestaurant?.name || ''),
      })
    );
  };

  const handleAddEatHereToTrip = (restaurant: FoodOption) => {
    setAddedEatHereMeal({
      restaurantName: language === 'ar' ? restaurant.nameAr : restaurant.name,
      estimatedTime: '01:00 PM – 02:00 PM',
    });

    if (onMealAddedToTrip) {
      onMealAddedToTrip({
        title: `Lunch at ${restaurant.name}`,
        time: '01:00 PM',
        duration: '1 hr',
        location: restaurant.name,
        mode: 'dine-in',
      });
    }

    showToast(
      t('food.lunchAddedDay2', { name: language === 'ar' ? restaurant.nameAr : restaurant.name })
    );
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
      showToast(
        sessionUser
          ? `Signed in as ${sessionUser.name || sessionUser.email}`
          : t('food.notSignedIn')
      );
    }
  };

  return (
    <div 
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/20"
    >
      {/* 1. TRAVELER TOP NAVIGATION */}
      <TravelerNav
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onOpenHelp={onOpenHelp}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow">
        
        {/* Breadcrumb back to the trip companion — only when there is a trip
            to go back to. The location, clock and "next activity" pills that
            sat here were prototype placeholders (a fixed lighthouse, 01:00 PM,
            2h) shown to every visitor, so they are gone until real trip
            context drives them. */}
        {activeTrip && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="back-to-mytrip-btn"
                onClick={onBackToCompanion || onBackToMyTrip}
                className="inline-flex items-center gap-1.5 py-3.5 -my-2 text-xs font-semibold text-[var(--text-secondary)]/70 hover:text-[var(--accent-secondary)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{t('food.backToDailyCompanion')}</span>
              </button>
              <span className="text-[var(--text-muted)]">•</span>
              <button
                type="button"
                id="full-itinerary-link"
                onClick={onBackToMyTrip}
                className="text-xs font-bold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors cursor-pointer py-2 -my-2"
              >
                {t('food.fullItinerary')}
              </button>
            </div>
          </div>
        )}

        {/* 2. PAGE HEADER — concierge editorial voice */}
        <div className="space-y-5 mb-10 sm:mb-12">

          {/* Title & Subtitle */}
          <div className="space-y-3 max-w-3xl">
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
              {travelerName ? t('food.hungryGreetingNamed', { travelerName }) : t('food.hungryGreetingGeneric')}
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-3xl font-normal leading-relaxed">
              {t('food.weveFoundAFew')}
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW BODY: NORMAL OPTIONS vs NO NEARBY FOOD STATE           */}
        {/* ============================================================ */}

        {filteredOptions.length === 0 ? (
          /* ------------------------------------------------------------ */
          /* NO NEARBY FOOD STATE (< 30 min window or remote location)    */
          /* ------------------------------------------------------------ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-[var(--surface-card)] rounded-3xl p-7 sm:p-9 border border-amber-500/30 shadow-xl space-y-6 aurora-glass">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shadow-xs">
                  <CategoryIcon kind="food" className="w-6 h-6" />
                </div>

                <div className="space-y-2 text-start">
                  <h2 className="text-2xl sm:text-3xl chart-heading font-bold text-[var(--text-primary)]">
                    {t('food.nothingNearbyFitsYour')}
                  </h2>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)]/80 leading-relaxed">
                    {t('food.dineinKitchensInYour')}
                  </p>
                </div>

                {/* 3 Alternative Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => handleProceedToDelivery(recommendedOptions[0])}
                    className="text-start p-5 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/50 transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-2 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Bike aria-hidden="true" className="w-6 h-6 text-[var(--accent-secondary)]" />
                      <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">
                        {t('food.delivery')}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed">
                      {t('food.orderDirectlyToYour')}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      showToast(t('food.directionsToShamsCoffee'));
                    }}
                    className="text-start p-5 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/50 transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-2 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <CategoryIcon kind="coffee" className="w-6 h-6 text-[var(--text-secondary)]" />
                      <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">
                        {t('food.coffeeSnack')}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed">
                      {t('food.grabAnIcedEspresso')}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      showToast(t('food.dinnerReservationReminderSet'));
                    }}
                    className="text-start p-5 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/50 transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-2 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⏳</span>
                      <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">
                        {t('food.waitUntilLater')}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed">
                      {t('food.haveAGreatDinner')}
                    </p>
                  </button>
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]/60 font-mono">
                    {travelerName ? t('food.calculatedForWindowNamed', { travelerName }) : t('food.calculatedForWindowGeneric')}
                  </span>
                </div>
              </div>

            </div>

            {/* Sidebar Context */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                    {t('food.contextParameters')}
                  </span>
                  <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">01:00 PM</span>
                </div>
                <div className="space-y-2.5 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]/60">{t('food.location')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{t('food.nearDahabLighthouse')}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]/60">{t('food.nextActivity')}</span>
                    <span className="font-bold text-emerald-400">03:00 PM (Safaris)</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]/60">{t('food.pace')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{t('food.balancedRelaxed')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        ) : (

          /* ------------------------------------------------------------ */
          /* STANDARD FOOD NOW VIEW (Full Width)                          */
          /* ------------------------------------------------------------ */
          <div className="w-full space-y-8">

              {/* A. EAT HERE ADDED CONFIRMATION BANNER */}
              {addedEatHereMeal && (
                <div 
                  id="meal-added-success-banner"
                  className="bg-emerald-950/70 border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-xs">
                        ✓
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-emerald-400 block">
                          {t('food.tripUpdated')}
                        </span>
                        <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                          {t('food.addedToYourTrip')}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAddedEatHereMeal(null)}
                      aria-label={t('common.close')}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-full hover:bg-[var(--btn-util-bg)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                    {t('food.mealIntegrated', { name: addedEatHereMeal.restaurantName })}
                  </p>

                  {/* Updated Timeline Preview */}
                  <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[var(--text-primary)] font-bold">
                      <span className="font-mono text-[var(--accent-secondary)]">01:00 PM</span>
                      <span className="inline-flex items-center gap-1.5"><CategoryIcon kind="food" className="w-3.5 h-3.5" /> {t('food.lunchLabelAt', { name: addedEatHereMeal.restaurantName })}</span>
                    </div>
                    <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                      <span className="font-mono">02:00 PM</span>
                      <span>{t('food.finishLunchRelaxedWalk')}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-400 font-bold border-t border-[var(--border-subtle)] pt-1.5">
                      <span className="font-mono">03:00 PM</span>
                      <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" />{t('food.nextActivityProtected')}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={onBackToCompanion || onBackToMyTrip}
                      className="px-4 py-2 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-xs cursor-pointer"
                    >
                      {t('food.viewInDailyCompanion')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddedEatHereMeal(null)}
                      className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:underline cursor-pointer"
                    >
                      {t('food.chooseAnotherRestaurant')}
                    </button>
                  </div>
                </div>
              )}

              {/* B. FOOD CATEGORIES (Intent-Based, Visually Simple) */}
              <section
                id="food-categories-section"
                aria-label={t('food.foodCategories')}
                className="space-y-3"
              >
                {/* The section carried an eyebrow and a hint but no heading, so
                    the category names below jumped from the page h1 to h4. */}
                <h2 className="sr-only">
                  {t('food.intentbasedFoodCategories')}
                </h2>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--accent-secondary)] block">
                    {t('food.intentBasedFoodCategories')}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]/60 font-medium">
                    {t('food.selectYourMood')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        id={`category-btn-${cat.id}`}
                        onClick={() => {
                          setSelectedCategory(isSelected ? 'all' : cat.id);
                          if (cat.id === 'delivery') {
                            handleProceedToDelivery(recommendedOptions[0]);
                          } else {
                            showToast(t('food.filteredBy', { title: language === 'ar' ? cat.titleAr : cat.title }));
                          }
                        }}
                        className={`p-3.5 rounded-2xl text-start border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[var(--surface-container)] border-2 border-[var(--accent-secondary)] text-[var(--text-primary)] shadow-[0_0_15px_rgba(244,195,108,0.15)] ring-1 ring-[var(--accent-secondary)]/30'
                            : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-xs hover:border-[var(--border-subtle)]'
                        }`}
                      >
                        <cat.icon aria-hidden="true" className="w-6 h-6 mb-1.5 text-[var(--accent-secondary)]" />
                        <div className="space-y-0.5">
                          <h3 className={`font-bold text-xs sm:text-sm ${isSelected ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-primary)]'}`}>
                            {language === 'ar' ? cat.titleAr : cat.title}
                          </h3>
                          <p className={`text-[11px] leading-tight ${isSelected ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]/60'}`}>
                            {language === 'ar' ? cat.subtitleAr : cat.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* C. RECOMMENDED FOR YOU (Exactly 3 Curated Options) */}
              <section id="recommended-for-you-section" className="space-y-5">
                <div className="space-y-1.5 max-w-2xl">
                  <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] text-balance">
                    {t('food.recommendedForYou')}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] font-normal leading-relaxed">
                    {t('food.theseOptionsFitYour')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredOptions.map((option) => {
                    // Category-context photography when the corpus carries no
                    // photo — the mood, not a claim about the exact venue.
                    const fallbackByCategory: Record<string, string> = {
                      breakfast: '/images/restaurants/breakfast-by-the-sea.jpg',
                      quick: '/images/restaurants/ali-baba-restaurant.jpg',
                      local: '/images/restaurants/bedouin-crafts-market.jpg',
                      datenight: '/images/restaurants/the-roof-restaurant.jpg',
                      delivery: '/images/restaurants/boho-beach-cafe.jpg',
                    };
                    const photo = option.imageUrl || fallbackByCategory[option.category] || fallbackByCategory.quick;
                    return (
                      <div
                        key={option.id}
                        id={`food-card-${option.id}`}
                        className="group bg-[var(--surface-card)] rounded-3xl border border-[var(--border-subtle)] shadow-xl overflow-hidden flex flex-col hover:border-[var(--accent-secondary)]/40 hover:shadow-2xl transition-[background-color,border-color,color,box-shadow,transform,opacity]"
                      >
                        {/* Photo header */}
                        <div className="relative h-44 w-full overflow-hidden">
                          <img
                            src={photo}
                            alt={language === 'ar' ? option.nameAr : option.name}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" aria-hidden="true" />
                          <div className="absolute top-3 start-3 flex flex-wrap items-center gap-1.5">
                            <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full backdrop-blur-md border ${
                              option.badge === 'Best fit'
                                ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
                                : option.badge === 'Quick'
                                  ? 'bg-amber-500/25 text-amber-200 border-amber-400/40'
                                  : 'bg-cyan-500/25 text-cyan-200 border-cyan-400/40'
                            }`}>
                              {language === 'ar' ? option.badgeAr : option.badge}
                            </span>
                            {typeof option.rating === 'number' && (
                              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-[11px] font-bold text-white">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                                {option.rating}
                                {typeof option.reviewCount === 'number' && (
                                  <span className="text-white/60">({option.reviewCount})</span>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="absolute bottom-3 start-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold">
                            {language === 'ar' ? option.distanceAr : option.distance}
                          </span>
                        </div>

                        {/* Body */}
                        <div className="p-5 flex flex-col gap-2.5 flex-1">
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <span className="text-[var(--text-primary)]">{language === 'ar' ? option.nameAr : option.name}</span>
                            <span className="bg-[var(--surface-container)] text-[var(--accent-primary)] font-semibold px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                              {t('food.vERIFIED')}
                            </span>
                          </div>
                          <h3 className="font-display font-semibold text-xl leading-snug text-[var(--text-primary)] text-balance">
                            {language === 'ar' ? option.titleAr : option.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                            {language === 'ar' ? option.descriptionAr : option.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs font-semibold text-[var(--text-secondary)]">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" aria-hidden="true" />
                              {language === 'ar' ? option.estimatedTimeAr : option.estimatedTime}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Wallet className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                              {language === 'ar' ? option.priceEstimateAr : option.priceLevel}
                            </span>
                          </div>

                          {/* Action Bar */}
                          <div className="mt-auto pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                              {t('food.leaves45MinBefore')}
                            </span>
                            <button
                              type="button"
                              id={`view-btn-${option.id}`}
                              onClick={() => handleOpenRestaurant(option)}
                              className="px-6 py-2.5 min-h-[44px] rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--surface-card)] text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>{t('food.view')}</span>
                              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </section>

              {/* D. WHY THESE OPTIONS? CONTEXTUAL EXPLANATION */}
              <section 
                id="why-these-options-box"
                className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xl space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <h3 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                    {t('food.whyTheseOptions')}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 leading-relaxed font-medium">
                  {t('food.theyreCloseToYou')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs text-[var(--text-secondary)]">
                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-bold text-[var(--accent-secondary)] block">
                      <MapPin className="w-3.5 h-3.5" /> {t('food.locationAware')}
                    </span>
                    <p className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('food.within0612KmOf')}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-bold text-[var(--accent-secondary)] block">
                      <Wallet className="w-3.5 h-3.5" /> {t('food.budgetAligned')}
                    </span>
                    <p className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('food.matchesYourModerateBudget')}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-bold text-emerald-400 block">
                      ⏱ {t('food.timeProtected')}
                    </span>
                    <p className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('food.finishesBy02000215PM')}
                    </p>
                  </div>
                </div>
              </section>

          </div>

        )}

      </main>

      {/* ============================================================ */}
      {/* RESTAURANT DETAIL MODAL / FOCUSED VIEW                       */}
      {/* ============================================================ */}
      {selectedRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-2xl w-full my-8 border border-[var(--border-subtle)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header & Hero Image */}
            <div className="relative h-48 sm:h-56 w-full bg-[var(--surface-container)] flex-shrink-0">
              {selectedRestaurant.imageUrl ? (
                <img
                  src={selectedRestaurant.imageUrl}
                  alt={selectedRestaurant.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--surface-container)] to-[var(--surface-card)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-black/40 to-black/20" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRestaurant(null);
                  setDeliveryWorkflow('none');
                }}
                aria-label={t('common.close')}
                className="absolute top-4 right-4 rtl:left-4 rtl:right-auto w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors cursor-pointer border border-[var(--border-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Badges on Image */}
              <div className="absolute top-4 left-4 rtl:right-4 rtl:left-auto flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-extrabold shadow-xs">
                  {language === 'ar' ? selectedRestaurant.badgeAr : selectedRestaurant.badge}
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/80 text-white text-xs font-bold backdrop-blur-xs border border-[var(--border-subtle)]">
                  {language === 'ar' ? selectedRestaurant.openingStatusAr : selectedRestaurant.openingStatus}
                </span>
              </div>

              {/* Title & Info on Image */}
              <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium">
                  <span>{language === 'ar' ? selectedRestaurant.cuisineAr : selectedRestaurant.cuisine}</span>
                  {typeof selectedRestaurant.rating === 'number' && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-white">{selectedRestaurant.rating}</span>
                        {typeof selectedRestaurant.reviewCount === 'number' && (
                          <span className="text-[var(--text-muted)]">({selectedRestaurant.reviewCount})</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl chart-heading font-bold text-white">
                  {language === 'ar' ? selectedRestaurant.nameAr : selectedRestaurant.name}
                </h2>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-grow text-[var(--text-secondary)]">
              
              {/* Short description */}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                {language === 'ar' ? selectedRestaurant.descriptionAr : selectedRestaurant.description}
              </p>

              {/* IMPORTANT TIMING INFORMATION (Key Highlight Requirement) */}
              <div 
                id="restaurant-timing-banner"
                className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-container)] border border-emerald-500/40 space-y-2 text-xs sm:text-sm text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t('food.importantTimingInformation')}</span>
                </div>

                <div className="space-y-1 text-xs text-[var(--text-secondary)] font-medium">
                  <p>• <strong>{t('food.youHaveAbout2')}</strong></p>
                  <p>• <strong>{t('food.estimatedMealTime', { duration: language === 'ar' ? selectedRestaurant.diningDurationAr : selectedRestaurant.diningDuration })}</strong></p>
                  <p className="text-emerald-300 font-bold">
                    ✓ {t('food.youllStillHaveEnough')}
                  </p>
                </div>
              </div>

              {/* 4 Metric Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">{t('food.distance')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{language === 'ar' ? selectedRestaurant.distanceAr : selectedRestaurant.distance}</span>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">{t('food.dineinTime')}</span>
                  <span className="font-bold text-[var(--accent-secondary)]">{language === 'ar' ? selectedRestaurant.diningDurationAr : selectedRestaurant.diningDuration}</span>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">{t('food.priceRange')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{language === 'ar' ? selectedRestaurant.priceEstimateAr : selectedRestaurant.priceLevel}</span>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 block">{t('food.deliveryEst')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{language === 'ar' ? selectedRestaurant.deliveryTimeAr : selectedRestaurant.deliveryTime}</span>
                </div>
              </div>

              {/* A venue from the destination corpus has no menu, and every one
                  of them is WALK_IN — the platform cannot take an order for
                  them. Showing an empty basket would be an offer it cannot
                  honour, so the panel says what the traveler can actually do. */}
              {selectedRestaurant.popularDishes.length === 0 && (
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <p className="font-bold text-[var(--text-primary)] text-sm">
                    {t('food.noOnlineOrderingHere')}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]/75 leading-relaxed">
                    {t('food.thisPlaceTakesWalkins')}
                  </p>
                </div>
              )}

              {/* MENU PREVIEW (Small Selection of Popular Dishes) */}
              {selectedRestaurant.popularDishes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                    {t('food.popularDishes')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFullMenuOpen(true)}
                    className="text-xs font-bold text-[var(--accent-secondary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{t('food.viewFullMenu')}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {selectedRestaurant.popularDishes.map((dish) => {
                    const qty = orderCart[dish.id] || 0;
                    return (
                      <div 
                        key={dish.id}
                        className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">
                              {language === 'ar' ? dish.nameAr : dish.name}
                            </h4>
                            <span className="text-xs font-bold text-[var(--accent-secondary)]">EGP {dish.price}</span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed">
                            {language === 'ar' ? dish.descriptionAr : dish.description}
                          </p>
                        </div>

                        {fulfillmentMode === 'delivery' && (
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(dish.id, -1)}
                              aria-label={t('a11y.decreaseQuantity')}
                              className="w-7 h-7 min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)] cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center font-bold text-xs text-[var(--accent-secondary)]">{qty}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(dish.id, 1)}
                              aria-label={t('a11y.increaseQuantity')}
                              className="w-7 h-7 min-w-[44px] min-h-[44px] rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] hover:bg-[var(--accent-secondary)] flex items-center justify-center text-xs font-bold cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {/* ORDER OPTIONS: "Eat here" vs "Delivery" */}
              {selectedRestaurant.popularDishes.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                  {t('food.chooseFulfillment')}
                </span>

                <div className="grid grid-cols-2 gap-3">
                  {/* Eat Here Button Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setFulfillmentMode('eat-here');
                      setDeliveryWorkflow('none');
                    }}
                    className={`p-4 rounded-2xl text-start border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-1 ${
                      fulfillmentMode === 'eat-here'
                        ? 'border-2 border-[var(--accent-secondary)] bg-[var(--surface-container)] shadow-[0_0_15px_rgba(244,195,108,0.15)] ring-1 ring-[var(--accent-secondary)]/30'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-container)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                        <CategoryIcon kind="food" className="w-4 h-4" />
                        <span>{t('food.eatHere')}</span>
                      </span>
                      {fulfillmentMode === 'eat-here' && (
                        <Check className="w-4 h-4 text-[var(--accent-secondary)]" />
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('food.walkToRestaurant4560')}
                    </p>
                  </button>

                  {/* Delivery Button Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setFulfillmentMode('delivery');
                    }}
                    className={`p-4 rounded-2xl text-start border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-1 ${
                      fulfillmentMode === 'delivery'
                        ? 'border-2 border-[var(--accent-secondary)] bg-[var(--surface-container)] shadow-[0_0_15px_rgba(244,195,108,0.15)] ring-1 ring-[var(--accent-secondary)]/30'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-container)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                        <Bike aria-hidden="true" className="w-4 h-4 text-[var(--accent-secondary)]" />
                        <span>{t('food.delivery')}</span>
                      </span>
                      {fulfillmentMode === 'delivery' && (
                        <Check className="w-4 h-4 text-[var(--accent-secondary)]" />
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('food.deliveredToYourSpot')}
                    </p>
                  </button>
                </div>

                {/* Specific Fulfillment Explanation & Primary Action */}
                {fulfillmentMode === 'eat-here' ? (
                  <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
                    <div className="space-y-1 text-xs">
                      <span className="font-bold text-emerald-300 block text-sm">
                        {t('food.goodChoiceForYour')}
                      </span>
                      <p className="text-[var(--text-secondary)]">
                        {t('food.diningTimeDistance', {
                          duration: language === 'ar' ? selectedRestaurant.diningDurationAr : selectedRestaurant.diningDuration,
                          distance: language === 'ar' ? selectedRestaurant.distanceAr : selectedRestaurant.distance,
                        })}
                      </p>
                      <p className="text-[var(--text-secondary)]/70">
                        {t('food.leavesOverAnHour')}
                      </p>
                    </div>

                    <button
                      type="button"
                      id="add-to-my-trip-meal-btn"
                      onClick={() => {
                        handleAddEatHereToTrip(selectedRestaurant);
                        setSelectedRestaurant(null);
                      }}
                      className="w-full py-3 px-4 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('food.addToMyTrip')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
                    <div className="space-y-1 text-xs">
                      <span className="font-bold text-emerald-300 block text-sm">
                        {t('food.deliveryFitsYourSchedule')}
                      </span>
                      <p className="text-[var(--text-secondary)]">
                        {t('food.deliveryTimeTotal', {
                          deliveryTime: language === 'ar' ? selectedRestaurant.deliveryTimeAr : selectedRestaurant.deliveryTime,
                          total: calculateCartTotals(selectedRestaurant).total,
                        })}
                      </p>
                    </div>

                    <button
                      type="button"
                      id="proceed-to-delivery-btn"
                      onClick={() => {
                        setDeliveryWorkflow('confirm');
                      }}
                      className="w-full py-3 px-4 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <Bike className="w-4 h-4" />
                      <span>{t('food.orderDeliveryTotal', { total: calculateCartTotals(selectedRestaurant).total })}</span>
                    </button>
                  </div>
                )}
              </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-[var(--surface-card)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]/70">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t('food.dahabLighthouseDistrict')}</span>
              <button
                type="button"
                onClick={() => setSelectedRestaurant(null)}
                className="font-bold text-[var(--accent-secondary)] hover:underline cursor-pointer"
              >
                {t('arrival.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DELIVERY WORKFLOW: ORDER CONFIRMATION & LIVE TRACKING        */}
      {/* ============================================================ */}
      {deliveryWorkflow === 'confirm' && selectedRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-[var(--accent-secondary)]" />
                <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                  {t('food.confirmDeliveryOrder')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryWorkflow('none')}
                aria-label={t('common.close')}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order summary */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] font-bold text-[var(--accent-secondary)] block">{t('food.restaurant')}</span>
                <p className="font-bold text-sm text-[var(--text-primary)]">{language === 'ar' ? selectedRestaurant.nameAr : selectedRestaurant.name}</p>
                <p className="text-[var(--text-secondary)]/70 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t('food.deliveringToNearDahab')}</p>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                <span className="text-[11px] font-bold text-[var(--accent-secondary)] block mb-1">{t('food.selectedItems')}</span>
                {selectedRestaurant.popularDishes.map(dish => {
                  const qty = orderCart[dish.id] || 0;
                  if (qty === 0) return null;
                  return (
                    <div key={dish.id} className="flex items-center justify-between text-[var(--text-primary)]">
                      <span>{language === 'ar' ? dish.nameAr : dish.name} × {qty}</span>
                      <span className="font-bold font-mono text-[var(--accent-secondary)]">EGP {dish.price * qty}</span>
                    </div>
                  );
                })}
                <div className="border-t border-[var(--border-subtle)] pt-1.5 mt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                    <span>{t('food.subtotal')}</span>
                    <span className="font-mono">EGP {calculateCartTotals(selectedRestaurant).subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                    <span>{t('food.deliveryFee')}</span>
                    <span className="font-mono">EGP {calculateCartTotals(selectedRestaurant).deliveryFee}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-primary)] font-bold text-sm pt-1 border-t border-[var(--border-subtle)]">
                    <span>{t('food.estimatedTotal')}</span>
                    <span className="text-[var(--accent-secondary)] font-mono">EGP {calculateCartTotals(selectedRestaurant).total}</span>
                  </div>
                </div>
              </div>

              {/* Timing assurance */}
              <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>⏱ {t('food.estimatedDeliveryTime')}</span>
                  <span className="font-mono">{selectedRestaurant.deliveryTime}</span>
                </div>
                <p className="text-[12px] text-emerald-300/80">
                  {t('food.willArriveAround0145')}
                </p>
              </div>
            </div>

            {/* Place Order CTA */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                id="place-delivery-order-btn"
                onClick={handlePlaceDeliveryOrder}
                className="w-full py-3 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-xs shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{t('food.placeOrderTotal', { total: calculateCartTotals(selectedRestaurant).total })}</span>
              </button>

              <p className="text-[11px] text-center text-[var(--text-secondary)]/60">
                {t('food.paymentChargedToRoom')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY LIVE TRACKING MODAL (Inside the trip experience) */}
      {deliveryWorkflow === 'tracking' && selectedRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-[var(--accent-secondary)]" />
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                    {t('food.activeDelivery')}
                  </span>
                  <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                    {language === 'ar' ? selectedRestaurant.nameAr : selectedRestaurant.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryWorkflow('none')}
                aria-label={t('common.close')}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Step Visual Progression */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className={deliveryStatus === 'preparing' ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-secondary)]/50'}>
                  1. {t('food.preparing')}
                </span>
                <span className={deliveryStatus === 'picked_up' ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-secondary)]/50'}>
                  2. {t('food.pickedUp')}
                </span>
                <span className={deliveryStatus === 'on_the_way' ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-secondary)]/50'}>
                  3. {t('food.onTheWay')}
                </span>
                <span className={deliveryStatus === 'delivered' ? 'text-emerald-400' : 'text-[var(--text-secondary)]/50'}>
                  4. {t('food.delivered')}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-[var(--surface-container)] overflow-hidden flex border border-[var(--border-subtle)]">
                <div 
                  className="h-full bg-[var(--accent-secondary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 rounded-full shadow-[0_0_10px_rgba(244,195,108,0.5)]"
                  style={{
                    width: 
                      deliveryStatus === 'preparing' ? '25%' :
                      deliveryStatus === 'picked_up' ? '50%' :
                      deliveryStatus === 'on_the_way' ? '75%' : '100%'
                  }}
                />
              </div>

              {/* Status advances from the SERVER (POST /api/dining/orders/:id/status,
                  Operations only). The shipped "simulate status" buttons are gone:
                  a progress bar a traveler could drive themselves was a demo
                  wearing a product's clothes, and the real kitchen state now has
                  a real surface in DiningOrderTracking. */}
            </div>

            {/* DELIVERY STATUS CONTEXT & SCHEDULE COORDINATION */}
            <div className="space-y-3 text-xs">
              
              {/* Next activity reminder */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[var(--text-secondary)]/60 font-bold block">{t('food.nextActivity-2')}</span>
                  <span className="font-bold text-sm text-[var(--text-primary)]">{t('food.0300PMDesertQuad')}</span>
                </div>
                <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">{t('food.in1h45m')}</span>
              </div>

              {/* On Track status */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between text-emerald-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold">{t('food.youreOnTrack')}</span>
                </div>
                <span className="text-xs text-emerald-300/80 font-mono">{t('food.estArrival0140PM')}</span>
              </div>
            </div>

            {/* Back to Trip CTA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeliveryWorkflow('none');
                  onBackToCompanion ? onBackToCompanion() : onBackToMyTrip();
                }}
                className="w-full py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border border-[var(--border-subtle)]"
              >
                {t('food.returnToDailyCompanion')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL MENU PREVIEW MODAL */}
      {isFullMenuOpen && selectedRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div>
                <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                  {t('food.fullMenu')}
                </span>
                <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                  {language === 'ar' ? selectedRestaurant.nameAr : selectedRestaurant.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFullMenuOpen(false)}
                aria-label={t('common.close')}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 text-xs flex-grow pr-1">
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--accent-secondary)]">{t('food.mainsSpecialties')}</span>
                {selectedRestaurant.popularDishes.map((dish) => (
                  <div key={dish.id} className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{language === 'ar' ? dish.nameAr : dish.name}</h4>
                      <p className="text-[var(--text-secondary)]/70">{language === 'ar' ? dish.descriptionAr : dish.description}</p>
                    </div>
                    <span className="font-bold font-mono text-[var(--accent-secondary)]">EGP {dish.price}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--accent-secondary)]">{t('food.sideMezzeStarters')}</span>
                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{t('food.tahiniDipHotPita')}</h4>
                    <p className="text-[var(--text-secondary)]/70">{t('food.stonegroundSesameTahiniWith')}</p>
                  </div>
                  <span className="font-bold font-mono text-[var(--accent-secondary)]">EGP 60</span>
                </div>
                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{t('food.friedCalamariRings')}</h4>
                    <p className="text-[var(--text-secondary)]/70">{t('food.redSeaSquidTossed')}</p>
                  </div>
                  <span className="font-bold font-mono text-[var(--accent-secondary)]">EGP 190</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsFullMenuOpen(false)}
                className="w-full py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-xs transition-colors cursor-pointer"
              >
                {t('food.backToRestaurantDetails')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--accent-secondary)]/40 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};

export const FoodNowView: React.FC<FoodNowViewProps> = (props) => {
  const { destination } = useDestination();
  if (destination.catalogue === 'early') return <EarlyRestaurantsBrowse />;
  return <LiveFoodNowView {...props} />;
};
