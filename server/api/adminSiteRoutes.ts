import { Router, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';

/**
 * Admin Site Routes — pricing and inventory controls.
 *
 * The legacy site-settings + visual-content routes used to live here, but
 * they edited a site_settings document that no public surface ever read
 * (write-only black hole). Their live-meaningful groups moved to the CMS:
 * hero/gallery → CMS content, footer links → CMS navigation, tagline/copyright
 * → UI strings, contact/social/hours → CMS Site Info (footer block). The
 * one-way legacy import lives in siteInfoService.importLegacySiteSettings().
 *
 * All routes require authentication + Operations or Admin role.
 */
export const adminSiteRouter = Router();

adminSiteRouter.use(requireAuth);
adminSiteRouter.use(requireRole('Operations', 'Admin'));

// ─── PRICING & INVENTORY ────────────────────────────────────────────────────

/**
 * GET /api/admin/pricing/skus
 * Returns all product SKUs with pricing and capacity info.
 */
adminSiteRouter.get('/pricing/skus', (req: AuthenticatedRequest, res: Response) => {
  try {
    const serviceType = req.query.serviceType as string | undefined;
    let skus = db.productSkus;
    if (serviceType) skus = skus.filter(s => s.serviceType === serviceType);

    const enriched = skus.map(sku => {
      const supplier = db.suppliers.find(s => s.id === sku.supplierId);
      const slotCount = db.inventorySlots.filter(sl => sl.skuId === sku.id).length;
      return {
        ...sku,
        supplierName: supplier?.businessName || 'Unknown',
        slotCount,
      };
    });

    res.json({
      status: 'success',
      count: enriched.length,
      skus: enriched,
      correlationId: req.correlationId,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

/**
 * PUT /api/admin/pricing/sku/:skuId
 * Updates a product SKU's price, capacity, or active status.
 */
adminSiteRouter.put('/pricing/sku/:skuId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const sku = db.productSkus.find(s => s.id === req.params.skuId);
    if (!sku) {
      return res.status(404).json({ status: 'error', message: 'SKU not found', correlationId: req.correlationId });
    }

    const { basePriceEGP, maxCapacityPerSlot, active, title, titleAr, description } = req.body;
    const before = { basePriceEGP: sku.basePriceEGP, maxCapacityPerSlot: sku.maxCapacityPerSlot, active: sku.active };

    if (typeof basePriceEGP === 'number' && basePriceEGP > 0) sku.basePriceEGP = Math.floor(basePriceEGP);
    if (typeof maxCapacityPerSlot === 'number' && maxCapacityPerSlot > 0) sku.maxCapacityPerSlot = Math.floor(maxCapacityPerSlot);
    if (typeof active === 'boolean') sku.active = active;
    if (typeof title === 'string') sku.title = title;
    if (typeof titleAr === 'string') sku.titleAr = titleAr;
    if (typeof description === 'string') sku.description = description;

    db.saveToDisk();
    db.logAudit(req.user!.userId, req.user!.role, 'UPDATE_SKU', 'product_sku', sku.id, { before, after: { basePriceEGP: sku.basePriceEGP, maxCapacityPerSlot: sku.maxCapacityPerSlot, active: sku.active } });

    res.json({ status: 'success', sku, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

/**
 * GET /api/admin/pricing/inventory
 * Returns inventory slots for a SKU within a date range.
 */
adminSiteRouter.get('/pricing/inventory', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { skuId, startDate, endDate } = req.query;
    if (!skuId) {
      return res.status(400).json({ status: 'error', message: 'skuId is required', correlationId: req.correlationId });
    }

    let slots = db.inventorySlots.filter(s => s.skuId === skuId);
    if (startDate) slots = slots.filter(s => s.date >= (startDate as string));
    if (endDate) slots = slots.filter(s => s.date <= (endDate as string));

    slots.sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));

    res.json({ status: 'success', count: slots.length, slots, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});

/**
 * PUT /api/admin/pricing/inventory/:slotId
 * Updates an inventory slot's price or capacity.
 */
adminSiteRouter.put('/pricing/inventory/:slotId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const slot = db.inventorySlots.find(s => s.id === req.params.slotId);
    if (!slot) {
      return res.status(404).json({ status: 'error', message: 'Slot not found', correlationId: req.correlationId });
    }

    const { priceEGP, totalCapacity } = req.body;
    const before = { priceEGP: slot.priceEGP, totalCapacity: slot.totalCapacity };

    if (typeof priceEGP === 'number' && priceEGP > 0) slot.priceEGP = Math.floor(priceEGP);
    if (typeof totalCapacity === 'number' && totalCapacity > 0) {
      const newCap = Math.floor(totalCapacity);
      if (newCap < slot.reservedCapacity) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot reduce capacity below ${slot.reservedCapacity} (reserved)`,
          correlationId: req.correlationId,
        });
      }
      slot.totalCapacity = newCap;
    }

    // Recompute status
    const remaining = slot.totalCapacity - slot.reservedCapacity - slot.heldCapacity;
    slot.status = remaining <= 0 ? 'SOLD_OUT' : remaining <= Math.ceil(slot.totalCapacity * 0.2) ? 'ALMOST_FULL' : 'AVAILABLE';

    db.saveToDisk();
    db.logAudit(req.user!.userId, req.user!.role, 'UPDATE_INVENTORY_SLOT', 'inventory_slot', slot.id, { before, after: { priceEGP: slot.priceEGP, totalCapacity: slot.totalCapacity } });

    res.json({ status: 'success', slot, correlationId: req.correlationId });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message, correlationId: req.correlationId });
  }
});
