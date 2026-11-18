import { useState, useEffect } from 'react';
import { subscribeSyncState, CloudSyncState } from '../../services/firebaseSync';

export interface OnlineStatusInfo {
  isBrowserOnline: boolean;
  cloudSync: CloudSyncState;
}

export function useOnlineStatus(): OnlineStatusInfo {
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cloudSync, setCloudSync] = useState<CloudSyncState>({
    isOnline: isBrowserOnline,
    isFirebaseActive: false,
    lastSyncTimestamp: Date.now(),
    syncInProgress: false,
    error: null,
  });

  useEffect(() => {
    const onOnline = () => setIsBrowserOnline(true);
    const onOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const unsubSync = subscribeSyncState(setCloudSync);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubSync();
    };
  }, []);

  return { isBrowserOnline, cloudSync };
}
