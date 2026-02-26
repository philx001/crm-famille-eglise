# Guide Cursor : modes Auto et Composer (1.5)

Ce fichier résume quand et comment utiliser les modes **Auto** et **Composer** dans Cursor pour obtenir les meilleurs résultats.

---

## Résumé rapide

- **Composer (1.5)** : pour **réfléchir et concevoir** — décider quoi faire et comment, poser des questions, valider les changements pas à pas.
- **Auto** : pour **exécuter une tâche déjà claire** — modifications ciblées, corrections, petites features, sans valider chaque étape.

---

## Composer (Composer 1.5)

**À privilégier quand :**
- Vous voulez **discuter** du design, de l’architecture ou des options avant de coder.
- La tâche est **floue** (« améliorer la page X », « rendre le module Y plus maintenable »).
- Vous voulez **voir et valider** les changements au fur et à mesure (bloc par bloc, fichier par fichier).
- Vous posez des **questions** (« pourquoi ce bug ? », « comment ajouter Z sans casser W ? »).

**Pourquoi ça marche bien :**  
Conversation + contexte du projet + possibilité d’itérer (« plutôt comme ça », « ajoute aussi… »). Vous gardez la main sur le *quoi* et le *comment*.

---

## Mode Auto

**À privilégier quand :**
- La consigne est **précise** (« ajoute un champ email obligatoire », « corrige la condition de concurrence dans create() »).
- Vous voulez que **plusieurs étapes** soient faites d’un coup (plusieurs fichiers, recherche + édition + vérifs).
- Vous faites des **tâches répétitives** ou des **corrections ciblées** et vous faites confiance à l’agent pour les appliquer.

**Pourquoi ça marche bien :**  
L’agent enchaîne recherches, éditions, commandes, sans vous redemander à chaque étape. Vous gagnez du temps sur des tâches bien définies.

---

## Tableau : quand utiliser l’un ou l’autre ?

| Situation | Mode conseillé |
|-----------|----------------|
| « Explique-moi / propose une approche » | **Composer** |
| « Refactorer X en gardant le même comportement » | **Composer** (pour valider la stratégie) |
| « Implémente exactement ce que je viens de décrire » | **Auto** |
| « Corrige ce bug / applique cette règle partout » | **Auto** |
| « Je ne suis pas sûr de ce qu’il faut faire » | **Composer** |
| « J’ai une spec claire, exécute » | **Auto** |

---

## En pratique : quel mode pour les « meilleurs résultats » ?

- **Pour la qualité / pertinence** (bonnes décisions, code cohérent) : souvent **Composer**, car vous pilotez les choix et pouvez affiner à chaque message.
- **Pour la vitesse** sur une tâche déjà claire : souvent **Auto**, car moins d’allers-retours.

En bref : **Composer (1.5)** pour réfléchir et concevoir, **Auto** pour exécuter.

---

## Changer de mode dans une même conversation

**Comportement typique :**  
Le mode (Auto ou Composer) est en général choisi **au démarrage** de la conversation. Dans beaucoup d’outils de ce type, on ne change pas de mode au milieu d’un même chat : il faut **ouvrir une nouvelle conversation** et sélectionner l’autre mode si vous voulez passer d’Auto à Composer ou l’inverse.

**À vérifier dans Cursor :**  
Regarder dans l’interface du panneau de chat (Composer / Agent) s’il existe un **sélecteur ou un bouton** pour basculer entre « Auto » et « Composer » sans fermer la fenêtre. Si ce n’est pas proposé, considérer que le changement de mode = nouvelle conversation.

---

*Document créé pour consultation ultérieure. Dernière mise à jour : février 2025.*
