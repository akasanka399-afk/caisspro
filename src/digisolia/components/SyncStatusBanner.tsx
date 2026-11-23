import React, { useState } from 'react';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { formatFrenchDateTime } from '../utils/validation';
import { store } from '../../services/store';

interface SyncStatusBannerProps {
  compact?: boolean;
}

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({ compact = false }) => {
  const { isBrowserOnline, cloudSync } = useOnlineStatus();
  const { pendingCount: dafPendingCount, lastSyncAt, isSyncing: isDafSyncing, lastFlushResult, triggerSync } =
    useOfflineQueue();
  const [manualSyncing, setManualSyncing] = useState<boolean>(false);
  const [manualNotice, setManualNotice] = useState<string | null>(null);

  const posPendingCount = cloudSync.pendingCount || 0;
  const totalPending = dafPendingCount + posPendingCount;
  const busy = manualSyncing || isDafSyncing || cloudSync.syncInProgress;

  const handleUnifiedSync = async () => {
    setManualSyncing(true);
    setManualNotice(null);
    try {
      const [posRes] = await Promise.all([store.syncNow(), triggerSync()]);
      if (posRes.error) {
        setManualNotice(posRes.error);
      } else if (posRes.syncedPosOps > 0 || posRes.dafSynced > 0) {
        setManualNotice(
          `Synchronisation terminée (${posRes.syncedPosOps + posRes.dafSynced} élément(s) envoyé(s)).`
        );
      } else if (posRes.ok) {
        setManualNotice('Toutes les données locales et Cloud sont à jour.');
      }
    } finally {
      setManualSyncing(false);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
      } ${
        !isBrowserOnline
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
          : totalPending > 0
          ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/50 text-[#163B65] dark:text-sky-200'
          : 'bg-white dark:bg-slate-900 border-[#E1E7EF] dark:border-slate-800 text-slate-700 dark:text-slate-300'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              !isBrowserOnline
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : totalPending > 0
                ? 'bg-sky-100 dark:bg-sky-900/40 text-[#2783C7] dark:text-sky-300'
                : cloudSync.isFirebaseActive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-[#F4F7FB] dark:bg-slate-800 text-[#2783C7]'
            }`}
          >
            {!isBrowserOnline ? (
              <WifiOff className="w-4 h-4" />
            ) : totalPending > 0 ? (
              <Clock className="w-4 h-4" />
            ) : cloudSync.isFirebaseActive ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${
                  !isBrowserOnline
                    ? 'bg-amber-500'
                    : totalPending > 0
                    ? 'bg-[#2783C7] animate-pulse'
                    : cloudSync.isFirebaseActive
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                aria-hidden="true"
              />
              <span>
                {!isBrowserOnline
                  ? `Mode hors connexion actif — ${totalPending > 0 ? `${totalPending} modification(s) en file locale` : 'vos données sont conservées localement'}`
                  : busy
                  ? 'Synchronisation en cours avec Firebase...'
                  : totalPending > 0
                  ? `${totalPending} modification${totalPending > 1 ? 's' : ''} en attente de synchronisation Cloud`
                  : cloudSync.isFirebaseActive
                  ? 'Connecté · Synchronisation Firebase active'
                  : 'Connecté · Cache local opérationnel (Cloud en attente)'}
              </span>
            </div>

            {!compact && (
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Dernière synchronisation :{' '}
                {lastSyncAt
                  ? formatFrenchDateTime(lastSyncAt)
                  : cloudSync.lastSyncTimestamp
                  ? new Date(cloudSync.lastSyncTimestamp).toLocaleTimeString('fr-FR')
                  : 'En attente'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isBrowserOnline && (
            <button
              type="button"
              onClick={handleUnifiedSync}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2783C7] hover:bg-[#1e6aa3] text-white transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
              <span>{busy ? 'Synchronisation...' : 'Synchroniser'}</span>
            </button>
          )}
        </div>
      </div>

      {(manualNotice || cloudSync.error || lastFlushResult?.lastError) && (
        <p className="mt-2 text-xs flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{cloudSync.error || lastFlushResult?.lastError || manualNotice}</span>
        </p>
      )}
    </div>
  );
};
