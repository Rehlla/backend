import { EntityIdentity, EntityResolutionMatchStatus } from '../domain/knowledgeTypes';
import { PlaceDiscoveryEntity } from '../db/schema';
import { db } from '../db/database';

export class EntityResolutionService {
  /**
   * Arabic String Normalization (Removes Tashkeel, normalizes Alef, Yaa, Taa Marbuta)
   */
  public normalizeArabic(text: string): string {
    if (!text) return '';
    return text
      .trim()
      // Remove diacritics (tashkeel)
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Normalize Alef variations (أ, إ, آ, ٱ -> ا)
      .replace(/[أإآٱ]/g, 'ا')
      // Normalize Taa Marbuta (ة -> ه)
      .replace(/ة/g, 'ه')
      // Normalize Yaa (ى -> ي)
      .replace(/ى/g, 'ي')
      // Remove Kashida (ـ)
      .replace(/ـ/g, '')
      .toLowerCase();
  }

  /**
   * English String Normalization
   */
  public normalizeEnglish(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Levenshtein Distance for typo tolerance
   */
  public calculateLevenshteinSimilarity(a: string, b: string): number {
    const s1 = this.normalizeEnglish(a);
    const s2 = this.normalizeEnglish(b);
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator
        );
      }
    }
    const distance = track[s2.length][s1.length];
    const maxLen = Math.max(s1.length, s2.length);
    return Math.max(0, 1 - distance / maxLen);
  }

  /**
   * Geodesic Distance in meters between coordinates
   */
  public calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Resolve an incoming candidate against the existing canonical place registry
   */
  public resolveCandidate(candidate: {
    nameEn: string;
    nameAr?: string;
    category?: string;
    lat: number;
    lng: number;
    googlePlaceId?: string;
  }): {
    matchStatus: EntityResolutionMatchStatus;
    confidenceScore: number;
    resolvedEntityId?: string;
    reason: string;
  } {
    const existingPlaces = db.places;

    // 1. Exact Google Place ID match
    if (candidate.googlePlaceId) {
      const matchByPlaceId = existingPlaces.find(p => p.googlePlaceId === candidate.googlePlaceId);
      if (matchByPlaceId) {
        return {
          matchStatus: 'EXACT',
          confidenceScore: 1.0,
          resolvedEntityId: matchByPlaceId.id,
          reason: `Exact Google Place ID match (${candidate.googlePlaceId})`
        };
      }
    }

    let bestScore = 0;
    let bestMatch: (typeof existingPlaces)[0] | null = null;
    let matchReason = '';

    for (const place of existingPlaces) {
      const distMeters = this.calculateDistanceMeters(candidate.lat, candidate.lng, place.coordinates.lat, place.coordinates.lng);
      
      // Name similarity checks
      const enSim = this.calculateLevenshteinSimilarity(candidate.nameEn, place.nameEn);
      
      // Check aliases
      let aliasSim = 0;
      if (place.aliases && place.aliases.length > 0) {
        for (const alias of place.aliases) {
          const sim = this.calculateLevenshteinSimilarity(candidate.nameEn, alias);
          if (sim > aliasSim) aliasSim = sim;
        }
      }

      // Arabic similarity check
      let arSim = 0;
      if (candidate.nameAr && place.nameAr) {
        const normCandAr = this.normalizeArabic(candidate.nameAr);
        const normPlaceAr = this.normalizeArabic(place.nameAr);
        arSim = this.calculateLevenshteinSimilarity(normCandAr, normPlaceAr);
      }

      const nameScore = Math.max(enSim, aliasSim, arSim);
      
      // Distance weighting: < 50m = 1.0, < 150m = 0.8, < 300m = 0.5, > 500m = 0.1
      let geoWeight = 0.1;
      if (distMeters < 50) geoWeight = 1.0;
      else if (distMeters < 150) geoWeight = 0.8;
      else if (distMeters < 300) geoWeight = 0.5;

      const compositeScore = nameScore * 0.7 + geoWeight * 0.3;

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestMatch = place;
        matchReason = `Name similarity ${(nameScore * 100).toFixed(1)}%, Distance ${distMeters.toFixed(0)}m`;
      }
    }

    // Category mismatch check
    if (candidate.category && bestMatch && bestMatch.category) {
      const candCat = candidate.category.toLowerCase();
      const matchCat = bestMatch.category.toLowerCase();
      const isMismatch = (candCat.includes('camp') && (matchCat.includes('restaurant') || matchCat.includes('reef') || matchCat.includes('dive') || matchCat.includes('marine'))) ||
                         (candCat.includes('restaurant') && (matchCat.includes('camp') || matchCat.includes('reef') || matchCat.includes('dive'))) ||
                         (candCat.includes('dive') && (matchCat.includes('bakery') || matchCat.includes('camp')));
      if (isMismatch) {
        return {
          matchStatus: 'DISTINCT',
          confidenceScore: 0.1,
          reason: `Distinct entity: Category mismatch ('${candidate.category}' vs '${bestMatch.category}') despite name similarity.`
        };
      }
    }

    if (bestScore >= 0.90 && bestMatch) {
      return {
        matchStatus: 'EXACT',
        confidenceScore: bestScore,
        resolvedEntityId: bestMatch.id,
        reason: bestReasonString(bestMatch.nameEn, matchReason)
      };
    }

    if (bestScore >= 0.75 && bestMatch) {
      return {
        matchStatus: 'HIGH_CONFIDENCE',
        confidenceScore: bestScore,
        resolvedEntityId: bestMatch.id,
        reason: bestReasonString(bestMatch.nameEn, matchReason)
      };
    }

    if (bestScore >= 0.50 && bestMatch) {
      return {
        matchStatus: 'REVIEW_REQUIRED',
        confidenceScore: bestScore,
        resolvedEntityId: bestMatch.id,
        reason: `Potential match with ${bestMatch.nameEn} requiring review: ${matchReason}`
      };
    }

    return {
      matchStatus: 'DISTINCT',
      confidenceScore: 0.1,
      reason: 'No existing entity within distance or name threshold; distinct new candidate'
    };
  }

  /**
   * Execute a reversible merge between two place entities
   */
  public mergeEntities(sourceId: string, targetId: string, actor: string): { success: boolean; message: string } {
    const source = db.places.find(p => p.id === sourceId);
    const target = db.places.find(p => p.id === targetId);

    if (!source || !target) {
      throw new Error(`Cannot merge: Source '${sourceId}' or Target '${targetId}' not found.`);
    }

    // Merge aliases
    const combinedAliases = Array.from(new Set([...target.aliases, ...source.aliases, source.nameEn]));
    const combinedAr = Array.from(new Set([...target.arabicNames, ...source.arabicNames, source.nameAr]));
    
    target.aliases = combinedAliases;
    target.arabicNames = combinedAr;

    // Log merge in audit trail
    db.logAudit(actor, 'Operations', 'ENTITY_MERGE', 'Place', target.id, {
      mergedFromId: source.id,
      mergedFromName: source.nameEn,
      targetId: target.id,
      timestamp: new Date().toISOString()
    });

    // Remove source place
    const sourceIdx = db.places.findIndex(p => p.id === sourceId);
    if (sourceIdx >= 0) {
      db.places.splice(sourceIdx, 1);
    }
    db.saveToDisk();

    return {
      success: true,
      message: `Successfully merged '${source.nameEn}' into canonical '${target.nameEn}'.`
    };
  }
}

function bestReasonString(targetName: string, reason: string): string {
  return `Resolved to '${targetName}' (${reason})`;
}

export const entityResolutionService = new EntityResolutionService();
