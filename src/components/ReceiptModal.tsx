import React, { useState } from 'react';
import { Business, SaleTransaction } from '../types';
import { useTheme } from '../services/themeContext';
import { playSoundEffect } from '../services/store';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  printThermalReceipt,
  downloadReceiptHtml,
  downloadReceiptText,
  copyReceiptToClipboard,
} from '../utils/printReceipt';
import {
  Printer,
  X,
  CheckCircle2,
  Download,
  Copy,
  Check,
  FileText,
  Share2,
  Sparkles,
} from 'lucide-react';

interface ReceiptModalProps {
  transaction: SaleTransaction;
  business: Business;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, business, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 3500);
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    playSoundEffect('beep');
    try {
      const result = await printThermalReceipt(transaction, business);
      if (result.method === 'download') {
        showFeedback('Ticket téléchargé automatiquement (prêt à imprimer)', 'info');
      } else {
        showFeedback('Ticket envoyé à votre imprimante thermique (80mm/58mm)', 'success');
      }
    } catch (err) {
      console.error('Erreur lors de l’impression:', err);
      // Fallback: download HTML ticket
      downloadReceiptHtml(transaction, business);
      showFeedback('Fichier ticket généré et téléchargé', 'info');
    } finally {
      setTimeout(() => setIsPrinting(false), 800);
    }
  };

  const handleDownload = () => {
    playSoundEffect('beep');
    downloadReceiptHtml(transaction, business);
    showFeedback('Ticket téléchargé au format HTML prêt à imprimer', 'success');
  };

  const handleCopyText = async () => {
    playSoundEffect('beep');
    const ok = await copyReceiptToClipboard(transaction, business);
    if (ok) {
      setCopied(true);
      showFeedback('Texte du ticket copié ! (Collez dans WhatsApp / SMS)', 'success');
      setTimeout(() => setCopied(false), 2500);
    } else {
      showFeedback('Impossible de copier le ticket', 'info');
    }
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Espèces (Cash)',
    mobile_money: 'Mobile Money (Wave / Orange Money)',
    card: 'Carte Bancaire',
    credit: 'À crédit (Compte Client)',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col border my-auto transition-all ${
          isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
        }`}
      >
        {/* Header Action Bar */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-b ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-sm font-bold ${
              isLight ? 'text-emerald-700' : 'text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Vente Validée · Ticket de Caisse</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert notification if any */}
        {feedback && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b transition-all ${
              feedback.type === 'success'
                ? isLight
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                : isLight
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-blue-950/60 text-blue-300 border-blue-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        {/* Format toolbar info */}
        <div
          className={`px-4 py-2 text-[11px] flex items-center justify-between border-b ${
            isLight ? 'bg-slate-100/70 text-slate-600 border-slate-200' : 'bg-neutral-900/90 text-neutral-400 border-neutral-800'
          }`}
        >
          <span className="font-mono">Format Papier: 80mm / 58mm Thermique</span>
          <button
            type="button"
            onClick={handleCopyText}
            className={`inline-flex items-center gap-1 text-[11px] font-medium hover:underline cursor-pointer ${
              copied
                ? 'text-emerald-500 font-bold'
                : isLight
                ? 'text-slate-700 hover:text-slate-900'
                : 'text-neutral-300 hover:text-white'
            }`}
            title="Copier le texte du ticket pour WhatsApp / SMS"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copié !' : 'Copier pour WhatsApp'}</span>
          </button>
        </div>

        {/* Thermal Receipt Preview Paper */}
        <div
          className={`p-5 flex justify-center max-h-[62vh] overflow-y-auto ${
            isLight ? 'bg-slate-100' : 'bg-neutral-950'
          }`}
        >
          <div
            id="thermal-receipt-print-area"
            className="w-full max-w-[340px] bg-white text-neutral-900 p-5 rounded-md shadow-md text-xs font-mono leading-relaxed select-text border border-neutral-300"
          >
            {/* Store details */}
            <div className="text-center pb-3 border-b border-dashed border-neutral-300">
              <h2 className="text-base font-bold tracking-tight text-neutral-950 uppercase">{business.name}</h2>
              {business.address && <p className="text-[11px] text-neutral-600">{business.address}</p>}
              {business.phone && <p className="text-[11px] text-neutral-600">Tél: {business.phone}</p>}
              <p className="text-[10px] text-neutral-500 mt-1">N° RCCM / Commerce Enregistré</p>
            </div>

            {/* Ticket info */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Ticket N°:</span>
                <span className="font-bold">{transaction.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formatDate(transaction.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span>Caissière / Caissier:</span>
                <span className="font-bold text-neutral-950">{transaction.cashierName || 'Caisse Principale'}</span>
              </div>
              <div className="flex justify-between">
                <span>Client:</span>
                <span className="font-bold text-neutral-950">{transaction.customerName || 'Client Comptoir'}</span>
              </div>
              {transaction.customerPhone && (
                <div className="flex justify-between">
                  <span>Tél. Client:</span>
                  <span className="font-bold font-mono text-neutral-950">{transaction.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="py-2.5 border-b border-dashed border-neutral-300">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-600 text-left">
                    <th className="pb-1">Désignation</th>
                    <th className="pb-1 text-center">Qté</th>
                    <th className="pb-1 text-right">P.U</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {transaction.items.map((it, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="pt-1 pr-1 font-medium truncate max-w-[130px]">{it.productName}</td>
                      <td className="pt-1 text-center font-bold">{it.quantity}</td>
                      <td className="pt-1 text-right tabular-nums">{it.unitPrice}</td>
                      <td className="pt-1 text-right font-bold tabular-nums">{it.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Sous-total:</span>
                <span className="tabular-nums">{transaction.subtotal} F</span>
              </div>
              {transaction.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Remise accordée:</span>
                  <span className="tabular-nums font-bold">-{transaction.discountTotal} F</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-neutral-200 text-neutral-950">
                <span>TOTAL À PAYER:</span>
                <span className="tabular-nums">{formatMoney(transaction.totalAmount, 'F')}</span>
              </div>
            </div>

            {/* Payment details */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Mode de règlement:</span>
                <span className="font-semibold">{paymentLabels[transaction.paymentMethod] || transaction.paymentMethod}</span>
              </div>
              {transaction.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span>Espèces reçues:</span>
                    <span className="tabular-nums font-bold">{formatMoney(transaction.amountReceived, 'F')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-neutral-950">
                    <span>Monnaie rendue:</span>
                    <span className="tabular-nums">{formatMoney(transaction.changeDue, 'F')}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer barcode & thanks */}
            <div className="pt-3 text-center space-y-2">
              <div className="h-8 bg-neutral-900 text-white flex items-center justify-center tracking-widest font-mono text-[9px] rounded">
                |||| || | ||||| ||| || |||||| || | ||||
              </div>
              <p className="text-[10px] text-neutral-600 font-medium">
                Merci de votre visite et à bientôt !
              </p>
              <p className="text-[9px] text-neutral-500">
                Caisse Pro v2.4 · Caisse Tactile & Gestion Commerciale
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div
          className={`p-4 border-t flex flex-wrap items-center justify-between gap-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900 border-neutral-800'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              isLight
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
          >
            Fermer (Échap)
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDownload}
              className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap border cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
              }`}
              title="Télécharger le ticket (.html imprimable)"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Télécharger (.html)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                isPrinting
                  ? 'opacity-70 cursor-wait'
                  : ''
              } ${
                isLight
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-98'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950 neon-glow active:scale-98'
              }`}
              title="Lancer l'impression sur votre imprimante thermique (80mm)"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Impression en cours...' : 'Imprimer Ticket (80mm)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
