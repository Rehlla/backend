import { rankingEngine, RankingCandidate } from './rankingEngine';
import { geointelligenceService } from './geointelligenceService';
import { dahabKnowledgeOs } from './dahabKnowledgeOs';
import { resolveBookability } from './bookabilityReconciler';
import { DiningVenueEntity, PlaceEntity, ActivityDetailEntity } from '../db/schema';
import { db } from '../db/database';
import { LruCache } from '../utils/lruCache';

export interface SearchQueryResult {
  parsedIntent: {
    originZone: string;
    availableMinutes: number;
    pace: 'Relaxed' | 'Balanced' | 'Active';
    interests: string[];
    wantsFoodAfter: boolean;
    foodPreference?: string;
    isFirstTime: boolean;
  };
  /**
   * False when nothing in the query connects to the catalog: no recognized
   * intent token AND no lexical match on any activity/venue/place name.
   * A gibberish query must surface zero results — returning the generic
   * top-3 for input we did not understand fabricates relevance.
   */
  matched: boolean;
  recommendations: Array<RankingCandidate & {
    nextFoodRecommendation?: {
      venue: DiningVenueEntity;
      distanceMeters: number;
      walkTimeMinutes: number;
      specialty: string;
      specialtyAr: string;
    };
    /** Resolved sellable product, or null when request-only/discover-only. */
    booking?: { bookable: boolean; priceEGP?: number; currency?: string } | null;
  }>;
  totalCandidatesEvaluated: number;
  provenance: {
    engine: string;
    executionTimeMs: number;
    timestamp: string;
    cacheHit?: boolean;
  };
}

/**
 * Flat wire item the SearchDrawer actually renders.
 *
 * The drawer historically read `results` while the route only sent
 * `recommendations`, so server matches never displayed. This shape is the
 * contract both sides now share: identity + display strings + the
 * explanation line + availability truth.
 */
export interface SearchResultItem {
  type: 'activity' | 'dining';
  id: string;
  name: string;
  nameAr: string;
  description: string;
  area: string;
  category: string;
  score: number;
  /** Why this result, in both languages — straight from the ranker. */
  whyEn: string;
  whyAr: string;
  /** True when a live SKU backs it (bookable now), false when request-only. */
  bookable: boolean;
  priceEGP?: number;
}

export class UnifiedSearchEngine {
  private searchCache = new LruCache<string, SearchQueryResult>(300, 30000); // 30s TTL

  /**
   * Parse natural language traveler queries into structured constraints
   */
  public parseTravelerQuery(query: string): {
    originZone: string;
    availableMinutes: number;
    pace: 'Relaxed' | 'Balanced' | 'Active';
    interests: string[];
    wantsFoodAfter: boolean;
    foodPreference?: string;
    isFirstTime: boolean;
  } {
    const q = (query || '').toLowerCase();

    // 1. Origin Area Resolution
    let originZone = 'lighthouse';
    if (q.includes('لايتهاوس') || q.includes('lighthouse') || q.includes('منارة')) originZone = 'lighthouse';
    else if (q.includes('مشرModified') || q.includes('مشروبة') || q.includes('mashraba')) originZone = 'mashraba';
    else if (q.includes('عسلة') || q.includes('assalah')) originZone = 'assalah';
    else if (q.includes('إيل جاردن') || q.includes('eel garden')) originZone = 'eel_garden';
    else if (q.includes('لاجونا') || q.includes('laguna')) originZone = 'laguna';
    else if (q.includes('بلو هول') || q.includes('blue hole')) originZone = 'blue_hole';
    else if (q.includes('كانيون') || q.includes('canyon')) originZone = 'canyon';
    else if (q.includes('وادي قني') || q.includes('wadi gnai')) originZone = 'wadi_gnai';

    // 2. Available Time Window Resolution
    let availableMinutes = 120; // Default 2 hours
    if (q.includes('ساعتين') || q.includes('2 hours') || q.includes('2h') || q.includes('two hours')) availableMinutes = 120;
    else if (q.includes('ساعة') || q.includes('1 hour') || q.includes('1h') || q.includes('one hour')) availableMinutes = 60;
    else if (q.includes('٣ ساعات') || q.includes('3 hours') || q.includes('3h') || q.includes('three hours')) availableMinutes = 180;
    else if (q.includes('نصف يوم') || q.includes('half day') || q.includes('4 hours')) availableMinutes = 240;

    // 3. Traveler Pace / Style Resolution
    let pace: 'Relaxed' | 'Balanced' | 'Active' = 'Balanced';
    if (q.includes('هادية') || q.includes('هادي') || q.includes('رايقة') || q.includes('مش متعبة') || q.includes('relax') || q.includes('quiet') || q.includes('chill')) {
      pace = 'Relaxed';
    } else if (q.includes('مغامرة') || q.includes('حماس') || q.includes('active') || q.includes('hard') || q.includes('adventure')) {
      pace = 'Active';
    }

    // 4. Food Preference Extraction
    let wantsFoodAfter = false;
    let foodPreference: string | undefined;
    if (q.includes('أكل') || q.includes('اكل') || q.includes('ناكل') || q.includes('طعام') || q.includes('وجبة') || q.includes('food') || q.includes('eat') || q.includes('lunch') || q.includes('dinner') || q.includes('مطعم') || q.includes('سمك') || q.includes('seafood') || q.includes('fish') || q.includes('مخبز') || q.includes('bakery')) {
      wantsFoodAfter = true;
      if (q.includes('سمك') || q.includes('seafood') || q.includes('fish') || q.includes('بحري')) {
        foodPreference = 'seafood';
      } else if (q.includes('مخبز') || q.includes('bakery') || q.includes('فطار')) {
        foodPreference = 'bakery';
      } else if (q.includes('بدوي') || q.includes('bedouin') || q.includes('طاجن')) {
        foodPreference = 'bedouin';
      }
    }

    // 5. First-time traveler flag
    const isFirstTime = q.includes('أول مرة') || q.includes('first time') || q.includes('new to dahab');

    // 6. Extracted Interests
    const interests: string[] = [];
    if (q.includes('غطس') || q.includes('diving') || q.includes('dive')) interests.push('diving');
    if (q.includes('سنوركل') || q.includes('snorkel')) interests.push('snorkeling');
    if (q.includes('سفاري') || q.includes('safari') || q.includes('جبل') || q.includes('desert')) interests.push('safari');
    if (q.includes('كايت') || q.includes('kite') || q.includes('wind')) interests.push('kitesurf');
    if (wantsFoodAfter) interests.push('food');

    return {
      originZone,
      availableMinutes,
      pace,
      interests,
      wantsFoodAfter,
      foodPreference,
      isFirstTime
    };
  }

