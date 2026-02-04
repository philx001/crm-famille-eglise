# Audit UX, accessibilité et affichage mobile

Ce document recense les améliorations identifiées pour l’expérience utilisateur, les performances, la navigation, l’accessibilité et l’affichage sur mobile. Les points déjà traités en priorité sont marqués **[implémenté]**.

---

## 1. Accessibilité (a11y)

### 1.1 Navigation au clavier et lecteurs d’écran
- **[implémenté]** **Lien d’évitement (skip link)** : lien « Aller au contenu » en premier au focus clavier pour sauter le menu.
- **[implémenté]** **Landmarks** : `<main id="main-content">`, `<nav aria-label="Menu principal">` pour une structure claire.
- **[implémenté]** **Focus visible** : styles `:focus-visible` sur boutons, liens, champs et éléments de navigation (contour visible au clavier, pas au clic souris).
- **[implémenté]** **Labels de formulaire** : attributs `for` sur les labels de la page de connexion (Famille, Email, Mot de passe).
- **Recommandation** : sur les cartes cliquables (stat-cards, member-card), ajouter `tabindex="0"` et gérer `keydown` (Entrée/Espace) pour une activation au clavier équivalente au clic.

### 1.2 Contraste et lisibilité
- Les couleurs (primary, text, bordures) sont déjà contrastées.
- **Recommandation** : vérifier le ratio de contraste des textes secondaires (`--text-muted`) sur fond clair/sombre (objectif ≥ 4,5:1 pour le texte normal).

### 1.3 Formulaires
- **[implémenté]** Bouton « Afficher le mot de passe » avec `aria-label` et gestion en JS.
- **Recommandation** : associer les messages d’erreur aux champs via `aria-describedby` ou `aria-invalid` quand un champ est en erreur.

### 1.4 Animations
- **[implémenté]** Respect de `prefers-reduced-motion` : réduction ou suppression des animations pour les utilisateurs qui le demandent.

---

## 2. Mobile

### 2.1 Affichage et zones sûres
- **[implémenté]** `viewport` et `theme-color` déjà présents dans `index.html`.
- **[implémenté]** **Safe area** : padding `env(safe-area-inset-*)` sur le header et la sidebar pour encoches et barres système.
- **Recommandation** : sur très petits écrans (< 360px), envisager un `font-size` de base légèrement réduit ou des espacements adaptés.

### 2.2 Zones de toucher
- **[implémenté]** Bouton menu mobile déjà en 44×44 px (recommandation WCAG).
- **[implémenté]** Éléments de navigation (`.nav-item`) avec `min-height: 44px` et padding confortable sur mobile.
- **Recommandation** : s’assurer que tous les boutons d’action (`.btn`, `.btn-sm`) ont une zone de toucher d’au moins 44×44 px sur mobile (padding ou min-height).

### 2.3 Menu et overlay
- Menu latéral et overlay déjà en place ; **[implémenté]** `aria-expanded` et libellé du bouton (« Ouvrir » / « Fermer le menu ») pour les lecteurs d’écran.
- Barre de recherche globale masquée sur petit écran pour garder de la place.

### 2.4 Tables
- `.table-container` avec `overflow-x: auto` pour le défilement horizontal des tableaux sur petit écran (déjà en place).

---

## 3. Performance

### 3.1 Chargement
- **Recommandation** : charger Chart.js en dynamique (import / script) uniquement sur les pages Statistiques et Évangélisation pour alléger la page d’accueil.
- **Recommandation** : `preconnect` pour les CDN (Font Awesome, Chart.js) déjà partiellement en place (Google Fonts) ; étendre si besoin.

### 3.2 Données
- Timeout de chargement initial porté à 50 s sans message « Chargement lent » intrusif (comportement actuel conservé).
- **Recommandation** : pour de très gros volumes, pagination ou chargement progressif des listes (membres, annuaire).

---

## 4. UX et navigation

### 4.1 Cohérence
- **[implémenté]** Libellé de hint connexion : « fourni par votre Superviseur » (au lieu de « Berger ») pour rester cohérent avec le reste de l’app.
- Titre de page (`<h1>`) unique par écran (déjà le cas dans le layout).

### 4.2 Feedback
- Toasts pour succès/erreur déjà présents.
- **Recommandation** : sur les boutons déclenchant une action longue (sauvegarde, export), afficher un état de chargement (spinner ou texte « Enregistrement… ») et désactiver le bouton pendant le traitement.

### 4.3 Session et déconnexion
- Comportement « Session expirée » déjà corrigé : pas d’alerte lors d’une déconnexion volontaire ; message uniquement en cas de vraie expiration.

---

## 5. Synthèse des modifications appliquées

| Fichier        | Modification |
|----------------|--------------|
| `index.html`   | Lien d’évitement (masqué, visible au focus) — optionnel si le layout est injecté dans `#app` ; dans ce cas le skip link est géré dans `renderLayout`. |
| `app-main.js`  | Skip link dans le layout, `id="main-content"` sur `<main>`, `role="navigation"` et `aria-label="Menu principal"` sur la nav, `aria-expanded` et libellé dynamique du bouton menu. |
| `app-pages.js`  | Labels avec `for` sur la page de connexion ; hint « Superviseur » au lieu de « Berger ». |
| `styles.css`   | `.skip-link` (position, visible au focus), `:focus-visible` sur boutons/liens/champs/nav-item, `@media (prefers-reduced-motion)`, `env(safe-area-inset-*)`, `min-height` 44px pour `.nav-item` sur mobile. |

---

## 6. Pistes ultérieures

- **PWA** : manifest + service worker pour installation sur écran d’accueil et usage hors ligne limité.
- **Raccourcis clavier** : par exemple Échap pour fermer le menu ou les modales.
- **Messages de statut live** : `aria-live` pour annoncer les changements de contenu (toasts, chargement).
- **Tests** : vérification avec un lecteur d’écran (NVDA, VoiceOver) et avec navigation au clavier seule.
