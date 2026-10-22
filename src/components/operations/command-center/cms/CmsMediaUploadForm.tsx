import React, { useState } from 'react';
import { Image } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { ClickableCard } from '../../../common/ClickableCard';
import { deriveMediaFilename } from './api';
import type { MediaAsset } from './types';

export function MediaUploadForm({
  onSave,
  onSaveFile,
  onCancel,
  saving,
  maxUploadMB = 5,
}: {
  onSave: (data: Partial<MediaAsset>) => void;
  onSaveFile: (data: { dataUrl: string; filename: string; alt_en?: string; alt_ar?: string; category?: string }) => void;
  onCancel: () => void;
  saving: boolean;
  maxUploadMB?: number;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [form, setForm] = useState({
    url: '',
    filename: '',
    alt_en: '',
    alt_ar: '',
    caption_en: '',
    caption_ar: '',
    category: 'general',
    credit: '',
    tags: '',
  });
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Only image files are supported');
      return;
    }
    if (file.size > maxUploadMB * 1024 * 1024) {
      alert(`File too large. Maximum: ${maxUploadMB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setForm({ ...form, filename: file.name, url: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSaveUrl = () => {
    onSave({
      original_url: form.url,
      filename: form.filename || deriveMediaFilename(form.url),
      alt_en: form.alt_en,
      alt_ar: form.alt_ar,
      caption_en: form.caption_en,
      caption_ar: form.caption_ar,
      category: form.category,
      credit: form.credit,
      tags: form.tags,
      mime_type: form.url.includes('.png') ? 'image/png' : form.url.includes('.gif') ? 'image/gif' : 'image/jpeg',
    });
  };

  const handleSaveFileUpload = () => {
    if (!preview) return;
    onSaveFile({
      dataUrl: preview,
      filename: form.filename || 'media-upload',
      alt_en: form.alt_en,
      alt_ar: form.alt_ar,
      category: form.category,
    });
  };

  return (
    <div className="p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--accent-primary)]/30 space-y-3">
      <h4 className="text-xs font-bold text-[var(--accent-primary)]">
        {t('cmd.addNewMedia')}
      </h4>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
            mode === 'url'
              ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
              : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
          }`}
        >
          {t('cmd.uRL')}
        </button>
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
            mode === 'file'
              ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
              : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
          }`}
        >
          {t('cmd.uploadFile')}
        </button>
      </div>

      {mode === 'url' ? (
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">URL *</span>
          <input
            type="url"
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
            placeholder="https://cdn.example.com/photo.jpg"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
      ) : (
        <ClickableCard
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('cms-file-input')?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
            dragOver
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
              : preview
                ? 'border-[var(--accent-primary)]/30 bg-[var(--btn-util-bg)]'
                : 'border-[var(--border-subtle)] bg-[var(--btn-util-bg)] hover:border-[var(--accent-primary)]/50'
          }`}
        >
          <input
            id="cms-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          {preview ? (
            <img src={preview} alt="" className="max-h-32 mx-auto rounded-lg" />
          ) : (
            <>
              <Image className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
              <div className="text-xs text-[var(--text-muted)]">
                {t('cmd.dropImageHereOr')}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">{t('cmd.uploadLimits', { max: maxUploadMB })}</div>
            </>
          )}
        </ClickableCard>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Filename</span>
          <input
            type="text"
            value={form.filename}
            onChange={e => setForm({ ...form, filename: e.target.value })}
            placeholder="blue-hole-dahab.jpg"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Category</span>
          <select
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
          >
            {['general', 'destination', 'activity', 'gallery', 'hero', 'programme', 'story', 'ui'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Alt Text (EN)</span>
          <input
            type="text"
            value={form.alt_en}
            onChange={e => setForm({ ...form, alt_en: e.target.value })}
            placeholder="Blue Hole in Dahab, Sinai"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Alt Text (AR)</span>
          <input
            type="text"
            value={form.alt_ar}
            onChange={e => setForm({ ...form, alt_ar: e.target.value })}
            placeholder="البلو هول في دهب، سيناء"
            dir="rtl"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Caption (EN)</span>
          <input
            type="text"
            value={form.caption_en}
            onChange={e => setForm({ ...form, caption_en: e.target.value })}
            placeholder="Optional caption"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Credit</span>
          <input
            type="text"
            value={form.credit}
            onChange={e => setForm({ ...form, credit: e.target.value })}
            placeholder="Photographer name"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Tags (comma-separated)</span>
        <input
          type="text"
          value={form.tags}
          onChange={e => setForm({ ...form, tags: e.target.value })}
          placeholder="dahab, blue hole, diving, sinai"
          className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
        />
      </div>

      {mode === 'url' && form.url && (
        <img src={form.url} alt="" className="w-full h-32 object-cover rounded-lg" />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={mode === 'url' ? handleSaveUrl : handleSaveFileUpload}
          disabled={(mode === 'url' && !form.url) || (mode === 'file' && !preview) || saving}
          className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold hover:bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
        >
          {saving ? '...' : (t('cmd.addMedia-2'))}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-bold hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          {t('intel.cancel')}
        </button>
      </div>
    </div>
  );
}
