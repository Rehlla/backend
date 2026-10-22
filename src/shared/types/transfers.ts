/**
 * Transfer route & pricing types.
 *
 * Transfers come in two flavours (hence the two header tabs):
 *   - within_dahab : on-demand movement inside Dahab (zones/districts)
 *   - anywhere     : from any origin in Egypt to Dahab (geo-origin based)
 *
 * Pricing uses a zone/distance formula per vehicle tier:
 *   routePrice = basePriceEGP + ceil(distanceKm * pricePerKmEGP)
 *   tierPrice  = round(routePrice * tierMultiplier)
 */

export type TransferType = 'within_dahab' | 'anywhere';

export type TransferOriginType = 'airport' | 'city' | 'dahab_area' | 'dahab';

export type TransferTierId = 'private' | 'shared' | 'premium';

export interface TransferTierDef {
  id: TransferTierId;
  labelEn: string;
  labelAr: string;
  multiplier: number;
  vehicleEn: string;
  vehicleAr: string;
  capacity: number;
  luggageEn: string;
  luggageAr: string;
}

export interface TransferRoute {
  id: string;
  origin: string;
  originEn: string;
  originAr: string;
  originType: TransferOriginType;
  /** Roughly the 7 most significant decimals used for nearest-origin geo matching. */
  latitude: number;
  longitude: number;
  /** Destination city label (almost always Dahab). */
  destination: string;
  destinationEn: string;
  destinationAr: string;
  isWithinDahab: boolean;
  transferType: TransferType;
  distanceKm: number;
  /** Base flag-drop price in EGP before per-km is added. */
  basePriceEGP: number;
  /** Price per kilometre in EGP. */
  pricePerKmEGP: number;
  baseDurationMinutes: number;
  /** Whether airport arrival legs wait 60 min on delayed flights. */
  airportWaitMinutes?: number;
  /** Whether a flight number is relevant/required for this origin. */
  requiresFlightNumber?: boolean;
  active: boolean;
}

export interface TransferRouteQuote {
  route: TransferRoute;
  tier: TransferTierDef;
  priceEGP: number;
  durationMinutes: number;
}

export interface TransferOriginOption {
  id: string;
  labelEn: string;
  labelAr: string;
  originType: TransferOriginType;
  transferType: TransferType;
  latitude: number;
  longitude: number;
  distanceKm: number;
}

/** Readable place named by reverse-geocoding a raw coordinate (LocationIQ). */
export interface TransferDetectedPlace {
  /** Human-readable city, e.g. "Cairo" or "Sharm El Sheikh". */
  label: string;
  labelAr?: string;
  region: string;
  displayName: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  /** The catalog origin chosen for pricing when the coordinate resolves to one. */
  matchedOriginId?: string;
  matchedOriginKm?: number;
}

export interface TransferResolveGeoResponse {
  /** Nearest catalog origin to the coordinate, or null when none is near. */
  origin: TransferOriginOption | null;
  /** LocationIQ reverse-geocode label, or null when the key/fetch failed. */
  detected: TransferDetectedPlace | null;
}
