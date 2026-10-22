import { IMG_P1469854523086cc02fe5d8800_800, IMG_P1509316975850ff9c5deb0cd9_CARD, IMG_P15187092688054e9042af9f23_800, IMG_P1520250497591112f2f40a3f4_CARD, IMG_P1520250497591112f2f40a3f4_HERO, IMG_P15334733593310135ef1b58bf_800, IMG_P15405557004784be289fbecef_800, IMG_P154455176346a013bb70d5_CARD, IMG_P15493995427e3f8b79c341_800, IMG_P15660737712596a8506099945_HERO, IMG_P1570125909232eb263c188f7e_800, IMG_P157189634984233c89424de2d_800, IMG_P1578683010236d716f9a3f461_800, IMG_P1582719508461905c673771fd_800, IMG_P15832122924541fe6229603b7_800, IMG_P158413296733410e028bd69f7_HERO, IMG_P1590490360182c33d57733427_800, IMG_P1618773928121c32242e63f39_800, IMG_P16826872200634742bd7fd538_CARD } from '../../shared/placeholderImagery';
export interface HotelOption {
  id: string;
  name: string;
  nameAr?: string;
  location: string;
  locationAr?: string;
  neighborhood: string;
  neighborhoodAr?: string;
  description: string;
  descriptionAr?: string;
  detailedDescription: string;
  detailedDescriptionAr?: string;
  image: string;
  galleryImages: string[];
  /**
   * Only where measured — which is nowhere. These were required and every
   * hotel carried an invented 4.5–4.8 with 129–210 reviews, shown beside a
   * star and used to power a "sort by rating" control.
   */
  rating?: number;
  reviewCount?: number;
  isRecommended?: boolean;
  recommendationReason?: string;
  recommendationReasonAr?: string;
  amenities: string[];
  amenitiesAr?: string[];
  roomType: string;
  roomTypeAr?: string;
  roomSize: string;
  bedConfig: string;
  bedConfigAr?: string;
  priceTotalEGP: number;
  pricePerNightEGP: number;
  availabilityStatus: string;
  availabilityStatusAr?: string;
  cancellationPolicy: string;
  cancellationPolicyAr?: string;
  includedItems: string[];
  includedItemsAr?: string[];
  distanceToDiving: string;
  distanceToDivingAr?: string;
  distanceToCoast: string;
  distanceToCoastAr?: string;
  fitForTripNotes: string[];
  fitForTripNotesAr?: string[];
}

export type HotelSortOption = 'recommended' | 'price';

