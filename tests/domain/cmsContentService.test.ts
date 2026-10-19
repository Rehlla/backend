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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-cms-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

// We need to import the service after adapter is set, since it reads db at call time
import {
  cmsPages, cmsBlocks, cmsMedia, cmsHomepage, cmsNavigation, cmsSeo, cmsRevisions
} from '../../server/services/contentService';

describe('CMS Content Service', () => {

  describe('Pages CRUD', () => {
    it('creates a page with default values', () => {
      const page = cmsPages.create({ slug: 'test-page', title_en: 'Test Page' });
      expect(page.id).toMatch(/^CMS-/);
      expect(page.slug).toBe('test-page');
      expect(page.title_en).toBe('Test Page');
      expect(page.status).toBe('draft');
      expect(page.version).toBe(1);
    });

    it('finds a page by slug', () => {
      cmsPages.create({ slug: 'find-me', title_en: 'Find Me' });
      const found = cmsPages.findBySlug('find-me');
      expect(found).not.toBeNull();
      expect(found!.title_en).toBe('Find Me');
    });

    it('returns null for non-existent slug', () => {
      expect(cmsPages.findBySlug('does-not-exist')).toBeNull();
    });

    it('finds a page by id', () => {
      const created = cmsPages.create({ slug: 'by-id', title_en: 'By ID' });
      const found = cmsPages.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('updates a page', () => {
      const created = cmsPages.create({ slug: 'update-me', title_en: 'Original' });
      const updated = cmsPages.update(created.id, { title_en: 'Updated' });
      expect(updated).not.toBeNull();
      expect(updated!.title_en).toBe('Updated');
      expect(updated!.version).toBe(2);
    });

    it('returns null when updating non-existent page', () => {
      expect(cmsPages.update('NONEXISTENT', { title_en: 'Nope' })).toBeNull();
    });

    it('publishes a page', () => {
      const created = cmsPages.create({ slug: 'pub', title_en: 'Publish' });
      const published = cmsPages.publish(created.id);
      expect(published!.status).toBe('published');
      expect(published!.published_at).toBeTruthy();
    });

    it('archives a page', () => {
      const created = cmsPages.create({ slug: 'arch', title_en: 'Archive' });
      cmsPages.publish(created.id);
      const archived = cmsPages.archive(created.id);
      expect(archived!.status).toBe('archived');
    });

    it('deletes a page', () => {
      const created = cmsPages.create({ slug: 'delete-me', title_en: 'Delete' });
      expect(cmsPages.remove(created.id)).toBe(true);
      expect(cmsPages.findById(created.id)).toBeNull();
    });

    it('returns false when deleting non-existent page', () => {
      expect(cmsPages.remove('NONEXISTENT')).toBe(false);
    });

    it('finds all pages', () => {
      cmsPages.create({ slug: 'a', title_en: 'A' });
      cmsPages.create({ slug: 'b', title_en: 'B' });
      const all = cmsPages.findAll();
      expect(all.length).toBe(2);
    });

    it('filters by status', () => {
      const p1 = cmsPages.create({ slug: 'draft1', title_en: 'Draft' });
      const p2 = cmsPages.create({ slug: 'pub1', title_en: 'Published' });
      cmsPages.publish(p2.id);

      const drafts = cmsPages.findAll('draft');
      expect(drafts.length).toBe(1);
      expect(drafts[0].slug).toBe('draft1');

      const published = cmsPages.findAll('published');
      expect(published.length).toBe(1);
      expect(published[0].slug).toBe('pub1');
    });

    it('finds published by type', () => {
      const prog1 = cmsPages.create({ slug: 'prog1', title_en: 'P1', type: 'trip_program' });
      cmsPages.create({ slug: 'prog2', title_en: 'P2', type: 'trip_program' });
      cmsPages.create({ slug: 'story1', title_en: 'S1', type: 'curated_story' });

      // Initially no trip_programs are published
      const programs = cmsPages.findPublishedByType('trip_program');
      expect(programs.length).toBe(0);

      // Publish one trip_program
      cmsPages.publish(prog1.id);
      const publishedPrograms = cmsPages.findPublishedByType('trip_program');
      expect(publishedPrograms.length).toBe(1);
      expect(publishedPrograms[0].slug).toBe('prog1');
    });

    it('finds featured pages', () => {
      const p = cmsPages.create({ slug: 'feat', title_en: 'Featured', featured: 1 });
      cmsPages.publish(p.id);
      const featured = cmsPages.findPublishedFeatured();
      expect(featured.length).toBe(1);
      expect(featured[0].slug).toBe('feat');
    });
  });

  describe('Blocks CRUD', () => {
    it('creates a block', () => {
      const page = cmsPages.create({ slug: 'with-blocks' });
      const block = cmsBlocks.create({ page_id: page.id, type: 'rich_text', body_en: 'Hello' });
      expect(block.id).toMatch(/^BLK-/);
      expect(block.page_id).toBe(page.id);
      expect(block.type).toBe('rich_text');
    });

    it('finds blocks by page id', () => {
      const page = cmsPages.create({ slug: 'block-test' });
      cmsBlocks.create({ page_id: page.id, type: 'rich_text', sort_order: 1 });
      cmsBlocks.create({ page_id: page.id, type: 'image_text', sort_order: 2 });

      const blocks = cmsBlocks.findByPageId(page.id);
      expect(blocks.length).toBe(2);
      expect(blocks[0].sort_order).toBe(1);
      expect(blocks[1].sort_order).toBe(2);
    });

    it('updates a block', () => {
      const page = cmsPages.create({ slug: 'update-block' });
      const block = cmsBlocks.create({ page_id: page.id, body_en: 'Original' });
      const updated = cmsBlocks.update(block.id, { body_en: 'Updated' });
      expect(updated!.body_en).toBe('Updated');
    });

    it('deletes a block', () => {
      const page = cmsPages.create({ slug: 'del-block' });
      const block = cmsBlocks.create({ page_id: page.id });
      expect(cmsBlocks.remove(block.id)).toBe(true);
      expect(cmsBlocks.findById(block.id)).toBeNull();
    });
  });

  describe('Media CRUD', () => {
    it('creates a media asset', () => {
      const asset = cmsMedia.create({
        filename: 'blue-hole.jpg',
        original_url: 'https://images.unsplash.com/test',
        mime_type: 'image/jpeg',
        category: 'diving',
      });
      expect(asset.id).toMatch(/^MED-/);
      expect(asset.filename).toBe('blue-hole.jpg');
      expect(asset.usage_count).toBe(0);
    });

    it('finds all media', () => {
      cmsMedia.create({ filename: 'a.jpg', category: 'diving' });
      cmsMedia.create({ filename: 'b.jpg', category: 'sunset' });
      expect(cmsMedia.findAll().length).toBe(2);
    });

    it('filters by category', () => {
      cmsMedia.create({ filename: 'a.jpg', category: 'diving' });
      cmsMedia.create({ filename: 'b.jpg', category: 'sunset' });
      expect(cmsMedia.findAll('diving').length).toBe(1);
    });

    it('updates a media asset', () => {
      const asset = cmsMedia.create({ filename: 'orig.jpg' });
      const updated = cmsMedia.update(asset.id, { alt_en: 'Updated alt' });
      expect(updated!.alt_en).toBe('Updated alt');
    });

    it('deletes a media asset', () => {
      const asset = cmsMedia.create({ filename: 'delete.jpg' });
      expect(cmsMedia.remove(asset.id)).toBe(true);
    });
  });

  describe('Homepage Sections', () => {
    it('creates a section via upsert', () => {
      const section = cmsHomepage.upsert({ section_key: 'hero', title_en: 'Hero' });
      expect(section.section_key).toBe('hero');
      expect(section.title_en).toBe('Hero');
    });

    it('updates existing section via upsert', () => {
      cmsHomepage.upsert({ section_key: 'hero', title_en: 'Original' });
      const updated = cmsHomepage.upsert({ section_key: 'hero', title_en: 'Updated' });
      expect(updated.title_en).toBe('Updated');
    });

    it('returns config as a parsed object from upsert (create + update)', () => {
      // Regression: upsert used to return config as a raw JSON string while
      // findAll hydrated it — after any dashboard save the editor received a
      // string and its labeled fields stopped working.
      const cfg = { items: [{ id: 'x', value: '1', label_en: 'X' }] };
      const created = cmsHomepage.upsert({ section_key: 'stats-cfg', config: cfg });
      expect(created.config).toEqual(cfg);
      const updated = cmsHomepage.upsert({ section_key: 'stats-cfg', config: { items: [{ id: 'y', value: '2' }] } });
      expect(updated.config).toEqual({ items: [{ id: 'y', value: '2' }] });
      // And it round-trips through the store consistently with findAll.
      const found = cmsHomepage.findByKey('stats-cfg');
      expect(found!.config).toEqual({ items: [{ id: 'y', value: '2' }] });
    });

    it('finds all sections', () => {
      cmsHomepage.upsert({ section_key: 'hero', sort_order: 0 });
      cmsHomepage.upsert({ section_key: 'featured', sort_order: 1 });
      expect(cmsHomepage.findAll().length).toBe(2);
    });

    it('finds section by key', () => {
      cmsHomepage.upsert({ section_key: 'test-key', title_en: 'Test' });
      const found = cmsHomepage.findByKey('test-key');
      expect(found).not.toBeNull();
      expect(found!.title_en).toBe('Test');
    });

    it('removes a section', () => {
      cmsHomepage.upsert({ section_key: 'remove-me' });
      expect(cmsHomepage.remove('remove-me')).toBe(true);
      expect(cmsHomepage.findByKey('remove-me')).toBeNull();
    });
  });

  describe('Navigation', () => {
    it('creates a navigation item', () => {
      const item = cmsNavigation.create({
        menu_key: 'footer',
        label_en: 'Home',
        label_ar: 'الرئيسية',
        route: '/home',
      });
      expect(item.id).toMatch(/^NAV-/);
      expect(item.menu_key).toBe('footer');
    });

    it('finds items by menu key', () => {
      cmsNavigation.create({ menu_key: 'footer', label_en: 'A', item_order: 1 });
      cmsNavigation.create({ menu_key: 'footer', label_en: 'B', item_order: 2 });
      cmsNavigation.create({ menu_key: 'header', label_en: 'C', item_order: 1 });

      const footer = cmsNavigation.findByMenu('footer');
      expect(footer.length).toBe(2);
      expect(footer[0].item_order).toBe(1);
    });

    it('hides invisible items', () => {
      cmsNavigation.create({ menu_key: 'test', label_en: 'Visible', visible: 1 });
      cmsNavigation.create({ menu_key: 'test', label_en: 'Hidden', visible: 0 });

      const items = cmsNavigation.findByMenu('test');
      expect(items.length).toBe(1);
      expect(items[0].label_en).toBe('Visible');
    });

    it('updates a navigation item', () => {
      const item = cmsNavigation.create({ menu_key: 'test', label_en: 'Old' });
      const updated = cmsNavigation.update(item.id, { label_en: 'New' });
      expect(updated!.label_en).toBe('New');
    });

    it('deletes a navigation item', () => {
      const item = cmsNavigation.create({ menu_key: 'test', label_en: 'Delete' });
      expect(cmsNavigation.remove(item.id)).toBe(true);
    });
  });

  describe('SEO', () => {
    it('creates SEO metadata', () => {
      const seo = cmsSeo.upsert({
        page_type: 'page',
        page_id: 'test-page',
        title_en: 'SEO Title',
        description_en: 'SEO Description',
      });
      expect(seo.title_en).toBe('SEO Title');
    });

    it('updates existing SEO metadata', () => {
      cmsSeo.upsert({ page_type: 'page', page_id: 'x', title_en: 'Old' });
      const updated = cmsSeo.upsert({ page_type: 'page', page_id: 'x', title_en: 'New' });
      expect(updated.title_en).toBe('New');
    });

    it('finds SEO metadata', () => {
      cmsSeo.upsert({ page_type: 'page', page_id: 'find', title_en: 'Find Me' });
      const found = cmsSeo.find('page', 'find');
      expect(found).not.toBeNull();
      expect(found!.title_en).toBe('Find Me');
    });

    it('returns null for non-existent SEO', () => {
      expect(cmsSeo.find('page', 'nonexistent')).toBeNull();
    });
  });

  describe('Revisions', () => {
    it('logs revisions on page create', () => {
      cmsPages.create({ slug: 'rev-test', title_en: 'Rev' });
      const revisions = cmsRevisions.findAll('page');
      expect(revisions.length).toBe(1);
      expect(revisions[0].action).toBe('create');
    });

    it('logs revisions on page update', () => {
      const page = cmsPages.create({ slug: 'rev-update' });
      cmsPages.update(page.id, { title_en: 'Updated' });
      const revisions = cmsRevisions.findAll('page', page.id);
      expect(revisions.length).toBe(2); // create + update
    });

    it('returns all revisions when no filter', () => {
      cmsPages.create({ slug: 'r1' });
      cmsMedia.create({ filename: 'm1.jpg' });
      const all = cmsRevisions.findAll();
      expect(all.length).toBe(2);
    });

    it('respects limit', () => {
      for (let i = 0; i < 10; i++) {
        cmsPages.create({ slug: `limit-${i}` });
      }
      const limited = cmsRevisions.findAll(undefined, undefined, 5);
      expect(limited.length).toBe(5);
    });
  });

  describe('Scheduled Publishing', () => {
    it('schedules a page for future publishing', () => {
      const page = cmsPages.create({ slug: 'scheduled', title_en: 'Scheduled' });
      const future = new Date(Date.now() + 86400000).toISOString();
      const scheduled = cmsPages.schedule(page.id, future);
      expect(scheduled!.scheduled_at).toBe(future);
      expect(scheduled!.status).toBe('draft');
    });

    it('publishes scheduled pages when time has passed', () => {
      const page = cmsPages.create({ slug: 'past-schedule', title_en: 'Past' });
      const past = new Date(Date.now() - 1000).toISOString();
      cmsPages.schedule(page.id, past);

      const published = cmsPages.checkScheduled();
      expect(published.length).toBe(1);
      expect(published[0].status).toBe('published');
      expect(published[0].scheduled_at).toBe('');
    });

    it('does not publish pages scheduled for the future', () => {
      const page = cmsPages.create({ slug: 'future-schedule', title_en: 'Future' });
      const future = new Date(Date.now() + 86400000).toISOString();
      cmsPages.schedule(page.id, future);

      const published = cmsPages.checkScheduled();
      expect(published.length).toBe(0);
      expect(cmsPages.findById(page.id)!.status).toBe('draft');
    });

    it('publish action clears scheduled_at', () => {
      const page = cmsPages.create({ slug: 'clear-schedule', title_en: 'Clear' });
      const future = new Date(Date.now() + 86400000).toISOString();
      cmsPages.schedule(page.id, future);
      const published = cmsPages.publish(page.id);
      expect(published!.scheduled_at).toBe('');
      expect(published!.status).toBe('published');
    });
  });

  describe('Preview Tokens', () => {
    it('generates a preview token on create', () => {
      const page = cmsPages.create({ slug: 'preview-token', title_en: 'Preview' });
      expect(page.preview_token).toMatch(/^PREV-/);
    });

    it('finds a page by preview token', () => {
      const page = cmsPages.create({ slug: 'find-preview', title_en: 'Find Preview' });
      const found = cmsPages.findByPreviewToken(page.preview_token);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(page.id);
    });

    it('returns null for invalid preview token', () => {
      expect(cmsPages.findByPreviewToken('INVALID')).toBeNull();
    });
  });

  describe('Rollback', () => {
    it('rolls back page to a previous revision', () => {
      const page = cmsPages.create({ slug: 'rollback-test', title_en: 'Original' });
      cmsPages.update(page.id, { title_en: 'Changed' });

      // Get the create revision
      const revisions = cmsRevisions.findAll('page', page.id);
      const createRevision = revisions.find(r => r.action === 'create');
      expect(createRevision).toBeDefined();

      // Each revision records a snapshot of the changed field VALUES. The update
      // revision stores the NEW values ('Changed'), so restoring it is a no-op.
      const revisions2 = cmsRevisions.findAll('page', page.id);
      const updateRevision = revisions2.find(r => r.action === 'update');
      expect(updateRevision).toBeDefined();
      const rolledBackToUpdate = cmsPages.rollback(page.id, updateRevision!.id);
      expect(rolledBackToUpdate).not.toBeNull();
      expect(rolledBackToUpdate!.title_en).toBe('Changed');

      // The create revision stores the as-created values, so rolling back to it
      // restores the ORIGINAL title.
      const rolledBackToCreate = cmsPages.rollback(page.id, createRevision!.id);
      expect(rolledBackToCreate).not.toBeNull();
      expect(rolledBackToCreate!.title_en).toBe('Original');
    });

    it('returns null for non-existent revision', () => {
      const page = cmsPages.create({ slug: 'rollback-missing' });
      expect(cmsPages.rollback(page.id, 'NONEXISTENT')).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('handles slug uniqueness', () => {
      cmsPages.create({ slug: 'unique', title_en: 'First' });
      // Second insert with same slug should throw (UNIQUE constraint)
      expect(() => cmsPages.create({ slug: 'unique', title_en: 'Second' })).toThrow();
    });

    it('handles concurrent-ish updates (version bump)', () => {
      const page = cmsPages.create({ slug: 'version-test' });
      expect(page.version).toBe(1);
      cmsPages.update(page.id, { title_en: 'v2' });
      cmsPages.update(page.id, { title_en: 'v3' });
      const final = cmsPages.findById(page.id);
      expect(final!.version).toBe(3);
    });

    it('preserves sort order', () => {
      cmsPages.create({ slug: 'c', sort_order: 3 });
      cmsPages.create({ slug: 'a', sort_order: 1 });
      cmsPages.create({ slug: 'b', sort_order: 2 });
      const all = cmsPages.findAll();
      expect(all[0].slug).toBe('a');
      expect(all[1].slug).toBe('b');
      expect(all[2].slug).toBe('c');
    });
  });
});
