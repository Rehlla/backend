import { describe, it, expect } from 'vitest';
import type { Response } from 'express';
import { apiAccessPolicy, isPublicApiPath, requiredRolesFor } from '../../server/middleware/apiAccessPolicy';
import type { AuthenticatedRequest } from '../../server/middleware/correlationMiddleware';

/**
 * Deny-by-default access policy — regression cover for CRIT-2 and CRIT-10.
 *
 * requireAuth used to be applied to exactly one router. Checkout, refunds, the
 * ledger, the operations overview and supplier records including payout IBANs
 * all answered anonymous requests. The policy inverted that: anything not
 * explicitly listed as public requires a session.
 *
 * These tests exist mainly to protect the DEFAULT. Someone adding a route is
 * meant to get a 401 if they forget this file — not a data breach. A test that
 * only checked the listed routes would not notice if the default flipped.
 */

type Role = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';

interface Outcome { status: number | null; nexted: boolean; body: unknown }

function run(path: string, method = 'GET', role?: Role): Outcome {
  const outcome: Outcome = { status: null, nexted: false, body: null };
  const req = {
    path,
    method,
    originalUrl: `/api${path}`,
    correlationId: 'test-correlation',
    user: role ? { userId: 'USR-TEST', role } : undefined
  } as unknown as AuthenticatedRequest;

  const res = {
    status(code: number) { outcome.status = code; return this; },
    json(payload: unknown) { outcome.body = payload; return this; }
  } as unknown as Response;

  apiAccessPolicy(req, res, () => { outcome.nexted = true; });
  return outcome;
}

const allow = (o: Outcome) => o.nexted && o.status === null;

describe('public CMS media', () => {
  it('serves an uploaded image to an anonymous visitor', () => {
    expect(allow(run('/media/1791585441163-9160f663-jaz-dahabeya-resort-0.jpg'))).toBe(true);
  });

  it('stays read-only and single-segment', () => {
    expect(allow(run('/media/photo.jpg', 'POST'))).toBe(false);
    expect(allow(run('/media/photo.jpg', 'DELETE'))).toBe(false);
    expect(allow(run('/media/nested/photo.jpg'))).toBe(false);
  });
});

describe('deny by default', () => {
  it('rejects an unlisted route anonymously, so a forgotten route fails closed', () => {
    const o = run('/some/route/nobody/added/to/the/policy');
    expect(o.status).toBe(401);
    expect(allow(o)).toBe(false);
  });

  it('tells the caller an unknown path returns 401 by design, so QA does not chase a session bug', () => {
    const o = run('/some/route/nobody/added/to/the/policy');
    expect(JSON.stringify(o.body)).toMatch(/Unknown \/api paths/i);
  });

  it('rejects anonymous access to the routes that used to leak', () => {
    for (const path of ['/commerce/ledger', '/operations/overview', '/suppliers']) {
      expect(run(path).status, path).toBe(401);
    }
  });

  it('rejects anonymous checkout and refund', () => {
    expect(run('/commerce/checkout', 'POST').status).toBe(401);
    expect(run('/commerce/refund', 'POST').status).toBe(401);
  });

  it('does not leak the caller role back in a 403 body', () => {
    const o = run('/operations/overview', 'GET', 'Traveler');
    expect(o.status).toBe(403);
    expect(JSON.stringify(o.body)).not.toMatch(/Traveler/);
  });
});

describe('role separation', () => {
  const table: Array<[string, Role, boolean]> = [
    ['/commerce/ledger',      'Traveler',   false],
    ['/commerce/ledger',      'Supplier',   false],
    ['/commerce/ledger',      'Operations', true],
    ['/commerce/ledger',      'Admin',      true],
    ['/operations/overview',  'Traveler',   false],
    ['/operations/overview',  'Supplier',   false],
    ['/operations/overview',  'Operations', true],
    ['/suppliers',            'Traveler',   true],
    ['/suppliers',            'Supplier',   true],
    ['/market/refresh',       'Traveler',   false],
    ['/market/refresh',       'Product',    true],
    ['/sms/dispatch',         'Traveler',   false],
    ['/sms/dispatch',         'Operations', true],
    ['/testing/golden-journey', 'Operations', false],
    ['/testing/golden-journey', 'Admin',      true]
  ];

  it.each(table)('%s as %s → %s', (path, role, expected) => {
    const o = run(path, path.startsWith('/testing') ? 'POST' : 'GET', role);
    expect(allow(o)).toBe(expected);
    if (!expected) expect(o.status).toBe(403);
  });

  it('keeps the supplier IBAN surface away from travellers', () => {
    // Listing is now allowed for Traveler (IBAN hiding is enforced in the
    // handler via canSeePayoutDetails). Sub-paths remain gated.
    expect(requiredRolesFor('/suppliers', 'GET')).toContain('Traveler');
    expect(requiredRolesFor('/suppliers/ABC', 'GET')).not.toContain('Traveler');
  });

  it('lets an authenticated traveller reach their own trip, which has no role rule', () => {
    expect(requiredRolesFor('/trip/DHB-TRIP-1')).toBeNull();
    expect(allow(run('/trip/DHB-TRIP-1', 'GET', 'Traveler'))).toBe(true);
  });
});

