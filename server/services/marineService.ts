import type { ActivityDetailEntity } from '../db/schema';

/**
 * Modeled sea state for Dahab, from the Open-Meteo marine model.
 *
 * Read the weather-service docblock before touching this file: this product
 * once displayed invented visibility/swell/tide numbers, and on a page divers
 * read before entering the water that is the most consequential fabrication
 * it can ship. So the rules are strict:
 *
 * - Everything here is a MODEL OUTPUT, labeled as such (`kind: 'model'`,
 *   `source: 'Open-Meteo marine model'`). It is never presented as an
 *   observation, never given a GREEN_ALL_CLEAR-style verdict, and never mixed
 *   into the observation readings without the label traveling with it.
 * - Suitability verdicts come from WRITTEN SOURCES ONLY: the activity's own
 *   `environmentalSensitivities.maxWindKnots` first, then the bands in
 *   docs/research/DAHAB_WATER_WIND_ENVIRONMENT.md (18 kn outer-reef chop,
 *   20 kn Lighthouse shelter, 22 kn boat-transfer restriction, 12–28 kn
 *   Laguna kite window). Wave heights are DISPLAYED, never judged — no
 *   research in this repo grounds a wave threshold, and inventing one would
 *   repeat the original sin with better data.
 * - Null, not fallback, when the upstream cannot be read.
 */

const DAHAB = { lat: 28.48, lng: 34.51 };
const ENDPOINT =
  'https://marine-api.open-meteo.com/v1/marine' +
  `?latitude=${DAHAB.lat}&longitude=${DAHAB.lng}` +
  '&current=wave_height,wind_wave_height,swell_wave_height,water_temperature' +
  '&hourly=swell_wave_direction,swell_wave_period' +
  '&timezone=Africa%2FCairo&forecast_days=1';

const REQUEST_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface MarineReading {
  observedAt: string;
  source: string;
  kind: 'model';
  waveHeightM: number | null;
  windWaveM: number | null;
  swellWaveM: number | null;
  swellDirectionDegrees: number | null;
  swellPeriodSeconds: number | null;
  waterTempC: number | null;
}

export type SuitabilityVerdict = 'go' | 'caution' | 'avoid';

export interface SuitabilityReason {
  en: string;
  ar: string;
}

export interface ActivitySuitability {
  verdict: SuitabilityVerdict;
  reasons: SuitabilityReason[];
}

interface CacheEntry {
  at: number;
  value: MarineReading;
}

let cache: CacheEntry | null = null;

