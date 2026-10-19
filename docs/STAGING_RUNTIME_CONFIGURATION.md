# Staging Runtime Configuration

## Service Identification & Infrastructure Metadata
* **Platform Target:** Google Cloud Run (Fully Managed Serverless Container Platform)
* **Hosting Region:** `europe-west2` (London)
* **Development Ingress Endpoint:** `https://ais-dev-4nz7iwhnollim4zlqf57pf-616830268255.europe-west2.run.app`
* **Shared / Staging Ingress Endpoint:** `https://ais-pre-4nz7iwhnollim4zlqf57pf-616830268255.europe-west2.run.app`
* **Internal Listen Target:** Port `3000`, Host `0.0.0.0` (Container standard ingress proxy)

---

## Container Runtime Specifications
* **Base Runtime:** Node.js `v22.23.2` on Linux (`x86_64`)
* **Package Manager:** npm `10.9.8`
* **Production Entrypoint:** `node dist/server.cjs`
* **Build Pipeline Artifact:** Bundled CommonJS backend (`dist/server.cjs` 718 KB) + Client Vite SPA distribution (`dist/assets/`)
* **CPU Allocation:** 1 vCPU (Standard container allocation)
* **Memory Allocation:** 512 MiB to 1 GiB
* **Request Concurrency:** 80 concurrent connections per container instance
* **Request Timeout:** 300 seconds
* **Scaling Bounds:**
  * `Min Instances`: 0 (scale-to-zero in preview) / 2 (recommended production baseline)
  * `Max Instances`: 10 (autoscaling ceiling)

---

## Environment & Persistence Configuration
* **Node Environment:** `NODE_ENV=production`
* **Configured Persistence Engine:** `PostgresPersistenceAdapter` (PostgreSQL via `pg.Pool`)
* **Active Standby Fallback:** `JsonFilePersistenceAdapter` with atomic `.tmp` file swapping and file locking
* **Relational Schema Target:** 16-table PostgreSQL DDL (`server/db/sql/schema.sql`)
* **Secret Injection Mechanism:** Google Cloud Secret Manager / Server Environment Variables
* **Secrets Required:**
  * `DATABASE_URL`: PostgreSQL connection string (Cloud SQL UNIX socket / TCP connection)
  * `PAYMOB_API_KEY`: Paymob Merchant Secret Key
  * `PAYMOB_HMAC_SECRET`: SHA-512 Webhook HMAC Secret
  * `GEMINI_API_KEY`: Google Gemini Generative AI Server API Key
  * `SESSION_SECRET`: Cryptographic session seed token

---

## Health & Diagnostics
* **Health Check Path:** `GET /api/health`
* **Startup Probe:** Validates HTTP 200 response on `/api/health`
* **Liveness Probe:** Validates active HTTP event loop on port 3000
* **Graceful Shutdown:** Traps `SIGTERM` and `SIGINT`, ceases new ingress processing, flushes transactional buffers, and terminates cleanly with exit code 0.
