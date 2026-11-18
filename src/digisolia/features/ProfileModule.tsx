import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  LogOut,
  LogIn,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { User, Business } from '../../types';
import { useDigiSoliaAuth } from '../hooks/useDigiSoliaAuth';
import { ADMIN_ROLE_LABELS, DIGISOLIA_CONFIG } from '../config/digisolia.config';
import { formatFrenchDateTime, sanitizeText } from '../utils/validation';

interface ProfileModuleProps {
  currentUser: User;
  currentBusiness: Business;
  onOpenLocalAuthModal: () => void;
}

export const ProfileModule: React.FC<ProfileModuleProps> = ({
  currentUser,
  currentBusiness,
  onOpenLocalAuthModal,
}) => {
  const {
    firebaseUser,
    cloudProfile,
    adminProfile,
    isLoading,
    authError,
    signInWithGoogle,
    signOutCloud,
    updateCloudProfile,
  } = useDigiSoliaAuth();

  const defaultNames = (cloudProfile?.name || currentUser.name || '').split(' ');
  const [firstName, setFirstName] = useState<string>(cloudProfile?.firstName || defaultNames[0] || '');
  const [lastName, setLastName] = useState<string>(
    cloudProfile?.lastName || defaultNames.slice(1).join(' ') || ''
  );
  const [phone, setPhone] = useState<string>(cloudProfile?.phone || currentUser.phone || '');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cloudProfile) {
      setFirstName(cloudProfile.firstName || '');
      setLastName(cloudProfile.lastName || '');
      setPhone(cloudProfile.phone || '');
    }
  }, [cloudProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveNotice(null);
    if (!firebaseUser) return;

    await updateCloudProfile({
      firstName: sanitizeText(firstName, 60),
      lastName: sanitizeText(lastName, 60),
      phone: sanitizeText(phone, 30),
    });
    setSaveNotice('Vos informations personnelles ont été enregistrées sur votre profil DigiSolia.');
  };

  const roleLabels: Record<string, string> = {
    developer: 'Développeur',
    owner: 'Propriétaire',
    manager: 'Gérant(e)',
    cashier: 'Caissier(ère)',
  };

  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#163B65] text-white font-extrabold text-xl flex items-center justify-center shrink-0">
              {(cloudProfile?.firstName || currentUser.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="space-y-0.5">
              <h1 className="text-xl font-extrabold text-[#163B65] dark:text-white">
                {cloudProfile?.name || currentUser.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {roleLabels[currentUser.role] || currentUser.role} · {currentBusiness.name}
              </p>
            </div>
          </div>
        </div>

        {/* Informations personnelles & Compte Cloud Firebase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Informations personnelles
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Données associées à votre compte utilisateur DigiSolia.
              </p>
            </div>

            {firebaseUser ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Prénom
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nom
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Adresse e-mail
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800/70 border border-[#E1E7EF] dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{firebaseUser.email}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Téléphone (facultatif)
                  </label>
                  <input
                    type="tel"
                    maxLength={30}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+226 ..."
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Créé le : {formatFrenchDateTime(cloudProfile?.createdAt || currentUser.createdAt)}
                  </span>
                </div>

                {saveNotice && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{saveNotice}</span>
                  </div>
                )}

                {authError && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isLoading ? 'Enregistrement...' : 'Mettre à jour le profil'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <dl className="divide-y divide-[#E1E7EF] dark:divide-slate-800 text-sm">
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <UserIcon className="w-4 h-4" /> Nom complet
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{currentUser.name}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Adresse e-mail
                    </dt>
                    <dd className="font-medium text-slate-800 dark:text-slate-200">{currentUser.email || '—'}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Téléphone
                    </dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                      {currentUser.phone || 'Non renseigné'}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Compte créé le
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatFrenchDateTime(currentUser.createdAt)}
                    </dd>
                  </div>
                </dl>

                <div className="p-4 rounded-xl bg-[#F4F7FB] dark:bg-slate-800/60 border border-[#E1E7EF] dark:border-slate-700 space-y-3">
                  <div className="text-xs font-bold text-[#163B65] dark:text-white">
                    Compte Cloud DigiSolia (Firebase Auth)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Connectez votre compte Google pour synchroniser votre profil personnel et suivre vos avis et demandes d&apos;assistance.
                  </p>
                  <button
                    type="button"
                    onClick={() => signInWithGoogle()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#2783C7] hover:bg-[#1e6aa3] transition-colors cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Se connecter avec Google</span>
                  </button>
                  {authError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Gestion de session & Déconnexion */}
          <div className="lg:col-span-5 space-y-4">
            <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Gestion de session
              </h2>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Session métier</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {currentUser.name}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Établissement</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                    {currentBusiness.name}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Application</span>
                  <span className="font-mono text-[#2783C7]">{DIGISOLIA_CONFIG.appId}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Session Cloud</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {firebaseUser ? 'Connectée (Google)' : 'Locale uniquement'}
                  </span>
                </div>
                {adminProfile && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Rôle DigiSolia Admin</span>
                    <span className="font-bold text-[#2783C7]">
                      {ADMIN_ROLE_LABELS[adminProfile.role]}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-[#E1E7EF] dark:border-slate-800">
                <button
                  type="button"
                  onClick={onOpenLocalAuthModal}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-[#163B65] dark:text-slate-200 bg-[#F4F7FB] dark:bg-slate-800 hover:bg-[#E1E7EF] dark:hover:bg-slate-700 border border-[#E1E7EF] dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Changer d&apos;utilisateur / PIN métier</span>
                </button>

                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() => signOutCloud()}
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Déconnexion du compte Cloud</span>
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
