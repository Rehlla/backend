import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Edit3, ChevronUp, ChevronDown, GripVertical
} from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { cmsFetch } from './api';
import type { CmsHomepageSection } from './types';
import { SectionConfigEditor } from './cmsHelpers';

export function HomepageTab() {
  const { language, t } = useLanguage();
  const [sections, setSections] = useState<CmsHomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<CmsHomepageSection | null>(null);
  const [editForm, setEditForm] = useState<Partial<CmsHomepageSection>>({});
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    cmsFetch('/homepage').then(d => {
      setSections(d.sections || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleUpdateSection = async (sectionKey: string, data: Partial<CmsHomepageSection>) => {
    try {
      setSaving(true);
      const result = await cmsFetch(`/homepage/${sectionKey}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setSections(prev => prev.map(s => s.section_key === sectionKey ? result.section : s));
      setEditingSection(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = async (newSections: CmsHomepageSection[]) => {
    try {
      for (const s of newSections) {
        await cmsFetch(`/homepage/${s.section_key}`, {
          method: 'PATCH',
          body: JSON.stringify({ sort_order: s.sort_order }),
        });
      }
    } catch (err: any) {
      console.error('Reorder failed:', err);
    }
  };

  const handleReorder = async (sectionKey: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.section_key === sectionKey);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;

    const newSections = [...sections];
    [newSections[idx], newSections[newIdx]] = [newSections[newIdx], newSections[idx]];
    for (let i = 0; i < newSections.length; i++) {
      newSections[i] = { ...newSections[i], sort_order: i };
    }
    setSections(newSections);
    persistOrder(newSections);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(dragIdx, 1);
    newSections.splice(idx, 0, moved);
    for (let i = 0; i < newSections.length; i++) {
      newSections[i] = { ...newSections[i], sort_order: i };
    }
    setSections(newSections);
    setDragIdx(null);
    setDragOverIdx(null);
    persistOrder(newSections);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {t('cmd.homepageSections')}
        </h3>
        <span className="text-[11px] text-[var(--text-muted)]">
          {t('cmd.dragToReorder')}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          {t('cmd.noHomepageSectionsConfigured')}
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section, idx) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl bg-[var(--btn-util-bg)] border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                dragIdx === idx
                  ? 'opacity-50 border-[var(--accent-primary)]/50'
                  : dragOverIdx === idx
                    ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/5'
                    : 'border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 cursor-grab" />
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${section.visible ? 'bg-[var(--accent-primary)]' : 'bg-[var(--btn-util-bg)]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">
                    {language === 'ar' ? section.title_ar : section.title_en}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {section.section_key} · {section.visible ? (t('cmd.visible')) : (t('cmd.hidden'))}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {idx > 0 && (
                    <button type="button" onClick={() => handleReorder(section.section_key, 'up')} aria-label="Move section up" className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  )}
                  {idx < sections.length - 1 && (
                    <button type="button" onClick={() => handleReorder(section.section_key, 'down')} aria-label="Move section down" className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleUpdateSection(section.section_key, { visible: section.visible ? 0 : 1 })}
                    className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"
                  >
                    {section.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingSection(section); setEditForm(section); }}
                    className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {editingSection?.section_key === section.section_key && (
                <div className="px-3 pb-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Title (EN)</span>
                      <input
                        type="text"
                        value={editForm.title_en || ''}
                        onChange={e => setEditForm({ ...editForm, title_en: e.target.value })}
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Title (AR)</span>
                      <input
                        type="text"
                        value={editForm.title_ar || ''}
                        onChange={e => setEditForm({ ...editForm, title_ar: e.target.value })}
                        dir="rtl"
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Sort Order</span>
                      <input
                        type="number"
                        value={editForm.sort_order ?? 0}
                        onChange={e => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) || 0 })}
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Section Content</span>
                      <div className="mt-0.5">
                        <SectionConfigEditor
                          sectionKey={section.section_key}
                          config={editForm.config || {}}
                          onChange={cfg => setEditForm({ ...editForm, config: cfg })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Advanced — Config (JSON)</span>
                    <textarea
                      value={typeof editForm.config === 'object' ? JSON.stringify(editForm.config, null, 2) : (editForm.config || '{}')}
                      onChange={e => {
                        try {
                          setEditForm({ ...editForm, config: JSON.parse(e.target.value) });
                        } catch {}
                      }}
                      rows={3}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] text-white font-mono focus:border-[var(--accent-primary)]/50 focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateSection(section.section_key, editForm)}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold hover:bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
                    >
                      {saving ? '...' : (t('cmd.save'))}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSection(null)}
                      className="px-4 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-bold hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                    >
                      {t('intel.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
