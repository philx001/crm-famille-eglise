// ============================================
// MODULE NOUVELLES ÂMES
// Gestion des personnes contactées (évangélisation, cultes, exhortations)
// ============================================

// ============================================
// DONNÉES ET CONSTANTES
// ============================================

const NouvellesAmesData = {
  cache: [],
  loaded: false
};

// Canaux d'acquisition
const CANAUX = [
  { value: 'evangelisation', label: 'Évangélisation', icon: 'fa-bullhorn', color: '#1976D2' },
  { value: 'culte', label: 'Culte du dimanche', icon: 'fa-church', color: '#7B1FA2' },
  { value: 'exhortation', label: 'Programme d\'exhortation', icon: 'fa-hands-praying', color: '#E65100' }
];

// Thématiques d'exhortation
const THEMATIQUES = [
  { value: 'finances', label: 'Défis Finances', icon: 'fa-money-bill-wave', color: '#4CAF50' },
  { value: 'sante', label: 'Santé', icon: 'fa-heart-pulse', color: '#03A9F4' },
  { value: 'couple', label: 'Couple/Famille', icon: 'fa-heart', color: '#E91E63' },
  { value: 'travail', label: 'Travail/Affaires', icon: 'fa-briefcase', color: '#FF9800' },
  { value: 'spirituel', label: 'Émotionnel/Spirituel', icon: 'fa-pray', color: '#9C27B0' },
  { value: 'autre', label: 'Autre', icon: 'fa-question-circle', color: '#607D8B' }
];

// Statuts des nouvelles âmes
const STATUTS = [
  { value: 'nouveau', label: 'Nouveau contact', color: '#2196F3' },
  { value: 'en_suivi', label: 'En suivi', color: '#FF9800' },
  { value: 'integre', label: 'Intégré', color: '#4CAF50' },
  { value: 'inactif', label: 'Inactif', color: '#9E9E9E' },
  { value: 'perdu', label: 'Perdu', color: '#F44336' }
];

// Types de suivi
const TYPES_SUIVI = [
  { value: 'appel', label: 'Appel téléphonique', icon: 'fa-phone' },
  { value: 'visite', label: 'Visite à domicile', icon: 'fa-home' },
  { value: 'message', label: 'Message (SMS/WhatsApp)', icon: 'fa-comment' },
  { value: 'rencontre', label: 'Rencontre à l\'église', icon: 'fa-church' },
  { value: 'autre', label: 'Autre', icon: 'fa-ellipsis-h' }
];

// ============================================
// GESTION DES NOUVELLES ÂMES
// ============================================

