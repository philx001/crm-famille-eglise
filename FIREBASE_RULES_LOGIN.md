# Règles Firestore pour la connexion (login)

Si vous voyez **"Missing or insufficient permissions"** à la connexion, une des lectures/écritures Firestore est refusée par les règles. Voici ce que l’app fait et les règles à avoir.

---

## 1. Connexion (Auth.login)

### Ordre des opérations

1. **Lecture `familles`** (avant authentification)  
   Requête : `familles` où `nom == ...` et `statut == 'actif'`.  
   → L’utilisateur n’est pas encore connecté.

2. **Authentification**  
   `signInWithEmailAndPassword` (Firebase Auth, pas Firestore).

3. **Lecture `utilisateurs/{uid}`**  
   Lecture du document de l’utilisateur connecté.

4. **Mise à jour `utilisateurs/{uid}`**  
   Champ `derniere_connexion`.

### Règles nécessaires

- **`familles`**  
  - Soit lecture autorisée **sans** être connecté (pour l’écran de login).  
  - Soit vous changez l’app pour ne lire la famille qu’après connexion (plus lourd).

- **`utilisateurs`**  
  - Lecture du **document de l’utilisateur connecté** : `request.auth.uid == resource.id`.  
  - Mise à jour du **même document** : `request.auth.uid == resource.id`.  
  - Pour charger la liste des membres après login : lecture des documents dont `famille_id` = famille de l’utilisateur (voir ci‑dessous).

---

## 2. Après connexion : chargement des membres

Après un login réussi, l’app appelle `Membres.loadAll()` qui exécute :

- **Requête** : `utilisateurs` où `famille_id == <id de la famille>`.

Donc les règles doivent autoriser cette requête pour l’utilisateur connecté (par ex. uniquement les documents de sa famille).

---

## 3. Exemple de règles (à adapter)

Dans **Firebase Console → Firestore → Règles**, vous pouvez vous inspirer de ce modèle (à coller dans l’éditeur et adapter à votre structure) :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Fonction : utilisateur connecté
    function isAuthenticated() {
      return request.auth != null;
    }

    // Fonction : doc utilisateur courant
    function getUserData() {
      return get(/databases/$(database)/documents/utilisateurs/$(request.auth.uid)).data;
    }

    // Familles : lecture SANS auth (pour l’écran de login)
    match /familles/{familleId} {
      allow read: if true;
      allow write: if false;
    }

    // Utilisateurs
    match /utilisateurs/{userId} {
      // Lecture : son propre doc OU un doc de la même famille (pour la liste des membres)
      allow read: if isAuthenticated() && (
        request.auth.uid == userId
        || resource.data.famille_id == getUserData().famille_id
      );
      // Écriture : uniquement son propre doc (derniere_connexion, profil, photo_url…)
      allow update: if isAuthenticated() && request.auth.uid == userId;
      allow create, delete: if false; // à adapter si vous créez des users côté app
    }

    // … (reste de vos règles : programmes, notifications, presences, etc.)
  }
}
```

Points importants :

- **`familles`** : `allow read: if true;` pour que le login puisse vérifier la famille **avant** connexion.
- **`utilisateurs`** :  
  - lecture de son doc + lecture des docs avec le même `famille_id` (pour la liste des membres) ;  
  - mise à jour uniquement de son propre doc.

Si votre compte **admin** n’a pas de `famille_id` dans son document `utilisateurs`, la condition `resource.data.famille_id == getUserData().famille_id` peut bloquer la requête. Dans ce cas vous pouvez :

- soit ajouter un `famille_id` au document admin (même famille que les autres),  
- soit ajouter une règle du type :  
  `getUserData().role == 'admin'` pour autoriser l’admin à lire tous les utilisateurs (à faire avec précaution).

---

## 4. Règle UPDATE utilisateurs (obligatoire pour la connexion)

À la connexion, l’app met à jour le champ **`derniere_connexion`** sur le document de l’utilisateur. Sans règle **`allow update`** sur `utilisateurs`, cette mise à jour est refusée et vous pouvez avoir **"Missing or insufficient permissions"** juste après la lecture du document.

À avoir dans le bloc `match /utilisateurs/{userId}` :

```javascript
allow update: if isAuthenticated() && request.auth.uid == userId;
```

Vérifiez aussi que **`isAdmin()`** lit bien le rôle dans Firestore (ex. `getUserData().role == 'admin'`). Si `isAdmin()` utilise des custom claims ou autre chose, l’admin peut ne pas être reconnu pour la requête sur les membres.

---

## 6. Vérifications rapides

1. **Console Firebase → Firestore → Règles**  
   Vérifier qu’il n’y a pas de règle qui supprime la lecture de `familles` ou de `utilisateurs` pour votre cas (login + chargement membres).

2. **Document de l’admin**  
   Dans **Firestore → Données → utilisateurs → [votre uid]** :  
   - Présence de `famille_id` (même valeur que la famille utilisée au login).  
   - `role` = `admin` (ou ce que votre app attend).  
   - `statut_compte` = `actif`.

3. **Après modification des règles**  
   Cliquer sur **Publier**, attendre quelques secondes, puis réessayer la connexion.

---

## 5. Comportement de l’app après les changements

- Si l’erreur se produit **pendant** le login (avant d’arriver au tableau de bord), le message affiché précise maintenant qu’il s’agit des règles Firestore (familles / utilisateurs).
- Si l’erreur se produit **après** le login (au chargement des membres), un message indique que la connexion a réussi mais que le chargement des membres est refusé (règles sur `utilisateurs` / requête par `famille_id`), et vous restez sur le tableau de bord.

En corrigeant les règles comme ci‑dessus (et éventuellement le document admin), l’erreur « Missing or insufficient permissions » à la connexion avec le compte admin devrait disparaître.
