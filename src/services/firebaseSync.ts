import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch,
  DocumentData,
  Query,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Business, User } from '../types';

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

export function setCloudConnectionStatus(isOnline: boolean, isFirebaseActive: boolean) {
  updateSyncState({
    isOnline,
    isFirebaseActive,
    ...(isFirebaseActive ? { lastSyncTimestamp: Date.now(), error: null } : {}),
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => updateSyncState({ isOnline: true }));
  window.addEventListener('offline', () =>
    updateSyncState({ isOnline: false, isFirebaseActive: false })
  );
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
 * Direct Cloud lookup for a Business by its connection accessCode and its active staff (Owner/Manager/Cashier).
 * Uses strictly filtered queries so phones without Google sign-in can connect seamlessly.
 */
export async function lookupBusinessAndStaffByAccessCode(rawCode: string): Promise<{
  business?: Business;
  staff: User[];
}> {
  const clean = rawCode.trim().toUpperCase();
  if (!clean) return { staff: [] };

  const candidates = Array.from(
    new Set([clean, clean.startsWith('CP-') ? clean : `CP-${clean}`])
  );

  try {
    const bizQuery = query(
      collection(db, 'businesses'),
      where('accessCode', 'in', candidates)
    );
    const bizSnap = await getDocs(bizQuery);
    if (bizSnap.empty) {
      return { staff: [] };
    }

    const business = bizSnap.docs[0].data() as Business;

    const staffQuery = query(
      collection(db, 'users'),
      where('businessId', '==', business.id),
      where('role', 'in', ['owner', 'manager', 'cashier'])
    );
    const staffSnap = await getDocs(staffQuery);
    const staff: User[] = [];
    staffSnap.forEach((d) => {
      const u = d.data() as User;
      if (u.status === 'active') {
        staff.push(u);
      }
    });

    updateSyncState({
      isFirebaseActive: true,
      lastSyncTimestamp: Date.now(),
      error: null,
    });

    return { business, staff };
  } catch (err: any) {
    console.warn('[FirebaseSync] lookupBusinessAndStaffByAccessCode notice:', err?.message || err);
    return { staff: [] };
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

  const collectionsConfig: { name: string; q: Query<DocumentData>; cb?: (items: any[]) => void }[] = [
    {
      name: 'businesses',
      q: query(collection(db, 'businesses'), where('subscriptionStatus', 'in', ['active', 'trial', 'suspended'])),
      cb: callbacks.onBusinessesUpdated,
    },
    {
      name: 'products',
      q: query(collection(db, 'products'), where('businessId', '>', '')),
      cb: callbacks.onProductsUpdated,
    },
    {
      name: 'transactions',
      q: query(collection(db, 'transactions'), where('businessId', '>', '')),
      cb: callbacks.onTransactionsUpdated,
    },
    {
      name: 'users',
      q: query(collection(db, 'users'), where('role', 'in', ['owner', 'manager', 'cashier', 'developer'])),
      cb: callbacks.onUsersUpdated,
    },
    {
      name: 'customers',
      q: query(collection(db, 'customers'), where('businessId', '>', '')),
      cb: callbacks.onCustomersUpdated,
    },
    {
      name: 'sessions',
      q: query(collection(db, 'sessions'), where('businessId', '>', '')),
      cb: callbacks.onSessionsUpdated,
    },
    {
      name: 'notifications',
      q: query(collection(db, 'notifications'), where('targetRole', 'in', ['all', 'owner', 'manager', 'cashier', 'developer'])),
      cb: callbacks.onNotificationsUpdated,
    },
    {
      name: 'movements',
      q: query(collection(db, 'movements'), where('businessId', '>', '')),
      cb: callbacks.onMovementsUpdated,
    },
  ];

  collectionsConfig.forEach(({ name, q, cb }) => {
    if (!cb) return;
    try {
      const unsub = onSnapshot(
        q,
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
    const bizQuery = query(
      collection(db, 'businesses'),
      where('subscriptionStatus', 'in', ['active', 'trial', 'suspended'])
    );
    const bizSnap = await getDocs(bizQuery);
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
