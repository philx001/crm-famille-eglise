// ============================================
// MODULE ÉVANGÉLISATION
// Gestion des sessions d'évangélisation et des secteurs
// ============================================

// ============================================
// DONNÉES ET CONSTANTES
// ============================================

const EvangelisationData = {
  sessions: [],
  secteurs: [],
  loaded: false
};

// Statuts des sessions
const SESSION_STATUTS = [
  { value: 'planifiee', label: 'Planifiée', color: '#2196F3', icon: 'fa-calendar' },
  { value: 'en_cours', label: 'En cours', color: '#FF9800', icon: 'fa-walking' },
  { value: 'terminee', label: 'Terminée', color: '#4CAF50', icon: 'fa-check-circle' },
  { value: 'annulee', label: 'Annulée', color: '#9E9E9E', icon: 'fa-times-circle' }
];

// Statuts de présence des participants mobilisés
const PARTICIPANT_STATUTS = [
  { value: 'planifie', label: 'Mobilisé', color: '#2196F3', icon: 'fa-user-clock' },
  { value: 'present', label: 'Présent', color: '#4CAF50', icon: 'fa-check-circle' },
  { value: 'absent', label: 'Absent', color: '#F44336', icon: 'fa-times-circle' },
  { value: 'excuse', label: 'Excusé', color: '#FF9800', icon: 'fa-user-minus' }
];

// ============================================
// GESTION DES SECTEURS
// ============================================

