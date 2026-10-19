# DAHAB CONTENT OPPORTUNITY & PRODUCT GAP MAP
**Truth Status**: AUDIT OF RESEARCH VS PRODUCT CAPABILITIES  
**Last Verified**: August 2026

## 1. Content & Feature Gap Analysis

| Research Domain | Ground Truth Finding | Current Product Status | Gap Identified | Productization Opportunity | Priority |
|---|---|---|---|---|---|
| **Spontaneous 2-Hour Window** | In-destination travelers have 1–3 hour gaps between dives, meals, and sunset. | `EXISTS_PARTIAL` (Static cards in WhatShouldIDoNowView) | Lacks instant 1-tap booking integration with real slot lock. | Connect "What should I do now" cards directly to `BookNowCommerceModal` with 15-min hold. | **P0** |
| **Source Provenance & Trust** | Travelers need proof that recommendations are verified local businesses, not AI spam. | `EXISTS_PARTIAL` (Some badges in geography data) | Trust badges and audit metadata not consistently exposed in UI cards. | Add Source-Aware Provenance badge `[CDWS Audited / Aug 2026]` across all place & activity cards. | **P0** |
| **Hyper-Local Food Near Me** | Diver post-dive hunger requires immediate walking-distance guidance with exact dietary & payment info. | `EXISTS_PARTIAL` (FoodNowView has mock filters) | Missing live status indicator ("Open Now until 23:00") and exact cash/card advice. | Wire FoodNowView directly to `DAHAB_PLACES[x].nearbyFoodIds` and verified payment modalities. | **P0** |
| **Early Arrival Buffer Journey** | Overnight Cairo buses arrive 06:00 AM; check-in is 14:00 PM. Travelers are stranded with luggage. | `EXISTS_PARTIAL` (EarlyArrivalView exists) | Missing 1-tap early luggage drop hold + Ralph's Bakery diver breakfast voucher link. | Enhance Early Arrival view with verified 3-step morning flow and instant booking hold. | **P0** |
| **High-Wind Marine Reroute** | Wind > 22 knots at Blue Hole causes wave crashes; Lighthouse remains sheltered. | `EXISTS_REAL` in RecoveryService, `EXISTS_PARTIAL` in DayGI | DayGI prompt answering must automatically suggest safe alternative when wind is high. | Deepen DayGI reasoning to check real-time marine buoy sensors and proactively suggest sheltered spots. | **P0** |
| **No-Fly Rule Safety Lock** | Scuba divers must not fly or climb mountains within 18–24h post-dive. | `EXISTS_REAL` in validation rules | UI needs visual warning banner when flight or St. Catherine trek is booked too close to dive. | Add visual No-Fly Safety countdown in MyTripView and Daily Companion. | **P0** |
