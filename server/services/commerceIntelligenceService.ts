import { db } from '../db/database';
import {
  SupplierEntity,
  SupplierOfferEntity,
  PriceObservationEntity,
  MarketPriceStatEntity,
  VerificationLevel,
  PricingBasis,
  FreshnessStatus
} from '../db/schema';
import { marketFreshnessService } from './marketFreshnessService';

export interface ComparisonCriteria {
  activityId?: string;
  category?: string;
  serviceType?: string;
  destination?: string;
  maxBudgetEGP?: number;
  minVerificationLevel?: VerificationLevel;
  pricingBasis?: PricingBasis;
  passengersCount?: number;
}

export interface ScoredOfferComparison {
  offer: SupplierOfferEntity;
  supplier: SupplierEntity | null;
  latestObservation: PriceObservationEntity | null;
  compositeScore: number;
  freshnessStatus?: FreshnessStatus;
  scoreBreakdown: {
    priceCompetitiveness: number; // 0-100 (25% weight)
    verificationTrust: number;    // 0-100 (25% weight)
    freshnessScore: number;       // 0-100 (15% weight)
    relevanceMatch: number;       // 0-100 (15% weight)
    supplierReliability: number;  // 0-100 (10% weight)
    sourceQuality: number;        // 0-100 (10% weight)
  };
  recommendationTags: Array<
    'BEST_MATCH' | 'BEST_VALUE' | 'LOWEST_OBSERVED_PRICE' | 'MOST_VERIFIED' | 'MOST_RECENT' | 'BEST_SCHEDULE_MATCH'
  >;
  explanationEn: string;
  explanationAr: string;
}

export interface ComparisonResult {
  criteria: ComparisonCriteria;
  totalEvaluated: number;
  scoredOffers: ScoredOfferComparison[];
  recommendations: {
    bestMatch?: ScoredOfferComparison;
    bestValue?: ScoredOfferComparison;
    lowestObservedPrice?: ScoredOfferComparison;
    mostVerified?: ScoredOfferComparison;
    mostRecent?: ScoredOfferComparison;
  };
  marketSummary: {
    category: string;
    totalOffers: number;
    lowestObservedPrice: number;
    highestObservedPrice: number;
    medianObservedPrice: number;
    averageObservedPrice: number;
    verifiedOffersRatio: number;
    provenanceClassification: 'OBSERVED_MARKET_DATA';
    lastUpdated: string;
  };
}

export class CommerceIntelligenceService {
  /**
   * Calculate Verification Trust Weight (0 - 100)
   */
  private getVerificationScore(level: VerificationLevel, cdwsVerified: boolean): number {
    if (level === 'REGULATORY_VERIFIED' || cdwsVerified) return 100;
    if (level === 'SUPPLIER_CONFIRMED') return 88;
    if (level === 'WEB_CONFIRMED') return 78;
    if (level === 'INSTAGRAM_REPORTED') return 68;
    if (level === 'SOURCE_REPORTED') return 60;
    if (level === 'UNVERIFIED_REGULATORY_CLAIM') return 35;
    return 40;
  }

  /**
   * Calculate Freshness Weight (0 - 100) and canonical status
   */
  private getFreshnessScore(freshness?: FreshnessStatus | string, dateStr?: string): { score: number; status: FreshnessStatus } {
    const computed = marketFreshnessService.calculateFreshness(dateStr);
    let resolvedStatus: FreshnessStatus = (freshness as FreshnessStatus) || computed.status;

    if (freshness === 'CURRENT' || freshness === 'CURRENT_LIKELY' || freshness === 'FRESH' || freshness === FreshnessStatus.CURRENT || freshness === FreshnessStatus.CURRENT_LIKELY || freshness === FreshnessStatus.FRESH) {
      resolvedStatus = FreshnessStatus.FRESH;
    } else if (freshness === 'STALE' || freshness === 'OLD' || freshness === FreshnessStatus.STALE || freshness === FreshnessStatus.OLD) {
      resolvedStatus = FreshnessStatus.STALE;
    } else if (freshness === 'EXPIRED' || freshness === FreshnessStatus.EXPIRED) {
      resolvedStatus = FreshnessStatus.EXPIRED;
    } else if (freshness === 'RECENT' || freshness === FreshnessStatus.RECENT) {
      resolvedStatus = FreshnessStatus.RECENT;
    } else if (freshness === 'AGING' || freshness === FreshnessStatus.AGING) {
      resolvedStatus = FreshnessStatus.AGING;
    } else {
      resolvedStatus = computed.status;
    }

    const score = marketFreshnessService.getFreshnessScore(resolvedStatus);
    return { score, status: resolvedStatus };
  }

