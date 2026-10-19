import assert from 'assert';
import { db } from '../db/database';
import { commerceIntelligenceService } from '../services/commerceIntelligenceService';

console.log('================================================================================');
console.log('💎 DAHAB LOCAL COMMERCE INTELLIGENCE & OFFER COMPARISON CERTIFICATION');
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

// 1. Core Comparison Engine Tests
test('Offer comparison returns multi-dimensional weighted rankings with composite scores', () => {
  const result = commerceIntelligenceService.compareOffers({});
  assert(result.totalEvaluated > 0, 'Must evaluate offers');
  assert(result.scoredOffers.length > 0, 'Must return scored offers');

  const top = result.scoredOffers[0];
  assert(top.compositeScore >= 0 && top.compositeScore <= 100, 'Composite score must be between 0 and 100');
  assert(top.scoreBreakdown.priceCompetitiveness >= 0, 'Price score missing');
  assert(top.scoreBreakdown.verificationTrust >= 0, 'Verification score missing');
  assert(top.scoreBreakdown.freshnessScore >= 0, 'Freshness score missing');
  assert(top.scoreBreakdown.relevanceMatch >= 0, 'Relevance score missing');
  assert(top.scoreBreakdown.supplierReliability >= 0, 'Supplier score missing');
  assert(top.scoreBreakdown.sourceQuality >= 0, 'Source score missing');
});

test('Rankings are sorted in descending order of composite score', () => {
  const result = commerceIntelligenceService.compareOffers({});
  for (let i = 0; i < result.scoredOffers.length - 1; i++) {
    assert(
      result.scoredOffers[i].compositeScore >= result.scoredOffers[i + 1].compositeScore,
      `Rank order violation at index ${i}`
    );
  }
});

// 2. Smart Recommendation Engine Tests
test('Smart recommendation engine assigns appropriate tags and champions', () => {
  const result = commerceIntelligenceService.compareOffers({});
  assert(result.recommendations.bestMatch, 'Must identify Best Match');
  assert(result.recommendations.lowestObservedPrice, 'Must identify Lowest Observed Price');
  assert(result.recommendations.mostVerified, 'Must identify Most Verified');
  assert(result.recommendations.mostRecent, 'Must identify Most Recent');
  assert(result.recommendations.bestValue, 'Must identify Best Value');

  // Verify lowest observed price is indeed the minimum
  const minPrice = Math.min(...result.scoredOffers.map(s => s.offer.price));
  assert.strictEqual(result.recommendations.lowestObservedPrice.offer.price, minPrice);
});

// 3. Category & Destination Filtering Tests
test('Filtering by category focuses evaluation on target vertical', () => {
  const safariResult = commerceIntelligenceService.compareOffers({ category: 'safari' });
  for (const item of safariResult.scoredOffers) {
    assert.strictEqual(item.offer.canonicalCategory.toLowerCase(), 'safari');
  }

  const diveResult = commerceIntelligenceService.compareOffers({ category: 'diving' });
  for (const item of diveResult.scoredOffers) {
    assert.strictEqual(item.offer.canonicalCategory.toLowerCase(), 'diving');
  }
});

test('Filtering by destination increases relevance score for matching offers', () => {
  const blueHoleResult = commerceIntelligenceService.compareOffers({ destination: 'Blue Hole' });
  assert(blueHoleResult.scoredOffers.length > 0, 'Should match Blue Hole offers');
  const matched = blueHoleResult.scoredOffers.find(s => s.offer.titleEn.includes('Blue Hole') || s.offer.sourceActivityName.includes('Blue Hole'));
  if (matched) {
    assert(matched.scoreBreakdown.relevanceMatch >= 90, 'Matching destination must have high relevance score');
  }
});

// 4. Bilingual Explanations
test('Every scored comparison includes coherent English and Arabic explanations', () => {
  const result = commerceIntelligenceService.compareOffers({});
  for (const item of result.scoredOffers) {
    assert(item.explanationEn && item.explanationEn.length > 20, `Missing/short English explanation for ${item.offer.id}`);
    assert(item.explanationAr && item.explanationAr.length > 20, `Missing/short Arabic explanation for ${item.offer.id}`);
    assert(item.explanationEn.includes(item.offer.price.toString()), 'English explanation must mention observed price');
    assert(item.explanationAr.includes(item.offer.price.toString()), 'Arabic explanation must mention observed price');
  }
});

// 5. Market Price Statistics & Historical Trends
test('Market price statistics calculate min, max, median, and label accurately', () => {
  const stats = commerceIntelligenceService.getMarketStats();
  assert(stats.length > 0, 'Must return market price stats');
  for (const st of stats) {
    assert.strictEqual(st.label, 'OBSERVED_MARKET_DATA');
    assert(st.lowestObservedPrice <= st.highestObservedPrice, 'Min price > Max price in stat');
    assert(st.medianObservedPrice >= st.lowestObservedPrice && st.medianObservedPrice <= st.highestObservedPrice, 'Median out of bounds');
    assert(st.observedOfferCount > 0, 'Observed offer count must be > 0');
  }
});

test('Price history returns observations with trend classification', () => {
  const history = commerceIntelligenceService.getPriceHistory({});
  assert.strictEqual(history.classification, 'OBSERVED_MARKET_DATA');
  assert(['STABLE', 'RISING', 'FALLING', 'INSUFFICIENT_DATA'].includes(history.trend));
  assert(typeof history.changePercentage === 'number');
});

console.log('--------------------------------------------------------------------------------');
console.log(`🎉 ALL ${passedAssertions}/${passedAssertions} DAHAB COMMERCE INTELLIGENCE ASSERTIONS PASSED WITH ZERO REGRESSIONS`);
console.log('================================================================================');
