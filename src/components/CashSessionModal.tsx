import React, { useState, useMemo } from 'react';
import { CashRegisterSession, CashDenominations } from '../types';
import { useTheme } from '../services/themeContext';
import { formatMoney } from '../utils/formatters';
import {
  DollarSign,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Calculator,
  ChevronDown,
  ChevronUp,
  Banknote,
  CreditCard,
  Smartphone,
  Receipt,
} from 'lucide-react';

interface CashSessionModalProps {
  mode: 'open' | 'close' | 'view';
  session?: CashRegisterSession;
  cashierName: string;
  onOpenSession: (openingFloat: number) => void;
  onCloseSession: (
    sessionId: string,
    actualCash: number,
    notes?: string,
    denominations?: CashDenominations
  ) => void;
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

  // Opening float
  const [openingFloat, setOpeningFloat] = useState<string>('25000');

  // Closing counts & denominations
  const [actualCash, setActualCash] = useState<string>(session ? String(session.expectedCash) : '0');
  const [notes, setNotes] = useState<string>('');
  const [showBilletage, setShowBilletage] = useState<boolean>(false);

  // Billetage state
  const [denomB10000, setDenomB10000] = useState<string>('');
  const [denomB5000, setDenomB5000] = useState<string>('');
  const [denomB2000, setDenomB2000] = useState<string>('');
  const [denomB1000, setDenomB1000] = useState<string>('');
  const [denomB500, setDenomB500] = useState<string>('');
  const [denomP500, setDenomP500] = useState<string>('');
  const [denomP200, setDenomP200] = useState<string>('');
  const [denomP100, setDenomP100] = useState<string>('');
  const [denomP50, setDenomP50] = useState<string>('');
  const [denomP25, setDenomP25] = useState<string>('');

  // Calculate sum from denominations
  const totalBilletage = useMemo(() => {
    const b10 = (parseInt(denomB10000, 10) || 0) * 10000;
    const b5 = (parseInt(denomB5000, 10) || 0) * 5000;
    const b2 = (parseInt(denomB2000, 10) || 0) * 2000;
    const b1 = (parseInt(denomB1000, 10) || 0) * 1000;
    const b500 = (parseInt(denomB500, 10) || 0) * 500;
    const p500 = (parseInt(denomP500, 10) || 0) * 500;
    const p200 = (parseInt(denomP200, 10) || 0) * 200;
    const p100 = (parseInt(denomP100, 10) || 0) * 100;
    const p50 = (parseInt(denomP50, 10) || 0) * 50;
    const p25 = (parseInt(denomP25, 10) || 0) * 25;

    return b10 + b5 + b2 + b1 + b500 + p500 + p200 + p100 + p50 + p25;
  }, [
    denomB10000,
    denomB5000,
    denomB2000,
    denomB1000,
    denomB500,
    denomP500,
    denomP200,
    denomP100,
    denomP50,
    denomP25,
  ]);

  // Apply billetage to actualCash input
  const handleApplyBilletage = () => {
    setActualCash(String(totalBilletage));
  };

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
    if (!session) return;

    const denoms: CashDenominations = {
      b10000: parseInt(denomB10000, 10) || 0,
      b5000: parseInt(denomB5000, 10) || 0,
      b2000: parseInt(denomB2000, 10) || 0,
      b1000: parseInt(denomB1000, 10) || 0,
      b500: parseInt(denomB500, 10) || 0,
      p500: parseInt(denomP500, 10) || 0,
      p200: parseInt(denomP200, 10) || 0,
      p100: parseInt(denomP100, 10) || 0,
      p50: parseInt(denomP50, 10) || 0,
      p25: parseInt(denomP25, 10) || 0,
    };