export const CURATED_HOTELS: HotelOption[] = [
  {
    id: 'dahab-bay-hotel',
    name: 'Dahab Bay Hotel',
    nameAr: 'فندق دهب باي',
    location: 'Lighthouse Area, Dahab',
    locationAr: 'منطقة اللايتهاوس، دهب',
    neighborhood: 'Lighthouse',
    neighborhoodAr: 'اللايتهاوس',
    isRecommended: true,
    recommendationReason: 'Best match for your budget, diving plans, and location.',
    recommendationReasonAr: 'الأنسب لميزانيتك وموقع الغطس والراحة.',
    description: 'A comfortable stay close to the sea, cafés, and diving spots.',
    descriptionAr: 'إقامة مريحة قريبة من البحر والكافيهات ومراكز الغطس.',
    detailedDescription:
      'Situated right along the peaceful Lighthouse stretch, Dahab Bay Hotel balances effortless shoreline proximity with relaxed comfort. Just a 2-minute stroll from key diving meeting points and open beachfront cafés, it features bright air-conditioned rooms, a fresh sea-breeze courtyard pool, and daily hearty breakfasts suited for active mornings.',
    detailedDescriptionAr:
      'يقع الفندق على ممشى اللايتهاوس الهادئ، ويجمع بين القرب المباشر من البحر والراحة التامة. دقيقتان فقط مشياً عن مراكز الغطس وكافيهات الشاطئ، ويتميز بغرف مكيفة ومشرقة وحمام سباحة في فناء داخلي مع إفطار صباحي مميز.',
    image: IMG_P15660737712596a8506099945_HERO,
    galleryImages: [
      IMG_P15660737712596a8506099945_HERO,
      IMG_P1582719508461905c673771fd_800,
      IMG_P1590490360182c33d57733427_800,
      IMG_P1520250497591112f2f40a3f4_CARD,
    ],
    amenities: ['Wi-Fi', 'Breakfast', 'Pool', 'AC', 'Dive Locker & Rinse Station', 'Sea View Terrace'],
    amenitiesAr: ['واي فاي', 'إفطار مجاني', 'حمام سباحة', 'تكييف', 'مكان مخصص لمعدات الغطس', 'تراس بإطلالة بحرية'],
    roomType: 'Standard Double Room',
    roomTypeAr: 'غرفة مزدوجة قياسية',
    roomSize: '28 m²',
    bedConfig: '1 Queen Bed or 2 Twin Beds',
    bedConfigAr: 'سرير كوين كبير أو سريرين فرديين',
    priceTotalEGP: 7500,
    pricePerNightEGP: 1500,
    availabilityStatus: 'Available for your 5-day trip',
    availabilityStatusAr: 'متاح لرحلتك لمدة ٥ أيام',
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in',
    cancellationPolicyAr: 'إلغاء مجاني حتى ٤٨ ساعة قبل تسجيل الوصول',
    includedItems: [
      'Daily breakfast buffet included',
      'High-speed Wi-Fi across all rooms & terrace',
      'Free secure dive gear storage & rinse tank access',
      'Complimentary Bedouin tea upon check-in',
      'All local taxes & service fees included',
    ],
    includedItemsAr: [
      'بوفيه إفطار يومي متضمن',
      'إنترنت واي فاي فائق السرعة في الغرف والتراس',
      'حفظ وتجفيف مجاني لمعدات الغطس',
      'شاي بدوي ترحيبي عند الوصول',
      'شامل جميع الضرائب ورسوم الخدمة المحلية',
    ],
    distanceToDiving: '2 min walk to Lighthouse reef & dive clubs',
    distanceToDivingAr: 'دقيقتان مشياً لشعاب ومراكز غطس اللايتهاوس',
    distanceToCoast: '50m from Lighthouse promenade',
    distanceToCoastAr: '٥٠ متراً عن ممشى اللايتهاوس',
    fitForTripNotes: [
      'Aligned with Moderate budget allocation (EGP 1,500/night for 2 guests)',
      'Direct walking distance to Day 2 diving briefing & morning departures',
      'Calm night atmosphere suitable for balanced recovery between safari & dives',
    ],
    fitForTripNotesAr: [
      'متوافق مع ميزانية الرحلة المتوازنة (١٥٠٠ جنيه لليلة لفردين)',
      'على بعد مسافة مشي مباشرة لنقطة انطلاق غطسة اليوم الثاني',
      'أجواء ليلية هادئة ومريحة للاستجمام بعد الغطس والسفاري',
    ],
  },
  {
    id: 'eel-garden-coral-lodge',
    name: 'Eel Garden Coral Lodge',
    nameAr: 'إيل جاردن كورال لودج',
    location: 'Eel Garden, North Dahab',
    locationAr: 'إيل جاردن، شمال دهب',
    neighborhood: 'Eel Garden',
    neighborhoodAr: 'إيل جاردن',
    isRecommended: false,
    description: 'A boutique beachfront lodge facing the vibrant coral reef with Sinai sunset views.',
    descriptionAr: 'لودج بوتيكي راقي على الشاطئ مباشرة أمام الشعاب المرجانية مع إطلالة الغروب.',
    detailedDescription:
      'Nestled on the gentle shore of Eel Garden, this boutique coastal lodge combines handcrafted Sinai wood architecture with direct lagoon access. Ideal for travelers wanting private balcony sea views, calm evenings slightly north of the bustling strip, and fresh espresso bar breakfasts overlooking the reef.',
    detailedDescriptionAr:
      'يقع على شاطئ إيل جاردن الخلاب بتصميم خشبي سيناوي مميز مع مدخل مباشر للبحر. مثالي لمن يبحث عن شرفة خاصة بإطلالة بحرية وأمسيات هادئة وإفطار رائع أمام الشعاب المرجانية.',
    image: IMG_P1520250497591112f2f40a3f4_HERO,
    galleryImages: [
      IMG_P1520250497591112f2f40a3f4_HERO,
      IMG_P1578683010236d716f9a3f461_800,
      IMG_P15405557004784be289fbecef_800,
      IMG_P1582719508461905c673771fd_800,
    ],
    amenities: ['Wi-Fi', 'Seafront Breakfast', 'Coral Reef Access', 'AC', 'Private Balcony', 'Eco-Certified'],
    amenitiesAr: ['واي فاي', 'إفطار أمام البحر', 'دخول مباشر للشعاب', 'تكييف', 'شرفة خاصة', 'صديق للبيئة'],
    roomType: 'Deluxe Sea View Double Room',
    roomTypeAr: 'غرفة ديلوكس مزدوجة بإطلالة على البحر',
    roomSize: '34 m²',
    bedConfig: '1 King Bed or 2 Twin Beds + Daybed',
    bedConfigAr: 'سرير كينج أو سريرين فرديين + سرير نهاري',
    priceTotalEGP: 10500,
    pricePerNightEGP: 2100,
    availabilityStatus: '2 rooms remaining for your dates',
    availabilityStatusAr: 'متبقي غرفتان فقط لمواعيد رحلتك',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in',
    cancellationPolicyAr: 'إلغاء مجاني حتى ٧٢ ساعة قبل تسجيل الوصول',
    includedItems: [
      'A la carte seafront breakfast included',
      'Complimentary snorkeling masks & fins rental',
      'High-speed fiber-optic Wi-Fi',
      'Private sunset balcony with Red Sea horizon view',
      'All local taxes and Sinai eco-preservation fees included',
    ],
    includedItemsAr: [
      'إفطار انتقائي على البحر مباشرة',
      'تأجير مجاني لمعدات السنوركلنج والزعانف',
      'إنترنت فايبر عالي السرعة',
      'شرفة غروب خاصة بإطلالة أفق البحر الأحمر',
      'شامل الرسوم البيئية والضرائب المحلية',
    ],
    distanceToDiving: '6 min walk to Lighthouse / direct Eel Garden snorkel access',
    distanceToDivingAr: '٦ دقائق مشياً للايتهاوس / سنوركلنج مباشر في إيل جاردن',
    distanceToCoast: 'Direct beachfront on Eel Garden Reef',
    distanceToCoastAr: 'مباشرة على شاطئ شعاب إيل جاردن',
    fitForTripNotes: [
      'Elevated comfort with direct marine views',
      'Quiet setting with direct morning snorkel access before breakfast',
      'Premium upgrade within reasonable range for friends sharing',
    ],
    fitForTripNotesAr: [
      'راحة فندقية ممتازة وإطلالة بحرية مباشرة',
      'مكان هادئ يتيح السنوركلنج الصباحي قبل الإفطار مباشرة',
      'ترقية مميزة مناسبة للأصدقاء والمسافرين الباحثين عن الهدوء',
    ],
  },
  {
    id: 'sinai-bohemian-retreat',
    name: 'Sinai Bohemian Retreat',
    nameAr: 'منتجع سيناء البوهيمي',
    location: 'Mashraba / Assalah Area',
    locationAr: 'منطقة المشربة / العصلة',
    neighborhood: 'Mashraba',
    neighborhoodAr: 'المشربة',
    isRecommended: false,
    description: 'A relaxed palm garden sanctuary with an outdoor pool, Bedouin lounge, and social atmosphere.',
    descriptionAr: 'واحة نخيل هادئة مع حمام سباحة وجلسة بدوية وأجواء اجتماعية دافئة.',
    detailedDescription:
      'Surrounded by swaying date palms and authentic Bedouin floor lounges, this laid-back retreat offers great value and warm Sinai hospitality. Features clean, airy twin rooms, a refreshing central swimming pool, and a communal courtyard lounge area popular with free divers and travelers.',
    detailedDescriptionAr:
      'محاط بالنخيل والجلسات البدوية الأرضية الأصيلة، ويوفر قيمة ممتازة وضيافة سيناوية دافئة. يضم غرفاً نظيفة ومريحة، وحمام سباحة منعشاً وجلسة فناء محبوبة لدى الغواصين والمسافرين.',
    image: IMG_P158413296733410e028bd69f7_HERO,
    galleryImages: [
      IMG_P158413296733410e028bd69f7_HERO,
      IMG_P1618773928121c32242e63f39_800,
      IMG_P157189634984233c89424de2d_800,
      IMG_P1590490360182c33d57733427_800,
    ],
    amenities: ['Wi-Fi', 'Fresh Breakfast', 'Garden Pool', 'AC', 'Bedouin Lounge', 'Communal Kitchen'],
    amenitiesAr: ['واي فاي', 'إفطار طازج', 'حمام سباحة في الحديقة', 'تكييف', 'جلسة بدوية', 'مطبخ مشترك'],
    roomType: 'Garden View Twin Room',
    roomTypeAr: 'غرفة توأم بإطلالة على الحديقة',
    roomSize: '24 m²',
    bedConfig: '2 Twin Beds',
    bedConfigAr: 'سريرين فرديين منفصلين',
    priceTotalEGP: 5250,
    pricePerNightEGP: 1050,
    availabilityStatus: 'Available for your 5-day trip',
    availabilityStatusAr: 'متاح لرحلتك لمدة ٥ أيام',
    cancellationPolicy: 'Free cancellation up to 24 hours before check-in',
    cancellationPolicyAr: 'إلغاء مجاني حتى ٢٤ ساعة قبل تسجيل الوصول',
    includedItems: [
      'Fresh Egyptian style breakfast included daily',
      'High-speed Wi-Fi across courtyard & rooms',
      'Full access to swimming pool and palm garden hammocks',
      'Unlimited Bedouin herbal tea & Turkish coffee station',
      'All local service fees and taxes included',
    ],
    includedItemsAr: [
      'إفطار مصري طازج يومياً',
      'إنترنت سريع في الغرف والفناء',
      'دخول كامل لحمام السباحة وأراجيح الحديقة',
      'شاي بدوي وقهوة مجانية على مدار اليوم',
      'شامل كل الرسوم والضرائب المحلية',
    ],
    distanceToDiving: '8 min walk to Lighthouse / 4 min to Mashraba dive centers',
    distanceToDivingAr: '٨ دقائق للايتهاوس / ٤ دقائق لمراكز غطس المشربة',
    distanceToCoast: '150m walk to Mashraba beach bay',
    distanceToCoastAr: '١٥٠ متراً عن خليج شاطئ المشربة',
    fitForTripNotes: [
      'Most economical choice keeping more budget for private desert safaris & diving',
      'Convenient twin bedding ideal for friends traveling together',
      'Laid-back garden ambiance with evening campfire tea in the courtyard',
    ],
    fitForTripNotesAr: [
      'الخيار الأكثر توفيراً لترك ميزانية أكبر لرحلات السفاري والغطس',
      'أسرة منفصلة مناسبة جداً للأصدقاء المسافرين معاً',
      'أجواء حديقة ريفية مريحة مع جلسة شاي مسائية حول النار',
    ],
  },
];

