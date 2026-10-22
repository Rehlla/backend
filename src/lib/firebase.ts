import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { LedgerEntry, TripDayActivity } from '../types';
import { sanitizeText, sanitizeAmount, sanitizeId, sanitizeEmail } from '../utils/sanitize';
import { offlineStorage } from '../utils/offlineStorage';

// Initialize Firebase App instance singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Firestore Database with custom database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

// =========================================================================
// AUTH HELPER METHODS
// =========================================================================

export async function signInTravelerWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    if (result.user) {
      // Upsert traveler user profile projection
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(
        userRef,
        {
          userId: result.user.uid,
          email: sanitizeEmail(result.user.email || 'traveler@dahab.local'),
          displayName: sanitizeText(result.user.displayName || 'Dahab Explorer'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    return result.user;
  } catch (error) {
    console.error('Google Sign-In failed or was cancelled:', error);
    throw error;
  }
}

export async function signInTravelerWithEmail(email: string, password: string): Promise<User | null> {
  try {
    const cleanEmail = sanitizeEmail(email);
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return result.user;
  } catch (error) {
    console.error('Email Sign-In error:', error);
    throw error;
  }
}

export async function registerTravelerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User | null> {
  try {
    const cleanEmail = sanitizeEmail(email);
    const cleanName = sanitizeText(displayName || 'Dahab Explorer');
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (result.user) {
      const userRef = doc(db, 'users', result.user.uid);
      await Promise.all([
        ...(cleanName ? [updateProfile(result.user, { displayName: cleanName })] : []),
        setDoc(
          userRef,
          {
            userId: result.user.uid,
            email: cleanEmail,
            displayName: cleanName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      ]);
    }
    return result.user;
  } catch (error) {
    console.error('Email Registration error:', error);
    throw error;
  }
}

// Re-export the pure error humanizer so existing lazy callers that reach for
// `(await loadFirebase()).humanizeAuthError` keep working without a rewrite.
export { humanizeAuthError } from './authErrorMessages';

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    const cleanEmail = sanitizeEmail(email);
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
}



export async function signOutTraveler(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out failed:', error);
  }
}

// =========================================================================
// COMMERCE TRUTH & LEDGER CLOUD SYNC + OFFLINE RESILIENCE
// =========================================================================

/**
 * The shape firestore.rules validates for users/{uid}/ledger, which is NOT the
 * shape of LedgerEntry: the rules require `title` and `amountEgp`, neither of
 * which exists on the domain type. Both write paths used to synthesise them by
 * reading `(entry as any).title` — a field nothing ever set — so the real
 * source was always the `metadata.reason` fallback behind it.
 */
export interface CloudLedgerDocument {
  id: string;
  userId: string;
  type: string;
  title: string;
  vendor: string;
  amountEgp: number;
  status: string;
  supplierStatus: string;
  signatureHash: string;
  timestamp: string;
}

function toCloudLedgerDocument(entry: LedgerEntry, userId: string): CloudLedgerDocument {
  return {
    id: sanitizeId(entry.id),
    userId,
    type: sanitizeText(entry.type),
    title: sanitizeText(entry.metadata?.reason || entry.type),
    vendor: sanitizeText(entry.metadata?.supplierId || 'Dahab Collective'),
    amountEgp: sanitizeAmount(entry.amountEGP),
    status: sanitizeText(entry.status),
    supplierStatus: 'Confirmed',
    signatureHash: entry.signatureHash || 'SIG_LOCAL_VERIFIED',
    timestamp: entry.timestamp || new Date().toISOString()
  };
}

export async function persistLedgerEntryToCloud(entry: LedgerEntry, userId: string): Promise<void> {
  const cleanId = sanitizeId(entry.id);
  const path = `users/${userId}/ledger/${cleanId}`;

  // If offline, enqueue for background replay
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    offlineStorage.enqueueMutation({
      type: 'LEDGER_PERSIST',
      payload: { entry, userId }
    });
    return;
  }

  try {
    const entryRef = doc(db, 'users', userId, 'ledger', cleanId);
    await setDoc(entryRef, { ...toCloudLedgerDocument(entry, userId), id: cleanId });
  } catch (error) {
    // If write fails due to network, enqueue fallback
    offlineStorage.enqueueMutation({
      type: 'LEDGER_PERSIST',
      payload: { entry, userId }
    });
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserLedger(
  userId: string,
  onEntries: (entries: LedgerEntry[]) => void
) {
  const ledgerCol = collection(db, 'users', userId, 'ledger');
  const path = `users/${userId}/ledger`;

  return onSnapshot(
    query(ledgerCol),
    (snapshot) => {
      const entries: LedgerEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as LedgerEntry);
      });
      if (entries.length > 0) {
        onEntries(entries);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// =========================================================================
// CUSTOM TRIP ACTIVITIES CLOUD SYNC + OFFLINE RESILIENCE
// =========================================================================

export async function persistActivityToCloud(
  activity: TripDayActivity,
  dayNumber: number,
  userId: string
): Promise<void> {
  const cleanId = sanitizeId(activity.id);
  const path = `users/${userId}/activities/${cleanId}`;

  // If offline, enqueue for background replay
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    offlineStorage.enqueueMutation({
      type: 'ACTIVITY_PERSIST',
      payload: { activity, dayNumber, userId }
    });
    return;
  }

  try {
    const actRef = doc(db, 'users', userId, 'activities', cleanId);
    await setDoc(actRef, {
      id: cleanId,
      userId,
      dayNumber,
      time: sanitizeText(activity.time),
      title: sanitizeText(activity.title),
      location: sanitizeText(activity.location || 'Dahab'),
      status: sanitizeText(activity.status),
      notes: sanitizeText(activity.notes || ''),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Fallback to queue
    offlineStorage.enqueueMutation({
      type: 'ACTIVITY_PERSIST',
      payload: { activity, dayNumber, userId }
    });
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// =========================================================================
// AUTOMATIC OFFLINE QUEUE FLUSH
// =========================================================================

export async function flushOfflineMutationQueue(userId: string): Promise<void> {
  const queue = offlineStorage.getMutationQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      if (item.type === 'LEDGER_PERSIST' && item.payload) {
        const { entry } = item.payload;
        const entryRef = doc(db, 'users', userId, 'ledger', sanitizeId(entry.id));
        await setDoc(entryRef, toCloudLedgerDocument(entry, userId));
        offlineStorage.clearMutation(item.id);
      } else if (item.type === 'ACTIVITY_PERSIST' && item.payload) {
        const { activity, dayNumber } = item.payload;
        const actRef = doc(db, 'users', userId, 'activities', sanitizeId(activity.id));
        await setDoc(actRef, {
          id: sanitizeId(activity.id),
          userId,
          dayNumber,
          time: sanitizeText(activity.time),
          title: sanitizeText(activity.title),
          location: sanitizeText(activity.location || 'Dahab'),
          status: sanitizeText(activity.status),
          notes: sanitizeText(activity.notes || ''),
          updatedAt: new Date().toISOString(),
        });
        offlineStorage.clearMutation(item.id);
      }
    } catch (e) {
      console.warn('[OfflineStorage] Error replaying queued mutation:', e);
    }
  }
}

