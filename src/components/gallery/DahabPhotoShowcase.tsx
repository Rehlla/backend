import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  Compass,
  Waves,
  Mountain,
  Palmtree,
  Coffee,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../context/TripContext';
import { useApiResource } from '../../hooks/useApiResource';
import { api } from '../../services/api';
import type { CmsHomepageSection } from '../../services/api';

export interface DahabPhotoItem {
  id: string;
  title: string;
  titleAr: string;
  category: 'diving' | 'desert' | 'boho' | 'beach' | 'hotel';
  location: string;
  locationAr: string;
  image: string;
  tag: string;
  tagAr: string;
  highlight: string;
  highlightAr: string;
  bestTime?: string;
  bestTimeAr?: string;
  specs?: string;
  specsAr?: string;
}

const DAHAB_PHOTOS: DahabPhotoItem[] = [
  {
    id: 'camels-beach',
    title: 'Bedouin Camels by the Red Sea',
    titleAr: 'جمال البدو على شاطئ البحر الأحمر',
    category: 'boho',
    location: 'Lighthouse Coastal Strip',
    locationAr: 'ساحل ممشى اللايتهاوس',
    image: '/images/hero/camels-beach.jpg',
    tag: 'Sinai Soul',
    tagAr: 'أصالة سيناء',
    highlight: 'Pure white camels resting with traditional woven Bedouin saddle blankets and desert kaffiyehs.',
    highlightAr: 'جمال بيضاء مزينة بالسروج البدوية المنسوجة يدوياً والكوفيات التراثية على رمال شاطئ دهب.',
    bestTime: 'Early morning & golden sunset',
    bestTimeAr: 'الصباح الباكر والشفق الذهبي',
    specs: 'High Resolution 4K',
    specsAr: 'دقة فائقة 4K'
  },
  {
    id: 'coral-reef-split',
    title: 'Coral Gardens & Sinai Mountain Wall',
    titleAr: 'عالم المرجان تحت الماء وجبال سيناء الشامخة',
    category: 'diving',
    location: 'Three Pools Reef',
    locationAr: 'شعاب الثري بولز',
    image: '/images/hero/coral-reef-split.jpg',
    tag: 'Split View',
    tagAr: 'لقطة شطر بانورامية',
    highlight: 'Mesmerizing split perspective capturing live anthias fish & coral reef meeting rugged desert peaks.',
    highlightAr: 'لقطة مشطورة تجمع سحر عالم الأعماق وأسماك الإنثياس المرجانية مع قمم جبال سيناء الوعرة فوق سطح الماء.',
    bestTime: '10:00 AM – 02:00 PM',
    bestTimeAr: '١٠:٠٠ ص – ٠٢:٠٠ م',
    specs: 'Depth: 2–6m Coral Crest',
    specsAr: 'عمق ٢–٦ أمتار'
  },
  {
    id: 'underwater-elephant',
    title: 'The Submarine Elephant Sculpture',
    titleAr: 'تمثال الفيل الغارق بمتحف دهب المائي',
    category: 'diving',
    location: 'Lighthouse Underwater Museum',
    locationAr: 'متحف الآثار الغارقة باللايتهاوس',
    image: '/images/attractions/underwater-elephant.jpg',
    tag: 'Art Reef',
    tagAr: 'فن الأعماق',
    highlight: 'Life-sized metal elephant artificial reef built by local artists and divers to foster marine biodiversity.',
    highlightAr: 'تحفة فنية غارقة بحجم حقيقي أبدعها غواصو وفنانو دهب لتكوين ريف صناعي تنمو حوله الشعاب والأسماك.',
    bestTime: 'Morning dives (calm currents)',
    bestTimeAr: 'الغطسات الصباحية (تيارات هادئة)',
    specs: 'Depth: 12m seabed',
    specsAr: 'العمق: ١٢ متراً'
  },
  {
    id: 'boho-cafe-dreams',
    title: 'Bohemian Seaside Lounge',
    titleAr: 'جلسة بوهيمية على الواجهة البحرية',
    category: 'boho',
    location: 'Mashraba Boardwalk',
    locationAr: 'ممشى المشربة الشاطئي',
    image: '/images/hero/boho-cafe-dreams.jpg',
    tag: 'Bohemian Vibe',
    tagAr: 'روقان دهب',
    highlight: 'Handcrafted dreamcatchers, vibrant cushions, lanterns and uninterrupted vistas of the Gulf of Aqaba.',
    highlightAr: 'صائدات الأحلام، الوسائد الملونة، والفوانيس البدوية مع إطلالة مفتوحة على زرقة خليج العقبة الهادئة.',
    bestTime: 'Sunset to midnight',
    bestTimeAr: 'من الغروب حتى منتصف الليل',
    specs: 'Seaside Dining',
    specsAr: 'جلسات شاطئية مباشرة'
  },
  {
    id: 'blue-lagoon-kitesurf',
    title: 'Blue Lagoon Turquoise Waters',
    titleAr: 'البلو لاجون ومياه البحر الفيروزية الساحرة',
    category: 'beach',
    location: 'Ras Abu Galum Protected Area',
    locationAr: 'محمية رأس أبو جالوم',
    image: '/images/hero/blue-lagoon-kitesurf.jpg',
    tag: 'Kite & Chill',
    tagAr: 'تزلج شراعي واسترخاء',
    highlight: 'Shallow crystal lagoons, continuous thermal wind, and off-grid wooden beach huts beneath towering cliffs.',
    highlightAr: 'بحيرة شاطئية ضحلة بلون فيروزي كريستالي ورياح حرارية مثالية للتزلج الشراعي والعشش البدوية البسيطة.',
    bestTime: 'Afternoon winds (12:00 – 04:00 PM)',
    bestTimeAr: 'فترة الظهيرة (١٢:٠٠ – ٠٤:٠٠ م)',
    specs: 'Off-grid Sanctuary',
    specsAr: 'ملاذ هادئ بدون كهرباء'
  },
  {
    id: 'blue-hole-divers',
    title: 'Diving the Legendary Blue Hole',
    titleAr: 'غوص الثقب الأزرق الأسطوري (البلو هول)',
    category: 'diving',
    location: 'Blue Hole & The Bells',
    locationAr: 'الثقب الأزرق وموقع البيلز',
    image: '/images/attractions/blue-hole-divers.jpg',
    tag: 'World Landmark',
    tagAr: 'معلم عالمي',
    highlight: 'World-renowned submarine sinkhole with crystal visibility, plunging vertical wall, and deep blue depths.',
    highlightAr: 'أشهر حفرة بحرية عمودية في العالم للغوص الحر والتقني بجدران مرجانية مذهلة ورؤية مائية فائقة النقاء.',
    bestTime: '08:00 AM – 11:30 AM',
    bestTimeAr: '٠٨:٠٠ ص – ١١:٣٠ ص',
    specs: 'Depth: 100m+ Wall',
    specsAr: 'العمق: ١٠٠+ متر'
  },
  {
    id: 'bouldering-wadi-gnai',
    title: 'Granite Bouldering in Wadi Gnai',
    titleAr: 'تسلق الصخور الجرانيتية في وادي قني',
    category: 'desert',
    location: 'Wadi Gnai Canyon',
    locationAr: 'كانيون وادي قني',
    image: '/images/attractions/bouldering-wadi-gnai.jpg',
    tag: 'Adventure',
    tagAr: 'مغامرة وتسلق',
    highlight: 'Natural sandstone and pink granite boulders offering world-class free climbing routes inside desert gorges.',
    highlightAr: 'صخور الجرانيت الوردي والحجر الرملي الطبيعي التي تجتذب هواة تسلق الصخور الحر من مختلف دول العالم.',
    bestTime: 'Autumn & Winter afternoons',
    bestTimeAr: 'عصاري الخريف والشتاء',
    specs: 'Over 120 Climbing Routes',
    specsAr: 'أكثر من ١٢٠ مسار تسلق'
  },
  {
    id: 'swiss-inn-beach',
    title: 'Laguna Golden Beach & Palm Cabanas',
    titleAr: 'شاطئ اللاجونا الذهبي ومظلات السعف',
    category: 'hotel',
    location: 'Swiss Inn Resort Dahab Laguna',
    locationAr: 'منتجع سويس إن لاجونا دهب',
    image: '/images/hotels/swiss-inn-resort.jpg',
    tag: 'Resort Beach',
    tagAr: 'شاطئ رملي ناعم',
    highlight: 'Pristine soft sandbar walkway flanked by Bedouin palm umbrellas and mountain panoramic backdrops.',
    highlightAr: 'ممشى رملي ذهبي فسيح مزين بمظلات النخيل البدوية وكراسي الاسترخاء مع خلفية جبال سيناء الساحرة.',
    bestTime: 'All day sunbathing & swimming',
    bestTimeAr: 'طوال اليوم للسباحة والاستجمام',
    specs: 'Private Sand Spit',
    specsAr: 'لسان رملي ناعم'
  },
  {
    id: 'dahab-paradise-pool',
    title: 'Dahab Paradise Oasis Pool',
    titleAr: 'مسبح واحة دهب بارادايس المعماري',
    category: 'hotel',
    location: 'Dahab Paradise Hotel, Assalah',
    locationAr: 'فندق دهب بارادايس، أصلة',
    image: '/images/hotels/dahab-paradise.jpg',
    tag: 'Boutique Stay',
    tagAr: 'إقامة بوتيك',
    highlight: 'Classic Bedouin-inspired stone arches, circular swimming pool and peaceful views across the northern bay.',
    highlightAr: 'طراز معماري بوهيمي بأقواس حجرية ومسبح دائري هادئ في الجزء الشمالي المطل على خليج العقبة.',
    bestTime: 'Morning swim & quiet sunsets',
    bestTimeAr: 'السباحة الصباحية وغروب هادئ',
    specs: 'Sea-facing Resort',
    specsAr: 'مطل مباشرة على البحر'
  },
  {
    id: 'gulf-sunset-silhouette',
    title: 'Gulf of Aqaba Twilight & Heron',
    titleAr: 'شفق الغروب وطائر البلشون بخليج العقبة',
    category: 'beach',
    location: 'Assalah Coastal Flats',
    locationAr: 'مسطحات ساحل أصلة الضحلة',
    image: '/images/hero/gulf-sunset.jpg',
    tag: 'Twilight Magic',
    tagAr: 'سحر الغروب',
    highlight: 'Dramatic sunset skies turning amber and deep indigo as sea herons wade through crystal shallow flats.',
    highlightAr: 'سماء الغروب البرتقالية مع طيور الشاطئ في المياه الهادئة وظلال الجبال الشامخة في الأفق.',
    bestTime: '05:00 PM – 06:15 PM',
    bestTimeAr: '٠٥:٠٠ م – ٠٦:١٥ م',
    specs: 'Pure Natural Horizon',
    specsAr: 'أفق طبيعي ساحر'
  },
  {
    id: 'ali-baba-seaside',
    title: 'Ali Baba Waterfront Dining',
    titleAr: 'مطعم علي بابا على حافة البحر',
    category: 'boho',
    location: 'Mashraba Bay Promenade',
    locationAr: 'ممشى خليج المشربة',
    image: '/images/restaurants/ali-baba-restaurant.jpg',
    tag: 'Dining & View',
    tagAr: 'طعام وإطلالة',
    highlight: 'Fresh grilled seafood served over wooden terraces hovering directly above the gentle Red Sea waves.',
    highlightAr: 'مأكولات بحرية طازجة ومشويات على تراسات خشبية تمتد فوق أمواج البحر الأحمر مباشرة.',
    bestTime: 'Lunch catch & candlelit dinners',
    bestTimeAr: 'غداء الصيد الطازج وعشاء الشموع',
    specs: 'Over-water Seating',
    specsAr: 'جلسات ممتدة فوق الماء'
  },
  {
    id: 'tropitel-pool-oasis',
    title: 'Tropitel Oasis Palm Gardens',
    titleAr: 'حدائق ومسبح تروبيتل دهب أوازيس',
    category: 'hotel',
    location: 'Tropitel Dahab Oasis, Canyon Road',
    locationAr: 'تروبيتل دهب أوازيس، طريق الكانيون',
    image: '/images/hotels/tropitel-dahab-oasis.jpg',
    tag: 'Comfort Stay',
    tagAr: 'راحة واستجمام',
    highlight: 'Expansive freshwater pool surrounded by date palms and nestled directly against the canyon foot hills.',
    highlightAr: 'مسبح فسيح تحيط به أشجار النخيل الباسقة وأحضان جبال سيناء الوردية بالقرب من مواقع الغوص الكبرى.',
    bestTime: 'Midday sun and afternoon relax',
    bestTimeAr: 'الاسترخاء الصباحي وفترة الظهيرة',
    specs: '4-Star Resort Amenities',
    specsAr: 'مرافق منتجع متكاملة'
  }
];

