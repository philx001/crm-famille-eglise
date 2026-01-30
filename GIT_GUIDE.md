# 📚 Guide Git - Commandes pour GitHub

## ⚠️ « git » n'est pas reconnu — Installer Git (Windows)

Si PowerShell affiche **« Le terme 'git' n'est pas reconnu »**, Git n'est pas installé ou pas dans le PATH.

### 1. Télécharger et installer Git

1. Allez sur **https://git-scm.com/download/win**
2. Téléchargez **Git for Windows** (64-bit recommandé)
3. Lancez l’installateur et gardez les options par défaut
4. **Important :** cochez **« Add Git to PATH »** (ajouter Git au PATH)
5. Terminez l’installation

### 2. Redémarrer le terminal

- Fermez **complètement** PowerShell ou le terminal Cursor
- Rouvrez un nouveau terminal dans le dossier du projet

### 3. Vérifier l’installation

```powershell
git --version
```

Si la version s’affiche (ex. `git version 2.43.0`), vous pouvez utiliser `git init` et les autres commandes.

---

## 🔐 « Password authentication is not supported » — Utiliser un token GitHub

Depuis août 2021, **GitHub n’accepte plus le mot de passe de votre compte** pour les opérations Git (push, pull). Il faut utiliser un **Personal Access Token (PAT)** à la place.

### 1. Créer un token sur GitHub

1. Connectez-vous à **https://github.com**
2. Cliquez sur votre **photo de profil** (en haut à droite) → **Settings**
3. Dans le menu de gauche, tout en bas : **Developer settings**
4. Cliquez sur **Personal access tokens** → **Tokens (classic)**
5. Cliquez sur **Generate new token** → **Generate new token (classic)**
6. Donnez un **nom** au token (ex. : `CRM Famille - Cursor`)
7. Choisissez une **durée** (ex. : 90 days ou No expiration)
8. Cochez au minimum la permission **`repo`** (accès aux dépôts)
9. Cliquez sur **Generate token**
10. **Copiez le token immédiatement** (ex. : `ghp_xxxxxxxxxxxx`) — il ne sera plus affiché ensuite.

### 2. Utiliser le token comme mot de passe

Lorsque Git demande **Password**, collez **le token** (et non votre mot de passe GitHub).

- **Username :** `philx001` (votre identifiant GitHub)
- **Password :** le token (ex. : `ghp_xxxxxxxxxxxx`)

### 3. (Optionnel) Enregistrer le token pour ne pas le ressaisir

Sous Windows, Git peut utiliser le **Gestionnaire d’informations d’identification** pour mémoriser le token :

- À la première demande de mot de passe, collez le token.
- Cochez « Se souvenir » si proposé, ou utilisez :  
  `git config --global credential.helper manager`  
  pour que Windows enregistre les identifiants.

**Important :** Ne partagez jamais votre token et ne le commitez pas dans le projet.

### 4. Si Git ne demande pas le mot de passe (authentification échoue directement)

Parfois Git utilise des identifiants en cache incorrects. Voici comment forcer l'utilisation de votre token :

**Méthode 1 : Supprimer les identifiants en cache**

```powershell
# Supprimer les identifiants GitHub en cache (Windows)
cmdkey /delete:git:https://github.com

# Puis réessayer le push (Git demandera les identifiants)
git push origin master
```

**Méthode 2 : Inclure le token directement dans l'URL (recommandé si la méthode 1 échoue)**

```powershell
# Configurer l'URL avec votre token
git remote set-url origin https://VOTRE_TOKEN@github.com/VOTRE_USERNAME/VOTRE_REPO.git

# Exemple concret (remplacez par votre vrai token et repo) :
git remote set-url origin https://ghp_abc123def456@github.com/philx001/crm-famille-eglise.git

# Puis pousser
git push origin master
```

