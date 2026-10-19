# DAHAB COMMAND CENTER — CONTROL MAP

**Version:** 2.0 — August 31, 2026

This document is the operational contract for every section of the Command Center.

---

## NAVIGATION STRUCTURE (16 sections)

```
├── Overview (default)
├── Live Trips
├── Transfers
├── Exceptions
├── Commerce (4 tabs: Ledger, Payments, Verify, Anomalies)
├── Suppliers (2 views: List, Reliability)
├── Intelligence (7 tabs: Overview, Sources, Alerts, Opportunities, Features, Price History, Refresh)
├── Opportunities
├── Knowledge (7 tabs: Health, Gaps, Conflicts, Review, Stale, Logs, Metrics)
├── Support (2 tabs: Messages, Notifications)
├── SMS Center
├── Notifications
├── Audit Log (filterable + exportable)
├── Feature Flags
├── Market Jobs
└── System Health (Services + Integrations)
```

---

## SECTION CONTROL MAP

| Area | View | Data Source | Actions | Required Role | Audit Event |
|------|------|------------|---------|---------------|-------------|
| **Overview** | Status Banner | `/api/operations/overview` | Navigate to issue | Operations | — |
| **Overview** | Stat Cards | `/api/operations/overview`, `/api/support/messages`, `/api/market/alerts`, `/api/operations/transfers`, `/api/operations/notifications` | Navigate to section | Operations | — |
| **Overview** | Action Queue | `/api/support/messages`, `/api/market/alerts`, `/api/market/review-queue` | Open entity | Operations | — |
| **Overview** | System Health | `/api/health` | Navigate to health | Operations | — |
| **Overview** | Recent Events | `/api/operations/overview` (events) | Filter | Operations | — |
| **Live Trips** | Trip List | `/api/operations/trips` | Open trip | Operations | — |
| **Live Trips** | Trip Command View | `/api/trips/:id`, `/api/trips/:id/bookings` | Transition status, View bookings | Operations | `TRIP_STATUS_TRANSITION` |
| **Live Trips** | Bookings Tab | `/api/trips/:id/bookings` | Inspect supplier, Inspect payment | Operations | — |
| **Live Trips** | Timeline Tab | `/api/trips/:id` (items) | — | Operations | — |
| **Live Trips** | Financial Tab | `/api/trips/:id` (financials) | — | Operations | — |
| **Transfers** | Transfer List | `/api/operations/transfers` | Call driver, Open trip | Operations | — |
| **Exceptions** | Active Exceptions | `/api/market/alerts`, `/api/support/messages`, `/api/market/review-queue`, `/api/dahab/admin/gaps` | Acknowledge, Resolve | Operations | `ALERT_ACKNOWLEDGED`, `REVIEW_RESOLVED` |
| **Commerce** | Ledger Table | `/api/commerce/ledger` | — | Operations | — |
| **Commerce** | Payments Tab | `/api/operations/payments` | — | Operations | — |
| **Commerce** | Verify Integrity | `/api/commerce/ledger/verify` | Run verification | Operations | — |
| **Commerce** | Anomalies Tab | `/api/commerce/ledger/anomalies` | — | Operations | — |
| **Suppliers** | Supplier List | `/api/suppliers` | View dashboard | Operations | — |
| **Suppliers** | Reliability Table | `/api/operations/supplier-reliability` | View supplier | Operations | — |
| **Suppliers** | Supplier Dashboard | `/api/suppliers/:id/dashboard`, `/api/suppliers/:id/bookings` | Accept/Reject bookings | Operations + Supplier | `SUPPLIER_BOOKING_RESPOND` |
| **Intelligence** | Overview | `/api/market/ops/overview` | — | Operations | — |
| **Intelligence** | Source Health | `/api/market/sources/health` | Reset circuit breaker | Operations | `CIRCUIT_BREAKER_RESET` |
| **Intelligence** | Alerts | `/api/market/alerts` | Acknowledge | Operations | `ALERT_ACKNOWLEDGED` |
| **Intelligence** | Opportunities | `/api/intelligence/opportunities` | Accept/Reject/Defer | Operations + Product | `OPPORTUNITY_ACCEPTED`, `OPPORTUNITY_REJECTED`, `OPPORTUNITY_DEFERRED` |
| **Intelligence** | Features | `/api/intelligence/features` | — | Operations | — |
| **Intelligence** | Price History | `/api/market/price-history` | — | Operations | — |
| **Intelligence** | Refresh | `/api/market/refresh` | Recompute indices | Operations | `MARKET_REFRESH` |
| **Opportunities** | Opportunity List | `/api/intelligence/opportunities` | Accept/Reject/Defer | Operations + Product | `OPPORTUNITY_*` |
| **Knowledge** | DKOS Health | `/api/dahab/admin/health` | — | Operations | — |
| **Knowledge** | Knowledge Gaps | `/api/dahab/admin/gaps` | — | Operations | — |
| **Knowledge** | Conflicts | `/api/dahab/admin/conflicts` | Resolve | Operations | `CONFLICT_RESOLVED` |
| **Knowledge** | Review Queue | `/api/dahab/admin/review-queue` | Approve/Reject | Operations | `REVIEW_RESOLVED` |
| **Knowledge** | Stale Facts | `/api/dahab/admin/stale-facts` | — | Operations | — |
| **Knowledge** | Search Logs | `/api/dahab/admin/logs` | — | Operations | — |
| **Knowledge** | Expansion Metrics | `/api/dahab/admin/expansion-metrics` | — | Operations | — |
| **Support** | Messages | `/api/support/messages` | Reply | Operations | `SUPPORT_REPLY` |
| **Support** | Notifications | `/api/operations/notifications` | — | Operations | — |
| **SMS Center** | Dispatch Form | `/api/operations/sms-dispatch` | Send SMS | Operations | `SMS_DISPATCHED` |
| **SMS Center** | SMS Logs | `/api/sms/logs` | — | Operations | — |
| **Notifications** | Notification List | `/api/operations/notifications` | — | Operations | — |
| **Audit Log** | Event Table | `/api/operations/audit-events` | Filter, Export CSV | Operations | — (read-only) |
| **Feature Flags** | Experiment Toggles | `/api/daygi/beta/experiments` | Toggle flag | Operations | `FLAG_TOGGLED` |
| **Market Jobs** | Job List | `/api/market/jobs` | Run job, Run all | Operations | `JOB_ENQUEUED` |
| **System Health** | Services | `/api/health`, `/api/market/status`, `/api/jobs/status` | — | Operations | — |
| **System Health** | Integrations | `/api/operations/integrations` | — | Operations | — |

