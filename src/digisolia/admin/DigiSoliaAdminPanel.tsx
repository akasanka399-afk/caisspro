import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  LayoutGrid,
  Layers,
  Users,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Headphones,
  BarChart3,
  UserCog,
  KeyRound,
  Bell,
  RefreshCw,
  LogIn,
  Lock,
  Plus,
  Send,
  Star,
  CheckCircle2,
  AlertCircle,
  Trash2,
  History,
} from 'lucide-react';
import {
  ADMIN_ROLE_LABELS,
  ADMIN_ROLE_PERMISSIONS,
  DIGISOLIA_APPS_CATALOG,
  DIGISOLIA_CONFIG,
  FEEDBACK_CATEGORY_LABELS,
  SUPPORT_TOPIC_LABELS,
  WORKFLOW_STATUS_LABELS,
} from '../config/digisolia.config';
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
import {
  fetchAdminAuditLogs,
  fetchAdministrators,
  fetchAllFeedbackForApp,
  fetchAllSupportForApp,
  fetchAllUsersForAdmin,
  fetchAppsRegistry,
  recordAdminAuditLog,
  removeAdministrator,
  saveAdministrator,
  saveAppRegistryItem,
  sendFrameworkNotification,
  updateFeedbackStatusInFirestore,
  updateSupportTicketInFirestore,
} from '../services/digisoliaFirebase';
import { useDigiSoliaAuth } from '../hooks/useDigiSoliaAuth';
import { formatFrenchDateTime, sanitizeText } from '../utils/validation';

type AdminTab =
  | 'overview'
  | 'apps'
  | 'users'
  | 'feedback'
  | 'suggestions'
  | 'complaints'
  | 'support'
  | 'satisfaction'
  | 'admins'
  | 'roles'
  | 'notifications'
  | 'audit';

interface DigiSoliaAdminPanelProps {
  embedded?: boolean;
}

