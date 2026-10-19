import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { authService } from '../../server/services/authService';
import { resetDb } from '../helpers/fixtures';

/**
 * Nothing in the UI called sign-out until now: the platform could be signed
 * into and not out of. These cover the server half — that a session is
 * genuinely revoked rather than merely forgotten by the browser, which on a
 * shared device is the difference between the next person seeing someone's
 * bookings or not.
 */

const PASSWORD = 'a-long-enough-test-password';

function seedUserWithSession(): { token: string; userId: string } {
  const registered = authService.register(
    'Test Traveler',
    'logout-test@example.com',
    '+20 100 000 0000',
    PASSWORD
  );
  return { token: registered.session.token, userId: registered.user.id };
}

describe('ending a session', () => {
  beforeEach(() => {
    resetDb();
  });

  it('removes the session so the token stops working', () => {
    const { token } = seedUserWithSession();
    expect(authService.validateToken(`Bearer ${token}`)).not.toBeNull();

    expect(authService.logout(`Bearer ${token}`)).toBe(true);

    // The point of the whole exercise: the token is dead server-side, not just
    // dropped from the browser.
    expect(authService.validateToken(`Bearer ${token}`)).toBeNull();
    expect(db.sessions.find(s => s.token === token)).toBeUndefined();
  });

  it('accepts the token from the cookie, which is how the SPA authenticates', () => {
    const { token } = seedUserWithSession();
    expect(authService.logout(undefined, `dahab_auth_token=${token}`)).toBe(true);
    expect(authService.validateToken(undefined, `dahab_auth_token=${token}`)).toBeNull();
  });

  it('reports false rather than throwing when there is no session', () => {
    expect(authService.logout(undefined, undefined)).toBe(false);
    expect(authService.logout('Bearer not-a-real-token')).toBe(false);
  });

  it('does not touch anyone else’s session', () => {
    const first = seedUserWithSession();
    const second = authService.register(
      'Second Traveler',
      'second@example.com',
      '+20 100 111 1111',
      PASSWORD
    );

    authService.logout(`Bearer ${first.token}`);

    expect(authService.validateToken(`Bearer ${second.session.token}`)).not.toBeNull();
  });

  it('records the sign-out in the audit log', () => {
    const { token, userId } = seedUserWithSession();
    authService.logout(`Bearer ${token}`);

    const entry = db.auditEvents.find(e => e.action === 'USER_LOGGED_OUT' && e.actor === userId);
    expect(entry).toBeTruthy();
    // The full token must not be written into an audit row.
    expect(JSON.stringify(entry?.payload ?? {})).not.toContain(token);
  });

  it('is idempotent — signing out twice is not an error', () => {
    const { token } = seedUserWithSession();
    expect(authService.logout(`Bearer ${token}`)).toBe(true);
    expect(authService.logout(`Bearer ${token}`)).toBe(false);
  });

  it('revokes every session for a user when asked', () => {
    const { userId } = seedUserWithSession();
    authService.login('logout-test@example.com', PASSWORD);
    authService.login('logout-test@example.com', PASSWORD);

    const revoked = authService.revokeAllSessions(userId);

    expect(revoked).toBeGreaterThanOrEqual(2);
    expect(db.sessions.filter(s => s.userId === userId)).toHaveLength(0);
  });
});
