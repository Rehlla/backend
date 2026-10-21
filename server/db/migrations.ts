import { IN_DESTINATION_SKUS, IN_DESTINATION_SUPPLIERS } from './seeds/inDestinationServices';
import { EXISTING_SKU_TIME_SLOTS, EXPERIENCE_SKUS, EXPERIENCE_SUPPLIERS, meetingPointArOf } from './seeds/experienceProducts';
import crypto from 'crypto';
import { db } from './database';
import { CITIES_SEED } from './citiesSeed';
import { SupplierEntity } from './schema';
import { initialOpportunities } from '../../src/data/intelligenceData';
import { importDahabLocalCommerce } from './seeds/importDahabLocalCommerce';
import { importDahabHotels } from './seeds/importDahabHotels';
import { importDahabAccommodations } from './seeds/importDahabAccommodations';
import { EXPANDED_AREA_PROFILES } from '../data/dkosExpansionData';
import { EXPANDED_DINING_VENUES } from '../data/dkosExpansionDataPart2';
import { SIWA_AREA_PROFILES, NUWEIBA_AREA_PROFILES } from '../data/sinewibaAreaProfiles';
import { importDahabRentals } from './seeds/importDahabRentals';
import { importDahabTripadvisorStays } from './seeds/importDahabTripadvisorStays';
import { importDahabScrapeGraph } from './seeds/importDahabScrapeGraph';
import { backfillRoomTypes } from './seeds/backfillRoomTypes';
import { importDahabMenus } from './seeds/importDahabMenus';
import { importSinewibaAccommodations } from './seeds/importSinewibaAccommodations';
import { importGoogleMapsAccommodations } from './seeds/importGoogleMapsAccommodations';
import { repairCatalogIntegrity } from './catalogIntegrity';
import { seedTripPackages } from '../services/catalog/packageSeed';
import type { LedgerEntryEntity } from './schema';

/** Genesis hash of the ledger chain — must match LedgerService's constant. */
export const LEDGER_GENESIS_HASH = 'sha256:0000000000000000000000000000000000000000';

/**
 * Builds the 5 seeded ledger entries with a correctly chained signature.
 *
 * Exported so tests can assert the seed verifies clean without booting the
 * server: fresh-seed integrity is a release gate (a fresh DB must report
 * balanced:true, chainIntact:true on /api/health), after placeholder hashes
 * shipped here once and every fresh boot failed its own check.
 *
 * The hash algorithm is authoritative in LedgerService.calculateEntryHash;
 * this mirrors it for unsigned seed data (no service dependency at seed time).
 */
