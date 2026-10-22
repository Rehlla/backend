import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';
import { StatusBadge } from './ui/StatusBadge';

export default function SmsCenter() {
  const { language, t } = useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ to: '', recipientName: '', recipientRole: 'TRAVELER', message: '', bookingRef: '' });
  const [sentResult, setSentResult] = useState<any>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.getSmsLogs(100);
      setLogs(data?.logs || []);
    } catch { setLogs([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSend = async () => {
    if (!form.to || !form.recipientName || !form.message || sending) return;
    setSending(true);
    setSentResult(null);
    try {
      const result = await api.sendOpsSmsDispatch(form);
      setSentResult({ success: true, result });
      setForm({ to: '', recipientName: '', recipientRole: 'TRAVELER', message: '', bookingRef: '' });
      await fetchLogs();
    } catch (err: any) {
      setSentResult({ success: false, error: err.message });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={MessageSquare} title={t('cmd.sms.title')} />

      <DashCard>
        <h4 className="text-xs font-bold text-[var(--text-muted)]">{t('cmd.sms.sendTitle')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <input type="text" value={form.to} onChange={e => setForm(p => ({ ...p, to: e.target.value }))}
            aria-label={t('cmd.sms.phone')} placeholder={t('cmd.sms.phone')}
            className="px-3 py-2 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50" />
          <input type="text" value={form.recipientName} onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))}
            aria-label={t('cmd.sms.recipientName')} placeholder={t('cmd.sms.recipientName')}
            className="px-3 py-2 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50" />
          <select value={form.recipientRole} onChange={e => setForm(p => ({ ...p, recipientRole: e.target.value }))}
            className="px-3 py-2 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none">
            {['TRAVELER', 'DRIVER', 'DIVE_INSTRUCTOR', 'HOTEL_DESK', 'BEDOUIN_GUIDE'].map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
          <input type="text" value={form.bookingRef} onChange={e => setForm(p => ({ ...p, bookingRef: e.target.value }))}
            aria-label={t('cmd.sms.bookingRef')} placeholder={t('cmd.sms.bookingRef')}
            className="px-3 py-2 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50" />
        </div>
        <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          placeholder={t('cmd.sms.messageBody')} rows={3}
          className="w-full px-3 py-2 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-white/30 resize-none focus:outline-none focus:border-[var(--accent-primary)]/50 mt-3" />
        <button type="button" onClick={handleSend} disabled={!form.to || !form.recipientName || !form.message || sending}
          className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--text-primary)] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 mt-3">
          <Send className="w-3.5 h-3.5" />{sending ? t('cmd.sms.sending') : t('cmd.sms.sendBtn')}
        </button>
        {sentResult && (
          <div className={`p-3 rounded-xl text-xs font-bold mt-3 ${sentResult.success ? 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-300' : 'bg-red-950/20 border border-red-500/30 text-red-300'}`}>
            {sentResult.success ? t('cmd.sms.sent') : sentResult.error}
          </div>
        )}
      </DashCard>

      {loading ? (
        <Skeleton variant="table" />
      ) : logs.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('cmd.sms.noLogs')} />
      ) : (
        <DashCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead className="bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="py-2.5 px-3">{t('cmd.sms.time')}</th>
                  <th className="py-2.5 px-3">{t('cmd.sms.to')}</th>
                  <th className="py-2.5 px-3">{t('cmd.sms.recipientLabel')}</th>
                  <th className="py-2.5 px-3">{t('cmd.sms.roleLabel')}</th>
                  <th className="py-2.5 px-3">{t('cmd.sms.messageLabel')}</th>
                  <th className="py-2.5 px-3">{t('cmd.sms.statusLabel')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.slice(0, 50).map((log: any, i: number) => (
                  <tr key={log.id || i} className="hover:bg-[var(--btn-util-bg)] transition-colors">
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</td>
                    <td className="py-2.5 px-3 text-[var(--accent-primary)]">{log.to || '—'}</td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{log.recipientName || '—'}</td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{log.recipientRole?.replace(/_/g, ' ') || '—'}</td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)] max-w-[200px] truncate">{log.message || '—'}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={log.status || 'UNKNOWN'} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashCard>
      )}
    </div>
  );
}
