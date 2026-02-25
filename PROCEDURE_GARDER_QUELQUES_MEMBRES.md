# Garder quelques membres et supprimer tous les autres

Ce document décrit le **moyen le plus sûr** pour ne conserver que certains membres et supprimer tous les autres, sans casser les données ni les références.

---

## Pourquoi ce n’est pas anodin

Chaque membre est présent à **deux endroits** :

1. **Firestore** : document dans la collection `utilisateurs` (profil, rôle, mentor, etc.).
2. **Authentication** : compte de connexion (email / mot de passe).

Et d’autres données **référencent** les membres :

- **presences** : `disciple_id`, `mentor_id`
- **programmes** : `created_by`
- **notifications**, **sujets_priere**, **temoignages** : `auteur_id`
- **documents** : `uploaded_by`
- **utilisateurs** : `mentor_id` (qui est le mentor du disciple)

Si on supprime un membre « à la main » sans gérer ces liens, on obtient des références vers des utilisateurs inexistants et des erreurs dans l’app. D’où l’intérêt d’une procédure claire et, idéalement, d’un script.

---

## Moyen le plus sûr : un script avec liste « à garder »

L’approche recommandée est d’utiliser **un seul script** (Firebase Admin SDK) qui :

1. Lit une **liste de membres à garder** (par exemple leurs adresses e-mail).
2. Pour **tous les autres** membres :
   - nettoie ou réaffecte les données qui les concernent,
   - supprime leur document `utilisateurs`,
   - supprime leur compte **Authentication**.

Ainsi, on ne supprime jamais « à l’aveugle » et on garde la cohérence des données.

---

## Ordre des opérations (ce que le script doit faire)

Pour chaque membre **à supprimer**, il faut agir dans cet ordre :

| Étape | Action | Raison |
|-------|--------|--------|
| 1 | Réaffecter les disciples | Les membres à supprimer peuvent être **mentors**. Pour chaque disciple dont `mentor_id` = un membre supprimé, mettre `mentor_id` = un membre **gardé** (ex. superviseur ou admin). |
| 2 | Supprimer les **presences** | Supprimer les documents `presences` où `disciple_id` = membre supprimé (et éventuellement où `mentor_id` = membre supprimé, si vous ne gardez pas ces pointages). |
| 3 | Mettre à jour les **programmes** | Pour les programmes dont `created_by` = membre supprimé, mettre `created_by` = ID d’un membre **gardé** (ex. un admin/superviseur). |
| 4 | Supprimer ou réattribuer le contenu | Pour **notifications**, **sujets_priere**, **temoignages** : soit supprimer les documents où `auteur_id` = membre supprimé, soit laisser (affichage « ancien membre » selon votre règle métier). Pour **documents** : idem avec `uploaded_by`. |
| 5 | Supprimer le document **utilisateurs** | Supprimer le document Firestore du membre. |
| 6 | Supprimer le compte **Authentication** | Supprimer l’utilisateur dans Firebase Authentication (sinon il pourra encore se connecter avec un profil vide). |

Si vous gardez toujours au moins un **admin** ou **superviseur**, vous pouvez l’utiliser comme « repreneur » pour `created_by` et `mentor_id`.

---

## Ce qu’il faut préparer avant de lancer quoi que ce soit

1. **Liste des membres à garder**  
   - Le plus simple : une liste d’**adresses e-mail** (une par ligne), car c’est stable et lisible.  
   - Ou une liste d’**UID** (identifiants Firebase Auth) si vous préférez.

2. **Membre « repreneur »**  
   - Un membre **gardé** (souvent admin ou superviseur) à qui réattribuer :
     - les disciples dont le mentor est supprimé (`mentor_id`),
     - les programmes dont le créateur est supprimé (`created_by`).

3. **Environnement pour le script**  
   - Node.js installé.  
   - Clé de compte de service Firebase (comme pour le script de reset complet).  
   - Un script dédié (par ex. `scripts/delete-members-except-keep-list.js`) qui lit la liste « à garder » et exécute les étapes ci‑dessus.

4. **Sauvegarde / test**  
   - Idéalement : exporter une copie de la base Firestore (export dans la console ou script) avant la première exécution.  
   - Tester d’abord sur une **copie** du projet Firebase (projet de test) si vous en avez une.

---

## À ne pas faire (pour rester en sécurité)

- **Ne pas** supprimer uniquement dans Firestore en oubliant Authentication (les gens pourraient encore se connecter).
- **Ne pas** supprimer uniquement dans Authentication sans toucher à Firestore (documents orphelins, erreurs dans l’app).
- **Ne pas** faire tout à la main dans la console si vous avez beaucoup de membres et de données (risque d’oubli, ordre des opérations, références cassées).
- **Ne pas** lancer un script de suppression sans avoir une **liste claire et relue** des membres à garder (fichier texte ou CSV).

---

## En résumé

- **Moyen le plus sûr** : un **script unique** (Firebase Admin) qui prend une **liste de membres à garder** (e.g. par email) et, pour tous les autres, fait dans l’ordre : réaffectation des disciples et des programmes → nettoyage des presences et éventuellement autres contenus → suppression document `utilisateurs` → suppression compte Authentication.
- **Mode** : exécution en **ligne de commande**, après préparation de la liste et du membre repreneur, sans supprimer à la main dans la console.
- **Pour l’instant** : ne rien supprimer ; quand vous déciderez de le faire, préparer la liste « à garder », le repreneur, puis utiliser ce script (à créer ou à vous fournir) une première fois de préférence sur un projet de test.

Si vous voulez, on peut ensuite ajouter dans le dépôt un script prêt à l’emploi (`delete-members-except-keep-list.js`) qui lit un fichier `membres-a-garder.txt` (un email par ligne) et exécute exactement ces étapes.
