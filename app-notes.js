// ============================================
// MODULE NOTES DE SUIVI
// Notes pastorales sur membres et nouvelles âmes
// ============================================

const NotesSuivi = {
  async loadByEntite(entiteType, entiteId) {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      const entiteRef = `${entiteType}_${entiteId}`;
      const snapshot = await db.collection('notes_suivi')
        .where('famille_id', '==', familleId)
        .where('entite_ref', '==', entiteRef)
        .orderBy('created_at', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erreur chargement notes:', error);
      return [];
    }
  },

  async create(entiteType, entiteId, contenu) {
    try {
      const note = {
        famille_id: AppState.famille.id,
        entite_type: entiteType,
        entite_id: entiteId,
        entite_ref: `${entiteType}_${entiteId}`,
        contenu: contenu.trim(),
        auteur_id: AppState.user.id,
        auteur_prenom: AppState.user.prenom,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('notes_suivi').add(note);
      Toast.success('Note ajoutée');
      return true;
    } catch (error) {
      console.error('Erreur création note:', error);
      Toast.error('Erreur lors de l\'ajout');
      return false;
    }
  },

  async delete(id) {
    try {
      await db.collection('notes_suivi').doc(id).delete();
      Toast.success('Note supprimée');
      return true;
    } catch (error) {
      console.error('Erreur suppression:', error);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  },

  canAddNote() {
    return Permissions.hasRole('mentor');
  },

  async addNote(entiteType, entiteId, contenu) {
    if (!contenu || !contenu.trim()) { Toast.warning('Saisissez une note'); return; }
    const ok = await this.create(entiteType, entiteId, contenu);
    if (ok) {
      const input = document.getElementById(`note-input-${entiteType}-${entiteId}`);
      if (input) input.value = '';
      this.loadAndRender(entiteType, entiteId);
    }
  },

  async loadAndRender(entiteType, entiteId) {
    const notes = await this.loadByEntite(entiteType, entiteId);
    const container = document.getElementById(`notes-list-${entiteType}-${entiteId}`);
    if (!container) return;
    if (notes.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size: 0.9rem;">Aucune note.</p>';
      return;
    }
    container.innerHTML = notes.map(n => {
      const date = n.created_at?.toDate ? n.created_at.toDate() : new Date(n.created_at);
      return `
        <div class="note-item" style="padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
          <div style="font-size: 0.9rem;">${Utils.escapeHtml(n.contenu)}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            ${Utils.escapeHtml(n.auteur_prenom || 'Anonyme')} — ${Utils.formatRelativeDate(date)}
            <button type="button" class="btn btn-sm btn-outline" style="margin-left: 8px; padding: 2px 6px; font-size: 0.75rem;" 
                    onclick="NotesSuivi.deleteNoteAndRefresh('${n.id}', '${entiteType}', '${entiteId}')" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async deleteNoteAndRefresh(noteId, entiteType, entiteId) {
    if (!confirm('Supprimer cette note ?')) return;
    const ok = await this.delete(noteId);
    if (ok) this.loadAndRender(entiteType, entiteId);
  }
};
