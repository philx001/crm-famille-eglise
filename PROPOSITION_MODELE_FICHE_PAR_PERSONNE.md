# Proposition : modèle « une fiche par personne » (Nouvelles âmes)

## Contexte et objectif

Actuellement, une même personne peut apparaître plusieurs fois dans les Nouvelles âmes (plusieurs documents Firestore) : un par canal, par saisie ou par conversion depuis l’évangélisation. Cela fausse les statistiques et la lisibilité.

**Objectif :** un seul enregistrement par personne (une fiche = une âme), avec **un seul canal** parmi les 3 actuels et **une seule catégorie** (NA ou NC).

---

## 1. Principe retenu

| Règle | Description |
|--------|-------------|
| **1 fiche = 1 personne** | Une seule entrée dans `nouvelles_ames` par individu au sein d’une famille. |
| **1 canal** | Un seul des 3 canaux (Évangélisation, Culte du dimanche, Culte en Semaine). Choisi à la première création ; en cas de doublon détecté, on ne crée pas une seconde fiche. |
| **1 catégorie** | Une seule des 2 catégories : NA (Nouveaux Arrivants) ou NC (Nouveaux Convertis). Modifiable ensuite sur la fiche. |
| **Statut de suivi** | Inchangé : nouveau, en_suivi, integre, inactif, perdu (un par fiche). |

---

## 2. Clé d’unicité proposée

Pour savoir si « la personne existe déjà », il faut une clé stable et peu ambiguë.

**Recommandation :** **`(famille_id, email_normalise)`** comme clé principale d’unicité, avec fallbacks lorsque l’email est absent.

- **Email en premier** : pas d’ambiguïté de saisie (espaces, préfixes pays, 0 en tête, etc.). Normalisation simple : **minuscules + trim** ; pas de variantes régionales comme pour le téléphone.
- Dans l’app actuelle, l’**email est optionnel** au formulaire. Donc on ne peut pas l’utiliser comme seule clé : il faut des **fallbacks** pour les fiches sans email (données anciennes, imports, ou personnes qui ne renseignent pas l’email).

**Ordre de la clé d’unicité :**

1. **Si `email` présent et non vide** → unicité par **`(famille_id, email_normalise)`** (email en minuscules, trim).
2. **Sinon, si `telephone` présent et non vide** → unicité par **`(famille_id, telephone_normalise)`** (chiffres seuls).
3. **Sinon** → unicité par **`(famille_id, prenom_normalise, nom_normalise)`** (minuscules, trim).

**Normalisation recommandée :**

- `email_normalise` : `email.trim().toLowerCase()` ; stocker en base pour les comparaisons.
- `telephone_normalise` : chiffres seuls (pour le fallback et la migration).
- Prénom/nom : minuscules, trim (pour le dernier fallback).

Cela évite les doublons dus aux variantes de saisie du numéro tout en couvrant les cas sans email.

---

## 3. Modèle Firestore (structure inchangée)

- **Collection `nouvelles_ames`** : pas de changement de champs. Chaque document reste avec `canal` (un seul), `categorie` (na | nc), `statut`, `famille_id`, etc.
- **Collection `suivis_ames`** : inchangée ; chaque suivi reste lié à un `nouvelle_ame_id` (une seule fiche après migration).

Contrainte d’unicité = **applicative** (vérification avant création / lors de la conversion), pas une contrainte Firestore native (Firestore n’en a pas).

---

## 4. Migration des données existantes (fusion des doublons)

### 4.1 Objectif

Regrouper tous les documents qui correspondent à la **même personne** (même clé d’unicité) en **un seul document**, et rattacher tous les suivis à cette fiche conservée.

### 4.2 Algorithme de fusion (recommandé)

1. **Charger** toutes les `nouvelles_ames` de la famille (déjà possible avec la requête actuelle `where('famille_id', '==', ...)`).
2. **Grouper** côté client par clé d’unicité (dans cet ordre) :
   - `email_normalise` si email présent et non vide ;
   - sinon `telephone_normalise` si téléphone présent et non vide ;
   - sinon `(prenom_normalise, nom_normalise)`.
