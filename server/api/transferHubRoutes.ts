import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import {
  optionalString,
  optionalEnum,
  optionalCount,
  optionalNumber,
  requiredCount,
  requiredEnum,
  requiredObject,
  requiredString,
  requiredNumber
} from '../middleware/bodyParams';
import { db } from '../db/database';
import { transferHubService, TransferHubError, type HubQuoteInput } from '../services/transferHubService';
import type { BookingEntity } from '../db/schema';
import type { HubLuggage, HubMode, HubTierId, HubTripType } from '../../src/shared/types/transferHub';

/**
 * Future-ride hub. Public reads carry no supplier cost. Lock and cancel take
 * identity from the session. Operations edits live under /operations/transfers.
 */

const TIERS = ['shared', 'private', 'premium'] as const;
const TRIPS = ['one', 'round', 'multi'] as const;
const LUGGAGE = ['small', 'medium', 'large'] as const;
const MODES = ['private', 'bus'] as const;

function sendError(res: Response, err: unknown) {
  const error = err as { status?: number; message?: string; code?: string };
  const status = error?.status || (err instanceof TransferHubError ? err.status : 400);
  return res.status(status).json({ error: error?.message || 'Request could not be processed.', code: error?.code });
}

function quoteInput(body: Record<string, unknown> | undefined): HubQuoteInput {
  const source = body || {};
  const stops = Array.isArray(source.stops) ? source.stops.filter((stop): stop is string => typeof stop === 'string').slice(0, 6) : [];
  const addonIds = Array.isArray(source.addonIds) ? source.addonIds.filter((id): id is string => typeof id === 'string').slice(0, 8) : [];
  return {
    originId: requiredString(source.originId, 'originId', 64),
    destinationId: requiredString(source.destinationId, 'destinationId', 64),
    tierId: requiredEnum(source.tierId, TIERS, 'tierId') as HubTierId,
    tripType: requiredEnum(source.tripType, TRIPS, 'tripType') as HubTripType,
    stops,
    date: requiredString(source.date, 'date', 10),
    time: requiredString(source.time, 'time', 8),
    returnDate: optionalString(source.returnDate, 'returnDate', 10),
    returnTime: optionalString(source.returnTime, 'returnTime', 8),
    passengers: requiredCount(source.passengers, 'passengers', 1, 14),
    luggage: requiredEnum(source.luggage, LUGGAGE, 'luggage') as HubLuggage,
    addonIds,
    mode: requiredEnum(source.mode, MODES, 'mode') as HubMode,
    busScheduleId: optionalString(source.busScheduleId, 'busScheduleId', 64)
  };
}

export const transferHubRouter = Router();

transferHubRouter.get('/transfers/hub', (_req, res) => {
  res.json(transferHubService.catalog());
});

transferHubRouter.get('/transfers/buses', (req, res) => {
  const originId = requiredString(req.query.originId, 'originId', 64);
  res.json({ buses: transferHubService.busesFor(originId) });
});

