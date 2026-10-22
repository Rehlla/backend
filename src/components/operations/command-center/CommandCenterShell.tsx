import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  DollarSign,
  Users,
  Globe,
  Brain,
  FileText,
  Flag,
  HeartPulse,
  Search,
  Radio,
  ChevronLeft,
  ChevronRight,
  Zap,
  Plane,
  Package,
  BedDouble,
  MessageSquare,
  MessageCircle,
  Bell,
  Car,
  Lightbulb,
  PenTool,
  Utensils,
  MoreHorizontal,
  X,
  Volume2,
  VolumeX,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { api, openStaffStream } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { SectionErrorBoundary } from './ErrorBoundary';
import { requestAlertNotificationPermission, useAlertAttention } from './useAlertAttention';
import { isAlertSoundMuted, newIds, playAlertSound, setAlertSoundMuted, startAlertLoop, stopAlertLoop, unlockAlertSounds, type AlertKind } from './alertSounds';

// ─── Section definitions ────────────────────────────────────────────────────
export type SectionId =
  | 'overview'
  | 'core'
  | 'trips'
  | 'transfers'
  | 'exceptions'
  | 'commerce'
  | 'accommodations'
  | 'stays'
  | 'suppliers'
  | 'intelligence'
  | 'opportunities'
  | 'knowledge'
  | 'support'
  | 'sms'
  | 'whatsapp'
  | 'notifications'
  | 'audit'
  | 'flags'
  | 'jobs'
  | 'health'
  | 'cms'
  | 'pricing'
  | 'dining'
  | 'catalog'
  | 'control';

interface NavSection {
  id: SectionId;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  badge?: number;
  group: 'core' | 'domain' | 'system';
}

