import React, { useState, useEffect, useCallback } from 'react';
import { Brain, CheckCircle2, GitMerge, Clock, FileText } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import { TabBar } from './ui/TabBar';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';
import { StatusBadge } from './ui/StatusBadge';

type Tab = 'health' | 'gaps' | 'conflicts' | 'review' | 'stale' | 'logs' | 'metrics' | 'entities';

export default function KnowledgeOps() {
  const { language, t } = useLanguage();
  const TABS: { id: Tab; label: string }[] = [
    { id: 'health', label: t('cmd.knowledge.health') },
    { id: 'gaps', label: t('cmd.knowledge.gaps') },
    { id: 'conflicts', label: t('cmd.knowledge.conflicts') },
    { id: 'review', label: t('cmd.knowledge.review') },
    { id: 'stale', label: t('cmd.knowledge.stale') },
    { id: 'logs', label: t('cmd.knowledge.logs') },
    { id: 'metrics', label: t('cmd.knowledge.metrics') },
    { id: 'entities', label: t('cmd.knowledge.entities') },
  ];
  const [activeTab, setActiveTab] = useState<Tab>('health');
  const [health, setHealth] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [staleFacts, setStaleFacts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [h, g, c, r, sf, l, m] = await Promise.allSettled([
        api.getAdminDkosHealth(),
        api.getAdminKnowledgeGaps(),
        api.getAdminConflicts(),
        api.getAdminReviewQueue(),
        api.getAdminStaleFacts(),
        api.getAdminLogs(50),
        api.getAdminExpansionMetrics(),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (g.status === 'fulfilled') setGaps((g.value as any)?.gaps || []);
      if (c.status === 'fulfilled') setConflicts((c.value as any)?.conflicts || []);
      if (r.status === 'fulfilled') setReviewQueue((r.value as any)?.queue || []);
      if (sf.status === 'fulfilled') setStaleFacts((sf.value as any)?.staleFacts || []);
      if (l.status === 'fulfilled') setLogs((l.value as any)?.logs || []);
      if (m.status === 'fulfilled') setMetrics((m.value as any)?.metrics || m.value);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolveConflict = async (conflictId: string) => {
    const value = prompt(t('cmd.knowledge.conflictResolved'));
    if (!value) return;
    try { await api.resolveAdminConflict(conflictId, value); fetchData(); } catch (err: any) { alert(`${t('cmd.knowledge.resolveFailed')} ${err.message}`); }
  };

  const handleResolveReview = async (itemId: string, action: string) => {
    try { await api.resolveAdminReviewQueue(itemId, action); fetchData(); } catch (err: any) { alert(`${t('cmd.knowledge.resolveFailed')} ${err.message}`); }
  };

  const handleMergeEntities = async (primary: string, secondary: string) => {
    if (!confirm(t('cmd.knowledge.mergeConfirm').replace('${secondary}', secondary).replace('${primary}', primary))) return;
    try { await api.mergeAdminEntities({ sourceId: secondary, targetId: primary }); fetchData(); } catch (err: any) { alert(`${t('cmd.knowledge.resolveFailed')} ${err.message}`); }
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Brain} title={t('cmd.knowledge.title')} />

      <TabBar tabs={TABS} activeTab={activeTab} onChange={tab => setActiveTab(tab as Tab)} />

      {loading ? (
        <Skeleton variant="list" count={5} />
      ) : (
        <>
          {activeTab === 'health' && health && (
            <DashCard glow="accent">
              <h4 className="text-xs font-bold text-[var(--text-muted)]">{t('cmd.knowledge.dkosHealth')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mt-3">
                {Object.entries(health?.health || health || {}).slice(0, 12).map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <div className="text-lg font-bold text-[var(--accent-primary)] font-mono">{typeof value === 'number' ? value : typeof value === 'boolean' ? (value ? '✓' : '✗') : '—'}</div>
                    <div className="text-[11px] text-[var(--text-muted)] capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                  </div>
                ))}
              </div>
            </DashCard>
          )}

          {activeTab === 'gaps' && (
            gaps.length === 0 ? (
              <EmptyState icon={CheckCircle2} title={t('cmd.knowledge.noGaps')} />
            ) : (
              <div className="space-y-2">
                {gaps.map((gap: any, i: number) => (
                  <DashCard key={gap.id || i}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">{gap.category || gap.type || t('cmd.knowledge.gap')}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{gap.description?.substring(0, 120)}</div>
                      </div>
                      <StatusBadge status={gap.severity || 'LOW'} size="sm" />
                    </div>
                  </DashCard>
                ))}
              </div>
            )
          )}

          {activeTab === 'conflicts' && (() => {
            const openConflicts = conflicts.filter((c: any) => c.status === 'OPEN');
            return openConflicts.length === 0 ? (
              <EmptyState icon={CheckCircle2} title={t('cmd.knowledge.noConflicts')} />
            ) : (
              <div className="space-y-2">
                {openConflicts.map((conflict: any) => (
                  <DashCard key={conflict.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">{conflict.entityId} · {conflict.property}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">{conflict.explanation}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={conflict.classification || 'OPEN'} size="sm" />
                        <button type="button" onClick={() => handleResolveConflict(conflict.id)}
                          className="px-2 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px] font-bold cursor-pointer">{t('cmd.knowledge.resolve')}</button>
                      </div>
                    </div>
                  </DashCard>
                ))}
              </div>
            );
          })()}

          {activeTab === 'review' && (
            reviewQueue.length === 0 ? (
              <EmptyState icon={CheckCircle2} title={t('cmd.knowledge.reviewEmpty')} />
            ) : (
              <div className="space-y-2">
                {reviewQueue.map((item: any) => (
                  <DashCard key={item.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">{item.title || item.type || item.id}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{item.description?.substring(0, 120)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status || 'PENDING'} size="sm" />
                        {item.status === 'PENDING_REVIEW' && (
                          <div className="flex gap-1">
                            <button type="button" onClick={() => handleResolveReview(item.id, 'APPROVE')}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold cursor-pointer">{t('cmd.action.approve')}</button>
                            <button type="button" onClick={() => handleResolveReview(item.id, 'REJECT')}
                              className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold cursor-pointer">{t('cmd.action.reject')}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </DashCard>
                ))}
              </div>
            )
          )}

          {activeTab === 'stale' && (
            staleFacts.length === 0 ? (
              <EmptyState icon={Clock} title={t('cmd.knowledge.noStaleFacts')} />
            ) : (
              <div className="space-y-2">
                {staleFacts.map((fact: any, i: number) => (
                  <DashCard key={fact.id || i}>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{fact.entityId || fact.entity} · {fact.property || fact.field}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.knowledge.valueLabel')} {fact.value || '—'} · {t('cmd.knowledge.lastVerified')} {fact.lastVerifiedAt || fact.verifiedAt || t('cmd.knowledge.never')}</div>
                  </DashCard>
                ))}
              </div>
            )
          )}

          {activeTab === 'logs' && (
            logs.length === 0 ? (
              <EmptyState icon={FileText} title={t('cmd.knowledge.noLogs')} />
            ) : (
              <DashCard padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                      <tr><th className="py-2.5 px-3">{t('cmd.knowledge.time')}</th><th className="py-2.5 px-3">{t('cmd.knowledge.query')}</th><th className="py-2.5 px-3">{t('cmd.knowledge.results')}</th><th className="py-2.5 px-3">{t('cmd.knowledge.latency')}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {logs.map((log: any, i: number) => (
                        <tr key={i} className="hover:bg-[var(--btn-util-bg)] transition-colors">
                          <td className="py-2.5 px-3 text-[var(--text-muted)]">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</td>
                          <td className="py-2.5 px-3 text-[var(--accent-primary)]">{log.query || '—'}</td>
                          <td className="py-2.5 px-3 text-[var(--text-muted)]">{log.resultCount ?? log.results ?? '—'}</td>
                          <td className="py-2.5 px-3 text-[var(--text-muted)]">{log.latencyMs ? `${log.latencyMs}ms` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DashCard>
            )
          )}

          {activeTab === 'metrics' && metrics && (
            <DashCard glow="amber">
              <h4 className="text-xs font-bold text-[var(--text-muted)] mb-3">{t('cmd.knowledge.expansionMetrics')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {Object.entries(metrics).slice(0, 12).map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <div className="text-lg font-bold text-[var(--accent-primary)] font-mono">{typeof value === 'number' ? value.toLocaleString() : value || '—'}</div>
                    <div className="text-[11px] text-[var(--text-muted)] capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                  </div>
                ))}
              </div>
            </DashCard>
          )}

          {activeTab === 'entities' && (
            <div className="space-y-2">
              <DashCard>
                <h4 className="text-xs font-bold text-[var(--text-muted)] mb-2">{t('cmd.knowledge.entityResolution')}</h4>
                <p className="text-[11px] text-[var(--text-muted)]">{t('cmd.knowledge.entityResolutionDesc')}</p>
                <div className="mt-3 flex gap-2">
                  <input type="text" id="entity-primary" placeholder={t('cmd.knowledge.primaryEntity')}
                    className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50 flex-1" />
                  <input type="text" id="entity-secondary" placeholder={t('cmd.knowledge.secondaryEntity')}
                    className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50 flex-1" />
                  <button type="button" onClick={() => {
                    const primary = (document.getElementById('entity-primary') as HTMLInputElement)?.value;
                    const secondary = (document.getElementById('entity-secondary') as HTMLInputElement)?.value;
                    if (primary && secondary) handleMergeEntities(primary, secondary);
                  }} className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--text-primary)] text-xs font-bold cursor-pointer">{t('cmd.action.merge')}</button>
                </div>
              </DashCard>
              <EmptyState
                icon={GitMerge}
                title={t('cmd.knowledge.mergeForm')}
                description={t('cmd.knowledge.entityResolutionDesc')}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
