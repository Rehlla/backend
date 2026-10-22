import React, { useState, useEffect, useCallback } from 'react';
import { Home, Image as ImageIcon, ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Save, X, Upload, Zap, MapPin, BookOpen, Star, Megaphone, Layout, Compass, Anchor } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { MediaLibrary } from './MediaLibrary';
import { api } from '../../services/api';
import type { CmsHomepageSection } from '../../services/api';
import { HERO_VEIL_DEFAULT, HOME_SECTIONS, type HomeSectionId } from '../../shared/homeSections';

interface HomepageEditorProps {
  onBack?: () => void;
}

/**
 * Icon per section. A Record over the shared ids, so a section added to
 * src/shared/homeSections.ts cannot reach this panel iconless — and this panel
 * can no longer name a section the homepage does not render (it used to list
 * thirteen, most of them deleted).
 */
const SECTION_ICONS: Record<HomeSectionId, React.ReactNode> = {
  hero: <Home className="w-4 h-4" />,
  next_step: <Zap className="w-4 h-4" />,
  services: <Compass className="w-4 h-4" />,
  experiences: <Star className="w-4 h-4" />,
  intent: <Layout className="w-4 h-4" />,
  itineraries: <MapPin className="w-4 h-4" />,
  stories: <BookOpen className="w-4 h-4" />,
  final_cta: <Megaphone className="w-4 h-4" />,
  footer: <Anchor className="w-4 h-4" />
};

const specOf = (sectionKey: string) => HOME_SECTIONS.find(s => s.id === sectionKey);

