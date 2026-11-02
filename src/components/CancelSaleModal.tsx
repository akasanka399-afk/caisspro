import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  RotateCcw,
  Check,
  Receipt,
  Package,
  CreditCard,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { Business, SaleTransaction, User } from '../types';
import { formatMoney } from '../utils/formatters';
import { store, playSoundEffect } from '../services/store';

interface CancelSaleModalProps {
  transaction: SaleTransaction;
  business: Business;
  currentUser: User;
  onClose: () => void;
  onSuccess: (updatedTx: SaleTransaction) => void;
}

const COMMON_REASONS = [
  'Erreur de saisie / faux montant',
  'Changement d’avis du client',
  'Article défectueux / retour immédiat',
  'Échec règlement Mobile Money ou Carte',
  'Manque de monnaie en caisse',
  'Autre motif justifié',
];

export const CancelSaleModal: React.FC<CancelSaleModalProps> = ({
  transaction,
  business,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [restoreStock, setRestoreStock] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const finalReason = customReason.trim()
    ? `${selectedPreset} : ${customReason.trim()}`
    : selectedPreset;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!finalReason.trim()) {
      setErrorMsg('Veuillez fournir une justification pour l’annulation.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = store.cancelTransaction({
      transactionId: transaction.id,
      reason: finalReason.trim(),
      cashierUser: currentUser,
      restoreStock,
    });

    if (!res.success || !res.transaction) {
      setIsSubmitting(false);
      setErrorMsg(res.error || 'Erreur lors de l’annulation de la vente.');
      playSoundEffect('error');
      return;
    }

    playSoundEffect('alert');
    onSuccess(res.transaction);
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Espèces (Cash)',
    mobile_money: 'Mobile Money',
    card: 'Carte Bancaire',
    credit: 'Vente à Crédit',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0c0f1d] border border-rose-300 dark:border-rose-500/40 shadow-2xl text-slate-900 dark:text-white overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-rose-200 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">
                Action Caissière Sécurisée
              </span>
              <h2 className="text-base md:text-lg font-black tracking-tight text-rose-900 dark:text-rose-200">
                Annuler la Vente {transaction.ticketNumber}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Ticket Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-900/80 border border-slate-200 dark:border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono text-slate-700 dark:text-neutral-300">
                {transaction.ticketNumber}
              </span>
              <span className="font-mono text-slate-500 dark:text-neutral-400">
                {transaction.timestamp}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-neutral-800">
              <span className="text-slate-600 dark:text-neutral-400">Montant total encaissé :</span>
              <span className="font-black text-sm font-mono text-slate-900 dark:text-white">
                {formatMoney(transaction.totalAmount, business.currency || 'FCFA')}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
              <span>Règlement : <strong>{paymentLabels[transaction.paymentMethod] || transaction.paymentMethod}</strong></span>
              <span>Caissière : <strong>{transaction.cashierName}</strong></span>
            </div>

            {/* Articles preview */}
            <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-neutral-500 block">
                Articles concernés ({transaction.items.length}) :
              </span>
              <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                {transaction.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <span className="truncate max-w-[240px]">
                      {it.quantity}x {it.productName}
                    </span>
                    <span className="font-mono font-medium shrink-0">
                      {formatMoney(it.total, business.currency || 'FCFA')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Justification presets */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300">
              Motif principal de l’annulation <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {COMMON_REASONS.map((reason) => {
                const isSelected = selectedPreset === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedPreset(reason)}
                    className={`p-2 rounded-lg text-left text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-500 text-rose-900 dark:text-rose-200 font-bold'
                        : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800/60 text-slate-700 dark:text-neutral-300'
                    }`}
                  >
                    <span className="truncate pr-1">{reason}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Justification Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300">
              Détails / Précisions complémentaires <span className="text-slate-400 font-normal">(Recommandé)</span>
            </label>
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Ex: Le client n'avait pas le bon code Wave et est parti sans la marchandise..."
              rows={2}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs focus:ring-2 focus:ring-rose-500 outline-hidden transition-all"
            />
          </div>

          {/* Stock Restoration Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 cursor-pointer">
            <input
              type="checkbox"
              checked={restoreStock}
              onChange={(e) => setRestoreStock(e.target.checked)}
              className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
            />
            <div className="text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                Réintégrer automatiquement les articles au stock
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-0.5">
                Les quantités vendues seront re-créditées dans le stock disponible du magasin.
              </span>
            </div>
          </label>

          {/* Warning / Audit message */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-[11px] text-slate-600 dark:text-neutral-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Cette annulation est définitive. Le ticket sera marqué comme <strong>ANNULÉ</strong>, retiré du chiffre d'affaires et consigné avec votre nom d'agent dans le journal de sécurité.
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Conserver la Vente
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Annulation en cours...' : 'Confirmer l’Annulation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
