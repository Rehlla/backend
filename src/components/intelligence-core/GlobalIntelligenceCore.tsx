import React, { useState } from 'react';
import { Brain, X } from 'lucide-react';
import { useIntelligenceCore } from './useIntelligenceCore';
import { OrbVisualization, orbLabel } from './OrbVisualization';
import { Conversation } from './Conversation';
import { CommandUI } from './CommandUI';
import { ActionPlan } from './ActionPlan';
import { ORB_STATE_LABEL, type IntelContext } from './types';

interface Props {
  context: IntelContext;
}

/**
 * Global floating Core: available from every admin section. Compact orb
 * button → expandable frosted panel with quick command, recent
 * conversation, attention summary and deep-link into the full section.
 * Context-aware: understands "this booking" from the current selection.
 */
export const GlobalIntelligenceCore: React.FC<Props> = ({ context }) => {
  const [open, setOpen] = useState(false);
  const { state, dispatch, ask, confirmPending, language, t } = useIntelligenceCore(context);
  const fabRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const lastReply = React.useMemo(() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'core') return state.messages[i].text;
    }
    return undefined;
  }, [state.messages]);

  const close = React.useCallback(() => {
    setOpen(false);
    // Return focus to the FAB that opened the dialog.
    fabRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      {/*
        The floating button sits above the bottom tab bar on mobile and above
        the fixed journey widget (bottom-right, z-50) on desktop, so it is
        always clickable.
      */}
      <button
        type="button"
        ref={fabRef}
        data-testid="intel-fab"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={t('intel.openCore', 'Open Intelligence Core')}
        className="fixed bottom-28 end-4 lg:end-6 z-[60] w-14 h-14 rounded-full bg-[var(--surface-container)]/90 backdrop-blur border border-[var(--accent-primary)]/40 shadow-lg hover:scale-105 transition-transform cursor-pointer flex items-center justify-center"
      >
        <span className="pointer-events-none">
          <OrbVisualization state={state.orb} attentionCount={state.attentionTotal} size={44} compact />
        </span>
        {state.attentionTotal > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center">
            {state.attentionTotal > 9 ? '9+' : state.attentionTotal}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="intel-panel"
          className="fixed bottom-44 end-4 lg:end-6 z-[60] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/95 backdrop-blur shadow-2xl overflow-hidden"
          role="dialog"
          aria-label={t('intel.title', 'Intelligence Core')}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
            <Brain className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-bold text-[var(--text-primary)] flex-1">
              {t('intel.title', 'Intelligence Core')}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]" role="status">
              {orbLabel(state.orb, t)}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label={t('cmd.close', 'Close')}
              className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] cursor-pointer"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {state.attentionSummary && (
              <p className="text-xs text-[var(--text-muted)]" role="status">
                {state.attentionSummary}
              </p>
            )}
            <Conversation messages={state.messages.slice(-6)} busy={state.busy} t={t} />
            <ActionPlan
              confirm={state.confirm}
              result={state.confirmResult}
              busy={state.busy}
              onConfirm={() => void confirmPending()}
              onCancel={() => dispatch({ type: 'confirm-set', value: null })}
              t={t}
            />
            {state.error && (
              <p className="text-xs text-red-300" role="alert">
                {state.error}
              </p>
            )}
            <CommandUI busy={state.busy} onAsk={ask} t={t} language={language} compact speakText={lastReply} inputId="intel-command-floating" inputRef={inputRef} />
            <a
              href="#core"
              onClick={close}
              className="block text-center text-xs font-bold text-[var(--accent-primary)] hover:underline"
            >
              {t('intel.openFull', 'Open full Command Center')}
            </a>
          </div>
        </div>
      )}
    </>
  );
};
