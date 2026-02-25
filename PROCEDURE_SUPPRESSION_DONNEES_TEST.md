# Supprimer toutes les données test pour repartir à zéro

Cette procédure décrit comment vider les données (membres, programmes, présences, etc.) de l’application pour repartir à zéro, par exemple avant la mise en production.

---

## Prérequis

- **Droits** : être **admin** du projet Firebase (ou avoir un compte de service pour le script).
- **Sauvegarde** : si besoin, exporter les règles Firestore et noter la config (Paramètres du projet > Compte de service > Générer une clé) avant de tout supprimer.
- **Compréhension** : les **comptes utilisateurs** (Authentication) et les **documents Firestore** sont séparés. Supprimer un document `utilisateurs` ne supprime pas le compte de connexion. Pour un vrai « zéro », il faut aussi supprimer les utilisateurs dans **Authentication**.

---

## Deux façons de faire

| Méthode | Quand l’utiliser | Mode |
|--------|-------------------|------|
| **1. Console Firebase (manuel)** | Peu de données, une seule famille, ou pour cibler une collection précise | Manuel, dans le navigateur |
| **2. Script Node (Firebase Admin)** | Beaucoup de données, plusieurs collections, ou pour recommencer souvent | Ligne de commande (terminal) |

---

## Option 1 : Suppression manuelle (Console Firebase)

### Ordre conseillé (pour éviter les références cassées)

1. **Firestore Database** > onglet **Données**.
2. Supprimer les collections (ou les documents un par un) dans cet ordre :
   - **presences** (dépend de programmes et utilisateurs)
   - **programmes**
   - **notifications**
   - **sujets_priere**
   - **temoignages**
   - **documents** (les fichiers dans Storage restent éventuellement à supprimer à part)
   - **suivis_ames**
   - **nouvelles_ames**
   - **sessions_evangelisation**
   - **secteurs_evangelisation**
   - **notes_personnelles**
   - **utilisateurs** (un document par membre)

3. **Logs** : les collections `logs_connexion` et `logs_modification` sont en lecture seule pour l’app (règles `allow delete: if false`). Pour les vider, il faut soit modifier temporairement les règles, soit utiliser un **script avec Admin SDK** (Option 2).

4. **Familles** : garder ou supprimer la collection **familles** selon que vous gardiez ou non la structure « famille » (ex. une famille de test à supprimer).

### Supprimer les comptes de connexion (Authentication)

Pour que plus personne ne puisse se connecter avec les anciens comptes :

1. **Authentication** > onglet **Users**.
2. Supprimer les utilisateurs un par un (ou par lots si la console le permet).

Sans cette étape, d’anciens comptes pourront encore se connecter mais sans données (écran vide ou erreurs).

### Limites de la méthode manuelle

- Pas de suppression en masse « tout d’un coup » dans la console.
- Les **logs** ne sont pas supprimables via les règles actuelles ; il faut le script Admin SDK pour les vider.

---

## Option 2 : Script Node (Firebase Admin SDK) — recommandé pour tout vider

Un script permet de tout supprimer dans le bon ordre, y compris les logs et (optionnellement) les utilisateurs Authentication.

### Prérequis

- **Node.js** installé (v14 ou plus).
- **Clé de compte de service** Firebase :
  1. Console Firebase > Paramètres du projet > **Comptes de service**.
  2. **Générer une nouvelle clé privée** (fichier JSON).
  3. Placer ce fichier dans le projet (hors dépôt Git), ex. : `scripts/serviceAccountKey.json`.

### Marche à suivre

1. Ouvrir un **terminal** à la racine du projet.
2. Aller dans le dossier du script :
   ```bash
   cd scripts
   ```
3. Installer les dépendances (une seule fois) :
   ```bash
   npm install
   ```
4. Lancer le script (remplacer le chemin vers la clé si besoin) :
   ```bash
   node reset-firestore-data.js
   ```
   Ou avec le chemin explicite de la clé :
   ```bash
   node reset-firestore-data.js --key=../chemin/vers/serviceAccountKey.json
   ```
5. Suivre les questions à l’écran (confirmation, éventuellement choix de ne supprimer qu’une famille).
6. Une fois terminé, supprimer les utilisateurs **Authentication** à la main dans la console (ou via le script si l’option est prévue).

### Mode d’exécution

- **En mode normal** : le script supprime les données et affiche ce qu’il fait.
- **Sans modifier l’application** : le script ne touche qu’à Firestore (et éventuellement Auth) ; votre code (HTML/JS) reste inchangé.

---

## Après la suppression

1. **Vérifier Firestore** : les collections concernées sont vides (ou supprimées).
2. **Vérifier Authentication** : plus aucun utilisateur (ou seulement les comptes que vous gardez).
3. **Recréer au moins** :
   - une **famille** (si vous l’avez supprimée),  
   - un premier **compte admin** (création depuis la console Auth ou votre flux d’inscription si vous en avez un).
4. **Se reconnecter** à l’application avec ce compte et vérifier que tout repart bien à zéro.

---

## Résumé

- **Moyen le plus approprié** pour tout supprimer : **Option 2 (script Node)**.
- **Mode** : exécution en **ligne de commande** (terminal) avec Node.js.
- **Marche à suivre** : installer les dépendances dans `scripts/`, lancer `node reset-firestore-data.js`, confirmer, puis supprimer les utilisateurs dans **Authentication** si vous voulez repartir à zéro côté connexion aussi.
