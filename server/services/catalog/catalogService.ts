import { db } from '../../db/database';
import type { CatalogMetaEntity, CatalogStatus, RoomTypeEntity } from '../../db/schema';
import { upsertRateNight } from '../../api/adminHotelRoutes';
import { auditService } from '../auditService';
import { approvalService, registerApprovalExecutor } from '../approvalService';
import { streamEvent } from '../staffEventStream';
import { applyList, parseListParams, type ListResult } from '../../lib/listQuery';
import { TOP_LEVEL_KEYS, allFields, applyValues, completenessOf, normalizeValue } from './fields';
import { conflict, dateRange, newId, skuById, to12h, to24h } from './common';
import { recomputeSlotStatus } from './activityAdapter';
import { roomsChild } from './hotelAdapter';
import { ADAPTERS, CATALOG_TYPES, adapterFor } from './registry';
import {
  CatalogError,
  type CatalogAdapter,
  type CatalogCtx,
  type CatalogType,
  type ChildAdapter,
  type Envelope,
  type MetaView,
  type SectionDef,
} from './types';

/**
 * The catalogue surface (docs/CATALOG_API_CONTRACT.md): one uniform CRUD
 * over the existing collections, driven by the adapters in ./registry.
 *
 * Invariants every operation keeps:
 *   - a supplier context (ctx.supplierScope) only ever sees rows it owns,
 *     and "not yours" answers exactly like "does not exist" (404);
 *   - every write runs in one transaction, bumps the version (`updatedAt`,
 *     the If-Match value), is audited with before/after and goes on the
 *     staff stream;
 *   - publishing requires completeness (422 incomplete), deleting requires
 *     an unbooked draft (409 in-use);
 *   - a supplier publish becomes `review` + an approval, and a supplier price
 *     change above 30% is queued as an approval instead of applied.
 */

export const EPOCH = '1970-01-01T00:00:00.000Z';
export const PRICE_REVIEW_RATIO = 0.3;
export const MAX_RANGE_DAYS = 366;

type AnyAdapter = CatalogAdapter<any>;

// ─── meta rows ──────────────────────────────────────────────────────────────

const metaId = (type: string, id: string) => `${type}:${id}`;

function metaRow(type: string, id: string): CatalogMetaEntity | undefined {
  const key = metaId(type, id);
  return db.catalogMeta.find(m => m.id === key);
}

function viewOf(row: CatalogMetaEntity | undefined): MetaView {
  if (!row) return { extra: {} };
  if (!row.extra) row.extra = {};
  return row as MetaView;
}

function ensureMeta(adapter: AnyAdapter, e: unknown): CatalogMetaEntity {
  const id = adapter.idOf(e);
  let row = metaRow(adapter.type, id);
  if (!row) {
    row = {
      id: metaId(adapter.type, id),
      type: adapter.type,
      entityId: id,
      status: statusOf(adapter, e, undefined),
      updatedAt: versionOf(adapter, e, undefined),
      extra: {},
    };
    db.catalogMeta.push(row);
  }
  return row;
}

export function statusOf(adapter: AnyAdapter, e: unknown, row: CatalogMetaEntity | undefined): CatalogStatus {
  const native = adapter.nativeStatus(e);
  if (!row) return native;
  // The entity's own on/off switch wins over a stale meta row: another
  // surface (/api/admin/hotel, transfers ops) may have flipped it since.
  if (adapter.hasNativeActive(e)) {
    if (row.status === 'published' && native !== 'published') return 'hidden';
    if (row.status !== 'published' && native === 'published') return 'published';
  }
  return row.status;
}

function versionOf(adapter: AnyAdapter, e: unknown, row: CatalogMetaEntity | undefined): string {
  return row?.updatedAt ?? adapter.entityUpdatedAt?.(e) ?? EPOCH;
}

/** Strictly increasing per row, so two writes in one millisecond still differ. */
function touch(adapter: AnyAdapter, e: unknown, row: CatalogMetaEntity, userId: string) {
  let at = new Date().toISOString();
  if (row.updatedAt && at <= row.updatedAt) at = new Date(Date.parse(row.updatedAt) + 1).toISOString();
  row.updatedAt = at;
  row.updatedBy = userId;
  adapter.touchEntity?.(e, at, userId);
}

function setStatus(adapter: AnyAdapter, e: unknown, row: CatalogMetaEntity, status: CatalogStatus) {
  row.status = status;
  adapter.applyStatus(e, status);
}

