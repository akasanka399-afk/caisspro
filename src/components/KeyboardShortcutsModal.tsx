import React from 'react';
import { useTheme } from '../services/themeContext';
import { X, Keyboard, Zap } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const shortcuts = [
    { key: 'F1', desc: 'Ouvrir ce guide des raccourcis clavier' },
    { key: 'F2', desc: 'Recherche rapide de produit par nom' },
    { key: 'F3', desc: 'Scanner ou saisir un code-barres' },
    { key: 'F4', desc: 'Sélectionner ou saisir le client (figurera sur le reçu)' },
    { key: 'F5', desc: 'Basculer vers la Caisse Rapide (Saisie Directe du Montant)' },
    { key: 'F8', desc: 'Appliquer une remise sur le ticket' },
    { key: 'F9', desc: 'Règlement rapide en Espèces (Cash)' },
    { key: 'F10', desc: 'Règlement Mobile Money (Wave / Orange)' },
    { key: 'F11', desc: 'Règlement Carte Bancaire' },
    { key: 'F12', desc: 'Imprimer le ticket de caisse (format thermique avec caissière & client)' },
    { key: '+', desc: 'Caisse Rapide : Ajouter montant et quantité au ticket' },
    { key: 'Entrée', desc: 'Valider et finaliser l\'encaissement' },
    { key: 'Espace', desc: 'Appoint exact (espèces reçues = total)' },
    { key: 'Échap', desc: 'Annuler / Vider le panier ou le ticket' },
    { key: '+ / -', desc: 'Catalogue : Augmenter ou réduire la quantité de l\'article' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`rounded-xl max-w-lg w-full shadow-2xl overflow-hidden border ${
        isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
      }`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <Keyboard className={`w-5 h-5 ${isLight ? 'text-amber-700' : 'text-cyan-400'}`} />
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Raccourcis Clavier Caisse Rapide
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors ${
              isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className={`flex items-center gap-2.5 p-3 rounded-lg text-xs border ${
            isLight
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-neutral-950/60 border-neutral-800 text-neutral-300'
          }`}>
            <Zap className={`w-4 h-4 shrink-0 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
            <span>
              La caisse Caisse Pro est optimisée pour la saisie ultra-rapide au clavier d'ordinateur et douchette code-barres, sans avoir besoin de la souris !
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {shortcuts.map((sc, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  {sc.desc}
                </span>
                <kbd className={`px-2 py-0.5 text-xs font-mono font-bold rounded shadow-xs shrink-0 ml-2 border ${
                  isLight
                    ? 'bg-white text-slate-800 border-slate-300'
                    : 'bg-neutral-800 text-cyan-300 border-neutral-700'
                }`}>
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className={`p-4 border-t flex justify-end ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
        }`}>
          <button
            onClick={onClose}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              isLight
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow'
            }`}
          >
            Compris (Échap)
          </button>
        </div>
      </div>
    </div>
  );
};
