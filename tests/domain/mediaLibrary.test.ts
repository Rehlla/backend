import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema, migrateCmsMediaColumns } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-media-lib-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MEDIA_MAX_UPLOAD_MB;
});

// Services read the adapter lazily per call, like contentService.
import {
  maxMediaUploadBytes,
  maxMediaUploadMb,
  validateImageUpload,
  DEFAULT_MAX_MEDIA_UPLOAD_BYTES,
} from '../../server/services/mediaUpload';
import { cmsMedia, cmsPages, clampFocalAxis } from '../../server/services/contentService';
import {
  catalogBindings,
  getPublishedOverlay,
  applyAccommodationOverlay,
  findMediaReferences,
  mediaUsageMap,
} from '../../server/services/catalogContentService';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function pngDataUrl(bytes: Buffer): string {
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

describe('Media library v2', () => {
  describe('upload cap', () => {
    it('defaults to 5MB', () => {
      expect(DEFAULT_MAX_MEDIA_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
      expect(maxMediaUploadBytes()).toBe(5 * 1024 * 1024);
      expect(maxMediaUploadMb()).toBe(5);
    });

    it('honors MEDIA_MAX_UPLOAD_MB within 1–50MB', () => {
      process.env.MEDIA_MAX_UPLOAD_MB = '10';
      expect(maxMediaUploadBytes()).toBe(10 * 1024 * 1024);
      process.env.MEDIA_MAX_UPLOAD_MB = '0';
      expect(maxMediaUploadBytes()).toBe(DEFAULT_MAX_MEDIA_UPLOAD_BYTES);
      process.env.MEDIA_MAX_UPLOAD_MB = '100';
      expect(maxMediaUploadBytes()).toBe(DEFAULT_MAX_MEDIA_UPLOAD_BYTES);
      process.env.MEDIA_MAX_UPLOAD_MB = 'abc';
      expect(maxMediaUploadBytes()).toBe(DEFAULT_MAX_MEDIA_UPLOAD_BYTES);
    });

    it('rejects files over the raised cap and still honors explicit caps', () => {
      const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
      expect(() => validateImageUpload(pngDataUrl(big))).toThrow(/too large/i);
      const small = Buffer.concat([PNG, Buffer.alloc(10)]);
      expect(() => validateImageUpload(pngDataUrl(small), 5)).toThrow(/too large/i);
      expect(validateImageUpload(pngDataUrl(small)).mimeType).toBe('image/png');
    });
  });

  describe('focal point', () => {
    it('clamps axes to 0–100 with center fallback', () => {
      expect(clampFocalAxis(30)).toBe(30);
      expect(clampFocalAxis(200)).toBe(100);
      expect(clampFocalAxis(-5)).toBe(0);
      expect(clampFocalAxis(25.6)).toBe(26);
      expect(clampFocalAxis(NaN)).toBe(50);
      expect(clampFocalAxis(undefined)).toBe(50);
      expect(clampFocalAxis('oops')).toBe(50);
    });

    it('defaults new assets to center and clamps edits', () => {
      const created = cmsMedia.create({ filename: 'a.jpg' });
      expect(created.focal_x).toBe(50);
      expect(created.focal_y).toBe(50);
      const updated = cmsMedia.update(created.id, { focal_x: 150, focal_y: -20 })!;
      expect(updated.focal_x).toBe(100);
      expect(updated.focal_y).toBe(0);
    });

    it('backfills focal columns onto pre-migration tables', () => {
      const c = (adapter as any).connection;
      c.exec('ALTER TABLE cms_media DROP COLUMN focal_x');
      c.exec('ALTER TABLE cms_media DROP COLUMN focal_y');
      c.exec('ALTER TABLE cms_media DROP COLUMN variants');
      const before = c.prepare('PRAGMA table_info(cms_media)').all() as { name: string }[];
      expect(before.map(col => col.name)).not.toContain('focal_x');
      expect(before.map(col => col.name)).not.toContain('variants');
      // Re-running boot on the legacy table must add them (IF NOT EXISTS
      // alone would silently leave the table without the columns).
      initializeCmsSchema();
      const after = c.prepare('PRAGMA table_info(cms_media)').all() as { name: string }[];
      expect(after.map(col => col.name)).toContain('focal_x');
      expect(after.map(col => col.name)).toContain('focal_y');
      expect(after.map(col => col.name)).toContain('variants');
      // And rows written by the legacy INSERT shape (no focal) read back 50/50.
      const legacy = cmsMedia.create({ filename: 'legacy.jpg' });
      expect(legacy.focal_x).toBe(50);
      expect(legacy.focal_y).toBe(50);
      expect(legacy.variants).toEqual([]);
    });

    it('migrateCmsMediaColumns is a safe no-op on current tables', () => {
      expect(() => migrateCmsMediaColumns()).not.toThrow();
      const c = (adapter as any).connection;
      const cols = c.prepare('PRAGMA table_info(cms_media)').all() as { name: string }[];
      expect(cols.filter(col => col.name === 'focal_x')).toHaveLength(1);
    });
  });

  describe('usage references', () => {
    it('finds binding references by media_id and inside galleries', () => {
      const a = cmsMedia.create({ filename: 'a.jpg', original_url: '/api/media/a.jpg' });
      const b = cmsMedia.create({ filename: 'b.jpg', original_url: '/api/media/b.jpg' });
      catalogBindings.upsert('place', 'P-1', { name_en: 'X', cover_media_id: a.id });
      catalogBindings.upsert('rental', 'R-1', { gallery_media_ids: `${a.id}, ${b.id}` });
      const refsA = findMediaReferences(a.id);
      expect(refsA.map(r => `${r.entityType}:${r.entityId}:${r.field}`).sort()).toEqual([
        'place:P-1:cover_media_id',
        'rental:R-1:gallery_media_ids',
      ]);
      const refsB = findMediaReferences(b.id);
      expect(refsB).toHaveLength(1);
      expect(refsB[0].field).toBe('gallery_media_ids');
    });

    it('finds page hero/OG references by public URL', () => {
      const a = cmsMedia.create({ filename: 'hero.jpg', original_url: '/api/media/hero.jpg' });
      cmsPages.create({ slug: 'hero-page', title_en: 'Hero', hero_image_url: '/api/media/hero.jpg' });
      cmsPages.create({ slug: 'plain-page', title_en: 'Plain' });
      const refs = findMediaReferences(a.id);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toMatchObject({ kind: 'page', field: 'hero_image_url', label: 'Hero' });
    });

    it('returns nothing for unknown ids and unreferenced assets', () => {
      expect(findMediaReferences('MED-NOPE')).toEqual([]);
      const lone = cmsMedia.create({ filename: 'lone.jpg' });
      expect(findMediaReferences(lone.id)).toEqual([]);
    });

    it('builds a batched usage map for the whole library', () => {
      const a = cmsMedia.create({ filename: 'a.jpg', original_url: '/api/media/a.jpg' });
      const b = cmsMedia.create({ filename: 'b.jpg', original_url: '/api/media/b.jpg' });
      catalogBindings.upsert('place', 'P-1', { cover_media_id: a.id });
      catalogBindings.upsert('place', 'P-2', { cover_media_id: a.id });
      cmsPages.create({ slug: 'p', title_en: 'P', og_image_url: '/api/media/b.jpg' });
      const map = mediaUsageMap();
      expect(map[a.id]).toHaveLength(2);
      expect(map[b.id]).toHaveLength(1);
      expect(map[b.id][0]).toMatchObject({ kind: 'page', field: 'og_image_url' });
      expect(map['MED-NOPE']).toBeUndefined();
    });
  });

  describe('overlay media meta', () => {
    it('carries focal + alt per asset and drops dead ids', () => {
      const a = cmsMedia.create({
        filename: 'c.jpg', original_url: '/api/media/c.jpg', alt_en: 'Cover', alt_ar: 'غلاف',
      });
      cmsMedia.update(a.id, { focal_x: 20, focal_y: 80 });
      catalogBindings.upsert('accommodation', 'ACC-1', { title_en: 'Lodge', cover_media_id: a.id });
      catalogBindings.setStatus('accommodation', 'ACC-1', 'published');
      const overlay = getPublishedOverlay('accommodation', 'ACC-1')!;
      expect(overlay.mediaUrls.cover_media_id).toBe('/api/media/c.jpg');
      expect(overlay.meta.cover_media_id).toEqual({
        url: '/api/media/c.jpg', focalX: 20, focalY: 80, altEn: 'Cover', altAr: 'غلاف',
        // Media meta now carries responsive-sibling fields by design; a
        // URL-only asset simply has none.
        variants: [], srcset: '',
      });
      const view = applyAccommodationOverlay({ id: 'ACC-1', name: 'Old' }, overlay);
      expect(view.coverImageUrl).toBe('/api/media/c.jpg');
      expect(view.coverImageFocal).toEqual({ x: 20, y: 80 });
      expect(view.coverImageSrcSet).toBeUndefined();
    });

    it('exposes variant srcset on covers that have responsive siblings', () => {
      const a = cmsMedia.create({
        filename: 'big.jpg',
        original_url: '/api/media/big.jpg',
        variants: [
          { width: 400, url: '/api/media/big-w400.jpg', bytes: 12000 },
          { width: 800, url: '/api/media/big-w800.jpg', bytes: 40000 },
        ],
      });
      expect(cmsMedia.findById(a.id)!.variants).toHaveLength(2);
      catalogBindings.upsert('accommodation', 'ACC-2', { cover_media_id: a.id });
      catalogBindings.setStatus('accommodation', 'ACC-2', 'published');
      const overlay = getPublishedOverlay('accommodation', 'ACC-2')!;
      const meta = overlay.meta.cover_media_id as { srcset: string };
      expect(meta.srcset).toBe('/api/media/big-w400.jpg 400w, /api/media/big-w800.jpg 800w');
      const view = applyAccommodationOverlay({ id: 'ACC-2', name: 'Old' }, overlay);
      expect(view.coverImageSrcSet).toBe('/api/media/big-w400.jpg 400w, /api/media/big-w800.jpg 800w');
    });

    it('round-trips variants through create/find/update and drops garbage', () => {
      const a = cmsMedia.create({
        filename: 'v.jpg',
        original_url: '/api/media/v.jpg',
        variants: [
          { width: 400, url: '/api/media/v-w400.jpg', bytes: 1000 },
          { width: -5, url: '', bytes: 0 },
          'junk',
        ] as any,
      });
      expect(cmsMedia.findById(a.id)!.variants).toEqual([
        { width: 400, url: '/api/media/v-w400.jpg', bytes: 1000 },
      ]);
      const updated = cmsMedia.update(a.id, { variants: [] })!;
      expect(updated.variants).toEqual([]);
    });
  });
});
