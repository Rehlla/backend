/**
 * Dahab parties & nightlife — the shared domain vocabulary.
 *
 * Server entities live in server/db/schema.ts (persistence shape); the wire
 * shapes the client receives live here, mirroring the src/shared/diningVenue.ts
 * discipline: importing server/db/schema.ts into the SPA would drag the whole
 * persistence vocabulary into the bundle's type graph, so both sides import
 * THIS file instead.
 *
 * The Dahab-specific ground truth this encodes (see docs/PARTIES_FEATURE.md):
 * nightlife here is beach bars and desert gatherings, not mega clubs. Meeting
 * points, never hotel pickups. Cash on the spot or WhatsApp, never a card
 * gateway. 500 EGP is the anchor ticket.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** The seven real kinds of Dahab night out. */
export type PartyCategory =
  | 'full_moon_desert'
  | 'beach_bar_live'
  | 'psytrance_weekly'
  | 'bonfire_community'
  | 'wellness_party'
  | 'night_adventure'
  | 'rooftop_chill';

export type PartyZone =
  | 'mamsha'
  | 'lighthouse'
  | 'lagoon'
  | 'wadi_qnai'
  | 'asala'
  | 'blue_hole';

export type PartyFrequency = 'daily' | 'weekly' | 'monthly' | 'one_time';

/** How the money works: free entry, a ticket, a WhatsApp deal, or a hat. */
export type PartyPriceModel = 'free' | 'ticket' | 'whatsapp' | 'donation';

/** What the entry price physically buys at the door. */
export type PartyEntryType = 'free' | 'free_min_2_persons' | 'ticket_includes_drink';

/** How a traveler converts interest into presence. */
export type PartyBookingType = 'walkin' | 'whatsapp' | 'local_ticket';

export type PartyAudience =
  | 'backpackers'
  | 'egyptian_youth'
  | 'digital_nomads'
  | 'couples'
  | 'all';

export type PartyMusicGenre =
  | 'psytrance'
  | 'deep_house'
  | 'techno'
  | 'live_band'
  | 'oriental'
  | 'acoustic'
  | 'world_fusion'
  | 'organic_house';

export type PartyVibeTag =
  | 'chill'
  | 'high_energy'
  | 'spiritual'
  | 'romantic'
  | 'community'
  | 'desert';

/** Perk ids on a party row; labels resolve client-side via i18n. */
export type PartyIncludeId =
  | 'international_djs'
  | 'fire_show'
  | 'desert_location'
  | 'welcome_drink'
  | 'befront_seating'
  | 'shisha_available'
  | 'bonfire'
  | 'guitar_jam'
  | 'bedouin_tea'
  | 'tea_ceremony'
  | 'breathwork'
  | 'crystal_bowls'
  | 'gong_bath'
  | 'three_bars'
  | 'crawl_guide'
  | 'decoration_liquids'
  | 'dive_gear'
  | 'dive_guide'
  | 'camel_ride'
  | 'stargazing'
  | 'seaview_rooftop';

export const PARTY_CATEGORIES: readonly PartyCategory[] = [
  'full_moon_desert',
  'beach_bar_live',
  'psytrance_weekly',
  'bonfire_community',
  'wellness_party',
  'night_adventure',
  'rooftop_chill'
];

export const PARTY_ZONES: readonly PartyZone[] = [
  'mamsha',
  'lighthouse',
  'lagoon',
  'wadi_qnai',
  'asala',
  'blue_hole'
];

// ---------------------------------------------------------------------------
// Zones: geography the map and the zone chips share
// ---------------------------------------------------------------------------

export interface PartyZoneInfo {
  id: PartyZone;
  nameEn: string;
  nameAr: string;
  /** Approximate zone centre; pins cluster around it. */
  lat: number;
  lng: number;
}

/** One row per party zone, coastline order south → north. */
export const PARTY_ZONE_INFO: Record<PartyZone, PartyZoneInfo> = {
  mamsha: { id: 'mamsha', nameEn: 'Mamsha', nameAr: 'الممشى', lat: 28.4945, lng: 34.5130 },
  lighthouse: { id: 'lighthouse', nameEn: 'Lighthouse', nameAr: 'اللايت هاوس', lat: 28.5010, lng: 34.5180 },
  asala: { id: 'asala', nameEn: 'El Asala', nameAr: 'الآسلة', lat: 28.5105, lng: 34.5136 },
  lagoon: { id: 'lagoon', nameEn: 'The Lagoon', nameAr: 'اللاجون', lat: 28.5280, lng: 34.5230 },
  wadi_qnai: { id: 'wadi_qnai', nameEn: 'Wadi Qnai', nameAr: 'وادي قناي', lat: 28.5450, lng: 34.4830 },
  blue_hole: { id: 'blue_hole', nameEn: 'Blue Hole', nameAr: 'الثقب الأزرق', lat: 28.5590, lng: 34.5370 }
};

/** SVG map placement for the zone map component — x/y in a 100×70 viewBox. */
export const PARTY_ZONE_MAP_POSITIONS: Record<PartyZone, { x: number; y: number }> = {
  mamsha: { x: 30, y: 62 },
  lighthouse: { x: 40, y: 52 },
  asala: { x: 33, y: 42 },
  lagoon: { x: 58, y: 28 },
  wadi_qnai: { x: 14, y: 18 },
  blue_hole: { x: 82, y: 12 }
};