// ─── envelopes ──────────────────────────────────────────────────────────────

const EMPTY_I18N = { en: '', ar: '' };

function supplierNameOf(id: string | null, cache?: Map<string, string>): string | null {
  if (!id) return null;
  if (cache) return cache.get(id) ?? null;
  return db.suppliers.find(s => s.id === id)?.businessName ?? null;
}

function project<E>(sections: SectionDef<E>[], e: E, meta: MetaView, priceKey: string) {
  const values: Record<string, unknown> = {};
  for (const f of allFields(sections)) values[f.key] = f.get(e, meta);
  const images = Array.isArray(values.images) ? (values.images as string[]) : [];
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (!TOP_LEVEL_KEYS.has(k)) fields[k] = v ?? null;
  const price = values[priceKey];
  return {
    title: (values.title as Envelope['title']) ?? EMPTY_I18N,
    summary: (values.summary as Envelope['summary']) ?? EMPTY_I18N,
    images,
    coverImage: images[0] ?? null,
    priceFromEGP: typeof price === 'number' ? price : 0,
    fields,
    ...completenessOf(sections, e, meta),
  };
}

export function toEnvelope(adapter: AnyAdapter, e: unknown, sections = adapter.sections(), names?: Map<string, string>): Envelope {
  const row = metaRow(adapter.type, adapter.idOf(e));
  const supplierId = adapter.supplierOf(e);
  return {
    id: adapter.idOf(e),
    type: adapter.type,
    status: statusOf(adapter, e, row),
    supplierId,
    supplierName: supplierNameOf(supplierId, names),
    ...project(sections, e, viewOf(row), adapter.priceKey),
    updatedAt: versionOf(adapter, e, row),
    updatedBy: row?.updatedBy ?? null,
  };
}

function childEnvelope(adapter: AnyAdapter, parent: unknown, child: ChildAdapter<any, any>, c: unknown, sections = child.sections()): Envelope {
  const parentRow = metaRow(adapter.type, adapter.idOf(parent));
  const supplierId = adapter.supplierOf(parent);
  const own = (c as { updatedAt?: unknown }).updatedAt;
  return {
    id: child.idOf(c),
    type: child.itemType,
    status: child.statusOf?.(c) ?? 'published',
    supplierId,
    supplierName: supplierNameOf(supplierId),
    ...project(sections, c, { extra: {} }, child.priceKey ?? 'priceFromEGP'),
    updatedAt: typeof own === 'string' ? own : versionOf(adapter, parent, parentRow),
    updatedBy: parentRow?.updatedBy ?? null,
  };
}

// ─── loading & guards ───────────────────────────────────────────────────────

function guardType(adapter: AnyAdapter, ctx: CatalogCtx) {
  if (ctx.supplierScope !== null && !adapter.supplierOwned) {
    throw new CatalogError(403, `The supplier portal cannot manage ${adapter.type} records.`, 'forbidden');
  }
}

function load(type: string, id: string, ctx: CatalogCtx) {
  const adapter = adapterFor(type);
  guardType(adapter, ctx);
  const e = adapter.rows().find((r: unknown) => adapter.idOf(r) === id);
  // "Not yours" and "does not exist" are the same answer: no probing.
  if (!e || (ctx.supplierScope !== null && adapter.supplierOf(e) !== ctx.supplierScope)) {
    throw new CatalogError(404, `${type} ${id} not found.`);
  }
  return { adapter, e, row: metaRow(adapter.type, id) };
}

/** Accepts `"ts"`, `W/"ts"` or a bare timestamp. */
export function parseIfMatch(header: unknown): string | undefined {
  if (typeof header !== 'string' || !header.trim()) return undefined;
  return header.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
}

function checkVersion(current: string, ifMatch: string | undefined) {
  if (ifMatch !== undefined && ifMatch !== '*' && ifMatch !== current) {
    throw conflict('The record changed since you loaded it. Reload and re-apply your edit.', 'stale', { currentUpdatedAt: current });
  }
}

function requireReason(reason: unknown, why: string): string {
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
    throw new CatalogError(400, `reason (3..500 characters) is required ${why}.`, 'reason-required');
  }
  return reason.trim();
}

function bigPriceChange(before: unknown, after: unknown): boolean {
  if (typeof before !== 'number' || typeof after !== 'number' || before <= 0) return false;
  return Math.abs(after - before) / before > PRICE_REVIEW_RATIO;
}

