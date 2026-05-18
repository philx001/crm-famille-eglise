// ============================================
// PAGES PRÉSENCES
// ============================================

const PagesPresences = {
  currentProgrammeId: null,
  presencesData: [],
  presencesNAData: [],
  /** Filtre liste membres depuis les tuiles du résumé (null = tout afficher). */
  summaryFilterMembres: null,
  /** Filtre liste NA/NC depuis les tuiles du résumé. */
  summaryFilterNA: null,

  /** Onglet actif du pointage : membres | na (pour n'afficher qu'une ligne de tuiles de résumé). */
  activePresenceTab: 'membres',

  // Page de pointage des présences
  async renderPresences(programmeId) {
    this.currentProgrammeId = programmeId;
    this.summaryFilterMembres = null;
    this.summaryFilterNA = null;
    this.activePresenceTab = 'membres';
    const programme = Programmes.getById(programmeId);
    
    if (!programme) {
      return '<div class="alert alert-danger">Programme non trouvé</div>';
    }

    // Disciple/Nouveau : ils ne peuvent pointer que leur propre présence depuis le détail du programme
    if (Permissions.canMarkOwnPresence() && !Permissions.canAccessPresencesPage()) {
      const dateDebut = programme.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);
      return `
        <div class="card" style="max-width: 500px; margin: 0 auto;">
          <div class="card-body text-center">
            <h3><i class="fas fa-clipboard-check"></i> Pointage des présences</h3>
            <p class="text-muted mt-2">Vous ne pouvez pointer que votre propre présence.</p>
            <p class="mb-0">Utilisez la page de détail du programme pour indiquer votre présence.</p>
            <div class="mt-4">
              <a href="#" onclick="App.navigate('programme-detail', { programmeId: '${programmeId}' }); return false;" class="btn btn-primary">
                <i class="fas fa-arrow-right"></i> Voir le programme « ${Utils.escapeHtml(programme.nom)} » et pointer ma présence
              </a>
            </div>
            <div class="mt-3">
              <button type="button" class="btn btn-outline" onclick="App.navigate('programmes')">
                <i class="fas fa-list"></i> Retour à la liste des programmes
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Charger les présences existantes
    const presences = await Presences.loadByProgramme(programmeId);
    
    const dateDebutProg = programme.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);

    // Obtenir les membres à pointer (uniquement ceux qui étaient dans la famille à la date du programme)
    // Mentor : uniquement ses disciples (mentor_id). Rôles supérieurs (adjoint_superviseur+) : tous les membres.
    // Admin/mentor : peut choisir le mode (pointer en tant qu'admin = tous, ou en tant que mentor = mes disciples)
    const isRoleSuperior = Permissions.isRoleSuperiorToMentor && Permissions.isRoleSuperiorToMentor();
    const mesDisciples = Membres.getDisciples(AppState.user.id).filter(m => !m.compte_test);
    const hasDisciples = mesDisciples.length > 0;
    const pointageMode = (typeof sessionStorage !== 'undefined') ? (sessionStorage.getItem('pointage-mode') || 'admin') : 'admin';
    const pointageEnTantQueMentor = isRoleSuperior && hasDisciples && pointageMode === 'mentor';

    let membres = [];
    if (pointageEnTantQueMentor) {
      membres = mesDisciples.filter(m => Utils.membreEtaitDansFamilleALaDate(m, dateDebutProg));
    } else if (isRoleSuperior) {
      membres = (Membres.getMembresPourStatsEtPointage ? Membres.getMembresPourStatsEtPointage() : AppState.membres.filter(m => m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur' && !m.compte_test))
        .filter(m => Utils.membreEtaitDansFamilleALaDate(m, dateDebutProg));
    } else {
      membres = mesDisciples.filter(m => Utils.membreEtaitDansFamilleALaDate(m, dateDebutProg));
    }
    membres = membres.filter(m => m.role !== 'adjoint_superviseur');

    // Préparer les données de présence (membres)
    this.presencesData = membres.map(membre => {
      const existing = presences.find(p => p.disciple_id === membre.id);
      return {
        id: existing?.id || null,
        disciple_id: membre.id,
        membre: membre,
        statut: existing?.statut || 'non_renseigne',
        commentaire: existing?.commentaire || ''
      };
    });

    // NA/NC : Mentor : uniquement ses NA/NC (suivi_par_id). Rôles supérieurs : tous (sauf si mode mentor).
    let nouvellesAmes = [];
    if (typeof Permissions !== 'undefined' && Permissions.canPointNANCPresence && Permissions.canPointNANCPresence()) {
      if (typeof NouvellesAmes !== 'undefined') {
        const allNA = NouvellesAmes.getAll ? NouvellesAmes.getAll() : [];
        nouvellesAmes = allNA.filter(na =>
          na.statut !== 'integre' && na.statut !== 'perdu' &&
          (pointageEnTantQueMentor ? na.suivi_par_id === AppState.user.id : (isRoleSuperior || na.suivi_par_id === AppState.user.id))
        );
      }
    }
    this.presencesNAData = nouvellesAmes.map(na => {
      const existing = presences.find(p => p.nouvelle_ame_id === na.id);
      return {
        id: existing?.id || null,
        nouvelle_ame_id: na.id,
        na: na,
        statut: existing?.statut || 'non_renseigne',
        commentaire: existing?.commentaire || ''
      };
    });

    const showModeSelector = isRoleSuperior && hasDisciples;
    const hasNANCPanel = this.presencesNAData.length > 0;

    const summaryClass = hasNANCPanel ? 'presence-summary presence-summary--panel-membres' : 'presence-summary';
    const summaryAria = 'Filtrer les membres par statut de présence';

    return `
      <div class="presences-header">
        <div>
          <h2>${Utils.escapeHtml(programme.nom)}</h2>
          <p class="text-muted">
            <i class="fas fa-calendar"></i> ${Utils.formatDate(dateDebutProg, 'full')} à 
            ${dateDebutProg.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          ${showModeSelector ? `
          <div class="pointage-mode-selector mt-2">
            <span class="text-muted" style="font-size: 0.9rem; margin-right: 8px;">Pointage en tant que :</span>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn ${pointageMode === 'mentor' ? 'btn-primary' : 'btn-outline'}"
                      onclick="sessionStorage.setItem('pointage-mode','mentor'); App.navigate('presences', {programmeId:'${programmeId}'});">
                <i class="fas fa-user-friends"></i> Mentor (mes disciples)
              </button>
              <button type="button" class="btn ${pointageMode === 'admin' ? 'btn-primary' : 'btn-outline'}"
                      onclick="sessionStorage.setItem('pointage-mode','admin'); App.navigate('presences', {programmeId:'${programmeId}'});">
                <i class="fas fa-users-cog"></i> Superviseur/Admin (tous les membres)
              </button>
            </div>
          </div>
          ` : ''}
        </div>
        <div class="presences-actions">
          <button class="btn btn-outline" onclick="PagesPresences.exportPresencesCSV()" title="Exporter en CSV">
            <i class="fas fa-file-csv"></i> CSV
          </button>
          <button class="btn btn-outline" onclick="PagesPresences.exportPresencesPDF()" title="Exporter en PDF">
            <i class="fas fa-file-pdf"></i> PDF
          </button>
          <button class="btn btn-secondary" onclick="App.navigate('programmes')">
            <i class="fas fa-arrow-left"></i> Retour
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header presences-card-header">
          <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Pointage des présences</h3>
          <div class="${summaryClass}" id="presence-summary" role="toolbar" aria-label="${summaryAria}">
            ${this.renderSummary()}
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          ${hasNANCPanel ? `
          <div class="presence-tabs" role="tablist" aria-label="Basculer Membres ou NA/NC">
            <button type="button" class="presence-tab presence-tab--membres active" role="tab" id="presence-tab-membres" aria-selected="true"
                    onclick="PagesPresences.selectPresenceTab('membres')">
              <i class="fas fa-users"></i> Membres
              <span class="presence-tab-badge presence-tab-badge--membres">${membres.length}</span>
            </button>
            <button type="button" class="presence-tab presence-tab--na" role="tab" id="presence-tab-na" aria-selected="false"
                    onclick="PagesPresences.selectPresenceTab('na')">
              <i class="fas fa-seedling"></i> NA / NC
              <span class="presence-tab-badge presence-tab-badge--na">${this.presencesNAData.length}</span>
            </button>
          </div>
          ` : ''}
          <div id="presence-panel-membres" class="presence-tab-panel" role="${hasNANCPanel ? 'tabpanel' : 'region'}">
            <div class="presence-legend">
              ${Presences.getStatuts().filter(s => s.value !== 'non_renseigne').map(s => `
                <span class="legend-item">
                  <i class="fas ${s.icon}" style="color: ${s.color}"></i> ${s.label}
                </span>
              `).join('')}
              <span class="legend-item" title="Annuler le pointage pour ce membre">
                <i class="fas fa-undo" style="color: #9E9E9E"></i> Annuler
              </span>
            </div>
            ${membres.length > 14 ? `
            <div class="presence-panel-toolbar">
              <div class="search-box presence-panel-toolbar-search">
                <i class="fas fa-search"></i>
                <input type="text" class="form-control" placeholder="Filtrer par nom (membres)…"
                       onkeyup="PagesPresences.filterPresencesSection('membres', this.value)"
                       aria-label="Filtrer la liste des membres">
              </div>
            </div>
            ` : ''}
            <div class="presence-list" id="presence-list">
              ${this.presencesData.map((p, index) => this.renderPresenceRow(p, index)).join('')}
            </div>
          </div>
          ${hasNANCPanel ? `
          <div id="presence-panel-na" class="presence-tab-panel" role="tabpanel" style="display: none;">
            <div class="presence-legend">
              ${(Presences.getStatutsNA ? Presences.getStatutsNA() : Presences.getStatuts()).filter(s => s.value !== 'non_renseigne').map(s => `
                <span class="legend-item" title="${s.title || s.label}">
                  <i class="fas ${s.icon}" style="color: ${s.color}"></i> ${s.label}
                </span>
              `).join('')}
              <span class="legend-item" title="Annuler le pointage pour ce NA/NC">
                <i class="fas fa-undo" style="color: #9E9E9E"></i> Annuler
              </span>
            </div>
            ${this.presencesNAData.length > 8 ? `
            <div class="presence-panel-toolbar">
              <div class="search-box presence-panel-toolbar-search">
                <i class="fas fa-search"></i>
                <input type="text" class="form-control" placeholder="Filtrer par nom ou mentor (NA/NC)…"
                       onkeyup="PagesPresences.filterPresencesSection('na', this.value)"
                       aria-label="Filtrer la liste NA/NC">
              </div>
            </div>
            ` : ''}
            <div class="presence-list" id="presence-list-na">
              ${this.presencesNAData.map((p, index) => this.renderPresenceRowNA(p, index)).join('')}
            </div>
          </div>
          ` : ''}
        </div>
        <div class="card-footer">
          <button class="btn btn-primary btn-lg" onclick="PagesPresences.savePresences()" style="width: 100%;">
            <i class="fas fa-save"></i> Enregistrer les présences
          </button>
        </div>
      </div>

      <style>
        .presences-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-lg);
        }
        .presences-header h2 {
          margin-bottom: var(--spacing-xs);
        }
        .presence-tabs {
          display: flex;
          gap: 0;
          padding: 0 var(--spacing-sm);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
          flex-wrap: nowrap;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .presence-tab {
          flex: 1;
          max-width: 320px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: var(--spacing-md) var(--spacing-lg);
          border: none;
          border-bottom: 3px solid transparent;
          margin-bottom: -1px;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: 1rem;
          font-weight: 700;
          transition:
            color var(--transition-fast),
            border-color var(--transition-fast),
            background var(--transition-fast),
            box-shadow var(--transition-fast);
          white-space: nowrap;
        }
        .presence-tab-panel {
          animation: presence-panel-fade 0.2s ease;
        }
        @keyframes presence-panel-fade {
          from { opacity: 0.75; }
          to { opacity: 1; }
        }
        .presence-panel-toolbar {
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
        }
        .presence-panel-toolbar-search {
          position: relative;
          max-width: 380px;
        }
        .presence-panel-toolbar-search .form-control {
          padding-left: 36px;
        }
        .presence-row--flash {
          animation: presence-row-flash 2.1s ease;
          position: relative;
          z-index: 1;
        }
        body.theme-dark .presence-row--flash {
          animation-name: presence-row-flash-dark;
        }
        @keyframes presence-row-flash {
          0% { box-shadow: 0 0 0 0 rgba(45, 90, 123, 0); background: transparent; }
          15% { box-shadow: 0 0 0 3px rgba(45, 90, 123, 0.35); background: rgba(45, 90, 123, 0.07); }
          100% { box-shadow: 0 0 0 0 rgba(45, 90, 123, 0); background: transparent; }
        }
        @keyframes presence-row-flash-dark {
          0% { box-shadow: 0 0 0 0 transparent; background: transparent; }
          15% { box-shadow: 0 0 0 3px rgba(74, 122, 155, 0.45); background: rgba(74, 122, 155, 0.12); }
          100% { box-shadow: 0 0 0 0 transparent; background: transparent; }
        }
        .presences-actions {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .pointage-mode-selector {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }
        .pointage-mode-selector .btn-group {
          display: inline-flex;
          gap: 0;
        }
        .pointage-mode-selector .btn-group .btn {
          border-radius: 0;
        }
        .pointage-mode-selector .btn-group .btn:first-child {
          border-radius: var(--radius-sm) 0 0 var(--radius-sm);
        }
        .pointage-mode-selector .btn-group .btn:last-child {
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }
        .presences-card-header {
          flex-wrap: wrap;
          gap: var(--spacing-md);
          align-items: flex-start;
        }
        .presence-summary {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: nowrap;
          justify-content: flex-end;
          align-items: flex-start;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          max-width: 100%;
        }
        .presence-summary--panel-na {
          justify-content: flex-end;
        }
        .summary-item {
          text-align: center;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-primary);
          border-radius: var(--radius-sm);
        }
        .summary-filter-btn {
          text-align: center;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-primary);
          border-radius: var(--radius-sm);
          border: 2px solid transparent;
          cursor: pointer;
          font: inherit;
          color: inherit;
          box-shadow: var(--shadow-sm);
          transition:
            transform var(--transition-fast),
            border-color var(--transition-fast),
            box-shadow var(--transition-fast),
            background var(--transition-fast);
        }
        .summary-filter-btn:hover {
          transform: translateY(-2px);
          border-color: color-mix(in srgb, var(--summary-accent, var(--primary)) 55%, transparent);
          box-shadow: var(--shadow-md);
        }
        .summary-filter-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .summary-filter-btn:active {
          transform: translateY(0);
        }
        .summary-filter-btn--active {
          border-color: var(--summary-accent, var(--primary));
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--summary-accent, var(--primary)) 35%, transparent),
            var(--shadow-sm);
          background: color-mix(in srgb, var(--summary-accent, var(--primary)) 12%, var(--bg-primary));
        }
        body.theme-dark .summary-filter-btn--active {
          background: color-mix(in srgb, var(--summary-accent, var(--primary)) 18%, var(--bg-primary));
        }
        .summary-filter-btn--reset {
          border-style: dashed;
          border-color: color-mix(in srgb, var(--summary-accent, var(--primary)) 28%, transparent);
        }
        .summary-item--hint {
          margin-top: var(--spacing-xs);
          padding-top: var(--spacing-xs);
          border-top: 1px dashed var(--border-color);
          font-size: 0.72rem;
          color: var(--text-muted);
          text-align: right;
          flex-basis: 100%;
        }
        .summary-value {
          font-size: 1.38rem;
          font-weight: 800;
        }
        .summary-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .presence-legend {
          display: flex;
          justify-content: center;
          gap: var(--spacing-lg);
          padding: var(--spacing-md);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
        }
        .presence-legend .legend-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.85rem;
        }
        .presence-row {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
        }
        .presence-row:last-child {
          border-bottom: none;
        }
        .presence-membre {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          flex: 1;
          min-width: 200px;
        }
        .presence-statuts {
          display: flex;
          gap: var(--spacing-sm);
        }
        .statut-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
          background: var(--bg-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .statut-btn:hover {
          transform: scale(1.1);
        }
        .statut-btn.active {
          border-color: currentColor;
          background: currentColor;
        }
        .statut-btn.active i {
          color: white;
        }
        .statut-btn-reset {
          color: #9E9E9E !important;
          border-style: dashed;
        }
        .statut-btn-reset:hover {
          background: #f5f5f5 !important;
          color: #616161 !important;
        }
        .presence-comment {
          flex: 1;
          max-width: 200px;
        }
        .presence-comment input {
          font-size: 0.85rem;
        }
        @media (max-width: 768px) {
          .presence-row {
            flex-wrap: wrap;
          }
          .presence-membre {
            flex: 0 0 100%;
            width: 100%;
          }
          .presence-statuts {
            flex: 1 1 auto;
          }
          .presence-comment {
            flex: 1 1 100%;
            width: 100%;
            max-width: none;
          }
        }
      </style>
    `;
  },

  renderPresenceRow(presence, index) {
    const membre = presence.membre;
    const statuts = Presences.getStatuts().filter(s => s.value !== 'non_renseigne');
    const hasChoice = presence.statut && presence.statut !== 'non_renseigne';
    const searchText = ((membre.prenom || '') + ' ' + (membre.nom || '') + ' ' + (Utils.getRoleLabel(membre.role) || '')).toLowerCase();

    return `
      <div class="presence-row" data-index="${index}" data-type="membre" data-disciple-id="${membre.id}" data-presence-statut="${presence.statut}" data-search="${Utils.escapeAttr(searchText)}">
        <div class="presence-membre">
          <div class="member-avatar" style="background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'}; width: 40px; height: 40px; font-size: 0.9rem;">
            ${Utils.getInitials(membre.prenom, membre.nom)}
          </div>
          <div>
            <div class="member-name">${Utils.escapeHtml(membre.prenom)} ${Utils.escapeHtml(membre.nom)}</div>
            <div class="text-muted" style="font-size: 0.8rem;">${Utils.getRoleLabel(membre.role)}</div>
          </div>
        </div>
        <div class="presence-statuts">
          ${statuts.map(s => `
            <button type="button" class="statut-btn ${presence.statut === s.value ? 'active' : ''}"
                    style="color: ${s.color}"
                    onclick="PagesPresences.setStatut(${index}, '${s.value}', 'membre')"
                    title="${s.label}">
              <i class="fas ${s.icon}"></i>
            </button>
          `).join('')}
          ${hasChoice ? `
            <button type="button" class="statut-btn statut-btn-reset" onclick="PagesPresences.setStatut(${index}, 'non_renseigne', 'membre')"
                    title="Annuler le choix">
              <i class="fas fa-undo"></i>
            </button>
          ` : ''}
        </div>
        <div class="presence-comment">
          <input type="text" class="form-control" placeholder="Commentaire (ex. justification absence)..."
                 value="${Utils.escapeHtml(presence.commentaire)}"
                 onchange="PagesPresences.setComment(${index}, this.value, 'membre')">
        </div>
      </div>
    `;
  },

  renderPresenceRowNA(presence, index) {
    const na = presence.na;
    const statuts = (Presences.getStatutsNA ? Presences.getStatutsNA() : Presences.getStatuts()).filter(s => s.value !== 'non_renseigne');
    const hasChoice = presence.statut && presence.statut !== 'non_renseigne';
    const catLabel = typeof NouvellesAmes !== 'undefined' ? NouvellesAmes.getCategorieShortLabel(na.categorie) : (na.categorie || 'NA');
    const searchText = (na.prenom + ' ' + na.nom + ' ' + (na.suivi_par_nom || '')).toLowerCase().replace(/"/g, "'");

    return `
      <div class="presence-row" data-index="${index}" data-type="na" data-nouvelle-ame-id="${na.id}" data-presence-statut="${presence.statut}" data-search="${Utils.escapeAttr(searchText)}">
        <div class="presence-membre">
          <div class="member-avatar" style="background: #9C27B0; width: 40px; height: 40px; font-size: 0.9rem;">
            ${Utils.getInitials(na.prenom, na.nom)}
          </div>
          <div>
            <div class="member-name">${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)} <span class="badge" style="font-size: 0.7rem; background: #9C27B0; color: white;">${catLabel}</span></div>
            <div class="text-muted" style="font-size: 0.8rem;">${Utils.escapeHtml(na.suivi_par_nom || '-')}</div>
          </div>
        </div>
        <div class="presence-statuts">
          ${statuts.map(s => `
            <button type="button" class="statut-btn ${presence.statut === s.value ? 'active' : ''}"
                    style="color: ${s.color}"
                    onclick="PagesPresences.setStatutNA(${index}, '${s.value}')"
                    title="${s.label}">
              <i class="fas ${s.icon}"></i>
            </button>
          `).join('')}
          ${hasChoice ? `
            <button type="button" class="statut-btn statut-btn-reset" onclick="PagesPresences.setStatutNA(${index}, 'non_renseigne')"
                    title="Annuler le choix">
              <i class="fas fa-undo"></i>
            </button>
          ` : ''}
        </div>
        <div class="presence-comment">
          <input type="text" class="form-control" placeholder="Commentaire (ex. justification absence)..."
                 value="${Utils.escapeHtml(presence.commentaire)}"
                 onchange="PagesPresences.setCommentNA(${index}, this.value)">
        </div>
      </div>
    `;
  },

  renderSummary() {
    const hasNA = (this.presencesNAData && this.presencesNAData.length > 0);
    const onNAPanel = hasNA && this.activePresenceTab === 'na';

    const counts = { culte_comfrat: 0, present: 0, absent: 0, excuse: 0, autre_campus: 0, en_ligne: 0, non_renseigne: 0 };
    const countsNA = { culte_comfrat: 0, present: 0, absent: 0, excuse: 0, non_renseigne: 0, autre_campus: 0, en_ligne: 0, pas_revenir: 0, injoignable: 0 };

    this.presencesData.forEach(p => { counts[p.statut] = (counts[p.statut] || 0) + 1; });
    this.presencesNAData.forEach(p => { countsNA[p.statut] = (countsNA[p.statut] || 0) + 1; });

    const total = this.presencesData.length;
    const totalNA = this.presencesNAData.length;
    const effectifMembres = (counts.present || 0) + (counts.culte_comfrat || 0);
    const effectifNA = (countsNA.present || 0) + (countsNA.culte_comfrat || 0);
    const taux = total > 0 ? Math.round((effectifMembres / total) * 100) : 0;
    const tauxNA = totalNA > 0 ? Math.round((effectifNA / totalNA) * 100) : 0;

    const fm = this.summaryFilterMembres;
    const fn = this.summaryFilterNA;

    const membreBtn = (statut, count, label, color) => {
      const active = fm === statut;
      return `
      <button type="button" class="summary-filter-btn ${active ? 'summary-filter-btn--active' : ''}"
              style="--summary-accent: ${color}; color: ${color};"
              title="${Utils.escapeAttr('Membres — afficher uniquement : ' + label)}"
              aria-pressed="${active ? 'true' : 'false'}"
              onclick="PagesPresences.toggleSummaryFilter('membres','${statut}')">
        <div class="summary-value">${count}</div>
        <div class="summary-label">${label}</div>
      </button>`;
    };

    const naBtn = (statut, count, label, color, extraClass = '') => {
      const active = fn === statut;
      return `
      <button type="button" class="summary-filter-btn ${extraClass} ${active ? 'summary-filter-btn--active' : ''}"
              style="--summary-accent: ${color}; color: ${color};"
              title="${Utils.escapeAttr('NA/NC — afficher uniquement : ' + label)}"
              aria-pressed="${active ? 'true' : 'false'}"
              onclick="PagesPresences.toggleSummaryFilter('na','${statut}')">
        <div class="summary-value">${count}</div>
        <div class="summary-label">${label}</div>
      </button>`;
    };

    let html = '';

    if (!onNAPanel) {
      html += `
      ${membreBtn('culte_comfrat', counts.culte_comfrat || 0, 'Culte et Comfrat', '#00695C')}
      ${membreBtn('present', counts.present, 'Présents (membres)', 'var(--success)')}
      ${membreBtn('absent', counts.absent, 'Absents', 'var(--danger)')}
      ${membreBtn('excuse', counts.excuse, 'Excusés', 'var(--warning)')}
      ${membreBtn('autre_campus', counts.autre_campus || 0, 'Autre campus', '#2196F3')}
      ${membreBtn('en_ligne', counts.en_ligne || 0, 'En ligne', '#673AB7')}
      ${counts.non_renseigne > 0 ? membreBtn('non_renseigne', counts.non_renseigne, 'Non renseigné', '#9E9E9E') : ''}
      <button type="button" class="summary-filter-btn summary-filter-btn--reset"
              style="--summary-accent: var(--primary); color: var(--primary);"
              title="${Utils.escapeAttr('Afficher tous les membres (retirer le filtre par statut)')}"
              aria-pressed="false"
              onclick="PagesPresences.resetSummaryFilterScope('membres')">
        <div class="summary-value">${taux}%</div>
        <div class="summary-label">Taux membres</div>
      </button>
    `;
    }

    if (onNAPanel && totalNA > 0) {
      html += `
      ${naBtn('culte_comfrat', countsNA.culte_comfrat || 0, 'Culte et Comfrat (NA)', '#00695C', '')}
      ${naBtn('present', countsNA.present, 'Présents (NA)', 'var(--success)', '')}
      ${naBtn('absent', countsNA.absent, 'Absents (NA)', 'var(--danger)', '')}
      ${naBtn('excuse', countsNA.excuse, 'Excusés (NA)', 'var(--warning)', '')}
      ${naBtn('autre_campus', countsNA.autre_campus || 0, 'Autre campus (NA)', '#2196F3', '')}
      ${naBtn('en_ligne', countsNA.en_ligne || 0, 'En ligne (NA)', '#673AB7', '')}
      ${countsNA.non_renseigne > 0 ? naBtn('non_renseigne', countsNA.non_renseigne, 'Non renseigné (NA)', '#9E9E9E', '') : ''}
      ${(countsNA.pas_revenir || 0) > 0 ? naBtn('pas_revenir', countsNA.pas_revenir, 'Pas retour (NA)', '#795548', '') : ''}
      ${(countsNA.injoignable || 0) > 0 ? naBtn('injoignable', countsNA.injoignable, 'Injoignable (NA)', '#607D8B', '') : ''}
      <button type="button" class="summary-filter-btn summary-filter-btn--reset"
              style="--summary-accent: #9C27B0; color: #9C27B0;"
              title="${Utils.escapeAttr('Afficher toutes les NA/NC (retirer le filtre par statut)')}"
              aria-pressed="false"
              onclick="PagesPresences.resetSummaryFilterScope('na')">
        <div class="summary-value">${tauxNA}%</div>
        <div class="summary-label">Taux NA/NC</div>
      </button>
    `;
      if ((countsNA.autre_campus || 0) + (countsNA.en_ligne || 0) + (countsNA.pas_revenir || 0) + (countsNA.injoignable || 0) > 0) {
        html += `
      <div class="summary-item summary-item--static" style="color: #607D8B; font-size: 0.85rem; flex: 0 0 auto;">
        <div class="summary-value" style="font-size: 1.12rem;">${countsNA.autre_campus || 0} / ${countsNA.en_ligne || 0} / ${countsNA.pas_revenir || 0} / ${countsNA.injoignable || 0}</div>
        <div class="summary-label">Synthèse NA : campus / ligne / pas retour / injoignable</div>
      </div>`;
      }
    }

    html += `
      <div class="summary-item--hint" role="note"><i class="fas fa-hand-pointer"></i> Cliquez sur une tuile colorée pour filtrer la liste ci-dessous ; recliquez sur la même tuile pour tout réafficher.</div>
    `;
    return html;
  },

  updatePresenceSummaryDOM() {
    const el = document.getElementById('presence-summary');
    if (!el) return;
    const hasNA = (this.presencesNAData && this.presencesNAData.length > 0);
    const isNA = hasNA && this.activePresenceTab === 'na';
    el.className = 'presence-summary' + (hasNA ? (isNA ? ' presence-summary--panel-na' : ' presence-summary--panel-membres') : '');
    el.setAttribute('aria-label', isNA ? 'Filtrer les NA/NC par statut de présence' : 'Filtrer les membres par statut de présence');
    el.innerHTML = this.renderSummary();
  },

  /** Synchronise les onglets Membres / NA et la visibilité des panneaux avec `activePresenceTab`. */
  _syncPresenceTabPanels() {
    const hasNA = (this.presencesNAData && this.presencesNAData.length > 0);
    if (!hasNA) return;
    const tabM = document.getElementById('presence-tab-membres');
    const tabN = document.getElementById('presence-tab-na');
    const panM = document.getElementById('presence-panel-membres');
    const panN = document.getElementById('presence-panel-na');
    if (!panM || !panN) return;
    const showM = this.activePresenceTab === 'membres';
    panM.style.display = showM ? '' : 'none';
    panN.style.display = showM ? 'none' : '';
    if (tabM) {
      tabM.classList.toggle('active', showM);
      tabM.setAttribute('aria-selected', showM ? 'true' : 'false');
    }
    if (tabN) {
      tabN.classList.toggle('active', !showM);
      tabN.setAttribute('aria-selected', showM ? 'false' : 'true');
    }
  },

  toggleSummaryFilter(scope, statut) {
    const key = scope === 'na' ? 'summaryFilterNA' : 'summaryFilterMembres';
    const cur = this[key];
    if (cur === statut) {
      this[key] = null;
    } else {
      this[key] = statut;
      if (scope === 'na') {
        this.activePresenceTab = 'na';
      } else {
        this.activePresenceTab = 'membres';
      }
      this._syncPresenceTabPanels();
    }
    this.updatePresenceSummaryDOM();
    this.applySummaryFiltersToLists();
  },

  resetSummaryFilterScope(scope) {
    const key = scope === 'na' ? 'summaryFilterNA' : 'summaryFilterMembres';
    this[key] = null;
    if (scope === 'na') {
      this.activePresenceTab = 'na';
    } else {
      this.activePresenceTab = 'membres';
    }
    this._syncPresenceTabPanels();
    this.updatePresenceSummaryDOM();
    this.applySummaryFiltersToLists();
  },

  applySummaryFiltersToLists() {
    const inpM = document.querySelector('#presence-panel-membres .presence-panel-toolbar-search input');
    const inpN = document.querySelector('#presence-panel-na .presence-panel-toolbar-search input');
    const g = typeof document !== 'undefined' ? document.getElementById('global-search-input') : null;
    const globalQ = (g && typeof AppState !== 'undefined' && AppState.currentPage === 'presences')
      ? (g.value || '').trim().toLowerCase()
      : '';
    if (globalQ.length >= 2) {
      this.applyGlobalPresenceSearchFilter(globalQ);
      return;
    }
    this.filterPresencesSection('membres', inpM ? inpM.value : '');
    this.filterPresencesSection('na', inpN ? inpN.value : '');
  },

  setStatut(index, statut, type) {
    if (type === 'na') {
      this.presencesNAData[index].statut = statut;
    } else {
      this.presencesData[index].statut = statut;
    }
    
    const row = document.querySelector(`.presence-row[data-type="${type || 'membre'}"][data-index="${index}"]`);
    if (row) {
      // Re-render the row to show/hide the Annuler button
      const presence = type === 'na' ? this.presencesNAData[index] : this.presencesData[index];
      const newRowHtml = type === 'na' ? this.renderPresenceRowNA(presence, index) : this.renderPresenceRow(presence, index);
      const temp = document.createElement('div');
      temp.innerHTML = newRowHtml;
      const newRow = temp.firstElementChild;
      if (newRow) {
        row.replaceWith(newRow);
      }
    }

    this.updatePresenceSummaryDOM();
    this.applySummaryFiltersToLists();
  },

  setStatutNA(index, statut) {
    this.setStatut(index, statut, 'na');
  },

  setComment(index, comment, type) {
    if (type === 'na') {
      this.presencesNAData[index].commentaire = comment;
    } else {
      this.presencesData[index].commentaire = comment;
    }
  },

  setCommentNA(index, comment) {
    this.setComment(index, comment, 'na');
  },

  async savePresences() {
    const presencesToSave = this.presencesData.map(p => ({
      id: p.id,
      disciple_id: p.disciple_id,
      nouvelle_ame_id: null,
      statut: p.statut,
      commentaire: p.commentaire
    }));
    const presencesNASave = this.presencesNAData.map(p => ({
      id: p.id,
      disciple_id: null,
      nouvelle_ame_id: p.nouvelle_ame_id,
      statut: p.statut,
      commentaire: p.commentaire
    }));

    const success = await Presences.saveForProgramme(this.currentProgrammeId, presencesToSave.concat(presencesNASave));
    
    if (success) {
      // Recharger les présences
      await Presences.loadByProgramme(this.currentProgrammeId);
    }
  },

  // Export des présences en CSV
  exportPresencesCSV() {
    const programme = Programmes.getById(this.currentProgrammeId);
    const totalRows = (this.presencesData?.length || 0) + (this.presencesNAData?.length || 0);
    if (!programme || totalRows === 0) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }

    const dateDebut = programme.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);
    
    const sep = ';';
    const escapeCsv = (val) => {
      if (val == null || val === '') return '';
      const s = String(val).replace(/"/g, '""');
      return /[;\r\n"]/.test(s) ? `"${s}"` : s;
    };

    const headers = ['Type', 'Prénom', 'Nom', 'Rôle/Suivi', 'Statut', 'Commentaire'];
    const rows = [];
    (this.presencesData || []).forEach(p => {
      rows.push(['Membre', escapeCsv(p.membre.prenom), escapeCsv(p.membre.nom), escapeCsv(Utils.getRoleLabel(p.membre.role)), escapeCsv(Presences.getStatutLabel(p.statut)), escapeCsv(p.commentaire)].join(sep));
    });
    (this.presencesNAData || []).forEach(p => {
      rows.push(['NA/NC', escapeCsv(p.na.prenom), escapeCsv(p.na.nom), escapeCsv(p.na.suivi_par_nom || '-'), escapeCsv(Presences.getStatutLabel(p.statut)), escapeCsv(p.commentaire)].join(sep));
    });

    const csv = '\uFEFF' + headers.join(sep) + '\r\n' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const fileName = `presences_${programme.nom.replace(/[^a-zA-Z0-9]/g, '_')}_${dateDebut.toISOString().slice(0, 10)}.csv`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success(`Export de ${totalRows} présence(s) réussi.`);
  },

  // Export des présences en PDF (téléchargement direct)
  async exportPresencesPDF() {
    const programme = Programmes.getById(this.currentProgrammeId);
    const totalRows = (this.presencesData?.length || 0) + (this.presencesNAData?.length || 0);
    if (!programme || totalRows === 0) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }

    const dataForPdf = [
      ...(this.presencesData || []).map(p => ({ ...p, _type: 'membre', _prenom: p.membre.prenom, _nom: p.membre.nom, _role: Utils.getRoleLabel(p.membre.role) })),
      ...(this.presencesNAData || []).map(p => ({ ...p, _type: 'na', _prenom: p.na.prenom, _nom: p.na.nom, _role: p.na.suivi_par_nom || '-' }))
    ];

    try {
      App.showLoading();
      await PDFExport.generateProgrammePresenceReport(dataForPdf, {
        programme: programme,
        famille: AppState.famille?.nom || ''
      });
      Toast.success(`Téléchargement du PDF (${totalRows} présence(s)) en cours.`);
    } catch (e) {
      console.error('Erreur export PDF présences:', e);
      Toast.error(e.message || 'Erreur lors de la génération du PDF.');
    } finally {
      App.hideLoading();
    }
  },

  // Historique des présences d'un membre
  async renderHistoriqueMembre(membreId) {
    const membre = Membres.getById(membreId);
    if (!membre) return '<div class="alert alert-danger">Membre non trouvé</div>';

    const presences = await Presences.loadByMembre(membreId);

    // Associer avec les programmes
    const historique = presences.map(p => {
      const programme = Programmes.getById(p.programme_id);
      return { ...p, programme };
    }).filter(p => p.programme).sort((a, b) => {
      const da = a.programme.date_debut?.toDate ? a.programme.date_debut.toDate() : new Date(0);
      const db = b.programme.date_debut?.toDate ? b.programme.date_debut.toDate() : new Date(0);
      return db - da;
    });

    // Calculer les stats
    const total = historique.length;
    const culteComfrat = historique.filter(h => h.statut === 'culte_comfrat').length;
    const presents = historique.filter(h => h.statut === 'present').length;
    const absents = historique.filter(h => h.statut === 'absent').length;
    const excuses = historique.filter(h => h.statut === 'excuse').length;
    const pourTaux = historique.filter(h => Presences.estPourTauxPresence(h.statut)).length;
    const taux = total > 0 ? Math.round((pourTaux / total) * 100) : 0;

    return `
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <div class="card-header">
          <div class="d-flex align-center gap-2">
            <div class="member-avatar" style="width: 50px; height: 50px; background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'}">
              ${Utils.getInitials(membre.prenom, membre.nom)}
            </div>
            <div>
              <h3 class="card-title mb-0">Historique de ${Utils.escapeHtml(membre.prenom)}</h3>
              <span class="text-muted">${total} programmes</span>
            </div>
          </div>
        </div>
        
        <div class="presence-stats-bar">
          <div class="stat-item" style="--color: #00695C">
            <span class="stat-value">${culteComfrat}</span>
            <span class="stat-label">Culte et Comfrat</span>
          </div>
          <div class="stat-item" style="--color: var(--success)">
            <span class="stat-value">${presents}</span>
            <span class="stat-label">Présent${presents > 1 ? 's' : ''}</span>
          </div>
          <div class="stat-item" style="--color: var(--danger)">
            <span class="stat-value">${absents}</span>
            <span class="stat-label">Absent${absents > 1 ? 's' : ''}</span>
          </div>
          <div class="stat-item" style="--color: var(--warning)">
            <span class="stat-value">${excuses}</span>
            <span class="stat-label">Excusé${excuses > 1 ? 's' : ''}</span>
          </div>
          <div class="stat-item" style="--color: var(--primary)">
            <span class="stat-value">${taux}%</span>
            <span class="stat-label">Taux</span>
          </div>
        </div>
        
        <div class="card-body" style="padding: 0;">
          ${historique.length > 0 ? `
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Programme</th>
                  <th>Statut</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                ${historique.map(h => {
                  const date = h.programme.date_debut?.toDate ? h.programme.date_debut.toDate() : new Date();
                  return `
                    <tr>
                      <td>${Utils.formatDate(date)}</td>
                      <td>
                        <strong>${Utils.escapeHtml(h.programme.nom)}</strong>
                        <div class="text-muted" style="font-size: 0.8rem;">${Programmes.getTypeLabel(h.programme.type)}</div>
                      </td>
                      <td>
                        <span class="badge" style="background: ${Presences.getStatutColor(h.statut)}; color: white;">
                          ${Presences.getStatutLabel(h.statut)}
                        </span>
                      </td>
                      <td class="text-muted">${h.commentaire || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <div class="empty-state">
              <i class="fas fa-clipboard-list"></i>
              <h3>Aucun historique</h3>
              <p>Aucune présence enregistrée pour ce membre.</p>
            </div>
          `}
        </div>
      </div>

      <style>
        .presence-stats-bar {
          display: flex;
          justify-content: space-around;
          padding: var(--spacing-lg);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
        }
        .presence-stats-bar .stat-item {
          text-align: center;
        }
        .presence-stats-bar .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color);
        }
        .presence-stats-bar .stat-label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
      </style>
    `;
  },

  // Historique des présences d'une NA/NC
  async renderHistoriqueNA(nouvelleAmeId) {
    const na = typeof NouvellesAmes !== 'undefined' ? NouvellesAmes.getById(nouvelleAmeId) : null;
    if (!na) return '<div class="alert alert-danger">Nouvelle âme non trouvée</div>';

    const presences = await Presences.loadByNouvelleAme(nouvelleAmeId);

    const historique = presences.map(p => {
      const programme = Programmes.getById(p.programme_id);
      return { ...p, programme };
    }).filter(p => p.programme).sort((a, b) => {
      const da = a.programme.date_debut?.toDate ? a.programme.date_debut.toDate() : new Date(0);
      const db = b.programme.date_debut?.toDate ? b.programme.date_debut.toDate() : new Date(0);
      return db - da;
    });

    const total = historique.length;
    const culteComfrat = historique.filter(h => h.statut === 'culte_comfrat').length;
    const presents = historique.filter(h => h.statut === 'present').length;
    const absents = historique.filter(h => h.statut === 'absent').length;
    const excuses = historique.filter(h => h.statut === 'excuse').length;
    const pourTaux = historique.filter(h => Presences.estPourTauxPresence(h.statut)).length;
    const taux = total > 0 ? Math.round((pourTaux / total) * 100) : 0;

    return `
      <div class="card" style="max-width: 900px; margin: 0 auto;">
        <div class="card-header" style="flex-wrap: wrap; gap: var(--spacing-sm);">
          <div class="d-flex align-center gap-2">
            <div class="member-avatar" style="width: 50px; height: 50px; background: #9C27B0">
              ${Utils.getInitials(na.prenom, na.nom)}
            </div>
            <div>
              <h3 class="card-title mb-0">Historique de présence — ${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}</h3>
              <span class="text-muted">${total} programme${total !== 1 ? 's' : ''} (NA/NC)</span>
            </div>
          </div>
          <div style="display: flex; gap: var(--spacing-sm); flex-wrap: wrap; align-items: center;">
            ${historique.length > 0 ? `
            <div class="search-box" style="min-width: 200px;">
              <i class="fas fa-search"></i>
              <input type="text" class="form-control" placeholder="Rechercher programme ou statut..."
                     onkeyup="PagesPresences.filterHistoriqueNATable(this.value)">
            </div>
            <button class="btn btn-outline btn-sm" onclick="PagesPresences.exportHistoriqueNACSV('${nouvelleAmeId}')" title="Export CSV">
              <i class="fas fa-file-csv"></i> CSV
            </button>
            <button class="btn btn-outline btn-sm" onclick="PagesPresences.exportHistoriqueNAPDF('${nouvelleAmeId}')" title="Export PDF">
              <i class="fas fa-file-pdf"></i> PDF
            </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('nouvelle-ame-detail', { id: '${nouvelleAmeId}' })">
              <i class="fas fa-arrow-left"></i> Retour
            </button>
          </div>
        </div>
        
        <div class="presence-stats-bar">
          <div class="stat-item" style="--color: #00695C">
            <span class="stat-value">${culteComfrat}</span>
            <span class="stat-label">Culte et Comfrat</span>
          </div>
          <div class="stat-item" style="--color: var(--success)">
            <span class="stat-value">${presents}</span>
            <span class="stat-label">Présent${presents > 1 ? 's' : ''}</span>
          </div>
          <div class="stat-item" style="--color: var(--danger)">
            <span class="stat-value">${absents}</span>
            <span class="stat-label">Absent${absents > 1 ? 's' : ''}</span>
          </div>
          <div class="stat-item" style="--color: var(--warning)">
            <span class="stat-value">${excuses}</span>
            <span class="stat-label">Excusé${excuses > 1 ? 's' : ''}</span>
          </div>
          <div class="stat-item" style="--color: #9C27B0">
            <span class="stat-value">${taux}%</span>
            <span class="stat-label">Taux</span>
          </div>
        </div>
        
        <div class="card-body" style="padding: 0;">
          ${historique.length > 0 ? `
            <table class="table" id="historique-na-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Programme</th>
                  <th>Statut</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                ${historique.map(h => {
                  const date = h.programme.date_debut?.toDate ? h.programme.date_debut.toDate() : new Date();
                  const statutLabel = Presences.getStatutLabel(h.statut);
                  return `
                    <tr data-search="${(h.programme.nom + ' ' + (h.programme.type || '') + ' ' + statutLabel).toLowerCase()}">
                      <td>${Utils.formatDate(date)}</td>
                      <td>
                        <strong>${Utils.escapeHtml(h.programme.nom)}</strong>
                        <div class="text-muted" style="font-size: 0.8rem;">${Programmes.getTypeLabel(h.programme.type)}</div>
                      </td>
                      <td>
                        <span class="badge" style="background: ${Presences.getStatutColor(h.statut)}; color: white;">
                          ${statutLabel}
                        </span>
                      </td>
                      <td class="text-muted">${h.commentaire || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <div class="empty-state">
              <i class="fas fa-clipboard-list"></i>
              <h3>Aucun historique</h3>
              <p>Aucune présence enregistrée pour cette NA/NC.</p>
            </div>
          `}
        </div>
      </div>

      <style>
        .presence-stats-bar {
          display: flex;
          justify-content: space-around;
          padding: var(--spacing-lg);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
        }
        .presence-stats-bar .stat-item {
          text-align: center;
        }
        .presence-stats-bar .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color);
        }
        .presence-stats-bar .stat-label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
      </style>
    `;
  },

  filterPresencesNATable(search) {
    this.filterPresencesSection('na', search);
  },

  /** Filtre membres ou NA/NC dans le panneau courant (champ local). */
  filterPresencesSection(which, search) {
    const s = (search || '').toLowerCase().trim();
    const listSel = which === 'na' ? '#presence-list-na' : '#presence-list';
    const statutFilter = which === 'na' ? this.summaryFilterNA : this.summaryFilterMembres;
    document.querySelectorAll(`${listSel} .presence-row`).forEach(row => {
      const text = (row.getAttribute('data-search') || '').toLowerCase();
      const rowStatut = row.getAttribute('data-presence-statut') || '';
      const searchOk = !s || text.includes(s);
      const statutOk = !statutFilter || rowStatut === statutFilter;
      row.style.display = searchOk && statutOk ? '' : 'none';
    });
  },

  /** Réinitialise uniquement la recherche globale sur les lignes ; réapplique filtres tuiles et recherche locale. */
  resetPresenceRowFilters() {
    this.applySummaryFiltersToLists();
  },

  /** Filtre les deux listes selon la recherche en-tête (personnes présentes à ce programme uniquement). */
  applyGlobalPresenceSearchFilter(query) {
    const s = (query || '').trim().toLowerCase();
    if (!s) {
      this.applySummaryFiltersToLists();
      return;
    }
    const applyRows = (listSel, scope) => {
      const statutFilter = scope === 'na' ? this.summaryFilterNA : this.summaryFilterMembres;
      document.querySelectorAll(`${listSel} .presence-row`).forEach(row => {
        const text = (row.getAttribute('data-search') || '').toLowerCase();
        const rowStatut = row.getAttribute('data-presence-statut') || '';
        const statutOk = !statutFilter || rowStatut === statutFilter;
        row.style.display = text.includes(s) && statutOk ? '' : 'none';
      });
    };
    applyRows('#presence-list', 'membres');
    applyRows('#presence-list-na', 'na');
  },

  selectPresenceTab(which) {
    const hasNA = (this.presencesNAData && this.presencesNAData.length > 0);
    if (!hasNA) return;
    this.activePresenceTab = which === 'na' ? 'na' : 'membres';
    this._syncPresenceTabPanels();
    this.updatePresenceSummaryDOM();
    this.applySummaryFiltersToLists();
  },

  searchProgrammePresenceByQuery(qRaw) {
    const q = (qRaw || '').trim().toLowerCase();
    if (!q || !this.currentProgrammeId) return [];
    const out = [];
    (this.presencesData || []).forEach((p) => {
      const name = `${p.membre.prenom || ''} ${p.membre.nom || ''}`.trim();
      if (name.toLowerCase().includes(q)) {
        out.push({ kind: 'membre', id: p.disciple_id, label: name, sub: 'Membre — ce programme' });
      }
    });
    (this.presencesNAData || []).forEach((p) => {
      const name = `${p.na.prenom || ''} ${p.na.nom || ''}`.trim();
      if (name.toLowerCase().includes(q)) {
        out.push({ kind: 'nouvelle_ame', id: p.nouvelle_ame_id, label: name, sub: 'NA/NC — ce programme' });
      }
    });
    return out.slice(0, 12);
  },

  findPresenceRowEl(kind, id) {
    if (!id) return null;
    if (kind === 'membre') {
      return Array.from(document.querySelectorAll('#presence-list .presence-row[data-type="membre"]'))
        .find(r => r.getAttribute('data-disciple-id') === id) || null;
    }
    return Array.from(document.querySelectorAll('#presence-list-na .presence-row[data-type="na"]'))
      .find(r => r.getAttribute('data-nouvelle-ame-id') === id) || null;
  },

  revealPresencesListRow(kind, id) {
    if (!id) return;
    const isMembre = kind === 'membre';
    if ((this.presencesNAData || []).length > 0) {
      this.selectPresenceTab(isMembre ? 'membres' : 'na');
    }
    const run = () => {
      const row = this.findPresenceRowEl(kind, id);
      if (!row) {
        Toast.warning('Personne introuvable sur ce programme avec les filtres actuels.');
        return;
      }
      row.style.display = '';
      row.classList.remove('presence-row--flash');
      void row.offsetWidth;
      row.classList.add('presence-row--flash');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => row.classList.remove('presence-row--flash'), 2200);
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  },

  filterHistoriqueNATable(search) {
    const rows = document.querySelectorAll('#historique-na-table tbody tr');
    const s = (search || '').toLowerCase().trim();
    rows.forEach(row => {
      const text = row.dataset.search || '';
      row.style.display = !s || text.includes(s) ? '' : 'none';
    });
  },

  exportHistoriqueNACSV(nouvelleAmeId) {
    const na = typeof NouvellesAmes !== 'undefined' ? NouvellesAmes.getById(nouvelleAmeId) : null;
    if (!na) return;
    const rows = document.querySelectorAll('#historique-na-table tbody tr');
    if (rows.length === 0) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }
    const escapeCsv = (v) => {
      if (v == null || v === '') return '';
      const s = String(v).replace(/"/g, '""');
      return /[;\r\n"]/.test(s) ? `"${s}"` : s;
    };
    const data = [];
    rows.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 4) {
        data.push([
          cells[0].textContent.trim(),
          cells[1].textContent.replace(/\s+/g, ' ').trim(),
          cells[2].textContent.trim(),
          cells[3].textContent.trim()
        ]);
      }
    });
    const headers = ['Date', 'Programme', 'Statut', 'Commentaire'];
    const csv = '\uFEFF' + headers.join(';') + '\r\n' + data.map(r => r.map(escapeCsv).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historique-presence-${na.prenom}_${na.nom}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success('Export CSV téléchargé');
  },

  exportHistoriqueNAPDF(nouvelleAmeId) {
    const na = typeof NouvellesAmes !== 'undefined' ? NouvellesAmes.getById(nouvelleAmeId) : null;
    if (!na) return;
    const rows = document.querySelectorAll('#historique-na-table tbody tr');
    if (rows.length === 0) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }
    const tableRows = Array.from(rows).map(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 4) {
        return `<tr><td>${Utils.escapeHtml(cells[0].textContent.trim())}</td><td>${Utils.escapeHtml(cells[1].textContent.replace(/\s+/g, ' ').trim())}</td><td>${Utils.escapeHtml(cells[2].textContent.trim())}</td><td>${Utils.escapeHtml(cells[3].textContent.trim())}</td></tr>`;
      }
      return '';
    }).filter(Boolean).join('');

    const content = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Historique présence - ${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; padding: 15mm; color: #333; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #9C27B0; }
    .header h1 { color: #9C27B0; font-size: 18pt; }
    .header .subtitle { font-size: 10pt; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f7fa; font-weight: 600; }
    .btn-print { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #9C27B0; color: white; border: none; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">Imprimer / PDF</button>
  <div class="header">
    <h1>Historique de présence — ${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}</h1>
    <div class="subtitle">NA/NC — ${rows.length} programme(s)</div>
    <div class="subtitle">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Programme</th><th>Statut</th><th>Commentaire</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
    const w = window.open('about:blank', '_blank');
    if (w) {
      w.document.write(content);
      w.document.close();
      w.onload = () => setTimeout(() => w.print(), 300);
      Toast.success('Fenêtre ouverte : utilisez Imprimer puis « Enregistrer au format PDF ».');
    } else {
      Toast.error('Autorisez les popups pour l\'export PDF.');
    }
  }
};
