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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-site-theme-'));
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
  siteTheme,
  isThemeTokenKey,
  assertThemeValue,
  THEME_TOKEN_KEYS,
  FONT_STACKS,
} from '../../server/services/themeService';
import { cmsRevisions } from '../../server/services/contentService';

describe('Site Theme tokens', () => {
  describe('closed registry + strict validation (no arbitrary CSS)', () => {
    it('exposes exactly the composable token set', () => {
      expect(THEME_TOKEN_KEYS.sort()).toEqual([
        'brand.accent',
        'brand.accentSecondary',
        'brand.homeTheme',
        'type.arabic',
        'type.body',
        'type.display',
      ]);
      expect(isThemeTokenKey('brand.accent')).toBe(true);
      expect(isThemeTokenKey('--accent-primary')).toBe(false);
      expect(isThemeTokenKey('color')).toBe(false);
    });

    it('accepts only hex colors for color tokens', () => {
      expect(assertThemeValue('brand.accent', '#10B981')).toBe('#10B981');
      expect(assertThemeValue('brand.accent', '#fff')).toBe('#FFF');
      expect(() => assertThemeValue('brand.accent', 'red')).toThrow(/hex color/);
      expect(() => assertThemeValue('brand.accent', '#12345')).toThrow(/hex color/);
      expect(() => assertThemeValue('brand.accent', 'expression(alert(1))')).toThrow(/hex color/);
      expect(() => assertThemeValue('brand.accent', 'var(--x)')).toThrow(/hex color/);
      expect(() => assertThemeValue('brand.accent', '')).toThrow(/non-empty/);
    });

    it('accepts only offered font stacks', () => {
      expect(assertThemeValue('type.body', FONT_STACKS.System)).toBe(FONT_STACKS.System);
      expect(() => assertThemeValue('type.body', 'Comic Sans MS')).toThrow(/offered font/);
      expect(() => assertThemeValue('type.body', "Outfit', sans-serif; background: red")).toThrow(/offered font/);
    });

    it('accepts only known theme ids for the home theme', () => {
      expect(assertThemeValue('brand.homeTheme', 'salt')).toBe('salt');
      // Retired six-theme ids are no longer accepted for new writes.
      expect(() => assertThemeValue('brand.homeTheme', 'deep-reef')).toThrow(/must be one of/);
      expect(() => assertThemeValue('brand.homeTheme', 'midnight-hacker')).toThrow(/must be one of/);
    });

    it('rejects unknown keys at the service boundary', () => {
      expect(() => siteTheme.upsert('brand.whatever', '#fff')).toThrow(/Unknown theme token/);
      expect(() => siteTheme.reset('brand.whatever')).toThrow(/Unknown theme token/);
    });
  });

  describe('CRUD', () => {
    it('starts empty (compiled theme renders)', () => {
      expect(siteTheme.getAll()).toEqual({});
      const bundle = siteTheme.bundle();
      expect(bundle.tokens).toEqual({});
      expect(bundle.version).toMatch(/^0::[0-9a-z]+$/);
    });

    it('saves, reads back and resets a token with revision history', () => {
      siteTheme.upsert('brand.accent', '#10b981', 'u1', 'Ops');
      expect(siteTheme.getAll()['brand.accent'].value).toBe('#10B981');
      expect(siteTheme.bundle().tokens).toEqual({ 'brand.accent': '#10B981' });
      expect(cmsRevisions.findAll('theme', 'brand.accent')).toHaveLength(1);
      expect(siteTheme.reset('brand.accent')).toBe(true);
      expect(siteTheme.getAll()).toEqual({});
      expect(siteTheme.reset('brand.accent')).toBe(false);
    });

    it('bumps the bundle version on every change', () => {
      const v0 = siteTheme.bundle().version;
      siteTheme.upsert('type.body', FONT_STACKS.System);
      const v1 = siteTheme.bundle().version;
      expect(v1).not.toBe(v0);
      siteTheme.upsert('type.body', FONT_STACKS['IBM Plex Sans']);
      expect(siteTheme.bundle().version).not.toBe(v1);
    });

    it('rolls back to a previous snapshot exactly', () => {
      siteTheme.upsert('brand.accent', '#10B981');
      const createRev = cmsRevisions.findAll('theme', 'brand.accent').find(r => r.action === 'create')!;
      siteTheme.upsert('brand.accent', '#FF0000');
      expect(siteTheme.getAll()['brand.accent'].value).toBe('#FF0000');
      const rolled = siteTheme.rollback('brand.accent', createRev.id)!;
      expect(rolled.value).toBe('#10B981');
      expect(siteTheme.getAll()['brand.accent'].value).toBe('#10B981');
      // Single rollback entry — no update+rollback double logging.
      const actions = cmsRevisions.findAll('theme', 'brand.accent').map(r => r.action);
      expect(actions.filter(a => a === 'rollback')).toHaveLength(1);
    });

    it('rolls back to compiled defaults from a reset snapshot', () => {
      siteTheme.upsert('brand.accent', '#10B981');
      siteTheme.reset('brand.accent');
      const resetRev = cmsRevisions.findAll('theme', 'brand.accent').find(r => r.action === 'reset')!;
      siteTheme.upsert('brand.accent', '#FF0000');
      const rolled = siteTheme.rollback('brand.accent', resetRev.id)!;
      expect(rolled.value).toBe('');
      expect(siteTheme.getAll()['brand.accent']).toBeUndefined();
    });

    it('returns null for unknown revisions and rejects bad payloads', () => {
      siteTheme.upsert('brand.accent', '#10B981');
      expect(siteTheme.rollback('brand.accent', 'REV-NOPE')).toBeNull();
      expect(() => siteTheme.rollback('brand.accent', '')).toThrow(/revisionId/);
      expect(() => siteTheme.rollback('nope.token' as any, 'REV-X')).toThrow(/Unknown theme token/);
    });
  });
});
