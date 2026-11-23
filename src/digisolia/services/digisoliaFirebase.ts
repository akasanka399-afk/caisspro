import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { db, auth, testConnection } from '../../firebase/config';
import {
  DigiSoliaAdministrator,
  DigiSoliaAdminRole,
  DigiSoliaAppRegistryItem,
  DigiSoliaAuditLog,
  DigiSoliaFeedbackItem,
  DigiSoliaSupportTicket,
  DigiSoliaUserProfile,
  WorkflowStatus,
} from '../types/digisolia.types';
import { DIGISOLIA_APPS_CATALOG, DIGISOLIA_CONFIG } from '../config/digisolia.config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && !k.startsWith('_')) {
      clean[k] = v;
    }
  });
  return clean;
}

export async function signInWithDigiSoliaGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutDigiSolia(): Promise<void> {
  await signOut(auth);
}

export async function verifyFirestoreConnection(): Promise<boolean> {
  return testConnection();
}

/**
 * Synchronise le profil de l'utilisateur connecté dans /users/{uid}
 */
export async function upsertAuthenticatedUserProfile(
  fbUser: FirebaseUser,
  appId: string,
  extra?: { firstName?: string; lastName?: string; phone?: string }
): Promise<DigiSoliaUserProfile> {
  const path = `users/${fbUser.uid}`;
  const docRef = doc(db, 'users', fbUser.uid);
  const nowIso = new Date().toISOString();

  const displayParts = (fbUser.displayName || 'Utilisateur DigiSolia').split(' ');
  const defaultFirst = extra?.firstName || displayParts[0] || 'Utilisateur';
  const defaultLast = extra?.lastName || displayParts.slice(1).join(' ') || 'DigiSolia';

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const updatedFields: Record<string, any> = {
        name: `${extra?.firstName ?? existingData.firstName ?? defaultFirst} ${extra?.lastName ?? existingData.lastName ?? defaultLast}`.trim(),
        firstName: extra?.firstName ?? existingData.firstName ?? defaultFirst,
        lastName: extra?.lastName ?? existingData.lastName ?? defaultLast,
        email: fbUser.email || existingData.email || '',
        phone: extra?.phone !== undefined ? extra.phone : existingData.phone || '',
        appId: existingData.appId || appId,
        lastLogin: nowIso,
      };
      await updateDoc(docRef, updatedFields);
      return {
        id: fbUser.uid,
        uid: fbUser.uid,
        firstName: updatedFields.firstName,
        lastName: updatedFields.lastName,
        name: updatedFields.name,
        email: updatedFields.email,
        phone: updatedFields.phone,
        appId: updatedFields.appId,
        role: existingData.role || 'user',
        status: existingData.status || 'active',
        createdAt: existingData.createdAt || nowIso,
        lastLogin: nowIso,
      };
    }

    const newProfile: DigiSoliaUserProfile = {
      id: fbUser.uid,
      uid: fbUser.uid,
      firstName: defaultFirst,
      lastName: defaultLast,
      name: `${defaultFirst} ${defaultLast}`.trim(),
      email: fbUser.email || '',
      phone: extra?.phone || '',
      appId,
      role: 'user',
      status: 'active',
      createdAt: nowIso,
      lastLogin: nowIso,
    };
    await setDoc(docRef, stripUndefined(newProfile));
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Vérifie côté Firestore le rôle administrateur de l'utilisateur connecté
 */
export async function resolveAdminProfile(
  fbUser: FirebaseUser | null
): Promise<DigiSoliaAdministrator | null> {
  if (!fbUser || !fbUser.emailVerified) return null;

  const isBootstrapped =
    fbUser.email?.toLowerCase() === DIGISOLIA_CONFIG.bootstrappedSuperAdminEmail.toLowerCase();

  const path = `administrators/${fbUser.uid}`;
  try {
    const snap = await getDoc(doc(db, 'administrators', fbUser.uid));
    if (snap.exists()) {
      const data = snap.data() as DigiSoliaAdministrator;
      if (data.status === 'active') {
        return data;
      }
    }
  } catch (error) {
    // Si non-admin, l'accès get sur un autre doc est refusé, mais sur son propre UID il est autorisé
    if (!isBootstrapped) {
      return null;
    }
    console.warn('[DigiSoliaAdmin] Admin lookup notice:', error);
  }

  if (isBootstrapped) {
    const nowIso = new Date().toISOString();
    const bootstrapAdmin: DigiSoliaAdministrator = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: fbUser.email || DIGISOLIA_CONFIG.bootstrappedSuperAdminEmail,
      name: fbUser.displayName || 'Super Administrateur DigiSolia',
      role: 'super_admin',
      assignedApps: DIGISOLIA_APPS_CATALOG.map((a) => a.appId),
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    try {
      await setDoc(doc(db, 'administrators', fbUser.uid), stripUndefined(bootstrapAdmin), { merge: true });
    } catch {
      // Déjà autorisé par règle isBootstrappedSuperAdmin()
    }
    return bootstrapAdmin;
  }

  return null;
}

