// ============================================
// GESTION DES PROGRAMMES ET CALENDRIER
// ============================================

const Programmes = {
  // Charger tous les programmes de la famille
  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      const snapshot = await db.collection('programmes')
        .where('famille_id', '==', familleId)
        .orderBy('date_debut', 'desc')
        .get();

      AppState.programmes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return AppState.programmes;
    } catch (error) {
      console.error('Erreur chargement programmes:', error);
      // Si l'index manque, essayer sans orderBy
      if (error.code === 'failed-precondition') {
        try {
          const snapshot = await db.collection('programmes')
            .where('famille_id', '==', familleId)
            .get();

          AppState.programmes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a, b) => {
            const dateA = a.date_debut?.toDate ? a.date_debut.toDate() : new Date(a.date_debut || 0);
            const dateB = b.date_debut?.toDate ? b.date_debut.toDate() : new Date(b.date_debut || 0);
            return dateB - dateA; // Plus récent en premier
          });

          return AppState.programmes;
        } catch (fallbackError) {
          console.error('Erreur chargement programmes (fallback):', fallbackError);
          ErrorHandler.handle(fallbackError, 'Chargement programmes');
          return [];
        }
      }
      ErrorHandler.handle(error, 'Chargement programmes');
      return [];
    }
  },

  // Obtenir un programme par ID
  getById(id) {
    return AppState.programmes.find(p => p.id === id);
  },

  // Obtenir les programmes d'un mois
  getByMonth(year, month) {
    return AppState.programmes.filter(p => {
      if (!p.date_debut) return false;
      const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => {
      const da = a.date_debut.toDate ? a.date_debut.toDate() : new Date(a.date_debut);
      const db = b.date_debut.toDate ? b.date_debut.toDate() : new Date(b.date_debut);
      return da - db;
    });
  },

  // Obtenir les prochains programmes
  getUpcoming(limit = 5) {
    const now = new Date();
    return AppState.programmes
      .filter(p => {
        if (!p.date_debut) return false;
        const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
        return d >= now;
      })
      .sort((a, b) => {
        const da = a.date_debut.toDate ? a.date_debut.toDate() : new Date(a.date_debut);
        const db = b.date_debut.toDate ? b.date_debut.toDate() : new Date(b.date_debut);
        return da - db;
      })
      .slice(0, limit);
  },

  // Obtenir les programmes passés récents (pour rappel de pointage)
  getRecentPast(days = 7) {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
    return AppState.programmes
      .filter(p => {
        if (!p.date_debut) return false;
        const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
        return d < now && d >= cutoffDate;
      })
      .sort((a, b) => {
        const da = a.date_debut.toDate ? a.date_debut.toDate() : new Date(a.date_debut);
        const db = b.date_debut.toDate ? b.date_debut.toDate() : new Date(b.date_debut);
        return db - da; // Plus récent en premier
      });
  },

  // Créer un programme
  async create(data) {
    try {
      if (!Permissions.canManagePrograms()) {
        throw new Error('Permission refusée');
      }

      // Convertir les dates en Timestamp Firestore si ce sont des objets Date
      const programmeData = {
        nom: data.nom,
        type: data.type,
        date_debut: data.date_debut instanceof Date 
          ? firebase.firestore.Timestamp.fromDate(data.date_debut)
          : data.date_debut,
        date_fin: data.date_fin instanceof Date 
          ? firebase.firestore.Timestamp.fromDate(data.date_fin)
          : (data.date_fin || null),
        lieu: data.lieu,
        recurrence: data.recurrence,
        description: data.description,
        famille_id: AppState.famille.id,
        created_by: AppState.user.id,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('programmes').add(programmeData);
      const newProgramme = { 
        id: docRef.id, 
        ...programmeData,
        date_debut: programmeData.date_debut,
        date_fin: programmeData.date_fin
      };
      AppState.programmes.push(newProgramme);

      Toast.success('Programme créé avec succès');
      return newProgramme;
    } catch (error) {
      console.error('Erreur création programme:', error);
      ErrorHandler.handle(error, 'Création programme');
      throw error;
    }
  },

  // Modifier un programme
  async update(id, data) {
    try {
      if (!Permissions.canManagePrograms()) {
        throw new Error('Permission refusée');
      }

      await db.collection('programmes').doc(id).update({
        ...data,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      const index = AppState.programmes.findIndex(p => p.id === id);
      if (index !== -1) {
        AppState.programmes[index] = { ...AppState.programmes[index], ...data };
      }

      Toast.success('Programme modifié');
      return true;
    } catch (error) {
      console.error('Erreur modification programme:', error);
      Toast.error('Erreur lors de la modification');
      return false;
    }
  },

  // Supprimer un programme
  async delete(id) {
    try {
      if (!Permissions.hasRole('superviseur')) {
        throw new Error('Permission refusée');
      }

      await db.collection('programmes').doc(id).delete();
      AppState.programmes = AppState.programmes.filter(p => p.id !== id);

      Toast.success('Programme supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression programme:', error);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  },

  // Types de programmes
  getTypes() {
    return [
      { value: 'culte_dimanche', label: 'Culte du dimanche', color: '#2196F3', category: 'culte' },
      { value: 'temps_partage_lundi', label: 'Temps de partage du lundi', color: '#4CAF50', category: 'partage' },
      { value: 'com_frat_dimanche', label: "Com'frat du dimanche", color: '#FF9800', category: 'comfrat' },
      { value: 'autre_comfrat', label: "Autre Com'frat", color: '#FF5722', category: 'comfrat' },
      { value: 'temps_priere', label: 'Temps de prière', color: '#9C27B0', category: 'priere' },
      { value: 'veillee_priere', label: 'Veillée de prière', color: '#673AB7', category: 'priere' },
      { value: 'evangelisation_groupe', label: 'Évangélisation en groupe', color: '#009688', category: 'evangelisation' },
      { value: 'sortie_famille', label: 'Sortie en famille', color: '#E91E63', category: 'famille' },
      // Programmes d'exhortation pour nouvelles âmes
      { value: 'exhort_accueil', label: 'Accueil Nouvelles Âmes', color: '#8BC34A', category: 'exhortation', icon: 'fa-hand-holding-heart' },
      { value: 'exhort_foi_fondements', label: 'Foi & Fondements', color: '#00BCD4', category: 'exhortation', icon: 'fa-book-bible' },
      { value: 'exhort_bapteme', label: 'Préparation au Baptême', color: '#3F51B5', category: 'exhortation', icon: 'fa-water' },
      { value: 'exhort_maturite', label: 'Maturité Chrétienne', color: '#795548', category: 'exhortation', icon: 'fa-graduation-cap' },
      { value: 'exhort_servir', label: 'Appel à Servir', color: '#FF5722', category: 'exhortation', icon: 'fa-hands-helping' },
      { value: 'exhort_mariage', label: 'Préparation au Mariage', color: '#E91E63', category: 'exhortation', icon: 'fa-ring' },
      { value: 'autre', label: 'Autre', color: '#607D8B', category: 'autre' }
    ];
  },

  // Obtenir les types d'exhortation uniquement
  getExhortationTypes() {
    return this.getTypes().filter(t => t.category === 'exhortation');
  },

  // Vérifier si un programme est de type exhortation
  isExhortation(type) {
    const found = this.getTypes().find(t => t.value === type);
    return found?.category === 'exhortation';
  },

  getTypeLabel(type) {
    const found = this.getTypes().find(t => t.value === type);
    return found ? found.label : type;
  },

  getTypeColor(type) {
    const found = this.getTypes().find(t => t.value === type);
    return found ? found.color : '#607D8B';
  }
};

// ============================================
// GESTION DES PRÉSENCES
// ============================================

const Presences = {
  cache: {}, // Cache des présences par programme

  // Charger les présences d'un programme
  async loadByProgramme(programmeId) {
    try {
      if (this.cache[programmeId]) {
        return this.cache[programmeId];
      }

      const snapshot = await db.collection('presences')
        .where('programme_id', '==', programmeId)
        .get();

      const presences = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      this.cache[programmeId] = presences;
      return presences;
    } catch (error) {
      console.error('Erreur chargement présences:', error);
      return [];
    }
  },

  // Charger les présences d'un membre
  async loadByMembre(membreId, dateDebut = null, dateFin = null) {
    try {
      let query = db.collection('presences')
        .where('disciple_id', '==', membreId);

      const snapshot = await query.get();
      let presences = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filtrer par date si nécessaire
      if (dateDebut || dateFin) {
        presences = presences.filter(p => {
          const programme = Programmes.getById(p.programme_id);
          if (!programme || !programme.date_debut) return false;
          const d = programme.date_debut.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);
          if (dateDebut && d < dateDebut) return false;
          if (dateFin && d > dateFin) return false;
          return true;
        });
      }

      return presences;
    } catch (error) {
      console.error('Erreur chargement présences membre:', error);
      return [];
    }
  },

  // Enregistrer/modifier les présences d'un programme
  async saveForProgramme(programmeId, presencesData) {
    try {
      const batch = db.batch();

      for (const presence of presencesData) {
        if (presence.id) {
          // Mise à jour
          const ref = db.collection('presences').doc(presence.id);
          batch.update(ref, {
            statut: presence.statut,
            commentaire: presence.commentaire || null,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Création
          const ref = db.collection('presences').doc();
          batch.set(ref, {
            programme_id: programmeId,
            disciple_id: presence.disciple_id,
            mentor_id: AppState.user.id,
            statut: presence.statut,
            commentaire: presence.commentaire || null,
            date_pointage: firebase.firestore.FieldValue.serverTimestamp(),
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      await batch.commit();

      // Invalider le cache
      delete this.cache[programmeId];

      Toast.success('Présences enregistrées');
      return true;
    } catch (error) {
      console.error('Erreur enregistrement présences:', error);
      Toast.error('Erreur lors de l\'enregistrement');
      return false;
    }
  },

  // Obtenir la présence d'un membre pour un programme
  getPresence(programmeId, membreId) {
    const presences = this.cache[programmeId] || [];
    return presences.find(p => p.disciple_id === membreId);
  },

  // Statuts possibles
  getStatuts() {
    return [
      { value: 'present', label: 'Présent', icon: 'fa-check-circle', color: '#4CAF50' },
      { value: 'absent', label: 'Absent', icon: 'fa-times-circle', color: '#F44336' },
      { value: 'excuse', label: 'Excusé', icon: 'fa-info-circle', color: '#FF9800' },
      { value: 'non_renseigne', label: 'Non renseigné', icon: 'fa-question-circle', color: '#9E9E9E' }
    ];
  },

  getStatutLabel(statut) {
    const found = this.getStatuts().find(s => s.value === statut);
    return found ? found.label : statut;
  },

  getStatutColor(statut) {
    const found = this.getStatuts().find(s => s.value === statut);
    return found ? found.color : '#9E9E9E';
  },

  // Vérifier si un programme est complètement pointé
  async isProgrammeFullyPointed(programmeId) {
    try {
      // Obtenir les membres à pointer selon le rôle
      let membresAttendus = [];
      if (Permissions.hasRole('adjoint_superviseur')) {
        membresAttendus = AppState.membres.filter(m => m.statut_compte === 'actif');
      } else if (Permissions.hasRole('mentor')) {
        membresAttendus = Membres.getDisciples(AppState.user.id);
      } else {
        // Les disciples/nouveaux ne peuvent pas pointer
        return true;
      }

      if (membresAttendus.length === 0) return true;

      // Charger les présences du programme
      const presences = await this.loadByProgramme(programmeId);
      
      // Vérifier si tous les membres attendus ont été pointés (statut différent de "non_renseigne")
      const membresPointes = new Set(
        presences
          .filter(p => p.statut !== 'non_renseigne')
          .map(p => p.disciple_id)
      );

      // Un programme est complètement pointé si tous les membres attendus ont un statut défini
      return membresAttendus.every(m => membresPointes.has(m.id));
    } catch (error) {
      console.error('Erreur vérification pointage:', error);
      return false;
    }
  },

  // Obtenir les programmes passés récents non complètement pointés
  async getUnpointedProgrammes(days = 7) {
    try {
      const programmesRecents = Programmes.getRecentPast(days);
      const programmesNonPointes = [];

      for (const programme of programmesRecents) {
        const estCompletementPointé = await this.isProgrammeFullyPointed(programme.id);
        if (!estCompletementPointé) {
          programmesNonPointes.push(programme);
        }
      }

      return programmesNonPointes.slice(0, 5); // Limiter à 5 programmes
    } catch (error) {
      console.error('Erreur récupération programmes non pointés:', error);
      return [];
    }
  }
};

// ============================================
// PAGES PROGRAMMES ET CALENDRIER
// ============================================

const DEFAULT_PAGE_SIZE_PROGRAMMES = 10;

const PagesCalendrier = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  showAllProgrammes: false,

  // Page calendrier (unifié : programmes + sessions évangélisation)
  async renderCalendrier() {
    const year = this.currentYear;
    const month = this.currentMonth;
    const programmes = Programmes.getByMonth(year, month);

    let sessionsEvang = [];
    if (typeof EvangelisationData !== 'undefined') {
      try {
        await EvangelisationData.loadSessions();
        sessionsEvang = (EvangelisationData.sessions || []).filter(s => {
          const d = s.date?.toDate ? s.date.toDate() : new Date(s.date || 0);
          return d.getFullYear() === year && d.getMonth() === month;
        });
      } catch (e) {
        console.warn('Calendrier: chargement sessions évangélisation ignoré', e);
      }
    }

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; // Lundi = 0

    const programmesByDay = {};
    programmes.forEach(p => {
      const d = p.date_debut.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
      const day = d.getDate();
      if (!programmesByDay[day]) programmesByDay[day] = [];
      programmesByDay[day].push({ ...p, _type: 'programme' });
    });
    sessionsEvang.forEach(s => {
      const d = s.date?.toDate ? s.date.toDate() : new Date(s.date || 0);
      const day = d.getDate();
      if (!programmesByDay[day]) programmesByDay[day] = [];
      programmesByDay[day].push({ ...s, _type: 'evangelisation' });
    });

    let calendarHtml = '';
    let dayCount = 1;
    const today = new Date();

    for (let week = 0; week < 6; week++) {
      let weekHtml = '<tr>';
      for (let day = 0; day < 7; day++) {
        if ((week === 0 && day < startDay) || dayCount > daysInMonth) {
          weekHtml += '<td class="calendar-day empty"></td>';
        } else {
          const isToday = today.getDate() === dayCount && 
                          today.getMonth() === month && 
                          today.getFullYear() === year;
          const dayProgrammes = programmesByDay[dayCount] || [];
          
          weekHtml += `
            <td class="calendar-day ${isToday ? 'today' : ''}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}">
              <div class="day-number">${dayCount}</div>
              <div class="day-events">
                ${dayProgrammes.slice(0, 4).map(item => {
                  if (item._type === 'evangelisation') {
                    const nom = item.secteur_nom || 'Évangélisation';
                    return `<div class="event-badge event-evangelisation" style="background: #1976D2" 
                             onclick="App.navigate('evangelisation-detail', { id: '${item.id}' })" title="${Utils.escapeHtml(nom)}">
                      <i class="fas fa-bullhorn"></i> ${Utils.escapeHtml(nom.substring(0, 12))}${nom.length > 12 ? '...' : ''}
                    </div>`;
                  }
                  return `<div class="event-badge" style="background: ${Programmes.getTypeColor(item.type)}" 
                           onclick="App.viewProgramme('${item.id}')" title="${Utils.escapeHtml(item.nom)}">
                    ${Utils.escapeHtml(item.nom.substring(0, 15))}${item.nom.length > 15 ? '...' : ''}
                  </div>`;
                }).join('')}
                ${dayProgrammes.length > 4 ? `<div class="event-more">+${dayProgrammes.length - 4} autre(s)</div>` : ''}
              </div>
            </td>
          `;
          dayCount++;
        }
      }
      weekHtml += '</tr>';
      calendarHtml += weekHtml;
      if (dayCount > daysInMonth) break;
    }

    return `
      <div class="calendar-header">
        <div class="calendar-nav">
          <button class="btn btn-icon btn-secondary" onclick="PagesCalendrier.prevMonth()">
            <i class="fas fa-chevron-left"></i>
          </button>
          <h2 class="calendar-title">${monthNames[month]} ${year}</h2>
          <button class="btn btn-icon btn-secondary" onclick="PagesCalendrier.nextMonth()">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        <div class="calendar-actions">
          <button class="btn btn-secondary" onclick="PagesCalendrier.goToToday()">
            <i class="fas fa-calendar-day"></i> Aujourd'hui
          </button>
          ${Permissions.canManagePrograms() ? `
          <button class="btn btn-primary" onclick="App.navigate('programmes-add')">
            <i class="fas fa-plus"></i> Ajouter
          </button>
          ` : ''}
        </div>
      </div>

      <div class="card">
        <div class="calendar-container">
          <table class="calendar-table">
            <thead>
              <tr>
                <th>Lun</th><th>Mar</th><th>Mer</th><th>Jeu</th><th>Ven</th><th>Sam</th><th>Dim</th>
              </tr>
            </thead>
            <tbody>
              ${calendarHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="calendar-legend mt-3">
        <h4>Légende</h4>
        <div class="legend-items">
          ${Programmes.getTypes().map(t => `
            <div class="legend-item">
              <span class="legend-color" style="background: ${t.color}"></span>
              <span>${t.label}</span>
            </div>
          `).join('')}
          <div class="legend-item">
            <span class="legend-color" style="background: #1976D2"></span>
            <span>Évangélisation</span>
          </div>
        </div>
      </div>

      <style>
        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .calendar-nav {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        .calendar-title {
          min-width: 200px;
          text-align: center;
          margin: 0;
        }
        .calendar-actions {
          display: flex;
          gap: var(--spacing-sm);
        }
        .calendar-container {
          overflow-x: auto;
        }
        .calendar-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .calendar-table th {
          padding: var(--spacing-sm);
          text-align: center;
          background: var(--bg-primary);
          font-weight: 600;
          font-size: 0.85rem;
        }
        .calendar-day {
          border: 1px solid var(--border-color);
          vertical-align: top;
          height: 100px;
          padding: var(--spacing-xs);
          cursor: pointer;
          transition: background 0.2s;
        }
        .calendar-day:hover {
          background: var(--bg-primary);
        }
        .calendar-day.empty {
          background: var(--bg-tertiary);
          cursor: default;
        }
        .calendar-day.today {
          background: rgba(45, 90, 123, 0.1);
        }
        .calendar-day.today .day-number {
          background: var(--primary);
          color: white;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .day-number {
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: var(--spacing-xs);
        }
        .day-events {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .event-badge {
          font-size: 0.7rem;
          padding: 2px 4px;
          border-radius: 3px;
          color: white;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .event-badge:hover {
          opacity: 0.9;
        }
        .event-more {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
        .calendar-legend {
          padding: var(--spacing-md);
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
        }
        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-md);
          margin-top: var(--spacing-sm);
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.85rem;
        }
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }
        @media (max-width: 768px) {
          .calendar-day { height: 70px; }
          .event-badge { font-size: 0.6rem; }
        }
      </style>
    `;
  },

  async prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    document.querySelector('.page-content').innerHTML = await this.renderCalendrier();
  },

  async nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    document.querySelector('.page-content').innerHTML = await this.renderCalendrier();
  },

  async goToToday() {
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth();
    document.querySelector('.page-content').innerHTML = await this.renderCalendrier();
  },

  // Liste des programmes (10 par défaut + Voir tout / Réduire)
  renderProgrammes() {
    const programmes = (AppState.programmes || []).slice().sort((a, b) => {
      const da = a.date_debut?.toDate ? a.date_debut.toDate() : new Date(a.date_debut || 0);
      const db = b.date_debut?.toDate ? b.date_debut.toDate() : new Date(b.date_debut || 0);
      return db - da;
    });
    const displayed = this.showAllProgrammes ? programmes : programmes.slice(0, DEFAULT_PAGE_SIZE_PROGRAMMES);
    const hasMore = programmes.length > DEFAULT_PAGE_SIZE_PROGRAMMES;
    const listHtml = programmes.length > 0
      ? displayed.map(p => this.renderProgrammeCard(p)).join('')
      : `
              <div class="empty-state">
                <i class="fas fa-calendar-alt"></i>
                <h3>Aucun programme</h3>
                <p>Aucun programme n'a été créé pour cette famille.</p>
              </div>
            `;
    const voirToutHtml = programmes.length > 0
      ? `<div id="programmes-voir-tout-wrap" style="text-align: center; padding: var(--spacing-md); border-top: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-muted); background: var(--bg-secondary, #f8f9fa);">
           ${hasMore ? `<button type="button" class="btn btn-outline" onclick="PagesCalendrier.toggleVoirToutProgrammes()">
             <i class="fas fa-chevron-${this.showAllProgrammes ? 'up' : 'down'}"></i>
             ${this.showAllProgrammes ? 'Réduire' : `Voir tout (${programmes.length} au total)`}
           </button>` : ''}
           <p class="mt-2 mb-0" style="font-size: 0.85rem;">${displayed.length} programme(s) affiché(s)${programmes.length > displayed.length ? ` sur ${programmes.length}` : ''}${!hasMore && programmes.length > 0 ? ' (affichage limité à 10 par défaut lorsqu\'il y en a plus)' : ''}</p>
         </div>`
      : '';

    return `
      <div class="members-header">
        <div class="members-filters">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" class="form-control" id="search-programmes" 
                   placeholder="Rechercher..." onkeyup="App.filterProgrammes()">
          </div>
          <select class="form-control" id="filter-type" onchange="App.filterProgrammes()" style="width: auto;">
            <option value="">Tous les types</option>
            ${Programmes.getTypes().map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </div>
        ${Permissions.canManagePrograms() ? `
        <button class="btn btn-primary" onclick="App.navigate('programmes-add')">
          <i class="fas fa-plus"></i> Nouveau programme
        </button>
        ` : ''}
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div id="programmes-list">
            ${listHtml}
          </div>
          ${voirToutHtml}
        </div>
      </div>
    `;
  },

  toggleVoirToutProgrammes() {
    this.showAllProgrammes = !this.showAllProgrammes;
    this.refreshProgrammesList();
  },

  refreshProgrammesList() {
    const programmes = (AppState.programmes || []).slice().sort((a, b) => {
      const da = a.date_debut?.toDate ? a.date_debut.toDate() : new Date(a.date_debut || 0);
      const db = b.date_debut?.toDate ? b.date_debut.toDate() : new Date(b.date_debut || 0);
      return db - da;
    });
    const displayed = this.showAllProgrammes ? programmes : programmes.slice(0, DEFAULT_PAGE_SIZE_PROGRAMMES);
    const hasMore = programmes.length > DEFAULT_PAGE_SIZE_PROGRAMMES;
    const listEl = document.getElementById('programmes-list');
    if (listEl) {
      listEl.innerHTML = programmes.length > 0
        ? displayed.map(p => this.renderProgrammeCard(p)).join('')
        : `<div class="empty-state"><i class="fas fa-calendar-alt"></i><h3>Aucun programme</h3><p>Aucun programme n'a été créé pour cette famille.</p></div>`;
    }
    const wrapEl = document.getElementById('programmes-voir-tout-wrap');
    if (wrapEl) {
      wrapEl.innerHTML = (hasMore ? `<button type="button" class="btn btn-outline" onclick="PagesCalendrier.toggleVoirToutProgrammes()">
             <i class="fas fa-chevron-${this.showAllProgrammes ? 'up' : 'down'}"></i>
             ${this.showAllProgrammes ? 'Réduire' : `Voir tout (${programmes.length} au total)`}
           </button>` : '') + `<p class="mt-2 mb-0" style="font-size: 0.85rem;">${displayed.length} programme(s) affiché(s)${programmes.length > displayed.length ? ` sur ${programmes.length}` : ''}</p>`;
    }
    if (typeof App !== 'undefined' && App.filterProgrammes) App.filterProgrammes();
  },

  renderProgrammeCard(programme) {
    const date = programme.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);
    const isPast = date < new Date();

    return `
      <div class="programme-card ${isPast ? 'past' : ''}" data-id="${programme.id}" 
           data-type="${programme.type}" data-name="${programme.nom.toLowerCase()}">
        <div class="programme-date">
          <div class="date-day">${date.getDate()}</div>
          <div class="date-month">${date.toLocaleString('fr-FR', { month: 'short' })}</div>
          <div class="date-year">${date.getFullYear()}</div>
        </div>
        <div class="programme-info">
          <div class="programme-name">${Utils.escapeHtml(programme.nom)}</div>
          <div class="programme-meta">
            <span class="programme-type" style="color: ${Programmes.getTypeColor(programme.type)}">
              <i class="fas fa-tag"></i> ${Programmes.getTypeLabel(programme.type)}
            </span>
            ${programme.lieu ? `<span><i class="fas fa-map-marker-alt"></i> ${Utils.escapeHtml(programme.lieu)}</span>` : ''}
            <span><i class="fas fa-clock"></i> ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div class="programme-actions">
          <button class="btn btn-sm btn-secondary" onclick="App.viewProgramme('${programme.id}')" title="Voir">
            <i class="fas fa-eye"></i>
          </button>
          ${Permissions.canMarkPresence() ? `
          <button class="btn btn-sm btn-primary" onclick="App.navigate('presences', {programmeId: '${programme.id}'})" title="Présences">
            <i class="fas fa-clipboard-check"></i>
          </button>
          ` : ''}
          ${Permissions.canManagePrograms() ? `
          <button class="btn btn-sm btn-secondary" onclick="App.editProgramme('${programme.id}')" title="Modifier">
            <i class="fas fa-edit"></i>
          </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  // Formulaire ajout/édition programme
  renderProgrammeForm(programmeId = null) {
    const programme = programmeId ? Programmes.getById(programmeId) : null;
    const isEdit = !!programme;

    const getDateTimeValue = (date) => {
      if (!date) return '';
      const d = date.toDate ? date.toDate() : new Date(date);
      const y = d.getFullYear();
      if (y < 1900 || y > 2100) return '';
      return d.toISOString().slice(0, 16);
    };

    const now = new Date();
    const minDateTime = '2000-01-01T00:00';
    const maxDate = new Date(now);
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    const maxDateTime = maxDate.toISOString().slice(0, 16);

    return `
      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title">
            <i class="fas fa-calendar-plus"></i> 
            ${isEdit ? 'Modifier le programme' : 'Nouveau programme'}
          </h3>
        </div>
        <div class="card-body">
          <form id="form-programme" onsubmit="App.submitProgramme(event, ${isEdit ? `'${programmeId}'` : 'null'})">
            <div class="form-group">
              <label class="form-label required">Nom du programme</label>
              <input type="text" class="form-control" id="prog-nom" 
                     value="${programme ? Utils.escapeHtml(programme.nom) : ''}" required>
            </div>

            <div class="form-group">
              <label class="form-label required">Type</label>
              <select class="form-control" id="prog-type" required>
                <option value="">-- Sélectionner --</option>
                ${Programmes.getTypes().map(t => `
                  <option value="${t.value}" ${programme?.type === t.value ? 'selected' : ''}>
                    ${t.label}
                  </option>
                `).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
              <div class="form-group">
                <label class="form-label required">Date et heure de début</label>
                <input type="datetime-local" class="form-control" id="prog-debut" 
                       min="${minDateTime}" max="${maxDateTime}" value="${getDateTimeValue(programme?.date_debut)}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Date et heure de fin</label>
                <input type="datetime-local" class="form-control" id="prog-fin"
                       min="${minDateTime}" max="${maxDateTime}" value="${getDateTimeValue(programme?.date_fin)}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Lieu</label>
              <input type="text" class="form-control" id="prog-lieu" 
                     value="${programme?.lieu || ''}" placeholder="Ex: Salle principale">
            </div>

            <div class="form-group">
              <label class="form-label">Récurrence</label>
              <select class="form-control" id="prog-recurrence">
                <option value="unique" ${programme?.recurrence === 'unique' ? 'selected' : ''}>Unique</option>
                <option value="hebdomadaire" ${programme?.recurrence === 'hebdomadaire' ? 'selected' : ''}>Hebdomadaire</option>
                <option value="mensuel" ${programme?.recurrence === 'mensuel' ? 'selected' : ''}>Mensuel</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-control" id="prog-description" rows="3">${programme?.description || ''}</textarea>
            </div>

            <div class="d-flex gap-2" style="justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="App.navigate('programmes')">Annuler</button>
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i> ${isEdit ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // Détails d'un programme
  renderProgrammeDetail(programmeId) {
    const programme = Programmes.getById(programmeId);
    if (!programme) return '<div class="alert alert-danger">Programme non trouvé</div>';

    const dateDebut = programme.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme.date_debut);
    const dateFin = programme.date_fin?.toDate ? programme.date_fin.toDate() : null;
    const createur = Membres.getById(programme.created_by);

    return `
      <div class="card" style="max-width: 700px; margin: 0 auto;">
        <div class="card-header">
          <div>
            <h3 class="card-title mb-0">${Utils.escapeHtml(programme.nom)}</h3>
            <span class="badge" style="background: ${Programmes.getTypeColor(programme.type)}; color: white;">
              ${Programmes.getTypeLabel(programme.type)}
            </span>
          </div>
          <div class="d-flex gap-1">
            ${Permissions.canMarkPresence() ? `
            <button class="btn btn-primary" onclick="App.navigate('presences', {programmeId: '${programmeId}'})">
              <i class="fas fa-clipboard-check"></i> Pointer
            </button>
            ` : ''}
            ${Permissions.canManagePrograms() ? `
            <button class="btn btn-secondary" onclick="App.editProgramme('${programmeId}')">
              <i class="fas fa-edit"></i>
            </button>
            ` : ''}
          </div>
        </div>
        <div class="card-body">
          <div class="programme-details">
            <div class="detail-item">
              <i class="fas fa-calendar"></i>
              <div>
                <strong>Date</strong>
                <p>${Utils.formatDate(dateDebut, 'full')}</p>
              </div>
            </div>
            <div class="detail-item">
              <i class="fas fa-clock"></i>
              <div>
                <strong>Horaire</strong>
                <p>${dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                   ${dateFin ? ` - ${dateFin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
              </div>
            </div>
            ${programme.lieu ? `
            <div class="detail-item">
              <i class="fas fa-map-marker-alt"></i>
              <div>
                <strong>Lieu</strong>
                <p>${Utils.escapeHtml(programme.lieu)}</p>
              </div>
            </div>
            ` : ''}
            <div class="detail-item">
              <i class="fas fa-redo"></i>
              <div>
                <strong>Récurrence</strong>
                <p>${programme.recurrence === 'unique' ? 'Événement unique' : 
                     programme.recurrence === 'hebdomadaire' ? 'Chaque semaine' : 'Chaque mois'}</p>
              </div>
            </div>
          </div>
          
          ${programme.description ? `
          <div class="mt-3">
            <h4>Description</h4>
            <p>${Utils.escapeHtml(programme.description)}</p>
          </div>
          ` : ''}
        </div>
        <div class="card-footer text-muted" style="font-size: 0.85rem;">
          Créé par ${createur ? `${createur.prenom} ${createur.nom}` : 'Inconnu'}
          le ${Utils.formatDate(programme.created_at, 'full')}
        </div>
      </div>

      <style>
        .programme-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-lg);
        }
        .detail-item {
          display: flex;
          gap: var(--spacing-md);
        }
        .detail-item i {
          color: var(--primary);
          font-size: 1.2rem;
          margin-top: 4px;
        }
        .detail-item p {
          margin: 0;
          color: var(--text-secondary);
        }
      </style>
    `;
  }
};

// Styles supplémentaires pour les programmes
const programmeStyles = `
  .programme-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
    transition: background 0.2s;
  }
  .programme-card:hover {
    background: var(--bg-primary);
  }
  .programme-card.past {
    opacity: 0.6;
  }
  .programme-date {
    text-align: center;
    min-width: 60px;
    padding: var(--spacing-sm);
    background: var(--bg-primary);
    border-radius: var(--radius-md);
  }
  .date-day {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
  }
  .date-month {
    font-size: 0.8rem;
    text-transform: uppercase;
    color: var(--text-secondary);
  }
  .date-year {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .programme-info {
    flex: 1;
  }
  .programme-name {
    font-weight: 600;
    margin-bottom: var(--spacing-xs);
  }
  .programme-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .programme-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .programme-actions {
    display: flex;
    gap: var(--spacing-xs);
  }
`;

// Injecter les styles
if (!document.getElementById('programme-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'programme-styles';
  styleEl.textContent = programmeStyles;
  document.head.appendChild(styleEl);
}
