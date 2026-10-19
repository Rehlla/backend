import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import { HotelEntity, SupplierEntity } from '../schema';

export interface ImportHotelsResult {
  success: boolean;
  importedAt: string;
  hotelsCount: number;
  hotelsCreated: number;
  hotelsUpdated: number;
  suppliersCreated: number;
  skusCreated: number;
  durationMs: number;
  summary: string;
}

/** Hotel id (HTL-NN) -> supplier id (SUP-HTL-NN+1), starting after the seed fixture SUP-HTL-01. */
const supplierIdFor = (hotelIndexInCatalogue: number) =>
  `SUP-HTL-${String(hotelIndexInCatalogue + 2).padStart(2, '0')}`;

/** Hotel id (HTL-NN) -> package SKU id, starting after the seed fixtures SKU-HTL-001/002. */
const skuIdFor = (hotelIndexInCatalogue: number) =>
  `SKU-HTL-${String(hotelIndexInCatalogue + 3).padStart(3, '0')}`;

const nowIso = () => new Date().toISOString();

/**
 * Idempotent import of the Dahab hotels catalogue.
 *
 * Reads the committed data/dahab_hotels.json (boot-critical: THROWS when
 * missing, exactly like importDahabLocalCommerce) and upserts three things per
 * hotel inside one transaction:
 *
 *   1. A `hotel`-category supplier (SUP-HTL-02..14) carrying only the public
 *      catalogue facts. Contact fields are intentionally left unset — the
 *      directory does not publish per-property phone/email, and inventing them
 *      would route real travelers to wrong numbers. Booking CTAs go through
 *      the platform concierge instead.
 *   2. A 5-night package ProductSkuEntity (SKU-HTL-003..015, serviceType
 *      'hotel', basePriceEGP = perNightEGP x packageNights). Existing fixtures
 *      SKU-HTL-001/002 (SUP-HTL-01) are left untouched.
 *   3. A HotelEntity row linking the catalogue copy to that skuId.
 *
 * Inventory slots are deliberately NOT pre-seeded. 'hotel' is already a
 * supported CommerceServiceType: checkAvailability projects 'Standard Check-in
 * 14:00' slots for any requested date without persisting them, and createHold
 * materialises a real slot only when a traveler actually books. Pre-seeding a
 * fixed 7-day window would commit dates that go stale and are never pruned.
 */
