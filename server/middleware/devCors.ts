import type { NextFunction, Request, Response } from 'express';

/**
 * Cross-origin access for local app previews ONLY.
 *
 * The website is same-origin and needs no CORS. The Flutter app's web preview
 * (`dahab-mobile`, served on its own localhost port) is a different origin,
 * so without this the browser blocks every API call and image it makes.
 * Native builds are not browsers and are unaffected either way.
 *
 * Opt-in and narrow on purpose:
 * - off unless `DEV_CORS_ORIGINS` lists exact origins (comma-separated);
 * - never in production, whatever the variable says;
 * - no `Access-Control-Allow-Credentials`: the preview authenticates with a
 *   Bearer token (X-Dahab-Client: native), so the session cookie is never
 *   exposed cross-origin.
 */
export function devCorsOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  if (env.NODE_ENV === 'production') return new Set();
  return new Set(
    String(env.DEV_CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)),
  );
}

export function devCors(origins: Set<string> = devCorsOrigins()) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Every response varies by Origin while this is on: otherwise the browser
    // reuses a cached same-origin (website) response, which has no CORS
    // header, for the preview's request to the same URL.
    res.vary('Origin');
    const origin = req.headers.origin;
    if (!origin || !origins.has(origin)) return next();
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dahab-Client, Accept-Language');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
    next();
  };
}
