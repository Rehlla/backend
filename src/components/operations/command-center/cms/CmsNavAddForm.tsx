import React, { useState } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import type { NavItem } from './types';

export function NavAddForm({
  onSave,
  onCancel,
  saving,
  menuLabel,
}: {
  onSave: (data: Partial<NavItem>) => void;
  onCancel: () => void;
  saving: boolean;
  menuLabel: string;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    label_en: '',
    label_ar: '',
    route: '',
    external_url: '',
    visible: 1,
    open_in_new: 0,
  });

  return (
    <div className="p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--accent-primary)]/30 space-y-3">
      <h4 className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-2">
        {t('cmd.addNavigationLink')}
        <span className="text-[10px] font-normal text-[var(--text-muted)]">
          · {t('cmd.addingToMenu')} {menuLabel}
        </span>
      </h4>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Label (EN) *</span>
          <input
            type="text"
            value={form.label_en}
            onChange={e => setForm({ ...form, label_en: e.target.value })}
            placeholder="Explore"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Label (AR) *</span>
          <input
            type="text"
            value={form.label_ar}
            onChange={e => setForm({ ...form, label_ar: e.target.value })}
            placeholder="اكتشف"
            dir="rtl"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Internal Route</span>
          <input
            type="text"
            value={form.route}
            onChange={e => setForm({ ...form, route: e.target.value })}
            placeholder="/explore"
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">External URL</span>
          <input
            type="url"
            value={form.external_url}
            onChange={e => setForm({ ...form, external_url: e.target.value })}
            placeholder="https://..."
            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={form.visible === 1}
            onChange={e => setForm({ ...form, visible: e.target.checked ? 1 : 0 })}
            className="rounded"
          />
          {t('cmd.visible')}
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={form.open_in_new === 1}
            onChange={e => setForm({ ...form, open_in_new: e.target.checked ? 1 : 0 })}
            className="rounded"
          />
          {t('cmd.openInNewTab')}
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={!form.label_en || !form.label_ar || saving}
          className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold hover:bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
        >
          {saving ? '...' : t('cmd.addNavigationLink')}
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
