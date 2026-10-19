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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-workflow-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

// Services read the adapter lazily per call, like contentService.
import {
  cmsPages,
  cmsBlocks,
  cmsMedia,
  cmsHomepage,
  cmsNavigation,
  cmsSeo,
  cmsRevisions,
  PREVIEW_TOKEN_TTL_MS,
} from '../../server/services/contentService';

function rawConn(): any {
  return (adapter as any).connection;
}

function payloadOf(entityType: string, entityId: string, action: string): Record<string, any> {
  const rev = cmsRevisions.findAll(entityType, entityId).find(r => r.action === action)!;
  expect(rev, `${action} revision for ${entityType}:${entityId} should exist`).toBeDefined();
  return rev.payload as Record<string, any>;
}

describe('CMS workflow integrity', () => {
  describe('preview token expiry', () => {
    it('issues a 7-day expiry on create', () => {
      const page = cmsPages.create({ slug: 'expiry', title_en: 'Expiry' });
      expect(page.preview_token).toMatch(/^PREV-/);
      const ms = new Date(page.preview_expires_at).getTime() - Date.now();
      expect(ms).toBeGreaterThan(PREVIEW_TOKEN_TTL_MS - 60_000);
      expect(ms).toBeLessThanOrEqual(PREVIEW_TOKEN_TTL_MS);
    });

    it('honors fresh tokens and rejects expired ones', () => {
      const page = cmsPages.create({ slug: 'fresh', title_en: 'Fresh' });
      expect(cmsPages.findByPreviewToken(page.preview_token)?.id).toBe(page.id);
      rawConn().prepare('UPDATE cms_pages SET preview_expires_at = ? WHERE id = ?')
        .run(new Date(Date.now() - 1000).toISOString(), page.id);
      expect(cmsPages.findByPreviewToken(page.preview_token)).toBeNull();
    });

    it('treats undated legacy tokens as dead', () => {
      const page = cmsPages.create({ slug: 'legacy', title_en: 'Legacy' });
      rawConn().prepare('UPDATE cms_pages SET preview_expires_at = ? WHERE id = ?').run('', page.id);
      expect(cmsPages.findByPreviewToken(page.preview_token)).toBeNull();
    });

    it('regenerates rotate the token, extend expiry and log', () => {
      const page = cmsPages.create({ slug: 'regen', title_en: 'Regen' });
      const oldToken = page.preview_token;
      const next = cmsPages.regeneratePreviewToken(page.id, 'u1', 'Ops')!;
      expect(next.preview_token).not.toBe(oldToken);
      expect(new Date(next.preview_expires_at).getTime()).toBeGreaterThan(Date.now());
      // Old link dies immediately, new link works.
      expect(cmsPages.findByPreviewToken(oldToken)).toBeNull();
      expect(cmsPages.findByPreviewToken(next.preview_token)?.id).toBe(page.id);
      expect(payloadOf('page', page.id, 'preview_refresh').preview_expires_at).toBe(next.preview_expires_at);
    });

    it('returns null when regenerating a missing page', () => {
      expect(cmsPages.regeneratePreviewToken('NOPE')).toBeNull();
      expect(cmsPages.findByPreviewToken('')).toBeNull();
    });
  });

  describe('snapshot revisions (values, not field names)', () => {
    it('blocks record changed values', () => {
      const page = cmsPages.create({ slug: 'bpage' });
      const block = cmsBlocks.create({ page_id: page.id, body_en: 'Original' });
      expect(payloadOf('block', block.id, 'create').body_en).toBe('Original');
      cmsBlocks.update(block.id, { body_en: 'Changed', sort_order: 3 });
      const payload = payloadOf('block', block.id, 'update');
      expect(payload.body_en).toBe('Changed');
      expect(payload.sort_order).toBe(3);
      expect(payload.fields).toBeUndefined();
    });

    it('media records values on create and update', () => {
      const asset = cmsMedia.create({ filename: 'a.jpg', alt_en: 'Alt' });
      expect(payloadOf('media', asset.id, 'create').alt_en).toBe('Alt');
      cmsMedia.update(asset.id, { alt_en: 'New alt' });
      const payload = payloadOf('media', asset.id, 'update');
      expect(payload.alt_en).toBe('New alt');
      expect(payload.fields).toBeUndefined();
    });

    it('navigation records values on create and update', () => {
      const item = cmsNavigation.create({ menu_key: 'footer', label_en: 'Home', route: '/home' });
      expect(payloadOf('navigation', item.id, 'create')).toMatchObject({ label_en: 'Home', route: '/home' });
      cmsNavigation.update(item.id, { label_en: 'Start' });
      expect(payloadOf('navigation', item.id, 'update').label_en).toBe('Start');
    });

    it('homepage sections record values on upsert', () => {
      const created = cmsHomepage.upsert({ section_key: 'test-sec', title_en: 'T', config: { a: 1 } });
      expect(payloadOf('homepage_section', created.id, 'create')).toMatchObject({ title_en: 'T' });
      cmsHomepage.upsert({ section_key: 'test-sec', title_en: 'T2', config: { a: 1 } });
      const payload = payloadOf('homepage_section', created.id, 'update');
      expect(payload.title_en).toBe('T2');
      expect(payload.config).toEqual({ a: 1 });
    });

    it('seo writes an audit trail where none existed', () => {
      expect(cmsRevisions.findAll('seo').length).toBe(0);
      const created = cmsSeo.upsert({ page_type: 'page', page_id: 'p1', title_en: 'SEO' });
      expect(payloadOf('seo', created.id, 'create')).toMatchObject({ title_en: 'SEO', page_id: 'p1' });
      cmsSeo.upsert({ page_type: 'page', page_id: 'p1', title_en: 'SEO2' });
      expect(payloadOf('seo', created.id, 'update').title_en).toBe('SEO2');
    });
  });
});
