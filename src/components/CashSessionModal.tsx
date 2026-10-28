import React, { useState } from 'react';
import { CashRegisterSession } from '../types';
import { useTheme } from '../services/themeContext';
import { formatMoney } from '../utils/formatters';
import { DollarSign, X, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

interface CashSessionModalProps {
  mode: 'open' | 'close' | 'view';
  session?: CashRegisterSession;
  cashierName: string;
  onOpenSession: (openingFloat: number) => void;
  onCloseSession: (sessionId: string, actualCash: number, notes?: string) => void;
  onDismiss: () => void;
}

export const CashSessionModal: React.FC<CashSessionModalProps> = ({
  mode,
  session,
  cashierName,
  onOpenSession,
  onCloseSession,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [openingFloat, setOpeningFloat] = useState<string>('25000');
  const [actualCash, setActualCash] = useState<string>(session ? String(session.expectedCash) : '0');
  const [notes, setNotes] = useState<string>('');

  const numActualCash = parseFloat(actualCash) || 0;
  const numExpectedCash = session?.expectedCash || 0;
  const diff = numActualCash - numExpectedCash;

  const handleSubmitOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const floatVal = parseFloat(openingFloat) || 0;
    onOpenSession(floatVal);
  };

  const handleSubmitClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (session) {
      onCloseSession(session.id, numActualCash, notes);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`rounded-xl max-w-lg w-full shadow-2xl overflow-hidden border ${
        isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${
              isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-400/10 text-amber-400'
            }`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {mode === 'open' ? 'Ouverture de Caisse' : mode === 'close' ? 'Clôture de Caisse (Rapport Z)' : 'Détails de Session Caisse'}
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>Caissier(e) : {cashierName}</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className={`p-1 rounded-md transition-colors ${
              isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {mode === 'open' && (
          <form onSubmit={handleSubmitOpen} className="p-6 space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                Fond de Caisse Initial (F CFA)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                required
                className={`w-full px-4 py-2.5 rounded-lg font-mono text-lg font-bold transition-colors ${
                  isLight
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                    : 'bg-neutral-950 border border-neutral-700 text-white focus:outline-hidden focus:border-cyan-400'
                }`}
                placeholder="Ex: 25000"
                autoFocus
              />
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Monnaie initiale placée dans le tiroir-caisse pour rendre la monnaie aux premiers clients.
              </p>
            </div>

            {/* Quick suggestions */}
            <div className="flex items-center gap-2 pt-1">
              <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>Montants fréquents :</span>
              {[10000, 20000, 25000, 50000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setOpeningFloat(String(amt))}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                  }`}
                >
                  {formatMoney(amt, '')}
                </button>
              ))}
            </div>

            <div className={`pt-4 flex justify-end gap-3 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
              <button
                type="button"
                onClick={onDismiss}
                className={`px-4 py-2 text-xs font-medium rounded-lg ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                Annuler
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                  isLight
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Ouvrir la Caisse</span>
              </button>
            </div>
          </form>
        )}

        {mode === 'close' && session && (
          <form onSubmit={handleSubmitClose} className="p-6 space-y-4">
            <div className={`grid grid-cols-2 gap-3 p-3 rounded-lg border text-xs ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
            }`}>
              <div>
                <span className={`block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>Fond de caisse initial</span>
                <span className={`font-mono font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatMoney(session.openingFloat)}</span>
              </div>
              <div>
                <span className={`block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>Ventes en session ({session.totalSalesCount})</span>
                <span className={`font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{formatMoney(session.totalSalesAmount)}</span>
              </div>
              <div className={`col-span-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                <span className={`block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>Espèces théoriques attendues en caisse</span>
                <span className={`font-mono text-base font-bold ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>{formatMoney(session.expectedCash)}</span>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                Espèces Réellement Comptées dans le Tiroir (F CFA)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                required
                className={`w-full px-4 py-2.5 rounded-lg font-mono text-lg font-bold transition-colors ${
                  isLight
                    ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                    : 'bg-neutral-950 border border-neutral-700 text-white focus:outline-hidden focus:border-cyan-400'
                }`}
                placeholder="Montant compté"
                autoFocus
              />
            </div>

            {/* Difference indicator */}
            <div className={`p-3 rounded-lg border flex items-center justify-between text-xs font-medium ${
              diff === 0
                ? isLight
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : diff > 0
                ? isLight
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                  : 'bg-cyan-950/40 border-cyan-800 text-cyan-300'
                : isLight
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {diff === 0 ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>
                  {diff === 0 ? 'Caisse Parfaite (aucun écart)' : diff > 0 ? 'Excédent de caisse constaté' : 'Déficit de caisse constaté'}
                </span>
              </div>
              <span className="font-mono font-bold tabular-nums">
                {diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
              </span>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                Remarques ou Justificatif (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                  isLight
                    ? 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-400'
                    : 'bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-hidden focus:border-neutral-700'
                }`}
                placeholder="Explication d'un écart, retrait bancaire..."
              />
            </div>

            <div className={`pt-3 flex justify-end gap-3 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
              <button
                type="button"
                onClick={onDismiss}
                className={`px-4 py-2 text-xs font-medium rounded-lg ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Valider Clôture & Rapport Z</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
