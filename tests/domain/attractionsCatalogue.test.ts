import { describe, expect, it } from 'vitest';
import {
  buildAttractionCatalogue,
  filterAttractions,
  ATTRACTION_BUCKETS
} from '../../server/services/attractionsCatalogue';
import type {
  ActivityDetailEntity,
  AreaProfileEntity,
  PlaceEntity,
  SupplierEntity
} from '../../server/db/schema';
import type { GalleryPhoto } from '../../server/db/seeds/editorialContent';

/**
 * The "Things to Do" catalogue (tripadvisor.com/Attractions mirror) merges
 * places + activities + diving/safari suppliers into Tripadvisor-style buckets.
 * These tests pin the rules that keep it honest:
 *  - only supplier records carry ratings/review counts (nothing is invented)
 *  - payout IBANs never leave the server (whitelisted contact fields only)
 *  - images come from the real editorial gallery pool, matched deterministically
 *  - unrated/unpriced entries demote, never outrank a measured one
 */

const PHOTOS: GalleryPhoto[] = [
  {
    id: 'photo-blue-hole-bells',
    title: 'The Blue Hole & The Bells Chimney',
    titleAr: 'الثقب الأزرق والبيلز',
    spot: 'Blue Hole',
    spotAr: 'البلو هول',
    category: 'diving',
    categoryLabel: 'Dive',
    categoryLabelAr: 'غوص',
    imageUrl: 'https://images.example/blue-hole.jpg',
    photographer: 'x',
    resolution: '4K',
    description: 'd',
    descriptionAr: 'د',
    bestTime: '8am',
    bestTimeAr: '٨ص',
    tags: ['BlueHole']
  },
  {
    id: 'photo-lighthouse-sunset',
    title: 'Lighthouse Sunset',
    titleAr: 'غروب اللايتهاوس',
    spot: 'Lighthouse',
    spotAr: 'اللايتهاوس',
    category: 'sunset',
    categoryLabel: 'Sunset',
    categoryLabelAr: 'غروب',
    imageUrl: 'https://images.example/lighthouse.jpg',
    photographer: 'x',
    resolution: '4K',
    description: 'd',
    descriptionAr: 'د',
    bestTime: '5pm',
    bestTimeAr: '٥م',
    tags: ['Lighthouse']
  }
];

const AREA: AreaProfileEntity = {
  id: 'lighthouse',
  nameEn: 'Lighthouse',
  nameAr: 'اللايتهاوس',
  coordinates: { lat: 28.5, lng: 34.52 },
  radiusMeters: 500,
  atmosphere: 'a',
  atmosphereAr: 'أ',
  personaAffinity: [],
  activityAffinity: [],
  foodAffinity: [],
  walkabilityScore: 8,
  noiseProfile: 'Moderate',
  transportFriction: 'Low (Walking)',
  stayProfile: 's',
  eveningProfile: 'e'
};

const place = (over: Partial<PlaceEntity>): PlaceEntity => ({
  id: 'place-x',
  nameEn: 'Test Place',
  nameAr: 'مكان تجريبي',
  aliases: [],
  arabicNames: [],
  transliterations: [],
  areaId: 'lighthouse',
  category: 'Dive Site',
  coordinates: { lat: 28.5, lng: 34.52 },
  operationalStatus: 'ACTIVE',
  descriptionEn: 'A test sight.',
  descriptionAr: 'معلم تجريبي.',
  verifiedAt: '2026-09-01T00:00:00Z',
  ...over
});

const activity = (over: Partial<ActivityDetailEntity>): ActivityDetailEntity => ({
  id: 'act-1',
  titleEn: 'Guided Blue Hole Dive',
  titleAr: 'غوص البلو هول بإرشاد',
  category: 'diving',
  placeId: 'place-blue-hole',
  areaId: 'blue_hole',
  durationMinutes: 240,
  accessMethod: 'VEHICLE',
  difficulty: 'Intermediate',
  experienceLevelRequired: 'Open Water',
  basePriceEGP: 3400,
  bookingMode: 'BOOK_NOW',
  supplierId: 'SUP-1',
  seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  environmentalSensitivities: {},
  dependencies: [],
  preparationTips: ['Bring a dive computer'],
  preparationTipsAr: ['أحضر كمبيوتر الغوص'],
  travelerFitPersonas: ['Divers'],
  ...over
});

const supplier = (over: Partial<SupplierEntity>): SupplierEntity => ({
  id: 'SUP-DIVE-01',
  businessName: 'Sinai Divers',
  businessNameAr: 'غواصو سيناء',
  category: 'diving',
  tier: 'Tier 1 Certified',
  status: 'Active',
  area: 'Lighthouse',
  rating: 4.9,
  reviewCount: 310,
  serviceTypes: ['Guided Dives', 'PADI Courses'],
  whatsappNumbers: ['+201001112233'],
  payoutAccountNumber: 'EG890002000119284102948102',
  ...over
});