3. Pour chaque groupe contenant **plus d’un document** :
   - **Choisir la fiche à conserver** (ex. celle avec `statut === 'integre'` si une existe, sinon la plus ancienne `created_at`, ou la plus complète en champs renseignés).
   - **Fusionner les champs** utiles des autres fiches dans la fiche conservée (ex. garder la date de premier contact la plus ancienne, le dernier `date_dernier_contact`, fusionner les commentaires, etc.). Canal : garder celui de la fiche conservée, ou définir une règle (ex. priorité culte > exhortation > évangélisation). Catégorie : idem (ex. NC si au moins une fiche était NC).
   - **Réattribuer les suivis** : pour chaque document de `suivis_ames` dont `nouvelle_ame_id` est l’un des IDs qu’on supprime, faire un `update` pour mettre `nouvelle_ame_id` = ID de la fiche conservée.
   - **Supprimer** les autres documents `nouvelles_ames` du groupe (après mise à jour des suivis).
4. Exécuter la migration **par famille** (ou en une fois pour toutes les familles avec un script admin), idéalement en **mode batch** (Firestore `writeBatch` pour limiter les écritures et garder la cohérence).

### 4.3 Risques migration et parades

| Risque | Parade |
|--------|--------|
| Données incohérentes si migration interrompue | Utiliser des batches Firestore ; faire une **sauvegarde export** (ex. CSV/JSON) des `nouvelles_ames` + `suivis_ames` avant migration. |
| Même email ou même téléphone pour 2 personnes distinctes | Cas rare ; la migration fusionne. À long terme, afficher un avertissement en création si l’email (ou le téléphone en fallback) existe déjà et permettre à l’utilisateur de « forcer » l’ajout (option avancée, à définir). |
| Performances (nombreux documents) | Migration en tâche de fond (script Node ou Cloud Function), par lots de familles ou par batch de 500 écritures. |

---

## 5. Modifications applicatives (sans toucher au code pour l’instant)

### 5.1 Création d’une nouvelle âme (formulaire « Ajouter »)

- Avant d’appeler `NouvellesAmes.create(data)` :
  1. Calculer la clé d’unicité : `email_normalise` si email fourni, sinon `telephone_normalise` (chiffres seuls), sinon `(prenom_normalise, nom_normalise)`.
  2. Vérifier l’existence dans le cache (chargé par `famille_id`) : une fiche avec la même clé existe-t-elle ?
  3. Si une fiche existe : **ne pas créer** de nouveau document ; afficher un message du type « Cette personne est déjà enregistrée » avec un lien vers la fiche existante, et éventuellement proposer de mettre à jour le canal/catégorie si la politique le permet.
  4. Si aucune fiche : créer comme aujourd’hui (un seul canal, une seule catégorie).

**Recommandation :** garder le chargement global par `famille_id` (déjà en cache) et faire la vérification d’unicité **en mémoire** sur le cache (par `email_normalise`, puis `telephone_normalise`, puis prenom+nom). Aucun nouvel index Firestore nécessaire.

### 5.2 Conversion « Contact → Nouvelle âme » (évangélisation)

- Dans `convertContactToNouvelleAme` (ou équivalent) : avant de créer une nouvelle âme, **vérifier** si une fiche existe déjà (même clé : famille + email normalisé, ou à défaut téléphone normalisé, ou prenom+nom).
  - Si **oui** : ne pas créer ; afficher un toast « Déjà enregistré(e) dans les Nouvelles âmes » + lien vers la fiche.
  - Si **non** : créer une fiche avec `canal: 'evangelisation'` comme aujourd’hui.

### 5.3 Interface utilisateur

- **Liste :** reste une ligne par document ; après migration, une ligne = une personne (plus de doublons).
- **Fiche détail :** un seul canal et une seule catégorie affichés ; possibilité de modifier canal/catégorie si besoin (règles métier à préciser).
- **Filtres / exports / PDF :** inchangés ; les stats (NA, NC, par canal, à relancer, intégrés) reflètent désormais des **personnes** uniques.

### 5.4 Champs de normalisation optionnels

