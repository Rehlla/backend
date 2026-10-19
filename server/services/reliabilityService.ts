import crypto from 'crypto';
import { db } from '../db/database';
import { SupplierMetricEntity } from '../db/schema';

/**
 * Supplier reliability scores (blueprint row #13).
 *
 * "Null scores, blind ops" → every supplier now carries a measured score
 * derived from actual booking events: response time, acceptance rate, and
 * cancellation rate. The score is the platform's trust data asset — it drives
 * search ranking, ops attention routing, and supplier onboarding gates.
 *
 * Score formula (0–100, higher = more reliable):
 *   acceptance_rate  × 40   (what % of booking requests did they accept?)
 *   response_speed   × 30   (median minutes to accept/reject, 0–60 min scale)
 *   cancellation_rate × 30  (inverted: 100 − cancellation%, capped at 0)
 *
 * The score is computed on-demand from the event log (no cron needed), and
 * cached on `SupplierEntity.reliabilityScore` for search ranking.
 */

export type MetricEvent = 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface ReliabilityScore {
  supplierId: string;
  acceptanceRate: number;   // 0–100
  responseSpeed: number;    // 0–100 (100 = instant, 0 = >60 min)
  cancellationRate: number; // 0–100 (100 = no cancellations, 0 = all cancelled)
  overall: number;          // 0–100 weighted composite
  sampleSize: number;       // total booking requests
  lastEventAt?: string;
}

// ---------------------------------------------------------------------------
// Event recording
// ---------------------------------------------------------------------------

export function recordSupplierMetric(
  supplierId: string,
  bookingRef: string,
  event: MetricEvent,
  responseMinutes?: number,
): SupplierMetricEntity {
  const now = new Date().toISOString();
  const id = `SMET-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const entity: SupplierMetricEntity = {
    id,
    supplierId,
    bookingRef,
    event,
    ...(responseMinutes !== undefined ? { responseMinutes } : {}),
    createdAt: now,
  };
  db.runInTransaction(() => {
    db.supplierMetrics.unshift(entity);
    db.logAudit('ReliabilityService', 'System', `SUPPLIER_METRIC_${event}`, 'SupplierMetric', id, {
      supplierId,
      bookingRef,
      event,
      responseMinutes,
    });
  });
  return entity;
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function computeReliability(supplierId: string): ReliabilityScore {
  const events = db.supplierMetrics.filter(m => m.supplierId === supplierId);
  const requests = events.filter(m => m.event === 'REQUESTED');
  const accepted = events.filter(m => m.event === 'ACCEPTED');
  const rejected = events.filter(m => m.event === 'REJECTED');
  const cancelled = events.filter(m => m.event === 'CANCELLED');

  const sampleSize = requests.length;
  if (sampleSize === 0) {
    return { supplierId, acceptanceRate: 0, responseSpeed: 0, cancellationRate: 0, overall: 0, sampleSize: 0 };
  }

  // Acceptance rate: what % of requests resulted in an accept?
  const decisionCount = accepted.length + rejected.length + cancelled.length;
  const acceptanceRate = decisionCount > 0 ? Math.round((accepted.length / decisionCount) * 100) : 0;

  // Response speed: median time to accept/reject, mapped to 0–100.
  // 0 minutes → 100 (instant), 60+ minutes → 0 (unacceptable).
  const responseTimes = events
    .filter(m => m.responseMinutes !== undefined && (m.event === 'ACCEPTED' || m.event === 'REJECTED'))
    .map(m => m.responseMinutes!);
  const medianResponse = median(responseTimes);
  const responseSpeed = sampleSize > 0
    ? Math.max(0, Math.round(100 - (medianResponse / 60) * 100))
    : 0;

  // Cancellation rate: what % of accepted bookings were later cancelled?
  // Inverted so higher = better (fewer cancellations).
  const cancellableCount = accepted.length + cancelled.length;
  const cancellationRate = cancellableCount > 0
    ? Math.round(100 - (cancelled.length / cancellableCount) * 100)
    : 100;

  const overall = Math.round(
    acceptanceRate * 0.40 +
    responseSpeed * 0.30 +
    cancellationRate * 0.30
  );

  const lastEventAt = events.length > 0 ? events[0]!.createdAt : undefined;

  return { supplierId, acceptanceRate, responseSpeed, cancellationRate, overall, sampleSize, lastEventAt };
}

// ---------------------------------------------------------------------------
// Persistence + cache
// ---------------------------------------------------------------------------

export function refreshSupplierScore(supplierId: string): ReliabilityScore {
  const score = computeReliability(supplierId);
  const supplier = db.suppliers.find(s => s.id === supplierId);
  if (supplier) {
    supplier.reliabilityScore = score.overall;
    supplier.reliabilitySampleSize = score.sampleSize;
  }
  return score;
}

export function refreshAllSupplierScores(): ReliabilityScore[] {
  const supplierIds = [...new Set(db.supplierMetrics.map(m => m.supplierId))];
  return supplierIds.map(id => refreshSupplierScore(id));
}

export const reliabilityService = {
  recordSupplierMetric,
  computeReliability,
  refreshSupplierScore,
  refreshAllSupplierScores,
};
