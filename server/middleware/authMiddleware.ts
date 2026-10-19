import { Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AuthenticatedRequest } from './correlationMiddleware';

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // The SPA authenticates purely by HttpOnly cookie and never sets this header.
  // Reading only the header meant this middleware rejected every legitimate
  // browser session while still accepting a token lifted from Set-Cookie by a
  // scripted client — the control was effectively inverted.
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  if (!authHeader && !cookieHeader) {
    return res.status(401).json({
      type: 'https://dahab.travel/errors/unauthorized',
      title: 'Authentication Required',
      status: 401,
      detail: 'No session cookie or Authorization header was supplied.',
      instance: req.originalUrl,
      correlationId: req.correlationId
    });
  }

  const authResult = authService.validateToken(authHeader, cookieHeader);
  if (!authResult) {
    return res.status(401).json({
      type: 'https://dahab.travel/errors/invalid-token',
      title: 'Invalid or Expired Token',
      status: 401,
      detail: 'The provided session token is invalid or has expired.',
      instance: req.originalUrl,
      correlationId: req.correlationId
    });
  }

  req.user = {
    userId: authResult.user.id,
    email: authResult.user.email,
    name: authResult.user.name,
    role: authResult.user.role as any,
    supplierId: (authResult.user as any).supplierId
  };

  next();
}

// requireRole lives in ./rbacMiddleware. A second, subtly different copy used to
// exist here; two authorization primitives with different semantics is exactly
// the kind of thing that gets applied to the wrong route.

/**
 * Populates req.user when a valid session exists, without requiring one.
 * Mounted globally so the rate limiter can key on a real user id, and so
 * handlers can scope results to the caller when there is one.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authResult = authService.validateToken(req.headers.authorization, req.headers.cookie);
  if (authResult) {
    req.user = {
      userId: authResult.user.id,
      email: authResult.user.email,
      name: authResult.user.name,
      role: authResult.user.role as any,
      supplierId: authResult.user.supplierId
    };
  }
  next();
}

