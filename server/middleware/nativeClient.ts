import type { Request } from 'express';

/**
 * Session transport for the Flutter mobile app (docs/MOBILE_APP.md).
 *
 * The website authenticates with the HttpOnly `dahab_auth_token` cookie and
 * never sees the token itself. The Flutter app is an HTTP client, not a
 * browser: it asks for the token in the auth response body by sending
 * `X-Dahab-Client: native`, keeps it in the platform keychain, and sends it
 * back as `Authorization: Bearer <token>` (optionalAuth already accepts it).
 *
 * The website never sends the header, so a script injected into the site
 * still cannot read the session it runs under; it could only obtain a token
 * for credentials it already holds.
 */
export function wantsBearerToken(req: Request): boolean {
  return String(req.headers['x-dahab-client'] || '').toLowerCase() === 'native';
}
