import { DigiSoliaAppConfig, DigiSoliaAppRegistryItem, DigiSoliaAdminRole } from '../types/digisolia.types';

/**
 * FICHIER DE CONFIGURATION CENTRAL — DIGISOLIA APP FRAMEWORK (DAF)
 * Pour intégrer le framework dans une nouvelle application DigiSolia
 * (PROF PLANNING, DigiSolia Hôtel, etc.), modifiez simplement cet objet de configuration.
 */
export const DIGISOLIA_CONFIG: DigiSoliaAppConfig = {
  appId: 'digisolia-pos',
  appName: 'DigiSolia POS',
  appSubtitle: 'Caisse Pro — Encaissement tactile & gestion commerciale',
  appVersion: '2.4.0',
  frameworkVersion: '1.0.0',
  brandName: 'DIGISOLIA',
  brandSignature: 'La technologie au service de vos activités.',
  publisherName: 'DigiSolia — Solutions Numériques (Burkina Faso)',
  description:
    'Solution complète de caisse tactile, suivi des stocks en temps réel, gestion des crédits clients, rapports Z et chiffre d’affaires hebdomadaire, conçue pour les commerces, pharmacies, supermarchés et boutiques.',
  logo: {
    text: 'DIGISOLIA',
    accentText: 'POS',
    // Pour remplacer le logo provisoire par un logo officiel, renseignez logo.imageUrl :
    imageUrl: undefined,
  },
  colors: {
    primary: '#163B65',
    secondary: '#2783C7',
    white: '#FFFFFF',
    background: '#F4F7FB',
    lightGray: '#E1E7EF',
  },
  contacts: {
    whatsappNumber: '22676127809',
    whatsappDisplay: '+226 76 12 78 09',
    phone: '+226 76 12 78 09',
    email: 'support@digisolia.bf',
    website: 'https://digisolia.bf',
    address: 'Ouagadougou, Burkina Faso',
    country: 'Burkina Faso',
    supportHours: 'Lundi – Samedi · 08h00 à 20h00 (GMT)',
  },
  enabledModules: {
    welcome: true,
    dashboard: true,
    support: true,
    feedback: true,
    profile: true,
    settings: true,
    about: true,
    notifications: true,
    admin: true,
  },
  features: [
    {
      title: 'Caisse tactile ultra-rapide',
      description: 'Mode Caisse Rapide ou Rayons & Catalogue avec validation instantanée sans impression ou ticket thermique 80mm/58mm.',
    },
    {
      title: 'Fonctionnement 100 % hors connexion',
      description: 'Continuez à encaisser et enregistrer vos opérations sans Internet. La synchronisation reprend automatiquement au retour du réseau.',
    },
    {
      title: 'Stocks, crédits et Rapport Z',
      description: 'Suivez vos niveaux de stock, les dettes clients, la clôture de caisse Z et le bilan hebdomadaire du lundi au dimanche.',
    },
    {
      title: 'Écosystème & assistance DigiSolia',
      description: 'Accédez à l’assistance directe WhatsApp, transmettez vos avis et gérez vos préférences depuis une interface unifiée.',
    },
  ],
  benefits: [
    'Gain de temps immédiat au comptoir grâce aux raccourcis clavier et à la validation sans papier',
    'Aucune perte de données en cas de coupure Internet au Burkina Faso ou en zone rurale',
    'Séparation claire des rôles entre propriétaire, gérant(e) et caissier(ère)',
    'Support technique réactif en français basé à Ouagadougou',
  ],
  guideSteps: [
    {
      step: 1,
      title: 'Ouvrir votre session de caisse',
      description: 'Renseignez votre fonds de caisse initial depuis le bouton Session en haut de l’écran avant les premiers encaissements.',
    },
    {
      step: 2,
      title: 'Encaisser avec ou sans ticket',
      description: 'Saisissez un montant ou scannez un article, puis appuyez sur Entrée pour valider sans imprimer, ou Shift+Entrée pour éditer un ticket.',
    },
    {
      step: 3,
      title: 'Suivre les stocks et crédits',
      description: 'Consultez l’onglet Stocks & Produits pour les alertes de réapprovisionnement et le Fichier Clients pour les recouvrements.',
    },
    {
      step: 4,
      title: 'Clôturer avec le Rapport Z',
      description: 'En fin de journée, comptez votre tiroir-caisse et générez le Rapport Z pour archiver les écarts et encaissements.',
    },
  ],
  faqItems: [
    {
      category: 'Hors connexion',
      question: 'Que se passe-t-il si la connexion Internet est coupée ?',
      answer:
        'Toutes vos ventes, mouvements de stock, avis et demandes d’assistance restent enregistrés localement sur votre appareil. Dès le retour d’Internet, la synchronisation automatique transfère vos données vers Firebase Cloud Firestore.',
    },
    {
      category: 'Impression',
      question: 'Comment valider une vente sans imprimer de ticket papier ?',
      answer:
        'Dans l’écran de caisse, cliquez sur le bouton vert « VALIDER SANS IMPRIMER » ou appuyez sur la touche Entrée. Si le client réclame finalement un reçu, appuyez sur F12.',
    },
    {
      category: 'Assistance',
      question: 'Comment contacter rapidement un technicien DigiSolia ?',
      answer:
        'Rendez-vous dans le Centre d’assistance pour lancer une discussion WhatsApp directe, passer un appel téléphonique ou envoyer un ticket technique qui sera suivi par nos agents.',
    },
    {
      category: 'Sécurité',
      question: 'Mes données commerciales sont-elles mélangées avec d’autres applications ?',
      answer:
        'Non. Chaque application DigiSolia possède un identifiant unique (ex: digisolia-pos, prof-planning, digisolia-hotel) et ses données sont isolées dans des collections et règles de sécurité strictes.',
    },
  ],
  bootstrappedSuperAdminEmail: 'akasanka399@gmail.com',
  maxFeedbackPerHour: 5,
  antiSpamCooldownMs: 30000,
};

