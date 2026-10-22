import React from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Shared failure state for list pages.
 *
 * Its whole point is to be visually distinct from the empty state: a failed
 * fetch must never render as "0 results", or the user concludes there is simply
 * nothing to see. Callers pass the noun so the title names what failed.
 */
export function ErrorState({
  nounKey,
  onRetry,
  isRetrying = false,
  className = '',
}: {
  /** i18n key for the noun, e.g. 'common.noResults.nounRestaurants'. */
  nounKey: string;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <div
      role="alert"
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-16 text-center ${className}`}
    >
      <WifiOff className="mx-auto mb-4 h-10 w-10 text-[var(--text-secondary)]" aria-hidden="true" />
      <p className="text-base font-semibold text-[var(--text-primary)]">
        {t('common.error.title', 'مقدرناش نحمّل ده دلوقتي').replace(
          '{noun}',
          t(nounKey, 'الصفحة')
        )}
      </p>
      <p className="mx-auto mt-2 max-w-[42ch] text-sm text-[var(--text-secondary)]">
        {t('common.error.body', 'النت ضعيف أو السيرفر مش بيرد. جرّب تاني كمان شوية.')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-6 h-11 rounded-full bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--dg-on-accent)] transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isRetrying ? t('common.retry', 'جرّب تاني') + '…' : t('common.retry', 'جرّب تاني')}
      </button>
    </div>
  );
}