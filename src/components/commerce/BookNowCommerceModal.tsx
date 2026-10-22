import React, { useState, useMemo, useRef } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useHeldCheckout } from '../../hooks/useHeldCheckout';
import { localCalendarDate, newAttemptKey, type HeldCheckoutOutcome } from '../../services/heldCheckout';
import { checkoutIssueFrom, checkoutIssueMessage } from '../../services/checkoutError';
import { quoteLine } from '../../services/pricingQuote';
import { createPlanningTrip } from '../../services/tripLifecycle';
import { CheckoutIssuePanel } from './CheckoutIssuePanel';
import {
  X,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Phone,
  Waves,
  Car,
  Compass,
  Building,
  Coffee,
  Flame,
  Wind,
  Calendar,
  Users,
  AlertTriangle,
  Receipt,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConfirmedBookingItem, TimelineActivity } from '../../types';
import { INITIAL_LIVE_DAHAB_CONDITIONS } from '../../data/dahabGeography';
import { sanitizeText, sanitizeAmount, sanitizeId } from '../../utils/sanitize';

export type BookNowCategory = 'all' | 'watersports' | 'transport' | 'tonight' | 'wellness' | 'dining';

export interface InDestinationServiceOption {
  id: string;
  category: 'watersports' | 'transport' | 'tonight' | 'wellness' | 'dining';
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  description: string;
  descriptionAr: string;
  basePriceEGP: number;
  currency: string;
  durationStr: string;
  durationStrAr: string;
  pickupWindow: string; // e.g. "Ready in 15 mins"
  pickupWindowAr: string;
  /**
   * A descriptor of when the service runs — not a count.
   *
   * '4 Spots Left' used to be one of the options, hardcoded on two cards
   * ('متبقي ٤ مقاعد اليوم', 'متبقي ٤ مركبات'). It read as live remaining
   * capacity and never was: no inventory record exists behind these cards, and
   * the number never changed no matter how many people booked. A scarcity
   * claim is the one kind of copy that must be measured or absent.
   */
  availabilityBadge: 'Instant Ready' | 'Limited Slots' | 'Evening Slot' | 'Weather Optimal';
  availabilityBadgeAr: string;
  locationArea: string;
  locationAreaAr: string;
  supplierName: string;
  supplierNameAr: string;
  supplierPhone: string;
  meetingPoint: string;
  meetingPointAr: string;
  icon: any;
  whatToBring: string[];
  whatToBringAr: string[];
  weatherConditionCheck?: string;
  weatherConditionCheckAr?: string;
  /**
   * The real product this card sells, when there is one.
   *
   * Every entry below is editorial content written in the frontend: none of
   * these eight services exists in db.productSkus, and none of their suppliers
   * exists in db.suppliers. Checkout used to accept the card's own `id` as a
   * skuId and the server silently substituted the first SKU of the same
   * service type — so booking a 180 EGP gear delivery created a real booking
   * dispatched to a real dive centre for a service it does not sell.
   *
   * The server now rejects inventory it does not have. Leaving this undefined
   * is the honest statement that a card cannot be booked online yet, and the
   * card offers the supplier's own contact instead of writing a booking
   * against somebody else's.
   */
  skuId?: string;
  /**
   * The vertical the SKU is filed under, which is not always derivable from the
   * card's category: 'transport' covers both a Blue Hole jeep (a transfer) and
   * a quad safari, and 'wellness'/'dining' had no commerce vertical at all
   * until these services were given real inventory. Derived guesses put a
   * massage in the diving ledger account and the diving filter.
   */
  serviceType?: 'transfer' | 'diving' | 'hotel' | 'safari' | 'wellness' | 'dining';
  /**
   * How the base price scales with the party, mirroring the server's
   * `pricingBasisOf` (server/services/commerceService.ts).
   *
   * Absent means 'per_person' — correct for every one of the eight cards below.
   * It matters for a hotel: the server prices a stay per stay, so a room
   * bought for two guests is the block price, never twice it. Without this the
   * view multiplies by the guest count and the server answers 409 PRICE_CHANGED.
   */
  pricingBasis?: 'per_person' | 'per_stay' | 'per_vehicle';
}

