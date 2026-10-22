import React, { useState, useEffect } from 'react';
import { Leaf, Waves } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * ReefBadge — displays a supplier's reef-positive conservation score.
 * Teal is reserved for live-data ink in the Dahab design system, but
 * conservation is a *nature* signal, so this badge uses emerald (the same
 * family the eco-action UI already uses) to avoid overloading the teal
 * telemetry channel.
 */
export const ReefBadge: React.FC<{ supplierId: string; className?: string }> = ({ supplierId, className = '' }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getSupplierReefScore(supplierId).then(data => {
      if (!cancelled && data != null && data > 0) setScore(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [supplierId]);

  if (score == null) return null;

  return (
    <div
      className={`relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border text-emerald-400 bg-emerald-500/15 border-emerald-500/30 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Leaf className="w-3 h-3" aria-hidden="true" />
      <span>{score}</span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-lg text-[10px] text-left whitespace-nowrap z-50">
          <div className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1">
            <Waves className="w-3 h-3 text-emerald-400" />
            {t('reef.badgeTitle')}
          </div>
          <div className="text-[var(--text-secondary)]">
            {t('reef.badgeBody', { score: String(score) })}
          </div>
        </div>
      )}
    </div>
  );
};
