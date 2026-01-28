// ============================================
// APPLICATION PRINCIPALE - Version 3.0
// Phases 1, 2, 3 et 4 intégrées
// ============================================

const App = {
  async init() {
    initFirebase();
    Toast.init();
    this.setupErrorHandling();
    const isLoggedIn = await Auth.checkAuthState();
    if (isLoggedIn) {
      await this.loadAllData();
      this.navigate('dashboard');
    } else {
      this.showLoginPage();
    }
  },

  setupErrorHandling() {
    // Intercepter les erreurs Firebase globales
    if (typeof auth !== 'undefined') {
      auth.onAuthStateChanged((user) => {
        if (!user && AppState.user) {
          // Session expirée côté Firebase
          ErrorHandler.showSessionError();
        }
      });
    }

    // Intercepter les erreurs réseau globales
    window.addEventListener('online', () => {
      Toast.success('Connexion rétablie');
    });

    window.addEventListener('offline', () => {
      Toast.warning('Connexion Internet perdue');
    });
  },

  async loadAllData() {
    try {
      App.showLoading();
      await Promise.all([
        ErrorHandler.wrap(Membres.loadAll(), 'Chargement membres'),
        ErrorHandler.wrap(Programmes.loadAll(), 'Chargement programmes')
      ]);
    } catch (error) {
      // Erreur déjà gérée par ErrorHandler.wrap
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      App.hideLoading();
    }
  },

  showLoginPage() {
    document.getElementById('app').innerHTML = Pages.renderLogin();
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const famille = document.getElementById('login-famille').value;
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      await Auth.login(email, password, famille);
      if (AppState.user) await this.loadAllData();
    });
  },

  currentParams: {},

  navigate(page, params = {}) {
    AppState.currentPage = page;
    this.currentParams = params;
    this.render();
  },

  async render() {
    if (!AppState.user) { this.showLoginPage(); return; }

    let pageContent = '', pageTitle = '';

    switch (AppState.currentPage) {
      case 'dashboard': pageTitle = 'Tableau de bord'; pageContent = await this.renderDashboardEnhanced(); break;
      case 'membres': pageTitle = 'Membres'; pageContent = Pages.renderMembres(); break;
      case 'membres-add': pageTitle = 'Ajouter un membre'; pageContent = Pages.renderAddMembre(); break;
      case 'profil': pageTitle = 'Mon profil'; pageContent = Pages.renderProfil(); break;
      case 'profil-edit': pageTitle = 'Modifier le profil'; pageContent = Pages.renderProfilEdit(); break;
      case 'annuaire': pageTitle = 'Annuaire'; pageContent = Pages.renderAnnuaire(); break;
      case 'mes-disciples': pageTitle = 'Mes disciples'; pageContent = Pages.renderMembres(); break;
      case 'calendrier': pageTitle = 'Calendrier'; pageContent = PagesCalendrier.renderCalendrier(); break;
      case 'programmes': pageTitle = 'Programmes'; pageContent = PagesCalendrier.renderProgrammes(); break;
      case 'programmes-add': pageTitle = 'Nouveau programme'; pageContent = PagesCalendrier.renderProgrammeForm(); break;
      case 'programmes-edit': pageTitle = 'Modifier le programme'; pageContent = PagesCalendrier.renderProgrammeForm(this.currentParams.programmeId); break;
      case 'programme-detail': pageTitle = 'Détails du programme'; pageContent = PagesCalendrier.renderProgrammeDetail(this.currentParams.programmeId); break;
      case 'presences': pageTitle = 'Pointage des présences'; pageContent = await PagesPresences.renderPresences(this.currentParams.programmeId); break;
      case 'historique-membre': pageTitle = 'Historique de présence'; pageContent = await PagesPresences.renderHistoriqueMembre(this.currentParams.membreId); break;
      case 'statistiques': pageTitle = 'Statistiques'; pageContent = await PagesStatistiques.renderStatistiques(); break;
      case 'notifications': pageTitle = 'Notifications'; pageContent = await PagesNotifications.render(); break;
      case 'sujets-priere': pageTitle = 'Sujets de prière'; pageContent = await PagesPriere.render(); break;
      case 'temoignages': pageTitle = 'Témoignages'; pageContent = await PagesTemoignages.render(); break;
      case 'documents': pageTitle = 'Documents'; pageContent = await PagesDocuments.render(); break;
      default: pageTitle = 'Page non trouvée'; pageContent = '<div class="alert alert-warning">Cette page n\'existe pas.</div>';
    }

    document.getElementById('app').innerHTML = this.renderLayout(pageTitle, pageContent);
  },

  async renderDashboardEnhanced() {
    const stats = Membres.getStats();
    const user = AppState.user;
    const mesDisciples = user.role !== 'disciple' && user.role !== 'nouveau' ? Membres.getDisciples(user.id) : [];
    const prochainsProgrammes = Programmes.getUpcoming(5);
    
    // Charger les programmes à pointer (seulement pour mentors et bergers)
    let programmesAPointer = [];
    if (Permissions.hasRole('mentor')) {
      programmesAPointer = await Presences.getUnpointedProgrammes(7);
    }

    // Charger les dernières notifications importantes/urgentes/critiques
    let dernieresNotifications = [];
    try {
      await Notifications.loadAll();
      dernieresNotifications = Notifications.items
        .filter(n => ['important', 'urgent', 'critique'].includes(n.priorite))
        .slice(0, 5);
    } catch (error) {
      console.error('Erreur chargement notifications pour dashboard:', error);
      // Continuer sans bloquer le dashboard
    }

    return `
      <div class="dashboard-grid">
        <div class="stat-card clickable" onclick="App.navigate('membres')" title="Voir tous les membres" style="cursor: pointer;">
          <div class="stat-icon primary" style="cursor: pointer;"><i class="fas fa-users"></i></div>
          <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${stats.total}</div><div class="stat-label" style="cursor: pointer;">Membres actifs</div></div>
        </div>
        ${Permissions.hasRole('mentor') ? `
        <div class="stat-card clickable" onclick="App.navigate('mes-disciples')" title="Voir mes disciples" style="cursor: pointer;">
          <div class="stat-icon success" style="cursor: pointer;"><i class="fas fa-user-friends"></i></div>
          <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${mesDisciples.length}</div><div class="stat-label" style="cursor: pointer;">Mes disciples</div></div>
        </div>
        ` : ''}
        <div class="stat-card clickable" onclick="App.navigate('programmes')" title="Voir tous les programmes" style="cursor: pointer;">
          <div class="stat-icon warning" style="cursor: pointer;"><i class="fas fa-calendar-alt"></i></div>
          <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${AppState.programmes.length}</div><div class="stat-label" style="cursor: pointer;">Programmes</div></div>
        </div>
        <div class="stat-card clickable" onclick="App.navigate('annuaire')" title="Voir l'annuaire" style="cursor: pointer;">
          <div class="stat-icon info" style="cursor: pointer;"><i class="fas fa-birthday-cake"></i></div>
          <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${stats.anniversairesAujourdhui.length}</div><div class="stat-label" style="cursor: pointer;">Anniversaires</div></div>
        </div>
      </div>
      ${stats.anniversairesAujourdhui.length > 0 ? `<div class="alert alert-success mb-3"><i class="fas fa-birthday-cake"></i><div class="alert-content"><div class="alert-title">🎂 Joyeux anniversaire !</div><p class="mb-0">${stats.anniversairesAujourdhui.map(m => m.prenom + ' ' + m.nom).join(', ')}</p></div></div>` : ''}
      ${programmesAPointer.length > 0 ? `<div class="alert alert-warning mb-3"><i class="fas fa-exclamation-triangle"></i><div class="alert-content"><div class="alert-title">⚠️ Programmes à pointer</div><p class="mb-2">${programmesAPointer.length} programme${programmesAPointer.length > 1 ? 's' : ''} récent${programmesAPointer.length > 1 ? 's' : ''} ${programmesAPointer.length > 1 ? 'n\'ont pas' : 'n\'a pas'} été complètement pointé${programmesAPointer.length > 1 ? 's' : ''}.</p><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">${programmesAPointer.map(p => { const date = p.date_debut?.toDate ? p.date_debut.toDate() : new Date(p.date_debut); return `<a href="#" onclick="App.navigate('presences', {programmeId: '${p.id}'}); return false;" class="btn btn-sm btn-warning" style="cursor: pointer;">${Utils.escapeHtml(p.nom)} - ${Utils.formatDate(date)}</a>`; }).join('')}</div></div></div>` : ''}
      ${dernieresNotifications.length > 0 ? `<div class="dashboard-section"><div class="section-header"><h3 class="section-title"><i class="fas fa-bell"></i> Dernières notifications</h3><a href="#" onclick="App.navigate('notifications'); return false;" class="btn btn-sm btn-outline" style="cursor: pointer;">Voir tout</a></div><div class="card"><div class="card-body" style="padding: 0;">${dernieresNotifications.map(n => { const priorite = Notifications.getPriorite(n.priorite); const date = n.created_at?.toDate ? n.created_at.toDate() : new Date(n.created_at); return `<div class="notification-card-mini" onclick="App.navigate('notifications'); return false;" style="cursor: pointer;"><div class="notif-priority" style="background: ${priorite.bgColor}; color: ${priorite.color};"><i class="fas ${priorite.icon}"></i></div><div class="notif-content"><div class="notif-text">${Utils.escapeHtml(n.contenu)}</div><div class="notif-meta"><span class="notif-author">${n.auteur_prenom || 'Anonyme'}</span><span class="notif-date">${Utils.formatRelativeDate(date)}</span></div></div></div>`; }).join('')}</div></div></div>` : ''}
      <div class="dashboard-section">
        <div class="section-header"><h3 class="section-title"><i class="fas fa-bolt"></i> Actions rapides</h3></div>
        <div class="quick-actions">
          <div class="quick-action" onclick="App.navigate('profil')"><i class="fas fa-user"></i><span>Mon profil</span></div>
          <div class="quick-action" onclick="App.navigate('calendrier')"><i class="fas fa-calendar-alt"></i><span>Calendrier</span></div>
          <div class="quick-action" onclick="App.navigate('sujets-priere')"><i class="fas fa-praying-hands"></i><span>Prière</span></div>
          <div class="quick-action" onclick="App.navigate('temoignages')"><i class="fas fa-star"></i><span>Témoignages</span></div>
          ${Permissions.canAddDisciple() ? `<div class="quick-action" onclick="App.navigate('membres-add')"><i class="fas fa-user-plus"></i><span>Ajouter</span></div>` : ''}
          ${Permissions.canViewStats() ? `<div class="quick-action" onclick="App.navigate('statistiques')"><i class="fas fa-chart-bar"></i><span>Stats</span></div>` : ''}
        </div>
      </div>
      ${prochainsProgrammes.length > 0 ? `<div class="dashboard-section"><div class="section-header"><h3 class="section-title"><i class="fas fa-calendar-check"></i> Prochains programmes</h3><a href="#" onclick="App.navigate('calendrier'); return false;" class="btn btn-sm btn-outline">Voir tout</a></div><div class="card"><div class="card-body" style="padding: 0;">${prochainsProgrammes.map(p => { const date = p.date_debut?.toDate ? p.date_debut.toDate() : new Date(p.date_debut); return `<div class="programme-card-mini" onclick="App.viewProgramme('${p.id}')"><div class="prog-date"><span class="prog-day">${date.getDate()}</span><span class="prog-month">${date.toLocaleString('fr-FR', { month: 'short' })}</span></div><div class="prog-info"><div class="prog-name">${Utils.escapeHtml(p.nom)}</div><div class="prog-type" style="color: ${Programmes.getTypeColor(p.type)}">${Programmes.getTypeLabel(p.type)}</div></div><div class="prog-time"><i class="fas fa-clock"></i> ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></div>`; }).join('')}</div></div></div>` : ''}
      ${Permissions.hasRole('mentor') && mesDisciples.length > 0 ? `<div class="dashboard-section"><div class="section-header"><h3 class="section-title"><i class="fas fa-user-friends"></i> Mes disciples</h3><a href="#" onclick="App.navigate('mes-disciples'); return false;" class="btn btn-sm btn-outline">Voir tout</a></div><div class="card"><div class="card-body" style="padding: 0;">${mesDisciples.slice(0, 5).map(d => `<div class="member-card"><div class="member-avatar" style="background: ${d.sexe === 'F' ? '#E91E63' : 'var(--primary)'}">${Utils.getInitials(d.prenom, d.nom)}</div><div class="member-info"><div class="member-name">${Utils.escapeHtml(d.prenom)} ${Utils.escapeHtml(d.nom)}</div><div class="member-email">${Utils.escapeHtml(d.email)}</div></div><span class="badge badge-${d.role}">${Utils.getRoleLabel(d.role)}</span></div>`).join('')}</div></div></div>` : ''}
      <style>
        .programme-card-mini{display:flex;align-items:center;gap:var(--spacing-md);padding:var(--spacing-md);border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.2s}
        .programme-card-mini:hover{background:var(--bg-primary)}
        .programme-card-mini:last-child{border-bottom:none}
        .prog-date{text-align:center;min-width:50px;padding:var(--spacing-xs);background:var(--bg-primary);border-radius:var(--radius-sm)}
        .prog-day{display:block;font-size:1.2rem;font-weight:700;color:var(--primary)}
        .prog-month{font-size:0.7rem;text-transform:uppercase;color:var(--text-muted)}
        .prog-info{flex:1}
        .prog-name{font-weight:600;margin-bottom:2px}
        .prog-type{font-size:0.8rem}
        .prog-time{font-size:0.85rem;color:var(--text-muted)}
        .notification-card-mini{display:flex;align-items:flex-start;gap:var(--spacing-md);padding:var(--spacing-md);border-bottom:1px solid var(--border-color);transition:background 0.2s}
        .notification-card-mini:hover{background:var(--bg-primary)}
        .notification-card-mini:last-child{border-bottom:none}
        .notif-priority{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0}
        .notif-content{flex:1;min-width:0}
        .notif-text{font-weight:500;margin-bottom:4px;line-height:1.4}
        .notif-meta{display:flex;gap:var(--spacing-sm);font-size:0.75rem;color:var(--text-muted)}
        .notif-author{font-weight:500}
      </style>
    `;
  },

  renderLayout(pageTitle, content) {
    const user = AppState.user, famille = AppState.famille;
    return `
      <div class="app-container">
        <aside class="sidebar">
          <div class="sidebar-header"><div class="sidebar-logo">✝️</div><div><div class="sidebar-title">CRM Famille</div><div class="sidebar-subtitle">${Utils.escapeHtml(famille?.nom || '')}</div></div></div>
          <nav class="sidebar-nav">
            <div class="nav-section"><div class="nav-section-title">Principal</div>
              <div class="nav-item ${AppState.currentPage === 'dashboard' ? 'active' : ''}" onclick="App.navigate('dashboard')"><i class="fas fa-home"></i><span>Tableau de bord</span></div>
              <div class="nav-item ${AppState.currentPage === 'profil' ? 'active' : ''}" onclick="App.navigate('profil')"><i class="fas fa-user"></i><span>Mon profil</span></div>
              <div class="nav-item ${AppState.currentPage === 'calendrier' ? 'active' : ''}" onclick="App.navigate('calendrier')"><i class="fas fa-calendar-alt"></i><span>Calendrier</span></div>
              <div class="nav-item ${AppState.currentPage === 'annuaire' ? 'active' : ''}" onclick="App.navigate('annuaire')"><i class="fas fa-address-book"></i><span>Annuaire</span></div>
            </div>
            <div class="nav-section"><div class="nav-section-title">Communauté</div>
              <div class="nav-item ${AppState.currentPage === 'notifications' ? 'active' : ''}" onclick="App.navigate('notifications')"><i class="fas fa-bell"></i><span>Notifications</span></div>
              <div class="nav-item ${AppState.currentPage === 'sujets-priere' ? 'active' : ''}" onclick="App.navigate('sujets-priere')"><i class="fas fa-praying-hands"></i><span>Prière</span></div>
              <div class="nav-item ${AppState.currentPage === 'temoignages' ? 'active' : ''}" onclick="App.navigate('temoignages')"><i class="fas fa-star"></i><span>Témoignages</span></div>
              <div class="nav-item ${AppState.currentPage === 'documents' ? 'active' : ''}" onclick="App.navigate('documents')"><i class="fas fa-folder"></i><span>Documents</span></div>
            </div>
            ${Permissions.hasRole('mentor') ? `<div class="nav-section"><div class="nav-section-title">Gestion</div>
              <div class="nav-item ${AppState.currentPage === 'mes-disciples' ? 'active' : ''}" onclick="App.navigate('mes-disciples')"><i class="fas fa-user-friends"></i><span>Mes disciples</span></div>
              <div class="nav-item ${AppState.currentPage === 'programmes' ? 'active' : ''}" onclick="App.navigate('programmes')"><i class="fas fa-clipboard-list"></i><span>Programmes</span></div>
              <div class="nav-item ${AppState.currentPage === 'statistiques' ? 'active' : ''}" onclick="App.navigate('statistiques')"><i class="fas fa-chart-bar"></i><span>Statistiques</span></div>
            </div>` : ''}
            ${Permissions.canViewAllMembers() ? `<div class="nav-section"><div class="nav-section-title">Administration</div>
              <div class="nav-item ${AppState.currentPage === 'membres' ? 'active' : ''}" onclick="App.navigate('membres')"><i class="fas fa-users"></i><span>Tous les membres</span></div>
            </div>` : ''}
          </nav>
          <div class="sidebar-user">
            <div class="user-avatar">${Utils.getInitials(user.prenom, user.nom)}</div>
            <div class="user-info"><div class="user-name">${Utils.escapeHtml(user.prenom)} ${Utils.escapeHtml(user.nom)}</div><div class="user-role">${Utils.getRoleLabel(user.role)}</div></div>
            <button class="btn-logout" onclick="Auth.logout()" title="Se déconnecter"><i class="fas fa-sign-out-alt"></i></button>
          </div>
        </aside>
        <main class="main-content">
          <header class="main-header"><div class="header-left"><h1 class="page-title">${pageTitle}</h1></div><div class="header-right"><div class="header-family-badge"><i class="fas fa-church"></i><span>${Utils.escapeHtml(famille?.nom || '')}</span></div></div></header>
          <div class="page-content">${content}</div>
        </main>
      </div>
    `;
  },

  filterMembres() { const search = document.getElementById('search-membres')?.value.toLowerCase() || ''; const roleFilter = document.getElementById('filter-role')?.value || ''; document.querySelectorAll('#membres-list .member-card').forEach(card => { const name = card.dataset.name || ''; const role = card.dataset.role || ''; card.style.display = name.includes(search) && (!roleFilter || role === roleFilter) ? '' : 'none'; }); },
  filterAnnuaire() { const search = document.getElementById('search-annuaire')?.value.toLowerCase() || ''; document.querySelectorAll('#annuaire-list .member-card').forEach(card => { card.style.display = (card.dataset.name || '').includes(search) ? '' : 'none'; }); },
  filterProgrammes() { const search = document.getElementById('search-programmes')?.value.toLowerCase() || ''; const typeFilter = document.getElementById('filter-type')?.value || ''; document.querySelectorAll('#programmes-list .programme-card').forEach(card => { const name = card.dataset.name || ''; const type = card.dataset.type || ''; card.style.display = name.includes(search) && (!typeFilter || type === typeFilter) ? '' : 'none'; }); },

  viewMembre(id) { document.querySelector('.page-content').innerHTML = Pages.renderProfil(id); },
  editMembre(id) { document.querySelector('.page-content').innerHTML = Pages.renderProfilEdit(id); },
  viewProgramme(id) { this.navigate('programme-detail', { programmeId: id }); },
  editProgramme(id) { this.navigate('programmes-edit', { programmeId: id }); },
  viewHistoriqueMembre(id) { this.navigate('historique-membre', { membreId: id }); },

  toggleMentorField() { const r = document.getElementById('membre-role'); const m = document.getElementById('mentor-group'); if (r && m) m.style.display = r.value === 'nouveau' ? 'none' : 'block'; },

  async submitAddMembre(event) { event.preventDefault(); const d = { prenom: document.getElementById('membre-prenom').value.trim(), nom: document.getElementById('membre-nom').value.trim(), email: document.getElementById('membre-email').value.trim(), role: document.getElementById('membre-role').value, mentor_id: document.getElementById('membre-role').value === 'nouveau' ? null : document.getElementById('membre-mentor').value }; try { await Auth.createMembre(d); await Membres.loadAll(); this.navigate('membres'); } catch (e) {} },

  async submitEditProfil(event, membreId) { event.preventDefault(); const formations = []; document.querySelectorAll('[id^="formation-"]:checked').forEach(cb => formations.push(cb.value)); const data = { prenom: document.getElementById('edit-prenom').value.trim(), nom: document.getElementById('edit-nom').value.trim(), sexe: document.getElementById('edit-sexe').value || null, date_naissance: document.getElementById('edit-date-naissance').value ? new Date(document.getElementById('edit-date-naissance').value) : null, telephone: document.getElementById('edit-telephone').value.trim() || null, adresse_ville: document.getElementById('edit-ville').value.trim() || null, adresse_code_postal: document.getElementById('edit-cp').value.trim() || null, date_arrivee_icc: document.getElementById('edit-date-icc').value ? new Date(document.getElementById('edit-date-icc').value) : null, formations, ministere_service: document.getElementById('edit-ministere').value.trim() || null, baptise_immersion: document.getElementById('edit-baptise').value === 'true' ? true : document.getElementById('edit-baptise').value === 'false' ? false : null, profession: document.getElementById('edit-profession').value.trim() || null, statut_professionnel: document.getElementById('edit-statut-pro').value || null, passions_centres_interet: document.getElementById('edit-passions').value.trim() || null }; if (await Membres.update(membreId, data)) this.navigate('profil'); },

  async submitProgramme(event, programmeId = null) {
    event.preventDefault();
    try {
      const dateDebutInput = document.getElementById('prog-debut').value;
      const dateFinInput = document.getElementById('prog-fin').value;
      
      if (!dateDebutInput) {
        Toast.error('La date de début est obligatoire');
        return;
      }

      const d = {
        nom: document.getElementById('prog-nom').value.trim(),
        type: document.getElementById('prog-type').value,
        date_debut: firebase.firestore.Timestamp.fromDate(new Date(dateDebutInput)),
        date_fin: dateFinInput ? firebase.firestore.Timestamp.fromDate(new Date(dateFinInput)) : null,
        lieu: document.getElementById('prog-lieu').value.trim() || null,
        recurrence: document.getElementById('prog-recurrence').value,
        description: document.getElementById('prog-description').value.trim() || null
      };

      if (programmeId) {
        await Programmes.update(programmeId, d);
      } else {
        await Programmes.create(d);
        // Recharger les programmes pour mettre à jour le dashboard
        await Programmes.loadAll();
      }
      this.navigate('programmes');
    } catch (error) {
      console.error('Erreur soumission programme:', error);
      ErrorHandler.handle(error, 'Création programme');
    }
  },

  showLoading() { AppState.isLoading = true; let l = document.getElementById('app-loader'); if (!l) { l = document.createElement('div'); l.id = 'app-loader'; l.innerHTML = '<div class="loading"><div class="spinner"></div></div>'; l.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;'; document.body.appendChild(l); } l.style.display = 'flex'; },
  hideLoading() { AppState.isLoading = false; const l = document.getElementById('app-loader'); if (l) l.style.display = 'none'; },
  showForgotPassword() { const e = prompt('Entrez votre adresse email :'); if (e && Utils.isValidEmail(e)) Auth.resetPassword(e); else if (e) Toast.error('Email invalide'); }
};

document.addEventListener('DOMContentLoaded', () => App.init());
