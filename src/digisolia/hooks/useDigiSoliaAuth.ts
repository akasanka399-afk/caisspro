import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../firebase/config';
import {
  DigiSoliaAdministrator,
  DigiSoliaUserProfile,
} from '../types/digisolia.types';
import {
  ensureAppsRegistrySeeded,
  resolveAdminProfile,
  signInWithDigiSoliaGoogle,
  signOutDigiSolia,
  upsertAuthenticatedUserProfile,
} from '../services/digisoliaFirebase';
import { DIGISOLIA_CONFIG } from '../config/digisolia.config';
import { flushOfflineQueue } from '../services/offlineQueue';

export interface DigiSoliaAuthState {
  firebaseUser: FirebaseUser | null;
  cloudProfile: DigiSoliaUserProfile | null;
  adminProfile: DigiSoliaAdministrator | null;
  isAuthReady: boolean;
  isLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutCloud: () => Promise<void>;
  updateCloudProfile: (fields: { firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
  refreshAdminStatus: () => Promise<void>;
}

export function useDigiSoliaAuth(): DigiSoliaAuthState {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [cloudProfile, setCloudProfile] = useState<DigiSoliaUserProfile | null>(null);
  const [adminProfile, setAdminProfile] = useState<DigiSoliaAdministrator | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const hydrateUser = useCallback(async (user: FirebaseUser | null) => {
    if (!user) {
      setCloudProfile(null);
      setAdminProfile(null);
      setIsAuthReady(true);
      return;
    }

    try {
      const [profile, admin] = await Promise.all([
        upsertAuthenticatedUserProfile(user, DIGISOLIA_CONFIG.appId),
        resolveAdminProfile(user),
      ]);
      setCloudProfile(profile);
      setAdminProfile(admin);

      if (admin && (admin.role === 'super_admin' || admin.role === 'app_admin')) {
        await ensureAppsRegistrySeeded();
      }
      await flushOfflineQueue();
    } catch (err: any) {
      console.warn('[DigiSoliaAuth] Hydration notice:', err?.message || err);
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      hydrateUser(user);
    });
    return () => unsub();
  }, [hydrateUser]);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const user = await signInWithDigiSoliaGoogle();
      setFirebaseUser(user);
      await hydrateUser(user);
    } catch (err: any) {
      setAuthError(err?.message || 'Impossible de finaliser la connexion Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const signOutCloud = async () => {
    setIsLoading(true);
    try {
      await signOutDigiSolia();
      setFirebaseUser(null);
      setCloudProfile(null);
      setAdminProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCloudProfile = async (fields: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => {
    if (!firebaseUser) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      const updated = await upsertAuthenticatedUserProfile(
        firebaseUser,
        DIGISOLIA_CONFIG.appId,
        fields
      );
      setCloudProfile(updated);
    } catch (err: any) {
      setAuthError(err?.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAdminStatus = async () => {
    if (!firebaseUser) return;
    const admin = await resolveAdminProfile(firebaseUser);
    setAdminProfile(admin);
  };

  return {
    firebaseUser,
    cloudProfile,
    adminProfile,
    isAuthReady,
    isLoading,
    authError,
    signInWithGoogle,
    signOutCloud,
    updateCloudProfile,
    refreshAdminStatus,
  };
}
