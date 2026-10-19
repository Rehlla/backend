import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';
import {
  findLiteralEscape,
  assertNoLiteralEscapes,
  LiteralEscapeError,
} from '../../server/services/textIntegrity';

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-text-integrity-'));
  adapter = new SqlitePersistenceAdapter(path.join(dir, 'test.sqlite'));
  db.setAdapter(adapter);
  initializeCmsSchema();
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

import { cmsPages, cmsBlocks } from '../../server/services/contentService';
import { siteStrings } from '../../server/services/siteStringsService';

describe('text integrity guard', () => {
  describe('findLiteralEscape', () => {
    it('flags backslash-u sequences pasted from JSON', () => {
      expect(findLiteralEscape('We\\u2019ll handle it')).toBe('\\u2019');
      expect(findLiteralEscape('caf\\u00e9')).toBe('\\u00e9');
      expect(findLiteralEscape('line\\nbreak')).toBe('\\n');
      expect(findLiteralEscape('say \\"hi\\"')).toBe('\\"');
    });

    it('passes real Unicode text untouched', () => {
      expect(findLiteralEscape('We’ll handle the rest.')).toBeNull();
      expect(findLiteralEscape('وصلت دهب؟ سيب الباقي علينا.')).toBeNull();
      expect(findLiteralEscape('Coral 🪸 diving — 100m!')).toBeNull();
      expect(findLiteralEscape('')).toBeNull();
      expect(findLiteralEscape(undefined)).toBeNull();
      expect(findLiteralEscape(42)).toBeNull();
    });

    it('does not flag Windows paths or legitimate backslashes', () => {
      // Single backslash not followed by an escape letter is left alone.
      expect(findLiteralEscape('C:\\Users\\dahab')).toBeNull();
    });
  });

  describe('assertNoLiteralEscapes', () => {
    it('throws a 400-class error naming field and sequence', () => {
      try {
        assertNoLiteralEscapes({ title_en: 'We\\u2019ll' }, ['title_en']);
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(LiteralEscapeError);
        expect(err.status).toBe(400);
        expect(err.message).toContain('title_en');
        expect(err.message).toContain('\\u2019');
      }
    });

    it('ignores unlisted keys and empty values', () => {
      expect(() => assertNoLiteralEscapes({ whatever: 'We\\u2019ll' }, ['title_en'])).not.toThrow();
      expect(() => assertNoLiteralEscapes({ title_en: '' }, ['title_en'])).not.toThrow();
    });
  });

  describe('write-path enforcement', () => {
    it('rejects page creates and updates carrying escapes', () => {
      expect(() => cmsPages.create({ slug: 'bad', title_en: 'We\\u2019ll' })).toThrow(/title_en/);
      const page = cmsPages.create({ slug: 'good', title_en: 'Clean title' });
      expect(() => cmsPages.update(page.id, { body_en: 'line\\nbreak' })).toThrow(/body_en/);
      // Clean writes still pass.
      expect(cmsPages.update(page.id, { body_en: 'We’ll — clean.' })!.body_en).toContain('We’ll');
    });

    it('rejects block writes carrying escapes', () => {
      const page = cmsPages.create({ slug: 'bpage' });
      expect(() => cmsBlocks.create({ page_id: page.id, body_en: 'caf\\u00e9' })).toThrow(/body_en/);
      const block = cmsBlocks.create({ page_id: page.id, body_en: 'Clean' });
      expect(() => cmsBlocks.update(block.id, { title_en: 'A\\u00e9' })).toThrow(/title_en/);
    });

    it('rejects string overrides carrying escapes', () => {
      expect(() => siteStrings.upsert('nav.discover', { value_en: 'Go\\u0021' })).toThrow(/value_en/);
      const row = siteStrings.upsert('nav.discover', { value_en: 'Discover!', value_ar: 'اكتشف!' });
      expect(row.value_en).toBe('Discover!');
      siteStrings.reset('nav.discover');
    });
  });
});
