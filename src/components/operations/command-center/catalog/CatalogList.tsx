import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Eye, EyeOff, Layers, Plus, Search, Send, Tag } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogBulkAction, CatalogEnvelope, CatalogScope, CatalogStatus, CatalogTypeSchema } from '../../../../types/catalog';
import { DataTable, SectionHeader, SkeletonTable } from '../ui';
import { NoticeBar, buttonClass, dangerButtonClass, formatWhen, inputClass, primaryButtonClass, useReasonPrompt } from '../control/controlShared';
import { useSuppliers } from './FormEngine';
import { typeIcon } from './CatalogHome';
import {
  CompletenessBar, STATUSES, StatusChip, allFields, bodyFromValues, formatEGP, getValue, isPriceJump, pickText, priceFieldKey, useCatalogRunner,
} from './catalogShared';

/**
 * The list for one type: search, status chips, a supplier filter, a
 * completeness bar per row, quick actions on hover (publish/hide, duplicate,
 * edit price) and bulk actions with a mandatory reason.
 */

const PAGE = 50;

export interface CatalogListProps {
  scope: CatalogScope;
  schema: CatalogTypeSchema;
  initialStatus?: CatalogStatus;
  canManage: boolean;
  canPublish: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
}

type Row = CatalogEnvelope;

