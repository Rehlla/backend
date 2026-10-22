import { useCallback } from 'react';
import { useApiResource } from './useApiResource';
import { fetchCityPlaces, fetchCityHotels, fetchCityFood, fetchCityMeta } from '../services/cityService';

export function useCityPlaces(slug: string) {
  const f = useCallback(async (signal: AbortSignal) => fetchCityPlaces(slug), [slug]);
  return useApiResource(f, { cacheKey: `city-places-${slug}`, ttlMs: 30_000 });
}
export function useCityHotels(slug: string) {
  const f = useCallback(async (signal: AbortSignal) => fetchCityHotels(slug), [slug]);
  return useApiResource(f, { cacheKey: `city-hotels-${slug}`, ttlMs: 30_000 });
}
export function useCityFood(slug: string) {
  const f = useCallback(async (signal: AbortSignal) => fetchCityFood(slug), [slug]);
  return useApiResource(f, { cacheKey: `city-food-${slug}`, ttlMs: 30_000 });
}
export function useCityMeta(slug: string) {
  const f = useCallback(async (signal: AbortSignal) => fetchCityMeta(slug), [slug]);
  return useApiResource(f, { cacheKey: `city-meta-${slug}`, ttlMs: 30_000 });
}
