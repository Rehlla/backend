import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Phone, RefreshCw, Send } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import type {
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppPurpose,
  WhatsAppSession,
} from '../../../shared/types/whatsapp';
import { SectionHeader } from './ui/SectionHeader';
import { TabBar } from './ui/TabBar';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';
import { StatusBadge } from './ui/StatusBadge';

const PURPOSE_LABEL_KEY: Record<WhatsAppPurpose, string> = {
  traveler: 'cmd.whatsapp.purpose.traveler',
  driver: 'cmd.whatsapp.purpose.driver',
  support: 'cmd.whatsapp.purpose.support',
  system: 'cmd.whatsapp.purpose.system'
};

/**
 * WhatsApp Center - the transport's operations surface.
 *
 * Three things an operator needs, in the order they need them: see which
 * numbers are linked and which is the default for each purpose, see what the
 * outbox is holding (and why anything is stuck), and prove a number works with
 * a single test message before real traffic is routed to it.
 *
 * The honesty rule from the service is honoured here: a SIMULATED row renders
 * as "not sent", never as delivered, because the transport is off - it is a
 * record of intent.
 */
export default function WhatsAppSection() {
  const { t } = useLanguage();
  const [pane, setPane] = useState<'numbers' | 'outbox'>('numbers');
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messageFilter, setMessageFilter] = useState<'all' | WhatsAppMessageStatus>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link-a-number form.
  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPurpose, setFormPurpose] = useState<WhatsAppPurpose>('traveler');
  const [formNote, setFormNote] = useState('');

  // Inline edit of an unlinked session.
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');

  // Test message.
  const [testTo, setTestTo] = useState('');
  const [testPurpose, setTestPurpose] = useState<WhatsAppPurpose>('traveler');
  const [testBody, setTestBody] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getOpsWhatsAppSessions();
      setSessions(data.sessions || []);
      setEnabled(data.enabled);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoadingSessions(false); }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const data = await api.getOpsWhatsAppMessages({ limit: 60, ...(messageFilter === 'all' ? {} : { status: messageFilter }) });
      setMessages(data.messages || []);
    } catch { setMessages([]); } finally { setLoadingMessages(false); }
  }, [messageFilter]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => {
    const interval = setInterval(loadSessions, 15_000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const link = async () => {
    setBusy(true);
    try {
      await api.linkOpsWhatsAppSession({ label: formLabel, phone: formPhone, purpose: formPurpose, note: formNote || undefined });
      setFormLabel(''); setFormPhone(''); setFormNote('');
      setShowForm(false);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const saveEdit = async (id: string) => {
    setBusy(true);
    try {
      await api.updateOpsWhatsAppSession(id, { label: editLabel, phone: editPhone, note: editNote });
      setEditing(null);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const makeDefault = async (id: string) => {
    setBusy(true);
    try { await api.updateOpsWhatsAppSession(id, { isDefault: true }); await loadSessions(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const refresh = async (id: string) => {
    setBusy(true);
    try { await api.refreshOpsWhatsAppSession(id); await loadSessions(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      const { message } = await api.sendOpsWhatsAppTest({ phone: testTo, purpose: testPurpose, body: testBody });
      setTestResult(message.status === 'SENT' ? t('cmd.whatsapp.testSent') : t('cmd.whatsapp.testSimulated'));
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const drain = async () => {
    setBusy(true);
    try {
      const { dispatched } = await api.dispatchOpsWhatsApp();
      setTestResult(t('cmd.whatsapp.dispatched') + (dispatched ? ` (${dispatched})` : ''));
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={MessageCircle}
        title={t('cmd.whatsapp.title')}
        subtitle={enabled ? t('cmd.whatsapp.subtitle') : t('cmd.whatsapp.disabled')}
        actions={
          <button type="button" onClick={() => setShowForm(v => !v)} className="px-2 py-1 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold">
            {t('cmd.whatsapp.addNumber')}
          </button>
        }
      />

      {!enabled && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          {t('cmd.whatsapp.banWarning')}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{error}</div>
      )}

      <TabBar
        tabs={[
          { id: 'numbers', label: t('cmd.whatsapp.sessions'), count: sessions.length },
          { id: 'outbox', label: t('cmd.whatsapp.outbox'), count: messages.length }
        ]}
        activeTab={pane}
        onChange={id => setPane(id as typeof pane)}
        variant="pill"
      />

      {showForm && (
        <DashCard className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-[var(--text-muted)]">
              {t('cmd.whatsapp.label')}
              <input value={formLabel} onChange={event => setFormLabel(event.target.value)} className="mt-1 w-full rounded bg-transparent border px-2 py-1 text-xs" />
            </label>
            <label className="text-[11px] text-[var(--text-muted)]">
              {t('cmd.whatsapp.phone')}
              <input value={formPhone} onChange={event => setFormPhone(event.target.value)} placeholder="01011985293" className="mt-1 w-full rounded bg-transparent border px-2 py-1 text-xs font-mono" />
            </label>
            <label className="text-[11px] text-[var(--text-muted)]">
              {t('cmd.whatsapp.purpose')}
              <select value={formPurpose} onChange={event => setFormPurpose(event.target.value as WhatsAppPurpose)} className="mt-1 w-full rounded bg-transparent border px-2 py-1 text-xs">
                {(['traveler', 'driver', 'support', 'system'] as WhatsAppPurpose[]).map(purpose => (
                  <option key={purpose} value={purpose}>{t(PURPOSE_LABEL_KEY[purpose])}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-[var(--text-muted)]">
              {t('cmd.whatsapp.note')}
              <input value={formNote} onChange={event => setFormNote(event.target.value)} className="mt-1 w-full rounded bg-transparent border px-2 py-1 text-xs" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={link} disabled={busy || !formLabel || !formPhone} className="px-3 py-1 rounded bg-[var(--accent-primary)] text-[var(--accent-ink)] text-[11px] font-bold disabled:opacity-50">
              {t('cmd.whatsapp.addNumber')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 rounded bg-transparent border text-[11px]">
              {t('cmd.transfers.save')}
            </button>
          </div>
        </DashCard>
      )}

      {pane === 'numbers' && (
        loadingSessions ? <Skeleton variant="list" count={2} /> :
        sessions.length === 0 ? <EmptyState icon={MessageCircle} title={t('cmd.whatsapp.noSessions')} /> : (
          <div className="space-y-2">
            {sessions.map(session => (
              <DashCard key={session.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{session.label}</span>
                      <StatusBadge status={session.status} size="sm" />
                      <span className="text-[11px] text-[var(--text-muted)]">{t(PURPOSE_LABEL_KEY[session.purpose])}</span>
                      {session.isDefault && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">{t('cmd.whatsapp.default')}</span>}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--accent-primary)] mt-1" dir="ltr">+{session.phone || '—'}</div>
                    {session.note && <div className="text-[11px] text-[var(--text-muted)] mt-1">{session.note}</div>}
                    {session.qrCode && (
                      <div className="mt-2 text-[11px] text-[var(--text-muted)]">{t('cmd.whatsapp.notLinkedHint')}</div>
                    )}
                    {editing === session.id ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input value={editLabel} onChange={event => setEditLabel(event.target.value)} className="rounded bg-transparent border px-2 py-1 text-[11px]" />
                        <input value={editPhone} onChange={event => setEditPhone(event.target.value)} className="rounded bg-transparent border px-2 py-1 text-[11px] font-mono" dir="ltr" />
                        <input value={editNote} onChange={event => setEditNote(event.target.value)} placeholder={t('cmd.whatsapp.note')} className="rounded bg-transparent border px-2 py-1 text-[11px] col-span-2" />
                        <div className="col-span-2 flex gap-2">
                          <button type="button" onClick={() => saveEdit(session.id)} disabled={busy} className="px-2 py-1 rounded bg-[var(--accent-primary)] text-[var(--accent-ink)] text-[11px] font-bold">{t('cmd.whatsapp.save')}</button>
                          <button type="button" onClick={() => setEditing(null)} className="px-2 py-1 rounded bg-transparent border text-[11px]">{t('cmd.transfers.save')}</button>
                        </div>
                        <div className="col-span-2 text-[10px] text-[var(--text-muted)]">{t('cmd.whatsapp.phoneEditableHint')}</div>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <button type="button" onClick={() => { setEditing(session.id); setEditLabel(session.label); setEditPhone(session.phone); setEditNote(session.note || ''); }} className="px-2 py-1 rounded bg-transparent border text-[11px]">{t('cmd.whatsapp.edit')}</button>
                        {!session.isDefault && (
                          <button type="button" onClick={() => makeDefault(session.id)} disabled={busy} className="px-2 py-1 rounded bg-transparent border text-[11px]">{t('cmd.whatsapp.setDefault')}</button>
                        )}
                        <button type="button" onClick={() => refresh(session.id)} disabled={busy} className="px-2 py-1 rounded bg-transparent border text-[11px] inline-flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> {t('cmd.whatsapp.refresh')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </DashCard>
            ))}
          </div>
        )
      )}

      {pane === 'outbox' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <TabBar
              tabs={[
                { id: 'all', label: t('cmd.transfers.all') },
                { id: 'QUEUED', label: t('cmd.whatsapp.status.QUEUED') },
                { id: 'SENT', label: t('cmd.whatsapp.status.SENT') },
                { id: 'FAILED', label: t('cmd.whatsapp.status.FAILED') },
                { id: 'SIMULATED', label: t('cmd.whatsapp.status.SIMULATED') }
              ]}
              activeTab={messageFilter}
              onChange={id => setMessageFilter(id as typeof messageFilter)}
              variant="pill"
            />
            <button type="button" onClick={drain} disabled={busy || !enabled} className="px-2 py-1 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold disabled:opacity-50">
              <Send className="w-3 h-3 inline" /> {t('cmd.whatsapp.dispatch')}
            </button>
          </div>

          <DashCard className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-[var(--text-muted)]">
                {t('cmd.whatsapp.phone')}
                <input value={testTo} onChange={event => setTestTo(event.target.value)} className="mt-1 w-full rounded bg-transparent border px-2 py-1 text-xs font-mono" dir="ltr" />
              </label>
              <label className="text-[11px] text-[var(--text-muted)]">
                {t('cmd.whatsapp.purpose')}
                <select value={testPurpose} onChange={event => setTestPurpose(event.target.value as WhatsAppPurpose)} className="mt-1 w-full rounded bg-transparent border px-2 py-1 text-xs">
                  {(['traveler', 'driver', 'support', 'system'] as WhatsAppPurpose[]).map(purpose => (
                    <option key={purpose} value={purpose}>{t(PURPOSE_LABEL_KEY[purpose])}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-[var(--text-muted)] col-span-2">
                {t('cmd.whatsapp.testBody')}
                <input value={testBody} onChange={event => setTestBody(event.target.value)} className="mt-1 w-full rounded bg-transparent border px-2 py-1 text-xs" />
              </label>
            </div>
            <button type="button" onClick={sendTest} disabled={busy || !testTo || !testBody} className="px-3 py-1 rounded bg-[var(--accent-primary)] text-[var(--accent-ink)] text-[11px] font-bold disabled:opacity-50">
              {t('cmd.whatsapp.test')}
            </button>
            {testResult && <div className="text-[11px] text-[var(--text-muted)]">{testResult}</div>}
          </DashCard>

          {loadingMessages ? <Skeleton variant="list" count={3} /> :
            messages.length === 0 ? <EmptyState icon={Send} title={t('cmd.whatsapp.noMessages')} /> : (
            <div className="space-y-2">
              {messages.map(message => (
                <DashCard key={message.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-[var(--accent-primary)]" dir="ltr">+{message.to}</span>
                        <StatusBadge status={message.simulated ? 'SIMULATED' : message.status} size="sm" />
                        <span className="text-[11px] text-[var(--text-muted)]">{t(PURPOSE_LABEL_KEY[message.purpose])}</span>
                      </div>
                      <div className="text-xs text-[var(--text-primary)] mt-1 break-words">{message.body}</div>
                      {message.providerError && <div className="text-[11px] text-red-300 mt-1">{message.providerError}</div>}
                      <div className="text-[11px] text-[var(--text-muted)] mt-1 flex gap-3 flex-wrap">
                        <span>{t('cmd.whatsapp.attempts')} {message.attempts}</span>
                        {message.bookingRef && <span className="font-mono">{message.bookingRef}</span>}
                        <span>{new Date(message.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </DashCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
