# 📋 Plan d'action - Améliorations CRM Famille

**Date de création :** Janvier 2025  
**Basé sur :** Audit complet de l'application

---

## 🎯 Stratégie proposée

### Phase 1 : Corrections critiques (Code)
**Objectif :** Stabiliser et nettoyer le code existant avant d'ajouter des fonctionnalités

### Phase 2 : Fonctionnalités prioritaires (Impact utilisateur)
**Objectif :** Améliorer l'expérience quotidienne des utilisateurs

### Phase 3 : Fonctionnalités avancées (Évolution)
**Objectif :** Enrichir l'application avec des fonctionnalités plus complexes

---

## 📝 Phase 1 : Corrections critiques

### ✅ 1.1 Unifier le dashboard (URGENT)
**Problème :** Deux implémentations (`Pages.renderDashboard()` et `App.renderDashboardEnhanced()`)

**Action :**
- Supprimer `Pages.renderDashboard()` (non utilisée)
- Garder uniquement `App.renderDashboardEnhanced()` qui est plus complète
- Vérifier que tous les liens fonctionnent

**Impact :** Réduit la confusion, facilite la maintenance

---

### ✅ 1.2 Gestion d'erreur réseau/session
**Problème :** Pas de gestion explicite des erreurs réseau ou session expirée

**Action :**
- Ajouter un intercepteur d'erreurs Firebase
- Afficher un message clair en cas d'erreur réseau
- Proposer un bouton "Réessayer" ou "Reconnecter"
- Gérer les cas de session expirée avec redirection vers login

**Impact :** Meilleure expérience utilisateur en cas de problème

---

### ✅ 1.3 Documentation de l'architecture
**Problème :** Ordre de chargement des scripts non documenté

**Action :**
- Créer un fichier `ARCHITECTURE.md` expliquant :
  - Ordre de chargement des scripts
  - Dépendances entre modules
  - Structure de données Firestore
  - Flux de navigation

**Impact :** Facilite la maintenance et l'évolution

---

## 🚀 Phase 2 : Fonctionnalités prioritaires

### ✅ 2.1 Rappel "Programmes à pointer"
**Description :** Afficher sur le dashboard les programmes passés récents sans pointage complet

**Implémentation :**
- Nouvelle fonction `Programmes.getUnpointed()` qui :
  - Récupère les programmes des 7 derniers jours
  - Vérifie pour chaque programme si tous les disciples ont été pointés
  - Retourne la liste des programmes incomplets
- Ajouter un bloc sur le dashboard avec cette liste
- Lien vers la page de pointage pour chaque programme

**Bénéfice :** Ne plus oublier de pointer les présences

---

### ✅ 2.2 Dernières notifications sur le dashboard
**Description :** Afficher les 3-5 dernières notifications importantes/urgentes

**Implémentation :**
- Modifier `App.renderDashboardEnhanced()` pour charger les notifications
- Filtrer par priorité (important, urgent, critique)
- Afficher un bloc "Dernières annonces" avec :
  - Titre, priorité (badge coloré), date relative
  - Lien "Voir toutes les notifications"

**Bénéfice :** Meilleure visibilité des informations importantes

---

### ✅ 2.3 Changement de mot de passe
**Description :** Permettre aux utilisateurs de changer leur mot de passe

**Implémentation :**
- Nouvelle page "Mon compte" ou "Sécurité" dans le menu
- Formulaire avec :
  - Mot de passe actuel
  - Nouveau mot de passe
  - Confirmation du nouveau mot de passe
- Utiliser `auth.updatePassword()` de Firebase
- Validation côté client (force du mot de passe, correspondance)

**Bénéfice :** Autonomie et sécurité des utilisateurs

---

### ✅ 2.4 Photo de profil
**Description :** Permettre l'upload et l'affichage d'une photo de profil

**Implémentation :**
- Ajouter champ `photo_url` dans le modèle utilisateur
- Page "Mon profil" : bouton "Changer la photo"
- Upload vers Firebase Storage (`avatars/{userId}/photo.jpg`)
- Affichage dans :
  - Sidebar (avatar utilisateur)
  - Annuaire
  - Profils membres
  - Fallback sur initiales si pas de photo

**Bénéfice :** Reconnaissance visuelle, lien humain

---

### ✅ 2.5 Export membres (CSV/Excel)
**Description :** Permettre aux bergers d'exporter la liste des membres

**Implémentation :**
- Bouton "Exporter" sur la page Membres (visible pour bergers)
- Génération CSV avec colonnes :
  - Prénom, Nom, Email, Téléphone, Rôle, Mentor, Date d'arrivée, etc.
- Utiliser `papaparse` ou génération manuelle CSV
- Téléchargement automatique du fichier

**Bénéfice :** Rapports, annuaire imprimé, suivi externe

---

### ✅ 2.6 Alertes absence
**Description :** Identifier les membres avec un faible taux de présence

**Implémentation :**
- Nouvelle fonction `Statistiques.getLowAttendanceMembers(seuil, periode)`
- Paramètres :
  - Seuil (ex. : < 50% de présence)
  - Période (ex. : 30 derniers jours)
- Afficher sur le dashboard (bergers) ou page Statistiques
- Liste avec taux de présence, nombre d'absences, dernier programme

**Bénéfice :** Repérer les personnes à recontacter

---

## 🔮 Phase 3 : Fonctionnalités avancées (futur)

Ces fonctionnalités peuvent être ajoutées plus tard selon les besoins :

- Catégories pour sujets de prière
- Plus de catégories de documents
- Recherche globale
- Rappel avant programme (notification)
- Vue "Ma semaine"
- Notifications "lu/non lu"
- Export présences (CSV/Excel)
- PWA + mode hors ligne
- Notifications push navigateur
- Deep linking (URL par page)
- Thème sombre
- Multi-langue (i18n)
- Journal d'audit
- Tableau de bord personnalisable
- Génération automatique d'occurrences (récurrence)

---

## 📊 Ordre d'exécution recommandé

### Sprint 1 (Corrections)
1. ✅ Unifier le dashboard
2. ✅ Gestion d'erreur réseau
3. ✅ Documentation architecture

### Sprint 2 (Dashboard amélioré)
1. ✅ Rappel programmes à pointer
2. ✅ Dernières notifications

### Sprint 3 (Compte utilisateur)
1. ✅ Changement de mot de passe
2. ✅ Photo de profil

### Sprint 4 (Export et alertes)
1. ✅ Export membres (CSV)
2. ✅ Alertes absence

---

## 🛠️ Comment procéder ?

**Option A :** Je commence par les corrections (Phase 1) puis on enchaîne avec les fonctionnalités  
**Option B :** On commence directement par les fonctionnalités prioritaires (Phase 2)  
**Option C :** Vous choisissez une fonctionnalité spécifique à implémenter en premier

**Quelle option préférez-vous ?** Ou avez-vous une autre priorité ?