interface OpenMeteoMarineResponse {
  current?: {
    time?: string;
    wave_height?: number;
    wind_wave_height?: number;
    swell_wave_height?: number;
    water_temperature?: number;
  };
  hourly?: {
    time?: string[];
    swell_wave_direction?: (number | null)[];
    swell_wave_period?: (number | null)[];
  };
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

/** Categories this engine judges. Everything else is out of scope, not "go". */
export function isWaterActivity(category: string): boolean {
  return category === 'diving' || category === 'water_sport';
}

/**
 * Suitability of one water activity under measured wind.
 *
 * Priority order (documented, do not reorder casually):
 * 1. The activity's own maxWindKnots — recorded per activity, beats any band.
 * 2. Research bands: kite 12–28 kn go (Laguna cross-shore window);
 *    diving/snorkel go at or under 18 kn, caution to 22 kn (boat-transfer
 *    restriction), avoid above; Lighthouse Bay tolerates +2 kn of shelter.
 */
export function assessActivity(
  activity: Pick<ActivityDetailEntity, 'category' | 'areaId' | 'titleEn'> & {
    environmentalSensitivities?: { maxWindKnots?: number };
  },
  windKnots: number
): ActivitySuitability {
  const reasons: SuitabilityReason[] = [];
  const explicitLimit = activity.environmentalSensitivities?.maxWindKnots;
  const isKite = activity.category !== 'diving';

  let limit: number;
  let limitSource: string;
  if (typeof explicitLimit === 'number' && Number.isFinite(explicitLimit) && explicitLimit > 0) {
    limit = explicitLimit;
    limitSource = 'activity';
  } else if (isKite) {
    limit = 28;
    limitSource = 'laguna-window';
  } else {
    // Outer-reef chop note (18 kn); Lighthouse headland shelter (+2 kn).
    limit = activity.areaId?.toLowerCase() === 'lighthouse' ? 20 : 18;
    limitSource = 'research';
  }

  if (isKite && windKnots < 12) {
    reasons.push({
      en: `Light wind at ${windKnots} kn — ridable for foils and lessons, marginal for twin-tips (clean window starts near 12 kn).`,
      ar: `رياح خفيفة ${windKnots} عقدة — مناسبة للفويل والدروس، وهامشية للتوين تيب (النافذة النظيفة تبدأ قرب 12 عقدة).`,
    });
    return { verdict: 'caution', reasons };
  }

  if (windKnots <= limit) {
    if (isKite) {
      reasons.push({
        en: `Wind ${windKnots} kn sits inside the 12–28 kn Laguna cross-shore window.`,
        ar: `الرياح ${windKnots} عقدة داخل نافذة اللاجونا (12–28 عقدة).`,
      });
    } else {
      reasons.push({
        en:
          limitSource === 'activity'
            ? `Wind ${windKnots} kn is within this activity's ${limit} kn limit.`
            : `Wind ${windKnots} kn is within the ${limit} kn ${activity.areaId?.toLowerCase() === 'lighthouse' ? 'sheltered-bay' : 'outer-reef'} band.`,
        ar:
          limitSource === 'activity'
            ? `الرياح ${windKnots} عقدة ضمن حد النشاط (${limit} عقدة).`
            : `الرياح ${windKnots} عقدة ضمن النطاق (${limit} عقدة).`,
      });
    }
    return { verdict: 'go', reasons };
  }

  if (windKnots <= limit + 4) {
    reasons.push({
      en: `Wind ${windKnots} kn is above the ${limit} kn comfort band — expect chop on exposed entries; sheltered bays stay calmer.`,
      ar: `الرياح ${windKnots} عقدة فوق النطاق المريح (${limit} عقدة) — توقع تموجات عند المداخل المكشوفة، والخلجان المحمية أهدأ.`,
    });
    return { verdict: 'caution', reasons };
  }

  reasons.push({
    en: `Wind ${windKnots} kn exceeds the ${limit} kn limit — boat transfers to outer reefs are restricted; dive sheltered bays or stand down.`,
    ar: `الرياح ${windKnots} عقدة تتجاوز الحد (${limit} عقدة) — انتقالات القوارب للشعاب الخارجية مقيدة؛ اختر الخلجان المحمية أو أجل الغوص.`,
  });
  return { verdict: 'avoid', reasons };
}

export class MarineService {
  /**
   * Current modeled sea state, or null when the upstream could not be read.
   * Null, never a fallback object — same contract as weatherService.
   */
  public async getCurrentReading(): Promise<MarineReading | null> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(ENDPOINT, { signal: controller.signal });
      if (!response.ok) return null;

      const payload = (await response.json()) as OpenMeteoMarineResponse;
      const current = payload.current;
      if (!current) return null;

      const waveHeightM = numOrNull(current.wave_height);
      // A model run with no wave field at all is not a calm sea — it is a
      // missing model run. Calm (0.0) and unknown (null) must never merge.
      if (waveHeightM === null && numOrNull(current.wind_wave_height) === null && numOrNull(current.swell_wave_height) === null) {
        return null;
      }

      const value: MarineReading = {
        observedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
        source: 'Open-Meteo marine model',
        kind: 'model',
        waveHeightM,
        windWaveM: numOrNull(current.wind_wave_height),
        swellWaveM: numOrNull(current.swell_wave_height),
        swellDirectionDegrees: null,
        swellPeriodSeconds: null,
        waterTempC: numOrNull(current.water_temperature),
      };

      const times = payload.hourly?.time;
      if (times && current.time) {
        const hour = current.time.slice(0, 13);
        const index = times.findIndex(t => t.startsWith(hour));
        if (index !== -1) {
          const dir = payload.hourly?.swell_wave_direction?.[index];
          const period = payload.hourly?.swell_wave_period?.[index];
          value.swellDirectionDegrees = typeof dir === 'number' ? Math.round(dir) : null;
          value.swellPeriodSeconds = typeof period === 'number' ? Math.round(period * 10) / 10 : null;
        }
      }

      cache = { at: Date.now(), value };
      return value;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Test seam. */
  public clearCache(): void {
    cache = null;
  }
}

export const marineService = new MarineService();
