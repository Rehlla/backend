import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Plane,
  DollarSign,
  MessageSquare,
  Users,
  Zap,
  RefreshCw,
  Radio,
  ShieldAlert,
  Globe,
  ChevronRight,
  Package,
  Bell,
  Car,
  HeartPulse,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { SectionId } from './CommandCenterShell';
import {
  KpiCard,
  AlertBanner,
  SectionHeader,
  DashCard,
  StatusBadge,
  SkeletonKpi,
  Skeleton,
} from './ui';

// ─── Types ──────────────────────────────────────────────────────────────────
interface OperationalSummary {
  activeTrips: number;
  pendingBookings: number;
  pendingSupplierConfirmations: number;
  paymentIssues: number;
  exceptions: number;
  atRiskTrips: number;
  unreadSupport: number;
  supplierIssues: number;
  activeTransfers: number;
  unreadNotifications: number;
}

interface ActionItem {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  entity?: string;
  entityType?: 'trip' | 'booking' | 'supplier' | 'payment' | 'support' | 'market';
  entityId?: string;
  createdAt: string;
  ageMinutes: number;
  reason: string;
}

interface RecentEvent {
  id: string;
  type: string;
  title: string;
  entity?: string;
  timestamp: string;
  actor?: string;
}

interface HealthStatus {
  api: 'healthy' | 'degraded' | 'down' | 'unknown';
  db: 'healthy' | 'degraded' | 'down' | 'unknown';
  payments: 'healthy' | 'degraded' | 'down' | 'unknown';
  intelligence: 'healthy' | 'degraded' | 'down' | 'unknown';
}

