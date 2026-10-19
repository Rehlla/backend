import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { authService } from '../../server/services/authService';
import type { UserEntity } from '../../server/db/schema';
import { resetDb } from '../helpers/fixtures';

/**
 * Session issuance — regression cover for CRIT-1 and BUG-14.
 *
 * /api/auth/firebase-session used to accept {uid, email, role} from the request
 * body with no token verification, and looked the user up BY EMAIL. Posting a
 * known address returned that account's session cookie:
 *
 *   curl -X POST /api/auth/firebase-session \
 *     -d '{"uid":"x","email":"admin@dahab.travel","role":"Admin"}'
 *
 * ...returned a valid admin Set-Cookie. Two properties close that, and both are
 * asserted here: identity is keyed on the verified uid, and role comes only
 * from the stored record — never from the caller.
 */

const seedUser = (over: Partial<UserEntity>): UserEntity => {
  const now = new Date().toISOString();
  const user: UserEntity = {
    id: 'USR-SEED',
    email: 'seed@example.test',
    name: 'Seed',
    phone: '',
    passwordHash: 'x',
    role: 'Traveler',
    createdAt: now,
    updatedAt: now,
    ...over
  } as UserEntity;
  db.users.push(user);
  return user;
};

describe('federated session issuance', () => {
  beforeEach(resetDb);

  it('refuses to issue a session without a verified uid', () => {
    expect(() => authService.syncFirebaseUserSession('', 'admin@dahab.travel'))
      .toThrow(/verified Firebase uid/i);
    expect(db.sessions).toHaveLength(0);
  });

  it('does NOT hand over an existing account just because the email matches', () => {
    const admin = seedUser({ id: 'USR-ADMIN', email: 'admin@dahab.travel', role: 'Admin', firebaseUid: 'real-admin-uid' });

    // The attacker knows the address but not the uid.
    const { user, session } = authService.syncFirebaseUserSession('attacker-uid', 'admin@dahab.travel');

    expect(user.id).not.toBe(admin.id);
    expect(user.role).toBe('Traveler');
    expect(session.userId).not.toBe(admin.id);
  });

  it('never takes the role from the caller — a new account is always a Traveler', () => {
    const { user } = authService.syncFirebaseUserSession('brand-new-uid', 'someone@example.test', 'Someone');
    expect(user.role).toBe('Traveler');
  });

  it('does not grant Supplier from an email that merely contains "supplier"', () => {
    // The client used to derive the role with email.includes('supplier').
    const { user } = authService.syncFirebaseUserSession('uid-1', 'supplier.jane@gmail.com');
    expect(user.role).toBe('Traveler');
  });

  it('keys identity on the uid, so the same uid returns the same account', () => {
    const first = authService.syncFirebaseUserSession('stable-uid', 'a@example.test');
    const second = authService.syncFirebaseUserSession('stable-uid', 'different@example.test');
    expect(second.user.id).toBe(first.user.id);
    expect(db.users.filter(u => u.firebaseUid === 'stable-uid')).toHaveLength(1);
  });

  it('issues a session carrying the STORED role, not a requested one', () => {
    seedUser({ id: 'USR-OPS', email: 'ops@dahab.travel', role: 'Operations', firebaseUid: 'ops-uid' });
    const { session, user } = authService.syncFirebaseUserSession('ops-uid', 'ops@dahab.travel');
    expect(user.role).toBe('Operations');
    expect(session.role).toBe('Operations');
  });

  it('links an unclaimed local account to a uid only once', () => {
    seedUser({ id: 'USR-LOCAL', email: 'local@example.test', role: 'Traveler' });
    const first = authService.syncFirebaseUserSession('uid-a', 'local@example.test');
    expect(first.user.id).toBe('USR-LOCAL');

    // A second, different uid claiming the same address must not take it over.
    const second = authService.syncFirebaseUserSession('uid-b', 'local@example.test');
    expect(second.user.id).not.toBe('USR-LOCAL');
  });

  it('never returns password material in the session response', () => {
    seedUser({ id: 'USR-PW', email: 'pw@example.test', firebaseUid: 'pw-uid', passwordHash: 'secret-hash', passwordSalt: 'secret-salt' } as Partial<UserEntity>);
    const { user } = authService.syncFirebaseUserSession('pw-uid', 'pw@example.test');
    expect(JSON.stringify(user)).not.toMatch(/secret-hash|secret-salt/);
    expect('passwordHash' in user).toBe(false);
  });
});

describe('token validation', () => {
  beforeEach(resetDb);

  it('rejects a token that was never issued', () => {
    expect(authService.validateToken('Bearer not-a-real-token')).toBeNull();
  });

  it('reads the session cookie, not only the Authorization header', () => {
    // requireAuth used to read only the header, while the SPA authenticates by
    // HttpOnly cookie — so the one protected router 401'd every real user while
    // remaining reachable with curl. The control was inverted.
    const { session } = authService.syncFirebaseUserSession('cookie-uid', 'cookie@example.test');
    const viaCookie = authService.validateToken(undefined, `dahab_auth_token=${session.token}`);
    expect(viaCookie).not.toBeNull();
    expect(viaCookie!.session.token).toBe(session.token);
  });

  it('rejects a revoked session', () => {
    const { session, user } = authService.syncFirebaseUserSession('revoke-uid', 'revoke@example.test');
    authService.revokeAllSessions(user.id);
    expect(authService.validateToken(`Bearer ${session.token}`)).toBeNull();
  });
});
