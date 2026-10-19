import { Router, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import {
  cmsPages, cmsBlocks, cmsMedia, cmsHomepage, cmsNavigation, cmsSeo, cmsRevisions, sanitizeHomepageConfig
} from '../services/contentService';
import { contentProgrammes } from '../services/contentProgrammesService';
import {
  catalogBindings,
  isCatalogEntityType,
  listCatalogEntities,
  describeCatalogEntity,
  mediaUsageMap,
  CATALOG_ENTITY_TYPES,
  CATALOG_FIELD_REGISTRY,
  type CatalogEntityType,
  type CmsBinding,
} from '../services/catalogContentService';
import {
  validateImageUpload,
  filenameFrom,
  MediaUploadError,
  maxMediaUploadMb,
  ALLOWED_IMAGE_MIME_TYPES,
} from '../services/mediaUpload';
import { generateVariants } from '../services/imageVariants';
import { siteStrings } from '../services/siteStringsService';
import { siteInfo, isSiteInfoKey } from '../services/siteInfoService';
import { siteTheme, isThemeTokenKey, THEME_TOKENS, THEME_TOKEN_KEYS, FONT_STACKS, THEME_IDS } from '../services/themeService';
import { InvalidRequestBodyError } from '../middleware/bodyParams';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataPath } from '../db/paths';

/**
 * Admin Content API — manages CMS content.
 *
 * All routes require authentication. Write operations require Operations or Admin.
 * Product role can create and edit drafts but cannot publish.
 */
export const adminContentRouter = Router();

// Apply auth and role check to all routes
adminContentRouter.use(requireAuth);
adminContentRouter.use(requireRole('Operations', 'Admin', 'Product'));

// ============================================================================
// Pages
// ============================================================================

