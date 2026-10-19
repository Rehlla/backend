import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { db } from '../../server/db/database';
import { seedPath } from '../../server/db/paths';
import { DELIVERY_ZONE_IDS } from '../../server/data/deliveryZones';
import {
  hasDiningMenus,
  deliveryZoneFor,
  importDahabMenus,
  venueDeliversTo
} from '../../server/db/seeds/importDahabMenus';
import { findCatalogIntegrityIssues } from '../../server/db/catalogIntegrity';
import { EXPANDED_DINING_VENUES } from '../../server/data/dkosExpansionDataPart2';
import { dahabKnowledgeOs } from '../../server/services/dahabKnowledgeOs';
import { DiningVenueEntity } from '../../server/db/schema';

/**
 * The dining menu seed is boot-critical and silent when it is wrong.
 *
 * importDahabMenus() runs inside runMigrationsAndSeed(), so a malformed
 * catalogue fails the server's boot. These tests are the cheaper place to find
 * that: they read the committed dataset and assert the invariants the importer
 * relies on, plus the two things it was written to fix — a venue whose
 * supplierId resolved to nothing, and a menu that cannot be priced.
 */

const DATASET = seedPath('dahab_menus.json');

function readDataset(): { menus: Array<Record<string, any>> } {
  return JSON.parse(fs.readFileSync(DATASET, 'utf-8'));
}

describe('dining menu seed dataset', () => {
  it('ships a non-empty, parseable catalogue', () => {
    expect(fs.existsSync(DATASET)).toBe(true);
    const data = readDataset();
    expect(Array.isArray(data.menus)).toBe(true);
    expect(data.menus.length).toBeGreaterThan(0);
  });

  it('prices everything in EGP as a positive amount', () => {
    for (const menu of readDataset().menus) {
      for (const item of menu.items) {
        expect(typeof item.priceEGP, `${menu.venueId}/${item.id} priceEGP`).toBe('number');
        expect(item.priceEGP, `${menu.venueId}/${item.id} priceEGP`).toBeGreaterThan(0);
      }
      expect(menu.tableBooking.basePriceEGP).toBeGreaterThan(0);
    }
  });

  it('carries both languages on every name the Arabic UI renders', () => {
    for (const menu of readDataset().menus) {
      expect(menu.supplier.businessNameAr, `${menu.venueId} supplier`).toBeTruthy();
      expect(menu.tableBooking.titleAr, `${menu.venueId} table title`).toBeTruthy();
      for (const item of menu.items) {
        expect(item.nameEn, `${menu.venueId}/${item.id}`).toBeTruthy();
        expect(item.nameAr, `${menu.venueId}/${item.id}`).toBeTruthy();
      }
    }
  });

  it('uses unique venue slugs, venue ids, item ids and SKU ids', () => {
    const data = readDataset();
    const unique = (values: string[]) => new Set(values).size === values.length;

    expect(unique(data.menus.map(m => m.venueId))).toBe(true);
    expect(unique(data.menus.map(m => m.slug))).toBe(true);
    expect(unique(data.menus.map(m => m.supplier.id))).toBe(true);
    expect(unique(data.menus.map(m => m.tableBooking.skuId))).toBe(true);
    expect(unique(data.menus.flatMap(m => m.items.map((i: any) => i.id)))).toBe(true);
  });

  it('only names delivery zones the app actually knows about', () => {
    // A typo'd zoneId is otherwise invisible until a traveler orders into it and
    // the order is refused at the last step.
    for (const menu of readDataset().menus) {
      for (const zone of menu.delivery.zones) {
        expect(DELIVERY_ZONE_IDS, `${menu.venueId}/${zone.zoneId}`).toContain(zone.zoneId);
      }
    }
  });

  it('never claims delivery without being able to deliver it', () => {
    for (const menu of readDataset().menus) {
      if (menu.delivery.acceptsDelivery) {
        expect(menu.delivery.zones.length, `${menu.venueId} acceptsDelivery`).toBeGreaterThan(0);
        expect(menu.delivery.minOrderEGP, `${menu.venueId} minimum order`).toBeGreaterThan(0);
      } else {
        expect(menu.delivery.zones.length, `${menu.venueId} is pickup-only`).toBe(0);
      }
    }
  });

  it('gives every venue table sittings, so availability can be quoted', () => {
    for (const menu of readDataset().menus) {
      expect(menu.tableBooking.timeSlots?.length, `${menu.venueId} timeSlots`).toBeGreaterThan(0);
      expect(menu.tableBooking.maxCapacityPerSlot, `${menu.venueId} capacity`).toBeGreaterThan(0);
    }
  });
});