describe('public allowlist', () => {
  it('lets a visitor sign in, browse and plan without a session', () => {
    expect(allow(run('/auth/login', 'POST'))).toBe(true);
    expect(allow(run('/health'))).toBe(true);
    expect(allow(run('/dahab/places'))).toBe(true);
    expect(allow(run('/telemetry/weather'))).toBe(true);
    expect(allow(run('/commerce/availability', 'POST'))).toBe(true);
    expect(allow(run('/trip/generate', 'POST'))).toBe(true);
  });

  it('does NOT let /dahab/admin through the public knowledge allowlist', () => {
    expect(isPublicApiPath('/dahab/admin/merge', 'GET')).toBe(false);
    expect(run('/dahab/admin/merge').status).toBe(401);
  });

  it('scopes public rules by method: a public GET does not make POST public', () => {
    expect(isPublicApiPath('/dahab/places', 'GET')).toBe(true);
    expect(isPublicApiPath('/dahab/places', 'POST')).toBe(false);
    expect(run('/dahab/places', 'POST').status).toBe(401);
  });

  it('keeps the public inventory rule to a single segment, not a whole subtree', () => {
    expect(isPublicApiPath('/inventory/SKU-1', 'GET')).toBe(true);
    expect(isPublicApiPath('/inventory/SKU-1/secrets', 'GET')).toBe(false);
  });

  it('lets a visitor ask DayGI without a session, and keeps writes private', () => {
    expect(isPublicApiPath('/daygi/query', 'POST')).toBe(true);
    expect(isPublicApiPath('/daygi/query/stream', 'POST')).toBe(true);
    expect(allow(run('/daygi/query', 'POST'))).toBe(true);
    expect(allow(run('/daygi/query/stream', 'POST'))).toBe(true);
    expect(run('/daygi/query', 'GET').status).toBe(401);
    expect(run('/daygi/action/execute', 'POST').status).toBe(401);
    expect(run('/daygi/chats', 'GET').status).toBe(401);
    expect(run('/daygi/share', 'POST').status).toBe(401);
    expect(run('/daygi/beta/track-funnel', 'POST').status).toBe(401);
  });

  it('lets a visitor read the reef badge rubric without a session', () => {
    // Found by the e2e smoke re-run: the handler was public in spirit but had
    // no PUBLIC_RULES entry, so the badge rubric answered 401 anonymously.
    expect(isPublicApiPath('/reef-action-types', 'GET')).toBe(true);
    expect(run('/reef-action-types').status).toBeNull();
  });

  it('keeps bundle mutations away from visitors while the catalogue read and cart calculator are public', () => {
    expect(isPublicApiPath('/bundles', 'GET')).toBe(true);
    expect(isPublicApiPath('/bundles/compute-discount', 'POST')).toBe(true);
    expect(run('/bundles', 'POST').status).toBe(401);
    expect(run('/bundles', 'PATCH').status).toBe(401);
    expect(run('/bundles/BNF-1', 'DELETE').status).toBe(401);
    // Role rules apply once a session exists.
    expect(run('/bundles', 'POST', 'Traveler').status).toBe(403);
    expect(allow(run('/bundles', 'POST', 'Operations'))).toBe(true);
  });

  it('mount-relative role rules now match the support escalation surfaces they name', () => {
    // Regression for the dead /^\/api\/support\/…/ rules: the paths arrive
    // relative to the /api mount, so those patterns never matched and the
    // escalation queue answered any authenticated role.
    expect(requiredRolesFor('/support/escalation-queue')).toEqual(['Operations', 'Admin']);
    expect(requiredRolesFor('/support/counts')).toEqual(['Operations', 'Admin']);
    expect(requiredRolesFor('/support/messages/MSG-1/escalate')).toEqual(['Operations', 'Admin']);
    expect(run('/support/escalation-queue', 'GET', 'Traveler').status).toBe(403);
    expect(requiredRolesFor('/fraud/dashboard')).toEqual(['Admin', 'Operations']);
    expect(requiredRolesFor('/payouts/pending')).toEqual(['Operations', 'Admin']);
  });

  it('keeps /bundles/:id reads on the authenticated default (not role-gated, not public)', () => {
    expect(isPublicApiPath('/bundles/BNF-1', 'GET')).toBe(false);
    // The middleware always passes the method; a GET is not covered by the
    // mutation-only role rule, so bundle views stay on the default.
    expect(requiredRolesFor('/bundles/BNF-1', 'GET')).toBeNull();
    expect(requiredRolesFor('/bundles/BNF-1', 'DELETE')).toEqual(['Admin', 'Operations']);
    expect(run('/bundles/BNF-1', 'GET', 'Traveler').nexted).toBe(true);
  });
});
