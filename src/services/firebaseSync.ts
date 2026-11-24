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
import { auth, db, testConnection } from '../firebase/config';
import { Business, User } from '../types';

export interface CloudSyncState {
  isOnline: boolean;
  isFirebaseActive: boolean;
  lastSyncTimestamp: number;
  syncInProgress: boolean;
  pendingCount: number;
  error: string | null;
}

export interface PendingPosSyncOp {
  key: string;
  collectionName: string;
  docId: string;
  op: 'upsert' | 'delete';
  data?: Record<string, any>;
  queuedAt: number;
  revision: number;
  attempts: number;
  lastError?: string;
}

interface DeletedDocRecord {
  key: string;
  collectionName: string;
  docId: string;
  deletedAt: number;
}

export interface CollectionSyncPayload<T = any> {
  docs: T[];
  removedIds: string[];
  fromCache: boolean;
}

const PENDING_QUEUE_STORAGE_KEY = 'kassapro_pending_sync_queue';
const DELETED_DOCS_STORAGE_KEY = 'kassapro_deleted_docs';

let revisionCounter = 0;
function nextRevision(): number {
  revisionCounter += 1;
  return Date.now() * 1000 + (revisionCounter % 1000);
}

/**
 * Deeply remove `undefined` and internal `_`-prefixed keys so Firestore `setDoc` never rejects payloads.
 */
export function sanitizeFirestorePayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([k, v]) => {
      if (v !== undefined && !k.startsWith('_')) {
        clean[k] = sanitizeFirestorePayload(v);
      }
    });
    return clean as T;
  }
  return value;
}

function loadPendingOps(): PendingPosSyncOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingOps(ops: PendingPosSyncOp[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_QUEUE_STORAGE_KEY, JSON.stringify(ops));
  } catch {
    // Storage quota fallback
  }
  updateSyncState({ pendingCount: ops.length });
}

function loadDeletedDocs(): DeletedDocRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_DOCS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDeletedDocs(records: DeletedDocRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DELETED_DOCS_STORAGE_KEY, JSON.stringify(records.slice(-500)));
  } catch {
    // Ignore
  }
}

export function markDocDeletedLocally(collectionName: string, docId: string) {
  const key = `${collectionName}/${docId}`;
  const current = loadDeletedDocs().filter((r) => r.key !== key);
  current.push({ key, collectionName, docId, deletedAt: Date.now() });
  saveDeletedDocs(current);
}

export function clearDocDeletedLocally(collectionName: string, docId: string) {
  const key = `${collectionName}/${docId}`;
  const current = loadDeletedDocs();
  if (current.some((r) => r.key === key)) {
    saveDeletedDocs(current.filter((r) => r.key !== key));
  }
}

export function getLocallyDeletedDocIds(collectionName: string): Set<string> {
  return new Set(
    loadDeletedDocs()
      .filter((r) => r.collectionName === collectionName)
      .map((r) => r.docId)
  );
}

export function getPendingDocIds(collectionName: string): Set<string> {
  return new Set(
    loadPendingOps()
      .filter((op) => op.collectionName === collectionName && op.op === 'upsert')
      .map((op) => op.docId)
  );
}

export function getPendingDeletedIds(collectionName: string): Set<string> {
  return new Set(
    loadPendingOps()
      .filter((op) => op.collectionName === collectionName && op.op === 'delete')
      .map((op) => op.docId)
  );
}

export function purgePendingSyncForBusiness(businessId: string) {
  if (!businessId) return;
  const current = loadPendingOps();
  const next = current.filter((op) => {
    if (op.collectionName === 'businesses' && op.docId === businessId) return false;
    if (op.data && op.data.businessId === businessId) return false;
    return true;
  });
  if (next.length !== current.length) {
    savePendingOps(next);
  }
}

export function clearPosSyncTrackingStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_QUEUE_STORAGE_KEY);
    localStorage.removeItem(DELETED_DOCS_STORAGE_KEY);
  } catch {
    // Ignore
  }
  updateSyncState({ pendingCount: 0, error: null });
}

