import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';

/**
 * The Firebase SDK is fetched only when it is going to be used.
 *
 * It is 680 kB (169 kB gzipped) — larger than the whole rest of the app's
 * initial JavaScript — and on this deployment it is not usable at all: Firebase
 * Admin has no credentials, /api/health reports firebaseAdminConfigured false,
 * and every federated sign-in returns 503. Every traveler was downloading it on
 * first paint, over Sinai mobile networks, to reach a button that cannot work.
 *
 * `import type` above is erased at build time, so the User type costs nothing.
 */
const loadFirebase = () => import('../lib/firebase');
import { api } from '../services/api';
import { permissionGranted, roleFallbackPermissions } from '../lib/permissions';

export type AuthRole = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';

/** An active read-only view-as (POST /api/admin/view-as), as /api/auth/me reports it. */
export interface ViewAsState {
  userId: string;
  email: string;
}

/**
 * Who the SERVER thinks you are.
 *
 * `user` below is a Firebase User, and it was the only notion of "signed in"
 * the app had. But every /api call authenticates with the HttpOnly session
 * cookie, and that cookie can be issued two ways: by exchanging a verified
 * Firebase ID token, or by the ordinary email/password login. Firebase Admin
 * has no credentials in this deployment, so the first path returns 503 and
 * nobody could sign in at all — which is why an end-to-end booking reached the
 * payment endpoint and got a 401.
 *
 * This is the identity that matters for talking to the backend, independent of
 * how it was obtained.
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** From the stored user record. Empty when the account has none. */
  phone: string;
  role: AuthRole;
  /**
   * For role 'Supplier': the SupplierEntity this account acts for, mirroring
   * UserEntity.supplierId on the server.
   *
   * Carried through so supplier surfaces can scope themselves to the account
   * that is actually signed in. Without it the Supplier Portal had no way to
   * know who it was rendering for and fell back to a hardcoded 'SUP-SHUTTLE-01',
   * showing every supplier the same fleet.
   */
  supplierId?: string;
  source: 'firebase' | 'password';
}

export interface AuthContextType {
  user: User | null;
  /** The backend session. Null means /api calls will be rejected. */
  sessionUser: SessionUser | null;
  /** True when a server session exists, however it was obtained. */
  isSignedIn: boolean;
  /**
   * True when the platform is not actually taking money: no payment gateway is
   * integrated and settlement is simulated. The booking flow must say so —
   * a traveler who reads "Confirmed" after entering a card is entitled to know
   * their card was never charged.
   */
  arePaymentsSimulated: boolean;
  /**
   * Whether federated sign-in can work at all right now. Read from
   * /api/health, so the UI offers the button that will succeed rather than one
   * that returns 503.
   */
  isFederatedSignInAvailable: boolean;
  authRole: AuthRole;
  isAuthLoading: boolean;
  intendedRoute: string;
  setIntendedRoute: (route: string) => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  registerWithEmail: (name: string, email: string, phone: string, pass: string, role?: string) => Promise<boolean>;
  /** Email/password against this platform's own accounts, no Firebase involved. */
  signInWithPassword: (email: string, pass: string) => Promise<boolean>;
  registerWithPassword: (name: string, email: string, phone: string, pass: string) => Promise<boolean>;
  sendResetPasswordEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  isCloudSynced: boolean;
  setIsCloudSynced: (synced: boolean) => void;
  /**
   * Effective permission keys from the server (login and /api/auth/me).
   * Empty for a session issued before permissions existed — can() then falls
   * back to the role defaults (see `permissionsFromRole`).
   */
  permissions: string[];
  /** True when the server sent no (or an empty) permission list and can() uses role defaults. */
  permissionsFromRole: boolean;
  /** Per-user evaluated feature flags and switches from the server. */
  flags: Record<string, boolean>;
  /** Set while this session is a read-only view-as of another user. */
  viewAs: ViewAsState | null;
  /** True when `key` is granted (`*` and `area.*` grants are honoured). */
  can: (key: string) => boolean;
  /** True when any of `keys` is granted. */
  canAny: (keys: readonly string[]) => boolean;
  /** Re-reads /api/auth/me (after view-as starts or ends, or a role change). */
  refreshSession: () => Promise<void>;
}

