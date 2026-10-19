import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from '../db/sqlite/SqlitePersistenceAdapter';
import { db } from '../db/database';
import { assertNoLiteralEscapes } from './textIntegrity';

const CMS_TEXT_FIELDS = [
  'title_en', 'title_ar', 'subtitle_en', 'subtitle_ar',
  'description_en', 'description_ar', 'body_en', 'body_ar',
  'hero_image_alt_en', 'hero_image_alt_ar',
  'seo_title_en', 'seo_title_ar', 'seo_description_en', 'seo_description_ar',
] as const;

// ============================================================================
// CMS Entity Types
// ============================================================================

export interface CmsPage {
  id: string;
  slug: string;
  type: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  description_en: string;
  description_ar: string;
  body_en: string;
  body_ar: string;
  hero_image_url: string;
  hero_image_alt_en: string;
  hero_image_alt_ar: string;
  status: 'draft' | 'published' | 'archived';
  seo_title_en: string;
  seo_title_ar: string;
  seo_description_en: string;
  seo_description_ar: string;
  og_image_url: string;
  sort_order: number;
  featured: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  scheduled_at: string;
  preview_token: string;
  /** ISO expiry for the draft preview link — findByPreviewToken honors it. */
  preview_expires_at: string;
  version: number;
}

export interface CmsBlock {
  id: string;
  page_id: string;
  type: string;
  sort_order: number;
  visible: number;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  config: string;
  created_at: string;
  updated_at: string;
}

export interface MediaVariant {
  width: number;
  url: string;
  bytes: number;
}

export interface CmsMedia {
  id: string;
  filename: string;
  original_url: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  aspect_ratio: string;
  alt_en: string;
  alt_ar: string;
  caption_en: string;
  caption_ar: string;
  credit: string;
  category: string;
  tags: string;
  usage_count: number;
  /** Focal point for smart crops, 0–100 on each axis (50/50 = center). */
  focal_x: number;
  focal_y: number;
  /** Pre-rendered responsive siblings (see imageVariants.ts). Empty when the
   *  source was too small to downscale, animated (GIF), or registered by URL. */
  variants: MediaVariant[];
  created_at: string;
  updated_at: string;
  /** Computed per-response by the admin media list — never stored. */
  usedCount?: number;
  usedIn?: MediaReference[];
}

export interface MediaReference {  kind: 'binding' | 'page';
  entityType?: string;
  entityId?: string;
  label?: string;
  field?: string;
  status?: string;
}

export interface CmsHomepageSection {
  id: string;
  section_key: string;
  title_en: string;
  title_ar: string;
  visible: number;
  sort_order: number;
  // Hydrated: hydrate() parses the stored JSON into an object for findAll/
  // findByKey, and upsert now returns the parsed object too so PATCH responses
  // stay consistent with GET (the dashboard editor depends on this).
  config: Record<string, any>;
  updated_at: string;
}

export interface CmsNavigation {
  id: string;
  menu_key: string;
  item_order: number;
  label_en: string;
  label_ar: string;
  route: string;
  external_url: string;
  visible: number;
  open_in_new: number;
  icon: string;
  group_label_en: string;
  group_label_ar: string;
  created_at: string;
  updated_at: string;
}

export interface CmsSeo {
  id: string;
  page_type: string;
  page_id: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  og_title_en: string;
  og_title_ar: string;
  og_description_en: string;
  og_description_ar: string;
  og_image_url: string;
  canonical_url: string;
  noindex: number;
  updated_at: string;
}

