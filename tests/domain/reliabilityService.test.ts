import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';
import {
  recordSupplierMetric,
  computeReliability,
  refreshSupplierScore,
  refreshAllSupplierScores,
} from '../../server/services/reliabilityService';

/**
 * Supplier reliability scores (blueprint row #13).
 *
 * "Null scores, blind ops" → every supplier now carries a measured score
 * derived from actual booking events. These tests pin the score formula and
 * verify the persistence + refresh cycle.
 */

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-reliability-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();
  db.suppliers.push({
    id: 'SUP-1',
    businessName: 'Dahab Divers',
    businessNameAr: 'غواصين دهب',
    category: 'diving',
    tier: 'Tier 1 Certified',
    status: 'Active',
    area: 'masbat',
  } as any);
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function request(bookingRef: string) {
  recordSupplierMetric('SUP-1', bookingRef, 'REQUESTED');
}

function accept(bookingRef: string, minutes?: number) {
  recordSupplierMetric('SUP-1', bookingRef, 'ACCEPTED', minutes);
}

function reject(bookingRef: string, minutes?: number) {
  recordSupplierMetric('SUP-1', bookingRef, 'REJECTED', minutes);
}

function cancel(bookingRef: string) {
  recordSupplierMetric('SUP-1', bookingRef, 'CANCELLED');
}

function complete(bookingRef: string) {
  recordSupplierMetric('SUP-1', bookingRef, 'COMPLETED');
}

describe('reliabilityService', () => {
  it('returns 0 for a supplier with no events', () => {
    const score = computeReliability('SUP-1');
    expect(score.overall).toBe(0);
    expect(score.sampleSize).toBe(0);
  });

  it('acceptance rate: 100% when all requests are accepted', () => {
    request('B1'); accept('B1', 5);
    request('B2'); accept('B2', 10);
    request('B3'); accept('B3', 15);
    const score = computeReliability('SUP-1');
    expect(score.acceptanceRate).toBe(100);
    expect(score.sampleSize).toBe(3);
  });

  it('acceptance rate: partial when some are rejected', () => {
    request('B1'); accept('B1', 5);
    request('B2'); reject('B2', 10);
    request('B3'); accept('B3', 5);
    const score = computeReliability('SUP-1');
    // 2 accepted + 1 rejected = 3 decisions; 2/3 = 67%
    expect(score.acceptanceRate).toBe(67);
  });

  it('response speed: 100 for instant, 0 for 60+ min', () => {
    request('B1'); accept('B1', 0);
    const fast = computeReliability('SUP-1');
    expect(fast.responseSpeed).toBe(100);

    // Reset
    db.supplierMetrics.splice(0, db.supplierMetrics.length);
    request('B2'); accept('B2', 60);
    const slow = computeReliability('SUP-1');
    expect(slow.responseSpeed).toBe(0);
  });

  it('response speed: median of mixed accept/reject times', () => {
    request('B1'); accept('B1', 10);
    request('B2'); reject('B2', 20);
    request('B3'); accept('B3', 30);
    const score = computeReliability('SUP-1');
    // Median of [10, 20, 30] = 20; speed = 100 - (20/60)*100 = 67
    expect(score.responseSpeed).toBe(67);
  });

  it('cancellation rate: 100 when no cancellations, drops with cancels', () => {
    request('B1'); accept('B1', 5); complete('B1');
    request('B2'); accept('B2', 5); complete('B2');
    const noCancel = computeReliability('SUP-1');
    expect(noCancel.cancellationRate).toBe(100);

    db.supplierMetrics.splice(0, db.supplierMetrics.length);
    request('B1'); accept('B1', 5); cancel('B1');
    request('B2'); accept('B2', 5); complete('B2');
    const withCancel = computeReliability('SUP-1');
    // B1: accepted then cancelled; B2: accepted then completed.
    // cancellableCount = 2 accepted + 1 cancelled = 3; cancelled = 1
    // cancellationRate = 100 - (1/3)*100 = 67
    expect(withCancel.cancellationRate).toBe(67);
  });

  it('overall: weighted composite of the three axes', () => {
    request('B1'); accept('B1', 10);
    request('B2'); accept('B2', 10);
    const score = computeReliability('SUP-1');
    // acceptanceRate=100, responseSpeed=100-(10/60)*100=83, cancellationRate=100
    expect(score.overall).toBe(Math.round(100 * 0.4 + 83 * 0.3 + 100 * 0.3));
  });

  it('refreshSupplierScore writes the cached score to the supplier entity', () => {
    request('B1'); accept('B1', 5);
    request('B2'); accept('B2', 5);
    const score = refreshSupplierScore('SUP-1');
    expect(score.overall).toBeGreaterThan(0);
    expect(db.suppliers.find(s => s.id === 'SUP-1')!.reliabilityScore).toBe(score.overall);
    expect(db.suppliers.find(s => s.id === 'SUP-1')!.reliabilitySampleSize).toBe(2);
  });

  it('refreshAllSupplierScores processes every supplier with events', () => {
    db.suppliers.push({ id: 'SUP-2', businessName: 'Alt', businessNameAr: 'بديل', category: 'transfer', tier: 'Tier 2 Certified', status: 'Active', area: 'masbat' } as any);
    request('B1'); accept('B1', 5);
    db.supplierMetrics[db.supplierMetrics.length - 1].supplierId = 'SUP-2';

    const scores = refreshAllSupplierScores();
    expect(scores).toHaveLength(2);
    expect(scores.find(s => s.supplierId === 'SUP-2')!.overall).toBeGreaterThan(0);
  });

  it('round-trips through SQLite: events persist and scores recompute', () => {
    request('B1'); accept('B1', 8);
    request('B2'); reject('B2', 20);
    const fresh = computeReliability('SUP-1');

    // Simulate boot: new adapter from same file
    adapter.close();
    const adapter2 = new SqlitePersistenceAdapter(path.join(dir, 'test.sqlite'));
    db.setAdapter(adapter2);
    initializeCmsSchema();

    const reloaded = computeReliability('SUP-1');
    expect(reloaded.sampleSize).toBe(fresh.sampleSize);
    expect(reloaded.overall).toBe(fresh.overall);
    adapter2.close();
  });
});