/**
 * Initialise le catalogue des applications dans /apps si nécessaire (Admin uniquement)
 */
export async function ensureAppsRegistrySeeded(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'apps'));
    const existingIds = new Set(snap.docs.map((d) => d.id));
    for (const appItem of DIGISOLIA_APPS_CATALOG) {
      if (!existingIds.has(appItem.appId)) {
        const clean = stripUndefined({
          id: appItem.id,
          appId: appItem.appId,
          name: appItem.name,
          shortDescription: appItem.shortDescription,
          category: appItem.category,
          version: appItem.version,
          status: appItem.status,
          usersCount: appItem.usersCount,
          primaryColor: appItem.primaryColor,
          secondaryColor: appItem.secondaryColor,
          supportWhatsapp: appItem.supportWhatsapp,
          supportPhone: appItem.supportPhone,
          supportEmail: appItem.supportEmail,
          updatedAt: appItem.updatedAt,
        });
        await setDoc(doc(db, 'apps', appItem.appId), clean, { merge: true });
      }
    }
  } catch (error) {
    // Non-admin users may not have write permissions to /apps
    console.warn('[DigiSolia] Apps seed notice:', error);
  }
}

export async function fetchAppsRegistry(): Promise<DigiSoliaAppRegistryItem[]> {
  const path = 'apps';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return [...DIGISOLIA_APPS_CATALOG];
    }
    return snap.docs.map((d) => d.data() as DigiSoliaAppRegistryItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveAppRegistryItem(appItem: DigiSoliaAppRegistryItem): Promise<void> {
  const path = `apps/${appItem.appId}`;
  try {
    const clean = stripUndefined({
      id: appItem.appId,
      appId: appItem.appId,
      name: appItem.name,
      shortDescription: appItem.shortDescription,
      category: appItem.category,
      version: appItem.version,
      status: appItem.status,
      usersCount: Number(appItem.usersCount) || 0,
      primaryColor: appItem.primaryColor,
      secondaryColor: appItem.secondaryColor,
      supportWhatsapp: appItem.supportWhatsapp,
      supportPhone: appItem.supportPhone,
      supportEmail: appItem.supportEmail,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'apps', appItem.appId), clean, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Feedback CRUD: apps/{appId}/feedback
 */
export async function submitFeedbackToFirestore(item: DigiSoliaFeedbackItem): Promise<void> {
  const path = `apps/${item.appId}/feedback/${item.id}`;
  try {
    const clean = stripUndefined({
      id: item.id,
      appId: item.appId,
      authorUid: item.authorUid,
      userId: item.userId,
      userName: item.userName,
      userEmail: item.userEmail,
      category: item.category,
      rating: item.rating,
      message: item.message,
      status: 'pending',
      createdAt: item.createdAt,
    });
    await setDoc(doc(db, 'apps', item.appId, 'feedback', item.id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserFeedback(appId: string, uid: string): Promise<DigiSoliaFeedbackItem[]> {
  const path = `apps/${appId}/feedback`;
  try {
    const q = query(
      collection(db, 'apps', appId, 'feedback'),
      where('authorUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as DigiSoliaFeedbackItem)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllFeedbackForApp(appId: string): Promise<DigiSoliaFeedbackItem[]> {
  const path = `apps/${appId}/feedback`;
  try {
    const snap = await getDocs(collection(db, 'apps', appId, 'feedback'));
    return snap.docs
      .map((d) => d.data() as DigiSoliaFeedbackItem)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateFeedbackStatusInFirestore(params: {
  appId: string;
  feedbackId: string;
  status: WorkflowStatus;
  adminResponse?: string;
  handledBy: string;
}): Promise<void> {
  const path = `apps/${params.appId}/feedback/${params.feedbackId}`;
  try {
    const updates: Record<string, any> = {
      status: params.status,
      handledBy: params.handledBy,
      handledAt: new Date().toISOString(),
    };
    if (params.adminResponse !== undefined) {
      updates.adminResponse = params.adminResponse;
    }
    await updateDoc(doc(db, 'apps', params.appId, 'feedback', params.feedbackId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Support Tickets CRUD: apps/{appId}/support
 */
export async function submitSupportTicketToFirestore(ticket: DigiSoliaSupportTicket): Promise<void> {
  const path = `apps/${ticket.appId}/support/${ticket.id}`;
  try {
    const clean = stripUndefined({
      id: ticket.id,
      appId: ticket.appId,
      authorUid: ticket.authorUid,
      userId: ticket.userId,
      userName: ticket.userName,
      userEmail: ticket.userEmail,
      userPhone: ticket.userPhone,
      topic: ticket.topic,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description,
      appVersion: ticket.appVersion,
      status: 'pending',
      createdAt: ticket.createdAt,
    });
    await setDoc(doc(db, 'apps', ticket.appId, 'support', ticket.id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserSupportTickets(
  appId: string,
  uid: string
): Promise<DigiSoliaSupportTicket[]> {
  const path = `apps/${appId}/support`;
  try {
    const q = query(
      collection(db, 'apps', appId, 'support'),
      where('authorUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as DigiSoliaSupportTicket)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllSupportForApp(appId: string): Promise<DigiSoliaSupportTicket[]> {
  const path = `apps/${appId}/support`;
  try {
    const snap = await getDocs(collection(db, 'apps', appId, 'support'));
    return snap.docs
      .map((d) => d.data() as DigiSoliaSupportTicket)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateSupportTicketInFirestore(params: {
  appId: string;
  ticketId: string;
  status: WorkflowStatus;
  adminResponse?: string;
  handledBy: string;
}): Promise<void> {
  const path = `apps/${params.appId}/support/${params.ticketId}`;
  try {
    const updates: Record<string, any> = {
      status: params.status,
      handledBy: params.handledBy,
      handledAt: new Date().toISOString(),
    };
    if (params.adminResponse !== undefined) {
      updates.adminResponse = params.adminResponse;
    }
    await updateDoc(doc(db, 'apps', params.appId, 'support', params.ticketId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Administration: Gestion des administrateurs, utilisateurs et journal d'audit
 */
export async function fetchAllUsersForAdmin(): Promise<DigiSoliaUserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        uid: data.uid,
        firstName: data.firstName || (data.name || '').split(' ')[0] || 'Utilisateur',
        lastName: data.lastName || (data.name || '').split(' ').slice(1).join(' ') || '',
        name: data.name || 'Utilisateur',
        email: data.email || '—',
        phone: data.phone || '',
        appId: data.appId || 'digisolia-pos',
        role: data.role || 'user',
        status: data.status || 'active',
        createdAt: data.createdAt || '',
        lastLogin: data.lastLogin || '',
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAdministrators(): Promise<DigiSoliaAdministrator[]> {
  const path = 'administrators';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data() as DigiSoliaAdministrator);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveAdministrator(admin: DigiSoliaAdministrator): Promise<void> {
  const path = `administrators/${admin.id}`;
  try {
    await setDoc(doc(db, 'administrators', admin.id), stripUndefined(admin), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAdministrator(adminId: string): Promise<void> {
  const path = `administrators/${adminId}`;
  try {
    await deleteDoc(doc(db, 'administrators', adminId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordAdminAuditLog(params: {
  actorUid: string;
  actorEmail: string;
  actorRole: DigiSoliaAdminRole | string;
  action: string;
  targetPath: string;
  details: string;
}): Promise<void> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `admin_audit_logs/${id}`;
  try {
    const log: DigiSoliaAuditLog = {
      id,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail.slice(0, 120),
      actorRole: String(params.actorRole).slice(0, 40),
      action: params.action.slice(0, 100),
      targetPath: params.targetPath.slice(0, 200),
      details: params.details.slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'admin_audit_logs', id), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchAdminAuditLogs(): Promise<DigiSoliaAuditLog[]> {
  const path = 'admin_audit_logs';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs
      .map((d) => d.data() as DigiSoliaAuditLog)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 80);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function sendFrameworkNotification(params: {
  appId: string;
  targetRole: 'all' | 'owner' | 'manager' | 'cashier';
  title: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
}): Promise<void> {
  const id = `notif_daf_${Date.now()}`;
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      appId: params.appId,
      targetRole: params.targetRole,
      title: params.title.slice(0, 150),
      message: params.message.slice(0, 500),
      type: 'digisolia_announcement',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      read: false,
      priority: params.priority,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToAppFeedback(
  appId: string,
  uid: string | null,
  onData: (items: DigiSoliaFeedbackItem[]) => void
): () => void {
  if (!uid) return () => {};
  const path = `apps/${appId}/feedback`;
  const q = query(collection(db, 'apps', appId, 'feedback'), where('authorUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as DigiSoliaFeedbackItem)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
