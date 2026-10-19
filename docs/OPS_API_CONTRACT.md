# Dahab Ops API Contract (staff dashboard: web + `dahab-ops` Flutter app)

Source of truth for the endpoints added for the staff dashboard. The backend and
the Flutter app are both built against this file. When an endpoint changes,
update this file in the same change. `openapi.json` is generated from the zod
schemas in `server/contracts/` and must agree with this document.

## Conventions

- Base: `/api`. JSON in and out. Errors are RFC7807, the existing shape from
  `server/middleware/rbacMiddleware.ts`:
  `{ type, title, status, detail, instance, correlationId }`.
- Native clients send `X-Dahab-Client: native` and `Authorization: Bearer <accessToken>`.
  The website uses the `dahab_auth_token` HttpOnly cookie and never sees tokens.
- Lists: `?cursor=<opaque>&limit=<1..100, default 25>&sort=<field>|-<field>&q=<text>`
  plus endpoint-specific filters. Response: `{ items: T[], nextCursor: string | null, total: number }`.
- Mutations that move money or send messages accept `Idempotency-Key: <uuid>`.
  Replaying the same key returns the first response unchanged, with header
  `Idempotent-Replay: true`.
- Dangerous mutations require `reason` (string, 3..500 chars) in the body.
- `403` with `type: ".../approval-required"` means the action was queued for a
  second admin; the body carries `{ approvalId }`.
- `503` with `type: ".../kill-switch"` or `".../maintenance"` means the capability is switched off.

## Permissions

Keys are `area.section.action`. `*` (Admin) grants everything.
The catalogue is served by `GET /api/admin/permissions`. Core keys:

| Area | Keys |
|---|---|
| ops | `ops.overview.view`, `ops.trips.view`, `ops.trips.manage`, `ops.transfers.view`, `ops.transfers.manage`, `ops.exceptions.view`, `ops.exceptions.resolve`, `ops.commerce.view`, `ops.commerce.refund`, `ops.accommodations.view`, `ops.accommodations.manage`, `ops.stays.view`, `ops.stays.manage`, `ops.suppliers.view`, `ops.suppliers.manage`, `ops.intelligence.view`, `ops.opportunities.view`, `ops.knowledge.view`, `ops.knowledge.manage`, `ops.support.view`, `ops.support.reply`, `ops.sms.view`, `ops.sms.send`, `ops.notifications.view`, `ops.notifications.send`, `ops.audit.view`, `ops.flags.view`, `ops.jobs.view`, `ops.jobs.run`, `ops.health.view`, `ops.pricing.view`, `ops.pricing.manage`, `ops.dining.view`, `ops.dining.manage` |
| supplier | `supplier.inbox.view`, `supplier.inbox.respond`, `supplier.inventory.view`, `supplier.inventory.edit`, `supplier.resources.manage`, `supplier.stays.manage`, `supplier.rentals.manage`, `supplier.revenue.view`, `supplier.reliability.view`, `supplier.audit.view` |
| market | `market.view`, `market.manage` |
| cms | `cms.content.view`, `cms.content.edit`, `cms.content.publish`, `cms.media.upload`, `cms.theme.manage`, `cms.seo.manage` |
| admin | `admin.users.view`, `admin.users.manage`, `admin.roles.manage`, `admin.settings.view`, `admin.settings.manage`, `admin.flags.manage`, `admin.integrations.view`, `admin.integrations.manage`, `admin.approvals.decide`, `admin.audit.export`, `admin.viewas` |

Default role grants mirror the pre-existing `ROLE_RULES` in
`server/middleware/apiAccessPolicy.ts`:
- `Operations` gets every `ops.*`, plus `cms.content.*`, `cms.media.upload`, `market.view`, `supplier.*.view`.
  It also gets `market.manage`, because `ROLE_RULES` already let Operations write
  `/market/*` and the `/dahab/commerce` data-ops endpoints.
- `Product` gets `market.*`, `cms.*`, `ops.flags.view`, and `ops.overview.view`.
- `Supplier` gets every `supplier.*`, scoped to its own `supplierId`.
- `Traveler` gets nothing.
- `Admin` gets `*`.

## Auth

### `POST /api/auth/login` (existing)
Body `{ email, password, device?: { name, platform: 'ios'|'android'|'web' } }`.
Native response:
```json
{ "success": true, "user": User, "session": { "id", "userId", "role", "expiresAt", "token" },
  "accessToken": "string", "accessTokenExpiresAt": "ISO", "refreshToken": "string",
  "permissions": ["..."], "flags": { "key": true } }
```
The website gets the same body without `token`, `accessToken`, or `refreshToken`.

