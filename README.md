# Backend (Server/API) split from DAHAB monorepo

## Deployment (Coolify / VPS)

Same Nixpacks setup as Mouaser. Coolify reads `nixpacks.toml` and starts `scripts/start-production.sh`.

Steps, port 3000, the `/app/data` volume, and environment variables: [docs/COOLIFY.md](docs/COOLIFY.md). Copy values from `.env.coolify.example`.
