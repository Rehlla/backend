import { describe, it, expect } from 'vitest';
import { isPublicApiPath, requiredRolesFor } from '../../server/middleware/apiAccessPolicy';

/**
 * The dining access policy, asserted rather than read.
 *
 * apiAccessPolicy is deny-by-default and its rule list is ordered
 * (requiredRolesFor takes the FIRST match), so two mistakes are easy and
 * invisible: a pattern that accidentally makes an order endpoint public, or a
 * broad pattern declared before the narrow one and swallowing it. A traveler
 * reading someone else's order, or a Traveler advancing an order through its
 * states, are both silent failures of that ordering.
 */

const publicPaths: Array<[string, string]> = [
  ['GET', '/dining/venues'],
  ['GET', '/dining/venues/ali-baba-waterfront-seafood'],
  ['GET', '/dining/delivery-zones'],
  ['POST', '/dining/quote']
];

const authenticatedPaths = ['/dining/orders', '/dining/orders/DNG-ABC-2026-DEF012'];

describe('dining public surface', () => {
  it('lets a traveler price a dinner before they have an account', () => {
    for (const [method, path] of publicPaths) {
      expect(isPublicApiPath(path, method), `${method} ${path}`).toBe(true);
      expect(requiredRolesFor(path, method), `${method} ${path}`).toBeNull();
    }
  });

  it('does not publish anything about an order', () => {
    // Every one of these is deny-by-default and must stay that way.
    for (const path of authenticatedPaths) {
      expect(isPublicApiPath(path, 'GET'), `GET ${path}`).toBe(false);
      expect(isPublicApiPath(path, 'POST'), `POST ${path}`).toBe(false);
    }
    expect(isPublicApiPath('/dining/orders/DNG-ABC-2026-DEF012/status', 'POST')).toBe(false);
    expect(isPublicApiPath('/dining/orders/DNG-ABC-2026-DEF012/cancel', 'POST')).toBe(false);
  });

  it('reserves the status transition for operations', () => {
    expect(requiredRolesFor('/dining/orders/DNG-ABC-2026-DEF012/status', 'POST')).toEqual([
      'Operations',
      'Admin'
    ]);
    // Cancellation is the traveler's own action: any signed-in role may call it,
    // and ownership is enforced in the service, not here.
    expect(requiredRolesFor('/dining/orders/DNG-ABC-2026-DEF012/cancel', 'POST')).toBeNull();
  });

  it('leaves a Supplier out of operations until a restaurant portal exists', () => {
    // Phase 4 opens this. Until then it is deliberately not in the list.
    const roles = requiredRolesFor('/dining/orders/DNG-ABC-2026-DEF012/status', 'POST');
    expect(roles).not.toContain('Supplier');
  });

  it('does not let a broad dining pattern swallow the ops route', () => {
    // Regression guard for rule ORDER: if a catch-all /^\/dining\// roles entry
    // were ever added above the status rule, this fails.
    expect(requiredRolesFor('/dining/orders/some-id/status', 'POST')).toEqual([
      'Operations',
      'Admin'
    ]);
    expect(requiredRolesFor('/dining/orders/some-id', 'GET')).toBeNull();
  });
});