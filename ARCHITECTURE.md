# 🏗️ Architecture de l'application CRM Famille

**Version :** 3.0  
**Date :** Janvier 2025

---

## 📋 Vue d'ensemble

Application web SPA (Single Page Application) vanilla JavaScript utilisant Firebase comme backend.

- **Frontend :** HTML/CSS/JS vanilla (pas de framework)
- **Backend :** Firebase (Auth, Firestore, Storage)
- **Rendu :** Template literals injectés dans le DOM
- **État :** Objet global `AppState`
- **Routing :** Manuel via `App.navigate()`

---

## 📁 Structure des fichiers

### Ordre de chargement (index.html)

```html
1. Firebase SDK (compat mode)
   - firebase-app-compat.js
   - firebase-auth-compat.js
   - firebase-firestore-compat.js
   - firebase-storage-compat.js

2. Configuration Firebase
   - firebase-config.js (définit auth, db, storage)

3. Core (utilitaires de base)
   - app-core.js (AppState, Utils, Toast, Modal, InactivityManager, ErrorHandler)

4. Authentification et permissions
   - app-auth.js (Auth, Permissions, Membres)

5. Pages principales
   - app-pages.js (Pages : login, membres, profil, annuaire)

6. Modules métier
   - app-programmes.js (Programmes, Presences, PagesCalendrier, PagesPresences)
   - app-statistiques.js (Statistiques, PagesStatistiques)
   - app-pdf-export.js (PDFExport)
   - app-notifications.js (Notifications, PagesNotifications)
   - app-priere.js (SujetsPriere, Temoignages, PagesPriere, PagesTemoignages)
   - app-documents.js (Documents, PagesDocuments)

7. Application principale (routing, layout)
   - app-main.js (App : init, navigate, render, dashboard)
```

**⚠️ IMPORTANT :** L'ordre de chargement est critique. Ne pas modifier l'ordre dans `index.html`.

---

## 🔗 Dépendances entre modules

```
firebase-config.js
    ↓ (définit auth, db, storage)
app-core.js
    ↓ (définit AppState, Utils, Toast, Modal, ErrorHandler)
app-auth.js
    ↓ (utilise AppState, Utils, Toast, ErrorHandler)
app-pages.js
    ↓ (utilise AppState, Utils, Toast, Modal, Permissions, Membres)
app-programmes.js
    ↓ (utilise AppState, Utils, Toast, Permissions, Membres)
app-statistiques.js
    ↓ (utilise AppState, Utils, Programmes, Presences, Membres)
app-notifications.js
    ↓ (utilise AppState, Utils, Toast, Permissions)
app-priere.js
    ↓ (utilise AppState, Utils, Toast, Permissions)
app-documents.js
    ↓ (utilise AppState, Utils, Toast, Permissions, Storage)
app-main.js
    ↓ (utilise TOUS les modules ci-dessus)
```

---

## 🗄️ Structure de données Firestore

### Collections principales

