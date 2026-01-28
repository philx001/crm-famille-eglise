# 🤖 Guide d'Automatisation Git/GitHub

## 📋 Options d'automatisation disponibles

### Option 1 : Script PowerShell (Recommandé pour Windows) ⭐

**Fichier créé :** `git-push.ps1`

#### Utilisation :

```powershell
# Ouvrir PowerShell dans le dossier du projet
.\git-push.ps1 "Votre message de commit"
```

#### Avantages :
- ✅ Simple et rapide
- ✅ Vérifie automatiquement l'état
- ✅ Gère les erreurs
- ✅ Messages colorés pour le suivi

#### Configuration :

1. Ouvrez PowerShell dans le dossier du projet
2. Si vous avez une erreur d'exécution, exécutez d'abord :
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

3. Utilisez le script :
```powershell
.\git-push.ps1 "Fix: Correction du bug d'authentification"
```

---

### Option 2 : Alias Git (Rapide)

Créez un alias Git pour simplifier les commandes :

```bash
# Configurer l'alias
git config --global alias.pushall '!git add . && git commit -m "$1" && git push origin main'

# Utilisation
git pushall "Votre message"
```

---

### Option 3 : GitHub Actions (Automatisation complète)

**Fichier créé :** `.github/workflows/auto-sync.yml`

#### Fonctionnalités :
- ✅ Déclenchement manuel depuis GitHub
- ✅ Déclenchement automatique toutes les heures (optionnel)
- ✅ Synchronisation automatique

#### Activation :

1. Poussez le fichier `.github/workflows/auto-sync.yml` sur GitHub
2. Allez dans l'onglet **Actions** de votre dépôt GitHub
3. Sélectionnez le workflow **Auto Sync**
4. Cliquez sur **Run workflow** pour l'exécuter manuellement

#### Personnalisation :

Pour modifier la fréquence automatique, éditez la ligne `cron` dans le fichier :
```yaml
schedule:
  - cron: '0 * * * *'  # Toutes les heures
  # Format: minute heure jour mois jour-semaine
  # Exemples:
  # '0 9 * * *' = Tous les jours à 9h
  # '0 */6 * * *' = Toutes les 6 heures
  # '0 0 * * 0' = Tous les dimanches à minuit
```

---

### Option 4 : Git Hooks (Automatisation locale)

Créez un hook pre-commit pour automatiser certaines actions :

#### Créer le hook :

```bash
# Créer le dossier hooks s'il n'existe pas
mkdir -p .git/hooks

# Créer le hook pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Hook pre-commit - Exécuté avant chaque commit

echo "🔍 Vérification avant commit..."

# Vérifier que les fichiers sensibles ne sont pas commités
if git diff --cached --name-only | grep -E "(firebase-config\.js|\.env)"; then
    echo "⚠️  ATTENTION: Fichiers sensibles détectés !"
    echo "Vérifiez que vous ne commitez pas de secrets."
    read -p "Continuer quand même ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Vérifications OK"
EOF

# Rendre le hook exécutable (Linux/Mac)
chmod +x .git/hooks/pre-commit
```

---

### Option 5 : Tâche planifiée Windows (Automatisation complète)

Créez une tâche planifiée Windows pour exécuter le script automatiquement :

#### Étapes :

1. Ouvrez **Planificateur de tâches** (Task Scheduler)
2. Créez une **tâche de base**
3. Configurez :
   - **Déclencheur** : Quotidien, hebdomadaire, etc.
   - **Action** : Démarrer un programme
   - **Programme** : `powershell.exe`
   - **Arguments** : `-File "C:\chemin\vers\votre\projet\git-push.ps1" "Auto-commit quotidien"`

---

## 🔄 Workflow recommandé

### Pour un usage quotidien :

1. **Modifiez vos fichiers**
2. **Exécutez le script** :
   ```powershell
   .\git-push.ps1 "Description de vos modifications"
   ```
3. **C'est tout !** Vos fichiers sont sur GitHub

### Pour une automatisation complète :

1. **Configurez GitHub Actions** (Option 3)
2. **Activez la planification automatique**
3. **Vérifiez régulièrement** l'onglet Actions sur GitHub

---

## 📝 Exemples de messages de commit

```bash
# Correction de bug
"Fix: Correction de l'erreur 'doc is not defined'"

# Nouvelle fonctionnalité
"Feat: Ajout du système de notifications"

# Mise à jour
"Update: Amélioration de l'interface utilisateur"

# Documentation
"Docs: Mise à jour du README"

# Refactoring
"Refactor: Réorganisation du code d'authentification"
```

---

## ⚙️ Configuration initiale (une seule fois)

### 1. Installer Git

Téléchargez depuis : https://git-scm.com/download/win

### 2. Configurer Git

```bash
git config --global user.name "Votre Nom"
git config --global user.email "votre.email@example.com"
```

### 3. Créer le dépôt GitHub

1. Allez sur https://github.com
2. Cliquez sur **New repository**
3. Nommez votre dépôt (ex: `crm-famille-eglise`)
4. **Ne cochez pas** "Initialize with README" (vous avez déjà un README)
5. Cliquez sur **Create repository**

### 4. Lier votre projet local à GitHub

```bash
# Si le dépôt n'est pas encore initialisé
git init

# Ajouter le dépôt distant
git remote add origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git

# Vérifier
git remote -v
```

### 5. Premier push

```bash
git add .
git commit -m "Initial commit"
git branch -M main  # Renommer la branche en 'main' si nécessaire
git push -u origin main
```

---

## 🆘 Dépannage

### Erreur : "Git n'est pas reconnu"
**Solution :** Installez Git et redémarrez PowerShell

### Erreur : "Permission denied"
**Solution :** 
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erreur : "Remote origin already exists"
**Solution :**
```bash
git remote set-url origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git
```

### Erreur : "Authentication failed"
**Solution :** Utilisez un Personal Access Token au lieu du mot de passe :
1. GitHub → Settings → Developer settings → Personal access tokens
2. Créez un token avec les permissions `repo`
3. Utilisez ce token comme mot de passe lors du push

---

## 📚 Ressources

- [Documentation Git](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
