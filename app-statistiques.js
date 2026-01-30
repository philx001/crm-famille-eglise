// ============================================
// MODULE STATISTIQUES ET EXPORT PDF
// Phase 3 - Statistiques détaillées et exports
// ============================================

const Statistiques = {
  // Calculer les statistiques de présence
  async calculatePresenceStats(options = {}) {
    const {
      dateDebut = null,
      dateFin = null,
      typeProgramme = null,
      mentorId = null,
      membreId = null
    } = options;

    // Filtrer les programmes
    let programmes = AppState.programmes.filter(p => {
      if (!p.date_debut) return false;
      const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
      
      if (dateDebut && d < dateDebut) return false;
      if (dateFin && d > dateFin) return false;
      if (typeProgramme && p.type !== typeProgramme) return false;
      
      return true;
    });

    // Filtrer les membres
    let membres = AppState.membres.filter(m => m.statut_compte === 'actif');
    
    if (mentorId) {
      membres = membres.filter(m => m.mentor_id === mentorId);
    }
    if (membreId) {
      membres = membres.filter(m => m.id === membreId);
    }

    // Charger toutes les présences
    const allPresences = [];
    for (const prog of programmes) {
      const presences = await Presences.loadByProgramme(prog.id);
      allPresences.push(...presences.map(p => ({ ...p, programme: prog })));
    }

    // Calculer les stats globales
    const totalProgrammes = programmes.length;
    const totalMembres = membres.length;
    const totalPresencesAttendues = totalProgrammes * totalMembres;

    const presencesByStatut = {
      present: 0,
      absent: 0,
      excuse: 0,
      non_renseigne: 0
    };

    allPresences.forEach(p => {
      if (membres.find(m => m.id === p.disciple_id)) {
        presencesByStatut[p.statut]++;
      }
    });

    const tauxPresenceGlobal = totalPresencesAttendues > 0 
      ? Math.round((presencesByStatut.present / totalPresencesAttendues) * 100 * 10) / 10
      : 0;

    // Stats par type de programme
    const statsByType = {};
    Programmes.getTypes().forEach(type => {
      const progsOfType = programmes.filter(p => p.type === type.value);
      const presencesOfType = allPresences.filter(p => p.programme.type === type.value);
      const expectedOfType = progsOfType.length * totalMembres;
      const presentOfType = presencesOfType.filter(p => p.statut === 'present').length;

      if (progsOfType.length > 0) {
        statsByType[type.value] = {
          type: type.value,
          label: type.label,
          color: type.color,
          nbProgrammes: progsOfType.length,
          nbPresents: presentOfType,
          nbAttendus: expectedOfType,
          tauxPresence: expectedOfType > 0 ? Math.round((presentOfType / expectedOfType) * 100 * 10) / 10 : 0
        };
      }
    });

    // Stats par membre
    const statsByMembre = membres.map(membre => {
      const presencesMembre = allPresences.filter(p => p.disciple_id === membre.id);
      const presents = presencesMembre.filter(p => p.statut === 'present').length;
      const absents = presencesMembre.filter(p => p.statut === 'absent').length;
      const excuses = presencesMembre.filter(p => p.statut === 'excuse').length;
      const mentor = Membres.getById(membre.mentor_id);

      return {
        id: membre.id,
        nom: membre.nom,
        prenom: membre.prenom,
        nomComplet: `${membre.prenom} ${membre.nom}`,
        mentor: mentor ? `${mentor.prenom} ${mentor.nom}` : '-',
        mentorId: membre.mentor_id,
        nbPresences: presents,
        nbAbsences: absents,
        nbExcuses: excuses,
        nbTotal: totalProgrammes,
        tauxPresence: totalProgrammes > 0 ? Math.round((presents / totalProgrammes) * 100 * 10) / 10 : 0
      };
    }).sort((a, b) => b.tauxPresence - a.tauxPresence);

    // Évolution mensuelle
    const evolution = this.calculateMonthlyEvolution(programmes, allPresences, membres);

    return {
      periode: { dateDebut, dateFin },
      global: {
        totalProgrammes,
        totalMembres,
        totalPresencesAttendues,
        totalPresencesEffectives: presencesByStatut.present,
        totalAbsences: presencesByStatut.absent,
        totalExcuses: presencesByStatut.excuse,
        tauxPresenceGlobal
      },
      parType: Object.values(statsByType),
      parMembre: statsByMembre,
      evolution
    };
  },

  // Membres avec faible taux de présence (alertes absence)
  async getLowAttendanceMembers(seuilPourcent = 50, periodeJours = 30) {
    const dateFin = new Date();
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - periodeJours);

    const result = await this.calculatePresenceStats({
      dateDebut,
      dateFin
    });

    if (!result.parMembre || result.parMembre.length === 0) {
      return [];
    }

    // Dernier programme dans la période
    let dernierProgrammeDate = null;
    if (result.periode && AppState.programmes.length > 0) {
      const progsInPeriod = AppState.programmes.filter(p => {
        if (!p.date_debut) return false;
        const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
        return d >= dateDebut && d <= dateFin;
      });
      if (progsInPeriod.length > 0) {
        const dates = progsInPeriod.map(p => {
          const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
          return d.getTime();
        });
        dernierProgrammeDate = new Date(Math.max(...dates));
      }
    }

    return result.parMembre
      .filter(m => m.nbTotal >= 1 && m.tauxPresence < seuilPourcent)
      .map(m => ({
        ...m,
        dernierProgramme: dernierProgrammeDate
      }))
      .sort((a, b) => a.tauxPresence - b.tauxPresence);
  },

  // Calculer l'évolution mensuelle
  calculateMonthlyEvolution(programmes, presences, membres) {
    const monthlyData = {};

    programmes.forEach(prog => {
      const d = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          mois: monthKey,
          label: d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
          nbProgrammes: 0,
          nbPresences: 0,
          nbAttendus: 0
        };
      }
      
      monthlyData[monthKey].nbProgrammes++;
      monthlyData[monthKey].nbAttendus += membres.length;
    });

    presences.forEach(p => {
      const prog = p.programme;
      if (!prog) return;
      const d = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData[monthKey] && p.statut === 'present') {
        monthlyData[monthKey].nbPresences++;
      }
    });

    return Object.values(monthlyData)
      .map(m => ({
        ...m,
        tauxPresence: m.nbAttendus > 0 ? Math.round((m.nbPresences / m.nbAttendus) * 100 * 10) / 10 : 0
      }))
      .sort((a, b) => a.mois.localeCompare(b.mois));
  },

  // Calculer les statistiques par mentor (version simplifiée - utilise le cache)
  async calculateMentorStats() {
    const mentors = Membres.getMentors();
    if (mentors.length === 0) return [];
    
    const stats = [];

    // Utiliser les présences déjà en cache (pas de nouveaux appels Firestore)
    const cachedPresences = Presences.cache || {};
    const allPresences = [];
    
    // Récupérer toutes les présences depuis le cache
    Object.values(cachedPresences).forEach(presenceList => {
      if (Array.isArray(presenceList)) {
        allPresences.push(...presenceList);
      }
    });

    // Calculer les stats pour chaque mentor basé sur les présences en cache
    for (const mentor of mentors) {
      const disciples = Membres.getDisciples(mentor.id);
      const discipleIds = new Set(disciples.map(d => d.id));
      
      // Filtrer les présences pour les disciples de ce mentor
      const mentorPresences = allPresences.filter(p => discipleIds.has(p.disciple_id));
      
      const nbPresents = mentorPresences.filter(p => p.statut === 'present').length;
      const nbTotal = mentorPresences.length;
      const tauxPresence = nbTotal > 0 ? Math.round((nbPresents / nbTotal) * 100 * 10) / 10 : 0;

      stats.push({
        id: mentor.id,
        nom: mentor.nom,
        prenom: mentor.prenom,
        nomComplet: `${mentor.prenom} ${mentor.nom}`,
        nbDisciples: disciples.length,
        tauxPresence: tauxPresence
      });
    }

    return stats.sort((a, b) => b.tauxPresence - a.tauxPresence);
  },

  // Statistiques d'évolution des membres
  calculateMembresEvolution() {
    const membres = AppState.membres.filter(m => m.statut_compte === 'actif');
    const monthlyData = {};

    membres.forEach(m => {
      if (!m.created_at) return;
      const d = m.created_at.toDate ? m.created_at.toDate() : new Date(m.created_at);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          mois: monthKey,
          label: d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
          nouveaux: 0
        };
      }
      monthlyData[monthKey].nouveaux++;
    });

    // Calculer le cumul
    const sorted = Object.values(monthlyData).sort((a, b) => a.mois.localeCompare(b.mois));
    let cumul = 0;
    sorted.forEach(m => {
      cumul += m.nouveaux;
      m.total = cumul;
    });

    return sorted;
  }
};