const Secteurs = {
  // Charger tous les secteurs
  async loadAll() {
    try {
      const snapshot = await db.collection('secteurs_evangelisation')
        .orderBy('nom')
        .get();
      
      EvangelisationData.secteurs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return EvangelisationData.secteurs;
    } catch (error) {
      console.error('Erreur chargement secteurs:', error);
      // Retourner un tableau vide en cas d'erreur
      EvangelisationData.secteurs = [];
      return [];
    }
  },

  // Obtenir tous les secteurs
  getAll() {
    return EvangelisationData.secteurs;
  },

  // Obtenir un secteur par ID
  getById(id) {
    return EvangelisationData.secteurs.find(s => s.id === id);
  },

  // Créer un secteur
  async create(data) {
    try {
      if (!Permissions.hasRole('adjoint_superviseur')) {
        Toast.error('Permission refusée');
        return null;
      }
      
      const secteur = {
        nom: data.nom.trim(),
        description: data.description || null,
        quartiers: data.quartiers || [],
        actif: true,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('secteurs_evangelisation').add(secteur);
      
      const created = { id: docRef.id, ...secteur };
      EvangelisationData.secteurs.push(created);
      EvangelisationData.secteurs.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      
      Toast.success('Secteur créé avec succès');
      return created;
    } catch (error) {
      console.error('Erreur création secteur:', error);
      Toast.error('Erreur lors de la création du secteur');
      return null;
    }
  },

  // Modifier un secteur
  async update(id, data) {
    try {
      if (!Permissions.hasRole('adjoint_superviseur')) {
        Toast.error('Permission refusée');
        return false;
      }
      
      await db.collection('secteurs_evangelisation').doc(id).update({
        ...data,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      const index = EvangelisationData.secteurs.findIndex(s => s.id === id);
      if (index !== -1) {
        EvangelisationData.secteurs[index] = { ...EvangelisationData.secteurs[index], ...data };
      }
      
      Toast.success('Secteur mis à jour');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour secteur:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  // Supprimer un secteur
  async delete(id) {
    try {
      if (!Permissions.hasRole('adjoint_superviseur')) {
        Toast.error('Permission refusée');
        return false;
      }
      
      await db.collection('secteurs_evangelisation').doc(id).delete();
      EvangelisationData.secteurs = EvangelisationData.secteurs.filter(s => s.id !== id);
      
      Toast.success('Secteur supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression secteur:', error);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  }
};

// ============================================
// GESTION DES SESSIONS D'ÉVANGÉLISATION
// ============================================

const SessionsEvangelisation = {
  // Charger toutes les sessions de la famille
  async loadAll() {
    try {
      if (!AppState.famille?.id) return [];
      
      const snapshot = await db.collection('sessions_evangelisation')
        .where('famille_id', '==', AppState.famille.id)
        .get();
      
      EvangelisationData.sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Trier par date (plus récente en premier)
      EvangelisationData.sessions.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return dateB - dateA;
      });
      
      EvangelisationData.loaded = true;
      return EvangelisationData.sessions;
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      Toast.error('Erreur lors du chargement des sessions');
      return [];
    }
  },

  // Obtenir toutes les sessions
  getAll() {
    return EvangelisationData.sessions;
  },

  // Obtenir une session par ID
  getById(id) {
    return EvangelisationData.sessions.find(s => s.id === id);
  },

  // Obtenir les sessions à venir
  getUpcoming(limit = 5) {
    const now = new Date();
    return EvangelisationData.sessions
      .filter(s => {
        const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
        return date >= now && s.statut !== 'annulee';
      })
      .sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateA - dateB;
      })
      .slice(0, limit);
  },

  // Obtenir les sessions passées
  getPast(limit = 10) {
    const now = new Date();
    return EvangelisationData.sessions
      .filter(s => {
        const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
        return date < now || s.statut === 'terminee';
      })
      .slice(0, limit);
  },

  // Créer une session
  async create(data) {
    try {
      if (!Permissions.hasRole('adjoint_superviseur')) {
        Toast.error('Permission refusée');
        return null;
      }
      
      const session = {
        date: data.date,
        heure_debut: data.heure_debut,
        heure_fin: data.heure_fin || null,
        secteur_id: data.secteur_id || null,
        secteur_nom: data.secteur_nom || null,
        lieu_rdv: data.lieu_rdv || null,
        responsable_id: data.responsable_id || AppState.user.id,
        responsable_nom: data.responsable_nom || `${AppState.user.prenom} ${AppState.user.nom}`,
        participants: data.participants || [],
        statut: 'planifiee',
        nb_contacts: 0,
        contacts: [],
        notes: data.notes || null,
        bilan: null,
        famille_id: AppState.famille.id,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('sessions_evangelisation').add(session);
      
      const created = { id: docRef.id, ...session };
      EvangelisationData.sessions.unshift(created);
      
      Toast.success('Session planifiée avec succès');
      return created;
    } catch (error) {
      console.error('Erreur création session:', error);
      Toast.error('Erreur lors de la création de la session');
      return null;
    }
  },

  // Modifier une session
  async update(id, data) {
    try {
      if (!Permissions.hasRole('adjoint_superviseur')) {
        Toast.error('Permission refusée');
        return false;
      }
      
      await db.collection('sessions_evangelisation').doc(id).update({
        ...data,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      const index = EvangelisationData.sessions.findIndex(s => s.id === id);
      if (index !== -1) {
        EvangelisationData.sessions[index] = { ...EvangelisationData.sessions[index], ...data };
      }
      
      Toast.success('Session mise à jour');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour session:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  // Ajouter un contact à une session
  async addContact(sessionId, contactData) {
    try {
      const session = this.getById(sessionId);
      if (!session) {
        Toast.error('Session non trouvée');
        return false;
      }
      
      const contact = {
        id: Date.now().toString(),
        prenom: contactData.prenom,
        nom: contactData.nom || '',
        telephone: contactData.telephone,
        lieu: contactData.lieu || null,
        notes: contactData.notes || null,
        ajoute_par_id: AppState.user.id,
        ajoute_par_nom: `${AppState.user.prenom} ${AppState.user.nom}`,
        created_at: new Date().toISOString()
      };
      
      const contacts = [...(session.contacts || []), contact];
      
      await db.collection('sessions_evangelisation').doc(sessionId).update({
        contacts: contacts,
        nb_contacts: contacts.length,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Mettre à jour le cache
      const index = EvangelisationData.sessions.findIndex(s => s.id === sessionId);
      if (index !== -1) {
        EvangelisationData.sessions[index].contacts = contacts;
        EvangelisationData.sessions[index].nb_contacts = contacts.length;
      }
      
      Toast.success('Contact ajouté');
      return contact;
    } catch (error) {
      console.error('Erreur ajout contact:', error);
      Toast.error('Erreur lors de l\'ajout du contact');
      return false;
    }
  },

  // Modifier un contact
  async updateContact(sessionId, contactId, contactData) {
    try {
      const session = this.getById(sessionId);
      if (!session) {
        Toast.error('Session non trouvée');
        return false;
      }
      
      const contacts = [...(session.contacts || [])];
      const index = contacts.findIndex(c => c.id === contactId);
      
      if (index === -1) {
        Toast.error('Contact non trouvé');
        return false;
      }
      
      // Mettre à jour le contact
      contacts[index] = {
        ...contacts[index],
        prenom: contactData.prenom,
        nom: contactData.nom || '',
        telephone: contactData.telephone,
        lieu: contactData.lieu || null,
        notes: contactData.notes || null,
        updated_at: new Date().toISOString()
      };
      
      await db.collection('sessions_evangelisation').doc(sessionId).update({
        contacts: contacts,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Mettre à jour le cache
      const sessionIndex = EvangelisationData.sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        EvangelisationData.sessions[sessionIndex].contacts = contacts;
      }
      
      Toast.success('Contact mis à jour');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour contact:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  // Supprimer un contact
  async deleteContact(sessionId, contactId) {
    try {
      const session = this.getById(sessionId);
      if (!session) return false;
      
      const contacts = (session.contacts || []).filter(c => c.id !== contactId);
      
      await db.collection('sessions_evangelisation').doc(sessionId).update({
        contacts: contacts,
        nb_contacts: contacts.length,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Mettre à jour le cache
      const sessionIndex = EvangelisationData.sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        EvangelisationData.sessions[sessionIndex].contacts = contacts;
        EvangelisationData.sessions[sessionIndex].nb_contacts = contacts.length;
      }
      
      Toast.success('Contact supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression contact:', error);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  },

  // Convertir un contact en nouvelle âme
  async convertContactToNouvelleAme(sessionId, contactId) {
    try {
      const session = this.getById(sessionId);
      if (!session) return false;
      
      const contact = session.contacts?.find(c => c.id === contactId);
      if (!contact) return false;
      
      // Créer la nouvelle âme
      const nouvelleAme = await NouvellesAmes.create({
        prenom: contact.prenom,
        nom: contact.nom,
        telephone: contact.telephone,
        canal: 'evangelisation',
        lieu_contact: contact.lieu || session.lieu_rdv,
        commentaires: contact.notes
      });
      
      if (nouvelleAme) {
        Toast.success(`${contact.prenom} ajouté(e) aux nouvelles âmes`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur conversion contact:', error);
      Toast.error('Erreur lors de la conversion');
      return false;
    }
  },

  // Terminer une session avec bilan
  async terminerSession(id, bilan) {
    try {
      await this.update(id, {
        statut: 'terminee',
        bilan: bilan
      });
      
      Toast.success('Session terminée');
      return true;
    } catch (error) {
      console.error('Erreur terminaison session:', error);
      return false;
    }
  },

  // Obtenir les statistiques
  getStats() {
    const sessions = EvangelisationData.sessions;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const sessionsThisMonth = sessions.filter(s => {
      const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      return date >= thisMonth;
    });
    
    return {
      totalSessions: sessions.length,
      sessionsThisMonth: sessionsThisMonth.length,
      totalContacts: sessions.reduce((sum, s) => sum + (s.nb_contacts || 0), 0),
      contactsThisMonth: sessionsThisMonth.reduce((sum, s) => sum + (s.nb_contacts || 0), 0),
      upcoming: this.getUpcoming().length
    };
  },

  // Statistiques détaillées pour évangélisation
  getDetailedStats() {
    const sessions = EvangelisationData.sessions;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const sessionsThisMonth = sessions.filter(s => {
      const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      return date >= thisMonth;
    });

    const sessionsPastSixMonths = sessions.filter(s => {
      const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      return date >= sixMonthsAgo;
    });

    // Stats participants (mobilisation et présence)
    let totalMobilisations = 0;
    let totalPresents = 0;
    let totalAbsents = 0;
    let totalExcuses = 0;
    const participationsByMembre = {};

    sessions.forEach(s => {
      (s.participants || []).forEach(p => {
        totalMobilisations++;
        if (p.statut_presence === 'present') totalPresents++;
        else if (p.statut_presence === 'absent') totalAbsents++;
        else if (p.statut_presence === 'excuse') totalExcuses++;

        const mid = p.membre_id;
        if (!participationsByMembre[mid]) {
          participationsByMembre[mid] = { membre_id: mid, membre_nom: `${p.membre_prenom || ''} ${p.membre_nom || ''}`.trim(), mobilisations: 0, presents: 0 };
        }
        participationsByMembre[mid].mobilisations++;
        if (p.statut_presence === 'present') participationsByMembre[mid].presents++;
      });
    });

    const tauxPresence = totalMobilisations > 0 ? Math.round((totalPresents / totalMobilisations) * 1000) / 10 : 0;
    const topParticipants = Object.values(participationsByMembre)
      .sort((a, b) => b.mobilisations - a.mobilisations)
      .slice(0, 10)
      .map(p => ({ ...p, tauxPresence: p.mobilisations > 0 ? Math.round((p.presents / p.mobilisations) * 1000) / 10 : 0 }));

    // Stats par secteur
    const statsBySecteur = {};
    sessions.forEach(s => {
      const secteur = s.secteur_nom || 'Non défini';
      if (!statsBySecteur[secteur]) {
        statsBySecteur[secteur] = { secteur, sessions: 0, contacts: 0 };
      }
      statsBySecteur[secteur].sessions++;
      statsBySecteur[secteur].contacts += s.nb_contacts || 0;
    });
    const bySecteur = Object.values(statsBySecteur).sort((a, b) => b.sessions - a.sessions);

    // Stats par mois (6 derniers mois)
    const statsByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const sessMonth = sessions.filter(s => {
        const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
        return date >= d && date < next;
      });
      const contactsMonth = sessMonth.reduce((sum, s) => sum + (s.nb_contacts || 0), 0);
      statsByMonth.push({
        label: d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
        month: d.getMonth(),
        year: d.getFullYear(),
        sessions: sessMonth.length,
        contacts: contactsMonth
      });
    }

    return {
      totalSessions: sessions.length,
      sessionsThisMonth: sessionsThisMonth.length,
      totalContacts: sessions.reduce((sum, s) => sum + (s.nb_contacts || 0), 0),
      contactsThisMonth: sessionsThisMonth.reduce((sum, s) => sum + (s.nb_contacts || 0), 0),
      upcoming: this.getUpcoming().length,
      totalMobilisations,
      totalPresents,
      totalAbsents,
      totalExcuses,
      tauxPresence,
      topParticipants,
      bySecteur,
      statsByMonth
    };
  },

  // Getters
  getStatutLabel(value) {
    const statut = SESSION_STATUTS.find(s => s.value === value);
    return statut ? statut.label : value;
  },
  
  getStatutColor(value) {
    const statut = SESSION_STATUTS.find(s => s.value === value);
    return statut ? statut.color : '#9E9E9E';
  },
  
  getStatutIcon(value) {
    const statut = SESSION_STATUTS.find(s => s.value === value);
    return statut ? statut.icon : 'fa-circle';
  },

  // ========================================
  // MOBILISATION DES MEMBRES (participants)
  // ========================================

  // Ajouter un membre mobilisé à une session
  async addParticipant(sessionId, membreId) {
    try {
      const session = this.getById(sessionId);
      const membre = Membres.getById(membreId);
      if (!session || !membre) {
        Toast.error('Données non trouvées');
        return false;
      }
      const participants = session.participants || [];
      if (participants.some(p => p.membre_id === membreId)) {
        Toast.warning('Membre déjà mobilisé');
        return false;
      }
      const participant = {
        membre_id: membreId,
        membre_prenom: membre.prenom,
        membre_nom: membre.nom,
        statut_presence: 'planifie',
        date_inscription: new Date().toISOString(),
        inscrit_par_id: AppState.user.id,
        inscrit_par_nom: `${AppState.user.prenom} ${AppState.user.nom}`
      };
      const newParticipants = [...participants, participant];
      await db.collection('sessions_evangelisation').doc(sessionId).update({
        participants: newParticipants,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      const idx = EvangelisationData.sessions.findIndex(s => s.id === sessionId);
      if (idx !== -1) EvangelisationData.sessions[idx].participants = newParticipants;
      Toast.success(`${membre.prenom} ${membre.nom} mobilisé(e)`);
      return true;
    } catch (error) {
      console.error('Erreur mobilisation:', error);
      Toast.error('Erreur lors de la mobilisation');
      return false;
    }
  },

  // Retirer un membre mobilisé
  async removeParticipant(sessionId, membreId) {
    try {
      const session = this.getById(sessionId);
      if (!session) return false;
      const participants = (session.participants || []).filter(p => p.membre_id !== membreId);
      await db.collection('sessions_evangelisation').doc(sessionId).update({
        participants: participants,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      const idx = EvangelisationData.sessions.findIndex(s => s.id === sessionId);
      if (idx !== -1) EvangelisationData.sessions[idx].participants = participants;
      Toast.success('Participant retiré');
      return true;
    } catch (error) {
      console.error('Erreur retrait participant:', error);
      Toast.error('Erreur lors du retrait');
      return false;
    }
  },

  // Mettre à jour la présence d'un participant
  async updatePresence(sessionId, membreId, statutPresence) {
    try {
      const session = this.getById(sessionId);
      if (!session) return false;
      const participants = [...(session.participants || [])];
      const idx = participants.findIndex(p => p.membre_id === membreId);
      if (idx === -1) return false;
      participants[idx].statut_presence = statutPresence;
      await db.collection('sessions_evangelisation').doc(sessionId).update({
        participants: participants,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      const sessionIdx = EvangelisationData.sessions.findIndex(s => s.id === sessionId);
      if (sessionIdx !== -1) EvangelisationData.sessions[sessionIdx].participants = participants;
      Toast.success('Présence mise à jour');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour présence:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  getPresenceLabel(value) {
    const s = PARTICIPANT_STATUTS.find(x => x.value === value);
    return s ? s.label : value;
  },
  getPresenceColor(value) {
    const s = PARTICIPANT_STATUTS.find(x => x.value === value);
    return s ? s.color : '#9E9E9E';
  },
  getPresenceIcon(value) {
    const s = PARTICIPANT_STATUTS.find(x => x.value === value);
    return s ? s.icon : 'fa-circle';
  }
};

// ============================================
// PAGES ÉVANGÉLISATION
// ============================================

const PagesEvangelisation = {
  // Page principale évangélisation
  async render() {
    // Charger les données
    await Promise.all([
      SessionsEvangelisation.loadAll(),
      Secteurs.loadAll()
    ]);
    
    const stats = SessionsEvangelisation.getStats();
    const upcoming = SessionsEvangelisation.getUpcoming(5);
    const past = SessionsEvangelisation.getPast(10);
    const secteurs = Secteurs.getAll();
    
    return `
      <div class="evangelisation-header">
        <div class="stats-mini">
          <span class="stat-mini"><strong>${stats.totalSessions}</strong> sessions</span>
          <span class="stat-mini text-success"><strong>${stats.totalContacts}</strong> contacts</span>
          <span class="stat-mini text-primary"><strong>${stats.upcoming}</strong> à venir</span>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline" onclick="App.navigate('evangelisation-stats')">
            <i class="fas fa-chart-bar"></i> Statistiques
          </button>
          ${Permissions.hasRole('adjoint_superviseur') ? `
          <button class="btn btn-outline" onclick="App.navigate('evangelisation-planning')">
            <i class="fas fa-calendar-alt"></i> Planning
          </button>
          <button class="btn btn-outline" onclick="App.navigate('secteurs')">
            <i class="fas fa-map-marker-alt"></i> Secteurs
          </button>
          <button class="btn btn-primary" onclick="App.navigate('evangelisation-add')">
            <i class="fas fa-plus"></i> Nouvelle session
          </button>
          ` : ''}
        </div>
      </div>
      
      ${upcoming.length > 0 ? `
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-calendar-alt"></i> Sessions à venir</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          ${upcoming.map(s => this.renderSessionCard(s)).join('')}
        </div>
      </div>
      ` : `
      <div class="alert alert-info mb-3">
        <i class="fas fa-info-circle"></i>
        <div>Aucune session d'évangélisation planifiée. ${Permissions.hasRole('adjoint_superviseur') ? 'Créez-en une !' : ''}</div>
      </div>
      `}
      
      ${past.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-history"></i> Sessions passées</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          ${past.map(s => this.renderSessionCard(s)).join('')}
        </div>
      </div>
      ` : ''}
      
      <style>
        .evangelisation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .session-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background 0.2s;
        }
        .session-card:hover {
          background: var(--bg-primary);
        }
        .session-card:last-child {
          border-bottom: none;
        }
        .session-date {
          text-align: center;
          min-width: 60px;
          padding: var(--spacing-sm);
          background: var(--bg-primary);
          border-radius: var(--radius-sm);
        }
        .session-day {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
          line-height: 1;
        }
        .session-month {
          font-size: 0.7rem;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .session-info {
          flex: 1;
        }
        .session-title {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .session-meta {
          display: flex;
          gap: var(--spacing-md);
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .session-stats {
          display: flex;
          gap: var(--spacing-sm);
          align-items: center;
        }
        .contact-badge {
          background: var(--success);
          color: white;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          font-weight: 600;
        }
      </style>
    `;
  },

  // Carte d'une session
  renderSessionCard(session) {
    const date = session.date?.toDate ? session.date.toDate() : new Date(session.date);
    const secteur = session.secteur_nom || 'Non défini';
    
    return `
      <div class="session-card" onclick="App.navigate('evangelisation-detail', {id: '${session.id}'})">
        <div class="session-date">
          <div class="session-day">${date.getDate()}</div>
          <div class="session-month">${date.toLocaleString('fr-FR', { month: 'short' })}</div>
        </div>
        <div class="session-info">
          <div class="session-title">
            <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i>
            ${Utils.escapeHtml(secteur)}
          </div>
          <div class="session-meta">
            <span><i class="fas fa-clock"></i> ${session.heure_debut || '--:--'}</span>
            <span><i class="fas fa-user"></i> ${Utils.escapeHtml(session.responsable_nom || '-')}</span>
            ${session.lieu_rdv ? `<span><i class="fas fa-map-pin"></i> ${Utils.escapeHtml(session.lieu_rdv)}</span>` : ''}
          </div>
        </div>
        <div class="session-stats">
          <span class="contact-badge">
            <i class="fas fa-users"></i> ${session.nb_contacts || 0}
          </span>
          <span class="badge" style="background: ${SessionsEvangelisation.getStatutColor(session.statut)}20; color: ${SessionsEvangelisation.getStatutColor(session.statut)}">
            ${SessionsEvangelisation.getStatutLabel(session.statut)}
          </span>
        </div>
      </div>
    `;
  },

  // Page planning - vue sessions avec membres mobilisés
  async renderPlanning() {
    await Promise.all([
      SessionsEvangelisation.loadAll(),
      Secteurs.loadAll()
    ]);
    const upcoming = SessionsEvangelisation.getUpcoming(20);
    const past = SessionsEvangelisation.getPast(15);
    const allSessions = [...upcoming, ...past];
    
    return `
      <div class="planning-header">
        <h2><i class="fas fa-calendar-alt"></i> Planning évangélisation</h2>
        <div class="header-actions">
          <button class="btn btn-secondary" onclick="App.navigate('evangelisation')">
            <i class="fas fa-arrow-left"></i> Retour
          </button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-calendar-check"></i> Sessions et mobilisation</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          ${allSessions.length > 0 ? allSessions.map(s => this.renderPlanningSessionRow(s)).join('') : `
          <div class="empty-state" style="padding: var(--spacing-xl);">
            <i class="fas fa-calendar-times"></i>
            <h3>Aucune session</h3>
            <p>Créez des sessions d'évangélisation pour les planifier.</p>
          </div>
          `}
        </div>
      </div>
      
      <style>
        .planning-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); flex-wrap: wrap; gap: var(--spacing-md); }
        .planning-session-row {
          display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md); border-bottom: 1px solid var(--border-color); flex-wrap: wrap;
        }
        .planning-session-row:hover { background: var(--bg-primary); }
        .planning-session-row:last-child { border-bottom: none; }
        .planning-date { text-align: center; min-width: 55px; padding: var(--spacing-sm); background: var(--bg-primary); border-radius: var(--radius-sm); }
        .planning-day { font-size: 1.3rem; font-weight: 700; color: var(--primary); line-height: 1; }
        .planning-month { font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); }
        .planning-session-info { flex: 1; min-width: 150px; }
        .planning-session-name { font-weight: 600; margin-bottom: 4px; }
        .planning-participants { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: 350px; }
        .planning-participant-mini {
          display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-full);
          font-size: 0.75rem; background: var(--bg-secondary);
        }
        .planning-participant-mini.present { background: #4CAF5020; color: #4CAF50; }
        .planning-participant-mini.absent { background: #F4433620; color: #F44336; }
        .planning-participant-mini.excuse { background: #FF980020; color: #FF9800; }
      </style>
    `;
  },

  // Ligne session dans le planning
  renderPlanningSessionRow(session) {
    const date = session.date?.toDate ? session.date.toDate() : new Date(session.date);
    const participants = session.participants || [];
    return `
      <div class="planning-session-row" onclick="App.navigate('evangelisation-detail', {id: '${session.id}'})" style="cursor: pointer;">
        <div class="planning-date">
          <div class="planning-day">${date.getDate()}</div>
          <div class="planning-month">${date.toLocaleString('fr-FR', { month: 'short' })}</div>
        </div>
        <div class="planning-session-info">
          <div class="planning-session-name">${Utils.escapeHtml(session.secteur_nom || 'Secteur')}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            ${session.heure_debut || '--:--'} · ${Utils.escapeHtml(session.responsable_nom || '-')}
          </div>
        </div>
        <div class="planning-participants">
          ${participants.length > 0 ? participants.map(p => {
            const sp = p.statut_presence || 'planifie';
            const cls = sp === 'present' ? 'present' : sp === 'absent' ? 'absent' : sp === 'excuse' ? 'excuse' : '';
            const nomComplet = `${p.membre_prenom || ''} ${p.membre_nom || ''}`.trim();
            return `<span class="planning-participant-mini ${cls}" title="${Utils.escapeHtml(nomComplet)} - ${SessionsEvangelisation.getPresenceLabel(sp)}">${Utils.getInitials(p.membre_prenom, p.membre_nom || '')}</span>`;
          }).join('') : '<span style="font-size: 0.85rem; color: var(--text-muted);">Aucun membre mobilisé</span>'}
        </div>
        <span class="badge" style="background: ${SessionsEvangelisation.getStatutColor(session.statut)}20; color: ${SessionsEvangelisation.getStatutColor(session.statut)};">
          ${SessionsEvangelisation.getStatutLabel(session.statut)}
        </span>
      </div>
    `;
  },

  // Page statistiques évangélisation
  async renderEvangelisationStats() {
    await SessionsEvangelisation.loadAll();
    const stats = SessionsEvangelisation.getDetailedStats();

    const statCard = (icon, label, value, sub = null, color = 'primary') => `
      <div class="evangelisation-stat-card" style="background: var(--bg-secondary); border-radius: var(--radius-md); padding: var(--spacing-md); min-width: 140px;">
        <div class="stat-icon-mini" style="color: var(--${color}); margin-bottom: 8px;"><i class="fas ${icon}"></i></div>
        <div class="stat-value-evang" style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${value}</div>
        <div class="stat-label-evang" style="font-size: 0.8rem; color: var(--text-muted);">${label}</div>
        ${sub ? `<div class="stat-sub" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${sub}</div>` : ''}
      </div>
    `;

    return `
      <div class="evangelisation-stats-header">
        <h2><i class="fas fa-chart-bar"></i> Statistiques évangélisation</h2>
        <button class="btn btn-secondary" onclick="App.navigate('evangelisation')">
          <i class="fas fa-arrow-left"></i> Retour
        </button>
      </div>

      <div class="evangelisation-stats-grid" style="display: flex; flex-wrap: wrap; gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
        ${statCard('fa-calendar-alt', 'Sessions totales', stats.totalSessions, stats.sessionsThisMonth + ' ce mois', 'primary')}
        ${statCard('fa-users', 'Contacts total', stats.totalContacts, stats.contactsThisMonth + ' ce mois', 'success')}
        ${statCard('fa-user-friends', 'Mobilisations', stats.totalMobilisations, stats.totalPresents + ' présents', 'info')}
        ${statCard('fa-percentage', 'Taux de présence', stats.tauxPresence + '%', stats.totalPresents + '/' + stats.totalMobilisations, 'warning')}
        ${statCard('fa-calendar-check', 'À venir', stats.upcoming, '', 'primary')}
      </div>

      <div class="evangelisation-stats-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-map-marker-alt"></i> Par secteur</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            ${stats.bySecteur.length > 0 ? `
            <table class="stats-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-primary);">
                  <th style="padding: var(--spacing-sm); text-align: left; font-size: 0.85rem;">Secteur</th>
                  <th style="padding: var(--spacing-sm); text-align: center; font-size: 0.85rem;">Sessions</th>
                  <th style="padding: var(--spacing-sm); text-align: center; font-size: 0.85rem;">Contacts</th>
                </tr>
              </thead>
              <tbody>
                ${stats.bySecteur.map(s => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: var(--spacing-sm);">${Utils.escapeHtml(s.secteur)}</td>
                  <td style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">${s.sessions}</td>
                  <td style="padding: var(--spacing-sm); text-align: center;">${s.contacts}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<div class="empty-state" style="padding: var(--spacing-lg);"><i class="fas fa-map-marked-alt"></i><p>Aucune donnée par secteur</p></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-line"></i> Évolution (6 derniers mois)</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            ${stats.statsByMonth.length > 0 ? `
            <table class="stats-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-primary);">
                  <th style="padding: var(--spacing-sm); text-align: left; font-size: 0.85rem;">Mois</th>
                  <th style="padding: var(--spacing-sm); text-align: center; font-size: 0.85rem;">Sessions</th>
                  <th style="padding: var(--spacing-sm); text-align: center; font-size: 0.85rem;">Contacts</th>
                </tr>
              </thead>
              <tbody>
                ${stats.statsByMonth.map(m => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: var(--spacing-sm);">${Utils.escapeHtml(m.label)}</td>
                  <td style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">${m.sessions}</td>
                  <td style="padding: var(--spacing-sm); text-align: center;">${m.contacts}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<div class="empty-state" style="padding: var(--spacing-lg);"><i class="fas fa-chart-line"></i><p>Aucune donnée</p></div>'}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-trophy"></i> Top participants (mobilisations)</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          ${stats.topParticipants.length > 0 ? `
          <table class="stats-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: var(--bg-primary);">
                <th style="padding: var(--spacing-sm); text-align: left; font-size: 0.85rem;">Membre</th>
                <th style="padding: var(--spacing-sm); text-align: center; font-size: 0.85rem;">Mobilisations</th>
                <th style="padding: var(--spacing-sm); text-align: center; font-size: 0.85rem;">Présents</th>
                <th style="padding: var(--spacing-sm); text-align: center; font-size: 0.85rem;">Taux présence</th>
              </tr>
            </thead>
            <tbody>
              ${stats.topParticipants.map((p, i) => `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: var(--spacing-sm);">
                  <span style="font-weight: 600; margin-right: 8px;">#${i + 1}</span>${Utils.escapeHtml(p.membre_nom || 'Inconnu')}
                </td>
                <td style="padding: var(--spacing-sm); text-align: center;">${p.mobilisations}</td>
                <td style="padding: var(--spacing-sm); text-align: center;">${p.presents}</td>
                <td style="padding: var(--spacing-sm); text-align: center;">
                  <span class="badge" style="background: ${p.tauxPresence >= 80 ? '#4CAF5020' : p.tauxPresence >= 50 ? '#FF980020' : '#F4433620'}; color: ${p.tauxPresence >= 80 ? '#4CAF50' : p.tauxPresence >= 50 ? '#FF9800' : '#F44336'};">
                    ${p.tauxPresence}%
                  </span>
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
          ` : '<div class="empty-state" style="padding: var(--spacing-lg);"><i class="fas fa-user-friends"></i><p>Aucun participant mobilisé</p></div>'}
        </div>
      </div>

      <style>
        .evangelisation-stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); flex-wrap: wrap; gap: var(--spacing-md); }
        .evangelisation-stat-card:hover { background: var(--bg-primary) !important; }
        @media (max-width: 900px) { .evangelisation-stats-row { grid-template-columns: 1fr !important; } }
      </style>
    `;
  },

  // Page d'ajout de session
  renderAdd() {
    const secteurs = Secteurs.getAll();
    const mentors = Membres.getMentors();
    const today = new Date().toISOString().split('T')[0];
    
    return `
      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-calendar-plus"></i> Planifier une session</h3>
        </div>
        <div class="card-body">
          <form id="form-add-session" onsubmit="PagesEvangelisation.submitAdd(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label required">Date</label>
                <input type="date" class="form-control input-date" name="date" min="${Utils.getDateFilterBounds().min}" max="${Utils.getDateFilterBounds().max}" value="${today}" title="Cliquez pour ouvrir le calendrier" required>
              </div>
              <div class="form-group">
                <label class="form-label required">Heure de début</label>
                <input type="time" class="form-control" name="heure_debut" value="09:00" required>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Heure de fin</label>
                <input type="time" class="form-control" name="heure_fin" value="12:00">
              </div>
              <div class="form-group">
                <label class="form-label">Secteur</label>
                <select class="form-control" name="secteur_id" onchange="PagesEvangelisation.updateSecteurNom(this)">
                  <option value="">-- Sélectionner --</option>
                  ${secteurs.map(s => `<option value="${s.id}" data-nom="${Utils.escapeHtml(s.nom)}">${Utils.escapeHtml(s.nom)}</option>`).join('')}
                </select>
                <input type="hidden" name="secteur_nom" id="secteur-nom-hidden">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Lieu de rendez-vous</label>
              <input type="text" class="form-control" name="lieu_rdv" placeholder="Ex: Devant l'église, Station métro...">
            </div>
            
            <div class="form-group">
              <label class="form-label">Responsable</label>
              <select class="form-control" name="responsable_id">
                <option value="${AppState.user.id}">${AppState.user.prenom} ${AppState.user.nom} (moi)</option>
                ${mentors.filter(m => m.id !== AppState.user.id).map(m => 
                  `<option value="${m.id}">${m.prenom} ${m.nom}</option>`
                ).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-control" name="notes" rows="3" placeholder="Instructions, objectifs..."></textarea>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="App.navigate('evangelisation')">Annuler</button>
              <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Planifier</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // Mettre à jour le nom du secteur caché
  updateSecteurNom(select) {
    const option = select.options[select.selectedIndex];
    document.getElementById('secteur-nom-hidden').value = option.dataset.nom || '';
  },

  // Soumettre le formulaire d'ajout
  async submitAdd(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const responsableId = formData.get('responsable_id');
    let responsableNom = `${AppState.user.prenom} ${AppState.user.nom}`;
    if (responsableId !== AppState.user.id) {
      const mentor = Membres.getById(responsableId);
      if (mentor) responsableNom = `${mentor.prenom} ${mentor.nom}`;
    }
    
    const data = {
      date: firebase.firestore.Timestamp.fromDate(new Date(formData.get('date'))),
      heure_debut: formData.get('heure_debut'),
      heure_fin: formData.get('heure_fin') || null,
      secteur_id: formData.get('secteur_id') || null,
      secteur_nom: formData.get('secteur_nom') || null,
      lieu_rdv: formData.get('lieu_rdv') || null,
      responsable_id: responsableId,
      responsable_nom: responsableNom,
      notes: formData.get('notes') || null
    };
    
    const result = await SessionsEvangelisation.create(data);
    if (result) {
      App.navigate('evangelisation');
    }
  },

  // Page détail d'une session
  async renderDetail(id) {
    const session = SessionsEvangelisation.getById(id);
    if (!session) {
      return '<div class="alert alert-danger">Session non trouvée</div>';
    }
    
    const date = session.date?.toDate ? session.date.toDate() : new Date(session.date);
    const contacts = session.contacts || [];
    
    return `
      <div class="session-detail-header">
        <div class="session-detail-date">
          <span class="big-day">${date.getDate()}</span>
          <span class="big-month">${date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div class="session-detail-info">
          <h2><i class="fas fa-map-marker-alt"></i> ${Utils.escapeHtml(session.secteur_nom || 'Secteur non défini')}</h2>
          <div class="session-detail-meta">
            <span><i class="fas fa-clock"></i> ${session.heure_debut || '--:--'} - ${session.heure_fin || '--:--'}</span>
            <span><i class="fas fa-user"></i> ${Utils.escapeHtml(session.responsable_nom)}</span>
            ${session.lieu_rdv ? `<span><i class="fas fa-map-pin"></i> ${Utils.escapeHtml(session.lieu_rdv)}</span>` : ''}
          </div>
        </div>
        <div class="session-detail-actions">
          <span class="badge" style="background: ${SessionsEvangelisation.getStatutColor(session.statut)}; color: white; padding: 8px 16px; font-size: 0.9rem;">
            <i class="fas ${SessionsEvangelisation.getStatutIcon(session.statut)}"></i>
            ${SessionsEvangelisation.getStatutLabel(session.statut)}
          </span>
          <button class="btn btn-outline" onclick="PagesEvangelisation.showEditSessionModal('${id}')">
            <i class="fas fa-edit"></i> Modifier
          </button>
          <button class="btn btn-secondary" onclick="App.navigate('evangelisation')">
            <i class="fas fa-arrow-left"></i> Retour
          </button>
        </div>
      </div>
      
      <div class="session-detail-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-user-friends"></i> Membres mobilisés (${(session.participants || []).length})</h3>
            <button class="btn btn-sm btn-primary" onclick="PagesEvangelisation.showAddParticipantModal('${id}')">
              <i class="fas fa-plus"></i> Mobiliser
            </button>
          </div>
          <div class="card-body" style="padding: 0;">
            ${this.renderParticipantsSection(session)}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-users"></i> Contacts (${contacts.length})</h3>
            <button class="btn btn-sm btn-primary" onclick="PagesEvangelisation.showAddContactModal('${id}')">
              <i class="fas fa-plus"></i> Ajouter
            </button>
          </div>
          <div class="card-body" style="padding: 0;">
            ${contacts.length > 0 ? contacts.map(c => this.renderContactItem(c, id, session.statut)).join('') : `
            <div class="empty-state" style="padding: var(--spacing-lg);">
              <i class="fas fa-user-plus"></i>
              <h4>Aucun contact</h4>
              <p>Ajoutez les personnes contactées pendant cette session.</p>
            </div>
            `}
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-clipboard"></i> Notes & Bilan</h3>
          </div>
          <div class="card-body">
            ${session.notes ? `
            <div class="mb-3">
              <label class="form-label">Notes</label>
              <p>${Utils.escapeHtml(session.notes)}</p>
            </div>
            ` : ''}
            
            ${session.bilan ? `
            <div class="alert alert-success">
              <i class="fas fa-check-circle"></i>
              <div>
                <strong>Bilan de session</strong>
                <p class="mb-0">${Utils.escapeHtml(session.bilan)}</p>
              </div>
            </div>
            ` : session.statut === 'planifiee' || session.statut === 'en_cours' ? `
            <button class="btn btn-success" onclick="PagesEvangelisation.showBilanModal('${id}')">
              <i class="fas fa-flag-checkered"></i> Terminer la session
            </button>
            ` : ''}
            ${session.statut === 'terminee' && Permissions.hasRole('adjoint_superviseur') ? `
            <button type="button" class="btn btn-outline" onclick="PagesEvangelisation.showEditNotesBilanModal('${id}')" style="margin-top: var(--spacing-md);">
              <i class="fas fa-edit"></i> Modifier notes et bilan
            </button>
            ` : ''}
          </div>
        </div>
      </div>
      
      <style>
        .session-detail-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
        }
        .session-detail-date {
          text-align: center;
          padding: var(--spacing-md);
          background: var(--primary);
          color: white;
          border-radius: var(--radius-md);
          min-width: 100px;
        }
        .big-day {
          display: block;
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1;
        }
        .big-month {
          font-size: 0.85rem;
          opacity: 0.9;
        }
        .session-detail-info {
          flex: 1;
        }
        .session-detail-info h2 {
          margin-bottom: var(--spacing-xs);
        }
        .session-detail-meta {
          display: flex;
          gap: var(--spacing-md);
          color: var(--text-muted);
          flex-wrap: wrap;
        }
        .session-detail-actions {
          display: flex;
          gap: var(--spacing-sm);
          align-items: center;
          flex-wrap: wrap;
        }
        .session-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-lg);
        }
        @media (max-width: 900px) {
          .session-detail-grid {
            grid-template-columns: 1fr;
          }
        }
        .contact-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
        }
        .contact-item:last-child {
          border-bottom: none;
        }
        .contact-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        .contact-info {
          flex: 1;
        }
        .contact-name {
          font-weight: 600;
        }
        .contact-phone {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
      </style>
    `;
  },

  // Rendu de la section membres mobilisés
  renderParticipantsSection(session) {
    const participants = session.participants || [];
    const id = session.id;
    
    if (participants.length === 0) {
      return `
        <div class="empty-state" style="padding: var(--spacing-lg);">
          <i class="fas fa-user-friends"></i>
          <h4>Aucun membre mobilisé</h4>
          <p>Mobilisez des membres de la famille pour cette session.</p>
        </div>
      `;
    }
    
    return participants.map(p => this.renderParticipantItem(p, id)).join('');
  },

  // Rendu d'un participant mobilisé
  renderParticipantItem(participant, sessionId) {
    const statut = participant.statut_presence || 'planifie';
    return `
      <div class="participant-item" style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md); border-bottom: 1px solid var(--border-color);">
        <div class="participant-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
          ${Utils.getInitials(participant.membre_prenom, participant.membre_nom || '')}
        </div>
        <div class="participant-info" style="flex: 1;">
          <div class="participant-name" style="font-weight: 600;">${Utils.escapeHtml(participant.membre_prenom)} ${Utils.escapeHtml(participant.membre_nom || '')}</div>
          <span class="badge" style="background: ${SessionsEvangelisation.getPresenceColor(statut)}20; color: ${SessionsEvangelisation.getPresenceColor(statut)}; font-size: 0.75rem;">
            <i class="fas ${SessionsEvangelisation.getPresenceIcon(statut)}"></i> ${SessionsEvangelisation.getPresenceLabel(statut)}
          </span>
        </div>
        <div class="participant-actions" style="display: flex; gap: 4px; align-items: center;">
          <select class="form-control form-control-sm" style="width: auto; padding: 4px 8px; min-width: 100px;" 
                  onchange="PagesEvangelisation.updatePresenceParticipant('${sessionId}', '${participant.membre_id}', this.value)">
            ${PARTICIPANT_STATUTS.map(s => 
              `<option value="${s.value}" ${s.value === statut ? 'selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
          <button class="btn btn-sm btn-danger" onclick="PagesEvangelisation.removeParticipant('${sessionId}', '${participant.membre_id}')" title="Retirer">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  },

  // Afficher la modal pour mobiliser un membre
  showAddParticipantModal(sessionId) {
    const membresActifs = AppState.membres.filter(m => m.statut_compte === 'actif');
    const session = SessionsEvangelisation.getById(sessionId);
    const inscrits = (session.participants || []).map(p => p.membre_id);
    const disponibles = membresActifs.filter(m => !inscrits.includes(m.id));
    
    const modalId = 'add-participant-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-user-plus"></i> Mobiliser un membre</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            ${disponibles.length > 0 ? `
            <div class="membres-grid" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
              ${disponibles.map(m => `
                <div class="membre-option" style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;" 
                     onclick="PagesEvangelisation.addParticipant('${sessionId}', '${m.id}')">
                  <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
                    ${Utils.getInitials(m.prenom, m.nom)}
                  </div>
                  <div>
                    <div style="font-weight: 600;">${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${Utils.getRoleLabel(m.role)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            ` : `
            <div class="alert alert-info">
              <i class="fas fa-info-circle"></i>
              Tous les membres actifs sont déjà mobilisés pour cette session.
            </div>
            `}
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async addParticipant(sessionId, membreId) {
    const result = await SessionsEvangelisation.addParticipant(sessionId, membreId);
    if (result) {
      App.navigate('evangelisation-detail', { id: sessionId });
    }
  },

  async updatePresenceParticipant(sessionId, membreId, statutPresence) {
    const result = await SessionsEvangelisation.updatePresence(sessionId, membreId, statutPresence);
    if (result) {
      App.navigate('evangelisation-detail', { id: sessionId });
    }
  },

  removeParticipant(sessionId, membreId) {
    Modal.confirm(
      'Retirer le participant',
      'Voulez-vous retirer ce membre de la session ?',
      async () => {
        const result = await SessionsEvangelisation.removeParticipant(sessionId, membreId);
        if (result) {
          App.navigate('evangelisation-detail', { id: sessionId });
        }
      }
    );
  },

  // Rendu d'un contact
  renderContactItem(contact, sessionId, sessionStatut) {
    return `
      <div class="contact-item">
        <div class="contact-avatar">
          ${Utils.getInitials(contact.prenom, contact.nom || '')}
        </div>
        <div class="contact-info">
          <div class="contact-name">${Utils.escapeHtml(contact.prenom)} ${Utils.escapeHtml(contact.nom || '')}</div>
          <div class="contact-phone"><i class="fas fa-phone"></i> ${Utils.escapeHtml(contact.telephone || '-')}</div>
          ${contact.lieu ? `<div class="contact-lieu" style="font-size: 0.8rem; color: var(--text-muted);"><i class="fas fa-map-marker-alt"></i> ${Utils.escapeHtml(contact.lieu)}</div>` : ''}
        </div>
        <div class="contact-actions" style="display: flex; gap: 4px;">
          <button class="btn btn-sm btn-outline" onclick="PagesEvangelisation.showEditContactModal('${sessionId}', '${contact.id}')" title="Modifier">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-success" onclick="PagesEvangelisation.convertToNouvelleAme('${sessionId}', '${contact.id}')" title="Ajouter aux nouvelles âmes">
            <i class="fas fa-user-plus"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="PagesEvangelisation.deleteContact('${sessionId}', '${contact.id}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  },

  // Afficher la modal d'ajout de contact
  showAddContactModal(sessionId) {
    const modalId = 'add-contact-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-user-plus"></i> Ajouter un contact</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-add-contact" onsubmit="PagesEvangelisation.submitAddContact(event, '${sessionId}')">
              <div class="form-group">
                <label class="form-label required">Prénom</label>
                <input type="text" class="form-control" name="prenom" required autofocus>
              </div>
              <div class="form-group">
                <label class="form-label">Nom</label>
                <input type="text" class="form-control" name="nom">
              </div>
              <div class="form-group">
                <label class="form-label required">Téléphone</label>
                <input type="tel" class="form-control" name="telephone" required>
              </div>
              <div class="form-group">
                <label class="form-label">Lieu de contact</label>
                <input type="text" class="form-control" name="lieu" placeholder="Ex: Rue du marché">
              </div>
              <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea class="form-control" name="notes" rows="2"></textarea>
              </div>
              <div class="modal-footer" style="padding: 0; border: none; margin-top: var(--spacing-md);">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // Soumettre l'ajout de contact
  async submitAddContact(event, sessionId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
      prenom: formData.get('prenom'),
      nom: formData.get('nom') || '',
      telephone: formData.get('telephone'),
      lieu: formData.get('lieu') || null,
      notes: formData.get('notes') || null
    };
    
    const result = await SessionsEvangelisation.addContact(sessionId, data);
    if (result) {
      document.getElementById('add-contact-modal')?.remove();
      App.navigate('evangelisation-detail', { id: sessionId });
    }
  },

  // Convertir un contact en nouvelle âme
  async convertToNouvelleAme(sessionId, contactId) {
    await SessionsEvangelisation.convertContactToNouvelleAme(sessionId, contactId);
  },

  // Afficher la modal de bilan
  showBilanModal(sessionId) {
    const modalId = 'bilan-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-flag-checkered"></i> Terminer la session</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-bilan" onsubmit="PagesEvangelisation.submitBilan(event, '${sessionId}')">
              <div class="form-group">
                <label class="form-label required">Bilan de la session</label>
                <textarea class="form-control" name="bilan" rows="4" required placeholder="Résumé de la session, points marquants, difficultés rencontrées..."></textarea>
              </div>
              <div class="modal-footer" style="padding: 0; border: none; margin-top: var(--spacing-md);">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
                <button type="submit" class="btn btn-success"><i class="fas fa-check"></i> Terminer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // Soumettre le bilan
  async submitBilan(event, sessionId) {
    event.preventDefault();
    const form = event.target;
    const bilan = new FormData(form).get('bilan');
    
    const result = await SessionsEvangelisation.terminerSession(sessionId, bilan);
    if (result) {
      document.getElementById('bilan-modal')?.remove();
      App.navigate('evangelisation-detail', { id: sessionId });
    }
  },

  // Modifier notes et bilan (session déjà terminée)
  showEditNotesBilanModal(sessionId) {
    const session = SessionsEvangelisation.getById(sessionId);
    if (!session) return;
    const modalId = 'edit-notes-bilan-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-edit"></i> Modifier notes et bilan</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-edit-notes-bilan" onsubmit="PagesEvangelisation.submitEditNotesBilan(event, '${sessionId}')">
              <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea class="form-control" name="notes" rows="3" placeholder="Instructions, objectifs...">${Utils.escapeHtml(session.notes || '')}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Bilan</label>
                <textarea class="form-control" name="bilan" rows="4" placeholder="Bilan de la session...">${Utils.escapeHtml(session.bilan || '')}</textarea>
              </div>
              <div class="modal-footer" style="padding: 0; border: none; margin-top: var(--spacing-md);">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitEditNotesBilan(event, sessionId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const notes = formData.get('notes')?.trim() || null;
    const bilan = formData.get('bilan')?.trim() || null;
    const result = await SessionsEvangelisation.update(sessionId, { notes, bilan });
    if (result) {
      document.getElementById('edit-notes-bilan-modal')?.remove();
      App.navigate('evangelisation-detail', { id: sessionId });
    }
  },

  // Afficher la modal d'édition de contact
  showEditContactModal(sessionId, contactId) {
    const session = SessionsEvangelisation.getById(sessionId);
    if (!session) return;
    
    const contact = session.contacts?.find(c => c.id === contactId);
    if (!contact) return;
    
    const modalId = 'edit-contact-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-edit"></i> Modifier le contact</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-edit-contact" onsubmit="PagesEvangelisation.submitEditContact(event, '${sessionId}', '${contactId}')">
              <div class="form-group">
                <label class="form-label required">Prénom</label>
                <input type="text" class="form-control" name="prenom" value="${Utils.escapeHtml(contact.prenom)}" required autofocus>
              </div>
              <div class="form-group">
                <label class="form-label">Nom</label>
                <input type="text" class="form-control" name="nom" value="${Utils.escapeHtml(contact.nom || '')}">
              </div>
              <div class="form-group">
                <label class="form-label required">Téléphone</label>
                <input type="tel" class="form-control" name="telephone" value="${Utils.escapeHtml(contact.telephone || '')}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Lieu de contact</label>
                <input type="text" class="form-control" name="lieu" value="${Utils.escapeHtml(contact.lieu || '')}" placeholder="Ex: Rue du marché">
              </div>
              <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea class="form-control" name="notes" rows="2">${Utils.escapeHtml(contact.notes || '')}</textarea>
              </div>
              <div class="modal-footer" style="padding: 0; border: none; margin-top: var(--spacing-md);">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // Soumettre l'édition de contact
  async submitEditContact(event, sessionId, contactId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
      prenom: formData.get('prenom'),
      nom: formData.get('nom') || '',
      telephone: formData.get('telephone'),
      lieu: formData.get('lieu') || null,
      notes: formData.get('notes') || null
    };
    
    const result = await SessionsEvangelisation.updateContact(sessionId, contactId, data);
    if (result) {
      document.getElementById('edit-contact-modal')?.remove();
      App.navigate('evangelisation-detail', { id: sessionId });
    }
  },

  // Supprimer un contact
  deleteContact(sessionId, contactId) {
    Modal.confirm(
      'Supprimer le contact',
      'Voulez-vous vraiment supprimer ce contact ?',
      async () => {
        const result = await SessionsEvangelisation.deleteContact(sessionId, contactId);
        if (result) {
          App.navigate('evangelisation-detail', { id: sessionId });
        }
      }
    );
  },

  // Afficher la modal d'édition de session
  showEditSessionModal(sessionId) {
    const session = SessionsEvangelisation.getById(sessionId);
    if (!session) return;
    
    const secteurs = Secteurs.getAll();
    const date = session.date?.toDate ? session.date.toDate() : new Date(session.date);
    const dateStr = date.toISOString().split('T')[0];
    
    const modalId = 'edit-session-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-edit"></i> Modifier la session</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-edit-session" onsubmit="PagesEvangelisation.submitEditSession(event, '${sessionId}')">
              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                <div class="form-group">
                  <label class="form-label required">Date</label>
                  <input type="date" class="form-control input-date" name="date" min="${Utils.getDateFilterBounds().min}" max="${Utils.getDateFilterBounds().max}" value="${dateStr}" title="Cliquez pour ouvrir le calendrier" required>
                </div>
                <div class="form-group">
                  <label class="form-label required">Heure de début</label>
                  <input type="time" class="form-control" name="heure_debut" value="${session.heure_debut || ''}" required>
                </div>
              </div>
              
              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                <div class="form-group">
                  <label class="form-label">Heure de fin</label>
                  <input type="time" class="form-control" name="heure_fin" value="${session.heure_fin || ''}">
                </div>
                <div class="form-group">
                  <label class="form-label">Secteur</label>
                  <select class="form-control" name="secteur_id" onchange="PagesEvangelisation.updateSecteurNomEdit(this)">
                    <option value="">-- Sélectionner --</option>
                    ${secteurs.map(s => `<option value="${s.id}" data-nom="${Utils.escapeHtml(s.nom)}" ${s.id === session.secteur_id ? 'selected' : ''}>${Utils.escapeHtml(s.nom)}</option>`).join('')}
                  </select>
                  <input type="hidden" name="secteur_nom" id="secteur-nom-edit-hidden" value="${Utils.escapeHtml(session.secteur_nom || '')}">
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Lieu de rendez-vous</label>
                <input type="text" class="form-control" name="lieu_rdv" value="${Utils.escapeHtml(session.lieu_rdv || '')}" placeholder="Ex: Devant l'église">
              </div>
              
              <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea class="form-control" name="notes" rows="3">${Utils.escapeHtml(session.notes || '')}</textarea>
              </div>
              
              <div class="modal-footer" style="padding: 0; border: none; margin-top: var(--spacing-md);">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // Mettre à jour le nom du secteur caché (modal édition)
  updateSecteurNomEdit(select) {
    const option = select.options[select.selectedIndex];
    document.getElementById('secteur-nom-edit-hidden').value = option.dataset.nom || '';
  },

  // Soumettre l'édition de session
  async submitEditSession(event, sessionId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
      date: firebase.firestore.Timestamp.fromDate(new Date(formData.get('date'))),
      heure_debut: formData.get('heure_debut'),
      heure_fin: formData.get('heure_fin') || null,
      secteur_id: formData.get('secteur_id') || null,
      secteur_nom: formData.get('secteur_nom') || null,
      lieu_rdv: formData.get('lieu_rdv') || null,
      notes: formData.get('notes') || null
    };
    
    const result = await SessionsEvangelisation.update(sessionId, data);
    if (result) {
      document.getElementById('edit-session-modal')?.remove();
      App.navigate('evangelisation-detail', { id: sessionId });
    }
  },

  // Page des secteurs
  async renderSecteurs() {
    await Secteurs.loadAll();
    const secteurs = Secteurs.getAll();
    
    return `
      <div class="secteurs-header">
        <h2><i class="fas fa-map-marker-alt"></i> Gestion des secteurs</h2>
        <div class="header-actions">
          <button class="btn btn-secondary" onclick="App.navigate('evangelisation')">
            <i class="fas fa-arrow-left"></i> Retour
          </button>
          <button class="btn btn-primary" onclick="PagesEvangelisation.showAddSecteurModal()">
            <i class="fas fa-plus"></i> Nouveau secteur
          </button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body" style="padding: 0;">
          ${secteurs.length > 0 ? secteurs.map(s => `
          <div class="secteur-item">
            <div class="secteur-info">
              <div class="secteur-name"><i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> ${Utils.escapeHtml(s.nom)}</div>
              ${s.description ? `<div class="secteur-desc">${Utils.escapeHtml(s.description)}</div>` : ''}
              ${s.quartiers && s.quartiers.length > 0 ? `
              <div class="secteur-quartiers">
                ${s.quartiers.map(q => `<span class="badge badge-secondary">${Utils.escapeHtml(q)}</span>`).join(' ')}
              </div>
              ` : ''}
            </div>
            <div class="secteur-actions">
              <button class="btn btn-sm btn-outline" onclick="PagesEvangelisation.editSecteur('${s.id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="PagesEvangelisation.deleteSecteur('${s.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          `).join('') : `
          <div class="empty-state">
            <i class="fas fa-map-marked-alt"></i>
            <h3>Aucun secteur</h3>
            <p>Créez des secteurs pour organiser vos sorties d'évangélisation.</p>
          </div>
          `}
        </div>
      </div>
      
      <style>
        .secteurs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .secteur-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
        }
        .secteur-item:last-child {
          border-bottom: none;
        }
        .secteur-info {
          flex: 1;
        }
        .secteur-name {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .secteur-desc {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .secteur-quartiers {
          display: flex;
          gap: var(--spacing-xs);
          flex-wrap: wrap;
        }
        .secteur-actions {
          display: flex;
          gap: var(--spacing-xs);
        }
      </style>
    `;
  },

  // Afficher modal ajout secteur
  showAddSecteurModal() {
    const modalId = 'add-secteur-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-map-marker-alt"></i> Nouveau secteur</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-add-secteur" onsubmit="PagesEvangelisation.submitAddSecteur(event)">
              <div class="form-group">
                <label class="form-label required">Nom du secteur</label>
                <input type="text" class="form-control" name="nom" required placeholder="Ex: Centre-ville, Quartier Nord...">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" name="description" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Quartiers (séparés par des virgules)</label>
                <input type="text" class="form-control" name="quartiers" placeholder="Ex: Plateau, Cocody, Marcory">
              </div>
              <div class="modal-footer" style="padding: 0; border: none; margin-top: var(--spacing-md);">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove();">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Créer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // Soumettre ajout secteur
  async submitAddSecteur(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const quartiersStr = formData.get('quartiers') || '';
    const quartiers = quartiersStr.split(',').map(q => q.trim()).filter(q => q);
    
    const data = {
      nom: formData.get('nom'),
      description: formData.get('description') || null,
      quartiers: quartiers
    };
    
    const result = await Secteurs.create(data);
    if (result) {
      document.getElementById('add-secteur-modal')?.remove();
      App.navigate('secteurs');
    }
  },

  // Supprimer un secteur
  deleteSecteur(id) {
    const secteur = Secteurs.getById(id);
    if (!secteur) return;
    
    Modal.confirm(
      'Supprimer le secteur',
      `Voulez-vous supprimer le secteur "${secteur.nom}" ?`,
      async () => {
        await Secteurs.delete(id);
        App.navigate('secteurs');
      }
    );
  },

  // Éditer un secteur (à implémenter si besoin)
  editSecteur(id) {
    Toast.info('Fonctionnalité à venir');
  }
};
