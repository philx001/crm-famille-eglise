# Règles Firebase Storage pour les photos de profil

## Problème CORS avec les images

Si vous rencontrez des erreurs CORS lors du chargement des images depuis Firebase Storage, vous devez configurer les règles de sécurité Firebase Storage.

## Configuration des règles

1. **Ouvrez directement la page Règles Storage** : [Firebase Console - Storage Règles (crm-famille-eglise)](https://console.firebase.google.com/project/crm-famille-eglise/storage/rules)
2. Ou : **Firebase Console** → projet **crm-famille-eglise** → **Storage** → onglet **Règles**

## Règles recommandées pour les avatars

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Règle pour les avatars (photos de profil)
    match /avatars/{userId}/{allPaths=**} {
      // Permettre la lecture à tous les utilisateurs authentifiés de la même famille
      allow read: if request.auth != null;
      
      // Permettre l'écriture uniquement à l'utilisateur propriétaire
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Permettre la suppression uniquement à l'utilisateur propriétaire
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Règle pour les documents (existant)
    match /documents/{familleId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

## Alternative : Règles publiques en lecture (moins sécurisé)

Si vous voulez que les images soient accessibles publiquement (sans authentification) :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Avatars : lecture publique, écriture authentifiée
    match /avatars/{userId}/{allPaths=**} {
      allow read: if true; // Public
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Documents : authentification requise
    match /documents/{familleId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

## Après avoir modifié les règles

1. Cliquez sur **"Publier"** pour sauvegarder les règles
2. Attendez quelques secondes que les règles soient propagées
3. Rechargez votre application et testez à nouveau l'upload de photo

## Vérification

Pour vérifier que les règles fonctionnent :
1. Ouvrez la console du navigateur (F12)
2. Essayez d'uploader une photo
3. Vérifiez qu'il n'y a plus d'erreurs CORS
4. Vérifiez que l'image s'affiche correctement

## Note importante

Les erreurs CORS peuvent aussi être causées par :
- Un problème de réseau temporaire
- Des règles mal configurées
- Un token d'authentification expiré

Si le problème persiste après avoir configuré les règles, vérifiez que :
- L'utilisateur est bien authentifié
- Le token Firebase n'a pas expiré
- Les règles sont bien publiées

---

## « Missing or insufficient permissions » lors de l’upload de documents / vidéos / images

Si, dans la page **Documents**, l’upload d’une vidéo ou d’une image échoue avec **« Missing or insufficient permissions »**, les règles Storage ne permettent pas encore l’écriture dans le chemin des documents.

**Oui, vous devez modifier les règles dans la console Firebase.** Le fichier `storage.rules` ou `FIREBASE_STORAGE_RULES.md` dans le projet ne suffit pas : les règles actives sont celles **déployées dans Firebase Console → Storage → Règles**. Il faut les y éditer et **publier**.

**À faire :**

1. Ouvrir **Firebase Console** → **Storage** → **Règles**.
2. S’assurer que les règles contiennent **à la fois** `avatars` **et** `documents` (voir blocs ci‑dessus).
3. En particulier, ce bloc doit être présent pour les documents :
   ```javascript
   match /documents/{familleId}/{allPaths=**} {
     allow read: if request.auth != null;
     allow write: if request.auth != null;
     allow delete: if request.auth != null;
   }
   ```
4. Cliquer sur **Publier**, attendre la propagation, puis réessayer l’upload.

Vous pouvez aussi utiliser le fichier **`storage.rules`** à la racine du projet et déployer avec `firebase deploy --only storage` (en configurant `storage.rules` dans `firebase.json` si besoin).
