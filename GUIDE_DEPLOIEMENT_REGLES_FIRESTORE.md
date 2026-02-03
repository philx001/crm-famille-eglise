# Guide détaillé : déploiement des règles Firestore

## À propos des deux fichiers de règles

Le projet contient **deux fichiers** de règles Firestore :

| Fichier | Rôle |
|--------|------|
| **`firestore.rules`** | Version standard, utilisée si vous déployez avec la ligne de commande Firebase (`firebase deploy --only firestore:rules`). |
| **`firestore-rules-complet.rules`** | Version de référence complète. C’est ce fichier que la doc du projet recommande de **copier-coller dans la console Firebase** pour publier les règles. |

**Vous n’avez pas à « remplacer » un fichier par l’autre.** Les deux ont été mis à jour (y compris les règles pour les logs). Vous devez seulement **publier** ces règles dans Firebase, en utilisant **une** des deux méthodes ci-dessous.

---

## Méthode 1 : Publier via la console Firebase (recommandée dans ce projet)

Cette méthode utilise le contenu de **`firestore-rules-complet.rules`** en le copiant dans l’éditeur de règles de la console.

### Étape 1 : Ouvrir les règles Firestore

1. Allez sur [https://console.firebase.google.com](https://console.firebase.google.com).
2. Sélectionnez **votre projet** (CRM Famille / votre nom de projet).
3. Dans le menu de gauche : **Build** → **Firestore Database**.
4. Cliquez sur l’onglet **Règles** (Rules).

Vous voyez l’éditeur avec le contenu actuel des règles (ou vide).

### Étape 2 : Remplacer tout le contenu par celui du fichier complet

1. Dans l’éditeur de la console, sélectionnez **tout** le texte (Ctrl+A sous Windows, Cmd+A sous Mac).
2. Supprimez-le (touche Suppr ou Backspace).
3. Ouvrez le fichier **`firestore-rules-complet.rules`** dans Cursor / VS Code (à la racine du projet).
4. Dans ce fichier, sélectionnez **tout** le contenu (Ctrl+A).
5. Copiez (Ctrl+C).
6. Revenez dans l’onglet **Règles** de la console Firebase.
7. Cliquez dans l’éditeur vide puis collez (Ctrl+V).

### Étape 3 : Vérifier la première ligne

- La **toute première ligne** doit être exactement :  
  `rules_version = '2';`  
- Il ne doit pas y avoir d’espace, de ligne vide ou de caractère invisible **avant** cette ligne. Sinon Firebase peut rejeter ou mal interpréter les règles.

### Étape 4 : Publier

1. Cliquez sur le bouton **Publier** (en haut à droite de l’éditeur).
2. Attendez le message de confirmation (quelques secondes).

### Étape 5 : Vérifier dans l’app

1. Attendez 10–20 secondes que les règles soient bien propagées.
2. Rafraîchissez votre application (F5).
3. Connectez-vous et testez (connexion, journal d’activité en tant qu’admin, etc.).

---

## Méthode 2 : Publier avec la ligne de commande Firebase (CLI)

Si vous utilisez déjà **Firebase CLI** et avez un fichier **`firebase.json`** à la racine du projet, vous pouvez déployer uniquement les règles Firestore.

### Prérequis

- Node.js installé.
- Firebase CLI installé : `npm install -g firebase-tools`
- Connexion à votre projet : `firebase login` puis `firebase use <votre-project-id>`

### Déploiement

1. Ouvrez un terminal à la **racine du projet** (là où se trouve `firestore.rules`).
2. Lancez :
   ```bash
   firebase deploy --only firestore:rules
   ```
3. Par défaut, la CLI utilise le fichier **`firestore.rules`**.  
   Si votre `firebase.json` pointe vers un autre fichier (ex. `firestore-rules-complet.rules`), c’est ce fichier qui sera déployé.

### Si vous n’avez pas de `firebase.json`

- Soit vous créez un `firebase.json` qui référence `firestore.rules` (ou `firestore-rules-complet.rules`), puis vous lancez `firebase deploy --only firestore:rules`.
- Soit vous utilisez la **Méthode 1** (console) en copiant le contenu de **`firestore-rules-complet.rules`**.

---

## Règles ajoutées pour le journal d’activité (logs)

Les deux fichiers incluent désormais les règles pour les collections de logs :

- **`logs_connexion`** : tout utilisateur connecté peut **créer** un document (à chaque connexion). Seul l’**admin** peut **lire**. Pas de mise à jour ni suppression.
- **`logs_modification`** : idem (création par tout connecté, lecture réservée à l’admin).

Sans ces règles déployées, la page **Journal d’activité** (admin) ne pourra pas lire les logs et vous pourrez avoir des erreurs « Missing or insufficient permissions » lors de la connexion si d’autres règles ont été modifiées. D’où l’importance de publier le fichier **complet** (méthode 1 ou 2).

---

## En résumé : que faire concrètement

1. **Ne pas remplacer** `firestore-rules-complet.rules` par un autre fichier : il est déjà à jour.
2. **Publier** les règles dans Firebase :
   - Soit en **copiant tout** le contenu de **`firestore-rules-complet.rules`** dans l’onglet **Règles** de la console Firebase, puis en cliquant sur **Publier** (méthode 1).
   - Soit en utilisant **`firebase deploy --only firestore:rules`** si vous utilisez la CLI avec `firestore.rules` (ou le fichier indiqué dans `firebase.json`) (méthode 2).
3. **Vérifier** que la première ligne dans l’éditeur (console ou fichier) est bien `rules_version = '2';` sans rien devant.
4. **Tester** l’app après publication (connexion + journal d’activité en admin).

Si vous suivez ces étapes, les règles (y compris celles des logs) seront correctement déployées et vous n’avez pas à « remplacer » le fichier firestore-rules-complet, seulement à le **publier** dans Firebase.
