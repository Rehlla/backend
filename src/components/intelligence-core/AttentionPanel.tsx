import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AttentionItem } from './types';
import { DashCard, SectionHeader, StatusBadge, EmptyState, Skeleton } from '../operations/command-center/ui';

interface Props {
  items: AttentionItem[];
  total: number;
  summary: string;
  loading?: boolean;
  onInspect?: (item: AttentionItem) => void;
  t: (key: string, fallback?: string) => string;
}

export const AttentionPanel: React.FC<Props> = ({ items, total, summary, loading, onInspect, t }) => {
  if (loading) return <Skeleton variant="list" count={3} />;
  return (
    <DashCard>
      <SectionHeader
        icon={AlertTriangle}
        iconColor="text-amber-400"
        title={t('intel.attention', 'Attention Required')}
        badge={total > 0 ? { count: total, color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' } : undefined}
      />
      {summary ? <p className="text-sm text-[var(--text-muted)] mb-3">{summary}</p> : null}
      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('intel.attentionClear', 'All clear')} description={t('intel.attentionClearBody', 'No operational exceptions right now.')} />
      ) : (
        <ul className="space-y-2" aria-label={t('intel.attention', 'Attention Required')}>
          {items.slice(0, 12).map(item => (
            <li
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={item.severity} />
                  <span className="text-[11px] text-[var(--text-muted)]">{item.category.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.reason}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.recommendedAction}</p>
              </div>
              {onInspect ? (
                <button
                  type="button"
                  onClick={() => onInspect(item)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] cursor-pointer"
                >
                  {t('intel.inspect', 'Inspect')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
};
