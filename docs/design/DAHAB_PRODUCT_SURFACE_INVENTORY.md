# DAHAB PLATFORM — COMPLETE PRODUCT SURFACE INVENTORY
**Source of Truth: Pages, Routes, Sections, Components, States, Actions, and Dependencies**
*Generated via direct source code inspection of the Dahab Travel Operating System.*

---

## 1. Executive Summary & Architecture Overview

The **Dahab Platform** (Dahab Travel OS) is a full-stack, single-page application built on React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, and an Express backend (`server.ts`).

### Core Architectural Pillars
1. **Centralized Trip State Engine (`src/context/TripContext.tsx`)**:
   - Manages global state including active route (`currentRoute`), journey stage (`journeyStage`), traveler profile (`profile`), draft and confirmed itineraries (`tripDays`, `tripBrief`), active bookings (`bookings`), financial ledger (`ledgerEntries`), food orders (`activeFoodOrder`), DayGI prompts, and authoritative suppliers.
2. **Unified Client Routing (`src/App.tsx`)**:
   - Client-side programmatic routing using state-driven view rendering (`currentRoute`) supporting 21 registered routes.
   - Synchronized with browser history via custom `navigateTo` dispatchers.
3. **Dual Global Shell**:
   - **Desktop/Tablet Floating Header (`src/components/navigation/V2Navbar.tsx`)**: Glassmorphic floating navigation pill with live weather/sea telemetry, search trigger (`⌘K`), Sunlight High-Contrast Easy UI mode switch, bilingual toggle (EN/AR), SOS Emergency trigger, Quick Book trigger, and user profile badge.
   - **Mobile Dock (`src/components/navigation/V2Navbar.tsx`)**: Fixed bottom dock navigation with quick-access tabs (`Discover`, `My Trip`, `AI Director`, `Live`).
   - **Journey Lifecycle Switcher (`src/components/navigation/JourneyStageSwitcher.tsx`)**: Universal lifecycle simulator offering 12 distinct journey stage transitions from discovery to post-trip reflection.
   - **Ahmed's 18-Stage Walkthrough Bar (`src/components/common/AhmedJourneyWalkthrough.tsx`)**: Bottom sticky accordion providing interactive validation across the 18 Golden Stages of Dahab.
4. **DayGI Intelligence & Concierge Layer (`src/components/daygi/DayGiConciergeView.tsx`, `src/services/api.ts`)**:
   - Autonomous multi-modal concierge operating in Discover, Plan, and Act modes with structured multi-step execution tasks, health diagnostics, structured memory, and rollback capabilities.
5. **In-Destination Commerce & Instant Holds (`src/components/commerce/BookNowCommerceModal.tsx`)**:
   - Instant gear delivery, guided dives, kiteboarding, and local transit booking with real-time hold countdowns, payment method selection (Paymob card, cash on delivery, mobile wallet), and instant digital voucher generation.
6. **Multi-Persona Operational Ecosystem**:
   - **Traveler Interface**: Discovery, planning, live companion, food delivery, change recovery, and 24/7 SOS support.
   - **Supplier OS (`src/components/supplier/SupplierPortalView.tsx`)**: Real-time request inbox with SLA countdowns, inventory capacity controls, resource management, and reliability scorecards.
   - **Operations Command Center (`src/components/operations/OperationsConsoleView.tsx`)**: Live trip radar, DayGI quality dashboards, exception queues, financial ledgers, transfer tracking, and automated golden journey test suites.
   - **Market Intelligence Subsystem (`src/components/intelligence/MarketIntelligenceView.tsx`)**: 16 autonomous intelligence pipelines including crawlers, entity resolution, competitor rate benchmarking, and regulatory governance.

---

## 2. Complete Route Inventory