---

## BACKEND ENDPOINTS (Complete)

### Operations
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/operations/overview` | Platform overview | — |
| GET | `/api/operations/audit-events` | Audit log | — |
| GET | `/api/operations/trips` | All trips (admin) | — |
| GET | `/api/operations/bookings` | All bookings (admin) | — |
| GET | `/api/operations/payments` | Payment summary | — |
| GET | `/api/operations/transfers` | Active transfers | — |
| GET | `/api/operations/supplier-reliability` | Supplier health | — |
| POST | `/api/operations/refund` | Process refund | Operations |
| GET | `/api/operations/notifications` | All notifications | — |
| POST | `/api/operations/sms-dispatch` | Send SMS | Operations |
| GET | `/api/operations/integrations` | Integration status | — |

### Commerce
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/commerce/ledger` | Ledger entries |
| GET | `/api/commerce/ledger/verify` | Verify integrity |
| GET | `/api/commerce/ledger/anomalies` | Ledger anomalies |
| GET | `/api/commerce/ledger/reconcile/:bookingRef` | Reconcile booking |
| POST | `/api/commerce/refund` | Process refund |

### Suppliers
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/suppliers` | List suppliers |
| GET | `/api/suppliers/:id/dashboard` | Supplier dashboard |
| GET | `/api/suppliers/:id/bookings` | Supplier bookings |
| POST | `/api/suppliers/bookings/:id/respond` | Respond to booking |

### Market Intelligence
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/market/alerts` | Market alerts |
| POST | `/api/market/alerts/:id/acknowledge` | Acknowledge alert |
| POST | `/api/market/alerts/:id/resolve` | Resolve alert |
| GET | `/api/market/sources/health` | Source health |
| POST | `/api/market/sources/circuit-breaker/reset` | Reset circuit breaker |
| GET | `/api/market/review-queue` | Review queue |
| POST | `/api/market/review-queue/:id/resolve` | Resolve review item |
| GET | `/api/market/ops/overview` | Ops overview |
| GET | `/api/market/price-history` | Price history |
| GET | `/api/market/events` | Market events |
| GET | `/api/market/source-freshness` | Source freshness |
| POST | `/api/market/refresh` | Refresh market data |
| GET | `/api/market/jobs` | Market jobs |
| POST | `/api/market/jobs/trigger` | Trigger job |

### Intelligence
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/intelligence/summary` | Intelligence summary |
| GET | `/api/intelligence/features` | Feature register |
| GET | `/api/intelligence/opportunities` | Opportunities |
| POST | `/api/intelligence/opportunities/:id/action` | Accept/reject/defer |

### Knowledge (Admin)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dahab/admin/health` | DKOS health |
| GET | `/api/dahab/admin/conflicts` | Conflicts |
| POST | `/api/dahab/admin/conflicts/resolve` | Resolve conflict |
| GET | `/api/dahab/admin/gaps` | Knowledge gaps |
| GET | `/api/dahab/admin/stale-facts` | Stale facts |
| GET | `/api/dahab/admin/logs` | Search logs |
| GET | `/api/dahab/admin/expansion-metrics` | Expansion metrics |
| GET | `/api/dahab/admin/review-queue` | Review queue |
| POST | `/api/dahab/admin/review-queue/resolve` | Resolve review |

