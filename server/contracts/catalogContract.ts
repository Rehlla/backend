import { z } from 'zod';
import { ListQuery, Reason, listOf, type EndpointDef } from './opsContract';

/**
 * Zod schemas for docs/CATALOG_API_CONTRACT.md. Routes validate request
 * bodies with these (a failed parse is a 400 RFC7807); scripts/gen-openapi.ts
 * adds CATALOG_ENDPOINTS to openapi.json. Field-level values inside `fields`
 * are validated by the schema-driven engine (server/services/catalog/fields.ts),
 * so `fields` is an open record here.
 */

export const CatalogStatus = z.enum(['draft', 'published', 'hidden', 'archived', 'review']);
export const I18n = z.object({ en: z.string(), ar: z.string() });
const I18nIn = z.object({ en: z.string().max(4000).optional(), ar: z.string().max(4000).optional() }).strict();
const Fields = z.record(z.string(), z.unknown());

export const CatalogEnvelope = z.object({
  id: z.string(),
  type: z.string(),
  status: CatalogStatus,
  supplierId: z.string().nullable(),
  supplierName: z.string().nullable(),
  title: I18n,
  summary: I18n,
  coverImage: z.string().nullable(),
  images: z.array(z.string()),
  priceFromEGP: z.number(),
  fields: Fields,
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
  completeness: z.number().min(0).max(1),
  missing: z.array(z.string()),
});

const FieldSchema = z.object({
  key: z.string(),
  kind: z.enum(['text', 'i18nText', 'i18nTextarea', 'number', 'money', 'boolean', 'select', 'multiselect', 'tags', 'time', 'timeList', 'duration', 'geo', 'gallery', 'supplier', 'dayPlan', 'json']),
  label: I18n,
  required: z.boolean().optional(),
  max: z.number().optional(),
  min: z.number().optional(),
  options: z.array(z.object({ value: z.string(), label: I18n })).optional(),
  suggestions: z.array(z.string()).optional(),
  help: I18n.optional(),
  readOnly: z.boolean().optional(),
});

export const CatalogTypeSchema = z.object({
  type: z.string(),
  label: I18n,
  icon: z.string(),
  sections: z.array(z.object({ key: z.string(), label: I18n, fields: z.array(FieldSchema) })),
  children: z.array(z.object({ key: z.string(), label: I18n, itemType: z.string().optional(), kind: z.enum(['list', 'rateCalendar', 'slotCalendar']).optional() })),
  listColumns: z.array(z.string()),
  filters: z.array(z.string()),
});

export const SchemaResponse = z.object({ types: z.array(CatalogTypeSchema), itemTypes: z.array(CatalogTypeSchema) });

export const CreateBody = z.object({
  title: I18nIn,
  summary: I18nIn.optional(),
  fields: Fields.optional(),
  supplierId: z.string().max(128).nullable().optional(),
  images: z.array(z.string().max(520)).max(20).optional(),
  /** Ignored: new records are always drafts. */
  status: z.string().optional(),
}).strict();

export const PatchBody = z.object({
  title: I18nIn.optional(),
  summary: I18nIn.optional(),
  fields: Fields.optional(),
  supplierId: z.string().max(128).nullable().optional(),
  images: z.array(z.string().max(520)).max(20).optional(),
  /** Required when the price moves more than 30%. */
  reason: z.string().max(500).optional(),
}).strict();

export const ChildBody = PatchBody;

export const TransitionBody = z.object({ reason: z.string().max(500).optional() }).strict();
export const ReasonBody = z.object({ reason: Reason }).strict();

export const BulkBody = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(200),
  action: z.enum(['publish', 'hide', 'archive', 'price']),
  value: z.union([z.number().min(0), z.object({ percent: z.number().min(-90).max(500) }).strict()]).optional(),
  reason: Reason,
}).strict();

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const Weekdays = z.array(z.number().int().min(0).max(6)).max(7);