| Route | Component | Page Title | Access Level | Layout / Shell | Sub-views / Modes | Transition Animation |
|---|---|---|---|---|---|---|
| `/home` | `V2HomeCockpit` | Discover & Plan | Public / Traveler | Global Floating Nav + Hero + Footer | First-time vs Returning Traveler | Fade-in / Slide-up |
| `/my-trip` | `MyTripView` | My Trip Hub | Traveler | Traveler Nav + Day Tabs | 8 Sub-views (Briefing, Arrival, Companion, etc.) | Tab switch cross-fade |
| `/trip-builder` | `TripPlanner` | Trip Builder | Public / Traveler | Focused Wizard Shell | 4-step wizard (Intent, Details, Budget, Review) | Step slide left/right |
| `/trip-preview` | `TripPreview` | Trip Preview & Customization | Public / Traveler | Full-width Preview Shell | Day timeline preview + item drawers | Modal fade / Drawer slide |
| `/explore` | `ExploreView` | Explore Spots & Near Me | Public / Traveler | Category filter pills + Map grid | All, Beach, Dive, Food, Nightlife, Relax | Grid layout animate |
| `/food` | `FoodNowView` | Food Now & Delivery | Traveler | Traveler Nav + Food Category tabs | Dine-in vs Delivery, Cart & Checkout | Tab filter switch |
| `/bookings` | `BookingsView` | My Bookings & Vouchers | Traveler | Header summary + filter bar | All, Hotel, Transfer, Diving, Safari | Modal slide-up |
| `/help` | `HelpMeNowView` | 24/7 Help Me Now | Traveler | Step-by-step triage wizard | 10 triage steps + live expert chat | Step transition |
| `/change-recovery` | `ChangeAndRecoveryView` | Change & Recovery Engine | Traveler | Traveler Nav + Scenario selector | 3 Alternative recovery scenarios (A/B/C) | Scenario comparison |
| `/departure` | `DepartureView` | Departure Day Hub | Traveler | Checklist + Transfer countdown | Checklist status, Airport transfer tracker | Card slide |
| `/post-trip` | `PostTripView` | Post-Trip Memories & Review | Traveler | Review form + Memory gallery | Star rating, photo memories, invoice download | Fade-in |
| `/profile` | `ProfileView` | Traveler Profile & Settings | Traveler (Auth) | Tabbed Profile Shell | Profile, Saved Items, Trip History, Settings | Tab fade |
| `/live` | `DahabLiveView` | Dahab Live & Marine Radar | Public | Camera feed player + Spot selector | 5 live cameras (Lighthouse, Blue Hole, etc.) | Stream switch |
| `/ai-director` | `AiDirectorView` | AI Trip Director | Traveler | Prompt input + Flow cards | 4 Curated flows + Custom prompt generator | Card expansion |
| `/daygi` | `DayGiConciergeView` | DayGI Autonomous Concierge | Traveler | Chat interface + Health & Memory modals | Discover, Plan, Act + Task Orchestrator | Chat message stream |
| `/auth/sign-in` | `AuthView` | Sign In | Public | Centered Auth Modal Shell | Email/Password, Google OAuth, Role selector | Mode toggle slide |
| `/auth/sign-up` | `AuthView` | Create Account | Public | Centered Auth Modal Shell | Full registration form with role choice | Mode toggle slide |
| `/auth/forgot-password` | `AuthView` | Reset Password | Public | Centered Auth Modal Shell | Password reset trigger | Mode toggle slide |
| `/ops-console` | `OperationsConsoleView` | Operations Command Console | Staff / Ops | Ops Header + 11 Subsystem Tabs | Quality, Radar, Opportunities, Ledger, Flags, etc. | Tab switch |
| `/supplier-portal` | `SupplierPortalView` | Supplier OS Portal | Supplier / Partner | Supplier Header + 5 Portal Tabs | Inbox, Inventory, Resources, Scorecard, Audit | Tab switch |
| `/market-intelligence`| `MarketIntelligenceView` | Market Intelligence System | Ops / Admin | 16-Subsystem Tabbed Explorer | Crawlers, Entity Resolution, Price Index, Radar | Tab switch |

---

## 3. Detailed Page Inventory

### 3.1. Homepage (`/home` -> `V2HomeCockpit.tsx`)
- **Primary Purpose**: The core entry point of the Dahab Travel OS. Dynamically adapts between a high-energy discovery dashboard for first-time visitors and an active cockpit for in-destination travelers.
- **Primary States**:
  - `FIRST_TIME_EXPLORER`: Shows trip intent creator, curated Dahab tracks, micro-stories, and seasonal radar.
  - `RETURNING_ACTIVE_TRIP`: Shows active trip countdown banner, Day 2 live status widget, upcoming booking reminders, and DayGI fast-prompts.
