# Recommandations et implémentations

Document de synthèse des recommandations proposées pour compléter l’application CRM Famille et des implémentations réalisées.

**Date :** Janvier 2025

---

## 1. Recommandations initiales

Les recommandations suivantes ont été proposées pour compléter l’application sans compromettre le code existant :

| Priorité | Fonctionnalité | Intérêt principal |
|----------|----------------|-------------------|
| Haute | Notes de suivi par personne | Suivi pastoral continu |
| Haute | Navigation par hash (URL) | Fiabilité et partage des liens |
| Moyenne | Calendrier unifié | Vision globale des activités |
| Moyenne | Notifications / rappels | Meilleur suivi des nouvelles âmes |
| Moyenne | Règles Firestore renforcées | Sécurité des données |
| Basse | Export global | Archivage et continuité |
| Basse | Mode hors ligne | Utilisation sur le terrain |

**Non implémentées (risque ou dépendances) :**

- **Règles Firestore renforcées** : risque de régression (problèmes de permissions déjà rencontrés).
- **Emails automatiques** : pas de backend / Cloud Functions.
- **Notifications push** : complexité (service workers).
- **Mode hors ligne** : modification de la config Firestore.
- **Import CSV** : risque d’intégrité des données.
- **Logs d’audit** : impact sur de nombreux fichiers.

---

## 2. Implémentations réalisées

### 2.1 Navigation par hash (URL)

- **Objectif :** Liens directs et rafraîchissement sans erreur.
- **Fonctionnement :** URLs du type `#dashboard`, `#nouvelles-ames`, `#nouvelle-ame-detail/abc123`.
- **Fichiers :** `app-main.js`  
  - `parseHash()`, `updateHash()`, `navigateFromHash()`, écoute `hashchange`, appel au chargement si hash présent.

---

### 2.2 Notes de suivi (membres et nouvelles âmes)

- **Objectif :** Notes pastorales sur les profils membres et les fiches nouvelles âmes.
- **Fonctionnement :**  
  - Collection Firestore `notes_suivi` (champs : `famille_id`, `entite_type`, `entite_id`, `entite_ref`, `contenu`, `auteur_id`, `created_at`).  
  - Affichage et ajout sur la page profil membre (mentors et supérieurs) et sur la fiche détail nouvelle âme.
- **Fichiers :**  
  - `app-notes.js` (nouveau)  
  - `app-pages.js` (section notes dans `renderProfil`)  
  - `app-nouvelles-ames.js` (section notes dans `renderDetail`)  
  - `app-main.js` (appels `NotesSuivi.loadAndRender` après rendu)  
  - `firestore-rules-complet.rules` (règles `notes_suivi`)  
  - `FIREBASE_INDEXES.md` (index pour `notes_suivi`)  
  - `index.html` (script `app-notes.js`)  
  - `styles.css` (classes `.notes-add`, etc.)

---

### 2.3 Calendrier unifié

- **Objectif :** Voir programmes et sessions d’évangélisation sur un même calendrier.
- **Fonctionnement :** Chargement des sessions évangélisation dans la vue calendrier, affichage par jour avec style distinct (évangélisation en bleu).
- **Fichiers :** `app-programmes.js`  
  - `renderCalendrier()` async, fusion programmes + sessions évangélisation, légende « Évangélisation ».  
  - `app-main.js` : `case 'calendrier'` avec `await PagesCalendrier.renderCalendrier()`.

---

### 2.4 Recherche globale

- **Objectif :** Recherche transversale membres, nouvelles âmes, sujets de prière.
- **Fonctionnement :** Champ de recherche dans le header ; à partir de 2 caractères, affichage d’une liste de résultats (max 8) ; clic = navigation vers la page correspondante.
- **Fichiers :** `app-main.js`  
  - `globalSearch()`, `globalSearchDebounce()`, `globalSearchShow()`, `globalSearchHide()`  
  - Dans `renderLayout()` : input + conteneur `#global-search-results`.

---

### 2.5 Thème sombre

- **Objectif :** Option d’affichage sombre.
- **Fonctionnement :** Bascule dans le header (icône lune/soleil) ; préférence stockée dans `localStorage` (`crm_theme`). Classe `theme-dark` sur `body` ; variables CSS dédiées dans `styles.css`.
- **Fichiers :**  
  - `app-main.js` : `applyTheme()`, `toggleTheme()`, `setThemePreference()`  
  - `styles.css` : bloc `body.theme-dark`  
  - `app-pages.js` : sélecteur de thème dans Mon compte.

---

### 2.6 Export global des données

