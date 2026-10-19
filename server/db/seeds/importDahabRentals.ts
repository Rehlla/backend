import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import {
  RentalExtraEntity,
  RentalListingEntity,
  SupplierEntity
} from '../schema';

export interface ImportRentalsResult {
  success: boolean;
  importedAt: string;
  rentalsCount: number;
  rentalsCreated: number;
  rentalsUpdated: number;
  suppliersCreated: number;
  skusCreated: number;
  extrasCreated: number;
  durationMs: number;
  summary: string;
}

const nowIso = () => new Date().toISOString();

/**
 * Idempotent import of the Dahab rentals catalogue.
 *
 * Reads the committed data/dahab_rentals.json (boot-critical: THROWS when
 * missing, exactly like importDahabHotels) and upserts four things per listing
 * inside one transaction:
 *
 *   1. A `bike_rental`-category supplier (SUP-BIKE-01/02) carrying only public
 *      catalogue facts. Contact fields are left unset — the directory does not
 *      publish phone/WhatsApp numbers, and inventing them would route real
 *      travelers to wrong numbers.
 *   2. A serviceType 'rental' ProductSkuEntity (SKU-REN-001..006) with
 *      basePriceEGP = dailyRateEGP and maxCapacityPerSlot = fleet quantity, so
 *      the standard commerce engine (bookability, inventory views) understands
 *      the vertical without any rental-specific plumbing.
 *   3. A RentalListingEntity row (catalogue copy, pricing config, delivery
 *      zones, policies).
 *   4. Its RentalExtraEntity rows.
 *
 * Inventory day-slots are deliberately NOT pre-seeded — the rental domain
 * materialises them on hold, exactly like the hotels vertical.
 */