  /**
   * Multi-dimensional Offer Comparison and Ranking
   */
  public compareOffers(criteria: ComparisonCriteria): ComparisonResult {
    const rawOffers = (db.supplierOffers || []).filter(o => o.active !== false);
    const observations = db.priceObservations || [];
    const suppliers = db.suppliers || [];

    // Filter offers matching category/service/activity
    const filteredOffers = rawOffers.filter(offer => {
      if (criteria.activityId && offer.activityId.toLowerCase() !== criteria.activityId.toLowerCase()) return false;
      if (criteria.category && offer.canonicalCategory.toLowerCase() !== criteria.category.toLowerCase()) return false;
      if (criteria.serviceType && offer.canonicalCategory.toLowerCase() !== criteria.serviceType.toLowerCase()) return false;
      if (criteria.destination) {
        const dest = criteria.destination.toLowerCase();
        const title = (offer.titleEn || '').toLowerCase();
        const src = (offer.sourceActivityName || '').toLowerCase();
        if (!title.includes(dest) && !src.includes(dest)) return false;
      }
      return true;
    });

    const targetOffers = filteredOffers.length > 0 ? filteredOffers : rawOffers;

    // Calculate Price Distribution for normalization
    const priceList = targetOffers.map(o => o.price).filter(p => p > 0);
    const minPrice = priceList.length > 0 ? Math.min(...priceList) : 100;
    const maxPrice = priceList.length > 0 ? Math.max(...priceList) : 2000;
    const priceSpan = maxPrice - minPrice || 1;

    const scored: ScoredOfferComparison[] = targetOffers.map(offer => {
      const supplier = suppliers.find(s => s.id === offer.supplierId) || null;
      const offerObservations = observations
        .filter(obs => obs.offerId === offer.id || (obs.supplierId === offer.supplierId && obs.activityId === offer.activityId))
        .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

      const latestObservation = offerObservations[0] || null;
      const previousObservation = offerObservations[1] || null;

      // 1. Price Competitiveness (lower relative price gets higher score)
      const priceRatio = (offer.price - minPrice) / priceSpan;
      const priceCompetitiveness = Math.round(Math.max(10, 100 - priceRatio * 70));

      // 2. Verification Trust Score
      const verificationTrust = this.getVerificationScore(offer.verificationStatus, !!supplier?.cdwsVerified);

      // 3. Freshness Score
      const { score: freshnessScore, status: resolvedFreshness } = this.getFreshnessScore(offer.sourceFreshness, offer.updatedAt || offer.createdAt);

      // 4. Relevance Match
      let relevanceMatch = 80;
      if (criteria.destination && (offer.titleEn.toLowerCase().includes(criteria.destination.toLowerCase()) || offer.sourceActivityName.toLowerCase().includes(criteria.destination.toLowerCase()))) {
        relevanceMatch += 20;
      }
      relevanceMatch = Math.min(100, relevanceMatch);

      // 5. Supplier Reliability
      const supplierReliability = Math.round((supplier?.rating || 4.5) * 20);

      // 6. Source Quality
      let sourceQuality = 75;
      if (offer.sourceType === 'OFFICIAL_REGULATORY') sourceQuality = 100;
      else if (offer.sourceType === 'SUPPLIER_OFFICIAL') sourceQuality = 90;
      else if (offer.sourceType === 'INSTAGRAM') sourceQuality = 75;
      else if (offer.sourceType === 'USER_PROVIDED_IMAGE') sourceQuality = 70;

      // Composite Weighted Score with penalty for stale/expired offers
      let compositeScore = Math.round(
        priceCompetitiveness * 0.25 +
        verificationTrust * 0.25 +
        freshnessScore * 0.15 +
        relevanceMatch * 0.15 +
        supplierReliability * 0.10 +
        sourceQuality * 0.10
      );

      // Apply freshness gate: stale/expired prices cannot rank top
      if (resolvedFreshness === FreshnessStatus.EXPIRED || freshnessScore === 0) {
        compositeScore = Math.min(compositeScore, 20);
      } else if (resolvedFreshness === FreshnessStatus.STALE || freshnessScore <= 30) {
        compositeScore = Math.max(10, compositeScore - 35);
      }

      const scoreBreakdown = {
        priceCompetitiveness,
        verificationTrust,
        freshnessScore,
        relevanceMatch,
        supplierReliability,
        sourceQuality
      };

      // Tags calculation
      const recommendationTags: ScoredOfferComparison['recommendationTags'] = [];
      if (offer.price === minPrice && freshnessScore >= 50) recommendationTags.push('LOWEST_OBSERVED_PRICE');
      if (verificationTrust >= 95) recommendationTags.push('MOST_VERIFIED');
      if (freshnessScore >= 95) recommendationTags.push('MOST_RECENT');
      if (compositeScore >= 85 && freshnessScore >= 60) recommendationTags.push('BEST_MATCH');
      if (priceCompetitiveness >= 80 && verificationTrust >= 75 && freshnessScore >= 50) recommendationTags.push('BEST_VALUE');

      // Temporal change explanation awareness
      let temporalChangeEn = '';
      let temporalChangeAr = '';
      // PriceObservationEntity.amount is optional; without this guard an
      // unpriced previous observation produced `offer.price - undefined` = NaN
      // and rendered "increased from undefined to N EGP" in traveler-facing copy.
      if (
        previousObservation &&
        previousObservation.amount !== undefined &&
        previousObservation.amount !== offer.price
      ) {
        const delta = offer.price - previousObservation.amount;
        if (delta > 0) {
          temporalChangeEn = ` (The observed price recently increased from ${previousObservation.amount} to ${offer.price} EGP).`;
          temporalChangeAr = ` (السعر المرصود زاد مؤخرًا من ${previousObservation.amount} إلى ${offer.price} جنيه).`;
        } else {
          temporalChangeEn = ` (The observed price recently decreased from ${previousObservation.amount} to ${offer.price} EGP).`;
          temporalChangeAr = ` (السعر المرصود انخفض مؤخرًا من ${previousObservation.amount} إلى ${offer.price} جنيه).`;
        }
      }

      // Natural language explanation
      const supplierName = supplier?.businessName || offer.supplierId;
      const supplierNameAr = supplier?.businessNameAr || supplierName;
      const explanationEn = `${supplierName} provides "${offer.titleEn}" at an observed price of ${offer.price} ${offer.currency} (${offer.pricingBasis}). Verification: ${offer.verificationStatus}. Freshness: ${offer.sourceFreshness}.${temporalChangeEn}`;
      const explanationAr = `يقدم ${supplierNameAr} عرض "${offer.titleAr || offer.titleEn}" بسعر مرصود ${offer.price} ${offer.currency} (${offer.pricingBasis}). التوثيق: ${offer.verificationStatus}. حالة البيانات: ${offer.sourceFreshness}.${temporalChangeAr}`;

      return {
        offer,
        supplier,
        latestObservation,
        compositeScore,
        freshnessStatus: resolvedFreshness,
        scoreBreakdown,
        recommendationTags,
        explanationEn,
        explanationAr
      };
    });

    // Sort by composite score descending
    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    // Identify category champions (preferring fresh/active offers)
    const freshScored = scored.filter(s => s.scoreBreakdown.freshnessScore >= 50);
    const candidatePool = freshScored.length > 0 ? freshScored : scored;

    const bestMatch = candidatePool[0] || scored[0];
    const lowestObservedPrice = [...candidatePool].sort((a, b) => a.offer.price - b.offer.price)[0] || scored[0];
    const mostVerified = [...candidatePool].sort((a, b) => b.scoreBreakdown.verificationTrust - a.scoreBreakdown.verificationTrust)[0] || scored[0];
    const mostRecent = [...scored].sort((a, b) => b.scoreBreakdown.freshnessScore - a.scoreBreakdown.freshnessScore)[0];
    const bestValue = [...candidatePool].sort((a, b) => {
      const valA = (a.scoreBreakdown.priceCompetitiveness + a.scoreBreakdown.verificationTrust) / 2;
      const valB = (b.scoreBreakdown.priceCompetitiveness + b.scoreBreakdown.verificationTrust) / 2;
      return valB - valA;
    })[0] || scored[0];

    // Compute Market Statistics
    const sortedPrices = [...priceList].sort((a, b) => a - b);
    const medianObservedPrice = sortedPrices.length > 0
      ? sortedPrices[Math.floor(sortedPrices.length / 2)]
      : 0;
    const averageObservedPrice = sortedPrices.length > 0
      ? Math.round(sortedPrices.reduce((acc, p) => acc + p, 0) / sortedPrices.length)
      : 0;
    const verifiedCount = scored.filter(s => s.scoreBreakdown.verificationTrust >= 75).length;
    const verifiedOffersRatio = scored.length > 0 ? Number((verifiedCount / scored.length).toFixed(2)) : 0;

    return {
      criteria,
      totalEvaluated: targetOffers.length,
      scoredOffers: scored,
      recommendations: {
        bestMatch,
        bestValue,
        lowestObservedPrice,
        mostVerified,
        mostRecent
      },
      marketSummary: {
        category: criteria.category || criteria.serviceType || 'All Dahab Commerce',
        totalOffers: targetOffers.length,
        lowestObservedPrice: minPrice,
        highestObservedPrice: maxPrice,
        medianObservedPrice,
        averageObservedPrice,
        verifiedOffersRatio,
        provenanceClassification: 'OBSERVED_MARKET_DATA',
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Get Market Price History & Trends
   */
  public getPriceHistory(params: { supplierId?: string; offerId?: string }): {
    observations: PriceObservationEntity[];
    trend: 'STABLE' | 'RISING' | 'FALLING' | 'INSUFFICIENT_DATA';
    changePercentage: number;
    classification: 'OBSERVED_MARKET_DATA';
  } {
    let obs = db.priceObservations || [];
    if (params.offerId) {
      obs = obs.filter(o => o.offerId === params.offerId);
    }
    if (params.supplierId) {
      obs = obs.filter(o => o.supplierId === params.supplierId);
    }

    obs.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

    if (obs.length < 2) {
      return {
        observations: obs,
        trend: 'INSUFFICIENT_DATA',
        changePercentage: 0,
        classification: 'OBSERVED_MARKET_DATA'
      };
    }

    // Compare the first and last observations that actually carry an amount;
    // `amount` is optional, so obs[0].amount could be undefined and turn the
    // whole trend calculation into NaN.
    const pricedAmounts = obs
      .map(o => o.amount)
      .filter((a): a is number => typeof a === 'number' && Number.isFinite(a));
    const firstPrice = pricedAmounts[0];
    const lastPrice = pricedAmounts[pricedAmounts.length - 1];
    const changePercentage =
      firstPrice !== undefined && lastPrice !== undefined && firstPrice > 0
        ? Math.round(((lastPrice - firstPrice) / firstPrice) * 100)
        : 0;

    let trend: 'STABLE' | 'RISING' | 'FALLING' = 'STABLE';
    if (changePercentage > 5) trend = 'RISING';
    else if (changePercentage < -5) trend = 'FALLING';

    return {
      observations: obs,
      trend,
      changePercentage,
      classification: 'OBSERVED_MARKET_DATA'
    };
  }

  /**
   * Get Comprehensive Market Price Statistics
   */
  public getMarketStats(): MarketPriceStatEntity[] {
    if (db.state.marketPriceStats && db.state.marketPriceStats.length > 0) {
      return db.state.marketPriceStats;
    }

    const offers = db.supplierOffers || [];
    const activities = db.activities || [];

    const statsMap: Record<string, MarketPriceStatEntity> = {};

    offers.forEach(o => {
      const act = activities.find(a => a.id === o.activityId);
      const key = o.activityId;
      if (!statsMap[key]) {
        statsMap[key] = {
          activityId: key,
          activityNameEn: o.sourceActivityName || act?.titleEn || key,
          activityNameAr: o.titleAr || act?.titleAr || key,
          currency: 'EGP',
          lowestObservedPrice: o.price,
          highestObservedPrice: o.price,
          medianObservedPrice: o.price,
          observedOfferCount: 0,
          priceRange: `${o.price} EGP`,
          offers: [],
          label: 'OBSERVED_MARKET_DATA',
          lastCalculatedAt: new Date().toISOString()
        };
      }

      const st = statsMap[key];
      const sup = (db.suppliers || []).find(s => s.id === o.supplierId);
      st.offers.push({
        offerId: o.id,
        supplierId: o.supplierId,
        supplierName: sup?.businessName || o.supplierId,
        price: o.price,
        pricingBasis: o.pricingBasis,
        verificationStatus: o.verificationStatus,
        freshnessStatus: o.sourceFreshness
      });
      st.lowestObservedPrice = Math.min(st.lowestObservedPrice, o.price);
      st.highestObservedPrice = Math.max(st.highestObservedPrice, o.price);
      st.observedOfferCount = st.offers.length;
      st.priceRange = `${st.lowestObservedPrice} - ${st.highestObservedPrice} EGP`;
    });

    return Object.values(statsMap);
  }
}

export const commerceIntelligenceService = new CommerceIntelligenceService();
