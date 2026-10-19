/**
 * DAHAB INTELLIGENCE CORE — deterministic Tool Registry.
 *
 * The model proposes; this registry disposes. Every tool wraps an EXISTING
 * Dahab service or a direct read of `db` state — no parallel business logic.
 * Mutations reuse bookingService / supplierService / notificationService so
 * ownership checks, lifecycle guards and audit trails stay in one place.
 *
 * Risk policy: LOW executes, MEDIUM/HIGH require confirmation, FORBIDDEN
 * always rejects (enforced in intelligenceCoreService, classified here).
 */
import crypto from 'crypto';
import { db } from '../db/database';
import * as bookingService from './bookingService';
import { supplierService } from './supplierService';
import { notificationService } from './notificationService';
import { ledgerService } from './ledgerService';
import { quotaStatus } from './llm/quota';
import { backgroundEventBus } from './backgroundEventBus';

export type IntelRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'FORBIDDEN';
export type IntelRole = 'Operations' | 'Admin';

export interface IntelToolContext {
  userId: string;
  userRole: string;
}

export interface IntelToolResult {
  tool: string;
  risk: IntelRisk;
  summary: string;
  data: unknown;
  rowCount?: number;
}

export interface IntelToolDef {
  name: string;
  description: string;
  risk: IntelRisk;
  /** Roles allowed to invoke. Mutations additionally re-check ownership. */
  roles: IntelRole[];
  /** Max wall-clock ms the tool may run (router enforces via timeout race). */
  timeoutMs: number;
  run: (params: Record<string, unknown>, ctx: IntelToolContext) => Promise<IntelToolResult> | IntelToolResult;
}

const ALLOWED_ROLES: IntelRole[] = ['Operations', 'Admin'];

function assertRole(ctx: IntelToolContext, def: IntelToolDef): void {
  if (!def.roles.includes(ctx.userRole as IntelRole)) {
    const err = new Error(`Tool "${def.name}" is not available to role "${ctx.userRole}".`) as Error & { status: number };
    err.status = 403;
    throw err;
  }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampLimit(v: unknown, def = 25, max = 100): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(1, Math.floor(n)), max);
}

