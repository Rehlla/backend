import { Router } from 'express';
import { requirePermission } from '../middleware/rbacMiddleware';
import { catalogHandlers } from './catalogRoutes';
import { mediaUploadHandler } from './adminContentRoutes';
import type { AuthenticatedRequest } from '../middleware/correlationMiddleware';

/**
 * /api/supplier/catalog — the supplier portal's view of the catalogue
 * (docs/CATALOG_API_CONTRACT.md, "Endpoints (supplier portal)").
 *
 * Same handlers as /api/admin/catalog, in supplier mode: every read and write
 * is scoped to req.user.supplierId (another supplier's record is a 404), a
 * body supplierId is ignored, "publish" becomes status review plus an
 * approval (catalog.<type>.publish), and a price change above 30% is queued
 * as an approval (catalog.<type>.price). Transfer types have no owner and are
 * refused (403).
 */
export const supplierCatalogRouter = Router();
const h = catalogHandlers('supplier');

supplierCatalogRouter.use(requirePermission('supplier.catalog.manage'));

// Photo upload: same body/response as POST /api/admin/content/media/upload,
// category forced to 'supplier'. The supplier gets no other media-admin route.
supplierCatalogRouter.post('/media/upload', (req: AuthenticatedRequest, res) => {
  if (!req.user?.supplierId) {
    return res.status(403).json({ status: 'error', message: 'This account is not linked to a supplier.', correlationId: req.correlationId });
  }
  req.body = { ...(req.body || {}), category: 'supplier', tags: `supplier:${req.user.supplierId}` };
  return mediaUploadHandler(req, res);
});
supplierCatalogRouter.get('/schema', h.schema);
supplierCatalogRouter.get('/summary', h.summary);
supplierCatalogRouter.get('/hotel/:id/rates', h.getRates);
supplierCatalogRouter.put('/hotel/:id/rates', h.putRates);
supplierCatalogRouter.get('/activity/:id/slots', h.getSlots);
supplierCatalogRouter.put('/activity/:id/slots', h.putSlots);
supplierCatalogRouter.get('/:type', h.list);
supplierCatalogRouter.post('/:type', h.create);
supplierCatalogRouter.post('/:type/bulk', h.bulk);
supplierCatalogRouter.get('/:type/:id', h.get);
supplierCatalogRouter.patch('/:type/:id', h.patch);
supplierCatalogRouter.delete('/:type/:id', h.remove);
supplierCatalogRouter.post('/:type/:id/publish', h.publish);
supplierCatalogRouter.post('/:type/:id/hide', h.hide);
supplierCatalogRouter.post('/:type/:id/archive', h.archive);
supplierCatalogRouter.post('/:type/:id/restore', h.restore);
supplierCatalogRouter.post('/:type/:id/duplicate', h.duplicate);
supplierCatalogRouter.get('/:type/:id/:child', h.childList);
supplierCatalogRouter.post('/:type/:id/:child', h.childCreate);
supplierCatalogRouter.patch('/:type/:id/:child/:childId', h.childPatch);
supplierCatalogRouter.delete('/:type/:id/:child/:childId', h.childDelete);
