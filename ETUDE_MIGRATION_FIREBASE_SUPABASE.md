# Étude préalable : migration hypothétique Firebase → Supabase

**Objet du document.** Anticiper, sans engagement de mise en œuvre, les **contraintes techniques et structurelles**, les **risques** et les **conséquences** d’un basculement du backend Firebase (Firestore, Authentication, Storage) vers **Supabase** (PostgreSQL, Auth Supabase, Storage Supabase).

**Référence codebase.** SPA JavaScript vanilla, Firebase SDK **compat** ([`firebase-config.js`](firebase-config.js), scripts chargés depuis [`index.html`](index.html)). Modèle décrit dans [`ARCHITECTURE.md`](ARCHITECTURE.md). Sécurité côté données : [`firestore.rules`](firestore.rules). Index composites : [`FIREBASE_INDEXES.md`](FIREBASE_INDEXES.md).

---

## 1. Contraintes techniques et structurelles (détail)

### 1.1 Couplage fort aux APIs Firebase dans le frontend

Le métier est écrit contre **l’SDK client Firebase** :

- `firebase.auth()`, `firebase.firestore()`, `firebase.storage()` ;
- types et helpers Firestore : `firebase.firestore.Timestamp`, `FirebaseFirestore.FieldValue.serverTimestamp()`, etc. ;
- requêtes style `db.collection(...).where(...).get()`, `add()`, `update()`, `doc().get()` ;

Les modules concernés incluent notamment : [`app-auth.js`](app-auth.js), [`app-pages.js`](app-pages.js), [`app-programmes.js`](app-programmes.js), [`app-nouvelles-ames.js`](app-nouvelles-ames.js), [`app-priere.js`](app-priere.js), [`app-documents.js`](app-documents.js), [`app-evangelisation.js`](app-evangelisation.js), [`app-notifications.js`](app-notifications.js), [`app-main.js`](app-main.js), [`app-notes-personnelles.js`](app-notes-personnelles.js).

**Conséquence structurelle.** Une migration complète impose soit une **réécriture** de ces accès pour le client Supabase (`@supabase/supabase-js`, requêtes REST/Realtime, RPC SQL), soit l’introduction d’une **couche d’abstraction** (services `Auth`, `DB`, `Storage`) puis un remplacement progressif — le code actuel n’a pas cette séparation générique.

### 1.2 Modèle de données : document NoSQL versus relationnel

Firestore modélise les domaines sous forme de **collections** avec documents JSON flexibles. Supabase repose sur **PostgreSQL** : tables, clés primaires étrangères, contraintes, transactions ACID explicitées.

À cartographier à partir des règles Firestore : `familles`, `utilisateurs`, `programmes`, `presences`, `document_dossiers`, `documents`, `sujets_priere`, `temoignages`, `planning_conducteurs_priere`, `notifications`, `nouvelles_ames`, `suivis_ames`, `sessions_evangelisation`, `secteurs_evangelisation`, `notes_suivi`, `notes_personnelles`, `logs_connexion`, `logs_modification`.

**Conséquences.**

- Définir un **schéma relationnel** (normalisation / dénormalisation inverse des champs imbriqués ou des références `*_id`) ;
- Recréer les **index** nécessaires aux filtres (`where`, tri, composites) équivalents à ceux documentés ou déployés côté Firestore ;
- Gérer les **types** : timestamps Firestore → `timestamptz` ou `bigint` ; références parfois **string UID** ou **DocumentReference** (les règles gèrent déjà une forme normalisée de `famille_id`).

### 1.3 Authentification et identité utilisateur

Les profils métier **`utilisateurs/{userId}`** sont généralement alignés sur **`userId === uid` Firebase Auth**. Toute FK dans Firestore qui stocke un identifiant d’utilisateur (`mentor_id`, `created_by`, `auteur_id`, etc.) doit rester **cohérente** après migration Auth.

[`firebase-config.js`](firebase-config.js) utilise une **deuxième app Firebase** (`UserCreate`) et un `secondaryAuth` avec persistance **NONE** pour **créer des comptes** sans signer la session de l’administrateur qui opère depuis le navigateur. Ce schéma n’a pas d’équivalent direct tout-client Supabase : il faudrait en principe un **endpoint sécurisé** (Edge Function, petite API avec clé serveur ou service role) pour les opérations sensibles « création d’utilisateur », tout en gardant les politiques client pour les usages courants.

### 1.4 Règles de sécurité : Firestore rules vs Row Level Security (RLS)

Aujourd’hui, une part importante du contrôle d’accès est dans [`firestore.rules`](firestore.rules) : fonctions `roleLevel`, `hasRole`, `sameFamilleId`, `mentorCanUpdateDisciple`, `adjointServiceMentorReassignUpdate`, distinctions `isAdmin`, `isMentorPlanningOnly`, etc.

Sur Supabase, l’équivalent attendu est **RLS** sur PostgreSQL (policies `SELECT` / `INSERT` / `UPDATE` / `DELETE`), souvent complétées par des **fonctions SQL** ou des routes serveur lorsque les conditions deviennent trop complexes ou pour éviter les requêtes client multi-étapes.

**Contrainte.** Reproduire fidèlement la sémantique (adjoint superviseur, superviseur, mentor, exclusions admin, même famille, mises à jour partielles autorisées) est **sans équivalence automatique** : tout doit être retraduit et **retesté** scénario par scénario.

### 1.5 Stockage de fichiers (Firebase Storage vs Supabase Storage)

L’application s’appuie sur Firebase Storage (ex. pièces jointes médias dans le flux prière/témoignages, documents partagés côté [`app-documents.js`](app-documents.js)). Les URLs, chemins, et **règles** métier (`uploaded_by`, familles, dossiers logiques dans `document_dossiers`) doivent être **reprojettés** (buckets, policies Storage, signatures d’URLs).

