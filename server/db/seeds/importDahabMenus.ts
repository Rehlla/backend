import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import { DELIVERY_ZONE_IDS, findDeliveryZone } from '../../data/deliveryZones';
import {
  DiningMenuItemCategory,
  DiningMenuItemEntity,
  DiningVenueDeliveryPolicy,
  DiningVenueDeliveryZone,
  DiningVenueEntity,
  ProductSkuEntity,
  SupplierEntity
} from '../schema';

/**
 * Converge data/dahab_menus.json into the dining collections.
 *
 * Without this there is no way to order food: the dining corpus carried venues
 * with an average meal price and an opening-hours string, but no dishes, no
 * prices and no delivery policy — so a "delivery" could not be quoted, priced
 * or stored, only described.
 *
 * It also fixes a real dangling reference. Every curated venue in
 * dkosExpansionDataPart2.ts named a supplierId ('SUP-ALIBABA') that does not
 * exist, so joining a venue to its supplier returned nothing and
 * catalogIntegrity's supplier resolution (catalogIntegrity.ts:164) could never
 * pass for a dining SKU built on top. Each venue gets its own supplier record
 * here, and the venue's own supplierId is corrected to it.
 *
 * That supplier also gives every venue a 'dining' ProductSku, which is what
 * makes a TABLE booking work today: the existing hold/checkout spine already
 * accepts serviceType 'dining' (bodyParams SERVICE_TYPES), so a reservation
 * settles through /api/commerce/checkout/multi with no new commerce code.
 *
 * Idempotent and safe to re-run: suppliers and SKUs are create-if-absent (the
 * seed never overwrites operator edits to the directory), menu items and venue
 * fields are upserted, and items belonging to a venue that has left the
 * catalogue are removed so a re-import cannot leave ghosts.
 */

const nowIso = () => new Date().toISOString();

export interface ImportMenusResult {
  success: boolean;
  importedAt: string;
  venueCount: number;
  itemsTotal: number;
  suppliersCreated: number;
  skusCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsRemoved: number;
  venuesWithDelivery: number;
  durationMs: number;
  summary: string;
}

const VALID_CATEGORIES: readonly DiningMenuItemCategory[] = [
  'breakfast',
  'mains',
  'grill',
  'seafood',
  'street_food',
  'bakery',
  'desserts',
  'drinks'
];

function isCategory(value: unknown): value is DiningMenuItemCategory {
  return typeof value === 'string' && (VALID_CATEGORIES as readonly string[]).includes(value);
}

function positiveAmount(value: unknown, what: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${what} must be a positive EGP amount, got ${String(value)}.`);
  }
  return Math.round(n * 100) / 100;
}

function nonNegativeAmount(value: unknown, what: string): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${what} must be zero or a positive EGP amount, got ${String(value)}.`);
  }
  return Math.round(n * 100) / 100;
}

/** The delivery zones a venue claims, validated against the app's geography. */
function readZones(value: unknown, venueId: string): DiningVenueDeliveryZone[] {
  const raw = Array.isArray(value) ? value : [];
  const zones: DiningVenueDeliveryZone[] = [];
  const seen = new Set<string>();

  for (const entry of raw as Array<Record<string, unknown>>) {
    const zoneId = String(entry?.zoneId || '');
    if (!zoneId) throw new Error(`${venueId} declares a delivery zone with no zoneId.`);
    // A typo here would be invisible until a traveler ordered into it and the
    // order was refused at the last step, so it is a boot failure instead.
    if (!DELIVERY_ZONE_IDS.includes(zoneId)) {
      throw new Error(`${venueId} declares unknown delivery zone '${zoneId}'.`);
    }
    if (seen.has(zoneId)) throw new Error(`${venueId} declares delivery zone '${zoneId}' twice.`);
    seen.add(zoneId);

    zones.push({
      zoneId,
      feeEGP: nonNegativeAmount(entry.feeEGP, `${venueId}/${zoneId} delivery fee`),
      etaMinutes: Math.max(0, Math.round(Number(entry.etaMinutes ?? 15)))
    });
  }

  return zones;
}

