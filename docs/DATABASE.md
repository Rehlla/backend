# Database

The platform runs on a local **SQLite** database at `data/dahab.sqlite`, through
[`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3).

## Commands

```bash
npm run db:migrate             # data/dahab_db.json -> data/dahab.sqlite
npm run db:migrate:dry         # report what would be rejected, write nothing
npm run db:migrate:quarantine  # migrate, setting aside rows that fail a constraint
npm run db:check               # integrity: FKs, JSON, ledger balance, orphans
npm run db:backup              # consistent copy into data/backups/
npm run db:schema              # regenerate server/db/sql/sqlite-schema.sql
```

Pass the flags through these scripts, not with `npm run db:migrate -- --force`:
npm treats `--force` as its own option and swallows it, so the migration never
sees it. Running `npx tsx server/db/sqlite/migrateJsonToSqlite.ts <flags>`
directly also works.

## Why SQLite and not PostgreSQL

`IPersistenceAdapter` is synchronous — `commit(): void`,
`runInTransaction<R>(work: () => R): R` — and the application makes 562
synchronous collection operations, calling `save()` at 54 sites without
awaiting it.

That is the actual reason `PostgresPersistenceAdapter.save()` was never
implemented. `pg` is async-only, so satisfying this interface with it is not
possible without converting every caller and every service to async first. The
adapter has therefore always been a stub that discarded all state on restart,
while `/api/health` reported "PostgreSQL Relational".

`better-sqlite3` is synchronous, so it provides real transactions, foreign keys
and indexes without that rewrite. Postgres remains reachable later; it is a
separate, larger piece of work.

The `better-sqlite3` version is pinned to the **12.x** line. 13.x declares
`engines.node >= 22` but its prebuilt binary segfaults on Node 22.12, which is
what this project runs.

## Storage shape

Each table stores the complete entity as JSON in a `data` column, and
*additionally* promotes the fields that need a constraint or an index into real
typed columns.

- Reads always hydrate from `data`, so round-trip fidelity is total and adding
  an optional field to a TypeScript interface needs no migration.
- Writes fill both, so `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY` and indexes are
  enforced by SQLite on exactly the fields the application queries.

The alternative — one column per interface field across 46 entities — means
roughly 400 columns hand-kept in sync with types that are still moving, and a
silent data-loss bug every time the two drift.

`server/db/sqlite/tableSpecs.ts` is the single source of truth. It generates the
DDL, the row↔entity mapping, and the indexed query helpers.

## The `seq` column

Every table has `seq`, and every read is `ORDER BY seq`.

A `SELECT` without `ORDER BY` has no defined order, and several collections
carry meaning in theirs: the ledger's hash chain links each entry to the one
before it *by array position*, and `notifications`, `marketAlerts`,
`knowledgeSnapshots` and `auditEvents` are built newest-first with `unshift()`.

When only a row's position changes, one integer is written rather than the whole
document — an `unshift()` onto a 400-row audit log shifts every position at once.

## Foreign keys: what is enforced and what is only indexed

A `FOREIGN KEY` is declared where the reference is mandatory and owned — a
session belongs to a user, a trip item belongs to a trip.

Three cases are deliberately indexed but **not** constrained:

| Reference | Why no FK |
|---|---|
| `bookings.trip_id`, `payments.trip_id`, `ledger_entries.trip_id` | A cascade here would let one trip deletion destroy the bookings a traveller paid for, their payments, and the ledger entries recording the money. These are append-only financial facts; `tripId` is a recorded value, not a live relationship. Their integrity comes from a `UNIQUE` idempotency key per entry and the ledger's own hash chain. |
| `notifications.user_id` | Carries the literal `'ALL'` for broadcasts, so it is a recipient selector, not a user id. A FK would reject every broadcast. |
| Market-intelligence tables referencing `suppliers` | The crawler can legitimately observe an offer before the supplier row exists. |

"Not constrained" does not mean unwatched: `npm run db:check` reports every
dangling reference in these columns by name.

## Migration and quarantine

The JSON store could not express a constraint, so it accumulated rows that
cannot satisfy one. `npm run db:migrate` refuses by default and reports them.

`--quarantine` proceeds, moving each rejected row into the `_quarantine` table
with its reason. Nothing is deleted — discarding a paid booking to make a
migration pass is not an option.

What the first migration found:

```
holds                HOLD-1787976177975   tripId='T1' has no row in trips
holds                HOLD-1787977764058   tripId='T9' / travelerId='X' missing
holds                HOLD-1788032604531   tripId='T1' / travelerId='U1' missing
trip_items           ITEM-1788069584548-HOT  tripId='DHB-TRIP-DAHAB-FIRST-TIMER' missing
market_refresh_runs  RUN-SRC-FAILING-BREAKER-1787949184230  duplicate primary key
```

Plus dangling-but-kept references, reported by `db:check`, all pointing at the
same missing trip `DHB-TRIP-DAHAB-FIRST-TIMER`. A real trip
`TRIP-DAHAB-FIRST-TIMER-1788086295644` exists, which suggests checkout recorded
the **plan template id** where the created trip's id belonged. That bug is not
fixed here.

## Backups

`npm run db:backup` uses `VACUUM INTO`, not a file copy. It runs in a
transaction, so it cannot capture a torn page and it works while the server is
running. It then reopens the copy and runs `integrity_check` before reporting
success.

Do not back up by copying `dahab.sqlite` by hand: in WAL mode the most recent
commits live in the `-wal` file, so a bare copy is silently missing them.

## Known gaps

- **Container storage.** The `Dockerfile` still declares no `VOLUME` and mounts
  nothing, so in a container the database lives in the writable layer and is
  lost when the container is replaced. This applies to SQLite exactly as it did
  to the JSON file, and is unfixed.
- **Query migration is partial.** `server/db/sqlite/query.ts` provides indexed
  `findByKey` / `findAllBy` / `findOneBy` / `countBy`, but the ~264 existing
  `db.<collection>.find(...)` call sites still scan the in-memory arrays. Each
  one is now an independent, safe change rather than a rewrite.
- **Retention.** There is still no session sweeper, and `auditEvents` is
  unbounded (400+ rows and growing). `db:check` reports both.
