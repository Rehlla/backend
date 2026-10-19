/**
 * §7b(i) — client↔server API contract.
 *
 * Every route the client can call (api.ts + the two documented CMS `cmsFetch`
 * helpers) must exist on the Express server, with the same HTTP method. `:param`
 * and `${…}` segments both normalise to `*`; a client path may end in a single
 * `*` that consumes zero or one server segment (query-style templates like
 * `/api/dahab/food${qs ? `?${qs}` : ''}`).
 *
 * Two guardrails hang off the same inventory:
 *   · server routes without a client caller are reported (webhooks, internal
 *     admin paths, ...) — informational, non-failing;
 *   · raw `fetch`/`fetchWithTimeout('/api/...')` outside `src/services/` is a
 *     hard failure — new endpoints must get a UI in api.ts first ("يلاقيهم أو
 *     يمنع الجداد"), the single carve-out being the two CMS `cmsFetch` helpers.
 */
import { describe, it, expect } from 'vitest';
import { collectClientRoutes, collectOutOfBandFetches, ClientRoute } from '../helpers/clientRoutes';
import { collectServerRoutes, ServerRoute } from '../helpers/serverRoutes';

const client = collectClientRoutes();
const server = collectServerRoutes();

function matches(c: ClientRoute, s: ServerRoute): boolean {
  if (c.method !== s.method) return false;
  const cs = c.path.split('/').filter(Boolean);
  const ss = s.path.split('/').filter(Boolean);
  const rec = (i: number, j: number): boolean => {
    if (i === cs.length) return j === ss.length;
    if (cs[i] === '*') {
      if (rec(i + 1, j)) return true;
      if (j < ss.length && rec(i + 1, j + 1)) return true;
      return false;
    }
    if (j >= ss.length) return false;
    if (cs[i] === ss[j] || ss[j] === '*') return rec(i + 1, j + 1);
    return false;
  };
  return rec(0, 0);
}

describe('API contract', () => {
  it('every client route exists on the server', () => {
    const unmatched = client.filter((c) => !server.some((s) => matches(c, s)));
    expect(unmatched).toEqual([]);
  });

  it('reports server routes with no client caller (informational, non-failing)', () => {
    const orphaned = server.filter((s) => !client.some((c) => matches(c, s)));
    const lines = orphaned.map((s) => `${s.method} ${s.path}`);
    if (lines.length) {
      console.warn(
        `\n[api-contract] ${lines.length} server route(s) have no client caller (expected for webhooks/internal/admin):\n  - ${lines.slice(0, 40).join('\n  - ')}${lines.length > 40 ? `\n  …and ${lines.length - 40} more` : ''}`
      );
    }
    expect(true).toBe(true);
  });

  it('no raw /api fetch outside src/services except the two cmsFetch helpers', () => {
    const outOfBand = collectOutOfBandFetches();
    const violations = outOfBand.filter((c) => c.kind !== 'cmsFetch');
    expect(violations).toEqual([]);
    expect(outOfBand.filter((c) => c.kind === 'cmsFetch').length).toBeGreaterThan(0);
  });
});