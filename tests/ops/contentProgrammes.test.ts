import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../../server/db/database';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { resetDb } from '../helpers/fixtures';
import { contentProgrammes } from '../../server/services/contentProgrammesService';
import { READY_TRIP_PROGRAMMES } from '../../server/db/seeds/editorialContent';
import { startOpsApp, caller, signedIn, type OpsTestServer } from './opsTestApp';
import { adminContentRouter } from '../../server/api/adminContentRoutes';

/**
 * Content programmes (the ready-made trip programmes the web concierge/plan
 * surfaces and the REHLA app render). Seed-authoritative: the editorial
 * catalog seeds the table idempotently, the dashboard CRUDs rows, and the
 * public endpoint reads the DB with a seed fallback off-sqlite.
 */

let dir: string | null = null;
let adapter: SqlitePersistenceAdapter | null = null;

function useSqlite(): void {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-programmes-'));
  adapter = new SqlitePersistenceAdapter(path.join(dir, 'programmes.sqlite'));
  db.setAdapter(adapter);
  initializeCmsSchema();
}

function actor() {
  return { userId: 'USR-T-Admin-1', role: 'Admin', name: 'Test Admin' };
}

beforeEach(() => {
  resetDb();
});
afterEach(() => {
  adapter?.close?.();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  adapter = null;
  dir = null;
});

describe('seed + public read (service)', () => {
  it('seeds the editorial catalog idempotently and never overwrites edits', () => {
    useSqlite();
    const first = contentProgrammes.listAdmin();
    expect(first.length).toBe(READY_TRIP_PROGRAMMES.length);
    // Idempotent: a second boot adds nothing.
    contentProgrammes.ensureSeeded();
    expect(contentProgrammes.listAdmin().length).toBe(READY_TRIP_PROGRAMMES.length);

    // An editor's change survives a re-seed (upgrade safety).
    contentProgrammes.update('dahab-first-timer', { title_en: 'Renamed by the desk' }, actor());
    contentProgrammes.ensureSeeded();
    expect(contentProgrammes.get('dahab-first-timer')?.title_en).toBe('Renamed by the desk');
  });

  it('serves the exact historical camelCase contract from DB rows', () => {
    useSqlite();
    const pub = contentProgrammes.listPublic();
    expect(pub.length).toBe(READY_TRIP_PROGRAMMES.length);
    const sample = pub.find(p => p.id === 'dahab-first-timer')!;
    const seed = READY_TRIP_PROGRAMMES.find(p => p.id === 'dahab-first-timer')!;
    expect(sample.title).toBe(seed.title);
    expect(sample.titleAr).toBe(seed.titleAr);
    expect(sample.pace).toBe(seed.pace);
    expect(sample.startingPriceEGP).toBe(seed.startingPriceEGP);
    expect(sample.durationDays).toBe(seed.durationDays);
    expect(sample.highlights).toEqual(seed.highlights);
    expect(sample.includedItems).toEqual(seed.includedItems);
    expect(sample.dayByDay.length).toBe(seed.dayByDay.length);
    expect(sample.dayByDay[0]).toMatchObject({ day: seed.dayByDay[0].day, title: seed.dayByDay[0].title });
    expect(sample.defaultBudget).toBe(seed.defaultBudget);
  });

  it('filters by destination like the old seed function, published only', () => {
    useSqlite();
    const nuweiba = contentProgrammes.listPublic('nuweiba');
    expect(nuweiba.every(p => (p.destination ?? 'dahab') === 'nuweiba')).toBe(true);
    // Archiving removes it from the public list but keeps it in the dashboard.
    contentProgrammes.setStatus(nuweiba[0].id, 'archived', actor());
    expect(contentProgrammes.listPublic('nuweiba').some(p => p.id === nuweiba[0].id)).toBe(false);
    expect(contentProgrammes.listAdmin({ destination: 'nuweiba' }).some(p => p.id === nuweiba[0].id)).toBe(true);
  });

  it('falls back to the seed off-sqlite (json/postgres adapters, tests)', () => {
    resetDb();
    const pub = contentProgrammes.listPublic();
    expect(pub.length).toBe(READY_TRIP_PROGRAMMES.length);
    expect(contentProgrammes.get('dahab-first-timer')).toBeNull();
  });
});

