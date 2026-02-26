 # Guide des scripts de suppression

Ce document décrit les scripts disponibles pour supprimer des données, les **prérequis**, le **mode d'exécution** et l'**ordre de lancement** si vous utilisez plusieurs scripts.

---

## Prérequis (avant de lancer tout script)

### 1. Node.js

- **Node.js** installé sur votre machine (v14 ou supérieur).
- Vérification : ouvrir un terminal et taper `node --version`.

### 2. Clé de compte de service Firebase

1. Aller dans [Firebase Console](https://console.firebase.google.com/) > votre projet.
2. **Paramètres du projet** (icône ⚙️) > **Comptes de service**.
3. Cliquer sur **Générer une nouvelle clé privée**.
4. Enregistrer le fichier JSON (ex. `serviceAccountKey.json`).
5. Placer ce fichier dans le dossier `scripts/` (ou indiquer son chemin avec `--key=`).
6. **Important** : ce fichier ne doit **jamais** être commité dans Git (il est dans `.gitignore`).

### 3. Dépendances npm

Dans le dossier `scripts/`, exécuter une seule fois :

```bash
cd scripts
npm install
```

### 4. Sauvegarde (recommandé)

- Avant toute suppression, faire un **export Firestore** (Console Firebase > Firestore > … > Exporter) ou tester sur un **projet Firebase de test**.
- Les opérations sont **irréversibles**.

---

## Mode d'exécution

Tous les scripts se lancent en **ligne de commande** (terminal) :

- **Windows** : Invite de commandes (cmd) ou PowerShell.
- **Mac / Linux** : Terminal.

Ouvrir le terminal, se placer dans le dossier `scripts/`, puis exécuter la commande correspondante.

---

## Scripts disponibles

### Script 1 : Supprimer les données de contenu uniquement

**Fichier** : `scripts/delete-content-data-only.js`

**Effet** : Supprime tous les **documents** dans les collections de contenu (programmes, présences, notifications, sujets de prière, témoignages, documents, nouvelles âmes, évangélisation, notes, logs). **Conserve** : membres (`utilisateurs`), familles (`familles`). Les collections restent (vides). Les pages de l'app restent intactes.

**Commande** :
```bash
cd scripts
node delete-content-data-only.js
```

Ou avec chemin explicite de la clé :
```bash
node delete-content-data-only.js --key=../chemin/vers/serviceAccountKey.json
```

**Prérequis spécifiques** : Aucun fichier à préparer. La clé Firebase suffit.

---

### Script 2 : Garder certains membres, supprimer les autres

**Fichier** : `scripts/delete-members-except-keep-list.js`

**Effet** : Garde uniquement les membres dont l'email figure dans `membres-a-garder.txt`. Supprime tous les autres (document Firestore + compte Authentication). Réaffecte les disciples et les programmes créés par les membres supprimés vers le premier membre de la liste (repreneur).

**Prérequis spécifiques** :

1. **Éditer** `scripts/membres-a-garder.txt` :
   - Un **email par ligne** (celui des membres à garder).
   - Mettre en **premier** l'email du membre repreneur (admin ou superviseur).
   - Les lignes commençant par `#` sont ignorées.

2. Exemple de contenu :
   ```
   admin@famille.org
   superviseur@famille.org
   mentor1@famille.org
   ```

**Commande** :
```bash
cd scripts
node delete-members-except-keep-list.js
```

Ou avec chemins personnalisés :
```bash
node delete-members-except-keep-list.js --key=../serviceAccountKey.json --list=./membres-a-garder.txt
```

---

### Script 3 : Tout supprimer (reset complet)

**Fichier** : `scripts/reset-firestore-data.js`

**Effet** : Supprime **toutes** les données Firestore (membres, familles, contenu) et optionnellement tous les utilisateurs Authentication. Repartir à zéro total.

**Commande** :
```bash
cd scripts
node reset-firestore-data.js
```

---

## Ordre d'exécution si vous utilisez plusieurs scripts

### Cas A : Garder quelques membres ET supprimer tout le contenu

1. **D'abord** : `delete-members-except-keep-list.js`  
   → Supprime les membres non listés, conserve ceux de `membres-a-garder.txt`.

2. **Ensuite** : `delete-content-data-only.js`  
   → Supprime programmes, présences, notifications, etc. Les membres conservés restent, les collections de contenu sont vidées.

**Résultat** : Seuls les membres listés restent, sans aucun contenu (programmes, témoignages, etc.).

---

### Cas B : Supprimer uniquement le contenu (garder tous les membres)

- **Uniquement** : `delete-content-data-only.js`  
  → Tous les membres restent, tout le contenu est supprimé.

---

### Cas C : Repartir à zéro total

- **Uniquement** : `reset-firestore-data.js`  
  → Tout est supprimé (membres, familles, contenu, optionnellement Auth).

---

## Récapitulatif

| Élément | Avant tout script | Mode |
|---------|-------------------|------|
| **Node.js** | Installé (v14+) | — |
| **Clé Firebase** | Téléchargée, placée dans `scripts/` ou chemin fourni | — |
| **npm install** | Exécuté une fois dans `scripts/` | Terminal |
| **membres-a-garder.txt** | Rempli (pour script 2 uniquement) | Éditeur de texte |
| **Lancement** | `node nom-du-script.js` | Terminal (ligne de commande) |

---

## Aucune exécution automatique

Les scripts ne sont **pas exécutés** automatiquement. Vous devez les lancer manuellement quand vous êtes prêt. Chaque script demande une confirmation avant de procéder.