/**
 * Catalogue officiel des produits de l'écosystème DigiSolia
 */
export const DIGISOLIA_APPS_CATALOG: DigiSoliaAppRegistryItem[] = [
  {
    id: 'digisolia-pos',
    appId: 'digisolia-pos',
    name: 'DigiSolia POS',
    shortDescription: 'Caisse tactile rapide, gestion des stocks, crédits clients et rapport Z.',
    category: 'Commerce & Retail',
    version: '2.4.0',
    status: 'active',
    usersCount: 148,
    primaryColor: '#163B65',
    secondaryColor: '#2783C7',
    supportWhatsapp: '+22676127809',
    supportPhone: '+226 76 12 78 09',
    supportEmail: 'support@digisolia.bf',
    updatedAt: '2026-11-18',
  },
  {
    id: 'prof-planning',
    appId: 'prof-planning',
    name: 'PROF PLANNING',
    shortDescription: 'Gestion intelligente des emplois du temps des enseignants et établissements.',
    category: 'Éducation & Planning',
    version: '1.8.2',
    status: 'active',
    usersCount: 86,
    primaryColor: '#163B65',
    secondaryColor: '#2783C7',
    supportWhatsapp: '+22676127809',
    supportPhone: '+226 76 12 78 09',
    supportEmail: 'support@digisolia.bf',
    updatedAt: '2026-11-15',
  },
  {
    id: 'digisolia-hotel',
    appId: 'digisolia-hotel',
    name: 'DigiSolia Hôtel',
    shortDescription: 'Gestion complète des hôtels, auberges, réservations, chambres et facturation.',
    category: 'Hôtellerie & Tourisme',
    version: '1.4.0',
    status: 'beta',
    usersCount: 34,
    primaryColor: '#163B65',
    secondaryColor: '#2783C7',
    supportWhatsapp: '+22676127809',
    supportPhone: '+226 76 12 78 09',
    supportEmail: 'support@digisolia.bf',
    updatedAt: '2026-11-10',
  },
];

export const ADMIN_ROLE_LABELS: Record<DigiSoliaAdminRole, string> = {
  super_admin: 'Super administrateur',
  app_admin: 'Administrateur d’application',
  support_agent: 'Agent de support',
  stats_reader: 'Lecteur des statistiques',
};

export const ADMIN_ROLE_PERMISSIONS: Record<
  DigiSoliaAdminRole,
  {
    canManageAdmins: boolean;
    canManageApps: boolean;
    canViewUsers: boolean;
    canHandleFeedback: boolean;
    canHandleSupport: boolean;
    canSendNotifications: boolean;
    canViewStats: boolean;
    description: string;
  }
> = {
  super_admin: {
    canManageAdmins: true,
    canManageApps: true,
    canViewUsers: true,
    canHandleFeedback: true,
    canHandleSupport: true,
    canSendNotifications: true,
    canViewStats: true,
    description: 'Contrôle total de l’écosystème DigiSolia, des rôles administrateurs et des règles globales.',
  },
  app_admin: {
    canManageAdmins: false,
    canManageApps: true,
    canViewUsers: true,
    canHandleFeedback: true,
    canHandleSupport: true,
    canSendNotifications: true,
    canViewStats: true,
    description: 'Administration complète des applications assignées, utilisateurs, avis et notifications.',
  },
  support_agent: {
    canManageAdmins: false,
    canManageApps: false,
    canViewUsers: false,
    canHandleFeedback: true,
    canHandleSupport: true,
    canSendNotifications: false,
    canViewStats: true,
    description: 'Traitement des réclamations, bugs, avis et demandes d’assistance client.',
  },
  stats_reader: {
    canManageAdmins: false,
    canManageApps: false,
    canViewUsers: false,
    canHandleFeedback: false,
    canHandleSupport: false,
    canSendNotifications: false,
    canViewStats: true,
    description: 'Consultation en lecture seule des statistiques de satisfaction et d’adoption.',
  },
};

export const WORKFLOW_STATUS_LABELS: Record<'pending' | 'in_progress' | 'resolved' | 'rejected', string> = {
  pending: 'En attente',
  in_progress: 'En cours de traitement',
  resolved: 'Résolu',
  rejected: 'Rejeté',
};

export const FEEDBACK_CATEGORY_LABELS: Record<'comment' | 'suggestion' | 'bug' | 'complaint', string> = {
  comment: 'Commentaire',
  suggestion: 'Suggestion',
  bug: 'Signalement de bug',
  complaint: 'Réclamation',
};

export const SUPPORT_TOPIC_LABELS: Record<'general' | 'technical' | 'hardware' | 'sync' | 'billing', string> = {
  general: 'Question générale',
  technical: 'Difficulté technique',
  hardware: 'Imprimante / Douchette',
  sync: 'Synchronisation & Hors-ligne',
  billing: 'Abonnement & Licence',
};