- **Context Dependencies**: `useTrip()` (`currentRoute`, `journeyStage`, `profile`, `tripDays`, `bookings`, `navigateTo`, `isEasyMode`), `useLanguage()` (`t`, `language`, `isRTL`).
- **Internal Sections**:
  1. `EnvironmentalBanner`: Marine conditions, water temperature (24°C), wind velocity (14 kts), air temperature (28°C).
  2. `TripCockpitHeader`: Dynamic greeting, persona badge, trip progress indicator.
  3. `TripEntrySection`: Multi-tab intent engine ("Plan New Trip", "I'm in Dahab Now", "Instant Services").
  4. `CuratedDahabTracks`: 4 archetypal journeys (Freediver, Desert Nomad, Digital Remote, Wellness Seeker).
  5. `MicroStoriesFeed`: Visual storytelling cards highlighting hidden local gems (Assalah souk, Canyon drift, St. Catherine).
  6. `SeasonalMarineRadar`: Optimal activity windows based on wind and tides.
  7. `DayGiQuickEntryPill`: Sticky bottom floating shortcut to launch DayGI Concierge.

### 3.2. My Trip Hub (`/my-trip` -> `MyTripView.tsx`)
- **Primary Purpose**: The operational heart of the traveler's active journey in Dahab. Consolidates itinerary timeline, connected bookings, real-time weather alerts, and dedicated sub-views.
- **Sub-View Routing Switch**:
  - `overview`: Full 5-day timeline with activity cards, cost summaries, and supplier links.
  - `pre-arrival`: 24h pre-arrival countdown, packing guide, SIM card advice, airport transfer details.
  - `early-arrival`: Luggage drop-off hubs, 2-hour waiting lounge, beach café relaxation guide.
  - `first-two-hours`: Step-by-step orientation checklist for initial settlement in Dahab.
  - `companion`: Day 2 live companion showing current activity, next step countdown, and quick recovery triggers.
  - `spontaneous`: "What Should I Do Now?" recommendation matrix for unscheduled free time.
  - `change-recovery`: Instant recovery recommendations for weather shifts or cancellations.
  - `food-now`: Contextual culinary discovery and delivery ordering.
  - `help-now`: 24/7 instant triage and emergency dispatch.

### 3.3. Trip Planner Wizard (`/trip-builder` -> `TripPlanner.tsx`)
- **Primary Purpose**: 4-step interactive trip creation wizard converting natural language intents and preferences into an optimized 5-day Dahab itinerary.
- **Wizard Steps**:
  1. `Intent & Vibe`: Select travel style (Chill & Wellness, Diving & Adventure, Culture & Desert, Nightlife & Social).
  2. `Group & Dates`: Party size, trip length (3, 5, 7 days), arrival date picker.
  3. `Budget & Pace`: Budget level (Budget, Moderate, Luxury), daily pace (Relaxed, Balanced, Packed).
  4. `Review & Generate`: AI itinerary assembly with cost breakdown and instant confirmation.

### 3.4. DayGI Concierge (`/daygi` -> `DayGiConciergeView.tsx`)
- **Primary Purpose**: Autonomous AI Trip Director orchestrating travel recommendations, complex itinerary modifications, and in-destination actions.
- **Key Modules & Surfaces**:
  - `Chat Stream`: Multi-turn conversational interface supporting Arabic (Egyptian dialect) and English.
  - `DayGiMultiOptionResult`: Side-by-side alternative card selector.
  - `DayGiTaskPlan`: Multi-step transactional orchestrator with rollback actions.
  - `DayGiTripHealth`: Real-time health diagnostic modal evaluating itinerary buffer, fatigue, budget burn, and weather alignment.
  - `DayGiStructuredMemory`: Traveler memory inspection modal displaying discovered preferences, dietary restrictions, and diving certifications.
  - `DayGiWhatChangedCard`: Visual delta card summarizing shifts between original and updated plans.

### 3.5. Bookings & Vouchers (`/bookings` -> `BookingsView.tsx`)
- **Primary Purpose**: Single-reference repository for all confirmed accommodations, transfers, dive packages, and excursions.
- **Features**:
  - Filter by service category (`All`, `Hotel`, `Transfer`, `Diving`, `Safari`).
  - Total confirmed spend accumulator in EGP.
  - Full Trip Consolidated Invoice Modal (`isInvoiceModalOpen`).
  - Digital Voucher Modal with QR Code, meeting point instructions, supplier phone contact, and offline storage prompt.

