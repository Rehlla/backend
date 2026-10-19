# DAHAB PLATFORM — ARCHITECTURE RECONCILIATION REPORT
**Authoritative Stack & Runtime Audit**  
*Audit Date: 2026-08-25*  
*Repository ID: 717a0ff2-3c57-4297-9434-d9ca0c85f287*

---

## 1. Executive Summary

This document performs an exhaustive, unsparing architectural audit of the repository to reconcile the **historically envisioned enterprise stack** (Angular / Laravel / PHP / PostgreSQL / Redis) against the **actual running codebase** (React 19 / Vite / Node.js Express / TypeScript / Tailwind CSS v4).

### Key Finding:
The **Current Primary & Exclusive Active Runtime** in the repository is a **Full-Stack Node.js/Express + React 19 SPA (Vite)**. There are no active PHP, Laravel, Angular, or PostgreSQL files present in the filesystem.

---

## 2. Detailed Stack Reconciliation Matrix

| Layer | Envisioned / Historical Architecture | Actual Running Repository Stack | Status / Classification | Evidence / File Path |
|---|---|---|---|---|
| **Frontend Framework** | Angular (v17/v18) | **React 19.0.1** | **ACTIVE PRIMARY** | `package.json` line 19: `"react": "^19.0.1"`, `src/main.tsx`, `src/App.tsx` |
| **Frontend Build Tool** | Angular CLI / Webpack | **Vite 6.2.3** | **ACTIVE PRIMARY** | `vite.config.ts`, `package.json` line 21 |
| **Styling & Design Tokens** | SCSS / Angular Material | **Tailwind CSS v4.1.14** | **ACTIVE PRIMARY** | `src/index.css` (`@import "tailwindcss";`), `@tailwindcss/vite` |
| **Backend Runtime** | PHP 8.2+ / Laravel 11 | **Node.js (v20+) with Express 4.21.2 & TypeScript** | **ACTIVE PRIMARY** | `server.ts`, `package.json` line 22: `"express": "^4.21.2"` |
| **Backend Transpiler** | PHP-FPM / Composer | **tsx 4.21.0 (dev) / esbuild 0.25.0 (prod)** | **ACTIVE PRIMARY** | `package.json` line 8: `"build": "vite build && esbuild server.ts..."` |
| **Database / Storage** | PostgreSQL 16 + Drizzle/Eloquent | **In-Memory JavaScript Objects & React Context** | **ADAPTER / IN-MEMORY (NO REAL DB)** | `server.ts` (`serverLedgerHistory[]`), `src/context/TripContext.tsx` |
| **Caching & Job Queue** | Redis (Predis / Horizon) | **In-Memory Process State (Node.js)** | **SIMULATED / IN-MEMORY** | No Redis client in `package.json` |
| **AI Layer** | Custom Python / Microservice | **@google/genai SDK (v2.4.0) with Gemini 3.7 Flash** | **ACTIVE CONNECTED (when key provided)** | `server.ts` line 4, lines 356-363, `package.json` line 15 |
| **Container & Port** | Nginx Reverse Proxy (Port 80/443) | **Express on 0.0.0.0:3000 behind Platform Reverse Proxy** | **ACTIVE PRIMARY** | `server.ts` line 604: `PORT = 3000` |

---

## 3. Structural Analysis: Frontend & Backend

### A. Frontend Stack (Active)
- **Framework:** React 19.0.1 (SPA architecture).
- **Routing:** Internal state routing driven by `TripContext` (`currentRoute` state) in `src/App.tsx`.
- **Internationalization:** Custom bilingual context (`src/i18n/LanguageContext.tsx`) providing instant English (`en`) and Arabic (`ar` with RTL direction) switching.
- **State Management:** `TripProvider` (`src/context/TripContext.tsx`) maintaining central `Trip`, `Ledger`, `Profile`, `Bookings`, and `Opportunities`.

### B. Backend Stack (Active)
- **Server Entry:** `server.ts` (Express server configured for port 3000).
- **API Surface:**
  - `GET /api/health` — Service health & Gemini status.
  - `GET /api/intelligence/summary` — Overview of ingested intelligence fixtures.
  - `GET /api/commerce/ledger` — In-memory double-entry accounting ledger entries.
  - `POST /api/commerce/hold` — In-memory 15-minute reservation hold token generator.
  - `POST /api/commerce/checkout` — Idempotent in-memory checkout & ledger capture.
  - `GET /api/transfers/telemetry/:bookingId` — Static/in-memory transfer telemetry fixture.
  - `POST /api/intelligence/ask` — Gemini 3.7 Flash grounded Q&A with deterministic fallback.
  - `POST /api/intelligence/draft-opportunity` — Gemini structured opportunity synthesis.
- **Vite Integration:** In development, Vite is mounted as an Express middleware (`server: { middlewareMode: true }`). In production, Express statically serves the pre-compiled `dist/` directory.

### C. Legacy / Parallel Stack Check
- A full search of the workspace confirms:
  - **No PHP files (`.php`) exist.**
  - **No Laravel files (`artisan`, `composer.json`) exist.**
  - **No Angular files (`angular.json`, `.component.ts` Angular modules) exist.**
  - **No PostgreSQL migration scripts (`schema.sql`, `drizzle.config.ts`, `knexfile.js`) exist.**

---

## 4. Stack Classification & Verdict

1. **Current Active Stack:** `TypeScript + Node.js (Express) + React 19 + Tailwind CSS v4 + Vite`.
2. **Architecture Mode:** High-fidelity Interactive Simulation & Prototype Platform.
3. **Database Gap:** The application does **NOT** currently connect to a persistent SQL or NoSQL database. All transactions, ledger records, traveler profiles, and bookings reset when the Node.js server or browser session reloads.
4. **Integration Verdict:** The React/Express stack is the **sole authoritative codebase** in this repository. Any documentation referring to Laravel or Angular must be classified as legacy design specifications that have been superseded by this TypeScript implementation.
