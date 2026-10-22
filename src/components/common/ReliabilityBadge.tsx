import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, CalendarCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

interface ReliabilityScore {
  overall: number;
  sampleSize: number;
  acceptanceRate: number;
  responseSpeed: number;
  cancellationRate: number;
}

/**
 * ReliabilityBadge — displays a supplier's reliability score as a compact badge.
 *
 * The score is computed server-side from SupplierMetric events (requests,
 * accepts, response times, cancellations). Hidden entirely below 3 booking
 * events: a percentage from one or two samples is noise, not trust.
 */
export const ReliabilityBadge: React.FC<{ supplierId: string; className?: string }> = ({ supplierId, className = '' }) => {
  const { language, t } = useLanguage();
  const [score, setScore] = useState<ReliabilityScore | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getSupplierReliabilityScore(supplierId).then(data => {
      if (!cancelled && data && data.sampleSize >= 3) setScore(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [supplierId]);

  if (!score) return null;

  // Color coding: 90+ green, 70-89 amber, <70 red
  const colorClass = score.overall >= 90
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    : score.overall >= 70
    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
    : 'text-rose-400 bg-rose-500/15 border-rose-500/30';

  return (
    <div
      className={`relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClass} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
      <span>{score.overall}%</span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-lg text-[10px] text-left whitespace-nowrap z-50" dir="ltr">
          <div className="font-bold text-[var(--text-primary)] mb-1">{t('reliability.title')}</div>
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <CalendarCheck className="w-3 h-3" />
            {t('reliability.acceptance')}: {score.acceptanceRate}%
          </div>
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Clock className="w-3 h-3" />
            {t('reliability.responseSpeed')}: {score.responseSpeed}/100
          </div>
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <ShieldCheck className="w-3 h-3" />
            {t('reliability.completion')}: {score.cancellationRate}%
          </div>
          <div className="text-[var(--text-secondary)]/60 mt-1">
            {score.sampleSize} {t('reliability.bookings')}
          </div>
        </div>
      )}
    </div>
  );
};
