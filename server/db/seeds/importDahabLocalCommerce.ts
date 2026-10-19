import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../database';
import { seedPath } from '../paths';
import {
  SupplierEntity,
  RawSupplierSourceEntity,
  RawOfferSourceEntity,
  SupplierOfferEntity,
  MarketPriceStatEntity,
  SocialAccountEntity,
  SourceRecordEntity,
  PriceObservationEntity,
  VerificationLevel,
  PricingBasis,
  FreshnessStatus,
  LocalCommerceSourceType,
  ActivityDetailEntity,
  ResearchSourceEntity,
  TemporalFactEntity,
  EvidenceNodeEntity
} from '../schema';

/**
 * Legacy activity place references.
 *
 * The canonical activities below were originally written with ids like
 * 'PLC-BLUE-HOLE' that no place row ever carried — the place atlas uses
 * 'place_blue_hole_sanctuary'. The catalogue rendered those activities without
 * a resolved place (Explore fell back to generic text). Map them to the real
 * atlas ids so every activity placeId resolves.
 */
const LEGACY_PLACE_ID_TO_ATLAS: Record<string, string> = {
  'PLC-BLUE-HOLE': 'place_blue_hole_sanctuary',
  'PLC-DAHAB-LAGUNA': 'place_laguna_sandspit',
  'PLC-LIGHTHOUSE-REEF': 'place_lighthouse_reef',
  'PLC-MOUNT-TWILAT': 'place_mount_twilat',
  'PLC-RAS-ABU-GALUM': 'place_ras_abu_galum',
  'PLC-WADI-GNAI': 'place_wadi_gnai_crags'
};

function normalizeActivityPlaceId(id: string): string {
  return LEGACY_PLACE_ID_TO_ATLAS[id] || id;
}

export interface ImportResult {
  success: boolean;
  importedAt: string;
  suppliersCount: number;
  suppliersCreated: number;
  suppliersUpdated: number;
  rawSupplierSourcesCount: number;
  rawOfferSourcesCount: number;
  offersCount: number;
  offersCreated: number;
  offersUpdated: number;
  socialAccountsCount: number;
  sourceRecordsCount: number;
  priceObservationsCount: number;
  marketStatsCount: number;
  dkosSourcesCreated: number;
  dkosFactsCreated: number;
  evidenceNodesCreated: number;
  durationMs: number;
  summary: string;
}

/**
 * Normalizes phone numbers for canonical storage
 */
export function normalizePhoneNumber(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return `+20 ${cleaned.substring(1, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  if (cleaned.startsWith('+201') && cleaned.length === 13) {
    return `+20 ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
  return raw.trim();
}

/**
 * Computes deterministic fingerprint hash for entities
 */
