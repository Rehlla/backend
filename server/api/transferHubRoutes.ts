import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import {
  optionalString,
  requiredCount,
  requiredEnum,
  requiredString,
  requiredNumber
} from '../middleware/bodyParams';
import { transferHubService, TransferHubError, type HubQuoteInput } from '../services/transferHubService';
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
