import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from '../db/sqlite/SqlitePersistenceAdapter';
import { db } from '../db/database';
import { cmsPages } from './contentService';

// ============================================================================
// Site Info — contact / social / hours slots rendered in the site footer.
// ============================================================================
//
// The legacy site_settings document (contact, social, footer, hours, SEO,
// hero, gallery) was write-only: two admin panels edited it and nothing on
// the public site ever read it. Its live-meaningful groups move here:
// footer links already live in CMS navigation, tagline/copyright in UI
// strings, hero/gallery in CMS content — contact, social and hours had no
// live home, so they get this closed key set rendered by DahabFooter.
//
// Values go LIVE immediately on save (no draft state), so writes are
// Operations/Admin-only, enforced per-endpoint in the router. Every write
// logs a restorable revision (entity_type 'site_info').

export const SITE_INFO_KEYS = {
  contact: ['contact.phone', 'contact.email', 'contact.whatsapp', 'contact.address'] as const,
  social: ['social.instagram', 'social.facebook', 'social.tiktok', 'social.youtube', 'social.website'] as const,
  hours: ['hours.timezone', 'hours.weekday', 'hours.weekend', 'hours.holidays'] as const,
} as const;

export type SiteInfoGroup = keyof typeof SITE_INFO_KEYS;
export type SiteInfoKey = (typeof SITE_INFO_KEYS)[SiteInfoGroup][number];

const ALL_KEYS = new Set<string>([
  ...SITE_INFO_KEYS.contact,
  ...SITE_INFO_KEYS.social,
  ...SITE_INFO_KEYS.hours,
]);

export const SITE_INFO_GROUPS = Object.keys(SITE_INFO_KEYS) as SiteInfoGroup[];

export function isSiteInfoKey(value: unknown): value is SiteInfoKey {
  return typeof value === 'string' && ALL_KEYS.has(value);
}

export const MAX_SITE_INFO_LENGTH = 500;

export interface SiteInfoValue {
  value: string;
  valueAr: string;
  updatedAt: string;
}

export type SiteInfoBundle = Record<SiteInfoGroup, Record<string, SiteInfoValue>>;

function conn(): SqliteDb | null {
  const adapter = db.getAdapter();
  return adapter instanceof SqlitePersistenceAdapter ? adapter.connection : null;
}

function now(): string {
  return new Date().toISOString();
}

function emptyBundle(): SiteInfoBundle {
  const out = {} as SiteInfoBundle;
  for (const group of SITE_INFO_GROUPS) {
    out[group] = {};
    for (const key of SITE_INFO_KEYS[group]) {
      out[group][key] = { value: '', valueAr: '', updatedAt: '' };
    }
  }
  return out;
}

function logInfoRevision(key: string, action: string, actorId: string, actorName: string, value: string, valueAr: string): void {
  const c = conn();
  if (!c) return;
  const id = `REV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  c.prepare(`
    INSERT INTO cms_revisions (id, entity_type, entity_id, action, actor_id, actor_name, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'site_info', key, action, actorId || '', actorName || '', JSON.stringify({ value, value_ar: valueAr }), now());
}

