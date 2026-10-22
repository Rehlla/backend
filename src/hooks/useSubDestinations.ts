import { useCallback } from 'react';
import { useApiResource } from './useApiResource';
import { fetchSubPlaces, fetchSubHotels, fetchSubFood } from '../services/cityService';

export function useSubDestinations(parent: string, sub: string, kind: 'places' | 'hotels' | 'food' = 'places') {
  const f = useCallback(async (signal: AbortSignal) => {
    if (kind === 'places') return fetchSubPlaces(parent, sub);
    if (kind === 'hotels') return fetchSubHotels(parent, sub);
    return fetchSubFood(parent, sub);
  }, [parent, sub, kind]);
  return useApiResource(f, { cacheKey: `sub-${parent}-${sub}-${kind}`, ttlMs: 30_000 });
}