### 3.6. Operations Console (`/ops-console` -> `OperationsConsoleView.tsx`)
- **Primary Purpose**: Command and control dashboard for Dahab local operations managers and dispatcher staff.
- **11 Subsystem Tabs**:
  1. `daygi_quality`: Autonomous agent response quality scorecards, hallucination checks, and latency metrics.
  2. `radar`: Live active trip monitoring across all travelers in Dahab with health badges.
  3. `opportunities`: Algorithmic demand-supply gap opportunities and product recommendations.
  4. `ai_assistant`: Grounded internal copilot answering operations queries using platform telemetry.
  5. `ledger`: Financial transaction ledger tracking GMV, supplier payouts, commissions, and refunds.
  6. `transfers`: Real-time SSH airport and Taba border shuttle tracking with driver statuses.
  7. `golden_test`: Automated Golden Journey Acceptance Suite execution button and live validation report.
  8. `exceptions`: Triage queue for traveler delays, weather shifts, and supplier reallocations.
  9. `dispatch`: Direct driver and divemaster dispatch manager.
  10. `flags`: Real-time feature flag toggle switches (Paymob gateway, AI proposals, WhatsApp bridge).
  11. `audit`: Immutable event audit log of all system actions.

### 3.7. Supplier OS Portal (`/supplier-portal` -> `SupplierPortalView.tsx`)
- **Primary Purpose**: Dedicated interface for Dahab local dive shops, safari guides, drivers, and boutique hotels.
- **5 Subsystem Tabs**:
  1. `inbox`: Incoming booking requests with countdown SLA timers and instant Accept/Reject action buttons.
  2. `inventory`: Capacity allocations, blackout dates, and slot management.
  3. `resources`: Equipment, vehicles, dive boats, and guide assignment.
  4. `reliability`: Supplier performance score, fulfillment rate, on-time percentage, and traveler reviews.
  5. `audit`: Historical record of accepted bookings and settlement payouts.

### 3.8. Market Intelligence System (`/market-intelligence` -> `MarketIntelligenceView.tsx`)
- **Primary Purpose**: Comprehensive data governance, web intelligence, and rate parity monitoring across the Sinai region.
- **16 Subsystem Modules**:
  - Sources Registry, Crawl Job Dispatcher, Raw Observations Stream, Normalized Entity Resolution, Discovered Supplier Candidates, Competitor Pricing Index, Review Sentiment Signals, Content Trend Detection, Regulatory Road Condition Radar, and Governance Audits.

---

## 4. Page Section & Chapter Inventory

### Homepage (`V2HomeCockpit`)
| Render Order | Section Name | Component / Sub-component | Visibility Conditions | Data Dependencies |
|---|---|---|---|---|
| 1 | Marine Telemetry Top Bar | Embedded in `V2Navbar` | Always visible | `INITIAL_LIVE_DAHAB_CONDITIONS` |
| 2 | Hero Cockpit Header | `TripCockpitHeader` | Always visible | `profile`, `journeyStage`, `tripBrief` |
| 3 | Active Trip Alert (if booked) | Banner in `V2HomeCockpit` | `bookings.length > 0` | `bookings`, `tripDays` |
| 4 | Trip Intent Creator | `TripEntrySection` | Always visible | `activePersonaMode`, `TripPlanner` state |
| 5 | Curated Dahab Tracks | `CuratedTracksGrid` | Always visible | `CURATED_TRACKS_DATA` |
| 6 | Local Micro-Stories Feed | `MicroStoriesSection` | Always visible | `DAHAB_STORIES_DATA` |
| 7 | Seasonal Marine Radar | `SeasonalRadarSection` | Always visible | `SEASONAL_CONDITIONS_DATA` |
| 8 | Floating DayGI Fast-Action Pill | Floating button | Always visible | `setActiveDayGiPrompt`, `navigateTo` |

