import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with robust connection settings (auto-detect long-polling fallback)
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.length > 0
    ? firebaseConfig.firestoreDatabaseId
    : '(default)'
);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Connectivity state tracker
export let isFirestoreConnected = false;

// Test connection on boot per Firebase guidelines with graceful offline resilience
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    isFirestoreConnected = true;
    return true;
  } catch (error: any) {
    // When backend is momentarily unreachable, client operates in local-first mode
    isFirestoreConnected = false;
    return false;
  }
}

// Automatically trigger test connection on load
testConnection().catch(() => {
  // Graceful offline fallback
});

export default app;