export const IN_DESTINATION_SERVICES: InDestinationServiceOption[] = [
  {
    id: 'now-gear-delivery',
    serviceType: 'diving',
    skuId: 'SKU-NOW-GEAR-01',
    category: 'watersports',
    title: 'Mask, Snorkel & Hard-Sole Booties Delivery',
    titleAr: 'توصيل فوري لطقم السنوركل والجزمة الصخرية',
    subtitle: 'Direct beach/hotel drop-off in sanitized mesh bag',
    subtitleAr: 'توصيل مباشر لشاطئك أو الفندق في شنطة معقمة',
    description: 'High-clarity tempered glass mask, dry-top snorkel, and hard-soled neoprene booties suited for Dahab limestone reef entries.',
    descriptionAr: 'ماسك زجاجي مقوّى عالي النقاء، سنوركل صمام علوي، وجزمة نيوبرين بنعل صلب مخصصة لصخور دهب.',
    basePriceEGP: 180,
    currency: 'EGP',
    durationStr: 'Full Day Rental',
    durationStrAr: 'إيجار يوم كامل',
    pickupWindow: 'Ready in 15–20 mins',
    pickupWindowAr: 'جاهز للتوصيل خلال ١٥–٢٠ دقيقة',
    availabilityBadge: 'Instant Ready',
    availabilityBadgeAr: 'توصيل فوري',
    locationArea: 'Lighthouse / Mashraba / Eel Garden',
    locationAreaAr: 'اللايتهاوس / المشربة / إيل جاردن',
    supplierName: 'Dahab Blue Divers Hub',
    supplierNameAr: 'مركز غواصي دهب الأزرق',
    supplierPhone: '+20 100 234 8899',
    meetingPoint: 'Delivered directly to your current hotel or beach palapa',
    meetingPointAr: 'يتم التوصيل مباشرة لشلتتك على الشاطئ أو لوبي فندقك',
    icon: Waves,
    whatToBring: ['Your shoe size', 'National ID / Passport copy for equipment deposit'],
    whatToBringAr: ['مقاس حذائك', 'صورة بطاقة أو جواز للسجل فقط'],
    weatherConditionCheck: 'Water Visibility 28m · Ideal for Lighthouse reef drift',
    weatherConditionCheckAr: 'الرؤية ٢٨ متر · ممتازة لحيد اللايتهاوس المرجاني'
  },
  {
    id: 'now-afternoon-dive',
    serviceType: 'diving',
    skuId: 'SKU-NOW-AFTDIVE-01',
    category: 'watersports',
    title: '1-Tank Afternoon Guided Reef Dive',
    titleAr: 'غطسة بعد الظهر بمرشد معتمد وتانك كامل',
    subtitle: 'Lighthouse or Islands Coral Garden with Divemaster',
    subtitleAr: 'شعب اللايتهاوس أو حديقة جزر المرجان مع دايڤ ماستر',
    description: 'Quick check dive or relaxed afternoon coral reef dive with professional briefing, complete Cressi equipment, tank, and weight belt.',
    descriptionAr: 'غطسة روقان بعد الظهر مع مرشد محترف، شاملة كامل المعدات، التانك، وحزام الأوزان.',
    basePriceEGP: 1200,
    currency: 'EGP',
    durationStr: '2 Hours (45–55 min dive)',
    durationStrAr: 'ساعتان (٤٥–٥٥ دقيقة تحت الماء)',
    pickupWindow: 'Briefing at 02:30 PM & 04:00 PM',
    pickupWindowAr: 'لقاء الإحاطة ٢:٣٠ عصراً و ٤:٠٠ عصراً',
    availabilityBadge: 'Limited Slots',
    availabilityBadgeAr: 'أماكن محدودة',
    locationArea: 'Lighthouse Promenade Base',
    locationAreaAr: 'ممشى اللايتهاوس الرئيسي',
    supplierName: 'Sinai Red Sea Dive Masters',
    supplierNameAr: 'رابطة مدربي غوص البحر الأحمر بسيناء',
    supplierPhone: '+20 100 345 6789',
    meetingPoint: 'Diving Clubhouse next to Ali Baba Seafront',
    meetingPointAr: 'مقر المركز بجوار فندق علي بابا على الممشى',
    icon: Waves,
    whatToBring: ['Diving Certification Card (Open Water+)', 'Swimwear & Towel', 'Logbook'],
    whatToBringAr: ['كارنيه رخصة الغوص (أوبن ووتر+)', 'مايوه وفوطة', 'دفتر تسجيل الغطسات'],
    weatherConditionCheck: 'DAN Safety Buffer: Only if no flight within next 18–24 hours',
    weatherConditionCheckAr: 'شرط سلامة: فقط إذا لم يكن لديك طيران خلال ١٨–٢٤ ساعة القادمة'
  },
  {
    id: 'now-laguna-kite',
    serviceType: 'diving',
    skuId: 'SKU-NOW-KITE-01',
    category: 'watersports',
    title: 'Laguna Spit Kiteboard & Foil Rental Session',
    titleAr: 'جلسة وتأجير معدات كايت سيرف في اللاجونا',
    subtitle: 'Duotone Kite + Board + Harness at Flat-water Basin',
    subtitleAr: 'طقم كايت وبورد متكامل في حوض المياه الهادئة باللاجونا',
    description: 'Access the dedicated kite launch area at Laguna spit during peak afternoon thermal winds. Includes safety rescue boat standby.',
    descriptionAr: 'استمتع بحوض اللاجونا المغلق وقت ذروة الرياح الحرارية بعد الظهر. يشمل قارب إنقاذ مرافق.',
    basePriceEGP: 950,
    currency: 'EGP',
    durationStr: '2 Hours Session',
    durationStrAr: 'جلسة لمدة ساعتين',
    pickupWindow: 'Wind Window: 02:00 PM – 05:30 PM',
    pickupWindowAr: 'فترة الرياح: ٢:٠٠ ظهراً – ٥:٣٠ عصراً',
    availabilityBadge: 'Weather Optimal',
    availabilityBadgeAr: 'الرياح مثالية الآن',
    locationArea: 'Laguna Beach Kite Spit',
    locationAreaAr: 'لسان شاطئ اللاجونا',
    supplierName: 'Laguna Wind & Kite Center',
    supplierNameAr: 'مركز لاجونا للكايت وركوب الأمواج',
    supplierPhone: '+20 100 567 1234',
    meetingPoint: 'Laguna Kite Bay Station 3',
    meetingPointAr: 'محطة رقم ٣ شاطئ اللاجونا الجنوبي',
    icon: Wind,
    whatToBring: ['IKO Level 3 Card or Self-sufficiency check', 'Sunscreen SPF50', 'Sunglasses with leash'],
    whatToBringAr: ['رخصة IKO أو اختبار كفاءة سريع', 'صن بلوك', 'نظارة شمس برباط'],
    weatherConditionCheck: 'Wind 18 kts NE Thermal · Perfect condition',
    weatherConditionCheckAr: 'الرياح ١٨ عقدة شمالية شرقية · حالة ممتازة'
  },
  {
    id: 'now-jeep-bluehole',
    serviceType: 'transfer',
    skuId: 'SKU-NOW-JEEP-BH-01',
    category: 'transport',
    title: 'Immediate 4x4 Jeep to Blue Hole & The Bells',
    titleAr: 'جيب فور باي فور فوري للبلو هول والبلز',
    subtitle: 'Private Land Cruiser / Hilux with Bedouin Driver',
    subtitleAr: 'سيارة جيب خاصة لاند كروزر مع سائق بدوي محترف',
    description: 'Direct door-to-canyon transport with wait & return service. Scenic 20-minute coastal desert drive.',
    descriptionAr: 'توصيل مباشر مع انتظار اختياري للعودة. طريق ساحلي صحراوي مدته ٢٠ دقيقة.',
    basePriceEGP: 400,
    currency: 'EGP',
    durationStr: 'Flexible (Pickup + Return)',
    durationStrAr: 'مرن (ذهاب وعودة حسب رغبتك)',
    pickupWindow: 'Dispatches in 10–15 mins',
    pickupWindowAr: 'تحرك خلال ١٠–١٥ دقيقة',
    availabilityBadge: 'Instant Ready',
    availabilityBadgeAr: 'جاهز للتحرك',
    locationArea: 'Pickup anywhere in Dahab',
    locationAreaAr: 'استلام من أي مكان بدهب',
    supplierName: 'Sinai Bedouin Drivers Cooperative',
    supplierNameAr: 'جمعية سائقي سيناء البدوية',
    supplierPhone: '+20 100 789 4455',
    meetingPoint: 'Outside your hotel entrance or central Lighthouse arch',
    meetingPointAr: 'أمام مدخل فندقك أو بوابة ممشى اللايتهاوس',
    icon: Car,
    whatToBring: ['EGP cash for national park entrance ticket (200 EGP / foreigner $10)', 'Water bottle'],
    whatToBringAr: ['كاش لرسوم بوابة المحمية', 'زجاجة مياه'],
    weatherConditionCheck: 'Road cleared and open through North Checkpoint',
    weatherConditionCheckAr: 'طريق المحمية مفتوح وسلس عبر الكمين الشمالي'
  },
  {
    id: 'now-quad-safari',
    serviceType: 'safari',
    skuId: 'SKU-NOW-QUAD-01',
    category: 'transport',
    title: 'Bedouin Sunset Quad Safari to Wadi Gnai',
    titleAr: 'سفاري بيتش باجي لغروب وادي قني',
    subtitle: 'Single or Double Quad with Guide & Desert Helmets',
    subtitleAr: 'بيتش باجي مفرد أو مزدوج مع مرشد وخوذات أمان',
    description: 'Ride across granite desert canyons into the hidden palm oasis of Wadi Gnai just as the sun sets behind the Sinai mountains.',
    descriptionAr: 'انطلق بين الجبال الجرانيتية وصولاً لواحة نخيل وادي قني مع مشهد غروب الشمس الخلاب.',
    basePriceEGP: 850,
    currency: 'EGP',
    durationStr: '2.5 Hours',
    durationStrAr: 'ساعتان ونصف',
    pickupWindow: 'Sunset Convoy: 04:30 PM',
    pickupWindowAr: 'موكب الغروب: ٤:٣٠ عصراً',
    availabilityBadge: 'Limited Slots',
    availabilityBadgeAr: 'أماكن محدودة',
    locationArea: 'Wadi Gnai Desert Trails',
    locationAreaAr: 'مدقات وادي قني الصحراوية',
    supplierName: 'Sinai Desert Motor Safari',
    supplierNameAr: 'سفاري صحراء سيناء للمحركات',
    supplierPhone: '+20 100 901 2345',
    meetingPoint: 'Quad Safari Base, South Dahab Gate (Transfer included)',
    meetingPointAr: 'محطة السفاري بمدخل دهب الجنوبي (يشمل التوصيل)',
    icon: Compass,
    whatToBring: ['Bedouin Keffiyeh / Scarf for sand protection', 'Sunglasses', 'Closed sneakers'],
    whatToBringAr: ['شال بدوي للحماية من الغبار', 'نظارة شمسية', 'كوتشي مقفول'],
    weatherConditionCheck: 'Cool desert breeze after 05:00 PM',
    weatherConditionCheckAr: 'أجواء صحراوية معتدلة بعد الخامسة مساءً'
  },
  {
    id: 'now-wadi-gnai-dinner',
    serviceType: 'safari',
    skuId: 'SKU-NOW-ZARB-01',
    category: 'tonight',
    title: 'Wadi Gnai Authentic Bedouin Zarb BBQ & Star Camp',
    titleAr: 'عشاء زرب بدوي أصيل وشاي حَبَق تحت النجوم بوادي قني',
    subtitle: 'Underground Roasted Chicken/Lamb, Campfire & Oud',
    subtitleAr: 'لحم ودجاج مدفون تحت الرمال مع قعدة نار وعود',
    description: 'Authentic underground slow-roasted Zarb feast with Bedouin flatbread, salads, tahina, Habak mountain tea, and stargazing telescope session.',
    descriptionAr: 'وليمة الزرب البدوي المدفون في براميل تحت الرمل، مع الخبز الطازج، الشاي الجبلي، وجلسة رصد النجوم بالتلسكوب.',
    basePriceEGP: 750,
    currency: 'EGP',
    durationStr: '4 Hours (06:00 PM – 10:00 PM)',
    durationStrAr: '٤ ساعات (٦:٠٠ مساءً – ١٠:٠٠ مساءً)',
    pickupWindow: 'Pickup at 05:45 PM from Lighthouse / Hotel',
    pickupWindowAr: 'التحرك ٥:٤٥ مساءً من الفندق أو اللايتهاوس',
    availabilityBadge: 'Evening Slot',
    availabilityBadgeAr: 'سهرة الليلة',
    locationArea: 'Wadi Gnai Granite Amphitheatre',
    locationAreaAr: 'مسرح جبال وادي قني الجرانيتي',
    supplierName: 'Sheikh Salem Bedouin Heritage Council',
    supplierNameAr: 'مجلس التراث البدوي للشيخ سالم',
    supplierPhone: '+20 100 876 5432',
    meetingPoint: '4x4 pickup directly from your accommodation in Dahab',
    meetingPointAr: 'استلام بالسيارة الجيب مباشرة من مكان إقامتك',
    icon: Flame,
    whatToBring: ['Light evening jacket (desert gets pleasantly cool)', 'Camera / Phone'],
    whatToBringAr: ['جاكيت خفيف للسهرة الصحراوية', 'كاميرا للتصوير تحت النجوم'],
    weatherConditionCheck: 'Clear sky 0% clouds · Superb Milky Way visibility',
    weatherConditionCheckAr: 'سماء صافية تماماً · فرصة مثالية لرؤية مجرة درب التبانة'
  },
  {
    id: 'now-deep-tissue-massage',
    serviceType: 'wellness',
    skuId: 'SKU-NOW-MASSAGE-01',
    category: 'wellness',
    title: 'Post-Dive Deep Tissue Recovery Massage',
    titleAr: 'جلسة مساج ريكفري عميق لراحة العضلات بعد الغوص',
    subtitle: '60-min with Organic Sinai Herb & Olive Oils',
    subtitleAr: '٦٠ دقيقة بزيوت الأعشاب والزيتون السيناوي الطبيعي',
    description: 'Designed specifically for ocean athletes and travelers to release shoulder, back, and leg tension from fins and desert walking.',
    descriptionAr: 'جلسة مصممة خصيصاً للغواصين ومحبي الحركة لفك تشنجات الظهر والأكتاف وإراحة عضلات القدمين.',
    basePriceEGP: 650,
    currency: 'EGP',
    durationStr: '60 Minutes',
    durationStrAr: '٦٠ دقيقة',
    pickupWindow: 'Appointments at 03:00 PM, 05:00 PM & 07:00 PM',
    pickupWindowAr: 'مواعيد متاحة ٣:٠٠ و ٥:٠٠ و ٧:٠٠ مساءً',
    availabilityBadge: 'Instant Ready',
    availabilityBadgeAr: 'متاح اليوم',
    locationArea: 'Assalah Wellness Palapa & Lighthouse Studio',
    locationAreaAr: 'استوديو العصلة وممشى اللايتهاوس',
    supplierName: 'Dahab Holistic Healing Oasis',
    supplierNameAr: 'واحة دهب للاستشفاء والعلاج الطبيعي',
    supplierPhone: '+20 100 444 3322',
    meetingPoint: 'Seaside Studio 1, Coral Coast Garden Promenade',
    meetingPointAr: 'استوديو ١ داخل حديقة كورال كوست على الممشى',
    icon: Sparkles,
    whatToBring: ['Comfortable clothing', 'Hydrate with water before arrival'],
    whatToBringAr: ['ملابس مريحة', 'شرب مياه كافية قبل الجلسة'],
    weatherConditionCheck: 'Air-conditioned seaside studio with calming wave sounds',
    weatherConditionCheckAr: 'استوديو مكيف يطل على البحر مع صوت الأمواج الهادئ'
  },
  {
    id: 'now-fresh-catch-ali-baba',
    serviceType: 'dining',
    skuId: 'SKU-NOW-CATCH-01',
    category: 'dining',
    title: 'Fresh Red Sea Catch & Bedouin Mezze Table',
    titleAr: 'طاولة العشاء الطازج لسمك البحر الأحمر في علي بابا',
    subtitle: 'Guaranteed Waterfront Table Hold + Fish Market Selection',
    subtitleAr: 'حجز مؤكد لطاولة على الممشى المباشر واختيار السمك طازج',
    description: 'Skip the wait. Reserve a prime seaside cushion table at Ali Baba for dinner with complimentary Bedouin lemon-mint drink and mezze starter.',
    descriptionAr: 'بدون انتظار! احجز طاولتك على الممشى مباشرة واستمتع بالسمك المشوي على الفحم والمقبلات البدوية ومشروب الليمون نعناع الترحيبي.',
    basePriceEGP: 350,
    currency: 'EGP',
    durationStr: 'Dinner Table Hold (07:00 PM – 10:00 PM)',
    durationStrAr: 'حجز طاولة العشاء (٧:٠٠ – ١٠:٠٠ مساءً)',
    pickupWindow: 'Confirmed in 5 mins',
    pickupWindowAr: 'تأكيد فوري خلال ٥ دقائق',
    availabilityBadge: 'Evening Slot',
    availabilityBadgeAr: 'حجز مسائي مضمون',
    locationArea: 'Lighthouse Promenade Center',
    locationAreaAr: 'قلب ممشى اللايتهاوس',
    supplierName: 'Ali Baba Seafront Restaurant & Lounge',
    supplierNameAr: 'مطعم واستراحة علي بابا البحرية',
    supplierPhone: '+20 69 364 0055',
    meetingPoint: 'Ali Baba Host Desk, Lighthouse Promenade',
    meetingPointAr: 'مكتب الاستقبال بمطعم علي بابا على الممشى',
    icon: Coffee,
    whatToBring: ['Appetite for fresh grilled Sea Bass / Calamari / Sayadeya rice'],
    whatToBringAr: ['حب المأكولات البحرية والأرز الصيادية والسلطات الطازجة'],
    weatherConditionCheck: 'Cards & EGP Cash accepted · Oceanfront breeze',
    weatherConditionCheckAr: 'يقبل الدفع بالكروت والكاش · نسيم بحري رائع'
  }
];

