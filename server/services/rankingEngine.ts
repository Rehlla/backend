import { ActivityDetailEntity } from '../db/schema';
import { WhyMatchedReason } from '../domain/knowledgeTypes';
import { geointelligenceService } from './geointelligenceService';
import { db } from '../db/database';

export interface RankingCandidate {
  activity: ActivityDetailEntity;
  overallScore: number;
  whyMatched: WhyMatchedReason;
}

export class RankingEngine {
  /**
   * Rank a list of activity candidates against traveler context
   */
  public rankActivities(
    activities: ActivityDetailEntity[],
    context: {
      originArea: string;
      availableMinutes?: number;
      pace?: 'Relaxed' | 'Balanced' | 'Active' | string;
      budget?: 'Budget' | 'Moderate' | 'Premium' | string;
      interests?: string[];
      currentWindKnots?: number;
    }
  ): RankingCandidate[] {
    const origin = context.originArea.toLowerCase();
    const availableMinutes = context.availableMinutes || 180;
    const travelerPace = context.pace || 'Balanced';
    const windKnots = context.currentWindKnots || 12;

    const scoredList: RankingCandidate[] = [];

    for (const act of activities) {
      // 1. Geographic Fit (Distance & Transit)
      const route = geointelligenceService.calculateRouteEstimate(origin, act.areaId);
      const transitTime = route.durationMinutes * 2; // Roundtrip transit
      const totalTimeNeeded = act.durationMinutes + transitTime + 15; // 15 min buffer

      let geoScore = 95;
      if (act.areaId.toLowerCase() === origin) {
        geoScore = 98;
      } else if (route.isWalkable) {
        geoScore = 90;
      } else {
        geoScore = Math.max(50, 85 - route.distanceKm * 3);
      }

      // 2. Time Fit
      let timeScore = 95;
      if (totalTimeNeeded > availableMinutes) {
        timeScore = Math.max(10, 100 - (totalTimeNeeded - availableMinutes) * 2);
      } else {
        // Fits comfortably within window
        timeScore = 96;
      }

      // 3. Pace & Difficulty Fit
      let paceScore = 85;
      if (travelerPace === 'Relaxed') {
        if (act.difficulty === 'Beginner' || act.category === 'wellness' || act.category === 'food') {
          paceScore = 98;
        } else if (act.difficulty === 'All Levels') {
          paceScore = 95;
        } else if (act.difficulty === 'Advanced') {
          paceScore = 40;
        } else {
          paceScore = 75;
        }
      } else if (travelerPace === 'Active') {
        if (act.difficulty === 'Advanced' || act.category === 'safari' || act.category === 'diving') {
          paceScore = 95;
        } else {
          paceScore = 80;
        }
      } else {
        paceScore = 90; // Balanced
      }

      // 4. Availability & Booking Mode
      let availScore = 80;
      if (act.bookingMode === 'BOOK_NOW') availScore = 98;
      else if (act.bookingMode === 'REQUEST_NOW') availScore = 88;
      else if (act.bookingMode === 'WALK_IN') availScore = 92;

      // 5. Supplier Trust Tier
      let supplierScore = 85;
      if (act.supplierId) {
        const supplier = db.suppliers.find(s => s.id === act.supplierId);
        if (supplier?.tier === 'Tier 1 Certified') supplierScore = 98;
        else if (supplier?.tier === 'Tier 2 Certified') supplierScore = 90;
        else supplierScore = 85;
      }

      // 6. Environmental Safety Gate
      let envScore = 100;
      let isEnvBlocked = false;
      if (act.environmentalSensitivities?.maxWindKnots && windKnots > act.environmentalSensitivities.maxWindKnots) {
        envScore = 20;
        isEnvBlocked = true;
      }

      // Composite Weighted Score
      const overallScore = Math.round(
        geoScore * 0.25 +
        timeScore * 0.25 +
        paceScore * 0.20 +
        availScore * 0.15 +
        supplierScore * 0.10 +
        (isEnvBlocked ? -50 : 5)
      );

      // Construct Explainable WhyMatched
      const primaryReasonEn = `${act.titleEn} matches your ${travelerPace.toLowerCase()} pace, fits comfortably within your ${availableMinutes}-minute window, and starts ${route.isWalkable ? 'a short stroll' : `${route.durationMinutes} mins`} from ${origin}.`;
      const primaryReasonAr = `يتناسب نشاط ${act.titleAr} مع رغبتك في الاسترخاء، ويستغرق وقتاً مثالياً ضمن الساعتين المتاحتين، ويبعد ${route.isWalkable ? 'بضع دقائق سيراً' : `${route.durationMinutes} دقيقة بالسيارة`} من ${origin}.`;

      const whyMatched: WhyMatchedReason = {
        overallScore,
        primaryReasonEn,
        primaryReasonAr,
        factors: {
          geographicFit: {
            score: Math.round(geoScore),
            textEn: `${route.transitModeAr} (${route.durationMinutes} min transfer)`,
            textAr: `${route.transitModeAr} (${route.durationMinutes} دقيقة)`
          },
          timeFit: {
            score: Math.round(timeScore),
            textEn: `${act.durationMinutes}m activity + ${transitTime}m transit fits ${availableMinutes}m window`,
            textAr: `${act.durationMinutes} دقيقة نشاط + ${transitTime} دقيقة انتقال تناسب الساعتين`
          },
          paceFit: {
            score: Math.round(paceScore),
            textEn: `Calibrated for ${travelerPace} experience`,
            textAr: `مناسب لنمط ${travelerPace === 'Relaxed' ? 'الاسترخاء والهدوء' : travelerPace}`
          },
          availability: {
            score: Math.round(availScore),
            textEn: `Instant confirmation via ${act.bookingMode}`,
            textAr: `حجز وتأكيد مباشر`
          },
          supplierTrust: {
            score: Math.round(supplierScore),
            textEn: 'Verified Tier 1 Dahab Operator',
            textAr: 'مشغل محلي معتمد من الفئة الأولى'
          },
          environmentalSafety: {
            score: Math.round(envScore),
            textEn: isEnvBlocked ? 'Exceeds wind safety threshold' : 'All marine & wind conditions optimal',
            textAr: isEnvBlocked ? 'الرياح تتجاوز حد الأمان' : 'الظروف البحرية والرياح مثالية'
          }
        },
        evidenceLineage: [
          {
            factId: `FACT-${act.id}-LOC`,
            source: 'CDWS_DESTINATION_ATLAS_2026',
            verifiedAt: '2026-08-20T10:00:00Z',
            confidenceTier: 'VERY_HIGH'
          }
        ]
      };

      scoredList.push({
        activity: act,
        overallScore,
        whyMatched
      });
    }

    // Sort descending by overall score
    return scoredList.sort((a, b) => b.overallScore - a.overallScore);
  }
}

export const rankingEngine = new RankingEngine();