### 1.6 Opérations groupées et cohérence

Le projet utilise **`db.batch()`** pour des mises à jour atomiques multiples (membres, programmes, fusion nouvelles âmes, scripts d’administration). PostgreSQL permet des **transactions SQL** équivalentes, mais leur expression et leur point d’entrée (client direct vs RPC transactionnelle) changent selon les choix d’architecture Supabase.

### 1.7 Temps réel et cache local

Firestore a la **persistance locale** activée (`enablePersistence`). Une recherche rapide dans le code ne montre pas d’usage de **`onSnapshot`** pour du temps réel poussé sur les collections métier : le flux est surtout requête/réponse puis état en mémoire (`AppState`).

Malgré cela : perdre Firestore Persistence signifie **ne plus avoir** ce modèle de cache/offline gratuit côté client — à remplacer par une stratégie consciente (PWA, cache applicatif minimal, ou abandon explicite de l’offline) si elle était encore utile métier.

### 1.8 Scripts et administration (Node)

Le dossier [`scripts/`](scripts/) repose sur **`firebase-admin`** (nettoyage données, resets, suppression famille, corrections de masse). Ils seraient à **réécrire** contre l’admin Supabase (client service role SQL, migrations, ou tooling Postgres).

---

## 2. Risques (détail)

### 2.1 Taille du chantier et dette technique

Une migration « big bang » frontend + données + Auth + Storage + sécurité est **large** : forte probabilité de régressions fonctionnelles (permissions mal traduites en RLS), de régression performance (requêtes N+1, absence des mêmes index), et coûts de développement **durables**.

### 2.2 Divergence sécurité app / serveur

Toute équivalence RLS incomplète peut provoquer :

- **fuite de données** (lecture trop permise), ou inversement ;
- **bloquages** pour les rôles adjoint superviseur / mentor / migrations de champs critiques.

Les cas limites déjà présents dans Firestore (réaffectation mentor, mise à jour partielle disciple, dossiers système documents) sont des **zones à risque** élevées.

### 2.3 Migration des comptes utilisateurs Auth

Firebase Auth et Supabase Auth ne partagent pas le même mécanisme de migration **transparente pour tous les fournisseurs** et pour tous les mots de passe. Il faut prévoir soit **export/import orchestré**, soit une **strate de coexistence**, soit dans certains cas **ré-invitation / réinitialisation** des utilisateurs avec communication claire.

### 2.4 Migration des blobs Storage

Chemins différents, URLs publiques vs signées, renommage buckets : risque **de liens cassés** dans la base métier ou affichés historiquement (ancien champ `*_url`). Prévoir un **script de recherche/remplacement** ou une table de **correspondance ancien ↔ nouveau**.

### 2.5 Fenêtre de maintenance et données en production

Pendant une bascule, risque **d’écritures perdues** ou de **doublons** si deux systèmes coexistent sans stratégie (double-run, lecture seule un jour J, fichier de delta, etc.).

---

## 3. Conséquences (détail)

### 3.1 Sur le produit logiciel

- **Refonte de la persistance métier** sur la quasi-totalité des écrans et flux ;
- **Refonte ou introduction d’API serveur minimaliste** là où Firebase permettait aujourd’hui un pattern « tout client + rules » (ex. création utilisateur sécurisée) ;
- **Revalidation exhaustive** : inscription, membres, profils, présences, programmes, évangélisation, documents, nouvelles âmes, notifications, pilotage des rôles.

### 3.2 Sur les opérations et l’hébergement

- Le frontend peut souvent rester tel quel sur l’**hébergement statique** actuel ; les **URLs de configuration**, clés anonymes/publiques, et éventuellement **CORS** / domaines OAuth changent ;
- **Opérations BDD** typiques Postgres : sauvegardes, restauration, monitoring requêtes, migrations schema versionnées (outillage type Supabase migrations ou autres) ;
- Changement du **modèle coûts** (invitations d’audit interne conseillée avant arbitrage financier).

### 3.3 Sur l’organisation

- Monter en compétence **SQL**, **RLS**, éventuellement **Edge Functions** ou petite couche backend ;
- Maintenir une **trace de correspondance** règles Firestore ↔ policies SQL pour faciliter la revue sécurité.

---

## 4. Mitigations et préparation raisonnable (sans préjuger du « quand »)

1. **Inventaires** : tableau collections/documents critiques → futures tables ; tableau des `auth.uid`-dépendants → contraintes FK ; inventaire Storage (préfixes, types MIME).
2. **Couche données** : abstraction (`DataStore.auth`, `DataStore.db`, …) même mince, pour isoler Firebase et réduire le coût du prochain pivot.
3. **Parité sécurité** : jeu de tests manuels et/ou automatiques **par rôle** (nouveau, disciple, mentor, adjoint superviseur, superviseur, admin) avant et après équivalence RLS.
4. **Stratégie Auth** : décider tôt entre migration douce, coexistence courte, ou reset contrôlé des accès.

---

## 5. Séparation avec les autres documents de migration du dépôt

- [`MIGRATION_BERGER_SUPERVISEUR.md`](MIGRATION_BERGER_SUPERVISEUR.md) décrit une **migration de données / de noms de rôles** à l’intérieur du même Firebase, pas un changement de fournisseur BaaS.
- Ce fichier est volontairement **non normatif sur la faisabilité business** : uniquement clarification technique pour consultation future.

---

**Document à mettre à jour** si l’architecture évolue (nouvelles collections, nouvelle auth, rupture IndexedDB hors ligne).
