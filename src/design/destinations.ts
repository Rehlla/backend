import type { Transition } from 'motion/react';

/**
 * The places REHLA covers (brand board §03). Dahab is the default and the
 * only destination with a full live catalogue today; Nuweiba and Siwa open
 * with editorial content and a growing supplier list (`catalogue: 'early'`),
 * which screens use to set expectations honestly instead of showing empty
 * grids.
 *
 * Colour and tempo live in src/styles/tokens.css under data-destination;
 * this file holds what code needs: names, copy, imagery, and the motion
 * personality for `motion/react`.
 */

export const DESTINATION_IDS = ['dahab', 'sharm', 'hurghada', 'marsa_alam', 'siwa'] as const;
export const ALL_DESTINATION_IDS = ['dahab', 'sharm', 'hurghada', 'marsa_alam', 'siwa', 'nuweiba', 'alexandria', 'giza', 'luxor', 'aswan', 'saint_catherine', 'taba'] as const;
export type DestinationId = (typeof ALL_DESTINATION_IDS)[number];
export type SubDestinationId = 'ras_mohamed' | 'colored_canyon' | 'abu_simbel';
export const PARENT_MAP: Record<SubDestinationId, DestinationId> = {
  ras_mohamed: 'sharm',
  colored_canyon: 'nuweiba',
  abu_simbel: 'aswan',
};
export const SUB_DESTINATION_IDS = ['ras_mohamed', 'colored_canyon', 'abu_simbel'] as const;
export interface SubDestination {
  id: SubDestinationId;
  name: { en: string; ar: string };
  parent: DestinationId;
  heroImage: string;
  vibe: string;
  color: string;
  coords: { lat: number; lng: number };
}
export const SUB_DESTINATIONS: Record<SubDestinationId, SubDestination> = {
  ras_mohamed: {
    id: 'ras_mohamed',
    name: { en: 'Ras Mohamed', ar: 'راس محمد' },
    parent: 'sharm',
    heroImage: '/images/cities/sub/ras_mohamed.webp',
    vibe: 'محمية وغوص',
    color: '#059669',
    coords: { lat: 27.7694, lng: 34.2097 },
  },
  colored_canyon: {
    id: 'colored_canyon',
    name: { en: 'Colored Canyon', ar: 'الوادي الملون' },
    parent: 'nuweiba',
    heroImage: '/images/cities/sub/colored_canyon.webp',
    vibe: 'وادي الوان',
    color: '#D97706',
    coords: { lat: 29.146, lng: 34.594 },
  },
  abu_simbel: {
    id: 'abu_simbel',
    name: { en: 'Abu Simbel Temple Complex', ar: 'معبد أبو سمبل' },
    parent: 'aswan',
    heroImage: '/images/cities/sub/abu_simbel.webp',
    vibe: 'معابد ضخمة',
    color: '#FBBF24',
    coords: { lat: 22.3372, lng: 31.6256 },
  },
};
export const DEFAULT_DESTINATION: DestinationId = 'dahab';

export interface Destination {
  id: DestinationId;
  name: { en: string; ar: string };
  /** Design-system name for the palette (shown in staff tools only). */
  system: string;
  tagline: { en: string; ar: string };
  mood: { en: string[]; ar: string[] };
  catalogue: 'live' | 'early';
  /** Theme colour for the browser chrome, per theme. */
  chrome: { abyss: string; salt: string };
  /** Representative swatch pair for pickers (water/land). */
  swatch: [string, string];
  /**
   * Home hero photograph (public/images). Nuweiba and Siwa use representative
   * library photos until real photography of each place lands; swap the path,
   * nothing else changes.
   */
  heroImage: string;
  /** CSS object-position for the hero crop. */
  heroFocus?: string;
  /** Sub-destinations that live inside this city's boundary (Sprint 6.1). */
  subDestinations?: readonly SubDestinationId[];
  /** Motion personality: how springs feel in this place. */
  motion: {
    spring: Transition;
    layout: Transition;
    /** Multiplier for stagger delays between list items. */
    stagger: number;
  };
}

