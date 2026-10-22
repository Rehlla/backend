import React from 'react';
import { Brain } from 'lucide-react';
import type { IntelMessage } from './types';
import { EmptyState } from '../operations/command-center/ui';

interface Props {
  messages: IntelMessage[];
  busy: boolean;
  t: (key: string, fallback?: string) => string;
}

export const Conversation: React.FC<Props> = ({ messages, busy, t }) => {
  const bottomRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }, [messages.length, busy]);

  if (messages.length === 0 && !busy) {
    return (
      <EmptyState
        icon={Brain}
        title={t('intel.emptyTitle', 'Ask about operations')}
        description={t(
          'intel.emptyBody',
          'Try "What needs my attention?", "Show pending supplier bookings", or "Find booking DH-1024". Answers come from live Dahab data.',
        )}
      />
    );
  }

  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pe-1" role="log" aria-live="polite" aria-label={t('intel.conversation', 'Conversation')}>
      {messages.map(m => (
        <div key={m.id} className={`flex ${m.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'admin'
                ? 'bg-[var(--accent-primary)]/15 text-[var(--text-primary)] border border-[var(--accent-primary)]/25'
                : m.role === 'system'
                  ? 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border border-[var(--border-subtle)] text-xs'
                  : 'bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
            }`}
          >
            <p>{m.text}</p>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-[var(--border-subtle)] pt-2">
                {m.toolCalls.map(c => (
                  <li key={c.tool} className="text-[11px] text-[var(--text-muted)]">
                    <span className={c.ok ? 'text-emerald-400' : 'text-amber-400'}>{c.ok ? '●' : '○'}</span>{' '}
                    {c.tool}
                    {c.summary ? ` — ${c.summary}` : ''}
                    {c.error ? ` — ${c.error}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
      {busy && (
        <div className="flex justify-start">
          <div className="rounded-2xl px-3.5 py-2.5 bg-[var(--surface-container)] border border-[var(--border-subtle)]">
            <span className="inline-flex gap-1" aria-label={t('intel.thinking', 'Thinking')}>
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};