describe('dashboard CRUD (service)', () => {
  it('creates, updates, publishes and deletes a draft programme', () => {
    useSqlite();
    const created = contentProgrammes.create(
      {
        id: 'test-lagoon-weekend',
        title_en: 'Lagoon Weekend',
        title_ar: 'ويكاند البحيرة',
        tagline_en: 'Two slow days on the water.',
        destination: 'dahab',
        duration_days: 2,
        pace: 'Relaxed',
        starting_price_egp: 4200,
        price_is_estimate: true,
        highlights_en: ['Lagoon hammocks', 'Sunset sail'],
        day_by_day: [{ day: 1, title: 'Arrive', subtitle: '', highlights: [], tag: '', timeEstimate: '' }],
      },
      actor()
    );
    expect(created.status).toBe('draft');
    expect(created.title_ar).toBe('ويكاند البحيرة');
    expect(created.highlights_en).toEqual(['Lagoon hammocks', 'Sunset sail']);

    const updated = contentProgrammes.update('test-lagoon-weekend', { starting_price_egp: 3900, status: 'published' }, actor());
    expect(updated?.starting_price_egp).toBe(3900);
    expect(updated?.status).toBe('published');
    expect(contentProgrammes.listPublic().some(p => p.id === 'test-lagoon-weekend')).toBe(true);

    expect(contentProgrammes.remove('test-lagoon-weekend', actor())).toBe(true);
    expect(contentProgrammes.get('test-lagoon-weekend')).toBeNull();
  });

  it('rejects invalid input with 400-shaped errors', () => {
    useSqlite();
    expect(() => contentProgrammes.create({ title_en: 'No id' }, actor())).toThrow(/id is required/);
    expect(() => contentProgrammes.create({ id: 'x!!', title_en: 'Bad id' }, actor())).toThrow(/must look like/);
    expect(() =>
      contentProgrammes.create({ id: 'valid-id', title_en: 'X', pace: 'Frantic' }, actor()),
    ).toThrow(/pace must be one of/);
    expect(() =>
      contentProgrammes.create({ id: 'valid-id', title_en: 'X', duration_days: 999 }, actor()),
    ).toThrow(/duration_days/);
    expect(() =>
      contentProgrammes.update('dahab-first-timer', { title_en: '' }, actor()),
    ).toThrow(/title_en is required/);
  });

  it('the public id never changes on update', () => {
    useSqlite();
    contentProgrammes.update('dahab-first-timer', { id: 'renamed' } as any, actor());
    expect(contentProgrammes.get('dahab-first-timer')).not.toBeNull();
    expect(contentProgrammes.get('renamed')).toBeNull();
  });

  it('update never mutates the caller payload', () => {
    useSqlite();
    const payload = { id: 'dahab-first-timer', title_en: 'Desk copy', status: 'draft' };
    contentProgrammes.update('dahab-first-timer', { ...payload }, actor());
    expect(payload).toEqual({ id: 'dahab-first-timer', title_en: 'Desk copy', status: 'draft' });

    // Same promise through the HTTP boundary: Express hands the body straight
    // to the service, so the route must not see a mangled object either.
    const row = contentProgrammes.get('dahab-first-timer');
    expect(row?.title_en).toBe('Desk copy');
    expect(row?.updated_by).toBe('USR-T-Admin-1');
  });
});

describe('admin HTTP routes', () => {
  let srv: OpsTestServer;
  let call: ReturnType<typeof caller>;
  beforeAll(async () => {
    srv = await startOpsApp(app => {
      app.use('/api/admin/content', adminContentRouter);
    });
    call = caller(srv.base);
  });
  // The file-level beforeEach resets to in-memory first; this hook (inner,
  // runs after it) puts a fresh SQLite store under every HTTP test.
  beforeEach(() => {
    useSqlite();
  });

  const json = async (p: Promise<Response>) => {
    const r = await p;
    const text = await r.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
      console.error('NON-JSON RESPONSE', r.status, body.raw);
    }
    return { status: r.status, body };
  };

  it('lists seeded programmes for a signed-in admin', async () => {
    const { token } = signedIn('Admin');
    const r = await json(call('GET', '/api/admin/content/programmes', { token }));
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(READY_TRIP_PROGRAMMES.length);
    expect(r.body.programmes[0]).toHaveProperty('title_en');
  });

  it('anonymous callers get 401', async () => {
    expect((await call('GET', '/api/admin/content/programmes')).status).toBe(401);
  });

  it('Product can edit drafts but cannot publish or delete', async () => {
    const product = signedIn('Product');
    const created = await json(
      call('POST', '/api/admin/content/programmes', {
        token: product.token,
        body: { id: 'product-draft-test', title_en: 'Product Draft', destination: 'dahab' },
      }),
    );
    expect(created.status).toBe(201);
    expect(created.body.programme.status).toBe('draft');

    const patched = await json(
      call('PATCH', '/api/admin/content/programmes/product-draft-test', {
        token: product.token,
        body: { tagline_en: 'Draft copy' },
      }),
    );
    expect(patched.status).toBe(200);

    expect((await call('POST', '/api/admin/content/programmes/product-draft-test/publish', { token: product.token })).status).toBe(403);
    expect((await call('DELETE', '/api/admin/content/programmes/product-draft-test', { token: product.token })).status).toBe(403);
  });

  it('publish and archive flip visibility on the public list', async () => {
    const { token } = signedIn('Admin');
    await call('POST', '/api/admin/content/programmes', {
      token,
      body: { id: 'publish-flow-test', title_en: 'Publish Flow', destination: 'siwa' },
    });
    expect(contentProgrammes.listPublic('siwa').some(p => p.id === 'publish-flow-test')).toBe(false);

    expect((await call('POST', '/api/admin/content/programmes/publish-flow-test/publish', { token })).status).toBe(200);
    expect(contentProgrammes.listPublic('siwa').some(p => p.id === 'publish-flow-test')).toBe(true);

    expect((await call('POST', '/api/admin/content/programmes/publish-flow-test/archive', { token })).status).toBe(200);
    expect(contentProgrammes.listPublic('siwa').some(p => p.id === 'publish-flow-test')).toBe(false);
  });

  it('rejects invalid payloads with 400', async () => {
    const { token } = signedIn('Admin');
    const bad = await json(call('POST', '/api/admin/content/programmes', { token, body: { id: 'Bad ID!', title_en: 'X' } }));
    expect(bad.status).toBe(400);
    const missing = await json(call('PATCH', '/api/admin/content/programmes/nope-not-here', { token, body: { title_en: 'X' } }));
    expect(missing.status).toBe(404);
  });
});