**Comment obtenir votre token :**
1. Aller sur https://github.com/settings/tokens
2. Cliquer **Generate new token** → **Generate new token (classic)**
3. Nom : `crm-famille` (ou autre)
4. Cocher **repo** (accès complet aux dépôts)
5. Cliquer **Generate token**
6. **Copier le token** (il commence par `ghp_`)

---

## 🚀 Commandes de base pour mettre à jour GitHub

### 1. Configuration initiale (une seule fois)

```bash
# Configurer votre identité Git
git config --global user.name "Votre Nom"
git config --global user.email "votre.email@example.com"

# Initialiser le dépôt Git (si pas déjà fait)
git init

# Ajouter le dépôt distant GitHub
git remote add origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git

# Ou si le dépôt existe déjà
git remote set-url origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git
```

### 2. Workflow quotidien - Mettre à jour GitHub

```bash
# 1. Vérifier l'état des fichiers modifiés
git status

# 2. Ajouter tous les fichiers modifiés
git add .

# OU ajouter des fichiers spécifiques
git add fichier1.js fichier2.js

# 3. Créer un commit avec un message descriptif
git commit -m "Description de vos modifications"

# 4. Envoyer les modifications sur GitHub
git push origin main

# (Si c'est la première fois, utilisez peut-être 'master' au lieu de 'main')
git push origin master
```

### 3. Commandes utiles supplémentaires

```bash
# Voir l'historique des commits
git log --oneline

# Voir les différences avant de commiter
git diff

# Annuler les modifications d'un fichier (avant git add)
git checkout -- fichier.js

# Retirer un fichier de l'index (après git add, avant git commit)
git reset HEAD fichier.js

# Récupérer les dernières modifications depuis GitHub
git pull origin main

# Voir les branches
git branch

# Créer une nouvelle branche
git branch nom-de-la-branche

# Changer de branche
git checkout nom-de-la-branche
```

---

## 🔄 Automatisation - Options

### Option 1 : Script PowerShell (Windows) - RECOMMANDÉ

Créez un fichier `git-push.ps1` (voir ci-dessous) et exécutez-le :

```powershell
.\git-push.ps1 "Votre message de commit"
```

### Option 2 : GitHub Actions (Automatisation complète)

Créez un workflow GitHub Actions (voir `.github/workflows/auto-sync.yml`)

### Option 3 : Git Hooks (Automatisation locale)

Créez un hook pre-commit pour automatiser certaines actions avant chaque commit.

---

## 📝 Exemples de messages de commit

```bash
git commit -m "Fix: Correction de l'erreur 'doc is not defined'"
git commit -m "Feat: Ajout de la fonctionnalité de calendrier"
git commit -m "Update: Mise à jour de la documentation"
git commit -m "Refactor: Réorganisation du code d'authentification"
git commit -m "Style: Amélioration de l'interface utilisateur"
```

---

## ⚠️ Bonnes pratiques

1. **Commitez souvent** : Faites des commits réguliers avec des messages clairs
2. **Testez avant de push** : Vérifiez que tout fonctionne localement
3. **Messages descriptifs** : Utilisez des messages qui expliquent le "pourquoi"
4. **Ne commitez pas les fichiers sensibles** : Utilisez `.gitignore`
5. **Pull avant Push** : Récupérez les modifications avant d'envoyer les vôtres

---

## 🆘 En cas de problème

### « git » n'est pas reconnu
→ Suivez la section **« Installer Git (Windows) »** en haut de ce guide. Après installation, redémarrez le terminal.

### Si vous avez des conflits après git pull

```bash
# Si vous avez des conflits après git pull
git status  # Voir les fichiers en conflit
# Éditez les fichiers, résolvez les conflits, puis :
git add .
git commit -m "Résolution des conflits"
git push origin main

# Si vous voulez annuler le dernier commit (mais garder les modifications)
git reset --soft HEAD~1

# Si vous voulez annuler complètement le dernier commit
git reset --hard HEAD~1  # ⚠️ ATTENTION : Perte des modifications !
```
