// ============================================
// MODULE NOTIFICATIONS
// Phase 4 - Notifications colorées avec priorités
// ============================================

const Notifications = {
  items: [],

  // Charger toutes les notifications
  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      const snapshot = await db.collection('notifications')
        .where('famille_id', '==', familleId)
        .orderBy('created_at', 'desc')
        .limit(100)
        .get();

      this.items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return this.items;
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      return [];
    }
  },

  // Créer une notification
  async create(data) {
    try {
      const notification = {
        contenu: data.contenu,
        priorite: data.priorite || 'normal',
        famille_id: AppState.famille.id,
        auteur_id: AppState.user.id,
        auteur_prenom: AppState.user.prenom,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('notifications').add(notification);
      const newNotif = { id: docRef.id, ...notification, created_at: new Date() };
      this.items.unshift(newNotif);

      Toast.success('Notification publiée');
      return newNotif;
    } catch (error) {
      console.error('Erreur création notification:', error);
      Toast.error('Erreur lors de la publication');
      throw error;
    }
  },

  // Supprimer une notification
  async delete(id) {
    try {
      const notif = this.items.find(n => n.id === id);
      if (!notif) throw new Error('Notification non trouvée');

      // Vérifier les droits (auteur ou admin)
      if (notif.auteur_id !== AppState.user.id && !Permissions.isAdmin()) {
        throw new Error('Permission refusée');
      }

      await db.collection('notifications').doc(id).delete();
      this.items = this.items.filter(n => n.id !== id);

      Toast.success('Notification supprimée');
      return true;
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      Toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  },

  // Obtenir les priorités
  getPriorites() {
    return [
      { value: 'normal', label: 'Information', color: '#4CAF50', bgColor: '#E8F5E9', icon: 'fa-info-circle' },
      { value: 'important', label: 'À noter', color: '#FFC107', bgColor: '#FFF8E1', icon: 'fa-exclamation-circle' },
      { value: 'urgent', label: 'Important', color: '#FF9800', bgColor: '#FFF3E0', icon: 'fa-exclamation-triangle' },
      { value: 'critique', label: 'Urgent', color: '#F44336', bgColor: '#FFEBEE', icon: 'fa-bell' }
    ];
  },

  getPriorite(value) {
    return this.getPriorites().find(p => p.value === value) || this.getPriorites()[0];
  },

  // Obtenir les notifications récentes
  getRecent(limit = 5) {
    return this.items.slice(0, limit);
  }
};

// ============================================
// PAGES NOTIFICATIONS
// ============================================

const PagesNotifications = {
  currentFilter: 'all',

  async render() {
    await Notifications.loadAll();
    const notifications = this.filterNotifications();

    return `
      <div class="notif-header">
        <div class="notif-filters">
          <button class="btn ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" 
                  onclick="PagesNotifications.setFilter('all')">Toutes</button>
          ${Notifications.getPriorites().map(p => `
            <button class="btn ${this.currentFilter === p.value ? 'btn-primary' : 'btn-secondary'}"
                    onclick="PagesNotifications.setFilter('${p.value}')"
                    style="${this.currentFilter === p.value ? '' : `color: ${p.color}; border-color: ${p.color}`}">
              <i class="fas ${p.icon}"></i> ${p.label}
            </button>
          `).join('')}
        </div>
        <button class="btn btn-primary" onclick="PagesNotifications.showAddModal()">
          <i class="fas fa-plus"></i> Nouvelle notification
        </button>
      </div>

      <div class="notif-list" id="notif-list">
        ${notifications.length > 0 ? notifications.map(n => this.renderNotificationCard(n)).join('') : `
          <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <h3>Aucune notification</h3>
            <p>Il n'y a pas encore de notification dans cette famille.</p>
          </div>
        `}
      </div>

      <!-- Modal ajout notification -->
      <div class="modal-overlay" id="modal-add-notif">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-bell"></i> Nouvelle notification</h3>
            <button class="modal-close" onclick="Modal.hide('modal-add-notif')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-add-notif" onsubmit="PagesNotifications.submitNotification(event)">
              <div class="form-group">
                <label class="form-label required">Message</label>
                <textarea class="form-control" id="notif-contenu" rows="4" 
                          placeholder="Écrivez votre message..." required></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Priorité</label>
                <div class="priorite-selector">
                  ${Notifications.getPriorites().map((p, i) => `
                    <label class="priorite-option" style="--color: ${p.color}; --bg: ${p.bgColor}">
                      <input type="radio" name="notif-priorite" value="${p.value}" ${i === 0 ? 'checked' : ''}>
                      <span class="priorite-badge">
                        <i class="fas ${p.icon}"></i> ${p.label}
                      </span>
                    </label>
                  `).join('')}
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.hide('modal-add-notif')">Annuler</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-add-notif').requestSubmit()">
              <i class="fas fa-paper-plane"></i> Publier
            </button>
          </div>
        </div>
      </div>

      <style>
        .notif-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .notif-filters {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .notif-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        .notif-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          border-left: 4px solid var(--notif-color);
          box-shadow: var(--shadow-sm);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .notif-card:hover {
          transform: translateX(5px);
          box-shadow: var(--shadow-md);
        }
        .notif-header-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-sm);
        }
        .notif-priorite {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          font-weight: 600;
        }
        .notif-contenu {
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: var(--spacing-md);
        }
        .notif-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .notif-author {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }
        .priorite-selector {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }
        .priorite-option {
          cursor: pointer;
        }
        .priorite-option input {
          display: none;
        }
        .priorite-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: 8px 16px;
          border-radius: var(--radius-full);
          background: var(--bg);
          color: var(--color);
          border: 2px solid transparent;
          transition: all 0.2s;
        }
        .priorite-option input:checked + .priorite-badge {
          border-color: var(--color);
          box-shadow: 0 0 0 3px var(--bg);
        }
        .priorite-option:hover .priorite-badge {
          transform: scale(1.05);
        }
      </style>
    `;
  },

  renderNotificationCard(notif) {
    const priorite = Notifications.getPriorite(notif.priorite);
    const date = notif.created_at?.toDate ? notif.created_at.toDate() : new Date(notif.created_at);
    const canDelete = notif.auteur_id === AppState.user.id || Permissions.isAdmin();

    return `
      <div class="notif-card" style="--notif-color: ${priorite.color}">
        <div class="notif-header-card">
          <div class="notif-priorite" style="background: ${priorite.bgColor}; color: ${priorite.color}">
            <i class="fas ${priorite.icon}"></i> ${priorite.label}
          </div>
          ${canDelete ? `
            <button class="btn btn-icon btn-secondary" onclick="PagesNotifications.deleteNotification('${notif.id}')" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
        <div class="notif-contenu">${Utils.escapeHtml(notif.contenu).replace(/\n/g, '<br>')}</div>
        <div class="notif-footer">
          <div class="notif-author">
            <i class="fas fa-user"></i> ${Utils.escapeHtml(notif.auteur_prenom || 'Anonyme')}
          </div>
          <div class="notif-date">
            <i class="fas fa-clock"></i> ${Utils.formatRelativeDate(date)}
          </div>
        </div>
      </div>
    `;
  },

  filterNotifications() {
    if (this.currentFilter === 'all') {
      return Notifications.items;
    }
    return Notifications.items.filter(n => n.priorite === this.currentFilter);
  },

  setFilter(filter) {
    this.currentFilter = filter;
    document.getElementById('notif-list').innerHTML = 
      this.filterNotifications().length > 0 
        ? this.filterNotifications().map(n => this.renderNotificationCard(n)).join('')
        : `<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Aucune notification</h3></div>`;
    
    // Mettre à jour les boutons actifs
    document.querySelectorAll('.notif-filters .btn').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    });
    event.target.classList.remove('btn-secondary');
    event.target.classList.add('btn-primary');
  },

  showAddModal() {
    document.getElementById('notif-contenu').value = '';
    document.querySelector('input[name="notif-priorite"][value="normal"]').checked = true;
    Modal.show('modal-add-notif');
  },

  async submitNotification(event) {
    event.preventDefault();
    
    const contenu = document.getElementById('notif-contenu').value.trim();
    const priorite = document.querySelector('input[name="notif-priorite"]:checked').value;

    if (!contenu) {
      Toast.error('Veuillez entrer un message');
      return;
    }

    try {
      await Notifications.create({ contenu, priorite });
      Modal.hide('modal-add-notif');
      
      // Rafraîchir la liste
      document.getElementById('notif-list').innerHTML = 
        Notifications.items.map(n => this.renderNotificationCard(n)).join('');
    } catch (error) {
      // Erreur déjà gérée
    }
  },

  async deleteNotification(id) {
    Modal.confirm(
      'Supprimer la notification',
      'Êtes-vous sûr de vouloir supprimer cette notification ?',
      async () => {
        const success = await Notifications.delete(id);
        if (success) {
          document.getElementById('notif-list').innerHTML = 
            this.filterNotifications().length > 0
              ? this.filterNotifications().map(n => this.renderNotificationCard(n)).join('')
              : `<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Aucune notification</h3></div>`;
        }
      }
    );
  }
};