export const NAV_SECTIONS: NavSection[] = [
  { id: 'overview', label: 'Overview', labelAr: 'نظرة عامة', icon: LayoutDashboard, group: 'core' },
  { id: 'core', label: 'Intelligence Core', labelAr: 'نواة الذكاء', icon: Brain, group: 'core' },
  { id: 'trips', label: 'Live Trips', labelAr: 'الرحلات الحية', icon: Plane, group: 'core' },
  { id: 'transfers', label: 'Transfers', labelAr: 'النقل', icon: Car, group: 'core' },
  { id: 'exceptions', label: 'Exceptions', labelAr: 'الاستثناءات', icon: AlertTriangle, group: 'core' },
  { id: 'commerce', label: 'Commerce', labelAr: 'التجارة', icon: DollarSign, group: 'domain' },
  { id: 'accommodations', label: 'Accommodations', labelAr: 'أماكن الإقامة', icon: Package, group: 'domain' },
  { id: 'stays', label: 'Stays', labelAr: 'الإقامات', icon: BedDouble, group: 'domain' },
  { id: 'suppliers', label: 'Suppliers', labelAr: 'الموردين', icon: Users, group: 'domain' },
  { id: 'intelligence', label: 'Intelligence', labelAr: 'الاستخبارات', icon: Globe, group: 'domain' },
  { id: 'opportunities', label: 'Opportunities', labelAr: 'الفرص', icon: Lightbulb, group: 'domain' },
  { id: 'knowledge', label: 'Knowledge', labelAr: 'المعرفة', icon: Brain, group: 'domain' },
  { id: 'support', label: 'Support', labelAr: 'الدعم', icon: MessageSquare, group: 'domain' },
  { id: 'sms', label: 'SMS Center', labelAr: 'الرسائل', icon: MessageSquare, group: 'domain' },
  { id: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب', icon: MessageCircle, group: 'domain' },
  { id: 'notifications', label: 'Notifications', labelAr: 'الإشعارات', icon: Bell, group: 'domain' },
  { id: 'audit', label: 'Audit Log', labelAr: 'سجل التدقيق', icon: FileText, group: 'system' },
  { id: 'flags', label: 'Feature Flags', labelAr: 'أعلام الميزات', icon: Flag, group: 'system' },
  { id: 'jobs', label: 'Market Jobs', labelAr: 'الوظائف', icon: Zap, group: 'system' },
  { id: 'health', label: 'System Health', labelAr: 'صحة النظام', icon: HeartPulse, group: 'system' },
  { id: 'cms', label: 'CMS Content', labelAr: 'إدارة المحتوى', icon: PenTool, group: 'core' },
  { id: 'pricing', label: 'Pricing & Inventory', labelAr: 'التسعير والمخزون', icon: DollarSign, group: 'domain' },
  { id: 'dining', label: 'Dining Orders', labelAr: 'طلبات المطاعم', icon: Utensils, group: 'domain' },
  { id: 'catalog', label: 'Catalogue', labelAr: 'الكتالوج', icon: BookOpen, group: 'domain' },
  { id: 'control', label: 'Control', labelAr: 'التحكم', icon: ShieldCheck, group: 'system' },
];

/**
 * The permission each section needs (docs/OPS_API_CONTRACT.md keys). A list
 * means any one of them. useAuth().can falls back to the role defaults when
 * the session carries no permission list, so older sessions keep the
 * role-based behaviour.
 */
const SECTION_PERMISSIONS: Record<SectionId, readonly string[]> = {
  overview: ['ops.overview.view'],
  core: ['ops.intelligence.view'],
  trips: ['ops.trips.view'],
  transfers: ['ops.transfers.view'],
  exceptions: ['ops.exceptions.view'],
  commerce: ['ops.commerce.view'],
  accommodations: ['ops.accommodations.view'],
  stays: ['ops.stays.view'],
  suppliers: ['ops.suppliers.view'],
  intelligence: ['ops.intelligence.view'],
  opportunities: ['ops.opportunities.view'],
  knowledge: ['ops.knowledge.view'],
  support: ['ops.support.view'],
  sms: ['ops.sms.view'],
  whatsapp: ['ops.sms.view', 'ops.notifications.view'],
  notifications: ['ops.notifications.view'],
  audit: ['ops.audit.view'],
  flags: ['ops.flags.view'],
  jobs: ['ops.jobs.view'],
  health: ['ops.health.view'],
  cms: ['cms.content.view'],
  pricing: ['ops.pricing.view'],
  dining: ['ops.dining.view'],
  catalog: ['catalog.activities.view', 'catalog.packages.view', 'catalog.transfers.view', 'catalog.hotels.view', 'catalog.restaurants.view'],
  control: ['admin.users.view', 'admin.settings.view', 'ops.flags.view', 'admin.integrations.view', 'admin.approvals.decide', 'ops.audit.view'],
};

// Mobile: 5 primary tabs + overflow
const MOBILE_PRIMARY: SectionId[] = ['overview', 'trips', 'intelligence', 'support'];
const MOBILE_MORE_SECTIONS = NAV_SECTIONS.filter(s => !MOBILE_PRIMARY.includes(s.id) && s.id !== 'overview');

// ─── Lazy section views ─────────────────────────────────────────────────────
const Overview = React.lazy(() => import('./Overview'));
const IntelligenceCoreView = React.lazy(() => import('../../intelligence-core/IntelligenceCoreView'));
const GlobalIntelligenceCore = React.lazy(() => import('../../intelligence-core/GlobalIntelligenceCore').then(m => ({ default: m.GlobalIntelligenceCore })));
const LiveTripRadar = React.lazy(() => import('./LiveTripRadar'));
const TransfersSection = React.lazy(() => import('./TransfersSection'));
const ExceptionsCenter = React.lazy(() => import('./ExceptionsCenter'));
const CommerceControl = React.lazy(() => import('./CommerceControl'));
const AccommodationsAdmin = React.lazy(() => import('./AccommodationsAdmin'));
const SupplierCommand = React.lazy(() => import('./SupplierCommand'));
const IntelligenceCommand = React.lazy(() => import('./IntelligenceCommand'));
const OpportunitiesSection = React.lazy(() => import('./OpportunitiesSection'));
const KnowledgeOps = React.lazy(() => import('./KnowledgeOps'));
const SupportCenter = React.lazy(() => import('./SupportCenter'));
const SmsCenter = React.lazy(() => import('./SmsCenter'));
const WhatsAppSection = React.lazy(() => import('./WhatsAppSection'));
const NotificationsCenter = React.lazy(() => import('./NotificationsCenter'));
const AuditCenter = React.lazy(() => import('./AuditCenter'));
const FeatureFlagsView = React.lazy(() => import('./FeatureFlagsView'));
const MarketJobsSection = React.lazy(() => import('./MarketJobsSection'));
const SystemHealth = React.lazy(() => import('./SystemHealth'));
const CmsContentDashboard = React.lazy(() => import('./CmsContentDashboard').then(m => ({ default: m.CmsContentDashboard })));
const PricingInventory = React.lazy(() => import('./PricingInventory'));
const DiningOrdersSection = React.lazy(() => import('./DiningOrdersSection'));
const StaysConsole = React.lazy(() => import('./StaysConsole'));
const CommandPalette = React.lazy(() => import('./CommandPalette'));
const ControlSection = React.lazy(() => import('./control/ControlSection'));
const CatalogSection = React.lazy(() => import('./catalog/CatalogSection'));

// ─── Section Badge Polling ──────────────────────────────────────────────────
function useSectionBadges() {
  const [badges, setBadges] = useState<Partial<Record<SectionId, number>>>({});
  const seen = useRef<Record<AlertKind, Set<string> | null>>({ dining: null, stay: null, support: null });
  // Kinds that are ringing until an operator answers (see startAlertLoop).
  const [ringing, setRinging] = useState<AlertKind[]>([]);
  const dismiss = useCallback((kind?: AlertKind) => {
    stopAlertLoop(kind);
    setRinging(prev => (kind ? prev.filter(k => k !== kind) : []));
  }, []);
  useEffect(() => () => stopAlertLoop(), []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [support, opsOverview, marketAlerts, dining, stays] = await Promise.allSettled([
          api.getSupportMessages(),
          api.getOperationsOverview(),
          api.getMarketAlerts(),
          api.getDiningOrders(),
          api.adminListStayBookings(),
        ]);

        if (cancelled) return;
        const next: Partial<Record<SectionId, number>> = {};

        if (support.status === 'fulfilled' && support.value.openCount > 0) {
          next.support = support.value.openCount;
        }
        if (opsOverview.status === 'fulfilled') {
          const ov = opsOverview.value as any;
          const s = ov?.summary;
          const pending = s?.pendingSupplierConfirmations || s?.pendingBookings || ov?.pendingSupplierConfirmations || ov?.pendingBookings || 0;
          if (pending > 0) next.trips = pending;
        }
        if (marketAlerts.status === 'fulfilled') {
          const alerts = (marketAlerts.value as any)?.alerts || [];
          const unack = alerts.filter((a: any) => !a.acknowledged).length;
          if (unack > 0) next.exceptions = unack;
        }

        // Work that needs a person: orders the kitchen has not confirmed,
        // stays paid and waiting for approval or just reserved, open messages.
        const waiting: Record<AlertKind, string[] | null> = { dining: null, stay: null, support: null };
        if (dining.status === 'fulfilled') {
          waiting.dining = dining.value.orders.filter(o => o.status === 'PENDING_CONFIRMATION').map(o => o.id);
          if (waiting.dining.length > 0) next.dining = waiting.dining.length;
        }
        if (stays.status === 'fulfilled') {
          const rows = stays.value.bookings;
          waiting.stay = rows
            .filter(b => b.status === 'PENDING_CONFIRMATION' || b.status === 'PENDING_PAYMENT')
            // A guest reporting "I've paid" (number or receipt) is new work on
            // the same row, so it rings again with its own id.
            .map(b => {
              const pi = (b.paymentInstructions ?? {}) as { claimedAt?: unknown };
              return `${String(b.bookingRef)}:${String(b.status)}${pi.claimedAt || b.paymentProofUrl ? ':claimed' : ''}`;
            });
          const toApprove = rows.filter(b => b.status === 'PENDING_CONFIRMATION').length;
          if (toApprove > 0) next.stays = toApprove;
        }
        if (support.status === 'fulfilled') {
          waiting.support = support.value.messages.filter(m => m.status === 'OPEN').map(m => m.id);
        }

        // Ring once per poll for each kind that gained an item. The first poll
        // only records what is already waiting.
        for (const kind of ['dining', 'stay', 'support'] as const) {
          const current = waiting[kind];
          if (current === null) continue;
          if (newIds(current, seen.current[kind]).length > 0) {
            startAlertLoop(kind);
            setRinging(prev => (prev.includes(kind) ? prev : [...prev, kind]));
          }
          seen.current[kind] = new Set(current);
        }

        setBadges(next);
      } catch {
        // Non-critical
      }
    };

    poll();
    // 15s: a new order should ring while the guest is still looking at it.
    // The polling stays as the fallback; the staff stream (SSE) only pulls
    // the next poll forward when something happens, so badges move at once.
    const interval = setInterval(poll, 15_000);
    let streamTimer: ReturnType<typeof setTimeout> | null = null;
    const closeStream = openStaffStream(['ops', 'support', 'exceptions', 'approvals', 'notifications'], () => {
      if (streamTimer) return;
      streamTimer = setTimeout(() => { streamTimer = null; void poll(); }, 750);
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (streamTimer) clearTimeout(streamTimer);
      closeStream();
    };
  }, []);

  return { badges, ringing, dismiss };
}

