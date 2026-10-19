import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { cmsPages, cmsBlocks, cmsHomepage, cmsNavigation, cmsMedia } from '../services/contentService';
import { isCatalogEntityType, getPublishedOverlay } from '../services/catalogContentService';
import { siteStrings } from '../services/siteStringsService';
import { siteInfo } from '../services/siteInfoService';
import { siteTheme } from '../services/themeService';

/**
 * Public Content API — serves published CMS content to the website.
 *
 * These endpoints are read-only and return only status='published' content.
 * They fall back to empty results when the CMS database is unavailable,
 * allowing the frontend to use its compiled fallback data.
 */
export const contentRouter = Router();

/**
 * GET /api/content/homepage
 * Homepage configuration: hero section, featured items, section ordering.
 */
contentRouter.get('/homepage', (req: AuthenticatedRequest, res: Response) => {
  try {
    // All homepage sections, including invisible ones, are returned with their
    // `visible` flag: each consumer decides whether to render its section. The
    // hero is extracted only from visible sections (an invisible hero is null),
    // while the section-backed components (stats band, marquee, essence bento)
    // honor `visible === 0` themselves and render their compiled fallback only
    // when the CMS has no section config at all.
    const allSections = cmsHomepage.findAll();
    const sections = allSections;

    const featuredPrograms = cmsPages.findPublishedByType('trip_program')
      .filter(p => p.featured)
      .slice(0, 6);

    const featuredGallery = cmsPages.findPublishedByType('gallery')
      .filter(p => p.featured)
      .slice(0, 8);

    const featuredStories = cmsPages.findPublishedByType('curated_story')
      .filter(p => p.featured)
      .slice(0, 4);

    // Hero section config — only from visible sections so an editor can hide it.
    const heroSection = allSections.find(s => s.section_key === 'hero' && s.visible);

    res.json({
      status: 'success',
      hero: heroSection ? {
        title_en: heroSection.title_en,
        title_ar: heroSection.title_ar,
        config: typeof heroSection.config === 'string'
          ? (() => { try { return JSON.parse(heroSection.config); } catch { return {}; } })()
          : heroSection.config
      } : null,
      sections,
      featuredPrograms,
      featuredGallery,
      featuredStories,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load homepage content',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/pages
 * Published page index (optional ?type= filter). Previously missing, so the
 * path fell through to the SPA fallback and returned HTML instead of JSON.
 */
contentRouter.get('/pages', (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : undefined;
    const pages = type ? cmsPages.findPublishedByType(type) : cmsPages.findAll('published');
    res.json({
      status: 'success',
      count: pages.length,
      pages,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load pages',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/pages/:slug
 * Individual page content by slug with all its published blocks.
 */
contentRouter.get('/pages/:slug', (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = cmsPages.findBySlug(req.params.slug);
    if (!page || page.status !== 'published') {
      return res.status(404).json({
        status: 'error',
        message: `Page '${req.params.slug}' not found or not published`,
        correlationId: req.correlationId
      });
    }

    const includeBlocks = req.query.include_blocks === 'true';
    const blocks = includeBlocks ? cmsBlocks.findByPageId(page.id) : [];

    res.json({
      status: 'success',
      page,
      blocks,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load page',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/explore-categories
 * Published explore category pages.
 */
contentRouter.get('/explore-categories', (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = cmsPages.findPublishedByType('explore_category')
      .sort((a, b) => a.sort_order - b.sort_order);
    res.json({
      status: 'success',
      count: categories.length,
      categories,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load explore categories',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/gallery
 * Published gallery photos.
 */
contentRouter.get('/gallery', (req: AuthenticatedRequest, res: Response) => {
  try {
    const photos = cmsPages.findPublishedByType('gallery');
    res.json({
      status: 'success',
      count: photos.length,
      photos,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load gallery',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/programmes
 * Published trip programmes.
 */
contentRouter.get('/programmes', (req: AuthenticatedRequest, res: Response) => {
  try {
    const programmes = cmsPages.findPublishedByType('trip_program');
    res.json({
      status: 'success',
      count: programmes.length,
      programmes,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load programmes',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/stories
 * Published curated stories.
 */
contentRouter.get('/stories', (req: AuthenticatedRequest, res: Response) => {
  try {
    const stories = cmsPages.findPublishedByType('curated_story');
    res.json({
      status: 'success',
      count: stories.length,
      stories,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load stories',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/navigation/:menuKey
 * Published navigation items for header/footer/mobile.
 */
contentRouter.get('/navigation/:menuKey', (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = cmsNavigation.findByMenu(req.params.menuKey);
    res.json({
      status: 'success',
      menuKey: req.params.menuKey,
      count: items.length,
      items,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load navigation',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/bindings/:entityType/:entityId
 * Published CMS copy/imagery overrides for one catalog item (accommodation,
 * rental, activity, place, area, dining_venue, supplier, sku, offer).
 * 404 when nothing is published — the caller then renders catalog truth.
 */
contentRouter.get('/bindings/:entityType/:entityId', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isCatalogEntityType(req.params.entityType)) {
      return res.status(404).json({
        status: 'error',
        message: `Unknown catalog entity type '${req.params.entityType}'`,
        correlationId: req.correlationId
      });
    }
    const overlay = getPublishedOverlay(req.params.entityType, req.params.entityId);
    if (!overlay) {
      return res.status(404).json({
        status: 'error',
        message: 'No published overrides for this item',
        correlationId: req.correlationId
      });
    }
    res.json({
      status: 'success',
      entityType: req.params.entityType,
      entityId: req.params.entityId,
      fields: overlay.texts,
      media: overlay.mediaUrls,
      meta: overlay.meta,
      bound: overlay.fields,
      updatedAt: overlay.updatedAt,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load catalog overrides',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/strings?v=
 * Published UI-copy overrides (dashboard-edited EN/AR strings). Ships
 * overrides ONLY — the client merges them over its compiled defaults, so
 * this starts empty and grows only with actual edits. `?v=` carries the
 * client's cached version; a match returns { unchanged: true } to skip the
 * download. Public and cheaply cacheable.
 */
contentRouter.get('/strings', (req: AuthenticatedRequest, res: Response) => {
  try {
    const bundle = siteStrings.bundle();
    if (typeof req.query.v === 'string' && req.query.v && req.query.v === bundle.version) {
      return res.json({ status: 'success', unchanged: true, version: bundle.version, correlationId: req.correlationId });
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      status: 'success',
      version: bundle.version,
      count: bundle.count,
      strings: bundle.strings,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load site strings',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/site-info
 * Public contact / social / hours slots for the footer. Empty slots render
 * as '' — the footer hides unconfigured slots instead of showing placeholders.
 */
contentRouter.get('/site-info', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ status: 'success', info: siteInfo.getAll(), correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load site info',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/theme?v=
 * Published theme-token overrides (brand accents, fonts, default theme).
 * Ships set tokens only with a version stamp; `?v=` short-circuits to
 * { unchanged: true }. The client applies these as CSS variables AFTER the
 * compiled theme engine runs, so unset tokens render compiled values.
 */
contentRouter.get('/theme', (req: AuthenticatedRequest, res: Response) => {
  try {
    const bundle = siteTheme.bundle();
    if (typeof req.query.v === 'string' && req.query.v && req.query.v === bundle.version) {
      return res.json({ status: 'success', unchanged: true, version: bundle.version, correlationId: req.correlationId });
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      status: 'success',
      version: bundle.version,
      tokens: bundle.tokens,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load theme tokens',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/content/preview/:token
 * Draft preview — allows viewing unpublished content via a unique preview token.
 * No authentication required (the token itself is the access control).
 */
contentRouter.get('/preview/:token', (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = cmsPages.findByPreviewToken(req.params.token);
    if (!page) {
      return res.status(404).json({
        status: 'error',
        message: 'Preview not found or expired',
        correlationId: req.correlationId
      });
    }
    const blocks = cmsBlocks.findByPageId(page.id);
    res.json({
      status: 'success',
      page,
      blocks,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to load preview',
      correlationId: req.correlationId
    });
  }
});
