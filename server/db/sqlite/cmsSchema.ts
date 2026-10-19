import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from './SqlitePersistenceAdapter';
import { db } from '../database';

/**
 * CMS Content Management System — Database Schema
 *
 * These tables are independent from TABLE_SPECS. They use proper relational
 * columns rather than the "promoted columns + JSON data blob" pattern, because
 * CMS content needs column-level queries (filter by status, sort by order,
 * search by title) that the JSON blob pattern cannot support efficiently.
 *
 * The tables are created via CREATE TABLE IF NOT EXISTS, so they are safe to
 * run on every boot alongside the existing schema.
 */

const CMS_TABLES = `
-- ============================================================================
-- CMS Content Pages — editorial pages managed through the dashboard
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_pages (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'static_page',
  title_en TEXT NOT NULL DEFAULT '',
  title_ar TEXT NOT NULL DEFAULT '',
  subtitle_en TEXT DEFAULT '',
  subtitle_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  body_en TEXT DEFAULT '',
  body_ar TEXT DEFAULT '',
  hero_image_url TEXT DEFAULT '',
  hero_image_alt_en TEXT DEFAULT '',
  hero_image_alt_ar TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  seo_title_en TEXT DEFAULT '',
  seo_title_ar TEXT DEFAULT '',
  seo_description_en TEXT DEFAULT '',
  seo_description_ar TEXT DEFAULT '',
  og_image_url TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  created_by TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT DEFAULT '',
  scheduled_at TEXT DEFAULT '',
  preview_token TEXT DEFAULT '',
  preview_expires_at TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_type ON cms_pages(type);
CREATE INDEX IF NOT EXISTS idx_cms_pages_status ON cms_pages(status);
CREATE INDEX IF NOT EXISTS idx_cms_pages_sort_order ON cms_pages(sort_order);

-- ============================================================================
-- CMS Content Blocks — reusable blocks within pages
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rich_text',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  title_en TEXT DEFAULT '',
  title_ar TEXT DEFAULT '',
  body_en TEXT DEFAULT '',
  body_ar TEXT DEFAULT '',
  config TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES cms_pages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cms_blocks_page_id ON cms_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_cms_blocks_sort_order ON cms_blocks(sort_order);

-- ============================================================================
-- CMS Media Assets — centralized media library
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_media (
  id TEXT PRIMARY KEY NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  original_url TEXT DEFAULT '',
  storage_path TEXT DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size INTEGER DEFAULT 0,
  width INTEGER DEFAULT 0,
  height INTEGER DEFAULT 0,
  aspect_ratio TEXT DEFAULT '',
  alt_en TEXT DEFAULT '',
  alt_ar TEXT DEFAULT '',
  caption_en TEXT DEFAULT '',
  caption_ar TEXT DEFAULT '',
  credit TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '',
  usage_count INTEGER NOT NULL DEFAULT 0,
  focal_x INTEGER NOT NULL DEFAULT 50,
  focal_y INTEGER NOT NULL DEFAULT 50,
  variants TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_media_category ON cms_media(category);

-- ============================================================================
-- CMS Homepage Sections — configurable homepage composition
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_homepage_sections (
  id TEXT PRIMARY KEY NOT NULL,
  section_key TEXT UNIQUE NOT NULL,
  title_en TEXT DEFAULT '',
  title_ar TEXT DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config TEXT DEFAULT '{}',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_homepage_sections_sort ON cms_homepage_sections(sort_order);

-- ============================================================================
-- CMS Navigation Menus — CMS-managed navigation
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_navigation (
  id TEXT PRIMARY KEY NOT NULL,
  menu_key TEXT NOT NULL,
  item_order INTEGER NOT NULL DEFAULT 0,
  label_en TEXT NOT NULL DEFAULT '',
  label_ar TEXT NOT NULL DEFAULT '',
  route TEXT DEFAULT '',
  external_url TEXT DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  open_in_new INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT '',
  group_label_en TEXT DEFAULT '',
  group_label_ar TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_navigation_menu ON cms_navigation(menu_key);

-- ============================================================================
-- CMS SEO Metadata — SEO data per page
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_seo (
  id TEXT PRIMARY KEY NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'page',
  page_id TEXT NOT NULL,
  title_en TEXT DEFAULT '',
  title_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  og_title_en TEXT DEFAULT '',
  og_title_ar TEXT DEFAULT '',
  og_description_en TEXT DEFAULT '',
  og_description_ar TEXT DEFAULT '',
  og_image_url TEXT DEFAULT '',
  canonical_url TEXT DEFAULT '',
  noindex INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(page_type, page_id)
);

-- ============================================================================
-- CMS Content Revisions — audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT DEFAULT '',
  actor_name TEXT DEFAULT '',
  payload TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_revisions_entity ON cms_revisions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cms_revisions_created ON cms_revisions(created_at);

-- ============================================================================
-- CMS Catalog Content Bindings — marketing-copy + imagery overlays on catalog
-- rows (accommodations, rentals, activities, places, areas, dining, suppliers,
-- SKUs, offers). Bindings NEVER mutate the catalog tables: public reads merge
-- published bindings over the row at serve time, so disabling or deleting a
-- binding instantly restores catalog truth. Operational fields (price,
-- capacity, availability, status, ledger) are intentionally NOT bindable —
-- the FIELD_REGISTRY in catalogContentService.ts is the allow-list.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_content_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value_text TEXT DEFAULT '',
  media_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT DEFAULT '',
  published_at TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id, field)
);
CREATE INDEX IF NOT EXISTS idx_cms_bindings_entity ON cms_content_bindings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cms_bindings_status ON cms_content_bindings(status);
CREATE INDEX IF NOT EXISTS idx_cms_bindings_media ON cms_content_bindings(media_id);

-- ============================================================================
-- CMS Site Strings — dashboard-editable overrides for UI copy (src/i18n).
-- Only OVERRIDES live here: the compiled TRANSLATIONS table in
-- src/i18n/translations.ts owns the key set and the defaults, so a fresh
-- checkout works with zero rows and newly added code keys appear
-- automatically. The public bundle ships overrides only; the client merges
-- them over the compiled defaults. Deleting a row resets that key to code.
-- Keys are never created or deleted from the dashboard — code owns keys.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_strings (
  key TEXT PRIMARY KEY NOT NULL,
  value_en TEXT DEFAULT '',
  value_ar TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_strings_updated ON cms_strings(updated_at);

-- ============================================================================
-- CMS Site Info — contact / social / hours slots rendered in the footer.
-- A closed key set (see SITE_INFO_KEYS in siteInfoService.ts): the footer
-- renders known slots, so free-form keys would never display. Rows are
-- created only by editors or the one-way legacy import — never seeded — so
-- the footer contact block stays hidden until real values exist (no
-- placeholder phone numbers on the live site).
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_site_info (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT DEFAULT '',
  value_ar TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

-- ============================================================================
-- CMS Theme Tokens — a closed set of brand/type overrides applied over the
-- active compiled theme (see THEME_TOKENS in themeService.ts). Only validated
-- values are stored (hex colors, allow-listed font stacks, known theme ids),
-- so no arbitrary CSS can ever reach the page. Rows exist only for edited
-- tokens; unset tokens render compiled theme values.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_theme (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

-- ============================================================================
-- Content Programmes — the ready-made trip programmes the web concierge/plan
-- surfaces and the REHLA mobile app render (GET /api/dahab/content/programmes).
-- Seeded idempotently from the editorial catalog (server/db/seeds/
-- editorialContent.ts); the dashboard edits rows and clients read the DB.
-- Non-sqlite adapters fall back to the seed at serve time, so the public
-- shape never regresses. snake_case columns mirror the public camelCase
-- contract 1:1 (contentProgrammesService.toPublic).
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_programmes (
  id TEXT PRIMARY KEY NOT NULL,
  destination TEXT NOT NULL DEFAULT 'dahab',
  title_en TEXT NOT NULL DEFAULT '',
  title_ar TEXT NOT NULL DEFAULT '',
  tagline_en TEXT DEFAULT '',
  tagline_ar TEXT DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 1,
  ideal_for_en TEXT DEFAULT '',
  ideal_for_ar TEXT DEFAULT '',
  pace TEXT NOT NULL DEFAULT 'Balanced',
  pace_ar TEXT DEFAULT '',
  intensity_score INTEGER NOT NULL DEFAULT 3,
  free_time_score INTEGER NOT NULL DEFAULT 40,
  starting_price_egp REAL NOT NULL DEFAULT 0,
  price_is_estimate INTEGER NOT NULL DEFAULT 1,
  hero_image TEXT DEFAULT '',
  badge_en TEXT DEFAULT '',
  badge_ar TEXT DEFAULT '',
  highlights_en TEXT DEFAULT '[]',
  highlights_ar TEXT DEFAULT '[]',
  included_en TEXT DEFAULT '[]',
  included_ar TEXT DEFAULT '[]',
  customizable_en TEXT DEFAULT '[]',
  customizable_ar TEXT DEFAULT '[]',
  default_interests TEXT DEFAULT '[]',
  default_budget TEXT NOT NULL DEFAULT 'Moderate',
  day_by_day TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_programmes_destination ON content_programmes(destination);
CREATE INDEX IF NOT EXISTS idx_content_programmes_status ON content_programmes(status);
CREATE INDEX IF NOT EXISTS idx_content_programmes_sort ON content_programmes(sort_order);
`;

