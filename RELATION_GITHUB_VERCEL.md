# Relation GitHub et Vercel – Synthèse

Ce document explique comment GitHub et Vercel sont reliés, comment les déploiements sont déclenchés, et pourquoi les modifications peuvent apparaître en Preview sans être visibles en Production.

---

## 1. Vue d’ensemble du flux

```
[Dépôt GitHub]  →  push sur une branche  →  Vercel reçoit l’événement
                                                    ↓
                                            Vercel clone le code du commit
                                                    ↓
                                            Vercel build (npm install, build…)
                                                    ↓
                                            Un déploiement est créé
                                                    ↓
                        Soit il est assigné à Preview, soit à Production
                        (selon la branche et la config du projet)
```

- **GitHub** : héberge le code (branches, commits).
- **Vercel** : est connecté au dépôt via l’intégration Git ; à chaque push (ou selon la config), il **build** un **commit précis** et crée un **déploiement**.
- Il n’y a **pas** deux « contenus » différents (un pour Preview, un pour Production) : le contenu vient toujours du **même dépôt** et du **même commit**. La différence est **quel déploiement** est attaché à l’environnement **Preview** et **quel déploiement** est attaché à l’environnement **Production**.

---

## 2. Rôle de GitHub

### 2.1 Ce que fait GitHub

- Stocke le code du projet (toutes les branches et tous les commits).
- La **branche par défaut** (souvent `master` ou `main`) est celle utilisée par défaut pour la production sur Vercel (sauf réglage différent).
- À chaque **push**, GitHub envoie un événement (webhook) à Vercel pour lui signaler qu’un nouveau commit existe.

### 2.2 Vérifier que GitHub a bien tout

1. Aller sur **https://github.com/philx001/crm-famille-eglise**.
2. Vérifier la **branche** affichée (en haut à gauche) : par ex. `master`.
3. Vérifier que le **dernier commit** listé est bien celui attendu (ex. « Blocage/archivage membres... »).
4. Cliquer sur ce commit pour voir la liste des **fichiers modifiés** (ex. `app-auth.js`, `app-main.js`, `app-pages.js`).

Si le bon commit et les bons fichiers sont présents sur la branche que tu utilises, **GitHub a bien pris en compte les modifications**. Le problème ne vient alors pas de GitHub mais de **quel déploiement** Vercel affiche en Production.

### 2.3 Branche par défaut

- Dans **GitHub** : **Settings** → **General** → **Default branch** (ex. `master`).
- C’est la branche « principale » du dépôt. Vercel utilise en général cette branche pour la **Production** (sauf configuration explicite d’une autre branche dans le projet Vercel).

---

## 3. Rôle de Vercel

### 3.1 Connexion au dépôt

- Dans **Vercel** : **Settings** → **Git** → **Connected Git Repository**.
- Le projet est lié à un dépôt GitHub (ex. `philx001/crm-famille-eglise`).
- À chaque push (ou selon les options), Vercel :
  1. Reçoit l’événement du push.
  2. Récupère le **code du commit** poussé (clone du dépôt à ce commit).
  3. Lance un **build** (install des dépendances, commande de build).
  4. Crée un **déploiement** avec les fichiers générés.

Le **contenu** d’un déploiement est donc **exactement** le code de ce commit : il n’y a pas de « contenu Preview » vs « contenu Production » en soi, seulement des **déploiements différents** (issus de commits différents ou du même commit).

### 3.2 Les deux environnements : Preview et Production

| Environnement | Rôle | URL typique |
|---------------|------|-------------|
| **Preview** | Déploiements « de test » (branches, ou dernier build avant mise en prod). | `crm-famille-eglise-xxx.vercel.app` ou lien propre au déploiement. |
| **Production** | Déploiement servi sur le domaine principal. | `crm-famille-eglise.vercel.app` |

