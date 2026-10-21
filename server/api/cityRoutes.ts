/**
 * Multi-city router: /api/cities (mounted in server.ts at /api/cities).
 *
 * 1) For 'dahab' → forward to original Dahab routers (dahabRouter,
 *    adminDahabRouter, dahabPartyRouter) with the /:citySlug prefix trimmed,
 *    so /api/cities/dahab/places hits the same handler as /api/dahab/places.
 * 2) For the other 4 MVP cities → real geojson-derived seed data
 *    (streaming extractor: 1,041,249 B / 851 dahab / 123 tourism).
 */
import fs from 'fs';
import { Router, Request, Response, NextFunction } from 'express';
import { cityDataPath } from '../db/paths';
import { CITIES_SEED, CitySeed } from '../db/citiesSeed';
import { SUB_DESTINATIONS_SEED, findSubDestination } from '../db/subDestinationsSeed';
import { lightCity, fullCityRecord, etagFor } from '../services/cityRecord';
import { dahabRouter } from './dahabRoutes';
import { adminDahabRouter } from './adminDahabRoutes';
import { dahabPartyRouter } from './dahabPartyRoutes';

export const cityRouter = Router();

/**
 * Registry reads live on their OWN router so server.ts can mount it before
 * cityRouter: the delegation middleware below intercepts /:citySlug and would
 * otherwise swallow the dahab registry read. Single-segment paths only —
 * deeper paths (/:citySlug/...) fall through to cityRouter untouched.
 */
export const cityRegistryRouter = Router();

function getCityData(slug: string) {
  try {
    const p = cityDataPath(slug);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null;
  } catch (e) { return null; }
}

/**
 * Read one catalogue feature regardless of the seed's on-disk shape.
 *
 * Two shapes are in the wild:
 *   · flat  (dahab.json, sharm.json, …) — { id, name, lat, lng, tags }
 *   · GeoJSON (any seed not yet converted) — { geometry: { coordinates: [lng, lat] },
 *     properties: { name, tourism, historic, … } }
 *
 * The conversion script (scripts/convert_geojson_to_flat.py) normalises the
 * GeoJSON seeds to the flat shape, but the server stays tolerant so a raw
 * GeoJSON drop-in still answers with real places instead of count=0.
 */
interface CityFeature {
  id: any; name: string; nameAr: string | null;
  lat: number | null; lng: number | null; tags: Record<string, any>;
}

function readFeature(f: any): CityFeature {
  const props = (f && f.properties) || {};
  const coords = (f && f.geometry && f.geometry.coordinates) || [];
  const tags = (f && f.tags) || props || {};
  const lat = f?.lat ?? coords[1] ?? props.lat ?? null;
  const lng = f?.lng ?? coords[0] ?? props.lng ?? null;
  return {
    id: f?.id ?? props.id ?? null,
    name: f?.name || props.name || props['name:en'] || props['name:ar'] || 'NOT FOUND',
    nameAr: props['name:ar'] || props.name || f?.nameAr || null,
    lat: lat ?? null,
    lng: lng ?? null,
    tags,
  };
}
function seedCity(slug: string): CitySeed | undefined {
  return CITIES_SEED.find(s => s.slug === slug);
}

/* ---------- Delegation middleware ----------
 * For 'dahab': trim the /:citySlug prefix and forward through the same routers
 * mounted in server.ts in the same order (adminDahabRouter → dahabRouter →
 * dahabPartyRouter), so /api/cities/dahab/places answers exactly like
 * /api/dahab/places. For non-dahab cities: the generic endpoints below handle
 * the trimmed URL after this middleware calls next().
 */
