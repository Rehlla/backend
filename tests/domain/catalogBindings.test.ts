import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-catalog-bindings-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

// The service reads the adapter lazily per call, like contentService.
import {
  catalogBindings,
  getPublishedOverlay,
  getPublishedOverlays,
  applyAccommodationOverlay,
  applyRentalOverlay,
  applyAttractionOverlays,
  splitListValue,
  CATALOG_ENTITY_TYPES,
  CATALOG_FIELD_REGISTRY,
} from '../../server/services/catalogContentService';
import { cmsMedia, cmsRevisions } from '../../server/services/contentService';

describe('Catalog Content Bindings', () => {
  describe('field registry', () => {
    it('covers every catalog entity family', () => {
      for (const t of ['accommodation', 'rental', 'activity', 'place', 'area', 'dining_venue', 'supplier', 'sku', 'offer']) {
        expect(CATALOG_ENTITY_TYPES).toContain(t);
        expect(CATALOG_FIELD_REGISTRY[t as keyof typeof CATALOG_FIELD_REGISTRY].textFields.length).toBeGreaterThan(0);
      }
    });

    it('never exposes operational fields (price, capacity, status, availability)', () => {
      const forbidden = ['basePriceEGP', 'price', 'priceEGP', 'status', 'active', 'capacity', 'quantity', 'availability'];
      for (const type of CATALOG_ENTITY_TYPES) {
        const spec = CATALOG_FIELD_REGISTRY[type];
        const all = [...spec.textFields, ...spec.mediaFields];
        for (const f of forbidden) {
          expect(all, `${type} must not expose ${f}`).not.toContain(f);
        }
      }
    });
  });

  describe('upsert validation', () => {
    it('creates draft bindings', () => {
      const rows = catalogBindings.upsert('accommodation', 'ACC-1', { title_en: 'Sea View Lodge' }, 'u1', 'Ops');
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('draft');
      expect(rows[0].value_text).toBe('Sea View Lodge');
      expect(rows[0].version).toBe(1);
    });

    it('rejects fields outside the registry', () => {
      expect(() => catalogBindings.upsert('accommodation', 'ACC-1', { basePriceEGP: '999' } as any)).toThrow(/not a CMS-editable field/);
      expect(() => catalogBindings.upsert('rental', 'RENT-1', { dailyRateEGP: '50' } as any)).toThrow(/not a CMS-editable field/);
      expect(() => catalogBindings.upsert('sku', 'SKU-1', { basePriceEGP: '10' } as any)).toThrow(/not a CMS-editable field/);
    });

    it('rejects non-string values and empty maps', () => {
      expect(() => catalogBindings.upsert('place', 'P-1', { name_en: 42 } as any)).toThrow(/must be a string/);
      expect(() => catalogBindings.upsert('place', 'P-1', {})).toThrow(/at least one/);
      expect(() => catalogBindings.upsert('place', 'P-1', 'nope' as any)).toThrow(/must be an object/);
    });

    it('rejects blank entity ids', () => {
      expect(() => catalogBindings.upsert('place', '  ', { name_en: 'X' })).toThrow(/entityId/);
    });

    it('deletes the row when a value is cleared (restores catalog truth)', () => {
      catalogBindings.upsert('place', 'P-1', { name_en: 'Old Name' });
      expect(catalogBindings.findForEntity('place', 'P-1').length).toBe(1);
      const rows = catalogBindings.upsert('place', 'P-1', { name_en: '   ' });
      expect(rows.length).toBe(0);
      expect(catalogBindings.findForEntity('place', 'P-1').length).toBe(0);
    });

    it('keeps published status on edit (editing never unpublishes silently)', () => {
      catalogBindings.upsert('place', 'P-1', { name_en: 'First' });
      catalogBindings.setStatus('place', 'P-1', 'published');
      const rows = catalogBindings.upsert('place', 'P-1', { name_en: 'Second' });
      expect(rows[0].status).toBe('published');
      expect(rows[0].value_text).toBe('Second');
      expect(rows[0].version).toBe(3);
    });

    it('rejects unknown media ids and enforces the gallery cap', () => {
      expect(() => catalogBindings.upsert('place', 'P-1', { cover_media_id: 'MED-NOPE' })).toThrow(/does not exist/);
      const ids = Array.from({ length: 13 }, (_, i) => `MED-X${i}`).join(', ');
      const media = cmsMedia.create({ filename: 'ok.jpg' });
      expect(() => catalogBindings.upsert('place', 'P-1', { gallery_media_ids: ids })).toThrow();
      expect(media.id).toMatch(/^MED-/);
    });

    it('accepts real media assets for cover and gallery', () => {
      const a = cmsMedia.create({ filename: 'a.jpg', original_url: '/api/media/a.jpg' });
      const b = cmsMedia.create({ filename: 'b.jpg', original_url: '/api/media/b.jpg' });
      const rows = catalogBindings.upsert('rental', 'RENT-1', {
        cover_media_id: a.id,
        gallery_media_ids: `${a.id}, ${b.id}`,
      });
      expect(rows.length).toBe(2);
      const cover = rows.find(r => r.field === 'cover_media_id')!;
      expect(cover.media_id).toBe(a.id);
      expect(cover.value_text).toBe('');
    });
  });

  describe('publish workflow', () => {
    it('publishes, unpublishes and archives an item', () => {
      catalogBindings.upsert('activity', 'ACT-1', { title_en: 'Reef Dive' });
      const pub = catalogBindings.setStatus('activity', 'ACT-1', 'published');
      expect(pub![0].status).toBe('published');
      expect(pub![0].published_at).toBeTruthy();
      const draft = catalogBindings.setStatus('activity', 'ACT-1', 'draft');
      expect(draft![0].status).toBe('draft');
      const arch = catalogBindings.setStatus('activity', 'ACT-1', 'archived');
      expect(arch![0].status).toBe('archived');
    });

    it('returns null when there is nothing to transition', () => {
      expect(catalogBindings.setStatus('activity', 'MISSING', 'published')).toBeNull();
      expect(catalogBindings.schedule('activity', 'MISSING', new Date().toISOString())).toBeNull();
      expect(catalogBindings.remove('activity', 'MISSING', undefined)).toBe(false);
    });

    it('rejects invalid statuses and schedule payloads', () => {
      catalogBindings.upsert('activity', 'ACT-1', { title_en: 'X' });
      expect(() => catalogBindings.setStatus('activity', 'ACT-1', 'live' as any)).toThrow(/draft, published, archived/);
      expect(() => catalogBindings.schedule('activity', 'ACT-1', 'not-a-date')).toThrow(/scheduledAt/);
    });

    it('publishes due schedules and skips future ones', () => {
      catalogBindings.upsert('place', 'P-PAST', { name_en: 'Past' });
      catalogBindings.upsert('place', 'P-FUTURE', { name_en: 'Future' });
      catalogBindings.schedule('place', 'P-PAST', new Date(Date.now() - 1000).toISOString());
      catalogBindings.schedule('place', 'P-FUTURE', new Date(Date.now() + 86400000).toISOString());
      const done = catalogBindings.checkScheduled();
      expect(done.map(d => d.entityId)).toContain('P-PAST');
      expect(done.map(d => d.entityId)).not.toContain('P-FUTURE');
      expect(catalogBindings.findForEntity('place', 'P-PAST')[0].status).toBe('published');
      expect(catalogBindings.findForEntity('place', 'P-FUTURE')[0].status).toBe('draft');
    });
  });

  describe('rollback', () => {
    it('restores the exact snapshot of a previous revision', () => {
      catalogBindings.upsert('dining_venue', 'D-1', { name_en: 'Original' }, 'u1', 'Ops');
      const createRev = cmsRevisions.findAll('binding:dining_venue', 'D-1').find(r => r.action === 'upsert')!;
      expect(createRev).toBeDefined();
      catalogBindings.upsert('dining_venue', 'D-1', { name_en: 'Changed', name_ar: 'تغير' });
      const rolled = catalogBindings.rollback('dining_venue', 'D-1', createRev.id, 'u1', 'Ops')!;
      const byField = new Map(rolled.map(r => [r.field, r.value_text]));
      expect(byField.get('name_en')).toBe('Original');
      expect(byField.has('name_ar')).toBe(false);
    });

    it('returns null for unknown revisions', () => {
      catalogBindings.upsert('dining_venue', 'D-1', { name_en: 'X' });
      expect(catalogBindings.rollback('dining_venue', 'D-1', 'REV-NOPE')).toBeNull();
    });
  });

  describe('published resolution', () => {
    it('returns null until something is published', () => {
      catalogBindings.upsert('supplier', 'SUP-1', { display_name_en: 'Draft Name' });
      expect(getPublishedOverlay('supplier', 'SUP-1')).toBeNull();
      catalogBindings.setStatus('supplier', 'SUP-1', 'published');
      const overlay = getPublishedOverlay('supplier', 'SUP-1')!;
      expect(overlay.texts.display_name_en).toBe('Draft Name');
      expect(overlay.fields).toContain('display_name_en');
    });

    it('resolves media ids to public URLs', () => {
      const a = cmsMedia.create({ filename: 'cover.jpg', original_url: '/api/media/cover.jpg' });
      catalogBindings.upsert('place', 'P-1', { name_en: 'Blue Hole', cover_media_id: a.id });
      catalogBindings.setStatus('place', 'P-1', 'published');
      const overlay = getPublishedOverlay('place', 'P-1')!;
      expect(overlay.texts.name_en).toBe('Blue Hole');
      expect(overlay.mediaUrls.cover_media_id).toBe('/api/media/cover.jpg');
    });

    it('drops overlays whose media was deleted instead of serving dead ids', () => {
      const a = cmsMedia.create({ filename: 'gone.jpg', original_url: '/api/media/gone.jpg' });
      catalogBindings.upsert('place', 'P-1', { cover_media_id: a.id });
      catalogBindings.setStatus('place', 'P-1', 'published');
      cmsMedia.remove(a.id);
      expect(getPublishedOverlay('place', 'P-1')).toBeNull();
    });

    it('batch-loads overlays per entity kind', () => {
      catalogBindings.upsert('place', 'P-1', { name_en: 'One' });
      catalogBindings.upsert('place', 'P-2', { name_en: 'Two' });
      catalogBindings.setStatus('place', 'P-1', 'published');
      const map = getPublishedOverlays('place', ['P-1', 'P-2', 'P-3']);
      expect(Object.keys(map)).toEqual(['P-1']);
      expect(map['P-1'].texts.name_en).toBe('One');
    });
  });

  describe('view overlays', () => {
    it('leaves views byte-identical when nothing is published', () => {
      const view = { id: 'ACC-1', name: 'Lodge', tagline: 'Sea view' };
      expect(applyAccommodationOverlay(view, null)).toBe(view);
      catalogBindings.upsert('accommodation', 'ACC-1', { title_en: 'Draft' });
      const map = getPublishedOverlays('accommodation', ['ACC-1']);
      expect(applyAccommodationOverlay(view, map['ACC-1'] ?? null)).toBe(view);
    });

    it('maps accommodation copy + cover onto the view with provenance', () => {
      const a = cmsMedia.create({ filename: 'c.jpg', original_url: '/api/media/c.jpg' });
      catalogBindings.upsert('accommodation', 'ACC-1', {
        title_en: 'New Name',
        title_ar: 'اسم جديد',
        amenities_en: 'wifi\nsea view\n',
        cover_media_id: a.id,
      });
      catalogBindings.setStatus('accommodation', 'ACC-1', 'published');
      const overlay = getPublishedOverlay('accommodation', 'ACC-1')!;
      const next = applyAccommodationOverlay({ id: 'ACC-1', name: 'Old', amenities: ['x'] }, overlay);
      expect(next.name).toBe('New Name');
      expect(next.nameAr).toBe('اسم جديد');
      expect(next.amenities).toEqual(['wifi', 'sea view']);
      expect(next.coverImageUrl).toBe('/api/media/c.jpg');
      expect(next._cms.bound).toContain('title_en');
    });

    it('overrides rental copy without touching images[] or rates', () => {
      catalogBindings.upsert('rental', 'RENT-1', {
        title_en: 'New Bike',
        features_en: 'helmet\nlock',
        policies_en: 'Return by sunset',
      });
      catalogBindings.setStatus('rental', 'RENT-1', 'published');
      const overlay = getPublishedOverlay('rental', 'RENT-1')!;
      const view = {
        id: 'RENT-1', name: 'Old', images: ['img1'], dailyRateEGP: 200,
        policies: { en: 'Old policy', ar: 'سياسة' },
      };
      const next = applyRentalOverlay(view, overlay);
      expect(next.name).toBe('New Bike');
      expect(next.features).toEqual(['helmet', 'lock']);
      expect(next.images).toEqual(['img1']);
      expect(next.dailyRateEGP).toBe(200);
      expect(next.policies).toEqual({ en: 'Return by sunset', ar: 'سياسة' });
    });

    it('maps attraction cards by id prefix (place-/act-/sup-)', () => {
      catalogBindings.upsert('place', 'blue-hole', { name_en: 'Blue Hole (Edited)' });
      catalogBindings.setStatus('place', 'blue-hole', 'published');
      const items = [
        { id: 'place-blue-hole', nameEn: 'Blue Hole', nameAr: 'البلو هول', image: 'old.jpg' },
        { id: 'place-other', nameEn: 'Other', nameAr: 'أخرى' },
      ];
      const next = applyAttractionOverlays(items);
      expect(next[0].nameEn).toBe('Blue Hole (Edited)');
      expect(next[0].image).toBe('old.jpg');
      expect(next[0]._cms.bound).toContain('name_en');
      expect(next[1]).toBe(items[1]);
    });
  });

  describe('list values', () => {
    it('splits on newlines and trims empties', () => {
      expect(splitListValue('a\n\n b \r\nc')).toEqual(['a', 'b', 'c']);
      expect(splitListValue('')).toEqual([]);
    });
  });
});