export interface CmsRevision {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  actor_name: string;
  payload: string;
  created_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function conn(): SqliteDb | null {
  const adapter = db.getAdapter();
  return adapter instanceof SqlitePersistenceAdapter ? adapter.connection : null;
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${ts}-${rand}`.toUpperCase();
}

/** Draft preview links live 7 days — long enough to share, short enough that a leaked token dies on its own. */
export const PREVIEW_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function previewExpiryFromNow(): string {
  return new Date(Date.now() + PREVIEW_TOKEN_TTL_MS).toISOString();
}

function hydrate<T>(row: unknown): T {
  const r = row as Record<string, any>;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === 'config' && typeof v === 'string') {
      try { out[k] = JSON.parse(v); } catch { out[k] = {}; }
    } else if (k === 'payload' && typeof v === 'string') {
      try { out[k] = JSON.parse(v); } catch { out[k] = {}; }
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

// ============================================================================
// Revision Logger
// ============================================================================

function logRevision(
  entityType: string,
  entityId: string,
  action: string,
  actorId: string,
  actorName: string,
  payload?: Record<string, any>
): void {
  const c = conn();
  if (!c) return;

  const id = generateId('REV');
  c.prepare(`
    INSERT INTO cms_revisions (id, entity_type, entity_id, action, actor_id, actor_name, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entityType, entityId, action, actorId || '', actorName || '', JSON.stringify(payload || {}), now());
}

// ============================================================================
// Pages CRUD
// ============================================================================

export const cmsPages = {
  findAll(status?: string): CmsPage[] {
    const c = conn();
    if (!c) return [];
    if (status) {
      return c.prepare('SELECT * FROM cms_pages WHERE status = ? ORDER BY sort_order, created_at DESC')
        .all(status).map(hydrate<CmsPage>);
    }
    return c.prepare('SELECT * FROM cms_pages ORDER BY sort_order, created_at DESC')
      .all().map(hydrate<CmsPage>);
  },

  findBySlug(slug: string): CmsPage | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_pages WHERE slug = ?').get(slug);
    return row ? hydrate<CmsPage>(row) : null;
  },

