import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme } from '../services/themeContext';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // If already installed and running in standalone mode, show subtle verified badge or nothing
  if (isInstalled) {
    return (
      <div
        className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${
          isLight
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
        }`}
        title="Application installée en mode natif PWA Hors-Ligne"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span>PWA Installée</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs active:scale-95 ${
          isLight
            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
            : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 border-cyan-300 font-extrabold shadow-[0_0_12px_rgba(0,242,254,0.4)]'
        }`}
        title="Installer l'application Caisse Pro sur votre ordinateur ou smartphone (Accès Hors-Ligne)"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installer l'app (PWA)</span>
        <span className="sm:hidden">Installer</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
            isLight
              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
          }`}
          title="Installer sur iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">Installer (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className={`rounded-2xl max-w-sm w-full p-5 shadow-2xl border ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-neutral-900 border-neutral-700 text-white'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-500" />
                  <h4 className="font-bold text-sm">Installer Caisse Pro sur iOS</h4>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    1
                  </span>
                  <span>
                    Dans Safari, appuyez sur l'icône <strong>Partager</strong> <Share className="inline w-3.5 h-3.5 text-blue-500" /> au bas de l'écran.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    2
                  </span>
                  <span>
                    Faites défiler vers le bas et sélectionnez <strong>« Sur l'écran d'accueil »</strong> (+).
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    3
                  </span>
                  <span>
                    Appuyez sur <strong>Ajouter</strong>. L'application fonctionnera comme une vraie application tactile hors-ligne !
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback button for desktop browsers that support PWA or manual prompt
  return (
    <button
      onClick={() => {
        alert(
          "Installation PWA :\n\n• Sur Chrome / Edge : Cliquez sur l'icône d'installation dans la barre d'adresse (ou Menu ⋮ > Installer Caisse Pro).\n• Sur Smartphone : Menu ⋮ > Ajouter à l'écran d'accueil.\n\nL'application s'ouvrira en plein écran et fonctionnera même hors-ligne !"
        );
      }}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
        isLight
          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
      }`}
      title="Guide d'installation PWA Hors-Ligne"
    >
      <Download className="w-3.5 h-3.5 text-amber-500" />
      <span className="hidden sm:inline">Installer l'app (PWA)</span>
    </button>
  );
};
