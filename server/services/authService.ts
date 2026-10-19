import crypto from 'crypto';
import { db } from '../db/database';
import { UserEntity, SessionEntity } from '../db/schema';
import { findByKey, findOneBy } from '../db/sqlite/query';

const SESSION_TTL_HOURS = 72;

export class AuthService {
  /**
   * Generates a cryptographically secure 16-byte random salt.
   */
  public generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hashes a password using memory-hard scrypt with a unique per-user salt.
   */
  public hashPasswordScrypt(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  /**
   * Legacy SHA-256 calculation for backward compatibility.
   */
  private hashPasswordLegacySha256(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Timing-safe password verification supporting both modern scrypt and legacy SHA-256.
   */
  public verifyPassword(password: string, user: UserEntity): { isValid: boolean; needsRehash: boolean } {
    if (!user.passwordHash || user.passwordHash === 'FIREBASE_AUTH_MANAGED') {
      return { isValid: false, needsRehash: false };
    }

    try {
      if (user.passwordSalt && user.passwordAlgorithm === 'scrypt') {
        const calculated = this.hashPasswordScrypt(password, user.passwordSalt);
        const calculatedBuf = Buffer.from(calculated, 'hex');
        const storedBuf = Buffer.from(user.passwordHash, 'hex');
        if (calculatedBuf.length !== storedBuf.length) {
          return { isValid: false, needsRehash: false };
        }
        const isValid = crypto.timingSafeEqual(calculatedBuf, storedBuf);
        return { isValid, needsRehash: false };
      }

      // Legacy SHA-256 check
      const legacyCalculated = this.hashPasswordLegacySha256(password);
      const legacyBuf = Buffer.from(legacyCalculated, 'hex');
      const storedBuf = Buffer.from(user.passwordHash, 'hex');
      if (legacyBuf.length !== storedBuf.length) {
        return { isValid: false, needsRehash: false };
      }
      const isLegacyValid = crypto.timingSafeEqual(legacyBuf, storedBuf);
      return { isValid: isLegacyValid, needsRehash: isLegacyValid };
    } catch {
      return { isValid: false, needsRehash: false };
    }
  }

  public register(
    name: string,
    email: string,
    phone: string,
    password: string,
    role: UserEntity['role'] = 'Traveler'
  ): { user: Omit<UserEntity, 'passwordHash' | 'passwordSalt'>; session: SessionEntity } {
    // Self-service account creation may never request a privileged role. Admin,
    // Operations, and Supplier are provisioned through seeded/gated paths only.
    const safeRole: UserEntity['role'] = 'Traveler';
    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('User with this email already exists.');
    }

    const userId = `USR-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const salt = this.generateSalt();
    const passwordHash = this.hashPasswordScrypt(password, salt);
    const now = new Date().toISOString();

    const newUser: UserEntity = {
      id: userId,
      email: email.toLowerCase(),
      name,
      phone,
      passwordHash,
      passwordSalt: salt,
      passwordAlgorithm: 'scrypt',
      role: safeRole,
      createdAt: now,
      updatedAt: now
    };

    const session = this.createSession(userId, safeRole);

    db.runInTransaction(() => {
      db.users.push(newUser);
      db.sessions.push(session);
      db.logAudit(userId, safeRole, 'USER_REGISTERED', 'User', userId, {
        email,
        role: safeRole,
        algorithm: 'scrypt'
      });
    });

    const { passwordHash: _, passwordSalt: __, ...safeUser } = newUser;
    return { user: safeUser, session };
  }

  /**
   * Email, or a mobile number. The app offers both on one field. A number is
   * matched on its digits (a leading 0 or 20 does not make it a different
   * person). The failure sentence stays the same either way.
   */
  public login(email: string, password: string): { user: Omit<UserEntity, 'passwordHash' | 'passwordSalt'>; session: SessionEntity } {
    const user = this.findByIdentifier(email);
    if (!user) {
      throw new Error('AUTH_INVALID_CREDENTIALS');
    }

    const { isValid, needsRehash } = this.verifyPassword(password, user);
    if (!isValid) {
      throw new Error('AUTH_INVALID_CREDENTIALS');
    }

    // Checked after the password, so a suspended state is never disclosed to
    // someone who does not hold the credentials.
    if (user.status === 'suspended') {
      throw new Error('This account has been suspended.');
    }

    // Progressive migration: If user was stored with legacy unsalted SHA-256, upgrade to scrypt immediately
    if (needsRehash) {
      const newSalt = this.generateSalt();
      const newHash = this.hashPasswordScrypt(password, newSalt);
      db.runInTransaction(() => {
        user.passwordSalt = newSalt;
        user.passwordHash = newHash;
        user.passwordAlgorithm = 'scrypt';
        user.updatedAt = new Date().toISOString();
        db.logAudit(user.id, user.role, 'USER_PASSWORD_UPGRADED_TO_SCRYPT', 'User', user.id, {
          email: user.email,
          upgradedFrom: 'sha256_legacy'
        });
      });
    }

    const session = this.createSession(user.id, user.role);

    db.runInTransaction(() => {
      db.sessions.push(session);
      db.logAudit(user.id, user.role, 'USER_LOGGED_IN', 'User', user.id, { email });
    });

    const { passwordHash: _, passwordSalt: __, ...safeUser } = user;
    return { user: safeUser, session };
  }

  private findByIdentifier(raw: string): UserEntity | undefined {
    const value = raw.trim();
    if (!value) return undefined;
    if (value.includes('@')) {
      return db.users.find(u => u.email.toLowerCase() === value.toLowerCase());
    }
    const key = phoneKey(value);
    if (key.length < 9) return undefined;
    return db.users.find(u => phoneKey(u.phone || '') === key);
  }

  private createSession(userId: string, role: string): SessionEntity {
    const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
    const expires = new Date();
    expires.setHours(expires.getHours() + SESSION_TTL_HOURS);

    return {
      id: `SES-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId,
      token,
      role,
      expiresAt: expires.toISOString(),
      createdAt: new Date().toISOString()
    };
  }