#### `familles`
```javascript
{
  nom: string,              // "esperance" (lowercase)
  description: string,      // "Famille Espérance"
  statut: "actif" | "inactif",
  date_creation: Timestamp,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### `utilisateurs`
```javascript
{
  email: string,
  nom: string,
  prenom: string,
  famille_id: string,        // Référence vers familles
  mentor_id: string | null, // Référence vers utilisateurs
  role: "disciple" | "nouveau" | "mentor" | "adjoint_berger" | "berger" | "admin",
  statut_compte: "actif" | "inactif",
  sexe: "M" | "F" | null,
  date_naissance: Timestamp | null,
  telephone: string | null,
  adresse_ville: string | null,
  adresse_code_postal: string | null,
  date_arrivee_icc: Timestamp | null,
  formations: string[],
  ministere_service: string | null,
  baptise_immersion: boolean | null,
  profession: string | null,
  statut_professionnel: string | null,
  passions_centres_interet: string | null,
  derniere_connexion: Timestamp | null,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### `programmes`
```javascript
{
  nom: string,
  type: string,             // Voir Programmes.getTypes()
  date_debut: Timestamp,
  date_fin: Timestamp | null,
  lieu: string | null,
  recurrence: "unique" | "hebdomadaire" | "mensuel",
  description: string | null,
  famille_id: string,
  created_by: string,       // Référence vers utilisateurs
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### `presences`
```javascript
{
  programme_id: string,      // Référence vers programmes
  disciple_id: string,      // Référence vers utilisateurs
  mentor_id: string,        // Référence vers utilisateurs
  statut: "present" | "absent" | "excuse" | "non_renseigne",
  commentaire: string | null,
  date_pointage: Timestamp,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### `notifications`
```javascript
{
  contenu: string,
  priorite: "normal" | "important" | "urgent" | "critique",
  famille_id: string,
  auteur_id: string,
  auteur_prenom: string,
  created_at: Timestamp
}
```

#### `sujets_priere`
```javascript
{
  contenu: string,
  famille_id: string,
  auteur_id: string,
  auteur_prenom: string | null, // null si anonyme
  est_exauce: boolean,
  date_exaucement: Timestamp | null,
  created_at: Timestamp
}
```

#### `temoignages`
```javascript
{
  contenu: string,
  famille_id: string,
  auteur_id: string,
  auteur_nom_complet: string,
  created_at: Timestamp
}
```

#### `documents`
```javascript
{
  titre: string,
  description: string | null,
  categorie: string,        // Voir Documents.getCategories()
  visibilite: "tous" | "mentors_berger" | "berger_seul",
  fichier_url: string,      // URL Firebase Storage
  fichier_nom: string,
  fichier_type: string,
  fichier_taille: number,
  famille_id: string,
  uploaded_by: string,      // Référence vers utilisateurs
  created_at: Timestamp,
  updated_at: Timestamp
}
```

---

## 🔄 Flux de navigation

```
App.init()
    ↓
Auth.checkAuthState()
    ↓
Si connecté → App.loadAllData() → App.navigate('dashboard')
Si non connecté → App.showLoginPage()

App.navigate(page, params)
    ↓
App.render()
    ↓
Switch case → Génère pageContent
    ↓
App.renderLayout(pageTitle, pageContent)
    ↓
Injection dans #app
```

---

## 🔐 Système de permissions

### Hiérarchie des rôles

```
admin (niveau 5)
  ↓
berger (niveau 4)
  ↓
adjoint_berger (niveau 3)
  ↓
mentor (niveau 2)
  ↓
disciple / nouveau (niveau 1)
```

### Objet Permissions

Toutes les vérifications de permissions passent par `Permissions.*` :

- `hasRole(role)` : Vérifie si l'utilisateur a au moins le niveau du rôle
- `canViewAllMembers()` : Berger+
- `canAddDisciple()` : Mentor+
- `canMarkPresence(discipleId)` : Mentor (ses disciples) ou Berger (tous)
- `canViewStats()` : Mentor+
- `canManagePrograms()` : Adjoint_berger+
- `canManageDocuments()` : Adjoint_berger+
- `canEditMember(membreId)` : Soi-même ou Berger
- `isAdmin()` : Admin uniquement

---

## 🎨 État global (AppState)

```javascript
AppState = {
  user: Object | null,           // Utilisateur connecté
  famille: Object | null,        // Famille de l'utilisateur
  membres: Array,                 // Liste des membres de la famille
  programmes: Array,              // Liste des programmes
  currentPage: string,            // Page actuelle
  isLoading: boolean,            // État de chargement
  inactivityTimer: number | null, // Timer d'inactivité
  INACTIVITY_TIMEOUT: number     // 15 minutes
}
```

---

## 🛠️ Utilitaires (Utils)

- `getInitials(prenom, nom)` : Génère les initiales
- `formatDate(date, format)` : Formate une date
- `formatRelativeDate(date)` : Date relative ("Aujourd'hui", "Il y a 3 jours")
- `escapeHtml(text)` : Échappe le HTML pour éviter XSS
- `generateId()` : Génère un ID unique
- `isValidEmail(email)` : Valide un email
- `capitalize(str)` : Capitalise une chaîne
- `isBirthday(dateNaissance)` : Vérifie si c'est l'anniversaire
- `getRoleLabel(role)` : Libellé du rôle
- `getRoleLevel(role)` : Niveau hiérarchique du rôle

---

## 🚨 Gestion d'erreurs (ErrorHandler)

Nouveau module ajouté pour gérer les erreurs réseau et de session :

- `handle(error, context)` : Traite une erreur
- `showNetworkError()` : Affiche une erreur réseau avec bouton "Réessayer"
- `showSessionError()` : Affiche une erreur de session avec bouton "Se reconnecter"
- `wrap(promise, context)` : Wrapper pour promesses avec gestion d'erreur automatique

---

## 📝 Bonnes pratiques

1. **Toujours utiliser `Utils.escapeHtml()`** pour les données utilisateur dans le HTML
2. **Vérifier les permissions** avant d'afficher des actions (`Permissions.*`)
3. **Utiliser `ErrorHandler.wrap()`** pour les opérations Firebase critiques
4. **Ne pas modifier l'ordre** des scripts dans `index.html`
5. **Utiliser `Toast.*`** pour les retours utilisateur (pas `alert()`)
6. **Utiliser `App.showLoading() / hideLoading()`** pour les opérations longues

---

## 🔄 Évolutions futures possibles

- Migration vers un bundler (Vite, Webpack) pour gérer les dépendances
- Modularisation ES6 (import/export)
- Tests unitaires (Jest)
- Service Worker pour PWA
- Deep linking (URL par page)

---

**Document maintenu à jour avec l'évolution de l'application.**