/** Pin colours per category — the nightlife legend. */
export const PARTY_CATEGORY_COLORS: Record<PartyCategory, string> = {
  full_moon_desert: '#a855f7',
  beach_bar_live: '#3b82f6',
  psytrance_weekly: '#22d3ee',
  bonfire_community: '#f97316',
  wellness_party: '#22c55e',
  night_adventure: '#eab308',
  rooftop_chill: '#ec4899'
};

// ---------------------------------------------------------------------------
// Wire shapes (what /api/dahab/parties serves)
// ---------------------------------------------------------------------------

export interface PartyView {
  id: string;
  category: PartyCategory;
  zone: PartyZone;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  venueName: string;
  durationHours: number;
  frequency: PartyFrequency;
  /** English weekday names, e.g. ['Friday']. Empty for daily/monthly. */
  days: string[];
  /** Next occurrence for monthly/one_time parties, 'YYYY-MM-DD'. */
  nextDate?: string;
  startTime: string;
  priceModel: PartyPriceModel;
  /** 0 for free-entry parties; the anchor figure when a ticket exists. */
  priceEgp: number;
  /** Optional desert/transport leg, priced separately (Full Moon pattern). */
  transportEgp?: number;
  /** Foreigner-friendly figure; EGP stays the source of truth. */
  priceUsd?: number;
  entryType: PartyEntryType;
  musicGenres: PartyMusicGenre[];
  vibeTags: PartyVibeTag[];
  includes: PartyIncludeId[];
  meetingPointName: string;
  meetingPointLat: number;
  meetingPointLng: number;
  bookingType: PartyBookingType;
  whatsappNumber?: string;
  audience: PartyAudience;
  isFeatured: boolean;
  imageUrls: string[];
  organizerInstagram?: string;
  licenseVerified: boolean;
  /** Times a traveler pressed through to WhatsApp; ops signal, not vanity. */
  bookingIntentCount: number;
}

export interface PartyZoneSummary {
  id: PartyZone;
  nameEn: string;
  nameAr: string;
  lat: number;
  lng: number;
  partyCount: number;
}

export interface PartyBookIntentResponse {
  /** Ready-to-open wa.me link with the template filled in. */
  whatsappUrl: string;
  /** The message as it was rendered, for copy-paste fallbacks. */
  message: string;
  intentCount: number;
}

export interface PartyListResponse {
  status: 'success';
  parties: PartyView[];
  count: number;
  /** ISO instant when the 6h offline cache goes stale. */
  cachedUntil: string;
  /** Sinai internet honesty: true when the payload came from the cache. */
  fromCache: boolean;
}

export interface PartyTonightResponse {
  status: 'success';
  date: string;
  parties: PartyView[];
  count: number;
  cachedUntil: string;
  fromCache: boolean;
}

export interface PartyZonesResponse {
  status: 'success';
  zones: PartyZoneSummary[];
}

/** Admin write payload — validated server-side with bodyParams. */
export interface PartyWritePayload {
  id?: string;
  category: PartyCategory;
  zone: PartyZone;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  venueName: string;
  durationHours: number;
  frequency: PartyFrequency;
  days?: string[];
  nextDate?: string;
  startTime: string;
  priceModel: PartyPriceModel;
  priceEgp?: number;
  transportEgp?: number;
  priceUsd?: number;
  entryType: PartyEntryType;
  musicGenres?: PartyMusicGenre[];
  vibeTags?: PartyVibeTag[];
  includes?: PartyIncludeId[];
  meetingPointName: string;
  meetingPointLat: number;
  meetingPointLng: number;
  bookingType: PartyBookingType;
  whatsappNumber?: string;
  audience?: PartyAudience;
  isFeatured?: boolean;
  imageUrls?: string[];
  organizerInstagram?: string;
  licenseVerified?: boolean;
}

// ---------------------------------------------------------------------------
// WhatsApp link generation — shared so server (book-intent) and client
// (instant open fallback) can never render different links.
// ---------------------------------------------------------------------------

/**
 * EGP-international phone numbers: strip spaces/dashes/parens and any literal
 * '+' is re-added once, because wa.me wants digits only after the plus.
 */
export function normalizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  return digits.startsWith('20') && raw.trim().startsWith('+')
    ? `+${digits}`
    : digits.startsWith('20')
      ? `+${digits}`
      : `+20${digits}`;
}

/**
 * The bilingual booking template. Placeholders: {party_name}, {date},
 * {persons}. The server fills these from the party row (never the client) so a
 * tampered browser cannot make the organizer receive a forged message header.
 */
export function partyWhatsappMessage(
  party: { nameEn: string; nameAr: string },
  language: 'en' | 'ar',
  vars: { date: string; persons: number }
): string {
  const name = language === 'ar' ? party.nameAr : party.nameEn;
  if (language === 'ar') {
    return `مرحباً، أود حجز ${name} يوم ${vars.date} لعدد ${vars.persons} ${
      vars.persons === 1 ? 'شخص' : 'أشخاص'
    }. — أرسلت من منصة Travel.eg`;
  }
  return `Hi! I'd like to book ${name} on ${vars.date} for ${vars.persons} ${
    vars.persons === 1 ? 'person' : 'people'
  }. — Sent from Travel.eg`;
}

export function partyWhatsappUrl(number: string, message: string): string {
  const normalized = normalizeWhatsappNumber(number);
  return `https://wa.me/${normalized.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
}

/**
 * Google Maps directions link for a meeting point. Meeting points are the
 * Dahab-specific contract: there is no hotel pickup here, unlike the Sharm
 * model, so the map button IS the "how do I get there" answer.
 */
export function partyMeetingPointMapUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}
