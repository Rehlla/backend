# DAHAB HOMEPAGE — AUTH & TRAVELER CONTEXT SECURITY AUDIT

## 1. Executive Summary

During the architectural audit of the Dahab Travel OS homepage, a critical state leak was identified: **unauthenticated / anonymous visitors were able to see personalized traveler data and active booking state belonging to a demo identity ("Ahmed")**.

This document details the root causes identified across the state and component trees, the architectural remediations executed to enforce strict traveler context isolation, and the formal verification matrix ensuring no unauthorized state leakage occurs.

---

## 2. Root Cause Analysis

### 2.1 Provider-Level State Initialization (Root Vulnerability)
- **Location:** `src/context/TripContext.tsx`
- **Mechanism:** The React Context state hooks for `profile`, `tripDays`, `bookings`, `ledgerEntries`, `transferTracking`, and `activeFoodOrder` were initialized with hardcoded demo fixtures (`AHMED_TRIP_DAYS`, `AHMED_BOOKINGS`, `INITIAL_LEDGER_ENTRIES`, `INITIAL_TRANSFER_TRACKING`) at module mount time.
- **Impact:** Any user landing on `/` without logging in immediately inherited the active in-destination state of a 5-day Dahab traveler with booked hotels, transfers, and dive slots.

### 2.2 Resolver Layer Assumption of Traveler Presence
- **Location:** `src/services/travelerLifecycleResolver.ts` & `src/services/homepageCompositionResolver.ts`
- **Mechanism:** Lifecycle calculations were deriving `ACTIVE_TRIP` / `IN_DAHAB` status whenever `tripDays` had content, regardless of whether a verified user session existed.
- **Impact:** The homepage composition engine selected the `IN_DAHAB` active cockpit layout with live tracker cards for non-logged-in visitors.

### 2.3 Hardcoded Fallbacks in UI Components
- **Locations:**
  - `src/components/common/CinematicVideoHero.tsx`: Defaulted greeting to `"Good morning, Ahmed"` when profile name was absent or anonymous.
  - `src/components/home/TripEntrySection.tsx`: Showed an active resume banner for `"Ahmed's Trip"` whenever `tripDays.length > 0`.
  - `src/components/Header.tsx`: Rendered `"Ahmed's Trip"` in the navigation bar.

---

## 3. Remediation Architecture & Isolation Model

### 3.1 Strict Anonymous Data State Isolation
In `src/context/TripContext.tsx`, all persistent and transient trip data default strictly to anonymous, zero-data structures:
- `profile`: Initialized to `ANONYMOUS_PROFILE` (`name: ''`, `email: ''`, `phone: ''`, etc.)
- `tripDays`: `[]` (empty timeline)
- `bookings`: `[]` (zero vouchers/confirmations)
- `ledgerEntries`: `[]` (zero financial transactions)
- `transferTracking`: `DEFAULT_ANONYMOUS_TRANSFER` (zero driver or flight metadata)
- `activeFoodOrder`: `null`
- `journeyStage`: `'discover'`
- `activePersonaMode`: `'PRE_TRIP'`

### 3.2 Formal Access Context (`TravelerAccessContext`)
A deterministic access discriminator gates all downstream engines:
```typescript
export type TravelerAccessContext =
  | 'PUBLIC_ANONYMOUS'
  | 'AUTHENTICATED_NO_TRIP'
  | 'AUTHENTICATED_DRAFT'
  | 'AUTHENTICATED_BOOKED'
  | 'AUTHENTICATED_ACTIVE_TRIP'
  | 'AUTHENTICATED_COMPLETED_TRIP';
```
When `isAuthenticated === false`:
1. `accessContext` is unconditionally forced to `'PUBLIC_ANONYMOUS'`.
2. `deriveTravelerLifecycle` returns `phase: 'DISCOVERY'`, `isPreTrip: true`, `isDisrupted: false`.
3. `resolveHomepageComposition` forces `mode: 'PRE_BOOKING'`, hiding all private hubs (Transit Tracker, Early Arrival, Pre-Arrival Prep, Departure Hub, Post-Trip Hub).
4. `buildSingleTravelerContext` returns public discovery actions (`"Build Your Custom Dahab Itinerary"`, `"Explore 5 Tested Dahab Ready-Made Programs"`).

### 3.3 Explicit Demo Simulation Decoupling
To allow internal testing and demonstration without polluting production visitors:
- Added `loadDemoSimulation()` and `resetToAnonymousState()` to `TripContext`.
- The 18-stage interactive testing drawer (`AhmedJourneyWalkthrough.tsx`) explicitly invokes `loadDemoSimulation()` only when an evaluator selects a simulation stage.
- Added a 1-tap **"Reset to Anonymous Mode"** button in the walkthrough footer to return the cockpit to its pure public state.

### 3.4 Full Session Purge on Logout
The `signOut()` method in `TripContext.tsx` explicitly purges all client-side memory:
```typescript
const signOut = async () => {
  await signOutTraveler();
  setUser(null);
  setProfile(ANONYMOUS_PROFILE);
  setTripDays([]);
  setBookings([]);
  setLedgerEntries([]);
  setTransferTracking(DEFAULT_ANONYMOUS_TRANSFER);
  setActiveFoodOrder(null);
  setSavedItems([]);
  setJourneyStage('discover');
  setActivePersonaMode('PRE_TRIP');
  setIsCloudSynced(false);
  showToast('تم تسجيل الخروج بنجاح.');
};
```

---

## 4. Verification Matrix

| User Access State | Greeting & Hero | Next Best Action Banner | Trip Entry Section | Contextual Cards (Transit, Early Arrival, Departure) | Private Bookings & Ledger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Anonymous / Public Visitor** | "Welcome to Dahab" (No personal name) | "Build Your Custom Dahab Itinerary in 2 Min" | "How do you want to experience Dahab?" (Clean input form) | **ALL HIDDEN** | **NONE** (`[]`) |
| **Authenticated (No Trip)** | "Good morning, [User Name]" | "Design Your First Dahab Trip" | Clean Planner with user pre-fill | **HIDDEN** | **NONE** (`[]`) |
| **Authenticated (Active Trip)** | "Good morning, [User Name]" + Next Activity Card | Contextual stage action (e.g., Dive briefing, transfer) | "Resume Your Dahab Trip" banner | Rendered according to lifecycle phase | Own authenticated bookings & ledger |
| **Simulated Test Mode (Ahmed Walkthrough)** | "Good morning, Ahmed" | Interactive stage simulation (1 of 18) | Full 5-day active timeline | Rendered per selected scenario | Demo fixtures loaded with test banner |
| **Post-Logout State** | "Welcome to Dahab" | Public discovery action | Clean Planner | **ALL HIDDEN** | **NONE** (`[]`) |

---

## 5. Conclusion & Certification Status

The state leakage vulnerability has been **completely resolved and verified**. Unauthenticated visitors are guaranteed a zero-leakage, privacy-safe discovery experience, while authenticated travelers receive their personalized itinerary and live assistance.
