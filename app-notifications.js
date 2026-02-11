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
      // Si l'index manque, essayer sans orderBy
      if (error.code === 'failed-precondition') {
        try {
          const snapshot = await db.collection('notifications')
            .where('famille_id', '==', familleId)
            .limit(100)
            .get();

          this.items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a, b) => {
            const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
            const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
            return dateB - dateA; // Plus récent en premier
          });

          return this.items;
        } catch (fallbackError) {
          console.error('Erreur chargement notifications (fallback):', fallbackError);
          return [];
        }
      }
      return [];
    }
  },

  // Créer une notification
  async create(data) {
    try {
      const notification = {
        titre: (data.titre || '').trim() || null,
        contenu: data.contenu,
        priorite: data.priorite || 'normal',
        famille_id: AppState.famille.id,
        auteur_id: AppState.user.id,
        auteur_prenom: AppState.user.prenom,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('notifications').add(notification);
      // Recharger immédiatement pour avoir les vraies données avec le timestamp serveur
      await this.loadAll();
      
      Toast.success('Notification publiée');
      return this.items.find(n => n.id === docRef.id) || { id: docRef.id, ...notification };
    } catch (error) {
      console.error('Erreur création notification:', error);
      Toast.error('Erreur lors de la publication');
      throw error;
    }
  },

  // Modifier une notification
  async update(id, data) {
    try {
      const notif = this.items.find(n => n.id === id);
      if (!notif) throw new Error('Notification non trouvée');

      const canEdit = notif.auteur_id === AppState.user.id ||
        Permissions.hasRole('adjoint_superviseur') ||
        Permissions.isAdmin();
      if (!canEdit) throw new Error('Permission refusée');

      const updates = {
        titre: (data.titre || '').trim() || null,
        contenu: data.contenu,
        priorite: data.priorite || notif.priorite,
        updated_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_by: AppState.user.id,
        updated_by_prenom: AppState.user.prenom
      };

      await db.collection('notifications').doc(id).update(updates);
      await this.loadAll();

      Toast.success('Notification modifiée');
      return true;
    } catch (error) {
      console.error('Erreur modification notification:', error);
      Toast.error(error.message || 'Erreur lors de la modification');
      return false;
    }
  },

  // Supprimer une notification
  async delete(id) {
    try {
      const notif = this.items.find(n => n.id === id);
      if (!notif) throw new Error('Notification non trouvée');

      const canDelete = notif.auteur_id === AppState.user.id ||
        Permissions.hasRole('adjoint_superviseur') ||
        Permissions.isAdmin();
      if (!canDelete) throw new Error('Permission refusée');

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

const DEFAULT_PAGE_SIZE = 10;

const PagesNotifications = {
  currentFilter: 'all',
  showAll: false,

  async render() {
    await Notifications.loadAll();
    const dateBounds = typeof Utils !== 'undefined' ? Utils.getDateFilterBounds() : { min: '2000-01-01', max: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] };
    const notifications = this.filterNotifications();
    const displayed = this.showAll ? notifications : notifications.slice(0, DEFAULT_PAGE_SIZE);
    const hasMore = notifications.length > DEFAULT_PAGE_SIZE;
    const restCount = notifications.length - DEFAULT_PAGE_SIZE;

    return `
      <div class="notif-header">
        <div class="notif-filters" style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-md);">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs);">
            <span class="text-muted" style="font-size: 0.9rem; margin-right: 4px;">Type :</span>
            <button class="btn btn-sm ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" 
                    onclick="PagesNotifications.setFilter('all')">Toutes</button>
            ${Notifications.getPriorites().map(p => `
              <button class="btn btn-sm ${this.currentFilter === p.value ? 'btn-primary' : 'btn-secondary'}"
                      onclick="PagesNotifications.setFilter('${p.value}')"
                      style="${this.currentFilter === p.value ? '' : `color: ${p.color}; border-color: ${p.color}`}">
                <i class="fas ${p.icon}"></i> ${p.label}
              </button>
            `).join('')}
          </div>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs);">
            <span class="text-muted" style="font-size: 0.9rem;">Date :</span>
            <label class="form-label small text-muted mb-0" style="align-self: center;">Du</label>
            <input type="date" class="form-control input-date" id="filter-notif-date-from" min="${dateBounds.min}" max="${dateBounds.max}" title="Cliquez pour ouvrir le calendrier" onchange="PagesNotifications.refreshNotifList()">
            <label class="form-label small text-muted mb-0" style="align-self: center;">Au</label>
            <input type="date" class="form-control input-date" id="filter-notif-date-to" min="${dateBounds.min}" max="${dateBounds.max}" title="Cliquez pour ouvrir le calendrier" onchange="PagesNotifications.refreshNotifList()">
          </div>
        </div>
        <button class="btn btn-primary" onclick="PagesNotifications.showAddModal()">
          <i class="fas fa-plus"></i> Nouvelle notification
        </button>
      </div>

      <div class="notif-list" id="notif-list">
        ${notifications.length > 0 ? displayed.map(n => this.renderNotificationCardCondensed(n)).join('') : `
          <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <h3>Aucune notification</h3>
            <p>Il n'y a pas encore de notification dans cette famille.</p>
          </div>
        `}
      </div>
      ${notifications.length > 0 ? `
        <div class="notif-voir-tout-wrap" style="margin-top: var(--spacing-md); text-align: center;">
          ${hasMore && !this.showAll ? `
          <button type="button" class="btn btn-outline" onclick="PagesNotifications.toggleVoirTout()">
            <i class="fas fa-chevron-down"></i> Voir tout (${notifications.length} au total)
          </button>
          <p class="mt-2 mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${displayed.length} notifications affichées sur ${notifications.length}</p>
          ` : hasMore && this.showAll ? `
          <button type="button" class="btn btn-outline" onclick="PagesNotifications.toggleVoirTout()">
            <i class="fas fa-chevron-up"></i> Réduire
          </button>
          <p class="mt-2 mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${notifications.length} notifications affichées</p>
          ` : `
          <p class="mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${notifications.length} notification(s) affichée(s) — 10 derniers par défaut quand il y en a plus</p>
          `}
        </div>
      ` : ''}

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
                <label class="form-label">Titre</label>
                <input type="text" class="form-control" id="notif-titre" placeholder="Titre court (optionnel)" maxlength="120">
              </div>
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

      <!-- Modal modification notification -->
      <div class="modal-overlay" id="modal-edit-notif">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-edit"></i> Modifier la notification</h3>
            <button class="modal-close" onclick="Modal.hide('modal-edit-notif')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-edit-notif" onsubmit="PagesNotifications.submitEditNotification(event)">
              <input type="hidden" id="notif-edit-id" value="">
              <div class="form-group">
                <label class="form-label">Titre</label>
                <input type="text" class="form-control" id="notif-titre-edit" placeholder="Titre court (optionnel)" maxlength="120">
              </div>
              <div class="form-group">
                <label class="form-label required">Message</label>
                <textarea class="form-control" id="notif-contenu-edit" rows="4" 
                          placeholder="Écrivez votre message..." required></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Priorité</label>
                <div class="priorite-selector">
                  ${Notifications.getPriorites().map((p, i) => `
                    <label class="priorite-option" style="--color: ${p.color}; --bg: ${p.bgColor}">
                      <input type="radio" name="notif-priorite-edit" value="${p.value}" ${i === 0 ? 'checked' : ''}>
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
            <button class="btn btn-secondary" onclick="Modal.hide('modal-edit-notif')">Annuler</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-edit-notif').requestSubmit()">
              <i class="fas fa-save"></i> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <!-- Modal détail (lecture seule, ouvert au clic sur une carte condensée) -->
      <div class="modal-overlay" id="modal-detail-notif">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-detail-notif-title"><i class="fas fa-bell"></i> Détail</h3>
            <button class="modal-close" onclick="Modal.hide('modal-detail-notif')">&times;</button>
          </div>
          <div class="modal-body" id="modal-detail-notif-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="btn-detail-notif-edit" style="display: none;" onclick="PagesNotifications.editFromDetailModal()">
              <i class="fas fa-edit"></i> Modifier
            </button>
            <button type="button" class="btn btn-outline btn-danger" id="btn-detail-notif-delete" style="display: none;" onclick="PagesNotifications.deleteFromDetailModal()">
              <i class="fas fa-trash"></i> Supprimer
            </button>
            <button class="btn btn-secondary" onclick="Modal.hide('modal-detail-notif')">Fermer</button>
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
        .notif-actions {
          display: flex;
          gap: var(--spacing-xs);
        }
        .notif-updated {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-left: var(--spacing-xs);
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
        .notif-card-condensed {
          cursor: pointer;
          padding: var(--spacing-md);
        }
        .notif-card-condensed .notif-titre-condensed { font-weight: 600; margin-bottom: 4px; }
        .notif-card-condensed .notif-preview { font-size: 0.9rem; color: var(--text-muted); line-height: 1.4; }
      </style>
    `;
  },

  renderNotificationCardCondensed(notif) {
    const priorite = Notifications.getPriorite(notif.priorite);
    const date = notif.created_at?.toDate ? notif.created_at.toDate() : new Date(notif.created_at);
    const titre = (notif.titre && notif.titre.trim()) ? notif.titre.trim() : Utils.getTitleFromContent(notif.contenu || '');
    const preview = Utils.getPreviewLines(notif.contenu || '', 2);
    return `
      <div class="notif-card notif-card-condensed" style="--notif-color: ${priorite.color}" onclick="PagesNotifications.showDetailModal('${notif.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); PagesNotifications.showDetailModal('${notif.id}'); }">
        <div class="notif-header-card">
          <div class="notif-priorite" style="background: ${priorite.bgColor}; color: ${priorite.color}">
            <i class="fas ${priorite.icon}"></i> ${priorite.label}
          </div>
        </div>
        <div class="notif-titre-condensed">${Utils.escapeHtml(titre)}</div>
        ${preview ? `<div class="notif-preview">${Utils.escapeHtml(preview).replace(/\n/g, ' ')}</div>` : ''}
        <div class="notif-footer" style="margin-top: 8px;">
          <div class="notif-author">
            <i class="fas fa-user"></i> ${Utils.escapeHtml(notif.auteur_prenom || 'Anonyme')}
          </div>
          <div class="notif-date"><i class="fas fa-clock"></i> ${Utils.formatRelativeDate(date)}</div>
        </div>
      </div>
    `;
  },

  showDetailModal(notifId) {
    const notif = Notifications.items.find(n => n.id === notifId);
    if (!notif) return;
    const modalEl = document.getElementById('modal-detail-notif');
    if (modalEl) modalEl.dataset.notifId = notifId;
    const canEdit = notif.auteur_id === AppState.user.id || Permissions.hasRole('adjoint_superviseur') || Permissions.isAdmin();
    const canDelete = canEdit;
    const editBtn = document.getElementById('btn-detail-notif-edit');
    const deleteBtn = document.getElementById('btn-detail-notif-delete');
    if (editBtn) editBtn.style.display = canEdit ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = canDelete ? 'inline-flex' : 'none';
    const priorite = Notifications.getPriorite(notif.priorite);
    const date = notif.created_at?.toDate ? notif.created_at.toDate() : new Date(notif.created_at);
    const titre = (notif.titre && notif.titre.trim()) ? notif.titre.trim() : Utils.getTitleFromContent(notif.contenu || '');
    const titleEl = document.getElementById('modal-detail-notif-title');
    const bodyEl = document.getElementById('modal-detail-notif-body');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-bell"></i> ${Utils.escapeHtml(titre)}`;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="notif-priorite" style="background: ${priorite.bgColor}; color: ${priorite.color}; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--radius-full); font-size: 0.9rem; margin-bottom: var(--spacing-md);">
          <i class="fas ${priorite.icon}"></i> ${priorite.label}
        </div>
        <div class="notif-contenu" style="white-space: pre-wrap;">${Utils.escapeHtml(notif.contenu || '').replace(/\n/g, '<br>')}</div>
        <div class="notif-footer" style="margin-top: var(--spacing-lg); font-size: 0.9rem; color: var(--text-muted);">
          <i class="fas fa-user"></i> ${Utils.escapeHtml(notif.auteur_prenom || 'Anonyme')} &nbsp; <i class="fas fa-clock"></i> ${Utils.formatDate(date, 'full')}
        </div>
      `;
    }
    Modal.show('modal-detail-notif');
  },

  editFromDetailModal() {
    const modalEl = document.getElementById('modal-detail-notif');
    const notifId = modalEl && modalEl.dataset.notifId;
    if (notifId) {
      Modal.hide('modal-detail-notif');
      this.showEditModal(notifId);
    }
  },

  deleteFromDetailModal() {
    const modalEl = document.getElementById('modal-detail-notif');
    const notifId = modalEl && modalEl.dataset.notifId;
    if (notifId) {
      Modal.hide('modal-detail-notif');
      this.deleteNotification(notifId);
    }
  },

  refreshNotifList() {
    const listEl = document.getElementById('notif-list');
    if (!listEl) return;
    const notifications = this.filterNotifications();
    const displayed = this.showAll ? notifications : notifications.slice(0, DEFAULT_PAGE_SIZE);
    const hasMore = notifications.length > DEFAULT_PAGE_SIZE;
    listEl.innerHTML = notifications.length > 0
      ? displayed.map(n => this.renderNotificationCardCondensed(n)).join('')
      : `<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Aucune notification</h3><p>Il n'y a pas encore de notification dans cette famille.</p></div>`;
    let wrap = listEl.parentElement.querySelector('.notif-voir-tout-wrap');
    if (notifications.length > 0) {
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'notif-voir-tout-wrap';
        wrap.style.marginTop = 'var(--spacing-md)';
        wrap.style.textAlign = 'center';
        listEl.parentElement.appendChild(wrap);
      }
      const caption = hasMore
        ? `<p class="mt-2 mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${this.showAll ? notifications.length + ' notifications affichées' : displayed.length + ' notifications affichées sur ' + notifications.length}</p>`
        : `<p class="mb-0" style="font-size: 0.85rem; color: var(--text-muted);">${notifications.length} notification(s) affichée(s) — 10 derniers par défaut quand il y en a plus</p>`;
      wrap.innerHTML = (hasMore ? `
        <button type="button" class="btn btn-outline" onclick="PagesNotifications.toggleVoirTout()">
          <i class="fas fa-chevron-${this.showAll ? 'up' : 'down'}"></i> ${this.showAll ? 'Réduire' : 'Voir tout (' + notifications.length + ' au total)'}
        </button>
        ${caption}
      ` : caption);
    } else if (wrap) wrap.remove();
  },

  toggleVoirTout() {
    this.showAll = !this.showAll;
    this.refreshNotifList();
  },

  renderNotificationCard(notif) {
    const priorite = Notifications.getPriorite(notif.priorite);
    const date = notif.created_at?.toDate ? notif.created_at.toDate() : new Date(notif.created_at);
    const canEdit = notif.auteur_id === AppState.user.id ||
      Permissions.hasRole('adjoint_superviseur') ||
      Permissions.isAdmin();
    const updatedDate = notif.updated_at ? (notif.updated_at.toDate ? notif.updated_at.toDate() : new Date(notif.updated_at)) : null;

    return `
      <div class="notif-card" style="--notif-color: ${priorite.color}">
        <div class="notif-header-card">
          <div class="notif-priorite" style="background: ${priorite.bgColor}; color: ${priorite.color}">
            <i class="fas ${priorite.icon}"></i> ${priorite.label}
          </div>
          ${canEdit ? `
            <div class="notif-actions">
              <button class="btn btn-icon btn-secondary" onclick="PagesNotifications.showEditModal('${notif.id}')" title="Modifier">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-icon btn-secondary" onclick="PagesNotifications.deleteNotification('${notif.id}')" title="Supprimer">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="notif-contenu">${Utils.escapeHtml(notif.contenu).replace(/\n/g, '<br>')}</div>
        <div class="notif-footer">
          <div class="notif-author">
            <i class="fas fa-user"></i> ${Utils.escapeHtml(notif.auteur_prenom || 'Anonyme')}
            ${updatedDate ? ` <span class="notif-updated">(modifié le ${Utils.formatDate(updatedDate)}${notif.updated_by_prenom ? ' par ' + Utils.escapeHtml(notif.updated_by_prenom) : ''})</span>` : ''}
          </div>
          <div class="notif-date">
            <i class="fas fa-clock"></i> ${Utils.formatRelativeDate(date)}
          </div>
        </div>
      </div>
    `;
  },

  filterNotifications() {
    let list = this.currentFilter === 'all'
      ? Notifications.items
      : Notifications.items.filter(n => n.priorite === this.currentFilter);

    const dateFrom = document.getElementById('filter-notif-date-from')?.value || '';
    const dateTo = document.getElementById('filter-notif-date-to')?.value || '';
    if (dateFrom || dateTo) {
      list = list.filter(n => {
        const d = n.created_at?.toDate ? n.created_at.toDate() : new Date(n.created_at || 0);
        if (isNaN(d.getTime())) return false;
        const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (dateFrom && dateStr < dateFrom) return false;
        if (dateTo && dateStr > dateTo) return false;
        return true;
      });
    }
    return list;
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.refreshNotifList();
    const target = event && event.target;
    if (target) {
      document.querySelectorAll('.notif-filters .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      });
      target.classList.remove('btn-secondary');
      target.classList.add('btn-primary');
    }
  },

  showAddModal() {
    document.getElementById('notif-titre').value = '';
    document.getElementById('notif-contenu').value = '';
    document.querySelector('input[name="notif-priorite"][value="normal"]').checked = true;
    Modal.show('modal-add-notif');
  },

  showEditModal(notifId) {
    const notif = Notifications.items.find(n => n.id === notifId);
    if (!notif) return;
    document.getElementById('notif-edit-id').value = notifId;
    document.getElementById('notif-titre-edit').value = notif.titre || '';
    document.getElementById('notif-contenu-edit').value = notif.contenu || '';
    const prioriteRadio = document.querySelector(`input[name="notif-priorite-edit"][value="${notif.priorite || 'normal'}"]`);
    if (prioriteRadio) prioriteRadio.checked = true;
    Modal.show('modal-edit-notif');
  },

  async submitEditNotification(event) {
    event.preventDefault();
    const id = document.getElementById('notif-edit-id').value;
    const titre = document.getElementById('notif-titre-edit').value.trim();
    const contenu = document.getElementById('notif-contenu-edit').value.trim();
    const priorite = document.querySelector('input[name="notif-priorite-edit"]:checked').value;

    if (!contenu) {
      Toast.error('Veuillez entrer un message');
      return;
    }

    const success = await Notifications.update(id, { titre: titre || null, contenu, priorite });
    if (success) {
      Modal.hide('modal-edit-notif');
      this.refreshNotifList();
    }
  },

  async submitNotification(event) {
    event.preventDefault();
    const titre = document.getElementById('notif-titre').value.trim();
    const contenu = document.getElementById('notif-contenu').value.trim();
    const priorite = document.querySelector('input[name="notif-priorite"]:checked').value;

    if (!contenu) {
      Toast.error('Veuillez entrer un message');
      return;
    }

    try {
      await Notifications.create({ titre: titre || null, contenu, priorite });
      Modal.hide('modal-add-notif');
      await Notifications.loadAll();
      this.refreshNotifList();
      document.getElementById('form-add-notif').reset();
    } catch (error) {
      // Erreur déjà gérée par Notifications.create
    }
  },

  async deleteNotification(id) {
    Modal.confirm(
      'Supprimer la notification',
      'Êtes-vous sûr de vouloir supprimer cette notification ?',
      async () => {
        const success = await Notifications.delete(id);
        if (success) this.refreshNotifList();
      }
    );
  }
};