export function importDahabMenus(): ImportMenusResult {
  const startTime = Date.now();
  let suppliersCreated = 0;
  let skusCreated = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let itemsRemoved = 0;
  let venuesWithDelivery = 0;

  const result = db.runInTransaction(() => {
    const datasetPath = seedPath('dahab_menus.json');
    if (!fs.existsSync(datasetPath)) {
      throw new Error(
        `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the dining menu.`
      );
    }

    let rawData: any = null;
    try {
      rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    } catch (err: any) {
      throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
    }

    const menus = (rawData?.menus || []) as Array<Record<string, any>>;
    if (menus.length === 0) {
      throw new Error(`${datasetPath} contains no menus; refusing to seed an empty dining catalogue.`);
    }

    // Validate the whole file before touching a single row: a half-applied
    // catalogue (venues with no dishes, or a menu priced in the wrong currency)
    // is worse than a boot that failed loudly.
    const seenVenueIds = new Set<string>();
    const seenSlugs = new Set<string>();
    const seenItemIds = new Set<string>();
    const keptVenueIds = new Set<string>();

    for (const entry of menus) {
      const venueId = String(entry.venueId || '');
      const slug = String(entry.slug || '');
      if (!venueId) throw new Error('Catalogue contains a venue missing venueId.');
      if (!slug) throw new Error(`Catalogue venue ${venueId} is missing a slug (the detail page URL).`);
      if (seenVenueIds.has(venueId)) throw new Error(`Duplicate venueId: ${venueId}.`);
      if (seenSlugs.has(slug)) throw new Error(`Duplicate venue slug: ${slug}.`);
      seenVenueIds.add(venueId);
      seenSlugs.add(slug);
      keptVenueIds.add(venueId);

      const venue = db.diningVenues.find(v => v.id === venueId);
      if (!venue) {
        throw new Error(
          `Catalogue venue ${venueId} has no matching row in db.diningVenues. ` +
            'The menu seed enriches curated venues; it does not create them.'
        );
      }

      const items = (entry.items || []) as Array<Record<string, any>>;
      if (items.length === 0) throw new Error(`Venue ${venueId} has no menu items.`);
      for (const item of items) {
        const itemId = String(item.id || '');
        if (!itemId) throw new Error(`Venue ${venueId} has a menu item missing id.`);
        if (seenItemIds.has(itemId)) throw new Error(`Duplicate menu item id: ${itemId}.`);
        if (!item.nameEn || !item.nameAr) {
          throw new Error(`Menu item ${itemId} must carry both nameEn and nameAr.`);
        }
        if (!isCategory(item.category)) {
          throw new Error(
            `Menu item ${itemId} has an unknown category '${String(item.category)}'. ` +
              `Valid: ${VALID_CATEGORIES.join(', ')}.`
          );
        }
        seenItemIds.add(itemId);
      }

      // Delivery policy: acceptsDelivery true with no zone is a promise the
      // server cannot keep, so it is a boot failure rather than a silent
      // walk-in-only fallback.
      const zones = readZones(entry.delivery?.zones, venueId);
      const acceptsDelivery = Boolean(entry.delivery?.acceptsDelivery);
      if (acceptsDelivery && zones.length === 0) {
        throw new Error(`Venue ${venueId} acceptsDelivery but declares no delivery zones.`);
      }
      if (!acceptsDelivery && zones.length > 0) {
        throw new Error(`Venue ${venueId} is pickup-only but declares delivery zones.`);
      }
    }

    const stamp = nowIso();

    for (const entry of menus) {
      const venueId = String(entry.venueId);
      const slug = String(entry.slug);
      const venue = db.diningVenues.find(v => v.id === venueId)!;
      const supplierRow = (entry.supplier || {}) as Record<string, any>;
      const bookingRow = (entry.tableBooking || {}) as Record<string, any>;
      const deliveryRow = (entry.delivery || {}) as Record<string, any>;

      // 1. Supplier — create-if-absent, so an operator's edits to the directory
      //    survive a re-import.
      const supplierId = String(supplierRow.id || '');
      if (!supplierId) throw new Error(`Venue ${venueId} is missing a supplier id.`);
      if (!db.suppliers.find(s => s.id === supplierId)) {
        const supplier: SupplierEntity = {
          id: supplierId,
          businessName: supplierRow.businessName || venue.nameEn,
          businessNameAr: supplierRow.businessNameAr || venue.nameAr,
          category: 'restaurant',
          serviceTypes: ['dining'],
          tier: 'Vetted Local Partner',
          status: 'Active',
          area: supplierRow.area || venue.areaName || venue.areaId,
          phone: supplierRow.phone || '',
          email: supplierRow.email || '',
          city: 'Dahab',
          country: 'Egypt',
          metadata: { source: 'data/dahab_menus.json', venueId }
        };
        db.suppliers.push(supplier);
        suppliersCreated += 1;
      }

      // 2. 'dining' SKU for the table booking — the existing hold/checkout spine
      //    settles this with no new commerce code.
      const skuId = String(bookingRow.skuId || '');
      if (!skuId) throw new Error(`Venue ${venueId} is missing its table-booking skuId.`);
      if (!db.productSkus.find(s => s.id === skuId)) {
        const timeSlots = (bookingRow.timeSlots || []).map(String);
        if (timeSlots.length === 0) {
          throw new Error(`Venue ${venueId} has a table SKU with no timeSlots; availability cannot be quoted.`);
        }
        const sku: ProductSkuEntity = {
          id: skuId,
          supplierId,
          serviceType: 'dining',
          title: bookingRow.title || `${venue.nameEn} table`,
          titleAr: bookingRow.titleAr || `${venue.nameAr} - طاولة`,
          description: bookingRow.description || 'Table reservation.',
          descriptionAr: bookingRow.descriptionAr || 'حجز طاولة.',
          durationMinutes: 120,
          basePriceEGP: positiveAmount(bookingRow.basePriceEGP, `${venueId} table minimum`),
          currency: 'EGP',
          // Seats per sitting, not dish capacity: this SKU sells a table.
          maxCapacityPerSlot: Math.max(1, Math.round(Number(bookingRow.maxCapacityPerSlot ?? 10))),
          active: true,
          timeSlots,
          cancellationPolicyHours: Math.max(0, Math.round(Number(bookingRow.cancellationPolicyHours ?? 2)))
        };
        db.productSkus.push(sku);
        skusCreated += 1;
      }

      // 3. Venue fields: slug (the detail URL), the corrected supplierId, the
      //    delivery policy and the kitchen's baseline prep time.
      const acceptsDelivery = Boolean(deliveryRow.acceptsDelivery);
      const deliveryPolicy: DiningVenueDeliveryPolicy = {
        acceptsDelivery,
        minOrderEGP: nonNegativeAmount(deliveryRow.minOrderEGP, `${venueId} minimum order`),
        serviceFeePercent: nonNegativeAmount(deliveryRow.serviceFeePercent, `${venueId} service fee`),
        zones: zonesOf(deliveryRow)
      };

      const indexInStore = db.diningVenues.indexOf(venue);
      db.diningVenues[indexInStore] = {
        ...venue,
        slug,
        supplierId,
        delivery: deliveryPolicy,
        prepMinutes: Math.max(0, Math.round(Number(deliveryRow.prepMinutes ?? 20)))
      };
      if (acceptsDelivery) venuesWithDelivery += 1;

      // 4. Menu items — upsert. Prices and availability are authoritative from
      //    the catalogue: an operator changing a price in the CMS must not
      //    silently diverge from what the seed says the dish costs.
      for (const item of (entry.items || []) as Array<Record<string, any>>) {
        const itemId = String(item.id);
        const record: DiningMenuItemEntity = {
          id: itemId,
          venueId,
          nameEn: String(item.nameEn),
          nameAr: String(item.nameAr),
          category: item.category as DiningMenuItemCategory,
          descriptionEn: item.descriptionEn || undefined,
          descriptionAr: item.descriptionAr || undefined,
          priceEGP: positiveAmount(item.priceEGP, `Menu item ${itemId} price`),
          dietary: Array.isArray(item.dietary) ? (item.dietary as DiningMenuItemEntity['dietary']) : [],
          available: item.available !== false,
          prepMinutes: item.prepMinutes === undefined ? undefined : Math.max(0, Math.round(Number(item.prepMinutes))),
          sortOrder: Math.round(Number(item.sortOrder ?? 999))
        };

        const existing = db.diningMenuItems.find(m => m.id === itemId);
        if (existing) {
          db.diningMenuItems[db.diningMenuItems.indexOf(existing)] = record;
          itemsUpdated += 1;
        } else {
          db.diningMenuItems.push(record);
          itemsCreated += 1;
        }
      }
    }

    // 5. Remove dishes belonging to a venue that has left the catalogue. A
    //    removed dish that keeps its row would still be sellable.
    const stale = db.diningMenuItems.filter(m => !seenItemIds.has(m.id));
    if (stale.length > 0) {
      const staleIds = new Set(stale.map(m => m.id));
      const kept = db.diningMenuItems.filter(m => !staleIds.has(m.id));
      // The collection is exposed through a getter over DatabaseState, so it is
      // replaced in place rather than reassigned.
      db.diningMenuItems.splice(0, db.diningMenuItems.length, ...kept);
      itemsRemoved = stale.length;
    }

    const itemsTotal = db.diningMenuItems.length;
    const summary =
      `Dining menus imported: ${menus.length} venues, ${itemsTotal} items ` +
      `(${itemsCreated} created, ${itemsUpdated} updated, ${itemsRemoved} removed), ` +
      `${suppliersCreated} suppliers, ${skusCreated} table SKUs, ` +
      `${venuesWithDelivery} venues delivering.`;

    return {
      success: true,
      importedAt: stamp,
      venueCount: menus.length,
      itemsTotal,
      suppliersCreated,
      skusCreated,
      itemsCreated,
      itemsUpdated,
      itemsRemoved,
      venuesWithDelivery,
      durationMs: Date.now() - startTime,
      summary
    };
  });

  return result;
}

/** Convenience guard so callers can cheaply confirm the store is orderable. */
export function hasDiningMenus(): boolean {
  return db.diningMenuItems.length > 0;
}

/** True when the venue's own delivery policy covers the zone. */
export function venueDeliversTo(venue: DiningVenueEntity, zoneId: string): boolean {
  return Boolean(venue.delivery?.acceptsDelivery && venue.delivery.zones.some(z => z.zoneId === zoneId));
}

/**
 * The zone a venue charges for. Fee and ETA are the VENUE's, never derived from
 * the zone: two kitchens in the same neighbourhood quote different drops.
 */
export function deliveryZoneFor(venue: DiningVenueEntity, zoneId: string): DiningVenueDeliveryZone | undefined {
  if (!venue.delivery?.acceptsDelivery) return undefined;
  if (!findDeliveryZone(zoneId)) return undefined;
  return venue.delivery.zones.find(z => z.zoneId === zoneId);
}

/** Raw zones already validated by readZones during the import. */
function zonesOf(deliveryRow: Record<string, any>): DiningVenueDeliveryZone[] {
  return (deliveryRow.zones || []) as DiningVenueDeliveryZone[];
}