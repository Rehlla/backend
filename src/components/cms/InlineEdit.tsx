import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Inline CMS editing (?cms-edit=1).
 *
 * When a signed-in Operations/Admin user opens any static page with
 * ?cms-edit=1, every EditableText renders with an outline; clicking one
 * opens a small editor that PATCHes the page/block field directly. Saves to
 * published pages go live immediately (same rule as dashboard edits), which
 * is why Product role is excluded here — mirrors the instant-live surfaces.
 *
 * This is a usability layer, not a security boundary: the API enforces roles
 * server-side regardless.
 */

const API_BASE = '/api/admin/content';

async function cmsPatch(path: string, body: Record<string, string>): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Save failed');
  }
}

export function useCmsEditMode(): boolean {
  let signedIn = false;
  let role = '';
  try {
    // Hook rules: unconditional call; the try only guards provider absence in
    // tests/story renders outside the app tree.
    const trip = useTrip();
    signedIn = trip.isSignedIn;
    role = trip.authRole;
  } catch {
    return false;
  }
  if (!signedIn || (role !== 'Operations' && role !== 'Admin')) return false;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('cms-edit');
}

export function CmsEditBanner() {
  const editMode = useCmsEditMode();
  const { t } = useLanguage();
  if (!editMode) return null;
  const exit = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('cms-edit');
    window.history.replaceState(null, '', url.toString());
    window.location.reload();
  };
  return (
    <div className="fixed bottom-0 inset-x-0 z-[90] flex items-center justify-center gap-3 px-4 py-2 bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold">
      <span>{t('cmd.editMode')}</span>
      <button
        type="button"
        onClick={exit}
        className="px-3 py-1 rounded-lg bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
      >
        {t('cmd.exitEditMode')}
      </button>
    </div>
  );
}

interface EditableTextProps {
  kind: 'page' | 'block';
  id: string;
  field: 'title' | 'subtitle' | 'description' | 'body';
  valueEn: string;
  valueAr: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span' | 'blockquote';
  multiline?: boolean;
  className?: string;
}

/**
 * A CMS text node. Outside edit mode it renders exactly the localized string
 * in the given tag (identical output to the previous inline expression);
 * in edit mode it gets an outline and opens a bilingual editor on click.
 */
export const EditableText: React.FC<EditableTextProps> = ({
  kind,
  id,
  field,
  valueEn,
  valueAr,
  as,
  multiline,
  className,
}) => {
  const editMode = useCmsEditMode();
  const { language, t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [en, setEn] = useState(valueEn);
  const [ar, setAr] = useState(valueAr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEn(valueEn);
    setAr(valueAr);
  }, [valueEn, valueAr]);

  const display = language === 'ar' ? ar || en : en;
  const Tag = (as || 'div') as 'div';

  if (!editMode) {
    return <Tag className={className}>{display}</Tag>;
  }

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const path = kind === 'page' ? `/pages/${id}` : `/blocks/${id}`;
      await cmsPatch(path, { [`${field}_en`]: en, [`${field}_ar`]: ar });
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tag
        className={`${className || ''} rounded outline-dashed outline-2 outline-[var(--accent-primary)]/60 outline-offset-2 cursor-pointer hover:bg-[var(--accent-primary)]/10 transition-colors`}
        onClick={() => {
          setEn(valueEn);
          setAr(valueAr);
          setError(null);
          setEditing(true);
        }}
        title={`${kind}/${id} · ${field}`}
      >
        {display}
      </Tag>
      {editing && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
          onClick={() => !saving && setEditing(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-4 space-y-3 shadow-2xl"
            onClick={e => e.stopPropagation()}
            dir="ltr"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {kind}/{id} · {field}
              </span>
              <button
                type="button"
                onClick={() => !saving && setEditing(false)}
                aria-label="Close"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)]">EN</span>
              {multiline ? (
                <textarea value={en} onChange={e => setEn(e.target.value)} rows={4} className="mt-0.5 w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white" />
              ) : (
                <input value={en} onChange={e => setEn(e.target.value)} className="mt-0.5 w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)]">AR</span>
              {multiline ? (
                <textarea value={ar} onChange={e => setAr(e.target.value)} rows={4} dir="rtl" className="mt-0.5 w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white" />
              ) : (
                <input value={ar} onChange={e => setAr(e.target.value)} dir="rtl" className="mt-0.5 w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white" />
              )}
            </div>
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? '…' : t('cmd.saveChanges')}
              </button>
              <button
                type="button"
                onClick={() => !saving && setEditing(false)}
                className="px-4 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-bold cursor-pointer"
              >
                {t('intel.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
