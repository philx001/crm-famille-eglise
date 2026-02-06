# 🔥 Index Firestore nécessaires

**Date :** Janvier 2025

---

## ⚠️ Important

Lors du premier déploiement, Firestore peut demander la création d'index composites pour certaines requêtes. Ces erreurs apparaissent dans la console du navigateur avec des liens directs pour créer les index.

---

## 📋 Index à créer

### 1. Collection `programmes`

**Requête :** `where('famille_id', '==', ...) + orderBy('date_debut', 'desc')`

**Création automatique :**
- Cliquez sur le lien dans l'erreur de la console
- Ou créez manuellement dans Firebase Console :
  - Collection : `programmes`
  - Champs indexés :
    - `famille_id` (Ascending)
    - `date_debut` (Descending)

---

### 2. Collection `notifications`

**Requête :** `where('famille_id', '==', ...) + orderBy('created_at', 'desc')`

**Création automatique :**
- Cliquez sur le lien dans l'erreur de la console
- Ou créez manuellement :
  - Collection : `notifications`
  - Champs indexés :
    - `famille_id` (Ascending)
    - `created_at` (Descending)

---

### 3. Collection `sujets_priere`

**Requête :** `where('famille_id', '==', ...) + orderBy('created_at', 'desc')`

**Création automatique :**
- Cliquez sur le lien dans l'erreur de la console
- Ou créez manuellement :
  - Collection : `sujets_priere`
  - Champs indexés :
    - `famille_id` (Ascending)
    - `created_at` (Descending)

---

### 4. Collection `temoignages`

**Requête :** `where('famille_id', '==', ...) + orderBy('created_at', 'desc')`

**Création automatique :**
- Cliquez sur le lien dans l'erreur de la console
- Ou créez manuellement :
  - Collection : `temoignages`
  - Champs indexés :
    - `famille_id` (Ascending)
    - `created_at` (Descending)

---

### 5. Collection `documents`

**Requête :** `where('famille_id', '==', ...) + orderBy('created_at', 'desc')`

**Création automatique :**
- Cliquez sur le lien dans l'erreur de la console
- Ou créez manuellement :
  - Collection : `documents`
  - Champs indexés :
    - `famille_id` (Ascending)
    - `created_at` (Descending)

---

## 🚀 Comment créer les index

### Méthode 1 : Via les liens d'erreur (Recommandé)

1. Ouvrez la console du navigateur (F12)
2. Lorsqu'une erreur d'index apparaît, cliquez sur le lien fourni
3. Vous serez redirigé vers Firebase Console avec l'index pré-configuré
4. Cliquez sur "Créer l'index"
5. Attendez quelques minutes que l'index soit créé

### Méthode 2 : Via Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet
3. Allez dans **Firestore Database** → **Index**
4. Cliquez sur **Créer un index**
5. Configurez selon les spécifications ci-dessus
6. Cliquez sur **Créer**

---

## ✅ Vérification

Une fois les index créés :

1. Rafraîchissez l'application
2. Les erreurs d'index devraient disparaître de la console
3. Les données devraient se charger correctement

---

---

### 6. Collection `notes_personnelles`

**Requête :** `where('auteur_id', '==', ...) + orderBy('created_at', 'desc')`

**Création automatique :** Cliquez sur le lien dans l'erreur de la console si besoin.

**Création manuelle :**
- Collection : `notes_personnelles`
- Champs indexés :
  - `auteur_id` (Ascending)
  - `created_at` (Descending)

---

### 7. Collection `notes_suivi`

**Requête :** `where('famille_id', '==', ...) + where('entite_ref', '==', ...) + orderBy('created_at', 'desc')`

**Création automatique :**
- Cliquez sur le lien dans l'erreur de la console
- Ou créez manuellement :
  - Collection : `notes_suivi`
  - Champs indexés :
    - `famille_id` (Ascending)
    - `entite_ref` (Ascending)
    - `created_at` (Descending)

---

## 📝 Note

Ces erreurs sont **normales** lors du premier déploiement. Une fois les index créés, elles ne réapparaîtront plus.

Les erreurs d'index n'empêchent pas l'application de fonctionner, mais certaines fonctionnalités (listes triées) peuvent ne pas s'afficher correctement jusqu'à ce que les index soient créés.
