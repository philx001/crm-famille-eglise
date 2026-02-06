# Vérifier que GitHub et Vercel ont la bonne version

## Pourquoi les commits vont en Preview et pas en Production ?

Vercel associe la **Production** à **une seule branche** (souvent `main`). Tout push sur une **autre** branche (ex. `master`) crée uniquement un déploiement **Preview**. Donc si tu travailles sur `master` depuis Cursor et que la branche de production Vercel est `main`, tes commits n’iront jamais automatiquement en Production.

**Solution durable :** faire en sorte que la branche sur laquelle tu pushes soit celle utilisée pour la Production.

---

## Faire en sorte que tes commits aillent directement en Production

### Étape 1 : Changer la branche de production dans Vercel

1. Va sur **https://vercel.com** → ton projet **crm-famille-eglise**.
2. Onglet **Settings** (Paramètres).
3. Dans le menu de gauche : **Git**.
4. Repère **Production Branch** (Branche de production).
5. Si c’est `main` alors que tu pushes sur **master** depuis Cursor :
   - Clique sur **Edit** à côté de Production Branch.
   - Remplace `main` par **master** (ou la branche que tu utilises).
   - Enregistre (**Save**).

À partir de là, **chaque push sur `master`** déclenchera un déploiement et le mettra automatiquement en **Production** (plus seulement en Preview).

### Étape 2 : Une fois la config changée

- Les **prochains** commits poussés sur `master` iront en Production.
- Pour le **code déjà poussé** (logo, archivage, etc.) : soit tu refais un petit commit et push (il partira en prod), soit tu fais une **Promote to Production** une dernière fois (voir section 2 ci‑dessous).

---

## 1. Vérifier que GitHub a bien tous les fichiers (commit b5d7b4e)

1. Ouvre **https://github.com/philx001/crm-famille-eglise**
2. En haut à gauche, vérifie la **branche** : clique dessus (souvent `main` ou `master`).
3. **Important** : Vercel déploie souvent la branche **Production** définie dans les réglages. Si c’est `main`, il faut que `main` contienne tes derniers commits.

### Vérifier le dernier commit sur GitHub

- Sur la page d’accueil du dépôt, regarde la ligne sous la barre de recherche :  
  « **Blocage/archivage membres: bloquer et debloquer...** » avec le hash **b5d7b4e**.
- Clique sur ce commit (ou sur « X commits »).
- Vérifie que les fichiers modifiés listés incluent au moins :  
  **app-auth.js**, **app-main.js**, **app-pages.js**.

### Si la branche affichée est `main` et qu’elle est en retard

Tes commits sont peut-être sur **master** alors que la production Vercel est sur **main**.

**Option A – Mettre à jour `main` avec `master` (recommandé)**  
Dans ton terminal (à la racine du projet) :

```bash
git checkout main
git pull origin main
git merge master
git push origin main
```

(Si `main` n’existe pas en local : `git checkout -b main origin/main` puis `git merge master` et `git push origin main`.)

**Option B – Dire à Vercel d’utiliser `master`**  
1. Vercel → ton projet **crm-famille-eglise** → **Settings** → **Git**  
2. **Production Branch** : remplace `main` par **master**  
3. Enregistre. Les prochains déploiements production partiront de **master**.

---

## 2. Vérifier que Vercel a bien reçu les bons fichiers

1. Va sur **https://vercel.com** → projet **crm-famille-eglise**.
2. Onglet **Deployments**.
3. Regarde le déploiement en **Production** (badge « Production ») :
   - Clique dessus.
   - Regarde le **commit** : il doit être **b5d7b4e** (ou un message du type « Blocage/archivage membres... »).
   - Si le commit est plus ancien, la production n’est pas à jour.

### Mettre la dernière version en production (important)

**Redéployer** ne suffit pas : ça reconstruit le même déploiement. Il faut **Promote to Production** pour que le domaine principal (crm-famille-eglise.vercel.app) pointe sur le bon build.

1. Dans **Deployments**, **affiche tous les déploiements** (pas seulement Production) ou filtre pour voir les Preview.
2. Trouve le déploiement dont le commit est **« fix(sidebar): URL absolue pour le logo... »** (ou **65bd908**) — c’est celui que tu vois quand tu cliques sur le lien Vercel depuis la page Preview de GitHub.
3. À droite de ce déploiement : **⋯** (trois points) → **Promote to Production**.
4. Attends la fin. Ouvre **crm-famille-eglise.vercel.app** en navigation privée ou avec **Ctrl+F5** pour éviter le cache.

---

## 3. Checklist rapide

| Étape | Où | Ce qu’il faut voir |
|-------|----|--------------------|
| Dernier commit sur GitHub | github.com/philx001/crm-famille-eglise | « fix(sidebar): URL absolue... » / 65bd908 sur la branche où tu pushes |
| Branche de production Vercel | Vercel → Settings → Git | **Production Branch** = **master** (si tu pushes depuis Cursor sur master) |
| Commit servi en Production | Vercel → Deployments → déploiement avec badge Production | Commit = 65bd908 (logo). Sinon : **Promote to Production** sur ce déploiement. |

---

## 4. Cause la plus probable

Si « Archivage des membres » n’apparaît pas dans le menu alors que le code est dans le repo :

- **Vercel déploie la branche `main`** alors que tes derniers commits sont sur **master** : soit tu merges master dans main et tu pousses (option A ci-dessus), soit tu passes la Production Branch à **master** (option B).
- Ou le déploiement Production n’est pas le bon : utilise **Promote to Production** sur le déploiement du commit **b5d7b4e**.

Après ça, recharge le site (Ctrl+F5 ou navigation privée) pour voir « Archivage des membres » dans Administration.
