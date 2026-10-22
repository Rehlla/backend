import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { api } from '../../services/api';
import type { CmsPageBlockWire } from '../../services/api';

interface BlocksCrudProps {
  pageId: string;
  onBack?: () => void;
}

export const BlocksCrud: React.FC<BlocksCrudProps> = ({ pageId, onBack }) => {
  const { t, language } = useLanguage();
  const { showToast } = useUI();
  const [blocks, setBlocks] = useState<CmsPageBlockWire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CmsPageBlockWire>>({
    type: 'text',
    title_en: '',
    title_ar: '',
    body_en: '',
    body_ar: '',
    visible: 1,
    sort_order: 0,
    config: {},
  });

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.listCmsBlocks(pageId);
      setBlocks(json.blocks || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('cms.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [pageId, t]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleSave = async () => {
    if (!form.title_en && !form.title_ar) {
      showToast(t('cms.titleRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, page_id: pageId };
      if (form.id) {
        const json = await api.updateCmsBlock(form.id, payload);
        setBlocks(prev => prev.map(b => b.id === form.id ? json.block : b));
        showToast(t('cms.blockSaved'));
      } else {
        const json = await api.createCmsBlock(payload);
        setBlocks(prev => [...prev, json.block]);
        showToast(t('cms.blockCreated'));
      }
      setForm({
        type: 'text',
        title_en: '',
        title_ar: '',
        body_en: '',
        body_ar: '',
        visible: 1,
        sort_order: blocks.length,
        config: {},
      });
    } catch (err: any) {
      showToast(err?.message || t('cms.blockSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('cms.deleteBlockConfirm'))) return;
    setSaving(true);
    try {
      await api.deleteCmsBlock(id);
      setBlocks(prev => prev.filter(b => b.id !== id));
      showToast(t('cms.blockDeleted'));
    } catch (err: any) {
      showToast(err?.message || t('cms.blockDeleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisible = (id: string, current: number) => {
    handleSaveBlock({ id, visible: current ? 0 : 1 });
  };

  const handleSaveBlock = async (patch: Partial<CmsPageBlockWire>) => {
    setSaving(true);
    try {
      const json = await api.updateCmsBlock(patch.id!, patch);
      setBlocks(prev => prev.map(b => b.id === patch.id ? json.block : b));
    } catch (err: any) {
      showToast(err?.message || t('cms.blockSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label={t('cms.back')}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-extrabold text-[var(--text-primary)]">{t('cms.blocksTitle')}</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {t('cms.blocksSubtitle')} ({blocks.length})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">
            {language === 'ar' ? 'الترتيب:' : 'Order:'}
          </span>
          <input
            type="number"
            value={form.sort_order || 0}
            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            className="w-16 px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-center focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="p-4">
          <DahabEmptyState
            title={error}
            iconName="alert-triangle"
            motifName="wave-divider"
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && blocks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <DahabEmptyState
            title={t('cms.noBlocksFound')}
            description={t('cms.noBlocksDescription')}
            iconName="blocks"
            motifName="topo-contour"
            actionText={t('cms.addFirstBlock')}
            onAction={() => setForm(f => ({ ...f, sort_order: 0 }))}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center h-20">
            <span className="w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && !error && blocks.length > 0 && blocks.map(block => (
          <div key={block.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] uppercase">
                  {block.type}
                </span>
                <span className="text-xs text-[var(--text-muted)]">#{block.sort_order}</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={block.visible === 1}
                    onChange={() => handleSaveBlock({ id: block.id, visible: block.visible ? 0 : 1 })}
                    className="w-3.5 h-3.5 rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/30"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">{t('cms.visible')}</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(block.id)}
                className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label={t('cms.deleteBlock')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                value={block.title_en || ''}
                onChange={e => handleSaveBlock({ id: block.id, title_en: e.target.value })}
                placeholder={t('cms.blockTitleEn')}
                className="px-2 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <input
                type="text"
                value={block.title_ar || ''}
                onChange={e => handleSaveBlock({ id: block.id, title_ar: e.target.value })}
                placeholder={t('cms.blockTitleAr')}
                className="px-2 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <textarea
                value={block.body_en || ''}
                onChange={e => handleSaveBlock({ id: block.id, body_en: e.target.value })}
                placeholder={t('cms.blockBodyEn')}
                rows={3}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
              />
              <textarea
                value={block.body_ar || ''}
                onChange={e => handleSaveBlock({ id: block.id, body_ar: e.target.value })}
                placeholder={t('cms.blockBodyAr')}
                rows={3}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none dir=rtl"
              />
            </div>
          </div>
        ))}

        {/* Add new block form */}
        <div className="rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
          <h3 className="text-xs font-extrabold text-[var(--text-primary)] mb-3 uppercase tracking-wider">
            {t('cms.newBlock')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={form.title_en || ''}
              onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
              placeholder={t('cms.blockTitleEn')}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <input
              type="text"
              value={form.title_ar || ''}
              onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
              placeholder={t('cms.blockTitleAr')}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <textarea
              value={form.body_en || ''}
              onChange={e => setForm(f => ({ ...f, body_en: e.target.value }))}
              placeholder={t('cms.blockBodyEn')}
              rows={3}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />
            <textarea
              value={form.body_ar || ''}
              onChange={e => setForm(f => ({ ...f, body_ar: e.target.value }))}
              placeholder={t('cms.blockBodyAr')}
              rows={3}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none dir=rtl"
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (!form.title_en && !form.title_ar)}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-colors"
            >
              {saving ? t('cms.saving') : t('cms.saveBlock')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
