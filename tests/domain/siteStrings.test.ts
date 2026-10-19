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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-site-strings-'));
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
import { siteStrings, stringGroup, MAX_STRING_LENGTH } from '../../server/services/siteStringsService';
import { cmsRevisions } from '../../server/services/contentService';
import { TRANSLATIONS } from '../../src/i18n/translations';

const KNOWN_KEY = 'nav.discover';

describe('Site Strings', () => {
  describe('key ownership', () => {
    it('groups keys by their dotted prefix', () => {
      expect(stringGroup('nav.discover')).toBe('nav');
      expect(stringGroup('hero.title')).toBe('hero');
      expect(stringGroup('plainkey')).toBe('misc');
    });

    it('rejects unknown keys — code owns the key set', () => {
      expect(() => siteStrings.upsert('nope.missing', { value_en: 'X' })).toThrow(/Unknown string key/);
      expect(() => siteStrings.reset('nope.missing')).toThrow(/Unknown string key/);
      expect(siteStrings.merged('nope.missing')).toBeNull();
    });

    it('validates values', () => {
      expect(() => siteStrings.upsert(KNOWN_KEY, {})).toThrow(/at least one/);
      expect(() => siteStrings.upsert(KNOWN_KEY, { value_en: 42 } as any)).toThrow(/must be a string/);
      expect(() => siteStrings.upsert(KNOWN_KEY, { value_en: '' })).toThrow(/non-empty/);
      expect(() => siteStrings.upsert(KNOWN_KEY, { value_en: 'x'.repeat(MAX_STRING_LENGTH + 1) })).toThrow(/at most/);
    });
  });

  describe('upsert / reset', () => {
    it('saves an override for one language, keeping code for the other', () => {
      const row = siteStrings.upsert(KNOWN_KEY, { value_en: 'Discover Dahab!' }, 'u1', 'Ops');
      expect(row.value_en).toBe('Discover Dahab!');
      expect(row.value_ar).toBe('');
      const merged = siteStrings.merged(KNOWN_KEY)!;
      expect(merged.value_en).toBe('Discover Dahab!');
      expect(merged.value_ar).toBe(TRANSLATIONS[KNOWN_KEY].ar);
      expect(merged.customized).toBe(true);
    });

    it('updates in place and logs revisions', () => {
      siteStrings.upsert(KNOWN_KEY, { value_en: 'One' });
      siteStrings.upsert(KNOWN_KEY, { value_en: 'Two', value_ar: 'اثنان' });
      const merged = siteStrings.merged(KNOWN_KEY)!;
      expect(merged.value_en).toBe('Two');
      expect(merged.value_ar).toBe('اثنان');
      const revs = cmsRevisions.findAll('site_string', KNOWN_KEY);
      expect(revs.length).toBe(2);
    });

    it('resets to code defaults by deleting the row', () => {
      siteStrings.upsert(KNOWN_KEY, { value_en: 'Custom' });
      expect(siteStrings.merged(KNOWN_KEY)!.customized).toBe(true);
      expect(siteStrings.reset(KNOWN_KEY)).toBe(true);
      const merged = siteStrings.merged(KNOWN_KEY)!;
      expect(merged.customized).toBe(false);
      expect(merged.value_en).toBe(TRANSLATIONS[KNOWN_KEY].en);
      expect(siteStrings.reset(KNOWN_KEY)).toBe(false);
    });
  });

  describe('rollback', () => {
    it('restores a previous snapshot exactly', () => {
      siteStrings.upsert(KNOWN_KEY, { value_en: 'First', value_ar: 'أول' });
      const first = cmsRevisions.findAll('site_string', KNOWN_KEY).find(r => r.action === 'create')!;
      siteStrings.upsert(KNOWN_KEY, { value_en: 'Second' });
      const rolled = siteStrings.rollback(KNOWN_KEY, first.id)!;
      expect(rolled.value_en).toBe('First');
      expect(rolled.value_ar).toBe('أول');
    });

    it('returns null for unknown revisions', () => {
      siteStrings.upsert(KNOWN_KEY, { value_en: 'X' });
      expect(siteStrings.rollback(KNOWN_KEY, 'REV-NOPE')).toBeNull();
    });
  });

  describe('catalog + bundle', () => {
    it('lists every code key with override state and group stats', () => {
      const totalKeys = Object.keys(TRANSLATIONS).length;
      expect(totalKeys).toBeGreaterThan(1000);
      const before = siteStrings.catalog({ limit: 5 });
      expect(before.total).toBe(totalKeys);
      expect(before.groups.length).toBeGreaterThan(5);
      expect(before.groups.reduce((n, g) => n + g.count, 0)).toBe(totalKeys);

      siteStrings.upsert('nav.discover', { value_en: 'Custom EN' });
      siteStrings.upsert('hero.title', { value_ar: 'مخصص' });
      const customized = siteStrings.catalog({ customizedOnly: true });
      expect(customized.total).toBe(2);
      const nav = siteStrings.catalog({ group: 'nav' });
      expect(nav.strings.every(s => s.group === 'nav')).toBe(true);
      const search = siteStrings.catalog({ q: 'Custom EN' });
      expect(search.strings.map(s => s.key)).toContain('nav.discover');
    });

    it('paginates deterministically', () => {
      const a = siteStrings.catalog({ limit: 50, offset: 0 });
      const b = siteStrings.catalog({ limit: 50, offset: 50 });
      expect(a.strings.length).toBe(50);
      expect(b.strings.length).toBe(50);
      expect(a.strings[0].key).not.toBe(b.strings[0].key);
    });

    it('ships overrides only, with a version stamp that changes on edit', () => {
      const empty = siteStrings.bundle();
      expect(empty.count).toBe(0);
      expect(empty.strings).toEqual({});
      const v0 = empty.version;
      siteStrings.upsert(KNOWN_KEY, { value_en: 'Live!' });
      const full = siteStrings.bundle();
      expect(full.count).toBe(1);
      expect(full.strings[KNOWN_KEY]).toEqual({ en: 'Live!', ar: TRANSLATIONS[KNOWN_KEY].ar });
      expect(full.version).not.toBe(v0);
      expect(Object.keys(full.strings)).toHaveLength(1);
    });
  });
});