export const siteInfo = {
  /** Full bundle with every known key (empty defaults) — stable dashboard form. */
  getAll(): SiteInfoBundle {
    const bundle = emptyBundle();
    const c = conn();
    if (!c) return bundle;
    const rows = c.prepare('SELECT * FROM cms_site_info').all() as {
      key: string; value: string; value_ar: string; updated_at: string;
    }[];
    for (const r of rows) {
      const dot = r.key.indexOf('.');
      const group = (dot > 0 ? r.key.slice(0, dot) : '') as SiteInfoGroup;
      if (!SITE_INFO_GROUPS.includes(group) || !bundle[group][r.key]) continue;
      bundle[group][r.key] = { value: r.value || '', valueAr: r.value_ar || '', updatedAt: r.updated_at || '' };
    }
    return bundle;
  },

  /**
   * Save (and immediately publish) one slot. Empty value + valueAr deletes
   * the row so the footer hides that slot again.
   */
  upsert(
    keyRaw: unknown,
    values: { value?: unknown; value_ar?: unknown },
    actorId?: string,
    actorName?: string
  ): SiteInfoValue {
    const c = conn();
    if (!c) throw new Error('CMS database unavailable');
    if (!isSiteInfoKey(keyRaw)) {
      throw new Error(`Unknown site-info key. Editable keys: ${[...ALL_KEYS].join(', ')}.`);
    }
    const key = keyRaw;
    const value = values.value === undefined ? undefined : assertInfoValue(values.value, 'value');
    const valueAr = values.value_ar === undefined ? undefined : assertInfoValue(values.value_ar, 'value_ar');
    if (value === undefined && valueAr === undefined) {
      throw new Error('Provide at least one of "value" / "value_ar".');
    }
    const existing = c.prepare('SELECT * FROM cms_site_info WHERE key = ?').get(key) as {
      value: string; value_ar: string;
    } | undefined;
    const nextValue = value ?? existing?.value ?? '';
    const nextAr = valueAr ?? existing?.value_ar ?? '';
    const ts = now();
    if (!nextValue && !nextAr) {
      c.prepare('DELETE FROM cms_site_info WHERE key = ?').run(key);
      logInfoRevision(key, 'clear', actorId || '', actorName || '', '', '');
      return { value: '', valueAr: '', updatedAt: ts };
    }
    if (existing) {
      c.prepare('UPDATE cms_site_info SET value = ?, value_ar = ?, updated_at = ? WHERE key = ?')
        .run(nextValue, nextAr, ts, key);
      logInfoRevision(key, 'update', actorId || '', actorName || '', nextValue, nextAr);
    } else {
      c.prepare('INSERT INTO cms_site_info (key, value, value_ar, updated_at) VALUES (?, ?, ?, ?)')
        .run(key, nextValue, nextAr, ts);
      logInfoRevision(key, 'create', actorId || '', actorName || '', nextValue, nextAr);
    }
    return { value: nextValue, valueAr: nextAr, updatedAt: ts };
  },
};

function assertInfoValue(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`"${field}" must be a string.`);
  }
  if (value.length > MAX_SITE_INFO_LENGTH) {
    throw new Error(`"${field}" must be at most ${MAX_SITE_INFO_LENGTH} characters.`);
  }
  return value.trim();
}

// ============================================================================
// One-way legacy import — runs once at boot.
// ============================================================================

/** Placeholder defaults the legacy panel created; never publish these. */
const LEGACY_DEFAULTS: Record<string, string> = {
  'contact.phone': '+20 100 000 0000',
  'contact.email': 'hello@dahab.com',
  'contact.whatsapp': '+20 100 000 0000',
  'contact.address': 'Dahab, South Sinai, Egypt',
  'contact.addressAr': 'دهب، جنوب سيناء، مصر',
  'social.instagram': 'https://instagram.com/dahab',
  'social.facebook': 'https://facebook.com/dahab',
  'social.tiktok': '',
  'social.youtube': '',
  'social.website': 'https://dahab.com',
  'hours.timezone': 'Africa/Cairo',
  'hours.weekday': '9:00 AM – 6:00 PM',
  'hours.weekend': '10:00 AM – 4:00 PM',
  'hours.holidays': 'Closed on national holidays',
  'hero.imageUrl': '/images/hero/blue-hole-signature.jpg',
  'hero.headlineEn': 'Discover Dahab',
  'hero.headlineAr': 'اكتشف دهب',
};

export interface LegacyImportResult {
  ran: boolean;
  importedKeys: string[];
  galleryMigrated: number;
  /** A customized legacy hero has no safe automatic mapping (CTA semantics
   *  differ from the CMS hero section), so it is reported, not migrated. */
  heroCustomizedUnmigrated: boolean;
}

/**
 * Import a legacy site_settings document into live CMS surfaces. Only values
 * that differ from the legacy placeholder defaults are imported, and CMS rows
 * always win over legacy (never overwrite an existing key). Gallery photos
 * become published CMS gallery pages; a customized hero is reported for a
 * human to hand-carry into the Homepage hero section.
 */
