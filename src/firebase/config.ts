import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with forced long-polling in browser environments to prevent
// WebChannel streaming proxy/iframe timeouts (code=unavailable on initial handshake)
const firestoreSettings =
  typeof window !== 'undefined' ? { experimentalForceLongPolling: true } : {};

export const db = initializeFirestore(
  app,
  firestoreSettings,
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.length > 0
    ? firebaseConfig.firestoreDatabaseId
    : '(default)'
);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Connectivity state tracker
export let isFirestoreConnected = false;
let pendingConnectionCheck: Promise<boolean> | null = null;

// Test connection on boot per Firebase guidelines with graceful offline resilience
export async function testConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    isFirestoreConnected = false;
    return false;
  }

  if (pendingConnectionCheck) {
    return pendingConnectionCheck;
  }

  pendingConnectionCheck = (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      isFirestoreConnected = true;
      return true;
    } catch (error: any) {
      isFirestoreConnected = false;
      if (
        error instanceof Error &&
        error.message.includes('the client is offline') &&
        typeof navigator !== 'undefined' &&
        navigator.onLine
      ) {
        console.warn('[Firebase] Client hors-ligne détecté lors du test initial.');
      }
      return false;
    } finally {
      pendingConnectionCheck = null;
    }
  })();

  return pendingConnectionCheck;
}

// Automatically trigger test connection on load
testConnection().catch(() => {
  // Graceful offline fallback
});

export default app;
