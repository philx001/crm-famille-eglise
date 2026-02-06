// ============================================
// NOTES PERSONNELLES
// Espace strictement privé : seul le créateur peut voir, modifier et supprimer.
// Pour mentors/superviseurs : notes personnelles (sans disciple) + notes par disciple.
// ============================================

const MAX_WORDS_PER_NOTE = 120;

const NotesPersonnelles = {
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  },

  async loadAll() {
    const uid = AppState.user?.id;
    if (!uid || typeof db === 'undefined') return [];
    try {
      const snapshot = await db.collection('notes_personnelles')
        .where('auteur_id', '==', uid)
        .orderBy('created_at', 'desc')
        .get();
      return snapshot.docs.map(doc => {
        const d = doc.data();
        return { id: doc.id, ...d, created_at: d.created_at };
      });
    } catch (e) {
      console.error('Erreur chargement notes personnelles:', e);
      const msg = (e && e.message) ? String(e.message) : '';
      const isIndexError = (e && e.code === 'failed-precondition') || (msg.toLowerCase().includes('index') && msg.toLowerCase().includes('required'));
      if (isIndexError) {
        Toast.warning('Index Firestore manquant. Consultez FIREBASE_INDEXES.md ou la console pour créer l\'index.');
      } else {
        Toast.warning('Impossible de charger les notes. Vérifiez la console (F12) pour le détail.');
      }
      return [];
    }
  },

  async create(data) {
    const uid = AppState.user?.id;
    if (!uid) return false;
    const payload = {
      auteur_id: uid,
      disciple_id: data.disciple_id || null,
      disciple_nom: data.disciple_nom || null,
      contenu: (data.contenu || '').trim(),
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    const words = this.countWords(payload.contenu);
    if (words > MAX_WORDS_PER_NOTE) {
      Toast.warning('Maximum ' + MAX_WORDS_PER_NOTE + ' mots par note.');
      return false;
    }
    try {
      await db.collection('notes_personnelles').add(payload);
      Toast.success('Note enregistrée');
      return true;
    } catch (e) {
      console.error('Erreur création note personnelle:', e);
      Toast.error('Erreur lors de l\'enregistrement');
      return false;
    }
  },

  async update(id, data) {
    const uid = AppState.user?.id;
    if (!uid) return false;
    const contenu = (data.contenu || '').trim();
    const words = this.countWords(contenu);
    if (words > MAX_WORDS_PER_NOTE) {
      Toast.warning('Maximum ' + MAX_WORDS_PER_NOTE + ' mots par note.');
      return false;
    }
    try {
      await db.collection('notes_personnelles').doc(id).update({
        contenu,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      Toast.success('Note modifiée');
      return true;
    } catch (e) {
      console.error('Erreur mise à jour note:', e);
      Toast.error('Erreur lors de la modification');
      return false;
    }
  },

  async delete(id) {
    const uid = AppState.user?.id;
    if (!uid) return false;
    try {
      await db.collection('notes_personnelles').doc(id).delete();
      Toast.success('Note supprimée');
      return true;
    } catch (e) {
      console.error('Erreur suppression note:', e);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  }
};

const PagesNotesPersonnelles = {
  async render() {
    const notes = await NotesPersonnelles.loadAll();
    const isMentorOrSuperviseur = Permissions.hasRole('mentor');
    const disciples = isMentorOrSuperviseur ? (Membres.getDisciples && Membres.getDisciples(AppState.user.id) || []) : [];

    const personalNotes = notes.filter(n => !n.disciple_id);
    const notesByDisciple = {};
    notes.filter(n => n.disciple_id).forEach(n => {
      if (!notesByDisciple[n.disciple_id]) notesByDisciple[n.disciple_id] = [];
      notesByDisciple[n.disciple_id].push(n);
    });

    const renderNoteList = (list, options) => {
      const { discipleId = null, discipleLabel = null, sectionId = 'perso' } = options || {};
      if (!list || list.length === 0) {
        return '<p class="text-muted" style="font-size: 0.9rem;">Aucune note.</p>';
      }
      return list.map(n => {
        const created = n.created_at?.toDate ? n.created_at.toDate() : new Date(n.created_at);
        const dateStr = created.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
          <div class="note-perso-item" data-note-id="${n.id}" style="padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
            <div class="note-perso-content" style="font-size: 0.95rem;">${Utils.escapeHtml(n.contenu)}</div>
            <div class="note-perso-meta" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap;">
              <span>${dateStr}</span>
              <span>
                <button type="button" class="btn btn-sm btn-outline" onclick="PagesNotesPersonnelles.editNote('${n.id}', '${sectionId}', ${discipleId ? "'" + discipleId + "'" : 'null'})" title="Modifier"><i class="fas fa-edit"></i></button>
                <button type="button" class="btn btn-sm btn-outline" onclick="PagesNotesPersonnelles.deleteNote('${n.id}', '${sectionId}', ${discipleId ? "'" + discipleId + "'" : 'null'})" title="Supprimer"><i class="fas fa-trash"></i></button>
              </span>
            </div>
          </div>`;
      }).join('');
    };

    const renderForm = (sectionId, discipleId, discipleLabel) => {
      const idSuffix = sectionId + (discipleId || '');
      return `
        <div class="note-perso-form" style="margin-top: var(--spacing-md);">
          <textarea class="form-control note-perso-textarea" id="note-input-${idSuffix}" rows="3" placeholder="Saisissez votre note (max ${MAX_WORDS_PER_NOTE} mots)..." data-section="${sectionId}" data-disciple-id="${discipleId || ''}" data-disciple-label="${Utils.escapeHtml(discipleLabel || '')}" oninput="PagesNotesPersonnelles.onInputWordCount(this)"></textarea>
          <div class="note-perso-counter" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
            <span id="note-words-${idSuffix}">0</span> / ${MAX_WORDS_PER_NOTE} mots
          </div>
          <button type="button" class="btn btn-primary" style="margin-top: 8px;" onclick="PagesNotesPersonnelles.submitNote('${idSuffix}')">
            <i class="fas fa-save"></i> Enregistrer
          </button>
        </div>`;
    };

    const nbPerso = personalNotes.length;
    const sectionPersonal = `
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-sticky-note"></i> Mes notes personnelles</h3>
        </div>
        <div class="card-body">
          <p class="text-muted small mb-3">${isMentorOrSuperviseur ? 'Notes générales pour vous seul (sans lien avec un disciple). ' : ''}Visible et modifiable par vous uniquement.</p>
          <details class="notes-histoire-accordion" ${nbPerso > 0 ? 'open' : ''}>
            <summary class="notes-histoire-summary"><i class="fas fa-history"></i> Historique (${nbPerso} note${nbPerso !== 1 ? 's' : ''})</summary>
            <div id="notes-list-perso" class="notes-list-container">${renderNoteList(personalNotes, { sectionId: 'perso' })}</div>
          </details>
          <div class="notes-add-block" style="margin-top: var(--spacing-lg);">
            <strong class="d-block mb-2"><i class="fas fa-plus-circle"></i> Nouvelle note</strong>
            ${renderForm('perso', null, null)}
          </div>
        </div>
      </div>`;

    const sectionByDisciple = disciples.length === 0 ? '' : `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-friends"></i> Notes par disciple</h3>
        </div>
        <div class="card-body">
          <p class="text-muted small mb-3">Sélectionnez un disciple pour voir ou ajouter des notes le concernant.</p>
          <div class="mb-3">
            <label class="form-label">Disciple</label>
            <select class="form-control" id="notes-personnelles-disciple-select" style="max-width: 280px;" onchange="PagesNotesPersonnelles.renderDiscipleSection()">
              <option value="">-- Choisir un disciple --</option>
              ${disciples.map(d => `<option value="${d.id}">${Utils.escapeHtml(d.prenom + ' ' + d.nom)}</option>`).join('')}
            </select>
          </div>
          <div id="notes-personnelles-disciple-area">
            <p class="text-muted">Choisissez un disciple ci-dessus.</p>
          </div>
        </div>
      </div>`;

    return `
      <div class="notes-personnelles-page">
        <p class="text-muted mb-3"><i class="fas fa-lock"></i> Cet espace est strictement confidentiel. Seul vous pouvez voir, modifier et supprimer vos notes. Ni votre mentor, ni le superviseur, ni l'administrateur n'y ont accès.</p>
        ${sectionPersonal}
        ${isMentorOrSuperviseur ? sectionByDisciple : ''}
        <style>
          .notes-histoire-accordion { border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 0; }
          .notes-histoire-summary { padding: var(--spacing-sm) var(--spacing-md); cursor: pointer; font-weight: 600; list-style: none; display: flex; align-items: center; gap: var(--spacing-sm); }
          .notes-histoire-summary::-webkit-details-marker { display: none; }
          .notes-histoire-summary::before { content: '\\25B6'; font-size: 0.7rem; transition: transform 0.2s; }
          .notes-histoire-accordion[open] .notes-histoire-summary::before { transform: rotate(90deg); }
          .notes-list-container { padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md); max-height: 400px; overflow-y: auto; }
          .note-perso-item { padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); }
          .note-perso-item:last-child { border-bottom: none; }
          .note-perso-textarea { resize: vertical; min-height: 80px; }
        </style>
      </div>`;
  },

  onInputWordCount(textarea) {
    if (!textarea) return;
    const text = textarea.value || '';
    const count = NotesPersonnelles.countWords(text);
    const section = textarea.getAttribute('data-section') || '';
    const discipleId = textarea.getAttribute('data-disciple-id') || '';
    const idSuffix = section + (discipleId || '');
    const el = document.getElementById('note-words-' + idSuffix);
    if (el) el.textContent = count;
    if (count > MAX_WORDS_PER_NOTE) {
      textarea.setCustomValidity('Maximum ' + MAX_WORDS_PER_NOTE + ' mots.');
    } else {
      textarea.setCustomValidity('');
    }
  },

  async submitNote(idSuffix, discipleIdOrNull, discipleLabelOptional) {
    const textarea = document.getElementById('note-input-' + idSuffix);
    if (!textarea) return;
    const contenu = (textarea.value || '').trim();
    if (!contenu) {
      Toast.warning('Saisissez une note.');
      return;
    }
    const words = NotesPersonnelles.countWords(contenu);
    if (words > MAX_WORDS_PER_NOTE) {
      Toast.warning('Maximum ' + MAX_WORDS_PER_NOTE + ' mots par note. Enregistrez puis créez une nouvelle note pour continuer.');
      return;
    }
    const discipleId = discipleIdOrNull || textarea.getAttribute('data-disciple-id') || null;
    const discipleLabel = discipleLabelOptional != null ? discipleLabelOptional : (textarea.getAttribute('data-disciple-label') || null);
    const data = {
      contenu,
      disciple_id: discipleId || null,
      disciple_nom: discipleLabel || null
    };
    const ok = await NotesPersonnelles.create(data);
    if (ok) {
      textarea.value = '';
      PagesNotesPersonnelles.onInputWordCount(textarea);
      App.render();
    }
  },

  async editNote(noteId, sectionId, discipleId) {
    const notes = await NotesPersonnelles.loadAll();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const newContent = window.prompt('Modifier la note (max ' + MAX_WORDS_PER_NOTE + ' mots) :', note.contenu);
    if (newContent === null) return;
    const ok = await NotesPersonnelles.update(noteId, { contenu: newContent });
    if (ok) App.render();
  },

  async deleteNote(noteId, sectionId, discipleId) {
    if (!confirm('Supprimer cette note ?')) return;
    const ok = await NotesPersonnelles.delete(noteId);
    if (ok) App.render();
  },

  async renderDiscipleSection() {
    const select = document.getElementById('notes-personnelles-disciple-select');
    const area = document.getElementById('notes-personnelles-disciple-area');
    if (!select || !area) return;
    const discipleId = select.value;
    if (!discipleId) {
      area.innerHTML = '<p class="text-muted">Choisissez un disciple ci-dessus.</p>';
      return;
    }
    const disciple = typeof Membres !== 'undefined' && Membres.getById ? Membres.getById(discipleId) : null;
    const label = disciple ? disciple.prenom + ' ' + disciple.nom : '';
    const list = await NotesPersonnelles.loadAll();
    const forDisciple = (list || []).filter(n => n.disciple_id === discipleId);
    const nbNotes = forDisciple.length;
    const listHtml = nbNotes === 0
      ? '<p class="text-muted" style="font-size: 0.9rem;">Aucune note pour ce disciple.</p>'
      : forDisciple.map(n => {
          const created = n.created_at?.toDate ? n.created_at.toDate() : new Date(n.created_at);
          const dateStr = created.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          return `
            <div class="note-perso-item" style="padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
              <div class="note-perso-content" style="font-size: 0.95rem;">${Utils.escapeHtml(n.contenu)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap;">
                <span>${dateStr}</span>
                <span>
                  <button type="button" class="btn btn-sm btn-outline" onclick="PagesNotesPersonnelles.editNote('${n.id}', 'disciple', '${discipleId}')" title="Modifier"><i class="fas fa-edit"></i></button>
                  <button type="button" class="btn btn-sm btn-outline" onclick="PagesNotesPersonnelles.deleteNote('${n.id}', 'disciple', '${discipleId}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                </span>
              </div>
            </div>`;
        }).join('');
    const idSuffix = 'disciple' + discipleId;
    const formHtml = `
      <details class="notes-histoire-accordion" ${nbNotes > 0 ? 'open' : ''}>
        <summary class="notes-histoire-summary"><i class="fas fa-history"></i> Historique (${nbNotes} note${nbNotes !== 1 ? 's' : ''}) pour ${Utils.escapeHtml(label)}</summary>
        <div class="notes-list-container" style="max-height: 300px; overflow-y: auto;">${listHtml}</div>
      </details>
      <div class="notes-add-block" style="margin-top: var(--spacing-lg);">
        <strong class="d-block mb-2"><i class="fas fa-plus-circle"></i> Nouvelle note pour ${Utils.escapeHtml(label)}</strong>
        <div class="note-perso-form">
          <textarea class="form-control note-perso-textarea" id="note-input-${idSuffix}" rows="3" placeholder="Note pour ${Utils.escapeHtml(label)} (max ${MAX_WORDS_PER_NOTE} mots)..." data-section="disciple" data-disciple-id="${discipleId}" data-disciple-label="${Utils.escapeHtml(label)}" oninput="PagesNotesPersonnelles.onInputWordCount(this)"></textarea>
          <div class="note-perso-counter" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;"><span id="note-words-${idSuffix}">0</span> / ${MAX_WORDS_PER_NOTE} mots</div>
          <button type="button" class="btn btn-primary" style="margin-top: 8px;" onclick="PagesNotesPersonnelles.submitNote('${idSuffix}')"><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>`;
    area.innerHTML = formHtml;
  }
};

if (typeof window !== 'undefined') {
  window.NotesPersonnelles = NotesPersonnelles;
  window.PagesNotesPersonnelles = PagesNotesPersonnelles;
}
