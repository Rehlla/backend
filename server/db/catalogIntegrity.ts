import { db } from './database';

/**
 * Catalogue data-integrity repair and assertions.
 *
 * The seed corpus is large and was assembled over many passes (DKOS expansion
 * data, the local-commerce importer, the docs/research importer), which is how
 * real defects slipped through: an activity with no duration rendered as
 * "null min" in Explore, a boat safari pointed at the Blue Hole's place so its
 * card showed the wrong description and neighborhood, and a highway corridor
 * listed as a Dahab area with a rating.
 *
 * `repairCatalogIntegrity` converges existing databases onto the fixed source
 * data (idempotent, no-op when already correct). `findCatalogIntegrityIssues`
 * reports every invariant violation so the suite can fail on a regression
 * instead of shipping a blank card.
 */

/**
 * Durations the research importer created these activities without, from
 * docs/research/DAHAB_ACTIVITIES_ATLAS.md ("2.0 Hours" → 120 min,
 * "1.0 - 2.0 Hours" → 90 min midpoint). The importer itself now parses the
 * column; this backfills rows written by earlier runs.
 */
const DURATION_BACKFILL: Record<string, number> = {
  act_freedive_line_training: 120,
  act_seafront_cruiser_bike: 90
};

/**
 * Legacy 'PLC-*' activity place references never resolved to a place row — the
 * atlas ids are 'place_*'. The importer now writes the atlas ids directly; this
 * converges databases seeded before that fix.
 */
const LEGACY_PLACE_ID_TO_ATLAS: Record<string, string> = {
  'PLC-BLUE-HOLE': 'place_blue_hole_sanctuary',
  'PLC-DAHAB-LAGUNA': 'place_laguna_sandspit',
  'PLC-LIGHTHOUSE-REEF': 'place_lighthouse_reef',
  'PLC-MOUNT-TWILAT': 'place_mount_twilat',
  'PLC-RAS-ABU-GALUM': 'place_ras_abu_galum',
  'PLC-WADI-GNAI': 'place_wadi_gnai_crags'
};

export function repairCatalogIntegrity(): string[] {
  const applied: string[] = [];

  // 1. Backfill missing durations.
  for (const [id, minutes] of Object.entries(DURATION_BACKFILL)) {
    const activity = db.activities.find(a => a.id === id);
    if (activity && (!activity.durationMinutes || activity.durationMinutes <= 0)) {
      activity.durationMinutes = minutes;
      applied.push(`duration:${id}=${minutes}min`);
    }
  }

  // 1b. Repoint legacy PLC-* place references at the real atlas ids.
  for (const activity of db.activities) {
    if (activity.placeId && LEGACY_PLACE_ID_TO_ATLAS[activity.placeId]) {
      activity.placeId = LEGACY_PLACE_ID_TO_ATLAS[activity.placeId];
      applied.push(`place:${activity.id}`);
    }
  }

  // 2. The Ras Abu Galum boat safari used to point at the Blue Hole sanctuary
  // place, so Explore rendered the Blue Hole's description and neighborhood
  // for a trip that sails elsewhere. Source fix lives in the expansion data;
  // this converges databases seeded before the fix.
  const boatSafari = db.activities.find(a => a.id === 'act_ras_abu_galum_boat_safari');
  if (boatSafari) {
    if (boatSafari.placeId === 'place_blue_hole_sanctuary') {
      boatSafari.placeId = 'place_ras_abu_galum';
      applied.push('place:act_ras_abu_galum_boat_safari');
    }
    if (boatSafari.areaId === 'blue_hole') {
      boatSafari.areaId = 'ras_abu_galum';
      applied.push('area:act_ras_abu_galum_boat_safari');
    }
  }

  // 3. Retire the Sharm–Dahab corridor from the areas atlas. It is a highway
  // route, not a neighborhood, and Explore's "Dahab Areas" rendered it with a
  // 1/10 rating.
  const corridorIdx = db.areaProfiles.findIndex(a => a.id === 'ssh_corridor');
  if (corridorIdx >= 0) {
    db.areaProfiles.splice(corridorIdx, 1);
    applied.push('retire:ssh_corridor');
  }

  // 4. Re-home the corridor's orphaned rows under Masbat (the transfer's
  // Dahab terminus — same rationale as the city-centre mapping). The area
  // retirement above stranded place_ssh_dahab_highway and
  // act_ssh_airport_private_transfer on a nonexistent areaId, which the
  // mandatory places.area_id FK turns into a fatal fresh-boot failure.
  // The transfer itself stays sellable: only its grouping changes, and the
  // bookability reconciler's SKU-TRF-001 mapping is untouched.
  const corridorPlace = db.places.find(p => p.id === 'place_ssh_dahab_highway');
  if (corridorPlace && corridorPlace.areaId === 'ssh_corridor') {
    corridorPlace.areaId = 'masbat';
    applied.push('area:place_ssh_dahab_highway');
  }
  const corridorTransfer = db.activities.find(a => a.id === 'act_ssh_airport_private_transfer');
  if (corridorTransfer && corridorTransfer.areaId === 'ssh_corridor') {
    corridorTransfer.areaId = 'masbat';
    applied.push('area:act_ssh_airport_private_transfer');
  }

  return applied;
}

export interface CatalogIntegrityIssue {
  collection: string;
  id: string;
  problem: string;
}

/**
 * Returns every catalogue invariant violation, or [] when the catalogue is
 * sound. Used at boot (log line) and by the test suite.
 */
export function findCatalogIntegrityIssues(): CatalogIntegrityIssue[] {
  const issues: CatalogIntegrityIssue[] = [];

  for (const activity of db.activities) {
    if (!activity.durationMinutes || activity.durationMinutes <= 0) {
      issues.push({
        collection: 'activities',
        id: activity.id,
        problem: `durationMinutes missing or non-positive (${activity.durationMinutes}) — renders as "null min"`
      });
    }
    if (activity.placeId && !db.places.some(p => p.id === activity.placeId)) {
      issues.push({
        collection: 'activities',
        id: activity.id,
        problem: `placeId ${activity.placeId} does not resolve to a place`
      });
    }
    if (activity.skuId && !db.productSkus.some(s => s.id === activity.skuId)) {
      issues.push({
        collection: 'activities',
        id: activity.id,
        problem: `skuId ${activity.skuId} does not resolve to a sellable SKU`
      });
    }
    if (activity.areaId && !db.areaProfiles.some(a => a.id === activity.areaId)) {
      issues.push({
        collection: 'activities',
        id: activity.id,
        problem: `areaId ${activity.areaId} does not resolve to an area profile (fatal on fresh sqlite boots via the places/activities FK)`
      });
    }
  }

  for (const place of db.places) {
    if (place.areaId && !db.areaProfiles.some(a => a.id === place.areaId)) {
      issues.push({
        collection: 'places',
        id: place.id,
        problem: `areaId ${place.areaId} does not resolve to an area profile (fatal on fresh sqlite boots via the places FK)`
      });
    }
  }

  for (const sku of db.productSkus) {
    if (sku.supplierId && !db.suppliers.some(s => s.id === sku.supplierId)) {
      issues.push({
        collection: 'productSkus',
        id: sku.id,
        problem: `supplierId ${sku.supplierId} does not resolve to a supplier`
      });
    }
  }

  if (db.areaProfiles.some(a => a.id === 'ssh_corridor')) {
    issues.push({
      collection: 'areaProfiles',
      id: 'ssh_corridor',
      problem: 'transfer corridor must not be listed as a Dahab area'
    });
  }

  return issues;
}