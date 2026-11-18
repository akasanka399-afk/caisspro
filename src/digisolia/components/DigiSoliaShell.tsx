import React, { useState } from 'react';
import {
  Home,
  Briefcase,
  Bell,
  Headphones,
  MessageSquarePlus,
  Settings,
  Info,
  User as UserIcon,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { DigiSoliaLogo } from './DigiSoliaLogo';
import { DIGISOLIA_CONFIG } from '../config/digisolia.config';
import { DigiSoliaViewId } from '../types/digisolia.types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

interface DigiSoliaShellProps {
  activeView: string;
  businessViewFallback: string;
  unreadNotificationsCount: number;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

export const DigiSoliaShell: React.FC<DigiSoliaShellProps> = ({
  activeView,
  businessViewFallback,
  unreadNotificationsCount,
  onNavigate,
  children,
}) => {
  // Sur l'écran de caisse tactile, la barre latérale peut être réduite par défaut pour maximiser l'espace
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(activeView === 'pos');
  const { isBrowserOnline } = useOnlineStatus();
  const { pendingCount } = useOfflineQueue();

  const isBusinessView = !activeView.startsWith('daf-');

  const primaryMenuItems: {
    id: string;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    badge?: number;
  }[] = [
    {
      id: 'daf-dashboard',
      label: 'Accueil',
      icon: <Home className="w-4 h-4 shrink-0" />,
      isActive: activeView === 'daf-dashboard',
    },
    {
      id: businessViewFallback,
      label: 'Mon activité',
      icon: <Briefcase className="w-4 h-4 shrink-0" />,
      isActive: isBusinessView,
    },
    {
      id: 'daf-notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4 shrink-0" />,
      isActive: activeView === 'daf-notifications',
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    {
      id: 'daf-support',
      label: "Centre d'assistance",
      icon: <Headphones className="w-4 h-4 shrink-0" />,
      isActive: activeView === 'daf-support',
    },
    {
      id: 'daf-feedback',
      label: 'Donner mon avis',
      icon: <MessageSquarePlus className="w-4 h-4 shrink-0" />,
      isActive: activeView === 'daf-feedback',
    },
    {
      id: 'daf-settings',
      label: 'Paramètres',
      icon: <Settings className="w-4 h-4 shrink-0" />,
      isActive: activeView === 'daf-settings',
    },
    {
      id: 'daf-about',
      label: 'À propos',
      icon: <Info className="w-4 h-4 shrink-0" />,
      isActive: activeView === 'daf-about',
    },
  ];

  const secondaryItems: { id: DigiSoliaViewId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'daf-profile',
      label: 'Profil utilisateur',
      icon: <UserIcon className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'daf-welcome',
      label: 'Présentation',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
  ];

  const mobileNavItems = primaryMenuItems.slice(0, 6);

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Barre latérale professionnelle sur ordinateur */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-[#E1E7EF] dark:border-slate-800 bg-white dark:bg-[#090d18] transition-all duration-150 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Header Sidebar */}
        <div className="p-3 border-b border-[#E1E7EF] dark:border-slate-800 flex items-center justify-between gap-2">
          {!sidebarCollapsed && <DigiSoliaLogo size="sm" />}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="p-2 rounded-lg text-slate-500 hover:text-[#163B65] dark:text-slate-400 dark:hover:text-white hover:bg-[#F4F7FB] dark:hover:bg-slate-800 transition-colors cursor-pointer mx-auto md:mx-0"
            title={sidebarCollapsed ? 'Déplier le menu DigiSolia' : 'Réduire le menu DigiSolia'}
            aria-label={sidebarCollapsed ? 'Déplier le menu' : 'Réduire le menu'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation principale recommandée */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {primaryMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              title={item.label}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                item.isActive
                  ? 'bg-[#163B65] text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-[#F4F7FB] dark:hover:bg-slate-800/80 hover:text-[#163B65] dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.icon}
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!sidebarCollapsed && item.badge !== undefined && (
                <span className="text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded bg-[#2783C7] text-white">
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          <div className="my-2 border-t border-[#E1E7EF] dark:border-slate-800" />

          {secondaryItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                title={item.label}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#2783C7] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-[#F4F7FB] dark:hover:bg-slate-800/80 hover:text-[#163B65] dark:hover:text-white'
                }`}
              >
                {item.icon}
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Pied de barre latérale : statut réseau & version */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-[#E1E7EF] dark:border-slate-800 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>{isBrowserOnline ? 'En ligne' : 'Hors connexion'}</span>
              {pendingCount > 0 && (
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {pendingCount} en attente
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] opacity-80">
              {DIGISOLIA_CONFIG.appId} · v{DIGISOLIA_CONFIG.appVersion}
            </div>
          </div>
        )}
      </aside>

      {/* Zone de contenu principale + navigation mobile en bas */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0 pb-16 md:pb-0">{children}</div>

        {/* Navigation mobile adaptée (Android / Téléphone) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#090d18]/95 backdrop-blur-md border-t border-[#E1E7EF] dark:border-slate-800 flex items-center justify-around px-1 py-1.5">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold min-w-[52px] cursor-pointer ${
                item.isActive
                  ? 'text-[#163B65] dark:text-sky-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};
