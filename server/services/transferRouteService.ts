import { TRANSFER_ROUTE_CATALOG, TRANSFER_TIERS } from '../data/transferRoutes';
import { haversineKm } from '../utils/geo';
import type {
  TransferOriginOption,
  TransferRoute,
  TransferRouteQuote,
  TransferTierDef
} from '../../src/shared/types/transfers';

/**
 * Read-only transfer route service: serves the origin catalog, resolves a
 * browser-geolocation coordinate to the nearest origin, and prices a route
 * per tier using the zone/distance formula.
 *
 * Legitimate prices are a multiple of 5 (rounded for EGP). Airport origins
 * guarantee the 60-minute flight-delay wait.
 */
const roundPrice = (n: number) => Math.round(n / 5) * 5;

export class TransferRouteService {
  public getOrigins(filter: { transferType?: 'within_dahab' | 'anywhere'; query?: string } = {}): TransferOriginOption[] {
    let routes = TRANSFER_ROUTE_CATALOG.filter((rt) => rt.active);
    if (filter.transferType) {
      routes = routes.filter((rt) => rt.transferType === filter.transferType);
    }
    if (filter.query && filter.query.trim()) {
      const q = filter.query.trim().toLowerCase();
      routes = routes.filter(
        (rt) =>
          rt.originEn.toLowerCase().includes(q) ||
          rt.originAr.toLowerCase().includes(q)
      );
    }
    return routes.map((rt) => ({
      id: rt.id,
      labelEn: rt.originEn,
      labelAr: rt.originAr,
      originType: rt.originType,
      transferType: rt.transferType,
      latitude: rt.latitude,
      longitude: rt.longitude,
      distanceKm: rt.distanceKm
    }));
  }

  public getById(id: string): TransferRoute | undefined {
    return TRANSFER_ROUTE_CATALOG.find((rt) => rt.id === id && rt.active);
  }

  /**
   * Resolve a browser geolocation coordinate to the nearest active origin.
   * Within-Dahab coordinates resolve to a dahab_area zone; otherwise the
   * nearest Egypt-wide origin wins.
   */
  public resolveOrigin(latitude: number, longitude: number): TransferOriginOption | undefined {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    const nearest = TRANSFER_ROUTE_CATALOG
      .filter((rt) => rt.active)
      .map((rt) => ({
        rt,
        km: haversineKm(latitude, longitude, rt.latitude, rt.longitude)
      }))
      .sort((a, b) => a.km - b.km);

    if (nearest.length === 0) return undefined;
    return {
      id: nearest[0].rt.id,
      labelEn: nearest[0].rt.originEn,
      labelAr: nearest[0].rt.originAr,
      originType: nearest[0].rt.originType,
      transferType: nearest[0].rt.transferType,
      latitude: nearest[0].rt.latitude,
      longitude: nearest[0].rt.longitude,
      distanceKm: nearest[0].rt.distanceKm
    };
  }

  public getTier(id: TransferTierDef['id']): TransferTierDef {
    return TRANSFER_TIERS.find((t) => t.id === id) || TRANSFER_TIERS[0];
  }

  public getTiers(): TransferTierDef[] {
    return TRANSFER_TIERS;
  }

  /**
   * Quote a single route for all tiers (or one tier).
   * routePrice = base + ceil(distanceKm * perKm); tier price = round(routePrice * multiplier).
   * Airport origins always carry the flight-delay wait.
   */
  public quoteRoute(route: TransferRoute, tierId?: TransferTierDef['id']): TransferRouteQuote[] {
    const basePrice = route.basePriceEGP + Math.ceil(route.distanceKm * route.pricePerKmEGP);
    const tiers = tierId ? [this.getTier(tierId)] : TRANSFER_TIERS;
    return tiers.map((tier) => ({
      route,
      tier,
      priceEGP: roundPrice(basePrice * tier.multiplier),
      durationMinutes: route.baseDurationMinutes
    }));
  }

  public quote(originId: string, tierId?: TransferTierDef['id']): TransferRouteQuote[] {
    const route = this.getById(originId);
    if (!route) throw new Error(`Transfer origin not found: ${originId}`);
    return this.quoteRoute(route, tierId);
  }
}

export const transferRouteService = new TransferRouteService();
