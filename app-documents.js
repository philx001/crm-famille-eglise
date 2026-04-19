// ============================================
// MODULE DOCUMENTS
// Phase 4 - Gestion des documents partagés
// ============================================

const Documents = {
  MAX_FILE_BYTES: 30 * 1024 * 1024,

  items: [],
  dossiers: [],

  docDossierId(doc) {
    return doc.dossier_id || null;
  },

  // Catégories de documents
  getCategories() {
    return [
      { value: 'documents_divers', label: 'Documents divers', icon: 'fa-file-alt' },
      { value: 'comptes_rendus_reunion', label: 'Comptes rendus de réunion', icon: 'fa-clipboard' }
    ];
  },

  // Niveaux de visibilité
  getVisibilites() {
    return [
      { value: 'tous', label: 'Visible par tous', icon: 'fa-globe', description: 'Tous les membres de la famille' },
      { value: 'mentors_superviseur', label: 'Mentors et Superviseur', icon: 'fa-user-shield', description: 'Mentors, adjoints et superviseur uniquement' },
      { value: 'superviseur_seul', label: 'Superviseur uniquement', icon: 'fa-lock', description: 'Accès réservé au superviseur' }
    ];
  },

  async loadDossiers() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) {
        this.dossiers = [];
        return [];
      }
      const snapshot = await db.collection('document_dossiers')
        .where('famille_id', '==', familleId)
        .get();
      this.dossiers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      let refetched = await this.ensureSystemRootFolders();
      if (refetched) {
        const snap2 = await db.collection('document_dossiers')
          .where('famille_id', '==', familleId)
          .get();
        this.dossiers = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      return this.dossiers;
    } catch (error) {
      console.error('Erreur chargement répertoires:', error);
      this.dossiers = [];
      return [];
    }
  },

  /**
   * Crée à la racine les dossiers système (IDs fixes famroot_{familleId}_*) pour alignement avec les règles Firestore.
   * Tout membre authentifié de la famille peut déclencher ce bootstrap une fois.
   */
  async ensureSystemRootFolders() {
    const familleId = AppState.famille?.id;
    if (!familleId) return false;
    const atRoot = (d) => (d.parent_id || null) === null;
    const hasKey = (key) => this.dossiers.some((d) => atRoot(d) && d.system_key === key);
    if (hasKey('documents_divers') && hasKey('comptes_rendus_reunion')) return false;

    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const base = {
      famille_id: familleId,
      parent_id: null,
      created_by: AppState.user.id,
      created_at: ts,
      updated_at: ts
    };
    let created = false;

    if (!hasKey('documents_divers')) {
      const ref = db.collection('document_dossiers').doc(`famroot_${familleId}_documents_divers`);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({ ...base, system_key: 'documents_divers', nom: 'Documents divers' });
        created = true;
      }
    }
    if (!hasKey('comptes_rendus_reunion')) {
      const ref = db.collection('document_dossiers').doc(`famroot_${familleId}_comptes_rendus_reunion`);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({ ...base, system_key: 'comptes_rendus_reunion', nom: 'Comptes rendus de réunion' });
        created = true;
      }
    }
    return created;
  },

  getSubfolders(parentId) {
    const p = parentId || null;
    const list = this.dossiers.filter((d) => (d.parent_id || null) === p);
    if (p !== null) {
      return list.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' }));
    }
    const order = { documents_divers: 0, comptes_rendus_reunion: 1 };
    return list.sort((a, b) => {
      const sa = a.system_key;
      const sb = b.system_key;
      const oa = sa != null && Object.prototype.hasOwnProperty.call(order, sa) ? order[sa] : null;
      const ob = sb != null && Object.prototype.hasOwnProperty.call(order, sb) ? order[sb] : null;
      if (oa !== null && ob !== null) return oa - ob;
      if (oa !== null && ob === null) return -1;
      if (oa === null && ob !== null) return 1;
      return (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
    });
  },

  getRootFolderForFolderId(folderId) {
    if (!folderId) return null;
    const byId = Object.fromEntries(this.dossiers.map((d) => [d.id, d]));
    let cur = byId[folderId];
    const guard = new Set();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      if ((cur.parent_id || null) === null) return cur;
      cur = byId[cur.parent_id];
    }
    return cur || null;
  },

  /** Catégorie métier (comptes rendus / documents divers) déduite du dossier racine. */
  getCategorieForFolderId(folderId) {
    if (!folderId) return 'documents_divers';
    const root = this.getRootFolderForFolderId(folderId);
    if (!root) return 'documents_divers';
    if (root.system_key === 'comptes_rendus_reunion') return 'comptes_rendus_reunion';
    if (root.system_key === 'documents_divers') return 'documents_divers';
    return 'documents_divers';
  },

  /** Options `<option>` pour sélecteur de répertoire. `includeRoot` : option « hors répertoire » (déplacement). `forUpload` : pas de racine, fichier obligatoirement dans un dossier. */
  getDossierSelectOptionsHtml(selectedId, options) {
    const opts = { includeRoot: true, forUpload: false, ...options };
    const sel = selectedId || '';
    const indent = (depth) => '\u00A0\u00A0'.repeat(depth) + (depth ? '↳ ' : '');
    const parts = [];
    if (opts.includeRoot && !opts.forUpload) {
      parts.push(`<option value=""${sel === '' ? ' selected' : ''}>Racine (hors répertoire)</option>`);
    }
    if (opts.forUpload) {
      parts.push(`<option value="" disabled${!sel ? ' selected' : ''}>— Choisir un répertoire —</option>`);
    }
    const walk = (parentId, depth) => {
      this.getSubfolders(parentId).forEach((d) => {
        const label = indent(depth) + (d.nom || '');
        const issel = d.id === sel ? ' selected' : '';
        parts.push(`<option value="${Utils.escapeAttr(d.id)}"${issel}>${Utils.escapeHtml(label)}</option>`);
        walk(d.id, depth + 1);
      });
    };
    walk(null, 0);
    return parts.join('');
  },

  getBreadcrumb(folderId) {
    if (!folderId) return [];
    const byId = Object.fromEntries(this.dossiers.map((d) => [d.id, d]));
    const crumbs = [];
    let id = folderId;
    const guard = new Set();
    while (id && !guard.has(id)) {
      guard.add(id);
      const d = byId[id];
      if (!d) break;
      crumbs.unshift({ id: d.id, nom: d.nom || 'Sans nom' });
      id = d.parent_id || null;
    }
    return crumbs;
  },

  async createDossier(nom, parentId) {
    if (!Permissions.canManageDocumentFolders()) {
      throw new Error('Permission refusée');
    }
    const trimmed = (nom || '').trim();
    if (!trimmed) throw new Error('Nom du répertoire requis');
    const familleId = AppState.famille?.id;
    if (!familleId) throw new Error('Famille non chargée');

    const data = {
      nom: trimmed,
      famille_id: familleId,
      parent_id: parentId || null,
      created_by: AppState.user.id,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('document_dossiers').add(data);
    await this.loadDossiers();
  },

  async renameDossier(id, nom) {
    const folder = this.dossiers.find((x) => x.id === id);
    if (!folder || !Permissions.canModifyDocumentFolder(folder)) {
      throw new Error('Permission refusée');
    }
    const trimmed = (nom || '').trim();
    if (!trimmed) throw new Error('Nom requis');
    await db.collection('document_dossiers').doc(id).update({
      nom: trimmed,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    const d = this.dossiers.find((x) => x.id === id);
    if (d) d.nom = trimmed;
  },

  async deleteDossier(id) {
    const folder = this.dossiers.find((x) => x.id === id);
    if (!folder || !Permissions.canModifyDocumentFolder(folder)) {
      throw new Error('Permission refusée');
    }
    if (folder.system_key === 'documents_divers' || folder.system_key === 'comptes_rendus_reunion') {
      throw new Error('Ce répertoire racine est obligatoire et ne peut pas être supprimé');
    }
    const hasSub = this.dossiers.some((d) => (d.parent_id || null) === id);
    if (hasSub) {
      throw new Error('Supprimez d\'abord les sous-répertoires');
    }
    const familleId = AppState.famille?.id;
    if (!familleId) throw new Error('Famille non chargée');
    const docsSnap = await db.collection('documents').where('famille_id', '==', familleId).get();
    const hasFile = docsSnap.docs.some((d) => d.data().dossier_id === id);
    if (hasFile) {
      throw new Error('Le répertoire contient encore des fichiers');
    }
    await db.collection('document_dossiers').doc(id).delete();
    this.dossiers = this.dossiers.filter((d) => d.id !== id);
  },

  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      await this.loadDossiers();

      const snapshot = await db.collection('documents')
        .where('famille_id', '==', familleId)
        .orderBy('created_at', 'desc')
        .get();

      // Filtrer selon la visibilité
      this.items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(doc => this.canView(doc));

      return this.items;
    } catch (error) {
      console.error('Erreur chargement documents:', error);
      return [];
    }
  },

  canView(doc) {
    if (doc.visibilite === 'tous') return true;
    if (doc.visibilite === 'mentors_superviseur' && Permissions.hasRole('mentor')) return true;
    if (doc.visibilite === 'superviseur_seul' && Permissions.hasRole('superviseur')) return true;
    return false;
  },

  async upload(file, metadata) {
    try {
      if (!Permissions.canManageDocuments()) {
        throw new Error('Permission refusée');
      }
      if (file.size > this.MAX_FILE_BYTES) {
        Toast.error(`Le fichier est trop volumineux (max ${Math.round(this.MAX_FILE_BYTES / (1024 * 1024))} Mo)`);
        throw new Error('Fichier trop volumineux');
      }

      App.showLoading();

      // Upload vers Firebase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = storage.ref(`documents/${AppState.famille.id}/${fileName}`);
      
      const uploadTask = await storageRef.put(file);
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Créer le document dans Firestore
      const dossierId = metadata.dossier_id || null;
      const docData = {
        titre: metadata.titre,
        description: metadata.description || null,
        categorie: metadata.categorie,
        visibilite: metadata.visibilite,
        fichier_url: downloadURL,
        fichier_nom: file.name,
        fichier_type: file.type,
        fichier_taille: file.size,
        famille_id: AppState.famille.id,
        uploaded_by: AppState.user.id,
        dossier_id: dossierId,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('documents').add(docData);
      const newDoc = { id: docRef.id, ...docData, created_at: new Date() };
      this.items.unshift(newDoc);

      Toast.success('Document uploadé avec succès');
      return newDoc;
    } catch (error) {
      console.error('Erreur upload document:', error);
      const isPermissionError = error.message && (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('insufficient'));
      if (isPermissionError) {
        Toast.error('Droits insuffisants. Vérifiez : 1) Règles Firestore (collection "documents") et 2) Règles Storage (chemin "documents"). Puis publiez les deux.');
        setTimeout(() => {
          if (window.confirm('Ouvrir la console Firebase (Storage et Firestore) pour vérifier les règles ?')) {
            window.open('https://console.firebase.google.com/project/crm-famille-eglise/storage/rules', '_blank');
            window.open('https://console.firebase.google.com/project/crm-famille-eglise/firestore/rules', '_blank');
          }
        }, 500);
      } else {
        Toast.error(error.message || 'Erreur lors de l\'upload');
      }
      throw error;
    } finally {
      App.hideLoading();
    }
  },

  async delete(id, opts) {
    try {
      const doc = this.items.find(d => d.id === id);
      if (!doc) throw new Error('Document non trouvé');
      if (!Permissions.canDeleteDocument(doc)) {
        throw new Error('Permission refusée');
      }

      // Supprimer de Storage
      if (doc.fichier_url) {
        try {
          const storageRef = storage.refFromURL(doc.fichier_url);
          await storageRef.delete();
        } catch (e) {
          console.warn('Fichier déjà supprimé ou inaccessible');
        }
      }

      // Supprimer de Firestore
      await db.collection('documents').doc(id).delete();
      this.items = this.items.filter(d => d.id !== id);

      if (!opts || !opts.silent) Toast.success('Document supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression document:', error);
      if (!opts || !opts.silent) Toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  },

  async updateDocumentMeta(id, fields) {
    const local = this.items.find((d) => d.id === id);
    if (!local) throw new Error('Document introuvable');
    if (!Permissions.canEditDocument(local)) throw new Error('Permission refusée');

    const patch = { updated_at: firebase.firestore.FieldValue.serverTimestamp() };
    if (fields.titre !== undefined) patch.titre = String(fields.titre).trim();
    if (fields.description !== undefined) patch.description = fields.description ? String(fields.description).trim() : null;
    if (fields.visibilite !== undefined) patch.visibilite = fields.visibilite;
    if (fields.dossier_id !== undefined) {
      patch.dossier_id = fields.dossier_id || null;
      patch.categorie = this.getCategorieForFolderId(patch.dossier_id);
    } else if (fields.categorie !== undefined) {
      patch.categorie = fields.categorie;
    }

    await db.collection('documents').doc(id).update(patch);
    await this.loadAll();
  },

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  getFileIcon(mimeType) {
    if (!mimeType) return 'fa-file';
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fa-file-powerpoint';
    if (mimeType.includes('image')) return 'fa-file-image';
    if (mimeType.includes('video')) return 'fa-file-video';
    if (mimeType.includes('audio')) return 'fa-file-audio';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'fa-file-archive';
    return 'fa-file';
  },

  getByCategorie(categorie) {
    return this.items.filter(d => d.categorie === categorie);
  }
};

// ============================================
// PAGES DOCUMENTS
// ============================================

const PagesDocuments = {
  currentDossierId: null,
  _renamingDossierId: null,
  _moveDocId: null,
  selectedDocIds: new Set(),

  renderBreadcrumbHtml() {
    const breadcrumb = Documents.getBreadcrumb(this.currentDossierId);
    return `
        <button type="button" class="btn btn-sm btn-secondary docs-crumb-root" data-doc-crumb="root">
          <i class="fas fa-home"></i> Documents
        </button>
        ${breadcrumb.map((c) => `
          <span class="docs-crumb-sep">/</span>
          <button type="button" class="btn btn-sm btn-secondary docs-crumb" data-doc-crumb="folder" data-dossier-id="${Utils.escapeAttr(c.id)}">
            ${Utils.escapeHtml(c.nom)}
          </button>
        `).join('')}
    `;
  },

  onBreadcrumbBarClick(event) {
    const btn = event.target.closest('[data-doc-crumb]');
    if (!btn) return;
    event.preventDefault();
    const kind = btn.getAttribute('data-doc-crumb');
    if (kind === 'root') this.goRoot();
    else if (kind === 'folder') {
      const id = btn.getAttribute('data-dossier-id');
      if (id) this.enterFolder(id);
    }
  },

  onDocsListClick(event) {
    if (event.target.closest('.doc-folder-card .doc-actions')) return;
    const card = event.target.closest('.doc-folder-card[data-folder-id]');
    if (!card) return;
    const id = card.getAttribute('data-folder-id');
    if (id) this.enterFolder(id);
  },

  refreshDocsChrome() {
    const list = document.getElementById('docs-list');
    const crumb = document.getElementById('docs-breadcrumb');
    if (list) list.innerHTML = this.renderDocsList();
    if (crumb) crumb.innerHTML = this.renderBreadcrumbHtml();
    this.syncBulkToolbar();
  },

  getVisibleDeletableDocs() {
    const fid = this.currentDossierId || null;
    const docs = Documents.items.filter((d) => Documents.docDossierId(d) === fid);
    return docs.filter((d) => Permissions.canDeleteDocument(d));
  },

  syncBulkToolbar() {
    const bar = document.getElementById('docs-bulk-toolbar');
    const countEl = document.getElementById('docs-selected-count-label');
    const n = this.selectedDocIds.size;
    const visible = this.getVisibleDeletableDocs();
    if (!bar) return;
    bar.style.display = visible.length > 0 ? 'flex' : 'none';
    if (countEl) countEl.textContent = n > 0 ? `${n} fichier(s) sélectionné(s)` : '';
    const cb = document.getElementById('docs-select-all-checkbox');
    if (cb && visible.length) {
      const allSelected = visible.every((d) => this.selectedDocIds.has(d.id));
      const someSelected = visible.some((d) => this.selectedDocIds.has(d.id));
      cb.checked = allSelected;
      cb.indeterminate = !!(someSelected && !allSelected);
    } else if (cb) {
      cb.checked = false;
      cb.indeterminate = false;
    }
  },

  onDocSelectChange(event) {
    const input = event.target;
    const id = input && input.getAttribute('data-doc-id');
    if (!id) return;
    if (input.checked) this.selectedDocIds.add(id);
    else this.selectedDocIds.delete(id);
    this.syncBulkToolbar();
  },

  onSelectAllChange(event) {
    const checked = event.target.checked;
    const docs = this.getVisibleDeletableDocs();
    if (checked) docs.forEach((d) => this.selectedDocIds.add(d.id));
    else docs.forEach((d) => this.selectedDocIds.delete(d.id));
    const list = document.getElementById('docs-list');
    if (list) list.innerHTML = this.renderDocsList();
    this.syncBulkToolbar();
  },

  clearDocSelection() {
    this.selectedDocIds.clear();
    const list = document.getElementById('docs-list');
    if (list) list.innerHTML = this.renderDocsList();
    this.syncBulkToolbar();
  },

  bulkDeleteSelected() {
    const ids = Array.from(this.selectedDocIds).filter((id) => {
      const d = Documents.items.find((x) => x.id === id);
      return d && Permissions.canDeleteDocument(d);
    });
    if (ids.length === 0) {
      Toast.error('Aucun fichier sélectionné');
      return;
    }
    Modal.confirm(
      'Supprimer les documents',
      `Supprimer définitivement ${ids.length} document(s) ? Cette action est irréversible.`,
      async () => {
        App.showLoading();
        let ok = 0;
        try {
          for (let i = 0; i < ids.length; i++) {
            if (await Documents.delete(ids[i], { silent: true })) {
              ok++;
            }
          }
          this.selectedDocIds.clear();
          Toast.success(`${ok} document(s) supprimé(s)`);
          this.refreshDocsChrome();
        } catch (e) {
          Toast.error(e.message || 'Erreur');
        } finally {
          App.hideLoading();
        }
      }
    );
  },

  enterFolder(id) {
    this.selectedDocIds.clear();
    this.currentDossierId = id;
    this.refreshDocsChrome();
  },

  goRoot() {
    this.selectedDocIds.clear();
    this.currentDossierId = null;
    this.refreshDocsChrome();
  },

  showMoveDocModal(docId) {
    const doc = Documents.items.find((d) => d.id === docId);
    if (!doc || !Permissions.canEditDocument(doc)) return;
    this._moveDocId = docId;
    const dosSel = document.getElementById('move-doc-dossier');
    if (dosSel) dosSel.innerHTML = Documents.getDossierSelectOptionsHtml(doc.dossier_id || '', { includeRoot: true, forUpload: false });
    Modal.show('modal-move-doc');
  },

  async submitMoveDoc() {
    const id = this._moveDocId;
    if (!id) return;
    const doc = Documents.items.find((d) => d.id === id);
    if (!doc || !Permissions.canEditDocument(doc)) return;
    const dossierRaw = document.getElementById('move-doc-dossier').value;
    try {
      App.showLoading();
      await Documents.updateDocumentMeta(id, {
        dossier_id: dossierRaw || null
      });
      this._moveDocId = null;
      Modal.hide('modal-move-doc');
      Toast.success('Document déplacé');
      this.refreshDocsChrome();
    } catch (e) {
      Toast.error(e.message || 'Erreur');
    } finally {
      App.hideLoading();
    }
  },

  async render() {
    this.selectedDocIds.clear();

    await Documents.loadAll();

    const canManage = Permissions.canManageDocuments();
    const canFolders = Permissions.canManageDocumentFolders();

    const html = `
      <div class="docs-breadcrumb" id="docs-breadcrumb" onclick="PagesDocuments.onBreadcrumbBarClick(event)">
        ${this.renderBreadcrumbHtml()}
      </div>

      <div class="docs-header">
        <p class="docs-intro text-muted" style="flex: 1; min-width: 200px; margin: 0; font-size: 0.9rem;">
          À la <strong>racine</strong> : les dossiers <strong>Documents divers</strong>, <strong>Comptes rendus de réunion</strong> et vos autres dossiers (ex. vidéos). Dans chacun, vous pouvez créer des <strong>sous-répertoires</strong>.
        </p>
        <div class="docs-header-actions">
        ${canFolders ? `
          <button type="button" class="btn btn-outline" onclick="PagesDocuments.showNewDossierModal()" title="Adjoint superviseur et rôles supérieurs">
            <i class="fas fa-folder-plus"></i> Nouveau répertoire
          </button>
        ` : ''}
        ${canManage ? `
          <button type="button" class="btn btn-primary" onclick="PagesDocuments.showUploadModal()">
            <i class="fas fa-upload"></i> Ajouter un document
          </button>
        ` : ''}
        </div>
      </div>

      <div class="docs-bulk-toolbar" id="docs-bulk-toolbar" style="display: none;">
        <label class="docs-bulk-select-all">
          <input type="checkbox" id="docs-select-all-checkbox" onchange="PagesDocuments.onSelectAllChange(event)">
          Tout sélectionner (fichiers visibles)
        </label>
        <span id="docs-selected-count-label" class="text-muted" style="font-size: 0.9rem;"></span>
        <button type="button" class="btn btn-sm btn-danger" onclick="PagesDocuments.bulkDeleteSelected()">
          <i class="fas fa-trash"></i> Supprimer la sélection
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="PagesDocuments.clearDocSelection()">Annuler la sélection</button>
      </div>

      <div class="docs-list" id="docs-list" onclick="PagesDocuments.onDocsListClick(event)">
        ${this.renderDocsList()}
      </div>

      <!-- Modal upload -->
      <div class="modal-overlay" id="modal-upload-doc">
        <div class="modal" style="max-width: 550px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-upload"></i> Ajouter un document</h3>
            <button class="modal-close" onclick="Modal.hide('modal-upload-doc')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="form-upload-doc" onsubmit="PagesDocuments.submitUpload(event)">
              <p class="text-muted" style="font-size: 0.85rem; margin-bottom: var(--spacing-md);">
                Choisissez le <strong>répertoire</strong> (racine ou sous-dossier). Le type « comptes rendus » / « documents divers » est déduit automatiquement selon que vous rangez le fichier sous <strong>Comptes rendus de réunion</strong> ou <strong>Documents divers</strong>. Les mentors n’ajoutent pas de dossiers racine : ils remplissent les répertoires existants ou des sous-dossiers.
              </p>
              <div class="form-group">
                <label class="form-label required" for="doc-dossier">Répertoire</label>
                <select class="form-control" id="doc-dossier" aria-describedby="doc-dossier-hint" required></select>
                <p class="text-muted" id="doc-dossier-hint" style="font-size: 0.8rem; margin-top: 6px; margin-bottom: 0;">
                  Obligatoire : un fichier doit être rangé dans un dossier (y compris un sous-dossier).
                </p>
              </div>
              <div class="form-group">
                <label class="form-label required">Fichier</label>
                <div class="file-upload-zone" id="file-upload-zone">
                  <input type="file" id="doc-file" required onchange="PagesDocuments.onFileSelect(this)">
                  <div class="file-upload-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Cliquez ou glissez un fichier ici</p>
                    <span class="file-upload-hint">PDF, Word, Excel, images… (max 30 Mo)</span>
                  </div>
                  <div class="file-selected" id="file-selected" style="display: none;">
                    <i class="fas fa-file"></i>
                    <span id="file-selected-name"></span>
                    <button type="button" class="btn-remove-file" onclick="PagesDocuments.removeFile()">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label required">Titre</label>
                <input type="text" class="form-control" id="doc-titre" required placeholder="Nom du document">
              </div>

              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="doc-description" rows="2" placeholder="Description optionnelle"></textarea>
              </div>

              <div class="form-group">
                <label class="form-label required">Visibilité</label>
                <div class="visibilite-options">
                  ${Documents.getVisibilites().map((v, i) => `
                    <label class="visibilite-option">
                      <input type="radio" name="doc-visibilite" value="${v.value}" ${i === 0 ? 'checked' : ''}>
                      <div class="visibilite-card">
                        <i class="fas ${v.icon}"></i>
                        <span class="visibilite-label">${v.label}</span>
                        <span class="visibilite-desc">${v.description}</span>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.hide('modal-upload-doc')">Annuler</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-upload-doc').requestSubmit()">
              <i class="fas fa-upload"></i> Uploader
            </button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" id="modal-new-dossier">
        <div class="modal" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-folder-plus"></i> Nouveau répertoire</h3>
            <button type="button" class="modal-close" onclick="Modal.hide('modal-new-dossier')">&times;</button>
          </div>
          <div class="modal-body">
            <p class="text-muted" style="font-size: 0.85rem; margin-bottom: var(--spacing-md);" id="new-dossier-context"></p>
            <div class="form-group">
              <label class="form-label required" for="new-dossier-nom">Nom du répertoire</label>
              <input type="text" class="form-control" id="new-dossier-nom" maxlength="120" required placeholder="Ex. Comptes rendus 2026">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.hide('modal-new-dossier')">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="PagesDocuments.submitNewDossier()">
              <i class="fas fa-check"></i> Créer
            </button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" id="modal-rename-dossier">
        <div class="modal" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-pen"></i> Renommer le répertoire</h3>
            <button type="button" class="modal-close" onclick="Modal.hide('modal-rename-dossier')">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label required" for="rename-dossier-nom">Nouveau nom</label>
              <input type="text" class="form-control" id="rename-dossier-nom" maxlength="120" required>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.hide('modal-rename-dossier')">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="PagesDocuments.submitRenameDossier()">
              <i class="fas fa-save"></i> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" id="modal-move-doc">
        <div class="modal" style="max-width: 480px;">
          <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-arrows-alt"></i> Déplacer le document</h3>
            <button type="button" class="modal-close" onclick="Modal.hide('modal-move-doc')">&times;</button>
          </div>
          <div class="modal-body">
            <p class="text-muted" style="font-size: 0.85rem; margin-bottom: var(--spacing-md);">
              Déplacez le fichier vers un autre répertoire. La catégorie (comptes rendus / documents divers) est mise à jour automatiquement selon le dossier racine (Documents divers, Comptes rendus, ou autre). La visibilité définie à l’upload est conservée.
            </p>
            <div class="form-group">
              <label class="form-label" for="move-doc-dossier">Répertoire de destination</label>
              <select class="form-control" id="move-doc-dossier">
                <option value="">Racine</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.hide('modal-move-doc')">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="PagesDocuments.submitMoveDoc()">
              <i class="fas fa-check"></i> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <style>
        .docs-breadcrumb {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          margin-bottom: var(--spacing-md);
          font-size: 0.9rem;
        }
        .docs-breadcrumb button[data-doc-crumb] {
          cursor: pointer;
          max-width: min(100%, 420px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .docs-crumb-sep {
          color: var(--text-muted);
          user-select: none;
        }
        .docs-crumb {
          font-weight: 500;
        }
        .docs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }
        .docs-header-actions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
          align-items: center;
        }
        .docs-filters {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .docs-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--spacing-md);
        }
        .docs-bulk-toolbar {
          display: none;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
        }
        .docs-bulk-select-all {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .doc-card-file {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: var(--spacing-md);
          align-items: stretch;
        }
        .doc-card-select {
          display: flex;
          align-items: flex-start;
          padding-top: 10px;
        }
        .doc-card-file-main {
          min-width: 0;
        }
        .doc-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          transition: all 0.2s;
        }
        .doc-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        .doc-folder-card {
          cursor: pointer;
          border: 2px solid var(--border-color);
        }
        .doc-folder-card .doc-icon {
          color: #f0ad4e;
        }
        .doc-folder-card {
          cursor: pointer;
        }
        .doc-icon {
          width: 50px;
          height: 50px;
          border-radius: var(--radius-md);
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: var(--primary);
          margin-bottom: var(--spacing-md);
        }
        .doc-icon.pdf { color: #E53935; }
        .doc-icon.word { color: #1976D2; }
        .doc-icon.excel { color: #388E3C; }
        .doc-icon.image { color: #7B1FA2; }
        .doc-titre {
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
          word-break: break-word;
        }
        .doc-description {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: var(--spacing-md);
          flex: 1;
        }
        .doc-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          color: var(--text-muted);
          padding-top: var(--spacing-sm);
          border-top: 1px solid var(--border-color);
        }
        .doc-actions {
          display: flex;
          gap: var(--spacing-xs);
        }
        .doc-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 0.7rem;
          background: var(--bg-tertiary);
        }
        
        /* File upload zone */
        .file-upload-zone {
          position: relative;
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--spacing-xl);
          text-align: center;
          transition: all 0.2s;
          cursor: pointer;
        }
        .file-upload-zone:hover, .file-upload-zone.dragover {
          border-color: var(--primary);
          background: rgba(45, 90, 123, 0.05);
        }
        .file-upload-zone input[type="file"] {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        .file-upload-content i {
          font-size: 2.5rem;
          color: var(--primary);
          margin-bottom: var(--spacing-sm);
        }
        .file-upload-content p {
          margin: 0;
          font-weight: 500;
        }
        .file-upload-hint {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .file-selected {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--bg-primary);
          border-radius: var(--radius-sm);
        }
        .file-selected i {
          font-size: 1.5rem;
          color: var(--primary);
        }
        .file-selected span {
          flex: 1;
          font-weight: 500;
          word-break: break-all;
        }
        .btn-remove-file {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: var(--spacing-xs);
        }
        .btn-remove-file:hover {
          color: var(--danger);
        }
        
        /* Visibilité options */
        .visibilite-options {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        .visibilite-option {
          cursor: pointer;
        }
        .visibilite-option input {
          display: none;
        }
        .visibilite-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }
        .visibilite-card i {
          font-size: 1.2rem;
          color: var(--text-muted);
          width: 30px;
          text-align: center;
        }
        .visibilite-label {
          font-weight: 500;
        }
        .visibilite-desc {
          flex: 1;
          font-size: 0.8rem;
          color: var(--text-muted);
          text-align: right;
        }
        .visibilite-option input:checked + .visibilite-card {
          border-color: var(--primary);
          background: rgba(45, 90, 123, 0.05);
        }
        .visibilite-option input:checked + .visibilite-card i {
          color: var(--primary);
        }
      </style>
    `;

    setTimeout(() => PagesDocuments.syncBulkToolbar(), 0);
    return html;
  },

  renderDocsList() {
    const fid = this.currentDossierId || null;
    const subfolders = Documents.getSubfolders(fid);

    const docs = Documents.items.filter((d) => Documents.docDossierId(d) === fid);

    if (subfolders.length === 0 && docs.length === 0) {
      return `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fas fa-folder-open"></i>
          <h3>Aucun élément</h3>
          <p>Il n'y a rien dans cet emplacement.</p>
        </div>
      `;
    }

    const foldersHtml = subfolders.map((f) => this.renderFolderCard(f)).join('');
    const docsHtml = docs.map((d) => this.renderDocCard(d)).join('');
    return foldersHtml + docsHtml;
  },

  renderFolderCard(folder) {
    const canMod = Permissions.canModifyDocumentFolder(folder);
    const isSys = folder.system_key === 'documents_divers' || folder.system_key === 'comptes_rendus_reunion';
    return `
      <div class="doc-card doc-folder-card" role="button" tabindex="0" data-folder-id="${Utils.escapeAttr(folder.id)}"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();var id=event.currentTarget.getAttribute('data-folder-id');if(id)PagesDocuments.enterFolder(id);}">
        <div class="doc-icon">
          <i class="fas fa-folder"></i>
        </div>
        <div class="doc-titre">${Utils.escapeHtml(folder.nom)}</div>
        <div class="doc-description" style="font-size:0.85rem;color:var(--text-secondary);">
          ${isSys ? '<span class="doc-badge" style="margin-right:6px;">Racine</span>' : ''}Répertoire — cliquer pour ouvrir
        </div>
        <div class="doc-meta">
          <span></span>
          <div class="doc-actions" onclick="event.stopPropagation();">
            ${canMod ? `
              <button type="button" class="btn btn-sm btn-secondary" onclick="PagesDocuments.showRenameDossierModal('${folder.id}')" title="Renommer">
                <i class="fas fa-pen"></i>
              </button>
              ${!isSys ? `
              <button type="button" class="btn btn-sm btn-secondary" onclick="PagesDocuments.confirmDeleteDossier('${folder.id}')" title="Supprimer si vide">
                <i class="fas fa-trash"></i>
              </button>` : ''}
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderDocCard(doc) {
    const fileIcon = Documents.getFileIcon(doc.fichier_type);
    const iconClass = doc.fichier_type?.includes('pdf') ? 'pdf' :
                      doc.fichier_type?.includes('word') ? 'word' :
                      doc.fichier_type?.includes('excel') ? 'excel' :
                      doc.fichier_type?.includes('image') ? 'image' : '';
    const date = doc.created_at?.toDate ? doc.created_at.toDate() : new Date(doc.created_at);
    const uploader = Membres.getById(doc.uploaded_by);
    const visibilite = Documents.getVisibilites().find(v => v.value === doc.visibilite);
    const catLabel = Documents.getCategories().find((c) => c.value === doc.categorie)?.label || doc.categorie;
    const canDelete = Permissions.canDeleteDocument(doc);
    const canEdit = Permissions.canEditDocument(doc);
    const sel = this.selectedDocIds.has(doc.id);

    return `
      <div class="doc-card doc-card-file" data-doc-id="${Utils.escapeAttr(doc.id)}">
        ${canDelete ? `
        <label class="doc-card-select" onclick="event.stopPropagation();">
          <input type="checkbox" data-doc-id="${Utils.escapeAttr(doc.id)}" ${sel ? 'checked' : ''}
            onchange="PagesDocuments.onDocSelectChange(event)" aria-label="Sélectionner pour suppression groupée">
        </label>` : '<span class="doc-card-select" aria-hidden="true"></span>'}
        <div class="doc-card-file-main">
        <div class="doc-icon ${iconClass}">
          <i class="fas ${fileIcon}"></i>
        </div>
        <div class="doc-titre">${Utils.escapeHtml(doc.titre)}</div>
        ${doc.description ? `<div class="doc-description">${Utils.escapeHtml(doc.description)}</div>` : '<div class="doc-description"></div>'}
        <div style="margin-bottom: var(--spacing-sm);">
          <span class="doc-badge"><i class="fas fa-tag"></i> ${Utils.escapeHtml(catLabel)}</span>
          <span class="doc-badge"><i class="fas ${visibilite?.icon || 'fa-eye'}"></i> ${visibilite?.label || doc.visibilite}</span>
          <span class="doc-badge">${Documents.formatFileSize(doc.fichier_taille || 0)}</span>
        </div>
        <div class="doc-meta">
          <span><i class="fas fa-user"></i> ${uploader ? uploader.prenom : 'Inconnu'} • ${Utils.formatRelativeDate(date)}</span>
          <div class="doc-actions">
            <a href="${doc.fichier_url}" target="_blank" class="btn btn-sm btn-primary" title="Télécharger" rel="noopener">
              <i class="fas fa-download"></i>
            </a>
            ${canEdit ? `
              <button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation();PagesDocuments.showMoveDocModal('${doc.id}')" title="Déplacer (catégorie / répertoire)">
                <i class="fas fa-arrows-alt"></i>
              </button>
            ` : ''}
            ${canDelete ? `
              <button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation();PagesDocuments.deleteDoc('${doc.id}')" title="Supprimer">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
        </div>
      </div>
    `;
  },

  showNewDossierModal() {
    if (!Permissions.canManageDocumentFolders()) return;
    const ctx = document.getElementById('new-dossier-context');
    const crumbs = Documents.getBreadcrumb(this.currentDossierId);
    const path = crumbs.length
      ? 'Emplacement : Documents / ' + crumbs.map((c) => c.nom).join(' / ')
      : 'Emplacement : racine des documents (à la racine)';
    if (ctx) ctx.textContent = path;
    const input = document.getElementById('new-dossier-nom');
    if (input) input.value = '';
    Modal.show('modal-new-dossier');
    setTimeout(() => input?.focus(), 150);
  },

  async submitNewDossier() {
    const input = document.getElementById('new-dossier-nom');
    const nom = input && input.value ? input.value.trim() : '';
    if (!nom) {
      Toast.error('Indiquez un nom de répertoire');
      return;
    }
    try {
      App.showLoading();
      await Documents.createDossier(nom, this.currentDossierId);
      Modal.hide('modal-new-dossier');
      Toast.success('Répertoire créé. Remplissez-le via « Ajouter un document » en choisissant ce répertoire dans la liste.');
      this.refreshDocsChrome();
    } catch (e) {
      Toast.error(e.message || 'Erreur');
    } finally {
      App.hideLoading();
    }
  },

  showRenameDossierModal(id) {
    const d = Documents.dossiers.find((x) => x.id === id);
    if (!d || !Permissions.canModifyDocumentFolder(d)) return;
    this._renamingDossierId = id;
    const input = document.getElementById('rename-dossier-nom');
    if (input) input.value = d.nom || '';
    Modal.show('modal-rename-dossier');
    setTimeout(() => input?.focus(), 150);
  },

  async submitRenameDossier() {
    const id = this._renamingDossierId;
    const input = document.getElementById('rename-dossier-nom');
    const nom = input && input.value ? input.value.trim() : '';
    if (!id || !nom) {
      Toast.error('Nom requis');
      return;
    }
    try {
      App.showLoading();
      await Documents.renameDossier(id, nom);
      this._renamingDossierId = null;
      Modal.hide('modal-rename-dossier');
      Toast.success('Répertoire renommé');
      this.refreshDocsChrome();
    } catch (e) {
      Toast.error(e.message || 'Erreur');
    } finally {
      App.hideLoading();
    }
  },

  confirmDeleteDossier(id) {
    const folder = Documents.dossiers.find((x) => x.id === id);
    if (!folder || !Permissions.canModifyDocumentFolder(folder)) return;
    if (folder.system_key === 'documents_divers' || folder.system_key === 'comptes_rendus_reunion') {
      Toast.error('Ce dossier racine est obligatoire et ne peut pas être supprimé.');
      return;
    }
    Modal.confirm(
      'Supprimer le répertoire',
      'Le répertoire doit être vide (aucun sous-répertoire ni fichier). Continuer ?',
      async () => {
        try {
          App.showLoading();
          await Documents.deleteDossier(id);
          if (this.currentDossierId === id) this.currentDossierId = null;
          Toast.success('Répertoire supprimé');
          this.refreshDocsChrome();
        } catch (e) {
          Toast.error(e.message || 'Erreur');
        } finally {
          App.hideLoading();
        }
      }
    );
  },

  showUploadModal() {
    document.getElementById('form-upload-doc').reset();
    document.getElementById('file-selected').style.display = 'none';
    document.querySelector('.file-upload-content').style.display = 'block';
    const dossierSel = document.getElementById('doc-dossier');
    if (dossierSel) {
      dossierSel.innerHTML = Documents.getDossierSelectOptionsHtml(this.currentDossierId, {
        forUpload: true,
        includeRoot: false
      });
    }
    Modal.show('modal-upload-doc');
  },

  onFileSelect(input) {
    const file = input.files[0];
    if (file) {
      if (file.size > Documents.MAX_FILE_BYTES) {
        Toast.error(`Le fichier est trop volumineux (max ${Math.round(Documents.MAX_FILE_BYTES / (1024 * 1024))} Mo)`);
        input.value = '';
        return;
      }

      document.getElementById('file-selected-name').textContent = file.name;
      document.getElementById('file-selected').style.display = 'flex';
      document.querySelector('.file-upload-content').style.display = 'none';
      
      // Pré-remplir le titre si vide
      const titreInput = document.getElementById('doc-titre');
      if (!titreInput.value) {
        titreInput.value = file.name.replace(/\.[^/.]+$/, ''); // Sans extension
      }
    }
  },

  removeFile() {
    document.getElementById('doc-file').value = '';
    document.getElementById('file-selected').style.display = 'none';
    document.querySelector('.file-upload-content').style.display = 'block';
  },

  async submitUpload(event) {
    event.preventDefault();

    const fileInput = document.getElementById('doc-file');
    const file = fileInput.files[0];

    if (!file) {
      Toast.error('Veuillez sélectionner un fichier');
      return;
    }

    const dossierEl = document.getElementById('doc-dossier');
    const dossierRaw = dossierEl ? dossierEl.value.trim() : '';
    if (!dossierRaw) {
      Toast.error('Choisissez un répertoire pour ranger le fichier');
      return;
    }
    const metadata = {
      titre: document.getElementById('doc-titre').value.trim(),
      description: document.getElementById('doc-description').value.trim(),
      categorie: Documents.getCategorieForFolderId(dossierRaw),
      visibilite: document.querySelector('input[name="doc-visibilite"]:checked').value,
      dossier_id: dossierRaw
    };

    try {
      await Documents.upload(file, metadata);
      Modal.hide('modal-upload-doc');
      this.refreshDocsChrome();
    } catch (error) {
      // Erreur gérée
    }
  },

  deleteDoc(id) {
    Modal.confirm(
      'Supprimer le document',
      'Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.',
      async () => {
        if (await Documents.delete(id)) {
          this.refreshDocsChrome();
        }
      }
    );
  }
};