export const RatesBody = z.object({
  roomId: z.string().min(1).max(200),
  from: Day,
  to: Day,
  nightlyEGP: z.number().min(0).max(1_000_000).optional(),
  closed: z.boolean().optional(),
  weekdays: Weekdays.optional(),
  reason: z.string().max(500).optional(),
}).strict();

export const SlotsBody = z.object({
  from: Day,
  to: Day,
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM')).min(1).max(24),
  capacity: z.number().int().min(0).max(500),
  weekdays: Weekdays.optional(),
  closed: z.boolean().optional(),
}).strict();

export const ItemResponse = z.object({ item: CatalogEnvelope, children: z.record(z.string(), z.array(CatalogEnvelope)) });
/** 202 + queuedForApproval: true when a supplier change was queued (publish → review, price > 30%). */
export const WriteResponse = z.object({ item: CatalogEnvelope, queuedForApproval: z.boolean(), approvalId: z.string().optional() });
export const RatesPutResponse = z.object({ applied: z.number().int(), queuedForApproval: z.boolean(), approvalId: z.string().optional() });
export const SlotsPutResponse = z.object({ applied: z.number().int(), created: z.number().int(), updated: z.number().int(), dates: z.number().int(), clampedToBooked: z.array(z.string()) });
export const MediaUploadBody = z.object({ dataUrl: z.string(), filename: z.string().optional(), alt_en: z.string().optional(), alt_ar: z.string().optional(), caption_en: z.string().optional(), caption_ar: z.string().optional(), credit: z.string().optional() });
export const MediaUploadResponse = z.object({ status: z.literal('success'), asset: z.object({ id: z.union([z.string(), z.number()]), original_url: z.string() }).passthrough(), correlationId: z.string().optional() });
export const BulkResponse = z.object({
  results: z.array(z.object({ id: z.string(), ok: z.boolean(), status: CatalogStatus.optional(), approvalId: z.string().optional(), error: z.record(z.string(), z.unknown()).optional() })),
  succeeded: z.number().int(),
  failed: z.number().int(),
});
export const RatesResponse = z.object({
  from: z.string(),
  to: z.string(),
  nights: z.array(z.object({ date: z.string(), roomId: z.string(), nightlyEGP: z.number(), closed: z.boolean(), overridden: z.boolean() })),
});
export const SummaryResponse = z.object({
  types: z.array(z.object({ type: z.string(), label: I18n, icon: z.string(), total: z.number(), draft: z.number(), published: z.number(), hidden: z.number(), archived: z.number(), review: z.number() })),
});

export const CatalogListQuery = ListQuery.extend({
  status: z.string().optional(),
  supplierId: z.string().optional(),
});

// ─── Endpoint table (drives openapi.json) ───────────────────────────────────

const ok = z.object({ deleted: z.boolean(), id: z.string() });

function both(defs: Omit<EndpointDef, 'tag'>[]): EndpointDef[] {
  const out: EndpointDef[] = [];
  for (const d of defs) {
    out.push({ ...d, tag: 'catalog' });
    out.push({
      ...d,
      tag: 'supplier-catalog',
      path: d.path.replace('/api/admin/catalog', '/api/supplier/catalog'),
      permission: 'supplier.catalog.manage',
      summary: `${d.summary} (own records only; publish → review)`,
    });
  }
  return out;
}

const P = 'catalog.<area>.';

