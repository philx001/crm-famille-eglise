// ============================================
// MODULE DOCUMENTS
// Phase 4 - Gestion des documents partagés
// ============================================

const Documents = {
  items: [],

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
      { value: 'mentors_berger', label: 'Mentors et Berger', icon: 'fa-user-shield', description: 'Mentors, adjoints et berger uniquement' },
      { value: 'berger_seul', label: 'Berger uniquement', icon: 'fa-lock', description: 'Accès réservé au berger' }
    ];
  },

  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

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
    if (doc.visibilite === 'mentors_berger' && Permissions.hasRole('mentor')) return true;
    if (doc.visibilite === 'berger_seul' && Permissions.hasRole('berger')) return true;
    return false;
  },

  async upload(file, metadata) {
    try {
      if (!Permissions.canManageDocuments()) {
        throw new Error('Permission refusée');
      }

      App.showLoading();

      // Upload vers Firebase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = storage.ref(`documents/${AppState.famille.id}/${fileName}`);
      
      const uploadTask = await storageRef.put(file);
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Créer le document dans Firestore
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

  async delete(id) {
    try {
      if (!Permissions.canManageDocuments()) {
        throw new Error('Permission refusée');
      }

      const doc = this.items.find(d => d.id === id);
      if (!doc) throw new Error('Document non trouvé');

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

      Toast.success('Document supprimé');
      return true;
    } catch (error) {
      console.error('Erreur suppression document:', error);
      Toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
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
  currentCategorie: 'all',

  async render() {
    await Documents.loadAll();

    const categories = Documents.getCategories();
    const canManage = Permissions.canManageDocuments();

    return `
      <div class="docs-header">
        <div class="docs-filters">
          <button class="btn ${this.currentCategorie === 'all' ? 'btn-primary' : 'btn-secondary'}"
                  onclick="PagesDocuments.setCategorie('all')">
            <i class="fas fa-folder"></i> Tous
          </button>
          ${categories.map(c => `
            <button class="btn ${this.currentCategorie === c.value ? 'btn-primary' : 'btn-secondary'}"
                    onclick="PagesDocuments.setCategorie('${c.value}')">
              <i class="fas ${c.icon}"></i> ${c.label}
            </button>
          `).join('')}
        </div>
        ${canManage ? `
          <button class="btn btn-primary" onclick="PagesDocuments.showUploadModal()">
            <i class="fas fa-upload"></i> Ajouter un document
          </button>
        ` : ''}
      </div>

      <div class="docs-list" id="docs-list">
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
              <div class="form-group">
                <label class="form-label required">Fichier</label>
                <div class="file-upload-zone" id="file-upload-zone">
                  <input type="file" id="doc-file" required onchange="PagesDocuments.onFileSelect(this)">
                  <div class="file-upload-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Cliquez ou glissez un fichier ici</p>
                    <span class="file-upload-hint">PDF, Word, Excel, Images... (max 10 MB)</span>
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
                <label class="form-label required">Catégorie</label>
                <select class="form-control" id="doc-categorie" required>
                  ${categories.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
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

      <style>
        .docs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
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
  },

  renderDocsList() {
    let docs = this.currentCategorie === 'all' 
      ? Documents.items 
      : Documents.getByCategorie(this.currentCategorie);

    if (docs.length === 0) {
      return `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fas fa-folder-open"></i>
          <h3>Aucun document</h3>
          <p>Il n'y a pas encore de document dans cette catégorie.</p>
        </div>
      `;
    }

    return docs.map(d => this.renderDocCard(d)).join('');
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
    const canDelete = Permissions.canManageDocuments();

    return `
      <div class="doc-card">
        <div class="doc-icon ${iconClass}">
          <i class="fas ${fileIcon}"></i>
        </div>
        <div class="doc-titre">${Utils.escapeHtml(doc.titre)}</div>
        ${doc.description ? `<div class="doc-description">${Utils.escapeHtml(doc.description)}</div>` : '<div class="doc-description"></div>'}
        <div style="margin-bottom: var(--spacing-sm);">
          <span class="doc-badge"><i class="fas ${visibilite?.icon || 'fa-eye'}"></i> ${visibilite?.label || doc.visibilite}</span>
          <span class="doc-badge">${Documents.formatFileSize(doc.fichier_taille || 0)}</span>
        </div>
        <div class="doc-meta">
          <span><i class="fas fa-user"></i> ${uploader ? uploader.prenom : 'Inconnu'} • ${Utils.formatRelativeDate(date)}</span>
          <div class="doc-actions">
            <a href="${doc.fichier_url}" target="_blank" class="btn btn-sm btn-primary" title="Télécharger">
              <i class="fas fa-download"></i>
            </a>
            ${canDelete ? `
              <button class="btn btn-sm btn-secondary" onclick="PagesDocuments.deleteDoc('${doc.id}')" title="Supprimer">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  setCategorie(categorie) {
    this.currentCategorie = categorie;
    document.querySelectorAll('.docs-filters .btn').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    });
    event.target.classList.remove('btn-secondary');
    event.target.classList.add('btn-primary');
    document.getElementById('docs-list').innerHTML = this.renderDocsList();
  },

  showUploadModal() {
    document.getElementById('form-upload-doc').reset();
    document.getElementById('file-selected').style.display = 'none';
    document.querySelector('.file-upload-content').style.display = 'block';
    Modal.show('modal-upload-doc');
  },

  onFileSelect(input) {
    const file = input.files[0];
    if (file) {
      // Vérifier la taille (10 MB max)
      if (file.size > 10 * 1024 * 1024) {
        Toast.error('Le fichier est trop volumineux (max 10 MB)');
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

    const metadata = {
      titre: document.getElementById('doc-titre').value.trim(),
      description: document.getElementById('doc-description').value.trim(),
      categorie: document.getElementById('doc-categorie').value,
      visibilite: document.querySelector('input[name="doc-visibilite"]:checked').value
    };

    try {
      await Documents.upload(file, metadata);
      Modal.hide('modal-upload-doc');
      document.getElementById('docs-list').innerHTML = this.renderDocsList();
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
          document.getElementById('docs-list').innerHTML = this.renderDocsList();
        }
      }
    );
  }
};
