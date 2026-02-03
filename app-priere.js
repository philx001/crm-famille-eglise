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
      if (sujet.auteur_id !== AppState.user.id && !Permissions.isAdmin()) {
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

      if (sujet.auteur_id !== AppState.user.id && !Permissions.isAdmin()) {
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
// PAGES SUJETS DE PRIÈRE
// ============================================

const PagesPriere = {
  currentTab: 'attente',

  async render() {
    await SujetsPriere.loadAll();
    const enAttente = SujetsPriere.getEnAttente();
    const exauces = SujetsPriere.getExauces();
    const stats = SujetsPriere.getStats();
    const evolution = SujetsPriere.getEvolutionMensuelle(6);

    return `
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

      <!-- Modal ajout -->
      <div class="modal-overlay" id="modal-add-priere">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-praying-hands"></i> Nouveau sujet de prière</h3>
            <button class="modal-close" onclick="Modal.hide('modal-add-priere')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-add-priere" onsubmit="PagesPriere.submitSujet(event)">
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

    return items.map(s => this.renderSujetCard(s)).join('');
  },

  renderSujetCard(sujet) {
    const date = sujet.created_at?.toDate ? sujet.created_at.toDate() : new Date(sujet.created_at);
    const canDelete = sujet.auteur_id === AppState.user.id || Permissions.isAdmin();
    const canEdit = sujet.auteur_id === AppState.user.id || Permissions.isAdmin();
    const canMarkExauce = sujet.auteur_id === AppState.user.id || Permissions.isAdmin();
    const catValue = sujet.sujet_categorie || 'autre';
    const catLabel = SujetsPriere.getCategoriesSujet().find(c => c.value === catValue)?.label || 'Autre';

    return `
      <div class="priere-card ${sujet.est_exauce ? 'exauce' : ''}">
        <div class="priere-categorie-badge"><span class="badge badge-secondary">${Utils.escapeHtml(catLabel)}</span></div>
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
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.tab-btn').classList.add('active');
    document.getElementById('priere-list').innerHTML = this.renderList();
  },

  showAddModal() {
    document.getElementById('priere-contenu').value = '';
    document.getElementById('priere-categorie').value = 'autre';
    document.getElementById('priere-anonyme').checked = false;
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

    if (!contenu) {
      Toast.error('Veuillez entrer un sujet de prière');
      return;
    }

    try {
      await SujetsPriere.create({ contenu, sujet_categorie, anonyme });
      Modal.hide('modal-add-priere');
      this.currentTab = 'attente';
      document.getElementById('priere-list').innerHTML = this.renderList();
      
      document.querySelector('.tab-btn:first-child .tab-count').textContent = SujetsPriere.getEnAttente().length;
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

const PagesTemoignages = {
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
        ${Temoignages.items.length > 0 ? Temoignages.items.map(t => this.renderTemoignageCard(t)).join('') : `
          <div class="empty-state">
            <i class="fas fa-comment-dots"></i>
            <h3>Aucun témoignage</h3>
            <p>Soyez le premier à partager ce que Dieu fait dans votre vie !</p>
          </div>
        `}
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
      </style>
    `;
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
      document.getElementById('temoignages-list').innerHTML =
        Temoignages.items.length > 0
          ? Temoignages.items.map(t => this.renderTemoignageCard(t)).join('')
          : `<div class="empty-state"><i class="fas fa-comment-dots"></i><h3>Aucun témoignage</h3><p>Soyez le premier à partager ce que Dieu fait dans votre vie !</p></div>`;
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
      Modal.hide('modal-add-temoignage');
      document.getElementById('temoignages-list').innerHTML = 
        Temoignages.items.map(t => this.renderTemoignageCard(t)).join('');
    } catch (error) {}
  },

  async deleteTemoignage(id) {
    Modal.confirm(
      'Supprimer le témoignage',
      'Êtes-vous sûr de vouloir supprimer ce témoignage ?',
      async () => {
        if (await Temoignages.delete(id)) {
          document.getElementById('temoignages-list').innerHTML = 
            Temoignages.items.length > 0 
              ? Temoignages.items.map(t => this.renderTemoignageCard(t)).join('')
              : `<div class="empty-state"><i class="fas fa-comment-dots"></i><h3>Aucun témoignage</h3></div>`;
        }
      }
    );
  }
};