export function buildSeedLedgerEntries(): LedgerEntryEntity[] {
  const hashEntry = (params: {
    id: string;
    transactionId: string;
    idempotencyKey: string;
    type: string;
    amountEGP: number;
    debitAccount: string;
    creditAccount: string;
    timestamp: string;
    previousHash: string;
  }): string => {
    const data = `${params.id}:${params.transactionId}:${params.idempotencyKey}:${params.type}:${params.amountEGP}:${params.debitAccount}:${params.creditAccount}:${params.timestamp}:${params.previousHash}`;
    return `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
  };
  const seedRows: Array<Omit<LedgerEntryEntity, 'previousHash' | 'signatureHash'>> = [
    {
      id: 'LEDGER-001',
      transactionId: 'TXN-984102-PAY',
      idempotencyKey: 'IDEMP-PAY-001-894',
      bookingRef: 'DHB-HTL-2026-081',
      tripId: 'DHB-TRIP-894',
      type: 'PAYMENT_CAPTURED',
      amountEGP: 12500,
      debitAccount: 'TRAVELER_CC_TOKEN_4910',
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      timestamp: '2026-08-23 14:15:22',
      status: 'SETTLED',
      metadata: { serviceType: 'hotel', supplierId: 'SUP-HTL-01', travelerName: 'Ahmed Mansour', reason: 'Ali Baba Hotel 5 Nights Escrow' }
    },
    {
      id: 'LEDGER-002',
      transactionId: 'TXN-984103-PAY',
      idempotencyKey: 'IDEMP-PAY-002-894',
      bookingRef: 'DHB-TRF-2026-042',
      tripId: 'DHB-TRIP-894',
      type: 'PAYMENT_CAPTURED',
      amountEGP: 1400,
      debitAccount: 'TRAVELER_CC_TOKEN_4910',
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      timestamp: '2026-08-23 14:15:23',
      status: 'SETTLED',
      metadata: { serviceType: 'transfer', supplierId: 'SUP-SHUTTLE-01', travelerName: 'Ahmed Mansour', reason: 'SSH Airport Private Van Transfer' }
    },
    {
      id: 'LEDGER-003',
      transactionId: 'TXN-984104-PAY',
      idempotencyKey: 'IDEMP-PAY-003-894',
      bookingRef: 'DHB-DIV-2026-118',
      tripId: 'DHB-TRIP-894',
      type: 'PAYMENT_CAPTURED',
      amountEGP: 2700,
      debitAccount: 'TRAVELER_CC_TOKEN_4910',
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      timestamp: '2026-08-23 14:15:24',
      status: 'SETTLED',
      metadata: { serviceType: 'diving', supplierId: 'SUP-DIVE-02', travelerName: 'Ahmed Mansour', reason: 'Coral Canyon Guided Dive' }
    },
    {
      id: 'LEDGER-004',
      transactionId: 'TXN-984105-PAY',
      idempotencyKey: 'IDEMP-PAY-004-894',
      bookingRef: 'DHB-SAF-2026-095',
      tripId: 'DHB-TRIP-894',
      type: 'PAYMENT_CAPTURED',
      amountEGP: 4200,
      debitAccount: 'TRAVELER_CC_TOKEN_4910',
      creditAccount: 'PLATFORM_ESCROW_MAIN',
      currency: 'EGP',
      timestamp: '2026-08-23 14:15:25',
      status: 'SETTLED',
      metadata: { serviceType: 'safari', supplierId: 'SUP-SAFARI-01', travelerName: 'Ahmed Mansour', reason: 'St. Catherine Sunrise Trek' }
    },
    {
      id: 'LEDGER-005',
      transactionId: 'TXN-984106-COMM',
      idempotencyKey: 'IDEMP-COMM-001-894',
      bookingRef: 'DHB-TRF-2026-042',
      tripId: 'DHB-TRIP-894',
      type: 'PLATFORM_COMMISSION',
      amountEGP: 210,
      debitAccount: 'PLATFORM_ESCROW_MAIN',
      creditAccount: 'PLATFORM_REVENUE_COMMISSIONS',
      currency: 'EGP',
      timestamp: '2026-08-23 14:16:00',
      status: 'SETTLED',
      metadata: { serviceType: 'transfer', reason: 'Platform Commission (15%)' }
    }
  ];
  const entries: LedgerEntryEntity[] = [];
  let prevHash = LEDGER_GENESIS_HASH;
  for (const row of seedRows) {
    const signatureHash = hashEntry({ ...row, previousHash: prevHash });
    entries.push({ ...row, previousHash: prevHash, signatureHash });
    prevHash = signatureHash;
  }
  return entries;
}

/**
 * Invented contact numbers earlier seeds wrote onto supplier records. Booking
 * SMS goes to the supplier contact on record, so a row still carrying one
 * would text a stranger the traveller's name and phone. Seed reconcile merges
 * over existing rows (and keeps fields the seed no longer sets), so the old
 * values are cleared explicitly; a number Ops has since changed is untouched.
 */
const RETIRED_SEED_PHONES = new Set(['+20 100 876 5432', '+20 101 445 6677']);

function retireSeededPhones(): void {
  for (const supplier of db.suppliers) {
    if (supplier.phone && RETIRED_SEED_PHONES.has(supplier.phone)) delete supplier.phone;
    if (supplier.whatsapp && RETIRED_SEED_PHONES.has(supplier.whatsapp)) delete supplier.whatsapp;
  }
}

export function runMigrationsAndSeed() {
  db.runInTransaction(() => {
    // 1. Seed Users if empty.
    //
    // The seed password used to be the literal 'Dahab2026!Secure', committed in
    // this file. Because the Admin and Operations accounts below are seeded on
    // any boot with an empty user table, anyone who could read this repository
    // could sign in as Admin through the ordinary /api/auth/login route.
    //
    // Seeding now requires SEED_USER_PASSWORD to be supplied explicitly. With no
    // password configured, no accounts are created and the platform starts with
    // an empty user table — provision the first admin out of band instead.
    const seedPassword = process.env.SEED_USER_PASSWORD;

    // The leaked value is refused by name.
    //
    // Removing the literal from this file stopped it being *seeded*, but
    // nothing stopped someone setting SEED_USER_PASSWORD back to it — and it
    // is the string that has been in this repository's history, so it is the
    // first thing anyone would try. A boot that would re-establish it fails
    // loudly rather than quietly re-opening the admin account.
    const LEAKED_SEED_PASSWORDS = new Set(['Dahab2026!Secure', 'dahab2026!secure']);
    if (seedPassword && LEAKED_SEED_PASSWORDS.has(seedPassword)) {
      throw new Error(
        '[Migrations] SEED_USER_PASSWORD is the password that was committed to this ' +
        'repository. It is public. Choose a different one.'
      );
    }
    if (seedPassword && seedPassword.length < 16) {
      throw new Error(
        '[Migrations] SEED_USER_PASSWORD must be at least 16 characters. These accounts ' +
        'include Admin and Operations, and /api/auth/login accepts them from anywhere.'
      );
    }

    if (db.users.length === 0 && !seedPassword) {
      console.warn(
        '[Migrations] No users present and SEED_USER_PASSWORD is not set — skipping user seeding. ' +
        'Set SEED_USER_PASSWORD to provision the demo accounts, or create the first admin manually.'
      );
    }
    if (db.users.length === 0 && seedPassword) {
      const createSeedUser = (id: string, email: string, name: string, phone: string, role: any, supplierId?: string) => {
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto.scryptSync(seedPassword, salt, 64).toString('hex');
        return {
          id,
          email,
          name,
          phone,
          passwordHash,
          passwordSalt: salt,
          passwordAlgorithm: 'scrypt' as const,
          role,
          ...(supplierId ? { supplierId } : {}),
          createdAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-20T10:00:00.000Z'
        };
      };

      db.users.push(
        createSeedUser('USR-AHMED-01', 'ahmed.traveler@example.com', 'Ahmed Mansour', '+20 100 234 5678', 'Traveler'),
        // Linked to SUP-SHUTTLE-01 (seeded below) so the demo Supplier account can
        // actually act as a supplier: without this, every supplier-scoped route
        // that checks req.user.supplierId — including /api/rentals/provider —
        // rejected with "Your account is not linked to a supplier", and the
        // rest of the Supplier Portal's "Sinai Shuttle Fleet" view was decorative
        // only, never actually backed by this account.
        createSeedUser('USR-SUPPLIER-01', 'captain.mahmoud@sinai-shuttle.com', 'Mahmoud Salem', '+20 100 876 5432', 'Supplier', 'SUP-SHUTTLE-01'),
        createSeedUser('USR-OPS-01', 'ops.director@dahab.travel', 'Sarah Khalil', '+20 102 998 1234', 'Operations'),
        createSeedUser('USR-ADMIN-01', 'admin@dahab.travel', 'System Administrator', '+20 100 000 0001', 'Admin')
      );
    }

    // Flag any pre-existing unsalted user for legacy verification + rehash on login.
    for (const u of db.users) {
      if (!u.passwordSalt && u.passwordHash && u.passwordHash !== 'FIREBASE_AUTH_MANAGED') {
        u.passwordAlgorithm = 'sha256_legacy';
      }
    }

    // 2. Seed / Reconcile Core Platform Suppliers
    const coreSuppliers: SupplierEntity[] = [
      {
        id: 'SUP-SHUTTLE-01',
        businessName: 'Sinai Comfort Shuttle & Transfers',
        businessNameAr: 'شاتل سيناء للراحة والنقل السياحي',
        category: 'transfer',
        tier: 'Tier 1 Certified',
        status: 'Active',
        // No phone: '+20 100 876 5432' was an invented number, and booking SMS
        // now goes to the supplier contact on record — so it would be texted
        // the traveller's details on every transfer. Ops records the real one.
        leadContact: 'Captain Mahmoud Salem',
        email: 'dispatch@sinai-shuttle.com',
        area: 'Sharm El Sheikh & Dahab Highway',
        licenseNumber: 'MOT-SINAI-TRF-#4821',
        rating: 4.9,
        reviewCount: 142,
        onboardedAt: '2026-01-15',
        approvedBy: 'Ops Desk (Sarah Khalil)',
        payoutAccountNumber: 'EG890002000119284102948102'
      },
      {
        id: 'SUP-DIVE-02',
        businessName: 'Sinai Divers & Coral Protectors',
        businessNameAr: 'غواصو سيناء وحماة المرجان',
        category: 'diving',
        tier: 'Vetted Local Partner',
        status: 'Active',
        // No phone: '+20 101 445 6677' was invented (see SUP-SHUTTLE-01).
        leadContact: 'Omar Soliman',
        email: 'bookings@sinai-divers.com',
        area: 'Lighthouse & Canyon',
        licenseNumber: 'UNVERIFIED_CLAIM_CDWS-#4912',
        cdwsVerified: false,
        verificationStatus: 'UNVERIFIED_REGULATORY_CLAIM',
        rating: 4.9,
        reviewCount: 310,
        onboardedAt: '2026-02-01',
        approvedBy: 'Ops Desk (Sarah Khalil)',
        metadata: {
          historicalClaim: 'CDWS-VERIFIED-#4912',
          previousStatus: 'REGULATORY_VERIFIED',
          correctionReason: 'Legacy placeholder CDWS ID not found in current official CDWS registry; preserved historical claim',
          correctedAt: '2026-08-28T10:24:00Z'
        }
      },
      {
        id: 'SUP-HTL-01',
        businessName: 'Ali Baba Boutique Hotel & Palapas',
        businessNameAr: 'فندق علي بابا بوتيك وبالاباس',
        category: 'hotel',
        tier: 'Tier 1 Certified',
        status: 'Active',
        leadContact: 'Tarek Nabil (+20 109 332 1100)',
        phone: '+20 109 332 1100',
        email: 'reservations@alibaba-dahab.com',
        area: 'Lighthouse Promenade',
        licenseNumber: 'MOT-HTL-DHB-#108',
        rating: 4.8,
        reviewCount: 489,
        onboardedAt: '2026-01-10',
        approvedBy: 'Ops Desk (Sarah Khalil)'
      },
      {
        id: 'SUP-SAFARI-01',
        businessName: 'Bedouin Trails & Mount Moses Expeditions',
        businessNameAr: 'دروب البدو ورحلات جبل موسى وسانت كاترين',
        category: 'safari',
        tier: 'Tier 1 Certified',
        status: 'Active',
        leadContact: 'Sheikh Salem Al-Jabali (+20 106 778 9900)',
        phone: '+20 106 778 9900',
        email: 'salem@bedouintrails.com',
        area: 'St. Catherine & Wadi Qnai',
        licenseNumber: 'MOT-SAF-SINAI-#994',
        rating: 5.0,
        reviewCount: 220,
        onboardedAt: '2026-02-15',
        approvedBy: 'Ops Desk (Sarah Khalil)'
      }
    ];

    for (const sup of coreSuppliers) {
      const idx = db.suppliers.findIndex(s => s.id === sup.id);
      if (idx >= 0) {
        db.suppliers[idx] = { ...db.suppliers[idx], ...sup };
      } else {
        db.suppliers.push(sup);
      }
    }
    retireSeededPhones();

    // 2b. The eight in-destination services the Book Now catalogue sells.
    //
    // Reconciled every boot rather than seeded once, because they exist to make
    // the catalogue's cards bookable and the catalogue can change. Idempotent:
    // an existing record is merged, not duplicated.
    for (const sup of IN_DESTINATION_SUPPLIERS) {
      const idx = db.suppliers.findIndex(s => s.id === sup.id);
      if (idx >= 0) db.suppliers[idx] = { ...db.suppliers[idx], ...sup };
      else db.suppliers.push(sup);
    }
    retireSeededPhones();
    for (const sku of IN_DESTINATION_SKUS) {
      const idx = db.productSkus.findIndex(s => s.id === sku.id);
      if (idx >= 0) db.productSkus[idx] = { ...db.productSkus[idx], ...sku };
      else db.productSkus.push(sku);
    }

    // 2c. The products behind the catalogue activities (experienceProducts.ts).
    // Same reconcile-every-boot rule as 2b.
    for (const sup of EXPERIENCE_SUPPLIERS) {
      if (!db.suppliers.some(s => s.id === sup.id)) db.suppliers.push(sup);
    }
    for (const sku of EXPERIENCE_SKUS) {
      const idx = db.productSkus.findIndex(s => s.id === sku.id);
      if (idx >= 0) db.productSkus[idx] = { ...db.productSkus[idx], ...sku };
      else db.productSkus.push(sku);
    }

    // 2d. The city registry (report 08 §4; gap C-3 of 11) — reconciled every
    // boot from CITIES_SEED, the same discipline as 2b: the TypeScript seed
    // stays the single authoring source and the table carries the promoted
    // columns the catalogue tables will FK to next (plan 10 §6).
    for (const city of CITIES_SEED) {
      const row = { ...city, id: city.slug };
      const idx = db.cities.findIndex(c => c.id === row.id);
      if (idx >= 0) db.cities[idx] = { ...db.cities[idx], ...row };
      else db.cities.push(row);
    }

    // 3. Seed Transfer SKUs (Reference Vertical) if the canonical transfer SKU
    // is missing. Keyed on identity, not on "collection empty": step 2b above
    // seeds the Book Now catalogue SKUs, so the collection is never empty on a
    // fresh boot — and those additions must not suppress the reference SKUs
    // that inventory slots and seeded bookings below reference by id.
    if (!db.productSkus.some(s => s.id === 'SKU-TRF-001')) {
      db.productSkus.push(
        {
          id: 'SKU-TRF-001',
          supplierId: 'SUP-SHUTTLE-01',
          serviceType: 'transfer',
          title: 'Private Comfort Van (Sharm Airport → Dahab)',
          titleAr: 'فان خاص مكيف ومريح (مطار شرم الشيخ ← دهب)',
          description: 'Direct private transfer with terminal meet & greet, air-conditioned 2024 Toyota HiAce, luggage assistance, and mineral water.',
          routeFrom: 'Sharm El Sheikh Intl Airport (SSH)',
          routeTo: 'Dahab Accommodation',
          durationMinutes: 60,
          basePriceEGP: 1400,
          currency: 'EGP',
          maxCapacityPerSlot: 6,
          active: true,
          includedItems: ['Terminal Meet & Greet with Name Sign', 'Direct Highway Route via Nabq Checkpoint', 'Flight Delay Insurance (Grace 60 mins)', 'Cold Sinai Spring Water Bottles'],
          cancellationPolicyHours: 12
        },
        {
          id: 'SKU-TRF-002',
          supplierId: 'SUP-SHUTTLE-01',
          serviceType: 'transfer',
          title: 'Shared Coastal Shuttle (Sharm Airport → Dahab)',
          titleAr: 'حافلة ساحلية مشتركة (مطار شرم الشيخ ← دهب)',
          description: 'Cost-effective scheduled coastal shuttle connecting SSH terminals directly to Dahab Lighthouse hubs.',
          routeFrom: 'Sharm El Sheikh Intl Airport (SSH)',
          routeTo: 'Dahab Central Station / Lighthouse',
          durationMinutes: 75,
          basePriceEGP: 450,
          currency: 'EGP',
          maxCapacityPerSlot: 14,
          active: true,
          includedItems: ['Scheduled Departure', 'Luggage Space 1 Bag per Passenger', 'AC Vehicle'],
          cancellationPolicyHours: 6
        },
        {
          id: 'SKU-TRF-003',
          supplierId: 'SUP-SHUTTLE-01',
          serviceType: 'transfer',
          title: 'Premium VIP SUV (Sharm Airport → Dahab)',
          titleAr: 'سيارة دفع رباعي VIP فاخرة (مطار شرم الشيخ ← دهب)',
          description: 'Executive luxury Toyota Land Cruiser / Prado transfer with high-speed Starlink WiFi and refreshments.',
          routeFrom: 'Sharm El Sheikh Intl Airport (SSH)',
          routeTo: 'Dahab Luxury Villa / Hotel',
          durationMinutes: 55,
          basePriceEGP: 2600,
          currency: 'EGP',
          maxCapacityPerSlot: 4,
          active: true,
          includedItems: ['VIP Fast-track Exit Assistance', 'Luxury 4x4 Vehicle', 'High-speed Starlink Wi-Fi', 'Fresh Juices & Snacks'],
          cancellationPolicyHours: 24
        },
        // Hotel SKUs
        {
          id: 'SKU-HTL-001',
          supplierId: 'SUP-HTL-01',
          serviceType: 'hotel',
          title: 'Ali Baba Boutique Hotel — Seafront Palapa Suite (5 Nights)',
          titleAr: 'فندق علي بابا بوتيك — جناح بالابا بإطلالة بحرية (5 ليالٍ)',
          description: 'Authentic beachfront boutique lodging on Lighthouse bay with organic breakfast and private sundeck.',
          routeFrom: 'Lighthouse Promenade, Dahab',
          routeTo: 'Seafront Palapa',
          durationMinutes: 7200,
          basePriceEGP: 12500,
          currency: 'EGP',
          maxCapacityPerSlot: 10,
          active: true,
          includedItems: ['5 Nights Ocean View Stay', 'Daily Organic Bedouin Breakfast', 'High-speed Fiber Wi-Fi', 'Complimentary Snorkel Gear'],
          cancellationPolicyHours: 48
        },
        {
          id: 'SKU-HTL-002',
          supplierId: 'SUP-HTL-01',
          serviceType: 'hotel',
          title: 'Dahab Paradise Resort — Deluxe Mountain View Room (5 Nights)',
          titleAr: 'منتجع دهب بارادايس — غرفة ديلوكس بإطلالة الجبل (5 ليالٍ)',
          description: 'Quiet boutique resort north of town with infinity pool looking over the Gulf of Aqaba.',
          routeFrom: 'Blue Hole Road, Dahab',
          routeTo: 'Deluxe Room',
          durationMinutes: 7200,
          basePriceEGP: 14800,
          currency: 'EGP',
          maxCapacityPerSlot: 8,
          active: true,
          includedItems: ['5 Nights Deluxe Stay', 'Buffet Breakfast & Sunset Tea', 'Pool Access & Towel Service'],
          cancellationPolicyHours: 48
        },
        // Diving SKUs
        {
          id: 'SKU-DIV-001',
          supplierId: 'SUP-DIVE-02',
          serviceType: 'diving',
          title: 'Coral Canyon & Lighthouse Guided Reef Dive (2 Tanks)',
          titleAr: 'غطسة استرشادية في كانيون ومنارة دهب (خزانان ومعدات كاملة)',
          description: 'Spectacular guided reef adventure exploring the world-famous Dahab Canyon geocleft with CDWS certified dive masters.',
          routeFrom: 'Sinai Divers Dive Center',
          routeTo: 'Canyon Dive Site',
          durationMinutes: 180,
          basePriceEGP: 2700,
          currency: 'EGP',
          maxCapacityPerSlot: 8,
          active: true,
          includedItems: ['2 Guided Dives with Master Instructor', 'Complete Aqualung Gear & Weights', 'CDWS & Marine Park Conservation Permits', 'Surface Interval Hot Bedouin Herbal Tea'],
          cancellationPolicyHours: 24
        },
        {
          id: 'SKU-DIV-002',
          supplierId: 'SUP-DIVE-02',
          serviceType: 'diving',
          title: 'Blue Hole & Bells Full-Day Expedition (2 Guided Dives)',
          titleAr: 'رحلة استكشافية ليوم كامل في البلو هول والبلز (غطستان)',
          description: 'The premier Dahab underwater landmark dropoff dive from the Bells chimneystack to the Blue Hole saddle.',
          routeFrom: 'Sinai Divers Dive Center',
          routeTo: 'Blue Hole & The Bells',
          durationMinutes: 240,
          basePriceEGP: 3400,
          currency: 'EGP',
          maxCapacityPerSlot: 6,
          active: true,
          includedItems: ['4WD Jeep Safari Transport', '2 Deep Guided Dives', 'Lunch at Bedouin Sea Camp', 'Full Equipment & 12L Tanks'],
          cancellationPolicyHours: 24
        },
        // Safari SKUs
        {
          id: 'SKU-SAF-001',
          supplierId: 'SUP-SAFARI-01',
          serviceType: 'safari',
          title: 'St. Catherine & Mount Moses Sunrise Trek (Bedouin Guided)',
          titleAr: 'رحلة شروق الشمس على جبل موسى ودير سانت كاترين (دليل بدوي)',
          description: 'Midnight ascent of Mount Sinai for breathtaking dawn panoramic vistas followed by a heritage tour of Saint Catherine Monastery.',
          routeFrom: 'Dahab Pick-up Point',
          routeTo: 'Mount Sinai Summit (2,285m)',
          durationMinutes: 480,
          basePriceEGP: 4200,
          currency: 'EGP',
          maxCapacityPerSlot: 12,
          active: true,
          includedItems: ['4WD Private Transport to St. Catherine', 'Licensed Bedouin Guide (Jabaliyah Tribe)', 'Monastery UNESCO Entry Pass', 'Mountain Top Warm Blankets & Herbal Tea'],
          cancellationPolicyHours: 24
        },
        {
          id: 'SKU-SAF-002',
          supplierId: 'SUP-SAFARI-01',
          serviceType: 'safari',
          title: 'Wadi Qnai & Three Pools Quad Safari + Stargazing Dinner',
          titleAr: 'سفاري وادي قني بالبيتش باجي وعشاء بدوي تحت النجوم',
          description: 'Exciting desert quad bike ride through sandstone valleys followed by a traditional fire-cooked Bedouin feast and astronomical stargazing.',
          routeFrom: 'Wadi Qnai Staging Base',
          routeTo: 'Bedouin Valley Camp',
          durationMinutes: 300,
          basePriceEGP: 3100,
          currency: 'EGP',
          maxCapacityPerSlot: 10,
          active: true,
          includedItems: ['Automatic 350cc Quad Bike & Helmet', 'Traditional Mandi Feast by Open Fire', 'Astro-guide Telescope Session'],
          cancellationPolicyHours: 12
        }
      );
    }

    for (const [skuId, timeSlots] of Object.entries(EXISTING_SKU_TIME_SLOTS)) {
      const sku = db.productSkus.find(s => s.id === skuId);
      if (sku && !sku.timeSlots?.length) sku.timeSlots = [...timeSlots];
      if (sku && !sku.routeFromAr) sku.routeFromAr = meetingPointArOf(sku.routeFrom);
    }

    // 4. Seed Inventory Slots for the next 7 days if empty
    if (db.inventorySlots.length === 0) {
      const today = new Date();
      const slots = ['08:00 AM', '10:30 AM', '01:00 PM', '04:30 PM', '08:00 PM', '11:30 PM'];

      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        slots.forEach((time, slotIdx) => {
          db.inventorySlots.push({
            id: `SLOT-TRF-${dateStr}-${slotIdx}`,
            skuId: 'SKU-TRF-001',
            date: dateStr,
            timeSlot: time,
            totalCapacity: 6,
            reservedCapacity: i === 0 && slotIdx === 1 ? 2 : 0,
            heldCapacity: 0,
            priceEGP: 1400,
            status: 'AVAILABLE'
          });
        });
      }
    }

    // 5. Seed Initial Trip for Ahmed Mansour if empty
    if (db.trips.length === 0) {
      // The demo graph (trip + items + holds + ledger) is rooted at the demo
      // traveler, whose login credentials only exist with SEED_USER_PASSWORD.
      // Without him the mandatory trips.user_id FK aborts every fresh sqlite
      // boot, so ensure a NON-LOGINABLE placeholder owner: an empty
      // passwordHash makes verifyPassword unconditionally reject (see
      // authService), so this row can own demo data but never authenticate.
      // Never put a real hash here — that would recreate the committed
      // default-credential incident the SEED_USER_PASSWORD gate exists to
      // prevent.
      if (!db.users.some(u => u.id === 'USR-AHMED-01')) {
        db.users.push({
          id: 'USR-AHMED-01',
          email: 'ahmed.traveler@example.com',
          name: 'Ahmed Mansour',
          phone: '+20 100 234 5678',
          passwordHash: '',
          role: 'Traveler',
          createdAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-20T10:00:00.000Z'
        });
        console.log('[Migrations] Seeded non-loginable demo traveler placeholder (USR-AHMED-01) for demo-graph FK integrity');
      }
      const tripId = 'DHB-TRIP-894';
      db.trips.push({
        id: tripId,
        userId: 'USR-AHMED-01',
        title: 'Ahmed’s 5-Day Dahab Adventure & Immersion',
        status: 'IN_DESTINATION',
        lengthDays: 5,
        travelersCount: 2,
        budget: 'Moderate',
        pace: 'Balanced',
        interests: ['Diving', 'Adventure', 'Food'],
        startDate: '2026-08-23',
        endDate: '2026-08-28',
        totalEstimatedEGP: 20800,
        totalPaidEGP: 20800,
        createdAt: '2026-08-20T14:00:00.000Z',
        updatedAt: '2026-08-23T14:15:25.000Z'
      });

      // Trip Items
      db.tripItems.push(
        {
          id: 'ITEM-001',
          tripId,
          serviceType: 'hotel',
          skuId: 'SKU-HTL-001',
          title: 'Ali Baba Hotel — 5 Nights Sea View',
          dayNumber: 1,
          timeSlot: 'Check-in 14:00',
          priceEGP: 12500,
          status: 'CONFIRMED',
          bookingId: 'DHB-HTL-2026-081',
          createdAt: '2026-08-23T14:15:22.000Z',
          updatedAt: '2026-08-23T14:15:22.000Z'
        },
        {
          id: 'ITEM-002',
          tripId,
          serviceType: 'transfer',
          skuId: 'SKU-TRF-001',
          title: 'SSH Airport Private Van Transfer (Captain Mahmoud)',
          dayNumber: 1,
          timeSlot: '10:30 AM',
          priceEGP: 1400,
          status: 'CONFIRMED',
          bookingId: 'DHB-TRF-2026-042',
          createdAt: '2026-08-23T14:15:23.000Z',
          updatedAt: '2026-08-23T14:15:23.000Z'
        },
        {
          id: 'ITEM-003',
          tripId,
          serviceType: 'diving',
          skuId: 'SKU-DIV-001',
          title: 'Coral Canyon Guided Shore Dive (Sinai Divers)',
          dayNumber: 2,
          timeSlot: '09:00 AM',
          priceEGP: 2700,
          status: 'CONFIRMED',
          bookingId: 'DHB-DIV-2026-118',
          createdAt: '2026-08-23T14:15:24.000Z',
          updatedAt: '2026-08-23T14:15:24.000Z'
        },
        {
          id: 'ITEM-004',
          tripId,
          serviceType: 'safari',
          skuId: 'SKU-SAF-001',
          title: 'St. Catherine & Mount Moses Sunrise Trek',
          dayNumber: 3,
          timeSlot: '02:00 AM',
          priceEGP: 4200,
          status: 'CONFIRMED',
          bookingId: 'DHB-SAF-2026-095',
          createdAt: '2026-08-23T14:15:25.000Z',
          updatedAt: '2026-08-23T14:15:25.000Z'
        }
      );

      // Bookings
      db.bookings.push(
        {
          id: 'DHB-TRF-2026-042',
          bookingRef: 'DHB-TRF-2026-042',
          tripId,
          tripItemId: 'ITEM-002',
          supplierId: 'SUP-SHUTTLE-01',
          skuId: 'SKU-TRF-001',
          serviceType: 'transfer',
          amountEGP: 1400,
          paymentState: 'CAPTURED',
          supplierState: 'DISPATCHED',
          travelerName: 'Ahmed Mansour',
          travelerPhone: '+20 100 234 5678',
          travelerEmail: 'ahmed.traveler@example.com',
          passengersCount: 2,
          pickupLocation: 'Sharm El Sheikh Intl Airport (SSH) Terminal 1',
          dropoffLocation: 'Ali Baba Hotel, Lighthouse, Dahab',
          scheduledDate: '2026-08-23',
          scheduledTime: '10:30 AM',
          flightNumber: 'MS-028 (Cairo → Sharm El Sheikh)',
          confirmationCode: 'DHB-SSH-8942-OK',
          assignedResource: {
            driverName: 'Mahmoud Salem',
            driverNameAr: 'محمود سالم',
            driverPhone: '+20 100 876 5432',
            vehicleModel: 'Toyota HiAce Comfort Van 2024 White',
            vehiclePlate: 'ط ج د 4821'
          },
          createdAt: '2026-08-23T14:15:23.000Z',
          updatedAt: '2026-08-25T12:00:00.000Z'
        }
      );

      // Telemetry
      db.transferTelemetry.push({
        bookingId: 'DHB-TRF-2026-042',
        referenceCode: 'DHB-TRF-2026-042',
        driverName: 'Mahmoud Salem',
        driverNameAr: 'محمود سالم',
        driverPhone: '+20 100 876 5432',
        vehicleModel: 'Toyota HiAce Comfort Van 2024 White',
        vehiclePlate: 'ط ج د 4821',
        pickupLocation: 'Sharm El Sheikh Intl Airport (SSH) Terminal 1',
        dropoffLocation: 'Ali Baba Hotel, Lighthouse, Dahab',
        scheduledTime: 'Day 1 · 10:30 AM',
        flightNumber: 'MS-028 (Cairo → Sharm El Sheikh)',
        flightStatus: 'ON_TIME',
        status: 'DISPATCHED',
        lastGpsUpdate: '3 mins ago (Nabq checkpoint northbound)',
        updatedAt: new Date().toISOString()
      });
    }

    // 6. Seed Double-Entry Ledger if empty.
    //
    // Signatures are computed by buildSeedLedgerEntries() with the same
    // algorithm as LedgerService.calculateEntryHash, chained via previousHash
    // from the genesis constant. They used to be hardcoded placeholder strings
    // with no previousHash at all, so every fresh boot failed its own
    // /api/health integrity check (5/5 "signature does not match"). Never put
    // placeholder hashes here: a fresh seed must verify clean, or the
    // escrow/budget UI inherits the distrust.
    if (db.ledgerEntries.length === 0) {
      db.ledgerEntries.push(...buildSeedLedgerEntries());
    }

    // 6b. One-time repair for databases seeded with the legacy placeholder
    // hashes (signature values that were never computed, no previousHash).
    //
    // Fail-closed by design. Auto-repair runs ONLY when the ledger holds
    // exactly the five legacy seed rows and nothing else (a fresh-ish DB with
    // no real money in it). If traveler transactions were recorded on top of
    // the broken seed, resealing would rewrite the predecessors their
    // signatures commit to — destroying tamper-evidence for real payments.
    // Those databases keep failing verification loudly until an operator runs
    // a deliberate reseal (ledgerService.repairAndSealLedgerChain, which must
    // never run automatically — see its doc comment).
    {
      const LEGACY_SEED_IDS = new Set(['LEDGER-001', 'LEDGER-002', 'LEDGER-003', 'LEDGER-004', 'LEDGER-005']);
      const LEGACY_PLACEHOLDERS = new Set([
        'sha256:4a8b79e192f81498bca120934fa12480bcae8124',
        'sha256:88bc410294f91048bc8190234fa9912048bac912',
        'sha256:71048bcae9124801948291048fbca78f921e44bc',
        'sha256:948271048bcae9124801948291048fbca78f921e',
        'sha256:102384a9c18d948271048bcae912480194829104',
      ]);
      const isLegacyRow = (e: { id: string; signatureHash: string; previousHash?: string }) =>
        LEGACY_SEED_IDS.has(e.id) && (LEGACY_PLACEHOLDERS.has(e.signatureHash) || !e.previousHash);
      const hasLegacyRows = db.ledgerEntries.some(isLegacyRow);
      if (hasLegacyRows) {
        const onlyLegacySeed = db.ledgerEntries.length === LEGACY_SEED_IDS.size &&
          db.ledgerEntries.every(e => LEGACY_SEED_IDS.has(e.id));
        if (onlyLegacySeed) {
          let prevHash = LEDGER_GENESIS_HASH;
          for (const entry of db.ledgerEntries) {
            entry.previousHash = prevHash;
            const { signatureHash: _old, ...unsigned } = entry;
            const data = `${unsigned.id}:${unsigned.transactionId}:${unsigned.idempotencyKey}:${unsigned.type}:${unsigned.amountEGP}:${unsigned.debitAccount}:${unsigned.creditAccount}:${unsigned.timestamp}:${prevHash}`;
            entry.signatureHash = `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
            prevHash = entry.signatureHash;
          }
          console.log('[DB] Repaired 5 legacy ledger seed signature(s) with correct hash chain.');
        } else {
          console.error(
            '[DB] Ledger holds legacy placeholder seed signatures beneath real transactions. ' +
            'Automatic repair is refused: resealing would rewrite the predecessors those ' +
            'transactions commit to. Run ledgerService.repairAndSealLedgerChain() deliberately ' +
            'as an operator migration after review.'
          );
        }
      }
    }

    // 7. Seed Intelligence Opportunities if empty
    if (db.opportunities.length === 0 && initialOpportunities) {
      db.opportunities.push(...initialOpportunities);
    }

    // 8. Import Master Dahab Local Commerce Dataset (Suppliers, Offers, Provenance)
    importDahabLocalCommerce();

    // 9. Import the Dahab Hotels Catalogue (hotel suppliers, 5-night package
    // SKUs and catalogue rows, idempotently — see importDahabHotels).
    importDahabHotels();

    // 9b. Seed Area Profiles BEFORE the accommodations import below.
    // Accommodations carry a mandatory area_id FK, and the DKOS bootstrap
    // that owns these rows runs after this transaction flushes — without
    // this step, every fresh database aborts the entire seed transaction
    // with FOREIGN KEY constraint failed. Merged by id (same semantics as
    // the DKOS seedInto), so the later bootstrap simply re-affirms them.
    {
      let added = 0;
      for (const seed of EXPANDED_AREA_PROFILES as any[]) {
        if (!seed || typeof seed.id !== 'string') continue;
        const idx = db.areaProfiles.findIndex(a => a.id === seed.id);
        if (idx >= 0) db.areaProfiles[idx] = { ...db.areaProfiles[idx], ...seed };
        else {
          db.areaProfiles.push(seed);
          added++;
        }
      }
      if (added > 0) console.log(`[Migrations] Seeded ${added} area profiles ahead of accommodations import`);
    }

    // 9b-2. Seed Siwa + Nuweiba area profiles BEFORE the accommodations import.
    // Same ordering rule as 9b: accommodations carry a mandatory areaId FK.
    {
      let added = 0;
      for (const seed of [...SIWA_AREA_PROFILES, ...NUWEIBA_AREA_PROFILES] as any[]) {
        if (!seed || typeof seed.id !== 'string') continue;
        const idx = db.areaProfiles.findIndex(a => a.id === seed.id);
        if (idx >= 0) db.areaProfiles[idx] = { ...db.areaProfiles[idx], ...seed };
        else {
          db.areaProfiles.push(seed);
          added++;
        }
      }
      if (added > 0) console.log(`[Migrations] Seeded ${added} Siwa + Nuweiba area profiles ahead of accommodations import`);
    }

    // 9c. Import the generalized Dahab Accommodations Catalogue (hotels plus
    // hostels/apartments/villas/camps/guesthouses) — the live surface behind
    // /api/accommodations. Runs after importDahabHotels, which is left in
    // place unmodified but now unread once hotelRoutes.ts is repointed to
    // this table; see importDahabAccommodations.
    importDahabAccommodations();

    // 9d. Import Siwa + Nuweiba accommodation catalogues. These are the
    // 'early' destinations — editorial content and a growing supplier list.
    // Idempotent; see importSinewibaAccommodations.
    importSinewibaAccommodations();

    // 9e. Import Google Maps verified accommodations for all destinations.
    // These are real places with Google-verified ratings, reviews, and
    // coordinates. Idempotent; see importGoogleMapsAccommodations.
    importGoogleMapsAccommodations();

    // 10. Import the Dahab Rentals Catalogue (bike/e-bike suppliers, 'rental'
    // SKUs, listings and extras, idempotently — see importDahabRentals).
    importDahabRentals();

    // 10b. Converge the Tripadvisor-sourced stays catalogue into the
    // accommodations collection. Runs after the curated catalogue (step 9c)
    // so it enriches what the corpus already holds and creates only what it
    // lacks — idempotent; see importDahabTripadvisorStays.
    const tripadvisorStays = importDahabTripadvisorStays();
    if (tripadvisorStays.created > 0 || tripadvisorStays.enriched > 0 || tripadvisorStays.deactivated > 0) {
      console.log(`[Migrations] ${tripadvisorStays.summary}`);
    }

    // 10b-2. Converge ScrapeGraph-sourced hotel data (optional: skips when
    // data/scrapegraph_hotels.json is absent). Enriches curated rows with
    // fresh ratings and creates ACCTSG-* rows for new listings.
    const scrapeGraphHotels = importDahabScrapeGraph();
    if (scrapeGraphHotels.created > 0 || scrapeGraphHotels.enriched > 0 || scrapeGraphHotels.deactivated > 0) {
      console.log(`[Migrations] ${scrapeGraphHotels.summary}`);
    }

    // 10c. Converge the dining menus. Runs after the DKOS bootstrap owns the
    // venues (this one runs after 9c and 10 so every venue row it enriches
    // already exists) and it creates the restaurant suppliers the venues'
    // supplierId used to point at without ever resolving.
    //
    // Step 10c-0 is the same ordering guard as 9b, for the same reason: the DKOS
    // bootstrap that owns db.diningVenues runs AFTER this transaction, so on a
    // fresh database the menu import below would find no venues to enrich and
    // abort the whole seed.
    {
      let added = 0;
      for (const seed of EXPANDED_DINING_VENUES as any[]) {
        if (!seed || typeof seed.id !== 'string') continue;
        const idx = db.diningVenues.findIndex(v => v.id === seed.id);
        if (idx >= 0) db.diningVenues[idx] = { ...db.diningVenues[idx], ...seed };
        else {
          db.diningVenues.push(seed);
          added++;
        }
      }
      if (added > 0) console.log(`[Migrations] Seeded ${added} dining venues ahead of the menus import`);
    }
    const diningMenus = importDahabMenus();
    if (diningMenus.itemsCreated > 0 || diningMenus.itemsUpdated > 0 || diningMenus.itemsRemoved > 0) {
      console.log(`[Migrations] ${diningMenus.summary}`);
    }

    // 11. Converge known catalogue data defects (missing durations, a boat
    // safari pointing at the wrong place, a highway listed as a neighborhood).
    // Idempotent; see server/db/catalogIntegrity.ts.
    const repairs = repairCatalogIntegrity();
    if (repairs.length > 0) {
      console.log(`[DB] Catalogue integrity repair: ${repairs.join(', ')}`);
    }

    // 12. Give every catalogued property a sellable room type.
    //
    // Runs last so the full accommodation set is present — the curated catalogue
    // (9c) and the Tripadvisor convergence (10b) both write db.accommodations,
    // and a backfill placed before 10b would miss 382 properties and then have
    // to be re-run anyway. Idempotent, and it skips room types an admin has
    // already verified; see server/db/seeds/backfillRoomTypes.ts for why the
    // properties with an unknown room count are left unsellable rather than
    // given a guessed capacity.
    const roomTypes = backfillRoomTypes();
    if (roomTypes.created > 0 || roomTypes.updated > 0) {
      console.log(`[DB] ${roomTypes.summary}`);
    }

    // 13. Trip packages (docs/CATALOG_API_CONTRACT.md): seeded once from the
    // editorial READY_TRIP_PROGRAMMES, then owned by the catalogue surface.
    // Idempotent by seedId; a package an editor deleted is not re-created.
    const packages = seedTripPackages();
    if (packages.created > 0) {
      console.log(`[DB] Trip packages seeded: ${packages.created}`);
    }
  });

  console.log('[DB] Migrations and authoritative seed data verified successfully.');
}
