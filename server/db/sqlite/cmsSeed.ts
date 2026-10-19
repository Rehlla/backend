import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from './SqlitePersistenceAdapter';
import { db } from '../database';
import {
  HERO_IMAGE_DEFAULT,
  HERO_VEIL_DEFAULT,
  HOME_SECTIONS,
  HOME_SECTION_IDS
} from '../../../src/shared/homeSections';
import { TRANSLATIONS } from '../../../src/i18n/translations';

/**
 * Seed the CMS tables with existing editorial content.
 *
 * The bulk seed runs once when the CMS tables are first created. It populates:
 * - Homepage hero section
 * - 5 trip programmes
 * - 8 gallery photos
 * - 4 curated stories
 * - 5 explore categories
 *
 * The static pages (/about, /faq, /travel-guides) are hard routes in App.tsx,
 * so they are verified idempotently on EVERY boot: databases seeded before
 * those slugs existed backfill them without touching any row an editor owns.
 * After seeding, administrators manage all content through the CMS dashboard.
 */

function getConn(): SqliteDb | null {
  const adapter = db.getAdapter();
  if (adapter instanceof SqlitePersistenceAdapter) return adapter.connection;
  return null;
}

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

/**
 * Homepage section rows — the shipped list, exactly (src/shared/homeSections).
 *
 * The keys here used to name sections the 2026 rebuild deleted (stats,
 * marquee, essence, ticker, season, micro, landmarks, gallery), so the
 * dashboard was editing a homepage nobody saw. The hero's seed values are the
 * copy the hero falls back to, so seeding changes nothing a visitor reads.
 */
const HERO_SEED_CONFIG = {
  image_url: HERO_IMAGE_DEFAULT,
  description_en: TRANSLATIONS['concierge.hero.subtitle'].en,
  description_ar: TRANSLATIONS['concierge.hero.subtitle'].ar,
  overlay_opacity: HERO_VEIL_DEFAULT,
};

