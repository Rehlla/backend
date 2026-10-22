import { useCallback, useRef } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { api } from '../services/api';
import type { FitWindowResponse, PostActivityFoodResponse, RouteEstimate } from '../shared/types/context';

/**
 * Hook that fetches what fits in the traveler's available time window from a
 * given origin area. Mirrors the pattern used in FirstTwoHoursView and
 * WhatShouldIDoNowView — stable fetcher, useApiResource caching.
 */
export function useFitWindowOptions(
  params: { originArea?: string; availableMinutes?: number; category?: string },
  enabled = true
) {
  const fetcher = useCallback(
    (signal: AbortSignal) => api.getFitWindowOptions(params, signal),
    [params]
  );
  return useApiResource(fetcher, { enabled });
}

/**
 * Hook that fetches post-activity dining suggestions near a given location.
 * Used inside activity detail views to suggest where to eat after the activity.
 */
export function usePostActivityFood(
  locationId: string = 'place-lighthouse',
  limit: number = 3,
  enabled = true
) {
  const fetcher = useCallback(
    (signal: AbortSignal) => api.getPostActivityFood(locationId, limit, signal),
    [locationId, limit]
  );
  return useApiResource(fetcher, { enabled });
}

/**
 * Hook that fetches travel time between two locations. Used in itinerary
 * day cards to show transit time between consecutive activities.
 */
export function useTravelEstimate(
  origin: string,
  destination: string,
  enabled = true
) {
  const fetcher = useCallback(
    (signal: AbortSignal) => api.getTravelEstimate(origin, destination, signal),
    [origin, destination]
  );
  return useApiResource<RouteEstimate>(fetcher, { enabled });
}

/** Map a location name to the nearest known place id for post-activity food. */
export function locationToPlaceId(location: string): string {
  const lower = location?.toLowerCase() ?? '';
  if (lower.includes('lighthouse') || lower.includes('eel garden')) return 'place-lighthouse';
  if (lower.includes('blue hole')) return 'place-blue-hole';
  if (lower.includes('canyon') || lower.includes('colored')) return 'place-canyon';
  if (lower.includes('ras abu') || lower.includes('lagoon')) return 'place-ras-abu-galum';
  if (lower.includes('assalah') || lower.includes('mashraba')) return 'place-assalah';
  return 'place-lighthouse';
}