### My Trip Hub (`MyTripView`)
| Render Order | Section Name | Component / Sub-component | Visibility Conditions | Data Dependencies |
|---|---|---|---|---|
| 1 | Traveler Navigation Bar | `TravelerNav` | Always visible | `currentRoute`, `activeSubView` |
| 2 | Day Switcher Pills | `DayTabsBar` | Always visible | `tripDays`, `activeDayIndex` |
| 3 | Pre-Arrival Briefing Card | `PreArrivalBriefing` | `activeSubView === 'pre-arrival'` | `profile`, `tripBrief`, `bookings` |
| 4 | Early Arrival Lounge | `EarlyArrivalView` | `activeSubView === 'early-arrival'` | `profile`, `HOTEL_STORAGE_HUBS` |
| 5 | First Two Hours Orientation | `FirstTwoHoursView` | `activeSubView === 'first-two-hours'`| `profile`, `ORIENTATION_CHECKLIST` |
| 6 | Day 2 Live Companion | `DailyCompanionDay2View` | `activeSubView === 'companion'` | `tripDays[1]`, `activeWeatherAlert` |
| 7 | Spontaneous Recommendation | `WhatShouldIDoNowView` | `activeSubView === 'spontaneous'` | `profile`, `SPONTANEOUS_OPTIONS` |
| 8 | Timeline Activity Cards | `ActivityTimelineList` | `activeSubView === 'overview'` | `tripDays[activeDayIndex].activities` |
| 9 | Linked Booking Mini-Cards | `LinkedBookingCard` | Item has `bookingRef` | `bookings` |
| 10 | Day Summary & Budget Rollup | `DayCostSummary` | `activeSubView === 'overview'` | `tripDays[activeDayIndex]` |

---

## 5. Global Conditional Visibility Matrix

| Component / Section | No Trip (First Visit) | Draft Trip | Pre-Arrival (24h) | Early Arrival (Day 1) | In-Destination (Day 2) | Departure Day | Post-Trip | Logged Out | Supplier Role | Ops Admin Role |
|---|---|---|---|---|---|---|---|---|---|---|
| `V2Navbar` Live Weather | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible |
| `V2Navbar` Profile Badge | Hidden (Sign In) | Hidden (Sign In)| Visible | Visible | Visible | Visible | Visible | Hidden | Visible (Supplier)| Visible (Ops) |
| `V2Navbar` SOS Button | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Hidden | Hidden |
| `V2Navbar` Quick Book CTA | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Hidden | Hidden |
| `TripEntrySection` | Expanded | Collapsed | Collapsed | Collapsed | Collapsed | Collapsed | Collapsed | Expanded | Hidden | Hidden |
| `TripCockpitHeader` (Active) | Hidden | Visible | Visible | Visible | Visible | Visible | Visible | Hidden | Hidden | Hidden |
| `MyTripView` Timeline | Empty state | Visible | Visible | Visible | Visible | Visible | Visible | Read-only | Hidden | Hidden |
| `DailyCompanionDay2View` | Hidden | Hidden | Hidden | Hidden | Active | Hidden | Hidden | Read-only | Hidden | Hidden |
| `DepartureView` Checklist | Hidden | Hidden | Hidden | Hidden | Hidden | Active | Hidden | Read-only | Hidden | Hidden |
| `PostTripView` Gallery | Hidden | Hidden | Hidden | Hidden | Hidden | Hidden | Active | Read-only | Hidden | Hidden |
| `BookNowCommerceModal` | Triggerable | Triggerable | Triggerable | Triggerable | Triggerable | Triggerable | Triggerable | Triggerable | Hidden | Hidden |
| `OperationsConsoleView` | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Restricted | Restricted | Full Access |
| `SupplierPortalView` | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Restricted | Full Access | Restricted |
| `MarketIntelligenceView` | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Hidden in Nav | Restricted | Restricted | Full Access |

---

## 6. State Machine & Lifecycle Inventory

### 6.1. Journey Stage State Machine (`journeyStage`)
Defined in `src/types.ts` and managed via `TripContext`:
1. `discover`: Initial homepage exploration and track browsing.
2. `plan`: Interactive trip builder preference specification.
3. `preview`: Itinerary review and day customization.
4. `prepare`: 24-hour pre-arrival countdown and packing briefing.
5. `arrive`: Day 1 early arrival, luggage drop-off, and first two hours.
6. `experience`: Day 2 in-destination live companion mode.
7. `spontaneous`: Unscheduled open-slot discovery engine.
8. `food`: Contextual culinary discovery and meal ordering.
9. `recovery`: Automated change and recovery execution for delays/weather shifts.
10. `help`: 24/7 instant triage and emergency response.
11. `departure`: Departure checklist and airport shuttle tracking.
12. `post_trip`: Trip completion review, memories archive, and invoice download.

