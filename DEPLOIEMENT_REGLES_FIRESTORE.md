# Déploiement des règles Firestore (corriger "Missing or insufficient permissions")

## Pourquoi l’erreur apparaît

À la connexion, l’app fait dans l’ordre :

1. **Requête sur `familles`** (sans être connecté) pour trouver la famille par nom.
2. **Connexion** Firebase Auth (email/mot de passe).
3. **Lecture** du document `utilisateurs/{votre uid}`.
4. **Mise à jour** de `derniere_connexion` dans ce même document.

Si une de ces opérations est refusée par les règles, vous voyez « Missing or insufficient permissions ».

## Règles à avoir dans la console

Le fichier `firestore-rules-complet.rules` contient les bonnes règles. Pour qu’elles soient prises en compte :

- La **toute première ligne** du fichier dans la console doit être :  
  `rules_version = '2';`  
  **sans espace, sans ligne vide, sans caractère invisible avant.**

Si quelque chose (ligne vide, espace, BOM) est avant, Firebase peut rejeter les règles ou les mal interpréter.

## Étapes dans la console Firebase

1. Ouvrir [Firebase Console](https://console.firebase.google.com) → votre projet → **Firestore Database** → onglet **Règles**.
2. **Tout sélectionner** dans l’éditeur (Ctrl+A) puis **Supprimer**, pour repartir à zéro.
3. Ouvrir le fichier **`firestore-rules-complet.rules`** dans votre éditeur (VS Code / Cursor).
4. **Sélectionner tout** le contenu (Ctrl+A) et **Copier** (Ctrl+C).
5. Dans la console Firebase, **cliquer dans l’éditeur vide** puis **Coller** (Ctrl+V).
6. Vérifier que la **première ligne** commence bien par `rules_version = '2';` (sans rien devant).
7. Cliquer sur **Publier**.

## Vérification rapide avec des règles minimales (optionnel)

Si après publication vous avez encore l’erreur, vous pouvez tester avec des règles **uniquement pour la connexion** (à utiliser temporairement) :

- **`familles`** : lecture autorisée pour tout le monde (pour la page de login).
- **`utilisateurs`** : lecture et mise à jour uniquement de son propre document (pour profil et `derniere_connexion`).

Fichier à utiliser pour ce test : **`firestore-rules-login-seul.rules`** (voir ci‑dessous).  
Si la connexion fonctionne avec ce fichier, le problème venait du déploiement des règles complètes (syntaxe, première ligne, etc.). Vous pourrez alors repasser à `firestore-rules-complet.rules` en refaisant les mêmes étapes (tout supprimer, coller, vérifier la première ligne, publier).

## Après avoir publié

1. Attendre quelques secondes.
2. Rafraîchir la page de l’app (F5) et réessayer de vous connecter.
3. Si l’erreur persiste, ouvrir la console développeur (F12) et noter **à quelle ligne** de `app-auth.js` l’erreur est levée (ex. 11–14 = requête familles, 30 = lecture utilisateur, 51 = mise à jour).

Cela permet de savoir si le blocage vient de `familles` ou de `utilisateurs`.
