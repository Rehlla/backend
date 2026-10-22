import React, { useState, useEffect, useCallback } from 'react';
import { Search, Edit3, X, Image as ImageIcon, CalendarClock, Trash2, Eye, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { cmsFetch } from './api';
import type {
  CatalogEntityType,
  CatalogFieldSpec,
  CatalogBinding,
  CatalogItemSummary,
  MediaAsset,
  Revision,
} from './types';

const LIST_LIKE = ['amenities', 'features', 'includes', 'excludes', 'preparation'];
const AREA_LIKE = ['description', 'policies', 'tagline', 'note', 'best_for', 'highlights', 'atmosphere'];

const ALL_TYPES: CatalogEntityType[] = [
  'accommodation', 'rental', 'activity', 'place', 'area',
  'dining_venue', 'supplier', 'sku', 'offer',
];

function prettyField(field: string): { base: string; lang: 'EN' | 'AR' | null } {
  let lang: 'EN' | 'AR' | null = null;
  let base = field;
  if (field.endsWith('_en')) { lang = 'EN'; base = field.slice(0, -3); }
  else if (field.endsWith('_ar')) { lang = 'AR'; base = field.slice(0, -3); }
  base = base.replace(/_media_ids?$/, '').replace(/_/g, ' ');
  return { base, lang };
}

function isTextarea(field: string): boolean {
  return LIST_LIKE.some(k => field.includes(k)) || AREA_LIKE.some(k => field.includes(k));
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    published: 'bg-green-500/20 text-green-300 border-green-500/30',
    draft: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    archived: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

export function CatalogTab() {
  const { language, t } = useLanguage();
  const [entityType, setEntityType] = useState<CatalogEntityType>('accommodation');
  const [registry, setRegistry] = useState<Record<string, CatalogFieldSpec>>({});
  const [items, setItems] = useState<CatalogItemSummary[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [includeAll, setIncludeAll] = useState(false);
  const [loading, setLoading] = useState(true);

  // Detail / editor state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [resolved, setResolved] = useState(true);
  const [bindings, setBindings] = useState<CatalogBinding[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');

  useEffect(() => {
    cmsFetch('/bindings/registry')
      .then(data => setRegistry(data.registry || {}))
      .catch(err => console.error('Failed to load catalog registry:', err));
    cmsFetch('/media')
      .then(data => setMediaAssets(data.media || []))
      .catch(err => console.error('Failed to load media:', err));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ entityType });
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (includeAll) params.set('includeAll', 'true');
      const data = await cmsFetch(`/bindings?${params.toString()}`);
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load catalog items:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, debouncedQuery, statusFilter, includeAll]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      setActionError(null);
      const data = await cmsFetch(`/bindings/${entityType}/${encodeURIComponent(id)}`);
      const rows: CatalogBinding[] = data.bindings || [];
      setBindings(rows);
      setRevisions(data.revisions || []);
      setLabel(data.label || id);
      setResolved(data.resolved !== false);
      const next: Record<string, string> = {};
      for (const b of rows) {
        next[b.field] = b.field === 'gallery_media_ids' ? (b.value_text || '') : (b.media_id || b.value_text || '');
      }
      setForm(next);
      setScheduleAt('');
    } catch (err: any) {
      setActionError(err.message);
    }
  }, [entityType]);

  const selectItem = (id: string) => {
    setSelectedId(id);
    loadDetail(id);
  };

  const closeEditor = () => {
    setSelectedId(null);
    setBindings([]);
    setRevisions([]);
    setForm({});
    setActionError(null);
  };

  const refresh = async () => {
    if (selectedId) await loadDetail(selectedId);
    await loadItems();
  };

  const runAction = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      setSaving(true);
      setActionError(null);
      await fn();
      await refresh();
      if (done) {
        // transient inline confirmation via error slot styling would need new
        // strings; a console trace keeps the UI honest without new keys.
        console.info(`[catalog] ${done}`);
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const spec = registry[entityType];
  const mediaById = new Map(mediaAssets.map(m => [m.id, m]));
  const boundByField = new Map(bindings.map(b => [b.field, b]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={entityType}
          onChange={e => { setEntityType(e.target.value as CatalogEntityType); closeEditor(); }}
          className="px-3 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs font-bold text-white cursor-pointer"
        >
          {ALL_TYPES.map(type => {
            const s = registry[type];
            const name = s ? (language === 'ar' ? s.labelAr : s.labelEn) : type;
            return <option key={type} value={type}>{name}</option>;
          })}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('cmd.catalogSearch')}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-white placeholder:text-[var(--text-muted)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs font-bold text-white cursor-pointer"
        >
          <option value="all">all</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} />
          {t('cmd.browseFullCatalog')}
        </label>
        <span className="text-xs text-[var(--text-muted)]">{items.length}</span>
      </div>

      {actionError && !selectedId && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{actionError}</div>
      )}

      {loading ? (
        <div className="text-xs text-[var(--text-muted)]">…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl p-6 text-center">
          {t('cmd.noCatalogItems')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map(item => (
            <button
              key={item.entityId}
              type="button"
              onClick={() => selectItem(item.entityId)}
              className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                selectedId === item.entityId
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-container)] hover:border-[var(--accent-primary)]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white truncate">
                  {language === 'ar' && item.labelAr ? item.labelAr : item.label}
                </span>
                <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {item.bindingCount === 0 ? (
                  <span className="text-[11px] text-[var(--text-muted)]">{item.entityId}</span>
                ) : (
                  <>
                    {item.counts.published > 0 && statusBadge('published')}
                    {item.counts.draft > 0 && statusBadge('draft')}
                    {item.counts.archived > 0 && statusBadge('archived')}
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {item.counts.published}/{item.bindingCount}
                    </span>
                  </>
                )}
                {!item.resolved && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border border-red-500/30 bg-red-500/10 text-red-300">
                    {t('cmd.unresolvedCatalogRow')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeEditor}>
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)] flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">{label}</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">{entityType} · {selectedId}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/content/bindings/${entityType}/${encodeURIComponent(selectedId)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Published overlay JSON"
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {actionError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{actionError}</div>
              )}

              {!spec ? (
                <div className="text-xs text-[var(--text-muted)]">…</div>
              ) : (
                <>
                  {spec.textFields.map(field => {
                    const { base, lang } = prettyField(field);
                    const existing = boundByField.get(field);
                    const listHint = field.includes('amenities') || field.includes('features') ||
                      field.includes('includes') || field.includes('excludes') || field.includes('preparation');
                    return (
                      <div key={field}>
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                            {base}
                          </label>
                          {lang && (
                            <span className="px-1.5 py-px rounded text-[10px] font-bold bg-[var(--btn-util-bg)] text-[var(--text-muted)]">
                              {lang}
                            </span>
                          )}
                          {existing && statusBadge(existing.status)}
                          {listHint && (
                            <span className="text-[10px] text-[var(--text-muted)]">{t('cmd.onePerLine')}</span>
                          )}
                        </div>
                        {isTextarea(field) ? (
                          <textarea
                            value={form[field] || ''}
                            onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                            rows={3}
                            placeholder={t('cmd.clearToReset')}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white placeholder:text-[var(--text-muted)]"
                          />
                        ) : (
                          <input
                            value={form[field] || ''}
                            onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                            placeholder={t('cmd.clearToReset')}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white placeholder:text-[var(--text-muted)]"
                          />
                        )}
                      </div>
                    );
                  })}

                  {spec.mediaFields.map(field => {
                    const { base } = prettyField(field);
                    const existing = boundByField.get(field);
                    if (field === 'gallery_media_ids') {
                      const ids = (form[field] || '').split(',').map(s => s.trim()).filter(Boolean);
                      return (
                        <div key={field}>
                          <div className="flex items-center gap-2 mb-1">
                            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{base}</label>
                            {existing && statusBadge(existing.status)}
                          </div>
                          <input
                            value={form[field] || ''}
                            onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                            placeholder="MED-xxx, MED-yyy"
                            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white font-mono placeholder:text-[var(--text-muted)]"
                          />
                          {ids.length > 0 && (
                            <div className="mt-2 flex gap-2 flex-wrap">
                              {ids.map(id => {
                                const m = mediaById.get(id);
                                return m ? (
                                  <img key={id} src={m.original_url} alt={m.alt_en} className="w-16 h-16 object-cover rounded-lg border border-[var(--border-subtle)]" />
                                ) : (
                                  <span key={id} className="text-[10px] font-mono text-red-300 border border-red-500/30 rounded-lg px-2 py-1">{id}?</span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    const currentId = form[field] || '';
                    const current = currentId ? mediaById.get(currentId) : undefined;
                    return (
                      <div key={field}>
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{base}</label>
                          {existing && statusBadge(existing.status)}
                        </div>
                        <div className="flex items-center gap-2">
                          {current ? (
                            <img src={current.original_url} alt={current.alt_en} className="w-16 h-16 object-cover rounded-lg border border-[var(--border-subtle)]" />
                          ) : (
                            <span className="w-16 h-16 flex items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]">
                              <ImageIcon className="w-5 h-5" />
                            </span>
                          )}
                          <select
                            value={currentId}
                            onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                            className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white cursor-pointer"
                          >
                            <option value="">{t('cmd.noImage')}</option>
                            {mediaAssets.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.filename} ({m.category})
                              </option>
                            ))}
                          </select>
                          {currentId && (
                            <button
                              type="button"
                              onClick={() => setForm(prev => ({ ...prev, [field]: '' }))}
                              className="px-2 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white text-xs cursor-pointer"
                            >
                              {t('cmd.dismiss')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction(() => cmsFetch(`/bindings/${entityType}/${encodeURIComponent(selectedId)}`, {
                    method: 'PUT',
                    body: JSON.stringify({ fields: form }),
                  }), 'draft saved')}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 cursor-pointer disabled:opacity-50"
                >
                  {t('cmd.saveDraft')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction(() => cmsFetch(`/bindings/${entityType}/${encodeURIComponent(selectedId)}/publish`, { method: 'POST' }), 'published')}
                  className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 text-[11px] font-bold hover:bg-green-500/30 cursor-pointer disabled:opacity-50"
                >
                  {t('cmd.publish')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction(() => cmsFetch(`/bindings/${entityType}/${encodeURIComponent(selectedId)}/unpublish`, { method: 'POST' }), 'unpublished')}
                  className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold hover:text-white cursor-pointer disabled:opacity-50"
                >
                  {t('cmd.unpublish')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (!window.confirm(t('cmd.areYouSure'))) return;
                    runAction(() => cmsFetch(`/bindings/${entityType}/${encodeURIComponent(selectedId)}`, { method: 'DELETE' }), 'deleted');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 text-[11px] font-bold hover:bg-red-500/20 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  {t('cmd.delete')}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={e => setScheduleAt(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-white"
                />
                <button
                  type="button"
                  disabled={saving || !scheduleAt}
                  onClick={() => runAction(() => cmsFetch(`/bindings/${entityType}/${encodeURIComponent(selectedId)}/schedule`, {
                    method: 'POST',
                    body: JSON.stringify({ scheduledAt: new Date(scheduleAt).toISOString() }),
                  }), 'scheduled')}
                  className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold hover:text-white cursor-pointer disabled:opacity-50"
                >
                  {t('cmd.schedulePublish')}
                </button>
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
                            runAction(() => cmsFetch(`/bindings/${entityType}/${encodeURIComponent(selectedId)}/rollback`, {
                              method: 'POST',
                              body: JSON.stringify({ revisionId: rev.id }),
                            }), 'rolled back');
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
