import type {
  DayGiResponse,
  DayGiCanvasDocument,
  DayGiCanvasDay,
  DayGiCanvasItem,
  DayGiCanvasSpot,
  DayGiCanvasSpotKey
} from '../../src/shared';
import { db } from '../db/database';

/**
 * Builds the plan canvas that renders beside the conversation.
 *
 * TripAdvisor-style assistants keep a structured "results" document beside the
 * chat: the traveler talks in the left column while the plan sits in the right
 * one, day-grouped, with per-item actions. DayGI already produces that
 * structure deterministically — it was just trapped inside per-intent action
 * cards. This service lifts it out: whatever plan-shaped data a response
 * carries (multi-step options, a daily briefing, dining recommendations,
 * recovery alternatives) becomes one canvas document, and responses without
 * plan data get no canvas at all.
 *
 * The builder is pure and additive: it never mutates the response it reads,
 * and the Gemini polish step runs after it, so a canvas survives a polish
 * merge exactly like every other deterministic field.
 */

let canvasSeq = 0;

function nextCanvasId(): string {
  canvasSeq += 1;
  return `CANVAS-${Date.now().toString(36)}-${canvasSeq}`;
}

const TIMELINE_KIND_MAP: Record<string, DayGiCanvasItem['kind']> = {
  MEAL: 'FOOD',
  FOOD: 'FOOD',
  ACTIVITY: 'ACTIVITY',
  RELAX: 'RELAX',
  CULTURE: 'CULTURE',
  NOTE: 'NOTE'
};

/**
 * Known Dahab spots with approximate coastal coordinates. Text matching is
 * lowercase substring on the location strings the action data itself uses
 * ('Lighthouse Promenade', 'Lighthouse Bay', 'Canyon Marine Sanctuary', …).
 * Order matters only where one name contains another; these do not.
 */
const SPOT_REGISTRY: Record<DayGiCanvasSpotKey, { lat: number; lng: number; keywords: string[] }> = {
  LIGHTHOUSE: { lat: 28.4890, lng: 34.5130, keywords: ['lighthouse'] },
  EEL_GARDEN: { lat: 28.5020, lng: 34.5160, keywords: ['eel garden'] },
  LAGUNA: { lat: 28.5245, lng: 34.5072, keywords: ['laguna', 'lagoon'] },
  CANYON: { lat: 28.5599, lng: 34.5341, keywords: ['canyon'] },
  BLUE_HOLE: { lat: 28.5663, lng: 34.5363, keywords: ['blue hole'] }
};

/** Resolves an item's free-text location to a known spot, or undefined. */
export function spotFor(location: string | undefined): DayGiCanvasSpot | undefined {
  if (!location) return undefined;
  const normalized = location.toLowerCase();
  for (const [key, spot] of Object.entries(SPOT_REGISTRY) as Array<[DayGiCanvasSpotKey, typeof SPOT_REGISTRY[DayGiCanvasSpotKey]]>) {
    if (spot.keywords.some(keyword => normalized.includes(keyword))) {
      return { key, lat: spot.lat, lng: spot.lng };
    }
  }
  return undefined;
}

export interface VenueMedia {
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
}

interface MediaNeedle {
  tokens: string[];
  media: VenueMedia;
}

function tokenizeName(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .split(' ')
    .filter(token => token.length >= 3);
}

/**
 * Head-to-head matching: the record's first two tokens must appear
 * consecutively in the item name, or vice versa. Heads are the distinctive
 * part of venue names ("ali baba" in "Ali Baba Restaurant", "eel garden" in
 * "Eel Garden View Restaurant"); matching anywhere would let generic words
 * ("restaurant", "dahab", "seafood") forge false positives.
 */
