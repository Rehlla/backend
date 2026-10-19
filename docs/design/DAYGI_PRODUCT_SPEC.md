# DAYGI (دايجي) PRODUCT SPECIFICATION
**Intelligent Travel Concierge for Dahab & South Sinai**  
**Version:** 1.0.0  
**Status:** Live & Production Ready

---

## 1. Product Identity & Value Proposition

**DayGI (دايجي)** is not a generic chat box. It is **The Intelligent Dahab Concierge** — grounded in real-time Sinai conditions, tide schedules, wind patterns, verified local dive shops, Bedouin desert hosts, and waterfront culinary masters.

### What DayGI Does:
1. **Immediate Contextual Rescue ("I Have Two Hours"):**
   - Proposes actionable micro-itineraries based on exact location (Lighthouse, Eel Garden, Blue Hole, Laguna) and available minutes (30m, 1h, 2h, 4h).
2. **Dynamic Plan Optimization:**
   - Detects over-packed days, high winds, or post-dive decompression needs and proposes safe plan adjustments.
   - Example: Shifting a morning Canyon dive to Day 4 to allow a relaxed coastal breakfast after an early arrival.
3. **Safe Commercial Handoff:**
   - DayGI formulates recommendations and pre-fills verified SKU bookings (e.g., `SKU-DIV-001` Guided Canyon Dive).
   - **Safety Firewall:** DayGI never autonomously charges cards, cancels bookings, or alters financial ledgers without explicit user authorization via the commerce modal.
4. **"Why This Choice?" Transparency:**
   - Every recommendation is accompanied by physical, spatial, and logistical rationale (e.g., "Walking 4 mins north avoids construction and matches low tide visibility").

---

## 2. Core Interaction Modes

### A. The Spontaneous Micro-Window
- **Input:** *"I have 2 hours near Lighthouse, what should I do?"*
- **Reasoning:**
  - Spatial lookup: Lighthouse Promenade
  - Weather/Tide: Green flag, 24°C water, gentle current
  - Outcome: Snorkel along the drop-off reef + freshly minted Bedouin lemon-mint drink at Everyday Café.

### B. Post-Dive / High-Effort Food Discovery
- **Input:** *"Where to eat fresh fish on the seafront after diving?"*
- **Reasoning:**
  - Target: Fresh catch of the day, sea-view shaded table, relaxed pace
  - Recommendations: Ali Baba Restaurant (grilled Red Sea sea bass), Eel Garden Restaurant (Bedouin spiced calamari), Ralph's German Bakery (artisan desserts).

### C. Trip Schedule Shift (Plan Change)
- **Input:** *"Make tomorrow easier and less tiring."*
- **Reasoning:**
  - Analyze Trip Days (e.g., Day 3 has 3 strenuous activities).
  - Propose: Shift `act-canyon-dive` from Day 3 to Day 4 at 10:00 AM.
  - User Action: Single click on *"Apply Change to My Trip"* updates `TripContext` instantly.

---

## 3. Telemetry & Continuous Feedback
- Every prompt and recommendation logs events to `/api/analytics/daygi`:
  - `prompt_submitted`
  - `recommendation_viewed`
  - `trip_change_accepted`
  - `booking_handoff`
  - `feedback_positive` / `feedback_negative`