/** Insert any missing shipped section. Never overwrites an operator's row. */
function insertHomepageSections(c: SqliteDb): number {
  const ins = c.prepare(`
    INSERT OR IGNORE INTO cms_homepage_sections (id, section_key, title_en, title_ar, visible, sort_order, config, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  HOME_SECTIONS.forEach((spec, index) => {
    const label = TRANSLATIONS[`cms.homeSections.${spec.id}.label`];
    const isHero = spec.id === 'hero';
    const heroTitle = TRANSLATIONS['concierge.hero.titleA'];
    inserted += ins.run(
      id('HSEC'),
      spec.id,
      isHero ? heroTitle.en : label.en,
      isHero ? heroTitle.ar : label.ar,
      1,
      index,
      JSON.stringify(isHero ? HERO_SEED_CONFIG : {}),
      now()
    ).changes;
  });
  return inserted;
}

/**
 * Reconcile an EXISTING database with the shipped section list.
 *
 * The bulk seed runs once, on an empty table, so a database created before
 * this list would keep the dead keys forever and never gain the rows the page
 * reads. This runs on every boot: it inserts only what is missing, and retires
 * rows whose section no longer exists by hiding them — they are operator
 * content, and a key the page does not know is already unreachable.
 */
export function backfillHomepageSections(): void {
  const c = getConn();
  if (!c) return;
  const added = insertHomepageSections(c);
  const placeholders = HOME_SECTION_IDS.map(() => '?').join(', ');
  const retired = c
    .prepare(
      `UPDATE cms_homepage_sections SET visible = 0, updated_at = ?
       WHERE section_key NOT IN (${placeholders}) AND visible <> 0`
    )
    .run(now(), ...HOME_SECTION_IDS).changes;
  if (added || retired) {
    console.log(`[CMS] Homepage sections reconciled: ${added} added, ${retired} retired`);
  }
  const migrated = migrateUntouchedHeroCopy(c);
  if (migrated) console.log('[CMS] Hero copy refreshed to the shipped defaults (it had never been edited)');
}

/**
 * Hero copy that earlier releases seeded verbatim. The seed copies the shipped
 * text into the CMS, so a later copy change (here: Arabic moved to light
 * Egyptian colloquial) would stay hidden behind the old snapshot forever. A
 * row still holding one of these exact strings was never touched by an
 * operator, so it is safe to move it to today's default. Edited rows never
 * match and are left alone.
 */
const LEGACY_HERO_COPY = {
  title_ar: ['حيث يلتقي'],
  description_ar: ['كل اللي تحتاجه في دهب — إقامة وأكل ومواصلات وشعاب وصحراء — في مكان واحد وهادي.'],
};

function migrateUntouchedHeroCopy(c: SqliteDb): number {
  const row = c.prepare("SELECT id, title_ar, config FROM cms_homepage_sections WHERE section_key = 'hero'").get() as
    | { id: string; title_ar: string | null; config: string | null }
    | undefined;
  if (!row) return 0;
  let changed = 0;
  if (row.title_ar && LEGACY_HERO_COPY.title_ar.includes(row.title_ar)) {
    c.prepare('UPDATE cms_homepage_sections SET title_ar = ?, updated_at = ? WHERE id = ?').run(TRANSLATIONS['concierge.hero.titleA'].ar, now(), row.id);
    changed++;
  }
  try {
    const config = row.config ? JSON.parse(row.config) : null;
    if (config && LEGACY_HERO_COPY.description_ar.includes(config.description_ar)) {
      config.description_ar = TRANSLATIONS['concierge.hero.subtitle'].ar;
      c.prepare('UPDATE cms_homepage_sections SET config = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(config), now(), row.id);
      changed++;
    }
  } catch {
    // malformed operator config: leave it for the dashboard to fix
  }
  return changed;
}

export function seedCmsContent(): void {
  const c = getConn();
  if (!c) return;

  const ts = now();
  // The bulk seed below runs once. Its marker is the homepage-sections table:
  // cms_pages alone cannot be the marker, because the static-page backfill at
  // the end of this function inserts page rows on its own — using it as the
  // marker would suppress the bulk seed on a fresh database.
  const bulkDone = (((c.prepare('SELECT COUNT(*) as n FROM cms_homepage_sections').get() as { n: number })?.n ?? 0) > 0);
  if (!bulkDone) {
  console.log('[CMS] Seeding editorial content into CMS tables...');

  // --- Homepage Sections ---
  // One row per section the homepage renders, in shipped order (see
  // src/shared/homeSections.ts). insertHomepageSections is shared with the
  // boot-time backfill so a fresh database and an existing one converge.
  insertHomepageSections(c);

  // --- Trip Programmes ---
  const programmes = [
    { slug: 'dahab-first-timer', title_en: 'Dahab First Timer', title_ar: '\u0623\u0648\u0644 \u0645\u0631\u0629 \u0641\u064a \u062f\u0647\u0628', tagline_en: 'Iconic reefs, Lighthouse promenade, sunset Bedouin tea, and essential Dahab magic.', tagline_ar: '\u0627\u0644\u0634\u0639\u0627\u0628 \u0627\u0644\u0623\u0633\u0637\u0648\u0631\u064a\u0629\u060c \u0645\u0645\u0634\u0649 \u0627\u0644\u0644\u0627\u064a\u062a\u0647\u0627\u0648\u0633\u060c \u0634\u0627\u064a \u0627\u0644\u063a\u0631\u0648\u0628 \u0627\u0644\u0628\u062f\u0648\u064a\u060c \u0648\u0631\u0648\u062d \u062f\u0647\u0628 \u0627\u0644\u0623\u0635\u0644\u064a\u0629.', durationDays: 5, pace: 'Balanced', startingPriceEGP: 9800, badge_en: 'Most Popular', badge_ar: '\u0627\u0644\u0623\u0643\u062b\u0631 \u0637\u0644\u0628\u0627\u064b', featured: 1 },
    { slug: 'dahab-adventure', title_en: 'Dahab Adventure', title_ar: '\u0645\u063a\u0627\u0645\u0631\u0629 \u062f\u0647\u0628 \u0648\u0633\u064a\u0646\u0627\u0621', tagline_en: 'Sinai granite peaks, deep canyons, desert quad trails, and night dive adrenaline.', tagline_ar: '\u062c\u0628\u0627\u0644 \u0633\u064a\u0646\u0627\u0621\u060c \u062a\u0633\u0644\u0642 \u0627\u0644\u0643\u0627\u0646\u064a\u0648\u0646\u0632\u060c \u062f\u0631\u0648\u0628 \u0627\u0644\u0628\u064a\u062a\u0634 \u0628\u0627\u062c\u064a \u0641\u064a \u0627\u0644\u0635\u062d\u0631\u0627\u0621\u060c \u0648\u063a\u0637\u0633 \u0644\u064a\u0644\u064a \u0645\u062b\u064a\u0631.', durationDays: 6, pace: 'Active', startingPriceEGP: 14200, badge_en: 'High Energy', badge_ar: '\u0637\u0627\u0642\u0629 \u0648\u0645\u063a\u0627\u0645\u0631\u0629', featured: 1 },
    { slug: 'slow-dahab', title_en: 'Slow Dahab', title_ar: '\u0631\u0648\u0642\u0627\u0646 \u0648\u0641\u0635\u0644\u0627\u0646 \u0641\u064a \u062f\u0647\u0628', tagline_en: 'Unhurried seaside mornings, lagoon hammocks, artisan bakeries, and habak tea.', tagline_ar: '\u0635\u0628\u0627\u062d \u0631\u0627\u064a\u0642 \u0639 \u0627\u0644\u0628\u062d\u0631\u060c \u0634\u0644\u062a\u0627\u062a \u0627\u0644\u0644\u0627\u062c\u0648\u0646\u0627\u060c \u0645\u062e\u0627\u0628\u0632 \u0643\u0631\u0648\u0627\u0633\u0648\u0646 \u0637\u0627\u0632\u0629\u060c \u0648\u0634\u0627\u064a \u0628\u0627\u0644\u062d\u0642\u0642 \u0639 \u0627\u0644\u0634\u0637.', durationDays: 4, pace: 'Relaxed', startingPriceEGP: 7400, badge_en: 'Pure Relaxation', badge_ar: '\u0641\u0635\u0644\u0627\u0646 \u0648\u0631\u0627\u062d\u0629 \u0628\u0627\u0644', featured: 1 },
    { slug: 'diving-week', title_en: 'Diving Week', title_ar: '\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u063a\u0637\u0633 \u0641\u064a \u062f\u0647\u0628', tagline_en: '10 world-class guided reef dives: The Bells, Blue Hole, Canyon, and Gabr El Bint.', tagline_ar: '\u0627\u0644\u0628\u064a\u0644\u0632\u060c \u0627\u0644\u0628\u0644\u0648 \u0647\u0648\u0644\u060c \u0627\u0644\u0643\u0627\u0646\u064a\u0648\u0646\u060c \u0648\u062c\u0628\u0631 \u0627\u0644\u0628\u0646\u062a \u0628\u0627\u0644\u064a\u062e\u0637.', durationDays: 6, pace: 'Active', startingPriceEGP: 16500, badge_en: 'Pro Diver Choice', badge_ar: '\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u063a\u0648\u0627\u0635\u064a\u0646', featured: 1 },
    { slug: 'couples-escape', title_en: 'Couples Escape', title_ar: '\u062f\u0647\u0628 \u0644\u0644\u0639\u0634\u0627\u0642 \u0648\u0627\u0644\u0623\u0632\u0648\u0627\u062c', tagline_en: 'Private lagoon palapas, candlelit seaside seafood, stargazing, and boutique romance.', tagline_ar: '\u0634\u0644\u062a\u0627\u062a \u062e\u0627\u0635\u0629 \u0641\u064a \u0627\u0644\u0644\u0627\u062c\u0648\u0646\u0627\u060c \u0639\u0634\u0627\u0621 \u0631\u0648\u0645\u0627\u0646\u0633\u064a \u0628\u0627\u0644\u0634\u0645\u0648\u0639 \u0639 \u0627\u0644\u0628\u062d\u0631\u060c \u0648\u0633\u0647\u0631\u0627\u062a \u0627\u0644\u0646\u062c\u0648\u0645.', durationDays: 5, pace: 'Balanced', startingPriceEGP: 18900, badge_en: 'Romantic Suite', badge_ar: '\u0631\u0648\u0645\u0627\u0646\u0633\u064a\u0629 \u0648\u062e\u0635\u0648\u0635\u064a\u0629', featured: 1 },
  ];

  for (let i = 0; i < programmes.length; i++) {
    const p = programmes[i];
    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url, status,
        sort_order, featured, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('CMS'), p.slug, 'trip_program', p.title_en, p.title_ar,
      p.tagline_en, p.tagline_ar, '', '', '', '',
      `https://images.unsplash.com/photo-${['1544551763-46a013bb70d5', '1509316975850-ff9c5deb0cd9', '1507525428034-b723cf961d3e', '1544551763-46a013bb70d5', '1517248135467-4c7edcad34c4'][i]}?q=80&w=1200&auto=format&fit=crop`,
      'published', i, p.featured, '', '', ts, ts, 1
    );
  }

  // --- Gallery Photos ---
  const gallery = [
    { slug: 'blue-hole-bells', title_en: 'The Blue Hole & The Bells Chimney', title_ar: '\u0627\u0644\u062b\u0642\u0628 \u0627\u0644\u0623\u0632\u0631\u0642 \u0648\u0645\u062f\u062e\u0646\u0629 \u0627\u0644\u0628\u064a\u0644\u0632', spot_en: 'Blue Hole Protected Area', spot_ar: '\u0645\u062d\u0645\u064a\u0629 \u0627\u0644\u0628\u0644\u0648 \u0647\u0648\u0644 \u0627\u0644\u0628\u062d\u0631\u064a\u0629', cat: 'diving', img: '1544551763-46a013bb70d5' },
    { slug: 'blue-lagoon', title_en: 'Blue Lagoon Turquoise Solitude', title_ar: '\u0627\u0644\u0628\u0644\u0648 \u0644\u0627\u062c\u0648\u0646 \u0648\u0645\u064a\u0627\u0647 \u0627\u0644\u0628\u062d\u0631 \u0627\u0644\u0641\u064a\u0631\u0648\u0632\u064a\u0629', spot_en: 'Ras Abu Galum Reserve', spot_ar: '\u0645\u062d\u0645\u064a\u0629 \u0631\u0623\u0633 \u0623\u0628\u0648 \u062c\u0627\u0644\u0648\u0645', cat: 'lagoon', img: '1507525428034-b723cf961d3e' },
    { slug: 'canyon-rift', title_en: 'The Submarine Canyon Sun Rays', title_ar: '\u0627\u0644\u0634\u0642 \u0627\u0644\u0635\u062e\u0631\u064a \u0627\u0644\u0645\u0631\u062c\u0627\u0646\u064a \u0641\u064a \u0627\u0644\u0643\u0627\u0646\u064a\u0648\u0646', spot_en: 'The Canyon Dive Area', spot_ar: '\u0645\u0646\u0637\u0642\u0629 \u063a\u0648\u0635 \u0627\u0644\u0643\u0627\u0646\u064a\u0648\u0646', cat: 'diving', img: '1682687220063-4742bd7fd538' },
    { slug: 'wadi-gnai', title_en: 'Wadi Gnai Canyon & Oasis', title_ar: '\u0643\u0627\u0646\u064a\u0648\u0646 \u0648\u0627\u062f\u064a \u0642\u0646\u064a \u0648\u0627\u0644\u0648\u0627\u062d\u0629', spot_en: 'South Dahab Desert', spot_ar: '\u0635\u062d\u0631\u0627\u0621 \u062c\u0646\u0648\u0628 \u062f\u0647\u0628', cat: 'desert', img: '1509316975850-ff9c5deb0cd9' },
    { slug: 'lighthouse-sunset', title_en: 'Lighthouse Promenade Golden Sunset', title_ar: '\u063a\u0631\u0648\u0628 \u0627\u0644\u0634\u0645\u0633 \u0627\u0644\u0630\u0647\u0628\u064a \u0628\u0645\u0645\u0634\u0649 \u0627\u0644\u0644\u0627\u064a\u062a\u0647\u0627\u0648\u0633', spot_en: 'Lighthouse Bay', spot_ar: '\u062e\u0644\u064a\u062c \u0648\u0645\u0645\u0634\u0649 \u0627\u0644\u0644\u0627\u064a\u062a\u0647\u0627\u0648\u0633', cat: 'sunset', img: '1534447677768-be436bb09401' },
    { slug: 'laguna-kite', title_en: 'Dahab South Laguna Kite Spot', title_ar: '\u0634\u0627\u0637\u0626 \u0644\u0627\u062c\u0648\u0646\u0627 \u062f\u0647\u0628 \u0627\u0644\u062c\u0646\u0648\u0628\u064a', spot_en: 'South Laguna Bay', spot_ar: '\u062e\u0644\u064a\u062c \u0627\u0644\u0644\u0627\u062c\u0648\u0646\u0627 \u0627\u0644\u062c\u0646\u0648\u0628\u064a', cat: 'lagoon', img: '1507525428034-b723cf961d3e' },
    { slug: 'st-catherine', title_en: 'Mount Sinai Dawn & St. Catherine', title_ar: '\u0634\u0631\u0648\u0642 \u0627\u0644\u0634\u0645\u0633 \u0627\u0644\u0623\u0633\u0637\u0648\u0631\u064a', spot_en: 'Mount Sinai Summit (2,285m)', spot_ar: '\u0642\u0645\u0629 \u062c\u0628\u0644 \u0645\u0648\u0633\u0649 (\u062b\u0645\u0627\u0646\u064a\u0629 \u0627\u0644\u0645\u062a\u0631\u064a\u0646)', cat: 'desert', img: '1509316975850-ff9c5deb0cd9' },
    { slug: 'bedouin-campfire', title_en: 'Bedouin Zarb Feast & Stargazing', title_ar: '\u062c\u0644\u0633\u0629 \u0627\u0644\u0633\u0645\u0631 \u0627\u0644\u0628\u062f\u0648\u064a \u0648\u0639\u0634\u0627\u0621 \u0627\u0644\u0632\u0631\u0628', spot_en: 'Wadi Gnai / Abu Galum Camp', spot_ar: '\u0645\u062e\u064a\u0645\u0627\u062a \u0648\u0627\u062f\u064a \u0642\u0646\u064a \u0648\u0623\u0628\u0648 \u062c\u0627\u0644\u0648\u0645', cat: 'bedouin', img: '1517248135467-4c7edcad34c4' },
  ];

  for (let i = 0; i < gallery.length; i++) {
    const g = gallery[i];
    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url, status,
        sort_order, featured, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('CMS'), `gallery-${g.slug}`, 'gallery', g.title_en, g.title_ar,
      g.spot_en, g.spot_ar, g.cat, '', '', '',
      `https://images.unsplash.com/photo-${g.img}?q=80&w=1600&auto=format&fit=crop`,
      'published', i, 1, '', '', ts, ts, 1
    );
  }

  // --- Curated Stories ---
  const stories = [
    { slug: 'blue-lagoon-retreat', title_en: 'The Blue Lagoon Boat & Hammock Retreat', title_ar: '\u0645\u0644\u0627\u0630 \u0627\u0644\u0628\u0644\u0648 \u0644\u0627\u062c\u0648\u0646 \u0628\u0627\u0644\u0642\u0627\u0631\u0628 \u0648\u0627\u0644\u0623\u0631\u062c\u0648\u062d\u0629', cat: 'Coastal Secret', catAr: '\u0623\u0633\u0631\u0627\u0631 \u0627\u0644\u0633\u0627\u062d\u0644', img: '1507525428034-b723cf961d3e' },
    { slug: 'desert-stargazing', title_en: 'Wadi Gnai Stargazing & Bedouin Fire BBQ', title_ar: '\u0633\u0647\u0631\u0629 \u0646\u062c\u0648\u0645 \u0648\u0639\u0634\u0627\u0621 \u0628\u062f\u0648\u064a \u0639\u0644\u0649 \u0627\u0644\u0641\u062d\u0645 \u0641\u064a \u0648\u0627\u062f\u064a \u0642\u0646\u064a', cat: 'Desert Magic', catAr: '\u0633\u062d\u0631 \u0627\u0644\u0635\u062d\u0631\u0627\u0621', img: '1509316975850-ff9c5deb0cd9' },
    { slug: 'canyon-dive', title_en: 'The Canyon Submarine Rift Exploration', title_ar: '\u0627\u0633\u062a\u0643\u0634\u0627\u0641 \u0635\u0639\u062f \u0627\u0644\u0643\u0627\u0646\u064a\u0648\u0646 \u0627\u0644\u0628\u062d\u0631\u064a \u0627\u0644\u0641\u0631\u064a\u062f', cat: 'World-Class Dive', catAr: '\u063a\u0637\u0633\u0629 \u0639\u0627\u0644\u0645\u064a\u0629', img: '1544551763-46a013bb70d5' },
    { slug: 'assalah-food', title_en: 'Assalah Spice & Seaside Mezzes Tour', title_ar: '\u062c\u0648\u0644\u0629 \u0628\u0647\u0627\u0631\u0627\u062a \u0648\u0645\u0642\u0628\u0644\u0627\u062a \u0627\u0644\u0639\u0635\u0644\u0629 \u0627\u0644\u0633\u0627\u062d\u0644\u064a\u0629', cat: 'Sinai Flavors', catAr: '\u0646\u0643\u0647\u0627\u062a \u0633\u064a\u0646\u0627\u0621', img: '1517248135467-4c7edcad34c4' },
  ];

  for (let i = 0; i < stories.length; i++) {
    const s = stories[i];
    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url, status,
        sort_order, featured, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('CMS'), `story-${s.slug}`, 'curated_story', s.title_en, s.title_ar,
      s.cat, s.catAr, '', '', '', '',
      `https://images.unsplash.com/photo-${s.img}?q=80&w=1200&auto=format&fit=crop`,
      'published', i, 1, '', '', ts, ts, 1
    );
  }

  // --- Footer Navigation ---
  const navCount = (c.prepare('SELECT COUNT(*) as n FROM cms_navigation').get() as { n: number })?.n ?? 0;
  if (navCount === 0) {
    console.log('[CMS] Seeding footer navigation items...');
    const footerItems = [
      // Explore group
      { group_en: 'Explore', group_ar: 'استكشف', label_en: 'Experiences', label_ar: 'تجارب دهب', route: '/explore', order: 0 },
      { group_en: 'Explore', group_ar: 'استكشف', label_en: 'Food', label_ar: 'المطاعم والأكل', route: '/food', order: 1 },
      { group_en: 'Explore', group_ar: 'استكشف', label_en: 'Dahab', label_ar: 'معالم دهب', route: '/explore', order: 2 },
      // Plan group
      { group_en: 'Plan', group_ar: 'التخطيط', label_en: 'Plan My Trip', label_ar: 'خطط رحلتك', route: '/trip-builder', order: 3 },
      { group_en: 'Plan', group_ar: 'التخطيط', label_en: 'How It Works', label_ar: 'كيف تعمل المنصة', route: '/', order: 4 },
      // Support group
      { group_en: 'Support', group_ar: 'الدعم الفني', label_en: 'Help', label_ar: 'المساعدة والأسئلة', route: '/help', order: 5 },
      { group_en: 'Support', group_ar: 'الدعم الفني', label_en: 'Operations Console', label_ar: 'لوحة العمليات', route: '/ops-console', order: 6 },
      { group_en: 'Support', group_ar: 'الدعم الفني', label_en: 'Supplier Portal', label_ar: 'بوابة الموردين', route: '/supplier-portal', order: 7 },
      // Company group
      { group_en: 'Company', group_ar: 'عن الشركة', label_en: 'About', label_ar: 'عن المنصة', route: '/about', order: 8 },
      { group_en: 'Company', group_ar: 'عن الشركة', label_en: 'Privacy', label_ar: 'الخصوصية', route: '/privacy', order: 9 },
      { group_en: 'Company', group_ar: 'عن الشركة', label_en: 'Terms', label_ar: 'الشروط', route: '/terms', order: 10 },
    ];

    for (const item of footerItems) {
      c.prepare(`
        INSERT INTO cms_navigation (id, menu_key, item_order, label_en, label_ar, route,
          external_url, visible, open_in_new, icon, group_label_en, group_label_ar, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id('NAV'), 'footer', item.order,
        item.label_en, item.label_ar, item.route,
        '', 1, 0, '',
        item.group_en, item.group_ar, ts, ts
      );
    }
    console.log(`[CMS] Seeded ${footerItems.length} footer navigation items`);
  }

  // --- Header Navigation ---
  const headerNavCount = (c.prepare("SELECT COUNT(*) as n FROM cms_navigation WHERE menu_key = 'header'").get() as { n: number })?.n ?? 0;
  if (headerNavCount === 0) {
    console.log('[CMS] Seeding header navigation items...');
    const headerItems = [
      { label_en: 'Discover', label_ar: 'استكشف', route: '/home', icon: 'Compass', order: 0 },
      { label_en: 'Explore', label_ar: 'استكشف دهب', route: '/explore', icon: 'Map', order: 1 },
      { label_en: 'Transfers', label_ar: 'النقل', route: '/transfers', icon: 'Car', order: 2 },
      { label_en: 'Food & Dining', label_ar: 'الأكل والمطاعم', route: '/food', icon: 'UtensilsCrossed', order: 3 },
      { label_en: 'Experiences', label_ar: 'التجارب', route: '/experiences', icon: 'Star', order: 4 },
      { label_en: 'Hotels', label_ar: 'فنادق', route: '/hotels', icon: 'BedDouble', order: 5 },
      { label_en: 'Bookings', label_ar: 'حجوزاتي', route: '/bookings', icon: 'Ticket', order: 6 },
      { label_en: 'My Trip', label_ar: 'رحلتي', route: '/my-trip', icon: 'Luggage', order: 7 },
      { label_en: 'Dahab Live', label_ar: 'دهب لايف', route: '/live', icon: 'Activity', order: 8 },
    ];

    for (const item of headerItems) {
      c.prepare(`
        INSERT INTO cms_navigation (id, menu_key, item_order, label_en, label_ar, route,
          external_url, visible, open_in_new, icon, group_label_en, group_label_ar, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id('NAV'), 'header', item.order,
        item.label_en, item.label_ar, item.route,
        '', 1, 0, item.icon,
        '', '', ts, ts
      );
    }
    console.log(`[CMS] Seeded ${headerItems.length} header navigation items`);
  }

  // --- Mobile Navigation ---
  const mobileNavCount = (c.prepare("SELECT COUNT(*) as n FROM cms_navigation WHERE menu_key = 'mobile'").get() as { n: number })?.n ?? 0;
  if (mobileNavCount === 0) {
    console.log('[CMS] Seeding mobile navigation items...');
    const mobileItems = [
      { label_en: 'Discover', label_ar: 'استكشف', route: '/home', icon: 'Compass', order: 0 },
      { label_en: 'Hotels', label_ar: 'فنادق', route: '/hotels', icon: 'BedDouble', order: 1 },
      { label_en: 'Explore', label_ar: 'استكشف دهب', route: '/explore', icon: 'Map', order: 2 },
      { label_en: 'My Trip', label_ar: 'رحلتي', route: '/my-trip', icon: 'Luggage', order: 3 },
      { label_en: 'Live', label_ar: 'لايف', route: '/live', icon: 'Activity', order: 4 },
    ];

    for (const item of mobileItems) {
      c.prepare(`
        INSERT INTO cms_navigation (id, menu_key, item_order, label_en, label_ar, route,
          external_url, visible, open_in_new, icon, group_label_en, group_label_ar, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id('NAV'), 'mobile', item.order,
        item.label_en, item.label_ar, item.route,
        '', 1, 0, item.icon,
        '', '', ts, ts
      );
    }
    console.log(`[CMS] Seeded ${mobileItems.length} mobile navigation items`);
  }
  } else {
    console.log('[CMS] Tables already contain data, skipping bulk seed');
  }

  // --- Static Pages (About, FAQ, Travel Guides) ---
  // Hard routes in App.tsx: verified on every boot so databases seeded before
  // these slugs existed heal themselves. Existing rows are never touched.
  const staticPages = [
    {
      slug: 'about-dahab',
      title_en: 'About Dahab Travel Platform',
      title_ar: 'عن منصة دهب للسفر',
      subtitle_en: 'Your intelligent travel companion for South Sinai',
      subtitle_ar: 'رفيقك الذكي للسفر في جنوب سيناء',
      description_en: 'A premium digital travel platform crafted to help travelers discover, plan, and experience the authentic magic of Dahab.',
      description_ar: 'منصة سفر رقمية متميزة صُممت لمساعدة المسافرين على اكتشاف وتخطيط وتجربة السحر الأصيل لدهب.',
      body_en: `Dahab Travel Platform is more than a booking app — it is your personal travel operating system for one of the most magical destinations on the Red Sea.

Our platform combines real-time marine conditions, AI-powered trip planning, and curated local experiences to help you make the most of every moment in Dahab.

Whether you are a first-time visitor or a seasoned Dahab regular, our platform adapts to your journey stage and provides exactly the information and tools you need, when you need them.

From the famous Blue Hole diving site to the serene Blue Lagoon, from Bedouin stargazing dinners to the colorful Colored Canyon — we help you discover the authentic soul of South Sinai.

Built with local passion by people who call Dahab home.`,
      body_ar: `منصة دهب للسفر ليست مجرد تطبيق حجز — إنها نظام تشغيل السفر الشخصي الخاص بك لأحد أجمل الوجهات على البحر الأحمر.

تجمع منصتنا بين الظروف البحرية الحية والتخطيط الذكي للرحلات والتجارب المحلية المختارة لمساعدتك على الاستمتاع بكل لحظة في دهب.

سواء كنت زائرًا لأول مرة أو من العاديين، تتكيّف منصتنا مع مرحلة رحلتك وتوفر معلومات وأدوات تحتاجها بالضبط في الوقت المناسب.

من موقع الغوص الشهير البلو هول إلى بحيرة اللاجونا الهادئة، من عشاء بدوي تحت النجوم إلى كانيون ملون — نساعدك على اكتشاف الروح الأصيلة لجنوب سيناء.

بُنيت بشغف محلي من أشخاص يسمّون دهب بيتهم.`,
      type: 'static_page',
      featured: 0,
    },
    {
      slug: 'faq',
      title_en: 'Frequently Asked Questions',
      title_ar: 'الأسئلة الشائعة',
      subtitle_en: 'Everything you need to know about using Dahab Travel Platform',
      subtitle_ar: 'كل ما تحتاج معرفته عن استخدام منصة دهب للسفر',
      description_en: 'Find answers to common questions about booking, trip planning, and using the platform.',
      description_ar: 'اعثر على إجابات للأسئلة الشائعة حول الحجز وتخطيط الرحلات واستخدام المنصة.',
      type: 'static_page',
      featured: 0,
    },
    {
      slug: 'travel-guides',
      title_en: 'Travel Guides',
      title_ar: 'أدلة السفر',
      subtitle_en: 'Expert guides to help you explore Dahab like a local',
      subtitle_ar: 'أدلة متخصصة لمساعدتك على استكشاف دهب كالمحلين',
      description_en: 'Comprehensive travel guides covering diving, desert safaris, food, and cultural experiences in Dahab.',
      description_ar: 'أدلة سفر شاملة تغطي الغوص وسفاري الصحراء والأكل والتجارب الثقافية في دهب.',
      type: 'static_page',
      featured: 0,
    },
  ];

  for (const page of staticPages) {
    const pageExists = c.prepare('SELECT id FROM cms_pages WHERE slug = ?').get(page.slug) as { id: string } | undefined;
    if (pageExists) continue;
    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url, status,
        sort_order, featured, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('CMS'), page.slug, page.type,
      page.title_en, page.title_ar, page.subtitle_en || '', page.subtitle_ar || '',
      page.description_en || '', page.description_ar || '',
      page.body_en || '', page.body_ar || '',
      '', 'published', 0, page.featured, '', '', ts, ts, 1
    );
  }

  // Seed FAQ blocks
  const faqPage = c.prepare('SELECT id FROM cms_pages WHERE slug = ?').get('faq') as { id: string } | undefined;
  const faqHasBlocks = faqPage
    ? ((((c.prepare("SELECT COUNT(*) as n FROM cms_blocks WHERE page_id = ? AND type = 'faq'").get(faqPage.id) as { n: number })?.n ?? 0) > 0))
    : true;
  if (faqPage && !faqHasBlocks) {
    c.prepare(`
      INSERT INTO cms_blocks (id, page_id, type, sort_order, visible, title_en, title_ar,
        body_en, body_ar, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('BLK'), faqPage.id, 'faq', 0, 1,
      'Common Questions', 'الأسئلة الشائعة', '', '',
      JSON.stringify({
        items: [
          { question_en: 'How do I plan a trip?', question_ar: 'كيف أخطط رحلة؟', answer_en: 'Use our AI-powered Trip Builder to create a personalized itinerary based on your interests, budget, and travel dates.', answer_ar: 'استخدم منشئ الرحلات المدعوم بالذكاء الاصطناعي لإنشاء خط سير مخصص بناءً على اهتماماتك وميزانيتك وتواريخ سفرك.' },
          { question_en: 'Can I modify my booking?', question_ar: 'هل يمكنني تعديل حجزي؟', answer_en: 'Yes, you can modify or cancel bookings through the My Trip dashboard. Check the cancellation policy for each item.', answer_ar: 'نعم، يمكنك تعديل أو إلغاء الحجوزات من خلال لوحة رحلتي. تحقق من سياسة الإلغاء لكل عنصر.' },
          { question_en: 'Is the platform available in Arabic?', question_ar: 'هل المنصة متاحة بالعربية؟', answer_en: 'Yes! The platform supports both Arabic and English. Tap the language toggle in the footer to switch.', answer_ar: 'نعم! تدعم المنصة العربية والإنجليزية. اضغط على زر تبديل اللغة في التذييل للتبديل.' },
          { question_en: 'How does the AI concierge work?', question_ar: 'كيف يعمل المستشار الذكي؟', answer_en: 'Our AI concierge (DayGI) provides real-time recommendations, answers questions about Dahab, and helps you navigate your trip.', answer_ar: 'يقدم مستشارنا الذكي (DayGI) توصيات فورية ويجيب على أسئلتك عن دهب ويساعدك في توجيه رحلتك.' },
          { question_en: 'Are the marine conditions real?', question_ar: 'هل الظروف البحرية حقيقية؟', answer_en: 'Yes, we fetch real-time weather and sea conditions from Open-Meteo and local monitoring points.', answer_ar: 'نعم، نحصل على بيانات الطقس والظروف البحرية الحية من Open-Meteoنقاط المراقبة المحلية.' },
        ]
      }),
      ts, ts
    );
  }

  // Seed Travel Guides blocks
  const guidesPage = c.prepare('SELECT id FROM cms_pages WHERE slug = ?').get('travel-guides') as { id: string } | undefined;
  const guidesHasBlocks = guidesPage
    ? ((((c.prepare("SELECT COUNT(*) as n FROM cms_blocks WHERE page_id = ? AND type = 'rich_text'").get(guidesPage.id) as { n: number })?.n ?? 0) > 0))
    : true;
  if (guidesPage && !guidesHasBlocks) {
    c.prepare(`
      INSERT INTO cms_blocks (id, page_id, type, sort_order, visible, title_en, title_ar,
        body_en, body_ar, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('BLK'), guidesPage.id, 'rich_text', 0, 1,
      'Diving Guide', 'دليل الغوص',
      'Dahab is world-renowned for its shore diving. The Blue Hole, The Canyon, The Bells, and Gabr El Bint are among the top dive sites globally. Water visibility often exceeds 30 meters, and the coral walls are teeming with marine life.',
      'دهب مشهورة عالميًا بغوصها الشاطئي. البلو هول، الكانيون، البيلز، وجبر البنت من أفضل مواقع الغوص في العالم. تتجاوز رؤية الماء أحيانًا ٣٠ مترًا، وجدران المرجان مليئة بالحياة البحرية.',
      JSON.stringify({}), ts, ts
    );

    c.prepare(`
      INSERT INTO cms_blocks (id, page_id, type, sort_order, visible, title_en, title_ar,
        body_en, body_ar, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('BLK'), guidesPage.id, 'rich_text', 1, 1,
      'Desert Safari Guide', 'دليل سفاري الصحراء',
      'The Sinai desert offers incredible 4x4 adventures through granite canyons, Bedouin camps under the stars, and sunrise treks up Mount Sinai. Wadi Gnai, Abu Galum, and the Colored Canyon are must-visit spots.',
      'تقدم صحراء سيناء مغامرات مذهلة بالدفع الرباعي عبر وديان الغرانيت، ومخيمات بدوية تحت النجوم، ورحلات صعود لجبل موسى عند الشروق. وادي قني وأبو جالوم والكانيون الملون من الأماكن التي يجب زيارتها.',
      JSON.stringify({}), ts, ts
    );

    c.prepare(`
      INSERT INTO cms_blocks (id, page_id, type, sort_order, visible, title_en, title_ar,
        body_en, body_ar, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('BLK'), guidesPage.id, 'rich_text', 2, 1,
      'Food & Dining Guide', 'دليل المطاعم',
      'Dahab offers a unique mix of Bedouin traditional food, fresh Red Sea seafood, and international cuisine. The Assalah market area is the heart of local dining, with waterfront restaurants serving grilled fish and mezze.',
      'تقدم دهب مزيجًا فريدًا من المأكولات البدوية التقليدية والمأكولات البحرية الطازجة من البحر الأحمر والمطابق العالمية. منطقة سوق العصلة هي قلب المطاعم المحلية، مع مطاعم على الواجهة البحرية تقدم السمك المشوي والمقبلات.',
      JSON.stringify({}), ts, ts
    );
  }

  // --- Explore Categories (stored as pages with type='explore_category') ---
  const exploreCategories = [
    { slug: 'cat-diving', title_en: 'Diving', title_ar: 'عالم الغطس والأعماق', tagline_en: 'Explore Dahab underwater.', tagline_ar: 'اكتشف عالم تحت المية والشعب المرجانية الأسطورية', description_en: 'World-renowned shore dives, the iconic Blue Hole, vibrant coral labyrinths at the Canyon, and serene freediving bays.', description_ar: 'أشهر مواقع الغطس الشاطئي في العالم، مغامرة البلو هول، متاهات الكانيون المرجانية، وبقاع الغوص الحر الهادية.', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=1200&auto=format&fit=crop', highlights_en: ['Blue Hole & The Arch', 'The Canyon', 'Eel Garden Reef', 'Lighthouse Shore Dive'], highlights_ar: ['البلو هول وحيد الشعب', 'كانيون دهب الكهفي', 'محمية إيل جاردن', 'شاطئ اللايتهاوس'], sort_order: 0 },
    { slug: 'cat-adventure', title_en: 'Adventure', title_ar: 'المغامرة والوديان', tagline_en: 'Desert, mountains, and open roads.', tagline_ar: 'جبال شاهقة، كانيونز ملونة، ودروب الصحراء الواسعة', description_en: 'Climb the rugged Sinai mountain trails, canyon trekking through Wadi Gnai, starlit Bedouin nights, and quad safaris through ancient valleys.', description_ar: 'مسارات المشي وتسلق صخور سيناء، عبور كانيون وادي قني، سهرات عشاء بدوي تحت النجوم، وسفاري البيتش باجي في الوديان.', image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop', highlights_en: ['Wadi Gnai Bouldering', 'Colored Canyon Trek', 'Mount Sinai Sunrise', 'Desert Quad Trails'], highlights_ar: ['تسلق وادي قني', 'الكانيون الملون', 'شروق جبل موسى', 'سفاري البيتش باجي'], sort_order: 1 },
    { slug: 'cat-beach', title_en: 'Beach & Coastal Chill', title_ar: 'شواطئ وفصلان ع البحر', tagline_en: 'Slow down by the sea.', tagline_ar: 'افصل وريح دماغك مع نسيم البحر الأحمر الهادي', description_en: 'Unwind along quiet pebble shores, swim in crystalline shallow lagoons, catch calm morning breezes, and read under shaded thatched palapas.', description_ar: 'استجمام في شواطئ دهب الهادية، عوم في مياه البلو لاجون الفيروزية، قعدة شلتات مظللة وقراءة كتاب على البحر مع نسيم الصبح.', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop', highlights_en: ['Blue Lagoon Hammocks', 'Lighthouse Bay Promenade', 'Laguna Kite Beach', 'Secret Cove Relax'], highlights_ar: ['شلتات البلو لاجون', 'ممشى خليج اللايتهاوس', 'لاجونا الكايت سيرف', 'خلجان الاسترخاء الهادية'], sort_order: 2 },
    { slug: 'cat-food', title_en: 'Food & Cafés', title_ar: 'أكل ومطاعم وكافيهات', tagline_en: 'Discover local flavors and cafés.', tagline_ar: 'سمك البحر الأحمر الطازة، مخابز مميزة، وشاي الحبق البدوي', description_en: 'Fresh grilled Red Sea catch, traditional Bedouin flatbreads baked on open fire, artisan specialty coffee, and open-air seaside terraces.', description_ar: 'صيد اليوم المشوي ع الفحم مباشرة، العيش البدوي المخبوز ع الحطب، سبشيلتي كوفي طازة، وقعدات أكل بحرية مفتوحة ع الممشى.', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop', highlights_en: ['Bedouin Seafood BBQ', 'Artisan Bakery Courtyards', 'Seaside Mezzes & Tea', 'Sun-drenched Smoothie Cafés'], highlights_ar: ['مشاوي سمك ع البحر', 'مخابز كافيهات فريش', 'مقبلات وشاي بالحبق', 'عصاير وسموذي طبيعي'], sort_order: 3 },
    { slug: 'cat-local-life', title_en: 'Local Life & Soul', title_ar: 'حياة وروح دهب وأهلها', tagline_en: 'Experience Dahab beyond the usual tourist spots.', tagline_ar: 'عيش تفاصيل دهب الحقيقية بروقان وبساطة', description_en: 'Wander through Assalah market, meet local artisans and craftspeople, listen to acoustic oud melodies by the shore, and embrace the unhurried Sinai rhythm.', description_ar: 'تمشية في سوق العصلة، لقاء الحرفيين وصناع الفخار والفضة البدوية، دندنة العود ع الشط وقت الغروب، وعيش ريتم دهب اللي مفيش فيه أي استعجال.', image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop', highlights_en: ['Assalah Artisan Market', 'Bedouin Herb & Tea Gathering', 'Acoustic Sunset Circles', 'Local Pottery & Weaving'], highlights_ar: ['سوق العصلة التراثي', 'قعدة أعشاب وشاي بدوي', 'دوائر عزف العود والغروب', 'فخار ونسيج يدوي سيناوي'], sort_order: 4 },
  ];

  for (const cat of exploreCategories) {
    const catExists = c.prepare('SELECT id FROM cms_pages WHERE slug = ?').get(cat.slug) as { id: string } | undefined;
    if (catExists) continue;
    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url, status,
        seo_title_en, seo_title_ar, seo_description_en, seo_description_ar, og_image_url,
        sort_order, featured, created_at, updated_at, version, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', '', '', '', '', ?, ?, 1, ?, ?, 1, ?)
    `).run(
      id('CAT'), cat.slug, 'explore_category', cat.title_en, cat.title_ar,
      cat.tagline_en, cat.tagline_ar, cat.description_en, cat.description_ar, '', '',
      cat.image, cat.image,
      cat.sort_order,
      ts, ts, ts
    );
  }

  // --- How It Works Steps (stored as blocks on a static page) ---
  // First ensure the static page exists
  const howItWorksExists = c.prepare('SELECT id FROM cms_pages WHERE slug = ?').get('how-it-works') as { id: string } | undefined;
  let howItWorksPageId: string;
  if (howItWorksExists) {
    howItWorksPageId = howItWorksExists.id;
  } else {
    howItWorksPageId = id('PAGE');
    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url, status,
        seo_title_en, seo_title_ar, seo_description_en, seo_description_ar, og_image_url,
        sort_order, featured, created_at, updated_at, version, published_at)
      VALUES (?, ?, 'static_page', ?, ?, ?, ?, ?, ?, '', '', '', 'published', '', '', '', '', '', 10, 0, ?, ?, 1, ?)
    `).run(
      howItWorksPageId, 'how-it-works',
      'How It Works', 'كيف يعمل',
      'Plan your perfect Dahab trip', 'خطط رحلتك المثالية لدهب',
      'Three simple steps to your dream Dahab vacation', 'ثلاث خطوات بسيطة لعطلة أحلامك في دهب',
      ts, ts, ts
    );
  }

  const howItWorksSteps = [
    { number: '01', title_en: 'Tell us what you want', title_ar: 'أخبرنا ماذا تريد', description_en: 'Share your dates, budget, interests, and travel style.', description_ar: 'شاركنا تواريخك وميزانيتك واهتماماتك وأسلوب سفرك.', subtext_en: 'Whether you want non-stop dives or quiet seaside afternoons, start with what matters to you.', subtext_ar: 'سواء كنت تريد غوصًا متواصلًا أو ظهورًا هادئة على البحر، ابدأ بما يهمك.', iconName: 'Compass', sort_order: 0 },
    { number: '02', title_en: 'Build your trip', title_ar: ' ابنِ رحلتك', description_en: 'Get a trip shaped around the way you want to experience Dahab.', description_ar: 'احصل على رحلة مصممة حول طريقة رغبتك في تجربة دهب.', subtext_en: 'A cohesive schedule linking boutique stays, trusted guides, gear rental, and authentic meals.', subtext_ar: 'جدول متماسك يربط الإقامات البوتique والمرشدين الموثوقين وتأجير المعدات والوجبات الأصيلة.', iconName: 'Sparkles', sort_order: 1 },
    { number: '03', title_en: 'Enjoy the journey', title_ar: 'استمتع بالرحلة', description_en: 'Keep your trip organized and get help when you need it.', description_ar: 'حافظ على تنظيم رحلتك واحصل على المساعدة عندما تحتاجها.', subtext_en: 'One clear itinerary in your pocket with local tips, timing cues, and seamless support.', subtext_ar: 'خط سير واضح في جيبك مع نصائح محلية وإشارات توقيت ودعم سلس.', iconName: 'MapPin', sort_order: 2 },
  ];

  // Seed the steps only into a page that has none yet — editors own these rows
  // afterwards, and a restart must not wipe their work.
  const howItWorksHasBlocks = ((((c.prepare('SELECT COUNT(*) as n FROM cms_blocks WHERE page_id = ?').get(howItWorksPageId) as { n: number })?.n ?? 0) > 0));
  if (!howItWorksHasBlocks) {
  for (const step of howItWorksSteps) {
    c.prepare(`
      INSERT INTO cms_blocks (id, page_id, type, sort_order, visible, title_en, title_ar,
        body_en, body_ar, config, created_at, updated_at)
      VALUES (?, ?, 'rich_text', ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('BLK'), howItWorksPageId, step.sort_order,
      `${step.number} — ${step.title_en}`, `${step.number} — ${step.title_ar}`,
      step.description_en, step.description_ar,
      JSON.stringify({ subtext_en: step.subtext_en, subtext_ar: step.subtext_ar, iconName: step.iconName, number: step.number }),
      ts, ts
    );
  }
  }

  // --- Trip Preview Days (stored as blocks on a static page) ---
  const tripPreviewExists = c.prepare('SELECT id FROM cms_pages WHERE slug = ?').get('trip-preview') as { id: string } | undefined;
  let tripPreviewPageId: string;
  if (tripPreviewExists) {
    tripPreviewPageId = tripPreviewExists.id;
  } else {
    tripPreviewPageId = id('PAGE');
    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url, status,
        seo_title_en, seo_title_ar, seo_description_en, seo_description_ar, og_image_url,
        sort_order, featured, created_at, updated_at, version, published_at)
      VALUES (?, ?, 'static_page', ?, ?, ?, ?, ?, ?, '', '', '', 'published', '', '', '', '', '', 11, 0, ?, ?, 1, ?)
    `).run(
      tripPreviewPageId, 'trip-preview',
      'Sample Itinerary', 'نموذج خط سير الرحلة',
      'See what a typical Dahab trip looks like', 'شاهد شكل الرحلة النموذجية في دهب',
      'A preview of what your Dahab adventure could look like', 'معاينة لما قد تبدو عليه مغامرة دهب',
      ts, ts, ts
    );
  }

  // Same ownership rule as how-it-works above: seed days only once.
  const tripPreviewSeedNeeded = ((((c.prepare('SELECT COUNT(*) as n FROM cms_blocks WHERE page_id = ?').get(tripPreviewPageId) as { n: number })?.n ?? 0) === 0));

  const tripPreviewDays = [
    { day: 1, title_en: 'Arrival · Hotel · Dinner', title_ar: 'الوصول · الفندق · العشاء', subtitle_en: 'Check into boutique seafront eco-lodge, coastal stroll along the promenade, and fresh Bedouin fish dinner by the water.', subtitle_ar: 'تسجيل الوصول في فندق بيتيك على الشاطئ، نزهة ساحلية على الممشى، وعشاء سمك بدوي طازج بجانب الماء.', highlights_en: ['Scenic transfer from Sharm/Tabah', 'Promenade sunset stroll', 'Authentic catch of the day by torchlight'], highlights_ar: ['نقل سياحي من شرم/طابا', 'نزولة عند الغروب على الممشى', 'صيد اليوم الطازج بالشمس'], tag: 'Arrival & Settle In', tag_ar: 'الوصول والاستقرار' },
    { day: 2, title_en: 'Diving · Lunch · Free Time', title_ar: 'الغوص · الغداء · وقت حر', subtitle_en: 'Morning 2-tank guided shore dive at The Canyon & Lighthouse Reef, seaside hummus lunch, and relaxed afternoon coffee.', subtitle_ar: 'غوص صباحي بخزانين في الكانيون وشعاب اللايتهاوس، غداء حمص على البحر، وقهوة مسائية مسترخية.', highlights_en: ['2-tank coral reef dive with master guide', 'Fresh herb falafel & iced tea', 'Relaxed barefoot exploration'], highlights_ar: ['غوص شعاب مرجاني بخزانين مع مرشد', 'فلافل بالأعشاب الطازجة وشاي مثلج', 'استكشاف حافي القدمين'], tag: 'Underwater Day', tag_ar: 'يوم تحت الماء' },
    { day: 3, title_en: 'Desert · Canyon · Bedouin Camp', title_ar: 'الصحراء · الكانيون · مخيم بدوي', subtitle_en: '4x4 safari through Colored Canyon, Bedouin tea ceremony in a remote wadi, stargazing from camp.', subtitle_ar: 'سفاري بالدفع الرباعي عبر الكانيون الملون، مراسم شاي بدوية في وادي نائي، رص النجوم من المخيم.', highlights_en: ['Colored Canyon narrows trek', 'Bedouin tea under acacia trees', 'Starry sky from desert camp'], highlights_ar: ['عبور ممرات الكانيون الملون', 'شاي بدوي تحت أشجار الطلح', 'سماء مرصعة من مخيم الصحراء'], tag: 'Desert Explorer', tag_ar: 'مستكشف الصحراء' },
    { day: 4, title_en: 'Beach · Snorkel · Sunset', title_ar: 'الشاطئ · سنوركل · غروب', subtitle_en: 'Morning snorkeling at Blue Lagoon, hammock time, artisan lunch at Assalah, and sunset at Lighthouse.', subtitle_ar: 'سنوركل صباحي في البلو لاجون، وقت في الشلتات، غداء حرفي في العصلة، وغروب عند اللايتهاوس.', highlights_en: ['Blue Lagoon crystal snorkel', 'Assalah market lunch', 'Lighthouse sunset viewpoint'], highlights_ar: ['سنوركل في بلو لاجون الكريستال', 'غداء في سوق العصلة', 'نقطة مشاهدة الغروب عند اللايتهاوس'], tag: 'Coastal Relaxation', tag_ar: 'استرخاء ساحلي' },
    { day: 5, title_en: 'Free Day · Shopping · Farewell', title_ar: 'يوم حر · تسوق · وداع', subtitle_en: 'Flexible morning — yoga, diving, or relaxation. Afternoon souvenir shopping and farewell dinner.', subtitle_ar: 'صباح حر — يوغا أو غوص أو استرخاء. بعد الظهر تسوق للهدايا وعشاء وداع.', highlights_en: ['Flexible morning choice', 'Assalah souvenir shopping', 'Farewell Bedouin BBQ dinner'], highlights_ar: ['اختيار صباح حر', 'تسوق الهدايا في العصلة', 'عشاء وداع بدوي مشوي'], tag: 'Flexible Day', tag_ar: 'يوم مرن' },
  ];

  for (const day of tripPreviewDays) {
    if (!tripPreviewSeedNeeded) continue;
    c.prepare(`
      INSERT INTO cms_blocks (id, page_id, type, sort_order, visible, title_en, title_ar,
        body_en, body_ar, config, created_at, updated_at)
      VALUES (?, ?, 'image_text', ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('BLK'), tripPreviewPageId, day.day - 1,
      `Day ${day.day}: ${day.title_en}`, `اليوم ${day.day}: ${day.title_ar}`,
      day.subtitle_en, day.subtitle_ar,
      JSON.stringify({
        highlights_en: day.highlights_en, highlights_ar: day.highlights_ar,
        tag: day.tag, tag_ar: day.tag_ar, day: day.day
      }),
      ts, ts
    );
  }

  // --- Emergency Hotlines (stored in navigation as 'emergency' menu) ---
  const emergencyExists = c.prepare('SELECT COUNT(*) as n FROM cms_navigation WHERE menu_key = ?').get('emergency') as { n: number };
  if (emergencyExists.n === 0) {
    const emergencyItems = [
      { label_en: 'Hyperbaric Chamber', label_ar: 'غرفة الضغط العالي', url: 'tel:+20693640364', sort_order: 0 },
      { label_en: 'Hospital ER', label_ar: 'غرفة الطوارئ', url: 'tel:+20693640200', sort_order: 1 },
      { label_en: 'Tourism Police', label_ar: 'شرطة السياحة', url: 'tel:+20693640066', sort_order: 2 },
      { label_en: 'Ambulance', label_ar: 'الإسعاف', url: 'tel:123', sort_order: 3 },
      { label_en: 'Coast Guard', label_ar: 'خفر السواحل', url: 'tel:+20693640011', sort_order: 4 },
    ];

    for (const item of emergencyItems) {
      c.prepare(`
        INSERT INTO cms_navigation (id, menu_key, item_order, label_en, label_ar, route,
          external_url, visible, open_in_new, icon, group_label_en, group_label_ar, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, '', ?, 1, 0, '', '', '', ?, ?)
      `).run(
        id('NAV'), 'emergency', item.sort_order,
        item.label_en, item.label_ar, item.url,
        ts, ts
      );
    }
  }

  const finalCount = (c.prepare('SELECT COUNT(*) as n FROM cms_pages').get() as { n: number })?.n ?? 0;
  console.log(`[CMS] cms_pages now holds ${finalCount} items (bulk seed ${bulkDone ? 'skipped' : 'complete'}; static slugs verified)`);
}
