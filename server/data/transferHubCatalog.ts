import type { TransferBusScheduleEntity, TransferDriverEntity, TransferZonePriceEntity, TransferDestinationEntity } from '../db/schema';
import type { HubTierId } from '../../src/shared/types/transferHub';

/**
 * Seed for the future-ride hub. Inserted only when the tables are empty, so
 * an operations edit is not overwritten on the next boot.
 *
 * Long-haul sell prices follow the HTML matrix. Private supplier cost is the
 * matrix supplier figure itself (Cairo 2,100), so the spread is 400 EGP and
 * not a second 15% on top.
 */

export const HUB_TIER_FACTORS: Record<HubTierId, { priceFactor: number; supplierFactor: number }> = {
  shared: { priceFactor: 0.18, supplierFactor: 0.8 },
  private: { priceFactor: 1, supplierFactor: 1 },
  premium: { priceFactor: 1.42, supplierFactor: 0.85 }
};

export const HUB_ADDONS = [
  { id: 'child', priceEGP: 0 },
  { id: 'stop', priceEGP: 120 },
  { id: 'meet', priceEGP: 150 },
  { id: 'pet', priceEGP: 0 },
  { id: 'bluehole_tour', priceEGP: 200 },
  { id: 'luggage_xl', priceEGP: 80 }
] as const;

export const HUB_LUGGAGE_EGP = { small: 0, medium: 40, large: 120 } as const;

export const HUB_EXTRA_STOP_EGP = 250;
export const HUB_EARLY_DAYS = 3;
export const HUB_EARLY_RATE = 0.12;
export const HUB_RETURN_RATE = 0.85;
export const HUB_ASSIGN_LEAD_MS = 12 * 60 * 60 * 1000;

export interface HubDestination {
  id: string;
  labelEn: string;
  labelAr: string;
  subEn: string;
  subAr: string;
  priceAddEGP: number;
  /** Area destinations (Nuweiba, Siwa) price from their own matrix row. */
  kind: 'zone' | 'area';
}

/**
 * The seed rows for `db.transferDestinations`. The catalog is runtime-editable,
 * so this only exists to give a fresh store the same destinations the code
 * shipped with; an operations edit afterwards wins.
 */
