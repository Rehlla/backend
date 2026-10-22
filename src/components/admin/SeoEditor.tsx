import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { api } from '../../services/api';
import type { CmsSeo } from '../../services/api';

interface SeoEditorProps {
  seo: CmsSeo | null;
  pageType: string;
  pageId: string;
  onSave?: (data: Partial<CmsSeo>) => void;
}

export const SeoEditor: React.FC<SeoEditorProps> = ({ seo, pageType, pageId, onSave }) => {
  const { t, language } = useLanguage();
  const { showToast } = useUI();
  const [form, setForm] = useState<Partial<CmsSeo>>({
    title_en: '',
    title_ar: '',
    description_en: '',
    description_ar: '',
    og_title_en: '',
    og_title_ar: '',
    og_description_en: '',
    og_description_ar: '',
    og_image_url: '',
    canonical_url: '',
    noindex: 0,
  });
  const [saving, setSaving] = useState(false);
  const [localized, setLocalized] = useState<'en' | 'ar'>(language);

  useEffect(() => {
    if (seo) {
      setForm({
        id: seo.id,
        page_type: seo.page_type,
        page_id: seo.page_id,
        title_en: seo.title_en,
        title_ar: seo.title_ar,
        description_en: seo.description_en,
        description_ar: seo.description_ar,
        og_title_en: seo.og_title_en,
        og_title_ar: seo.og_title_ar,
        og_description_en: seo.og_description_en,
        og_description_ar: seo.og_description_ar,
        og_image_url: seo.og_image_url,
        canonical_url: seo.canonical_url,
        noindex: seo.noindex,
      });
    } else {
      setForm({
        title_en: '',
        title_ar: '',
        description_en: '',
        description_ar: '',
        og_title_en: '',
        og_title_ar: '',
        og_description_en: '',
        og_description_ar: '',
        og_image_url: '',
        canonical_url: '',
        noindex: 0,
      });
    }
  }, [seo]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title_en: form.title_en,
        title_ar: form.title_ar,
        description_en: form.description_en,
        description_ar: form.description_ar,
        og_title_en: form.og_title_en,
        og_title_ar: form.og_title_ar,
        og_description_en: form.og_description_en,
        og_description_ar: form.og_description_ar,
        og_image_url: form.og_image_url,
        canonical_url: form.canonical_url,
        noindex: form.noindex,
      };
      // Clean empty strings
      Object.keys(payload).forEach(k => {
        if ((payload as any)[k] === '') delete (payload as any)[k];
      });

      const json = await api.updateCmsSeo(pageType, pageId, payload);
      showToast(t('cms.seoSaved'));
      if (onSave) onSave(json.seo);
    } catch (err: any) {
      showToast(err?.message || t('cms.seoSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleNoindex = () => {
    setForm(f => ({ ...f, noindex: f.noindex ? 0 : 1 }));
  };

  return (
    <div className="space-y-3">
      {/* Page info */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
        <span className="px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold">
          {pageType}
        </span>
        <span>/{pageId}</span>
      </div>

      {/* Meta Title */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
            {language === 'ar' ? 'العنوان لـ SEO (EN)' : 'SEO Title (English)'}
          </label>
          <input
            type="text"
            value={form.title_en || ''}
            onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
            placeholder="Page title for search engines"
            maxLength={60}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 text-right">
            {form.title_en?.length || 0}/60
          </p>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
            {language === 'ar' ? 'العنوان لـ SEO (عربي)' : 'SEO Title (Arabic)'}
          </label>
          <input
            type="text"
            value={form.title_ar || ''}
            onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
            placeholder="عنوان الصفحة لمحركات البحث"
            maxLength={60}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
          />
        </div>
      </div>

      {/* Meta Description */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
            {language === 'ar' ? 'الوصف (EN)' : 'Meta Description (English)'}
          </label>
          <textarea
            value={form.description_en || ''}
            onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
            placeholder="Brief description for search results"
            rows={2}
            maxLength={160}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 text-right">
            {form.description_en?.length || 0}/160
          </p>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
            {language === 'ar' ? 'الوصف (عربي)' : 'Meta Description (Arabic)'}
          </label>
          <textarea
            value={form.description_ar || ''}
            onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))}
            placeholder="وصف موجز لنتائج البحث"
            rows={2}
            maxLength={160}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none dir=rtl"
          />
        </div>
      </div>

      {/* OG Tags */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <h4 className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          {language === 'ar' ? 'وسوم التواصل الاجتماعي (Open Graph)' : 'Social / Open Graph Tags'}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'OG العنوان (EN)' : 'OG Title (English)'}
            </label>
            <input
              type="text"
              value={form.og_title_en || ''}
              onChange={e => setForm(f => ({ ...f, og_title_en: e.target.value }))}
              placeholder="Title for social shares"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'OG العنوان (عربي)' : 'OG Title (Arabic)'}
            </label>
            <input
              type="text"
              value={form.og_title_ar || ''}
              onChange={e => setForm(f => ({ ...f, og_title_ar: e.target.value }))}
              placeholder="العنوان للمشاركات الاجتماعية"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'OG الوصف (EN)' : 'OG Description (English)'}
            </label>
            <textarea
              value={form.og_description_en || ''}
              onChange={e => setForm(f => ({ ...f, og_description_en: e.target.value }))}
              placeholder="Description for social shares"
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
              {language === 'ar' ? 'OG الوصف (عربي)' : 'OG Description (Arabic)'}
            </label>
            <textarea
              value={form.og_description_ar || ''}
              onChange={e => setForm(f => ({ ...f, og_description_ar: e.target.value }))}
              placeholder="الوصف للمشاركات الاجتماعية"
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none dir=rtl"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
            {language === 'ar' ? 'OG صورة' : 'OG Image URL'}
          </label>
          <input
            type="url"
            value={form.og_image_url || ''}
            onChange={e => setForm(f => ({ ...f, og_image_url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* Canonical URL */}
      <div>
        <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
          {language === 'ar' ? 'الرابط الأساسي (Canonical)' : 'Canonical URL'}
        </label>
        <input
          type="url"
          value={form.canonical_url || ''}
          onChange={e => setForm(f => ({ ...f, canonical_url: e.target.value }))}
          placeholder="https://dahab.com/page-slug"
          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
        />
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
          {language === 'ar' ? 'اتركه فارغاً لاستخدام الرابط الافتراضي' : 'Leave empty to use the default URL'}
        </p>
      </div>

      {/* Noindex toggle */}
      <div className="flex items-center gap-3 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.noindex === 1}
            onChange={toggleNoindex}
            className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--accent-primary)]"
          />
          <span className="text-xs text-[var(--text-secondary)]">
            {language === 'ar' ? 'noindex — إخفاء الصفحة من البحث' : 'noindex — hide page from search'}
          </span>
        </label>
        {form.noindex === 1 && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
            {t('cms.noindexActive')}
          </span>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-colors"
        >
          {saving ? t('cms.saving') : t('cms.saveSeo')}
        </button>
      </div>
    </div>
  );
};
