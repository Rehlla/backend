import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import type { MediaAsset } from './types';

export function MediaEditModal({
  asset,
  form,
  onFormChange,
  onSave,
  onDelete,
  onClose,
  saving,
}: {
  asset: MediaAsset;
  form: Partial<MediaAsset>;
  onFormChange: (f: Partial<MediaAsset>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {t('cmd.editMedia')}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {form.original_url && (
          <div>
            <div
              className="relative rounded-xl overflow-hidden cursor-crosshair"
              title={t('cmd.focalPointHint')}
              onClick={e => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const fx = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                const fy = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                onFormChange({
                  ...form,
                  focal_x: Math.min(100, Math.max(0, fx)),
                  focal_y: Math.min(100, Math.max(0, fy)),
                });
              }}
            >
              <img src={form.original_url} alt="" className="w-full h-48 object-cover rounded-xl" />
              <span
                className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white bg-[var(--accent-primary)]/70 pointer-events-none"
                style={{
                  left: `${form.focal_x ?? 50}%`,
                  top: `${form.focal_y ?? 50}%`,
                }}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="font-bold uppercase">{t('cmd.focalPoint')}: {form.focal_x ?? 50}% / {form.focal_y ?? 50}%</span>
              <button
                type="button"
                onClick={() => onFormChange({ ...form, focal_x: 50, focal_y: 50 })}
                className="underline hover:text-white cursor-pointer"
              >
                {t('cmd.reset')}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('cmd.focalPointHint')}</p>
          </div>
        )}

        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">URL</span>
          <input
            type="url"
            value={form.original_url || ''}
            onChange={e => onFormChange({ ...form, original_url: e.target.value })}
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Filename</span>
            <input
              type="text"
              value={form.filename || ''}
              onChange={e => onFormChange({ ...form, filename: e.target.value })}
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Category</span>
            <select
              value={form.category || 'general'}
              onChange={e => onFormChange({ ...form, category: e.target.value })}
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            >
              {['general', 'destination', 'activity', 'gallery', 'hero', 'programme', 'story', 'ui'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Alt Text (EN)</span>
            <input
              type="text"
              value={form.alt_en || ''}
              onChange={e => onFormChange({ ...form, alt_en: e.target.value })}
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Alt Text (AR)</span>
            <input
              type="text"
              value={form.alt_ar || ''}
              onChange={e => onFormChange({ ...form, alt_ar: e.target.value })}
              dir="rtl"
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Caption (EN)</span>
            <input
              type="text"
              value={form.caption_en || ''}
              onChange={e => onFormChange({ ...form, caption_en: e.target.value })}
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Caption (AR)</span>
            <input
              type="text"
              value={form.caption_ar || ''}
              onChange={e => onFormChange({ ...form, caption_ar: e.target.value })}
              dir="rtl"
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Credit</span>
            <input
              type="text"
              value={form.credit || ''}
              onChange={e => onFormChange({ ...form, credit: e.target.value })}
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Tags</span>
            <input
              type="text"
              value={form.tags || ''}
              onChange={e => onFormChange({ ...form, tags: e.target.value })}
              className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
          <span>ID: {asset.id}</span>
          <span>{asset.width}×{asset.height}px</span>
          <span>{asset.mime_type}</span>
          <span>{t('cmd.usedIn')}: {asset.usedCount ?? asset.usage_count ?? 0}x</span>
          <span>{new Date(asset.created_at).toLocaleDateString()}</span>
        </div>

        {(asset.variants?.length || 0) > 0 && (
          <div className="text-[11px] text-[var(--text-muted)]">
            Responsive:{' '}
            {asset.variants!.map(v => (
              <span key={v.width} className="font-mono">
                {v.width}w ({(v.bytes / 1024).toFixed(0)}KB){' '}
              </span>
            ))}
          </div>
        )}

        {(asset.usedIn?.length || 0) > 0 && (
          <div className="rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] p-2.5 space-y-1">
            <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
              {t('cmd.usedIn')} ({asset.usedCount})
            </div>
            {asset.usedIn!.map((ref, i) => (
              <div key={i} className="text-[11px] text-white/80 truncate">
                {ref.kind === 'binding' ? (
                  <>{ref.entityType}/{ref.label} · <span className="font-mono">{ref.field}</span> · {ref.status}</>
                ) : (
                  <>page/{ref.label} · <span className="font-mono">{ref.field}</span></>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold hover:bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
          >
            {saving ? '...' : (t('cmd.saveChanges'))}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
          >
            {t('cmd.delete')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-bold hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ml-auto"
          >
            {t('intel.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
