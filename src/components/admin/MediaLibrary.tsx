import React, { useState } from 'react';
import { Image as ImageIcon, Search, Trash2, Pencil, Upload, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { api } from '../../services/api';

interface MediaAsset {
  id: string;
  filename: string;
  original_url: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  alt_en: string;
  alt_ar: string;
  caption_en: string;
  caption_ar: string;
  category: string;
  tags: string;
  usedCount: number;
  usedIn: Array<{ kind: string; entityType?: string; entityId?: string; label?: string; field?: string }>;
  variants: Array<{ width: number; url: string; bytes: number }>;
  created_at: string;
}

interface MediaLibraryProps {
  onSelect?: (url: string) => void;
  onClose?: () => void;
  selectable?: boolean;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ onSelect, onClose, selectable = false }) => {
  const { t, language, isRTL } = useLanguage();
  const { showToast } = useUI();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editAsset, setEditAsset] = useState<MediaAsset | null>(null);
  const [editForm, setEditForm] = useState({ alt_en: '', alt_ar: '', caption_en: '', caption_ar: '', category: '', tags: '' });

  const loadMedia = async () => {
    try {
      const res = await api.listAdminContentMedia();
      setMedia(res.media || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('cms.mediaLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadMedia(); }, []);

  const categories = [...new Set(media.map(m => m.category).filter(Boolean))];
  const filtered = media.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      m.filename.toLowerCase().includes(q) ||
      m.alt_en.toLowerCase().includes(q) ||
      m.alt_ar.toLowerCase().includes(q);
    const matchCat = filter === 'all' || m.category === filter;
    return matchSearch && matchCat;
  });

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast(t('cms.fileTooLarge') || 'File must be under 5MB');
        return;
      }
      setUploading(true);
      try {
        const base64 = await fileToBase64(file);
        const res = await api.uploadCmsMedia({
          dataUrl: base64,
          filename: file.name,
          category: 'uploads',
          alt_en: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          alt_ar: '',
        });
        if (res.asset) {
          setMedia(prev => [res.asset, ...prev]);
          showToast(t('cms.uploadSuccess') || 'Image uploaded');
        }
      } catch (err: any) {
        showToast(err?.message || t('cms.uploadFailed'));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCmsMedia(id);
      setMedia(prev => prev.filter(m => m.id !== id));
      setDeleteConfirm(null);
      showToast(t('cms.mediaDeleted'));
    } catch (err: any) {
      showToast(err?.message || t('cms.mediaDeleteFailed'));
    }
  };

  const startEdit = (asset: MediaAsset) => {
    setEditAsset(asset);
    setEditForm({
      alt_en: asset.alt_en || '',
      alt_ar: asset.alt_ar || '',
      caption_en: asset.caption_en || '',
      caption_ar: asset.caption_ar || '',
      category: asset.category || '',
      tags: asset.tags || '',
    });
  };

  const handleUpdate = async () => {
    if (!editAsset) return;
    try {
      const res = await api.updateCmsMedia(editAsset.id, editForm);
      if (res.asset) {
        setMedia(prev => prev.map(m => m.id === editAsset.id ? res.asset : m));
        showToast(t('cms.mediaUpdated') || 'Media updated');
        setEditAsset(null);
      }
    } catch (err: any) {
      showToast(err?.message || t('cms.updateFailed'));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('cms.mediaSearchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ key: 'all', label: t('cms.allCategories') }, ...categories.map(c => ({ key: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))].map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setFilter(cat.key)}
              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer border transition-colors ${
                filter === cat.key
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] border-[var(--accent-primary)]'
                  : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50"
        >
          {uploading ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {t('admin.uploadMedia')}
        </button>
        {selectable && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:bg-[var(--surface-container)]"
          >
            {t('cms.cancel')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <span className="w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          </div>
        )}
        {error && (
          <DahabEmptyState title={error} iconName="alert-triangle" motifName="wave-divider" />
        )}
        {!loading && !error && filtered.length === 0 && (
          <DahabEmptyState
            title={t('cms.noMediaFound')}
            description={t('cms.noMediaDescription')}
            iconName="image"
            motifName="reef-art"
          />
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map(asset => (
              <div
                key={asset.id}
                className="relative rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden group hover:border-[var(--accent-primary)]/40 transition-colors"
              >
                <div className="aspect-square bg-[var(--surface-container)]">
                  {asset.variants.length > 0
                    ? <img src={asset.variants[0].url} alt={asset.alt_en || asset.filename} className="w-full h-full object-cover" />
                    : asset.original_url
                      ? <img src={asset.original_url} alt={asset.alt_en || asset.filename} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-[var(--text-muted)]" />
                        </div>
                  }
                </div>
                {/* Used badge */}
                {asset.usedCount > 0 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/80 text-white text-[10px] font-bold">
                    {asset.usedCount}
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {onSelect && (
                    <button
                      type="button"
                      onClick={() => onSelect(asset.original_url || asset.variants?.[0]?.url || '')}
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110"
                    >
                      {t('cms.useImage')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(asset)}
                    className="p-1.5 rounded-lg bg-white/90 text-[var(--text-primary)] cursor-pointer hover:bg-white"
                    aria-label={t('cms.editMedia') || 'Edit'}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(asset.id)}
                    className="p-1.5 rounded-lg bg-white/90 text-red-500 cursor-pointer hover:bg-white"
                    aria-label={t('cms.deleteMedia')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Info */}
                <div className="p-2 space-y-1">
                  <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{asset.filename}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{formatSize(asset.file_size)} · {asset.width}×{asset.height}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditAsset(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface-container)] p-5 shadow-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{t('cms.editMedia') || 'Edit Media'}</h3>
              <button type="button" onClick={() => setEditAsset(null)} className="p-1 rounded hover:bg-[var(--surface-card)]">
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            {/* Preview */}
            <div className="mb-4 rounded-lg overflow-hidden bg-[var(--surface-card)] border border-[var(--border-subtle)]">
              {editAsset.variants.length > 0
                ? <img src={editAsset.variants[0].url} alt={editAsset.filename} className="w-full h-40 object-cover" />
                : <img src={editAsset.original_url} alt={editAsset.filename} className="w-full h-40 object-cover" />
              }
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">{language === 'ar' ? 'النص البديل (EN)' : 'Alt Text (EN)'}</label>
                  <input type="text" value={editForm.alt_en} onChange={e => setEditForm(f => ({ ...f, alt_en: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">{language === 'ar' ? 'النص البديل (AR)' : 'Alt Text (AR)'}</label>
                  <input type="text" value={editForm.alt_ar} onChange={e => setEditForm(f => ({ ...f, alt_ar: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]" dir="rtl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">{language === 'ar' ? 'الشرح (EN)' : 'Caption (EN)'}</label>
                  <input type="text" value={editForm.caption_en} onChange={e => setEditForm(f => ({ ...f, caption_en: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">{language === 'ar' ? 'الشرح (AR)' : 'Caption (AR)'}</label>
                  <input type="text" value={editForm.caption_ar} onChange={e => setEditForm(f => ({ ...f, caption_ar: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]" dir="rtl" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">{language === 'ar' ? 'الفئة' : 'Category'}</label>
                <input type="text" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} placeholder="diving, hero, food..." className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">{language === 'ar' ? 'الوسوم' : 'Tags'}</label>
                <input type="text" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="reef, sunset, adventure..." className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setEditAsset(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                {t('cms.cancel')}
              </button>
              <button type="button" onClick={handleUpdate} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] hover:brightness-110">
                {t('cms.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-container)] p-5 shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">{t('cms.deleteMediaConfirm')}</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">{t('cms.deleteMediaWarning')}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                {t('cms.cancel')}
              </button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer bg-red-500 text-white hover:brightness-110">
                {t('cms.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