export const HomepageEditor: React.FC<HomepageEditorProps> = ({ onBack }) => {
  const { t, language } = useLanguage();
  const { showToast } = useUI();
  const [sections, setSections] = useState<CmsHomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CmsHomepageSection>>({});
  const [saving, setSaving] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<string>('');

  const loadSections = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.getCmsHomepageAdmin();
      // Only sections the homepage actually renders. A row for a key nobody
      // draws (this table's own history) is not editable here: the panel used
      // to list thirteen of them, which is why it looked alive while editing
      // a page that no longer existed.
      setSections((json.sections || []).filter(s => specOf(s.section_key)));
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('cms.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadSections(); }, [loadSections]);

  const startEdit = (section: CmsHomepageSection) => {
    setEditingKey(section.section_key);
    setEditForm({
      id: section.id,
      section_key: section.section_key,
      title_en: section.title_en,
      title_ar: section.title_ar,
      visible: section.visible,
      sort_order: section.sort_order,
      config: { ...(section.config || {}) },
    });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditForm({});
  };

  const updateConfig = (key: string, value: any) => {
    setEditForm(f => ({
      ...f,
      config: { ...(f.config || {}), [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      const json = await api.updateCmsHomepage(editingKey, {
        title_en: editForm.title_en,
        title_ar: editForm.title_ar,
        visible: editForm.visible,
        sort_order: editForm.sort_order,
        config: editForm.config,
      });
      setSections(prev => prev.map(s => s.section_key === editingKey ? json.section : s));
      showToast(t('cms.sectionSaved'));
      cancelEdit();
    } catch (err: any) {
      showToast(err?.message || t('cms.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openMediaPicker = (target: string) => {
    setMediaPickerTarget(target);
    setShowMediaPicker(true);
  };

  const handleMediaSelect = (url: string) => {
    updateConfig(mediaPickerTarget, url);
    setShowMediaPicker(false);
    setMediaPickerTarget('');
  };

  const moveSection = async (key: string, dir: -1 | 1) => {
    const idx = sections.findIndex(s => s.section_key === key);
    if (idx < 0) return;
    const newSections = [...sections];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= newSections.length) return;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    // Update sort orders
    const updated = newSections.map((s, i) => ({ ...s, sort_order: i }));
    setSections(updated);
    // Persist each changed section
    for (const s of updated) {
      try { await api.updateCmsHomepage(s.section_key, { sort_order: s.sort_order }); } catch {}
    }
  };

  const visibleSections = sections.filter(s => s.visible === 1).sort((a, b) => a.sort_order - b.sort_order);
  const hiddenSections = sections.filter(s => s.visible !== 1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
        <div>
          <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
            {language === 'ar' ? 'تخصيص الصفحة الرئيسية' : 'Homepage Sections'}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {language === 'ar' ? 'تحكم في كل قسم بالصور والأيقونات والنصوص' : 'Control each section with images, icons & text'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[var(--text-muted)]">
            {visibleSections.length} {language === 'ar' ? 'مرئي' : 'visible'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <span className="w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          </div>
        )}
        {error && !loading && (
          <DahabEmptyState title={error} iconName="alert-triangle" motifName="wave-divider" />
        )}

        {/* Section cards */}
        {!loading && !error && visibleSections.map((section, idx) => {
          const spec = specOf(section.section_key);
          if (!spec) return null;
          const isEditing = editingKey === section.section_key;
          const cfg = isEditing ? (editForm.config || {}) : (section.config || {});
          const imageUrl = cfg.image_url || cfg.hero_image || cfg.background_image || '';

          return (
            <div
              key={section.id}
              className={`rounded-xl border bg-[var(--surface-card)] overflow-hidden transition-all ${
                isEditing
                  ? 'border-[var(--accent-primary)] shadow-lg shadow-[var(--accent-primary)]/10'
                  : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 p-3">
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => moveSection(section.section_key, -1)} disabled={idx === 0} className="p-0.5 hover:bg-[var(--surface-container)] rounded disabled:opacity-20">
                    <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                  <button type="button" onClick={() => moveSection(section.section_key, 1)} disabled={idx === visibleSections.length - 1} className="p-0.5 hover:bg-[var(--surface-container)] rounded disabled:opacity-20">
                    <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                </div>

                {/* Image preview */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--surface-container)] flex-shrink-0">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--accent-primary)]">
                      {SECTION_ICONS[spec.id]}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--accent-primary)]">
                      {SECTION_ICONS[spec.id]}
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                      {t(`cms.homeSections.${section.section_key}.label`)}
                    </span>
                  </div>
                  {/* `||` binds tighter than `?:`, so the parenthesis below is load-bearing:
                      without it the condition reads "has a title OR the UI is Arabic", which
                      shows the untitled placeholder on exactly the rows that HAVE copy. */}
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    {section.title_en || section.title_ar || (language === 'ar' ? 'بدون عنوان' : 'No title')}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--text-muted)]">#{section.sort_order}</span>
                  <button
                    type="button"
                    onClick={() => isEditing ? cancelEdit() : startEdit(section)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      isEditing
                        ? 'bg-[var(--surface-container)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        : 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] hover:brightness-110'
                    }`}
                  >
                    {isEditing ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Expanded editor */}
              {isEditing && (
                <div className="border-t border-[var(--border-subtle)] p-4 space-y-4 bg-[var(--surface-container)]/50">
                  {/* Image */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                      {language === 'ar' ? 'صورة القسم' : 'Section Image'}
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-16 rounded-lg overflow-hidden bg-[var(--surface-card)] border border-[var(--border-subtle)] flex-shrink-0">
                        {cfg.image_url ? (
                          <img src={cfg.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-[var(--text-muted)]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => openMediaPicker('image_url')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110"
                        >
                          <Upload className="w-3 h-3" />
                          {language === 'ar' ? 'اختر من المكتبة' : 'Choose from Library'}
                        </button>
                        <input
                          type="text"
                          value={cfg.image_url || ''}
                          onChange={e => updateConfig('image_url', e.target.value)}
                          placeholder="https://... or /api/media/..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Titles */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
                        {language === 'ar' ? 'العنوان (EN)' : 'Title (English)'}
                      </label>
                      <input
                        type="text"
                        value={editForm.title_en || ''}
                        onChange={e => setEditForm(f => ({ ...f, title_en: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
                        {language === 'ar' ? 'العنوان (AR)' : 'Title (Arabic)'}
                      </label>
                      <input
                        type="text"
                        value={editForm.title_ar || ''}
                        onChange={e => setEditForm(f => ({ ...f, title_ar: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  {/* Descriptions */}
                  {(spec.fields.includes('description_en') || spec.fields.includes('description_ar')) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
                          {language === 'ar' ? 'الوصف (EN)' : 'Description (EN)'}
                        </label>
                        <textarea
                          value={cfg.description_en || ''}
                          onChange={e => updateConfig('description_en', e.target.value)}
                          rows={3}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
                          {language === 'ar' ? 'الوصف (AR)' : 'Description (AR)'}
                        </label>
                        <textarea
                          value={cfg.description_ar || ''}
                          onChange={e => updateConfig('description_ar', e.target.value)}
                          rows={3}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                          dir="rtl"
                        />
                      </div>
                    </div>
                  )}

                  {/* No CTA fields: the sections this panel edits take their
                      button copy from translations, so a CTA input here would
                      write a value nothing reads. */}

                  {/* Overlay opacity (hero only) */}
                  {section.section_key === 'hero' && (
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {language === 'ar' ? 'شفافية الطبقات' : 'Overlay Opacity'}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={cfg.overlay_opacity ?? HERO_VEIL_DEFAULT}
                        onChange={e => updateConfig('overlay_opacity', parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs text-[var(--text-muted)] w-8 text-right">{cfg.overlay_opacity ?? HERO_VEIL_DEFAULT}%</span>
                    </div>
                  )}

                  {/* Visibility + sort */}
                  <div className="flex items-center gap-4 pt-2 border-t border-[var(--border-subtle)]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.visible === 1}
                        onChange={e => setEditForm(f => ({ ...f, visible: e.target.checked ? 1 : 0 }))}
                        className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--accent-primary)]"
                      />
                      <span className="text-xs font-bold text-[var(--text-secondary)]">
                        {editForm.visible === 1 ? <><Eye className="w-3 h-3 inline" /> {language === 'ar' ? 'مرئي' : 'Visible'}</> : <><EyeOff className="w-3 h-3 inline" /> {language === 'ar' ? 'مخفي' : 'Hidden'}</>}
                      </span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">{language === 'ar' ? 'الترتيب' : 'Order'}</label>
                      <input
                        type="number"
                        value={editForm.sort_order || 0}
                        onChange={e => setEditForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                        className="w-16 px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-center focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50"
                    >
                      {saving ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Save className="w-3 h-3" />}
                      {saving ? t('cms.saving') : t('cms.save')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Hidden sections */}
        {!loading && !error && hiddenSections.length > 0 && (
          <div className="space-y-2 mt-6">
            <h2 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
              {language === 'ar' ? 'الأقسام المخفية' : 'Hidden Sections'}
            </h2>
            {hiddenSections.map(section => {
              const spec = specOf(section.section_key);
              if (!spec) return null;
              return (
              <div
                key={section.id}
                className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 opacity-60 flex items-center gap-3"
              >
                <span className="text-[var(--text-muted)]">
                  {SECTION_ICONS[spec.id]}
                </span>
                <span className="text-sm font-bold text-[var(--text-secondary)] flex-1">
                  {t(`cms.homeSections.${section.section_key}.label`)}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(section)}
                  className="px-2.5 py-1 rounded-lg bg-slate-500 text-white text-xs font-bold cursor-pointer hover:brightness-110"
                >
                  {language === 'ar' ? 'تفعيل' : 'Enable'}
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Media picker modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMediaPicker(false)}>
          <div className="w-full max-w-3xl h-[70vh] rounded-2xl bg-[var(--surface-container)] shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <MediaLibrary onSelect={handleMediaSelect} onClose={() => setShowMediaPicker(false)} selectable />
          </div>
        </div>
      )}
    </div>
  );
};