export interface TransferOption {
  id: string;
  title: string;
  titleAr?: string;
  badgeLabel?: string;
  badgeLabelAr?: string;
  badgeType?: 'recommended' | 'value' | 'comfort';
  description: string;
  descriptionAr?: string;
  vehicleType: string;
  vehicleTypeAr?: string;
  capacity: string;
  capacityAr?: string;
  luggage: string;
  luggageAr?: string;
  features: string[];
  featuresAr?: string[];
  priceEGP: number;
  estimatedTime: string;
  estimatedTimeAr?: string;
  image: string;
}

export const CURATED_TRANSFERS: TransferOption[] = [
  {
    id: 'private-car',
    title: 'Private Car',
    titleAr: 'سيارة خاصة مباشرة',
    badgeLabel: 'Recommended',
    badgeLabelAr: 'الأفضل لرحلتك',
    badgeType: 'recommended',
    description: 'A direct transfer from the airport to your hotel.',
    descriptionAr: 'توصيل خاص مباشر من المطار إلى باب الفندق بدون توقف.',
    vehicleType: 'Air-conditioned modern sedan',
    vehicleTypeAr: 'سيارة سيدان حديثة ومكيفة',
    capacity: 'Suitable for 2 travelers',
    capacityAr: 'مناسبة لفردين أو أكثر',
    luggage: 'Luggage included (2 large suitcases + backpacks)',
    luggageAr: 'شامل الحقائب (حقيبتان كبيرتان + حقائب يد)',
    features: [
      'Private vehicle exclusively for your party',
      'Direct to hotel with no intermediate stops',
      'Driver waiting at arrival hall with name sign',
      'Suitable for 2 travelers with spacious seating',
      'Full luggage capacity included',
    ],
    featuresAr: [
      'سيارة خاصة لمجموعتك فقط',
      'مباشرة إلى الفندق بدون أي توقف في الطريق',
      'السائق في انتظارك بصالة الوصول بيافطة باسمك',
      'مقاعد واسعة ومريحة لفردين',
      'مساحة كافية وكاملة لجميع الحقائب',
    ],
    priceEGP: 1200,
    estimatedTime: 'Approximately 1 hour',
    estimatedTimeAr: 'حوالي ساعة واحدة',
    image: IMG_P15493995427e3f8b79c341_800,
  },
  {
    id: 'shared-transfer',
    title: 'Shared Transfer',
    titleAr: 'توصيل مشترك واقتصادي',
    badgeLabel: 'Best Value',
    badgeLabelAr: 'الأوفر في السعر',
    badgeType: 'value',
    description: 'Share the ride with other travelers heading toward Dahab.',
    descriptionAr: 'توصيل مشترك مع مسافرين آخرين متوجهين إلى دهب.',
    vehicleType: 'Air-conditioned high-roof passenger van',
    vehicleTypeAr: 'فان ركاب حديث ومكيف بسقف مرتفع',
    capacity: 'Shared with 4–6 other Dahab travelers',
    capacityAr: 'مشترك مع ٤ إلى ٦ مسافرين لدهب',
    luggage: '1 standard suitcase + carry-on per person',
    luggageAr: 'حقيبة واحدة قياسية + حقيبة يد لكل فرد',
    features: [
      'Shared modern air-conditioned vehicle',
      'Hotel drop-off directly at your accommodation',
      'Standard luggage allowance included',
      'May include 1–2 short additional hotel drop-offs',
      'Most economical choice for budget-conscious trips',
    ],
    featuresAr: [
      'مركبة حديثة ومكيفة مشتركة',
      'توصيل إلى مقر إقامتك في دهب',
      'مساحة حقائب قياسية مشمولة',
      'قد يتضمن توقفين إضافيين لإنزال مسافرين آخرين',
      'الخيار الأكثر توفيراً للميزانية',
    ],
    priceEGP: 450,
    estimatedTime: 'Approximately 1 hour 20 mins',
    estimatedTimeAr: 'حوالي ساعة و٢٠ دقيقة',
    image: IMG_P1570125909232eb263c188f7e_800,
  },
  {
    id: 'premium-suv',
    title: 'Premium SUV',
    titleAr: 'سيارة دفع رباعي فاخرة (SUV)',
    badgeLabel: 'More Comfort',
    badgeLabelAr: 'أقصى درجات الراحة',
    badgeType: 'comfort',
    description: 'A more comfortable private transfer with extra space.',
    descriptionAr: 'توصيل خاص بأعلى درجات الراحة والرحابة لمعدات الغطس والحقائب.',
    vehicleType: 'Executive 4x4 SUV / Toyota Prado',
    vehicleTypeAr: 'سيارة دفع رباعي فارهة / تويوتا برادو',
    capacity: 'Up to 3 travelers with premium legroom',
    capacityAr: 'حتى ٣ مسافرين بمساحة أرجل واسعة',
    luggage: 'Generous luggage space & dive gear friendly',
    luggageAr: 'مساحة حقائب واسعة ومثالية لمعدات الغطس',
    features: [
      'Private luxury SUV with elevated ride & tinted windows',
      'Direct hotel drop-off with priority Sinai highway routing',
      'Extra luggage space suited for heavy bags and gear',
      'Premium comfort, complimentary chilled bottled water',
      'Experienced English-speaking Sinai highway driver',
    ],
    featuresAr: [
      'سيارة دفع رباعي فخمة بزجاج معتم وعزل ممتاز',
      'توصيل مباشر للفندق مع سائق محترف على طريق سيناء',
      'مساحة رحبة جداً للأمتعة ومعدات الغطس الثقيلة',
      'مياه معدنية باردة وراحة استثنائية على الطريق',
      'سائق محترف وموثوق وخبير بطرق سيناء',
    ],
    priceEGP: 1800,
    estimatedTime: 'Approximately 55 mins',
    estimatedTimeAr: 'حوالي ٥٥ دقيقة',
    image: IMG_P15334733593310135ef1b58bf_800,
  },
];

