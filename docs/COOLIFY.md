# Coolify / VPS deployment (Node + Nixpacks)

Same Coolify method as Mouaser (`C:\laragon\www\mouaser`): Nixpacks reads `nixpacks.toml`, Coolify builds the image, and one start command runs the app.

Mouaser is Laravel, so it starts nginx, php-fpm, a queue worker, and the scheduler. This project is the Dahab Node server. It starts `node dist/server.cjs` on `PORT` (default 3000). The existing `Dockerfile` is the Cloud Run image. On Coolify, use Nixpacks, as Mouaser does.

## What Coolify runs

| Piece | Role |
|-------|------|
| Nixpacks | Builds from `nixpacks.toml` (Node 22, `npm install`, `npm run build`) |
| `scripts/start-production.sh` | Points seeds at `/app/seed`, state at `/app/data`, then starts the server |
| Coolify proxy | TLS and `X-Forwarded-*` in front of the container |

The server already sets `trust proxy`, so the rate limiter sees the real client IP behind Coolify.

## Files

```text
nixpacks.toml
scripts/start-production.sh
.env.coolify.example
```

## Coolify UI

1. New Resource → Application → Git (this repo and branch).
2. Build Pack: **Nixpacks**.
3. Port: **3000**. The process listens on `PORT`, which Coolify sets from this value.
4. Domain → enable HTTPS. Set `APP_URL` to that exact `https://` URL.
5. Storages → add a persistent volume mounted at **`/app/data`**.
6. Instances: **1**. SQLite allows one writer. A second replica will corrupt the database.
7. Environment variables from `.env.coolify.example`.
8. Deploy. Boot runs migrations and seed imports. There is no `php artisan migrate`.

Health check path: `/api/health`.

## Environment variables

| Variable | When Coolify must inject it |
|----------|------------------------------|
| `APP_URL` | Runtime |
| `SEED_USER_PASSWORD`, `OPENAI_API_KEY`, `PAYMOB_*`, `TWILIO_*`, `LOCATIONIQ_API_KEY` | Runtime only |
| `VITE_CARTO_MAPS_API_KEY`, `VITE_LOCATIONIQ_MAPS_TOKEN` | Build time. Runtime only leaves the maps without a key. |
| `NODE_ENV` | Leave unset during build. The start script sets `production`. |
| `NIXPACKS_NODE_VERSION` | Already `22` in `nixpacks.toml`. Do not set another Node version in Coolify. |

`DAHAB_SEED_DIR=/app/seed` and `DAHAB_DATA_DIR=/app/data` are set by the start script if you omit them.

## Data

Seed JSON is copied to `/app/seed` during the image build. The volume covers only `/app/data` (`dahab.sqlite`, locks, backups). Mounting the volume on `/app/data` does not hide the seeds.

Deleting the volume deletes users, bookings, and payments. Do not run a fresh database unless you mean to wipe it.

## After deploy

Open `https://your-domain/api/health`. A 200 means the process is up. The first boot creates `dahab.sqlite` inside the volume when `SEED_USER_PASSWORD` is set.

gRPC listens on `GRPC_PORT` (default 50051) inside the container. The website does not need that port published.