/** Any collection access goes through here so missing/seeded stores degrade. */
function col<T = Record<string, any>>(name: string): T[] {
  const state = db as unknown as Record<string, unknown>;
  const v = state[name];
  // Some adapters expose collections via getters on `db` itself.
  const direct = (db as unknown as Record<string, unknown>)[name];
  const arr = (Array.isArray(v) ? v : Array.isArray(direct) ? direct : []) as T[];
  return arr;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function maskPhone(p: unknown): string {
  const s = str(p);
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

function maskEmail(e: unknown): string {
  const s = str(e);
  const at = s.indexOf('@');
  if (at <= 0) return s ? '••••' : '';
  return `${s[0]}••••@${s.slice(at + 1)}`;
}

/**
 * PII boundary for booking detail leaving the Core: traveler phone/email are
 * minimized (masked) in every tool result. bookingRow() list projections
 * never carry them in the first place; this covers the single-booking
 * summaries returned by bookingService (get/cancel/reschedule), whose
 * BookingSummary shape includes raw contact fields.
 */
function maskBookingSummary<T>(s: T): T {
  if (!s || typeof s !== 'object') return s;
  const r = s as Record<string, unknown>;
  return {
    ...r,
    ...(r.travelerPhone !== undefined ? { travelerPhone: maskPhone(r.travelerPhone) } : {}),
    ...(r.travelerEmail !== undefined ? { travelerEmail: maskEmail(r.travelerEmail) } : {}),
  } as T;
}

// ---------------------------------------------------------------------------
// READ TOOLS
// ---------------------------------------------------------------------------

function bookingRow(b: Record<string, any>) {
  return {
    id: b.id,
    bookingRef: b.bookingRef,
    tripId: b.tripId,
    serviceType: b.serviceType,
    skuId: b.skuId,
    supplierId: b.supplierId,
    amountEGP: b.amountEGP,
    paymentState: b.paymentState,
    supplierState: b.supplierState,
    travelerName: b.travelerName,
    passengersCount: b.passengersCount,
    scheduledDate: b.scheduledDate,
    scheduledTime: b.scheduledTime,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

const getDashboardSummary: IntelToolDef = {
  name: 'getDashboardSummary',
  description: 'High-level operational counts: bookings by state, revenue, trips, suppliers, alerts.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(_params, _ctx) {
    const bookings = col<Record<string, any>>('bookings');
    const trips = col<Record<string, any>>('trips');
    const suppliers = col<Record<string, any>>('suppliers');
    const ledger = col<Record<string, any>>('ledgerEntries');
    const byState: Record<string, number> = {};
    for (const b of bookings) byState[str(b.supplierState, 'UNKNOWN')] = (byState[str(b.supplierState, 'UNKNOWN')] || 0) + 1;
    const captured = ledger.filter(e => e.type === 'PAYMENT_CAPTURED').reduce((s, e) => s + num(e.amountEGP), 0);
    const refunded = ledger.filter(e => e.type === 'REFUND_ISSUED').reduce((s, e) => s + num(e.amountEGP), 0);
    const pending = bookings.filter(b => b.supplierState === 'PENDING' || b.supplierState === 'PENDING_SUPPLIER').length;
    const failed = bookings.filter(b => b.paymentState === 'FAILED').length;
    const activeTrips = trips.filter(t => t.status === 'ACTIVE' || t.status === 'IN_PROGRESS' || !t.status).length;
    const data = {
      date: todayISO(),
      bookingsTotal: bookings.length,
      bookingsByState: byState,
      pendingSupplierAcceptance: pending,
      failedPayments: failed,
      revenueCapturedEGP: captured,
      refundedEGP: refunded,
      tripsTotal: trips.length,
      activeTrips,
      suppliersTotal: suppliers.length,
    };
    return {
      tool: 'getDashboardSummary',
      risk: 'LOW',
      summary: `${bookings.length} bookings (${pending} pending supplier acceptance, ${failed} failed payments). Revenue captured ${captured} EGP across ${trips.length} trips.`,
      data,
    };
  },
};

const getBookings: IntelToolDef = {
  name: 'getBookings',
  description: 'List bookings with optional status/supplier/payment filters.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const status = str(params.status);
    const supplierId = str(params.supplierId);
    const paymentState = str(params.paymentState);
    const limit = clampLimit(params.limit);
    let bookings = col<Record<string, any>>('bookings');
    if (status) bookings = bookings.filter(b => b.supplierState === status);
    if (supplierId) bookings = bookings.filter(b => b.supplierId === supplierId);
    if (paymentState) bookings = bookings.filter(b => b.paymentState === paymentState);
    const rows = bookings.slice(0, limit).map(bookingRow);
    return {
      tool: 'getBookings',
      risk: 'LOW',
      summary: `${rows.length} of ${bookings.length} bookings shown.`,
      data: { rows, total: bookings.length },
      rowCount: rows.length,
    };
  },
};

const getBooking: IntelToolDef = {
  name: 'getBooking',
  description: 'Single booking detail by id or bookingRef (ownership bypass allowed for Ops/Admin via service).',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params, ctx) {
    const bookingId = str(params.bookingId || params.bookingRef).slice(0, 128);
    if (!bookingId) throw Object.assign(new Error('bookingId is required.'), { status: 400 });
    const summary = bookingService.getBooking({ bookingId, userId: ctx.userId, userRole: ctx.userRole });
    return {
      tool: 'getBooking',
      risk: 'LOW',
      summary: `Booking ${summary.bookingRef}: ${summary.supplierState} / ${summary.paymentState}, ${summary.amountEGP} EGP on ${summary.scheduledDate}.`,
      data: maskBookingSummary(summary),
    };
  },
};

const searchBookings: IntelToolDef = {
  name: 'searchBookings',
  description: 'Substring search over bookingRef, id, traveler name, supplier id.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const q = str(params.q || params.query).trim().toLowerCase().slice(0, 128);
    if (!q) throw Object.assign(new Error('q is required.'), { status: 400 });
    const limit = clampLimit(params.limit);
    const rows = col<Record<string, any>>('bookings')
      .filter(b =>
        str(b.bookingRef).toLowerCase().includes(q) ||
        str(b.id).toLowerCase().includes(q) ||
        str(b.travelerName).toLowerCase().includes(q) ||
        str(b.supplierId).toLowerCase().includes(q) ||
        str(b.tripId).toLowerCase().includes(q),
      )
      .slice(0, limit)
      .map(bookingRow);
    return {
      tool: 'searchBookings',
      risk: 'LOW',
      summary: rows.length ? `${rows.length} booking(s) match "${q}".` : `No bookings match "${q}".`,
      data: { rows, query: q },
      rowCount: rows.length,
    };
  },
};

const getPendingSupplierBookings: IntelToolDef = {
  name: 'getPendingSupplierBookings',
  description: 'Bookings still waiting for supplier acceptance, oldest first.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const limit = clampLimit(params.limit);
    const rows = col<Record<string, any>>('bookings')
      .filter(b => b.supplierState === 'PENDING' || b.supplierState === 'PENDING_SUPPLIER' || b.supplierState === 'AWAITING_SUPPLIER')
      .sort((a, b) => str(a.createdAt).localeCompare(str(b.createdAt)))
      .slice(0, limit)
      .map(bookingRow);
    return {
      tool: 'getPendingSupplierBookings',
      risk: 'LOW',
      summary: rows.length ? `${rows.length} booking(s) waiting for supplier acceptance.` : 'No bookings waiting for supplier acceptance.',
      data: { rows, total: rows.length },
      rowCount: rows.length,
    };
  },
};