cityRouter.use('/:citySlug', (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.citySlug || '').trim().toLowerCase();
  if (!slug) return next();
  (req as any).citySlug = slug;
  res.locals.citySlug = slug;

  if (slug === 'dahab') {
    // The legacy dahab routers answer places/food only — they have no /hotels
    // surface, so without this hand-off /api/cities/dahab/hotels 404'd while
    // every other city answered. data/cities/dahab.json carries the same real
    // features, so let the generic flat-seed handlers below respond instead.
    if ((req.url || '').replace(/\/+$/, '') === '/hotels') return next();
    // Mirror the mount order in server.ts exactly:
    //   app.use('/api/dahab/admin', adminDahabRouter)  <- only /admin/* reaches it
    //   app.use('/api/dahab',       dahabRouter)       <- public surface
    //   app.use('/api/dahab',       dahabPartyRouter)
    //
    // adminDahabRouter runs requireAuth as a router-level middleware, so it
    // rejects EVERY path it is handed — public ones included. Calling it first
    // for a public URL answered 401 instead of the catalogue, which is why the
    // admin router is only consulted for /admin/* here.
    const originalUrl = req.url;
    if (originalUrl.startsWith('/admin/')) {
      // The admin router is mounted under /admin, so its own paths are the
      // remainder after that prefix.
      req.url = originalUrl.replace(/^\/admin/, '');
      adminDahabRouter(req, res, (err) => {
        req.url = originalUrl;
        if (err) return next(err);
        dahabRouter(req, res, (err2) => {
          req.url = originalUrl;
          if (err2) return next(err2);
          dahabPartyRouter(req, res, (err3) => {
            req.url = originalUrl;
            if (err3) return next(err3);
            res.status(404).json({ error: 'Not found', city: slug });
          });
        });
      });
      return;
    }
    dahabRouter(req, res, (err2) => {
      req.url = originalUrl;
      if (err2) return next(err2);
      dahabPartyRouter(req, res, (err3) => {
        req.url = originalUrl;
        if (err3) return next(err3);
        res.status(404).json({ error: 'Not found', city: slug });
      });
    });
    return;
  }
  // Non-dahab cities: generic endpoints handle the trimmed URL below.
  return next();
});

/* ---------- City registry (reports 04 §12 / 10 §4.1; gaps C-1 + C-4) ----
 * GET /api/cities        → the registry itself (light records, seed counters,
 *                          no data-file I/O).
 * GET /api/cities/:slug  → the full record (planner, transfer, live counts)
 *                          guarded by a strong ETag.
 * Ordering: server.ts mounts this router BEFORE cityRouter, so these reads
 * win over the /:citySlug delegation middleware — dahab gets the same full
 * record as every other city instead of the middleware's bare 404.
 */
cityRegistryRouter.get('/', (req: Request, res: Response) => {
  const cities = CITIES_SEED.map(lightCity);
  res.setHeader('Cache-Control', 'public, max-age=900');
  res.json({ cities, count: cities.length, catalogue: 'multi-city' });
});

cityRegistryRouter.get('/:citySlug', (req: Request, res: Response) => {
  // The registry router is mounted first with its own params — no delegation
  // middleware has run here, so req.params.citySlug is the slug itself.
  const slug = String(req.params.citySlug || '').trim().toLowerCase();
  const seed = seedCity(slug);
  if (!seed) return res.status(404).json({ error: 'City not found', city: slug });
  const payload = fullCityRecord(seed, getCityData(slug));
  const etag = etagFor(payload);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=900');
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.json(payload);
});

