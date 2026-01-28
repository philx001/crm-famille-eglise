# 🔍 Audit complet – CRM Famille (Gestion des groupes de disciples)

**Date :** Janvier 2025  
**Version analysée :** 3.0 (Phases 1 à 4)

---

## 1. Structure du code

### 1.1 Architecture générale

| Élément | Détail |
|--------|--------|
| **Type** | SPA (Single Page Application) vanilla JS, sans framework |
| **Backend / Données** | Firebase (Auth, Firestore, Storage) |
| **Rendu** | HTML généré en chaînes (template literals), injection dans `#app` |
| **État** | Objet global `AppState` (user, famille, membres, programmes, currentPage) |
| **Routing** | Manuel via `App.navigate(page, params)` + `App.render()` |

**Chaîne de chargement (index.html) :**
1. Firebase SDK (compat)
2. `firebase-config.js`
3. `app-core.js` (AppState, Utils, Toast, Modal, InactivityManager)
4. `app-auth.js` (Auth, Permissions, Membres)
5. `app-pages.js` (Pages : login, membres, profil, annuaire)
6. `app-programmes.js` (Programmes, Presences, PagesCalendrier, PagesPresences)
7. `app-statistiques.js` (Statistiques, PagesStatistiques)
8. `app-pdf-export.js` (PDFExport)
9. `app-notifications.js` (Notifications, PagesNotifications)
10. `app-priere.js` (SujetsPriere, Temoignages, PagesPriere, PagesTemoignages)
11. `app-documents.js` (Documents, PagesDocuments)
12. `app-main.js` (App : init, routing, layout, dashboard)

**Volume de code (approx.) :**
- **JS :** ~5 500 lignes (12 fichiers)
- **CSS :** ~800+ lignes (styles.css)
- **HTML :** 1 fichier (index.html, squelette minimal)

### 1.2 Modèles de données (Firestore)

| Collection | Rôle principal |
|------------|----------------|
| `familles` | Familles (groupes) – nom, statut |
| `utilisateurs` | Membres – profil, rôle, mentor_id, famille_id |
| `programmes` | Événements – type, date, lieu, famille_id |
| `presences` | Pointage – programme_id, disciple_id, statut |
| `notifications` | Annonces – priorité, contenu, famille_id |
| `sujets_priere` | Sujets de prière – anonyme, exaucé |
| `temoignages` | Témoignages – auteur, contenu |
| `documents` | Fichiers – catégorie, visibilité, Storage URL |

### 1.3 Sécurité

- **Firestore :** Règles par collection (auth, rôles, famille_id).
- **Auth :** Email/mot de passe + nom de famille pour limiter l’accès à une famille.
- **Côté client :** Vérifications `Permissions.*` avant affichage/actions (complément des règles, pas remplacement).

---

## 2. Inventaire des fonctionnalités existantes

### 2.1 Authentification et identité

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Connexion email + mot de passe | ✅ | Avec nom de famille |
| Vérification famille active | ✅ | Requête Firestore |
| Mot de passe oublié | ✅ | `Auth.resetPassword` (email) |
| Déconnexion | ✅ | |
| Persistance de session | ✅ | Firebase Auth + localStorage (famille) |
| Déconnexion après inactivité | ✅ | 15 min, InactivityManager |
| Création de compte (membre) | ✅ | Par mentor, mot de passe temporaire affiché en console |

**Manques repérés :** Pas de changement de mot de passe dans l’app, pas de “Se souvenir de moi” explicite, pas de 2FA.

---

### 2.2 Gestion des membres

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Liste des membres (filtrée par rôle) | ✅ | Bergers : tous ; mentors : leurs disciples |
| Filtre recherche + rôle | ✅ | Côté client |
| Ajout membre (mentor+) | ✅ | Email, nom, prénom, rôle, mentor |
| Profil membre (lecture) | ✅ | Infos perso, spirituel, formations |
| Édition profil (soi-même ou berger) | ✅ | Membres.update |
| Désactivation membre (berger) | ✅ | statut_compte = inactif, pas de suppression physique |
| Annuaire avec recherche | ✅ | Indicateur anniversaire 🎂 |
| Rôles : disciple, nouveau, mentor, adjoint_berger, berger, admin | ✅ | Hiérarchie et permissions cohérentes |