adminContentRouter.get('/pages', (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const pages = cmsPages.findAll(status);
    res.json({ status: 'success', count: pages.length, pages, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.get('/pages/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = cmsPages.findById(req.params.id);
    if (!page) return res.status(404).json({ status: 'error', message: 'Page not found', correlationId: req.correlationId });
    const blocks = cmsBlocks.findByPageId(page.id);
    const seo = cmsSeo.find('page', page.id);
    res.json({ status: 'success', page, blocks, seo, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/pages', (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = cmsPages.create(req.body, req.user!.userId, req.user!.name);
    res.status(201).json({ status: 'success', page, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.patch('/pages/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = cmsPages.update(req.params.id, req.body, req.user!.userId, req.user!.name);
    if (!page) return res.status(404).json({ status: 'error', message: 'Page not found', correlationId: req.correlationId });
    res.json({ status: 'success', page, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/pages/:id/publish', (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only Operations and Admin can publish
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot publish content', correlationId: req.correlationId });
    }
    const page = cmsPages.publish(req.params.id, req.user!.userId, req.user!.name);
    if (!page) return res.status(404).json({ status: 'error', message: 'Page not found', correlationId: req.correlationId });
    res.json({ status: 'success', page, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/pages/:id/archive', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot archive content', correlationId: req.correlationId });
    }
    const page = cmsPages.archive(req.params.id, req.user!.userId, req.user!.name);
    if (!page) return res.status(404).json({ status: 'error', message: 'Page not found', correlationId: req.correlationId });
    res.json({ status: 'success', page, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.delete('/pages/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'Admin') {
      return res.status(403).json({ status: 'error', message: 'Only Admin can delete pages', correlationId: req.correlationId });
    }
    const removed = cmsPages.remove(req.params.id);
    if (!removed) return res.status(404).json({ status: 'error', message: 'Page not found', correlationId: req.correlationId });
    res.json({ status: 'success', message: 'Page deleted', correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Blocks
// ============================================================================

adminContentRouter.get('/blocks/:pageId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const blocks = cmsBlocks.findByPageId(req.params.pageId);
    res.json({ status: 'success', count: blocks.length, blocks, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/blocks', (req: AuthenticatedRequest, res: Response) => {
  try {
    const block = cmsBlocks.create(req.body, req.user!.userId, req.user!.name);
    res.status(201).json({ status: 'success', block, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.patch('/blocks/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const block = cmsBlocks.update(req.params.id, req.body, req.user!.userId, req.user!.name);
    if (!block) return res.status(404).json({ status: 'error', message: 'Block not found', correlationId: req.correlationId });
    res.json({ status: 'success', block, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.delete('/blocks/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const removed = cmsBlocks.remove(req.params.id);
    if (!removed) return res.status(404).json({ status: 'error', message: 'Block not found', correlationId: req.correlationId });
    res.json({ status: 'success', message: 'Block deleted', correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Media
// ============================================================================

adminContentRouter.get('/media', (req: AuthenticatedRequest, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const media = cmsMedia.findAll(category);
    // Batched usage refs (bindings + page hero/OG) — one pass, no N+1.
    // `usedCount` drives the library badge; `usedIn` lists the first few refs
    // so editors can see WHAT would break before deleting.
    const usage = mediaUsageMap();
    const withUsage = media.map(asset => {
      const refs = usage[asset.id] || [];
      return { ...asset, usedCount: refs.length, usedIn: refs.slice(0, 6) };
    });
    res.json({
      status: 'success',
      count: withUsage.length,
      media: withUsage,
      maxUploadMB: maxMediaUploadMb(),
      correlationId: req.correlationId,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/media', (req: AuthenticatedRequest, res: Response) => {
  try {
    const asset = cmsMedia.create(req.body, req.user!.userId, req.user!.name);
    res.status(201).json({ status: 'success', asset, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.patch('/media/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const asset = cmsMedia.update(req.params.id, req.body, req.user!.userId, req.user!.name);
    if (!asset) return res.status(404).json({ status: 'error', message: 'Media asset not found', correlationId: req.correlationId });
    res.json({ status: 'success', asset, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.delete('/media/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const asset = cmsMedia.findById(req.params.id);
    if (!asset) return res.status(404).json({ status: 'error', message: 'Media asset not found', correlationId: req.correlationId });
    // Deleting a referenced asset blanks live surfaces (overlays resolve to
    // null and pages fall back). Block by default; force-delete is Admin-only
    // and leaves the DB rows intact — resolution simply drops the missing id.
    const refs = mediaUsageMap()[req.params.id] || [];
    if (refs.length > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        status: 'error',
        message: `Asset is used in ${refs.length} place(s). Re-point or unpublish those overrides first, or retry with ?force=true.`,
        usedIn: refs.slice(0, 10),
        correlationId: req.correlationId,
      });
    }
    if (refs.length > 0 && req.user!.role !== 'Admin') {
      return res.status(403).json({ status: 'error', message: 'Only Admin can force-delete a referenced asset', correlationId: req.correlationId });
    }
    const removed = cmsMedia.remove(req.params.id);
    if (!removed) return res.status(404).json({ status: 'error', message: 'Media asset not found', correlationId: req.correlationId });
    // Remove the asset's files too (original + responsive variants). Filenames
    // are unique per upload (timestamp + random stem), so nothing shared can
    // be caught in the crossfire; URL-registered assets have no local files
    // and skip silently. Best-effort: a failed unlink must not fail the delete.
    for (const file of [asset.storage_path, ...asset.variants.map(v => path.join(mediaUploadDir(), path.basename(v.url)))]) {
      if (!file) continue;
      try {
        const resolved = path.resolve(file);
        const dir = path.resolve(mediaUploadDir());
        if ((resolved.startsWith(dir + path.sep) || resolved === dir) && fs.existsSync(resolved)) {
          fs.unlinkSync(resolved);
        }
      } catch { /* orphan cleanup is advisory */ }
    }
    res.json({ status: 'success', message: 'Media asset deleted', correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Media Upload — accepts base64 data URLs, saves to local disk
// ============================================================================

/** Upload dir honors DAHAB_DATA_DIR so isolated environments (QA, Docker
 *  volumes) keep uploaded bytes with their own state, not the repo data/. */
function mediaUploadDir(): string {
  return dataPath('cms-media');
}

// Ensure upload directory exists
function ensureMediaDir(): void {
  const dir = mediaUploadDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * POST /media/upload
 * Upload a file as base64 data URL. The client converts the file to base64
 * and sends it in the request body. The server saves it to disk and creates
 * a media asset record.
 */
export const mediaUploadHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureMediaDir();
    const { dataUrl, filename, alt_en, alt_ar, caption_en, caption_ar, category, credit, tags } = req.body;

    const parsed = validateImageUpload(dataUrl);
    const buffer = parsed.buffer;
    const mimeType = parsed.mimeType;

    // The stored filename is server-determined: the extension comes from the
    // byte-sniffed MIME (never the client's `filename`), and the stem is
    // sanitized to [a-zA-Z0-9_-] (dots removed) and capped at 60 chars. The
    // client's original filename is preserved as a display-only field.
    const { stored, display } = filenameFrom(parsed.mimeType, filename || `upload-${Date.now()}`);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${stored}`;
    const filePath = path.join(mediaUploadDir(), uniqueName);

    // Write file to disk without blocking the event loop (5 MB payloads
    // previously used fs.writeFileSync which stalls concurrent requests).
    // Async file I/O is safe here; no sync is required because the media
    // record is created only after the write completes.
    await fs.promises.writeFile(filePath, buffer);

    // Responsive variants (400/800/1200px, never upscaled, GIFs skipped).
    // Best-effort by design: a variant failure must never fail the upload —
    // the original is always usable on its own.
    const stem = uniqueName.replace(/\.[^.]*$/, '');
    const variants: { width: number; url: string; bytes: number }[] = [];
    try {
      const generated = await generateVariants(buffer, mimeType, stem);
      for (const variant of generated) {
        await fs.promises.writeFile(path.join(mediaUploadDir(), variant.filename), variant.buffer);
        variants.push({
          width: variant.width,
          url: `/api/media/${variant.filename}`,
          bytes: variant.buffer.length,
        });
      }
    } catch (err: any) {
      console.warn('[CMS] Variant generation skipped:', err?.message || err);
    }

// Create media asset record. `filename` is the original client filename
    // (display only); the sanitized safe stem (extension from the sniffed MIME)
    // already lives in `uniqueName`, so `storage_path` is authoritative on disk.
    const asset = cmsMedia.create({
      filename: display,
      original_url: `/api/media/${uniqueName}`,
      storage_path: filePath,
      mime_type: mimeType,
      file_size: buffer.length,
      width: parsed.width,
      height: parsed.height,
      aspect_ratio: parsed.width && parsed.height ? `${parsed.width}/${parsed.height}` : '',
      alt_en: alt_en || '',
      alt_ar: alt_ar || '',
      caption_en: caption_en || '',
      caption_ar: caption_ar || '',
      credit: credit || '',
      category: category || 'general',
      tags: tags || '',
      variants,
    }, req.user!.userId, req.user!.name);

    res.status(201).json({ status: 'success', asset, correlationId: req.correlationId });
  } catch (err: any) {
    const status = err && (err.statusCode || (err instanceof MediaUploadError ? 400 : 500));
    res.status(status).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
};
// Shared with POST /api/supplier/catalog/media/upload (supplierCatalogRoutes.ts).
adminContentRouter.post('/media/upload', mediaUploadHandler);

// ============================================================================
// Homepage Sections
// ============================================================================

adminContentRouter.get('/homepage', (req: AuthenticatedRequest, res: Response) => {
  try {
    const sections = cmsHomepage.findAll();
    res.json({ status: 'success', count: sections.length, sections, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.patch('/homepage/:sectionKey', (req: AuthenticatedRequest, res: Response) => {
  try {
    const body: Record<string, any> = { ...req.body, section_key: req.params.sectionKey };
    // overlay_opacity arrives from the dashboard slider as a number, but a
    // hand-crafted request could send anything — clamp before storage so the
    // hero can never be blanked or blown out by garbage config.
    if (body.config !== undefined) {
      const clean = sanitizeHomepageConfig(req.params.sectionKey, body.config);
      if (clean !== undefined) body.config = clean;
    }
    const section = cmsHomepage.upsert(
      body,
      req.user!.userId,
      req.user!.name
    );
    res.json({ status: 'success', section, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Navigation
// ============================================================================

adminContentRouter.get('/navigation/:menuKey', (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = cmsNavigation.findAllByMenu(req.params.menuKey);
    res.json({ status: 'success', count: items.length, items, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/navigation', (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = cmsNavigation.create(req.body, req.user!.userId, req.user!.name);
    res.status(201).json({ status: 'success', item, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.patch('/navigation/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = cmsNavigation.update(req.params.id, req.body, req.user!.userId, req.user!.name);
    if (!item) return res.status(404).json({ status: 'error', message: 'Navigation item not found', correlationId: req.correlationId });
    res.json({ status: 'success', item, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.delete('/navigation/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'Admin') {
      return res.status(403).json({ status: 'error', message: 'Only Admin can delete navigation items', correlationId: req.correlationId });
    }
    const removed = cmsNavigation.remove(req.params.id);
    if (!removed) return res.status(404).json({ status: 'error', message: 'Navigation item not found', correlationId: req.correlationId });
    res.json({ status: 'success', message: 'Navigation item deleted', correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// SEO
// ============================================================================

adminContentRouter.get('/seo/:pageType/:pageId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const seo = cmsSeo.find(req.params.pageType, req.params.pageId);
    res.json({ status: 'success', seo: seo || null, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.patch('/seo/:pageType/:pageId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const seo = cmsSeo.upsert(
      { ...req.body, page_type: req.params.pageType, page_id: req.params.pageId },
      req.user!.userId,
      req.user!.name
    );
    res.json({ status: 'success', seo, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Schedule Publishing
// ============================================================================

adminContentRouter.post('/pages/:id/schedule', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot schedule publishing', correlationId: req.correlationId });
    }
    const { scheduledAt } = req.body;
    if (!scheduledAt) {
      return res.status(400).json({ status: 'error', message: 'scheduledAt is required', correlationId: req.correlationId });
    }
    const page = cmsPages.schedule(req.params.id, scheduledAt, req.user!.userId, req.user!.name);
    if (!page) return res.status(404).json({ status: 'error', message: 'Page not found', correlationId: req.correlationId });
    res.json({ status: 'success', page, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Rollback
// ============================================================================

adminContentRouter.post('/pages/:id/rollback', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot rollback content', correlationId: req.correlationId });
    }
    const { revisionId } = req.body;
    if (!revisionId) {
      return res.status(400).json({ status: 'error', message: 'revisionId is required', correlationId: req.correlationId });
    }
    const page = cmsPages.rollback(req.params.id, revisionId, req.user!.userId, req.user!.name);
    if (!page) return res.status(404).json({ status: 'error', message: 'Page or revision not found', correlationId: req.correlationId });
    res.json({ status: 'success', page, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/pages/:id/preview-refresh', (req: AuthenticatedRequest, res: Response) => {
  try {
    // Previewing a draft is not publishing — all CMS roles may mint links.
    const page = cmsPages.regeneratePreviewToken(req.params.id, req.user!.userId, req.user!.name);
    if (!page) return res.status(404).json({ status: 'error', message: 'Page not found', correlationId: req.correlationId });
    res.json({
      status: 'success',
      preview_token: page.preview_token,
      preview_expires_at: page.preview_expires_at,
      correlationId: req.correlationId,
    });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Preview (Draft Preview by Token)
// ============================================================================

adminContentRouter.get('/preview/:token', (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = cmsPages.findByPreviewToken(req.params.token);
    if (!page) return res.status(404).json({ status: 'error', message: 'Preview not found', correlationId: req.correlationId });
    const blocks = cmsBlocks.findByPageId(page.id);
    const seo = cmsSeo.find('page', page.id);
    res.json({ status: 'success', page, blocks, seo, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Bulk Operations
// ============================================================================

adminContentRouter.post('/pages/bulk-publish', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot publish content', correlationId: req.correlationId });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 'error', message: 'ids array is required', correlationId: req.correlationId });
    }
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        const page = cmsPages.publish(id, req.user!.userId, req.user!.name);
        results.push({ id, success: !!page });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }
    res.json({ status: 'success', results, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/pages/bulk-archive', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot archive content', correlationId: req.correlationId });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 'error', message: 'ids array is required', correlationId: req.correlationId });
    }
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        const page = cmsPages.archive(id, req.user!.userId, req.user!.name);
        results.push({ id, success: !!page });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }
    res.json({ status: 'success', results, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/pages/bulk-delete', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'Admin') {
      return res.status(403).json({ status: 'error', message: 'Only Admin can delete pages', correlationId: req.correlationId });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 'error', message: 'ids array is required', correlationId: req.correlationId });
    }
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        const removed = cmsPages.remove(id);
        results.push({ id, success: removed });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }
    res.json({ status: 'success', results, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Scheduled Publishing Check (Admin trigger)
// ============================================================================

adminContentRouter.post('/pages/check-scheduled', (req: AuthenticatedRequest, res: Response) => {
  try {
    const published = cmsPages.checkScheduled();
    res.json({ status: 'success', published: published.length, pages: published, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Revisions
// ============================================================================

adminContentRouter.get('/revisions', (req: AuthenticatedRequest, res: Response) => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const revisions = cmsRevisions.findAll(entityType, entityId, limit);
    res.json({ status: 'success', count: revisions.length, revisions, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

// ============================================================================
// Catalog Content Bindings — CMS copy/imagery overlays on catalog rows.
// Bindings never touch catalog tables: reads merge published bindings over
// the row, so operational data (price, capacity, status) cannot be altered
// here. The field allow-list lives in catalogContentService.ts.
// ============================================================================

function bindingTypeOr400(value: unknown): CatalogEntityType {
  if (!isCatalogEntityType(value)) {
    throw new InvalidRequestBodyError('entityType', `must be one of: ${CATALOG_ENTITY_TYPES.join(', ')}.`);
  }
  return value;
}

/** Product may draft but never change publish state — mirrors the pages API. */
function blockProductPublishState(req: AuthenticatedRequest, res: Response, action: string): boolean {
  if (req.user!.role === 'Product') {
    res.status(403).json({ status: 'error', message: `Product role cannot ${action} catalog content`, correlationId: req.correlationId });
    return true;
  }
  return false;
}

function bindingError(res: Response, err: any, correlationId: string | undefined) {
  const status = typeof err?.status === 'number' ? err.status : 400;
  res.status(status).json({ status: 'error', message: err?.message || 'Catalog binding failed', correlationId });
}

/** Static field registry so the dashboard can render editors without catalog reads. */
adminContentRouter.get('/bindings/registry', (req: AuthenticatedRequest, res: Response) => {
  res.json({ status: 'success', entityTypes: CATALOG_ENTITY_TYPES, registry: CATALOG_FIELD_REGISTRY, correlationId: req.correlationId });
});

/**
 * GET /bindings?entityType=rental&q=&status=&includeAll=&limit=
 * Catalog items joined with their binding state. By default only items that
 * already have bindings are returned; includeAll=true browses the full
 * catalog so editors can start new overrides.
 */
adminContentRouter.get('/bindings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const entityType = bindingTypeOr400(req.query.entityType);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const includeAll = req.query.includeAll === 'true';
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

    const entities = listCatalogEntities(entityType);
    // All bindings of this type, grouped — so overrides that outlived their
    // catalog row (reseeds, renames) still surface as unresolved entries
    // instead of silently disappearing from the dashboard.
    const grouped = new Map<string, { ref: { id: string; label: string; labelAr: string; resolved: boolean }; rows: CmsBinding[] }>();
    for (const e of entities) {
      grouped.set(e.id, { ref: { ...e, resolved: true }, rows: [] });
    }
    for (const b of catalogBindings.findAll(entityType, undefined, 1000)) {
      let g = grouped.get(b.entity_id);
      if (!g) {
        g = { ref: { id: b.entity_id, label: b.entity_id, labelAr: '', resolved: false }, rows: [] };
        grouped.set(b.entity_id, g);
      }
      g.rows.push(b);
    }
    const items: Record<string, any>[] = [];
    for (const { ref, rows: bindings } of grouped.values()) {
      if (!includeAll && bindings.length === 0) continue;
      if (status && !bindings.some(b => b.status === status)) continue;
      if (q && !`${ref.label} ${ref.labelAr} ${ref.id}`.toLowerCase().includes(q)) continue;
      const counts = { draft: 0, published: 0, archived: 0 };
      let updatedAt = '';
      const fields: Record<string, { status: string; hasValue: boolean }> = {};
      for (const b of bindings) {
        if (b.status === 'draft' || b.status === 'published' || b.status === 'archived') counts[b.status] += 1;
        fields[b.field] = { status: b.status, hasValue: !!(b.value_text || b.media_id) };
        if (b.updated_at > updatedAt) updatedAt = b.updated_at;
      }
      items.push({
        entityType,
        entityId: ref.id,
        label: ref.label,
        labelAr: ref.labelAr,
        resolved: ref.resolved,
        bindingCount: bindings.length,
        counts,
        fields,
        updatedAt,
      });
      if (items.length >= limit) break;
    }
    res.json({ status: 'success', count: items.length, items, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/bindings/check-scheduled', (req: AuthenticatedRequest, res: Response) => {
  try {
    const published = catalogBindings.checkScheduled();
    res.json({ status: 'success', published: published.length, items: published, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.get('/bindings/:entityType/:entityId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const entityType = bindingTypeOr400(req.params.entityType);
    const entityId = req.params.entityId;
    const ref = describeCatalogEntity(entityType, entityId);
    const bindings = catalogBindings.findForEntity(entityType, entityId);
    const revisions = cmsRevisions.findAll(`binding:${entityType}`, entityId, 20);
    res.json({
      status: 'success',
      entityType,
      entityId,
      label: ref?.label || entityId,
      labelAr: ref?.labelAr || '',
      resolved: !!ref,
      bindings,
      revisions,
      correlationId: req.correlationId,
    });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.put('/bindings/:entityType/:entityId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const entityType = bindingTypeOr400(req.params.entityType);
    const rows = catalogBindings.upsert(
      entityType,
      req.params.entityId,
      req.body?.fields,
      req.user!.userId,
      req.user!.name
    );
    res.json({ status: 'success', count: rows.length, bindings: rows, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/bindings/:entityType/:entityId/publish', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductPublishState(req, res, 'publish')) return;
    const entityType = bindingTypeOr400(req.params.entityType);
    const rows = catalogBindings.setStatus(entityType, req.params.entityId, 'published', req.user!.userId, req.user!.name);
    if (!rows) return res.status(404).json({ status: 'error', message: 'No catalog bindings found for this item', correlationId: req.correlationId });
    res.json({ status: 'success', count: rows.length, bindings: rows, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/bindings/:entityType/:entityId/unpublish', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductPublishState(req, res, 'unpublish')) return;
    const entityType = bindingTypeOr400(req.params.entityType);
    const rows = catalogBindings.setStatus(entityType, req.params.entityId, 'draft', req.user!.userId, req.user!.name);
    if (!rows) return res.status(404).json({ status: 'error', message: 'No catalog bindings found for this item', correlationId: req.correlationId });
    res.json({ status: 'success', count: rows.length, bindings: rows, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/bindings/:entityType/:entityId/archive', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductPublishState(req, res, 'archive')) return;
    const entityType = bindingTypeOr400(req.params.entityType);
    const rows = catalogBindings.setStatus(entityType, req.params.entityId, 'archived', req.user!.userId, req.user!.name);
    if (!rows) return res.status(404).json({ status: 'error', message: 'No catalog bindings found for this item', correlationId: req.correlationId });
    res.json({ status: 'success', count: rows.length, bindings: rows, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/bindings/:entityType/:entityId/schedule', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductPublishState(req, res, 'schedule')) return;
    const entityType = bindingTypeOr400(req.params.entityType);
    const { scheduledAt } = req.body || {};
    if (!scheduledAt) {
      return res.status(400).json({ status: 'error', message: 'scheduledAt is required', correlationId: req.correlationId });
    }
    const rows = catalogBindings.schedule(entityType, req.params.entityId, scheduledAt, req.user!.userId, req.user!.name);
    if (!rows) return res.status(404).json({ status: 'error', message: 'No catalog bindings found for this item', correlationId: req.correlationId });
    res.json({ status: 'success', count: rows.length, bindings: rows, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/bindings/:entityType/:entityId/rollback', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductPublishState(req, res, 'rollback')) return;
    const entityType = bindingTypeOr400(req.params.entityType);
    const { revisionId } = req.body || {};
    if (!revisionId) {
      return res.status(400).json({ status: 'error', message: 'revisionId is required', correlationId: req.correlationId });
    }
    const rows = catalogBindings.rollback(entityType, req.params.entityId, revisionId, req.user!.userId, req.user!.name);
    if (!rows) return res.status(404).json({ status: 'error', message: 'Item or revision not found', correlationId: req.correlationId });
    res.json({ status: 'success', count: rows.length, bindings: rows, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.delete('/bindings/:entityType/:entityId', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'Admin') {
      return res.status(403).json({ status: 'error', message: 'Only Admin can delete catalog bindings', correlationId: req.correlationId });
    }
    const entityType = bindingTypeOr400(req.params.entityType);
    const field = typeof req.query.field === 'string' && req.query.field ? req.query.field : undefined;
    const removed = catalogBindings.remove(entityType, req.params.entityId, field, req.user!.userId, req.user!.name);
    if (!removed) return res.status(404).json({ status: 'error', message: 'No catalog bindings found for this item', correlationId: req.correlationId });
    res.json({ status: 'success', message: 'Catalog bindings deleted', correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

// ============================================================================
// Site Strings — dashboard overrides for UI copy (src/i18n).
// Overrides go LIVE the moment they are saved (no draft state for UI copy),
// so writes are Operations/Admin-only: a Product draft that publishes itself
// on save would defeat the role split. Every write logs a restorable
// revision; resetting a key deletes its override row.
// ============================================================================

/** String/site-info/theme saves publish instantly — Product may not write here at all. */
function blockProductStrings(req: AuthenticatedRequest, res: Response, action: string, surface = 'site strings'): boolean {
  if (req.user!.role === 'Product') {
    res.status(403).json({ status: 'error', message: `Product role cannot ${action} ${surface} (saves go live immediately)`, correlationId: req.correlationId });
    return true;
  }
  return false;
}

adminContentRouter.get('/strings/groups', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groups } = siteStrings.catalog({ limit: 1 });
    const totalKeys = groups.reduce((n, g) => n + g.count, 0);
    const customizedKeys = groups.reduce((n, g) => n + g.customized, 0);
    res.json({ status: 'success', totalKeys, customizedKeys, groups, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.get('/strings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const group = typeof req.query.group === 'string' ? req.query.group : '';
    const customizedOnly = req.query.customizedOnly === 'true';
    const limit = Number(req.query.limit) || 200;
    const offset = Number(req.query.offset) || 0;
    const result = siteStrings.catalog({ q, group, customizedOnly, limit, offset });
    res.json({ status: 'success', ...result, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.get('/strings/export', (req: AuthenticatedRequest, res: Response) => {
  try {
    // Effective values for every key (code merged with overrides) — the file
    // translators work from. fetchAll bypasses the interactive list cap;
    // without it the export silently truncates at 1000 of 3229 keys.
    // Re-importing it is a no-op for unedited keys.
    const { strings } = siteStrings.catalog({ fetchAll: true });
    const out: Record<string, { en: string; ar: string }> = {};
    for (const s of strings) out[s.key] = { en: s.value_en, ar: s.value_ar };
    res.json({
      status: 'success',
      exportedAt: new Date().toISOString(),
      count: strings.length,
      customizedCount: strings.filter(s => s.customized).length,
      strings: out,
      correlationId: req.correlationId,
    });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/strings/import', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'import')) return;
    const input = req.body?.strings;
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return res.status(400).json({ status: 'error', message: '"strings" must be an object mapping keys to {en, ar}.', correlationId: req.correlationId });
    }
    const entries = Object.entries(input as Record<string, unknown>);
    if (entries.length === 0 || entries.length > 5000) {
      return res.status(400).json({ status: 'error', message: '"strings" must contain 1–5000 keys.', correlationId: req.correlationId });
    }
    let updated = 0;
    const skippedUnknown: string[] = [];
    const failed: { key: string; error: string }[] = [];
    for (const [key, raw] of entries) {
      try {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('must be {en, ar}.');
        const { en, ar } = raw as Record<string, unknown>;
        const values: { value_en?: unknown; value_ar?: unknown } = {};
        if (en !== undefined) values.value_en = en;
        if (ar !== undefined) values.value_ar = ar;
        siteStrings.upsert(key, values, req.user!.userId, req.user!.name);
        updated += 1;
      } catch (err: any) {
        if (/Unknown string key/.test(err?.message || '')) skippedUnknown.push(key);
        else failed.push({ key, error: err?.message || 'Invalid value.' });
      }
    }
    res.json({ status: 'success', updated, skippedUnknown, failed, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.get('/strings/:key', (req: AuthenticatedRequest, res: Response) => {
  try {
    const merged = siteStrings.merged(req.params.key);
    if (!merged) return res.status(404).json({ status: 'error', message: `Unknown string key '${req.params.key}'`, correlationId: req.correlationId });
    const revisions = cmsRevisions.findAll('site_string', req.params.key, 20);
    res.json({ status: 'success', string: merged, revisions, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.put('/strings/:key', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'edit')) return;
    const { value_en, value_ar } = req.body || {};
    const override = siteStrings.upsert(req.params.key, { value_en, value_ar }, req.user!.userId, req.user!.name);
    res.json({ status: 'success', live: true, string: siteStrings.merged(override.key), correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.delete('/strings/:key', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'reset')) return;
    const done = siteStrings.reset(req.params.key, req.user!.userId, req.user!.name);
    if (!done) return res.status(404).json({ status: 'error', message: 'No override set for this key', correlationId: req.correlationId });
    res.json({ status: 'success', message: 'Key reset to code defaults', correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/strings/:key/rollback', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'rollback')) return;
    const { revisionId } = req.body || {};
    if (!revisionId) {
      return res.status(400).json({ status: 'error', message: 'revisionId is required', correlationId: req.correlationId });
    }
    const merged = siteStrings.rollback(req.params.key, revisionId, req.user!.userId, req.user!.name);
    if (!merged) return res.status(404).json({ status: 'error', message: 'Key or revision not found', correlationId: req.correlationId });
    res.json({ status: 'success', live: true, string: merged, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

// ============================================================================
// Site Info — contact / social / hours slots rendered in the footer.
// Values go LIVE the moment they are saved, so writes are Operations/Admin-
// only (same rule as site strings). Clearing a slot hides it from the footer.
// ============================================================================

adminContentRouter.get('/site-info', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ status: 'success', info: siteInfo.getAll(), correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.put('/site-info', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'edit', 'site info')) return;
    const { key, value, value_ar } = req.body || {};
    if (!isSiteInfoKey(key)) {
      return res.status(400).json({ status: 'error', message: 'Unknown site-info key.', correlationId: req.correlationId });
    }
    const saved = siteInfo.upsert(key, { value, value_ar }, req.user!.userId, req.user!.name);
    res.json({ status: 'success', live: true, key, info: saved, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

// ============================================================================
// Theme Tokens — brand accents, fonts, default theme. Values apply instantly
// site-wide, so writes are Operations/Admin-only. Only validated values
// (hex colors, offered font stacks, known theme ids) are stored.
// ============================================================================

adminContentRouter.get('/theme', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({
      status: 'success',
      registry: THEME_TOKENS,
      keys: THEME_TOKEN_KEYS,
      fonts: FONT_STACKS,
      themes: THEME_IDS,
      values: siteTheme.getAll(),
      correlationId: req.correlationId,
    });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.put('/theme', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'edit', 'theme tokens')) return;
    const { key, value } = req.body || {};
    if (!isThemeTokenKey(key)) {
      return res.status(400).json({ status: 'error', message: `Unknown theme token. Editable tokens: ${THEME_TOKEN_KEYS.join(', ')}.`, correlationId: req.correlationId });
    }
    const saved = siteTheme.upsert(key, value, req.user!.userId, req.user!.name);
    res.json({ status: 'success', live: true, key, token: saved, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.delete('/theme/:key', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'reset', 'theme tokens')) return;
    const done = siteTheme.reset(req.params.key, req.user!.userId, req.user!.name);
    if (!done) return res.status(404).json({ status: 'error', message: 'No override set for this token', correlationId: req.correlationId });
    res.json({ status: 'success', message: 'Token reset to compiled theme value', correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.post('/theme/:key/rollback', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (blockProductStrings(req, res, 'rollback', 'theme tokens')) return;
    const { revisionId } = req.body || {};
    if (!revisionId) {
      return res.status(400).json({ status: 'error', message: 'revisionId is required', correlationId: req.correlationId });
    }
    const token = siteTheme.rollback(req.params.key, revisionId, req.user!.userId, req.user!.name);
    if (!token) return res.status(404).json({ status: 'error', message: 'Token or revision not found', correlationId: req.correlationId });
    res.json({ status: 'success', live: true, key: req.params.key, token, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

adminContentRouter.get('/theme/:key/revisions', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isThemeTokenKey(req.params.key)) {
      return res.status(400).json({ status: 'error', message: 'Unknown theme token.', correlationId: req.correlationId });
    }
    const revisions = cmsRevisions.findAll('theme', req.params.key, 20);
    res.json({ status: 'success', count: revisions.length, revisions, correlationId: req.correlationId });
  } catch (err: any) {
    bindingError(res, err, req.correlationId);
  }
});

// ============================================================================
// Content Programmes — the ready-made trip programmes the web concierge/plan
// surfaces and the REHLA app render (public read: /api/dahab/content/
// programmes). Rows seed from the editorial catalog; the dashboard edits them.
// Product drafts; only Operations/Admin publish (same rule as pages).
// ============================================================================

adminContentRouter.get('/programmes', (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const destination = typeof req.query.destination === 'string' ? req.query.destination : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const programmes = contentProgrammes.listAdmin({ status, destination, q });
    res.json({ status: 'success', count: programmes.length, programmes, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.get('/programmes/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const programme = contentProgrammes.get(req.params.id);
    if (!programme) return res.status(404).json({ status: 'error', message: 'Programme not found', correlationId: req.correlationId });
    res.json({ status: 'success', programme, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/programmes', (req: AuthenticatedRequest, res: Response) => {
  try {
    const programme = contentProgrammes.create(req.body || {}, req.user!);
    res.status(201).json({ status: 'success', programme, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(err.status || 400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.patch('/programmes/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const programme = contentProgrammes.update(req.params.id, req.body || {}, req.user!);
    if (!programme) return res.status(404).json({ status: 'error', message: 'Programme not found', correlationId: req.correlationId });
    res.json({ status: 'success', programme, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(err.status || 400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/programmes/:id/publish', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot publish content', correlationId: req.correlationId });
    }
    const programme = contentProgrammes.setStatus(req.params.id, 'published', req.user!);
    if (!programme) return res.status(404).json({ status: 'error', message: 'Programme not found', correlationId: req.correlationId });
    res.json({ status: 'success', programme, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(err.status || 400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.post('/programmes/:id/archive', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot archive published content', correlationId: req.correlationId });
    }
    const programme = contentProgrammes.setStatus(req.params.id, 'archived', req.user!);
    if (!programme) return res.status(404).json({ status: 'error', message: 'Programme not found', correlationId: req.correlationId });
    res.json({ status: 'success', programme, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(err.status || 400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

adminContentRouter.delete('/programmes/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'Product') {
      return res.status(403).json({ status: 'error', message: 'Product role cannot delete content', correlationId: req.correlationId });
    }
    const ok = contentProgrammes.remove(req.params.id, req.user!);
    if (!ok) return res.status(404).json({ status: 'error', message: 'Programme not found', correlationId: req.correlationId });
    res.json({ status: 'success', correlationId: req.correlationId });
  } catch (err: any) {
    res.status(err.status || 400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});
