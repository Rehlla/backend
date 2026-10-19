import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { settingsService } from '../services/settingsService';
import { approvalService } from '../services/approvalService';
import { publishStaffEvent } from '../services/staffEventStream';
import { sendProblem } from '../lib/problem';

/**
 * Shared by POST /api/commerce/refund (server.ts) and POST
 * /api/operations/refund: a refund above `commerce.refundApprovalThresholdEgp`
 * is queued for a second admin instead of executing. Answers 403
 * `.../approval-required` with { approvalId } and returns true when it did.
 */
export function queueRefundIfAboveThreshold(
  req: AuthenticatedRequest,
  res: Response,
  params: { bookingId?: string; tripId: string; amountEGP: number; reason: string; idempotencyKey: string },
  supplierId?: string
): boolean {
  const threshold = settingsService.getNumber('commerce.refundApprovalThresholdEgp', 5000);
  if (!(Number.isFinite(params.amountEGP) && params.amountEGP > threshold)) return false;
  const approval = approvalService.request(
    'refund',
    `Refund ${params.amountEGP} EGP on ${params.bookingId || params.tripId}`,
    { ...params, ...(supplierId ? { supplierId } : {}) },
    { userId: req.user!.userId, role: req.user!.role },
    req.correlationId
  );
  sendProblem(req, res, 403, 'approval-required', 'Approval Required',
    `Refunds above ${threshold} EGP need a second admin. The request was queued.`, { approvalId: approval.id });
  return true;
}

export function publishRefundIssued(
  req: AuthenticatedRequest,
  result: { refundId: string; amountEGP: number },
  supplierId?: string
) {
  publishStaffEvent('RefundIssued', {
    entityType: 'Refund', entityId: result.refundId, summary: `Refund ${result.amountEGP} EGP issued`,
    ...(supplierId ? { supplierId } : {}),
  }, req.user?.userId, req.correlationId);
}
