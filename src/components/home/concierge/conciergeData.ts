import type { AppRoute } from '../../../types';

/**
 * Concierge service catalogue — the six doors into Dahab.
 *
 * Every entry routes to a REAL surface that already exists in the app.
 * No invented booking behaviour: the explorer only navigates.
 */
export interface ConciergeService {
  id: 'stay' | 'eat' | 'move' | 'dive' | 'explore' | 'care';
  route: AppRoute;
  image: string;
  labelKey: string;
  lineKey: string;
  detailKey: string;
}

export const CONCIERGE_SERVICES: ConciergeService[] = [
  {
    id: 'stay',
    route: '/hotels',
    image: '/images/hotels/le-meridien.jpg',
    labelKey: 'concierge.services.stay',
    lineKey: 'concierge.services.stayLine',
    detailKey: 'concierge.services.stayDetail',
  },
  {
    id: 'eat',
    route: '/restaurants',
    image: '/images/restaurants/ali-baba-restaurant.jpg',
    labelKey: 'concierge.services.eat',
    lineKey: 'concierge.services.eatLine',
    detailKey: 'concierge.services.eatDetail',
  },
  {
    id: 'move',
    route: '/transfers/intercity',
    image: '/images/attractions/sinai-desert-safari.jpg',
    labelKey: 'concierge.services.move',
    lineKey: 'concierge.services.moveLine',
    detailKey: 'concierge.services.moveDetail',
  },
  {
    id: 'dive',
    route: '/book-now',
    image: '/images/attractions/blue-hole.jpg',
    labelKey: 'concierge.services.dive',
    lineKey: 'concierge.services.diveLine',
    detailKey: 'concierge.services.diveDetail',
  },
  {
    id: 'explore',
    route: '/explore',
    image: '/images/attractions/ras-abu-galum-spit.jpg',
    labelKey: 'concierge.services.explore',
    lineKey: 'concierge.services.exploreLine',
    detailKey: 'concierge.services.exploreDetail',
  },
  {
    id: 'care',
    route: '/help',
    image: '/images/hero/camels-beach.jpg',
    labelKey: 'concierge.services.care',
    lineKey: 'concierge.services.careLine',
    detailKey: 'concierge.services.careDetail',
  },
];

export interface ConciergeIntent {
  id: string;
  labelKey: string;
  /** Matched against ReadyTripProgram.defaultInterests (case-insensitive substring). */
  match: string[];
}

export const CONCIERGE_INTENTS: ConciergeIntent[] = [
  { id: 'relax', labelKey: 'concierge.intent.relax', match: ['Beach'] },
  { id: 'adventure', labelKey: 'concierge.intent.adventure', match: ['Adventure'] },
  { id: 'sea', labelKey: 'concierge.intent.sea', match: ['Diving'] },
  { id: 'food', labelKey: 'concierge.intent.food', match: ['Food'] },
  { id: 'desert', labelKey: 'concierge.intent.desert', match: ['Adventure', 'Local Life'] },
  { id: 'family', labelKey: 'concierge.intent.family', match: ['Beach', 'Local Life'] },
];

export interface StoryFrame {
  src: string;
  alt: string;
  captionEn: string;
  captionAr: string;
}

/**
 * Visual inspiration — real photography already shipped in public/images.
 * Captions are editorial, prices/availability are never implied here.
 */
export const STORY_FRAMES: StoryFrame[] = [
  {
    src: '/images/hero/coral-reef-split.jpg',
    alt: 'Split view of coral reef above and below the Red Sea surface',
    captionEn: 'Morning reef light',
    captionAr: 'نور الشعاب الصبح',
  },
  {
    src: '/images/hero/camels-beach.jpg',
    alt: 'Bedouin camels resting on the Dahab beach',
    captionEn: 'Lighthouse shore, unhurried',
    captionAr: 'شاطئ اللايتهاوس بروقان',
  },
  {
    src: '/images/attractions/blue-hole.jpg',
    alt: 'The Blue Hole sinkhole from above',
    captionEn: 'The Blue Hole',
    captionAr: 'البلوهول',
  },
  {
    src: '/images/hero/gulf-sunset.jpg',
    alt: 'Sunset over the Gulf of Aqaba and Sinai mountains',
    captionEn: 'Gulf sunset',
    captionAr: 'غروب الخليج',
  },
  {
    src: '/images/attractions/bouldering-wadi-gnai.jpg',
    alt: 'Granite boulders in Wadi Gnai canyon',
    captionEn: 'Wadi Gnai granite',
    captionAr: 'جرانيت وادي قني',
  },
  {
    src: '/images/restaurants/breakfast-by-the-sea.jpg',
    alt: 'Breakfast table by the sea in Dahab',
    captionEn: 'Breakfast by the water',
    captionAr: 'فطار على المية',
  },
  {
    src: '/images/hero/blue-lagoon-kitesurf.jpg',
    alt: 'Kitesurfer over the turquoise Blue Lagoon',
    captionEn: 'Lagoon wind',
    captionAr: 'هوا اللاجونا',
  },
];
