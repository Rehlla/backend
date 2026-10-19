import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './correlationMiddleware';
import { log } from '../services/structuredLogger';

export function errorHandler(err: any, req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // body-parser / express.json() raises `entity.too.large` (413) when the
  // request body exceeds the configured limit. Express's default handler
  // would render this as an HTML page; we must return JSON so the CMS
  // dashboard's base64 error path can surface it via `cmsFetch`.
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413)) {
    const correlationIdEarly = (req as AuthenticatedRequest).correlationId || 'unknown';
    log.error('http', 'payload too large', {
      correlationId: correlationIdEarly,
      method: req.method,
      path: req.originalUrl,
      status: 413,
      error: err.message || String(err),
      stack: err.stack,
    });
    if (res.headersSent) return next(err);
    return res.status(413).json({
      type: 'https://dahab.travel/errors/payload-too-large',
      title: 'Payload Too Large',
      status: 413,
      detail: err.message || 'Request body too large.',
      instance: req.originalUrl,
      correlationId: correlationIdEarly,
      timestamp: new Date().toISOString(),
    });
  }

  const status = err.status || err.statusCode || 500;
  const correlationId = req.correlationId || 'unknown';

  log.error('http', 'request error', {
    correlationId,
    method: req.method,
    path: req.originalUrl,
    status,
    error: err.message || String(err),
    stack: err.stack,
  });

  // Client errors (4xx) are the caller's own fault and safe to describe.
  // Server errors (5xx) may carry stack frames, file paths, SQL, or secrets in
  // their message, so return a generic detail and let the correlationId be the
  // link to the full server-side log.
  const isClientError = status >= 400 && status < 500;
  const detail = isClientError
    ? err.message || 'The request could not be processed.'
    : 'An unexpected error occurred while processing your request.';

  const responseBody = {
    type: err.type || 'https://dahab.travel/errors/internal-server-error',
    title: err.title || (isClientError ? 'Request Error' : 'Internal Server Error'),
    status,
    detail,
    instance: req.originalUrl,
    correlationId,
    timestamp: new Date().toISOString()
  };

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json(responseBody);
}