const NouvellesAmes = {
  // Charger toutes les nouvelles âmes de la famille
  async loadAll() {
    try {
      if (!AppState.famille?.id) return [];
      
      // Requête simple sans orderBy (évite le besoin d'un index composé)
      const snapshot = await db.collection('nouvelles_ames')
        .where('famille_id', '==', AppState.famille.id)
        .get();
      
      NouvellesAmesData.cache = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Trier côté client par date de création (plus récent en premier)
      NouvellesAmesData.cache.sort((a, b) => {
        const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return dateB - dateA;
      });
      
      NouvellesAmesData.loaded = true;
      
      return NouvellesAmesData.cache;
    } catch (error) {
      console.error('Erreur chargement nouvelles âmes:', error);
      Toast.error('Erreur lors du chargement des nouvelles âmes');
      return [];
    }
  },

  // Obtenir toutes les nouvelles âmes (depuis le cache)
  getAll() {
    return NouvellesAmesData.cache;
  },

  // Obtenir une nouvelle âme par ID
  getById(id) {
    return NouvellesAmesData.cache.find(na => na.id === id);
  },

  // Créer une nouvelle âme
  async create(data) {
    try {
      const user = AppState.user;
      const famille = AppState.famille;
      
      const nouvelleAme = {
        prenom: data.prenom,
        nom: data.nom,
        telephone: data.telephone,
        email: data.email || null,
        sexe: data.sexe || null,
        date_naissance: data.date_naissance || null,
        adresse_ville: data.adresse_ville || null,
        adresse_quartier: data.adresse_quartier || null,
        
        canal: data.canal,
        thematique: data.canal === 'exhortation' ? data.thematique : null,
        date_premier_contact: data.date_premier_contact || firebase.firestore.Timestamp.now(),
        lieu_contact: data.lieu_contact || null,
        contacte_par_id: user.id,
        contacte_par_nom: `${user.prenom} ${user.nom}`,
        
        suivi_par_id: data.suivi_par_id || user.id,
        suivi_par_nom: data.suivi_par_nom || `${user.prenom} ${user.nom}`,
        statut: 'nouveau',
        date_dernier_contact: firebase.firestore.Timestamp.now(),
        
        defis: data.defis || [],
        commentaires: data.commentaires || null,
        
        date_integration: null,
        membre_id: null,
        
        famille_id: famille.id,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('nouvelles_ames').add(nouvelleAme);
      
      // Ajouter au cache
      const created = { id: docRef.id, ...nouvelleAme, created_at: new Date(), updated_at: new Date() };
      NouvellesAmesData.cache.unshift(created);
      
      Toast.success('Nouvelle âme ajoutée avec succès');
      return created;
    } catch (error) {
      console.error('Erreur création nouvelle âme:', error);
      Toast.error('Erreur lors de l\'ajout de la nouvelle âme');
      return null;
    }
  },

  // Modifier une nouvelle âme
  async update(id, data, silent = false) {
    try {
      const updateData = {
        ...data,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('nouvelles_ames').doc(id).update(updateData);
      
      // Mettre à jour le cache
      const index = NouvellesAmesData.cache.findIndex(na => na.id === id);
      if (index !== -1) {
        NouvellesAmesData.cache[index] = { ...NouvellesAmesData.cache[index], ...data };
      }
      
      if (!silent) {
        Toast.success('Nouvelle âme mise à jour');
      }
      return true;
    } catch (error) {
      console.error('Erreur mise à jour nouvelle âme:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  // Supprimer une nouvelle âme (superviseur uniquement)
  async delete(id) {
    try {
      if (!Permissions.hasRole('superviseur')) {
        Toast.error('Permission refusée');
        return false;
      }
      
      await db.collection('nouvelles_ames').doc(id).delete();
      
      // Retirer du cache
      NouvellesAmesData.cache = NouvellesAmesData.cache.filter(na => na.id !== id);
      
      Toast.success('Nouvelle âme supprimée');
      return true;
    } catch (error) {
      console.error('Erreur suppression nouvelle âme:', error);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  },

  // Filtrer les nouvelles âmes
  filterBy(filters = {}) {
    let result = [...NouvellesAmesData.cache];
    
    if (filters.canal) {
      result = result.filter(na => na.canal === filters.canal);
    }
    // Gestion du filtre statut avec option spéciale "actifs"
    if (filters.statut === 'actifs') {
      // Exclure les intégrés et perdus
      result = result.filter(na => na.statut !== 'integre' && na.statut !== 'perdu');
    } else if (filters.statut) {
      result = result.filter(na => na.statut === filters.statut);
    }
    if (filters.thematique) {
      result = result.filter(na => na.thematique === filters.thematique);
    }
    if (filters.suivi_par_id) {
      result = result.filter(na => na.suivi_par_id === filters.suivi_par_id);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(na => 
        (na.prenom + ' ' + na.nom).toLowerCase().includes(search) ||
        (na.telephone && na.telephone.includes(search))
      );
    }
    if (filters.date_premier_contact_debut || filters.date_premier_contact_fin) {
      result = result.filter(na => {
        const d = na.date_premier_contact ? (na.date_premier_contact.toDate ? na.date_premier_contact.toDate() : new Date(na.date_premier_contact)) : null;
        if (!d || isNaN(d.getTime())) return false;
        const dayStart = (date) => { const x = new Date(date); x.setHours(0, 0, 0, 0); return x.getTime(); };
        const dayEnd = (date) => { const x = new Date(date); x.setHours(23, 59, 59, 999); return x.getTime(); };
        const t = d.getTime();
        if (filters.date_premier_contact_debut && t < dayStart(filters.date_premier_contact_debut)) return false;
        if (filters.date_premier_contact_fin && t > dayEnd(filters.date_premier_contact_fin)) return false;
        return true;
      });
    }
    
    return result;
  },
  
  // Obtenir uniquement les âmes actives (non intégrées)
  getActifs() {
    return NouvellesAmesData.cache.filter(na => na.statut !== 'integre' && na.statut !== 'perdu');
  },

  // Obtenir les nouvelles âmes à relancer (sans contact depuis X jours)
  getARelancer(days = 7) {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);
    
    return NouvellesAmesData.cache.filter(na => {
      if (na.statut === 'integre' || na.statut === 'perdu') return false;
      
      const lastContact = na.date_dernier_contact?.toDate 
        ? na.date_dernier_contact.toDate() 
        : new Date(na.date_dernier_contact || na.created_at);
      
      return lastContact < limitDate;
    });
  },

  // Obtenir les statistiques
  getStats() {
    const all = NouvellesAmesData.cache;
    const actifs = this.getActifs();
    const stats = {
      total: actifs.length,  // Compte uniquement les actifs par défaut
      totalAll: all.length,  // Total incluant les intégrés
      integres: all.filter(na => na.statut === 'integre').length,
      parCanal: {},
      parStatut: {},
      aRelancer: this.getARelancer().length
    };
    
    CANAUX.forEach(c => {
      stats.parCanal[c.value] = all.filter(na => na.canal === c.value).length;
    });
    
    STATUTS.forEach(s => {
      stats.parStatut[s.value] = all.filter(na => na.statut === s.value).length;
    });
    
    return stats;
  },

  // Évolution mensuelle (6 derniers mois)
  getEvolutionMensuelle(mois = 6) {
    const all = NouvellesAmesData.cache;
    const now = new Date();
    const result = [];
    for (let i = mois - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const count = all.filter(na => {
        const created = na.created_at?.toDate ? na.created_at.toDate() : new Date(na.created_at);
        return created >= d && created < next;
      }).length;
      const integres = all.filter(na => {
        const created = na.created_at?.toDate ? na.created_at.toDate() : new Date(na.created_at);
        const integDate = na.date_integration?.toDate ? na.date_integration.toDate() : na.date_integration;
        return integDate && created >= d && created < next && na.statut === 'integre';
      }).length;
      result.push({
        label: d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
        total: count,
        integres
      });
    }
    return result;
  },

  // Convertir une nouvelle âme en membre
  async convertToMembre(id) {
    try {
      if (!Permissions.hasRole('adjoint_superviseur')) {
        Toast.error('Permission refusée');
        return false;
      }
      
      const nouvelleAme = this.getById(id);
      if (!nouvelleAme) {
        Toast.error('Nouvelle âme non trouvée');
        return false;
      }
      
      // Vérifier si cette âme est déjà intégrée
      if (nouvelleAme.statut === 'integre') {
        Toast.warning('Cette personne a déjà été convertie en membre');
        return false;
      }
      
      // Vérifier si un membre avec cet email existe déjà
      const email = nouvelleAme.email || `${nouvelleAme.prenom.toLowerCase()}.${nouvelleAme.nom.toLowerCase()}@temp.local`;
      const existingMembre = AppState.membres.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
      
      if (existingMembre) {
        // Le membre existe déjà, juste mettre à jour le statut de la nouvelle âme
        await this.update(id, {
          statut: 'integre',
          membre_id: existingMembre.id,
          date_integration: firebase.firestore.Timestamp.now()
        }, true);
        
        NouvellesAmesData.loaded = false;
        Toast.success(`${nouvelleAme.prenom} ${nouvelleAme.nom} est déjà membre - statut mis à jour`);
        return true;
      }
      
      // IMPORTANT: Mettre à jour le statut AVANT de créer le membre
      // Car Auth.createMembre déconnecte l'utilisateur actuel
      await this.update(id, {
        statut: 'integre',
        date_integration: firebase.firestore.Timestamp.now()
      }, true);
      
      // Forcer le rechargement des données
      NouvellesAmesData.loaded = false;
      
      // Créer le membre via Auth.createMembre
      // Note: Cette fonction va déconnecter l'utilisateur et afficher la page de login
      try {
        const result = await Auth.createMembre({
          prenom: nouvelleAme.prenom,
          nom: nouvelleAme.nom,
          email: email,
          telephone: nouvelleAme.telephone,
          sexe: nouvelleAme.sexe,
          date_naissance: nouvelleAme.date_naissance,
          adresse_ville: nouvelleAme.adresse_ville,
          role: 'nouveau',
          mentor_id: nouvelleAme.suivi_par_id
        });
        
        // Le membre a été créé avec succès
        // L'utilisateur sera redirigé vers la page de login
        return true;
        
      } catch (authError) {
        // Si l'email existe déjà dans Firebase Auth, c'est OK car on a déjà mis à jour le statut
        if (authError.code === 'auth/email-already-in-use') {
          Toast.warning(`${nouvelleAme.prenom} a un compte existant - marqué comme intégré`);
          return true;
        }
        // Autre erreur: annuler la mise à jour du statut
        await this.update(id, {
          statut: nouvelleAme.statut || 'nouveau'
        }, true);
        throw authError;
      }
      
    } catch (error) {
      console.error('Erreur conversion en membre:', error);
      Toast.error('Erreur lors de la conversion');
      return false;
    }
  },

  // Getters pour les constantes
  getCanaux() { return CANAUX; },
  getThematiques() { return THEMATIQUES; },
  getStatuts() { return STATUTS; },
  
  getCanalLabel(value) {
    const canal = CANAUX.find(c => c.value === value);
    return canal ? canal.label : value;
  },
  
  getThematiqueLabel(value) {
    const thematique = THEMATIQUES.find(t => t.value === value);
    return thematique ? thematique.label : value;
  },
  
  getStatutLabel(value) {
    const statut = STATUTS.find(s => s.value === value);
    return statut ? statut.label : value;
  },
  
  getStatutColor(value) {
    const statut = STATUTS.find(s => s.value === value);
    return statut ? statut.color : '#9E9E9E';
  }
};

// ============================================
// GESTION DES SUIVIS
// ============================================

const SuivisAmes = {
  cache: {},

  // Charger les suivis d'une nouvelle âme
  async loadByNouvelleAme(nouvelleAmeId) {
    try {
      if (this.cache[nouvelleAmeId]) {
        return this.cache[nouvelleAmeId];
      }
      
      // Requête simple sans orderBy (évite le besoin d'un index composé)
      const snapshot = await db.collection('suivis_ames')
        .where('nouvelle_ame_id', '==', nouvelleAmeId)
        .get();
      
      let suivis = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Trier côté client par date de suivi (plus récent en premier)
      suivis.sort((a, b) => {
        const dateA = a.date_suivi?.toDate ? a.date_suivi.toDate() : new Date(a.date_suivi || 0);
        const dateB = b.date_suivi?.toDate ? b.date_suivi.toDate() : new Date(b.date_suivi || 0);
        return dateB - dateA;
      });
      
      this.cache[nouvelleAmeId] = suivis;
      return suivis;
    } catch (error) {
      console.error('Erreur chargement suivis:', error);
      return [];
    }
  },

  // Ajouter un suivi
  async add(data) {
    try {
      const user = AppState.user;
      
      const suivi = {
        nouvelle_ame_id: data.nouvelle_ame_id,
        type: data.type,
        date_suivi: data.date_suivi || firebase.firestore.Timestamp.now(),
        effectue_par_id: user.id,
        effectue_par_nom: `${user.prenom} ${user.nom}`,
        notes: data.notes,
        prochaine_action: data.prochaine_action || null,
        date_prochaine_action: data.date_prochaine_action || null,
        famille_id: AppState.famille.id,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('suivis_ames').add(suivi);
      
      // Mettre à jour la date de dernier contact
      await NouvellesAmes.update(data.nouvelle_ame_id, {
        date_dernier_contact: suivi.date_suivi,
        statut: 'en_suivi'
      });
      
      // Mettre à jour le cache
      if (this.cache[data.nouvelle_ame_id]) {
        this.cache[data.nouvelle_ame_id].unshift({ id: docRef.id, ...suivi });
      }
      
      Toast.success('Suivi enregistré');
      return { id: docRef.id, ...suivi };
    } catch (error) {
      console.error('Erreur ajout suivi:', error);
      Toast.error('Erreur lors de l\'enregistrement du suivi');
      return null;
    }
  },

  // Supprimer un suivi
  async delete(id, nouvelleAmeId) {
    try {
      await db.collection('suivis_ames').doc(id).delete();
      
      if (this.cache[nouvelleAmeId]) {
        this.cache[nouvelleAmeId] = this.cache[nouvelleAmeId].filter(s => s.id !== id);
      }
      
      Toast.success('Suivi supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression suivi:', error);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  },

  getTypeSuiviLabel(value) {
    const type = TYPES_SUIVI.find(t => t.value === value);
    return type ? type.label : value;
  },
  
  getTypeSuiviIcon(value) {
    const type = TYPES_SUIVI.find(t => t.value === value);
    return type ? type.icon : 'fa-circle';
  },
  
  getTypesSuivi() { return TYPES_SUIVI; }
};

// ============================================
// INSCRIPTIONS AUX PROGRAMMES D'EXHORTATION
// ============================================

const InscriptionsProgrammes = {
  // Inscrire une nouvelle âme à un programme
  async inscrire(nouvelleAmeId, programmeId) {
    try {
      const na = NouvellesAmes.getById(nouvelleAmeId);
      const programme = Programmes.getById(programmeId);
      
      if (!na || !programme) {
        Toast.error('Données non trouvées');
        return false;
      }
      
      // Récupérer les inscriptions existantes
      const inscriptions = na.programmes_inscrits || [];
      
      // Vérifier si déjà inscrit
      if (inscriptions.some(i => i.programme_id === programmeId)) {
        Toast.warning('Déjà inscrit(e) à ce programme');
        return false;
      }
      
      // Ajouter l'inscription
      const newInscription = {
        programme_id: programmeId,
        programme_nom: programme.nom,
        programme_type: programme.type,
        date_inscription: new Date().toISOString(),
        inscrit_par_id: AppState.user.id,
        inscrit_par_nom: `${AppState.user.prenom} ${AppState.user.nom}`,
        statut: 'inscrit', // inscrit, en_cours, termine, abandonne
        date_debut: null,
        date_fin: null,
        notes: null
      };
      
      inscriptions.push(newInscription);
      
      await NouvellesAmes.update(nouvelleAmeId, {
        programmes_inscrits: inscriptions
      }, true);
      
      Toast.success(`Inscrit(e) au programme "${programme.nom}"`);
      return true;
    } catch (error) {
      console.error('Erreur inscription programme:', error);
      Toast.error('Erreur lors de l\'inscription');
      return false;
    }
  },

  // Mettre à jour le statut d'une inscription
  async updateStatut(nouvelleAmeId, programmeId, nouveauStatut, notes = null) {
    try {
      const na = NouvellesAmes.getById(nouvelleAmeId);
      if (!na) return false;
      
      const inscriptions = na.programmes_inscrits || [];
      const index = inscriptions.findIndex(i => i.programme_id === programmeId);
      
      if (index === -1) {
        Toast.error('Inscription non trouvée');
        return false;
      }
      
      inscriptions[index].statut = nouveauStatut;
      if (notes) inscriptions[index].notes = notes;
      
      if (nouveauStatut === 'en_cours' && !inscriptions[index].date_debut) {
        inscriptions[index].date_debut = new Date().toISOString();
      }
      if (nouveauStatut === 'termine' || nouveauStatut === 'abandonne') {
        inscriptions[index].date_fin = new Date().toISOString();
      }
      
      await NouvellesAmes.update(nouvelleAmeId, {
        programmes_inscrits: inscriptions
      }, true);
      
      Toast.success('Statut mis à jour');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour inscription:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  // Désinscrire
  async desinscrire(nouvelleAmeId, programmeId) {
    try {
      const na = NouvellesAmes.getById(nouvelleAmeId);
      if (!na) return false;
      
      const inscriptions = (na.programmes_inscrits || []).filter(i => i.programme_id !== programmeId);
      
      await NouvellesAmes.update(nouvelleAmeId, {
        programmes_inscrits: inscriptions
      }, true);
      
      Toast.success('Désinscription effectuée');
      return true;
    } catch (error) {
      console.error('Erreur désinscription:', error);
      Toast.error('Erreur lors de la désinscription');
      return false;
    }
  },

  // Obtenir les programmes d'exhortation disponibles
  getProgrammesExhortation() {
    return AppState.programmes.filter(p => Programmes.isExhortation(p.type));
  },

  // Obtenir les statistiques d'inscription
  getStats(nouvelleAmeId) {
    const na = NouvellesAmes.getById(nouvelleAmeId);
    if (!na) return { total: 0, en_cours: 0, termines: 0 };
    
    const inscriptions = na.programmes_inscrits || [];
    return {
      total: inscriptions.length,
      en_cours: inscriptions.filter(i => i.statut === 'inscrit' || i.statut === 'en_cours').length,
      termines: inscriptions.filter(i => i.statut === 'termine').length
    };
  },

  // Statuts possibles
  getStatuts() {
    return [
      { value: 'inscrit', label: 'Inscrit', color: '#2196F3', icon: 'fa-user-plus' },
      { value: 'en_cours', label: 'En cours', color: '#FF9800', icon: 'fa-spinner' },
      { value: 'termine', label: 'Terminé', color: '#4CAF50', icon: 'fa-check-circle' },
      { value: 'abandonne', label: 'Abandonné', color: '#9E9E9E', icon: 'fa-times-circle' }
    ];
  },

  getStatutLabel(value) {
    const s = this.getStatuts().find(s => s.value === value);
    return s ? s.label : value;
  },

  getStatutColor(value) {
    const s = this.getStatuts().find(s => s.value === value);
    return s ? s.color : '#9E9E9E';
  }
};

// ============================================
// PAGES NOUVELLES ÂMES
// ============================================

const PagesNouvellesAmes = {
  currentFilters: { statut: 'actifs' },  // Par défaut, exclure les intégrés

  // Page liste des nouvelles âmes
  async render() {
    // Toujours recharger les données pour s'assurer qu'elles sont à jour
    await NouvellesAmes.loadAll();
    
    const stats = NouvellesAmes.getStats();
    const nouvellesAmes = NouvellesAmes.filterBy(this.currentFilters);
    const mentors = Membres.getMentors();
    
    return `
      <!-- Statistiques visuelles -->
      <div class="na-stats-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
        <div class="card" style="min-height: 280px;">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-chart-pie"></i> Par canal</h3></div>
          <div class="card-body" style="min-height: 220px;">
            <canvas id="chart-na-canal" style="max-height: 200px;"></canvas>
          </div>
        </div>
        <div class="card" style="min-height: 280px;">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-chart-line"></i> Évolution (6 mois)</h3></div>
          <div class="card-body" style="min-height: 220px;">
            <canvas id="chart-na-evolution" style="max-height: 200px;"></canvas>
          </div>
        </div>
      </div>
      <style>@media (max-width: 768px) { .na-stats-section { grid-template-columns: 1fr !important; } }</style>

      <div class="nouvelles-ames-header">
        <div class="stats-mini">
          <span class="stat-mini"><strong>${stats.total}</strong> total</span>
          <span class="stat-mini text-success"><strong>${stats.integres}</strong> intégrés</span>
          <span class="stat-mini text-warning"><strong>${stats.aRelancer}</strong> à relancer</span>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline" onclick="PagesNouvellesAmes.exportCSV()">
            <i class="fas fa-file-csv"></i> CSV
          </button>
          <button class="btn btn-outline" onclick="PagesNouvellesAmes.exportPDF()">
            <i class="fas fa-file-pdf"></i> PDF
          </button>
          <button class="btn btn-primary" onclick="App.navigate('nouvelles-ames-add')">
            <i class="fas fa-user-plus"></i> Ajouter
          </button>
        </div>
      </div>
      
      <div class="filters-bar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" class="form-control" id="search-na" 
                 placeholder="Rechercher..." onkeyup="PagesNouvellesAmes.applyFilters()">
        </div>
        <select class="form-control" id="filter-canal" onchange="PagesNouvellesAmes.applyFilters()">
          <option value="">Tous les canaux</option>
          ${CANAUX.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
        </select>
        <select class="form-control" id="filter-statut" onchange="PagesNouvellesAmes.applyFilters()">
          <option value="actifs">En cours (hors intégrés)</option>
          <option value="">Tous les statuts</option>
          ${STATUTS.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
        </select>
        <select class="form-control" id="filter-mentor" onchange="PagesNouvellesAmes.applyFilters()">
          <option value="">Tous les mentors</option>
          ${mentors.map(m => `<option value="${m.id}">${m.prenom} ${m.nom}</option>`).join('')}
        </select>
        <input type="date" class="form-control" id="filter-date-contact-debut" placeholder="1er contact du" 
               title="Date premier contact (du)" onchange="PagesNouvellesAmes.applyFilters()">
        <input type="date" class="form-control" id="filter-date-contact-fin" placeholder="au" 
               title="Date premier contact (au)" onchange="PagesNouvellesAmes.applyFilters()">
      </div>
      
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div id="na-list">
            ${nouvellesAmes.length > 0 ? nouvellesAmes.map(na => this.renderCard(na)).join('') : `
              <div class="empty-state">
                <i class="fas fa-user-plus"></i>
                <h3>Aucune nouvelle âme</h3>
                <p>Commencez par ajouter une nouvelle âme contactée.</p>
                <button class="btn btn-primary" onclick="App.navigate('nouvelles-ames-add')">
                  <i class="fas fa-plus"></i> Ajouter une nouvelle âme
                </button>
              </div>
            `}
          </div>
        </div>
      </div>
      
      <style>
        .nouvelles-ames-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .stats-mini {
          display: flex;
          gap: var(--spacing-md);
        }
        .stat-mini {
          background: var(--bg-secondary);
          padding: var(--spacing-xs) var(--spacing-md);
          border-radius: var(--radius-sm);
          font-size: 0.9rem;
        }
        .header-actions {
          display: flex;
          gap: var(--spacing-sm);
        }
        .filters-bar {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
          flex-wrap: wrap;
        }
        .filters-bar .form-control {
          width: auto;
          min-width: 150px;
        }
        .na-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background 0.2s;
        }
        .na-card:hover {
          background: var(--bg-primary);
        }
        .na-card.alerte {
          border-left: 4px solid var(--danger);
        }
        .na-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }
        .na-info {
          flex: 1;
          min-width: 0;
        }
        .na-name {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .na-meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .na-badges {
          display: flex;
          gap: var(--spacing-xs);
          flex-wrap: wrap;
        }
        .na-actions {
          display: flex;
          gap: var(--spacing-xs);
        }
        .badge-canal {
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .badge-statut {
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 12px;
          color: white;
        }
      </style>
    `;
  },

  // Carte d'une nouvelle âme
  renderCard(na) {
    const isAlerte = NouvellesAmes.getARelancer().some(a => a.id === na.id);
    const canal = CANAUX.find(c => c.value === na.canal) || {};
    const avatarBg = na.sexe === 'F' ? '#E91E63' : 'var(--primary)';
    
    return `
      <div class="na-card ${isAlerte ? 'alerte' : ''}" onclick="App.navigate('nouvelle-ame-detail', {id: '${na.id}'})">
        <div class="na-avatar" style="background: ${avatarBg}">
          ${Utils.getInitials(na.prenom, na.nom)}
        </div>
        <div class="na-info">
          <div class="na-name">
            ${isAlerte ? '🔔 ' : ''}${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}
          </div>
          <div class="na-meta">
            <span><i class="fas fa-phone"></i> ${Utils.escapeHtml(na.telephone || '-')}</span>
            <span><i class="fas fa-user"></i> ${Utils.escapeHtml(na.suivi_par_nom || '-')}</span>
          </div>
        </div>
        <div class="na-badges">
          <span class="badge-canal" style="background: ${canal.color}20; color: ${canal.color}">
            <i class="fas ${canal.icon}"></i> ${canal.label || na.canal}
          </span>
          <span class="badge-statut" style="background: ${NouvellesAmes.getStatutColor(na.statut)}">
            ${NouvellesAmes.getStatutLabel(na.statut)}
          </span>
        </div>
        <div class="na-actions" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-secondary" onclick="App.navigate('nouvelle-ame-suivi', {id: '${na.id}'})" title="Ajouter un suivi">
            <i class="fas fa-phone"></i>
          </button>
        </div>
      </div>
    `;
  },

  // Appliquer les filtres
  applyFilters() {
    const search = document.getElementById('search-na')?.value || '';
    const canal = document.getElementById('filter-canal')?.value || '';
    const statut = document.getElementById('filter-statut')?.value || '';
    const mentor = document.getElementById('filter-mentor')?.value || '';
    const dateDebut = document.getElementById('filter-date-contact-debut')?.value || '';
    const dateFin = document.getElementById('filter-date-contact-fin')?.value || '';
    
    this.currentFilters = {
      search: search || undefined,
      canal: canal || undefined,
      statut: statut || undefined,
      suivi_par_id: mentor || undefined,
      date_premier_contact_debut: dateDebut || undefined,
      date_premier_contact_fin: dateFin || undefined
    };
    
    const nouvellesAmes = NouvellesAmes.filterBy(this.currentFilters);
    const listContainer = document.getElementById('na-list');
    
    if (listContainer) {
      listContainer.innerHTML = nouvellesAmes.length > 0 
        ? nouvellesAmes.map(na => this.renderCard(na)).join('')
        : '<div class="empty-state"><i class="fas fa-search"></i><h3>Aucun résultat</h3></div>';
    }
  },

  // Page d'ajout
  renderAdd() {
    const mentors = Membres.getMentors();
    const today = new Date().toISOString().split('T')[0];
    
    return `
      <div class="card" style="max-width: 700px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-plus"></i> Ajouter une nouvelle âme</h3>
        </div>
        <div class="card-body">
          <form id="form-add-na" onsubmit="PagesNouvellesAmes.submitAdd(event)">
            
            <h4 class="section-title">Informations personnelles</h4>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label required">Prénom</label>
                <input type="text" class="form-control" name="prenom" required>
              </div>
              <div class="form-group">
                <label class="form-label required">Nom</label>
                <input type="text" class="form-control" name="nom" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label required">Téléphone</label>
                <input type="tel" class="form-control" name="telephone" required>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" name="email">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Sexe</label>
                <select class="form-control" name="sexe">
                  <option value="">-- Sélectionner --</option>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Ville / Quartier</label>
                <input type="text" class="form-control" name="adresse_ville" placeholder="Ex: Abidjan, Cocody">
              </div>
            </div>
            
            <h4 class="section-title">Origine du contact</h4>
            <div class="form-group">
              <label class="form-label required">Canal d'acquisition</label>
              <div class="radio-group">
                ${CANAUX.map(c => `
                  <label class="radio-card">
                    <input type="radio" name="canal" value="${c.value}" required onchange="PagesNouvellesAmes.toggleThematique()">
                    <span class="radio-content">
                      <i class="fas ${c.icon}" style="color: ${c.color}"></i>
                      <span>${c.label}</span>
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>
            
            <div class="form-group" id="thematique-group" style="display: none;">
              <label class="form-label required">Thématique</label>
              <select class="form-control" name="thematique">
                <option value="">-- Sélectionner --</option>
                ${THEMATIQUES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Date du premier contact</label>
                <input type="date" class="form-control" name="date_premier_contact" value="${today}">
              </div>
              <div class="form-group">
                <label class="form-label">Lieu du contact</label>
                <input type="text" class="form-control" name="lieu_contact" placeholder="Ex: Marché, Église...">
              </div>
            </div>
            
            <h4 class="section-title">Suivi</h4>
            <div class="form-group">
              <label class="form-label">Mentor assigné pour le suivi</label>
              <select class="form-control" name="suivi_par_id">
                <option value="">Moi-même (${AppState.user.prenom})</option>
                ${mentors.filter(m => m.id !== AppState.user.id).map(m => 
                  `<option value="${m.id}">${m.prenom} ${m.nom}</option>`
                ).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Défis / Attentes exprimés</label>
              <div class="checkbox-group">
                ${THEMATIQUES.map(t => `
                  <label class="checkbox-item">
                    <input type="checkbox" name="defis" value="${t.value}">
                    <span>${t.label}</span>
                  </label>
                `).join('')}
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Commentaires</label>
              <textarea class="form-control" name="commentaires" rows="3" placeholder="Notes sur cette personne..."></textarea>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="App.navigate('nouvelles-ames')">Annuler</button>
              <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
      
      <style>
        .section-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--primary);
          margin: var(--spacing-lg) 0 var(--spacing-md);
          padding-bottom: var(--spacing-xs);
          border-bottom: 1px solid var(--border-color);
        }
        .section-title:first-of-type {
          margin-top: 0;
        }
        .radio-group {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .radio-card {
          flex: 1;
          min-width: 150px;
          cursor: pointer;
        }
        .radio-card input {
          display: none;
        }
        .radio-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-md);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }
        .radio-card input:checked + .radio-content {
          border-color: var(--primary);
          background: var(--primary-light);
        }
        .radio-content i {
          font-size: 1.5rem;
        }
        .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }
        .checkbox-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--bg-primary);
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--border-color);
        }
      </style>
    `;
  },

  // Toggle affichage thématique
  toggleThematique() {
    const canal = document.querySelector('input[name="canal"]:checked')?.value;
    const thematiqueGroup = document.getElementById('thematique-group');
    if (thematiqueGroup) {
      thematiqueGroup.style.display = canal === 'exhortation' ? 'block' : 'none';
    }
  },

  // Soumettre le formulaire d'ajout
  async submitAdd(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    // Récupérer les défis cochés
    const defis = [];
    form.querySelectorAll('input[name="defis"]:checked').forEach(cb => defis.push(cb.value));
    
    // Obtenir le mentor sélectionné
    const suiviParId = formData.get('suivi_par_id');
    let suiviParNom = `${AppState.user.prenom} ${AppState.user.nom}`;
    if (suiviParId) {
      const mentor = Membres.getById(suiviParId);
      if (mentor) suiviParNom = `${mentor.prenom} ${mentor.nom}`;
    }
    
    const data = {
      prenom: formData.get('prenom'),
      nom: formData.get('nom'),
      telephone: formData.get('telephone'),
      email: formData.get('email') || null,
      sexe: formData.get('sexe') || null,
      adresse_ville: formData.get('adresse_ville') || null,
      canal: formData.get('canal'),
      thematique: formData.get('thematique') || null,
      date_premier_contact: formData.get('date_premier_contact') 
        ? firebase.firestore.Timestamp.fromDate(new Date(formData.get('date_premier_contact')))
        : null,
      lieu_contact: formData.get('lieu_contact') || null,
      suivi_par_id: suiviParId || AppState.user.id,
      suivi_par_nom: suiviParNom,
      defis: defis,
      commentaires: formData.get('commentaires') || null
    };
    
    const result = await NouvellesAmes.create(data);
    if (result) {
      App.navigate('nouvelles-ames');
    }
  },

  // Page détail d'une nouvelle âme
  async renderDetail(id) {
    const na = NouvellesAmes.getById(id);
    if (!na) {
      return '<div class="alert alert-danger">Nouvelle âme non trouvée</div>';
    }
    
    const suivis = await SuivisAmes.loadByNouvelleAme(id);
    const canal = CANAUX.find(c => c.value === na.canal) || {};
    const avatarBg = na.sexe === 'F' ? '#E91E63' : 'var(--primary)';
    
    const dateContact = na.date_premier_contact?.toDate 
      ? na.date_premier_contact.toDate() 
      : new Date(na.date_premier_contact);
    
    return `
      <div class="na-detail-header">
        <div class="na-detail-avatar" style="background: ${avatarBg}">
          ${Utils.getInitials(na.prenom, na.nom)}
        </div>
        <div class="na-detail-info">
          <h2>${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}</h2>
          <div class="na-detail-badges">
            <span class="badge-canal" style="background: ${canal.color}20; color: ${canal.color}">
              <i class="fas ${canal.icon}"></i> ${canal.label}
            </span>
            <span class="badge-statut" style="background: ${NouvellesAmes.getStatutColor(na.statut)}">
              ${NouvellesAmes.getStatutLabel(na.statut)}
            </span>
            ${na.thematique ? `<span class="badge badge-info">${NouvellesAmes.getThematiqueLabel(na.thematique)}</span>` : ''}
          </div>
        </div>
        <div class="na-detail-actions">
          <button class="btn btn-primary" onclick="App.navigate('nouvelle-ame-suivi', {id: '${id}'})">
            <i class="fas fa-plus"></i> Ajouter un suivi
          </button>
          ${Permissions.hasRole('adjoint_superviseur') && na.statut !== 'integre' ? `
          <button class="btn btn-success" onclick="PagesNouvellesAmes.convertirEnMembre('${id}')">
            <i class="fas fa-user-check"></i> Convertir en membre
          </button>
          ` : ''}
          <button class="btn btn-secondary" onclick="App.navigate('nouvelles-ames')">
            <i class="fas fa-arrow-left"></i> Retour
          </button>
        </div>
      </div>
      
      <div class="na-detail-grid">
        <div class="na-detail-section">
          <div class="card">
            <div class="card-header"><h3 class="card-title"><i class="fas fa-user"></i> Informations</h3></div>
            <div class="card-body">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Téléphone</span>
                  <span class="info-value">${Utils.escapeHtml(na.telephone || '-')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Email</span>
                  <span class="info-value">${Utils.escapeHtml(na.email || '-')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Sexe</span>
                  <span class="info-value">${na.sexe === 'M' ? 'Homme' : na.sexe === 'F' ? 'Femme' : '-'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Ville/Quartier</span>
                  <span class="info-value">${Utils.escapeHtml(na.adresse_ville || '-')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Premier contact</span>
                  <span class="info-value">${Utils.formatDate(dateContact)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Lieu de contact</span>
                  <span class="info-value">${Utils.escapeHtml(na.lieu_contact || '-')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Contacté par</span>
                  <span class="info-value">${Utils.escapeHtml(na.contacte_par_nom || '-')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Suivi par</span>
                  <span class="info-value">${Utils.escapeHtml(na.suivi_par_nom || '-')}</span>
                </div>
              </div>
              
              ${na.defis && na.defis.length > 0 ? `
              <div class="info-section">
                <span class="info-label">Défis / Attentes</span>
                <div class="defis-list">
                  ${na.defis.map(d => `<span class="badge badge-warning">${NouvellesAmes.getThematiqueLabel(d)}</span>`).join('')}
                </div>
              </div>
              ` : ''}
              
              ${na.commentaires ? `
              <div class="info-section">
                <span class="info-label">Commentaires</span>
                <p>${Utils.escapeHtml(na.commentaires)}</p>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="na-detail-section">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-history"></i> Historique des suivis</h3>
              <span class="badge badge-primary">${suivis.length}</span>
            </div>
            <div class="card-body" style="padding: 0;">
              ${suivis.length > 0 ? `
              <div class="timeline">
                ${suivis.map(s => this.renderSuiviItem(s)).join('')}
              </div>
              ` : `
              <div class="empty-state" style="padding: var(--spacing-lg);">
                <i class="fas fa-comments"></i>
                <h4>Aucun suivi enregistré</h4>
                <p>Ajoutez un premier suivi pour cette personne.</p>
              </div>
              `}
            </div>
          </div>
          
          <!-- Programmes d'exhortation -->
          <div class="card mt-3">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-graduation-cap"></i> Programmes d'exhortation</h3>
              ${na.statut !== 'integre' ? `
              <button class="btn btn-sm btn-primary" onclick="PagesNouvellesAmes.showInscriptionModal('${id}')">
                <i class="fas fa-plus"></i> Inscrire
              </button>
              ` : ''}
            </div>
            <div class="card-body" style="padding: 0;">
              ${this.renderProgrammesInscrits(na)}
            </div>
          </div>

          ${typeof NotesSuivi !== 'undefined' && NotesSuivi.canAddNote() ? `
          <div class="card mt-3">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-sticky-note"></i> Notes de suivi</h3>
            </div>
            <div class="card-body">
              <div id="notes-list-nouvelle_ame-${id}" class="notes-list" style="margin-bottom: var(--spacing-md);"></div>
              <div class="notes-add">
                <textarea class="form-control" id="note-input-nouvelle_ame-${id}" rows="2" placeholder="Ajouter une note de suivi..."></textarea>
                <button type="button" class="btn btn-primary btn-sm" onclick="NotesSuivi.addNote('nouvelle_ame', '${id}', document.getElementById('note-input-nouvelle_ame-${id}').value)">
                  <i class="fas fa-plus"></i> Ajouter
                </button>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
      
      <style>
        .na-detail-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
        }
        .na-detail-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 600;
          color: white;
        }
        .na-detail-info {
          flex: 1;
        }
        .na-detail-info h2 {
          margin-bottom: var(--spacing-xs);
        }
        .na-detail-badges {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .na-detail-actions {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .na-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-lg);
        }
        @media (max-width: 900px) {
          .na-detail-grid {
            grid-template-columns: 1fr;
          }
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-md);
        }
        .info-item {
          display: flex;
          flex-direction: column;
        }
        .info-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .info-value {
          font-weight: 500;
        }
        .info-section {
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border-color);
        }
        .defis-list {
          display: flex;
          gap: var(--spacing-xs);
          flex-wrap: wrap;
          margin-top: var(--spacing-xs);
        }
        .timeline {
          padding: var(--spacing-md);
        }
        .timeline-item {
          display: flex;
          gap: var(--spacing-md);
          padding-bottom: var(--spacing-md);
          border-left: 2px solid var(--border-color);
          margin-left: 10px;
          padding-left: var(--spacing-md);
          position: relative;
        }
        .timeline-item::before {
          content: '';
          position: absolute;
          left: -7px;
          top: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--primary);
        }
        .timeline-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .timeline-content {
          flex: 1;
        }
        .timeline-date {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .timeline-notes {
          margin-top: var(--spacing-xs);
          background: var(--bg-primary);
          padding: var(--spacing-sm);
          border-radius: var(--radius-sm);
        }
      </style>
    `;
  },

  // Rendu d'un item de suivi dans la timeline
  renderSuiviItem(suivi) {
    const date = suivi.date_suivi?.toDate 
      ? suivi.date_suivi.toDate() 
      : new Date(suivi.date_suivi);
    
    return `
      <div class="timeline-item">
        <div class="timeline-icon">
          <i class="fas ${SuivisAmes.getTypeSuiviIcon(suivi.type)}"></i>
        </div>
        <div class="timeline-content">
          <div class="timeline-header">
            <strong>${SuivisAmes.getTypeSuiviLabel(suivi.type)}</strong>
            <span class="timeline-date">${Utils.formatDate(date)} - ${Utils.escapeHtml(suivi.effectue_par_nom)}</span>
          </div>
          <div class="timeline-notes">${Utils.escapeHtml(suivi.notes)}</div>
          ${suivi.prochaine_action ? `
          <div class="timeline-next" style="margin-top: var(--spacing-xs); font-size: 0.85rem; color: var(--text-muted);">
            <i class="fas fa-arrow-right"></i> Prochaine action : ${Utils.escapeHtml(suivi.prochaine_action)}
          </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  // Page ajout de suivi
  renderAddSuivi(id) {
    const na = NouvellesAmes.getById(id);
    if (!na) {
      return '<div class="alert alert-danger">Nouvelle âme non trouvée</div>';
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    return `
      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-comment-dots"></i> Enregistrer un suivi</h3>
        </div>
        <div class="card-body">
          <div class="alert alert-info mb-3">
            <i class="fas fa-user"></i> ${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}
          </div>
          
          <form id="form-add-suivi" onsubmit="PagesNouvellesAmes.submitAddSuivi(event, '${id}')">
            <div class="form-group">
              <label class="form-label required">Type de contact</label>
              <select class="form-control" name="type" required>
                ${TYPES_SUIVI.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label required">Date du contact</label>
              <input type="date" class="form-control" name="date_suivi" value="${today}" required>
            </div>
            
            <div class="form-group">
              <label class="form-label required">Notes</label>
              <textarea class="form-control" name="notes" rows="4" required placeholder="Décrivez l'échange, l'état d'esprit de la personne..."></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label">Prochaine action prévue</label>
              <input type="text" class="form-control" name="prochaine_action" placeholder="Ex: Rappeler dans 3 jours">
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="App.navigate('nouvelle-ame-detail', {id: '${id}'})">Annuler</button>
              <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // Soumettre le formulaire de suivi
  async submitAddSuivi(event, nouvelleAmeId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
      nouvelle_ame_id: nouvelleAmeId,
      type: formData.get('type'),
      date_suivi: firebase.firestore.Timestamp.fromDate(new Date(formData.get('date_suivi'))),
      notes: formData.get('notes'),
      prochaine_action: formData.get('prochaine_action') || null
    };
    
    const result = await SuivisAmes.add(data);
    if (result) {
      App.navigate('nouvelle-ame-detail', { id: nouvelleAmeId });
    }
  },

  // Convertir en membre
  convertirEnMembre(id) {
    const na = NouvellesAmes.getById(id);
    if (!na) return;
    
    Modal.confirm(
      'Convertir en membre',
      `Voulez-vous convertir ${na.prenom} ${na.nom} en membre officiel de la famille ? Un compte utilisateur sera créé.`,
      async () => {
        await NouvellesAmes.convertToMembre(id);
        App.navigate('nouvelles-ames');
      }
    );
  },

  // Export CSV
  exportCSV() {
    const nouvellesAmes = NouvellesAmes.getAll();
    if (nouvellesAmes.length === 0) {
      Toast.warning('Aucune donnée à exporter');
      return;
    }
    
    const sep = ';';
    const escape = (val) => {
      if (val == null || val === '') return '';
      const s = String(val).replace(/"/g, '""');
      return /[;\r\n"]/.test(s) ? `"${s}"` : s;
    };
    const formatDate = (date) => {
      if (!date) return '';
      const d = date.toDate ? date.toDate() : new Date(date);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
    };
    
    const headers = ['Prénom', 'Nom', 'Téléphone', 'Email', 'Sexe', 'Canal', 'Thématique', 'Statut', 'Contacté par', 'Suivi par', 'Date premier contact', 'Commentaires'];
    const rows = nouvellesAmes.map(na => [
      escape(na.prenom),
      escape(na.nom),
      escape(na.telephone),
      escape(na.email),
      escape(na.sexe === 'M' ? 'Homme' : na.sexe === 'F' ? 'Femme' : ''),
      escape(NouvellesAmes.getCanalLabel(na.canal)),
      escape(na.thematique ? NouvellesAmes.getThematiqueLabel(na.thematique) : ''),
      escape(NouvellesAmes.getStatutLabel(na.statut)),
      escape(na.contacte_par_nom),
      escape(na.suivi_par_nom),
      escape(formatDate(na.date_premier_contact)),
      escape(na.commentaires)
    ].join(sep));
    
    const csv = '\uFEFF' + headers.join(sep) + '\r\n' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nouvelles_ames_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success(`Export de ${nouvellesAmes.length} nouvelle(s) âme(s) réussi`);
  },

  // Export PDF
  exportPDF() {
    const nouvellesAmes = NouvellesAmes.filterBy(this.currentFilters);
    if (nouvellesAmes.length === 0) {
      Toast.warning('Aucune donnée à exporter');
      return;
    }
    
    const escape = (val) => {
      if (val == null || val === '') return '-';
      return String(val).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    
    const formatDate = (date) => {
      if (!date) return '-';
      const d = date.toDate ? date.toDate() : new Date(date);
      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR');
    };
    
    const getStatutBadge = (statut) => {
      const color = NouvellesAmes.getStatutColor(statut);
      const label = NouvellesAmes.getStatutLabel(statut);
      return `<span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${label}</span>`;
    };
    
    const tableRows = nouvellesAmes.map(na => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${escape(na.prenom)} ${escape(na.nom)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${escape(na.telephone)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${escape(NouvellesAmes.getCanalLabel(na.canal))}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${getStatutBadge(na.statut)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${escape(na.suivi_par_nom)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatDate(na.date_premier_contact)}</td>
      </tr>
    `).join('');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Nouvelles Âmes - ${AppState.famille?.nom || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
          h1 { color: #2D5A7B; font-size: 20px; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #2D5A7B; color: white; padding: 10px 8px; text-align: left; font-size: 11px; }
          tr:nth-child(even) { background: #f9f9f9; }
          .stats { display: flex; gap: 20px; margin-bottom: 15px; }
          .stat { background: #f5f5f5; padding: 10px 15px; border-radius: 5px; }
          .stat-value { font-size: 18px; font-weight: bold; color: #2D5A7B; }
          .stat-label { font-size: 11px; color: #666; }
          .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Liste des Nouvelles Âmes</h1>
        <div class="subtitle">Famille ${escape(AppState.famille?.nom || '')} - Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
        
        <div class="stats">
          <div class="stat"><div class="stat-value">${nouvellesAmes.length}</div><div class="stat-label">Total</div></div>
          <div class="stat"><div class="stat-value">${nouvellesAmes.filter(n => n.statut === 'nouveau').length}</div><div class="stat-label">Nouveaux</div></div>
          <div class="stat"><div class="stat-value">${nouvellesAmes.filter(n => n.statut === 'en_suivi').length}</div><div class="stat-label">En suivi</div></div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Canal</th>
              <th>Statut</th>
              <th>Suivi par</th>
              <th>Premier contact</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="footer">CRM Famille - ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
      </body>
      </html>
    `;
    
    try {
      const printWindow = window.open('about:blank', '_blank');
      if (!printWindow) {
        Toast.error('Fenêtre bloquée. Autorisez les popups pour ce site.');
        return;
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 300);
      Toast.info('Fenêtre d\'impression ouverte');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      Toast.error('Erreur lors de la génération du PDF');
    }
  },

  // ============================================
  // PROGRAMMES D'EXHORTATION
  // ============================================

  // Rendu de la liste des programmes inscrits
  renderProgrammesInscrits(na) {
    const inscriptions = na.programmes_inscrits || [];
    
    if (inscriptions.length === 0) {
      return `
        <div class="empty-state" style="padding: var(--spacing-lg);">
          <i class="fas fa-graduation-cap"></i>
          <h4>Aucune inscription</h4>
          <p>Inscrivez cette personne à un programme d'exhortation.</p>
        </div>
      `;
    }
    
    return `
      <div class="inscriptions-list">
        ${inscriptions.map(i => this.renderInscriptionItem(i, na.id)).join('')}
      </div>
      <style>
        .inscriptions-list {
          display: flex;
          flex-direction: column;
        }
        .inscription-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
        }
        .inscription-item:last-child {
          border-bottom: none;
        }
        .inscription-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          color: white;
        }
        .inscription-info {
          flex: 1;
        }
        .inscription-name {
          font-weight: 600;
          margin-bottom: 2px;
        }
        .inscription-meta {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .inscription-actions {
          display: flex;
          gap: var(--spacing-xs);
        }
      </style>
    `;
  },

  // Rendu d'une inscription
  renderInscriptionItem(inscription, nouvelleAmeId) {
    const typeInfo = Programmes.getTypes().find(t => t.value === inscription.programme_type) || {};
    const statutInfo = InscriptionsProgrammes.getStatuts().find(s => s.value === inscription.statut) || {};
    const dateInscription = new Date(inscription.date_inscription);
    
    return `
      <div class="inscription-item">
        <div class="inscription-icon" style="background: ${typeInfo.color || '#607D8B'}">
          <i class="fas ${typeInfo.icon || 'fa-book'}"></i>
        </div>
        <div class="inscription-info">
          <div class="inscription-name">${Utils.escapeHtml(inscription.programme_nom)}</div>
          <div class="inscription-meta">
            Inscrit le ${dateInscription.toLocaleDateString('fr-FR')}
            ${inscription.date_debut ? `| Début: ${new Date(inscription.date_debut).toLocaleDateString('fr-FR')}` : ''}
          </div>
        </div>
        <span class="badge" style="background: ${statutInfo.color}20; color: ${statutInfo.color}">
          <i class="fas ${statutInfo.icon}"></i> ${statutInfo.label}
        </span>
        <div class="inscription-actions">
          <select class="form-control form-control-sm" style="width: auto; padding: 4px 8px;" 
                  onchange="PagesNouvellesAmes.updateInscriptionStatut('${nouvelleAmeId}', '${inscription.programme_id}', this.value)">
            ${InscriptionsProgrammes.getStatuts().map(s => 
              `<option value="${s.value}" ${s.value === inscription.statut ? 'selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
          <button class="btn btn-sm btn-danger" onclick="PagesNouvellesAmes.desinscrireProgramme('${nouvelleAmeId}', '${inscription.programme_id}')" title="Désinscrire">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  },

  // Afficher la modal d'inscription à un programme
  showInscriptionModal(nouvelleAmeId) {
    const na = NouvellesAmes.getById(nouvelleAmeId);
    if (!na) return;
    
    // Récupérer les programmes d'exhortation
    const programmesExhort = InscriptionsProgrammes.getProgrammesExhortation();
    const inscrits = (na.programmes_inscrits || []).map(i => i.programme_id);
    const disponibles = programmesExhort.filter(p => !inscrits.includes(p.id));
    
    const modalId = 'inscription-programme-modal';
    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-graduation-cap"></i> Inscrire à un programme</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info mb-3">
              <i class="fas fa-user"></i> ${Utils.escapeHtml(na.prenom)} ${Utils.escapeHtml(na.nom)}
            </div>
            
            ${disponibles.length > 0 ? `
            <div class="programmes-grid">
              ${disponibles.map(p => {
                const typeInfo = Programmes.getTypes().find(t => t.value === p.type) || {};
                const date = p.date_debut?.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
                return `
                <div class="programme-option" onclick="PagesNouvellesAmes.inscrireAuProgramme('${nouvelleAmeId}', '${p.id}')">
                  <div class="programme-option-icon" style="background: ${typeInfo.color}">
                    <i class="fas ${typeInfo.icon || 'fa-book'}"></i>
                  </div>
                  <div class="programme-option-info">
                    <div class="programme-option-name">${Utils.escapeHtml(p.nom)}</div>
                    <div class="programme-option-date">${date.toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
            ` : `
            <div class="alert alert-warning">
              <i class="fas fa-info-circle"></i>
              Aucun programme d'exhortation disponible. Créez d'abord un programme de type "Exhortation" dans le calendrier.
            </div>
            `}
          </div>
        </div>
      </div>
      <style>
        .programmes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--spacing-md);
        }
        .programme-option {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s;
        }
        .programme-option:hover {
          border-color: var(--primary);
          background: var(--bg-primary);
        }
        .programme-option-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .programme-option-name {
          font-weight: 600;
        }
        .programme-option-date {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
      </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // Inscrire au programme
  async inscrireAuProgramme(nouvelleAmeId, programmeId) {
    const result = await InscriptionsProgrammes.inscrire(nouvelleAmeId, programmeId);
    if (result) {
      document.getElementById('inscription-programme-modal')?.remove();
      App.navigate('nouvelle-ame-detail', { id: nouvelleAmeId });
    }
  },

  // Mettre à jour le statut d'inscription
  async updateInscriptionStatut(nouvelleAmeId, programmeId, nouveauStatut) {
    await InscriptionsProgrammes.updateStatut(nouvelleAmeId, programmeId, nouveauStatut);
  },

  // Désinscrire d'un programme
  desinscrireProgramme(nouvelleAmeId, programmeId) {
    Modal.confirm(
      'Désinscrire du programme',
      'Êtes-vous sûr de vouloir désinscrire cette personne de ce programme ?',
      async () => {
        const result = await InscriptionsProgrammes.desinscrire(nouvelleAmeId, programmeId);
        if (result) {
          App.navigate('nouvelle-ame-detail', { id: nouvelleAmeId });
        }
      }
    );
  },

  initCharts() {
    if (typeof ChartsHelper === 'undefined') return;
    const stats = NouvellesAmes.getStats();
    const evolution = NouvellesAmes.getEvolutionMensuelle(6);
    const parCanal = Object.entries(stats.parCanal || {}).filter(([, v]) => v > 0);
    const canvasCanal = document.getElementById('chart-na-canal');
    const canvasEvol = document.getElementById('chart-na-evolution');
    if (canvasCanal) {
      if (parCanal.length > 0) {
        const canalLabels = parCanal.map(([k]) => (CANAUX.find(c => c.value === k) || {}).label || k);
        const canalData = parCanal.map(([, v]) => v);
        const canalColors = parCanal.map(([k]) => (CANAUX.find(c => c.value === k) || {}).color || '#607D8B');
        ChartsHelper.createDoughnut('chart-na-canal', canalLabels, canalData, canalColors);
      }
    }
    if (canvasEvol && evolution.some(e => e.total > 0)) {
      ChartsHelper.createLine('chart-na-evolution', evolution.map(e => e.label), [
        { label: 'Nouvelles âmes', data: evolution.map(e => e.total) },
        { label: 'Intégrés', data: evolution.map(e => e.integres) }
      ]);
    }
  }
};
