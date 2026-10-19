/**
 * Great-circle distance between two coordinates.
 *
 * Extracted from transferRouteService.ts, which had it module-private, because
 * dining delivery quoting needs the same calculation and duplicating it would
 * have left two definitions of "how far apart these two points are" that could
 * disagree. Transfers now import it; behaviour is unchanged.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Nearest entry to a coordinate, by great-circle distance.
 *
 * Shared by transfer origin resolution and dining zone resolution so both
 * answer "which of these places am I closest to" the same way. Returns undefined
 * for a non-finite coordinate rather than throwing, because the input is a
 * browser geolocation fix.
 */
export function nearestByDistance<T>(
  latitude: number,
  longitude: number,
  entries: readonly T[],
  coordsOf: (entry: T) => { latitude: number; longitude: number }
): { entry: T; km: number } | undefined {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (entries.length === 0) return undefined;

  let best: { entry: T; km: number } | undefined;
  for (const entry of entries) {
    const { latitude: lat, longitude: lon } = coordsOf(entry);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const km = haversineKm(latitude, longitude, lat, lon);
    if (!best || km < best.km) best = { entry, km };
  }
  return best;
}