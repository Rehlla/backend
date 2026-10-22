import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, RotateCcw, History } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useTheme, THEME_OPTIONS } from '../../../../context/ThemeContext';
import { contrastRatio, wcagBadge } from '../../../../utils/contrast';
import { cmsFetch } from './api';
import type { Revision } from './types';

interface TokenSpec {
  type: 'color' | 'font' | 'theme';
  vars: string[];
  labelEn: string;
  labelAr: string;
}

const TOKEN_ORDER = [
  'brand.accent',
  'brand.accentSecondary',
  'type.display',
  'type.body',
  'type.arabic',
  'brand.homeTheme',
];

function ContrastChip({ fg, bg }: { fg: string; bg: string }) {
  const ratio = contrastRatio(fg, bg);
  if (ratio === null) return null;
  const badge = wcagBadge(ratio);
  const colors =
    badge === 'AAA' || badge === 'AA'
      ? 'bg-green-500/20 text-green-300 border-green-500/30'
      : badge === 'AA Large'
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        : 'bg-red-500/20 text-red-300 border-red-500/30';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors}`}>
      {ratio.toFixed(1)}:1 {badge}
    </span>
  );
}

export function ThemeTab() {
  const { language, t } = useLanguage();
  const { activeTheme } = useTheme();
  const [registry, setRegistry] = useState<Record<string, TokenSpec>>({});
  const [values, setValues] = useState<Record<string, { value: string; updatedAt: string }>>({});
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Record<string, Revision[]>>({});
  // Drafts the editor already touched survive late-resolving loads (see
  // SiteInfoTab: StrictMode double-fetch in dev can otherwise wipe input).
  const touchedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cmsFetch('/theme');
      setRegistry(data.registry || {});
      setValues(data.values || {});
      setFonts(data.fonts || {});
      setDrafts(prev => {
        const next: Record<string, string> = {};
        for (const key of Object.keys(data.registry || {})) {
          next[key] = touchedRef.current.has(key) && prev[key] !== undefined
            ? prev[key]
            : (data.values?.[key]?.value || '');
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load theme tokens:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const save = (key: string) =>
    runAction(async () => {
      setSavingKey(key);
      try {
        await cmsFetch('/theme', { method: 'PUT', body: JSON.stringify({ key, value: drafts[key] }) });
        touchedRef.current.delete(key);
      } finally {
        setSavingKey(null);
      }
    });

  const reset = (key: string) =>
    runAction(async () => {
      await cmsFetch(`/theme/${encodeURIComponent(key)}`, { method: 'DELETE' });
      touchedRef.current.delete(key);
    });

  const toggleHistory = async (key: string) => {
    if (expandedHistory === key) {
      setExpandedHistory(null);
      return;
    }
    setExpandedHistory(key);
    if (!revisions[key]) {
      try {
        const data = await cmsFetch(`/theme/${encodeURIComponent(key)}/revisions`);
        setRevisions(prev => ({ ...prev, [key]: data.revisions || [] }));
      } catch (err) {
        console.error('Failed to load theme revisions:', err);
      }
    }
  };

  const rollback = (key: string, revisionId: string) =>
    runAction(async () => {
      await cmsFetch(`/theme/${encodeURIComponent(key)}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ revisionId }),
      });
      setRevisions(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });

  if (loading) return <div className="text-xs text-[var(--text-muted)]">…</div>;

  const swatches = activeTheme.swatches;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        {t('cmd.goesLiveNow')}
      </div>
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>
      )}

      {TOKEN_ORDER.filter(key => registry[key]).map(key => {
        const spec = registry[key];
        const saved = values[key]?.value || '';
        const draft = drafts[key] ?? '';
        const dirty = draft !== saved;
        return (
          <div key={key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {language === 'ar' ? spec.labelAr : spec.labelEn}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">{key}</p>
              </div>
              {saved && (
                <button
                  type="button"
                  title={t('cmd.resetToCode')}
                  onClick={() => {
                    if (!window.confirm(t('cmd.areYouSure'))) return;
                    reset(key);
                  }}
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {spec.type === 'color' && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(draft) ? draft : '#888888'}
                  onChange={e => { touchedRef.current.add(key); setDrafts(prev => ({ ...prev, [key]: e.target.value.toUpperCase() })); }}
                  className="w-12 h-9 rounded-lg border border-[var(--border-subtle)] bg-transparent cursor-pointer"
                />
                <input
                  value={draft}
                  onChange={e => { touchedRef.current.add(key); setDrafts(prev => ({ ...prev, [key]: e.target.value })); }}
                  placeholder="#10B981"
                  dir="ltr"
                  spellCheck={false}
                  className="w-32 px-3 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white font-mono placeholder:text-[var(--text-muted)]"
                />
                {draft && (
                  <span className="flex items-center gap-1.5">
                    <ContrastChip fg={draft} bg={swatches.bg} />
                    <span className="text-[10px] text-[var(--text-muted)]">vs {activeTheme.nameEn} bg</span>
                  </span>
                )}
              </div>
            )}

            {spec.type === 'font' && (
              <select
                value={draft}
                onChange={e => { touchedRef.current.add(key); setDrafts(prev => ({ ...prev, [key]: e.target.value })); }}
                className="w-full max-w-md px-3 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white cursor-pointer"
              >
                <option value="">Compiled default</option>
                {Object.entries(fonts).map(([name, stack]) => (
                  <option key={name} value={stack}>{name}</option>
                ))}
              </select>
            )}

            {spec.type === 'theme' && (
              <select
                value={draft}
                onChange={e => { touchedRef.current.add(key); setDrafts(prev => ({ ...prev, [key]: e.target.value })); }}
                className="w-full max-w-md px-3 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white cursor-pointer"
              >
                <option value="">Compiled default</option>
                {THEME_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {language === 'ar' ? opt.nameAr : opt.nameEn} ({opt.category})
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!dirty || !draft || savingKey === key}
                onClick={() => save(key)}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 cursor-pointer disabled:opacity-40"
              >
                {t('cmd.saveChanges')}
              </button>
              <button
                type="button"
                title={t('cmd.changeHistory')}
                onClick={() => toggleHistory(key)}
                className={`p-1.5 rounded-lg border cursor-pointer ${
                  expandedHistory === key
                    ? 'border-[var(--accent-primary)]/30 text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
              </button>
              {spec.vars.length > 0 && (
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{spec.vars.join(' ')}</span>
              )}
            </div>

            {expandedHistory === key && (
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                {(revisions[key] || []).length === 0 ? (
                  <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.noRevisionHistory')}</div>
                ) : (
                  revisions[key].map(rev => (
                    <div key={rev.id} className="flex items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)] truncate">
                        {rev.action} · {typeof rev.payload?.value === 'string' && rev.payload.value ? rev.payload.value : '—'} · {new Date(rev.created_at).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        title={t('cmd.rollbackToVersion')}
                        onClick={() => {
                          if (!window.confirm(t('cmd.areYouSure'))) return;
                          rollback(key, rev.id);
                        }}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-white cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