/**
 * Get the raw SQLite connection from the persistence adapter.
 * Returns null if the adapter is not SQLite.
 */
function getSqliteConnection(): SqliteDb | null {
  const adapter = db.getAdapter();
  if (adapter instanceof SqlitePersistenceAdapter) {
    return adapter.connection;
  }
  return null;
}

/**
 * Run the CMS schema creation. Safe to call on every boot (IF NOT EXISTS).
 * Must be called after the main schema is built (which happens in the
 * SqlitePersistenceAdapter constructor).
 */
export function initializeCmsSchema(): void {
  const conn = getSqliteConnection();
  if (!conn) {
    console.warn('[CMS] Schema initialization skipped: adapter is not SQLite');
    return;
  }

  try {
    conn.exec(CMS_TABLES);
    migrateCmsColumns(conn);
    console.log('[CMS] Content management tables initialized successfully');
  } catch (err: any) {
    console.error('[CMS] Schema initialization failed:', err.message);
  }
}

/**
 * Additive column migrations for tables that already exist.
 *
 * CREATE TABLE IF NOT EXISTS never touches an existing table, so every new
 * CMS column needs a guarded ALTER here — otherwise fresh checkouts get the
 * column from the DDL while long-lived databases silently miss it and the
 * service reads undefined.
 */
export function migrateCmsColumns(conn?: SqliteDb): void {
  const c = conn || getSqliteConnection();
  if (!c) return;
  try {
    const addIfMissing = (table: string, name: string, ddl: string) => {
      const cols = c.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some(col => col.name === name)) {
        c.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };
    addIfMissing('cms_media', 'focal_x', 'focal_x INTEGER NOT NULL DEFAULT 50');
    addIfMissing('cms_media', 'focal_y', 'focal_y INTEGER NOT NULL DEFAULT 50');
    addIfMissing('cms_media', 'variants', "variants TEXT DEFAULT '[]'");
    addIfMissing('cms_pages', 'preview_expires_at', "preview_expires_at TEXT DEFAULT ''");
  } catch (err: any) {
    console.error('[CMS] Column migration failed:', err.message);
  }
}

/** Kept for callers written against the media-only migration step. */
export function migrateCmsMediaColumns(conn?: SqliteDb): void {
  migrateCmsColumns(conn);
}
