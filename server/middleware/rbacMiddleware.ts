import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './correlationMiddleware';
import { hasPermission } from '../services/permissionService';

export function requireRole(...allowedRoles: Array<'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        type: 'https://dahab.travel/errors/unauthorized',
        title: 'Authentication Required',
        status: 401,
        detail: 'Authentication is required before role authorization.',
        instance: req.originalUrl,
        correlationId: req.correlationId
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        type: 'https://dahab.travel/errors/forbidden',
        title: 'Forbidden Resource',
        status: 403,
        detail: 'Your account does not have permission to access this resource.',
        instance: req.originalUrl,
        correlationId: req.correlationId
      });
    }

    next();
  };
}

/**
 * Permission-key authorization (docs/OPS_API_CONTRACT.md). Every listed key
 * is required. Same RFC7807 shapes as requireRole. Role grants, per-user
 * overrides (deny wins) and Admin `*` are resolved by permissionService.
 */
export function requirePermission(...keys: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        type: 'https://dahab.travel/errors/unauthorized',
        title: 'Authentication Required',
        status: 401,
        detail: 'Authentication is required before permission authorization.',
        instance: req.originalUrl,
        correlationId: req.correlationId
      });
    }
    const subject = { userId: req.user.userId, role: req.user.role };
    if (!keys.every(k => hasPermission(subject, k))) {
      return res.status(403).json({
        type: 'https://dahab.travel/errors/forbidden',
        title: 'Forbidden Resource',
        status: 403,
        detail: 'Your account does not have permission to access this resource.',
        instance: req.originalUrl,
        correlationId: req.correlationId
      });
    }
    next();
  };
}
