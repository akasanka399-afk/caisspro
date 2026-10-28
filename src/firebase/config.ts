import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with configured database ID
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.length > 0
    ? firebaseConfig.firestoreDatabaseId
    : '(default)'
);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Connectivity state tracker
export let isFirestoreConnected = false;

// Test connection on boot per Firebase guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    isFirestoreConnected = true;
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client is offline or network restricted.');
    } else {
      // Document might not exist, but network reachable
      isFirestoreConnected = true;
      return true;
    }
    return false;
  }
}

// Automatically trigger test connection on load
testConnection().catch(() => {
  // Graceful offline fallback
});

export default app;
