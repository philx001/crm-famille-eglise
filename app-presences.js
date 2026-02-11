// ============================================
// PAGES PRÉSENCES
// ============================================

const PagesPresences = {
  currentProgrammeId: null,
  presencesData: [],

  // Page de pointage des présences
  async renderPresences(programmeId) {
    this.currentProgrammeId = programmeId;
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
    
    // Obtenir les membres à pointer
    let membres = [];
    if (Permissions.hasRole('adjoint_superviseur')) {
      // Superviseur et adjoint voient tous les membres actifs
      membres = AppState.membres.filter(m => m.statut_compte === 'actif');
    } else {
      // Le mentor voit ses disciples
      membres = Membres.getDisciples(AppState.user.id);
    }

    // Préparer les données de présence
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

    const dateDebut = programme.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);

    return `
      <div class="presences-header">
        <div>
          <h2>${Utils.escapeHtml(programme.nom)}</h2>
          <p class="text-muted">
            <i class="fas fa-calendar"></i> ${Utils.formatDate(dateDebut, 'full')} à 
            ${dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
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
            ${Presences.getStatuts().map(s => `
              <span class="legend-item">
                <i class="fas ${s.icon}" style="color: ${s.color}"></i> ${s.label}
              </span>
            `).join('')}
          </div>
          
          <div class="presence-list" id="presence-list">
            ${this.presencesData.map((p, index) => this.renderPresenceRow(p, index)).join('')}
          </div>
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
    const statuts = Presences.getStatuts();

    return `
      <div class="presence-row" data-index="${index}">
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
                    onclick="PagesPresences.setStatut(${index}, '${s.value}')"
                    title="${s.label}">
              <i class="fas ${s.icon}"></i>
            </button>
          `).join('')}
        </div>
        <div class="presence-comment">
          <input type="text" class="form-control" placeholder="Commentaire..."
                 value="${Utils.escapeHtml(presence.commentaire)}"
                 onchange="PagesPresences.setComment(${index}, this.value)">
        </div>
      </div>
    `;
  },

  renderSummary() {
    const counts = {
      present: 0,
      absent: 0,
      excuse: 0,
      non_renseigne: 0
    };

    this.presencesData.forEach(p => {
      counts[p.statut]++;
    });

    const total = this.presencesData.length;
    const taux = total > 0 ? Math.round((counts.present / total) * 100) : 0;

    return `
      <div class="summary-item" style="color: var(--success);">
        <div class="summary-value">${counts.present}</div>
        <div class="summary-label">Présents</div>
      </div>
      <div class="summary-item" style="color: var(--danger);">
        <div class="summary-value">${counts.absent}</div>
        <div class="summary-label">Absents</div>
      </div>
      <div class="summary-item" style="color: var(--warning);">
        <div class="summary-value">${counts.excuse}</div>
        <div class="summary-label">Excusés</div>
      </div>
      <div class="summary-item" style="color: var(--primary);">
        <div class="summary-value">${taux}%</div>
        <div class="summary-label">Taux</div>
      </div>
    `;
  },

  setStatut(index, statut) {
    this.presencesData[index].statut = statut;
    
    // Mettre à jour l'UI
    const row = document.querySelector(`.presence-row[data-index="${index}"]`);
    row.querySelectorAll('.statut-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = row.querySelector(`.statut-btn[title="${Presences.getStatutLabel(statut)}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Mettre à jour le résumé
    document.getElementById('presence-summary').innerHTML = this.renderSummary();
  },

  setComment(index, comment) {
    this.presencesData[index].commentaire = comment;
  },

  async savePresences() {
    const presencesToSave = this.presencesData.map(p => ({
      id: p.id,
      disciple_id: p.disciple_id,
      statut: p.statut,
      commentaire: p.commentaire
    }));

    const success = await Presences.saveForProgramme(this.currentProgrammeId, presencesToSave);
    
    if (success) {
      // Recharger les présences
      await Presences.loadByProgramme(this.currentProgrammeId);
    }
  },

  // Export des présences en CSV
  exportPresencesCSV() {
    const programme = Programmes.getById(this.currentProgrammeId);
    if (!programme || this.presencesData.length === 0) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }

    const dateDebut = programme.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);
    const dateStr = Utils.formatDate(dateDebut);
    
    const sep = ';';
    const escapeCsv = (val) => {
      if (val == null || val === '') return '';
      const s = String(val).replace(/"/g, '""');
      return /[;\r\n"]/.test(s) ? `"${s}"` : s;
    };
    
    const getStatutLabel = (statut) => {
      const labels = { present: 'Présent', absent: 'Absent', excuse: 'Excusé', non_renseigne: 'Non renseigné' };
      return labels[statut] || statut;
    };

    const headers = ['Prénom', 'Nom', 'Rôle', 'Statut', 'Commentaire'];
    const rows = this.presencesData.map(p => [
      escapeCsv(p.membre.prenom),
      escapeCsv(p.membre.nom),
      escapeCsv(Utils.getRoleLabel(p.membre.role)),
      escapeCsv(getStatutLabel(p.statut)),
      escapeCsv(p.commentaire)
    ].join(sep));

    const csv = '\uFEFF' + headers.join(sep) + '\r\n' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const fileName = `presences_${programme.nom.replace(/[^a-zA-Z0-9]/g, '_')}_${dateDebut.toISOString().slice(0, 10)}.csv`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success(`Export de ${this.presencesData.length} présence(s) réussi.`);
  },

  // Export des présences en PDF (téléchargement direct)
  async exportPresencesPDF() {
    const programme = Programmes.getById(this.currentProgrammeId);
    if (!programme || this.presencesData.length === 0) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }

    try {
      App.showLoading();
      await PDFExport.generateProgrammePresenceReport(this.presencesData, {
        programme: programme,
        famille: AppState.famille?.nom || ''
      });
      Toast.success('Téléchargement du PDF en cours.');
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
  }
};