const getSupplierPerformance: IntelToolDef = {
  name: 'getSupplierPerformance',
  description: 'Per-supplier booking totals, cancellation/rejection rates, earnings.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 8000,
  run(params) {
    const only = str(params.supplierId);
    const limit = clampLimit(params.limit, 25);
    const bookings = col<Record<string, any>>('bookings');
    const suppliers = col<Record<string, any>>('suppliers');
    const byId = new Map<string, { total: number; cancelled: number; rejected: number; completed: number; pending: number; revenueEGP: number }>();
    for (const b of bookings) {
      const id = str(b.supplierId, 'UNKNOWN');
      if (only && id !== only) continue;
      const agg = byId.get(id) ?? { total: 0, cancelled: 0, rejected: 0, completed: 0, pending: 0, revenueEGP: 0 };
      agg.total += 1;
      if (b.supplierState === 'CANCELLED') agg.cancelled += 1;
      if (b.supplierState === 'REJECTED') agg.rejected += 1;
      if (b.supplierState === 'COMPLETED') { agg.completed += 1; agg.revenueEGP += num(b.amountEGP); }
      if (str(b.supplierState).startsWith('PENDING')) agg.pending += 1;
      byId.set(id, agg);
    }
    const rows = [...byId.entries()].map(([supplierId, agg]) => {
      const sup = suppliers.find(s => s.id === supplierId);
      const denom = Math.max(1, agg.total);
      return {
        supplierId,
        supplierName: sup ? (sup.businessName || sup.name || supplierId) : supplierId,
        ...agg,
        cancellationRate: Number(((agg.cancelled + agg.rejected) / denom).toFixed(3)),
      };
    })
      .sort((a, b) => b.cancellationRate - a.cancellationRate || b.total - a.total)
      .slice(0, limit);
    const worst = rows[0];
    return {
      tool: 'getSupplierPerformance',
      risk: 'LOW',
      summary: rows.length
        ? `Highest cancellation rate: ${worst.supplierName} (${(worst.cancellationRate * 100).toFixed(1)}%, ${worst.total} bookings).`
        : 'No supplier booking data available.',
      data: { rows },
      rowCount: rows.length,
    };
  },
};

const getOrders: IntelToolDef = {
  name: 'getOrders',
  description: 'Commerce orders: rental bookings plus paid service bookings.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const limit = clampLimit(params.limit);
    const rentals = col<Record<string, any>>('rentalBookings').slice(0, limit).map(r => ({
      kind: 'rental', id: r.id, status: r.status || r.supplierState, amountEGP: r.amountEGP ?? r.totalEGP, createdAt: r.createdAt,
    }));
    const paid = col<Record<string, any>>('bookings')
      .filter(b => b.paymentState === 'CAPTURED' || b.paymentState === 'PAID')
      .slice(0, limit)
      .map(b => ({ kind: 'booking', ...bookingRow(b) }));
    return {
      tool: 'getOrders',
      risk: 'LOW',
      summary: `${paid.length} paid bookings, ${rentals.length} rental orders (capped at ${limit} each).`,
      data: { bookings: paid, rentals },
      rowCount: paid.length + rentals.length,
    };
  },
};

const getInventoryAlerts: IntelToolDef = {
  name: 'getInventoryAlerts',
  description: 'Inventory slots with critically low remaining capacity.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const threshold = clampLimit(params.threshold, 3, 50);
    const skuId = str(params.skuId).slice(0, 128).toLowerCase();
    const rows = col<Record<string, any>>('inventorySlots')
      .filter(s => !skuId || str(s.skuId).toLowerCase().includes(skuId))
      .map(s => {
        const total = num(s.totalCapacity);
        const reserved = num(s.reservedCapacity);
        const held = num(s.heldCapacity);
        return { ...s, remaining: total - reserved - held };
      })
      .filter(s => s.remaining <= threshold)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 50);
    return {
      tool: 'getInventoryAlerts',
      risk: 'LOW',
      summary: rows.length ? `${rows.length} slot(s) at or below ${threshold} remaining places.` : `No slots at or below ${threshold} remaining places.`,
      data: { rows, threshold },
      rowCount: rows.length,
    };
  },
};

const getRevenueSummary: IntelToolDef = {
  name: 'getRevenueSummary',
  description: 'Revenue from the double-entry ledger (captured, refunded, commission).',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run() {
    const ledger = col<Record<string, any>>('ledgerEntries');
    const captured = ledger.filter(e => e.type === 'PAYMENT_CAPTURED').reduce((s, e) => s + num(e.amountEGP), 0);
    const refunded = ledger.filter(e => e.type === 'REFUND_ISSUED').reduce((s, e) => s + num(e.amountEGP), 0);
    const commission = ledger.filter(e => e.type === 'PLATFORM_COMMISSION').reduce((s, e) => s + num(e.amountEGP), 0);
    const integrity = ledgerService.verifyLedgerIntegrity();
    const data = {
      date: todayISO(),
      capturedEGP: captured,
      refundedEGP: refunded,
      netEGP: captured - refunded,
      commissionEGP: commission,
      entryCount: ledger.length,
      ledgerBalanced: (integrity as Record<string, unknown>).balanced ?? null,
    };
    return {
      tool: 'getRevenueSummary',
      risk: 'LOW',
      summary: `Captured ${captured} EGP, refunded ${refunded} EGP, net ${captured - refunded} EGP across ${ledger.length} ledger entries.`,
      data,
    };
  },
};