### `POST /api/auth/refresh` (native only, public)
Body `{ refreshToken }`. Response `{ accessToken, accessTokenExpiresAt, refreshToken }`.
Refresh tokens rotate on every use. Reusing a spent refresh token revokes the
whole device session family, returns 401, and writes the audit event `AUTH_REFRESH_REUSE`.

### `GET /api/auth/me` (existing, extended)
Response `{ user: User, session: Session, permissions: string[], flags: Record<string, boolean>, viewAs?: { userId, email } }`.
`session.token` is present only for native clients.

### `GET /api/auth/devices` / `DELETE /api/auth/devices/:id`
These are the caller's own device sessions:
`{ items: [{ id, name, platform, lastSeenAt, createdAt, current: boolean }] }`.

### `POST /api/devices`
Body `{ fcmToken, platform }`. Registers a push token for the current device session.

`User = { id, email, name, phone, role, supplierId?, status: 'active'|'suspended', createdAt }`

## Admin: access (`admin.users.*`, `admin.roles.manage`)

- `GET /api/admin/users?q&role&status&cursor&limit`: returns `List<User & { lastSeenAt?, deviceCount }>`.
- `GET /api/admin/users/:id`: returns `{ user, roleId, overrides: Override[], effectivePermissions: string[], devices: Device[] }`.
- `POST /api/admin/users`: invite a staff member. Body `{ email, name, phone?, roleId, supplierId? }`. Returns `{ user, tempPassword }`; `tempPassword` is shown once.
- `PATCH /api/admin/users/:id`: body `{ roleId?, status?, supplierId?, name?, reason }`. Granting Admin requires approval.
- `PUT /api/admin/users/:id/overrides`: body `{ overrides: [{ permission, effect: 'grant'|'deny' }], reason }`.
- `POST /api/admin/users/:id/revoke-sessions`: body `{ reason }`. Returns `{ revokedCount }`.
- `GET /api/admin/permissions`: returns `{ items: [{ key, group, labelEn, labelAr, dangerous: boolean }] }`.
- `GET /api/admin/roles`: returns `{ items: [{ id, name, description, isSystem, permissions: string[], userCount }] }`.
- `POST /api/admin/roles`: body `{ name, description, permissions }`.
- `PATCH /api/admin/roles/:id`: body `{ name?, description?, permissions?, reason }`. System roles may change permissions but cannot be renamed or deleted.
- `DELETE /api/admin/roles/:id`: allowed only when `userCount == 0` and the role is not a system role.

`Override = { permission, effect, createdBy, createdAt }`

## Admin: control

- `GET /api/admin/settings`: returns `{ items: [{ key, value, type: 'number'|'string'|'boolean'|'json', group, labelEn, labelAr, version, updatedBy, updatedAt }] }`.
- `PUT /api/admin/settings/:key`: body `{ value, reason }`. Changing `commerce.commissionRate` requires approval.
- `GET /api/admin/settings/:key/history`: list of `{ version, value, updatedBy, updatedAt, reason }`.
- `POST /api/admin/settings/:key/rollback`: body `{ version, reason }`.
- Seeded keys:
  - `commerce.commissionRate` (0.15)
  - `commerce.refundApprovalThresholdEgp` (5000)
  - `commerce.currency` ("EGP")
  - `support.slaMinutes` (30)
  - `support.hours` ("09:00-23:00")
  - `sms.templates` (json)
  - `system.maintenanceMessage` ({en, ar})
  - `apps.androidMinVersion` / `apps.iosMinVersion` / `apps.androidLatestVersion` / `apps.iosLatestVersion` ("1.0.0", dotted `x.y.z`)
  - `apps.androidStoreUrl` / `apps.iosStoreUrl` ("")
  - `announce.banner` ({enabled, tone: info|warn, en, ar})
