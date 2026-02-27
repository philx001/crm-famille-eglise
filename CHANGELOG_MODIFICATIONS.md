# Journal des modifications

Ce fichier recense les modifications apportées à l'application CRM Famille.

---

## Février 2025

### 1. Boutons de suppression (Programmes, Notifications, Prières, Témoignages)

**Objectif** : Permettre la suppression des contenus créés, avec cohérence des droits selon les rôles.

| Page | Bouton supprimer | Droits |
|------|------------------|--------|
| **Programmes** | Sur les cartes et sur la page détail | Superviseur ou Admin uniquement (`canDeletePrograms`) |
| **Notifications** | Sur les cartes | Auteur OU Adjoint superviseur OU Admin |
| **Sujets de prière** | Sur les cartes | Auteur OU Admin |
| **Témoignages** | Sur les cartes | Auteur OU Admin |

**Fichiers modifiés** :
- `app-auth.js` : ajout de `canDeletePrograms()`
- `app-programmes.js` : boutons conditionnés par `canDeletePrograms()`, `Programmes.delete()` utilise la permission
- `app-main.js` : vérification dans `deleteProgramme()`
- `app-notifications.js` : bouton supprimer sur les cartes (déjà existant)
- `app-priere.js` : boutons supprimer sur les cartes prière et témoignage

---

### 2. Droits de l'adjoint superviseur (affectation des mentors)

**Objectif** : L'adjoint superviseur doit pouvoir affecter un nouveau membre à n'importe quel mentor (y compris le superviseur), et réaffecter les disciples existants.

**Modifications** :
- **Nouvelle permission** `canAssignToAnyMentor()` : Adjoint superviseur, Superviseur, Admin
- **Formulaire d'ajout de membre** : le menu Mentor affiche désormais tous les mentors possibles (y compris superviseur, adjoint) pour l'adjoint superviseur
- **Réaffectation** : `canReassignMentor()` étendu pour inclure l'adjoint superviseur

**Fichiers modifiés** :
- `app-auth.js` : `canAssignToAnyMentor()`, `canReassignMentor()` mis à jour
- `app-pages.js` : utilisation de `getPossibleMentorsForReassign()` et `canAssignToAnyMentor` dans `renderAddMembre()`

---

### 3. Planning des conducteurs de prière

**Objectif** : Planifier les conducteurs de prière pour chaque temps de prière, avec un calendrier indépendant de celui de la sidebar.

**Fonctionnalités** :
- **Onglet « Planning conducteurs »** sur la page Prière
- **Vue calendrier mensuel** : grille avec créneaux par jour (heure + 1 ou 2 conducteurs)
- **Vue liste hebdomadaire** : liste des créneaux avec navigation semaine précédente/suivante
- **Modal ajout/édition** : date, heure, titre, lien optionnel vers un programme de prière, conducteur 1 et 2 (recherche par nom parmi tous les membres)
- **Récurrence** : création de créneaux uniques ou récurrents (2, 4, 8, 12 semaines)
- **Affichage** : « Conducteur à Désigner » si aucun nom n'est inscrit

**Permissions** :
- **Écriture** (créer, modifier, supprimer) : Adjoint superviseur, Superviseur, Admin
- **Lecture seule** : Disciple, Nouveau, Mentor

**Données** :
- Nouvelle collection Firestore : `planning_conducteurs_priere`
- Champs : `famille_id`, `date`, `heure_debut`, `heure_fin`, `titre`, `programme_id` (optionnel), `conducteur1_id`, `conducteur1_nom`, `conducteur2_id`, `conducteur2_nom`

**Fichiers modifiés** :
- `firestore.rules` : règles pour `planning_conducteurs_priere`
- `app-auth.js` : `canManagePlanningConducteurs()`
- `app-programmes.js` : `getTypesPriere()` pour la liaison aux programmes
- `app-priere.js` : module `PlanningConducteurs`, vues calendrier/liste, modals

**Déploiement** : exécuter `firebase deploy --only firestore:rules` pour appliquer les nouvelles règles.

---

### 4. Scripts et fichiers sensibles

**Exclusions Git** (dans `scripts/.gitignore`) :
- `serviceAccountKey.json` : clé Firebase Admin SDK
- `*adminsdk*.json` : fichiers de clés Firebase
- `membres-a-garder.txt` : liste d'emails (données sensibles)

---

## Résumé des permissions ajoutées ou modifiées

| Permission | Rôles | Usage |
|------------|-------|-------|
| `canDeletePrograms()` | Superviseur, Admin | Suppression de programmes |
| `canAssignToAnyMentor()` | Adjoint superviseur, Superviseur, Admin | Affectation d'un nouveau membre à n'importe quel mentor |
| `canManagePlanningConducteurs()` | Adjoint superviseur, Superviseur, Admin | Création/modification/suppression du planning conducteurs de prière |
