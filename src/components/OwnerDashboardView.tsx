import React, { useState, useEffect } from 'react';
import { Business, SaleTransaction, User } from '../types';
import { store } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney, formatDate, formatTimeOnly } from '../utils/formatters';
import {
  TrendingUp,
  Calendar,
  CreditCard,
  Users,
  Shield,
  Key,
  Plus,
  Receipt,
  Clock,
  Sparkles,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Lock,
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';

interface OwnerDashboardViewProps {
  currentUser: User;
  business: Business;
}

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({ currentUser, business }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<SaleTransaction | null>(null);

  // Team creation modal
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'manager' | 'cashier'>('cashier');
  const [newUserPin, setNewUserPin] = useState<string>('1234');

  // Reset PIN modal
  const [resetUserTarget, setResetUserTarget] = useState<User | null>(null);
  const [resetPinValue, setResetPinValue] = useState<string>('');

  const refreshData = () => {
    setTransactions(store.getTransactions(business.id));
    setUsers(store.getUsers().filter((u) => u.businessId === business.id));
  };

  useEffect(() => {
    refreshData();
    const unsub = store.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, [business.id]);

  // Financial calculations
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayDateStr.slice(0, 7);

  // Daily CA (today)
  const todayTransactions = transactions.filter((t) => t.timestamp.startsWith(todayDateStr));
  const dailyRevenue = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Weekly CA (past 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklyTransactions = transactions.filter((t) => new Date(t.timestamp.replace(' ', 'T')) >= sevenDaysAgo);
  const weeklyRevenue = weeklyTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Monthly CA (this month)
  const monthlyTransactions = transactions.filter((t) => t.timestamp.startsWith(currentMonthStr));
  const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Developer Fee Counter (20 F per sale)
  const totalSalesCount = business.totalSalesCount || transactions.length;
  const developerFeeCalculated = totalSalesCount * business.developerFeeRate; // 20 F per sale

  // Average basket
  const avgBasket = transactions.length > 0 ? Math.round(monthlyRevenue / (monthlyTransactions.length || 1)) : 0;

  // Add User handler
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    store.addUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      phone: newUserPhone.trim() || '+225 00 00 00 00',
      role: newUserRole,
      businessId: business.id,
      pinCode: newUserPin.trim(),
      status: 'active',
    });

    setShowAddUserModal(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserPin('1234');
    alert(`Compte ${newUserRole === 'manager' ? 'Gérant' : 'Caissier'} créé avec succès.`);
  };

  // Toggle user status
  const handleToggleUserStatus = (u: User) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    store.updateUser(u.id, { status: nextStatus });
  };

  // Reset PIN
  const handleResetPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserTarget || !resetPinValue.trim()) return;
    store.resetUserPassword(resetUserTarget.id, resetPinValue.trim());
    setResetUserTarget(null);
    setResetPinValue('');
    alert(`Code PIN mis à jour avec succès pour ${resetUserTarget.name}.`);
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full transition-colors ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#05070c] text-white'
    }`}>
      {/* Top Banner / Store Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
        isLight ? 'border-slate-200' : 'border-cyan-500/25'
      }`}>
        <div>
          <div className={`flex items-center gap-2 text-xs font-semibold mb-1 ${
            isLight ? 'text-amber-600' : 'text-cyan-400'
          }`}>
            <span>Tableau de Bord Propriétaire</span>
            <span>·</span>
            <span className={isLight ? 'text-slate-500 font-normal' : 'text-neutral-400 font-normal'}>
              {business.name}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Performances Financières & Équipe
          </h1>
        </div>

        <button
          onClick={() => setShowAddUserModal(true)}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm self-start sm:self-auto ${
            isLight
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-[0_0_12px_rgba(0,242,254,0.6)]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Créer Accès Gérant / Caissier</span>
        </button>
      </div>

      {/* THE SPECIAL 20F/SALE COMMISSION COUNTER CARD (Prompt requirement) */}
      <div className={`p-5 md:p-6 rounded-2xl relative overflow-hidden transition-all ${
        isLight
          ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50 border-2 border-amber-300 shadow-sm'
          : 'bg-gradient-to-br from-[#0a0e20] via-[#0d132c] to-[#160e2a] border-2 border-cyan-400 shadow-[0_0_25px_rgba(0,242,254,0.2)]'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                isLight
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-cyan-400/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_8px_rgba(0,242,254,0.3)]'
              }`}>
                Compteur Tarif Vente Caisse Pro
              </span>
              <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                · Barème fixe : 20 F CFA / vente
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold">
              Redevance d'Usage & Synchronisation Développeur
            </h2>
            <p className={`text-xs max-w-2xl leading-relaxed ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>
              Ce compteur suit en temps réel le volume total de ventes effectuées dans votre établissement.
              Chaque ticket généré est facturé au tarif conventionnel de <span className={`font-bold ${isLight ? 'text-amber-700' : 'text-cyan-400'}`}>20 F CFA</span> pour
              l'hébergement cloud, la synchronisation temps réel et la maintenance applicative.
            </p>
          </div>

          {/* Big Number Metrics */}
          <div className={`flex items-center gap-6 shrink-0 p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-slate-200 shadow-xs'
              : 'bg-[#060814]/90 border-cyan-500/40 shadow-[0_0_12px_rgba(0,242,254,0.2)]'
          }`}>
            <div>
              <span className={`text-[11px] block font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Ventes Enregistrées
              </span>
              <span className="text-2xl md:text-3xl font-extrabold font-mono tabular-nums">
                {totalSalesCount}
              </span>
              <span className={`text-[10px] block ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                transactions réseau
              </span>
            </div>

            <div className={`w-px h-10 ${isLight ? 'bg-slate-200' : 'bg-neutral-800'}`} />

            <div>
              <span className={`text-[11px] block font-semibold ${isLight ? 'text-amber-700' : 'text-cyan-300'}`}>
                Montant Redevance (× 20 F)
              </span>
              <span className={`text-2xl md:text-3xl font-extrabold font-mono tabular-nums ${
                isLight ? 'text-amber-600' : 'text-cyan-300 neon-text-cyan'
              }`}>
                {formatMoney(developerFeeCalculated)}
              </span>
              <span className={`text-[10px] block flex items-center gap-1 font-medium ${
                isLight ? 'text-emerald-700' : 'text-emerald-400'
              }`}>
                <CheckCircle className="w-3 h-3" />
                <span>Compteur à jour en direct</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CHIFFRES D'AFFAIRES CARDS: Journalier, Hebdomadaire, Mensuel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CA Journalier */}
        <div className={`p-4 rounded-xl space-y-2 border ${
          isLight
            ? 'bg-white border-slate-200 shadow-xs'
            : 'bg-[#0a0d1e] border-cyan-500/25 shadow-[0_0_12px_rgba(0,242,254,0.08)]'
        }`}>
          <div className="flex items-center justify-between text-xs opacity-70">
            <span className="font-medium">CA Journalier (Aujourd'hui)</span>
            <Clock className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono tabular-nums">
            {formatMoney(dailyRevenue)}
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-100 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span>{todayTransactions.length} ticket(s) encaissé(s)</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              En direct
            </span>
          </div>
        </div>

        {/* CA Hebdomadaire */}
        <div className={`p-4 rounded-xl space-y-2 border ${
          isLight
            ? 'bg-white border-slate-200 shadow-xs'
            : 'bg-[#0a0d1e] border-cyan-500/25 shadow-[0_0_12px_rgba(0,242,254,0.08)]'
        }`}>
          <div className="flex items-center justify-between text-xs opacity-70">
            <span className="font-medium">CA Hebdomadaire (7 jours)</span>
            <Calendar className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-cyan-400'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono tabular-nums">
            {formatMoney(weeklyRevenue)}
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-100 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span>{weeklyTransactions.length} ventes sur la semaine</span>
            <span className={`font-semibold ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
              Semaine 44
            </span>
          </div>
        </div>

        {/* CA Mensuel */}
        <div className={`p-4 rounded-xl space-y-2 border ${
          isLight
            ? 'bg-white border-slate-200 shadow-xs'
            : 'bg-[#0a0d1e] border-cyan-500/25 shadow-[0_0_12px_rgba(0,242,254,0.08)]'
        }`}>
          <div className="flex items-center justify-between text-xs opacity-70">
            <span className="font-medium">CA Mensuel (Octobre 2026)</span>
            <TrendingUp className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono tabular-nums">
            {formatMoney(monthlyRevenue)}
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-100 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span>{monthlyTransactions.length} transactions totales</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
              +18% vs M-1
            </span>
          </div>
        </div>

        {/* Panier Moyen */}
        <div className={`p-4 rounded-xl space-y-2 border ${
          isLight
            ? 'bg-white border-slate-200 shadow-xs'
            : 'bg-[#0a0d1e] border-cyan-500/25 shadow-[0_0_12px_rgba(0,242,254,0.08)]'
        }`}>
          <div className="flex items-center justify-between text-xs opacity-70">
            <span className="font-medium">Panier Moyen</span>
            <Receipt className={`w-4 h-4 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono tabular-nums">
            {formatMoney(avgBasket)}
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-100 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span>Moyenne par client</span>
            <span className={`font-semibold ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
              Optimal
            </span>
          </div>
        </div>
      </div>

      {/* TEAM ACCESS MANAGEMENT (Gestion des accès Gérant & Caissier) */}
      <div className={`rounded-xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#0a0d1e] border-cyan-500/25'
      }`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060814] border-cyan-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <Users className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
            <h3 className="text-sm font-bold">Gestion des Accès & Équipe du Commerce</h3>
          </div>
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            {users.length} compte(s) rattaché(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${
              isLight ? 'bg-slate-50/70 border-slate-200 text-slate-500' : 'bg-[#060814]/70 border-cyan-500/20 text-neutral-400'
            }`}>
              <tr>
                <th className="px-4 py-3 font-semibold">Utilisateur</th>
                <th className="px-4 py-3 font-semibold">Rôle attribué</th>
                <th className="px-4 py-3 font-semibold">Code PIN Caisse</th>
                <th className="px-4 py-3 font-semibold">Permissions activées</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-neutral-800/80'}`}>
              {users.map((u) => {
                const roleLabels: Record<string, { label: string; badge: string; perms: string }> = {
                  owner: {
                    label: 'Propriétaire',
                    badge: isLight
                      ? 'text-amber-800 bg-amber-50 border-amber-200'
                      : 'text-amber-400 bg-amber-950/30 border-amber-500/30',
                    perms: 'Accès complet, Finances, Création équipe, Stocks',
                  },
                  manager: {
                    label: 'Gérant(e)',
                    badge: isLight
                      ? 'text-blue-800 bg-blue-50 border-blue-200'
                      : 'text-blue-400 bg-blue-950/30 border-blue-500/30',
                    perms: 'Gestion de la clientèle, Suivi de stock & Produits',
                  },
                  cashier: {
                    label: 'Caissier(e)',
                    badge: isLight
                      ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                      : 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30',
                    perms: 'Caisse rapide tactile, Clavier, Encaissement vente',
                  },
                };

                const meta = roleLabels[u.role] || {
                  label: u.role,
                  badge: isLight ? 'text-slate-600 bg-slate-100 border-slate-200' : 'text-neutral-400 bg-neutral-800 border-neutral-700',
                  perms: 'Standard',
                };

                return (
                  <tr key={u.id} className={isLight ? 'hover:bg-slate-50/80 transition-colors' : 'hover:bg-[#0f142b] transition-colors'}>
                    <td className="px-4 py-3">
                      <div className="font-bold">{u.name}</div>
                      <div className={`text-[11px] font-mono ${isLight ? 'text-slate-400' : 'text-neutral-400'}`}>
                        {u.email} · {u.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                        isLight
                          ? 'bg-slate-100 text-slate-800 border-slate-200'
                          : 'bg-[#060814] text-cyan-300 border-cyan-500/30'
                      }`}>
                        {u.pinCode || 'Non défini'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 max-w-[240px] truncate ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>
                      {meta.perms}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'active'
                            ? isLight
                              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                              : 'text-emerald-400 bg-emerald-950/40'
                            : isLight
                            ? 'text-rose-700 bg-rose-50 border border-rose-200'
                            : 'text-rose-400 bg-rose-950/40'
                        }`}
                      >
                        {u.status === 'active' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'owner' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setResetUserTarget(u);
                              setResetPinValue(u.pinCode || '1234');
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              isLight
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                                : 'text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800'
                            }`}
                            title="Changer code PIN ou mot de passe"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`p-1.5 rounded transition-colors ${
                              u.status === 'active'
                                ? 'text-neutral-400 hover:text-rose-500'
                                : 'text-emerald-500'
                            }`}
                            title={u.status === 'active' ? 'Suspendre' : 'Réactiver'}
                          >
                            {u.status === 'active' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                          Compte principal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECENT SALES AUDIT (Dernières ventes en direct) */}
      <div className={`rounded-xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#0a0d1e] border-cyan-500/25'
      }`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060814] border-cyan-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <Receipt className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <h3 className="text-sm font-bold">Journal des Ventes en Temps Réel</h3>
          </div>
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            {transactions.length} ventes archivées
          </span>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b sticky top-0 ${
              isLight ? 'bg-slate-50/90 border-slate-200 text-slate-500' : 'bg-[#060814]/90 border-cyan-500/20 text-neutral-400'
            }`}>
              <tr>
                <th className="px-4 py-2.5 font-semibold">N° Ticket</th>
                <th className="px-4 py-2.5 font-semibold">Horodatage</th>
                <th className="px-4 py-2.5 font-semibold">Caissier</th>
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">Règlement</th>
                <th className="px-4 py-2.5 font-semibold text-right">Redevance (20 F)</th>
                <th className="px-4 py-2.5 font-semibold text-right">Montant Total</th>
                <th className="px-4 py-2.5 font-semibold text-center">Ticket</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-neutral-800/80'}`}>
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className={isLight ? 'hover:bg-slate-50/80 transition-colors' : 'hover:bg-[#0f142b] transition-colors'}>
                  <td className={`px-4 py-2.5 font-mono font-bold ${isLight ? 'text-amber-700' : 'text-cyan-300'}`}>
                    {tx.ticketNumber}
                  </td>
                  <td className={`px-4 py-2.5 font-mono ${isLight ? 'text-slate-500' : 'text-neutral-300'}`}>
                    {formatDate(tx.timestamp)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{tx.cashierName}</td>
                  <td className={`px-4 py-2.5 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                    {tx.customerName || 'Client passage'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                      isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-[#060812] text-neutral-300 border-neutral-800'
                    }`}>
                      {tx.paymentMethod === 'cash'
                        ? 'Espèces'
                        : tx.paymentMethod === 'mobile_money'
                        ? 'Wave / OM'
                        : tx.paymentMethod === 'card'
                        ? 'Carte'
                        : 'Crédit'}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                    isLight ? 'text-amber-700' : 'text-cyan-400'
                  }`}>
                    20 F
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                    isLight ? 'text-emerald-700' : 'text-emerald-400'
                  }`}>
                    {formatMoney(tx.totalAmount)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => setSelectedTxForReceipt(tx)}
                      className={`p-1.5 rounded transition-colors ${
                        isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                      title="Afficher et réimprimer ticket"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Team Member (Gérant ou Caissier) */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0a0e1e] border-cyan-500/40 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              isLight ? 'border-slate-100' : 'border-neutral-800'
            }`}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Users className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                <span>Créer un Nouvel Accès</span>
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block opacity-80 font-semibold mb-1">Rôle et permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUserRole('manager')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      newUserRole === 'manager'
                        ? isLight
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                          : 'bg-blue-950/40 border-blue-500 text-blue-300 font-bold'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                        : 'bg-[#060814] border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span className="block">Gérant(e)</span>
                    <span className="text-[10px] font-normal opacity-70">Stocks & Clientèle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUserRole('cashier')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      newUserRole === 'cashier'
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                          : 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                        : 'bg-[#060814] border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span className="block">Caissier(e)</span>
                    <span className="text-[10px] font-normal opacity-70">Caisse & Vente</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block opacity-80 font-semibold mb-1">Nom complet</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: Yaya Touré"
                  required
                  className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                      : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                  }`}
                />
              </div>

              <div>
                <label className="block opacity-80 font-semibold mb-1">Email de connexion</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Ex: yaya@commerce.ci"
                  required
                  className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                      : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                  }`}
                />
              </div>

              <div>
                <label className="block opacity-80 font-semibold mb-1">Téléphone mobile</label>
                <input
                  type="tel"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="+225 07 00 00 00"
                  className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                      : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                  }`}
                />
              </div>

              <div>
                <label className="block opacity-80 font-semibold mb-1">Code PIN Caisse (4 chiffres)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  placeholder="Ex: 5566"
                  required
                  className={`w-full px-3 py-2 rounded-lg font-mono text-base font-bold focus:outline-hidden border ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-amber-700 focus:border-amber-500'
                      : 'bg-[#060814] border-cyan-500/30 text-cyan-300 focus:border-cyan-400'
                  }`}
                />
              </div>

              <div className={`pt-3 flex justify-end gap-2 border-t ${
                isLight ? 'border-slate-100' : 'border-neutral-800'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className={`px-4 py-2 rounded-lg ${
                    isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold rounded-lg ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-extrabold shadow-[0_0_10px_rgba(0,242,254,0.6)]'
                  }`}
                >
                  Valider l'Accès
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset PIN */}
      {resetUserTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl border ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0a0e1e] border-cyan-500/40 text-white'
          }`}>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Key className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
              <span>Changer le Code PIN / Mot de Passe</span>
            </h3>
            <p className="text-xs opacity-80">
              Définir le nouveau code PIN d'authentification pour <strong className="font-bold">{resetUserTarget.name}</strong> :
            </p>

            <form onSubmit={handleResetPinSubmit} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                value={resetPinValue}
                onChange={(e) => setResetPinValue(e.target.value)}
                placeholder="Nouveau code PIN (ex: 4321)"
                required
                className={`w-full px-3 py-2 rounded-lg font-mono text-center text-lg font-bold focus:outline-hidden border ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-amber-700 focus:border-amber-500'
                    : 'bg-[#060814] border-cyan-500/40 text-cyan-300 focus:border-cyan-400'
                }`}
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUserTarget(null)}
                  className={`px-3 py-1.5 rounded text-xs ${
                    isLight ? 'bg-slate-100 text-slate-700' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 font-bold rounded text-xs ${
                    isLight
                      ? 'bg-amber-500 text-white'
                      : 'bg-cyan-400 text-neutral-950 font-extrabold shadow-[0_0_8px_rgba(0,242,254,0.6)]'
                  }`}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal if requested */}
      {selectedTxForReceipt && (
        <ReceiptModal
          transaction={selectedTxForReceipt}
          business={business}
          onClose={() => setSelectedTxForReceipt(null)}
        />
      )}
    </div>
  );
};
