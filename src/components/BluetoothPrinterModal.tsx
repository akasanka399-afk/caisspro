import React, { useState } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  Printer,
  X,
  AlertTriangle,
  Scissors,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Business } from '../types';
import { useTheme } from '../services/themeContext';
import { playSoundEffect } from '../services/store';
import {
  bluetoothPrinter,
  PaperWidth,
  PrinterEncoding,
  useBluetoothPrinter,
} from '../services/bluetoothPrinter';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  business: Business;
  onClose: () => void;
}

export const BluetoothPrinterModal: React.FC<BluetoothPrinterModalProps> = ({
  isOpen,
  business,
  onClose,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const ble = useBluetoothPrinter();
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  if (!isOpen) return null;

  const showNotice = (message: string, type: 'success' | 'error') => {
    setNotice({ message, type });
    setTimeout(() => {
      setNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const handleConnect = async () => {
    playSoundEffect('beep');
    bluetoothPrinter.clearError();
    const ok = await bluetoothPrinter.connect();
    if (ok) {
      playSoundEffect('cash');
      showNotice(
        `Imprimante « ${bluetoothPrinter.getState().deviceName || 'BLE POS'} » connectée !`,
        'success'
      );
    } else if (bluetoothPrinter.getState().lastError) {
      playSoundEffect('error');
      showNotice(bluetoothPrinter.getState().lastError!, 'error');
    }
  };

  const handleDisconnect = () => {
    playSoundEffect('beep');
    bluetoothPrinter.disconnect();
    showNotice('Imprimante Bluetooth déconnectée.', 'success');
  };

  const handleTestPrint = async () => {
    playSoundEffect('beep');
    try {
      await bluetoothPrinter.printTestPage(business, ble.paperWidth);
      playSoundEffect('cash');
      showNotice(`Ticket test ${ble.paperWidth} imprimé via Bluetooth !`, 'success');
    } catch (err) {
      playSoundEffect('error');
      showNotice((err as Error)?.message || "Impossible d'imprimer le ticket test.", 'error');
    }
  };

  const handleWidthChange = (width: PaperWidth) => {
    playSoundEffect('beep');
    bluetoothPrinter.setPaperWidth(width);
  };

  const handleEncodingChange = (enc: PrinterEncoding) => {
    playSoundEffect('beep');
    bluetoothPrinter.setEncoding(enc);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#090d1c] border-cyan-500/40 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#050814] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                ble.connected
                  ? isLight
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-emerald-950/50 text-emerald-400 border-emerald-500/40'
                  : isLight
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-cyan-950/50 text-cyan-400 border-cyan-500/30'
              }`}
            >
              {ble.connected ? (
                <BluetoothConnected className="w-5 h-5" />
              ) : (
                <Bluetooth className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">
                Imprimante Thermique POS BLE (58 / 80 mm)
              </h2>
              <p className="text-[11px] opacity-70">
                Connexion directe Bluetooth ESC/POS sans fil & format papier
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-neutral-800 text-neutral-400'
            }`}
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Status / Error Feedback */}
          {(notice || ble.lastError) && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                notice?.type === 'success' && !ble.lastError
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : isLight
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {notice?.type === 'success' && !ble.lastError ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              )}
              <span className="flex-1">{notice?.message || ble.lastError}</span>
            </div>
          )}

          {/* Web Bluetooth Support Notice */}
          {!ble.isSupported && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <BluetoothOff className="w-4 h-4 text-amber-500" />
                <span>Bluetooth Web non détecté sur ce navigateur</span>
              </div>
              <p className="opacity-85 leading-relaxed">
                Pour imprimer directement en BLE, ouvrez l&apos;application sur Google Chrome / Edge
                (PC, Mac ou Android) ou Bluefy sur iPhone. En attendant, le choix{' '}
                <strong>58mm / 80mm</strong> reste actif pour l&apos;impression thermique classique.
              </p>
            </div>
          )}

          {/* Connection Box */}
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060914] border-neutral-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
                  État de la liaison Bluetooth
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      ble.connected
                        ? 'bg-emerald-500 animate-pulse'
                        : ble.connecting
                        ? 'bg-amber-500 animate-ping'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span className="font-bold text-sm">
                    {ble.connecting
                      ? 'Connexion en cours...'
                      : ble.connected
                      ? ble.deviceName || 'Imprimante BLE connectée'
                      : 'Aucune imprimante BLE connectée'}
                  </span>
                </div>
              </div>

              {ble.connected && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  Prête ({ble.paperWidth})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConnect}
                disabled={ble.connecting || !ble.isSupported}
                className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLight
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black'
                }`}
              >
                {ble.connecting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Bluetooth className="w-4 h-4" />
                )}
                <span>
                  {ble.connected ? "Changer d'imprimante BLE" : 'Connecter Imprimante BLE'}
                </span>
              </button>

              {ble.connected && (
                <>
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={ble.printing}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 ${
                      isLight
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 border-emerald-400'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>{ble.printing ? 'Envoi...' : `Test ${ble.paperWidth}`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'
                        : 'bg-neutral-900 hover:bg-rose-950/40 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    Déconnecter
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Paper Size Selector (58mm vs 80mm) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider opacity-80 block">
              Largeur du rouleau thermique
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  {
                    width: '58mm' as PaperWidth,
                    title: 'POS 58 mm',
                    desc: '32 colonnes · Mini portable / MPT-II / Goojprt',
                  },
                  {
                    width: '80mm' as PaperWidth,
                    title: 'POS 80 mm',
                    desc: '42 colonnes · Comptoir / Xprinter / Rongta',
                  },
                ] as const
              ).map((opt) => {
                const active = ble.paperWidth === opt.width;
                return (
                  <button
                    key={opt.width}
                    type="button"
                    onClick={() => handleWidthChange(opt.width)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? isLight
                          ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/25 text-amber-950'
                          : 'bg-cyan-500/15 border-cyan-400 ring-2 ring-cyan-400/20 text-white'
                        : isLight
                        ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-neutral-900/80 hover:bg-neutral-900 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">{opt.title}</span>
                      {active && (
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            isLight ? 'text-amber-600' : 'text-cyan-400'
                          }`}
                        />
                      )}
                    </div>
                    <p className="text-[11px] opacity-75 mt-1 leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Encoding Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider opacity-80 block">
              Encodage des caractères ESC/POS
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'ascii' as PrinterEncoding, label: 'Universel', sub: 'Sans accents (Recommandé)' },
                  { id: 'cp858' as PrinterEncoding, label: 'PC858', sub: 'Accents FR (é, à, ç)' },
                  { id: 'utf8' as PrinterEncoding, label: 'UTF-8', sub: 'Imprimantes récentes' },
                ] as const
              ).map((enc) => {
                const active = ble.encoding === enc.id;
                return (
                  <button
                    key={enc.id}
                    type="button"
                    onClick={() => handleEncodingChange(enc.id)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? isLight
                          ? 'bg-blue-50 border-blue-500 text-blue-900'
                          : 'bg-cyan-500/15 border-cyan-400 text-cyan-200'
                        : isLight
                        ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <div className="text-xs font-black">{enc.label}</div>
                    <div className="text-[10px] opacity-75 leading-tight mt-0.5">{enc.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Behavior Toggles */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060914] border-neutral-800'
            }`}
          >
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2 text-xs">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold block">Impression directe Bluetooth par défaut</span>
                  <span className="text-[11px] opacity-70">
                    Envoie automatiquement les tickets vers l&apos;imprimante BLE si connectée
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={ble.autoPrintBle}
                onChange={(e) => bluetoothPrinter.setAutoPrintBle(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer pt-2 border-t border-inherit">
              <div className="flex items-center gap-2 text-xs">
                <Scissors className="w-4 h-4 text-cyan-500 shrink-0" />
                <div>
                  <span className="font-bold block">Coupe papier automatique (80mm)</span>
                  <span className="text-[11px] opacity-70">
                    Envoie la commande ESC/POS GS V en fin de ticket
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={ble.autoCut}
                onChange={(e) => bluetoothPrinter.setAutoCut(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between gap-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#050814] border-cyan-500/20'
          }`}
        >
          <span className="text-[11px] opacity-70">
            Compatible ESC/POS · Xprinter, Goojprt, Rongta, Sunmi, MPT
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-700'
            }`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