function enqueuePosOp(op: Omit<PendingPosSyncOp, 'queuedAt' | 'revision' | 'attempts'>): PendingPosSyncOp {
  const current = loadPendingOps();
  const entry: PendingPosSyncOp = {
    ...op,
    queuedAt: Date.now(),
    revision: nextRevision(),
    attempts: 0,
  };
  const filtered = current.filter((item) => item.key !== entry.key);
  filtered.push(entry);
  savePendingOps(filtered);
  return entry;
}

function removePosOpIfRevisionMatches(key: string, revision: number) {
  const current = loadPendingOps();
  const existing = current.find((item) => item.key === key);
  if (!existing) return;
  // Only remove if no newer local mutation superseded this revision while in flight
  if (existing.revision <= revision) {
    savePendingOps(current.filter((item) => item.key !== key));
  }
}

function markPosOpError(key: string, revision: number, errMsg: string) {
  const current = loadPendingOps();
  const updated = current.map((item) =>
    item.key === key && item.revision <= revision
      ? { ...item, attempts: item.attempts + 1, lastError: errMsg }
      : item
  );
  savePendingOps(updated);
}

let syncState: CloudSyncState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isFirebaseActive: false,
  lastSyncTimestamp: Date.now(),
  syncInProgress: false,
  pendingCount: loadPendingOps().length,
  error: null,
};

const listeners = new Set<(state: CloudSyncState) => void>();

export function getCloudSyncState(): CloudSyncState {
  return { ...syncState };
}

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
    pendingCount: loadPendingOps().length,
    ...(isFirebaseActive ? { lastSyncTimestamp: Date.now(), error: null } : {}),
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => updateSyncState({ isOnline: true }));
  window.addEventListener('offline', () =>
    updateSyncState({ isOnline: false, isFirebaseActive: false })
  );
}

function logPosFirestoreDiagnostic(op: 'write' | 'delete' | 'list', path: string, err: any) {
  const code = err?.code || '';
  if (code === 'unavailable') return;
  const info = {
    error: err?.message || String(err),
    operationType: op,
    path,
    code,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
    },
  };
  if (code === 'permission-denied') {
    console.error('[FirebaseSync] Firestore Permission Denied:', JSON.stringify(info));
  } else {
    console.warn(`[FirebaseSync] ${op} notice (${path}):`, err?.message || err);
  }
}

/**
 * Persist or update a document in Firestore with an offline-resilient persistent outbox.
 */
export async function syncDocToFirestore(
  collectionName: string,
  docId: string,
  data: Record<string, any>
) {
  if (!collectionName || !docId) return;
  const key = `${collectionName}/${docId}`;
  clearDocDeletedLocally(collectionName, docId);
  const sanitized = sanitizeFirestorePayload(data);
  const queued = enqueuePosOp({
    key,
    collectionName,
    docId,
    op: 'upsert',
    data: sanitized,
  });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateSyncState({ isOnline: false, isFirebaseActive: false });
    return;
  }

  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, sanitized, { merge: true });
    removePosOpIfRevisionMatches(key, queued.revision);
    updateSyncState({
      isOnline: true,
      isFirebaseActive: true,
      lastSyncTimestamp: Date.now(),
      error: null,
    });
  } catch (err: any) {
    logPosFirestoreDiagnostic('write', key, err);
    const errMsg = err?.message || 'Erreur de synchronisation Firestore';
    if (err?.code === 'invalid-argument') {
      // Unrecoverable malformed document: drop from outbox so it doesn't wedge subsequent items
      removePosOpIfRevisionMatches(key, queued.revision);
      updateSyncState({ error: errMsg });
      return;
    }
    markPosOpError(key, queued.revision, errMsg);
    updateSyncState({
      isFirebaseActive: err?.code === 'unavailable' ? false : syncState.isFirebaseActive,
      error:
        err?.code === 'unavailable'
          ? 'Serveur Cloud momentanément inaccessible — modifications mises en file d’attente.'
          : errMsg,
    });
  }
}

/**
 * Delete a document from Firestore with persistent tombstone + offline retry queue.
 */
