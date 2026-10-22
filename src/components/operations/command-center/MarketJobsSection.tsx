import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Play, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';
import { StatusBadge } from './ui/StatusBadge';

export default function MarketJobsSection() {
  const { language, t } = useLanguage();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.getMarketJobs();
      setJobs((data as any)?.policies || []);
    } catch { setJobs([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleTrigger = async (sourceId?: string) => {
    setTriggering(true);
    try {
      if (sourceId) {
        await api.triggerMarketJob({ sourceId });
      } else {
        await Promise.all(jobs.filter(p => p.sourceId).map(p => api.triggerMarketJob({ sourceId: p.sourceId! })));
      }
      await fetchJobs();
    } catch { /* best effort */ } finally { setTriggering(false); }
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Zap} title={t('cmd.jobs.title')} />

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => handleTrigger()} disabled={triggering}
          className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
          <Play className="w-3 h-3" />{triggering ? t('cmd.jobs.running') : t('cmd.jobs.runAll')}
        </button>
        <button type="button" onClick={() => fetchJobs()}
          className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <Skeleton variant="list" count={4} />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Zap} title={t('cmd.jobs.noJobs')} />
      ) : (
        <div className="space-y-2">
          {jobs.map((job: any, i: number) => (
            <DashCard key={job.id || job.type || i}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)]">{job.sourceType || job.sourceReference || job.sourceId || t('cmd.jobs.title')}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {job.scheduleInterval && <span>{t('cmd.jobs.schedule')} {job.scheduleInterval} · </span>}
                      {job.lastCompletedRun && <span>{t('cmd.jobs.lastRun')} {new Date(job.lastCompletedRun).toLocaleString()}</span>}
                      {job.nextScheduledRun && !job.lastCompletedRun && <span>{t('cmd.jobs.nextRun')} {new Date(job.nextScheduledRun).toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={job.enabled !== false ? 'ACTIVE' : 'COMPLETED'} size="sm" />
                  <button type="button" onClick={() => handleTrigger(job.sourceId)} disabled={triggering}
                    className="px-2 py-1 rounded bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold cursor-pointer disabled:opacity-50">
                    {t('cmd.action.run')}
                  </button>
                </div>
              </div>
            </DashCard>
          ))}
        </div>
      )}
    </div>
  );
}
