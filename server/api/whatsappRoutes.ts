import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import {
  optionalString,
  requiredEnum,
  requiredString
} from '../middleware/bodyParams';
import {
  whatsappGatewayService,
  WhatsAppTransportError
} from '../services/whatsappGatewayService';

/**
 * /api/operations/whatsapp - the WhatsApp transport's operations surface.
 *
 * Operations-only by apiAccessPolicy (the /operations prefix is gated). Nothing
 * here sends to a traveller directly except the deliberate test message, which
 * is audited and takes its text from the request so an operator can see exactly
 * what would have left.
 */

export const whatsappRouter = Router();

function sendError(res: Response, err: unknown) {
  const error = err as { status?: number; message?: string; code?: string };
  res.status(error?.status || (err instanceof WhatsAppTransportError ? 400 : 500)).json({
    error: error?.message || 'Request could not be processed.',
    ...(err instanceof WhatsAppTransportError ? { code: err.code } : {})
  });
}

function actor(req: AuthenticatedRequest) {
  return { userId: req.user!.userId, role: req.user!.role };
}

/** GET /api/operations/whatsapp/sessions — linked numbers. */
whatsappRouter.get('/sessions', (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      sessions: whatsappGatewayService.listSessions(),
      enabled: (process.env.OPENWA_ENABLED || '').toLowerCase() === 'true'
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * POST /api/operations/whatsapp/sessions — link a new number.
 *
 * Creates the OpenWA session, records our row, and starts it so the QR exists
 * by the time this response is read.
 */
whatsappRouter.post('/sessions', (req: AuthenticatedRequest, res) => {
  try {
    const purpose = requiredEnum(req.body?.purpose, ['traveler', 'driver', 'support', 'system'] as const, 'purpose');
    const session = whatsappGatewayService.linkSession({
      label: requiredString(req.body?.label, 'label', 80),
      phone: requiredString(req.body?.phone, 'phone', 32),
      purpose,
      isDefault: req.body?.isDefault === true,
      note: optionalString(req.body?.note, 'note', 300)
    });
    res.status(201).json({ session });
  } catch (err) {
    sendError(res, err);
  }
});

/** PATCH /api/operations/whatsapp/sessions/:id — label, purpose, default, active. */
whatsappRouter.patch('/sessions/:id', (req: AuthenticatedRequest, res) => {
  try {
    const patch: Record<string, unknown> = {};
    if (req.body?.label !== undefined) patch.label = req.body.label;
    if (req.body?.note !== undefined) patch.note = req.body.note;
    if (req.body?.purpose !== undefined && ['traveler', 'driver', 'support', 'system'].includes(String(req.body.purpose))) {
      patch.purpose = req.body.purpose;
    }
    if (req.body?.phone !== undefined) patch.phone = req.body.phone;
    if (req.body?.isDefault !== undefined) patch.isDefault = req.body.isDefault === true;
    if (req.body?.active !== undefined) patch.active = req.body.active === true;
    res.json({ session: whatsappGatewayService.updateSession(requiredString(req.params.id, 'id', 64), patch as never, actor(req).userId) });
  } catch (err) {
    sendError(res, err);
  }
});

/** POST /api/operations/whatsapp/sessions/:id/refresh — ask OpenWA for the live status (and QR). */
whatsappRouter.post('/sessions/:id/refresh', (req: AuthenticatedRequest, res) => {
  try {
    whatsappGatewayService.refreshSession(requiredString(req.params.id, 'id', 64)).then(session => res.json({ session }));
  } catch (err) {
    sendError(res, err);
  }
});

/** GET /api/operations/whatsapp/messages — the outbox, for the console. */
whatsappRouter.get('/messages', (req: AuthenticatedRequest, res) => {
  try {
    const status = typeof req.query.status === 'string' ? String(req.query.status) : undefined;
    const purpose = typeof req.query.purpose === 'string' ? String(req.query.purpose) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json({
      messages: whatsappGatewayService.listMessages({
        limit,
        status: status as never,
        purpose: purpose as never
      })
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * POST /api/operations/whatsapp/test — send one message through the transport.
 *
 * Deliberately narrow: one recipient, operator-supplied text, audited. It is
 * how an operator proves the number works before routing real traffic to it.
 */
whatsappRouter.post('/test', (req: AuthenticatedRequest, res) => {
  try {
    const purpose = requiredEnum(req.body?.purpose, ['traveler', 'driver', 'support', 'system'] as const, 'purpose');
    const queued = whatsappGatewayService.enqueue({
      to: requiredString(req.body?.phone, 'phone', 32),
      purpose,
      body: requiredString(req.body?.body, 'body', 1000)
    });
    whatsappGatewayService.sendMessage(queued.id).then(sent => {
      res.json({ message: sent });
    }, () => {
      // enqueue() already recorded the outcome; re-read rather than throw.
      res.json({ message: whatsappGatewayService.listMessages({ limit: 1 })[0] });
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** POST /api/operations/whatsapp/dispatch — drain the outbox now. */
whatsappRouter.post('/dispatch', (req: AuthenticatedRequest, res) => {
  try {
    whatsappGatewayService.dispatchDue().then(count => res.json({ dispatched: count }));
  } catch (err) {
    sendError(res, err);
  }
});
