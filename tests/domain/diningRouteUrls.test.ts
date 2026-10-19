import { describe, it, expect } from 'vitest';
import {
  isKnownClientPath,
  routeFromUrl,
  urlFromRoute,
  ROUTES
} from '../../src/lib/routeUrl';

/**
 * A shareable venue URL is the difference between "a menu" and "a page you can
 * send someone". Two ways that breaks, both silent in dev:
 *
 *  1. SLUG_PREFIXES is the list the PRODUCTION server uses to decide whether a
 *     path is a real client path or a typo. Miss '/restaurants/' and the server
 *     answers HTTP 404 for a menu that renders perfectly on the client — a
 *     failure that only appears after deploy.
 *  2. The slug has to survive a refresh, which is what routeFromUrl owns.
 */

describe('restaurant venue URLs', () => {
  it('builds /restaurants/:slug', () => {
    expect(urlFromRoute('/restaurants', { venueSlug: 'ali-baba-waterfront-seafood' })).toBe(
      '/restaurants/ali-baba-waterfront-seafood'
    );
  });

  it('reads the slug back, so a refresh keeps the menu open', () => {
    const parsed = routeFromUrl('/restaurants/ali-baba-waterfront-seafood');
    expect(parsed.route).toBe('/restaurants');
    expect(parsed.params.venueSlug).toBe('ali-baba-waterfront-seafood');
  });

  it('round-trips a slug through build and parse', () => {
    const url = urlFromRoute('/restaurants', { venueSlug: 'red-cat-artisan-trattoria' });
    expect(routeFromUrl(url).params.venueSlug).toBe('red-cat-artisan-trattoria');
  });

  it('decodes a percent-encoded slug', () => {
    // A slug arriving from a pasted link is still percent-encoded here.
    expect(routeFromUrl('/restaurants/three%20pools').params.venueSlug).toBe('three pools');
  });

  it('is a KNOWN client path, so production serves it instead of 404', () => {
    // This is the exact list server.ts consults via isKnownClientPath before
    // falling back to the SPA. Omitting '/restaurants/' breaks the deployed app
    // only, which is why it is asserted rather than assumed.
    expect(isKnownClientPath('/restaurants')).toBe(true);
    expect(isKnownClientPath('/restaurants/ali-baba-waterfront-seafood')).toBe(true);
  });

  it('still 404s a genuine typo under /restaurants', () => {
    // A trailing slash is the LIST page, not a broken venue: it normalizes to
    // '/restaurants', which is a real route. What must NOT resolve is a path
    // with no slug separator at all.
    expect(isKnownClientPath('/restaurants/')).toBe(true);
    expect(isKnownClientPath('/restaurantsfoo')).toBe(false);
  });

  it('lets a multi-segment path through to the client, like every other slug', () => {
    // Documented limitation, not an endorsement: isKnownClientPath only checks
    // the prefix, so '/restaurants/one/two' is "known" and the SPA answers it.
    // The client then parses slug 'one/two', the API 404s the venue, and the
    // view renders its own not-found state — so the traveler still gets a
    // truthful answer, just with a 200 from the server. Tightening this would
    // change hotels/rentals/experiences too, so it is Phase 3+ work, not a
    // dining-specific fix.
    expect(isKnownClientPath('/restaurants/one/two')).toBe(true);
    expect(routeFromUrl('/restaurants/one/two').params.venueSlug).toBe('one/two');
  });

  it('does not swallow the sibling routes', () => {
    expect(routeFromUrl('/hotels/x').params.hotelSlug).toBe('x');
    expect(routeFromUrl('/rentals/y').params.rentalSlug).toBe('y');
    expect(routeFromUrl('/preview/tok').params.previewToken).toBe('tok');
    expect(routeFromUrl('/restaurants').params.venueSlug).toBeUndefined();
  });

  it('lists /restaurants in the route table', () => {
    expect(ROUTES).toContain('/restaurants');
  });

  it('sends an unknown sub-path to /404 rather than the homepage', () => {
    // The menu being gone must not silently render the homepage, which would
    // also poison SEO for the wrong URL.
    expect(routeFromUrl('/restaurants').route).toBe('/restaurants');
    expect(routeFromUrl('/nowhere').route).toBe('/404');
  });
});