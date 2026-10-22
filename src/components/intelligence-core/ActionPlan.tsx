import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { IntelBulkResult, IntelPendingConfirm } from './types';
import { DashCard, AlertBanner } from '../operations/command-center/ui';

interface Props {
  confirm: IntelPendingConfirm | null;
  result?: IntelBulkResult | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
}

/**
 * Explicit confirmation surface for MEDIUM/HIGH actions. Shows impact +
 * affected count + expiry; the token is single-use and re-authorized
 * server-side, so this dialog grants no privilege by itself.
 * After a bulk execution the per-item failures stay visible (result).
 */
export const ActionPlan: React.FC<Props> = ({ confirm, result, busy, onConfirm, onCancel, t }) => {
  if (!confirm && !result?.failures?.length) return null;
  return (
    <DashCard>
      {confirm ? (
        <>
          <AlertBanner
            status={confirm.risk === 'HIGH' ? 'action-required' : 'degraded'}
            title={`${t('intel.confirmTitle', 'Confirm action')} · ${confirm.tool} (${confirm.risk})`}
            subtitle={`${t('intel.impact', 'Impact')}: ${confirm.impact} ${t('intel.affected', 'Affected')}: ${confirm.affectedCount}. ${t('intel.expires', 'Expires')}: ${new Date(confirm.expiresAt).toLocaleTimeString()}`}
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--accent-primary)] text-[var(--btn-book-ink,var(--accent-primary-ink))] disabled:opacity-50 cursor-pointer inline-flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              {t('intel.confirmAction', 'Confirm and execute')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-subtle)] cursor-pointer disabled:opacity-50"
            >
              {t('intel.dismissAction', 'Cancel')}
            </button>
          </div>
        </>
      ) : null}
      {result && result.failures.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5" role="alert">
          <p className="text-xs font-bold text-amber-300">
            {t('intel.bulkFailureList', 'Some items failed ({failed} of {total}):')
              .replace('{failed}', String(result.failed))
              .replace('{total}', String(result.ok + result.failed))}
          </p>
          <ul className="mt-1.5 space-y-1">
            {result.failures.slice(0, 10).map(f => (
              <li key={f.id} className="text-[11px] text-[var(--text-muted)]">
                <span className="font-mono">{f.id}</span> — {f.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DashCard>
  );
};