export function importDahabHotels(): ImportHotelsResult {
  const startTime = Date.now();
  let hotelsCreated = 0;
  let hotelsUpdated = 0;
  let suppliersCreated = 0;
  let skusCreated = 0;

  const result = db.runInTransaction(() => {
    const datasetPath = seedPath('dahab_hotels.json');
    if (!fs.existsSync(datasetPath)) {
      throw new Error(
        `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the hotels catalogue.`
      );
    }

    let rawData: any = null;
    try {
      rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    } catch (err: any) {
      throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
    }

    const catalogue = (rawData?.hotels || []) as Array<Record<string, any>>;

    // De-duplicate slugs and ids defensively: boot must not silently pick one.
    const seenSlugs = new Set<string>();
    const seenIds = new Set<string>();
    for (const hotel of catalogue) {
      if (!hotel.slug || !hotel.id) {
        throw new Error('Catalogue contains a hotel missing slug or id.');
      }
      if (seenSlugs.has(hotel.slug)) throw new Error(`Duplicate hotel slug: ${hotel.slug}.`);
      if (seenIds.has(hotel.id)) throw new Error(`Duplicate hotel id: ${hotel.id}.`);
      seenSlugs.add(hotel.slug);
      seenIds.add(hotel.id);
    }

    const hotelRows: HotelEntity[] = [];

    catalogue.forEach((entry, index) => {
      const skuId = skuIdFor(index);
      const supplierId = supplierIdFor(index);
      const packagePriceEGP = Number(entry.perNightEGP) * Number(entry.packageNights || 5);

      // 1. Supplier (upsert by id).
      let supplier = db.suppliers.find(s => s.id === supplierId);
      if (!supplier) {
        supplier = {
          id: supplierId,
          businessName: entry.name as string,
          businessNameAr: entry.nameAr as string,
          category: 'hotel',
          businessType: `Directory hotel — ${(entry.category || '').toUpperCase()}`,
          tier: 'Vetted Local Partner',
          status: 'Active',
          serviceTypes: ['hotel'],
          area: entry.area as string,
          address: entry.areaName as string,
          city: 'Dahab',
          country: 'Egypt',
          latitude: entry.coordinates?.[0],
          longitude: entry.coordinates?.[1],
          coordinates: entry.coordinates
            ? { lat: entry.coordinates[0], lng: entry.coordinates[1] }
            : undefined,
          rating: entry.rating as number,
          reviewCount: entry.reviewCount as number,
          metadata: { source: 'data/dahab_hotels.json', category: entry.category, priceBand: entry.priceBand, ratingSource: entry.ratingSource }
        };
        db.suppliers.push(supplier);
        suppliersCreated += 1;
      }

      // 2. 5-night package SKU (upsert by id).
      const skuTitleEn = `${entry.name} — 5-Night Standard Double (${Number(entry.packageNights || 5)} Nights)`;
      const skuTitleAr = `${entry.nameAr} — غرفة مزدوجة قياسية (${Number(entry.packageNights || 5)} ليالٍ)`;
      let sku = db.productSkus.find(s => s.id === skuId);
      if (!sku) {
        sku = {
          id: skuId,
          supplierId,
          serviceType: 'hotel',
          title: skuTitleEn,
          titleAr: skuTitleAr,
          description: `${entry.description}\n${entry.note}`,
          routeFrom: entry.areaName as string,
          routeTo: entry.name as string,
          durationMinutes: Number(entry.packageNights || 5) * 1440,
          basePriceEGP: packagePriceEGP,
          currency: 'EGP',
          maxCapacityPerSlot: 10,
          active: true,
          includedItems: [
            `${Number(entry.packageNights || 5)} Nights Standard Double Room`,
            'Hotel taxes & fees',
            `Amenities: ${(entry.amenities || []).join(', ')}`
          ].slice(0, 3),
          cancellationPolicyHours: 48
        };
        db.productSkus.push(sku);
        skusCreated += 1;
      }

      // 3. Hotel catalogue row (upsert by id).
      const existing = db.hotels.find(h => h.id === entry.id);
      const hotelRecord: HotelEntity = {
        id: entry.id as string,
        slug: entry.slug as string,
        name: entry.name as string,
        nameAr: entry.nameAr as string,
        category: entry.category,
        priceBand: entry.priceBand,
        area: entry.area as string,
        areaName: entry.areaName as string,
        areaNameAr: entry.areaNameAr as string,
        rating: Number(entry.rating),
        reviewCount: Number(entry.reviewCount),
        ratingSource: entry.ratingSource,
        typeChips: entry.typeChips || [],
        typeChipsAr: entry.typeChipsAr || [],
        tagline: entry.tagline as string,
        taglineAr: entry.taglineAr as string,
        description: entry.description as string,
        descriptionAr: entry.descriptionAr as string,
        amenities: entry.amenities || [],
        amenitiesAr: entry.amenitiesAr || [],
        perNightEGP: Number(entry.perNightEGP),
        packageNights: Number(entry.packageNights || 5),
        rooms: Number(entry.rooms || 0),
        bestFor: entry.bestFor as string,
        bestForAr: entry.bestForAr as string,
        note: entry.note as string,
        noteAr: entry.noteAr as string,
        coordinates: entry.coordinates as [number, number] | undefined,
        skuId,
        active: entry.active !== false,
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso()
      };

      if (existing) {
        const indexInStore = db.hotels.indexOf(existing);
        db.hotels[indexInStore] = hotelRecord;
        hotelsUpdated += 1;
      } else {
        db.hotels.push(hotelRecord);
        hotelsCreated += 1;
      }

      hotelRows.push(hotelRecord);
    });

    return {
      success: true,
      importedAt: nowIso(),
      hotelsCount: hotelRows.length,
      hotelsCreated,
      hotelsUpdated,
      suppliersCreated,
      skusCreated,
      durationMs: Date.now() - startTime,
      summary:
        `Hotels catalogue imported: ${hotelRows.length} hotels ` +
        `(${hotelsCreated} created, ${hotelsUpdated} updated), ` +
        `${suppliersCreated} suppliers, ${skusCreated} SKUs.`
    };
  });

  return result;
}

/** Convenience guard so callers can cheaply confirm the store is hotel-aware. */
export function hasHotelsCatalogue(): boolean {
  return db.hotels.length > 0;
}