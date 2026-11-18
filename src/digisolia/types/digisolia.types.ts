export type DigiSoliaViewId =
  | 'daf-welcome'
  | 'daf-dashboard'
  | 'daf-notifications'
  | 'daf-support'
  | 'daf-feedback'
  | 'daf-profile'
  | 'daf-settings'
  | 'daf-about';

export type DigiSoliaAdminRole =
  | 'super_admin'
  | 'app_admin'
  | 'support_agent'
  | 'stats_reader';

export type FeedbackCategory = 'comment' | 'suggestion' | 'bug' | 'complaint';
export type SupportTopic = 'general' | 'technical' | 'hardware' | 'sync' | 'billing';
export type RequestPriority = 'normal' | 'high' | 'urgent';
export type WorkflowStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

export interface DigiSoliaAppRegistryItem {
  id: string;
  appId: string;
  name: string;
  shortDescription: string;
  category: string;
  version: string;
  status: 'active' | 'maintenance' | 'beta' | 'archived';
  usersCount: number;
  primaryColor: string;
  secondaryColor: string;
  supportWhatsapp: string;
  supportPhone: string;
  supportEmail: string;
  updatedAt: string;
  features?: string[];
  benefits?: string[];
}

export interface DigiSoliaContactsConfig {
  whatsappNumber: string;
  whatsappDisplay: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  country: string;
  supportHours: string;
}

export interface DigiSoliaColorsConfig {
  primary: string;      // #163B65
  secondary: string;    // #2783C7
  white: string;        // #FFFFFF
  background: string;   // #F4F7FB
  lightGray: string;    // #E1E7EF
}

export interface DigiSoliaModulesConfig {
  welcome: boolean;
  dashboard: boolean;
  support: boolean;
  feedback: boolean;
  profile: boolean;
  settings: boolean;
  about: boolean;
  notifications: boolean;
  admin: boolean;
}

export interface DigiSoliaAppConfig {
  appId: string;
  appName: string;
  appSubtitle: string;
  appVersion: string;
  frameworkVersion: string;
  brandName: string;
  brandSignature: string;
  publisherName: string;
  description: string;
  logo: {
    text: string;
    accentText: string;
    imageUrl?: string; // Remplaçable ultérieurement par le logo officiel
  };
  colors: DigiSoliaColorsConfig;
  contacts: DigiSoliaContactsConfig;
  enabledModules: DigiSoliaModulesConfig;
  features: { title: string; description: string }[];
  benefits: string[];
  faqItems: { question: string; answer: string; category: string }[];
  guideSteps: { step: number; title: string; description: string }[];
  bootstrappedSuperAdminEmail: string;
  maxFeedbackPerHour: number;
  antiSpamCooldownMs: number;
}

export interface DigiSoliaFeedbackItem {
  id: string;
  appId: string;
  authorUid: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  category: FeedbackCategory;
  rating?: number; // 1 à 5 étoiles
  message: string;
  status: WorkflowStatus;
  adminResponse?: string;
  handledBy?: string;
  handledAt?: string;
  createdAt: string;
  _offlinePending?: boolean;
  _syncError?: string;
}

export interface DigiSoliaSupportTicket {
  id: string;
  appId: string;
  authorUid: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  topic: SupportTopic;
  priority: RequestPriority;
  subject: string;
  description: string;
  appVersion: string;
  status: WorkflowStatus;
  adminResponse?: string;
  handledBy?: string;
  handledAt?: string;
  createdAt: string;
  _offlinePending?: boolean;
  _syncError?: string;
}

export interface DigiSoliaAdministrator {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: DigiSoliaAdminRole;
  assignedApps: string[];
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt?: string;
}

export interface DigiSoliaAuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetPath: string;
  details: string;
  createdAt: string;
}

export interface DigiSoliaUserProfile {
  id: string;
  uid?: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string;
  appId: string;
  role: 'developer' | 'owner' | 'manager' | 'cashier' | 'user';
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin: string;
}

export interface DigiSoliaUserPreferences {
  language: 'fr' | 'en';
  notificationsEnabled: boolean;
  soundAlertsEnabled: boolean;
  stockAlertsEnabled: boolean;
  closingRemindersEnabled: boolean;
  autoSyncOnReconnect: boolean;
}

export interface OfflineQueueItem {
  queueId: string;
  kind: 'feedback' | 'support';
  appId: string;
  docId: string;
  payload: DigiSoliaFeedbackItem | DigiSoliaSupportTicket;
  dedupeHash: string;
  attempts: number;
  lastError?: string;
  queuedAt: string;
}

export interface ShortcutAction {
  id: string;
  label: string;
  description: string;
  targetView: string;
  category: 'metier' | 'framework';
}
