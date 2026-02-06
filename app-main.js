// ============================================
// APPLICATION PRINCIPALE - Version 3.0
// Phases 1, 2, 3 et 4 intégrées
// ============================================

const App = {
  async init() {
    initFirebase();
    Toast.init();
    this.applyTheme(localStorage.getItem('crm_theme') || 'light');
    this.setupErrorHandling();
    // Attendre la vérification de session (spinner initial) pour garder la session après F5
    const isLoggedIn = await Auth.checkAuthState();
    if (isLoggedIn) {
      await this.loadAllData();
      if (window.location.hash && window.location.hash.length > 1) {
        this.navigateFromHash();
      } else {
        this.navigate('dashboard');
      }
      window.addEventListener('hashchange', () => this.navigateFromHash());
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
    const LOAD_TIMEOUT_MS = 50000; // 50 s max pour éviter spinner bloqué après F5
    App.showLoading();
    const loadPromise = (async () => {
      try {
        const promises = [
          ErrorHandler.wrap(Membres.loadAll(), 'Chargement membres'),
          ErrorHandler.wrap(Programmes.loadAll(), 'Chargement programmes')
        ];
        if (Permissions.hasRole('mentor')) {
          promises.push(ErrorHandler.wrap(NouvellesAmes.loadAll(), 'Chargement nouvelles âmes'));
        }
        await Promise.all(promises);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        App.hideLoading();
      }
    })();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        // Ne pas afficher de message d'erreur : on affiche simplement l'app avec les données déjà chargées
        App.hideLoading();
        resolve();
      }, LOAD_TIMEOUT_MS);
    });
    await Promise.race([loadPromise, timeoutPromise]);
  },

  async showLoginPage() {
    document.getElementById('app').innerHTML = Pages.renderLogin();
    await Auth.loadFamiliesForLogin();
    // Bouton afficher/masquer mot de passe (liaison en JS pour fiabilité locale + déployé)
    const pwdToggle = document.querySelector('.password-input-wrap .password-toggle-btn');
    if (pwdToggle) {
      pwdToggle.addEventListener('click', function () {
        const wrap = this.closest('.password-input-wrap');
        const input = wrap && wrap.querySelector('input');
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        const icon = this.querySelector('i');
        if (icon) icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        this.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
        this.setAttribute('title', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      });
    }
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const famille = document.getElementById('login-famille').value.trim();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      await Auth.login(email, password, famille);
      if (AppState.user) {
        try {
          await this.loadAllData();
        } catch (err) {
          console.error('Chargement des données après connexion:', err);
          if (err.code === 'permission-denied' || (err.message && err.message.includes('insufficient permissions'))) {
            Toast.error('Connexion OK mais chargement des membres refusé. Vérifiez les règles Firestore pour la collection utilisateurs (requête par famille_id).');
          }
          this.navigate('dashboard');
        }
      }
    });
  },

  currentParams: {},
  previousPage: null,
  previousParams: null,

  getPreviousPageLabel() {
    const labels = {
      dashboard: 'Tableau de bord', membres: 'Membres', 'membres-add': 'Ajouter un membre', 'archives-membres': 'Archivage des membres',
      profil: 'Mon profil', 'profil-edit': 'Modifier le profil', 'mon-compte': 'Mon compte', annuaire: 'Annuaire', 'mes-disciples': 'Mes disciples',
      calendrier: 'Calendrier', programmes: 'Programmes', 'programmes-add': 'Nouveau programme', 'programmes-edit': 'Modifier le programme',
      'programme-detail': 'Détails du programme', presences: 'Pointage des présences', 'historique-membre': 'Historique de présence',
      statistiques: 'Statistiques', notifications: 'Notifications', 'sujets-priere': 'Sujets de prière', temoignages: 'Témoignages', documents: 'Documents',
      'nouvelles-ames': 'Nouvelles âmes', 'nouvelles-ames-add': 'Ajouter une nouvelle âme', 'nouvelle-ame-detail': 'Détail nouvelle âme', 'nouvelle-ame-suivi': 'Ajouter un suivi',
      evangelisation: 'Évangélisation', 'evangelisation-stats': 'Statistiques évangélisation', 'evangelisation-planning': 'Planning', 'evangelisation-add': 'Nouvelle session',
      'evangelisation-detail': 'Détail session', secteurs: 'Secteurs', 'admin-familles': 'Gestion des familles', logs: 'Journal d\'activité'
    };
    return this.previousPage ? (labels[this.previousPage] || this.previousPage) : 'Tableau de bord';
  },

  goBack() {
    if (this.previousPage) {
      const p = this.previousPage, par = this.previousParams || {};
      this._navigatingBack = true;
      this.previousPage = null;
      this.previousParams = null;
      this.navigate(p, par);
      this._navigatingBack = false;
    } else {
      this.navigate('dashboard');
    }
  },

  // Navigation par hash : #page ou #page/id (compatible liens directs et rafraîchissement)
  parseHash() {
    const raw = (window.location.hash || '#dashboard').slice(1).trim();
    const [page, id] = raw.split('/').map(s => s.trim()).filter(Boolean);
    const params = {};
    if (page && id) {
      if (['programme-detail', 'programmes-edit', 'presences'].includes(page)) params.programmeId = id;
      else if (page === 'historique-membre') params.membreId = id;
      else params.id = id;
    }
    return { page: page || 'dashboard', params: params };
  },

  updateHash(page, params = {}) {
    let hash = page;
    const id = params.programmeId || params.membreId || params.id;
    if (id) hash += '/' + id;
    if (window.location.hash !== '#' + hash) {
      window.location.hash = hash;
    }
  },

  navigate(page, params = {}) {
    if (!this._navigatingBack && AppState.currentPage && AppState.currentPage !== page) {
      this.previousPage = AppState.currentPage;
      this.previousParams = Object.assign({}, this.currentParams || {});
    }
    AppState.currentPage = page;
    this.currentParams = params;
    this.updateHash(page, params);
    this.closeSidebar();
    this.render();
  },

  toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    overlay.setAttribute('aria-hidden', !isOpen);
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', isOpen);
      menuBtn.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    }
  },

  closeSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) { overlay.classList.remove('active'); overlay.setAttribute('aria-hidden', 'true'); }
  },

  navigateFromHash() {
    const { page, params } = this.parseHash();
    const validPages = ['dashboard', 'membres', 'membres-add', 'profil', 'profil-edit', 'mon-compte', 'annuaire',
      'mes-disciples', 'calendrier', 'programmes', 'programmes-add', 'programmes-edit', 'programme-detail',
      'presences', 'historique-membre', 'statistiques', 'notifications', 'sujets-priere', 'temoignages',
      'documents', 'nouvelles-ames', 'nouvelles-ames-add', 'nouvelle-ame-detail', 'nouvelle-ame-suivi',
      'evangelisation', 'evangelisation-stats', 'evangelisation-planning', 'evangelisation-add',
      'evangelisation-detail', 'secteurs'];
    if (validPages.includes(page)) {
      AppState.currentPage = page;
      this.currentParams = params;
      this.render();
    }
  },

  async render() {
    if (!AppState.user) { this.showLoginPage(); return; }

    let pageContent = '', pageTitle = '';
    App.showLoading();

    try {
    switch (AppState.currentPage) {
      case 'dashboard': pageTitle = 'Tableau de bord'; pageContent = await this.renderDashboardEnhanced(); break;
      case 'membres': pageTitle = 'Membres'; pageContent = Pages.renderMembres(); break;
      case 'membres-add': pageTitle = 'Ajouter un membre'; pageContent = Pages.renderAddMembre(); break;
      case 'archives-membres': pageTitle = 'Archivage des membres'; pageContent = Pages.renderArchivesMembres(); break;
      case 'profil': pageTitle = 'Mon profil'; pageContent = Pages.renderProfil(); break;
      case 'profil-edit': pageTitle = 'Modifier le profil'; pageContent = Pages.renderProfilEdit(); break;
      case 'mon-compte': pageTitle = 'Mon compte'; pageContent = Pages.renderMonCompte(); break;
      case 'annuaire': pageTitle = 'Annuaire'; pageContent = Pages.renderAnnuaire(); break;
      case 'mes-disciples': pageTitle = 'Mes disciples'; pageContent = Pages.renderMembres(); break;
      case 'calendrier': pageTitle = 'Calendrier'; pageContent = await PagesCalendrier.renderCalendrier(); break;
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
      case 'nouvelles-ames': pageTitle = 'Nouvelles âmes'; pageContent = await PagesNouvellesAmes.render(); break;
      case 'nouvelles-ames-add': pageTitle = 'Ajouter une nouvelle âme'; pageContent = PagesNouvellesAmes.renderAdd(); break;
      case 'nouvelle-ame-detail': pageTitle = 'Détail nouvelle âme'; pageContent = await PagesNouvellesAmes.renderDetail(this.currentParams.id); break;
      case 'nouvelle-ame-suivi': pageTitle = 'Ajouter un suivi'; pageContent = PagesNouvellesAmes.renderAddSuivi(this.currentParams.id); break;
      case 'evangelisation': pageTitle = 'Évangélisation'; pageContent = await PagesEvangelisation.render(); break;
      case 'evangelisation-stats': pageTitle = 'Statistiques évangélisation'; pageContent = await PagesEvangelisation.renderEvangelisationStats(); break;
      case 'evangelisation-planning': pageTitle = 'Planning évangélisation'; pageContent = await PagesEvangelisation.renderPlanning(); break;
      case 'evangelisation-add': pageTitle = 'Nouvelle session'; pageContent = PagesEvangelisation.renderAdd(); break;
      case 'evangelisation-detail': pageTitle = 'Détail session'; pageContent = await PagesEvangelisation.renderDetail(this.currentParams.id); break;
      case 'secteurs': pageTitle = 'Secteurs'; pageContent = await PagesEvangelisation.renderSecteurs(); break;
      case 'admin-familles': pageTitle = 'Gestion des familles'; pageContent = await Pages.renderAdminFamilles(); break;
      case 'logs': pageTitle = 'Journal d\'activité'; pageContent = await Pages.renderLogs(); break;
      default: pageTitle = 'Page non trouvée'; pageContent = '<div class="alert alert-warning">Cette page n\'existe pas.</div>';
    }

    document.getElementById('app').innerHTML = this.renderLayout(pageTitle, pageContent);
    this.applyTheme(localStorage.getItem('crm_theme') || 'light');
    } catch (err) {
      console.error('Erreur chargement page:', err);
      Toast.error('Erreur lors du chargement de la page. Réessayez.');
      pageTitle = pageTitle || 'Erreur';
      pageContent = '<div class="alert alert-danger"><strong>Erreur de chargement.</strong><p>Si le problème persiste, rafraîchissez la page (F5) ou vérifiez votre connexion.</p></div>';
      document.getElementById('app').innerHTML = this.renderLayout(pageTitle, pageContent);
    } finally {
      App.hideLoading();
    }
    if (AppState.currentPage === 'sujets-priere' && typeof PagesPriere.initCharts === 'function') {
      setTimeout(() => PagesPriere.initCharts(), 50);
    }
    if (AppState.currentPage === 'mes-disciples' && typeof PagesDisciples.initCharts === 'function') {
      setTimeout(() => PagesDisciples.initCharts(), 50);
    }
    if (AppState.currentPage === 'nouvelles-ames' && typeof PagesNouvellesAmes.initCharts === 'function') {
      setTimeout(() => PagesNouvellesAmes.initCharts(), 50);
    }
    if (AppState.currentPage === 'nouvelle-ame-detail' && typeof NotesSuivi !== 'undefined' && NotesSuivi.canAddNote() && this.currentParams.id) {
      setTimeout(() => NotesSuivi.loadAndRender('nouvelle_ame', this.currentParams.id), 50);
    }
    if (AppState.currentPage === 'statistiques' && typeof PagesStatistiques.initCharts === 'function') {
      setTimeout(() => PagesStatistiques.initCharts(), 50);
    }
  },

  renderObjectifsKPI(statsNA, statsEvang, statsMembres) {
    const famId = AppState.famille?.id || 'default';
    const stored = JSON.parse(localStorage.getItem(`crm_objectifs_${famId}`) || '{}');
    const objNA = stored.nouvelles_ames || 5;
    const objContacts = stored.contacts_evang || 10;
    const realNA = statsNA?.integres || 0;
    const realContacts = statsEvang?.totalContacts || 0;
    const pctNA = objNA > 0 ? Math.round((realNA / objNA) * 100) : 0;
    const pctContacts = objContacts > 0 ? Math.round((realContacts / objContacts) * 100) : 0;
    return `
      <div class="dashboard-section">
        <div class="section-header">
          <h3 class="section-title"><i class="fas fa-bullseye"></i> Objectifs du mois</h3>
          <button type="button" class="btn btn-sm btn-outline" onclick="App.editObjectifs()" title="Modifier les objectifs">Modifier</button>
        </div>
        <div class="card">
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-lg);">
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px;">Nouvelles âmes intégrées</div>
                <div style="display: flex; align-items: baseline; gap: 8px;">
                  <span style="font-size: 1.5rem; font-weight: 700;">${realNA}</span>
                  <span style="color: var(--text-muted);">/ ${objNA}</span>
                </div>
                <div class="progress-bar-container" style="margin-top: 8px; height: 8px;">
                  <div class="progress-bar" style="width: ${Math.min(pctNA, 100)}%; background: ${pctNA >= 100 ? 'var(--success)' : 'var(--primary)'};"></div>
                </div>
              </div>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px;">Contacts évangélisation</div>
                <div style="display: flex; align-items: baseline; gap: 8px;">
                  <span style="font-size: 1.5rem; font-weight: 700;">${realContacts}</span>
                  <span style="color: var(--text-muted);">/ ${objContacts}</span>
                </div>
                <div class="progress-bar-container" style="margin-top: 8px; height: 8px;">
                  <div class="progress-bar" style="width: ${Math.min(pctContacts, 100)}%; background: ${pctContacts >= 100 ? 'var(--success)' : '#009688'};"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  editObjectifs() {
    const famId = AppState.famille?.id || 'default';
    const stored = JSON.parse(localStorage.getItem(`crm_objectifs_${famId}`) || '{}');
    const objNA = stored.nouvelles_ames ?? 5;
    const objContacts = stored.contacts_evang ?? 10;
    const html = `
      <div class="modal-overlay active" id="modal-objectifs">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-bullseye"></i> Objectifs du mois</h3>
            <button class="modal-close" onclick="document.getElementById('modal-objectifs').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nouvelles âmes à intégrer (objectif)</label>
              <input type="number" class="form-control" id="obj-na" min="0" value="${objNA}">
            </div>
            <div class="form-group">
              <label class="form-label">Contacts évangélisation (objectif)</label>
              <input type="number" class="form-control" id="obj-contacts" min="0" value="${objContacts}">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('modal-objectifs').remove();">Annuler</button>
            <button class="btn btn-primary" onclick="App.saveObjectifs()"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  getRaccourcisNav() {
    const RACCOURCIS = [
      { id: 'dashboard', label: 'Tableau de bord', icon: 'fa-home' },
      { id: 'calendrier', label: 'Calendrier', icon: 'fa-calendar-alt' },
      { id: 'nouvelles-ames', label: 'Nouvelles âmes', icon: 'fa-seedling' },
      { id: 'evangelisation', label: 'Évangélisation', icon: 'fa-bullhorn' },
      { id: 'statistiques', label: 'Statistiques', icon: 'fa-chart-bar' },
      { id: 'sujets-priere', label: 'Prières', icon: 'fa-praying-hands' }
    ];
    const favs = JSON.parse(localStorage.getItem('crm_raccourcis') || '[]');
    if (favs.length === 0) return '';
    const items = favs.map(id => RACCOURCIS.find(r => r.id === id)).filter(Boolean);
    if (items.length === 0) return '';
    return `
      <div class="nav-section">
        <div class="nav-section-title">Raccourcis</div>
        ${items.map(r => `
          <div class="nav-item ${AppState.currentPage === r.id ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('${r.id}')" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); App.navigate('${r.id}'); }">
            <i class="fas ${r.icon}"></i><span>${r.label}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  saveObjectifs() {
    const famId = AppState.famille?.id || 'default';
    const objNA = parseInt(document.getElementById('obj-na')?.value || '5', 10);
    const objContacts = parseInt(document.getElementById('obj-contacts')?.value || '10', 10);
    localStorage.setItem(`crm_objectifs_${famId}`, JSON.stringify({
      nouvelles_ames: Math.max(0, objNA),
      contacts_evang: Math.max(0, objContacts)
    }));
    document.getElementById('modal-objectifs')?.remove();
    Toast.success('Objectifs enregistrés');
    this.render();
  },

  showCreateFamilleModal() {
    const modalId = 'modal-create-famille';
    const html = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-church"></i> Créer une famille</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label required">Nom de la famille</label>
              <input type="text" class="form-control" id="new-famille-nom" placeholder="Ex: Famille Espérance" required>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
            <button class="btn btn-primary" onclick="App.submitCreateFamille()"><i class="fas fa-save"></i> Créer</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async submitCreateFamille() {
    const nom = document.getElementById('new-famille-nom')?.value?.trim();
    if (!nom) { Toast.warning('Saisissez le nom de la famille'); return; }
    try {
      await Auth.createFamille(nom);
      document.getElementById('modal-create-famille')?.remove();
      Toast.success('Famille créée');
      this.render();
    } catch (e) {
      Toast.error(e.message || 'Erreur');
    }
  },

  showAddSuperviseurModalFromButton(btn) {
    const familleId = btn.dataset.familleId;
    const familleNom = btn.dataset.familleNom || '';
    if (!familleId) return;
    this.showAddSuperviseurModal(familleId, familleNom);
  },

  showAddSuperviseurModal(familleId, familleNom) {
    const modalId = 'modal-add-superviseur-famille';
    const html = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-user-plus"></i> Ajouter un superviseur</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info mb-3">Famille : <strong>${Utils.escapeHtml(familleNom)}</strong>. Ce superviseur pourra ensuite ajouter mentors et disciples depuis la fenêtre de connexion.</div>
            <div class="form-group">
              <label class="form-label required">Prénom</label>
              <input type="text" class="form-control" id="superviseur-prenom" required>
            </div>
            <div class="form-group">
              <label class="form-label required">Nom</label>
              <input type="text" class="form-control" id="superviseur-nom" required>
            </div>
            <div class="form-group">
              <label class="form-label required">Email</label>
              <input type="email" class="form-control" id="superviseur-email" required>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
            <button class="btn btn-primary" onclick="App.submitAddSuperviseurForFamily('${familleId}')"><i class="fas fa-save"></i> Créer le superviseur</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async submitAddSuperviseurForFamily(familleId) {
    const prenom = document.getElementById('superviseur-prenom')?.value?.trim();
    const nom = document.getElementById('superviseur-nom')?.value?.trim();
    const email = document.getElementById('superviseur-email')?.value?.trim();
    if (!prenom || !nom || !email) { Toast.warning('Remplissez tous les champs'); return; }
    try {
      await Auth.createMembreForFamily(familleId, { prenom, nom, email, role: 'superviseur' });
      document.getElementById('modal-add-superviseur-famille')?.remove();
    } catch (e) {
      Toast.error(e.message || 'Erreur');
    }
  },

  async renderDashboardEnhanced() {
    const stats = Membres.getStats();
    const user = AppState.user;
    const mesDisciples = user.role !== 'disciple' && user.role !== 'nouveau' ? Membres.getDisciples(user.id) : [];
    const prochainsProgrammes = Programmes.getUpcoming(5);
    
    // Charger les programmes à pointer (seulement pour mentors et superviseurs)
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

    // Alertes absence (superviseurs / stats) : membres avec taux de présence < 50 % sur les 30 derniers jours
    let alertesAbsence = [];
    if (Permissions.canViewStats()) {
      try {
        alertesAbsence = await Statistiques.getLowAttendanceMembers(50, 30);
      } catch (error) {
        console.error('Erreur chargement alertes absence:', error);
      }
    }

    // Répartition des membres par mentor (proportion du total famille) pour le tableau de bord
    let repartitionMentors = null;
    if (Permissions.canViewStats()) {
      try {
        repartitionMentors = Statistiques.getRepartitionMentorsData();
      } catch (e) {
        console.error('Erreur répartition mentors:', e);
      }
    }
    
    // Charger les statistiques des nouvelles âmes (pour mentors et plus)
    let statsNouvellesAmes = { total: 0, aRelancer: 0 };
    let amesARelancer = [];
    let statsEvangelisation = { totalSessions: 0, totalContacts: 0, upcoming: 0 };
    let countNA = 0, countNC = 0;
    if (Permissions.hasRole('mentor')) {
      try {
        await NouvellesAmes.loadAll();
        statsNouvellesAmes = NouvellesAmes.getStats();
        countNA = NouvellesAmes.getByCategorie('na').length;
        countNC = NouvellesAmes.getByCategorie('nc').length;
        amesARelancer = NouvellesAmes.getARelancer(7).slice(0, 5);
      } catch (error) {
        console.error('Erreur chargement stats nouvelles âmes:', error);
      }
      
      try {
        await SessionsEvangelisation.loadAll();
        statsEvangelisation = SessionsEvangelisation.getStats();
      } catch (error) {
        console.error('Erreur chargement stats évangélisation:', error);
      }
    }

    return `
      ${Permissions.hasRole('mentor') ? `
      <!-- Ligne 1 : 4 cartes (nouvelles âmes + évangélisation) -->
      <div class="dashboard-section mb-3">
        <div class="dashboard-grid dashboard-grid-4" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-md);">
          <div class="stat-card clickable" onclick="App.navigate('nouvelles-ames', { categorie: 'na' });" title="Voir les Nouveaux Arrivants (NA)" style="cursor: pointer;">
            <div class="stat-icon" style="background: #2196F320; color: #2196F3; cursor: pointer;"><i class="fas fa-user-plus"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${countNA}</div><div class="stat-label" style="cursor: pointer;">Nouveaux Arrivants (NA)</div></div>
          </div>
          <div class="stat-card clickable" onclick="App.navigate('nouvelles-ames', { categorie: 'nc' });" title="Voir les Nouveaux Convertis (NC)" style="cursor: pointer;">
            <div class="stat-icon" style="background: #E91E6320; color: #E91E63; cursor: pointer;"><i class="fas fa-heart"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${countNC}</div><div class="stat-label" style="cursor: pointer;">Nouveaux Convertis (NC)</div></div>
          </div>
          <div class="stat-card clickable" onclick="App.navigate('nouvelles-ames')" title="Voir les nouvelles âmes" style="cursor: pointer;">
            <div class="stat-icon" style="background: #8BC34A20; color: #8BC34A; cursor: pointer;"><i class="fas fa-seedling"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${statsNouvellesAmes.total}</div><div class="stat-label" style="cursor: pointer;">Nouvelles âmes</div></div>
          </div>
          <div class="stat-card clickable" onclick="App.navigate('evangelisation')" title="Voir l'évangélisation" style="cursor: pointer;">
            <div class="stat-icon" style="background: #00968820; color: #009688; cursor: pointer;"><i class="fas fa-bullhorn"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${statsEvangelisation.totalContacts}</div><div class="stat-label" style="cursor: pointer;">Contacts évangélisation</div></div>
          </div>
        </div>
      </div>
      ` : ''}
      <!-- Ligne 2 : 4 cartes (toujours affichée) -->
      <div class="dashboard-section mb-3">
        <div class="dashboard-grid dashboard-grid-4" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-md);">
          <div class="stat-card clickable" onclick="App.navigate('membres')" title="Voir tous les membres" style="cursor: pointer;">
            <div class="stat-icon primary" style="cursor: pointer;"><i class="fas fa-users"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${stats.total}</div><div class="stat-label" style="cursor: pointer;">Membres actifs</div></div>
          </div>
          ${Permissions.hasRole('mentor') ? `
          <div class="stat-card clickable" onclick="App.navigate('mes-disciples')" title="Voir mes disciples" style="cursor: pointer;">
            <div class="stat-icon success" style="cursor: pointer;"><i class="fas fa-user-friends"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${mesDisciples.length}</div><div class="stat-label" style="cursor: pointer;">Mes disciples</div></div>
          </div>
          ` : '<div></div>'}
          <div class="stat-card clickable" onclick="App.navigate('programmes')" title="Voir tous les programmes" style="cursor: pointer;">
            <div class="stat-icon warning" style="cursor: pointer;"><i class="fas fa-calendar-alt"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${AppState.programmes.length}</div><div class="stat-label" style="cursor: pointer;">Programmes</div></div>
          </div>
          <div class="stat-card clickable" onclick="App.navigate('annuaire')" title="Voir l'annuaire" style="cursor: pointer;">
            <div class="stat-icon info" style="cursor: pointer;"><i class="fas fa-birthday-cake"></i></div>
            <div class="stat-content" style="cursor: pointer;"><div class="stat-value" style="cursor: pointer;">${stats.anniversairesAujourdhui.length}</div><div class="stat-label" style="cursor: pointer;">Anniversaires</div></div>
          </div>
        </div>
      </div>
      ${stats.anniversairesAujourdhui.length > 0 ? `<div class="alert alert-success mb-3"><i class="fas fa-birthday-cake"></i><div class="alert-content"><div class="alert-title">🎂 Joyeux anniversaire !</div><p class="mb-0">${stats.anniversairesAujourdhui.map(m => m.prenom + ' ' + m.nom).join(', ')}</p></div></div>` : ''}
      ${repartitionMentors && repartitionMentors.totalFamille > 0 ? (Permissions.hasRole('superviseur') || Permissions.isAdmin() ? `
      <div class="dashboard-section">
        <div class="section-header">
          <h3 class="section-title"><i class="fas fa-users-cog"></i> Répartition des membres par mentor</h3>
          <a href="#" onclick="App.navigate('statistiques'); return false;" class="btn btn-sm btn-outline" style="cursor: pointer;">Voir les stats</a>
        </div>
        <div class="card">
          <div class="card-body">
            <p class="text-muted mb-3"><strong>Total famille :</strong> ${repartitionMentors.totalFamille} membre(s) actif(s). Chaque ligne = le groupe du mentor (tous rôles confondus) en proportion du total.</p>
            <div class="table-responsive">
              <table class="table">
                <thead><tr><th>Mentor / Berger</th><th class="text-center">Membres dans le groupe</th><th class="text-center">% du total</th></tr></thead>
                <tbody>
                  ${repartitionMentors.parMentor.map(m => `
                    <tr>
                      <td><strong>${Utils.escapeHtml(m.mentorName)}</strong></td>
                      <td class="text-center">${m.nbDansGroupe}</td>
                      <td class="text-center"><span class="badge badge-primary">${m.proportion}%</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      ` : Permissions.hasRole('mentor') ? (() => {
        const monEntree = repartitionMentors.parMentor.find(m => m.mentorId === user.id);
        if (!monEntree) return '';
        return `
      <div class="dashboard-section">
        <div class="section-header"><h3 class="section-title"><i class="fas fa-user-friends"></i> Votre groupe</h3><a href="#" onclick="App.navigate('statistiques'); return false;" class="btn btn-sm btn-outline" style="cursor: pointer;">Voir les stats</a></div>
        <div class="card">
          <div class="card-body">
            <p class="mb-0">Votre groupe représente <strong>${monEntree.nbDansGroupe} membre(s)</strong> sur ${repartitionMentors.totalFamille} au total, soit <strong>${monEntree.proportion}%</strong> de la famille.</p>
          </div>
        </div>
      </div>
      `;
      })() : '') : ''}
      ${programmesAPointer.length > 0 ? `<div class="alert alert-warning mb-3"><i class="fas fa-exclamation-triangle"></i><div class="alert-content"><div class="alert-title">⚠️ Programmes à pointer</div><p class="mb-2">${programmesAPointer.length} programme${programmesAPointer.length > 1 ? 's' : ''} récent${programmesAPointer.length > 1 ? 's' : ''} ${programmesAPointer.length > 1 ? 'n\'ont pas' : 'n\'a pas'} été complètement pointé${programmesAPointer.length > 1 ? 's' : ''}.</p><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">${programmesAPointer.map(p => { const date = p.date_debut?.toDate ? p.date_debut.toDate() : new Date(p.date_debut); return `<a href="#" onclick="App.navigate('presences', {programmeId: '${p.id}'}); return false;" class="btn btn-sm btn-warning" style="cursor: pointer;">${Utils.escapeHtml(p.nom)} - ${Utils.formatDate(date)}</a>`; }).join('')}</div></div></div>` : ''}
      ${dernieresNotifications.length > 0 ? `<div class="dashboard-section"><div class="section-header"><h3 class="section-title"><i class="fas fa-bell"></i> Dernières notifications</h3><a href="#" onclick="App.navigate('notifications'); return false;" class="btn btn-sm btn-outline" style="cursor: pointer;">Voir tout</a></div><div class="card"><div class="card-body" style="padding: 0;">${dernieresNotifications.map(n => { const priorite = Notifications.getPriorite(n.priorite); const date = n.created_at?.toDate ? n.created_at.toDate() : new Date(n.created_at); return `<div class="notification-card-mini" onclick="App.navigate('notifications'); return false;" style="cursor: pointer;"><div class="notif-priority" style="background: ${priorite.bgColor}; color: ${priorite.color};"><i class="fas ${priorite.icon}"></i></div><div class="notif-content"><div class="notif-text">${Utils.escapeHtml(n.contenu)}</div><div class="notif-meta"><span class="notif-author">${n.auteur_prenom || 'Anonyme'}</span><span class="notif-date">${Utils.formatRelativeDate(date)}</span></div></div></div>`; }).join('')}</div></div></div>` : ''}
      ${alertesAbsence.length > 0 ? `<div class="dashboard-section"><div class="section-header"><h3 class="section-title"><i class="fas fa-user-clock"></i> Alertes absence</h3><a href="#" onclick="App.navigate('statistiques'); return false;" class="btn btn-sm btn-outline" style="cursor: pointer;">Voir les stats</a></div><div class="alert alert-warning mb-0"><div class="alert-content"><p class="mb-2">Membres avec moins de 50 % de présence sur les 30 derniers jours (à recontacter) :</p><ul class="mb-0" style="list-style: none; padding-left: 0;">${alertesAbsence.slice(0, 8).map(a => `<li style="padding: var(--spacing-xs) 0; border-bottom: 1px solid rgba(0,0,0,0.06);"><strong>${Utils.escapeHtml(a.prenom)} ${Utils.escapeHtml(a.nom)}</strong> — ${a.tauxPresence} % (${a.nbPresences}/${a.nbTotal} présences, ${a.nbAbsences} absence${a.nbAbsences > 1 ? 's' : ''})${a.dernierProgramme ? ` — Dernier programme : ${Utils.formatDate(a.dernierProgramme)}` : ''}</li>`).join('')}</ul>${alertesAbsence.length > 8 ? `<p class="mt-2 mb-0 text-muted">... et ${alertesAbsence.length - 8} autre(s). <a href="#" onclick="App.navigate('statistiques'); return false;">Voir les statistiques</a></p>` : ''}</div></div></div>` : ''}
      ${amesARelancer.length > 0 ? `<div class="dashboard-section"><div class="section-header"><h3 class="section-title"><i class="fas fa-seedling"></i> Nouvelles âmes à relancer</h3><a href="#" onclick="App.navigate('nouvelles-ames'); return false;" class="btn btn-sm btn-outline" style="cursor: pointer;">Voir tout</a></div><div class="alert alert-info mb-0"><div class="alert-content"><p class="mb-2"><strong>${amesARelancer.length}</strong> nouvelle(s) âme(s) sans contact depuis plus de 7 jours :</p><ul class="mb-0" style="list-style: none; padding-left: 0;">${amesARelancer.map(na => { const lastContact = na.date_dernier_contact?.toDate ? na.date_dernier_contact.toDate() : new Date(na.date_dernier_contact || na.created_at); const daysAgo = Math.floor((new Date() - lastContact) / (1000 * 60 * 60 * 24)); return `<li style="padding: var(--spacing-xs) 0; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center;"><span><strong>${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}</strong> — dernier contact il y a ${daysAgo} jour${daysAgo > 1 ? 's' : ''}</span><a href="#" onclick="App.navigate('nouvelle-ame-detail', {id: '${na.id}'}); return false;" class="btn btn-sm btn-primary" style="padding: 4px 8px;"><i class="fas fa-phone"></i> Relancer</a></li>`; }).join('')}</ul></div></div></div>` : ''}
      ${Permissions.hasRole('superviseur') ? App.renderObjectifsKPI(statsNouvellesAmes, statsEvangelisation, stats) : ''}
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
      ${Permissions.hasRole('mentor') && mesDisciples.length > 0 ? `<div class="dashboard-section"><div class="section-header"><h3 class="section-title"><i class="fas fa-user-friends"></i> Mes disciples</h3><a href="#" onclick="App.navigate('mes-disciples'); return false;" class="btn btn-sm btn-outline">Voir tout</a></div><div class="card"><div class="card-body" style="padding: 0;">${mesDisciples.slice(0, 5).map(d => { const avatarStyle = d.photo_url ? `background-image: url('${Utils.escapeHtml(d.photo_url)}'); background-size: cover; background-position: center;` : `background: ${d.sexe === 'F' ? '#E91E63' : 'var(--primary)'}`; return `<div class="member-card"><div class="member-avatar" style="${avatarStyle}">${!d.photo_url ? Utils.getInitials(d.prenom, d.nom) : ''}</div><div class="member-info"><div class="member-name">${Utils.escapeHtml(d.prenom)} ${Utils.escapeHtml(d.nom)}</div><div class="member-email">${Utils.escapeHtml(d.email)}</div></div><span class="badge badge-${d.role}">${Utils.getRoleLabel(d.role)}</span></div>`; }).join('')}</div></div></div>` : ''}
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
    const familyBranding = Utils.getFamilyBranding(famille);
    const sidebarHeaderHtml = familyBranding
      ? `<div class="sidebar-family-branding">
           <img src="${Utils.escapeHtml(familyBranding.logoUrl)}" alt="" class="sidebar-family-logo" onerror="this.style.display='none'">
           <div class="sidebar-family-slogan-title">${Utils.escapeHtml(familyBranding.sloganTitle)}</div>
           <div class="sidebar-family-slogan-subtitle">${Utils.escapeHtml(familyBranding.sloganSubtitle)}</div>
         </div>`
      : `<div class="sidebar-header"><div class="sidebar-logo">✝️</div><div><div class="sidebar-title">Familles de Disciples</div><div class="sidebar-subtitle">${Utils.escapeHtml(famille?.nom_affichage || famille?.nom || '')}</div></div></div>`;
    return `
      <div class="app-container">
        <a href="#main-content" class="skip-link">Aller au contenu principal</a>
        <aside class="sidebar" id="app-sidebar" aria-label="Menu latéral">
          ${sidebarHeaderHtml}
          <nav class="sidebar-nav" role="navigation" aria-label="Menu principal">
            ${App.getRaccourcisNav()}
            <div class="nav-section"><div class="nav-section-title">Principal</div>
              <div class="nav-item ${AppState.currentPage === 'dashboard' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('dashboard')" onkeydown="App.navItemKeydown(event, 'dashboard')"><i class="fas fa-home"></i><span>Tableau de bord</span></div>
              <div class="nav-item ${AppState.currentPage === 'profil' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('profil')" onkeydown="App.navItemKeydown(event, 'profil')"><i class="fas fa-user"></i><span>Mon profil</span></div>
              <div class="nav-item ${AppState.currentPage === 'mon-compte' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('mon-compte')" onkeydown="App.navItemKeydown(event, 'mon-compte')"><i class="fas fa-user-cog"></i><span>Mon compte</span></div>
              <div class="nav-item ${AppState.currentPage === 'calendrier' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('calendrier')" onkeydown="App.navItemKeydown(event, 'calendrier')"><i class="fas fa-calendar-alt"></i><span>Calendrier</span></div>
              <div class="nav-item ${AppState.currentPage === 'annuaire' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('annuaire')" onkeydown="App.navItemKeydown(event, 'annuaire')"><i class="fas fa-address-book"></i><span>Annuaire</span></div>
            </div>
            <div class="nav-section"><div class="nav-section-title">Communauté</div>
              <div class="nav-item ${AppState.currentPage === 'notifications' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('notifications')" onkeydown="App.navItemKeydown(event, 'notifications')"><i class="fas fa-bell"></i><span>Notifications</span></div>
              <div class="nav-item ${AppState.currentPage === 'sujets-priere' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('sujets-priere')" onkeydown="App.navItemKeydown(event, 'sujets-priere')"><i class="fas fa-praying-hands"></i><span>Prière</span></div>
              <div class="nav-item ${AppState.currentPage === 'temoignages' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('temoignages')" onkeydown="App.navItemKeydown(event, 'temoignages')"><i class="fas fa-star"></i><span>Témoignages</span></div>
              <div class="nav-item ${AppState.currentPage === 'documents' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('documents')" onkeydown="App.navItemKeydown(event, 'documents')"><i class="fas fa-folder"></i><span>Documents</span></div>
            </div>
            ${Permissions.hasRole('mentor') ? `<div class="nav-section"><div class="nav-section-title">Gestion</div>
              <div class="nav-item ${AppState.currentPage === 'mes-disciples' ? 'active' : ''}" onclick="App.navigate('mes-disciples')"><i class="fas fa-user-friends"></i><span>Mes disciples</span></div>
              <div class="nav-item ${AppState.currentPage === 'programmes' ? 'active' : ''}" onclick="App.navigate('programmes')"><i class="fas fa-clipboard-list"></i><span>Programmes</span></div>
              <div class="nav-item ${AppState.currentPage === 'statistiques' ? 'active' : ''}" onclick="App.navigate('statistiques')"><i class="fas fa-chart-bar"></i><span>Statistiques</span></div>
              <div class="nav-item ${AppState.currentPage === 'nouvelles-ames' || AppState.currentPage === 'nouvelles-ames-add' || AppState.currentPage === 'nouvelle-ame-detail' || AppState.currentPage === 'nouvelle-ame-suivi' ? 'active' : ''}" onclick="App.navigate('nouvelles-ames')"><i class="fas fa-seedling"></i><span>Nouvelles âmes</span></div>
              <div class="nav-item ${AppState.currentPage === 'evangelisation' || AppState.currentPage === 'evangelisation-add' || AppState.currentPage === 'evangelisation-detail' || AppState.currentPage === 'evangelisation-planning' || AppState.currentPage === 'evangelisation-stats' || AppState.currentPage === 'secteurs' ? 'active' : ''}" onclick="App.navigate('evangelisation')"><i class="fas fa-bullhorn"></i><span>Évangélisation</span></div>
            </div>` : ''}
            ${(Permissions.canViewAllMembers() || Permissions.canViewMembersListReadOnly()) ? `<div class="nav-section"><div class="nav-section-title">Administration</div>
              <div class="nav-item ${AppState.currentPage === 'membres' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('membres')" onkeydown="App.navItemKeydown(event, 'membres')"><i class="fas fa-users"></i><span>Tous les membres</span></div>
              ${Permissions.canViewArchivesMembres() ? `<div class="nav-item ${AppState.currentPage === 'archives-membres' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('archives-membres')" onkeydown="App.navItemKeydown(event, 'archives-membres')"><i class="fas fa-archive"></i><span>Archivage des membres</span></div>` : ''}
              ${Permissions.isAdmin() ? `<div class="nav-item ${AppState.currentPage === 'admin-familles' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('admin-familles')" onkeydown="App.navItemKeydown(event, 'admin-familles')"><i class="fas fa-church"></i><span>Familles</span></div>
              <div class="nav-item ${AppState.currentPage === 'logs' ? 'active' : ''}" tabindex="0" role="link" onclick="App.navigate('logs')" onkeydown="App.navItemKeydown(event, 'logs')"><i class="fas fa-history"></i><span>Journal d'activité</span></div>` : ''}
            </div>` : ''}
          </nav>
          <div class="sidebar-user">
            <div class="user-avatar" style="${user.photo_url ? `background-image: url('${Utils.escapeHtml(user.photo_url)}'); background-size: cover; background-position: center;` : ''}">${!user.photo_url ? Utils.getInitials(user.prenom, user.nom) : ''}</div>
            <div class="user-info"><div class="user-name">${Utils.escapeHtml(user.prenom)} ${Utils.escapeHtml(user.nom)}</div><div class="user-role">${Utils.getRoleLabel(user.role)}</div></div>
            <button class="btn-logout" onclick="Auth.logout()" title="Se déconnecter"><i class="fas fa-sign-out-alt"></i></button>
          </div>
        </aside>
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="App.toggleSidebar()" aria-hidden="true"></div>
        <main class="main-content">
          <header class="main-header">
            <div class="header-left">
              <button type="button" class="btn-back" onclick="App.goBack()" title="Retour à ${Utils.escapeHtml(App.getPreviousPageLabel())}" aria-label="Retour à la page précédente">
                <i class="fas fa-arrow-left"></i>
                <span class="btn-back-text">Retour</span>
              </button>
              <button type="button" class="mobile-menu-toggle" onclick="App.toggleSidebar()" aria-label="Ouvrir le menu">
                <i class="fas fa-bars"></i>
              </button>
              <h1 class="page-title">${pageTitle}</h1>
            </div>
            <div class="header-right">
              <div class="global-search header-search" style="position: relative;">
                <input type="text" class="form-control" id="global-search-input" placeholder="Rechercher membre, nouvelle âme..." 
                       style="width: 220px; padding-left: 36px;" 
                       oninput="App.globalSearchDebounce()" onfocus="App.globalSearchShow()" onblur="setTimeout(() => App.globalSearchHide(), 150)">
                <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;"></i>
                <div id="global-search-results" class="global-search-dropdown" style="display: none;"></div>
              </div>
              <button type="button" class="btn btn-icon btn-outline" onclick="App.toggleTheme()" title="Changer le thème (clair/sombre)" style="padding: 8px;">
                <i class="fas fa-moon" id="theme-icon-light"></i>
                <i class="fas fa-sun" id="theme-icon-dark" style="display: none;"></i>
              </button>
              <div class="header-family-badge"><i class="fas fa-church"></i><span>${Utils.escapeHtml(famille?.nom_affichage || famille?.nom || '')}</span></div>
            </div>
          </header>
          <div class="page-content">${content}</div>
        </main>
      </div>
    `;
  },

  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    const iconLight = document.getElementById('theme-icon-light');
    const iconDark = document.getElementById('theme-icon-dark');
    if (iconLight) iconLight.style.display = isDark ? 'none' : 'inline';
    if (iconDark) iconDark.style.display = isDark ? 'inline' : 'none';
  },
  toggleRaccourci(pageId, add) {
    const favs = JSON.parse(localStorage.getItem('crm_raccourcis') || '[]');
    if (add) { if (!favs.includes(pageId)) favs.push(pageId); }
    else { const idx = favs.indexOf(pageId); if (idx >= 0) favs.splice(idx, 1); }
    localStorage.setItem('crm_raccourcis', JSON.stringify(favs));
    Toast.success('Raccourcis mis à jour');
    this.render();
  },

  setThemePreference(theme) {
    localStorage.setItem('crm_theme', theme);
    this.applyTheme(theme);
    Toast.success('Préférence enregistrée');
  },
  toggleTheme() {
    const current = localStorage.getItem('crm_theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('crm_theme', next);
    this.applyTheme(next);
    const iconLight = document.getElementById('theme-icon-light');
    const iconDark = document.getElementById('theme-icon-dark');
    if (iconLight) iconLight.style.display = next === 'dark' ? 'none' : 'inline';
    if (iconDark) iconDark.style.display = next === 'dark' ? 'inline' : 'none';
  },

  globalSearchDebounceId: null,
  globalSearchDebounce() {
    clearTimeout(this.globalSearchDebounceId);
    this.globalSearchDebounceId = setTimeout(() => this.globalSearch(), 200);
  },
  globalSearchShow() {
    const q = document.getElementById('global-search-input')?.value?.trim();
    if (q && q.length >= 2) this.globalSearch();
  },
  globalSearchHide() {
    const dd = document.getElementById('global-search-results');
    if (dd) dd.style.display = 'none';
  },
  globalSearch() {
    const q = (document.getElementById('global-search-input')?.value || '').trim().toLowerCase();
    const dd = document.getElementById('global-search-results');
    if (!dd) return;
    if (q.length < 2) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
    const results = [];
    const membres = AppState.membres?.filter(m => m.statut_compte === 'actif') || [];
    membres.forEach(m => {
      const name = `${(m.prenom || '')} ${(m.nom || '')}`.toLowerCase();
      if (name.includes(q)) results.push({ type: 'membre', id: m.id, label: `${m.prenom} ${m.nom}`, sub: 'Membre', icon: 'fa-user' });
    });
    let naCache = [];
    if (typeof NouvellesAmesData !== 'undefined') naCache = NouvellesAmesData.cache || [];
    naCache.filter(na => na.statut !== 'integre').forEach(na => {
      const name = `${(na.prenom || '')} ${(na.nom || '')}`.toLowerCase();
      if (name.includes(q)) results.push({ type: 'nouvelle_ame', id: na.id, label: `${na.prenom} ${na.nom}`, sub: 'Nouvelle âme', icon: 'fa-seedling' });
    });
    if (typeof SujetsPriere !== 'undefined' && SujetsPriere.items) {
      SujetsPriere.items.slice(0, 50).forEach(s => {
        const text = ((s.contenu || '') + (s.auteur_prenom || '')).toLowerCase();
        if (text.includes(q)) results.push({ type: 'priere', id: s.id, label: (s.contenu || '').substring(0, 40) + (s.contenu?.length > 40 ? '...' : ''), sub: 'Sujet de prière', icon: 'fa-praying-hands' });
      });
    }
    const html = results.slice(0, 8).map(r => {
      const action = r.type === 'membre' ? `App.viewMembre('${r.id}')` :
        r.type === 'nouvelle_ame' ? `App.navigate('nouvelle-ame-detail', {id:'${r.id}'})` :
        `App.navigate('sujets-priere')`;
      return `<div class="global-search-item" onclick="${action}; App.globalSearchHide(); document.getElementById('global-search-input').value='';" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-color);">
        <i class="fas ${r.icon}" style="color:var(--primary)"></i>
        <div><div style="font-weight:600">${Utils.escapeHtml(r.label)}</div><div style="font-size:0.8rem;color:var(--text-muted)">${r.sub}</div></div>
      </div>`;
    }).join('');
    dd.innerHTML = html ? html : '<div style="padding:12px;color:var(--text-muted)">Aucun résultat</div>';
    dd.style.display = 'block';
    dd.style.position = 'absolute'; dd.style.top = '100%'; dd.style.left = '0'; dd.style.right = '0';
    dd.style.background = 'var(--bg-secondary)'; dd.style.border = '1px solid var(--border-color)'; dd.style.borderRadius = 'var(--radius-sm)';
    dd.style.boxShadow = 'var(--shadow-lg)'; dd.style.zIndex = '1000'; dd.style.maxHeight = '300px'; dd.style.overflowY = 'auto';
  },

  filterMembres() { const search = document.getElementById('search-membres')?.value.toLowerCase() || ''; const roleFilter = document.getElementById('filter-role')?.value || ''; const mentorFilter = document.getElementById('filter-mentor')?.value || ''; document.querySelectorAll('#membres-list .member-card').forEach(card => { const name = card.dataset.name || ''; const role = card.dataset.role || ''; const mentorId = card.dataset.mentorId || ''; const matchMentor = !mentorFilter || (mentorFilter === 'none' ? mentorId === '' : mentorId === mentorFilter); card.style.display = name.includes(search) && (!roleFilter || role === roleFilter) && matchMentor ? '' : 'none'; }); },
  filterAnnuaire() {
    const search = document.getElementById('search-annuaire')?.value.toLowerCase() || '';
    const moisValue = document.getElementById('filter-annuaire-mois')?.value || '';
    const poleValue = document.getElementById('filter-annuaire-pole')?.value || '';
    document.querySelectorAll('#annuaire-list .member-card').forEach(card => {
      const name = card.dataset.name || '';
      const birthMonth = card.dataset.birthMonth || '';
      const poles = (card.dataset.poles || '').split(',').map(p => p.trim()).filter(Boolean);
      const matchSearch = name.includes(search);
      const matchMois = !moisValue || birthMonth === moisValue;
      const matchPole = !poleValue ? true : (poleValue === 'aucun' ? (poles.length === 0 || (poles.length === 1 && poles[0] === 'aucun')) : poles.includes(poleValue));
      card.style.display = matchSearch && matchMois && matchPole ? '' : 'none';
    });
  },

  togglePoleInterne(checkbox) {
    const isAucun = checkbox.dataset.poleAucun === 'true';
    const group = document.querySelectorAll('.pole-check input[type="checkbox"]');
    if (isAucun && checkbox.checked) {
      group.forEach(cb => { if (cb !== checkbox) cb.checked = false; });
    } else if (checkbox.checked && !isAucun) {
      document.querySelectorAll('.pole-check input[value="aucun"]').forEach(cb => { cb.checked = false; });
      const checkedPoles = Array.from(group).filter(cb => cb.checked && cb.value !== 'aucun');
      if (checkedPoles.length > 2) {
        const first = checkedPoles.find(cb => cb !== checkbox);
        if (first) first.checked = false;
      }
    }
    const checkedCount = Array.from(group).filter(cb => cb.checked && cb.value !== 'aucun').length;
    const hint = document.getElementById('pole-interne-hint');
    if (hint) hint.textContent = checkedCount > 0 ? `${checkedCount}/2 pôle(s) sélectionné(s)` : (document.querySelector('.pole-check input[value="aucun"]:checked') ? 'Aucun pôle' : '');
  },
  filterProgrammes() { const search = document.getElementById('search-programmes')?.value.toLowerCase() || ''; const typeFilter = document.getElementById('filter-type')?.value || ''; document.querySelectorAll('#programmes-list .programme-card').forEach(card => { const name = card.dataset.name || ''; const type = card.dataset.type || ''; card.style.display = name.includes(search) && (!typeFilter || type === typeFilter) ? '' : 'none'; }); },

  exportMembresCSV() {
    const isMesDisciples = AppState.currentPage === 'mes-disciples';
    const canExport = Permissions.canViewAllMembers() || (isMesDisciples && Permissions.hasRole('mentor'));
    
    if (!canExport) {
      Toast.error('Vous n\'avez pas la permission d\'exporter la liste des membres.');
      return;
    }
    
    let membres;
    if (isMesDisciples || !Permissions.canViewAllMembers()) {
      // Mentor ou page "Mes disciples" : exporter uniquement ses disciples
      membres = AppState.membres.filter(m => m.statut_compte === 'actif' && m.mentor_id === AppState.user.id);
    } else {
      // Admin/Superviseur sur page membres : exporter tous les membres
      membres = AppState.membres.filter(m => m.statut_compte === 'actif');
    }
    if (membres.length === 0) {
      Toast.warning('Aucun membre à exporter.');
      return;
    }
    const sep = ';'; // séparateur pour Excel FR
    const escapeCsv = (val) => {
      if (val == null || val === '') return '';
      const s = String(val).replace(/"/g, '""');
      return /[;\r\n"]/.test(s) ? `"${s}"` : s;
    };
    const formatDate = (date) => {
      if (!date) return '';
      const d = date.toDate ? date.toDate() : new Date(date);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Rôle', 'Mentor', 'Date arrivée ICC', 'Date de naissance', 'Sexe', 'Ville', 'Code postal', 'Profession', 'Statut pro', 'Ministère', 'Baptisé immersion', 'Formations'];
    const rows = membres.map(m => {
      const mentor = m.mentor_id ? Membres.getById(m.mentor_id) : null;
      const mentorName = mentor ? `${mentor.prenom} ${mentor.nom}` : '';
      return [
        escapeCsv(m.prenom),
        escapeCsv(m.nom),
        escapeCsv(m.email),
        escapeCsv(m.telephone),
        escapeCsv(Utils.getRoleLabel(m.role)),
        escapeCsv(mentorName),
        escapeCsv(formatDate(m.date_arrivee_icc)),
        escapeCsv(formatDate(m.date_naissance)),
        escapeCsv(m.sexe === 'M' ? 'Homme' : m.sexe === 'F' ? 'Femme' : ''),
        escapeCsv(m.adresse_ville),
        escapeCsv(m.adresse_code_postal),
        escapeCsv(m.profession),
        escapeCsv(m.statut_professionnel ? Utils.capitalize(m.statut_professionnel.replace('_', ' ')) : ''),
        escapeCsv(m.ministere_service),
        escapeCsv(m.baptise_immersion === true ? 'Oui' : m.baptise_immersion === false ? 'Non' : ''),
        escapeCsv(Array.isArray(m.formations) ? m.formations.join(', ') : '')
      ].join(sep);
    });
    const csv = '\uFEFF' + headers.join(sep) + '\r\n' + rows.join('\r\n'); // BOM UTF-8 pour Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const fileName = isMesDisciples ? 'mes_disciples' : 'membres';
    a.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success(`Export de ${membres.length} membre(s) réussi.`);
  },

  async exportGlobal() {
    if (!Permissions.hasRole('superviseur')) { Toast.error('Réservé aux superviseurs'); return; }
    try {
      let naCache = [];
      if (typeof NouvellesAmes !== 'undefined') {
        await NouvellesAmes.loadAll();
        naCache = NouvellesAmesData?.cache || [];
      }
      let sujetsPriere = [];
      if (typeof SujetsPriere !== 'undefined') {
        await SujetsPriere.loadAll();
        sujetsPriere = SujetsPriere.items || [];
      }
      const toPlain = (o) => {
        if (!o) return o;
        if (o && o.toDate) return o.toDate().toISOString();
        if (Array.isArray(o)) return o.map(toPlain);
        if (typeof o === 'object') {
          const r = {};
          for (const k in o) r[k] = toPlain(o[k]);
          return r;
        }
        return o;
      };
      const data = {
        export_date: new Date().toISOString(),
        famille: AppState.famille?.nom,
        membres: (AppState.membres || []).map(toPlain),
        programmes: (AppState.programmes || []).map(toPlain),
        nouvelles_ames: naCache.map(toPlain),
        sujets_priere: sujetsPriere.map(toPlain)
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `crm_backup_${AppState.famille?.nom || 'famille'}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      Toast.success('Export terminé');
    } catch (e) {
      console.error('Export global:', e);
      Toast.error('Erreur lors de l\'export');
    }
  },

  exportMembresPDF() {
    const isMesDisciples = AppState.currentPage === 'mes-disciples';
    const canExport = Permissions.canViewAllMembers() || (isMesDisciples && Permissions.hasRole('mentor'));
    
    if (!canExport) {
      Toast.error('Vous n\'avez pas la permission d\'exporter la liste des membres.');
      return;
    }
    
    let membres;
    if (isMesDisciples || !Permissions.canViewAllMembers()) {
      // Mentor ou page "Mes disciples" : exporter uniquement ses disciples
      membres = AppState.membres.filter(m => m.statut_compte === 'actif' && m.mentor_id === AppState.user.id);
    } else {
      // Admin/Superviseur sur page membres : exporter tous les membres
      membres = AppState.membres.filter(m => m.statut_compte === 'actif');
    }
    if (membres.length === 0) {
      Toast.warning('Aucun membre à exporter.');
      return;
    }
    try {
      App.showLoading();
      const pdfOptions = { 
        famille: AppState.famille?.nom || '',
        title: isMesDisciples ? 'Mes disciples' : 'Liste des membres'
      };
      await PDFExport.generateMembersReport(membres, pdfOptions);
      Toast.success('Téléchargement du PDF en cours.');
    } catch (e) {
      console.error('Erreur export PDF membres:', e);
      Toast.error(e.message || 'Erreur lors de la génération du PDF.');
    } finally {
      App.hideLoading();
    }
  },

  viewMembre(id) {
    document.querySelector('.page-content').innerHTML = Pages.renderProfil(id);
    if (typeof NotesSuivi !== 'undefined' && NotesSuivi.canAddNote()) {
      setTimeout(() => NotesSuivi.loadAndRender('membre', id), 50);
    }
  },

  async blockMembre(id) {
    const m = Membres.getById(id);
    if (!m || !Permissions.canBlockMember(m)) {
      Toast.error('Vous ne pouvez pas bloquer ce membre.');
      return;
    }
    const nom = `${m.prenom || ''} ${m.nom || ''}`.trim() || 'Ce membre';
    const commentaire = prompt(`Bloquer et archiver "${nom}" ?\n\nIndiquez un commentaire (optionnel) pour l\'archivage :`);
    if (commentaire === null) return;
    try {
      const ok = await Membres.block(id, commentaire);
      if (ok) this.navigate(AppState.currentPage);
    } catch (e) {}
  },

  async unblockMembre(id) {
    const m = Membres.getById(id);
    if (!m || !Permissions.canBlockMember(m)) {
      Toast.error('Vous ne pouvez pas débloquer ce membre.');
      return;
    }
    if (!confirm(`Débloquer ${(m.prenom || '')} ${(m.nom || '')} ? Le membre pourra à nouveau se connecter.`)) return;
    try {
      const ok = await Membres.unblock(id);
      if (ok) this.navigate('archives-membres');
    } catch (e) {}
  },

  async reassignMentor(membreId, newMentorId) {
    if (!newMentorId) return;
    const membre = Membres.getById(membreId);
    if (!membre || !Permissions.canReassignMentor(membre)) {
      Toast.error('Vous ne pouvez pas réaffecter ce membre.');
      return;
    }
    const mentorId = newMentorId === 'none' ? null : newMentorId;
    if (membre.mentor_id === mentorId || (membre.mentor_id == null && mentorId == null)) return;
    try {
      const ok = await Membres.update(membreId, { mentor_id: mentorId });
      if (ok) {
        Toast.success('Mentor mis à jour.');
        this.navigate(AppState.currentPage);
      }
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la réaffectation.');
    }
  },

  editMembre(id) { document.querySelector('.page-content').innerHTML = Pages.renderProfilEdit(id); },
  viewProgramme(id) { this.navigate('programme-detail', { programmeId: id }); },
  editProgramme(id) { this.navigate('programmes-edit', { programmeId: id }); },
  viewHistoriqueMembre(id) { this.navigate('historique-membre', { membreId: id }); },

  toggleMentorField() {
    const r = document.getElementById('membre-role');
    const m = document.getElementById('mentor-group');
    if (r && m) {
      // Cacher le mentor pour 'nouveau' et les rôles mentor/adjoint/superviseur (qui n'ont pas besoin de mentor)
      const rolesWithoutMentor = ['nouveau', 'mentor', 'adjoint_superviseur', 'superviseur'];
      m.style.display = rolesWithoutMentor.includes(r.value) ? 'none' : 'block';
    }
  },

  toggleMentorFieldEdit() {
    const r = document.getElementById('edit-role');
    const m = document.getElementById('edit-mentor-group');
    if (r && m) {
      const rolesWithoutMentor = ['nouveau', 'mentor', 'adjoint_superviseur', 'superviseur', 'admin'];
      m.style.display = rolesWithoutMentor.includes(r.value) ? 'none' : 'block';
    }
  },

  async submitAddMembre(event) {
    event.preventDefault();
    const role = document.getElementById('membre-role').value;
    const rolesWithoutMentor = ['nouveau', 'mentor', 'adjoint_superviseur', 'superviseur'];
    const d = {
      prenom: document.getElementById('membre-prenom').value.trim(),
      nom: document.getElementById('membre-nom').value.trim(),
      email: document.getElementById('membre-email').value.trim(),
      role: role,
      mentor_id: rolesWithoutMentor.includes(role) ? null : document.getElementById('membre-mentor').value
    };
    try {
      const result = await Auth.createMembre(d);
      // Afficher le mot de passe temporaire dans une modale
      if (result && result.tempPassword) {
        this.showTempPasswordModal(d.prenom, d.email, result.tempPassword, result.adminDisconnected);
      } else {
        this.navigate('membres');
      }
    } catch (e) {}
  },

  showTempPasswordModal(prenom, email, tempPassword, adminDisconnected = false) {
    const modalId = 'temp-password-modal';
    const closeAction = adminDisconnected ? 'App.showLoginPage()' : "App.navigate('membres')";
    const reconnectWarning = adminDisconnected ? `
            <div class="alert alert-warning" style="margin-top: 12px;">
              <i class="fas fa-sign-in-alt"></i>
              <div>
                <strong>Reconnexion requise :</strong> Pour des raisons techniques, vous allez être redirigé vers la page de connexion. Reconnectez-vous pour continuer.
              </div>
            </div>` : '';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-key"></i> Membre créé avec succès</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove(); ${closeAction};">&times;</button>
          </div>
          <div class="modal-body">
            <p><strong>${Utils.escapeHtml(prenom)}</strong> a été ajouté.</p>
            <div class="alert alert-info" style="margin-top: 16px;">
              <i class="fas fa-info-circle"></i>
              <div>
                <strong>Mot de passe temporaire :</strong>
                <div style="margin-top: 8px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 1.1em; user-select: all;">
                  ${Utils.escapeHtml(tempPassword)}
                </div>
                <p style="margin-top: 12px; font-size: 0.9em; color: #666;">
                  Communiquez ce mot de passe à <strong>${Utils.escapeHtml(email)}</strong> pour qu'il/elle puisse se connecter.<br>
                  Il/Elle pourra le modifier dans « Mon compte ».
                </p>
              </div>
            </div>
            <div class="alert alert-success" style="margin-top: 12px;">
              <i class="fas fa-envelope"></i>
              <div>
                <strong>Alternative :</strong> Un email de réinitialisation a été envoyé à ${Utils.escapeHtml(email)}. Le membre pourra aussi cliquer sur le lien pour définir son propre mot de passe.
              </div>
            </div>
            ${reconnectWarning}
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="document.getElementById('${modalId}').remove(); ${closeAction};">OK, compris</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitChangePassword(event) {
    event.preventDefault();
    try {
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      // Validation
      if (newPassword.length < 6) {
        Toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères');
        return;
      }

      if (newPassword !== confirmPassword) {
        Toast.error('Les mots de passe ne correspondent pas');
        return;
      }

      if (currentPassword === newPassword) {
        Toast.error('Le nouveau mot de passe doit être différent de l\'ancien');
        return;
      }

      App.showLoading();
      await Auth.changePassword(currentPassword, newPassword);
      
      // Réinitialiser le formulaire
      document.getElementById('form-change-password').reset();
      
      // Retourner au profil après succès
      setTimeout(() => {
        this.navigate('profil');
      }, 1500);
    } catch (error) {
      ErrorHandler.handle(error, 'Changement de mot de passe');
    } finally {
      App.hideLoading();
    }
  },

  async handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      App.showLoading();
      const photoUrl = await Auth.uploadPhotoProfil(file);
      
      // Mettre à jour l'affichage de l'avatar dans la page
      const avatarPreview = document.getElementById('avatar-profil-preview');
      if (avatarPreview) {
        avatarPreview.style.backgroundImage = `url('${photoUrl}')`;
        avatarPreview.style.backgroundSize = 'cover';
        avatarPreview.style.backgroundPosition = 'center';
        avatarPreview.innerHTML = '';
      }

      // Mettre à jour le bouton
      const uploadBtn = document.querySelector('button[onclick*="photo-profil-input"]');
      if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Changer la photo';
      }

      // Ajouter le bouton supprimer s'il n'existe pas
      if (!document.querySelector('button[onclick="App.deletePhotoProfil()"]')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-outline';
        deleteBtn.style.marginLeft = 'var(--spacing-sm)';
        deleteBtn.onclick = () => App.deletePhotoProfil();
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Supprimer';
        uploadBtn.parentNode.appendChild(deleteBtn);
      }

      // Recharger les données utilisateur pour mettre à jour AppState
      const userDoc = await db.collection('utilisateurs').doc(auth.currentUser.uid).get();
      if (userDoc.exists) {
        AppState.user = { id: userDoc.id, ...userDoc.data() };
      }
      
      // Rafraîchir la sidebar si nécessaire
      this.render();
    } catch (error) {
      ErrorHandler.handle(error, 'Upload photo de profil');
    } finally {
      App.hideLoading();
      // Réinitialiser l'input pour permettre de sélectionner le même fichier à nouveau
      event.target.value = '';
    }
  },

  async deletePhotoProfil() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer votre photo de profil ?')) {
      return;
    }

    try {
      App.showLoading();
      await Auth.deletePhotoProfil();
      
      // Mettre à jour l'affichage
      const avatarElement = document.getElementById('avatar-profil-preview');
      if (avatarElement && AppState.user) {
        avatarElement.style.backgroundImage = '';
        avatarElement.style.backgroundSize = '';
        avatarElement.style.backgroundPosition = '';
        avatarElement.style.background = AppState.user.sexe === 'F' ? '#E91E63' : 'var(--primary)';
        avatarElement.innerHTML = Utils.getInitials(AppState.user.prenom, AppState.user.nom);
      }

      // Mettre à jour le bouton
      const uploadBtn = document.querySelector('button[onclick*="photo-profil-input"]');
      if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Ajouter une photo';
      }

      // Supprimer le bouton supprimer
      const deleteBtn = document.querySelector('button[onclick="App.deletePhotoProfil()"]');
      if (deleteBtn) {
        deleteBtn.remove();
      }

      // Recharger les données utilisateur et la liste des membres
      const userDoc = await db.collection('utilisateurs').doc(auth.currentUser.uid).get();
      if (userDoc.exists) {
        AppState.user = { id: userDoc.id, ...userDoc.data() };
      }
      await Membres.loadAll(); // pour que la liste Membres et l'annuaire affichent les initiales

      // Rafraîchir l'affichage
      this.render();
    } catch (error) {
      ErrorHandler.handle(error, 'Suppression photo de profil');
    } finally {
      App.hideLoading();
    }
  },

  async submitEditProfil(event, membreId) {
    event.preventDefault();
    const rgpdAccept = document.getElementById('edit-rgpd-accept');
    if (!rgpdAccept?.checked) {
      Toast.warning('Veuillez accepter les informations RGPD (case obligatoire).');
      return;
    }
    const formations = [];
    document.querySelectorAll('[id^="formation-"]:checked').forEach(cb => formations.push(cb.value));
    const poleCheckboxes = document.querySelectorAll('.pole-check input[type="checkbox"]:checked');
    let pole_interne = [];
    const hasAucun = Array.from(poleCheckboxes).some(cb => cb.value === 'aucun');
    if (hasAucun) pole_interne = [];
    else pole_interne = Array.from(poleCheckboxes).map(cb => cb.value).filter(v => v !== 'aucun').slice(0, 2);
    if (poleCheckboxes.length === 0) {
      Toast.warning('Le pôle interne d\'appartenance est obligatoire. Choisissez « Aucun » ou jusqu\'à 2 pôles.');
      return;
    }
    const data = {
      prenom: document.getElementById('edit-prenom').value.trim(),
      nom: document.getElementById('edit-nom').value.trim(),
      sexe: document.getElementById('edit-sexe').value || null,
      date_naissance: document.getElementById('edit-date-naissance').value ? new Date(document.getElementById('edit-date-naissance').value) : null,
      indicatif_telephone: document.getElementById('edit-indicatif-telephone')?.value?.trim() || null,
      telephone: document.getElementById('edit-telephone').value.trim() || null,
      adresse_ville: document.getElementById('edit-ville').value.trim() || null,
      adresse_code_postal: document.getElementById('edit-cp').value.trim() || null,
      date_arrivee_icc: document.getElementById('edit-date-icc').value ? new Date(document.getElementById('edit-date-icc').value) : null,
      formations,
      ministere_service: document.getElementById('edit-ministere').value.trim() || null,
      baptise_immersion: document.getElementById('edit-baptise').value === 'true' ? true : document.getElementById('edit-baptise').value === 'false' ? false : null,
      date_bapteme: document.getElementById('edit-date-bapteme')?.value ? new Date(document.getElementById('edit-date-bapteme').value) : null,
      pole_interne,
      profession: document.getElementById('edit-profession').value.trim() || null,
      statut_professionnel: document.getElementById('edit-statut-pro').value || null,
      passions_centres_interet: document.getElementById('edit-passions').value.trim() || null
    };
    const editRoleEl = document.getElementById('edit-role');
    const editMentorEl = document.getElementById('edit-mentor');
    if (editRoleEl) {
      const rolesWithoutMentor = ['nouveau', 'mentor', 'adjoint_superviseur', 'superviseur', 'admin'];
      data.role = editRoleEl.value;
      data.mentor_id = (rolesWithoutMentor.includes(editRoleEl.value) || !editMentorEl?.value) ? null : editMentorEl.value;
    }
    if (await Membres.update(membreId, data)) this.navigate('profil');
  },

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
  toggleLoginPasswordVisibility(btn) {
    const wrap = btn.closest('.password-input-wrap');
    const input = wrap ? wrap.querySelector('input') : null;
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
    btn.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    btn.setAttribute('title', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  },

  showForgotPassword() { const e = prompt('Entrez votre adresse email :'); if (e && Utils.isValidEmail(e)) Auth.resetPassword(e); else if (e) Toast.error('Email invalide'); }
};

document.addEventListener('DOMContentLoaded', () => App.init());