### Support
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/support/messages` | Support messages |
| POST | `/api/support/messages/:id/reply` | Reply to message |

### System
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/jobs/status` | Background jobs |
| POST | `/api/jobs/enqueue` | Enqueue job |
| GET | `/api/events/recent` | Recent events |
| GET | `/api/notifications` | Notifications |
| GET | `/api/sms/logs` | SMS logs |

### Feature Flags
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/daygi/beta/experiments` | Get experiments |
| POST | `/api/daygi/beta/experiments` | Update experiments |

### Trips
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/trips/:id` | Trip detail |
| PATCH | `/api/trips/:id/status` | Transition status |
| GET | `/api/trips/:id/bookings` | Trip bookings |

---

## AUDIT EVENT TYPES

| Action | Entity | Trigger |
|--------|--------|---------|
| `REFUND_PROCESSED` | booking | POST /api/operations/refund |
| `SMS_DISPATCHED` | sms | POST /api/operations/sms-dispatch |
| `OPPORTUNITY_ACCEPTED` | opportunity | POST /api/intelligence/opportunities/:id/action |
| `OPPORTUNITY_REJECTED` | opportunity | POST /api/intelligence/opportunities/:id/action |
| `OPPORTUNITY_DEFERRED` | opportunity | POST /api/intelligence/opportunities/:id/action |
| `JOB_ENQUEUED` | job | POST /api/jobs/enqueue |
| `TRIP_STATUS_TRANSITION` | trip | PATCH /api/trips/:id/status |
| `SUPPLIER_BOOKING_RESPOND` | booking | POST /api/suppliers/bookings/:id/respond |
| `SUPPORT_REPLY` | support | POST /api/support/messages/:id/reply |
| `ALERT_ACKNOWLEDGED` | market-alert | POST /api/market/alerts/:id/acknowledge |
| `REVIEW_RESOLVED` | review-queue | POST /api/market/review-queue/:id/resolve |
| `CONFLICT_RESOLVED` | knowledge-conflict | POST /api/dahab/admin/conflicts/resolve |
| `MARKET_REFRESH` | market | POST /api/market/refresh |
| `CIRCUIT_BREAKER_RESET` | market-source | POST /api/market/sources/circuit-breaker/reset |
| `FLAG_TOGGLED` | feature-flag | POST /api/daygi/beta/experiments |

---

## COMPONENT INVENTORY

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| CommandCenterShell | CommandCenterShell.tsx | ~360 | Main shell, sidebar, Cmd+K |
| Overview | Overview.tsx | ~620 | Status, stats, action queue, health, events |
| LiveTripRadar | LiveTripRadar.tsx | ~300 | Trip list + Trip Command View |
| TransfersSection | TransfersSection.tsx | ~120 | Transfer list with telemetry |
| ExceptionsCenter | ExceptionsCenter.tsx | ~180 | Aggregated exceptions |
| CommerceControl | CommerceControl.tsx | ~250 | Ledger + payments + verify + anomalies |
| SupplierCommand | SupplierCommand.tsx | ~280 | Supplier list + reliability + bookings |
| IntelligenceCommand | IntelligenceCommand.tsx | ~280 | Market intelligence (7 tabs) |
| OpportunitiesSection | OpportunitiesSection.tsx | ~130 | Opportunity cards with actions |
| KnowledgeOps | KnowledgeOps.tsx | ~250 | DKOS operations (7 tabs) |
| SupportCenter | SupportCenter.tsx | ~230 | Support messages + notifications |
| SmsCenter | SmsCenter.tsx | ~150 | SMS dispatch + logs |
| NotificationsCenter | NotificationsCenter.tsx | ~110 | Notification list |
| AuditCenter | AuditCenter.tsx | ~150 | Audit log with filtering + export |
| FeatureFlagsView | FeatureFlagsView.tsx | ~100 | Experiment toggles |
| MarketJobsSection | MarketJobsSection.tsx | ~100 | Market job management |
| SystemHealth | SystemHealth.tsx | ~140 | Health + integrations |
| ConfirmDialog | ConfirmDialog.tsx | ~110 | Confirmation for destructive actions |
| FreshnessBadge | FreshnessBadge.tsx | ~80 | Data freshness indicator |
| Pagination | Pagination.tsx | ~80 | Reusable pagination |
| CommandPalette | CommandPalette.tsx | ~200 | Cmd+K search |

**Total:** 21 components, ~4,300 lines of TypeScript/React
