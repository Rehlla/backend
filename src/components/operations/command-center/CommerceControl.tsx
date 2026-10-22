import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, CheckCircle2, AlertTriangle, Shield, RefreshCw, Download, Lock } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader, TabBar, StatusBadge, EmptyState, DashCard, Skeleton, DataTable } from './ui';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination, usePagination } from './Pagination';

export default function CommerceControl() {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('ledger');
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const fetchLedger = useCallback(async () => {
    try {
      const data = await api.getLedger();
      setLedgerEntries(data?.entries || data?.ledgerEntries || []);
    } catch { setLedgerEntries([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchLedger();
    api.getOperationsPayments().then(d => setPaymentData(d)).catch(() => {});
    api.getLedgerAnomalies().then(d => setAnomalies(d?.anomalies || d || [])).catch(() => {});
  }, [fetchLedger]);

  const handleVerify = async () => {
    setVerifying(true);
    try { const result = await api.verifyLedger(); setVerifyResult(result); }
    catch (err: any) { setVerifyResult({ status: 'error', message: err.message }); }
    finally { setVerifying(false); }
  };

  const totalCaptured = ledgerEntries.filter((e: any) => e.type === 'PAYMENT_CAPTURED').reduce((acc: number, e: any) => acc + (e.amountEGP || 0), 0);
  const totalCommission = ledgerEntries.filter((e: any) => e.type === 'PLATFORM_COMMISSION').reduce((acc: number, e: any) => acc + (e.amountEGP || 0), 0);
  const { page: ledgerPage, setPage: setLedgerPage, totalPages: ledgerTotalPages, paginatedItems: ledgerPaginated, totalItems: ledgerTotalItems, pageSize: ledgerPageSize } = usePagination(ledgerEntries, 20);

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={DollarSign}
        iconColor="text-[var(--accent-secondary)]"
        title={t('cmd.commerce.title')}
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'ledger' && ledgerEntries.length > 0 && (
              <button type="button" onClick={() => {
                const headers = [t('cmd.commerce.entry'),t('cmd.commerce.booking'),t('cmd.commerce.type'),'Debit','Credit',t('cmd.commerce.amount'),t('cmd.commerce.status'),t('cmd.trips.startDate')];
                const rows = ledgerEntries.map((e: any) => [e.id, e.bookingRef, e.type, e.debitAccount, e.creditAccount, e.amountEGP, e.status, e.timestamp]);
                const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `ledger-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
              }} className="px-2 py-1 rounded-md bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-muted)] text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                <Download className="w-3 h-3" />{t('cmd.commerce.export')}
              </button>
            )}
            <TabBar
              tabs={[
                { id: 'ledger', label: t('cmd.commerce.ledger') },
                { id: 'payments', label: t('cmd.commerce.payments') },
                { id: 'anomalies', label: t('cmd.commerce.anomalies'), count: anomalies.length || undefined },
                { id: 'verify', label: t('cmd.commerce.verify') },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DashCard glow="green">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.commerce.escrowCaptured')}</div>
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono">{totalCaptured.toLocaleString()} EGP</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{t('cmd.commerce.heldUntilDelivery')}</div>
        </DashCard>
        <DashCard>
          <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.commerce.platformCommissions')}</div>
          <div className="text-lg font-bold text-[var(--accent-secondary)] font-mono mt-1">{totalCommission.toLocaleString()} EGP</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{t('cmd.commerce.autoSettled')}</div>
        </DashCard>
        <DashCard>
          <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.commerce.immutableEntries')}</div>
          <div className="text-lg font-bold text-[var(--accent-primary)] font-mono mt-1">{ledgerEntries.length}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{t('cmd.commerce.sha256Integrity')}</div>
        </DashCard>
      </div>

      {activeTab === 'payments' && paymentData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DashCard glow="green">
              <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.commerce.totalCaptured')}</div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{paymentData.summary?.totalCapturedEGP?.toLocaleString() || 0} EGP</div>
            </DashCard>
            <DashCard glow="red">
              <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.commerce.totalRefunded')}</div>
              <div className="text-lg font-bold text-red-400 font-mono mt-1">{paymentData.summary?.totalRefundedEGP?.toLocaleString() || 0} EGP</div>
            </DashCard>
            <DashCard>
              <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.commerce.platformCommission')}</div>
              <div className="text-lg font-bold text-[var(--accent-secondary)] font-mono mt-1">{paymentData.summary?.totalCommissionEGP?.toLocaleString() || 0} EGP</div>
            </DashCard>
          </div>
          {paymentData.failedPayments?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-red-400">{t('cmd.commerce.failedPayments')} ({paymentData.failedPayments.length})</h4>
              {paymentData.failedPayments.map((fp: any) => (
                <DashCard key={fp.id} padding="sm" glow="red">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono text-red-300">{fp.bookingRef}</span>
                      <span className="text-[11px] text-[var(--text-muted)] ml-2">{fp.amountEGP?.toLocaleString()} EGP</span>
                    </div>
                    <StatusBadge status={fp.paymentState} />
                  </div>
                </DashCard>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'anomalies' && (
        anomalies.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={t('cmd.commerce.noAnomalies')} />
        ) : anomalies.map((a: any, i: number) => (
          <DashCard key={a.id || i} padding="sm">
            <div className="text-xs font-bold text-[var(--text-primary)]">{a.type || a.description || t('cmd.commerce.anomalies')}</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{a.details || a.message || ''}</div>
          </DashCard>
        ))
      )}

      {activeTab === 'verify' && (
        <DashCard>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('cmd.commerce.verifyIntegrity')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('cmd.commerce.verifyDesc')}</p>
            </div>
            <button type="button" onClick={handleVerify} disabled={verifying}
              className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--accent-contrast,#fff)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Shield className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              {verifying ? t('cmd.commerce.verifying') : t('cmd.commerce.runVerification')}
            </button>
          </div>
          {verifyResult && (
            <div className={`mt-4 p-4 rounded-xl border ${verifyResult.valid || verifyResult.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
              <div className="flex items-center gap-2">
                {verifyResult.valid || verifyResult.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="text-sm font-bold">
                  {verifyResult.valid || verifyResult.status === 'success' ? t('cmd.commerce.verified') : `${t('cmd.commerce.issue')}: ${verifyResult.message || t('cmd.commerce.integrityCheckFailed')}`}
                </span>
              </div>
            </div>
          )}
        </DashCard>
      )}

      {activeTab === 'ledger' && (
        loading ? <Skeleton variant="table" /> : (
          ledgerEntries.length === 0 ? (
            <EmptyState icon={DollarSign} title={t('cmd.commerce.noEntries')} description={t('cmd.commerce.noEntriesDesc')} />
          ) : (
            <>
              <DataTable
                columns={[
                  { key: 'id', header: t('cmd.commerce.entry'), render: (e: any) => <><div className="text-[var(--accent-primary)] font-bold">{e.id}</div><div className="text-[var(--text-muted)] text-[10px]">{e.transactionId}</div></> },
                  { key: 'booking', header: t('cmd.commerce.booking'), render: (e: any) => <span className="text-[var(--accent-secondary)] font-bold">{e.bookingRef}</span> },
                  { key: 'type', header: t('cmd.commerce.type'), render: (e: any) => <StatusBadge status={e.type} /> },
                  { key: 'flow', header: t('cmd.commerce.debitCredit'), render: (e: any) => <span className="text-[var(--text-muted)]">{e.debitAccount} → <span className="text-emerald-400">{e.creditAccount}</span></span> },
                  { key: 'amount', header: t('cmd.commerce.amount'), align: 'right' as const, render: (e: any) => <span className="font-bold text-[var(--text-primary)]">{e.amountEGP?.toLocaleString()} EGP</span> },
                  { key: 'status', header: t('cmd.commerce.status'), render: (e: any) => <StatusBadge status={e.status} dot /> },
                ]}
                data={ledgerPaginated.map((e: any) => ({ ...e, id: e.id || `entry-${Math.random()}` }))}
              />
              {ledgerTotalPages > 1 && (
                <div className="flex justify-center pt-2">
                  <Pagination page={ledgerPage} totalPages={ledgerTotalPages} totalItems={ledgerTotalItems} pageSize={ledgerPageSize} onPageChange={setLedgerPage} />
                </div>
              )}
            </>
          )
        )
      )}
    </div>
  );
}
