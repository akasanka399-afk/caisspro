# Spécification de Sécurité Firestore — DIGISOLIA APP FRAMEWORK (DAF) & DigiSolia POS

## 1. Invariants de Données (Data Invariants)
1. **Master Source of Truth (`apps/{appId}`)**: Aucun feedback (`apps/{appId}/feedback/{feedbackId}`) ni ticket d'assistance (`apps/{appId}/support/{ticketId}`) ne peut être créé sans qu'une application parente valide existe dans `/apps/{appId}` (`exists(/databases/$(database)/documents/apps/$(appId))`).
2. **Intégrité d'Identité (`authorUid`)**: Un utilisateur authentifié créant un avis, une suggestion, un bug, une réclamation ou une demande d'assistance doit obligatoirement définir `authorUid == request.auth.uid` et un email vérifié (`request.auth.token.email_verified == true`).
3. **Immuabilité & Verrouillage des Statuts**:
   - Lors de la création d'un avis ou ticket support, le statut DOIT être `'pending'` (`En attente`) et `adminResponse` doit être absent.
   - Un utilisateur standard ne peut JAMAIS modifier le `status`, `adminResponse`, `handledBy`, `handledAt` ou changer son rôle. Seul un administrateur autorisé (`super_admin`, `app_admin`, `support_agent`) peut faire évoluer le workflow de traitement (`pending` -> `in_progress` -> `resolved` / `rejected`).
4. **Isolation des Rôles Administrateurs (`administrators/{adminId}`)**:
   - Seul un `super_admin` vérifié (ou le Super Administrateur initial `akasanka399@gmail.com` avec `email_verified == true`) peut créer, modifier ou révoquer un document dans `/administrators`.
   - Aucun utilisateur ne peut s'auto-promouvoir dans `/users` ou `/administrators`.
5. **Isolation PII (`users/{userId}`)**:
   - Les profils utilisateurs DAF contiennent des données personnelles (email, téléphone). L'accès en lecture et écriture sur les profils personnels authentifiés est restreint au propriétaire (`request.auth.uid == userId`) ou aux administrateurs vérifiés.
6. **Intégrité Temporelle & Anti-Abus**:
   - Les IDs de documents doivent respecter `^[a-zA-Z0-9_\-]+$` (longueur 1–128).
   - Chaque champ texte possède une borne `.size()` stricte synchronisée avec `firebase-blueprint.json`.
   - Aucun champ fantôme (`Ghost Field`) n'est accepté : `keys().hasOnly(...)` et `affectedKeys().hasOnly(...)` stricts.
7. **Journal d'Audit Administratif Immuable (`admin_audit_logs/{logId}`)**:
   - Seuls les administrateurs vérifiés peuvent créer des logs d'audit (`actorUid == request.auth.uid`), et aucune modification ni suppression (`update`, `delete`) n'est jamais permise.
8. **Préservation Caisse Pro (DigiSolia POS)**:
   - Toutes les collections métier existantes (`businesses`, `products`, `customers`, `transactions`, `credit_settlements`, `sessions`, `movements`, `test`) sont conservées sans rupture pour les terminaux de caisse hors-ligne / PIN.

## 2. Les 12 Payloads Malveillants ("Dirty Dozen") devant être rejetés (PERMISSION_DENIED)
1. **Auto-promotion Admin**: Utilisateur standard écrivant `{ role: 'super_admin', email: 'hacker@x.com', status: 'active' }` dans `/administrators/hacker123`.
2. **Saut de statut à la création d'avis**: Utilisateur créant un feedback dans `/apps/digisolia-pos/feedback/fb1` avec `{ status: 'resolved' }` au lieu de `'pending'`.
3. **Modification de statut par l'auteur**: Auteur tentant de passer son propre ticket `/apps/digisolia-pos/support/tk1` à `{ status: 'resolved', adminResponse: 'Approuvé' }`.
4. **Usurpation d'auteur (`authorUid`)**: Utilisateur authentifié `uid_A` créant un avis avec `authorUid: 'uid_B'`.
5. **Champ fantôme (Shadow Field)**: Ajout d'un champ non autorisé `{ isVerified: true, bonusCredits: 999 }` lors de la création ou mise à jour d'un avis.
6. **Empoisonnement d'ID (ID Poisoning)**: Document ID contenant `/` ou 500 caractères `aaaa...` sur `/apps/digisolia-pos/feedback/...`.
7. **Déni de portefeuille (1MB Payload)**: Feedback avec `message` de 5000 caractères (> max 2000).
8. **Note invalide hors bornes**: Feedback avec `rating: 99` ou `rating: -5` ou `rating: "cinq"`.
9. **Enregistrement orphelin**: Création d'un feedback sous `/apps/fake_nonexistent_app/feedback/fb1`.
10. **Usurpation Email sans vérification**: Token avec `email: 'akasanka399@gmail.com'` et `email_verified: false` tentant de lire ou écrire `/administrators`.
11. **Altération des logs d'audit**: Administrateur tentant de supprimer ou modifier un document dans `/admin_audit_logs/{logId}`.
12. **Lecteur stats écrivant une réponse support**: Utilisateur avec rôle `stats_reader` tentant de modifier `/apps/digisolia-pos/support/tk1`.
