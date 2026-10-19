import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from '../db/sqlite/SqlitePersistenceAdapter';
import { db } from '../db/database';
import { assertNoLiteralEscapes } from './textIntegrity';
import {
  READY_TRIP_PROGRAMMES,
  type DayPlanItem,
  type ReadyTripProgram,
} from '../db/seeds/editorialContent';

/**
 * DB-backed ready-made trip programmes (the `content_programmes` table).
 *
 * The programmes the web concierge/plan surfaces and the REHLA app render
 * used to live only in `editorialContent.ts` — uneditable from any dashboard.
 * They now seed this table idempotently (seed does not overwrite an edited
 * row), the dashboard CRUDs rows via /api/admin/content/programmes, and the
 * public endpoint reads here. `toPublic` mirrors the historical camelCase
 * contract 1:1, so neither client changes on the cutover.
 *
 * Non-sqlite adapters (tests, json/postgres) fall back to the seed list at
 * serve time: the endpoint degrades to the editorial catalog instead of
 * serving nothing.
 */

const PROGRAMME_DESTINATIONS = ['dahab', 'nuweiba', 'siwa'] as const;
const PROGRAMME_PACES = ['Relaxed', 'Balanced', 'Active'] as const;
const PROGRAMME_BUDGETS = ['Budget', 'Moderate', 'Premium'] as const;
const PROGRAMME_STATUSES = ['draft', 'published', 'archived'] as const;

export type ProgrammeDestination = (typeof PROGRAMME_DESTINATIONS)[number];
export type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number];

export interface ContentProgrammeRow {
  id: string;
  destination: ProgrammeDestination;
  title_en: string;
  title_ar: string;
  tagline_en: string;
  tagline_ar: string;
  duration_days: number;
  ideal_for_en: string;
  ideal_for_ar: string;
  pace: string;
  pace_ar: string;
  intensity_score: number;
  free_time_score: number;
  starting_price_egp: number;
  price_is_estimate: number;
  hero_image: string;
  badge_en: string;
  badge_ar: string;
  highlights_en: string[];
  highlights_ar: string[];
  included_en: string[];
  included_ar: string[];
  customizable_en: string[];
  customizable_ar: string[];
  default_interests: string[];
  default_budget: string;
  day_by_day: DayPlanItem[];
  status: ProgrammeStatus;
  sort_order: number;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

function conn(): SqliteDb | null {
  const adapter = db.getAdapter();
  return adapter instanceof SqlitePersistenceAdapter ? adapter.connection : null;
}

function now(): string {
  return new Date().toISOString();
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseDayByDay(raw: unknown): DayPlanItem[] {
  if (Array.isArray(raw)) return raw as DayPlanItem[];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DayPlanItem[]) : [];
  } catch {
    return [];
  }
}

function hydrate(row: Record<string, unknown>): ContentProgrammeRow {
  const r = row as Record<string, any>;
  return {
    ...r,
    highlights_en: parseJsonArray(r.highlights_en),
    highlights_ar: parseJsonArray(r.highlights_ar),
    included_en: parseJsonArray(r.included_en),
    included_ar: parseJsonArray(r.included_ar),
    customizable_en: parseJsonArray(r.customizable_en),
    customizable_ar: parseJsonArray(r.customizable_ar),
    default_interests: parseJsonArray(r.default_interests),
    day_by_day: parseDayByDay(r.day_by_day),
  } as ContentProgrammeRow;
}

/** The public camelCase contract the web and the REHLA app already speak. */
export function toPublic(row: ContentProgrammeRow): ReadyTripProgram {
  return {
    id: row.id,
    destination: row.destination,
    priceIsEstimate: row.price_is_estimate === 1,
    title: row.title_en,
    titleAr: row.title_ar,
    tagline: row.tagline_en,
    taglineAr: row.tagline_ar,
    durationDays: row.duration_days,
    idealFor: row.ideal_for_en,
    idealForAr: row.ideal_for_ar,
    pace: row.pace as ReadyTripProgram['pace'],
    paceAr: row.pace_ar,
    intensityScore: row.intensity_score,
    freeTimeScore: row.free_time_score,
    startingPriceEGP: row.starting_price_egp,
    heroImage: row.hero_image,
    badge: row.badge_en,
    badgeAr: row.badge_ar,
    highlights: row.highlights_en,
    highlightsAr: row.highlights_ar,
    includedItems: row.included_en,
    includedItemsAr: row.included_ar,
    customizableItems: row.customizable_en,
    customizableItemsAr: row.customizable_ar,
    defaultInterests: row.default_interests,
    defaultBudget: row.default_budget as ReadyTripProgram['defaultBudget'],
    dayByDay: row.day_by_day,
  };
}

