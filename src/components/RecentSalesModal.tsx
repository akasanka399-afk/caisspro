import React, { useState } from 'react';
import {
  X,
  Search,
  Receipt,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Filter,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { Business, SaleTransaction, User } from '../types';
import { formatMoney, formatTimeOnly } from '../utils/formatters';
import { store, playSoundEffect } from '../services/store';
import { CancelSaleModal } from './CancelSaleModal';
import { ReceiptModal } from './ReceiptModal';

interface RecentSalesModalProps {
  business: Business;
  currentUser: User;
  onClose: () => void;
  onSaleCancelled?: (tx: SaleTransaction) => void;
}

export const RecentSalesModal: React.FC<RecentSalesModalProps> = ({
  business,
  currentUser,
  onClose,
  onSaleCancelled,
}) => {
  const [transactions, setTransactions] = useState<SaleTransaction[]>(() =>
    store.getTransactions(business.id)
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [selectedTxForCancel, setSelectedTxForCancel] = useState<SaleTransaction | null>(null);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<SaleTransaction | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const refreshList = () => {
    setTransactions(store.getTransactions(business.id));
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTicket = tx.ticketNumber.toLowerCase().includes(q);
      const matchCustomer = tx.customerName?.toLowerCase().includes(q) || false;
      const matchCashier = tx.cashierName.toLowerCase().includes(q);
      const matchReason = tx.cancellationReason?.toLowerCase().includes(q) || false;
      const matchAmount = String(tx.totalAmount).includes(q);
      return matchTicket || matchCustomer || matchCashier || matchReason || matchAmount;
    }
    return true;
  });

  const completedCount = transactions.filter((t) => t.status === 'completed').length;
  const cancelledCount = transactions.filter((t) => t.status === 'cancelled').length;

  const handleCancelSuccess = (updatedTx: SaleTransaction) => {
    setSelectedTxForCancel(null);
    refreshList();
    setNoticeMessage(`La vente ${updatedTx.ticketNumber} a été annulée avec succès et les articles réintégrés.`);
    playSoundEffect('alert');
    if (onSaleCancelled) {
      onSaleCancelled(updatedTx);
    }
    setTimeout(() => setNoticeMessage(null), 5000);
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Espèces',
    mobile_money: 'Mobile Money',
    card: 'Carte Bancaire',
    credit: 'Vente à Crédit',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-[#090c19] border border-slate-200 dark:border-cyan-500/30 shadow-2xl text-slate-900 dark:text-white overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-[#05070f] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20 dark:border-cyan-500/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-cyan-950/40 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-cyan-800">
                  Caisse & Historique
                </span>
                <span className="text-xs text-slate-500 dark:text-neutral-400">
                  {business.name}
                </span>
              </div>
              <h2 className="text-base md:text-lg font-black tracking-tight mt-0.5">
                Dernières Ventes & Annulation de Ticket
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {noticeMessage && (
          <div className="p-3 mx-4 mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{noticeMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setNoticeMessage(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Toolbar: Search & Status Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-[#070a14] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par n° ticket (TK-...), client, montant, motif..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-neutral-950 border-blue-600 dark:border-cyan-400'
                  : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800 hover:bg-slate-100'
              }`}
            >
              Tous ({transactions.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 border-slate-200 dark:border-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
              }`}
            >
              Validées ({completedCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                statusFilter === 'cancelled'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white dark:bg-neutral-900 text-rose-700 dark:text-rose-400 border-slate-200 dark:border-neutral-800 hover:bg-rose-50 dark:hover:bg-rose-950/20'
              }`}
            >
              Annulées ({cancelledCount})
            </button>
          </div>
        </div>

        {/* Transactions List */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-3 flex-1">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-neutral-600" />
              <p className="text-sm font-bold text-slate-600 dark:text-neutral-400">
                Aucune vente trouvée
              </p>
              <p className="text-xs text-slate-400 dark:text-neutral-500">
                {searchQuery ? 'Aucun ticket ne correspond à votre recherche.' : 'Aucun ticket enregistré pour ce commerce.'}
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isCancelled = tx.status === 'cancelled';

              return (
                <div
                  key={tx.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCancelled
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 opacity-90'
                      : 'bg-white dark:bg-neutral-900/90 border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono font-black text-sm tracking-wide ${
                          isCancelled ? 'line-through text-slate-500 dark:text-neutral-400' : 'text-slate-900 dark:text-white'
                        }`}>
                          {tx.ticketNumber}
                        </span>

                        {isCancelled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-2xs flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            <span>Vente Annulée</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>Encaissée</span>
                          </span>
                        )}

                        <span className="text-[11px] font-mono text-slate-400 dark:text-neutral-500">
                          {tx.timestamp}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-neutral-400">
                        <span>Règlement : <strong>{paymentLabels[tx.paymentMethod] || tx.paymentMethod}</strong></span>
                        <span>·</span>
                        <span>Caissier : <strong>{tx.cashierName}</strong></span>
                        {tx.customerName && (
                          <>
                            <span>·</span>
                            <span>Client : <strong>{tx.customerName}</strong></span>
                          </>
                        )}
                        <span>·</span>
                        <span>{tx.items.length} article(s)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`font-mono font-black text-base md:text-lg block ${
                          isCancelled ? 'line-through text-rose-500 opacity-60' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {formatMoney(tx.totalAmount, business.currency || 'FCFA')}
                        </span>
                        {isCancelled && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">
                            0 F (Non comptabilisé)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTxForReceipt(tx)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Voir le ticket de caisse"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                          <span>Ticket</span>
                        </button>

                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => setSelectedTxForCancel(tx)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-200 dark:border-rose-900 transition-all flex items-center gap-1 cursor-pointer"
                            title="Annuler cette vente et justifier le motif"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Annuler</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* If cancelled, show justification banner */}
                  {isCancelled && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-rose-100/70 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-900 dark:text-rose-200">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Justification de l'annulation :</span>
                        <span className="font-normal italic">« {tx.cancellationReason || 'Non spécifié'} »</span>
                      </div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-400">
                        Annulée le {tx.cancelledAt || tx.timestamp} par <strong>{tx.cancelledBy || 'Caissier'}</strong>.
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-[#05070f] flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-neutral-400">
            Total : <strong>{filteredTransactions.length}</strong> ticket(s) affiché(s) · Les ventes annulées sont automatiquement exclues du chiffre d'affaires.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-neutral-700 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Cancel Sale Modal */}
      {selectedTxForCancel && (
        <CancelSaleModal
          transaction={selectedTxForCancel}
          business={business}
          currentUser={currentUser}
          onClose={() => setSelectedTxForCancel(null)}
          onSuccess={handleCancelSuccess}
        />
      )}

      {/* Receipt Modal */}
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