  public extractTokenFromRequest(authHeader?: string, cookieHeader?: string): string | null {
    if (authHeader) {
      const clean = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (clean) return clean;
    }
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)dahab_auth_token=([^;]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
      }
    }
    return null;
  }

  public validateToken(tokenOrHeader?: string, cookieHeader?: string): { user: Omit<UserEntity, 'passwordHash' | 'passwordSalt'>; session: SessionEntity } | null {
    const cleanToken = this.extractTokenFromRequest(tokenOrHeader, cookieHeader);
    if (!cleanToken) return null;

    // The hottest read in the system: this runs on every authenticated request.
    // It used to scan the whole sessions array and then the whole users array.
    // Both are now single indexed lookups — sessions.token is UNIQUE and
    // users.id is the primary key. findOneBy/findByKey fall back to the
    // in-memory scan when a transaction is mid-flight, so behaviour is
    // unchanged; only the cost is.
    const session = findOneBy<SessionEntity>('sessions', 'token', cleanToken);
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }

    const user = findByKey<UserEntity>('users', session.userId);
    if (!user) return null;
    // Suspension takes effect on the next request, not at token expiry.
    if (user.status === 'suspended') return null;
    // A native token whose device session was revoked is dead even if its row
    // somehow survived the revoke.
    if (session.deviceSessionId) {
      const device = db.deviceSessions.find(d => d.id === session.deviceSessionId);
      if (device?.revokedAt) return null;
    }

    const { passwordHash: _, passwordSalt: __, ...safeUser } = user;
    return { user: safeUser, session };
  }

  /**
   * Establishes a server session from an ALREADY-VERIFIED Firebase identity.
   *
   * Callers must pass values taken from firebaseAdminService.verifyIdToken(),
   * never from the request body. Two rules make the escalation path impossible:
   *
   *  1. Accounts are keyed on the Firebase uid, not the email. Looking up by
   *     email meant anyone who knew an address could claim that account.
   *  2. The role is read from the stored user record. New accounts are always
   *     'Traveler'. A client-supplied role is ignored entirely; elevation is an
   *     administrative action against the database.
   */
  public syncFirebaseUserSession(
    firebaseUid: string,
    email: string,
    displayName?: string,
    emailVerified?: boolean
  ): { user: Omit<UserEntity, 'passwordHash' | 'passwordSalt'>; session: SessionEntity } {
    if (!firebaseUid) {
      throw new Error('A verified Firebase uid is required.');
    }

    const userId = `USR-FB-${firebaseUid}`;
    let user = db.users.find(u => u.firebaseUid === firebaseUid || u.id === userId);

    // Link a pre-existing local account to this uid on first federated sign-in,
    // but only when the provider asserts the address is verified — otherwise an
    // unverified address could be used to claim someone else's account.
    // firebaseAdminService.verifyIdToken returns { emailVerified } — check it.
    if (!user && email) {
      const byEmail = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (byEmail && !byEmail.firebaseUid) {
        if (emailVerified === false) {
          console.warn(`[authService] refusing to link unverified email ${email} to firebaseUid ${firebaseUid}`);
        } else {
          if (emailVerified !== true) {
            // TODO: firebaseAdminService.verifyIdToken should return email_verified; enforce verified check once available
            console.warn(`[authService] linking by email without explicit emailVerified=true for ${email} — TODO enforce verified (identity.emailVerified=${String(emailVerified)})`);
          }
          byEmail.firebaseUid = firebaseUid;
          byEmail.updatedAt = new Date().toISOString();
          user = byEmail;
        }
      }
    }

    if (!user) {
      const now = new Date().toISOString();
      const newUser: UserEntity = {
        id: userId,
        firebaseUid,
        email: (email || '').toLowerCase(),
        name: displayName || 'Dahab Traveler',
        phone: '',
        passwordHash: 'FIREBASE_AUTH_MANAGED',
        role: 'Traveler',
        createdAt: now,
        updatedAt: now,
      };

      db.runInTransaction(() => {
        db.users.push(newUser);
        db.logAudit(userId, 'Traveler', 'FIREBASE_USER_SYNCED', 'User', userId, { email, firebaseUid });
      });
      user = newUser;
    }

    if (user.status === 'suspended') {
      throw new Error('This account has been suspended.');
    }

    // Role always comes from the stored record.
    const session = this.createSession(user.id, user.role);
    db.runInTransaction(() => {
      db.sessions.push(session);
    });

    const { passwordHash: _, passwordSalt: __, ...safeUser } = user;
    return { user: safeUser, session };
  }

  public getUserById(userId: string): Omit<UserEntity, 'passwordHash' | 'passwordSalt'> | null {
    const user = db.users.find(u => u.id === userId);
    if (!user) return null;
    const { passwordHash: _, passwordSalt: __, ...safeUser } = user;
    return safeUser;
  }

  /**
   * PUT /api/auth/profile — the editable fields of the signed-in account.
   *
   * This used to exist only on the client: the profile page wrote to a React
   * context and toasted "updated successfully" while the server record still
   * carried the old values, so every reload silently reverted the reader and
   * anything the backend checks (booking contact phone, supplier WhatsApp)
   * kept the blank. Identity and role never come from the body — the caller's
   * session decides whose record is edited; requestBody supplies at most two
   * non-credential fields. Email is deliberately excluded: it is the login
   * identifier and needs its own verification flow, not a free-text field.
   */
  public updateProfile(
    userId: string,
    updates: { name?: string; phone?: string },
    auditActor?: { role: string; sessionId?: string }
  ): Omit<UserEntity, 'passwordHash' | 'passwordSalt'> {
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const name = updates.name !== undefined ? updates.name.trim() : user.name;
    const phone = updates.phone !== undefined ? updates.phone.trim() : (user.phone || '');
    if (!name || name.length > 120) {
      throw new Error('Name is required and must be at most 120 characters.');
    }
    // "Bookmark length ~ E.164": digits, optional leading +, separators.
    // A spacey but honest rule — the field is for a driver/delivery call, not
    // for a registry we format.
    if (phone && (phone.length > 24 || !/^\+?[\d\s\-()]{7,24}$/.test(phone))) {
      throw new Error('Phone must be 7-24 characters: digits with an optional leading + and separators.');
    }

    db.runInTransaction(() => {
      user.name = name;
      user.phone = phone;
      user.updatedAt = new Date().toISOString();
      db.logAudit(
        user.id,
        auditActor?.role || user.role,
        'USER_PROFILE_UPDATED',
        'User',
        user.id,
        { fields: Object.keys(updates).filter(k => k === 'name' || k === 'phone') }
      );
    });

    const { passwordHash: _, passwordSalt: __, ...safeUser } = user;
    return safeUser;
  }

  public logout(tokenOrHeader?: string, cookieHeader?: string): boolean {
    const cleanToken = this.extractTokenFromRequest(tokenOrHeader, cookieHeader);
    if (!cleanToken) return false;
    const idx = db.sessions.findIndex(s => s.token === cleanToken);
    if (idx >= 0) {
      const session = db.sessions[idx];
      db.runInTransaction(() => {
        db.sessions.splice(idx, 1);
        db.logAudit(session.userId, session.role, 'USER_LOGGED_OUT', 'Session', session.id, { token: cleanToken.substring(0, 10) + '...' });
      });
      return true;
    }
    return false;
  }

  public revokeAllSessions(userId: string): number {
    let count = 0;
    db.runInTransaction(() => {
      for (let i = db.sessions.length - 1; i >= 0; i--) {
        if (db.sessions[i].userId === userId) {
          db.sessions.splice(i, 1);
          count++;
        }
      }
      db.logAudit(userId, 'System', 'ALL_SESSIONS_REVOKED', 'User', userId, { revokedCount: count });
    });
    return count;
  }
}

/** Digits only, without a leading 0 or Egypt's 20, so 010… and +20 10… match. */
function phoneKey(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export const authService = new AuthService();
