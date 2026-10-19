import { describe, expect, it } from 'vitest';
import {
  buildHeadTags,
  escapeHtmlAttr,
  escapeHtmlText,
  injectMeta,
  resolveMetaForPath
} from '../../server/utils/metaInjection';

const STATIC_INDEX = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <title>DAHAB — Your Dahab trip, built around you</title>
    <meta name="description" content="A premium digital travel platform for Dahab, Egypt." />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="DAHAB" />
    <meta property="og:title" content="DAHAB — Your Dahab trip, built around you" />
    <meta property="og:description" content="Personalized Dahab planning." />
    <meta property="og:image" content="/images/hero/coral-reef-split.jpg" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="ar_EG" />
    <link rel="canonical" href="/" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe('escapeHtmlText / escapeHtmlAttr', () => {
  it('escapes angle brackets and ampersands in text context', () => {
    expect(escapeHtmlText('<script>&"')).toBe('&lt;script&gt;&amp;"');
  });

  it('escapes quotes in attribute context so the attribute cannot be broken out of', () => {
    expect(escapeHtmlAttr('"/><script>alert(1)</script>')).toBe(
      '&quot;/&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });
});

describe('buildHeadTags', () => {
  it('builds title, description, canonical and og tags', () => {
    const tags = buildHeadTags({
      title: 'Blue Hole — Diving',
      description: 'Dive the Blue Hole.',
      canonicalPath: '/hotels/blue-hole',
      ogImageUrl: '/img/x.jpg',
      noindex: false
    });
    expect(tags).toContain('<title>Blue Hole — Diving</title>');
    expect(tags).toContain('<link rel="canonical" href="/hotels/blue-hole" />');
    expect(tags).toContain('<meta property="og:url" content="/hotels/blue-hole" />');
    expect(tags).toContain('<meta property="og:image" content="/img/x.jpg" />');
    expect(tags).not.toContain('noindex');
  });

  it('emits a noindex robots tag when the page is not published', () => {
    const tags = buildHeadTags(
      { title: 'Draft', description: '', canonicalPath: '/x', ogImageUrl: '', noindex: true },
      'en'
    );
    expect(tags).toContain('noindex, nofollow');
  });

  it('localizes og:locale', () => {
    expect(buildHeadTags({ title: 't', description: '', canonicalPath: '', ogImageUrl: '', noindex: false }, 'ar')).toContain(
      'content="ar_EG"'
    );
  });
});

describe('injectMeta', () => {
  it('replaces title/description/canonical and strips the static og duplicates', () => {
    const tags = buildHeadTags({
      title: 'About Dahab — The Story',
      description: 'The full story of Dahab.',
      canonicalPath: '/about',
      ogImageUrl: '',
      noindex: false
    });
    const out = injectMeta(STATIC_INDEX, tags);
    expect(out).toContain('<title>About Dahab — The Story</title>');
    expect(out).not.toContain('Your Dahab trip, built around you</title>');
    expect(out).toContain('<link rel="canonical" href="/about" />');
    // The static og:title was replaced, not duplicated.
    expect(out.match(/<meta property="og:title" /g)?.length).toBe(1);
    // og:locale:alternate survives.
    expect(out).toContain('og:locale:alternate');
  });

  it('does not touch the document when the tag builder produced nothing useful', () => {
    const out = injectMeta(STATIC_INDEX, '');
    expect(out).toBe(STATIC_INDEX);
  });
});

describe('resolveMetaForPath', () => {
  it('prefers the SEO fields over the plain title for CMS pages', () => {
    const meta = resolveMetaForPath(
      '/about',
      {
        cmsPageForPath: () => ({
          title_en: 'About',
          title_ar: 'عن دهب',
          seo_title_en: 'About Dahab — Origins',
          seo_title_ar: '',
          seo_description_en: 'The story.',
          seo_description_ar: 'القصة.',
          description_en: '',
          description_ar: '',
          og_image_url: '/og.png',
          status: 'published'
        })
      },
      'en',
      'https://dahab.example'
    );
    expect(meta?.title).toBe('About Dahab — Origins');
    expect(meta?.description).toBe('The story.');
    expect(meta?.canonicalPath).toBe('https://dahab.example/about');
    expect(meta?.noindex).toBe(false);
  });

  it('marks unpublished CMS pages noindex', () => {
    const meta = resolveMetaForPath('/about', {
      cmsPageForPath: () => ({
        title_en: 'About', title_ar: '', seo_title_en: '', seo_title_ar: '',
        seo_description_en: '', seo_description_ar: '', description_en: '', description_ar: '',
        og_image_url: '', status: 'draft'
      })
    });
    expect(meta?.noindex).toBe(true);
  });

  it('builds a hotel title from the localized name and tagline', () => {
    const meta = resolveMetaForPath('/hotels/almond-rooms', {
      hotelForPath: () => ({ name: 'Almond Rooms', nameAr: 'غرف اللوز', tagline: 'By the shore', taglineAr: 'على الشاطئ' })
    }, 'ar');
    expect(meta?.title).toBe('غرف اللوز — على الشاطئ');
  });

  it('returns null for unmatched paths so the static head is served untouched', () => {
    expect(resolveMetaForPath('/explore', { cmsPageForPath: () => null, hotelForPath: () => null })).toBeNull();
  });
});
