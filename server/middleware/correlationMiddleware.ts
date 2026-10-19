import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  correlationId?: string;
  user?: {
    userId: string;
    email: string;
    name: string;
    role: 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';
    /** Set for Supplier accounts; scopes supplier actions to one business. */
    supplierId?: string;
  };
}

export function correlationMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || `req-${crypto.randomUUID()}`;
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
