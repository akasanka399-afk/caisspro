# DIGISOLIA APP FRAMEWORK (DAF) — Documentation & Guide d'Intégration

**Éditeur :** DigiSolia (Solutions Numériques — Ouagadougou, Burkina Faso)  
**Signature :** *La technologie au service de vos activités.*  
**Version du Framework :** `1.0.0`

---

## 1. Architecture Modulaire du Framework

Tous les modules transversaux DigiSolia sont isolés dans `src/digisolia/` afin de ne jamais interférer avec le code métier existant de chaque produit (`DigiSolia POS`, `PROF PLANNING`, `DigiSolia Hôtel`, etc.) :

```text
src/
  digisolia/
    config/
      digisolia.config.ts       # Configuration centrale (appId, nom, couleurs, contacts, modules, FAQ)
    components/
      DigiSoliaLogo.tsx         # Logo textuel/vectoriel #163B65 / #2783C7 (remplaçable par logo officiel)
      DigiSoliaShell.tsx        # Barre latérale desktop + navigation mobile adaptée
      ErrorBoundary.tsx         # Gestion propre des erreurs React & Firestore
      SyncStatusBanner.tsx      # Indicateur En ligne / Hors connexion & file d'attente
    services/
      digisoliaFirebase.ts      # Connexion réutilisant src/firebase/config.ts + gestion d'erreurs structurée
      offlineQueue.ts           # Cache local + file d'attente dédupliquée + sync auto au retour réseau
    hooks/
      useOnlineStatus.ts        # État réseau navigateur + statut Cloud Firestore
      useDigiSoliaAuth.ts       # Firebase Google Auth + résolution des rôles administrateurs
      useOfflineQueue.ts        # Contrôle file d'attente hors connexion
    utils/
      validation.ts             # Validation formulaires, anti-spam (cooldown, plafond horaire, honeypot)
    features/
      WelcomeModule.tsx         # MODULE A : Page de présentation (première utilisation + menu)
      DashboardModule.tsx       # MODULE B : Tableau de bord Framework (sans remplacer le tableau métier)
      SupportModule.tsx         # MODULE C : Centre d'assistance (WhatsApp, Appel, E-mail, Ticket, Guide, FAQ)
      FeedbackModule.tsx        # MODULE D : Avis & Suggestions (1-5 étoiles, catégories, anti-spam)
      ProfileModule.tsx         # MODULE E : Profil utilisateur (infos perso, Cloud Google, session, déconnexion)
      SettingsModule.tsx        # MODULE F : Paramètres (thème clair/sombre, notifications, sauvegarde JSON)
      AboutModule.tsx           # MODULE G : À propos (Mission, Vision, Coordonnées, CGU, Confidentialité)
      NotificationsModule.tsx   # Centre unifié de notifications
    admin/
      DigiSoliaAdminPanel.tsx   # DIGISOLIA ADMIN : Console multi-applications + 4 rôles RBAC + Audit Logs
    index.ts                    # Point d'entrée unique des exports
```

---

## 2. Identité Visuelle Officielle

| Rôle | Code Couleur | Usage |
| :--- | :--- | :--- |
| Bleu principal | `#163B65` | En-têtes, boutons primaires, navigation active, titres |
| Bleu secondaire | `#2783C7` | Liens, actions secondaires, accents |
| Blanc | `#FFFFFF` | Cartes et surfaces principales |
| Fond | `#F4F7FB` | Arrière-plan général clair |
| Gris clair | `#E1E7EF` | Bordures subtiles 1px et séparateurs |

---

## 3. Structure Firestore & Sécurité

Chaque application dispose de son propre `appId` unique (`digisolia-pos`, `prof-planning`, `digisolia-hotel`). Les données ne sont jamais mélangées :

- `apps/{appId}` : Métadonnées de l'application (nom, version, statut, contacts support).
- `apps/{appId}/feedback/{feedbackId}` : Avis, suggestions, signalements de bugs et réclamations. Statut verrouillé à `pending` lors de la création ; seuls les administrateurs/agents peuvent passer le statut à `in_progress`, `resolved` ou `rejected`.
- `apps/{appId}/support/{ticketId}` : Demandes d'assistance technique avec priorité et réponse agent.
- `users/{userId}` : Profils utilisateurs isolés (PII protégée par propriétaire ou admin).
- `administrators/{adminId}` : Registre RBAC (`super_admin`, `app_admin`, `support_agent`, `stats_reader`).
- `admin_audit_logs/{logId}` : Journal immuable de toutes les actions d'administration.
- `notifications/{notificationId}` : Notifications ciblées par application et par rôle.

### Vérification des règles de sécurité
```bash
npx eslint firestore.rules
```

---

## 4. Guide d'Intégration dans une Nouvelle Application (ex: PROF PLANNING ou DigiSolia Hôtel)

1. **Copier le dossier `src/digisolia/`** dans le projet React existant.
2. **Conserver votre configuration Firebase existante** : vérifier que `src/firebase/config.ts` exporte `db`, `auth` et `testConnection()` (aucun doublon `initializeApp`).
3. **Personnaliser `src/digisolia/config/digisolia.config.ts`** :
   - Modifier `appId` (ex: `'prof-planning'` ou `'digisolia-hotel'`).
   - Modifier `appName`, `appVersion`, `description`, `features`, `benefits`, `guideSteps` et `faqItems`.
   - Renseigner si besoin `logo.imageUrl` pour remplacer le logo textuel/SVG provisoire.
4. **Envelopper votre application avec `<DigiSoliaShell>` et `<ErrorBoundary>`** dans `App.tsx` :
   - Garder toutes vos vues métier intactes dans `<DigiSoliaShell>` sans modifier vos collections ou votre `localStorage` métier.
   - Ajouter le rendu conditionnel des vues `daf-*` (`WelcomeModule`, `DashboardModule`, `SupportModule`, `FeedbackModule`, `ProfileModule`, `SettingsModule`, `AboutModule`, `DigiSoliaAdminPanel`).
5. **Déployer `firestore.rules`** et vérifier l'enregistrement de votre nouvel `appId` dans `DIGISOLIA ADMIN -> Applications`.
