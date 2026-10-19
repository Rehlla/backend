# Dahab Market & Web Intelligence Layer — Data Governance & Security Policy

## 1. Governance Principles & Scope

The Dahab Tourism Platform adheres to strict data governance standards for all externally sourced and synthesized intelligence. All collection, processing, storage, and retrieval workflows must comply with:
- **Terms of Service (ToS) Governance**: Only authorized APIs, authorized RSS/JSON-LD feeds, and robots.txt-compliant public pages are permitted in production.
- **Privacy & PII Minimization**: No personal consumer reviews, usernames, private phone numbers, or user avatars are stored.
- **Security & Prompt Injection Immunity**: External untrusted content is strictly sanitized and treated as untrusted text strings. External text is never passed directly into executable agent actions or internal tool dispatchers without deterministic parsing.
- **Strict Separation of Concerns**: Intelligence records are read-only advisory signals and cannot mutate booking inventory, pricing catalogs, or financial ledgers without human operations authorization.

---

## 2. Source Classification & Production Readiness Framework

Every external data stream is categorized according to its governance posture:

| Governance Category | Description | Permitted Usage | Production Readiness |
|---|---|---|---|
| **Official API** | Explicit developer contract, OAuth2/API key, structured schema. | Live Ingestion & Automated Normalization | **Production-Ready** |
| **Authorized Feed** | Public RSS / JSON-LD publisher feed explicitly intended for syndication. | Automated Normalization & Discovery | **Production-Ready** |
| **Public Web Page** | Microdata inspected in compliance with robots.txt rules. | Ephemeral Sentiment & Benchmark | **Candidate Feed (Requires API)** |
| **Indirect / Aggregated** | Industry tariffs aggregated through public brochures or partner quotes. | Internal Benchmark Reference | **Candidate Feed** |
| **Unsupported Scraping** | Scraping behind login walls, social graphs, or ToS-restricted pages. | **PROHIBITED** | **NOT PRODUCTION-READY** |

> **MANDATE**: Any source marked **NOT PRODUCTION-READY** (e.g., Facebook group scraping) is immediately paused in the ingestion engine and isolated from live pipeline execution.

---

## 3. Data Retention & Lifecycle Schedules

| Ingestion Category | Retention Period | Storage Target | Disposal Action |
|---|---|---|---|
| **Raw Observation Payloads** | 30 Days | Encrypted Cold Storage | Hard Deletion / Pruned |
| **Review Sentiment Signals** | 14 Days | In-Memory / Ephemeral Cache | Rolled up to Aggregate Score |
| **Market Price Time-Series** | 90 Days | Read-Only Analytical Store | Downsampled to Daily Medians |
| **Discovered Supplier Staging** | 60 Days | Vetting Pipeline Quarantine | Archive or Promotion to Supplier OS |
| **Regulatory & Road Advisories** | 7 Days | Active Advisory Cache | Superseded by Fresh Notice |

---

## 4. Untrusted Content Sanitization & Prompt Injection Defense

Web-crawled content is classified as **UNTRUSTED INPUT**. To protect internal AI agents and backend systems from prompt injection, indirect attacks, and malicious payloads:
1. **Deterministic Parsing**: Raw HTML/JSON is sanitized via strict allowlisted schema validators before entering database stores.
2. **Instruction Neutralization**: All external snippets are wrapped in isolated data blocks (`<untrusted_observation> ... </untrusted_observation>`) when evaluated by summarization algorithms.
3. **No Direct Tool Invocation**: AI agents summarizing market intelligence have **zero execution privileges** over booking systems, refunds, database schemas, or payment gateways.
4. **HTML Entity Stripping**: All script tags, iframe embeds, markdown image links, and tracking beacons are stripped at the connector gateway layer.

---

## 5. Audit Logging & Provenance Integrity

1. **SHA-256 Provenance Hashes**: Computed at ingest time to guarantee payload immutability.
2. **Immutable Audit Trail**: All supplier promotion, rejection, price benchmark overrides, and change radar acknowledgements log:
   - `timestamp`
   - `actorRole` (e.g., Sinai Operations Admin)
   - `actorEmail`
   - `actionType`
   - `rationale` / `verificationEvidence`
