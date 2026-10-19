import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Frontend ↔ backend API contract (§7b).
 *
 * Every endpoint `src/services/api.ts` can call through `fetchWithTimeout`
 * must have a matching route registered on the Express server (server.ts or
 * one of the mounted routers). The scan is static: it reads the source files
 * and compares normalized path skeletons (Express `:param` and client-side
 * `${param}` interpolations both collapse to `*`).
 *
 * When the drift is empty, this suite is a hard contract gate: adding a new
 * api.ts endpoint that the server does not yet serve fails the test. The
 * KNOWN_MISSING set is only for short-term, explicitly-tracked exceptions; the
 * §5 resolution either removes the dead client method or adds the missing route,
 * after which KNOWN_MISSING is emptied and the gate becomes strict.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const API_CLIENT = path.join(ROOT, 'src', 'services', 'api.ts');
const SERVER_ENTRY = path.join(ROOT, 'server.ts');
const ROUTER_FILES = [
  'accommodationRoutes',
  'adminAccommodationRoutes',
  'adminContentRoutes',
  'adminDahabRoutes',
  'adminHotelRoutes',
  'adminSiteRoutes',
  'contentRoutes',
  'dahabRoutes',
  'dahabPartyRoutes',
  'diningRoutes',
  'fxRoutes',
  'hotelBookingRoutes',
  'hotelRoutes',
  'marketRoutes',
  'priceComparisonRoutes',
  'propertyStayRoutes',
  'rentalRoutes',
  'transferHubRoutes',
  'authRoutes',
  'operationsRoutes',
  'adminAccessRoutes',
  'adminControlRoutes',
  'configRoutes',
  'staffRealtimeRoutes',
  'catalogRoutes',
  'supplierCatalogRoutes',
].map((n) => path.join(ROOT, 'server', 'api', `${n}.ts`));

const KNOWN_MISSING: string[] = [];

const frontend = scanFrontendEndpoints();
const backend = scanBackendRoutes();

interface EndpointCall {
  method: string;
  path: string;
}

/**
 * Collapse a client-side URL literal into a path skeleton:
 *   - everything from the first top-level '?' is a query and is dropped
 *   - a `${...}` expansion occupying its own segment becomes '*'
 *   - a `${...}` expansion glued to a segment (the `?${qs}` idiom) is dropped
 */
function collapseUrl(raw: string): string {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '?') break;
    if (ch === '$' && raw[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') depth--;
        j++;
      }
      if (out.endsWith('/') || out === '') out += '*';
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Read the first argument of a call: a quoted string or template literal. */
function readUrlBody(body: string): string | null {
  let k = 0;
  while (k < body.length && /\s/.test(body[k])) k++;
  const quot = body[k];
  if (quot !== "'" && quot !== '"' && quot !== '`') return null;
  let raw = '';
  let depth = 0;
  let t = k + 1;
  while (t < body.length) {
    const ch = body[t];
    if (ch === quot && depth === 0) break;
    if (ch === '$' && body[t + 1] === '{') {
      depth++;
      raw += '${';
      t += 2;
      continue;
    }
    if (depth > 0) {
      raw += ch;
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      t++;
      continue;
    }
    raw += ch;
    t++;
  }
  return raw;
}

/** Scan api.ts for every fetchWithTimeout call site: method + normalized path. */
function scanFrontendEndpoints(): EndpointCall[] {
  const src = fs.readFileSync(API_CLIENT, 'utf8');
  const calls: EndpointCall[] = [];
  const marker = 'fetchWithTimeout(';
  let idx = src.indexOf(marker);
  while (idx !== -1) {
    let depth = 0;
    let j = idx + marker.length;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') {
        if (depth === 0) break;
        depth--;
      }
    }
    const body = src.slice(idx + marker.length, j);
    const method = /method:\s*['"]([A-Za-z]+)['"]/.exec(body)?.[1]?.toUpperCase() ?? 'GET';
    const raw = readUrlBody(body);
    if (raw) calls.push({ method, path: collapseUrl(raw) });
    idx = src.indexOf(marker, j);
  }
  return calls;
}

/** Turn an Express route string into the same skeleton space (`:param` → `*`). */
function expressSkeleton(p: string): string {
  return p.replace(/:[^/]+/g, '*').replace(/\/+$/, '') || p;
}

/** Scan server.ts inline routes plus the mounted routers for registered routes. */
function scanBackendRoutes(): EndpointCall[] {
  const routes: EndpointCall[] = [];
  const entry = fs.readFileSync(SERVER_ENTRY, 'utf8');

  const appRe = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (const m of entry.matchAll(appRe)) {
    routes.push({ method: m[1].toUpperCase(), path: expressSkeleton(m[2]) });
  }

  // `/api` alone is a valid mount (transferHubRouter). A prefix must still
  // start with /api so a non-API app.use is ignored.
  const mountRe = /app\.use\(\s*['"`](\/api(?:\/[^'"`]+)?)['"`],\s*(\w+Router)\)/g;
  const mounts: Record<string, string> = {};
  for (const m of entry.matchAll(mountRe)) mounts[m[2]] = m[1];

  for (const file of ROUTER_FILES) {
    if (!fs.existsSync(file)) continue;
    const rsrc = fs.readFileSync(file, 'utf8');
    // A file may export several routers (e.g. rentalRoutes exports both the
    // catalogue router and the rental-bookings router) — attribute every route
    // call to the nearest router declaration above it.
    const declRe = /export\s+const\s+(\w+Router)\s*=/g;
    const decls: { name: string; index: number }[] = [];
    for (const m of rsrc.matchAll(declRe)) decls.push({ name: m[1], index: m.index });
    const rre = /\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
    for (const m of rsrc.matchAll(rre)) {
      let routerName: string | undefined;
      for (const d of decls) {
        if (d.index < m.index) routerName = d.name;
        else break;
      }
      const prefix = routerName ? mounts[routerName] : undefined;
      if (!prefix) continue;
      routes.push({ method: m[1].toUpperCase(), path: expressSkeleton(prefix + m[2]) });
    }
  }

  return routes;
}

/**
 * A registered backend route serves a frontend call when the methods agree and
 * every path segment matches — where a backend `*` (an Express `:param`) may
 * absorb any single literal client segment (`me` ≈ `:userId`).
 */
function serves(call: EndpointCall, route: EndpointCall): boolean {
  if (call.method !== route.method) return false;
  const a = call.path.split('/');
  const b = route.path.split('/');
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (b[i] === '*') continue;
    if (b[i] !== a[i]) return false;
  }
  return true;
}

function drift(frontend: EndpointCall[], backend: EndpointCall[]): string[] {
  return frontend
    .filter((c) => !backend.some((r) => serves(c, r)))
    .map((c) => `${c.method} ${c.path}`)
    .sort();
}

describe('frontend ↔ backend API contract (§7b)', () => {
  const frontend = scanFrontendEndpoints();
  const backend = scanBackendRoutes();

  it('discovers the frontend call surface and the registered backend surface', () => {
    expect(frontend.length).toBeGreaterThan(30);
    expect(backend.length).toBeGreaterThan(100);
  });

  it('every api.ts endpoint matches a registered Express route', () => {
    const missing = drift(frontend, backend);
    if (KNOWN_MISSING.length > 0) {
      expect(missing).toEqual(KNOWN_MISSING);
      return;
    }
    expect(missing).toEqual([]);
  });
});