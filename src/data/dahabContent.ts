import { CategoryItem, HowItWorksStep, DayPlanItem, TravelerProfile } from '../types';
import { IMG_P1507525428034b723cf961d3e_HERO, IMG_P1509316975850ff9c5deb0cd9_HERO, IMG_P15172481354674c7edcad34c4_HERO, IMG_P1534447677768be436bb09401_HERO, IMG_P154455176346a013bb70d5_HERO } from '../shared/placeholderImagery';

export const ANONYMOUS_PROFILE: TravelerProfile = {
  name: '',
  email: '',
  phone: '',
  lengthDays: 5,
  travelersCount: 2,
  budget: 'Moderate',
  interests: ['Diving', 'Adventure', 'Food'],
  pace: 'Balanced',
  pastTripsCount: 0,
};

export const DEMO_AHMED_PROFILE: TravelerProfile = {
  name: 'Ahmed',
  email: 'ahmed.traveler@example.com',
  phone: '+20 100 234 5678',
  lengthDays: 5,
  travelersCount: 2,
  budget: 'Moderate',
  interests: ['Diving', 'Adventure', 'Food'],
  pace: 'Balanced',
};

// Aliased for explicit test simulation use only
export const AHMED_PROFILE = DEMO_AHMED_PROFILE;

export const EXPLORE_CATEGORIES: CategoryItem[] = [
  {
    id: 'diving',
    title: 'Diving',
    titleAr: 'عالم الغطس والأعماق',
    tagline: 'Explore Dahab underwater.',
    taglineAr: 'اكتشف عالم تحت المية والشعب المرجانية الأسطورية',
    description: 'World-renowned shore dives, the iconic Blue Hole, vibrant coral labyrinths at the Canyon, and serene freediving bays.',
    descriptionAr: 'أشهر مواقع الغطس الشاطئي في العالم، مغامرة البلو هول، متاهات الكانيون المرجانية، وبقاع الغوص الحر الهادية.',
    image: 'IMG_P154455176346a013bb70d5_HERO',
    highlights: ['Blue Hole & The Arch', 'The Canyon', 'Eel Garden Reef', 'Lighthouse Shore Dive'],
    highlightsAr: ['البلو هول وحيد الشعب', 'كانيون دهب الكهفي', 'محمية إيل جاردن', 'شاطئ اللايتهاوس'],
  },
  {
    id: 'adventure',
    title: 'Adventure',
    titleAr: 'المغامرة والوديان',
    tagline: 'Desert, mountains, and open roads.',
    taglineAr: 'جبال شاهقة، كانيونز ملونة، ودروب الصحراء الواسعة',
    description: 'Climb the rugged Sinai mountain trails, canyon trekking through Wadi Gnai, starlit Bedouin nights, and quad safaris through ancient valleys.',
    descriptionAr: 'مسارات المشي وتسلق صخور سيناء، عبور كانيون وادي قني، سهرات عشاء بدوي تحت النجوم، وسفاري البيتش باجي في الوديان.',
    image: 'IMG_P1509316975850ff9c5deb0cd9_HERO',
    highlights: ['Wadi Gnai Bouldering', 'Colored Canyon Trek', 'Mount Sinai Sunrise', 'Desert Quad Trails'],
    highlightsAr: ['تسلق وادي قني', 'الكانيون الملون', 'شروق جبل موسى', 'سفاري البيتش باجي'],
  },
  {
    id: 'beach',
    title: 'Beach & Coastal Chill',
    titleAr: 'شواطئ وفصلان ع البحر',
    tagline: 'Slow down by the sea.',
    taglineAr: 'افصل وريح دماغك مع نسيم البحر الأحمر الهادي',
    description: 'Unwind along quiet pebble shores, swim in crystalline shallow lagoons, catch calm morning breezes, and read under shaded thatched palapas.',
    descriptionAr: 'استجمام في شواطئ دهب الهادية، عوم في مياه البلو لاجون الفيروزية، قعدة شلتات مظللة وقراءة كتاب على البحر مع نسيم الصبح.',
    image: 'IMG_P1507525428034b723cf961d3e_HERO',
    highlights: ['Blue Lagoon Hammocks', 'Lighthouse Bay Promenade', 'Laguna Kite Beach', 'Secret Cove Relax'],
    highlightsAr: ['شلتات البلو لاجون', 'ممشى خليج اللايتهاوس', 'لاجونا الكايت سيرف', 'خلجان الاسترخاء الهادية'],
  },
  {
    id: 'food',
    title: 'Food & Cafés',
    titleAr: 'أكل ومطاعم وكافيهات',
    tagline: 'Discover local flavors and cafés.',
    taglineAr: 'سمك البحر الأحمر الطازة، مخابز مميزة، وشاي الحبق البدوي',
    description: 'Fresh grilled Red Sea catch, traditional Bedouin flatbreads baked on open fire, artisan specialty coffee, and open-air seaside terraces.',
    descriptionAr: 'صيد اليوم المشوي ع الفحم مباشرة، العيش البدوي المخبوز ع الحطب، سبشيلتي كوفي طازة، وقعدات أكل بحرية مفتوحة ع الممشى.',
    image: 'IMG_P15172481354674c7edcad34c4_HERO',
    highlights: ['Bedouin Seafood BBQ', 'Artisan Bakery Courtyards', 'Seaside Mezzes & Tea', 'Sun-drenched Smoothie Cafés'],
    highlightsAr: ['مشاوي سمك ع البحر', 'مخابز كافيهات فريش', 'مقبلات وشاي بالحبق', 'عصاير وسموذي طبيعي'],
  },
  {
    id: 'local-life',
    title: 'Local Life & Soul',
    titleAr: 'حياة وروح دهب وأهلها',
    tagline: 'Experience Dahab beyond the usual tourist spots.',
    taglineAr: 'عيش تفاصيل دهب الحقيقية بروقان وبساطة',
    description: 'Wander through Assalah market, meet local artisans and craftspeople, listen to acoustic oud melodies by the shore, and embrace the unhurried Sinai rhythm.',
    descriptionAr: 'تمشية في سوق العصلة، لقاء الحرفيين وصناع الفخار والفضة البدوية، دندنة العود ع الشط وقت الغروب، وعيش ريتم دهب اللي مفيش فيه أي استعجال.',
    image: 'IMG_P1534447677768be436bb09401_HERO',
    highlights: ['Assalah Artisan Market', 'Bedouin Herb & Tea Gathering', 'Acoustic Sunset Circles', 'Local Pottery & Weaving'],
    highlightsAr: ['سوق العصلة التراثي', 'قعدة أعشاب وشاي بدوي', 'دوائر عزف العود والغروب', 'فخار ونسيج يدوي سيناوي'],
  },
];

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    number: '01',
    title: 'Tell us what you want',
    description: 'Share your dates, budget, interests, and travel style.',
    subtext: 'Whether you want non-stop dives or quiet seaside afternoons, start with what matters to you.',
    iconName: 'Compass',
  },
  {
    number: '02',
    title: 'Build your trip',
    description: 'Get a trip shaped around the way you want to experience Dahab.',
    subtext: 'A cohesive schedule linking boutique stays, trusted guides, gear rental, and authentic meals.',
    iconName: 'Sparkles',
  },
  {
    number: '03',
    title: 'Enjoy the journey',
    description: 'Keep your trip organized and get help when you need it.',
    subtext: 'One clear itinerary in your pocket with local tips, timing cues, and seamless support.',
    iconName: 'MapPin',
  },
];

