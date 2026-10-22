# Backend (Server/API) split from DAHAB monorepo

## Deployment (Coolify / VPS)

Same Nixpacks setup as Mouaser. Coolify installs dependencies, typechecks, builds, then `scripts/start-production.sh` migrates on boot and checks `/api/health`.

Steps, port 3000, the `/app/data` volume, and environment variables: [docs/COOLIFY.md](docs/COOLIFY.md). Copy values from `.env.coolify.example`.