**Champs profil (exemples) :** nom, prénom, email, sexe, date_naissance, téléphone, ville, CP, date_arrivee_icc, formations[], ministere_service, baptise_immersion, profession, statut_professionnel, passions_centres_interet.

**Manques repérés :** Pas de photo de profil, pas d’historique des modifications, pas d’export CSV/Excel des membres.

---

### 2.3 Calendrier et programmes

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Calendrier mensuel | ✅ | Navigation mois, programmes par jour |
| Liste des programmes | ✅ | Filtres nom + type |
| Création / édition programme (adjoint_berger+) | ✅ | Nom, type, date début/fin, lieu, récurrence, description |
| 9 types de programmes | ✅ | Culte, Partage, Com’frat, Prière, etc. |
| Détail d’un programme | ✅ | Avec bouton “Pointer” (présences) |
| Suppression (berger) | ✅ | |

**Manques repérés :** Récurrence stockée mais pas de génération automatique d’occurrences ; pas de vue “semaine” ou “liste” ; pas de rappel (notification) avant un programme.

---

### 2.4 Présences

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Pointage par programme | ✅ | Liste disciples, statut (présent, absent, excusé, non renseigné) |
| Droits de pointage | ✅ | Mentor : ses disciples ; berger : tous |
| Enregistrement en batch | ✅ | Presences.saveForProgramme |
| Historique par membre | ✅ | Page dédiée, tableau + mini stats |
| Cache présences par programme | ✅ | Presences.cache |

**Manques repérés :** Pas de rappel “programmes sans pointage”, pas d’export Excel des présences, pas de seuil “alerte absence”.

---

### 2.5 Statistiques et export

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Période (dates) + filtre type programme | ✅ | |
| Stats globales | ✅ | Taux présence, présents/absents/excusés |
| Stats par type de programme | ✅ | Taux par type |
| Stats par membre | ✅ | Taux, classement |
| Vue “par mentor” (berger) | ✅ | Filtre mentorId |
| Évolution mensuelle | ✅ | Données pour graphiques |
| Graphiques (barres, évolution) | ✅ | HTML/CSS |
| Export / impression PDF | ✅ | Fenêtre print, rapport structuré |

**Manques repérés :** Pas d’export CSV/Excel brut ; pas de comparaison période vs période ; pas de graphiques interactifs (ex. clic pour détail).

---

### 2.6 Notifications (annonces)

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Liste des notifications | ✅ | Ordre date décroissant |
| Filtre par priorité | ✅ | normal, important, urgent, critique |
| Création (tout membre) | ✅ | Contenu + priorité |
| Suppression (auteur ou admin) | ✅ | |
| Affichage par priorité (couleur/icône) | ✅ | |

**Manques repérés :** Pas de notification navigateur (Web Push) ; pas de “lu / non lu” ; pas de date d’expiration ; pas d’affichage sur le dashboard (dernières N).

---

### 2.7 Prière et témoignages

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Sujets de prière | ✅ | Liste, ajout, anonyme optionnel |
| Marquer “exaucé” | ✅ | SujetsPriere.markAsExauce |
| Témoignages | ✅ | Liste, ajout (auteur affiché) |
| Suppression (auteur ou admin) | ✅ | Sujets ; admin pour témoignages |

**Manques repérés :** Pas de catégories (santé, famille, travail…) ; pas de rappel “prières en attente” ; pas de réactions (like / prié pour).

---

### 2.8 Documents

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Liste des documents | ✅ | Filtrée par visibilité (tous, mentors_berger, berger_seul) |
| Upload (adjoint_berger+) | ✅ | Firebase Storage + métadonnées Firestore |
| Catégories | ✅ | 2 : “Documents divers”, “Comptes rendus de réunion” |
| Visibilité par rôle | ✅ | 3 niveaux |
| Téléchargement / ouverture | ✅ | Lien Storage |
| Suppression | ✅ | Storage + Firestore |

