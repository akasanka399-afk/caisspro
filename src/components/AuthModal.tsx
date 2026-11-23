import React, { useState, useEffect, useCallback } from 'react';
import { User, Business } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import {
  Lock,
  Key,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  X,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Briefcase,
  Search,
  Loader2,
} from 'lucide-react';

interface AuthModalProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ currentUser, onSelectUser, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [accessCodeInput, setAccessCodeInput] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [passwordOrPin, setPasswordOrPin] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [detectedBusiness, setDetectedBusiness] = useState<Business | null>(null);
  const [businessStaff, setBusinessStaff] = useState<User[]>([]);
  const [isSearchingCloud, setIsSearchingCloud] = useState<boolean>(false);
  const [cloudLookupDoneFor, setCloudLookupDoneFor] = useState<string>('');

  const syncMatchingBusinessFromLocal = useCallback((rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) {
      setDetectedBusiness(null);
      setBusinessStaff([]);
      setSelectedUserId('');
      return null;
    }

    const biz = store.getBusinessByAccessCode(trimmed);
    if (biz) {
      setDetectedBusiness(biz);
      const staff = store.getUsersByBusinessId(biz.id);
      // Trier pour afficher clairement Propriétaire puis Gérant puis Caissier
      const roleOrder: Record<string, number> = { owner: 1, manager: 2, cashier: 3, developer: 4 };
      const sortedStaff = [...staff].sort(
        (a, b) => (roleOrder[a.role] || 9) - (roleOrder[b.role] || 9)
      );
      setBusinessStaff(sortedStaff);

      setSelectedUserId((prevId) => {
        if (prevId && sortedStaff.some((u) => u.id === prevId)) {
          return prevId;
        }
        const defaultStaff =
          sortedStaff.find((u) => u.role === 'cashier') || sortedStaff[0];
        return defaultStaff ? defaultStaff.id : '';
      });
      setErrorMessage('');
      return { biz, staff: sortedStaff };
    }

    setDetectedBusiness(null);
    setBusinessStaff([]);
    setSelectedUserId('');
    return null;
  }, []);

  // Re-evaluate immediately when accessCodeInput changes or when store receives Firestore updates
  useEffect(() => {
    syncMatchingBusinessFromLocal(accessCodeInput);
    const unsub = store.subscribe(() => {
      syncMatchingBusinessFromLocal(accessCodeInput);
    });
    return () => unsub();
  }, [accessCodeInput, syncMatchingBusinessFromLocal]);

  // Direct Firestore Cloud lookup when code looks complete (>= 4 chars) so mobile devices find remote businesses immediately
  const triggerCloudLookup = useCallback(async (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase();
    if (clean.length < 4) return;
    setIsSearchingCloud(true);
    try {
      await store.fetchBusinessAndStaffByAccessCode(clean);
      setCloudLookupDoneFor(clean);
      syncMatchingBusinessFromLocal(clean);
    } finally {
      setIsSearchingCloud(false);
    }
  }, [syncMatchingBusinessFromLocal]);

  useEffect(() => {
    const clean = accessCodeInput.trim().toUpperCase();
    if (clean.length < 4) {
      setCloudLookupDoneFor('');
      return;
    }
    const localMatch = syncMatchingBusinessFromLocal(clean);
    if (localMatch && localMatch.staff.length > 0) {
      return;
    }
    const timer = setTimeout(() => {
      triggerCloudLookup(clean);
    }, 350);
    return () => clearTimeout(timer);
  }, [accessCodeInput, syncMatchingBusinessFromLocal, triggerCloudLookup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!accessCodeInput.trim()) {
      playSoundEffect('error');
      setErrorMessage("Veuillez saisir le code d'accès de votre commerce.");
      return;
    }

    // Si le commerce n'est pas encore en local (ex: saisi vite sur téléphone), tenter une lecture Cloud d'abord
    if (!store.getBusinessByAccessCode(accessCodeInput.trim())) {
      setIsSearchingCloud(true);
      await store.fetchBusinessAndStaffByAccessCode(accessCodeInput.trim());
      setIsSearchingCloud(false);
      syncMatchingBusinessFromLocal(accessCodeInput);
    }

    if (!passwordOrPin.trim()) {
      playSoundEffect('error');
      setErrorMessage('Le mot de passe / code PIN fourni par le propriétaire est obligatoire.');
      return;
    }

    const result = store.loginWithBusinessCodeAndPassword({
      accessCode: accessCodeInput.trim(),
      userId: selectedUserId || undefined,
      passwordOrPin: passwordOrPin.trim(),
    });

    if (!result.success || !result.user) {
      playSoundEffect('error');
      setErrorMessage(
        result.error || 'Identifiants incorrects. Veuillez vérifier auprès du propriétaire.'
      );
      return;
    }

    playSoundEffect('cash');
    const bizName = result.business?.name || 'Votre magasin';
    setSuccessMessage(`Session ouverte avec succès pour ${result.user.name} (${bizName}) !`);

    setTimeout(() => {
      onSelectUser(result.user!);
      onClose();
    }, 800);
  };

  const handleDisconnect = () => {
    playSoundEffect('beep');
    setAccessCodeInput('');
    setSelectedUserId('');
    setPasswordOrPin('');
    setDetectedBusiness(null);
    setBusinessStaff([]);
    setErrorMessage('');
    setSuccessMessage('Session déconnectée. Veuillez vous ré-authentifier.');
  };

  const roleLabels: Record<string, string> = {
    developer: 'Développeur',
    owner: 'Propriétaire',
    manager: 'Gérant(e)',
    cashier: 'Caissier / Caissière',
  };

  const shortRoleBadge: Record<string, string> = {
    developer: 'Développeur',
    owner: 'Propriétaire',
    manager: 'Gérant(e)',
    cashier: 'Caissier(ère)',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4">
      <div
        className={`rounded-2xl max-w-lg w-full shadow-2xl border my-2 sm:my-auto flex flex-col max-h-[92dvh] ${
          isLight
            ? 'retail-card bg-white border-slate-300'
            : 'neon-card bg-[#0a0e1e] border-neutral-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-400/10 text-amber-400'
              }`}
            >
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm sm:text-base font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Authentification & Session Sécurisée
              </h3>
              <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Session active :{' '}
                <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {currentUser.name}
                </span>{' '}
                ({roleLabels[currentUser.role]})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              isLight
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content for Mobile Phones & Small Screens */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Security & Offline Banner */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs leading-relaxed ${
              isLight
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <strong>Accès confidentiel & Multi-appareils :</strong> Saisissez le code du commerce, choisissez <strong>Propriétaire</strong> ou <strong>Caissier</strong>, puis entrez votre code PIN.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Code Commerce */}
            <div>
              <label
                className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-neutral-300'
                }`}
              >
                1. Code Connexion du Commerce :
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Key className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-neutral-500'}`} />
                  </div>
                  <input
                    type="text"
                    value={accessCodeInput}
                    onChange={(e) => {
                      setAccessCodeInput(e.target.value.toUpperCase());
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    placeholder="Ex: CP-8842"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl font-mono text-base sm:text-sm font-extrabold tracking-wider transition-all uppercase ${
                      isLight
                        ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                        : 'bg-neutral-900 border border-neutral-700 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'
                    }`}
                    autoFocus
                    required
                  />
                </div>
                {accessCodeInput.trim().length >= 4 && !detectedBusiness && (
                  <button
                    type="button"
                    onClick={() => triggerCloudLookup(accessCodeInput)}
                    disabled={isSearchingCloud}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shrink-0 cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
                    }`}
                  >
                    {isSearchingCloud ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="hidden xs:inline">Rechercher</span>
                  </button>
                )}
              </div>

              {isSearchingCloud && !detectedBusiness && (
                <div className="mt-2 flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Recherche du commerce sur le serveur Cloud...</span>
                </div>
              )}

              {detectedBusiness && (
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Commerce identifié : {detectedBusiness.name}</span>
                </div>
              )}

              {!isSearchingCloud &&
                !detectedBusiness &&
                cloudLookupDoneFor === accessCodeInput.trim().toUpperCase() &&
                accessCodeInput.trim().length >= 4 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Aucun commerce trouvé avec ce code. Vérifiez le format (ex: CP-8842).</span>
                  </div>
                )}
            </div>

            {/* Step 2: Choix tactile clair entre Propriétaire, Gérant et Caissier */}
            <div>
              <label
                className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-neutral-300'
                }`}
              >
                2. Choix du Profil (Propriétaire ou Caissier) :
              </label>

              {detectedBusiness && businessStaff.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {businessStaff.map((staff) => {
                    const isSelected = selectedUserId === staff.id;
                    const isOwner = staff.role === 'owner';
                    return (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(staff.id);
                          setErrorMessage('');
                          playSoundEffect('beep');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? isLight
                              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/25 text-slate-900'
                              : 'bg-cyan-950/50 border-cyan-400 ring-2 ring-cyan-400/25 text-white'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isOwner
                              ? isSelected
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isOwner ? (
                            <Briefcase className="w-4 h-4" />
                          ) : (
                            <UserIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-extrabold uppercase tracking-wide">
                            {shortRoleBadge[staff.role] || staff.role}
                          </div>
                          <div className="text-xs font-semibold truncate">{staff.name}</div>
                        </div>
                        {isSelected && (
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              isLight ? 'text-amber-600' : 'text-cyan-400'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {detectedBusiness
                    ? "Aucun compte utilisateur actif trouvé pour ce commerce."
                    : "Saisissez le code connexion ci-dessus (ex: CP-8842) pour choisir entre Propriétaire ou Caissier."}
                </div>
              )}
            </div>

            {/* Step 3: Mandatory Password / PIN provided by owner */}
            <div>
              <label
                className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-neutral-300'
                }`}
              >
                3. Mot de Passe ou Code PIN (Obligatoire) :
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-neutral-500'}`} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordOrPin}
                  onChange={(e) => {
                    setPasswordOrPin(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Entrez votre code PIN ou mot de passe"
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl font-mono text-base sm:text-sm tracking-widest transition-all ${
                    isLight
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                      : 'bg-neutral-900 border border-neutral-700 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 pr-3.5 flex items-center ${
                    isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-500 hover:text-white'
                  }`}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Obligatoire pour déverrouiller la caisse selon votre profil attribué.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-bold animate-pulse">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="submit"
                disabled={!accessCodeInput.trim() || !passwordOrPin.trim() || isSearchingCloud}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  accessCodeInput.trim() && passwordOrPin.trim() && !isSearchingCloud
                    ? isLight
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-extrabold shadow-[0_0_15px_rgba(0,242,254,0.4)]'
                    : 'bg-neutral-800 text-neutral-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <span>Valider & Ouvrir la Caisse</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className={`px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                  isLight
                    ? 'border-slate-200 text-rose-600 hover:bg-rose-50'
                    : 'border-neutral-800 text-rose-400 hover:bg-rose-950/20'
                }`}
                title="Déconnecter la session active"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div
          className={`p-3 sm:p-4 border-t flex items-center justify-between text-xs shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Sécurité renforcée · PIN obligatoire</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
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
