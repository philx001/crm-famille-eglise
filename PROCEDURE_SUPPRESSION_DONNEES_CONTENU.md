# Supprimer les données de contenu en gardant les membres et les pages

Cette procédure décrit comment supprimer **uniquement les données créées par les membres** (tous rôles confondus) — programmes, présences, témoignages, sujets de prière, notifications, etc. — **sans toucher aux membres, aux familles, ni aux pages de l’application**.

---

## Clarification importante

| Élément | Ce qu’on fait | Ce qu’on garde |
|---------|----------------|----------------|
| **Données (documents Firestore)** | On **supprime** les documents : chaque programme, chaque témoignage, chaque sujet de prière, etc. créé par les membres. | — |
| **Collections Firestore** | On ne supprime **pas** les collections elles-mêmes. Ce sont des conteneurs ; après suppression des documents, elles deviennent vides mais la structure reste. | Les collections (vides) |
| **Pages de l’application** | On ne touche **pas** au code. Les pages Programmes, Sujet de prière, Témoignages, Notifications, etc. font partie de l’application (HTML/JS) ; elles ne sont pas dans Firestore. | Toutes les pages, intactes |

En résumé : on supprime **uniquement les données** (les enregistrements créés par les membres). Les **collections** restent (vides). Les **pages** restent (elles afficheront des listes vides).

---

## Ce qui est conservé

| Élément | Raison |
|---------|--------|
| **Membres** (`utilisateurs`) | Les comptes et profils restent intacts. |
| **Familles** (`familles`) | La structure des familles est conservée. |
| **Comptes Authentication** | Les utilisateurs peuvent toujours se connecter. |
| **Pages / routes de l’application** | Aucune modification du code ; les écrans restent, avec des données vides. |

---

## Ce qui est supprimé (les documents uniquement)

On supprime les **documents** (les enregistrements) dans chaque collection. Les collections restent en place, vides.

| Collection | Documents supprimés (données créées par les membres) |
|------------|------------------------------------------------------|
| **presences** | Tous les pointages de présence aux programmes |
| **programmes** | Tous les programmes (Culte, Partage, Prière, etc.) |
| **notifications** | Toutes les notifications |
| **sujets_priere** | Tous les sujets de prière |
| **temoignages** | Tous les témoignages |
| **documents** | Tous les documents partagés (et éventuellement les fichiers dans Storage) |
| **nouvelles_ames** | Toutes les fiches nouvelles âmes |
| **suivis_ames** | Tous les suivis des nouvelles âmes |
| **sessions_evangelisation** | Toutes les sessions d’évangélisation |
| **secteurs_evangelisation** | Tous les secteurs d’évangélisation |
| **notes_personnelles** | Toutes les notes personnelles |
| **notes_suivi** | Toutes les notes de suivi |
| **logs_connexion** | Journal des connexions |
| **logs_modification** | Journal des modifications |

---

## Ordre de suppression conseillé

Pour éviter les références cassées, supprimer dans cet ordre :

1. **presences** (référence `programme_id` et `disciple_id`)
2. **programmes**
3. **notifications**
4. **sujets_priere**
5. **temoignages**
6. **documents**
7. **suivis_ames** (référence `nouvelle_ame_id`)
8. **nouvelles_ames**
9. **sessions_evangelisation**
10. **secteurs_evangelisation**
11. **notes_personnelles**
12. **notes_suivi**
13. **logs_connexion**
14. **logs_modification**

---

## Deux façons de faire

### Option 1 : Manuel (Console Firebase)

1. Aller dans **Firestore Database** > onglet **Données**.
2. Pour chaque collection listée ci-dessus :
   - Ouvrir la collection.
   - Supprimer les documents un par un (ou par lots si la console le permet).
3. **Logs** : les règles Firestore (`allow delete: if false`) empêchent la suppression des logs depuis l’app. Pour les vider, il faut soit modifier temporairement les règles, soit utiliser un **script avec Admin SDK**.
4. **Storage** : si des documents ont des fichiers associés (ex. pièces jointes), vérifier dans **Storage** et supprimer les fichiers correspondants si besoin.

**Limites** : long si beaucoup de documents ; les logs ne sont pas supprimables via l’app.

---

### Option 2 : Script Node (Firebase Admin SDK) — recommandé

Un script peut **supprimer tous les documents** dans ces collections (les vider), dans le bon ordre, y compris les logs, sans toucher à `utilisateurs` ni `familles`.

**Important** : le script supprime les **documents** (les données), pas les collections. Les collections restent ; elles sont simplement vides. Les pages Programmes, Sujet de prière, Témoignages, etc. restent intactes et afficheront des listes vides.

**Prérequis** : Node.js, clé de compte de service Firebase (comme pour le script de reset complet).

**Idée du script** : même principe que `reset-firestore-data.js`, mais en **excluant** les collections `utilisateurs` et `familles` — on ne supprime que les documents des collections de contenu.

Exemple de collections dont on supprime les documents :

```
presences, programmes, notifications, sujets_priere, temoignages,
documents, suivis_ames, nouvelles_ames, sessions_evangelisation,
secteurs_evangelisation, notes_personnelles, notes_suivi,
logs_connexion, logs_modification
```

---

## Storage (fichiers)

Si vous utilisez **Firebase Storage** pour les documents ou les médias des témoignages :

- Les documents Firestore peuvent référencer des fichiers (ex. `media_url`).
- Supprimer un document Firestore ne supprime pas automatiquement le fichier dans Storage.
- Pour un nettoyage complet : après avoir vidé la collection `documents` (et éventuellement les champs média des témoignages), supprimer manuellement les fichiers dans **Storage** ou via un script Admin SDK.

---

## Après la suppression

- Les **membres** peuvent toujours se connecter.
- Les pages **Programmes**, **Calendrier**, **Notifications**, **Prière**, **Témoignages**, **Documents**, **Nouvelles âmes**, **Évangélisation**, etc. restent accessibles mais affichent des listes vides.
- Vous repartez avec une base « propre » côté contenu, tout en conservant les comptes et la structure des familles.

---

## Résumé

| Objectif | Action |
|---------|--------|
| **Garder** | Membres, familles, comptes Auth, pages de l’app, collections Firestore (conteneurs) |
| **Supprimer** | Uniquement les **documents** (données) : programmes, présences, notifications, prière, témoignages, documents, nouvelles âmes, évangélisation, notes, logs |
| **Moyen le plus sûr** | Script Node (Admin SDK) qui supprime les documents dans ces collections, sans toucher à `utilisateurs` ni `familles` |
| **Mode** | Ligne de commande (terminal) ou manuel dans la Console Firebase |
