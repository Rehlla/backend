import type { TransferRoute, TransferTierDef } from '../../src/shared/types/transfers';

/**
 * Transfer route catalog — static reference data (mirrors the DKOS/research
 * homepage pattern). Served read-only via the transfer route service.
 *
 * In-Dahab zones use short distances and low flag-drop prices; Egypt-wide
 * corridors use the real road distance to Dahab.
 */
export const TRANSFER_TIERS: TransferTierDef[] = [
  {
    id: 'shared',
    labelEn: 'Shared Van',
    labelAr: 'فان مشترك',
    multiplier: 1,
    vehicleEn: 'Air-conditioned shared minivan',
    vehicleAr: 'ميني فان مكيف مشترك',
    capacity: 14,
    luggageEn: 'Luggage in the boot (one holdall per traveller)',
    luggageAr: 'المتعلقات في الصندوق (حقيبة لكل مسافر)'
  },
  {
    id: 'private',
    labelEn: 'Private Car',
    labelAr: 'سيارة خاصة',
    multiplier: 1.8,
    vehicleEn: 'Private air-conditioned sedan / 4-seat SUV',
    vehicleAr: 'سيارة خاصة مكيفة / دفع رباعي 4 مقاعد',
    capacity: 4,
    luggageEn: 'Luggage included (2 large suitcases + backpacks)',
    luggageAr: 'المتعلقات مشمولة (حقيبتان كبيرتان + حقائب ظهر)'
  },
  {
    id: 'premium',
    labelEn: 'Premium SUV',
    labelAr: 'سوبر / دفع رباعي فاخر',
    multiplier: 2.6,
    vehicleEn: 'Executive 4x4 (Prado / Land Cruiser)',
    vehicleAr: 'دفع رباعي فاخر (برادو / لاند كروزر)',
    capacity: 4,
    luggageEn: 'Premium luggage space & Wi-Fi on board',
    luggageAr: 'مساحة أمتعة فاخرة وواي فاي على متن الرحلة'
  }
];

const r = (
  id: string,
  originEn: string,
  originAr: string,
  originType: TransferRoute['originType'],
  transferType: TransferRoute['transferType'],
  latitude: number,
  longitude: number,
  distanceKm: number,
  basePriceEGP: number,
  pricePerKmEGP: number,
  baseDurationMinutes: number,
  extra: Partial<TransferRoute> = {}
): TransferRoute => ({
  id,
  origin: originEn,
  originEn,
  originAr,
  originType,
  destination: 'Dahab',
  destinationEn: 'Dahab',
  destinationAr: 'دهب',
  isWithinDahab: transferType === 'within_dahab',
  transferType,
  latitude,
  longitude,
  distanceKm,
  basePriceEGP,
  pricePerKmEGP,
  baseDurationMinutes,
  active: true,
  ...extra
});

/**
 * In-Dahab zones (origin = the zone itself). These are on-demand hops.
 */
const DAHAB_ZONES: TransferRoute[] = [
  r('ZONE-MASBAT', 'Masbat & Lighthouse', 'المشباط والفانوس', 'dahab_area', 'within_dahab', 28.4972, 34.5161, 2, 60, 15, 12),
  r('ZONE-ASSALA', 'Assala', 'عسلة', 'dahab_area', 'within_dahab', 28.4700, 34.5100, 4, 60, 15, 15),
  r('ZONE-EELGARDEN', 'Eel Garden / Mashraba', 'حديقة الأنقليس / المشربة', 'dahab_area', 'within_dahab', 28.5050, 34.5180, 1.5, 60, 15, 10),
  r('ZONE-LAGOON', 'Lagoon & South', 'اللاجونا والجنوب', 'dahab_area', 'within_dahab', 28.4800, 34.5200, 3, 60, 15, 15),
  // Day-trip hop north to Blue Hole (commonly booked as a "transfer car" from the centre)
  r('ZONE-BLUEHOLE', 'Blue Hole', 'البحيرة الزرقاء', 'dahab_area', 'within_dahab', 28.5590, 34.5370, 10, 100, 15, 25, { requiresFlightNumber: false }),
];

/**
 * Egypt-wide origins → Dahab. Airport origins get the 60-minute flight-delay
 * wait and a flight-number field; city origins do not.
 */
const EGYPT_CITIES: TransferRoute[] = [
  r('SSH-AIRPORT', 'Sharm El Sheikh Airport (SSH)', 'مطار شرم الشيخ', 'airport', 'anywhere', 27.9773, 34.3947, 96, 900, 22, 90, {
    airportWaitMinutes: 60, requiresFlightNumber: true
  }),
  r('CAI-CITY', 'Cairo', 'القاهرة', 'city', 'anywhere', 30.0444, 31.2357, 550, 2500, 20, 420),
  r('GIZ-CITY', 'Giza', 'الجيزة', 'city', 'anywhere', 30.0131, 31.2089, 555, 2500, 20, 425),
  r('HRG-CITY', 'Hurghada', 'الغردقة', 'city', 'anywhere', 27.2579, 33.8116, 230, 1400, 22, 210),
  r('MAA-AIRPORT', 'Marsa Alam Airport (RMF)', 'مطار مرسى علم', 'airport', 'anywhere', 25.5571, 34.5837, 160, 1200, 22, 150, {
    airportWaitMinutes: 60, requiresFlightNumber: true
  }),
  r('LXR-CITY', 'Luxor', 'الأقصر', 'city', 'anywhere', 25.6872, 32.6396, 470, 2400, 20, 400),
  r('SUZ-CITY', 'Suez', 'السويس', 'city', 'anywhere', 29.9668, 32.5498, 400, 2200, 20, 330),
  r('ISM-CITY', 'Ismaïlia', 'الإسماعيلية', 'city', 'anywhere', 30.5965, 32.2715, 430, 2200, 20, 350),
  r('NWB-CITY', 'Nuweiba', 'نويبع', 'city', 'anywhere', 29.0311, 34.6769, 90, 900, 22, 75, { airportWaitMinutes: 60, requiresFlightNumber: false }),
  r('TAB-CITY', 'Taba / Taba Heights', 'طابا', 'city', 'anywhere', 29.4917, 34.8970, 200, 1400, 22, 150),
  r('CAT-CITY', "St. Catherine's", 'سانت كاترين', 'city', 'anywhere', 28.5622, 33.9609, 130, 1100, 22, 120),
];

export const TRANSFER_ROUTE_CATALOG: TransferRoute[] = [...DAHAB_ZONES, ...EGYPT_CITIES];