export function CatalogList({ scope, schema, initialStatus, canManage, canPublish, onOpen, onNew, onBack }: CatalogListProps) {
  const { t, language } = useLanguage();
  const type = schema.type;
  const priceKey = priceFieldKey(schema) ?? 'priceFromEGP';
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<CatalogStatus | ''>(initialStatus ?? '');
  const [supplierId, setSupplierId] = useState('');
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pricing, setPricing] = useState<{ id: string; value: string } | null>(null);
  const [bulkPrice, setBulkPrice] = useState('');
  const [tick, setTick] = useState(0);
  const { run, busy, notice, clearNotice } = useCatalogRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const suppliers = useSuppliers();
  const showSupplierFilter = scope === 'staff' && (schema.filters ?? ['supplierId']).includes('supplierId');
  // Other schema filters that are select fields (e.g. hotel `area`) get a dropdown.
  const selectFilters = useMemo(
    () => (schema.filters ?? []).flatMap(k => allFields(schema).filter(f => f.key === k && f.kind === 'select' && k !== 'status' && k !== 'supplierId')),
    [schema]
  );

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const query = useMemo(
    () => ({ ...extraFilters, q: debouncedQ || undefined, status: status || undefined, supplierId: supplierId || undefined, limit: PAGE }),
    [debouncedQ, status, supplierId, extraFilters]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    api.catalogList(scope, type, query, controller.signal)
      .then(res => {
        if (controller.signal.aborted) return;
        setItems(res.items);
        setTotal(res.total ?? res.items.length);
        setCursor(res.nextCursor);
        setSelected(new Set());
      })
      .catch(err => { if (!controller.signal.aborted) setLoadError((err as Error)?.message || t('ctl.notice.failed')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [scope, type, query, tick, t]);

  const reload = useCallback(() => setTick(x => x + 1), []);

  const loadMore = async () => {
    if (!cursor) return;
    const res = await api.catalogList(scope, type, { ...query, cursor });
    setItems(prev => [...prev, ...res.items]);
    setCursor(res.nextCursor);
  };

  const replace = (row: Row) => setItems(prev => prev.map(i => (i.id === row.id ? row : i)));

  const publish = (row: Row) =>
    run(async () => replace(await api.catalogPublish(scope, type, row.id)), scope === 'supplier' ? t('cat.notice.submitted') : t('cat.notice.published'));
  const hide = (row: Row) => run(async () => replace(await api.catalogHide(scope, type, row.id)), t('cat.notice.hidden'));
  const duplicate = (row: Row) =>
    run(async () => {
      const copy = await api.catalogDuplicate(scope, type, row.id);
      setItems(prev => [copy, ...prev]);
    }, t('cat.notice.duplicated'));

  const savePrice = (row: Row, raw: string) => {
    const n = Number(raw);
    setPricing(null);
    const before = getValue(row, priceKey);
    if (!Number.isFinite(n) || n < 0 || n === before) return;
    const patch = (reason?: string) => api.catalogPatch(scope, type, row.id, { ...bodyFromValues({ [priceKey]: n }), ...(reason ? { reason } : {}) }, row.updatedAt).then(replace);
    if (isPriceJump(before, n)) {
      ask({ title: t('cat.price.jumpTitle'), description: t('cat.price.jumpBody'), run: reason => patch(reason), success: t('cat.notice.priceSaved') });
    } else {
      void run(() => patch(), t('cat.notice.priceSaved'));
    }
  };

  const bulk = (action: CatalogBulkAction) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const value = action === 'price' ? Number(bulkPrice) : undefined;
    if (action === 'price' && !(typeof value === 'number' && value > 0)) return;
    ask({
      title: t(`cat.bulk.${action}Title`, { n: ids.length }),
      critical: action === 'archive',
      run: reason => api.catalogBulk(scope, type, { ids, action, ...(value !== undefined ? { value } : {}), reason }),
      success: t('cat.bulk.done', { n: ids.length }),
      after: reload,
    });
  };

  const allChecked = items.length > 0 && items.every(i => selected.has(i.id));
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const Icon = typeIcon(schema);
  const showBulk = scope === 'staff' && canManage;

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Icon}
        title={pickText(schema.label, language) || type}
        subtitle={t('cat.list.total', { n: total })}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className={buttonClass} onClick={onBack}>
              <ArrowLeft className="w-3 h-3 rtl:rotate-180" /> {t('cat.back')}
            </button>
            {canManage && (
              <button type="button" className={primaryButtonClass} onClick={onNew}>
                <Plus className="w-3 h-3" /> {t('cat.new')}
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[12rem]">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('cat.list.search')} aria-label={t('cat.list.search')} className={`${inputClass} ps-8`} />
        </label>
        {showSupplierFilter && (
          <select aria-label={t('cat.list.supplier')} className={inputClass + ' w-auto'} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">{t('cat.list.allSuppliers')}</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{(language === 'ar' && s.businessNameAr) || s.businessName}</option>
            ))}
          </select>
        )}
        {selectFilters.map(f => (
          <select
            key={f.key}
            aria-label={pickText(f.label, language) || f.key}
            className={inputClass + ' w-auto'}
            value={extraFilters[f.key] ?? ''}
            onChange={e => setExtraFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
          >
            <option value="">{t('cat.list.anyValue', { name: pickText(f.label, language) || f.key })}</option>
            {(f.options ?? []).map(o => (
              <option key={o.value} value={o.value}>{pickText(o.label, language) || o.value}</option>
            ))}
          </select>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('cat.col.status')}>
        {(['', ...STATUSES] as const).map(s => (
          <button
            key={s || 'all'}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-pointer ${status === s ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            {s ? t(`cat.status.${s}`) : t('cat.status.all')}
          </button>
        ))}
      </div>

      <NoticeBar notice={notice} onDismiss={clearNotice} />

      {showBulk && selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--surface-container)] px-3 py-2 shadow-lg">
          <span className="text-xs font-bold text-[var(--text-primary)]">{t('cat.bulk.selected', { n: selected.size })}</span>
          {canPublish && <button type="button" className={buttonClass} disabled={busy} onClick={() => bulk('publish')}><Eye className="w-3 h-3" /> {t('cat.action.publish')}</button>}
          <button type="button" className={buttonClass} disabled={busy} onClick={() => bulk('hide')}><EyeOff className="w-3 h-3" /> {t('cat.action.hide')}</button>
          <button type="button" className={dangerButtonClass} disabled={busy} onClick={() => bulk('archive')}>{t('cat.action.archive')}</button>
          <span className="inline-flex items-center gap-1">
            <input type="number" min={1} value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} aria-label={t('cat.bulk.priceValue')} placeholder={t('cat.egp')} className={inputClass + ' w-24'} />
            <button type="button" className={buttonClass} disabled={busy || !(Number(bulkPrice) > 0)} onClick={() => bulk('price')}><Tag className="w-3 h-3" /> {t('cat.bulk.setPrice')}</button>
          </span>
          <button type="button" className="ms-auto text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" onClick={() => setSelected(new Set())}>{t('cat.bulk.clear')}</button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <SkeletonTable />
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-center justify-between">
          <span>{loadError}</span>
          <button type="button" className={buttonClass} onClick={reload}>{t('ctl.action.retry')}</button>
        </div>
      ) : (
        <DataTable<Row>
          data={items}
          onRowClick={row => onOpen(row.id)}
          emptyIcon={Layers}
          emptyTitle={t('cat.list.empty')}
          emptyDescription={canManage ? t('cat.list.emptyHint') : undefined}
          columns={[
            ...(showBulk
              ? [{
                  key: 'select',
                  header: '',
                  className: 'w-8',
                  render: (row: Row) => (
                    <input type="checkbox" checked={selected.has(row.id)} onClick={e => e.stopPropagation()} onChange={() => toggle(row.id)} aria-label={t('cat.bulk.select', { name: pickText(row.title, language) || row.id })} className="accent-[var(--accent-primary)]" />
                  ),
                }]
              : []),
            {
              key: 'title',
              header: t('cat.col.title'),
              render: row => (
                <span className="flex items-center gap-2 min-w-0">
                  {row.coverImage || row.images?.[0] ? (
                    <img src={row.coverImage ?? row.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                  ) : (
                    <span className="w-9 h-9 rounded-lg bg-[var(--btn-util-bg)] flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-bold text-[var(--text-primary)] truncate">{pickText(row.title, language) || t('cat.untitled')}</span>
                    <span className="block text-[10px] text-[var(--text-muted)] font-mono truncate">{row.id}</span>
                  </span>
                </span>
              ),
            },
            { key: 'status', header: t('cat.col.status'), render: row => <StatusChip status={row.status} /> },
            {
              key: 'price',
              header: t('cat.col.price'),
              render: row =>
                pricing?.id === row.id ? (
                  <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      value={pricing.value}
                      aria-label={t('cat.col.price')}
                      className={inputClass + ' w-24'}
                      onChange={e => setPricing({ id: row.id, value: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') savePrice(row, pricing.value); if (e.key === 'Escape') setPricing(null); }}
                    />
                    <button type="button" className={primaryButtonClass} onClick={() => savePrice(row, pricing.value)}>{t('ctl.action.save')}</button>
                  </span>
                ) : (
                  <span className="tabular-nums">{formatEGP((getValue(row, priceKey) as number) ?? row.priceFromEGP, language)}</span>
                ),
            },
            ...(scope === 'staff' ? [{ key: 'supplier', header: t('cat.col.supplier'), render: (row: Row) => <span className="truncate">{row.supplierName ?? '—'}</span> }] : []),
            { key: 'completeness', header: t('cat.col.completeness'), render: row => <CompletenessBar value={row.completeness} /> },
            { key: 'updated', header: t('cat.col.updated'), render: row => <span className="text-[var(--text-muted)] whitespace-nowrap">{formatWhen(row.updatedAt, language)}</span> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: row => (
                <span
                  className="inline-flex gap-1 opacity-40 [tr:hover_&]:opacity-100 focus-within:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  {canManage && row.status !== 'published' && row.status !== 'archived' && (scope === 'supplier' ? row.status !== 'review' : canPublish) && (
                    <button type="button" className={buttonClass} disabled={busy} onClick={() => void publish(row)} aria-label={scope === 'supplier' ? t('cat.action.submit') : t('cat.action.publish')} title={scope === 'supplier' ? t('cat.action.submit') : t('cat.action.publish')}>
                      {scope === 'supplier' ? <Send className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}
                  {canManage && row.status === 'published' && (
                    <button type="button" className={buttonClass} disabled={busy} onClick={() => void hide(row)} aria-label={t('cat.action.hide')} title={t('cat.action.hide')}>
                      <EyeOff className="w-3 h-3" />
                    </button>
                  )}
                  {canManage && (
                    <button type="button" className={buttonClass} disabled={busy} onClick={() => void duplicate(row)} aria-label={t('cat.action.duplicate')} title={t('cat.action.duplicate')}>
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  {canManage && (
                    <button type="button" className={buttonClass} onClick={() => setPricing({ id: row.id, value: String(getValue(row, priceKey) ?? row.priceFromEGP ?? '') })} aria-label={t('cat.action.price')} title={t('cat.action.price')}>
                      <Tag className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ),
            },
          ]}
        />
      )}
      {showBulk && items.length > 0 && (
        <label className="inline-flex items-center gap-2 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(items.map(i => i.id)))} className="accent-[var(--accent-primary)]" />
          {t('cat.bulk.selectAll')}
        </label>
      )}
      {cursor && (
        <div className="flex justify-center">
          <button type="button" className={buttonClass} onClick={() => void loadMore()}>{t('ctl.action.loadMore')}</button>
        </div>
      )}
      {dialog}
    </div>
  );
}

export default CatalogList;