- **Preview** : chaque build peut être marqué Preview par défaut (ex. après un push sur la branche de production, avant promotion).
- **Production** : un **seul** déploiement à la fois est « en Production ». C’est celui qui est servi sur le domaine principal.

Donc : **même dépôt, même branche** – ce qui change, c’est **quel déploiement** (quel commit) est actuellement assigné à Production. Si la Production pointe sur un **ancien** déploiement et que le **dernier** build est seulement en Preview, tu vois l’ancienne version sur le domaine principal.

### 3.3 Pourquoi les modifs sont en Preview et pas en Production

- Le **dernier** push a créé un **nouveau** déploiement (avec le dernier code).
- Ce déploiement a été créé en **Preview** (comportement courant quand Vercel ne le promeut pas automatiquement en Production).
- La **Production** pointe encore sur un **déploiement précédent** (ancien commit).

Résultat : le contenu **n’est pas** différent « par défaut » entre Preview et Production ; c’est simplement que **deux commits différents** sont affichés : le dernier en Preview, un ancien en Production.

---

## 4. Vérifier et corriger côté Vercel

### 4.1 Vérifier quel commit est en Production

1. **Vercel** → projet **crm-famille-eglise** → onglet **Deployments**.
2. Repérer le déploiement marqué **Production** (badge ou filtre).
3. Noter le **commit** (message ou hash) de ce déploiement.
4. Si ce n’est **pas** ton dernier commit (ex. « Blocage/archivage membres... »), la Production n’est pas à jour.

### 4.2 Mettre la dernière version en Production

1. Dans **Deployments**, trouver le déploiement dont le commit est le **dernier** (celui que tu vois en Preview avec les bonnes modifs).
2. Cliquer sur les **trois points (⋯)** à droite de ce déploiement.
3. Choisir **Promote to Production**.
4. Attendre la fin de l’opération.
5. Ouvrir **crm-famille-eglise.vercel.app** (idéalement en **Ctrl+F5** ou en navigation privée pour éviter le cache).

Après cela, **Production** a le **même contenu** que le déploiement Preview que tu as promu.

### 4.3 Forcer un nouveau build si besoin

- Si tu veux être sûr que Vercel reconstruit tout : **Deployments** → sur le déploiement concerné → **⋯** → **Redeploy**.
- Tu peux décocher **Use existing Build Cache** pour un build entièrement neuf (option selon l’interface).

---

## 5. Récapitulatif des points clés

| Question | Réponse |
|----------|---------|
| Le contenu Preview et Production vient-il de sources différentes ? | **Non.** Les deux viennent du **même dépôt GitHub**. |
| Pourquoi ne vois-je pas mes modifs sur le domaine principal ? | La **Production** pointe encore sur un **ancien déploiement** (ancien commit). Le dernier build est en **Preview**. |
| Comment s’assurer que GitHub a tout ? | Vérifier sur GitHub la branche (ex. `master`) et le dernier commit + les fichiers modifiés. |
| Comment aligner Production sur le dernier code ? | **Deployments** → déploiement du dernier commit → **⋯** → **Promote to Production**. |
| Branche par défaut GitHub vs Vercel ? | Vercel utilise en général la **branche par défaut** du dépôt pour la Production. Ici : `master`. |

---

## 6. En cas de problème

- **Les modifs ne sont pas sur GitHub** : vérifier les `git status`, `git push origin master`, et la branche sur laquelle tu travailles.
- **Les modifs sont sur GitHub mais pas en Production** : utiliser **Promote to Production** sur le bon déploiement dans Vercel.
- **Le site en Production ne se met pas à jour après promotion** : vider le cache (Ctrl+F5, navigation privée) ou attendre quelques minutes (cache CDN).
- **Logo visible sur une URL (Preview) mais pas sur l’autre (domaine principal)** : promouvoir le déploiement Preview en Production (4.2), puis recharger avec Ctrl+F5.

Ce document peut être conservé dans le projet pour référence future sur la relation GitHub–Vercel.