// ─── Section Content Router ─────────────────────────────────────────────────
function SectionContent({ section, onNavigate }: { section: SectionId; onNavigate: (s: SectionId) => void }) {
  switch (section) {
    case 'overview': return <Overview onNavigate={onNavigate} />;
    case 'core': return <IntelligenceCoreView context={{ section }} />;
    case 'trips': return <LiveTripRadar />;
    case 'transfers': return <TransfersSection />;
    case 'exceptions': return <ExceptionsCenter />;
    case 'commerce': return <CommerceControl />;
    case 'accommodations': return <AccommodationsAdmin />;
    case 'stays': return <StaysConsole />;
    case 'suppliers': return <SupplierCommand />;
    case 'intelligence': return <IntelligenceCommand />;
    case 'opportunities': return <OpportunitiesSection />;
    case 'knowledge': return <KnowledgeOps />;
    case 'support': return <SupportCenter />;
    case 'sms': return <SmsCenter />;
    case 'whatsapp': return <WhatsAppSection />;
    case 'notifications': return <NotificationsCenter />;
    case 'audit': return <AuditCenter />;
    case 'flags': return <FeatureFlagsView />;
    case 'jobs': return <MarketJobsSection />;
    case 'health': return <SystemHealth />;
    case 'cms': return <CmsContentDashboard />;
    case 'pricing': return <PricingInventory />;
    case 'dining': return <DiningOrdersSection />;
    case 'catalog': return <CatalogSection scope="staff" />;
    case 'control': return <ControlSection />;
    default: return <Overview onNavigate={onNavigate} />;
  }
}

