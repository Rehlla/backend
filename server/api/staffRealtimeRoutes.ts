import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { hasPermission } from '../services/permissionService';
import {
  staffEventStream,
  canReceive,
  STREAM_TOPICS,
  type StreamEvent,
  type StreamTopic,
} from '../services/staffEventStream';

/**
 * GET /api/stream (SSE) and GET /api/search — docs/OPS_API_CONTRACT.md.
 * Mounted at /api. Both require a session (deny-by-default access policy);
 * cookie or Bearer both work, since optionalAuth accepts either.
 */
export const staffRealtimeRouter = Router();

export const HEARTBEAT_MS = 25_000;

staffRealtimeRouter.get('/stream', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).end();
  const requested = typeof req.query.topics === 'string' && req.query.topics
    ? req.query.topics.split(',').map(s => s.trim()).filter((t): t is StreamTopic => (STREAM_TOPICS as readonly string[]).includes(t))
    : [...STREAM_TOPICS];
  const topics = new Set<StreamTopic>(requested);
  const sub = { userId: req.user.userId, role: req.user.role, supplierId: req.user.supplierId };

  // Same headers as /api/daygi/query/stream (no hand-set Connection header).
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');

  const send = (e: StreamEvent) => {
    if (!canReceive(sub, e, topics)) return;
    res.write(`id: ${e.id}\nevent: ${e.topic}\ndata: ${JSON.stringify(e.data)}\n\n`);
  };

  const lastIdRaw = req.header('last-event-id') ?? (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : undefined);
  const lastId = Number(lastIdRaw);
  if (lastIdRaw !== undefined && Number.isFinite(lastId)) {
    for (const e of staffEventStream.since(lastId)) send(e);
  }

  staffEventStream.on('event', send);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), (req.app.get('sseHeartbeatMs') as number) || HEARTBEAT_MS);
  // The RESPONSE close, not the request one (see /api/daygi/query/stream).
  res.on('close', () => {
    clearInterval(heartbeat);
    staffEventStream.off('event', send);
  });
});

type SearchType = 'booking' | 'user' | 'supplier' | 'property';
const SEARCH_TYPES: SearchType[] = ['booking', 'user', 'supplier', 'property'];
const PER_TYPE = 10;

staffRealtimeRouter.get('/search', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).end();
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().slice(0, 200) : '';
  if (!q) return res.json({ items: [] });
  const types = typeof req.query.types === 'string' && req.query.types
    ? req.query.types.split(',').map(s => s.trim()).filter((t): t is SearchType => (SEARCH_TYPES as string[]).includes(t))
    : SEARCH_TYPES;
  const subject = { userId: req.user.userId, role: req.user.role };
  const has = (k: string) => hasPermission(subject, k);
  const hit = (...vals: unknown[]) => vals.some(v => typeof v === 'string' && v.toLowerCase().includes(q));
  const items: { type: SearchType; id: string; title: string; subtitle: string; route: string }[] = [];

  if (types.includes('booking')) {
    // The desk sees every booking; a supplier only their own business's.
    const desk = has('ops.trips.view');
    const ownSupplier = req.user.role === 'Supplier' && req.user.supplierId && has('supplier.inbox.view') ? req.user.supplierId : null;
    if (desk || ownSupplier) {
      db.bookings
        .filter(b => (desk || b.supplierId === ownSupplier) && hit(b.bookingRef, b.id, b.travelerName, desk ? b.travelerEmail : undefined, desk ? b.travelerPhone : undefined))
        .slice(0, PER_TYPE)
        .forEach(b => items.push({ type: 'booking', id: b.id, title: b.bookingRef, subtitle: `${b.travelerName} · ${b.serviceType} · ${b.supplierState}`, route: `/ops/bookings/${encodeURIComponent(b.bookingRef)}` }));
    }
  }
  if (types.includes('user') && has('admin.users.view')) {
    db.users
      .filter(u => hit(u.email, u.name, u.phone, u.id))
      .slice(0, PER_TYPE)
      .forEach(u => items.push({ type: 'user', id: u.id, title: u.name, subtitle: `${u.email} · ${u.role}`, route: `/admin/users/${encodeURIComponent(u.id)}` }));
  }
  if (types.includes('supplier') && has('ops.suppliers.view')) {
    db.suppliers
      .filter(s => hit(s.businessName, s.businessNameAr, s.displayName, s.id))
      .slice(0, PER_TYPE)
      .forEach(s => items.push({ type: 'supplier', id: s.id, title: s.businessName, subtitle: `${s.category} · ${s.status}`, route: `/ops/suppliers/${encodeURIComponent(s.id)}` }));
  }
  if (types.includes('property') && has('ops.accommodations.view')) {
    db.accommodations
      .filter(a => hit(a.name, a.nameAr, a.slug, a.id, a.areaName))
      .slice(0, PER_TYPE)
      .forEach(a => items.push({ type: 'property', id: a.id, title: a.name, subtitle: `${a.propertyType} · ${a.areaName}`, route: `/ops/accommodations/${encodeURIComponent(a.id)}` }));
  }
  res.json({ items });
});
