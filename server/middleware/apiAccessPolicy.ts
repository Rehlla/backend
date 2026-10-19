import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './correlationMiddleware';
import { hasAnyPermission } from '../services/permissionService';

type Role = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Rule {
  /** Matched against the path after /api, e.g. '/commerce/ledger'. */
  pattern: RegExp;
  methods?: Method[];
}

interface RoleRule extends Rule {
  roles: Role[];
}

/**
 * Central access policy for /api.
 *
 * Before this existed, requireAuth was applied to exactly one router
 * (/api/dahab/admin). Everything else — checkout, refunds, the ledger, the
 * operations overview, supplier dashboards including payout IBANs — answered
 * anonymous requests. Rather than hunting ~120 individual handlers, the default
 * is now "authentication required" and exceptions are listed explicitly here.
 *
 * Adding a route therefore makes it private by default. That is the point: the
 * failure mode of forgetting to update this file is a 401, not a data breach.
 */

/** Endpoints that must work before a session exists, or that are genuinely public. */
const PUBLIC_RULES: Rule[] = [
  // Session establishment and teardown.
  { pattern: /^\/auth\/(register|login|firebase-session|logout)$/, methods: ['POST'] },
  // Session probe. Public so a logged-out visitor's load-time check answers
  // 200 with an empty user instead of a 401 the browser paints into the
  // console on every page load. Presented-but-invalid credentials still 401
  // inside the handler — that is a real error worth seeing; and the handler
  // only ever echoes the session it validated, so this exposes nothing.
  { pattern: /^\/auth\/me$/, methods: ['GET'] },
  // Native refresh-token rotation (docs/OPS_API_CONTRACT.md). The access token
  // has expired by the time this is called, so it cannot require a session;
  // the refresh token in the body is the credential.
  { pattern: /^\/auth\/refresh$/, methods: ['POST'] },
  { pattern: /^\/health$/, methods: ['GET'] },

  // Unified remote config for the web app and both Flutter apps. Public by
  // design: anonymous clients need maintenance state, kill switches and the
  // announcement banner before sign-in. The payload is client-safe only —
  // server/services/remoteConfigService.ts documents the exclusions.
  { pattern: /^\/config$/, methods: ['GET'] },

  // Display-only currency rates; no PII, charges stay EGP (fxService.ts).
  { pattern: /^\/fx\/rates$/, methods: ['GET'] },

  // Anonymous product analytics ingestion. The handler whitelists event names
  // and strips PII, so the exposure is bounded by design.
  { pattern: /^\/analytics\/events$/, methods: ['POST'] },
  { pattern: /^\/media\/sync$/, methods: ['GET'] },
  // CMS-uploaded images (hotel galleries, page heroes) shown on the public
  // site. Only admins write cms-media/; the handler in server.ts rejects path
  // traversal and serves every file under a sandboxed CSP. One path segment
  // only, read-only.
  { pattern: /^\/media\/[^/]+$/, methods: ['GET'] },

  // Destination knowledge: the public marketing and discovery surface.
  // /dahab/admin is excluded below and carries its own auth.
  { pattern: /^\/dahab\/(?!admin)/, methods: ['GET'] },

  // Parties & nightlife (dahabPartyRoutes.ts): browsing, zones and detail are
  // covered by the /dahab GET rule above. The WhatsApp book-intent is a
  // public POST on purpose — WhatsApp IS the booking flow in Dahab's real
  // nightlife, and demanding an account before handing a traveler the
  // organizer's number loses them to Instagram DMs. Exposure is bounded by
  // design: the handler whitelists three body fields, renders the WhatsApp
  // message server-side from the party row, and logs identity only when a
  // session exists.
  { pattern: /^\/dahab\/parties\/[^/]+\/book-intent$/, methods: ['POST'] },

  // Ambient conditions shown on the public homepage.
  { pattern: /^\/telemetry\/(weather|cameras|conditions)$/, methods: ['GET'] },
  // Modeled sea state — same ambient class as weather/cameras (no PII, read-only,
  // 503 when the model run is missing). Powers the public discovery conditions strip.
  { pattern: /^\/telemetry\/marine$/, methods: ['GET'] },

  // Research-grounded homepage handbook (season / experiences / landmarks / safety).
  { pattern: /^\/research\/dahab-overview$/, methods: ['GET'] },

  // Browsing the catalogue and checking prices before signing up.
  { pattern: /^\/inventory\/[^/]+$/, methods: ['GET'] },
  { pattern: /^\/commerce\/availability$/, methods: ['POST'] },
  // Same projection with per-slot capacity: SKU catalogue + slot counts, no
  // bookings or traveler data. Lets a visitor pick a departure before sign-in.
  { pattern: /^\/commerce\/availability\/rich$/, methods: ['POST'] },

  // Spatial helpers used by the anonymous homepage ("I have two hours").
  { pattern: /^\/context\//, methods: ['GET', 'POST'] },

  // Hotels catalogue: browsing the list, filters and per-hotel detail before
  // signing up. Bookability itself runs through /commerce/availability.
  { pattern: /^\/hotels(\/|$)/, methods: ['GET'] },

  // Accommodations catalogue (generalized successor to hotels): browsing,
  // per-property detail, and NL search-intent parsing before signing up.
  // Admin CRUD paths are excluded and carry role rules below.
  { pattern: /^\/accommodations$/, methods: ['GET'] },
  { pattern: /^\/accommodations\/search-intent$/, methods: ['POST'] },
  { pattern: /^\/accommodations\/[^/]+$/, methods: ['GET'] },
  // The stay surface rides on the property paths: room types, availability,
  // a server-computed quote and the platform's own reviews are all pre-signup
  // reading - the same posture as the rentals quote. Reserving and everything
  // after (/hotel-bookings*) requires a session.
  { pattern: /^\/accommodations\/[^/]+\/room-types$/, methods: ['GET'] },
  { pattern: /^\/accommodations\/[^/]+\/availability$/, methods: ['GET'] },
  { pattern: /^\/accommodations\/[^/]+\/reviews$/, methods: ['GET'] },
  { pattern: /^\/accommodations\/[^/]+\/quote$/, methods: ['POST'] },

  // The listing page's availability sweep. Read-only and needs no account: a
  // traveller has to learn what is free before signing up. The per-property
  // detail stays behind the property routes above.
  { pattern: /^\/availability\/stays$/, methods: ['GET'] },

  // The static platform roster, so the comparison UI can render before sign-up.
  // The quote POST itself stays authenticated: it spends a paid provider call
  // per request, and public access would make this an open metered proxy.
  { pattern: /^\/price-comparison\/available-platforms$/, methods: ['GET'] },

  // Dining: browsing, the menu, zone resolution and a server-computed quote
  // before signing up - a traveler has to see what a dinner costs and whether
  // it reaches them before being asked for an account. Deliberately NOT public:
  // /dining/orders (placing, listing, reading, cancelling) and
  // /dining/orders/:id/status (operations drives the order through its states).
  { pattern: /^\/dining\/venues$/, methods: ['GET'] },
  { pattern: /^\/dining\/venues\/[^/]+$/, methods: ['GET'] },
  { pattern: /^\/dining\/delivery-zones$/, methods: ['GET'] },
  { pattern: /^\/dining\/quote$/, methods: ['POST'] },

  // Rentals catalogue: browsing, per-listing detail, availability checks and
  // server-computed quotes before signing up. Provider/admin management paths
  // (/rentals/provider, /rentals/:id/...) are excluded and carry role rules
  // below.
  { pattern: /^\/rentals$/, methods: ['GET'] },
  { pattern: /^\/rentals\/(?!provider)[^/]+$/, methods: ['GET'] },
  { pattern: /^\/rentals\/(check-availability|quote)$/, methods: ['POST'] },

  // Transfer route discovery: browsing origins and quoting prices before signup.
  { pattern: /^\/transfers\/(origins|route|resolve-geo)$/, methods: ['GET'] },
  // Future-ride hub: catalog, timetable, fleet, driver preview and the quote.
  // Supplier cost is not on these payloads. Lock and cancel stay authenticated.
  { pattern: /^\/transfers\/(hub|buses|fleet|drivers\/preview)$/, methods: ['GET'] },
  { pattern: /^\/transfers\/quote$/, methods: ['POST'] },

  // The public trip planner.
  { pattern: /^\/trip\/generate$/, methods: ['POST'] },

  // DayGI questions. The concierge page is public, so a visitor has to get a
  // real answer before being asked for an account. Handlers ignore any userId
  // in the body and skip memory and chat writes when there is no session —
  // they never fall back to the demo traveler. Booking, history, sharing and
  // task execution stay on the authenticated default.
  { pattern: /^\/daygi\/query$/, methods: ['POST'] },
  { pattern: /^\/daygi\/query\/stream$/, methods: ['POST'] },

  // GraphQL gateway — resolver-gated like the DayGI queries above. The public
  // fields (platform health, catalogue cards, areas) mirror the pre-signup
  // REST browsing surface, while the support/daygi resolvers re-assert the
  // actor and answer 'Authentication required.' to anonymous callers. The
  // gateway tests pin that behaviour (tests/domain/graphqlApi.test.ts).
  { pattern: /^\/graphql$/, methods: ['POST'] },

  // DayGI message feedback. The concierge page is public and its feedback row
  // renders for anonymous visitors too (FIX_PLAN.md: "keep public — any
  // traveler can give feedback"). The handler resolves identity from the
  // session or a client-generated anonymous id and the route carries its own
  // tight rate limiter, so the exposure is one bounded telemetry write.
  { pattern: /^\/daygi\/beta\/feedback$/, methods: ['POST'] },

  // CMS public content APIs — published content for the website.
  { pattern: /^\/content\//, methods: ['GET'] },

  // Verified-stay reviews for a supplier (blueprint row #14). Public read:
  // the trust signal is worthless if only signed-in users can see it. The
  // handler exposes display names and aggregates only — never emails/phones.
  // Writing, responding and moderating stay on the authenticated default.
  { pattern: /^\/reviews\/supplier\/[^/]+$/, methods: ['GET'] },

  // Supplier trust aggregates (reliability score, reef-positive score, and the
  // public reef-positive list). Same rationale as the reviews read: these are
  // display aggregates — rates and point totals, never names/contacts — and a
  // trust badge hidden behind sign-in is a badge nobody sees.
  { pattern: /^\/suppliers\/[^/]+\/reliability$/, methods: ['GET'] },
  { pattern: /^\/suppliers\/[^/]+\/reef-score$/, methods: ['GET'] },
  { pattern: /^\/reef-positive-suppliers$/, methods: ['GET'] },
  // The conservation scoring rubric behind the reef badges — public like the
  // reef-positive list. No personal data, just action-type point values.
  { pattern: /^\/reef-action-types$/, methods: ['GET'] },

  // Bundle catalogue read + the cart discount calculator. Both are display
  // aggregates / arithmetic over the already-public catalogue (names,
  // discount percentages, price math) — the marketing surface is worthless if
  // a visitor must sign in to see a promo. Mutations stay gated by the role
  // rules below; note compute-discount must be excluded there explicitly.
  { pattern: /^\/bundles$/, methods: ['GET'] },
  { pattern: /^\/bundles\/compute-discount$/, methods: ['POST'] },

  // Supplier availability calendar (blueprint row #12). The monthly view is
  // public so travel planners can show blocked dates without sign-in.
  // (Path is relative to the /api mount — a leading /api here never matched.)
  { pattern: /^\/suppliers\/[^/]+\/availability$/, methods: ['GET'] },

  // Paymob webhook — must be public so Paymob can POST without a Dahab session.
  { pattern: /^\/payments\/paymob-webhook$/, methods: ['POST'] },

  // Public newsletter subscription (email + lang)
  { pattern: /^\/newsletter$/, methods: ['POST'] },
];

/**
 * Role requirements, applied after authentication. First match wins, so put
 * the most specific patterns first.
 */
const ROLE_RULES: RoleRule[] = [
  // Financial records and reconciliation.
  { pattern: /^\/commerce\/ledger/, roles: ['Operations', 'Admin'] },
  { pattern: /^\/commerce\/refund$/, roles: ['Operations', 'Admin'] },

  // Back-office consoles.
  { pattern: /^\/operations\//, roles: ['Operations', 'Admin'] },
  // Supplier directory listing: any authenticated user may browse suppliers
  // (IBAN hiding is enforced in the handler — canSeePayoutDetails). Sub-paths
  // like /suppliers/:id/dashboard remain Supplier/Operations/Admin only.
  // Product too: the catalogue supplier picker (docs/CATALOG_API_CONTRACT.md).
  { pattern: /^\/suppliers$/, methods: ['GET'], roles: ['Traveler', 'Supplier', 'Operations', 'Product', 'Admin'] },
  { pattern: /^\/suppliers\//, roles: ['Supplier', 'Operations', 'Admin'] },

  // Market intelligence and autonomous data operations, including snapshot
  // rollback and schedule policy changes.
  { pattern: /^\/market\//, roles: ['Product', 'Operations', 'Admin'] },
  { pattern: /^\/intelligence\//, roles: ['Product', 'Operations', 'Admin'] },
  // Dahab Intelligence Core — admin control plane (deterministic tool router).
  { pattern: /^\/intelligence-core\//, roles: ['Operations', 'Admin'] },

  // Accommodations admin surface: create/edit/deactivate properties and
  // manage their external reference links.
  { pattern: /^\/admin\/accommodations(\/|$)/, roles: ['Operations', 'Admin', 'Product'] },

  // Stay engine staff surface: room types, the rate calendar and the booking
  // queue. Operations/Admin only - Product curates catalogue copy, not rooms,
  // rates or money.
  { pattern: /^\/admin\/hotel(\/|$)/, roles: ['Operations', 'Admin'] },

  // Dining order status: operations drives an order through its states.
  // Ordering matters - requiredRolesFor takes the FIRST match, so this must
  // stay above anything that could read as a broad /dining/ pattern.
  { pattern: /^\/dining\/orders\/[^/]+\/status$/, methods: ['POST'], roles: ['Operations', 'Admin'] },



  // Rental provider and admin surfaces.

  { pattern: /^\/rentals\/provider/, roles: ['Supplier', 'Operations', 'Admin'] },
  // The property's own stays (propertyStayRoutes): owners and the desk.
  { pattern: /^\/property-stays(\/|$)/, roles: ['Supplier', 'Operations', 'Admin'] },
  { pattern: /^\/rentals\/[^/]+\/maintenance-blocks/, roles: ['Supplier', 'Operations', 'Admin'] },
  { pattern: /^\/rentals\/[^/]+\/status$/, roles: ['Operations', 'Admin'] },
  { pattern: /^\/rental-bookings\/provider/, roles: ['Supplier', 'Operations', 'Admin'] },
  { pattern: /^\/rental-bookings\/[^/]+\/(accept|reject|mark-returned|complete)$/, roles: ['Supplier', 'Operations', 'Admin'] },

  // /dahab/commerce is publicly readable (public /dahab GET surface), but the
  // mutation endpoints drive the back-office data-ops machine: triggering and
  // retargeting schedule policies, resolving the review queue, creating and
  // rolling back knowledge snapshots, acknowledging/resolving alerts, and
  // resetting the market-freshness circuit breakers. A Traveler must never do
  // these. Refresh is read-mostly (product-market data) so Product is included.
  { pattern: /^\/dahab\/commerce\/refresh$/, roles: ['Product', 'Operations', 'Admin'] },
  { pattern: /^\/dahab\/commerce\/(review-queue\/[^/]+\/resolve|jobs\/|run-all-scheduled|alerts\/[^/]+\/(acknowledge|resolve)|snapshots\/|circuit-breakers\/)/, roles: ['Operations', 'Admin'] },

  // Parties admin CRUD (dahabPartyRoutes.ts): catalogue curation and the
  // licence gate are Operations acts — Product curates CMS copy, not the
  // nightlife catalogue or who is allowed to sell a ticket.
  { pattern: /^\/dahab\/admin\/parties(\/|$)/, roles: ['Operations', 'Admin'] },

  // Answering a traveler's support message is an Operations act; sending one
  // and reading your own thread is not, and is left to the default (any
  // authenticated user), with the handler scoping the list to its owner.
  { pattern: /^\/support\/messages\/[^/]+\/reply$/, roles: ['Operations', 'Admin'] },
  // Escalation, assignment, resolve, close — Operations/Admin only.
  // (Patterns are mount-relative: an /api/… prefix here never matched and
  // silently left these on the authenticated default.)
  { pattern: /^\/support\/messages\/[^/]+\/(escalate|assign|resolve|close)$/, roles: ['Operations', 'Admin'] },
  { pattern: /^\/support\/escalation-queue$/, roles: ['Operations', 'Admin'] },
  { pattern: /^\/support\/counts$/, roles: ['Operations', 'Admin'] },

  // Outbound messaging to real drivers and dive centres.
  { pattern: /^\/sms\//, roles: ['Operations', 'Admin'] },

  // Dynamic bundle management — mutations are Admin/Operations only. The
  // public read (GET /bundles) and the cart calculator
  // (POST /bundles/compute-discount) are allowlisted above, so compute-
  // discount is excluded here; GET /bundles/:id deliberately falls through to
  // the authenticated default (any signed-in user may view a bundle).
  { pattern: /^\/bundles$/, methods: ['POST'], roles: ['Admin', 'Operations'] },
  { pattern: /^\/bundles\/(?!compute-discount)[^/]+$/, methods: ['POST', 'PATCH', 'DELETE'], roles: ['Admin', 'Operations'] },

  // Fraud detection — Admin/Operations read, Admin-only write.
  { pattern: /^\/fraud\//, roles: ['Admin', 'Operations'] },

  // Review moderation (blueprint row #14): the pending queue and approve/
  // flag/hide actions are Operations acts. A supplier answers their own
  // approved reviews through /reviews/:id/respond, which stays on the
  // authenticated default and resolves the acting supplier from the session.
  { pattern: /^\/reviews\/pending$/, roles: ['Operations', 'Admin'] },
  { pattern: /^\/reviews\/[^/]+\/moderate$/, roles: ['Operations', 'Admin'] },

  // Payout settlement (blueprint row #12): the pending queue is ops-only.
  // Supplier payout reads use the authenticated default (own-supplier guard).
  { pattern: /^\/payouts\/pending$/, roles: ['Operations', 'Admin'] },

  // Ops-broadcast push sends (per-user subscribe/unsubscribe under /push/
  // stays on the authenticated default: any signed-in user, own browsers).
  { pattern: /^\/admin\/push\//, roles: ['Operations', 'Admin'] },

  // Background job control and the event bus.
  { pattern: /^\/jobs\//, roles: ['Operations', 'Admin'] },
  { pattern: /^\/events\//, roles: ['Operations', 'Admin'] },

  // Beta experiment flags and telemetry dashboards (write + read of aggregates).
  { pattern: /^\/daygi\/beta\/(dashboard|experiments|run-scenarios|generate-weekly-report)/, roles: ['Product', 'Operations', 'Admin'] },

  // Test harness, if it has been explicitly enabled.
  { pattern: /^\/testing\//, roles: ['Admin'] },

  // CMS content management — Operations and Admin can publish, Product can draft.
  { pattern: /^\/admin\/content\//, roles: ['Operations', 'Admin', 'Product'] }
];

/**
 * Permission requirements, evaluated AFTER ROLE_RULES has passed (and for
 * paths with no role rule). First match wins. A rule lists the keys of which
 * the caller needs ANY one: `read` applies to GET/HEAD, `write` to every
 * other method, `all` to both.
 *
 * ROLE_RULES stay the coarse gate and are unchanged; this layer exists so a
 * per-user deny override (or a narrower custom role) actually takes effect
 * on the existing back-office paths. The default role grants in
 * server/auth/permissionCatalog.ts cover every rule for every role ROLE_RULES
 * admits — tests/ops/permissions.test.ts proves it, so adding this
 * layer changed nobody's access.
 */
interface PermissionRule extends Rule {
  read?: string[];
  write?: string[];
  all?: string[];
}

const SUPPLIER_RENTALS = ['supplier.rentals.manage', 'ops.suppliers.manage'];
const CATALOG_AREAS = ['activities', 'packages', 'transfers', 'hotels', 'restaurants'];
const CATALOG_VIEW_KEYS = CATALOG_AREAS.map(a => `catalog.${a}.view`);
// Transfers have no publish key: manage covers it.
const CATALOG_WRITE_KEYS = CATALOG_AREAS.flatMap(a => (a === 'transfers' ? [`catalog.${a}.manage`] : [`catalog.${a}.manage`, `catalog.${a}.publish`]));

export const PERMISSION_RULES: PermissionRule[] = [
  { pattern: /^\/commerce\/ledger/, all: ['ops.commerce.view'] },
  { pattern: /^\/commerce\/refund$/, all: ['ops.commerce.refund'] },

  { pattern: /^\/operations\/refund$/, all: ['ops.commerce.refund'] },
  { pattern: /^\/operations\/sms-dispatch$/, all: ['ops.sms.send'] },
  { pattern: /^\/operations\/transfers(\/|$)/, read: ['ops.transfers.view'], write: ['ops.transfers.manage'] },
  { pattern: /^\/operations\/(trips|bookings)(\/|$)/, read: ['ops.trips.view'], write: ['ops.trips.manage'] },
  { pattern: /^\/operations\/payments(\/|$)/, all: ['ops.commerce.view'] },
  { pattern: /^\/operations\/notifications(\/|$)/, read: ['ops.notifications.view'], write: ['ops.notifications.send'] },
  { pattern: /^\/operations\/audit-events(\/|$)/, all: ['ops.audit.view'] },
  { pattern: /^\/operations\/integrations(\/|$)/, all: ['ops.health.view'] },
  { pattern: /^\/operations\/supplier-reliability(\/|$)/, all: ['ops.suppliers.view'] },
  { pattern: /^\/operations\//, read: ['ops.overview.view'], write: ['ops.trips.manage'] },

  // Supplier sub-paths: the supplier's own keys, or the desk's.
  { pattern: /^\/suppliers\//, read: ['supplier.inbox.view', 'ops.suppliers.view'], write: ['supplier.inbox.respond', 'ops.suppliers.manage'] },

  { pattern: /^\/market\//, read: ['market.view'], write: ['market.manage'] },
  { pattern: /^\/intelligence\//, read: ['ops.intelligence.view', 'market.view'], write: ['ops.intelligence.view', 'market.manage'] },
  { pattern: /^\/intelligence-core\//, all: ['ops.intelligence.view'] },

  { pattern: /^\/admin\/accommodations(\/|$)/, read: ['ops.accommodations.view', 'cms.content.view'], write: ['ops.accommodations.manage', 'cms.content.edit'] },
  { pattern: /^\/admin\/hotel(\/|$)/, read: ['ops.stays.view'], write: ['ops.stays.manage'] },
  { pattern: /^\/admin\/pricing(\/|$)/, read: ['ops.pricing.view'], write: ['ops.pricing.manage'] },
  { pattern: /^\/dining\/orders\/[^/]+\/status$/, methods: ['POST'], all: ['ops.dining.manage'] },

  { pattern: /^\/rentals\/provider/, all: SUPPLIER_RENTALS },
  { pattern: /^\/property-stays(\/|$)/, all: ['supplier.stays.manage', 'ops.stays.manage'] },
  { pattern: /^\/rentals\/[^/]+\/maintenance-blocks/, all: SUPPLIER_RENTALS },
  { pattern: /^\/rentals\/[^/]+\/status$/, all: ['ops.suppliers.manage'] },
  { pattern: /^\/rental-bookings\/provider/, all: SUPPLIER_RENTALS },
  { pattern: /^\/rental-bookings\/[^/]+\/(accept|reject|mark-returned|complete)$/, all: SUPPLIER_RENTALS },

  { pattern: /^\/dahab\/commerce\/refresh$/, all: ['market.manage', 'ops.knowledge.manage'] },
  { pattern: /^\/dahab\/commerce\/(review-queue\/[^/]+\/resolve|jobs\/|run-all-scheduled|alerts\/[^/]+\/(acknowledge|resolve)|snapshots\/|circuit-breakers\/)/, all: ['ops.jobs.run'] },
  { pattern: /^\/dahab\/admin\/parties(\/|$)/, read: ['ops.knowledge.view'], write: ['ops.knowledge.manage'] },

  { pattern: /^\/support\/messages\/[^/]+\/(reply|escalate|assign|resolve|close)$/, all: ['ops.support.reply'] },
  { pattern: /^\/support\/(escalation-queue|counts)$/, all: ['ops.support.view'] },

  { pattern: /^\/sms\//, read: ['ops.sms.view'], write: ['ops.sms.send'] },

  { pattern: /^\/bundles$/, methods: ['POST'], all: ['ops.pricing.manage'] },
  { pattern: /^\/bundles\/(?!compute-discount)[^/]+$/, methods: ['POST', 'PATCH', 'DELETE'], all: ['ops.pricing.manage'] },

  { pattern: /^\/fraud\//, all: ['ops.commerce.view'] },
  { pattern: /^\/reviews\/pending$/, all: ['ops.suppliers.view'] },
  { pattern: /^\/reviews\/[^/]+\/moderate$/, all: ['ops.suppliers.manage'] },
  { pattern: /^\/payouts\/pending$/, all: ['ops.commerce.view'] },
  { pattern: /^\/admin\/push\//, all: ['ops.notifications.send'] },
  { pattern: /^\/jobs\//, read: ['ops.jobs.view'], write: ['ops.jobs.run'] },
  { pattern: /^\/events\//, all: ['ops.jobs.view'] },
  { pattern: /^\/daygi\/beta\/(dashboard|experiments|run-scenarios|generate-weekly-report)/, all: ['ops.flags.view'] },
  { pattern: /^\/testing\//, all: ['admin.settings.manage'] },

  // Catalogue (docs/CATALOG_API_CONTRACT.md). Coarse any-of gate; the routers
  // check the per-type key (catalog.<area>.view|manage|publish) on every route.
  { pattern: /^\/admin\/catalog(\/|$)/, read: CATALOG_VIEW_KEYS, write: CATALOG_WRITE_KEYS },
  { pattern: /^\/supplier\/catalog(\/|$)/, all: ['supplier.catalog.manage'] },

  { pattern: /^\/admin\/content\/media(\/|$)/, read: ['cms.content.view'], write: ['cms.media.upload'] },
  { pattern: /^\/admin\/content\//, read: ['cms.content.view'], write: ['cms.content.edit'] },
];

/** The permission keys (any one suffices) a path requires, or null when no rule applies. */
export function requiredPermissionsFor(path: string, method: string): string[] | null {
  const m = method.toUpperCase();
  const rule = PERMISSION_RULES.find(r => r.pattern.test(path) && (!r.methods || r.methods.includes(m as Method)));
  if (!rule) return null;
  const isRead = m === 'GET' || m === 'HEAD';
  return rule.all || (isRead ? rule.read : rule.write) || null;
}

function matches(rule: Rule, path: string, method: string): boolean {
  if (!rule.pattern.test(path)) return false;
  if (!rule.methods) return true;
  return rule.methods.includes(method as Method);
}

export function isPublicApiPath(path: string, method: string): boolean {
  return PUBLIC_RULES.some(rule => matches(rule, path, method));
}

/**
 * Role requirements for a path, applied after authentication. First match
 * wins, so put the most specific patterns first. A rule that declares
 * `methods` only applies to those methods — the method must be supplied for
 * that check to happen (the middleware always supplies it; a methodless query
 * matches method-declaring rules as a conservative read of written intent).
 */
export function requiredRolesFor(path: string, method?: string): Role[] | null {
  const m = method?.toUpperCase();
  const rule = ROLE_RULES.find(
    r => r.pattern.test(path) && (!r.methods || !m || r.methods.includes(m as Method))
  );
  return rule ? rule.roles : null;
}

/**
 * Deny-by-default gate. Mount on /api AFTER optionalAuth has run.
 */
export function apiAccessPolicy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // req.path here is relative to the mount point (/api).
  const path = req.path;
  const method = req.method.toUpperCase();

  if (isPublicApiPath(path, method)) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      type: 'https://dahab.travel/errors/unauthorized',
      title: 'Authentication Required',
      status: 401,
      // Unknown /api paths intentionally return this same 401 (deny-by-
      // default: the failure mode of a forgotten route is "sign in", not a
      // breach). Say so, or QA chases a session bug when the path is wrong.
      detail: 'Sign in to access this resource. Unknown /api paths return this same response by design — if you are signed in, verify the route path.',
      instance: req.originalUrl,
      correlationId: req.correlationId
    });
  }

  const roles = requiredRolesFor(path, method);
  if (roles && !roles.includes(req.user.role)) {
    return res.status(403).json({
      type: 'https://dahab.travel/errors/forbidden',
      title: 'Forbidden',
      status: 403,
      // Deliberately does not echo the caller's own role back; that is a small
      // information leak and it does not help a legitimate user.
      detail: 'Your account does not have permission to access this resource.',
      instance: req.originalUrl,
      correlationId: req.correlationId
    });
  }

  const permissions = requiredPermissionsFor(path, method);
  if (permissions && !hasAnyPermission({ userId: req.user.userId, role: req.user.role }, permissions)) {
    return res.status(403).json({
      type: 'https://dahab.travel/errors/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'Your account does not have permission to access this resource.',
      instance: req.originalUrl,
      correlationId: req.correlationId
    });
  }

  next();
}
