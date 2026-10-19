/**
 * DAHAB INTELLIGENCE CORE — deterministic orchestration service.
 *
 * Pipeline per request: authenticate (route) → role gate → deterministic
 * intent parse → DayGI-style summarization over REAL tool output →
 * risk gate → expiring confirmation → re-authorize → execute → audit.
 *
 * The model proposes tool calls; this service is the authority boundary.
 * DayGI remains the traveler reasoning layer; the Core reuses its patterns
 * (scoped confirmation TTL, grounded summarization) without letting any
 * model output touch state directly.
 */
import crypto from 'crypto';
import { db } from '../db/database';
import { recordAnalyticsEvent } from './analyticsService';
import { getBooking as serviceGetBooking } from './bookingService';
import {
  TOOL_REGISTRY,
  getTool,
  runTool,
  sanitizeParams,
  type IntelRisk,
  type IntelToolContext,
} from './intelligenceCoreTools';

const CONFIRM_TTL_MS = 10 * 60 * 1000;
const MAX_TOOLS_PER_QUERY = 6;
/** Bulk plans are capped; every id is validated before any token is issued. */
const MAX_BULK_IDS = 50;
/** Booking-targeted mutation tools whose bulk ids resolve to bookings. */
const BOOKING_MUTATION_TOOLS = new Set([
  'cancelBooking',
  'rescheduleBooking',
  'approveSupplierBooking',
  'rejectSupplierBooking',
]);

export interface IntelContextInput {
  route?: string;
  section?: string;
  filters?: Record<string, unknown>;
  selectedBookingId?: string;
  selectedSupplierId?: string;
  selectedProductId?: string;
  language?: string;
}

export interface IntelPlannedCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface IntelConfirmation {
  token: string;
  tool: string;
  params: Record<string, unknown>;
  risk: IntelRisk;
  impact: string;
  affectedCount: number;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  createdByRole: string;
  bulk?: { ids: string[]; total: number };
}

interface PendingConfirm extends IntelConfirmation {
  expiresMs: number;
}

/**
 * VOLATILITY NOTE: pendingConfirms is an in-memory Map, not persisted to db.
 * A server restart drops all pending confirmation tokens. Clients must re-request
 * the action to obtain a fresh token; expired tokens surface as 404/410, not
 * silent success. The TTL sweep (sweepConfirms) bounds memory to ~1000 entries
 * and evicts expired tokens within 2× CONFIRM_TTL_MS. For crash resilience a
 * persistent store (e.g. db.intelligenceConfirms) would be required, but the
 * current TTL + idempotent tool design makes loss observable and recoverable.
 * See also consumedConfirms tombstones below.
 */
const pendingConfirms = new Map<string, PendingConfirm>();
/**
 * Tombstones for consumed confirmations: a replayed (already-executed) token
 * is rejected AND audited as a replay attempt instead of vanishing silently.
 * Swept opportunistically (see sweepConfirms); entries live 2× TTL max.
 */
const consumedConfirms = new Map<string, { tool: string; atMs: number }>();

function sweepConfirms(): void {
  const now = Date.now();
  for (const [k, v] of pendingConfirms) {
    if (now > v.expiresMs) pendingConfirms.delete(k);
  }
  if (pendingConfirms.size > 1000) {
    // Backstop against unbounded growth if the sweeper is starved.
    const keys = [...pendingConfirms.keys()].slice(0, pendingConfirms.size - 1000);
    for (const k of keys) pendingConfirms.delete(k);
  }
  for (const [k, v] of consumedConfirms) {
    if (now - v.atMs > 2 * CONFIRM_TTL_MS) consumedConfirms.delete(k);
  }
}

// Periodic sweep every 5min so expired tokens don't linger even without traffic.
// Keeps volatile Map bounded; if db.intelligenceConfirms table existed we would persist here.
// TODO: move pendingConfirms to db.intelligenceConfirms for crash resilience when table is added.
const _intelSweepInterval = setInterval(sweepConfirms, 5 * 60 * 1000);
if (typeof (_intelSweepInterval as any).unref === 'function') (_intelSweepInterval as any).unref();

function nowISO(): string {
  return new Date().toISOString();
}