export const DigiSoliaAdminPanel: React.FC<DigiSoliaAdminPanelProps> = ({ embedded = false }) => {
  const { firebaseUser, adminProfile, isAuthReady, isLoading, authError, signInWithGoogle } =
    useDigiSoliaAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [apps, setApps] = useState<DigiSoliaAppRegistryItem[]>(DIGISOLIA_APPS_CATALOG);
  const [users, setUsers] = useState<DigiSoliaUserProfile[]>([]);
  const [feedbackList, setFeedbackList] = useState<DigiSoliaFeedbackItem[]>([]);
  const [supportList, setSupportList] = useState<DigiSoliaSupportTicket[]>([]);
  const [admins, setAdmins] = useState<DigiSoliaAdministrator[]>([]);
  const [auditLogs, setAuditLogs] = useState<DigiSoliaAuditLog[]>([]);

  const [filterAppId, setFilterAppId] = useState<string>('all');
  const [userSearch, setUserSearch] = useState<string>('');

  // Modal réponse feedback/support
  const [editingFeedback, setEditingFeedback] = useState<DigiSoliaFeedbackItem | null>(null);
  const [fbStatus, setFbStatus] = useState<WorkflowStatus>('in_progress');
  const [fbResponse, setFbResponse] = useState<string>('');

  const [editingTicket, setEditingTicket] = useState<DigiSoliaSupportTicket | null>(null);
  const [tkStatus, setTkStatus] = useState<WorkflowStatus>('in_progress');
  const [tkResponse, setTkResponse] = useState<string>('');

  // Formulaire nouvelle app
  const [newAppId, setNewAppId] = useState<string>('');
  const [newAppName, setNewAppName] = useState<string>('');
  const [newAppCategory, setNewAppCategory] = useState<string>('Services Numériques');
  const [newAppVersion, setNewAppVersion] = useState<string>('1.0.0');
  const [newAppDesc, setNewAppDesc] = useState<string>('');

  // Formulaire nouvel admin
  const [newAdminUid, setNewAdminUid] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminRole, setNewAdminRole] = useState<DigiSoliaAdminRole>('support_agent');
  const [newAdminApps, setNewAdminApps] = useState<string[]>(['digisolia-pos']);

  // Formulaire notification
  const [notifAppId, setNotifAppId] = useState<string>('all');
  const [notifRole, setNotifRole] = useState<'all' | 'owner' | 'manager' | 'cashier'>('all');
  const [notifPriority, setNotifPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifMsg, setNotifMsg] = useState<string>('');

  const perms = adminProfile ? ADMIN_ROLE_PERMISSIONS[adminProfile.role] : null;

  const loadAllAdminData = async () => {
    if (!adminProfile) return;
    setLoadingData(true);
    try {
      const fetchedApps = await fetchAppsRegistry();
      setApps(fetchedApps);

      const targetAppIds = fetchedApps.map((a) => a.appId);
      const [allUsers, allAdmins, allLogs, fbBatches, tkBatches] = await Promise.all([
        fetchAllUsersForAdmin().catch(() => []),
        fetchAdministrators().catch(() => []),
        fetchAdminAuditLogs().catch(() => []),
        Promise.all(targetAppIds.map((id) => fetchAllFeedbackForApp(id).catch(() => []))),
        Promise.all(targetAppIds.map((id) => fetchAllSupportForApp(id).catch(() => []))),
      ]);

      setUsers(allUsers);
      setAdmins(allAdmins);
      setAuditLogs(allLogs);
      setFeedbackList(
        fbBatches.flat().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      );
      setSupportList(
        tkBatches.flat().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      );
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Erreur lors du chargement des données.' });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (adminProfile) {
      loadAllAdminData();
    }
  }, [adminProfile?.id, adminProfile?.role]);

  // Statistiques calculées
  const stats = useMemo(() => {
    const filteredFb =
      filterAppId === 'all' ? feedbackList : feedbackList.filter((f) => f.appId === filterAppId);
    const filteredTk =
      filterAppId === 'all' ? supportList : supportList.filter((t) => t.appId === filterAppId);

    const rated = filteredFb.filter((f) => typeof f.rating === 'number' && f.rating > 0);
    const avgRating =
      rated.length > 0
        ? (rated.reduce((sum, f) => sum + (f.rating || 0), 0) / rated.length).toFixed(1)
        : '—';

    const resolvedTotal =
      filteredFb.filter((f) => f.status === 'resolved').length +
      filteredTk.filter((t) => t.status === 'resolved').length;
    const totalCases = filteredFb.length + filteredTk.length;
    const resolutionRate = totalCases > 0 ? Math.round((resolvedTotal / totalCases) * 100) : 0;

    const usersPerApp = apps.map((appItem) => {
      const actualUsers = users.filter((u) => (u.appId || 'digisolia-pos') === appItem.appId).length;
      const appRatings = feedbackList.filter(
        (f) => f.appId === appItem.appId && typeof f.rating === 'number'
      );
      const appAvg =
        appRatings.length > 0
          ? (
              appRatings.reduce((acc, cur) => acc + (cur.rating || 0), 0) / appRatings.length
            ).toFixed(1)
          : '—';
      return {
        ...appItem,
        countedUsers: Math.max(actualUsers, appItem.usersCount || 0),
        realDbUsers: actualUsers,
        avgRating: appAvg,
        feedbackCount: feedbackList.filter((f) => f.appId === appItem.appId).length,
        supportCount: supportList.filter((t) => t.appId === appItem.appId).length,
      };
    });

    const totalUsersAcrossApps = usersPerApp.reduce((s, a) => s + a.countedUsers, 0);

    return {
      avgRating,
      ratedCount: rated.length,
      resolutionRate,
      openTickets: filteredTk.filter((t) => t.status === 'pending' || t.status === 'in_progress')
        .length,
      complaintsCount: filteredFb.filter((f) => f.category === 'complaint' || f.category === 'bug')
        .length,
      suggestionsCount: filteredFb.filter((f) => f.category === 'suggestion').length,
      usersPerApp,
      totalUsersAcrossApps,
    };
  }, [apps, users, feedbackList, supportList, filterAppId]);

  const handleSaveFeedbackUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeedback || !adminProfile || !firebaseUser) return;
    try {
      await updateFeedbackStatusInFirestore({
        appId: editingFeedback.appId,
        feedbackId: editingFeedback.id,
        status: fbStatus,
        adminResponse: sanitizeText(fbResponse, 1500),
        handledBy: `${adminProfile.name} (${ADMIN_ROLE_LABELS[adminProfile.role]})`,
      });
      await recordAdminAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || adminProfile.email,
        actorRole: adminProfile.role,
        action: 'UPDATE_FEEDBACK_STATUS',
        targetPath: `apps/${editingFeedback.appId}/feedback/${editingFeedback.id}`,
        details: `Statut passé à ${WORKFLOW_STATUS_LABELS[fbStatus]}`,
      });
      setEditingFeedback(null);
      setNotice({ type: 'success', text: 'Avis mis à jour avec journalisation d’audit.' });
      await loadAllAdminData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Permission refusée.' });
    }
  };

  const handleSaveTicketUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket || !adminProfile || !firebaseUser) return;
    try {
      await updateSupportTicketInFirestore({
        appId: editingTicket.appId,
        ticketId: editingTicket.id,
        status: tkStatus,
        adminResponse: sanitizeText(tkResponse, 1500),
        handledBy: `${adminProfile.name} (${ADMIN_ROLE_LABELS[adminProfile.role]})`,
      });
      await recordAdminAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || adminProfile.email,
        actorRole: adminProfile.role,
        action: 'UPDATE_SUPPORT_TICKET',
        targetPath: `apps/${editingTicket.appId}/support/${editingTicket.id}`,
        details: `Ticket ${editingTicket.subject} -> ${WORKFLOW_STATUS_LABELS[tkStatus]}`,
      });
      setEditingTicket(null);
      setNotice({ type: 'success', text: 'Ticket d’assistance mis à jour avec succès.' });
      await loadAllAdminData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Permission refusée.' });
    }
  };

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !adminProfile) return;
    const cleanId = newAppId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);
    if (!cleanId || !newAppName.trim()) return;

    try {
      const appObj: DigiSoliaAppRegistryItem = {
        id: cleanId,
        appId: cleanId,
        name: sanitizeText(newAppName, 100),
        shortDescription: sanitizeText(newAppDesc, 300),
        category: sanitizeText(newAppCategory, 60),
        version: sanitizeText(newAppVersion, 20) || '1.0.0',
        status: 'active',
        usersCount: 0,
        primaryColor: DIGISOLIA_CONFIG.colors.primary,
        secondaryColor: DIGISOLIA_CONFIG.colors.secondary,
        supportWhatsapp: DIGISOLIA_CONFIG.contacts.whatsappDisplay,
        supportPhone: DIGISOLIA_CONFIG.contacts.phone,
        supportEmail: DIGISOLIA_CONFIG.contacts.email,
        updatedAt: new Date().toISOString(),
      };
      await saveAppRegistryItem(appObj);
      await recordAdminAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || adminProfile.email,
        actorRole: adminProfile.role,
        action: 'CREATE_OR_UPDATE_APP',
        targetPath: `apps/${cleanId}`,
        details: `Application ${appObj.name} v${appObj.version}`,
      });
      setNewAppId('');
      setNewAppName('');
      setNewAppDesc('');
      setNotice({ type: 'success', text: `Application ${appObj.name} enregistrée dans Firestore.` });
      await loadAllAdminData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Échec lors de l’ajout.' });
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !adminProfile) return;
    const cleanId = newAdminUid.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId || !newAdminEmail.trim() || !newAdminName.trim()) {
      setNotice({
        type: 'error',
        text: 'Veuillez renseigner l’UID Firebase, le nom et l’e-mail de l’administrateur.',
      });
      return;
    }

    try {
      const adminObj: DigiSoliaAdministrator = {
        id: cleanId,
        uid: cleanId,
        email: sanitizeText(newAdminEmail, 120),
        name: sanitizeText(newAdminName, 100),
        role: newAdminRole,
        assignedApps: newAdminApps,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveAdministrator(adminObj);
      await recordAdminAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || adminProfile.email,
        actorRole: adminProfile.role,
        action: 'GRANT_ADMIN_ROLE',
        targetPath: `administrators/${cleanId}`,
        details: `${adminObj.email} nommé ${ADMIN_ROLE_LABELS[adminObj.role]}`,
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      setNotice({ type: 'success', text: `Administrateur ${adminObj.name} ajouté.` });
      await loadAllAdminData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Permission refusée.' });
    }
  };

  const handleDeleteAdmin = async (target: DigiSoliaAdministrator) => {
    if (!firebaseUser || !adminProfile || target.id === firebaseUser.uid) return;
    try {
      await removeAdministrator(target.id);
      await recordAdminAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || adminProfile.email,
        actorRole: adminProfile.role,
        action: 'REVOKE_ADMIN_ROLE',
        targetPath: `administrators/${target.id}`,
        details: `Révocation de ${target.email}`,
      });
      setNotice({ type: 'success', text: `Accès révoqué pour ${target.email}.` });
      await loadAllAdminData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Impossible de révoquer cet administrateur.' });
    }
  };

  const handleSendNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !adminProfile) return;
    try {
      await sendFrameworkNotification({
        appId: notifAppId,
        targetRole: notifRole,
        title: sanitizeText(notifTitle, 150),
        message: sanitizeText(notifMsg, 500),
        priority: notifPriority,
      });
      await recordAdminAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || adminProfile.email,
        actorRole: adminProfile.role,
        action: 'BROADCAST_NOTIFICATION',
        targetPath: 'notifications',
        details: `Cible: ${notifAppId} (${notifRole}) - ${notifTitle}`,
      });
      setNotifTitle('');
      setNotifMsg('');
      setNotice({ type: 'success', text: 'Notification publiée vers les utilisateurs.' });
      await loadAllAdminData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Erreur lors de la diffusion.' });
    }
  };

  // --- AUTH GATE ---
  if (!isAuthReady) {
    return (
      <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Vérification des autorisations DIGISOLIA ADMIN...
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className={embedded ? 'py-6 px-2' : 'min-h-full bg-[#F4F7FB] dark:bg-[#05070c] py-12 px-4'}>
        <div className="max-w-md mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-[#163B65] text-white flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-[#163B65] dark:text-white">
              DIGISOLIA ADMIN
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Panneau centralisé multi-applications. Authentifiez-vous avec votre compte Google administrateur autorisé.
            </p>
          </div>
          {authError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>
          )}
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'Connexion...' : 'Connexion Google Administrateur'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (!adminProfile || !perms) {
    return (
      <div className={embedded ? 'py-6 px-2' : 'min-h-full bg-[#F4F7FB] dark:bg-[#05070c] py-12 px-4'}>
        <div className="max-w-lg mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-[#163B65] dark:text-white">
            Accès refusé — Autorisations insuffisantes
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Le compte <strong>{firebaseUser.email}</strong> n&apos;est pas répertorié comme administrateur actif dans Firebase. Demandez au Super administrateur DigiSolia d&apos;attribuer votre rôle avec votre UID :
          </p>
          <div className="p-2.5 rounded-lg bg-[#F4F7FB] dark:bg-slate-950 font-mono text-xs text-slate-700 dark:text-slate-300 select-all">
            {firebaseUser.uid}
          </div>
        </div>
      </div>
    );
  }

  const tabDefinitions: { id: AdminTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'overview', label: 'Vue générale', icon: <LayoutGrid className="w-3.5 h-3.5" />, visible: true },
    { id: 'apps', label: 'Applications', icon: <Layers className="w-3.5 h-3.5" />, visible: true },
    { id: 'users', label: 'Utilisateurs', icon: <Users className="w-3.5 h-3.5" />, visible: perms.canViewUsers },
    { id: 'feedback', label: 'Avis', icon: <MessageSquare className="w-3.5 h-3.5" />, visible: true },
    { id: 'suggestions', label: 'Suggestions', icon: <Lightbulb className="w-3.5 h-3.5" />, visible: true },
    { id: 'complaints', label: 'Réclamations', icon: <AlertTriangle className="w-3.5 h-3.5" />, visible: true },
    { id: 'support', label: 'Assistance', icon: <Headphones className="w-3.5 h-3.5" />, visible: true },
    { id: 'satisfaction', label: 'Satisfaction', icon: <BarChart3 className="w-3.5 h-3.5" />, visible: true },
    { id: 'admins', label: 'Administrateurs', icon: <UserCog className="w-3.5 h-3.5" />, visible: perms.canManageAdmins },
    { id: 'roles', label: 'Rôles', icon: <KeyRound className="w-3.5 h-3.5" />, visible: true },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-3.5 h-3.5" />, visible: perms.canSendNotifications },
    { id: 'audit', label: 'Journal d’audit', icon: <History className="w-3.5 h-3.5" />, visible: true },
  ];
  const tabs = tabDefinitions.filter((t) => t.visible);

  const visibleFeedback = feedbackList.filter((f) => {
    if (filterAppId !== 'all' && f.appId !== filterAppId) return false;
    if (activeTab === 'suggestions') return f.category === 'suggestion';
    if (activeTab === 'complaints') return f.category === 'complaint' || f.category === 'bug';
    return true;
  });

  const visibleSupport = supportList.filter(
    (t) => filterAppId === 'all' || t.appId === filterAppId
  );

  const visibleUsers = users.filter((u) => {
    if (filterAppId !== 'all' && (u.appId || 'digisolia-pos') !== filterAppId) return false;
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div
      className={
        embedded
          ? 'text-slate-900 dark:text-slate-100'
          : 'min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10'
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête DIGISOLIA ADMIN */}
        <header className="rounded-xl bg-[#163B65] text-white p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-200">
              Console centralisée multi-produits · {ADMIN_ROLE_LABELS[adminProfile.role]}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">DIGISOLIA ADMIN</h1>
            <p className="text-xs text-sky-100">
              Connecté : {adminProfile.email} · {apps.length} application(s) gérée(s)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={filterAppId}
              onChange={(e) => setFilterAppId(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/20 text-white focus:outline-hidden"
            >
              <option value="all" className="text-slate-900">
                Toutes les applications ({apps.length})
              </option>
              {apps.map((a) => (
                <option key={a.appId} value={a.appId} className="text-slate-900">
                  {a.name} ({a.appId})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadAllAdminData}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#2783C7] hover:bg-[#1e6aa3] text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
        </header>

        {notice && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
              notice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="font-bold px-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Barre d'onglets */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#163B65] text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-[#E1E7EF] dark:border-slate-800 hover:border-[#2783C7]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* 1. VUE GÉNÉRALE */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Applications actives</div>
                <div className="text-2xl font-extrabold text-[#163B65] dark:text-white tabular-nums">
                  {apps.length}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Écosystème DigiSolia
                </div>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Utilisateurs cumulés</div>
                <div className="text-2xl font-extrabold text-[#163B65] dark:text-white tabular-nums">
                  {stats.totalUsersAcrossApps}
                </div>
                <div className="text-xs text-[#2783C7] tabular-nums">
                  {users.length} profils enregistrés en base
                </div>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Satisfaction moyenne</div>
                <div className="text-2xl font-extrabold text-[#163B65] dark:text-white tabular-nums">
                  {stats.avgRating} / 5 ★
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Sur {stats.ratedCount} avis notés
                </div>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Tickets ouverts</div>
                <div className="text-2xl font-extrabold text-[#163B65] dark:text-white tabular-nums">
                  {stats.openTickets}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Taux de résolution : {stats.resolutionRate}%
                </div>
              </div>
            </div>

            {/* Répartition par application */}
            <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Utilisateurs et activité par application
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E1E7EF] dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4 font-semibold">Application</th>
                      <th className="py-2.5 pr-4 font-semibold">Identifiant</th>
                      <th className="py-2.5 pr-4 font-semibold">Version</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Utilisateurs</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Note moy.</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Avis</th>
                      <th className="py-2.5 font-semibold text-right">Support</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                    {stats.usersPerApp.map((row) => (
                      <tr key={row.appId}>
                        <td className="py-3 pr-4 font-bold text-slate-900 dark:text-white">
                          {row.name}
                        </td>
                        <td className="py-3 pr-4 font-mono text-[#2783C7]">{row.appId}</td>
                        <td className="py-3 pr-4 font-mono tabular-nums">v{row.version}</td>
                        <td className="py-3 pr-4 text-right font-mono font-bold tabular-nums">
                          {row.countedUsers}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">
                          {row.avgRating} ★
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">
                          {row.feedbackCount}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {row.supportCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* 2. LISTE DES APPLICATIONS */}
        {activeTab === 'apps' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              {stats.usersPerApp.map((appItem) => (
                <div
                  key={appItem.appId}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-[#163B65] dark:text-white">
                        {appItem.name}
                      </h3>
                      <p className="text-xs font-mono text-[#2783C7]">
                        {appItem.appId} · v{appItem.version} · {appItem.category}
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      {appItem.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {appItem.shortDescription}
                  </p>
                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums pt-1">
                    {appItem.countedUsers} utilisateurs · {appItem.feedbackCount} avis ·{' '}
                    {appItem.supportCount} tickets support
                  </div>
                </div>
              ))}
            </div>

            {perms.canManageApps && (
              <form
                onSubmit={handleAddApp}
                className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4 h-fit"
              >
                <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                  Enregistrer / Mettre à jour une application
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Identifiant unique (appId) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAppId}
                      onChange={(e) => setNewAppId(e.target.value)}
                      placeholder="ex: digisolia-transport"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Nom du produit *</label>
                    <input
                      type="text"
                      required
                      value={newAppName}
                      onChange={(e) => setNewAppName(e.target.value)}
                      placeholder="ex: DigiSolia Transport"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Catégorie</label>
                      <input
                        type="text"
                        value={newAppCategory}
                        onChange={(e) => setNewAppCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Version</label>
                      <input
                        type="text"
                        value={newAppVersion}
                        onChange={(e) => setNewAppVersion(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={newAppDesc}
                      onChange={(e) => setNewAppDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enregistrer l&apos;application</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* 4. GESTION DES UTILISATEURS */}
        {activeTab === 'users' && perms.canViewUsers && (
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Utilisateurs enregistrés ({visibleUsers.length})
              </h2>
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher par nom, email..."
                className="sm:w-64 px-3 py-1.5 rounded-lg text-xs bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E7EF] dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 pr-4">Nom</th>
                    <th className="py-2.5 pr-4">E-mail</th>
                    <th className="py-2.5 pr-4">Téléphone</th>
                    <th className="py-2.5 pr-4">Application</th>
                    <th className="py-2.5 pr-4">Rôle</th>
                    <th className="py-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                  {visibleUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4 font-semibold">{u.name}</td>
                      <td className="py-2.5 pr-4">{u.email}</td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums">{u.phone || '—'}</td>
                      <td className="py-2.5 pr-4 font-mono text-[#2783C7]">{u.appId}</td>
                      <td className="py-2.5 pr-4">{u.role}</td>
                      <td className="py-2.5 font-semibold">{u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5, 6, 7. AVIS, SUGGESTIONS & RÉCLAMATIONS */}
        {(activeTab === 'feedback' ||
          activeTab === 'suggestions' ||
          activeTab === 'complaints') && (
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              {activeTab === 'suggestions'
                ? `Gestion des suggestions (${visibleFeedback.length})`
                : activeTab === 'complaints'
                ? `Gestion des réclamations et bugs (${visibleFeedback.length})`
                : `Consultation des avis (${visibleFeedback.length})`}
            </h2>

            {visibleFeedback.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Aucun élément trouvé pour ce filtre.
              </p>
            ) : (
              <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                {visibleFeedback.map((fb) => (
                  <div key={`${fb.appId}_${fb.id}`} className="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-[#2783C7]">{fb.appId}</span>
                        <span>·</span>
                        <span className="font-semibold">{FEEDBACK_CATEGORY_LABELS[fb.category]}</span>
                        {fb.rating && (
                          <>
                            <span>·</span>
                            <span className="text-amber-500 font-bold tabular-nums">{fb.rating}/5 ★</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{fb.userName || fb.userEmail || fb.authorUid}</span>
                        <span>·</span>
                        <span className="text-slate-400 tabular-nums">
                          {formatFrenchDateTime(fb.createdAt)}
                        </span>
                      </div>
                      <span className="font-bold text-[#163B65] dark:text-sky-300">
                        {WORKFLOW_STATUS_LABELS[fb.status]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{fb.message}</p>
                    {fb.adminResponse && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Réponse : {fb.adminResponse}
                      </p>
                    )}
                    {perms.canHandleFeedback && (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFeedback(fb);
                            setFbStatus(fb.status);
                            setFbResponse(fb.adminResponse || '');
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2783C7] hover:bg-[#1e6aa3] cursor-pointer"
                        >
                          Traiter / Répondre
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 8. GESTION DES DEMANDES D'ASSISTANCE */}
        {activeTab === 'support' && (
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Demandes d&apos;assistance ({visibleSupport.length})
            </h2>

            {visibleSupport.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Aucune demande d&apos;assistance enregistrée.
              </p>
            ) : (
              <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                {visibleSupport.map((tk) => (
                  <div key={`${tk.appId}_${tk.id}`} className="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-[#2783C7]">{tk.appId}</span>
                        <span>·</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {tk.subject}
                        </span>
                      </div>
                      <span className="font-bold text-[#163B65] dark:text-sky-300">
                        {WORKFLOW_STATUS_LABELS[tk.status]} · Priorité {tk.priority}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{tk.description}</p>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {SUPPORT_TOPIC_LABELS[tk.topic]} · {tk.userName || tk.userEmail} (
                      {tk.userPhone || '—'}) · {formatFrenchDateTime(tk.createdAt)}
                    </div>
                    {tk.adminResponse && (
                      <div className="p-2.5 rounded-lg bg-[#F4F7FB] dark:bg-slate-800 text-xs">
                        Réponse ({tk.handledBy}) : {tk.adminResponse}
                      </div>
                    )}
                    {perms.canHandleSupport && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTicket(tk);
                          setTkStatus(tk.status);
                          setTkResponse(tk.adminResponse || '');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2783C7] hover:bg-[#1e6aa3] cursor-pointer"
                      >
                        Mettre à jour le ticket
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 9. STATISTIQUES DE SATISFACTION */}
        {activeTab === 'satisfaction' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Distribution des notes (1 à 5 étoiles)
              </h2>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = feedbackList.filter((f) => f.rating === star).length;
                  const pct =
                    stats.ratedCount > 0 ? Math.round((count / stats.ratedCount) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <div className="w-16 flex items-center gap-1 font-bold tabular-nums">
                        <span>{star}</span>
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </div>
                      <div className="flex-1 h-2.5 rounded-full bg-[#F4F7FB] dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-[#2783C7]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-16 text-right font-mono tabular-nums">
                        {count} ({pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Satisfaction par produit
              </h2>
              <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                {stats.usersPerApp.map((a) => (
                  <div key={a.appId} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-bold">{a.name}</div>
                      <div className="text-xs text-slate-500">{a.feedbackCount} retours</div>
                    </div>
                    <div className="text-base font-extrabold text-[#163B65] dark:text-sky-300 tabular-nums">
                      {a.avgRating} / 5 ★
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* 10. GESTION DES ADMINISTRATEURS */}
        {activeTab === 'admins' && perms.canManageAdmins && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Administrateurs actifs ({admins.length})
              </h2>
              <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                {admins.map((adm) => (
                  <div key={adm.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold">{adm.name}</div>
                      <div className="text-xs text-slate-500">
                        {adm.email} · {ADMIN_ROLE_LABELS[adm.role]}
                      </div>
                      <div className="text-[11px] font-mono text-[#2783C7]">
                        Apps : {adm.assignedApps?.join(', ') || 'Toutes'}
                      </div>
                    </div>
                    {adm.id !== firebaseUser.uid && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAdmin(adm)}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        title="Révoquer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <form
              onSubmit={handleAddAdmin}
              className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4 h-fit"
            >
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Nommer un administrateur
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">UID Firebase utilisateur *</label>
                  <input
                    type="text"
                    required
                    value={newAdminUid}
                    onChange={(e) => setNewAdminUid(e.target.value)}
                    placeholder="UID affiché dans son profil..."
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nom complet *</label>
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Adresse e-mail Google *</label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Rôle RBAC</label>
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as DigiSoliaAdminRole)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                  >
                    {Object.entries(ADMIN_ROLE_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Applications autorisées</label>
                  <div className="space-y-1.5">
                    {apps.map((a) => (
                      <label key={a.appId} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAdminApps.includes(a.appId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAdminApps([...newAdminApps, a.appId]);
                            } else {
                              setNewAdminApps(newAdminApps.filter((id) => id !== a.appId));
                            }
                          }}
                        />
                        <span>{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] cursor-pointer"
              >
                Attribuer les droits
              </button>
            </form>
          </div>
        )}

        {/* 11. RÔLES ET PERMISSIONS */}
        {activeTab === 'roles' && (
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Matrice des rôles et permissions (vérifiée côté Firestore)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E7EF] dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 pr-4">Rôle</th>
                    <th className="py-2.5 pr-4">Stats</th>
                    <th className="py-2.5 pr-4">Support &amp; Avis</th>
                    <th className="py-2.5 pr-4">Utilisateurs</th>
                    <th className="py-2.5 pr-4">Apps &amp; Notifs</th>
                    <th className="py-2.5">Gestion Admins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                  {(Object.keys(ADMIN_ROLE_PERMISSIONS) as DigiSoliaAdminRole[]).map((roleKey) => {
                    const p = ADMIN_ROLE_PERMISSIONS[roleKey];
                    return (
                      <tr key={roleKey}>
                        <td className="py-3 pr-4">
                          <div className="font-bold text-[#163B65] dark:text-white">
                            {ADMIN_ROLE_LABELS[roleKey]}
                          </div>
                          <div className="text-[11px] text-slate-500">{p.description}</div>
                        </td>
                        <td className="py-3 pr-4">{p.canViewStats ? 'Oui' : 'Non'}</td>
                        <td className="py-3 pr-4">{p.canHandleSupport ? 'Oui' : 'Non'}</td>
                        <td className="py-3 pr-4">{p.canViewUsers ? 'Oui' : 'Non'}</td>
                        <td className="py-3 pr-4">{p.canManageApps ? 'Oui' : 'Non'}</td>
                        <td className="py-3">{p.canManageAdmins ? 'Oui' : 'Non'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 12. NOTIFICATIONS AUX UTILISATEURS */}
        {activeTab === 'notifications' && perms.canSendNotifications && (
          <form
            onSubmit={handleSendNotif}
            className="max-w-2xl rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Diffuser une notification DigiSolia
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Application cible</label>
                <select
                  value={notifAppId}
                  onChange={(e) => setNotifAppId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                >
                  <option value="all">Toutes les apps</option>
                  {apps.map((a) => (
                    <option key={a.appId} value={a.appId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Rôle destinataire</label>
                <select
                  value={notifRole}
                  onChange={(e) => setNotifRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                >
                  <option value="all">Tous les utilisateurs</option>
                  <option value="owner">Propriétaires</option>
                  <option value="manager">Gérants</option>
                  <option value="cashier">Caissiers</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Priorité</label>
                <select
                  value={notifPriority}
                  onChange={(e) => setNotifPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                >
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Titre *</label>
              <input
                type="text"
                required
                maxLength={150}
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Ex: Mise à jour DigiSolia POS v2.4 disponible"
                className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Message *</label>
              <textarea
                rows={3}
                required
                maxLength={500}
                value={notifMsg}
                onChange={(e) => setNotifMsg(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Envoyer la notification</span>
            </button>
          </form>
        )}

        {/* JOURNAL D'AUDIT ADMINISTRATIF */}
        {activeTab === 'audit' && (
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Journal d&apos;audit des opérations administratives ({auditLogs.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E7EF] dark:border-slate-800 text-slate-500">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Administrateur</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Cible</th>
                    <th className="py-2">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-4 font-mono tabular-nums whitespace-nowrap">
                        {formatFrenchDateTime(log.createdAt)}
                      </td>
                      <td className="py-2.5 pr-4">{log.actorEmail}</td>
                      <td className="py-2.5 pr-4 font-mono text-[#2783C7]">{log.action}</td>
                      <td className="py-2.5 pr-4 font-mono">{log.targetPath}</td>
                      <td className="py-2.5">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* MODAL TRAITEMENT AVIS */}
        {editingFeedback && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveFeedbackUpdate}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-[#163B65] dark:text-white">
                Traiter le retour ({editingFeedback.appId})
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {editingFeedback.message}
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1">Nouveau statut</label>
                <select
                  value={fbStatus}
                  onChange={(e) => setFbStatus(e.target.value as WorkflowStatus)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                >
                  {Object.entries(WORKFLOW_STATUS_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Réponse officielle</label>
                <textarea
                  rows={3}
                  value={fbResponse}
                  onChange={(e) => setFbResponse(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFeedback(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#163B65] cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL TRAITEMENT TICKET SUPPORT */}
        {editingTicket && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveTicketUpdate}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-[#163B65] dark:text-white">
                Traiter le ticket support ({editingTicket.appId})
              </h3>
              <div className="text-xs font-semibold">{editingTicket.subject}</div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {editingTicket.description}
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1">Statut du ticket</label>
                <select
                  value={tkStatus}
                  onChange={(e) => setTkStatus(e.target.value as WorkflowStatus)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                >
                  {Object.entries(WORKFLOW_STATUS_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Réponse technique</label>
                <textarea
                  rows={3}
                  value={tkResponse}
                  onChange={(e) => setTkResponse(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#163B65] cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