export async function deleteDocFromFirestore(collectionName: string, docId: string) {
  if (!collectionName || !docId) return;
  const key = `${collectionName}/${docId}`;
  markDocDeletedLocally(collectionName, docId);
  const queued = enqueuePosOp({
    key,
    collectionName,
    docId,
    op: 'delete',
  });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateSyncState({ isOnline: false, isFirebaseActive: false });
    return;
  }

  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    removePosOpIfRevisionMatches(key, queued.revision);
    updateSyncState({
      isOnline: true,
      isFirebaseActive: true,
      lastSyncTimestamp: Date.now(),
      error: null,
    });
  } catch (err: any) {
    logPosFirestoreDiagnostic('delete', key, err);
    const code = err?.code || '';
    if (code === 'permission-denied') {
      // Deletion requires authenticated Google/SuperAdmin session; keep local tombstone and do not loop endlessly
      removePosOpIfRevisionMatches(key, queued.revision);
      updateSyncState({
        error:
          'Suppression locale appliquée. Connectez un compte Google autorisé pour supprimer définitivement côté Cloud.',
      });
      return;
    }
    markPosOpError(key, queued.revision, err?.message || 'Erreur suppression Cloud');
    if (code === 'unavailable') {
      updateSyncState({ isFirebaseActive: false });
    }
  }
}

let inFlightFlush: Promise<{
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  lastError?: string;
}> | null = null;

/**
 * Replay all queued POS mutations (upserts & deletes) against Firestore.
 */
export async function flushPendingPosSyncQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  lastError?: string;
}> {
  if (inFlightFlush) {
    return inFlightFlush;
  }

  inFlightFlush = (async () => {
    const queue = loadPendingOps();
    if (queue.length === 0) {
      updateSyncState({ pendingCount: 0 });
      return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      updateSyncState({ isOnline: false, isFirebaseActive: false, pendingCount: queue.length });
      return {
        syncedCount: 0,
        failedCount: 0,
        remainingCount: queue.length,
        lastError: 'Connexion Internet indisponible.',
      };
    }

    updateSyncState({ syncInProgress: true });
    let syncedCount = 0;
    let failedCount = 0;
    let lastError: string | undefined;

    try {
      for (const item of queue) {
        try {
          const ref = doc(db, item.collectionName, item.docId);
          if (item.op === 'upsert' && item.data) {
            await setDoc(ref, sanitizeFirestorePayload(item.data), { merge: true });
          } else if (item.op === 'delete') {
            await deleteDoc(ref);
          }
          removePosOpIfRevisionMatches(item.key, item.revision);
          syncedCount += 1;
        } catch (err: any) {
          const code = err?.code || '';
          const msg = err?.message || 'Erreur de synchronisation Firestore';
          if (code === 'invalid-argument' || (item.op === 'delete' && code === 'permission-denied')) {
            removePosOpIfRevisionMatches(item.key, item.revision);
            logPosFirestoreDiagnostic(item.op === 'delete' ? 'delete' : 'write', item.key, err);
            lastError = msg;
            continue;
          }
          failedCount += 1;
          lastError = msg;
          markPosOpError(item.key, item.revision, msg);
          logPosFirestoreDiagnostic(item.op === 'delete' ? 'delete' : 'write', item.key, err);
          if (code === 'unavailable') {
            updateSyncState({ isFirebaseActive: false });
            break;
          }
        }
      }

      const remaining = loadPendingOps().length;
      if (syncedCount > 0 && failedCount === 0) {
        updateSyncState({
          isOnline: true,
          isFirebaseActive: true,
          lastSyncTimestamp: Date.now(),
          error: null,
          pendingCount: remaining,
        });
      } else {
        updateSyncState({
          pendingCount: remaining,
          ...(lastError ? { error: lastError } : {}),
        });
      }

      return { syncedCount, failedCount, remainingCount: remaining, lastError };
    } finally {
      updateSyncState({ syncInProgress: false });
      inFlightFlush = null;
    }
  })();

  return inFlightFlush;
}

/**
 * Cascade delete a business and all its associated records from Cloud Firestore.
 */
