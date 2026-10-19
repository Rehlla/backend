import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './correlationMiddleware';
import { sharedAcquire, sharedCollectGarbage } from './rateLimitStore';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired windows every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
    // Opportunistic GC for the shared store (no-op unless configured).
    sharedCollectGarbage();
  }, 60000).unref();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identifier = req.user?.userId || req.ip || req.socket.remoteAddress || 'anonymous';
    // Bucket per route per actor. req.baseUrl alone is the '/api' mount point
    // for every API route — keying on it collapsed the whole API into ONE
    // shared 300/min bucket per user, so a busy admin console ate 429s on
    // unrelated routes (and the app renders those as "signed out").
    const route = `${req.baseUrl || ''}${req.path || ''}` || req.originalUrl.split('?')[0];
    const key = `${route}:${identifier}`;
    const now = Date.now();

    // Shared buckets first (multi-process truth when RATE_LIMIT_STORE=sqlite).
    // Fail-open fallback: when unconfigured or on store error sharedAcquire
    // returns null and we fall through to the in-memory map below. A limiter
    // must never 500 legitimate traffic because its store hiccuped — briefly
    // under-counting only weakens abuse protection, while failing closed
    // turns a storage hiccup into a self-inflicted outage.
    const shared = sharedAcquire(key, options.windowMs, options.maxRequests);
    if (shared) {
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', shared.remaining);
      res.setHeader('X-RateLimit-Reset', shared.resetSec);
      if (!shared.allowed) {
        const retryAfterSec = Math.max(0, shared.resetSec - Math.ceil(now / 1000));
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
          type: 'https://dahab.travel/errors/rate-limit-exceeded',
          title: 'Too Many Requests',
          status: 429,
          detail: options.message || `Rate limit exceeded. Please retry in ${retryAfterSec} seconds.`,
          instance: req.originalUrl,
          correlationId: req.correlationId,
          retryAfter: retryAfterSec
        });
      }
      return next();
    }

    let record = store.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + options.windowMs
      };
      store.set(key, record);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      return res.status(429).json({
        type: 'https://dahab.travel/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: options.message || `Rate limit exceeded. Please retry in ${retryAfterSec} seconds.`,
        instance: req.originalUrl,
        correlationId: req.correlationId,
        retryAfter: retryAfterSec
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', options.maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    next();
  };
}

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
  message: 'API rate limit exceeded. Please slow down your requests.'
});

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Too many authentication attempts. Please wait a minute before trying again.'
});

// DayGI message feedback accepts anonymous travelers (identity falls back to
// a client-generated id), so this route gets a tight bucket of its own rather
// than the shared 300/min API budget. Keyed per route per user/IP by the
// shared limiter — a spoofable body id must never become the limiting key.
export const daygiFeedbackLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Too many feedback submissions. Please wait a minute before trying again.'
});
