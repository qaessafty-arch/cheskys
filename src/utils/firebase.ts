import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  doc, 
  getDocFromServer,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  addDoc as fbAddDoc,
  deleteDoc as fbDeleteDoc,
  getDocs as fbGetDocs,
  Query,
  QuerySnapshot,
  setLogLevel,
  DocumentReference,
  CollectionReference,
  SetOptions,
  UpdateData
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export { firebaseSignOut };

// Silence verbose internal Firebase SDK backoff errors & stream retry warnings
try {
  setLogLevel('silent');
} catch {}

// Use initializeFirestore with experimentalForceLongPolling to fix "Could not reach Cloud Firestore backend"
// which is a common issue in some sandboxed environments.
export const db = firebaseConfig.firestoreDatabaseId 
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

export default { app, auth, db, storage, googleProvider };

/**
 * Validates the connection to Firestore by attempting to fetch a document directly from the server.
 */
export async function testFirestoreConnection() {
  try {
    if (isFirestoreQuotaExhausted()) return true;
    // Try to fetch a dummy document from the server to verify connectivity
    await getDocFromServer(doc(db, '_system_health_', 'ping'));
    return true;
  } catch (error) {
    if (isFirestoreQuotaExhaustedError(error)) {
      setFirestoreQuotaExhausted(true);
      return true;
    }
    if (error instanceof Error && (error.message.includes('unavailable') || error.message.includes('offline'))) {
      console.warn('Firestore connection notice (using resilient local mode).');
    }
    return false;
  }
}

// Perform initial connection test
testFirestoreConnection();

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
  }
}

export function isFirestoreQuotaExhaustedError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || '';
  return (
    code === 'resource-exhausted' ||
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota metric') ||
    msg.includes('Free daily write units')
  );
}

const TODAY = new Date().toISOString().slice(0, 10);
const QUOTA_KEY = 'firestore_write_quota_exhausted_day';

// Circuit-breaker flag for daily quota limit. Defaults to false so challenges and writes operate normally.
let quotaExhaustedNoticeShown = false;

// Clear any stale local quota lockout from previous sessions to allow fresh match writes
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(QUOTA_KEY);
  }
} catch {}

export function isFirestoreQuotaExhausted(): boolean {
  return quotaExhaustedNoticeShown;
}

export function setFirestoreQuotaExhausted(exhausted = true): void {
  quotaExhaustedNoticeShown = exhausted;
  try {
    if (exhausted) {
      localStorage.setItem(QUOTA_KEY, TODAY);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('firestore_quota_exhausted'));
      }
    } else {
      localStorage.removeItem(QUOTA_KEY);
    }
  } catch {}
}

/**
 * Safe write wrappers that check quota beforehand and catch errors gracefully,
 * completely preventing Firestore SDK from triggering retry loops or backoff errors.
 */
export async function safeSetDoc<T = any>(
  reference: DocumentReference<T>,
  data: any,
  options?: SetOptions
): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    if (options) {
      await fbSetDoc(reference, data, options);
    } else {
      await fbSetDoc(reference, data);
    }
  } catch (error: any) {
    if (isFirestoreQuotaExhaustedError(error)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.warn('[Firestore] safeSetDoc notice:', error?.message);
  }
}

export async function safeUpdateDoc<T = any>(
  reference: DocumentReference<T>,
  data: UpdateData<any> | Record<string, any>
): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    await fbUpdateDoc(reference, data as any);
  } catch (error: any) {
    if (isFirestoreQuotaExhaustedError(error)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.warn('[Firestore] safeUpdateDoc notice:', error?.message);
  }
}

export async function safeAddDoc<T = any>(
  reference: CollectionReference<T>,
  data: any
): Promise<DocumentReference<T> | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    return await fbAddDoc(reference, data);
  } catch (error: any) {
    if (isFirestoreQuotaExhaustedError(error)) {
      setFirestoreQuotaExhausted(true);
      return null;
    }
    console.warn('[Firestore] safeAddDoc notice:', error?.message);
    return null;
  }
}

export async function safeDeleteDoc<T = any>(
  reference: DocumentReference<T>
): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    await fbDeleteDoc(reference);
  } catch (error: any) {
    if (isFirestoreQuotaExhaustedError(error)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.warn('[Firestore] safeDeleteDoc notice:', error?.message);
  }
}

/**
 * Safely executes a Firestore getDocs query.
 */
export async function safeGetDocs(q: Query): Promise<QuerySnapshot | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    return await fbGetDocs(q);
  } catch (error: any) {
    if (isFirestoreQuotaExhaustedError(error)) {
      setFirestoreQuotaExhausted(true);
      return null;
    }
    console.warn('[Firestore] safeGetDocs notice:', error?.message);
    return null;
  }
}

/**
 * Safely executes a Firestore write operation. If Firestore's free daily write
 * quota is exhausted or an error occurs, it falls back to the provided fallback value
 * without crashing or locking up user interactions.
 */
export async function safeFirestoreWrite<T>(
  writeFn: () => Promise<T>,
  fallbackValue: T,
  operationName = 'write'
): Promise<T> {
  if (isFirestoreQuotaExhausted()) {
    return fallbackValue;
  }
  try {
    return await writeFn();
  } catch (error: any) {
    if (isFirestoreQuotaExhaustedError(error)) {
      setFirestoreQuotaExhausted(true);
      return fallbackValue;
    }
    console.warn(`[Firestore Write Notice] ${operationName} write warning:`, error?.message);
    return fallbackValue;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  if (isFirestoreQuotaExhaustedError(error)) {
    setFirestoreQuotaExhausted(true);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
}
