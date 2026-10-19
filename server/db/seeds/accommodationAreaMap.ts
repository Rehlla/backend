/**
 * Legacy accommodation `area` strings -> real area_profiles.id.
 *
 * data/dahab_hotels.json (and its successor data/dahab_accommodations.json)
 * store area as a loose string that happens to reuse most area_profiles ids,
 * but was never a foreign key. This is the explicit mapping used to backfill
 * AccommodationEntity.areaId during import. An unmapped value throws rather
 * than silently defaulting, matching importDahabHotels.ts's existing
 * "duplicate slug throws" discipline — a wrong area is worse than a boot
 * failure that tells you exactly what to fix.
 */
export const LEGACY_AREA_TO_AREA_PROFILE_ID: Record<string, string> = {
  lighthouse: 'lighthouse',
  mashraba: 'mashraba',
  assalah: 'assalah',
  laguna: 'laguna',
  masbat: 'masbat',
  medina: 'medina',
  eel_garden: 'eel_garden',
  // areaGuide-only id in dahab_hotels.json's editorial copy; no 1:1
  // area_profiles match — Masbat is the closest real neighborhood.
  'city-centre': 'masbat',
  // The generalized accommodations catalogue spells it with an underscore;
  // same editorial-only id, same Masbat fallback.
  city_centre: 'masbat'
};

export function resolveAreaProfileId(legacyArea: string): string {
  const areaId = LEGACY_AREA_TO_AREA_PROFILE_ID[legacyArea];
  if (!areaId) {
    throw new Error(
      `No area_profiles mapping for legacy area "${legacyArea}". ` +
        'Add it to LEGACY_AREA_TO_AREA_PROFILE_ID before importing.'
    );
  }
  return areaId;
}
