# 📋 Plan d'implémentation - Module Nouvelles Âmes & Évangélisation

**Date de création :** Janvier 2026  
**Basé sur :** Analyse de l'application CRM Famille existante

---

## 🎯 Objectifs

1. **Gestion des nouvelles âmes** : Suivre les personnes contactées via différents canaux (évangélisation, cultes, exhortations)
2. **Suivi personnalisé** : Accompagner chaque nouvelle âme jusqu'à son intégration dans une famille
3. **Gestion de l'évangélisation** : Planifier et suivre les sessions d'évangélisation hebdomadaires
4. **Statistiques** : Mesurer l'efficacité des actions et le taux de fidélisation

---

## 🔍 Analyse de l'existant

### Structure actuelle
| Élément | Description |
|---------|-------------|
| **Collections Firestore** | familles, utilisateurs, programmes, presences, documents, sujets_priere, temoignages, notifications |
| **Rôles** | disciple, nouveau, mentor, adjoint_berger, berger, admin |
| **Modules JS** | app-core, app-auth, app-pages, app-programmes, app-presences, app-statistiques, app-notifications, app-priere, app-documents, app-pdf-export |
| **Système de présences** | Lié aux programmes, pointage par membre |

### Points d'intégration identifiés
- Le rôle **"nouveau"** existe déjà mais n'est pas exploité
- Les **programmes** peuvent être étendus avec de nouveaux types
- Le système de **présences** peut être réutilisé

---

## 📦 Nouvelles collections Firestore

