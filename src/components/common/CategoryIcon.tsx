import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  Camera,
  Coffee,
  Compass,
  Fish,
  Flame,
  Footprints,
  HeartPulse,
  Landmark,
  Luggage,
  Moon,
  Mountain,
  Music,
  Sparkles,
  Star,
  Sun,
  Sunset,
  Tent,
  UtensilsCrossed,
  Waves,
} from 'lucide-react';

/**
 * CategoryIcon — the single glyph source for semantic category labels.
 *
 * The sweep replaced emoji-as-icons (54 sites across 14 files) with this
 * map: one semantic key → one Lucide icon, so Explore pills, Live spot
 * selectors, attraction buckets, food moods, companion itineraries and
 * memory entries all render the same glyph language. Decorative icons are
 * aria-hidden; any adjacent text stays in the DOM for screen readers.
 */

export type CategoryKind =
  | 'food'
  | 'coffee'
  | 'reef'
  | 'evening'
  | 'experience'
  | 'dive'
  | 'snorkel'
  | 'sunset'
  | 'desert'
  | 'relaxation'
  | 'wellness'
  | 'culture'
  | 'nature'
  | 'landmark'
  | 'camera'
  | 'star'
  | 'sparkles'
  | 'tent'
  | 'walk'
  | 'luggage'
  | 'stay'
  | 'campfire'
  | 'ocean';

const ICONS: Record<CategoryKind, LucideIcon> = {
  food: UtensilsCrossed,
  coffee: Coffee,
  reef: Waves,
  evening: Moon,
  experience: Compass,
  dive: Waves,
  snorkel: Fish,
  sunset: Sunset,
  desert: Mountain,
  relaxation: Sun,
  wellness: HeartPulse,
  culture: Music,
  nature: Fish,
  landmark: Landmark,
  camera: Camera,
  star: Star,
  sparkles: Sparkles,
  tent: Tent,
  walk: Footprints,
  luggage: Luggage,
  stay: BedDouble,
  campfire: Flame,
  ocean: Waves,
};

export function CategoryIcon({ kind, className }: { kind: CategoryKind; className?: string }) {
  const Icon = ICONS[kind] ?? Sparkles;
  return <Icon aria-hidden="true" className={className} />;
}