- **Objectif :** Sauvegarde / archivage de l’ensemble des données (membres, programmes, nouvelles âmes, sujets de prière).
- **Fonctionnement :** Bouton « Exporter les données (JSON) » dans Mon compte (réservé aux bergers). Téléchargement d’un fichier JSON avec sérialisation des timestamps.
- **Fichiers :** `app-main.js` (`exportGlobal()`), `app-pages.js` (bouton dans `renderMonCompte()`).

---

### 2.7 Paramètres / préférences

- **Objectif :** Centraliser les préférences utilisateur.
- **Fonctionnement :** Dans Mon compte : choix du thème (clair/sombre) et gestion des raccourcis (voir 2.9).
- **Fichiers :** `app-pages.js` (section « Préférences » dans `renderMonCompte()`), `app-main.js` (`setThemePreference()`).

---

### 2.8 Objectifs KPIs (dashboard)

- **Objectif :** Suivi d’objectifs du mois (nouvelles âmes intégrées, contacts évangélisation).
- **Fonctionnement :** Section « Objectifs du mois » sur le dashboard (bergers) avec barres de progression réel / objectif. Objectifs modifiables via une modale ; stockage dans `localStorage` par famille (`crm_objectifs_<familleId>`).
- **Fichiers :** `app-main.js`  
  - `renderObjectifsKPI()`, `editObjectifs()`, `saveObjectifs()`  
  - Appel dans `renderDashboardEnhanced()`.

---

### 2.9 Raccourcis / favoris

- **Objectif :** Accès rapide aux pages les plus utilisées.
- **Fonctionnement :** Dans Mon compte, cases à cocher pour choisir les pages à afficher dans la section « Raccourcis » du menu latéral. Stockage dans `localStorage` (`crm_raccourcis`).
- **Fichiers :**  
  - `app-main.js` : `getRaccourcisNav()`, `toggleRaccourci()`  
  - `app-pages.js` : checkboxes des raccourcis dans Mon compte  
  - `renderLayout()` : bloc « Raccourcis » en tête de la sidebar.

---

## 3. Fichiers modifiés ou créés (résumé)

| Fichier | Action |
|---------|--------|
| `app-main.js` | Modifié (hash, recherche, thème, objectifs, raccourcis, export, hooks notes) |
| `app-pages.js` | Modifié (notes profil, préférences, raccourcis, export) |
| `app-notes.js` | **Créé** (module notes de suivi) |
| `app-programmes.js` | Modifié (calendrier unifié) |
| `app-nouvelles-ames.js` | Modifié (section notes détail) |
| `index.html` | Modifié (script `app-notes.js`) |
| `styles.css` | Modifié (thème sombre, notes) |
| `firestore-rules-complet.rules` | Modifié (règles `notes_suivi`) |
| `FIREBASE_INDEXES.md` | Modifié (index `notes_suivi`) |

---

## 4. Index Firestore

Pour le module **notes de suivi**, un index composite est nécessaire :

- **Collection :** `notes_suivi`
- **Champs :** `famille_id` (Ascending), `entite_ref` (Ascending), `created_at` (Descending)

En cas d’erreur au premier chargement, suivre le lien proposé dans la console pour créer l’index.

---

## 5. Familles et bergers

### 5.1 Ajouter un berger d’une autre famille à sa propre famille

Un berger de la famille « Déterminés » peut inviter un berger (ou un futur berger) à rejoindre **cette même famille** :

1. Se connecter en tant que berger (ou admin) de la famille.
2. Aller dans **Membres** → **Ajouter**.
3. Renseigner prénom, nom, **email** (obligatoire, unique).
4. Choisir le rôle **Berger** (ou Mentor, Adjoint Berger selon les besoins).
5. Enregistrer. Un mot de passe temporaire est généré ; un email de réinitialisation est envoyé.
6. Communiquer à la personne : le **nom exact de la famille** (affiché à la connexion) et ses identifiants (email + réinitialisation de mot de passe ou mot de passe temporaire affiché après création).

La personne se connecte ensuite sur la **fenêtre de connexion** : elle choisit la famille dans la liste (ou saisit son nom), puis utilise son email et son mot de passe. Elle pourra alors ajouter ses mentors/disciples dans cette famille.

Les données et membres restent **séparés par famille** : chaque famille ne voit que ses propres membres et données.

### 5.2 Créer une nouvelle famille (données totalement séparées)

Réservé à l’**administrateur** :

1. Se connecter en tant qu’**admin**.
2. Menu **Administration** → **Familles**.
3. **Créer une famille** : saisir le nom (ex. « Famille Espérance »). La famille est créée avec un nom technique (minuscules) et un nom d’affichage.
4. **Ajouter un berger** à cette famille : sur la ligne de la famille, cliquer sur « Ajouter un berger », remplir prénom, nom, email. Le premier berger est créé ; il recevra un email de réinitialisation de mot de passe.
5. Ce berger se connecte avec le **nom de la famille** (choisi dans la liste à la connexion) et son email/mot de passe. Il pourra ensuite ajouter des mentors et des disciples dans **sa** famille.

