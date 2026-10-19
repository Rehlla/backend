import { describe, it, expect } from 'vitest';
import { isFactStale, stalenessCutoff } from '../../server/domain/factFreshness';
import type { TemporalFactEntity } from '../../server/db/schema';

/**
 * Regression cover for the staleness bug.
 *
 * Five call sites inlined `f.verifiedAt < cutoff`. `verifiedAt` is optional, and
 * `undefined < someString` is ALWAYS false — so a fact that had never been
 * verified was never reported as stale, hiding the least trustworthy knowledge
 * from every staleness report, health score and review queue.
 */

const fact = (over: Partial<TemporalFactEntity>): TemporalFactEntity =>
  ({
    id: 'F1',
    subjectId: 'PLC-1',
    status: 'CURRENT',
    confidence: 0.9,
    validFrom: '2026-01-01T00:00:00Z',
    ...over
  }) as TemporalFactEntity;

describe('isFactStale', () => {
  const cutoff = stalenessCutoff(90);

  it('treats a never-verified CURRENT fact as stale', () => {
    // The whole point: the old inline expression returned false here.
    expect(isFactStale(fact({ verifiedAt: undefined }), cutoff)).toBe(true);
  });

  it('demonstrates the original defect for comparison', () => {
    const undefinedVerifiedAt = undefined as unknown as string;
    expect(undefinedVerifiedAt < cutoff).toBe(false);
  });

  it('marks a fact verified before the cutoff as stale', () => {
    expect(isFactStale(fact({ verifiedAt: '2020-01-01T00:00:00Z' }), cutoff)).toBe(true);
  });

  it('does not mark a recently verified fact as stale', () => {
    expect(isFactStale(fact({ verifiedAt: new Date().toISOString() }), cutoff)).toBe(false);
  });

  it('ignores facts that are not CURRENT, even when undated', () => {
    expect(isFactStale(fact({ status: 'HISTORICAL', verifiedAt: undefined }), cutoff)).toBe(false);
    expect(isFactStale(fact({ status: 'SUPERSEDED', verifiedAt: '2020-01-01T00:00:00Z' }), cutoff)).toBe(false);
  });
});

describe('stalenessCutoff', () => {
  it('returns an ISO timestamp the given number of days in the past', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    expect(stalenessCutoff(90, now)).toBe('2026-03-17T12:00:00.000Z');
  });

  it('orders correctly against ISO timestamps, which is what callers rely on', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const cutoff = stalenessCutoff(30, now);
    expect('2026-01-01T00:00:00.000Z' < cutoff).toBe(true);
    expect('2026-06-14T00:00:00.000Z' < cutoff).toBe(false);
  });
});