export function importDahabRentals(): ImportRentalsResult {
  const startTime = Date.now();
  let rentalsCreated = 0;
  let rentalsUpdated = 0;
  let suppliersCreated = 0;
  let skusCreated = 0;
  let extrasCreated = 0;

  const result = db.runInTransaction(() => {
    const datasetPath = seedPath('dahab_rentals.json');
    if (!fs.existsSync(datasetPath)) {
      throw new Error(
        `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the rentals catalogue.`
      );
    }

    let rawData: any = null;
    try {
      rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    } catch (err: any) {
      throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
    }

    const catalogue = (rawData?.rentals || []) as Array<Record<string, any>>;

    // De-duplicate slugs and ids defensively: boot must not silently pick one.
    const seenSlugs = new Set<string>();
    const seenIds = new Set<string>();
    for (const rental of catalogue) {
      if (!rental.slug || !rental.id || !rental.skuId) {
        throw new Error('Catalogue contains a rental missing slug, id or skuId.');
      }
      if (seenSlugs.has(rental.slug)) throw new Error(`Duplicate rental slug: ${rental.slug}.`);
      if (seenIds.has(rental.id)) throw new Error(`Duplicate rental id: ${rental.id}.`);
      seenSlugs.add(rental.slug);
      seenIds.add(rental.id);
    }

    // 1. Suppliers (upsert by id).
    const suppliers = (rawData?.suppliers || []) as Array<Record<string, any>>;
    for (const entry of suppliers) {
      const supplierId = entry.id as string;
      if (!supplierId) throw new Error('Catalogue contains a supplier missing id.');
      let supplier = db.suppliers.find(s => s.id === supplierId);
      if (!supplier) {
        const record: SupplierEntity = {
          id: supplierId,
          businessName: entry.businessName as string,
          businessNameAr: entry.businessNameAr as string,
          category: entry.category || 'bike_rental',
          serviceTypes: entry.serviceTypes || ['rental'],
          tier: entry.tier || 'Vetted Local Partner',
          status: entry.status || 'Active',
          area: entry.area as string,
          address: entry.address as string,
          city: entry.city || 'Dahab',
          country: entry.country || 'Egypt',
          rating: Number(entry.rating),
          reviewCount: Number(entry.reviewCount),
          metadata: entry.metadata || { source: 'data/dahab_rentals.json' }
        };
        db.suppliers.push(record);
        suppliersCreated += 1;
      }
    }

    catalogue.forEach((entry) => {
      const skuId = entry.skuId as string;
      const supplierId = entry.supplierId as string;
      const dailyRate = Number(entry.dailyRateEGP);
      const quantity = Number(entry.quantity);

      // 2. 'rental' SKU (upsert by id).
      let sku = db.productSkus.find(s => s.id === skuId);
      if (!sku) {
        sku = {
          id: skuId,
          supplierId,
          serviceType: 'rental',
          title: entry.name as string,
          titleAr: entry.nameAr as string,
          description: entry.description as string,
          durationMinutes: 1440,
          basePriceEGP: dailyRate,
          currency: 'EGP',
          maxCapacityPerSlot: quantity,
          active: true,
          includedItems: (entry.features || []).slice(0, 4),
          cancellationPolicyHours: Number(entry.cancellationPolicyHours || 24)
        };
        db.productSkus.push(sku);
        skusCreated += 1;
      }

      // 3. Rental listing row (upsert by id).
      const existing = db.rentalListings.find(l => l.id === entry.id);
      const listing: RentalListingEntity = {
        id: entry.id as string,
        slug: entry.slug as string,
        supplierId,
        skuId,
        category: entry.category,
        subcategory: entry.subcategory as string,
        name: entry.name as string,
        nameAr: entry.nameAr as string,
        tagline: entry.tagline as string,
        taglineAr: entry.taglineAr as string,
        description: entry.description as string,
        descriptionAr: entry.descriptionAr as string,
        features: entry.features || [],
        featuresAr: entry.featuresAr || [],
        specs: entry.specs || {},
        images: entry.images || [],
        quantity,
        dailyRateEGP: dailyRate,
        weeklyRateEGP: entry.weeklyRateEGP != null ? Number(entry.weeklyRateEGP) : undefined,
        multiDayMinDays: entry.multiDayMinDays != null ? Number(entry.multiDayMinDays) : undefined,
        multiDayDiscountPercent: entry.multiDayDiscountPercent != null ? Number(entry.multiDayDiscountPercent) : undefined,
        depositEGP: Number(entry.depositEGP || 0),
        pickupZoneId: entry.pickupZoneId as string,
        deliveryZones: entry.deliveryZones || [],
        pickupMode: entry.pickupMode || 'SHOP',
        rating: entry.rating != null ? Number(entry.rating) : undefined,
        reviewCount: entry.reviewCount != null ? Number(entry.reviewCount) : undefined,
        featured: entry.featured === true,
        status: 'APPROVED',
        active: entry.active !== false,
        cancellationPolicyHours: Number(entry.cancellationPolicyHours || 24),
        policies: entry.policies || { en: '', ar: '' },
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso()
      };

      if (existing) {
        const indexInStore = db.rentalListings.indexOf(existing);
        db.rentalListings[indexInStore] = listing;
        rentalsUpdated += 1;
      } else {
        db.rentalListings.push(listing);
        rentalsCreated += 1;
      }

      // 4. Extras (upsert by id, scoped to this listing).
      for (const extra of (entry.extras || []) as Array<Record<string, any>>) {
        if (!extra.id) throw new Error(`Listing ${entry.id} has an extra missing id.`);
        // Extras are owned by one listing; the catalogue reuses friendly ids
        // (EXT-HLMT, EXT-LOCK...) across listings, so the stored id is
        // namespaced by listing to keep the table's PRIMARY KEY unique.
        const extraId = `${listing.id}-${extra.id}`;
        const extraRecord: RentalExtraEntity = {
          id: extraId,
          listingId: listing.id,
          name: extra.name as string,
          nameAr: extra.nameAr as string,
          priceEGP: Number(extra.priceEGP),
          pricingBasis: extra.pricingBasis === 'PER_DAY' ? 'PER_DAY' : 'FLAT',
          active: true
        };
        const existingExtra = db.rentalExtras.find(e => e.id === extraId);
        if (existingExtra) {
          const extraIndex = db.rentalExtras.indexOf(existingExtra);
          db.rentalExtras[extraIndex] = extraRecord;
        } else {
          db.rentalExtras.push(extraRecord);
          extrasCreated += 1;
        }
      }
    });

    return {
      success: true,
      importedAt: nowIso(),
      rentalsCount: catalogue.length,
      rentalsCreated,
      rentalsUpdated,
      suppliersCreated,
      skusCreated,
      extrasCreated,
      durationMs: Date.now() - startTime,
      summary:
        `Rentals catalogue imported: ${catalogue.length} listings ` +
        `(${rentalsCreated} created, ${rentalsUpdated} updated), ` +
        `${suppliersCreated} suppliers, ${skusCreated} SKUs, ${extrasCreated} extras.`
    };
  });

  return result;
}

/** Convenience guard so callers can cheaply confirm the store is rentals-aware. */
export function hasRentalsCatalogue(): boolean {
  return db.rentalListings.length > 0;
}