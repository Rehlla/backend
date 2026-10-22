import React, { useState, useEffect, useCallback } from 'react';
import { Globe, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp, Database, Lightbulb, BarChart3 } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader, TabBar, StatusBadge, EmptyState, DashCard, Skeleton, MetricGrid, DataTable } from './ui';

export default function IntelligenceCommand() {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [refreshResult, setRefreshResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOpp, setActingOpp] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ovData, srcData, alertData, oppData, featData, phData] = await Promise.allSettled([
        api.getMarketOpsOverview(), api.getMarketSourceHealth(), api.getMarketAlerts(),
        api.getIntelligenceOpportunities(), api.getIntelligenceFeatures(), api.getMarketPriceHistory(),
      ]);
      if (ovData.status === 'fulfilled') setOverview(ovData.value);
      if (srcData.status === 'fulfilled') setSources((srcData.value as any)?.health || (srcData.value as any)?.sources || []);
      if (alertData.status === 'fulfilled') setAlerts((alertData.value as any)?.alerts || []);
      if (oppData.status === 'fulfilled') setOpportunities((oppData.value as any)?.opportunities || oppData.value || []);
      if (featData.status === 'fulfilled') setFeatures((featData.value as any)?.features || featData.value || []);
      if (phData.status === 'fulfilled') setPriceHistory((phData.value as any)?.observations || []);
    } catch { /* Non-critical */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30_000); return () => clearInterval(i); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await api.refreshMarketIntelligence();
      setRefreshResult(result);
      await fetchData();
    } catch (err: any) { setRefreshResult({ status: 'FAILURE', message: err.message }); } finally { setRefreshing(false); }
  };

  const handleAckAlert = async (id: string) => {
    try { await api.acknowledgeMarketAlert(id, 'Operations'); setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a)); } catch {}
  };

  const handleOppAction = async (id: string, action: 'accept' | 'reject' | 'defer') => {
    setActingOpp(id);
    try {
      await api.actOnOpportunity(id, action);
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: action === 'accept' ? 'ACCEPTED' : action === 'reject' ? 'REJECTED' : 'DEFERRED' } : o));
    } catch (err: any) { alert(`${t('cmd.intel.failed')} ${err.message}`); } finally { setActingOpp(null); }
  };

  const tabs = [
    { id: 'overview', label: t('cmd.intel.overview') },
    { id: 'sources', label: t('cmd.intel.sources'), count: sources.length || undefined },
    { id: 'alerts', label: t('cmd.intel.alerts'), count: alerts.filter(a => !a.acknowledged).length || undefined },
    { id: 'opportunities', label: t('cmd.intel.opportunities'), count: opportunities.filter(o => !['ACCEPTED', 'REJECTED', 'DEFERRED'].includes(o.status)).length || undefined },
    { id: 'features', label: t('cmd.intel.features') },
    { id: 'price-history', label: t('cmd.intel.priceHistory') },
    { id: 'refresh', label: t('cmd.intel.refresh') },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Globe}
        iconColor="text-[var(--accent-primary)]"
        title={t('cmd.intel.title')}
        actions={<TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />}
      />

      {activeTab === 'overview' && (
        loading ? <Skeleton variant="card" /> : (
          <DashCard>
            <h4 className="text-xs font-bold text-[var(--text-muted)] mb-3">{t('cmd.intel.status')}</h4>
            {overview ? (
              <MetricGrid metrics={[
                { label: t('cmd.intel.activeSources'), value: overview?.overview?.activeSourcesCount ?? overview?.activeSourcesCount ?? '—', icon: Database },
                { label: t('cmd.intel.observations'), value: overview?.overview?.totalPriceObservations ?? overview?.totalPriceObservations ?? '—', icon: BarChart3 },
                { label: t('cmd.intel.changesDetected'), value: overview?.overview?.recentChangeEventsCount ?? overview?.recentChangeEventsCount ?? '—', icon: TrendingUp },
                { label: t('cmd.intel.alerts'), value: alerts.filter(a => !a.acknowledged).length, icon: AlertTriangle },
              ]} columns={4} />
            ) : <div className="text-xs text-[var(--text-muted)]">{t('cmd.loading')}</div>}
          </DashCard>
        )
      )}

      {activeTab === 'sources' && (
        <div className="space-y-2">
          {sources.length === 0 ? (
            <EmptyState icon={Database} title={t('cmd.intel.noSources')} />
          ) : sources.map((src: any, i: number) => (
            <DashCard key={src.id || i} padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">{src.sourceReference || src.sourceId}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{src.sourceType}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{src.totalRuns || 0} runs · {src.successfulRuns || 0} ok</span>
                  <StatusBadge status={src.healthStatus || 'UNKNOWN'} />
                </div>
              </div>
            </DashCard>
          ))}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={t('cmd.intel.noAlerts')} />
          ) : alerts.map((alert: any) => (
            <DashCard key={alert.id} padding="sm" className={alert.acknowledged ? 'opacity-60' : ''}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={alert.severity || 'MEDIUM'} dot />
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{alert.titleEn || alert.titleAr}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{alert.alertType} · {alert.severity}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!alert.acknowledged && (
                    <button type="button" onClick={() => handleAckAlert(alert.id)}
                      className="px-2 py-1 rounded-md bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[11px] text-[var(--text-muted)] cursor-pointer">
                      {t('cmd.exceptions.ack')}
                    </button>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{Math.round((Date.now() - new Date(alert.createdAt).getTime()) / 60_000)}m</span>
                </div>
              </div>
            </DashCard>
          ))}
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="space-y-3">
          {opportunities.length === 0 ? (
            <EmptyState icon={Lightbulb} title={t('cmd.intel.noOpportunities')} />
          ) : opportunities.map((opp: any) => {
            const isDecided = opp.status === 'ACCEPTED' || opp.status === 'REJECTED' || opp.status === 'DEFERRED';
            return (
              <DashCard key={opp.id} padding="sm" className={isDecided ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {opp.category && <StatusBadge status={opp.category} />}
                      {isDecided && <StatusBadge status={opp.status} />}
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)] mt-1">{opp.title || opp.description || t('cmd.intel.opportunity')}</div>
                  </div>
                  {!isDecided && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button type="button" onClick={() => handleOppAction(opp.id, 'accept')} disabled={actingOpp === opp.id}
                        className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-bold cursor-pointer disabled:opacity-50">{t('cmd.intel.accept')}</button>
                      <button type="button" onClick={() => handleOppAction(opp.id, 'defer')} disabled={actingOpp === opp.id}
                        className="px-2 py-1 rounded-md bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold cursor-pointer disabled:opacity-50">{t('cmd.intel.defer')}</button>
                      <button type="button" onClick={() => handleOppAction(opp.id, 'reject')} disabled={actingOpp === opp.id}
                        className="px-2 py-1 rounded-md bg-red-500/15 text-red-400 text-[11px] font-bold cursor-pointer disabled:opacity-50">{t('cmd.intel.reject')}</button>
                    </div>
                  )}
                </div>
              </DashCard>
            );
          })}
        </div>
      )}

      {activeTab === 'features' && (
        <div className="space-y-2">
          {features.length === 0 ? (
            <EmptyState icon={BarChart3} title={t('cmd.intel.noFeatures')} />
          ) : features.map((f: any, i: number) => (
            <DashCard key={f.id || i} padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">{f.name || f.feature || f.id}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{f.description?.substring(0, 100) || f.category || ''}</div>
                </div>
                <StatusBadge status={f.status || f.state || 'UNKNOWN'} />
              </div>
            </DashCard>
          ))}
        </div>
      )}

      {activeTab === 'price-history' && (
        priceHistory.length === 0 ? (
          <EmptyState icon={TrendingUp} title={t('cmd.intel.noPriceHistory')} />
        ) : (
          <DataTable
            columns={[
              { key: 'item', header: t('cmd.intel.item'), render: (ph: any) => <span className="text-[var(--accent-primary)]">{ph.offerId || ph.itemName || '—'}</span> },
              { key: 'supplier', header: t('cmd.intel.supplier'), render: (ph: any) => <span className="text-[var(--text-muted)]">{ph.supplierId || ph.supplierName || '—'}</span> },
              { key: 'price', header: t('cmd.intel.price'), align: 'right', render: (ph: any) => <span className="font-bold text-[var(--accent-secondary)]">{ph.priceEGP?.toLocaleString() || ph.price || '—'} EGP</span> },
              { key: 'date', header: t('cmd.intel.date'), render: (ph: any) => <span className="text-[var(--text-muted)]">{ph.observedAt ? new Date(ph.observedAt).toLocaleDateString() : '—'}</span> },
            ]}
            data={priceHistory.slice(0, 30).map((ph: any, i: number) => ({ ...ph, id: `ph-${i}` }))}
          />
        )
      )}

      {activeTab === 'refresh' && (
        <DashCard>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('cmd.intel.refreshTitle')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('cmd.intel.refreshDesc')}</p>
            </div>
            <button type="button" onClick={handleRefresh} disabled={refreshing}
              className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--accent-contrast,#fff)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? t('cmd.intel.refreshing') : t('cmd.intel.refreshBtn')}
            </button>
          </div>
          {refreshResult && (
            <div className={`mt-4 p-4 rounded-xl border ${refreshResult.refreshStatus === 'SUCCESS' || refreshResult.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
              <div className="text-xs font-bold">
                {refreshResult.refreshStatus === 'SUCCESS' || refreshResult.status === 'success'
                  ? `Refreshed · ${refreshResult.changesDetectedCount ?? 0} changes detected ✓`
                  : `${t('cmd.intel.failed')} ${refreshResult.message || 'Unknown error'}`}
              </div>
            </div>
          )}
        </DashCard>
      )}
    </div>
  );
}