### 1. `nouvelles_ames` (contacts/prospects)
```javascript
{
  // Identité
  prenom: string,
  nom: string,
  telephone: string,
  email: string | null,
  sexe: "M" | "F" | null,
  
  // Origine du contact
  origine: "evangelisation" | "culte" | "exhortation",
  sous_origine: string | null,        // Secteur, thématique, etc.
  thematique_exhortation: string | null, // "finances", "sante", "couple", "travail", "emotionnel", "autre"
  
  // Premier contact
  date_premier_contact: Timestamp,
  lieu_contact: string | null,
  contacte_par: string,               // userId du membre qui a contacté
  
  // Suivi
  suivi_par: string | null,           // userId du membre qui suit
  statut: "nouveau" | "en_suivi" | "integre" | "perdu" | "inactif",
  famille_affectation: string | null, // familleId si intégré
  membre_id: string | null,           // userId si converti en membre
  
  // Défis/Attentes
  defis: string[],                    // ["finances", "sante", "famille", ...]
  attentes: string | null,
  
  // Métadonnées
  famille_id: string,                 // Famille qui gère ce contact
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 2. `suivis_ames` (historique des interactions)
```javascript
{
  nouvelle_ame_id: string,            // Référence vers nouvelles_ames
  type: "appel" | "visite" | "message" | "presence" | "relance" | "commentaire",
  contenu: string,
  resultat: string | null,            // "repondu", "absent", "interesse", etc.
  effectue_par: string,               // userId
  date_suivi: Timestamp,
  prochain_suivi: Timestamp | null,
  created_at: Timestamp
}
```

### 3. `sessions_evangelisation` (planification hebdomadaire)
```javascript
{
  semaine: string,                    // "2026-W05" (année-semaine)
  date_debut: Timestamp,
  date_fin: Timestamp,
  secteur: string,                    // Zone géographique
  lieu_rdv: string | null,
  heure_rdv: string | null,
  
  // Participants planifiés
  participants: string[],             // userIds
  responsable: string,                // userId
  
  // Résultats
  nb_contacts: number,
  statut: "planifie" | "en_cours" | "termine",
  commentaire: string | null,
  
  famille_id: string,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 4. `presences_ames` (présences des nouvelles âmes aux programmes)
```javascript
{
  nouvelle_ame_id: string,
  programme_id: string,
  statut: "present" | "absent" | "excuse",
  invite_par: string | null,          // userId
  commentaire: string | null,
  created_at: Timestamp
}
```

### 5. `secteurs_evangelisation` (zones géographiques)
```javascript
{
  nom: string,
  description: string | null,
  famille_id: string,
  actif: boolean,
  created_at: Timestamp
}
```

---

## 🆕 Nouveaux modules JavaScript à créer

| Fichier | Contenu |
|---------|---------|
| `app-evangelisation.js` | Gestion des sessions d'évangélisation, planification, secteurs |
| `app-nouvelles-ames.js` | CRUD nouvelles âmes, suivi, historique, statistiques |

---

## 📱 Nouvelles pages/fonctionnalités

### A. Module Nouvelles Âmes

| # | Fonctionnalité | Description | Complexité |
|---|----------------|-------------|------------|
| A1 | **Liste des nouvelles âmes** | Tableau filtrable par origine, statut, thématique, période | Moyenne |
| A2 | **Ajout nouvelle âme** | Formulaire avec origine, informations, défis | Faible |
| A3 | **Fiche détaillée** | Profil complet avec historique de suivi | Moyenne |
| A4 | **Suivi/Relance** | Ajouter un appel, visite, commentaire | Faible |
| A5 | **Pointage présence nouvelle âme** | Pointer si une nouvelle âme était présente à un programme | Moyenne |
| A6 | **Tableau de bord nouvelles âmes** | Statistiques : nb contacts, taux de présence, taux d'intégration | Moyenne |
| A7 | **Conversion en membre** | Transformer une nouvelle âme en membre (utilisateur) | Moyenne |
| A8 | **Alertes de suivi** | Rappels pour les nouvelles âmes sans contact depuis X jours | Faible |
| A9 | **Export CSV/PDF** | Exporter la liste des nouvelles âmes | Faible |

### B. Module Évangélisation

| # | Fonctionnalité | Description | Complexité |
|---|----------------|-------------|------------|
| B1 | **Calendrier évangélisation** | Vue hebdomadaire des sessions planifiées | Moyenne |
| B2 | **Planification session** | Créer une session : date, secteur, participants, lieu RDV | Moyenne |
| B3 | **Saisie contacts terrain** | Ajouter les contacts établis pendant une session | Faible |
| B4 | **Bilan de session** | Résumé : participants effectifs, nb contacts, observations | Faible |
| B5 | **Gestion des secteurs** | CRUD des secteurs d'évangélisation | Faible |
| B6 | **Statistiques évangélisation** | Nb contacts/semaine, par secteur, par participant, taux de conversion | Moyenne |
| B7 | **Export rapport hebdomadaire** | PDF avec résumé de la semaine d'évangélisation | Faible |

### C. Programmes d'exhortation

| # | Fonctionnalité | Description | Complexité |
|---|----------------|-------------|------------|
| C1 | **Nouveau type de programme** | Ajouter "exhortation" aux types de programmes | Faible |
| C2 | **Thématiques** | Gestion des thématiques (finances, santé, couple, travail, émotionnel, autre) | Faible |
| C3 | **Accueil spécifique** | Formulaire d'accueil pour les nouvelles âmes arrivant aux exhortations | Moyenne |

### D. Cultes (accueil dimanche)

| # | Fonctionnalité | Description | Complexité |
|---|----------------|-------------|------------|
| D1 | **Formulaire d'accueil** | Enregistrer les nouvelles personnes accueillies au culte | Faible |
| D2 | **Lien avec programmes** | Associer l'accueil au programme "culte" du dimanche | Faible |

---

## 🔄 Modifications des éléments existants

| Élément | Modification |
|---------|--------------|
| **Collection `programmes`** | Ajouter type "exhortation", champ "thematique" |
| **Collection `utilisateurs`** | Ajouter champ "origine_contact" (pour savoir d'où vient le membre) |
| **Sidebar (app-main.js)** | Ajouter sections "Nouvelles Âmes" et "Évangélisation" |
| **Dashboard** | Ajouter widgets : contacts récents, alertes de suivi, prochaines sessions |
| **Permissions** | Ajouter `canManageEvangelisation()`, `canManageNouvellesAmes()` |
| **Firestore Rules** | Ajouter règles pour nouvelles collections |

---

## 📊 Statistiques et rapports

| Statistique | Description |
|-------------|-------------|
| Nb nouvelles âmes par semaine/mois | Par origine (évangélisation, culte, exhortation) |
| Taux de présence nouvelles âmes | % de présence aux programmes |
| Taux de conversion | % de nouvelles âmes devenues membres |
| Durée moyenne de suivi | Temps entre premier contact et intégration |
| Performance par membre | Nb contacts, nb suivis, nb conversions par évangéliste |
| Performance par secteur | Nb contacts par secteur d'évangélisation |
| Thématiques populaires | Répartition par thématique d'exhortation |

---

## 🎯 Ordre d'implémentation recommandé

### Sprint 1 : Base nouvelles âmes
- [ ] A1 - Liste des nouvelles âmes
- [ ] A2 - Ajout nouvelle âme
- [ ] A3 - Fiche détaillée
- [ ] A4 - Suivi/Relance

### Sprint 2 : Évangélisation
- [ ] B1 - Calendrier évangélisation
- [ ] B2 - Planification session
- [ ] B3 - Saisie contacts terrain
- [ ] B5 - Gestion des secteurs

### Sprint 3 : Programmes spéciaux
- [ ] C1 - Type programme exhortation
- [ ] C2 - Thématiques
- [ ] D1 - Formulaire d'accueil culte

### Sprint 4 : Suivi avancé
- [ ] A5 - Pointage présence nouvelle âme
- [ ] A6 - Tableau de bord
- [ ] A7 - Conversion en membre
- [ ] A8 - Alertes de suivi

### Sprint 5 : Statistiques et rapports
- [ ] B6 - Statistiques évangélisation
- [ ] A9/B7 - Exports CSV/PDF

---

## 🗂️ Catégories d'origine détaillées

### Évangélisation
- Rue / Porte-à-porte
- Marchés / Places publiques
- Événements spéciaux
- Contacts via réseaux sociaux

### Cultes (Dimanche)
- Accueil première visite
- Invité par un membre
- Venu spontanément

### Programmes d'exhortation (Lundi-Samedi)
| Thématique | Description |
|------------|-------------|
| Finances | Défis financiers, dettes, gestion |
| Santé | Problèmes de santé, guérison |
| Couple/Famille | Problèmes conjugaux, familiaux |
| Travail/Affaires | Chômage, difficultés professionnelles |
| Émotionnel/Spirituel | Dépression, stress, recherche spirituelle |
| Autre | Autres défis personnels |

---

## 📝 Notes techniques

### Permissions suggérées
- `canViewNouvellesAmes()` : Mentor+
- `canAddNouvelleAme()` : Mentor+
- `canManageEvangelisation()` : Adjoint_berger+
- `canConvertNouvelleAme()` : Berger+

### Intégration avec l'existant
- Les nouvelles âmes peuvent être pointées sur les programmes existants
- Une nouvelle âme peut être convertie en membre (création dans `utilisateurs`)
- Les statistiques globales incluront les données des nouvelles âmes

---

**Document créé le :** 30/01/2026  
**Prochaine étape :** Implémentation du Sprint 1
