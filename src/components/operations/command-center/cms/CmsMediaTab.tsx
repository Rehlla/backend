import React, { useState, useEffect, useCallback } from 'react';
import { Image, Search, Plus, Edit3 } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { ClickableCard } from '../../../common/ClickableCard';
import { cmsFetch } from './api';
import type { MediaAsset } from './types';
import { MediaUploadForm } from './CmsMediaUploadForm';
import { MediaEditModal } from './CmsMediaEditModal';

export function MediaTab() {
  const { t } = useLanguage();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MediaAsset>>({});
  const [saving, setSaving] = useState(false);
  const [maxUploadMB, setMaxUploadMB] = useState(5);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cmsFetch('/media');
      setMedia(data.media || []);
      if (typeof data.maxUploadMB === 'number') setMaxUploadMB(data.maxUploadMB);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  const categories = [...new Set(media.map(m => m.category))];
  const filteredMedia = media.filter(m => {
    const matchesSearch = !searchQuery ||
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.alt_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || m.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddMedia = async (data: Partial<MediaAsset>) => {
    try {
      setSaving(true);
      const result = await cmsFetch('/media', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setMedia(prev => [result.asset, ...prev]);
      setShowUpload(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMediaFile = async (data: { dataUrl: string; filename: string; alt_en?: string; alt_ar?: string; category?: string }) => {
    try {
      setSaving(true);
      const result = await cmsFetch('/media/upload', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setMedia(prev => [result.asset, ...prev]);
      setShowUpload(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMedia = async (id: string, data: Partial<MediaAsset>) => {
    try {
      setSaving(true);
      const result = await cmsFetch(`/media/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      // The PATCH response is the bare row (no usage rollup) — merge over the
      // list entry so the "used in" badge survives an edit.
      setMedia(prev => prev.map(m => (m.id === id ? { ...m, ...result.asset } : m)));
      setSelectedAsset(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (!confirm(t('cmd.areYouSureYou'))) return;
    try {
      await cmsFetch(`/media/${id}`, { method: 'DELETE' });
      setMedia(prev => prev.filter(m => m.id !== id));
      setSelectedAsset(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (bytes == null || bytes <= 0) return '\u2014';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {t('cmd.mediaLibrary')}
        </h3>
        <button
          type="button"
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          {t('cmd.addMedia')}
        </button>
      </div>

      {showUpload && (
        <MediaUploadForm
          onSave={handleAddMedia}
          onSaveFile={handleAddMediaFile}
          onCancel={() => setShowUpload(false)}
          saving={saving}
          maxUploadMB={maxUploadMB}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('cmd.searchMedia')}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {[{ key: 'all', label: 'All' }, ...categories.map(c => ({ key: c, label: c }))].map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setFilterCategory(cat.key)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
                filterCategory === cat.key
                  ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
                  : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
        <span>{filteredMedia.length} {t('cmd.of')} {media.length} {t('cmd.assets')}</span>
        <span>{formatFileSize(media.reduce((sum, m) => sum + m.file_size, 0))} {t('cmd.totalLower')}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <div className="text-sm text-[var(--text-muted)]">
            {searchQuery || filterCategory !== 'all'
              ? (t('cmd.noMatchingAssets'))
              : (t('cmd.noMediaAssetsRegistered'))
            }
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredMedia.map(asset => (
            <ClickableCard
              key={asset.id}
              onClick={() => { setSelectedAsset(asset); setEditForm(asset); }}
              className="rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] overflow-hidden hover:border-[var(--accent-primary)]/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] group"
            >
              {asset.original_url ? (
                <div className="relative">
                  <img src={asset.original_url} alt={asset.alt_en || ''} className="w-full h-32 object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Edit3 className="w-5 h-5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-32 bg-[var(--btn-util-bg)] flex items-center justify-center">
                  <Image className="w-8 h-8 text-[var(--text-muted)]" />
                </div>
              )}
              <div className="p-2">
                <div className="text-[11px] font-semibold text-white truncate">{asset.filename || 'Untitled'}</div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span>{asset.category}</span>
                  <span>{formatFileSize(asset.file_size)}</span>
                  {(asset.usedCount || 0) > 0 && (
                    <span className="px-1.5 py-px rounded-full bg-green-500/20 text-green-300 border border-green-500/30 font-bold">
                      {t('cmd.usedIn')} {asset.usedCount}x
                    </span>
                  )}
                </div>
              </div>
            </ClickableCard>
          ))}
        </div>
      )}

      {selectedAsset && (
        <MediaEditModal
          asset={selectedAsset}
          form={editForm}
          onFormChange={setEditForm}
          onSave={() => handleUpdateMedia(selectedAsset.id, editForm)}
          onDelete={() => handleDeleteMedia(selectedAsset.id)}
          onClose={() => setSelectedAsset(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
