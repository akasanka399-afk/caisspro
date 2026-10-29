import React, { useState, useEffect, useRef } from 'react';
import { Business, PushNotification, User } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import {
  Bell,
  ChevronDown,
  Sun,
  Zap,
  Lock,
  Unlock,
  Shield,
  KeyRound,
  X,
  AlertCircle,
  Cloud,
  Menu,
} from 'lucide-react';
import { subscribeSyncState, CloudSyncState } from '../services/firebaseSync';

interface TopBarProps {
  currentUser: User;
  currentBusiness: Business;
  activeView: string;
  onNavigate: (view: string) => void;
  onOpenAuthModal: () => void;
  onOpenCashSessionModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  currentBusiness,
  activeView,
  onNavigate,
  onOpenAuthModal,
  onOpenCashSessionModal,
}) => {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Hidden developer console secret access: 3 clicks on "Caisse Pro" + PIN 76127809
  const [logoClickCount, setLogoClickCount] = useState<number>(0);
  const [showSecretPinModal, setShowSecretPinModal] = useState<boolean>(false);
  const [secretPinInput, setSecretPinInput] = useState<string>('');
  const [secretPinError, setSecretPinError] = useState<string>('');
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateNotifs = () => {
      setNotifications(store.getNotifications(currentUser.role, currentBusiness.id));
    };
    updateNotifs();
    const unsub = store.subscribe(updateNotifs);
    return () => unsub();
  }, [currentUser.role, currentBusiness.id]);

  const [cloudSync, setCloudSync] = useState<CloudSyncState>({
    isOnline: true,
    isFirebaseActive: true,
    lastSyncTimestamp: Date.now(),
    syncInProgress: false,
    error: null,
  });

  useEffect(() => {
    return subscribeSyncState((state) => setCloudSync(state));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Navigation tabs based on role — DEV DASHBOARD IS STRICTLY HIDDEN FROM STANDARD NAVIGATION!
  const getNavLinks = () => {
    if (currentUser.role === 'owner' || currentUser.role === 'developer') {
      return [
        { id: 'pos', label: 'Caisse Tactile' },
        { id: 'owner-dashboard', label: 'Tableau de Bord & CA' },
        { id: 'stocks', label: 'Stocks & Produits' },
        { id: 'customers', label: 'Fichier Clients' },
      ];
    }

    if (currentUser.role === 'manager') {
      return [
        { id: 'pos', label: 'Caisse Tactile' },
        { id: 'stocks', label: 'Stocks & Produits' },
        { id: 'customers', label: 'Clientèle & Crédits' },
      ];
    }

    // Cashier
    return [
      { id: 'pos', label: 'Caisse Tactile' },
      { id: 'session', label: 'Session Caisse' },
    ];
  };

  const navLinks = getNavLinks();

  const roleLabel: Record<string, string> = {
    developer: 'Développeur',
    owner: 'Propriétaire',
    manager: 'Gérante',
    cashier: 'Caissière',
  };

  const isLight = theme === 'light';

  // Triple-click handler on Caisse Pro logo
  const handleLogoClick = () => {
    setLogoClickCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        playSoundEffect('beep');
        setShowSecretPinModal(true);
        setSecretPinInput('');
        setSecretPinError('');
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        return 0;
      }

      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        setLogoClickCount(0);
      }, 1500);

      return next;
    });
  };

  // Submit secret PIN
  const handleVerifySecretPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretPinInput.trim() === '76127809') {
      playSoundEffect('cash');
      setShowSecretPinModal(false);
      setSecretPinInput('');
      setSecretPinError('');
      onNavigate('dev-dashboard');
    } else {
      playSoundEffect('error');
      setSecretPinError('Code PIN incorrect. Accès refusé.');
    }
  };

  return (
    <div className="sticky top-0 z-40 shrink-0 w-full">
      <header
        className={`h-[58px] sm:h-[65px] border-b flex items-center justify-between gap-3 md:gap-6 px-3 sm:px-4 md:px-6 select-none transition-colors duration-200 backdrop-blur-md ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900 shadow-xs'
            : 'bg-[#070913]/95 border-cyan-500/25 text-white shadow-[0_4px_20px_rgba(0,242,254,0.06)]'
        }`}
      >
      {/* Zone 1: Single text element wordmark with secret triple-click detection */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleLogoClick}
          className="text-left group flex items-center gap-2.5 cursor-pointer focus:outline-hidden"
          title="Caisse Pro"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm transition-transform group-hover:scale-105 ${
              isLight
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-cyan-400 text-neutral-950 shadow-[0_0_15px_rgba(0,242,254,0.7)]'
            }`}
          >
            C
          </div>
          <span className="text-lg font-extrabold tracking-tight whitespace-nowrap">
            Caisse{' '}
            <span className={isLight ? 'text-amber-600' : 'text-cyan-400 neon-text-cyan'}>
              Pro
            </span>
          </span>
        </button>

        {currentUser.role !== 'developer' && (
          <span
            className={`hidden sm:inline text-xs truncate max-w-[190px] font-medium border-l pl-3 ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-cyan-500/20 text-neutral-400'
            }`}
          >
            {currentBusiness.name}
          </span>
        )}
      </div>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
        {navLinks.map((link) => {
          const isActive = activeView === link.id;
          return (
            <button
              key={link.id}
              onClick={() => {
                if (link.id === 'session') {
                  onOpenCashSessionModal();
                } else {
                  onNavigate(link.id);
                }
              }}
              className={`transition-colors whitespace-nowrap shrink-0 relative py-1 text-xs font-semibold ${
                isActive
                  ? isLight
                    ? 'text-amber-600 font-bold'
                    : 'text-cyan-300 font-bold'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {link.label}
              {isActive && (
                <span
                  className={`absolute bottom-[-16px] left-0 right-0 h-0.5 rounded-full ${
                    isLight
                      ? 'bg-amber-500'
                      : 'bg-cyan-400 shadow-[0_0_8px_rgba(0,242,254,0.9)]'
                  }`}
                />
              )}
            </button>
          );
        })}

        {/* If secret developer console is unlocked and currently active, display an active badge */}
        {activeView === 'dev-dashboard' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40 animate-pulse">
            <Shield className="w-3.5 h-3.5" />
            <span>Console Développeur (Déverrouillée)</span>
          </span>
        )}
      </nav>

      {/* Zone 3: Primary action + Theme Switcher (Clair / Néon) + profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Firebase Cloud Sync Live Badge */}
        <div
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
            cloudSync.isOnline
              ? isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
              : isLight
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
          }`}
          title="Synchronisation temps réel Firebase Cloud Firestore (europe-west2) active"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              cloudSync.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <Cloud className={`w-3.5 h-3.5 ${cloudSync.isOnline ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="font-semibold whitespace-nowrap">Firebase Cloud Sync</span>
        </div>

        {/* MODE CLAIR / MODE NÉON SWITCHER */}
        <div
          className={`flex items-center p-0.5 rounded-lg border transition-colors ${
            isLight
              ? 'bg-slate-100 border-slate-200'
              : 'bg-[#0b0e1b] border-cyan-500/30 shadow-[0_0_10px_rgba(0,242,254,0.15)]'
          }`}
        >
          <button
            onClick={() => setTheme('light')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              isLight
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Activer le Mode Clair (Boutique & Retail)"
          >
            <Sun className={`w-3.5 h-3.5 ${isLight ? 'text-amber-500' : ''}`} />
            <span className="hidden sm:inline">Clair</span>
          </button>

          <button
            onClick={() => setTheme('neon')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              !isLight
                ? 'bg-cyan-400 text-neutral-950 font-extrabold shadow-[0_0_12px_rgba(0,242,254,0.8)]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Activer le Mode Néon (Cyber-Caisse Phosphore)"
          >
            <Zap className={`w-3.5 h-3.5 ${!isLight ? 'fill-neutral-950 text-neutral-950' : ''}`} />
            <span className="hidden sm:inline">Néon</span>
          </button>
        </div>

        {/* Notifications Icon with Counter */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className={`p-2 rounded-lg border transition-colors relative ${
              isLight
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80'
                : 'bg-[#0b0e1b] border-cyan-500/30 text-neutral-300 hover:text-white hover:border-cyan-400/50'
            }`}
            title="Notifications Push Automatisées"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifDropdown && (
            <div
              className={`absolute right-0 mt-2 w-80 rounded-xl shadow-2xl border p-3 z-50 space-y-2 ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-[#0b0e1b] border-cyan-500/40 text-white'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-700/50">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Notifications Push ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => store.markAllNotificationsAsRead()}
                    className={`text-[11px] font-semibold hover:underline ${
                      isLight ? 'text-amber-700' : 'text-cyan-400'
                    }`}
                  >
                    Tout lire
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">
                    Aucune notification active
                  </p>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      className={`p-2 rounded-lg text-xs space-y-0.5 border ${
                        n.read
                          ? isLight
                            ? 'bg-slate-50 border-slate-100 text-slate-600'
                            : 'bg-neutral-900/40 border-neutral-800 text-neutral-400'
                          : isLight
                          ? 'bg-amber-50 border-amber-200 text-slate-900'
                          : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{n.title}</span>
                        <span className="text-[10px] opacity-60 font-mono">
                          {n.timestamp.slice(11, 16)}
                        </span>
                      </div>
                      <p className="text-[11px] line-clamp-2">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Identity Pill (Quick Auth switcher) */}
        <button
          onClick={onOpenAuthModal}
          className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border transition-colors ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
              : 'bg-[#0b0e1b] hover:bg-[#12172d] border-cyan-500/30 text-white'
          }`}
          title="Changer d'utilisateur ou de rôle"
        >
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
              currentUser.role === 'developer'
                ? 'bg-purple-600 text-white'
                : currentUser.role === 'owner'
                ? 'bg-amber-500 text-white'
                : currentUser.role === 'manager'
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {currentUser.name.charAt(0)}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight truncate max-w-[110px]">
              {currentUser.name.split(' ')[0]}
            </div>
            <div className="text-[10px] text-neutral-400 leading-none">
              {roleLabel[currentUser.role]}
            </div>
          </div>
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        </button>
      </div>

      {/* SECRET MODAL: ACCÈS CONSOLE DÉVELOPPEUR VIA TRIPLE-CLIC + CODE PIN 76127809 */}
      {showSecretPinModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl border ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#0a0e1f] border-purple-500/50 text-white shadow-[0_0_30px_rgba(168,85,247,0.2)]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-700/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Console Développeur</h3>
                  <p className="text-[11px] text-neutral-400">Accès restreint Super-Admin</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecretPinModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySecretPin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 opacity-80">
                  Code PIN d'autorisation Développeur
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={secretPinInput}
                  onChange={(e) => {
                    setSecretPinInput(e.target.value);
                    if (secretPinError) setSecretPinError('');
                  }}
                  placeholder="Entrez le PIN maître..."
                  autoFocus
                  className={`w-full px-4 py-2.5 rounded-lg font-mono text-center text-lg tracking-widest font-bold transition-colors ${
                    isLight
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                  }`}
                />
              </div>

              {secretPinError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{secretPinError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-700/40">
                <button
                  type="button"
                  onClick={() => setShowSecretPinModal(false)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium ${
                    isLight ? 'bg-slate-100 text-slate-700' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Déverrouiller</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>

    {/* Persistent mobile navigation bar so menus NEVER disappear during typing or viewport resizing */}
    <div
      className={`md:hidden flex items-center gap-1.5 overflow-x-auto px-3 py-1.5 border-b text-xs shrink-0 select-none transition-colors ${
        isLight
          ? 'bg-slate-50/95 border-slate-200 text-slate-800'
          : 'bg-[#090d1f]/95 border-cyan-500/20 text-neutral-300'
      }`}
    >
      {navLinks.map((link) => {
        const isActive = activeView === link.id;
        return (
          <button
            key={link.id}
            onClick={() => {
              if (link.id === 'session') {
                onOpenCashSessionModal();
              } else {
                onNavigate(link.id);
              }
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? isLight
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'bg-cyan-400 text-neutral-950 font-bold shadow-[0_0_12px_rgba(0,242,254,0.6)]'
                : isLight
                ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
            }`}
          >
            {link.label}
          </button>
        );
      })}
    </div>
  </div>
  );
};
