# DAHAB AUTHENTICATION UX SPECIFICATION
**Version:** 1.0.0  
**Status:** Approved & Enforced  
**Domain:** Identity, Session Management, RBAC, and Trip Draft Preservation

---

## 1. Executive Summary & Design Principles

The Dahab Tourism Platform authentication experience is architected around **Invisible Identity & Seamless Continuity**. Authentication is never a transactional roadblock or generic SaaS template; it is a calm, trustworthy Sinai-styled portal that preserves traveler intent.

### Core Tenets:
1. **Never Lose Traveler Work (Trip Preservation First):**
   - An anonymous user exploring Dahab or building an itinerary creates a live draft in memory/state.
   - When transitioning through `/auth/sign-in` or `/auth/sign-up`, the draft state is preserved and automatically associated with the authenticated profile upon success.
   - The user is seamlessly returned to their `intendedRoute` (e.g., `/my-trip`, `/trip-preview`, `/book`).

2. **Calm Sinai Aesthetic (Deep Sea & Desert Glow):**
   - Backgrounds: Dark Sea (`#06181F`) and Deep Slate-Teal (`#0B2530`).
   - Accents: Warm Gold (`#E7A83B`) and Mint Teal (`#20A89A`).
   - Typography: Clear hierarchy with balanced margins and high contrast.

3. **Bilingual Egyptian Arabic & English:**
   - Full bidirectional RTL/LTR support.
   - Warm local phrasing ("أهلاً بيك تاني في دهب", "احفظ رحلتك واستمتع بالمرافقة الذكية").

4. **Humanized Error Handling:**
   - Technical codes (`auth/wrong-password`, `auth/user-not-found`) are translated to empathetic, actionable language in Arabic and English.

---

## 2. Route Specifications

| Route | Primary Surface | Features |
|---|---|---|
| `/auth/sign-in` | `AuthView` (mode: `sign-in`) | Google 1-Click Popup, Email/Password login, Forgot password trigger, Trip draft preservation indicator |
| `/auth/sign-up` | `AuthView` (mode: `sign-up`) | Full name, Email, Phone, Role selector (`Traveler`, `Supplier`, `Operations`), Instant cloud ledger sync |
| `/auth/forgot-password` | `AuthView` (mode: `forgot-password`) | Email reset trigger, friendly confirmation toast, back to sign-in navigation |
| `/auth/verify` & `/auth/callback` | `AuthView` (mode: `verify`) | Session sync verification and routing resolution |

---

## 3. Architecture & Separation of Concerns

```
[Client App / Browser]
    │
    ├─► Firebase Auth (Client Identity & Token Acquisition)
    │        │
    │        ▼ (idToken / UID / Claims)
    ├─► POST /api/auth/firebase-session (Express Backend)
    │        │
    │        ▼
    └─► Cloud SQL PostgreSQL (Authoritative Source of Truth)
             ├─ users / profiles
             ├─ trips & trip_items
             ├─ bookings & inventory holds
             ├─ double-entry ledger & audit logs
```

- **Firebase Auth:** Handles identity authentication only (OAuth popups, email token claims, password resets).
- **Cloud SQL PostgreSQL:** Authoritative single source of truth for all business entities, bookings, inventory, and financial ledger entries.
- **Firestore:** Strictly read-only projection for real-time mobile sync and client-side listener subscriptions.
