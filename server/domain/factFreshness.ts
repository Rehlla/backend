import { TemporalFactEntity } from '../db/schema';

/**
 * Whether a temporal fact is stale relative to a cutoff timestamp.
 *
 * `TemporalFactEntity.verifiedAt` is optional, and the five call sites that
 * previously inlined this all wrote `f.verifiedAt < cutoff`. When verifiedAt is
 * undefined that comparison is ALWAYS false, so a fact that had never been
 * verified was never reported as stale — the exact opposite of the intent, and
 * it silently hid the least trustworthy facts from every staleness report,
 * knowledge-health score and review queue.
 *
 * A fact with no verification date has never been verified, so it is stale.
 */
export function isFactStale(fact: TemporalFactEntity, cutoffIso: string): boolean {
  if (fact.status !== 'CURRENT') return false;
  if (!fact.verifiedAt) return true;
  return fact.verifiedAt < cutoffIso;
}

/** Cutoff timestamp for a staleness window expressed in days. */
export function stalenessCutoff(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
