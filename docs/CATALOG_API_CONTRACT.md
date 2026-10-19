# Catalogue API Contract (staff + supplier CRUD for trips, hotels, restaurants)

One uniform CRUD surface over the existing collections, so the web command
center and the `dahab-ops` app share one form engine. Conventions follow
`docs/OPS_API_CONTRACT.md`: RFC7807 errors, list shape
`{ items, nextCursor, total }`, list params `?cursor&limit&sort&q`, and a
mandatory `reason` (3..500 chars) on delete and on price changes larger than 30%.

This surface wraps the existing collections; it does not replace them.
Existing endpoints (`/api/admin/hotel/*`, `/api/admin/pricing/*`,
`/api/operations/transfers/*`, CMS) keep working unchanged.

## Types

| `type` | Backing collection(s) | Children |
|---|---|---|
| `activity` | `db.productSkus` (bookable) + `db.activities` (detail, linked by `skuId`) | `slots` → `db.inventorySlots` |
| `package` | **new** `db.tripPackages` | `days` (embedded array) |
| `transfer-zone` | `db.transferZonePrices` | — |
| `transfer-bus` | `db.transferBusSchedules` | — |
| `transfer-driver` | `db.transferDrivers` | — |
| `hotel` | `db.accommodations` (+ its SKU for supplier) | `rooms` → `db.roomTypes`, `rates` → `db.roomRateNights` |
| `restaurant` | `db.diningVenues` | `menu` → `db.diningMenuItems` |

## Uniform record envelope

Every item is returned as:

```json
{
  "id": "string",
  "type": "activity",
  "status": "draft" | "published" | "hidden" | "archived",
  "supplierId": "SUP-..." | null,
  "supplierName": "string | null",
  "title": { "en": "string", "ar": "string" },
  "summary": { "en": "string", "ar": "string" },
  "coverImage": "/api/media/... | null",
  "images": ["/api/media/..."],
  "priceFromEGP": 0,
  "fields": { "...type-specific values, keyed as in the schema below..." },
  "updatedAt": "ISO", "updatedBy": "user id | null",
  "completeness": 0.0
}
```

`completeness` is a number from 0 to 1. It counts filled required fields plus
photos, and drives a "missing info" hint in the UI. Records cannot be published
while required fields are empty: the server returns 422 `.../incomplete` with
`{ missing: [fieldKey] }`.

## Schema endpoint (drives the form engine; UIs must not hardcode forms)

`GET /api/admin/catalog/schema` → `{ types: [TypeSchema] }`

```json
{
  "type": "hotel",
  "label": { "en": "Hotels & stays", "ar": "الفنادق والإقامات" },
  "icon": "bed",
  "sections": [
    { "key": "basics", "label": {"en":"Basics","ar":"الأساسيات"},
      "fields": [
        { "key": "title", "kind": "i18nText", "required": true, "max": 120, "label": {...} },
        { "key": "summary", "kind": "i18nTextarea", "max": 600 },
        { "key": "area", "kind": "select", "options": [{"value":"lighthouse","label":{...}}] },
        { "key": "priceFromEGP", "kind": "money" },
        { "key": "amenities", "kind": "tags", "suggestions": ["wifi","pool"] },
        { "key": "location", "kind": "geo" },
        { "key": "supplierId", "kind": "supplier" }
      ] },
    { "key": "media", "fields": [ { "key": "images", "kind": "gallery", "min": 1, "max": 20 } ] }
  ],
  "children": [ { "key": "rooms", "label": {...}, "itemType": "hotel-room" }, { "key": "rates", "kind": "rateCalendar" } ],
  "listColumns": ["title", "status", "priceFromEGP", "supplierName", "completeness"],
  "filters": ["status", "supplierId", "area"]
}
```

Field kinds: `text`, `i18nText`, `i18nTextarea`, `number`, `money`, `boolean`,
`select`, `multiselect`, `tags`, `time`, `timeList`, `duration`, `geo`,
`gallery`, `supplier`, `dayPlan` (package days), `json`.

## Endpoints (staff)

- `GET /api/admin/catalog/:type?status&supplierId&q&cursor&limit&sort` returns a list of envelopes.
- `GET /api/admin/catalog/:type/:id` returns `{ item, children: { [key]: Envelope[] } }`.
- `POST /api/admin/catalog/:type` takes `{ title, summary?, fields, supplierId?, images?, status? }`. New records are always `draft`.
- `PATCH /api/admin/catalog/:type/:id` takes a partial body. Returns 409 if `If-Match` (the `updatedAt`) is stale.
- `POST /api/admin/catalog/:type/:id/publish` · `/hide` · `/archive` · `/restore`. These change state; `archive` requires `reason`.
- `DELETE /api/admin/catalog/:type/:id` takes `{ reason }`. It hard-deletes only drafts that were never booked. Otherwise it returns 409 `.../in-use`; archive the record instead.
- `POST /api/admin/catalog/:type/:id/duplicate` returns a new draft.
- `POST /api/admin/catalog/:type/bulk` takes `{ ids, action: publish|hide|archive|price, value?, reason }`.
- Children:
  - `GET/POST /api/admin/catalog/:type/:id/:child`
  - `PATCH/DELETE /api/admin/catalog/:type/:id/:child/:childId`