export async function deleteBusinessCascadeFromFirestore(businessId: string): Promise<{
  success: boolean;
  deletedDocsCount: number;
  errorCode?: string;
  errorMessage?: string;
}> {
  if (!businessId || !businessId.trim()) {
    return { success: false, deletedDocsCount: 0, errorMessage: 'Identifiant commerce invalide.' };
  }

  purgePendingSyncForBusiness(businessId);

  let deletedDocsCount = 0;
  const businessScopedCollections = [
    'products',
    'customers',
    'transactions',
    'credit_settlements',
    'sessions',
    'notifications',
    'movements',
  ];

  try {
    const refsToDelete: ReturnType<typeof doc>[] = [];

    for (const colName of businessScopedCollections) {
      const snap = await getDocs(
        query(collection(db, colName), where('businessId', '==', businessId))
      );
      snap.forEach((d) => {
        refsToDelete.push(d.ref);
      });
    }

    const usersSnap = await getDocs(
      query(collection(db, 'users'), where('businessId', '==', businessId))
    );
    usersSnap.forEach((d) => {
      const data = d.data();
      if (d.id !== 'usr_dev' && data?.role !== 'developer') {
        refsToDelete.push(d.ref);
      }
    });

    refsToDelete.push(doc(db, 'businesses', businessId));

    for (let i = 0; i < refsToDelete.length; i += 400) {
      const chunk = refsToDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
      deletedDocsCount += chunk.length;
    }

    updateSyncState({
      isOnline: true,
      isFirebaseActive: true,
      lastSyncTimestamp: Date.now(),
      error: null,
    });

    return { success: true, deletedDocsCount };
  } catch (err: any) {
    const code = err?.code || '';
    const msg =
      code === 'permission-denied'
        ? 'Connexion Google Super-Admin requise pour supprimer définitivement ce commerce dans Cloud Firestore.'
        : err?.message || 'Erreur lors de la suppression dans Cloud Firestore.';
    console.warn(`[FirebaseSync] Cascade delete business ${businessId} notice:`, err?.message || err);
    return {
      success: false,
      deletedDocsCount,
      errorCode: code || 'unknown',
      errorMessage: msg,
    };
  }
}

function normalizeCompactAccessCode(rawCode: string): string {
  return rawCode
    .trim()
    .toUpperCase()
    .replace(/[\s\u2010-\u2015\u2212\-_]+/g, '');
}

function buildAccessCodeCandidates(rawCode: string): {
  candidates: string[];
  canonicalKey: string;
} {
  const rawUpper = rawCode.trim().toUpperCase();
  const compact = normalizeCompactAccessCode(rawCode);
  if (!compact) return { candidates: [], canonicalKey: '' };

  const suffix = compact.startsWith('CP') && compact.length > 2 ? compact.slice(2) : compact;
  const canonical = `CP-${suffix}`;
  const canonicalKey = `CP${suffix}`;
  const candidates = Array.from(
    new Set([rawUpper, canonical, suffix, canonicalKey].filter(Boolean))
  ).slice(0, 10);

  return { candidates, canonicalKey };
}

/**
 * Direct Cloud lookup for a Business by its connection accessCode and its active staff (Owner/Manager/Cashier).
 */
