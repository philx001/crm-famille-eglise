# 🌟 Gestion des Nouvelles Âmes et Évangélisation - Spécifications

**Date :** Janvier 2026
**Version :** 1.0
**Statut :** Analyse complète - En attente d'implémentation

---

## 📋 Vue d'ensemble

Ce document détaille les fonctionnalités à ajouter à l'application CRM Famille pour gérer :
1. **Les nouvelles âmes** (personnes contactées via différents canaux)
2. **L'évangélisation** (planification, campagnes, suivi des contacts)
3. **Le suivi et l'accompagnement** (intégration, fidélisation)

---

## 📊 ANALYSE DE L'APPLICATION ACTUELLE

### Structure existante
- **Collections Firestore** : familles, utilisateurs, programmes, presences, notifications, sujets_priere, temoignages, documents
- **Rôles** : disciple, nouveau, mentor, adjoint_berger, berger, admin
- **Modules** : 12 fichiers JS (core, auth, pages, programmes, presences, statistiques, notifications, prière, documents, etc.)

### Points importants identifiés
1. Le rôle **"nouveau"** existe déjà mais n'est pas pleinement exploité
2. Le système de **programmes** et **présences** est déjà en place
3. Le système de **statistiques** peut être étendu
4. L'architecture modulaire facilite l'ajout de nouvelles fonctionnalités

---

## 🎯 OBJECTIFS

### Canaux d'acquisition des nouvelles âmes
1. **Évangélisation** : Personnes contactées dans la rue ou lors de programmes d'évangélisation
2. **Cultes du dimanche** : Nouvelles âmes accueillies à l'issue des cultes
3. **Programmes d'exhortation** : Personnes venues aux programmes thématiques en semaine (lundi-samedi)

### Thématiques des programmes d'exhortation
- Défis des finances
- Santé
- Couple/Famille
- Travail/Affaires
- Émotionnel/Spirituel
- Autres

### Objectifs de suivi
- Suivre la présence/absence aux programmes hebdomadaires
- Calculer la fréquence et l'assiduité
- Identifier qui a contacté la personne initialement
- Assigner et suivre le mentor responsable
- Connaître les activités auxquelles ils participent
- Enregistrer les commentaires et défis/attentes
- Faciliter l'intégration dans les familles
- Identifier les personnes perdues (pourquoi et depuis quand)

---

## ✨ FONCTIONNALITÉS À AJOUTER

---

## 🎯 MODULE 1 : GESTION DES NOUVELLES ÂMES

### 1.1 Nouvelle collection Firestore : `nouvelles_ames`

**Structure de données :**

