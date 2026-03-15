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

    // Filtrer les programmes (uniquement ceux avec pointage requis, exclus des stats)
    let programmes = AppState.programmes.filter(p => {
      if (!p.date_debut) return false;
      if (!Programmes.pointageRequis(p)) return false; // Exclure les programmes sans pointage
      const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
      
      if (dateDebut && d < dateDebut) return false;
      if (dateFin && d > dateFin) return false;
      if (typeProgramme && p.type !== typeProgramme) return false;
      
      return true;
    });

    // Filtrer les membres (adjoints superviseur exclus : comptes de service)
    let membres = AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur'
    );
    
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

    // totalPresencesAttendues = somme des programmes où chaque membre était déjà dans la famille
    let totalPresencesAttendues = 0;
    const totalProgrammes = programmes.length;
    const totalMembres = membres.length;

    membres.forEach(m => {
      programmes.forEach(prog => {
        const dProg = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut);
        if (Utils.membreEtaitDansFamilleALaDate(m, dProg)) totalPresencesAttendues++;
      });
    });

    const presencesByStatut = {
      present: 0,
      absent: 0,
      excuse: 0,
      non_renseigne: 0
    };

    allPresences.forEach(p => {
      const membre = membres.find(m => m.id === p.disciple_id);
      if (membre && Utils.membreEtaitDansFamilleALaDate(membre, p.programme?.date_debut)) {
        presencesByStatut[p.statut]++;
      }
    });

    const tauxPresenceGlobal = totalPresencesAttendues > 0 
      ? Math.round((presencesByStatut.present / totalPresencesAttendues) * 100 * 10) / 10
      : 0;

    // Stats par type de programme (ne compter que les présences attendues par membre)
    const membreIds = new Set(membres.map(m => m.id));
    const statsByType = {};
    Programmes.getTypes().forEach(type => {
      const progsOfType = programmes.filter(p => p.type === type.value);
      let expectedOfType = 0;
      membres.forEach(m => {
        progsOfType.forEach(prog => {
          const dProg = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut);
          if (Utils.membreEtaitDansFamilleALaDate(m, dProg)) expectedOfType++;
        });
      });
      const presencesOfType = allPresences.filter(p => 
        p.programme.type === type.value && 
        membreIds.has(p.disciple_id) && 
        Utils.membreEtaitDansFamilleALaDate(membres.find(x => x.id === p.disciple_id), p.programme?.date_debut)
      );
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

    // Stats par membre (nbTotal = programmes où le membre était attendu)
    const statsByMembre = membres.map(membre => {
      const programmesAttendus = programmes.filter(prog => {
        const dProg = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut);
        return Utils.membreEtaitDansFamilleALaDate(membre, dProg);
      });
      const nbTotal = programmesAttendus.length;
      const presencesMembre = allPresences.filter(p => 
        p.disciple_id === membre.id && 
        Utils.membreEtaitDansFamilleALaDate(membre, p.programme?.date_debut)
      );
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
        nbTotal,
        tauxPresence: nbTotal > 0 ? Math.round((presents / nbTotal) * 100 * 10) / 10 : 0
      };
    }).sort((a, b) => b.tauxPresence - a.tauxPresence);

    // Évolution mensuelle (avec filtrage par date d'entrée)
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
  async getLowAttendanceMembers(seuilPourcent = 50, periodeJours = 30, mentorId = null) {
    const dateFin = new Date();
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - periodeJours);

    const result = await this.calculatePresenceStats({
      dateDebut,
      dateFin,
      mentorId
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

  // Calculer l'évolution mensuelle (nbAttendus = membres attendus par programme, filtrés par date d'entrée)
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
      membres.forEach(m => {
        if (Utils.membreEtaitDansFamilleALaDate(m, d)) monthlyData[monthKey].nbAttendus++;
      });
    });

    const membreIdsEvolution = new Set(membres.map(m => m.id));
    presences.forEach(p => {
      const prog = p.programme;
      if (!prog) return;
      const membre = membres.find(m => m.id === p.disciple_id);
      if (!membre || !Utils.membreEtaitDansFamilleALaDate(membre, prog.date_debut)) return;
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
        nomComplet: `${mentor.prenom} ${mentor.nom}${mentor.role === 'admin' ? ' (Admin)' : ''}`,
        nbDisciples: disciples.length,
        tauxPresence: tauxPresence
      });
    }

    return stats.sort((a, b) => b.tauxPresence - a.tauxPresence);
  },

  // Calculer les stats par mentor à partir de parMembre (résultat de calculatePresenceStats)
  // pour la période déjà chargée sur la page Statistiques
  calculateMentorStatsFromParMembre(parMembre) {
    if (!parMembre || parMembre.length === 0) return [];
    const mentors = Membres.getMentors();
    if (mentors.length === 0) return [];
    const stats = mentors.map(mentor => {
      const disciples = Membres.getDisciples(mentor.id);
      const discipleIds = new Set(disciples.map(d => d.id));
      const membresMentor = parMembre.filter(m => discipleIds.has(m.id));
      const totalPresences = membresMentor.reduce((s, m) => s + (m.nbTotal || 0), 0);
      const totalPresents = membresMentor.reduce((s, m) => s + (m.nbPresences || 0), 0);
      const tauxPresence = totalPresences > 0
        ? Math.round((totalPresents / totalPresences) * 100 * 10) / 10
        : 0;
      return {
        id: mentor.id,
        nom: mentor.nom,
        prenom: mentor.prenom,
        nomComplet: `${mentor.prenom} ${mentor.nom}${mentor.role === 'admin' ? ' (Admin)' : ''}`,
        nbDisciples: disciples.length,
        tauxPresence
      };
    });
    return stats.sort((a, b) => b.nbDisciples - a.nbDisciples);
  },

  // Répartition des membres par mentor (tous rôles) en proportion du total famille
  getRepartitionMentorsData() {
    const actifs = AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur'
    );
    const totalFamille = actifs.length;
    const mentorsPourRepartition = actifs.filter(m =>
      ['mentor', 'superviseur', 'admin'].includes(m.role)
    );
    const parMentor = mentorsPourRepartition.map(m => {
      const nbDansGroupe = Membres.getDisciples(m.id).length;
      const proportion = totalFamille > 0 ? Math.round((nbDansGroupe / totalFamille) * 1000) / 10 : 0;
      return {
        mentorId: m.id,
        mentorName: `${m.prenom} ${m.nom}${m.role === 'admin' ? ' (Admin)' : ''}`,
        nbDansGroupe,
        proportion
      };
    }).sort((a, b) => b.nbDansGroupe - a.nbDansGroupe);

    return { totalFamille, parMentor };
  },

  // Statistiques d'évolution des membres (optionnellement limitées aux disciples d'un mentor)
  calculateMembresEvolution(mentorId = null) {
    let membres = AppState.membres.filter(m => m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur');
    if (mentorId) {
      membres = membres.filter(m => m.mentor_id === mentorId);
    }
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
  },

  // Statistiques de profil famille (sexe, âge, ancienneté) - basées sur les données saisies par les membres
  getProfilFamilleStats() {
    const actifs = AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur'
    );
    const total = actifs.length;

    // Sexe
    const hommes = actifs.filter(m => m.sexe === 'M').length;
    const femmes = actifs.filter(m => m.sexe === 'F').length;
    const sexeNonRenseigne = actifs.filter(m => !m.sexe || (m.sexe !== 'M' && m.sexe !== 'F')).length;
    const totalAvecSexe = hommes + femmes;

    // Tranches d'âge : 18-25, 26-35, 36-45, 46-60, +60 (et "Moins de 18 ans" pour exhaustivité)
    const tranchesAge = [
      { key: 'moins18', label: 'Moins de 18 ans', min: 0, max: 17 },
      { key: '18-25', label: '18-25 ans', min: 18, max: 25 },
      { key: '26-35', label: '26-35 ans', min: 26, max: 35 },
      { key: '36-45', label: '36-45 ans', min: 36, max: 45 },
      { key: '46-60', label: '46-60 ans', min: 46, max: 60 },
      { key: 'plus60', label: '+ de 60 ans', min: 61, max: 150 }
    ];
    const today = new Date();
    const ageByTranche = tranchesAge.map(t => ({ ...t, count: 0 }));
    let ageNonRenseigne = 0;
    actifs.forEach(m => {
      const d = m.date_naissance ? (m.date_naissance.toDate ? m.date_naissance.toDate() : new Date(m.date_naissance)) : null;
      if (!d || isNaN(d.getTime())) {
        ageNonRenseigne++;
        return;
      }
      const age = Math.floor((today - d) / (365.25 * 24 * 60 * 60 * 1000));
      const tranche = tranchesAge.find(t => age >= t.min && age <= t.max);
      if (tranche) {
        const entry = ageByTranche.find(x => x.key === tranche.key);
        if (entry) entry.count++;
      }
    });
    const totalAvecAge = actifs.length - ageNonRenseigne;

    // Ancienneté : moins de 1 an ; 1-3 ans ; 3-5 ans ; 5-10 ans ; +10 ans
    const tranchesAnciennete = [
      { key: 'moins1', label: 'Moins de 1 an', min: 0, max: 0.999 },
      { key: '1-3', label: '1-3 ans', min: 1, max: 2.999 },
      { key: '3-5', label: '3-5 ans', min: 3, max: 4.999 },
      { key: '5-10', label: '5-10 ans', min: 5, max: 9.999 },
      { key: 'plus10', label: '+ 10 ans', min: 10, max: 999 }
    ];
    const ancienneteByTranche = tranchesAnciennete.map(t => ({ ...t, count: 0 }));
    let ancienneteNonRenseigne = 0;
    actifs.forEach(m => {
      const d = m.date_arrivee_icc ? (m.date_arrivee_icc.toDate ? m.date_arrivee_icc.toDate() : new Date(m.date_arrivee_icc)) : null;
      if (!d || isNaN(d.getTime())) {
        ancienneteNonRenseigne++;
        return;
      }
      const annees = (today - d) / (365.25 * 24 * 60 * 60 * 1000);
      const tranche = tranchesAnciennete.find(t => annees >= t.min && annees <= t.max);
      if (tranche) {
        const entry = ancienneteByTranche.find(x => x.key === tranche.key);
        if (entry) entry.count++;
      }
    });
    const totalAvecAnciennete = actifs.length - ancienneteNonRenseigne;

    return {
      total,
      sexe: {
        hommes,
        femmes,
        nonRenseigne: sexeNonRenseigne,
        totalAvecSexe,
        pctHommes: totalAvecSexe > 0 ? Math.round((hommes / totalAvecSexe) * 1000) / 10 : 0,
        pctFemmes: totalAvecSexe > 0 ? Math.round((femmes / totalAvecSexe) * 1000) / 10 : 0,
        pctNonRenseigne: total > 0 ? Math.round((sexeNonRenseigne / total) * 1000) / 10 : 0
      },
      age: {
        tranches: ageByTranche.map(t => ({
          ...t,
          proportion: totalAvecAge > 0 ? Math.round((t.count / totalAvecAge) * 1000) / 10 : 0
        })),
        nonRenseigne: ageNonRenseigne,
        totalAvecAge,
        pctNonRenseigne: total > 0 ? Math.round((ageNonRenseigne / total) * 1000) / 10 : 0
      },
      anciennete: {
        tranches: ancienneteByTranche.map(t => ({
          ...t,
          proportion: totalAvecAnciennete > 0 ? Math.round((t.count / totalAvecAnciennete) * 1000) / 10 : 0
        })),
        nonRenseigne: ancienneteNonRenseigne,
        totalAvecAnciennete,
        pctNonRenseigne: total > 0 ? Math.round((ancienneteNonRenseigne / total) * 1000) / 10 : 0
      }
    };
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

    const isMentorView = AppState.user && AppState.user.role === 'mentor' && !Permissions.hasRole('adjoint_superviseur');
    const mentorIdForStats = isMentorView ? AppState.user.id : null;
    
    App.showLoading();
    this.stats = await Statistiques.calculatePresenceStats({
      dateDebut: this.currentDateDebut,
      dateFin: this.currentDateFin,
      mentorId: mentorIdForStats
    });
    App.hideLoading();

    const membresEvolution = Statistiques.calculateMembresEvolution(mentorIdForStats);
    
    // Récupérer les alertes absence (membres avec < 50% de présence sur 30 jours)
    let alertesAbsence = [];
    try {
      alertesAbsence = await Statistiques.getLowAttendanceMembers(50, 30, mentorIdForStats);
    } catch (error) {
      console.error('Erreur chargement alertes absence:', error);
    }
    this.alertesAbsence = alertesAbsence;

    return `
      ${isMentorView ? '<p class="text-muted" style="margin-bottom: var(--spacing-md);"><i class="fas fa-users"></i> Statistiques limitées à vos disciples et nouveaux.</p>' : ''}
      <div class="stats-header">
        <div class="stats-filters">
          <select class="form-control" id="stats-periode" onchange="PagesStatistiques.changePeriode(this.value)">
            <option value="semaine" ${this.currentPeriode === 'semaine' ? 'selected' : ''}>Cette semaine</option>
            <option value="mois" ${this.currentPeriode === 'mois' ? 'selected' : ''}>Ce mois</option>
            <option value="trimestre" ${this.currentPeriode === 'trimestre' ? 'selected' : ''}>Ce trimestre</option>
            <option value="annee" ${this.currentPeriode === 'annee' ? 'selected' : ''}>Cette année</option>
            <option value="custom" ${this.currentPeriode === 'custom' ? 'selected' : ''}>Personnalisé</option>
          </select>
          <div id="custom-dates" style="display: ${this.currentPeriode === 'custom' ? 'flex' : 'none'}; gap: var(--spacing-sm); align-items: center;">
            <input type="date" class="form-control input-date" id="stats-date-debut" 
                   min="${Utils.getDateFilterBounds().min}" max="${Utils.getDateFilterBounds().max}"
                   value="${this.currentDateDebut ? this.currentDateDebut.toISOString().split('T')[0] : ''}"
                   title="Cliquez pour ouvrir le calendrier" onchange="PagesStatistiques.updateStats()">
            <input type="date" class="form-control input-date" id="stats-date-fin"
                   min="${Utils.getDateFilterBounds().min}" max="${Utils.getDateFilterBounds().max}"
                   value="${this.currentDateFin ? this.currentDateFin.toISOString().split('T')[0] : ''}"
                   title="Cliquez pour ouvrir le calendrier" onchange="PagesStatistiques.updateStats()">
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

      <!-- Graphique interactif : Répartition présences -->
      <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-pie"></i> Répartition des présences</h3>
          </div>
          <div class="card-body" style="min-height: 250px;">
            <canvas id="chart-stats-repartition"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-bar"></i> Taux par type de programme</h3>
          </div>
          <div class="card-body" style="min-height: 250px;">
            <canvas id="chart-stats-type"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-line"></i> Évolution mensuelle</h3>
          </div>
          <div class="card-body" style="min-height: 250px;">
            <canvas id="chart-stats-evolution"></canvas>
          </div>
        </div>
      </div>

      ${alertesAbsence.length > 0 ? `
      <!-- Alertes absence : membres à recontacter -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-clock"></i> Membres à recontacter</h3>
          <span class="badge badge-warning">${alertesAbsence.length} membre(s) &lt; 50 % présence (30 j)</span>
          <button type="button" class="btn btn-sm btn-outline" onclick="PagesStatistiques.exportAlertesCSV()" title="Exporter en CSV">
            <i class="fas fa-file-csv"></i> Exporter CSV
          </button>
          ${Permissions.canExportPDF() ? `
          <button type="button" class="btn btn-sm btn-outline" onclick="PagesStatistiques.exportAlertesPDF()" title="Exporter en PDF">
            <i class="fas fa-file-pdf"></i> Exporter PDF
          </button>
          ` : ''}
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

      <!-- Tableau détaillé par membre (accordéon) -->
      <div class="card mt-3 stats-accordion-card">
        <div class="card-header stats-accordion-header" onclick="PagesStatistiques.toggleDetailMembres()" role="button" tabindex="0" onkeydown="if(event.key==='Enter')PagesStatistiques.toggleDetailMembres()">
          <h3 class="card-title"><i class="fas fa-users"></i> Détail par membre <span class="badge badge-secondary" style="font-weight: 600;">${(this.stats.parMembre || []).length}</span></h3>
          <div class="stats-accordion-actions">
            <div class="search-box" style="width: 250px;" onclick="event.stopPropagation()">
              <i class="fas fa-search"></i>
              <input type="text" class="form-control" placeholder="Rechercher..." 
                     onkeyup="PagesStatistiques.filterTable(this.value)">
            </div>
            <button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); PagesStatistiques.exportDetailMembreCSV();" title="Exporter en CSV">
              <i class="fas fa-file-csv"></i> Exporter CSV
            </button>
            ${Permissions.canExportPDF() ? `
            <button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); PagesStatistiques.exportPDF();" title="Exporter le rapport en PDF">
              <i class="fas fa-file-pdf"></i> Exporter PDF
            </button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-outline stats-accordion-toggle" id="stats-detail-toggle" title="Afficher / masquer le détail">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </div>
        <div class="card-body stats-accordion-body" id="stats-detail-body" style="padding: 0; display: none;">
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

      ${(Permissions.hasRole('superviseur') || Permissions.isAdmin()) ? `
      <!-- Répartition des membres par mentor (superviseur + admin uniquement) -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-users-cog"></i> Répartition des membres par mentor <span class="badge badge-secondary" style="font-weight: 600;">${this.stats.global.totalMembres} membre${this.stats.global.totalMembres !== 1 ? 's' : ''}</span></h3>
          <span class="badge badge-secondary">Proportion de la famille</span>
        </div>
        <div class="card-body">
          ${this.renderRepartitionMentorsSection()}
        </div>
      </div>
      ` : ''}

      ${Permissions.hasRole('mentor') && !Permissions.hasRole('superviseur') && !Permissions.isAdmin() ? `
      <!-- Votre groupe (mentor uniquement : proportion de son groupe sur la famille) -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-friends"></i> Votre groupe</h3>
        </div>
        <div class="card-body">
          ${this.renderMonGroupeSection()}
        </div>
      </div>
      ` : ''}

      ${Permissions.hasRole('superviseur') ? `
      <!-- Statistiques par mentor (taux = présence des disciples sur la période choisie) -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-chalkboard-teacher"></i> Statistiques par mentor</h3>
          <span class="text-muted" style="font-size: 0.85rem; font-weight: normal;">Taux de présence des disciples sur la période</span>
        </div>
        <div class="card-body">
          ${this.stats && this.stats.parMembre ? this.renderMentorStats(Statistiques.calculateMentorStatsFromParMembre(this.stats.parMembre)) : this.renderMentorStatsSimple()}
        </div>
      </div>
      ` : ''}

      <!-- Profil de la famille (sexe, âge, ancienneté - données des profils membres) -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-id-card"></i> Profil de la famille</h3>
          <span class="badge badge-secondary">Données saisies dans les profils</span>
        </div>
        <div class="card-body">
          ${this.renderProfilFamilleSection()}
        </div>
      </div>

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
        .stats-accordion-header {
          cursor: pointer;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }
        .stats-accordion-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .stats-accordion-toggle i {
          transition: transform 0.2s ease;
        }
        .stats-accordion-card.expanded .stats-accordion-toggle i {
          transform: rotate(180deg);
        }
        .btn-scroll-top {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: var(--shadow-md);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .btn-scroll-top:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <!-- Bouton remonter en haut -->
      <button type="button" class="btn-scroll-top" id="stats-scroll-top" onclick="PagesStatistiques.scrollToTop()" title="Remonter en haut" aria-label="Remonter en haut">
        <i class="fas fa-arrow-up"></i>
      </button>
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

  // Données pour la répartition (délègue à Statistiques)
  getRepartitionMentorsData() {
    return Statistiques.getRepartitionMentorsData();
  },

  // Section "Répartition des membres par mentor" (visible superviseur + admin uniquement)
  renderRepartitionMentorsSection() {
    const { totalFamille, parMentor } = this.getRepartitionMentorsData();
    if (parMentor.length === 0) {
      return '<div class="text-muted text-center py-3"><i class="fas fa-info-circle"></i> Aucun mentor dans la famille.</div>';
    }
    return `
      <div class="repartition-mentors-table">
        <table class="table">
          <thead>
            <tr>
              <th>Mentor / Berger</th>
              <th class="text-center">Membres dans le groupe</th>
              <th class="text-center">Proportion de la famille</th>
            </tr>
          </thead>
          <tbody>
            ${parMentor.map(m => `
              <tr>
                <td><strong>${Utils.escapeHtml(m.mentorName)}</strong></td>
                <td class="text-center">${m.nbDansGroupe}</td>
                <td class="text-center">
                  <div class="proportion-bar-wrap">
                    <div class="proportion-bar" style="width: ${m.proportion}%;"></div>
                    <span class="proportion-text">${m.nbDansGroupe} / ${totalFamille} = ${m.proportion}%</span>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="repartition-total text-muted mt-2"><strong>Total famille :</strong> ${totalFamille} membre(s) actif(s)</div>
      </div>
      <style>
        .repartition-mentors-table .proportion-bar-wrap {
          position: relative;
          display: inline-block;
          width: 100%;
          max-width: 200px;
          height: 24px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .repartition-mentors-table .proportion-bar {
          height: 100%;
          background: var(--primary);
          border-radius: var(--radius-full);
          min-width: 0;
        }
        .repartition-mentors-table .proportion-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary);
          text-shadow: 0 0 2px white;
        }
      </style>
    `;
  },

  // Section "Votre groupe" (visible mentor uniquement, pas superviseur ni admin)
  renderMonGroupeSection() {
    const { totalFamille, parMentor } = this.getRepartitionMentorsData();
    const monEntree = parMentor.find(m => m.mentorId === AppState.user.id);
    if (!monEntree || totalFamille === 0) {
      return '<div class="text-muted text-center py-3"><i class="fas fa-info-circle"></i> Aucune donnée pour votre groupe.</div>';
    }
    return `
      <div class="mon-groupe-card">
        <div class="mon-groupe-value">${monEntree.nbDansGroupe} membre${monEntree.nbDansGroupe > 1 ? 's' : ''} sur ${totalFamille} (${monEntree.proportion}% de la famille)</div>
        <div class="mon-groupe-proportion">
          <div class="proportion-bar-wrap">
            <div class="proportion-bar" style="width: ${monEntree.proportion}%;"></div>
            <span class="proportion-text">${monEntree.proportion}% de la famille</span>
          </div>
        </div>
      </div>
      <style>
        .mon-groupe-card {
          padding: var(--spacing-lg);
          background: var(--bg-primary);
          border-radius: var(--radius-md);
        }
        .mon-groupe-value {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: var(--spacing-sm);
        }
        .mon-groupe-card .proportion-bar-wrap {
          position: relative;
          height: 28px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .mon-groupe-card .proportion-bar {
          height: 100%;
          background: var(--primary);
          border-radius: var(--radius-full);
        }
        .mon-groupe-card .proportion-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          text-shadow: 0 0 2px white;
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
        nomComplet: `${mentor.prenom} ${mentor.nom}${mentor.role === 'admin' ? ' (Admin)' : ''}`,
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

  // Section Profil de la famille (sexe, âge, ancienneté) - camemberts + légende avec % distincts
  renderProfilFamilleSection() {
    const data = Statistiques.getProfilFamilleStats();
    if (data.total === 0) {
      return '<div class="text-muted text-center py-3"><i class="fas fa-info-circle"></i> Aucun membre actif dans la famille.</div>';
    }

    const s = data.sexe;
    const a = data.age;
    const anc = data.anciennete;

    // Tranches d'âge à afficher : 18-25, 26-35, 36-45, 46-60, +60 (et "Moins de 18 ans" si pertinent)
    const tranchesAgeAffichees = a.tranches.filter(t => t.key !== 'moins18' || t.count > 0);

    return `
      <div class="profil-famille-grid">
        <!-- Sexe -->
        <div class="profil-famille-block">
          <h4 class="profil-famille-title"><i class="fas fa-venus-mars"></i> Répartition hommes / femmes</h4>
          <div class="profil-famille-chart-wrap">
            <canvas id="chart-profil-sexe" height="180"></canvas>
          </div>
          <div class="profil-famille-legend">
            <div class="profil-legend-item"><span class="profil-legend-dot" style="background: var(--primary);"></span> Hommes : <strong>${s.pctHommes}%</strong> (${s.hommes})</div>
            <div class="profil-legend-item"><span class="profil-legend-dot" style="background: #E91E63;"></span> Femmes : <strong>${s.pctFemmes}%</strong> (${s.femmes})</div>
          </div>
          ${s.nonRenseigne > 0 ? `
          <div class="profil-non-renseigne">
            <i class="fas fa-exclamation-circle"></i> Non renseigné : ${s.nonRenseigne} personne${s.nonRenseigne > 1 ? 's' : ''} (${s.pctNonRenseigne}% du total)
          </div>
          ` : ''}
        </div>

        <!-- Tranches d'âge -->
        <div class="profil-famille-block">
          <h4 class="profil-famille-title"><i class="fas fa-birthday-cake"></i> Tranches d'âge</h4>
          <div class="profil-famille-chart-wrap">
            <canvas id="chart-profil-age" height="180"></canvas>
          </div>
          <div class="profil-famille-legend">
            ${tranchesAgeAffichees.map((t, i) => {
              const colors = ['#2D5A7B', '#4CAF50', '#FF9800', '#9C27B0', '#2196F3', '#E91E63'];
              return `<div class="profil-legend-item"><span class="profil-legend-dot" style="background: ${colors[i % colors.length]};"></span> ${Utils.escapeHtml(t.label)} : <strong>${t.proportion}%</strong> (${t.count})</div>`;
            }).join('')}
          </div>
          ${a.nonRenseigne > 0 ? `
          <div class="profil-non-renseigne">
            <i class="fas fa-exclamation-circle"></i> Non renseigné : ${a.nonRenseigne} personne${a.nonRenseigne > 1 ? 's' : ''} (${a.pctNonRenseigne}% du total)
          </div>
          ` : ''}
        </div>

        <!-- Ancienneté -->
        <div class="profil-famille-block">
          <h4 class="profil-famille-title"><i class="fas fa-calendar-alt"></i> Ancienneté (arrivée ICC)</h4>
          <div class="profil-famille-chart-wrap">
            <canvas id="chart-profil-anciennete" height="180"></canvas>
          </div>
          <div class="profil-famille-legend">
            ${anc.tranches.map((t, i) => {
              const colors = ['#2D5A7B', '#4CAF50', '#FF9800', '#9C27B0', '#2196F3'];
              return `<div class="profil-legend-item"><span class="profil-legend-dot" style="background: ${colors[i % colors.length]};"></span> ${Utils.escapeHtml(t.label)} : <strong>${t.proportion}%</strong> (${t.count})</div>`;
            }).join('')}
          </div>
          ${anc.nonRenseigne > 0 ? `
          <div class="profil-non-renseigne">
            <i class="fas fa-exclamation-circle"></i> Non renseigné : ${anc.nonRenseigne} personne${anc.nonRenseigne > 1 ? 's' : ''} (${anc.pctNonRenseigne}% du total)
          </div>
          ` : ''}
        </div>
      </div>
      <style>
        .profil-famille-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--spacing-lg);
        }
        .profil-famille-block {
          padding: var(--spacing-md);
          background: var(--bg-primary);
          border-radius: var(--radius-md);
        }
        .profil-famille-title {
          font-size: 0.95rem;
          font-weight: 600;
          margin-bottom: var(--spacing-md);
          color: var(--text-primary);
        }
        .profil-famille-chart-wrap {
          position: relative;
          height: 180px;
          margin-bottom: var(--spacing-md);
        }
        .profil-famille-legend {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          font-size: 0.9rem;
          color: var(--text-primary);
        }
        .profil-legend-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }
        .profil-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .profil-non-renseigne {
          margin-top: var(--spacing-sm);
          font-size: 0.8rem;
          color: var(--text-muted);
        }
      </style>
    `;
  },

  // Initialiser les camemberts du Profil famille (appelé après render)
  initProfilFamilleCharts() {
    if (typeof ChartsHelper === 'undefined') return;
    const data = Statistiques.getProfilFamilleStats();
    if (data.total === 0) return;

    const s = data.sexe;
    const a = data.age;
    const anc = data.anciennete;
    const tranchesAgeAffichees = a.tranches.filter(t => t.key !== 'moins18' || t.count > 0);

    const sexeLabels = ['Hommes', 'Femmes'].filter((_, i) => [s.hommes, s.femmes][i] > 0);
    const sexeData = [s.hommes, s.femmes].filter(v => v > 0);
    const ageLabels = tranchesAgeAffichees.filter(t => t.count > 0).map(t => t.label);
    const ageData = tranchesAgeAffichees.filter(t => t.count > 0).map(t => t.count);
    const ancLabels = anc.tranches.filter(t => t.count > 0).map(t => t.label);
    const ancData = anc.tranches.filter(t => t.count > 0).map(t => t.count);

    const palette = ['#2D5A7B', '#E91E63', '#4CAF50', '#FF9800', '#9C27B0', '#2196F3'];
    if (sexeData.length > 0) ChartsHelper.createPie('chart-profil-sexe', sexeLabels, sexeData, ['#2D5A7B', '#E91E63']);
    if (ageData.length > 0) ChartsHelper.createPie('chart-profil-age', ageLabels, ageData, palette);
    if (ancData.length > 0) ChartsHelper.createPie('chart-profil-anciennete', ancLabels, ancData, palette);
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

  initCharts() {
    if (typeof ChartsHelper === 'undefined' || !this.stats) return;
    const g = this.stats.global || {};
    const parType = this.stats.parType || [];
    const evolution = this.stats.evolution || [];
    if (g.totalPresencesEffectives !== undefined && g.totalAbsences !== undefined) {
      ChartsHelper.createDoughnut('chart-stats-repartition',
        ['Présents', 'Absents', 'Excusés'],
        [g.totalPresencesEffectives || 0, g.totalAbsences || 0, g.totalExcuses || 0],
        ['#4CAF50', '#F44336', '#FF9800']);
    }
    if (parType.length > 0) {
      ChartsHelper.createBar('chart-stats-type',
        parType.map(d => d.label),
        parType.map(d => d.tauxPresence),
        parType.map(d => d.color));
    }
    if (evolution.length > 0) {
      const labels = evolution.map(d => {
        const m = d.mois || '';
        return m ? m.slice(5) + '/' + m.slice(2, 4) : d.label;
      });
      ChartsHelper.createLine('chart-stats-evolution', labels,
        [{ label: 'Taux présence (%)', data: evolution.map(d => d.tauxPresence) }]);
    }
    this.initProfilFamilleCharts();
    this.setupScrollTop();
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
    setTimeout(() => this.initCharts(), 50);
  },

  // Accordéon Détail par membre
  toggleDetailMembres() {
    const body = document.getElementById('stats-detail-body');
    const card = document.querySelector('.stats-accordion-card');
    if (!body || !card) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    card.classList.toggle('expanded', isHidden);
  },

  // Bouton remonter en haut
  _scrollTopHandler: null,
  setupScrollTop() {
    const btn = document.getElementById('stats-scroll-top');
    if (!btn) return;

    if (this._scrollTopHandler) {
      window.removeEventListener('scroll', this._scrollTopHandler, { passive: true });
    }
    this._scrollTopHandler = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (btn.parentNode) {
        btn.style.opacity = scrollTop > 300 ? '1' : '0';
        btn.style.pointerEvents = scrollTop > 300 ? 'auto' : 'none';
      }
    };
    window.addEventListener('scroll', this._scrollTopHandler, { passive: true });
    this._scrollTopHandler();
  },

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  escapeCsv(val) {
    if (val == null || val === '') return '';
    const s = String(val).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  },

  exportDetailMembreCSV() {
    if (!this.stats || !this.stats.parMembre || this.stats.parMembre.length === 0) {
      Toast.info('Aucune donnée à exporter');
      return;
    }
    const rows = [
      ['Membre', 'Mentor', 'Présences', 'Absences', 'Excusés', 'Taux %'],
      ...this.stats.parMembre.map(m => [
        m.nomComplet,
        m.mentor,
        m.nbPresences,
        m.nbAbsences,
        m.nbExcuses,
        m.tauxPresence
      ])
    ];
    const csv = rows.map(row => row.map(cell => this.escapeCsv(cell)).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statistiques-detail-membres-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success('Export CSV téléchargé');
  },

  exportAlertesCSV() {
    if (!this.alertesAbsence || this.alertesAbsence.length === 0) {
      Toast.info('Aucune alerte à exporter');
      return;
    }
    const rows = [
      ['Membre', 'Mentor', 'Présences', 'Absences', 'Taux %', 'Dernier programme'],
      ...this.alertesAbsence.map(a => [
        `${a.prenom} ${a.nom}`,
        a.mentor,
        a.nbPresences,
        a.nbAbsences,
        a.tauxPresence,
        a.dernierProgramme ? Utils.formatDate(a.dernierProgramme) : ''
      ])
    ];
    const csv = rows.map(row => row.map(cell => this.escapeCsv(cell)).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statistiques-alertes-absence-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success('Export CSV téléchargé');
  },

  exportAlertesPDF() {
    if (!this.alertesAbsence || this.alertesAbsence.length === 0) {
      Toast.info('Aucune alerte à exporter');
      return;
    }
    const famille = AppState.famille?.nom || '';
    const rows = this.alertesAbsence.map(a => `
      <tr>
        <td>${Utils.escapeHtml(a.prenom)} ${Utils.escapeHtml(a.nom)}</td>
        <td>${Utils.escapeHtml(a.mentor)}</td>
        <td class="text-center">${a.nbPresences}</td>
        <td class="text-center">${a.nbAbsences}</td>
        <td class="text-center"><span class="badge badge-danger">${a.tauxPresence} %</span></td>
        <td>${a.dernierProgramme ? Utils.formatDate(a.dernierProgramme) : '-'}</td>
      </tr>
    `).join('');
    const content = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Membres à recontacter - ${Utils.escapeHtml(famille)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; padding: 15mm; color: #333; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #2D5A7B; }
    .header h1 { color: #2D5A7B; font-size: 18pt; }
    .header .subtitle { font-size: 10pt; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f7fa; font-weight: 600; }
    .text-center { text-align: center; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 9pt; }
    .badge-danger { background: #FFEBEE; color: #C62828; }
    .no-print { display: none; }
    @media print { .no-print { display: none; } }
    .btn-print { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #2D5A7B; color: white; border: none; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">Imprimer / PDF</button>
  <div class="header">
    <h1>Membres à recontacter</h1>
    <div class="subtitle">Famille ${Utils.escapeHtml(famille)} — &lt; 50 % présence (30 derniers jours)</div>
    <div class="subtitle">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Membre</th>
        <th>Mentor</th>
        <th class="text-center">Présences</th>
        <th class="text-center">Absences</th>
        <th class="text-center">Taux</th>
        <th>Dernier programme</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      Toast.error('Autorisez les popups pour ouvrir l\'export PDF.');
      return;
    }
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => printWindow.print(), 300);
    Toast.success('Fenêtre ouverte : dans la boîte d\'impression, choisissez « Enregistrer au format PDF » comme destination pour sauvegarder le fichier.');
  },

  // Export PDF : ouverture en fenêtre d'impression (fiable, sans page blanche ni coupure)
  exportPDF() {
    if (!this.stats) {
      Toast.error('Aucune donnée de statistiques à exporter. Rechargez la page et réessayez.');
      return;
    }
    const opts = {
      dateDebut: this.currentDateDebut,
      dateFin: this.currentDateFin,
      famille: (AppState.famille && AppState.famille.nom) ? AppState.famille.nom : ''
    };
    const htmlContent = PDFExport.buildPresenceHTML(this.stats, opts);
    const opened = PDFExport.openForPrint(htmlContent, 'Rapport de Présences');
    if (opened) {
      Toast.success('Rapport ouvert : dans la fenêtre, cliquez sur « Imprimer / PDF » ou utilisez Ctrl+P, puis choisissez « Enregistrer au format PDF » comme destination.');
    } else {
      Toast.error('Autorisez les popups pour ce site pour ouvrir le rapport.');
    }
  }
};
