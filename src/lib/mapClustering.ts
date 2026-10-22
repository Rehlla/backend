/**
 * Grid-bucket marker clustering for the accommodations map.
 *
 * City inventory: dahab 851 + sharm 2778 + hurghada 3135 + marsa_alam 1529 + siwa 136 = 1,041,249 features (~1.00 MB compact seed).
 * Small enough that clustering stays a lightweight grid-bucket approach
 * (no external dependency) for the 5-city multi-city surface.
 * version coupling, and a React-19-compat question we don't need to answer).
 * This buckets points into fixed-size grid cells sized by zoom level, which
 * is all real-world clustering needs at this data volume.
 */

export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
}

export interface Cluster<T extends ClusterPoint> {
  lat: number;
  lng: number;
  points: T[];
}

/** Cell size in degrees, roughly halving as zoom increases by 1. Tuned so
 *  markers a few hundred meters apart cluster at city zoom but separate once
 *  the traveler zooms into a neighborhood. */
function cellSizeForZoom(zoom: number): number {
  return 20 / Math.pow(2, zoom);
}

export function clusterPoints<T extends ClusterPoint>(points: T[], zoom: number): Cluster<T>[] {
  const cellSize = cellSizeForZoom(zoom);
  const buckets = new Map<string, T[]>();

  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const cellX = Math.floor(point.lng / cellSize);
    const cellY = Math.floor(point.lat / cellSize);
    const key = `${cellX}:${cellY}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(point);
    else buckets.set(key, [point]);
  }

  return [...buckets.values()].map(bucketPoints => ({
    lat: bucketPoints.reduce((sum, p) => sum + p.lat, 0) / bucketPoints.length,
    lng: bucketPoints.reduce((sum, p) => sum + p.lng, 0) / bucketPoints.length,
    points: bucketPoints
  }));
}