// ─── audit + stream ─────────────────────────────────────────────────────────

function record(ctx: CatalogCtx, action: string, type: string, id: string, before: unknown, after: unknown, reason?: string, supplierId?: string | null) {
  auditService.record({
    actor: ctx.actor.userId,
    actorRole: ctx.actor.role,
    action,
    entityType: `catalog.${type}`,
    entityId: id,
    before,
    after,
    reason,
    correlationId: ctx.correlationId,
    extra: ctx.supplierScope ? { supplierScope: ctx.supplierScope } : undefined,
  });
  streamEvent('CatalogItemChanged', {
    entityType: `catalog.${type}`,
    entityId: id,
    summary: `${action.replace(/^CATALOG_/, '').toLowerCase().replace(/_/g, ' ')} ${type} ${id}`,
    ...(supplierId ? { supplierId } : {}),
  });
}

// ─── body → values ──────────────────────────────────────────────────────────

export interface WriteBody {
  title?: unknown;
  summary?: unknown;
  images?: unknown;
  fields?: Record<string, unknown>;
  supplierId?: unknown;
  reason?: unknown;
}

function valuesOf(body: WriteBody): Record<string, unknown> {
  const values: Record<string, unknown> = { ...(body.fields ?? {}) };
  if (body.title !== undefined) values.title = body.title;
  if (body.summary !== undefined) values.summary = body.summary;
  if (body.images !== undefined) values.images = body.images;
  delete values.supplierId;
  return values;
}

/** Validated owner from the body (staff only; suppliers are pinned to themselves). */
function bodySupplier(adapter: AnyAdapter, body: WriteBody, ctx: CatalogCtx): string | null | undefined {
  if (ctx.supplierScope !== null) return undefined;
  const raw = body.supplierId !== undefined ? body.supplierId : body.fields?.supplierId;
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const f = allFields(adapter.sections()).find(x => x.key === 'supplierId');
  if (!f) throw new CatalogError(400, `supplierId: ${adapter.type} records have no supplier.`);
  return normalizeValue(f, raw, undefined) as string;
}

// ─── list / get / schema summary ────────────────────────────────────────────

const SORTABLE = ['title', 'status', 'priceFromEGP', 'updatedAt', 'completeness', 'supplierName'];

export function list(type: string, query: Record<string, unknown>, ctx: CatalogCtx): ListResult<Envelope> {
  const adapter = adapterFor(type);
  guardType(adapter, ctx);
  const sections = adapter.sections();
  const names = new Map(db.suppliers.map(s => [s.id, s.businessName]));
  let rows: unknown[] = adapter.rows();
  if (ctx.supplierScope !== null) rows = rows.filter(r => adapter.supplierOf(r) === ctx.supplierScope);
  let envs = rows.map(r => toEnvelope(adapter, r, sections, names));

  const statuses = typeof query.status === 'string' && query.status ? query.status.split(',') : null;
  envs = statuses ? envs.filter(e => statuses.includes(e.status)) : envs.filter(e => e.status !== 'archived');
  if (ctx.supplierScope === null && typeof query.supplierId === 'string' && query.supplierId) {
    envs = envs.filter(e => e.supplierId === query.supplierId);
  }
  for (const key of adapter.filters) {
    if (key === 'status' || key === 'supplierId') continue;
    const want = query[key];
    if (typeof want !== 'string' || !want) continue;
    envs = envs.filter(e => {
      const v = e.fields[key];
      return Array.isArray(v) ? v.includes(want) : String(v ?? '') === want;
    });
  }
  const params = parseListParams(query, SORTABLE);
  const sortRows = envs.map(e => ({ e, title: e.title.en.toLowerCase(), status: e.status, priceFromEGP: e.priceFromEGP, updatedAt: e.updatedAt, completeness: e.completeness, supplierName: e.supplierName }));
  const out = applyList(sortRows, params.sort ? params : { ...params, sort: { field: 'title', desc: false } }, {
    searchFields: [r => r.e.title.en, r => r.e.title.ar, r => r.e.id, r => r.e.supplierName],
  });
  return { ...out, items: out.items.map(r => r.e) };
}

export function get(type: string, id: string, ctx: CatalogCtx) {
  const { adapter, e } = load(type, id, ctx);
  const children: Record<string, Envelope[]> = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const child of adapter.children) {
    const sections = child.sections();
    const rows = child.list(e, child.key === 'slots' ? { from: today } : {}).slice(0, 200);
    children[child.key] = rows.map((c: unknown) => childEnvelope(adapter, e, child, c, sections));
  }
  return { item: toEnvelope(adapter, e), children };
}

