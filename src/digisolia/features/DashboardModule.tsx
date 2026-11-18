import React, { useMemo } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Headphones,
  MessageSquarePlus,
  Settings,
  ShoppingBag,
  TrendingUp,
  Package,
  Users,
  User as UserIcon,
  Info,
} from 'lucide-react';
import { User, Business, PushNotification } from '../../types';
import { DIGISOLIA_CONFIG } from '../config/digisolia.config';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { DigiSoliaViewId } from '../types/digisolia.types';

interface DashboardModuleProps {
  currentUser: User;
  currentBusiness: Business;
  notifications: PushNotification[];
  cloudUserEmail?: string | null;
  onNavigateApp: (view: string) => void;
  onNavigateFramework: (view: DigiSoliaViewId) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  currentUser,
  currentBusiness,
  notifications,
  cloudUserEmail,
  onNavigateApp,
  onNavigateFramework,
}) => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read);

  // Raccourcis métier filtrés selon les permissions du rôle actif (sans remplacer le tableau de bord métier!)
  const businessShortcuts = useMemo(() => {
    const shortcuts: { id: string; label: string; desc: string; icon: React.ReactNode }[] = [
      {
        id: 'pos',
        label: 'Caisse Tactile',
        desc: 'Encaissement express, scan et tickets',
        icon: <ShoppingBag className="w-4 h-4 text-[#2783C7]" />,
      },
    ];

    if (currentUser.role === 'owner' || currentUser.role === 'developer') {
      shortcuts.push({
        id: 'owner-dashboard',
        label: 'Tableau de Bord & CA',
        desc: 'Chiffre d’affaires, rapport hebdo et Z de caisse',
        icon: <TrendingUp className="w-4 h-4 text-[#2783C7]" />,
      });
    }

    if (currentUser.role !== 'cashier') {
      shortcuts.push(
        {
          id: 'stocks',
          label: 'Stocks & Produits',
          desc: 'Inventaire, alertes rupture et réassort',
          icon: <Package className="w-4 h-4 text-[#2783C7]" />,
        },
        {
          id: 'customers',
          label: 'Fichier Clients',
          desc: 'Suivi clientèle et recouvrement crédits',
          icon: <Users className="w-4 h-4 text-[#2783C7]" />,
        }
      );
    }

    return shortcuts;
  }, [currentUser.role]);

  const frameworkShortcuts: {
    id: DigiSoliaViewId;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'daf-support',
      label: 'Centre d’assistance',
      desc: 'WhatsApp, appel, FAQ et tickets support',
      icon: <Headphones className="w-4 h-4 text-[#2783C7]" />,
    },
    {
      id: 'daf-feedback',
      label: 'Donner mon avis',
      desc: 'Noter l’app, suggérer ou signaler un bug',
      icon: <MessageSquarePlus className="w-4 h-4 text-[#2783C7]" />,
    },
    {
      id: 'daf-profile',
      label: 'Profil utilisateur',
      desc: 'Compte personnel, Cloud Google et session',
      icon: <UserIcon className="w-4 h-4 text-[#2783C7]" />,
    },
    {
      id: 'daf-settings',
      label: 'Paramètres & Sauvegardes',
      desc: 'Thème, alertes et sauvegarde locale JSON',
      icon: <Settings className="w-4 h-4 text-[#2783C7]" />,
    },
  ];

  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Bandeau d'accueil */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {DIGISOLIA_CONFIG.brandName} · {DIGISOLIA_CONFIG.appName} · {currentBusiness.name}
            </p>
            <h1 className="text-2xl font-extrabold text-[#163B65] dark:text-white">
              {greeting}, {currentUser.name}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {cloudUserEmail
                ? `Compte DigiSolia Cloud lié (${cloudUserEmail}).`
                : 'Session locale active. Vous pouvez lier votre compte Google dans Profil utilisateur.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateFramework('daf-support')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#2783C7] hover:bg-[#1e6aa3] text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Headphones className="w-4 h-4" />
              <span>Besoin d&apos;aide ?</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateFramework('daf-welcome')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#F4F7FB] dark:bg-slate-800 hover:bg-[#E1E7EF] dark:hover:bg-slate-700 text-[#163B65] dark:text-slate-200 border border-[#E1E7EF] dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              <span>Présentation</span>
            </button>
          </div>
        </section>

        {/* État de synchronisation */}
        <SyncStatusBanner />

        {/* Raccourcis Métier + Modules DigiSolia */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne gauche : Raccourcis fonctionnalités */}
          <div className="lg:col-span-8 space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#163B65] dark:text-white uppercase tracking-wide">
                  Mon activité métier ({DIGISOLIA_CONFIG.appName})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {businessShortcuts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigateApp(item.id)}
                    className="text-left rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 hover:border-[#2783C7] p-4 transition-colors cursor-pointer flex items-start justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F4F7FB] dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-[#163B65] dark:text-white group-hover:text-[#2783C7] transition-colors">
                          {item.label}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2783C7] shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-[#163B65] dark:text-white uppercase tracking-wide">
                Services DigiSolia
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {frameworkShortcuts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigateFramework(item.id)}
                    className="text-left rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 hover:border-[#2783C7] p-4 transition-colors cursor-pointer flex items-start justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F4F7FB] dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-[#163B65] dark:text-white group-hover:text-[#2783C7] transition-colors">
                          {item.label}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2783C7] shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Colonne droite : Notifications & Informations utiles */}
          <div className="lg:col-span-4 space-y-6">
            {/* Notifications récentes */}
            <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#2783C7]" />
                  <h2 className="text-sm font-bold text-[#163B65] dark:text-white">
                    Notifications ({unreadNotifications.length} non lues)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateFramework('daf-notifications')}
                  className="text-xs font-semibold text-[#2783C7] hover:underline cursor-pointer"
                >
                  Voir tout
                </button>
              </div>

              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  Aucune notification pour le moment.
                </p>
              ) : (
                <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                  {notifications.slice(0, 4).map((n) => (
                    <div key={n.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {n.title}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                          {n.timestamp.slice(5, 16)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Informations utiles */}
            <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#2783C7]" />
                <h2 className="text-sm font-bold text-[#163B65] dark:text-white">
                  Informations utiles
                </h2>
              </div>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Application</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {DIGISOLIA_CONFIG.appName} v{DIGISOLIA_CONFIG.appVersion}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Socle Framework</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    DAF v{DIGISOLIA_CONFIG.frameworkVersion}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Assistance Burkina Faso</dt>
                  <dd className="font-semibold text-[#2783C7] tabular-nums">
                    {DIGISOLIA_CONFIG.contacts.phone}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Horaires support</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300 text-right">
                    {DIGISOLIA_CONFIG.contacts.supportHours}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => onNavigateFramework('daf-about')}
                className="w-full mt-2 py-2 px-3 rounded-lg text-xs font-semibold text-[#163B65] dark:text-slate-200 bg-[#F4F7FB] dark:bg-slate-800 hover:bg-[#E1E7EF] dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                À propos de DigiSolia
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