export interface DivingOption {
  id: string;
  title: string;
  titleAr?: string;
  badgeLabel: string;
  badgeLabelAr?: string;
  badgeType: 'match' | 'adventure' | 'easy';
  description: string;
  descriptionAr?: string;
  duration: string;
  durationAr?: string;
  level: string;
  levelAr?: string;
  group: string;
  groupAr?: string;
  pricePerPersonEGP: number;
  includes: string[];
  includesAr?: string[];
  whatToBring: string[];
  whatToBringAr?: string[];
  meetingInfo: string;
  meetingInfoAr?: string;
  safetyInfo: string;
  safetyInfoAr?: string;
  cancellationPolicy: string;
  cancellationPolicyAr?: string;
  image: string;
  location: string;
  locationAr?: string;
}

export const CURATED_DIVING_OPTIONS: DivingOption[] = [
  {
    id: 'guided-diving',
    title: 'Guided Diving Experience',
    titleAr: 'غطسة إرشادية في شعاب دهب',
    badgeLabel: 'Best Match',
    badgeLabelAr: 'الأنسب لرحلتك',
    badgeType: 'match',
    description: "Explore Dahab's underwater world with a local dive guide and a small group.",
    descriptionAr: 'اكتشف عالم ما تحت الماء في دهب مع مرشد غطس محلي محترف وفي مجموعة صغيرة.',
    duration: '3–4 hours',
    durationAr: '٣ إلى ٤ ساعات',
    level: 'Beginner to Intermediate',
    levelAr: 'مبتدئ إلى متوسط',
    group: 'Small group',
    groupAr: 'مجموعة صغيرة',
    pricePerPersonEGP: 1500,
    location: 'Lighthouse Reef & Eel Garden, Dahab',
    locationAr: 'شعاب اللايتهاوس وإيل جاردن، دهب',
    includes: [
      'Professional guide',
      'Equipment',
      'Safety briefing',
      'Transfers within Dahab',
    ],
    includesAr: [
      'مرشد غطس معتمد ومحترف',
      'كامل معدات الغطس والبدلة والأسطوانات',
      'شرح أمان وتوجيه قبل النزول',
      'الانتقالات الداخلية داخل دهب',
    ],
    whatToBring: [
      'Swimwear & quick-dry towel',
      'Sunscreen (reef-safe recommended)',
      'Dive certification or digital log (if certified)',
      'Waterproof action camera (optional)',
    ],
    whatToBringAr: [
      'مايوه وفوطة سريعة الجفاف',
      'واقي شمس آمن للشعاب المرجانية',
      'شهادة أو رخصة الغطس (لو حاصل عليها)',
      'كاميرا تصوير تحت المية (اختياري)',
    ],
    meetingInfo: 'Lighthouse Beach Dive Base or direct lobby pickup from your hotel at 08:45 AM.',
    meetingInfoAr: 'مركز الغطس على شاطئ اللايتهاوس أو التوصيل من الفندق الساعة ٠٨:٤٥ صباحاً.',
    safetyInfo: 'Strict 4:1 diver-to-guide ratio. Full oxygen kit and first aid on site. Dive masters carry 10+ years of South Sinai Red Sea experience.',
    safetyInfoAr: 'نسبة ٤ غواصين لكل مرشد بحد أقصى. أسطوانة أكسجين وإسعافات أولية متوفرة دائماً وخبرة تفوق ١٠ سنوات في البحر الأحمر.',
    cancellationPolicy: 'Free cancellation or day rescheduling up to 24 hours prior to dive start.',
    cancellationPolicyAr: 'إلغاء مجاني أو تعديل الميعاد حتى ٢٤ ساعة قبل موعد الغطس.',
    image: IMG_P154455176346a013bb70d5_CARD,
  },
  {
    id: 'blue-hole-adventure',
    title: 'Blue Hole Adventure',
    titleAr: 'مغامرة البلو هول والبلز',
    badgeLabel: 'Adventure',
    badgeLabelAr: 'مغامرة واستكشاف',
    badgeType: 'adventure',
    description: "A more adventurous diving experience around one of Dahab's most famous underwater locations.",
    descriptionAr: 'تجربة غطس مثيرة وشهيرة في واحدة من أشهر وأعظم مواقع الغطس في العالم.',
    duration: '5 hours',
    durationAr: '٥ ساعات',
    level: 'Intermediate',
    levelAr: 'متوسط ومتقدم',
    group: 'Small group',
    groupAr: 'مجموعة صغيرة',
    pricePerPersonEGP: 2200,
    location: 'The Bells & Blue Hole Marine Reserve',
    locationAr: 'محمية البلو هول ومنطقة البلز',
    includes: [
      'Guide',
      'Equipment',
      'Transportation',
      'Safety briefing',
    ],
    includesAr: [
      'مرشد غطس خبير بالبلو هول',
      'جميع معدات الغطس اللازمة',
      'انتقالات بسيارة جيب 4x4',
      'إحاطة أمان وتخطيط الغطسة',
    ],
    whatToBring: [
      'Open Water certification card (mandatory for depth)',
      'Swimwear, towel, and warm layer for return ride',
      'Passport / National ID for park checkpoint',
      'Egyptian Pounds for Bedouin seaside cafe drinks',
    ],
    whatToBringAr: [
      'بطاقة رخصة الغطس (أوبن ووتر كحد أدنى)',
      'مايوه وفوطة وملابس خفيفة لرحلة العودة',
      'بطاقة الرقم القومي أو الباسبور لكمين المحمية',
      'كاش للمشروبات في الكافيهات البدوية ع البحر',
    ],
    meetingInfo: 'Pickup from hotel lobby at 08:30 AM in 4x4 Bedouin jeep.',
    meetingInfoAr: 'التحرك من الفندق الساعة ٠٨:٣٠ صباحاً بسيارة جيب بدوية.',
    safetyInfo: 'Maximum depth governed by diver certification (18m-30m). Surface support and mandatory safety stops strictly enforced.',
    safetyInfoAr: 'العمق محكوم برخصة الغواص (١٨-٣٠ متر) مع التزام كامل بوقفات الأمان ودعم السطح.',
    cancellationPolicy: 'Free cancellation up to 24 hours before scheduled departure.',
    cancellationPolicyAr: 'إلغاء مجاني حتى ٢٤ ساعة قبل موعد الانطلاق.',
    image: IMG_P16826872200634742bd7fd538_CARD,
  },
  {
    id: 'intro-to-diving',
    title: 'Intro to Diving',
    titleAr: 'تجربة غطس استكشافية (للمبتدئين)',
    badgeLabel: 'Easy Start',
    badgeLabelAr: 'سهلة وبداية ممتازة',
    badgeType: 'easy',
    description: 'A relaxed introduction to diving for travelers with little or no previous experience.',
    descriptionAr: 'مقدمة هادئة وممتعة للغطس للمسافرين بدون أي خبرة سابقة تحت الماء.',
    duration: '2–3 hours',
    durationAr: '٢ إلى ٣ ساعات',
    level: 'Beginner',
    levelAr: 'مبتدئ تماماً',
    group: 'Small group',
    groupAr: 'مجموعة صغيرة',
    pricePerPersonEGP: 1200,
    location: 'Sheltered Lagoon & Lighthouse Shallow Reef',
    locationAr: 'شعاب اللايتهاوس واللاجونا الضحلة',
    includes: [
      'Instructor',
      'Equipment',
      'Safety briefing',
      'Beginner session',
    ],
    includesAr: [
      'مدرب محترف ملازم لك طوال الغطسة',
      'كامل المعدات والبدلة ونظارة الغطس',
      'شرح مبسط ومريح للتنفس تحت المية',
      'جلسة تعود في مياه ضحلة قبل النزول',
    ],
    whatToBring: [
      'Swimwear and comfortable beach sandals',
      'Towel and change of dry clothes',
      'Comfortable swimming mindset (no prior diving experience needed)',
    ],
    whatToBringAr: [
      'مايوه وشبشب مريح للشاطئ',
      'فوطة وغيار جاف',
      'استعداد للاستمتاع (مش محتاج أي خبرة سابقة)',
    ],
    meetingInfo: 'Lighthouse Training Center at 09:00 AM (2 min walk from central hotels).',
    meetingInfoAr: 'مركز تدريب اللايتهاوس الساعة ٠٩:٠٠ صباحاً (دقيقتين مشي من الفنادق).',
    safetyInfo: 'Conducted in calm, crystal-clear shallow waters with progressive confidence exercises before reef entry.',
    safetyInfoAr: 'تتم في مياه هادئة وشفافة جداً مع تدريب تدريجي لضمان الأمان والاطمئنان التام.',
    cancellationPolicy: 'Full refund or free time shift up to 12 hours before session.',
    cancellationPolicyAr: 'استرداد كامل أو تغيير الميعاد حتى ١٢ ساعة قبل الجلسة.',
    image: IMG_P15832122924541fe6229603b7_800,
  },
];

