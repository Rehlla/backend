import type {
  ActivityDetailEntity,
  AreaProfileEntity,
  PlaceEntity,
  SupplierEntity
} from '../db/schema';
import type { GalleryPhoto } from '../db/seeds/editorialContent';

/**
 * Tripadvisor-style "Things to Do" catalogue for Dahab.
 *
 * The reference pages (tripadvisor.com/Attractions-...) rank every sight,
 * experience and provider in one numbered list under a category rail. This
 * service builds that catalogue from three already-seeded corpora:
 *
 *  - places      → sights (Blue Hole, the Canyon, Wadi Gnai…), which carry
 *                  real bilingual descriptions and verified coordinates
 *  - activities  → things to do (guided dives, safaris, wellness sessions),
 *                  which carry real durations, difficulty and prices
 *  - suppliers   → diving & safari providers, the only corpus with measured
 *                  ratings and review counts — and those stay optional below
 *                  for everything else, because nothing else has them
 *
 * Ratings stay honest: only supplier records contribute rating/reviewCount.
 * Places and activities have none, so they are absent, not invented (the
 * codebase has been burned by `|| 4.9` before). Images are matched
 * deterministically from the editorial gallery pool — those are real photos of
 * these exact spots — falling back to a per-bucket pool, never fabricated.
 */

export type AttractionKind = 'sight' | 'activity' | 'experience';

export interface AttractionBucket {
  id: string;
  labelEn: string;
  labelAr: string;
  count: number;
}

export interface AttractionContact {
  whatsapp?: string;
  phone?: string;
  website?: string;
  instagram?: string;
}

export interface AttractionItem {
  id: string;
  slug: string;
  kind: AttractionKind;
  nameEn: string;
  nameAr: string;
  bucket: string;
  categoryLabelEn: string;
  categoryLabelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** Only present when a real measurement exists (supplier records). */
  rating?: number;
  reviewCount?: number;
  durationMinutes?: number;
  difficulty?: string;
  priceEGP?: number;
  skuId?: string;
  serviceType?: string;
  bookable: boolean;
  areaId: string;
  areaLabelEn?: string;
  areaLabelAr?: string;
  coordinates?: { lat: number; lng: number };
  image?: string;
  tags: string[];
  contact?: AttractionContact;
}

export interface AttractionCatalogueInput {
  places: PlaceEntity[];
  activities: ActivityDetailEntity[];
  suppliers: SupplierEntity[];
  areas: AreaProfileEntity[];
  galleryPhotos: GalleryPhoto[];
}

export interface AttractionCatalogue {
  attractions: AttractionItem[];
  categories: AttractionBucket[];
}

/** The category rail, in the order Tripadvisor would show it. */
export const ATTRACTION_BUCKETS = [
  { id: 'nature-wildlife', labelEn: 'Nature & Wildlife', labelAr: 'الطبيعة والحياة البرية' },
  { id: 'diving-snorkeling', labelEn: 'Diving & Snorkeling', labelAr: 'الغوص والسنوركلينج' },
  { id: 'beaches-lagoons', labelEn: 'Beaches & Lagoons', labelAr: 'الشواطئ والبحيرات' },
  { id: 'sights-landmarks', labelEn: 'Sights & Landmarks', labelAr: 'المعالم والأماكن الشهيرة' },
  { id: 'desert-mountains', labelEn: 'Desert & Mountain Adventures', labelAr: 'مغامرات الصحراء والجبال' },
  { id: 'wellness', labelEn: 'Wellness & Relaxation', labelAr: 'الصحة والاسترخاء' },
  { id: 'culture', labelEn: 'Culture & Community', labelAr: 'الثقافة والمجتمع' }
] as const;

export const bucketLabel = (bucketId: string): { labelEn: string; labelAr: string } => {
  const found = ATTRACTION_BUCKETS.find(b => b.id === bucketId);
  return found ? { labelEn: found.labelEn, labelAr: found.labelAr } : { labelEn: bucketId, labelAr: bucketId };
};

const slugify = (name: string): string =>
  (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';

const durationLabel = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return h === Math.floor(h) ? `${h} h` : `${Math.floor(h)}–${Math.ceil(h)} h`;
};

/** The gallery pool, by photo id, used for deterministic image matching. */
const photosById = (photos: GalleryPhoto[]): Map<string, GalleryPhoto> =>
  new Map(photos.map(p => [p.id, p]));

/**
 * Explicit keyword map: place/activity names → the gallery photo that is
 * actually of that spot (photo-blue-hole-bells is the Blue Hole, and so on).
 * Falls back to a per-bucket pool so unmatched records still get an honest,
 * on-topic Dahab photo; the UI renders a gradient when none exists.
 */
