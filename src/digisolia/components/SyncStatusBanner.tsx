import React from 'react';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, Clock } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { formatFrenchDateTime } from '../utils/validation';

interface SyncStatusBannerProps {
  compact?: boolean;
}

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({ compact = false }) => {
  const { isBrowserOnline, cloudSync } = useOnlineStatus();
  const { pendingCount, lastSyncAt, isSyncing, lastFlushResult, triggerSync } = useOfflineQueue();

  return (
    <div
      className={`rounded-xl border transition-colors ${
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
      } ${
        !isBrowserOnline
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
          : pendingCount > 0
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
                : cloudSync.isFirebaseActive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-[#F4F7FB] dark:bg-slate-800 text-[#2783C7]'
            }`}
          >
            {!isBrowserOnline ? (
              <WifiOff className="w-4 h-4" />
            ) : pendingCount > 0 ? (
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
                    : cloudSync.isFirebaseActive
                    ? 'bg-emerald-500'
                    : 'bg-[#2783C7]'
                }`}
                aria-hidden="true"
              />
              <span>
                {!isBrowserOnline
                  ? 'Mode hors connexion actif — vos données sont conservées localement'
                  : pendingCount > 0
                  ? `${pendingCount} demande${pendingCount > 1 ? 's' : ''} en file d’attente de synchronisation`
                  : cloudSync.isFirebaseActive
                  ? 'Connecté · Synchronisation Firebase active'
                  : 'Connecté · Cache local opérationnel'}
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
          {pendingCount > 0 && isBrowserOnline && (
            <button
              type="button"
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2783C7] hover:bg-[#1e6aa3] text-white transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser'}</span>
            </button>
          )}
        </div>
      </div>

      {lastFlushResult?.lastError && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {lastFlushResult.lastError}
        </p>
      )}
    </div>
  );
};