**Manques repérés :** Peu de catégories ; pas de versioning ; pas de recherche full-text dans les titres/descriptions.

---

### 2.9 Tableau de bord

| Fonctionnalité | Présent | Remarque |
|----------------|---------|----------|
| Cartes : membres actifs, “mes disciples”, programmes, anniversaires | ✅ | |
| Message anniversaires du jour | ✅ | |
| Actions rapides | ✅ | Profil, Calendrier, Prière, Témoignages, Ajouter, Stats |
| Prochains programmes (5) | ✅ | Lien vers détail |
| “Mes disciples” (5) pour mentors | ✅ | |

**Manques repérés :** Pas de widget “dernières notifications” ; pas de “programmes à pointer” ; pas de personnalisation des widgets.

---

### 2.10 UX et technique

| Élément | Présent | Remarque |
|---------|---------|----------|
| Responsive | ✅ | Media queries dans styles.css |
| Toasts (feedback) | ✅ | success, error, warning, info |
| Modales | ✅ | Modal.show/hide, confirm |
| Loader global | ✅ | App.showLoading / hideLoading |
| Sidebar + nav par rôle | ✅ | Sections Principal, Communauté, Gestion, Administration |
| Échappement HTML | ✅ | Utils.escapeHtml utilisé dans les rendus |

**Manques repérés :** Pas de gestion d’erreur réseau globale (retry, message clair) ; pas de deep linking (URL par page) ; pas de PWA / mode hors ligne ; pas de i18n (tout en français, en dur).

---

## 3. Points forts du code

1. **Séparation par domaine** : Un fichier JS par grand domaine (auth, pages, programmes, stats, etc.), noms clairs.
2. **Règles Firestore** : Bien structurées (fonctions réutilisables, famille_id, rôles).
3. **Permissions** : Objet `Permissions` centralisé et utilisé avant affichage et actions.
4. **Utilitaires** : `Utils` (dates, initiales, rôles, escapeHtml) utilisés de façon cohérente.
5. **Firestore** : Persistance locale activée pour meilleure résilience.
6. **Pas de dépendances lourdes** : Déploiement simple (fichiers statiques + Firebase).

---

## 4. Points d’attention / faiblesses

1. **Pas de build** : Pas de minification, bundling, ni de gestion des versions de fichiers (cache).
2. **Duplication de rendu** : `Pages.renderDashboard()` et `App.renderDashboardEnhanced()` – deux implémentations de dashboard.
3. **Grosse chaîne de scripts** : Ordre strict ; un oubli ou une erreur peut casser toute l’app.
4. **État uniquement en mémoire** : Rechargement de page = rechargement de tous les modules (Membres, Programmes, etc.).
5. **Peu de tests** : Aucun test unitaire ou E2E repéré.
6. **Config Firebase** : Clés dans `firebase-config.js` (exposées côté client, normal pour Firebase, mais à ne pas mélanger avec des secrets serveur).
7. **Accessibilité** : Pas d’audit ARIA / clavier systématique.
8. **Pas de versioning d’API** : Si le schéma Firestore évolue, pas de stratégie explicite de migration.

---

## 5. Fonctionnalités pertinentes à ajouter

### 5.1 Priorité haute (impact fort, cohérent avec l’existant)

| Idée | Description | Bénéfice |
|------|-------------|----------|
| **Rappel programmes à pointer** | Sur le dashboard ou une notif, afficher les programmes passés récents sans pointage (ou incomplet). | Ne plus oublier de pointer. |
| **Dernières notifications sur le dashboard** | Bloc “Dernières annonces” (3–5) avec lien vers la page Notifications. | Meilleure visibilité des infos importantes. |
| **Changement de mot de passe** | Page “Mon compte” ou “Sécurité” : mot de passe actuel + nouveau + confirmation. | Autonomie et sécurité. |
| **Export membres (CSV/Excel)** | Bouton “Exporter la liste” (bergers) : prénom, nom, email, rôle, téléphone, etc. | Rapports, annuaire imprimé, suivi externe. |
| **Photo de profil** | Upload avatar (Storage), affichage dans sidebar, annuaire, profils. | Reconnaissance visuelle, lien humain. |
| **Alertes absence** | Règle ou vue “membres avec taux d’absence &lt; X % sur les N derniers programmes”. | Repérage des personnes à recontacter. |