export const DahabPhotoShowcase: React.FC<{ cmsSection?: CmsHomepageSection | null }> = ({ cmsSection }) => {
  const { language, isRTL } = useLanguage();
  const { isDark } = useTheme();
  const { navigateTo } = useTrip();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'all' | 'diving' | 'desert' | 'boho' | 'hotel'>('all');
  const [activePhoto, setActivePhoto] = useState<DahabPhotoItem | null>(null);
  /** Homepage shows a curated taste, not the full catalog — "View All" expands
      in place rather than routing to a dedicated gallery page (none exists). */
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const CURATED_COUNT = 6;

  const filterTabs = [
    { id: 'all', label: 'All Photos', labelAr: 'كل الصور', icon: Camera },
    { id: 'diving', label: 'Diving & Reefs', labelAr: 'الغوص والشعاب', icon: Waves },
    { id: 'desert', label: 'Desert & Mountains', labelAr: 'الصحراء والجبال', icon: Mountain },
    { id: 'boho', label: 'Boho Vibes & Cafes', labelAr: 'الحياة البوهيمية', icon: Coffee },
    { id: 'hotel', label: 'Stays & Resorts', labelAr: 'الفنادق والإقامة', icon: Palmtree },
  ];

  // CMS gallery — mapped to DahabPhotoItem shape, with compiled fallback
  const fetchGallery = useCallback((signal: AbortSignal) => api.getCmsGallery(signal), []);
  const remoteGallery = useApiResource(fetchGallery);
  const cmsPhotos: DahabPhotoItem[] = useMemo(() => {
    const pages = remoteGallery.data?.photos;
    if (!Array.isArray(pages) || pages.length === 0) return [];
    return pages.map((p: any) => ({
      id: p.slug || p.id,
      title: p.title_en || p.title || '',
      titleAr: p.title_ar || '',
      category: 'diving' as const,
      location: p.subtitle_en || '',
      locationAr: p.subtitle_ar || '',
      image: p.hero_image_url || '',
      tag: p.description_en?.split('\n')[0] || '',
      tagAr: p.description_ar?.split('\n')[0] || '',
      highlight: p.body_en || '',
      highlightAr: p.body_ar || '',
    }));
  }, [remoteGallery.data]);
  const photos = cmsPhotos.length > 0 ? cmsPhotos : DAHAB_PHOTOS;

  const filteredPhotos = useMemo(() => {
    if (activeTab === 'all') return photos;
    if (activeTab === 'hotel') return photos.filter(p => p.category === 'hotel' || p.category === 'beach');
    return photos.filter(p => p.category === activeTab);
  }, [activeTab, photos]);

  // Lightbox keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activePhoto) return;
      if (e.key === 'Escape') setActivePhoto(null);
      if (e.key === 'ArrowRight') {
        const idx = filteredPhotos.findIndex(p => p.id === activePhoto.id);
        const nextIdx = (idx + 1) % filteredPhotos.length;
        setActivePhoto(filteredPhotos[nextIdx]);
      }
      if (e.key === 'ArrowLeft') {
        const idx = filteredPhotos.findIndex(p => p.id === activePhoto.id);
        const prevIdx = (idx - 1 + filteredPhotos.length) % filteredPhotos.length;
        setActivePhoto(filteredPhotos[prevIdx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhoto, filteredPhotos]);

  const handleNextPhoto = useCallback(() => {
    if (!activePhoto) return;
    const idx = filteredPhotos.findIndex(p => p.id === activePhoto.id);
    const nextIdx = (idx + 1) % filteredPhotos.length;
    setActivePhoto(filteredPhotos[nextIdx]);
  }, [activePhoto, filteredPhotos]);

  const handlePrevPhoto = useCallback(() => {
    if (!activePhoto) return;
    const idx = filteredPhotos.findIndex(p => p.id === activePhoto.id);
    const prevIdx = (idx - 1 + filteredPhotos.length) % filteredPhotos.length;
    setActivePhoto(filteredPhotos[prevIdx]);
  }, [activePhoto, filteredPhotos]);

  // CMS visibility flag: hide the showcase from the dashboard (Homepage tab).
  // Checked after all hooks so hook order never varies with data.
  if (cmsSection && cmsSection.visible === 0) return null;

  return (
    <section
      id="dahab-gallery-showcase"
      aria-label={isAr ? 'معرض صور دهب الحقيقية' : 'Real Dahab Photography Showcase'}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 transition-colors duration-300"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <span className="text-[11px] font-extrabold text-[var(--accent-primary)]">
              {isAr ? 'عدسات حقيقية · من قلب دهب' : 'Authentic Imagery · The Soul of Dahab'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl chart-heading font-bold tracking-tight text-[var(--text-primary)]">
            {isAr ? 'روح دهب في صور حقيقية' : 'Experience Dahab as it Truly Is'}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            {isAr
              ? 'مجموعة مختارة من الصور الفوتوغرافية الحقيقية توثق ألوان الشاطئ، جمال البدو، روائع الغوص، وأجواء المقاهي البوهيمية.'
              : 'Curated real photography documenting golden shores, Bedouin culture, underwater wonders, and bohemian seaside moments.'}
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {filterTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id as any); setShowAllPhotos(false); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-md shadow-[var(--accent-primary)]/20 scale-105'
                    : isDark
                      ? 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]'
                      : 'bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{isAr ? tab.labelAr : tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modern Dynamic Photography Grid — curated to a handful by default;
          the homepage is a discovery entry point, not the full catalog. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(showAllPhotos ? filteredPhotos : filteredPhotos.slice(0, CURATED_COUNT)).map((photo, index) => (
          <div
            key={photo.id}
            onClick={() => setActivePhoto(photo)}
            className={`group relative rounded-3xl overflow-hidden cursor-pointer border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500 hover:-translate-y-1.5 hover:shadow-2xl aurora-hover ${
              isDark
                ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
            }`}
          >
            {/* Image Container with Zoom Effect */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-container)]">
              <img
                src={photo.image}
                alt={isAr ? photo.titleAr : photo.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
              />
              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

              {/* Top Meta Badges */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-black/40 backdrop-blur-md text-white border border-white/20">
                  {isAr ? photo.tagAr : photo.tag}
                </span>
                <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Maximize2 className="w-4 h-4" />
                </span>
              </div>

              {/* Bottom Caption Overlay */}
              <div className="absolute bottom-3 inset-x-4 text-white">
                <div className="flex items-center gap-1.5 text-[11px] text-white/80 font-medium mb-1">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  <span>{isAr ? photo.locationAr : photo.location}</span>
                </div>
                <h3 className="chart-heading font-bold text-lg sm:text-xl leading-snug drop-shadow-sm line-clamp-1">
                  {isAr ? photo.titleAr : photo.title}
                </h3>
              </div>
            </div>

            {/* Micro Details Footer */}
            <div className="p-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="line-clamp-1 font-normal text-[11px]">
                {isAr ? photo.specsAr : photo.specs}
              </span>
              <span className="font-bold text-[var(--accent-primary)] flex items-center gap-1 group-hover:underline">
                {isAr ? 'عرض بدقة كاملة' : 'View Full Image'}
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {!showAllPhotos && filteredPhotos.length > CURATED_COUNT && (
        <div className="flex justify-center mt-8">
          <button
            type="button"
            onClick={() => setShowAllPhotos(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-colors cursor-pointer"
          >
            <span>{isAr ? `عرض كل الصور (${filteredPhotos.length})` : `View all photos (${filteredPhotos.length})`}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* Fullscreen Interactive Lightbox Modal */}
      {activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-xl p-3 sm:p-6 transition-[background-color,border-color,color,box-shadow,transform,opacity]"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setActivePhoto(null)}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-105 border border-white/20"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={handlePrevPhoto}
            aria-label={isAr ? 'الصورة السابقة' : 'Previous Photo'}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-110"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={handleNextPhoto}
            aria-label={isAr ? 'الصورة التالية' : 'Next Photo'}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-110"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Main Lightbox Content */}
          <div className="max-w-5xl w-full max-h-[92vh] flex flex-col items-center justify-center relative">
            {/* The Image */}
            <div className="relative max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
              <img
                src={activePhoto.image}
                alt={isAr ? activePhoto.titleAr : activePhoto.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl"
              />
            </div>

            {/* Description & Action Bar */}
            <div className="w-full mt-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 text-white border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] font-extrabold">
                    {isAr ? activePhoto.tagAr : activePhoto.tag}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-amber-300">
                    <MapPin className="w-3.5 h-3.5" />
                    {isAr ? activePhoto.locationAr : activePhoto.location}
                  </span>
                  {activePhoto.specs && (
                    <span className="text-xs text-white/60">· {isAr ? activePhoto.specsAr : activePhoto.specs}</span>
                  )}
                </div>
                <h4 className="chart-heading font-bold text-lg sm:text-xl text-white">
                  {isAr ? activePhoto.titleAr : activePhoto.title}
                </h4>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                  {isAr ? activePhoto.highlightAr : activePhoto.highlight}
                </p>
              </div>

              {/* Action: Plan Visit Button */}
              <button
                type="button"
                onClick={() => {
                  setActivePhoto(null);
                  navigateTo('/trip-builder');
                }}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--accent-secondary)] to-[var(--accent-primary)] text-[var(--accent-primary-ink)] font-bold text-xs flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer whitespace-nowrap"
              >
                <Compass className="w-4 h-4" />
                <span>{isAr ? 'خطط لزيارة هذا المعلم' : 'Plan Trip to This Spot'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