- Hotel rates:
  - `GET /api/admin/catalog/hotel/:id/rates?roomId&from&to` returns `{ nights: [{date, roomId, nightlyEGP, closed}] }`.
  - `PUT /api/admin/catalog/hotel/:id/rates` takes `{ roomId, from, to, nightlyEGP?, closed?, weekdays?: [0..6], reason? }`. The range may be at most 366 days. It reuses the `roomRateNights` logic.
- Activity slots:
  - `GET /api/admin/catalog/activity/:id/slots?from&to`
  - `PUT /api/admin/catalog/activity/:id/slots` takes `{ from, to, times: ["08:30"], capacity, weekdays?, closed? }`.
- Restaurant bookings and orders: reuse `/api/dining/orders*`, filtered by `venueId`.
- Images: upload through the existing `POST /api/admin/content/media/upload`, then put the returned `asset.original_url` into `images[]`. The first image is the cover. Reordering means PATCHing `images`.

Every write is audited through `auditService.record` with before/after values,
and is permission-checked.

## Endpoints (supplier portal)

These are the same routes under `/api/supplier/catalog/:type...`, scoped to the
caller's `supplierId`:

- A supplier can only see and edit records it owns.
- `supplierId` in a request body is ignored.
- A supplier cannot publish. "Publish" from a supplier becomes `status: "review"`, and creates an approval for staff (`catalog.<type>.publish`).
- Price changes above 30% need review.

## Permissions (added to `server/auth/permissionCatalog.ts`)

- `catalog.activities.view|manage|publish`
- `catalog.packages.view|manage|publish`
- `catalog.transfers.view|manage`
- `catalog.hotels.view|manage|publish`
- `catalog.restaurants.view|manage|publish`
- `supplier.catalog.manage`

Defaults:
- Operations gets all `catalog.*`.
- Product gets `view` + `manage` on activities, packages, hotels and restaurants.
- Supplier gets `supplier.catalog.manage`.
- Admin gets `*`.

## UX rules (web + mobile)

- **Catalogue home:** one card per type, showing its count, the number of drafts and items needing review, and a "+ New" button.
- **List:** search, status chips, a supplier filter, and a completeness bar on each row. Swipe on mobile, or hover on web, gives quick actions: publish/hide, duplicate, edit price.
- **Create wizard (3 steps):**
  1. Basics: title AR/EN, type-specific essentials.
  2. Photos: camera or gallery, drag to reorder.
  3. Price & availability.

  The record is saved as a draft after every step. A "Publish" button stays disabled until the record is complete, and lists what is missing.
- **Edit:** one sectioned form generated from the schema, autosaving a draft. A sticky bar shows "Saved · Publish changes".
- **Rates/slots:** a month calendar. Long-press (mobile) or drag-select (web) a range, then set the price or close the dates. Weekday toggles apply to the range.
- **Menus:** grouped by section, with an inline price edit and an "available" toggle on each item.
- **Bilingual:** fields show an AR/EN pair side by side on web and as tabs on mobile, and the language still missing is highlighted.
- **Destructive actions** use the existing reason sheet. Archive is preferred over delete.

## Implementation notes and deviations (backend, 2026-10-15)

Code: `server/services/catalog/` (adapters, `registry.ts`, `fields.ts`,
`catalogService.ts`, `packageSeed.ts`), `server/api/catalogRoutes.ts`,
`server/api/supplierCatalogRoutes.ts`, zod in `server/contracts/catalogContract.ts`
(in `openapi.json`, tags `catalog` and `supplier-catalog`). Tests: `tests/catalog/`.

### Additions

- `GET {base}/summary` on both `/api/admin/catalog` and `/api/supplier/catalog` returns
  `{ types: [{ type, label, icon, total, draft, published, hidden, archived, review }] }`.
  `total` excludes archived records. The supplier version counts only the supplier's own
  records, and only the types a supplier can own.
- `GET {base}/schema` returns `{ types: TypeSchema[], itemTypes: TypeSchema[] }`.
  `itemTypes` holds the child forms named by `children[].itemType`: `hotel-room`,
  `restaurant-menu-item`, `activity-slot` and `package-day`. `children` lists:
  - for hotels, `rooms` (a list) and `rates` (`kind: rateCalendar`);
  - for activities, `slots` (`kind: slotCalendar`);
  - for restaurants, `menu`;
  - for packages, `days`.

  The supplier schema lists only `activity`, `package`, `hotel` and `restaurant`.
