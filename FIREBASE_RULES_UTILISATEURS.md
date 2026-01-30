# Règles Firestore – Utilisateurs et fonctions (isAdmin, hasRole)

## Où vérifier `isAdmin()` ?

**Emplacement :** Firebase Console → **Firestore** → onglet **Règles**.

Les **fonctions** (`isAuthenticated`, `getUserData`, `hasRole`, `isAdmin`, `belongsToFamily`) doivent être définies **en haut** du bloc `match /databases/{database}/documents { ... }`, **avant** les `match /familles/...` et `match /utilisateurs/...`.

Sans ces définitions, les règles qui utilisent `isAdmin()` ou `hasRole()` échouent et peuvent provoquer « Missing or insufficient permissions ».

---

## Vérification de `isAdmin()`

`isAdmin()` doit s’appuyer sur le **document Firestore** de l’utilisateur (champ `role`), pas sur les custom claims. Exemple correct :

```javascript
function isAdmin() {
  return isAuthenticated() && getUserData().role == 'admin';
}
```

Et `getUserData()` doit exister et lire le document `utilisateurs/{uid}` :

```javascript
function getUserData() {
  return get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data;
}
```

Si `getUserData()` ou `isAdmin()` n’existent pas, ou si `isAdmin()` lit autre chose (ex. custom claims), corrigez-les comme ci‑dessus.

---

## Règles UTILISATEURS complètes à copier

Voici un bloc **complet** pour `utilisateurs` + les **fonctions** nécessaires. À coller dans l’éditeur de règles (en remplaçant ou en complétant ce que vous avez déjà).

**1. Fonctions (en haut du fichier de règles, dans `match /databases/...`) :**

```javascript
    // === FONCTIONS (à placer en haut, avant les match) ===
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data;
    }

    function hasRole(role) {
      return isAuthenticated() && getUserData().role == role;
    }

    function isAdmin() {
      return isAuthenticated() && getUserData().role == 'admin';
    }

    function belongsToFamily(familleId) {
      return isAuthenticated() && getUserData().famille_id == familleId;
    }
```

**2. Bloc UTILISATEURS (votre logique conservée, avec les mêmes conditions) :**

```javascript
    // UTILISATEURS
    match /utilisateurs/{userId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == userId ||
        isAdmin() ||
        (hasRole('berger') && resource.data.famille_id == getUserData().famille_id) ||
        (hasRole('mentor') && resource.data.mentor_id == request.auth.uid) ||
        (resource.data.famille_id == getUserData().famille_id)
      );

      allow create: if isAuthenticated() &&
        hasRole('mentor') &&
        request.resource.data.famille_id == getUserData().famille_id;

      allow update: if isAuthenticated() && (
        (request.auth.uid == userId &&
         request.resource.data.famille_id == resource.data.famille_id &&
         request.resource.data.role == resource.data.role) ||
        (hasRole('berger') && resource.data.famille_id == getUserData().famille_id) ||
        isAdmin()
      );

      allow delete: if isAuthenticated() && (
        (hasRole('berger') && resource.data.famille_id == getUserData().famille_id) ||
        isAdmin()
      );
    }
```

Votre règle utilisateur est correcte **si** les fonctions `isAdmin()`, `hasRole()`, `getUserData()` et `isAuthenticated()` sont bien définies comme ci‑dessus.

---

## Ordre dans le fichier de règles

Structure typique :

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 1. D’abord les fonctions
    function isAuthenticated() { ... }
    function getUserData() { ... }
    function hasRole(role) { ... }
    function isAdmin() { ... }
    function belongsToFamily(familleId) { ... }

    // 2. Puis les règles par collection
    match /familles/{familleId} { ... }
    match /utilisateurs/{userId} { ... }
    match /programmes/{programmeId} { ... }
    // etc.
  }
}
```

En résumé : la vérification de `isAdmin()` se fait **dans l’éditeur de règles Firestore**, en s’assurant que la fonction `isAdmin()` existe et qu’elle renvoie bien `getUserData().role == 'admin'`. Votre bloc utilisateur est bon tant que ces fonctions sont définies correctement.
