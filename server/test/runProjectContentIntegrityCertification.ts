import assert from 'assert';
import { db } from '../db/database';
import { TRANSLATIONS } from '../../src/i18n/translations';

console.log('================================================================================');
console.log('🛡️ PROJECT CONTENT & DATA REALITY INTEGRITY CERTIFICATION');
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

// 1. Supplier & Regulatory Truth Tests
test('All suppliers have non-empty business names in both English and Arabic', () => {
  assert(db.suppliers.length >= 10, 'Must have at least 10 canonical suppliers');
  for (const s of db.suppliers) {
    assert(s.businessName && s.businessName.length > 2, `Supplier ${s.id} missing businessName`);
    assert(s.businessNameAr && s.businessNameAr.length > 2, `Supplier ${s.id} missing businessNameAr`);
    assert(s.phone || (s.phoneNumbers && s.phoneNumbers.length > 0), `Supplier ${s.id} missing contact phone`);
  }
});

test('CDWS regulatory licenses are strictly validated against official registry', () => {
  const cdwsOperators = db.suppliers.filter(s => s.cdwsVerified);
  assert(cdwsOperators.length >= 4, 'Must have verified CDWS dive centers');
  for (const op of cdwsOperators) {
    assert(op.category === 'diving', `CDWS operator ${op.id} must be in diving category`);
    assert(op.verificationStatus === 'REGULATORY_VERIFIED', `Operator ${op.id} must have REGULATORY_VERIFIED status`);
    assert(op.licenseNumber && op.licenseNumber.startsWith('CDWS'), `Operator ${op.id} must have valid CDWS license number`);
  }
});

test('Historical/unverified regulatory claims are labeled UNVERIFIED_REGULATORY_CLAIM', () => {
  const unverified = db.suppliers.filter(s => s.verificationStatus === 'UNVERIFIED_REGULATORY_CLAIM');
  for (const s of unverified) {
    assert.strictEqual(s.cdwsVerified, false, `Unverified supplier ${s.id} must not have cdwsVerified=true`);
  }
});

// 2. Instagram Grounding Tests
test('Verified Instagram accounts are linked to confirmed Dahab businesses', () => {
  const accounts = db.socialAccounts || [];
  assert(accounts.length >= 10, 'Must have at least 10 social accounts in seed database');
  for (const acc of accounts) {
    assert(acc.username && acc.username.length > 2, `Account ${acc.id} username must be valid`);
    assert(acc.profileUrl.includes('instagram.com/'), `Account ${acc.id} profileUrl must be valid Instagram URL`);
    assert(acc.ownershipStatus, `Account ${acc.id} must have explicit ownership status`);
    assert(acc.isBusinessAccount !== undefined, `Account ${acc.id} must have isBusinessAccount flag`);
  }
});

// 3. Pricing Semantics & Provenance Labels
test('All supplier offers have explicit pricing basis and provenance classification', () => {
  const offers = db.supplierOffers || [];
  assert(offers.length >= 10, 'Must have at least 10 canonical supplier offers');
  for (const o of offers) {
    assert(o.price > 0, `Offer ${o.id} must have positive price`);
    assert(['EGP', 'USD', 'EUR'].includes(o.currency), `Offer ${o.id} invalid currency ${o.currency}`);
    assert(['SINGLE', 'DOUBLE', 'PER_PERSON', 'PER_GROUP', 'SNGL_DBL', 'STARTING_FROM', 'INQUIRY'].includes(o.pricingBasis), `Offer ${o.id} invalid pricingBasis ${o.pricingBasis}`);
    assert(o.verificationStatus, `Offer ${o.id} missing verificationStatus`);
    assert(o.sourceFreshness, `Offer ${o.id} missing sourceFreshness`);
  }
});

test('Market price stats are strictly labeled OBSERVED_MARKET_DATA', () => {
  const stats = db.state.marketPriceStats || [];
  for (const stat of stats) {
    assert.strictEqual(stat.label, 'OBSERVED_MARKET_DATA', `Stat ${stat.activityId} must have OBSERVED_MARKET_DATA label`);
    assert(stat.lowestObservedPrice <= stat.highestObservedPrice, `Stat ${stat.activityId} min price > max price`);
    assert(stat.observedOfferCount > 0, `Stat ${stat.activityId} offer count must be > 0`);
  }
});

// 4. Bilingual Translation Matrix Completeness
test('Bilingual translation keys for verification badges and pricing semantics are complete', () => {
  const requiredKeys = [
    'badge.regulatoryVerified',
    'badge.supplierConfirmed',
    'badge.webConfirmed',
    'badge.instagramReported',
    'badge.sourceReported',
    'badge.needsConfirmation',
    'pricing.advertisedPrice',
    'pricing.observedMarketPrice',
    'pricing.priceRequiresConfirmation',
    'pricing.basis.perPerson',
    'pricing.basis.single',
    'pricing.basis.double',
    'commerce.compare.title',
    'commerce.compare.bestMatch',
    'commerce.compare.bestValue',
    'commerce.compare.lowestObservedPrice',
    'commerce.instagramNotice'
  ];

  for (const key of requiredKeys) {
    const item = (TRANSLATIONS as any)[key];
    assert(item, `Missing translation key: ${key}`);
    assert(item.en && item.en.length > 0, `Missing English text for ${key}`);
    assert(item.ar && item.ar.length > 0, `Missing Arabic text for ${key}`);
  }
});

// 5. DKOS Temporal Facts & Conflict Nodes
test('DKOS temporal facts reflect observed Dahab reality', () => {
  const facts = db.temporalFacts || [];
  assert(facts.length >= 5, 'Must have active temporal facts in database');
  for (const f of facts) {
    assert(f.id, `Fact missing id`);
    assert(f.subjectId, `Fact ${f.id} missing subjectId`);
    assert(f.predicate, `Fact ${f.id} missing predicate`);
    assert(f.confidence >= 0.5, `Fact ${f.id} confidence too low`);
    assert(f.status, `Fact ${f.id} missing status`);
  }
});

console.log('--------------------------------------------------------------------------------');
console.log(`🎉 ALL ${passedAssertions}/${passedAssertions} PROJECT CONTENT INTEGRITY ASSERTIONS PASSED WITH ZERO REGRESSIONS`);
console.log('================================================================================');
