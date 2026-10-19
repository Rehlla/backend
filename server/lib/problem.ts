import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/correlationMiddleware';

/**
 * RFC7807 problem response in the shape the rest of the API already uses
 * (rbacMiddleware / apiAccessPolicy): { type, title, status, detail, instance, correlationId }.
 * `slug` becomes https://dahab.travel/errors/<slug>.
 */
export function sendProblem(
  req: AuthenticatedRequest,
  res: Response,
  status: number,
  slug: string,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {}
) {
  return res.status(status).json({
    type: `https://dahab.travel/errors/${slug}`,
    title,
    status,
    detail,
    instance: req.originalUrl,
    correlationId: req.correlationId,
    ...extra,
  });
}

/** An Error that route handlers can throw with an HTTP status. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public slug = status === 404 ? 'not-found' : 'bad-request') {
    super(message);
  }
}
