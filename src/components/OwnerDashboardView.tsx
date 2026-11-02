import React, { useState, useEffect, useMemo } from 'react';
import { Business, SaleTransaction, User, CashRegisterSession } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney, formatDate, formatTimeOnly, formatShortMoney } from '../utils/formatters';
import { getMondayToSundayWeek, WeekRange } from '../utils/dateUtils';
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
  Building2,
  Phone,
  MapPin,
  Edit3,
  Save,
  Check,
  Copy,
  Store,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  Award,
  BarChart3,
  Printer,
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { WeeklyReportModal } from './WeeklyReportModal';
import { ZReportModal } from './ZReportModal';

interface OwnerDashboardViewProps {
  currentUser: User;
  business: Business;
}

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({ currentUser, business }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Dynamic business data
  const [currentBiz, setCurrentBiz] = useState<Business>(() => store.getBusiness(business.id) || business);

  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<SaleTransaction | null>(null);
  const [selectedSessionForZ, setSelectedSessionForZ] = useState<CashRegisterSession | null>(null);

  // Edit Business modal state
  const [showEditBizModal, setShowEditBizModal] = useState<boolean>(false);
  const [editBizName, setEditBizName] = useState<string>(currentBiz.name);
  const [editBizTrade, setEditBizTrade] = useState<string>(currentBiz.tradeType);
  const [editBizPhone, setEditBizPhone] = useState<string>(currentBiz.phone);
  const [editBizAddress, setEditBizAddress] = useState<string>(currentBiz.address);
  const [editBizOwner, setEditBizOwner] = useState<string>(currentBiz.ownerName);
  const [editBizCurrency, setEditBizCurrency] = useState<string>(currentBiz.currency || 'FCFA');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedAccessCode, setCopiedAccessCode] = useState<boolean>(false);

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
    const updatedBiz = store.getBusiness(business.id);
    if (updatedBiz) setCurrentBiz(updatedBiz);
    setTransactions(store.getTransactions(business.id));
    setUsers(store.getUsers().filter((u) => u.businessId === business.id));
    setSessions(store.getSessions(business.id));
  };

  useEffect(() => {
    refreshData();
    const unsub = store.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, [business.id]);

  // Weekly report modal & week navigation state
  const [showWeeklyReportModal, setShowWeeklyReportModal] = useState<boolean>(false);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);

  // Financial calculations
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayDateStr.slice(0, 7);

  // Daily CA (today)
  const todayTransactions = transactions.filter((t) => t.timestamp.startsWith(todayDateStr));
  const dailyRevenue = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Strict ISO Monday-to-Sunday Weekly CA calculation
  const currentWeekRange: WeekRange = useMemo(() => {
    return getMondayToSundayWeek(new Date(), selectedWeekOffset);
  }, [selectedWeekOffset]);

  const currentWeekTransactions = useMemo(() => {
    const mondayStart = currentWeekRange.monday.getTime();
    const sundayEnd = currentWeekRange.sunday.getTime();
    return transactions.filter((t) => {
      if (t.businessId !== business.id) return false;
      const tTime = new Date(t.timestamp.replace(' ', 'T')).getTime();
      return tTime >= mondayStart && tTime <= sundayEnd;
    });
  }, [transactions, business.id, currentWeekRange]);

  const weeklyRevenueStrict = useMemo(() => {
    return currentWeekTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
  }, [currentWeekTransactions]);

  // 7-day breakdown (Lundi à Dimanche) for interactive week chart
  const weekDaysChart = useMemo(() => {
    return currentWeekRange.days.map((d) => {
      const dayTx = currentWeekTransactions.filter((t) => t.timestamp.startsWith(d.dateStr));
      const ca = dayTx.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        ...d,
        ca,
        ticketsCount: dayTx.length,
      };
    });
  }, [currentWeekRange.days, currentWeekTransactions]);

  const maxDayCA = useMemo(() => {
    return Math.max(...weekDaysChart.map((d) => d.ca), 1);
  }, [weekDaysChart]);

  const peakWeekDay = useMemo(() => {
    let peak = weekDaysChart[0];
    for (const d of weekDaysChart) {
      if (d.ca > peak.ca) peak = d;
    }
    return peak.ca > 0 ? peak : null;
  }, [weekDaysChart]);

  // Monthly CA (this month)
  const monthlyTransactions = transactions.filter((t) => t.timestamp.startsWith(currentMonthStr));
  const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Sales counter & stats
  const totalSalesCount = business.totalSalesCount || transactions.length;

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

  // Open Edit Business modal pre-filled
  const handleOpenEditBizModal = () => {
    const freshBiz = store.getBusiness(business.id) || currentBiz;
    setCurrentBiz(freshBiz);
    setEditBizName(freshBiz.name);
    setEditBizTrade(freshBiz.tradeType);
    setEditBizPhone(freshBiz.phone);
    setEditBizAddress(freshBiz.address);
    setEditBizOwner(freshBiz.ownerName);
    setEditBizCurrency(freshBiz.currency || 'FCFA');
    setSaveSuccessMsg(null);
    setShowEditBizModal(true);
    playSoundEffect('beep');
  };

  // Save Business modifications
  const handleSaveBusinessInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBizName.trim()) return;

    const updates: Partial<Business> = {
      name: editBizName.trim(),
      tradeType: editBizTrade.trim(),
      phone: editBizPhone.trim(),
      address: editBizAddress.trim(),
      ownerName: editBizOwner.trim(),
      currency: editBizCurrency.trim() || 'FCFA',
    };

    store.updateBusiness(currentBiz.id, updates);

    // If owner updated their own name, sync currentUser profile
    if (editBizOwner.trim() && currentUser.role === 'owner') {
      store.updateUser(currentUser.id, {
        name: `${editBizOwner.trim()} (Propriétaire)`,
        phone: editBizPhone.trim() || currentUser.phone,
      });
    }

    const updated = store.getBusiness(currentBiz.id);
    if (updated) setCurrentBiz(updated);

    playSoundEffect('cash');
    setSaveSuccessMsg('Informations de votre commerce enregistrées avec succès !');

    setTimeout(() => {
      setSaveSuccessMsg(null);
      setShowEditBizModal(false);
    }, 1200);
  };

  const handleCopyAccessCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedAccessCode(true);
    playSoundEffect('beep');
    setTimeout(() => setCopiedAccessCode(false), 2500);
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
              {currentBiz.name}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Performances Financières & Équipe
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleOpenEditBizModal}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border border-cyan-500/40'
            }`}
            title="Modifier le nom, téléphone, adresse et informations de votre commerce"
          >
            <Settings className="w-4 h-4 text-amber-500" />
            <span>Modifier mon Commerce</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddUserModal(true)}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
              isLight
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-[0_0_12px_rgba(0,242,254,0.6)]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Créer Accès Gérant / Caissier</span>
          </button>
        </div>
      </div>

      {/* INFORMATIONS COMMERCIALES & FICHE ÉTABLISSEMENT */}
      <div className={`p-4 md:p-5 rounded-2xl border transition-all ${
        isLight
          ? 'bg-white border-slate-200 shadow-xs'
          : 'bg-[#0a0e1e] border-cyan-500/25 shadow-[0_0_15px_rgba(0,242,254,0.08)]'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 ${
              isLight ? 'bg-amber-100 text-amber-800' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}>
              <Store className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-extrabold tracking-tight">
                  {currentBiz.name}
                </h2>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-neutral-900 text-cyan-300 border-cyan-500/30'
                }`}>
                  {currentBiz.tradeType}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                }`}>
                  Formule {currentBiz.subscriptionPlan.toUpperCase()}
                </span>
              </div>

              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${
                isLight ? 'text-slate-600' : 'text-neutral-300'
              }`}>
                {currentBiz.phone && (
                  <span className="flex items-center gap-1 font-medium">
                    <Phone className="w-3.5 h-3.5 opacity-60 text-amber-500" />
                    <span>{currentBiz.phone}</span>
                  </span>
                )}
                {currentBiz.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 opacity-60 text-rose-500" />
                    <span>{currentBiz.address}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 opacity-60 text-emerald-500" />
                  <span>Gérant(e) : <strong>{currentBiz.ownerName}</strong></span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center flex-wrap">
            {/* Session access code badge with copy */}
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-neutral-950 border-neutral-800 text-amber-300'
            }`}>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider block opacity-70">
                  Code Session Caisse
                </span>
                <span className="font-mono font-black text-sm tracking-widest">
                  {currentBiz.accessCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyAccessCode(currentBiz.accessCode)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  copiedAccessCode
                    ? 'bg-emerald-500 text-white'
                    : isLight
                    ? 'hover:bg-amber-100 text-amber-800'
                    : 'hover:bg-neutral-800 text-neutral-300'
                }`}
                title="Copier le code de session caisse pour vos caissiers"
              >
                {copiedAccessCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenEditBizModal}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isLight
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-[0_0_10px_rgba(0,242,254,0.4)]'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>Modifier les informations</span>
            </button>
          </div>
        </div>
      </div>

      {/* SYNTHÈSE D'ACTIVITÉ & PERFORMANCE COMMERCIALE DU COMMERCE */}
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
                Activité Commerciale Magasin
              </span>
              <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                · Données confidentielles propriétaire
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold">
              Synthèse d'Activité & Encaissements de votre Établissement
            </h2>
            <p className={`text-xs max-w-2xl leading-relaxed ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>
              Suivi en temps réel de votre chiffre d'affaires, du volume de tickets émis par vos caissiers et du panier moyen de vos clients. Toutes vos opérations sont enregistrées et synchronisées de manière sécurisée.
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
                Total Ventes Réalisées
              </span>
              <span className="text-2xl md:text-3xl font-extrabold font-mono tabular-nums">
                {totalSalesCount}
              </span>
              <span className={`text-[10px] block ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                tickets enregistrés
              </span>
            </div>

            <div className={`w-px h-10 ${isLight ? 'bg-slate-200' : 'bg-neutral-800'}`} />

            <div>
              <span className={`text-[11px] block font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                Chiffre d'Affaires Mensuel
              </span>
              <span className={`text-2xl md:text-3xl font-extrabold font-mono tabular-nums ${
                isLight ? 'text-emerald-600' : 'text-emerald-300 neon-text-green'
              }`}>
                {formatMoney(monthlyRevenue)}
              </span>
              <span className={`text-[10px] block flex items-center gap-1 font-medium ${
                isLight ? 'text-emerald-700' : 'text-emerald-400'
              }`}>
                <CheckCircle className="w-3 h-3" />
                <span>Panier moyen : {formatMoney(avgBasket)}</span>
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

        {/* CA Hebdomadaire (Strict Lundi à Dimanche) */}
        <div className={`p-4 rounded-xl space-y-2 border relative transition-all ${
          isLight
            ? 'bg-white border-slate-200 shadow-xs hover:border-blue-300'
            : 'bg-[#0a0d1e] border-cyan-500/25 shadow-[0_0_12px_rgba(0,242,254,0.08)] hover:border-cyan-400/50'
        }`}>
          <div className="flex items-center justify-between text-xs opacity-70">
            <span className="font-semibold">CA Hebdomadaire (Lun. à Dim.)</span>
            <Calendar className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-cyan-400'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono tabular-nums">
            {formatMoney(weeklyRevenueStrict, currentBiz.currency || 'FCFA')}
          </div>
          <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${
            isLight ? 'border-slate-100 text-slate-500' : 'border-neutral-800 text-neutral-400'
          }`}>
            <span className="truncate">{currentWeekTransactions.length} vente(s) · Sem. {currentWeekRange.weekNumber}</span>
            <button
              type="button"
              onClick={() => setShowWeeklyReportModal(true)}
              className={`font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                isLight ? 'text-blue-600 hover:text-blue-800' : 'text-cyan-400 hover:text-cyan-300'
              }`}
              title="Ouvrir le rapport hebdomadaire complet"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Rapport</span>
            </button>
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

      {/* SECTION ANALYSE HEBDOMADAIRE (LUNDI À DIMANCHE) AVEC GRAPHIQUE & RAPPORT */}
      <div className={`p-5 md:p-6 rounded-2xl border space-y-5 transition-all ${
        isLight
          ? 'bg-white border-slate-200 shadow-xs'
          : 'bg-[#0a0d1e] border-cyan-500/25 shadow-[0_0_15px_rgba(0,242,254,0.08)]'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-inherit">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                isLight
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-cyan-950/40 text-cyan-300 border-cyan-800'
              }`}>
                Cycle Hebdomadaire · Lundi à Dimanche
              </span>
              <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Semaine ISO N° {currentWeekRange.weekNumber} / {currentWeekRange.year}
              </span>
            </div>
            <h3 className="text-base md:text-lg font-extrabold flex items-center gap-2">
              <BarChart3 className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-cyan-400'}`} />
              <span>Chiffre d'Affaires Hebdomadaire ({currentWeekRange.shortLabel})</span>
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Calcul comptable du lundi 00:00 au dimanche 23:59 avec répartition journalière et détection automatique du pic de ventes.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            {/* Week navigation buttons */}
            <div className={`flex items-center rounded-xl border p-1 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-neutral-800'
            }`}>
              <button
                type="button"
                onClick={() => setSelectedWeekOffset((p) => p - 1)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-white text-slate-700' : 'hover:bg-neutral-800 text-neutral-300'
                }`}
                title="Semaine précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedWeekOffset(0)}
                disabled={selectedWeekOffset === 0}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  selectedWeekOffset === 0
                    ? isLight
                      ? 'bg-blue-600 text-white'
                      : 'bg-cyan-500 text-neutral-950'
                    : isLight
                    ? 'text-slate-600 hover:bg-white'
                    : 'text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                Cette Semaine
              </button>
              <button
                type="button"
                onClick={() => setSelectedWeekOffset((p) => p + 1)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-white text-slate-700' : 'hover:bg-neutral-800 text-neutral-300'
                }`}
                title="Semaine suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* View Full Report Button */}
            <button
              type="button"
              onClick={() => setShowWeeklyReportModal(true)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-[0_0_12px_rgba(0,242,254,0.4)]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Générer le Rapport Hebdomadaire</span>
            </button>
          </div>
        </div>

        {/* 7-DAY VISUAL BAR CHART (Lundi à Dimanche) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1">
          {weekDaysChart.map((d) => {
            const heightPercent = maxDayCA > 0 ? Math.max(8, Math.round((d.ca / maxDayCA) * 100)) : 8;
            const isPeak = peakWeekDay && peakWeekDay.dateStr === d.dateStr && d.ca > 0;

            return (
              <div
                key={d.dateStr}
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  d.isToday
                    ? isLight
                      ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/30'
                      : 'bg-cyan-950/30 border-cyan-400 ring-2 ring-cyan-500/20'
                    : isLight
                    ? 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/60'
                    : 'bg-[#060814]/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-xs">{d.dayName}</span>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                      {d.formattedDate}
                    </span>
                  </div>
                  {isPeak && (
                    <span title="Jour record de vente">
                      <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    </span>
                  )}
                  {d.isToday && !isPeak && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Aujourd'hui" />
                  )}
                </div>

                {/* Vertical visual bar indicator */}
                <div className="h-24 w-full flex items-end justify-center py-1">
                  <div className="w-full bg-slate-200 dark:bg-neutral-800/80 rounded-lg h-full p-1 flex items-end">
                    <div
                      className={`w-full rounded-md transition-all duration-500 ${
                        isPeak
                          ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                          : d.ca > 0
                          ? isLight
                            ? 'bg-blue-500'
                            : 'bg-cyan-400'
                          : 'bg-transparent'
                      }`}
                      style={{ height: `${d.ca > 0 ? heightPercent : 4}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-inherit text-center">
                  <div className="font-mono font-black text-xs tabular-nums">
                    {formatShortMoney(d.ca)}
                  </div>
                  <div className={`text-[10px] flex items-center justify-center gap-1 ${
                    isLight ? 'text-slate-500' : 'text-neutral-400'
                  }`}>
                    <span>{d.ticketsCount} vente(s)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Summary Footer Ribbon */}
        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060814] border-cyan-500/15'
        }`}>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="opacity-60 block text-[10px]">Total CA Semaine :</span>
              <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(weeklyRevenueStrict, currentBiz.currency || 'FCFA')}
              </strong>
            </div>
            <div className={`w-px h-6 ${isLight ? 'bg-slate-200' : 'bg-neutral-800'}`} />
            <div>
              <span className="opacity-60 block text-[10px]">Total Tickets Encaissés :</span>
              <strong className="text-sm font-mono">{currentWeekTransactions.length} ventes</strong>
            </div>
            {peakWeekDay && (
              <>
                <div className={`w-px h-6 ${isLight ? 'bg-slate-200' : 'bg-neutral-800'}`} />
                <div>
                  <span className="opacity-60 block text-[10px]">Jour le plus rentable :</span>
                  <strong className="text-amber-500">
                    {peakWeekDay.dayName} ({formatShortMoney(peakWeekDay.ca)} {currentBiz.currency || 'FCFA'})
                  </strong>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowWeeklyReportModal(true)}
            className={`font-bold flex items-center gap-1.5 text-xs self-start sm:self-auto cursor-pointer ${
              isLight ? 'text-blue-600 hover:text-blue-800' : 'text-cyan-400 hover:text-cyan-300'
            }`}
          >
            <span>Consulter le rapport officiel & exports</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
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
                <th className="px-4 py-2.5 font-semibold text-center">Articles</th>
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
                  <td className={`px-4 py-2.5 text-center font-mono font-bold ${
                    isLight ? 'text-slate-700' : 'text-neutral-300'
                  }`}>
                    {tx.items.reduce((s, it) => s + it.quantity, 0)} art.
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

      {/* HISTORIQUE DES CLÔTURES DE CAISSE & RAPPORTS Z */}
      <div className={`rounded-xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#0a0d1e] border-cyan-500/25'
      }`}>
        <div className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060814] border-cyan-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-500" />
            <div>
              <h3 className="text-sm font-bold">Historique des Clôtures de Caisse & Rapports Z</h3>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Rapports de fin de journée, contrôle du tiroir-caisse et détection des écarts
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            {sessions.filter((s) => s.status === 'closed').length} clôture(s) archivée(s)
          </span>
        </div>

        {sessions.filter((s) => s.status === 'closed').length === 0 ? (
          <div className="p-8 text-center text-xs opacity-60">
            Aucune clôture de caisse archivée pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b sticky top-0 ${
                isLight ? 'bg-slate-50/95 border-slate-200 text-slate-500' : 'bg-[#060814]/95 border-cyan-500/20 text-neutral-400'
              }`}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Rapport Z & Date</th>
                  <th className="px-4 py-3 font-semibold">Caissier(ère)</th>
                  <th className="px-4 py-3 font-semibold text-center">Ventes / Tickets</th>
                  <th className="px-4 py-3 font-semibold text-right">CA Net</th>
                  <th className="px-4 py-3 font-semibold text-right">Espèces Attendues</th>
                  <th className="px-4 py-3 font-semibold text-right">Espèces Comptées</th>
                  <th className="px-4 py-3 font-semibold text-center">Écart Constaté</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-neutral-800/80'}`}>
                {sessions
                  .filter((s) => s.status === 'closed')
                  .map((s) => {
                    const diff = s.cashDifference || 0;
                    const isPerfect = diff === 0;
                    const isSurplus = diff > 0;
                    const zNum = s.zNumber || `Z-${s.id.slice(-6).toUpperCase()}`;

                    return (
                      <tr key={s.id} className={isLight ? 'hover:bg-slate-50/80 transition-colors' : 'hover:bg-[#0f142b] transition-colors'}>
                        <td className="px-4 py-3">
                          <span className="font-bold block text-xs">{zNum}</span>
                          <span className={`text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                            {s.closedAt ? formatDate(s.closedAt) : formatDate(s.openedAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {s.cashierName}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          <span className="font-bold">{s.totalSalesCount}</span> tickets
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatMoney(s.totalSalesAmount, currentBiz.currency || 'FCFA')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono opacity-80">
                          {formatMoney(s.expectedCash, currentBiz.currency || 'FCFA')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {formatMoney(s.actualCash || 0, currentBiz.currency || 'FCFA')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            isPerfect
                              ? isLight
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
                              : isSurplus
                              ? isLight
                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                : 'bg-cyan-950/40 text-cyan-300 border border-cyan-800'
                              : isLight
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-800'
                          }`}>
                            {isPerfect ? '0 F (Parfait)' : isSurplus ? `+${formatMoney(diff, '')} (Excédent)` : `${formatMoney(diff, '')} (Déficit)`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSessionForZ(s)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 ml-auto transition-colors cursor-pointer ${
                              isLight
                                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                                : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
                            }`}
                            title="Voir et réimprimer le rapport de caisse Z"
                          >
                            <Printer className="w-3.5 h-3.5 text-rose-500" />
                            <span>Ticket Z</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
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

      {/* Modal: Modifier les Informations du Commerce */}
      {showEditBizModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className={`rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border my-8 ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0a0e1e] border-cyan-500/40 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              isLight ? 'border-slate-200' : 'border-neutral-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  isLight ? 'bg-amber-100 text-amber-800' : 'bg-cyan-500/20 text-cyan-400'
                }`}>
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Modifier les Informations de votre Commerce</h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                    Personnalisez votre enseigne, coordonnées et l'en-tête de vos reçus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditBizModal(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveBusinessInfo} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1 opacity-90">
                    Nom commercial de l'établissement *
                  </label>
                  <input
                    type="text"
                    value={editBizName}
                    onChange={(e) => setEditBizName(e.target.value)}
                    placeholder="Ex: Supermarché Express Cocody"
                    required
                    className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border text-sm font-bold ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                        : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                    }`}
                  />
                  <span className={`text-[10px] mt-0.5 block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                    Ce nom s'affiche en haut de l'écran de caisse et sur l'ensemble des tickets imprimés.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold mb-1 opacity-90">
                    Secteur d'activité *
                  </label>
                  <select
                    value={editBizTrade}
                    onChange={(e) => setEditBizTrade(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                        : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                    }`}
                  >
                    <option value="Alimentation & Épicerie">Alimentation & Épicerie</option>
                    <option value="Télécom & Services Digitaux">Télécom & Services Digitaux</option>
                    <option value="Santé & Pharmacie">Santé & Pharmacie</option>
                    <option value="Prêt-à-porter & Mode">Prêt-à-porter & Mode</option>
                    <option value="Quincaillerie & BTP">Quincaillerie & BTP</option>
                    <option value="Cosmétique & Beauté">Cosmétique & Beauté</option>
                    <option value="Restauration & Fast-Food">Restauration & Fast-Food</option>
                    <option value="Commerce Général">Commerce Général</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 opacity-90">
                    Numéro de téléphone commercial *
                  </label>
                  <input
                    type="tel"
                    value={editBizPhone}
                    onChange={(e) => setEditBizPhone(e.target.value)}
                    placeholder="Ex: +225 07 48 92 11 00"
                    required
                    className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                        : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                    }`}
                  />
                  <span className={`text-[10px] mt-0.5 block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                    Numéro de contact imprimé pour vos clients.
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1 opacity-90">
                    Adresse géographique & Ville *
                  </label>
                  <input
                    type="text"
                    value={editBizAddress}
                    onChange={(e) => setEditBizAddress(e.target.value)}
                    placeholder="Ex: Boulevard Latrille, Cocody Angré, Abidjan"
                    required
                    className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                        : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 opacity-90">
                    Nom du Propriétaire / Gérant
                  </label>
                  <input
                    type="text"
                    value={editBizOwner}
                    onChange={(e) => setEditBizOwner(e.target.value)}
                    placeholder="Ex: Amadou Diallo"
                    required
                    className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                        : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 opacity-90">
                    Devise Monétaire
                  </label>
                  <input
                    type="text"
                    value={editBizCurrency}
                    onChange={(e) => setEditBizCurrency(e.target.value)}
                    placeholder="FCFA"
                    className={`w-full px-3 py-2 rounded-lg focus:outline-hidden border font-mono ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                        : 'bg-[#060814] border-cyan-500/30 text-white focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              {/* Aperçu en direct de l'en-tête du ticket thermique */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${
                isLight ? 'bg-slate-100 border-slate-300 text-black' : 'bg-neutral-950 border-neutral-800 text-neutral-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-70">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Aperçu en direct sur vos tickets de caisse</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-60">Format thermique 80mm / 58mm</span>
                </div>
                <div className="bg-white text-black p-3.5 rounded-lg border-2 border-black text-center font-sans space-y-1 shadow-xs">
                  <div className="font-black text-sm uppercase tracking-wide">
                    {editBizName || 'NOM DE VOTRE COMMERCE'}
                  </div>
                  {editBizAddress && (
                    <div className="text-xs font-bold text-black">{editBizAddress}</div>
                  )}
                  {editBizPhone && (
                    <div className="text-xs font-bold text-black">Tél: {editBizPhone}</div>
                  )}
                  <div className="text-[11px] font-bold text-black border-t border-dashed border-black pt-1 mt-1">
                    Commerce Enregistré · Système Caisse Pro
                  </div>
                </div>
              </div>

              <div className={`pt-3 flex items-center justify-between border-t ${
                isLight ? 'border-slate-200' : 'border-neutral-800'
              }`}>
                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                  Code session caisse : <strong>{currentBiz.accessCode}</strong>
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditBizModal(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                      isLight
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-extrabold shadow-[0_0_12px_rgba(0,242,254,0.6)]'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    <span>Enregistrer les Modifications</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Weekly Report Modal */}
      {showWeeklyReportModal && (
        <WeeklyReportModal
          business={currentBiz}
          transactions={transactions}
          users={users}
          isLight={isLight}
          initialWeekOffset={selectedWeekOffset}
          onClose={() => setShowWeeklyReportModal(false)}
        />
      )}

      {/* Receipt Modal if requested */}
      {selectedTxForReceipt && (
        <ReceiptModal
          transaction={selectedTxForReceipt}
          business={currentBiz}
          onClose={() => setSelectedTxForReceipt(null)}
        />
      )}

      {/* Official Z-Report Modal */}
      {selectedSessionForZ && (
        <ZReportModal
          session={selectedSessionForZ}
          business={currentBiz}
          isLight={isLight}
          onClose={() => setSelectedSessionForZ(null)}
        />
      )}
    </div>
  );
};
