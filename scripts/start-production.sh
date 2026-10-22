#!/usr/bin/env bash
# Coolify runtime pipeline. Build already installed dependencies, typechecked, and bundled.
# This script prepares data, boots the server (schema + seeds run before listen),
# and only stays up when /api/health returns 200.
set -euo pipefail

cd /app

export NODE_ENV=production
export PORT="${PORT:-3000}"
export DAHAB_SEED_DIR="${DAHAB_SEED_DIR:-/app/seed}"
export DAHAB_DATA_DIR="${DAHAB_DATA_DIR:-/app/data}"

echo "[pipeline] 1/4 build artifact"
if [[ ! -d node_modules || ! -f dist/server.cjs ]]; then
  echo "node_modules or dist/server.cjs is missing. The Nixpacks build did not finish." >&2
  exit 1
fi

echo "[pipeline] 2/4 data directory and seeds"
mkdir -p "$DAHAB_DATA_DIR/locks" "$DAHAB_DATA_DIR/backups" "$DAHAB_SEED_DIR"

# Fallback when the build step did not copy seeds and /app/data is not a volume yet.
if [[ ! -f "$DAHAB_SEED_DIR/dahab_local_commerce.json" && -f /app/data/dahab_local_commerce.json ]]; then
  cp -a /app/data/. "$DAHAB_SEED_DIR/"
fi

if [[ ! -f "$DAHAB_SEED_DIR/dahab_local_commerce.json" ]]; then
  echo "Seed dataset missing: $DAHAB_SEED_DIR/dahab_local_commerce.json" >&2
  exit 1
fi

# npm run db:migrate is a one-off JSON file import. It is not the deploy migration:
# an empty volume has no dahab_db.json, and re-running it would fight the live SQLite file.
echo "[pipeline] 3/4 migrate and start"
echo "[pipeline] schema and seeds run inside the server before it listens"
node dist/server.cjs &
server_pid=$!

stop_server() {
  if kill -0 "$server_pid" 2>/dev/null; then
    kill -TERM "$server_pid" 2>/dev/null || true
    wait "$server_pid" || true
  fi
}
trap stop_server TERM INT

echo "[pipeline] 4/4 health check http://127.0.0.1:${PORT}/api/health"
healthy=0
for _ in $(seq 1 90); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "[pipeline] server exited during migrate/boot" >&2
    wait "$server_pid" || true
    exit 1
  fi
  if node -e "fetch('http://127.0.0.1:${PORT}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  echo "[pipeline] health check failed after migrate/boot" >&2
  stop_server
  exit 1
fi

echo "[pipeline] ready"
# Replace the trap so a later stop does not swallow the server's own exit code.
trap 'kill -TERM "$server_pid" 2>/dev/null || true; wait "$server_pid"' TERM INT
wait "$server_pid"
