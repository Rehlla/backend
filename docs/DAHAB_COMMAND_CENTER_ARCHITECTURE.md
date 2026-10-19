# DAHAB COMMAND CENTER — ARCHITECTURE

## Overview

The Dahab Command Center transforms the existing Operations Console into a single operational control plane. It does NOT rebuild existing systems — it connects and controls them.

## Core Principle

**ACTION-FIRST**: The operator's primary question is "What should I do next?" — not "What numbers can I look at?"

---

## Information Architecture

```
DAHAB COMMAND CENTER
├── Overview (DEFAULT)
│   ├── Operational Status Summary
│   ├── Action Queue (prioritized, actionable)
│   ├── Recent Events Stream
│   └── System Health Indicators
├── Live Operations
│   ├── Live Trip Radar (real backend data)
│   ├── Trip Command View (single trip detail)
│   ├── Bookings
│   └── Transfers
├── Exceptions
│   ├── Active Exceptions (from market alerts, knowledge gaps, support)
│   ├── Pending Reviews
│   └── Incident Timeline
├── Commerce
│   ├── Financial Ledger (real /api/commerce/ledger)
│   ├── Ledger Verification
│   ├── Payments
│   └── Refunds
├── Suppliers
│   ├── Supplier List (real /api/suppliers)
│   ├── Supplier Dashboard
│   ├── Supplier Reliability
│   └── Supplier Issues
├── Intelligence
│   ├── Market Radar (real /api/market/*)
│   ├── Source Health
│   ├── Change Events
│   ├── Price Intelligence
│   └── Product Opportunities
├── Knowledge
│   ├── DKOS Health
│   ├── Knowledge Gaps
│   ├── Entity Resolution
│   └── Conflicts
├── Support
│   ├── Open Conversations (real /api/support/messages)
│   ├── Pending Replies
│   └── Urgent Items
├── Audit
│   └── Real audit events from /api/operations/audit-events
├── Feature Flags
│   └── Real experiments from /api/daygi/beta/experiments
└── System
    ├── Health (/api/health)
    ├── Integrations
    └── Background Jobs
```

---

## Data Source Mapping

| Area | View | Data Source | Actions Available | Role Required |
|------|------|------------|-------------------|---------------|
| Overview | Status Summary | `/api/operations/overview` | Navigate to issue | Operations |
| Overview | Support Queue | `/api/support/messages` | Reply, Close | Operations |
| Overview | Recent Events | `/api/events/recent` | Filter | Operations |
| Overview | System Health | `/api/health` | None (read-only) | Operations |
| Live Trips | Trip List | `/api/trips/user/:id` (all users) | Open, Transition status | Operations |
| Live Trips | Trip Detail | `/api/trips/:id`, `/api/trips/:id/bookings` | Transition, Contact, View bookings | Operations |
| Live Trips | Bookings | `/api/trips/:id/bookings` | Inspect supplier, Inspect payment | Operations |
| Live Trips | Transfers | `/api/transfers/telemetry/:bookingId` | Ping driver, Refresh | Operations |
| Exceptions | Market Alerts | `/api/market/alerts` | Acknowledge, Resolve | Operations |
| Exceptions | Knowledge Gaps | `/api/dahab/admin/gaps` | Navigate to DKOS | Operations |
| Exceptions | Review Queue | `/api/market/review-queue` | Approve, Reject, Dismiss | Operations |
| Commerce | Ledger | `/api/commerce/ledger` | Verify integrity | Operations |
| Commerce | Verify | `/api/commerce/ledger/verify` | Run verification | Operations |
| Commerce | Refund | `/api/commerce/refund` | Process refund (with confirmation) | Operations |
| Suppliers | List | `/api/suppliers` | View dashboard | Operations |
| Suppliers | Dashboard | `/api/suppliers/:id/dashboard` | Approve bookings, Contact | Operations + Supplier |
| Suppliers | Bookings | `/api/suppliers/:id/bookings` | Accept/Reject/Dispatch/Complete | Supplier |
| Intelligence | Source Health | `/api/market/sources/health` | Reset circuit breaker | Operations |
| Intelligence | Alerts | `/api/market/alerts` | Acknowledge, Resolve | Operations |
| Intelligence | Review Queue | `/api/market/review-queue` | Resolve item | Operations |
| Intelligence | Refresh | `/api/market/refresh` | Recompute indices | Operations |
| Intelligence | Opportunities | `/api/intelligence/opportunities` | Accept/Reject/Defer | Product + Operations |
| Knowledge | DKOS Health | `/api/dahab/admin/health` | None (read-only) | Operations |
| Knowledge | Conflicts | `/api/dahab/admin/conflicts` | Resolve conflict | Operations |
| Knowledge | Stale Facts | `/api/dahab/admin/stale-facts` | None (read-only) | Operations |
| Knowledge | Review Queue | `/api/dahab/admin/review-queue` | Approve/Reject/Request info | Operations |
| Knowledge | Entity Resolution | `/api/dahab/admin/entities/resolve` | Resolve, Merge | Operations |
| Support | Messages | `/api/support/messages` | Reply (POST /:id/reply) | Operations |
| Audit | Events | `/api/operations/audit-events` | None (read-only) | Operations |
| Feature Flags | Experiments | `/api/daygi/beta/experiments` | Update flags | Product |
| System | Health | `/api/health` | None (read-only) | Operations |
| System | Background Jobs | `/api/jobs/status` | None (read-only) | Operations |
| System | Weather | `/api/telemetry/weather` | None (read-only) | Operations |