export const CATALOG_ENDPOINTS: EndpointDef[] = both([
  { method: 'get', path: '/api/admin/catalog/schema', summary: 'Form + list schema for every catalogue type', permission: `${P}view (any)`, response: SchemaResponse },
  { method: 'get', path: '/api/admin/catalog/summary', summary: 'Catalogue home: counts per type', permission: `${P}view (any)`, response: SummaryResponse },
  { method: 'get', path: '/api/admin/catalog/{type}', summary: 'List records of a type', permission: `${P}view`, query: CatalogListQuery, response: listOf(CatalogEnvelope) },
  { method: 'post', path: '/api/admin/catalog/{type}', summary: 'Create a draft', permission: `${P}manage`, body: CreateBody, response: CatalogEnvelope, okStatus: 201 },
  { method: 'post', path: '/api/admin/catalog/{type}/bulk', summary: 'Bulk publish / hide / archive / price', permission: `${P}manage (+publish for publish/hide)`, body: BulkBody, response: BulkResponse },
  { method: 'get', path: '/api/admin/catalog/{type}/{id}', summary: 'One record with its children (ETag = updatedAt)', permission: `${P}view`, response: ItemResponse },
  { method: 'patch', path: '/api/admin/catalog/{type}/{id}', summary: 'Edit (If-Match: updatedAt; 409 stale)', permission: `${P}manage`, body: PatchBody, response: WriteResponse, ifMatch: true },
  { method: 'delete', path: '/api/admin/catalog/{type}/{id}', summary: 'Hard-delete an unbooked draft (409 in-use otherwise)', permission: `${P}manage`, body: ReasonBody, response: ok, ifMatch: true },
  { method: 'post', path: '/api/admin/catalog/{type}/{id}/publish', summary: 'Publish (422 incomplete)', permission: `${P}publish`, body: TransitionBody, response: WriteResponse, ifMatch: true },
  { method: 'post', path: '/api/admin/catalog/{type}/{id}/hide', summary: 'Take offline', permission: `${P}publish`, body: TransitionBody, response: WriteResponse, ifMatch: true },
  { method: 'post', path: '/api/admin/catalog/{type}/{id}/archive', summary: 'Archive (reason required)', permission: `${P}manage`, body: ReasonBody, response: WriteResponse, ifMatch: true },
  { method: 'post', path: '/api/admin/catalog/{type}/{id}/restore', summary: 'Restore an archived record to draft', permission: `${P}manage`, body: TransitionBody, response: WriteResponse, ifMatch: true },
  { method: 'post', path: '/api/admin/catalog/{type}/{id}/duplicate', summary: 'Copy as a new draft', permission: `${P}manage`, response: CatalogEnvelope, okStatus: 201 },
  { method: 'get', path: '/api/admin/catalog/hotel/{id}/rates', summary: 'Rate calendar', permission: 'catalog.hotels.view', query: z.object({ roomId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }), response: RatesResponse },
  { method: 'put', path: '/api/admin/catalog/hotel/{id}/rates', summary: 'Set a rate / close a date range (≤366 days, weekday mask 0=Sunday)', permission: 'catalog.hotels.manage', body: RatesBody, response: RatesPutResponse },
  { method: 'get', path: '/api/admin/catalog/activity/{id}/slots', summary: 'Departures in a date range', permission: 'catalog.activities.view', query: z.object({ from: z.string().optional(), to: z.string().optional() }), response: z.object({ items: z.array(CatalogEnvelope) }) },
  { method: 'put', path: '/api/admin/catalog/activity/{id}/slots', summary: 'Open / resize / close departures over a range (≤366 days)', permission: 'catalog.activities.manage', body: SlotsBody, response: SlotsPutResponse },
  { method: 'get', path: '/api/admin/catalog/{type}/{id}/{child}', summary: 'Child records (rooms, menu, slots, days)', permission: `${P}view`, response: z.object({ items: z.array(CatalogEnvelope) }) },
  { method: 'post', path: '/api/admin/catalog/{type}/{id}/{child}', summary: 'Create a child record', permission: `${P}manage`, body: ChildBody, response: CatalogEnvelope, okStatus: 201 },
  { method: 'patch', path: '/api/admin/catalog/{type}/{id}/{child}/{childId}', summary: 'Edit a child record', permission: `${P}manage`, body: ChildBody, response: WriteResponse },
  { method: 'delete', path: '/api/admin/catalog/{type}/{id}/{child}/{childId}', summary: 'Delete a child record (409 in-use)', permission: `${P}manage`, body: ReasonBody, response: ok },
]).concat([
  { method: 'post', path: '/api/supplier/catalog/media/upload', summary: 'Supplier photo upload (same body/response as /api/admin/content/media/upload; category forced to supplier)', tag: 'supplier-catalog', permission: 'supplier.catalog.manage', body: MediaUploadBody, response: MediaUploadResponse, okStatus: 201 },
]);
