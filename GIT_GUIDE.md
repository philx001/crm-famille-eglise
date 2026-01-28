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