```javascript
{
  // Informations de base
  prenom: string,
  nom: string,
  telephone: string,
  email: string | null,
  sexe: "M" | "F" | null,
  date_naissance: Timestamp | null,
  adresse_ville: string | null,
  adresse_quartier: string | null,

  // Origine du contact
  canal_acquisition: "evangelisation" | "culte_dimanche" | "programme_exhortation",
  date_premier_contact: Timestamp,
  lieu_premier_contact: string | null,

  // Pour programme d'exhortation uniquement
  thematique_exhortation: "finances" | "sante" | "couple_famille" | "travail_affaires" | "emotionnel_spirituel" | "autres" | null,

  // Suivi
  contact_par_id: string, // ID de la personne qui a contacté
  contact_par_nom: string, // Nom complet pour affichage
  suivi_par_id: string | null, // ID du mentor assigné pour le suivi
  suivi_par_nom: string | null,

  // Défis et attentes
  defis_attentes: string | null,
  commentaires: string | null,

  // Statut
  statut: "nouveau_contact" | "en_cours_integration" | "integre" | "inactif" | "perdu",
  date_dernier_contact: Timestamp | null,
  date_integration_famille: Timestamp | null, // Quand il rejoint une famille
  famille_id_integre: string | null, // Si intégré dans une famille
  utilisateur_id: string | null, // Si converti en membre utilisateur

  // Métadonnées
  famille_id: string,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

**Statuts expliqués :**
- `nouveau_contact` : Première prise de contact, pas encore de suivi régulier
- `en_cours_integration` : En cours d'accompagnement, vient régulièrement
- `integre` : A rejoint officiellement une famille et est devenu membre
- `inactif` : N'est plus venu depuis un certain temps
- `perdu` : Contact perdu définitivement

---

### 1.2 Nouvelle collection : `suivi_nouvelles_ames`

**Pour tracer toutes les interactions avec chaque nouvelle âme :**

```javascript
{
  nouvelle_ame_id: string,
  type_contact: "appel" | "visite" | "message" | "rencontre_eglise" | "autre",
  date_contact: Timestamp,
  effectue_par_id: string,
  effectue_par_nom: string,
  notes: string | null,
  prochaine_action: string | null,
  date_prochaine_action: Timestamp | null,
  famille_id: string,
  created_at: Timestamp
}
```

**Utilité :**
- Garder un historique complet des interactions
- Planifier les prochaines actions
- Mesurer l'engagement de l'équipe de suivi
- Identifier les nouvelles âmes sans suivi récent

---

### 1.3 Extension de la collection `presences`

**Modification de la structure existante :**

```javascript
{
  programme_id: string,

  // MODIFICATION : Rendre disciple_id nullable et ajouter nouvelle_ame_id
  disciple_id: string | null, // Ancien : obligatoire, Nouveau : optionnel
  nouvelle_ame_id: string | null, // NOUVEAU CHAMP

  mentor_id: string,
  statut: "present" | "absent" | "excuse" | "non_renseigne",
  commentaire: string | null,
  date_pointage: Timestamp,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

**Logique :**
- Soit `disciple_id` est renseigné (membre existant)
- Soit `nouvelle_ame_id` est renseigné (nouvelle âme)
- Les deux ne peuvent pas être renseignés en même temps

---

### 1.4 Nouveau fichier : `app-nouvelles-ames.js`

**Module complet pour la gestion des nouvelles âmes (~800 lignes)**

#### Objets principaux :

**1. NouvellesAmes**
```javascript
const NouvellesAmes = {
  // Charger toutes les nouvelles âmes de la famille
  async loadAll(),

  // Obtenir une nouvelle âme par ID
  getById(id),

  // Créer une nouvelle âme
  async create(data),

  // Modifier une nouvelle âme
  async update(id, data),

  // Supprimer une nouvelle âme (berger uniquement)
  async delete(id),

  // Filtrer par canal, statut, mentor
  filterBy(canal, statut, mentorId),

  // Obtenir les nouvelles âmes à relancer (sans contact depuis X jours)
  getToRelance(days = 7),

  // Convertir une nouvelle âme en membre utilisateur
  async convertToMembre(id),

  // Marquer comme intégré
  async markAsIntegre(id, familleId),

  // Marquer comme inactif/perdu
  async markAsInactif(id, raison),

  // Obtenir les canaux d'acquisition
  getCanaux(),

  // Obtenir les thématiques d'exhortation
  getThematiques(),

  // Obtenir les statuts
  getStatuts()
}
```

**2. SuiviNouvellesAmes**
```javascript
const SuiviNouvellesAmes = {
  // Charger l'historique de suivi d'une nouvelle âme
  async loadByNouvelleAme(nouvelleAmeId),

  // Ajouter une interaction
  async addInteraction(data),

  // Modifier une interaction
  async updateInteraction(id, data),

  // Supprimer une interaction
  async deleteInteraction(id),

  // Obtenir la dernière interaction
  getLastInteraction(nouvelleAmeId),

  // Obtenir les prochaines actions planifiées
  getProchaiinesActions()
}
```

**3. PagesNouvellesAmes**
```javascript
const PagesNouvellesAmes = {
  // Liste des nouvelles âmes
  renderNouvellesAmes(),

  // Fiche détaillée d'une nouvelle âme
  renderNouvelleAmeDetail(id),

  // Formulaire d'ajout
  renderAddNouvelleAme(),

  // Formulaire de modification
  renderEditNouvelleAme(id),

  // Formulaire d'ajout d'interaction
  renderAddInteraction(id),

  // Timeline des interactions
  renderTimelineInteractions(id),

  // Statistiques individuelles
  renderStatsNouvelleAme(id),

  // Export CSV
  exportNouvellesAmesCSV(),

  // Export PDF
  exportNouvellesAmesPDF()
}
```

---

### 1.5 Pages à créer

#### Page 1 : Liste des nouvelles âmes (`/nouvelles-ames`)

**Fonctionnalités :**
- Tableau avec colonnes : Nom, Téléphone, Canal, Statut, Dernière présence, Mentor, Actions
- Filtres :
  - Par canal d'acquisition (tous, évangélisation, culte, exhortation)
  - Par statut (tous, nouveau, en cours, intégré, inactif, perdu)
  - Par mentor assigné
- Recherche par nom/téléphone
- Badges colorés pour les statuts
- Indicateurs visuels :
  - 🔥 Assidu (présent 80%+)
  - ⚠️ Irrégulier (présent 30-80%)
  - 😴 Absent (présent <30%)
  - 🔔 À relancer (pas de contact depuis 7+ jours)
- Boutons :
  - "Ajouter une nouvelle âme"
  - "Exporter CSV"
  - "Exporter PDF"

**Design :**
```html
<div class="nouvelles-ames-header">
  <div class="filters">
    <select id="filter-canal">Tous les canaux</select>
    <select id="filter-statut">Tous les statuts</select>
    <select id="filter-mentor">Tous les mentors</select>
    <input type="search" placeholder="Rechercher...">
  </div>
  <div class="actions">
    <button class="btn btn-outline">CSV</button>
    <button class="btn btn-outline">PDF</button>
    <button class="btn btn-primary">+ Ajouter</button>
  </div>
</div>

<div class="card">
  <table class="table">
    <thead>
      <tr>
        <th>Nom</th>
        <th>Contact</th>
        <th>Canal</th>
        <th>Statut</th>
        <th>Assiduité</th>
        <th>Mentor</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <!-- Lignes de nouvelles âmes -->
    </tbody>
  </table>
</div>
```

---

#### Page 2 : Fiche nouvelle âme (`/nouvelle-ame-detail/:id`)

**Sections :**

**1. En-tête**
- Photo/Avatar avec initiales
- Nom complet
- Badge statut
- Boutons : Modifier, Ajouter interaction, Convertir en membre

**2. Informations personnelles**
- Téléphone, Email
- Date de naissance, Sexe
- Adresse (ville, quartier)

**3. Origine du contact**
- Canal d'acquisition (avec icône)
- Date du premier contact
- Lieu du premier contact
- Thématique (si exhortation)
- Contacté par (nom)

**4. Suivi**
- Mentor assigné (avec lien vers profil)
- Date du dernier contact
- Défis et attentes
- Commentaires généraux

**5. Statistiques de présence**
- Nombre de programmes auxquels il a participé
- Taux de présence global
- Graphique de présence mensuelle
- Liste des 10 dernières présences

**6. Timeline des interactions**
- Liste chronologique inversée
- Type de contact (icône)
- Date et auteur
- Notes
- Prochaine action planifiée

**7. Actions rapides**
- Enregistrer une nouvelle interaction
- Marquer comme intégré
- Marquer comme inactif/perdu
- Supprimer (berger uniquement)

---

#### Page 3 : Ajouter une nouvelle âme (`/nouvelles-ames-add`)

**Formulaire structuré en sections :**

**Section 1 : Informations de base**
- Prénom (requis)
- Nom (requis)
- Téléphone (requis)
- Email (optionnel)
- Sexe (optionnel)
- Date de naissance (optionnel)
- Ville (optionnel)
- Quartier (optionnel)

**Section 2 : Origine du contact**
- Canal d'acquisition (requis) : Radio buttons
  - 📢 Évangélisation
  - ⛪ Culte du dimanche
  - 🎯 Programme d'exhortation
- Date du premier contact (requis)
- Lieu du premier contact (optionnel)
- Thématique (si exhortation sélectionné)

**Section 3 : Suivi**
- Contacté par (auto-rempli : utilisateur actuel)
- Assigner un mentor pour le suivi (dropdown : liste des mentors)
- Défis et attentes (textarea)
- Commentaires (textarea)

**Boutons :**
- Annuler
- Enregistrer

---

#### Page 4 : Suivi nouvelle âme (`/nouvelle-ame-suivi/:id`)

**Formulaire d'interaction :**

- Nom de la nouvelle âme (lecture seule, en en-tête)
- Type de contact (requis)
  - 📞 Appel téléphonique
  - 🏠 Visite à domicile
  - 💬 Message (SMS/WhatsApp)
  - ⛪ Rencontre à l'église
  - 📝 Autre
- Date du contact (requis, par défaut : aujourd'hui)
- Notes (textarea, requis)
- Prochaine action (textarea, optionnel)
- Date de la prochaine action (date, optionnel)

**Boutons :**
- Annuler
- Enregistrer l'interaction

**Après enregistrement :**
- Message de succès
- Redirection vers la fiche de la nouvelle âme
- L'interaction apparaît dans la timeline

---

## 📢 MODULE 2 : GESTION DE L'ÉVANGÉLISATION

### 2.1 Nouvelle collection : `campagnes_evangelisation`

**Planification des sorties d'évangélisation :**

```javascript
{
  nom: string, // Ex: "Évangélisation Quartier Nord - Semaine 5"
  date_campagne: Timestamp,
  heure_debut: string, // Ex: "14:00"
  heure_fin: string | null, // Ex: "17:00"
  type: "evangelisation_rue" | "porte_a_porte" | "evenement_special" | "autre",
  secteur: string, // Ex: "Quartier Nord", "Centre-ville", etc.
  lieu_rendez_vous: string | null, // Point de rassemblement

  famille_id: string,
  responsable_id: string,
  responsable_nom: string,

  // Liste des participants
  membres_planifies: [
    {
      membre_id: string,
      membre_nom: string,
      role_campagne: "responsable" | "participant",
      confirme: boolean // A confirmé sa participation
    }
  ],

  objectifs: string | null, // Objectifs de la campagne
  nb_contacts_cible: number | null, // Nombre de contacts visés

  statut: "planifie" | "en_cours" | "termine" | "annule",

  // Résultats (rempli après la campagne)
  nb_contacts_etablis: number | null,
  nb_nouvelles_ames_ajoutees: number | null,
  rapport: string | null,

  created_at: Timestamp,
  updated_at: Timestamp
}
```

---

### 2.2 Nouvelle collection : `contacts_evangelisation`

**Contacts établis lors des campagnes :**

```javascript
{
  campagne_id: string,
  nouvelle_ame_id: string | null, // Lien vers nouvelles_ames si converti

  // Informations de contact (peuvent être partielles)
  prenom: string | null,
  nom: string | null,
  telephone: string | null,
  email: string | null,
  sexe: "M" | "F" | null,

  // Détails du contact
  date_contact: Timestamp,
  lieu_contact: string, // Adresse approximative ou nom de lieu
  secteur: string,
  contacte_par_id: string,
  contacte_par_nom: string,

  // Évaluation du contact
  niveau_interet: "tres_interesse" | "interesse" | "neutre" | "peu_interesse",
  accepte_visite: boolean,
  accepte_contact: boolean,
  besoins_exprimes: string | null,
  commentaires: string | null,

  // Suivi du contact
  statut_suivi: "a_recontacter" | "contacte" | "converti_nouvelle_ame" | "perdu",
  date_dernier_suivi: Timestamp | null,
  notes_suivi: string | null,

  famille_id: string,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

**Workflow :**
1. Contact établi → Statut "a_recontacter"
2. Suivi effectué → Statut "contacte"
3. Si intéressé → Conversion en "nouvelle_ame" → Statut "converti_nouvelle_ame"
4. Si pas intéressé → Statut "perdu"

---

### 2.3 Nouveau fichier : `app-evangelisation.js`

**Module complet pour l'évangélisation (~600 lignes)**

#### Objets principaux :

**1. CampagnesEvangelisation**
```javascript
const CampagnesEvangelisation = {
  // Charger toutes les campagnes
  async loadAll(),

  // Obtenir une campagne par ID
  getById(id),

  // Créer une campagne
  async create(data),

  // Modifier une campagne
  async update(id, data),

  // Supprimer une campagne
  async delete(id),

  // Ajouter un participant
  async addParticipant(campagneId, membreId),

  // Retirer un participant
  async removeParticipant(campagneId, membreId),

  // Confirmer participation
  async confirmerParticipation(campagneId, membreId),

  // Démarrer une campagne
  async startCampagne(id),

  // Terminer une campagne
  async endCampagne(id, rapport),

  // Annuler une campagne
  async cancelCampagne(id),

  // Obtenir les campagnes à venir
  getUpcoming(limit = 5),

  // Obtenir les campagnes par secteur
  getBySecteur(secteur),

  // Statistiques d'une campagne
  getStats(id)
}
```

**2. ContactsEvangelisation**
```javascript
const ContactsEvangelisation = {
  // Charger les contacts d'une campagne
  async loadByCampagne(campagneId),

  // Charger tous les contacts
  async loadAll(),

  // Ajouter un contact
  async create(data),

  // Modifier un contact
  async update(id, data),

  // Supprimer un contact
  async delete(id),

  // Ajouter un suivi
  async addSuivi(contactId, notes),

  // Convertir en nouvelle âme
  async convertToNouvelleAme(contactId),

  // Marquer comme perdu
  async markAsPerdu(contactId),

  // Filtrer par statut
  filterByStatut(statut),

  // Obtenir les contacts à recontacter
  getToRecontacter(),

  // Statistiques globales
  getGlobalStats()
}
```

**3. PagesEvangelisation**
```javascript
const PagesEvangelisation = {
  // Calendrier des campagnes
  renderCalendrier(),

  // Liste des campagnes
  renderCampagnes(),

  // Détail d'une campagne
  renderCampagneDetail(id),

  // Formulaire de création de campagne
  renderCreateCampagne(),

  // Formulaire de modification
  renderEditCampagne(id),

  // Vue "Campagne en cours" (mobile-friendly pour le terrain)
  renderCampagneEnCours(id),

  // Formulaire d'ajout rapide de contact (terrain)
  renderAddContactRapide(campagneId),

  // Liste des contacts
  renderContacts(),

  // Détail d'un contact
  renderContactDetail(id),

  // Statistiques évangélisation
  renderStatistiques(),

  // Export rapports
  exportRapportCampagne(id)
}
```

---

### 2.4 Pages à créer

#### Page 1 : Calendrier évangélisation (`/evangelisation/calendrier`)

**Vue similaire au calendrier des programmes, mais pour les campagnes**

**Fonctionnalités :**
- Calendrier mensuel
- Campagnes affichées par date
- Code couleur par type de campagne
- Clic sur une campagne → Détail
- Bouton "Planifier une campagne"

---

#### Page 2 : Planifier une campagne (`/evangelisation/planifier`)

**Formulaire :**

**Section 1 : Informations générales**
- Nom de la campagne (requis)
- Date (requis)
- Heure de début (requis)
- Heure de fin (optionnel)
- Type (requis)
  - 🚶 Évangélisation de rue
  - 🏠 Porte-à-porte
  - 🎉 Événement spécial
  - 📝 Autre
- Secteur géographique (requis)
- Lieu de rendez-vous (optionnel)

**Section 2 : Équipe**
- Responsable (dropdown : mentors/bergers)
- Ajouter des participants (multi-select : tous les membres)
- Liste des participants ajoutés avec rôle

**Section 3 : Objectifs**
- Objectifs de la campagne (textarea)
- Nombre de contacts cible (number)

**Boutons :**
- Annuler
- Enregistrer et planifier

---

#### Page 3 : Campagne en cours (`/evangelisation/campagne/:id`)

**Vue optimisée pour le terrain (mobile-friendly)**

**En-tête :**
- Nom de la campagne
- Date, heure, secteur
- Badge statut (planifié, en cours, terminé)

**Section 1 : Équipe présente**
- Liste des participants avec case à cocher "Présent"

**Section 2 : Compteurs en temps réel**
- 👥 Contacts établis : 12
- ⭐ Très intéressés : 5
- 🏠 Visites acceptées : 8
- 🌟 Nouvelles âmes ajoutées : 3

**Section 3 : Formulaire rapide**
**Bouton géant : "+ Ajouter un contact"**

**Formulaire simplifié qui s'ouvre en modal :**
- Prénom (optionnel)
- Nom (optionnel)
- Téléphone (requis si nom vide)
- Niveau d'intérêt (boutons rapides : 😍 / 🙂 / 😐 / 😕)
- Accepte visite ? (Oui/Non)
- Accepte contact ? (Oui/Non)
- Lieu du contact (auto-rempli avec secteur, modifiable)
- Commentaires rapides (textarea courte)

**Bouton :** Enregistrer et fermer

**Liste des contacts ajoutés aujourd'hui**
- Affichage en cartes
- Nom/Téléphone
- Niveau d'intérêt (emoji)
- Boutons : Voir / Modifier / Supprimer

**Boutons d'action :**
- Démarrer la campagne (si planifiée)
- Terminer la campagne (si en cours)
- Annuler la campagne

---

#### Page 4 : Contacts établis (`/evangelisation/contacts`)

**Liste de tous les contacts**

**Filtres :**
- Par campagne
- Par secteur
- Par statut (à recontacter, contacté, converti, perdu)
- Par niveau d'intérêt
- Par date

**Tableau :**
- Colonnes : Nom, Téléphone, Campagne, Secteur, Intérêt, Statut, Actions

**Actions par ligne :**
- 👁️ Voir
- 📞 Ajouter suivi
- ⭐ Convertir en nouvelle âme
- ❌ Marquer comme perdu

**Boutons globaux :**
- Export CSV
- Export PDF

---

#### Page 5 : Statistiques évangélisation (`/evangelisation/statistiques`)

**Vue tableau de bord avec graphiques**

**Section 1 : Vue d'ensemble**
- 📊 Nombre total de campagnes
- 👥 Total de contacts établis
- 🌟 Total de nouvelles âmes converties
- 📈 Taux de conversion (contacts → nouvelles âmes)

**Section 2 : Graphiques**
- Évolution du nombre de campagnes par mois (barres)
- Évolution du nombre de contacts par mois (courbe)
- Répartition des contacts par secteur (camembert)
- Répartition par niveau d'intérêt (barres empilées)

**Section 3 : Statistiques par campagne**
- Tableau avec toutes les campagnes
- Colonnes : Date, Nom, Secteur, Participants, Contacts, Conversions, Taux

**Section 4 : Statistiques par membre**
- Classement des membres par nombre de contacts établis
- Classement par taux de conversion
- Tableau : Nom, Campagnes, Contacts, Conversions, Taux

**Section 5 : Statistiques par secteur**
- Tableau des secteurs géographiques
- Nombre de campagnes par secteur
- Nombre de contacts par secteur
- Taux de conversion par secteur

---

## 📊 MODULE 3 : EXTENSIONS DU SYSTÈME EXISTANT

### 3.1 Extension du tableau de bord (app-main.js)

**Nouvelles cartes statistiques dans le dashboard :**

```javascript
// Carte 1 : Nouvelles âmes
<div class="stat-card" onclick="App.navigate('nouvelles-ames')">
  <div class="stat-icon" style="background: #FF9800">
    <i class="fas fa-user-plus"></i>
  </div>
  <div class="stat-content">
    <div class="stat-value">${stats.nouvellesAmes.total}</div>
    <div class="stat-label">Nouvelles âmes</div>
  </div>
</div>

// Carte 2 : À relancer
<div class="stat-card alert" onclick="App.navigate('nouvelles-ames')">
  <div class="stat-icon" style="background: #F44336">
    <i class="fas fa-bell"></i>
  </div>
  <div class="stat-content">
    <div class="stat-value">${stats.nouvellesAmes.aRelancer}</div>
    <div class="stat-label">À relancer</div>
  </div>
</div>

// Carte 3 : Prochaines campagnes
<div class="stat-card" onclick="App.navigate('evangelisation/calendrier')">
  <div class="stat-icon" style="background: #2196F3">
    <i class="fas fa-calendar-check"></i>
  </div>
  <div class="stat-content">
    <div class="stat-value">${stats.evangelisation.prochaines}</div>
    <div class="stat-label">Campagnes à venir</div>
  </div>
</div>
```

**Nouvelle section : Alertes nouvelles âmes**

```javascript
if (alertesNouvellesAmes.length > 0) {
  `<div class="alert alert-warning">
    <i class="fas fa-user-clock"></i>
    <div class="alert-content">
      <div class="alert-title">🔔 Nouvelles âmes à relancer</div>
      <p>${alertesNouvellesAmes.length} nouvelle(s) âme(s) sans contact depuis 7+ jours</p>
      <ul>
        ${alertesNouvellesAmes.slice(0, 5).map(na => `
          <li>${na.prenom} ${na.nom} - Dernier contact : ${Utils.formatRelativeDate(na.date_dernier_contact)}</li>
        `).join('')}
      </ul>
      <button onclick="App.navigate('nouvelles-ames')">Voir toutes</button>
    </div>
  </div>`
}
```

---

### 3.2 Extension du module présences (app-presences.js)

**Modifications à apporter :**

**1. Permettre le pointage des nouvelles âmes**

```javascript
// Dans PagesPresences.renderPresences()
async renderPresences(programmeId) {
  // ... code existant ...

  // AJOUT : Charger aussi les nouvelles âmes
  const nouvellesAmes = await NouvellesAmes.loadAll();
  const nouvellesAmesActives = nouvellesAmes.filter(na =>
    na.statut !== 'integre' && na.statut !== 'perdu'
  );

  // Combiner membres et nouvelles âmes
  const tousLesParticipants = [
    ...membres.map(m => ({ type: 'membre', data: m })),
    ...nouvellesAmesActives.map(na => ({ type: 'nouvelle_ame', data: na }))
  ];

  // Afficher dans la liste de pointage
  // ...
}
```

**2. Adapter l'enregistrement des présences**

```javascript
// Dans Presences.saveForProgramme()
async saveForProgramme(programmeId, presencesData) {
  // ...
  for (const presence of presencesData) {
    const ref = db.collection('presences').doc();
    batch.set(ref, {
      programme_id: programmeId,
      disciple_id: presence.type === 'membre' ? presence.id : null,
      nouvelle_ame_id: presence.type === 'nouvelle_ame' ? presence.id : null,
      mentor_id: AppState.user.id,
      statut: presence.statut,
      // ...
    });
  }
  // ...
}
```

**3. Affichage différencié dans la liste**

```javascript
// Badge pour distinguer les nouvelles âmes des membres
renderPresenceRow(presence, index) {
  return `
    <div class="presence-row">
      <div class="presence-membre">
        <div class="member-avatar">...</div>
        <div>
          <div class="member-name">${nom}</div>
          ${presence.type === 'nouvelle_ame' ?
            '<span class="badge badge-warning">Nouvelle âme</span>' :
            '<span class="badge badge-disciple">Membre</span>'
          }
        </div>
      </div>
      <!-- ... -->
    </div>
  `;
}
```

---

### 3.3 Extension du module statistiques (app-statistiques.js)

**Ajout de deux nouveaux onglets :**

#### Onglet 1 : Statistiques Nouvelles Âmes

**Contenu :**

**1. Graphique évolution**
- Nombre de nouvelles âmes par mois (6 derniers mois)
- Courbe avec barres empilées par statut

**2. Répartition par canal d'acquisition**
- Graphique camembert
- Évangélisation : X (XX%)
- Culte dimanche : X (XX%)
- Programmes exhortation : X (XX%)

**3. Tableau des nouvelles âmes**
- Colonnes : Nom, Canal, Statut, Présences, Taux, Mentor
- Tri par taux de présence décroissant
- Filtres actifs

**4. Statistiques d'intégration**
- Nombre total de nouvelles âmes intégrées
- Temps moyen avant intégration (en jours)
- Taux d'intégration global

**5. Top mentors**
- Classement des mentors par nombre de nouvelles âmes suivies
- Classement par taux d'intégration

---

#### Onglet 2 : Statistiques Évangélisation

**Contenu :**

**1. Vue d'ensemble**
- Total campagnes cette année
- Total contacts établis
- Total nouvelles âmes converties
- Taux de conversion global

**2. Performance par secteur**
- Tableau : Secteur, Campagnes, Contacts, Conversions, Taux
- Carte de chaleur (si possible)

**3. Performance par membre**
- Classement des évangélistes
- Tableau : Nom, Campagnes, Contacts, Conversions, Taux

**4. Évolution mensuelle**
- Graphique courbe : campagnes, contacts, conversions par mois
- Graphique taux de conversion mensuel

**5. Analyse par type de campagne**
- Répartition : rue, porte-à-porte, événement
- Taux de conversion par type

---

### 3.4 Extension du module notifications (app-notifications.js)

**Nouvelles alertes automatiques à générer :**

**1. Nouvelle âme sans contact depuis 7 jours**
```javascript
async checkNouvellesAmesSansContact() {
  const nouvellesAmes = await NouvellesAmes.loadAll();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const aRelancer = nouvellesAmes.filter(na => {
    const lastContact = na.date_dernier_contact?.toDate() || na.created_at.toDate();
    return lastContact < sevenDaysAgo &&
           na.statut !== 'integre' &&
           na.statut !== 'perdu';
  });

  if (aRelancer.length > 0) {
    await Notifications.create({
      contenu: `${aRelancer.length} nouvelle(s) âme(s) à relancer (pas de contact depuis 7+ jours)`,
      priorite: 'important',
      type: 'alerte_nouvelles_ames'
    });
  }
}
```

**2. Nouvelle âme absente 2 fois consécutives**
```javascript
async checkAbsencesConsecutives() {
  // Logique pour détecter les absences répétées
  // Créer une notification pour le mentor assigné
}
```

**3. Contact évangélisation à recontacter**
```javascript
async checkContactsARecontacter() {
  const contacts = await ContactsEvangelisation.getToRecontacter();

  if (contacts.length > 0) {
    await Notifications.create({
      contenu: `${contacts.length} contact(s) d'évangélisation à recontacter`,
      priorite: 'a_noter',
      type: 'alerte_evangelisation'
    });
  }
}
```

**4. Campagne d'évangélisation dans 2 jours**
```javascript
async checkCampagnesAVenir() {
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const campagnes = await CampagnesEvangelisation.getUpcoming();

  const campagnesProches = campagnes.filter(c => {
    const date = c.date_campagne.toDate();
    return date <= twoDaysFromNow;
  });

  for (const campagne of campagnesProches) {
    await Notifications.create({
      contenu: `Campagne "${campagne.nom}" dans 2 jours (${campagne.secteur})`,
      priorite: 'important',
      type: 'rappel_campagne'
    });
  }
}
```

---

### 3.5 Types de programmes à ajouter (app-programmes.js)

**Dans `Programmes.getTypes()`, ajouter :**

```javascript
getTypes() {
  return [
    // Types existants...
    { value: 'culte_dimanche', label: 'Culte du dimanche', color: '#2196F3' },
    { value: 'temps_partage_lundi', label: 'Temps de partage du lundi', color: '#4CAF50' },
    // ... autres types existants ...

    // NOUVEAUX TYPES - Programmes d'exhortation
    { value: 'exhortation_finances', label: 'Exhortation - Défis Finances', color: '#4CAF50' },
    { value: 'exhortation_sante', label: 'Exhortation - Santé', color: '#03A9F4' },
    { value: 'exhortation_couple', label: 'Exhortation - Couple/Famille', color: '#E91E63' },
    { value: 'exhortation_travail', label: 'Exhortation - Travail/Affaires', color: '#FF9800' },
    { value: 'exhortation_emotionnel', label: 'Exhortation - Émotionnel/Spirituel', color: '#9C27B0' },
    { value: 'exhortation_autres', label: 'Exhortation - Autres', color: '#607D8B' }
  ];
}
```

**Utilité :**
- Permet de créer des programmes spécifiques pour chaque thématique
- Les nouvelles âmes peuvent être pointées à ces programmes
- Statistiques par type de programme d'exhortation

---

## 🔐 MODULE 4 : PERMISSIONS ET RÈGLES

### 4.1 Nouvelles permissions (app-auth.js)

**Ajouter dans l'objet `Permissions` :**

```javascript
const Permissions = {
  // ... permissions existantes ...

  // NOUVELLES PERMISSIONS

  // Gérer les nouvelles âmes (créer, modifier, voir toutes)
  canManageNouvellesAmes() {
    return this.hasRole('mentor');
  },

  // Voir toutes les nouvelles âmes (pas seulement celles qu'on suit)
  canViewAllNouvellesAmes() {
    return this.hasRole('berger');
  },

  // Convertir une nouvelle âme en membre
  canConvertNouvelleAme() {
    return this.hasRole('adjoint_berger');
  },

  // Gérer l'évangélisation (campagnes)
  canManageEvangelisation() {
    return this.hasRole('adjoint_berger');
  },

  // Ajouter un contact d'évangélisation (tous les membres)
  canAddContactEvangelisation() {
    return this.hasRole('disciple'); // Tous les membres
  },

  // Voir les statistiques d'évangélisation
  canViewStatsEvangelisation() {
    return this.hasRole('mentor');
  }
};
```

---

### 4.2 Règles Firestore à ajouter

**Fichier `firestore.rules` - Sections à ajouter :**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ... règles existantes ...

    // ========================================
    // NOUVELLES ÂMES
    // ========================================
    match /nouvelles_ames/{nouvelleAmeId} {
      // Lecture : Mentor+ de la même famille
      allow read: if isAuthenticated() &&
                     isMentor() &&
                     resource.data.famille_id == getUserFamilleId();

      // Création : Mentor+ de la famille
      allow create: if isAuthenticated() &&
                       isMentor() &&
                       request.resource.data.famille_id == getUserFamilleId();

      // Modification : Mentor+ de la famille
      allow update: if isAuthenticated() &&
                       isMentor() &&
                       resource.data.famille_id == getUserFamilleId();

      // Suppression : Berger uniquement
      allow delete: if isAuthenticated() &&
                       isBerger() &&
                       resource.data.famille_id == getUserFamilleId();
    }

    // ========================================
    // SUIVI NOUVELLES ÂMES
    // ========================================
    match /suivi_nouvelles_ames/{suiviId} {
      // Lecture : Mentor+ de la famille
      allow read: if isAuthenticated() &&
                     isMentor() &&
                     resource.data.famille_id == getUserFamilleId();

      // Création : Mentor+ de la famille
      allow create: if isAuthenticated() &&
                       isMentor() &&
                       request.resource.data.famille_id == getUserFamilleId() &&
                       request.resource.data.effectue_par_id == request.auth.uid;

      // Modification : Créateur ou Berger
      allow update: if isAuthenticated() &&
                       (resource.data.effectue_par_id == request.auth.uid || isBerger()) &&
                       resource.data.famille_id == getUserFamilleId();

      // Suppression : Créateur ou Berger
      allow delete: if isAuthenticated() &&
                       (resource.data.effectue_par_id == request.auth.uid || isBerger()) &&
                       resource.data.famille_id == getUserFamilleId();
    }

    // ========================================
    // CAMPAGNES ÉVANGÉLISATION
    // ========================================
    match /campagnes_evangelisation/{campagneId} {
      // Lecture : Tous les membres de la famille
      allow read: if isAuthenticated() &&
                     resource.data.famille_id == getUserFamilleId();

      // Création : Adjoint_berger+
      allow create: if isAuthenticated() &&
                       isAdjointBerger() &&
                       request.resource.data.famille_id == getUserFamilleId();

      // Modification : Adjoint_berger+
      allow update: if isAuthenticated() &&
                       isAdjointBerger() &&
                       resource.data.famille_id == getUserFamilleId();

      // Suppression : Berger uniquement
      allow delete: if isAuthenticated() &&
                       isBerger() &&
                       resource.data.famille_id == getUserFamilleId();
    }

    // ========================================
    // CONTACTS ÉVANGÉLISATION
    // ========================================
    match /contacts_evangelisation/{contactId} {
      // Lecture : Tous les membres de la famille
      allow read: if isAuthenticated() &&
                     resource.data.famille_id == getUserFamilleId();

      // Création : Tous les membres de la famille
      allow create: if isAuthenticated() &&
                       request.resource.data.famille_id == getUserFamilleId() &&
                       request.resource.data.contacte_par_id == request.auth.uid;

      // Modification : Créateur ou Adjoint_berger+
      allow update: if isAuthenticated() &&
                       (resource.data.contacte_par_id == request.auth.uid || isAdjointBerger()) &&
                       resource.data.famille_id == getUserFamilleId();

      // Suppression : Berger uniquement
      allow delete: if isAuthenticated() &&
                       isBerger() &&
                       resource.data.famille_id == getUserFamilleId();
    }

    // ========================================
    // HELPER FUNCTIONS (à ajouter si pas déjà présentes)
    // ========================================
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserFamilleId() {
      return get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.famille_id;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data.role;
    }

    function isMentor() {
      let role = getUserRole();
      return role == 'mentor' || role == 'adjoint_berger' || role == 'berger' || role == 'admin';
    }

    function isAdjointBerger() {
      let role = getUserRole();
      return role == 'adjoint_berger' || role == 'berger' || role == 'admin';
    }

    function isBerger() {
      let role = getUserRole();
      return role == 'berger' || role == 'admin';
    }
  }
}
```

---

## 🎨 MODULE 5 : INTERFACE UTILISATEUR

### 5.1 Nouvelle section dans la sidebar (app-pages.js)

**Modifier `App.renderLayout()` pour ajouter :**

```javascript
<div class="nav-section">
  <div class="nav-section-title">Évangélisation</div>
  <div class="nav-item ${AppState.currentPage === 'nouvelles-ames' ? 'active' : ''}"
       onclick="App.navigate('nouvelles-ames')">
    <i class="fas fa-user-plus"></i>
    <span>Nouvelles âmes</span>
    ${alertesNouvellesAmes > 0 ? `<span class="nav-badge">${alertesNouvellesAmes}</span>` : ''}
  </div>

  ${Permissions.canManageEvangelisation() ? `
  <div class="nav-item ${AppState.currentPage === 'evangelisation-calendrier' ? 'active' : ''}"
       onclick="App.navigate('evangelisation-calendrier')">
    <i class="fas fa-calendar-alt"></i>
    <span>Campagnes</span>
  </div>
  ` : ''}

  <div class="nav-item ${AppState.currentPage === 'evangelisation-contacts' ? 'active' : ''}"
       onclick="App.navigate('evangelisation-contacts')">
    <i class="fas fa-address-book"></i>
    <span>Contacts</span>
  </div>

  ${Permissions.canViewStatsEvangelisation() ? `
  <div class="nav-item ${AppState.currentPage === 'evangelisation-stats' ? 'active' : ''}"
       onclick="App.navigate('evangelisation-stats')">
    <i class="fas fa-chart-line"></i>
    <span>Stats évangé.</span>
  </div>
  ` : ''}
</div>
```

**Style pour le badge de notification :**

```css
.nav-badge {
  background: var(--danger);
  color: white;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: auto;
}
```

---

### 5.2 Nouvelles couleurs de badges (styles.css)

**Ajouter dans `styles.css` :**

```css
/* Badges pour statuts nouvelles âmes */
.badge-nouveau_contact {
  background: #2196F3;
  color: white;
}

.badge-en_cours_integration {
  background: #FF9800;
  color: white;
}

.badge-integre {
  background: #4CAF50;
  color: white;
}

.badge-inactif {
  background: #9E9E9E;
  color: white;
}

.badge-perdu {
  background: #F44336;
  color: white;
}

/* Badges pour canaux d'acquisition */
.badge-canal {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.badge-canal-evangelisation {
  background: #E3F2FD;
  color: #1976D2;
}

.badge-canal-culte {
  background: #F3E5F5;
  color: #7B1FA2;
}

.badge-canal-exhortation {
  background: #FFF3E0;
  color: #E65100;
}

/* Indicateurs d'assiduité */
.badge-assiduite {
  font-size: 1rem;
  cursor: help;
}

.badge-assiduite-haute::before {
  content: "🔥";
}

.badge-assiduite-moyenne::before {
  content: "⚠️";
}

.badge-assiduite-faible::before {
  content: "😴";
}

.badge-alerte-relance {
  background: #FFEBEE;
  color: #C62828;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-alerte-relance::before {
  content: "🔔 ";
}
```

---

### 5.3 Nouveaux composants UI

**1. Carte de nouvelle âme (pour la liste)**

```css
.nouvelle-ame-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: white;
  transition: all 0.2s;
  margin-bottom: var(--spacing-sm);
}

.nouvelle-ame-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.nouvelle-ame-card.alerte {
  border-left: 4px solid var(--danger);
}

.nouvelle-ame-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.2rem;
  color: white;
  flex-shrink: 0;
}

.nouvelle-ame-info {
  flex: 1;
  min-width: 0;
}

.nouvelle-ame-name {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 4px;
}

.nouvelle-ame-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.nouvelle-ame-actions {
  display: flex;
  gap: var(--spacing-xs);
}
```

**2. Timeline des interactions**

```css
.timeline {
  position: relative;
  padding-left: var(--spacing-xl);
}

.timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-color);
}

.timeline-item {
  position: relative;
  padding-bottom: var(--spacing-lg);
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -26px;
  top: 5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  border: 2px solid white;
  box-shadow: 0 0 0 2px var(--primary);
}

.timeline-date {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: var(--spacing-xs);
}

.timeline-content {
  background: var(--bg-secondary);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
}

.timeline-type {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
}

.timeline-type i {
  color: var(--primary);
}

.timeline-notes {
  margin: var(--spacing-sm) 0;
  line-height: 1.5;
}

.timeline-author {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
}
```

**3. Cartes de campagne**

```css
.campagne-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  background: white;
  margin-bottom: var(--spacing-md);
  transition: all 0.2s;
}

.campagne-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.campagne-card.en-cours {
  border-left: 4px solid #4CAF50;
}

.campagne-card.terminee {
  opacity: 0.7;
}

.campagne-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: var(--spacing-md);
}

.campagne-title {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: var(--spacing-xs);
}

.campagne-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
}

.campagne-meta-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.campagne-participants {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.participant-badge {
  background: var(--bg-primary);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.campagne-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
}

.campagne-stat {
  text-align: center;
}

.campagne-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.campagne-stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}
```

---

## 📝 RÉSUMÉ DES FICHIERS À CRÉER/MODIFIER

### ✅ Nouveaux fichiers à créer (2)

1. **app-nouvelles-ames.js** (~800 lignes)
   - Objets : NouvellesAmes, SuiviNouvellesAmes, PagesNouvellesAmes
   - Fonctions CRUD pour nouvelles âmes
   - Suivi des interactions
   - Pages de liste, détail, ajout, suivi
   - Export CSV/PDF

2. **app-evangelisation.js** (~600 lignes)
   - Objets : CampagnesEvangelisation, ContactsEvangelisation, PagesEvangelisation
   - Gestion des campagnes
   - Enregistrement des contacts
   - Pages calendrier, campagne, contacts
   - Statistiques

---

### ✏️ Fichiers existants à modifier (8)

1. **index.html**
   - Ajouter les scripts app-nouvelles-ames.js et app-evangelisation.js
   - Ordre de chargement : après app-presences.js, avant app-main.js

2. **app-core.js**
   - Ajouter utilitaires pour nouvelles âmes si nécessaire
   - Fonctions de formatage de dates, calculs d'assiduité

3. **app-auth.js**
   - Ajouter nouvelles permissions (section 4.1)
   - canManageNouvellesAmes(), canManageEvangelisation(), etc.

4. **app-main.js**
   - Ajouter routes dans App.navigate() et App.render()
   - Ajouter cartes statistiques au dashboard
   - Ajouter alertes nouvelles âmes

5. **app-pages.js**
   - Étendre renderLayout() pour ajouter section sidebar "Évangélisation"
   - Ajouter badge de notification pour alertes

6. **app-programmes.js**
   - Ajouter 6 nouveaux types de programmes d'exhortation (section 3.5)

7. **app-presences.js**
   - Modifier pour supporter le pointage des nouvelles âmes
   - Champs disciple_id et nouvelle_ame_id (section 3.2)

8. **app-statistiques.js**
   - Ajouter onglet "Nouvelles âmes" (section 3.3)
   - Ajouter onglet "Évangélisation" (section 3.3)

9. **styles.css**
   - Ajouter nouveaux badges (section 5.2)
   - Ajouter composants UI (section 5.3)

---

### 🗄️ Nouveaux documents Firestore (4 collections)

1. **nouvelles_ames** (section 1.1)
2. **suivi_nouvelles_ames** (section 1.2)
3. **campagnes_evangelisation** (section 2.1)
4. **contacts_evangelisation** (section 2.2)

---

### 🔐 Règles Firestore à mettre à jour

**Fichier : firestore.rules**
- Ajouter règles pour les 4 nouvelles collections (section 4.2)
- Ajouter fonctions helper si nécessaire

---

## 🎯 FONCTIONNALITÉS DÉTAILLÉES PAR MODULE

### 📊 Module Nouvelles Âmes (14 fonctionnalités)

| # | Fonctionnalité | Description | Priorité |
|---|----------------|-------------|----------|
| 1 | Enregistrer nouvelle âme | Formulaire complet avec tous les champs | Haute |
| 2 | Liste avec filtres | Canal, statut, mentor | Haute |
| 3 | Fiche détaillée | Toutes infos + statistiques | Haute |
| 4 | Historique présences | Liste de tous les programmes | Haute |
| 5 | Enregistrer interaction | Appel, visite, message, etc. | Haute |
| 6 | Timeline interactions | Vue chronologique | Moyenne |
| 7 | Défis/attentes | Champ texte libre | Moyenne |
| 8 | Modifier infos | Formulaire d'édition | Haute |
| 9 | Assigner/changer mentor | Dropdown de sélection | Haute |
| 10 | Convertir en membre | Processus d'intégration | Moyenne |
| 11 | Marquer inactif/perdu | Changement de statut | Moyenne |
| 12 | Export CSV/PDF | Liste complète | Basse |
| 13 | Statistiques individuelles | Taux présence, fréquence | Moyenne |
| 14 | Alertes relance | Notifications automatiques | Haute |

---

### 📢 Module Évangélisation (12 fonctionnalités)

| # | Fonctionnalité | Description | Priorité |
|---|----------------|-------------|----------|
| 1 | Créer campagne | Planification complète | Haute |
| 2 | Assigner membres | Multi-select participants | Haute |
| 3 | Définir secteurs | Zones géographiques | Moyenne |
| 4 | Enregistrer contact | Formulaire rapide terrain | Haute |
| 5 | Liste contacts | Avec filtres et recherche | Haute |
| 6 | Fiche contact | Infos partielles, suivi | Moyenne |
| 7 | Suivi contact | Notes de relance | Haute |
| 8 | Convertir en nouvelle âme | Processus de conversion | Haute |
| 9 | Marquer perdu | Changement de statut | Basse |
| 10 | Stats par campagne | Résultats détaillés | Moyenne |
| 11 | Stats par secteur | Performance géographique | Basse |
| 12 | Export rapports | PDF/CSV | Basse |

---

### 📈 Module Statistiques & Suivi (8 fonctionnalités)

| # | Fonctionnalité | Description | Priorité |
|---|----------------|-------------|----------|
| 1 | Dashboard nouvelles âmes | Cartes statistiques | Haute |
| 2 | Alertes relance | Notifications dashboard | Haute |
| 3 | Graphique évolution | Courbe mensuelle | Moyenne |
| 4 | Répartition canal | Camembert | Basse |
| 5 | Taux assiduité | Par nouvelle âme | Moyenne |
| 6 | Temps avant intégration | Moyenne en jours | Basse |
| 7 | Taux de conversion | Contacts → Nouvelles âmes | Moyenne |
| 8 | Classement membres | Évangélistes actifs | Basse |

---

## 🚀 ESTIMATION & PLANIFICATION

### Effort estimé

- **Collections Firestore** : 4 nouvelles → 2h configuration + règles
- **Nouveaux fichiers JS** : 2 fichiers (~1400 lignes) → 16h développement
- **Fichiers à modifier** : 8 fichiers (~800 lignes ajouts) → 12h développement
- **Nouvelles pages** : 12 pages → 20h développement + design
- **Tests et debugging** : 10h
- **Documentation** : 4h

**TOTAL ESTIMÉ : 64 heures de développement**

---

### Plan de développement recommandé

#### Phase 1 : Fondations (16h)
1. Créer les 4 collections Firestore
2. Configurer les règles de sécurité
3. Créer app-nouvelles-ames.js (structure de base)
4. Créer app-evangelisation.js (structure de base)
5. Ajouter permissions dans app-auth.js
6. Tests basiques

#### Phase 2 : Module Nouvelles Âmes (20h)
1. CRUD nouvelles âmes
2. Page liste avec filtres
3. Page fiche détaillée
4. Suivi des interactions
5. Timeline
6. Intégration avec présences
7. Tests fonctionnels

#### Phase 3 : Module Évangélisation (16h)
1. CRUD campagnes
2. CRUD contacts
3. Pages calendrier et campagnes
4. Formulaire rapide terrain
5. Conversion contacts → nouvelles âmes
6. Tests fonctionnels

#### Phase 4 : Extensions & UI (8h)
1. Dashboard : nouvelles cartes
2. Statistiques étendues
3. Alertes automatiques
4. Types de programmes d'exhortation
5. Styles et composants UI

#### Phase 5 : Tests & Documentation (4h)
1. Tests d'intégration complets
2. Tests des permissions
3. Validation des règles Firestore
4. Documentation utilisateur
5. Guide de déploiement

---

## 📋 CHECKLIST DE VALIDATION

### Avant de commencer
- [ ] Backup de la base de données Firestore actuelle
- [ ] Backup du code source (commit Git)
- [ ] Environnement de développement configuré
- [ ] Accès aux règles Firestore

### Nouvelles âmes
- [ ] Collection nouvelles_ames créée
- [ ] Collection suivi_nouvelles_ames créée
- [ ] Règles Firestore publiées et testées
- [ ] Page liste nouvelles âmes fonctionnelle
- [ ] Filtres opérationnels
- [ ] Fiche détaillée complète
- [ ] Formulaire d'ajout validé
- [ ] Suivi des interactions fonctionnel
- [ ] Timeline affichée correctement
- [ ] Conversion en membre testée
- [ ] Export CSV/PDF fonctionnel
- [ ] Permissions vérifiées par rôle

### Évangélisation
- [ ] Collection campagnes_evangelisation créée
- [ ] Collection contacts_evangelisation créée
- [ ] Règles Firestore publiées
- [ ] Page calendrier campagnes fonctionnelle
- [ ] Création de campagne validée
- [ ] Assignment de participants testé
- [ ] Formulaire contact rapide (terrain)
- [ ] Liste des contacts opérationnelle
- [ ] Conversion contact → nouvelle âme testée
- [ ] Export rapports fonctionnel

### Extensions
- [ ] Dashboard : nouvelles cartes affichées
- [ ] Alertes nouvelles âmes fonctionnelles
- [ ] Présences : nouvelles âmes pointables
- [ ] Statistiques : onglets ajoutés
- [ ] Types programmes exhortation ajoutés
- [ ] Sidebar : section évangélisation visible
- [ ] Badges colorés corrects
- [ ] Composants UI responsive

### Tests finaux
- [ ] Test par un Disciple (droits limités)
- [ ] Test par un Mentor (nouvelles âmes)
- [ ] Test par un Adjoint (campagnes)
- [ ] Test par un Berger (tout)
- [ ] Test mobile (campagne terrain)
- [ ] Test export tous formats
- [ ] Test notifications automatiques
- [ ] Test performance (>100 nouvelles âmes)

---

## 📌 NOTES IMPORTANTES

### Points d'attention

1. **Performance**
   - Les requêtes sur nouvelles âmes peuvent devenir lentes si > 500 entrées
   - Implémenter pagination si nécessaire
   - Utiliser des index Firestore appropriés

2. **UX Mobile**
   - Le formulaire "Campagne en cours" doit être ultra-rapide
   - Optimiser pour ajout contact en 1 minute max
   - Boutons larges pour usage sur le terrain

3. **Notifications**
   - Mettre en place un système de vérification régulière (quotidienne)
   - Ne pas spammer les utilisateurs
   - Grouper les alertes similaires

4. **Migration des données**
   - Si des "nouveaux" existent déjà dans utilisateurs, prévoir un script de migration
   - Proposer une conversion groupée

5. **Formation utilisateurs**
   - Prévoir un guide pour les nouveaux workflows
   - Vidéos courtes de démonstration
   - Session de formation pour les bergers

---

## 🔄 ÉVOLUTIONS FUTURES POSSIBLES

### Court terme (3-6 mois)
- Notifications push pour relances
- Application mobile native pour le terrain
- Import CSV de contacts évangélisation
- Intégration WhatsApp pour suivi

### Moyen terme (6-12 mois)
- Cartographie des secteurs (Google Maps)
- Statistiques prédictives (IA)
- Automatisation des relances
- Badges de "meilleur évangéliste"

### Long terme (12+ mois)
- Multi-église (coordination régionale)
- Tableau de bord national
- Formation en ligne intégrée
- API publique pour intégrations tierces

---

## 📞 SUPPORT & QUESTIONS

Pour toute question concernant cette spécification :
- Relire les sections concernées
- Vérifier la cohérence avec l'architecture existante
- Consulter la documentation Firebase
- Tester sur un environnement de développement avant production

---

**Document créé le :** Janvier 2026
**Auteur :** Analyse Claude Code
**Version :** 1.0
**Statut :** ✅ Complet - Prêt pour implémentation

**Prochaine étape :** Validation du plan par l'équipe, puis début de la Phase 1.
