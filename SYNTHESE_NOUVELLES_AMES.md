# 📋 SYNTHÈSE - Module Nouvelles Âmes & Évangélisation

**Date de création :** 30 Janvier 2026  
**Basé sur :** Fusion optimisée de FONCTIONNALITES_NOUVELLES_AMES.md et PLAN_NOUVELLES_AMES.md  
**Objectif :** Intégration simple dans la structure existante du CRM Famille

---

## 🎯 RÉSUMÉ EXÉCUTIF

### Objectifs principaux
1. **Gérer les nouvelles âmes** contactées via 3 canaux : évangélisation, cultes, programmes d'exhortation
2. **Assurer le suivi personnalisé** de chaque personne jusqu'à son intégration
3. **Planifier et piloter l'évangélisation** par famille (sessions hebdomadaires, secteurs, contacts)
4. **Mesurer l'efficacité** via statistiques et rapports

### Ce qui ne change pas
- ✅ Architecture existante (SPA vanilla JS + Firebase)
- ✅ Collections Firestore existantes (familles, utilisateurs, programmes, presences, etc.)
- ✅ Système de rôles et permissions
- ✅ Modules JS existants
- ✅ Interface utilisateur actuelle

### Ce qui s'ajoute
- 4 nouvelles collections Firestore
- 2 nouveaux fichiers JavaScript
- 1 nouvelle section dans la sidebar
- Extensions mineures de fichiers existants

---

## 📦 NOUVELLES COLLECTIONS FIRESTORE (4)

### 1. `nouvelles_ames`
**Objectif :** Stocker les informations des personnes contactées