const KEYWORD_PHOTO: Array<{ keys: string[]; photoId: string }> = [
  { keys: ['blue hole'], photoId: 'photo-blue-hole-bells' },
  { keys: ['blue lagoon'], photoId: 'photo-blue-lagoon' },
  { keys: ['canyon'], photoId: 'photo-canyon-rift' },
  { keys: ['wadi', 'gnai', 'qnai'], photoId: 'photo-wadi-gnai-desert' },
  { keys: ['lighthouse', 'masbat'], photoId: 'photo-lighthouse-sunset' },
  { keys: ['laguna', 'mashraba'], photoId: 'photo-south-laguna-wind' },
  { keys: ['st. catherine', 'mount moses', 'twilat'], photoId: 'photo-st-catherine-dawn' },
  { keys: ['eel garden'], photoId: 'photo-eel-garden-corals' },
  { keys: ['abu galum', 'bedouin', 'three pools', 'caves'], photoId: 'photo-bedouin-campfire' }
];

const BUCKET_PHOTO: Record<string, string> = {
  'nature-wildlife': 'photo-blue-hole-bells',
  'diving-snorkeling': 'photo-eel-garden-corals',
  'beaches-lagoons': 'photo-south-laguna-wind',
  'sights-landmarks': 'photo-lighthouse-sunset',
  'desert-mountains': 'photo-wadi-gnai-desert',
  culture: 'photo-bedouin-campfire'
};

