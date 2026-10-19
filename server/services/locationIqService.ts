/**
 * Reverse geocoding via LocationIQ for the "From anywhere in Egypt" transfer
 * tab.
 *
 * The browser hands us only a lat/lng. Before this service, the hub resolved it
 * to the nearest known transfer origin with a haversine match — good for
 * pricing, but it couldn't tell the traveler *where* the coordinate actually
 * was. LocationIQ turns a coordinate into a readable city (e.g. "القاهرة /
 * Cairo, Cairo Governorate") so the hub can show a meaningful "Detected"
 * label while still pricing from the nearest served origin.
 *
 * The key is optional, matching the rest of this deployment: when
 * LOCATIONIQ_API_KEY is unset, or the call fails or times out, this returns
 * null and the hub falls back to plain nearest-origin matching. It never
 * fabricates a location.
 */

// Read lazily, NOT at module scope — module-level env reads run before
// server.ts calls dotenv.config() (see the note in daygiReasoningService).
function locationIqKey(): string {
  return process.env.LOCATIONIQ_API_KEY || '';
}

const REQUEST_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface DetectedPlace {
  /** Human-readable city, e.g. "Cairo" or "Sharm El Sheikh". */
  label: string;
  /** Arabic-ish label kept bare when LocationIQ has none. */
  labelAr?: string;
  region: string;
  displayName: string;
  latitude: number;
  longitude: number;
  /** iso country code; only Egypt is considered a served location. */
  countryCode?: string;
}

interface LocationIqAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  state_district?: string;
  country?: string;
  country_code?: string;
}

interface LocationIqReverseResponse {
  address?: LocationIqAddress;
  display_name?: string;
  lat?: string;
  lon?: string;
}

let cache: { key: string; at: number; value: DetectedPlace } | null = null;

/** Best-effort city/region label from a LocationIQ address block. */
function labelFromAddress(address: LocationIqAddress): { label: string; region: string } | null {
  const label =
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    (address.state_district !== address.state ? address.state_district : undefined);
  if (!label) return null;
  const region = address.state || address.county || '';
  return { label, region };
}

export class LocationIqService {
  /**
   * Reverse-geocode a coordinate, or null when the key is missing, the request
   * fails, or the result is not in Egypt.
   */
  public async reverseGeocode(lat: number, lng: number, acceptLanguage = 'en'): Promise<DetectedPlace | null> {
    const apiKey = locationIqKey();
    if (!apiKey || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const key = `${lat.toFixed(5)},${lng.toFixed(5)},${acceptLanguage}`;
    if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const params = new URLSearchParams({
        key: apiKey,
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        'accept-language': acceptLanguage,
        zoom: '10'
      });
      const response = await fetch(`https://us1.locationiq.com/v1/reverse?${params.toString()}`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as LocationIqReverseResponse;
      if (!payload.address) return null;
      if (payload.address.country_code !== 'eg') return null;

      const name = labelFromAddress(payload.address);
      if (!name) return null;

      const place: DetectedPlace = {
        label: name.label,
        labelAr: acceptLanguage === 'ar' ? name.label : undefined,
        region: name.region,
        displayName: payload.display_name || name.label,
        latitude: Number(payload.lat) || lat,
        longitude: Number(payload.lon) || lng,
        countryCode: payload.address.country_code
      };

      cache = { key, at: Date.now(), value: place };
      return place;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const locationIqService = new LocationIqService();
