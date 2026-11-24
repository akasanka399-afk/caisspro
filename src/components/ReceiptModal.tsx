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
  Sparkles,
  Bluetooth,
  BluetoothConnected,
} from 'lucide-react';
import {
  bluetoothPrinter,
  PaperWidth,
  useBluetoothPrinter,
} from '../services/bluetoothPrinter';
import { BluetoothPrinterModal } from './BluetoothPrinterModal';

interface ReceiptModalProps {
  transaction: SaleTransaction;
  business: Business;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, business, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const ble = useBluetoothPrinter();
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isPrintingBle, setIsPrintingBle] = useState<boolean>(false);
  const [showBleModal, setShowBleModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    playSoundEffect('beep');
    try {
      const result = await printThermalReceipt(transaction, business, {
        paperWidth: ble.paperWidth,
      });
      if (result.method === 'bluetooth') {
        playSoundEffect('cash');
        showFeedback(
          `Ticket imprimé en Bluetooth (${result.paperWidth}) sur ${result.deviceName || 'Imprimante BLE'}`,
          'success'
        );
      } else if (result.method === 'download') {
        showFeedback(`Ticket (${result.paperWidth}) téléchargé automatiquement`, 'info');
      } else if (result.bleFallbackReason) {
        showFeedback(
          `BLE indisponible (${result.bleFallbackReason}) · Impression système (${result.paperWidth}) lancée`,
          'info'
        );
      } else {
        showFeedback(`Ticket envoyé à votre imprimante (${result.paperWidth})`, 'success');
      }
    } catch (err) {
      console.error('Erreur lors de l’impression:', err);
      downloadReceiptHtml(transaction, business, ble.paperWidth);
      showFeedback('Fichier ticket généré et téléchargé', 'info');
    } finally {
      setTimeout(() => setIsPrinting(false), 700);
    }
  };

  const handlePrintBluetooth = async () => {
    playSoundEffect('beep');
    if (!bluetoothPrinter.isConnected()) {
      setShowBleModal(true);
      return;
    }

    setIsPrintingBle(true);
    try {
      const result = await printThermalReceipt(transaction, business, {
        paperWidth: ble.paperWidth,
        forceBluetooth: true,
      });
      playSoundEffect('cash');
      showFeedback(
        `Ticket envoyé en Bluetooth (${result.paperWidth}) vers ${result.deviceName || 'Imprimante BLE'}`,
        'success'
      );
    } catch (err) {
      playSoundEffect('error');
      showFeedback((err as Error)?.message || "Échec d'impression Bluetooth.", 'info');
    } finally {
      setIsPrintingBle(false);
    }
  };

  const handleDownload = () => {
    playSoundEffect('beep');
    downloadReceiptHtml(transaction, business, ble.paperWidth);
    showFeedback(`Ticket (${ble.paperWidth}) téléchargé au format HTML prêt à imprimer`, 'success');
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

  const isCancelled = transaction.status === 'cancelled';

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
              isCancelled
                ? 'text-rose-500'
                : isLight
                ? 'text-emerald-700'
                : 'text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCancelled ? 'Vente Annulée · Ticket Archivé' : 'Vente Validée · Ticket de Caisse'}</span>
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

        {/* Format toolbar: 58mm / 80mm + BLE Status + WhatsApp Copy */}
        <div
          className={`px-4 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2 border-b ${
            isLight ? 'bg-slate-100/70 text-slate-600 border-slate-200' : 'bg-neutral-900/90 text-neutral-400 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">Rouleau :</span>
            {(['58mm', '80mm'] as PaperWidth[]).map((w) => {
              const active = ble.paperWidth === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    playSoundEffect('beep');
                    bluetoothPrinter.setPaperWidth(w);
                  }}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                    active
                      ? isLight
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-cyan-400 text-neutral-950 border-cyan-400'
                      : isLight
                      ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                  }`}
                >
                  {w}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowBleModal(true)}
              className={`ml-1 px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                ble.connected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                  : isLight
                  ? 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  : 'bg-neutral-800 text-cyan-300 border-cyan-500/30 hover:bg-neutral-700'
              }`}
              title="Configurer l'imprimante Bluetooth BLE"
            >
              {ble.connected ? (
                <BluetoothConnected className="w-3 h-3" />
              ) : (
                <Bluetooth className="w-3 h-3" />
              )}
              <span>{ble.connected ? ble.deviceName || 'BLE Prête' : 'Config BLE'}</span>
            </button>
          </div>

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
            <span>{copied ? 'Copié !' : 'WhatsApp'}</span>
          </button>
        </div>

        {/* Thermal Receipt Preview Paper */}
        <div
          className={`p-5 flex justify-center max-h-[60vh] overflow-y-auto ${
            isLight ? 'bg-slate-100' : 'bg-neutral-950'
          }`}
        >
          <div
            id="thermal-receipt-print-area"
            className={`w-full bg-white text-black rounded-md shadow-md font-sans leading-snug select-text border-2 border-black transition-all ${
              ble.paperWidth === '58mm'
                ? 'max-w-[260px] p-3.5 text-[11px]'
                : 'max-w-[340px] p-5 text-xs'
            }`}
            style={{ color: '#000000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            {/* Store details */}
            <div className="text-center pb-3 border-b-2 border-black">
              <h2 className="text-base font-black tracking-wide text-black uppercase">{business.name}</h2>
              {business.address && <p className="text-xs font-bold text-black mt-0.5">{business.address}</p>}
              {business.phone && <p className="text-xs font-bold text-black">Tél: {business.phone}</p>}
              <p className="text-[11px] font-bold text-black mt-1">Commerce Enregistré · Caisse Pro</p>
              {isCancelled && (
                <div className="mt-2 p-1.5 border-2 border-black bg-rose-100 text-black text-[11px] font-black uppercase">
                  *** VENTE ANNULÉE ***
                  {transaction.cancellationReason && (
                    <div className="font-bold normal-case mt-0.5">
                      Motif : {transaction.cancellationReason}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ticket info */}
            <div className="py-2.5 border-b-2 border-dashed border-black text-xs font-bold text-black space-y-1">
              <div className="flex justify-between">
                <span>Ticket N°:</span>
                <span className="font-black">{transaction.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-bold">{formatDate(transaction.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span>Caissier(ère):</span>
                <span className="font-black text-black">{transaction.cashierName || 'Caisse Principale'}</span>
              </div>
              <div className="flex justify-between">
                <span>Client:</span>
                <span className="font-black text-black">{transaction.customerName || 'Client Comptoir'}</span>
              </div>
              {transaction.customerPhone && (
                <div className="flex justify-between">
                  <span>Tél. Client:</span>
                  <span className="font-black text-black">{transaction.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="py-2.5 border-b-2 border-dashed border-black">
              <table className="w-full text-xs text-black">
                <thead>
                  <tr className="border-b-2 border-black text-black text-left font-black">
                    <th className="pb-1.5">Désignation</th>
                    <th className="pb-1.5 text-center">Qté</th>
                    <th className="pb-1.5 text-right">P.U</th>
                    <th className="pb-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300">
                  {transaction.items.map((it, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="pt-1.5 pr-1 font-bold text-black truncate max-w-[130px]">{it.productName}</td>
                      <td className="pt-1.5 text-center font-black text-black">{it.quantity}</td>
                      <td className="pt-1.5 text-right font-bold tabular-nums text-black">{it.unitPrice}</td>
                      <td className="pt-1.5 text-right font-black tabular-nums text-black">{it.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b-2 border-dashed border-black text-xs font-bold text-black space-y-1">
              <div className="flex justify-between">
                <span>Sous-total:</span>
                <span className="tabular-nums font-black">{transaction.subtotal} F</span>
              </div>
              {transaction.discountTotal > 0 && (
                <div className="flex justify-between text-black">
                  <span>Remise accordée:</span>
                  <span className="tabular-nums font-black">-{transaction.discountTotal} F</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black pt-1.5 pb-1 border-y-2 border-black text-black">
                <span>TOTAL À PAYER:</span>
                <span className="tabular-nums">{formatMoney(transaction.totalAmount, 'F CFA')}</span>
              </div>
            </div>

            {/* Payment details */}
            <div className="py-2.5 border-b-2 border-dashed border-black text-xs font-bold text-black space-y-1">
              <div className="flex justify-between">
                <span>Mode de règlement:</span>
                <span className="font-black">{paymentLabels[transaction.paymentMethod] || transaction.paymentMethod}</span>
              </div>
              {transaction.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span>Espèces reçues:</span>
                    <span className="tabular-nums font-bold">{formatMoney(transaction.amountReceived, 'F')}</span>
                  </div>
                  <div className="flex justify-between font-black text-black">
                    <span>Monnaie rendue:</span>
                    <span className="tabular-nums">{formatMoney(transaction.changeDue, 'F')}</span>
                  </div>
                </>
              )}
              {transaction.paymentMethod === 'credit' && (
                <div className="mt-2 p-2 border-2 border-black rounded text-[11px] font-bold text-black bg-neutral-50">
                  <div className="text-center font-black uppercase tracking-wider text-black">*** VENTE À CRÉDIT (DETTE) ***</div>
                  <div className="flex justify-between mt-1">
                    <span>Titulaire du compte :</span>
                    <span className="font-black">{transaction.customerName || 'Compte Client'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Porté au carnet :</span>
                    <span className="font-black">{formatMoney(transaction.totalAmount, 'F CFA')}</span>
                  </div>
                  <div className="mt-3 pt-1 border-t border-dashed border-black text-right text-[10px]">
                    Signature / Décharge Client : __________________
                  </div>
                </div>
              )}
            </div>

            {/* Footer barcode & thanks */}
            <div className="pt-3 text-center space-y-2">
              <div className="h-8 bg-black text-white flex items-center justify-center tracking-widest font-mono text-[11px] font-black rounded">
                |||| || | ||||| ||| || |||||| || | ||||
              </div>
              <p className="text-xs text-black font-extrabold">
                Merci de votre visite et à très bientôt !
              </p>
              <p className="text-[11px] text-black font-bold">
                Caisse Pro v2.4 · Reçu officiel de vente
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
              <span>HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrintBluetooth}
              disabled={isPrintingBle}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap border cursor-pointer ${
                isPrintingBle ? 'opacity-70 cursor-wait' : ''
              } ${
                ble.connected
                  ? isLight
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 border-cyan-300 font-black'
                  : isLight
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border-cyan-500/40'
              }`}
              title={
                ble.connected
                  ? `Imprimer directement en Bluetooth (${ble.paperWidth})`
                  : 'Connecter une imprimante thermique Bluetooth BLE'
              }
            >
              {ble.connected ? (
                <BluetoothConnected className="w-4 h-4" />
              ) : (
                <Bluetooth className="w-4 h-4" />
              )}
              <span>
                {isPrintingBle
                  ? 'Envoi BLE...'
                  : ble.connected
                  ? `BLE (${ble.paperWidth})`
                  : 'Bluetooth BLE'}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                isPrinting ? 'opacity-70 cursor-wait' : ''
              } ${
                isLight
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-98'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950 neon-glow active:scale-98'
              }`}
              title={`Lancer l'impression thermique (${ble.paperWidth})`}
            >
              <Printer className="w-4 h-4" />
              <span>
                {isPrinting ? 'Impression...' : `Imprimer (${ble.paperWidth})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      <BluetoothPrinterModal
        isOpen={showBleModal}
        business={business}
        onClose={() => setShowBleModal(false)}
      />
    </div>
  );
};
