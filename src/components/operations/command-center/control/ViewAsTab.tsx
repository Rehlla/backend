import React, { useEffect, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../services/api';
import { EmptyState, Skeleton } from '../ui';
import { NoticeBar, buttonClass, inputClass, useLoader, useMutationRunner, useReasonPrompt } from './controlShared';

/**
 * Read-only view-as. Starting it turns this session into the target user for
 * every GET (the server enforces read-only); the app-wide ViewAsBanner then
 * stays on screen until it is ended.
 */
export default function ViewAsTab() {
  const { t } = useLanguage();
  const { sessionUser, viewAs, refreshSession } = useAuth();
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);
  const list = useLoader(signal => api.adminListUsers({ q: query || undefined, limit: 20 }, signal), [query]);
  const candidates = (list.data?.items ?? []).filter(u => u.id !== sessionUser?.id && u.role !== 'Admin');

  return (
    <div className="space-y-3">
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">{t('ctl.viewAs.intro')}</div>
      {viewAs && <p className="text-xs font-bold text-amber-300">{t('ctl.viewAs.active', { email: viewAs.email })}</p>}
      <label className="relative block">
        <span className="sr-only">{t('ctl.users.search')}</span>
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
        <input className={`${inputClass} ps-8`} value={q} onChange={e => setQ(e.target.value)} placeholder={t('ctl.users.search')} />
      </label>
      {list.loading && !list.data ? <Skeleton variant="list" count={4} /> : list.error ? (
        <EmptyState icon={Eye} title={t('ctl.loadFailed')} description={list.error} />
      ) : candidates.length === 0 ? (
        <EmptyState icon={Eye} title={t('ctl.users.empty')} />
      ) : (
        <ul className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] divide-y divide-[var(--border-subtle)]">
          {candidates.map(u => (
            <li key={u.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[var(--text-primary)] truncate">{u.name || u.email}</div>
                <div className="text-[var(--text-muted)] truncate">{u.email} · {u.role}</div>
              </div>
              <button
                type="button"
                className={buttonClass}
                disabled={!!viewAs}
                onClick={() => ask({
                  title: t('ctl.viewAs.startTitle', { email: u.email }),
                  description: t('ctl.viewAs.startBody'),
                  confirmLabel: t('ctl.viewAs.start'),
                  run: reason => api.adminStartViewAs(u.id, reason),
                  success: t('ctl.viewAs.started', { email: u.email }),
                  after: () => { void refreshSession(); },
                })}
              >
                <Eye className="w-3.5 h-3.5" /> {t('ctl.viewAs.start')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </div>
  );
}
