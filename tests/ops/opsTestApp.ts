import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { db } from '../../server/db/database';
import { authService } from '../../server/services/authService';
import { correlationMiddleware } from '../../server/middleware/correlationMiddleware';
import { optionalAuth } from '../../server/middleware/authMiddleware';
import { viewAsMiddleware } from '../../server/middleware/viewAs';
import { apiAccessPolicy } from '../../server/middleware/apiAccessPolicy';
import { maintenanceGate, killSwitchGate } from '../../server/middleware/controlGates';
import { authRouter, devicesRouter } from '../../server/api/authRoutes';
import { operationsRouter } from '../../server/api/operationsRoutes';
import { adminAccessRouter } from '../../server/api/adminAccessRoutes';
import { adminControlRouter } from '../../server/api/adminControlRoutes';
import { configRouter } from '../../server/api/configRoutes';
import { staffRealtimeRouter } from '../../server/api/staffRealtimeRoutes';
import type { UserEntity } from '../../server/db/schema';

/**
 * The staff control plane over real HTTP, wired in the same order as
 * server.ts: correlation → optionalAuth → viewAs → apiAccessPolicy →
 * maintenance → kill switches → routers. Sessions are real (authService),
 * so cookie, Bearer, suspension and view-as behave exactly as in production.
 *
 * `extra` mounts more routes after the gates (e.g. a stand-in for an inline
 * server.ts route that a kill switch covers).
 */
export interface OpsTestServer {
  base: string;
  close: () => Promise<void>;
}

export async function startOpsApp(extra?: (app: express.Express) => void): Promise<OpsTestServer> {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(optionalAuth);
  app.use(viewAsMiddleware);
  app.use('/api', apiAccessPolicy);
  app.use('/api', maintenanceGate);
  app.use('/api', killSwitchGate);
  app.use('/api/admin', adminAccessRouter);
  app.use('/api/admin', adminControlRouter);
  app.use('/api/config', configRouter);
  app.use('/api', staffRealtimeRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/operations', operationsRouter);
  extra?.(app);
  app.set('sseHeartbeatMs', 60_000);
  let server!: Server;
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    close: () => new Promise<void>(resolve => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

export const PASSWORD = 'ops-test-password-123456';
let seq = 0;

/** Creates a user row with a real scrypt password. */
export function createUser(role: UserEntity['role'], over: Partial<UserEntity> = {}): UserEntity {
  seq++;
  const salt = authService.generateSalt();
  const now = new Date().toISOString();
  const user: UserEntity = {
    id: `USR-T-${role}-${seq}`,
    email: `${role.toLowerCase()}${seq}@ops.test`,
    name: `${role} ${seq}`,
    phone: `+2010000${String(seq).padStart(5, '0')}`,
    passwordHash: authService.hashPasswordScrypt(PASSWORD, salt),
    passwordSalt: salt,
    passwordAlgorithm: 'scrypt',
    role,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
  db.users.push(user);
  return user;
}

/** A user plus a live cookie-session token. */
export function signedIn(role: UserEntity['role'], over: Partial<UserEntity> = {}) {
  const user = createUser(role, over);
  const { session } = authService.login(user.email, PASSWORD);
  return { user, token: session.token };
}

export interface CallOpts {
  token?: string;
  /** Send the token as a Bearer header with X-Dahab-Client: native. */
  native?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
}

export function caller(base: string) {
  return (method: string, url: string, opts: CallOpts = {}) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers || {}) };
    if (opts.token) {
      if (opts.native) {
        headers.authorization = `Bearer ${opts.token}`;
        headers['x-dahab-client'] = 'native';
      } else {
        headers.cookie = `dahab_auth_token=${opts.token}`;
      }
    } else if (opts.native) {
      headers['x-dahab-client'] = 'native';
    }
    return fetch(`${base}${url}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  };
}
