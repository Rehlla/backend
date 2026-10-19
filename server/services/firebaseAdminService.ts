import { cert, getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Server-side verification of Firebase ID tokens.
 *
 * Previously /api/auth/firebase-session took { uid, email, role } straight from
 * the request body and issued a session cookie for whatever it was given. Since
 * the user was looked up by email, posting a known address returned that
 * account's session — a complete authentication bypass and privilege escalation.
 *
 * The only safe source of identity is a Firebase ID token verified against
 * Google's public keys. This module owns that verification and nothing else.
 *
 * Credentials are resolved in this order:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  — the full service-account JSON
 *   2. GOOGLE_APPLICATION_CREDENTIALS — path to that JSON (handled by ADC)
 *   3. Application Default Credentials — the normal path on Cloud Run / GCE
 *
 * If none resolve, verification FAILS CLOSED. It must never fall back to
 * trusting the client, which is the bug this replaces.
 */

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

let adminApp: App | null = null;
let initAttempted = false;
let initError: string | null = null;

function getAdminApp(): App | null {
  if (initAttempted) return adminApp;
  initAttempted = true;

  try {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
      return adminApp;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (rawServiceAccount) {
      const parsed = JSON.parse(rawServiceAccount);
      adminApp = initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || projectId
      });
      return adminApp;
    }

    // ADC: GOOGLE_APPLICATION_CREDENTIALS, or the Cloud Run metadata server.
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId
    });
    return adminApp;
  } catch (err: any) {
    initError = err?.message || String(err);
    console.error(
      '[FirebaseAdmin] Could not initialise the Admin SDK; all Firebase sign-ins will be rejected. ' +
      'Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS. Cause:',
      initError
    );
    adminApp = null;
    return null;
  }
}

// initializeApp() succeeds even with no credentials available — applicationDefault()
// resolves lazily, and the failure only surfaces when a token is actually
// verified. So "the app object exists" is NOT the same as "tokens can be
// verified", and reporting the former as readiness makes /api/health claim
// federated sign-in works when it cannot.
let credentialsUsable: boolean | null = null;

export const firebaseAdminService = {
  /**
   * Whether an Admin app object exists. Not sufficient on its own — see
   * verifyConfiguration() for whether credentials actually resolve.
   */
  isInitialised(): boolean {
    return getAdminApp() !== null;
  },

  /**
   * Actually resolves credentials once and caches the answer. Call at boot.
   */
  async verifyConfiguration(): Promise<boolean> {
    if (credentialsUsable !== null) return credentialsUsable;
    const app = getAdminApp();
    if (!app) {
      credentialsUsable = false;
      return false;
    }
    try {
      // Forces the credential chain to resolve; throws when nothing is available.
      await app.options.credential!.getAccessToken();
      credentialsUsable = true;
    } catch (err: any) {
      initError = err?.message || String(err);
      credentialsUsable = false;
      console.error(
        '[FirebaseAdmin] No usable credentials — Firebase sign-in will return 503. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS. Cause:',
        initError
      );
    }
    return credentialsUsable;
  },

  /** Last known credential state; null until verifyConfiguration() has run. */
  credentialState(): boolean | null {
    return credentialsUsable;
  },

  configurationError(): string | null {
    getAdminApp();
    return initError;
  },

  /**
   * Verifies a Firebase ID token and returns the identity it asserts.
   * Returns null for any invalid, expired, revoked or unverifiable token.
   */
  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseIdentity | null> {
    const app = getAdminApp();
    if (!app) return null;
    if (!idToken || typeof idToken !== 'string') return null;

    try {
      // checkRevoked: a signed-out or disabled account stops being accepted.
      const decoded = await getAuth(app).verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerified: Boolean(decoded.email_verified),
        displayName: (decoded.name as string | undefined) ?? null
      };
    } catch (err: any) {
      console.warn('[FirebaseAdmin] ID token rejected:', err?.code || err?.message || err);
      return null;
    }
  }
};