const getTripSummary: IntelToolDef = {
  name: 'getTripSummary',
  description: 'Trip counts and optional single-trip detail with its bookings.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const tripId = str(params.tripId);
    const trips = col<Record<string, any>>('trips');
    if (tripId) {
      const trip = trips.find(t => t.id === tripId);
      if (!trip) throw Object.assign(new Error(`Trip "${tripId}" not found.`), { status: 404 });
      const bookings = col<Record<string, any>>('bookings').filter(b => b.tripId === tripId).map(bookingRow);
      return {
        tool: 'getTripSummary', risk: 'LOW',
        summary: `Trip ${tripId}: ${bookings.length} booking(s).`,
        data: { trip, bookings },
        rowCount: bookings.length,
      };
    }
    const limit = clampLimit(params.limit);
    const today = todayISO();
    const activeToday = col<Record<string, any>>('bookings').filter(b => str(b.scheduledDate) === today).length;
    return {
      tool: 'getTripSummary', risk: 'LOW',
      summary: `${trips.length} trips total, ${activeToday} booking(s) scheduled today.`,
      data: { total: trips.length, activeToday, rows: trips.slice(0, limit) },
      rowCount: Math.min(limit, trips.length),
    };
  },
};

const getSystemHealth: IntelToolDef = {
  name: 'getSystemHealth',
  description: 'Ledger integrity, AI provider quota, collection counts, recent event volume.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 8000,
  run() {
    const integrity = ledgerService.verifyLedgerIntegrity() as Record<string, unknown>;
    const quota = quotaStatus();
    const data = {
      ledger: integrity,
      aiQuota: quota,
      counts: {
        bookings: col('bookings').length,
        trips: col('trips').length,
        suppliers: col('suppliers').length,
        ledgerEntries: col('ledgerEntries').length,
        supportOpen: col<Record<string, any>>('supportMessages').filter(m => m.status === 'OPEN').length,
        marketAlerts: col('marketAlerts').length,
      },
      recentEvents: backgroundEventBus.getRecentEvents(10),
    };
    return { tool: 'getSystemHealth', risk: 'LOW', summary: 'System health snapshot assembled.', data };
  },
};

const getRecentErrors: IntelToolDef = {
  name: 'getRecentErrors',
  description: 'Recent audit-denied/failed events and background errors.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const limit = clampLimit(params.limit);
    const audits = col<Record<string, any>>('auditEvents');
    const rows = audits
      .filter(a => /FAIL|ERROR|DENIED|REJECT|BREACH/i.test(str(a.action) + str(a.entityType)))
      .slice(0, limit);
    return {
      tool: 'getRecentErrors', risk: 'LOW',
      summary: rows.length ? `${rows.length} recent error/denial audit event(s).` : 'No recent error audit events.',
      data: { rows },
      rowCount: rows.length,
    };
  },
};

const getAnalytics: IntelToolDef = {
  name: 'getAnalytics',
  description: 'Recent product analytics events (allowlisted ingestion surface).',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const limit = clampLimit(params.limit);
    const events = col<Record<string, any>>('analyticsEvents').slice(0, limit);
    const byName: Record<string, number> = {};
    for (const e of col<Record<string, any>>('analyticsEvents')) byName[str(e.eventName || e.name, 'unknown')] = (byName[str(e.eventName || e.name, 'unknown')] || 0) + 1;
    return {
      tool: 'getAnalytics', risk: 'LOW',
      summary: `${col('analyticsEvents').length} analytics events stored; showing ${events.length}.`,
      data: { rows: events, byName },
      rowCount: events.length,
    };
  },
};

const getReviews: IntelToolDef = {
  name: 'getReviews',
  description: 'Verified-stay reviews with optional status filter.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const status = str(params.status);
    const limit = clampLimit(params.limit);
    let rows = col<Record<string, any>>('reviews');
    if (status) rows = rows.filter(r => r.status === status);
    return {
      tool: 'getReviews', risk: 'LOW',
      summary: `${rows.length} review(s)${status ? ` with status ${status}` : ''}.`,
      data: { rows: rows.slice(0, limit), total: rows.length },
      rowCount: Math.min(limit, rows.length),
    };
  },
};

const getMarketIntelligence: IntelToolDef = {
  name: 'getMarketIntelligence',
  description: 'Market alerts, source health and price stats snapshot.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const limit = clampLimit(params.limit);
    const alerts = col<Record<string, any>>('marketAlerts');
    const unacked = alerts.filter(a => !a.acknowledged);
    return {
      tool: 'getMarketIntelligence', risk: 'LOW',
      summary: `${unacked.length} unacknowledged of ${alerts.length} market alerts.`,
      data: {
        alerts: alerts.slice(0, limit),
        unacknowledged: unacked.length,
        total: alerts.length,
        priceStats: col('marketPriceStats').slice(0, limit),
        sourceHealth: col('sourceHealthRecords').slice(0, limit),
      },
      rowCount: Math.min(limit, alerts.length),
    };
  },
};

const getKnowledgeStatus: IntelToolDef = {
  name: 'getKnowledgeStatus',
  description: 'DKOS corpus health: conflicts, snapshots, review queue depth.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run() {
    const data = {
      conflicts: col('conflictSets').length,
      snapshots: col('knowledgeSnapshots').length,
      reviewQueue: col('marketReviewQueue').length,
      stagedObservations: col('placeDiscoveries').length,
    };
    return { tool: 'getKnowledgeStatus', risk: 'LOW', summary: `${data.conflicts} conflict set(s), ${data.reviewQueue} review item(s) pending.`, data };
  },
};