// ─── Loading fallback ───────────────────────────────────────────────────────
function SectionLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
        <span className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        <span>{t('cmd.loading')}</span>
      </div>
    </div>
  );
}

// ─── Mobile More Menu ───────────────────────────────────────────────────────
function MobileMoreMenu({ activeSection, onNavigate, onClose, badges, isVisible }: {
  activeSection: SectionId;
  onNavigate: (s: SectionId) => void;
  onClose: () => void;
  badges: Partial<Record<SectionId, number>>;
  isVisible: (s: SectionId) => boolean;
}) {
  const { language, t } = useLanguage();

  const more = MOBILE_MORE_SECTIONS.filter(s => isVisible(s.id));
  const groupedSections = {
    core: more.filter(s => s.group === 'core'),
    domain: more.filter(s => s.group === 'domain'),
    system: more.filter(s => s.group === 'system'),
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-[var(--surface-container)] border-t border-[var(--border-subtle)] rounded-t-2xl max-h-[70vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--surface-container)] px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--text-primary)]">{t('cmd.nav.moreSections')}</span>
          <button type="button" onClick={onClose} aria-label={t('cmd.close')} className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] cursor-pointer">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {(['core', 'domain', 'system'] as const).map(group => (
            <div key={group}>
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                {group === 'core' ? t('cmd.group.liveOps') : group === 'domain' ? t('cmd.group.domains') : t('cmd.group.system')}
              </div>
              <div className="space-y-1">
                {groupedSections[group].map(section => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  const badgeCount = badges[section.id];
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => { onNavigate(section.id); onClose(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--btn-util-bg)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{language === 'ar' ? section.labelAr : section.label}</span>
                      {badgeCount && badgeCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 text-[10px] font-bold">
                          {badgeCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Shell ─────────────────────────────────────────────────────────────
export const CommandCenterShell: React.FC = () => {
  const { language, isRTL, t } = useLanguage();
  const { canAny } = useAuth();
  const isVisible = useCallback((id: SectionId) => canAny(SECTION_PERMISSIONS[id]), [canAny]);
  const visibleSections = useMemo(() => NAV_SECTIONS.filter(s => isVisible(s.id)), [isVisible]);
  const [requestedSection, setActiveSection] = useState<SectionId>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '').split('/')[0] : '';
    return NAV_SECTIONS.some(s => s.id === hash) ? (hash as SectionId) : 'overview';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1280);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  // A section the session may not open (a deep link, a palette pick) falls
  // back to the first one it may.
  const activeSection: SectionId = isVisible(requestedSection)
    ? requestedSection
    : (visibleSections[0]?.id ?? 'overview');
  const { badges, ringing, dismiss } = useSectionBadges();
  const ALERT_TARGET: Record<AlertKind, SectionId> = { dining: 'dining', stay: 'stays', support: 'support' };
  useAlertAttention(ringing.map(kind => t(`cmd.alert.${kind}`)));
  const [muted, setMuted] = useState(isAlertSoundMuted);
  useEffect(() => {
    const unlock = () => {
      unlockAlertSounds();
      requestAlertNotificationPermission();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setAlertSoundMuted(next);
    requestAlertNotificationPermission();
    unlockAlertSounds();
    // Unmuting plays a sample so the operator hears the volume right away.
    if (!next) window.setTimeout(() => playAlertSound('dining', { force: true }), 60);
  };
  const soundButton = (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={!muted}
      aria-label={muted ? t('cmd.alertsOff') : t('cmd.alertsOn')}
      title={muted ? t('cmd.alertsOff') : t('cmd.alertsOn')}
      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
        muted
          ? 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          : 'border-[var(--accent-primary)]/40 text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
      }`}
    >
      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  );

  // Track viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    const mql = window.matchMedia('(max-width: 1023px)');
    checkMobile();
    mql.addEventListener('change', checkMobile);
    return () => mql.removeEventListener('change', checkMobile);
  }, []);

  // Auto-collapse sidebar on medium screens
  useEffect(() => {
    if (isMobile) return;
    const mql = window.matchMedia('(max-width: 1280px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSidebarCollapsed(true);
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [isMobile]);

  // Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false);
        if (moreMenuOpen) setMoreMenuOpen(false);
      }
      if (!paletteOpen && !moreMenuOpen && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9 && num <= visibleSections.length) {
          e.preventDefault();
          setActiveSection(visibleSections[num - 1].id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen, moreMenuOpen, visibleSections]);

  const handleNavigate = useCallback((section: SectionId) => {
    setActiveSection(section);
    if (typeof window !== 'undefined' && !window.location.hash.startsWith(`#${section}`)) {
      window.history.replaceState(null, '', `#${section}`);
    }
  }, []);

  const groupedSections = {
    core: visibleSections.filter(s => s.group === 'core'),
    domain: visibleSections.filter(s => s.group === 'domain'),
    system: visibleSections.filter(s => s.group === 'system'),
  };

  const activeSectionData = NAV_SECTIONS.find(s => s.id === activeSection);
  const activeLabel = activeSectionData
    ? (language === 'ar' ? activeSectionData.labelAr : activeSectionData.label)
    : t('cmd.nav.overview');

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col lg:flex-row">
      {/* ─── Desktop Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-container)]/60 backdrop-blur-xl flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className="px-3 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)] flex-shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate">{t('cmd.title')}</div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">{t('cmd.subtitle')}</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {(['core', 'domain', 'system'] as const).map(group => (
            <div key={group}>
              {!sidebarCollapsed && (
                <div className="px-2 pt-3 pb-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {group === 'core' ? t('cmd.group.liveOps') : group === 'domain' ? t('cmd.group.domains') : t('cmd.group.system')}
                </div>
              )}
              {groupedSections[group].map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const badgeCount = badges[section.id];
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleNavigate(section.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)]'
                    }`}
                    title={sidebarCollapsed ? (language === 'ar' ? section.labelAr : section.label) : undefined}
                  >
                    {/* Collapsed rail: the count has no room, so a dot says
                        "something is waiting" on the icon itself. */}
                    <span className="relative flex-shrink-0">
                      <Icon className="w-4 h-4" />
                      {sidebarCollapsed && badgeCount && badgeCount > 0 ? (
                        <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[var(--surface-container)]" aria-label={`${badgeCount}`} />
                      ) : null}
                    </span>
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{language === 'ar' ? section.labelAr : section.label}</span>
                        {badgeCount && badgeCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 text-[10px] font-bold min-w-[18px] text-center">
                            {badgeCount}
                          </span>
                        ) : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle + keyboard hints */}
        <div className="px-2 py-2 border-t border-[var(--border-subtle)] space-y-1">
          {!sidebarCollapsed && (
            <div className="px-2 py-1 text-[10px] text-[var(--text-muted)]/60 font-mono">
              <span className="inline-block px-1 py-0.5 rounded bg-[var(--btn-util-bg)] text-[10px]">⌘K</span> search
              <span className="mx-1">·</span>
              <span className="inline-block px-1 py-0.5 rounded bg-[var(--btn-util-bg)] text-[10px]">1-9</span> jump
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)] transition-all cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            {!sidebarCollapsed && <span>{t('cmd.collapse')}</span>}
          </button>
        </div>
      </aside>


      {/* Ringing arrivals: stays on screen (and keeps ringing) until the
          operator opens the section or stops it. */}
      {/* Portalled to <body>: inside the shell it sat in a lower stacking
          context and slid under the site header. */}
      {/* Silent twin of the sound: the viewport edge breathes amber. */}
      {ringing.length > 0 && createPortal(
        <div aria-hidden="true" className="ops-alert-glow pointer-events-none fixed inset-0 z-[94]" />,
        document.body
      )}
      {ringing.length > 0 && createPortal(
        <div
          role="alert"
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed top-[calc(var(--dg-safe-top,0px)+4.5rem)] inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[95] flex flex-col gap-2 sm:w-[460px]"
        >
          {ringing.map(kind => (
            <div
              key={kind}
              className="flex items-center gap-3 rounded-2xl border border-amber-400/50 bg-[var(--surface-card)] p-3 shadow-2xl"
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                <span className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping motion-reduce:animate-none" aria-hidden="true" />
                <Bell className="relative h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-bold text-[var(--text-primary)]">{t(`cmd.alert.${kind}`)}</span>
              <button
                type="button"
                onClick={() => { dismiss(kind); handleNavigate(ALERT_TARGET[kind]); }}
                className="rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-[var(--surface-container)] cursor-pointer hover:brightness-110"
              >
                {t('cmd.alert.open')}
              </button>
              <button
                type="button"
                onClick={() => dismiss(kind)}
                className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]"
              >
                {t('cmd.alert.stop')}
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — desktop */}
        <header className="hidden lg:flex flex-shrink-0 h-12 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]/40 backdrop-blur-sm items-center justify-between px-4 sm:px-6">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{activeLabel}</h2>
          <div className="flex items-center gap-2">
          {soundButton}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('cmd.search')}</span>
            <kbd className="hidden sm:inline text-[10px] px-1 py-0.5 rounded bg-[var(--surface-container)] text-[var(--text-muted)] font-mono border border-[var(--border-subtle)]">⌘K</kbd>
          </button>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="lg:hidden flex-shrink-0 h-12 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]/60 backdrop-blur-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center">
              <Radio className="w-3 h-3 text-[var(--accent-primary)] animate-pulse" />
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)]">{activeLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            {soundButton}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="p-2 rounded-lg hover:bg-[var(--btn-util-bg)] cursor-pointer"
            >
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
        </header>

        {/* Section content */}
        <section
          aria-label={activeLabel}
          className="flex-1 overflow-y-auto pb-20 lg:pb-6"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
            <SectionErrorBoundary key={activeSection}>
              <Suspense fallback={<SectionLoading />}>
                <SectionContent section={activeSection} onNavigate={handleNavigate} />
              </Suspense>
            </SectionErrorBoundary>
          </div>
        </section>
      </div>

      {/* ─── Mobile Bottom Tab Bar ────────────────────────────────────── */}
      {/* Portaled to <body> at z-50: the app's own bottom tab bar is also
          z-40 but lives at the root, while this nav is inside <main> (a
          z-10 stacking context) — without the portal the app's bar paints
          over this one on phones and the More tab becomes untappable. */}
      {isMobile &&
        createPortal(
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface-container)]/95 backdrop-blur-xl border-t border-[var(--border-subtle)] safe-area-pb">
          <div className="flex items-stretch">
            {MOBILE_PRIMARY.filter(isVisible).map(sectionId => {
              const section = NAV_SECTIONS.find(s => s.id === sectionId)!;
              const Icon = section.icon;
              const isActive = activeSection === sectionId;
              const badgeCount = badges[sectionId];
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleNavigate(section.id)}
                  className={`flex-1 flex flex-col items-center justify-center py-2 relative transition-colors cursor-pointer ${
                    isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {badgeCount && badgeCount > 0 && (
                      <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-amber-500 text-[8px] font-bold text-white flex items-center justify-center">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold mt-0.5 truncate max-w-[60px]">{section.label}</span>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[var(--accent-primary)] rounded-full" />
                  )}
                </button>
              );
            })}
            {/* More button */}
            <button
              type="button"
              onClick={() => setMoreMenuOpen(true)}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors cursor-pointer ${
                moreMenuOpen ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">More</span>
            </button>
          </div>
        </nav>,
        document.body
      )}

      {/* ─── Mobile More Menu ─────────────────────────────────────────── */}
      {moreMenuOpen && (
        <MobileMoreMenu
          activeSection={activeSection}
          onNavigate={handleNavigate}
          onClose={() => setMoreMenuOpen(false)}
          badges={badges}
          isVisible={isVisible}
        />
      )}

      {/* ─── Global Intelligence Core (floating, every section) ────────── */}
      <Suspense fallback={null}>
        <GlobalIntelligenceCore context={{ section: activeSection, route: '/ops-console' }} />
      </Suspense>

      {/* ─── Command Palette ──────────────────────────────────────────── */}
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onNavigate={handleNavigate}
          />
        </Suspense>
      )}
    </div>
  );
};