export function matchVenueMedia(
  itemName: string | undefined,
  needles: Array<{ tokens: string[]; media: VenueMedia }>
): VenueMedia | undefined {
  const itemTokens = tokenizeName(itemName);
  if (itemTokens.length < 2) return undefined;
  const runs = (tokens: string[]): string[] => {
    const out: string[] = [];
    for (let i = 0; i + 1 < tokens.length; i++) {
      out.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
    return out;
  };
  const itemRuns = new Set(runs(itemTokens));
  for (const needle of needles) {
    if (needle.tokens.length < 2) continue;
    const head = `${needle.tokens[0]} ${needle.tokens[1]}`;
    if (itemRuns.has(head)) return needle.media;
    for (const run of runs(needle.tokens)) {
      if (itemTokens.length >= 2 && `${itemTokens[0]} ${itemTokens[1]}` === run) return needle.media;
    }
  }
  return undefined;
}

let mediaIndex: MediaNeedle[] | null = null;

function mediaIndexEntries(): MediaNeedle[] {
  if (mediaIndex) return mediaIndex;
  const entries: MediaNeedle[] = [];
  const push = (nameEn?: string, nameAr?: string, media?: VenueMedia) => {
    if (!media || (!media.imageUrl && media.rating === undefined)) return;
    for (const name of [nameEn, nameAr]) {
      const tokens = tokenizeName(name);
      if (tokens.length >= 2) entries.push({ tokens, media });
    }
  };
  try {
    for (const venue of db.diningVenues || []) {
      push(venue.nameEn, venue.nameAr, {
        imageUrl: venue.coverImageUrl,
        rating: venue.rating,
        reviewCount: venue.reviewCount
      });
    }
    for (const stay of db.accommodations || []) {
      push(stay.name, stay.nameAr, {
        imageUrl: stay.coverImageUrl,
        rating: stay.rating,
        reviewCount: stay.reviewCount
      });
    }
  } catch (err) {
    console.warn('[DayGI Canvas] Media index unavailable, items render without photos:', err);
  }
  mediaIndex = entries;
  return mediaIndex;
}

/**
 * Attaches real catalogue media (photo, rating, review count) when a venue
 * or stay matches the item name confidently. Otherwise returns the item
 * untouched — the card renders without an image rather than a fabricated one.
 */
export function enrichMediaItem<T extends DayGiCanvasItem>(item: T): T {
  const needles = mediaIndexEntries();
  if (needles.length === 0) return item;
  const media = matchVenueMedia(item.name, needles) ?? matchVenueMedia(item.nameAr, needles);
  if (!media) return item;
  return {
    ...item,
    imageUrl: item.imageUrl ?? media.imageUrl,
    rating: item.rating ?? media.rating,
    reviewCount: item.reviewCount ?? media.reviewCount
  };
}

function toKind(raw: string | undefined): DayGiCanvasItem['kind'] {
  return (raw && TIMELINE_KIND_MAP[raw]) || 'ACTIVITY';
}

function daysFromMultiOptions(response: DayGiResponse): DayGiCanvasDay[] {
  const options = response.multiOptions?.options ?? [];
  if (options.length === 0) return [];
  return [
    {
      id: 'canvas-options',
      label: 'Options',
      labelAr: 'خيارات',
      title: response.actionTitle,
      titleAr: response.actionTitleAr,
      items: options.map<DayGiCanvasItem>(option => ({
        id: option.id,
        name: option.titleEn,
        nameAr: option.titleAr,
        kind: toKind(option.category),
        blurb: option.whyItFitsEn,
        blurbAr: option.whyItFitsAr,
        priceEGP: option.priceEGP,
        location: option.location,
        travelTimeMins: option.travelTimeMins,
        spot: spotFor(option.location),
        skuId: option.skuId,
        actionKey: option.actionKey,
        actionPayload: option.actionPayload
      }))
    }
  ];
}

function daysFromDailyBriefing(response: DayGiResponse): DayGiCanvasDay[] {
  const briefing = response.actionData?.dailyBriefing;
  if (!briefing || briefing.timeline.length === 0) return [];
  const items: DayGiCanvasItem[] = briefing.timeline.map((entry, index) => ({
    id: `brief-${index + 1}`,
    name: entry.title,
    nameAr: entry.titleAr,
    kind: toKind(entry.type),
    time: entry.time
  }));
  for (const [index, window] of briefing.freeWindows.entries()) {
    items.push({
      id: `brief-free-${index + 1}`,
      name: `${window.start} – ${window.end}`,
      nameAr: `${window.start} – ${window.end}`,
      kind: 'RELAX',
      blurb: `Free window · ${window.durationMins} min · ${window.location}`,
      blurbAr: `وقت حر · ${window.durationMins} دقيقة · ${window.location}`,
      time: window.start,
      spot: spotFor(window.location)
    });
  }
  items.push({
    id: 'brief-conditions',
    name: briefing.conditionsNote,
    nameAr: briefing.conditionsNoteAr,
    kind: 'NOTE'
  });
  return [
    {
      id: 'canvas-briefing',
      label: 'Today',
      labelAr: 'اليوم',
      title: briefing.dateFormatted,
      items
    }
  ];
}

function daysFromRecommendationItems(response: DayGiResponse): DayGiCanvasDay[] {
  const recs = response.actionData?.recommendationItems ?? [];
  if (recs.length === 0) return [];
  return [
    {
      id: 'canvas-recs',
      label: 'Nearby',
      labelAr: 'بالقرب منك',
      title: response.actionTitle,
      titleAr: response.actionTitleAr,
      items: recs.map((rec, index) => ({
        id: rec.id || `rec-${index + 1}`,
        name: rec.name,
        nameAr: rec.nameAr,
        kind: 'FOOD' as const,
        blurb: [rec.specialty, rec.distanceWalk].filter(Boolean).join(' · '),
        blurbAr: [rec.specialtyAr, rec.distanceWalk].filter(Boolean).join(' · '),
        time: rec.openingHours
      }))
    }
  ];
}

function daysFromRecoveryAlternatives(response: DayGiResponse): DayGiCanvasDay[] {
  const alternatives = response.actionData?.recoveryProposal?.alternatives ?? [];
  if (alternatives.length === 0) return [];
  return [
    {
      id: 'canvas-recovery',
      label: 'Alternatives',
      labelAr: 'البدائل',
      title: response.actionTitle,
      titleAr: response.actionTitleAr,
      items: alternatives.map((alt, index) => ({
        id: alt.id || `alt-${index + 1}`,
        name: alt.title,
        nameAr: alt.titleAr,
        kind: toKind(alt.serviceType),
        blurb: alt.scheduleImpact,
        blurbAr: alt.scheduleImpactAr
      }))
    }
  ];
}

/**
 * Returns a canvas document for responses that carry plan-shaped data, or
 * null when the answer is prose-only. First matching source wins, so a
 * response never renders two contradictory canvases.
 */
export function buildCanvasDocument(response: DayGiResponse, sourcePrompt: string): DayGiCanvasDocument | null {
  const builders = [
    daysFromMultiOptions,
    daysFromDailyBriefing,
    daysFromRecommendationItems,
    daysFromRecoveryAlternatives
  ];
  let days: DayGiCanvasDay[] = [];
  for (const build of builders) {
    const built = build(response);
    if (built.length > 0) {
      days = built;
      break;
    }
  }
  if (days.length === 0) return null;
  const nonEmpty = days
    .filter(day => day.items.length > 0)
    // Real catalogue media last: every plan source flows through here, so
    // photos and ratings attach uniformly without touching each builder.
    .map(day => ({ ...day, items: day.items.map(enrichMediaItem) }));
  if (nonEmpty.length === 0) return null;
  return {
    id: nextCanvasId(),
    title: response.actionTitle || 'Your plan',
    titleAr: response.actionTitleAr || 'خطتك',
    sourcePrompt,
    days: nonEmpty,
    createdAt: new Date().toISOString()
  };
}

/**
 * Immutably attaches a canvas to a response. The input response is returned
 * untouched when no canvas can be derived from it.
 */
export function attachCanvasDocument(response: DayGiResponse, sourcePrompt: string): DayGiResponse {
  const canvas = buildCanvasDocument(response, sourcePrompt);
  if (!canvas) return response;
  return { ...response, canvas };
}