interface BookNowCommerceModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCategory?: BookNowCategory;
  initialServiceId?: string;
  contextLocation?: string;
  contextTimeWindow?: string;
  /**
   * Fired once a booking is confirmed. DayGiConciergeView already passed this
   * (as `onBookingSuccess`) to close the modal and announce the reference, but
   * the prop did not exist, so the callback was silently dropped and the modal
   * stayed open after a successful DayGI booking handoff.
   */
  onBookingSuccess?: (booking: { id: string; code: string; totalPriceEGP: number }) => void;
}

export const BookNowCommerceModal: React.FC<BookNowCommerceModalProps> = ({
  isOpen,
  onClose,
  preselectedCategory = 'all',
  initialServiceId,
  contextLocation = 'Lighthouse Bay / Mashraba',
  contextTimeWindow = 'Next 2–4 Hours (This Afternoon)',
  onBookingSuccess,
}) => {
  const { setBookings, recordLedgerEntry, addActivityToDay, showToast, navigateTo, isSignedIn, sessionUser, setIntendedRoute, activeTrip, profile } = useTrip();
  // Was the literal 'DHB-TRIP-894' on the checkout and its ledger entry.
  const bookingTripId = activeTrip?.id || '';
  /** Why the booking failed, if it did. Shown instead of a success screen. */
  const [bookingError, setBookingError] = useState<string | null>(null);
  const { language, isRTL , t} = useLanguage();

  const [activeCategory, setActiveCategory] = useState<BookNowCategory>(preselectedCategory);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    initialServiceId || IN_DESTINATION_SERVICES[0].id
  );

  // Booking Form State
  const [currencyMode, setCurrencyMode] = useState<'EGP' | 'USD' | 'EUR'>('EGP');
  const [travelersCount, setTravelersCount] = useState<number>(2);
  const [pickupHotel, setPickupHotel] = useState<string>('Ali Baba Hotel / Lighthouse');
  const [specialNote, setSpecialNote] = useState<string>('');
  const [insertToTripSchedule, setInsertToTripSchedule] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // State: Booking success
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    code: string;
    service: InDestinationServiceOption;
    totalPriceEGP: number;
    confirmedTime: string;
    ledgerRef: string;
  } | null>(null);

  const selectedService = useMemo(() => {
    return IN_DESTINATION_SERVICES.find((s) => s.id === selectedServiceId) || IN_DESTINATION_SERVICES[0];
  }, [selectedServiceId]);

  const filteredServices = useMemo(() => {
    if (activeCategory === 'all') return IN_DESTINATION_SERVICES;
    return IN_DESTINATION_SERVICES.filter((s) => s.category === activeCategory);
  }, [activeCategory]);

  /**
 * Mirrors the server's `priceSkuLine` via the shared rule — only a per-person
 * line scales with the party. All eight cards below are per-person, so this is
 * the same number as before; the basis is honoured rather than assumed, so a
 * card that sells a block (a stay, a private vehicle) cannot quote double.
 *
 * Null means the basis is not priceable from a party size (a per-night room
 * rate); the order flow below treats that as "cannot be ordered here".
 */