function strParam(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function isOpsAdmin(role: string): boolean {
  return role === 'Operations' || role === 'Admin';
}

function audit(actor: string, role: string, action: string, entityId: string, payload: Record<string, any>): void {
  try {
    db.logAudit(actor, role, action, 'IntelligenceCore', entityId, payload);
  } catch {
    // Audit must never break the response path.
  }
}

function track(eventName: string, userId: string, payload?: Record<string, unknown>): void {
  try {
    // Extras travel inside `payload` (RecordEventInput shape) — top-level
    // fields would be ignored, and intel.* names are server-only allowlisted.
    recordAnalyticsEvent({ eventName, userId, payload });
  } catch {
    /* telemetry is best-effort */
  }
}

function deny(input: { userId: string; userRole: string; tool: string; reason: string; status: number }): never {
  audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_DENIED', input.tool, { reason: input.reason });
  track('intel.deny', input.userId, { tool: input.tool, reason: input.reason });
  throw Object.assign(new Error(denyMessage(input.reason, input.tool)), { status: input.status });
}

function denyMessage(reason: string, tool: string): string {
  switch (reason) {
    case 'role': return 'Intelligence Core is available to Operations and Admin roles.';
    case 'forbidden': return `Tool "${tool}" is forbidden.`;
    case 'replay': return 'Confirmation token was already used (replay rejected).';
    case 'expired': return 'Confirmation token has expired. Request the action again.';
    case 'token_mismatch': return 'Confirmation token does not belong to this session.';
    case 'unknown_token': return 'Confirmation token is unknown or already consumed.';
    default: return 'Not authorized for this Intelligence Core action.';
  }
}

// ---------------------------------------------------------------------------
// Deterministic intent parser (DayGI handles traveler nuance elsewhere; the
// Core needs predictable admin command routing with Gemini as polish only).
// ---------------------------------------------------------------------------

const BOOKING_REF_RE = /\b([A-Z]{2,}(?:[-_][A-Z0-9]+)+)\b/;
const DATE_RE = /\b(20\d{2}-\d{2}-\d{2})\b/;

export function parseIntelIntent(text: string, ctx: IntelContextInput = {}): IntelPlannedCall[] {
  const raw = text || '';
  const t = raw.toLowerCase();
  const plans: IntelPlannedCall[] = [];
  const refMatch = raw.match(BOOKING_REF_RE);
  const ref = refMatch ? refMatch[1].replace(/_/g, '-').toUpperCase() : undefined;
  const dateMatch = raw.match(DATE_RE);
  const has = (...words: string[]) => words.some(w => t.includes(w));
  // Short English pronouns match inside other words ("it" in "with"), so
  // they are boundary-checked; Arabic pronouns attach prefixes instead.
  const hasWord = (...words: string[]) => words.some(w => new RegExp(`\\b${w}\\b`).test(t));

  // Contextual "this / it" resolution from the admin's current selection.
  const contextualRef = ref || ctx.selectedBookingId;

  if (has('attention', 'briefing', 'operational problems', 'require attention', 'things need', 'what needs', "today's operational",
    'انتباه', 'يتطلب', 'مشاكل تشغيلية', 'موجز', 'عاجل')) {
    plans.push({ tool: 'getAttentionQueue', params: {} });
    plans.push({ tool: 'getDashboardSummary', params: {} });
    return plans;
  }
  if (has('pending supplier', 'waiting for supplier', 'supplier acceptance', 'not accepted', 'unaccepted',
    'بانتظار المورد', 'موافقة المورد', 'لم يقبل', 'غير مقبول')) {
    plans.push({ tool: 'getPendingSupplierBookings', params: { limit: 25 } });
    return plans;
  }
  if (has('failed payment', 'failed payment', 'payment failed', 'failed payments',
    'مدفوعات فاشلة', 'فشل الدفع', 'دفع فاشل', 'مدفوعة فاشلة')) {
    plans.push({ tool: 'getBookings', params: { paymentState: 'FAILED', limit: 25 } });
    return plans;
  }
  if (has('low inventory', 'low stock', 'low-stock', 'inventory',
    'مخزون منخفض', 'مخزون', 'نفاد')) {
    plans.push({
      tool: 'getInventoryAlerts',
      params: { threshold: 3, ...(ctx.selectedProductId ? { skuId: ctx.selectedProductId } : {}) },
    });
    return plans;
  }
  if (has('revenue', "today's revenue", 'earnings', 'إيراد', 'إيرادات', 'أرباح', 'المداخيل')) {
    plans.push({ tool: 'getRevenueSummary', params: {} });
    return plans;
  }
  if (has('cancellation', 'cancel rate', 'underperform', 'supplier performance', 'highest cancellation',
    'إلغاء', 'معدل الإلغاء', 'أداء الموردين', 'أعلى إلغاء')) {
    plans.push({
      tool: 'getSupplierPerformance',
      params: { limit: 10, ...(ctx.selectedSupplierId ? { supplierId: ctx.selectedSupplierId } : {}) },
    });
    return plans;
  }
  if ((has('supplier', 'مورد') && has('performance', 'compare', 'rate', 'best', 'worst', 'أداء', 'مقارنة', 'معدل', 'أفضل', 'أسوأ'))) {
    plans.push({
      tool: 'getSupplierPerformance',
      params: { limit: 10, ...(ctx.selectedSupplierId ? { supplierId: ctx.selectedSupplierId } : {}) },
    });
    return plans;
  }
  if (has('system health', 'health', 'errors', 'error spike', 'recent errors',
    'صحة النظام', 'أخطاء', 'خطأ', 'الأخطاء الأخيرة')) {
    plans.push({ tool: 'getSystemHealth', params: {} });
    plans.push({ tool: 'getRecentErrors', params: { limit: 15 } });
    return plans;
  }
  if (has('active trip', 'trips active', 'trips today', 'how many trips', 'رحلات', 'رحلة', 'رحلات نشطة', 'كم رحلة')) {
    plans.push({ tool: 'getTripSummary', params: {} });
    return plans;
  }
  if (has('review', 'تقييم', 'تقييمات', 'مراجعات')) {
    plans.push({ tool: 'getReviews', params: { limit: 20 } });
    return plans;
  }
  if (has('market', 'سوق', 'السوق')) {
    plans.push({ tool: 'getMarketIntelligence', params: {} });
    return plans;
  }
  if (has('order', 'طلبات', 'طلب')) {
    plans.push({ tool: 'getOrders', params: { limit: 20 } });
    return plans;
  }
  if (has('analytics', 'تحليلات')) {
    plans.push({ tool: 'getAnalytics', params: { limit: 20 } });
    return plans;
  }
  if (contextualRef && (has('why', 'pending', 'status', 'detail', 'explain', 'responsible', 'reschedule',
    'لماذا', 'حالة', 'تفاصيل', 'اشرح', 'مسؤول', 'إعادة جدولة') || hasWord('this', 'it') || has('هذا', 'هذه', 'ذلك', 'تلك'))) {
    plans.push({ tool: 'getBooking', params: { bookingId: contextualRef } });
    return plans;
  }
  if (ref && has('booking', 'find', 'show', 'lookup', 'dh-', 'bk-', 'booking dh', 'حجز', 'اعرض', 'ابحث')) {
    plans.push({ tool: 'getBooking', params: { bookingId: ref } });
    return plans;
  }
  if (ref) {
    plans.push({ tool: 'getBooking', params: { bookingId: ref } });
    return plans;
  }
  if (has('booking', 'حجز', 'حجوزات') && (has('today', 'tomorrow', 'find', 'show', 'list', 'search', 'اليوم', 'غدا', 'غدًا', 'اعرض', 'ابحث', 'قائمة') || dateMatch)) {
    plans.push({ tool: 'getBookings', params: { limit: 25 } });
    return plans;
  }
  if (has('dashboard', 'summary', 'overview', 'لوحة', 'ملخص', 'نظرة', 'نظرة عامة')) {
    plans.push({ tool: 'getDashboardSummary', params: {} });
    return plans;
  }
  // Fallback: dashboard + attention so the admin always gets real signal.
  plans.push({ tool: 'getDashboardSummary', params: {} });
  plans.push({ tool: 'getAttentionQueue', params: {} });
  return plans.slice(0, MAX_TOOLS_PER_QUERY);
}

// ---------------------------------------------------------------------------
// Reply composer — grounded strictly in tool output, EN + AR.
// ---------------------------------------------------------------------------

function composeReply(plans: IntelPlannedCall[], results: { tool: string; result?: unknown; error?: string }[], language: string): string {
  const ar = language === 'ar';
  const lines: string[] = [];
  for (const r of results) {
    const res = r.result as { summary?: string; data?: unknown; rowCount?: number } | undefined;
    if (r.error) {
      lines.push(ar ? `تعذّر تنفيذ ${r.tool}: ${r.error}` : `Could not run ${r.tool}: ${r.error}`);
      continue;
    }
    if (res?.summary) lines.push(res.summary);
  }
  if (lines.length === 0) {
    return ar
      ? 'لا توجد بيانات متاحة لهذا الاستفسار حالياً.'
      : 'No data is available for that request right now.';
  }
  void plans;
  return lines.slice(0, 12).join('\n');
}

export interface IntelQueryResult {
  reply: string;
  language: string;
  toolCalls: { tool: string; ok: boolean; summary?: string; rowCount?: number; error?: string }[];
  results: Record<string, unknown>;
  confirmationsRequired: IntelConfirmation[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

export const intelligenceCoreService = {
  parseIntent(text: string, ctx?: IntelContextInput): IntelPlannedCall[] {
    return parseIntelIntent(text, ctx);
  },

  async query(input: {
    userId: string;
    userRole: string;
    text: string;
    context?: IntelContextInput;
    language?: string;
  }): Promise<IntelQueryResult> {
    const started = Date.now();
    if (!isOpsAdmin(input.userRole)) {
      deny({ userId: input.userId, userRole: input.userRole, tool: 'query', reason: 'role', status: 403 });
    }
    const text = (input.text || '').slice(0, 2000).trim();
    if (!text) throw Object.assign(new Error('text is required.'), { status: 400 });
    const language = input.language === 'ar' ? 'ar' : 'en';
    const ctx: IntelToolContext = { userId: input.userId, userRole: input.userRole };

    audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_QUERY', 'query', {
      textLength: text.length,
      section: input.context?.section,
    });

    const plans = parseIntelIntent(text, input.context).slice(0, MAX_TOOLS_PER_QUERY);
    const toolCalls: IntelQueryResult['toolCalls'] = [];
    const results: Record<string, unknown> = {};
    const detail: { tool: string; result?: unknown; error?: string }[] = [];

    for (const plan of plans) {
      const toolStarted = Date.now();
      try {
        const def = getTool(plan.tool);
        if (def.risk !== 'LOW') {
          toolCalls.push({ tool: plan.tool, ok: false, error: 'Mutation tools require the action flow with confirmation.' });
          detail.push({ tool: plan.tool, error: 'Use the action flow for mutations.' });
          continue;
        }
        const out = await runTool(plan.tool, sanitizeParams(plan.params), ctx);
        audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_TOOL_CALL', plan.tool, { risk: out.risk });
        track('intel.tool', input.userId, { tool: plan.tool, ms: Date.now() - toolStarted, rowCount: out.rowCount ?? 0 });
        toolCalls.push({ tool: plan.tool, ok: true, summary: out.summary, rowCount: out.rowCount });
        results[plan.tool] = out.data;
        detail.push({ tool: plan.tool, result: out });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Tool failed.';
        audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_ERROR', plan.tool, { error: message.slice(0, 300) });
        track('intel.error', input.userId, { tool: plan.tool, ms: Date.now() - toolStarted, error: message.slice(0, 200) });
        toolCalls.push({ tool: plan.tool, ok: false, error: message });
        detail.push({ tool: plan.tool, error: message });
      }
    }

    const failures = toolCalls.filter(c => !c.ok).length;
    track('intel.query', input.userId, { tools: plans.length, failures, ms: Date.now() - started });
    return {
      reply: composeReply(plans, detail, language),
      language,
      toolCalls,
      results,
      confirmationsRequired: [],
      generatedAt: nowISO(),
    };
  },

  async getAttention(input: { userId: string; userRole: string }): Promise<{ items: unknown[]; total: number; summary: string }> {
    if (!isOpsAdmin(input.userRole)) {
      deny({ userId: input.userId, userRole: input.userRole, tool: 'getAttentionQueue', reason: 'role', status: 403 });
    }
    const out = await runTool('getAttentionQueue', {}, { userId: input.userId, userRole: input.userRole });
    audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_TOOL_CALL', 'getAttentionQueue', { risk: out.risk });
    track('intel.tool', input.userId, { tool: 'getAttentionQueue', rowCount: out.rowCount ?? 0 });
    const data = out.data as { items: unknown[]; total: number };
    return { items: data.items, total: data.total, summary: out.summary };
  },

  /**
   * Mutation entry-point. LOW executes; MEDIUM/HIGH return a confirmation
   * token; FORBIDDEN (unknown or disallowed) rejects. Bulk plans validate
   * every id before any confirmation is issued.
   */
  async requestAction(input: {
    userId: string;
    userRole: string;
    tool: string;
    params?: Record<string, unknown>;
    bulkIds?: string[];
  }): Promise<{ executed: boolean; confirmation?: IntelConfirmation; result?: unknown; impact?: string }> {
    if (!isOpsAdmin(input.userRole)) {
      deny({ userId: input.userId, userRole: input.userRole, tool: input.tool, reason: 'role', status: 403 });
    }
    sweepConfirms();
    const def = getTool(input.tool);
    if (def.risk === 'LOW') {
      // Read tools should use /query; executing them here is harmless but explicit.
      const out = await runTool(def.name, sanitizeParams(input.params ?? {}), { userId: input.userId, userRole: input.userRole });
      audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_TOOL_CALL', def.name, { risk: out.risk });
      track('intel.tool', input.userId, { tool: def.name, rowCount: out.rowCount ?? 0 });
      return { executed: true, result: out.data, impact: out.summary };
    }
    if (def.risk === 'FORBIDDEN') {
      deny({ userId: input.userId, userRole: input.userRole, tool: def.name, reason: 'forbidden', status: 403 });
    }

    const params = sanitizeParams(input.params ?? {});
    const bulkIds = Array.isArray(input.bulkIds)
      ? input.bulkIds.filter(x => typeof x === 'string').map(x => x.slice(0, 128)).slice(0, MAX_BULK_IDS)
      : undefined;
    if (bulkIds && bulkIds.length === 0) throw Object.assign(new Error('bulkIds must not be empty.'), { status: 400 });

    // Bulk guardrails, validated BEFORE any token is issued: every id must
    // resolve, and trip-scoped tools need their trip up front — otherwise
    // every per-item execution would fail deterministically.
    if (bulkIds && BOOKING_MUTATION_TOOLS.has(def.name)) {
      if ((def.name === 'cancelBooking' || def.name === 'rescheduleBooking') && !strParam(params.tripId)) {
        throw Object.assign(new Error(`"${def.name}" needs tripId for bulk execution (every item shares it).`), { status: 400 });
      }
      const missing: string[] = [];
      for (const id of bulkIds) {
        try {
          serviceGetBooking({ bookingId: id, userId: input.userId, userRole: input.userRole });
        } catch {
          missing.push(id);
        }
      }
      if (missing.length > 0) {
        throw Object.assign(
          new Error(`Unknown booking id(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}. No confirmation issued.`),
          { status: 400 },
        );
      }
    }

    const impact = buildImpact(def.name, params, bulkIds);
    const token = `ICF-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
    const confirmation: PendingConfirm = {
      token,
      tool: def.name,
      params,
      risk: def.risk,
      impact,
      affectedCount: bulkIds ? bulkIds.length : 1,
      createdAt: nowISO(),
      expiresAt: new Date(Date.now() + CONFIRM_TTL_MS).toISOString(),
      expiresMs: Date.now() + CONFIRM_TTL_MS,
      createdBy: input.userId,
      createdByRole: input.userRole,
      bulk: bulkIds ? { ids: bulkIds, total: bulkIds.length } : undefined,
    };
    pendingConfirms.set(token, confirmation);
    audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_CONFIRM', def.name, {
      token: token.slice(0, 12) + '…',
      risk: def.risk,
      affectedCount: confirmation.affectedCount,
    });
    track('intel.confirm', input.userId, { tool: def.name, bulk: bulkIds?.length ?? 0 });
    const { expiresMs: _e, ...publicConfirm } = confirmation;
    void _e;
    return { executed: false, confirmation: publicConfirm, impact };
  },

  async confirmAction(input: { userId: string; userRole: string; token: string }): Promise<{ ok: boolean; tool: string; result?: unknown; bulk?: { ok: number; failed: number; failures: { id: string; error: string }[] } }> {
    if (!isOpsAdmin(input.userRole)) {
      deny({ userId: input.userId, userRole: input.userRole, tool: 'confirm', reason: 'role', status: 403 });
    }
    // NOTE: no sweep before the lookup — sweeping first would delete an
    // expired token and turn its 410 into a 404. Sweep at the end instead.
    const token = (input.token || '').slice(0, 128);
    const pending = pendingConfirms.get(token);
    if (!pending) {
      const consumed = consumedConfirms.get(token);
      if (consumed) {
        // Replay of an already-executed token: reject (404 keeps the public
        // contract) AND audit — silent replays hide double-submit attacks.
        audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_DENIED', consumed.tool, { reason: 'replay' });
        track('intel.deny', input.userId, { tool: consumed.tool, reason: 'replay' });
        throw Object.assign(new Error('Confirmation token was already used (replay rejected).'), { status: 404 });
      }
      throw Object.assign(new Error('Confirmation token is unknown or already consumed.'), { status: 404 });
    }
    if (Date.now() > pending.expiresMs) {
      pendingConfirms.delete(token);
      audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_DENIED', pending.tool, { reason: 'expired' });
      track('intel.deny', input.userId, { tool: pending.tool, reason: 'expired' });
      throw Object.assign(new Error('Confirmation token has expired. Request the action again.'), { status: 410 });
    }
    // Token is bound to its creator and role — no privilege drift.
    if (pending.createdBy !== input.userId || pending.createdByRole !== input.userRole) {
      audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_DENIED', pending.tool, { reason: 'token_mismatch' });
      track('intel.deny', input.userId, { tool: pending.tool, reason: 'token_mismatch' });
      throw Object.assign(new Error('Confirmation token does not belong to this session.'), { status: 403 });
    }
    pendingConfirms.delete(token);
    consumedConfirms.set(token, { tool: pending.tool, atMs: Date.now() });
    sweepConfirms();

    // Re-authorize at execution time (never trust the pre-confirm decision).

    // Re-authorize at execution time (never trust the pre-confirm decision).
    const def = getTool(pending.tool);
    const ctx: IntelToolContext = { userId: input.userId, userRole: input.userRole };

    if (pending.bulk) {
      const failures: { id: string; error: string }[] = [];
      let ok = 0;
      for (const id of pending.bulk.ids) {
        try {
          await runTool(pending.tool, { ...pending.params, bookingId: id }, ctx);
          ok += 1;
        } catch (err: unknown) {
          failures.push({ id, error: err instanceof Error ? err.message : 'Failed.' });
        }
      }
      audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_BULK_ACTION', pending.tool, {
        ok, failed: failures.length, total: pending.bulk.total,
      });
      track('intel.mutation', input.userId, { tool: pending.tool, bulk: pending.bulk.total });
      return { ok: failures.length === 0, tool: pending.tool, bulk: { ok, failed: failures.length, failures } };
    }

    const out = await runTool(pending.tool, pending.params, ctx);
    audit(input.userId, input.userRole, 'INTELLIGENCE_CORE_MUTATION', pending.tool, { risk: pending.risk });
    track('intel.mutation', input.userId, { tool: pending.tool });
    return { ok: true, tool: pending.tool, result: out.data };
  },

  /** Test seam: clear in-memory confirmations. */
  __clearConfirms(): void {
    pendingConfirms.clear();
    consumedConfirms.clear();
  },

  /** Test seam: force a pending token to expire (expiry-path tests). */
  __forceExpire(token: string): boolean {
    const pending = pendingConfirms.get((token || '').slice(0, 128));
    if (!pending) return false;
    pending.expiresMs = Date.now() - 1;
    return true;
  },

  /** Test seam: number of live pending confirmations (sweep tests). */
  __pendingCount(): number {
    return pendingConfirms.size;
  },
};

function buildImpact(tool: string, params: Record<string, unknown>, bulkIds?: string[]): string {
  const target = bulkIds ? `${bulkIds.length} record(s): ${bulkIds.slice(0, 5).join(', ')}${bulkIds.length > 5 ? '…' : ''}` : JSON.stringify(params).slice(0, 300);
  switch (tool) {
    case 'cancelBooking':
      return `Cancel booking ${target}. Releases inventory, may issue a refund per policy, notifies parties. Cannot be undone silently.`;
    case 'rescheduleBooking':
      return `Move booking ${target}. Frees the old slot and reserves the new one; fails if the new slot lacks capacity.`;
    case 'approveSupplierBooking':
      return `Accept booking(s) ${target} on behalf of the supplier. Traveler is notified.`;
    case 'rejectSupplierBooking':
      return `Reject booking(s) ${target} on behalf of the supplier. Traveler is notified; recovery may be needed.`;
    case 'updateInventory':
      return `Change inventory slot ${target}. Affects sellable capacity and pricing immediately.`;
    case 'sendNotification':
      return `Send an operational message (${target}). Single recipient only.`;
    default:
      return `Execute ${tool} on ${target}.`;
  }
}

export { TOOL_REGISTRY };
