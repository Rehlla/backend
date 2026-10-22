import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { cmsFetch } from './api';
import type { SiteInfoBundle } from '../../../../services/api';

const GROUPS = [
  { key: 'contact', fields: ['contact.phone', 'contact.email', 'contact.whatsapp', 'contact.address'] },
  { key: 'social', fields: ['social.instagram', 'social.facebook', 'social.tiktok', 'social.youtube', 'social.website'] },
  { key: 'hours', fields: ['hours.timezone', 'hours.weekday', 'hours.weekend', 'hours.holidays'] },
];

const FIELD_LABELS: Record<string, { en: string; ar: string }> = {
  'contact.phone': { en: 'Phone', ar: 'هاتف' },
  'contact.email': { en: 'Email', ar: 'بريد' },
  'contact.whatsapp': { en: 'WhatsApp', ar: 'واتساب' },
  'contact.address': { en: 'Address', ar: 'العنوان' },
  'social.instagram': { en: 'Instagram URL', ar: 'إنستجرام' },
  'social.facebook': { en: 'Facebook URL', ar: 'فيسبوك' },
  'social.tiktok': { en: 'TikTok URL', ar: 'تيك توك' },
  'social.youtube': { en: 'YouTube URL', ar: 'يوتيوب' },
  'social.website': { en: 'Website URL', ar: 'الموقع' },
  'hours.timezone': { en: 'Timezone', ar: 'المنطقة الزمنية' },
  'hours.weekday': { en: 'Weekday hours', ar: 'مواعيد أيام العمل' },
  'hours.weekend': { en: 'Weekend hours', ar: 'مواعيد العطلة' },
  'hours.holidays': { en: 'Holidays', ar: 'الإجازات' },
};

export function SiteInfoTab() {
  const { language, t } = useLanguage();
  const [info, setInfo] = useState<SiteInfoBundle | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { value: string; valueAr: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Keys the editor already typed into. A late-resolving load (StrictMode
  // double-fetch in dev, slow networks anywhere) must never clobber
  // in-progress edits with server values.
  const touchedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cmsFetch('/site-info');
      const bundle = (data.info || {}) as SiteInfoBundle;
      setInfo(bundle);
      setDrafts(prev => {
        const next: Record<string, { value: string; valueAr: string }> = {};
        for (const g of GROUPS) {
          for (const key of g.fields) {
            next[key] = touchedRef.current.has(key) && prev[key]
              ? prev[key]
              : { value: bundle[g.key]?.[key]?.value || '', valueAr: bundle[g.key]?.[key]?.valueAr || '' };
          }
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load site info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string) => {
    const draft = drafts[key];
    if (!draft) return;
    try {
      setSavingKey(key);
      setError(null);
      setNotice(null);
      await cmsFetch('/site-info', {
        method: 'PUT',
        body: JSON.stringify({ key, value: draft.value, value_ar: draft.valueAr }),
      });
      setNotice(key);
      touchedRef.current.delete(key);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading || !info) return <div className="text-xs text-[var(--text-muted)]">…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        {t('cmd.goesLiveNow')}
      </div>
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>
      )}
      {GROUPS.map(group => (
        <div key={group.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4 space-y-3">
          <h3 className="text-sm font-bold text-white capitalize">{group.key}</h3>
          {group.fields.map(key => {
            const label = FIELD_LABELS[key] || { en: key, ar: key };
            const draft = drafts[key] || { value: '', valueAr: '' };
            const savedValue = info[group.key]?.[key]?.value || '';
            const dirty = draft.value !== savedValue || draft.valueAr !== (info[group.key]?.[key]?.valueAr || '');
            return (
              <div key={key} className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_auto] gap-2 items-center">
                <span className="text-[11px] font-bold text-[var(--text-muted)]">
                  {language === 'ar' ? label.ar : label.en}
                </span>
                <input
                  value={draft.value}
                  onChange={e => { touchedRef.current.add(key); setDrafts(prev => ({ ...prev, [key]: { ...prev[key], value: e.target.value } })); }}
                  placeholder={savedValue || '—'}
                  dir="ltr"
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white placeholder:text-[var(--text-muted)]"
                />
                <input
                  value={draft.valueAr}
                  onChange={e => { touchedRef.current.add(key); setDrafts(prev => ({ ...prev, [key]: { ...prev[key], valueAr: e.target.value } })); }}
                  placeholder="AR"
                  dir="rtl"
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white placeholder:text-[var(--text-muted)]"
                />
                <button
                  type="button"
                  disabled={!dirty || savingKey === key}
                  onClick={() => save(key)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 cursor-pointer disabled:opacity-40"
                >
                  {/* Keep the label stable — a checkmark prefix confirms the save
                      without making the button unidentifiable by name. */}
                  {notice === key && '✓ '}
                  {t('cmd.saveChanges')}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
