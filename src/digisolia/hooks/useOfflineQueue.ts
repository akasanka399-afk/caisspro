import { useState, useEffect, useCallback } from 'react';
import {
  flushOfflineQueue,
  FlushResult,
  getLastSuccessfulSync,
  getOfflineQueue,
  getUserPreferences,
  subscribeOfflineQueue,
} from '../services/offlineQueue';
import { OfflineQueueItem } from '../types/digisolia.types';

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineQueueItem[]>(() => getOfflineQueue());
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => getLastSuccessfulSync());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastFlushResult, setLastFlushResult] = useState<FlushResult | null>(null);

  const reload = useCallback(() => {
    setQueue(getOfflineQueue());
    setLastSyncAt(getLastSuccessfulSync());
  }, []);

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await flushOfflineQueue();
      setLastFlushResult(res);
      reload();
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [reload]);

  useEffect(() => {
    const unsub = subscribeOfflineQueue(reload);
    const onOnline = () => {
      if (getUserPreferences().autoSyncOnReconnect) {
        triggerSync();
      }
    };
    window.addEventListener('online', onOnline);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
    };
  }, [reload, triggerSync]);

  return {
    queue,
    pendingCount: queue.length,
    lastSyncAt,
    isSyncing,
    lastFlushResult,
    triggerSync,
  };
}
