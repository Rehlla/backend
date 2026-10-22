import React, { useEffect, useState } from 'react';
import { ShieldCheck, Leaf, Eye, EyeOff, Waves } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { ReefActionLogger } from './ReefActionLogger';

interface ReliabilityScore {
  overall: number;
  sampleSize: number;
  acceptanceRate: number;
  responseSpeed: number;
  cancellationRate: number;
}

/** Same traveler-visibility threshold ReliabilityBadge applies on cards. */
const TRAVELER_VISIBLE_MIN_SAMPLE = 3;

/**
 * SupplierTrustPanel — the supplier-facing mirror of the trust signals
 * travelers see on listing cards (ReliabilityBadge / ReefBadge).
 *
 * Data-safety rules mirrored from the traveler side:
 *  - Nothing is invented: when no metric history exists the panel shows an
 *    em dash and says why, never a flattering placeholder.
 *  - Threshold honesty: below 3 measured bookings the score is real but the
 *    panel says explicitly that travelers cannot see it yet.
 *  - Reef guidance lists the server's actual point values
 *    (reefPositiveService.ACTION_POINTS), not aspirational claims.
 */
export const SupplierTrustPanel: React.FC<{ supplierId: string | null }> = ({ supplierId }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState<ReliabilityScore | null>(null);
  const [scoreLoaded, setScoreLoaded] = useState(false);
  const [reef, setReef] = useState<number | null>(null);
  const [reefLoaded, setReefLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScore(null);
    setScoreLoaded(false);
    setReef(null);
    setReefLoaded(false);
    if (!supplierId) return;
    api.getSupplierReliabilityScore(supplierId)
      .then(data => { if (!cancelled) { setScore(data); setScoreLoaded(true); } })
      .catch(() => { if (!cancelled) setScoreLoaded(true); });
    api.getSupplierReefScore(supplierId)
      .then(data => { if (!cancelled) { setReef(data); setReefLoaded(true); } })
      .catch(() => { if (!cancelled) setReefLoaded(true); });
    return () => { cancelled = true; };
  }, [supplierId]);

  if (!supplierId) return null;

  const hasSample = (score?.sampleSize ?? 0) > 0;
  const travelerVisible = (score?.sampleSize ?? 0) >= TRAVELER_VISIBLE_MIN_SAMPLE;
  const toneFor = (v: number) =>
    v >= 90 ? 'text-emerald-400' : v >= 70 ? 'text-amber-400' : 'text-rose-400';
  const barToneFor = (v: number) =>
    v >= 90 ? 'bg-emerald-400' : v >= 70 ? 'bg-amber-400' : 'bg-rose-400';

  const rows: Array<{ label: string; help: string; value: number }> = score ? [
    { label: t('reliability.acceptance'), help: t('supplier.trust.acceptanceHelp'), value: score.acceptanceRate },
    { label: t('reliability.responseSpeed'), help: t('supplier.trust.responseHelp'), value: score.responseSpeed },
    { label: t('reliability.completion'), help: t('supplier.trust.fulfillmentHelp'), value: score.cancellationRate },
  ] : [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Traveler-facing reliability */}
      <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('supplier.trust.reliabilityTitle')}</h3>
          </div>
          {scoreLoaded && travelerVisible ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border text-emerald-400 bg-emerald-500/15 border-emerald-500/30">
              <Eye className="w-3 h-3" aria-hidden="true" />{t('supplier.trust.visibleOnCards')}
            </span>
          ) : scoreLoaded ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border text-[var(--text-secondary)] bg-[var(--surface-container)] border-[var(--border-subtle)]">
              <EyeOff className="w-3 h-3" aria-hidden="true" />{t('supplier.trust.hiddenBelowThreshold')}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${scoreLoaded && score != null && score.sampleSize > 0 ? toneFor(score.overall) : 'text-[var(--text-primary)]/30'}`}>
            {scoreLoaded && score != null && score.sampleSize > 0 ? `${score.overall}%` : '—'}
          </span>
          <span className="text-xs text-[var(--text-primary)]/50">{t('supplier.trust.overall')}</span>
        </div>

        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-primary)]/80 font-medium">{row.label}</span>
                <span className={`font-bold ${hasSample ? toneFor(row.value) : 'text-[var(--text-primary)]/30'}`}>
                  {hasSample ? row.value : '—'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--surface-container)] overflow-hidden" role="presentation">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${hasSample ? barToneFor(row.value) : 'bg-[var(--border-subtle)]'}`}
                  style={{ width: `${hasSample ? Math.min(100, Math.max(0, row.value)) : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--text-primary)]/45">{row.help}</p>
            </div>
          ))}
        </div>

        {scoreLoaded && !hasSample && (
          <p className="text-[11px] text-[var(--text-primary)]/50">
            {t('supplier.trust.noMetricsYet')}
          </p>
        )}
      </div>

      {/* Reef-positive conservation score */}
      <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('supplier.trust.reefTitle')}</h3>
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${reefLoaded && reef != null && reef > 0 ? 'text-emerald-400' : 'text-[var(--text-primary)]/30'}`}>
            {reefLoaded && reef != null && reef > 0 ? reef : '—'}
          </span>
          <span className="text-xs text-[var(--text-primary)]/50">{t('supplier.trust.reefPoints')}</span>
        </div>

        {reefLoaded && reef != null && reef > 0 ? (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {t('supplier.trust.reefBody', { points: String(reef) })}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-primary)]/50">
            {t('supplier.trust.noReefActions')}
          </p>
        )}

        <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)]/70 mb-1">
            <Waves className="w-3 h-3 text-emerald-400" aria-hidden="true" />
            {t('supplier.trust.reefHowTitle')}
          </div>
          <p className="text-[11px] text-[var(--text-primary)]/55 leading-relaxed">
            {t('supplier.trust.reefHow')}
          </p>
        </div>

        {/* Record an eco-action the traveler's points should reflect. */}
        <ReefActionLogger supplierId={supplierId} />
      </div>
    </div>
  );
};
