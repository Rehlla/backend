# Split-sync — publishing the monorepo to the split repos

The monorepo (this directory) is the **source of truth**. Two GitHub repos are
*views* of it, split along the server/client line:

| Repo | Receives |
|---|---|
| [`Rehlla/web`](https://github.com/Rehlla/web) | `src/`, `public/`, `docs/`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `package.json`, `.env.example` |
| [`Rehlla/backend`](https://github.com/Rehlla/backend) | `server/`, `server.ts`, `tests/`, `scripts/`, `data/` (tracked seeds only), `docs/`, server + build configs |

Both are also mirrored to the personal account (`tia21040026-web/REHLA`) for
the monolith itself.

## Usage

```bash
npm run sync:split                  # sync + commit + push both repos
npm run sync:split -- --dry-run     # show what would change, write nothing
npm run sync:split -- --no-push     # sync + commit locally, push nothing
npm run sync:split -- --only=web    # only one target
```

`--dry-run` is safe to run at any time: it clones nothing, copies nothing and
pushes nothing.

## How the source set is chosen

`git ls-files` — the monorepo's own index — is the allowlist. The monorepo's
`.gitignore` already encodes the data policy (seeds re-admitted one by one,
everything else under `data/` is runtime state), so using the index means a
split repo can never publish something the monorepo itself refuses to commit.

That covers the files that must not leak: `data/dahab_db.json` (user records,
live session tokens, traveler phone/email, supplier payout IBANs),
`data/*.sqlite*`, `data/locks/`, `data/backups/`, `data/cms-media/`,
`data/payment-receipts/`, `data/audit-archive-*.jsonl`, `data/daygi_chats.json`.

## How deletions are handled

Each split repo carries `.split-sync-manifest.json` — the list of files the
script manages there. A file is removed from the split repo only when it was in
the previous manifest and is no longer in the source. A file a human added to a
split repo by hand is never touched.

## Worktrees

The script keeps one working clone per target under `.split-sync/` (next to
the monorepo, so it is outside the monorepo's own tree). Override with
`SPLIT_WORKTREE_ROOT`.

Keeping the clone is deliberate: a fresh `git init` per run would orphan the
commits already on GitHub and make the history unreadable.

## Auth

Pushing needs a token with write access to the `Rehlla` org:

```bash
GITHUB_TOKEN=ghp_xxx npm run sync:split
```

The token is read from the environment only. It is never written to disk and
never embedded in a remote URL stored in `.git/config`.

Without a token the script still clones (public repos) but the push will fail
with a permission error.

## Adding a new file to a split repo

1. Add it to the monorepo and commit it.
2. `npm run sync:split`.

The script picks it up from the index automatically — there is no list to
update, unless it needs to go to a *different* split repo than the one its
path implies (e.g. a new root-level config file). In that case add it to the
`files` array for the target in `scripts/sync/splitSync.ts`.

## Note on the split repos

The split repos are **not independently buildable** as-is. `Rehlla/backend`
serves the SPA that `Rehlla/web` builds, and the two share `package.json`
dependency versions. The monorepo remains the only place where
`npm install && npm test && npm run build` is meaningful.