/** Catalogue home: per type count, drafts and items waiting for review. */
export function summary(ctx: CatalogCtx, allowed: (a: AnyAdapter) => boolean) {
  return {
    types: CATALOG_TYPES.map(t => ADAPTERS[t]).filter(a => allowed(a) && (ctx.supplierScope === null || a.supplierOwned)).map(adapter => {
      let rows: unknown[] = adapter.rows();
      if (ctx.supplierScope !== null) rows = rows.filter(r => adapter.supplierOf(r) === ctx.supplierScope);
      const counts: Record<CatalogStatus, number> = { draft: 0, published: 0, hidden: 0, archived: 0, review: 0 };
      for (const r of rows) counts[statusOf(adapter, r, metaRow(adapter.type, adapter.idOf(r)))]++;
      return { type: adapter.type, label: adapter.label, icon: adapter.icon, total: rows.length - counts.archived, ...counts };
    }),
  };
}

// ─── create / patch ─────────────────────────────────────────────────────────

export function create(type: string, body: WriteBody, ctx: CatalogCtx): Envelope {
  const adapter = adapterFor(type);
  guardType(adapter, ctx);
  const values = valuesOf(body);
  const title = values.title as { en?: unknown; ar?: unknown } | undefined;
  if (!title || (!(typeof title.en === 'string' && title.en.trim()) && !(typeof title.ar === 'string' && title.ar.trim()))) {
    throw new CatalogError(400, 'title: an English or Arabic title is required.', 'bad-request', { field: 'title' });
  }
  const owner = ctx.supplierScope ?? bodySupplier(adapter, body, ctx) ?? null;
  const sections = adapter.sections();
  const e = db.runInTransaction(() => {
    const entity = adapter.blank(owner, body as Record<string, unknown>);
    const meta: MetaView = { extra: {} };
    applyValues(sections, entity, meta, values);
    adapter.insert(entity, meta);
    const id = adapter.idOf(entity);
    if (metaRow(adapter.type, id)) throw conflict(`${type} ${id} already exists.`);
    const row: CatalogMetaEntity = { id: metaId(adapter.type, id), type: adapter.type, entityId: id, status: 'draft', updatedAt: EPOCH, images: meta.images, extra: meta.extra };
    db.catalogMeta.push(row);
    adapter.afterWrite?.(entity, viewOf(row));
    // New records are always drafts (contract), whatever the body says.
    setStatus(adapter, entity, row, 'draft');
    touch(adapter, entity, row, ctx.actor.userId);
    return entity;
  });
  const env = toEnvelope(adapter, e);
  record(ctx, 'CATALOG_CREATE', type, env.id, undefined, env, undefined, env.supplierId);
  return env;
}

export interface WriteResult {
  item: Envelope;
  /** Set when the change was queued for staff review instead of applied. */
  approvalId?: string;
}

export function patch(type: string, id: string, body: WriteBody, ifMatch: string | undefined, ctx: CatalogCtx): WriteResult {
  const { adapter, e, row } = load(type, id, ctx);
  checkVersion(versionOf(adapter, e, row), ifMatch);
  const before = toEnvelope(adapter, e);
  const values = valuesOf(body);
  const owner = bodySupplier(adapter, body, ctx);
  let reason: string | undefined = typeof body.reason === 'string' ? body.reason.trim() : undefined;

  if (adapter.priceKey in values) {
    const priceField = allFields(adapter.sections()).find(f => f.key === adapter.priceKey);
    const next = priceField ? normalizeValue(priceField, values[adapter.priceKey], before.priceFromEGP) : undefined;
    if (bigPriceChange(before.priceFromEGP, next)) {
      if (ctx.supplierScope !== null) {
        return { item: before, approvalId: queuePrice(adapter.type, id, { op: 'patch', body: { ...body, supplierId: undefined } }, ctx, before.title.en) };
      }
      reason = requireReason(body.reason, 'for a price change above 30%');
    }
  }

  db.runInTransaction(() => {
    const meta = ensureMeta(adapter, e);
    const status = statusOf(adapter, e, meta);
    applyValues(adapter.sections(), e, viewOf(meta), values);
    if (owner !== undefined) adapter.setSupplier(e, owner);
    adapter.afterWrite?.(e, viewOf(meta));
    setStatus(adapter, e, meta, status);
    touch(adapter, e, meta, ctx.actor.userId);
  });
  const after = toEnvelope(adapter, e);
  record(ctx, 'CATALOG_UPDATE', type, id, before, after, reason, after.supplierId);
  return { item: after };
}

