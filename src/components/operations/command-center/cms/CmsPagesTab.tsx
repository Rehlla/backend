import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3 } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { CMS_TEMPLATES } from '../../../../data/cmsTemplates';
import { cmsFetch } from './api';
import type { CmsPage } from './types';

export function PagesTab({ onPageSelect }: { onPageSelect: (id: string) => void }) {
  const { language, t } = useLanguage();
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cmsFetch('/pages');
      setPages(data.pages || []);
    } catch (err) {
      console.error('Failed to load pages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPages(); }, [loadPages]);

  const filtered = filter === 'all' ? pages : pages.filter(p => p.type === filter);
  const typeColors: Record<string, string> = {
    trip_program: '#20A89A',
    gallery: '#8B5CF6',
    curated_story: '#F59E0B',
    explore_category: '#E7A83B',
    static_page: '#3B82F6',
  };

  const typeLabels: Record<string, { en: string; ar: string }> = {
    trip_program: { en: 'Trip Program', ar: 'برنامج رحلة' },
    gallery: { en: 'Gallery Photo', ar: 'صورة معرض' },
    curated_story: { en: 'Curated Story', ar: 'قصة منتقاة' },
    explore_category: { en: 'Explore Category', ar: 'تصنيف استكشاف' },
    static_page: { en: 'Static Page', ar: 'صفحة ثابتة' },
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      published: 'bg-green-500/20 text-green-300 border-green-500/30',
      draft: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      archived: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${colors[status] || colors.draft}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {t('cmd.contentPages')}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{pages.length} {t('cmd.pages')}</span>
          <button
            type="button"
            onClick={() => setShowTemplateSelector(true)}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            {t('cmd.newPage')}
          </button>
        </div>
      </div>

      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !creating && setShowTemplateSelector(false)}>
          <div
            className="w-full max-w-2xl rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-bold text-white">
                {t('cmd.chooseATemplate')}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                {t('cmd.pickATemplateTo')}
              </p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {CMS_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  disabled={creating}
                  onClick={async () => {
                    try {
                      setCreating(true);
                      const data = await cmsFetch('/pages', {
                        method: 'POST',
                        body: JSON.stringify({
                          slug: `new-page-${Date.now()}`,
                          type: 'static_page',
                          title_en: template.name,
                          title_ar: template.nameAr,
                          description_en: template.description,
                          description_ar: template.descriptionAr,
                          status: 'draft',
                        }),
                      });
                      for (let i = 0; i < template.blocks.length; i++) {
                        const block = template.blocks[i];
                        await cmsFetch('/blocks', {
                          method: 'POST',
                          body: JSON.stringify({
                            page_id: data.page.id,
                            type: block.type,
                            title_en: block.title_en,
                            title_ar: block.title_ar,
                            body_en: block.body_en,
                            body_ar: block.body_ar,
                            config: block.config || {},
                            sort_order: i,
                          }),
                        });
                      }
                      setShowTemplateSelector(false);
                      onPageSelect(data.page.id);
                    } catch (err: any) {
                      alert(err.message);
                      setCreating(false);
                    }
                  }}
                  className="p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 text-left transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
                >
                  <div className="text-xs font-bold text-white mb-1">
                    {language === 'ar' ? template.nameAr : template.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {language === 'ar' ? template.descriptionAr : template.description}
                  </div>
                  <div className="text-[10px] text-[var(--accent-primary)]/60 mt-2">
                    {template.blocks.length} {t('cmd.prebuiltBlocks')}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-[var(--border-subtle)] flex justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateSelector(false)}
                disabled={creating}
                className="px-4 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-bold hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
              >
                {t('intel.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: t('cmd.all') },
          { key: 'trip_program', label: t('cmd.programs') },
          { key: 'gallery', label: t('cmd.gallery') },
          { key: 'curated_story', label: t('cmd.stories') },
          { key: 'explore_category', label: t('cmd.categories') },
          { key: 'static_page', label: t('cmd.pages-2') },
        ].map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
              filter === f.key
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-red-950/30 border border-red-500/30">
          <span className="text-xs text-red-300">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="px-2 py-1 rounded bg-[var(--btn-util-bg)] text-red-200 text-[11px] font-bold hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
          >
            {t('cmd.dismiss')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          {t('cmd.noPagesFound')}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(page => (
            <div
              key={page.id}
              className="flex items-center gap-4 p-3 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity]"
            >
              {page.hero_image_url && (
                <img
                  src={page.hero_image_url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ backgroundColor: `${typeColors[page.type] || '#666'}20`, color: typeColors[page.type] || '#999' }}
                  >
                    {typeLabels[page.type]?.[language === 'ar' ? 'ar' : 'en'] || page.type}
                  </span>
                  {statusBadge(page.status)}
                  {page.featured ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30">
                      ★
                    </span>
                  ) : null}
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  {language === 'ar' ? page.title_ar : page.title_en}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">
                  /{page.slug} · v{page.version} · {new Date(page.updated_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onPageSelect(page.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                  title="Edit"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {page.status === 'draft' ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setActionError(null);
                          await cmsFetch(`/pages/${page.id}/publish`, { method: 'POST' });
                        } catch (err: any) {
                          setActionError(err?.message || 'Publish failed');
                        }
                        loadPages();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                    >
                      {t('cmd.publish')}
                    </button>
                    <input
                      type="datetime-local"
                      onChange={async (e) => {
                        if (e.target.value) {
                          try {
                            setActionError(null);
                            const scheduledAt = new Date(e.target.value).toISOString();
                            await cmsFetch(`/pages/${page.id}/schedule`, {
                              method: 'POST',
                              body: JSON.stringify({ scheduledAt }),
                            });
                          } catch (err: any) {
                            setActionError(err?.message || 'Schedule failed');
                          }
                          loadPages();
                        }
                      }}
                      className="w-24 px-1 py-0.5 rounded text-[10px] bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-pointer"
                      title={t('cmd.schedulePublish')}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
