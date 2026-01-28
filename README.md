# CRM Famille - Application de Gestion des Groupes de Disciples

Application web de type CRM destinée à la gestion des groupes ecclésiaux appelés "Familles".

## 🚀 Fonctionnalités

### ✅ Phase 1 - Authentification et Membres
- **Authentification** : Connexion sécurisée avec email/mot de passe + nom de famille
- **Gestion des membres** : CRUD complet avec système de rôles
- **Système de permissions RBAC** : 6 rôles hiérarchiques
- **Profils utilisateurs** : Informations personnelles, parcours spirituel
- **Annuaire** : Liste avec indicateur d'anniversaire animé 🎂
- **Déconnexion automatique** : Après 15 minutes d'inactivité

### ✅ Phase 2 - Calendrier et Présences
- **Calendrier interactif** : Vue mensuelle avec navigation
- **Gestion des programmes** : 9 types de programmes (Culte, Partage, Com'frat, etc.)
- **Pointage des présences** : Interface intuitive pour mentors
- **Historique par membre** : Suivi individuel complet
- **Récurrence** : Programmes uniques, hebdomadaires ou mensuels

### ✅ Phase 3 - Statistiques et Export PDF
- **Tableau de bord statistiques** : Vue globale avec filtres temporels
- **Taux de présence** : Global, par type, par membre
- **Graphiques visuels** : Barres et évolution mensuelle
- **Stats par mentor** : Vue réservée aux Bergers
- **Export PDF** : Rapport complet imprimable/téléchargeable

### ✅ Phase 4 - Communication et Documents
- **Notifications** : Système coloré avec 4 niveaux de priorité (info, à noter, important, urgent)
- **Sujets de prière** : Partage anonyme ou nominatif, marquage "exaucé"
- **Témoignages** : Partage des bénédictions avec horodatage
- **Documents** : Upload avec catégories et visibilité par rôle

### 🔜 Phase 5 (à venir)
- Améliorations UX et fonctionnalités avancées
- Mode hors-ligne (PWA)
- Notifications push

---

## 📦 Installation et Déploiement

### Prérequis
- Compte Google (pour Firebase)
- Navigateur web moderne

### Étape 1 : Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur **"Ajouter un projet"**
3. Nommez votre projet (ex: `crm-famille-eglise`)
4. Désactivez Google Analytics (optionnel pour commencer)
5. Cliquez sur **"Créer le projet"**

### Étape 2 : Configurer Authentication

1. Dans le menu gauche, cliquez sur **"Authentication"**
2. Cliquez sur **"Commencer"**
3. Dans l'onglet **"Sign-in method"**, activez **"Adresse e-mail/Mot de passe"**

### Étape 3 : Configurer Firestore Database

1. Dans le menu gauche, cliquez sur **"Firestore Database"**
2. Cliquez sur **"Créer une base de données"**
3. Choisissez le mode **"Production"**
4. Sélectionnez un emplacement (ex: `europe-west1` pour la France)
5. Une fois créée, allez dans l'onglet **"Règles"**
6. Copiez le contenu du fichier `firestore.rules` et collez-le
7. Cliquez sur **"Publier"**

### Étape 4 : Obtenir les clés de configuration

1. Cliquez sur l'icône ⚙️ (Paramètres du projet) > **"Paramètres du projet"**
2. Descendez jusqu'à **"Vos applications"**
3. Cliquez sur l'icône **"</>"** (Web)
4. Nommez l'application (ex: `CRM Famille Web`)
5. Copiez les valeurs de configuration

### Étape 5 : Configurer l'application

1. Ouvrez le fichier `firebase-config.js`
2. Remplacez les valeurs par celles de votre projet :

```javascript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "votre-projet.firebaseapp.com",
  projectId: "votre-projet",
  storageBucket: "votre-projet.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### Étape 6 : Créer les données initiales

Dans la console Firebase Firestore, créez manuellement :

#### 1. Une famille
Collection: `familles`
Document ID: (auto-généré)
```json
{
  "nom": "esperance",
  "description": "Famille Espérance",
  "statut": "actif",
  "date_creation": (timestamp actuel),
  "created_at": (timestamp actuel),
  "updated_at": (timestamp actuel)
}
```
**Notez l'ID du document créé** (ex: `abc123xyz`)

#### 2. Un utilisateur admin
D'abord, créez l'utilisateur dans **Authentication** :
1. Allez dans Authentication > Users
2. Cliquez sur "Ajouter un utilisateur"
3. Email: `admin@votreeglise.com`, Mot de passe: `VotreMotDePasse123!`
4. Notez l'**UID** généré (ex: `uid123abc`)

Puis créez le document dans Firestore :
Collection: `utilisateurs`
Document ID: **Utilisez l'UID de l'utilisateur créé**
```json
{
  "email": "admin@votreeglise.com",
  "nom": "Admin",
  "prenom": "Super",
  "famille_id": "abc123xyz",
  "mentor_id": null,
  "role": "admin",
  "statut_compte": "actif",
  "sexe": "M",
  "date_naissance": null,
  "adresse_ville": null,
  "adresse_code_postal": null,
  "telephone": null,
  "date_arrivee_icc": null,
  "formations": [],
  "ministere_service": null,
  "baptise_immersion": null,
  "profession": null,
  "statut_professionnel": null,
  "passions_centres_interet": null,
  "created_at": (timestamp actuel),
  "updated_at": (timestamp actuel)
}
```

### Étape 7 : Déployer l'application

#### Option A : Firebase Hosting (Recommandé)

1. Installez Firebase CLI :
```bash
npm install -g firebase-tools
```

2. Connectez-vous :
```bash
firebase login
```

3. Initialisez le projet :
```bash
firebase init hosting
```
- Sélectionnez votre projet
- Dossier public: `.` (le dossier courant)
- Single-page app: `No`
- Overwrite index.html: `No`

4. Déployez :
```bash
firebase deploy --only hosting
```

Votre application sera accessible à : `https://votre-projet.web.app`

#### Option B : Hébergement local

Ouvrez simplement `index.html` dans un navigateur, ou utilisez un serveur local :

```bash
# Avec Python
python -m http.server 8080

# Avec Node.js
npx serve .
```

---

## 👥 Gestion des Rôles

| Rôle | Description | Droits principaux |
|------|-------------|-------------------|
| **disciple** | Membre de base | Voir son profil, annuaire |
| **nouveau** | Nouveau membre sans mentor | Comme disciple |
| **mentor** | Accompagnateur de disciples | Ajouter/pointer ses disciples |
| **adjoint_berger** | Assistant du berger | Gérer calendrier, documents |
| **berger** | Responsable de la famille | Tout voir/gérer dans sa famille |
| **admin** | Super administrateur | Accès total multi-familles |

---

## 🔒 Sécurité

- **Cloisonnement des données** : Chaque famille est isolée
- **Authentification Firebase** : Standards de sécurité Google
- **Règles Firestore** : Contrôle d'accès au niveau base de données
- **Déconnexion automatique** : 15 minutes d'inactivité
- **HTTPS** : Obligatoire avec Firebase Hosting

---

## 📁 Structure des fichiers

```
crm-eglise/
├── index.html            # Page principale
├── styles.css            # Styles CSS (800+ lignes)
├── firebase-config.js    # Configuration Firebase
├── app-core.js           # Utilitaires, Toast, Modales, Inactivité
├── app-auth.js           # Authentification et permissions
├── app-pages.js          # Pages: Profil, Membres, Annuaire
├── app-programmes.js     # Calendrier et gestion des programmes
├── app-presences.js      # Pointage et historique des présences
├── app-statistiques.js   # Module statistiques complet
├── app-pdf-export.js     # Génération des rapports PDF
├── app-notifications.js  # Notifications colorées
├── app-priere.js         # Sujets de prière et témoignages
├── app-documents.js      # Gestion des documents
├── app-main.js           # Application principale et routing
├── firestore.rules       # Règles de sécurité Firestore
└── README.md             # Documentation
```

**Total : 15 fichiers, ~6000 lignes de code**

---

## ❓ FAQ

**Q: Comment créer un premier berger ?**
R: Créez d'abord un admin, connectez-vous, puis ajoutez un membre avec le rôle "berger".

**Q: Comment ajouter plusieurs familles ?**
R: Seul l'admin peut créer des familles via la console Firebase.

**Q: Les données sont-elles synchronisées en temps réel ?**
R: Oui, Firestore synchronise automatiquement les données.

**Q: Combien coûte Firebase ?**
R: Le plan gratuit (Spark) suffit pour ~20 utilisateurs actifs. Au-delà, le plan Blaze est payant à l'usage.

---

## 📞 Support

Pour toute question ou problème, contactez l'administrateur de votre église.

---

**Version** : 1.0.0 - Phase 1  
**Dernière mise à jour** : Janvier 2025
