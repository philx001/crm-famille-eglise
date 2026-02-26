# Procédure : Changer l’URL Vercel (XXXX.vercel.app → ZZZZ.vercel.app)

Ce document décrit comment passer d’une URL du type `XXXXXXXX.vercel.app` à une autre du type `ZZZZZ.vercel.app`, sans créer de conflits sur GitHub ni sur Vercel.

---

## 1. Comprendre d’où vient l’URL Vercel

- L’URL `*.vercel.app` est déterminée par le **nom du projet** dans Vercel.
- Exemple : projet nommé `crm-famille-eglise` → `crm-famille-eglise.vercel.app`.
- Pour obtenir `ZZZZZ.vercel.app`, il faut que le **nom du projet Vercel** soit `ZZZZZ` (sans espaces, minuscules, caractères alphanumériques et tirets uniquement).

**Important :** Le nom du dépôt GitHub et le nom des dossiers sur votre PC n’ont **pas** besoin de changer pour modifier l’URL Vercel. Seul le **nom du projet sur Vercel** compte pour `*.vercel.app`.

---

## 2. Modifications des noms (résumé)

| Élément | À modifier ? | Commentaire |
|--------|--------------|-------------|
| **Nom du projet Vercel** | Oui | C’est lui qui donne `ZZZZZ.vercel.app`. |
| **Nom du dépôt GitHub** | Non (souvent) | Vous pouvez le laisser tel quel ; le lien Vercel ↔ GitHub reste par connexion Git, pas par nom. |
| **Dossiers / code en local** | Non | Aucun renommage de dossiers nécessaire pour changer l’URL Vercel. |
| **Variables d’environnement** | À vérifier | Si vous stockez l’URL du site (ex. pour CORS, callbacks, emails), mettez à jour après le changement. |

---

## 3. Étapes détaillées (sans créer de problème)

### 3.1 Préparation (avant toute modification)

1. **Vérifier les références à l’ancienne URL**
   - Dans le code : recherche de `XXXXXXXX.vercel.app` (ou l’URL actuelle) dans tout le projet (config, CORS, redirect URIs OAuth, callbacks, liens en dur, etc.).
   - Dans Firebase / autres services : Redirect URIs, domaines autorisés, origines CORS.
   - Noter tous les endroits à mettre à jour une fois la nouvelle URL active.

2. **Vérifier le nom souhaité sur Vercel**
   - Le nom du projet doit respecter les règles Vercel (souvent : minuscules, chiffres, tirets ; pas d’espaces).
   - Vérifier que `ZZZZZ` n’est pas déjà pris par un autre projet sur votre compte Vercel (les noms de projet sont uniques par compte/équipe).

### 3.2 Sur Vercel : renommer le projet (changer l’URL)

1. Aller sur [vercel.com](https://vercel.com) et ouvrir le **projet** concerné (celui qui donne actuellement `XXXXXXXX.vercel.app`).
2. Ouvrir **Settings** (Paramètres) du projet.
3. Dans la section **General**, trouver le champ **Project Name** (ou équivalent).
4. Remplacer le nom actuel (ex. `XXXXXXXX`) par le nouveau (ex. `ZZZZZ`).
5. Enregistrer (Save).

**Effet :**
- L’ancienne URL `XXXXXXXX.vercel.app` ne sera plus utilisée pour ce projet.
- La nouvelle URL sera `ZZZZZ.vercel.app`.
- Les déploiements existants (Git) continuent de fonctionner ; seules les URLs changent.

**À savoir :** Après renommage, l’ancienne URL peut parfois rediriger un temps vers la nouvelle, mais il ne faut pas s’y fier à long terme. Toute configuration (Firebase, OAuth, etc.) doit pointer vers `ZZZZZ.vercel.app`.

### 3.3 Sur GitHub : rien d’obligatoire pour l’URL

- Vous **n’avez pas** besoin de renommer le dépôt pour que Vercel utilise `ZZZZZ.vercel.app`.
- La connexion Vercel ↔ GitHub est faite par **l’intégration Git** (repo lié au projet), pas par le nom du dépôt.
- Si vous renommez quand même le dépôt :
  - GitHub propose une redirection des anciennes URLs vers le nouveau nom.
  - Dans Vercel, le projet reste lié au même repo ; en général aucun réglage à refaire.

### 3.4 Noms de dossiers (en local ou sur le serveur)

- Aucune obligation de renommer des dossiers pour changer l’URL Vercel.
- Vercel déploie le **contenu** du dépôt (branche, racine ou sous-dossier configuré), pas le nom du dossier sur votre machine.
- Vous pouvez donc garder par exemple `crm-famille-eglise-main` en local ; l’URL sera bien `ZZZZZ.vercel.app` tant que le **nom du projet Vercel** est `ZZZZZ`.

### 3.5 Après le changement d’URL : mises à jour à faire

1. **Firebase (Authentication, Hosting, etc.)**
   - Ajouter `ZZZZZ.vercel.app` dans les domaines autorisés / origines autorisées / Redirect URIs, selon ce que vous utilisez.
   - Optionnel : retirer l’ancien domaine après une période de transition.

2. **Variables d’environnement**
   - Dans Vercel (Settings → Environment Variables), si une variable contient l’ancienne URL (ex. `SITE_URL` ou `NEXT_PUBLIC_APP_URL`), la mettre à jour vers `https://ZZZZZ.vercel.app` (ou la nouvelle URL que vous utilisez).

3. **Code source**
   - Remplacer toute occurrence de `XXXXXXXX.vercel.app` par `ZZZZZ.vercel.app` (config, callbacks, CORS, etc.).
   - Commit + push pour que les prochains déploiements soient cohérents.

4. **Documentation / signets**
   - Mettre à jour les docs, README, signets, et tout lien partagé vers l’ancienne URL.

---

## 4. Ordre recommandé (pour éviter les problèmes)

1. Choisir le nouveau nom `ZZZZZ` et vérifier qu’il est valide et dispo sur Vercel.
2. Préparer les mises à jour (liste des endroits à modifier une fois l’URL changée).
3. Sur Vercel : renommer le projet en `ZZZZZ` et vérifier que le site répond bien sur `ZZZZZ.vercel.app`.
4. Mettre à jour Firebase (et autres services) avec la nouvelle URL.
5. Mettre à jour les variables d’environnement et le code si nécessaire, puis commit + push.
6. Tester connexion, auth, callbacks, etc. sur `ZZZZZ.vercel.app`.
7. (Optionnel) Retirer l’ancienne URL des configs après une courte période de transition.

---

## 5. Résumé en une phrase

**Pour avoir `ZZZZZ.vercel.app` : renommez uniquement le nom du projet dans les paramètres du projet Vercel en `ZZZZZ` ; vous n’avez pas besoin de renommer des dossiers ni le dépôt GitHub, mais vous devez mettre à jour tout ce qui référence l’ancienne URL (Firebase, variables d’env, code).**
