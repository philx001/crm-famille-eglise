// ============================================
// PAGES PRÉSENCES
// ============================================

const PagesPresences = {
  currentProgrammeId: null,
  presencesData: [],
  presencesNAData: [],

  // Page de pointage des présences
  async renderPresences(programmeId) {
    this.currentProgrammeId = programmeId;
    const programme = Programmes.getById(programmeId);
    
    if (!programme) {
      return '<div class="alert alert-danger">Programme non trouvé</div>';
    }

    if (!Programmes.pointageRequis(programme)) {
      return `
        <div class="card" style="max-width: 500px; margin: 0 auto;">
          <div class="card-body text-center">
            <h3><i class="fas fa-info-circle"></i> Pointage non requis</h3>
            <p class="text-muted mt-2">Ce programme (${Utils.escapeHtml(programme.nom)}) est informatif. Le pointage des présences n'est pas nécessaire et il n'est pas comptabilisé dans les statistiques.</p>
            <button type="button" class="btn btn-primary mt-3" onclick="App.navigate('programme-detail', { programmeId: '${programmeId}' })">
              <i class="fas fa-arrow-left"></i> Voir le programme
            </button>
            <button type="button" class="btn btn-outline mt-3" onclick="App.navigate('programmes')">
              <i class="fas fa-list"></i> Liste des programmes
            </button>
          </div>
        </div>
      `;
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

    return `
      <div class="presences-header">
        <div>
          <h2>${Utils.escapeHtml(programme.nom)} <span class="badge badge-secondary" style="font-size: 0.75rem; font-weight: 600;">${membres.length} membre${membres.length !== 1 ? 's' : ''}</span>${this.presencesNAData.length > 0 ? ` <span class="badge" style="font-size: 0.75rem; font-weight: 600; background: #9C27B0; color: white;">${this.presencesNAData.length} NA/NC</span>` : ''}</h2>
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
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Pointage des présences</h3>
          <div class="presence-summary" id="presence-summary">
            ${this.renderSummary()}
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
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
          
          <div class="presence-list" id="presence-list">
            ${this.presencesData.map((p, index) => this.renderPresenceRow(p, index)).join('')}
          </div>
          ${this.presencesNAData.length > 0 ? `
          <div class="presence-section-na" style="border-top: 2px solid #9C27B0; margin-top: var(--spacing-md); padding-top: var(--spacing-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
              <h4 style="margin: 0; color: #9C27B0;"><i class="fas fa-seedling"></i> Nouvelles âmes / Nouveaux convertis (NA/NC)</h4>
              ${this.presencesNAData.length > 5 ? `
              <div class="search-box" style="min-width: 200px;">
                <i class="fas fa-search"></i>
                <input type="text" class="form-control" placeholder="Rechercher NA/NC..."
                       onkeyup="PagesPresences.filterPresencesNATable(this.value)">
              </div>
              ` : ''}
            </div>
            <div class="presence-legend" style="margin-bottom: var(--spacing-md);">
              ${(Presences.getStatutsNA ? Presences.getStatutsNA() : Presences.getStatuts()).filter(s => s.value !== 'non_renseigne').map(s => `
                <span class="legend-item" title="${s.title || s.label}">
                  <i class="fas ${s.icon}" style="color: ${s.color}"></i> ${s.label}
                </span>
              `).join('')}
              <span class="legend-item" title="Annuler le pointage pour ce NA/NC">
                <i class="fas fa-undo" style="color: #9E9E9E"></i> Annuler
              </span>
            </div>
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
        .presence-summary {
          display: flex;
          gap: var(--spacing-md);
        }
        .summary-item {
          text-align: center;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-primary);
          border-radius: var(--radius-sm);
        }
        .summary-value {
          font-size: 1.25rem;
          font-weight: 700;
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
            width: 100%;
          }
          .presence-comment {
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

    return `
      <div class="presence-row" data-index="${index}" data-type="membre">
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
      <div class="presence-row" data-index="${index}" data-type="na" data-search="${searchText}">
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
    const counts = { present: 0, absent: 0, excuse: 0, autre_campus: 0, non_renseigne: 0 };
    const countsNA = { present: 0, absent: 0, excuse: 0, non_renseigne: 0, autre_campus: 0, pas_revenir: 0, injoignable: 0 };

    this.presencesData.forEach(p => { counts[p.statut] = (counts[p.statut] || 0) + 1; });
    this.presencesNAData.forEach(p => { countsNA[p.statut] = (countsNA[p.statut] || 0) + 1; });

    const total = this.presencesData.length;
    const totalNA = this.presencesNAData.length;
    const taux = total > 0 ? Math.round((counts.present / total) * 100) : 0;
    const tauxNA = totalNA > 0 ? Math.round((countsNA.present / totalNA) * 100) : 0;

    return `
      <div class="summary-item" style="color: var(--success);">
        <div class="summary-value">${counts.present}</div>
        <div class="summary-label">Présents (membres)</div>
      </div>
      <div class="summary-item" style="color: var(--danger);">
        <div class="summary-value">${counts.absent}</div>
        <div class="summary-label">Absents</div>
      </div>
      <div class="summary-item" style="color: var(--warning);">
        <div class="summary-value">${counts.excuse}</div>
        <div class="summary-label">Excusés</div>
      </div>
      <div class="summary-item" style="color: #2196F3;">
        <div class="summary-value">${counts.autre_campus || 0}</div>
        <div class="summary-label">Autre campus</div>
      </div>
      <div class="summary-item" style="color: var(--primary);">
        <div class="summary-value">${taux}%</div>
        <div class="summary-label">Taux membres</div>
      </div>
      ${totalNA > 0 ? `
      <div class="summary-item" style="color: #9C27B0; border-left: 1px solid #9C27B0; padding-left: 8px;">
        <div class="summary-value">${countsNA.present}/${totalNA}</div>
        <div class="summary-label">NA/NC présents</div>
      </div>
      <div class="summary-item" style="color: #9C27B0;">
        <div class="summary-value">${tauxNA}%</div>
        <div class="summary-label">Taux NA/NC</div>
      </div>
      ${(countsNA.autre_campus || 0) + (countsNA.pas_revenir || 0) + (countsNA.injoignable || 0) > 0 ? `
      <div class="summary-item" style="color: #607D8B; font-size: 0.85rem;">
        <div class="summary-value">${countsNA.autre_campus || 0} / ${countsNA.pas_revenir || 0} / ${countsNA.injoignable || 0}</div>
        <div class="summary-label">Autre campus / Pas retour / Injoignable</div>
      </div>
      ` : ''}
      ` : ''}
    `;
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

    const summaryEl = document.getElementById('presence-summary');
    if (summaryEl) summaryEl.innerHTML = this.renderSummary();
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
    const presents = historique.filter(h => h.statut === 'present').length;
    const absents = historique.filter(h => h.statut === 'absent').length;
    const excuses = historique.filter(h => h.statut === 'excuse').length;
    const taux = total > 0 ? Math.round((presents / total) * 100) : 0;

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
    const presents = historique.filter(h => h.statut === 'present').length;
    const absents = historique.filter(h => h.statut === 'absent').length;
    const excuses = historique.filter(h => h.statut === 'excuse').length;
    const taux = total > 0 ? Math.round((presents / total) * 100) : 0;

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
    const rows = document.querySelectorAll('#presence-list-na .presence-row[data-type="na"]');
    const s = (search || '').toLowerCase().trim();
    rows.forEach(row => {
      const text = row.dataset.search || '';
      row.style.display = !s || text.includes(s) ? '' : 'none';
    });
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