/* ---------- Generic endpoint: /places ---------- */
cityRouter.get('/:citySlug/places', (req: Request, res: Response) => {
  const slug: string = (req as any).citySlug || String(req.params.citySlug || 'dahab');
  const file = getCityData(slug);
  const seed = seedCity(slug);
  if (!file && slug !== 'dahab') {
    return res.status(404).json({ error: 'City not indexed', city: slug });
  }
  // Even if file is missing (edge case), fall back gracefully.
  const rawFeatures: any[] = file ? (file.features || []) : [];
  const places = rawFeatures.map((f: any): CityFeature => readFeature(f)).filter((feat: CityFeature) => {
    const tagStr = JSON.stringify(feat.tags || {});
    return tagStr.includes('tourism') || tagStr.includes('historic') ||
           tagStr.includes('restaurant') || tagStr.includes('cafe') ||
           tagStr.includes('dive_centre');
  }).map((feat: CityFeature) => ({
    id: feat.id,
    name: feat.name,
    nameAr: feat.nameAr,
    lat: feat.lat,
    lng: feat.lng,
    tags: feat.tags,
  }));
  const includeSub = String((req.query && (req.query as any).includeSub) || '').toLowerCase() === 'true';
  let subPlaces: any[] = [];
  if (includeSub) {
    for (const sd of Object.values(SUB_DESTINATIONS_SEED).filter((s) => s.parent === slug)) {
      const sf = getSubFile(sd.slug);
      if (!sf || !Array.isArray(sf.features)) continue;
      subPlaces = subPlaces.concat(sf.features.map((f: any) => ({
        id: f.id, name: f.name, nameAr: f.nameAr, lat: f.lat, lng: f.lng, tags: f.tags,
        parent: f.parent || sd.parent, subDestination: sd.slug,
      })));
    }
  }
  const combined = includeSub ? places.concat(subPlaces) : places;
  // Opt-in pagination (gap H-1 of report 11): the same page/limit contract as
  // the hotels endpoint. Without an explicit limit the full list is returned
  // — the pre-existing default, so no client loses rows it renders today —
  // and one page is capped at 1000 so a URL cannot dump the whole catalogue.
  const rawLimit = parseInt(String((req.query as any)?.limit ?? ''), 10);
  const rawPage = parseInt(String((req.query as any)?.page ?? ''), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : combined.length, 1), 1000);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  const start = (page - 1) * limit;
  res.json({
    city: slug,
    places: combined.slice(start, start + limit),
    count: combined.length,
    total: combined.length,
    page,
    limit,
    pages: Math.max(1, Math.ceil(combined.length / limit)),
    cityCount: places.length,
    subCount: subPlaces.length,
    tourismCount: seed ? seed.tourismCount : (file ? file.tourismCount : 0),
    featureCount: file ? file.featureCount : (seed ? seed.featureCount || 0 : 0),
    catalogue: seed ? seed.catalogue : 'early',
  });
});

/* ---------- Hotel / Food / Activity filters (derived from real feature tags) ---------- */
const HOTEL_TAGS = new Set([
  'hotel','guest_house','guesthouse','hostel','motel','resort','alpine_hut','chalet',
  'wilderness_hut','camp_site','caravan_site','dive_centre','apartment','bed_and_breakfast',
]);
const FOOD_TAGS = new Set([
  'restaurant','cafe','fast_food','bar','pub','ice_cream','food_court','bakery','pizzeria',
  'steakhouse','seafood','vegetarian','kebab','falafel','sushi','tea_house',
]);
function realHotels(file: any): any[] {
  return (file?.features || []).filter((f: any) => {
    const t = f?.tags || {}; return (t.tourism && HOTEL_TAGS.has(String(t.tourism))) || (t.amenity && HOTEL_TAGS.has(String(t.amenity)));
  });
}
function realFood(file: any): any[] {
  return (file?.features || []).filter((f: any) => {
    const t = f?.tags || {}; return (t.amenity && FOOD_TAGS.has(String(t.amenity))) || (t.tourism === 'restaurant');
  });
}
function realTourism(file: any): any[] {
  return (file?.features || []).filter((f: any) => {
    const s = JSON.stringify(f?.tags || '{}');
    return s.includes('tourism') || s.includes('historic');
  });
}

/* ---------- Hotels ---------- */
cityRouter.get('/:citySlug/hotels', (req: Request, res: Response) => {
  const slug = (req as any).citySlug || String(req.params.citySlug || 'dahab');
  const file = getCityData(slug);
  const seed = seedCity(slug);
  if (!file && slug !== 'dahab') return res.status(404).json({ error: 'City not indexed', city: slug });
  const list = realHotels(file).map(readFeature);
  // Paginated REAL list straight from the flat seed (file order) — the page
  // renders these verbatim, so nothing on screen can drift from the data.
  // limit is capped so one URL cannot dump every feature in one response.
  const rawLimit = parseInt(String((req.query as any)?.limit ?? ''), 10);
  const rawPage = parseInt(String((req.query as any)?.page ?? ''), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 12, 1), 200);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  const start = (page - 1) * limit;
  const items = list.slice(start, start + limit).map((feat: CityFeature) => ({
    id: feat.id,
    name: feat.name,
    nameAr: feat.nameAr,
    lat: feat.lat,
    lng: feat.lng,
    tourism: feat.tags && feat.tags.tourism ? String(feat.tags.tourism) : (feat.tags && feat.tags.amenity ? String(feat.tags.amenity) : null),
  }));
  const first = list[0] || null;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    city: slug,
    hotels: { tourismHotelCount: list.length, source: 'flat-seed-filtered', firstName: first ? first.name : null },
    count: list.length,
    total: list.length,
    page,
    limit,
    pages: Math.ceil(list.length / limit),
    items,
    first: first ? { name: first.name, nameAr: first.nameAr, lat: first.lat, lng: first.lng } : null,
    catalogue: seed ? seed.catalogue : 'early',
  });
});

