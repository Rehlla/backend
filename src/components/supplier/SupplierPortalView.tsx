import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Car,
  Waves,
  DollarSign,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Users,
  Globe,
  FileCheck2,
  Lock,
  ExternalLink,
  History,
  Bike
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import type { SupplierRevenueAnalytics } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { RentalsProviderPanel } from './RentalsProviderPanel';
import { PropertyStaysPanel } from './PropertyStaysPanel';
import { SupplierCalendarMini } from './SupplierCalendarMini';
import { SupplierTrustPanel } from './SupplierTrustPanel';

// The catalogue editor is heavy (form engine, calendars): load it on first use.
const CatalogSection = React.lazy(() => import('../operations/command-center/catalog/CatalogSection'));

/** What /api/suppliers/:id/dashboard returns, as this screen reads it. */
interface SupplierDashboardResponse {
  supplier: {
    id: string;
    businessName: string;
    businessNameAr?: string;
    category: string;
    tier: string;
    area?: string;
    licenseNumber?: string;
    linkedCandidateId?: string;
    capacitySummary?: string;
  } | null;
  activeBookings: Array<{
    id: string;
    bookingRef: string;
    serviceType: string;
    amountEGP: number;
    supplierState: string;
    travelerName: string;
    passengersCount: number;
    scheduledDate: string;
    scheduledTime: string;
  }>;
  pastBookings: unknown[];
  stats: {
    totalBookingsCount: number;
    pendingActionCount: number;
    confirmedCount: number;
    totalEarningsEGP: number;
    escrowPendingEGP: number;
    reliabilityScore: number;
    slaResponseRate: string;
  };
}

/** One row in the incoming-requests inbox, mapped from a BookingEntity. */
interface SupplierRequestRow {
  id: string;
  reference: string;
  service: string;
  traveler: string;
  scheduled: string;
  payoutEGP: number;
  supplierState: string;
  isPending: boolean;
}