const build = (over: {
  places?: PlaceEntity[];
  activities?: ActivityDetailEntity[];
  suppliers?: SupplierEntity[];
}) =>
  buildAttractionCatalogue({
    places: over.places || [],
    activities: over.activities || [],
    suppliers: over.suppliers || [],
    areas: [AREA],
    galleryPhotos: PHOTOS
  });

describe('attractions catalogue — bucket mapping', () => {
  it('maps places to Tripadvisor-style buckets from their category string', () => {
    const catalogue = build({
      places: [
        // A protected marine reserve is Nature & Wildlife; the same reserve
        // tagged as a dive site is Diving & Snorkeling (the Canyon is both).
        place({ id: 'p-blue-hole', nameEn: 'Blue Hole', category: 'Marine Protected Area' }),
        place({ id: 'p-canyon', nameEn: 'The Canyon', category: 'Marine Protected Area / Dive Site' }),
        place({ id: 'p-wadi', nameEn: 'Wadi Gnai', category: 'Desert Oasis / Climbing Crags' }),
        place({ id: 'p-laguna', nameEn: 'South Laguna', category: 'Water Sports / Lagoon' }),
        place({ id: 'p-masbat', nameEn: 'Masbat Promenade', category: 'Promenade / Bazaar' }),
        place({ id: 'p-ras', nameEn: 'Ras Abu Galum', category: 'Protected Nature Reserve' })
      ]
    });

    const byId = new Map(catalogue.attractions.map(a => [a.id, a]));
    expect(byId.get('place-p-blue-hole')?.bucket).toBe('nature-wildlife');
    expect(byId.get('place-p-canyon')?.bucket).toBe('diving-snorkeling');
    expect(byId.get('place-p-wadi')?.bucket).toBe('desert-mountains');
    expect(byId.get('place-p-laguna')?.bucket).toBe('beaches-lagoons');
    expect(byId.get('place-p-masbat')?.bucket).toBe('sights-landmarks');
    expect(byId.get('place-p-ras')?.bucket).toBe('nature-wildlife');
  });

  it('maps activity categories into the rail', () => {
    const catalogue = build({
      activities: [
        activity({ id: 'a1', category: 'diving' }),
        activity({ id: 'a2', category: 'safari' }),
        activity({ id: 'a3', category: 'water_sport' }),
        activity({ id: 'a4', category: 'wellness' }),
        activity({ id: 'a5', category: 'culture' })
      ]
    });
    const byId = new Map(catalogue.attractions.map(a => [a.id, a]));
    expect(byId.get('act-a1')?.bucket).toBe('diving-snorkeling');
    expect(byId.get('act-a2')?.bucket).toBe('desert-mountains');
    expect(byId.get('act-a3')?.bucket).toBe('beaches-lagoons');
    expect(byId.get('act-a4')?.bucket).toBe('wellness');
    expect(byId.get('act-a5')?.bucket).toBe('culture');
  });

  it('includes only diving/safari suppliers as experiences', () => {
    const catalogue = build({
      suppliers: [
        supplier({ id: 's-dive', category: 'diving' }),
        supplier({ id: 's-safari', category: 'safari' }),
        supplier({ id: 's-hotel', category: 'hotel' }),
        supplier({ id: 's-transfer', category: 'transfer' })
      ]
    });
    const ids = catalogue.attractions.map(a => a.id);
    expect(ids).toContain('sup-s-dive');
    expect(ids).toContain('sup-s-safari');
    expect(ids).not.toContain('sup-s-hotel');
    expect(ids).not.toContain('sup-s-transfer');
  });

  it('counts every bucket and reports categories with counts', () => {
    const catalogue = build({
      places: [place({ id: 'p1', category: 'Dive Site' })],
      activities: [activity({ id: 'a1', category: 'diving' })]
    });
    const diving = catalogue.categories.find(c => c.id === 'diving-snorkeling');
    expect(diving?.count).toBe(2);
    expect(catalogue.categories).toHaveLength(ATTRACTION_BUCKETS.length);
  });
});

