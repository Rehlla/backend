/**
 * Real conditions for Dahab, from a real observation source.
 *
 * `/api/telemetry/weather` used to return a fixed object — 28°C air, 24°C
 * water, 14 knots NE, 28m visibility, "GREEN_ALL_CLEAR" — stamped with a live
 * `timestamp` and `freshness: '2 mins ago'`. Those two fields are what made it
 * read as measured: the numbers never moved, but the page said they had just
 * been taken. The homepage's conditions strip, Dahab Live's spot panels and
 * DayGI's grounding all consumed it.
 *
 * Open-Meteo is used because it needs no API key and no account, which is the
 * only kind of source this deployment can actually reach — the project has keys
 * for Gemini and nothing else. When the request fails the endpoint says so
 * rather than substituting the old fixed numbers, because a stale reading
 * presented as current is the problem being fixed.
 */

/**
 * Where each destination's conditions are read. Siwa is inland, so its sea
 * temperature comes back null and the UI shows air, wind and sunset only.
 */
export const WEATHER_LOCATIONS = {
  dahab: { lat: 28.5097, lng: 34.5136 },
  nuweiba: { lat: 28.98, lng: 34.66 },
  siwa: { lat: 29.2032, lng: 25.5195 },
} as const;
export type WeatherLocation = keyof typeof WEATHER_LOCATIONS;

const endpointFor = (where: WeatherLocation) => {
  const { lat, lng } = WEATHER_LOCATIONS[where];
  return (
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lng}` +
    '&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code' +
    '&hourly=sea_surface_temperature' +
    '&daily=sunrise,sunset' +
    '&timezone=Africa%2FCairo&forecast_days=1'
  );
};

/** Long enough for a slow upstream, short enough not to hold a page load. */
const REQUEST_TIMEOUT_MS = 6000;
/** The upstream publishes every 15 minutes; asking more often gains nothing. */
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface DahabConditions {
  observedAt: string;
  source: string;
  airTemperatureC: number;
  feelsLikeC: number;
  /** Sea surface temperature for the current hour. Null when unpublished. */
  waterTemperatureC: number | null;
  windKnots: number;
  windDirection: string;
  windDirectionDegrees: number;
  /** WMO weather code, and the plain description of it. */
  weatherCode: number;
  condition: string;
  conditionAr: string;
  sunrise: string | null;
  sunset: string | null;
}

interface CacheEntry {
  at: number;
  value: DahabConditions;
}

const cache = new Map<WeatherLocation, CacheEntry>();

/** 350° is N, not "NNW" — sixteen points, so the label matches the degrees. */
export function compassPoint(degrees: number): string {
  const points = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return points[index];
}

/** The upstream reports km/h; every surface in this product speaks knots. */
export function kmhToKnots(kmh: number): number {
  return Math.round(kmh * 0.539957 * 10) / 10;
}

/** WMO code to something a traveler reads, in both languages. */
export function describeWeatherCode(code: number): { en: string; ar: string } {
  if (code === 0) return { en: 'Clear sky', ar: 'سماء صافية' };
  if (code <= 2) return { en: 'Mostly clear', ar: 'صافية غالبًا' };
  if (code === 3) return { en: 'Overcast', ar: 'غيوم كثيفة' };
  if (code <= 48) return { en: 'Fog', ar: 'شبورة' };
  if (code <= 57) return { en: 'Drizzle', ar: 'رذاذ خفيف' };
  if (code <= 67) return { en: 'Rain', ar: 'مطر' };
  if (code <= 77) return { en: 'Snow', ar: 'ثلج' };
  if (code <= 82) return { en: 'Rain showers', ar: 'زخات مطر' };
  if (code <= 86) return { en: 'Snow showers', ar: 'زخات ثلج' };
  if (code <= 99) return { en: 'Thunderstorm', ar: 'عاصفة رعدية' };
  return { en: 'Unknown', ar: 'غير معروف' };
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    weather_code?: number;
  };
  hourly?: { time?: string[]; sea_surface_temperature?: (number | null)[] };
  daily?: { sunrise?: string[]; sunset?: string[] };
}

/** The sea temperature published for the hour the current reading belongs to. */
function seaTemperatureAt(payload: OpenMeteoResponse, currentTime: string | undefined): number | null {
  const times = payload.hourly?.time;
  const temps = payload.hourly?.sea_surface_temperature;
  if (!times || !temps || !currentTime) return null;

  const hour = currentTime.slice(0, 13);
  const index = times.findIndex(t => t.startsWith(hour));
  if (index === -1) return null;

  const value = temps[index];
  return typeof value === 'number' ? value : null;
}

export class WeatherService {
  /**
   * Current conditions, or null when the upstream could not be read.
   *
   * Null rather than a fallback object on purpose: the caller must decide what
   * to tell the traveler, and the one thing it must not say is a number.
   */
  public async getCurrentConditions(where: WeatherLocation = 'dahab'): Promise<DahabConditions | null> {
    const hit = cache.get(where);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpointFor(where), { signal: controller.signal });
      if (!response.ok) return null;

      const payload = (await response.json()) as OpenMeteoResponse;
      const current = payload.current;
      if (
        !current ||
        typeof current.temperature_2m !== 'number' ||
        typeof current.wind_speed_10m !== 'number'
      ) {
        return null;
      }

      const degrees = typeof current.wind_direction_10m === 'number' ? current.wind_direction_10m : 0;
      const code = typeof current.weather_code === 'number' ? current.weather_code : 0;
      const described = describeWeatherCode(code);

      const value: DahabConditions = {
        observedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
        source: 'Open-Meteo',
        airTemperatureC: Math.round(current.temperature_2m * 10) / 10,
        feelsLikeC:
          typeof current.apparent_temperature === 'number'
            ? Math.round(current.apparent_temperature * 10) / 10
            : Math.round(current.temperature_2m * 10) / 10,
        waterTemperatureC: seaTemperatureAt(payload, current.time),
        windKnots: kmhToKnots(current.wind_speed_10m),
        windDirection: compassPoint(degrees),
        windDirectionDegrees: Math.round(degrees),
        weatherCode: code,
        condition: described.en,
        conditionAr: described.ar,
        sunrise: payload.daily?.sunrise?.[0] ?? null,
        sunset: payload.daily?.sunset?.[0] ?? null
      };

      cache.set(where, { at: Date.now(), value });
      return value;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Test seam. */
  public clearCache(): void {
    cache.clear();
  }
}

export const weatherService = new WeatherService();
