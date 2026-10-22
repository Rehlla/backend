import React, { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import { TabBar } from './ui/TabBar';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';
import { StatusBadge } from './ui/StatusBadge';

export default function NotificationsCenter() {
  const { language, t } = useLanguage();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getOperationsNotifications();
      setNotifications(data?.notifications || []);
      setSummary(data?.summary || null);
    } catch { setNotifications([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotifications(); const i = setInterval(fetchNotifications, 30_000); return () => clearInterval(i); }, [fetchNotifications]);

  const filtered = filter === 'all' ? notifications : filter === 'unread' ? notifications.filter(n => !n.read) : notifications.filter(n => n.priority === 'URGENT' || n.priority === 'HIGH');

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Bell}
        title={t('cmd.notif.title')}
        badge={summary && summary.unread > 0 ? { count: summary.unread } : undefined}
      />

      <TabBar
        tabs={[
          { id: 'all', label: t('cmd.notif.all') },
          { id: 'unread', label: t('cmd.notif.unreadTab') },
          { id: 'urgent', label: t('cmd.notif.urgent') },
        ]}
        activeTab={filter}
        onChange={tab => setFilter(tab as typeof filter)}
      />

      {loading ? (
        <Skeleton variant="list" count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={filter !== 'all' ? `${t('cmd.notif.noNotifications')} (${t(`cmd.notif.${filter === 'unread' ? 'unreadTab' : 'urgent'}`)})` : t('cmd.notif.noNotifications')}
          description={t('cmd.notif.allCaughtUp')}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <DashCard key={n.id} className={n.read ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.status === 'FAILED' ? 'bg-red-500/20 border border-red-500/30' : 'bg-[var(--btn-util-bg)] border border-[var(--border-subtle)]'}`}>
                    {n.status === 'FAILED' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Bell className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)]">{n.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono mt-1 space-x-2">
                      <span>{n.type}</span>
                      <span>·</span>
                      <span>{n.channel}</span>
                      <span>·</span>
                      <span>{n.createdAt ? `${Math.round((Date.now() - new Date(n.createdAt).getTime()) / 60_000)}${t('cmd.overview.minutesAgoShort')}` : '—'}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge status={n.status || 'UNKNOWN'} size="sm" />
              </div>
            </DashCard>
          ))}
        </div>
      )}
    </div>
  );
}