/* ---------- Food ---------- */
cityRouter.get('/:citySlug/food', (req: Request, res: Response) => {
  const slug = (req as any).citySlug || String(req.params.citySlug || 'dahab');
  const file = getCityData(slug);
  const seed = seedCity(slug);
  if (!file && slug !== 'dahab') return res.status(404).json({ error: 'City not indexed', city: slug });
  const list = realFood(file);
  const first = list[0] ? readFeature(list[0]) : null;
  // Opt-in pagination, the same contract as hotels/places (gap H-1 of 11):
  // full list by default, page capped at 1000, totals reported.
  const rawLimit = parseInt(String((req.query as any)?.limit ?? ''), 10);
  const rawPage = parseInt(String((req.query as any)?.page ?? ''), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : list.length, 1), 1000);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  const start = (page - 1) * limit;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    city: slug,
    food: {
      restaurantCount: list.length,
      source: 'flat-seed-filtered',
      firstName: first ? first.name : null,
    },
    count: list.length,
    total: list.length,
    page,
    limit,
    pages: Math.max(1, Math.ceil(list.length / limit)),
    items: list.slice(start, start + limit).map((f: any) => {
      const feat = readFeature(f);
      const t = feat.tags || {};
      return {
        id: feat.id,
        name: feat.name,
        nameAr: feat.nameAr,
        lat: feat.lat,
        lng: feat.lng,
        type: (t.amenity ? String(t.amenity) : null) ||
              (t.tourism ? String(t.tourism) : null),
      };
    }),
    first: first ? { name: first.name, nameAr: first.nameAr, lat: first.lat, lng: first.lng } : null,
    catalogue: seed ? seed.catalogue : 'early',
  });
});

/* ---------- Activities ---------- */
cityRouter.get('/:citySlug/activities', (req: Request, res: Response) => {
  const slug = (req as any).citySlug || String(req.params.citySlug || 'dahab');
  const file = getCityData(slug);
  const seed = seedCity(slug);
  if (!file && slug !== 'dahab') return res.status(404).json({ error: 'City not indexed', city: slug });
  const tourismList = realTourism(file);
  const activities = {
    tourismTotal: tourismList.length,
    historicCount: tourismList.filter(f => (f.tags || {}).historic ? 1 : 0).length,
  };
  // Real item listing (gap H-2 of report 11): the page renders actual sights
  // — each with id/name/coords and a 'tourism' | 'historic' kind — instead of
  // the bare counters. Paginated like places/food: full list by default,
  // page capped at 1000; the old counter fields stay for compatibility.
  const rawLimit = parseInt(String((req.query as any)?.limit ?? ''), 10);
  const rawPage = parseInt(String((req.query as any)?.page ?? ''), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : tourismList.length, 1), 1000);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  const start = (page - 1) * limit;
  const items = tourismList.slice(start, start + limit).map((f: any) => {
    const feat = readFeature(f);
    return {
      id: feat.id,
      name: feat.name,
      nameAr: feat.nameAr,
      lat: feat.lat,
      lng: feat.lng,
      kind: (f.tags || {}).historic ? 'historic' : 'tourism',
    };
  });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    city: slug,
    activities,
    items,
    count: tourismList.length,
    total: tourismList.length,
    page,
    limit,
    pages: Math.max(1, Math.ceil(tourismList.length / limit)),
    catalogue: seed ? seed.catalogue : 'early',
  });
});