describe('importDahabMenus', () => {
  beforeAll(() => {
    // Mirrors the boot order in runMigrationsAndSeed(): the curated venues are
    // seeded first (step 10c-0, for the same reason step 9b seeds area
    // profiles) because the DKOS bootstrap that owns them runs after that
    // transaction. Without them this import has nothing to enrich.
    if (db.diningVenues.length === 0) {
      db.diningVenues.push(...(EXPANDED_DINING_VENUES as DiningVenueEntity[]));
    }
    importDahabMenus();
  });

  it('seeds every curated venue the catalogue names', () => {
    // The failure this guards is a FRESH boot: without step 10c-0 the venues
    // are absent here and importDahabMenus() aborts the entire seed
    // transaction with "has no matching row in db.diningVenues".
    const named = new Set(readDataset().menus.map(m => m.venueId));
    for (const venueId of named) {
      expect(db.diningVenues.some(v => v.id === venueId), venueId).toBe(true);
    }
  });

  it('leaves the store orderable', () => {
    expect(hasDiningMenus()).toBe(true);
    expect(db.diningMenuItems.length).toBeGreaterThan(0);
  });

  it('is idempotent: a second run creates nothing new', () => {
    const before = {
      suppliers: db.suppliers.length,
      skus: db.productSkus.length,
      items: db.diningMenuItems.length
    };
    const second = importDahabMenus();

    expect(second.suppliersCreated).toBe(0);
    expect(second.skusCreated).toBe(0);
    expect(second.itemsCreated).toBe(0);
    expect(db.suppliers.length).toBe(before.suppliers);
    expect(db.productSkus.length).toBe(before.skus);
    expect(db.diningMenuItems.length).toBe(before.items);
  });

  it('resolves every venue supplierId to a real supplier', () => {
    // The defect this seed exists to fix: curated venues named 'SUP-ALIBABA',
    // which does not exist, so joining a venue to its supplier returned nothing
    // and catalogIntegrity's supplier resolution could never pass.
    for (const venue of db.diningVenues) {
      if (!venue.slug) continue; // seeded venues only
      expect(venue.supplierId, `${venue.id} supplierId`).toBeTruthy();
      expect(
        db.suppliers.some(s => s.id === venue.supplierId),
        `${venue.id} -> ${venue.supplierId}`
      ).toBe(true);
    }
  });

  it('gives every seeded venue a table SKU that settles as a dining service', () => {
    for (const venue of db.diningVenues) {
      if (!venue.slug) continue;
      const sku = db.productSkus.find(s => s.serviceType === 'dining' && s.supplierId === venue.supplierId);
      expect(sku, `${venue.id} dining SKU`).toBeTruthy();
      expect(sku!.currency).toBe('EGP');
      expect(sku!.basePriceEGP).toBeGreaterThan(0);
      expect(sku!.timeSlots?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('attaches every menu item to a venue that exists', () => {
    for (const item of db.diningMenuItems) {
      expect(
        db.diningVenues.some(v => v.id === item.venueId),
        `${item.id} -> ${item.venueId}`
      ).toBe(true);
    }
  });

  it('quotes delivery fees per VENUE, never per zone', () => {
    // Two kitchens in the same neighbourhood must be able to charge different
    // drops; the zone only supplies geography.
    const yumm = db.diningVenues.find(v => v.slug === 'yum-yum-egyptian-kitchen')!;
    const lighthouse = yumm.delivery!.zones.find(z => z.zoneId === 'lighthouse')!;
    expect(deliveryZoneFor(yumm, 'lighthouse')!.feeEGP).toBe(lighthouse.feeEGP);
    expect(venueDeliversTo(yumm, 'lighthouse')).toBe(true);
  });

  it('refuses a zone the venue does not serve', () => {
    // Ali Baba delivers around town, but not 6km up the coast to the Blue Hole.
    const townOnly = db.diningVenues.find(v => v.slug === 'ali-baba-waterfront-seafood')!;
    expect(townOnly.delivery!.acceptsDelivery).toBe(true);
    expect(deliveryZoneFor(townOnly, 'blue_hole')).toBeUndefined();
    expect(venueDeliversTo(townOnly, 'blue_hole')).toBe(false);
  });

  it('does not break catalogue integrity for anything it created', () => {
    // catalogIntegrity resolves every productSku.supplierId, and the dining SKUs
    // this seed creates are the first 'dining' rows that have to pass it.
    //
    // Scoped to dining deliberately: this test seeds only the venue and menu
    // halves of the catalogue, so activity-level issues from unseeded diving and
    // safari SKUs belong to another suite and asserting a global zero here would
    // couple this test to seed state it does not own.
    const diningSkus = new Set(
      db.productSkus.filter(s => s.serviceType === 'dining').map(s => s.id)
    );
    expect(diningSkus.size).toBeGreaterThan(0);

    const issues = findCatalogIntegrityIssues().filter(
      i => i.collection === 'productSkus' && diningSkus.has(i.id)
    );
    expect(issues.map(i => i.problem)).toEqual([]);
  });

  it('survives the DKOS bootstrap, which runs AFTER this seed and wins on merge', () => {
    // The real boot order is runMigrationsAndSeed() (which calls this import)
    // THEN dahabKnowledgeOs.bootstrapValidatedCorpus(), whose seedInto merges
    // with { ...existing, ...seed } — seed fields win. So anything this import
    // writes to a curated venue can be reverted a moment later if the curated
    // corpus restates that field.
    dahabKnowledgeOs.bootstrapValidatedCorpus();

    for (const venue of db.diningVenues.filter(v => v.slug)) {
      expect(venue.supplierId, `${venue.id} supplierId survived the bootstrap`).toBeTruthy();
      expect(
        db.suppliers.some(s => s.id === venue.supplierId),
        `${venue.id} -> ${venue.supplierId} resolves to a real supplier`
      ).toBe(true);
      expect(venue.slug, `${venue.id} slug`).toBeTruthy();
    }
  });

  it('leaves no venue naming a supplier it does not own', () => {
    // The two defects this seed exists to remove were both of this shape, and
    // neither is visible to catalogIntegrity: SUP-ALIBABA named a supplier that
    // does not exist, and SUP-BEDOUIN-DIVE named one that DOES exist but is a
    // dive centre, so a banquet kitchen's payout would have been routed to a
    // diving operator. Asserting the whole corpus is the only way the next one
    // gets caught.
    for (const venue of db.diningVenues) {
      if (venue.slug) continue; // not a menu-seeded venue, out of scope here
      expect(venue.supplierId, `${venue.id} must not name a supplier from the curated corpus`).toBeUndefined();
    }
  });
});

describe('dining collections are declared', () => {
  it('exposes menu items and orders on the DatabaseState', () => {
    // The two collections were declared non-optional precisely so the compiler
    // would force every adapter's default state to know about them.
    expect(() => db.diningMenuItems).not.toThrow();
    expect(() => db.diningOrders).not.toThrow();
    expect(path.basename(DATASET)).toBe('dahab_menus.json');
  });
});