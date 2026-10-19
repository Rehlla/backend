import assert from 'assert';
import { db } from '../db/database';
import { marketFreshnessService } from '../services/marketFreshnessService';
import { commerceIntelligenceService } from '../services/commerceIntelligenceService';
import { FreshnessStatus, PriceObservationEntity, SupplierOfferEntity, SupplierEntity } from '../db/schema';

console.log('================================================================================');
console.log('⚡ DAHAB LIVE MARKET INTELLIGENCE & DATA FRESHNESS CERTIFICATION');
console.log('================================================================================');

let passedAssertions = 0;
function test(desc: string, fn: () => void) {
  try {
    fn();
    passedAssertions++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Freshness Status & Score Decay Calculations
test('Calculates FRESH status (<7 days) and maximum score 100', () => {
  const now = new Date('2026-03-01T12:00:00Z');
  const observedAt = '2026-02-27T12:00:00Z'; // 2 days old
  const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

  assert.strictEqual(status, FreshnessStatus.FRESH);
  assert.strictEqual(score, 100);
  assert.strictEqual(ageInDays, 2);
});

test('Calculates RECENT status (7-30 days) and scales score 95-80', () => {
  const now = new Date('2026-03-01T12:00:00Z');
  const observedAt = '2026-02-15T12:00:00Z'; // 14 days old
  const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

  assert.strictEqual(status, FreshnessStatus.RECENT);
  assert(score >= 80 && score <= 95, `Expected score between 80-95, got ${score}`);
  assert.strictEqual(ageInDays, 14);
});

test('Calculates AGING status (30-90 days) and scales score 79-50', () => {
  const now = new Date('2026-03-01T12:00:00Z');
  const observedAt = '2026-01-10T12:00:00Z'; // 50 days old
  const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

  assert.strictEqual(status, FreshnessStatus.AGING);
  assert(score >= 50 && score <= 79, `Expected score between 50-79, got ${score}`);
  assert.strictEqual(ageInDays, 50);
});

test('Calculates STALE status (90-180 days) and scales score 49-20', () => {
  const now = new Date('2026-03-01T12:00:00Z');
  const observedAt = '2025-11-01T12:00:00Z'; // 120 days old
  const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

  assert.strictEqual(status, FreshnessStatus.STALE);
  assert(score >= 20 && score <= 49, `Expected score between 20-49, got ${score}`);
  assert.strictEqual(ageInDays, 120);
});

test('Calculates EXPIRED status (>180 days) and assigns score 0', () => {
  const now = new Date('2026-03-01T12:00:00Z');
  const observedAt = '2025-06-01T12:00:00Z'; // 273 days old
  const { status, score, ageInDays } = marketFreshnessService.calculateFreshness(observedAt, now);

  assert.strictEqual(status, FreshnessStatus.EXPIRED);
  assert.strictEqual(score, 0);
  assert(ageInDays > 180);
});

// 2. Change Detection & Evaluation Rules
test('Detects price increase event and computes accurate percentage difference', () => {
  const previous: PriceObservationEntity = {
    id: 'OBS-TEST-01',
    supplierId: 'SUP-TEST-01',
    activityId: 'ACT-BLUE-HOLE',
    priceEGP: 2000,
    pricingBasis: 'PER_PERSON',
    sourceType: 'COMMERCIAL_FLYER',
    sourceReference: 'Flyer 2026',
    observedAt: '2026-01-01T00:00:00Z',
    freshnessStatus: FreshnessStatus.AGING,
    freshnessScore: 60,
    validFrom: '2026-01-01T00:00:00Z'
  };

  const incoming: PriceObservationEntity = {
    id: 'OBS-TEST-02',
    supplierId: 'SUP-TEST-01',
    activityId: 'ACT-BLUE-HOLE',
    priceEGP: 2500,
    pricingBasis: 'PER_PERSON',
    sourceType: 'INSTAGRAM_POST',
    sourceReference: 'IG Post March',
    observedAt: '2026-03-01T00:00:00Z',
    freshnessStatus: FreshnessStatus.FRESH,
    freshnessScore: 100,
    validFrom: '2026-03-01T00:00:00Z'
  };

  const event = marketFreshnessService.evaluatePriceChange(previous, incoming);
  assert(event, 'Must generate market change event');
  assert.strictEqual(event?.eventType, 'PRICE_INCREASE');
  assert.strictEqual(event?.previousValue, 2000);
  assert.strictEqual(event?.newValue, 2500);
  assert.strictEqual(event?.percentageChange, 25);
  assert.strictEqual(event?.supplierId, 'SUP-TEST-01');
});

test('Detects price decrease event with negative percentage change', () => {
  const previous: PriceObservationEntity = {
    id: 'OBS-TEST-03',
    supplierId: 'SUP-TEST-02',
    activityId: 'ACT-CANYON',
    priceEGP: 3000,
    pricingBasis: 'PER_PERSON',
    sourceType: 'COMMERCIAL_FLYER',
    sourceReference: 'Flyer 2026',
    observedAt: '2026-01-01T00:00:00Z',
    freshnessStatus: FreshnessStatus.AGING,
    freshnessScore: 60,
    validFrom: '2026-01-01T00:00:00Z'
  };

  const incoming: PriceObservationEntity = {
    id: 'OBS-TEST-04',
    supplierId: 'SUP-TEST-02',
    activityId: 'ACT-CANYON',
    priceEGP: 2400,
    pricingBasis: 'PER_PERSON',
    sourceType: 'INSTAGRAM_POST',
    sourceReference: 'IG Post March',
    observedAt: '2026-03-01T00:00:00Z',
    freshnessStatus: FreshnessStatus.FRESH,
    freshnessScore: 100,
    validFrom: '2026-03-01T00:00:00Z'
  };

  const event = marketFreshnessService.evaluatePriceChange(previous, incoming);
  assert(event, 'Must generate market change event');
  assert.strictEqual(event?.eventType, 'PRICE_DECREASE');
  assert.strictEqual(event?.percentageChange, -20);
});

test('Detects pricing basis changes (e.g., PER_PERSON to PER_GROUP)', () => {
  const previous: PriceObservationEntity = {
    id: 'OBS-TEST-05',
    supplierId: 'SUP-TEST-03',
    activityId: 'ACT-SAFARI',
    priceEGP: 1500,
    pricingBasis: 'PER_PERSON',
    sourceType: 'COMMERCIAL_FLYER',
    sourceReference: 'Flyer 2026',
    observedAt: '2026-01-01T00:00:00Z',
    freshnessStatus: FreshnessStatus.AGING,
    freshnessScore: 60,
    validFrom: '2026-01-01T00:00:00Z'
  };

  const incoming: PriceObservationEntity = {
    id: 'OBS-TEST-06',
    supplierId: 'SUP-TEST-03',
    activityId: 'ACT-SAFARI',
    priceEGP: 5000,
    pricingBasis: 'PER_GROUP',
    sourceType: 'INSTAGRAM_POST',
    sourceReference: 'IG Post March',
    observedAt: '2026-03-01T00:00:00Z',
    freshnessStatus: FreshnessStatus.FRESH,
    freshnessScore: 100,
    validFrom: '2026-03-01T00:00:00Z'
  };

  const event = marketFreshnessService.evaluatePriceChange(previous, incoming);
  assert(event, 'Must generate market change event');
  assert.strictEqual(event?.eventType, 'PRICING_BASIS_CHANGED');
  assert.strictEqual(event?.previousValue, 'PER_PERSON');
  assert.strictEqual(event?.newValue, 'PER_GROUP');
});

// 3. Non-Destructive Temporal Price Tracking & Transactional Ingestion
test('Market refresh closes previous observation validity and creates new temporal observation without data loss', () => {
  const initialObsCount = db.priceObservations.length;
  const initialEventsCount = db.marketChangeEvents.length;

  const testSupplierId = 'SUP-TEMPORAL-TEST';
  const testActivityId = 'ACT-GNAI-CLIMB';

  // Seed initial observation
  const obs1: PriceObservationEntity = {
    id: `OBS-TEMP-01-${Date.now()}`,
    supplierId: testSupplierId,
    activityId: testActivityId,
    priceEGP: 1800,
    pricingBasis: 'PER_PERSON',
    sourceType: 'COMMERCIAL_FLYER',
    sourceReference: 'Temporal Test Baseline',
    observedAt: '2026-01-10T10:00:00Z',
    freshnessStatus: FreshnessStatus.AGING,
    freshnessScore: 65,
    validFrom: '2026-01-10T10:00:00Z'
  };

  db.priceObservations.push(obs1);

  // Ingest updated price observation via refresh
  const obs2: PriceObservationEntity = {
    id: `OBS-TEMP-02-${Date.now()}`,
    supplierId: testSupplierId,
    activityId: testActivityId,
    priceEGP: 2200,
    pricingBasis: 'PER_PERSON',
    sourceType: 'INSTAGRAM_POST',
    sourceReference: 'Temporal Test Update',
    observedAt: '2026-03-01T12:00:00Z',
    freshnessStatus: FreshnessStatus.FRESH,
    freshnessScore: 100,
    validFrom: '2026-03-01T12:00:00Z'
  };

  const result = marketFreshnessService.executeMarketRefresh({
    priceObservations: [obs2],
    sourceReference: 'Temporal Test Update Pipeline',
    triggerSource: 'AUTOMATED_INGESTION'
  });

  assert.strictEqual(result.status, 'SUCCESS');
  assert(result.changesRecorded > 0, 'Must record change events');

  // Verify historical observation is NOT deleted
  const history = db.priceObservations.filter(o => o.supplierId === testSupplierId && o.activityId === testActivityId);
  assert.strictEqual(history.length, 2, 'Both observations must exist in database');

  const oldRecord = history.find(o => o.id === obs1.id);
  const newRecord = history.find(o => o.id === obs2.id);

  assert(oldRecord, 'Old record must exist');
  assert(newRecord, 'New record must exist');
  assert.strictEqual(oldRecord?.validUntil, obs2.observedAt, 'Old record validUntil must match new record observedAt');
  assert.strictEqual(newRecord?.validUntil, undefined, 'New record validUntil must remain open');
});

// 4. Refresh Idempotency & Duplicate Protection
test('Executing duplicate refresh with identical timestamps is idempotent and produces zero redundant events', () => {
  const supplierId = 'SUP-IDEM-01';
  const obs: PriceObservationEntity = {
    id: `OBS-IDEM-${Date.now()}`,
    supplierId,
    activityId: 'ACT-IDEM-TEST',
    priceEGP: 1200,
    pricingBasis: 'PER_PERSON',
    sourceType: 'COMMERCIAL_FLYER',
    sourceReference: 'Idempotency Baseline',
    observedAt: '2026-03-01T08:00:00Z',
    freshnessStatus: FreshnessStatus.FRESH,
    freshnessScore: 100,
    validFrom: '2026-03-01T08:00:00Z'
  };

  const firstRun = marketFreshnessService.executeMarketRefresh({
    priceObservations: [obs],
    sourceReference: 'Idempotency Run 1'
  });

  const eventCountAfterFirst = db.marketChangeEvents.length;

  // Second run with duplicate payload
  const secondRun = marketFreshnessService.executeMarketRefresh({
    priceObservations: [obs],
    sourceReference: 'Idempotency Run 2'
  });

  const eventCountAfterSecond = db.marketChangeEvents.length;

  assert.strictEqual(eventCountAfterSecond, eventCountAfterFirst, 'Zero duplicate change events should be emitted on identical payload');
});

// 5. Source Freshness Audit & 4-Dimensional Metrics
test('Source freshness report audits supplier, offer, price, and regulatory dimensions', () => {
  const report = marketFreshnessService.getSourceFreshnessReport();
  assert(report.totalSourcesTracked > 0, 'Must track sources');
  assert(report.overallSystemFreshnessScore >= 0 && report.overallSystemFreshnessScore <= 100, 'Score must be 0-100');
  assert(report.breakdown.freshCount >= 0, 'Fresh count');
  assert(report.breakdown.recentCount >= 0, 'Recent count');
  assert(report.breakdown.agingCount >= 0, 'Aging count');
  assert(report.breakdown.staleCount >= 0, 'Stale count');
  assert(report.breakdown.expiredCount >= 0, 'Expired count');

  for (const src of report.sources) {
    assert(src.sourceReference, 'Source reference required');
    assert(src.status, 'Status required');
    assert(src.score >= 0 && src.score <= 100, 'Score 0-100');
    assert(src.dimensions.supplierFreshness >= 0, 'Supplier freshness dimension');
    assert(src.dimensions.offerFreshness >= 0, 'Offer freshness dimension');
    assert(src.dimensions.priceFreshness >= 0, 'Price freshness dimension');
    assert(src.dimensions.regulatoryFreshness >= 0, 'Regulatory freshness dimension');
  }
});

// 6. Commerce Offer Comparison Freshness Penalty Integration
test('Commerce comparison engine applies freshness penalties and excludes expired or severely stale offers from top recommendations', () => {
  const result = commerceIntelligenceService.compareOffers({});
  assert(result.scoredOffers.length > 0, 'Must score offers');

  for (const item of result.scoredOffers) {
    assert(item.freshnessStatus, 'Item must have freshness status');
    assert(item.scoreBreakdown.freshnessScore >= 0 && item.scoreBreakdown.freshnessScore <= 100, 'Freshness score valid');
    if (item.freshnessStatus === FreshnessStatus.EXPIRED) {
      assert(item.scoreBreakdown.freshnessScore === 0, 'Expired offers must receive 0 freshness score');
    }
  }

  // Top recommendation should be fresh/recent
  const top = result.scoredOffers[0];
  assert(top.freshnessStatus === FreshnessStatus.FRESH || top.freshnessStatus === FreshnessStatus.RECENT, 'Top recommendation should be fresh or recent');
});

// 7. Market Trends Computation
test('Market trends engine categorizes direction, percentage change, and timelines accurately', () => {
  const trends = marketFreshnessService.getMarketTrends({});
  assert(['RISING', 'FALLING', 'STABLE', 'INSUFFICIENT_DATA'].includes(trends.overallTrend), 'Valid trend enum');
  assert(typeof trends.averageRateOfChangePercentage === 'number', 'Rate of change is number');
  assert(trends.activityTrends.length > 0, 'Activity trends present');
  assert(trends.historicalTimeline.length > 0, 'Historical timeline present');

  for (const act of trends.activityTrends) {
    assert(act.activityId, 'Activity ID required');
    assert(act.medianPriceEGP >= 0, 'Valid median price');
    assert(act.minPriceEGP >= 0, 'Valid min price');
    assert(act.maxPriceEGP >= 0, 'Valid max price');
    assert(['RISING', 'FALLING', 'STABLE', 'INSUFFICIENT_DATA'].includes(act.trend), 'Valid activity trend');
  }
});

console.log('================================================================================');
console.log(`🎉 ALL ${passedAssertions} MARKET FRESHNESS CERTIFICATION ASSERTIONS PASSED!`);
console.log('================================================================================');