/** The permission part of a login or /me payload, defensively typed. */
function readAccessPayload(result: any): { permissions: string[] | null; flags: Record<string, boolean>; viewAs: ViewAsState | null } {
  const permissions = Array.isArray(result?.permissions)
    ? (result.permissions as unknown[]).filter((p): p is string => typeof p === 'string')
    : null;
  const flags: Record<string, boolean> = {};
  if (result?.flags && typeof result.flags === 'object') {
    for (const [k, v] of Object.entries(result.flags as Record<string, unknown>)) {
      if (typeof v === 'boolean') flags[k] = v;
    }
  }
  const va = result?.viewAs;
  const viewAs = va && typeof va.userId === 'string' ? { userId: va.userId, email: String(va.email ?? '') } : null;
  return { permissions, flags, viewAs };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  showToast?: (msg: string) => void;
  /**
   * Where to send the traveler after signing out. Injected rather than read
   * from useUI, because AuthProvider renders below UIProvider and cannot use
   * the hook — the same reason showToast is passed in.
   */
  onSignedOut?: () => void;
}> = ({
  children,
  showToast,
  onSignedOut
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authRole, setAuthRole] = useState<AuthRole>('Traveler');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [intendedRoute, setIntendedRoute] = useState<string>('/my-trip');
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isFederatedSignInAvailable, setIsFederatedSignInAvailable] = useState<boolean>(false);
  const [arePaymentsSimulated, setArePaymentsSimulated] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [viewAs, setViewAs] = useState<ViewAsState | null>(null);

  const applyAccess = useCallback((result: any) => {
    const access = readAccessPayload(result);
    setPermissions(access.permissions);
    setFlags(access.flags);
    setViewAs(access.viewAs);
  }, []);

  const clearAccess = useCallback(() => {
    setPermissions(null);
    setFlags({});
    setViewAs(null);
  }, []);

  /**
   * Restore an existing session cookie on load, and find out whether federated
   * sign-in can work. Without the first of these a refresh silently logged the
   * traveller out of the backend while the UI still looked signed in.
   */
  useEffect(() => {
    let cancelled = false;

    api.getMe()
      .then(result => {
        if (cancelled || !result?.user) return;
        setSessionUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          phone: result.user.phone || '',
          supplierId: result.user.supplierId,
          role: (result.user.role as AuthRole) || 'Traveler',
          source: 'password'
        });
        setAuthRole((result.user.role as AuthRole) || 'Traveler');
        applyAccess(result);
      })
      .catch(() => { /* no session yet — the normal case for a first visit */ });

    api
      .pingHealth()
      .then(health => {
        if (cancelled || !health) return;
        setIsFederatedSignInAvailable(!!health.firebaseAdminConfigured);
        setArePaymentsSimulated(!!health.paymentsSimulated);
      })
      .catch(() => { if (!cancelled) setIsFederatedSignInAvailable(false); });

    return () => { cancelled = true; };
  }, [applyAccess]);

  const refreshSession = useCallback(async (): Promise<void> => {
    const result = await api.getMe().catch(() => null);
    if (!result?.user) {
      setSessionUser(null);
      setAuthRole('Traveler');
      clearAccess();
      return;
    }
    const role = (result.user.role as AuthRole) || 'Traveler';
    setSessionUser(prev => ({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      phone: result.user.phone || '',
      supplierId: result.user.supplierId,
      role,
      source: prev?.source ?? 'password'
    }));
    setAuthRole(role);
    applyAccess(result);
  }, [applyAccess, clearAccess]);

  useEffect(() => {
    // Nothing to observe until the server says federated sign-in is available;
    // subscribing anyway is what forced the SDK into the first paint.
    if (!isFederatedSignInAvailable) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const [{ onAuthStateChanged }, firebase] = await Promise.all([
        import('firebase/auth'),
        loadFirebase()
      ]);
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(firebase.auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Role is whatever the server says it is. It used to be guessed here
        // from the email string — `email.includes('supplier')` granted the
        // Supplier role to anyone who registered a matching address — and then
        // sent to the backend, which trusted it.
        try {
          const idToken = await currentUser.getIdToken();
          const result = await api.syncFirebaseSession(idToken);
          const role = (result?.user?.role as AuthRole) || 'Traveler';
          setAuthRole(role);
          setIsCloudSynced(true);
          setSessionUser({
            id: result?.user?.id || currentUser.uid,
            email: result?.user?.email || currentUser.email || '',
            name: result?.user?.name || currentUser.displayName || '',
            phone: result?.user?.phone || '',
            supplierId: result?.user?.supplierId,
            role,
            source: 'firebase'
          });
          applyAccess(result);
        } catch (err) {
          // No verified server session: stay at the lowest privilege rather
          // than assuming anything about who this is.
          setAuthRole('Traveler');
          setIsCloudSynced(false);
          setSessionUser(null);
          clearAccess();
          if (showToast) {
            // Say what actually happened. Firebase sign-in returns 503 when the
            // server has no Admin credentials, and a traveller who is told
            // nothing goes on to a booking that cannot succeed.
            showToast(
              (err as Error)?.message?.includes('503')
                ? 'Google sign-in is unavailable on this server. Use your email and password instead.'
                : 'Signed in, but your session could not be verified with the server.'
            );
          }
        }
      } else {
        setIsCloudSynced(false);
        setAuthRole('Traveler');
      }
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // showToast is a stable useCallback in UIContext, so this subscribes once
    // per change in whether federated sign-in is available.
  }, [showToast, isFederatedSignInAvailable, applyAccess, clearAccess]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      const signedUser = await (await loadFirebase()).signInTravelerWithGoogle();
      if (signedUser) {
        if (showToast) showToast('أهلاً بك تاني يا ' + (signedUser.displayName || 'Traveler') + '!');
        return true;
      }
      return false;
    } catch (err: any) {
      if (showToast) showToast((await loadFirebase()).humanizeAuthError(err));
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [showToast]);

  const signInWithEmail = useCallback(async (email: string, pass: string): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      const signedUser = await (await loadFirebase()).signInTravelerWithEmail(email, pass);
      if (signedUser) {
        if (showToast) showToast('أهلاً بك تاني يا ' + (signedUser.displayName || email.split('@')[0]) + '!');
        return true;
      }
      return false;
    } catch (err: any) {
      if (showToast) showToast((await loadFirebase()).humanizeAuthError(err));
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [showToast]);

  const registerWithEmail = useCallback(async (
    name: string,
    email: string,
    phone: string,
    pass: string,
    role: string = 'Traveler'
  ): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      const signedUser = await (await loadFirebase()).registerTravelerWithEmail(email, pass, name);
      if (signedUser) {
        setAuthRole((role as AuthRole) || 'Traveler');
        if (showToast) showToast('حسابك اتعمل! أهلاً بيك يا ' + name + '.');
        return true;
      }
      return false;
    } catch (err: any) {
      if (showToast) showToast((await loadFirebase()).humanizeAuthError(err));
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [showToast]);

  /**
   * Email/password against this platform's own accounts.
   *
   * api.login and api.register have existed since the start and were called
   * from nowhere; the whole UI went through Firebase, which cannot issue a
   * session here. This is the path that actually works today.
   */
  const signInWithPassword = useCallback(async (email: string, pass: string): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      const result = await api.login(email, pass);
      if (!result?.user) return false;
      const role = (result.user.role as AuthRole) || 'Traveler';
      setSessionUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        phone: result.user.phone || '',
        supplierId: result.user.supplierId,
        role,
        source: 'password'
      });
      setAuthRole(role);
      applyAccess(result);
      if (showToast) showToast(`أهلاً بيك تاني يا ${result.user.name || email.split('@')[0]}!`);
      return true;
    } catch (err: any) {
      // P1-01: the wrong-credentials path is reported inline by AuthView, which
      // speaks the active language. Toasting the raw server message here
      // produced the same failure twice, once in Arabic and once in English.
      // This hook returns false and lets the view own the message.
      void err;
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [showToast, applyAccess]);

  const registerWithPassword = useCallback(async (
    name: string, email: string, phone: string, pass: string
  ): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      // Role is never sent: the server assigns it. Letting the client choose is
      // what BUG-14 was.
      const result = await api.register(name, email, phone, pass);
      if (!result?.user) return false;
      const role = (result.user.role as AuthRole) || 'Traveler';
      setSessionUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        phone: result.user.phone || '',
        supplierId: result.user.supplierId,
        role,
        source: 'password'
      });
      setAuthRole(role);
      applyAccess(result);
      if (showToast) showToast('حسابك اتعمل! أهلاً بيك يا ' + result.user.name + '.');
      return true;
    } catch (err: any) {
      if (showToast) showToast(err?.message || 'Could not create the account.');
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, [showToast, applyAccess]);

  const sendResetPasswordEmail = useCallback(async (email: string): Promise<void> => {
    try {
      (await loadFirebase()).sendPasswordReset(email);
      if (showToast) showToast(`Password reset link sent to ${email}. Check your inbox.`);
    } catch (err: any) {
      if (showToast) showToast((await loadFirebase()).humanizeAuthError(err));
      throw err;
    }
  }, [showToast]);

  /**
   * Ends the session, on the server and here.
   *
   * Nothing in the UI called this until now: the platform could be signed into
   * and not out of. POST /api/auth/logout revokes the session and clears the
   * HttpOnly cookie; setting `sessionUser` to null is what makes the rest of
   * the app forget the traveler — CommerceContext drops their trip, bookings
   * and ledger, and ItineraryContext resets the profile, both keyed on it.
   *
   * The server call comes first. If it fails the local state is cleared anyway:
   * a traveler who pressed "sign out" on a shared machine must not be left
   * looking at their own bookings because a request timed out. The cookie is
   * HttpOnly, so the browser cannot clear it here — hence the warning below,
   * which tells them the truth rather than reporting success.
   */
  const signOut = useCallback(async (): Promise<void> => {
    let serverAcknowledged = true;
    try {
      await api.logout();
    } catch {
      serverAcknowledged = false;
    }

    // Only touch the Firebase SDK when there is a Firebase user to sign out.
    // It is 750 kB, and on a deployment without Firebase Admin credentials
    // there never is one — this used to fetch the whole SDK on every sign-out.
    if (user) {
      try {
        await (await loadFirebase()).signOutTraveler();
      } catch {
        /* no federated session is fine */
      }
    }

    setUser(null);
    setSessionUser(null);
    setAuthRole('Traveler');
    clearAccess();
    setIsCloudSynced(false);
    setIntendedRoute('/my-trip');

    if (showToast) {
      showToast(
        serverAcknowledged
          ? 'Signed out.'
          : 'Signed out on this device, but the server could not be reached — sign out again when you are back online.'
      );
    }

    onSignedOut?.();
  }, [showToast, user, onSignedOut, clearAccess]);

  // Older sessions carry no permission list: fall back to the role defaults
  // so the dashboard keeps its role behaviour.
  const effectivePermissions = useMemo(
    () => (permissions && permissions.length > 0 ? permissions : sessionUser ? roleFallbackPermissions(authRole) : []),
    [permissions, sessionUser, authRole]
  );
  const can = useCallback((key: string) => permissionGranted(effectivePermissions, key), [effectivePermissions]);
  const canAny = useCallback(
    (keys: readonly string[]) => keys.some(k => permissionGranted(effectivePermissions, k)),
    [effectivePermissions]
  );

  // See the note in UIContext: a stable value object is what keeps TripContext's
  // memo from being invalidated on every render.
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      sessionUser,
      isSignedIn: sessionUser !== null,
      isFederatedSignInAvailable,
      arePaymentsSimulated,
      authRole,
      isAuthLoading,
      intendedRoute,
      setIntendedRoute,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      signInWithPassword,
      registerWithPassword,
      sendResetPasswordEmail,
      signOut,
      isCloudSynced,
      setIsCloudSynced,
      permissions: permissions ?? [],
      permissionsFromRole: !permissions || permissions.length === 0,
      flags,
      viewAs,
      can,
      canAny,
      refreshSession
    }),
    [
      user,
      sessionUser,
      isFederatedSignInAvailable,
      arePaymentsSimulated,
      authRole,
      isAuthLoading,
      intendedRoute,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      signInWithPassword,
      registerWithPassword,
      sendResetPasswordEmail,
      signOut,
      isCloudSynced,
      permissions,
      flags,
      viewAs,
      can,
      canAny,
      refreshSession
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
