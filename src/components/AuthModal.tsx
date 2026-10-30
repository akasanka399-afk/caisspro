import React, { useState, useEffect } from 'react';
import { User, Business } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import {
  Store,
  Lock,
  Key,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck,
  X,
  LogOut,
  ShieldCheck,
  User as UserIcon,
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

  // Automatically check if the typed code matches a business to load staff list for that store
  useEffect(() => {
    if (!accessCodeInput.trim()) {
      setDetectedBusiness(null);
      setBusinessStaff([]);
      setSelectedUserId('');
      return;
    }

    const biz = store.getBusinessByAccessCode(accessCodeInput.trim());
    if (biz) {
      setDetectedBusiness(biz);
      const staff = store.getUsersByBusinessId(biz.id);
      setBusinessStaff(staff);
      // Auto-select cashier if available
      const defaultCashier = staff.find((u) => u.role === 'cashier') || staff[0];
      if (defaultCashier && !selectedUserId) {
        setSelectedUserId(defaultCashier.id);
      }
      setErrorMessage('');
    } else {
      setDetectedBusiness(null);
      setBusinessStaff([]);
      setSelectedUserId('');
    }
  }, [accessCodeInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!accessCodeInput.trim()) {
      playSoundEffect('error');
      setErrorMessage('Veuillez saisir le code d\'accès de votre commerce.');
      return;
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
      setErrorMessage(result.error || 'Identifiants incorrects. Veuillez vérifier auprès du propriétaire.');
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
    // Lock session
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
    manager: 'Gérante de Magasin',
    cashier: 'Caissière / Caissier',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border ${
          isLight
            ? 'retail-card bg-white border-slate-300'
            : 'neon-card bg-[#0a0e1e] border-neutral-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-400/10 text-amber-400'
              }`}
            >
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Authentification & Session Sécurisée
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                Session active :{' '}
                <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {currentUser.name}
                </span>{' '}
                ({roleLabels[currentUser.role]})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Security & Offline Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs leading-relaxed ${
              isLight
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <strong>Accès confidentiel & Hors-ligne :</strong> Saisissez le code de votre commerce et le mot de passe fourni par le propriétaire pour déverrouiller votre session de caisse.
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
              <div className="relative">
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
                  placeholder="Code de connexion fourni par le propriétaire (ex: CP-XXXX)"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl font-mono text-sm font-extrabold tracking-wider transition-all uppercase ${
                    isLight
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                      : 'bg-neutral-900 border border-neutral-700 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'
                  }`}
                  autoFocus
                  required
                />
              </div>

              {detectedBusiness && (
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Commerce identifié : {detectedBusiness.name}</span>
                </div>
              )}
            </div>

            {/* Step 2: Employee account selection if business detected */}
            {detectedBusiness && businessStaff.length > 0 && (
              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                    isLight ? 'text-slate-700' : 'text-neutral-300'
                  }`}
                >
                  2. Profil & Rôle à connecter :
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <UserIcon className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-neutral-500'}`} />
                  </div>
                  <select
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      setErrorMessage('');
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold transition-all appearance-none ${
                      isLight
                        ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                        : 'bg-neutral-900 border border-neutral-700 text-white focus:border-cyan-400'
                    }`}
                  >
                    {businessStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} — {roleLabels[staff.role] || staff.role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 3: Mandatory Password / PIN provided by owner */}
            <div>
              <label
                className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-neutral-300'
                }`}
              >
                {detectedBusiness ? '3' : '2'}. Mot de Passe ou Code PIN (Obligatoire) :
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
                  placeholder="Code PIN ou mot de passe défini par le propriétaire"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl font-mono text-sm tracking-widest transition-all ${
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
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 font-bold animate-pulse">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={!accessCodeInput.trim() || !passwordOrPin.trim()}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  accessCodeInput.trim() && passwordOrPin.trim()
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
                className={`px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
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
          className={`p-4 border-t flex items-center justify-between text-xs ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Sécurité renforcée · Mot de passe propriétaire obligatoire</span>
          </div>
          <button
            onClick={onClose}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
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