export const TRIP_PREVIEW_DAYS: DayPlanItem[] = [
  {
    day: 1,
    title: 'Arrival · Hotel · Dinner',
    subtitle: 'Check into boutique seafront eco-lodge, coastal stroll along the promenade, and fresh Bedouin fish dinner by the water.',
    highlights: ['Scenic transfer from Sharm/Tabah', 'Promenade sunset stroll', 'Authentic catch of the day by torchlight'],
    tag: 'Arrival & Settle In',
    timeEstimate: 'Afternoon & Evening',
  },
  {
    day: 2,
    title: 'Diving · Lunch · Free Time',
    subtitle: 'Morning 2-tank guided shore dive at The Canyon & Lighthouse Reef, seaside hummus lunch, and relaxed afternoon coffee.',
    highlights: ['2-tank coral reef dive with master guide', 'Fresh herb falafel & iced tea', 'Relaxed barefoot exploration'],
    tag: 'Underwater Day',
    timeEstimate: 'Full Morning + Open Afternoon',
  },
  {
    day: 3,
    title: 'Safari · Local Experience',
    subtitle: 'Afternoon 4x4 desert valley drive into Wadi Gnai, sunset tea atop rock formations, and starlit campfire Bedouin storytelling.',
    highlights: ['4x4 Sinai desert trail', 'Granite rock canyon hike', 'Stargazing tea ritual with locals'],
    tag: 'Desert Adventure',
    timeEstimate: 'Afternoon to Starlight',
  },
  {
    day: 4,
    title: 'Beach · Boat Trip',
    subtitle: 'Boat excursion to Ras Abu Galum protected reserve and the crystal turquoise waters of the Blue Lagoon.',
    highlights: ['Coastal boat cruise along cliffs', 'Shallow lagoon swimming & wind breeze', 'Fresh baked bread on the shore'],
    tag: 'Coastal Escape',
    timeEstimate: 'Full Day',
  },
  {
    day: 5,
    title: 'Checkout · Departure',
    subtitle: 'Slow morning café breakfast overlooking the Gulf of Aqaba, picking up local Sinai dates and herbs before departure.',
    highlights: ['Sunrise yoga or swim', 'Artisan café brunch', 'Comfortable onward airport transfer'],
    tag: 'Smooth Farewell',
    timeEstimate: 'Morning Departure',
  },
];