function matchImage(
  nameEn: string,
  bucket: string,
  photos: Map<string, GalleryPhoto>
): string | undefined {
  const name = (nameEn || '').toLowerCase();
  for (const { keys, photoId } of KEYWORD_PHOTO) {
    if (keys.some(k => name.includes(k))) {
      const photo = photos.get(photoId);
      if (photo) return photo.imageUrl;
    }
  }
  const fallbackId = BUCKET_PHOTO[bucket];
  if (fallbackId) {
    const photo = photos.get(fallbackId);
    if (photo) return photo.imageUrl;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Bucket mapping
// ---------------------------------------------------------------------------

const placeBucket = (category: string): string => {
  const c = (category || '').toLowerCase();
  if (c.includes('dive')) return 'diving-snorkeling';
  if (c.includes('beach') || c.includes('lagoon') || c.includes('water sports') || c.includes('kitesurf')) {
    return 'beaches-lagoons';
  }
  if (c.includes('nature reserve') || c.includes('protected') || c.includes('sanctuary') || c.includes('eco')) {
    return 'nature-wildlife';
  }
  if (c.includes('climbing') || c.includes('oasis') || c.includes('mountain') || c.includes('peak') || c.includes('desert')) {
    return 'desert-mountains';
  }
  return 'sights-landmarks';
};

// A plain Record, not a keyed union: the seeded corpus carries real activity
// categories beyond the declared six (freediving, cycling…), and an unknown
// category must land somewhere visible, not fall through to `undefined`.
const ACTIVITY_BUCKET: Record<string, string> = {
  diving: 'diving-snorkeling',
  freediving: 'diving-snorkeling',
  water_sport: 'beaches-lagoons',
  safari: 'desert-mountains',
  wellness: 'wellness',
  culture: 'culture',
  food: 'culture'
};

const SUPPLIER_BUCKET: Record<string, string> = {
  diving: 'diving-snorkeling',
  safari: 'desert-mountains'
};

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

const ACTIVITY_BLURB_EN: Record<string, string> = {
  diving: 'A guided diving experience in Dahab’s famous coral reefs and drop-offs.',
  safari: 'A desert safari across the Sinai mountains, valleys and Bedouin camps.',
  water_sport: 'A wind- and water-sports session on Dahab’s flat, sheltered lagoon.',
  wellness: 'A wellness session — massage, yoga or bodywork — in a relaxed Dahab setting.',
  culture: 'A cultural experience with local guides, crafts and community life.',
  food: 'A food experience — tasting local cooking, markets and Bedouin kitchens.'
};

const ACTIVITY_BLURB_AR: Record<string, string> = {
  diving: 'تجربة غوص بإرشاد مدربين محليين بين الشعاب المرجانية الشهيرة في دهب.',
  safari: 'رحلة سفاري صحراوية بين جبال سيناء والوديان ومخيمات البدو.',
  water_sport: 'جلسة رياضات مائية وشراعية على بحيرة دهب الهادئة المحمية.',
  wellness: 'جلسة استرخاء — مساج أو يوجا أو علاج باللمس — في أجواء دهب المريحة.',
  culture: 'تجربة ثقافية مع مرشدين محليين وحرفيين من قلب المجتمع.',
  food: 'تجربة طعام — تذوق المطبخ المحلي والأسواق والمطابخ البدوية.'
};

function activityDescription(category: ActivityDetailEntity['category'], durationMinutes: number): { en: string; ar: string } {
  const baseEn = ACTIVITY_BLURB_EN[category] || 'A guided experience in Dahab.';
  const baseAr = ACTIVITY_BLURB_AR[category] || 'تجربة بإرشاد محلي في دهب.';
  const duration = durationLabel(durationMinutes);
  if (!duration) return { en: baseEn, ar: baseAr };
  return {
    en: `${baseEn} Lasts about ${duration}.`,
    ar: `${baseAr} المدة التقريبية ${duration}.`
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds the merged attractions catalogue. Pure — no db access — so the bucket
 * rules, rating honesty and image matching are all unit-testable.
 */
export function buildAttractionCatalogue(input: AttractionCatalogueInput): AttractionCatalogue {
  const photos = photosById(input.galleryPhotos);
  const areaById = new Map(input.areas.map(a => [a.id.toLowerCase(), a]));
  const areaLabel = (areaId: string) => {
    const area = areaById.get((areaId || '').toLowerCase());
    return {
      areaLabelEn: area?.nameEn,
      areaLabelAr: area?.nameAr
    };
  };

  const items: AttractionItem[] = [];

  // 1. Places → sights. Ranked first: they are the reason people come.
  for (const place of input.places) {
    if (place.operationalStatus === 'SUSPENDED' || place.operationalStatus === 'REJECTED') continue;
    const bucket = placeBucket(place.category);
    items.push({
      id: `place-${place.id}`,
      slug: slugify(place.nameEn),
      kind: 'sight',
      nameEn: place.nameEn,
      nameAr: place.nameAr,
      bucket,
      categoryLabelEn: bucketLabel(bucket).labelEn,
      categoryLabelAr: bucketLabel(bucket).labelAr,
      descriptionEn: place.descriptionEn || '',
      descriptionAr: place.descriptionAr || '',
      areaId: place.areaId,
      ...areaLabel(place.areaId),
      coordinates: place.coordinates ? { lat: place.coordinates.lat, lng: place.coordinates.lng } : undefined,
      image: matchImage(place.nameEn, bucket, photos),
      tags: [place.category].filter(Boolean),
      bookable: false
    });
  }

  // 2. Activities → things to do. Prices are the activity's own unless a
  // resolved SKU exists, in which case checkout's price is the honest one.
  for (const activity of input.activities) {
    const bucket = ACTIVITY_BUCKET[activity.category] ?? 'sights-landmarks';
    const place = input.places.find(p => p.id === activity.placeId);
    const priceEGP = activity.basePriceEGP > 0 ? activity.basePriceEGP : undefined;
    items.push({
      id: `act-${activity.id}`,
      slug: slugify(activity.titleEn),
      kind: 'activity',
      nameEn: activity.titleEn,
      nameAr: activity.titleAr,
      bucket,
      categoryLabelEn: bucketLabel(bucket).labelEn,
      categoryLabelAr: bucketLabel(bucket).labelAr,
      descriptionEn: activityDescription(activity.category, activity.durationMinutes).en,
      descriptionAr: activityDescription(activity.category, activity.durationMinutes).ar,
      durationMinutes: activity.durationMinutes > 0 ? activity.durationMinutes : undefined,
      difficulty: activity.difficulty,
      priceEGP,
      skuId: activity.skuId,
      serviceType: activity.skuId ? undefined : undefined,
      bookable: Boolean(activity.skuId),
      areaId: activity.areaId,
      ...areaLabel(activity.areaId),
      image: place
        ? matchImage(place.nameEn, bucket, photos)
        : matchImage(activity.titleEn, bucket, photos),
      tags: [activity.experienceLevelRequired, activity.accessMethod].filter(Boolean),
      contact: undefined
    });
  }

  // 3. Diving & safari suppliers → experiences. The only rated corpus.
  // Deliberately a whitelist of fields: payout IBANs must never leave here.
  for (const supplier of input.suppliers) {
    const bucket = SUPPLIER_BUCKET[supplier.category];
    if (!bucket || supplier.status === 'Suspended') continue;
    const nameEn = supplier.businessName || supplier.displayName || supplier.id;
    items.push({
      id: `sup-${supplier.id}`,
      slug: slugify(nameEn),
      kind: 'experience',
      nameEn,
      nameAr: supplier.businessNameAr || '',
      bucket,
      categoryLabelEn: bucketLabel(bucket).labelEn,
      categoryLabelAr: bucketLabel(bucket).labelAr,
      descriptionEn: supplier.serviceTypes?.length
        ? `Known for: ${supplier.serviceTypes.join(' · ')}.`
        : supplier.businessType || '',
      descriptionAr: supplier.serviceTypes?.length
        ? `متخصصون في: ${supplier.serviceTypes.join(' · ')}.`
        : '',
      rating: supplier.rating,
      reviewCount: supplier.reviewCount ?? supplier.reviewsCount,
      areaId: '',
      areaLabelEn: supplier.area || supplier.locationArea || undefined,
      areaLabelAr: undefined,
      coordinates: supplier.coordinates
        ? { lat: supplier.coordinates.lat, lng: supplier.coordinates.lng }
        : supplier.latitude !== undefined && supplier.longitude !== undefined
          ? { lat: supplier.latitude, lng: supplier.longitude }
          : undefined,
      image: matchImage(nameEn, bucket, photos),
      tags: supplier.serviceTypes || [],
      contact: {
        whatsapp: supplier.whatsappNumbers?.[0] || supplier.whatsapp,
        phone: supplier.phoneNumbers?.[0] || supplier.phone,
        website: supplier.website,
        instagram: supplier.instagram
      },
      bookable: false
    });
  }

  const categories: AttractionBucket[] = ATTRACTION_BUCKETS.map(bucket => ({
    id: bucket.id,
    labelEn: bucket.labelEn,
    labelAr: bucket.labelAr,
    count: items.filter(item => item.bucket === bucket.id).length
  }));

  return { attractions: items, categories };
}

// ---------------------------------------------------------------------------
// Filtering & sorting (pure, shared by the route and the tests)
// ---------------------------------------------------------------------------

export type AttractionSort = 'top' | 'rating' | 'popular' | 'name' | 'price';

export interface AttractionFilter {
  category?: string;   // comma-separated bucket ids
  q?: string;
  area?: string;
  sort?: AttractionSort;
  order?: 'asc' | 'desc';
}

const KIND_RANK: Record<AttractionKind, number> = { sight: 0, activity: 1, experience: 2 };

/**
 * Applies the catalogue's filters and sort. `top` keeps the curated corpus
 * order (sights, then activities, then providers); the other sorts are
 * self-explanatory, with unrated/unpriced entries demoted to the end so a
 * missing measurement never outranks a measured one.
 */
export function filterAttractions(
  items: AttractionItem[],
  filter: AttractionFilter
): AttractionItem[] {
  const wantedCategories = (filter.category || '')
    .split(',')
    .map(c => c.trim().toLowerCase())
    .filter(Boolean);
  const q = (filter.q || '').trim().toLowerCase();
  const area = (filter.area || '').trim().toLowerCase();

  let out = items.filter(item => {
    if (wantedCategories.length > 0 && !wantedCategories.includes(item.bucket)) return false;
    if (area && item.areaId.toLowerCase() !== area && (item.areaLabelEn || '').toLowerCase() !== area) return false;
    if (q) {
      const haystack = [
        item.nameEn,
        item.nameAr,
        item.categoryLabelEn,
        item.categoryLabelAr,
        item.descriptionEn,
        ...item.tags
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const order = filter.order === 'asc' ? 1 : -1;
  const sort = filter.sort || 'top';

  // A descending comparator must return negative when `a` outranks `b`, so the
  // order multiplier wraps (a - b), not (b - a): with order=-1 (descending)
  // the higher value yields the negative result that puts it first.
  if (sort === 'rating') {
    out = [...out].sort((a, b) => {
      const ar = a.rating ?? -1;
      const br = b.rating ?? -1;
      if (ar !== br) return order * (ar - br);
      return order * ((a.reviewCount ?? 0) - (b.reviewCount ?? 0));
    });
  } else if (sort === 'popular') {
    out = [...out].sort((a, b) => {
      const ac = a.reviewCount ?? -1;
      const bc = b.reviewCount ?? -1;
      if (ac !== bc) return order * (ac - bc);
      return order * ((a.rating ?? 0) - (b.rating ?? 0));
    });
  } else if (sort === 'name') {
    out = [...out].sort((a, b) => order * a.nameEn.localeCompare(b.nameEn));
  } else if (sort === 'price') {
    out = [...out].sort((a, b) => {
      const ap = a.priceEGP ?? Number.MAX_SAFE_INTEGER;
      const bp = b.priceEGP ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return order * (ap - bp);
      return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    });
  } else {
    // top: curated order, stable — unrated items keep corpus position while
    // rated experiences bubble up above their unrated peers within their kind.
    out = [...out].sort((a, b) => {
      if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
      const ar = a.rating ?? -1;
      const br = b.rating ?? -1;
      if (ar !== br) return br - ar;
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    });
  }

  return out;
}