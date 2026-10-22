import React, { useEffect, useState } from 'react';
import { Waves, Wind } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

interface MarineSuitability {
  activityId: string;
  title: string;
  titleAr: string;
  verdict: 'go' | 'caution' | 'avoid';
  reasons: { en: string; ar: string }[];
}

interface MarineTelemetry {
  available: boolean;
  observedAt?: string;
  source?: string;
  kind?: string;
  reading?: {
    waveHeightM: number | null;
    windWaveM: number | null;
    swellWaveM: number | null;
    swellDirectionDegrees: number | null;
    swellPeriodSeconds: number | null;
    waterTempC: number | null;
  };
  windKnots?: number | null;
  suitability?: MarineSuitability[];
}

/**
 * MarineConditions — modeled sea state + per-activity suitability.
 *
 * Self-contained: fetches once on mount, renders nothing but an honest
 * unavailable note when the model cannot be read. Wave numbers are always
 * labeled as model output (see live.modelNote); verdicts come from written
 * thresholds, never from the wave height.
 */
export const MarineConditions: React.FC = () => {
  const { language, t } = useLanguage();
  const [data, setData] = useState<MarineTelemetry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getMarineTelemetry()
      .then(d => {
        if (!cancelled && d?.available) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;
  if (!data) {
    return (
      <section aria-label={t('live.marineTitle')} className="rounded-3xl bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] p-5 text-center">
        <p className="text-xs text-[var(--text-secondary)]">{t('live.marineUnavailable')}</p>
      </section>
    );
  }

  const reading = data.reading;
  const verdictTone: Record<string, string> = {
    go: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    caution: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
    avoid: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  };

  const fmt = (v: number | null | undefined, unit: string) =>
    v === null || v === undefined ? '—' : `${v} ${unit}`;

  return (
    <section aria-label={t('live.marineTitle')} className="rounded-3xl bg-[var(--surface-card)] text-[var(--text-primary)] border border-[#1B9A8B]/30 shadow-2xl overflow-hidden">
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="chart-heading text-xl font-bold flex items-center gap-2">
            <Waves className="w-5 h-5 text-[var(--accent-primary)]" aria-hidden="true" />
            {t('live.marineTitle')}
          </h2>
          <span className="text-[11px] text-[var(--text-secondary)]">{t('live.modelNote')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-secondary)]">
              <Waves className="w-4 h-4" aria-hidden="true" />
              <span>{t('live.waveHeight')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold">{fmt(reading?.waveHeightM, 'm')}</div>
          </div>
          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-secondary)]">
              <Wind className="w-4 h-4" aria-hidden="true" />
              <span>{t('live.swell')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold">{fmt(reading?.swellWaveM, 'm')}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {reading?.swellPeriodSeconds != null ? `${reading.swellPeriodSeconds}s` : '—'}
            </div>
          </div>
          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)]">
              <span>{t('live.waterTemp')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold">
              {reading?.waterTempC != null ? `${reading.waterTempC}°C` : '—'}
            </div>
          </div>
          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)]">
              <Wind className="w-4 h-4" aria-hidden="true" />
              <span>{t('live.windLabel')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold">
              {data.windKnots != null ? `${data.windKnots} kn` : '—'}
            </div>
          </div>
        </div>

        {(data.suitability?.length || 0) > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold">{t('live.suitabilityTitle')}</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.suitability!.slice(0, 8).map(s => (
                <li
                  key={s.activityId}
                  className={`flex items-start gap-2.5 p-3 rounded-2xl border ${verdictTone[s.verdict] || verdictTone.caution}`}
                >
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-black/20 whitespace-nowrap mt-0.5">
                    {t(`live.verdict.${s.verdict}`)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-[var(--text-primary)]">
                      {language === 'ar' ? s.titleAr || s.title : s.title}
                    </span>
                    {s.reasons[0] && (
                      <span className="block text-[11px] text-[var(--text-secondary)] leading-snug">
                        {language === 'ar' ? s.reasons[0].ar : s.reasons[0].en}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

export default MarineConditions;