### 6.2. DayGI Orchestrator State Machine (`DayGiTaskState`)
1. `PROPOSED`: AI agent proposes multi-step plan (e.g. Cancel Boat Dive -> Refund -> Rebook Quad Safari).
2. `CONFIRMATION_REQUIRED`: User reviews cost delta and safety warnings.
3. `EXECUTING`: Sequential async execution of atomic steps.
4. `COMPLETED`: All steps executed successfully, calendar and ledger updated.
5. `FAILED`: Execution failed on a step, triggering automated recovery or rollback.
6. `ROLLED_BACK`: Original itinerary state restored.

### 6.3. Commerce & Instant Booking State Machine
1. `CATALOG_BROWSE`: Browse instant watersports, diving, desert, and transfer options.
2. `INVENTORY_HOLD`: 10-minute lock on supplier slot with live countdown timer.
3. `CHECKOUT`: Selection of payment method (`Paymob Card`, `Cash on Delivery`, `Vodafone Cash / InstaPay`).
4. `CONFIRMATION`: Instant generation of booking reference (`DHB-xxxx`) and digital voucher with QR code.
5. `SUPPLIER_DISPATCH`: Notification routed to Supplier OS inbox with SLA timer.

---

## 7. Modal, Drawer & Bottom Sheet Inventory

| Modal / Drawer / Sheet | Triggering Component | Trigger Action | State Variable | Dismiss Mechanism | Key Actions / CTAs |
|---|---|---|---|---|---|
| `SearchDrawer` | `V2Navbar` / Keyboard | Click search icon / `⌘K` / `Ctrl+K` | `isSearchOpen` | Click backdrop / `Esc` / Close button | Live search spots, routes, quick navigation |
| `BookNowCommerceModal` | `V2Navbar` / `MyTripView` | Click "Quick Book" or "Instant Hold" | `isQuickBookOpen` | Click backdrop / `Esc` / Close button | Category filter, slot hold, Paymob checkout |
| `EmergencyModal` | `V2Navbar` / `MyTripView` | Click SOS Button | `isEmergencyOpen` | Click backdrop / `Esc` / Close button | Call Dahab Hospital, Hyperbaric Chamber, Police |
| `VoucherModal` | `BookingsView` | Click "View Digital Voucher" | `selectedBookingId !== null` | Click backdrop / `Esc` / Close button | Download PDF, QR code scan, Call supplier |
| `InvoiceModal` | `BookingsView` | Click "Full Trip Invoice" | `isInvoiceModalOpen` | Click backdrop / `Esc` / Close button | Download consolidated EGP receipt |
| `DayGiHealthModal` | `DayGiConciergeView` | Click "Trip Health" badge | `healthModalOpen` | Click backdrop / `Esc` / Close button | View fatigue, buffer, and weather scores |
| `DayGiMemoryModal` | `DayGiConciergeView` | Click "Brain Memory" badge | `memoryModalOpen` | Click backdrop / `Esc` / Close button | Inspect / delete stored traveler preferences |
| `DayGiTasksModal` | `DayGiConciergeView` | Click "Active Tasks" pill | `tasksModalOpen` | Click backdrop / `Esc` / Close button | Step-by-step task tracking and rollback |
| `MobileNavDrawer` | `V2Navbar` | Hamburger menu click (Mobile) | `isMobileMenuOpen` | Click backdrop / Link click / Close button | Navigate to routes, toggle language, SOS |

---

## 8. Data & API Dependency Map

Every API method in `src/services/api.ts` mapped to UI triggers:

| API Method | Consuming Components | Triggering User Action | UI Outcome |
|---|---|---|---|
| `api.askDayGi(payload)` | `DayGiConciergeView` | Send message in DayGI chat | Returns assistant message, multi-option cards, or task plan |
| `api.executeDayGiAction(action)` | `DayGiConciergeView` | Click "Execute Action" on card | Mutates trip days, shifts activities, updates bookings |
| `api.rollbackDayGiTask(taskId)` | `DayGiConciergeView` | Click "Rollback Plan" button | Restores previous itinerary state |
| `api.getTripHealth(tripId)` | `DayGiConciergeView` | Mount / Click health badge | Renders health meter and fatigue diagnostics |
| `api.createInstantBooking(payload)`| `BookNowCommerceModal` | Click "Confirm & Pay EGP" | Creates booking, decrements inventory, returns voucher |
| `api.respondSupplierBooking(id, res)`| `SupplierPortalView` | Click "Accept" or "Reject" | Updates supplier status, triggers reallocations |
| `api.runGoldenJourneySuite()` | `OperationsConsoleView`| Click "Run Acceptance Suite" | Executes 18-stage end-to-end simulation report |
| `api.getLiveCameraFeeds()` | `DahabLiveView` | View mount / refresh click | Renders 5 live RTSP/HLS camera snapshots & stats |
| `api.fetchProductOpportunities()` | `OperationsConsoleView`, `MarketIntelligenceView` | Tab switch to opportunities | Lists calculated supply-demand gaps |
| `api.queryGroundedAi(query)` | `GroundedAiAssistantView` | Submit query in Ops copilot | Returns grounded answer with citations |

