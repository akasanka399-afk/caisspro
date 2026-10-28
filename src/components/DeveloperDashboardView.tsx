import React, { useState, useEffect } from 'react';
import { Business, PushNotification, SaleTransaction, SubscriptionPlan, SubscriptionStatus, User, UserRole } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  ShieldAlert,
  Server,
  Building2,
  Users,
  BellRing,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Send,
  Lock,
  Unlock,
  Radio,
  ExternalLink,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface DeveloperDashboardViewProps {
  currentUser: User;
}

export const DeveloperDashboardView: React.FC<DeveloperDashboardViewProps> = ({ currentUser }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'businesses' | 'users' | 'notifications'>('overview');

  // Security Gate state (Simulates authenticated web console)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(currentUser.role === 'developer');
  const [masterKeyInput, setMasterKeyInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Password reset modal state
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [resetPinSuccess, setResetPinSuccess] = useState<boolean>(false);

  // Business edit modal
  const [showAddBizModal, setShowAddBizModal] = useState<boolean>(false);

  // New business form
  const [newBizName, setNewBizName] = useState<string>('');
  const [newBizTrade, setNewBizTrade] = useState<string>('Télécom');
  const [newBizPhone, setNewBizPhone] = useState<string>('');
  const [newBizAddress, setNewBizAddress] = useState<string>('');
  const [newBizOwner, setNewBizOwner] = useState<string>('');
  const [newBizPlan, setNewBizPlan] = useState<SubscriptionPlan>('pro');

  // Push broadcast modal
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastTargetRole, setBroadcastTargetRole] = useState<'all' | 'owner' | 'manager' | 'cashier'>('all');
  const [broadcastBizId, setBroadcastBizId] = useState<string>('all');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'high' | 'urgent'>('normal');

  const refreshData = () => {
    setBusinesses(store.getBusinesses());
    setUsers(store.getUsers());
    setTransactions(store.getTransactions());
    setNotifications(store.getNotifications());
  };

  useEffect(() => {
    refreshData();
    const unsub = store.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, []);

  // Total sales across all stores
  const totalNetworkSalesCount = businesses.reduce((sum, b) => sum + b.totalSalesCount, 0);
  const totalDeveloperRevenue = totalNetworkSalesCount * 20; // 20 F per sale accumulated fee
  const totalNetworkVolumeAmount = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Unlock Master Console
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterKeyInput.trim() === '76127809' || masterKeyInput.trim() === 'DEV-PRO-2026' || masterKeyInput.trim() === 'admin') {
      setIsUnlocked(true);
      setAuthError('');
    } else {
      setAuthError('Code PIN invalide (Code d\'autorisation : 76127809).');
    }
  };

  // Password / PIN reset generator
  const triggerResetPassword = (user: User) => {
    const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    setGeneratedPassword(code);
    setResetTargetUser(user);
    setResetPinSuccess(false);
  };

  const confirmPasswordReset = () => {
    if (!resetTargetUser) return;
    store.updateUser(resetTargetUser.id, {
      pinCode: generatedPassword,
    });
    setResetPinSuccess(true);
  };

  const handleToggleBusinessStatus = (biz: Business) => {
    const newStatus: SubscriptionStatus = biz.subscriptionStatus === 'active' ? 'suspended' : 'active';
    store.updateBusiness(biz.id, { subscriptionStatus: newStatus });
  };

  const handleRenewSubscription = (biz: Business) => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    store.updateBusiness(biz.id, {
      subscriptionStatus: 'active',
      subscriptionExpiresAt: nextYear.toISOString().slice(0, 10),
    });
    alert(`Abonnement de "${biz.name}" renouvelé avec succès jusqu'au ${nextYear.toLocaleDateString('fr-FR')}.`);
  };

  // Add new business
  const handleCreateBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBizName.trim()) return;

    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + 12);

    store.addBusiness({
      name: newBizName.trim(),
      tradeType: newBizTrade,
      currency: 'FCFA',
      phone: newBizPhone.trim() || '+225 00 00 00 00',
      address: newBizAddress.trim() || 'Abidjan, Côte d\'Ivoire',
      ownerName: newBizOwner.trim() || 'Propriétaire',
      subscriptionPlan: newBizPlan,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: expDate.toISOString().slice(0, 10),
    });

    setShowAddBizModal(false);
    setNewBizName('');
    alert(`Nouveau commerce "${newBizName}" enregistré.`);
  };

  // Send Broadcast Push Notification
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    const targetBiz = businesses.find((b) => b.id === broadcastBizId);

    store.addNotification({
      targetRole: broadcastTargetRole,
      businessId: broadcastBizId === 'all' ? undefined : broadcastBizId,
      businessName: targetBiz?.name,
      title: broadcastTitle.trim(),
      message: broadcastMessage.trim(),
      type: 'system',
      priority: broadcastPriority,
    });

    playSoundEffect('alert');
    setShowBroadcastModal(false);
    setBroadcastTitle('');
    setBroadcastMessage('');
    alert('Notification push diffusée avec succès sur le réseau !');
  };

  // If locked
  if (!isUnlocked) {
    return (
      <div className={`flex-1 flex items-center justify-center p-4 transition-colors ${
        isLight ? 'bg-slate-100' : 'bg-neutral-950'
      }`}>
        <div className={`rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-6 border ${
          isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
        }`}>
          <div className="text-center space-y-2">
            <div className={`w-12 h-12 rounded-xl mx-auto flex items-center justify-center border ${
              isLight
                ? 'bg-purple-50 text-purple-600 border-purple-200'
                : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
            }`}>
              <Lock className="w-6 h-6" />
            </div>
            <h2 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Console Développeur Sécurisée
            </h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Accès réservé aux ingénieurs et administrateurs système de la plateforme Caisse Pro.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                Code PIN d'Authentification Développeur
              </label>
              <input
                type="password"
                value={masterKeyInput}
                onChange={(e) => setMasterKeyInput(e.target.value)}
                placeholder="Entrez votre code PIN maître..."
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-mono transition-colors ${
                  isLight
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                    : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                }`}
                autoFocus
              />
              <p className={`text-[11px] mt-1 font-mono ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
                Code PIN maître : <strong className="text-purple-600 font-bold">76127809</strong>
              </p>
            </div>

            {authError && (
              <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                isLight ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md shadow-purple-600/20"
            >
              <Unlock className="w-4 h-4" />
              <span>Déverrouiller l'Interface Web Développeur</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full transition-colors duration-200 ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-neutral-950 text-white'
    }`}>
      {/* Top Bar */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
        isLight ? 'border-slate-300' : 'border-neutral-800'
      }`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse text-purple-500" />
            <span className={isLight ? 'text-purple-700 font-bold' : 'text-purple-400 font-mono tracking-wider'}>
              Tableau de Bord Développeur & Super-Admin
            </span>
            <span className={isLight ? 'text-slate-400' : 'text-neutral-600'}>·</span>
            <span className={isLight ? 'text-slate-600 font-medium' : 'text-neutral-400 font-normal'}>
              Supervision Multi-Commerces
            </span>
          </div>
          <h1 className={`text-xl md:text-2xl font-extrabold tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Contrôle Réseau, Abonnements & Commissions
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800'
            }`}
          >
            <BellRing className="w-4 h-4 text-purple-500" />
            <span>Diffuser Push</span>
          </button>
          <button
            onClick={() => setShowAddBizModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm shadow-purple-600/30 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Commerce</span>
          </button>
        </div>
      </div>

      {/* KPI GLOBAL PLATFORM CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL COMMISSIONS 20F/VENTE ACCUMULÉES */}
        <div className={`p-4 rounded-xl space-y-2 border-2 transition-all ${
          isLight
            ? 'retail-card bg-gradient-to-br from-purple-50 via-white to-purple-100/50 border-purple-400 shadow-sm'
            : 'neon-card bg-gradient-to-br from-neutral-900 to-purple-950/40 border-purple-500/50 shadow-purple-500/10'
        }`}>
          <div className={`flex items-center justify-between text-xs font-bold ${
            isLight ? 'text-purple-800' : 'text-purple-300'
          }`}>
            <span>Total Redevances Développeur</span>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <div className={`text-2xl md:text-3xl font-extrabold font-mono tabular-nums ${
            isLight ? 'text-purple-900' : 'text-purple-400'
          }`}>
            {formatMoney(totalDeveloperRevenue)}
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-purple-200 text-slate-600' : 'border-purple-500/20 text-neutral-400'
          }`}>
            <span>Calcul : {totalNetworkSalesCount} ventes × 20 F</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              100% collectable
            </span>
          </div>
        </div>

        {/* Total Commerces Connectés */}
        <div className={`p-4 rounded-xl space-y-2 border transition-all ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>Commerces Déployés</span>
            <Building2 className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          </div>
          <div className={`text-2xl md:text-3xl font-extrabold font-mono tabular-nums ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {businesses.length} commerces
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span>{businesses.filter((b) => b.subscriptionStatus === 'active').length} actifs</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>Multi-tenant</span>
          </div>
        </div>

        {/* Total Utilisateurs */}
        <div className={`p-4 rounded-xl space-y-2 border transition-all ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>Comptes Utilisateurs</span>
            <Users className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-2xl md:text-3xl font-extrabold font-mono tabular-nums ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {users.length} comptes
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span>Gérants, Caissiers, Propriétaires</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>Sécurisés</span>
          </div>
        </div>

        {/* Total Volume Ventes Réseau */}
        <div className={`p-4 rounded-xl space-y-2 border transition-all ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>Volume Ventes Traité</span>
            <TrendingUp className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
          </div>
          <div className={`text-2xl md:text-3xl font-extrabold font-mono tabular-nums ${
            isLight ? 'text-emerald-700' : 'text-emerald-400 neon-text-green'
          }`}>
            {formatMoney(totalNetworkVolumeAmount)}
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span>CA global commerçants</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>Synchronisé</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex items-center gap-2 border-b pb-2 overflow-x-auto ${
        isLight ? 'border-slate-300' : 'border-neutral-800'
      }`}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white shadow-xs'
              : isLight
              ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Vue Générale & Synchronisation Live
        </button>
        <button
          onClick={() => setActiveTab('businesses')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'businesses'
              ? 'bg-purple-600 text-white shadow-xs'
              : isLight
              ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Commerces & Abonnements ({businesses.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'users'
              ? 'bg-purple-600 text-white shadow-xs'
              : isLight
              ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Gestion Utilisateurs & Mots de Passe ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'notifications'
              ? 'bg-purple-600 text-white shadow-xs'
              : isLight
              ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Notifications Push Automatisées ({notifications.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & REAL-TIME SYNC BUS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Sync Bus */}
          <div className={`lg:col-span-2 rounded-xl overflow-hidden flex flex-col border ${
            isLight
              ? 'retail-card bg-white border-slate-200 shadow-xs'
              : 'neon-card bg-neutral-900/90 border-neutral-800'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
            }`}>
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 animate-pulse ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  Flux Événements & Synchronisation Temps Réel
                </h3>
              </div>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                isLight
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
              }`}>
                WebSocket & Broadcast Channel Actifs
              </span>
            </div>

            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {transactions.slice(0, 8).map((tx) => (
                <div
                  key={tx.id}
                  className={`p-3 rounded-lg flex items-center justify-between gap-3 border transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                      : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          Vente Encaissée
                        </span>
                        <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                          ({tx.ticketNumber})
                        </span>
                      </div>
                      <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                        Caissier: <span className={isLight ? 'text-slate-700 font-medium' : 'text-neutral-300'}>{tx.cashierName}</span> · {formatDate(tx.timestamp)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-xs font-bold font-mono tabular-nums ${
                      isLight ? 'text-emerald-700' : 'text-emerald-400'
                    }`}>
                      {formatMoney(tx.totalAmount)}
                    </div>
                    <div className={`text-[10px] font-mono font-bold ${
                      isLight ? 'text-purple-700' : 'text-purple-400'
                    }`}>
                      +20 F redevance
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Platform Security & System status */}
          <div className="space-y-4">
            <div className={`p-4 rounded-xl space-y-3 border ${
              isLight
                ? 'retail-card bg-white border-slate-200 shadow-xs'
                : 'neon-card bg-neutral-900 border-neutral-800'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                <Server className="w-4 h-4 text-purple-500" />
                <span>Statut Infrastructure</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className={`flex justify-between py-1.5 border-b ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                  <span className={isLight ? 'text-slate-500' : 'text-neutral-400'}>Moteur de Caisse</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    Tactile v2.4 (Opérationnel)
                  </span>
                </div>
                <div className={`flex justify-between py-1.5 border-b ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                  <span className={isLight ? 'text-slate-500' : 'text-neutral-400'}>Base Cloud Firestore</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    Firebase (europe-west2)
                  </span>
                </div>
                <div className={`flex justify-between py-1.5 border-b ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                  <span className={isLight ? 'text-slate-500' : 'text-neutral-400'}>Projet Cloud</span>
                  <span className={`font-mono text-[11px] ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                    gen-lang-client-0661125049
                  </span>
                </div>
                <div className={`flex justify-between py-1.5 border-b ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                  <span className={isLight ? 'text-slate-500' : 'text-neutral-400'}>Tarif Redevance</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                    20 F CFA / transaction
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className={isLight ? 'text-slate-500' : 'text-neutral-400'}>Notification Push API</span>
                  <span className={`font-mono ${isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400'}`}>
                    Automatisée & Active
                  </span>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl space-y-2 border ${
              isLight
                ? 'bg-purple-50 border-purple-200 text-purple-900'
                : 'bg-purple-950/20 border-purple-500/30 text-neutral-300'
            }`}>
              <h4 className={`text-xs font-bold ${isLight ? 'text-purple-900' : 'text-purple-300'}`}>
                Formule Redevance Développeur
              </h4>
              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-purple-800' : 'text-neutral-300'}`}>
                Le modèle économique à 20 F par vente permet aux petits commerces d'avoir une caisse tactile fluide sans investissement lourd, tout en assurant des revenus récurrents au développeur.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUSINESSES & SUBSCRIPTIONS */}
      {activeTab === 'businesses' && (
        <div className={`rounded-xl overflow-hidden border ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900 border-neutral-800'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              Commerces Partenaires & Gestion des Abonnements
            </h3>
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              {businesses.length} établissements
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${
                isLight ? 'bg-slate-100/70 border-slate-200 text-slate-700' : 'bg-neutral-950/80 border-neutral-800 text-neutral-400'
              }`}>
                <tr>
                  <th className="px-4 py-3 font-bold">Commerce</th>
                  <th className="px-4 py-3 font-bold">Activité</th>
                  <th className="px-4 py-3 font-bold">Formule</th>
                  <th className="px-4 py-3 font-bold">Échéance</th>
                  <th className="px-4 py-3 font-bold text-center">Ventes Cumulées</th>
                  <th className="px-4 py-3 font-bold text-right">Redevance (20 F)</th>
                  <th className="px-4 py-3 font-bold">Statut</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-neutral-800/80'}`}>
                {businesses.map((b) => {
                  const fee = b.totalSalesCount * b.developerFeeRate;
                  return (
                    <tr key={b.id} className={`transition-colors ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-neutral-850/50'
                    }`}>
                      <td className="px-4 py-3">
                        <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{b.name}</div>
                        <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                          {b.address} · {b.phone}
                        </div>
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>{b.tradeType}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono uppercase font-bold px-2 py-0.5 rounded border ${
                          isLight
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-purple-950/40 text-purple-400 border-purple-800'
                        }`}>
                          {b.subscriptionPlan}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-mono ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>
                        {b.subscriptionExpiresAt}
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold tabular-nums ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}>
                        {b.totalSalesCount}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${
                        isLight ? 'text-purple-800' : 'text-purple-400'
                      }`}>
                        {formatMoney(fee)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            b.subscriptionStatus === 'active'
                              ? isLight
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                              : b.subscriptionStatus === 'trial'
                              ? isLight
                                ? 'bg-cyan-100 text-cyan-800 border-cyan-300'
                                : 'bg-cyan-950/40 text-cyan-400 border-cyan-800'
                              : isLight
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-rose-950/40 text-rose-400 border-rose-800'
                          }`}
                        >
                          {b.subscriptionStatus === 'active' ? 'Actif' : b.subscriptionStatus === 'trial' ? 'Essai' : 'Suspendu'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRenewSubscription(b)}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                              isLight
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-emerald-400'
                            }`}
                            title="Renouveler abonnement"
                          >
                            Renouveler
                          </button>
                          <button
                            onClick={() => handleToggleBusinessStatus(b)}
                            className={`p-1.5 rounded transition-colors ${
                              b.subscriptionStatus === 'active'
                                ? isLight
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-neutral-400 hover:text-rose-400 hover:bg-neutral-800'
                                : isLight
                                ? 'text-emerald-700 hover:bg-emerald-50'
                                : 'text-emerald-400 hover:bg-neutral-800'
                            }`}
                            title={b.subscriptionStatus === 'active' ? 'Suspendre l\'accès' : 'Débloquer l\'accès'}
                          >
                            {b.subscriptionStatus === 'active' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT & PASSWORD RESETS */}
      {activeTab === 'users' && (
        <div className={`rounded-xl overflow-hidden border ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900 border-neutral-800'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              Gestion Globale des Utilisateurs & Mots de Passe
            </h3>
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              {users.length} comptes enregistrés
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${
                isLight ? 'bg-slate-100/70 border-slate-200 text-slate-700' : 'bg-neutral-950/80 border-neutral-800 text-neutral-400'
              }`}>
                <tr>
                  <th className="px-4 py-3 font-bold">Nom & Email</th>
                  <th className="px-4 py-3 font-bold">Commerce associé</th>
                  <th className="px-4 py-3 font-bold">Rôle</th>
                  <th className="px-4 py-3 font-bold">Code PIN / Mot de Passe</th>
                  <th className="px-4 py-3 font-bold">Dernière Connexion</th>
                  <th className="px-4 py-3 font-bold">Statut</th>
                  <th className="px-4 py-3 font-bold text-right">Actions Développeur</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-neutral-800/80'}`}>
                {users.map((u) => {
                  const userBiz = businesses.find((b) => b.id === u.businessId);

                  return (
                    <tr key={u.id} className={`transition-colors ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-neutral-850/50'
                    }`}>
                      <td className="px-4 py-3">
                        <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{u.name}</div>
                        <div className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>{u.email}</div>
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                        {u.businessId === 'all' ? (
                          <span className={`font-semibold ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>Plateforme Globale</span>
                        ) : (
                          userBiz?.name || u.businessId
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-[11px] uppercase px-2 py-0.5 rounded border ${
                          isLight
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-neutral-950 text-neutral-300 border-neutral-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-mono font-bold ${
                        isLight ? 'text-amber-800' : 'text-amber-400'
                      }`}>
                        {u.pinCode || '••••••'}
                      </td>
                      <td className={`px-4 py-3 font-mono ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>{u.lastLogin}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'active'
                              ? isLight
                                ? 'text-emerald-800 bg-emerald-100'
                                : 'text-emerald-400 bg-emerald-950/40'
                              : isLight
                              ? 'text-rose-800 bg-rose-100'
                              : 'text-rose-400 bg-rose-950/40'
                          }`}
                        >
                          {u.status === 'active' ? 'Actif' : 'Suspendu'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => triggerResetPassword(u)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ml-auto border ${
                            isLight
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-amber-400 border-neutral-700'
                          }`}
                          title="Générer un nouveau mot de passe / code PIN"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Réinitialiser MDP</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PUSH NOTIFICATIONS CENTER */}
      {activeTab === 'notifications' && (
        <div className={`rounded-xl overflow-hidden space-y-4 p-5 border ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900 border-neutral-800'
        }`}>
          <div className={`flex items-center justify-between pb-3 border-b ${
            isLight ? 'border-slate-200' : 'border-neutral-800'
          }`}>
            <div>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                <BellRing className="w-4 h-4 text-purple-500" />
                <span>Centre de Notifications Push Automatisées</span>
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Historique des alertes système, paliers de vente atteints et alertes de stock critique.
              </p>
            </div>
            <button
              onClick={() => store.markAllNotificationsAsRead()}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              }`}
            >
              Tout marquer comme lu
            </button>
          </div>

          <div className="space-y-2.5">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                  n.read
                    ? isLight
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-neutral-950/60 border-neutral-800/60'
                    : isLight
                    ? 'bg-purple-50/60 border-purple-300'
                    : 'bg-neutral-950 border-purple-500/40 ring-1 ring-purple-500/20'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{n.title}</span>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                      · {formatDate(n.timestamp)}
                    </span>
                    {n.businessName && (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        isLight ? 'bg-slate-200 text-slate-700' : 'bg-neutral-900 text-neutral-400'
                      }`}>
                        {n.businessName}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>{n.message}</p>
                </div>

                {!n.read && (
                  <button
                    onClick={() => store.markNotificationAsRead(n.id)}
                    className="text-[11px] text-purple-600 hover:underline shrink-0 font-semibold"
                  >
                    Marquer lu
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Password Reset */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl border ${
            isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
          }`}>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span>Réinitialisation du Mot de Passe</span>
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>
              Utilisateur : <strong className={isLight ? 'text-slate-900' : 'text-white'}>{resetTargetUser.name}</strong> ({resetTargetUser.email})
            </p>

            <div className={`p-3 rounded-lg text-center space-y-1 border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
            }`}>
              <span className={`text-[11px] block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Nouveau code temporaire généré :
              </span>
              <span className={`font-mono text-xl font-bold tracking-wider ${
                isLight ? 'text-amber-800' : 'text-amber-400'
              }`}>
                {generatedPassword}
              </span>
            </div>

            {resetPinSuccess ? (
              <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              }`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Identifiants mis à jour ! Transmettez ce code à l'utilisateur.</span>
              </div>
            ) : null}

            <div className={`flex justify-end gap-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className={`px-3.5 py-1.5 rounded text-xs font-medium ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                Fermer
              </button>
              {!resetPinSuccess && (
                <button
                  type="button"
                  onClick={confirmPasswordReset}
                  className={`px-4 py-1.5 font-bold rounded text-xs ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-neutral-950'
                  }`}
                >
                  Appliquer la modification
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Business */}
      {showAddBizModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
            isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${
              isLight ? 'border-slate-200' : 'border-neutral-800'
            }`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <Building2 className="w-4 h-4 text-purple-500" />
                <span>Enregistrer un Nouveau Commerce</span>
              </h3>
              <button
                onClick={() => setShowAddBizModal(false)}
                className={`p-1 rounded ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-400 hover:text-white'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBusiness} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Nom commercial de l'établissement
                </label>
                <input
                  type="text"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  placeholder="Ex: Épicerie Moderne Riviera"
                  required
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Secteur d'activité</label>
                <select
                  value={newBizTrade}
                  onChange={(e) => setNewBizTrade(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                  }`}
                >
                  <option value="Télécom">Télécom</option>
                  <option value="Alimentation & Épicerie">Alimentation & Épicerie</option>
                  <option value="Santé & Pharmacie">Santé & Pharmacie</option>
                  <option value="Prêt-à-porter & Mode">Prêt-à-porter & Mode</option>
                  <option value="Quincaillerie & Outillage">Quincaillerie & Outillage</option>
                  <option value="Cosmétique & Beauté">Cosmétique & Beauté</option>
                </select>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Nom du Propriétaire / Gérant</label>
                <input
                  type="text"
                  value={newBizOwner}
                  onChange={(e) => setNewBizOwner(e.target.value)}
                  placeholder="Ex: M. Jean Kouassi"
                  required
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Formule d'Abonnement Caisse Pro</label>
                <select
                  value={newBizPlan}
                  onChange={(e) => setNewBizPlan(e.target.value as SubscriptionPlan)}
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                  }`}
                >
                  <option value="starter">Starter (Idéal micro-commerce)</option>
                  <option value="pro">Pack Pro (Recommandé - multi-caissiers)</option>
                  <option value="enterprise">Enterprise (Illimité & Support 24/7)</option>
                </select>
              </div>

              <div className={`pt-3 flex justify-end gap-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                <button
                  type="button"
                  onClick={() => setShowAddBizModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Déployer le Commerce
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Broadcast Push Notification */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
            isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${
              isLight ? 'border-slate-200' : 'border-neutral-800'
            }`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <Send className="w-4 h-4 text-purple-500" />
                <span>Émettre une Notification Push Automatisée</span>
              </h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className={`p-1 rounded ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-400 hover:text-white'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Titre de la notification</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Ex: Mise à jour système v2.4"
                  required
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Message d'alerte</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Détails du message pour les commerçants..."
                  required
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Destinataires</label>
                  <select
                    value={broadcastTargetRole}
                    onChange={(e) => setBroadcastTargetRole(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                        : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                    }`}
                  >
                    <option value="all">Tous les rôles</option>
                    <option value="owner">Propriétaires uniquement</option>
                    <option value="manager">Gérants uniquement</option>
                    <option value="cashier">Caissiers uniquement</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Priorité</label>
                  <select
                    value={broadcastPriority}
                    onChange={(e) => setBroadcastPriority(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-purple-600'
                        : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-purple-500'
                    }`}
                  >
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente (Bannière)</option>
                  </select>
                </div>
              </div>

              <div className={`pt-3 flex justify-end gap-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Diffuser Instantanément
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