export async function lookupBusinessAndStaffByAccessCode(rawCode: string): Promise<{
  business?: Business;
  staff: User[];
  error?: string;
}> {
  const { candidates, canonicalKey } = buildAccessCodeCandidates(rawCode);
  if (candidates.length === 0) return { staff: [] };

  try {
    let business: Business | undefined;

    const bizQuery = query(
      collection(db, 'businesses'),
      where('accessCode', 'in', candidates)
    );
    const bizSnap = await getDocs(bizQuery);

    if (!bizSnap.empty) {
      const docSnap = bizSnap.docs[0];
      const rawBiz = docSnap.data() as Business;
      business = { ...rawBiz, id: rawBiz.id || docSnap.id };
    } else {
      // Fallback scan over active/trial businesses in case stored code has formatting differences (spaces/lowercase)
      const allBizSnap = await getDocs(
        query(
          collection(db, 'businesses'),
          where('subscriptionStatus', 'in', ['active', 'trial', 'suspended', 'expired'])
        )
      );
      allBizSnap.forEach((docSnap) => {
        if (business) return;
        const rawBiz = docSnap.data() as Business;
        const storedCompact = normalizeCompactAccessCode(rawBiz.accessCode || '');
        const storedCanonical =
          storedCompact.startsWith('CP') && storedCompact.length > 2
            ? storedCompact
            : `CP${storedCompact}`;
        if (storedCanonical === canonicalKey || storedCompact === canonicalKey) {
          business = { ...rawBiz, id: rawBiz.id || docSnap.id };
        }
      });
    }

    if (!business) {
      return { staff: [] };
    }

    const staffMap = new Map<string, User>();
    const collectStaffDoc = (docId: string, rawUser: User) => {
      const uid = rawUser.id || docId;
      const status = rawUser.status || 'active';
      if (
        uid &&
        rawUser.businessId === business!.id &&
        status !== 'suspended' &&
        (rawUser.role === 'owner' || rawUser.role === 'manager' || rawUser.role === 'cashier')
      ) {
        staffMap.set(uid, { ...rawUser, id: uid, status });
      }
    };

    try {
      const staffQuery = query(
        collection(db, 'users'),
        where('businessId', '==', business.id),
        where('role', 'in', ['owner', 'manager', 'cashier'])
      );
      const staffSnap = await getDocs(staffQuery);
      staffSnap.forEach((d) => collectStaffDoc(d.id, d.data() as User));
    } catch (staffErr: any) {
      console.warn('[FirebaseSync] Compound staff query fallback triggered:', staffErr?.message || staffErr);
    }

    // Fallback single-field role query (no composite index required) if compound query returned empty or errored
    if (staffMap.size === 0) {
      try {
        const roleOnlyQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['owner', 'manager', 'cashier'])
        );
        const roleOnlySnap = await getDocs(roleOnlyQuery);
        roleOnlySnap.forEach((d) => collectStaffDoc(d.id, d.data() as User));
      } catch (fallbackErr: any) {
        console.warn('[FirebaseSync] Role-only staff fallback notice:', fallbackErr?.message || fallbackErr);
      }
    }

    updateSyncState({
      isOnline: true,
      isFirebaseActive: true,
      lastSyncTimestamp: Date.now(),
      error: null,
    });

    return { business, staff: Array.from(staffMap.values()) };
  } catch (err: any) {
    console.warn('[FirebaseSync] lookupBusinessAndStaffByAccessCode notice:', err?.message || err);
    return {
      staff: [],
      error: err?.code === 'unavailable' ? 'Serveur Cloud temporairement inaccessible.' : undefined,
    };
  }
}

/**
 * Initialize real-time listeners on all 9 POS Firestore collections, propagating updates and removals.
 */