---

## What Is Real vs Simulated

### REAL (Connected to Backend)
- Trip CRUD and status transitions
- Booking management and supplier responses
- Payment processing and ledger
- Ledger verification
- Supplier management
- Market intelligence data and refresh
- Support messaging
- Knowledge gaps and conflicts
- Entity resolution
- Audit logging
- Feature flags (DayGI experiments)
- Background job status
- Weather telemetry
- SMS dispatch

### SIMULATED (Requires External Integration)
- Live GPS tracking (transfer telemetry exists, real GPS does not)
- Camera feeds (simulated locations, no actual streams)
- WhatsApp supplier bridge (Twilio SMS is real, WhatsApp Business API not connected)
- Flight radar data (no real ADS-B integration)
- Rider dispatch for food delivery
- Paymob payment gateway (simulation mode)
- Real-time WebSocket updates (currently polling)

---

## Priority Model

Every operational item is classified:

| Priority | Description | Response Target |
|----------|-------------|-----------------|
| CRITICAL | Safety, financial loss, customer at risk | Immediate |
| HIGH | Needs action soon, SLA approaching | < 30 min |
| MEDIUM | Important but not urgent | < 4 hours |
| LOW | Informational | When available |

Priority is always explainable — the UI shows WHY an item has its priority level.

---

## Security Model

All controls are subject to:
1. **Authentication** — session cookie required
2. **RBAC** — Operations/Admin/Supplier/Traveler roles
3. **Ownership** — Suppliers can only see their own bookings
4. **Audit** — Every consequential action is logged
5. **Server-side authorization** — Frontend guards are UX only; backend is the real boundary

High-risk actions (refunds, cancellations, feature flag mutations) require:
- Explicit confirmation dialog
- Audit trail entry
- Role verification

---

## Navigation Design

The Command Center uses a **persistent sidebar** instead of the horizontal tab bar:

- **Top**: System status indicator (green/amber/red dot)
- **Sections**: Grouped by operational domain
- **Each section**: Icon + label + badge count (for items needing attention)
- **Default**: Overview (never DayGI Quality)
- **Responsive**: Sidebar collapses to icons at smaller widths

---

## Data Freshness Convention

Every live dataset shows its freshness:
- `Updated Xs ago` — fresh (< 1 min)
- `Last update Xm ago` — aging (1-10 min)
- `Stale` — (> 10 min)
- `Unknown` — no data available

The UI never says "LIVE" unless data is actually streaming.

---

## Empty States

When nothing is happening, the Command Center shows:
- "No active incidents"
- "All systems healthy"
- "No pending confirmations"

Empty states are NEVER populated with demo data. They build trust.
