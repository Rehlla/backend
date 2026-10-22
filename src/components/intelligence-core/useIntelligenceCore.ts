import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import type { AttentionItem, IntelBulkResult, IntelContext, IntelMessage, IntelPendingConfirm, OrbState } from './types';

interface CoreState {
  orb: OrbState;
  messages: IntelMessage[];
  input: string;
  busy: boolean;
  attention: AttentionItem[];
  attentionTotal: number;
  attentionSummary: string;
  confirm: IntelPendingConfirm | null;
  confirmResult: IntelBulkResult | null;
  error: string | null;
  lastTools: { tool: string; ok: boolean; summary?: string; error?: string }[];
}

type Action =
  | { type: 'input'; value: string }
  | { type: 'orb'; value: OrbState }
  | { type: 'send-start'; message: IntelMessage }
  | { type: 'send-done'; reply: IntelMessage; tools: CoreState['lastTools']; orb: OrbState }
  | { type: 'send-error'; error: string }
  | { type: 'attention'; items: AttentionItem[]; total: number; summary: string }
  | { type: 'confirm-set'; value: IntelPendingConfirm | null }
  | { type: 'confirm-done'; text: string; bulk?: IntelBulkResult }
  | { type: 'clear-error' };

const initial: CoreState = {
  orb: 'idle',
  messages: [],
  input: '',
  busy: false,
  attention: [],
  attentionTotal: 0,
  attentionSummary: '',
  confirm: null,
  confirmResult: null,
  error: null,
  lastTools: [],
};

function reducer(s: CoreState, a: Action): CoreState {
  switch (a.type) {
    case 'input':
      return { ...s, input: a.value };
    case 'orb':
      return { ...s, orb: a.value };
    case 'send-start':
      return { ...s, busy: true, error: null, orb: 'thinking', messages: [...s.messages, a.message], input: '' };
    case 'send-done':
      return { ...s, busy: false, orb: a.orb, messages: [...s.messages, a.reply], lastTools: a.tools };
    case 'send-error':
      return { ...s, busy: false, orb: 'error', error: a.error };
    case 'attention':
      return { ...s, attention: a.items, attentionTotal: a.total, attentionSummary: a.summary };
    case 'confirm-set':
      return { ...s, confirm: a.value, confirmResult: null, orb: a.value ? 'confirm' : s.orb === 'confirm' ? 'idle' : s.orb };
    case 'confirm-done':
      return {
        ...s,
        confirm: null,
        confirmResult: a.bulk ?? null,
        orb: 'success',
        messages: [...s.messages, { id: `m-${Date.now()}-sys`, role: 'system', text: a.text, at: new Date().toISOString() }],
      };
    case 'clear-error':
      return { ...s, error: null, orb: s.orb === 'error' ? 'idle' : s.orb };
    default:
      return s;
  }
}

let msgSeq = 0;