- En **création** et **mise à jour**, stocker :
  - **`email_normalise`** : `email.trim().toLowerCase()` si email renseigné (clé principale d’unicité).
  - **`telephone_normalise`** : chiffres seuls (fallback d’unicité et recherche).  
  Facultatifs si la vérification se fait entièrement en mémoire à partir du cache.

---

## 6. Statistiques

- **Comptes (total, NA, NC, par canal, à relancer, intégrés par période)** : calculés comme aujourd’hui sur les documents de `nouvelles_ames`. Après migration, chaque document = une personne, donc les chiffres deviennent **cohérents** (plus de double comptage).
- **Évolution mensuelle / intégrés par période** : inchangées ; simplement basées sur des fiches déjà dédoublonnées.

Aucun changement de formules nécessaire ; seule la **qualité des données** (une fiche par personne) corrige les incohérences.

---

## 7. Risques techniques globaux et parades

| Risque | Gravité | Parade |
|--------|--------|--------|
| **Migration partielle ou erreur** | Élevée | Sauvegarde export avant migration ; migration en batch ; script réversible (documenter « fiche conservée » vs « fiches fusionnées ») ou restauration depuis sauvegarde. |
| **Index Firestore** | Faible | Si on reste sur lecture par `famille_id` + filtre en mémoire, aucun nouvel index. Si on ajoute plus tard une requête par `telephone_normalise`, créer l’index composite indiqué par la console Firebase. |
| **Règles Firestore** | Faible | Pas de changement nécessaire ; les règles actuelles sur `nouvelles_ames` et `suivis_ames` restent valides. |
| **Conversion évangélisation en double** | Moyenne | Vérification systématique par email (puis téléphone, puis prenom+nom) avant création ; message clair si déjà existant. |
| **Utilisateurs qui saisissent deux fois la même personne** (email ou téléphone légèrement différent) | Moyenne | Normalisation stricte : email en minuscules/trim, téléphone en chiffres seuls ; avertissement si la clé existe déjà. |
| **Performance du cache** | Faible | Le cache actuel charge déjà toutes les nouvelles âmes de la famille ; après migration, moins de documents, donc charge égale ou inférieure. |

---

## 8. Ordre de déploiement recommandé (quand vous passerez à l’implémentation)

1. **Sauvegarde** : export des collections `nouvelles_ames` et `suivis_ames` (CSV/JSON ou script d’export Firestore).
2. **Normalisation** : ajouter en écriture le champ `telephone_normalise` (et éventuellement prenom/nom normalisés) pour les nouvelles créations et, si besoin, lors de la migration pour les anciennes.
3. **Migration** : script de fusion (hors app ou page admin dédiée) : regroupement par clé, fusion des champs, réattribution des `suivis_ames`, suppression des doublons. Tester d’abord sur une **copie de la base** ou une famille de test.
4. **Application** :  
   - Dans `NouvellesAmes.create` : vérification d’unicité (cache ou requête) avant `add()`.  
   - Dans la conversion évangélisation : même vérification avant création.  
   - Messages utilisateur : « Déjà enregistré » + lien vers la fiche existante.
5. **Vérification** : contrôler les stats (total, NA, NC, intégrés) et quelques fiches manuellement après migration.

---

## 9. Résumé

- **Modèle** : une fiche par personne, un canal, une catégorie (NA/NC). Structure Firestore inchangée ; contrainte assurée par la logique applicative et la migration.
- **Clé d’unicité** : **`(famille_id, email_normalise)`** en priorité (évite les ambiguïtés de saisie du numéro) ; si pas d’email : `(famille_id, telephone_normalise)` puis `(famille_id, prenom_normalise, nom_normalise)`.
- **Migration** : fusion des doublons par clé, conservation d’une fiche, réattribution des suivis, suppression des autres documents ; sauvegarde préalable et batches pour sécurité.
- **Risques** : maîtrisables avec sauvegarde, migration en batch, vérification d’unicité en création et à la conversion évangélisation ; pas de changement des règles Firestore ni d’index obligatoire si on garde le chargement par `famille_id` et la vérification en mémoire.

Aucune modification du code n’a été faite dans le dépôt ; ce document sert de base pour une implémentation ultérieure sûre et cohérente avec les statistiques.
