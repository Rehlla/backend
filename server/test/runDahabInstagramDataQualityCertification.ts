import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { importDahabLocalCommerce, searchLocalCommerce } from '../db/seeds/importDahabLocalCommerce';
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

export function runInstagramDataQualityCertification() {
  console.log('\n================================================================');
  console.log('📸 DAHAB DATA TRUTH & INSTAGRAM MARKET INTELLIGENCE CERTIFICATION');
  console.log('================================================================\n');

  // 1. Initial Seed, Corpus Bootstrap & Importer
  runMigrationsAndSeed();
  dahabKnowledgeOs.bootstrapValidatedCorpus();
  const importRes = importDahabLocalCommerce();

  // ---------------------------------------------------------------------------
  // SUITE 1: Search Query Matrix & Coverage Log Validation
  // ---------------------------------------------------------------------------
  const suite1 = '1. Search Query Matrix & Coverage Log';
  const searchLogPath = path.join(process.cwd(), 'data', 'instagram', 'dahab_instagram_search_log.json');
  assert(suite1, 'Search log file exists', fs.existsSync(searchLogPath), 'Missing search log JSON');

  const searchLogData = JSON.parse(fs.readFileSync(searchLogPath, 'utf-8'));
  assert(suite1, 'Search log contains metadata', Boolean(searchLogData.metadata && searchLogData.metadata.totalQueriesExecuted >= 40), 'Search log metadata incomplete');
  assert(suite1, 'Search log has >= 40 query logs', Array.isArray(searchLogData.searchLogs) && searchLogData.searchLogs.length >= 40, `Found ${searchLogData.searchLogs?.length} queries`);

  const enQueries = searchLogData.searchLogs.filter((q: any) => q.language === 'en');
  const arQueries = searchLogData.searchLogs.filter((q: any) => q.language === 'ar');
  const comboQueries = searchLogData.searchLogs.filter((q: any) => q.category === 'Destination Combo');

  assert(suite1, 'English query family covered (>= 15 queries)', enQueries.length >= 15, `Found ${enQueries.length} English queries`);
  assert(suite1, 'Arabic query family covered (>= 12 queries)', arQueries.length >= 12, `Found ${arQueries.length} Arabic queries`);
  assert(suite1, 'Destination combo family covered (>= 10 queries)', comboQueries.length >= 10, `Found ${comboQueries.length} destination combo queries`);

  // ---------------------------------------------------------------------------
  // SUITE 2: Instagram Sources Dataset & Profile Integrity
  // ---------------------------------------------------------------------------
  const suite2 = '2. Instagram Sources Dataset & Profile Integrity';
  const instaSourcesPath = path.join(process.cwd(), 'data', 'instagram', 'dahab_instagram_sources.json');
  assert(suite2, 'Instagram sources JSON exists', fs.existsSync(instaSourcesPath), 'Missing Instagram sources JSON');

  const instaSourcesData = JSON.parse(fs.readFileSync(instaSourcesPath, 'utf-8'));
  const accounts = instaSourcesData.accounts || [];
  assert(suite2, 'Instagram sources contains >= 12 real accounts', accounts.length >= 12, `Found ${accounts.length} accounts`);

  // Verify accounts have complete metadata
  const hasValidFields = accounts.every((a: any) => 
    a.username && 
    a.displayName && 
    a.profileUrl && 
    a.category && 
    a.bio && 
    a.locationMention && 
    a.ownershipStatus && 
    a.verificationStatus &&
    Array.isArray(a.services) &&
    Array.isArray(a.posts) && a.posts.length > 0
  );
  assert(suite2, 'All Instagram accounts have valid non-null schema fields', hasValidFields, 'Some accounts have missing schema fields');

  const ownershipConfirmedCount = accounts.filter((a: any) => a.ownershipStatus === 'OWNERSHIP_CONFIRMED').length;
  assert(suite2, 'High ratio of OWNERSHIP_CONFIRMED accounts (>= 10)', ownershipConfirmedCount >= 10, `Found ${ownershipConfirmedCount} confirmed`);

  // ---------------------------------------------------------------------------
  // SUITE 3: CDWS Regulatory Truth & Unverified Claim Disambiguation
  // ---------------------------------------------------------------------------
  const suite3 = '3. CDWS Regulatory Truth & Unverified Claim Disambiguation';
  const redSeaRelax = db.suppliers.find(s => s.id === 'SUP-RED-SEA-RELAX');
  assert(suite3, 'Red Sea Relax is REGULATORY_VERIFIED with license CDWS-DHB-104', Boolean(redSeaRelax && redSeaRelax.verificationStatus === 'REGULATORY_VERIFIED' && redSeaRelax.licenseNumber === 'CDWS-DHB-104'), 'Red Sea Relax regulatory check failed');

  const desertDivers = db.suppliers.find(s => s.id === 'SUP-DESERT-DIVERS');
  assert(suite3, 'Desert Divers is REGULATORY_VERIFIED with license CDWS-DHB-092', Boolean(desertDivers && desertDivers.verificationStatus === 'REGULATORY_VERIFIED' && desertDivers.licenseNumber === 'CDWS-DHB-092'), 'Desert Divers regulatory check failed');

  const poseidonDivers = db.suppliers.find(s => s.id === 'SUP-POSEIDON-DIVERS');
  assert(suite3, 'Poseidon Divers is REGULATORY_VERIFIED with license CDWS-DHB-071', Boolean(poseidonDivers && poseidonDivers.verificationStatus === 'REGULATORY_VERIFIED' && poseidonDivers.licenseNumber === 'CDWS-DHB-071'), 'Poseidon Divers regulatory check failed');

  // Verify legacy/unverified claim handling (SUP-DIVE-02)
  const legacyClaimSupplier = db.suppliers.find(s => s.id === 'SUP-DIVE-02');
  assert(suite3, 'Legacy unverified claim supplier marked as UNVERIFIED_REGULATORY_CLAIM', Boolean(legacyClaimSupplier && legacyClaimSupplier.verificationStatus === 'UNVERIFIED_REGULATORY_CLAIM'), 'Legacy supplier not marked UNVERIFIED_REGULATORY_CLAIM');
  assert(suite3, 'Legacy unverified claim has cdwsVerified=false', Boolean(legacyClaimSupplier && legacyClaimSupplier.cdwsVerified === false), 'Legacy supplier cdwsVerified must be false');
  assert(suite3, 'Legacy unverified claim preserves original historical claim in metadata', Boolean(legacyClaimSupplier?.metadata?.historicalClaim), 'Legacy supplier missing historical claim in metadata');

  // ---------------------------------------------------------------------------
  // SUITE 4: Database Synchronization & Entity Population
  // ---------------------------------------------------------------------------
  const suite4 = '4. Database Persistence & Entity Collections';
  assert(suite4, 'db.socialAccounts is populated (>= 12 accounts)', db.socialAccounts.length >= 12, `Found ${db.socialAccounts.length} social accounts`);
  assert(suite4, 'db.sourceRecords is populated (>= 10 source records)', db.sourceRecords.length >= 10, `Found ${db.sourceRecords.length} source records`);
  assert(suite4, 'db.priceObservations is populated (>= 10 price observations)', db.priceObservations.length >= 10, `Found ${db.priceObservations.length} price observations`);

  // sourcePriceText and amount are optional on PriceObservationEntity; the
  // predicate threw on any observation without source text rather than skipping it.
  const quadObservation = db.priceObservations.find(
    o => (o.sourcePriceText || '').includes('350 EGP') || (o.sourcePriceText || '').includes('300 EGP')
  );
  assert(suite4, 'Price observation preserves exact source text', Boolean(quadObservation && quadObservation.sourcePriceText), 'Price observation source text missing');
  assert(suite4, 'Price observation has valid currency and amount', Boolean(quadObservation && quadObservation.amount !== undefined && quadObservation.amount > 0 && quadObservation.currency === 'EGP'), 'Price observation amount/currency invalid');
  assert(suite4, 'Price observation has valid freshness status', Boolean(quadObservation && (quadObservation.freshnessStatus === 'CURRENT' || quadObservation.freshnessStatus === 'CURRENT_LIKELY' || quadObservation.freshnessStatus === 'RECENT')), 'Price freshness invalid');

  // ---------------------------------------------------------------------------
  // SUITE 5: DKOS Temporal Facts & Provenance Linkage
  // ---------------------------------------------------------------------------
  const suite5 = '5. DKOS Temporal Facts & Provenance Linkage';
  const instaFacts = db.temporalFacts.filter(f => f.predicate === 'instagram_price_observation');
  assert(suite5, 'DKOS temporal facts emitted for Instagram price observations (>= 10)', instaFacts.length >= 10, `Found ${instaFacts.length} Instagram temporal facts`);
  assert(suite5, 'Instagram facts have valid confidence score (>= 0.90)', instaFacts.every(f => f.confidence >= 0.90), 'Some Instagram temporal facts have low confidence');
  assert(suite5, 'Instagram facts have status CURRENT', instaFacts.every(f => f.status === 'CURRENT'), 'Some Instagram facts are not CURRENT');

  // ---------------------------------------------------------------------------
  // SUITE 6: Bilingual Multi-Source Natural Language Search
  // ---------------------------------------------------------------------------
  const suite6 = '6. Bilingual Multi-Source Natural Language Search';
  const search1 = searchLocalCommerce('kingsafaridahab');
  assert(suite6, 'Search by Instagram handle finds King Safari account', search1.socialAccounts.some(s => s.username === 'kingsafaridahab'), 'Failed to find account by handle');

  const search2 = searchLocalCommerce('freediving');
  assert(suite6, 'Search by keyword finds Dahab Freedivers account', search2.socialAccounts.some(s => s.username === 'dahabfreedivers'), 'Failed to find freedivers account');

  const search3 = searchLocalCommerce('بلو لاجون');
  assert(suite6, 'Arabic search finds Blue Lagoon camp and offers', search3.offers.length > 0 || search3.socialAccounts.length > 0, 'Failed to find Blue Lagoon entities');

  const search4 = searchLocalCommerce('تسلق صخور');
  assert(suite6, 'Arabic search for rock climbing finds climbing guild/offers', search4.offers.some(o => o.activityId.includes('CLIMB') || o.titleAr.includes('تسلق')), 'Failed to find climbing offers in Arabic');

  // ---------------------------------------------------------------------------
  // SUITE 7: Idempotency & Transactional Safety
  // ---------------------------------------------------------------------------
  const suite7 = '7. Importer Idempotency & Zero Duplicate Creation';
  const preSuppliers = db.suppliers.length;
  const preSocial = db.socialAccounts.length;
  const preObs = db.priceObservations.length;
  const preOffers = db.supplierOffers.length;

  const secondRun = importDahabLocalCommerce();
  assert(suite7, 'Second import run succeeded', secondRun.success === true, 'Second import run failed');
  assert(suite7, 'Suppliers count unchanged on second run', db.suppliers.length === preSuppliers, `Suppliers changed: ${preSuppliers} -> ${db.suppliers.length}`);
  assert(suite7, 'Social accounts count unchanged on second run', db.socialAccounts.length === preSocial, `Social accounts changed: ${preSocial} -> ${db.socialAccounts.length}`);
  assert(suite7, 'Price observations count unchanged on second run', db.priceObservations.length === preObs, `Price observations changed: ${preObs} -> ${db.priceObservations.length}`);
  assert(suite7, 'Supplier offers count unchanged on second run', db.supplierOffers.length === preOffers, `Offers changed: ${preOffers} -> ${db.supplierOffers.length}`);

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
if (process.argv[1] && process.argv[1].endsWith('runDahabInstagramDataQualityCertification.ts')) {
  runInstagramDataQualityCertification();
}
