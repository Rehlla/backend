import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Edit3, X, RotateCcw, Download, Upload, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { cmsFetch } from './api';
import type { SiteStringItem, SiteStringGroup, Revision } from './types';

const PAGE_SIZE = 100;

export function StringsTab() {
  const { language, t } = useLanguage();
  const [groups, setGroups] = useState<SiteStringGroup[]>([]);
  const [totalKeys, setTotalKeys] = useState(0);
  const [customizedKeys, setCustomizedKeys] = useState(0);
  const [items, setItems] = useState<SiteStringItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [customizedOnly, setCustomizedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<SiteStringItem | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [valueEn, setValueEn] = useState('');
  const [valueAr, setValueAr] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cmsFetch('/strings/groups')
      .then(data => {
        setGroups(data.groups || []);
        setTotalKeys(data.totalKeys || 0);
        setCustomizedKeys(data.customizedKeys || 0);
      })
      .catch(err => console.error('Failed to load string groups:', err));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQuery(query); setOffset(0); }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
      if (groupFilter) params.set('group', groupFilter);
      if (customizedOnly) params.set('customizedOnly', 'true');
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      const data = await cmsFetch(`/strings?${params.toString()}`);
      setItems(data.strings || []);
      setTotal(data.total || 0);
      if (data.groups) {
        setGroups(data.groups);
        setTotalKeys(data.groups.reduce((n: number, g: SiteStringGroup) => n + g.count, 0));
        setCustomizedKeys(data.groups.reduce((n: number, g: SiteStringGroup) => n + g.customized, 0));
      }
    } catch (err) {
      console.error('Failed to load strings:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, groupFilter, customizedOnly, offset]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const loadDetail = useCallback(async (key: string) => {
    try {
      setActionError(null);
      setNotice(null);
      const data = await cmsFetch(`/strings/${encodeURIComponent(key)}`);
      const s: SiteStringItem = data.string;
      setDetail(s);
      setValueEn(s.override_en || s.code_en);
      setValueAr(s.override_ar || s.code_ar);
      setRevisions(data.revisions || []);
    } catch (err: any) {
      setActionError(err.message);
    }
  }, []);

  const selectItem = (key: string) => {
    setSelectedKey(key);
    loadDetail(key);
  };

  const closeEditor = () => {
    setSelectedKey(null);
    setDetail(null);
    setRevisions([]);
    setActionError(null);
    setNotice(null);
  };

  const refresh = async () => {
    if (selectedKey) await loadDetail(selectedKey);
    await loadItems();
  };

  const runAction = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      setSaving(true);
      setActionError(null);
      setNotice(null);
      await fn();
      setNotice(ok);
      await refresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await cmsFetch('/strings/export');
      const blob = new Blob([JSON.stringify({ exportedAt: data.exportedAt, strings: data.strings }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dahab-strings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      setSaving(true);
      setActionError(null);
      setNotice(null);
      const text = await file.text();
      const parsed = JSON.parse(text);
      const strings = parsed.strings && typeof parsed.strings === 'object' ? parsed.strings : parsed;
      const data = await cmsFetch('/strings/import', {
        method: 'POST',
        body: JSON.stringify({ strings }),
      });
      const parts = [`${data.updated} updated`];
      if (data.skippedUnknown?.length) parts.push(`${data.skippedUnknown.length} unknown keys skipped`);
      if (data.failed?.length) parts.push(`${data.failed.length} failed`);
      setNotice(parts.join(' · '));
      await refresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={groupFilter}
          onChange={e => { setGroupFilter(e.target.value); setOffset(0); }}
          className="px-3 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs font-bold text-white cursor-pointer max-w-[220px]"
        >
          <option value="">all groups ({totalKeys})</option>
          {groups.map(g => (
            <option key={g.group} value={g.group}>
              {g.group} ({g.customized}/{g.count})
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('cmd.searchStrings')}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-white placeholder:text-[var(--text-muted)]"
          />
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input type="checkbox" checked={customizedOnly} onChange={e => { setCustomizedOnly(e.target.checked); setOffset(0); }} />
          {t('cmd.customizedOnly')} ({customizedKeys})
        </label>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold hover:text-white cursor-pointer"
        >
          <Download className="w-3 h-3" />
          {t('cmd.exportJson')}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold hover:text-white cursor-pointer disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {t('cmd.importJson')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
          }}
        />
      </div>

      {notice && !selectedKey && (
        <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300">{notice}</div>
      )}

      {loading ? (
        <div className="text-xs text-[var(--text-muted)]">…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl p-6 text-center">
          {t('cmd.noStringsFound')}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {items.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => selectItem(item.key)}
                className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  selectedKey === item.key
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-container)] hover:border-[var(--accent-primary)]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">{item.key}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.customized && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-500/20 text-green-300 border-green-500/30">
                        live override
                      </span>
                    )}
                    <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </span>
                </div>
                <div className="mt-1 text-xs text-white truncate">
                  {language === 'ar' ? item.value_ar : item.value_en}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate" dir={language === 'ar' ? 'ltr' : 'rtl'}>
                  {language === 'ar' ? item.value_en : item.value_ar}
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] cursor-pointer disabled:opacity-40"
              >
                ←
              </button>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(o => o + PAGE_SIZE)}
                className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] cursor-pointer disabled:opacity-40"
              >
                →
              </button>
            </span>
          </div>
        </>
      )}

      {selectedKey && detail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeEditor}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)] flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-mono font-bold text-white break-all">{detail.key}</h3>
                <p className="text-[11px] text-[var(--text-muted)]">{detail.group}{detail.customized ? ' · live override' : ''}</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {actionError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{actionError}</div>
              )}
              {notice && (
                <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300">{notice}</div>
              )}
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {t('cmd.goesLiveNow')}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide">EN</label>
                <textarea
                  value={valueEn}
                  onChange={e => setValueEn(e.target.value)}
                  rows={3}
                  dir="ltr"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white"
                />
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  {t('cmd.codeDefault')}: <span className="text-white/70">{detail.code_en}</span>
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide">AR</label>
                <textarea
                  value={valueAr}
                  onChange={e => setValueAr(e.target.value)}
                  rows={3}
                  dir="rtl"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white"
                />
                <p className="mt-1 text-[11px] text-[var(--text-muted)]" dir="rtl">
                  {t('cmd.codeDefault')}: <span className="text-white/70">{detail.code_ar}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction(() => cmsFetch(`/strings/${encodeURIComponent(selectedKey)}`, {
                    method: 'PUT',
                    body: JSON.stringify({ value_en: valueEn, value_ar: valueAr }),
                  }), 'Published live.')}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 cursor-pointer disabled:opacity-50"
                >
                  {t('cmd.saveChanges')}
                </button>
                {detail.customized && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (!window.confirm(t('cmd.areYouSure'))) return;
                      runAction(() => cmsFetch(`/strings/${encodeURIComponent(selectedKey)}`, { method: 'DELETE' }), 'Reset to code.');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    {t('cmd.resetToCode')}
                  </button>
                )}
              </div>

              {revisions.length > 0 && (
                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <h4 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                    {t('cmd.changeHistory')}
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {revisions.map(rev => (
                      <div key={rev.id} className="flex items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-muted)]">
                          {rev.action} · {rev.actor_name || rev.actor_id || 'system'} · {new Date(rev.created_at).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          title={t('cmd.rollbackToVersion')}
                          onClick={() => {
                            if (!window.confirm(t('cmd.areYouSure'))) return;
                            runAction(() => cmsFetch(`/strings/${encodeURIComponent(selectedKey)}/rollback`, {
                              method: 'POST',
                              body: JSON.stringify({ revisionId: rev.id }),
                            }), 'Rolled back.');
                          }}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-white cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