// ─── Data Fetching ──────────────────────────────────────────────────────────
function useOperationalSummary() {
  const [summary, setSummary] = useState<OperationalSummary>({
    activeTrips: 0, pendingBookings: 0, pendingSupplierConfirmations: 0,
    paymentIssues: 0, exceptions: 0, atRiskTrips: 0,
    unreadSupport: 0, supplierIssues: 0,
    activeTransfers: 0, unreadNotifications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const [opsOverview, supportData, marketAlerts, transfersData, notificationsData] = await Promise.allSettled([
        api.getOperationsOverview(),
        api.getSupportMessages(),
        api.getMarketAlerts(),
        api.getOperationsTransfers(),
        api.getOperationsNotifications(),
      ]);

      const next: OperationalSummary = {
        activeTrips: 0, pendingBookings: 0, pendingSupplierConfirmations: 0,
        paymentIssues: 0, exceptions: 0, atRiskTrips: 0,
        unreadSupport: 0, supplierIssues: 0,
        activeTransfers: 0, unreadNotifications: 0,
      };

      if (transfersData.status === 'fulfilled') {
        const transfers = (transfersData.value as any)?.transfers || [];
        next.activeTransfers = transfers.filter((t: any) => t.supplierState !== 'COMPLETED').length;
      }
      if (notificationsData.status === 'fulfilled') {
        next.unreadNotifications = (notificationsData.value as any)?.summary?.unread || 0;
      }
      if (opsOverview.status === 'fulfilled') {
        const ov = opsOverview.value as any;
        const s = ov?.summary;
        next.activeTrips = s?.activeTrips ?? ov?.activeTrips ?? ov?.trips?.active ?? 0;
        next.pendingBookings = s?.pendingBookings ?? ov?.pendingBookings ?? ov?.bookings?.pending ?? 0;
        next.pendingSupplierConfirmations = s?.pendingSupplierConfirmations ?? ov?.pendingSupplierConfirmations ?? 0;
        next.paymentIssues = s?.paymentIssues ?? ov?.paymentIssues ?? ov?.payments?.failed ?? 0;
        next.atRiskTrips = s?.atRiskTrips ?? ov?.atRiskTrips ?? 0;
      }
      if (supportData.status === 'fulfilled') {
        next.unreadSupport = supportData.value.openCount ?? 0;
      }
      if (marketAlerts.status === 'fulfilled') {
        const alerts = (marketAlerts.value as any)?.alerts || [];
        next.exceptions = alerts.filter((a: any) => !a.acknowledged).length;
        next.supplierIssues = alerts.filter((a: any) => a.alertType?.includes('SOURCE') || a.alertType?.includes('SUPPLIER')).length;
      }

      setSummary(next);
      setLastUpdated(new Date());
    } catch { /* Non-critical */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30_000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  return { summary, loading, lastUpdated, refresh: fetchSummary };
}

function useActionQueue() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const [supportData, marketAlerts, reviewQueue] = await Promise.allSettled([
          api.getSupportMessages(),
          api.getMarketAlerts(),
          api.getMarketReviewQueue(),
        ]);

        const items: ActionItem[] = [];

        if (supportData.status === 'fulfilled') {
          (supportData.value.messages || []).filter((m: any) => m.status === 'OPEN').forEach((m: any) => {
            const ageMin = Math.round((Date.now() - new Date(m.createdAt).getTime()) / 60_000);
            items.push({
              id: m.id, priority: m.urgent ? 'CRITICAL' : ageMin > 60 ? 'HIGH' : 'MEDIUM',
              category: 'support', title: m.urgent ? `URGENT: ${m.category || 'Support'}` : `Support: ${m.category || 'General'}`,
              description: m.message?.substring(0, 120) || '', entityType: 'support', entityId: m.id,
              createdAt: m.createdAt, ageMinutes: ageMin,
              reason: m.urgent ? 'Traveler marked urgent' : ageMin > 60 ? `Open ${Math.round(ageMin / 60)}h — SLA risk` : 'New support message',
            });
          });
        }

        if (marketAlerts.status === 'fulfilled') {
          ((marketAlerts.value as any)?.alerts || []).filter((a: any) => !a.acknowledged).forEach((a: any) => {
            const ageMin = Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60_000);
            items.push({
              id: a.id, priority: a.severity || 'MEDIUM', category: 'market',
              title: a.titleEn || a.titleAr || 'Market alert', description: a.messageEn || a.messageAr || '',
              entityType: 'market', entityId: a.id, createdAt: a.createdAt, ageMinutes: ageMin,
              reason: `Severity: ${a.severity}. Type: ${a.alertType}`,
            });
          });
        }

        if (reviewQueue.status === 'fulfilled') {
          ((reviewQueue.value as any)?.items || []).filter((r: any) => r.status === 'PENDING_REVIEW').forEach((r: any) => {
            const ageMin = Math.round((Date.now() - new Date(r.detectedAt).getTime()) / 60_000);
            items.push({
              id: r.id, priority: r.severity || 'MEDIUM', category: 'review',
              title: `Review: ${r.issueType?.replace(/_/g, ' ')}`, description: r.summaryEn || '',
              entityType: 'market', entityId: r.id, createdAt: r.detectedAt, ageMinutes: ageMin,
              reason: `${r.issueType} requires operator review`,
            });
          });
        }

        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        items.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3) || b.ageMinutes - a.ageMinutes);
        setActions(items.slice(0, 12));
      } catch { /* Non-critical */ } finally { setLoading(false); }
    };
    fetchActions();
  }, []);

  return { actions, loading };
}

function useRecentEvents() {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await api.getRecentEvents();
        const list = (data as { events: any[] }).events || [];
        setEvents(list.slice(0, 8).map(e => ({
          id: e.eventId || e.id || `evt-${Math.random()}`,
          type: e.eventType || e.type || 'UNKNOWN',
          title: e.data?.title || e.data?.description || e.eventType || 'Event',
          entity: e.data?.entity || e.data?.entityName || e.actorId,
          timestamp: e.timestamp || new Date().toISOString(),
          actor: e.actorId,
        })));
      } catch { setEvents([]); } finally { setLoading(false); }
    };
    fetchEvents();
  }, []);

  return { events, loading };
}

