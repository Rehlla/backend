# DAHAB KNOWLEDGE REFRESH & CHANGE DETECTION RUNBOOK
**Document ID**: `DOC-ARCH-2026-DKOS-REFRESH`  
**Classification**: Scheduled Job Orchestration, Observation Ingestion & Revalidation  
**Version**: 2026.1  

---

## 1. Domain-Specific Refresh Intervals

| Domain | Refresh Interval | Primary Trigger | Action on Stale |
|---|---|---|---|
| **Meteorological & Marine Radar** | Hourly / On-demand | Buoy sensor feed / API | Re-evaluate active wind gates |
| **Emergency Directory** | Continuous / Weekly verification | Automated phone ping / Ops test | Escalate immediately to Operations Director |
| **Direct Supplier Pricing & Slots** | Real-time / Daily sync | Supplier Portal update | Suspend instant booking if unconfirmed > 48h |
| **Restaurant Opening Hours** | Bi-weekly | Local field survey | Downgrade confidence from HIGH to MEDIUM |
| **Google Places Harvest** | Weekly batch | Change radar crawler | Quarantine detected changes for Ops review |
| **Regulatory Directives** | Per Official Gazette | CDWS bulletin | Update authoritative rules with immediate push |