Les familles ont des **données et membres totalement séparés** (programmes, présences, nouvelles âmes, etc. sont filtrés par `famille_id`).

### 5.3 Connexion : choix de la famille

Sur la **page de connexion**, la liste déroulante **Famille** est remplie avec toutes les familles actives. L’utilisateur choisit sa famille puis saisit email et mot de passe. Le nom de la dernière famille utilisée est mémorisé (localStorage).

**Fichiers concernés :**  
- `app-auth.js` : `loadFamiliesForLogin()`, `createFamille()`, `createMembreForFamily()`  
- `app-pages.js` : `renderLogin()` (sélecteur famille), `renderAdminFamilles()`  
- `app-main.js` : route `admin-familles`, modales « Créer une famille » et « Ajouter un berger »

---

## 6. Corrections et évolutions (janvier 2025)

Les points suivants ont été traités pour corriger des anomalies ou enrichir l’application.

### 6.1 Calendrier : ouverture de la page

- **Problème :** La page Calendrier ne s’ouvrait plus au clic.
- **Solution :** `renderCalendrier()` a été rendu asynchrone pour charger les sessions d’évangélisation ; les appels depuis `prevMonth`, `nextMonth`, `goToToday` ont été mis à jour avec `async`/`await`. Un `try/catch` autour du chargement des sessions évite que l’échec bloque l’affichage du calendrier.
- **Fichiers :** `app-programmes.js`, `app-main.js`.

### 6.2 Annuaire : informations affichées

- **Objectif :** Afficher pour chaque membre : profession, ville de résidence, code postal, centres d’intérêt, jour et mois d’anniversaire (sans année).
- **Réalisation :** Les champs existaient déjà en édition de profil (`adresse_ville`, `adresse_code_postal`, `profession`, `passions_centres_interet`, `date_naissance`). L’affichage dans l’annuaire a été complété : ville et code postal ajoutés sous la date d’anniversaire ; l’anniversaire reste affiché au format « jour mois » (sans année).
- **Fichiers :** `app-pages.js` (`renderAnnuaire()`).

### 6.3 Témoignages : catégories de sujet

- **Objectif :** Créer des catégories de sujet de témoignage.
- **Réalisation :** Catégories proposées : Santé, Spirituel, Emploi/Finances, Couple/Famille, Projets, Autre. Un champ « Sujet du témoignage » (liste déroulante) a été ajouté dans le formulaire d’ajout ; le champ `sujet_categorie` est enregistré en base et affiché en badge sur chaque carte de témoignage.
- **Fichiers :** `app-priere.js` (module `Temoignages` : `getCategoriesSujet()`, `create()` ; pages : modal, `renderTemoignageCard()`, `submitTemoignage()`).

### 6.4 Documents : droits d’upload (vidéo / image)

- **Problème :** « Missing or insufficient permissions » lors de l’upload de vidéos ou d’images dans la page Documents.
- **Cause :** Les règles Firebase Storage doivent autoriser l’écriture dans le chemin `documents/{familleId}/...` pour les utilisateurs authentifiés.
- **Réalisation :** Fichier `storage.rules` ajouté à la racine du projet avec les règles pour `avatars` et `documents`. La documentation dans `FIREBASE_STORAGE_RULES.md` a été complétée par une section « Missing or insufficient permissions » avec les instructions pour ajouter/publier les règles `documents` dans la console Firebase.
- **Fichiers :** `storage.rules`, `FIREBASE_STORAGE_RULES.md`.  
- **Action utilisateur :** Dans la console Firebase → Storage → Règles, vérifier la présence du bloc `match /documents/{familleId}/{allPaths=**}` avec `allow read, write, delete: if request.auth != null;` puis publier.

### 6.5 Statistiques : export CSV

- **Objectif :** Permettre l’export en CSV de certains tableaux de la page Statistiques.
- **Réalisation :** Boutons « Exporter CSV » ajoutés pour : (1) le tableau « Détail par membre » (colonnes : Membre, Mentor, Présences, Absences, Excusés, Taux %) ; (2) le tableau « Membres à recontacter » (alertes absence), lorsqu’il est affiché. Encodage UTF-8 avec BOM pour une bonne ouverture dans Excel.
- **Fichiers :** `app-statistiques.js` (`escapeCsv()`, `exportDetailMembreCSV()`, `exportAlertesCSV()`, stockage de `alertesAbsence` pour l’export).

### 6.6 Nouvelles Âmes : recherche par date de premier contact

