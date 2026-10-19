import { describe, expect, it, beforeEach } from 'vitest';
import { buildOptionsFromInventory, getVerifiedOffers, searchOffers } from '../../server/services/daygiInventoryService';
import { db } from '../../server/db/database';
import type { SupplierOfferEntity, SupplierEntity } from '../../server/db/schema';

/**
 * Real-inventory sourcing: supplierOffers is the table populated at boot from
 * dahab_local_commerce.json (27 offers across 9 suppliers). The module must
 * deduplicate by activity (cheapest wins), filter to active suppliers with
 * real prices, and shape the result as DayGiMultiOptionResult.
 *
 * Tests seed their own offers because the in-memory test adapter starts
 * empty (the boot seed import does not run in vitest).
 */

const SUPPLIER_ID = 'SUP-TEST-KING';
const SUPPLIER_ID_2 = 'SUP-TEST-RELAX';

function makeOffer(overrides: Partial<SupplierOfferEntity>): SupplierOfferEntity {
  return {
    id: 'OFF-TEST',
    supplierId: SUPPLIER_ID,
    activityId: 'ACT-TEST',
    canonicalCategory: 'safari',
    sourceActivityName: 'Test Activity',
    titleEn: 'Test Activity',
    titleAr: 'نشاط تجريبي',
    price: 100,
    currency: 'EGP',
    pricingBasis: 'PER_PERSON',
    includes: [],
    excludes: [],
    bookingChannels: [],
    sourceType: 'USER_PROVIDED_IMAGE',
    sourceReferences: [],
    verificationStatus: 'WEB_CONFIRMED',
    ...overrides
  } as SupplierOfferEntity;
}

function makeSupplier(overrides: Partial<SupplierEntity>): SupplierEntity {
  return {
    id: SUPPLIER_ID,
    businessName: 'Test Supplier',
    businessNameAr: 'مورد تجريبي',
    category: 'safari',
    phone: '+20 100 000 0000',
    tier: 'Tier 1 Certified',
    status: 'Active',
    rating: 4.5,
    reviewCount: 10,
    licenseNumber: 'TEST-001',
    cdwsVerified: false,
    verificationStatus: 'WEB_CONFIRMED',
    verificationSources: [],
    serviceTypes: [],
    ...overrides
  } as SupplierEntity;
}