  findById(id: string): CmsPage | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_pages WHERE id = ?').get(id);
    return row ? hydrate<CmsPage>(row) : null;
  },

  findPublishedByType(type: string): CmsPage[] {
    const c = conn();
    if (!c) return [];
    return c.prepare('SELECT * FROM cms_pages WHERE type = ? AND status = ? ORDER BY sort_order, created_at')
      .all(type, 'published').map(hydrate<CmsPage>);
  },

  findPublishedFeatured(): CmsPage[] {
    const c = conn();
    if (!c) return [];
    return c.prepare('SELECT * FROM cms_pages WHERE status = ? AND featured = 1 ORDER BY sort_order')
      .all('published').map(hydrate<CmsPage>);
  },

  create(data: Partial<CmsPage>, actorId?: string, actorName?: string): CmsPage {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    assertNoLiteralEscapes(data as Record<string, unknown>, CMS_TEXT_FIELDS);
    const id = generateId('CMS');
    const ts = now();
    const page: CmsPage = {
      id,
      slug: data.slug || id.toLowerCase(),
      type: data.type || 'static_page',
      title_en: data.title_en || '',
      title_ar: data.title_ar || '',
      subtitle_en: data.subtitle_en || '',
      subtitle_ar: data.subtitle_ar || '',
      description_en: data.description_en || '',
      description_ar: data.description_ar || '',
      body_en: data.body_en || '',
      body_ar: data.body_ar || '',
      hero_image_url: data.hero_image_url || '',
      hero_image_alt_en: data.hero_image_alt_en || '',
      hero_image_alt_ar: data.hero_image_alt_ar || '',
      status: data.status || 'draft',
      seo_title_en: data.seo_title_en || '',
      seo_title_ar: data.seo_title_ar || '',
      seo_description_en: data.seo_description_en || '',
      seo_description_ar: data.seo_description_ar || '',
      og_image_url: data.og_image_url || '',
      sort_order: data.sort_order || 0,
      featured: data.featured || 0,
      created_by: actorId || '',
      updated_by: actorId || '',
      created_at: ts,
      updated_at: ts,
      published_at: '',
      scheduled_at: data.scheduled_at || '',
      preview_token: generateId('PREV'),
      preview_expires_at: previewExpiryFromNow(),
      version: 1,
    };

    c.prepare(`
      INSERT INTO cms_pages (id, slug, type, title_en, title_ar, subtitle_en, subtitle_ar,
        description_en, description_ar, body_en, body_ar, hero_image_url,
        hero_image_alt_en, hero_image_alt_ar, status, seo_title_en, seo_title_ar,
        seo_description_en, seo_description_ar, og_image_url, sort_order, featured,
        created_by, updated_by, created_at, updated_at, published_at, scheduled_at,
        preview_token, preview_expires_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      page.id, page.slug, page.type, page.title_en, page.title_ar,
      page.subtitle_en, page.subtitle_ar, page.description_en, page.description_ar,
      page.body_en, page.body_ar, page.hero_image_url,
      page.hero_image_alt_en, page.hero_image_alt_ar, page.status,
      page.seo_title_en, page.seo_title_ar, page.seo_description_en, page.seo_description_ar,
      page.og_image_url, page.sort_order, page.featured,
      page.created_by, page.updated_by, page.created_at, page.updated_at,
      page.published_at, page.scheduled_at, page.preview_token, page.preview_expires_at, page.version
    );

    // Record the initial restorable state so rollback() can return the page to
    // its as-created form, not just note the slug.
    logRevision('page', id, 'create', actorId || '', actorName || '', {
      title_en: page.title_en, title_ar: page.title_ar,
      subtitle_en: page.subtitle_en, subtitle_ar: page.subtitle_ar,
      description_en: page.description_en, description_ar: page.description_ar,
      body_en: page.body_en, body_ar: page.body_ar,
      hero_image_url: page.hero_image_url,
      sort_order: page.sort_order, featured: page.featured, status: page.status,
    });
    return page;
  },

  update(id: string, data: Partial<CmsPage>, actorId?: string, actorName?: string): CmsPage | null {
    const c = conn();
    if (!c) return null;
    const existing = this.findById(id);
    if (!existing) return null;
    assertNoLiteralEscapes(data as Record<string, unknown>, CMS_TEXT_FIELDS);

    const ts = now();
    const updated = { ...existing, ...data, updated_at: ts, version: existing.version + 1 };

    c.prepare(`
      UPDATE cms_pages SET
        slug = ?, type = ?, title_en = ?, title_ar = ?, subtitle_en = ?, subtitle_ar = ?,
        description_en = ?, description_ar = ?, body_en = ?, body_ar = ?,
        hero_image_url = ?, hero_image_alt_en = ?, hero_image_alt_ar = ?,
        status = ?, seo_title_en = ?, seo_title_ar = ?,
        seo_description_en = ?, seo_description_ar = ?, og_image_url = ?,
        sort_order = ?, featured = ?, updated_by = ?, updated_at = ?, published_at = ?,
        scheduled_at = ?, preview_token = ?, version = ?
      WHERE id = ?
    `).run(
      updated.slug, updated.type, updated.title_en, updated.title_ar,
      updated.subtitle_en, updated.subtitle_ar, updated.description_en, updated.description_ar,
      updated.body_en, updated.body_ar, updated.hero_image_url,
      updated.hero_image_alt_en, updated.hero_image_alt_ar, updated.status,
      updated.seo_title_en, updated.seo_title_ar, updated.seo_description_en, updated.seo_description_ar,
      updated.og_image_url, updated.sort_order, updated.featured,
      actorId || '', updated.updated_at, updated.published_at, updated.scheduled_at, updated.preview_token, updated.version, id
    );

    // Record the changed field VALUES (not just names) so rollback() can restore them.
    const changedValues: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k in existing) changedValues[k] = v;
    }
    logRevision('page', id, 'update', actorId || '', actorName || '', changedValues);
    return updated;
  },

  publish(id: string, actorId?: string, actorName?: string): CmsPage | null {
    return this.update(id, { status: 'published', published_at: now(), scheduled_at: '' }, actorId, actorName);
  },

  archive(id: string, actorId?: string, actorName?: string): CmsPage | null {
    return this.update(id, { status: 'archived' }, actorId, actorName);
  },

  /**
   * Schedule a page to be published at a specific time.
   * The page stays in 'draft' status until the scheduled time.
   */
  schedule(id: string, scheduledAt: string, actorId?: string, actorName?: string): CmsPage | null {
    return this.update(id, { scheduled_at: scheduledAt }, actorId, actorName);
  },

  /**
   * Rollback a page to a previous revision.
   * Finds the revision with the given ID and restores the page fields from its payload.
   *
   * Revision payloads historically stored only field NAMES ({ fields: [...] }), which
   * rollback() silently ignored — a rollback appeared to succeed but changed nothing.
   * `update()` now records the changed field VALUES, so this restores them. Payloads
   * that only carry field names (legacy revisions) still return the page untouched
   * rather than nulling out fields.
   */
  rollback(id: string, revisionId: string, actorId?: string, actorName?: string): CmsPage | null {
    const c = conn();
    if (!c) return null;

    const revision = c.prepare('SELECT * FROM cms_revisions WHERE id = ? AND entity_type = ? AND entity_id = ?')
      .get(revisionId, 'page', id) as Record<string, any> | undefined;
    if (!revision) return null;

    let payload: Record<string, any> = {};
    try { payload = JSON.parse(revision.payload || '{}'); } catch { return null; }

    const restoreData: Partial<CmsPage> = {};
    const pageFields = ['title_en', 'title_ar', 'subtitle_en', 'subtitle_ar', 'description_en', 'description_ar',
      'body_en', 'body_ar', 'hero_image_url', 'sort_order', 'featured', 'status'] as const;
    for (const field of pageFields) {
      if (field in payload) {
        (restoreData as any)[field] = payload[field];
      }
    }

    // Legacy payloads ({ fields: ['title_en', ...] }) list names only — nothing to restore.
    if (Object.keys(restoreData).length === 0) {
      return this.findById(id);
    }

    return this.update(id, restoreData, actorId, actorName);
  },

  /**
   * Find a page by its preview token (for draft preview). Undated legacy
   * tokens and past-dated tokens are dead — mint a fresh link via
   * regeneratePreviewToken instead of honoring them forever.
   */
  findByPreviewToken(token: string): CmsPage | null {
    const c = conn();
    if (!c || !token) return null;
    const row = c.prepare('SELECT * FROM cms_pages WHERE preview_token = ?').get(token);
    if (!row) return null;
    const page = hydrate<CmsPage>(row);
    if (!page.preview_expires_at || page.preview_expires_at <= now()) return null;
    return page;
  },

  /**
   * Mint a fresh preview token + expiry (the old link dies immediately).
   * Any of the CMS roles may refresh — previewing a draft is not publishing.
   */
  regeneratePreviewToken(id: string, actorId?: string, actorName?: string): CmsPage | null {
    const c = conn();
    if (!c) return null;
    const existing = this.findById(id);
    if (!existing) return null;
    const ts = now();
    const token = generateId('PREV');
    const expires = previewExpiryFromNow();
    c.prepare(`
      UPDATE cms_pages SET preview_token = ?, preview_expires_at = ?,
        version = version + 1, updated_by = ?, updated_at = ?
      WHERE id = ?
    `).run(token, expires, actorId || '', ts, id);
    logRevision('page', id, 'preview_refresh', actorId || '', actorName || '', { preview_expires_at: expires });
    return this.findById(id);
  },

  /**
   * Check for scheduled pages and publish them if their scheduled time has passed.
   */
  checkScheduled(): CmsPage[] {
    const c = conn();
    if (!c) return [];
    const ts = now();
    // Use a generous lookback window to catch any scheduled pages
    const scheduled = c.prepare(
      `SELECT * FROM cms_pages WHERE scheduled_at != '' AND status != 'published'`
    ).all() as any[];

    const published: CmsPage[] = [];
    for (const row of scheduled) {
      // Compare timestamps: only publish if scheduled_at is in the past
      if (row.scheduled_at > ts) continue;

      const result = c.prepare(
        `UPDATE cms_pages SET status = 'published', published_at = ?, scheduled_at = '' WHERE id = ?`
      ).run(ts, row.id);
      if (result.changes > 0) {
        logRevision('page', row.id, 'scheduled_publish', 'system', 'System', { scheduled_at: row.scheduled_at });
        const updated = this.findById(row.id);
        if (updated) published.push(updated);
      }
    }
    return published;
  },

  remove(id: string): boolean {
    const c = conn();
    if (!c) return false;
    const result = c.prepare('DELETE FROM cms_pages WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// ============================================================================
// Blocks CRUD
// ============================================================================

export const cmsBlocks = {
  findByPageId(pageId: string): CmsBlock[] {
    const c = conn();
    if (!c) return [];
    return c.prepare('SELECT * FROM cms_blocks WHERE page_id = ? ORDER BY sort_order')
      .all(pageId).map(hydrate<CmsBlock>);
  },

  findById(id: string): CmsBlock | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_blocks WHERE id = ?').get(id);
    return row ? hydrate<CmsBlock>(row) : null;
  },

  create(data: Partial<CmsBlock>, actorId?: string, actorName?: string): CmsBlock {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    assertNoLiteralEscapes(data as Record<string, unknown>, CMS_TEXT_FIELDS);
    const id = generateId('BLK');
    const ts = now();
    const block: CmsBlock = {
      id,
      page_id: data.page_id || '',
      type: data.type || 'rich_text',
      sort_order: data.sort_order || 0,
      visible: data.visible ?? 1,
      title_en: data.title_en || '',
      title_ar: data.title_ar || '',
      body_en: data.body_en || '',
      body_ar: data.body_ar || '',
      config: typeof data.config === 'object' ? JSON.stringify(data.config) : (data.config || '{}'),
      created_at: ts,
      updated_at: ts,
    };

    c.prepare(`
      INSERT INTO cms_blocks (id, page_id, type, sort_order, visible, title_en, title_ar,
        body_en, body_ar, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(block.id, block.page_id, block.type, block.sort_order, block.visible,
      block.title_en, block.title_ar, block.body_en, block.body_ar,
      block.config, block.created_at, block.updated_at);

    logRevision('block', id, 'create', actorId || '', actorName || '', {
      page_id: block.page_id, type: block.type, sort_order: block.sort_order,
      visible: block.visible, title_en: block.title_en, title_ar: block.title_ar,
      body_en: block.body_en, body_ar: block.body_ar, config: block.config,
    });
    return block;
  },

  update(id: string, data: Partial<CmsBlock>, actorId?: string, actorName?: string): CmsBlock | null {
    const c = conn();
    if (!c) return null;
    const existing = this.findById(id);
    if (!existing) return null;
    assertNoLiteralEscapes(data as Record<string, unknown>, CMS_TEXT_FIELDS);

    const ts = now();
    const updated = { ...existing, ...data, updated_at: ts };
    const configStr = typeof updated.config === 'object' ? JSON.stringify(updated.config) : updated.config;

    c.prepare(`
      UPDATE cms_blocks SET page_id = ?, type = ?, sort_order = ?, visible = ?,
        title_en = ?, title_ar = ?, body_en = ?, body_ar = ?, config = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.page_id, updated.type, updated.sort_order, updated.visible,
      updated.title_en, updated.title_ar, updated.body_en, updated.body_ar,
      configStr, updated.updated_at, id);

    // Changed field VALUES (not names) — the audit trail must be restorable,
    // like page revisions (see cmsPages.rollback).
    const changedValues: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k in existing) changedValues[k] = v;
    }
    logRevision('block', id, 'update', actorId || '', actorName || '', changedValues);
    return updated;
  },

  remove(id: string): boolean {
    const c = conn();
    if (!c) return false;
    const result = c.prepare('DELETE FROM cms_blocks WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// ============================================================================
// Media CRUD
// ============================================================================

/** Clamp a focal axis to 0–100; non-numbers fall back to center (50). */
export function clampFocalAxis(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Normalize the variants JSON column (or upload payload) into MediaVariant[]. */
export function parseVariants(raw: unknown): MediaVariant[] {
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return [];
    return list
      .filter(v => v && typeof v === 'object'
        && Number.isFinite((v as any).width) && (v as any).width > 0
        && typeof (v as any).url === 'string' && (v as any).url)
      .map(v => ({
        width: Math.floor((v as any).width),
        url: String((v as any).url),
        bytes: Number.isFinite((v as any).bytes) ? Math.floor((v as any).bytes) : 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Sanitize a homepage section config before storage. Only known-safe
 * constraints live here: hero overlay_opacity is coerced to an integer
 * 0–100 (garbage restores full scrims). Unknown keys pass through —
 * section configs are schemaless by design.
 */
export function sanitizeHomepageConfig(sectionKey: string, config: unknown): Record<string, any> | undefined {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined;
  const cfg = { ...(config as Record<string, any>) };
  if (sectionKey === 'hero' && cfg.overlay_opacity !== undefined) {
    const n = Number(cfg.overlay_opacity);
    cfg.overlay_opacity = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 100;
  }
  return cfg;
}

export const cmsMedia = {
  findAll(category?: string): CmsMedia[] {
    const c = conn();
    if (!c) return [];
    const rows = category
      ? c.prepare('SELECT * FROM cms_media WHERE category = ? ORDER BY created_at DESC').all(category)
      : c.prepare('SELECT * FROM cms_media ORDER BY created_at DESC').all();
    // Rows written before the focal columns existed come back without them —
    // the migration normally backfills, but default here too so readers never
    // see undefined.
    return rows.map((row: any) => {
      const media = hydrate<CmsMedia>(row);
      if (media.focal_x === undefined || media.focal_x === null) media.focal_x = 50;
      if (media.focal_y === undefined || media.focal_y === null) media.focal_y = 50;
      media.variants = parseVariants((media as any).variants);
      return media;
    });
  },

  findById(id: string): CmsMedia | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_media WHERE id = ?').get(id);
    if (!row) return null;
    const media = hydrate<CmsMedia>(row);
    if (media.focal_x === undefined || media.focal_x === null) media.focal_x = 50;
    if (media.focal_y === undefined || media.focal_y === null) media.focal_y = 50;
    media.variants = parseVariants((media as any).variants);
    return media;
  },

  create(data: Partial<CmsMedia>, actorId?: string, actorName?: string): CmsMedia {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    const id = generateId('MED');
    const ts = now();
    const media: CmsMedia = {
      id,
      filename: data.filename || '',
      original_url: data.original_url || '',
      storage_path: data.storage_path || '',
      mime_type: data.mime_type || 'image/jpeg',
      file_size: data.file_size || 0,
      width: data.width || 0,
      height: data.height || 0,
      aspect_ratio: data.aspect_ratio || '',
      alt_en: data.alt_en || '',
      alt_ar: data.alt_ar || '',
      caption_en: data.caption_en || '',
      caption_ar: data.caption_ar || '',
      credit: data.credit || '',
      category: data.category || 'general',
      tags: data.tags || '',
      usage_count: 0,
      focal_x: data.focal_x === undefined ? 50 : clampFocalAxis(data.focal_x),
      focal_y: data.focal_y === undefined ? 50 : clampFocalAxis(data.focal_y),
      variants: parseVariants(data.variants),
      created_at: ts,
      updated_at: ts,
    };

    c.prepare(`
      INSERT INTO cms_media (id, filename, original_url, storage_path, mime_type,
        file_size, width, height, aspect_ratio, alt_en, alt_ar, caption_en, caption_ar,
        credit, category, tags, usage_count, focal_x, focal_y, variants, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(media.id, media.filename, media.original_url, media.storage_path, media.mime_type,
      media.file_size, media.width, media.height, media.aspect_ratio,
      media.alt_en, media.alt_ar, media.caption_en, media.caption_ar,
      media.credit, media.category, media.tags, media.usage_count,
      media.focal_x, media.focal_y, JSON.stringify(media.variants),
      media.created_at, media.updated_at);

    logRevision('media', id, 'create', actorId || '', actorName || '', {
      filename: media.filename, mime_type: media.mime_type, category: media.category,
      alt_en: media.alt_en, alt_ar: media.alt_ar, caption_en: media.caption_en,
      caption_ar: media.caption_ar, credit: media.credit, tags: media.tags,
      focal_x: media.focal_x, focal_y: media.focal_y,
    });
    return media;
  },

  update(id: string, data: Partial<CmsMedia>, actorId?: string, actorName?: string): CmsMedia | null {
    const c = conn();
    if (!c) return null;
    const existing = this.findById(id);
    if (!existing) return null;

    const ts = now();
    const updated = {
      ...existing,
      ...data,
      focal_x: data.focal_x === undefined ? existing.focal_x ?? 50 : clampFocalAxis(data.focal_x),
      focal_y: data.focal_y === undefined ? existing.focal_y ?? 50 : clampFocalAxis(data.focal_y),
      variants: parseVariants(data.variants !== undefined ? data.variants : existing.variants),
      updated_at: ts,
    };

    c.prepare(`
      UPDATE cms_media SET filename = ?, original_url = ?, storage_path = ?, mime_type = ?,
        file_size = ?, width = ?, height = ?, aspect_ratio = ?,
        alt_en = ?, alt_ar = ?, caption_en = ?, caption_ar = ?,
        credit = ?, category = ?, tags = ?, focal_x = ?, focal_y = ?, variants = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.filename, updated.original_url, updated.storage_path, updated.mime_type,
      updated.file_size, updated.width, updated.height, updated.aspect_ratio,
      updated.alt_en, updated.alt_ar, updated.caption_en, updated.caption_ar,
      updated.credit, updated.category, updated.tags,
      updated.focal_x, updated.focal_y, JSON.stringify(updated.variants), updated.updated_at, id);

    const changedValues: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k in existing) changedValues[k] = v;
    }
    logRevision('media', id, 'update', actorId || '', actorName || '', changedValues);
    return updated;
  },

  remove(id: string): boolean {
    const c = conn();
    if (!c) return false;
    const result = c.prepare('DELETE FROM cms_media WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// ============================================================================
// Homepage Sections CRUD
// ============================================================================

export const cmsHomepage = {
  findAll(): CmsHomepageSection[] {
    const c = conn();
    if (!c) return [];
    return c.prepare('SELECT * FROM cms_homepage_sections ORDER BY sort_order')
      .all().map(hydrate<CmsHomepageSection>);
  },

  findByKey(key: string): CmsHomepageSection | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_homepage_sections WHERE section_key = ?').get(key);
    return row ? hydrate<CmsHomepageSection>(row) : null;
  },

  upsert(data: Partial<CmsHomepageSection>, actorId?: string, actorName?: string): CmsHomepageSection {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    assertNoLiteralEscapes(data as Record<string, unknown>, ['title_en', 'title_ar']);

    const existing = this.findByKey(data.section_key || '');
    const ts = now();
    const configStr: string = typeof data.config === 'object' ? JSON.stringify(data.config) : String(data.config || '{}');
    // Return config parsed (like hydrate does for findAll) so PATCH responses
    // stay consistent with GET — the dashboard editor keeps working after save.
    let parsedConfig: Record<string, any> = {};
    try { parsedConfig = JSON.parse(configStr); } catch { parsedConfig = {}; }

    if (existing) {
      c.prepare(`
        UPDATE cms_homepage_sections SET title_en = ?, title_ar = ?, visible = ?,
          sort_order = ?, config = ?, updated_at = ?
        WHERE section_key = ?
      `).run(
        data.title_en ?? existing.title_en,
        data.title_ar ?? existing.title_ar,
        data.visible ?? existing.visible,
        data.sort_order ?? existing.sort_order,
        configStr, ts, data.section_key
      );
      logRevision('homepage_section', existing.id, 'update', actorId || '', actorName || '', {
        section_key: data.section_key, title_en: data.title_en ?? existing.title_en,
        title_ar: data.title_ar ?? existing.title_ar, visible: data.visible ?? existing.visible,
        sort_order: data.sort_order ?? existing.sort_order, config: parsedConfig,
      });
      return { ...existing, ...data, config: parsedConfig, updated_at: ts } as CmsHomepageSection;
    }

    const id = generateId('HSEC');
    c.prepare(`
      INSERT INTO cms_homepage_sections (id, section_key, title_en, title_ar, visible, sort_order, config, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.section_key || '', data.title_en || '', data.title_ar || '',
      data.visible ?? 1, data.sort_order ?? 0, configStr, ts);

    logRevision('homepage_section', id, 'create', actorId || '', actorName || '', {
      section_key: data.section_key, title_en: data.title_en || '', title_ar: data.title_ar || '',
      visible: data.visible ?? 1, sort_order: data.sort_order ?? 0, config: parsedConfig,
    });
    return {
      id, section_key: data.section_key || '', title_en: data.title_en || '', title_ar: data.title_ar || '',
      visible: data.visible ?? 1, sort_order: data.sort_order ?? 0, config: parsedConfig, updated_at: ts
    };
  },

  remove(sectionKey: string): boolean {
    const c = conn();
    if (!c) return false;
    const result = c.prepare('DELETE FROM cms_homepage_sections WHERE section_key = ?').run(sectionKey);
    return result.changes > 0;
  }
};

// ============================================================================
// Navigation CRUD
// ============================================================================

export const cmsNavigation = {
  findByMenu(menuKey: string): CmsNavigation[] {
    const c = conn();
    if (!c) return [];
    return c.prepare('SELECT * FROM cms_navigation WHERE menu_key = ? AND visible = 1 ORDER BY item_order')
      .all(menuKey).map(hydrate<CmsNavigation>);
  },

  findAllByMenu(menuKey: string): CmsNavigation[] {
    const c = conn();
    if (!c) return [];
    return c.prepare('SELECT * FROM cms_navigation WHERE menu_key = ? ORDER BY item_order')
      .all(menuKey).map(hydrate<CmsNavigation>);
  },

  findById(id: string): CmsNavigation | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_navigation WHERE id = ?').get(id);
    return row ? hydrate<CmsNavigation>(row) : null;
  },

  create(data: Partial<CmsNavigation>, actorId?: string, actorName?: string): CmsNavigation {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    const id = generateId('NAV');
    const ts = now();

    c.prepare(`
      INSERT INTO cms_navigation (id, menu_key, item_order, label_en, label_ar, route,
        external_url, visible, open_in_new, icon, group_label_en, group_label_ar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.menu_key || '', data.item_order || 0,
      data.label_en || '', data.label_ar || '', data.route || '',
      data.external_url || '', data.visible ?? 1, data.open_in_new ?? 0,
      data.icon || '', data.group_label_en || '', data.group_label_ar || '', ts, ts);

    logRevision('navigation', id, 'create', actorId || '', actorName || '', {
      menu_key: data.menu_key || '', label_en: data.label_en || '', label_ar: data.label_ar || '',
      route: data.route || '', external_url: data.external_url || '', visible: data.visible ?? 1,
    });
    return { ...data, id, created_at: ts, updated_at: ts } as CmsNavigation;
  },

  update(id: string, data: Partial<CmsNavigation>, actorId?: string, actorName?: string): CmsNavigation | null {
    const c = conn();
    if (!c) return null;
    const existing = this.findById(id);
    if (!existing) return null;

    const ts = now();
    const updated = { ...existing, ...data, updated_at: ts };

    c.prepare(`
      UPDATE cms_navigation SET menu_key = ?, item_order = ?, label_en = ?, label_ar = ?,
        route = ?, external_url = ?, visible = ?, open_in_new = ?, icon = ?,
        group_label_en = ?, group_label_ar = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.menu_key, updated.item_order, updated.label_en, updated.label_ar,
      updated.route, updated.external_url, updated.visible, updated.open_in_new,
      updated.icon, updated.group_label_en, updated.group_label_ar, updated.updated_at, id);

    const changedValues: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k in existing) changedValues[k] = v;
    }
    logRevision('navigation', id, 'update', actorId || '', actorName || '', changedValues);
    return updated;
  },

  remove(id: string): boolean {
    const c = conn();
    if (!c) return false;
    const result = c.prepare('DELETE FROM cms_navigation WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// ============================================================================
// SEO CRUD
// ============================================================================

export const cmsSeo = {
  find(pageType: string, pageId: string): CmsSeo | null {
    const c = conn();
    if (!c) return null;
    const row = c.prepare('SELECT * FROM cms_seo WHERE page_type = ? AND page_id = ?').get(pageType, pageId);
    return row ? hydrate<CmsSeo>(row) : null;
  },

  upsert(data: Partial<CmsSeo>, actorId?: string, actorName?: string): CmsSeo {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    const ts = now();

    const existing = this.find(data.page_type || '', data.page_id || '');

    if (existing) {
      c.prepare(`
        UPDATE cms_seo SET title_en = ?, title_ar = ?, description_en = ?, description_ar = ?,
          og_title_en = ?, og_title_ar = ?, og_description_en = ?, og_description_ar = ?,
          og_image_url = ?, canonical_url = ?, noindex = ?, updated_at = ?
        WHERE page_type = ? AND page_id = ?
      `).run(
        data.title_en ?? existing.title_en, data.title_ar ?? existing.title_ar,
        data.description_en ?? existing.description_en, data.description_ar ?? existing.description_ar,
        data.og_title_en ?? existing.og_title_en, data.og_title_ar ?? existing.og_title_ar,
        data.og_description_en ?? existing.og_description_en, data.og_description_ar ?? existing.og_description_ar,
        data.og_image_url ?? existing.og_image_url, data.canonical_url ?? existing.canonical_url,
        data.noindex ?? existing.noindex, ts,
        data.page_type, data.page_id
      );
      // SEO had no audit trail at all — log the merged values like every
      // other CMS write so the history tab shows what changed.
      const merged = { ...existing, ...data, updated_at: ts } as CmsSeo;
      logRevision('seo', existing.id, 'update', actorId || '', actorName || '', {
        page_type: merged.page_type, page_id: merged.page_id,
        title_en: merged.title_en, title_ar: merged.title_ar,
        description_en: merged.description_en, description_ar: merged.description_ar,
        og_image_url: merged.og_image_url, canonical_url: merged.canonical_url,
        noindex: merged.noindex,
      });
      return merged;
    }

    const id = generateId('SEO');
    c.prepare(`
      INSERT INTO cms_seo (id, page_type, page_id, title_en, title_ar, description_en, description_ar,
        og_title_en, og_title_ar, og_description_en, og_description_ar, og_image_url,
        canonical_url, noindex, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.page_type || '', data.page_id || '',
      data.title_en || '', data.title_ar || '', data.description_en || '', data.description_ar || '',
      data.og_title_en || '', data.og_title_ar || '', data.og_description_en || '', data.og_description_ar || '',
      data.og_image_url || '', data.canonical_url || '', data.noindex ?? 0, ts);

    logRevision('seo', id, 'create', actorId || '', actorName || '', {
      page_type: data.page_type || '', page_id: data.page_id || '',
      title_en: data.title_en || '', title_ar: data.title_ar || '',
    });
    return { id, ...data, updated_at: ts } as CmsSeo;
  }
};

// ============================================================================
// Revisions
// ============================================================================

export const cmsRevisions = {
  findAll(entityType?: string, entityId?: string, limit = 50): CmsRevision[] {
    const c = conn();
    if (!c) return [];

    if (entityType && entityId) {
      return c.prepare('SELECT * FROM cms_revisions WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT ?')
        .all(entityType, entityId, limit).map(hydrate<CmsRevision>);
    }
    if (entityType) {
      return c.prepare('SELECT * FROM cms_revisions WHERE entity_type = ? ORDER BY created_at DESC LIMIT ?')
        .all(entityType, limit).map(hydrate<CmsRevision>);
    }
    return c.prepare('SELECT * FROM cms_revisions ORDER BY created_at DESC LIMIT ?')
      .all(limit).map(hydrate<CmsRevision>);
  }
};
