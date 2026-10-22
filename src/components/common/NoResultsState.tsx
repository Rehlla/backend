import React from 'react';
import { SearchX } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

type Cause = 'search' | 'filter';

/**
 * Shared empty state for filtered lists (hotels, restaurants, experiences).
 *
 * The copy is chosen by *cause*, not by page: telling someone who merely typed
 * a query to "widen your filters" is nonsense when they never touched one. So a
 * search gets search copy with a clear-search CTA, and an actual filter
 * combination gets filter copy with a clear-all-filters CTA.
 */
export function NoResultsState({
  cause,
  query,
  nounKey,
  onClear,
  className = '',
}: {
  cause: Cause;
  /** Only used when cause === 'search'. */
  query?: string;
  /** i18n key for the noun, e.g. 'common.noResults.nounHotels'. */
  nounKey: string;
  onClear: () => void;
  className?: string;
}) {
  const { t } = useLanguage();

  const isSearch = cause === 'search';
  const title = isSearch
    ? t('common.noResults.searchTitle', 'مفيش نتايج').replace('{query}', query ?? '')
    : t('common.noResults.filterTitle', 'مفيش نتايج').replace('{noun}', t(nounKey, 'نتايج'));
  const body = isSearch
    ? t('common.noResults.searchBody', 'جرّب كلمة تانية، أو امسح البحث.')
    : t('common.noResults.filterBody', 'شيل فلتر أو اتنين وجرّب تاني.');
  const cta = isSearch
    ? t('common.noResults.searchCta', 'امسح البحث')
    : t('common.noResults.filterCta', 'شيل كل الفلاتر');

  return (
    <div
      role="status"
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-16 text-center ${className}`}
    >
      <SearchX className="mx-auto mb-4 h-12 w-12 text-[var(--text-secondary)]" aria-hidden="true" />
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mx-auto mt-2 max-w-[42ch] text-sm text-[var(--text-secondary)]">{body}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-6 h-11 rounded-full bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--dg-on-accent)] transition-colors hover:opacity-90"
      >
        {cta}
      </button>
    </div>
  );
}