export const HUB_DESTINATION_SEED: TransferDestinationEntity[] = [
  { id: 'masbat', labelEn: 'Masbat & Lighthouse', labelAr: 'المشباط والفانوس', subEn: 'Heart of Dahab', subAr: 'قلب دهب', priceAddEGP: 0, kind: 'zone', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'assala', labelEn: 'Assala', labelAr: 'العصلة', subEn: 'Local souq & homes', subAr: 'السوق والبيوت', priceAddEGP: 20, kind: 'zone', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'mashraba', labelEn: 'Eel Garden / Mashraba', labelAr: 'حديقة الأنقليس / المشربة', subEn: 'Dive center strip', subAr: 'شارع مراكز الغطس', priceAddEGP: 10, kind: 'zone', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'lagoon', labelEn: 'Lagoon & South', labelAr: 'اللاجونا والجنوب', subEn: 'Kite beach, resorts', subAr: 'شاطئ الكايت والمنتجعات', priceAddEGP: 40, kind: 'zone', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bluehole', labelEn: 'Blue Hole', labelAr: 'البلو هول', subEn: 'North, freedive spot', subAr: 'الشمال، بقعة الغطس الحر', priceAddEGP: 80, kind: 'zone', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'nuweiba', labelEn: 'Nuweiba', labelAr: 'نويبع', subEn: 'Port', subAr: 'الميناء', priceAddEGP: 0, kind: 'area', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'siwa', labelEn: 'Siwa Oasis', labelAr: 'واحة سيوة', subEn: 'Western desert', subAr: 'الصحراء الغربية', priceAddEGP: 0, kind: 'area', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
];

export const HUB_DESTINATIONS: HubDestination[] = [
  { id: 'masbat', labelEn: 'Masbat & Lighthouse', labelAr: 'المشباط والفانوس', subEn: 'Heart of Dahab', subAr: 'قلب دهب', priceAddEGP: 0, kind: 'zone' },
  { id: 'assala', labelEn: 'Assala', labelAr: 'عسلة', subEn: 'Local souq & homes', subAr: 'السوق والبيوت', priceAddEGP: 20, kind: 'zone' },
  { id: 'mashraba', labelEn: 'Eel Garden / Mashraba', labelAr: 'حديقة الأنقليس / المشربة', subEn: 'Dive center strip', subAr: 'شارع مراكز الغطس', priceAddEGP: 10, kind: 'zone' },
  { id: 'lagoon', labelEn: 'Lagoon & South', labelAr: 'اللاجونا والجنوب', subEn: 'Kite beach, resorts', subAr: 'شاطئ الكايت والمنتجعات', priceAddEGP: 40, kind: 'zone' },
  { id: 'bluehole', labelEn: 'Blue Hole', labelAr: 'البحيرة الزرقاء', subEn: 'North, freedive spot', subAr: 'شمال دهب', priceAddEGP: 80, kind: 'zone' },
  { id: 'nuweiba', labelEn: 'Nuweiba', labelAr: 'نويبع', subEn: 'Port', subAr: 'الميناء', priceAddEGP: 0, kind: 'area' },
  { id: 'siwa', labelEn: 'Siwa Oasis', labelAr: 'واحة سيوة', subEn: 'Western desert', subAr: 'الصحراء الغربية', priceAddEGP: 0, kind: 'area' }
];

/** Dahab micro-zone id → the existing distance-formula origin. */
export const ZONE_ORIGIN: Record<string, string> = {
  masbat: 'ZONE-MASBAT',
  assala: 'ZONE-ASSALA',
  mashraba: 'ZONE-EELGARDEN',
  lagoon: 'ZONE-LAGOON',
  bluehole: 'ZONE-BLUEHOLE'
};

const zone = (
  id: string,
  labelEn: string,
  labelAr: string,
  subEn: string,
  subAr: string,
  regionEn: string,
  privateEGP: number,
  sharedEGP: number,
  busEGP: number,
  supplierPrivateEGP: number,
  supplierBusEGP: number,
  lastMileEGP: number,
  distanceKm: number,
  durationEn: string,
  durationAr: string,
  haul: 'short' | 'long'
): TransferZonePriceEntity => ({
  id,
  labelEn,
  labelAr,
  subEn,
  subAr,
  regionEn,
  privateEGP,
  sharedEGP,
  busEGP,
  supplierPrivateEGP,
  supplierBusEGP,
  lastMileEGP,
  lastMileDriverDiscountEGP: 50,
  distanceKm,
  durationEn,
  durationAr,
  haul,
  active: true
});

export const HUB_ZONE_SEED: TransferZonePriceEntity[] = [
  zone('cairo', 'Cairo', 'القاهرة', 'Torgoman & Downtown', 'الترجمان ووسط البلد', 'Cairo', 2500, 450, 350, 2100, 280, 300, 560, '7h 30m', '٧ س ٣٠ د', 'long'),
  zone('cai', 'Cairo Airport', 'مطار القاهرة', 'CAI Terminal', 'مبنى الركاب CAI', 'Cairo', 2600, 480, 380, 2200, 300, 300, 545, '7h 10m', '٧ س ١٠ د', 'long'),
  zone('ssh', 'Sharm Airport', 'مطار شرم', 'SSH • 95km', 'شرم • ٩٥ كم', 'Sinai', 650, 120, 90, 500, 70, 0, 95, '1h 20m', '١ س ٢٠ د', 'short'),
  zone('hrg', 'Hurghada', 'الغردقة', 'El Dahar', 'الدهار', 'Red Sea', 2800, 520, 420, 2400, 340, 300, 420, '6h 40m', '٦ س ٤٠ د', 'long'),
  zone('lux', 'Luxor', 'الأقصر', 'East Bank', 'البر الشرقي', 'Upper', 4200, 780, 550, 3700, 440, 300, 780, '10h 20m', '١٠ س ٢٠ د', 'long'),
  zone('mans', 'Mansoura', 'المنصورة', 'Delta Station', 'موقف الدلتا', 'Delta', 3200, 600, 480, 2700, 380, 300, 650, '8h 50m', '٨ س ٥٠ د', 'long'),
  zone('alex', 'Alexandria', 'الإسكندرية', 'Mowaf El Gedid', 'الموقف الجديد', 'Alex', 3400, 620, 500, 2900, 400, 300, 720, '9h 10m', '٩ س ١٠ د', 'long'),
  zone('nuweiba', 'Nuweiba', 'نويبع', 'Port', 'الميناء', 'Sinai', 700, 150, 100, 550, 80, 0, 70, '1h 10m', '١ س ١٠ د', 'short'),
  zone('siwa', 'Siwa Oasis', 'واحة سيوة', 'West Bus', 'ويست باص', 'Western', 4800, 850, 600, 4200, 480, 350, 890, '12h', '١٢ س', 'long')
];

const bus = (
  id: string,
  originId: string,
  operatorId: string,
  operatorName: string,
  operatorNameAr: string,
  departLabel: string,
  arriveLabel: string,
  durationLabel: string,
  priceEGP: number,
  fromLabel: string,
  toLabel: string,
  seats: number
): TransferBusScheduleEntity => ({
  id, originId, operatorId, operatorName, operatorNameAr, departLabel, arriveLabel, durationLabel, priceEGP, fromLabel, toLabel, seats, active: true
});

export const HUB_BUS_SEED: TransferBusScheduleEntity[] = [
  bus('bus-cairo-gobus', 'cairo', 'gobus', 'Go Bus', 'جو باص', '11:40 PM الترجمان', '07:00 AM دهب', '7h 20m', 380, 'Cairo Torgoman', 'Dahab', 7),
  bus('bus-cairo-blue', 'cairo', 'bluebus', 'Blue Bus', 'بلو باص', '10:30 PM عبد المنعم رياض', '06:15 AM دهب', '7h 45m', 420, 'Cairo', 'Dahab', 12),
  bus('bus-cairo-we', 'cairo', 'webus', 'We Bus', 'وي باص', '09:00 PM', '05:00 AM', '8h', 350, 'Cairo', 'Sharm → Transfer', 5),
  bus('bus-cairo-east', 'cairo', 'eastdelta', 'East Delta', 'شرق الدلتا', '08:00 PM', '04:30 AM', '8h 30m', 320, 'Cairo', 'Dahab', 18),
  bus('bus-mans-east', 'mans', 'eastdelta', 'East Delta', 'شرق الدلتا', '07:00 PM المنصورة', '04:30 AM دهب', '9h 30m', 450, 'Mansoura', 'Dahab', 9),
  bus('bus-mans-gobus', 'mans', 'gobus', 'Go Bus', 'جو باص', '09:15 PM via Cairo', '07:00 AM دهب', '9h 45m', 480, 'Mansoura → Cairo → Dahab', 'Dahab', 4),
  bus('bus-alex-gobus', 'alex', 'gobus', 'Go Bus', 'جو باص', '09:30 PM الموقف الجديد', '07:30 AM دهب', '10h', 500, 'Alexandria', 'Dahab', 6),
  bus('bus-alex-blue', 'alex', 'bluebus', 'Blue Bus', 'بلو باص', '08:00 PM', '06:00 AM', '10h', 520, 'Alexandria', 'Dahab', 11),
  bus('bus-siwa-west', 'siwa', 'westbus', 'West Bus', 'ويست باص', '06:00 PM', '06:00 AM Siwa', '12h', 600, 'Cairo', 'Siwa', 8),
  bus('bus-hrg-gobus', 'hrg', 'gobus', 'Go Bus', 'جو باص', '11:00 PM', '06:00 AM Dahab', '7h', 420, 'Hurghada', 'Dahab', 10)
];

export const HUB_DRIVER_SEED: TransferDriverEntity[] = [
  {
    id: 'drv-ahmed',
    nameEn: 'Ahmed Bedouin',
    nameAr: 'أحمد البدوي',
    rating: 4.96,
    trips: 1240,
    langs: ['AR', 'EN', 'RU'],
    badgesEn: ['Top Rated', 'Desert Pro'],
    badgesAr: ['الأعلى تقييماً', 'خبير صحراء'],
    carEn: 'Toyota Prado 2023',
    carAr: 'تويوتا برادو 2023',
    initials: 'AB',
    verified: true,
    active: true,
    phone: '',
    plate: ''
  },
  {
    id: 'drv-mousa',
    nameEn: 'Mousa El Dahaby',
    nameAr: 'موسى الدهباوي',
    rating: 4.89,
    trips: 890,
    langs: ['AR', 'EN'],
    badgesEn: ['On-time King', 'Local Guide'],
    badgesAr: ['ملك المواعيد', 'دليل محلي'],
    carEn: 'Hyundai H1 Van',
    carAr: 'هيونداي H1',
    initials: 'MD',
    verified: true,
    active: true,
    phone: '',
    plate: ''
  },
  {
    id: 'drv-omar',
    nameEn: 'Omar Sinai',
    nameAr: 'عمر سيناء',
    rating: 4.92,
    trips: 1020,
    langs: ['AR', 'EN', 'IT'],
    badgesEn: ['Safe Driver', 'Pet Friendly'],
    badgesAr: ['سائق حذر', 'مناسب للحيوانات'],
    carEn: 'Kia Sportage',
    carAr: 'كيا سبورتاج',
    initials: 'OS',
    verified: true,
    active: true,
    phone: '',
    plate: ''
  }
];