  /**
   * Execute End-to-End Unified Search Query
   */
  public search(query: string, maxResults = 3): SearchQueryResult {
    const cacheKey = `${query.trim().toLowerCase()}:${maxResults}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        provenance: {
          ...cached.provenance,
          executionTimeMs: 1,
          cacheHit: true
        }
      };
    }

    const startTime = Date.now();
    const parsedIntent = this.parseTravelerQuery(query);

    // 0. Relevance gate (zero-result recovery, blueprint row #7): when the
    // query carries no recognized intent (area/time/pace/food/interest tokens)
    // AND no word matches any catalog name, report `matched: false` with no
    // recommendations. The drawer then shows its recovery state instead of a
    // fake top-3. A recognized-intent query ("diving", "عاريز أكل") always
    // passes: intent alone is a legitimate way to search.
    const hasIntentSignal =
      parsedIntent.interests.length > 0 ||
      parsedIntent.wantsFoodAfter ||
      parsedIntent.isFirstTime ||
      query.trim().toLowerCase() !== 'dahab' && this.originWasExplicit(parsedIntent.originZone, query);
    const lexicalMatched = this.lexicalMatch(query);

    const rankedCandidates = rankingEngine.rankActivities(db.activities, {
      originArea: parsedIntent.originZone,
      availableMinutes: parsedIntent.availableMinutes,
      pace: parsedIntent.pace,
      interests: parsedIntent.interests
    });

    if (!hasIntentSignal && !lexicalMatched) {
      const noMatch: SearchQueryResult = {
        parsedIntent,
        matched: false,
        recommendations: [],
        totalCandidatesEvaluated: db.activities.length,
        provenance: {
          engine: 'DAHAB_KNOWLEDGE_OPERATING_SYSTEM_SEARCH_V2',
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          cacheHit: false
        }
      };
      this.searchCache.set(cacheKey, noMatch);
      return noMatch;
    }

    const matched: SearchQueryResult['matched'] = true;

    // Take top N (default max 3)
    const topRanked = rankedCandidates.slice(0, maxResults);

    // 2. Attach Post-Activity Food Recommendations if requested
    const enrichedResults = topRanked.map(item => {
      let nextFoodRecommendation: any;

      if (parsedIntent.wantsFoodAfter) {
        const activityArea = item.activity.areaId;
        const matchingDining = db.diningVenues.filter(venue => {
          if (parsedIntent.foodPreference === 'seafood') {
            return venue.dietaryOptions.freshSeafoodCatch || venue.cuisine.includes('Seafood');
          }
          return true;
        });

        // Find closest venue to activity location
        let closestVenue = matchingDining.find(v => v.areaId.toLowerCase() === activityArea.toLowerCase()) || matchingDining[0];
        if (!closestVenue && db.diningVenues.length > 0) {
          closestVenue = db.diningVenues[0];
        }

        if (closestVenue) {
          nextFoodRecommendation = {
            venue: closestVenue,
            distanceMeters: 120,
            walkTimeMinutes: 2,
            specialty: closestVenue.cuisine.join(', '),
            specialtyAr: closestVenue.dietaryOptions.freshSeafoodCatch ? 'أسماك البحر الأحمر الطازجة سنجاري ومشوي على الفحم' : 'أطباق طازجة ومشروبات'
          };
        }
      }

      // 3. Availability truth: resolve the sellable product, if any. A null
      // booking means request-only/discover-only — the UI must say so rather
      // than showing a Book button with nothing behind it.
      const resolved = resolveBookability(item.activity.skuId);

      return {
        ...item,
        nextFoodRecommendation,
        booking: resolved
          ? { bookable: true, priceEGP: resolved.basePriceEGP, currency: resolved.currency }
          : null,
      };
    });

    const executionTimeMs = Date.now() - startTime;

    // Observability logging
    dahabKnowledgeOs.logSearchQuery({
      correlationId: `SRCH-${Date.now()}`,
      query,
      queryType: 'UNIFIED_NATURAL_LANGUAGE',
      domain: parsedIntent.interests[0] || 'Geography',
      latencyMs: executionTimeMs,
      candidateCount: db.activities.length,
      rankedCount: enrichedResults.length,
      cacheHit: false,
      sourceStatus: 'ALL_AUTHORITATIVE',
      resultConfidence: enrichedResults[0]?.overallScore || 0.9
    });

    const result: SearchQueryResult = {
      parsedIntent,
      matched,
      recommendations: enrichedResults,
      totalCandidatesEvaluated: db.activities.length,
      provenance: {
        engine: 'DAHAB_KNOWLEDGE_OPERATING_SYSTEM_SEARCH_V2',
        executionTimeMs,
        timestamp: new Date().toISOString(),
        cacheHit: false
      }
    };

    this.searchCache.set(cacheKey, result);
    return result;
  }

  /**
   * True when the query explicitly named an origin area (the parser defaults
   * to 'lighthouse' silently, so the parsed value alone cannot distinguish
   * "user said lighthouse" from "no area given").
   */
  private originWasExplicit(_originZone: string, query: string): boolean {
    const q = query.toLowerCase();
    return ['lighthouse', 'لايتهاوس', 'منارة', 'mashraba', 'مشروبة', 'assalah', 'عسلة', 'eel garden', 'إيل جاردن', 'laguna', 'لاجونا', 'blue hole', 'بلو هول', 'canyon', 'كانيون', 'wadi gnai', 'وادي قني']
      .some(token => q.includes(token));
  }

  /**
   * Lexical fallback: does any query word (≥3 chars) match an activity title,
   * dining venue name or place name (EN or AR)? Catches "blue hole", "رالف",
   * "bakery" — searches for a *specific thing* that intent parsing ignores.
   */
  private lexicalMatch(query: string): boolean {
    const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3);
    if (words.length === 0) return false;

    const haystacks: string[] = [];
    for (const a of db.activities) haystacks.push(a.titleEn?.toLowerCase() || '', a.titleAr || '');
    for (const v of db.diningVenues) haystacks.push(v.nameEn?.toLowerCase() || '', v.nameAr || '');
    for (const p of db.places) haystacks.push(p.nameEn?.toLowerCase() || '', p.nameAr || '');
    const haystack = haystacks.join('\n');

    return words.some(w => haystack.includes(w));
  }
}

export const unifiedSearchEngine = new UnifiedSearchEngine();

/**
 * Flatten recommendations (+ attached dining) into the wire items the
 * SearchDrawer renders. Pure and exported for unit tests: the drawer used
 * to read a `results` key the route never sent, so server matches silently
 * never displayed. Both sides now share SearchResultItem.
 */
export function toSearchResultItems(
  recommendations: SearchQueryResult['recommendations']
): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const seen = new Set<string>();
  const push = (item: SearchResultItem) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const rec of recommendations) {
    const act = rec.activity;
    push({
      type: 'activity',
      id: act.id,
      name: act.titleEn,
      nameAr: act.titleAr,
      description: rec.whyMatched?.primaryReasonEn || '',
      area: act.areaId,
      category: act.category,
      score: rec.overallScore,
      whyEn: rec.whyMatched?.primaryReasonEn || '',
      whyAr: rec.whyMatched?.primaryReasonAr || '',
      bookable: !!rec.booking?.bookable,
      priceEGP: rec.booking?.priceEGP,
    });

    const venue = rec.nextFoodRecommendation?.venue;
    if (venue) {
      push({
        type: 'dining',
        id: venue.id,
        name: venue.nameEn,
        nameAr: venue.nameAr,
        description: rec.nextFoodRecommendation!.specialty,
        area: venue.areaId,
        category: 'dining',
        score: Math.max(0, rec.overallScore - 5),
        whyEn: `Pairs with ${act.titleEn}: ${rec.nextFoodRecommendation!.specialty}`,
        whyAr: `يناسب ${act.titleAr}: ${rec.nextFoodRecommendation!.specialtyAr}`,
        bookable: false,
      });
    }
  }
  return items;
}
