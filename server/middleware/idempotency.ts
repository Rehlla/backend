import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import { db } from '../db/database';
import type { AuthenticatedRequest } from './correlationMiddleware';

/**
 * `Idempotency-Key` support for mutations that move money or send messages
 * (docs/OPS_API_CONTRACT.md).
 *
 * The stored response is keyed on user + key + route, so one user's key can
 * never replay another user's response, and the same key on two different
 * routes are two different operations. The first response (status + JSON
 * body) is stored for 24 h; a replay returns it unchanged with
 * `Idempotent-Replay: true` and the handler does not run again. A second
 * request arriving while the first is still running gets 409. 5xx responses
 * are not stored, so a transient failure can be retried with the same key.
 *
 * Without the header the request passes through untouched — the existing
 * body-level idempotencyKey contracts (e.g. /commerce/refund) still apply.
 */

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function routeOf(req: AuthenticatedRequest): string {
  return `${req.method.toUpperCase()} ${req.baseUrl}${req.path}`;
}

function prune(now: number) {
  const rows = db.idempotencyKeys;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (Date.parse(rows[i].expiresAt) <= now) rows.splice(i, 1);
  }
}

export function idempotency(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header('idempotency-key');
  if (!header) return next();
  const key = header.trim();
  if (!key || key.length > 200) {
    return res.status(400).json({
      type: 'https://dahab.travel/errors/bad-request',
      title: 'Invalid Idempotency-Key',
      status: 400,
      detail: 'Idempotency-Key must be 1..200 characters.',
      instance: req.originalUrl,
      correlationId: req.correlationId,
    });
  }
  const userId = req.user?.userId || 'anonymous';
  const route = routeOf(req);
  const id = crypto.createHash('sha256').update(`${userId}|${key}|${route}`).digest('hex');
  const now = Date.now();
  prune(now);

  const existing = db.idempotencyKeys.find(r => r.id === id);
  if (existing) {
    if (existing.status === 'pending') {
      return res.status(409).json({
        type: 'https://dahab.travel/errors/idempotency-in-flight',
        title: 'Request In Progress',
        status: 409,
        detail: 'A request with this Idempotency-Key is still being processed.',
        instance: req.originalUrl,
        correlationId: req.correlationId,
      });
    }
    res.setHeader('Idempotent-Replay', 'true');
    return res.status(existing.responseStatus || 200).json(existing.responseBody);
  }

  const row = {
    id,
    userId,
    route,
    status: 'pending' as 'pending' | 'complete',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + IDEMPOTENCY_TTL_MS).toISOString(),
  };
  db.idempotencyKeys.push(row);

  const originalJson = res.json.bind(res);
  let captured = false;
  res.json = ((body: unknown) => {
    if (!captured) {
      captured = true;
      const stored = db.idempotencyKeys.find(r => r.id === id);
      if (res.statusCode >= 500) {
        const idx = db.idempotencyKeys.findIndex(r => r.id === id);
        if (idx >= 0) db.idempotencyKeys.splice(idx, 1);
      } else if (stored) {
        stored.status = 'complete';
        (stored as any).responseStatus = res.statusCode;
        (stored as any).responseBody = body === undefined ? null : JSON.parse(JSON.stringify(body));
        db.saveToDisk();
      }
    }
    return originalJson(body);
  }) as Response['json'];

  // A handler that ends without res.json (or crashes) must not leave the key
  // stuck in 'pending' for 24 h.
  res.on('finish', () => {
    if (captured) return;
    const idx = db.idempotencyKeys.findIndex(r => r.id === id && r.status === 'pending');
    if (idx >= 0) db.idempotencyKeys.splice(idx, 1);
  });

  next();
}
