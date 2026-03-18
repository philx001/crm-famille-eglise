// ============================================
// MODULE SUJETS DE PRIÈRE
// Phase 4 - Gestion des sujets de prière
// ============================================

const SujetsPriere = {
  items: [],

  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      const snapshot = await db.collection('sujets_priere')
        .where('famille_id', '==', familleId)
        .orderBy('created_at', 'desc')
        .get();

      this.items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return this.items;
    } catch (error) {
      console.error('Erreur chargement sujets:', error);
      return [];
    }
  },

  getCategoriesSujet() {
    return [
      { value: 'sante', label: 'Santé' },
      { value: 'spirituel', label: 'Spirituel' },
      { value: 'emploi_finances', label: 'Emploi / Finances' },
      { value: 'couple_famille', label: 'Couple / Famille' },
      { value: 'projets', label: 'Projets' },
      { value: 'autre', label: 'Autre' }
    ];
  },

  /** Sujets liés à un créneau (slot_id) : lecture seule pour tous, gestion par canManagePlanningConducteurs */
  getBySlotId(slotId) {
    return this.items.filter(s => s.slot_id === slotId);
  },

  getExaucesCountBySlotId(slotId) {
    return this.getBySlotId(slotId).filter(s => s.est_exauce).length;
  },

  isSujetProgramme(sujet) {
    return !!(sujet && sujet.slot_id);
  },

  async create(data) {
    try {
      const sujet = {
        contenu: data.contenu,
        sujet_categorie: data.sujet_categorie || 'autre',
        famille_id: AppState.famille.id,
        auteur_id: AppState.user.id,
        auteur_prenom: data.anonyme ? null : AppState.user.prenom,
        est_exauce: false,
        date_exaucement: null,
        slot_id: data.slot_id || null,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('sujets_priere').add(sujet);
      const newSujet = { id: docRef.id, ...sujet, created_at: new Date() };
      this.items.unshift(newSujet);

      Toast.success('Sujet de prière ajouté');
      return newSujet;
    } catch (error) {
      console.error('Erreur création sujet:', error);
      Toast.error('Erreur lors de l\'ajout');
      throw error;
    }
  },

  async update(id, data) {
    try {
      const sujet = this.items.find(s => s.id === id);
      if (!sujet) throw new Error('Sujet non trouvé');
      const canManageSlot = sujet.slot_id && Permissions.canManagePlanningConducteurs();
      if (!canManageSlot && sujet.auteur_id !== AppState.user.id && !Permissions.isAdmin()) {
        throw new Error('Permission refusée');
      }
      const updates = {
        contenu: data.contenu,
        sujet_categorie: data.sujet_categorie ?? sujet.sujet_categorie,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('sujets_priere').doc(id).update(updates);
      await this.loadAll();
      Toast.success('Sujet de prière modifié');
      return true;
    } catch (error) {
      console.error('Erreur modification sujet:', error);
      Toast.error(error.message || 'Erreur lors de la modification');
      return false;
    }
  },

  async markAsExauce(id, exauce = true) {
    try {
      const sujet = this.items.find(s => s.id === id);
      if (!sujet) throw new Error('Sujet non trouvé');

      await db.collection('sujets_priere').doc(id).update({
        est_exauce: exauce,
        date_exaucement: exauce ? firebase.firestore.FieldValue.serverTimestamp() : null
      });

      sujet.est_exauce = exauce;
      sujet.date_exaucement = exauce ? new Date() : null;

      Toast.success(exauce ? '🙏 Prière exaucée ! Gloire à Dieu !' : 'Marqué comme non exaucé');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  async delete(id) {
    try {
      const sujet = this.items.find(s => s.id === id);
      if (!sujet) throw new Error('Sujet non trouvé');
      const canManageSlot = sujet.slot_id && Permissions.canManagePlanningConducteurs();
      if (!canManageSlot && sujet.auteur_id !== AppState.user.id && !Permissions.isAdmin()) {
        throw new Error('Permission refusée');
      }

      await db.collection('sujets_priere').doc(id).delete();
      this.items = this.items.filter(s => s.id !== id);

      Toast.success('Sujet supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression:', error);
      Toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  },

  getEnAttente() {
    return this.items.filter(s => !s.est_exauce);
  },

  getExauces() {
    return this.items.filter(s => s.est_exauce);
  },

  // Statistiques détaillées pour graphiques
  getStats() {
    const enAttente = this.getEnAttente().length;
    const exauces = this.getExauces().length;
    return { total: this.items.length, enAttente, exauces, tauxExauce: this.items.length > 0 ? Math.round((exauces / this.items.length) * 1000) / 10 : 0 };
  },

  getEvolutionMensuelle(mois = 6) {
    const now = new Date();
    const result = [];
    for (let i = mois - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const sujets = this.items.filter(s => {
        const created = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at);
        return created >= d && created < next;
      });
      const exauces = sujets.filter(s => s.est_exauce).length;
      result.push({
        label: d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
        total: sujets.length,
        exauces,
        enAttente: sujets.length - exauces
      });
    }
    return result;
  }
};

// ============================================
// MODULE TÉMOIGNAGES
// ============================================

const Temoignages = {
  items: [],

  getCategoriesSujet() {
    return [
      { value: 'sante', label: 'Santé' },
      { value: 'spirituel', label: 'Spirituel' },
      { value: 'emploi_finances', label: 'Emploi / Finances' },
      { value: 'couple_famille', label: 'Couple / Famille' },
      { value: 'projets', label: 'Projets' },
      { value: 'autre', label: 'Autre' }
    ];
  },

  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      const snapshot = await db.collection('temoignages')
        .where('famille_id', '==', familleId)
        .orderBy('created_at', 'desc')
        .get();

      this.items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return this.items;
    } catch (error) {
      console.error('Erreur chargement témoignages:', error);
      return [];
    }
  },

  async create(data) {
    try {
      const temoignage = {
        contenu: data.contenu,
        sujet_categorie: data.sujet_categorie || 'autre',
        famille_id: AppState.famille.id,
        auteur_id: AppState.user.id,
        auteur_nom_complet: `${AppState.user.prenom} ${AppState.user.nom}`,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('temoignages').add(temoignage);
      const newTemoignage = { id: docRef.id, ...temoignage, created_at: new Date() };
      this.items.unshift(newTemoignage);

      Toast.success('Témoignage partagé ! 🙌');
      return newTemoignage;
    } catch (error) {
      console.error('Erreur création témoignage:', error);
      Toast.error('Erreur lors du partage');
      throw error;
    }
  },

  async uploadMedia(temoignageId, file) {
    const st = (typeof storage !== 'undefined' ? storage : null) || (window.firebaseServices && window.firebaseServices.storage);
    if (!st) throw new Error('Storage non disponible');
    const familleId = AppState.famille?.id;
    if (!familleId) throw new Error('Famille non définie');
    const ext = (file.name.split('.').pop() || '').toLowerCase() || (file.type.indexOf('audio') >= 0 ? 'mp3' : 'mp4');
    const path = `temoignages/${familleId}/${temoignageId}/media.${ext}`;
    const storageRef = st.ref(path);
    const snapshot = await storageRef.put(file);
    const url = await snapshot.ref.getDownloadURL();
    const mediaType = file.type.indexOf('audio') >= 0 ? 'audio' : 'video';
    return { url, mediaType };
  },

  async update(id, data) {
    try {
      const temoignage = this.items.find(t => t.id === id);
      if (!temoignage) throw new Error('Témoignage non trouvé');
      if (temoignage.auteur_id !== AppState.user.id && !Permissions.isAdmin()) {
        throw new Error('Seul l\'auteur peut modifier ce témoignage');
      }
      const updates = {
        contenu: data.contenu,
        sujet_categorie: data.sujet_categorie || temoignage.sujet_categorie,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (data.media_url !== undefined) updates.media_url = data.media_url;
      if (data.media_type !== undefined) updates.media_type = data.media_type;
      await db.collection('temoignages').doc(id).update(updates);
      await this.loadAll();
      Toast.success('Témoignage modifié');
      return true;
    } catch (error) {
      console.error('Erreur modification témoignage:', error);
      Toast.error(error.message || 'Erreur lors de la modification');
      return false;
    }
  },

  async delete(id) {
    try {
      const temoignage = this.items.find(t => t.id === id);
      if (!temoignage) throw new Error('Témoignage non trouvé');
      if (temoignage.auteur_id !== AppState.user.id && !Permissions.isAdmin()) {
        throw new Error('Seul l\'auteur ou un administrateur peut supprimer ce témoignage');
      }

      await db.collection('temoignages').doc(id).delete();
      this.items = this.items.filter(t => t.id !== id);

      Toast.success('Témoignage supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression:', error);
      Toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  }
};

// ============================================
// PLANNING CONDUCTEURS DE PRIÈRE
// ============================================

const PlanningConducteurs = {
  items: [],

  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      const snapshot = await db.collection('planning_conducteurs_priere')
        .where('famille_id', '==', familleId)
        .orderBy('date', 'asc')
        .get();

      this.items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return this.items;
    } catch (error) {
      console.error('Erreur chargement planning conducteurs:', error);
      return [];
    }
  },

  getByDate(dateStr) {
    return this.items.filter(s => s.date === dateStr).sort((a, b) => (a.heure_debut || '').localeCompare(b.heure_debut || ''));
  },

  getByMonth(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return this.items.filter(s => s.date && s.date.startsWith(prefix));
  },

  getByWeek(startDate) {
    const end = new Date(startDate);
    end.setDate(end.getDate() + 6);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return this.items.filter(s => s.date >= startStr && s.date <= endStr)
      .sort((a, b) => (a.date + (a.heure_debut || '')).localeCompare(b.date + (b.heure_debut || '')));
  },

  getConducteurLabel(slot, num) {
    const c = num === 1 ? slot.conducteur1_nom : slot.conducteur2_nom;
    if (c && (c.trim || c).trim) return (c.trim || c).trim();
    return 'Conducteur à Désigner';
  },

  async create(data) {
    try {
      if (!Permissions.canManagePlanningConducteurs()) throw new Error('Permission refusée');

      const slot = {
        famille_id: AppState.famille.id,
        date: data.date,
        heure_debut: data.heure_debut || '00:00',
        heure_fin: data.heure_fin || null,
        titre: (data.titre || '').trim() || null,
        programme_id: data.programme_id || null,
        conducteur1_id: data.conducteur1_id || null,
        conducteur1_nom: data.conducteur1_nom || null,
        conducteur1_prenom: data.conducteur1_prenom || null,
        conducteur2_id: data.conducteur2_id || null,
        conducteur2_nom: data.conducteur2_nom || null,
        conducteur2_prenom: data.conducteur2_prenom || null,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('planning_conducteurs_priere').add(slot);
      const newSlot = { id: docRef.id, ...slot };
      this.items.push(newSlot);
      this.items.sort((a, b) => (a.date + (a.heure_debut || '')).localeCompare(b.date + (b.heure_debut || '')));

      Toast.success('Créneau ajouté');
      return newSlot;
    } catch (error) {
      console.error('Erreur création créneau:', error);
      Toast.error(error.message || 'Erreur lors de l\'ajout');
      throw error;
    }
  },

  async update(id, data) {
    try {
      if (!Permissions.canManagePlanningConducteurs()) throw new Error('Permission refusée');

      const updates = {
        ...data,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('planning_conducteurs_priere').doc(id).update(updates);
      const idx = this.items.findIndex(s => s.id === id);
      if (idx !== -1) this.items[idx] = { ...this.items[idx], ...updates };

      Toast.success('Créneau modifié');
      return true;
    } catch (error) {
      console.error('Erreur modification créneau:', error);
      Toast.error(error.message || 'Erreur lors de la modification');
      throw error;
    }
  },

  async delete(id) {
    try {
      if (!Permissions.canManagePlanningConducteurs()) throw new Error('Permission refusée');

      await db.collection('planning_conducteurs_priere').doc(id).delete();
      this.items = this.items.filter(s => s.id !== id);

      Toast.success('Créneau supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression créneau:', error);
      Toast.error(error.message || 'Erreur lors de la suppression');
      throw error;
    }
  }
};

// ============================================
// PAGES SUJETS DE PRIÈRE
// ============================================

const DEFAULT_PAGE_SIZE_PRIERE = 10;

const PagesPriere = {
  currentTab: 'attente',
  showAllPriere: false,
  planningView: 'calendrier', // 'calendrier' | 'liste'
  planningYear: new Date().getFullYear(),
  planningMonth: new Date().getMonth(),
  planningWeekStart: null, // Date du lundi pour la vue liste

  async render() {
    await SujetsPriere.loadAll();
    await PlanningConducteurs.loadAll();
    const enAttente = SujetsPriere.getEnAttente();
    const exauces = SujetsPriere.getExauces();
    const stats = SujetsPriere.getStats();
    const evolution = SujetsPriere.getEvolutionMensuelle(6);

    const pageTabs = `
      <div class="priere-page-tabs" style="display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-lg); border-bottom: 1px solid var(--border-color); padding-bottom: var(--spacing-sm);">
        <button type="button" class="btn ${this.currentTab === 'attente' || this.currentTab === 'exauces' ? 'btn-primary' : 'btn-outline'}" 
                onclick="PagesPriere.setMainTab('sujets')">
          <i class="fas fa-praying-hands"></i> Sujets de prière
        </button>
        <button type="button" class="btn ${this.currentTab === 'planning' ? 'btn-primary' : 'btn-outline'}" 
                onclick="PagesPriere.setMainTab('planning')">
          <i class="fas fa-calendar-alt"></i> Planning conducteurs
        </button>
      </div>
    `;

    const planningSection = this.renderPlanningSection();

    return `
      ${pageTabs}
      <div id="priere-sujets-section" style="display: ${this.currentTab !== 'planning' ? 'block' : 'none'};">
      <!-- Statistiques Prière -->
      <div class="priere-stats-section" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
        <div class="stat-card-mini" style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${stats.total}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Total sujets</div>
        </div>
        <div class="stat-card-mini" style="background: #FF980020; padding: var(--spacing-md); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 700; color: #FF9800;">${stats.enAttente}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">En attente</div>
        </div>
        <div class="stat-card-mini" style="background: #4CAF5020; padding: var(--spacing-md); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 700; color: #4CAF50;">${stats.exauces}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Exaucés</div>
        </div>
        <div class="stat-card-mini" style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${stats.tauxExauce}%</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Taux exaucés</div>
        </div>
      </div>

      <div class="priere-charts-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
        <div class="card" style="min-height: 280px;">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-chart-pie"></i> Répartition</h3></div>
          <div class="card-body" style="display: flex; align-items: center; justify-content: center; min-height: 220px;">
            <canvas id="chart-priere-donut" style="max-height: 200px;"></canvas>
          </div>
        </div>
        <div class="card" style="min-height: 280px;">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-chart-line"></i> Évolution (6 mois)</h3></div>
          <div class="card-body" style="min-height: 220px;">
            <canvas id="chart-priere-evolution" style="max-height: 200px;"></canvas>
          </div>
        </div>
      </div>

      <div class="priere-header">
        <div class="priere-tabs">
          <button class="tab-btn ${this.currentTab === 'attente' ? 'active' : ''}" 
                  onclick="PagesPriere.setTab('attente')">
            <i class="fas fa-praying-hands"></i> En attente 
            <span class="tab-count">${enAttente.length}</span>
          </button>
          <button class="tab-btn ${this.currentTab === 'exauces' ? 'active' : ''}"
                  onclick="PagesPriere.setTab('exauces')">
            <i class="fas fa-check-circle"></i> Exaucés
            <span class="tab-count">${exauces.length}</span>
          </button>
        </div>
        <button class="btn btn-primary" onclick="PagesPriere.showAddModal()">
          <i class="fas fa-plus"></i> Nouveau sujet
        </button>
      </div>

      <div class="priere-list" id="priere-list">
        ${this.renderList()}
      </div>
      </div>

      <div id="priere-planning-section" style="display: ${this.currentTab === 'planning' ? 'block' : 'none'};">
        ${planningSection}
      </div>

      <!-- Modal ajout -->
      <div class="modal-overlay" id="modal-add-priere">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-praying-hands"></i> Nouveau sujet de prière</h3>
            <button class="modal-close" onclick="Modal.hide('modal-add-priere')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-add-priere" onsubmit="PagesPriere.submitSujet(event)">
              <input type="hidden" id="priere-slot-id" name="slot_id" value="">
              <div class="form-group">
                <label class="form-label">Catégorie</label>
                <select class="form-control" id="priere-categorie">
                  ${SujetsPriere.getCategoriesSujet().map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label required">Sujet de prière</label>
                <textarea class="form-control" id="priere-contenu" rows="4" 
                          placeholder="Partagez votre sujet de prière..." required></textarea>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input type="checkbox" id="priere-anonyme">
                  <label for="priere-anonyme">Publier anonymement</label>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.hide('modal-add-priere')">Annuler</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-add-priere').requestSubmit()">
              <i class="fas fa-paper-plane"></i> Partager
            </button>
          </div>
        </div>
      </div>

      <!-- Modal modification sujet -->
      <div class="modal-overlay" id="modal-edit-priere">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-edit"></i> Modifier le sujet de prière</h3>
            <button class="modal-close" onclick="Modal.hide('modal-edit-priere')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-edit-priere" onsubmit="PagesPriere.submitEditSujet(event)">
              <input type="hidden" id="priere-edit-id" value="">
              <div class="form-group">
                <label class="form-label">Catégorie</label>
                <select class="form-control" id="priere-categorie-edit">
                  ${SujetsPriere.getCategoriesSujet().map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label required">Sujet de prière</label>
                <textarea class="form-control" id="priere-contenu-edit" rows="4" required></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.hide('modal-edit-priere')">Annuler</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-edit-priere').requestSubmit()">
              <i class="fas fa-save"></i> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <!-- Modal détail sujet (lecture complète au clic sur une carte condensée) -->
      <div class="modal-overlay" id="modal-detail-priere">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-praying-hands"></i> Sujet de prière</h3>
            <button class="modal-close" onclick="Modal.hide('modal-detail-priere')">&times;</button>
          </div>
          <div class="modal-body" id="modal-detail-priere-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="btn-detail-priere-export" onclick="PagesPriere.exportSujetPDFFromDetail()" title="Exporter en PDF"><i class="fas fa-file-pdf"></i> PDF</button>
            <button type="button" class="btn btn-outline" id="btn-detail-priere-exauce" style="display: none;">Marquer exaucé</button>
            <button type="button" class="btn btn-outline" id="btn-detail-priere-edit" style="display: none;" onclick="PagesPriere.editFromDetailModalPriere()">Modifier</button>
            <button type="button" class="btn btn-outline" id="btn-detail-priere-delete" style="display: none;" onclick="PagesPriere.deleteFromDetailModalPriere()">Supprimer</button>
            <button type="button" class="btn btn-secondary" onclick="Modal.hide('modal-detail-priere')">Fermer</button>
          </div>
        </div>
      </div>

      <!-- Modal créneau conducteur (planning) -->
      <div class="modal-overlay" id="modal-slot-conducteur">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-user-clock"></i> Créneau conducteur de prière</h3>
            <button class="modal-close" onclick="Modal.hide('modal-slot-conducteur')">&times;</button>
          </div>
          <form id="form-slot-conducteur" onsubmit="PagesPriere.submitSlot(event)">
            <div class="modal-body">
              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                <div class="form-group">
                  <label class="form-label required">Date</label>
                  <input type="date" class="form-control" id="slot-date" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Heure début</label>
                  <input type="time" class="form-control" id="slot-heure-debut" value="19:00">
                </div>
              </div>
              <div class="form-group" id="slot-recurrence-group">
                <label class="form-label">Récurrence</label>
                <select class="form-control" id="slot-recurrence">
                  <option value="1">Une seule fois</option>
                  <option value="2">2 semaines</option>
                  <option value="4">4 semaines</option>
                  <option value="8">8 semaines</option>
                  <option value="12">12 semaines</option>
                </select>
                <span class="form-hint">Pour un créneau récurrent, le même horaire sera créé chaque semaine.</span>
              </div>
              <div class="form-group">
                <label class="form-label">Heure fin</label>
                <input type="time" class="form-control" id="slot-heure-fin" placeholder="Optionnel">
              </div>
              <div class="form-group">
                <label class="form-label required">Titre / Lieu</label>
                <input type="text" class="form-control" id="slot-titre" placeholder="Ex: Salle principale" required>
              </div>
              <div class="form-group">
                <label class="form-label">Lier à un programme (optionnel)</label>
                <select class="form-control" id="slot-programme">
                  <option value="">— Aucun —</option>
                  ${(typeof Programmes !== 'undefined' ? (AppState.programmes || []).filter(p => Programmes.getTypesPriere && Programmes.getTypesPriere().some(t => t.value === p.type)) : []).map(p => {
                    const d = p.date_debut?.toDate ? p.date_debut.toDate() : new Date(p.date_debut);
                    return `<option value="${p.id}">${Utils.escapeHtml(p.nom || '')} — ${Utils.formatDate(d, 'short')}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Conducteur 1</label>
                <input type="text" class="form-control" placeholder="Rechercher un membre..." id="slot-search1" oninput="PagesPriere.filterConducteurOptions(this, 'conducteur1')" autocomplete="off">
                <select class="form-control mt-1" id="slot-conducteur1" style="max-height: 120px;">
                  <option value="">Conducteur à Désigner</option>
                  ${(AppState.membres || []).filter(m => m.statut_compte !== 'inactif').map(m => `
                    <option value="${m.id}" data-search="${Utils.escapeHtml(((m.prenom || '') + ' ' + (m.nom || '') + ' ' + (m.email || '')).toLowerCase())}">
                      ${Utils.escapeHtml((m.prenom || '') + ' ' + (m.nom || ''))} ${m.email ? `(${Utils.escapeHtml(m.email)})` : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Conducteur 2</label>
                <input type="text" class="form-control" placeholder="Rechercher un membre..." id="slot-search2" oninput="PagesPriere.filterConducteurOptions(this, 'conducteur2')" autocomplete="off">
                <select class="form-control mt-1" id="slot-conducteur2" style="max-height: 120px;">
                  <option value="">Conducteur à Désigner</option>
                  ${(AppState.membres || []).filter(m => m.statut_compte !== 'inactif').map(m => `
                    <option value="${m.id}" data-search="${Utils.escapeHtml(((m.prenom || '') + ' ' + (m.nom || '') + ' ' + (m.email || '')).toLowerCase())}">
                      ${Utils.escapeHtml((m.prenom || '') + ' ' + (m.nom || ''))} ${m.email ? `(${Utils.escapeHtml(m.email)})` : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.hide('modal-slot-conducteur')">Annuler</button>
              <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal sujets d'un créneau (lecture seule + ajout + export PDF) -->
      <div class="modal-overlay" id="modal-slot-sujets">
        <div class="modal" style="max-width: 600px;">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-slot-sujets-title"><i class="fas fa-praying-hands"></i> Sujets de prière du créneau</h3>
            <button class="modal-close" onclick="Modal.hide('modal-slot-sujets')">&times;</button>
          </div>
          <div class="modal-body" id="modal-slot-sujets-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.hide('modal-slot-sujets')">Fermer</button>
          </div>
        </div>
      </div>

      <style>
        .priere-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .priere-tabs {
          display: flex;
          gap: var(--spacing-sm);
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-lg);
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }
        .tab-btn:hover {
          background: var(--bg-primary);
        }
        .tab-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .tab-count {
          background: rgba(255,255,255,0.2);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 0.8rem;
        }
        .tab-btn:not(.active) .tab-count {
          background: var(--bg-tertiary);
        }
        .priere-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        .priere-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          box-shadow: var(--shadow-sm);
          border-left: 4px solid var(--primary);
          transition: all 0.2s;
        }
        .priere-card:hover {
          box-shadow: var(--shadow-md);
        }
        .priere-card.exauce {
          border-left-color: var(--success);
          background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(76, 175, 80, 0.05) 100%);
        }
        .priere-card-condensed {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .priere-card-condensed:hover {
          background: var(--surface-hover, #f0f4f8);
        }
        .priere-titre-condensed {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        .priere-preview {
          color: var(--text-muted, #666);
          font-size: 0.9rem;
          white-space: pre-wrap;
          max-height: 2.6em;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .priere-contenu {
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: var(--spacing-md);
        }
        .priere-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .priere-meta {
          font-size: 0.85rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        .priere-actions {
          display: flex;
          gap: var(--spacing-sm);
        }
        .btn-exauce {
          background: var(--success);
          color: white;
        }
        .btn-exauce:hover {
          background: #43A047;
        }
        .priere-categorie-badge { margin-bottom: var(--spacing-sm); }
        .exauce-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: 4px 12px;
          background: var(--success);
          color: white;
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          font-weight: 500;
        }
        .attente-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: 4px 12px;
          background: #9e9e9e;
          color: white;
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          font-weight: 500;
        }
        .planning-slot-badge {
          font-size: 0.75rem;
          padding: 2px 6px;
          background: rgba(156, 39, 176, 0.2);
          border-radius: var(--radius-sm);
          margin-top: 2px;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .planning-slot-badge .slot-titre { font-weight: 600; display: block; margin-bottom: 2px; }
        .planning-slot-badge .slot-time { font-weight: 600; margin-right: 4px; }
        .slot-add-hint { font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; }
        #priere-planning-section .calendar-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        #priere-planning-section .calendar-table th { padding: var(--spacing-sm); text-align: center; background: var(--bg-primary); font-weight: 600; font-size: 0.85rem; }
        #priere-planning-section .calendar-day { border: 1px solid var(--border-color); vertical-align: top; height: 100px; padding: var(--spacing-xs); transition: background 0.2s; }
        #priere-planning-section .calendar-day:hover { background: var(--bg-primary); }
        #priere-planning-section .calendar-day.empty { background: var(--bg-tertiary); cursor: default; }
        #priere-planning-section .calendar-day.today { background: rgba(45, 90, 123, 0.1); }
        #priere-planning-section .day-number { font-weight: 600; font-size: 0.9rem; margin-bottom: var(--spacing-xs); }
        #priere-planning-section .day-events { display: flex; flex-direction: column; gap: 2px; }
      </style>
    `;
  },

  initCharts() {
    if (typeof ChartsHelper === 'undefined') return;
    const stats = SujetsPriere.getStats();
    const evolution = SujetsPriere.getEvolutionMensuelle(6);
    ChartsHelper.createDoughnut('chart-priere-donut', ['En attente', 'Exaucés'], [stats.enAttente, stats.exauces], ['#FF9800', '#4CAF50']);
    ChartsHelper.createLine('chart-priere-evolution', evolution.map(e => e.label), [
      { label: 'Total sujets', data: evolution.map(e => e.total) },
      { label: 'Exaucés', data: evolution.map(e => e.exauces) }
    ]);
  },

  renderList() {
    const items = this.currentTab === 'attente' ? SujetsPriere.getEnAttente() : SujetsPriere.getExauces();
    
    if (items.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-${this.currentTab === 'attente' ? 'praying-hands' : 'check-circle'}"></i>
          <h3>${this.currentTab === 'attente' ? 'Aucun sujet de prière' : 'Aucune prière exaucée'}</h3>
          <p>${this.currentTab === 'attente' ? 'Partagez vos sujets de prière avec la famille.' : 'Les prières exaucées apparaîtront ici.'}</p>
        </div>
      `;
    }

    const displayed = this.showAllPriere ? items : items.slice(0, DEFAULT_PAGE_SIZE_PRIERE);
    const hasMore = items.length > DEFAULT_PAGE_SIZE_PRIERE;
    const listHtml = displayed.map(s => this.renderSujetCardCondensed(s)).join('');
    let voirToutHtml = '';
    if (hasMore && !this.showAllPriere) {
      voirToutHtml = `<div class="priere-voir-tout-wrap" style="margin-top: var(--spacing-md); text-align: center;">
           <button type="button" class="btn btn-outline" onclick="PagesPriere.toggleVoirToutPriere()">
             <i class="fas fa-chevron-down"></i> Voir tout (${items.length} au total)
           </button>
           <p class="mt-2 mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${displayed.length} sujets affichés sur ${items.length}</p>
         </div>`;
    } else if (hasMore && this.showAllPriere) {
      voirToutHtml = `<div class="priere-voir-tout-wrap" style="margin-top: var(--spacing-md); text-align: center;">
           <button type="button" class="btn btn-outline" onclick="PagesPriere.toggleVoirToutPriere()">
             <i class="fas fa-chevron-up"></i> Réduire
           </button>
           <p class="mt-2 mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${items.length} sujets affichés</p>
         </div>`;
    } else if (items.length > 0) {
      voirToutHtml = `<div class="priere-voir-tout-wrap" style="margin-top: var(--spacing-sm); text-align: center;">
           <p class="mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${items.length} sujet(s) affiché(s) — 10 derniers par défaut quand il y en a plus</p>
         </div>`;
    }
    return listHtml + voirToutHtml;
  },

  renderSujetCardCondensed(sujet) {
    const date = sujet.created_at?.toDate ? sujet.created_at.toDate() : new Date(sujet.created_at);
    const catValue = sujet.sujet_categorie || 'autre';
    const catLabel = SujetsPriere.getCategoriesSujet().find(c => c.value === catValue)?.label || 'Autre';
    const isProgramme = SujetsPriere.isSujetProgramme(sujet);
    const canManageSlot = isProgramme && Permissions.canManagePlanningConducteurs();
    const canDelete = canManageSlot || (!isProgramme && (sujet.auteur_id === AppState.user?.id || Permissions.isAdmin()));
    const slotBadge = isProgramme ? (() => {
      const slot = PlanningConducteurs.items.find(s => s.id === sujet.slot_id);
      const slotStr = slot ? `Programme — ${Utils.formatDate(new Date(slot.date + 'T12:00:00'), 'short')}` : 'Programme';
      return ` <span class="badge badge-info" style="font-size: 0.7rem;">${Utils.escapeHtml(slotStr)}</span>`;
    })() : '';
    const titre = (sujet.titre && sujet.titre.trim()) ? sujet.titre.trim() : (Utils.getTitleFromContent(sujet.contenu || '') || catLabel);
    const preview = Utils.getPreviewLines(sujet.contenu || '', 2);
    return `
      <div class="priere-card priere-card-condensed ${sujet.est_exauce ? 'exauce' : ''}" onclick="PagesPriere.showDetailModalPriere('${sujet.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();PagesPriere.showDetailModalPriere('${sujet.id}');}">
        <div class="priere-categorie-badge"><span class="badge badge-secondary">${Utils.escapeHtml(catLabel)}</span>${slotBadge}</div>
        <div class="priere-titre-condensed">${Utils.escapeHtml(titre)}</div>
        ${preview ? `<div class="priere-preview">${Utils.escapeHtml(preview).replace(/\n/g, ' ')}</div>` : ''}
        <div class="priere-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div class="priere-meta">
            <span><i class="fas fa-user"></i> ${sujet.auteur_prenom ? Utils.escapeHtml(sujet.auteur_prenom) : 'Anonyme'}</span>
            <span><i class="fas fa-clock"></i> ${Utils.formatRelativeDate(date)}</span>
            ${sujet.est_exauce ? '<span class="exauce-badge"><i class="fas fa-check"></i> Exaucé</span>' : '<span class="attente-badge">En attente</span>'}
          </div>
          ${canDelete ? `
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); event.preventDefault(); PagesPriere.deleteSujetFromCard('${sujet.id}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  toggleVoirToutPriere() {
    this.showAllPriere = !this.showAllPriere;
    const listEl = document.getElementById('priere-list');
    if (listEl) listEl.innerHTML = this.renderList();
  },

  showDetailModalPriere(sujetId) {
    const sujet = SujetsPriere.items.find(s => s.id === sujetId);
    if (!sujet) return;
    const date = sujet.created_at?.toDate ? sujet.created_at.toDate() : new Date(sujet.created_at);
    const isProgramme = SujetsPriere.isSujetProgramme(sujet);
    const canManageSlot = isProgramme && Permissions.canManagePlanningConducteurs();
    const canEdit = canManageSlot || (!isProgramme && (sujet.auteur_id === AppState.user.id || Permissions.isAdmin()));
    const canDelete = canEdit;
    const canMarkExauce = sujet.auteur_id === AppState.user.id || Permissions.isAdmin();
    const catLabel = SujetsPriere.getCategoriesSujet().find(c => c.value === (sujet.sujet_categorie || 'autre'))?.label || 'Autre';
    const slotBadge = isProgramme ? (() => {
      const slot = PlanningConducteurs.items.find(s => s.id === sujet.slot_id);
      const slotStr = slot ? `Programme — ${Utils.formatDate(new Date(slot.date + 'T12:00:00'), 'short')} ${slot.heure_debut || ''}` : 'Programme';
      return ` <span class="badge badge-info">${Utils.escapeHtml(slotStr)}</span>`;
    })() : '';
    const modalBody = document.getElementById('modal-detail-priere-body');
    const modalEditBtn = document.getElementById('btn-detail-priere-edit');
    const modalDeleteBtn = document.getElementById('btn-detail-priere-delete');
    const modalExauceBtn = document.getElementById('btn-detail-priere-exauce');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="priere-categorie-badge mb-2"><span class="badge badge-secondary">${Utils.escapeHtml(catLabel)}</span>${slotBadge}</div>
        <div class="priere-contenu">${Utils.escapeHtml(sujet.contenu || '').replace(/\n/g, '<br>')}</div>
        <div class="priere-footer mt-3">
          <div class="priere-meta">
            <span><i class="fas fa-user"></i> ${sujet.auteur_prenom ? Utils.escapeHtml(sujet.auteur_prenom) : 'Anonyme'}</span>
            <span><i class="fas fa-clock"></i> ${Utils.formatDate(date, 'full')}</span>
            ${sujet.est_exauce ? '<span class="exauce-badge"><i class="fas fa-check"></i> Exaucé</span>' : ''}
          </div>
        </div>
      `;
    }
    if (modalEditBtn) modalEditBtn.style.display = canEdit ? 'inline-flex' : 'none';
    if (modalDeleteBtn) modalDeleteBtn.style.display = canDelete ? 'inline-flex' : 'none';
    if (modalExauceBtn) {
      modalExauceBtn.style.display = canMarkExauce ? 'inline-flex' : 'none';
      modalExauceBtn.textContent = sujet.est_exauce ? 'Annuler exaucement' : 'Marquer exaucé';
      modalExauceBtn.onclick = async () => {
        if (sujet.est_exauce) await PagesPriere.unmarkExauce(sujetId); else await PagesPriere.markExauce(sujetId);
        Modal.hide('modal-detail-priere');
        const listEl = document.getElementById('priere-list');
        if (listEl) listEl.innerHTML = PagesPriere.renderList();
      };
    }
    const modal = document.getElementById('modal-detail-priere');
    if (modal) modal.dataset.sujetId = sujetId;
    Modal.show('modal-detail-priere');
  },

  editFromDetailModalPriere() {
    const modal = document.getElementById('modal-detail-priere');
    const id = modal && modal.dataset.sujetId;
    Modal.hide('modal-detail-priere');
    if (id) PagesPriere.showEditModal(id);
  },

  async deleteFromDetailModalPriere() {
    const modal = document.getElementById('modal-detail-priere');
    const id = modal && modal.dataset.sujetId;
    if (!id) return;
    Modal.hide('modal-detail-priere');
    await PagesPriere.deleteSujet(id);
    document.getElementById('priere-list').innerHTML = PagesPriere.renderList();
  },

  deleteSujetFromCard(id) {
    this.deleteSujet(id);
  },

  renderSujetCard(sujet) {
    const date = sujet.created_at?.toDate ? sujet.created_at.toDate() : new Date(sujet.created_at);
    const isProgramme = SujetsPriere.isSujetProgramme(sujet);
    const canManageSlot = isProgramme && Permissions.canManagePlanningConducteurs();
    const canDelete = canManageSlot || (!isProgramme && (sujet.auteur_id === AppState.user.id || Permissions.isAdmin()));
    const canEdit = canManageSlot || (!isProgramme && (sujet.auteur_id === AppState.user.id || Permissions.isAdmin()));
    const canMarkExauce = sujet.auteur_id === AppState.user.id || Permissions.isAdmin();
    const catValue = sujet.sujet_categorie || 'autre';
    const catLabel = SujetsPriere.getCategoriesSujet().find(c => c.value === catValue)?.label || 'Autre';
    const slotBadge = isProgramme ? (() => {
      const slot = PlanningConducteurs.items.find(s => s.id === sujet.slot_id);
      const slotStr = slot ? `Programme — ${Utils.formatDate(new Date(slot.date + 'T12:00:00'), 'short')} ${slot.heure_debut || ''}` : 'Programme';
      return `<span class="badge badge-info" style="margin-left: 4px;">${Utils.escapeHtml(slotStr)}</span>`;
    })() : '';

    return `
      <div class="priere-card ${sujet.est_exauce ? 'exauce' : ''}">
        <div class="priere-categorie-badge"><span class="badge badge-secondary">${Utils.escapeHtml(catLabel)}</span>${slotBadge}</div>
        <div class="priere-contenu">${Utils.escapeHtml(sujet.contenu).replace(/\n/g, '<br>')}</div>
        <div class="priere-footer">
          <div class="priere-meta">
            <span><i class="fas fa-user"></i> ${sujet.auteur_prenom ? Utils.escapeHtml(sujet.auteur_prenom) : 'Anonyme'}</span>
            <span><i class="fas fa-clock"></i> ${Utils.formatDate(date, 'full')}</span>
            ${sujet.est_exauce ? `
              <span class="exauce-badge"><i class="fas fa-check"></i> Exaucé</span>
            ` : `
              <span class="attente-badge"><i class="fas fa-hourglass-half"></i> En attente d'exaucement</span>
            `}
          </div>
          <div class="priere-actions">
            <button class="btn btn-sm btn-outline" onclick="PagesPriere.exportSujetPDF('${sujet.id}')" title="Exporter en PDF">
              <i class="fas fa-file-pdf"></i>
            </button>
            ${!sujet.est_exauce && canMarkExauce ? `
              <button class="btn btn-sm btn-exauce" onclick="PagesPriere.markExauce('${sujet.id}')" title="Marquer comme exaucé">
                <i class="fas fa-check"></i> Exaucé !
              </button>
            ` : ''}
            ${sujet.est_exauce && canMarkExauce ? `
              <button class="btn btn-sm btn-secondary" onclick="PagesPriere.unmarkExauce('${sujet.id}')" title="Annuler">
                <i class="fas fa-undo"></i>
              </button>
            ` : ''}
            ${canEdit ? `
              <button class="btn btn-sm btn-secondary" onclick="PagesPriere.showEditModal('${sujet.id}')" title="Modifier">
                <i class="fas fa-edit"></i>
              </button>
            ` : ''}
            ${canDelete ? `
              <button class="btn btn-sm btn-secondary" onclick="PagesPriere.deleteSujet('${sujet.id}')" title="Supprimer">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  setTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.classList.remove('active');
      if ((tab === 'attente' && i === 0) || (tab === 'exauces' && i === 1)) btn.classList.add('active');
    });
    const listEl = document.getElementById('priere-list');
    if (listEl) listEl.innerHTML = this.renderList();
  },

  setMainTab(tab) {
    this.currentTab = tab;
    const sujetsEl = document.getElementById('priere-sujets-section');
    const planningEl = document.getElementById('priere-planning-section');
    if (sujetsEl) sujetsEl.style.display = tab !== 'planning' ? 'block' : 'none';
    if (planningEl) planningEl.style.display = tab === 'planning' ? 'block' : 'none';
    document.querySelectorAll('.priere-page-tabs .btn').forEach((btn, i) => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
      if ((tab !== 'planning' && i === 0) || (tab === 'planning' && i === 1)) {
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
      }
    });
    if (tab === 'planning' && planningEl) {
      planningEl.innerHTML = this.renderPlanningSection();
    }
    if (tab !== 'planning' && typeof this.initCharts === 'function') this.initCharts();
  },

  renderPlanningSection() {
    const canManage = Permissions.canManagePlanningConducteurs();
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const year = this.planningYear;
    const month = this.planningMonth;

    const viewTabs = `
      <div style="display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); flex-wrap: wrap;">
        <button type="button" class="btn ${this.planningView === 'calendrier' ? 'btn-primary' : 'btn-outline'}" onclick="PagesPriere.setPlanningView('calendrier')">
          <i class="fas fa-calendar-alt"></i> Calendrier
        </button>
        <button type="button" class="btn ${this.planningView === 'liste' ? 'btn-primary' : 'btn-outline'}" onclick="PagesPriere.setPlanningView('liste')">
          <i class="fas fa-list"></i> Liste hebdomadaire
        </button>
      </div>
    `;

    if (this.planningView === 'calendrier') {
      const slotsByDay = {};
      PlanningConducteurs.getByMonth(year, month).forEach(s => {
        const day = s.date ? parseInt(s.date.split('-')[2], 10) : 0;
        if (!slotsByDay[day]) slotsByDay[day] = [];
        slotsByDay[day].push(s);
      });
      Object.keys(slotsByDay).forEach(day => {
        slotsByDay[day].sort((a, b) => (a.heure_debut || '').localeCompare(b.heure_debut || ''));
      });

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      const startDay = firstDay === 0 ? 6 : firstDay - 1;
      const today = new Date();

      let calHtml = '';
      let dayCount = 1;
      for (let week = 0; week < 6; week++) {
        let weekHtml = '<tr>';
        for (let d = 0; d < 7; d++) {
          if ((week === 0 && d < startDay) || dayCount > daysInMonth) {
            weekHtml += '<td class="calendar-day empty"></td>';
          } else {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
            const isToday = today.getDate() === dayCount && today.getMonth() === month && today.getFullYear() === year;
            const daySlots = slotsByDay[dayCount] || [];
            weekHtml += `
              <td class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}" ${canManage ? `onclick="PagesPriere.openSlotModal('${dateStr}')" style="cursor: pointer;"` : ''}>
                <div class="day-number">${dayCount}</div>
                <div class="day-events planning-slots">
                  ${daySlots.map(slot => {
                    const titre = (slot.titre || '').trim();
                    const c1 = PlanningConducteurs.getConducteurLabel(slot, 1);
                    const c2 = PlanningConducteurs.getConducteurLabel(slot, 2);
                    const conducteurs = `${c1}${slot.conducteur2_id || slot.conducteur2_nom ? ' / ' + c2 : ''}`;
                    return `
                    <div class="planning-slot-badge" ${canManage ? `onclick="event.stopPropagation(); PagesPriere.editSlot('${slot.id}')"` : ''}>
                      ${titre ? `<span class="slot-titre">${Utils.escapeHtml(titre)}</span>` : ''}
                      <span class="slot-time">${slot.heure_debut || '—'}</span>
                      <span class="slot-conducteurs">${Utils.escapeHtml(conducteurs)}</span>
                    </div>
                  `;
                  }).join('')}
                  ${canManage && daySlots.length === 0 ? '<div class="slot-add-hint"><i class="fas fa-plus"></i> Ajouter</div>' : ''}
                </div>
              </td>
            `;
            dayCount++;
          }
        }
        weekHtml += '</tr>';
        calHtml += weekHtml;
        if (dayCount > daysInMonth) break;
      }

      const monthSlots = PlanningConducteurs.getByMonth(year, month);
      const slotsListHtml = monthSlots.length === 0
        ? '<p class="text-muted" style="padding: var(--spacing-md);">Aucun créneau ce mois-ci.</p>'
        : monthSlots.map(slot => {
            const c1 = PlanningConducteurs.getConducteurLabel(slot, 1);
            const c2 = PlanningConducteurs.getConducteurLabel(slot, 2);
            const sujetCount = SujetsPriere.getBySlotId(slot.id).length;
            const exaucesCount = SujetsPriere.getExaucesCountBySlotId(slot.id);
            const sujetsLabel = sujetCount > 0 ? (exaucesCount > 0 ? ` (${sujetCount}) — ${exaucesCount} exaucé${exaucesCount > 1 ? 's' : ''}` : ` (${sujetCount})`) : '';
            return `
              <div class="planning-slot-row" style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--border-color); gap: var(--spacing-md); flex-wrap: wrap;">
                <div>
                  <strong>${Utils.formatDate(new Date(slot.date + 'T12:00:00'), 'full')}</strong> — ${slot.heure_debut || '—'}
                  ${slot.titre ? `<span class="badge badge-secondary" style="margin-left: 6px;">${Utils.escapeHtml(slot.titre)}</span>` : ''}
                  <span class="text-muted" style="font-size: 0.85rem;">${Utils.escapeHtml(c1)} / ${Utils.escapeHtml(c2)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                  <button class="btn btn-sm btn-outline" onclick="PagesPriere.showSlotSujetsModal('${slot.id}')" title="Voir et gérer les sujets de prière">
                    <i class="fas fa-praying-hands"></i> Sujets${sujetsLabel}
                  </button>
                  ${canManage ? `
                    <button class="btn btn-sm btn-secondary" onclick="PagesPriere.editSlot('${slot.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="PagesPriere.deleteSlot('${slot.id}')"><i class="fas fa-trash"></i></button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('');

      return `
        <div class="card">
          <div class="card-header" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-md);">
            <div style="display: flex; align-items: center; gap: var(--spacing-md);">
              <button class="btn btn-icon btn-secondary" onclick="PagesPriere.planningPrevMonth()"><i class="fas fa-chevron-left"></i></button>
              <h3 class="card-title mb-0">${monthNames[month]} ${year}</h3>
              <button class="btn btn-icon btn-secondary" onclick="PagesPriere.planningNextMonth()"><i class="fas fa-chevron-right"></i></button>
            </div>
            ${canManage ? `<button class="btn btn-primary" onclick="PagesPriere.openSlotModal()"><i class="fas fa-plus"></i> Ajouter un créneau</button>` : ''}
          </div>
          <div class="card-body" style="overflow-x: auto;">
            ${viewTabs}
            <table class="calendar-table" style="width: 100%; border-collapse: collapse;">
              <thead><tr><th>Lun</th><th>Mar</th><th>Mer</th><th>Jeu</th><th>Ven</th><th>Sam</th><th>Dim</th></tr></thead>
              <tbody>${calHtml}</tbody>
            </table>
          </div>
        </div>
        <div class="card" style="margin-top: var(--spacing-lg);">
          <div class="card-header">
            <h3 class="card-title mb-0"><i class="fas fa-list"></i> Créneaux du mois</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            ${slotsListHtml}
          </div>
        </div>
      `;
    }

    let weekStart = this.planningWeekStart;
    if (!weekStart) {
      weekStart = new Date(year, month, 1);
      while (weekStart.getDay() !== 1) weekStart.setDate(weekStart.getDate() - 1);
    }
    const weekSlots = PlanningConducteurs.getByWeek(weekStart);

    const listHtml = weekSlots.length === 0
      ? '<div class="empty-state"><i class="fas fa-calendar-plus"></i><h3>Aucun créneau cette semaine</h3><p>Cliquez sur un jour du calendrier ou sur "Ajouter un créneau" pour planifier les conducteurs.</p></div>'
      : weekSlots.map(slot => {
          const c1 = PlanningConducteurs.getConducteurLabel(slot, 1);
          const c2 = PlanningConducteurs.getConducteurLabel(slot, 2);
          const sujetCount = SujetsPriere.getBySlotId(slot.id).length;
          const exaucesCount = SujetsPriere.getExaucesCountBySlotId(slot.id);
          const sujetsLabel = sujetCount > 0 ? (exaucesCount > 0 ? ` (${sujetCount}) — ${exaucesCount} exaucé${exaucesCount > 1 ? 's' : ''}` : ` (${sujetCount})`) : '';
          return `
            <div class="planning-list-item" style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--radius-md); margin-bottom: var(--spacing-sm); flex-wrap: wrap; gap: var(--spacing-sm);">
              <div>
                <strong>${Utils.formatDate(new Date(slot.date + 'T12:00:00'), 'full')}</strong> — ${slot.heure_debut || '—'}
                ${slot.titre ? `<span class="badge badge-secondary">${Utils.escapeHtml(slot.titre)}</span>` : ''}
              </div>
              <div style="display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap;">
                <span>${Utils.escapeHtml(c1)} / ${Utils.escapeHtml(c2)}</span>
                <button class="btn btn-sm btn-outline" onclick="PagesPriere.showSlotSujetsModal('${slot.id}')" title="Voir et gérer les sujets de prière">
                  <i class="fas fa-praying-hands"></i> Sujets${sujetsLabel}
                </button>
                ${canManage ? `
                  <button class="btn btn-sm btn-secondary" onclick="PagesPriere.editSlot('${slot.id}')"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-sm btn-danger" onclick="PagesPriere.deleteSlot('${slot.id}')"><i class="fas fa-trash"></i></button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

    return `
      <div class="card">
        <div class="card-header" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-md);">
          <h3 class="card-title mb-0"><i class="fas fa-list"></i> Semaine du ${Utils.formatDate(weekStart, 'full')}</h3>
          ${canManage ? `<button class="btn btn-primary" onclick="PagesPriere.openSlotModal()"><i class="fas fa-plus"></i> Ajouter un créneau</button>` : ''}
        </div>
        <div class="card-body">
          ${viewTabs}
          <div id="planning-list-content">${listHtml}</div>
        </div>
      </div>
      <div style="margin-top: var(--spacing-md);">
        <button class="btn btn-outline btn-sm" onclick="PagesPriere.planningPrevWeek()"><i class="fas fa-chevron-left"></i> Semaine précédente</button>
        <button class="btn btn-outline btn-sm" onclick="PagesPriere.planningNextWeek()" style="margin-left: var(--spacing-sm);"><i class="fas fa-chevron-right"></i> Semaine suivante</button>
      </div>
    `;
  },

  setPlanningView(view) {
    this.planningView = view;
    if (view === 'liste' && !this.planningWeekStart) {
      const d = new Date();
      while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
      this.planningWeekStart = new Date(d);
    }
    const section = document.getElementById('priere-planning-section');
    if (section) section.innerHTML = this.renderPlanningSection();
  },

  planningPrevMonth() {
    this.planningMonth--;
    if (this.planningMonth < 0) { this.planningMonth = 11; this.planningYear--; }
    const section = document.getElementById('priere-planning-section');
    if (section) section.innerHTML = this.renderPlanningSection();
  },

  planningNextMonth() {
    this.planningMonth++;
    if (this.planningMonth > 11) { this.planningMonth = 0; this.planningYear++; }
    const section = document.getElementById('priere-planning-section');
    if (section) section.innerHTML = this.renderPlanningSection();
  },

  planningPrevWeek() {
    const base = this.planningWeekStart || (() => { const d = new Date(this.planningYear, this.planningMonth, 1); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); return d; })();
    this.planningWeekStart = new Date(base);
    this.planningWeekStart.setDate(this.planningWeekStart.getDate() - 7);
    const section = document.getElementById('priere-planning-section');
    if (section) section.innerHTML = this.renderPlanningSection();
  },

  planningNextWeek() {
    const base = this.planningWeekStart || (() => { const d = new Date(this.planningYear, this.planningMonth, 1); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); return d; })();
    this.planningWeekStart = new Date(base);
    this.planningWeekStart.setDate(this.planningWeekStart.getDate() + 7);
    const section = document.getElementById('priere-planning-section');
    if (section) section.innerHTML = this.renderPlanningSection();
  },

  openSlotModal(dateStr = null) {
    if (!Permissions.canManagePlanningConducteurs()) return;
    const modal = document.getElementById('modal-slot-conducteur');
    if (modal) {
      const dateEl = document.getElementById('slot-date');
      const titreEl = document.getElementById('slot-titre');
      const progEl = document.getElementById('slot-programme');
      const recurEl = document.getElementById('slot-recurrence-group');
      if (dateEl) dateEl.value = dateStr || Utils.toDateInputValue(new Date());
      if (document.getElementById('slot-heure-debut')) document.getElementById('slot-heure-debut').value = '19:00';
      if (document.getElementById('slot-heure-fin')) document.getElementById('slot-heure-fin').value = '';
      if (titreEl) titreEl.value = '';
      if (progEl) progEl.value = '';
      if (document.getElementById('slot-recurrence')) document.getElementById('slot-recurrence').value = '1';
      if (recurEl) recurEl.style.display = '';
      PagesPriere.resetConducteurSelects();
      ['slot-search1', 'slot-search2'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
      modal.dataset.slotId = '';
      Modal.show('modal-slot-conducteur');
    }
  },

  async editSlot(slotId) {
    if (!Permissions.canManagePlanningConducteurs()) return;
    const slot = PlanningConducteurs.items.find(s => s.id === slotId);
    if (!slot) return;
    const modal = document.getElementById('modal-slot-conducteur');
    if (modal) {
      modal.dataset.slotId = slotId;
      const dateEl = document.getElementById('slot-date');
      if (dateEl) dateEl.value = slot.date || '';
      const hd = document.getElementById('slot-heure-debut');
      if (hd) hd.value = slot.heure_debut || '19:00';
      const hf = document.getElementById('slot-heure-fin');
      if (hf) hf.value = slot.heure_fin || '';
      const titreEl = document.getElementById('slot-titre');
      if (titreEl) titreEl.value = slot.titre || '';
      const progEl = document.getElementById('slot-programme');
      if (progEl) progEl.value = slot.programme_id || '';
      const recurGroup = document.getElementById('slot-recurrence-group');
      if (recurGroup) recurGroup.style.display = 'none';
      PagesPriere.setConducteurSelects(slot);
      Modal.show('modal-slot-conducteur');
    }
  },

  resetConducteurSelects() {
    ['conducteur1', 'conducteur2'].forEach(name => {
      const el = document.getElementById(`slot-${name}`);
      if (el) el.value = '';
    });
  },

  setConducteurSelects(slot) {
    const c1 = document.getElementById('slot-conducteur1');
    const c2 = document.getElementById('slot-conducteur2');
    if (c1) c1.value = slot.conducteur1_id || '';
    if (c2) c2.value = slot.conducteur2_id || '';
  },

  async submitSlot(event) {
    event.preventDefault();
    if (!Permissions.canManagePlanningConducteurs()) return;
    const modalEl = document.getElementById('modal-slot-conducteur');
    const slotId = (modalEl?.dataset?.slotId || '').trim();
    const dateEl = document.getElementById('slot-date');
    const data = {
      date: dateEl?.value || '',
      heure_debut: document.getElementById('slot-heure-debut')?.value || '19:00',
      heure_fin: (document.getElementById('slot-heure-fin')?.value || '').trim() || null,
      titre: (document.getElementById('slot-titre')?.value || '').trim() || null,
      programme_id: (document.getElementById('slot-programme')?.value || '').trim() || null,
      conducteur1_id: (document.getElementById('slot-conducteur1')?.value || '').trim() || null,
      conducteur2_id: (document.getElementById('slot-conducteur2')?.value || '').trim() || null
    };
    const c1 = data.conducteur1_id ? (AppState.membres.find(m => m.id === data.conducteur1_id)) : null;
    const c2 = data.conducteur2_id ? (AppState.membres.find(m => m.id === data.conducteur2_id)) : null;
    data.conducteur1_nom = c1 ? `${c1.prenom || ''} ${c1.nom || ''}`.trim() : null;
    data.conducteur1_prenom = c1?.prenom || null;
    data.conducteur2_nom = c2 ? `${c2.prenom || ''} ${c2.nom || ''}`.trim() : null;
    data.conducteur2_prenom = c2?.prenom || null;
    if (!data.date) { Toast.error('Veuillez sélectionner une date'); return; }
    if (!data.titre) { Toast.error('Veuillez renseigner le titre ou lieu du créneau'); return; }
    try {
      if (slotId) {
        await PlanningConducteurs.update(slotId, data);
      } else {
        const count = parseInt(document.getElementById('slot-recurrence')?.value || '1', 10) || 1;
        const baseDate = new Date(data.date + 'T12:00:00');
        for (let i = 0; i < count; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + (i * 7));
          const slotData = { ...data, date: d.toISOString().split('T')[0] };
          await PlanningConducteurs.create(slotData);
        }
      }
      Modal.hide('modal-slot-conducteur');
      const section = document.getElementById('priere-planning-section');
      if (section) section.innerHTML = this.renderPlanningSection();
    } catch (e) {}
  },

  async deleteSlot(slotId) {
    if (!Permissions.canManagePlanningConducteurs()) return;
    if (!confirm('Supprimer ce créneau ?')) return;
    try {
      await PlanningConducteurs.delete(slotId);
      const section = document.getElementById('priere-planning-section');
      if (section) section.innerHTML = this.renderPlanningSection();
    } catch (e) {}
  },

  showSlotSujetsModal(slotId) {
    const slot = PlanningConducteurs.items.find(s => s.id === slotId);
    if (!slot) return;
    const sujets = SujetsPriere.getBySlotId(slotId);
    const canManage = Permissions.canManagePlanningConducteurs();
    const slotLabel = `${Utils.formatDate(new Date(slot.date + 'T12:00:00'), 'full')} — ${slot.heure_debut || '—'}${slot.titre ? ' — ' + slot.titre : ''}`;

    const titleEl = document.getElementById('modal-slot-sujets-title');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-praying-hands"></i> Sujets — ${Utils.escapeHtml(slotLabel)}`;

    const bodyEl = document.getElementById('modal-slot-sujets-body');
    if (!bodyEl) return;

    const sujetsHtml = sujets.length === 0
      ? '<p class="text-muted">Aucun sujet de prière pour ce créneau.</p>'
      : sujets.map(s => {
          const date = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at);
          const catLabel = SujetsPriere.getCategoriesSujet().find(c => c.value === (s.sujet_categorie || 'autre'))?.label || 'Autre';
          const canMarkExauce = s.auteur_id === AppState.user?.id || Permissions.isAdmin();
          const exauceBadge = s.est_exauce
            ? '<span class="exauce-badge" style="margin-left: 6px;"><i class="fas fa-check"></i> Exaucé</span>'
            : '<span class="attente-badge" style="margin-left: 6px;"><i class="fas fa-hourglass-half"></i> En attente</span>';
          const markBtn = canMarkExauce ? (s.est_exauce
            ? `<button type="button" class="btn btn-sm btn-secondary" onclick="PagesPriere.markExauceFromSlotModal('${s.id}', '${slotId}', false)" title="Annuler exaucement"><i class="fas fa-undo"></i></button>`
            : `<button type="button" class="btn btn-sm btn-exauce" onclick="PagesPriere.markExauceFromSlotModal('${s.id}', '${slotId}', true)" title="Marquer comme exaucé"><i class="fas fa-check"></i> Exaucé !</button>`
          ) : '';
          return `
            <div class="priere-card ${s.est_exauce ? 'exauce' : ''}" style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--radius-md); border-left: 3px solid ${s.est_exauce ? 'var(--success)' : 'var(--border-color)'};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--spacing-sm); flex-wrap: wrap;">
                <div style="flex: 1; min-width: 0;">
                  <span class="badge badge-secondary">${Utils.escapeHtml(catLabel)}</span>${exauceBadge}
                  <div style="margin-top: 6px; white-space: pre-wrap;">${Utils.escapeHtml(s.contenu || '').replace(/\n/g, '<br>')}</div>
                  <div class="text-muted" style="font-size: 0.85rem; margin-top: 6px;">
                    ${s.auteur_prenom ? Utils.escapeHtml(s.auteur_prenom) : 'Anonyme'} — ${Utils.formatDate(date, 'full')}
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  ${markBtn}
                  <button type="button" class="btn btn-sm btn-outline" onclick="PagesPriere.exportSujetPDF('${s.id}')" title="Exporter en PDF">
                    <i class="fas fa-file-pdf"></i> PDF
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');

    bodyEl.innerHTML = `
      ${sujetsHtml}
      ${canManage ? `
        <div style="margin-top: var(--spacing-md);">
          <button type="button" class="btn btn-primary" onclick="PagesPriere.showAddSujetForSlot('${slotId}')">
            <i class="fas fa-plus"></i> Ajouter des sujets
          </button>
        </div>
      ` : ''}
    `;
    bodyEl.dataset.slotId = slotId;
    Modal.show('modal-slot-sujets');
  },

  async markExauceFromSlotModal(sujetId, slotId, exauce) {
    const success = await SujetsPriere.markAsExauce(sujetId, exauce);
    if (success) {
      this.showSlotSujetsModal(slotId);
      const section = document.getElementById('priere-planning-section');
      if (section) section.innerHTML = this.renderPlanningSection();
      const tabCount1 = document.querySelector('.tab-btn:first-child .tab-count');
      const tabCount2 = document.querySelector('.tab-btn:last-child .tab-count');
      if (tabCount1) tabCount1.textContent = SujetsPriere.getEnAttente().length;
      if (tabCount2) tabCount2.textContent = SujetsPriere.getExauces().length;
    }
  },

  exportSujetPDFFromDetail() {
    const modal = document.getElementById('modal-detail-priere');
    const id = modal && modal.dataset.sujetId;
    if (id) this.exportSujetPDF(id);
  },

  exportSujetPDF(sujetId) {
    const sujet = SujetsPriere.items.find(s => s.id === sujetId);
    if (!sujet) return;
    const date = sujet.created_at?.toDate ? sujet.created_at.toDate() : new Date(sujet.created_at);
    const catLabel = SujetsPriere.getCategoriesSujet().find(c => c.value === (sujet.sujet_categorie || 'autre'))?.label || 'Autre';
    const slotLabel = sujet.slot_id ? (() => {
      const slot = PlanningConducteurs.items.find(s => s.id === sujet.slot_id);
      return slot ? ` — ${Utils.formatDate(new Date(slot.date + 'T12:00:00'), 'full')} ${slot.heure_debut || ''}` : '';
    })() : '';
    const html = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { font-family: Arial, sans-serif; margin: 24px; font-size: 14px; }
        h1 { color: #2D5A7B; font-size: 18px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
        .contenu { white-space: pre-wrap; line-height: 1.5; }
      </style></head><body>
        <h1>Sujet de prière</h1>
        <div class="meta">${Utils.escapeHtml(catLabel)}${slotLabel ? ' — Programme du ' + slotLabel : ''}</div>
        <div class="meta">${sujet.auteur_prenom ? Utils.escapeHtml(sujet.auteur_prenom) : 'Anonyme'} — ${Utils.formatDate(date, 'full')}</div>
        <div class="contenu">${Utils.escapeHtml(sujet.contenu || '').replace(/\n/g, '<br>')}</div>
      </body></html>
    `;
    const filename = `sujet-priere-${sujetId.slice(0, 8)}.pdf`;
    if (typeof PDFExport !== 'undefined' && PDFExport.downloadHtmlAsPdf) {
      PDFExport.downloadHtmlAsPdf(html, filename)
        .then(() => Toast.success('PDF téléchargé'))
        .catch(() => {
          if (PDFExport.openForPrint) {
            PDFExport.openForPrint(html, 'Sujet de prière');
            Toast.success('Fenêtre ouverte : utilisez Ctrl+P puis « Enregistrer au format PDF ».');
          }
        });
    } else if (typeof PDFExport !== 'undefined' && PDFExport.openForPrint) {
      PDFExport.openForPrint(html, 'Sujet de prière');
      Toast.success('Fenêtre ouverte : utilisez Ctrl+P puis « Enregistrer au format PDF ».');
    } else {
      Toast.error('Export PDF indisponible.');
    }
  },

  filterConducteurOptions(searchInput, selectName) {
    const q = (searchInput.value || '').toLowerCase().trim();
    const select = document.getElementById(`slot-${selectName}`);
    if (!select) return;
    const options = select.querySelectorAll('option');
    options.forEach(opt => {
      const search = (opt.dataset.search || opt.textContent || '').toLowerCase();
      opt.style.display = !q || search.includes(q) ? '' : 'none';
    });
  },

  showAddModal() {
    document.getElementById('priere-contenu').value = '';
    document.getElementById('priere-categorie').value = 'autre';
    document.getElementById('priere-anonyme').checked = false;
    const slotEl = document.getElementById('priere-slot-id');
    if (slotEl) slotEl.value = '';
    Modal.show('modal-add-priere');
  },

  showAddSujetForSlot(slotId) {
    document.getElementById('priere-contenu').value = '';
    document.getElementById('priere-categorie').value = 'autre';
    document.getElementById('priere-anonyme').checked = false;
    const slotEl = document.getElementById('priere-slot-id');
    if (slotEl) slotEl.value = slotId || '';
    Modal.hide('modal-slot-sujets');
    Modal.show('modal-add-priere');
  },

  showEditModal(sujetId) {
    const sujet = SujetsPriere.items.find(s => s.id === sujetId);
    if (!sujet) return;
    document.getElementById('priere-edit-id').value = sujetId;
    document.getElementById('priere-contenu-edit').value = sujet.contenu || '';
    const catSelect = document.getElementById('priere-categorie-edit');
    if (catSelect) catSelect.value = sujet.sujet_categorie || 'autre';
    Modal.show('modal-edit-priere');
  },

  async submitEditSujet(event) {
    event.preventDefault();
    const id = document.getElementById('priere-edit-id').value;
    const contenu = document.getElementById('priere-contenu-edit').value.trim();
    const sujet_categorie = document.getElementById('priere-categorie-edit')?.value || 'autre';
    if (!contenu) { Toast.error('Veuillez entrer un sujet de prière'); return; }
    const success = await SujetsPriere.update(id, { contenu, sujet_categorie });
    if (success) {
      Modal.hide('modal-edit-priere');
      document.getElementById('priere-list').innerHTML = this.renderList();
      document.querySelector('.tab-btn:first-child .tab-count').textContent = SujetsPriere.getEnAttente().length;
      document.querySelector('.tab-btn:last-child .tab-count').textContent = SujetsPriere.getExauces().length;
    }
  },

  async submitSujet(event) {
    event.preventDefault();
    
    const contenu = document.getElementById('priere-contenu').value.trim();
    const sujet_categorie = document.getElementById('priere-categorie')?.value || 'autre';
    const anonyme = document.getElementById('priere-anonyme').checked;
    const slot_id = (document.getElementById('priere-slot-id')?.value || '').trim() || null;

    if (!contenu) {
      Toast.error('Veuillez entrer un sujet de prière');
      return;
    }

    try {
      await SujetsPriere.create({ contenu, sujet_categorie, anonyme, slot_id });
      Modal.hide('modal-add-priere');
      if (slot_id) {
        this.showSlotSujetsModal(slot_id);
        const section = document.getElementById('priere-planning-section');
        if (section) section.innerHTML = this.renderPlanningSection();
      } else {
        this.currentTab = 'attente';
        document.getElementById('priere-list').innerHTML = this.renderList();
      }
      document.querySelector('.tab-btn:first-child .tab-count').textContent = SujetsPriere.getEnAttente().length;
      document.querySelector('.tab-btn:last-child .tab-count').textContent = SujetsPriere.getExauces().length;
    } catch (error) {}
  },

  async markExauce(id) {
    if (await SujetsPriere.markAsExauce(id, true)) {
      document.getElementById('priere-list').innerHTML = this.renderList();
      document.querySelector('.tab-btn:first-child .tab-count').textContent = SujetsPriere.getEnAttente().length;
      document.querySelector('.tab-btn:last-child .tab-count').textContent = SujetsPriere.getExauces().length;
    }
  },

  async unmarkExauce(id) {
    if (await SujetsPriere.markAsExauce(id, false)) {
      document.getElementById('priere-list').innerHTML = this.renderList();
      document.querySelector('.tab-btn:first-child .tab-count').textContent = SujetsPriere.getEnAttente().length;
      document.querySelector('.tab-btn:last-child .tab-count').textContent = SujetsPriere.getExauces().length;
    }
  },

  async deleteSujet(id) {
    Modal.confirm(
      'Supprimer le sujet',
      'Êtes-vous sûr de vouloir supprimer ce sujet de prière ?',
      async () => {
        if (await SujetsPriere.delete(id)) {
          document.getElementById('priere-list').innerHTML = this.renderList();
          document.querySelector('.tab-btn:first-child .tab-count').textContent = SujetsPriere.getEnAttente().length;
          document.querySelector('.tab-btn:last-child .tab-count').textContent = SujetsPriere.getExauces().length;
        }
      }
    );
  }
};

// ============================================
// PAGES TÉMOIGNAGES
// ============================================

const DEFAULT_PAGE_SIZE_TEMOIGNAGES = 10;

const PagesTemoignages = {
  showAllTemoignages: false,

  async render() {
    try {
      await Temoignages.loadAll();
    } catch (err) {
      console.error('Erreur chargement témoignages:', err);
      return `
      <div class="alert alert-danger">
        <strong>Impossible de charger les témoignages.</strong>
        <p>Vérifiez votre connexion et <a href="#" onclick="location.reload(); return false;">rafraîchissez la page</a>.</p>
      </div>`;
    }

    return `
      <div class="temoignages-header">
        <p class="temoignages-intro">
          <i class="fas fa-quote-left"></i>
          Partagez ce que Dieu fait dans votre vie pour encourager la famille !
        </p>
        <button class="btn btn-primary" onclick="PagesTemoignages.showAddModal()">
          <i class="fas fa-plus"></i> Partager un témoignage
        </button>
      </div>

      <div class="temoignages-list" id="temoignages-list">
        ${Temoignages.items.length > 0 ? this.renderListTemoignages() : `
          <div class="empty-state">
            <i class="fas fa-comment-dots"></i>
            <h3>Aucun témoignage</h3>
            <p>Soyez le premier à partager ce que Dieu fait dans votre vie !</p>
          </div>
        `}
      </div>
      <div id="temoignages-voir-tout-wrap" style="display: ${Temoignages.items.length > 0 ? 'block' : 'none'}; text-align: center; margin-top: var(--spacing-md); font-size: 0.9rem;">
        ${Temoignages.items.length > DEFAULT_PAGE_SIZE_TEMOIGNAGES ? `<button type="button" class="btn btn-outline" id="btn-voir-tout-temoignages" onclick="PagesTemoignages.toggleVoirToutTemoignages()">${this.showAllTemoignages ? 'Réduire' : `Voir tout (${Temoignages.items.length} au total)`}</button>` : ''}
        <p class="mt-2 mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${Temoignages.items.length > 0 ? (Temoignages.items.length > DEFAULT_PAGE_SIZE_TEMOIGNAGES ? (this.showAllTemoignages ? `${Temoignages.items.length} témoignages affichés` : `${Math.min(DEFAULT_PAGE_SIZE_TEMOIGNAGES, Temoignages.items.length)} témoignage(s) affiché(s) sur ${Temoignages.items.length}`) : `${Temoignages.items.length} témoignage(s) affiché(s) — 10 derniers par défaut quand il y en a plus`) : ''}</p>
      </div>

      <!-- Modal ajout -->
      <div class="modal-overlay" id="modal-add-temoignage">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-star"></i> Partager un témoignage</h3>
            <button class="modal-close" onclick="Modal.hide('modal-add-temoignage')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-add-temoignage" onsubmit="PagesTemoignages.submitTemoignage(event)">
              <div class="form-group">
                <label class="form-label">Sujet du témoignage</label>
                <select class="form-control" id="temoignage-categorie">
                  ${Temoignages.getCategoriesSujet().map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label required">Votre témoignage</label>
                <textarea class="form-control" id="temoignage-contenu" rows="6" 
                          placeholder="Racontez ce que Dieu a fait dans votre vie..." required></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Audio ou courte vidéo (optionnel)</label>
                <input type="file" class="form-control" id="temoignage-media" accept="audio/*,video/mp4,video/webm" 
                       title="Max 15 Mo – audio ou courte vidéo">
                <small class="form-text text-muted">MP3, WAV, MP4, WebM – max 15 Mo</small>
              </div>
              <div class="alert alert-info">
                <i class="fas fa-info-circle"></i>
                <span>Votre nom sera affiché avec votre témoignage pour encourager la famille.</span>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.hide('modal-add-temoignage')">Annuler</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-add-temoignage').requestSubmit()">
              <i class="fas fa-paper-plane"></i> Partager
            </button>
          </div>
        </div>
      </div>

      <!-- Modal modification témoignage -->
      <div class="modal-overlay" id="modal-edit-temoignage">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-edit"></i> Modifier le témoignage</h3>
            <button class="modal-close" onclick="Modal.hide('modal-edit-temoignage')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-edit-temoignage" onsubmit="PagesTemoignages.submitEditTemoignage(event)">
              <input type="hidden" id="temoignage-edit-id" value="">
              <div class="form-group">
                <label class="form-label">Catégorie</label>
                <select class="form-control" id="temoignage-categorie-edit">
                  ${Temoignages.getCategoriesSujet().map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label required">Votre témoignage</label>
                <textarea class="form-control" id="temoignage-contenu-edit" rows="6" required></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Remplacer l'audio/vidéo (optionnel)</label>
                <input type="file" class="form-control" id="temoignage-media-edit" accept="audio/*,video/mp4,video/webm" 
                       title="Max 15 Mo">
                <small class="form-text text-muted">Laissez vide pour conserver le média actuel. Max 15 Mo.</small>
                <div id="temoignage-edit-media-preview" class="mt-2" style="display:none;"></div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.hide('modal-edit-temoignage')">Annuler</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-edit-temoignage').requestSubmit()">
              <i class="fas fa-save"></i> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <!-- Modal détail témoignage (lecture complète au clic sur une carte condensée) -->
      <div class="modal-overlay" id="modal-detail-temoignage">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-quote-left"></i> Témoignage</h3>
            <button class="modal-close" onclick="Modal.hide('modal-detail-temoignage')">&times;</button>
          </div>
          <div class="modal-body" id="modal-detail-temoignage-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="btn-detail-temoignage-edit" style="display: none;" onclick="PagesTemoignages.editFromDetailModalTemoignage()">Modifier</button>
            <button type="button" class="btn btn-outline" id="btn-detail-temoignage-delete" style="display: none;" onclick="PagesTemoignages.deleteFromDetailModalTemoignage()">Supprimer</button>
            <button type="button" class="btn btn-secondary" onclick="Modal.hide('modal-detail-temoignage')">Fermer</button>
          </div>
        </div>
      </div>

      <style>
        .temoignage-actions { display: flex; gap: var(--spacing-sm); }
        .temoignages-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .temoignages-intro {
          font-size: 1.1rem;
          color: var(--text-secondary);
          margin: 0;
        }
        .temoignages-intro i {
          color: var(--secondary);
          margin-right: var(--spacing-sm);
        }
        .temoignages-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }
        .temoignage-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
        }
        .temoignage-card::before {
          content: '"';
          position: absolute;
          top: -20px;
          left: 20px;
          font-size: 120px;
          font-family: Georgia, serif;
          color: var(--secondary);
          opacity: 0.1;
          line-height: 1;
        }
        .temoignage-contenu {
          font-size: 1.05rem;
          line-height: 1.8;
          margin-bottom: var(--spacing-lg);
          position: relative;
          z-index: 1;
        }
        .temoignage-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border-color);
        }
        .temoignage-author {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        .temoignage-author-avatar {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          background: var(--secondary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        .temoignage-author-name {
          font-weight: 600;
          color: var(--text-primary);
        }
        .temoignage-date {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .temoignage-media {
          margin: var(--spacing-md) 0;
        }
        .temoignage-media audio, .temoignage-media video {
          width: 100%;
          max-width: 400px;
        }
        .temoignage-card-condensed {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .temoignage-card-condensed:hover {
          background: var(--surface-hover, #f0f4f8);
        }
        .temoignage-titre-condensed { font-weight: 600; margin-bottom: 0.25rem; }
        .temoignage-preview {
          color: var(--text-muted, #666);
          font-size: 0.9rem;
          white-space: pre-wrap;
          max-height: 2.6em;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
    `;
  },

  renderListTemoignages() {
    const items = Temoignages.items || [];
    const displayed = this.showAllTemoignages ? items : items.slice(0, DEFAULT_PAGE_SIZE_TEMOIGNAGES);
    return displayed.map(t => this.renderTemoignageCardCondensed(t)).join('');
  },

  renderTemoignageCardCondensed(t) {
    const contenu = t.contenu || '';
    const titre = (typeof Utils.getTitleFromContent === 'function' ? Utils.getTitleFromContent(contenu) : contenu.trim().split('\n')[0] || '').trim() || (Temoignages.getCategoriesSujet().find(c => c.value === (t.sujet_categorie || 'autre'))?.label || 'Témoignage');
    const preview = typeof Utils.getPreviewLines === 'function' ? Utils.getPreviewLines(contenu, 2) : contenu.trim().split('\n').slice(0, 2).join(' ').slice(0, 120);
    const date = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
    const author = t.auteur_nom_complet ? Utils.escapeHtml(t.auteur_nom_complet) : 'Anonyme';
    return `
      <div class="temoignage-card temoignage-card-condensed" onclick="PagesTemoignages.showDetailModalTemoignage('${t.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();PagesTemoignages.showDetailModalTemoignage('${t.id}');}">
        <div class="temoignage-titre-condensed">${Utils.escapeHtml(titre)}</div>
        ${preview ? `<div class="temoignage-preview">${Utils.escapeHtml(preview).replace(/\n/g, ' ')}</div>` : ''}
        <div class="temoignage-footer" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <span><i class="fas fa-user"></i> ${author}</span>
            <span><i class="fas fa-clock"></i> ${Utils.formatRelativeDate(date)}</span>
          </div>
          ${(t.auteur_id === AppState.user?.id || Permissions.isAdmin()) ? `
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); event.preventDefault(); PagesTemoignages.deleteTemoignageFromCard('${t.id}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  toggleVoirToutTemoignages() {
    this.showAllTemoignages = !this.showAllTemoignages;
    const listEl = document.getElementById('temoignages-list');
    if (listEl) listEl.innerHTML = this.renderListTemoignages();
    const btn = document.getElementById('btn-voir-tout-temoignages');
    if (btn) btn.textContent = this.showAllTemoignages ? 'Réduire' : `Voir tout (${(Temoignages.items || []).length} au total)`;
  },

  showDetailModalTemoignage(temoignageId) {
    const t = Temoignages.items.find(x => x.id === temoignageId);
    if (!t) return;
    const date = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
    const catLabel = Temoignages.getCategoriesSujet().find(c => c.value === (t.sujet_categorie || 'autre'))?.label || 'Autre';
    const canEdit = t.auteur_id === AppState.user.id;
    const canDelete = t.auteur_id === AppState.user.id || Permissions.isAdmin();
    const mediaHtml = t.media_url ? (t.media_type === 'audio'
      ? `<div class="temoignage-media"><audio controls src="${Utils.escapeHtml(t.media_url)}" preload="metadata"></audio></div>`
      : `<div class="temoignage-media"><video controls src="${Utils.escapeHtml(t.media_url)}" preload="metadata" style="max-width:100%; max-height:240px;"></video></div>`
    ) : '';
    const modalBody = document.getElementById('modal-detail-temoignage-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="temoignage-categorie-badge mb-2"><span class="badge badge-secondary">${Utils.escapeHtml(catLabel)}</span></div>
        <div class="temoignage-contenu">${Utils.escapeHtml(t.contenu || '').replace(/\n/g, '<br>')}</div>
        ${mediaHtml}
        <div class="temoignage-footer mt-3">
          <span><i class="fas fa-user"></i> ${t.auteur_nom_complet ? Utils.escapeHtml(t.auteur_nom_complet) : 'Anonyme'}</span>
          <span><i class="fas fa-clock"></i> ${Utils.formatDate(date, 'full')}</span>
        </div>
      `;
    }
    const editBtn = document.getElementById('btn-detail-temoignage-edit');
    const deleteBtn = document.getElementById('btn-detail-temoignage-delete');
    if (editBtn) editBtn.style.display = canEdit ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = canDelete ? 'inline-flex' : 'none';
    const modal = document.getElementById('modal-detail-temoignage');
    if (modal) modal.dataset.temoignageId = temoignageId;
    Modal.show('modal-detail-temoignage');
  },

  editFromDetailModalTemoignage() {
    const modal = document.getElementById('modal-detail-temoignage');
    const id = modal && modal.dataset.temoignageId;
    Modal.hide('modal-detail-temoignage');
    if (id) PagesTemoignages.showEditModal(id);
  },

  async deleteFromDetailModalTemoignage() {
    const modal = document.getElementById('modal-detail-temoignage');
    const id = modal && modal.dataset.temoignageId;
    if (!id) return;
    Modal.hide('modal-detail-temoignage');
    await PagesTemoignages.deleteTemoignage(id);
    PagesTemoignages.refreshTemoignagesList();
  },

  deleteTemoignageFromCard(id) {
    this.deleteTemoignage(id);
  },

  refreshTemoignagesList() {
    const items = Temoignages.items || [];
    const listEl = document.getElementById('temoignages-list');
    if (listEl) listEl.innerHTML = items.length > 0 ? this.renderListTemoignages() : `<div class="empty-state"><i class="fas fa-comment-dots"></i><h3>Aucun témoignage</h3><p>Soyez le premier à partager ce que Dieu fait dans votre vie !</p></div>`;
    const wrap = document.getElementById('temoignages-voir-tout-wrap');
    if (wrap) {
      wrap.style.display = items.length > 0 ? 'block' : 'none';
      const hasMore = items.length > DEFAULT_PAGE_SIZE_TEMOIGNAGES;
      const displayedCount = this.showAllTemoignages ? items.length : Math.min(DEFAULT_PAGE_SIZE_TEMOIGNAGES, items.length);
      const caption = hasMore ? (this.showAllTemoignages ? `${items.length} témoignages affichés` : `${displayedCount} témoignage(s) affiché(s) sur ${items.length}`) : `${items.length} témoignage(s) affiché(s) — 10 derniers par défaut quand il y en a plus`;
      wrap.innerHTML = (hasMore ? `<button type="button" class="btn btn-outline" id="btn-voir-tout-temoignages" onclick="PagesTemoignages.toggleVoirToutTemoignages()">${this.showAllTemoignages ? 'Réduire' : `Voir tout (${items.length} au total)`}</button>` : '') + `<p class="mt-2 mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${caption}</p>`;
    }
  },

  renderTemoignageCard(temoignage) {
    const date = temoignage.created_at?.toDate ? temoignage.created_at.toDate() : new Date(temoignage.created_at);
    const initials = temoignage.auteur_nom_complet ? Utils.getInitials(
      temoignage.auteur_nom_complet.split(' ')[0],
      temoignage.auteur_nom_complet.split(' ')[1] || ''
    ) : '?';
    const catValue = temoignage.sujet_categorie || 'autre';
    const catLabel = Temoignages.getCategoriesSujet().find(c => c.value === catValue)?.label || 'Autre';
    const canEdit = temoignage.auteur_id === AppState.user.id;
    const canDelete = temoignage.auteur_id === AppState.user.id || Permissions.isAdmin();

    const mediaHtml = temoignage.media_url ? (temoignage.media_type === 'audio'
      ? `<div class="temoignage-media"><audio controls src="${Utils.escapeHtml(temoignage.media_url)}" preload="metadata"></audio></div>`
      : `<div class="temoignage-media"><video controls src="${Utils.escapeHtml(temoignage.media_url)}" preload="metadata" style="max-width:100%; max-height:240px;"></video></div>`
    ) : '';

    return `
      <div class="temoignage-card">
        <div class="temoignage-categorie-badge"><span class="badge badge-secondary">${Utils.escapeHtml(catLabel)}</span></div>
        <div class="temoignage-contenu">${Utils.escapeHtml(temoignage.contenu).replace(/\n/g, '<br>')}</div>
        ${mediaHtml}
        <div class="temoignage-footer">
          <div class="temoignage-author">
            <div class="temoignage-author-avatar">${initials}</div>
            <div>
              <div class="temoignage-author-name">${Utils.escapeHtml(temoignage.auteur_nom_complet)}</div>
              <div class="temoignage-date">${Utils.formatDate(date, 'full')}</div>
            </div>
          </div>
          <div class="temoignage-actions">
            ${canEdit ? `
              <button class="btn btn-sm btn-secondary" onclick="PagesTemoignages.showEditModal('${temoignage.id}')" title="Modifier">
                <i class="fas fa-edit"></i>
              </button>
            ` : ''}
            ${canDelete ? `
              <button class="btn btn-sm btn-secondary" onclick="PagesTemoignages.deleteTemoignage('${temoignage.id}')" title="Supprimer">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  showAddModal() {
    document.getElementById('temoignage-contenu').value = '';
    const catSelect = document.getElementById('temoignage-categorie');
    if (catSelect) catSelect.value = 'autre';
    const fileInput = document.getElementById('temoignage-media');
    if (fileInput) fileInput.value = '';
    Modal.show('modal-add-temoignage');
  },

  showEditModal(temoignageId) {
    const t = Temoignages.items.find(x => x.id === temoignageId);
    if (!t) return;
    document.getElementById('temoignage-edit-id').value = temoignageId;
    document.getElementById('temoignage-contenu-edit').value = t.contenu || '';
    const catEdit = document.getElementById('temoignage-categorie-edit');
    if (catEdit) catEdit.value = t.sujet_categorie || 'autre';
    const fileEdit = document.getElementById('temoignage-media-edit');
    if (fileEdit) fileEdit.value = '';
    Modal.show('modal-edit-temoignage');
  },

  async submitEditTemoignage(event) {
    event.preventDefault();
    const id = document.getElementById('temoignage-edit-id').value;
    const contenu = document.getElementById('temoignage-contenu-edit').value.trim();
    const sujet_categorie = document.getElementById('temoignage-categorie-edit')?.value || 'autre';
    if (!contenu) { Toast.error('Veuillez entrer un témoignage'); return; }
    const payload = { contenu, sujet_categorie };
    const fileInput = document.getElementById('temoignage-media-edit');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const maxSize = 15 * 1024 * 1024;
      if (file.size > maxSize) {
        Toast.error('Fichier trop volumineux (max 15 Mo)');
        return;
      }
      try {
        App.showLoading();
        const { url, mediaType } = await Temoignages.uploadMedia(id, file);
        payload.media_url = url;
        payload.media_type = mediaType;
      } catch (err) {
        console.error('Erreur upload média:', err);
        const msg = err && err.message ? err.message : '';
        const isPermission = /permission|insufficient|refusé/i.test(msg);
        Toast.error(isPermission
          ? 'Droits insuffisants pour l\'upload. Déployez les règles Storage (chemin temoignages/).'
          : (msg || 'Erreur lors de l\'envoi du média.')
        );
        App.hideLoading();
        return;
      } finally {
        App.hideLoading();
      }
    }
    const success = await Temoignages.update(id, payload);
    if (success) {
      Modal.hide('modal-edit-temoignage');
      PagesTemoignages.refreshTemoignagesList();
    }
  },

  async submitTemoignage(event) {
    event.preventDefault();
    
    const contenu = document.getElementById('temoignage-contenu').value.trim();
    const sujet_categorie = document.getElementById('temoignage-categorie')?.value || 'autre';

    if (!contenu) {
      Toast.error('Veuillez entrer votre témoignage');
      return;
    }

    try {
      const newT = await Temoignages.create({ contenu, sujet_categorie });
      const fileInput = document.getElementById('temoignage-media');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const maxSize = 15 * 1024 * 1024;
        if (file.size > maxSize) {
          Toast.error('Fichier trop volumineux (max 15 Mo)');
        } else {
          try {
            App.showLoading();
            const { url, mediaType } = await Temoignages.uploadMedia(newT.id, file);
            await db.collection('temoignages').doc(newT.id).update({ media_url: url, media_type: mediaType });
            await Temoignages.loadAll();
          } catch (err) {
            console.error('Erreur upload média témoignage:', err);
            const msg = err && err.message ? err.message : '';
            const isPermission = /permission|insufficient|refusé/i.test(msg);
            Toast.error(isPermission
              ? 'Témoignage enregistré. Upload média refusé : déployez les règles Storage (temoignages/).'
              : 'Témoignage enregistré mais l\'envoi du média a échoué.'
            );
          } finally {
            App.hideLoading();
          }
        }
      }
      await Temoignages.loadAll();
      Modal.hide('modal-add-temoignage');
      PagesTemoignages.refreshTemoignagesList();
    } catch (error) {}
  },

  async deleteTemoignage(id) {
    Modal.confirm(
      'Supprimer le témoignage',
      'Êtes-vous sûr de vouloir supprimer ce témoignage ?',
      async () => {
        if (await Temoignages.delete(id)) {
          PagesTemoignages.refreshTemoignagesList();
        }
      }
    );
  }
};