describe('daygiInventoryService', () => {
  beforeEach(() => {
    // Seed suppliers + offers for this test file (isolated per-file by vitest).
    db.suppliers.length = 0;
    db.supplierOffers.length = 0;

    db.suppliers.push(
      makeSupplier({ id: SUPPLIER_ID, businessName: 'King Safari' }),
      makeSupplier({ id: SUPPLIER_ID_2, businessName: 'Relax Center', category: 'diving' }),
      makeSupplier({ id: 'SUP-INACTIVE', status: 'Suspended' })
    );

    db.supplierOffers.push(
      makeOffer({
        id: 'OFF-001', supplierId: SUPPLIER_ID,
        sourceActivityName: 'Blue Hole + Abu Galum Safari',
        titleEn: 'Blue Hole + Abu Galum Safari',
        titleAr: 'سفاري البلو هول وأبو جالوم',
        price: 550, basePriceEGP: 550,
        includes: ['4x4 transfer', 'Speedboat']
      }),
      // Cheaper duplicate of the same activity from a different supplier — dedup should keep this one
      makeOffer({
        id: 'OFF-002', supplierId: SUPPLIER_ID_2,
        sourceActivityName: 'Blue Hole + Abu Galum Safari',
        titleEn: 'Blue Hole + Abu Galum Safari',
        titleAr: 'سفاري البلو هول وأبو جالوم',
        price: 400, basePriceEGP: 400
      }),
      makeOffer({
        id: 'OFF-003', supplierId: SUPPLIER_ID_2,
        sourceActivityName: 'Glass Bottom Boat',
        titleEn: 'Glass Bottom Boat Coral Viewing',
        titleAr: 'قارب القاع الزجاجي',
        price: 350, basePriceEGP: 350
      }),
      makeOffer({
        id: 'OFF-004', supplierId: SUPPLIER_ID,
        sourceActivityName: 'Quad Bike Sunset',
        titleEn: 'Quad Bike Sunset Safari',
        titleAr: 'سفاري الدراجات النارية عند الغروب',
        price: 300, basePriceEGP: 300
      }),
      // Inactive supplier — should be filtered out
      makeOffer({
        id: 'OFF-005', supplierId: 'SUP-INACTIVE',
        sourceActivityName: 'Inactive Activity',
        titleEn: 'Inactive',
        titleAr: 'غير نشط',
        price: 50
      }),
      // Zero price — should be filtered out
      makeOffer({
        id: 'OFF-006', supplierId: SUPPLIER_ID,
        sourceActivityName: 'Free Activity',
        titleEn: 'Free',
        titleAr: 'مجاني',
        price: 0
      })
    );
  });

  it('returns a well-formed DayGiMultiOptionResult with postActivityContext', () => {
    const result = buildOptionsFromInventory({
      postActivityContext: {
        originalActivity: 'Test Dive',
        originalActivityAr: 'غطسة تجريبية',
        endTime: '01:30 PM',
        location: 'Canyon',
        availableWindowMins: 180
      }
    });

    expect(result).toHaveProperty('options');
    expect(result).toHaveProperty('postActivityContext');
    expect(result.postActivityContext?.originalActivity).toBe('Test Dive');
    expect(result.options.length).toBeGreaterThan(0);
    result.options.forEach(opt => {
      expect(opt.id).toBeTruthy();
      expect(opt.titleEn).toBeTruthy();
      expect(opt.titleAr).toBeTruthy();
      expect(['ACTIVITY', 'FOOD', 'RELAX', 'CULTURE']).toContain(opt.category);
      expect(opt.priceEGP).toBeGreaterThan(0);
      expect(opt.whyItFitsEn).toBeTruthy();
      expect(opt.whyItFitsAr).toBeTruthy();
    });
  });

  it('respects maxOptions (returns at most N offers)', () => {
    const offers = getVerifiedOffers({ maxOptions: 2 });
    expect(offers).toHaveLength(2);
  });

  it('respects minPriceEGP filter', () => {
    const offers = getVerifiedOffers({ minPriceEGP: 400, maxOptions: 100 });
    expect(offers.length).toBeGreaterThan(0);
    offers.forEach(offer => {
      const price = offer.basePriceEGP ?? offer.price;
      expect(price).toBeGreaterThanOrEqual(400);
    });
  });

  it('respects maxPriceEGP filter', () => {
    const offers = getVerifiedOffers({ maxPriceEGP: 350, maxOptions: 100 });
    expect(offers.length).toBeGreaterThan(0);
    offers.forEach(offer => {
      const price = offer.basePriceEGP ?? offer.price;
      expect(price).toBeLessThanOrEqual(350);
    });
  });

  it('returns nothing when no offer falls inside the price window', () => {
    const offers = getVerifiedOffers({ minPriceEGP: 5000, maxOptions: 100 });
    expect(offers).toHaveLength(0);
  });

  it('searchOffers returns options matching text', () => {
    const result = searchOffers('Blue Hole', 3);
    expect(result.options.length).toBeGreaterThan(0);
    const names = result.options.map(o => o.titleEn).join(' ').toLowerCase();
    expect(names).toContain('blue hole');
  });

  it('deduplicates by activity name keeping the cheapest offer', () => {
    const offers = getVerifiedOffers({ maxOptions: 10 });
    const blueHoleOffers = offers.filter(o =>
      (o.sourceActivityName || '').toLowerCase().includes('blue hole')
    );
    // Two Blue Hole offers exist; dedup must keep only the cheaper one (400).
    expect(blueHoleOffers.length).toBe(1);
    expect(blueHoleOffers[0].basePriceEGP ?? blueHoleOffers[0].price).toBe(400);
  });

  it('filters out inactive suppliers and zero-price offers', () => {
    const offers = getVerifiedOffers({ maxOptions: 100 });
    const names = offers.map(o => o.sourceActivityName).join(' ').toLowerCase();
    expect(names).not.toContain('inactive');
    expect(names).not.toContain('free activity');
  });

  describe('bookability resolution', () => {
    const SELLABLE_SKU = 'SKU-TEST-DIVE-01';

    beforeEach(() => {
      db.productSkus.length = 0;
      db.productSkus.push({
        id: SELLABLE_SKU,
        supplierId: SUPPLIER_ID_2,
        serviceType: 'diving',
        basePriceEGP: 400,
        currency: 'EGP',
        active: true,
        maxCapacityPerSlot: 8,
        pricingBasis: 'PER_PERSON'
      } as any);
      db.activities.length = 0;
      db.activities.push(
        { id: 'ACT-BOOKABLE', skuId: SELLABLE_SKU } as any,
        { id: 'ACT-INFO-ONLY' } as any
      );
      db.supplierOffers.push(
        makeOffer({
          id: 'OFF-BOOKABLE', supplierId: SUPPLIER_ID_2, activityId: 'ACT-BOOKABLE',
          sourceActivityName: 'Bookable Reef Dive', titleEn: 'Bookable Reef Dive',
          price: 900, basePriceEGP: 900
        }),
        makeOffer({
          id: 'OFF-INFO', supplierId: SUPPLIER_ID, activityId: 'ACT-INFO-ONLY',
          sourceActivityName: 'Info Only Camel Ride', titleEn: 'Info Only Camel Ride',
          price: 100, basePriceEGP: 100
        })
      );
    });

    it('attaches a skuId and actionKey when the activity resolves to a live SKU', () => {
      const result = buildOptionsFromInventory({ maxOptions: 10 });
      const bookable = result.options.find(o => o.id === 'INV-OFF-BOOKABLE');
      expect(bookable).toBeDefined();
      expect(bookable!.skuId).toBe(SELLABLE_SKU);
      expect(bookable!.actionKey).toBe('CONFIRM_DIRECT_BOOKING');
    });

    it('leaves offers without a live SKU without a skuId rather than guessing one', () => {
      const result = buildOptionsFromInventory({ maxOptions: 10 });
      const infoOnly = result.options.find(o => o.id === 'INV-OFF-INFO');
      expect(infoOnly).toBeDefined();
      expect(infoOnly!.skuId).toBeUndefined();
      expect(infoOnly!.actionKey).toBeUndefined();
    });

    it('drops the skuId when the referenced product is no longer active', () => {
      db.productSkus[0].active = false;
      const result = buildOptionsFromInventory({ maxOptions: 10 });
      const bookable = result.options.find(o => o.id === 'INV-OFF-BOOKABLE');
      expect(bookable).toBeDefined();
      expect(bookable!.skuId).toBeUndefined();
    });

    it('ranks bookable offers above cheaper unbookable ones', () => {
      const result = buildOptionsFromInventory({ maxOptions: 10 });
      const names = result.options.map(o => o.id);
      expect(names.indexOf('INV-OFF-BOOKABLE')).toBeLessThan(names.indexOf('INV-OFF-INFO'));
    });
  });

  it('gracefully returns empty options when no offers match', () => {
    const result = searchOffers('nonexistent-activity-xyz', 3);
    expect(result.options).toHaveLength(0);
  });
});
