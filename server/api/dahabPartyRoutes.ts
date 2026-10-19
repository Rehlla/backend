import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import {
  PartyServiceError,
  listCategories,
  listParties,
  listTonightParties,
  listZones,
  getPartyById,
  recordBookIntent,
  adminCreateParty,
  adminDeleteParty,
  adminListParties,
  adminSetLicenseVerified,
  adminUpdateParty,
  type PartyListFilters
} from '../services/dahabPartyService';
import { enumParam, stringParam } from '../middleware/queryParams';
import { optionalCount, requiredEnum, requiredString, pickAllowedKeys } from '../middleware/bodyParams';
import { PARTY_ZONES, PARTY_CATEGORIES, type PartyZone, type PartyCategory } from '../../src/shared/dahabParties';

/**
 * /api/dahab/parties — the nightlife surface.
 *
 * Public before sign-up exactly like the rest of /dahab: browsing tonight's
 * parties, zone summaries and per-party detail are the discovery surface, and
 * WhatsApp conversion IS the booking flow — demanding an account before a
 * traveler can see a meeting point is how GetYourGuide lost this market.
 * book-intent is likewise public but bounded: the handler whitelists every
 * field it accepts, identity comes from the session when present, and the
 * WhatsApp message is rendered server-side from the party row.
 *
 * The admin CRUD under /admin/parties is NOT public: apiAccessPolicy carries
 * an Operations/Admin rule for it, and identity for audit comes from
 * req.user!.userId — never from the body.
 */

function sendPartyError(res: Response, err: any) {
  if (err instanceof PartyServiceError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  return res.status(err?.status || 400).json({ error: err?.message || 'Request could not be processed.' });
}

function readFilters(req: AuthenticatedRequest): PartyListFilters {
  const filters: PartyListFilters = {};
  const zone = enumParam(req.query.zone, PARTY_ZONES, 'zone');
  if (zone) filters.zone = zone as PartyZone;
  const category = enumParam(req.query.category, PARTY_CATEGORIES, 'category');
  if (category) filters.category = category as PartyCategory;
  const vibe = stringParam(req.query.vibe, 'vibe');
  if (vibe) filters.vibe = vibe;
  const date = stringParam(req.query.date, 'date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) filters.date = date;
  const priceMaxRaw = stringParam(req.query.price_max_egp, 'price_max_egp');
  if (priceMaxRaw !== undefined) {
    const priceMax = Number(priceMaxRaw);
    if (!Number.isFinite(priceMax) || priceMax < 0) {
      throw new PartyServiceError(400, 'VALIDATION', 'price_max_egp must be a non-negative number.');
    }
    filters.priceMaxEgp = priceMax;
  }
  if (req.query.free_only === 'true' || req.query.free_only === '1') filters.freeOnly = true;
  if (req.query.featured_only === 'true' || req.query.featured_only === '1') filters.featuredOnly = true;
  if (req.query.tonight === 'true' || req.query.tonight === '1') filters.tonight = true;
  const q = stringParam(req.query.q, 'q');
  if (q) filters.q = q;
  return filters;
}

export const dahabPartyRouter = Router();

/**
 * GET /api/dahab/parties
 * The catalogue with every filter the discovery UI offers. 6h cache, so the
 * weak-internet acceptance criterion (<2s tonight) holds on repeat visits.
 */
dahabPartyRouter.get('/parties', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(listParties(readFilters(req)));
  } catch (err) {
    sendPartyError(res, err);
  }
});

/**
 * GET /api/dahab/parties/tonight
 * Parties happening today, sorted featured-first then by start time.
 */
dahabPartyRouter.get('/parties/tonight', (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = stringParam(req.query.date, 'date');
    res.json(listTonightParties(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined));
  } catch (err) {
    sendPartyError(res, err);
  }
});

/** GET /api/dahab/parties/zones — zone summaries with live counts. */
dahabPartyRouter.get('/parties/zones', (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ status: 'success', ...listZones() });
  } catch (err) {
    sendPartyError(res, err);
  }
});

/** GET /api/dahab/parties/categories — map-pin legend. */
dahabPartyRouter.get('/parties/categories', (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ status: 'success', ...listCategories() });
  } catch (err) {
    sendPartyError(res, err);
  }
});

/** GET /api/dahab/parties/:id — per-party detail. Verified rows only. */
dahabPartyRouter.get('/parties/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ status: 'success', party: getPartyById(req.params.id) });
  } catch (err) {
    sendPartyError(res, err);
  }
});

/**
 * POST /api/dahab/parties/:id/book-intent
 *
 * Logs the intent, increments the counter, and hands back a server-rendered
 * wa.me link. Accepts exactly three fields — targetDate, persons, language —
 * and nothing else, so the anonymous POST cannot smuggle content into the
 * organizer's WhatsApp message.
 */
dahabPartyRouter.post('/parties/:id/book-intent', (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = pickAllowedKeys(req.body || {}, ['targetDate', 'persons', 'language'] as const, 'body');
    const targetDate = requiredString(body.targetDate, 'targetDate', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ error: 'targetDate must be YYYY-MM-DD.', code: 'VALIDATION' });
    }
    const persons = optionalCount(body.persons, 'persons', 1, 20) ?? 1;
    const language = requiredEnum(body.language, ['en', 'ar'] as const, 'language');
    const result = recordBookIntent(req.params.id, {
      targetDate,
      persons,
      language,
      // Identity from the session, never the body; anonymous is allowed.
      userId: req.user?.userId
    });
    res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    sendPartyError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Admin CRUD — Operations/Admin via apiAccessPolicy, audited via session user.
// ---------------------------------------------------------------------------

/** GET /api/dahab/admin/parties — including unverified rows. */
dahabPartyRouter.get('/admin/parties', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { parties } = adminListParties();
    res.json({ status: 'success', parties, count: parties.length });
  } catch (err) {
    sendPartyError(res, err);
  }
});

/** POST /api/dahab/admin/parties */
dahabPartyRouter.post('/admin/parties', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actingUser = req.user!.userId;
    const party = adminCreateParty(req.body || {}, actingUser);
    res.status(201).json({ status: 'success', party });
  } catch (err) {
    sendPartyError(res, err);
  }
});

/** PUT /api/dahab/admin/parties/:id */
dahabPartyRouter.put('/admin/parties/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actingUser = req.user!.userId;
    const party = adminUpdateParty(req.params.id, req.body || {}, actingUser);
    res.json({ status: 'success', party });
  } catch (err) {
    sendPartyError(res, err);
  }
});

/** PATCH /api/dahab/admin/parties/:id/license-verified */
dahabPartyRouter.patch('/admin/parties/:id/license-verified', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actingUser = req.user!.userId;
    const verified = Boolean((req.body || {}).verified);
    const party = adminSetLicenseVerified(req.params.id, verified, actingUser);
    res.json({ status: 'success', party });
  } catch (err) {
    sendPartyError(res, err);
  }
});

/** DELETE /api/dahab/admin/parties/:id */
dahabPartyRouter.delete('/admin/parties/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actingUser = req.user!.userId;
    adminDeleteParty(req.params.id, actingUser);
    res.json({ status: 'success', deleted: req.params.id });
  } catch (err) {
    sendPartyError(res, err);
  }
});
