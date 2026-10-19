# DAHAB PLATFORM — REFERENCE VERTICAL STANDARD (V1)
**Architectural Blueprint & Contract for Commercial Subsystems**  
*Reference Implementation: Private & Shared Airport Transfers (SSH ⇄ Dahab)*  
*Applicable to: Transfers, Diving & Watersports, Desert Safaris, Accommodations, Local Dining*

---

## 1. The 10-Stage Vertical Pipeline

Every commercial service vertical in the Dahab platform must strictly implement the canonical 10-stage lifecycle:

```
[1. Product Catalog] 
       ↓
[2. Real-Time Availability & Quoting] 
       ↓
[3. Reservation Hold & Lock] 
       ↓
[4. Idempotent Payment & Escrow] 
       ↓
[5. Supplier Dispatch & Assignment] 
       ↓
[6. Signed Confirmation & Voucher] 
       ↓
[7. TripItem Ingestion & Dependency Linking] 
       ↓
[8. Multichannel Contextual Notification] 
       ↓
[9. Operations Console Telemetry & SLA Alarms] 
       ↓
[10. Financial Ledger & Analytics Ingestion]
```

---

## 2. Phase-by-Phase Technical Requirements

### Phase 1: Product Catalog & Metadata
- **Entity Definition**: Every product must have an immutable `skuId`, localized name (`en`/`ar`), category, capability flags (e.g. `hasAirConditioning`, `includesLuggageAssist`, `flightTracking`), base pricing rules, and cancellation policies.
- **Contract**:
  ```typescript
  interface VerticalProduct {
    skuId: string;
    vertical: 'transfer' | 'diving' | 'safari' | 'hotel' | 'dining';
    titleEn: string;
    titleAr: string;
    capacityMin: number;
    capacityMax: number;
    luggageAllowancePerPax: number;
    basePriceEGP: number;
    commissionRate: number; // e.g. 0.15 (15%)
    cancellationGraceHours: number;
  }
  ```

### Phase 2: Real-Time Availability & Quoting
- Checks real-time vehicle/instructor/room inventory before showing prices.
- Injects dynamic contextual factors (e.g. night pickup surcharge between 23:00 and 05:00, Sinai high-season multiplier).
- Output must be deterministic and return a `quoteToken` with a 15-minute validity timestamp.

### Phase 3: Reservation Hold & Concurrency Control
- To prevent double bookings, the system places a temporary 15-minute `HOLD` on the specific resource slot (e.g., driver vehicle or dive boat seat).
- If checkout is not completed within 15 minutes, the hold expires automatically without penalty.

### Phase 4: Idempotent Payment & Escrow
- Payment is initiated with a client-generated `idempotencyKey` (`UUIDv4`).
- Funds are authorized and captured directly into the platform escrow account.
- **Double-Entry Ledger Creation**:
  - `DEBIT: TravelerPaymentCard`
  - `CREDIT: PlatformEscrowAccount`

### Phase 5: Supplier Dispatch & Automated Assignment
- Webhook/Push event dispatched to the verified supplier via Supplier OS.
- Supplier confirms receipt within SLA window (Standard: 30 minutes; Instant: < 2 minutes).
- Resource assigned with full metadata (e.g., Driver Name: `Mahmoud Salem`, Vehicle: `Toyota HiAce 2024 White - Plate: ط ج د 4821`, Contact: `+20 100 876 5432`).

### Phase 6: Signed Confirmation & Cryptographic Voucher
- Traveler receives a signed booking confirmation with unique reference code (e.g. `DHB-TRF-2026-8941`).
- Generates offline-capable QR voucher with encrypted verification hash.

### Phase 7: TripItem Ingestion & Dependency Graph
- The confirmed booking is immediately synthesized into an authoritative `TripItem`.
- Linked into the traveler's `Trip` timeline:
  - Updates Day 1 arrival schedule.
  - Recalculates departure buffer times.
  - Automatically unblocks downstream activities (e.g., cannot schedule a 10:00 AM dive if transfer arrives at 11:30 AM).

### Phase 8: Multichannel Contextual Notification
- Multilingual dispatch (`ar` / `en`):
  - **In-App**: Notification center card + Companion alert.
  - **WhatsApp / SMS**: Structured booking summary with driver direct contact and pickup location pin.

### Phase 9: Operations Console Telemetry & Exception Handling
- Real-time SLA tracking in Ops Console:
  - Alert triggered if flight delay > 45 mins (auto-reschedule driver).
  - Alarm triggered if supplier fails to acknowledge 90 mins prior to service.
  - 1-click Ops failover button to reassign to secondary fleet partner.

### Phase 10: Financial Settlement & Analytics Ingestion
- Upon service completion (confirmed by driver geolocation check-in or traveler completion tap):
  - **Ledger Settlement**:
    - `DEBIT: PlatformEscrowAccount`
    - `CREDIT: SupplierPayableAccount` (Gross − Commission)
    - `CREDIT: PlatformRevenueAccount` (Commission)
- Telemetry pushed to Market Intelligence price index and supplier reliability scorecards.

---

## 3. Compliance Checklist for Future Verticals
Before launching a new service vertical (e.g., Kitesurfing, St. Catherine Sunrise Trek, Mountain Dinner), the vertical must pass all 10 pipeline tests with automated integration verification.
