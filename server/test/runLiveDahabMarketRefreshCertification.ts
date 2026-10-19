import assert from 'assert';
import { db } from '../db/database';
import { runMigrationsAndSeed } from '../db/migrations';
import { dahabKnowledgeOs } from '../services/dahabKnowledgeOs';
import { marketFreshnessService, SourceSnapshotPayload } from '../services/marketFreshnessService';
import { commerceIntelligenceService } from '../services/commerceIntelligenceService';
import { daygiReasoningService } from '../services/daygiReasoningService';
import {
  FreshnessStatus,
  PriceObservationEntity,
  SupplierOfferEntity,
  SupplierEntity,
  SocialAccountEntity,
  MarketChangeEventEntity
} from '../db/schema';

console.log('================================================================================');
console.log('⚡ LIVE DAHAB MARKET REFRESH ENGINE & CHANGE DETECTION CERTIFICATION');
console.log('================================================================================');

process.env.SKIP_GEMINI_POLISH = 'true';

let passedAssertions = 0;
async function test(desc: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passedAssertions++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function runCertification() {
  runMigrationsAndSeed();
  dahabKnowledgeOs.bootstrapValidatedCorpus();
  // -----------------------------------------------------------------------------
  // 1. FRESHNESS STATUS & SCORE DECAY
  // -----------------------------------------------------------------------------
  console.log('\n[Section 1: 4-Tier Freshness Status & Score Decay]');

  await test('Calculates FRESH status (<7 days) and maximum score 100', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const observedAt = '2026-02-27T12:00:00Z'; // 2 days old
    const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

    assert.strictEqual(status, FreshnessStatus.FRESH);
    assert.strictEqual(score, 100);
    assert.strictEqual(ageInDays, 2);
  });

  await test('Calculates RECENT status (7-30 days) and scales score 95-80', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const observedAt = '2026-02-15T12:00:00Z'; // 14 days old
    const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

    assert.strictEqual(status, FreshnessStatus.RECENT);
    assert(score >= 80 && score <= 95, `Expected score between 80-95, got ${score}`);
    assert.strictEqual(ageInDays, 14);
  });

  await test('Calculates AGING status (30-90 days) and scales score 79-50', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const observedAt = '2026-01-10T12:00:00Z'; // 50 days old
    const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

    assert.strictEqual(status, FreshnessStatus.AGING);
    assert(score >= 50 && score <= 79, `Expected score between 50-79, got ${score}`);
    assert.strictEqual(ageInDays, 50);
  });

  await test('Calculates STALE status (90-180 days) and scales score 49-20', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const observedAt = '2025-11-01T12:00:00Z'; // 120 days old
    const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

    assert.strictEqual(status, FreshnessStatus.STALE);
    assert(score >= 20 && score <= 49, `Expected score between 20-49, got ${score}`);
    assert.strictEqual(ageInDays, 120);
  });

  await test('Calculates EXPIRED status (>180 days) and assigns score 0', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const observedAt = '2025-06-01T12:00:00Z'; // 273 days old
    const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

    assert.strictEqual(status, FreshnessStatus.EXPIRED);
    assert.strictEqual(score, 0);
    assert(ageInDays > 180);
  });

  // -----------------------------------------------------------------------------
  // 2. DETERMINISTIC CONTENT FINGERPRINTING
  // -----------------------------------------------------------------------------
  console.log('\n[Section 2: Deterministic Content Fingerprinting]');

  await test('Generates deterministic fingerprints for suppliers, offers, prices, and contacts', () => {
    const supFp1 = marketFreshnessService.getSupplierFingerprint({ businessName: 'Blue Ocean Dive', phone: '+20 100 123 4567', whatsapp: 'blueocean' });
    const supFp2 = marketFreshnessService.getSupplierFingerprint({ businessName: '  blue ocean dive  ', phone: '+201001234567', whatsapp: 'blueocean' });
    assert.strictEqual(supFp1, supFp2, 'Supplier fingerprints must normalize case and whitespace');

    const offFp = marketFreshnessService.getOfferFingerprint({ supplierId: 'SUP-01', activityId: 'ACT-BLUE-HOLE', titleEn: 'Blue Hole Guided Dive' });
    assert(offFp.startsWith('fp_off_'), 'Must have offer fingerprint prefix');

    const prcFp = marketFreshnessService.getPriceFingerprint({ offerId: 'OFF-01', priceEGP: 2500, currency: 'EGP', pricingBasis: 'PER_PERSON' });
    assert(prcFp.startsWith('fp_prc_'), 'Must have price fingerprint prefix');

    const cntFp = marketFreshnessService.getContactFingerprint('SUP-01', 'phone', '+20 100 999 8888');
    assert(cntFp.startsWith('fp_cnt_'), 'Must have contact fingerprint prefix');
  });

  // -----------------------------------------------------------------------------
  // 3. CHANGE DETECTION & CLASSIFICATION
  // -----------------------------------------------------------------------------
  console.log('\n[Section 3: Change Detection & Anomaly Classification]');

  await test('Detects price increase event and computes accurate delta & percentage', () => {
    const previous: PriceObservationEntity = {
      id: 'OBS-PREV-01',
      supplierId: 'SUP-TEST-01',
      activityId: 'ACT-BLUE-HOLE',
      priceEGP: 2000,
      pricingBasis: 'PER_PERSON',
      sourceType: 'COMMERCIAL_FLYER',
      sourceReference: 'Flyer Jan 2026',
      observedAt: '2026-01-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.AGING,
      freshnessScore: 60,
      validFrom: '2026-01-01T00:00:00Z'
    };

    const incoming: PriceObservationEntity = {
      id: 'OBS-INC-01',
      supplierId: 'SUP-TEST-01',
      activityId: 'ACT-BLUE-HOLE',
      priceEGP: 2500,
      pricingBasis: 'PER_PERSON',
      sourceType: 'INSTAGRAM_POST',
      sourceReference: 'IG Post Mar 2026',
      observedAt: '2026-03-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.FRESH,
      freshnessScore: 100,
      validFrom: '2026-03-01T00:00:00Z'
    };

    const event = marketFreshnessService.evaluatePriceChange(previous, incoming);
    assert(event, 'Must generate market change event');
    assert.strictEqual(event.eventType, 'PRICE_INCREASE');
    assert.strictEqual(event.previousValue, 2000);
    assert.strictEqual(event.newValue, 2500);
    assert.strictEqual(event.delta, 500);
    assert.strictEqual(event.percentageChange, 25);
    assert.strictEqual(event.isAnomaly, false);
  });

  await test('Detects price decrease event with negative delta and percentage', () => {
    const previous: PriceObservationEntity = {
      id: 'OBS-PREV-02',
      supplierId: 'SUP-TEST-02',
      activityId: 'ACT-CANYON',
      priceEGP: 3000,
      pricingBasis: 'PER_PERSON',
      sourceType: 'COMMERCIAL_FLYER',
      sourceReference: 'Flyer Jan 2026',
      observedAt: '2026-01-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.AGING,
      freshnessScore: 60,
      validFrom: '2026-01-01T00:00:00Z'
    };

    const incoming: PriceObservationEntity = {
      id: 'OBS-INC-02',
      supplierId: 'SUP-TEST-02',
      activityId: 'ACT-CANYON',
      priceEGP: 2400,
      pricingBasis: 'PER_PERSON',
      sourceType: 'INSTAGRAM_POST',
      sourceReference: 'IG Post Mar 2026',
      observedAt: '2026-03-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.FRESH,
      freshnessScore: 100,
      validFrom: '2026-03-01T00:00:00Z'
    };

    const event = marketFreshnessService.evaluatePriceChange(previous, incoming);
    assert(event, 'Must generate market change event');
    assert.strictEqual(event.eventType, 'PRICE_DECREASE');
    assert.strictEqual(event.delta, -600);
    assert.strictEqual(event.percentageChange, -20);
  });

  await test('Detects pricing basis changes (e.g., PER_PERSON to PER_GROUP)', () => {
    const previous: PriceObservationEntity = {
      id: 'OBS-PREV-03',
      supplierId: 'SUP-TEST-03',
      activityId: 'ACT-SAFARI',
      priceEGP: 800,
      pricingBasis: 'PER_PERSON',
      sourceType: 'COMMERCIAL_FLYER',
      sourceReference: 'Flyer Jan 2026',
      observedAt: '2026-01-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.AGING,
      freshnessScore: 60,
      validFrom: '2026-01-01T00:00:00Z'
    };

    const incoming: PriceObservationEntity = {
      id: 'OBS-INC-03',
      supplierId: 'SUP-TEST-03',
      activityId: 'ACT-SAFARI',
      priceEGP: 3500,
      pricingBasis: 'PER_GROUP',
      sourceType: 'INSTAGRAM_POST',
      sourceReference: 'IG Post Mar 2026',
      observedAt: '2026-03-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.FRESH,
      freshnessScore: 100,
      validFrom: '2026-03-01T00:00:00Z'
    };

    const event = marketFreshnessService.evaluatePriceChange(previous, incoming);
    assert.strictEqual(event.eventType, 'PRICING_BASIS_CHANGED');
    assert.strictEqual(event.changeType, 'PRICING_BASIS_CHANGED');
    assert.strictEqual(event.previousValue, 'PER_PERSON');
    assert.strictEqual(event.newValue, 'PER_GROUP');
  });

  await test('Identifies price anomalies (>300% jump or >80% drop) and flags for review', () => {
    const previous: PriceObservationEntity = {
      id: 'OBS-PREV-04',
      supplierId: 'SUP-TEST-04',
      activityId: 'ACT-SNORKEL',
      priceEGP: 500,
      pricingBasis: 'PER_PERSON',
      sourceType: 'COMMERCIAL_FLYER',
      sourceReference: 'Flyer Jan 2026',
      observedAt: '2026-01-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.AGING,
      freshnessScore: 60,
      validFrom: '2026-01-01T00:00:00Z'
    };

    const incoming: PriceObservationEntity = {
      id: 'OBS-INC-04',
      supplierId: 'SUP-TEST-04',
      activityId: 'ACT-SNORKEL',
      priceEGP: 2500,
      pricingBasis: 'PER_PERSON',
      sourceType: 'INSTAGRAM_POST',
      sourceReference: 'IG Post Mar 2026',
      observedAt: '2026-03-01T00:00:00Z',
      freshnessStatus: FreshnessStatus.FRESH,
      freshnessScore: 100,
      validFrom: '2026-03-01T00:00:00Z'
    };

    const event = marketFreshnessService.evaluatePriceChange(previous, incoming);
    assert.strictEqual(event.eventType, 'PRICE_ANOMALY');
    assert.strictEqual(event.isAnomaly, true);
    assert(event.anomalyReason?.includes('Suspicious price spike'));
  });

  // -----------------------------------------------------------------------------
  // 4. LIVE TRANSACTIONAL REFRESH & IDEMPOTENCY
  // -----------------------------------------------------------------------------
  console.log('\n[Section 4: Live Transactional Refresh & Idempotency]');

  await test('Executes end-to-end market refresh transaction and creates immutable snapshot', () => {
    const snapshotPayload: SourceSnapshotPayload = {
      sourceReference: 'Dahab Community Commercial Flyers March 2026',
      sourceType: 'INSTAGRAM',
      ingestionMode: 'IMPORTED_SNAPSHOT',
      capturedAt: '2026-03-02T10:00:00Z',
      suppliers: [
        {
          id: 'SUP-REFRESH-01',
          businessName: 'Laguna Wave Watersports',
          businessNameAr: 'مركز أمواج اللاجونا للرياضات المائية',
          category: 'safari' as any,
          phone: '+20 100 555 1234',
          whatsapp: '+20 100 555 1234',
          verificationStatus: 'REGULATORY_VERIFIED',
          cdwsVerified: true
        }
      ],
      socialAccounts: [
        {
          supplierId: 'SUP-REFRESH-01',
          handle: 'lagunawavedahab',
          username: 'lagunawavedahab',
          postsCount: 142
        }
      ],
      priceObservations: [
        {
          supplierId: 'SUP-REFRESH-01',
          activityId: 'ACT-WINDSURF-01',
          priceEGP: 1200,
          pricingBasis: 'PER_PERSON',
          sourcePriceText: '1200 EGP 2hr Windsurfing',
          observedAt: '2026-03-02T10:00:00Z'
        }
      ]
    };

    const initialObservationsCount = db.priceObservations.length;
    const initialSnapshotsCount = db.marketSnapshots.length;

    const result = marketFreshnessService.executeMarketRefresh({
      snapshot: snapshotPayload
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'SUCCESS');
    assert(result.runId.startsWith('RUN-MKT-'));
    assert(result.snapshotId.startsWith('snap_'));
    assert(result.changesDetectedCount > 0, 'Must record discovered changes');
    assert(db.priceObservations.length > initialObservationsCount, 'New observation must be stored');
    assert(db.marketSnapshots.length > initialSnapshotsCount, 'Snapshot must be created');

    const sup = db.suppliers.find(s => s.id === 'SUP-REFRESH-01');
    assert(sup, 'Supplier must be created');
    assert.strictEqual(sup?.cdwsVerified, true);
  });

  await test('Enforces pure idempotency: running identical snapshot produces 0 duplicate records and 0 duplicate events', () => {
    const snapshotPayload: SourceSnapshotPayload = {
      sourceReference: 'Dahab Community Commercial Flyers March 2026',
      sourceType: 'INSTAGRAM',
      ingestionMode: 'IMPORTED_SNAPSHOT',
      capturedAt: '2026-03-02T10:00:00Z',
      suppliers: [
        {
          id: 'SUP-REFRESH-01',
          businessName: 'Laguna Wave Watersports',
          phone: '+20 100 555 1234',
          whatsapp: '+20 100 555 1234',
          verificationStatus: 'REGULATORY_VERIFIED',
          cdwsVerified: true
        }
      ],
      priceObservations: [
        {
          supplierId: 'SUP-REFRESH-01',
          activityId: 'ACT-WINDSURF-01',
          priceEGP: 1200,
          pricingBasis: 'PER_PERSON',
          sourcePriceText: '1200 EGP 2hr Windsurfing',
          observedAt: '2026-03-02T10:00:00Z',
          sourceReference: 'Dahab Community Commercial Flyers March 2026'
        }
      ]
    };

    const obsCountBefore = db.priceObservations.length;
    const eventsCountBefore = db.marketChangeEvents.length;

    const result = marketFreshnessService.executeMarketRefresh({
      snapshot: snapshotPayload
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(db.priceObservations.length, obsCountBefore, 'Must NOT insert duplicate price observation');
    assert.strictEqual(result.changesDetectedCount, 0, 'Idempotent refresh must detect 0 changes');
    assert.strictEqual(db.marketChangeEvents.length, eventsCountBefore, 'Must NOT append duplicate change events');
  });

  await test('Preserves historical price observations and closes previous active intervals', () => {
    const newPricePayload: SourceSnapshotPayload = {
      sourceReference: 'Dahab Live Spring Update 2026',
      sourceType: 'INSTAGRAM',
      ingestionMode: 'IMPORTED_SNAPSHOT',
      capturedAt: '2026-03-05T12:00:00Z',
      priceObservations: [
        {
          supplierId: 'SUP-REFRESH-01',
          activityId: 'ACT-WINDSURF-01',
          priceEGP: 1400,
          pricingBasis: 'PER_PERSON',
          sourcePriceText: '1400 EGP 2hr Windsurfing',
          observedAt: '2026-03-05T12:00:00Z',
          sourceReference: 'Dahab Live Spring Update 2026'
        }
      ]
    };

    marketFreshnessService.executeMarketRefresh({
      snapshot: newPricePayload
    });

    const allObs = db.priceObservations.filter(
      p => p.supplierId === 'SUP-REFRESH-01' && p.activityId === 'ACT-WINDSURF-01'
    );

    assert.strictEqual(allObs.length, 2, 'History must contain both 1200 and 1400 observations');
    const oldObs = allObs.find(o => (o.priceEGP || o.amount) === 1200);
    const newObs = allObs.find(o => (o.priceEGP || o.amount) === 1400);

    assert(oldObs?.validUntil, 'Previous observation must have validUntil set to close interval');
    assert.strictEqual(oldObs?.validUntil, '2026-03-05T12:00:00Z');
    assert.strictEqual(newObs?.validUntil, undefined, 'Latest observation must remain open');
  });

  await test('Detects and logs supplier contact changes into contact history', () => {
    const existingSup = db.suppliers.find(s => s.id === 'SUP-REFRESH-01');
    assert(existingSup);

    const contactUpdatePayload: SourceSnapshotPayload = {
      sourceReference: 'Supplier WhatsApp Profile Update',
      sourceType: 'INSTAGRAM',
      ingestionMode: 'IMPORTED_SNAPSHOT',
      capturedAt: '2026-03-06T15:00:00Z',
      suppliers: [
        {
          id: 'SUP-REFRESH-01',
          phone: '+20 100 999 8888',
          whatsapp: '+20 100 999 8888'
        }
      ]
    };

    marketFreshnessService.executeMarketRefresh({
      snapshot: contactUpdatePayload
    });

    const contactEntry = db.contactHistory.find(
      c => c.supplierId === 'SUP-REFRESH-01' && c.newValue === '+20 100 999 8888'
    );

    assert(contactEntry, 'Must log contact update into ContactHistoryEntity');
    assert.strictEqual(contactEntry?.oldValue, '+20 100 555 1234');
    assert.strictEqual(contactEntry?.field, 'phone');
  });

  // -----------------------------------------------------------------------------
  // 5. REVIEW QUEUE & OPERATIONS OVERVIEW
  // -----------------------------------------------------------------------------
  console.log('\n[Section 5: Review Queue & Operations Overview]');

  await test('Queues price anomalies and source price conflicts in MarketReviewQueue', () => {
    const anomalyPayload: SourceSnapshotPayload = {
      sourceReference: 'Unverified Social Poster',
      sourceType: 'INSTAGRAM',
      ingestionMode: 'IMPORTED_SNAPSHOT',
      capturedAt: '2026-03-07T12:00:00Z',
      priceObservations: [
        {
          supplierId: 'SUP-REFRESH-01',
          activityId: 'ACT-WINDSURF-01',
          priceEGP: 8500,
          pricingBasis: 'PER_PERSON',
          observedAt: '2026-03-07T12:00:00Z',
          sourceReference: 'Unverified Social Poster'
        }
      ]
    };

    marketFreshnessService.executeMarketRefresh({ snapshot: anomalyPayload });

    const pendingAnomalies = marketFreshnessService.getReviewQueue({
      issueType: 'PRICE_ANOMALY',
      status: 'PENDING_REVIEW'
    });

    assert(pendingAnomalies.length > 0, 'Must enqueue detected price anomaly');
    const item = pendingAnomalies[0];
    assert.strictEqual(item.supplierId, 'SUP-REFRESH-01');
    assert.strictEqual(item.severity, 'HIGH');

    const resolved = marketFreshnessService.resolveReviewQueueItem({
      id: item.id,
      action: 'APPROVED',
      notes: 'Price spike verified as private VIP charter package.',
      reviewer: 'ADMIN_SUPERVISOR'
    });

    assert.strictEqual(resolved.status, 'APPROVED');
    assert.strictEqual(resolved.reviewedBy, 'ADMIN_SUPERVISOR');
  });

  await test('Returns accurate Operations Market Overview data', () => {
    const overview = marketFreshnessService.getOperationsMarketOverview();

    assert(overview.totalSuppliers > 0);
    assert(overview.totalOffers > 0);
    assert(overview.totalPriceObservations > 0);
    assert(overview.freshnessScore >= 0 && overview.freshnessScore <= 100);
    assert(Array.isArray(overview.recentRuns));
    assert(Array.isArray(overview.recentEvents));
  });

  // -----------------------------------------------------------------------------
  // 6. DAYGI REASONING & BILINGUAL GROUNDING
  // -----------------------------------------------------------------------------
  console.log('\n[Section 6: DayGI Reasoning & Bilingual Grounding]');

  await test('DayGI answers Arabic price inquiry with grounded market intelligence', async () => {
    const result = await daygiReasoningService.query({
      userId: 'USR-CERT-01',
      prompt: 'هل الأسعار زادت في دهب مؤخراً؟',
      language: 'ar'
    });

    assert(result.parsedIntent !== undefined, 'response carries parsedIntent');
    assert.strictEqual(result.parsedIntent!.intent, 'MARKET_PRICE_INQUIRY');
    assert(result.replyTextAr.includes('رصد السوق'), 'Must mention observed market data');
    assert(result.replyTextAr.includes('مورد'), 'Must mention suppliers count');
    assert(result.sourceConfidence !== undefined, 'response carries sourceConfidence');
    assert(result.sourceConfidence!.confidenceScore >= 0.95);
  });

  await test('DayGI answers supplier change inquiry with tracked radar events', async () => {
    const result = await daygiReasoningService.query({
      userId: 'USR-CERT-01',
      prompt: 'مين الشركات أو الموردين اللي غيروا أسعارهم أو بياناتهم؟',
      language: 'ar'
    });

    assert(result.parsedIntent !== undefined, 'response carries parsedIntent');
    assert.strictEqual(result.parsedIntent!.intent, 'SUPPLIER_CHANGES_INQUIRY');
    assert(result.replyTextAr.includes('رادار التغييرات'), 'Must mention change radar');
    assert(result.actionData?.recentEvents !== undefined);
  });

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions} CERTIFICATION TESTS PASSED WITH ZERO ERRORS!`);
  console.log('================================================================================');
}

runCertification().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
