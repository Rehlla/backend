import React from 'react';
import { AlertTriangle, Brain, MessageSquare, RefreshCw } from 'lucide-react';
import { useIntelligenceCore } from './useIntelligenceCore';
import { OrbVisualization, orbLabel } from './OrbVisualization';
import { Conversation } from './Conversation';
import { CommandUI } from './CommandUI';
import { AttentionPanel } from './AttentionPanel';
import { ActionPlan } from './ActionPlan';
import { AuditTrail } from './AuditTrail';
import { GestureControl } from './GestureControl';
import { ORB_STATE_LABEL, type IntelContext } from './types';
import type { DahabOrbApi } from '../../lib/dahabOrbScene';
import { DashCard, SectionHeader, MetricGrid } from '../operations/command-center/ui';

interface Props {
  context?: IntelContext;
}

/**
 * Dedicated Intelligence Command Center (CommandCenterShell section "core").
 * Large Orb + conversation + Attention Required + KPIs + confirmation flow.
 */
export default function IntelligenceCoreView({ context = {} }: Props) {
  const { state, dispatch, ask, requestAction, confirmPending, refreshAttention, language, t } = useIntelligenceCore(context);
  const orbApi = React.useRef<DahabOrbApi | null>(null);

  // Latest Core reply for the read-aloud (TTS) button.
  const lastReply = React.useMemo(() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'core') return state.messages[i].text;
    }
    return undefined;
  }, [state.messages]);

  const inspectItem = React.useCallback((item: { entityType: string; entityId: string; safeTool?: string }) => {
    if (item.entityType === 'Booking' && item.entityId) {
      void ask(`Find booking ${item.entityId}. Why is it pending and what should I do?`);
    } else if (item.safeTool === 'getSupplierPerformance') {
      void ask('Which suppliers have the highest cancellation rate?');
    } else if (item.safeTool === 'getInventoryAlerts') {
      void ask('Show low inventory products.');
    } else if (item.safeTool === 'getRecentErrors') {
      void ask('Show recent errors and system health.');
    } else if (item.safeTool === 'getMarketIntelligence') {
      void ask('Show market intelligence alerts.');
    } else {
      void ask('What needs my attention?');
    }
  }, [ask]);

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Brain}
        title={t('intel.title', 'Intelligence Core')}
        subtitle={t('intel.subtitle', 'Operational command center')}
        badge={state.attentionTotal > 0 ? { count: state.attentionTotal } : undefined}
        actions={
          <div className="flex items-center gap-2">
            <GestureControl
              onRotate={(dx, dy) => orbApi.current?.rotate(dx, dy)}
              onZoom={f => orbApi.current?.zoom(f)}
            />
            <button
              type="button"
              onClick={() => void refreshAttention()}
              className="p-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label={t('intel.refresh', 'Refresh')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {state.error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300 flex items-center justify-between gap-3" role="alert">
          <span>{state.error}</span>
          <button type="button" onClick={() => dispatch({ type: 'clear-error' })} className="text-xs font-bold underline cursor-pointer">
            {t('intel.dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <DashCard>
          <div className="text-center" data-testid="intel-orb">
            <OrbVisualization state={state.orb} attentionCount={state.attentionTotal} size={240} apiRef={orbApi} />
            <p className="text-xs font-bold text-[var(--text-muted)] mt-2" role="status">
              {orbLabel(state.orb, t)}
              {state.attentionTotal > 0 ? ` · ${state.attentionTotal}` : ''}
            </p>
          </div>
          <div className="mt-4">
            <MetricGrid
              columns={2}
              metrics={[
                { label: t('intel.kpiAttention', 'Attention'), value: String(state.attentionTotal), icon: AlertTriangle },
                { label: t('intel.kpiMessages', 'Exchanges'), value: String(state.messages.length), icon: MessageSquare },
              ]}
            />
          </div>
        </DashCard>

        <DashCard>
          <Conversation messages={state.messages} busy={state.busy} t={t} />
          <div className="mt-3">
            <CommandUI busy={state.busy} onAsk={ask} t={t} language={language} speakText={lastReply} />
          </div>
        </DashCard>
      </div>

      <ActionPlan
        confirm={state.confirm}
        result={state.confirmResult}
        busy={state.busy}
        onConfirm={() => void confirmPending()}
        onCancel={() => dispatch({ type: 'confirm-set', value: null })}
        t={t}
      />

      <AttentionPanel
        items={state.attention}
        total={state.attentionTotal}
        summary={state.attentionSummary}
        onInspect={inspectItem}
        t={t}
      />

      <AuditTrail t={t} />

      {state.lastTools.length > 0 && (
        <DashCard>
          <SectionHeader icon={Brain} title={t('intel.lastTools', 'Last tool calls')} />
          <ul className="mt-2 text-xs text-[var(--text-muted)] space-y-1">
            {state.lastTools.map(tool => (
              <li key={tool.tool}>
                {tool.tool} — {tool.ok ? (tool.summary || 'ok') : (tool.error || 'failed')}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            {t('intel.mutationHint', 'Mutations need confirmation. Example: ask to cancel a booking, then confirm the action plan.')}
            {' '}
            <button
              type="button"
              className="underline cursor-pointer"
              onClick={() => void requestAction('getBookings', { limit: 5 }).then(() => undefined)}
            >
              {t('intel.tryRead', 'Run a read tool')}
            </button>
          </p>
        </DashCard>
      )}
    </div>
  );
}
