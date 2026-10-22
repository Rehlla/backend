import React from 'react';
import { useContentPage } from '../../hooks/useCMSContent';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSEO } from '../../hooks/useSEO';
import { EditableText, CmsEditBanner } from '../cms/InlineEdit';
import { ArrowLeft, FileText, Image, Quote, HelpCircle, Link as LinkIcon, BarChart3 } from 'lucide-react';

/**
 * CmsStaticPage — renders a CMS-managed static page by slug.
 * Falls back to a loading state when the page is being fetched,
 * and shows a "not found" state when the page doesn't exist.
 */

export interface CmsBlock {
  id: string;
  type: string;
  sort_order: number;
  visible: number;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  config: Record<string, any>;
}

/** Minimal page shape the preview renders — the editor feeds unsaved form state. */
export interface CmsPagePreviewData {
  id: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  description_en: string;
  description_ar: string;
  body_en: string;
  body_ar: string;
  hero_image_url: string;
}

interface CmsStaticPageProps {
  slug: string;
  onBack?: () => void;
}

const BLOCK_RENDERERS: Record<string, React.FC<{ block: CmsBlock; language: string }>> = {
  rich_text: ({ block, language }) => (
    <div className="space-y-3">
      {block.title_en && (
        <EditableText
          kind="block" id={block.id} field="title"
          valueEn={block.title_en} valueAr={block.title_ar}
          as="h3" className="text-lg font-bold text-[var(--text-primary)]"
        />
      )}
      <EditableText
        kind="block" id={block.id} field="body"
        valueEn={block.body_en} valueAr={block.body_ar}
        multiline className="text-sm text-[var(--surface-container)]/80 leading-relaxed whitespace-pre-wrap"
      />
    </div>
  ),

  image_text: ({ block, language }) => {
    const config = block.config || {};
    return (
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {config.image_url && (
          <img
            src={config.image_url}
            alt={language === 'ar' ? block.title_ar : block.title_en}
            className="w-full md:w-1/2 h-48 object-cover rounded-xl"
          />
        )}
        <div className="flex-1 space-y-3">
          {block.title_en && (
            <EditableText
              kind="block" id={block.id} field="title"
              valueEn={block.title_en} valueAr={block.title_ar}
              as="h3" className="text-lg font-bold text-[var(--text-primary)]"
            />
          )}
          <EditableText
            kind="block" id={block.id} field="body"
            valueEn={block.body_en} valueAr={block.body_ar}
            multiline className="text-sm text-[var(--surface-container)]/80 leading-relaxed whitespace-pre-wrap"
          />
        </div>
      </div>
    );
  },

  cta: ({ block, language }) => {
    const config = block.config || {};
    return (
      <div className="text-center py-8 px-6 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 space-y-4">
        {block.title_en && (
          <EditableText
            kind="block" id={block.id} field="title"
            valueEn={block.title_en} valueAr={block.title_ar}
            as="h3" className="text-xl font-bold text-[var(--text-primary)]"
          />
        )}
        {block.body_en && (
          <EditableText
            kind="block" id={block.id} field="body"
            valueEn={block.body_en} valueAr={block.body_ar}
            multiline className="text-sm text-[var(--surface-container)]/70 max-w-lg mx-auto"
          />
        )}
        {config.cta_label && (
          <button
            onClick={() => {
              if (config.cta_route) {
                window.location.hash = config.cta_route;
              }
            }}
            className="px-6 py-3 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-card)] text-sm font-bold hover:bg-[var(--accent-primary)] transition-colors cursor-pointer"
          >
            {language === 'ar' ? (config.cta_label_ar || config.cta_label) : config.cta_label}
          </button>
        )}
      </div>
    );
  },

  faq: ({ block, language }) => {
    const config = block.config || {};
    const items = config.items || [];
    return (
      <div className="space-y-4">
        {block.title_en && (
          <EditableText
            kind="block" id={block.id} field="title"
            valueEn={block.title_en} valueAr={block.title_ar}
            as="h3" className="text-lg font-bold text-[var(--text-primary)]"
          />
        )}
        <div className="space-y-3">
          {items.map((item: any, idx: number) => (
            <details key={idx} className="rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] overflow-hidden">
              <summary className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)] cursor-pointer hover:bg-[var(--btn-util-bg)] transition-colors">
                {language === 'ar' ? (item.question_ar || item.question_en) : item.question_en}
              </summary>
              <div className="px-4 pb-3 text-sm text-[var(--surface-container)]/70 leading-relaxed">
                {language === 'ar' ? (item.answer_ar || item.answer_en) : item.answer_en}
              </div>
            </details>
          ))}
        </div>
      </div>
    );
  },

  stats: ({ block, language }) => {
    const config = block.config || {};
    const stats = config.items || [];
    return (
      <div className="space-y-4">
        {block.title_en && (
          <EditableText
            kind="block" id={block.id} field="title"
            valueEn={block.title_en} valueAr={block.title_ar}
            as="h3" className="text-lg font-bold text-[var(--text-primary)] text-center"
          />
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat: any, idx: number) => (
            <div key={idx} className="text-center p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)]">
              <div className="text-2xl font-black text-[var(--accent-primary)]">{stat.value}</div>
              <div className="text-xs text-[var(--surface-container)]/60 mt-1">
                {language === 'ar' ? (stat.label_ar || stat.label_en) : stat.label_en}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },

  quote: ({ block, language }) => {
    const config = block.config || {};
    return (
      <div className="text-center py-8 px-6 space-y-3">
        <Quote className="w-8 h-8 text-[var(--accent-primary)]/40 mx-auto" />
        <EditableText
          kind="block" id={block.id} field="body"
          valueEn={block.body_en} valueAr={block.body_ar}
          multiline as="blockquote" className="text-lg italic text-[var(--text-primary)] max-w-2xl mx-auto"
        />
        {config.attribution && (
          <cite className="text-xs text-[var(--surface-container)]/50 not-italic">
            — {config.attribution}
          </cite>
        )}
      </div>
    );
  },

  divider: () => (
    <div className="py-4">
      <div className="h-px bg-[var(--accent-primary)]/20" />
    </div>
  ),
};

export const CmsStaticPage: React.FC<CmsStaticPageProps> = ({ slug, onBack }) => {
  const { language , t} = useLanguage();
  const { data, loading, fromCMS } = useContentPage(slug);

  // Apply SEO meta tags from CMS data. Must run unconditionally, before any
  // early return, or React throws "Rendered more hooks than during the
  // previous render" (Rules of Hooks violation).
  useSEO({
    title: language === 'ar' ? data?.page?.title_ar || data?.page?.title_en : data?.page?.title_en,
    description: language === 'ar' ? data?.page?.description_ar || data?.page?.description_en : data?.page?.description_en,
    ogTitle: data?.page?.title_en,
    ogDescription: data?.page?.description_en,
    ogImage: data?.page?.hero_image_url || undefined,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface-card)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.page) {
    return (
      <div className="min-h-screen bg-[var(--surface-card)] flex flex-col items-center justify-center text-center px-4">
        <FileText className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h1 className="font-display text-3xl font-semibold text-[var(--text-primary)] mb-2">
          {t('pageNotFound')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {t('thisPageIsNot')}
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-sm hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('goBack')}
          </button>
        )}
      </div>
    );
  }

  const page = data.page;
  // The wire shape may carry config as a JSON string or omit it entirely;
  // the block renderers tolerate both, so normalize here.
  const blocks = (data.blocks || []) as CmsBlock[];

  // Fallback when CMS returns page shell but zero visible content (e.g. /about)
  if (!blocks || blocks.filter(b => b.visible).length === 0) {
    return (
      <div className="min-h-screen bg-[var(--surface-card)] flex flex-col items-center justify-center text-center px-4 space-y-6">
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-[var(--text-primary)] tracking-tight">{language === 'ar' ? page?.title_ar || page?.title_en : page?.title_en || 'About Dahab Travel Platform'}</h1>
        <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl leading-relaxed">REHLA is your intelligent travel companion for South Sinai — planned trips, verified stays, and local coordination for Dahab, Nuweiba & Siwa.</p>
        <a href="/explore" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-card)] text-sm font-bold hover:brightness-110 transition">Explore Dahab</a>
      </div>
    );
  }

  return (
    <>
      <CmsEditBanner />
      <CmsPagePreview
        page={page}
        blocks={blocks}
        language={language}
        onBack={onBack}
        fromCMS={fromCMS}
      />
    </>
  );
};
export const CmsPagePreview: React.FC<{
  page: CmsPagePreviewData;
  blocks: CmsBlock[];
  language: string;
  onBack?: () => void;
  /** When false, shows the "default content" footnote (live page only). */
  fromCMS?: boolean;
}> = ({ page, blocks, language, onBack, fromCMS = true }) => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-[var(--surface-card)]">
      {/* Hero */}
      {page.hero_image_url && (
        <div className="relative h-64 md:h-80">
          <img
            src={page.hero_image_url}
            alt={language === 'ar' ? page.title_ar : page.title_en}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-[var(--surface-card)]/60 to-transparent" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors cursor-pointer py-2 -my-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </button>
        )}

        {/* Page header */}
        <div className="space-y-4">
          <EditableText
            kind="page" id={page.id} field="title"
            valueEn={page.title_en} valueAr={page.title_ar}
            as="h1" className="font-display text-4xl md:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance"
          />
          {page.subtitle_en && (
            <EditableText
              kind="page" id={page.id} field="subtitle"
              valueEn={page.subtitle_en} valueAr={page.subtitle_ar}
              as="p" className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed"
            />
          )}
          {page.description_en && (
            <EditableText
              kind="page" id={page.id} field="description"
              valueEn={page.description_en} valueAr={page.description_ar}
              multiline as="p" className="text-sm text-[var(--surface-container)]/60 leading-relaxed max-w-2xl"
            />
          )}
        </div>

        {/* Page body */}
        {page.body_en && (
          <EditableText
            kind="page" id={page.id} field="body"
            valueEn={page.body_en} valueAr={page.body_ar}
            multiline className="text-sm text-[var(--surface-container)]/80 leading-relaxed whitespace-pre-wrap"
          />
        )}

        {/* Content blocks */}
        <div className="space-y-8">
          {blocks
            .filter(b => b.visible)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(block => {
              const Renderer = BLOCK_RENDERERS[block.type] || BLOCK_RENDERERS.rich_text;
              return (
                <div key={block.id}>
                  <Renderer block={block} language={language} />
                </div>
              );
            })}
        </div>

        {/* CMS indicator */}
        {!fromCMS && (
          <div className="text-center text-[10px] text-[var(--text-muted)] pt-8">
            {t('defaultContent')}
          </div>
        )}
      </div>
    </div>
  );
};
