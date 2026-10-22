import React, { useState } from 'react';
import { Plug, Power, RefreshCw, ToggleLeft } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api, type AdminIntegration } from '../../../../services/api';
import { EmptyState, KpiCard, Skeleton, StatusBadge } from '../ui';
import { NoticeBar, buttonClass, formatWhen, useLoader, useMutationRunner, useReasonPrompt } from './controlShared';

const STATUS_BADGE: Record<AdminIntegration['status'], string> = {
  healthy: 'healthy',
  degraded: 'degraded',
  down: 'down',
  disabled: 'unknown',
  unconfigured: 'unknown',
};

export default function IntegrationsTab() {
  const { t, language } = useLanguage();
  const { can } = useAuth();
  const canManage = can('admin.integrations.manage');
  const { run, notice, clearNotice, setNotice, describeError } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const { data, setData, loading, error, reload } = useLoader(signal => api.adminListIntegrations(signal), []);
  const [checking, setChecking] = useState<string | null>(null);

  if (loading && !data) return <Skeleton variant="table" />;
  if (error) return <EmptyState icon={Plug} title={t('ctl.loadFailed')} description={error} action={{ label: t('ctl.action.retry'), onClick: reload }} />;
  const items = data?.items ?? [];
  const count = (s: AdminIntegration['status']) => items.filter(i => i.status === s).length;

  const checkNow = async (id: string) => {
    setChecking(id);
    try {
      const fresh = await api.adminCheckIntegration(id);
      setData(prev => (prev ? { items: prev.items.map(i => (i.id === id ? fresh : i)) } : prev));
    } catch (err) {
      setNotice(describeError(err));
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="space-y-3">
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Plug} label={t('ctl.integrations.healthy')} value={count('healthy')} />
        <KpiCard icon={Plug} iconColor="text-amber-400" label={t('ctl.integrations.degraded')} value={count('degraded')} />
        <KpiCard icon={Plug} iconColor="text-red-400" label={t('ctl.integrations.down')} value={count('down')} />
        <KpiCard icon={Plug} iconColor="text-[var(--text-muted)]" label={t('ctl.integrations.off')} value={count('disabled') + count('unconfigured')} />
      </div>
      {items.length === 0 ? <EmptyState icon={Plug} title={t('ctl.integrations.empty')} /> : (
        <div className="grid gap-2 lg:grid-cols-2">
          {items.map(i => (
            <div key={i.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">{i.name}</span>
                <StatusBadge status={STATUS_BADGE[i.status]} dot />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{i.status}</span>
                <span className={`ms-auto px-2 py-0.5 rounded-full text-[10px] font-bold border ${i.mode === 'live' ? 'border-red-500/40 text-red-300' : 'border-sky-500/30 text-sky-300'}`}>
                  {i.mode === 'live' ? t('ctl.integrations.live') : t('ctl.integrations.sandbox')}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-[11px]">
                <div><dt className="text-[var(--text-muted)]">{t('ctl.integrations.latency')}</dt><dd className="font-mono text-[var(--text-primary)]">{i.latencyMs === null ? '—' : `${i.latencyMs} ms`}</dd></div>
                <div><dt className="text-[var(--text-muted)]">{t('ctl.integrations.checked')}</dt><dd className="text-[var(--text-primary)]">{formatWhen(i.checkedAt, language)}</dd></div>
                <div><dt className="text-[var(--text-muted)]">{t('ctl.integrations.key')}</dt><dd dir="ltr" className="font-mono text-[var(--text-primary)]">{i.keyHint ?? '—'}</dd></div>
              </dl>
              {i.detail && <p className="text-[11px] text-[var(--text-muted)] break-words">{i.detail}</p>}
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={buttonClass} disabled={checking === i.id} onClick={() => checkNow(i.id)}>
                  <RefreshCw className={`w-3.5 h-3.5 ${checking === i.id ? 'animate-spin' : ''}`} /> {t('ctl.integrations.checkNow')}
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => ask({
                        title: t(i.enabled ? 'ctl.integrations.disableTitle' : 'ctl.integrations.enableTitle', { name: i.name }),
                        critical: i.enabled,
                        run: reason => api.adminUpdateIntegration(i.id, { enabled: !i.enabled, reason }),
                        success: t('ctl.integrations.updated'),
                        after: reload,
                      })}
                    >
                      <Power className="w-3.5 h-3.5" /> {i.enabled ? t('ctl.flags.disable') : t('ctl.flags.enable')}
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => {
                        const mode = i.mode === 'live' ? 'sandbox' : 'live';
                        ask({
                          title: t('ctl.integrations.modeTitle', { name: i.name, mode: mode === 'live' ? t('ctl.integrations.live') : t('ctl.integrations.sandbox') }),
                          description: mode === 'live' ? t('ctl.integrations.liveWarning') : undefined,
                          critical: mode === 'live',
                          run: reason => api.adminUpdateIntegration(i.id, { mode, reason }),
                          success: t('ctl.integrations.updated'),
                          after: reload,
                        });
                      }}
                    >
                      <ToggleLeft className="w-3.5 h-3.5" /> {i.mode === 'live' ? t('ctl.integrations.toSandbox') : t('ctl.integrations.toLive')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {dialog}
    </div>
  );
}
