import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { PushNotification } from '../../types';
import { store } from '../../services/store';

interface NotificationsModuleProps {
  notifications: PushNotification[];
}

export const NotificationsModule: React.FC<NotificationsModuleProps> = ({ notifications }) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-[#163B65] dark:text-white">
              Notifications ({unreadCount} non lues)
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Alertes d&apos;activité commerciale, messages système et annonces DigiSolia.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => store.markAllNotificationsAsRead()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#2783C7] hover:bg-[#1e6aa3] transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Tout marquer comme lu</span>
            </button>
          )}
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 divide-y divide-[#E1E7EF] dark:divide-slate-800">
          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Aucune notification pour le moment.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${
                  !n.read ? 'bg-[#F4F7FB]/70 dark:bg-slate-800/40' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#163B65] dark:text-white text-sm">
                      {n.title}
                    </span>
                    <span className="text-slate-400 font-mono tabular-nums">
                      {n.timestamp}
                    </span>
                    {!n.read && (
                      <span className="text-[#2783C7] font-bold">Nouveau</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => store.markNotificationAsRead(n.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#163B65] dark:text-sky-300 bg-white dark:bg-slate-800 border border-[#E1E7EF] dark:border-slate-700 hover:border-[#2783C7] shrink-0 cursor-pointer"
                  >
                    Marquer lu
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
