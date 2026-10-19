# Polyglot API Contract — REST · GraphQL · gRPC

> Status: **live** (slices 1 + 2). Executable truth: `server/services/domain/`,
> `server/graphql/`, `server/grpc/`, and the tests in
> `tests/domain/graphqlApi.test.ts` / `tests/domain/grpcGateway.test.ts`.
> If this document and the code disagree, the code wins — then fix this file.

The platform serves three transports over **one set of domain services**. A
rule implemented in `server/services/domain/` cannot drift between protocols
because no protocol carries its own copy of it.

```
SPA (REST, cookie session)          ─┐
Flutter (gRPC, Bearer token)        ├─> SupportService
Any client (GraphQL, cookie session) ─┘   DayGiDomainService
                                         AccommodationQueryService
                                             │
                                             ▼
                                    the same DB + the same audit trail
```

---

## The golden rule

**Identity is resolved by the transport, never read from a payload.**

| Transport | Where identity comes from | Who validates it |
|---|---|---|
| REST | `dahab_auth_token` HttpOnly cookie (or Bearer for native) | `optionalAuth` → `authService.validateToken` |
| GraphQL | cookie (same Express session) | `optionalAuth` → context → `requireActor` per resolver |
| gRPC | `authorization: Bearer <session token>` **metadata** | `authService.validateToken` — the exact Express path |

A client-supplied `userId`/`userRole` field is ignored everywhere. The gRPC
proto and the GraphQL schema have **no** identity input fields by design.

---

## REST

Unchanged: see `src/services/api.ts` (client call surface),
`server/middleware/apiAccessPolicy.ts` (deny-by-default policy) and
`tests/contract/apiContract.test.ts` (the gate that keeps client and server in
sync). The two new transports add no REST routes and no contract entries.

## GraphQL — `POST /api/graphql`

Single endpoint, JSON body `{ query, variables, operationName }`.

- **Public** (listed in `apiAccessPolicy.ts`, resolver-gated):
  `platform`, `accommodationCards(filters)`, `areas`, `roomTypes(slug)`,
  `stayQuote(slug, input)`.
- **Authenticated** (resolver re-asserts the actor, so an anonymous call gets
  `errors: [{ message: "Authentication required." }]`): `support`,
  `supportCreateMessage`, `daygi.memory`, `daygi.tasks`, `daygi.task`.
- **SPA client**: `src/services/graphql.ts` ships `gql()` plus named queries
  for the card grid, room types and stay quote — adopt per view as the
  redesign settles.
- **Null semantics preserved**: `daygi.task(taskId)` returns `null` for a
  missing task **and** for somebody else's — the REST flat-404, so the field
  never confirms a task exists.
- **Hardening**: query depth capped at 8 (`server/graphql/handler.ts`);
  introspection disabled when `NODE_ENV=production`; resolver errors ride a
  200 with the GraphQL `errors` array (transport errors are 4xx).

```bash
curl -s http://localhost:3000/api/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ accommodationCards(filters:{propertyTypes:[\"hotel\"]}) { stats { total } cards { slug perNightEGP packageTotalEGP } } }"}'
```

## gRPC — `dahab.v1.DahabService` (proto: `server/grpc/protos/dahab.proto`)

Default port `50051` (`GRPC_PORT`; `GRPC_ENABLED=false` skips). A busy port is
**not fatal** — the instance logs and serves HTTP only, so dev + E2E
instances can race without crashing either.

| rpc | auth | mirrors |
|---|---|---|
| `GetPlatformHealth` | none | `GET /api/health` (no-PII subset) |
| `ListAccommodationCards` | none | `GET /api/accommodations?view=card` |
| `ListAreas` | none | the REST areas payload |
| `ListRoomTypes` | none | `GET /api/accommodations/:slug/room-types` (`NOT_FOUND` unknown slug) |
| `QuoteStay` | none | `POST /api/accommodations/:slug/quote` (`NOT_FOUND` unknown slug; bad input → `INVALID_ARGUMENT`) |
| `GetSupportThread` | Bearer | `GET /api/support/messages` |
| `CreateSupportMessage` | Bearer | `POST /api/support/messages` |
| `GetDayGiMemory` | Bearer | `GET /api/daygi/memory/:userId` |
| `ListDayGiTasks` | Bearer | `GET /api/daygi/tasks` (empty trip_id → `INVALID_ARGUMENT`) |
| `GetDayGiTask` | Bearer | `GET /api/daygi/tasks/:taskId` (`NOT_FOUND` for missing **and** foreign) |

Conventions: proto fields are snake_case (loader surfaces them as camelCase);
proto3 zero-values mean "unset" on filters. Step `actionToken` /
`idempotencyKey` / `payload` never cross any transport boundary — step
execution stays on REST.

Flutter consumes the proto with the `grpc` pub package; identity goes in
metadata:

```dart
final metadata = {'authorization': 'Bearer $token'}; // from nativeAuthService
```

Node smoke (what the gateway tests do):

```ts
const pkg = loadDahabGrpcPackage(); // exported by server/grpc/server.ts
const client = new pkg.dahab.v1.DahabService('127.0.0.1:50051',
  grpc.credentials.createInsecure());
client.getPlatformHealth({}, (err, res) => { /* res.status === 'ok' */ });
```

---

## The card projection (slice 2)

`accommodationCards` / `ListAccommodationCards` serve **exactly** the REST
`?view=card` shape (see `AccommodationQueryService`): the listing grid and map
shape, with `galleryImageUrls`, `tripadvisor`, `bookable`, `note`, `bestFor`
dropped — they stay on the detail page. Filter validation (enum members,
types) lives in the domain service, so an invalid filter is a 400 on REST, a
field error on GraphQL, and `INVALID_ARGUMENT` on gRPC — from the same code.

## Deploy notes

- `npm run build` bundles the server (`--packages=external`) and copies the
  proto to `dist/grpc/protos` (`scripts/grpc/copyProtos.ts`), where the
  runtime resolves it.
- gRPC rides the same process and the same SQLite one-writer rule; run exactly
  one instance per data dir, or let the second boot HTTP-only (see above).
- Env: `GRPC_ENABLED`, `GRPC_PORT`. GraphQL needs no env.
