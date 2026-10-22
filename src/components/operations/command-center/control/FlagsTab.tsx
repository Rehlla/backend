import React, { useState } from 'react';
import { Flag, OctagonAlert, Power, Save } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api, type AdminFlag } from '../../../../services/api';
import { EmptyState, Skeleton } from '../ui';
import { NoticeBar, buttonClass, formatWhen, inputClass, primaryButtonClass, useLoader, useMutationRunner, useReasonPrompt } from './controlShared';

const TARGET_ROLES = ['Traveler', 'Supplier', 'Operations', 'Product', 'Admin'] as const;

export default function FlagsTab() {
  const { t, language } = useLanguage();
  const { can } = useAuth();
  const canManage = can('admin.flags.manage');
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const { data, loading, error, reload } = useLoader(signal => api.adminListFlags(signal), []);
  const [edits, setEdits] = useState<Record<string, { rolloutPercent: number; roles: string[] }>>({});

  if (loading && !data) return <Skeleton variant="list" count={6} />;
  if (error) return <EmptyState icon={Flag} title={t('ctl.loadFailed')} description={error} action={{ label: t('ctl.action.retry'), onClick: reload }} />;
  const items = data?.items ?? [];
  const critical = items.filter(f => f.kind !== 'flag');
  const flags = items.filter(f => f.kind === 'flag');

  const toggle = (f: AdminFlag) => {
    const next = !f.enabled;
    const isSwitch = f.kind !== 'flag';
    ask({
      title: isSwitch
        ? t(next ? 'ctl.flags.engageTitle' : 'ctl.flags.releaseTitle', { key: f.key })
        : t(next ? 'ctl.flags.enableTitle' : 'ctl.flags.disableTitle', { key: f.key }),
      description: isSwitch ? `${f.description} ${t(next ? 'ctl.flags.engageWarning' : 'ctl.flags.releaseWarning')}` : f.description,
      critical: isSwitch,
      confirmLabel: isSwitch ? t(next ? 'ctl.flags.engage' : 'ctl.flags.release') : undefined,
      run: reason => api.adminUpdateFlag(f.key, { enabled: next, reason }),
      success: t('ctl.flags.updated'),
      after: reload,
    });
  };

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onDismiss={clearNotice} />

      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400">
          <OctagonAlert className="w-3.5 h-3.5" aria-hidden="true" /> {t('ctl.flags.killSwitches')}
        </h4>
        <p className="text-[11px] text-[var(--text-muted)]">{t('ctl.flags.killSwitchesHint')}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {critical.map(f => (
            <div
              key={f.key}
              data-critical="true"
              className={`rounded-2xl border p-3 space-y-2 ${f.enabled ? 'border-red-500/60 bg-red-500/10' : 'border-red-500/20 bg-[var(--surface-container)]'}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-[var(--text-primary)] truncate flex-1">{f.key}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${f.enabled ? 'border-red-500/50 text-red-300 bg-red-500/20 animate-pulse motion-reduce:animate-none' : 'border-emerald-500/30 text-emerald-400'}`}>
                  {f.enabled ? t('ctl.flags.engaged') : t('ctl.flags.normal')}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">{f.description}</p>
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                <span>{formatWhen(f.updatedAt, language)} · {f.updatedBy}</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => toggle(f)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${f.enabled ? 'border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' : 'bg-red-500 text-white hover:bg-red-600'}`}
                  >
                    <Power className="w-3.5 h-3.5" /> {f.enabled ? t('ctl.flags.release') : t('ctl.flags.engage')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('ctl.flags.featureFlags')}</h4>
        {flags.length === 0 ? <EmptyState icon={Flag} title={t('ctl.flags.empty')} /> : (
          <div className="space-y-2">
            {flags.map(f => {
              const edit = edits[f.key] ?? { rolloutPercent: f.rolloutPercent, roles: f.roles };
              const dirty = edit.rolloutPercent !== f.rolloutPercent || JSON.stringify([...edit.roles].sort()) !== JSON.stringify([...f.roles].sort());
              return (
                <div key={f.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">{f.key}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${f.enabled ? 'border-emerald-500/30 text-emerald-400' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}>
                      {f.enabled ? t('ctl.state.on') : t('ctl.state.off')}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] flex-1 min-w-[120px]">{f.description}</span>
                    {canManage && (
                      <button type="button" className={buttonClass} onClick={() => toggle(f)}>
                        <Power className="w-3.5 h-3.5" /> {f.enabled ? t('ctl.flags.disable') : t('ctl.flags.enable')}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <label className="inline-flex items-center gap-1.5">
                      <span className="text-[var(--text-muted)]">{t('ctl.flags.rollout')}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className={`${inputClass} w-20`}
                        value={edit.rolloutPercent}
                        disabled={!canManage}
                        onChange={e => setEdits({ ...edits, [f.key]: { ...edit, rolloutPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } })}
                      />
                      %
                    </label>
                    <fieldset className="inline-flex flex-wrap items-center gap-2">
                      <legend className="sr-only">{t('ctl.flags.roles')}</legend>
                      <span className="text-[var(--text-muted)]">{t('ctl.flags.roles')}</span>
                      {TARGET_ROLES.map(r => (
                        <label key={r} className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="accent-[var(--accent-primary)]"
                            checked={edit.roles.includes(r)}
                            disabled={!canManage}
                            onChange={e => setEdits({ ...edits, [f.key]: { ...edit, roles: e.target.checked ? [...edit.roles, r] : edit.roles.filter(x => x !== r) } })}
                          />
                          {r}
                        </label>
                      ))}
                      {edit.roles.length === 0 && <span className="text-[10px] text-[var(--text-muted)]">({t('ctl.flags.allRoles')})</span>}
                    </fieldset>
                    {canManage && (
                      <button
                        type="button"
                        className={`${primaryButtonClass} ms-auto`}
                        disabled={!dirty}
                        onClick={() => ask({
                          title: t('ctl.flags.saveTitle', { key: f.key }),
                          run: reason => api.adminUpdateFlag(f.key, { enabled: f.enabled, rolloutPercent: edit.rolloutPercent, roles: edit.roles, reason }),
                          success: t('ctl.flags.updated'),
                          after: () => { setEdits(prev => { const n = { ...prev }; delete n[f.key]; return n; }); reload(); },
                        })}
                      >
                        <Save className="w-3.5 h-3.5" /> {t('ctl.action.save')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}