- **Objectif :** Filtrer les nouvelles âmes par date de premier contact.
- **Réalisation :** Deux champs date « du » et « au » ont été ajoutés dans la barre de filtres. Le filtre `date_premier_contact_debut` / `date_premier_contact_fin` a été implémenté dans `NouvellesAmesData.filterBy()` (comparaison sur la date, sans l’heure).
- **Fichiers :** `app-nouvelles-ames.js` (filtres, `applyFilters()`, `filterBy()`).

### 6.7 Évangélisation : modifier Notes et Bilan après clôture

- **Objectif :** Pouvoir modifier le contenu des « Notes et Bilan » même lorsque la session est terminée.
- **Réalisation :** Pour les sessions au statut « Terminée », un bouton « Modifier notes et bilan » (réservé aux adjoints berger) ouvre une modale avec les champs Notes et Bilan pré-remplis. La sauvegarde appelle `SessionsEvangelisation.update(sessionId, { notes, bilan })`.
- **Fichiers :** `app-evangelisation.js` (`renderDetail` : bouton ; `showEditNotesBilanModal()`, `submitEditNotesBilan()`).

### 6.8 Membres : filtre par mentor

- **Objectif :** Sur la page « Tous les membres », pouvoir filtrer les membres par mentor.
- **Réalisation :** Liste déroulante « Filtrer par mentor » ajoutée (visible uniquement pour les utilisateurs pouvant voir tous les membres, hors page « Mes disciples »). Options : Tous les mentors, Non affecté, puis chaque mentor (mentors, adjoints, bergers). Les cartes membre ont l’attribut `data-mentor-id` ; `App.filterMembres()` prend en compte ce filtre en plus du rôle et de la recherche texte.
- **Fichiers :** `app-pages.js` (`renderMembres()`, `renderMembreCard()` avec `data-mentor-id`), `app-main.js` (`filterMembres()`).

---

## 7. Profil, dates réalistes, Mes disciples (janvier 2025)

### 7.1 Page Mon Profil

- **Bouton retour :** Sur son propre profil, bouton « Retour vers Mon compte » ; sur le profil d’un disciple (vu par un mentor), bouton « Retour vers Mes disciples ».
- **Formations suivies :** Ajout de la formation **RTT (301)** (valeur stockée : `RTT_301`, affichage : « RTT (301) »).
- **Dates conformes à la réalité :**  
  - `Utils.formatDate()` : les années &lt; 1900 ou &gt; 2100 renvoient une chaîne vide (plus d’affichage du type 01/10/3500).  
  - Champs date du formulaire d’édition de profil : `min="1900-01-01"`, `max="aujourd’hui"` pour date de naissance, arrivée ICC, date du baptême.
- **Baptême :** Si « Baptisé par immersion » = Oui, affichage de la **date du baptême** (profil) et champ **Date du baptême** dans le formulaire d’édition (affiché uniquement quand « Oui » est sélectionné). Champ Firestore : `date_bapteme`.
- **Statut professionnel :** Nouvelle option **Entrepreneur / Autoentrepreneur** (valeur : `entrepreneur_autoentrepreneur`).

**Fichiers :** `app-pages.js` (`renderProfil`, `renderProfilEdit`), `app-main.js` (`submitEditProfil`), `app-core.js` (`formatDate`).

### 7.2 Calendriers / dates valables

- **Programmes :** Champs « Date et heure de début / fin » : `min="2000-01-01T00:00"`, `max` = 10 ans à partir d’aujourd’hui. `getDateTimeValue` ignore les dates hors 1900–2100.

**Fichiers :** `app-programmes.js` (`renderProgrammeForm`).

### 7.3 Mes Disciples – bouton retour

- Depuis la liste Mes disciples, en cliquant sur le profil d’un disciple, la page profil affiche un bouton **« Retour vers Mes disciples »** (visible pour les mentors).

**Fichiers :** `app-pages.js` (`renderProfil`).

### 7.4 À prévoir (non implémenté dans cette phase)

- **Notifications :** Modifier une notification (créateur, adjoint, berger, admin) ; afficher date de création, date de modification, nom du créateur et du modificateur si différent.
- **Prière :** Catégories comme Témoignages (Santé, Spirituel, etc.) ; afficher la date de création au lieu du nombre de jours ; modifier le contenu ; bouton « En attente d’exaucement » / « Exaucé » (gris par défaut, vert une fois exaucé).
- **Témoignages :** Modifier le contenu (créateur uniquement) ; upload de fichiers audio ou vidéo (courte durée) par témoignage.

---

## 8. Références

- Plan et synthèse Nouvelles Âmes : `SYNTHESE_NOUVELLES_AMES.md`, `PLAN_NOUVELLES_AMES.md`
- Règles Firestore : `firestore-rules-complet.rules`
- Index Firestore : `FIREBASE_INDEXES.md`
