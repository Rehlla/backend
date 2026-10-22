/**
 * The homepage's section list — the one place that says which sections exist.
 *
 * Three consumers read it and must not drift: the CMS seed writes exactly
 * these rows, the homepage renders exactly these sections in this default
 * order, and the admin panel labels them. Before this, each had its own list:
 * the seed wrote thirteen keys for sections the page no longer rendered, so
 * the panel edited a homepage that did not exist. Now `sort_order`/`visible`
 * and the shipped order have one shared vocabulary, and `anchor` is the DOM
 * node a section proves itself with — tests/domain/homeSections reads this
 * list and fails if a section stops being rendered.
 *
 * Deliberately no copy here: labels live in translations.ts
 * (`cms.homeSections.<id>.label`) so the client never ships a second language
 * catalog, and the seed reads the same keys.
 */
export interface HomeSectionSpec {
  id: HomeSectionId;
  /** Selector for the node this section renders. Used by the drift guard. */
  anchor: string;
  /**
   * Editor-exposed config keys. Empty means the section is visibility/order
   * only — the panel renders nothing else, so no dead fields are promised.
   */
  fields: readonly HomeSectionField[];
}

export type HomeSectionField =
  | 'image_url'
  | 'description_en'
  | 'description_ar'
  | 'overlay_opacity';

export type HomeSectionId =
  | 'hero'
  | 'next_step'
  | 'services'
  | 'experiences'
  | 'intent'
  | 'itineraries'
  | 'stories'
  | 'final_cta'
  | 'footer';

/** Shipped order. CMS `sort_order` reorders from here; absent rows keep a slot. */
export const HOME_SECTIONS: readonly HomeSectionSpec[] = [
  { id: 'hero', anchor: 'section[data-home-section="hero"]', fields: ['image_url', 'description_en', 'description_ar', 'overlay_opacity'] },
  { id: 'next_step', anchor: '#concierge-nextstep', fields: [] },
  { id: 'services', anchor: '#concierge-services', fields: [] },
  { id: 'experiences', anchor: '#concierge-experiences', fields: [] },
  { id: 'intent', anchor: '#concierge-intent', fields: [] },
  { id: 'itineraries', anchor: '#concierge-itineraries', fields: [] },
  { id: 'stories', anchor: '#concierge-stories', fields: [] },
  { id: 'final_cta', anchor: '#final-cta-section', fields: [] },
  { id: 'footer', anchor: '#dahab-footer', fields: [] }
];

export const HOME_SECTION_IDS: readonly HomeSectionId[] = HOME_SECTIONS.map(s => s.id);

/**
 * Shipped hero defaults. Shared so the client's fallback and the CMS seed's
 * initial value cannot disagree — the hero an un-seeded database renders is
 * exactly the hero an operator sees the moment they first open the panel.
 */
export const HERO_IMAGE_DEFAULT = '/images/hero/coral-reef-split.jpg';
/** Strongest scrim stop, 0–100. The hero scales its other stops from this. */
export const HERO_VEIL_DEFAULT = 88;

/**
 * The row shape the layout needs, structurally — so this module stays free of
 * server and API types.
 */
export interface HomeSectionRow {
  section_key: string;
  visible: number;
  sort_order: number;
}