const getReliabilityStatus: IntelToolDef = {
  name: 'getReliabilityStatus',
  description: 'Supplier reliability metrics volume and recent metric events.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const limit = clampLimit(params.limit, 10);
    const metrics = col<Record<string, any>>('supplierMetrics');
    return {
      tool: 'getReliabilityStatus', risk: 'LOW',
      summary: `${metrics.length} supplier metric event(s) recorded.`,
      data: { total: metrics.length, recent: metrics.slice(0, limit) },
      rowCount: Math.min(limit, metrics.length),
    };
  },
};

const getCoreAudit: IntelToolDef = {
  name: 'getCoreAudit',
  description: 'Recent Intelligence Core audit entries (queries, tools, denials, confirmations, mutations).',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 5000,
  run(params) {
    const limit = clampLimit(params.limit, 20);
    const rows = col<Record<string, any>>('auditEvents')
      .filter(a => str(a.action).startsWith('INTELLIGENCE_CORE_'))
      .slice(0, limit)
      .map(a => ({
        at: str(a.timestamp || a.createdAt),
        action: str(a.action),
        actor: str(a.actor),
        entity: str(a.entityId),
        detail: a.payload && typeof a.payload === 'object'
          ? JSON.stringify(a.payload).slice(0, 300)
          : str(a.payload),
      }));
    return {
      tool: 'getCoreAudit', risk: 'LOW',
      summary: rows.length ? `${rows.length} recent Intelligence Core audit entr${rows.length === 1 ? 'y' : 'ies'}.` : 'No Intelligence Core audit entries yet.',
      data: { rows, total: rows.length },
      rowCount: rows.length,
    };
  },
};

export interface AttentionItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  reason: string;
  entityType: string;
  entityId: string;
  recommendedAction: string;
  safeTool?: string;
}

