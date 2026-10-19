# Final Staging Configuration

## Deployment Metadata
* **Target Cloud Platform:** Google Cloud Run (Serverless Container Environment)
* **Target Region:** `europe-west2` (London)
* **Staging Host Endpoint:** `https://ais-pre-4nz7iwhnollim4zlqf57pf-616830268255.europe-west2.run.app`
* **Internal Listen Port:** `3000` (Host: `0.0.0.0`)
* **Base Runtime:** Node.js `v22.23.2` on Linux x86_64
* **Node Package Manager:** npm `10.9.8`

---

## Compute & Resource Specifications
* **CPU Allocation:** 1 vCPU
* **Memory Allocation:** 1024 MiB (1 GiB)
* **Concurrency:** 80 concurrent connections per container instance
* **Request Timeout:** 300 seconds
* **Scaling Boundaries:**
  * `Min Instances`: 2 (Multi-instance staging & production baseline)
  * `Max Instances`: 10 (Autoscaling ceiling)
* **Execution Command:** `node dist/server.cjs` (Production CommonJS bundled backend)
* **Build Command:** `npm run build` (`vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`)

---

## Database & Persistence Configuration
* **Configured Environment Variable:** `PERSISTENCE_ADAPTER=postgres`
* **Database Driver:** `pg` (`pg.Pool` connection pool)
* **Connection String:** `DATABASE_URL` injected via Cloud Secret Manager
* **Target Relational Schema:** 16 relational tables in `server/db/sql/schema.sql`
* **Local Sandbox Mode (Standby / Preview):** `JsonFilePersistenceAdapter` with atomic `.tmp` swapping

---

## Environment Secrets & Access
* `DATABASE_URL`: PostgreSQL connection string (Secret Manager)
* `PAYMOB_API_KEY`: Paymob gateway API secret (Secret Manager)
* `PAYMOB_HMAC_SECRET`: Paymob SHA-512 webhook signature secret (Secret Manager)
* `GEMINI_API_KEY`: Google Gemini generative AI key (Secret Manager)
* `TWILIO_AUTH_TOKEN`: SMS telemetry provider token (Secret Manager)
* `SESSION_SECRET`: Session encryption secret (Secret Manager)

---

## Health & Probes
* **Health Endpoint:** `GET /api/health`
* **Startup Probe:** HTTP probe on `/api/health`
* **Liveness Probe:** Active socket loop check on port 3000
* **Graceful Termination:** Process traps `SIGTERM` / `SIGINT`, ceases new ingress, closes database pools, and exits code 0.