// ─── state changes ──────────────────────────────────────────────────────────

export type Transition = 'publish' | 'hide' | 'archive' | 'restore';

export function transition(type: string, id: string, action: Transition, body: { reason?: unknown }, ifMatch: string | undefined, ctx: CatalogCtx): WriteResult {
  const { adapter, e, row } = load(type, id, ctx);
  checkVersion(versionOf(adapter, e, row), ifMatch);
  const before = toEnvelope(adapter, e);
  const reason = action === 'archive' ? requireReason(body.reason, 'to archive') : typeof body.reason === 'string' ? body.reason.trim() || undefined : undefined;

  let next: CatalogStatus = before.status;
  switch (action) {
    case 'publish':
      if (before.status === 'archived') throw conflict('Restore the record before publishing it.', 'invalid-transition');
      if (before.missing.length) {
        throw new CatalogError(422, `Complete these fields before publishing: ${before.missing.join(', ')}.`, 'incomplete', { missing: before.missing });
      }
      next = ctx.supplierScope !== null ? 'review' : 'published';
      break;
    case 'hide':
      if (before.status === 'archived') throw conflict('An archived record is already offline; restore it first.', 'invalid-transition');
      next = 'hidden';
      break;
    case 'archive':
      next = 'archived';
      break;
    case 'restore':
      if (before.status !== 'archived') throw conflict('Only archived records can be restored.', 'invalid-transition');
      next = 'draft';
      break;
  }

  db.runInTransaction(() => {
    const meta = ensureMeta(adapter, e);
    setStatus(adapter, e, meta, next);
    touch(adapter, e, meta, ctx.actor.userId);
  });
  const after = toEnvelope(adapter, e);
  let approvalId: string | undefined;
  if (next === 'review') {
    approvalId = approvalService.request(
      `catalog.${type}.publish`,
      `Publish ${type} "${after.title.en || after.title.ar}" (${id}) for supplier ${ctx.supplierScope}`,
      { type, id, supplierId: ctx.supplierScope, ...(reason ? { reason } : {}) },
      ctx.actor,
      ctx.correlationId
    ).id;
  }
  record(ctx, next === 'review' ? 'CATALOG_REVIEW_REQUESTED' : `CATALOG_${action.toUpperCase()}`, type, id, { status: before.status }, { status: after.status, ...(approvalId ? { approvalId } : {}) }, reason, after.supplierId);
  return { item: after, approvalId };
}

export function remove(type: string, id: string, body: { reason?: unknown }, ifMatch: string | undefined, ctx: CatalogCtx) {
  const reason = requireReason(body.reason, 'to delete');
  const { adapter, e, row } = load(type, id, ctx);
  checkVersion(versionOf(adapter, e, row), ifMatch);
  const before = toEnvelope(adapter, e);
  if (before.status !== 'draft') {
    throw conflict(`Only drafts can be deleted; this record is ${before.status}. Archive it instead.`, 'in-use', { status: before.status });
  }
  const why = adapter.inUse(e);
  if (why) throw conflict(`${why} Archive it instead.`, 'in-use', { reason: why });
  db.runInTransaction(() => {
    adapter.remove(e);
    const at = db.catalogMeta.findIndex(m => m.id === metaId(type, id));
    if (at >= 0) db.catalogMeta.splice(at, 1);
  });
  record(ctx, 'CATALOG_DELETE', type, id, before, undefined, reason, before.supplierId);
  return { deleted: true, id };
}

export function duplicate(type: string, id: string, ctx: CatalogCtx): Envelope {
  const { adapter, e, row } = load(type, id, ctx);
  const copy = db.runInTransaction(() => {
    const entity = adapter.duplicate(e);
    const meta: MetaView = { images: row?.images ? [...row.images] : undefined, extra: JSON.parse(JSON.stringify(row?.extra ?? {})) };
    adapter.insert(entity, meta);
    const newId_ = adapter.idOf(entity);
    const copyRow: CatalogMetaEntity = { id: metaId(type, newId_), type, entityId: newId_, status: 'draft', updatedAt: EPOCH, images: meta.images, extra: meta.extra };
    db.catalogMeta.push(copyRow);
    adapter.afterWrite?.(entity, viewOf(copyRow));
    setStatus(adapter, entity, copyRow, 'draft');
    touch(adapter, entity, copyRow, ctx.actor.userId);
    return entity;
  });
  const env = toEnvelope(adapter, copy);
  record(ctx, 'CATALOG_DUPLICATE', type, env.id, { sourceId: id }, env, undefined, env.supplierId);
  return env;
}