function logRevision(
  entityId: string,
  action: string,
  actorId: string,
  actorName: string,
  payload?: Record<string, unknown>
): void {
  const c = conn();
  if (!c) return;
  const id = `REV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  c.prepare(
    `INSERT INTO cms_revisions (id, entity_type, entity_id, action, actor_id, actor_name, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, 'programme', entityId, action, actorId || '', actorName || '', JSON.stringify(payload || {}), now());
}

/** Idempotent seed: existing rows are never touched (edits survive upgrades). */
export function ensureSeeded(): void {
  const c = conn();
  if (!c) return;
  const ts = now();
  const insert = c.prepare(`
    INSERT OR IGNORE INTO content_programmes (
      id, destination, title_en, title_ar, tagline_en, tagline_ar,
      duration_days, ideal_for_en, ideal_for_ar, pace, pace_ar,
      intensity_score, free_time_score, starting_price_egp, price_is_estimate,
      hero_image, badge_en, badge_ar,
      highlights_en, highlights_ar, included_en, included_ar,
      customizable_en, customizable_ar, default_interests, default_budget,
      day_by_day, status, sort_order, updated_by, created_at, updated_at
    ) VALUES (
      @id, @destination, @title_en, @title_ar, @tagline_en, @tagline_ar,
      @duration_days, @ideal_for_en, @ideal_for_ar, @pace, @pace_ar,
      @intensity_score, @free_time_score, @starting_price_egp, @price_is_estimate,
      @hero_image, @badge_en, @badge_ar,
      @highlights_en, @highlights_ar, @included_en, @included_ar,
      @customizable_en, @customizable_ar, @default_interests, @default_budget,
      @day_by_day, 'published', @sort_order, 'SYSTEM', @ts, @ts
    )
  `);
  const insertMany = c.transaction((rows: ReadyTripProgram[]) => {
    for (const [index, p] of rows.entries()) insert.run(seedParams(p, index, ts));
  });
  insertMany(READY_TRIP_PROGRAMMES);
}

function seedParams(p: ReadyTripProgram, index: number, ts: string) {
  return {
    id: p.id,
    destination: p.destination ?? 'dahab',
    title_en: p.title,
    title_ar: p.titleAr ?? '',
    tagline_en: p.tagline ?? '',
    tagline_ar: p.taglineAr ?? '',
    duration_days: p.durationDays ?? 1,
    ideal_for_en: p.idealFor ?? '',
    ideal_for_ar: p.idealForAr ?? '',
    pace: p.pace ?? 'Balanced',
    pace_ar: p.paceAr ?? '',
    intensity_score: p.intensityScore ?? 3,
    free_time_score: p.freeTimeScore ?? 40,
    starting_price_egp: p.startingPriceEGP ?? 0,
    price_is_estimate: p.priceIsEstimate === false ? 0 : 1,
    hero_image: p.heroImage ?? '',
    badge_en: p.badge ?? '',
    badge_ar: p.badgeAr ?? '',
    highlights_en: JSON.stringify(p.highlights ?? []),
    highlights_ar: JSON.stringify(p.highlightsAr ?? []),
    included_en: JSON.stringify(p.includedItems ?? []),
    included_ar: JSON.stringify(p.includedItemsAr ?? []),
    customizable_en: JSON.stringify(p.customizableItems ?? []),
    customizable_ar: JSON.stringify(p.customizableItemsAr ?? []),
    default_interests: JSON.stringify(p.defaultInterests ?? []),
    default_budget: p.defaultBudget ?? 'Moderate',
    day_by_day: JSON.stringify(p.dayByDay ?? []),
    sort_order: index,
    ts,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 });

export interface ProgrammeInput {
  id?: string;
  destination?: string;
  title_en?: string;
  title_ar?: string;
  tagline_en?: string;
  tagline_ar?: string;
  duration_days?: number;
  ideal_for_en?: string;
  ideal_for_ar?: string;
  pace?: string;
  pace_ar?: string;
  intensity_score?: number;
  free_time_score?: number;
  starting_price_egp?: number;
  price_is_estimate?: boolean;
  hero_image?: string;
  badge_en?: string;
  badge_ar?: string;
  highlights_en?: string[];
  highlights_ar?: string[];
  included_en?: string[];
  included_ar?: string[];
  customizable_en?: string[];
  customizable_ar?: string[];
  default_interests?: string[];
  default_budget?: string;
  day_by_day?: DayPlanItem[];
  status?: string;
  sort_order?: number;
}

