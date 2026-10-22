import React, { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api, type AdminSetting } from '../../../../services/api';
import { EmptyState, Skeleton } from '../ui';
import {
  Drawer,
  NoticeBar,
  buttonClass,
  formatValue,
  formatWhen,
  inputClass,
  primaryButtonClass,
  useLoader,
  useMutationRunner,
  useReasonPrompt,
} from './controlShared';

/** Draft text for a setting's editor. */
function toDraft(s: AdminSetting): string {
  if (s.type === 'json') return JSON.stringify(s.value, null, 2);
  if (s.type === 'boolean') return s.value ? 'true' : 'false';
  return s.value === null || s.value === undefined ? '' : String(s.value);
}

/** Parses an editor draft into the setting's type, or returns an error key. */
export function parseSettingDraft(type: AdminSetting['type'], draft: string): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (type) {
    case 'number': {
      const n = Number(draft);
      return draft.trim() !== '' && Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: 'ctl.settings.invalidNumber' };
    }
    case 'boolean':
      return { ok: true, value: draft === 'true' };
    case 'json':
      try {
        return { ok: true, value: JSON.parse(draft) };
      } catch {
        return { ok: false, error: 'ctl.settings.invalidJson' };
      }
    default:
      return { ok: true, value: draft };
  }
}

export default function SettingsTab() {
  const { t, language } = useLanguage();
  const { can } = useAuth();
  const canManage = can('admin.settings.manage');
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const { data, loading, error, reload } = useLoader(signal => api.adminListSettings(signal), []);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.items.map(s => [s.key, toDraft(s)])));
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map<string, AdminSetting[]>();
    for (const s of data?.items ?? []) map.set(s.group, [...(map.get(s.group) ?? []), s]);
    return [...map.entries()];
  }, [data]);

  if (loading && !data) return <Skeleton variant="list" count={5} />;
  if (error) return <EmptyState icon={SlidersHorizontal} title={t('ctl.loadFailed')} description={error} action={{ label: t('ctl.action.retry'), onClick: reload }} />;
  if (!data || data.items.length === 0) return <EmptyState icon={SlidersHorizontal} title={t('ctl.settings.empty')} />;

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      {groups.map(([group, items]) => (
        <section key={group} className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{group}</h4>
          <div className="grid gap-2 lg:grid-cols-2">
            {items.map(s => {
              const draft = drafts[s.key] ?? toDraft(s);
              const parsed = parseSettingDraft(s.type, draft);
              const dirty = draft !== toDraft(s);
              return (
                <div key={s.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[var(--text-primary)]">{language === 'ar' ? s.labelAr : s.labelEn}</div>
                      <div className="font-mono text-[10px] text-[var(--text-muted)]">{s.key} · v{s.version} · {s.type}</div>
                    </div>
                    <button type="button" className={buttonClass} onClick={() => setHistoryKey(s.key)}>
                      <History className="w-3.5 h-3.5" /> {t('ctl.settings.history')}
                    </button>
                  </div>
                  {s.type === 'boolean' ? (
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        className="accent-[var(--accent-primary)]"
                        checked={draft === 'true'}
                        disabled={!canManage}
                        onChange={e => setDrafts({ ...drafts, [s.key]: e.target.checked ? 'true' : 'false' })}
                      />
                      {draft === 'true' ? t('ctl.state.on') : t('ctl.state.off')}
                    </label>
                  ) : s.type === 'json' ? (
                    <textarea
                      dir="ltr"
                      rows={5}
                      aria-label={s.key}
                      className={`${inputClass} font-mono`}
                      value={draft}
                      disabled={!canManage}
                      onChange={e => setDrafts({ ...drafts, [s.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      dir="ltr"
                      aria-label={s.key}
                      type={s.type === 'number' ? 'number' : 'text'}
                      step="any"
                      className={inputClass}
                      value={draft}
                      disabled={!canManage}
                      onChange={e => setDrafts({ ...drafts, [s.key]: e.target.value })}
                    />
                  )}
                  {!parsed.ok && <p className="text-[10px] text-red-400">{t(parsed.error)}</p>}
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                    <span>{s.updatedBy ? t('ctl.settings.updatedBy', { who: s.updatedBy, when: formatWhen(s.updatedAt, language) }) : t('ctl.settings.default')}</span>
                    {canManage && (
                      <button
                        type="button"
                        className={primaryButtonClass}
                        disabled={!dirty || !parsed.ok}
                        onClick={() => parsed.ok && ask({
                          title: t('ctl.settings.saveTitle', { key: s.key }),
                          body: (
                            <div className="text-[11px] font-mono rounded-lg bg-[var(--btn-util-bg)] p-2 break-all" dir="ltr">
                              {formatValue(s.value)} → {formatValue(parsed.value)}
                            </div>
                          ),
                          run: reason => api.adminUpdateSetting(s.key, parsed.value, reason),
                          success: t('ctl.settings.saved'),
                          after: reload,
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
        </section>
      ))}
      {historyKey && (
        <SettingHistoryDrawer settingKey={historyKey} canManage={canManage} onClose={() => setHistoryKey(null)} onRolledBack={reload} />
      )}
      {dialog}
    </div>
  );
}

function SettingHistoryDrawer({ settingKey, canManage, onClose, onRolledBack }: { settingKey: string; canManage: boolean; onClose: () => void; onRolledBack: () => void }) {
  const { t, language } = useLanguage();
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const { data, loading, error, reload } = useLoader(signal => api.adminGetSettingHistory(settingKey, signal), [settingKey]);
  const items = [...(data?.items ?? [])].sort((a, b) => b.version - a.version);
  const latest = items[0]?.version;

  return (
    <Drawer open title={t('ctl.settings.historyTitle', { key: settingKey })} onClose={onClose}>
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      {loading && !data ? <Skeleton variant="list" count={4} /> : error ? (
        <EmptyState icon={History} title={t('ctl.loadFailed')} description={error} />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title={t('ctl.settings.noHistory')} />
      ) : (
        <ol className="space-y-2">
          {items.map(h => (
            <li key={h.version} className="rounded-xl border border-[var(--border-subtle)] p-2.5 space-y-1">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-mono font-bold text-[var(--text-primary)]">v{h.version}</span>
                <span className="text-[var(--text-muted)]">{h.updatedBy} · {formatWhen(h.updatedAt, language)}</span>
                {canManage && h.version !== latest && (
                  <button
                    type="button"
                    className={`${buttonClass} ms-auto`}
                    onClick={() => ask({
                      title: t('ctl.settings.rollbackTitle', { key: settingKey, version: h.version }),
                      run: reason => api.adminRollbackSetting(settingKey, h.version, reason),
                      success: t('ctl.settings.rolledBack'),
                      after: () => { reload(); onRolledBack(); },
                    })}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> {t('ctl.settings.rollback')}
                  </button>
                )}
              </div>
              <pre dir="ltr" className="text-[10px] font-mono whitespace-pre-wrap break-all rounded bg-[var(--btn-util-bg)] p-1.5 text-[var(--text-primary)]">{formatValue(h.value)}</pre>
              {h.reason && <p className="text-[10px] text-[var(--text-muted)]">{t('ctl.audit.reason')}: {h.reason}</p>}
            </li>
          ))}
        </ol>
      )}
      {dialog}
    </Drawer>
  );
}
