import React from 'react';
import { CreditCard } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { useTrip } from '../../../context/TripContext';
import { summariseBudget } from '../tripBudget';

export const TripBudgetCard: React.FC = () => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const { ledgerEntries, activeTrip } = useTrip();

  const { remaining, percentSpent } = summariseBudget(
    ledgerEntries,
    activeTrip?.totalEstimatedEGP ?? 850
  );

  const barWidth = Math.min(percentSpent, 100);

  return (
    <div className={`p-6 sm:p-7 rounded-3xl border shadow-xl space-y-4 ${
      isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'
    }`}>
      <div className="flex items-center justify-between">
        <h3 className="text-base chart-heading font-bold flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--accent-secondary)]" />
          <span>{t('myTrip.budgetTitle')}</span>
        </h3>
        <span className="text-xs font-bold text-[var(--accent-primary)]">
          {percentSpent}% {t('myTrip.spent')}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}>{t('myTrip.remaining')}:</span>
          <span className="text-lg font-bold chart-heading text-[var(--accent-secondary)]">{remaining.toLocaleString()} EGP</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-[var(--surface-card)]/10 overflow-hidden">
          <div className="h-full bg-[var(--accent-primary)] rounded-full" style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
        {remaining >= 0
          ? t('myTrip.budgetRemainingWithAmount', { remaining: remaining.toLocaleString() })
          : t('myTrip.budgetExceeded')}
      </p>
    </div>
  );
};