    onCloseSession(session.id, numActualCash, notes, denoms);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div
        className={`rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border my-auto transition-colors ${
          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0a0e1e] border-cyan-500/40 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060914] border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                mode === 'close'
                  ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                  : isLight
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-amber-400/10 text-amber-400'
              }`}
            >
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                {mode === 'open'
                  ? 'Ouverture de Caisse (Fond Initial)'
                  : mode === 'close'
                  ? 'Clôture de Caisse & Génération Rapport Z'
                  : 'Détails de Session Caisse'}
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Caissier(ère) : <strong>{cashierName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'hover:bg-slate-200 text-slate-400' : 'hover:bg-neutral-800 text-neutral-400'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: OPEN SESSION */}
        {mode === 'open' && (
          <form onSubmit={handleSubmitOpen} className="p-6 space-y-4">
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                Fond de Caisse Initial (F CFA)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                required
                className={`w-full px-4 py-2.5 rounded-xl font-mono text-xl font-black transition-colors ${
                  isLight
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                    : 'bg-[#060914] border border-neutral-700 text-white focus:outline-hidden focus:border-cyan-400'
                }`}
                placeholder="Ex: 25000"
                autoFocus
              />
              <p className={`text-xs mt-1.5 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Montant liquide déposé dans le tiroir au démarrage de la journée pour faire l'appoint de monnaie.
              </p>
            </div>

            {/* Quick suggestions */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Montants rapides :
              </span>
              {[10000, 20000, 25000, 50000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setOpeningFloat(String(amt))}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                  }`}
                >
                  {formatMoney(amt, 'F')}
                </button>
              ))}
            </div>

            <div className={`pt-4 flex justify-end gap-3 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
              <button
                type="button"
                onClick={onDismiss}
                className={`px-4 py-2 text-xs font-medium rounded-xl ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                Annuler
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  isLight
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Ouvrir la Caisse</span>
              </button>
            </div>
          </form>
        )}

        {/* Content: CLOSE SESSION (Z REPORT) */}
        {mode === 'close' && session && (
          <form onSubmit={handleSubmitClose} className="p-5 md:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            {/* Sales recap in session */}
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl border text-xs ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060914] border-neutral-800'
              }`}
            >
              <div>
                <span className="opacity-60 block text-[10px] uppercase font-bold">Fond Initial</span>
                <span className="font-mono font-bold text-sm">{formatMoney(session.openingFloat)}</span>
              </div>
              <div>
                <span className="opacity-60 block text-[10px] uppercase font-bold">Ventes Session</span>
                <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {formatMoney(session.totalSalesAmount)}
                </span>
                <span className="text-[10px] opacity-70 block">({session.totalSalesCount} tickets)</span>
              </div>
              <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-inherit pt-2 sm:pt-0 sm:pl-3">
                <span className="opacity-60 block text-[10px] uppercase font-bold">Espèces Attendues</span>
                <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                  {formatMoney(session.expectedCash)}
                </span>
              </div>
            </div>

            {/* Billetage Toggle Button */}
            <div className="flex items-center justify-between">
              <label className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
                Espèces Réellement Comptées dans le Tiroir (F CFA)
              </label>

              <button
                type="button"
                onClick={() => setShowBilletage((p) => !p)}
                className={`text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  showBilletage
                    ? 'text-amber-600 dark:text-amber-400'
                    : isLight
                    ? 'text-blue-600 hover:text-blue-800'
                    : 'text-cyan-400 hover:text-cyan-300'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{showBilletage ? 'Masquer le Billetage' : 'Billetage Assisté (Comptage rapide)'}</span>
                {showBilletage ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Billetage Accordion */}
            {showBilletage && (
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isLight ? 'bg-amber-50/60 border-amber-200' : 'bg-[#0e1428] border-cyan-500/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs pb-2 border-b border-inherit">
                  <span className="font-bold flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-amber-500" />
                    <span>Grille de Comptage des Coupures (Billets & Pièces)</span>
                  </span>
                  <span className="font-mono font-bold">
                    Total Billetage : <strong>{formatMoney(totalBilletage, 'F')}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">10 000 F</label>
                    <input
                      type="number"
                      min="0"
                      value={denomB10000}
                      onChange={(e) => setDenomB10000(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">5 000 F</label>
                    <input
                      type="number"
                      min="0"
                      value={denomB5000}
                      onChange={(e) => setDenomB5000(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">2 000 F</label>
                    <input
                      type="number"
                      min="0"
                      value={denomB2000}
                      onChange={(e) => setDenomB2000(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">1 000 F</label>
                    <input
                      type="number"
                      min="0"
                      value={denomB1000}
                      onChange={(e) => setDenomB1000(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">500 F (Billet)</label>
                    <input
                      type="number"
                      min="0"
                      value={denomB500}
                      onChange={(e) => setDenomB500(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">500 F (Pièce)</label>
                    <input
                      type="number"
                      min="0"
                      value={denomP500}
                      onChange={(e) => setDenomP500(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">200 F / 100 F</label>
                    <input
                      type="number"
                      min="0"
                      value={denomP100}
                      onChange={(e) => setDenomP100(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-75 mb-1 font-bold">50 F / 25 F</label>
                    <input
                      type="number"
                      min="0"
                      value={denomP50}
                      onChange={(e) => setDenomP50(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-center font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-inherit">
                  <span className="text-[11px] opacity-75">
                    Calcul automatique sans calculatrice
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyBilletage}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      isLight
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold'
                    }`}
                  >
                    Appliquer le total ({formatMoney(totalBilletage, 'F')})
                  </button>
                </div>
              </div>
            )}

            {/* Direct Cash Input */}
            <div>
              <input
                type="number"
                min="0"
                step="100"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-xl font-mono text-xl font-black transition-colors ${
                  isLight
                    ? 'bg-white border-2 border-slate-300 text-slate-900 focus:outline-hidden focus:border-rose-500'
                    : 'bg-[#060914] border-2 border-neutral-700 text-white focus:outline-hidden focus:border-cyan-400'
                }`}
                placeholder="Montant total compté en espèces"
                autoFocus
              />
            </div>

            {/* Live Difference Indicator */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                diff === 0
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                  : diff > 0
                  ? isLight
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                    : 'bg-cyan-950/40 border-cyan-700 text-cyan-300'
                  : isLight
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-rose-950/40 border-rose-700 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {diff === 0 ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                )}
                <div>
                  <div className="font-extrabold">
                    {diff === 0
                      ? 'Caisse Parfaite (Aucun Écart)'
                      : diff > 0
                      ? 'Excédent de Caisse Constaté'
                      : 'Déficit / Manquant de Caisse Constaté'}
                  </div>
                  <span className="text-[10px] font-normal opacity-80 block">
                    {diff === 0
                      ? 'Les espèces du tiroir correspondent au montant théorique'
                      : diff > 0
                      ? 'Surplus d’espèces dans le tiroir'
                      : 'Espèces manquantes à consigner dans le rapport'}
                  </span>
                </div>
              </div>

              <span className="font-mono font-black text-sm tabular-nums">
                {diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
              </span>
            </div>

            {/* Optional Notes */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                Observation ou Justificatif de Clôture (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`w-full px-3 py-2 rounded-xl text-xs transition-colors ${
                  isLight
                    ? 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-400'
                    : 'bg-[#060914] border border-neutral-700 text-white placeholder-neutral-500 focus:outline-hidden focus:border-neutral-600'
                }`}
                placeholder="Explication d'un écart, retrait bancaire, dépenses courantes..."
              />
            </div>

            {/* Footer Buttons */}
            <div className={`pt-3 flex justify-end gap-3 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
              <button
                type="button"
                onClick={onDismiss}
                className={`px-4 py-2 text-xs font-medium rounded-xl ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Valider Clôture & Afficher Rapport Z</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
