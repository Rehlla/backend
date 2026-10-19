import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { dataDir } from '../db/paths';

/**
 * TripAdvisor knowledge for Daygi: grounded place answers from the
 * platform's own Tripadvisor pulls (October 2026) plus the live catalogue.
 *
 * Two backends, one ranking:
 *   - stays + Dahab dining come from the LIVE catalogue (db.accommodations /
 *     db.diningVenues), so curated Arabic names, areas and booking state ride
 *     along with the Tripadvisor ratings and review texts the seed importers
 *     converged;
 *   - attractions, tours and the Nuweiba/Siwa destinations have no catalogue
 *     entity, so they read the raw pull files (data/tripadvisor/*.json),
 *     loaded lazily once and cached. Missing files simply yield no hits —
 *     the service never throws for them (they are runtime state, not
 *     boot-critical seeds).
 *
 * Ranking is rating-first, review-count second; listings below 3.0 are never
 * recommended. Answers are bilingual: English names stay in English (the
 * platform's convention) inside Arabic framing.
 */

export type TAKnowledgeDestination = 'dahab' | 'nuweiba' | 'siwa';
export type TAKnowledgeCategory = 'hotel' | 'restaurant' | 'attraction' | 'tour';

export interface TAPlaceHit {
  destination: TAKnowledgeDestination;
  category: TAKnowledgeCategory;
  id: string;
  name: string;
  nameAr?: string | null;
  rating: number | null;
  reviewCount: number;
  price?: string | null;
  area?: string | null;
  url?: string | null;
  phone?: string | null;
  reviewQuote?: {
    author: string | null;
    rating: number | null;
    title: string | null;
    text: string | null;
  } | null;
}

export interface TAKnowledgeAnswer {
  destination: TAKnowledgeDestination;
  category: TAKnowledgeCategory;
  places: TAPlaceHit[];
  totalMatching: number;
  replyText: string;
  replyTextAr: string;
}

interface RawPlace {
  id?: number | string;
  name?: string | null;
  url?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceRange?: string | null;
  lowestPrice?: string | null;
  price?: string | null;
  cuisines?: string | null;
  category?: string | null;
  phone?: string | null;
}

const DEST_KEYWORDS: { dest: TAKnowledgeDestination; words: string[] }[] = [
  { dest: 'nuweiba', words: ['nuweiba', 'noweiba', 'نويبع', 'نوبيع'] },
  { dest: 'siwa', words: ['siwa', 'سيوة', 'سيوه', 'oasis', 'الواحة'] },
  { dest: 'dahab', words: ['dahab', 'دهب'] },
];

const CATEGORY_KEYWORDS: { cat: TAKnowledgeCategory; words: string[] }[] = [
  {
    cat: 'restaurant',
    words: ['restaurant', 'restaurants', 'eat', 'eating', 'food', 'dinner', 'lunch', 'breakfast', 'seafood', 'cuisine', 'cafe', 'café', 'coffee', 'مطعم', 'مطاعم', 'أكل', 'اكل', 'عشا', 'عشاء', 'غدا', 'غداء', 'فطار', 'فطور', 'مأكولات', 'قهوة', 'كافيه'],
  },
  {
    cat: 'hotel',
    words: ['hotel', 'hotels', 'stay', 'sleep', 'overnight', 'camp', 'hostel', 'accommodation', 'room', 'فندق', 'فنادق', 'إقامة', 'اقامة', 'نوم', 'كامب', 'مخيم', 'غرفة', 'اوضة'],
  },
  {
    cat: 'tour',
    words: ['tour', 'tours', 'day trip', 'excursion', 'book a tour', 'رحلة', 'رحلات', 'تور', 'جولة', 'رحله'],
  },
  {
    cat: 'attraction',
    words: ['attraction', 'attractions', 'things to do', 'activity', 'activities', 'diving', 'dive', 'snorkel', 'visit', 'site', 'sight', 'أنشطة', 'نشاط', 'فسح', 'فسحة', 'غوص', 'غطس', 'سنوركلينج', 'أزور', 'ازور', 'معالم', 'اماكن', 'أماكن'],
  },
];

const MIN_RATING = 3.0;
const MAX_PLACES = 5;

function norm(s: string): string {
  return s.toLowerCase();
}

