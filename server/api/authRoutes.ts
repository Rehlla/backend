import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { authService } from '../services/authService';
import { firebaseAdminService } from '../services/firebaseAdminService';
import { nativeAuthService } from '../services/nativeAuthService';
import { resolve as resolvePermissions } from '../services/permissionService';
import { flagService } from '../services/flagService';
import { wantsBearerToken } from '../middleware/nativeClient';
import { authRateLimiter } from '../middleware/rateLimiter';
import { idempotency } from '../middleware/idempotency';
import { currentSession } from '../middleware/viewAs';
import { optionalString, InvalidRequestBodyError } from '../middleware/bodyParams';
import type { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import type { SessionEntity } from '../db/schema';

/**
 * /api/auth/* — moved verbatim out of server.ts (paths, middleware and
 * behaviour unchanged), plus the native token additions from
 * docs/OPS_API_CONTRACT.md: refresh-token rotation, device sessions, and
 * `permissions` + `flags` on login and /me.
 *
 * Mounted at /api/auth in server.ts at the position the inline routes held,
 * i.e. after optionalAuth, the rate limiter and apiAccessPolicy.
 */
export const authRouter = Router();

/** permissions + flags for a session payload (login, /me). */
function accessPayload(user: { id: string; role: string }) {
  const subject = { userId: user.id, role: user.role as any };
  return { permissions: resolvePermissions(subject), flags: flagService.evaluateAll(subject) };
}

/**
 * Native logins get a device session: the legacy session token is tied to
 * it, and an access/refresh pair is issued. The website gets nothing here.
 */
function nativeTokens(req: Request, session: SessionEntity, user: { id: string; role: string }) {
  if (!wantsBearerToken(req)) return {};
  const device = nativeAuthService.createDeviceSession(user.id, req.body?.device);
  db.runInTransaction(() => {
    session.deviceSessionId = device.id;
  });
  return nativeAuthService.issueTokens(user.id, user.role, device.id);
}

authRouter.post('/register', authRateLimiter, (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    // New self-service accounts are always Traveler. Roles like Admin/Ops are
    // provisioned through gated/seeded paths only, never from the request body.
    const result = authService.register(name, email, phone || '', password, 'Traveler');
    const isProd = process.env.NODE_ENV === 'production';
    const secureFlag = isProd ? '; Secure' : '';
    res.setHeader('Set-Cookie', `dahab_auth_token=${result.session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=259200${secureFlag}`);
    const safeSession = {
      id: result.session.id,
      userId: result.session.userId,
      role: result.session.role,
      expiresAt: result.session.expiresAt
    };
    // The Flutter app is not a browser and asks for the token explicitly
    // (nativeClient.ts). The website never receives it.
    res.json({ success: true, user: result.user, session: wantsBearerToken(req) ? { ...safeSession, token: result.session.token } : safeSession });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/login', authRateLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = authService.login(email, password);
    const isProd = process.env.NODE_ENV === 'production';
    const secureFlag = isProd ? '; Secure' : '';
    res.setHeader('Set-Cookie', `dahab_auth_token=${result.session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=259200${secureFlag}`);
    const safeSession = {
      id: result.session.id,
      userId: result.session.userId,
      role: result.session.role,
      expiresAt: result.session.expiresAt
    };
    // The Flutter app is not a browser and asks for the token explicitly
    // (nativeClient.ts). The website never receives it.
    const tokens = nativeTokens(req, result.session, result.user);
    res.json({
      success: true,
      user: result.user,
      session: wantsBearerToken(req) ? { ...safeSession, token: result.session.token } : safeSession,
      ...tokens,
      ...accessPayload(result.user),
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

/**
 * POST /api/auth/refresh — native only, public (the refresh token is the
 * credential). Rotates on every use; reuse revokes the device family.
 */
authRouter.post('/refresh', authRateLimiter, (req: AuthenticatedRequest, res) => {
  try {
    const tokens = nativeAuthService.refresh(String(req.body?.refreshToken || ''), req.correlationId);
    res.json(tokens);
  } catch (err: any) {
    res.status(err.status || 401).json({
      type: 'https://dahab.travel/errors/invalid-token',
      title: 'Invalid Refresh Token',
      status: err.status || 401,
      detail: err.message,
      instance: req.originalUrl,
      correlationId: req.correlationId,
    });
  }
});

authRouter.get('/me', (req, res) => {
  // No presented credential at all is the anonymous first-visit probe, not an
  // error: the client runs this check on every load while logged out, and the
  // browser logs any 4xx as a console error. Answer 200 with an empty user —
  // the client already treats a missing user as "signed out". A presented but
  // invalid/expired token stays a 401: that one is a real signal.
  const authCookiePresented = /(?:^|;\s*)dahab_auth_token=/.test(req.headers.cookie || '');
  const hasCredentials = Boolean(req.headers.authorization || authCookiePresented);
  const sessionData = authService.validateToken(req.headers.authorization, req.headers.cookie);
  if (!sessionData) {
    if (!hasCredentials) {
      return res.json({ user: null, session: null, permissions: null, flags: {} });
    }
    // Expired token: clear the stale cookie so this 401 happens once, not on
    // every page load until the visitor manually clears cookies. Mirrors the
    // login cookie's attributes (Path/HttpOnly/SameSite, Secure in prod) with
    // Max-Age=0 — the browser then drops it and the next load is a clean
    // anonymous 200.
    const isProdClear = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `dahab_auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProdClear}`);
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
  // View-as: the session reads as the target user (read-only); say so.
  let user = sessionData.user;
  let viewAs: { userId: string; email: string } | undefined;
  const va = sessionData.session.viewAs;
  if (va) {
    const target = authService.getUserById(va.userId);
    if (target) {
      user = target;
      viewAs = { userId: target.id, email: target.email };
    }
  }
  const extra = { ...accessPayload(user), ...(viewAs ? { viewAs } : {}) };
  // Same rule as login: only native clients get the raw token back.
  // The website relies on the HttpOnly cookie and must never see it.
  if (wantsBearerToken(req)) return res.json({ ...sessionData, user, ...extra });
  const { token: _token, viewAs: _va, ...safeSession } = sessionData.session as any;
  res.json({ ...sessionData, user, session: safeSession, ...extra });
});

/**
 * PUT /api/auth/profile — edits the signed-in reader's own record.
 *
 * Identity comes from the session (never the body), matching the /me rule.
 * Two non-credential fields are accepted: name and phone. Email is excluded —
 * it is the login identifier and needs a dedicated verification flow, so a
 * client that sends it gets an explicit 400 rather than a silent no-op.
 * View-as sessions are read-only by design and are refused here: an operator
 * browsing as a traveler must not be able to edit that traveler's record.
 */
authRouter.put('/profile', (req, res) => {
  const sessionData = authService.validateToken(req.headers.authorization, req.headers.cookie);
  if (!sessionData) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
  if (sessionData.session.viewAs) {
    return res.status(403).json({ error: 'View-as sessions are read-only.' });
  }
  try {
    const body = (typeof req.body === 'object' && req.body !== null)
      ? req.body as Record<string, unknown>
      : {};
    if (body.name === undefined && body.phone === undefined) {
      return res.status(400).json({ error: 'Nothing to update: send "name" and/or "phone".' });
    }
    // An explicit "" must mean "clear the field", not "leave it as is" —
    // `optionalString` alone maps '' to undefined, which made an honest
    // "remove this phone number" impossible to tell from "not sending it".
    const user = authService.updateProfile(
      sessionData.user.id,
      {
        name: body.name === undefined ? undefined : optionalString(body.name, 'name', 120),
        phone: body.phone === undefined
          ? undefined
          : (body.phone === '' ? '' : optionalString(body.phone, 'phone', 24)),
      },
      { role: sessionData.session.role || sessionData.user.role }
    );
    res.json({ success: true, user });
  } catch (err) {
    if (err instanceof InvalidRequestBodyError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not update the profile.' });
  }
});

authRouter.post('/logout', (req, res) => {
  const success = authService.logout(req.headers.authorization, req.headers.cookie);
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  res.setHeader('Set-Cookie', `dahab_auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag}`);
  res.json({ success, message: success ? 'Logged out successfully.' : 'No active session found.' });
});

authRouter.post('/logout-all', (req, res) => {
  const sessionData = authService.validateToken(req.headers.authorization, req.headers.cookie);
  if (!sessionData) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const count = authService.revokeAllSessions(sessionData.user.id);
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  res.setHeader('Set-Cookie', `dahab_auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag}`);
  res.json({ success: true, revokedCount: count, message: `Revoked ${count} active sessions.` });
});

/**
 * Exchanges a Firebase ID token for a server session cookie.
 *
 * The token is verified against Google's public keys. Identity comes from the
 * verified token and the role comes from the stored user record — the request
 * body is not trusted for either. Previously this endpoint accepted
 * { uid, email, role } directly, which let anyone mint an Admin session.
 */
authRouter.post('/firebase-session', authRateLimiter, async (req, res) => {
  try {
    const headerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const idToken = headerToken || (typeof req.body?.idToken === 'string' ? req.body.idToken : '');

    if (!idToken) {
      return res.status(401).json({
        error: 'A Firebase ID token is required (Authorization: Bearer <token>).'
      });
    }

    if (!(await firebaseAdminService.verifyConfiguration())) {
      return res.status(503).json({
        error: 'Federated sign-in is unavailable: the server cannot verify Firebase tokens.'
      });
    }

    const identity = await firebaseAdminService.verifyIdToken(idToken);
    if (!identity) {
      return res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
    }

    const result = authService.syncFirebaseUserSession(
      identity.uid,
      identity.email || '',
      identity.displayName || undefined,
      identity.emailVerified
    );

    const isProd = process.env.NODE_ENV === 'production';
    const secureFlag = isProd ? '; Secure' : '';
    res.setHeader('Set-Cookie', `dahab_auth_token=${result.session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=259200${secureFlag}`);
    const safeSession = {
      id: result.session.id,
      userId: result.session.userId,
      role: result.session.role,
      expiresAt: result.session.expiresAt
    };
    // The Flutter app is not a browser and asks for the token explicitly
    // (nativeClient.ts). The website never receives it.
    res.json({ success: true, user: result.user, session: wantsBearerToken(req) ? { ...safeSession, token: result.session.token } : safeSession });
  } catch (err: any) {
    console.error('[auth/firebase-session]', err);
    res.status(400).json({ error: 'Could not establish a session.' });
  }
});

/** GET /api/auth/devices — the caller's own native device sessions. */
authRouter.get('/devices', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
  const current = currentSession(req)?.deviceSessionId;
  res.json({ items: nativeAuthService.listDevices(req.user.userId, current) });
});

/** DELETE /api/auth/devices/:id — sign one of the caller's devices out. */
authRouter.delete('/devices/:id', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
  const ok = nativeAuthService.revokeOwnDevice(req.user.userId, req.params.id, req.correlationId);
  if (!ok) return res.status(404).json({ error: 'Device not found.' });
  res.json({ success: true });
});

/**
 * POST /api/devices — registers an FCM token for the current device session.
 * Mounted at /api/devices.
 */
export const devicesRouter = Router();

devicesRouter.post('/', idempotency, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
  const fcmToken = typeof req.body?.fcmToken === 'string' ? req.body.fcmToken.trim() : '';
  if (!fcmToken || fcmToken.length > 4096) return res.status(400).json({ error: 'fcmToken is required.' });
  const device = nativeAuthService.registerPushDevice(req.user.userId, currentSession(req)?.deviceSessionId, fcmToken, req.body?.platform);
  res.status(201).json({ id: device.id, platform: device.platform, deviceSessionId: device.deviceSessionId ?? null });
});
