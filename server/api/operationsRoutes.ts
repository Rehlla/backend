import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { ledgerService } from '../services/ledgerService';
import { buildOperationsSummary } from '../services/buildOperationsSummary';
import { transferHubService } from '../services/transferHubService';
import { paymentService } from '../services/paymentService';
import { notificationService } from '../services/notificationService';
import { smsGatewayService } from '../services/smsGatewayService';
import { integrationHealthService } from '../services/integrationHealthService';
import { auditService } from '../services/auditService';
import { hasListParams, listFromQuery } from '../lib/listQuery';
import { idempotency } from '../middleware/idempotency';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { queueRefundIfAboveThreshold, publishRefundIssued } from './refundApproval';

/**
 * /api/operations/* — moved out of server.ts without changing paths,
 * behaviour or middleware order (mounted at /api/operations where the inline
 * routes were). Access is gated by apiAccessPolicy (ROLE_RULES: Operations /
 * Admin; PERMISSION_RULES: the ops.* key per path).
 *
 * Additions from docs/OPS_API_CONTRACT.md: list params on audit-events,
 * ETag on overview, Idempotency-Key on refund and sms-dispatch, real probes
 * behind integrations, and the refund approval threshold.
 */
export const operationsRouter = Router();

// ---------------------------------------------------------------------------
// 7. Operations & Audit
// ---------------------------------------------------------------------------
operationsRouter.get('/overview', (req, res) => {
  const body = {
    trips: db.trips,
    bookings: db.bookings,
    suppliers: db.suppliers,
    telemetry: db.transferTelemetry,
    ledger: ledgerService.verifyLedgerIntegrity(),
    auditEvents: db.auditEvents.slice(0, 50),
    summary: buildOperationsSummary(db.trips, db.bookings, db.ledgerEntries)
  };
  // Strong ETag over the serialized body: the dashboards poll this every few
  // seconds and it is the heaviest payload in the API. If-None-Match → 304.
  const serialized = JSON.stringify(body);
  const etag = `"${crypto.createHash('sha1').update(serialized).digest('base64url')}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, no-cache');
  const inm = req.header('if-none-match');
  if (inm && inm.split(',').map(s => s.trim()).some(t => t === etag || t === `W/${etag}` || t === '*')) {
    return res.status(304).end();
  }
  res.type('application/json').send(serialized);
});

/**
 * Legacy shape ({ auditEvents }) when no list params are sent. With any of
 * cursor/limit/sort/q/actor/action/entityType/entityId the contract list
 * shape is returned; `auditEvents` is kept as an alias of `items` so the web
 * AuditCenter (which sends ?limit=) keeps rendering.
 */
operationsRouter.get('/audit-events', (req, res) => {
  const filters = ['actor', 'action', 'entityType', 'entityId'];
  if (!hasListParams(req.query as Record<string, unknown>, filters)) {
    return res.json({ auditEvents: db.auditEvents });
  }
  const q = req.query as Record<string, unknown>;
  const rows = db.auditEvents.filter(e =>
    filters.every(f => typeof q[f] !== 'string' || !q[f] || String((e as any)[f]) === q[f])
  );
  const result = listFromQuery(rows, q, {
    sortable: ['timestamp', 'actor', 'action', 'entityType'],
    searchFields: ['action', 'actor', 'entityType', 'entityId'],
  });
  const items = result.items.map(auditService.toView);
  res.json({ items, nextCursor: result.nextCursor, total: result.total, auditEvents: items });
});

// ---------------------------------------------------------------------------
// 7b. Operations Admin Endpoints (Command Center)
// ---------------------------------------------------------------------------

/** GET /api/operations/trips — All trips for admin overview */
operationsRouter.get('/trips', (req: AuthenticatedRequest, res) => {
  const trips = db.trips.map(t => ({
    ...t,
    bookingCount: db.bookings.filter(b => b.tripId === t.id).length,
    activeTransfers: db.bookings.filter(b => b.tripId === t.id && b.serviceType === 'transfer' && b.supplierState !== 'COMPLETED').length,
  }));
  res.json({ trips, total: trips.length });
});

/** GET /api/operations/bookings — All bookings for admin overview */
operationsRouter.get('/bookings', (req, res) => {
  const { status, supplierId, paymentState, limit: limitStr } = req.query;
  let bookings = [...db.bookings];
  if (status) bookings = bookings.filter(b => b.supplierState === status);
  if (supplierId) bookings = bookings.filter(b => b.supplierId === supplierId);
  if (paymentState) bookings = bookings.filter(b => b.paymentState === paymentState);
  const limit = Math.min(Number(limitStr) || 100, 500);
  res.json({ bookings: bookings.slice(0, limit), total: bookings.length });
});

/** GET /api/operations/payments — Payment summary for admin */
operationsRouter.get('/payments', (req, res) => {
  const captured = db.ledgerEntries.filter(e => e.type === 'PAYMENT_CAPTURED');
  const refunded = db.ledgerEntries.filter(e => e.type === 'REFUND_ISSUED');
  const commission = db.ledgerEntries.filter(e => e.type === 'PLATFORM_COMMISSION');
  const totalCapturedEGP = captured.reduce((s, e) => s + (e.amountEGP || 0), 0);
  const totalRefundedEGP = refunded.reduce((s, e) => s + (e.amountEGP || 0), 0);
  const totalCommissionEGP = commission.reduce((s, e) => s + (e.amountEGP || 0), 0);
  const failedPayments = db.bookings.filter(b => b.paymentState === 'FAILED' || b.paymentState === 'REFUNDED');
  res.json({
    summary: { totalCapturedEGP, totalRefundedEGP, totalCommissionEGP, entryCount: db.ledgerEntries.length },
    failedPayments: failedPayments.map(b => ({ id: b.id, bookingRef: b.bookingRef, amountEGP: b.amountEGP, paymentState: b.paymentState, tripId: b.tripId })),
  });
});

/** GET /api/operations/transfers — Active transfers */
operationsRouter.get('/transfers', (req, res) => {
  transferHubService.assignDueDrivers();
  const transferBookings = db.bookings.filter(b => b.serviceType === 'transfer');
  const enriched = transferBookings.map(b => {
    const telemetry = db.transferTelemetry.find(t => t.bookingId === b.id);
    // Derive the transfer bus (within-Dahab on-demand vs Egypt-wide corridor)
    // from the SKU's route when available; falls back to the pickup label.
    const sku = db.productSkus.find(s => s.id === b.skuId);
    const originLabel = b.pickupLocation || sku?.routeFrom || 'Sharm El Sheikh Airport';
    const dahabArea =
      /masbat|lighthouse|assala|mashraba|eel garden|lagoon|blue hole|المشباط|عسلة|المشربة|لاجونا|الزرقاء/i.test(originLabel);
    const transferType = sku?.routeFrom && /Sharm|Cairo|Giza|Hurghada|Marsa|Luxor|Suez|Isma|Nuweiba|Taba|Catherine/i.test(sku.routeFrom)
      ? 'anywhere'
      : (dahabArea ? 'within_dahab' : 'anywhere');
    return {
      ...b,
      transferType,
      origin: originLabel,
      driverName: telemetry?.driverName || null,
      vehiclePlate: telemetry?.vehiclePlate || null,
      driverPhone: telemetry?.driverPhone || null,
      lastTelemetryAt: telemetry?.lastGpsUpdate || null,
      sellEGP: b.hubQuote?.sellEGP ?? null,
      supplierCostEGP: b.hubQuote?.supplierCostEGP ?? null,
      marginEGP: b.hubQuote ? b.hubQuote.sellEGP - b.hubQuote.supplierCostEGP : null,
      freeCancelUntil: b.hubQuote?.freeCancelUntil ?? null,
    };
  });
  res.json({ transfers: enriched, total: enriched.length });
});

/** GET /api/operations/supplier-reliability — Supplier health metrics */
operationsRouter.get('/supplier-reliability', (req, res) => {
  const reliability = db.suppliers.map(s => {
    const bookings = db.bookings.filter(b => b.supplierId === s.id);
    const confirmed = bookings.filter(b => b.supplierState === 'CONFIRMED' || b.supplierState === 'COMPLETED');
    const rejected = bookings.filter(b => b.supplierState === 'REJECTED');
    const pending = bookings.filter(b => b.supplierState === 'PENDING_CONFIRMATION');
    return {
      supplierId: s.id,
      businessName: s.businessName,
      status: s.status,
      totalBookings: bookings.length,
      confirmationRate: bookings.length > 0 ? Math.round((confirmed.length / bookings.length) * 100) : 0,
      rejectionRate: bookings.length > 0 ? Math.round((rejected.length / bookings.length) * 100) : 0,
      pendingCount: pending.length,
    };
  });
  res.json({ suppliers: reliability, total: reliability.length });
});

/** POST /api/operations/refund — Process refund with audit */
operationsRouter.post('/refund', idempotency, (req: AuthenticatedRequest, res) => {
  const { bookingRef, amountEGP, reason, operatorId } = req.body;
  if (!bookingRef || !amountEGP || !reason) {
    return res.status(400).json({ error: 'bookingRef, amountEGP, and reason are required.' });
  }
  const booking = db.bookings.find(b => b.bookingRef === bookingRef);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.paymentState === 'REFUNDED') return res.status(400).json({ error: 'Already refunded.' });

  // This handler used to build a ledger entry by hand with signatureHash '' and
  // push it straight into db.ledgerEntries. verifyLedgerIntegrity recomputes
  // every entry's hash, so '' never matches and the ledger chain was broken
  // permanently after the first ops refund — with no persist, no escrow cap and
  // no commission reversal. Delegating to processRefund gives double-entry,
  // the refundable cap, the 15% commission reversal, an idempotency key, and
  // persistence through db.runInTransaction.
  // The actor is taken from the session, never from the body.
  try {
    const params = {
      bookingId: bookingRef,
      tripId: booking.tripId,
      amountEGP: Number(amountEGP),
      reason,
      idempotencyKey: `OPS-REFUND-${bookingRef}`,
      initiatedBy: req.user?.userId || 'SYSTEM'
    };
    // Above commerce.refundApprovalThresholdEgp the refund is queued for a
    // second admin instead (403 .../approval-required).
    if (queueRefundIfAboveThreshold(req, res, params, booking.supplierId)) return;
    const result = paymentService.processRefund(params);
    publishRefundIssued(req, result, booking.supplierId);
    res.json({ success: true, refundId: result.refundId, amountEGP: result.amountEGP, status: result.status, signatureHash: result.signatureHash });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/** GET /api/operations/notifications — All notifications for admin */
operationsRouter.get('/notifications', (req, res) => {
  const notifications = notificationService.getNotificationsForUser('ALL');
  const summary = {
    total: notifications.length,
    unread: notifications.filter((n: any) => !n.read).length,
    urgent: notifications.filter((n: any) => n.priority === 'URGENT' || n.priority === 'HIGH').length,
  };
  res.json({ notifications, summary });
});

/** POST /api/operations/sms-dispatch — Send SMS with audit */
operationsRouter.post('/sms-dispatch', idempotency, async (req: AuthenticatedRequest, res) => {
  const { to, recipientName, recipientRole, message, bookingRef, channel } = req.body;
  if (!to || !recipientName || !message) {
    return res.status(400).json({ error: 'to, recipientName, and message are required.' });
  }
  try {
    const result = await smsGatewayService.sendSms({ to, recipientName, recipientRole: (recipientRole || 'TRAVELER') as any, message, bookingRef });
    // Audit. This used to push a row with signature '' straight into
    // db.auditEvents; auditService signs it like every other audit event.
    auditService.record({
      actor: req.user?.userId || 'SYSTEM',
      actorRole: req.user?.role || 'Operations',
      action: 'SMS_DISPATCHED',
      entityType: 'sms',
      entityId: to,
      after: { to, recipientName, recipientRole, bookingRef, channel },
      correlationId: req.correlationId,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/operations/integrations — Integration status.
 *
 * Same response shape the web SystemHealth panel reads
 * ({ integrations: [{ name, purpose, status, lastSuccess, lastFailure, freshness }], total }),
 * but backed by the real probes in integrationHealthService instead of a
 * hardcoded list that reported Paymob and Twilio 'healthy' unconditionally.
 */
operationsRouter.get('/integrations', async (req, res) => {
  try {
    const integrations = await integrationHealthService.legacyList();
    res.json({ integrations, total: integrations.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
