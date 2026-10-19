# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build
#
# Produces two things into dist/: the Vite client bundle, and server.cjs, an
# esbuild bundle of server.ts. That bundle is built with --packages=external,
# so it still require()s node_modules at runtime and the runtime stage below
# must carry production dependencies. It is not self-contained.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies are copied and installed on their own so this layer is reused
# whenever only source changed — which is almost every build.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Reinstall with dev dependencies pruned, for copying into the runtime stage.
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# tini reaps zombies and forwards SIGTERM, so Cloud Run's shutdown signal
# actually reaches Node instead of being swallowed by PID 1.
RUN apk add --no-cache tini

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist        ./dist
COPY --from=build /app/package.json ./package.json

# Seed datasets, read at boot by runMigrationsAndSeed().
# importDahabLocalCommerce() throws "Master dataset not found" when
# dahab_local_commerce.json is absent and nothing catches it, so omitting these
# files means the container will not start.
#
# These go to /app/seed, NOT /app/data. They used to share a directory with the
# runtime store, which made the store impossible to persist: mounting a volume
# over /app/data would have hidden the seeds and prevented boot. Separated, the
# volume covers only writable state and the seeds stay readable underneath.
COPY --from=build /app/data ./seed
ENV DAHAB_SEED_DIR=/app/seed

# Read by PostgresPersistenceAdapter.initializeSchema() via a process.cwd()
# path. Only needed on the migration path, but it is 16 kB and its absence
# would surface as a runtime throw rather than a build error.
COPY --from=build /app/server/db/sql ./server/db/sql

# Writable state: data/dahab.sqlite (+ -wal/-shm), data/locks/, data/backups/
# and the DayGI side stores. The node user must own it.
RUN mkdir -p /app/data/locks && chown -R node:node /app/data

ENV DAHAB_DATA_DIR=/app/data

# Everything the platform must not lose lives here.
#
# Without this the database sat in the container's writable layer and every
# deploy or restart destroyed every user, booking, payment and ledger entry —
# while /api/health reported "durable: true".
#
# VOLUME gives Docker a persistent anonymous volume by default, but declaring it
# is not the whole job: bind an explicit volume so the data outlives the
# container by name rather than by luck.
#
#   docker run -v dahab-data:/app/data ...
#
# On Cloud Run, container filesystems are always ephemeral and VOLUME does
# nothing — attach a mount (Cloud Storage FUSE or a Filestore NFS share) at
# /app/data, or set DAHAB_DATA_DIR to wherever the mount lands. SQLite needs
# real POSIX locking, so a network filesystem must support it; Filestore does,
# GCS FUSE does not, and running there without a durable mount means accepting
# that the store is disposable.
#
# Run exactly one writing instance: SQLite in WAL mode allows many readers but
# only one writer, and the in-memory working copy is per-process.
VOLUME ["/app/data"]

USER node

# Cloud Run and most PaaS hosts inject the real port; server.ts reads PORT and
# falls back to 3000. EXPOSE is documentation, not a binding.
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.cjs"]
