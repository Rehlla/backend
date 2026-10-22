import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { problemSlug } from '../../../../services/api';

/**
 * Shared pieces of the Control section: the mandatory-reason dialog, the
 * mutation runner that turns RFC7807 problems (approval-required, kill-switch,
 * maintenance, view-as-readonly) into operator-readable notices, a side drawer
 * and a small loader hook.
 */

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export function isValidReason(reason: string): boolean {
  const r = reason.trim();
  return r.length >= REASON_MIN && r.length <= REASON_MAX;
}

// ─── Notices ────────────────────────────────────────────────────────────────

export type NoticeKind = 'success' | 'info' | 'error';
export interface Notice {
  kind: NoticeKind;
  text: string;
}

export function NoticeBar({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const { t } = useLanguage();
  if (!notice) return null;
  const tone =
    notice.kind === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : notice.kind === 'info'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
        : 'border-red-500/30 bg-red-500/10 text-red-300';
  const Icon = notice.kind === 'success' ? CheckCircle2 : notice.kind === 'info' ? Info : AlertTriangle;
  return (
    <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${tone}`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span className="flex-1">{notice.text}</span>
      <button type="button" onClick={onDismiss} aria-label={t('cmd.close')} className="cursor-pointer opacity-70 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Runs a mutation and reports its outcome. A 403 approval-required is not a
 * failure: the action was queued for a second admin, so it says "sent for
 * approval" instead of an error.
 */
export function useMutationRunner() {
  const { t } = useLanguage();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const describeError = useCallback(
    (err: unknown): Notice => {
      const slug = problemSlug(err);
      if (slug === 'approval-required') {
        const id = (err as { details?: Record<string, unknown> }).details?.approvalId;
        return { kind: 'info', text: t('ctl.notice.approvalQueued', { id: typeof id === 'string' ? id : '—' }) };
      }
      if (slug === 'kill-switch') return { kind: 'error', text: t('ctl.notice.killSwitch') };
      if (slug === 'maintenance') return { kind: 'error', text: t('ctl.notice.maintenance') };
      if (slug === 'view-as-readonly') return { kind: 'error', text: t('ctl.notice.viewAsReadonly') };
      const message = (err as Error)?.message;
      return { kind: 'error', text: message || t('ctl.notice.failed') };
    },
    [t]
  );

  /** Resolves true when the call succeeded (not when it was only queued). */
  const run = useCallback(
    async (fn: () => Promise<unknown>, successText?: string): Promise<boolean> => {
      setBusy(true);
      try {
        await fn();
        setNotice({ kind: 'success', text: successText ?? t('ctl.notice.saved') });
        return true;
      } catch (err) {
        setNotice(describeError(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [describeError, t]
  );

  return { run, busy, notice, setNotice, clearNotice: () => setNotice(null), describeError };
}

// ─── Reason dialog ──────────────────────────────────────────────────────────

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Kill switches, maintenance, Admin grants: red styling. */
  critical?: boolean;
  confirmLabel?: string;
  /** Extra body (e.g. a summary of what will change). */
  children?: React.ReactNode;
  /** Label for the text field; defaults to "Reason". */
  fieldLabel?: string;
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}

export function ReasonDialog({ open, title, description, critical, confirmLabel, children, fieldLabel, onConfirm, onCancel }: ReasonDialogProps) {
  const { t, isRTL } = useLanguage();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setSubmitting(false);
    const id = window.setTimeout(() => ref.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [open, onCancel]);

  if (!open) return null;
  const len = reason.trim().length;
  const valid = isValidReason(reason);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full max-w-md rounded-2xl border bg-[var(--surface-container)] p-5 shadow-2xl space-y-3 ${
          critical ? 'border-red-500/50' : 'border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${critical ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
            {description && <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>}
          </div>
          <button type="button" onClick={onCancel} aria-label={t('cmd.close')} className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
        <label className="block">
          <span className="text-[11px] font-bold text-[var(--text-muted)]">{fieldLabel ?? t('ctl.reason.label')}</span>
          <textarea
            ref={ref}
            value={reason}
            maxLength={REASON_MAX}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder={t('ctl.reason.placeholder')}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--btn-util-bg)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
          />
          <span className={`text-[10px] ${len > 0 && !valid ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
            {t('ctl.reason.hint', { min: REASON_MIN, max: REASON_MAX, count: len })}
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
            {t('ctl.action.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || submitting}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              critical ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[var(--accent-primary)] text-[var(--accent-contrast,#fff)] hover:brightness-110'
            }`}
          >
            {confirmLabel ?? t('ctl.action.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A pending confirmation: what to ask and what to run with the reason. */
export interface PendingReason {
  title: string;
  description?: string;
  critical?: boolean;
  confirmLabel?: string;
  body?: React.ReactNode;
  run: (reason: string) => Promise<unknown>;
  success?: string;
  after?: () => void;
}

/** One ReasonDialog driven by state: `ask({...})` opens it. */
export function useReasonPrompt(run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>) {
  const [pending, setPending] = useState<PendingReason | null>(null);
  const cancel = useCallback(() => setPending(null), []);
  const dialog = (
    <ReasonDialog
      open={pending !== null}
      title={pending?.title ?? ''}
      description={pending?.description}
      critical={pending?.critical}
      confirmLabel={pending?.confirmLabel}
      onCancel={cancel}
      onConfirm={async reason => {
        if (!pending) return;
        const p = pending;
        setPending(null);
        await run(() => p.run(reason), p.success);
        p.after?.();
      }}
    >
      {pending?.body}
    </ReasonDialog>
  );
  return { ask: setPending, dialog };
}

// ─── Drawer ─────────────────────────────────────────────────────────────────

export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { t, isRTL } = useLanguage();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 end-0 w-full max-w-xl bg-[var(--surface-container)] border-s border-[var(--border-subtle)] shadow-2xl flex flex-col"
      >
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('cmd.close')} className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] cursor-pointer">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
      </aside>
    </div>
  );
}

// ─── Loader ─────────────────────────────────────────────────────────────────

export function useLoader<T>(load: (signal: AbortSignal) => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    load(controller.signal)
      .then(d => { if (!controller.signal.aborted) setData(d); })
      .catch(err => { if (!controller.signal.aborted) setError((err as Error)?.message || 'Error'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick(x => x + 1), []);
  return { data, setData, error, loading, reload };
}

// ─── Small helpers ──────────────────────────────────────────────────────────

export function formatWhen(iso: string | null | undefined, language: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatValue(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export const inputClass =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--btn-util-bg)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]';

export const buttonClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export const primaryButtonClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[11px] font-bold text-[var(--accent-contrast,#fff)] hover:brightness-110 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export const dangerButtonClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/40 text-[11px] font-bold text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
