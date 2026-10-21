#!/usr/bin/env bash
set -euo pipefail

cd /app

export NODE_ENV=production
export PORT="${PORT:-3000}"
export DAHAB_SEED_DIR="${DAHAB_SEED_DIR:-/app/seed}"
export DAHAB_DATA_DIR="${DAHAB_DATA_DIR:-/app/data}"

mkdir -p "$DAHAB_DATA_DIR/locks" "$DAHAB_DATA_DIR/backups" "$DAHAB_SEED_DIR"

# Fallback when the build step did not copy seeds and /app/data is not a volume yet.
if [[ ! -f "$DAHAB_SEED_DIR/dahab_local_commerce.json" && -f /app/data/dahab_local_commerce.json ]]; then
  cp -a /app/data/. "$DAHAB_SEED_DIR/"
fi

if [[ ! -f "$DAHAB_SEED_DIR/dahab_local_commerce.json" ]]; then
  echo "Seed dataset missing: $DAHAB_SEED_DIR/dahab_local_commerce.json" >&2
  exit 1
fi

if [[ ! -f dist/server.cjs ]]; then
  echo "dist/server.cjs is missing. The Nixpacks build did not finish." >&2
  exit 1
fi

exec node dist/server.cjs
