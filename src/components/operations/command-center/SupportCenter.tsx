import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, User, Phone, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader, TabBar, StatusBadge, EmptyState, DashCard, Skeleton } from './ui';

export default function SupportCenter() {
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'OPEN' | 'ANSWERED'>('all');
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');

  const fetchData = useCallback(async () => {
    try {
      const [msgData, notifData] = await Promise.allSettled([
        api.getSupportMessages(),
        api.getOperationsNotifications(),
      ]);
      if (msgData.status === 'fulfilled') setMessages((msgData.value as any)?.messages || []);
      if (notifData.status === 'fulfilled') setNotifications((notifData.value as any)?.notifications || []);
    } catch { setMessages([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30_000); return () => clearInterval(i); }, [fetchData]);

  const handleReply = async () => {
    if (!selectedMsg || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await api.replyToSupportMessage(selectedMsg.id, replyText.trim());
      setMessages(prev => prev.map(m => m.id === selectedMsg.id ? { ...m, reply: replyText.trim(), status: 'ANSWERED' } : m));
      setSelectedMsg((prev: any) => prev ? { ...prev, reply: replyText.trim(), status: 'ANSWERED' } : prev);
      setReplyText('');
    } catch (err: any) { alert(`Failed: ${err.message}`); } finally { setSending(false); }
  };

  const filtered = filter === 'all' ? messages : messages.filter(m => m.status === filter);
  const unreadNotifs = notifications.filter(n => !n.read);
  const openCount = messages.filter(m => m.status === 'OPEN').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={MessageSquare}
        iconColor="text-[var(--accent-secondary)]"
        title={t('cmd.support.title')}
        actions={
          <div className="flex items-center gap-2">
            <TabBar
              tabs={[
                { id: 'messages', label: t('cmd.support.messages') },
                { id: 'notifications', label: t('cmd.support.notifications'), count: unreadNotifs.length || undefined },
              ]}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as 'messages' | 'notifications')}
            />
            <button type="button" onClick={fetchData} aria-label={t('cmd.overview.refresh')} className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-muted)] cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {activeTab === 'notifications' ? (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <EmptyState icon={MessageSquare} title={t('cmd.support.noNotifications')} />
          ) : notifications.map((n: any) => (
            <DashCard key={n.id} padding="sm" className={n.read ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <StatusBadge status={n.status || 'SENT'} dot />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)]">{n.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                       {n.type} · {n.channel} · {n.createdAt ? `${Math.round((Date.now() - new Date(n.createdAt).getTime()) / 60_000)}${t('cmd.overview.minutesAgoShort')}` : '—'}
                    </div>
                  </div>
                </div>
                <StatusBadge status={n.status || 'SENT'} />
              </div>
            </DashCard>
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            <TabBar
              tabs={[
                { id: 'all', label: t('cmd.exceptions.all') },
                { id: 'OPEN', label: t('cmd.support.open'), count: openCount },
                { id: 'ANSWERED', label: t('cmd.support.answered') },
              ]}
              activeTab={filter}
              onChange={(id) => { setFilter(id as any); setSelectedMsg(null); }}
            />
          </div>

          {loading ? (
            <Skeleton variant="list" count={3} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-2 max-h-[60vh] overflow-y-auto">
                {filtered.length === 0 ? (
                  <EmptyState icon={MessageSquare} title={t('cmd.support.noMessages')} />
                ) : filtered.map(msg => (
                  <button key={msg.id} type="button" onClick={() => { setSelectedMsg(msg); setReplyText(''); }}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${selectedMsg?.id === msg.id ? 'bg-[var(--surface-container)] border-[var(--accent-primary)]/30' : 'bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/20'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={msg.status} />
                      {msg.urgent && <StatusBadge status="URGENT" />}
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">{msg.travelerName || msg.userId}</div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{msg.message?.substring(0, 80)}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                      {msg.category && <span>{msg.category} · </span>}
                       {Math.round((Date.now() - new Date(msg.createdAt).getTime()) / 60_000)}{t('cmd.overview.minutesAgoShort')}
                    </div>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-2">
                {selectedMsg ? (
                  <DashCard>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">{selectedMsg.travelerName || selectedMsg.userId}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 space-x-3">
                          {selectedMsg.travelerPhone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{selectedMsg.travelerPhone}</span>}
                          {selectedMsg.tripId && <span>{t('cmd.support.trip')} {selectedMsg.tripId}</span>}
                        </div>
                      </div>
                      <StatusBadge status={selectedMsg.status} />
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-[var(--btn-util-bg)]/50 border border-[var(--border-subtle)]">
                      <div className="text-xs text-[var(--text-primary)]">{selectedMsg.message}</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono mt-2">{selectedMsg.createdAt}</div>
                    </div>

                    {selectedMsg.reply && (
                      <div className="mt-3 p-3 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                        <div className="text-[11px] text-[var(--accent-primary)] font-bold mb-1">{t('cmd.support.replyLabel')} ({selectedMsg.repliedBy})</div>
                        <div className="text-xs text-[var(--text-muted)]">{selectedMsg.reply}</div>
                      </div>
                    )}

                    {selectedMsg.status === 'OPEN' && (
                      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('cmd.support.typeReply')}
                          className="w-full px-3 py-2 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 resize-none focus:outline-none focus:border-[var(--accent-primary)]/50" rows={3} />
                        <button type="button" onClick={handleReply} disabled={!replyText.trim() || sending}
                          className="mt-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--accent-contrast,#fff)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                          <Send className="w-3.5 h-3.5" />{sending ? t('cmd.support.sending') : t('cmd.support.sendReply')}
                        </button>
                      </div>
                    )}
                  </DashCard>
                ) : (
                  <EmptyState icon={MessageSquare} title={t('cmd.support.selectMessage')} />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