/** Detects a place-seeking question: which destination + which category. */
export function detectKnowledgeQuery(prompt: string): {
  destination: TAKnowledgeDestination;
  category: TAKnowledgeCategory;
} | null {
  const p = norm(prompt);
  let category: TAKnowledgeCategory | null = null;
  for (const c of CATEGORY_KEYWORDS) {
    if (c.words.some((w) => p.includes(w))) {
      category = c.cat;
      break;
    }
  }
  if (!category) return null;
  let destination: TAKnowledgeDestination = 'dahab';
  for (const d of DEST_KEYWORDS) {
    if (d.words.some((w) => p.includes(w))) {
      destination = d.dest;
      break;
    }
  }
  return { destination, category };
}

function pickQuote(reviews: any[] | undefined): TAPlaceHit['reviewQuote'] {
  if (!Array.isArray(reviews)) return null;
  const r = reviews.find((x) => x && typeof x.text === 'string' && x.text.trim().length > 40);
  if (!r) return null;
  return {
    author: r.author ?? null,
    rating: typeof r.rating === 'number' ? r.rating : null,
    title: r.title ?? null,
    text: r.text.trim().slice(0, 280),
  };
}

function rankPlaces<T extends { rating: number | null; reviewCount: number }>(rows: T[]): T[] {
  // Bayesian average (m = 30 prior reviews at C = 4.0): a 5.0 from 24
  // reviews must not outrank a 4.6 from 1,367. Pure rating-desc surfacing
  // tiny joints above institutions, which reads as a broken recommendation.
  const score = (r: T) => {
    const v = r.reviewCount || 0;
    const m = 30;
    const C = 4.0;
    return (v / (v + m)) * r.rating! + (m / (v + m)) * C;
  };
  return [...rows]
    .filter((r) => r.rating != null && r.rating >= MIN_RATING)
    .sort((a, b) => score(b) - score(a) || b.reviewCount - a.reviewCount);
}

/** Extra query words beyond the category/destination keywords, for filtering. */
const GENERIC_ADJECTIVES = new Set([
  'best', 'top', 'good', 'great', 'nice', 'excellent', 'amazing', 'recommend', 'recommended', 'recommendation', 'suggest', 'suggestion', 'favorite', 'favourite', 'place', 'places', 'want', 'looking', 'find', 'show', 'tell', 'give',
  'احسن', 'أحسن', 'افضل', 'أفضل', 'احلى', 'أحلى', 'كويس', 'كويسة', 'حلو', 'حلوة', 'جميل', 'جميلة', 'رشح', 'رشحلي', 'اقترح', 'اقترحلي', 'عايز', 'عايزه', 'ابغى', 'بدي', 'وين', 'فين', 'ايه', 'إيه',
]);

function extraTerms(prompt: string): string[] {
  const stop = new Set<string>();
  const phrases: string[] = [];
  for (const c of CATEGORY_KEYWORDS) {
    for (const w of c.words) {
      if (w.includes(' ')) phrases.push(w);
      else stop.add(w);
    }
  }
  for (const d of DEST_KEYWORDS) {
    for (const w of d.words) {
      if (w.includes(' ')) phrases.push(w);
      else stop.add(w);
    }
  }
  let text = norm(prompt);
  for (const ph of phrases) text = text.split(ph).join(' ');
  const terms = text
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(t) && !GENERIC_ADJECTIVES.has(t));
  // Arabic-script terms cannot match the English catalogue text — fall back
  // to top-rated instead of filtering everything out.
  if (terms.some((t) => /[\u0600-\u06FF]/.test(t))) return [];
  return terms;
}

function matchesTerms(hay: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  return terms.some((t) => hay.includes(t));
}

function searchDbStays(terms: string[], limit: number): TAPlaceHit[] {
  const rows = (db.accommodations || []).filter((a: any) => a.active !== false);
  const hits: TAPlaceHit[] = [];
  for (const a of rows as any[]) {
    const hay = norm(`${a.name || ''} ${a.nameAr || ''} ${(a.typeChips || []).join(' ')} ${a.areaName || ''}`);
    if (!matchesTerms(hay, terms)) continue;
    hits.push({
      destination: 'dahab',
      category: 'hotel',
      id: String(a.id),
      name: a.name,
      nameAr: a.nameAr ?? null,
      rating: typeof a.rating === 'number' ? a.rating : null,
      reviewCount: a.reviewCount || 0,
      price: a.perNightEGP ? `EGP ${a.perNightEGP}/night` : null,
      area: a.areaName ?? null,
      url: a.tripadvisor?.url ?? null,
      phone: a.tripadvisor?.telephone ?? null,
      reviewQuote: pickQuote(a.tripadvisor?.reviews),
    });
  }
  return rankPlaces(hits).slice(0, limit);
}

