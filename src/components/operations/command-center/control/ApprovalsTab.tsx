import React, { useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api, type AdminApproval, type AdminApprovalStatus } from '../../../../services/api';
import { EmptyState, Skeleton, StatusBadge, TabBar } from '../ui';
import { NoticeBar, buttonClass, dangerButtonClass, formatWhen, useLoader, useMutationRunner, useReasonPrompt } from './controlShared';

const STATUS_BADGE: Record<AdminApprovalStatus, string> = {
  pending: 'PENDING',
  approved: 'CONFIRMED',
  rejected: 'REJECTED',
  failed: 'FAILED',
};

export default function ApprovalsTab() {
  const { t, language } = useLanguage();
  const { sessionUser } = useAuth();
  const [status, setStatus] = useState<AdminApprovalStatus>('pending');
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const { data, loading, error, reload } = useLoader(signal => api.adminListApprovals({ status, limit: 100 }, signal), [status]);

  const decide = (a: AdminApproval, decision: 'approve' | 'reject') =>
    ask({
      title: t(decision === 'approve' ? 'ctl.approvals.approveTitle' : 'ctl.approvals.rejectTitle', { summary: a.summary }),
      description: decision === 'approve' ? t('ctl.approvals.approveBody') : undefined,
      critical: decision === 'approve',
      confirmLabel: t(decision === 'approve' ? 'ctl.approvals.approve' : 'ctl.approvals.reject'),
      run: note => api.adminDecideApproval(a.id, decision, note),
      success: t(decision === 'approve' ? 'ctl.approvals.approved' : 'ctl.approvals.rejected'),
      after: reload,
    });

  return (
    <div className="space-y-3">
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      <TabBar
        tabs={(['pending', 'approved', 'rejected', 'failed'] as const).map(s => ({ id: s, label: t(`ctl.approvals.status.${s}`) }))}
        activeTab={status}
        onChange={id => setStatus(id as AdminApprovalStatus)}
      />
      {loading && !data ? <Skeleton variant="list" count={4} /> : error ? (
        <EmptyState icon={ClipboardCheck} title={t('ctl.loadFailed')} description={error} action={{ label: t('ctl.action.retry'), onClick: reload }} />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t('ctl.approvals.empty')} />
      ) : (
        <ul className="space-y-2">
          {data!.items.map(a => {
            const own = a.requestedBy === sessionUser?.id;
            return (
              <li key={a.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={STATUS_BADGE[a.status]} />
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{a.action}</span>
                  <span className="text-xs font-bold text-[var(--text-primary)] flex-1 min-w-[160px]">{a.summary}</span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {t('ctl.approvals.requested', { who: a.requestedBy, when: formatWhen(a.requestedAt, language) })}
                  {a.decidedBy && <> · {t('ctl.approvals.decided', { who: a.decidedBy, when: formatWhen(a.decidedAt, language) })}</>}
                </div>
                {typeof a.payload?.reason === 'string' && (
                  <p className="text-[11px] text-[var(--text-primary)]">{t('ctl.audit.reason')}: {a.payload.reason}</p>
                )}
                {a.decisionNote && <p className="text-[11px] text-[var(--text-muted)]">{t('ctl.approvals.note')}: {a.decisionNote}</p>}
                <details className="text-[10px]">
                  <summary className="cursor-pointer text-[var(--text-muted)]">{t('ctl.approvals.payload')}</summary>
                  <pre dir="ltr" className="mt-1 rounded bg-[var(--btn-util-bg)] p-2 font-mono whitespace-pre-wrap break-all text-[var(--text-primary)]">{JSON.stringify(a.payload, null, 2)}</pre>
                </details>
                {a.status === 'pending' && (
                  own ? (
                    <p className="text-[11px] font-bold text-amber-400">{t('ctl.approvals.own')}</p>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" className={buttonClass} onClick={() => decide(a, 'approve')}>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> {t('ctl.approvals.approve')}
                      </button>
                      <button type="button" className={dangerButtonClass} onClick={() => decide(a, 'reject')}>
                        <X className="w-3.5 h-3.5" /> {t('ctl.approvals.reject')}
                      </button>
                    </div>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
      {dialog}
    </div>
  );
}
