import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { accommodationRouter } from '../../server/api/accommodationRoutes';

/**
 * GET /api/accommodations?view=card — the slim listing payload.
 *
 * The list page and the "similar stays" rail need a card's worth of fields;
 * the gallery, Tripadvisor block and sellable SKU belong to the detail page.
 * Without the flag the response keeps its full shape for every other caller.
 */

let server: Server;
let base = '';

beforeAll(async () => {
  resetDb();
  db.accommodations.push({
    id: 'ACC-CARD', slug: 'card-stay', name: 'Card Stay', nameAr: 'إقامة', propertyType: 'hotel',
    category: 'mid-range', priceBand: 'moderate', areaId: 'AREA-1', area: 'dahab-old-town',
    areaName: 'Old Town', areaNameAr: 'المدينة القديمة', rating: 4.5, reviewCount: 10,
    typeChips: [], typeChipsAr: [], tagline: 'Sea', taglineAr: 'بحر', description: 'A place',
    descriptionAr: 'مكان', amenities: ['wifi'], amenitiesAr: ['واي فاي'], perNightEGP: 900,
    packageNights: 1, rooms: 4, maxGuests: 2, bestFor: 'Divers', bestForAr: 'الغواصين',
    note: 'Quiet', noteAr: 'هادئ', skuId: 'SKU-CARD', active: true, featured: false,
    galleryImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  } as any);
  const app = express();
  app.use('/api/accommodations', accommodationRouter);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const HEAVY = ['galleryImageUrls', 'tripadvisor', 'bookable', 'note', 'noteAr', 'bestFor', 'bestForAr'];

describe('the catalogue card view', () => {
  it('drops the detail-only fields and keeps what a card shows', async () => {
    const full = await (await fetch(`${base}/api/accommodations`)).json();
    const card = await (await fetch(`${base}/api/accommodations?view=card`)).json();
    expect(card.accommodations.length).toBe(full.accommodations.length);
    expect(card.accommodations.length).toBeGreaterThan(0);

    for (const stay of card.accommodations) {
      for (const key of HEAVY) expect(stay).not.toHaveProperty(key);
      expect(stay).toHaveProperty('slug');
      expect(stay).toHaveProperty('perNightEGP');
    }
    expect(JSON.stringify(card).length).toBeLessThan(JSON.stringify(full).length);
  });
});
