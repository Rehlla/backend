import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText, Search } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api, type AdminAuditEvent, type AdminAuditQuery } from '../../../../services/api';
import { EmptyState, Skeleton } from '../ui';
import { buttonClass, formatValue, formatWhen, inputClass, useLoader } from './controlShared';

/** Keys whose value differs between before and after (top level only). */
export function changedKeys(before: unknown, after: unknown): string[] {
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const a = obj(before);
  const b = obj(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

function Diff({ before, after }: { before: unknown; after: unknown }) {
  const { t } = useLanguage();
  const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(before) && !isObj(after)) {
    return (
      <div dir="ltr" className="grid sm:grid-cols-2 gap-2 text-[10px] font-mono">
        <pre className="rounded bg-red-500/10 p-2 whitespace-pre-wrap break-all text-red-300">{formatValue(before)}</pre>
        <pre className="rounded bg-emerald-500/10 p-2 whitespace-pre-wrap break-all text-emerald-300">{formatValue(after)}</pre>
      </div>
    );
  }
  const keys = changedKeys(before, after);
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  if (keys.length === 0) return <p className="text-[10px] text-[var(--text-muted)]">{t('ctl.audit.noChanges')}</p>;
  return (
    <table dir="ltr" className="w-full text-[10px] font-mono">
      <thead>
        <tr className="text-[var(--text-muted)]">
          <th className="text-start py-1 pe-2">{t('ctl.audit.field')}</th>
          <th className="text-start py-1 pe-2">{t('ctl.audit.before')}</th>
          <th className="text-start py-1">{t('ctl.audit.after')}</th>
        </tr>
      </thead>
      <tbody>
        {keys.map(k => (
          <tr key={k} className="align-top border-t border-[var(--border-subtle)]">
            <td className="py-1 pe-2 font-bold text-[var(--text-primary)]">{k}</td>
            <td className="py-1 pe-2 text-red-300 break-all">{formatValue(b[k])}</td>
            <td className="py-1 text-emerald-300 break-all">{formatValue(a[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const FILTERS = ['actor', 'action', 'entityType', 'entityId'] as const;

export default function AuditTab() {
  const { t, language } = useLanguage();
  const { can } = useAuth();
  const [form, setForm] = useState<AdminAuditQuery>({});
  const [applied, setApplied] = useState<AdminAuditQuery>({});
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<AdminAuditEvent[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const query: AdminAuditQuery = {
    ...applied,
    from: applied.from ? new Date(applied.from).toISOString() : undefined,
    to: applied.to ? new Date(applied.to).toISOString() : undefined,
  };
  const list = useLoader(signal => api.adminListAudit({ ...query, cursor, limit: 50, sort: '-timestamp' }, signal), [JSON.stringify(applied), cursor]);
  useEffect(() => {
    if (!list.data) return;
    setRows(prev => (cursor ? [...prev, ...list.data!.items.filter(i => !prev.some(p => p.id === i.id))] : list.data!.items));
  }, [list.data, cursor]);

  const apply = () => { setApplied({ ...form }); setCursor(undefined); };

  return (
    <div className="space-y-3">
      <form
        className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7 items-end"
        onSubmit={e => { e.preventDefault(); apply(); }}
      >
        <label className="block lg:col-span-1">
          <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.audit.search')}</span>
          <input className={inputClass} value={form.q ?? ''} onChange={e => setForm({ ...form, q: e.target.value })} />
        </label>
        {FILTERS.map(f => (
          <label key={f} className="block">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t(`ctl.audit.${f}`)}</span>
            <input dir="ltr" className={inputClass} value={form[f] ?? ''} onChange={e => setForm({ ...form, [f]: e.target.value })} />
          </label>
        ))}
        <label className="block">
          <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.audit.from')}</span>
          <input type="datetime-local" className={inputClass} value={form.from ?? ''} onChange={e => setForm({ ...form, from: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.audit.to')}</span>
          <input type="datetime-local" className={inputClass} value={form.to ?? ''} onChange={e => setForm({ ...form, to: e.target.value })} />
        </label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-7">
          <button type="submit" className={buttonClass}>
            <Search className="w-3.5 h-3.5" /> {t('ctl.action.filter')}
          </button>
          <button type="button" className={buttonClass} onClick={() => { setForm({}); setApplied({}); setCursor(undefined); }}>
            {t('ctl.action.reset')}
          </button>
          {can('admin.audit.export') && (
            <a href={api.adminAuditExportUrl(query)} download className={`${buttonClass} ms-auto`}>
              <Download className="w-3.5 h-3.5" /> {t('ctl.audit.exportCsv')}
            </a>
          )}
        </div>
      </form>

      {list.error ? (
        <EmptyState icon={FileText} title={t('ctl.loadFailed')} description={list.error} action={{ label: t('ctl.action.retry'), onClick: list.reload }} />
      ) : list.loading && rows.length === 0 ? (
        <Skeleton variant="table" />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title={t('ctl.audit.empty')} />
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] divide-y divide-[var(--border-subtle)]">
          {rows.map(e => {
            const isOpen = open === e.id;
            const Chevron = isOpen ? ChevronDown : ChevronRight;
            return (
              <div key={e.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : e.id)}
                  className="w-full flex flex-wrap items-center gap-2 px-3 py-2 text-start text-[11px] hover:bg-[var(--btn-util-bg)]/50 cursor-pointer"
                >
                  <Chevron className="w-3.5 h-3.5 text-[var(--text-muted)] rtl:-scale-x-100" aria-hidden="true" />
                  <span className="font-mono font-bold text-[var(--text-primary)]">{e.action}</span>
                  <span className="font-mono text-[var(--text-muted)]">{e.entityType}:{e.entityId}</span>
                  <span className="text-[var(--text-muted)]">{e.actor} ({e.actorRole})</span>
                  <span className="ms-auto text-[var(--text-muted)]">{formatWhen(e.timestamp, language)}</span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {e.reason && <p className="text-[11px] text-[var(--text-primary)]">{t('ctl.audit.reason')}: {e.reason}</p>}
                    <Diff before={e.before} after={e.after} />
                    <div className="text-[10px] font-mono text-[var(--text-muted)]">
                      {e.correlationId && <>correlationId: {e.correlationId} </>}
                      {e.device && <>· device: {e.device}</>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>{t('ctl.list.showing', { shown: rows.length, total: list.data?.total ?? rows.length })}</span>
        {list.data?.nextCursor && (
          <button type="button" className={buttonClass} disabled={list.loading} onClick={() => setCursor(list.data!.nextCursor!)}>
            {t('ctl.action.loadMore')}
          </button>
        )}
      </div>
    </div>
  );
}
