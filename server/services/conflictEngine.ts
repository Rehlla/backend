import { ConflictClassification, ConflictSet, SourceType } from '../domain/knowledgeTypes';
import { db } from '../db/database';

export interface SourceClaim<T = any> {
  entityId: string;
  property: string;
  value: T;
  sourceId: string;
  sourceType: SourceType;
  authorityScore: number;
  observedAt: string;
  geographicScope?: string;
}

export class ConflictEngine {
  /**
   * Evaluate two opposing claims and classify their conflict
   */
  public evaluateClaims(claimA: SourceClaim, claimB: SourceClaim): {
    hasConflict: boolean;
    conflict?: ConflictSet;
    winningClaim?: SourceClaim;
  } {
    // If values are deeply equal, no conflict
    if (JSON.stringify(claimA.value) === JSON.stringify(claimB.value)) {
      return { hasConflict: false, winningClaim: claimA };
    }

    // Determine domain priority
    const isEmergencyOrSafety = claimA.property.includes('safety') || 
                               claimA.property.includes('emergency') || 
                               claimA.property.includes('regulation') ||
                               claimA.property.includes('hyperbaric');

    const isBusinessOpeningOrPrice = claimA.property.includes('openingHours') ||
                                    claimA.property.includes('price') ||
                                    claimA.property.includes('menu');

    let classification: ConflictClassification = 'UNRESOLVED';
    let explanation = '';
    let winningClaim: SourceClaim | undefined;

    // 1. Temporal difference (one observation is much newer)
    const timeA = new Date(claimA.observedAt).getTime();
    const timeB = new Date(claimB.observedAt).getTime();
    const diffDays = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);

    if (diffDays > 45) {
      classification = 'TEMPORAL';
      explanation = `Observation difference across ${Math.round(diffDays)} days. The newer observation reflects current operational state.`;
      winningClaim = timeA > timeB ? claimA : claimB;
    } else if (isEmergencyOrSafety) {
      // Official Authority dominates Safety
      if (claimA.sourceType === 'AUTHORITATIVE' && claimB.sourceType !== 'AUTHORITATIVE') {
        classification = 'BENIGN';
        explanation = 'Official government / CDWS regulatory authority overrides commercial observation for safety-critical policy.';
        winningClaim = claimA;
      } else if (claimB.sourceType === 'AUTHORITATIVE' && claimA.sourceType !== 'AUTHORITATIVE') {
        classification = 'BENIGN';
        explanation = 'Official government / CDWS regulatory authority overrides commercial observation for safety-critical policy.';
        winningClaim = claimB;
      } else {
        classification = 'TRUE_CONFLICT';
        explanation = 'Opposing safety/regulatory claims between comparable sources require manual Operations review.';
      }
    } else if (isBusinessOpeningOrPrice) {
      // Verified Local or Direct Supplier overrides old official registry
      if (claimA.sourceType === 'APPROVED_OPERATIONAL' || claimA.sourceType === 'VERIFIED_LOCAL') {
        classification = 'SCOPE_DIFFERENCE';
        explanation = 'Direct supplier or local field verification reflects immediate on-the-ground pricing/hours.';
        winningClaim = claimA;
      } else if (claimB.sourceType === 'APPROVED_OPERATIONAL' || claimB.sourceType === 'VERIFIED_LOCAL') {
        classification = 'SCOPE_DIFFERENCE';
        explanation = 'Direct supplier or local field verification reflects immediate on-the-ground pricing/hours.';
        winningClaim = claimB;
      } else {
        classification = 'TRUE_CONFLICT';
        explanation = 'Pricing or schedule divergence between third-party observations.';
      }
    } else {
      classification = 'TRUE_CONFLICT';
      explanation = `Direct value divergence on property '${claimA.property}' between ${claimA.sourceId} and ${claimB.sourceId}.`;
    }

    const conflictSet: ConflictSet = {
      id: `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: claimA.entityId,
      property: claimA.property,
      claimA: {
        value: claimA.value,
        sourceId: claimA.sourceId,
        observedAt: claimA.observedAt,
        authorityScore: claimA.authorityScore
      },
      claimB: {
        value: claimB.value,
        sourceId: claimB.sourceId,
        observedAt: claimB.observedAt,
        authorityScore: claimB.authorityScore
      },
      classification,
      explanation,
      status: winningClaim ? 'AUTO_RECONCILED' : 'OPEN',
      resolvedValue: winningClaim ? winningClaim.value : undefined,
      resolvedAt: winningClaim ? new Date().toISOString() : undefined,
      resolvedBy: winningClaim ? 'DKOS_SOURCE_PRIORITY_ENGINE' : undefined
    };

    // Save conflict to DB
    const existingIdx = db.conflictSets.findIndex(c => c.entityId === claimA.entityId && c.property === claimA.property);
    if (existingIdx >= 0) {
      db.conflictSets[existingIdx] = conflictSet as any;
    } else {
      db.conflictSets.push(conflictSet as any);
    }
    db.saveToDisk();

    return {
      hasConflict: true,
      conflict: conflictSet,
      winningClaim
    };
  }

  /**
   * Manually resolve a conflict set by Operations Admin
   */
  public resolveConflict(conflictId: string, resolvedValue: any, resolvedBy: string): ConflictSet {
    const conflict = db.conflictSets.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error(`ConflictSet '${conflictId}' not found.`);
    }

    conflict.status = 'RESOLVED';
    conflict.resolvedValue = resolvedValue;
    conflict.resolvedAt = new Date().toISOString();
    conflict.resolvedBy = resolvedBy;

    db.logAudit(resolvedBy, 'Operations', 'RESOLVE_CONFLICT', 'ConflictSet', conflictId, {
      property: conflict.property,
      resolvedValue
    });

    db.saveToDisk();
    return conflict as any;
  }
}

export const conflictEngine = new ConflictEngine();
