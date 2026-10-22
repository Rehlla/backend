import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Star, Trash2, Image } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { ClickableCard } from '../common/ClickableCard';
import { api } from '../../services/api';
import type { CmsContentPage, CmsPageBlockWire, CmsSeo } from '../../services/api';
import { SeoEditor } from './SeoEditor';
import { MediaLibrary } from './MediaLibrary';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageListItem {
  id: string;
  slug: string;
  type: string;
  title_en: string;
  title_ar: string;
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  featured: number;
  hero_image_url: string;
  updated_at: string;
  created_at: string;
}

interface PageDetail {
  page: CmsContentPage;
  blocks: CmsPageBlockWire[];
  seo: Record<string, any> | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PagesCrudProps {
  onBack?: () => void;
}

export const PagesCrud: React.FC<PagesCrudProps> = ({ onBack }) => {
  const { t, language } = useLanguage();
  const { showToast } = useUI();
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [pages, setPages] = useState<PageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPage, setSelectedPage] = useState<PageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CmsContentPage>>({
    slug: '',
    type: 'page',
    title_en: '',
    title_ar: '',
    subtitle_en: '',
    subtitle_ar: '',
    description_en: '',
    description_ar: '',
    body_en: '',
    body_ar: '',
    hero_image_url: '',
    hero_image_alt_en: '',
    hero_image_alt_ar: '',
    status: 'draft',
    sort_order: 0,
    featured: 0,
  });
  const [blockForm, setBlockForm] = useState<Partial<CmsPageBlockWire>>({
    type: 'text',
    title_en: '',
    title_ar: '',
    body_en: '',
    body_ar: '',
    visible: 1,
    sort_order: 0,
  });
  const [blocks, setBlocks] = useState<CmsPageBlockWire[]>([]);
  const [seoData, setSeoData] = useState<Record<string, any> | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.listCmsPages(statusFilter);
      setPages(json.pages || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('cms.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => { loadPages(); }, [loadPages]);

  const loadPageDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const json = await api.getCmsAdminPage(id) as unknown as PageDetail;
      setSelectedPage(json);
      setBlocks(json.blocks || []);
      setSeoData(json.seo || null);
      // Pre-fill form
      if (json.page) {
        setForm({
          id: json.page.id,
          slug: json.page.slug,
          type: json.page.type,
          title_en: json.page.title_en,
          title_ar: json.page.title_ar,
          subtitle_en: json.page.subtitle_en,
          subtitle_ar: json.page.subtitle_ar,
          description_en: json.page.description_en,
          description_ar: json.page.description_ar,
          body_en: json.page.body_en,
          body_ar: json.page.body_ar,
          hero_image_url: json.page.hero_image_url,
          hero_image_alt_en: json.page.hero_image_alt_en,
          hero_image_alt_ar: json.page.hero_image_alt_ar,
          status: json.page.status,
          sort_order: json.page.sort_order,
          featured: json.page.featured,
        });
      }
    } catch (err: any) {
      showToast(err?.message || t('cms.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [t, showToast]);

  const handleCreate = async () => {
    setForm({
      slug: '',
      type: 'page',
      title_en: '',
      title_ar: '',
      subtitle_en: '',
      subtitle_ar: '',
      description_en: '',
      description_ar: '',
      body_en: '',
      body_ar: '',
      hero_image_url: '',
      hero_image_alt_en: '',
      hero_image_alt_ar: '',
      status: 'draft',
      sort_order: 0,
      featured: 0,
    });
    setBlocks([]);
    setSeoData(null);
    setSelectedPage(null);
    setView('editor');
  };

  const handleEdit = (page: PageListItem) => {
    loadPageDetail(page.id);
    setView('editor');
  };

  const handleSave = async () => {
    if (!form.title_en && !form.title_ar) {
      showToast(t('cms.titleRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach(k => (payload as any)[k] === undefined && delete (payload as any)[k]);

      if (form.id) {
        const json = await api.updateCmsPage(form.id, payload);
        showToast(t('cms.pageSaved'));
        loadPages();
        if (json.page) loadPageDetail(json.page.id);
      } else {
        const json = await api.createCmsPage(payload);
        showToast(t('cms.pageCreated'));
        loadPages();
        if (json.page) loadPageDetail(json.page.id);
      }
      setView('editor');
    } catch (err: any) {
      showToast(err?.message || t('cms.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      const json = await api.publishCmsPage(form.id);
      showToast(t('cms.pagePublished'));
      loadPages();
      if (json.page) loadPageDetail(json.page.id);
    } catch (err: any) {
      showToast(err?.message || t('cms.publishFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      const json = await api.archiveCmsPage(form.id);
      showToast(t('cms.pageArchived'));
      setView('list');
      loadPages();
    } catch (err: any) {
      showToast(err?.message || t('cms.archiveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t('cms.deletePageConfirm'))) return;
    setSaving(true);
    try {
      await api.deleteCmsPage(id);
      showToast(t('cms.pageDeleted'));
      loadPages();
      if (selectedPage?.page?.id === id) {
        setView('list');
        setSelectedPage(null);
      }
    } catch (err: any) {
      showToast(err?.message || t('cms.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = () => {
    setBlockForm({
      type: 'text',
      title_en: '',
      title_ar: '',
      body_en: '',
      body_ar: '',
      visible: 1,
      sort_order: blocks.length,
    });
  };

  const handleSaveBlock = async () => {
    setSaving(true);
    try {
      const payload = { ...blockForm, page_id: form.id };
      const json = await api.createCmsBlock(payload);
      setBlocks(prev => [...prev, json.block]);
      showToast(t('cms.blockCreated'));
    } catch (err: any) {
      showToast(err?.message || t('cms.blockSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBlock = async (blockId: string, patch: Partial<CmsPageBlockWire>) => {
    setSaving(true);
    try {
      const json = await api.updateCmsBlock(blockId, patch);
      setBlocks(prev => prev.map(b => b.id === blockId ? json.block : b));
      showToast(t('cms.blockSaved'));
    } catch (err: any) {
      showToast(err?.message || t('cms.blockSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    setSaving(true);
    try {
      await api.deleteCmsBlock(blockId);
      setBlocks(prev => prev.filter(b => b.id !== blockId));
      showToast(t('cms.blockDeleted'));
    } catch (err: any) {
      showToast(err?.message || t('cms.blockDeleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ── List View ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
          <div>
            <h1 className="text-lg font-extrabold text-[var(--text-primary)]">{t('cms.pagesTitle')}</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('cms.pagesSubtitle')}</p>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs font-medium cursor-pointer focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="all">{t('cms.allStatus')}</option>
              <option value="published">{t('cms.published')}</option>
              <option value="draft">{t('cms.draft')}</option>
              <option value="archived">{t('cms.archived')}</option>
            </select>
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110 transition-[filter]"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('cms.newPage')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <span className="w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
            </div>
          )}
          {error && !loading && (
            <DahabEmptyState
              title={error}
              iconName="alert-triangle"
              motifName="wave-divider"
            />
          )}
          {!loading && !error && pages.length === 0 && (
            <DahabEmptyState
              title={t('cms.noPagesFound')}
              description={t('cms.noPagesDescription')}
              iconName="file-text"
              motifName="topo-contour"
              actionText={t('cms.createFirstPage')}
              onAction={handleCreate}
            />
          )}
          {!loading && !error && pages.length > 0 && (
            <div className="divide-y divide-[var(--border-subtle)]">
              {pages.map(page => (
                <ClickableCard
                  key={page.id}
                  onClick={() => handleEdit(page)}
                  className="w-full p-4 hover:bg-[var(--surface-container)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          {page.type}
                        </span>
                        {page.featured > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Star className="w-3 h-3 inline-block" /> {t('cms.featured')}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {language === 'ar' ? page.title_ar : page.title_en}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                        /{page.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        page.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700'
                          : page.status === 'draft'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t(`cms.status.${page.status}`)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, page.id)}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label={t('cms.deletePage')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </ClickableCard>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Editor View ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView('list')}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={t('cms.back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
              {form.id ? t('cms.editPage') : t('cms.newPage')}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {form.slug ? `/${form.slug}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {form.id && form.status !== 'published' && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-colors"
            >
              {t('cms.publish')}
            </button>
          )}
          {form.id && form.status === 'published' && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-slate-500 text-white text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-colors"
            >
              {t('cms.unpublish')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-colors"
          >
            {saving ? t('cms.saving') : t('cms.save')}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {detailLoading && (
          <div className="flex items-center justify-center h-20">
            <span className="w-4 h-4 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          </div>
        )}

        {/* Basic fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'النوع' : 'Type'}
            </label>
            <select
              value={form.type || 'page'}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="page">{t('cms.typePage')}</option>
              <option value="landing">{t('cms.typeLanding')}</option>
              <option value="article">{t('cms.typeArticle')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'الرقم المعرفي (Slug)' : 'URL Slug'}
            </label>
            <input
              type="text"
              value={form.slug || ''}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder={language === 'ar' ? 'misdaq-el-tajruba' : 'experience-slug'}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        </div>

        {/* Titles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'العنوان (عربي)' : 'Title (English)'}
            </label>
            <input
              type="text"
              value={form.title_en || ''}
              onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
              placeholder={t('cms.titlePlaceholderEn')}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'}
            </label>
            <input
              type="text"
              value={form.title_ar || ''}
              onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
              placeholder={t('cms.titlePlaceholderAr')}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
            />
          </div>
        </div>

        {/* Subtitles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'العبارة الفرعية (EN)' : 'Subtitle (English)'}
            </label>
            <input
              type="text"
              value={form.subtitle_en || ''}
              onChange={e => setForm(f => ({ ...f, subtitle_en: e.target.value }))}
              placeholder={t('cms.subtitlePlaceholderEn')}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'العبارة الفرعية (عربي)' : 'Subtitle (Arabic)'}
            </label>
            <input
              type="text"
              value={form.subtitle_ar || ''}
              onChange={e => setForm(f => ({ ...f, subtitle_ar: e.target.value }))}
              placeholder={t('cms.subtitlePlaceholderAr')}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
            />
          </div>
        </div>

        {/* Description */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'الوصف (EN)' : 'Description (English)'}
            </label>
            <textarea
              value={form.description_en || ''}
              onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
              placeholder={t('cms.descPlaceholderEn')}
              rows={3}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}
            </label>
            <textarea
              value={form.description_ar || ''}
              onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))}
              placeholder={t('cms.descPlaceholderAr')}
              rows={3}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none dir=rtl"
            />
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'المحتوى (EN)' : 'Body Content (English)'}
            </label>
            <textarea
              value={form.body_en || ''}
              onChange={e => setForm(f => ({ ...f, body_en: e.target.value }))}
              placeholder={t('cms.bodyPlaceholderEn')}
              rows={6}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'المحتوى (عربي)' : 'Body Content (Arabic)'}
            </label>
            <textarea
              value={form.body_ar || ''}
              onChange={e => setForm(f => ({ ...f, body_ar: e.target.value }))}
              placeholder={t('cms.bodyPlaceholderAr')}
              rows={6}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none dir=rtl"
            />
          </div>
        </div>

        {/* SEO Section */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <h3 className="text-xs font-extrabold text-[var(--text-primary)] mb-3 uppercase tracking-wider">
            {t('cms.seoSection')}
          </h3>
          <SeoEditor
            seo={(seoData as CmsSeo) ?? null}
            pageType="page"
            pageId={form.id || ''}
            onSave={(_data: Partial<CmsSeo>) => {
              // Handled via separate endpoint; for now inline
              showToast(t('cms.seoSaved'));
            }}
          />
        </div>

        {/* Blocks Section */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
              {t('cms.blocksSection')} ({blocks.length})
            </h3>
            <button
              type="button"
              onClick={handleAddBlock}
              className="px-2 py-1 rounded text-xs font-bold cursor-pointer bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] hover:brightness-110"
            >
              + {t('cms.addBlock')}
            </button>
          </div>
          {blocks.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] italic">{t('cms.noBlocks')}</p>
          )}
          {blocks.map(block => (
            <div key={block.id} className="mb-2 p-3 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  {block.type} #{block.sort_order}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateBlock(block.id, { visible: block.visible ? 0 : 1 })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      block.visible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {block.visible ? t('cms.hide') : t('cms.show')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(block.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-red-500"
                    aria-label={t('cms.deleteBlock')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  value={block.title_en || ''}
                  onChange={e => handleUpdateBlock(block.id, { title_en: e.target.value })}
                  placeholder={t('cms.blockTitleEn')}
                  className="px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <input
                  type="text"
                  value={block.title_ar || ''}
                  onChange={e => handleUpdateBlock(block.id, { title_ar: e.target.value })}
                  placeholder={t('cms.blockTitleAr')}
                  className="px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
                />
              </div>
              <textarea
                value={block.body_en || ''}
                onChange={e => handleUpdateBlock(block.id, { body_en: e.target.value })}
                placeholder={t('cms.blockBodyEn')}
                rows={2}
                className="w-full px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent-primary)] resize-none mb-1"
              />
              <textarea
                value={block.body_ar || ''}
                onChange={e => handleUpdateBlock(block.id, { body_ar: e.target.value })}
                placeholder={t('cms.blockBodyAr')}
                rows={2}
                className="w-full px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent-primary)] resize-none dir=rtl"
              />
            </div>
          ))}
        </div>

        {/* Hidden fields */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'ترتيب المعرض' : 'Sort Order'}
            </label>
            <input
              type="number"
              value={form.sort_order || 0}
              onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'مميز' : 'Featured'}
            </label>
            <input
              type="number"
              min="0"
              max="1"
              value={form.featured || 0}
              onChange={e => setForm(f => ({ ...f, featured: parseInt(e.target.value) || 0 }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'الصورة الرئيسية' : 'Hero Image'}
            </label>
            <div className="flex items-center gap-2">
              <div className="w-16 h-10 rounded-lg overflow-hidden bg-[var(--surface-container)] border border-[var(--border-subtle)] flex-shrink-0">
                {form.hero_image_url ? (
                  <img src={form.hero_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                )}
              </div>
              <input
                type="url"
                value={form.hero_image_url || ''}
                onChange={e => setForm(f => ({ ...f, hero_image_url: e.target.value }))}
                placeholder="https://..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowMediaPicker(true)}
                className="px-2 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110"
              >
                <Image className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Media picker modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMediaPicker(false)}>
          <div className="w-full max-w-3xl h-[70vh] rounded-2xl bg-[var(--surface-container)] shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <MediaLibrary
              onSelect={(url) => {
                setForm(f => ({ ...f, hero_image_url: url }));
                setShowMediaPicker(false);
              }}
              onClose={() => setShowMediaPicker(false)}
              selectable
            />
          </div>
        </div>
      )}
    </div>
  );
};
