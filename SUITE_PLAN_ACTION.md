# Suite du plan d'action – État et vérifications

**Date :** Janvier 2026

---

## ✅ État actuel

### Phase 1 et Phase 2 du plan (terminées)
- **1.1 à 1.3** : Dashboard unifié, gestion d’erreurs, documentation
- **2.1 à 2.6** : Programmes à pointer, notifications, Mon compte, photo de profil, export CSV/PDF, alertes absence

### Travaux réalisés en plus (cette session)
- **Connexion** : Règles Firestore pour login, persistance de session, timeouts (auth 20 s, chargement 25 s)
- **Export** : Date de naissance dans le CSV, export PDF liste des membres (fenêtre impression)
- **Création de membres** : Rôles Mentor/Adjoint/Berger pour admin, liste des mentors, mot de passe temporaire + email reset, correction « Session expirée » après création
- **Vue Membres** : Affichage du mentor à côté du rôle (berger/admin) : nom du mentor, « Non Affecté », ou rien pour berger/admin

---

## 📋 Vérifications recommandées avant commit

Cocher après test en conditions réelles (berger ou admin).

### Connexion et session
- [ ] Connexion avec nom de famille + email + mot de passe
- [ ] Après F5, la session est conservée (pas de reconnexion)
- [ ] Déconnexion manuelle fonctionne

### Membres
- [ ] Liste des membres affiche bien le mentor à droite du rôle (berger/admin)
- [ ] Ajout d’un membre (disciple, puis mentor) : mot de passe temporaire affiché, pas de fenêtre « Session expirée »
- [ ] Nouveau membre peut se connecter avec le mot de passe temporaire (ou lien email)

### Export
- [ ] Export CSV : colonne « Date de naissance » présente, téléchargement OK
- [ ] Export PDF : ouverture d’une fenêtre avec la liste, bouton « Imprimer / Enregistrer en PDF »

### Règles Firestore (console Firebase)
- [ ] Règles publiées = contenu de `firestore-rules-complet.rules` (première ligne : `rules_version = '2';`)

---

## 🚀 Suite possible

### 1. Commit
Une fois les vérifications faites, committer l’état actuel (tous les fichiers modifiés) avec un message du type :
- *Connexion, export, création membres, affichage mentor*

### 2. Phase 3 (fonctionnalités avancées)
Choisir selon les besoins, par exemple :

| Priorité | Fonctionnalité |
|----------|----------------|
| Utile au quotidien | **Export présences (CSV/Excel)** |
| Confort | **Recherche globale**, **Deep linking** (URL par page) |
| Engagement | **Rappel avant programme**, **Notifications lu/non lu** |
| Plus tard | PWA / hors ligne, thème sombre, multi-langue |

### 3. Maintenance
- Mettre à jour `PLAN_ACTION.md` si besoin (marquer les points Phase 3 réalisés)
- Garder `firestore-rules-complet.rules` comme référence unique des règles Firestore

---

## Fichiers importants modifiés (résumé)

- `app-auth.js` : login, checkAuthState, createMembre, persistance
- `app-main.js` : init, loadAllData, export PDF, modale mot de passe, submitAddMembre
- `app-pages.js` : formulaire ajout membre (rôles, mentors), renderMembreCard, getMentorLabelForMember
- `app-pdf-export.js` : generateMembersReport, about:blank
- `firebase-config.js` : setPersistence(LOCAL)
- `firestore-rules-complet.rules` : familles read, utilisateurs create/update

Une fois les cases de vérification cochées, vous pouvez enchaîner sur le **commit** puis, si vous le souhaitez, sur une **fonctionnalité Phase 3**.
