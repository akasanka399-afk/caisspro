import React, { useState, useEffect } from 'react';
import { Business, Customer, User } from '../types';
import { store } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney } from '../utils/formatters';
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
} from 'lucide-react';

interface CustomersViewProps {
  currentUser: User;
  business: Business;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ currentUser, business }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [settleTarget, setSettleTarget] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');

  // Add form
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');

  const refreshData = () => {
    setCustomers(store.getCustomers(business.id));
  };

  useEffect(() => {
    refreshData();
    const unsub = store.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, [business.id]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalCreditBalance = customers.reduce((sum, c) => sum + c.creditBalance, 0);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    store.addCustomer({
      businessId: business.id,
      name: newName.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim() || undefined,
      creditBalance: 0,
    });

    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;

    const amt = parseFloat(settleAmount) || 0;
    const newBal = Math.max(0, settleTarget.creditBalance - amt);
    store.updateCustomer(settleTarget.id, { creditBalance: newBal });

    setSettleTarget(null);
    setSettleAmount('');
    alert(`Règlement de ${formatMoney(amt)} enregistré pour ${settleTarget.name}.`);
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full transition-colors duration-200 ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-neutral-950 text-white'
    }`}>
      {/* Top Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
        isLight ? 'border-slate-300' : 'border-neutral-800'
      }`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold mb-1">
            <span className={isLight ? 'text-amber-700 font-bold' : 'text-cyan-400 font-mono tracking-wider'}>
              Gestion de la Clientèle & Carnet de Crédit
            </span>
            <span className={isLight ? 'text-slate-400' : 'text-neutral-600'}>·</span>
            <span className={isLight ? 'text-slate-600 font-medium' : 'text-neutral-400 font-normal'}>
              {business.name}
            </span>
          </div>
          <h1 className={`text-xl md:text-2xl font-extrabold tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Fichier Clients & Suivi des Dettes
          </h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
            isLight
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 active:scale-95'
              : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow shadow-cyan-400/30'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total clients */}
        <div className={`p-4 rounded-xl space-y-1 transition-all ${
          isLight
            ? 'retail-card bg-white border border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border border-cyan-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Total Clients Enregistrés
            </span>
            <Users className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-cyan-400'}`} />
          </div>
          <div className={`text-2xl font-extrabold font-mono tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {customers.length} fiches
          </div>
          <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
            Carnet actif du commerce
          </span>
        </div>

        {/* Total credit balance */}
        <div className={`p-4 rounded-xl space-y-1 transition-all ${
          isLight
            ? 'retail-card bg-white border border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border border-rose-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Encours Total Crédits Clients (Dettes)
            </span>
            <DollarSign className={`w-4 h-4 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
          </div>
          <div className={`text-2xl font-extrabold font-mono tabular-nums ${
            isLight ? 'text-rose-700 font-bold' : 'text-rose-400'
          }`}>
            {formatMoney(totalCreditBalance)}
          </div>
          <span className={`text-[11px] ${isLight ? 'text-rose-700/80' : 'text-rose-400/80'}`}>
            Créances à recouvrer
          </span>
        </div>

        {/* Debtors count */}
        <div className={`p-4 rounded-xl space-y-1 transition-all ${
          isLight
            ? 'retail-card bg-white border border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Clients Débiteurs
            </span>
            <CreditCard className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
          </div>
          <div className={`text-2xl font-extrabold font-mono tabular-nums ${
            isLight ? 'text-amber-700 font-bold' : 'text-amber-400'
          }`}>
            {customers.filter((c) => c.creditBalance > 0).length} compte(s)
          </div>
          <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
            Avec arriérés en cours
          </span>
        </div>
      </div>

      {/* Search & Customer Grid */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
            isLight ? 'text-slate-400' : 'text-neutral-500'
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou quartier..."
            className={`w-full pl-9 pr-4 py-2 rounded-lg text-xs transition-colors ${
              isLight
                ? 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 shadow-xs'
                : 'bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-hidden focus:border-cyan-400'
            }`}
          />
        </div>

        <div className={`rounded-xl overflow-hidden border ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border-neutral-800'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-neutral-950/80 border-neutral-800 text-neutral-400'
              }`}>
                <tr>
                  <th className="px-4 py-3 font-bold">Client</th>
                  <th className="px-4 py-3 font-bold">Téléphone</th>
                  <th className="px-4 py-3 font-bold">Adresse / Quartier</th>
                  <th className="px-4 py-3 font-bold text-right">Volume Achats Cumulé</th>
                  <th className="px-4 py-3 font-bold text-right">Solde Dette Client</th>
                  <th className="px-4 py-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-neutral-800/80'}`}>
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className={`transition-colors ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-neutral-850/50'
                  }`}>
                    <td className="px-4 py-3">
                      <div className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>{c.name}</div>
                      {c.lastPurchaseDate && (
                        <div className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
                          Dernier passage : {c.lastPurchaseDate}
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-mono ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>{c.phone}</td>
                    <td className={`px-4 py-3 ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>{c.address || 'Non spécifié'}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}>
                      {formatMoney(c.totalPurchases)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.creditBalance > 0 ? (
                        <span className={`font-mono font-bold px-2.5 py-1 rounded border ${
                          isLight
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-rose-950/40 text-rose-400 border-rose-800'
                        }`}>
                          {formatMoney(c.creditBalance)}
                        </span>
                      ) : (
                        <span className={`font-mono font-semibold ${
                          isLight ? 'text-emerald-700' : 'text-emerald-400'
                        }`}>0 F (À jour)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.creditBalance > 0 ? (
                        <button
                          onClick={() => {
                            setSettleTarget(c);
                            setSettleAmount(String(c.creditBalance));
                          }}
                          className={`px-3 py-1 font-bold rounded text-xs transition-colors ${
                            isLight
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950 neon-glow'
                          }`}
                        >
                          Encaisser Dette
                        </button>
                      ) : (
                        <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>Aucune dette</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Settle Debt */}
      {settleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl border ${
            isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
          }`}>
            <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <DollarSign className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <span>Règlement de Dette Client</span>
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>
              Client : <strong className={isLight ? 'text-slate-900' : 'text-white'}>{settleTarget.name}</strong>
              <br />
              Dette actuelle : <span className={`font-mono font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                {formatMoney(settleTarget.creditBalance)}
              </span>
            </p>

            <form onSubmit={handleSettleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Montant versé par le client (F CFA)
                </label>
                <input
                  type="number"
                  min="100"
                  max={settleTarget.creditBalance}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-lg font-mono text-base font-bold transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-emerald-700 focus:outline-hidden focus:border-emerald-500'
                      : 'bg-neutral-950 border border-neutral-800 text-emerald-400 focus:outline-hidden focus:border-cyan-400'
                  }`}
                  autoFocus
                />
              </div>

              <div className={`flex justify-end gap-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                <button
                  type="button"
                  onClick={() => setSettleTarget(null)}
                  className={`px-3 py-1.5 rounded font-medium ${
                    isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 font-bold rounded ${
                    isLight
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950'
                  }`}
                >
                  Valider l'encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
            isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${
              isLight ? 'border-slate-200' : 'border-neutral-800'
            }`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <UserPlus className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                <span>Créer une Fiche Client</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className={`p-1 rounded ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-400 hover:text-white'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Nom complet ou Raison sociale
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Mme Konan Ahou"
                  required
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Numéro de Téléphone (Mobile Money / Appel)
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+225 07 00 11 22"
                  required
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Adresse ou Quartier
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Ex: Cocody Angré 8ème Tranche"
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              <div className={`pt-3 flex justify-end gap-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold rounded-lg ${
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
