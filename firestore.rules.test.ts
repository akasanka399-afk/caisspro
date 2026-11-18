/**
 * Phase 0: Suite de tests de sécurité Firestore — DIGISOLIA APP FRAMEWORK (DAF)
 * Vérifie que les 12 payloads malveillants ("Dirty Dozen") sont rejetés par firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload: Record<string, any>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Auto-promotion Super Admin',
    collectionPath: 'administrators/hacker_uid',
    operation: 'create',
    auth: { uid: 'hacker_uid', email: 'hacker@example.com', email_verified: true },
    payload: {
      id: 'hacker_uid',
      email: 'hacker@example.com',
      name: 'Hacker',
      role: 'super_admin',
      assignedApps: ['digisolia-pos'],
      status: 'active',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Saut de statut à la création d’un avis',
    collectionPath: 'apps/digisolia-pos/feedback/fb_malicious_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      id: 'fb_malicious_1',
      appId: 'digisolia-pos',
      authorUid: 'user_1',
      category: 'comment',
      rating: 5,
      message: 'Tentative de statut pré-résolu',
      status: 'resolved',
      createdAt: '2026-11-18T10:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Auteur modifiant le statut de son propre ticket support',
    collectionPath: 'apps/digisolia-pos/support/tk_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      status: 'resolved',
      adminResponse: 'Approuvé par moi-même',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Usurpation d’identité authorUid à la création',
    collectionPath: 'apps/digisolia-pos/feedback/fb_spoof',
    operation: 'create',
    auth: { uid: 'user_A', email: 'userA@example.com', email_verified: true },
    payload: {
      id: 'fb_spoof',
      appId: 'digisolia-pos',
      authorUid: 'user_B',
      category: 'complaint',
      message: 'Usurpation identité',
      status: 'pending',
      createdAt: '2026-11-18T10:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Injection de champ fantôme (Shadow Field)',
    collectionPath: 'apps/digisolia-pos/feedback/fb_shadow',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      id: 'fb_shadow',
      appId: 'digisolia-pos',
      authorUid: 'user_1',
      category: 'comment',
      message: 'Test champ fantôme',
      status: 'pending',
      isVerified: true,
      createdAt: '2026-11-18T10:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Empoisonnement d’ID document (ID Poisoning)',
    collectionPath: 'apps/digisolia-pos/feedback/invalid$id_with_specials',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      id: 'invalid$id_with_specials',
      appId: 'digisolia-pos',
      authorUid: 'user_1',
      category: 'comment',
      message: 'Test ID invalide',
      status: 'pending',
      createdAt: '2026-11-18T10:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Déni de portefeuille (> 2000 caractères)',
    collectionPath: 'apps/digisolia-pos/feedback/fb_huge',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      id: 'fb_huge',
      appId: 'digisolia-pos',
      authorUid: 'user_1',
      category: 'comment',
      message: 'x'.repeat(2500),
      status: 'pending',
      createdAt: '2026-11-18T10:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Note hors bornes (rating = 99)',
    collectionPath: 'apps/digisolia-pos/feedback/fb_bad_rating',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      id: 'fb_bad_rating',
      appId: 'digisolia-pos',
      authorUid: 'user_1',
      category: 'comment',
      rating: 99,
      message: 'Note invalide',
      status: 'pending',
      createdAt: '2026-11-18T10:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Écriture orpheline sous appId inexistant',
    collectionPath: 'apps/fake-app-id/feedback/fb_orphan',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      id: 'fb_orphan',
      appId: 'fake-app-id',
      authorUid: 'user_1',
      category: 'bug',
      message: 'Tentative orpheline',
      status: 'pending',
      createdAt: '2026-11-18T10:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Usurpation email admin avec email_verified: false',
    collectionPath: 'administrators/spoof_admin',
    operation: 'list',
    auth: { uid: 'spoof_uid', email: 'akasanka399@gmail.com', email_verified: false },
    payload: {},
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Modification / suppression du journal d’audit administratif',
    collectionPath: 'admin_audit_logs/audit_1',
    operation: 'delete',
    auth: { uid: 'super_admin_uid', email: 'akasanka399@gmail.com', email_verified: true },
    payload: {},
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Lecteur de statistiques écrivant une réponse support',
    collectionPath: 'apps/digisolia-pos/support/tk_1',
    operation: 'update',
    auth: { uid: 'stats_reader_uid', email: 'stats@digisolia.bf', email_verified: true },
    payload: {
      status: 'resolved',
      adminResponse: 'Tentative non autorisée',
    },
    expected: 'PERMISSION_DENIED',
  },
];