---

## 9. Interactive Action & CTA Inventory

| Action / CTA Name | Origin Component | Visual Appearance | Trigger Mechanism | State Mutation | Traveler / User Feedback |
|---|---|---|---|---|---|
| `Quick Book CTA` | `V2Navbar` | Gold gradient pill | `onClick` | Opens `BookNowCommerceModal` | Modal slide-up with instant hold slots |
| `Sunlight Mode Toggle`| `V2Navbar` | Sun icon button | `onClick` | Inverts contrast (`isEasyMode`) | Instant high-contrast text and border styling |
| `Language Switcher` | `V2Navbar` | Text pill ("العربية" / "EN") | `onClick` | Changes `language` ('ar'/'en') | Instant document direction switch (`dir="rtl"`) |
| `Shift Activity Day` | `MyTripView` / `DayGi` | Arrow button on card | `onClick` | Calls `shiftActivityBetweenDays` | Toast notification: "Moved activity to Day X" |
| `Hold Slot (10 min)` | `BookNowCommerceModal` | Orange outline button | `onClick` | Starts 600s timer, locks slot | Live ticking countdown badge displayed |
| `Accept Booking` | `SupplierPortalView` | Green check button | `onClick` | Updates request to 'CONFIRMED' | Toast: "Booking accepted & traveler notified ✓" |
| `Reject & Reallocate`| `SupplierPortalView` | Red cross button | `onClick` | Updates request to 'REJECTED' | Toast: "Booking rejected · Change Engine triggered" |
| `Execute Golden Test`| `OperationsConsoleView`| Emerald play button | `onClick` | Runs full suite simulation | Detailed progress bar and pass/fail summary |
| `Call SOS Hospital` | `EmergencyModal` | Red emergency button | `onClick` / `tel:` | Initiates telephone dialer | Launches phone app to `+20 69 364 0404` |
| `Download Full Invoice`| `BookingsView` | Dark teal icon button | `onClick` | Opens `isInvoiceModalOpen` | Renders printable itemized tax receipt |

---

## 10. Responsive, RTL & Accessibility Inventory

### 10.1. Responsive Layout Strategy
- **Desktop (>= 1024px)**:
  - Top floating glassmorphic navigation bar with expanded telemetry and quick actions.
  - Multi-column grid layouts for timeline, explore cards, and operational dashboards.
  - Persistent sidebars for operations and intelligence views.
- **Tablet (768px - 1023px)**:
  - Condensed floating header with collapsed telemetry.
  - 2-column responsive bento grids.
- **Mobile (< 768px)**:
  - Floating top header with compact SOS and hamburger menu.
  - Fixed bottom dock (`V2Navbar`) featuring 4 core tabs with high-contrast active icons.
  - Full-screen modal sheets with swipe-down dismiss gestures.
  - 44px+ minimum touch targets across all buttons and tabs.

### 10.2. RTL & Egyptian Arabic Voice
- Complete dual-language support with automatic document-level and container-level `dir="rtl"` application.
- Authentic Egyptian Arabic travel terminology (e.g., "روقان دهب", "شلتات ع البحر", "شاي بالحبق", "اللايتهاوس", "كانيون دهب").
- Symmetrical layout flipping for icons (`ChevronRight`, `ArrowRight`), navigation tabs, and badge placements.

### 10.3. Accessibility (WCAG AA Compliance)
- Top-level keyboard skip link (`#main-app-content`).
- High-contrast Sunlight / Easy Mode switch (`isEasyMode`).
- Full keyboard navigation across all tabs with `ArrowLeft` / `ArrowRight` handlers.
- Explicit `role="tab"`, `role="tablist"`, `aria-selected`, `aria-current`, and `aria-expanded` attributes on all dynamic controls.

