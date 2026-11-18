import { auth } from '../../firebase/config';
import {
  DigiSoliaFeedbackItem,
  DigiSoliaSupportTicket,
  DigiSoliaUserPreferences,
  OfflineQueueItem,
} from '../types/digisolia.types';
import {
  submitFeedbackToFirestore,
  submitSupportTicketToFirestore,
} from './digisoliaFirebase';

const KEYS = {
  QUEUE: 'digisolia_daf_offline_queue',
  LOCAL_FEEDBACK: 'digisolia_daf_local_feedback',
  LOCAL_SUPPORT: 'digisolia_daf_local_support',
  PREFS: 'digisolia_daf_user_preferences',
  WELCOME_SEEN: 'digisolia_daf_welcome_seen',
  LAST_SYNC_OK: 'digisolia_daf_last_sync_at',
};

const DEFAULT_PREFS: DigiSoliaUserPreferences = {
  language: 'fr',
  notificationsEnabled: true,
  soundAlertsEnabled: true,
  stockAlertsEnabled: true,
  closingRemindersEnabled: true,
  autoSyncOnReconnect: true,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function subscribeOfflineQueue(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function hasSeenWelcomePage(): boolean {
  try {
    return localStorage.getItem(KEYS.WELCOME_SEEN) === '1';
  } catch {
    return false;
  }
}

export function markWelcomePageSeen(): void {
  try {
    localStorage.setItem(KEYS.WELCOME_SEEN, '1');
  } catch {
    // Ignore
  }
}

export function getUserPreferences(): DigiSoliaUserPreferences {
  try {
    const raw = localStorage.getItem(KEYS.PREFS);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveUserPreferences(prefs: Partial<DigiSoliaUserPreferences>): DigiSoliaUserPreferences {
  const next = { ...getUserPreferences(), ...prefs };
  try {
    localStorage.setItem(KEYS.PREFS, JSON.stringify(next));
  } catch {
    // Ignore
  }
  notifyListeners();
  return next;
}

export function getLastSuccessfulSync(): string | null {
  try {
    return localStorage.getItem(KEYS.LAST_SYNC_OK);
  } catch {
    return null;
  }
}

export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(KEYS.QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(items: OfflineQueueItem[]) {
  try {
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(items));
  } catch {
    // Ignore
  }
  notifyListeners();
}

export function getLocalFeedbackHistory(appId?: string): DigiSoliaFeedbackItem[] {
  try {
    const raw = localStorage.getItem(KEYS.LOCAL_FEEDBACK);
    const items: DigiSoliaFeedbackItem[] = raw ? JSON.parse(raw) : [];
    return appId ? items.filter((i) => i.appId === appId) : items;
  } catch {
    return [];
  }
}

export function saveLocalFeedbackItem(item: DigiSoliaFeedbackItem) {
  const items = getLocalFeedbackHistory();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.unshift(item);
  }
  try {
    localStorage.setItem(KEYS.LOCAL_FEEDBACK, JSON.stringify(items.slice(0, 100)));
  } catch {
    // Ignore
  }
  notifyListeners();
}

export function getLocalSupportHistory(appId?: string): DigiSoliaSupportTicket[] {
  try {
    const raw = localStorage.getItem(KEYS.LOCAL_SUPPORT);
    const items: DigiSoliaSupportTicket[] = raw ? JSON.parse(raw) : [];
    return appId ? items.filter((i) => i.appId === appId) : items;
  } catch {
    return [];
  }
}

export function saveLocalSupportTicket(item: DigiSoliaSupportTicket) {
  const items = getLocalSupportHistory();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.unshift(item);
  }
  try {
    localStorage.setItem(KEYS.LOCAL_SUPPORT, JSON.stringify(items.slice(0, 100)));
  } catch {
    // Ignore
  }
  notifyListeners();
}

export function enqueueOfflineOperation(params: {
  kind: 'feedback' | 'support';
  appId: string;
  docId: string;
  payload: DigiSoliaFeedbackItem | DigiSoliaSupportTicket;
  dedupeHash: string;
}): { enqueued: boolean; duplicate: boolean } {
  const current = getOfflineQueue();
  if (current.some((q) => q.dedupeHash === params.dedupeHash || q.docId === params.docId)) {
    return { enqueued: false, duplicate: true };
  }

  const entry: OfflineQueueItem = {
    queueId: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind: params.kind,
    appId: params.appId,
    docId: params.docId,
    payload: params.payload,
    dedupeHash: params.dedupeHash,
    attempts: 0,
    queuedAt: new Date().toISOString(),
  };

  saveOfflineQueue([...current, entry]);
  return { enqueued: true, duplicate: false };
}

export interface FlushResult {
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  requiresAuth: boolean;
  lastError?: string;
}

let isFlushing = false;

export async function flushOfflineQueue(): Promise<FlushResult> {
  if (isFlushing) {
    return {
      syncedCount: 0,
      failedCount: 0,
      remainingCount: getOfflineQueue().length,
      requiresAuth: false,
    };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0, requiresAuth: false };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      syncedCount: 0,
      failedCount: 0,
      remainingCount: queue.length,
      requiresAuth: false,
      lastError: 'Connexion Internet indisponible.',
    };
  }

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return {
      syncedCount: 0,
      failedCount: 0,
      remainingCount: queue.length,
      requiresAuth: true,
      lastError: 'Connectez votre compte Google DigiSolia pour synchroniser vos demandes.',
    };
  }

  isFlushing = true;
  let syncedCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;
  const remaining: OfflineQueueItem[] = [];

  try {
    for (const item of queue) {
      try {
        if (item.kind === 'feedback') {
          const fb: DigiSoliaFeedbackItem = {
            ...(item.payload as DigiSoliaFeedbackItem),
            authorUid: currentUser.uid,
            userEmail: currentUser.email || (item.payload as DigiSoliaFeedbackItem).userEmail,
            _offlinePending: false,
            _syncError: undefined,
          };
          await submitFeedbackToFirestore(fb);
          saveLocalFeedbackItem(fb);
        } else {
          const tk: DigiSoliaSupportTicket = {
            ...(item.payload as DigiSoliaSupportTicket),
            authorUid: currentUser.uid,
            userEmail: currentUser.email || (item.payload as DigiSoliaSupportTicket).userEmail,
            _offlinePending: false,
            _syncError: undefined,
          };
          await submitSupportTicketToFirestore(tk);
          saveLocalSupportTicket(tk);
        }
        syncedCount += 1;
      } catch (err: any) {
        failedCount += 1;
        lastError = err?.message || 'Échec de synchronisation Firestore';
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          lastError,
        });
      }
    }

    saveOfflineQueue(remaining);
    if (syncedCount > 0) {
      localStorage.setItem(KEYS.LAST_SYNC_OK, new Date().toISOString());
    }
    return {
      syncedCount,
      failedCount,
      remainingCount: remaining.length,
      requiresAuth: false,
      lastError,
    };
  } finally {
    isFlushing = false;
    notifyListeners();
  }
}

export function clearSyncedQueueErrors(): void {
  const queue = getOfflineQueue().map((item) => ({ ...item, lastError: undefined }));
  saveOfflineQueue(queue);
}
