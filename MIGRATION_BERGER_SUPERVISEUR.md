# Migration berger → superviseur (base de données)

Ce document décrit comment migrer les données Firestore après le renommage du rôle **berger** en **superviseur** et **adjoint_berger** en **adjoint_superviseur** dans l’application.

## Prérequis

- Déployer d’abord le **code** et les **règles Firestore** mis à jour (les règles utilisent désormais `superviseur` et `adjoint_superviseur`).
- Exécuter la migration des données **après** le déploiement, sinon les anciens rôles ne seront plus reconnus par les règles.

## 1. Collection `utilisateurs`

Pour chaque document dont le champ `role` vaut `berger` ou `adjoint_berger`, mettre à jour :

| Ancienne valeur   | Nouvelle valeur        |
|-------------------|-------------------------|
| `berger`          | `superviseur`           |
| `adjoint_berger`  | `adjoint_superviseur`   |

### Option A : Console Firebase

1. Ouvrir [Firebase Console](https://console.firebase.google.com) → votre projet → **Firestore**.
2. Collection **utilisateurs** : filtrer ou parcourir les documents.
3. Pour chaque document avec `role` = `berger` ou `adjoint_berger`, éditer le champ `role` et mettre `superviseur` ou `adjoint_superviseur`.

### Option B : Script Node (Admin SDK)

Exemple avec Firebase Admin SDK (à lancer une fois, en local ou sur un serveur de confiance) :

```js
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'VOTRE_PROJECT_ID' });
const db = admin.firestore();

async function migrateRoles() {
  const snap = await db.collection('utilisateurs').get();
  const batch = db.batch();
  let count = 0;
  snap.docs.forEach((doc) => {
    const data = doc.data();
    const role = data.role;
    if (role === 'berger' || role === 'adjoint_berger') {
      const newRole = role === 'berger' ? 'superviseur' : 'adjoint_superviseur';
      batch.update(doc.ref, { role: newRole });
      count++;
    }
  });
  await batch.commit();
  console.log(`${count} document(s) utilisateurs mis à jour.`);
}
migrateRoles().catch(console.error);
```

## 2. Collection `documents` (visibilité)

Les documents peuvent avoir un champ `visibilite` avec les valeurs :

- `mentors_berger` → remplacer par **`mentors_superviseur`**
- `berger_seul` → remplacer par **`superviseur_seul`**

L’application ne propose plus que `mentors_superviseur` et `superviseur_seul` ; les anciennes valeurs ne seront plus prises en compte par le filtre d’affichage.

### Option A : Console Firebase

Dans la collection **documents**, pour chaque document dont `visibilite` vaut `mentors_berger` ou `berger_seul`, mettre à jour vers `mentors_superviseur` ou `superviseur_seul`.

### Option B : Script Node

```js
async function migrateDocumentsVisibilite() {
  const snap = await db.collection('documents').get();
  const batch = db.batch();
  let count = 0;
  snap.docs.forEach((doc) => {
    const v = doc.data().visibilite;
    if (v === 'mentors_berger' || v === 'berger_seul') {
      const newV = v === 'mentors_berger' ? 'mentors_superviseur' : 'superviseur_seul';
      batch.update(doc.ref, { visibilite: newV });
      count++;
    }
  });
  await batch.commit();
  console.log(`${count} document(s) documents (visibilité) mis à jour.`);
}
```

## 3. Vérification

- Se connecter avec un compte qui était **berger** : le rôle affiché doit être **Superviseur** et les droits identiques.
- Se connecter avec un compte **adjoint_berger** : le rôle affiché doit être **Adjoint superviseur**.
- Vérifier que les écrans réservés aux anciens bergers (export global, stats par mentor, etc.) restent accessibles avec le rôle **superviseur**.

## 4. Récapitulatif des changements dans le code

- **Rôles** : `berger` → `superviseur`, `adjoint_berger` → `adjoint_superviseur`.
- **Visibilité des documents** : `mentors_berger` → `mentors_superviseur`, `berger_seul` → `superviseur_seul`.
- **Libellés affichés** : « Berger » → « Superviseur », « Adjoint Berger » → « Adjoint superviseur ».
- **Règles Firestore** : `hasRole('berger')` → `hasRole('superviseur')`, idem pour adjoint.

Les droits et comportements associés à l’ancien rôle berger sont inchangés pour le superviseur.