function validateInput(data: ProgrammeInput, partial: boolean, existing?: ContentProgrammeRow): void {
  const text = (v: unknown, name: string, max: number) => {
    if (typeof v !== 'string') throw badRequest(`${name} must be a string.`);
    if (v.length > max) throw badRequest(`${name} must be at most ${max} characters.`);
    return v;
  };
  const num = (v: unknown, name: string, min: number, max: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw badRequest(`${name} must be a finite number.`);
    if (v < min || v > max) throw badRequest(`${name} must be between ${min} and ${max}.`);
    return v;
  };
  const strList = (v: unknown, name: string) => {
    if (!Array.isArray(v) || !v.every(e => typeof e === 'string')) throw badRequest(`${name} must be an array of strings.`);
    if (v.length > 40) throw badRequest(`${name} must have at most 40 items.`);
    return v.map(String);
  };

  // On create, id becomes the stable public identifier (clients reference it).
  if (!partial && (!data.id || !/^[a-z0-9][a-z0-9-]{1,80}$/.test(data.id))) {
    throw badRequest('id is required and must look like "dahab-first-timer".');
  }
  if (data.id !== undefined) text(data.id, 'id', 100);

  if (!partial || data.title_en !== undefined) {
    const title = text(data.title_en ?? '', 'title_en', 200);
    if (!title.trim()) throw badRequest('title_en is required.');
  }
  if (data.destination !== undefined && !PROGRAMME_DESTINATIONS.includes(data.destination as ProgrammeDestination)) {
    throw badRequest(`destination must be one of: ${PROGRAMME_DESTINATIONS.join(', ')}.`);
  }
  if (data.pace !== undefined && !(PROGRAMME_PACES as readonly string[]).includes(data.pace)) {
    throw badRequest(`pace must be one of: ${PROGRAMME_PACES.join(', ')}.`);
  }
  if (data.default_budget !== undefined && !(PROGRAMME_BUDGETS as readonly string[]).includes(data.default_budget)) {
    throw badRequest(`default_budget must be one of: ${PROGRAMME_BUDGETS.join(', ')}.`);
  }
  if (data.status !== undefined && !(PROGRAMME_STATUSES as readonly string[]).includes(data.status)) {
    throw badRequest(`status must be one of: ${PROGRAMME_STATUSES.join(', ')}.`);
  }
  if (data.duration_days !== undefined) num(data.duration_days, 'duration_days', 1, 60);
  if (data.intensity_score !== undefined) num(data.intensity_score, 'intensity_score', 0, 10);
  if (data.free_time_score !== undefined) num(data.free_time_score, 'free_time_score', 0, 100);
  if (data.starting_price_egp !== undefined) num(data.starting_price_egp, 'starting_price_egp', 0, 10_000_000);
  if (data.price_is_estimate !== undefined && typeof data.price_is_estimate !== 'boolean') {
    throw badRequest('price_is_estimate must be a boolean.');
  }
  if (data.sort_order !== undefined) num(data.sort_order, 'sort_order', 0, 100_000);

  for (const [name, max] of [
    ['tagline_en', 400], ['tagline_ar', 400], ['ideal_for_en', 300], ['ideal_for_ar', 300],
    ['badge_en', 80], ['badge_ar', 80], ['hero_image', 2000],
  ] as const) {
    if (data[name] !== undefined) text(data[name], name, max);
  }
  for (const name of ['title_ar', 'pace_ar'] as const) {
    if (data[name] !== undefined) text(data[name], name, 200);
  }
  for (const name of [
    'highlights_en', 'highlights_ar', 'included_en', 'included_ar',
    'customizable_en', 'customizable_ar', 'default_interests',
  ] as const) {
    if (data[name] !== undefined) strList(data[name], name);
  }
  if (data.day_by_day !== undefined) {
    if (!Array.isArray(data.day_by_day) || data.day_by_day.length > 60) {
      throw badRequest('day_by_day must be an array of at most 60 day items.');
    }
    for (const [i, day] of data.day_by_day.entries()) {
      if (!day || typeof day !== 'object') throw badRequest(`day_by_day[${i}] must be an object.`);
      if (typeof (day as any).title !== 'string' || !(day as any).title.trim()) {
        throw badRequest(`day_by_day[${i}].title is required.`);
      }
    }
  }

  // Text integrity: no literal backslash escapes smuggled into rendered copy.
  assertNoLiteralEscapes(
    {
      title_en: data.title_en ?? existing?.title_en ?? '',
      title_ar: data.title_ar ?? existing?.title_ar ?? '',
      tagline_en: data.tagline_en ?? existing?.tagline_en ?? '',
      tagline_ar: data.tagline_ar ?? existing?.tagline_ar ?? '',
    },
    ['title_en', 'title_ar', 'tagline_en', 'tagline_ar']
  );
}