export function computeFingerprint(...parts: string[]): string {
  const normalized = parts.map(p => (p || '').toLowerCase().trim().replace(/\s+/g, ' ')).join(':');
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Main Idempotent Importer for Dahab Local Commerce Intelligence
 */
export function importDahabLocalCommerce(options: { forceReload?: boolean } = {}): ImportResult {
  const startTime = Date.now();
  let suppliersCreated = 0;
  let suppliersUpdated = 0;
  let offersCreated = 0;
  let offersUpdated = 0;
  let dkosSourcesCreated = 0;
  let dkosFactsCreated = 0;
  let evidenceNodesCreated = 0;

  return db.runInTransaction(() => {
    // 1. Load Master Dataset JSON with fallback
    let datasetPath = seedPath('dahab_local_commerce.json');
    let rawData: any = null;

    if (fs.existsSync(datasetPath)) {
      try {
        const fileContent = fs.readFileSync(datasetPath, 'utf-8');
        rawData = JSON.parse(fileContent);
      } catch (err) {
        console.warn('[LocalCommerceImporter] Failed to parse JSON file, using structured internal fallback:', err);
      }
    }

    if (!rawData) {
      throw new Error(`Master dataset not found at ${datasetPath}`);
    }

    const { rawSupplierSources = [], rawOfferSources = [] } = rawData;

    // 2. Ensure Raw Sources Table in DB
    if (!db.state.rawSupplierSources) db.state.rawSupplierSources = [];
    if (!db.state.rawOfferSources) db.state.rawOfferSources = [];
    if (!db.state.supplierOffers) db.state.supplierOffers = [];
    if (!db.state.marketPriceStats) db.state.marketPriceStats = [];

    // Ingest / Update Raw Supplier Sources
    for (const rawSup of rawSupplierSources) {
      const existingIdx = db.rawSupplierSources.findIndex(s => s.id === rawSup.id);
      const entity: RawSupplierSourceEntity = {
        id: rawSup.id,
        sourceType: rawSup.sourceType as LocalCommerceSourceType,
        sourceReference: rawSup.sourceReference,
        sourceUrl: rawSup.sourceUrl,
        sourceImage: rawSup.sourceImage,
        sourceCapturedAt: rawSup.sourceCapturedAt || new Date().toISOString(),
        supplierNameRaw: rawSup.supplierNameRaw,
        supplierNameArRaw: rawSup.supplierNameArRaw,
        contactRaw: rawSup.contactRaw,
        whatsappRaw: rawSup.whatsappRaw,
        socialRaw: rawSup.socialRaw,
        addressRaw: rawSup.addressRaw,
        bookingInstructionsRaw: rawSup.bookingInstructionsRaw,
        extractedConfidence: rawSup.extractedConfidence ?? 0.95,
        verificationStatus: rawSup.verificationStatus as VerificationLevel,
        verifiedAt: rawSup.verifiedAt,
        notes: rawSup.notes,
        createdAt: rawSup.createdAt || new Date().toISOString()
      };

      if (existingIdx >= 0) {
        db.rawSupplierSources[existingIdx] = entity;
      } else {
        db.rawSupplierSources.push(entity);
      }

      // Link to DKOS ResearchSourceEntity
      const dkosSourceId = `SRC-${rawSup.sourceReference.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
      const existingDkosSrc = db.researchSources.find(s => s.id === dkosSourceId);
      if (!existingDkosSrc) {
        db.researchSources.push({
          id: dkosSourceId,
          name: `Flyer/Registry Source: ${rawSup.supplierNameRaw}`,
          sourceType: rawSup.sourceType === 'REGULATORY' ? 'AUTHORITATIVE' : 'MARKETPLACE',
          authorityWeight: rawSup.verificationStatus === 'REGULATORY_VERIFIED' ? 0.98 : (rawSup.verificationStatus === 'SUPPLIER_CONFIRMED' ? 0.90 : 0.82),
          publisher: rawSup.supplierNameRaw,
          documentRef: rawSup.sourceReference,
          url: rawSup.sourceUrl,
          lastAudited: rawSup.verifiedAt || new Date().toISOString(),
          revalidationIntervalDays: 30
        });
        dkosSourcesCreated++;
      }
    }

    // Ingest / Update Raw Offer Sources
    for (const rawOff of rawOfferSources) {
      const existingIdx = db.rawOfferSources.findIndex(o => o.id === rawOff.id);
      const entity: RawOfferSourceEntity = {
        id: rawOff.id,
        rawSupplierSourceId: rawOff.rawSupplierSourceId,
        sourceType: rawOff.sourceType as LocalCommerceSourceType,
        sourceReference: rawOff.sourceReference,
        supplierNameRaw: rawOff.supplierNameRaw,
        activityNameRaw: rawOff.activityNameRaw,
        activityNameArRaw: rawOff.activityNameArRaw,
        destinationRaw: rawOff.destinationRaw,
        priceRaw: rawOff.priceRaw,
        currencyRaw: rawOff.currencyRaw || 'EGP',
        pricingBasisRaw: rawOff.pricingBasisRaw,
        singlePriceRaw: rawOff.singlePriceRaw,
        doublePriceRaw: rawOff.doublePriceRaw,
        vipPriceRaw: rawOff.vipPriceRaw,
        scheduleRaw: rawOff.scheduleRaw,
        durationRaw: rawOff.durationRaw,
        inclusionsRaw: rawOff.inclusionsRaw,
        exclusionsRaw: rawOff.exclusionsRaw,
        transportRaw: rawOff.transportRaw,
        equipmentRaw: rawOff.equipmentRaw,
        bookingConditionsRaw: rawOff.bookingConditionsRaw,
        extractedConfidence: rawOff.extractedConfidence ?? 0.95,
        verificationStatus: rawOff.verificationStatus as VerificationLevel,
        notes: rawOff.notes,
        createdAt: rawOff.createdAt || new Date().toISOString()
      };

      if (existingIdx >= 0) {
        db.rawOfferSources[existingIdx] = entity;
      } else {
        db.rawOfferSources.push(entity);
      }
    }

    // 3. Process Canonical Suppliers
    // Map raw suppliers into normalized Canonical Supplier Entities
    const supplierMapping: Record<string, {
      id: string;
      businessName: string;
      businessNameAr: string;
      category: 'transfer' | 'diving' | 'hotel' | 'safari' | 'restaurant' | 'logistics';
      aliases: string[];
      phone: string;
      whatsappNumbers: string[];
      email: string;
      area: string;
      tier: 'Tier 1 Certified' | 'Tier 2 Certified' | 'Vetted Local Partner';
      status: 'Active' | 'Pending_Verification' | 'Suspended';
      rating: number;
      reviewCount: number;
      licenseNumber: string;
      cdwsVerified: boolean;
      verificationStatus: VerificationLevel;
      verificationSources: string[];
      sourceReferences: string[];
      serviceTypes: string[];
    }> = {
      'RAW-SUP-001': {
        id: 'SUP-KING-SAFARI',
        businessName: 'King Safari Dahab',
        businessNameAr: 'كينج سفاري دهب',
        category: 'safari',
        aliases: ['King Safari', 'كينج سفاري', 'كينج سفاري ترافيل', 'King Safari Dahab Tours'],
        phone: '+20 100 682 8996',
        whatsappNumbers: ['+201006828996'],
        email: 'info@kingsafaritravel.com',
        area: 'El Masbat & Tourist Walkway',
        tier: 'Tier 1 Certified',
        status: 'Active',
        rating: 4.8,
        reviewCount: 215,
        licenseNumber: 'MOT-SAFARI-DHB-#319',
        cdwsVerified: false,
        verificationStatus: 'WEB_CONFIRMED',
        verificationSources: ['flyer-king-safari-2026-p1', 'kingsafaritravel.com'],
        sourceReferences: ['flyer-king-safari-2026-p1'],
        serviceTypes: ['Quad Safari', 'Blue Hole Abu Galum', 'Ras Shitan Wishwashi', 'Mount Moses Trek', 'Three Pools']
      },
      'RAW-SUP-002': {
        id: 'RAW-SUP-BAKRY-SAFARI',
        businessName: 'Bakry Safari Dahab',
        businessNameAr: 'بكرى سفاري دهب',
        category: 'safari',
        aliases: ['Bakry Safari', 'بكرى سفاري', 'بكري سفاري دهب', 'Bakry Tours'],
        phone: '+20 109 923 4881',
        whatsappNumbers: ['+201099234881', '+201145229103'],
        email: 'bakry.safari@gmail.com',
        area: 'Assalah Market & Lighthouse Kiosk',
        tier: 'Vetted Local Partner',
        status: 'Active',
        rating: 4.6,
        reviewCount: 94,
        licenseNumber: 'LOCAL-TOUR-DHB-#882',
        cdwsVerified: false,
        verificationStatus: 'SOURCE_REPORTED',
        verificationSources: ['flyer-bakry-safari-2026'],
        sourceReferences: ['flyer-bakry-safari-2026'],
        serviceTypes: ['Beach Buggy Quad', 'Blue Lagoon Transfers', 'Ras Shitan Trip']
      },
      'RAW-SUP-003': {
        id: 'SUP-RED-SEA-RELAX',
        businessName: 'Red Sea Relax Dive Resort',
        businessNameAr: 'ريد سي ريلاكس لخدمات الغوص والمنتجع',
        category: 'diving',
        aliases: ['Red Sea Relax', 'ريد سي ريلاكس', 'Red Sea Relax Dive Centre', 'PADI CDC #104'],
        phone: '+20 100 143 8266',
        whatsappNumbers: ['+201001438266'],
        email: 'info@red-sea-relax.com',
        area: 'Lighthouse Beachfront',
        tier: 'Tier 1 Certified',
        status: 'Active',
        rating: 4.9,
        reviewCount: 420,
        licenseNumber: 'CDWS-DHB-104',
        cdwsVerified: true,
        verificationStatus: 'REGULATORY_VERIFIED',
        verificationSources: ['cdws-official-registry-2026', 'padi.com/dive-center/red-sea-relax'],
        sourceReferences: ['cdws-official-registry-2026'],
        serviceTypes: ['PADI Courses', 'Discover Scuba Diving', 'Blue Hole Guided Dives', 'Canyon Guided Dives']
      },
      'RAW-SUP-004': {
        id: 'SUP-DESERT-DIVERS',
        businessName: 'Desert Divers Dahab',
        businessNameAr: 'ديزرت دايفرز دهب للمغامرات والغوص',
        category: 'diving',
        aliases: ['Desert Divers', 'ديزرت دايفرز', 'Desert Divers Eco Adventures'],
        phone: '+20 100 684 0300',
        whatsappNumbers: ['+201006840300'],
        email: 'info@desert-divers.com',
        area: 'Peace Road, Lighthouse',
        tier: 'Tier 1 Certified',
        status: 'Active',
        rating: 4.9,
        reviewCount: 380,
        licenseNumber: 'CDWS-DHB-092',
        cdwsVerified: true,
        verificationStatus: 'REGULATORY_VERIFIED',
        verificationSources: ['cdws-official-registry-2026', 'desert-divers.com'],
        sourceReferences: ['cdws-official-registry-2026'],
        serviceTypes: ['Camel Diving Safari', 'Wadi Gnai Rock Climbing', 'Freediving', 'Guided Dives']
      },
      'RAW-SUP-005': {
        id: 'SUP-POSEIDON-DIVERS',
        businessName: 'Poseidon Divers Dahab',
        businessNameAr: 'بوسيدون دايفرز دهب',
        category: 'diving',
        aliases: ['Poseidon Divers', 'بوسيدون دايفرز', 'Poseidon CDC Dahab'],
        phone: '+20 100 568 2145',
        whatsappNumbers: ['+201005682145'],
        email: 'dive@poseidondivers.com',
        area: 'Masbat Bay Promenade',
        tier: 'Tier 1 Certified',
        status: 'Active',
        rating: 4.8,
        reviewCount: 290,
        licenseNumber: 'CDWS-DHB-071',
        cdwsVerified: true,
        verificationStatus: 'REGULATORY_VERIFIED',
        verificationSources: ['cdws-official-registry-2026', 'poseidondivers.com'],
        sourceReferences: ['cdws-official-registry-2026'],
        serviceTypes: ['PADI CDC Training', 'Technical Diving TDI', 'Recreational Guided Dives']
      },
      'RAW-SUP-006': {
        id: 'SUP-SINAI-BEDOUIN-GUILD',
        businessName: 'Sinai Desert & Mountain Bedouin Guild',
        businessNameAr: 'رابطة أدلاء الصحراء والجبال البدوية (قبيلة المزينة)',
        category: 'safari',
        aliases: ['Muzeina Bedouin Guides', 'أدلاء قبيلة المزينة', 'Sinai Bedouin Treks', 'Bedouin Guild'],
        phone: '+20 109 451 7732',
        whatsappNumbers: ['+201094517732'],
        email: 'elders@muzeina-sinai.org',
        area: 'Assalah Bedouin Village',
        tier: 'Tier 1 Certified',
        status: 'Active',
        rating: 5.0,
        reviewCount: 512,
        licenseNumber: 'TRIBAL-BEDOUIN-GUILD-SINAI-01',
        cdwsVerified: false,
        verificationStatus: 'SUPPLIER_CONFIRMED',
        verificationSources: ['bedouin-guild-sinai-2026'],
        sourceReferences: ['bedouin-guild-sinai-2026'],
        serviceTypes: ['Mount Moses Sunrise Hike', 'White Canyon & Ain Khodra', 'Deep Desert Camping', 'Wadi Gnai Bouldering']
      },
      'RAW-SUP-007': {
        id: 'SUP-DAHAB-SAFARI-TOURS',
        businessName: 'Dahab Safari Day Tours & Transfers',
        businessNameAr: 'دهب سفاري للرحلات اليومية والانتقالات',
        category: 'safari',
        aliases: ['Dahab Safari Tours', 'دهب سفاري ترافيل', 'Dahab Safari Transfers'],
        phone: '+20 102 334 9912',
        whatsappNumbers: ['+201023349912'],
        email: 'bookings@dahabsafari.com',
        area: 'Mashraba Street',
        tier: 'Tier 2 Certified',
        status: 'Active',
        rating: 4.7,
        reviewCount: 165,
        licenseNumber: 'MOT-SINAI-TRF-#5102',
        cdwsVerified: false,
        verificationStatus: 'WEB_CONFIRMED',
        verificationSources: ['flyer-dahab-safari-tours-2026', 'dahabsafari.com'],
        sourceReferences: ['flyer-dahab-safari-tours-2026'],
        serviceTypes: ['Glass Bottom Boat', 'Sharm Airport Transfers', 'Three Pools Excursions']
      },
      'RAW-SUP-008': {
        id: 'SUP-LAGUNA-WATERSPORTS',
        businessName: 'Dahab Laguna Wind & Kitesurf Station',
        businessNameAr: 'محطة لاجونا لركوب الأمواج والشراع دهب',
        category: 'safari',
        aliases: ['Laguna Kitesurf Station', 'محطة كايت سيرف لاجونا', 'Dahab Windsurf Center'],
        phone: '+20 101 776 5431',
        whatsappNumbers: ['+201017765431'],
        email: 'station@dahab-watersports.com',
        area: 'Laguna Sandspit',
        tier: 'Tier 1 Certified',
        status: 'Active',
        rating: 4.8,
        reviewCount: 178,
        licenseNumber: 'MOT-WATERSPORTS-DHB-#440',
        cdwsVerified: false,
        verificationStatus: 'SUPPLIER_CONFIRMED',
        verificationSources: ['laguna-watersports-center-2026'],
        sourceReferences: ['laguna-watersports-center-2026'],
        serviceTypes: ['Kitesurfing Lessons', 'Windsurfing Rental', 'Laguna Flatwater Coaching']
      }
    };

    for (const [rawId, supData] of Object.entries(supplierMapping)) {
      const fingerprint = computeFingerprint(supData.businessName, supData.phone);
      const existingIdx = db.suppliers.findIndex(s => s.id === supData.id || s.fingerprint === fingerprint || s.businessName.toLowerCase() === supData.businessName.toLowerCase());

      const supplierEntity: SupplierEntity = {
        id: supData.id,
        businessName: supData.businessName,
        businessNameAr: supData.businessNameAr,
        displayName: `${supData.businessName} (${supData.businessNameAr})`,
        aliases: supData.aliases,
        category: supData.category,
        tier: supData.tier,
        status: supData.status,
        leadContact: `${supData.businessName} Reservations (${supData.phone})`,
        phone: supData.phone,
        phoneNumbers: [supData.phone],
        whatsappNumbers: supData.whatsappNumbers,
        email: supData.email,
        area: supData.area,
        licenseNumber: supData.licenseNumber,
        cdwsVerified: supData.cdwsVerified,
        rating: supData.rating,
        reviewCount: supData.reviewCount,
        verificationStatus: supData.verificationStatus,
        verificationSources: supData.verificationSources,
        sourceReferences: supData.sourceReferences,
        serviceTypes: supData.serviceTypes,
        fingerprint,
        onboardedAt: '2026-08-20',
        approvedBy: 'Dahab Operations & Provenance Engine'
      };

      if (existingIdx >= 0) {
        // Merge without overwriting verified contact if existing was already verified
        const existing = db.suppliers[existingIdx];
        db.suppliers[existingIdx] = {
          ...existing,
          ...supplierEntity,
          aliases: Array.from(new Set([...(existing.aliases || []), ...(supplierEntity.aliases || [])])),
          verificationSources: Array.from(new Set([...(existing.verificationSources || []), ...(supplierEntity.verificationSources || [])])),
          sourceReferences: Array.from(new Set([...(existing.sourceReferences || []), ...(supplierEntity.sourceReferences || [])])),
          serviceTypes: Array.from(new Set([...(existing.serviceTypes || []), ...(supplierEntity.serviceTypes || [])]))
        };
        suppliersUpdated++;
      } else {
        db.suppliers.push(supplierEntity);
        suppliersCreated++;
      }

      // Emitting Temporal Fact for Supplier Legitimacy
      const factId = `FACT-SUPPLIER-VERIFY-${supData.id}`;
      const existingFact = db.temporalFacts.find(f => f.id === factId);
      if (!existingFact) {
        db.temporalFacts.push({
          id: factId,
          subjectId: supData.id,
          subjectType: 'SUPPLIER',
          predicate: 'commercial_verification_status',
          value: {
            verificationStatus: supData.verificationStatus,
            cdwsVerified: supData.cdwsVerified,
            tier: supData.tier,
            licenseNumber: supData.licenseNumber
          },
          primarySourceId: `SRC-${(supData.sourceReferences[0] || 'REGISTRY').toUpperCase().replace(/[^A-Z0-9]/g, '-')}`,
          sourceType: supData.cdwsVerified ? 'AUTHORITATIVE' : 'VERIFIED_LOCAL',
          observedAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          validFrom: new Date().toISOString(),
          confidence: supData.verificationStatus === 'REGULATORY_VERIFIED' ? 0.99 : 0.90,
          confidenceTier: supData.verificationStatus === 'REGULATORY_VERIFIED' ? 'VERY_HIGH' : 'HIGH',
          status: 'CURRENT',
          verificationOwner: 'Local Commerce Audit Engine',
          notes: `Verified local supplier entity with CDWS badge: ${supData.cdwsVerified}`
        });
        dkosFactsCreated++;
      }
    }

    // 4. Ensure Canonical Activities exist in `db.activities`
    // The fields below are all required by ActivityDetailEntity where these
    // definitions are consumed. Leaving them inside Partial<> meant an omission
    // would seed an activity with undefined duration, price or booking mode and
    // only surface as a blank card in the UI. Requiring them here fails at the
    // definition instead.
    const canonicalActivityDefinitions: Array<
      Partial<ActivityDetailEntity> &
        Pick<
          ActivityDetailEntity,
          'id' | 'titleEn' | 'titleAr' | 'placeId' | 'areaId' |
          'durationMinutes' | 'accessMethod' | 'difficulty' | 'basePriceEGP' | 'bookingMode'
        > & { category: any }
    > = [
      {
        id: 'ACT-BLUE-HOLE-SAFARI',
        titleEn: 'Blue Hole & Abu Galum Marine Protected Area Safari',
        titleAr: 'سفاري البلو هول ومحمية أبو جالوم والبلو لاجون',
        category: 'safari',
        placeId: 'PLC-BLUE-HOLE',
        areaId: 'blue_hole',
        durationMinutes: 540,
        accessMethod: '4X4',
        difficulty: 'All Levels',
        basePriceEGP: 550,
        bookingMode: 'REQUEST_NOW'
      },
      {
        id: 'ACT-QUAD-TWILAT',
        titleEn: 'Quad Bike Sunset Safari to Jabal Al-Tawilat & Desert Bedouin Camp',
        titleAr: 'سفاري البيتش باجي وغروب الشمس في جبل الطويلات',
        category: 'safari',
        placeId: 'PLC-WADI-GNAI',
        areaId: 'wadi_gnai',
        durationMinutes: 150,
        accessMethod: 'VEHICLE',
        difficulty: 'Beginner',
        basePriceEGP: 350,
        bookingMode: 'BOOK_NOW'
      },
      {
        id: 'ACT-WISHWASHI-EXPEDITION',
        titleEn: 'Ras Shitan & Wadi El-Wishwashi Canyon Natural Pool Adventure',
        titleAr: 'رحلة استكشاف وادي الوشواش والسباحة في عين المياه العذبة ورأس شيطان',
        category: 'safari',
        placeId: 'PLC-WADI-GNAI',
        areaId: 'wadi_gnai',
        durationMinutes: 630,
        accessMethod: '4X4',
        difficulty: 'Intermediate',
        basePriceEGP: 750,
        bookingMode: 'REQUEST_NOW'
      },
      {
        id: 'ACT-THREE-POOLS-SAFARI',
        titleEn: 'Three Pools Snorkeling & Southern Oasis Safari',
        titleAr: 'سفاري السنوركلينج في الثري بولز والواحة الجنوبية',
        category: 'safari',
        placeId: 'PLC-WADI-GNAI',
        areaId: 'wadi_gnai',
        durationMinutes: 360,
        accessMethod: 'VEHICLE',
        difficulty: 'All Levels',
        basePriceEGP: 400,
        bookingMode: 'BOOK_NOW'
      },
      {
        id: 'ACT-MOUNT-MOSES-TREK',
        titleEn: 'Mount Moses (Jabal Mousa) Summit Sunrise & St. Catherine Monastery Trek',
        titleAr: 'صعود قمة جبل موسى لشروق الشمس وزيارة دير سانت كاترين',
        category: 'safari',
        placeId: 'PLC-MOUNT-TWILAT',
        areaId: 'wadi_gnai',
        durationMinutes: 930,
        accessMethod: 'HIKE',
        difficulty: 'Advanced',
        basePriceEGP: 950,
        bookingMode: 'REQUEST_NOW'
      },
      {
        id: 'ACT-WHITE-CANYON-SAFARI',
        titleEn: 'White Canyon & Ain Khodra Oasis 4x4 Desert Crossing',
        titleAr: 'سفاري الوادي الأبيض وواحة عين خضرة بالدفع الرباعي',
        category: 'safari',
        placeId: 'PLC-MOUNT-TWILAT',
        areaId: 'wadi_gnai',
        durationMinutes: 600,
        accessMethod: '4X4',
        difficulty: 'Intermediate',
        basePriceEGP: 1200,
        bookingMode: 'REQUEST_NOW'
      },
      {
        id: 'ACT-INTRO-DISCOVER-DIVE',
        titleEn: 'Discover Scuba Diving (DSD) - First Time Beginner Shore Dive',
        titleAr: 'تجربة الغوص الأولى للمبتدئين (ديسكفر سكوبا) مع مدرب معتمد',
        category: 'diving',
        placeId: 'PLC-LIGHTHOUSE-REEF',
        areaId: 'lighthouse',
        durationMinutes: 180,
        accessMethod: 'SHORE',
        difficulty: 'Beginner',
        basePriceEGP: 1450,
        bookingMode: 'BOOK_NOW'
      },
      {
        id: 'ACT-BLUE-HOLE-BELLS-DIVE',
        titleEn: 'Certified Guided Dive - The Bells & Blue Hole Saddle Drop',
        titleAr: 'غوصة موجهة للبلو هول ومنطقة البلز للغواصين المعتمدين',
        category: 'diving',
        placeId: 'PLC-BLUE-HOLE',
        areaId: 'blue_hole',
        durationMinutes: 240,
        accessMethod: 'SHORE',
        difficulty: 'Advanced',
        basePriceEGP: 1100,
        bookingMode: 'BOOK_NOW'
      },
      {
        id: 'ACT-CAMEL-DIVING-SAFARI',
        titleEn: 'Eco Camel Diving Safari to Ras Abu Galum Reserve (2 Dives)',
        titleAr: 'سفاري الغوص البيئي بالجمال إلى رأس أبو جالوم (غطستان + غداء)',
        category: 'diving',
        placeId: 'PLC-RAS-ABU-GALUM',
        areaId: 'ras_abu_galum',
        durationMinutes: 570,
        accessMethod: 'CAMEL',
        difficulty: 'Intermediate',
        basePriceEGP: 2400,
        bookingMode: 'REQUEST_NOW'
      },
      {
        id: 'ACT-WADI-GNAI-CLIMBING',
        titleEn: 'Granite Bouldering & Single-Pitch Sport Climbing in Wadi Gnai',
        titleAr: 'تسلق صخور الجرانيت والبولدرينج الطبيعي في وادي قني',
        category: 'safari',
        placeId: 'PLC-WADI-GNAI',
        areaId: 'wadi_gnai',
        durationMinutes: 270,
        accessMethod: '4X4',
        difficulty: 'Intermediate',
        basePriceEGP: 1600,
        bookingMode: 'REQUEST_NOW'
      },
      {
        id: 'ACT-LAGUNA-KITESURF',
        titleEn: 'Private 2-Hour Kitesurfing Coaching & Flatwater Progression',
        titleAr: 'درس تدريب كايت سيرف وركوب الشراع الخاص في لاجونا دهب',
        category: 'water_sport',
        placeId: 'PLC-DAHAB-LAGUNA',
        areaId: 'laguna',
        durationMinutes: 120,
        accessMethod: 'SHORE',
        difficulty: 'Beginner',
        basePriceEGP: 2200,
        bookingMode: 'REQUEST_NOW'
      },
      {
        id: 'ACT-GLASS-BOTTOM-BOAT',
        titleEn: 'Glass Bottom Coral Viewing Boat Cruise (Napoleon Reef)',
        titleAr: 'جولة القارب الزجاجي لمشاهدة الشعاب المرجانية ورأس نابليون',
        category: 'water_sport',
        placeId: 'PLC-LIGHTHOUSE-REEF',
        areaId: 'lighthouse',
        durationMinutes: 90,
        accessMethod: 'BOAT',
        difficulty: 'All Levels',
        basePriceEGP: 350,
        bookingMode: 'BOOK_NOW'
      }
    ];

    for (const actDef of canonicalActivityDefinitions) {
      const idx = db.activities.findIndex(a => a.id === actDef.id);
      const fullAct: ActivityDetailEntity = {
        id: actDef.id,
        // No skuId. This used to synthesise one from the activity id — 'ACT-QUAD-TWILAT'
        // became 'SKU-QUAD-TWILAT' — and nothing ever created the matching row in
        // db.productSkus, so every activity seeded here carried a reference to
        // inventory that does not exist. bookabilityReconciler assigns a skuId
        // only when a real sellable product backs the activity.
        titleEn: actDef.titleEn,
        titleAr: actDef.titleAr,
        category: actDef.category,
        placeId: normalizeActivityPlaceId(actDef.placeId),
        areaId: actDef.areaId,
        durationMinutes: actDef.durationMinutes,
        accessMethod: actDef.accessMethod,
        difficulty: actDef.difficulty,
        experienceLevelRequired: actDef.difficulty,
        basePriceEGP: actDef.basePriceEGP,
        bookingMode: actDef.bookingMode,
        seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        environmentalSensitivities: {
          requiresDaylight: true
        },
        dependencies: [],
        preparationTips: ['Comfortable clothing', 'Footwear suitable for terrain'],
        preparationTipsAr: ['ملابس مريحة', 'أحذية مناسبة للموقع'],
        travelerFitPersonas: ['Adventure Seeker', 'Cultural Explorer']
      };

      if (idx >= 0) {
        db.activities[idx] = { ...db.activities[idx], ...fullAct };
      } else {
        db.activities.push(fullAct);
      }
    }

    // 5. Ingest Canonical Offers
    const offerDefinitions: Array<Omit<SupplierOfferEntity, 'fingerprint' | 'createdAt' | 'updatedAt'>> = [
      {
        id: 'OFFER-KING-001',
        supplierId: 'SUP-KING-SAFARI',
        activityId: 'ACT-BLUE-HOLE-SAFARI',
        canonicalCategory: 'SAFARI',
        sourceActivityName: 'Blue Hole + Abu Galum + Blue Lagoon (Speedboat & 4x4)',
        titleAr: 'رحلة البلو هول وأبو جالوم والبلو لاجون (لانش سريع ودفع رباعي)',
        titleEn: 'Blue Hole, Abu Galum & Blue Lagoon Day Safari (Speedboat & 4x4)',
        price: 550,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '08:30 AM',
        returnTime: '05:30 PM',
        duration: '9 hours',
        durationMinutes: 540,
        includes: ['4x4 Land Cruiser transfer', 'Speedboat transfer to Abu Galum', 'Bedouin truck to Blue Lagoon', 'Bedouin tea in beach hut'],
        excludes: ['National Park Entry Ticket ($10 foreigners / 50 EGP Egyptians)', 'Snorkel gear rental', 'Lunch'],
        transportType: '4x4 Toyota Land Cruiser + Speedboat + Double Cabin Truck',
        equipmentProvided: 'Life jackets on boat included',
        bookingChannels: ['WhatsApp', 'Office Walk-in', 'Platform Request'],
        sourceType: 'USER_PROVIDED_IMAGE',
        sourceReferences: ['flyer-king-safari-2026-p1'],
        verificationStatus: 'WEB_CONFIRMED',
        verificationSource: 'Flyer verified against King Safari official rates',
        verifiedAt: '2026-08-20T12:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.98,
        active: true
      },
      {
        id: 'OFFER-KING-002',
        supplierId: 'SUP-KING-SAFARI',
        activityId: 'ACT-QUAD-TWILAT',
        canonicalCategory: 'QUADBIKE',
        sourceActivityName: 'Quad Bike Safari / Beach Buggy - Jabal Al-Tawilat & Desert Sunset',
        titleAr: 'سفاري بيتش باجي - جبل الطويلات وشاي الغروب البدوي',
        titleEn: 'Quad Bike Sunset Safari - Jabal Al-Tawilat & Bedouin Camp',
        price: 350,
        currency: 'EGP',
        pricingBasis: 'SINGLE',
        singlePrice: 350,
        doublePrice: 450,
        departureTime: '04:30 PM',
        returnTime: '07:00 PM',
        duration: '2.5 hours',
        durationMinutes: 150,
        includes: ['Automatic Quad Bike', 'Bedouin escort guide', 'Desert tea at Twilat Bedouin tent', 'Helmet'],
        excludes: ['Bedouin Scarf (50 EGP)', 'Protective Goggles (30 EGP)', 'Dinner'],
        transportType: 'Self-drive Quad Bike',
        equipmentProvided: 'Safety helmet and orientation briefing',
        bookingChannels: ['WhatsApp', 'Online Hold', 'Office Desk'],
        sourceType: 'USER_PROVIDED_IMAGE',
        sourceReferences: ['flyer-king-safari-2026-p1'],
        verificationStatus: 'WEB_CONFIRMED',
        verificationSource: 'Flyer & WhatsApp confirmation',
        verifiedAt: '2026-08-20T12:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.99,
        active: true
      },
      {
        id: 'OFFER-BAKRY-001',
        supplierId: 'RAW-SUP-BAKRY-SAFARI',
        activityId: 'ACT-QUAD-TWILAT',
        canonicalCategory: 'QUADBIKE',
        sourceActivityName: 'Quad Safari Panorama Dahab & Wadi Gnai',
        titleAr: 'سفاري بيتش باجي بانوراما دهب ووادي قني (بكرى سفاري)',
        titleEn: 'Panorama Dahab & Wadi Gnai Beach Buggy Safari',
        price: 300,
        currency: 'EGP',
        pricingBasis: 'SINGLE',
        singlePrice: 300,
        doublePrice: 400,
        departureTime: '04:30 PM',
        returnTime: '06:30 PM',
        duration: '2 hours',
        durationMinutes: 120,
        includes: ['Quad Bike', 'Guide', 'Bedouin Tea'],
        excludes: ['Scarf', 'Goggles'],
        transportType: 'Quad Bike',
        equipmentProvided: 'Helmet',
        bookingChannels: ['WhatsApp', 'Direct Phone Call'],
        sourceType: 'USER_PROVIDED_IMAGE',
        sourceReferences: ['flyer-bakry-safari-2026'],
        verificationStatus: 'SOURCE_REPORTED',
        verificationSource: 'Extracted from user flyer',
        verifiedAt: '2026-08-18T16:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.96,
        active: true
      },
      {
        id: 'OFFER-KING-003',
        supplierId: 'SUP-KING-SAFARI',
        activityId: 'ACT-WISHWASHI-EXPEDITION',
        canonicalCategory: 'CANYON',
        sourceActivityName: 'Ras Shitan & Wadi El-Wishwashi Canyon Expedition',
        titleAr: 'رحلة رأس شيطان ووادي الوشواشي والسباحة في عين المياه العذبة',
        titleEn: 'Ras Shitan & Wadi El-Wishwashi Canyon Expedition',
        price: 750,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '07:30 AM',
        returnTime: '06:00 PM',
        duration: '10.5 hours',
        durationMinutes: 630,
        includes: ['A/C Minibus to Nuweiba', '4x4 Bedouin mountain truck', 'Bedouin canyon guide', 'Swim in natural freshwater pool', 'Bedouin lunch at Ras Shitan', 'Snorkeling at Ras Shitan beach'],
        excludes: ['Snorkel gear rental', 'Soft drinks'],
        transportType: 'Minibus + 4x4 Hilux',
        equipmentProvided: 'Guide ropes in canyon',
        bookingChannels: ['WhatsApp', 'Office Desk'],
        sourceType: 'USER_PROVIDED_IMAGE',
        sourceReferences: ['flyer-king-safari-2026-p1'],
        verificationStatus: 'WEB_CONFIRMED',
        verificationSource: 'King Safari official tour schedule',
        verifiedAt: '2026-08-20T12:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.97,
        active: true
      },
      {
        id: 'OFFER-BAKRY-002',
        supplierId: 'RAW-SUP-BAKRY-SAFARI',
        activityId: 'ACT-WISHWASHI-EXPEDITION',
        canonicalCategory: 'CANYON',
        sourceActivityName: 'Ras Shitan + Wishwashi Canyon Day Trip',
        titleAr: 'رحلة وادي الوشواش ورأس شيطان (بكرى سفاري)',
        titleEn: 'Wadi Wishwashi & Ras Shitan Shared Day Trip',
        price: 650,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '08:00 AM',
        returnTime: '05:30 PM',
        duration: '9.5 hours',
        durationMinutes: 570,
        includes: ['Transfers', 'Bedouin guide', 'Lunch in beach hut'],
        excludes: ['Snorkel gear', 'Drinks'],
        transportType: '4x4 / Microbus',
        equipmentProvided: 'None',
        bookingChannels: ['WhatsApp', 'Direct Phone Call'],
        sourceType: 'USER_PROVIDED_IMAGE',
        sourceReferences: ['flyer-bakry-safari-2026'],
        verificationStatus: 'SOURCE_REPORTED',
        verificationSource: 'Extracted from user flyer',
        verifiedAt: '2026-08-18T16:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.94,
        active: true
      },
      {
        id: 'OFFER-KING-004',
        supplierId: 'SUP-KING-SAFARI',
        activityId: 'ACT-THREE-POOLS-SAFARI',
        canonicalCategory: 'SAFARI',
        sourceActivityName: 'Three Pools Snorkeling Safari & Wadi Gnai Oasis',
        titleAr: 'سفاري الثري بولز والغطس السطحي وواحة وادي قني',
        titleEn: 'Three Pools Snorkeling Safari & Wadi Gnai Oasis',
        price: 400,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '09:30 AM',
        returnTime: '03:30 PM',
        duration: '6 hours',
        durationMinutes: 360,
        includes: ['4x4 transport', 'Guided snorkeling at 3 coral lagoon pools', 'Bedouin lunch at beach hut', 'Wadi Gnai palm oasis scenic walk'],
        excludes: ['Environmental entry ticket (50 EGP)', 'Mask & snorkel rental'],
        transportType: '4x4 Jeep / Minivan',
        equipmentProvided: 'Shaded Bedouin beach carpet and sun loungers',
        bookingChannels: ['WhatsApp', 'Platform Request'],
        sourceType: 'USER_PROVIDED_IMAGE',
        sourceReferences: ['flyer-king-safari-2026-p1'],
        verificationStatus: 'WEB_CONFIRMED',
        verificationSource: 'King Safari official rates',
        verifiedAt: '2026-08-20T12:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.98,
        active: true
      },
      {
        id: 'OFFER-GUILD-001',
        supplierId: 'SUP-SINAI-BEDOUIN-GUILD',
        activityId: 'ACT-MOUNT-MOSES-TREK',
        canonicalCategory: 'TREK',
        sourceActivityName: 'Mount Moses (Jabal Mousa) & Saint Catherine Sunrise Trek',
        titleAr: 'رحلة صعود قمة جبل موسى وشروق الشمس ودير سانت كاترين (أدلاء قبيلة المزينة)',
        titleEn: 'Mount Moses Sunrise Summit Trek & St. Catherine Monastery',
        price: 950,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '10:00 PM',
        returnTime: '01:30 PM',
        duration: '15.5 hours',
        durationMinutes: 930,
        includes: ['A/C roundtrip transport Dahab - St. Catherine', 'Official licensed Bedouin mountain guide', 'St. Catherine Monastery visit & Burning Bush', 'Flashlight loan', 'Bedouin mountain summit tea'],
        excludes: ['Monastery museum entrance ($5)', 'Optional camel ride up mountain', 'Personal breakfast'],
        transportType: 'Comfortable Tourist Minivan',
        equipmentProvided: 'Flashlights and trekking sticks loan',
        bookingChannels: ['WhatsApp', 'Bedouin Syndicate Desk', 'Platform Request'],
        sourceType: 'SUPPLIER_OWNED',
        sourceReferences: ['bedouin-guild-sinai-2026'],
        verificationStatus: 'SUPPLIER_CONFIRMED',
        verificationSource: 'Sinai Bedouin Tribal Council',
        verifiedAt: '2026-08-22T14:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.99,
        active: true
      },
      {
        id: 'OFFER-GUILD-002',
        supplierId: 'SUP-SINAI-BEDOUIN-GUILD',
        activityId: 'ACT-WHITE-CANYON-SAFARI',
        canonicalCategory: 'SAFARI',
        sourceActivityName: 'White Canyon & Ain Khodra Oasis 4x4 Desert Safari',
        titleAr: 'سفاري الوادي الأبيض وواحة عين خضرة مع غداء مدفونة بدوية',
        titleEn: 'White Canyon & Ain Khodra Oasis 4x4 Safari with Bedouin Lunch',
        price: 1200,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '07:00 AM',
        returnTime: '05:00 PM',
        duration: '10 hours',
        durationMinutes: 600,
        includes: ['4x4 Land Cruiser desert crossing', 'Canyon scramble with Bedouin guide', 'Spring water at Ain Khodra palms', 'Traditional Zarba / Madfouna lunch cooked in desert embers', 'Bedouin sage tea'],
        excludes: ['Personal gear', 'Driver tips'],
        transportType: 'Toyota Land Cruiser 4x4',
        equipmentProvided: 'Desert permits and emergency communication',
        bookingChannels: ['WhatsApp', 'Platform Request'],
        sourceType: 'SUPPLIER_OWNED',
        sourceReferences: ['bedouin-guild-sinai-2026'],
        verificationStatus: 'SUPPLIER_CONFIRMED',
        verificationSource: 'Bedouin Guild Syndicate',
        verifiedAt: '2026-08-22T14:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.98,
        active: true
      },
      {
        id: 'OFFER-RELAX-001',
        supplierId: 'SUP-RED-SEA-RELAX',
        activityId: 'ACT-INTRO-DISCOVER-DIVE',
        canonicalCategory: 'DIVING',
        sourceActivityName: 'Discover Scuba Diving (DSD) - Intro Dive for Beginners',
        titleAr: 'تجربة الغوص الأولى للمبتدئين (ديسكفر سكوبا) مع مدرب معتمد PADI',
        titleEn: 'PADI Discover Scuba Diving (DSD) - Intro Dive for Beginners',
        price: 1450,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '09:00 AM',
        returnTime: '12:00 PM',
        duration: '3 hours',
        durationMinutes: 180,
        includes: ['Full Aqualung / Mares scuba gear', '1-on-1 certified PADI instructor ratio', 'Theory briefing & confined water practice', 'Open water reef dive max 10-12m', 'CDWS hyperbaric chamber search and rescue insurance'],
        excludes: ['Underwater photo package (optional 350 EGP)'],
        transportType: 'Walk-in from beachfront dive centre',
        equipmentProvided: 'Full sanitized PADI standard scuba equipment',
        bookingChannels: ['Instant Book Now', 'Direct Web', 'Dive Desk'],
        sourceType: 'REGULATORY',
        sourceReferences: ['cdws-official-registry-2026'],
        verificationStatus: 'REGULATORY_VERIFIED',
        verificationSource: 'CDWS License #CDWS-DHB-104 & PADI 5-Star CDC',
        verifiedAt: '2026-08-25T10:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 1.0,
        active: true
      },
      {
        id: 'OFFER-RELAX-002',
        supplierId: 'SUP-RED-SEA-RELAX',
        activityId: 'ACT-BLUE-HOLE-BELLS-DIVE',
        canonicalCategory: 'DIVING',
        sourceActivityName: 'Guided Shore Dive - Blue Hole & The Bells (Certified Divers)',
        titleAr: 'غوصة موجهة للبلو هول والبلز للغواصين المعتمدين',
        titleEn: 'Guided Shore Dive - The Bells & Blue Hole (2 Dives)',
        price: 1100,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '08:30 AM',
        returnTime: '12:30 PM',
        duration: '4 hours',
        durationMinutes: 240,
        includes: ['4x4 transfer to Blue Hole', 'Certified PADI Divemaster guide', '12L Aluminum tanks (200 bar) and weights', 'On-site emergency O2 kit'],
        excludes: ['Full equipment rental (400 EGP/day if needed)', 'Nitrox', 'National park entry fee ($10)'],
        transportType: '4x4 Safari Truck',
        equipmentProvided: 'Tanks and weights included',
        bookingChannels: ['Instant Book Now', 'Dive Desk'],
        sourceType: 'REGULATORY',
        sourceReferences: ['cdws-official-registry-2026'],
        verificationStatus: 'REGULATORY_VERIFIED',
        verificationSource: 'CDWS License #CDWS-DHB-104',
        verifiedAt: '2026-08-25T10:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 1.0,
        active: true
      },
      {
        id: 'OFFER-DESERT-001',
        supplierId: 'SUP-DESERT-DIVERS',
        activityId: 'ACT-CAMEL-DIVING-SAFARI',
        canonicalCategory: 'DIVING',
        sourceActivityName: 'Camel Diving Safari to Ras Abu Galum (2 Dives + Bedouin Lunch)',
        titleAr: 'سفاري الغوص البيئي بالجمال إلى رأس أبو جالوم (غطستان + غداء بدوي)',
        titleEn: 'Eco Camel Diving Safari to Ras Abu Galum (2 Dives & Bedouin Feast)',
        price: 2400,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '07:30 AM',
        returnTime: '05:00 PM',
        duration: '9.5 hours',
        durationMinutes: 570,
        includes: ['Transfer to Blue Hole', 'Camel trek with dive equipment along coastal cliff', '2 guided reef dives in Abu Galum reserve', 'Fresh Bedouin fish or vegetarian lunch', 'Bedouin tea'],
        excludes: ['Equipment rental if needed', 'Park entry ticket'],
        transportType: 'Bedouin Riding Camel + 4x4 Truck',
        equipmentProvided: 'Tanks & weights included',
        bookingChannels: ['WhatsApp', 'Dive Resort Desk'],
        sourceType: 'REGULATORY',
        sourceReferences: ['cdws-official-registry-2026'],
        verificationStatus: 'REGULATORY_VERIFIED',
        verificationSource: 'CDWS License #CDWS-DHB-092 & PADI 5-Star Resort',
        verifiedAt: '2026-08-25T10:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 1.0,
        active: true
      },
      {
        id: 'OFFER-DESERT-002',
        supplierId: 'SUP-DESERT-DIVERS',
        activityId: 'ACT-WADI-GNAI-CLIMBING',
        canonicalCategory: 'CLIMBING',
        sourceActivityName: 'Granite Rock Climbing & Bouldering in Wadi Gnai',
        titleAr: 'تسلق صخور الجرانيت الطبيعية والبولدرينج في وادي قني مع مدرب',
        titleEn: 'Granite Rock Climbing & Bouldering in Wadi Gnai with Certified Instructor',
        price: 1600,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '07:30 AM',
        returnTime: '12:00 PM',
        duration: '4.5 hours',
        durationMinutes: 270,
        includes: ['4x4 transfer to Middle Gnai crag', 'Certified climbing instructor', 'Full climbing harness, shoes, chalk, helmet, ropes and hardware', 'Top-rope setup on routes from 4a to 7b'],
        excludes: ['Personal snacks'],
        transportType: '4x4 Jeep',
        equipmentProvided: 'Full UIAA certified climbing kit',
        bookingChannels: ['WhatsApp', 'Platform Request'],
        sourceType: 'REGULATORY',
        sourceReferences: ['cdws-official-registry-2026'],
        verificationStatus: 'REGULATORY_VERIFIED',
        verificationSource: 'CDWS #CDWS-DHB-092 & Desert Divers Climbing Syndicate',
        verifiedAt: '2026-08-25T10:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.99,
        active: true
      },
      {
        id: 'OFFER-LAGUNA-001',
        supplierId: 'SUP-LAGUNA-WATERSPORTS',
        activityId: 'ACT-LAGUNA-KITESURF',
        canonicalCategory: 'WATERSPORTS',
        sourceActivityName: 'Introductory Kitesurfing Lesson (2-Hour Private Coaching)',
        titleAr: 'درس كايت سيرف خاص (ساعتان) مع مدرب معتمد IKO في لاجونا دهب',
        titleEn: 'Private 2-Hour Kitesurfing Lesson with IKO Certified Coach',
        price: 2200,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '10:00 AM',
        returnTime: '12:00 PM',
        duration: '2 hours',
        durationMinutes: 120,
        includes: ['1-on-1 IKO certified coach', 'Duotone kite, control bar, harness, radio helmet, impact vest', 'Beach pilotage & body dragging in waist-deep flat lagoon', 'Laguna safety boat rescue cover'],
        excludes: ['Wetsuit rental in winter (100 EGP)'],
        transportType: 'Beachfront Station',
        equipmentProvided: 'Full current-season Duotone kite gear',
        bookingChannels: ['WhatsApp', 'Station Front Desk'],
        sourceType: 'SUPPLIER_OWNED',
        sourceReferences: ['laguna-watersports-center-2026'],
        verificationStatus: 'SUPPLIER_CONFIRMED',
        verificationSource: 'Dahab Watersports Association',
        verifiedAt: '2026-08-23T11:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.98,
        active: true
      },
      {
        id: 'OFFER-SAFARI-TOURS-001',
        supplierId: 'SUP-DAHAB-SAFARI-TOURS',
        activityId: 'ACT-GLASS-BOTTOM-BOAT',
        canonicalCategory: 'WATERSPORTS',
        sourceActivityName: 'Glass Bottom Boat Coral Viewing Safari',
        titleAr: 'جولة القارب الزجاجي لمشاهدة الشعب المرجانية والأسماك الملونة',
        titleEn: 'Glass Bottom Boat Reef & Marine Life Viewing Tour',
        price: 350,
        currency: 'EGP',
        pricingBasis: 'PER_PERSON',
        departureTime: '11:00 AM',
        returnTime: '12:30 PM',
        duration: '1.5 hours',
        durationMinutes: 90,
        includes: ['Glass bottom viewing salon with optical magnification glass', 'Marine life narration by guide', 'Life jackets for all passengers'],
        excludes: ['Snorkeling from boat'],
        transportType: 'Custom Glass Bottom Motor Vessel',
        equipmentProvided: 'Marine life identification chart and life jackets',
        bookingChannels: ['Instant Book Now', 'Masbat Jetty Kiosk'],
        sourceType: 'USER_PROVIDED_IMAGE',
        sourceReferences: ['flyer-dahab-safari-tours-2026'],
        verificationStatus: 'WEB_CONFIRMED',
        verificationSource: 'Dahab Safari Tour Agency rates',
        verifiedAt: '2026-08-21T09:00:00Z',
        sourceFreshness: 'CURRENT',
        extractionConfidence: 0.97,
        active: true
      }
    ];

    for (const offDef of offerDefinitions) {
      const fingerprint = computeFingerprint(offDef.supplierId, offDef.activityId, offDef.price.toString(), offDef.pricingBasis, offDef.sourceReferences.join(','));
      const existingIdx = db.supplierOffers.findIndex(o => o.id === offDef.id || o.fingerprint === fingerprint);

      const offerEntity: SupplierOfferEntity = {
        ...offDef,
        fingerprint,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        db.supplierOffers[existingIdx] = {
          ...db.supplierOffers[existingIdx],
          ...offerEntity,
          sourceReferences: Array.from(new Set([...db.supplierOffers[existingIdx].sourceReferences, ...offerEntity.sourceReferences]))
        };
        offersUpdated++;
      } else {
        db.supplierOffers.push(offerEntity);
        offersCreated++;
      }

      // Emitting Temporal Fact for Pricing Intelligence
      const priceFactId = `FACT-PRICE-${offDef.id}`;
      const existingPriceFact = db.temporalFacts.find(f => f.id === priceFactId);
      if (!existingPriceFact) {
        db.temporalFacts.push({
          id: priceFactId,
          subjectId: offDef.activityId,
          subjectType: 'ACTIVITY',
          predicate: 'commercial_offer_price',
          value: {
            supplierId: offDef.supplierId,
            priceEGP: offDef.price,
            pricingBasis: offDef.pricingBasis,
            singlePrice: offDef.singlePrice,
            doublePrice: offDef.doublePrice,
            verificationStatus: offDef.verificationStatus,
            sourceFreshness: offDef.sourceFreshness
          },
          primarySourceId: `SRC-${(offDef.sourceReferences[0] || 'FLYER').toUpperCase().replace(/[^A-Z0-9]/g, '-')}`,
          sourceType: offDef.sourceType === 'REGULATORY' ? 'AUTHORITATIVE' : 'MARKETPLACE',
          observedAt: new Date().toISOString(),
          verifiedAt: offDef.verifiedAt || new Date().toISOString(),
          validFrom: new Date().toISOString(),
          confidence: offDef.extractionConfidence,
          confidenceTier: offDef.verificationStatus === 'REGULATORY_VERIFIED' ? 'VERY_HIGH' : 'HIGH',
          status: 'CURRENT',
          verificationOwner: 'Local Commerce Importer',
          notes: `Published offer from ${offDef.supplierId}: ${offDef.price} ${offDef.currency} (${offDef.pricingBasis})`
        });
        dkosFactsCreated++;
      }
    }

    // 6. Ingest Instagram Discovery Sources, Social Accounts, and Price Observations
    let socialAccountsCount = 0;
    let sourceRecordsCount = 0;
    let priceObservationsCount = 0;

    const instagramPath = seedPath('instagram', 'dahab_instagram_sources.json');
    if (fs.existsSync(instagramPath)) {
      try {
        const instaContent = fs.readFileSync(instagramPath, 'utf-8');
        const instaData = JSON.parse(instaContent);
        const { accounts = [] } = instaData;

        for (const acc of accounts) {
          const existingAccIdx = db.socialAccounts.findIndex(a => a.platform === 'INSTAGRAM' && a.username.toLowerCase() === acc.username.toLowerCase());
          const socialEntity: SocialAccountEntity = {
            id: acc.id || `INSTA-${acc.username.toUpperCase()}`,
            platform: 'INSTAGRAM',
            username: acc.username,
            displayName: acc.displayName,
            profileUrl: acc.profileUrl,
            supplierId: acc.supplierId,
            ownershipStatus: acc.ownershipStatus || 'OWNERSHIP_CONFIRMED',
            category: acc.category || 'BUSINESS',
            bio: acc.bio,
            locationMention: acc.locationMention,
            contactPhone: acc.contactPhone,
            whatsapp: acc.whatsapp,
            email: acc.email,
            website: acc.website,
            bookingLink: acc.bookingLink,
            services: acc.services || [],
            followersCount: acc.followersCount,
            postsCount: acc.postsCount,
            recentActivitySignal: acc.recentActivitySignal,
            isBusinessAccount: acc.isBusinessAccount ?? true,
            sourceReference: acc.sourceReference || `insta-${acc.username}-2026`,
            lastObservedAt: acc.lastObservedAt || new Date().toISOString(),
            verificationStatus: acc.verificationStatus || 'INSTAGRAM_REPORTED',
            active: true
          };

          if (existingAccIdx >= 0) {
            db.socialAccounts[existingAccIdx] = { ...db.socialAccounts[existingAccIdx], ...socialEntity };
          } else {
            db.socialAccounts.push(socialEntity);
          }
          socialAccountsCount++;

          // Check if supplier exists for this account, or register if new
          if (acc.supplierId) {
            let targetSup = db.suppliers.find(s => s.id === acc.supplierId);
            if (!targetSup && acc.displayName) {
              const newSup: SupplierEntity = {
                id: acc.supplierId,
                businessName: acc.displayName.split('|')[0].trim(),
                businessNameAr: acc.displayName.includes('|') ? acc.displayName.split('|')[1].trim() : acc.displayName,
                displayName: acc.displayName,
                aliases: [acc.username, `@${acc.username}`],
                category: acc.category === 'DIVE_CENTER' ? 'diving' : (acc.category === 'SAFARI_OPERATOR' || acc.category === 'GUIDE' || acc.category === 'CAMP' ? 'safari' : (acc.category === 'WATERSPORTS' ? 'safari' : 'transfer')),
                tier: acc.verificationStatus === 'REGULATORY_VERIFIED' ? 'Tier 1 Certified' : 'Vetted Local Partner',
                status: 'Active',
                leadContact: `${acc.displayName} (${acc.contactPhone || acc.whatsapp || acc.username})`,
                phone: acc.contactPhone || '',
                phoneNumbers: acc.contactPhone ? [acc.contactPhone] : [],
                whatsappNumbers: acc.whatsapp ? [acc.whatsapp] : [],
                email: acc.email || '',
                area: acc.locationMention || 'Dahab, South Sinai',
                licenseNumber: acc.verificationStatus === 'REGULATORY_VERIFIED' ? (acc.bio?.match(/CDWS-DHB-\d+/i)?.[0] || 'CDWS-REGISTERED') : `INSTA-VERIFIED-${acc.username.toUpperCase()}`,
                cdwsVerified: acc.verificationStatus === 'REGULATORY_VERIFIED',
                rating: 4.8,
                reviewCount: acc.followersCount ? Math.floor(acc.followersCount / 50) : 100,
                verificationStatus: acc.verificationStatus,
                verificationSources: [acc.sourceReference || `insta-${acc.username}-2026`],
                sourceReferences: [acc.sourceReference || `insta-${acc.username}-2026`],
                serviceTypes: acc.services || [],
                fingerprint: computeFingerprint(acc.displayName, acc.contactPhone || acc.username),
                onboardedAt: '2026-08-25',
                approvedBy: 'Dahab Instagram Intelligence Engine'
              };
              db.suppliers.push(newSup);
              suppliersCreated++;
            }
          }

          // Ingest Post Observations
          if (Array.isArray(acc.posts)) {
            for (let pIdx = 0; pIdx < acc.posts.length; pIdx++) {
              const post = acc.posts[pIdx];
              const obsId = `OBS-INSTA-${acc.username.toUpperCase()}-${pIdx + 1}`;
              const existingObsIdx = db.priceObservations.findIndex(o => o.id === obsId);

              const priceObs: PriceObservationEntity = {
                id: obsId,
                offerId: `OFFER-${acc.username.toUpperCase()}-${pIdx + 1}`,
                supplierId: acc.supplierId || `SUP-${acc.username.toUpperCase()}`,
                activityId: `ACT-${acc.username.toUpperCase()}-${pIdx + 1}`,
                amount: post.price,
                currency: post.currency || 'EGP',
                pricingBasis: post.pricingBasis as PricingBasis || 'PER_PERSON',
                sourcePriceText: post.sourcePriceText || `${post.price} ${post.currency || 'EGP'}`,
                sourceType: 'INSTAGRAM',
                sourceUrl: post.postUrl,
                sourceReference: acc.sourceReference,
                sourceDate: post.postDate,
                freshnessStatus: post.freshnessStatus as FreshnessStatus || 'CURRENT_LIKELY',
                verificationStatus: acc.verificationStatus || 'INSTAGRAM_REPORTED',
                observedAt: new Date().toISOString()
              };

              if (existingObsIdx >= 0) {
                db.priceObservations[existingObsIdx] = priceObs;
              } else {
                db.priceObservations.push(priceObs);
              }
              priceObservationsCount++;

              // Create Source Record
              const srcRecId = `SRCREC-${acc.username.toUpperCase()}-${pIdx + 1}`;
              const existingSrcIdx = db.sourceRecords.findIndex(s => s.id === srcRecId);
              const sourceRecord: SourceRecordEntity = {
                id: srcRecId,
                sourceType: 'INSTAGRAM',
                sourceUrl: post.postUrl,
                sourceReference: acc.sourceReference,
                capturedAt: post.postDate,
                retrievedAt: new Date().toISOString(),
                supplierId: acc.supplierId,
                claim: `${post.activity}: ${post.sourcePriceText}`,
                confidence: acc.verificationStatus === 'REGULATORY_VERIFIED' ? 0.98 : 0.92,
                verificationStatus: acc.verificationStatus || 'INSTAGRAM_REPORTED',
                rawPayload: post
              };

              if (existingSrcIdx >= 0) {
                db.sourceRecords[existingSrcIdx] = sourceRecord;
              } else {
                db.sourceRecords.push(sourceRecord);
              }
              sourceRecordsCount++;

              // Emit Temporal Fact
              const factId = `FACT-PRICE-${obsId}`;
              const existingFact = db.temporalFacts.find(f => f.id === factId);
              if (!existingFact) {
                db.temporalFacts.push({
                  id: factId,
                  subjectId: acc.supplierId || acc.username,
                  subjectType: 'SUPPLIER',
                  predicate: 'instagram_price_observation',
                  value: {
                    activity: post.activity,
                    destination: post.destination,
                    price: post.price,
                    currency: post.currency,
                    pricingBasis: post.pricingBasis,
                    sourcePriceText: post.sourcePriceText
                  },
                  primarySourceId: `SRC-${acc.sourceReference.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`,
                  sourceType: 'MARKETPLACE',
                  observedAt: post.postDate || new Date().toISOString(),
                  verifiedAt: new Date().toISOString(),
                  validFrom: post.postDate || new Date().toISOString(),
                  confidence: 0.92,
                  confidenceTier: 'HIGH',
                  status: 'CURRENT',
                  verificationOwner: 'Instagram Intelligence Ingestion'
                });
                dkosFactsCreated++;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[LocalCommerceImporter] Failed to load Instagram sources:', err);
      }
    }

    // 7. Audit and Reconcile Regulatory Claims across all Suppliers
    // Verify claimed CDWS IDs against official verified CDWS registry list
    const cdwsOfficialRegistry = new Set(['CDWS-DHB-104', 'CDWS-DHB-092', 'CDWS-DHB-071', 'CDWS-DHB-085', 'CDWS-DHB-033']);
    for (const sup of db.suppliers) {
      if (sup.licenseNumber && (sup.licenseNumber.includes('CDWS') || sup.cdwsVerified || sup.verificationStatus === 'REGULATORY_VERIFIED')) {
        const cdwsMatch = sup.licenseNumber.match(/CDWS-DHB-\d+/i);
        const normalizedCdwsId = cdwsMatch ? cdwsMatch[0].toUpperCase() : sup.licenseNumber;
        if (!cdwsOfficialRegistry.has(normalizedCdwsId)) {
          // Unverified claim: downgrade status and preserve historical claim
          if (sup.verificationStatus === 'REGULATORY_VERIFIED' || sup.cdwsVerified) {
            sup.metadata = {
              ...(sup.metadata || {}),
              historicalClaim: sup.licenseNumber,
              previousStatus: sup.verificationStatus,
              correctionReason: 'License ID not verified in current official CDWS Dahab registry; preserved historical claim',
              correctedAt: new Date().toISOString()
            };
            sup.verificationStatus = 'UNVERIFIED_REGULATORY_CLAIM';
            sup.cdwsVerified = false;
            sup.tier = 'Vetted Local Partner';
            sup.licenseNumber = `UNVERIFIED_CLAIM_${sup.licenseNumber}`;
          }
        }
      }
    }

    // 8. Compute Market Statistics per Activity
    const activityOfferMap = new Map<string, SupplierOfferEntity[]>();
    for (const offer of db.supplierOffers) {
      if (!activityOfferMap.has(offer.activityId)) {
        activityOfferMap.set(offer.activityId, []);
      }
      activityOfferMap.get(offer.activityId)!.push(offer);
    }

    db.state.marketPriceStats = [];
    for (const [activityId, offers] of activityOfferMap.entries()) {
      const act = db.activities.find(a => a.id === activityId);
      const prices = offers.map(o => o.price).sort((a, b) => a - b);
      const lowest = prices[0];
      const highest = prices[prices.length - 1];
      const median = prices[Math.floor(prices.length / 2)];

      const stat: MarketPriceStatEntity = {
        activityId,
        activityNameEn: act?.titleEn || activityId,
        activityNameAr: act?.titleAr || activityId,
        currency: 'EGP',
        lowestObservedPrice: lowest,
        highestObservedPrice: highest,
        medianObservedPrice: median,
        observedOfferCount: offers.length,
        priceRange: lowest === highest ? `${lowest} EGP` : `${lowest} - ${highest} EGP`,
        offers: offers.map(o => {
          const sup = db.suppliers.find(s => s.id === o.supplierId);
          return {
            offerId: o.id,
            supplierId: o.supplierId,
            supplierName: sup?.businessName || o.supplierId,
            price: o.price,
            pricingBasis: o.pricingBasis,
            verificationStatus: o.verificationStatus,
            freshnessStatus: o.sourceFreshness
          };
        }),
        label: 'OBSERVED_MARKET_DATA',
        lastCalculatedAt: new Date().toISOString()
      };

      db.state.marketPriceStats.push(stat);
    }

    // Save DB snapshot to disk
    db.saveToDisk();

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      importedAt: new Date().toISOString(),
      suppliersCount: db.suppliers.length,
      suppliersCreated,
      suppliersUpdated,
      rawSupplierSourcesCount: db.rawSupplierSources.length,
      rawOfferSourcesCount: db.rawOfferSources.length,
      offersCount: db.supplierOffers.length,
      offersCreated,
      offersUpdated,
      socialAccountsCount: db.socialAccounts.length,
      sourceRecordsCount: db.sourceRecords.length,
      priceObservationsCount: db.priceObservations.length,
      marketStatsCount: db.state.marketPriceStats.length,
      dkosSourcesCreated,
      dkosFactsCreated,
      evidenceNodesCreated,
      durationMs,
      summary: `Successfully imported Dahab local commerce dataset: ${db.suppliers.length} suppliers, ${db.supplierOffers.length} offers, ${db.socialAccounts.length} Instagram accounts, ${db.priceObservations.length} price observations, ${db.state.marketPriceStats.length} market stats.`
    };
  });
}

/**
 * Searches local commerce catalog in Arabic and English
 */
export function searchLocalCommerce(query: string) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    // Must match the populated branch below. Returning a narrower object here
    // made the inferred return type a union, so every caller saw
    // `socialAccounts` and `priceObservations` as possibly undefined — and any
    // caller that reached for them on an empty query got undefined at runtime.
    return {
      query,
      suppliers: db.suppliers.slice(0, 10),
      offers: db.supplierOffers.slice(0, 10),
      stats: db.marketPriceStats,
      socialAccounts: (db.socialAccounts || []).slice(0, 10),
      priceObservations: (db.priceObservations || []).slice(0, 10)
    };
  }

  // Matching suppliers
  const matchedSuppliers = db.suppliers.filter(s => {
    return (s.businessName || '').toLowerCase().includes(q) ||
      (s.businessNameAr && s.businessNameAr.includes(q)) ||
      (s.aliases && s.aliases.some(a => a.toLowerCase().includes(q) || a.includes(q))) ||
      (s.serviceTypes && s.serviceTypes.some(t => t.toLowerCase().includes(q) || t.includes(q))) ||
      ((s.category || '').toLowerCase().includes(q));
  });

  // Matching offers
  const matchedOffers = db.supplierOffers.filter(o => {
    return o.titleEn.toLowerCase().includes(q) ||
      o.titleAr.includes(q) ||
      o.sourceActivityName.toLowerCase().includes(q) ||
      o.canonicalCategory.toLowerCase().includes(q) ||
      o.includes.some(inc => inc.toLowerCase().includes(q) || inc.includes(q));
  });

  // Matching stats
  const matchedStats = (db.state.marketPriceStats || []).filter(st => {
    return st.activityNameEn.toLowerCase().includes(q) ||
      st.activityNameAr.includes(q);
  });

  // Matching social accounts
  const matchedSocial = (db.socialAccounts || []).filter(sa => {
    return sa.username.toLowerCase().includes(q) ||
      (sa.displayName && sa.displayName.toLowerCase().includes(q)) ||
      (sa.bio && sa.bio.toLowerCase().includes(q)) ||
      (sa.services && sa.services.some(srv => srv.toLowerCase().includes(q)));
  });

  // Matching price observations
  const matchedObservations = (db.priceObservations || []).filter(obs => {
    // sourcePriceText is optional; calling .toLowerCase() on an observation
    // without one threw "Cannot read properties of undefined", aborting the
    // whole search rather than skipping that record.
    return (obs.sourcePriceText || '').toLowerCase().includes(q) ||
      obs.activityId.toLowerCase().includes(q) ||
      obs.supplierId.toLowerCase().includes(q);
  });

  return {
    query,
    suppliers: matchedSuppliers,
    offers: matchedOffers,
    stats: matchedStats,
    socialAccounts: matchedSocial,
    priceObservations: matchedObservations
  };
}