export function importLegacySiteSettings(): LegacyImportResult {
  const idle: LegacyImportResult = { ran: false, importedKeys: [], galleryMigrated: 0, heroCustomizedUnmigrated: false };
  try {
    if (!(db.getAdapter() instanceof SqlitePersistenceAdapter)) return idle;
    const c = conn();
    if (!c) return idle;
    const legacy = (db.siteSettings as any[]).find(s => s?.id === 'default');
    if (!legacy) return idle;

    const result: LegacyImportResult = { ran: true, importedKeys: [], galleryMigrated: 0, heroCustomizedUnmigrated: false };
    const take = (obj: any, field: string): string =>
      obj && typeof obj[field] === 'string' ? obj[field].trim() : '';

    const pairs: [SiteInfoKey, string, string][] = [
      ['contact.phone', take(legacy.contact, 'phone'), ''],
      ['contact.email', take(legacy.contact, 'email'), ''],
      ['contact.whatsapp', take(legacy.contact, 'whatsapp'), ''],
      ['contact.address', take(legacy.contact, 'address'), take(legacy.contact, 'addressAr')],
      ['social.instagram', take(legacy.social, 'instagram'), ''],
      ['social.facebook', take(legacy.social, 'facebook'), ''],
      ['social.tiktok', take(legacy.social, 'tiktok'), ''],
      ['social.youtube', take(legacy.social, 'youtube'), ''],
      ['social.website', take(legacy.social, 'website'), ''],
      ['hours.timezone', take(legacy.hours, 'timezone'), ''],
      ['hours.weekday', take(legacy.hours, 'weekday'), ''],
      ['hours.weekend', take(legacy.hours, 'weekend'), ''],
      ['hours.holidays', take(legacy.hours, 'holidays'), ''],
    ];
    // Only contact.address ever had an AR side in the legacy document; every
    // other key's AR default is empty.
    const defaultFor = (key: string, ar: boolean): string => {
      if (key === 'contact.address') return ar ? LEGACY_DEFAULTS['contact.addressAr'] : LEGACY_DEFAULTS['contact.address'];
      return ar ? '' : (LEGACY_DEFAULTS[key] ?? '');
    };

    for (const [key, value, valueAr] of pairs) {
      if (!value && !valueAr) continue;
      if (value === defaultFor(key, false) && valueAr === defaultFor(key, true)) continue;
      const existing = c.prepare('SELECT key FROM cms_site_info WHERE key = ?').get(key);
      if (existing) continue;
      try {
        siteInfo.upsert(key, { value, value_ar: valueAr }, 'system', 'Legacy import');
        result.importedKeys.push(key);
      } catch {
        // Validation failure on one key must not abort the rest.
      }
    }

    if (Array.isArray(legacy.gallery) && legacy.gallery.length > 0) {
      let order = 0;
      for (const photo of legacy.gallery) {
        const url = photo && typeof photo.url === 'string' ? photo.url.trim() : '';
        if (!url) continue;
        const dupe = c.prepare(
          "SELECT id FROM cms_pages WHERE type = 'gallery' AND hero_image_url = ?"
        ).get(url);
        if (dupe) continue;
        try {
          const page = cmsPages.create({
            slug: `site-gallery-${Date.now().toString(36)}-${order}`,
            type: 'gallery',
            title_en: (photo.altEn || photo.captionEn || 'Gallery photo').slice(0, 200),
            title_ar: (photo.altAr || photo.captionAr || '').slice(0, 200),
            description_en: (photo.captionEn || '').slice(0, 2000),
            description_ar: (photo.captionAr || '').slice(0, 2000),
            hero_image_url: url,
            status: 'published',
            sort_order: typeof photo.displayOrder === 'number' ? photo.displayOrder : order,
            featured: photo.featured ? 1 : 0,
          }, 'system', 'Legacy import');
          cmsPages.publish(page.id, 'system', 'Legacy import');
          result.galleryMigrated += 1;
          order += 1;
        } catch {
          // One bad photo must not abort the rest.
        }
      }
    }

    const hero = legacy.hero || {};
    const heroCustomized = ['imageUrl', 'headlineEn', 'headlineAr'].some(
      f => take(hero, f) && take(hero, f) !== (LEGACY_DEFAULTS[`hero.${f}`] ?? '')
    );
    if (heroCustomized) {
      result.heroCustomizedUnmigrated = true;
      console.warn(
        '[CMS] Legacy hero content was customized but has no safe automatic mapping ' +
        '(CTA semantics differ from the CMS hero section). Hand-carry it into the Homepage hero section, then clear site_settings.'
      );
    }
    if (result.importedKeys.length > 0 || result.galleryMigrated > 0) {
      console.log(
        `[CMS] Legacy site-settings import: ${result.importedKeys.length} info keys, ` +
        `${result.galleryMigrated} gallery photos`
      );
    }
    return result;
  } catch (err: any) {
    console.warn('[CMS] Legacy site-settings import skipped:', err?.message || err);
    return idle;
  }
}