export function useIntelligenceCore(context: IntelContext) {
  const { language, t } = useLanguage();
  const [state, dispatch] = useReducer(reducer, initial);
  // Conversation memory: the booking the admin last inspected. Lets follow-up
  // "why is this pending?" resolve without a fresh explicit ref — the parser
  // only consults it for pronoun-style questions, never invents answers.
  const lastBookingRef = useRef<string | null>(null);

  const ctxKey = useMemo(() => JSON.stringify(context), [context]);

  const refreshAttention = useCallback(async () => {
    try {
      const res = await api.intelligenceCoreAttention();
      dispatch({
        type: 'attention',
        items: (res.items as AttentionItem[]) || [],
        total: res.total || 0,
        summary: res.summary || '',
      });
    } catch {
      /* attention is advisory — the Core stays usable without it */
    }
  }, []);

  useEffect(() => {
    void refreshAttention();
    const id = setInterval(() => void refreshAttention(), 30_000);
    return () => clearInterval(id);
  }, [refreshAttention]);

  const ask = useCallback(async (text: string) => {
    const trimmed = text.trim().slice(0, 2000);
    if (!trimmed || state.busy) return;
    const adminMsg: IntelMessage = {
      id: `m-${Date.now()}-${(msgSeq += 1)}`,
      role: 'admin',
      text: trimmed,
      at: new Date().toISOString(),
    };
    dispatch({ type: 'send-start', message: adminMsg });
    try {
      const ctx: IntelContext = JSON.parse(ctxKey) as IntelContext;
      const res = await api.intelligenceCoreQuery({
        text: trimmed,
        language,
        context: { ...ctx, language, selectedBookingId: ctx.selectedBookingId ?? lastBookingRef.current ?? undefined },
      });
      const detail = (res.results as Record<string, unknown> | undefined)?.getBooking as
        | { bookingRef?: unknown; id?: unknown }
        | undefined;
      const seen = typeof detail?.bookingRef === 'string' ? detail.bookingRef : typeof detail?.id === 'string' ? detail.id : null;
      if (seen) lastBookingRef.current = seen;
      const failed = res.toolCalls.some((c: { ok: boolean }) => !c.ok);
      dispatch({
        type: 'send-done',
        reply: {
          id: `m-${Date.now()}-core`,
          role: 'core',
          text: res.reply,
          at: new Date().toISOString(),
          toolCalls: res.toolCalls,
        },
        tools: res.toolCalls,
        orb: failed ? 'warning' : 'responding',
      });
      void refreshAttention();
    } catch (err) {
      dispatch({ type: 'send-error', error: err instanceof Error ? err.message : t('intel.queryFailed') });
    }
  }, [state.busy, ctxKey, language, t, refreshAttention]);

  const requestAction = useCallback(async (tool: string, params?: Record<string, unknown>, bulkIds?: string[]) => {
    dispatch({ type: 'orb', value: 'action' });
    try {
      const res = await api.intelligenceCoreAction({ tool, params, bulkIds });
      if (res.executed) {
        dispatch({ type: 'confirm-done', text: res.impact || t('intel.actionDone') });
        void refreshAttention();
        return { executed: true as const };
      }
      if (res.confirmation) {
        dispatch({ type: 'confirm-set', value: res.confirmation });
        return { executed: false as const, confirmation: res.confirmation };
      }
      dispatch({ type: 'orb', value: 'warning' });
      return { executed: false as const };
    } catch (err) {
      dispatch({ type: 'send-error', error: err instanceof Error ? err.message : t('intel.actionFailed') });
      return { executed: false as const, error: err instanceof Error ? err.message : 'failed' };
    }
  }, [t, refreshAttention]);

  const confirmPending = useCallback(async () => {
    if (!state.confirm) return;
    const token = state.confirm.token;
    dispatch({ type: 'orb', value: 'action' });
    try {
      const res = await api.intelligenceCoreConfirm(token);
      if (res.bulk) {
        dispatch({
          type: 'confirm-done',
          text: t('intel.bulkDone')
            .replace('{ok}', String(res.bulk.ok))
            .replace('{failed}', String(res.bulk.failed)),
          bulk: res.bulk,
        });
      } else {
        dispatch({ type: 'confirm-done', text: t('intel.actionDone') });
      }
      void refreshAttention();
    } catch (err) {
      // A dead token (expired 410 / consumed 404) must not leave a zombie
      // ActionPlan card behind — clear it so the admin starts over cleanly.
      const status = (err as { status?: unknown }).status;
      if (status === 404 || status === 410) dispatch({ type: 'confirm-set', value: null });
      dispatch({ type: 'send-error', error: err instanceof Error ? err.message : t('intel.confirmFailed') });
    }
  }, [state.confirm, t, refreshAttention]);

  return {
    state,
    dispatch,
    ask,
    requestAction,
    confirmPending,
    refreshAttention,
    language,
    t,
  };
}