const JSON_COLUMNS: Array<[keyof ProgrammeInput, string]> = [
  ['highlights_en', 'highlights_en'], ['highlights_ar', 'highlights_ar'],
  ['included_en', 'included_en'], ['included_ar', 'included_ar'],
  ['customizable_en', 'customizable_en'], ['customizable_ar', 'customizable_ar'],
  ['default_interests', 'default_interests'], ['day_by_day', 'day_by_day'],
];

function writeParams(data: ProgrammeInput): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const [key] of JSON_COLUMNS) {
    if (out[key] !== undefined) out[key] = JSON.stringify(out[key]);
  }
  if (out.price_is_estimate !== undefined) out.price_is_estimate = out.price_is_estimate ? 1 : 0;
  return out;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

function rows(): ContentProgrammeRow[] | null {
  const c = conn();
  if (!c) return null;
  ensureSeeded();
  return (c.prepare('SELECT * FROM content_programmes ORDER BY sort_order, id').all() as Record<string, unknown>[])
    .map(r => hydrate(r));
}

/** Published programmes for the public endpoint; seed fallback off-sqlite. */
export function listPublic(destination?: string): ReadyTripProgram[] {
  const all = rows();
  if (!all) {
    // json/postgres adapters and fresh test stores: serve the editorial seed.
    const seed = destination
      ? READY_TRIP_PROGRAMMES.filter(p => (p.destination ?? 'dahab') === destination)
      : READY_TRIP_PROGRAMMES;
    return seed;
  }
  return all
    .filter(r => r.status === 'published')
    .filter(r => !destination || r.destination === destination)
    .map(toPublic);
}

/** Dashboard list: every status, with optional filters. */
export function listAdmin(filters: { status?: string; destination?: string; q?: string } = {}): ContentProgrammeRow[] {
  const all = rows() ?? [];
  return all
    .filter(r => !filters.status || r.status === filters.status)
    .filter(r => !filters.destination || r.destination === filters.destination)
    .filter(r => {
      if (!filters.q) return true;
      const q = filters.q.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title_en.toLowerCase().includes(q) ||
        r.title_ar.includes(filters.q as string)
      );
    });
}

