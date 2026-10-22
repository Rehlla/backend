import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { dedupe, readCache, writeCache } from '../services/queryCache';
import type { HomepageContent, CmsContentPage, CmsPageWithBlocks, NavigationItemWire, SiteInfoBundle } from '../services/api';

/**
 * CMS Content Hook — fetches published content from the CMS API
 * with automatic fallback to compiled static data when the API is unavailable.
 *
 * Only hooks with a real consumer live here. The gallery, stories rail and
 * photo showcase read their own /api/dahab/content/* feeds; hooks without a
 * consumer were deleted rather than kept as dead abstractions (a hook nobody
 * calls is a second source of truth waiting to drift — the homepage hero sat
 * unwired for weeks because of exactly that).
 *
 * Usage:
 *   const { data } = useHomepageContent();      // hero config in V2HomeCockpit
 *   const { data } = useContentPage('about');   // CmsStaticPage
 *   const { data } = useNavigation('header');   // V2Navbar
 */

interface UseCmsResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  fromCMS: boolean;
}

/**
 * Generic hook to fetch CMS data with fallback.
 *
 * `deps` controls when the fetch re-runs (default: once on mount). Pass the
 * selection the fetch depends on — e.g. `[slug]` — so switching between two
 * CMS pages refetches instead of silently showing the first page forever.
 * The effect reads the fetch function through a ref so it never has to be
 * memoized by the caller, and the in-flight data is cleared at the start of
 * each load so a stale result is never shown for the new selection.
 *
 * `cacheKey` (optional, stable string) adds a TTL cache + in-flight dedup:
 * several surfaces fetch the same CMS resources (navbar and footer both read
 * navigation/site-info), and a fresh cache makes repeat visits instant.
 * A stale entry still serves while a background refresh runs; the compiled
 * fallback still covers total failure. Cache hits count as `fromCMS` (the
 * data did come from the CMS — it is not the compiled fallback).
 */
function useCmsFetch<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  fallback: T,
  deps: readonly unknown[] = [],
  cacheKey?: string
): UseCmsResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fromCMS, setFromCMS] = useState(false);
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      const cacheHit = cacheKey ? readCache<T>(cacheKey, CMS_CACHE_TTL_MS) : null;
      try {
        if (cacheHit) {
          setData(cacheHit.data);
          setFromCMS(true);
          if (!cacheHit.stale) {
            setLoading(false);
            return;
          }
        } else {
          setLoading(true);
          setData(null);
        }
        const result = cacheKey
          ? await dedupe<T>(cacheKey, () => fetchFnRef.current(controller.signal))
          : await fetchFnRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
        setFromCMS(true);
        if (cacheKey) writeCache(cacheKey, result);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          if (!cacheHit) {
            console.warn('[CMS] API unavailable, using fallback:', err.message);
            setData(fallback);
            setFromCMS(false);
            setError(err);
          }
          // With a cache hit the cached data we are showing stands.
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
    // The caller's deps ARE the effect contract (slug, menuKey, ...); the
    // fetch function itself is deliberately excluded via the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data: data ?? fallback, loading, error, fromCMS };
}

/** Freshness window for cached CMS reads (nav, site info, pages). */
const CMS_CACHE_TTL_MS = 60_000;

// ============================================================================
// Homepage Content
// ============================================================================

const DEFAULT_HOMEPAGE: HomepageContent = {
  hero: null,
  sections: [],
  featuredPrograms: [],
  featuredGallery: [],
  featuredStories: [],
};

export function useHomepageContent(): UseCmsResult<HomepageContent> {
  return useCmsFetch<HomepageContent>(
    async (signal) => {
      const data = await api.getCmsHomepage(signal);
      return data;
    },
    DEFAULT_HOMEPAGE,
    [],
    'cms.homepage'
  );
}

// ============================================================================
// Trip Programmes — consumed by useReadyProgrammes (featured reordering),
// which the ready-trips carousel, compare modal and programme detail read.
// ============================================================================

export function useTripProgrammes(): UseCmsResult<CmsContentPage[]> {
  return useCmsFetch<CmsContentPage[]>(
    async (signal) => {
      const data = await api.getCmsProgrammes(signal);
      return data.programmes || [];
    },
    [],
    [],
    'cms.programmes'
  );
}

// ============================================================================
// Content Page by Slug (with blocks)
// ============================================================================

export function useContentPage(slug: string): UseCmsResult<CmsPageWithBlocks> {
  return useCmsFetch<CmsPageWithBlocks>(
    async (signal) => {
      const data = await api.getCmsPage(slug, signal);
      return data;
    },
    { page: null, blocks: [] },
    [slug],
    `cms.page.${slug}`
  );
}

// ============================================================================
// Navigation
// ============================================================================

type NavigationItem = NavigationItemWire;

export function useNavigation(menuKey: string): UseCmsResult<NavigationItem[]> {
  return useCmsFetch<NavigationItem[]>(
    async (signal) => {
      const data = await api.getCmsNavigation(menuKey, signal);
      return data.items || [];
    },
    [],
    [menuKey],
    `cms.nav.${menuKey}`
  );
}

// ============================================================================
// Site Info — contact / social / hours for the footer. Null until loaded;
// the footer hides unconfigured slots, so the fallback is "render nothing".
// ============================================================================

export function useSiteInfo(): UseCmsResult<SiteInfoBundle | null> {
  return useCmsFetch<SiteInfoBundle | null>(
    async (signal) => {
      const data = await api.getSiteInfo(signal);
      return data.info || null;
    },
    null,
    [],
    'cms.siteinfo'
  );
}