function searchDbDining(terms: string[], limit: number): TAPlaceHit[] {
  const rows = db.diningVenues || [];
  const hits: TAPlaceHit[] = [];
  for (const v of rows as any[]) {
    const hay = norm(`${v.nameEn || ''} ${v.nameAr || ''} ${(v.cuisine || []).join(' ')} ${v.areaName || ''}`);
    if (!matchesTerms(hay, terms)) continue;
    hits.push({
      destination: 'dahab',
      category: 'restaurant',
      id: String(v.id),
      name: v.nameEn,
      nameAr: v.nameAr ?? null,
      rating: typeof v.rating === 'number' ? v.rating : null,
      reviewCount: v.reviewCount || 0,
      price: v.priceBand ?? null,
      area: v.areaName ?? null,
      url: v.tripadvisor?.url ?? null,
      phone: v.phone ?? v.tripadvisor?.telephone ?? null,
      reviewQuote: pickQuote(v.tripadvisor?.reviews),
    });
  }
  return rankPlaces(hits).slice(0, limit);
}

// --- file-backed categories (attractions, tours, non-Dahab destinations) ---

const fileCache = new Map<string, RawPlace[]>();
const reviewCache = new Map<string, any[]>();

function loadPullFile(dest: TAKnowledgeDestination, cat: TAKnowledgeCategory): RawPlace[] {
  const key = `${dest}_${cat}`;
  if (fileCache.has(key)) return fileCache.get(key)!;
  let rows: RawPlace[] = [];
  try {
    // dataDir() (not the DATA_DIR constant) so tests and tooling can point
    // at fixture dirs through DAHAB_DATA_DIR after import time.
    const p = path.join(dataDir(), 'tripadvisor', `${dest}_${cat === 'hotel' ? 'hotels' : cat === 'restaurant' ? 'restaurants' : cat === 'attraction' ? 'attractions' : 'tours'}.json`);
    if (fs.existsSync(p)) {
      const doc = JSON.parse(fs.readFileSync(p, 'utf-8'));
      rows = Array.isArray(doc.places) ? doc.places : [];
    }
  } catch {
    rows = [];
  }
  fileCache.set(key, rows);
  return rows;
}

function reviewsFor(id: string | number): any[] {
  const key = String(id);
  if (reviewCache.has(key)) return reviewCache.get(key)!;
  let out: any[] = [];
  try {
    if (reviewCache.size === 0) {
      const p = path.join(dataDir(), 'tripadvisor', 'reviews.json');
      if (fs.existsSync(p)) {
        const store = JSON.parse(fs.readFileSync(p, 'utf-8'));
        for (const [k, v] of Object.entries(store) as any[]) {
          reviewCache.set(k, Array.isArray((v as any).reviews) ? (v as any).reviews : []);
        }
      }
      reviewCache.set('__loaded__', []);
    }
    out = reviewCache.get(key) || [];
  } catch {
    out = [];
  }
  return out;
}

function searchFiles(dest: TAKnowledgeDestination, cat: TAKnowledgeCategory, terms: string[], limit: number): TAPlaceHit[] {
  const rows = loadPullFile(dest, cat);
  const hits: TAPlaceHit[] = [];
  for (const p of rows) {
    if (p.id == null || !p.name) continue;
    const hay = norm(`${p.name} ${p.cuisines || ''} ${p.category || ''}`);
    if (!matchesTerms(hay, terms)) continue;
    const price = p.priceRange || p.lowestPrice || p.price || null;
    hits.push({
      destination: dest,
      category: cat,
      id: String(p.id),
      name: p.name,
      rating: typeof p.rating === 'number' ? Number(p.rating) : p.rating != null ? Number(p.rating) : null,
      reviewCount: Number(p.reviewCount) || 0,
      price,
      area: null,
      url: p.url ? `https://www.tripadvisor.com${p.url}` : null,
      phone: p.phone ?? null,
      reviewQuote: pickQuote(reviewsFor(p.id)),
    });
  }
  return rankPlaces(hits).slice(0, limit);
}

