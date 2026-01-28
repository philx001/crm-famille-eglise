# Script PowerShell pour automatiser les commits et push vers GitHub
# Usage: .\git-push.ps1 "Message de commit"

param(
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

Write-Host "🔄 Démarrage de la synchronisation Git..." -ForegroundColor Cyan

# Vérifier si Git est installé
try {
    $gitVersion = git --version
    Write-Host "✅ Git détecté: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "Téléchargez Git depuis: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Vérifier si on est dans un dépôt Git
if (-not (Test-Path .git)) {
    Write-Host "⚠️  Ce dossier n'est pas un dépôt Git" -ForegroundColor Yellow
    $init = Read-Host "Voulez-vous initialiser un dépôt Git ? (O/N)"
    if ($init -eq "O" -or $init -eq "o") {
        git init
        Write-Host "✅ Dépôt Git initialisé" -ForegroundColor Green
    } else {
        exit 1
    }
}

# Vérifier l'état
Write-Host "`n📊 Vérification de l'état des fichiers..." -ForegroundColor Cyan
$status = git status --short

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "ℹ️  Aucune modification détectée" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n📝 Fichiers modifiés:" -ForegroundColor Cyan
git status --short

# Ajouter tous les fichiers
Write-Host "`n➕ Ajout des fichiers..." -ForegroundColor Cyan
git add .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'ajout des fichiers" -ForegroundColor Red
    exit 1
}

# Créer le commit
Write-Host "`n💾 Création du commit..." -ForegroundColor Cyan
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la création du commit" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Commit créé avec succès" -ForegroundColor Green

# Récupérer les dernières modifications (pull)
Write-Host "`n⬇️  Récupération des dernières modifications..." -ForegroundColor Cyan
git pull origin main --no-edit 2>$null
if ($LASTEXITCODE -ne 0) {
    git pull origin master --no-edit 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Impossible de faire un pull (peut-être première fois ?)" -ForegroundColor Yellow
    }
}

# Envoyer les modifications (push)
Write-Host "`n⬆️  Envoi des modifications vers GitHub..." -ForegroundColor Cyan
git push origin main 2>$null
if ($LASTEXITCODE -ne 0) {
    git push origin master 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors du push" -ForegroundColor Red
        Write-Host "Vérifiez que:" -ForegroundColor Yellow
        Write-Host "  - Le dépôt distant est configuré (git remote -v)" -ForegroundColor Yellow
        Write-Host "  - Vous êtes authentifié (git config --global user.name)" -ForegroundColor Yellow
        Write-Host "  - Vous avez les droits d'écriture sur le dépôt" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n✅ Synchronisation terminée avec succès !" -ForegroundColor Green
Write-Host "🌐 Vos modifications sont maintenant sur GitHub" -ForegroundColor Cyan