export function setupFirestoreListeners(callbacks: {
  onBusinessesUpdated?: (payload: CollectionSyncPayload<Business>) => void;
  onBusinessRemoved?: (businessId: string) => void;
  onProductsUpdated?: (payload: CollectionSyncPayload) => void;
  onTransactionsUpdated?: (payload: CollectionSyncPayload) => void;
  onCreditSettlementsUpdated?: (payload: CollectionSyncPayload) => void;
  onUsersUpdated?: (payload: CollectionSyncPayload<User>) => void;
  onCustomersUpdated?: (payload: CollectionSyncPayload) => void;
  onSessionsUpdated?: (payload: CollectionSyncPayload) => void;
  onNotificationsUpdated?: (payload: CollectionSyncPayload) => void;
  onMovementsUpdated?: (payload: CollectionSyncPayload) => void;
}): () => void {
  const unsubscribers: (() => void)[] = [];

  const collectionsConfig: {
    name: string;
    q: Query<DocumentData>;
    cb?: (payload: CollectionSyncPayload<any>) => void;
  }[] = [
    {
      name: 'businesses',
      q: query(
        collection(db, 'businesses'),
        where('subscriptionStatus', 'in', ['active', 'trial', 'suspended', 'expired'])
      ),
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
      name: 'credit_settlements',
      q: query(collection(db, 'credit_settlements'), where('businessId', '>', '')),
      cb: callbacks.onCreditSettlementsUpdated,
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
      q: query(
        collection(db, 'notifications'),
        where('targetRole', 'in', ['all', 'owner', 'manager', 'cashier', 'developer'])
      ),
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
          const removedIds: string[] = [];
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
              removedIds.push(change.doc.id);
              if (name === 'businesses') {
                callbacks.onBusinessRemoved?.(change.doc.id);
              }
            }
          });

          const docs: DocumentData[] = [];
          snapshot.forEach((d) => {
            const raw = d.data();
            docs.push(raw?.id ? raw : { id: d.id, ...raw });
          });

          if (!snapshot.empty || removedIds.length > 0 || !snapshot.metadata.fromCache) {
            cb({
              docs,
              removedIds,
              fromCache: snapshot.metadata.fromCache,
            });
          }

          if (!snapshot.metadata.fromCache) {
            updateSyncState({
              isOnline: true,
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
            logPosFirestoreDiagnostic('list', name, error);
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

async function commitInSafeChunks(collectionName: string, items: Record<string, any>[]) {
  for (let i = 0; i < items.length; i += 350) {
    const chunk = items.slice(i, i + 350);
    const batch = writeBatch(db);
    let count = 0;
    chunk.forEach((item) => {
      if (item?.id) {
        const docRef = doc(db, collectionName, String(item.id));
        batch.set(docRef, sanitizeFirestorePayload(item), { merge: true });
        count += 1;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  }
}

/**
 * Seed initial local data if Firestore is empty, OR push missing offline-created POS records
 * whose parent business exists on Firestore (never resurrecting deleted businesses or deleted docs).
 */
export async function seedOrReconcileFirestore(dataMap: {
  businesses: any[];
  users: any[];
  products: any[];
  customers: any[];
  transactions: any[];
  creditSettlements: any[];
  sessions: any[];
  notifications: any[];
  movements: any[];
  deletedBusinessIds?: string[];
  seedBusinessIds?: string[];
}): Promise<{ pushedCount: number; remoteBusinessesCount: number }> {
  const deletedBizSet = new Set(dataMap.deletedBusinessIds || []);
  const seedBizSet = new Set(dataMap.seedBusinessIds || []);

  try {
    updateSyncState({ syncInProgress: true });

    const bizQuery = query(
      collection(db, 'businesses'),
      where('subscriptionStatus', 'in', ['active', 'trial', 'suspended', 'expired'])
    );
    const bizSnap = await getDocs(bizQuery);

    if (bizSnap.empty) {
      const collectionsToSeed = [
        { name: 'businesses', items: dataMap.businesses },
        { name: 'users', items: dataMap.users },
        { name: 'products', items: dataMap.products },
        { name: 'customers', items: dataMap.customers },
        { name: 'transactions', items: dataMap.transactions },
        { name: 'credit_settlements', items: dataMap.creditSettlements },
        { name: 'sessions', items: dataMap.sessions },
        { name: 'notifications', items: dataMap.notifications },
        { name: 'movements', items: dataMap.movements },
      ];

      let pushedCount = 0;
      for (const group of collectionsToSeed) {
        const deletedDocs = getLocallyDeletedDocIds(group.name);
        const validItems = group.items.filter((item) => {
          if (!item?.id || deletedDocs.has(item.id)) return false;
          if (group.name === 'businesses' && deletedBizSet.has(item.id)) return false;
          if (
            group.name !== 'businesses' &&
            group.name !== 'users' &&
            item.businessId &&
            deletedBizSet.has(item.businessId)
          ) {
            return false;
          }
          return true;
        });
        if (validItems.length > 0) {
          await commitInSafeChunks(group.name, validItems);
          pushedCount += validItems.length;
        }
      }

      updateSyncState({
        isOnline: true,
        isFirebaseActive: true,
        syncInProgress: false,
        lastSyncTimestamp: Date.now(),
        error: null,
      });
      return { pushedCount, remoteBusinessesCount: dataMap.businesses.length };
    }

    // Remote Firestore already has businesses: push only missing non-seed/offline-created items
    // tied to existing remote businesses (or pending outbox items).
    const remoteBizIds = new Set(bizSnap.docs.map((d) => d.id));
    const pendingBizIds = getPendingDocIds('businesses');
    const activeBizIds = new Set([...remoteBizIds, ...pendingBizIds]);

    const scopedCollections = [
      {
        name: 'products',
        q: query(collection(db, 'products'), where('businessId', '>', '')),
        items: dataMap.products,
      },
      {
        name: 'customers',
        q: query(collection(db, 'customers'), where('businessId', '>', '')),
        items: dataMap.customers,
      },
      {
        name: 'transactions',
        q: query(collection(db, 'transactions'), where('businessId', '>', '')),
        items: dataMap.transactions,
      },
      {
        name: 'credit_settlements',
        q: query(collection(db, 'credit_settlements'), where('businessId', '>', '')),
        items: dataMap.creditSettlements,
      },
      {
        name: 'sessions',
        q: query(collection(db, 'sessions'), where('businessId', '>', '')),
        items: dataMap.sessions,
      },
      {
        name: 'movements',
        q: query(collection(db, 'movements'), where('businessId', '>', '')),
        items: dataMap.movements,
      },
      {
        name: 'users',
        q: query(collection(db, 'users'), where('role', 'in', ['owner', 'manager', 'cashier', 'developer'])),
        items: dataMap.users,
      },
    ];

    let pushedCount = 0;

    // Also push any non-seed local businesses created offline if not deleted
    const deletedBizDocs = getLocallyDeletedDocIds('businesses');
    const missingBusinesses = dataMap.businesses.filter(
      (b) =>
        b?.id &&
        !remoteBizIds.has(b.id) &&
        !deletedBizSet.has(b.id) &&
        !deletedBizDocs.has(b.id) &&
        !seedBizSet.has(b.id)
    );
    if (missingBusinesses.length > 0) {
      await commitInSafeChunks('businesses', missingBusinesses);
      missingBusinesses.forEach((b) => activeBizIds.add(b.id));
      pushedCount += missingBusinesses.length;
    }

    for (const col of scopedCollections) {
      const snap = await getDocs(col.q);
      const remoteIds = new Set(snap.docs.map((d) => d.id));
      const deletedDocs = getLocallyDeletedDocIds(col.name);

      const missingItems = col.items.filter((item) => {
        if (!item?.id || remoteIds.has(item.id) || deletedDocs.has(item.id)) return false;
        if (col.name === 'users') {
          if (item.id === 'usr_dev' || item.role === 'developer') return true;
          return item.businessId && activeBizIds.has(item.businessId) && !deletedBizSet.has(item.businessId);
        }
        return item.businessId && activeBizIds.has(item.businessId) && !deletedBizSet.has(item.businessId);
      });

      if (missingItems.length > 0) {
        await commitInSafeChunks(col.name, missingItems);
        pushedCount += missingItems.length;
      }
    }

    updateSyncState({
      isOnline: true,
      isFirebaseActive: true,
      syncInProgress: false,
      lastSyncTimestamp: Date.now(),
      error: null,
    });
    return { pushedCount, remoteBusinessesCount: remoteBizIds.size };
  } catch (err: any) {
    if (err?.code !== 'unavailable') {
      console.warn('[FirebaseSync] Seed/reconcile notice:', err?.message || err);
    }
    updateSyncState({
      syncInProgress: false,
      ...(err?.code === 'unavailable' ? { isFirebaseActive: false } : {}),
    });
    return { pushedCount: 0, remoteBusinessesCount: 0 };
  }
}

/**
 * Backward-compatible alias for `seedOrReconcileFirestore`.
 */
export async function seedRemoteFirestoreIfEmpty(dataMap: {
  businesses: any[];
  users: any[];
  products: any[];
  customers: any[];
  transactions: any[];
  creditSettlements?: any[];
  sessions: any[];
  notifications: any[];
  movements: any[];
}) {
  return seedOrReconcileFirestore({
    ...dataMap,
    creditSettlements: dataMap.creditSettlements || [],
  });
}

/**
 * Re-verify Firestore connectivity and flush pending mutations.
 */
export async function forceTestAndFlushPosSync() {
  const connected = await testConnection();
  setCloudConnectionStatus(
    typeof navigator !== 'undefined' ? navigator.onLine : connected,
    connected
  );
  if (!connected) {
    return {
      connected: false,
      syncedCount: 0,
      remainingCount: loadPendingOps().length,
      lastError: 'Serveur Firebase inaccessible. Vérifiez votre connexion Internet.',
    };
  }
  const flushRes = await flushPendingPosSyncQueue();
  return {
    connected: true,
    ...flushRes,
  };
}
