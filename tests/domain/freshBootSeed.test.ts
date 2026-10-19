import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { db } from '../../server/db/database';
import { runMigrationsAndSeed } from '../../server/db/migrations';
import { dahabKnowledgeOs } from '../../server/services/dahabKnowledgeOs';
import { reconcileActivityBookability } from '../../server/services/bookabilityReconciler';

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-fresh-boot-'));
  adapter = new SqlitePersistenceAdapter(path.join(dir, 'fresh.sqlite'));
  db.setAdapter(adapter);
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Fresh-database boot seed — the regression test for the class of failure
 * where a dangling seed reference (accommodations.area_id, orphaned corridor
 * rows) aborts the whole seed transaction with FOREIGN KEY constraint
 * failed. The production boot path is reproduced exactly: migrations seed,
 * the DKOS bootstrap fills the corpus, bookability reconciles, and an
 * explicit saveToDisk() forces the FK-enforcing flush (boot's own saves may
 * otherwise skip unchanged rows via the shadow comparison).
 */
describe('fresh-database boot seed', () => {
  it('seeds, bootstraps, reconciles and flushes without FK violations', () => {
    expect(() => {
      runMigrationsAndSeed();
      dahabKnowledgeOs.bootstrapValidatedCorpus();
      reconcileActivityBookability();
      db.saveToDisk();
    }).not.toThrow();

    expect(db.accommodations.length).toBeGreaterThan(0);
    expect(db.areaProfiles.length).toBeGreaterThan(0);
    expect(db.places.length).toBeGreaterThan(0);
    expect(db.activities.length).toBeGreaterThan(0);

    // Every promoted FK resolves after the full seed.
    const areas = new Set(db.areaProfiles.map(a => a.id));
    expect(db.accommodations.every(a => areas.has(a.areaId))).toBe(true);
    expect(db.places.every(p => !p.areaId || areas.has(p.areaId))).toBe(true);
  });

  it('is idempotent across a second boot against the same file', () => {
    runMigrationsAndSeed();
    dahabKnowledgeOs.bootstrapValidatedCorpus();
    reconcileActivityBookability();
    db.saveToDisk();
    const counts = {
      accommodations: db.accommodations.length,
      places: db.places.length,
      activities: db.activities.length,
    };
    // Simulate a reboot: fresh adapter over the same file, full path again.
    adapter.close();
    adapter = new SqlitePersistenceAdapter(path.join(dir, 'fresh.sqlite'));
    db.setAdapter(adapter);
    expect(() => {
      runMigrationsAndSeed();
      dahabKnowledgeOs.bootstrapValidatedCorpus();
      reconcileActivityBookability();
      db.saveToDisk();
    }).not.toThrow();
    expect(db.accommodations.length).toBe(counts.accommodations);
    expect(db.places.length).toBe(counts.places);
    expect(db.activities.length).toBe(counts.activities);
  });
});
