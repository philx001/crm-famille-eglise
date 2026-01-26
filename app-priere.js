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

  async create(data) {
    try {
      const sujet = {
        contenu: data.contenu,
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
  }
};

// ============================================
// MODULE TÉMOIGNAGES
// ============================================

const Temoignages = {
  items: [],

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

  async delete(id) {
    try {
      if (!Permissions.isAdmin()) {
        throw new Error('Seul un administrateur peut supprimer un témoignage');
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

    return `
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
      </style>
    `;
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
    const canMarkExauce = sujet.auteur_id === AppState.user.id || Permissions.isAdmin();

    return `
      <div class="priere-card ${sujet.est_exauce ? 'exauce' : ''}">
        <div class="priere-contenu">${Utils.escapeHtml(sujet.contenu).replace(/\n/g, '<br>')}</div>
        <div class="priere-footer">
          <div class="priere-meta">
            <span><i class="fas fa-user"></i> ${sujet.auteur_prenom ? Utils.escapeHtml(sujet.auteur_prenom) : 'Anonyme'}</span>
            <span><i class="fas fa-clock"></i> ${Utils.formatRelativeDate(date)}</span>
            ${sujet.est_exauce ? `
              <span class="exauce-badge"><i class="fas fa-check"></i> Exaucé</span>
            ` : ''}
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
    document.getElementById('priere-anonyme').checked = false;
    Modal.show('modal-add-priere');
  },

  async submitSujet(event) {
    event.preventDefault();
    
    const contenu = document.getElementById('priere-contenu').value.trim();
    const anonyme = document.getElementById('priere-anonyme').checked;

    if (!contenu) {
      Toast.error('Veuillez entrer un sujet de prière');
      return;
    }

    try {
      await SujetsPriere.create({ contenu, anonyme });
      Modal.hide('modal-add-priere');
      this.currentTab = 'attente';
      document.getElementById('priere-list').innerHTML = this.renderList();
      
      // Mettre à jour les compteurs
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
    await Temoignages.loadAll();

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
                <label class="form-label required">Votre témoignage</label>
                <textarea class="form-control" id="temoignage-contenu" rows="6" 
                          placeholder="Racontez ce que Dieu a fait dans votre vie..." required></textarea>
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

      <style>
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
      </style>
    `;
  },

  renderTemoignageCard(temoignage) {
    const date = temoignage.created_at?.toDate ? temoignage.created_at.toDate() : new Date(temoignage.created_at);
    const initials = temoignage.auteur_nom_complet ? Utils.getInitials(
      temoignage.auteur_nom_complet.split(' ')[0],
      temoignage.auteur_nom_complet.split(' ')[1] || ''
    ) : '?';

    return `
      <div class="temoignage-card">
        <div class="temoignage-contenu">${Utils.escapeHtml(temoignage.contenu).replace(/\n/g, '<br>')}</div>
        <div class="temoignage-footer">
          <div class="temoignage-author">
            <div class="temoignage-author-avatar">${initials}</div>
            <div>
              <div class="temoignage-author-name">${Utils.escapeHtml(temoignage.auteur_nom_complet)}</div>
              <div class="temoignage-date">${Utils.formatDate(date, 'full')}</div>
            </div>
          </div>
          ${Permissions.isAdmin() ? `
            <button class="btn btn-sm btn-secondary" onclick="PagesTemoignages.deleteTemoignage('${temoignage.id}')" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  showAddModal() {
    document.getElementById('temoignage-contenu').value = '';
    Modal.show('modal-add-temoignage');
  },

  async submitTemoignage(event) {
    event.preventDefault();
    
    const contenu = document.getElementById('temoignage-contenu').value.trim();

    if (!contenu) {
      Toast.error('Veuillez entrer votre témoignage');
      return;
    }

    try {
      await Temoignages.create({ contenu });
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
