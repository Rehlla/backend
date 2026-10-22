import React, { useState, useEffect, useCallback } from 'react';
import { HeartPulse, RefreshCw, Cloud, Camera } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader, StatusBadge, DashCard, EmptyState, Skeleton, MetricGrid } from './ui';

export default function SystemHealth() {
  const { language, t } = useLanguage();
  const [health, setHealth] = useState<any>(null);
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [jobs, setJobs] = useState<any>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [h, m, j, integ, w, cam] = await Promise.allSettled([
        api.getHealthData(), api.getMarketStatus(), api.getBackgroundJobsStatus(),
        api.getOperationsIntegrations(), api.getWeatherTelemetry(), api.getCameraFeeds(),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (m.status === 'fulfilled') setMarketStatus(m.value);
      if (j.status === 'fulfilled') setJobs(j.value);
      if (integ.status === 'fulfilled') setIntegrations((integ.value as any)?.integrations || []);
      if (w.status === 'fulfilled') setWeather(w.value);
      if (cam.status === 'fulfilled') setCameras((cam.value as any)?.spots || (cam.value as any)?.cameras || (cam.value as any)?.feeds || []);
    } catch { /* non-critical */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 60_000); return () => clearInterval(i); }, [fetchData]);

  const services = [
    { name: t('cmd.health.apiGateway'), status: health?.status === 'ok' ? 'healthy' : 'down', details: health?.service || 'Dahab Platform' },
    { name: t('cmd.health.database'), status: health?.database?.adapter ? 'healthy' : 'unknown', details: health?.database?.adapter || 'Unknown adapter', meta: health?.database ? `${health.database.users} users · ${health.database.trips} trips` : undefined },
    { name: t('cmd.health.payments'), status: health?.paymentsSimulated ? 'degraded' : 'healthy', details: health?.paymentsSimulated ? t('cmd.health.simulatedMode') : t('cmd.health.realGateway') },
    { name: t('cmd.health.geminiAi'), status: health?.aiConfigured ? (health?.aiQuota?.exhausted ? 'degraded' : 'healthy') : 'down', details: health?.aiConfigured ? `Model: ${health.aiModel || '?'}` : t('cmd.health.loading') },
    { name: t('cmd.health.firebaseAuth'), status: health?.firebaseAdminConfigured ? 'healthy' : 'degraded', details: health?.firebaseAdminConfigured ? 'Federated sign-in' : t('cmd.health.loading') },
    { name: t('cmd.health.ledgerIntegrity'), status: health?.ledger?.valid ? 'healthy' : health?.ledger ? 'down' : 'unknown', details: health?.ledger ? `${health.ledger.totalEntries} entries · ${health.ledger.valid ? 'Valid' : 'INVALID'}` : 'Unknown' },
    { name: t('cmd.health.marketIntelligence'), status: typeof marketStatus?.activeSourcesCount === 'number' ? 'healthy' : 'unknown', details: typeof marketStatus?.activeSourcesCount === 'number' ? `${marketStatus.activeSourcesCount} sources` : 'Unknown' },
    { name: t('cmd.health.backgroundJobs'), status: typeof jobs?.activeJobsCount === 'number' ? 'healthy' : 'unknown', details: typeof jobs?.activeJobsCount === 'number' ? `${jobs.activeJobsCount} active` : 'Unknown' },
  ];

  const healthyCount = services.filter(s => s.status === 'healthy').length;

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={HeartPulse}
        iconColor="text-emerald-400"
        title={t('cmd.health.title')}
        subtitle={t('cmd.health.servicesHealthy').replace('${healthy}', String(healthyCount)).replace('${total}', String(services.length))}
        actions={
          <button type="button" onClick={fetchData} aria-label={t('cmd.overview.refresh')}
            className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-muted)] cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {loading ? (
        <Skeleton variant="card" count={4} />
      ) : (
        <>
          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((svc, i) => (
              <DashCard key={i} padding="sm" glow={svc.status === 'healthy' ? 'green' : svc.status === 'down' ? 'red' : 'none'}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{svc.name}</div>
                  <StatusBadge status={svc.status} dot />
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">{svc.details}</div>
                {svc.meta && <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">{svc.meta}</div>}
              </DashCard>
            ))}
          </div>

          {/* Integrations */}
          {integrations.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[var(--text-muted)] mb-3">{t('cmd.health.integrations')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {integrations.map((integ: any, i: number) => (
                  <DashCard key={i} padding="sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">{integ.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{integ.purpose}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">{integ.freshness}</span>
                        <StatusBadge status={integ.status || 'unknown'} />
                      </div>
                    </div>
                  </DashCard>
                ))}
              </div>
            </div>
          )}

          {/* Weather */}
          {weather && weather.available !== false && (
            <DashCard>
              <div className="flex items-center gap-2 mb-3">
                <Cloud className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">{t('cmd.health.weatherTelemetry')}</h4>
              </div>
              <MetricGrid
                metrics={[
                  { label: t('cmd.health.air'), value: `${weather.airTemperatureC ?? '—'}°C`, color: 'text-sky-400' },
                  { label: t('cmd.health.water'), value: `${weather.waterTemperatureC ?? '—'}°C`, color: 'text-sky-400' },
                  { label: t('cmd.health.wind'), value: `${weather.wind?.speedKnots ?? '—'} kn`, color: 'text-sky-400' },
                  { label: t('cmd.health.condition'), value: weather.condition ?? '—', color: 'text-sky-400' },
                ]}
                columns={4}
              />
              {weather.observedAt && (
                <div className="text-[10px] text-[var(--text-muted)] font-mono mt-2">
                  Observed {new Date(weather.observedAt).toLocaleString()} · {weather.source || t('cmd.health.weatherService')}
                </div>
              )}
            </DashCard>
          )}

          {/* Camera Feeds */}
          {cameras.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-[var(--accent-primary)]" />
                <h4 className="text-xs font-bold text-[var(--text-muted)]">{t('cmd.health.dahabSpots')} ({cameras.length})</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cameras.slice(0, 4).map((cam: any, i: number) => (
                  <DashCard key={i} padding="sm">
                    <div className="text-xs font-bold text-[var(--text-primary)]">{cam.name || cam.shortName || `${t('cmd.health.spot')} ${i + 1}`}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{cam.orientation || '—'}</div>
                    {cam.conditions && (
                      <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                        {cam.conditions.waterTempC != null && `${cam.conditions.waterTempC}°C water`}
                        {cam.conditions.airTempC != null && ` · ${cam.conditions.airTempC}°C air`}
                        {cam.conditions.windKnots != null && ` · ${cam.conditions.windKnots} kn`}
                      </div>
                    )}
                  </DashCard>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-[10px] text-[var(--text-muted)]">
            {t('cmd.health.lastChecked')}: {new Date().toLocaleTimeString()} · {t('cmd.health.autoRefreshes')}
          </div>
        </>
      )}
    </div>
  );
}
