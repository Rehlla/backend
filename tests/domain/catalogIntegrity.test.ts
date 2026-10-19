import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../server/db/database';
import { runMigrationsAndSeed } from '../../server/db/migrations';
import {
  findCatalogIntegrityIssues,
  repairCatalogIntegrity
} from '../../server/db/catalogIntegrity';
import { reconcileActivityBookability } from '../../server/services/bookabilityReconciler';
import { dahabKnowledgeOs } from '../../server/services/dahabKnowledgeOs';

/**
 * Catalogue integrity is a product requirement, not a nicety: the corpus is
 * what Explore, the planner, DayGI and the booking surface all read. Blank
 * durations ("null min"), descriptions from the wrong place, and fake
 * neighborhoods are exactly the defects this suite exists to keep out.
 */
describe('catalogue integrity', () => {
  beforeAll(() => {
    // The in-memory adapter is installed by tests/setup.ts. Reproduce the
    // production boot seed path so the assertions run against the real corpus:
    // both seeding passes, then the bookability reconciliation that server.ts
    // runs at boot to clear dangling skuIds.
    runMigrationsAndSeed();
    dahabKnowledgeOs.bootstrapValidatedCorpus();
    reconcileActivityBookability();
  });

  it('boots a corpus with zero invariant violations', () => {
    const issues = findCatalogIntegrityIssues();
    expect(issues).toEqual([]);
  });

  it('gives every activity a positive durationMinutes', () => {
    const missing = db.activities
      .filter(a => !a.durationMinutes || a.durationMinutes <= 0)
      .map(a => a.id);
    expect(missing).toEqual([]);
  });

  it('resolves every activity placeId and skuId to real rows', () => {
    const unresolved = db.activities
      .filter(a => (a.placeId && !db.places.some(p => p.id === a.placeId)) ||
                   (a.skuId && !db.productSkus.some(s => s.id === a.skuId)))
      .map(a => a.id);
    expect(unresolved).toEqual([]);
  });

  it('resolves every place and activity areaId to a real area profile', () => {
    // The mandatory places/activities FK turns a dangling areaId into a
    // fatal fresh-boot failure on sqlite — this is the suite-level guard.
    const badPlaces = db.places.filter(p => p.areaId && !db.areaProfiles.some(a => a.id === p.areaId)).map(p => p.id);
    const badActivities = db.activities.filter(a => a.areaId && !db.areaProfiles.some(x => x.id === a.areaId)).map(a => a.id);
    expect(badPlaces).toEqual([]);
    expect(badActivities).toEqual([]);
  });

  it('keeps the Sharm airport transfer sellable under a real area', () => {
    const transfer = db.activities.find(a => a.id === 'act_ssh_airport_private_transfer');
    expect(transfer).toBeTruthy();
    expect(transfer!.areaId).toBe('masbat');
    expect(transfer!.placeId).toBe('place_ssh_dahab_highway');
    const place = db.places.find(p => p.id === 'place_ssh_dahab_highway');
    expect(place).toBeTruthy();
    expect(place!.areaId).toBe('masbat');
  });

  it('keeps the Ras Abu Galum boat safari at Ras Abu Galum, not the Blue Hole', () => {
    const boatSafari = db.activities.find(a => a.id === 'act_ras_abu_galum_boat_safari');
    expect(boatSafari).toBeTruthy();
    expect(boatSafari!.placeId).toBe('place_ras_abu_galum');
    expect(boatSafari!.areaId).toBe('ras_abu_galum');
  });

  it('does not list the Sharm–Dahab corridor as a Dahab area', () => {
    expect(db.areaProfiles.some(a => a.id === 'ssh_corridor')).toBe(false);
  });

  it('repairs rows written before the source fixes existed', () => {
    // Simulate a database seeded by the old research importer: an activity
    // with no duration, the corridor still present, and its orphaned rows.
    db.activities.push({
      id: 'act_freedive_line_training',
      titleEn: 'Freediving Line Training Session',
      titleAr: 'تدريب حر على الحبل',
      category: 'FREEDIVING',
      placeId: 'place_lighthouse_reef',
      areaId: 'lighthouse',
      durationMinutes: null as unknown as number,
      accessMethod: '',
      difficulty: 'Level 1+ Certified Freediver',
      experienceLevelRequired: 'Level 1+ Certified Freediver',
      basePriceEGP: 1175,
      bookingMode: 'REQUEST_NOW',
      seasonalityMonths: [],
      environmentalSensitivities: {},
      dependencies: []
    } as any);
    db.areaProfiles.push({ id: 'ssh_corridor', nameEn: 'Sharm El Sheikh - Dahab Transfer Corridor' } as any);
    // Simulate the legacy orphaned rows: real ids stranded on the retired area.
    db.places.find(p => p.id === 'place_ssh_dahab_highway')!.areaId = 'ssh_corridor';
    db.activities.find(a => a.id === 'act_ssh_airport_private_transfer')!.areaId = 'ssh_corridor';

    const applied = repairCatalogIntegrity();

    expect(applied).toContain('duration:act_freedive_line_training=120min');
    expect(applied).toContain('retire:ssh_corridor');
    expect(applied).toContain('area:place_ssh_dahab_highway');
    expect(applied).toContain('area:act_ssh_airport_private_transfer');
    expect(db.activities.find(a => a.id === 'act_freedive_line_training')!.durationMinutes).toBe(120);
    expect(db.areaProfiles.some(a => a.id === 'ssh_corridor')).toBe(false);
    expect(db.places.find(p => p.id === 'place_ssh_dahab_highway')!.areaId).toBe('masbat');
    expect(db.activities.find(a => a.id === 'act_ssh_airport_private_transfer')!.areaId).toBe('masbat');
    expect(findCatalogIntegrityIssues()).toEqual([]);
  });
});