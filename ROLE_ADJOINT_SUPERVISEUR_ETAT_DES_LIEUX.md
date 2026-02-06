# Rôle Adjoint superviseur – État des lieux et propositions

## 1. Tableau comparatif (état actuel)

| Critère | Superviseur | Adjoint superviseur |
|--------|-------------|---------------------|
| **Menu / Navigation** |
| Section « Administration » (Tous les membres, Archivage) | Oui | Non |
| Menu « Tous les membres » | Oui | Non |
| Menu « Archivage des membres » | Oui | Non |
| Annuaire, Calendrier, Programmes, Stats, Nouvelles âmes, Évangélisation, Documents, Notifications, Prière, Témoignages | Oui | Oui |
| Mes disciples (si mentor_id = adjoint) | Oui | Oui (vide sauf si des disciples lui sont affectés) |
| **Membres** |
| Voir la liste « Tous les membres » (page dédiée avec filtres, export) | Oui | Non |
| Voir l’Annuaire (liste des membres actifs) | Oui | Oui |
| Modifier un autre membre (profil, rôle, mentor) | Oui | Non (uniquement son propre profil) |
| Ajouter un disciple (bouton depuis Mes disciples / Membres) | Oui (hasRole mentor) | Oui (hasRole mentor) |
| Ajouter un « nouveau » (sans mentor) | Oui | Non |
| Bloquer / débloquer un membre | Oui | Non |
| Réaffecter un membre à un autre mentor | Oui | Non |
| Voir la page Archivage des membres | Oui | Non |
| **Programmes** |
| Créer / modifier un programme | Oui | Oui |
| Supprimer un programme | Oui | Non |
| **Présences** |
| Pointer les présences (pour qui ?) | Tous les membres actifs | Uniquement « ses » disciples (comportement mentor) |
| Supprimer une présence | Oui (Firestore) | Non |
| **Documents** |
| Voir / déposer / gérer les documents (modifier/supprimer les siens ou ceux des autres) | Oui | Oui |
| Voir les documents « Superviseur uniquement » | Oui | Non |
| **Nouvelles âmes** |
| Voir / ajouter / modifier les nouvelles âmes | Oui | Oui |
| Marquer « converti » (intégrer) une nouvelle âme | Oui | Oui |
| Supprimer une nouvelle âme | Oui | Non |
| **Évangélisation** |
| Voir / créer / modifier sessions et secteurs | Oui | Oui |
| Clôturer une session, etc. | Oui | Oui |
| **Notifications** |
| Modifier / supprimer les notifications (y compris créées par d’autres) | Oui (Firestore) | Oui (Firestore) |
| **Mon compte (profil)** |
| Exporter les données (JSON) – bouton dans Mon compte | Oui | Non |
| **Firestore (règles)** |
| Lire les utilisateurs de la famille | Oui | Oui (même famille) |
| Modifier / supprimer un utilisateur (autre que soi) | Oui | Non |
| Supprimer un programme | Oui | Non |
| Supprimer une présence | Oui | Non |
| Modifier/supprimer un document (uploaded_by ou adjoint+) | Oui | Oui |
| Modifier/supprimer une notification (auteur ou adjoint+) | Oui | Oui |

---

## 2. Synthèse du rôle adjoint aujourd’hui

- **Peut faire (opérationnel)** : gérer programmes (créer/modifier), gérer documents, gérer évangélisation, gérer nouvelles âmes (voir, ajouter, modifier, convertir), modifier/supprimer notifications. Il voit l’Annuaire comme tout le monde.
- **Ne peut pas faire (réservé superviseur)** : voir la page « Tous les membres », archivage, modifier un autre membre (rôle, mentor), ajouter un « nouveau », bloquer/archiver, réaffecter mentor, supprimer programme/nouvelle âme/présence, export JSON. En présences, il ne peut pointer que ses propres disciples (comportement mentor), pas toute la famille.

---

## 3. Propositions d’ajustements (sans rien modifier tant que vous n’avez pas validé)

Vos besoins : l’adjoint doit pouvoir **seconder le superviseur** (ajouter/supprimer certaines infos, programmes, membres…) mais **ne pas avoir accès à certaines informations trop personnelles**.

### 3.1 Accès « Tous les membres » en lecture seule (optionnel)

- **Proposition** : Donner à l’adjoint l’accès au **menu et à la page « Tous les membres »** en **lecture seule** (liste, filtres, pas d’export global, pas de modification de rôle/mentor, pas de blocage).
- **Intérêt** : Voir qui fait partie de la famille pour seconder (programmes, présences, nouvelles âmes) sans pouvoir modifier les comptes.
- **À ne pas donner** : boutons « Modifier », « Bloquer », « Réaffecter », « Ajouter un nouveau », export PDF/JSON de toute la liste.

### 3.2 Pointer les présences pour toute la famille

- **Proposition** : Autoriser l’adjoint à **pointer les présences pour tous les membres actifs** (comme le superviseur), pas seulement pour ses disciples.
- **Intérêt** : Décharge le superviseur pour le pointage des programmes sans donner la possibilité de supprimer des présences (rester superviseur seul pour la suppression).

### 3.3 Conserver les restrictions « sensibles »

- **Ne pas donner à l’adjoint** (reste réservé au superviseur) :
  - Modification du **rôle** ou du **mentor** d’un membre.
  - **Bloquer / archiver** un membre.
  - **Supprimer** une nouvelle âme, un programme, une présence.
  - **Ajouter un « nouveau »** (sans mentor).
  - Accès à la page **Archivage des membres**.
  - **Export global JSON** (Mon compte).
- **Données « trop personnelles »** : aujourd’hui, la page « Tous les membres » et le profil détaillé affichent les mêmes champs pour tous ceux qui y ont accès. Si vous souhaitez **masquer certains champs** pour l’adjoint (ex. téléphone, email, date de naissance, notes internes), on peut prévoir une **vue « adjoint »** qui cache ces champs sur la fiche membre et/ou sur la liste (à préciser selon les champs concernés).

### 3.4 Documents « Superviseur uniquement »

- **Actuel** : L’adjoint ne voit pas les documents dont la visibilité est « Superviseur uniquement ».
- **Proposition** : **Ne pas changer** : garder ces documents réservés au superviseur (et admin) pour les infos sensibles.

### 3.5 Récapitulatif des modifications proposées (à valider)

| Modification proposée | Oui / Non / À discuter |
|----------------------|-------------------------|
| Adjoint : accès page « Tous les membres » en **lecture seule** (sans modifier rôles, mentor, blocage, export global) |  |
| Adjoint : pointer les présences pour **tous les membres** (comme le superviseur) |  |
| Adjoint : masquer certains champs « personnels » sur les fiches membres (à lister) |  |
| Autre (préciser) |  |

---

Une fois que vous aurez coché et éventuellement précisé (notamment les champs à masquer pour l’adjoint), on pourra détailler les changements à faire dans le code et les règles Firestore **sans rien modifier** tant que vous n’avez pas validé.