export function get(id: string): ContentProgrammeRow | null {
  const c = conn();
  if (!c) return null;
  ensureSeeded();
  const row = c.prepare('SELECT * FROM content_programmes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? hydrate(row) : null;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export interface Actor {
  userId: string;
  role: string;
  name?: string;
}

export function create(data: ProgrammeInput, actor: Actor): ContentProgrammeRow {
  const c = conn();
  if (!c) throw Object.assign(new Error('Programmes need the SQLite store.'), { status: 500 });
  ensureSeeded();
  validateInput(data, false);
  if (get(data.id as string)) throw badRequest(`Programme "${data.id}" already exists.`);
  const ts = now();
  const p = writeParams(data);
  c.prepare(`
    INSERT INTO content_programmes (
      id, destination, title_en, title_ar, tagline_en, tagline_ar,
      duration_days, ideal_for_en, ideal_for_ar, pace, pace_ar,
      intensity_score, free_time_score, starting_price_egp, price_is_estimate,
      hero_image, badge_en, badge_ar, highlights_en, highlights_ar,
      included_en, included_ar, customizable_en, customizable_ar,
      default_interests, default_budget, day_by_day, status, sort_order,
      updated_by, created_at, updated_at
    ) VALUES (
      @id, @destination, @title_en, @title_ar, @tagline_en, @tagline_ar,
      @duration_days, @ideal_for_en, @ideal_for_ar, @pace, @pace_ar,
      @intensity_score, @free_time_score, @starting_price_egp, @price_is_estimate,
      @hero_image, @badge_en, @badge_ar, @highlights_en, @highlights_ar,
      @included_en, @included_ar, @customizable_en, @customizable_ar,
      @default_interests, @default_budget, @day_by_day, @status, @sort_order,
      @updated_by, @ts, @ts
    )
  `).run({
    destination: 'dahab',
    title_en: '',
    title_ar: '',
    tagline_en: '',
    tagline_ar: '',
    duration_days: 1,
    ideal_for_en: '',
    ideal_for_ar: '',
    pace: 'Balanced',
    pace_ar: '',
    intensity_score: 3,
    free_time_score: 40,
    starting_price_egp: 0,
    price_is_estimate: 1,
    hero_image: '',
    badge_en: '',
    badge_ar: '',
    highlights_en: '[]',
    highlights_ar: '[]',
    included_en: '[]',
    included_ar: '[]',
    customizable_en: '[]',
    customizable_ar: '[]',
    default_interests: '[]',
    default_budget: 'Moderate',
    day_by_day: '[]',
    status: 'draft',
    sort_order: 0,
    ...p,
    updated_by: actor.userId,
    ts,
  });
  logRevision(data.id as string, 'create', actor.userId, actor.name || '', { status: data.status ?? 'draft' });
  return get(data.id as string) as ContentProgrammeRow;
}

export function update(id: string, data: ProgrammeInput, actor: Actor): ContentProgrammeRow | null {
  const c = conn();
  if (!c) throw Object.assign(new Error('Programmes need the SQLite store.'), { status: 500 });
  ensureSeeded();
  const existing = get(id);
  if (!existing) return null;
  // The public id never changes; a rename would orphan clients. Copy rather
  // than mutating the caller's payload (the audit trail logs the copy).
  const patch: ProgrammeInput = { ...data };
  delete patch.id;
  validateInput(patch, true, existing);

  const merged: Record<string, unknown> = { ...existing, ...writeParams(patch), updated_at: now(), updated_by: actor.userId };
  c.prepare(`
    UPDATE content_programmes SET
      destination = @destination, title_en = @title_en, title_ar = @title_ar,
      tagline_en = @tagline_en, tagline_ar = @tagline_ar,
      duration_days = @duration_days, ideal_for_en = @ideal_for_en, ideal_for_ar = @ideal_for_ar,
      pace = @pace, pace_ar = @pace_ar,
      intensity_score = @intensity_score, free_time_score = @free_time_score,
      starting_price_egp = @starting_price_egp, price_is_estimate = @price_is_estimate,
      hero_image = @hero_image, badge_en = @badge_en, badge_ar = @badge_ar,
      highlights_en = @highlights_en, highlights_ar = @highlights_ar,
      included_en = @included_en, included_ar = @included_ar,
      customizable_en = @customizable_en, customizable_ar = @customizable_ar,
      default_interests = @default_interests, default_budget = @default_budget,
      day_by_day = @day_by_day, status = @status, sort_order = @sort_order,
      updated_by = @updated_by, updated_at = @updated_at
    WHERE id = @id
  `).run({
    ...merged,
    highlights_en: JSON.stringify(merged.highlights_en ?? []),
    highlights_ar: JSON.stringify(merged.highlights_ar ?? []),
    included_en: JSON.stringify(merged.included_en ?? []),
    included_ar: JSON.stringify(merged.included_ar ?? []),
    customizable_en: JSON.stringify(merged.customizable_en ?? []),
    customizable_ar: JSON.stringify(merged.customizable_ar ?? []),
    default_interests: JSON.stringify(merged.default_interests ?? []),
    day_by_day: JSON.stringify(merged.day_by_day ?? []),
    price_is_estimate: merged.price_is_estimate ? 1 : 0,
  });
  logRevision(id, 'update', actor.userId, actor.name || '', patch as Record<string, unknown>);
  return get(id);
}

export function setStatus(id: string, status: 'published' | 'archived' | 'draft', actor: Actor): ContentProgrammeRow | null {
  const c = conn();
  if (!c) throw Object.assign(new Error('Programmes need the SQLite store.'), { status: 500 });
  ensureSeeded();
  const existing = get(id);
  if (!existing) return null;
  c.prepare('UPDATE content_programmes SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(status, actor.userId, now(), id);
  logRevision(id, `status:${status}`, actor.userId, actor.name || '', { from: existing.status, to: status });
  return get(id);
}

export function remove(id: string, actor: Actor): boolean {
  const c = conn();
  if (!c) throw Object.assign(new Error('Programmes need the SQLite store.'), { status: 500 });
  ensureSeeded();
  const existing = get(id);
  if (!existing) return false;
  const result = c.prepare('DELETE FROM content_programmes WHERE id = ?').run(id);
  logRevision(id, 'delete', actor.userId, actor.name || '', { title_en: existing.title_en });
  return result.changes > 0;
}

export const contentProgrammes = {
  PROGRAMME_DESTINATIONS,
  PROGRAMME_STATUSES,
  listPublic,
  listAdmin,
  get,
  create,
  update,
  setStatus,
  remove,
  ensureSeeded,
};