export interface SafariOption {
  id: string;
  title: string;
  titleAr?: string;
  badgeLabel: string;
  badgeLabelAr?: string;
  badgeType: 'match' | 'adventure' | 'relaxed';
  description: string;
  descriptionAr?: string;
  duration: string;
  durationAr?: string;
  difficulty: string;
  difficultyAr?: string;
  group: string;
  groupAr?: string;
  pricePerPersonEGP: number;
  includes: string[];
  includesAr?: string[];
  whatToBring: string[];
  whatToBringAr?: string[];
  meetingInfo: string;
  meetingInfoAr?: string;
  safetyInfo: string;
  safetyInfoAr?: string;
  cancellationPolicy: string;
  cancellationPolicyAr?: string;
  image: string;
  location: string;
  locationAr?: string;
}

export const CURATED_SAFARI_OPTIONS: SafariOption[] = [
  {
    id: 'desert-safari',
    title: 'Desert Safari',
    titleAr: 'سفاري صحراء وادي جنَي والغروب',
    badgeLabel: 'Best Match',
    badgeLabelAr: 'الأنسب لرحلتك',
    badgeType: 'match',
    description: 'Explore the desert landscape around Dahab with a local guide, with time for the scenery and sunset.',
    descriptionAr: 'استكشف طبيعة صحراء دهب الخلابة مع مرشد بدوي محلي ووقت مميز لمشاهدة الغروب.',
    duration: '4 hours',
    durationAr: '٤ ساعات',
    difficulty: 'Easy to Moderate',
    difficultyAr: 'سهل إلى متوسط',
    group: 'Small group',
    groupAr: 'مجموعة صغيرة',
    pricePerPersonEGP: 1400,
    location: 'Wadi Gnai & South Sinai Foothills',
    locationAr: 'وادي جُنَي وتلال جنوب سيناء',
    includes: [
      'Local guide',
      'Transportation',
      'Desert experience',
      'Sunset stop',
    ],
    includesAr: [
      'دليل بدوي محلي من أهل سيناء',
      'انتقالات بسيارة دفع رباعي 4x4',
      'جولة استكشافية وسط الجبال والواحات',
      'استراحة لمشاهدة غروب الشمس مع شاي بدوي',
    ],
    whatToBring: [
      'Comfortable walking shoes',
      'Sunglasses & scarf for desert wind',
      'Light jacket / sweater for evening temperature drop',
      'Camera or smartphone',
    ],
    whatToBringAr: [
      'حذاء مشي مريح',
      'نظارة شمس وشال للحماية من هواء الصحراء',
      'جاكيت خفيف لانخفاض الحرارة بالمساء',
      'كاميرا أو موبايلك للصور التذكارية',
    ],
    meetingInfo: 'Hotel lobby pickup at 01:45 PM in an air-conditioned 4x4 vehicle.',
    meetingInfoAr: 'التحرك من لوبي الفندق الساعة ٠١:٤٥ ظهراً بسيارة 4x4 مكيفة.',
    safetyInfo: 'Experienced local Bedouin guides and licensed drivers. Comprehensive first aid kit and satellite communications on board.',
    safetyInfoAr: 'سائقون ومرشدون بدو محترفون وخبيرون، حقيبة إسعافات متكاملة في كل سيارة.',
    cancellationPolicy: 'Free cancellation or day rescheduling up to 24 hours prior to departure.',
    cancellationPolicyAr: 'إلغاء مجاني أو تعديل الميعاد حتى ٢٤ ساعة قبل التحرك.',
    image: IMG_P1509316975850ff9c5deb0cd9_CARD,
  },
  {
    id: 'canyon-adventure',
    title: 'Canyon Adventure',
    titleAr: 'مغامرة الكانيون الملون والصخور',
    badgeLabel: 'More Adventure',
    badgeLabelAr: 'مغامرة وأكشن',
    badgeType: 'adventure',
    description: 'Explore desert canyons and dramatic landscapes on a more active adventure.',
    descriptionAr: 'استكشف الممرات الصخرية والتكوينات الجيولوجية المذهلة في مغامرة نشطة.',
    duration: '5–6 hours',
    durationAr: '٥ إلى ٦ ساعات',
    difficulty: 'Moderate',
    difficultyAr: 'متوسط (هايكنج خفيف)',
    group: 'Small group',
    groupAr: 'مجموعة صغيرة',
    pricePerPersonEGP: 1800,
    location: 'Colored Canyon & Sandstone Formations',
    locationAr: 'الكانيون الملون وتكوينات الحجر الرملي',
    includes: [
      'Guide',
      'Transportation',
      'Canyon experience',
      'Water',
    ],
    includesAr: [
      'مرشد مغامرات متخصص',
      'سيارة دفع رباعي مجهزة للدروب الوعرة',
      'مسار استكشاف وتصوير داخل الكانيون',
      'مياه شرب منعشة طوال الجولة',
    ],
    whatToBring: [
      'Sturdy hiking/trail shoes with good grip',
      'Sun hat and sun protection',
      'Small daypack with water bottle',
      'Egyptian Pounds for Bedouin herbal tea',
    ],
    whatToBringAr: [
      'كوتشي هايكنج ثابت مانع للانزلاق',
      'كاب أو طاقية للحماية من الشمس',
      'حقيبة ظهر خفيفة لزجاجة المية',
      'كاش بسيط للشاي البدوي والأعشاب',
    ],
    meetingInfo: 'Hotel lobby pickup at 01:30 PM in a desert-ready 4WD.',
    meetingInfoAr: 'التحرك من الفندق الساعة ٠١:٣٠ ظهراً بسيارة 4WD مجهزة.',
    safetyInfo: 'Led by certified terrain guides familiar with canyon passageways and safe footing guidance.',
    safetyInfoAr: 'بقيادة مرشدين معتمدين للمسارات الجبلية مع إرشادات مستمرة لأماكن الوقوف الآمن.',
    cancellationPolicy: 'Free cancellation up to 24 hours before trip departure.',
    cancellationPolicyAr: 'إلغاء مجاني حتى ٢٤ ساعة قبل انطلاق الرحلة.',
    image: IMG_P1469854523086cc02fe5d8800_800,
  },
  {
    id: 'desert-sunset',
    title: 'Desert Sunset',
    titleAr: 'سهرة الغروب البدوي الهادي',
    badgeLabel: 'Relaxed',
    badgeLabelAr: 'رايق وهادي',
    badgeType: 'relaxed',
    description: 'A slower desert experience focused on scenery, sunset, and a relaxed evening outside Dahab.',
    descriptionAr: 'تجربة صحراوية هادئة تركز على الاسترخاء ومشاهدة الغروب والنجوم في واحة هادئة.',
    duration: '3 hours',
    durationAr: '٣ ساعات',
    difficulty: 'Easy',
    difficultyAr: 'سهل ومريح جداً',
    group: 'Small group',
    groupAr: 'مجموعة صغيرة',
    pricePerPersonEGP: 1100,
    location: 'Wadi Qunai Bedouin Oasis Lookout',
    locationAr: 'مطل واحة وادي قُني البدوية',
    includes: [
      'Transportation',
      'Local guide',
      'Sunset experience',
      'Refreshments',
    ],
    includesAr: [
      'انتقالات مريحة ذهاباً وإياباً',
      'مرشد واستقبال بدوي أصيل',
      'جلسة غروب وشاي ع الفحم',
      'ضيافة بدوية خفيفة وتمر',
    ],
    whatToBring: [
      'Comfortable casual beachwear or casual clothes',
      'Sunglasses',
      'Light evening wrap or hoodie',
    ],
    whatToBringAr: [
      'ملابس مريحة وخفيفة',
      'نظارة شمس',
      'شال أو سويت شيرت خفيف للمساء',
    ],
    meetingInfo: 'Hotel lobby pickup at 02:00 PM.',
    meetingInfoAr: 'التحرك من الفندق الساعة ٠٢:٠٠ ظهراً.',
    safetyInfo: 'Scenic drive with zero strenuous climbing, comfortable traditional rug seating at Bedouin camp.',
    safetyInfoAr: 'مسار ممهد وسهل تماماً بدون أي تسلق، مع جلسات سجاد عربي مريحة داخل المخيم.',
    cancellationPolicy: 'Full refund or free time shift up to 12 hours before departure.',
    cancellationPolicyAr: 'استرداد كامل أو تعديل الميعاد حتى ١٢ ساعة قبل الموعد.',
    image: IMG_P15187092688054e9042af9f23_800,
  },
];
