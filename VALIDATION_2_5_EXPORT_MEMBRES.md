# Validation point 2.5 – Export membres (CSV/Excel)

## Ce qui est implémenté

- **Bouton « Exporter CSV »** sur la page **Membres**, visible uniquement pour les utilisateurs avec permission « voir tous les membres » (rôles **Berger** et **Admin**).
- **Fonction `App.exportMembresCSV()`** dans `app-main.js` :
  - Vérifie la permission `Permissions.canViewAllMembers()`.
  - Utilise `AppState.membres` (membres actifs uniquement).
  - Colonnes du CSV : Prénom, Nom, Email, Téléphone, Rôle, Mentor, Date arrivée ICC, Sexe, Ville, Code postal, Profession, Statut pro, Ministère, Baptisé immersion, Formations.
  - Séparateur `;` (Excel FR), encodage UTF-8 avec BOM, échappement des guillemets.
  - Téléchargement automatique : `membres_AAAA-MM-JJ.csv`.

## Dépendances pour que ce soit opérationnel

1. **Connexion OK** → les règles Firestore permettent la requête `familles` et la lecture/mise à jour `utilisateurs` (corrigé).
2. **Chargement des membres** → après connexion, `loadAllData()` appelle `Membres.loadAll()`, qui fait une requête Firestore `utilisateurs.where('famille_id', '==', familleId)`. Les règles actuelles autorisent cette requête pour un berger/admin (même famille).
3. **Permission** → `canViewAllMembers()` = `hasRole('berger')` → vrai pour **Berger** et **Admin** (pas pour Adjoint Berger).

## Comment tester (vérification manuelle)

1. Se connecter avec un compte **Berger** ou **Admin** (sinon le bouton n’apparaît pas).
2. Aller sur **Membres** (menu « Tous les membres » ou équivalent).
3. Vérifier que le bouton **« Exporter CSV »** (icône téléchargement) est visible à côté de la recherche / filtres.
4. Cliquer sur **Exporter CSV** :
   - Un fichier `membres_AAAA-MM-JJ.csv` doit se télécharger.
   - Ouvrir le fichier dans Excel (ou éditeur de texte) : vérifier séparateur `;`, accents corrects, colonnes listées ci-dessus.
5. Si aucun membre actif : un message du type « Aucun membre à exporter » doit s’afficher (pas de téléchargement).
6. Se connecter avec un compte **Mentor** ou **Discipline** : le bouton **Exporter CSV** ne doit **pas** apparaître sur la page Membres.

## Statut

- **Code** : implémenté (bouton + `exportMembresCSV()`).
- **Règles Firestore** : compatibles avec le chargement des membres après correction connexion.
- **À valider** : test manuel en conditions réelles (connexion Berger/Admin → page Membres → Export CSV → ouverture du fichier).

Une fois ce test réussi, le point 2.5 peut être considéré comme terminé et opérationnel.