const getAttentionQueue: IntelToolDef = {
  name: 'getAttentionQueue',
  description: 'Prioritized operational exceptions requiring admin attention.',
  risk: 'LOW',
  roles: ALLOWED_ROLES,
  timeoutMs: 8000,
  run() {
    const items: AttentionItem[] = [];
    const bookings = col<Record<string, any>>('bookings');
    const now = Date.now();

    // 1. Supplier has not accepted (older than 2h).
    for (const b of bookings) {
      if (!str(b.supplierState).startsWith('PENDING')) continue;
      const ageH = (now - new Date(str(b.createdAt) || Date.now()).getTime()) / 3_600_000;
      if (ageH >= 2) {
        items.push({
          id: `att-pending-${b.id}`,
          severity: ageH >= 24 ? 'CRITICAL' : 'HIGH',
          category: 'supplier_acceptance',
          title: `Booking ${b.bookingRef || b.id} awaiting supplier acceptance (${Math.round(ageH)}h)`,
          reason: `Supplier ${b.supplierId || 'unknown'} has not accepted.`,
          entityType: 'Booking',
          entityId: str(b.id),
          recommendedAction: 'Review booking and nudge or reassign supplier.',
          safeTool: 'getBooking',
        });
      }
    }

    // 2. Failed payments.
    for (const b of bookings.filter(b => b.paymentState === 'FAILED')) {
      items.push({
        id: `att-pay-${b.id}`, severity: 'HIGH', category: 'payment',
        title: `Failed payment on booking ${b.bookingRef || b.id}`,
        reason: `${num(b.amountEGP)} EGP payment failed.`,
        entityType: 'Booking', entityId: str(b.id),
        recommendedAction: 'Contact traveler and retry or release the hold.',
        safeTool: 'getBooking',
      });
    }

    // 3. Critically low inventory (<=2 remaining).
    for (const s of col<Record<string, any>>('inventorySlots')) {
      const remaining = num(s.totalCapacity) - num(s.reservedCapacity) - num(s.heldCapacity);
      if (remaining <= 2 && remaining >= 0 && (s.status === 'AVAILABLE' || !s.status)) {
        items.push({
          id: `att-inv-${s.id}`, severity: remaining === 0 ? 'HIGH' : 'MEDIUM', category: 'inventory',
          title: `Low inventory: ${s.skuId} on ${s.date} (${remaining} left)`,
          reason: 'Slot is near or at capacity.',
          entityType: 'InventorySlot', entityId: str(s.id),
          recommendedAction: 'Raise capacity or price, or close the slot.',
          safeTool: 'getInventoryAlerts',
        });
        if (items.length > 200) break;
      }
    }

    // 4. Imminent unconfirmed starts (<24h, not CONFIRMED/COMPLETED).
    for (const b of bookings) {
      if (['CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(str(b.supplierState))) continue;
      const when = new Date(`${str(b.scheduledDate)}T${str(b.scheduledTime, '00:00')}:00`).getTime();
      if (!Number.isFinite(when)) continue;
      const hours = (when - now) / 3_600_000;
      if (hours >= 0 && hours <= 24) {
        items.push({
          id: `att-imminent-${b.id}`, severity: 'HIGH', category: 'imminent_start',
          title: `Booking ${b.bookingRef || b.id} starts in ${Math.max(1, Math.round(hours))}h and is ${b.supplierState}`,
          reason: 'Start time approaching without confirmation.',
          entityType: 'Booking', entityId: str(b.id),
          recommendedAction: 'Confirm with supplier now or reschedule.',
          safeTool: 'getBooking',
        });
      }
    }

    // 5. Cancellation spike (today vs trailing volume).
    const dayAgo = now - 86_400_000;
    const recentCancelled = bookings.filter(b =>
      (b.supplierState === 'CANCELLED' || b.supplierState === 'REJECTED') &&
      new Date(str(b.updatedAt) || 0).getTime() >= dayAgo,
    ).length;
    if (recentCancelled >= 5 && recentCancelled >= Math.max(5, bookings.length * 0.05)) {
      items.push({
        id: 'att-cancel-spike', severity: 'MEDIUM', category: 'cancellation_spike',
        title: `Cancellation spike: ${recentCancelled} in the last 24h`,
        reason: 'Unusual volume of cancelled/rejected bookings.',
        entityType: 'System', entityId: 'cancellations',
        recommendedAction: 'Compare supplier performance for the period.',
        safeTool: 'getSupplierPerformance',
      });
    }

    // 6. Error spike from audit trail. AuditEventEntity carries `timestamp`
    // (not `createdAt`) — match both so the detector actually fires.
    const errorCount = col<Record<string, any>>('auditEvents')
      .filter(a => new Date(str(a.timestamp || a.createdAt) || 0).getTime() >= dayAgo &&
        /FAIL|ERROR|DENIED|REJECT/i.test(str(a.action)))
      .length;
    if (errorCount >= 10) {
      items.push({
        id: 'att-error-spike', severity: 'MEDIUM', category: 'error_spike',
        title: `Error spike: ${errorCount} failure audit events in 24h`,
        reason: 'Elevated failure/denial volume.',
        entityType: 'System', entityId: 'errors',
        recommendedAction: 'Inspect recent errors and system health.',
        safeTool: 'getRecentErrors',
      });
    }

    // 7. Open market alerts / support.
    const openSupport = col<Record<string, any>>('supportMessages').filter(m => m.status === 'OPEN').length;
    const unackedMarket = col<Record<string, any>>('marketAlerts').filter(a => !a.acknowledged).length;
    if (openSupport > 0) {
      items.push({
        id: 'att-support', severity: openSupport >= 10 ? 'HIGH' : 'MEDIUM', category: 'support',
        title: `${openSupport} open support message(s)`, reason: 'Travelers awaiting answers.',
        entityType: 'Support', entityId: 'queue', recommendedAction: 'Triage the support queue.',
      });
    }
    if (unackedMarket > 0) {
      items.push({
        id: 'att-market', severity: 'LOW', category: 'market',
        title: `${unackedMarket} unacknowledged market alert(s)`, reason: 'Data-ops signals awaiting review.',
        entityType: 'Market', entityId: 'alerts', recommendedAction: 'Review market alerts.',
        safeTool: 'getMarketIntelligence',
      });
    }

    const order: Record<AttentionItem['severity'], number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    items.sort((a, b) => order[a.severity] - order[b.severity]);
    const capped = items.slice(0, 50);
    const critical = capped.filter(i => i.severity === 'CRITICAL').length;
    return {
      tool: 'getAttentionQueue', risk: 'LOW',
      summary: capped.length
        ? `${capped.length} item(s) require attention${critical ? `, including ${critical} critical` : ''}.`
        : 'Nothing requires attention right now.',
      data: { items: capped, total: capped.length },
      rowCount: capped.length,
    };
  },
};

// ---------------------------------------------------------------------------
// MUTATION TOOLS (all wrap existing services — never reimplement business rules)
// ---------------------------------------------------------------------------

const cancelBooking: IntelToolDef = {
  name: 'cancelBooking',
  description: 'Cancel a booking with inventory release and conditional refund (HIGH risk).',
  risk: 'HIGH',
  roles: ALLOWED_ROLES,
  timeoutMs: 10000,
  run(params, ctx) {
    const bookingId = str(params.bookingId || params.bookingRef).slice(0, 128);
    const tripId = str(params.tripId).slice(0, 128);
    const reason = str(params.reason, 'Cancelled by operations via Intelligence Core').slice(0, 500);
    const cancellationKey = str(params.cancellationKey).slice(0, 128);
    if (!bookingId) throw Object.assign(new Error('bookingId is required.'), { status: 400 });
    if (!tripId) throw Object.assign(new Error('tripId is required (booking must belong to the trip).'), { status: 400 });
    if (!cancellationKey) throw Object.assign(new Error('cancellationKey is required (see booking confirmation code).'), { status: 400 });
    const result = bookingService.cancelBooking({
      bookingId, tripId, userId: ctx.userId, userRole: ctx.userRole, reason, cancellationKey,
    });
    db.logAudit(ctx.userId, ctx.userRole, 'INTELLIGENCE_CORE_MUTATION', 'Booking', bookingId, {
      tool: 'cancelBooking', reason,
    });
    return {
      tool: 'cancelBooking', risk: 'HIGH',
      summary: `Booking ${result.booking.bookingRef} cancelled${result.refunded ? ` with ${result.refundAmountEGP} EGP refund` : ''}.`,
      data: { ...result, booking: maskBookingSummary(result.booking) },
    };
  },
};

const rescheduleBooking: IntelToolDef = {
  name: 'rescheduleBooking',
  description: 'Move a booking to a new date/time slot (HIGH risk).',
  risk: 'HIGH',
  roles: ALLOWED_ROLES,
  timeoutMs: 10000,
  run(params, ctx) {
    const bookingId = str(params.bookingId || params.bookingRef).slice(0, 128);
    const tripId = str(params.tripId).slice(0, 128);
    const newDate = str(params.newDate).slice(0, 32);
    const newTime = str(params.newTime).slice(0, 32);
    const idempotencyKey = str(params.idempotencyKey || `intel-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`).slice(0, 128);
    if (!bookingId || !tripId || !newDate || !newTime) {
      throw Object.assign(new Error('bookingId, tripId, newDate and newTime are required.'), { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) throw Object.assign(new Error('newDate must be YYYY-MM-DD.'), { status: 400 });
    const result = bookingService.rescheduleBooking({
      bookingId, tripId, userId: ctx.userId, userRole: ctx.userRole, newDate, newTime, idempotencyKey,
    });
    db.logAudit(ctx.userId, ctx.userRole, 'INTELLIGENCE_CORE_MUTATION', 'Booking', bookingId, {
      tool: 'rescheduleBooking', newDate, newTime,
    });
    return {
      tool: 'rescheduleBooking', risk: 'HIGH',
      summary: `Booking ${result.booking.bookingRef} moved to ${newDate} ${newTime}.`,
      data: { ...result, booking: maskBookingSummary(result.booking) },
    };
  },
};

function supplierRespond(tool: 'approveSupplierBooking' | 'rejectSupplierBooking'): IntelToolDef {
  return {
    name: tool,
    description: tool === 'approveSupplierBooking'
      ? 'Accept a pending booking on behalf of its supplier (HIGH risk).'
      : 'Reject a pending booking on behalf of its supplier (HIGH risk).',
    risk: 'HIGH',
    roles: ALLOWED_ROLES,
    timeoutMs: 10000,
    run(params, ctx) {
      const bookingId = str(params.bookingId || params.bookingRef).slice(0, 128);
      if (!bookingId) throw Object.assign(new Error('bookingId is required.'), { status: 400 });
      const all = col<Record<string, any>>('bookings');
      const booking = all.find(b => b.id === bookingId || b.bookingRef === bookingId);
      if (!booking) throw Object.assign(new Error(`Booking "${bookingId}" not found.`), { status: 404 });
      const action = tool === 'approveSupplierBooking' ? 'ACCEPT' : 'REJECT';
      const reason = str(params.reason, tool === 'approveSupplierBooking' ? 'Accepted by operations via Intelligence Core' : 'Rejected by operations via Intelligence Core').slice(0, 500);
      const updated = supplierService.updateBookingState({
        bookingId: str(booking.id),
        supplierId: str(booking.supplierId),
        action,
        reason,
      });
      db.logAudit(ctx.userId, ctx.userRole, 'INTELLIGENCE_CORE_MUTATION', 'Booking', str(booking.id), {
        tool, action, reason,
      });
      return {
        tool, risk: 'HIGH',
        summary: `Booking ${booking.bookingRef || booking.id} ${action === 'ACCEPT' ? 'accepted' : 'rejected'} (now ${updated.supplierState}).`,
        data: bookingRow(updated as unknown as Record<string, any>),
      };
    },
  };
}

const updateInventory: IntelToolDef = {
  name: 'updateInventory',
  description: 'Adjust an inventory slot price or capacity (MEDIUM risk).',
  risk: 'MEDIUM',
  roles: ALLOWED_ROLES,
  timeoutMs: 8000,
  run(params, ctx) {
    const slotId = str(params.slotId).slice(0, 128);
    if (!slotId) throw Object.assign(new Error('slotId is required.'), { status: 400 });
    const slots = col<Record<string, any>>('inventorySlots');
    const slot = slots.find(s => s.id === slotId);
    if (!slot) throw Object.assign(new Error(`Inventory slot "${slotId}" not found.`), { status: 404 });
    const before = { priceEGP: slot.priceEGP, totalCapacity: slot.totalCapacity };
    if (params.priceEGP !== undefined) {
      const p = num(params.priceEGP, NaN);
      if (!Number.isFinite(p) || p < 0 || p > 1_000_000) throw Object.assign(new Error('priceEGP must be 0–1,000,000.'), { status: 400 });
      slot.priceEGP = p;
    }
    if (params.totalCapacity !== undefined) {
      const c = num(params.totalCapacity, NaN);
      if (!Number.isInteger(c) || c < 0 || c > 10_000) throw Object.assign(new Error('totalCapacity must be an integer 0–10,000.'), { status: 400 });
      if (c < num(slot.reservedCapacity) + num(slot.heldCapacity)) {
        throw Object.assign(new Error('totalCapacity cannot go below reserved + held capacity.'), { status: 409 });
      }
      slot.totalCapacity = c;
      if (slot.reservedCapacity + slot.heldCapacity < slot.totalCapacity) slot.status = 'AVAILABLE';
    }
    slot.updatedAt = new Date().toISOString();
    db.logAudit(ctx.userId, ctx.userRole, 'INTELLIGENCE_CORE_MUTATION', 'InventorySlot', slotId, {
      tool: 'updateInventory', before, after: { priceEGP: slot.priceEGP, totalCapacity: slot.totalCapacity },
    });
    db.saveToDisk();
    return {
      tool: 'updateInventory', risk: 'MEDIUM',
      summary: `Slot ${slotId} updated (price ${slot.priceEGP} EGP, capacity ${slot.totalCapacity}).`,
      data: slot,
    };
  },
};

const sendNotification: IntelToolDef = {
  name: 'sendNotification',
  description: 'Send an operational notification to a user (MEDIUM risk). No broadcast.',
  risk: 'MEDIUM',
  roles: ALLOWED_ROLES,
  timeoutMs: 8000,
  run(params, ctx) {
    const userId = str(params.userId).slice(0, 128);
    const title = str(params.title).slice(0, 120);
    const message = str(params.message).slice(0, 1000);
    if (!userId) throw Object.assign(new Error('userId is required (single recipient only).'), { status: 400 });
    if (!title || !message) throw Object.assign(new Error('title and message are required.'), { status: 400 });
    const channel = (['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL'] as const).includes(params.channel as never)
      ? (params.channel as 'IN_APP' | 'WHATSAPP' | 'SMS' | 'EMAIL')
      : 'IN_APP';
    const n = notificationService.sendNotification({ userId, type: 'SYSTEM', title, message, channel });
    db.logAudit(ctx.userId, ctx.userRole, 'INTELLIGENCE_CORE_MUTATION', 'Notification', n.id, {
      tool: 'sendNotification', recipient: userId, channel,
    });
    return {
      tool: 'sendNotification', risk: 'MEDIUM',
      summary: `Notification sent to ${userId} via ${channel}.`,
      data: { id: n.id, channel },
    };
  },
};

// ---------------------------------------------------------------------------
// REGISTRY
// ---------------------------------------------------------------------------

const defs: IntelToolDef[] = [
  getDashboardSummary,
  getBookings,
  getBooking,
  searchBookings,
  getPendingSupplierBookings,
  getSupplierPerformance,
  getOrders,
  getInventoryAlerts,
  getRevenueSummary,
  getTripSummary,
  getSystemHealth,
  getRecentErrors,
  getAnalytics,
  getAttentionQueue,
  getReviews,
  getMarketIntelligence,
  getKnowledgeStatus,
  getReliabilityStatus,
  getCoreAudit,
  cancelBooking,
  rescheduleBooking,
  supplierRespond('approveSupplierBooking'),
  supplierRespond('rejectSupplierBooking'),
  updateInventory,
  sendNotification,
];

export const TOOL_REGISTRY: Record<string, IntelToolDef> = Object.fromEntries(defs.map(d => [d.name, d]));

/** Names the model is allowed to request. Anything else is rejected. */
export const TOOL_NAMES = Object.keys(TOOL_REGISTRY);

export function getTool(name: unknown): IntelToolDef {
  const key = str(name).slice(0, 64);
  // hasOwnProperty — a bare registry[key] would return Object.prototype for
  // "__proto__" and let a forged tool name past the allowlist check.
  const def = Object.prototype.hasOwnProperty.call(TOOL_REGISTRY, key)
    ? TOOL_REGISTRY[key]
    : undefined;
  if (!def) {
    throw Object.assign(new Error(`Unknown tool "${key}". Available: ${TOOL_NAMES.join(', ')}.`), { status: 400 });
  }
  return def;
}

export async function runTool(name: string, params: Record<string, unknown>, ctx: IntelToolContext): Promise<IntelToolResult> {
  const def = getTool(name);
  assertRole(ctx, def);
  const safeParams = sanitizeParams(params);
  const result = await withToolTimeout(def.name, def.timeoutMs, () => def.run(safeParams, ctx));
  return result;
}

/**
 * Enforces the per-tool `timeoutMs` budget the registry declares: a tool
 * that never settles rejects with 504 instead of hanging the request.
 * Exported for unit tests (synthetic slow functions).
 */
export function withToolTimeout<T>(tool: string, timeoutMs: number, fn: () => Promise<T> | T): Promise<T> {
  const budget = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Tool "${tool}" timed out after ${budget}ms.`), { status: 504 }));
    }, budget);
    if (typeof (timer as unknown as { unref?: unknown }).unref === 'function') {
      (timer as unknown as { unref: () => void }).unref();
    }
    Promise.resolve()
      .then(fn)
      .then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); },
      );
  });
}

/**
 * Parameter hygiene: drop prototype keys, cap string length, cap array size.
 * Rejects nested objects that could smuggle operators — tools take scalars.
 */
export function sanitizeParams(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (typeof v === 'string') out[k] = v.slice(0, 2000);
    else if (typeof v === 'number' || typeof v === 'boolean' || v == null) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter(x => typeof x === 'string').map(x => (x as string).slice(0, 256)).slice(0, 100);
    else out[k] = str((v as object)?.toString?.() ?? '').slice(0, 500);
  }
  return out;
}