export interface BulkBody {
  ids: string[];
  action: 'publish' | 'hide' | 'archive' | 'price';
  value?: number | { percent: number };
  reason: string;
}

export function bulk(type: string, body: BulkBody, ctx: CatalogCtx) {
  const adapter = adapterFor(type);
  guardType(adapter, ctx);
  const results = body.ids.map(id => {
    try {
      if (body.action === 'price') {
        const current = load(type, id, ctx);
        const old = toEnvelope(adapter, current.e).priceFromEGP;
        const v = body.value;
        const price = typeof v === 'number' ? v : v && typeof v.percent === 'number' ? Math.round(old * (1 + v.percent / 100)) : NaN;
        if (!Number.isFinite(price) || price < 0) throw new CatalogError(400, 'value must be a price (number) or { percent }.');
        const res = patch(type, id, { fields: { [adapter.priceKey]: price }, reason: body.reason }, undefined, ctx);
        return { id, ok: true, status: res.item.status, ...(res.approvalId ? { approvalId: res.approvalId } : {}) };
      }
      const res = transition(type, id, body.action, { reason: body.reason }, undefined, ctx);
      return { id, ok: true, status: res.item.status, ...(res.approvalId ? { approvalId: res.approvalId } : {}) };
    } catch (err) {
      const ce = err instanceof CatalogError ? err : null;
      return { id, ok: false, error: { status: ce?.status ?? 500, slug: ce?.slug ?? 'error', detail: (err as Error).message, ...(ce?.extra ?? {}) } };
    }
  });
  return { results, succeeded: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length };
}

// ─── children ───────────────────────────────────────────────────────────────

function childOf(adapter: AnyAdapter, key: string): ChildAdapter<any, any> {
  const child = adapter.children.find(c => c.key === key);
  if (!child) throw new CatalogError(404, `${adapter.type} has no "${key}" children.`);
  return child;
}

/** A child write changes the parent: bump its version and keep its status mirrored. */
function touchParent(adapter: AnyAdapter, e: unknown, userId: string) {
  const meta = ensureMeta(adapter, e);
  touch(adapter, e, meta, userId);
}

export function childList(type: string, id: string, key: string, query: Record<string, unknown>, ctx: CatalogCtx) {
  const { adapter, e } = load(type, id, ctx);
  const child = childOf(adapter, key);
  const sections = child.sections();
  return { items: child.list(e, query).map((c: unknown) => childEnvelope(adapter, e, child, c, sections)) };
}

export function childCreate(type: string, id: string, key: string, body: WriteBody, ctx: CatalogCtx): Envelope {
  const { adapter, e } = load(type, id, ctx);
  const child = childOf(adapter, key);
  const sections = child.sections();
  const c = db.runInTransaction(() => {
    const row = child.blank(e, body as Record<string, unknown>);
    applyValues(sections, row, { extra: {} }, valuesOf(body));
    child.insert(e, row);
    child.afterWrite?.(e, row);
    touchParent(adapter, e, ctx.actor.userId);
    return row;
  });
  const env = childEnvelope(adapter, e, child, c);
  record(ctx, 'CATALOG_CHILD_CREATE', type, id, undefined, { child: key, item: env }, undefined, adapter.supplierOf(e));
  return env;
}

export function childPatch(type: string, id: string, key: string, childId: string, body: WriteBody, ctx: CatalogCtx): WriteResult {
  const { adapter, e } = load(type, id, ctx);
  const child = childOf(adapter, key);
  const c = child.find(e, childId);
  if (!c) throw new CatalogError(404, `${key} ${childId} not found.`);
  const sections = child.sections();
  const before = childEnvelope(adapter, e, child, c, sections);
  const values = valuesOf(body);
  let reason: string | undefined = typeof body.reason === 'string' ? body.reason.trim() : undefined;
  const priceKey = child.priceKey;
  if (priceKey && priceKey in values) {
    const f = allFields(sections).find(x => x.key === priceKey);
    const next = f ? normalizeValue(f, values[priceKey], before.priceFromEGP) : undefined;
    if (bigPriceChange(before.priceFromEGP, next)) {
      if (ctx.supplierScope !== null) {
        return { item: before, approvalId: queuePrice(type, id, { op: 'child', childKey: key, childId, body: { ...body, supplierId: undefined } }, ctx, before.title.en) };
      }
      reason = requireReason(body.reason, 'for a price change above 30%');
    }
  }
  db.runInTransaction(() => {
    applyValues(sections, c, { extra: {} }, values);
    child.afterWrite?.(e, c);
    touchParent(adapter, e, ctx.actor.userId);
  });
  const after = childEnvelope(adapter, e, child, c, sections);
  record(ctx, 'CATALOG_CHILD_UPDATE', type, id, { child: key, item: before }, { child: key, item: after }, reason, adapter.supplierOf(e));
  return { item: after };
}