/* ---------- Meta / City profile ---------- */
cityRouter.get('/:citySlug/meta', (req: Request, res: Response) => {
  const slug = (req as any).citySlug || String(req.params.citySlug || 'dahab');
  const seed = seedCity(slug);
  const file = getCityData(slug);
  if (!seed && !file) return res.status(404).json({ error: 'City not found', city: slug });
  res.json({
    city: slug,
    nameEn: seed ? seed.nameEn : slug,
    nameAr: seed ? seed.nameAr : slug,
    catalogue: seed ? seed.catalogue : 'early',
    featureCount: file ? file.featureCount : (seed ? seed.featureCount : 0),
    tourismCount: file ? file.tourismCount : (seed ? seed.tourismCount : 0),
    vibe: seed ? seed.vibe : '',
    heroImage: seed ? seed.heroImage : '',
    chrome: seed ? seed.chrome : { abyss: '#000', salt: '#fff' },
    colour: seed ? seed.swatch[0] : '#ccc',
    wikidata: seed ? seed.wikidata || null : null,
    population: seed ? seed.population || null : null,
    bounds: seed && seed.bounds ? {
      latMin: seed.bounds.latMin, latMax: seed.bounds.latMax,
      lngMin: seed.bounds.lngMin, lngMax: seed.bounds.lngMax,
    } : (file ? (file as any).bounds || null : null),
  });
});

/* ---------- Sub-destination endpoints ----------
 * Sub-destinations live under a parent city's namespace:
 *   /api/cities/:parentSlug/sub             -> list of sub destinations for parent
 *   /api/cities/:parentSlug/sub/:subSlug/places -> flat seed points for one sub
 *   /api/cities/:parentSlug/places?includeSub=true -> merged places (optional)
 *
 * Sub-destination seeds are written in FLAT shape under data/cities/sub/:slug.json
 * (id/name/lat/lng/tags/parent), so they can be read with getCityData('sub:' + subSlug)
 * — the path is created by readFeature because it tolerates both shapes. */
function getSubFile(subSlug: string) {
  const p = 'data/cities/sub/' + subSlug + '.json';
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null;
}

/* 1. List sub destinations belonging to a parent city */
const SUB_META: Record<string, { name: string; nameEn: string; nameAr: string; vibe: string }> = {
  ras_mohamed: { name: 'Ras Mohamed', nameEn: 'Ras Mohamed', nameAr: 'راس محمد', vibe: 'محمية وغوص' },
  colored_canyon: { name: 'Colored Canyon', nameEn: 'Colored Canyon', nameAr: 'الوادي الملون', vibe: 'وادي الوان' },
};
cityRouter.get('/:citySlug/sub', (req: Request, res: Response) => {
  const slug = String((req as any).citySlug || req.params.citySlug || '').trim().toLowerCase();
  const children = Object.values(SUB_DESTINATIONS_SEED).filter((s) => s.parent === slug);
  res.json({
    city: slug,
    subDestinations: children.map((s) => {
      const meta = SUB_META[s.slug] || { name: s.slug, nameEn: s.slug, nameAr: s.slug, vibe: '' };
      const f = getSubFile(s.slug);
      return {
        slug: s.slug, name: meta.name, nameEn: meta.nameEn, nameAr: meta.nameAr,
        parent: s.parent, wikidata: s.wikidata, coords: s.coords,
        // Counts come from the flat seed file when present, so they never drift.
        featureCount: (f && typeof f.featureCount === 'number') ? f.featureCount : s.featureCount,
        tourismCount: (f && typeof f.tourismCount === 'number') ? f.tourismCount : s.tourismCount,
        color: s.color, type: s.type, vibe: meta.vibe,
        heroImage: '/images/cities/sub/' + s.slug + '.webp',
      };
    }),
    count: children.length,
  });
});

/* 2. Read one sub-destination's flat feature points */
cityRouter.get('/:citySlug/sub/:subSlug/places', (req: Request, res: Response) => {
  const citySlug = String((req as any).citySlug || req.params.citySlug || '').trim().toLowerCase();
  const subSlug = String((req as any).subSlug || req.params.subSlug || '').trim().toLowerCase();
  if (!citySlug || !subSlug) return res.status(400).json({ error: 'City and sub slug required', subSlug });
  const sd = findSubDestination(citySlug, subSlug);
  if (!sd) return res.status(404).json({ error: 'Sub-destination not found under this parent', city: citySlug, sub: subSlug });
  const file = getSubFile(subSlug);
  let places: any[] = [];
  if (file && file.features && Array.isArray(file.features)) {
    places = file.features.map((f: any) => ({
      id: f.id, name: f.name, nameAr: f.nameAr, lat: f.lat, lng: f.lng, tags: f.tags, parent: f.parent || sd.parent,
    }));
  } else {
    // No flat file yet — fall back to scan of all parents, but report sub slug.
    res.json({ city: citySlug, sub: subSlug, places: [], count: 0,
      note: 'flat file not yet built; running extraction', catalogue: sd.type });
    return;
  }
  // Apply the same filter the /places endpoint uses, so count matches expectations.
  const filtered = places.filter((f: any) => {
    const tagStr = JSON.stringify(f.tags || {});
    return tagStr.includes('tourism') || tagStr.includes('historic') ||
           tagStr.includes('restaurant') || tagStr.includes('cafe');
  }).map((f: any) => ({ ...f }));
  res.json({
    city: citySlug,
    sub: subSlug,
    count: filtered.length,
    placeCount: filtered.length,
    totalFeatures: places.length,
    // Counts are read from the flat seed file when present, so they can never
    // drift away from the actual features on disk.
    tourismCount: (file && typeof file.tourismCount === 'number') ? file.tourismCount : sd.tourismCount,
    featureCount: (file && typeof file.featureCount === 'number') ? file.featureCount : sd.featureCount,
    catalogue: 'early',
    first: filtered[0] || null,
    places: filtered,
  });
});

