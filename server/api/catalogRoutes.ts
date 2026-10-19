import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { InvalidRequestBodyError } from '../middleware/bodyParams';
import { hasPermission } from '../services/permissionService';
import { sendProblem } from '../lib/problem';
import { parseBody } from '../contracts/opsContract';
import {
  BulkBody,
  ChildBody,
  CreateBody,
  PatchBody,
  RatesBody,
  ReasonBody,
  SlotsBody,
  TransitionBody,
} from '../contracts/catalogContract';
import { catalogService, parseIfMatch, type Transition, type WriteResult } from '../services/catalog/catalogService';
import { adapterFor, buildSchema, permissionFor } from '../services/catalog/registry';
import { CatalogError, type CatalogAdapter, type CatalogCtx } from '../services/catalog/types';

/**
 * /api/admin/catalog — the staff catalogue surface (docs/CATALOG_API_CONTRACT.md).
 *
 * The handlers are shared with /api/supplier/catalog (supplierCatalogRoutes.ts):
 * `mode` decides whether the caller is staff (per-type catalog.<area>.* keys)
 * or a supplier (supplier.catalog.manage, pinned to req.user.supplierId,
 * body supplierId ignored, publish → review). Both route tables are spelled
 * out literally so tests/contract/apiContract.test.ts can scan them.
 *
 * Mounted before adminSiteRouter, whose router-level requireRole would
 * otherwise swallow /api/admin/catalog for Product accounts.
 */

type Mode = 'staff' | 'supplier';
type Action = 'view' | 'manage' | 'publish';

const TITLES: Record<number, string> = {
  400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity',
};

const handle = (fn: (req: AuthenticatedRequest, res: Response) => unknown) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      if (res.headersSent) return next(err);
      if (err instanceof CatalogError) {
        return sendProblem(req, res, err.status, err.slug, TITLES[err.status] ?? 'Error', err.message, err.extra);
      }
      if (err instanceof InvalidRequestBodyError) return sendProblem(req, res, 400, 'bad-request', 'Bad Request', err.message);
      const status = typeof err?.status === 'number' ? err.status : 500;
      if (status >= 500) return next(err);
      const slug = status === 404 ? 'not-found' : status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'bad-request';
      sendProblem(req, res, status, slug, TITLES[status] ?? 'Error', err.message);
    }
  };

const param = (req: AuthenticatedRequest, key: string) => String(req.params[key] ?? '');