- `GET /api/admin/flags`: returns `{ items: [{ key, kind: 'flag'|'killswitch'|'maintenance', enabled, rolloutPercent, roles: Role[], description, updatedBy, updatedAt }] }`.
- `PUT /api/admin/flags/:key`: body `{ enabled, rolloutPercent?, roles?, reason }`.
- Seeded kill switches: `killswitch.payments`, `killswitch.bookings`, `killswitch.ai`, `killswitch.sms`, `killswitch.supplierSignup`.
- Maintenance flag: `system.maintenance`. While it is on, non-staff `/api` calls get 503; staff, `/api/auth/*` and `/api/config` still work.
- `GET /api/admin/integrations`: returns `{ items: [{ id, name, status: 'healthy'|'degraded'|'down'|'disabled'|'unconfigured', latencyMs, checkedAt, mode: 'sandbox'|'live', enabled, keyHint: '••••abcd' | null, detail }] }`. The probes are real and cached for 60 s.
- `POST /api/admin/integrations/:id/check`: forces a probe.
- `PATCH /api/admin/integrations/:id`: body `{ enabled?, mode?, reason }`.
- `GET /api/admin/approvals?status=pending`: returns `List<{ id, action, summary, payload, requestedBy, requestedAt, status, decidedBy?, decidedAt?, decisionNote? }>`.
- `POST /api/admin/approvals/:id/decide`: body `{ decision: 'approve'|'reject', note? }`. The requester cannot decide their own approval. Approving executes the queued action.
- `GET /api/admin/audit?actor&action&entityType&entityId&from&to&cursor&limit`: returns `List<AuditEvent>`.
- `GET /api/admin/audit/export?...`: same filters, returned as `text/csv`.
- `POST /api/admin/view-as`: body `{ userId, reason }`.
  - It sets a read-only view-as on the caller's session. While it is active, every non-GET request returns 403 `.../view-as-readonly`.
  - `DELETE /api/admin/view-as` ends it.

`AuditEvent = { id, actor, actorRole, action, entityType, entityId, before?, after?, reason?, device?, correlationId?, timestamp }`

## Operations additions

- `GET /api/config?platform=web|android|ios&appVersion=1.2.3`: the unified remote config the web app and both Flutter apps fetch on boot. Public on purpose (anonymous visitors need maintenance state before sign-in) and exempt from the maintenance gate, so clients learn maintenance is on from here. Signed-in callers get feature flags evaluated for their own role/rollout bucket. `Cache-Control: public, max-age=60`; send the `version` back as `If-None-Match` for a 304 while nothing changed.
  - `{ version: "cfg-<hash>", issuedAt, maintenance: { active, message: { en, ar } }, killswitches: { payments, bookings, ai, sms, supplierSignup }, flags: { key: bool }, settings: { supportHours, supportSlaMinutes, currency }, apps: { android: { minVersion, latestVersion, storeUrl, updateRequired, updateAvailable }, ios: {...} }, announcement: { tone, text: { en, ar } } | null }`.
  - `updateRequired`/`updateAvailable` are computed only for the caller's own platform when a dotted `appVersion` is sent. Internal values (SMS templates, commission rate) are never exposed here.

- `GET /api/operations/audit-events` (existing) now accepts the list params and returns the list shape. If no params are sent, it keeps the legacy `{ auditEvents }` shape. The list shape also carries `auditEvents` as an alias of `items`, so the web AuditCenter keeps working.
- `GET /api/operations/overview` (existing) supports `ETag` / `If-None-Match`, which returns 304.
- `GET /api/search?q=&types=booking,user,supplier,property`: returns `{ items: [{ type, id, title, subtitle, route }] }`. Results are permission-filtered.
- `POST /api/admin/push/send` (existing, `ops.notifications.send`) accepts `Idempotency-Key`. Body `{ userId | permission, title, message, urgency? }`. With `permission`, the push goes to every active account that holds that permission (at most 500).

## Realtime

`GET /api/stream?topics=ops,support,exceptions,approvals,notifications` is Server-Sent Events.
- Auth works by cookie or Bearer token. Browsers cannot set headers on EventSource, so the web client uses the cookie.
- Events: `event: <topic>` and `data: { type, entityType, entityId, summary, at }`.
- The server sends a heartbeat comment every 25 s, and honours `Last-Event-ID` for replay of up to 200 events.
- Events are filtered by the subscriber's permissions:
  - `ops` needs `ops.overview.view`.
  - `support` needs `ops.support.view`.
  - `approvals` needs `admin.approvals.decide`.
  - `exceptions` needs `ops.exceptions.view`.
  - `notifications` needs `ops.notifications.view`. A user also gets the notifications addressed to them.
  - Suppliers get only events whose `supplierId` matches theirs.
- Sources: approvals (requested and decided), refunds issued, new support messages
  (`support`), and `exceptions`: support escalations, supplier rejections, and
  `EXCEPTION_ALERT` notifications.
