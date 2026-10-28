import React, { useState } from 'react';
import { User } from '../types';
import { store } from '../services/store';
import { useTheme } from '../services/themeContext';
import { Shield, KeyRound, UserCheck, X, Store, Lock } from 'lucide-react';

interface AuthModalProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ currentUser, onSelectUser, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const users = store.getUsers();
  const [pinInput, setPinInput] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleQuickSelect = (user: User) => {
    onSelectUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`rounded-xl max-w-xl w-full shadow-2xl overflow-hidden border ${
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
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Changer de Profil & Authentification
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Connecté actuellement en tant que : <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{currentUser.name}</span>
              </p>
            </div>
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Fast Role Switchers */}
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider block mb-3 ${
              isLight ? 'text-slate-500' : 'text-neutral-400'
            }`}>
              Sélectionnez un rôle pour tester les droits d'accès :
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.id;
                const roleBadge: Record<string, { label: string; color: string; desc: string }> = {
                  developer: {
                    label: 'Développeur (Plateforme)',
                    color: isLight ? 'text-purple-800 border-purple-200 bg-purple-50' : 'text-purple-400 border-purple-500/30 bg-purple-950/20',
                    desc: 'Admin global, statistiques 20F/vente, abonnements commerces, gestion comptes & mots de passe',
                  },
                  owner: {
                    label: 'Propriétaire (Commerce)',
                    color: isLight ? 'text-amber-800 border-amber-200 bg-amber-50' : 'text-amber-400 border-amber-500/30 bg-amber-950/20',
                    desc: 'CA Journalier/Hebdo/Mensuel, compteur 20F, création accès gérants & caissiers',
                  },
                  manager: {
                    label: 'Gérante de Magasin',
                    color: isLight ? 'text-blue-800 border-blue-200 bg-blue-50' : 'text-blue-400 border-blue-500/30 bg-blue-950/20',
                    desc: 'Gestion des stocks, catalogue produits, alertes critiques, suivi clientèle',
                  },
                  cashier: {
                    label: 'Caissier(e) Tactile',
                    color: isLight ? 'text-emerald-800 border-emerald-200 bg-emerald-50' : 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
                    desc: 'Caisse rapide tactile, clavier d\'ordinateur, scan code-barres, encaissements',
                  },
                };

                const meta = roleBadge[u.role] || {
                  label: u.role,
                  color: isLight ? 'text-slate-700 border-slate-200 bg-slate-100' : 'text-neutral-400 border-neutral-800 bg-neutral-900',
                  desc: '',
                };

                return (
                  <button
                    key={u.id}
                    onClick={() => handleQuickSelect(u)}
                    className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                      isCurrent
                        ? isLight
                          ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/40'
                          : 'border-amber-400/70 bg-amber-950/20 ring-1 ring-amber-400/50'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${meta.color}`}>
                          {meta.label}
                        </span>
                        {isCurrent && <UserCheck className={`w-4 h-4 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />}
                      </div>
                      <h4 className={`text-sm font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{u.name}</h4>
                      <p className={`text-xs truncate mt-0.5 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>{u.email}</p>
                    </div>
                    <p className={`text-[11px] mt-2.5 pt-2 border-t leading-snug ${
                      isLight ? 'border-slate-200 text-slate-600' : 'border-neutral-800/80 text-neutral-400'
                    }`}>
                      {meta.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick PIN lock option */}
          <div className={`p-4 rounded-lg flex items-center justify-between border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}>
            <div className="flex items-center gap-3">
              <Lock className={`w-5 h-5 ${isLight ? 'text-slate-400' : 'text-neutral-400'}`} />
              <div>
                <h4 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Sécurité Caisse par Code PIN
                </h4>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                  Chaque caissier et gérant dispose d'un code PIN rapide à 4 chiffres (ex: 0000, 1234, 2244)
                </p>
              </div>
            </div>
            <span className={`text-xs font-mono px-2.5 py-1 rounded border font-semibold ${
              isLight ? 'bg-white border-slate-300 text-amber-800' : 'bg-neutral-900 border-neutral-800 text-amber-400'
            }`}>
              Chiffrement AES-256
            </span>
          </div>
        </div>

        <div className={`p-4 border-t flex justify-end ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              isLight
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
