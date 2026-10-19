import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from '../db/sqlite/SqlitePersistenceAdapter';
import { db } from '../db/database';
import { cmsMedia, type MediaReference } from './contentService';

// ============================================================================
// Catalog Content Bindings — CMS overlays on catalog rows
// ============================================================================
//
// Catalog tables (accommodations, rentals, activities, ...) stay authoritative
// for operations. This service stores only marketing copy + imagery overrides
// in cms_content_bindings and merges PUBLISHED bindings over rows at serve
// time. Nothing here writes to catalog tables, so the booking engine, pricing
// and availability logic cannot be affected by CMS edits.
//
// Operational fields (price, capacity, availability, status, ledger) are
// deliberately absent from the registry below: upsert() rejects any field not
// listed, so a crafted request cannot smuggle `basePriceEGP` into the CMS.

export type CatalogEntityType =
  | 'accommodation'
  | 'rental'
  | 'activity'
  | 'place'
  | 'area'
  | 'dining_venue'
  | 'supplier'
  | 'sku'
  | 'offer';

export interface CatalogFieldSpec {
  labelEn: string;
  labelAr: string;
  textFields: string[];
  mediaFields: string[];
}

export const CATALOG_FIELD_REGISTRY: Record<CatalogEntityType, CatalogFieldSpec> = {
  accommodation: {
    labelEn: 'Accommodations',
    labelAr: 'أماكن الإقامة',
    textFields: [
      'title_en', 'title_ar',
      'tagline_en', 'tagline_ar',
      'description_en', 'description_ar',
      'amenities_en', 'amenities_ar',
      'best_for_en', 'best_for_ar',
      'note_en', 'note_ar',
    ],
    mediaFields: ['cover_media_id', 'gallery_media_ids'],
  },
  rental: {
    labelEn: 'Rentals',
    labelAr: 'التأجير',
    textFields: [
      'title_en', 'title_ar',
      'tagline_en', 'tagline_ar',
      'description_en', 'description_ar',
      'features_en', 'features_ar',
      'policies_en', 'policies_ar',
    ],
    mediaFields: ['cover_media_id', 'gallery_media_ids'],
  },
  activity: {
    labelEn: 'Activities',
    labelAr: 'الأنشطة',
    textFields: ['title_en', 'title_ar', 'preparation_en', 'preparation_ar'],
    mediaFields: ['cover_media_id'],
  },
  place: {
    labelEn: 'Places',
    labelAr: 'الأماكن',
    textFields: ['name_en', 'name_ar', 'description_en', 'description_ar'],
    mediaFields: ['cover_media_id'],
  },
  area: {
    labelEn: 'Areas',
    labelAr: 'المناطق',
    textFields: ['name_en', 'name_ar', 'description_en', 'description_ar'],
    mediaFields: ['cover_media_id'],
  },
  dining_venue: {
    labelEn: 'Restaurants',
    labelAr: 'المطاعم',
    textFields: ['name_en', 'name_ar'],
    mediaFields: ['cover_media_id'],
  },
  supplier: {
    labelEn: 'Suppliers',
    labelAr: 'الموردين',
    textFields: ['display_name_en', 'display_name_ar', 'business_name_en', 'business_name_ar'],
    mediaFields: ['logo_media_id'],
  },
  sku: {
    labelEn: 'Product SKUs',
    labelAr: 'المنتجات',
    textFields: ['title_en', 'title_ar', 'description_en'],
    mediaFields: [],
  },
  offer: {
    labelEn: 'Market offers',
    labelAr: 'العروض',
    textFields: [
      'title_en', 'title_ar',
      'includes_en', 'includes_ar',
      'excludes_en', 'excludes_ar',
    ],
    mediaFields: ['cover_media_id'],
  },
};

export const CATALOG_ENTITY_TYPES = Object.keys(CATALOG_FIELD_REGISTRY) as CatalogEntityType[];

export function isCatalogEntityType(value: unknown): value is CatalogEntityType {
  return typeof value === 'string' && (CATALOG_ENTITY_TYPES as string[]).includes(value);
}

/** Binding fields whose value is a newline-separated list (stored raw, split on resolve). */
const LIST_FIELDS = new Set([
  'amenities_en', 'amenities_ar',
  'features_en', 'features_ar',
  'includes_en', 'includes_ar',
  'excludes_en', 'excludes_ar',
  'preparation_en', 'preparation_ar',
]);

/** Single-image binding fields (value is one cms_media id). */
const SINGLE_MEDIA_FIELDS = new Set(['cover_media_id', 'logo_media_id', 'hero_media_id']);

const MAX_TEXT_LENGTH = 8000;
const MAX_GALLERY_IDS = 12;