export function catalogHandlers(mode: Mode) {
  const ctxOf = (req: AuthenticatedRequest): CatalogCtx => {
    const user = req.user!;
    if (mode === 'supplier' && !user.supplierId) {
      throw new CatalogError(403, 'This account is not linked to a supplier.', 'forbidden');
    }
    return {
      actor: { userId: user.userId, role: user.role },
      supplierScope: mode === 'supplier' ? user.supplierId! : null,
      correlationId: req.correlationId,
    };
  };

  /** Staff: the per-type key. Suppliers already passed supplier.catalog.manage at the router. */
  const can = (req: AuthenticatedRequest, adapter: CatalogAdapter<any>, action: Action) =>
    mode === 'supplier' ? adapter.supplierOwned : hasPermission({ userId: req.user!.userId, role: req.user!.role }, permissionFor(adapter, action));

  const need = (req: AuthenticatedRequest, type: string, action: Action) => {
    const adapter = adapterFor(type);
    if (!can(req, adapter, action)) {
      throw new CatalogError(403, 'Your account does not have permission to access this resource.', 'forbidden');
    }
    return adapter;
  };

  const sendWrite = (res: Response, result: WriteResult) => {
    res.set('ETag', `"${result.item.updatedAt}"`);
    res.status(result.approvalId ? 202 : 200).json({ ...result, queuedForApproval: !!result.approvalId });
  };

  const transition = (action: Transition) => handle((req, res) => {
    const type = param(req, 'type');
    need(req, type, action === 'publish' || action === 'hide' ? 'publish' : 'manage');
    const body = parseBody(action === 'archive' ? ReasonBody : TransitionBody, req.body);
    sendWrite(res, catalogService.transition(type, param(req, 'id'), action, body, parseIfMatch(req.header('if-match')), ctxOf(req)));
  });

  return {
    schema: handle((req, res) => {
      res.json(buildSchema(a => can(req, a, 'view')));
    }),
    summary: handle((req, res) => {
      res.json(catalogService.summary(ctxOf(req), a => can(req, a, 'view')));
    }),
    list: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'view');
      res.json(catalogService.list(type, req.query as Record<string, unknown>, ctxOf(req)));
    }),
    create: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'manage');
      const body = parseBody(CreateBody, req.body);
      const item = catalogService.create(type, body, ctxOf(req));
      res.set('ETag', `"${item.updatedAt}"`).status(201).json(item);
    }),
    bulk: handle((req, res) => {
      const type = param(req, 'type');
      const body = parseBody(BulkBody, req.body);
      need(req, type, body.action === 'publish' || body.action === 'hide' ? 'publish' : 'manage');
      res.json(catalogService.bulk(type, body, ctxOf(req)));
    }),
    get: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'view');
      const out = catalogService.get(type, param(req, 'id'), ctxOf(req));
      res.set('ETag', `"${out.item.updatedAt}"`).json(out);
    }),
    patch: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'manage');
      const body = parseBody(PatchBody, req.body);
      sendWrite(res, catalogService.patch(type, param(req, 'id'), body, parseIfMatch(req.header('if-match')), ctxOf(req)));
    }),
    remove: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'manage');
      const body = parseBody(ReasonBody, req.body);
      res.json(catalogService.remove(type, param(req, 'id'), body, parseIfMatch(req.header('if-match')), ctxOf(req)));
    }),
    publish: transition('publish'),
    hide: transition('hide'),
    archive: transition('archive'),
    restore: transition('restore'),
    duplicate: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'manage');
      res.status(201).json(catalogService.duplicate(type, param(req, 'id'), ctxOf(req)));
    }),
    getRates: handle((req, res) => {
      need(req, 'hotel', 'view');
      res.json(catalogService.getRates(param(req, 'id'), req.query as Record<string, unknown>, ctxOf(req)));
    }),
    putRates: handle((req, res) => {
      need(req, 'hotel', 'manage');
      const body = parseBody(RatesBody, req.body);
      const out = catalogService.putRates(param(req, 'id'), body, ctxOf(req));
      res.status(out.approvalId ? 202 : 200).json({ ...out, queuedForApproval: !!out.approvalId });
    }),
    getSlots: handle((req, res) => {
      need(req, 'activity', 'view');
      res.json(catalogService.childList('activity', param(req, 'id'), 'slots', req.query as Record<string, unknown>, ctxOf(req)));
    }),
    putSlots: handle((req, res) => {
      need(req, 'activity', 'manage');
      const body = parseBody(SlotsBody, req.body);
      res.json(catalogService.putSlots(param(req, 'id'), body, ctxOf(req)));
    }),
    childList: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'view');
      res.json(catalogService.childList(type, param(req, 'id'), param(req, 'child'), req.query as Record<string, unknown>, ctxOf(req)));
    }),
    childCreate: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'manage');
      const body = parseBody(ChildBody, req.body);
      res.status(201).json(catalogService.childCreate(type, param(req, 'id'), param(req, 'child'), body, ctxOf(req)));
    }),
    childPatch: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'manage');
      const body = parseBody(ChildBody, req.body);
      const out = catalogService.childPatch(type, param(req, 'id'), param(req, 'child'), param(req, 'childId'), body, ctxOf(req));
      res.status(out.approvalId ? 202 : 200).json({ ...out, queuedForApproval: !!out.approvalId });
    }),
    childDelete: handle((req, res) => {
      const type = param(req, 'type');
      need(req, type, 'manage');
      const body = parseBody(ReasonBody, req.body);
      res.json(catalogService.childDelete(type, param(req, 'id'), param(req, 'child'), param(req, 'childId'), body, ctxOf(req)));
    }),
  };
}

export const catalogRouter = Router();
const h = catalogHandlers('staff');

// Literal paths first: Express matches in order, and /:type/:id/:child would
// otherwise swallow publish/hide/... and the rate / slot calendars.
catalogRouter.get('/schema', h.schema);
catalogRouter.get('/summary', h.summary);
catalogRouter.get('/hotel/:id/rates', h.getRates);
catalogRouter.put('/hotel/:id/rates', h.putRates);
catalogRouter.get('/activity/:id/slots', h.getSlots);
catalogRouter.put('/activity/:id/slots', h.putSlots);
catalogRouter.get('/:type', h.list);
catalogRouter.post('/:type', h.create);
catalogRouter.post('/:type/bulk', h.bulk);
catalogRouter.get('/:type/:id', h.get);
catalogRouter.patch('/:type/:id', h.patch);
catalogRouter.delete('/:type/:id', h.remove);
catalogRouter.post('/:type/:id/publish', h.publish);
catalogRouter.post('/:type/:id/hide', h.hide);
catalogRouter.post('/:type/:id/archive', h.archive);
catalogRouter.post('/:type/:id/restore', h.restore);
catalogRouter.post('/:type/:id/duplicate', h.duplicate);
catalogRouter.get('/:type/:id/:child', h.childList);
catalogRouter.post('/:type/:id/:child', h.childCreate);
catalogRouter.patch('/:type/:id/:child/:childId', h.childPatch);
catalogRouter.delete('/:type/:id/:child/:childId', h.childDelete);