- Envelopes also carry `missing: [fieldKey]`, which is the list a 422 would return.
- `review` is a fifth status, used for supplier publish.
- `POST /api/supplier/catalog/media/upload` takes the same body as
  `POST /api/admin/content/media/upload` (`{ dataUrl, filename?, alt_en?, alt_ar?, caption_en?, caption_ar?, credit? }`)
  and returns the same response: 201 `{ status: "success", asset: { original_url, ... } }`.
  It needs `supplier.catalog.manage`. `category` is always set to `supplier`, and the asset is
  tagged `supplier:<id>`. Suppliers get no other media-admin route.
- `GET /api/suppliers` (the supplier picker) now admits Product too. IBANs stay hidden from
  everyone except Operations and Admin.

### Response shapes

- Writes that can be queued for approval are `PATCH /:type/:id`,
  `POST /:type/:id/publish|hide|archive|restore` and `PATCH /:type/:id/:child/:childId`.
  They return `{ item, queuedForApproval, approvalId? }`:
  - an applied change answers 200 with `queuedForApproval: false`;
  - a supplier publish, or a supplier price change above 30%, answers **202** with
    `queuedForApproval: true` and `approvalId`. For a queued price change, `item` is the
    unchanged record.
- `PUT /hotel/:id/rates` returns `{ applied, queuedForApproval, approvalId? }`. It answers 202
  when a supplier sets a rate more than 30% away from the room's base rate; nothing is written
  until a staff member approves. `from` and `to` are **inclusive**. In `weekdays`, 0 is Sunday.
- `PUT /activity/:id/slots` returns `{ applied, created, updated, dates, clampedToBooked: [slotId] }`.
  Times are `HH:MM`, stored as the platform's `08:30 AM` labels. `closed: true` sets capacity
  to what is already booked or held (status `SOLD_OUT`), and creates zero-capacity slots where
  none exist. Capacity never drops below booked plus held.
- `POST /:type`, `POST /:type/:id/duplicate` and child `POST` answer 201 with the envelope.
  `GET /:type/:id` and writes send `ETag: "<updatedAt>"`.
- `POST /:type/bulk` returns `{ results: [{ id, ok, status?, approvalId?, error? }], succeeded, failed }`.
  For `action: price`, `value` is either a number (the new price) or `{ percent }`.
- RFC7807 error slugs:
  - `incomplete` (422, carries `missing`)
  - `stale` (409, carries `currentUpdatedAt`)
  - `in-use` (409)
  - `invalid-transition` (409)
  - `reason-required` (400)
  - `forbidden` (403)
  - `not-found` (404)

### Input

- Any schema key can be sent under `fields`, including `title`, `summary`, `images`,
  `priceFromEGP` and `supplierId`. If a key is also sent at the top level, the top-level value
  wins. i18n values merge, so sending `{ en }` alone keeps the existing `ar`. Unknown or
  read-only keys return 400. `null` clears an optional value.
- Restaurant menu items use `fields.section`, `fields.priceEGP` and `fields.available`. The
  envelope's `priceFromEGP` mirrors `priceEGP`.
- Lists leave out `archived` records unless `status` asks for them. `status` accepts a
  comma-separated list. `total` is counted after filters, so `?limit=1&status=draft` gives an
  accurate count. Each type's extra filters are listed in `TypeSchema.filters`.

### Deviations

- The status of existing records lives in a new `catalog_meta` table, which also holds the
  If-Match version and the gallery for entities that have no gallery of their own. Without a
  meta row, status comes from the entity: `active` means published and inactive means hidden.
  Restaurants, and activities without a SKU, default to published.
- Where the entity has its own `active` flag (SKUs, accommodations, transfer rows), that flag
  wins over a stale meta row, so edits made through the older admin routes stay visible.
- Restaurants have no on/off column. Their status exists only in the catalogue, and the public
  `/api/dining/*` endpoints do not filter on it yet.
- Activities are listed from `db.activities`; SKUs with no activity detail are not listed.
- An activity without a supplier has no SKU yet, because a SKU needs a supplier (foreign key).
  Its SKU values wait in `catalog_meta.extra`, and the SKU is created when a supplier is
  assigned. `supplierId` is required to publish an activity.
- A hotel created by staff with no supplier gets a placeholder supplier, the same way
  `accommodationService.createAccommodation` does. Clearing a hotel's supplier is refused.
- Transfer types have no owner, so they are staff-only (the supplier portal returns 403).
  They use `catalog.transfers.manage` for publish and hide.
- `restore` returns an archived record to `draft`.
- A rejected publish approval leaves the record in `review` until the supplier hides or edits it.
- Duplicates copy the record and its gallery, but not its children (rooms, menu, slots).
- Child writes bump the parent's `updatedAt`, so a parent's If-Match goes stale after one.
- System roles stored before this change get the catalogue keys once at boot
  (`LATER_ROLE_DEFAULTS`, recorded as `appliedDefaults: ['catalog-v1']`). If an admin removes
  the keys later, they stay removed.
- `db.tripPackages` is seeded once from `READY_TRIP_PROGRAMMES`, with status published. The
  seed is idempotent by `seedId`. The public trip-programme pages still read the static seed
  and the CMS.