export const SupplierPortalView: React.FC = () => {
  const {
    navigateTo,
    showToast,
    authoritativeSuppliers,
    activeSupplierId,
    setActiveSupplierId,
    sessionUser
  } = useTrip();
  const { language, isRTL , t} = useLanguage();

  const [activeTab, setActiveTab] = useState<'inbox' | 'inventory' | 'resources' | 'stays' | 'rentals' | 'revenue' | 'reliability' | 'audit' | 'listings'>('inbox');

  /**
   * Which supplier this portal is actually rendering for.
   *
   * A Supplier account is pinned to its own linked business, exactly as the
   * server's resolveActingSupplierId does — the partner switcher below is only
   * meaningful for Operations/Admin, who may act on behalf of a named supplier.
   * This used to be `authoritativeSuppliers[0]` with a hardcoded
   * 'SUP-SHUTTLE-01' fallback, so every supplier who signed in was shown the
   * same fleet regardless of who they were.
   */
  const isBackOffice = sessionUser?.role === 'Operations' || sessionUser?.role === 'Admin';
  const actingSupplierId = isBackOffice
    ? (activeSupplierId || sessionUser?.supplierId || null)
    : (sessionUser?.supplierId || null);

  // Live dashboard for the acting supplier: bookings, payout totals and the
  // reliability figures, all server-computed. `enabled` keeps it idle until we
  // know who we are asking about.
  const dashboardFetcher = useCallback(
    () => (actingSupplierId ? api.getSupplierDashboard(actingSupplierId) : Promise.resolve(null)),
    [actingSupplierId]
  );
  const dashboard = useApiResource<SupplierDashboardResponse | null>(dashboardFetcher, {
    enabled: !!actingSupplierId
  });

  // P6: Revenue & Analytics — server-computed from the same bookings as the
  // dashboard. Same `enabled` gate as the dashboard fetch.
  const revenueFetcher = useCallback(
    () => (actingSupplierId ? api.getSupplierRevenueAnalytics(actingSupplierId, 30) : Promise.resolve(null)),
    [actingSupplierId]
  );
  const revenue = useApiResource<SupplierRevenueAnalytics | null>(revenueFetcher, {
    enabled: !!actingSupplierId
  });
  const revenueData = revenue.data;

  /**
   * The partner record the descriptive tabs (capacity, roster, audit) render.
   *
   * Still the static context catalogue: those tabs read fields the dashboard
   * endpoint does not return (initialSlots, roster, auditLog), so they remain
   * illustrative until there are endpoints behind them. The identity shown in
   * the header comes from the server instead — see supplierIdentity below.
   */
  const selectedSupplier =
    authoritativeSuppliers.find(s => s.id === actingSupplierId) ||
    (isBackOffice ? authoritativeSuppliers[0] : undefined);

  /** Name, tier and licence as the server has them, falling back to the catalogue. */
  const serverSupplier = dashboard.data?.supplier;
  const supplierIdentity = {
    businessName: serverSupplier?.businessName || selectedSupplier?.businessName,
    category: serverSupplier?.category || selectedSupplier?.category || '',
    tier: serverSupplier?.tier || selectedSupplier?.tier,
    area: serverSupplier?.area || selectedSupplier?.area,
    licenseNumber: serverSupplier?.licenseNumber || selectedSupplier?.licenseNumber
  };

  const stats = dashboard.data?.stats;

  /**
   * The inbox, from the server.
   *
   * This was two hardcoded objects (REQ-SH-409, REQ-DV-812) in useState, so
   * every supplier saw the same two invented requests for the same invented
   * traveller, and accepting one only changed local state.
   */
  const activeRequests: SupplierRequestRow[] = useMemo(() => {
    const bookings = dashboard.data?.activeBookings ?? [];
    return bookings.map(b => ({
      id: b.id,
      reference: b.bookingRef || b.id,
      service: b.serviceType,
      traveler: [b.travelerName, b.passengersCount ? `${b.passengersCount} pax` : null]
        .filter(Boolean)
        .join(' · '),
      scheduled: [b.scheduledDate, b.scheduledTime].filter(Boolean).join(' · '),
      // The 85% supplier share, matching supplierService.getSupplierDashboard.
      payoutEGP: Math.round((b.amountEGP || 0) * 0.85),
      supplierState: b.supplierState,
      isPending: b.supplierState === 'PENDING_CONFIRMATION'
    }));
  }, [dashboard.data]);

  const [decidingId, setDecidingId] = useState<string | null>(null);

  const handleDecision = async (bookingId: string, decision: 'ACCEPT' | 'REJECT') => {
    if (!actingSupplierId) return;
    setDecidingId(bookingId);
    try {
      await api.respondSupplierBooking(bookingId, {
        supplierId: actingSupplierId,
        action: decision,
        reason: decision === 'REJECT' ? 'Supplier requested automated reallocation' : undefined
      });
      // Re-read rather than patch locally: the server owns the lifecycle state
      // and rejects transitions the UI would otherwise have shown as applied.
      dashboard.reload();
      showToast(
        decision === 'ACCEPT'
          ? t('supplier.decisionACCEPTBookingAccepted')
          : t('supplier.decisionREJECTBookingRejected')
      );
    } catch (e: any) {
      // Surfaced, not swallowed: a refused transition used to leave the row
      // looking accepted while the server had rejected the call.
      showToast(String(e?.message || e));
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div
      id="supplier-portal-view"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24"
    >
      {/* 1. Supplier Header */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-4 sm:px-6 lg:px-8 pt-8 pb-6 shadow-xs">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center font-bold">
                {supplierIdentity.category.includes('Diving') ? (
                  <Waves className="w-5 h-5" />
                ) : supplierIdentity.category.includes('Transfer') ? (
                  <Car className="w-5 h-5" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                    {supplierIdentity.businessName || 'Dahab Supplier & Partner OS'}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-[var(--accent-primary)] border border-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {supplierIdentity.tier || 'VERIFIED PARTNER ✓'}
                  </span>
                  {selectedSupplier?.linkedCandidateId && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[var(--btn-util-bg)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                      Discovery Provenance: {selectedSupplier.linkedCandidateId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-primary)]/60 flex items-center gap-2">
                  <span>{supplierIdentity.area} · {supplierIdentity.category}</span>
                  <span>•</span>
                  <span className="font-mono text-[var(--accent-primary)] font-semibold">{supplierIdentity.licenseNumber}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => navigateTo('/market-intelligence')}
                className="px-4 py-2 rounded-full bg-[var(--surface-container)]/10 hover:bg-[var(--surface-container)]/15 text-[var(--surface-container)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] border border-[var(--surface-container)]/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{t('supplier.marketDiscoveryIntel')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/ops-console')}
                className="px-4 py-2 rounded-full bg-[var(--surface-container)] text-[var(--text-primary)] hover:bg-[var(--surface-container)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                {t('supplier.opsConsole')}
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/my-trip')}
                className="px-4 py-2 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                {t('supplier.travelerView')}
              </button>
            </div>
          </div>

          {/* Dynamic Supplier Partner Switcher (Includes Newly Promoted Candidates!) */}
          <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)] overflow-x-auto">
            <span className="text-[12px] font-bold text-[var(--text-primary)]/50 me-1 whitespace-nowrap">
              {t('supplier.authoritativePartners')}
            </span>
            {authoritativeSuppliers.map(p => {
              const isSelected = p.id === (selectedSupplier?.id || activeSupplierId);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveSupplierId(p.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[var(--surface-container)] text-white shadow-xs'
                      : 'bg-stone-100 text-[var(--text-primary)]/70 hover:text-[var(--text-primary)] hover:bg-stone-200'
                  }`}
                >
                  {p.category.includes('Diving') ? (
                    <Waves className="w-3.5 h-3.5 text-sky-400" />
                  ) : p.category.includes('Transfer') ? (
                    <Car className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{p.businessName}</span>
                  {p.linkedCandidateId && p.linkedCandidateId !== 'DSC-000-HISTORIC' && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" title="Newly Promoted from Intelligence!" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 2. Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 overflow-x-auto">
          {([
            { id: 'inbox', label: t('supplier.incomingRequestsS05S06') },
            { id: 'inventory', label: t('supplier.capacitySlotsS03') },
            { id: 'resources', label: t('supplier.fleetResourceRosterS04') },
            { id: 'stays', label: t('propertyStays.tab') },
            ...(sessionUser?.role === 'Supplier' ? [{ id: 'listings' as const, label: t('cat.myListings') }] : []),
            { id: 'rentals', label: t('supplier.rentalBookings') },
            { id: 'revenue', label: isRTL ? 'الإيرادات والتحليلات' : 'Revenue & Analytics' },
            { id: 'reliability', label: t('supplier.reliabilitySLAScoreS09') },
            { id: 'audit', label: t('supplier.provenanceAuditTrail') }
          ] as const).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[var(--surface-container)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-primary)]/70 hover:text-[var(--text-primary)] hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: My listings — the supplier's own catalogue records (Submit for review, never publish) */}
        {activeTab === 'listings' && (
          <React.Suspense fallback={<div className="h-40 rounded-2xl bg-[var(--surface-container)] animate-pulse" />}>
            <CatalogSection scope="supplier" />
          </React.Suspense>
        )}

        {/* TAB: Stays — the hotel owner's guests and calendar */}
        {activeTab === 'stays' && <PropertyStaysPanel />}

        {/* TAB: Rentals (bikes) */}
        {activeTab === 'rentals' && (
          <RentalsProviderPanel showToast={showToast} />
        )}

        {/* TAB: Revenue & Analytics (P6 — server-computed) */}
        {activeTab === 'revenue' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {isRTL ? 'الإيرادات والتحليلات' : 'Revenue & Analytics'}
              </h2>
              <p className="text-xs text-[var(--text-primary)]/60">
                {isRTL
                  ? 'أرقام محسوبة على السيرفر من حجوزاتك الفعلية — آخر ٣٠ يوم.'
                  : 'Server-computed from your actual bookings — last 30 days.'}
              </p>
            </div>

            {!actingSupplierId && (
              <p className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
                {(language === 'ar')
                  ? 'حسابك غير مرتبط بمورّد، فلا توجد إيرادات لعرضها.'
                  : 'Your account is not linked to a supplier, so there is no revenue to show.'}
              </p>
            )}

            {actingSupplierId && revenue.status === 'loading' && (
              <p className="text-sm text-[var(--text-secondary)]">{t('cmd.loading')}</p>
            )}

            {actingSupplierId && revenue.status !== 'loading' && !revenueData && (
              <p className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
                {isRTL ? 'تعذّر تحميل التحليلات — جرّب تاني.' : 'Could not load analytics — try again.'}
              </p>
            )}

            {revenueData && (
              <>
                {/* Totals */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    { label: isRTL ? 'إجمالي الحجوزات' : 'Gross bookings', value: revenueData.totals.grossBookingsEGP, hint: isRTL ? 'كل الحجوزات' : `${revenueData.totals.bookingsCount} bookings` },
                    { label: isRTL ? 'أرباح محصّلة' : 'Earned payout', value: revenueData.totals.payoutEGP, hint: isRTL ? 'حجوزات مكتملة (٨٥٪)' : `completed (85%) · ${revenueData.totals.completedCount}` },
                    { label: isRTL ? 'بالضمان' : 'In escrow', value: revenueData.totals.escrowPendingEGP, hint: isRTL ? 'قيد التنفيذ' : 'active bookings' },
                    { label: isRTL ? 'مدفوعات مجدولة' : 'Payouts scheduled', value: revenueData.totals.payoutScheduledEGP, hint: isRTL ? 'خلال ٢٤ ساعة' : '24h hold' },
                  ] as const).map(card => (
                    <div key={card.label} className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{card.label}</p>
                      <p className="text-xl font-black text-[var(--text-primary)] mt-1 tabular-nums">
                        {card.value.toLocaleString()} <span className="text-xs font-bold">EGP</span>
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{card.hint}</p>
                    </div>
                  ))}
                </div>

                {/* Rates */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                  <span className="px-3 py-1.5 rounded-full border border-[var(--border-subtle)]">
                    {isRTL ? 'معدل الإكمال: ' : 'Completion rate: '}
                    <strong className="text-[var(--text-primary)]">
                      {revenueData.totals.completionRate != null
                        ? `${Math.round(revenueData.totals.completionRate * 100)}%`
                        : '—'}
                    </strong>
                  </span>
                  <span className="px-3 py-1.5 rounded-full border border-[var(--border-subtle)]">
                    {isRTL ? 'متوسط الحجز: ' : 'Avg booking: '}
                    <strong className="text-[var(--text-primary)]">
                      {revenueData.totals.avgBookingEGP != null
                        ? `${revenueData.totals.avgBookingEGP.toLocaleString()} EGP`
                        : '—'}
                    </strong>
                  </span>
                  {revenueData.totals.cancelledCount + revenueData.totals.rejectedCount > 0 && (
                    <span className="px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50 text-rose-800">
                      {isRTL ? 'ملغاة/مرفوضة: ' : 'Cancelled/rejected: '}
                      <strong>{revenueData.totals.cancelledCount + revenueData.totals.rejectedCount}</strong>
                    </span>
                  )}
                </div>

                {/* By service type */}
                {revenueData.byServiceType.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">
                      {isRTL ? 'حسب نوع الخدمة' : 'By service type'}
                    </h3>
                    <div className="space-y-2">
                      {revenueData.byServiceType.map(row => (
                        <div key={row.serviceType} className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-bold text-[var(--text-primary)] capitalize">{row.serviceType}</span>
                          <span className="text-[var(--text-secondary)]">{row.bookingsCount}×</span>
                          <span className="font-bold text-[var(--text-primary)] tabular-nums">
                            {row.grossEGP.toLocaleString()} EGP
                          </span>
                          <span className="text-[var(--text-secondary)] tabular-nums">
                            → {row.payoutEGP.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top bookings */}
                {revenueData.topBookings.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">
                      {isRTL ? 'أعلى الحجوزات' : 'Top bookings'}
                    </h3>
                    <div className="space-y-2">
                      {revenueData.topBookings.map(b => (
                        <div key={b.bookingRef} className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-bold text-[var(--text-primary)]">{b.bookingRef}</span>
                          <span className="text-[var(--text-secondary)] capitalize">{b.serviceType} · {b.scheduledDate}</span>
                          <span className="font-bold text-[var(--text-primary)] tabular-nums">
                            {b.payoutEGP.toLocaleString()} EGP
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 1: Incoming Requests Inbox */}
        {activeTab === 'inbox' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {t('supplier.liveBookingRequestsQueue')}
                </h2>
                {/*
                  Was "· WhatsApp Instant Dispatch Sync Active", beside a badge
                  claiming the same. Nothing sends WhatsApp: 'WHATSAPP' is only
                  a channel label on the internal notification row, and the one
                  real gateway is Twilio SMS, which is optional and off unless
                  configured. The count below is something this screen can
                  actually stand behind.
                */}
                <p className="text-xs text-[var(--text-primary)]/60">
                  {supplierIdentity.businessName}
                </p>
              </div>
              {stats && stats.pendingActionCount > 0 && (
                <span className="text-xs text-[var(--accent-secondary)] bg-amber-50 px-3 py-1 rounded-full border border-amber-200 font-medium">
                  {stats.pendingActionCount}{' '}
                  {(language === 'ar') ? 'بانتظار ردّك' : 'awaiting your response'}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {!actingSupplierId && (
                <p className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
                  {(language === 'ar')
                    ? 'حسابك غير مرتبط بمورّد، فلا توجد طلبات لعرضها.'
                    : 'Your account is not linked to a supplier, so there are no requests to show.'}
                </p>
              )}

              {actingSupplierId && dashboard.status === 'loading' && (
                <p className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
                  {t('cmd.loading')}
                </p>
              )}

              {actingSupplierId && dashboard.status === 'error' && (
                <p className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm text-red-400">
                  {dashboard.error}
                </p>
              )}

              {actingSupplierId && dashboard.status === 'ready' && activeRequests.length === 0 && (
                <p className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
                  {(language === 'ar') ? 'لا توجد طلبات نشطة حالياً.' : 'No active requests right now.'}
                </p>
              )}

              {activeRequests.map(req => (
                <div
                  key={req.id}
                  className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-stone-100 text-[var(--text-primary)]">
                        {req.reference}
                      </span>
                      <span className="font-bold text-base text-[var(--text-primary)]">{req.service}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-[var(--text-primary)]/80 pt-1">
                      <div>
                        <span className="text-[11px] text-[var(--text-primary)]/50 block">{t('supplier.traveler')}</span>
                        <span className="font-semibold">{req.traveler}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-primary)]/50 block">{t('supplier.pickupTime')}</span>
                        <span className="font-semibold text-[var(--accent-primary)]">{req.scheduled}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-primary)]/50 block">{t('supplier.supplierPayout')}</span>
                        <span className="font-bold text-[var(--text-primary)]">{req.payoutEGP.toLocaleString()} EGP</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {req.isPending ? (
                      <>
                        <button
                          type="button"
                          disabled={decidingId === req.id}
                          onClick={() => handleDecision(req.id, 'REJECT')}
                          className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/25 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          <span>{t('supplier.decline')}</span>
                        </button>
                        <button
                          type="button"
                          disabled={decidingId === req.id}
                          onClick={() => handleDecision(req.id, 'ACCEPT')}
                          className="px-5 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--accent-contrast,#fff)] text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{t('supplier.acceptConfirm')}</span>
                        </button>
                      </>
                    ) : (
                      <span className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/25">
                        {req.supplierState}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Capacity & Slots */}
        {activeTab === 'inventory' && (
          <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xs space-y-6">
            {/* Real availability calendar from supplierCalendarService — the
                same 30-day view booking flows consult. Hidden when no supplier
                is in scope; the static illustrative slots below remain only as
                a fallback when the calendar has no data yet. */}
            {actingSupplierId && (
              <SupplierCalendarMini supplierId={actingSupplierId} />
            )}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {t('supplier.dailyCapacitySlotsCalendar')}
                </h2>
                <p className="text-xs text-[var(--text-primary)]/60">
                  {selectedSupplier?.capacitySummary || 'Real-time capacity locking to prevent oversell collisions'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => showToast(t('supplier.availabilitySynced'))}
                className="px-3.5 py-1.5 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Inventory</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {(selectedSupplier?.initialSlots || [
                { time: '09:00 AM', title: 'Morning Slot', booked: 4, total: 6, notes: '2 Seats available' },
                { time: '14:00 PM', title: 'Afternoon Slot', booked: 2, total: 6, notes: '4 Seats available' },
                { time: '17:30 PM', title: 'Sunset Slot', booked: 6, total: 6, notes: 'Capacity locked (Full)' }
              ]).map((slot, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border space-y-2 ${
                    slot.booked >= slot.total
                      ? 'bg-[var(--accent-secondary)]/15 border-[var(--accent-secondary)]/25'
                      : 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)]">{slot.time} - {slot.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        slot.booked >= slot.total
                          ? 'bg-[var(--accent-secondary)]/30 text-[var(--accent-secondary)]'
                          : 'bg-[var(--accent-primary)]/30 text-[var(--accent-primary)]'
                      }`}
                    >
                      {slot.booked} / {slot.total} {slot.booked >= slot.total ? 'FULL' : 'Booked'}
                    </span>
                  </div>
                  <p className="text-[var(--text-primary)]/70">{slot.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Fleet & Resource Roster */}
        {activeTab === 'resources' && (
          <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xs space-y-6">
            <div className="border-b border-[var(--border-subtle)] pb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {t('supplier.certifiedFleetGuidesRegistry')}
              </h2>
              <p className="text-xs text-[var(--text-primary)]/60">
                {t('supplier.driverInstructorAssignmentsFor')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {(selectedSupplier?.roster || [
                { name: 'Captain Hany', role: 'Fleet Lead Driver', status: 'Assigned to Ahmed Mansour', license: 'Commercial Class 1' },
                { name: 'Captain Tarek', role: 'Airport Shuttle Driver', status: 'Available for 14:00 PM Slot', license: 'Commercial Class 1' }
              ]).map((member, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <div className="font-bold text-sm text-[var(--text-primary)]">{member.name}</div>
                  <div className="text-[var(--accent-primary)] font-medium">Role: {member.role}</div>
                  <div className="text-[var(--text-primary)]/70 text-[12px]">Status: {member.status}</div>
                  <div className="text-[var(--text-primary)]/50 text-[11px] font-mono">License: {member.license}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Reliability Score */}
        {activeTab === 'reliability' && (
          <div className="space-y-4">
            {/* The traveler-facing trust signals (reliability breakdown + reef
                score) — the same numbers ReliabilityBadge/ReefBadge render on
                public cards, mirrored here so the business sees and can act on
                what travelers see. */}
            <SupplierTrustPanel supplierId={actingSupplierId} />
          <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xs space-y-6">
            <div className="border-b border-[var(--border-subtle)] pb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {t('supplier.operationalReliabilitySLAScore')}
              </h2>
              <p className="text-xs text-[var(--text-primary)]/60">
                {t('supplier.ontimePickupRateAcceptance')}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                {/*
                  These three were the literals 98.4%, 2.1 mins and 99.1% —
                  shown to every supplier as their own operational record,
                  measured from nothing. They now carry what the server actually
                  counts, and an em dash when there is nothing to report.
                */}
                <span className="text-[11px] text-[var(--text-primary)]/50">
                  {(language === 'ar') ? 'إجمالي الحجوزات' : 'Total Bookings'}
                </span>
                <div className="text-2xl font-bold text-[var(--accent-primary)]">
                  {stats ? stats.totalBookingsCount.toLocaleString() : '—'}
                </div>
                <span className="text-[11px] text-[var(--accent-primary)]/80">{supplierIdentity.tier || ''}</span>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-primary)]/50">
                  {(language === 'ar') ? 'بانتظار ردّك' : 'Awaiting Your Response'}
                </span>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {stats ? stats.pendingActionCount.toLocaleString() : '—'}
                </div>
                <span className="text-[11px] text-[var(--text-primary)]/60">
                  {stats ? `${stats.confirmedCount} ${(language === 'ar') ? 'مؤكدة' : 'confirmed'}` : ''}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-primary)]/50">
                  {(language === 'ar') ? 'أرباح محصّلة' : 'Earnings To Date'}
                </span>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {stats ? `${stats.totalEarningsEGP.toLocaleString()} EGP` : '—'}
                </div>
                <span className="text-[11px] text-[var(--text-primary)]/60">
                  {stats
                    ? `${stats.escrowPendingEGP.toLocaleString()} EGP ${(language === 'ar') ? 'في الضمان' : 'in escrow'}`
                    : ''}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-primary)]/50">{t('supplier.trust.travelerRating')}</span>
                {/* The fallbacks were the problem: a supplier with no rating was
                    shown "4.9 ★" and "100+ Verified Reviews" — a specific,
                    flattering claim about a real business, invented by an `||`.
                    A supplier reading their own portal would take it as real. */}
                {typeof selectedSupplier?.rating === 'number' ? (
                  <>
                    <div className="text-2xl font-bold text-[var(--accent-secondary)]">{selectedSupplier.rating} ★</div>
                    {typeof selectedSupplier.reviewCount === 'number' && (
                      <span className="text-[11px] text-[var(--text-primary)]/60">
                        {t('supplier.trust.verifiedReviews', { count: String(selectedSupplier.reviewCount) })}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-[var(--text-primary)]/30">—</div>
                    <span className="text-[11px] text-[var(--text-primary)]/60">{t('supplier.trust.noRatingsYet')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* TAB 5: Provenance & Audit Trail (Proof of Strict Governance) */}
        {activeTab === 'audit' && (
          <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-[var(--accent-primary)]/80" />
                  <span>{t('supplier.provenanceOperationalAuditTrail')}</span>
                </h2>
                <p className="text-xs text-[var(--text-primary)]/60">
                  Proof that supplier was vetted through the 5-stage human approval state machine before authoritative promotion.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/25">
                AUTHORITATIVE RECORD ✓
              </span>
            </div>

            {/* Provenance Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-primary)]/50 font-bold uppercase">Authorized Approver</span>
                <div className="font-semibold text-[var(--accent-primary)]">{selectedSupplier?.approvedBy}</div>
                <span className="text-[11px] text-[var(--text-primary)]/60">Onboarded: {selectedSupplier?.onboardedAt}</span>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-primary)]/50 font-bold uppercase">License Credential</span>
                <div className="font-mono font-semibold text-[var(--text-primary)]">{selectedSupplier?.licenseNumber}</div>
                <span className="text-[11px] text-[var(--accent-primary)]/80">Official Regulatory Check Passed ✓</span>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] text-[var(--text-primary)]/50 font-bold uppercase">Discovery Candidate Link</span>
                <div className="font-mono font-semibold text-[var(--surface-container)]">{selectedSupplier?.linkedCandidateId}</div>
                <span className="text-[11px] text-[var(--text-primary)]/60 truncate block font-mono" title={selectedSupplier?.provenanceSignature}>
                  SHA-256: {selectedSupplier?.provenanceSignature?.substring(0, 16)}...
                </span>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-[var(--text-primary)]/50">
                Immutable Lifecycle Log ({selectedSupplier?.auditLog?.length || 0} Events)
              </h3>
              <div className="space-y-2">
                {(selectedSupplier?.auditLog || []).map((entry, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)]/80 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-mono font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/15 px-2 py-0.5 rounded">
                        {entry.action}
                      </span>
                      <span className="text-[var(--text-primary)]/50 font-mono">{entry.timestamp}</span>
                    </div>
                    <div className="text-[var(--text-primary)]/80 font-medium">Actor: {entry.actor}</div>
                    <p className="text-[var(--text-primary)]/70 text-[12px] italic">"{entry.notes}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

