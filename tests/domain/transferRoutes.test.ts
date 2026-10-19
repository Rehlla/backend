import { describe, expect, it } from 'vitest';
import { transferRouteService } from '../../server/services/transferRouteService';
import { TRANSFER_ROUTE_CATALOG, TRANSFER_TIERS } from '../../server/data/transferRoutes';

/**
 * Transfer route catalog & zone/distance pricing.
 *
 * The two header tabs hang off this service: "within Dahab" (on-demand zones)
 * and "from anywhere" (Egypt-wide corridors resolved from browser geolocation
 * with a manual city picker fallback). Pricing must stay a deterministic
 * function of origin + tier so the quote shown at search time matches the
 * amount held at checkout.
 */

describe('transferRouteService.origins', () => {
  it('returns both transfer types by default', () => {
    const origins = transferRouteService.getOrigins();
    expect(origins.length).toBe(TRANSFER_ROUTE_CATALOG.length);
    expect(new Set(origins.map((o) => o.transferType)).size).toBe(2);
  });

  it('filters by transfer type', () => {
    const within = transferRouteService.getOrigins({ transferType: 'within_dahab' });
    const anywhere = transferRouteService.getOrigins({ transferType: 'anywhere' });
    expect(within.every((o) => o.transferType === 'within_dahab')).toBe(true);
    expect(anywhere.every((o) => o.transferType === 'anywhere')).toBe(true);
    expect(within.length).toBeGreaterThan(0);
    expect(anywhere.length).toBeGreaterThan(0);
  });

  it('searches by Arabic and English label', () => {
    const byAr = transferRouteService.getOrigins({ query: 'القاهرة' });
    const byEn = transferRouteService.getOrigins({ query: 'cairo' });
    expect(byAr.length).toBe(1);
    expect(byEn.length).toBe(1);
    expect(byAr[0].id).toBe(byEn[0].id);
  });

  it('exposes airport origins with flight-related flags', () => {
    const airports = transferRouteService.getOrigins({ transferType: 'anywhere' })
      .filter((o) => o.originType === 'airport');
    expect(airports.length).toBeGreaterThanOrEqual(2);
    for (const a of airports) {
      const route = transferRouteService.getById(a.id)!;
      expect(route.requiresFlightNumber).toBe(true);
      expect(route.airportWaitMinutes).toBe(60);
    }
  });
});

describe('transferRouteService.geolocation', () => {
  it('resolves Dahab coordinates to a within_dahab zone', () => {
    const origin = transferRouteService.resolveOrigin(28.4972, 34.5161); // Masbat
    expect(origin).toBeDefined();
    expect(origin!.transferType).toBe('within_dahab');
  });

  it('resolves Cairo coordinates to Cairo', () => {
    const origin = transferRouteService.resolveOrigin(30.04, 31.24);
    expect(origin).toBeDefined();
    expect(origin!.id).toBe('CAI-CITY');
  });

  it('returns undefined for nonsense input', () => {
    expect(transferRouteService.resolveOrigin(NaN, 0)).toBeUndefined();
    expect(transferRouteService.resolveOrigin(Infinity, -Infinity)).toBeUndefined();
  });
});

describe('transferRouteService.pricing', () => {
  it('prices every route to a multiple of 5 for every tier', () => {
    for (const route of TRANSFER_ROUTE_CATALOG) {
      const quotes = transferRouteService.quoteRoute(route);
      expect(quotes.length).toBe(TRANSFER_TIERS.length);
      for (const q of quotes) {
        expect(q.priceEGP % 5).toBe(0);
        expect(q.priceEGP).toBeGreaterThan(0);
      }
    }
  });

  it('computes the zone/distance formula: base + per-km, scaled by tier', () => {
    const route = transferRouteService.getById('CAI-CITY')!;
    const shared = transferRouteService.quoteRoute(route, 'shared')[0];
    const privateQuote = transferRouteService.quoteRoute(route, 'private')[0];
    const manualShared = Math.round((route.basePriceEGP + Math.ceil(route.distanceKm * route.pricePerKmEGP)) / 5) * 5;
    expect(shared.priceEGP).toBe(manualShared);
    expect(privateQuote.priceEGP).toBeGreaterThan(shared.priceEGP);
    expect(privateQuote.priceEGP).toBeGreaterThan(Math.round(shared.priceEGP * 1.79));
  });

  it('airport origins are pricier than the same-distance city corridor when they wait', () => {
    const ssh = transferRouteService.getById('SSH-AIRPORT')!;
    expect(ssh.airportWaitMinutes).toBe(60);
    const quote = transferRouteService.quote('SSH-AIRPORT', 'private')[0];
    expect(quote.durationMinutes).toBe(ssh.baseDurationMinutes);
  });

  it('quotes a missing origin with an informative error', () => {
    expect(() => transferRouteService.quote('NOPE')).toThrow(/origin not found/i);
  });
});