// ============================================
// PAGES STATISTIQUES
// ============================================

const PagesStatistiques = {
  currentPeriode: 'trimestre',
  currentDateDebut: null,
  currentDateFin: null,
  stats: null,

  // Initialiser les dates selon la période
  initDates() {
    const now = new Date();
    
    switch (this.currentPeriode) {
      case 'semaine':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        this.currentDateDebut = startOfWeek;
        this.currentDateFin = now;
        break;
      case 'mois':
        this.currentDateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
        this.currentDateFin = now;
        break;
      case 'trimestre':
        const quarter = Math.floor(now.getMonth() / 3);
        this.currentDateDebut = new Date(now.getFullYear(), quarter * 3, 1);
        this.currentDateFin = now;
        break;
      case 'annee':
        this.currentDateDebut = new Date(now.getFullYear(), 0, 1);
        this.currentDateFin = now;
        break;
      default:
        this.currentDateDebut = null;
        this.currentDateFin = null;
    }
  },

  // Page principale des statistiques
  async renderStatistiques() {
    this.initDates();
    
    App.showLoading();
    this.stats = await Statistiques.calculatePresenceStats({
      dateDebut: this.currentDateDebut,
      dateFin: this.currentDateFin
    });
    App.hideLoading();

    const membresEvolution = Statistiques.calculateMembresEvolution();
    
    // Récupérer les alertes absence (membres avec < 50% de présence sur 30 jours)
    let alertesAbsence = [];
    try {
      alertesAbsence = await Statistiques.getLowAttendanceMembers(50, 30);
    } catch (error) {
      console.error('Erreur chargement alertes absence:', error);
    }

    return `
      <div class="stats-header">
        <div class="stats-filters">
          <select class="form-control" id="stats-periode" onchange="PagesStatistiques.changePeriode(this.value)">
            <option value="semaine" ${this.currentPeriode === 'semaine' ? 'selected' : ''}>Cette semaine</option>
            <option value="mois" ${this.currentPeriode === 'mois' ? 'selected' : ''}>Ce mois</option>
            <option value="trimestre" ${this.currentPeriode === 'trimestre' ? 'selected' : ''}>Ce trimestre</option>
            <option value="annee" ${this.currentPeriode === 'annee' ? 'selected' : ''}>Cette année</option>
            <option value="custom" ${this.currentPeriode === 'custom' ? 'selected' : ''}>Personnalisé</option>
          </select>
          <div id="custom-dates" style="display: ${this.currentPeriode === 'custom' ? 'flex' : 'none'}; gap: var(--spacing-sm);">
            <input type="date" class="form-control" id="stats-date-debut" 
                   value="${this.currentDateDebut ? this.currentDateDebut.toISOString().split('T')[0] : ''}"
                   onchange="PagesStatistiques.updateStats()">
            <input type="date" class="form-control" id="stats-date-fin"
                   value="${this.currentDateFin ? this.currentDateFin.toISOString().split('T')[0] : ''}"
                   onchange="PagesStatistiques.updateStats()">
          </div>
        </div>
        ${Permissions.canExportPDF() ? `
        <button class="btn btn-primary" onclick="PagesStatistiques.exportPDF()">
          <i class="fas fa-file-pdf"></i> Exporter PDF
        </button>
        ` : ''}
      </div>

      <!-- Cartes de résumé -->
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fas fa-calendar-check"></i></div>
          <div class="stat-content">
            <div class="stat-value">${this.stats.global.totalProgrammes}</div>
            <div class="stat-label">Programmes</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success"><i class="fas fa-user-check"></i></div>
          <div class="stat-content">
            <div class="stat-value">${this.stats.global.totalPresencesEffectives}</div>
            <div class="stat-label">Présences</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon danger"><i class="fas fa-user-times"></i></div>
          <div class="stat-content">
            <div class="stat-value">${this.stats.global.totalAbsences}</div>
            <div class="stat-label">Absences</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon info"><i class="fas fa-percentage"></i></div>
          <div class="stat-content">
            <div class="stat-value">${this.stats.global.tauxPresenceGlobal}%</div>
            <div class="stat-label">Taux global</div>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <!-- Graphique par type de programme -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-bar"></i> Présence par type de programme</h3>
          </div>
          <div class="card-body">
            ${this.renderBarChart(this.stats.parType)}
          </div>
        </div>

        <!-- Évolution mensuelle -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-line"></i> Évolution mensuelle</h3>
          </div>
          <div class="card-body">
            ${this.renderLineChart(this.stats.evolution)}
          </div>
        </div>
      </div>

      ${alertesAbsence.length > 0 ? `
      <!-- Alertes absence : membres à recontacter -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-clock"></i> Membres à recontacter</h3>
          <span class="badge badge-warning">${alertesAbsence.length} membre(s) &lt; 50 % présence (30 j)</span>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Mentor</th>
                  <th class="text-center">Présences</th>
                  <th class="text-center">Absences</th>
                  <th class="text-center">Taux</th>
                  <th>Dernier programme</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${alertesAbsence.map(a => `
                  <tr>
                    <td><strong>${Utils.escapeHtml(a.prenom)} ${Utils.escapeHtml(a.nom)}</strong></td>
                    <td>${Utils.escapeHtml(a.mentor)}</td>
                    <td class="text-center">${a.nbPresences}</td>
                    <td class="text-center">${a.nbAbsences}</td>
                    <td class="text-center"><span class="badge badge-danger">${a.tauxPresence} %</span></td>
                    <td>${a.dernierProgramme ? Utils.formatDate(a.dernierProgramme) : '-'}</td>
                    <td><button type="button" class="btn btn-sm btn-outline" onclick="App.viewMembre('${a.id}')" title="Voir le profil"><i class="fas fa-user"></i></button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Tableau détaillé par membre -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-users"></i> Détail par membre</h3>
          <div class="search-box" style="width: 250px;">
            <i class="fas fa-search"></i>
            <input type="text" class="form-control" placeholder="Rechercher..." 
                   onkeyup="PagesStatistiques.filterTable(this.value)">
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-container">
            <table class="table" id="stats-table">
              <thead>
                <tr>
                  <th onclick="PagesStatistiques.sortTable('nomComplet')">Membre ↕</th>
                  <th onclick="PagesStatistiques.sortTable('mentor')">Mentor ↕</th>
                  <th onclick="PagesStatistiques.sortTable('nbPresences')" class="text-center">Présences ↕</th>
                  <th onclick="PagesStatistiques.sortTable('nbAbsences')" class="text-center">Absences ↕</th>
                  <th onclick="PagesStatistiques.sortTable('nbExcuses')" class="text-center">Excusés ↕</th>
                  <th onclick="PagesStatistiques.sortTable('tauxPresence')" class="text-center">Taux ↕</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${this.stats.parMembre.map(m => `
                  <tr data-name="${m.nomComplet.toLowerCase()}">
                    <td><strong>${Utils.escapeHtml(m.nomComplet)}</strong></td>
                    <td class="text-muted">${Utils.escapeHtml(m.mentor)}</td>
                    <td class="text-center"><span class="badge badge-success">${m.nbPresences}</span></td>
                    <td class="text-center"><span class="badge badge-danger">${m.nbAbsences}</span></td>
                    <td class="text-center"><span class="badge badge-warning">${m.nbExcuses}</span></td>
                    <td class="text-center">
                      <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${m.tauxPresence}%; background: ${this.getTauxColor(m.tauxPresence)}"></div>
                        <span class="progress-text">${m.tauxPresence}%</span>
                      </div>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-secondary" onclick="App.viewHistoriqueMembre('${m.id}')" title="Historique">
                        <i class="fas fa-history"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${Permissions.hasRole('berger') ? `
      <!-- Statistiques par mentor -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-chalkboard-teacher"></i> Statistiques par mentor</h3>
        </div>
        <div class="card-body">
          ${this.renderMentorStatsSimple()}
        </div>
      </div>
      ` : ''}

      <style>
        .stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .stats-filters {
          display: flex;
          gap: var(--spacing-md);
          align-items: center;
          flex-wrap: wrap;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: var(--spacing-lg);
          margin-top: var(--spacing-lg);
        }
        .progress-bar-container {
          position: relative;
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
          height: 24px;
          overflow: hidden;
          min-width: 100px;
        }
        .progress-bar {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }
        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .table th {
          cursor: pointer;
          user-select: none;
        }
        .table th:hover {
          background: var(--bg-tertiary);
        }
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;
  },

  // Graphique en barres (CSS)
  renderBarChart(data) {
    if (!data || data.length === 0) {
      return '<div class="empty-state"><p>Aucune donnée disponible</p></div>';
    }

    const maxTaux = Math.max(...data.map(d => d.tauxPresence), 100);

    return `
      <div class="bar-chart">
        ${data.map(d => `
          <div class="bar-item">
            <div class="bar-label">${d.label}</div>
            <div class="bar-wrapper">
              <div class="bar" style="width: ${(d.tauxPresence / maxTaux) * 100}%; background: ${d.color}"></div>
              <span class="bar-value">${d.tauxPresence}%</span>
            </div>
            <div class="bar-meta">${d.nbProgrammes} prog.</div>
          </div>
        `).join('')}
      </div>
      <style>
        .bar-chart {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        .bar-item {
          display: grid;
          grid-template-columns: 150px 1fr 60px;
          align-items: center;
          gap: var(--spacing-md);
        }
        .bar-label {
          font-size: 0.85rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .bar-wrapper {
          position: relative;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          height: 28px;
          overflow: hidden;
        }
        .bar {
          height: 100%;
          border-radius: var(--radius-sm);
          transition: width 0.5s ease;
        }
        .bar-value {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.8rem;
          font-weight: 600;
        }
        .bar-meta {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: right;
        }
      </style>
    `;
  },

  // Graphique linéaire (CSS)
  renderLineChart(data) {
    if (!data || data.length === 0) {
      return '<div class="empty-state"><p>Aucune donnée disponible</p></div>';
    }

    const maxTaux = Math.max(...data.map(d => d.tauxPresence), 100);

    return `
      <div class="line-chart">
        <div class="chart-area">
          ${data.map((d, i) => `
            <div class="chart-point" style="left: ${(i / (data.length - 1 || 1)) * 100}%; bottom: ${(d.tauxPresence / maxTaux) * 100}%;">
              <div class="point-dot"></div>
              <div class="point-tooltip">
                <strong>${d.label}</strong><br>
                ${d.tauxPresence}%
              </div>
            </div>
          `).join('')}
          <svg class="chart-line" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points="${data.map((d, i) => 
              `${(i / (data.length - 1 || 1)) * 100},${100 - (d.tauxPresence / maxTaux) * 100}`
            ).join(' ')}" fill="none" stroke="var(--primary)" stroke-width="0.5"/>
          </svg>
        </div>
        <div class="chart-labels">
          ${data.map(d => `
            <div class="chart-label">${d.mois.split('-')[1]}/${d.mois.split('-')[0].slice(2)}</div>
          `).join('')}
        </div>
      </div>
      <style>
        .line-chart {
          padding: var(--spacing-md);
        }
        .chart-area {
          position: relative;
          height: 200px;
          border-left: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
          margin-bottom: var(--spacing-sm);
        }
        .chart-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .chart-point {
          position: absolute;
          transform: translate(-50%, 50%);
          z-index: 1;
        }
        .point-dot {
          width: 10px;
          height: 10px;
          background: var(--primary);
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: var(--shadow-sm);
        }
        .point-tooltip {
          display: none;
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--text-primary);
          color: white;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          white-space: nowrap;
          z-index: 10;
        }
        .chart-point:hover .point-tooltip {
          display: block;
        }
        .chart-labels {
          display: flex;
          justify-content: space-between;
        }
        .chart-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
      </style>
    `;
  },

  // Stats par mentor - version simplifiée et synchrone
  renderMentorStatsSimple() {
    const mentors = Membres.getMentors();
    if (mentors.length === 0) {
      return '<div class="text-muted text-center py-3"><i class="fas fa-info-circle"></i> Aucun mentor trouvé.</div>';
    }
    
    const stats = mentors.map(mentor => {
      const disciples = Membres.getDisciples(mentor.id);
      return {
        id: mentor.id,
        nom: mentor.nom,
        prenom: mentor.prenom,
        nomComplet: `${mentor.prenom} ${mentor.nom}`,
        nbDisciples: disciples.length,
        tauxPresence: 0 // Sera calculé si des présences sont en cache
      };
    }).sort((a, b) => b.nbDisciples - a.nbDisciples);
    
    return this.renderMentorStats(stats);
  },

  // Stats par mentor
  renderMentorStats(stats) {
    return `
      <div class="mentor-stats-grid">
        ${stats.map(m => `
          <div class="mentor-stat-card">
            <div class="mentor-info">
              <div class="member-avatar" style="background: var(--primary); width: 45px; height: 45px;">
                ${Utils.getInitials(m.prenom, m.nom)}
              </div>
              <div>
                <div class="mentor-name">${Utils.escapeHtml(m.nomComplet)}</div>
                <div class="text-muted">${m.nbDisciples} disciple${m.nbDisciples > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div class="mentor-taux">
              <div class="taux-value" style="color: ${this.getTauxColor(m.tauxPresence)}">${m.tauxPresence}%</div>
              <div class="taux-label">Taux présence</div>
            </div>
          </div>
        `).join('')}
      </div>
      <style>
        .mentor-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--spacing-md);
        }
        .mentor-stat-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          background: var(--bg-primary);
          border-radius: var(--radius-md);
        }
        .mentor-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        .mentor-name {
          font-weight: 600;
        }
        .mentor-taux {
          text-align: right;
        }
        .taux-value {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .taux-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
      </style>
    `;
  },

  // Couleur selon le taux
  getTauxColor(taux) {
    if (taux >= 80) return 'var(--success)';
    if (taux >= 60) return 'var(--warning)';
    return 'var(--danger)';
  },

  // Changer la période
  async changePeriode(periode) {
    this.currentPeriode = periode;
    
    const customDates = document.getElementById('custom-dates');
    if (periode === 'custom') {
      customDates.style.display = 'flex';
    } else {
      customDates.style.display = 'none';
      await this.updateStats();
    }
  },

  // Mettre à jour les stats
  async updateStats() {
    if (this.currentPeriode === 'custom') {
      const debut = document.getElementById('stats-date-debut').value;
      const fin = document.getElementById('stats-date-fin').value;
      if (debut) this.currentDateDebut = new Date(debut);
      if (fin) this.currentDateFin = new Date(fin);
    } else {
      this.initDates();
    }

    document.querySelector('.page-content').innerHTML = await this.renderStatistiques();
  },

  // Filtrer le tableau
  filterTable(search) {
    const rows = document.querySelectorAll('#stats-table tbody tr');
    search = search.toLowerCase();
    
    rows.forEach(row => {
      const name = row.dataset.name || '';
      row.style.display = name.includes(search) ? '' : 'none';
    });
  },

  // Trier le tableau
  currentSort: { column: null, asc: true },
  
  sortTable(column) {
    if (this.currentSort.column === column) {
      this.currentSort.asc = !this.currentSort.asc;
    } else {
      this.currentSort.column = column;
      this.currentSort.asc = true;
    }

    this.stats.parMembre.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];
      
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      
      if (valA < valB) return this.currentSort.asc ? -1 : 1;
      if (valA > valB) return this.currentSort.asc ? 1 : -1;
      return 0;
    });

    // Re-render le tableau
    const tbody = document.querySelector('#stats-table tbody');
    tbody.innerHTML = this.stats.parMembre.map(m => `
      <tr data-name="${m.nomComplet.toLowerCase()}">
        <td><strong>${Utils.escapeHtml(m.nomComplet)}</strong></td>
        <td class="text-muted">${Utils.escapeHtml(m.mentor)}</td>
        <td class="text-center"><span class="badge badge-success">${m.nbPresences}</span></td>
        <td class="text-center"><span class="badge badge-danger">${m.nbAbsences}</span></td>
        <td class="text-center"><span class="badge badge-warning">${m.nbExcuses}</span></td>
        <td class="text-center">
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${m.tauxPresence}%; background: ${this.getTauxColor(m.tauxPresence)}"></div>
            <span class="progress-text">${m.tauxPresence}%</span>
          </div>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="App.viewHistoriqueMembre('${m.id}')" title="Historique">
            <i class="fas fa-history"></i>
          </button>
        </td>
      </tr>
    `).join('');
  },

  // Export PDF
  async exportPDF() {
    Toast.info('Génération du PDF en cours...');
    
    try {
      const pdf = await PDFExport.generatePresenceReport(this.stats, {
        dateDebut: this.currentDateDebut,
        dateFin: this.currentDateFin,
        famille: AppState.famille.nom
      });
      
      // Télécharger le PDF
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-presences-${AppState.famille.nom}-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      Toast.success('PDF téléchargé !');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      Toast.error('Erreur lors de la génération du PDF');
    }
  }
};
