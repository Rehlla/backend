import { generateText, isLlmConfigured } from './llm/client';
import { isQuotaExhausted } from './llm/quota';
import { AccommodationSearchFilters } from '../db/schema';
import { db } from '../db/database';
import type { ParsedSearchIntent } from '../../src/shared/types/context';

/**
 * Provider-neutral name: this was `geminiReasoningService` and used
 * `@google/genai`. The shape did not change — a deterministic parse first, the
 * model only refines it, and every failure falls back to the parse.
 */

export type { ParsedSearchIntent } from '../../src/shared/types/context';

export class AiReasoningService {
  /**
   * Parse ambiguous traveler search prompt into structured intent
   */
  public async parseTravelerSearchIntent(
    userPrompt: string
  ): Promise<ParsedSearchIntent> {
    const ai = isLlmConfigured();

    // Deterministic rule-based fallback if the model is unavailable or the
    // prompt is standard
    const lower = userPrompt.toLowerCase();
    const fallbackIntent: ParsedSearchIntent = {
      activityCategory: lower.includes('غوص') || lower.includes('dive') || lower.includes('سنوركل')
        ? 'diving'
        : lower.includes('صحراء') || lower.includes('سفاري') || lower.includes('safari') || lower.includes('wadi')
        ? 'desert'
        : lower.includes('أكل') || lower.includes('food') || lower.includes('مطعم')
        ? 'food'
        : 'general',
      maxDurationMinutes: lower.includes('ساعتين') || lower.includes('2 hours')
        ? 120
        : lower.includes('ساعة') || lower.includes('1 hour')
        ? 60
        : 180,
      locationPreference: lower.includes('بلو هول') || lower.includes('blue hole')
        ? 'blue_hole'
        : lower.includes('كانيون') || lower.includes('canyon')
        ? 'canyon'
        : lower.includes('لاجون') || lower.includes('laguna')
        ? 'laguna'
        : 'nearby',
      budgetLevel: 'moderate',
      timeSlot: lower.includes('غروب') || lower.includes('sunset')
        ? 'sunset'
        : lower.includes('صباح') || lower.includes('morning')
        ? 'morning'
        : 'now',
      confidence: 0.92,
    };

    // Nothing to gain from a call that will be refused, and it is not free:
    // the SDK waits out the API's retry-after inside the request.
    if (!ai || isQuotaExhausted()) return fallbackIntent;

    try {
      const response = await generateText({
        temperature: 0.1,
        json: true,
        prompt: `You are Dahab's background search intent parser. Analyze the user's inquiry:
"${userPrompt}"

Return ONLY valid JSON matching this schema:
{
  "activityCategory": "diving" | "desert" | "relaxation" | "food" | "general",
  "maxDurationMinutes": number (default 120),
  "locationPreference": "nearby" | "blue_hole" | "canyon" | "laguna" | "any",
  "budgetLevel": "budget" | "moderate" | "premium",
  "timeSlot": "now" | "morning" | "sunset" | "night",
  "confidence": number
}`
      });

      if (!response) return fallbackIntent;
      let parsed: any;
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        return fallbackIntent;
      }
      return {
        activityCategory: parsed.activityCategory || fallbackIntent.activityCategory,
        maxDurationMinutes: parsed.maxDurationMinutes || fallbackIntent.maxDurationMinutes,
        locationPreference: parsed.locationPreference || fallbackIntent.locationPreference,
        budgetLevel: parsed.budgetLevel || fallbackIntent.budgetLevel,
        timeSlot: parsed.timeSlot || fallbackIntent.timeSlot,
        confidence: parsed.confidence || 0.95,
      };
    } catch {
      return fallbackIntent;
    }
  }
}

export const aiReasoningService = new AiReasoningService();

// ---------------------------------------------------------------------------
// Accommodation search intent — same fallback-first discipline as
// parseTravelerSearchIntent above: a deterministic EN/AR keyword parse always
// runs first, and the model is only attempted when a key exists and the quota
// isn't known-exhausted. The AI never invents results — it only produces an
// AccommodationSearchFilters object, which the caller passes to the real
// database search (see accommodationRoutes.ts POST /search-intent).
// ---------------------------------------------------------------------------

export interface AccommodationSearchIntentResult {
  filters: AccommodationSearchFilters;
  confidence: number;
  source: 'ai' | 'fallback';
}