transferHubRouter.get('/transfers/fleet', (req, res) => {
  try {
    const originId = requiredString(req.query.originId, 'originId', 64);
    const destinationId = requiredString(req.query.destinationId, 'destinationId', 64);
    const tierId = requiredEnum(req.query.tierId, TIERS, 'tierId') as HubTierId;
    res.json(transferHubService.fleet(originId, destinationId, tierId));
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.get('/transfers/drivers/preview', (_req, res) => {
  res.json({ drivers: transferHubService.driverPreview() });
});

transferHubRouter.post('/transfers/quote', (req, res) => {
  try {
    res.json({ quote: transferHubService.quotePublic(quoteInput(req.body)) });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.post('/transfers/lock', (req: AuthenticatedRequest, res) => {
  try {
    const result = transferHubService.lock({
      travelerId: req.user!.userId,
      tripId: requiredString(req.body?.tripId, 'tripId', 64),
      input: quoteInput(req.body),
      expectedSellEGP: requiredNumber(req.body?.expectedSellEGP, 'expectedSellEGP', 1, 1_000_000),
      idempotencyKey: requiredString(req.body?.idempotencyKey, 'idempotencyKey', 128),
      flightNumber: optionalString(req.body?.flightNumber, 'flightNumber', 16)
    });
    res.status(201).json({
      booking: {
        id: result.booking.id,
        bookingRef: result.booking.bookingRef,
        confirmationCode: result.booking.confirmationCode,
        amountEGP: result.booking.amountEGP,
        paymentState: result.booking.paymentState,
        supplierState: result.booking.supplierState,
        scheduledDate: result.booking.scheduledDate,
        scheduledTime: result.booking.scheduledTime,
        freeCancelUntil: result.booking.hubQuote?.freeCancelUntil || null
      },
      quote: result.quote
    });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.post('/transfers/bookings/:id/cancel', (req: AuthenticatedRequest, res) => {
  try {
    const booking = transferHubService.cancel({
      bookingId: req.params.id,
      travelerId: req.user!.userId,
      role: req.user!.role
    });
    res.json({
      booking: {
        id: booking.id,
        bookingRef: booking.bookingRef,
        supplierState: booking.supplierState,
        paymentState: booking.paymentState
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** What a traveller may see of a hub ride: no supplier cost, no internals. */
function hubSummary(booking: BookingEntity) {
  const quote = booking.hubQuote;
  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    confirmationCode: booking.confirmationCode,
    amountEGP: booking.amountEGP,
    paymentState: booking.paymentState,
    supplierState: booking.supplierState,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    freeCancelUntil: quote?.freeCancelUntil || null,
    originLabel: quote?.originLabelEn || null,
    originLabelAr: quote?.originLabelAr || null,
    destinationLabel: quote?.destinationLabelEn || null,
    destinationLabelAr: quote?.destinationLabelAr || null,
    driverName: booking.assignedResource?.driverName || null,
    tripId: booking.tripId
  };
}

/** Only operations can write the route catalog, so every writer is staff. */
function isOps(role?: string): boolean {
  return role === 'Operations' || role === 'Admin';
}

/** The optional price-pair body used by pair upserts and request reviews. */
function pairBody(raw: unknown):
  | { originId: string; destinationId: string; privateEGP: number; sharedEGP?: number; premiumEGP?: number; supplierPrivateEGP?: number; supplierSharedEGP?: number; supplierPremiumEGP?: number; distanceKm?: number; durationEn?: string; durationAr?: string }
  | undefined {
  if (raw === undefined || raw === null) return undefined;
  const body = requiredObject(raw, 'pair');
  return {
    originId: requiredString(body.originId, 'pair.originId', 64),
    destinationId: requiredString(body.destinationId, 'pair.destinationId', 64),
    privateEGP: requiredNumber(body.privateEGP, 'pair.privateEGP', 1, 1_000_000),
    sharedEGP: optionalNumber(body.sharedEGP, 'pair.sharedEGP', 0, 1_000_000),
    premiumEGP: optionalNumber(body.premiumEGP, 'pair.premiumEGP', 0, 1_000_000),
    supplierPrivateEGP: optionalNumber(body.supplierPrivateEGP, 'pair.supplierPrivateEGP', 0, 1_000_000),
    supplierSharedEGP: optionalNumber(body.supplierSharedEGP, 'pair.supplierSharedEGP', 0, 1_000_000),
    supplierPremiumEGP: optionalNumber(body.supplierPremiumEGP, 'pair.supplierPremiumEGP', 0, 1_000_000),
    distanceKm: optionalNumber(body.distanceKm, 'pair.distanceKm', 0, 100_000),
    durationEn: optionalString(body.durationEn, 'pair.durationEn', 32),
    durationAr: optionalString(body.durationAr, 'pair.durationAr', 32)
  };
}

/* --------------------------------------------------------------------------
 * Traveller reads and review requests (private by default: a session is
 * required, and ownership is the trip's owner).
 * ----------------------------------------------------------------------- */

transferHubRouter.get('/transfers/bookings', (req: AuthenticatedRequest, res) => {
  try {
    const all = isOps(req.user!.role);
    res.json({ bookings: transferHubService.bookingsForUser(req.user!.userId, all).map(hubSummary) });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.get('/transfers/bookings/:ref', (req: AuthenticatedRequest, res) => {
  try {
    const ref = requiredString(req.params.ref, 'ref', 64);
    const all = isOps(req.user!.role);
    res.json({ booking: hubSummary(transferHubService.bookingForUser(ref, req.user!.userId, all)) });
  } catch (err) {
    sendError(res, err);
  }
});

/** "This ride is not on the list" — it goes to the operations queue. */
transferHubRouter.post('/transfers/requests', (req: AuthenticatedRequest, res) => {
  try {
    const actor = req.user!;
    const account = db.users.find(row => row.id === actor.userId);
    const request = transferHubService.createRequest(
      { userId: actor.userId, role: actor.role, name: account?.name, phone: account?.phone },
      {
        originLabel: requiredString(req.body?.originLabel, 'originLabel', 120),
        destinationLabel: requiredString(req.body?.destinationLabel, 'destinationLabel', 120),
        originId: optionalString(req.body?.originId, 'originId', 64),
        destinationId: optionalString(req.body?.destinationId, 'destinationId', 64),
        date: optionalString(req.body?.date, 'date', 10),
        time: optionalString(req.body?.time, 'time', 8),
        passengers: optionalCount(req.body?.passengers, 'passengers', 1, 14) || 1,
        luggage: optionalEnum(req.body?.luggage, LUGGAGE, 'luggage') as HubLuggage | undefined,
        notes: optionalString(req.body?.notes, 'notes', 500)
      }
    );
    res.status(201).json({ request });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.get('/transfers/requests', (req: AuthenticatedRequest, res) => {
  try {
    const all = isOps(req.user!.role);
    const requests = all ? transferHubService.listRequests() : transferHubService.requestsForUser(req.user!.userId);
    res.json({ requests });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.post('/operations/transfers/quote', (req, res) => {
  try {
    res.json({ quote: transferHubService.quoteOps(quoteInput(req.body)) });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.get('/operations/transfers/catalog', (_req, res) => {
  res.json(transferHubService.opsCatalog());
});

transferHubRouter.put('/operations/transfers/zones/:id', (req, res) => {
  try {
    res.json({ zone: transferHubService.updateZone(req.params.id, req.body || {}) });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.put('/operations/transfers/buses/:id', (req, res) => {
  try {
    res.json({ bus: transferHubService.updateBus(req.params.id, req.body || {}) });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.post('/operations/transfers/buses', (req, res) => {
  try {
    const originId = requiredString(req.body?.originId, 'originId', 64);
    res.status(201).json({ bus: transferHubService.addBus(originId) });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.put('/operations/transfers/drivers/:id', (req, res) => {
  try {
    transferHubService.updateDriver(req.params.id, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.post('/operations/transfers/assign', (req, res) => {
  try {
    const booking = transferHubService.assignDriver(
      requiredString(req.body?.bookingId, 'bookingId', 64),
      requiredString(req.body?.driverId, 'driverId', 64)
    );
    res.json({
      bookingRef: booking.bookingRef,
      driverName: booking.assignedResource?.driverName || null,
      supplierState: booking.supplierState
    });
  } catch (err) {
    sendError(res, err);
  }
});

/* --------------------------------------------------------------------------
 * Route catalog writes (operations): publish a city, a destination, or an
 * explicit price pair. Every route below is /api/operations/*, which
 * apiAccessPolicy gates to Operations and Admin.
 * ----------------------------------------------------------------------- */

/** Publish a new origin city with its own price matrix. */
transferHubRouter.post('/operations/transfers/zones', (req: AuthenticatedRequest, res) => {
  try {
    const zone = transferHubService.addZone({ userId: req.user!.userId, role: req.user!.role }, {
      id: requiredString(req.body?.id, 'id', 32),
      labelEn: requiredString(req.body?.labelEn, 'labelEn', 80),
      labelAr: requiredString(req.body?.labelAr, 'labelAr', 80),
      subEn: optionalString(req.body?.subEn, 'subEn', 80),
      subAr: optionalString(req.body?.subAr, 'subAr', 80),
      regionEn: optionalString(req.body?.regionEn, 'regionEn', 80),
      privateEGP: requiredNumber(req.body?.privateEGP, 'privateEGP', 1, 1_000_000),
      sharedEGP: optionalNumber(req.body?.sharedEGP, 'sharedEGP', 0, 1_000_000),
      busEGP: optionalNumber(req.body?.busEGP, 'busEGP', 0, 1_000_000),
      supplierPrivateEGP: optionalNumber(req.body?.supplierPrivateEGP, 'supplierPrivateEGP', 0, 1_000_000),
      distanceKm: optionalNumber(req.body?.distanceKm, 'distanceKm', 0, 100_000),
      durationEn: optionalString(req.body?.durationEn, 'durationEn', 32),
      durationAr: optionalString(req.body?.durationAr, 'durationAr', 32),
      haul: optionalEnum(req.body?.haul, ['short', 'long'] as const, 'haul')
    });
    res.status(201).json({ zone });
  } catch (err) {
    sendError(res, err);
  }
});

/** Publish a destination (a city, a resort town, a Dahab micro-zone). */
transferHubRouter.post('/operations/transfers/destinations', (req: AuthenticatedRequest, res) => {
  try {
    const kind = requiredEnum(req.body?.kind, ['zone', 'area'] as const, 'kind');
    const destination = transferHubService.addDestination({ userId: req.user!.userId, role: req.user!.role }, {
      id: requiredString(req.body?.id, 'id', 32),
      labelEn: requiredString(req.body?.labelEn, 'labelEn', 80),
      labelAr: requiredString(req.body?.labelAr, 'labelAr', 80),
      subEn: optionalString(req.body?.subEn, 'subEn', 80),
      subAr: optionalString(req.body?.subAr, 'subAr', 80),
      kind,
      priceAddEGP: optionalNumber(req.body?.priceAddEGP, 'priceAddEGP', 0, 100_000)
    });
    res.status(201).json({ destination });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.patch('/operations/transfers/destinations/:id', (req: AuthenticatedRequest, res) => {
  try {
    const destination = transferHubService.updateDestination(
      requiredString(req.params.id, 'id', 64),
      req.body || {},
      { userId: req.user!.userId, role: req.user!.role }
    );
    res.json({ destination });
  } catch (err) {
    sendError(res, err);
  }
});

/** Publish (or replace) an explicit origin→destination price pair. */
transferHubRouter.post('/operations/transfers/pairs', (req: AuthenticatedRequest, res) => {
  try {
    const pair = pairBody(req.body?.pair ?? req.body);
    if (!pair) throw new TransferHubError('A pair needs an origin, a destination and a private price.', 400, 'BAD_REQUEST');
    const saved = transferHubService.addPair({ userId: req.user!.userId, role: req.user!.role }, pair);
    res.status(201).json({ pair: saved });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.patch('/operations/transfers/pairs/:id', (req: AuthenticatedRequest, res) => {
  try {
    const pair = transferHubService.updatePair(
      requiredString(req.params.id, 'id', 64),
      req.body || {},
      { userId: req.user!.userId, role: req.user!.role }
    );
    res.json({ pair });
  } catch (err) {
    sendError(res, err);
  }
});

transferHubRouter.get('/operations/transfers/pairs', (_req, res) => {
  res.json({ pairs: transferHubService.listPairs() });
});

/** The "we cannot price this yet" queue. */
transferHubRouter.get('/operations/transfers/requests', (req: AuthenticatedRequest, res) => {
  try {
    const status = optionalEnum(req.query.status, ['PENDING_REVIEW', 'ACCEPTED', 'DECLINED'] as const, 'status');
    res.json({ requests: transferHubService.listRequests(status) });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * Accepting a request with a price publishes the pair, so the route quotes like
 * any other from then on and the traveller is not told "review forever".
 */
transferHubRouter.post('/operations/transfers/requests/:id/review', (req: AuthenticatedRequest, res) => {
  try {
    const decision = requiredEnum(req.body?.decision, ['ACCEPT', 'DECLINE'] as const, 'decision');
    const request = transferHubService.reviewRequest(
      requiredString(req.params.id, 'id', 64),
      { userId: req.user!.userId, role: req.user!.role },
      {
        decision,
        note: optionalString(req.body?.note, 'note', 500),
        pair: pairBody(req.body?.pair)
      }
    );
    res.json({ request });
  } catch (err) {
    sendError(res, err);
  }
});
