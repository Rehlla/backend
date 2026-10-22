import { useCallback } from 'react';
import { useApiResource } from './useApiResource';
import { fetchNileCruiseRoutes } from '../services/cityService';

export function useNileCruiseRoutes() {
  const f = useCallback(async (signal: AbortSignal) => fetchNileCruiseRoutes(), []);
  return useApiResource(f, { cacheKey: 'nile-cruise-routes', ttlMs: 60_000 });
}