### 5.2 Priorité moyenne (confort et efficacité)

| Idée | Description | Bénéfice |
|------|-------------|----------|
| **Catégories sujets de prière** | Tags : Santé, Famille, Travail, Mission, etc. + filtre. | Suivi et partage ciblé. |
| **Plus de catégories de documents** | Ex. : Bulletins, Chants, Études, Administration. | Mieux ranger et retrouver. |
| **Recherche globale** | Barre “Rechercher” : membres, programmes, documents (titres). | Gain de temps. |
| **Rappel avant un programme** | Option “Rappel 24h avant” (ou J-1) : notification in-app ou email. | Meilleure participation. |
| **Vue “Ma semaine”** | Liste des programmes de la semaine en cours. | Vue plus opérationnelle. |
| **Indicateur “lu” sur les notifications** | Marquer comme lu (par utilisateur), badge “non lues” dans la nav. | Suivi de ce qui est nouveau. |
| **Export présences (CSV/Excel)** | Export des pointages sur une période (programme ou membre). | Rapports et archivage. |

### 5.3 Priorité plus basse (évolution long terme)

| Idée | Description | Bénéfice |
|------|-------------|----------|
| **PWA + mode hors ligne** | Service Worker, cache des pages et données critiques, icône “installer l’app”. | Utilisation sans réseau (salle sans Wi‑Fi). |
| **Notifications push navigateur** | Web Push pour annonces ou rappels de programmes. | Engagement sans ouvrir l’app. |
| **Deep linking** | URL par page (ex. `/calendrier`, `/membres/123`). | Partage de liens, favoris. |
| **Thème sombre** | Bascule clair/sombre (CSS variables déjà en place). | Confort et accessibilité. |
| **Multi-langue (i18n)** | Fichiers de traduction (fr/en au moins). | Églises bilingues ou internationales. |
| **Audit log** | Qui a modifié quoi (membre, programme, présence) et quand. | Traçabilité et confiance. |
| **Tableau de bord personnalisable** | Glisser-déposer des widgets, ordre, visibilité. | Adaptation aux rôles et préférences. |
| **Génération automatique d’occurrences** | À partir de “récurrence hebdo/mensuelle”, créer les programmes à l’avance. | Moins de saisie manuelle. |

---

## 6. Synthèse et recommandations

### 6.1 Ce qui fonctionne bien

- Couverture large : auth, membres, calendrier, présences, stats, PDF, notifications, prière, témoignages, documents.
- Rôles et permissions clairs et appliqués côté UI et Firestore.
- Expérience utilisateur cohérente (toasts, modales, sidebar, formulaires).

### 6.2 À traiter en priorité (code)

1. Supprimer ou unifier la duplication du dashboard (`renderDashboard` vs `renderDashboardEnhanced`).
2. Documenter l’ordre de chargement des scripts et les dépendances entre modules (ou migrer vers un petit bundler si évolution prévue).
3. Ajouter une page ou un mécanisme de “erreur réseau / session expirée” avec proposition de reconnexion.

### 6.3 À traiter en priorité (fonctionnel)

1. Rappel “programmes à pointer” + dernières notifications sur le dashboard.
2. Changement de mot de passe et (si possible) photo de profil.
3. Export membres (CSV/Excel) et alertes absence pour les bergers.

Ensuite, selon les retours des utilisateurs : catégories prière, recherche globale, rappels avant programme, et à plus long terme PWA et notifications push.

---

**Document généré dans le cadre de l’audit de l’application CRM Famille.**  
Pour toute question ou mise à jour de cet audit, se référer à ce fichier et au README du projet.