describe('attractions catalogue — honesty', () => {
  it('never invents ratings: only suppliers carry rating/reviewCount', () => {
    const catalogue = build({
      places: [place({ id: 'p1', nameEn: 'Blue Hole' })],
      activities: [activity({ id: 'a1', nameEn: 'Guided Dive' })],
      suppliers: [supplier({ id: 's1' })]
    });
    const byId = new Map(catalogue.attractions.map(a => [a.id, a]));

    const sight = byId.get('place-p1')!;
    const act = byId.get('act-a1')!;
    const exp = byId.get('sup-s1')!;

    expect(sight.rating).toBeUndefined();
    expect(sight.reviewCount).toBeUndefined();
    expect(act.rating).toBeUndefined();
    expect(exp.rating).toBe(4.9);
    expect(exp.reviewCount).toBe(310);
  });

  it('never leaks payout details: supplier items carry a contact whitelist only', () => {
    const catalogue = build({ suppliers: [supplier({ id: 's1' })] });
    const exp = catalogue.attractions.find(a => a.kind === 'experience')!;
    expect(JSON.stringify(exp)).not.toContain('payout');
    expect(JSON.stringify(exp)).not.toContain('EG890002');
    expect(exp.contact).toEqual({ whatsapp: '+201001112233' });
  });

  it('does not publish suspended suppliers', () => {
    const catalogue = build({ suppliers: [supplier({ id: 's1', status: 'Suspended' })] });
    expect(catalogue.attractions.filter(a => a.kind === 'experience')).toHaveLength(0);
  });
});

describe('attractions catalogue — images', () => {
  it('matches a place name to the real gallery photo of that spot', () => {
    const catalogue = build({ places: [place({ id: 'p1', nameEn: 'The Blue Hole National Marine Reserve' })] });
    expect(catalogue.attractions[0].image).toBe('https://images.example/blue-hole.jpg');
  });

  it('falls back to a per-bucket pool photo for unmatched names', () => {
    const catalogue = build({ places: [place({ id: 'p1', nameEn: 'Mystery Reef', category: 'Reef Sanctuary' })] });
    expect(catalogue.attractions[0].image).toBe('https://images.example/blue-hole.jpg');
  });
});

describe('attractions catalogue — filtering and sorting', () => {
  const catalogue = build({
    places: [
      place({ id: 'p1', nameEn: 'Blue Hole', category: 'Dive Site' }),
      place({ id: 'p2', nameEn: 'Masbat Promenade', category: 'Promenade / Bazaar' })
    ],
    activities: [activity({ id: 'a1', titleEn: 'Guided Dive', basePriceEGP: 3400 })],
    suppliers: [
      supplier({ id: 's1', rating: 4.9, reviewCount: 310 }),
      supplier({ id: 's2', rating: 4.6, reviewCount: 94 })
    ]
  });

  it('filters by category bucket', () => {
    const filtered = filterAttractions(catalogue.attractions, { category: 'diving-snorkeling' });
    expect(filtered.map(a => a.id).sort()).toEqual(['act-a1', 'place-p1', 'sup-s1', 'sup-s2'].sort());
  });

  it('searches names and tags', () => {
    const byName = filterAttractions(catalogue.attractions, { q: 'blue hole' });
    expect(byName.map(a => a.id)).toEqual(['place-p1']);

    const byTag = filterAttractions(catalogue.attractions, { q: 'PADI' });
    expect(byTag.map(a => a.id).sort()).toEqual(['sup-s1', 'sup-s2'].sort());
  });

  it('sorts by rating with unrated entries demoted to the end', () => {
    const sorted = filterAttractions(catalogue.attractions, { sort: 'rating' });
    expect(sorted[0].id).toBe('sup-s1');
    expect(sorted[1].id).toBe('sup-s2');
    // places/activities carry no measured rating → demoted, never above a
    // measured provider (unrated peers keep their stable corpus order)
    const ratedFirst = sorted.slice(0, 2).map(a => a.id);
    expect(ratedFirst).toEqual(['sup-s1', 'sup-s2']);
    const tail = sorted.slice(2).map(a => a.id).sort();
    expect(tail).toEqual(['act-a1', 'place-p1', 'place-p2'].sort());
  });

  it('sorts by price ascending with unpriced entries last', () => {
    const sorted = filterAttractions(catalogue.attractions, { sort: 'price', order: 'asc' });
    expect(sorted[0].id).toBe('act-a1'); // the only priced item
    expect(sorted[sorted.length - 1].id).not.toBe('act-a1');
  });

  it('sorts by name ascending and descending', () => {
    const asc = filterAttractions(catalogue.attractions, { sort: 'name', order: 'asc' });
    expect(asc[0].nameEn <= asc[asc.length - 1].nameEn).toBe(true);
    const desc = filterAttractions(catalogue.attractions, { sort: 'name', order: 'desc' });
    expect(desc[0].nameEn >= desc[desc.length - 1].nameEn).toBe(true);
  });

  it('keeps curated order (sights first) under the default top sort', () => {
    const top = filterAttractions(catalogue.attractions, { sort: 'top' });
    expect(top[0].kind).toBe('sight');
  });
});