export function childDelete(type: string, id: string, key: string, childId: string, body: { reason?: unknown }, ctx: CatalogCtx) {
  const reason = requireReason(body.reason, 'to delete');
  const { adapter, e } = load(type, id, ctx);
  const child = childOf(adapter, key);
  const c = child.find(e, childId);
  if (!c) throw new CatalogError(404, `${key} ${childId} not found.`);
  const why = child.inUse(e, c);
  if (why) throw conflict(why, 'in-use', { reason: why });
  const before = childEnvelope(adapter, e, child, c);
  db.runInTransaction(() => {
    child.remove(e, c);
    touchParent(adapter, e, ctx.actor.userId);
  });
  record(ctx, 'CATALOG_CHILD_DELETE', type, id, { child: key, item: before }, undefined, reason, adapter.supplierOf(e));
  return { deleted: true, id: childId };
}

// ─── hotel rate calendar ────────────────────────────────────────────────────

function roomOf(hotelId: string, roomId: unknown): RoomTypeEntity {
  const room = db.roomTypes.find(r => r.id === roomId && r.accommodationId === hotelId);
  if (!room) throw new CatalogError(404, `Room type ${String(roomId)} not found at this property.`);
  return room;
}

export function getRates(id: string, query: Record<string, unknown>, ctx: CatalogCtx) {
  const { e } = load('hotel', id, ctx);
  const from = typeof query.from === 'string' ? query.from : new Date().toISOString().slice(0, 10);
  const to = typeof query.to === 'string' ? query.to : new Date(Date.parse(`${from}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
  const dates = dateRange(from, to, undefined, MAX_RANGE_DAYS);
  const rooms = query.roomId ? [roomOf(id, query.roomId)] : roomsChild.list(e, {});
  const overrides = new Map(db.roomRateNights.filter(n => n.accommodationId === id).map(n => [`${n.roomTypeId}|${n.date}`, n]));
  const nights = rooms.flatMap(room => dates.map(date => {
    const o = overrides.get(`${room.id}|${date}`);
    return { date, roomId: room.id, nightlyEGP: o?.nightlyEGP ?? room.baseNightlyEGP, closed: o?.closed ?? false, overridden: !!o };
  }));
  return { from, to, nights };
}

export interface RatesBody {
  roomId: string;
  from: string;
  to: string;
  nightlyEGP?: number;
  closed?: boolean;
  weekdays?: number[];
  reason?: string;
}

export function putRates(id: string, body: RatesBody, ctx: CatalogCtx): { applied: number; approvalId?: string } {
  const { adapter, e } = load('hotel', id, ctx);
  const room = roomOf(id, body.roomId);
  const dates = dateRange(body.from, body.to, body.weekdays, MAX_RANGE_DAYS);
  if (body.nightlyEGP === undefined && body.closed === undefined) throw new CatalogError(400, 'Set nightlyEGP and/or closed.');
  let reason = body.reason?.trim() || undefined;
  if (body.nightlyEGP !== undefined && bigPriceChange(room.baseNightlyEGP, body.nightlyEGP)) {
    if (ctx.supplierScope !== null) return { applied: 0, approvalId: queuePrice('hotel', id, { op: 'rates', body }, ctx, room.name) };
    reason = requireReason(body.reason, 'for a nightly rate more than 30% off the base rate');
  }
  const patchBody: Record<string, number | boolean | string> = {};
  if (body.nightlyEGP !== undefined) patchBody.nightlyEGP = body.nightlyEGP;
  if (body.closed !== undefined) patchBody.closed = body.closed;
  if (body.closed && reason) patchBody.closedReason = reason.slice(0, 200);
  db.runInTransaction(() => {
    for (const date of dates) upsertRateNight(room, date, patchBody, ctx.actor.userId);
    touchParent(adapter, e, ctx.actor.userId);
  });
  record(ctx, 'CATALOG_RATES_SET', 'hotel', id, undefined, { roomId: room.id, from: body.from, to: body.to, weekdays: body.weekdays, nightlyEGP: body.nightlyEGP, closed: body.closed, nights: dates.length }, reason, adapter.supplierOf(e));
  return { applied: dates.length };
}

// ─── activity departures ────────────────────────────────────────────────────

export interface SlotsBody {
  from: string;
  to: string;
  times: string[];
  capacity: number;
  weekdays?: number[];
  closed?: boolean;
}

export function putSlots(id: string, body: SlotsBody, ctx: CatalogCtx) {
  const { adapter, e } = load('activity', id, ctx);
  const sku = skuById(e.skuId);
  if (!sku) throw conflict('This activity has no bookable SKU yet — assign a supplier first.');
  const dates = dateRange(body.from, body.to, body.weekdays, MAX_RANGE_DAYS);
  let created = 0;
  let updated = 0;
  const clamped: string[] = [];
  db.runInTransaction(() => {
    for (const date of dates) {
      for (const time of body.times) {
        const label = to12h(time);
        let slot = db.inventorySlots.find(s => s.skuId === sku.id && s.date === date && (s.timeSlot === label || to24h(s.timeSlot) === time));
        const floor = slot ? slot.reservedCapacity + slot.heldCapacity : 0;
        const want = body.closed ? floor : Math.max(body.capacity, floor);
        if (!body.closed && slot && body.capacity < floor) clamped.push(slot.id);
        if (slot) {
          slot.totalCapacity = want;
          updated++;
        } else {
          slot = {
            id: newId(`SLOT-${sku.id}-${date}`), skuId: sku.id, date, timeSlot: label, totalCapacity: want,
            reservedCapacity: 0, heldCapacity: 0, priceEGP: sku.basePriceEGP, status: 'AVAILABLE',
          };
          db.inventorySlots.push(slot);
          created++;
        }
        recomputeSlotStatus(slot);
      }
    }
    touchParent(adapter, e, ctx.actor.userId);
  });
  const result = { applied: created + updated, created, updated, dates: dates.length, clampedToBooked: clamped };
  record(ctx, 'CATALOG_SLOTS_SET', 'activity', id, undefined, { ...body, ...result }, undefined, adapter.supplierOf(e));
  return result;
}

// ─── approvals ──────────────────────────────────────────────────────────────

interface PricePayload {
  op: 'patch' | 'child' | 'rates';
  childKey?: string;
  childId?: string;
  body: unknown;
}

function queuePrice(type: string, id: string, payload: PricePayload, ctx: CatalogCtx, label: string): string {
  return approvalService.request(
    `catalog.${type}.price`,
    `Price change above 30% on ${type} "${label}" (${id}) by supplier ${ctx.supplierScope}`,
    { type, id, supplierId: ctx.supplierScope, ...payload, reason: `Supplier price change above 30% on ${type} ${id}` },
    ctx.actor,
    ctx.correlationId
  ).id;
}

for (const type of CATALOG_TYPES) {
  registerApprovalExecutor(`catalog.${type}.publish`, (p, x) => {
    const ctx: CatalogCtx = { actor: x.decidedBy, supplierScope: null };
    return transition(type, String(p.id), 'publish', { reason: `Approved ${x.approvalId}` }, undefined, ctx).item;
  });
  registerApprovalExecutor(`catalog.${type}.price`, (p, x) => {
    const ctx: CatalogCtx = { actor: x.decidedBy, supplierScope: null };
    const reason = `${p.reason} (approval ${x.approvalId}, requested by ${x.requestedBy})`;
    if (p.op === 'rates') return putRates(String(p.id), { ...(p.body as RatesBody), reason }, ctx);
    if (p.op === 'child') return childPatch(type, String(p.id), String(p.childKey), String(p.childId), { ...(p.body as WriteBody), reason }, ctx).item;
    return patch(type, String(p.id), { ...(p.body as WriteBody), reason }, undefined, ctx).item;
  });
}

export type { CatalogType };
export const catalogService = {
  list, get, summary, create, patch, transition, remove, duplicate, bulk,
  childList, childCreate, childPatch, childDelete, getRates, putRates, putSlots, toEnvelope, parseIfMatch,
};
