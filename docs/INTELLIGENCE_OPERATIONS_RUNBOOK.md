# Dahab Market Intelligence — Operations & Vetting Runbook

## 1. Scope & Target Audience
This runbook provides Standard Operating Procedures (SOPs) for Dahab Operations Administrators, Sinai Field Coordinators, and Supplier OS Onboarding Managers interacting with the Market Intelligence Layer.

---

## 2. Supplier Candidate Discovery & Vetting SOP (SOP-INT-01)

### Objective
Safely discover, verify, and promote high-quality local Bedouin and Sinai operators into the official Dahab Supplier OS without admitting unlicensed or unverified entities.

### Vetting Lifecycle Steps
1. **Intake (`Discovered` Stage)**:
   - System automatically extracts candidate business name, phone, area, and license clues from official feeds (CDWS) or public listings.
   - Initial confidence score calculated.
2. **Operations Review (`Reviewed` Stage)**:
   - Ops coordinator reviews contact details and checks if the candidate is already registered under an alias in Supplier OS.
3. **Formal Verification (`Candidate` ➔ `Contacted` ➔ `Verified`)**:
   - Coordinator requests CDWS license document, Chamber of Tourism permit, or Bedouin tribal leadership authorization.
   - For diving: Verify active compressor inspection and PADI/SSI instructor credentials.
   - For safari/transfers: Verify 4x4 permit, South Sinai police clearance, and passenger insurance.
4. **Promotion to Supplier OS (`Approved` ➔ `Onboarded`)**:
   - Ops Administrator clicks **"Vetting Complete · Promote to OS"** in the Intelligence Workspace.
   - System creates a linked supplier entity in `Supplier OS`, sends onboarding credentials via SMS/WhatsApp, and assigns a initial tier badge (`Tier 1 Standard` or `Tier 2 Certified`).

---

## 3. Market Price Intelligence & FX Drift Triage (SOP-INT-02)

### Objective
Distinguish between organic local price inflation and currency exchange rate drift (USD/EGP volatility) to provide fair pricing recommendations for partner suppliers.

### Procedure
1. Review the **Price Intelligence** tab in the Intelligence Console.
2. Inspect the **FX Drift Flag** and **Movement Type**:
   - If `movement_type == 'FX Fluctuation'`: The price increase in EGP is driven by currency exchange movements, not local price gouging. Maintain Dahab platform fixed partner rate or recommend measured inflation adjustments.
   - If `movement_type == 'Organic Price Adjustment'`: The local market rate has genuinely shifted due to fuel or seasonal demand. Dispatch Ops review to negotiate partner volume discounts.
3. **Threshold for Dynamic Alert**: Any vertical showing >15% divergence from Dahab partner rates triggers a `Notice` in the Change Radar.

---

## 4. Review Sentiment & Safety Alarm Escalation (SOP-INT-03)

### Objective
Quickly identify recurring equipment or safety defects reported in public external reviews before they affect Dahab platform travelers.

### Procedure
1. The sentiment classifier flags reviews categorized as `Urgent Complaint` or rating ≤ 2.0 with keywords related to `#LifeJackets`, `#Speedboat`, `#TrekGuide`, or `#ExpiredGear`.
2. Ops Administrator inspects the review excerpt and actionable insight.
3. If the review involves an active Dahab partner supplier:
   - Trigger an immediate unannounced safety inspection.
   - Temporarily pause platform booking allocation if safety equipment (e.g., boat life vests or diving O2 kits) is reported missing.
4. Log resolution in the audit notes and close the signal.
