import { db } from '../../server/db/database';
import { catalogRouter } from '../../server/api/catalogRoutes';
import { supplierCatalogRouter } from '../../server/api/supplierCatalogRoutes';
import { startOpsApp, type OpsTestServer } from '../ops/opsTestApp';
import type { SupplierEntity } from '../../server/db/schema';

/**
 * The ops test app (same gate order as server.ts) plus both catalogue
 * routers, mounted where server.ts mounts them.
 */
export function startCatalogApp(): Promise<OpsTestServer> {
  return startOpsApp(app => {
    app.use('/api/admin/catalog', catalogRouter);
    app.use('/api/supplier/catalog', supplierCatalogRouter);
  });
}

export const json = async (p: Promise<Response>) => {
  const r = await p;
  const text = await r.text();
  return { status: r.status, headers: r.headers, body: text ? JSON.parse(text) : null };
};

/** Minimal reference data every catalogue type can hang off. */
export function seedReference() {
  db.areaProfiles.push(
    {
      id: 'lighthouse', nameEn: 'Lighthouse', nameAr: 'اللايتهاوس', coordinates: { lat: 28.5, lng: 34.5 }, radiusMeters: 500,
      atmosphere: '', atmosphereAr: '', personaAffinity: [], activityAffinity: [], foodAffinity: [], walkabilityScore: 5,
      noiseProfile: 'Moderate', transportFriction: 'Low (Walking)', stayProfile: '', eveningProfile: '',
    },
    {
      id: 'mashraba', nameEn: 'Mashraba', nameAr: 'المشربة', coordinates: { lat: 28.49, lng: 34.51 }, radiusMeters: 500,
      atmosphere: '', atmosphereAr: '', personaAffinity: [], activityAffinity: [], foodAffinity: [], walkabilityScore: 5,
      noiseProfile: 'Tranquil', transportFriction: 'Low (Walking)', stayProfile: '', eveningProfile: '',
    }
  );
  const supplier = (id: string, name: string, category: SupplierEntity['category']): SupplierEntity => ({
    id, businessName: name, businessNameAr: name, category, tier: 'Vetted Local Partner', status: 'Active', area: 'lighthouse',
  });
  db.suppliers.push(supplier('SUP-A', 'Alpha Divers', 'diving'), supplier('SUP-B', 'Beta Stays', 'hotel'));
}

export const IMG = '/api/media/cms-media-1.jpg';
export const T = (en: string, ar = `${en} ع`) => ({ en, ar });
