import { useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { useApiResource } from './useApiResource';
import { READY_TRIP_PROGRAMS, type ReadyTripProgram } from '../data/readyTripsData';
import { useTripProgrammes } from './useCMSContent';
import { useDestination } from '../context/DestinationContext';

/**
 * The ready-made programmes, from the API.
 *
 * Three components render them — the carousel, the compare modal and the quick
 * start wizard — and each imported the compiled array directly, so a price or
 * a description change meant a rebuild and a deploy. They come from
 * GET /api/dahab/content/programmes now, served from
 * server/db/seeds/editorialContent.ts.
 *
 * One hook rather than three fetches: `useApiResource` is called once per
 * component that uses this, and the compiled array is the offline fallback so
 * a failed request degrades the page instead of emptying it.
 *
 * The hook also checks the CMS for featured status. If the CMS marks a
 * programme as featured, it is sorted to the top of the list.
 */
/**
 * Canonical programme key.
 *
 * Prefixes are unreliable on BOTH sides: CMS slugs come as "dahab-first-timer"
 * (mostly) and bare "couples-escape" (once), while the served feed's ids are
 * prefixed for four programmes and bare for Couples Escape. Comparing a
 * rebuilt prefixed id against the served ids failed for exactly that one
 * programme, so both sides are normalized to their suffix before matching.
 * Unrelated slugs simply match no programme and are dropped.
 */
export function canonicalProgrammeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/^(?:programme-|dahab-)?(.+)$/);
  return match ? match[1] : null;
}

/**
 * Programmes for the destination being explored (`scope: 'current'`, the
 * default, including the planner) or every destination (`'all'`).
 * A programme without `destination` belongs to Dahab.
 */
export function useReadyProgrammes(scope: 'current' | 'all' = 'current'): ReadyTripProgram[] {
  const cmsProgrammes = useTripProgrammes();
  const { destinationId } = useDestination();
  const fetchProgrammes = useCallback(
    (signal: AbortSignal) => api.getReadyProgrammes(signal, scope === 'current' ? destinationId : undefined),
    [scope, destinationId],
  );
  const remote = useApiResource(fetchProgrammes);

  return useMemo(() => {
    const served = remote.data?.programmes;
    // A response still in flight for the previous place must not blank the
    // list: fall back to the compiled catalogue, which has every destination.
    const servedHere = Array.isArray(served)
      && served.length > 0
      && (scope === 'all' || served.every((p) => ((p as ReadyTripProgram).destination ?? 'dahab') === destinationId));
    const all = servedHere
      ? served as ReadyTripProgram[]
      : READY_TRIP_PROGRAMS;
    const programmes = scope === 'all' ? all : all.filter(p => (p.destination ?? 'dahab') === destinationId);

    // If CMS returned programmes, use their featured status to reorder
    const cmsData = cmsProgrammes.data;
    if (cmsProgrammes.fromCMS && Array.isArray(cmsData) && cmsData.length > 0) {
      const featuredIds = new Set(
        cmsData
          .filter((p: any) => p.featured)
          .map((p: any) => canonicalProgrammeKey(p.slug))
          .filter(Boolean) as string[]
      );

      if (featuredIds.size > 0) {
        const featured = programmes.filter(p => {
          const key = canonicalProgrammeKey(p.id);
          return key !== null && featuredIds.has(key);
        });
        const others = programmes.filter(p => {
          const key = canonicalProgrammeKey(p.id);
          return key === null || !featuredIds.has(key);
        });
        return [...featured, ...others];
      }
    }

    return programmes;
  }, [remote.data, cmsProgrammes.data, cmsProgrammes.fromCMS, scope, destinationId]);
}