function useSystemHealth() {
  const [health, setHealth] = useState<HealthStatus>({
    api: 'unknown', db: 'unknown', payments: 'unknown', intelligence: 'unknown',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.getHealthData();
        setHealth({
          api: data?.status === 'ok' ? 'healthy' : 'degraded',
          db: data?.database?.adapter ? 'healthy' : 'unknown',
          payments: data?.paymentsSimulated ? 'degraded' : 'healthy',
          intelligence: data?.aiConfigured ? 'healthy' : data?.aiQuota?.exhausted ? 'degraded' : 'unknown',
        });
      } catch {
        setHealth({ api: 'down', db: 'unknown', payments: 'unknown', intelligence: 'unknown' });
      } finally { setLoading(false); }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { health, loading };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatAge(minutes: number, t: (key: string) => string): string {
  if (minutes < 1) return t('cmd.overview.justNow');
  if (minutes < 60) return t('cmd.overview.minutesAgo').replace('${minutes}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('cmd.overview.hoursAgo').replace('${hours}', String(hours));
  return t('cmd.overview.daysAgo').replace('${days}', String(Math.floor(hours / 24)));
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  support: MessageSquare, market: Globe, review: ShieldAlert, payment: DollarSign, supplier: Users, trip: Plane,
};

// ─── Main Overview ──────────────────────────────────────────────────────────
export default function Overview({ onNavigate }: { onNavigate: (s: SectionId) => void }) {
  const { language, t } = useLanguage();
  const { summary, loading: summaryLoading, lastUpdated, refresh: refreshSummary } = useOperationalSummary();
  const { actions, loading: actionsLoading } = useActionQueue();
  const { events, loading: eventsLoading } = useRecentEvents();
  const { health, loading: healthLoading } = useSystemHealth();

  const isHealthy = summary.exceptions === 0 && summary.paymentIssues === 0 && summary.atRiskTrips === 0;
  const hasUrgentItems = actions.some(a => a.priority === 'CRITICAL');

  const bannerStatus = hasUrgentItems ? 'action-required' as const : isHealthy ? 'healthy' as const : 'degraded' as const;
  const bannerTitle = hasUrgentItems ? t('cmd.overview.actionRequired') : isHealthy ? t('cmd.overview.allOperational') : t('cmd.overview.needsAttention');

  const freshness = lastUpdated
    ? (() => {
        const s = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
        if (s < 60) return t('cmd.overview.updatedSecondsAgo').replace('${s}', String(s));
        if (s < 600) return t('cmd.overview.updatedMinutesAgo').replace('${m}', String(Math.round(s / 60)));
        return t('cmd.overview.stale').replace('${m}', String(Math.round(s / 60)));
      })()
    : undefined;

  const healthItems = useMemo(() => [
    { label: t('cmd.overview.api'), status: health.api },
    { label: t('cmd.overview.db'), status: health.db },
    { label: t('cmd.overview.payments'), status: health.payments },
    { label: t('cmd.overview.ai'), status: health.intelligence },
  ], [health, t]);

  return (
    <div className="space-y-5">
      {/* ─── Status Banner ─────────────────────────────────────────────── */}
      <AlertBanner
        status={bannerStatus}
        title={bannerTitle}
        subtitle={`${t('cmd.title')} · ${freshness || t('cmd.loading')}`}
        onRefresh={refreshSummary}
      />

      {/* ─── Primary KPIs ─────────────────────────────────────────────── */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => <SkeletonKpi key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Plane}
            label={t('cmd.overview.activeTrips')}
            value={summary.activeTrips}
            onClick={() => onNavigate('trips')}
          />
          <KpiCard
            icon={Package}
            label={t('cmd.overview.pendingBookings')}
            value={summary.pendingBookings}
            iconColor="text-amber-400"
            onClick={() => onNavigate('trips')}
          />
          <KpiCard
            icon={Users}
            label={t('cmd.overview.supplierConfirmations')}
            value={summary.pendingSupplierConfirmations}
            iconColor="text-sky-400"
            onClick={() => onNavigate('suppliers')}
          />
          <KpiCard
            icon={MessageSquare}
            label={t('cmd.overview.supportQueue')}
            value={summary.unreadSupport}
            iconColor="text-[var(--accent-secondary)]"
            onClick={() => onNavigate('support')}
          />
        </div>
      )}

      {/* ─── Secondary KPIs ───────────────────────────────────────────── */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => <SkeletonKpi key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={AlertTriangle}
            label={t('cmd.overview.exceptions')}
            value={summary.exceptions}
            iconColor={summary.exceptions > 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}
            onClick={() => onNavigate('exceptions')}
          />
          <KpiCard
            icon={DollarSign}
            label={t('cmd.overview.paymentIssues')}
            value={summary.paymentIssues}
            iconColor={summary.paymentIssues > 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}
            onClick={() => onNavigate('commerce')}
          />
          <KpiCard
            icon={Car}
            label={t('cmd.overview.activeTransfers')}
            value={summary.activeTransfers}
            iconColor="text-sky-400"
            onClick={() => onNavigate('transfers')}
          />
          <KpiCard
            icon={Bell}
            label={t('cmd.overview.unreadNotifications')}
            value={summary.unreadNotifications}
            iconColor={summary.unreadNotifications > 0 ? 'text-amber-400' : 'text-[var(--text-muted)]'}
            onClick={() => onNavigate('notifications')}
          />
        </div>
      )}

      {/* ─── Main Content Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Action Queue — 2/3 */}
        <div className="lg:col-span-2">
          <DashCard padding="none">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <SectionHeader icon={Zap} iconColor="text-[var(--accent-secondary)]" title={t('cmd.overview.needsAction')} badge={{ count: actions.length }} />
            </div>

            {actionsLoading ? (
              <div className="px-5 pb-5">
                <Skeleton variant="list" count={3} />
              </div>
            ) : actions.length === 0 ? (
              <div className="px-5 pb-5">
                <div className="py-8 text-center rounded-xl bg-[var(--btn-util-bg)]/50">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                  <div className="text-sm font-bold text-emerald-400/80">{t('cmd.overview.noPendingActions')}</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-1">{t('cmd.overview.allClear')}</div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {actions.map(action => {
                  const Icon = CATEGORY_ICONS[action.category] || AlertTriangle;
                  return (
                    <div key={action.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[var(--btn-util-bg)]/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={action.priority} />
                          <span className="text-xs font-bold text-[var(--text-primary)] truncate">{action.title}</span>
                        </div>
                        {action.description && (
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{action.description}</p>
                        )}
                        <p className="text-[10px] text-[var(--text-muted)]/70 mt-0.5 italic">{action.reason}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap">{formatAge(action.ageMinutes, t)}</span>
                        {action.entityId && (
                          <button
                            type="button"
                            onClick={() => onNavigate(action.entityType === 'support' ? 'support' : action.entityType === 'market' ? 'intelligence' : 'exceptions')}
                            className="px-2 py-1 rounded-md bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 text-[var(--accent-primary)] text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            {t('cmd.overview.open')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashCard>
        </div>

        {/* Right Column — 1/3 */}
        <div className="space-y-5">
          {/* System Health */}
          <DashCard padding="none">
            <div className="px-5 pt-4 pb-3">
              <SectionHeader icon={HeartPulse} iconColor="text-emerald-400" title={t('cmd.overview.systemHealth')} />
            </div>
            <div className="px-5 pb-4 space-y-2.5">
              {healthLoading ? (
                <Skeleton variant="text" count={2} />
              ) : healthItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} dot />
                    <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                  </div>
                  <StatusBadge status={item.status} size="sm" />
                </div>
              ))}
              <button
                type="button"
                onClick={() => onNavigate('health')}
                className="w-full text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors pt-2 border-t border-[var(--border-subtle)] cursor-pointer"
              >
                {t('cmd.overview.viewFullHealth')}
              </button>
            </div>
          </DashCard>

          {/* Recent Events */}
          <DashCard padding="none">
            <div className="px-5 pt-4 pb-3">
              <SectionHeader icon={Activity} iconColor="text-sky-400" title={t('cmd.overview.recentEvents')} />
            </div>
            <div className="px-5 pb-4">
              {eventsLoading ? (
                <Skeleton variant="list" count={3} />
              ) : events.length === 0 ? (
                <div className="py-4 text-center text-xs text-[var(--text-muted)]">{t('cmd.overview.noEvents')}</div>
              ) : (
                <div className="space-y-0">
                  {events.map((event, i) => (
                    <div key={event.id} className={`flex items-start gap-2.5 py-2.5 ${i < events.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]/40 mt-1.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{event.title}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                          {event.actor && <span>{event.actor} · </span>}
                          {event.entity && <span>{event.entity} · </span>}
                          {formatAge(Math.round((Date.now() - new Date(event.timestamp).getTime()) / 60_000), t)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DashCard>
        </div>
      </div>
    </div>
  );
}