```javascript
{
  // Identité
  prenom: string,                    // Requis
  nom: string,                       // Requis
  telephone: string,                 // Requis
  email: string | null,
  sexe: "M" | "F" | null,
  date_naissance: Timestamp | null,
  adresse_ville: string | null,
  adresse_quartier: string | null,

  // Origine du contact
  canal: "evangelisation" | "culte" | "exhortation",
  thematique: string | null,         // Si canal = exhortation
  date_premier_contact: Timestamp,
  lieu_contact: string | null,
  contacte_par_id: string,           // userId
  contacte_par_nom: string,          // Pour affichage

  // Suivi
  suivi_par_id: string | null,       // Mentor assigné
  suivi_par_nom: string | null,
  statut: "nouveau" | "en_suivi" | "integre" | "inactif" | "perdu",
  date_dernier_contact: Timestamp | null,
  
  // Défis et attentes
  defis: string[],                   // ["finances", "sante", ...]
  commentaires: string | null,

  // Intégration
  date_integration: Timestamp | null,
  membre_id: string | null,          // Si converti en membre

  // Métadonnées
  famille_id: string,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

**Statuts :**
| Statut | Description |
|--------|-------------|
| `nouveau` | Premier contact, pas encore de suivi régulier |
| `en_suivi` | Accompagnement en cours, vient aux programmes |
| `integre` | Devenu membre officiel d'une famille |
| `inactif` | N'est plus venu depuis un moment |
| `perdu` | Contact définitivement perdu |

---

### 2. `suivis_ames`
**Objectif :** Tracer toutes les interactions avec chaque nouvelle âme

```javascript
{
  nouvelle_ame_id: string,
  type: "appel" | "visite" | "message" | "rencontre" | "autre",
  date_suivi: Timestamp,
  effectue_par_id: string,
  effectue_par_nom: string,
  notes: string,
  prochaine_action: string | null,
  date_prochaine_action: Timestamp | null,
  famille_id: string,
  created_at: Timestamp
}
```

---

### 3. `sessions_evangelisation`
**Objectif :** Planifier les sorties d'évangélisation hebdomadaires

```javascript
{
  nom: string,                       // Ex: "Évangélisation Quartier Nord"
  date: Timestamp,
  heure_debut: string,               // "14:00"
  heure_fin: string | null,
  secteur: string,                   // Zone géographique
  lieu_rdv: string | null,
  
  responsable_id: string,
  responsable_nom: string,
  participants: [{
    membre_id: string,
    membre_nom: string,
    confirme: boolean
  }],
  
  statut: "planifie" | "en_cours" | "termine" | "annule",
  nb_contacts: number,               // Résultat
  rapport: string | null,
  
  famille_id: string,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

---

### 4. `secteurs_evangelisation`
**Objectif :** Définir les zones géographiques d'évangélisation

```javascript
{
  nom: string,
  description: string | null,
  actif: boolean,
  famille_id: string,
  created_at: Timestamp
}
```

---

## 🆕 NOUVEAUX FICHIERS JAVASCRIPT (2)

### 1. `app-nouvelles-ames.js` (~600 lignes)

**Objets à créer :**

```javascript
// Gestion des données
const NouvellesAmes = {
  async loadAll(),              // Charger toutes les nouvelles âmes
  getById(id),                  // Obtenir par ID
  async create(data),           // Créer
  async update(id, data),       // Modifier
  async delete(id),             // Supprimer (berger)
  filterBy(canal, statut),      // Filtrer
  getARelancer(days = 7),       // Sans contact depuis X jours
  async convertToMembre(id),    // Convertir en membre
  getCanaux(),                  // Liste des canaux
  getThematiques(),             // Liste des thématiques
  getStatuts()                  // Liste des statuts
};

const SuivisAmes = {
  async loadByNouvelleAme(id),  // Historique d'une nouvelle âme
  async add(data),              // Ajouter interaction
  async update(id, data),       // Modifier
  async delete(id)              // Supprimer
};

// Pages
const PagesNouvellesAmes = {
  render(),                     // Liste avec filtres
  renderDetail(id),             // Fiche détaillée
  renderAdd(),                  // Formulaire ajout
  renderEdit(id),               // Formulaire modification
  renderAddSuivi(id),           // Formulaire interaction
  exportCSV(),                  // Export CSV
  exportPDF()                   // Export PDF
};
```

---

### 2. `app-evangelisation.js` (~400 lignes)

**Objets à créer :**

```javascript
// Gestion des données
const SessionsEvangelisation = {
  async loadAll(),
  getById(id),
  async create(data),
  async update(id, data),
  async delete(id),
  getUpcoming(limit = 5),       // Prochaines sessions
  async start(id),              // Démarrer session
  async end(id, rapport),       // Terminer session
  async addContact(sessionId, data)  // Ajouter contact
};

const Secteurs = {
  async loadAll(),
  async create(data),
  async update(id, data),
  async delete(id)
};

// Pages
const PagesEvangelisation = {
  renderCalendrier(),           // Vue calendrier
  renderSessions(),             // Liste sessions
  renderSessionDetail(id),      // Détail session
  renderAddSession(),           // Créer session
  renderAddContactRapide(id),   // Formulaire terrain
  renderSecteurs(),             // Gestion secteurs
  renderStats()                 // Statistiques
};
```

---

## ✏️ MODIFICATIONS DES FICHIERS EXISTANTS

### 1. `index.html`
**Ajouter les scripts (après app-presences.js, avant app-main.js) :**
```html
<script src="app-nouvelles-ames.js"></script>
<script src="app-evangelisation.js"></script>
```

---

### 2. `app-auth.js`
**Ajouter les permissions :**
```javascript
const Permissions = {
  // ... permissions existantes ...

  // NOUVELLES PERMISSIONS
  canManageNouvellesAmes() {
    return this.hasRole('mentor');
  },
  
  canViewAllNouvellesAmes() {
    return this.hasRole('berger');
  },
  
  canConvertNouvelleAme() {
    return this.hasRole('adjoint_berger');
  },
  
  canManageEvangelisation() {
    return this.hasRole('adjoint_berger');
  }
};
```

---

### 3. `app-main.js`
**Ajouter les routes dans `navigate()` et `render()` :**
```javascript
case 'nouvelles-ames': 
  pageTitle = 'Nouvelles âmes'; 
  pageContent = PagesNouvellesAmes.render(); 
  break;
case 'nouvelles-ames-add': 
  pageTitle = 'Ajouter une nouvelle âme'; 
  pageContent = PagesNouvellesAmes.renderAdd(); 
  break;
case 'nouvelle-ame-detail': 
  pageTitle = 'Fiche nouvelle âme'; 
  pageContent = PagesNouvellesAmes.renderDetail(this.currentParams.id); 
  break;
case 'evangelisation': 
  pageTitle = 'Évangélisation'; 
  pageContent = PagesEvangelisation.renderCalendrier(); 
  break;
case 'evangelisation-session': 
  pageTitle = 'Session d\'évangélisation'; 
  pageContent = PagesEvangelisation.renderSessionDetail(this.currentParams.id); 
  break;
```

**Ajouter dans la sidebar (section GESTION) :**
```javascript
${Permissions.canManageNouvellesAmes() ? `
<div class="nav-item ${AppState.currentPage === 'nouvelles-ames' ? 'active' : ''}" 
     onclick="App.navigate('nouvelles-ames')">
  <i class="fas fa-user-plus"></i>
  <span>Nouvelles âmes</span>
</div>
<div class="nav-item ${AppState.currentPage === 'evangelisation' ? 'active' : ''}" 
     onclick="App.navigate('evangelisation')">
  <i class="fas fa-bullhorn"></i>
  <span>Évangélisation</span>
</div>
` : ''}
```

**Ajouter au dashboard (cartes statistiques) :**
```javascript
// Après les cartes existantes
${Permissions.canManageNouvellesAmes() ? `
<div class="stat-card clickable" onclick="App.navigate('nouvelles-ames')">
  <div class="stat-icon" style="background: #FF9800"><i class="fas fa-user-plus"></i></div>
  <div class="stat-content">
    <div class="stat-value">${stats.nouvellesAmes || 0}</div>
    <div class="stat-label">Nouvelles âmes</div>
  </div>
</div>
` : ''}
```

---

### 4. `app-programmes.js`
**Ajouter les types de programmes d'exhortation :**
```javascript
getTypes() {
  return [
    // Types existants...
    { value: 'culte', label: 'Culte', color: '#9C27B0' },
    // ... autres types existants ...
    
    // NOUVEAUX TYPES
    { value: 'exhortation_finances', label: 'Exhortation - Finances', color: '#4CAF50' },
    { value: 'exhortation_sante', label: 'Exhortation - Santé', color: '#03A9F4' },
    { value: 'exhortation_couple', label: 'Exhortation - Couple/Famille', color: '#E91E63' },
    { value: 'exhortation_travail', label: 'Exhortation - Travail/Affaires', color: '#FF9800' },
    { value: 'exhortation_spirituel', label: 'Exhortation - Spirituel', color: '#9C27B0' },
    { value: 'exhortation_autre', label: 'Exhortation - Autre', color: '#607D8B' }
  ];
}
```

---

### 5. `styles.css`
**Ajouter les badges de statut :**
```css
/* Badges nouvelles âmes */
.badge-nouveau { background: #2196F3; color: white; }
.badge-en_suivi { background: #FF9800; color: white; }
.badge-integre { background: #4CAF50; color: white; }
.badge-inactif { background: #9E9E9E; color: white; }
.badge-perdu { background: #F44336; color: white; }

/* Badges canaux */
.badge-evangelisation { background: #E3F2FD; color: #1976D2; }
.badge-culte { background: #F3E5F5; color: #7B1FA2; }
.badge-exhortation { background: #FFF3E0; color: #E65100; }
```

---

### 6. `firestore-rules-complet.rules`
**Ajouter les règles pour les nouvelles collections :**
```javascript
// NOUVELLES ÂMES
match /nouvelles_ames/{docId} {
  allow read: if isAuthenticated() && hasRole('mentor') && 
              resource.data.famille_id == getUserData().famille_id;
  allow create: if isAuthenticated() && hasRole('mentor') && 
                request.resource.data.famille_id == getUserData().famille_id;
  allow update: if isAuthenticated() && hasRole('mentor') && 
                resource.data.famille_id == getUserData().famille_id;
  allow delete: if isAuthenticated() && hasRole('berger') && 
                resource.data.famille_id == getUserData().famille_id;
}

// SUIVIS AMES
match /suivis_ames/{docId} {
  allow read: if isAuthenticated() && hasRole('mentor');
  allow create: if isAuthenticated() && hasRole('mentor');
  allow update, delete: if isAuthenticated() && 
                        (resource.data.effectue_par_id == request.auth.uid || hasRole('berger'));
}

// SESSIONS ÉVANGÉLISATION
match /sessions_evangelisation/{docId} {
  allow read: if isAuthenticated() && 
              resource.data.famille_id == getUserData().famille_id;
  allow create, update: if isAuthenticated() && hasRole('adjoint_berger') && 
                        request.resource.data.famille_id == getUserData().famille_id;
  allow delete: if isAuthenticated() && hasRole('berger');
}

// SECTEURS
match /secteurs_evangelisation/{docId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAuthenticated() && hasRole('adjoint_berger');
}
```

---

## 🎯 PLAN D'IMPLÉMENTATION EN 5 SPRINTS

### 📌 Sprint 1 : Fondations Nouvelles Âmes (Priorité HAUTE)
**Durée estimée : 8h**

| # | Tâche | Fichier | Type |
|---|-------|---------|------|
| 1.1 | Créer collection `nouvelles_ames` | Firebase Console | Config |
| 1.2 | Créer collection `suivis_ames` | Firebase Console | Config |
| 1.3 | Ajouter règles Firestore | firestore-rules-complet.rules | Modif |
| 1.4 | Créer `app-nouvelles-ames.js` (structure) | Nouveau fichier | Création |
| 1.5 | Ajouter script dans index.html | index.html | Modif |
| 1.6 | Ajouter permissions | app-auth.js | Modif |
| 1.7 | Ajouter routes | app-main.js | Modif |
| 1.8 | Ajouter entrée sidebar | app-main.js | Modif |

**Livrable Sprint 1 :** Liste des nouvelles âmes (vide) + Formulaire d'ajout fonctionnel

---

### 📌 Sprint 2 : Module Nouvelles Âmes Complet (Priorité HAUTE)
**Durée estimée : 10h**

| # | Tâche | Description |
|---|-------|-------------|
| 2.1 | Page liste avec filtres | Par canal, statut, mentor |
| 2.2 | Formulaire d'ajout complet | Tous les champs |
| 2.3 | Fiche détaillée | Infos + historique |
| 2.4 | Formulaire de suivi | Ajouter interaction |
| 2.5 | Timeline des interactions | Vue chronologique |
| 2.6 | Export CSV/PDF | Liste complète |
| 2.7 | Badges CSS | Statuts et canaux |

**Livrable Sprint 2 :** Module nouvelles âmes 100% fonctionnel

---

### 📌 Sprint 3 : Module Évangélisation (Priorité MOYENNE)
**Durée estimée : 8h**

| # | Tâche | Description |
|---|-------|-------------|
| 3.1 | Créer collections Firestore | sessions_evangelisation, secteurs |
| 3.2 | Créer `app-evangelisation.js` | Structure complète |
| 3.3 | Vue calendrier sessions | Par semaine/mois |
| 3.4 | Formulaire planification | Créer session |
| 3.5 | Formulaire contact rapide | Mobile-friendly |
| 3.6 | Gestion des secteurs | CRUD basique |
| 3.7 | Bilan de session | Résumé et rapport |

**Livrable Sprint 3 :** Module évangélisation fonctionnel

---

### 📌 Sprint 4 : Programmes d'Exhortation (Priorité MOYENNE)
**Durée estimée : 4h**

| # | Tâche | Description |
|---|-------|-------------|
| 4.1 | Ajouter types de programmes | 6 thématiques d'exhortation |
| 4.2 | Formulaire d'accueil | Pour nouvelles âmes aux exhortations |
| 4.3 | Lien programme → nouvelle âme | Association automatique |

**Livrable Sprint 4 :** Types de programmes enrichis

---

### 📌 Sprint 5 : Dashboard & Statistiques (Priorité BASSE)
**Durée estimée : 6h**

| # | Tâche | Description |
|---|-------|-------------|
| 5.1 | Cartes dashboard | Nouvelles âmes, alertes |
| 5.2 | Alertes de relance | Sans contact depuis 7j |
| 5.3 | Stats nouvelles âmes | Par canal, taux intégration |
| 5.4 | Stats évangélisation | Par session, secteur, membre |
| 5.5 | Export rapports | PDF hebdomadaire |

**Livrable Sprint 5 :** Dashboard enrichi + statistiques complètes

---

## ✅ CHECKLIST DE VALIDATION PAR SPRINT

### Sprint 1
- [ ] Collections Firestore créées
- [ ] Règles de sécurité déployées et testées
- [ ] Script chargé sans erreur console
- [ ] Entrée "Nouvelles âmes" visible dans sidebar (pour Mentor+)
- [ ] Route /nouvelles-ames accessible

### Sprint 2
- [ ] Liste affiche les nouvelles âmes
- [ ] Filtres fonctionnels (canal, statut)
- [ ] Ajout d'une nouvelle âme OK
- [ ] Fiche détaillée complète
- [ ] Ajout d'interaction OK
- [ ] Timeline visible
- [ ] Export CSV/PDF fonctionnel

### Sprint 3
- [ ] Calendrier des sessions affiché
- [ ] Création de session OK
- [ ] Ajout de contacts pendant session OK
- [ ] Secteurs gérables
- [ ] Bilan de session enregistrable

### Sprint 4
- [ ] Nouveaux types de programmes visibles
- [ ] Création programme exhortation OK
- [ ] Lien avec nouvelles âmes fonctionnel

### Sprint 5
- [ ] Cartes dashboard nouvelles âmes
- [ ] Alertes de relance affichées
- [ ] Statistiques calculées correctement
- [ ] Exports fonctionnels

---

## 📊 THÉMATIQUES D'EXHORTATION

| Code | Label | Description | Couleur |
|------|-------|-------------|---------|
| `finances` | Défis Finances | Dettes, gestion financière | #4CAF50 |
| `sante` | Santé | Problèmes de santé, guérison | #03A9F4 |
| `couple` | Couple/Famille | Problèmes conjugaux, familiaux | #E91E63 |
| `travail` | Travail/Affaires | Chômage, difficultés professionnelles | #FF9800 |
| `spirituel` | Émotionnel/Spirituel | Dépression, recherche spirituelle | #9C27B0 |
| `autre` | Autre | Autres défis personnels | #607D8B |

---

## 🔐 MATRICE DES PERMISSIONS

| Action | Disciple | Mentor | Adjoint | Berger | Admin |
|--------|----------|--------|---------|--------|-------|
| Voir nouvelles âmes (ses suivis) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Voir toutes nouvelles âmes | ❌ | ❌ | ❌ | ✅ | ✅ |
| Ajouter nouvelle âme | ❌ | ✅ | ✅ | ✅ | ✅ |
| Modifier nouvelle âme | ❌ | ✅ | ✅ | ✅ | ✅ |
| Supprimer nouvelle âme | ❌ | ❌ | ❌ | ✅ | ✅ |
| Convertir en membre | ❌ | ❌ | ✅ | ✅ | ✅ |
| Gérer évangélisation | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ajouter contact terrain | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## 📝 NOTES IMPORTANTES

### Intégration non-destructive
- **Aucune collection existante n'est modifiée structurellement**
- Les nouvelles âmes ont leur propre collection (`nouvelles_ames`)
- Le système de présences existant reste intact
- La conversion en membre crée un nouveau document dans `utilisateurs`

### Points d'attention
1. **Performance** : Prévoir pagination si > 200 nouvelles âmes
2. **Mobile** : Formulaire contact terrain doit être rapide à utiliser
3. **Notifications** : Alertes de relance à vérifier quotidiennement
4. **Backup** : Faire un export avant chaque sprint

### Ordre de chargement des scripts
```
1. firebase-config.js
2. app-core.js
3. app-auth.js
4. app-pages.js
5. app-programmes.js
6. app-presences.js
7. app-nouvelles-ames.js    ← NOUVEAU
8. app-evangelisation.js    ← NOUVEAU
9. app-statistiques.js
10. app-notifications.js
11. app-priere.js
12. app-documents.js
13. app-pdf-export.js
14. app-main.js
```

---

## 🚀 PROCHAINE ÉTAPE

**Commencer le Sprint 1 :**
1. Créer les collections Firestore dans la console Firebase
2. Déployer les règles de sécurité
3. Créer le fichier `app-nouvelles-ames.js`
4. Ajouter les modifications minimales aux fichiers existants
5. Tester l'affichage de la page vide

---

**Document créé le :** 30/01/2026  
**Version :** 1.0  
**Statut :** ✅ Prêt pour implémentation
