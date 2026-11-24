import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Business } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import {
  Lock,
  Key,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  X,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Briefcase,
  Search,
  Loader2,
  RefreshCw,
  Store,
} from 'lucide-react';

interface AuthModalProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

type AuthStep = 'code' | 'role_pin';

function extractAccessCodeSuffix(rawCode: string): string {
  const compact = rawCode
    .trim()
    .toUpperCase()
    .replace(/[\s\u2010-\u2015\u2212\-_]+/g, '');
  if (!compact) return '';
  return compact.startsWith('CP') && compact.length > 2 ? compact.slice(2) : compact;
}

export const AuthModal: React.FC<AuthModalProps> = ({ currentUser, onSelectUser, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [authStep, setAuthStep] = useState<AuthStep>('code');
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

  const manualBackRef = useRef<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const sortStaffByRole = useCallback((staff: User[]): User[] => {
    const roleOrder: Record<string, number> = { owner: 1, manager: 2, cashier: 3, developer: 4 };
    return [...staff].sort((a, b) => (roleOrder[a.role] || 9) - (roleOrder[b.role] || 9));
  }, []);

  const syncMatchingBusinessFromLocal = useCallback(
    (rawCode: string) => {
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
        const sortedStaff = sortStaffByRole(store.getUsersByBusinessId(biz.id));
        setBusinessStaff(sortedStaff);

        setSelectedUserId((prevId) => {
          if (prevId && sortedStaff.some((u) => u.id === prevId)) {
            return prevId;
          }
          const defaultStaff =
            sortedStaff.find((u) => u.role === 'owner') ||
            sortedStaff.find((u) => u.role === 'cashier') ||
            sortedStaff[0];
          return defaultStaff ? defaultStaff.id : '';
        });
        return { biz, staff: sortedStaff };
      }

      setDetectedBusiness(null);
      setBusinessStaff([]);
      setSelectedUserId('');
      return null;
    },
    [sortStaffByRole]
  );

  // Re-evaluate immediately when accessCodeInput changes or when store receives Firestore updates
  useEffect(() => {
    syncMatchingBusinessFromLocal(accessCodeInput);
    const unsub = store.subscribe(() => {
      syncMatchingBusinessFromLocal(accessCodeInput);
    });
    return () => unsub();
  }, [accessCodeInput, syncMatchingBusinessFromLocal]);

  // Direct Firestore Cloud lookup when code looks complete so mobile devices find remote businesses immediately
  const triggerCloudLookup = useCallback(
    async (rawCode: string) => {
      const suffix = extractAccessCodeSuffix(rawCode);
      if (suffix.length < 3 && rawCode.trim().length < 4) return null;

      const lookupKey = rawCode.trim().toUpperCase();
      setIsSearchingCloud(true);
      try {
        const res = await store.fetchBusinessAndStaffByAccessCode(rawCode.trim());
        setCloudLookupDoneFor(lookupKey);
        const localMatch = syncMatchingBusinessFromLocal(rawCode);
        if (res.error && !res.business && !localMatch?.biz) {
          setErrorMessage(res.error);
        }
        return localMatch || (res.business ? { biz: res.business, staff: sortStaffByRole(res.staff) } : null);
      } finally {
        setIsSearchingCloud(false);
      }
    },
    [sortStaffByRole, syncMatchingBusinessFromLocal]
  );

  useEffect(() => {
    const trimmed = accessCodeInput.trim();
    const suffix = extractAccessCodeSuffix(trimmed);
    if (suffix.length < 4 && trimmed.length < 4) {
      setCloudLookupDoneFor('');
      return;
    }

    const localMatch = syncMatchingBusinessFromLocal(trimmed);
    if (localMatch && localMatch.staff.length > 0) {
      return;
    }

    const timer = setTimeout(() => {
      triggerCloudLookup(trimmed);
    }, 320);
    return () => clearTimeout(timer);
  }, [accessCodeInput, syncMatchingBusinessFromLocal, triggerCloudLookup]);

  const moveToRoleStep = useCallback(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setErrorMessage('');
    setAuthStep('role_pin');
    requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  // Automatically reveal the Role Selection view on mobile & desktop as soon as a valid full code is matched
  useEffect(() => {
    if (authStep !== 'code') return;
    if (manualBackRef.current) return;
    if (!detectedBusiness || detectedBusiness.subscriptionStatus === 'suspended') return;
    if (businessStaff.length === 0) return;

    const suffix = extractAccessCodeSuffix(accessCodeInput);
    if (suffix.length < 4) return;

    const timer = setTimeout(() => {
      moveToRoleStep();
    }, 380);
    return () => clearTimeout(timer);
  }, [authStep, detectedBusiness, businessStaff.length, accessCodeInput, moveToRoleStep]);

  const handleVerifyCodeStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    manualBackRef.current = false;

    const trimmed = accessCodeInput.trim();
    if (!trimmed) {
      playSoundEffect('error');
      setErrorMessage("Veuillez saisir le code d'accès de votre commerce.");
      return;
    }

    let match = syncMatchingBusinessFromLocal(trimmed);
    if (!match || match.staff.length === 0) {
      match = await triggerCloudLookup(trimmed);
    }

    if (!match || !match.biz) {
      playSoundEffect('error');
      setErrorMessage("Aucun commerce trouvé avec ce code. Vérifiez le code fourni (ex: CP-8842).");
      return;
    }

    if (match.biz.subscriptionStatus === 'suspended') {
      playSoundEffect('error');
      setErrorMessage(
        `La session pour le commerce "${match.biz.name}" est suspendue. Contactez le propriétaire.`
      );
      return;
    }

    playSoundEffect('beep');
    moveToRoleStep();
  };

  const handleBackToCodeStep = () => {
    manualBackRef.current = true;
    playSoundEffect('beep');
    setErrorMessage('');
    setSuccessMessage('');
    setPasswordOrPin('');
    setAuthStep('code');
    requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleSelectRoleCard = (staff: User) => {
    setSelectedUserId(staff.id);
    setErrorMessage('');
    playSoundEffect('beep');
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 60);
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const codeToUse = detectedBusiness?.accessCode || accessCodeInput.trim();
    if (!codeToUse) {
      setAuthStep('code');
      playSoundEffect('error');
      setErrorMessage("Veuillez saisir le code d'accès de votre commerce.");
      return;
    }

    if (!passwordOrPin.trim()) {
      playSoundEffect('error');
      setErrorMessage('Le mot de passe ou code PIN est obligatoire.');
      pinInputRef.current?.focus();
      return;
    }

    const result = store.loginWithBusinessCodeAndPassword({
      accessCode: codeToUse,
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
    setSuccessMessage(`Session ouverte pour ${result.user.name} (${bizName}) !`);

    setTimeout(() => {
      onSelectUser(result.user!);
      onClose();
    }, 700);
  };

  const handleDisconnect = () => {
    manualBackRef.current = false;
    playSoundEffect('beep');
    setAccessCodeInput('');
    setSelectedUserId('');
    setPasswordOrPin('');
    setDetectedBusiness(null);
    setBusinessStaff([]);
    setCloudLookupDoneFor('');
    setErrorMessage('');
    setAuthStep('code');
    setSuccessMessage('Session réinitialisée. Saisissez un code commerce pour vous connecter.');
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

  const selectedStaffMember = businessStaff.find((u) => u.id === selectedUserId) || null;
  const codeSuffixLength = extractAccessCodeSuffix(accessCodeInput).length;
  const isCodeLookupNotFound =
    !isSearchingCloud &&
    !detectedBusiness &&
    cloudLookupDoneFor === accessCodeInput.trim().toUpperCase() &&
    (codeSuffixLength >= 4 || accessCodeInput.trim().length >= 4);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs overflow-y-auto flex items-start sm:items-center justify-center p-2.5 sm:p-4">
      <div
        className={`rounded-2xl max-w-lg w-full shadow-2xl border my-1 sm:my-auto flex flex-col max-h-[94dvh] ${
          isLight
            ? 'retail-card bg-white border-slate-300'
            : 'neon-card bg-[#0a0e1e] border-neutral-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-400/10 text-amber-400'
              }`}
            >
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm sm:text-base font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Connexion & Choix du Profil
              </h3>
              <p className={`text-[11px] sm:text-xs truncate ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Actif :{' '}
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
            aria-label="Fermer"
            className={`p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer ${
              isLight
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Strip */}
        <div
          className={`px-4 sm:px-6 py-2 border-b flex items-center justify-between gap-2 text-[11px] font-bold shrink-0 ${
            isLight ? 'bg-slate-50/70 border-slate-200 text-slate-600' : 'bg-neutral-950/60 border-neutral-800 text-neutral-400'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 ${
              authStep === 'code'
                ? isLight
                  ? 'text-amber-700'
                  : 'text-cyan-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                authStep === 'code'
                  ? isLight
                    ? 'bg-amber-600 text-white'
                    : 'bg-cyan-400 text-neutral-950'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {authStep === 'role_pin' ? '✓' : '1'}
            </span>
            <span>Code Commerce</span>
          </div>

          <div className={`flex-1 h-0.5 rounded-full ${isLight ? 'bg-slate-200' : 'bg-neutral-800'}`} />

          <div
            className={`flex items-center gap-1.5 ${
              authStep === 'role_pin'
                ? isLight
                  ? 'text-amber-700'
                  : 'text-cyan-400'
                : isLight
                ? 'text-slate-400'
                : 'text-neutral-500'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                authStep === 'role_pin'
                  ? isLight
                    ? 'bg-amber-600 text-white'
                    : 'bg-cyan-400 text-neutral-950'
                  : isLight
                  ? 'bg-slate-200 text-slate-500'
                  : 'bg-neutral-800 text-neutral-500'
              }`}
            >
              2
            </span>
            <span>Propriétaire / Caissier & PIN</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={contentRef} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {authStep === 'code' ? (
            <form onSubmit={handleVerifyCodeStep} className="space-y-4">
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                  isLight
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Entrez le code du commerce pour afficher le choix <strong>Propriétaire</strong> ou{' '}
                  <strong>Caissier</strong>.
                </span>
              </div>

              <div>
                <label
                  htmlFor="kassapro-access-code"
                  className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                    isLight ? 'text-slate-700' : 'text-neutral-300'
                  }`}
                >
                  Code Connexion du Commerce :
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Key className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-neutral-500'}`} />
                    </div>
                    <input
                      id="kassapro-access-code"
                      type="text"
                      value={accessCodeInput}
                      onChange={(e) => {
                        manualBackRef.current = false;
                        setAccessCodeInput(e.target.value.toUpperCase());
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      placeholder="Ex: CP-8842 ou 8842"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      className={`w-full pl-10 pr-3 py-3 rounded-xl font-mono text-base font-extrabold tracking-wider transition-all uppercase ${
                        isLight
                          ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                          : 'bg-neutral-900 border border-neutral-700 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'
                      }`}
                      required
                    />
                  </div>
                  {(codeSuffixLength >= 3 || accessCodeInput.trim().length >= 4) && !detectedBusiness && (
                    <button
                      type="button"
                      onClick={() => {
                        manualBackRef.current = false;
                        triggerCloudLookup(accessCodeInput);
                      }}
                      disabled={isSearchingCloud}
                      className={`px-3 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border shrink-0 cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
                      }`}
                      title="Rechercher sur le serveur Cloud"
                    >
                      {isSearchingCloud ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span className="hidden xs:inline">Chercher</span>
                    </button>
                  )}
                </div>

                {isSearchingCloud && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Vérification du commerce sur le serveur Cloud...</span>
                  </div>
                )}

                {detectedBusiness && (
                  <div
                    className={`mt-2.5 p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      detectedBusiness.subscriptionStatus === 'suspended'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                        : isLight
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {detectedBusiness.name} · {businessStaff.length} profil(s)
                      </span>
                    </div>
                  </div>
                )}

                {isCodeLookupNotFound && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Aucun commerce trouvé avec ce code. Vérifiez le code (ex: CP-8842).</span>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="submit"
                  disabled={!accessCodeInput.trim() || isSearchingCloud}
                  className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm sm:text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    accessCodeInput.trim() && !isSearchingCloud
                      ? isLight
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md'
                        : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-extrabold shadow-[0_0_15px_rgba(0,242,254,0.4)]'
                      : 'bg-neutral-800 text-neutral-500 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {isSearchingCloud ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Vérification...</span>
                    </>
                  ) : (
                    <>
                      <span>Continuer — Choisir Profil</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className={`px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border cursor-pointer ${
                    isLight
                      ? 'border-slate-200 text-rose-600 hover:bg-rose-50'
                      : 'border-neutral-800 text-rose-400 hover:bg-rose-950/20'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Réinitialiser</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitLogin} className="space-y-4">
              {/* Selected Commerce Summary Banner with Change Button */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                  isLight
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isLight ? 'bg-emerald-600 text-white' : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">
                      {detectedBusiness?.name || 'Commerce sélectionné'}
                    </div>
                    <div className="text-[11px] font-mono opacity-80">
                      Code : {detectedBusiness?.accessCode || accessCodeInput.trim().toUpperCase()}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBackToCodeStep}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border shrink-0 cursor-pointer transition-colors ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Changer</span>
                </button>
              </div>

              {/* Role Selection: Propriétaire / Gérant / Caissier */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-700' : 'text-neutral-300'
                    }`}
                  >
                    Choisissez votre Profil :
                  </label>
                  <button
                    type="button"
                    onClick={() => triggerCloudLookup(detectedBusiness?.accessCode || accessCodeInput)}
                    disabled={isSearchingCloud}
                    className={`text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                      isLight ? 'text-amber-700 hover:underline' : 'text-cyan-400 hover:underline'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isSearchingCloud ? 'animate-spin' : ''}`} />
                    <span>Actualiser</span>
                  </button>
                </div>

                {businessStaff.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {businessStaff.map((staff) => {
                      const isSelected = selectedUserId === staff.id;
                      const isOwner = staff.role === 'owner';
                      const isManager = staff.role === 'manager';
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => handleSelectRoleCard(staff)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 min-h-[60px] ${
                            isSelected
                              ? isLight
                                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/25 text-slate-900 shadow-xs'
                                : 'bg-cyan-950/50 border-cyan-400 ring-2 ring-cyan-400/30 text-white'
                              : isLight
                              ? 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isOwner
                                ? isSelected
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : isManager
                                ? isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
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
                            <div className="text-xs font-extrabold uppercase tracking-wide">
                              {shortRoleBadge[staff.role] || staff.role}
                            </div>
                            <div className="text-xs font-medium truncate opacity-90">{staff.name}</div>
                          </div>
                          {isSelected && (
                            <CheckCircle2
                              className={`w-5 h-5 shrink-0 ${
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
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                      isLight
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <p>Aucun compte Propriétaire ou Caissier actif trouvé pour ce commerce.</p>
                    <button
                      type="button"
                      onClick={() => triggerCloudLookup(detectedBusiness?.accessCode || accessCodeInput)}
                      disabled={isSearchingCloud}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSearchingCloud ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Charger les profils depuis le Cloud</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Password / PIN Input */}
              <div>
                <label
                  htmlFor="kassapro-pin-input"
                  className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                    isLight ? 'text-slate-700' : 'text-neutral-300'
                  }`}
                >
                  Mot de Passe ou Code PIN
                  {selectedStaffMember
                    ? ` — ${shortRoleBadge[selectedStaffMember.role] || selectedStaffMember.role}`
                    : ''}
                  {' :'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-neutral-500'}`} />
                  </div>
                  <input
                    id="kassapro-pin-input"
                    ref={pinInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={passwordOrPin}
                    onChange={(e) => {
                      setPasswordOrPin(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Entrez votre code PIN ou mot de passe"
                    autoComplete="current-password"
                    enterKeyHint="done"
                    className={`w-full pl-10 pr-11 py-3 rounded-xl font-mono text-base tracking-widest transition-all ${
                      isLight
                        ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                        : 'bg-neutral-900 border border-neutral-700 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le code PIN' : 'Afficher le code PIN'}
                    className={`absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer ${
                      isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-500 hover:text-white'
                    }`}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                  Saisissez le code PIN attribué au profil sélectionné pour ouvrir la session.
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
                  disabled={!passwordOrPin.trim() || businessStaff.length === 0 || isSearchingCloud}
                  className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm sm:text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    passwordOrPin.trim() && businessStaff.length > 0 && !isSearchingCloud
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
                  className={`px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border cursor-pointer ${
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
          )}
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
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
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
