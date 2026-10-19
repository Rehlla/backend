import fs from 'fs';
import path from 'path';
import { dataDir } from '../db/paths';
import {
  browseRestaurants,
  browseStays,
  type BrowseDestination,
  type BrowseKind,
  type BrowseRestaurant,
  type BrowseStay,
} from '../../src/shared/placeBrowse';

const cache = new Map<string, BrowseStay[] | BrowseRestaurant[]>();

function readPlaces(destination: BrowseDestination, kind: BrowseKind): unknown[] {
  const file = kind === 'stay' ? 'hotels' : 'restaurants';
  const filePath = path.join(dataDir(), 'tripadvisor', `${destination}_${file}.json`);
  try {
    if (!fs.existsSync(filePath)) return [];
    const doc = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { places?: unknown };
    return Array.isArray(doc.places) ? doc.places : [];
  } catch {
    return [];
  }
}

/** Card-ready stays, or named restaurants, for one destination.
 *  Missing pull files yield an empty list. The files are runtime data,
 *  not boot-critical seeds. */
export function loadPlaceBrowse(destination: BrowseDestination, kind: BrowseKind): BrowseStay[] | BrowseRestaurant[] {
  const key = `${destination}:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const places = readPlaces(destination, kind) as Parameters<typeof browseStays>[1];
  const rows = kind === 'stay' ? browseStays(destination, places) : browseRestaurants(destination, places);
  cache.set(key, rows);
  return rows;
}

export function __clearPlaceBrowseCache(): void {
  cache.clear();
}