/* ---------- Sub-destination hotels ---------- */
cityRouter.get('/:citySlug/sub/:subSlug/hotels', (req: Request, res: Response) => {
  const citySlug = String((req as any).citySlug || req.params.citySlug || '').trim().toLowerCase();
  const subSlug = String((req as any).subSlug || req.params.subSlug || '').trim().toLowerCase();
  if (!citySlug || !subSlug) return res.status(400).json({ error: 'City and sub slug required', subSlug });
  const sd = findSubDestination(citySlug, subSlug);
  if (!sd) return res.status(404).json({ error: 'Sub-destination not found under this parent', city: citySlug, sub: subSlug });
  const sf = getSubFile(subSlug);
  if (!sf || !Array.isArray(sf.features)) {
    return res.json({ city: citySlug, sub: subSlug, count: 0, first: null, catalogue: sd.type, note: 'flat file not built' });
  }
  const list = sf.features.filter((f: any) => {
    const t = f?.tags || {}; return (t.amenity && HOTEL_TAGS.has(String(t.amenity))) || (t.tourism && HOTEL_TAGS.has(String(t.tourism)));
  });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    city: citySlug, sub: subSlug, count: list.length,
    first: list[0] ? readFeature(list[0]) : null, catalogue: sd.type,
  });
});

/* ---------- Sub-destination food ---------- */
cityRouter.get('/:citySlug/sub/:subSlug/food', (req: Request, res: Response) => {
  const citySlug = String((req as any).citySlug || req.params.citySlug || '').trim().toLowerCase();
  const subSlug = String((req as any).subSlug || req.params.subSlug || '').trim().toLowerCase();
  if (!citySlug || !subSlug) return res.status(400).json({ error: 'City and sub slug required', subSlug });
  const sd = findSubDestination(citySlug, subSlug);
  if (!sd) return res.status(404).json({ error: 'Sub-destination not found under this parent', city: citySlug, sub: subSlug });
  const sf = getSubFile(subSlug);
  if (!sf || !Array.isArray(sf.features)) {
    return res.json({ city: citySlug, sub: subSlug, count: 0, first: null, catalogue: sd.type, note: 'flat file not built' });
  }
  const list = sf.features.filter((f: any) => {
    const t = f?.tags || {}; return (t.amenity && FOOD_TAGS.has(String(t.amenity))) || (t.tourism === 'restaurant');
  });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    city: citySlug, sub: subSlug, count: list.length,
    first: list[0] ? readFeature(list[0]) : null, catalogue: sd.type,
  });
});

/* Fallback for any other non-dahab /:citySlug/* path. An explicit, honest
 * 404: the old body answered 200 with a stub payload and no data, which every
 * client then had to special-case (report 11, gap C-2). The `available` list
 * names the surfaces the city actually serves, sourced from the registry. */
cityRouter.get('/:citySlug/*', (req: Request, res: Response) => {
  const slug = (req as any).citySlug || String(req.params.citySlug || 'dahab');
  const seed = seedCity(slug);
  if (!seed) return res.status(404).json({ error: 'City not found', city: slug });
  res.status(404).json({
    error: 'not_indexed',
    city: slug,
    path: req.url,
    available: seed.services ?? [],
    catalogue: seed.catalogue,
  });
});
