import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  DocumentData,
} from 'firebase/firestore';
import { db, isFirestoreConnected } from '../firebase/config';

export interface CloudSyncState {
  isOnline: boolean;
  isFirebaseActive: boolean;
  lastSyncTimestamp: number;
  syncInProgress: boolean;
  error: string | null;
}

let syncState: CloudSyncState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isFirebaseActive: false,
  lastSyncTimestamp: Date.now(),
  syncInProgress: false,
  error: null,
};

const listeners = new Set<(state: CloudSyncState) => void>();

export function subscribeSyncState(fn: (state: CloudSyncState) => void): () => void {
  listeners.add(fn);
  fn({ ...syncState });
  return () => {
    listeners.delete(fn);
  };
}

function updateSyncState(partial: Partial<CloudSyncState>) {
  syncState = { ...syncState, ...partial };
  listeners.forEach((fn) => fn({ ...syncState }));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => updateSyncState({ isOnline: true }));
  window.addEventListener('offline', () => updateSyncState({ isOnline: false }));
}

/**
 * Persist or update a document in Firestore
 */
export async function syncDocToFirestore(collectionName: string, docId: string, data: Record<string, any>) {
  try {
    const docRef = doc(db, collectionName, docId);
    // Sanitize any undefined properties before sending to Firestore
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) {
        sanitized[k] = v;
      }
    });
    await setDoc(docRef, sanitized, { merge: true });
    updateSyncState({
      isFirebaseActive: true,
      lastSyncTimestamp: Date.now(),
      error: null,
    });
  } catch (err: any) {
    console.warn(`[FirebaseSync] Error syncing ${collectionName}/${docId}:`, err?.message || err);
    updateSyncState({
      error: err?.message || 'Erreur de synchronisation Firestore',
    });
  }
}

/**
 * Delete a document from Firestore
 */
export async function deleteDocFromFirestore(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    updateSyncState({
      isFirebaseActive: true,
      lastSyncTimestamp: Date.now(),
      error: null,
    });
  } catch (err: any) {
    console.warn(`[FirebaseSync] Error deleting ${collectionName}/${docId}:`, err?.message || err);
  }
}

/**
 * Initialize real-time listeners on Firestore collections to receive updates across instances
 */
export function setupFirestoreListeners(callbacks: {
  onBusinessesUpdated?: (items: any[]) => void;
  onProductsUpdated?: (items: any[]) => void;
  onTransactionsUpdated?: (items: any[]) => void;
  onUsersUpdated?: (items: any[]) => void;
  onCustomersUpdated?: (items: any[]) => void;
  onSessionsUpdated?: (items: any[]) => void;
  onNotificationsUpdated?: (items: any[]) => void;
  onMovementsUpdated?: (items: any[]) => void;
}): () => void {
  const unsubscribers: (() => void)[] = [];

  const collectionsConfig = [
    { name: 'businesses', cb: callbacks.onBusinessesUpdated },
    { name: 'products', cb: callbacks.onProductsUpdated },
    { name: 'transactions', cb: callbacks.onTransactionsUpdated },
    { name: 'users', cb: callbacks.onUsersUpdated },
    { name: 'customers', cb: callbacks.onCustomersUpdated },
    { name: 'sessions', cb: callbacks.onSessionsUpdated },
    { name: 'notifications', cb: callbacks.onNotificationsUpdated },
    { name: 'movements', cb: callbacks.onMovementsUpdated },
  ];

  collectionsConfig.forEach(({ name, cb }) => {
    if (!cb) return;
    try {
      const colRef = collection(db, name);
      const unsub = onSnapshot(
        colRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const docs: DocumentData[] = [];
            snapshot.forEach((d) => {
              docs.push(d.data());
            });
            cb(docs);
            updateSyncState({
              isFirebaseActive: true,
              lastSyncTimestamp: Date.now(),
              error: null,
            });
          }
        },
        (error) => {
          if (error?.code === 'unavailable') {
            updateSyncState({ isOnline: false, isFirebaseActive: false });
          } else {
            console.warn(`[Firebase] Listener on ${name} notice:`, error.message);
            updateSyncState({ error: error.message });
          }
        }
      );
      unsubscribers.push(unsub);
    } catch (err) {
      console.warn(`[Firebase] Could not attach listener to ${name}:`, err);
    }
  });

  return () => {
    unsubscribers.forEach((fn) => {
      try {
        fn();
      } catch {
        // cleanup ignore
      }
    });
  };
}

/**
 * Seed initial local data into Firestore if remote collection is empty
 */
export async function seedRemoteFirestoreIfEmpty(dataMap: {
  businesses: any[];
  users: any[];
  products: any[];
  customers: any[];
  transactions: any[];
  sessions: any[];
  notifications: any[];
  movements: any[];
}) {
  try {
    const bizCol = collection(db, 'businesses');
    const bizSnap = await getDocs(bizCol);
    if (!bizSnap.empty) {
      updateSyncState({ isFirebaseActive: true });
      return; // Already populated
    }

    updateSyncState({ syncInProgress: true });

    // Populate collections
    const collectionsToSeed = [
      { name: 'businesses', items: dataMap.businesses },
      { name: 'users', items: dataMap.users },
      { name: 'products', items: dataMap.products },
      { name: 'customers', items: dataMap.customers },
      { name: 'transactions', items: dataMap.transactions },
      { name: 'sessions', items: dataMap.sessions },
      { name: 'notifications', items: dataMap.notifications },
      { name: 'movements', items: dataMap.movements },
    ];

    for (const group of collectionsToSeed) {
      const batch = writeBatch(db);
      group.items.forEach((item) => {
        if (item.id) {
          const docRef = doc(db, group.name, String(item.id));
          // Sanitize
          const clean: Record<string, any> = {};
          Object.entries(item).forEach(([k, v]) => {
            if (v !== undefined) clean[k] = v;
          });
          batch.set(docRef, clean, { merge: true });
        }
      });
      await batch.commit();
    }

    updateSyncState({
      isFirebaseActive: true,
      syncInProgress: false,
      lastSyncTimestamp: Date.now(),
      error: null,
    });
  } catch (err: any) {
    if (err?.code !== 'unavailable') {
      console.warn('[FirebaseSync] Seed batch notice:', err?.message || err);
    }
    updateSyncState({ syncInProgress: false });
  }
}
