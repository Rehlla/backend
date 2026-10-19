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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-site-info-'));
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
  siteInfo,
  isSiteInfoKey,
  importLegacySiteSettings,
  SITE_INFO_GROUPS,
  MAX_SITE_INFO_LENGTH,
} from '../../server/services/siteInfoService';
import { cmsRevisions } from '../../server/services/contentService';

function seedLegacy(overrides: Record<string, any> = {}) {
  const legacy = {
    id: 'default',
    contact: {
      phone: '+20 100 000 0000',
      email: 'hello@dahab.com',
      whatsapp: '+20 100 000 0000',
      address: 'Dahab, South Sinai, Egypt',
      addressAr: 'دهب، جنوب سيناء، مصر',
      ...(overrides.contact || {}),
    },
    social: {
      instagram: 'https://instagram.com/dahab',
      facebook: 'https://facebook.com/dahab',
      tiktok: '',
      youtube: '',
      website: 'https://dahab.com',
      ...(overrides.social || {}),
    },
    hours: {
      timezone: 'Africa/Cairo',
      weekday: '9:00 AM – 6:00 PM',
      weekend: '10:00 AM – 4:00 PM',
      holidays: 'Closed on national holidays',
      ...(overrides.hours || {}),
    },
    hero: {
      imageUrl: '/images/hero/blue-hole-signature.jpg',
      headlineEn: 'Discover Dahab',
      headlineAr: 'اكتشف دهب',
      ...(overrides.hero || {}),
    },
    gallery: overrides.gallery || [],
    updatedAt: new Date().toISOString(),
  };
  (db.siteSettings as any[]).push(legacy);
  return legacy;
}

describe('Site Info', () => {
  describe('key allow-list', () => {
    it('covers contact, social and hours groups', () => {
      expect(SITE_INFO_GROUPS).toEqual(['contact', 'social', 'hours']);
      expect(isSiteInfoKey('contact.phone')).toBe(true);
      expect(isSiteInfoKey('social.tiktok')).toBe(true);
      expect(isSiteInfoKey('hours.weekday')).toBe(true);
      expect(isSiteInfoKey('hero.headlineEn')).toBe(false);
      expect(isSiteInfoKey('footer.tagline')).toBe(false);
      expect(isSiteInfoKey('anything')).toBe(false);
    });

    it('rejects unknown keys and oversized values', () => {
      expect(() => siteInfo.upsert('hero.headlineEn', { value: 'X' })).toThrow(/Unknown site-info key/);
      expect(() => siteInfo.upsert('contact.phone', {})).toThrow(/at least one/);
      expect(() => siteInfo.upsert('contact.phone', { value: 42 } as any)).toThrow(/must be a string/);
      expect(() => siteInfo.upsert('contact.phone', { value: 'x'.repeat(MAX_SITE_INFO_LENGTH + 1) })).toThrow(/at most/);
    });
  });

  describe('CRUD', () => {
    it('returns a stable bundle with empty defaults', () => {
      const bundle = siteInfo.getAll();
      expect(Object.keys(bundle).sort()).toEqual(['contact', 'hours', 'social']);
      expect(bundle.contact['contact.phone']).toEqual({ value: '', valueAr: '', updatedAt: '' });
    });

    it('saves one slot and logs a revision', () => {
      const saved = siteInfo.upsert('contact.phone', { value: '+20 100 123 4567' }, 'u1', 'Ops');
      expect(saved.value).toBe('+20 100 123 4567');
      expect(siteInfo.getAll().contact['contact.phone'].value).toBe('+20 100 123 4567');
      expect(cmsRevisions.findAll('site_info', 'contact.phone')).toHaveLength(1);
    });

    it('updates one language without clearing the other', () => {
      siteInfo.upsert('contact.address', { value: 'Masbat', value_ar: 'المسبط' });
      siteInfo.upsert('contact.address', { value: 'Lighthouse' });
      const slot = siteInfo.getAll().contact['contact.address'];
      expect(slot).toMatchObject({ value: 'Lighthouse', valueAr: 'المسبط' });
    });

    it('clearing a slot deletes the row so the footer hides it', () => {
      siteInfo.upsert('social.tiktok', { value: 'https://tiktok.com/@x' });
      expect(siteInfo.getAll().social['social.tiktok'].value).toBeTruthy();
      siteInfo.upsert('social.tiktok', { value: '', value_ar: '' });
      expect(siteInfo.getAll().social['social.tiktok']).toEqual({ value: '', valueAr: '', updatedAt: '' });
    });
  });

  describe('legacy import', () => {
    it('does nothing when no legacy document exists', () => {
      expect(importLegacySiteSettings()).toMatchObject({ ran: false, importedKeys: [] });
    });

    it('skips placeholder defaults (never publishes fake contact data)', () => {
      seedLegacy();
      const result = importLegacySiteSettings();
      expect(result.ran).toBe(true);
      expect(result.importedKeys).toEqual([]);
      expect(result.galleryMigrated).toBe(0);
      expect(result.heroCustomizedUnmigrated).toBe(false);
      expect(siteInfo.getAll().contact['contact.phone'].value).toBe('');
    });

    it('imports customized values and never overwrites CMS truth', () => {
      seedLegacy({
        contact: { phone: '+20 100 111 2222', email: 'real@dahab.travel' },
        social: { instagram: 'https://instagram.com/real-dahab' },
      });
      siteInfo.upsert('contact.phone', { value: '+20 100 999 9999' });
      const result = importLegacySiteSettings();
      expect(result.importedKeys.sort()).toEqual(['contact.email', 'social.instagram']);
      // CMS row wins over the legacy customization.
      expect(siteInfo.getAll().contact['contact.phone'].value).toBe('+20 100 999 9999');
      expect(siteInfo.getAll().contact['contact.email'].value).toBe('real@dahab.travel');
    });

    it('migrates legacy gallery photos to published CMS gallery pages without dupes', async () => {
      const { cmsPages } = await import('../../server/services/contentService');
      seedLegacy({
        gallery: [
          { id: 'g1', url: '/images/legacy/one.jpg', altEn: 'One', captionEn: 'First', displayOrder: 0, featured: true },
          { id: 'g2', url: '', altEn: 'Empty URL skipped' },
        ],
      });
      const first = importLegacySiteSettings();
      expect(first.galleryMigrated).toBe(1);
      const pages = cmsPages.findPublishedByType('gallery');
      expect(pages.map(p => p.hero_image_url)).toContain('/images/legacy/one.jpg');
      const migrated = pages.find(p => p.hero_image_url === '/images/legacy/one.jpg')!;
      expect(migrated.featured).toBe(1);
      // Second run is idempotent — the same URL is never duplicated.
      const second = importLegacySiteSettings();
      expect(second.galleryMigrated).toBe(0);
      expect(cmsPages.findPublishedByType('gallery').filter(p => p.hero_image_url === '/images/legacy/one.jpg')).toHaveLength(1);
    });

    it('reports (not migrates) a customized legacy hero', () => {
      seedLegacy({ hero: { headlineEn: 'My Custom Headline' } });
      const result = importLegacySiteSettings();
      expect(result.heroCustomizedUnmigrated).toBe(true);
    });
  });
});
