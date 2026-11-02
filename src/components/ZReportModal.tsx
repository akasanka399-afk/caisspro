import React, { useState } from 'react';
import {
  X,
  Printer,
  Share2,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Clock,
  User,
  ShieldCheck,
  CreditCard,
  Banknote,
  Smartphone,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { Business, CashRegisterSession } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';
import { printThermalZReport, copyZReportToClipboard } from '../utils/printReceipt';

interface ZReportModalProps {
  session: CashRegisterSession;
  business: Business;
  isLight: boolean;
  onClose: () => void;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({
  session,
  business,
  isLight,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const cur = business.currency || 'FCFA';
  const diff = session.cashDifference || 0;
  const isPerfect = diff === 0;
  const isSurplus = diff > 0;
  const zNum = session.zNumber || `Z-${session.id.slice(-6).toUpperCase()}`;

  const avgBasket =
    session.totalSalesCount > 0
      ? Math.round(session.totalSalesAmount / session.totalSalesCount)
      : 0;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printThermalZReport(session, business);
    } catch (e) {
      console.error('Erreur impression Z:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyWhatsApp = async () => {
    const success = await copyZReportToClipboard(session, business);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const denominationsList = session.denominations
    ? [
        { label: 'Billets 10 000 F', count: session.denominations.b10000, value: (session.denominations.b10000 || 0) * 10000 },
        { label: 'Billets 5 000 F', count: session.denominations.b5000, value: (session.denominations.b5000 || 0) * 5000 },
        { label: 'Billets 2 000 F', count: session.denominations.b2000, value: (session.denominations.b2000 || 0) * 2000 },
        { label: 'Billets 1 000 F', count: session.denominations.b1000, value: (session.denominations.b1000 || 0) * 1000 },
        { label: 'Billets 500 F', count: session.denominations.b500, value: (session.denominations.b500 || 0) * 500 },
        { label: 'Pièces 500 F', count: session.denominations.p500, value: (session.denominations.p500 || 0) * 500 },
        { label: 'Pièces 200 F', count: session.denominations.p200, value: (session.denominations.p200 || 0) * 200 },
        { label: 'Pièces 100 F', count: session.denominations.p100, value: (session.denominations.p100 || 0) * 100 },
        { label: 'Pièces 50 F', count: session.denominations.p50, value: (session.denominations.p50 || 0) * 50 },
        { label: 'Pièces 25 F', count: session.denominations.p25, value: (session.denominations.p25 || 0) * 25 },
      ].filter((d) => (d.count || 0) > 0)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:rounded-none ${
          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#090d1c] border-cyan-500/40 text-white'
        }`}
      >
        {/* Header bar */}
        <div
          className={`p-4 md:p-5 border-b flex items-center justify-between gap-3 shrink-0 print:hidden ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#050814] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isLight ? 'bg-rose-100 text-rose-800' : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 border border-rose-500/30">
                  Rapport Z Officiel
                </span>
                <span className="text-xs font-mono font-bold">{zNum}</span>
              </div>
              <h2 className="text-base md:text-lg font-extrabold tracking-tight mt-0.5">
                Clôture de Caisse Journalière
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
              }`}
              title="Copier le texte formaté pour WhatsApp"
            >
              <Share2 className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">{copied ? 'Copié !' : 'WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-500 hover:bg-rose-400 text-white font-bold border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
              }`}
              title="Imprimer le ticket Z thermique ou A4"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer Z</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-neutral-800 text-neutral-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body (also acts as print preview) */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-5 flex-1 print:p-6 print:overflow-visible">
          {/* Printable Ticket Z Header */}
          <div className="text-center pb-4 border-b-2 border-inherit space-y-1">
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">
              {business.name}
            </h1>
            {business.address && (
              <p className="text-xs opacity-75 font-medium">{business.address}</p>
            )}
            {business.phone && (
              <p className="text-xs opacity-90 font-bold">Tél : {business.phone}</p>
            )}
            <p className="text-[11px] opacity-70">
              Régime : {business.tradeType} · Gérant : {business.ownerName}
            </p>

            <div className="pt-2">
              <span className="inline-block px-3 py-1 border-2 border-current font-black text-sm uppercase tracking-widest rounded-md">
                RAPPORT DE CAISSE Z
              </span>
              <div className="font-mono font-bold text-sm mt-1">{zNum}</div>
            </div>
          </div>

          {/* Session metadata */}
          <div
            className={`p-3.5 rounded-xl border text-xs grid grid-cols-2 gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060914] border-neutral-800'
            } print:border-black print:bg-white`}
          >
            <div>
              <span className="opacity-60 block text-[10px] uppercase font-bold">Ouverture Caisse</span>
              <span className="font-mono font-bold">{formatDate(session.openedAt)}</span>
            </div>
            <div>
              <span className="opacity-60 block text-[10px] uppercase font-bold">Clôture Caisse</span>
              <span className="font-mono font-bold">
                {session.closedAt ? formatDate(session.closedAt) : 'En cours'}
              </span>
            </div>
            <div>
              <span className="opacity-60 block text-[10px] uppercase font-bold">Caissier(ère)</span>
              <span className="font-bold">{session.cashierName}</span>
            </div>
            <div>
              <span className="opacity-60 block text-[10px] uppercase font-bold">Poste de Caisse</span>
              <span className="font-bold">Caisse N°1 Principale</span>
            </div>
          </div>

          {/* Section 1: Sales Synthesis */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>1. Synthèse des Ventes Réalisées</span>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#060914] border-neutral-800'
              } print:border-black print:bg-white`}
            >
              <div className="flex justify-between items-center text-xs">
                <span>Nombre de tickets émis :</span>
                <span className="font-mono font-bold text-sm">{session.totalSalesCount} ventes</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>Panier moyen client :</span>
                <span className="font-mono font-bold">{formatMoney(avgBasket, cur)}</span>
              </div>
              {(session.discountsTotal || 0) > 0 && (
                <div className="flex justify-between items-center text-xs text-rose-600 dark:text-rose-400">
                  <span>Remises totales accordées :</span>
                  <span className="font-mono font-bold">-{formatMoney(session.discountsTotal || 0, cur)}</span>
                </div>
              )}

              <div
                className={`pt-3 border-t-2 flex justify-between items-center ${
                  isLight ? 'border-slate-300' : 'border-neutral-700'
                } print:border-black`}
              >
                <span className="font-extrabold text-sm uppercase">Chiffre d'Affaires Net :</span>
                <span className="font-mono font-black text-xl text-emerald-600 dark:text-emerald-400 print:text-black">
                  {formatMoney(session.totalSalesAmount, cur)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Payment Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
              <CreditCard className="w-4 h-4 text-purple-500" />
              <span>2. Ventilation des Encaissements par Mode</span>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2 text-xs ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#060914] border-neutral-800'
              } print:border-black print:bg-white`}
            >
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-medium">
                  <Banknote className="w-4 h-4 text-emerald-500 print:hidden" />
                  <span>Espèces (Cash) :</span>
                </span>
                <span className="font-mono font-bold">{formatMoney(session.cashSales || 0, cur)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-medium">
                  <Smartphone className="w-4 h-4 text-orange-500 print:hidden" />
                  <span>Mobile Money (Wave / Orange / MTN / Moov) :</span>
                </span>
                <span className="font-mono font-bold">{formatMoney(session.mobileMoneySales || 0, cur)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-medium">
                  <CreditCard className="w-4 h-4 text-blue-500 print:hidden" />
                  <span>Carte Bancaire :</span>
                </span>
                <span className="font-mono font-bold">{formatMoney(session.cardSales || 0, cur)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-medium">
                  <Receipt className="w-4 h-4 text-rose-500 print:hidden" />
                  <span>Ventes à Crédit (Carnet Client) :</span>
                </span>
                <span className="font-mono font-bold">{formatMoney(session.creditSales || 0, cur)}</span>
              </div>

              {(session.creditSettlementsCash || 0) > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-inherit text-emerald-600 dark:text-emerald-400">
                  <span>+ Règlements de créances reçus en espèces :</span>
                  <span className="font-mono font-bold">+{formatMoney(session.creditSettlementsCash || 0, cur)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Cash drawer reconciliation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
              <Banknote className="w-4 h-4 text-amber-500" />
              <span>3. Rapprochement & Contrôle du Tiroir-Caisse</span>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#060914] border-neutral-800'
              } print:border-black print:bg-white`}
            >
              <div className="flex justify-between items-center">
                <span>Fond de caisse initial :</span>
                <span className="font-mono font-bold">{formatMoney(session.openingFloat, cur)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>+ Total encaissements espèces :</span>
                <span className="font-mono font-bold">
                  +{formatMoney((session.cashSales || 0) + (session.creditSettlementsCash || 0), cur)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-inherit font-bold">
                <span>Espèces théoriques attendues :</span>
                <span className="font-mono text-sm">{formatMoney(session.expectedCash, cur)}</span>
              </div>
              <div className="flex justify-between items-center font-bold">
                <span>Espèces réelles comptées par le caissier :</span>
                <span className="font-mono text-sm">{formatMoney(session.actualCash || 0, cur)}</span>
              </div>

              {/* Difference Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold mt-2 ${
                  isPerfect
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-emerald-950/40 border-emerald-600 text-emerald-300'
                    : isSurplus
                    ? isLight
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                      : 'bg-cyan-950/40 border-cyan-600 text-cyan-300'
                    : isLight
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-rose-950/40 border-rose-600 text-rose-300'
                } print:border-black print:text-black print:bg-white`}
              >
                <div className="flex items-center gap-2">
                  {isPerfect ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                  <div>
                    <div>
                      {isPerfect
                        ? 'Caisse Parfaite · Aucun Écart'
                        : isSurplus
                        ? 'Excédent de Caisse Constaté'
                        : 'Déficit / Manquant de Caisse'}
                    </div>
                    <span className="text-[10px] font-normal opacity-80 block">
                      {isPerfect
                        ? 'Les espèces physiques correspondent exactement au calcul théorique'
                        : isSurplus
                        ? 'Surplus d’espèces dans le tiroir à la clôture'
                        : 'Espèces manquantes nécessitant justification'}
                    </span>
                  </div>
                </div>

                <div className="font-mono text-base font-black">
                  {isSurplus ? `+${formatMoney(diff, cur)}` : formatMoney(diff, cur)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Denominations breakdown (if provided) */}
          {denominationsList.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">
                4. Détail du Billetage (Comptage Physique)
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060914] border-neutral-800'
                } print:border-black print:bg-white`}
              >
                <table className="w-full text-xs">
                  <tbody>
                    {denominationsList.map((d) => (
                      <tr key={d.label} className="border-b border-inherit last:border-none">
                        <td className="py-1">
                          <span className="font-medium">{d.label}</span>
                          <span className="opacity-60 ml-2">× {d.count}</span>
                        </td>
                        <td className="py-1 text-right font-mono font-bold">
                          {formatMoney(d.value, cur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 5: Notes / Remarks */}
          {session.notes && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-950/20 border-amber-500/30'
              } print:border-black print:bg-white`}
            >
              <span className="font-bold block uppercase text-[10px] opacity-75">
                Observation / Justificatif Caissier
              </span>
              <p className="italic">{session.notes}</p>
            </div>
          )}

          {/* Printable Signature Box */}
          <div className="pt-6 border-t-2 border-inherit text-xs">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="font-bold uppercase tracking-wider text-[11px]">
                  Visa Caissier(ère) :
                </p>
                <p className="text-[11px] opacity-70 mt-0.5">{session.cashierName}</p>
                <div className="h-14 border-b border-dashed border-current mt-2" />
                <p className="text-[10px] opacity-60 mt-1 italic">Date & Signature</p>
              </div>

              <div className="text-right">
                <p className="font-bold uppercase tracking-wider text-[11px]">
                  Visa Direction / Gérant :
                </p>
                <p className="text-[11px] opacity-70 mt-0.5">{business.ownerName}</p>
                <div className="h-14 border-b border-dashed border-current mt-2" />
                <p className="text-[10px] opacity-60 mt-1 italic">Date, Signature & Cachet</p>
              </div>
            </div>

            <p className="text-[10px] text-center opacity-60 mt-6 font-mono">
              *** CLÔTURE DÉFINITIVE ARCHIVÉE · LOGICIEL DE CAISSE KASSAPRO POS ***
            </p>
          </div>
        </div>

        {/* Modal Footer (hidden on print) */}
        <div
          className={`p-4 border-t flex items-center justify-between gap-3 shrink-0 print:hidden ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#050814] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-2 text-xs opacity-75">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Rapport Z officiel archivé de manière inaltérable</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