const quotedTotalEGP = quoteLine(selectedService.basePriceEGP, selectedService.pricingBasis, travelersCount);
const totalPriceEGP = quotedTotalEGP ?? 0;

  const { formatEGP } = useCurrency();
  /** A trip created for this order, kept so a retry does not create another. */
  const createdTripIdRef = useRef<string | null>(null);
  /** What the traveller ordered, kept for recording once the server confirms (possibly after a re-confirmed price). */
  const orderContextRef = useRef<{
    service: InDestinationServiceOption;
    travelersCount: number;
    cleanHotel: string;
    cleanNote: string;
    currentTimeStr: string;
  } | null>(null);
  const checkout = useHeldCheckout({
    keyPrefix: 'NOW',
    onConfirmed: outcome => recordConfirmedOrder(outcome),
  });

  // Currency Conversions
  const convertedPrice = useMemo(() => {
    if (currencyMode === 'USD') {
      return (totalPriceEGP / 50.0).toFixed(1);
    }
    if (currencyMode === 'EUR') {
      return (totalPriceEGP / 54.0).toFixed(1);
    }
    return totalPriceEGP.toLocaleString();
  }, [currencyMode, totalPriceEGP]);

  if (!isOpen) return null;

  /**
   * Books for real.
   *
   * This used to be a setTimeout that generated a reference locally and told
   * the traveller "Instant booking confirmed!" — verified end to end: zero
   * network calls, nothing written anywhere, and the booking vanished on
   * refresh. It now goes through the same audited endpoint as the planner
   * flow, and the reference shown is the one the server issued.
   */
  const handleConfirmOrder = async () => {
    if (!isSignedIn) {
      setIntendedRoute('/book-now');
      showToast(
        t('commerce.signInToComplete')
      );
      navigateTo('/auth/sign-in');
      return;
    }
    if (isProcessing || checkout.busy) return;

    // The SKU and vertical the card was catalogued under. This sent the
    // card's own id ('now-gear-delivery') as the skuId and derived the type
    // from the browse category, so the server refused every order as an
    // unknown product.
    if (!selectedService.skuId || !selectedService.serviceType) {
      setBookingError(
        t('commerce.notBookableOnlineYet', {
          supplierName: language === 'ar' ? selectedService.supplierNameAr : selectedService.supplierName,
          supplierPhone: selectedService.supplierPhone,
        })
      );
      return;
    }

    setBookingError(null);
    checkout.reset();
    setIsProcessing(true);
    const cleanHotel = sanitizeText(pickupHotel) || 'Dahab Base';
    const cleanNote = sanitizeText(specialNote);
    const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    orderContextRef.current = { service: selectedService, travelersCount, cleanHotel, cleanNote, currentTimeStr };

    // A booking needs a real trip. Without one this sent an empty tripId and
    // the server refused it; now the traveller gets a one-day plan first.
    let tripId = bookingTripId || createdTripIdRef.current;
    if (!tripId) {
      try {
        const trip = await createPlanningTrip({
          title: language === 'ar' ? selectedService.titleAr : selectedService.title,
          lengthDays: 1,
          travelersCount,
          startsInDays: 0,
          idPrefix: 'TRIP-NOW',
        });
        tripId = trip.id;
        createdTripIdRef.current = trip.id;
      } catch (err) {
        setIsProcessing(false);
        setBookingError(checkoutIssueMessage(checkoutIssueFrom(err), t, formatEGP));
        return;
      }
    }
    setIsProcessing(false);

    // Hold for the party first, then settle: checkout only settles a hold.
    await checkout.submit({
      tripId,
      // These used to be 'Dahab Traveler', '+20 100 000 0000' and
      // 'traveler@dahab.travel' — placeholders written into the booking
      // record and handed to a supplier who has to meet this traveler.
      traveler: {
        name: sessionUser?.name || profile.name,
        phone: profile.phone || sessionUser?.phone || '',
        email: sessionUser?.email || profile.email,
      },
      lines: [{
        serviceType: selectedService.serviceType,
        skuId: selectedService.skuId,
        scheduledDate: localCalendarDate(),
        scheduledTime: 'ASAP',
        passengersCount: travelersCount,
        amountEGP: sanitizeAmount(totalPriceEGP),
        pickupLocation: cleanHotel,
        specialRequests: cleanNote || undefined,
      }],
      // No gateway is integrated: the booking settles when the traveler pays
      // the provider on arrival.
      payment: { provider: 'CASH_ON_ARRIVAL' },
      attemptKey: newAttemptKey('NOW'),
    });
  };

  /** The server settled the order: record it with the server's reference and the charged amount. */
  function recordConfirmedOrder(outcome: Extract<HeldCheckoutOutcome, { kind: 'confirmed' }>) {
    const context = orderContextRef.current;
    if (!context) return;
    const { service, travelersCount, cleanHotel, cleanNote, currentTimeStr } = context;
    const code = outcome.result.bookings?.[0]?.bookingRef || outcome.result.transactionId;
    const chargedEGP = outcome.held.reduce((sum, line) => sum + line.amountEGP, 0);

    // 1. Record in-destination ledger entry. The booking is pay-on-arrival,
    // so this is a pending escrow hold — never a captured payment. It used
    // to be recorded as PAYMENT_CAPTURED / SETTLED against a made-up card
    // token ('TRAVELER_CC_TOKEN_4910'), which is how the books said money
    // moved when none did.
    const ledger = recordLedgerEntry({
      transactionId: `TXN-NOW-${Date.now()}`,
      idempotencyKey: `IDEMP-NOW-${code}-${Date.now()}`,
      bookingRef: code,
      tripId: outcome.tripId,
      type: 'HOLD_ESCROW',
      amountEGP: chargedEGP,
      debitAccount: 'TRAVELER_CASH_ON_ARRIVAL',
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      status: 'PENDING',
      metadata: {
        serviceType: service.category,
        supplierName: service.supplierName,
        travelersCount,
        pickupLocation: cleanHotel,
        serviceTitle: service.title,
        reason: 'Instant in-destination booking. Pay upon arrival.'
      }
    });

    // 2. Add to Trip Bookings
    const newBooking: ConfirmedBookingItem = {
      id: `book-${Date.now()}`,
      serviceType: service.category === 'watersports' ? 'diving' : service.category === 'transport' ? 'transfer' : 'safari',
      title: service.title,
      subtitle: `${travelersCount} Guests · ${service.subtitle}`,
      details: `Pickup: ${cleanHotel} · Note: ${cleanNote || 'Standard instant dispatch'}`,
      datesOrTime: `Booked Now (${currentTimeStr}) · ${service.durationStr}`,
      priceEGP: chargedEGP,
      provider: service.supplierName,
      confirmationCode: code,
      status: 'Confirmed ✓',
      location: service.locationArea,
      iconType: service.category === 'watersports' ? 'waves' : service.category === 'transport' ? 'car' : 'compass',
      phone: service.supplierPhone,
      included: service.whatToBring,
      cancellationPolicy: 'Free cancellation up to 30 minutes before fulfillment'
    };

    setBookings((prev) => [newBooking, ...prev]);

    // 3. Optionally add to active Day 2 schedule
    if (insertToTripSchedule) {
      const newActivity: TimelineActivity = {
        id: `act-now-${Date.now()}`,
        time: '03:30 PM',
        title: service.title,
        type: 'Activity',
        status: 'Booked ✓',
        location: service.locationArea,
        duration: service.durationStr,
        priceEGP: chargedEGP,
        meetingPoint: service.meetingPoint,
        whatToBring: service.whatToBring,
        guideName: service.supplierName,
        notes: `Instant In-Destination Booking (${code}). Pickup at ${cleanHotel}.`
      };
      addActivityToDay(2, newActivity);
    }

    setConfirmedBooking({
      code,
      service: service,
      totalPriceEGP: chargedEGP,
      confirmedTime: currentTimeStr,
      ledgerRef: ledger.transactionId
    });

    setIsProcessing(false);
    setIsSuccess(true);
    showToast(
      t('commerce.instantBookingConfirmedReference', { code })
    );
    onBookingSuccess?.({ id: code, code, totalPriceEGP: chargedEGP });
  }

  const handleReset = () => {
    setIsSuccess(false);
    setConfirmedBooking(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-now-commerce-modal-dialog-1-title"
    >
      <div className="relative w-full max-w-4xl bg-stone-900 text-stone-100 rounded-3xl border border-[var(--accent-secondary)]/30 shadow-2xl overflow-hidden my-auto">
        {/* Top Accent Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-900 to-stone-800 px-5 sm:px-8 py-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] text-[var(--accent-primary-ink)] flex items-center justify-center font-black shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  {t('commerce.iNDESTINATIONCOMMERCE')}
                </span>
                <span className="flex items-center gap-1 text-[12px] text-amber-300 font-mono">
                  <Clock className="w-3 h-3" />
                  {contextTimeWindow}
                </span>
              </div>
              <h2 id="book-now-commerce-modal-dialog-1-title" className="chart-heading font-bold text-lg sm:text-xl text-white mt-0.5">
                {t('commerce.dahabNowBookInstantly')}
              </h2>
            </div>
          </div>

          {bookingError && (

            <div role="alert" className="mb-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm">

              {bookingError}

            </div>

          )}


          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 min-w-[44px] min-h-[44px] rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer border border-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Real In-Destination Context Bar */}
        <div className="bg-stone-950/80 px-5 sm:px-8 py-2.5 border-b border-stone-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-stone-300">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            <span>
              {t('commerce.currentLocation')}{' '}
              <strong className="text-white">{contextLocation}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-stone-400 font-mono text-[12px]">
            <span className="flex items-center gap-1 text-teal-300">
              <Wind className="w-3 h-3" />
              {INITIAL_LIVE_DAHAB_CONDITIONS.windSpeedKnots} kts {INITIAL_LIVE_DAHAB_CONDITIONS.windDirection}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 text-teal-300">
              <Waves className="w-3 h-3" />
              {INITIAL_LIVE_DAHAB_CONDITIONS.waterVisibilityMeters}m Vis ({INITIAL_LIVE_DAHAB_CONDITIONS.seaState})
            </span>
          </div>
        </div>

        {/* Content Body */}
        {!isSuccess ? (
          <div className="p-5 sm:p-8 space-y-6">
            {/* Category Filter Chips */}
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-2">
                {t('commerce.whatDoYouWant')}
              </label>
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all', label: 'All Services', labelAr: 'الكل' },
                  { id: 'watersports', label: 'Ocean & Gear', labelAr: 'بحر ومعدات' },
                  { id: 'transport', label: '4x4 & Transport', labelAr: 'جيب ومواصلات' },
                  { id: 'tonight', label: "Tonight's Campfire", labelAr: 'سهرة الليلة' },
                  { id: 'wellness', label: 'Wellness & Recovery', labelAr: 'ريكفري ومساج' },
                  { id: 'dining', label: 'Fresh Catch Table', labelAr: 'حجز أسماك' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id as BookNowCategory)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
                      activeCategory === tab.id
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)] shadow-md scale-102'
                        : 'bg-stone-800/80 text-stone-300 hover:text-[var(--text-primary)] border-stone-700 hover:bg-stone-750'
                    }`}
                  >
                    {language === 'ar' ? tab.labelAr : tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2-Column Split: Service Selector & Order Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Service Cards List */}
              <div className="lg:col-span-7 space-y-3 max-h-[420px] overflow-y-auto pe-1">
                {filteredServices.map((service) => {
                  const isSelected = service.id === selectedServiceId;
                  const Icon = service.icon;

                  return (
                    <button
                      type="button"
                      key={service.id}
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer text-start w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                        isSelected
                          ? 'bg-stone-800/90 border-[var(--accent-secondary)] shadow-lg ring-1 ring-[var(--accent-secondary)]/40'
                          : 'bg-stone-950/60 border-stone-800 hover:border-stone-700 hover:bg-stone-850/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]' : 'bg-stone-800 text-teal-400'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-sm text-white">
                                {language === 'ar' ? service.titleAr : service.title}
                              </h3>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                                {language === 'ar' ? service.availabilityBadgeAr : service.availabilityBadge}
                              </span>
                            </div>
                            <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">
                              {language === 'ar' ? service.subtitleAr : service.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <span className="font-bold text-base text-amber-400 font-mono">
                            {service.basePriceEGP} {service.currency}
                          </span>
                          <span className="block text-[11px] text-stone-400">
                            {language === 'ar' ? service.durationStrAr : service.durationStr}
                          </span>
                        </div>
                      </div>

                      {/* Micro Specs */}
                      <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[12px] text-stone-400">
                        <span className="flex items-center gap-1 text-teal-300">
                          <Clock className="w-3 h-3" />
                          {language === 'ar' ? service.pickupWindowAr : service.pickupWindow}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          {language === 'ar' ? service.supplierNameAr : service.supplierName}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Active Service Details & Booking Form */}
              <div className="lg:col-span-5 bg-stone-950/90 rounded-2xl p-4 sm:p-5 border border-stone-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="border-b border-stone-800 pb-3">
                    <span className="text-[11px] font-bold text-teal-400 block">
                      {t('commerce.sELECTEDSERVICE')}
                    </span>
                    <h3 className="font-bold text-base text-white mt-1">
                      {language === 'ar' ? selectedService.titleAr : selectedService.title}
                    </h3>
                    <p className="text-xs text-stone-300 mt-1">
                      {language === 'ar' ? selectedService.descriptionAr : selectedService.description}
                    </p>
                  </div>

                  {/* Weather / DAN Safety Note if any */}
                  {selectedService.weatherConditionCheck && (
                    <div className="p-2.5 bg-teal-950/40 rounded-xl border border-teal-800/40 text-[12px] text-teal-200 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        {language === 'ar'
                          ? selectedService.weatherConditionCheckAr
                          : selectedService.weatherConditionCheck}
                      </span>
                    </div>
                  )}

                  {/* Travelers & Hotel Config */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-stone-400 mb-1">
                        {t('commerce.numberOfGuests')}
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map((count) => (
                          <button
                            key={count}
                            onClick={() => setTravelersCount(count)}
                            className={`flex-1 py-1.5 min-h-[44px] rounded-lg font-bold border transition-colors cursor-pointer ${
                              travelersCount === count
                                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                                : 'bg-stone-850 text-stone-300 border-stone-700 hover:bg-stone-800'
                            }`}
                          >
                            {count} {count === 1 ? t('commerce.guestSingle') : t('commerce.guestPlural')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-400 mb-1">
                        {t('commerce.pickupDropoffLocation')}
                      </label>
                      <input
                        type="text"
                        value={pickupHotel}
                        onChange={(e) => setPickupHotel(e.target.value)}
                        placeholder="e.g. Ali Baba Hotel / Lighthouse Bay"
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:border-teal-400 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-stone-400 mb-1">
                        {t('commerce.specialNoteRequests')}
                      </label>
                      <input
                        type="text"
                        value={specialNote}
                        onChange={(e) => setSpecialNote(e.target.value)}
                        placeholder="e.g. Need gear size 42 & 38"
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:border-teal-400 text-xs"
                      />
                    </div>

                    {/* Checkbox: Auto Add to Active Trip Schedule */}
                    <label className="flex items-center gap-2 pt-1 text-stone-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={insertToTripSchedule}
                        onChange={(e) => setInsertToTripSchedule(e.target.checked)}
                        className="rounded border-stone-700 text-teal-500 focus:ring-teal-400"
                      />
                      <span>
                        {t('commerce.autoaddToActiveDay')}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Price & Immediate Book CTA */}
                <div className="pt-3 border-t border-stone-800 space-y-2.5">
                  {/* Currency Switcher */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400 font-medium">
                      {t('commerce.currency')}
                    </span>
                    <div className="flex items-center gap-1 bg-stone-900 p-0.5 rounded-lg border border-stone-800">
                      {(['EGP', 'USD', 'EUR'] as const).map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => setCurrencyMode(curr)}
                          className={`px-2 py-0.5 min-w-[44px] min-h-[44px] rounded text-[11px] font-bold transition-colors cursor-pointer ${
                            currencyMode === curr
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-sm'
                              : 'text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-stone-400">
                      {t('commerce.guaranteedPriceInclTax')}
                    </span>
                    <div className="text-end">
                      <span className="font-bold text-lg text-amber-400 font-mono">
                        {convertedPrice} {currencyMode}
                      </span>
                      {currencyMode !== 'EGP' && (
                        <span className="block text-[11px] text-stone-500 font-mono">
                          ≈ {totalPriceEGP.toLocaleString()} EGP (Fixed Escrow Rate)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Itemized Fee Breakdown Pill */}
                  <div className="p-2 rounded-xl bg-stone-900/80 border border-stone-800 text-[11px] text-stone-400 space-y-0.5 font-mono">
                    <div className="flex justify-between">
                      <span>• Base Operator Fare:</span>
                      <span>{Math.round(totalPriceEGP * 0.86).toLocaleString()} EGP</span>
                    </div>
                    <div className="flex justify-between text-teal-400/90">
                      <span>• 14% Egyptian VAT & Protected Area Fee:</span>
                      <span>{Math.round(totalPriceEGP * 0.14).toLocaleString()} EGP</span>
                    </div>
                  </div>

                  {(checkout.phase === 'priceChanged' || checkout.phase === 'failed') && checkout.outcome && checkout.outcome.kind !== 'confirmed' && (
                    <CheckoutIssuePanel
                      className="text-start"
                      priceChange={checkout.outcome.kind === 'priceChanged' ? checkout.outcome : null}
                      issue={checkout.outcome.kind === 'failed' ? checkout.outcome.issue : null}
                      busy={checkout.busy}
                      onConfirmPrice={() => { void checkout.confirmPrice(); }}
                      onRehold={() => { void checkout.rehold(); }}
                      onRetry={() => { void handleConfirmOrder(); }}
                      onSignIn={() => { setIntendedRoute('/book-now'); navigateTo('/auth/sign-in'); }}
                      onContactSupport={() => { onClose(); navigateTo('/help'); }}
                      onDismiss={checkout.reset}
                      alternativesQuery={
                        selectedService.skuId && checkout.lastRequest
                          ? {
                              tripId: checkout.lastRequest.tripId,
                              skuId: selectedService.skuId,
                              date: localCalendarDate(),
                              timeSlot: 'ASAP',
                              passengersCount: travelersCount,
                            }
                          : null
                      }
                      onPickAlternative={alt => {
                        checkout.reset();
                        const card = IN_DESTINATION_SERVICES.find(svc => svc.skuId === alt.skuId);
                        if (card) setSelectedServiceId(card.id);
                        else { onClose(); navigateTo('/book-now', { skuId: alt.skuId }); }
                      }}
                    />
                  )}

                  <button
                    disabled={isProcessing || checkout.busy || checkout.phase === 'priceChanged'}
                    onClick={handleConfirmOrder}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--accent-secondary)] via-[var(--accent-primary)] to-[var(--accent-primary)] text-[var(--accent-primary-ink)] font-black text-sm hover:brightness-110 disabled:opacity-50 transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessing || checkout.busy ? (
                      <span>{t('commerce.securingEscrowHold')}</span>
                    ) : (
                      <>
                        <span>{t('commerce.confirmInstantBookingNow')}</span>
                        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-3 text-xs text-stone-300">
                    <span>✓ Sinai Escrow Protection</span>
                    <span>·</span>
                    <span>✓ Direct Supplier Line</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* SUCCESS VOUCHER & CONFIRMATION SCREEN                                    */
          /* ========================================================================= */
          <div className="p-6 sm:p-8 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-400">
                {t('commerce.iNSTANTBOOKINGDISPATCHED')}
              </span>
              <h2 className="chart-heading font-bold text-2xl text-white mt-1">
                {language === 'ar' ? confirmedBooking?.service.titleAr : confirmedBooking?.service.title}
              </h2>
              <p className="text-stone-400 text-sm mt-1">
                {t('commerce.fulfillmentDispatchedDirectlyTo')}
              </p>
            </div>

            {/* Official Confirmation Voucher Card */}
            <div className="max-w-xl mx-auto bg-stone-950 rounded-2xl p-5 border border-stone-800 text-start space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div>
                  <span className="text-[11px] font-bold text-stone-400 block">
                    {t('commerce.cONFIRMATIONCODE')}
                  </span>
                  <span className="font-mono font-bold text-lg text-amber-400">
                    {confirmedBooking?.code}
                  </span>
                </div>
                <div className="text-end">
                  <span className="text-[11px] font-bold text-stone-400 block">
                    {t('commerce.sETTLEDINESCROW')}
                  </span>
                  <span className="font-mono font-bold text-base text-white">
                    {confirmedBooking?.totalPriceEGP} EGP
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 block">{t('commerce.provider')}</span>
                  <strong className="text-teal-300">
                    {language === 'ar' ? confirmedBooking?.service.supplierNameAr : confirmedBooking?.service.supplierName}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-400 block">{t('commerce.directPhone')}</span>
                  <strong className="font-mono text-white">{confirmedBooking?.service.supplierPhone}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block">{t('commerce.meetingPoint')}</span>
                  <strong className="text-stone-200">
                    {language === 'ar' ? confirmedBooking?.service.meetingPointAr : confirmedBooking?.service.meetingPoint}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-400 block">{t('commerce.estimatedFulfillment')}</span>
                  <strong className="text-amber-300 font-mono">
                    {language === 'ar' ? confirmedBooking?.service.pickupWindowAr : confirmedBooking?.service.pickupWindow}
                  </strong>
                </div>
              </div>

              {/* What to bring note */}
              <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 text-xs">
                <span className="font-bold text-stone-300 block mb-1">
                  {t('commerce.whatToPrepareBring')}
                </span>
                <ul className="list-disc list-inside text-stone-400 space-y-0.5">
                  {(language === 'ar' ? confirmedBooking?.service.whatToBringAr : confirmedBooking?.service.whatToBring)?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  handleReset();
                  navigateTo('/my-trip');
                }}
                className="px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:brightness-110 text-[var(--accent-primary-ink)] font-bold text-xs transition-colors cursor-pointer"
              >
                {t('commerce.viewInMyTrip')}
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-[var(--text-primary)] font-bold text-xs transition-colors cursor-pointer border border-stone-700"
              >
                {t('commerce.closeContinueTrip')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