---

## 11. Legacy, Duplicated & Dead Code Audit

| Component File | Status | Relationship / Analysis | Recommended Future Action |
|---|---|---|---|
| `src/components/navigation/ModernNavbar.tsx` | Legacy / Alternate | Superseded by `V2Navbar.tsx` which is the active top navigation bar in `App.tsx`. Contains rich stage switcher dropdowns that can be archived. | Deprecate in favor of `V2Navbar` |
| `src/components/navigation/MobileNavigation.tsx` | Legacy Drawer | Superseded by the integrated mobile dock and menu inside `V2Navbar.tsx`. | Deprecate in favor of `V2Navbar` |
| `src/components/navigation/AppSidebar.tsx` | Standalone Layout | Built for a persistent sidebar layout mode, currently bypassed by the floating header layout in `App.tsx`. | Retain for desktop ops layout if required |
| `src/components/director/AiDirectorView.tsx` | Standalone Prototype | Provides static curated flows; largely superseded by the autonomous multi-turn `DayGiConciergeView.tsx`. | Retain as curated tracks browser |
| `src/components/common/QuickBookingModal.tsx` | Lightweight Commerce | Smaller variant of `BookNowCommerceModal.tsx`. `App.tsx` routes both triggers to `BookNowCommerceModal`. | Consolidate into `BookNowCommerceModal` |

---

## 12. Complete Page x State Permutation Matrix

| Page Route | In Discovery Stage | In Plan Stage | In Pre-Arrival Stage | In Early Arrival Stage | In Companion Stage | In Departure Stage | In Post-Trip Stage |
|---|---|---|---|---|---|---|---|
| `/home` | Interactive Intent Creator | Itinerary Draft Widget | 24h Countdown Widget | Arrival Status Banner | Day 2 Live Cockpit | Departure Shuttle Alert | Memory Book CTA |
| `/my-trip` | Empty State & CTA | Draft Itinerary Preview | Pre-Arrival Briefing Card | Luggage Hub & 2h Guide | Active Day 2 Companion | Checkout Checklist | Completed Trip Review |
| `/trip-builder` | 4-step wizard active | 4-step wizard active | Edit Itinerary Mode | Locked (In Progress) | Locked (In Progress) | Locked (Completed) | Read-only Summary |
| `/food` | General Restaurant List | General Restaurant List | Hotel Breakfast Guide | Quick Bite Recommendations | Real-time Dine-in/Delivery | Last Dahab Meal Guide | Archived Favorites |
| `/help` | General Inquiries | General Inquiries | Luggage & Flight Triage | Check-in Assistance | Active Trip Emergency | Departure Shuttle Help | Post-Trip Support |
| `/bookings` | No Bookings State | Pending Hold List | Confirmed Vouchers | Check-in QR Vouchers | Active Excursion Tickets | Airport Transfer Ticket | Historical Tax Invoice |
| `/departure` | Sample Checklist | Sample Checklist | Sample Checklist | Sample Checklist | Upcoming Notice | Active Step-by-Step Hub | Archive Mode |
| `/post-trip` | Sample Preview | Sample Preview | Sample Preview | Sample Preview | Sample Preview | Departure Rating Prompt | Interactive Memory Hub |

---

## 13. Code vs. Documentation Reconciliation

1. **Routing Architecture**: Documentation in `/docs/architecture/` referenced traditional URL hash routing, whereas the actual codebase in `src/App.tsx` implements a reactive state-based routing model (`currentRoute`) synchronized with `window.history`.
2. **DayGI Capabilities**: The codebase contains **DayGI 4.0** with structured multi-action orchestration, real-time memory inspection, rollback handlers, and closed beta telemetry, surpassing earlier specifications in `DAYGI_PRODUCT_SPEC.md`.
3. **Operations & Intelligence**: The codebase features a massive 16-subsystem `MarketIntelligenceView.tsx` and an 11-subsystem `OperationsConsoleView.tsx` with live Golden Journey test suites, delivering full enterprise-grade local travel OS coverage.
4. **Commerce Integration**: Instant booking supports both instant holding timers (10 minutes) and multi-payment gateways (Paymob Card, Cash, Vodafone Cash/InstaPay) with live confirmation and digital vouchers.
