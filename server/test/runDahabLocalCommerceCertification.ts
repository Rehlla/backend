import { db } from '../db/database';
import { importDahabLocalCommerce, normalizePhoneNumber, computeFingerprint, searchLocalCommerce } from '../db/seeds/importDahabLocalCommerce';
import { runMigrationsAndSeed } from '../db/migrations';
import { dahabKnowledgeOs } from '../services/dahabKnowledgeOs';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, message?: string, details?: any) {
  results.push({
    suite,
    name,
    passed: condition,
    message: condition ? 'PASSED' : message || 'FAILED',
    details
  });
}

export function runLocalCommerceCertification() {
  console.log('\n================================================================');
  console.log('🛍️  DAHAB LOCAL COMMERCE & PROVENANCE DATASET CERTIFICATION');
  console.log('================================================================\n');

  // Initial Seed & Import
  runMigrationsAndSeed();
  dahabKnowledgeOs.bootstrapValidatedCorpus();

  // ---------------------------------------------------------------------------
  // SUITE 1: Raw Source Ingestion & Provenance Schema Integrity
  // ---------------------------------------------------------------------------
  const suite1 = '1. Raw Source Layer & Ingestion Integrity';
  assert(suite1, 'Raw supplier sources table populated', db.rawSupplierSources.length >= 8, `Expected >= 8 raw supplier sources, found ${db.rawSupplierSources.length}`);
  assert(suite1, 'Raw offer sources table populated', db.rawOfferSources.length >= 10, `Expected >= 10 raw offer sources, found ${db.rawOfferSources.length}`);
  
  const kingRaw = db.rawSupplierSources.find(s => s.id === 'RAW-SUP-001');
  assert(suite1, 'Raw source contains flyer reference', Boolean(kingRaw && kingRaw.sourceReference.includes('king-safari')), 'King Safari raw source missing flyer ref');
  assert(suite1, 'Raw source contains extraction confidence', Boolean(kingRaw && kingRaw.extractedConfidence && kingRaw.extractedConfidence > 0.9), 'Raw source confidence missing or too low');
  assert(suite1, 'Raw source contains contact string', Boolean(kingRaw && kingRaw.contactRaw), 'Raw contact string missing');

  // ---------------------------------------------------------------------------
  // SUITE 2: Deterministic Idempotency & Transactional Guarantees
  // ---------------------------------------------------------------------------
  const suite2 = '2. Deterministic Idempotency & Transactional Safety';
  const initialSuppliersCount = db.suppliers.length;
  const initialOffersCount = db.supplierOffers.length;
  const initialRawSuppliersCount = db.rawSupplierSources.length;
  const initialRawOffersCount = db.rawOfferSources.length;

  // Re-run importer a second time
  const rerunResult = importDahabLocalCommerce();
  assert(suite2, 'Re-run execution succeeded', rerunResult.success === true, 'Re-run importer failed');
  assert(suite2, 'Supplier count strictly unchanged after re-run', db.suppliers.length === initialSuppliersCount, `Supplier count changed: ${initialSuppliersCount} -> ${db.suppliers.length}`);
  assert(suite2, 'Offer count strictly unchanged after re-run', db.supplierOffers.length === initialOffersCount, `Offer count changed: ${initialOffersCount} -> ${db.supplierOffers.length}`);
  assert(suite2, 'Raw supplier sources unchanged after re-run', db.rawSupplierSources.length === initialRawSuppliersCount, `Raw count changed: ${initialRawSuppliersCount} -> ${db.rawSupplierSources.length}`);
  assert(suite2, 'Raw offer sources unchanged after re-run', db.rawOfferSources.length === initialRawOffersCount, `Raw offer count changed: ${initialRawOffersCount} -> ${db.rawOfferSources.length}`);
  assert(suite2, 'Created count is 0 on idempotent re-run', rerunResult.offersCreated === 0 && rerunResult.suppliersCreated === 0, 'Entities were re-created on second run');

  // ---------------------------------------------------------------------------
  // SUITE 3: Canonical Supplier Entity Resolution & CDWS Badges
  // ---------------------------------------------------------------------------
  const suite3 = '3. Supplier Resolution & Regulatory CDWS Clearance';
  const redSeaRelax = db.suppliers.find(s => s.id === 'SUP-RED-SEA-RELAX');
  assert(suite3, 'CDWS Dive Center marked as REGULATORY_VERIFIED', Boolean(redSeaRelax && redSeaRelax.verificationStatus === 'REGULATORY_VERIFIED'), 'Red Sea Relax verification status invalid');
  assert(suite3, 'CDWS badge explicitly true for verified dive center', Boolean(redSeaRelax && redSeaRelax.cdwsVerified === true), 'Red Sea Relax missing cdwsVerified');
  assert(suite3, 'CDWS license number is preserved', Boolean(redSeaRelax && redSeaRelax.licenseNumber === 'CDWS-DHB-104'), 'License number missing or invalid');

  const bakrySafari = db.suppliers.find(s => s.id === 'RAW-SUP-BAKRY-SAFARI');
  assert(suite3, 'Unverified flyer supplier marked as SOURCE_REPORTED', Boolean(bakrySafari && bakrySafari.verificationStatus === 'SOURCE_REPORTED'), 'Bakry Safari should be SOURCE_REPORTED');
  assert(suite3, 'Unverified flyer supplier does not have CDWS badge', Boolean(bakrySafari && bakrySafari.cdwsVerified === false), 'Bakry Safari must not have CDWS badge');

  const bedouinGuild = db.suppliers.find(s => s.id === 'SUP-SINAI-BEDOUIN-GUILD');
  assert(suite3, 'Bedouin Guild marked as SUPPLIER_CONFIRMED', Boolean(bedouinGuild && bedouinGuild.verificationStatus === 'SUPPLIER_CONFIRMED'), 'Bedouin Guild verification invalid');
  assert(suite3, 'Bedouin Guild has Arabic tribal name', Boolean(bedouinGuild && bedouinGuild.businessNameAr.includes('المزينة')), 'Bedouin Guild Arabic name missing');

  // ---------------------------------------------------------------------------
  // SUITE 4: Canonical Offers & Price Normalization (Single vs Double, Bases)
  // ---------------------------------------------------------------------------
  const suite4 = '4. Offer & Pricing Normalization Engine';
  const quadOffer = db.supplierOffers.find(o => o.id === 'OFFER-KING-002');
  assert(suite4, 'Quad safari offer has SINGLE pricing basis', Boolean(quadOffer && quadOffer.pricingBasis === 'SINGLE'), 'Quad offer pricing basis invalid');
  assert(suite4, 'Quad safari has distinct single price (350)', Boolean(quadOffer && quadOffer.singlePrice === 350), 'Quad single price invalid');
  assert(suite4, 'Quad safari has distinct double price (450)', Boolean(quadOffer && quadOffer.doublePrice === 450), 'Quad double price invalid');
  assert(suite4, 'Quad safari has structured inclusions', Boolean(quadOffer && quadOffer.includes.length >= 3), 'Quad inclusions missing');
  assert(suite4, 'Quad safari has structured exclusions', Boolean(quadOffer && quadOffer.excludes.length >= 2), 'Quad exclusions missing');

  const blueHoleOffer = db.supplierOffers.find(o => o.id === 'OFFER-KING-001');
  assert(suite4, 'Blue Hole safari offer price is 550 EGP', Boolean(blueHoleOffer && blueHoleOffer.price === 550), 'Blue Hole price mismatch');
  assert(suite4, 'Blue Hole safari mentions speedboat transfer', Boolean(blueHoleOffer && blueHoleOffer.includes.some(i => i.toLowerCase().includes('speedboat'))), 'Blue Hole speedboat inclusion missing');

  const wishwashiOffer = db.supplierOffers.find(o => o.id === 'OFFER-KING-003');
  assert(suite4, 'Wishwashi canyon offer price is 750 EGP', Boolean(wishwashiOffer && wishwashiOffer.price === 750), 'Wishwashi price mismatch');
  assert(suite4, 'Wishwashi canyon mentions freshwater pool swim', Boolean(wishwashiOffer && wishwashiOffer.includes.some(i => i.includes('freshwater'))), 'Wishwashi freshwater pool inclusion missing');

  // ---------------------------------------------------------------------------
  // SUITE 5: Aggregated Market Statistics & Price Ranges
  // ---------------------------------------------------------------------------
  const suite5 = '5. Market Price Statistics Engine';
  const stats = db.state.marketPriceStats || [];
  assert(suite5, 'Market price stats computed for multiple activities', stats.length >= 5, `Expected >= 5 market stats, found ${stats.length}`);

  const quadStat = stats.find(s => s.activityId === 'ACT-QUAD-TWILAT');
  assert(suite5, 'Quad market stat aggregates multiple observed offers', Boolean(quadStat && quadStat.observedOfferCount >= 2), 'Quad stat offer count invalid');
  assert(suite5, 'Quad market stat computes lowest price (300 EGP)', Boolean(quadStat && quadStat.lowestObservedPrice === 300), 'Lowest quad price mismatch');
  assert(suite5, 'Quad market stat computes highest price (350 EGP)', Boolean(quadStat && quadStat.highestObservedPrice === 350), 'Highest quad price mismatch');
  assert(suite5, 'Quad market stat formats price range string', Boolean(quadStat && quadStat.priceRange.includes('300 - 350')), 'Quad price range string invalid');
  assert(suite5, 'Quad market stat labeled as OBSERVED_MARKET_DATA', Boolean(quadStat && quadStat.label === 'OBSERVED_MARKET_DATA'), 'Market stat label invalid');

  // ---------------------------------------------------------------------------
  // SUITE 6: DKOS Knowledge Graph Integration & Temporal Facts
  // ---------------------------------------------------------------------------
  const suite6 = '6. DKOS Knowledge Graph & Temporal Fact Provenance';
  const flyerSources = db.researchSources.filter(s => s.name.startsWith('Flyer/Registry Source:'));
  assert(suite6, 'Flyer sources registered in DKOS researchSources', flyerSources.length >= 6, `Expected >= 6 flyer sources in DKOS, found ${flyerSources.length}`);

  const supplierFacts = db.temporalFacts.filter(f => f.subjectType === 'SUPPLIER' && f.predicate === 'commercial_verification_status');
  assert(suite6, 'Temporal facts created for supplier legitimacy', supplierFacts.length >= 6, `Expected >= 6 supplier temporal facts, found ${supplierFacts.length}`);

  const priceFacts = db.temporalFacts.filter(f => f.predicate === 'commercial_offer_price');
  assert(suite6, 'Temporal facts created for offer pricing', priceFacts.length >= 10, `Expected >= 10 pricing temporal facts, found ${priceFacts.length}`);
  assert(suite6, 'Price facts have CURRENT status', priceFacts.every(f => f.status === 'CURRENT'), 'Some pricing temporal facts are not CURRENT');

  // ---------------------------------------------------------------------------
  // SUITE 7: Bilingual Search & Natural Language Retrieval
  // ---------------------------------------------------------------------------
  const suite7 = '7. Bilingual Natural Language Search Engine';
  const arSearch1 = searchLocalCommerce('كينج سفاري');
  assert(suite7, 'Arabic search finds King Safari supplier', arSearch1.suppliers.some(s => s.id === 'SUP-KING-SAFARI'), 'Failed to find King Safari by Arabic name');

  const arSearch2 = searchLocalCommerce('بيتش باجي');
  assert(suite7, 'Arabic search for Beach Buggy finds quad offers', arSearch2.offers.some(o => o.canonicalCategory === 'QUADBIKE'), 'Failed to find quad offers by Arabic keyword');

  const arSearch3 = searchLocalCommerce('الوشواش');
  assert(suite7, 'Arabic search for Wishwashi finds canyon expedition', arSearch3.offers.some(o => o.activityId === 'ACT-WISHWASHI-EXPEDITION'), 'Failed to find Wishwashi offers');

  const enSearch1 = searchLocalCommerce('Desert Divers');
  assert(suite7, 'English search finds Desert Divers with CDWS badge', enSearch1.suppliers.some(s => s.id === 'SUP-DESERT-DIVERS' && s.cdwsVerified), 'Failed to find Desert Divers');

  const enSearch2 = searchLocalCommerce('Mount Moses');
  assert(suite7, 'English search finds Mount Moses Sunrise Trek', enSearch2.offers.some(o => o.activityId === 'ACT-MOUNT-MOSES-TREK'), 'Failed to find Mount Moses trek');

  // ---------------------------------------------------------------------------
  // SUITE 8: Preservation of Authoritative System Baseline
  // ---------------------------------------------------------------------------
  const suite8 = '8. Authoritative Platform Baseline Preservation';
  assert(suite8, 'Users preserved (Ahmed Mansour, Ops, etc.)', db.users.length >= 4, 'Users table truncated');
  assert(suite8, 'Trips and items preserved', db.trips.length >= 1 && db.tripItems.length >= 1, 'Trips table truncated');
  assert(suite8, 'Authoritative ledger preserved', db.ledgerEntries.length >= 5, 'Ledger entries truncated');
  assert(suite8, 'Area profiles preserved (6 areas)', db.areaProfiles.length >= 6, 'Area profiles truncated');
  assert(suite8, 'Places preserved', db.places.length >= 10, 'Places table truncated');
  assert(suite8, 'Emergency resources intact', db.emergencyResources.length >= 3, 'Emergency resources truncated');

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(`  ✅ [${r.suite}] ${r.name}`);
    } else {
      failedCount++;
      console.error(`  ❌ [${r.suite}] ${r.name} - ${r.message}`);
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('runDahabLocalCommerceCertification.ts')) {
  runLocalCommerceCertification();
}
