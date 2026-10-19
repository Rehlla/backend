import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../../server/db/database';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import { READY_TRIP_PROGRAMMES } from '../../server/db/seeds/editorialContent';
import { seedTripPackages } from '../../server/services/catalog/packageSeed';
import { catalogService } from '../../server/services/catalog/catalogService';
import { invalidatePermissionCache, ensureSystemRoles, hasPermission } from '../../server/services/permissionService';

/** db.tripPackages: the one-time seed, and the SQLite round trip (with catalogMeta). */

let dir = '';
let adapter: SqlitePersistenceAdapter | null = null;

afterEach(() => {
  adapter?.close();
  adapter = null;
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = '';
  db.setAdapter(new InMemoryPersistenceAdapter());
  invalidatePermissionCache();
});

const ctx = { actor: { userId: 'USR-OPS', role: 'Operations' }, supplierScope: null };

describe('trip package seed', () => {
  it('seeds every READY_TRIP_PROGRAMME once and is idempotent', () => {
    db.setAdapter(new InMemoryPersistenceAdapter());
    expect(seedTripPackages().created).toBe(READY_TRIP_PROGRAMMES.length);
    expect(seedTripPackages().created).toBe(0);
    expect(db.tripPackages).toHaveLength(READY_TRIP_PROGRAMMES.length);
    const first = READY_TRIP_PROGRAMMES[0];
    const row = db.tripPackages.find(p => p.seedId === first.id)!;
    expect(row).toMatchObject({ status: 'published', titleEn: first.title, durationDays: first.durationDays, startingPriceEGP: first.startingPriceEGP });
    expect(row.days).toHaveLength(first.dayByDay.length);

    // An editor's change survives a re-seed.
    row.titleEn = 'Edited';
    seedTripPackages();
    expect(db.tripPackages.find(p => p.seedId === first.id)!.titleEn).toBe('Edited');
  });
});

describe('SQLite persistence', () => {
  it('tripPackages and catalogMeta survive a reopen', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-catalog-'));
    const file = path.join(dir, 'catalog.sqlite');
    adapter = new SqlitePersistenceAdapter(file);
    db.setAdapter(adapter);
    seedTripPackages();
    const created = catalogService.create('package', { title: { en: 'Persist me', ar: 'احفظني' }, fields: { durationDays: 2, days: [{ day: 1, titleEn: 'One', titleAr: 'واحد', activitySkuIds: ['SKU-X'] }] } }, ctx);
    const patched = catalogService.patch('package', created.id, { images: ['/api/media/a.jpg'] }, created.updatedAt, ctx);
    db.saveToDisk();

    adapter.close();
    adapter = new SqlitePersistenceAdapter(file);
    db.setAdapter(adapter);

    expect(db.tripPackages).toHaveLength(READY_TRIP_PROGRAMMES.length + 1);
    const row = db.tripPackages.find(p => p.id === created.id)!;
    expect(row).toMatchObject({ titleAr: 'احفظني', status: 'draft', coverImage: '/api/media/a.jpg' });
    expect(row.days[0].activitySkuIds).toEqual(['SKU-X']);
    const meta = db.catalogMeta.find(m => m.entityId === created.id)!;
    expect(meta).toMatchObject({ type: 'package', status: 'draft', updatedAt: patched.item.updatedAt });
    expect(seedTripPackages().created).toBe(0);
  });
});

describe('default grants', () => {
  it('stored system roles pick up the catalogue keys once', () => {
    db.setAdapter(new InMemoryPersistenceAdapter());
    ensureSystemRoles();
    const ops = db.roles.find(r => r.id === 'Operations')!;
    // Simulate a store persisted before the catalogue existed.
    ops.permissions = ops.permissions.filter(k => !k.startsWith('catalog.'));
    delete ops.appliedDefaults;
    invalidatePermissionCache();
    expect(hasPermission({ userId: 'U-OPS', role: 'Operations' }, 'catalog.hotels.publish')).toBe(true);
    expect(hasPermission({ userId: 'U-PRD', role: 'Product' }, 'catalog.hotels.manage')).toBe(true);
    expect(hasPermission({ userId: 'U-PRD', role: 'Product' }, 'catalog.hotels.publish')).toBe(false);
    expect(hasPermission({ userId: 'U-PRD', role: 'Product' }, 'catalog.transfers.view')).toBe(false);
    expect(hasPermission({ userId: 'U-SUP', role: 'Supplier' }, 'supplier.catalog.manage')).toBe(true);

    // Once merged, an admin removing the keys keeps them removed.
    ops.permissions = ops.permissions.filter(k => k !== 'catalog.hotels.publish');
    invalidatePermissionCache();
    expect(hasPermission({ userId: 'U-OPS', role: 'Operations' }, 'catalog.hotels.publish')).toBe(false);
  });
});
