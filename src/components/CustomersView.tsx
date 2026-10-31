import React, { useState, useEffect } from 'react';
import { Business, Customer, CreditSettlement, SaleTransaction, User } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  BookOpen,
  MessageCircle,
  Share2,
  Printer,
  Plus,
  History,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Check,
  X,
  Banknote,
  Smartphone,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CustomersViewProps {
  currentUser: User;
  business: Business;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ currentUser, business }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settlements, setSettlements] = useState<CreditSettlement[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'debtors' | 'settled' | 'history'>('debtors');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [settleTarget, setSettleTarget] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [settleNotes, setSettleNotes] = useState<string>('');

  // Customer Ledger Modal (Fiche Carnet de Crédit)
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [adjustDelta, setAdjustDelta] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustReason, setAdjustReason] = useState<string>('Report dette carnet antérieur');

  // WhatsApp Reminder Modal
  const [reminderTarget, setReminderTarget] = useState<Customer | null>(null);
  const [copiedReminder, setCopiedReminder] = useState<boolean>(false);

  // Add customer form
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');
  const [newInitialCredit, setNewInitialCredit] = useState<string>('');

  const refreshData = () => {
    setCustomers(store.getCustomers(business.id));
    setSettlements(store.getCreditSettlements(business.id));
    setTransactions(store.getTransactions(business.id));
  };

  useEffect(() => {
    refreshData();
    const unsub = store.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, [business.id]);

  // Derived metrics
  const debtors = customers.filter((c) => c.creditBalance > 0);
  const settled = customers.filter((c) => c.creditBalance === 0);
  const totalCreditBalance = customers.reduce((sum, c) => sum + c.creditBalance, 0);
  const totalSettledAmount = settlements.reduce((sum, s) => sum + s.amount, 0);

  // Filtered customer list
  const filteredCustomers = customers
    .filter((c) => {
      if (activeTab === 'debtors') return c.creditBalance > 0;
      if (activeTab === 'settled') return c.creditBalance === 0;
      return true;
    })
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  // Handle Add Customer
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const initCredit = parseFloat(newInitialCredit) || 0;

    store.addCustomer({
      businessId: business.id,
      name: newName.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim() || undefined,
      creditBalance: initCredit,
    });

    playSoundEffect('beep');
    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewInitialCredit('');
  };

  // Handle Settle / Partial Payment
  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;

    const amt = parseFloat(settleAmount) || 0;
    if (amt <= 0) {
      alert('Veuillez saisir un montant de règlement supérieur à 0 F.');
      return;
    }

    try {
      const { settlement } = store.recordCreditPayment({
        businessId: business.id,
        customerId: settleTarget.id,
        amount: amt,
        paymentMethod: settlePaymentMethod,
        cashierName: currentUser.name,
        notes: settleNotes.trim() || undefined,
      });

      playSoundEffect('cash');
      alert(`Règlement de ${formatMoney(amt)} validé avec succès pour ${settleTarget.name}.\nNouveau solde restant dû : ${formatMoney(settlement.newBalance)}.`);
      setSettleTarget(null);
      setSettleAmount('');
      setSettleNotes('');
    } catch (err) {
      alert('Erreur lors de l’enregistrement du règlement.');
    }
  };

  // Handle manual credit balance adjustment
  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerCustomer) return;

    const delta = parseFloat(adjustDelta) || 0;
    if (delta <= 0) return;

    const signedDelta = adjustType === 'add' ? delta : -delta;

    const updated = store.adjustCustomerCredit({
      businessId: business.id,
      customerId: ledgerCustomer.id,
      deltaAmount: signedDelta,
      reason: adjustReason.trim() || 'Ajustement manuel',
      cashierName: currentUser.name,
    });

    playSoundEffect('beep');
    setLedgerCustomer(updated);
    setShowAdjustModal(false);
    setAdjustDelta('');
  };

  // Pre-formatted reminder message for WhatsApp / SMS
  const buildReminderMessage = (c: Customer) => {
    return `Bonjour ${c.name}, la boutique ${business.name} vous informe que votre solde en compte / carnet de crédit est actuellement de ${formatMoney(c.creditBalance)}. Merci de bien vouloir passer régulariser à votre convenance. Contact : ${business.phone}. Merci de votre fidélité !`;
  };

  const handleCopyReminder = (c: Customer) => {
    const text = buildReminderMessage(c);
    navigator.clipboard.writeText(text);
    setCopiedReminder(true);
    playSoundEffect('beep');
    setTimeout(() => setCopiedReminder(false), 2500);
  };

  return (
    <div
      className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full transition-colors duration-200 ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-neutral-950 text-white'
      }`}
    >
      {/* Top Header */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
          isLight ? 'border-slate-300' : 'border-neutral-800'
        }`}
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold mb-1">
            <span className={isLight ? 'text-amber-700 font-bold' : 'text-cyan-400 font-mono tracking-wider'}>
              Gestion du Carnet de Crédit & Suivi des Dettes
            </span>
            <span className={isLight ? 'text-slate-400' : 'text-neutral-600'}>·</span>
            <span className={isLight ? 'text-slate-600 font-medium' : 'text-neutral-400 font-normal'}>
              {business.name}
            </span>
          </div>
          <h1 className={`text-xl md:text-2xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Carnet de Crédit & Règlements Clients
          </h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95 ${
            isLight
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
              : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow shadow-cyan-400/30'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Encours Dette (Créances à recouvrer) */}
        <div
          className={`p-4 rounded-2xl space-y-1 transition-all border ${
            isLight
              ? 'bg-white border-rose-200 shadow-sm'
              : 'bg-[#100b14] border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
              Encours Total Crédits (Dettes)
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tabular-nums ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
            {formatMoney(totalCreditBalance)}
          </div>
          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            Créances à recouvrer sur les clients
          </p>
        </div>

        {/* Débiteurs Actifs */}
        <div
          className={`p-4 rounded-2xl space-y-1 transition-all border ${
            isLight
              ? 'bg-white border-amber-200 shadow-sm'
              : 'bg-[#141009] border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
              Clients Débiteurs
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tabular-nums ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
            {debtors.length} compte(s)
          </div>
          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            Ardoises / carnets en attente de paiement
          </p>
        </div>

        {/* Règlements Encaissés */}
        <div
          className={`p-4 rounded-2xl space-y-1 transition-all border ${
            isLight
              ? 'bg-white border-emerald-200 shadow-sm'
              : 'bg-[#091512] border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-800' : 'text-emerald-400'}`}>
              Règlements Encaissés
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tabular-nums ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            {formatMoney(totalSettledAmount)}
          </div>
          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            {settlements.length} paiement(s) de dette reçu(s)
          </p>
        </div>

        {/* Total Clients Répertoriés */}
        <div
          className={`p-4 rounded-2xl space-y-1 transition-all border ${
            isLight
              ? 'bg-white border-slate-200 shadow-sm'
              : 'bg-[#090d18] border-cyan-500/30 shadow-[0_0_15px_rgba(0,242,254,0.1)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
              Répertoire Clients
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {customers.length} fiches
          </div>
          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            {settled.length} compte(s) à jour (sans dette)
          </p>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div
          className={`flex items-center p-1 rounded-xl border max-w-full overflow-x-auto ${
            isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-neutral-900 border-neutral-800'
          }`}
        >
          <button
            onClick={() => setActiveTab('debtors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'debtors'
                ? isLight
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'bg-rose-950/70 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Carnet Dettes ({debtors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'all'
                ? isLight
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Tous les Clients ({customers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'settled'
                ? isLight
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>À jour ({settled.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'history'
                ? isLight
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique Règlements ({settlements.length})</span>
          </button>
        </div>

        {/* Search Input */}
        {activeTab !== 'history' && (
          <div className="relative w-full md:w-80">
            <Search
              className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                isLight ? 'text-slate-400' : 'text-neutral-500'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, tél ou quartier..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-colors border ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 shadow-xs'
                  : 'bg-neutral-900 border-neutral-800 text-white placeholder-neutral-500 focus:outline-hidden focus:border-cyan-400'
              }`}
            />
          </div>
        )}
      </div>

      {/* Main Content Area based on Tab */}
      {activeTab === 'history' ? (
        /* History of debt settlements */
        <div
          className={`rounded-2xl overflow-hidden border shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-neutral-900/90 border-neutral-800'
          }`}
        >
          <div
            className={`p-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d18] border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-500" />
              <h3 className="font-extrabold text-sm tracking-tight">Journal des Règlements de Crédit Reçus</h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-500">
              Cumul : {formatMoney(totalSettledAmount)}
            </span>
          </div>

          <div className="overflow-x-auto">
            {settlements.length === 0 ? (
              <div className="p-8 text-center text-xs opacity-60">
                Aucun règlement de crédit enregistré pour le moment.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b ${
                    isLight ? 'bg-slate-50 text-slate-700' : 'bg-neutral-950 text-neutral-400'
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3 font-bold">Date & Heure</th>
                    <th className="px-4 py-3 font-bold">Client Débiteur</th>
                    <th className="px-4 py-3 font-bold">Mode d'Encaissement</th>
                    <th className="px-4 py-3 font-bold">Caissière / Agent</th>
                    <th className="px-4 py-3 font-bold">Ancien Solde</th>
                    <th className="px-4 py-3 font-bold text-right">Montant Versé</th>
                    <th className="px-4 py-3 font-bold text-right">Nouveau Solde Restant</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-neutral-800/80'}`}>
                  {settlements.map((st) => (
                    <tr key={st.id} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-neutral-800/40'}>
                      <td className="px-4 py-3 font-mono opacity-80">{st.timestamp}</td>
                      <td className="px-4 py-3 font-bold">{st.customerName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            st.paymentMethod === 'cash'
                              ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-950/40 text-emerald-400 border-emerald-600/30'
                              : isLight ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-cyan-950/40 text-cyan-400 border-cyan-600/30'
                          }`}
                        >
                          {st.paymentMethod === 'cash' ? 'Espèces (Cash)' : st.paymentMethod === 'mobile_money' ? 'Mobile Money (Wave/OM)' : 'Carte Bancaire'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{st.cashierName}</td>
                      <td className="px-4 py-3 font-mono text-neutral-400">{formatMoney(st.previousBalance)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-500">
                        -{formatMoney(st.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {st.newBalance > 0 ? (
                          <span className="text-rose-500 font-bold">{formatMoney(st.newBalance)}</span>
                        ) : (
                          <span className="text-emerald-500 font-bold">0 F (Soldé)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Customers Table */
        <div
          className={`rounded-2xl overflow-hidden border shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-neutral-900/90 border-neutral-800'
          }`}
        >
          <div className="overflow-x-auto">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs opacity-60">
                Aucun client ne correspond aux critères de recherche.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-neutral-950/80 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3 font-bold">Client Titulaire</th>
                    <th className="px-4 py-3 font-bold">Téléphone</th>
                    <th className="px-4 py-3 font-bold">Adresse / Quartier</th>
                    <th className="px-4 py-3 font-bold text-right">Volume Achats Total</th>
                    <th className="px-4 py-3 font-bold text-right">Encours Dette (Crédit)</th>
                    <th className="px-4 py-3 font-bold text-right">Actions Carnet</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-neutral-800/80'}`}>
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-slate-50' : 'hover:bg-neutral-850/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                              c.creditBalance > 0
                                ? isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                                : isLight ? 'bg-slate-100 text-slate-700' : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {c.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {c.name}
                            </div>
                            {c.lastPurchaseDate && (
                              <div className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
                                Dernier achat : {c.lastPurchaseDate}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className={`px-4 py-3 font-mono font-medium ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                        {c.phone}
                      </td>

                      <td className={`px-4 py-3 ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                        {c.address || 'Non spécifié'}
                      </td>

                      <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {formatMoney(c.totalPurchases)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {c.creditBalance > 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span
                              className={`font-mono font-extrabold px-2.5 py-1 rounded-lg border text-xs shadow-2xs ${
                                isLight
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : 'bg-rose-950/40 text-rose-400 border-rose-600/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                              }`}
                            >
                              {formatMoney(c.creditBalance)}
                            </span>
                            <span className="text-[10px] text-rose-600 font-semibold mt-0.5">Dette en cours</span>
                          </div>
                        ) : (
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                              isLight
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-emerald-950/30 text-emerald-400 border-emerald-800'
                            }`}
                          >
                            0 F (À jour)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {c.creditBalance > 0 && (
                            <button
                              onClick={() => {
                                setSettleTarget(c);
                                setSettleAmount(String(c.creditBalance));
                                setSettlePaymentMethod('cash');
                                setSettleNotes('');
                              }}
                              className={`px-3 py-1.5 font-bold rounded-lg text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1 ${
                                isLight
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                  : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                              }`}
                              title="Encaisser un paiement d'acompte ou solder la dette"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Encaisser Dette</span>
                            </button>
                          )}

                          {c.creditBalance > 0 && (
                            <button
                              onClick={() => setReminderTarget(c)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isLight
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 border-amber-500/30'
                              }`}
                              title="Générer une relance de paiement (WhatsApp / SMS)"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setLedgerCustomer(c)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              isLight
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                            }`}
                            title="Consulter l'historique et les achats de ce client"
                          >
                            <span>Fiche Carnet</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Settle Debt / Repayment (Encaisser Acompte ou Dette) */}
      {settleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className={`rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0b0f1d] border-cyan-500/30 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-700/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">Règlement de Dette Client</h3>
                  <p className="text-xs text-neutral-400">Enregistrement d'un versement d'acompte</p>
                </div>
              </div>
              <button
                onClick={() => setSettleTarget(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Summary Box */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d18] border-neutral-800'
              }`}
            >
              <div>
                <div className="font-bold text-sm">{settleTarget.name}</div>
                <div className="text-xs text-neutral-400 font-mono">{settleTarget.phone}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Dette Actuelle</span>
                <span className="font-mono text-base font-black text-rose-500">
                  {formatMoney(settleTarget.creditBalance)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4 text-xs">
              {/* Montant versé */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold">Montant du versement (F CFA)</label>
                  <span className="text-[11px] text-neutral-400">Maximum: {formatMoney(settleTarget.creditBalance)}</span>
                </div>
                <input
                  type="number"
                  min="50"
                  max={settleTarget.creditBalance}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-xl font-mono text-lg font-black transition-colors border ${
                    isLight
                      ? 'bg-white border-slate-300 text-emerald-700 focus:outline-hidden focus:border-emerald-500'
                      : 'bg-neutral-950 border-neutral-700 text-emerald-400 focus:outline-hidden focus:border-cyan-400'
                  }`}
                  autoFocus
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSettleAmount(String(settleTarget.creditBalance))}
                    className="px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  >
                    Tout solder (100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleAmount(String(Math.round(settleTarget.creditBalance / 2)))}
                    className="px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer bg-neutral-800 text-neutral-300 border-neutral-700"
                  >
                    50%
                  </button>
                  {[1000, 2000, 5000].map(
                    (v) =>
                      v <= settleTarget.creditBalance && (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSettleAmount(String(v))}
                          className="px-2 py-1 rounded-md text-[10px] font-mono font-bold border cursor-pointer bg-neutral-800 text-neutral-300 border-neutral-700"
                        >
                          +{v} F
                        </button>
                      )
                  )}
                </div>
              </div>

              {/* Mode d'encaissement */}
              <div>
                <label className="font-bold block mb-1.5">Mode d'encaissement du règlement</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlePaymentMethod('cash')}
                    className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold transition-all cursor-pointer ${
                      settlePaymentMethod === 'cash'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Espèces</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlePaymentMethod('mobile_money')}
                    className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold transition-all cursor-pointer ${
                      settlePaymentMethod === 'mobile_money'
                        ? 'bg-cyan-500 text-neutral-950 font-black border-cyan-400 shadow-sm'
                        : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Wave/OM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlePaymentMethod('card')}
                    className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold transition-all cursor-pointer ${
                      settlePaymentMethod === 'card'
                        ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                        : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Carte</span>
                  </button>
                </div>
              </div>

              {/* Note / Motif */}
              <div>
                <label className="font-semibold block mb-1 text-neutral-400">Note ou Référence (Optionnel)</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Ex: Acompte déposé en boutique par son frère"
                  className={`w-full px-3 py-2 rounded-xl border transition-colors ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border-neutral-700 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              {/* Summary Calculation */}
              {parseFloat(settleAmount) > 0 && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${
                    isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <span>Nouveau solde restant dû :</span>
                  <span className="font-mono font-black text-sm">
                    {formatMoney(Math.max(0, settleTarget.creditBalance - (parseFloat(settleAmount) || 0)))}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-700/20">
                <button
                  type="button"
                  onClick={() => setSettleTarget(null)}
                  className={`px-4 py-2 rounded-xl font-bold cursor-pointer ${
                    isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-black rounded-xl cursor-pointer active:scale-95 ${
                    isLight
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                      : 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950 neon-glow shadow-emerald-400/30'
                  }`}
                >
                  Valider le Règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Customer Ledger / Statement (Fiche Carnet Client) */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className={`rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border max-h-[90vh] flex flex-col ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0a0e1c] border-cyan-500/30 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-700/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30 font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">Relevé de Compte · {ledgerCustomer.name}</h3>
                  <p className="text-xs text-neutral-400 font-mono">{ledgerCustomer.phone} · {ledgerCustomer.address || 'Quartier non renseigné'}</p>
                </div>
              </div>
              <button
                onClick={() => setLedgerCustomer(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Balance Header */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060812] border-neutral-800'}`}>
                <span className="text-[10px] text-neutral-400 block uppercase font-bold">Volume Total Achats</span>
                <span className="font-mono text-base font-black">{formatMoney(ledgerCustomer.totalPurchases)}</span>
              </div>
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-950/20 border-rose-500/30'}`}>
                <span className="text-[10px] text-rose-500 block uppercase font-bold">Dette Actuelle (Solde Dû)</span>
                <span className="font-mono text-base font-black text-rose-500">{formatMoney(ledgerCustomer.creditBalance)}</span>
              </div>
              <div className={`p-3 rounded-xl border flex flex-col justify-center items-center gap-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060812] border-neutral-800'}`}>
                <button
                  onClick={() => setShowAdjustModal(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                >
                  Ajuster Dette (+/-)
                </button>
              </div>
            </div>

            {/* Statement Table */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="font-bold text-xs uppercase tracking-wider text-neutral-400 pt-1">
                Historique des Opérations (Ventes à crédit & Règlements)
              </div>

              {/* Operations list */}
              {(() => {
                const customerCreditSales = transactions.filter(
                  (t) => (t.customerId === ledgerCustomer.id || t.customerName === ledgerCustomer.name) && t.paymentMethod === 'credit'
                );
                const customerSettlements = settlements.filter((s) => s.customerId === ledgerCustomer.id);

                if (customerCreditSales.length === 0 && customerSettlements.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs opacity-60">
                      Aucune opération à crédit répertoriée pour ce client.
                    </div>
                  );
                }

                return (
                  <div className="space-y-1.5">
                    {customerCreditSales.map((tx) => (
                      <div
                        key={tx.id}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                          isLight ? 'bg-rose-50/50 border-rose-200' : 'bg-rose-950/20 border-rose-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                            <ArrowUpRight className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold">Achat à crédit · Ticket {tx.ticketNumber}</div>
                            <div className="text-[11px] opacity-70 font-mono">
                              {tx.timestamp} · Caissière : {tx.cashierName} · {tx.items.length} article(s)
                            </div>
                          </div>
                        </div>
                        <span className="font-mono font-black text-rose-500">+{formatMoney(tx.totalAmount)}</span>
                      </div>
                    ))}

                    {customerSettlements.map((st) => (
                      <div
                        key={st.id}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                          isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                            <ArrowDownRight className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold">Règlement d'acompte ({st.paymentMethod})</div>
                            <div className="text-[11px] opacity-70 font-mono">
                              {st.timestamp} · Encaissé par {st.cashierName} {st.notes ? `· ${st.notes}` : ''}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono font-black text-emerald-500">-{formatMoney(st.amount)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-neutral-700/20 flex items-center justify-between shrink-0">
              <button
                onClick={() => setReminderTarget(ledgerCustomer)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Relance WhatsApp / SMS</span>
              </button>

              <button
                onClick={() => setLedgerCustomer(null)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  isLight ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-neutral-800 text-neutral-200 border-neutral-700'
                }`}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Adjust Customer Debt (+/-) */}
      {showAdjustModal && ledgerCustomer && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#090d18] border-neutral-800 text-white'
            }`}
          >
            <h3 className="font-bold text-sm">Ajuster manuellement le solde dette</h3>
            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Type d'opération</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-1.5 rounded-lg border font-bold ${
                      adjustType === 'add' ? 'bg-rose-500 text-white border-rose-500' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    + Ajouter dette
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-1.5 rounded-lg border font-bold ${
                      adjustType === 'deduct' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    - Déduire solde
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Montant de l'ajustement (F CFA)</label>
                <input
                  type="number"
                  min="1"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="0"
                  required
                  className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-neutral-950 border-neutral-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Motif ou justification</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Report dette carnet antérieur"
                  required
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-neutral-950 border-neutral-700 text-white'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-700/20">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-neutral-950 font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: WhatsApp / SMS Debt Reminder Template */}
      {reminderTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#090d18] border-cyan-500/30 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-700/20">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm">Relance Crédit · {reminderTarget.name}</h3>
              </div>
              <button onClick={() => setReminderTarget(null)} className="p-1 text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Message poli et prêt à envoyer pour rappeler au client le montant dû ({formatMoney(reminderTarget.creditBalance)}) :
            </p>

            <div
              className={`p-3 rounded-xl border text-xs font-mono leading-relaxed select-all ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-neutral-950 border-neutral-800 text-cyan-300'
              }`}
            >
              {buildReminderMessage(reminderTarget)}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-700/20">
              <span className="text-[11px] text-neutral-400 font-mono">Tél : {reminderTarget.phone}</span>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyReminder(reminderTarget)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    copiedReminder
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : isLight ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-neutral-800 text-white border-neutral-700'
                  }`}
                >
                  {copiedReminder ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedReminder ? 'Copié !' : 'Copier texte'}</span>
                </button>

                <a
                  href={`https://wa.me/${reminderTarget.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    buildReminderMessage(reminderTarget)
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Ouvrir WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Add New Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-700/20">
              <div className="flex items-center gap-2">
                <UserPlus className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                <h3 className="text-base font-bold">Créer une Fiche Client & Carnet</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nom complet ou Raison sociale</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Mme Konan Ahou"
                  required
                  className={`w-full px-3 py-2 rounded-xl transition-colors border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Numéro de Téléphone (Mobile Money / Appel)</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+225 07 00 11 22"
                  required
                  className={`w-full px-3 py-2 rounded-xl transition-colors border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Adresse ou Quartier</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Ex: Cocody Angré 8ème Tranche"
                  className={`w-full px-3 py-2 rounded-xl transition-colors border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-amber-500">
                  Solde initial de dette (si report d'un ancien carnet papier)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newInitialCredit}
                  onChange={(e) => setNewInitialCredit(e.target.value)}
                  placeholder="0 F CFA"
                  className={`w-full px-3 py-2 rounded-xl transition-colors border font-mono font-bold ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-neutral-700/20">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 rounded-xl font-medium cursor-pointer ${
                    isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-black rounded-xl cursor-pointer ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow'
                  }`}
                >
                  Enregistrer Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