export const DESTINATIONS: Record<DestinationId, Destination> = {
  dahab: {
    id: 'dahab',
    name: { en: 'Dahab', ar: 'دهب' },
    system: 'Granite & Lagoon',
    tagline: { en: 'Where the desert meets the sea', ar: 'هنا الصحرا بتقابل البحر' },
    mood: { en: ['Energetic', 'Adventurous', 'Social'], ar: ['نشاط', 'مغامرة', 'ناس'] },
    catalogue: 'live',
    chrome: { abyss: '#0B151C', salt: '#F5F4F0' },
    swatch: ['#1F9D97', '#9A5642'],
    // Same photograph the CMS hero ships with (HERO_IMAGE_DEFAULT).
    heroImage: '/images/cities/dahab.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'spring', stiffness: 420, damping: 30 },
      layout: { type: 'spring', stiffness: 380, damping: 32 },
      stagger: 1,
    },
  },
  sharm: {
    id: 'sharm',
    name: { en: 'Sharm El Sheikh', ar: 'شرم الشيخ' },
    system: 'Reef & Bay',
    tagline: { en: 'Where the reef keeps the promise', ar: 'الش reef بيوعد' },
    mood: { en: ['Azure', 'Lively', 'Deep', 'Family'], ar: ['أزرق', 'حيوي', 'عميق', 'عائلي'] },
    catalogue: 'early',
    chrome: { abyss: '#0A1A2A', salt: '#FEF3C7' },
    swatch: ['#0EA5E9', '#60A5FA'],
    // Representative library photo until real photography of the city lands.
    heroImage: '/images/cities/sharm.webp',
    heroFocus: '50% 45%',
    motion: {
      spring: { type: 'spring', stiffness: 400, damping: 29 },
      layout: { type: 'spring', stiffness: 360, damping: 31 },
      stagger: 1.1,
    },
    subDestinations: ['ras_mohamed'] as const,
  },
  hurghada: {
    id: 'hurghada',
    name: { en: 'Hurghada', ar: 'الغردقة' },
    system: 'Marina & Marsh',
    tagline: { en: 'A long coast and a slow afternoon', ar: 'ساحل طويل و ظهيرة على مهل' },
    mood: { en: ['Easy', 'Warm', 'Social', 'Easy-going'], ar: ['سهل', 'دفا', 'اجتماعي', 'مريح'] },
    catalogue: 'early',
    chrome: { abyss: '#1A1A0A', salt: '#FEF9E7' },
    swatch: ['#F59E0B', '#FDE68A'],
    // Representative library photo until real photography of the city lands.
    heroImage: '/images/cities/hurghada.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'spring', stiffness: 390, damping: 30 },
      layout: { type: 'spring', stiffness: 350, damping: 33 },
      stagger: 1.2,
    },
  },
  marsa_alam: {
    id: 'marsa_alam',
    name: { en: 'Marsa Alam', ar: 'مرسى علم' },
    system: 'Wild Coast',
    tagline: { en: 'The coast that still keeps its secrets', ar: 'ساحل لسه بيحتفظ بأساره' },
    mood: { en: ['Untouched', 'Quiet', 'Wild', 'Adventurous'], ar: ['بعيد', 'هدوء', 'بري', 'مغامرة'] },
    catalogue: 'early',
    chrome: { abyss: '#0A1F1A', salt: '#ECFDF5' },
    swatch: ['#10B981', '#6EE7B7'],
    // Representative library photo until real photography of the city lands.
    heroImage: '/images/cities/marsa_alam.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'spring', stiffness: 410, damping: 30 },
      layout: { type: 'spring', stiffness: 370, damping: 32 },
      stagger: 1.3,
    },
  },
  nuweiba: {
    id: 'nuweiba',
    name: { en: 'Nuweiba', ar: 'نويبع' },
    system: 'Driftwood & Shallows',
    tagline: { en: 'A hut on the shore, and time is yours', ar: 'عشة على البحر، والوقت ملكك' },
    mood: { en: ['Still', 'Simple', 'Unplugged'], ar: ['هدوء', 'بساطة', 'بعيد عن الدوشة'] },
    catalogue: 'early',
    chrome: { abyss: '#0A1F2A', salt: '#CFFAFE' },
    swatch: ['#06B6D4', '#67E8F9'],
    heroImage: '/images/cities/nuweiba.webp',
    heroFocus: '30% 55%',
    subDestinations: ['colored_canyon'] as const,
    motion: {
      spring: { type: 'tween', duration: 0.48, ease: [0.45, 0, 0.2, 1] },
      layout: { type: 'tween', duration: 0.5, ease: [0.45, 0, 0.2, 1] },
      stagger: 1.6,
    },
  },
  siwa: {
    id: 'siwa',
    name: { en: 'Siwa', ar: 'سيوة' },
    system: 'Salt & Palm',
    tagline: { en: 'An oasis that heals', ar: 'واحة بتداوي' },
    mood: { en: ['Healing', 'Warm', 'Contemplative'], ar: ['استشفاء', 'دفا', 'تأمّل'] },
    catalogue: 'early',
    chrome: { abyss: '#16130F', salt: '#F6F2EA' },
    swatch: ['#A3E635', '#D9B583'],
    heroImage: '/images/cities/siwa.webp',
    heroFocus: '55% 50%',
    motion: {
      spring: { type: 'tween', duration: 0.6, ease: [0.37, 0, 0.2, 1] },
      layout: { type: 'tween', duration: 0.7, ease: [0.37, 0, 0.2, 1] },
      stagger: 2,
    },
  },
  aswan: {
    id: 'aswan',
    name: { en: 'Aswan', ar: 'أسوان' },
    system: 'Nile & Nubia',
    tagline: { en: 'The river that carries the sun', ar: 'النيل اللي بيشيل الشمس' },
    mood: { en: ['Calm', 'Golden', 'Historic'], ar: ['هدوء', 'ذهبي', 'تاريخي'] },
    catalogue: 'live',
    chrome: { abyss: '#0A2A36', salt: '#CFFAFE' },
    swatch: ['#06B6D4', '#CFFAFE'],
    heroImage: '/images/cities/aswan.webp',
    subDestinations: ['abu_simbel'] as const,
    heroFocus: '50% 55%',
    motion: {
      spring: { type: 'spring', stiffness: 400, damping: 29 },
      layout: { type: 'spring', stiffness: 360, damping: 31 },
      stagger: 1.5,
    },
  },
  saint_catherine: {
    id: 'saint_catherine',
    name: { en: 'Saint Catherine', ar: 'سانت كاترين' },
    system: 'Monastery & Mountain',
    tagline: { en: 'Where the desert keeps a monastery', ar: 'حيث الصحرا بتحتفظ بدير' },
    mood: { en: ['Sacred', 'Still', 'Mountain'], ar: ['روحاني', 'هدوء', 'جبلي'] },
    catalogue: 'early',
    chrome: { abyss: '#1E1B2E', salt: '#EDE9FE' },
    swatch: ['#7C3AED', '#EDE9FE'],
    heroImage: '/images/cities/saint_catherine.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'tween', duration: 0.55, ease: [0.37, 0, 0.2, 1] },
      layout: { type: 'tween', duration: 0.65, ease: [0.37, 0, 0.2, 1] },
      stagger: 1.8,
    },
  },
  taba: {
    id: 'taba',
    name: { en: 'Taba', ar: 'طابا' },
    system: 'Fjord & Frontier',
    tagline: { en: 'The water that ends one country', ar: 'المياه اللي بتقفل بلد' },
    mood: { en: ['Wild', 'Quiet', 'Frontier'], ar: ['بري', 'هدوء', 'حدود'] },
    catalogue: 'early',
    chrome: { abyss: '#0A1F2E', salt: '#CFFAFE' },
    swatch: ['#0E7490', '#CFFAFE'],
    heroImage: '/images/cities/taba.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'spring', stiffness: 405, damping: 30 },
      layout: { type: 'spring', stiffness: 365, damping: 32 },
      stagger: 1.45,
    },
  },
  alexandria: {
    id: 'alexandria',
    name: { en: 'Alexandria', ar: 'الإسكندرية' },
    system: 'Maritime & Heritage',
    tagline: { en: 'Where the past lives on the sea', ar: 'حيث الماضي يعيش على البحر' },
    mood: { en: ['Historic', 'Grand', 'Cultural'], ar: ['تاريخي', 'عظيم', 'ثقافي'] },
    catalogue: 'live',
    chrome: { abyss: '#0F172A', salt: '#DBEAFE' },
    swatch: ['#3B82F6', '#60A5FA'],
    heroImage: '/images/cities/alexandria.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'spring', stiffness: 410, damping: 30 },
      layout: { type: 'spring', stiffness: 370, damping: 32 },
      stagger: 1.2,
    },
  },
  luxor: {
    id: 'luxor',
    name: { en: 'Luxor', ar: 'الأقصر' },
    system: 'Temples & Desert',
    tagline: { en: 'Where temples stand against the sky', ar: 'حيث المعابد تقف تحت السماء' },
    mood: { en: ['Awe', 'Golden', 'Desert'], ar: ['دهشة', 'ذهبي', 'صحراوي'] },
    catalogue: 'live',
    chrome: { abyss: '#3F1D0A', salt: '#FEF3C7' },
    swatch: ['#F59E0B', '#FEF3C7'],
    heroImage: '/images/cities/luxor.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'spring', stiffness: 430, damping: 27 },
      layout: { type: 'spring', stiffness: 390, damping: 29 },
      stagger: 1.3,
    },
  },
  giza: {
    id: 'giza',
    name: { en: 'Giza', ar: 'الجيزة' },
    system: 'Pyramids & Desert',
    tagline: { en: 'The monuments that outlast time', ar: 'آثار تتجاوز الزمن' },
    mood: { en: ['Awe', 'Mystic', 'Desert'], ar: ['دهشة', 'غموض', 'صحراوي'] },
    catalogue: 'live',
    chrome: { abyss: '#1F1A0A', salt: '#FEF3C7' },
    swatch: ['#F59E0B', '#FDE68A'],
    heroImage: '/images/cities/giza.webp',
    heroFocus: '50% 50%',
    motion: {
      spring: { type: 'spring', stiffness: 420, damping: 28 },
      layout: { type: 'spring', stiffness: 380, damping: 30 },
      stagger: 1.4,
    },
  },
};

export const isDestinationId = (v: unknown): v is DestinationId =>
  typeof v === 'string' && (ALL_DESTINATION_IDS as readonly string[]).includes(v);
