import { describe, expect, it } from 'vitest';
import {
  ROUTES,
  isAppRoute,
  isKnownClientPath,
  routeFromUrl,
  urlFromRoute
} from '../../src/lib/routeUrl';

/**
 * Navigation used to be pure React state: navigateTo set currentRoute and the
 * address bar never moved. Back left the app, refresh dropped the traveler on
 * the homepage, nothing could be linked, and MyTripView's share button copied
 * window.location.href — the homepage URL, for every trip.
 *
 * These cover the translation both ways. The round-trip case is the one that
 * matters most: if urlFromRoute and routeFromUrl ever disagree, a link works
 * when clicked and breaks when reopened.
 */

describe('route <-> URL translation', () => {
  it('round-trips every route in the union', () => {
    for (const route of ROUTES) {
      const url = urlFromRoute(route);
      const [pathname, search = ''] = url.split('?');
      expect(routeFromUrl(pathname, search).route).toBe(route);
    }
  });

  it('round-trips a route carrying every selection parameter', () => {
    const url = urlFromRoute('/my-trip', { dayId: 3, activityId: 'act-2-2', bookingId: 'b-hotel-1' });
    const [pathname, search] = url.split('?');

    expect(routeFromUrl(pathname, search)).toEqual({
      route: '/my-trip',
      params: { dayId: 3, activityId: 'act-2-2', bookingId: 'b-hotel-1' }
    });
  });

  it('keeps the pathname exactly equal to the route so matching stays a lookup', () => {
    expect(urlFromRoute('/my-trip/day', { dayId: 3 })).toBe('/my-trip/day?day=3');
    expect(urlFromRoute('/bookings', { bookingId: 'b-safari-1' })).toBe('/bookings?booking=b-safari-1');
  });

  it('emits a bare path when there is nothing to select', () => {
    expect(urlFromRoute('/explore')).toBe('/explore');
    expect(urlFromRoute('/explore', {})).toBe('/explore');
  });

  it('percent-encodes ids rather than breaking the query string', () => {
    const url = urlFromRoute('/bookings', { bookingId: 'DHB TRIP&894' });
    const [pathname, search] = url.split('?');
    expect(search).not.toContain(' ');
    expect(routeFromUrl(pathname, search).params.bookingId).toBe('DHB TRIP&894');
  });

  it('round-trips CMS preview tokens without stripping them', () => {
    // Regression: the canonical-URL effect rebuilt '/preview/:token' via
    // urlFromRoute without token support, silently downgrading every shared
    // preview link to a bare /preview that renders "expired".
    const url = urlFromRoute('/preview', { previewToken: 'PREV-abc-123' });
    expect(url).toBe('/preview/PREV-abc-123');
    const parsed = routeFromUrl('/preview/PREV-abc-123');
    expect(parsed.route).toBe('/preview');
    expect(parsed.params.previewToken).toBe('PREV-abc-123');
  });

  it('routes unknown paths to a real 404 instead of the homepage', () => {
    // A typo or stale link used to silently render the homepage, hiding
    // breakage and poisoning SEO. Unknown paths now explain themselves.
    expect(routeFromUrl('/not-a-real-page').route).toBe('/404');
    expect(routeFromUrl('/../etc/passwd').route).toBe('/404');
    expect(routeFromUrl('').route).toBe('/404');
    expect(urlFromRoute('/404')).toBe('/404');
  });

  it('distinguishes shareable deep links from typos', () => {
    // Canonical detail URLs must survive; everything else 404s.
    expect(isKnownClientPath('/')).toBe(true);
    expect(isKnownClientPath('/explore')).toBe(true);
    expect(isKnownClientPath('/programs/dahab-first-timer')).toBe(true);
    expect(isKnownClientPath('/hotels/some-slug')).toBe(true);
    expect(isKnownClientPath('/rentals/abc')).toBe(true);
    expect(isKnownClientPath('/preview/PREV-1')).toBe(true);
    expect(isKnownClientPath('/explor/xyz')).toBe(false);
    expect(isKnownClientPath('/not-a-real-page')).toBe(false);
    expect(isKnownClientPath('/admin')).toBe(false);
  });

  it('treats a trailing slash as the same page, but keeps root as root', () => {
    expect(routeFromUrl('/explore/').route).toBe('/explore');
    expect(routeFromUrl('/my-trip/day/').route).toBe('/my-trip/day');
    expect(routeFromUrl('/').route).toBe('/');
  });

  it('drops a non-integer day rather than producing a NaN id', () => {
    // A NaN dayId compares false against every real day, so the page would
    // render as though nothing were selected and give no clue why.
    expect(routeFromUrl('/my-trip/day', 'day=abc').params.dayId).toBeUndefined();
    expect(routeFromUrl('/my-trip/day', 'day=2.5').params.dayId).toBeUndefined();
    expect(routeFromUrl('/my-trip/day', 'day=0').params.dayId).toBe(0);
    expect(routeFromUrl('/my-trip/day', 'day=-1').params.dayId).toBe(-1);
  });

  it('round-trips a party detail and leaves the admin page alone', () => {
    const url = urlFromRoute('/parties', { partySlug: 'full-moon' });
    expect(url).toBe('/parties/full-moon');
    expect(routeFromUrl('/parties/full-moon')).toEqual({ route: '/parties', params: { partySlug: 'full-moon' } });
    expect(routeFromUrl('/parties/admin')).toEqual({ route: '/parties/admin', params: {} });
    expect(isKnownClientPath('/parties/full-moon')).toBe(true);
  });

  it('omits absent parameters instead of reporting empty ones', () => {
    expect(routeFromUrl('/bookings', 'booking=').params).toEqual({});
    expect(routeFromUrl('/explore').params).toEqual({});
  });

  it('recognises exactly the routes in the union', () => {
    expect(isAppRoute('/departure')).toBe(true);
    expect(isAppRoute('/auth/sign-in')).toBe(true);
    expect(isAppRoute('/departures')).toBe(false);
    expect(isAppRoute('/DEPARTURE')).toBe(false);
  });

  it('covers every route the app can navigate to', () => {
    // Guards the reverse drift from the compile-time check in routeUrl.ts: a
    // route present in the union but unreachable by URL would 404 to /home.
    expect(new Set(ROUTES).size).toBe(ROUTES.length);
    for (const r of ['/home', '/my-trip', '/bookings', '/departure', '/post-trip', '/profile'] as const) {
      expect(ROUTES).toContain(r);
    }
  });
});