export interface CmsBinding {
  id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  value_text: string;
  media_id: string;
  status: 'draft' | 'published' | 'archived';
  scheduled_at: string;
  published_at: string;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
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

function hydrate<T>(row: unknown): T {
  return { ...(row as Record<string, any>) } as T;
}

/** Newline-separated editor text → string array for amenities/features-style fields. */
export function splitListValue(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function revisionEntityType(entityType: CatalogEntityType): string {
  return `binding:${entityType}`;
}

function logBindingRevision(
  entityType: CatalogEntityType,
  entityId: string,
  action: string,
  actorId: string,
  actorName: string,
  snapshot: Record<string, { value_text: string; media_id: string; status: string }>
): void {
  const c = conn();
  if (!c) return;
  c.prepare(`
    INSERT INTO cms_revisions (id, entity_type, entity_id, action, actor_id, actor_name, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId('REV'),
    revisionEntityType(entityType),
    entityId,
    action,
    actorId || '',
    actorName || '',
    JSON.stringify({ fields: snapshot }),
    now()
  );
}

function snapshotOf(rows: CmsBinding[]): Record<string, { value_text: string; media_id: string; status: string }> {
  const out: Record<string, { value_text: string; media_id: string; status: string }> = {};
  for (const r of rows) {
    out[r.field] = { value_text: r.value_text, media_id: r.media_id, status: r.status };
  }
  return out;
}

function allowedFields(entityType: CatalogEntityType): string[] {
  const spec = CATALOG_FIELD_REGISTRY[entityType];
  return [...spec.textFields, ...spec.mediaFields];
}

function assertValidEntityId(entityId: unknown): string {
  if (typeof entityId !== 'string' || entityId.trim().length === 0) {
    throw new Error('"entityId" is required and must be a non-empty string.');
  }
  if (entityId.length > 128) {
    throw new Error('"entityId" must be at most 128 characters.');
  }
  return entityId.trim();
}

/**
 * Validate a full fields map BEFORE any write, so a bad key never produces a
 * partial upsert. Returns normalized entries; an empty/whitespace-only value
 * means "clear this override" (the row is deleted, restoring catalog truth).
 */
function normalizeFieldEntries(
  entityType: CatalogEntityType,
  fields: unknown
): { field: string; value: string }[] {
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
    throw new Error('"fields" must be an object mapping binding field names to values.');
  }
  const entries = Object.entries(fields as Record<string, unknown>);
  if (entries.length === 0) {
    throw new Error('"fields" must contain at least one binding field.');
  }
  const allowed = new Set(allowedFields(entityType));
  const spec = CATALOG_FIELD_REGISTRY[entityType];
  const out: { field: string; value: string }[] = [];
  for (const [field, raw] of entries) {
    if (!allowed.has(field)) {
      throw new Error(
        `"${field}" is not a CMS-editable field for ${spec.labelEn}. ` +
        `Editable fields: ${allowedFields(entityType).join(', ')}. ` +
        'Prices, capacity, availability and status stay in their operational admins.'
      );
    }
    if (typeof raw !== 'string') {
      throw new Error(`"${field}" must be a string.`);
    }
    const value = raw.trim();
    if (field === 'gallery_media_ids' && value.length > 2000) {
      throw new Error('"gallery_media_ids" must be at most 2000 characters.');
    } else if (value.length > MAX_TEXT_LENGTH) {
      throw new Error(`"${field}" must be at most ${MAX_TEXT_LENGTH} characters.`);
    }
    out.push({ field, value });
  }
  return out;
}

/** Every media id referenced by a media field must resolve to a real asset. */
function assertMediaIdsExist(entries: { field: string; value: string }[]): void {
  const ids = new Set<string>();
  for (const { field, value } of entries) {
    if (!value) continue;
    if (SINGLE_MEDIA_FIELDS.has(field)) {
      ids.add(value);
    } else if (field === 'gallery_media_ids') {
      for (const part of value.split(',').map(s => s.trim()).filter(Boolean)) ids.add(part);
    }
  }
  for (const id of ids) {
    if (!cmsMedia.findById(id)) {
      throw new Error(`Media asset "${id}" does not exist. Pick an asset from the media library.`);
    }
  }
  const gallery = entries.find(e => e.field === 'gallery_media_ids' && e.value);
  if (gallery) {
    const count = gallery.value.split(',').map(s => s.trim()).filter(Boolean).length;
    if (count > MAX_GALLERY_IDS) {
      throw new Error(`Gallery supports at most ${MAX_GALLERY_IDS} images.`);
    }
  }
}

// ============================================================================
// CRUD + workflow
// ============================================================================

export const catalogBindings = {
  findForEntity(entityType: CatalogEntityType, entityId: string): CmsBinding[] {
    const c = conn();
    if (!c) return [];
    return c
      .prepare('SELECT * FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ? ORDER BY field')
      .all(entityType, entityId)
      .map(hydrate<CmsBinding>);
  },

  findAll(entityType?: CatalogEntityType, status?: string, limit = 200): CmsBinding[] {
    const c = conn();
    if (!c) return [];
    const cap = Math.min(Math.max(limit, 1), 1000);
    if (entityType && status) {
      return c
        .prepare('SELECT * FROM cms_content_bindings WHERE entity_type = ? AND status = ? ORDER BY updated_at DESC LIMIT ?')
        .all(entityType, status, cap)
        .map(hydrate<CmsBinding>);
    }
    if (entityType) {
      return c
        .prepare('SELECT * FROM cms_content_bindings WHERE entity_type = ? ORDER BY updated_at DESC LIMIT ?')
        .all(entityType, cap)
        .map(hydrate<CmsBinding>);
    }
    if (status) {
      return c
        .prepare('SELECT * FROM cms_content_bindings WHERE status = ? ORDER BY updated_at DESC LIMIT ?')
        .all(status, cap)
        .map(hydrate<CmsBinding>);
    }
    return c
      .prepare('SELECT * FROM cms_content_bindings ORDER BY updated_at DESC LIMIT ?')
      .all(cap)
      .map(hydrate<CmsBinding>);
  },

  /**
   * Upsert a fields map for one catalog item. New rows start as drafts;
   * existing rows keep their status (editing a published override does not
   * unpublish it — use unpublish/archive explicitly). Empty values delete the
   * row, restoring catalog truth for that field.
   */
  upsert(
    entityType: CatalogEntityType,
    entityIdRaw: unknown,
    fields: unknown,
    actorId?: string,
    actorName?: string
  ): CmsBinding[] {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    const entityId = assertValidEntityId(entityIdRaw);
    const entries = normalizeFieldEntries(entityType, fields);
    assertMediaIdsExist(entries);

    const ts = now();
    for (const { field, value } of entries) {
      const isMedia = SINGLE_MEDIA_FIELDS.has(field) || field === 'gallery_media_ids';
      if (!value) {
        c.prepare('DELETE FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ? AND field = ?')
          .run(entityType, entityId, field);
        continue;
      }
      const existing = c
        .prepare('SELECT * FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ? AND field = ?')
        .get(entityType, entityId, field) as CmsBinding | undefined;
      if (existing) {
        c.prepare(`
          UPDATE cms_content_bindings
          SET value_text = ?, media_id = ?, version = version + 1, updated_by = ?, updated_at = ?
          WHERE entity_type = ? AND entity_id = ? AND field = ?
        `).run(
          isMedia ? '' : value,
          isMedia ? (SINGLE_MEDIA_FIELDS.has(field) ? value : '') : '',
          actorId || '',
          ts,
          entityType,
          entityId,
          field
        );
        if (field === 'gallery_media_ids') {
          c.prepare(`
            UPDATE cms_content_bindings SET value_text = ? WHERE entity_type = ? AND entity_id = ? AND field = ?
          `).run(value, entityType, entityId, field);
        }
      } else {
        c.prepare(`
          INSERT INTO cms_content_bindings
            (id, entity_type, entity_id, field, value_text, media_id, status,
             scheduled_at, published_at, version, created_by, updated_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'draft', '', '', 1, ?, ?, ?, ?)
        `).run(
          generateId('BND'),
          entityType,
          entityId,
          field,
          isMedia ? (field === 'gallery_media_ids' ? value : '') : value,
          SINGLE_MEDIA_FIELDS.has(field) ? value : '',
          actorId || '',
          actorId || '',
          ts,
          ts
        );
      }
    }

    const rows = this.findForEntity(entityType, entityId);
    logBindingRevision(entityType, entityId, 'upsert', actorId || '', actorName || '', snapshotOf(rows));
    return rows;
  },

  /** Publish / unpublish-to-draft / archive every binding of one catalog item. */
  setStatus(
    entityType: CatalogEntityType,
    entityIdRaw: unknown,
    status: 'draft' | 'published' | 'archived',
    actorId?: string,
    actorName?: string
  ): CmsBinding[] | null {
    const c = conn();
    if (!c) return null;
    const entityId = assertValidEntityId(entityIdRaw);
    if (!['draft', 'published', 'archived'].includes(status)) {
      throw new Error('"status" must be one of: draft, published, archived.');
    }
    const existing = this.findForEntity(entityType, entityId);
    if (existing.length === 0) return null;
    const ts = now();
    c.prepare(`
      UPDATE cms_content_bindings
      SET status = ?,
          published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END,
          scheduled_at = CASE WHEN ? = 'published' THEN '' ELSE scheduled_at END,
          version = version + 1, updated_by = ?, updated_at = ?
      WHERE entity_type = ? AND entity_id = ?
    `).run(status, status, ts, status, actorId || '', ts, entityType, entityId);
    const rows = this.findForEntity(entityType, entityId);
    logBindingRevision(entityType, entityId, status === 'published' ? 'publish' : status, actorId || '', actorName || '', snapshotOf(rows));
    return rows;
  },

  schedule(
    entityType: CatalogEntityType,
    entityIdRaw: unknown,
    scheduledAt: unknown,
    actorId?: string,
    actorName?: string
  ): CmsBinding[] | null {
    const c = conn();
    if (!c) return null;
    const entityId = assertValidEntityId(entityIdRaw);
    if (typeof scheduledAt !== 'string' || Number.isNaN(Date.parse(scheduledAt))) {
      throw new Error('"scheduledAt" must be an ISO date-time string.');
    }
    const existing = this.findForEntity(entityType, entityId);
    if (existing.length === 0) return null;
    const ts = now();
    c.prepare(`
      UPDATE cms_content_bindings
      SET scheduled_at = ?, version = version + 1, updated_by = ?, updated_at = ?
      WHERE entity_type = ? AND entity_id = ? AND status != 'published'
    `).run(scheduledAt, actorId || '', ts, entityType, entityId);
    const rows = this.findForEntity(entityType, entityId);
    logBindingRevision(entityType, entityId, 'schedule', actorId || '', actorName || '', snapshotOf(rows));
    return rows;
  },

  /** Publish every binding whose scheduled time has passed. Returns affected items. */
  checkScheduled(): { entityType: string; entityId: string }[] {
    const c = conn();
    if (!c) return [];
    const ts = now();
    const due = c
      .prepare(`SELECT DISTINCT entity_type, entity_id FROM cms_content_bindings WHERE scheduled_at != '' AND status != 'published'`)
      .all() as { entity_type: string; entity_id: string }[];
    const published: { entityType: string; entityId: string }[] = [];
    for (const row of due) {
      const earliest = c
        .prepare(`SELECT MIN(scheduled_at) AS at FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ? AND scheduled_at != '' AND status != 'published'`)
        .get(row.entity_type, row.entity_id) as { at: string } | undefined;
      if (!earliest?.at || earliest.at > ts) continue;
      c.prepare(`
        UPDATE cms_content_bindings
        SET status = 'published', published_at = ?, scheduled_at = '', version = version + 1,
            updated_by = 'system', updated_at = ?
        WHERE entity_type = ? AND entity_id = ? AND status != 'published'
      `).run(ts, ts, row.entity_type, row.entity_id);
      const rows = c
        .prepare('SELECT * FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ?')
        .all(row.entity_type, row.entity_id)
        .map(hydrate<CmsBinding>);
      logBindingRevision(row.entity_type as CatalogEntityType, row.entity_id, 'scheduled_publish', 'system', 'System', snapshotOf(rows));
      published.push({ entityType: row.entity_type, entityId: row.entity_id });
    }
    return published;
  },

  /**
   * Restore one catalog item's bindings to a previous full snapshot. The
   * snapshot is the complete post-state recorded by upsert/publish/etc, so a
   * rollback is exact — unlike the legacy field-name-only revision payloads.
   */
  rollback(
    entityType: CatalogEntityType,
    entityIdRaw: unknown,
    revisionId: unknown,
    actorId?: string,
    actorName?: string
  ): CmsBinding[] | null {
    const c = conn();
    if (!c) return null;
    const entityId = assertValidEntityId(entityIdRaw);
    if (typeof revisionId !== 'string' || !revisionId) {
      throw new Error('"revisionId" is required.');
    }
    const revision = c
      .prepare('SELECT * FROM cms_revisions WHERE id = ? AND entity_type = ? AND entity_id = ?')
      .get(revisionId, revisionEntityType(entityType), entityId) as Record<string, any> | undefined;
    if (!revision) return null;
    let snapshot: Record<string, { value_text: string; media_id: string; status: string }> = {};
    try {
      const payload = JSON.parse(revision.payload || '{}');
      snapshot = payload.fields || {};
    } catch {
      return null;
    }
    const ts = now();
    const wanted = new Set(Object.keys(snapshot));
    const current = this.findForEntity(entityType, entityId);
    for (const row of current) {
      if (!wanted.has(row.field)) {
        c.prepare('DELETE FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ? AND field = ?')
          .run(entityType, entityId, row.field);
      }
    }
    for (const [field, snap] of Object.entries(snapshot)) {
      const isMedia = SINGLE_MEDIA_FIELDS.has(field) || field === 'gallery_media_ids';
      const valueText = isMedia ? (field === 'gallery_media_ids' ? String(snap.value_text || '') : '') : String(snap.value_text || '');
      const mediaId = SINGLE_MEDIA_FIELDS.has(field) ? String(snap.media_id || '') : '';
      const status = ['draft', 'published', 'archived'].includes(snap.status) ? snap.status : 'draft';
      const existing = c
        .prepare('SELECT * FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ? AND field = ?')
        .get(entityType, entityId, field) as CmsBinding | undefined;
      if (existing) {
        c.prepare(`
          UPDATE cms_content_bindings
          SET value_text = ?, media_id = ?, status = ?, version = version + 1, updated_by = ?, updated_at = ?
          WHERE entity_type = ? AND entity_id = ? AND field = ?
        `).run(valueText, mediaId, status, actorId || '', ts, entityType, entityId, field);
      } else {
        c.prepare(`
          INSERT INTO cms_content_bindings
            (id, entity_type, entity_id, field, value_text, media_id, status,
             scheduled_at, published_at, version, created_by, updated_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 1, ?, ?, ?, ?)
        `).run(generateId('BND'), entityType, entityId, field, valueText, mediaId, status, actorId || '', actorId || '', ts, ts);
      }
    }
    const rows = this.findForEntity(entityType, entityId);
    logBindingRevision(entityType, entityId, 'rollback', actorId || '', actorName || '', snapshotOf(rows));
    return rows;
  },

  /** Delete one field's override, or every binding of the item when no field is given. */
  remove(
    entityType: CatalogEntityType,
    entityIdRaw: unknown,
    field: unknown,
    actorId?: string,
    actorName?: string
  ): boolean {
    const c = conn();
    if (!c) return false;
    const entityId = assertValidEntityId(entityIdRaw);
    let result;
    if (typeof field === 'string' && field) {
      result = c
        .prepare('DELETE FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ? AND field = ?')
        .run(entityType, entityId, field);
    } else {
      result = c
        .prepare('DELETE FROM cms_content_bindings WHERE entity_type = ? AND entity_id = ?')
        .run(entityType, entityId);
    }
    if (result.changes > 0) {
      const rows = this.findForEntity(entityType, entityId);
      logBindingRevision(entityType, entityId, 'delete', actorId || '', actorName || '', snapshotOf(rows));
      return true;
    }
    return false;
  },
};

// ============================================================================
// Catalog labels (admin list) — best-effort joins against live catalog state.
// A binding that outlives its catalog row (reseeds, renames) still resolves
// by raw id; it is shown as unresolved, never dropped.
// ============================================================================

export interface CatalogEntityRef {
  id: string;
  label: string;
  labelAr: string;
}

function safeList<T>(fn: () => T[]): T[] {
  try {
    return fn() || [];
  } catch {
    return [];
  }
}

export function listCatalogEntities(entityType: CatalogEntityType): CatalogEntityRef[] {
  switch (entityType) {
    case 'accommodation':
      return safeList(() => db.accommodations).map(a => ({ id: a.id, label: a.name, labelAr: a.nameAr || '' }));
    case 'rental':
      return safeList(() => db.rentalListings).map(l => ({ id: l.id, label: l.name, labelAr: l.nameAr || '' }));
    case 'activity':
      return safeList(() => db.activities).map(a => ({ id: a.id, label: a.titleEn, labelAr: a.titleAr || '' }));
    case 'place':
      return safeList(() => db.places).map(p => ({ id: p.id, label: p.nameEn, labelAr: p.nameAr || '' }));
    case 'area':
      return safeList(() => db.areaProfiles).map(a => ({ id: a.id, label: a.nameEn, labelAr: a.nameAr || '' }));
    case 'dining_venue':
      return safeList(() => db.diningVenues).map(v => ({ id: v.id, label: v.nameEn, labelAr: v.nameAr || '' }));
    case 'supplier':
      return safeList(() => db.suppliers).map(s => ({
        id: s.id,
        label: s.displayName || s.businessName,
        labelAr: s.businessNameAr || '',
      }));
    case 'sku':
      return safeList(() => db.productSkus).map(s => ({ id: s.id, label: s.title, labelAr: s.titleAr || '' }));
    case 'offer':
      return safeList(() => db.supplierOffers).map(o => ({ id: o.id, label: o.titleEn, labelAr: o.titleAr || '' }));
  }
}

export function describeCatalogEntity(entityType: CatalogEntityType, entityId: string): CatalogEntityRef | null {
  const found = listCatalogEntities(entityType).find(e => e.id === entityId);
  return found || null;
}

// ============================================================================
// Published resolution — merge published bindings over catalog views.
// Every apply* fn returns the input view UNCHANGED when there is no published
// overlay, so public responses are byte-identical until an editor publishes.
// ============================================================================

export interface MediaMeta {
  url: string;
  focalX: number;
  focalY: number;
  altEn: string;
  altAr: string;
  /** Responsive siblings, ascending by width (empty for URL assets/GIFs). */
  variants: { width: number; url: string }[];
  /** Ready-to-render srcset (`url 400w, …`), or '' when no variants exist. */
  srcset: string;
}

export interface PublishedOverlay {
  texts: Record<string, string>;
  /** Single-image fields resolve to a URL string; gallery fields to URL arrays. */
  mediaUrls: Record<string, string | string[]>;
  /** Same shape as mediaUrls, carrying focal point + alt text per asset. */
  meta: Record<string, MediaMeta | MediaMeta[]>;
  fields: string[];
  updatedAt: string;
}

function mediaMetaFor(mediaId: string): MediaMeta | null {
  if (!mediaId) return null;
  try {
    const row = cmsMedia.findById(mediaId);
    if (!row?.original_url) return null;
    // findById normalizes variants to an array; re-sort defensively since
    // srcset order determines nothing but readability.
    const variants = [...(row.variants || [])].sort((a, b) => a.width - b.width);
    return {
      url: row.original_url,
      focalX: row.focal_x ?? 50,
      focalY: row.focal_y ?? 50,
      altEn: row.alt_en || '',
      altAr: row.alt_ar || '',
      variants: variants.map(v => ({ width: v.width, url: v.url })),
      srcset: variants.map(v => `${v.url} ${v.width}w`).join(', '),
    };
  } catch {
    return null;
  }
}

function buildOverlay(rows: CmsBinding[]): PublishedOverlay | null {
  const published = rows.filter(r => r.status === 'published');
  if (published.length === 0) return null;
  const texts: Record<string, string> = {};
  const mediaUrls: Record<string, string | string[]> = {};
  const meta: Record<string, MediaMeta | MediaMeta[]> = {};
  let updatedAt = '';
  for (const r of published) {
    if (SINGLE_MEDIA_FIELDS.has(r.field)) {
      const m = mediaMetaFor(r.media_id);
      if (m) {
        mediaUrls[r.field] = m.url;
        meta[r.field] = m;
      }
    } else if (r.field === 'gallery_media_ids') {
      const metas = r.value_text
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(mediaMetaFor)
        .filter((m): m is MediaMeta => !!m);
      if (metas.length > 0) {
        mediaUrls[r.field] = metas.map(m => m.url);
        meta[r.field] = metas;
      }
    } else if (r.value_text) {
      texts[r.field] = r.value_text;
    }
    if (r.updated_at > updatedAt) updatedAt = r.updated_at;
  }
  if (Object.keys(texts).length === 0 && Object.keys(mediaUrls).length === 0) return null;
  return {
    texts,
    mediaUrls,
    meta,
    fields: published.map(r => r.field),
    updatedAt,
  };
}

export function getPublishedOverlay(entityType: CatalogEntityType, entityId: string): PublishedOverlay | null {
  const c = conn();
  if (!c) return null;
  return buildOverlay(catalogBindings.findForEntity(entityType, entityId));
}

export function getPublishedOverlays(
  entityType: CatalogEntityType,
  entityIds: string[]
): Record<string, PublishedOverlay> {
  const c = conn();
  if (!c || entityIds.length === 0) return {};
  const unique = [...new Set(entityIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const placeholders = unique.map(() => '?').join(',');
  const rows = c
    .prepare(
      `SELECT * FROM cms_content_bindings WHERE entity_type = ? AND entity_id IN (${placeholders}) AND status = 'published'`
    )
    .all(entityType, ...unique)
    .map(hydrate<CmsBinding>);
  const grouped = new Map<string, CmsBinding[]>();
  for (const r of rows) {
    const list = grouped.get(r.entity_id) || [];
    list.push(r);
    grouped.set(r.entity_id, list);
  }
  const out: Record<string, PublishedOverlay> = {};
  for (const [id, group] of grouped) {
    const overlay = buildOverlay(group);
    if (overlay) out[id] = overlay;
  }
  return out;
}

interface CmsProvenance {
  bound: string[];
  updatedAt: string;
}

// ============================================================================
// Media usage — where is one library asset referenced?
// ============================================================================

/**
 * Every live reference to one media asset: catalog bindings (by media_id, or
 * inside a gallery_media_ids list) plus CMS pages whose hero/OG image points
 * at the asset's public URL. Powers the "used in N places" badge and the
 * delete guard — deleting a referenced asset would blank live surfaces.
 */
export function findMediaReferences(mediaId: string): MediaReference[] {
  const c = conn();
  if (!c || !mediaId) return [];
  const asset = cmsMedia.findById(mediaId);
  if (!asset) return [];
  const refs: MediaReference[] = [];

  const bindingRows = c.prepare(`
    SELECT entity_type, entity_id, field, status FROM cms_content_bindings
    WHERE media_id = ?
       OR (field = 'gallery_media_ids'
           AND (',' || REPLACE(REPLACE(value_text, ' ', ''), CHAR(10), '') || ',') LIKE '%,' || ? || ',%')
  `).all(mediaId, mediaId) as { entity_type: string; entity_id: string; field: string; status: string }[];
  for (const b of bindingRows) {
    const type = b.entity_type as CatalogEntityType;
    const label = isCatalogEntityType(type)
      ? describeCatalogEntity(type, b.entity_id)?.label || b.entity_id
      : b.entity_id;
    refs.push({
      kind: 'binding',
      entityType: b.entity_type,
      entityId: b.entity_id,
      label,
      field: b.field,
      status: b.status,
    });
  }

  if (asset.original_url) {
    const pageRows = c.prepare(`
      SELECT id, slug, title_en, hero_image_url, og_image_url FROM cms_pages
      WHERE hero_image_url = ? OR og_image_url = ?
    `).all(asset.original_url, asset.original_url) as {
      id: string; slug: string; title_en: string; hero_image_url: string; og_image_url: string;
    }[];
    for (const p of pageRows) {
      refs.push({
        kind: 'page',
        entityId: p.id,
        label: p.title_en || p.slug,
        field: p.hero_image_url === asset.original_url ? 'hero_image_url' : 'og_image_url',
        status: undefined,
      });
    }
  }
  return refs;
}

/**
 * Batched usage map for the whole library: one pass over bindings + pages,
 * keyed by media id. The admin media list uses this instead of per-asset
 * queries (no N+1 on a large library).
 */
export function mediaUsageMap(): Record<string, MediaReference[]> {
  const c = conn();
  if (!c) return {};
  const map: Record<string, MediaReference[]> = {};
  const push = (mediaId: string, ref: MediaReference) => {
    if (!mediaId) return;
    (map[mediaId] ||= []).push(ref);
  };

  const bindingRows = c.prepare(`
    SELECT entity_type, entity_id, field, status, media_id, value_text
    FROM cms_content_bindings
    WHERE media_id != '' OR field = 'gallery_media_ids'
  `).all() as {
    entity_type: string; entity_id: string; field: string; status: string; media_id: string; value_text: string;
  }[];
  for (const b of bindingRows) {
    const type = b.entity_type as CatalogEntityType;
    const label = isCatalogEntityType(type)
      ? describeCatalogEntity(type, b.entity_id)?.label || b.entity_id
      : b.entity_id;
    const base: MediaReference = {
      kind: 'binding',
      entityType: b.entity_type,
      entityId: b.entity_id,
      label,
      field: b.field,
      status: b.status,
    };
    if (b.media_id) push(b.media_id, base);
    if (b.field === 'gallery_media_ids' && b.value_text) {
      for (const id of b.value_text.split(',').map(s => s.trim()).filter(Boolean)) push(id, base);
    }
  }

  const urlToId = new Map<string, string>();
  for (const m of cmsMedia.findAll()) {
    if (m.original_url) urlToId.set(m.original_url, m.id);
  }
  if (urlToId.size > 0) {
    const pageRows = c.prepare(`
      SELECT id, slug, title_en, hero_image_url, og_image_url FROM cms_pages
      WHERE hero_image_url LIKE '/api/media/%' OR og_image_url LIKE '/api/media/%'
    `).all() as { id: string; slug: string; title_en: string; hero_image_url: string; og_image_url: string }[];
    for (const p of pageRows) {
      const pairs = [[p.hero_image_url, 'hero_image_url'], [p.og_image_url, 'og_image_url']] as const;
      for (const [url, field] of pairs) {
        const id = url ? urlToId.get(url) : undefined;
        if (id) {
          push(id, { kind: 'page', entityId: p.id, label: p.title_en || p.slug, field, status: undefined });
        }
      }
    }
  }
  return map;
}

function stamp<T extends Record<string, any>>(view: T, overlay: PublishedOverlay): T & { _cms: CmsProvenance } {
  return { ...view, _cms: { bound: overlay.fields, updatedAt: overlay.updatedAt } };
}

function coverFields(o: PublishedOverlay): Record<string, string | string[] | { x: number; y: number }> {
  const out: Record<string, string | string[] | { x: number; y: number }> = {};
  const cover = o.mediaUrls['cover_media_id'];
  if (typeof cover === 'string') {
    out['coverImageUrl'] = cover;
    const m = o.meta['cover_media_id'] as MediaMeta | undefined;
    if (m) {
      out['coverImageFocal'] = { x: m.focalX, y: m.focalY };
      if (m.srcset) out['coverImageSrcSet'] = m.srcset;
    }
  }
  const gallery = o.mediaUrls['gallery_media_ids'];
  if (Array.isArray(gallery)) out['galleryImageUrls'] = gallery;
  return out;
}

function opt<T>(value: T | undefined, key: string, target: Record<string, any>): void {
  if (value !== undefined) target[key] = value;
}

/** Accommodation view (toAccommodationView output). Adds coverImageUrl/galleryImageUrls. */
export function applyAccommodationOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.title_en, 'name', next);
  opt(v.title_ar, 'nameAr', next);
  opt(v.tagline_en, 'tagline', next);
  opt(v.tagline_ar, 'taglineAr', next);
  opt(v.description_en, 'description', next);
  opt(v.description_ar, 'descriptionAr', next);
  if (v.amenities_en) next.amenities = splitListValue(v.amenities_en);
  if (v.amenities_ar) next.amenitiesAr = splitListValue(v.amenities_ar);
  opt(v.best_for_en, 'bestFor', next);
  opt(v.best_for_ar, 'bestForAr', next);
  opt(v.note_en, 'note', next);
  opt(v.note_ar, 'noteAr', next);
  Object.assign(next, coverFields(overlay));
  return stamp(next, overlay);
}

/** Rental listing view (rentalService.getListingView output). images[] stays intact. */
export function applyRentalOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.title_en, 'name', next);
  opt(v.title_ar, 'nameAr', next);
  opt(v.tagline_en, 'tagline', next);
  opt(v.tagline_ar, 'taglineAr', next);
  opt(v.description_en, 'description', next);
  opt(v.description_ar, 'descriptionAr', next);
  if (v.features_en) next.features = splitListValue(v.features_en);
  if (v.features_ar) next.featuresAr = splitListValue(v.features_ar);
  if (v.policies_en || v.policies_ar) {
    next.policies = {
      en: v.policies_en ?? view.policies?.en ?? '',
      ar: v.policies_ar ?? view.policies?.ar ?? '',
    };
  }
  Object.assign(next, coverFields(overlay));
  return stamp(next, overlay);
}

export function applyActivityOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.title_en, 'titleEn', next);
  opt(v.title_ar, 'titleAr', next);
  if (v.preparation_en) next.preparationTips = splitListValue(v.preparation_en);
  if (v.preparation_ar) next.preparationTipsAr = splitListValue(v.preparation_ar);
  Object.assign(next, coverFields(overlay));
  return stamp(next, overlay);
}

export function applyPlaceOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.name_en, 'nameEn', next);
  opt(v.name_ar, 'nameAr', next);
  opt(v.description_en, 'descriptionEn', next);
  opt(v.description_ar, 'descriptionAr', next);
  Object.assign(next, coverFields(overlay));
  return stamp(next, overlay);
}

export function applyAreaOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.name_en, 'nameEn', next);
  opt(v.name_ar, 'nameAr', next);
  opt(v.description_en, 'atmosphere', next);
  opt(v.description_ar, 'atmosphereAr', next);
  Object.assign(next, coverFields(overlay));
  return stamp(next, overlay);
}

export function applyDiningOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.name_en, 'nameEn', next);
  opt(v.name_ar, 'nameAr', next);
  Object.assign(next, coverFields(overlay));
  return stamp(next, overlay);
}

/** Nested supplier objects (accommodation/rental detail, commerce reads). */
export function applySupplierOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.display_name_en, 'displayName', next);
  if (v.display_name_ar && 'displayNameAr' in next) next.displayNameAr = v.display_name_ar;
  opt(v.business_name_en, 'businessName', next);
  opt(v.business_name_ar, 'businessNameAr', next);
  const logo = overlay.mediaUrls['logo_media_id'];
  if (typeof logo === 'string') next.logoUrl = logo;
  return stamp(next, overlay);
}

/** Nested SKU objects (accommodation/rental detail). */
export function applySkuOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.title_en, 'title', next);
  opt(v.title_ar, 'titleAr', next);
  if (v.description_en && 'description' in next) next.description = v.description_en;
  return stamp(next, overlay);
}

export function applyOfferOverlay(view: any, overlay: PublishedOverlay | null): any {
  if (!overlay || !view) return view;
  const next: Record<string, any> = { ...view };
  const v = overlay.texts;
  opt(v.title_en, 'titleEn', next);
  opt(v.title_ar, 'titleAr', next);
  if (v.includes_en) next.includes = splitListValue(v.includes_en);
  if (v.includes_ar) {
    // SupplierOfferEntity has no includesAr; expose the AR list additively.
    (next as any).includesAr = splitListValue(v.includes_ar);
  }
  if (v.excludes_en) next.excludes = splitListValue(v.excludes_en);
  if (v.excludes_ar) {
    (next as any).excludesAr = splitListValue(v.excludes_ar);
  }
  Object.assign(next, coverFields(overlay));
  return stamp(next, overlay);
}

/**
 * Batch overlay for rental listing views (getListingView output incl. nested
 * sku/supplier). One batched query per entity kind — no N+1 on list pages.
 */
export function applyRentalViewOverlays(views: any[]): any[] {
  if (!views || views.length === 0) return views;
  try {
    const rentalMap = getPublishedOverlays('rental', views.map(v => v?.id).filter(Boolean));
    const skuIds = views.map(v => v?.sku?.id).filter(Boolean) as string[];
    const supIds = views.map(v => v?.supplier?.id).filter(Boolean) as string[];
    const skuMap = getPublishedOverlays('sku', skuIds);
    const supMap = getPublishedOverlays('supplier', supIds);
    return views.map(v => {
      let next = applyRentalOverlay(v, rentalMap[v?.id] ?? null);
      if (next?.sku && skuMap[next.sku.id]) next = { ...next, sku: applySkuOverlay(next.sku, skuMap[next.sku.id]) };
      if (next?.supplier && supMap[next.supplier.id]) {
        next = { ...next, supplier: applySupplierOverlay(next.supplier, supMap[next.supplier.id]) };
      }
      return next;
    });
  } catch {
    return views;
  }
}

/**
 * Batch overlay for accommodation views (toAccommodationView output). Nested
 * sku/supplier are overlaid when the caller passes them alongside.
 */
export function applyAccommodationViewOverlays(views: any[]): any[] {
  if (!views || views.length === 0) return views;
  try {
    const map = getPublishedOverlays('accommodation', views.map(v => v?.id).filter(Boolean));
    return views.map(v => applyAccommodationOverlay(v, map[v?.id] ?? null));
  } catch {
    return views;
  }
}

/** Attraction directory cards (`place-<id>` / `act-<id>` / `sup-<id>` ids). */
export function applyAttractionOverlays(items: any[]): any[] {
  if (!items || items.length === 0) return items;
  try {
    const placeIds: string[] = [];
    const actIds: string[] = [];
    const supIds: string[] = [];
    const areaIds: string[] = [];
    for (const item of items) {
      const id = String(item?.id || '');
      if (id.startsWith('place-')) placeIds.push(id.slice(6));
      else if (id.startsWith('act-')) actIds.push(id.slice(4));
      else if (id.startsWith('sup-')) supIds.push(id.slice(4));
      if (item?.areaId) areaIds.push(String(item.areaId));
    }
    const placeMap = getPublishedOverlays('place', placeIds);
    const actMap = getPublishedOverlays('activity', actIds);
    const supMap = getPublishedOverlays('supplier', supIds);
    const areaMap = getPublishedOverlays('area', areaIds);
    return items.map(item => {
      const id = String(item?.id || '');
      let overlay: PublishedOverlay | null = null;
      let kind: 'place' | 'activity' | 'supplier' | null = null;
      if (id.startsWith('place-')) { overlay = placeMap[id.slice(6)] ?? null; kind = 'place'; }
      else if (id.startsWith('act-')) { overlay = actMap[id.slice(4)] ?? null; kind = 'activity'; }
      else if (id.startsWith('sup-')) { overlay = supMap[id.slice(4)] ?? null; kind = 'supplier'; }
      const areaOverlay = item?.areaId ? areaMap[String(item.areaId)] ?? null : null;
      if (!overlay && !areaOverlay) return item;
      const next: Record<string, any> = { ...item };
      if (overlay) {
        const v = overlay.texts;
        if (kind === 'place') {
          opt(v.name_en, 'nameEn', next);
          opt(v.name_ar, 'nameAr', next);
          opt(v.description_en, 'descriptionEn', next);
          opt(v.description_ar, 'descriptionAr', next);
        } else if (kind === 'activity') {
          opt(v.title_en, 'nameEn', next);
          opt(v.title_ar, 'nameAr', next);
        } else if (kind === 'supplier') {
          const display = v.display_name_en ?? v.business_name_en;
          if (display) next.nameEn = display;
          const displayAr = v.display_name_ar ?? v.business_name_ar;
          if (displayAr) next.nameAr = displayAr;
        }
        const cover = overlay.mediaUrls['cover_media_id'];
        if (typeof cover === 'string') next.image = cover;
        const logo = overlay.mediaUrls['logo_media_id'];
        if (typeof logo === 'string') next.image = logo;
      }
      if (areaOverlay) {
        opt(areaOverlay.texts.name_en, 'areaLabelEn', next);
        opt(areaOverlay.texts.name_ar, 'areaLabelAr', next);
      }
      const fields = [...(overlay?.fields || []), ...(areaOverlay?.fields.map(f => `area:${f}`) || [])];
      return { ...next, _cms: { bound: fields, updatedAt: overlay?.updatedAt || areaOverlay?.updatedAt || '' } };
    });
  } catch {
    return items;
  }
}
