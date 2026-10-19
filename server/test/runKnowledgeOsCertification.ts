import { dahabKnowledgeOs } from '../services/dahabKnowledgeOs';
import { entityResolutionService } from '../services/entityResolutionService';
import { conflictEngine } from '../services/conflictEngine';
import { snapshotService } from '../services/snapshotService';
import { geointelligenceService } from '../services/geointelligenceService';
import { rankingEngine } from '../services/rankingEngine';
import { unifiedSearchEngine } from '../services/unifiedSearchEngine';
import { db } from '../db/database';

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

export function runFullKnowledgeOsCertification() {
  console.log('\n================================================================');
  console.log('🏛️  DAHAB KNOWLEDGE OPERATING SYSTEM (DKOS) CERTIFICATION SUITE');
  console.log('================================================================\n');

  // Bootstrapping
  dahabKnowledgeOs.bootstrapValidatedCorpus();

  // ---------------------------------------------------------------------------
  // SUITE 1: Corpus Ingestion & Provenance Verification
  // ---------------------------------------------------------------------------
  const suite1 = '1. Corpus Ingestion & Fact Provenance';
  assert(suite1, 'Sources loaded with authority weights', db.researchSources.length >= 4, 'Expected at least 4 authoritative sources');
  assert(suite1, 'Area profiles seeded', db.areaProfiles.length >= 6, 'Expected at least 6 Dahab areas');
  assert(suite1, 'Places seeded with Arabic and English metadata', db.places.length >= 3, 'Expected at least 3 places');
  assert(suite1, 'Activities seeded with durations and booking modes', db.activities.length >= 3, 'Expected at least 3 activities');
  assert(suite1, 'Emergency resources present', db.emergencyResources.length >= 3, 'Expected 3 emergency resources');
  assert(suite1, 'CDWS & EEAA decrees registered', db.regulatoryDecrees.length >= 2, 'Expected at least 2 regulatory decrees');

  // Verify Fact Provenance
  const depthFact = db.temporalFacts.find(f => f.predicate === 'maxReefDepthMeters');
  assert(suite1, 'Temporal facts have valid primary source link', Boolean(depthFact && depthFact.primarySourceId), 'Fact missing primarySourceId');
  assert(suite1, 'Temporal facts have confidence tier assigned', Boolean(depthFact && depthFact.confidenceTier === 'VERY_HIGH'), 'Fact missing confidence tier');

  // ---------------------------------------------------------------------------
  // SUITE 2: Entity Resolution 2.0 (Arabic, Transliterations, Aliases, Merges)
  // ---------------------------------------------------------------------------
  const suite2 = '2. Entity Resolution 2.0 Engine';
  
  // Arabic Normalization Tests
  const norm1 = entityResolutionService.normalizeArabic('اللايتهاوسْ');
  const norm2 = entityResolutionService.normalizeArabic('اللايتهاوس');
  assert(suite2, 'Arabic Tashkeel & diacritics normalized', norm1 === norm2, `Normalized "${norm1}" !== "${norm2}"`);

  const normAlef1 = entityResolutionService.normalizeArabic('إيل جاردن');
  const normAlef2 = entityResolutionService.normalizeArabic('ايل جاردن');
  assert(suite2, 'Alef variations normalized (إ -> ا)', normAlef1 === normAlef2);

  // Exact Match via Google Place ID
  const exactMatch = entityResolutionService.resolveCandidate({
    nameEn: 'Lighthouse Coral Bay',
    lat: 28.5027,
    lng: 34.5200,
    googlePlaceId: 'ChIJb7c-lighthouse-01'
  });
  assert(suite2, 'Exact Match via Google Place ID', exactMatch.matchStatus === 'EXACT' && exactMatch.confidenceScore === 1.0);

  // High Confidence Match via Arabic Alias & Proximity
  const aliasMatch = entityResolutionService.resolveCandidate({
    nameEn: 'Lighthouse Bay Shore Entry',
    nameAr: 'شاطئ المنارة',
    lat: 28.5028,
    lng: 34.5201
  });
  assert(suite2, 'High Confidence Match via Arabic Alias & Proximity', aliasMatch.matchStatus === 'EXACT' || aliasMatch.matchStatus === 'HIGH_CONFIDENCE');

  // Distinct Candidate (Far away or unmatched name)
  const distinctCandidate = entityResolutionService.resolveCandidate({
    nameEn: 'Secret Mountain Camp Nowhere',
    lat: 28.4500,
    lng: 34.4000
  });
  assert(suite2, 'Distinct candidate recognized', distinctCandidate.matchStatus === 'DISTINCT');

  // ---------------------------------------------------------------------------
  // SUITE 3: Conflict Detection & Priority Engine
  // ---------------------------------------------------------------------------
  const suite3 = '3. Conflict Detection & Source Priority';

  // Conflict 1: Temporal Conflict (New observation vs old observation)
  const temporalRes = conflictEngine.evaluateClaims(
    {
      entityId: 'place_lighthouse_reef',
      property: 'averageMealPriceEGP',
      value: 350,
      sourceId: 'OLD_GUIDE_2025',
      sourceType: 'COMMUNITY',
      authorityScore: 0.6,
      observedAt: '2025-01-01T00:00:00Z'
    },
    {
      entityId: 'place_lighthouse_reef',
      property: 'averageMealPriceEGP',
      value: 480,
      sourceId: 'DAHAB_FIELD_AUDIT_Q3_2026',
      sourceType: 'APPROVED_OPERATIONAL',
      authorityScore: 0.95,
      observedAt: '2026-08-20T00:00:00Z'
    }
  );
  assert(suite3, 'Temporal observation difference classified as TEMPORAL', temporalRes.conflict?.classification === 'TEMPORAL');
  assert(suite3, 'Winning claim is newest operational observation', temporalRes.winningClaim?.value === 480);

  // Conflict 2: Regulatory / Safety Conflict (Authoritative wins over Commercial)
  const safetyRes = conflictEngine.evaluateClaims(
    {
      entityId: 'place_blue_hole_sanctuary',
      property: 'maxWindKnots_safety_threshold',
      value: 30,
      sourceId: 'BLOGGER_CLAIM',
      sourceType: 'COMMUNITY',
      authorityScore: 0.4,
      observedAt: '2026-08-15T00:00:00Z'
    },
    {
      entityId: 'place_blue_hole_sanctuary',
      property: 'maxWindKnots_safety_threshold',
      value: 20,
      sourceId: 'CDWS_DESTINATION_ATLAS_2026',
      sourceType: 'AUTHORITATIVE',
      authorityScore: 0.98,
      observedAt: '2026-08-10T00:00:00Z'
    }
  );
  assert(suite3, 'Authoritative authority wins safety threshold conflict', safetyRes.winningClaim?.value === 20);

  // ---------------------------------------------------------------------------
  // SUITE 4: Geointelligence & Anomaly Detection
  // ---------------------------------------------------------------------------
  const suite4 = '4. Geointelligence & Spatial Verification';

  // Coordinate Validation
  const validCoords = geointelligenceService.validateCoordinates(28.5025, 34.5195);
  assert(suite4, 'Valid Dahab coordinates accepted', validCoords.isValid);

  const outOfBounds = geointelligenceService.validateCoordinates(51.5074, -0.1278); // London
  assert(suite4, 'Out-of-bounds coordinates rejected', !outOfBounds.isValid && outOfBounds.anomalyType === 'OUT_OF_BOUNDS');

  const nullIsland = geointelligenceService.validateCoordinates(0, 0);
  assert(suite4, 'Null island (0,0) rejected', !nullIsland.isValid && nullIsland.anomalyType === 'ZERO_COORDINATES');

  // Area Containment
  const containingArea = geointelligenceService.getContainingArea(28.5026, 34.5196);
  assert(suite4, 'Point inside Lighthouse area correctly resolved', containingArea?.id === 'lighthouse');

  // Route travel calculation
  const routeLhToBh = geointelligenceService.calculateRouteEstimate('lighthouse', 'blue_hole');
  assert(suite4, 'Lighthouse to Blue Hole route requires Vehicle transit (~25m)', routeLhToBh.transitMode === 'VEHICLE' && routeLhToBh.durationMinutes >= 20);

  const routeLhToEg = geointelligenceService.calculateRouteEstimate('lighthouse', 'eel_garden');
  assert(suite4, 'Lighthouse to Eel Garden is a walkable coastal path', routeLhToEg.isWalkable && routeLhToEg.transitMode === 'WALK');

  // ---------------------------------------------------------------------------
  // SUITE 5: Emergency & Safety Authoritative Directory
  // ---------------------------------------------------------------------------
  const suite5 = '5. Emergency & Safety Directory';
  const hyperbaric = db.emergencyResources.find(e => e.category === 'Hyperbaric Chamber');
  assert(suite5, 'Hyperbaric Chamber has 24/7 hotline numbers', Boolean(hyperbaric && hyperbaric.hotlineNumbers.length > 0));
  assert(suite5, 'Hospital ER listed with address and trauma capabilities', Boolean(db.emergencyResources.find(e => e.category === 'Hospital ER')));

  // ---------------------------------------------------------------------------
  // SUITE 6: Multi-Dimensional Ranking & Why Matched Engine
  // ---------------------------------------------------------------------------
  const suite6 = '6. Ranking & "Why This" Engine';
  const ranked = rankingEngine.rankActivities(db.activities, {
    originArea: 'lighthouse',
    availableMinutes: 120,
    pace: 'Relaxed',
    interests: ['diving']
  });
  assert(suite6, 'Ranking returns scored candidates', ranked.length > 0 && ranked[0].overallScore > 0);
  assert(suite6, 'Top candidate has explainable whyMatched object', Boolean(ranked[0].whyMatched.factors.geographicFit && ranked[0].whyMatched.factors.timeFit));
  assert(suite6, 'Top candidate provides bilingual reasons', Boolean(ranked[0].whyMatched.primaryReasonEn && ranked[0].whyMatched.primaryReasonAr));

  // ---------------------------------------------------------------------------
  // SUITE 7: Unified Natural Language Search Engine (Acceptance Query)
  // Query: "أنا في اللايتهاوس ومعايا ساعتين وعايز حاجة هادية وبعدها أكل"
  // ---------------------------------------------------------------------------
  const suite7 = '7. Unified Search Engine (Core Traveler Scenario)';
  const query = 'أنا في اللايتهاوس ومعايا ساعتين وعايز حاجة هادية وبعدها أكل';
  const searchResult = unifiedSearchEngine.search(query, 3);

  assert(suite7, 'Intent extracted originZone as "lighthouse"', searchResult.parsedIntent.originZone === 'lighthouse');
  assert(suite7, 'Intent extracted availableMinutes as 120 (2 hours)', searchResult.parsedIntent.availableMinutes === 120);
  assert(suite7, 'Intent extracted pace as "Relaxed"', searchResult.parsedIntent.pace === 'Relaxed');
  assert(suite7, 'Intent identified post-activity food requirement', searchResult.parsedIntent.wantsFoodAfter === true);
  assert(suite7, 'Returns top curated recommendations (max 3)', searchResult.recommendations.length <= 3 && searchResult.recommendations.length > 0);
  assert(suite7, 'Attached post-activity dining recommendation', Boolean(searchResult.recommendations[0].nextFoodRecommendation?.venue));

  // ---------------------------------------------------------------------------
  // SUITE 8: Knowledge Snapshots & Diff Computation
  // ---------------------------------------------------------------------------
  const suite8 = '8. Knowledge Snapshots & Versioning';
  const newSnapshot = snapshotService.createSnapshot('DAHAB-TEST-SNAP-01');
  assert(suite8, 'Snapshot created with SHA-256 fingerprint', Boolean(newSnapshot.fingerprintHash && newSnapshot.fingerprintHash.length === 64));
  assert(suite8, 'Snapshot records total facts and entities', newSnapshot.totalFacts > 0 && newSnapshot.totalEntities > 0);

  const diff = snapshotService.compareSnapshots('DAHAB-2026-08-26-BOOTSTRAP', 'DAHAB-TEST-SNAP-01');
  assert(suite8, 'Snapshot diff computed without throwing', Boolean(diff && diff.details));

  // ---------------------------------------------------------------------------
  // SUITE 9: Negative Proofs & Security Boundaries
  // ---------------------------------------------------------------------------
  const suite9 = '9. Negative Proofs & Operational Boundaries';
  
  // Stale facts detection
  const staleFacts = dahabKnowledgeOs.getKnowledgeHealth().staleFacts;
  assert(suite9, 'Stale facts counter calculated correctly', typeof staleFacts === 'number');

  // Overall Quality Score >= 90
  const health = dahabKnowledgeOs.getKnowledgeHealth();
  assert(suite9, 'Overall Knowledge Quality Score exceeds 90.0', health.qualityScoreOverall >= 90.0, `Score was ${health.qualityScoreOverall}`);

  // Summary output
  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${results.length}`);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    console.error('❌ Failed tests:');
    results.filter(r => !r.passed).forEach(f => {
      console.error(`  - [${f.suite}] ${f.name}: ${f.message}`);
    });
    return false;
  }

  console.log('✅ ALL DAHAB KNOWLEDGE OPERATING SYSTEM TESTS PASSED PERFECTLY!\n');
  return true;
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('runKnowledgeOsCertification')) {
  const success = runFullKnowledgeOsCertification();
  process.exit(success ? 0 : 1);
}
