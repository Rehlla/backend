import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Globe, RefreshCw, Eye } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader, TabBar, StatusBadge, EmptyState, DashCard, Skeleton, MetricGrid } from './ui';

interface Exception {
  id: string;
  source: 'market' | 'support' | 'knowledge' | 'review' | 'system';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  entityType?: string;
  entityId?: string;
}

const SOURCE_ICONS: Record<string, React.ElementType> = { market: Globe, support: AlertTriangle, knowledge: AlertTriangle, review: Eye, system: AlertTriangle };

export default function ExceptionsCenter() {
  const { language, t } = useLanguage();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged'>('active');
  const [selectedException, setSelectedException] = useState<Exception | null>(null);

  const fetchExceptions = useCallback(async () => {
    try {
      const [marketAlerts, supportData, reviewQueue, gaps] = await Promise.allSettled([
        api.getMarketAlerts(), api.getSupportMessages(), api.getMarketReviewQueue(), api.getAdminKnowledgeGaps(),
      ]);

      const items: Exception[] = [];
      if (marketAlerts.status === 'fulfilled') {
        (marketAlerts.value as any)?.alerts?.forEach((a: any) => {
          items.push({ id: a.id, source: 'market', severity: a.severity || 'MEDIUM', title: a.titleEn || a.titleAr || 'Market alert', description: a.messageEn || a.messageAr || '', status: a.acknowledged ? 'acknowledged' : 'active', createdAt: a.createdAt, entityType: 'market', entityId: a.id });
        });
      }
      if (supportData.status === 'fulfilled') {
        (supportData.value as any)?.messages?.filter((m: any) => m.status === 'OPEN').forEach((m: any) => {
          items.push({ id: m.id, source: 'support', severity: m.urgent ? 'CRITICAL' : 'MEDIUM', title: `Support: ${m.category || 'General'}`, description: m.message?.substring(0, 200) || '', status: 'active', createdAt: m.createdAt, entityType: 'support', entityId: m.id });
        });
      }
      if (reviewQueue.status === 'fulfilled') {
        (reviewQueue.value as any)?.items?.filter((r: any) => r.status === 'PENDING_REVIEW').forEach((r: any) => {
          items.push({ id: r.id, source: 'review', severity: r.severity || 'MEDIUM', title: `Review: ${r.issueType?.replace(/_/g, ' ')}`, description: r.summaryEn || '', status: 'active', createdAt: r.detectedAt, entityType: 'review', entityId: r.id });
        });
      }
      if (gaps.status === 'fulfilled') {
        (gaps.value as any)?.gaps?.forEach((g: any) => {
          items.push({ id: g.id || `gap-${Math.random()}`, source: 'knowledge', severity: g.severity || 'LOW', title: `Knowledge Gap: ${g.category || g.description?.substring(0, 50)}`, description: g.description || '', status: 'active', createdAt: g.detectedAt || new Date().toISOString() });
        });
      }

      const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      items.sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3));
      setExceptions(items);
    } catch { setExceptions([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchExceptions(); const i = setInterval(fetchExceptions, 30_000); return () => clearInterval(i); }, [fetchExceptions]);

  const handleAcknowledge = async (id: string) => {
    try { await api.acknowledgeMarketAlert(id, 'Operations'); setExceptions(prev => prev.map(e => e.id === id ? { ...e, status: 'acknowledged' } : e)); } catch {}
  };

  const filtered = filter === 'all' ? exceptions : exceptions.filter(e => e.status === filter);
  const activeCount = exceptions.filter(e => e.status === 'active').length;
  const criticalCount = exceptions.filter(e => e.severity === 'CRITICAL' && e.status === 'active').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={AlertTriangle}
        iconColor="text-amber-400"
        title={t('cmd.exceptions.title')}
        badge={activeCount > 0 ? { count: activeCount, color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' } : undefined}
        actions={
          <div className="flex items-center gap-2">
            <TabBar
              tabs={[
                { id: 'active', label: t('cmd.exceptions.active') },
                { id: 'all', label: t('cmd.exceptions.all') },
                { id: 'acknowledged', label: t('cmd.exceptions.acknowledged') },
              ]}
              activeTab={filter}
              onChange={(id) => setFilter(id as any)}
            />
            <button type="button" onClick={fetchExceptions} aria-label={t('cmd.overview.refresh')}
              className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-muted)] cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Quick Stats */}
      <MetricGrid
        metrics={[
          { label: t('cmd.exceptions.active'), value: activeCount, color: activeCount > 0 ? 'text-amber-400' : 'text-[var(--text-muted)]', icon: AlertTriangle },
          { label: t('cmd.exceptions.critical'), value: criticalCount, color: criticalCount > 0 ? 'text-red-400' : 'text-[var(--text-muted)]', icon: AlertTriangle },
          { label: t('cmd.exceptions.acknowledged'), value: exceptions.filter(e => e.status === 'acknowledged').length, icon: CheckCircle2 },
          { label: t('cmd.exceptions.total'), value: exceptions.length, icon: Globe },
        ]}
        columns={4}
      />

      {loading ? (
        <Skeleton variant="list" count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('cmd.exceptions.noExceptions')} description={t('cmd.exceptions.allSystemsNormal')} />
      ) : (
        <div className="space-y-2">
          {filtered.map(exc => {
            const Icon = SOURCE_ICONS[exc.source] || AlertTriangle;
            return (
              <DashCard key={exc.id} padding="sm" hover className={exc.status === 'acknowledged' ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={exc.severity} />
                        <span className="text-[11px] text-[var(--text-muted)] font-mono uppercase">{exc.source}</span>
                      </div>
                      <div className="text-xs font-bold text-[var(--text-primary)] mt-1">{exc.title}</div>
                      {exc.description && <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2">{exc.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      {Math.round((Date.now() - new Date(exc.createdAt).getTime()) / 60_000)}m
                    </span>
                    {exc.status === 'active' && exc.source === 'market' && (
                      <button type="button" onClick={() => handleAcknowledge(exc.id)}
                        className="px-2 py-1 rounded-md bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[11px] text-[var(--text-muted)] cursor-pointer">
                        {t('cmd.exceptions.ack')}
                      </button>
                    )}
                  </div>
                </div>
              </DashCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
