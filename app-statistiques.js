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

    // Filtrer les membres (adjoints superviseur et comptes test exclus)
    let membres = (Membres.getMembresPourStatsEtPointage ? Membres.getMembresPourStatsEtPointage() : AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur' && !m.compte_test
    ));
    
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

    const totalProgrammes = programmes.length;
    const totalMembres = membres.length;

    const presencesByStatut = {
      present: 0,
      absent: 0,
      excuse: 0,
      autre_campus: 0,
      non_renseigne: 0
    };

    allPresences.forEach(p => {
      const membre = membres.find(m => m.id === p.disciple_id);
      if (membre && Utils.membreEtaitDansFamilleALaDate(membre, p.programme?.date_debut)) {
        if (p.statut in presencesByStatut) presencesByStatut[p.statut]++;
        else presencesByStatut.non_renseigne++;
      }
    });

    // totalPresencesAttendues = présences réellement pointées (fiches enregistrées), pour cohérence avec par membre
    const totalPresencesAttendues = presencesByStatut.present + presencesByStatut.absent + presencesByStatut.excuse + presencesByStatut.autre_campus + presencesByStatut.non_renseigne;
    const tauxPresenceGlobal = totalPresencesAttendues > 0 
      ? Math.round((presencesByStatut.present / totalPresencesAttendues) * 100 * 10) / 10
      : 0;

    // Stats par type de programme (présences réellement pointées, cohérent avec par membre)
    const membreIds = new Set(membres.map(m => m.id));
    const statsByType = {};
    Programmes.getTypes().forEach(type => {
      const progsOfType = programmes.filter(p => p.type === type.value);
      const presencesOfType = allPresences.filter(p => 
        p.programme?.type === type.value && 
        membreIds.has(p.disciple_id) && 
        Utils.membreEtaitDansFamilleALaDate(membres.find(x => x.id === p.disciple_id), p.programme?.date_debut)
      );
      const nbPointesOfType = presencesOfType.length;
      const presentOfType = presencesOfType.filter(p => p.statut === 'present').length;

      if (progsOfType.length > 0) {
        statsByType[type.value] = {
          type: type.value,
          label: type.label,
          color: type.color,
          nbProgrammes: progsOfType.length,
          nbPresents: presentOfType,
          nbAttendus: nbPointesOfType,
          tauxPresence: nbPointesOfType > 0 ? Math.round((presentOfType / nbPointesOfType) * 100 * 10) / 10 : 0
        };
      }
    });

    // Stats par membre
    // nbTotal = programmes réellement pointés (fiches de présence). taux = présents / nbTotal
    // nbProgrammesAttendus = programmes théoriques (membre dans famille à la date). nbProgrammesNonPointes = oublis possibles
    const statsByMembre = membres.map(membre => {
      const programmesAttendus = programmes.filter(prog => {
        const dProg = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut);
        return Utils.membreEtaitDansFamilleALaDate(membre, dProg);
      });
      const presencesMembre = allPresences.filter(p => 
        p.disciple_id === membre.id && 
        Utils.membreEtaitDansFamilleALaDate(membre, p.programme?.date_debut)
      );
      const nbTotal = presencesMembre.length;
      const nbProgrammesAttendus = programmesAttendus.length;
      const programmeIdsPointes = new Set(presencesMembre.map(p => p.programme_id || p.programme?.id).filter(Boolean));
      const programmesNonPointesList = programmesAttendus
        .filter(prog => !programmeIdsPointes.has(prog.id))
        .map(prog => ({
          id: prog.id,
          nom: prog.nom,
          type: prog.type,
          date_debut: prog.date_debut
        }))
        .sort((a, b) => {
          const da = a.date_debut?.toDate ? a.date_debut.toDate() : new Date(a.date_debut || 0);
          const db = b.date_debut?.toDate ? b.date_debut.toDate() : new Date(b.date_debut || 0);
          return da - db;
        });
      const nbProgrammesNonPointes = programmesNonPointesList.length;
      const presents = presencesMembre.filter(p => p.statut === 'present').length;
      const absents = presencesMembre.filter(p => p.statut === 'absent').length;
      const excuses = presencesMembre.filter(p => p.statut === 'excuse').length;
      const autreCampus = presencesMembre.filter(p => p.statut === 'autre_campus').length;
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
        nbAutreCampus: autreCampus,
        nbTotal,
        nbProgrammesAttendus,
        nbProgrammesNonPointes,
        programmesNonPointesList,
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
        totalAutreCampus: presencesByStatut.autre_campus,
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

  // Calculer l'évolution mensuelle (nbAttendus = présences pointées dans le mois, cohérent avec par membre)
  calculateMonthlyEvolution(programmes, presences, membres) {
    const monthlyData = {};
    const membreIdsEvolution = new Set(membres.map(m => m.id));

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
    });

    presences.forEach(p => {
      const prog = p.programme;
      if (!prog) return;
      const membre = membres.find(m => m.id === p.disciple_id);
      if (!membre || !membreIdsEvolution.has(membre.id) || !Utils.membreEtaitDansFamilleALaDate(membre, prog.date_debut)) return;
      const d = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].nbAttendus++;
        if (p.statut === 'present') monthlyData[monthKey].nbPresences++;
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
    const actifs = Membres.getMembresPourStatsEtPointage ? Membres.getMembresPourStatsEtPointage() : AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur' && !m.compte_test
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
    let membres = Membres.getMembresPourStatsEtPointage ? Membres.getMembresPourStatsEtPointage() : AppState.membres.filter(m => m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur' && !m.compte_test);
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

  // Statistiques NA/NC globales (semaine, mois, année)
  calculateNAStats(options = {}) {
    const { dateDebut = null, dateFin = null } = options;
    const allNA = (typeof NouvellesAmes !== 'undefined' && NouvellesAmes.getAll) ? NouvellesAmes.getAll() : [];
    
    const filterByDate = (na) => {
      const created = na.created_at?.toDate ? na.created_at.toDate() : new Date(na.created_at || 0);
      if (dateDebut && created < dateDebut) return false;
      if (dateFin && created > dateFin) return false;
      return true;
    };

    const inPeriod = allNA.filter(filterByDate);
    const byStatut = { nouveau: 0, en_suivi: 0, integre: 0, inactif: 0, perdu: 0 };
    const byCategorie = { na: 0, nc: 0 };
    inPeriod.forEach(na => {
      byStatut[na.statut || 'nouveau']++;
      byCategorie[na.categorie === 'nc' ? 'nc' : 'na']++;
    });

    return {
      total: inPeriod.length,
      byStatut,
      byCategorie,
      nouveau: byStatut.nouveau,
      enSuivi: byStatut.en_suivi,
      integre: byStatut.integre,
      inactif: byStatut.inactif,
      perdu: byStatut.perdu,
      na: byCategorie.na,
      nc: byCategorie.nc
    };
  },

  // Statistiques formations (PCNC, BDR, Baptême - inscrits + terminés)
  calculateFormationStats() {
    const allNA = (typeof NouvellesAmes !== 'undefined' && NouvellesAmes.getAll) ? NouvellesAmes.getAll() : [];
    const formations = ['pcnc', 'bdr', 'bapteme'];
    const result = {};
    formations.forEach(code => {
      const withFormation = allNA.filter(na => {
        const entries = na.formations || [];
        return entries.some(f => f.code === code);
      });
      const inscrits = withFormation.filter(na => {
        const e = (na.formations || []).find(f => f.code === code);
        return e && (e.statut === 'inscrit' || e.statut === 'en_cours');
      }).length;
      const termines = withFormation.filter(na => {
        const e = (na.formations || []).find(f => f.code === code);
        return e && e.statut === 'termine';
      }).length;
      result[code] = {
        total: withFormation.length,
        inscrits,
        termines,
        label: code === 'pcnc' ? 'PCNC' : code === 'bdr' ? 'BDR' : 'Baptême'
      };
    });
    return result;
  },

  // Statistiques de présence NA/NC (par NA/NC et global)
  async calculateNAPresenceStats(options = {}) {
    const { dateDebut = null, dateFin = null } = options;
    
    let programmes = AppState.programmes.filter(p => {
      if (!p.date_debut) return false;
      if (!Programmes.pointageRequis(p)) return false;
      const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
      if (dateDebut && d < dateDebut) return false;
      if (dateFin && d > dateFin) return false;
      return true;
    });

    const allPresences = [];
    for (const prog of programmes) {
      const presences = await Presences.loadByProgramme(prog.id);
      allPresences.push(...presences.filter(p => p.nouvelle_ame_id).map(p => ({ ...p, programme: prog })));
    }

    const allNA = (typeof NouvellesAmes !== 'undefined' && NouvellesAmes.getAll) ? NouvellesAmes.getAll() : [];
    const naIds = new Set(allNA.filter(na => na.statut !== 'integre' && na.statut !== 'perdu').map(na => na.id));

    const global = { present: 0, absent: 0, excuse: 0, autre_campus: 0, pas_revenir: 0, injoignable: 0, non_renseigne: 0, total: 0 };
    allPresences.forEach(p => {
      if (naIds.has(p.nouvelle_ame_id)) {
        global[p.statut] = (global[p.statut] || 0) + 1;
        global.total++;
      }
    });

    const parNA = allNA.filter(na => naIds.has(na.id)).map(na => {
      const presencesNA = allPresences.filter(p => p.nouvelle_ame_id === na.id);
      const presents = presencesNA.filter(p => p.statut === 'present').length;
      const absents = presencesNA.filter(p => p.statut === 'absent').length;
      const excuses = presencesNA.filter(p => p.statut === 'excuse').length;
      const autreCampus = presencesNA.filter(p => p.statut === 'autre_campus').length;
      const pasRevenir = presencesNA.filter(p => p.statut === 'pas_revenir').length;
      const injoignable = presencesNA.filter(p => p.statut === 'injoignable').length;
      const total = presencesNA.length;
      return {
        id: na.id,
        prenom: na.prenom,
        nom: na.nom,
        nomComplet: `${na.prenom} ${na.nom}`,
        suivi_par_nom: na.suivi_par_nom,
        nbPresences: presents,
        nbAbsences: absents,
        nbExcuses: excuses,
        nbAutreCampus: autreCampus,
        nbPasRevenir: pasRevenir,
        nbInjoignable: injoignable,
        nbTotal: total,
        tauxPresence: total > 0 ? Math.round((presents / total) * 100 * 10) / 10 : 0
      };
    }).sort((a, b) => b.tauxPresence - a.tauxPresence);

    return {
      global: {
        ...global,
        tauxPresence: global.total > 0 ? Math.round((global.present / global.total) * 100 * 10) / 10 : 0
      },
      parNA
    };
  },

  // Statistiques de profil famille (sexe, âge, ancienneté) - basées sur les données saisies par les membres
  getProfilFamilleStats() {
    const actifs = Membres.getMembresPourStatsEtPointage ? Membres.getMembresPourStatsEtPointage() : AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur' && !m.compte_test
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
      ${isMentorView ? `<p class="text-muted" style="margin-bottom: var(--spacing-md);"><i class="fas fa-users"></i> Statistiques limitées à votre groupe (${this.stats.global.totalMembres} membre${this.stats.global.totalMembres !== 1 ? 's' : ''}).</p>` : ''}
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
            <div class="stat-label">${isMentorView ? 'Taux du groupe' : 'Taux global'}</div>
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
                  <th onclick="PagesStatistiques.sortTable('nbAutreCampus')" class="text-center" title="Présence dans un autre campus">Autre campus ↕</th>
                  <th onclick="PagesStatistiques.sortTable('nbProgrammesNonPointes')" class="text-center" title="Programmes attendus mais non pointés (oublis possibles)">Non pointés ↕</th>
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
                    <td class="text-center"><span class="badge" style="background: #2196F3; color: white;">${m.nbAutreCampus || 0}</span></td>
                    <td class="text-center">${(m.nbProgrammesNonPointes || 0) > 0 ? `<span class="badge stat-non-pointes-clickable" style="background: #9E9E9E; color: white; cursor: pointer;" title="Cliquer pour voir la liste" onclick="PagesStatistiques.showModalProgrammesNonPointes('${m.id}')">${m.nbProgrammesNonPointes}</span>` : '<span class="text-muted">0</span>'}</td>
                    <td class="text-center">
                      <div class="progress-bar-container" title="${m.nbTotal}/${m.nbProgrammesAttendus || m.nbTotal} programmes pointés${(m.nbProgrammesNonPointes || 0) > 0 ? ` — ${m.nbProgrammesNonPointes} non pointé(s)` : ''}">
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
        ['Présents', 'Absents', 'Excusés', 'Autre campus'],
        [g.totalPresencesEffectives || 0, g.totalAbsences || 0, g.totalExcuses || 0, g.totalAutreCampus || 0],
        ['#4CAF50', '#F44336', '#FF9800', '#2196F3']);
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
      if (valA == null) valA = (typeof valB === 'string' ? '' : 0);
      if (valB == null) valB = (typeof valA === 'string' ? '' : 0);
      
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = String(valB || '').toLowerCase();
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
        <td class="text-center"><span class="badge" style="background: #2196F3; color: white;">${m.nbAutreCampus || 0}</span></td>
        <td class="text-center">${(m.nbProgrammesNonPointes || 0) > 0 ? `<span class="badge stat-non-pointes-clickable" style="background: #9E9E9E; color: white; cursor: pointer;" title="Cliquer pour voir la liste" onclick="PagesStatistiques.showModalProgrammesNonPointes('${m.id}')">${m.nbProgrammesNonPointes}</span>` : '<span class="text-muted">0</span>'}</td>
        <td class="text-center">
          <div class="progress-bar-container" title="${m.nbTotal}/${m.nbProgrammesAttendus || m.nbTotal} programmes pointés${(m.nbProgrammesNonPointes || 0) > 0 ? ` — ${m.nbProgrammesNonPointes} non pointé(s)` : ''}">
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

  showModalProgrammesNonPointes(membreId) {
    const m = this.stats?.parMembre?.find(x => x.id === membreId);
    if (!m || !(m.programmesNonPointesList?.length > 0)) return;
    const typeLabel = (t) => (Programmes.getTypes?.()?.find(x => x.value === t)?.label || t) || '-';
    const modalId = 'modal-programmes-non-pointes';
    let existing = document.getElementById(modalId);
    if (existing) existing.remove();
    const rows = m.programmesNonPointesList.map(prog => {
      const d = prog.date_debut?.toDate ? prog.date_debut.toDate() : new Date(prog.date_debut || 0);
      return `<tr>
        <td>${Utils.formatDate(d, 'short')}</td>
        <td>${Utils.escapeHtml(prog.nom || '-')}</td>
        <td><span class="badge badge-secondary">${Utils.escapeHtml(typeLabel(prog.type))}</span></td>
        <td><a href="#" onclick="Modal.hide('${modalId}'); document.getElementById('${modalId}').remove(); App.navigate('presences', {programmeId:'${prog.id}'}); return false;" class="btn btn-sm btn-primary"><i class="fas fa-clipboard-check"></i> Pointer</a></td>
      </tr>`;
    }).join('');
    const modalHtml = `
      <div class="modal-overlay" id="${modalId}">
        <div class="modal" style="max-width: 560px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Programmes non pointés — ${Utils.escapeHtml(m.nomComplet)}</h3>
            <button class="modal-close" onclick="Modal.hide('${modalId}'); document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <p class="text-muted mb-3">Programmes auxquels ce membre aurait dû être pointé (déjà dans la famille) mais sans fiche de présence. Cliquez sur « Pointer » pour ouvrir le pointage.</p>
            <div class="table-container" style="max-height: 280px; overflow-y: auto;">
              <table class="table">
                <thead><tr><th>Date</th><th>Programme</th><th>Type</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    Modal.show(modalId);
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
      ['Membre', 'Mentor', 'Présences', 'Absences', 'Excusés', 'Autre campus', 'Non pointés', 'Taux %'],
      ...this.stats.parMembre.map(m => [
        m.nomComplet,
        m.mentor,
        m.nbPresences,
        m.nbAbsences,
        m.nbExcuses,
        m.nbAutreCampus ?? 0,
        m.nbProgrammesNonPointes ?? 0,
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

  // Page Statistiques NA/NC
  currentNAPeriode: 'mois',
  currentNADateDebut: null,
  currentNADateFin: null,

  initNADates() {
    const now = new Date();
    switch (this.currentNAPeriode) {
      case 'semaine':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        this.currentNADateDebut = startOfWeek;
        this.currentNADateFin = now;
        break;
      case 'mois':
        this.currentNADateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
        this.currentNADateFin = now;
        break;
      case 'annee':
        this.currentNADateDebut = new Date(now.getFullYear(), 0, 1);
        this.currentNADateFin = now;
        break;
      default:
        this.currentNADateDebut = null;
        this.currentNADateFin = null;
    }
  },

  async renderStatistiquesNA() {
    this.initNADates();
    const dateDebut = this.currentNADateDebut;
    const dateFin = this.currentNADateFin;

    const naStats = Statistiques.calculateNAStats({ dateDebut, dateFin });
    const formationStats = Statistiques.calculateFormationStats();
    const presenceStats = await Statistiques.calculateNAPresenceStats({ dateDebut, dateFin });

    this.naStatsData = { naStats, formationStats, presenceStats, dateDebut, dateFin };

    return `
      <div class="stats-header">
        <div class="stats-filters">
          <select class="form-control" id="stats-na-periode" onchange="PagesStatistiques.changeNAPeriode(this.value)">
            <option value="semaine" ${this.currentNAPeriode === 'semaine' ? 'selected' : ''}>Cette semaine</option>
            <option value="mois" ${this.currentNAPeriode === 'mois' ? 'selected' : ''}>Ce mois</option>
            <option value="annee" ${this.currentNAPeriode === 'annee' ? 'selected' : ''}>Cette année</option>
          </select>
        </div>
        <div style="display: flex; gap: var(--spacing-sm); flex-wrap: wrap; align-items: center;">
          <button class="btn btn-outline" onclick="PagesStatistiques.exportNAStatsCSV()" title="Exporter en CSV">
            <i class="fas fa-file-csv"></i> CSV
          </button>
          <button class="btn btn-outline" onclick="PagesStatistiques.exportNAStatsPDF()" title="Exporter en PDF">
            <i class="fas fa-file-pdf"></i> PDF
          </button>
          <button class="btn btn-secondary" onclick="App.navigate('nouvelles-ames')">
            <i class="fas fa-arrow-left"></i> Nouvelles âmes
          </button>
        </div>
      </div>

      <div class="alert alert-info mb-3">
        <i class="fas fa-seedling"></i> Statistiques des Nouvelles Âmes / Nouveaux Convertis (NA/NC) — distinctes des membres.
      </div>

      <!-- Cartes NA/NC global -->
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background: #9C27B0;"><i class="fas fa-seedling"></i></div>
          <div class="stat-content">
            <div class="stat-value">${naStats.total}</div>
            <div class="stat-label">Total NA/NC (période)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fas fa-user-plus"></i></div>
          <div class="stat-content">
            <div class="stat-value">${naStats.na}</div>
            <div class="stat-label">Nouveaux Arrivants</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success"><i class="fas fa-heart"></i></div>
          <div class="stat-content">
            <div class="stat-value">${naStats.nc}</div>
            <div class="stat-label">Nouveaux Convertis</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning"><i class="fas fa-user-check"></i></div>
          <div class="stat-content">
            <div class="stat-value">${naStats.enSuivi}</div>
            <div class="stat-label">En suivi</div>
          </div>
        </div>
      </div>

      <!-- Formations -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-graduation-cap"></i> Participants aux formations</h3>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Formation</th>
                  <th class="text-center">Total inscrits</th>
                  <th class="text-center">Inscrits / En cours</th>
                  <th class="text-center">Terminés</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(formationStats).map(([code, f]) => `
                  <tr>
                    <td><strong>${f.label}</strong></td>
                    <td class="text-center">${f.total}</td>
                    <td class="text-center">${f.inscrits}</td>
                    <td class="text-center"><span class="badge badge-success">${f.termines}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Présences NA/NC global -->
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Présences NA/NC (global)</h3>
        </div>
        <div class="card-body">
          <div class="presence-stats-bar" style="display: flex; gap: var(--spacing-lg); flex-wrap: wrap;">
            <div class="stat-item" style="--color: var(--success)">
              <span class="stat-value" style="display: block; font-size: 1.5rem; font-weight: 700;">${presenceStats.global.present}</span>
              <span class="stat-label">Présents</span>
            </div>
            <div class="stat-item" style="--color: var(--danger)">
              <span class="stat-value" style="display: block; font-size: 1.5rem; font-weight: 700;">${presenceStats.global.absent}</span>
              <span class="stat-label">Absents</span>
            </div>
            <div class="stat-item" style="--color: var(--warning)">
              <span class="stat-value" style="display: block; font-size: 1.5rem; font-weight: 700;">${presenceStats.global.excuse}</span>
              <span class="stat-label">Excusés</span>
            </div>
            <div class="stat-item" style="--color: #2196F3">
              <span class="stat-value" style="display: block; font-size: 1.5rem; font-weight: 700;">${presenceStats.global.autre_campus || 0}</span>
              <span class="stat-label">Autre campus</span>
            </div>
            <div class="stat-item" style="--color: #795548">
              <span class="stat-value" style="display: block; font-size: 1.5rem; font-weight: 700;">${presenceStats.global.pas_revenir || 0}</span>
              <span class="stat-label">Pas de retour prévu</span>
            </div>
            <div class="stat-item" style="--color: #607D8B">
              <span class="stat-value" style="display: block; font-size: 1.5rem; font-weight: 700;">${presenceStats.global.injoignable || 0}</span>
              <span class="stat-label">Injoignable</span>
            </div>
            <div class="stat-item" style="--color: #9C27B0">
              <span class="stat-value" style="display: block; font-size: 1.5rem; font-weight: 700;">${presenceStats.global.tauxPresence}%</span>
              <span class="stat-label">Taux</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Détail par NA/NC -->
      <div class="card mt-3">
        <div class="card-header" style="flex-wrap: wrap; gap: var(--spacing-sm);">
          <h3 class="card-title"><i class="fas fa-users"></i> Présences par NA/NC <span class="badge badge-secondary">${presenceStats.parNA.length}</span></h3>
          ${presenceStats.parNA.length > 0 ? `
          <div class="search-box" style="min-width: 220px;" onclick="event.stopPropagation()">
            <i class="fas fa-search"></i>
            <input type="text" class="form-control" placeholder="Rechercher NA/NC ou mentor..."
                   onkeyup="PagesStatistiques.filterNAStatsTable(this.value)">
          </div>
          ` : ''}
        </div>
        <div class="card-body" style="padding: 0;">
          ${presenceStats.parNA.length > 0 ? `
            <div class="table-container">
              <table class="table" id="stats-na-table">
                <thead>
                  <tr>
                    <th>NA/NC</th>
                    <th>Suivi par</th>
                    <th class="text-center">Présents</th>
                    <th class="text-center">Absents</th>
                    <th class="text-center">Excusés</th>
                    <th class="text-center" title="Autre campus">Autre campus</th>
                    <th class="text-center" title="Pas de retour prévu">Pas retour</th>
                    <th class="text-center">Injoignable</th>
                    <th class="text-center">Taux</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${presenceStats.parNA.map(m => `
                    <tr data-search="${(m.nomComplet + ' ' + (m.suivi_par_nom || '')).toLowerCase()}">
                      <td><strong>${Utils.escapeHtml(m.nomComplet)}</strong></td>
                      <td class="text-muted">${Utils.escapeHtml(m.suivi_par_nom || '-')}</td>
                      <td class="text-center"><span class="badge badge-success">${m.nbPresences}</span></td>
                      <td class="text-center"><span class="badge badge-danger">${m.nbAbsences}</span></td>
                      <td class="text-center"><span class="badge badge-warning">${m.nbExcuses}</span></td>
                      <td class="text-center"><span class="badge" style="background: #2196F3; color: white;">${m.nbAutreCampus || 0}</span></td>
                      <td class="text-center"><span class="badge" style="background: #795548; color: white;">${m.nbPasRevenir || 0}</span></td>
                      <td class="text-center"><span class="badge" style="background: #607D8B; color: white;">${m.nbInjoignable || 0}</span></td>
                      <td class="text-center">
                        <div class="progress-bar-container" style="min-width: 80px;">
                          <div class="progress-bar" style="width: ${m.tauxPresence}%; background: ${m.tauxPresence >= 80 ? 'var(--success)' : m.tauxPresence >= 50 ? 'var(--warning)' : 'var(--danger)'}"></div>
                          <span class="progress-text">${m.tauxPresence}%</span>
                        </div>
                      </td>
                      <td>
                        <button class="btn btn-sm btn-secondary" onclick="App.navigate('historique-na', { id: '${m.id}' })" title="Historique">
                          <i class="fas fa-history"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state" style="padding: var(--spacing-lg);">
              <i class="fas fa-clipboard-list"></i>
              <h4>Aucune donnée</h4>
              <p>Aucune présence NA/NC enregistrée pour cette période.</p>
            </div>
          `}
        </div>
      </div>

      <style>
        .stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); flex-wrap: wrap; gap: var(--spacing-md); }
        .progress-bar-container { position: relative; background: var(--bg-tertiary); border-radius: var(--radius-full); height: 24px; overflow: hidden; }
        .progress-bar { height: 100%; border-radius: var(--radius-full); transition: width 0.3s ease; }
        .progress-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.75rem; font-weight: 600; }
      </style>
    `;
  },

  async changeNAPeriode(periode) {
    this.currentNAPeriode = periode;
    this.initNADates();
    document.querySelector('.page-content').innerHTML = await this.renderStatistiquesNA();
  },

  filterNAStatsTable(search) {
    const rows = document.querySelectorAll('#stats-na-table tbody tr');
    const s = (search || '').toLowerCase().trim();
    rows.forEach(row => {
      const text = row.dataset.search || '';
      row.style.display = !s || text.includes(s) ? '' : 'none';
    });
  },

  exportNAStatsCSV() {
    const d = this.naStatsData;
    if (!d) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }
    const escapeCsv = (v) => {
      if (v == null || v === '') return '';
      const s = String(v).replace(/"/g, '""');
      return /[;\r\n"]/.test(s) ? `"${s}"` : s;
    };
    let csv = '\uFEFF';
    if (d.formationStats) {
      csv += 'Formations NA/NC\r\n';
      csv += ['Formation', 'Total inscrits', 'Inscrits/En cours', 'Terminés'].map(escapeCsv).join(';') + '\r\n';
      Object.entries(d.formationStats).forEach(([code, f]) => {
        csv += [f.label, f.total, f.inscrits, f.termines].map(escapeCsv).join(';') + '\r\n';
      });
      csv += '\r\n';
    }
    if (d.presenceStats && d.presenceStats.parNA.length > 0) {
      csv += 'Présences par NA/NC\r\n';
      csv += ['NA/NC', 'Suivi par', 'Présents', 'Absents', 'Excusés', 'Autre campus', 'Pas retour', 'Injoignable', 'Taux %'].map(escapeCsv).join(';') + '\r\n';
      d.presenceStats.parNA.forEach(m => {
        csv += [m.nomComplet, m.suivi_par_nom || '-', m.nbPresences, m.nbAbsences, m.nbExcuses, m.nbAutreCampus || 0, m.nbPasRevenir || 0, m.nbInjoignable || 0, m.tauxPresence].map(escapeCsv).join(';') + '\r\n';
      });
    }
    if (csv === '\uFEFF') {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statistiques-na-presences-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success('Export CSV téléchargé');
  },

  exportNAStatsPDF() {
    const d = this.naStatsData;
    if (!d) {
      Toast.warning('Aucune donnée à exporter.');
      return;
    }
    const g = d.presenceStats?.global || {};
    const famille = AppState.famille?.nom || '';
    const periode = d.dateDebut && d.dateFin
      ? `${d.dateDebut.toLocaleDateString('fr-FR')} - ${d.dateFin.toLocaleDateString('fr-FR')}`
      : '';

    const formationRows = d.formationStats ? Object.entries(d.formationStats).map(([code, f]) => `
      <tr><td>${Utils.escapeHtml(f.label)}</td><td class="text-center">${f.total}</td><td class="text-center">${f.inscrits}</td><td class="text-center">${f.termines}</td></tr>
    `).join('') : '';
    const rows = (d.presenceStats?.parNA || []).map(m => `
      <tr>
        <td>${Utils.escapeHtml(m.nomComplet)}</td>
        <td>${Utils.escapeHtml(m.suivi_par_nom || '-')}</td>
        <td class="text-center">${m.nbPresences}</td>
        <td class="text-center">${m.nbAbsences}</td>
        <td class="text-center">${m.nbExcuses}</td>
        <td class="text-center">${m.nbAutreCampus || 0}</td>
        <td class="text-center">${m.nbPasRevenir || 0}</td>
        <td class="text-center">${m.nbInjoignable || 0}</td>
        <td class="text-center">${m.tauxPresence}%</td>
      </tr>
    `).join('');

    const content = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Statistiques NA/NC - ${Utils.escapeHtml(famille)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; padding: 15mm; color: #333; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #9C27B0; }
    .header h1 { color: #9C27B0; font-size: 18pt; }
    .header .subtitle { font-size: 10pt; color: #666; margin-top: 4px; }
    .stats-bar { display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat-box { text-align: center; padding: 10px 15px; background: #f5f7fa; border-radius: 8px; }
    .stat-value { font-size: 18pt; font-weight: bold; }
    .stat-label { font-size: 9pt; color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f7fa; font-weight: 600; }
    .text-center { text-align: center; }
    .btn-print { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #9C27B0; color: white; border: none; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">Imprimer / PDF</button>
  <div class="header">
    <h1>Statistiques NA/NC — Présences</h1>
    <div class="subtitle">Famille ${Utils.escapeHtml(famille)}</div>
    <div class="subtitle">Période : ${Utils.escapeHtml(periode)}</div>
    <div class="subtitle">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  ${formationRows ? `
  <h3 style="margin-bottom: 10px; color: #9C27B0;">Participants aux formations</h3>
  <table style="margin-bottom: 25px;"><thead><tr><th>Formation</th><th class="text-center">Total</th><th class="text-center">Inscrits/En cours</th><th class="text-center">Terminés</th></tr></thead><tbody>${formationRows}</tbody></table>
  ` : ''}
  <h3 style="margin-bottom: 10px; color: #9C27B0;">Présences NA/NC</h3>
  <div class="stats-bar">
    <div class="stat-box"><div class="stat-value" style="color: #4CAF50;">${g.present || 0}</div><div class="stat-label">Présents</div></div>
    <div class="stat-box"><div class="stat-value" style="color: #F44336;">${g.absent || 0}</div><div class="stat-label">Absents</div></div>
    <div class="stat-box"><div class="stat-value" style="color: #FF9800;">${g.excuse || 0}</div><div class="stat-label">Excusés</div></div>
    <div class="stat-box"><div class="stat-value" style="color: #2196F3;">${g.autre_campus || 0}</div><div class="stat-label">Autre campus</div></div>
    <div class="stat-box"><div class="stat-value" style="color: #795548;">${g.pas_revenir || 0}</div><div class="stat-label">Pas retour</div></div>
    <div class="stat-box"><div class="stat-value" style="color: #607D8B;">${g.injoignable || 0}</div><div class="stat-label">Injoignable</div></div>
    <div class="stat-box"><div class="stat-value" style="color: #9C27B0;">${g.tauxPresence || 0}%</div><div class="stat-label">Taux</div></div>
  </div>
  ${rows ? `
  <h3 style="margin: 20px 0 10px; color: #9C27B0;">Détail par NA/NC</h3>
  <table>
    <thead>
      <tr>
        <th>NA/NC</th>
        <th>Suivi par</th>
        <th class="text-center">Présents</th>
        <th class="text-center">Absents</th>
        <th class="text-center">Excusés</th>
        <th class="text-center">Autre campus</th>
        <th class="text-center">Pas retour</th>
        <th class="text-center">Injoignable</th>
        <th class="text-center">Taux</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ` : ''}
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