const AMENITY_KEYWORDS: Array<{ pattern: RegExp; amenity: string }> = [
  { pattern: /sea\s*view|بحر|إطلالة/i, amenity: 'sea view' },
  { pattern: /beachfront|beach front|على الشاطئ/i, amenity: 'private beach' },
  { pattern: /pool|مسبح/i, amenity: 'pool' },
  { pattern: /wifi|واي فاي/i, amenity: 'wifi' },
  { pattern: /kitchen|مطبخ/i, amenity: 'kitchen' },
  { pattern: /a\/?c|air.?condition|تكييف/i, amenity: 'air conditioning' },
  { pattern: /quiet|هادئ|هادي/i, amenity: 'quiet' }
];

function fallbackAccommodationIntent(query: string): AccommodationSearchFilters {
  const guestsMatch = /(\d+)\s*(guests?|people|persons?|أشخاص|شخص)/i.exec(query);
  const guests = guestsMatch ? Number(guestsMatch[1]) : undefined;

  const wantsBudget = /cheap|budget|affordable|رخيص|اقتصادي|مش غالي/i.test(query);
  const wantsPremium = /luxury|premium|resort|فاخر|راقي/i.test(query);

  const mustHaveAmenities = AMENITY_KEYWORDS.filter(k => k.pattern.test(query)).map(k => k.amenity);

  const areaIds = db.areaProfiles
    .filter(a => new RegExp(a.nameEn, 'i').test(query) || (a.nameAr && query.includes(a.nameAr)))
    .map(a => a.id);

  const filters: AccommodationSearchFilters = {
    q: query,
    guests: guests && guests > 0 ? guests : undefined,
    priceBands: wantsBudget ? ['budget'] : wantsPremium ? ['premium'] : undefined,
    areaIds: areaIds.length ? areaIds : undefined,
    mustHaveAmenities: mustHaveAmenities.length ? mustHaveAmenities : undefined,
    sort: wantsBudget ? 'price_asc' : 'relevance'
  };
  return filters;
}

export async function parseAccommodationSearchIntent(
  query: string,
  language: 'en' | 'ar' = 'en'
): Promise<AccommodationSearchIntentResult> {
  const fallback = fallbackAccommodationIntent(query);

  if (!isLlmConfigured() || isQuotaExhausted()) {
    return { filters: fallback, confidence: 0.6, source: 'fallback' };
  }

  try {
    const response = await generateText({
      temperature: 0.1,
      json: true,
      prompt: `You are Dahab's accommodation search intent parser. The traveler wrote (in ${language === 'ar' ? 'Arabic' : 'English'}):
"${query}"

Return ONLY valid JSON matching this schema. Omit a field entirely if it is not implied by the query — never guess a value that isn't there:
{
  "guests": number,
  "priceBands": array of "budget" | "moderate" | "premium",
  "propertyTypes": array of "hotel" | "hostel" | "apartment" | "studio" | "villa" | "guesthouse" | "camp" | "eco-lodge" | "boutique-hotel" | "resort",
  "mustHaveAmenities": array of short amenity strings (e.g. "sea view", "quiet", "kitchen", "pool"),
  "sort": "relevance" | "rating" | "price_asc" | "price_desc",
  "confidence": number between 0 and 1
}`
    });

    if (!response) return { filters: fallback, confidence: 0.6, source: 'fallback' };
    let parsed: any;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      return { filters: fallback, confidence: 0.6, source: 'fallback' };
    }
    const filters: AccommodationSearchFilters = {
      q: query,
      guests: typeof parsed.guests === 'number' ? parsed.guests : fallback.guests,
      priceBands: Array.isArray(parsed.priceBands) ? parsed.priceBands : fallback.priceBands,
      propertyTypes: Array.isArray(parsed.propertyTypes) ? parsed.propertyTypes : undefined,
      areaIds: fallback.areaIds,
      mustHaveAmenities: Array.isArray(parsed.mustHaveAmenities) ? parsed.mustHaveAmenities : fallback.mustHaveAmenities,
      sort: parsed.sort || fallback.sort
    };
    return { filters, confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85, source: 'ai' };
  } catch {
    return { filters: fallback, confidence: 0.6, source: 'fallback' };
  }
}
