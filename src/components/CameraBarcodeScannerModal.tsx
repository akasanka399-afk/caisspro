import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useTheme } from '../services/themeContext';
import { playSoundEffect } from '../services/store';
import { Product } from '../types';
import { formatMoney } from '../utils/formatters';
import {
  Camera,
  CameraOff,
  Barcode,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Volume2,
  VolumeX,
  Plus,
  Keyboard,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => { success: boolean; product?: Product; error?: string };
  products: Product[];
  currentMode: 'direct' | 'catalog';
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onBarcodeScanned,
  products,
  currentMode,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  // Scanned history inside modal
  const [recentScans, setRecentScans] = useState<{
    barcode: string;
    productName: string;
    price: number;
    timestamp: number;
    success: boolean;
  }[]>([]);

  // Manual code input fallback
  const [manualCode, setManualCode] = useState<string>('');
  const [scanFlash, setScanFlash] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'kassapro-html5-camera-scanner';
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  // Stop scanner safely
  const stopScanner = async () => {
    if (scannerRef.current && isScanning && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Erreur lors de l’arrêt du scanner caméra:', e);
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
        setIsScanning(false);
      }
    }
  };

  // Start scanner
  const startScanner = async (cameraIdToUse?: string) => {
    await stopScanner();

    // Check DOM element
    const container = document.getElementById(scannerContainerId);
    if (!container) return;

    try {
      setErrorMessage(null);
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.333333,
        formatsToSupport: formats,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      const cameraParam = cameraIdToUse
        ? { deviceId: { exact: cameraIdToUse } }
        : { facingMode: 'environment' };

      await html5QrCode.start(
        cameraParam,
        config,
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        () => {
          // Normal frame with no barcode detected, ignore
        }
      );

      setIsScanning(true);
      setHasCameraPermission(true);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        const torchSupported = Boolean(capabilities && (capabilities as unknown as { torch?: boolean }).torch);
        setHasTorch(torchSupported);
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      console.error('Erreur démarrage caméra:', err);
      setHasCameraPermission(false);
      setIsScanning(false);
      const errStr = String(err);
      if (errStr.includes('NotAllowedError') || errStr.includes('Permission')) {
        setErrorMessage('Accès à la caméra refusé. Veuillez autoriser la caméra dans votre navigateur.');
      } else if (errStr.includes('NotFoundError') || errStr.includes('DevicesNotFoundError')) {
        setErrorMessage('Aucune caméra détectée sur cet appareil.');
      } else {
        setErrorMessage('Impossible d’activer la caméra. Vérifiez vos permissions ou utilisez la douchette USB.');
      }
    }
  };

  // Handle scanned code with debouncing
  const handleDetectedCode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Prevent duplicate triggers within 1.2s for identical code, or 400ms for different codes
    if (cleanCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 1200) {
      return;
    }
    if (now - lastScannedTimeRef.current < 400) {
      return;
    }

    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;

    // Visual scan flash
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 250);

    // Process via parent POSView
    const result = onBarcodeScanned(cleanCode);

    if (soundEnabled) {
      if (result.success) {
        playSoundEffect('beep');
      } else {
        playSoundEffect('error');
      }
    }

    // Add to modal recent history
    setRecentScans((prev) => [
      {
        barcode: cleanCode,
        productName: result.product ? result.product.name : 'Article non répertorié',
        price: result.product ? result.product.salePrice : 0,
        timestamp: now,
        success: result.success,
      },
      ...prev.slice(0, 9),
    ]);

    // If single-shot mode is active, close the modal immediately on success
    if (!continuousMode && result.success) {
      setTimeout(() => {
        handleClose();
      }, 400);
    }
  };

  // Toggle torch / flash
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }] as unknown as MediaTrackConstraintSet[],
      });
      setTorchOn(nextTorch);
      playSoundEffect('beep');
    } catch (e) {
      console.warn('Erreur toggle torch:', e);
    }
  };

  // Manual submission inside modal
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetectedCode(manualCode.trim());
    setManualCode('');
  };

  // Fetch cameras on mount
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const initCameras = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (mounted && devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environment camera if available
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('arrière') ||
            d.label.toLowerCase().includes('environment')
          );
          const initialId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(initialId);
          startScanner(initialId);
        } else if (mounted) {
          // Try generic facingMode environment
          startScanner();
        }
      } catch (e) {
        console.warn('Impossible de lister les caméras:', e);
        if (mounted) {
          startScanner();
        }
      }
    };

    // Small delay to ensure modal DOM is mounted
    const timer = setTimeout(() => {
      initCameras();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  // Handle camera switch
  const handleSwitchCamera = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    startScanner(cameraId);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
            : 'bg-[#090d16] border-cyan-500/30 text-white shadow-[0_0_40px_rgba(0,242,254,0.15)]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-4 py-3.5 border-b flex items-center justify-between gap-3 ${
            isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#0d1222] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isLight
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              }`}
            >
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                  Lecteur de Code-Barres Caméra
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    continuousMode
                      ? isLight
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-emerald-950/60 text-emerald-400 border-emerald-600/40'
                      : isLight
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {continuousMode ? 'Mode Rafale' : 'Scan Unique'}
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                {currentMode === 'direct' ? 'Ajout direct au ticket de caisse' : 'Ajout au panier catalogue'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200 border-slate-200'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border-neutral-700'
            }`}
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Camera Viewport & Reticle Container */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-neutral-800 shadow-inner">
            {/* HTML5 QR Code Container */}
            <div id={scannerContainerId} className="w-full h-full overflow-hidden" />

            {/* Visual Scan Flash Overlay */}
            {scanFlash && (
              <div className="absolute inset-0 bg-emerald-500/40 pointer-events-none animate-ping z-30" />
            )}

            {/* Custom Overlay Reticle & Laser */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-20">
                {/* Aiming Reticle Frame */}
                <div className="relative w-64 sm:w-72 h-36 sm:h-40 border border-white/20 rounded-lg">
                  {/* Glowing Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-sm" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-sm" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-sm" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-sm" />

                  {/* Pulsing Animated Laser Line */}
                  <div className="absolute left-2 right-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ff0055] animate-laser" />

                  {/* Center Crosshair hint */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-white/70 bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">
                      Alignez le code-barres
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-black/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Lecture continue active
                  </span>
                </div>
              </div>
            )}

            {/* Camera Permission / Error Fallback */}
            {errorMessage && (
              <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                  <CameraOff className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Caméra indisponible</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mt-1">{errorMessage}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => startScanner(selectedCameraId)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Réessayer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Toolbar: Mode Rafale, Son, Torche, Sélecteur de Caméra */}
          <div
            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
              isLight
                ? 'bg-slate-50 border-slate-200'
                : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            {/* Mode Rafale Toggle */}
            <button
              onClick={() => {
                setContinuousMode(!continuousMode);
                playSoundEffect('beep');
              }}
              className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                continuousMode
                  ? isLight
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-cyan-500 text-neutral-950 border-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.4)]'
                  : isLight
                  ? 'bg-white text-slate-700 border-slate-300'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}
              title="Permet de scanner plusieurs articles à la chaîne sans fermer la caméra"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{continuousMode ? 'Rafale : Activée' : 'Rafale : Désactivée'}</span>
            </button>

            {/* Bip Sonore Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playSoundEffect('beep');
              }}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                soundEnabled
                  ? isLight
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                  : isLight
                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                  : 'bg-neutral-800 text-neutral-500 border-neutral-700'
              }`}
              title={soundEnabled ? 'Son de confirmation actif' : 'Son désactivé'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Torche / Lampe Toggle */}
            {hasTorch && (
              <button
                onClick={handleToggleTorch}
                className={`px-2 py-1.5 rounded-lg font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                  torchOn
                    ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : isLight
                    ? 'bg-white text-slate-700 border-slate-300'
                    : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                }`}
                title="Activer la lampe torche"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{torchOn ? 'Lampe ON' : 'Lampe'}</span>
              </button>
            )}

            {/* Choix de la caméra si plusieurs */}
            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => handleSwitchCamera(e.target.value)}
                className={`text-xs rounded-lg px-2 py-1.5 border font-medium focus:outline-hidden ${
                  isLight
                    ? 'bg-white text-slate-800 border-slate-300'
                    : 'bg-neutral-800 text-neutral-200 border-neutral-700'
                }`}
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Caméra ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Saisie Manuelle de Secours (En cas de code-barres abîmé ou effacé) */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Keyboard
                className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-neutral-500'
                }`}
              />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Code-barres illisible ? Saisie manuelle..."
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-mono border focus:outline-hidden transition-all ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-white focus:border-cyan-400'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                manualCode.trim()
                  ? isLight
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.3)]'
                  : 'opacity-50 cursor-not-allowed bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              Ajouter
            </button>
          </form>

          {/* Historique des Scans Récents de cette session */}
          {recentScans.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-neutral-700/30">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1">
                <span>Articles Scannés Récemment</span>
                <span className="font-mono text-cyan-400">{recentScans.length} scanné(s)</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {recentScans.map((sc, i) => (
                  <div
                    key={`${sc.barcode}-${sc.timestamp}-${i}`}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between border transition-all ${
                      sc.success
                        ? isLight
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : isLight
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {sc.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      )}
                      <div className="truncate">
                        <span className="font-bold">{sc.productName}</span>
                        <span className="font-mono text-[10px] opacity-70 ml-2">[{sc.barcode}]</span>
                      </div>
                    </div>
                    {sc.price > 0 && (
                      <span className="font-extrabold font-mono shrink-0 ml-2">
                        +{formatMoney(sc.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-4 py-3 border-t flex items-center justify-between gap-3 ${
            isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#0a0e1c] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Barcode className="w-4 h-4 text-cyan-400" />
            <span>Douchette USB également active en arrière-plan</span>
          </div>

          <button
            onClick={handleClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
                : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-extrabold border-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
            }`}
          >
            Terminer le Scan [Échap]
          </button>
        </div>
      </div>
    </div>
  );
};
