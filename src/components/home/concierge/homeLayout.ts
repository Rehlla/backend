import {
  HOME_SECTION_IDS,
  type HomeSectionId,
  type HomeSectionRow
} from '../../../shared/homeSections';
import type { HomepageContent } from '../../../services/api';

/**
 * What the homepage renders, and in what order — decided from CMS rows.
 *
 * Pure on purpose: the homepage's composition and the hero's copy are the two
 * things an operator can now change without a deploy, so both are resolved
 * here and asserted in tests/domain/homeLayout instead of being tangled into
 * JSX.
 */

/**
 * Ordered ids to render.
 *
 * `visible: 0` drops a section. `sort_order` orders the ones that remain; an
 * id with no CMS row keeps its shipped slot (and stays visible), so a database
 * that has never been seeded renders the page exactly as compiled — the CMS is
 * an override, never a prerequisite.
 */
export function resolveHomeLayout(
  sections?: readonly HomeSectionRow[] | null
): HomeSectionId[] {
  const rows = new Map<HomeSectionId, HomeSectionRow>();
  for (const row of sections ?? []) {
    if (HOME_SECTION_IDS.includes(row.section_key as HomeSectionId)) {
      rows.set(row.section_key as HomeSectionId, row);
    }
  }

  const slot = (id: HomeSectionId) => rows.get(id)?.sort_order ?? HOME_SECTION_IDS.indexOf(id);

  // The page frame is not reorderable: the hero opens the page, the closing
  // call to action and the footer end it. Stale sort_order rows from an older
  // section vocabulary put the footer mid-page with the photo gallery below
  // it; the CMS can still HIDE these, and orders everything in between.
  const PINNED: Partial<Record<HomeSectionId, number>> = {
    hero: Number.MIN_SAFE_INTEGER,
    final_cta: Number.MAX_SAFE_INTEGER - 1,
    footer: Number.MAX_SAFE_INTEGER,
  };
  const rank = (id: HomeSectionId) => PINNED[id] ?? slot(id);

  return HOME_SECTION_IDS.filter(id => (rows.get(id)?.visible ?? 1) !== 0).sort(
    (a, b) => rank(a) - rank(b)
  );
}

export interface HeroContent {
  imageUrl?: string;
  /** Headline line A. Line B (the italic accent) stays translated. */
  titleA?: string;
  subtitle?: string;
  /** Strongest scrim stop, 0–100 (see HERO_VEIL_DEFAULT when absent). */
  veil?: number;
}

const text = (value: unknown): string | undefined => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * CMS hero → the view model the hero renders, or `{}` when the CMS has nothing
 * to say (the component then falls back to its compiled copy and photo).
 */
export function resolveHeroContent(
  hero: HomepageContent['hero'],
  language: string
): HeroContent {
  if (!hero) return {};
  const config = hero.config || {};
  const arabic = language === 'ar';

  const rawVeil = Number(config.overlay_opacity);
  const veil = Number.isFinite(rawVeil) ? Math.min(100, Math.max(0, Math.round(rawVeil))) : undefined;

  const content: HeroContent = {
    imageUrl: text(config.image_url),
    titleA: text(arabic ? hero.title_ar : hero.title_en),
    subtitle: text(arabic ? config.description_ar : config.description_en)
  };
  if (veil !== undefined) content.veil = veil;

  return content;
}
