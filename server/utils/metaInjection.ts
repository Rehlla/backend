import type { CmsPage } from '../services/contentService';

/**
 * Server-side <meta> injection for the production SPA fallback.
 *
 * Prerendering/SSR is deliberately deferred (remediation plan §6d): the whole
 * component tree reads localStorage/sessionStorage at module scope, so
 * renderToString is a refactor, not a config change. What link previews and
 * crawlers actually need is the head — title, description, og:*, canonical —
 * and that is ~40 lines with zero render risk:
 *
 *   request path ──► match CMS page or hotel slug ──► rewrite index.html's head
 *
 * This module is pure: HTML string in, HTML string out, data supplied by the
 * caller. That keeps it unit-testable without booting the server and keeps
 * the SQLite reads in server.ts.
 */

/** Escape a value for embedding between HTML tags (title/body text). */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape a value for embedding inside a double-quoted attribute value. */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute or root-relative URL for canonical/og:url. Empty = skip. */
  canonicalPath: string;
  ogImageUrl: string;
  noindex: boolean;
}

export const DEFAULT_LOCALE = 'en';

export function buildHeadTags(meta: PageMeta, locale: string = DEFAULT_LOCALE): string {
  const parts: string[] = [];
  if (meta.title) {
    parts.push(`<title>${escapeHtmlText(meta.title)}</title>`);
  }
  if (meta.description) {
    parts.push(`<meta name="description" content="${escapeHtmlAttr(meta.description)}" />`);
  }
  if (meta.noindex) {
    parts.push('<meta name="robots" content="noindex, nofollow" />');
  }
  if (meta.canonicalPath) {
    parts.push(`<link rel="canonical" href="${escapeHtmlAttr(meta.canonicalPath)}" />`);
    parts.push(`<meta property="og:url" content="${escapeHtmlAttr(meta.canonicalPath)}" />`);
  }
  parts.push(`<meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />`);
  if (meta.description) {
    parts.push(`<meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />`);
  }
  if (meta.ogImageUrl) {
    parts.push(`<meta property="og:image" content="${escapeHtmlAttr(meta.ogImageUrl)}" />`);
  }
  parts.push(`<meta property="og:locale" content="${locale === 'ar' ? 'ar_EG' : 'en_US'}" />`);
  return parts.join('\n    ');
}

/**
 * Replaces the fallback tags injected by the static index.html with the
 * route-specific ones. Only replaces the FIRST occurrence of each tag (the
 * head copy) — the og:locale:alternate tag must survive untouched.
 */
export function injectMeta(html: string, tags: string): string {
  let out = html;

  const titleMatch = tags.match(/<title>[\s\S]*?<\/title>/);
  if (titleMatch) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, titleMatch[0]);
  }

  const descriptionMatch = tags.match(/<meta name="description" [^>]*\/>/);
  if (descriptionMatch) {
    out = out.replace(/<meta name="description" [^>]*\/>/, descriptionMatch[0]);
  }

  const robotsMatch = tags.match(/<meta name="robots" content="noindex[^"]*" \/>/);
  if (robotsMatch) {
    out = out.replace(/<meta name="robots" [^>]*\/>/, robotsMatch[0]);
  }

  const canonicalMatch = tags.match(/<link rel="canonical" [^>]*\/>/);
  if (canonicalMatch) {
    out = out.replace(/<link rel="canonical" [^>]*\/>/, canonicalMatch[0]);
  }

  // og:title/og:description/og:image/og:url/og:locale: prepend (they may not
  // all exist in the static head, e.g. og:url).
  const ogTags = tags.match(/<meta property="og:(?:title|description|image|url)" [^>]*\/>/g) || [];
  if (ogTags.length) {
    const insertion = ogTags.join('\n    ');
    const anchor = out.match(/<meta property="og:site_name" [^>]*\/>/);
    if (anchor) {
      out = out.replace(anchor[0], `${anchor[0]}\n    ${insertion}`);
    } else {
      out = out.replace(/<\/title>/, `</title>\n    ${insertion}`);
    }
    // Later duplicates win in scrapers' first-tag-wins parsing, but replace
    // the static ones anyway to keep the document clean.
    for (const og of ogTags) {
      const prop = og.match(/property="([^"]+)"/)![1];
      const staticRe = new RegExp(`<meta property="${prop}" [^>]*\\/>[\\s\\S]*?<meta property="${prop}" [^>]*\\/>`);
      if (staticRe.test(out)) out = out.replace(staticRe, og);
    }
  }

  const localeMatch = tags.match(/<meta property="og:locale" content="[^"]+" \/>/);
  if (localeMatch) {
    // Replace only the plain og:locale tag, never og:locale:alternate.
    out = out.replace(/<meta property="og:locale" content="[^"]+" \/>/, localeMatch[0]);
  }

  return out;
}

/**
 * Resolves the meta for a request path.
 *
 * `cmsPageForPath` should return the CMS page whose published route matches
 * (about/faq/travel-guides), `hotelForPath` the accommodation for
 * /hotels/:slug. Both are injected so this stays decoupled from SQLite.
 */
export function resolveMetaForPath(
  pathname: string,
  lookups: {
    cmsPageForPath?: (path: string) => Pick<
      CmsPage,
      'title_en' | 'title_ar' | 'seo_title_en' | 'seo_title_ar' | 'seo_description_en' | 'seo_description_ar' | 'description_en' | 'description_ar' | 'og_image_url' | 'status'
    > | null;
    hotelForPath?: (path: string) => { name: string; nameAr: string; tagline: string; taglineAr: string } | null;
  },
  locale: string = DEFAULT_LOCALE,
  baseUrl: string = ''
): PageMeta | null {
  const cms = lookups.cmsPageForPath?.(pathname) || null;
  if (cms) {
    const seoTitle = locale === 'ar' ? cms.seo_title_ar : cms.seo_title_en;
    const fallbackTitle = locale === 'ar' ? cms.title_ar : cms.title_en;
    const seoDesc = locale === 'ar' ? cms.seo_description_ar : cms.seo_description_en;
    const fallbackDesc = locale === 'ar' ? cms.description_ar : cms.description_en;
    return {
      title: seoTitle || fallbackTitle,
      description: seoDesc || fallbackDesc,
      canonicalPath: joinBase(baseUrl, pathname),
      // og:image must be absolute for scrapers to fetch it; CMS pages store
      // root-relative media paths.
      ogImageUrl: absolutize(baseUrl, cms.og_image_url),
      noindex: cms.status !== 'published',
    };
  }

  const hotel = lookups.hotelForPath?.(pathname) || null;
  if (hotel) {
    const name = locale === 'ar' && hotel.nameAr ? hotel.nameAr : hotel.name;
    const tagline = locale === 'ar' && hotel.taglineAr ? hotel.taglineAr : hotel.tagline;
    return {
      title: tagline ? `${name} — ${tagline}` : name,
      description: tagline || '',
      canonicalPath: joinBase(baseUrl, pathname),
      ogImageUrl: '',
      noindex: false,
    };
  }

  return null;
}

function joinBase(baseUrl: string, pathname: string): string {
  if (!baseUrl) return pathname;
  return `${baseUrl.replace(/\/$/, '')}${pathname}`;
}

/** Root-relative media paths become absolute; absolute URLs pass through. */
function absolutize(baseUrl: string, url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url) || !baseUrl) return url;
  return joinBase(baseUrl, url);
}