export function searchKnowledge(
  destination: TAKnowledgeDestination,
  category: TAKnowledgeCategory,
  query: string,
  limit = MAX_PLACES,
): { places: TAPlaceHit[]; totalMatching: number } {
  const terms = extraTerms(query);
  let all: TAPlaceHit[];
  if (destination === 'dahab' && category === 'hotel') {
    all = searchDbStays(terms, 50);
  } else if (destination === 'dahab' && category === 'restaurant') {
    all = searchDbDining(terms, 50);
  } else {
    all = searchFiles(destination, category, terms, 50);
  }
  return { places: all.slice(0, limit), totalMatching: all.length };
}

const DEST_NAME: Record<TAKnowledgeDestination, { en: string; ar: string }> = {
  dahab: { en: 'Dahab', ar: 'دهب' },
  nuweiba: { en: 'Nuweiba', ar: 'نويبع' },
  siwa: { en: 'Siwa', ar: 'سيوة' },
};

const CAT_NAME: Record<TAKnowledgeCategory, { en: string; ar: string; pluralEn: string; pluralAr: string }> = {
  hotel: { en: 'stay', ar: 'إقامة', pluralEn: 'stays', pluralAr: 'أماكن الإقامة' },
  restaurant: { en: 'restaurant', ar: 'مطعم', pluralEn: 'restaurants', pluralAr: 'مطاعم' },
  attraction: { en: 'attraction', ar: 'معلم', pluralEn: 'attractions', pluralAr: 'معالم وأنشطة' },
  tour: { en: 'tour', ar: 'رحلة', pluralEn: 'tours', pluralAr: 'رحلات' },
};

function fmtCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Builds a grounded bilingual answer, or null when nothing matches. */
export function answerKnowledge(prompt: string): TAKnowledgeAnswer | null {
  const detected = detectKnowledgeQuery(prompt);
  if (!detected) return null;
  const { places, totalMatching } = searchKnowledge(detected.destination, detected.category, prompt);
  if (places.length === 0) return null;
  const dest = DEST_NAME[detected.destination];
  const cat = CAT_NAME[detected.category];
  const top = places[0];

  const lines = places.map((p, i) => {
    const bits = [`${i + 1}. ${p.name} — ${p.rating}/5 (${fmtCount(p.reviewCount)} reviews)`];
    const meta: string[] = [];
    if (p.price) meta.push(p.price);
    if (p.area) meta.push(p.area);
    if (meta.length > 0) bits.push(`   ${meta.join(' · ')}`);
    if (p.reviewQuote && p.reviewQuote.text) {
      const who = p.reviewQuote.author ? ` — ${p.reviewQuote.author}` : '';
      bits.push(`   "${p.reviewQuote.text.slice(0, 160)}${p.reviewQuote.text.length > 160 ? '…' : ''}"${who}`);
    }
    return bits.join('\n');
  });

  const replyText =
    `Top-rated ${cat.pluralEn} in ${dest.en} right now (Tripadvisor, ${fmtCount(top.reviewCount)}+ traveler reviews counted):\n` +
    lines.join('\n') +
    (totalMatching > places.length ? `\n…and ${totalMatching - places.length} more highly-rated options.` : '');

  const linesAr = places.map((p, i) => {
    const bits = [`${i + 1}. ${p.name} — ${p.rating}/5 (${fmtCount(p.reviewCount)} تقييم)`];
    const meta: string[] = [];
    if (p.price) meta.push(p.price);
    if (p.area) meta.push(p.area);
    if (meta.length > 0) bits.push(`   ${meta.join(' · ')}`);
    if (p.reviewQuote && p.reviewQuote.text) {
      const who = p.reviewQuote.author ? ` — ${p.reviewQuote.author}` : '';
      bits.push(`   "${p.reviewQuote.text.slice(0, 160)}${p.reviewQuote.text.length > 160 ? '…' : ''}"${who}`);
    }
    return bits.join('\n');
  });

  const replyTextAr =
    `أعلى ${cat.pluralAr} تقييمًا في ${dest.ar} حاليًا (من تقييمات TripAdvisor):\n` +
    linesAr.join('\n') +
    (totalMatching > places.length ? `\n…وفيه ${totalMatching - places.length} اختيارات تانية بتقييمات عالية.` : '');

  return { destination: detected.destination, category: detected.category, places, totalMatching, replyText, replyTextAr };
}

/** Test hook: clears the file caches so tests can point at fixtures. */
export function __clearKnowledgeCache(): void {
  fileCache.clear();
  reviewCache.clear();
}
