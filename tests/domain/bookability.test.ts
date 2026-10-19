import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import {
  reconcileActivityBookability,
  resolveBookability
} from '../../server/services/bookabilityReconciler';
import { resetDb, seedSku } from '../helpers/fixtures';
import type { ActivityDetailEntity } from '../../server/db/schema';

/**
 * The catalogue must only offer what the commerce catalogue can sell.
 *
 * Before this reconciliation, all ten skuIds on db.activities pointed at
 * inventory that has never existed — zero overlap with the seventeen real
 * product SKUs — while eighteen of those activities advertised
 * `bookingMode: 'BOOK_NOW'`. Anything that forwarded one of those ids to
 * checkout got an UnknownSkuError, which is why an experience could be browsed
 * but never bought.
 */

const seedActivity = (over: Partial<ActivityDetailEntity> & { id: string }): ActivityDetailEntity => {
  const activity: ActivityDetailEntity = {
    id: over.id,
    titleEn: 'Fixture Activity',
    titleAr: 'نشاط اختباري',
    category: 'diving',
    placeId: 'place_fixture',
    areaId: 'lighthouse',
    durationMinutes: 60,
    accessMethod: 'SHORE',
    difficulty: 'All Levels',
    experienceLevelRequired: 'None',
    basePriceEGP: 900,
    bookingMode: 'BOOK_NOW',
    seasonalityMonths: [1],
    environmentalSensitivities: {},
    dependencies: [],
    preparationTips: [],
    preparationTipsAr: [],
    travelerFitPersonas: [],
    ...over
  } as ActivityDetailEntity;
  db.activities.push(activity);
  return activity;
};

describe('catalogue bookability reconciliation', () => {
  beforeEach(() => {
    resetDb();
  });

  it('clears a skuId that names inventory which does not exist', () => {
    seedSku();
    const activity = seedActivity({ id: 'act_ghost', skuId: 'SKU-DOES-NOT-EXIST' });

    const result = reconcileActivityBookability();

    expect(activity.skuId).toBeUndefined();
    expect(result.downgraded).toBe(1);
    expect(result.downgradedIds).toContain('act_ghost');
  });

  it('stops an activity with no inventory from advertising BOOK_NOW', () => {
    seedSku();
    const activity = seedActivity({
      id: 'act_ghost',
      skuId: 'SKU-DOES-NOT-EXIST',
      bookingMode: 'BOOK_NOW'
    });

    reconcileActivityBookability();

    expect(activity.bookingMode).toBe('REQUEST_NOW');
  });

  it('keeps a skuId that resolves to a sellable product', () => {
    seedSku();
    const activity = seedActivity({ id: 'act_real', skuId: 'SKU-DIVE-TEST' });

    const result = reconcileActivityBookability();

    expect(activity.skuId).toBe('SKU-DIVE-TEST');
    expect(activity.bookingMode).toBe('BOOK_NOW');
    expect(result.bookable).toBe(1);
  });

  it('treats an inactive SKU as unsellable', () => {
    seedSku({ id: 'SKU-RETIRED', active: false });
    const activity = seedActivity({ id: 'act_retired', skuId: 'SKU-RETIRED' });

    reconcileActivityBookability();

    expect(activity.skuId).toBeUndefined();
    expect(activity.bookingMode).toBe('REQUEST_NOW');
  });

  it('repoints a mapped activity at the product that really sells it', () => {
    seedSku({ id: 'SKU-DIV-002', basePriceEGP: 3400 });
    const activity = seedActivity({
      id: 'act_blue_hole_safari_dive',
      skuId: 'SKU-DIVE-BH-01',
      basePriceEGP: 2200
    });

    reconcileActivityBookability();

    expect(activity.skuId).toBe('SKU-DIV-002');
  });

  it('declines to act when no inventory has been loaded, rather than clearing everything', () => {
    const activity = seedActivity({ id: 'act_real', skuId: 'SKU-DIVE-TEST' });

    const result = reconcileActivityBookability();

    expect(activity.skuId).toBe('SKU-DIVE-TEST');
    expect(result.downgraded).toBe(0);
  });

  it('quotes the SKU price, not the activity price', () => {
    // The corpus prices the Blue Hole day at 2,200 EGP and SKU-DIV-002 charges
    // 3,400. Checkout uses the SKU, so the traveler must be shown the SKU.
    seedSku({ id: 'SKU-DIV-002', basePriceEGP: 3400, supplierId: 'SUP-DIVE-02' });
    seedActivity({ id: 'act_blue_hole_safari_dive', skuId: 'SKU-DIVE-BH-01', basePriceEGP: 2200 });

    reconcileActivityBookability();
    const bookable = resolveBookability(db.activities[0].skuId);

    expect(bookable?.basePriceEGP).toBe(3400);
    expect(bookable?.supplierId).toBe('SUP-DIVE-02');
  });

  it('resolves nothing for an activity that carries no skuId', () => {
    seedSku();
    expect(resolveBookability(undefined)).toBeNull();
  });
});

describe('the seeded catalogue', () => {
  /**
   * The regression guard for the root cause. If a future seed reintroduces a
   * skuId with no product behind it, this is what says so.
   */
  it('leaves no activity pointing at inventory that does not exist', async () => {
    resetDb();
    const { runMigrationsAndSeed } = await import('../../server/db/migrations');
    const { dahabKnowledgeOs } = await import('../../server/services/dahabKnowledgeOs');

    runMigrationsAndSeed();
    dahabKnowledgeOs.bootstrapValidatedCorpus();
    reconcileActivityBookability();

    const sellable = new Set(db.productSkus.filter(s => s.active).map(s => s.id));
    const dangling = db.activities.filter(a => a.skuId && !sellable.has(a.skuId));

    expect(dangling.map(a => `${a.id} → ${a.skuId}`)).toEqual([]);
  });

  it('leaves no activity advertising BOOK_NOW with nothing to sell', async () => {
    resetDb();
    const { runMigrationsAndSeed } = await import('../../server/db/migrations');
    const { dahabKnowledgeOs } = await import('../../server/services/dahabKnowledgeOs');

    runMigrationsAndSeed();
    dahabKnowledgeOs.bootstrapValidatedCorpus();
    reconcileActivityBookability();

    const lying = db.activities.filter(a => a.bookingMode === 'BOOK_NOW' && !a.skuId);

    expect(lying.map(a => a.id)).toEqual([]);
  });
});
