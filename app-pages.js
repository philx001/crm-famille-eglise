// ============================================
// RENDU DES PAGES
// ============================================

const Pages = {
  renderLogin() {
    const savedFamille = localStorage.getItem('crm_famille_nom') || '';
    
    return `
      <div class="login-page">
        <div class="login-container">
          <div class="login-card">
            <div class="login-header">
              <div class="login-logo">✝️</div>
              <h1 class="login-title">CRM Famille</h1>
              <p class="login-subtitle">Gestion des groupes de disciples</p>
            </div>
            
            <form class="login-form" id="login-form">
              <div class="form-group">
                <label class="form-label required">Nom de la famille</label>
                <input type="text" class="form-control" id="login-famille" 
                       placeholder="Ex: Famille Espérance" value="${Utils.escapeHtml(savedFamille)}" required>
                <span class="form-hint">Le nom de votre groupe (fourni par votre Berger)</span>
              </div>
              
              <div class="form-group">
                <label class="form-label required">Email</label>
                <input type="email" class="form-control" id="login-email" 
                       placeholder="votre@email.com" required>
              </div>
              
              <div class="form-group">
                <label class="form-label required">Mot de passe</label>
                <input type="password" class="form-control" id="login-password" 
                       placeholder="••••••••" required>
              </div>
              
              <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">
                <i class="fas fa-sign-in-alt"></i> Se connecter
              </button>
            </form>
            
            <div class="login-footer">
              <a href="#" onclick="App.showForgotPassword(); return false;">Mot de passe oublié ?</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderMembres() {
    let membres = AppState.membres.filter(m => m.statut_compte === 'actif');
    
    if (!Permissions.canViewAllMembers()) {
      membres = membres.filter(m => 
        m.id === AppState.user.id || 
        m.mentor_id === AppState.user.id
      );
    }

    return `
      <div class="members-header">
        <div class="members-filters">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" class="form-control" id="search-membres" 
                   placeholder="Rechercher un membre..." onkeyup="App.filterMembres()">
          </div>
          <select class="form-control" id="filter-role" onchange="App.filterMembres()" style="width: auto;">
            <option value="">Tous les rôles</option>
            <option value="disciple">Disciples</option>
            <option value="nouveau">Nouveaux</option>
            <option value="mentor">Mentors</option>
            <option value="adjoint_berger">Adjoints</option>
            <option value="berger">Bergers</option>
          </select>
        </div>
        ${Permissions.canViewAllMembers() ? `
        <button type="button" class="btn btn-outline" onclick="App.exportMembresCSV()" title="Télécharger la liste en CSV">
          <i class="fas fa-file-download"></i> Exporter CSV
        </button>
        <button type="button" class="btn btn-outline" onclick="App.exportMembresPDF()" title="Ouvrir la liste pour impression ou enregistrement en PDF">
          <i class="fas fa-file-pdf"></i> Exporter PDF
        </button>
        ` : ''}
        ${Permissions.canAddDisciple() ? `
        <button class="btn btn-primary" onclick="App.navigate('membres-add')">
          <i class="fas fa-user-plus"></i> Ajouter
        </button>
        ` : ''}
      </div>
      
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div id="membres-list">
            ${membres.length > 0 ? membres.map(m => this.renderMembreCard(m)).join('') : `
              <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>Aucun membre</h3>
                <p>Il n'y a pas encore de membre dans cette famille.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  getMentorLabelForMember(membre) {
    if (!Permissions.canViewAllMembers()) return null;
    const role = membre.role;
    if (role === 'berger' || role === 'admin') return null;
    if (role === 'nouveau') return 'Non Affecté';
    const bergerOfFamily = AppState.membres.find(m => m.role === 'berger');
    const mentor = membre.mentor_id ? Membres.getById(membre.mentor_id) : null;
    if (role === 'disciple') {
      return mentor ? `${mentor.prenom} ${mentor.nom}` : 'Non Affecté';
    }
    if (role === 'mentor' || role === 'adjoint_berger') {
      if (!mentor) return bergerOfFamily ? `${bergerOfFamily.prenom} ${bergerOfFamily.nom}` : 'Non Affecté';
      if (mentor.role === 'berger') return `${mentor.prenom} ${mentor.nom}`;
      return `${mentor.prenom} ${mentor.nom}`;
    }
    return mentor ? `${mentor.prenom} ${mentor.nom}` : 'Non Affecté';
  },

  renderMembreCard(membre) {
    const mentor = membre.mentor_id ? Membres.getById(membre.mentor_id) : null;
    const mentorLabel = this.getMentorLabelForMember(membre);
    const isBirthday = Utils.isBirthday(membre.date_naissance);
    const avatarStyle = membre.photo_url
      ? `background-image: url('${Utils.escapeHtml(membre.photo_url)}'); background-size: cover; background-position: center;`
      : `background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'}`;

    return `
      <div class="member-card" data-id="${membre.id}" data-role="${membre.role}" 
           data-name="${(membre.prenom + ' ' + membre.nom).toLowerCase()}">
        <div class="member-avatar" style="${avatarStyle}">
          ${!membre.photo_url ? Utils.getInitials(membre.prenom, membre.nom) : ''}
        </div>
        <div class="member-info">
          <div class="member-name">
            ${isBirthday ? '🎂 ' : ''}${Utils.escapeHtml(membre.prenom)} ${Utils.escapeHtml(membre.nom)}
          </div>
          <div class="member-email">${Utils.escapeHtml(membre.email)}</div>
        </div>
        <div class="member-meta">
          <span class="badge badge-${membre.role}">${Utils.getRoleLabel(membre.role)}</span>
          ${mentorLabel !== null ? `<span class="member-mentor-badge" style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px; white-space: nowrap;" title="Mentor">${Utils.escapeHtml(mentorLabel)}</span>` : ''}
        </div>
        <div class="member-actions">
          <button class="btn btn-icon btn-secondary" onclick="App.viewMembre('${membre.id}')" title="Voir">
            <i class="fas fa-eye"></i>
          </button>
          ${Permissions.canEditMember(membre.id) ? `
          <button class="btn btn-icon btn-secondary" onclick="App.editMembre('${membre.id}')" title="Modifier">
            <i class="fas fa-edit"></i>
          </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  renderAddMembre() {
    const mentors = Membres.getMentors();
    const canAddNouveau = Permissions.canAddNouveau();
    const isAdminOrBerger = Permissions.hasRole('berger') || Permissions.isAdmin();

    return `
      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-plus"></i> Ajouter un membre</h3>
        </div>
        <div class="card-body">
          <form id="form-add-membre" onsubmit="App.submitAddMembre(event)">
            <div class="form-group">
              <label class="form-label required">Prénom</label>
              <input type="text" class="form-control" id="membre-prenom" required>
            </div>
            
            <div class="form-group">
              <label class="form-label required">Nom</label>
              <input type="text" class="form-control" id="membre-nom" required>
            </div>
            
            <div class="form-group">
              <label class="form-label required">Email</label>
              <input type="email" class="form-control" id="membre-email" required>
            </div>
            
            <div class="form-group">
              <label class="form-label required">Rôle</label>
              <select class="form-control" id="membre-role" required onchange="App.toggleMentorField()">
                <option value="disciple">Disciple</option>
                ${canAddNouveau ? '<option value="nouveau">Nouveau (sans mentor)</option>' : ''}
                ${isAdminOrBerger ? `
                  <option value="mentor">Mentor</option>
                  <option value="adjoint_berger">Adjoint Berger</option>
                  <option value="berger">Berger</option>
                ` : ''}
              </select>
            </div>
            
            <div class="form-group" id="mentor-group">
              <label class="form-label">Mentor</label>
              <select class="form-control" id="membre-mentor">
                <option value="${AppState.user.id}">Moi-même (${Utils.escapeHtml(AppState.user.prenom)})</option>
                ${isAdminOrBerger ? mentors
                  .filter(m => m.id !== AppState.user.id)
                  .map(m => `<option value="${m.id}">${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)}</option>`)
                  .join('') : ''}
              </select>
              <span class="form-hint">Optionnel pour les rôles Mentor et supérieurs</span>
            </div>
            
            <div class="d-flex gap-2" style="justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="App.navigate('membres')">Annuler</button>
              <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  renderProfil(membreId = null) {
    const membre = membreId ? Membres.getById(membreId) : AppState.user;
    if (!membre) return '<div class="alert alert-danger">Membre non trouvé</div>';

    const canEdit = Permissions.canEditMember(membre.id);
    const mentor = membre.mentor_id ? Membres.getById(membre.mentor_id) : null;

    return `
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <div class="card-header">
          <div class="d-flex align-center gap-2">
            <div class="member-avatar" style="width: 60px; height: 60px; font-size: 1.5rem; ${membre.photo_url ? `background-image: url('${Utils.escapeHtml(membre.photo_url)}'); background-size: cover; background-position: center;` : `background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'}`}">
              ${!membre.photo_url ? Utils.getInitials(membre.prenom, membre.nom) : ''}
            </div>
            <div>
              <h3 class="card-title mb-0">${Utils.escapeHtml(membre.prenom)} ${Utils.escapeHtml(membre.nom)}</h3>
              <span class="badge badge-${membre.role}">${Utils.getRoleLabel(membre.role)}</span>
            </div>
          </div>
          <div class="d-flex gap-2">
            ${canEdit ? `
            <button class="btn btn-primary" onclick="App.editMembre('${membre.id}')">
              <i class="fas fa-edit"></i> Modifier
            </button>
            ` : ''}
            ${membre.id === AppState.user.id ? `
            <button type="button" class="btn btn-outline" onclick="App.navigate('mon-compte'); return false;">
              <i class="fas fa-user-cog"></i> Mon compte
            </button>
            ` : ''}
          </div>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--spacing-lg);">
            <div>
              <h4 class="mb-2">Informations personnelles</h4>
              <p><strong>Email:</strong> ${Utils.escapeHtml(membre.email)}</p>
              <p><strong>Téléphone:</strong> ${membre.telephone || '-'}</p>
              <p><strong>Sexe:</strong> ${membre.sexe === 'M' ? 'Homme' : membre.sexe === 'F' ? 'Femme' : '-'}</p>
              <p><strong>Date de naissance:</strong> ${Utils.formatDate(membre.date_naissance) || '-'}</p>
              <p><strong>Ville:</strong> ${membre.adresse_ville || '-'} ${membre.adresse_code_postal || ''}</p>
            </div>
            
            <div>
              <h4 class="mb-2">Parcours spirituel</h4>
              <p><strong>Mentor:</strong> ${mentor ? `${mentor.prenom} ${mentor.nom}` : '-'}</p>
              <p><strong>Arrivée ICC:</strong> ${Utils.formatDate(membre.date_arrivee_icc) || '-'}</p>
              <p><strong>Formations:</strong> ${membre.formations?.length > 0 ? membre.formations.join(', ') : '-'}</p>
              <p><strong>Ministère:</strong> ${membre.ministere_service || '-'}</p>
              <p><strong>Baptisé (immersion):</strong> ${membre.baptise_immersion === true ? 'Oui' : membre.baptise_immersion === false ? 'Non' : '-'}</p>
            </div>
            
            <div>
              <h4 class="mb-2">Annuaire</h4>
              <p><strong>Profession:</strong> ${membre.profession || '-'}</p>
              <p><strong>Statut:</strong> ${membre.statut_professionnel ? Utils.capitalize(membre.statut_professionnel.replace('_', ' ')) : '-'}</p>
              <p><strong>Centres d'intérêt:</strong> ${membre.passions_centres_interet || '-'}</p>
            </div>
          </div>
        </div>
        <div class="card-footer text-muted" style="font-size: 0.85rem;">
          Inscrit le ${Utils.formatDate(membre.created_at, 'full')}
          ${membre.derniere_connexion ? ` • Dernière connexion: ${Utils.formatRelativeDate(membre.derniere_connexion)}` : ''}
        </div>
      </div>
    `;
  },

  renderProfilEdit(membreId = null) {
    const membre = membreId ? Membres.getById(membreId) : AppState.user;
    if (!membre) return '<div class="alert alert-danger">Membre non trouvé</div>';

    const formations = ['BDR', '101', '201', 'IEBI', 'Poimano'];
    const membreFormations = membre.formations || [];

    const getDateValue = (date) => {
      if (!date) return '';
      const d = date.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    };

    return `
      <div class="card" style="max-width: 700px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-edit"></i> Modifier le profil</h3>
        </div>
        <div class="card-body">
          <form id="form-edit-profil" onsubmit="App.submitEditProfil(event, '${membre.id}')">
            <h4 class="mb-2">Informations personnelles</h4>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
              <div class="form-group">
                <label class="form-label required">Prénom</label>
                <input type="text" class="form-control" id="edit-prenom" value="${Utils.escapeHtml(membre.prenom)}" required>
              </div>
              <div class="form-group">
                <label class="form-label required">Nom</label>
                <input type="text" class="form-control" id="edit-nom" value="${Utils.escapeHtml(membre.nom)}" required>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Sexe</label>
              <select class="form-control" id="edit-sexe">
                <option value="">-- Sélectionner --</option>
                <option value="M" ${membre.sexe === 'M' ? 'selected' : ''}>Homme</option>
                <option value="F" ${membre.sexe === 'F' ? 'selected' : ''}>Femme</option>
              </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
              <div class="form-group">
                <label class="form-label">Date de naissance</label>
                <input type="date" class="form-control" id="edit-date-naissance" value="${getDateValue(membre.date_naissance)}">
              </div>
              <div class="form-group">
                <label class="form-label">Téléphone</label>
                <input type="tel" class="form-control" id="edit-telephone" value="${membre.telephone || ''}">
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--spacing-md);">
              <div class="form-group">
                <label class="form-label">Ville</label>
                <input type="text" class="form-control" id="edit-ville" value="${membre.adresse_ville || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Code postal</label>
                <input type="text" class="form-control" id="edit-cp" value="${membre.adresse_code_postal || ''}">
              </div>
            </div>
            
            <hr style="margin: var(--spacing-lg) 0;">
            <h4 class="mb-2">Parcours spirituel</h4>
            
            <div class="form-group">
              <label class="form-label">Date d'arrivée à ICC</label>
              <input type="date" class="form-control" id="edit-date-icc" value="${getDateValue(membre.date_arrivee_icc)}">
            </div>
            
            <div class="form-group">
              <label class="form-label">Formations suivies</label>
              <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-md);">
                ${formations.map(f => `
                  <div class="form-check">
                    <input type="checkbox" id="formation-${f}" value="${f}" ${membreFormations.includes(f) ? 'checked' : ''}>
                    <label for="formation-${f}">${f}</label>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Ministère / Service</label>
              <input type="text" class="form-control" id="edit-ministere" value="${membre.ministere_service || ''}">
            </div>
            
            <div class="form-group">
              <label class="form-label">Baptisé par immersion ?</label>
              <select class="form-control" id="edit-baptise">
                <option value="">-- Sélectionner --</option>
                <option value="true" ${membre.baptise_immersion === true ? 'selected' : ''}>Oui</option>
                <option value="false" ${membre.baptise_immersion === false ? 'selected' : ''}>Non</option>
              </select>
            </div>
            
            <hr style="margin: var(--spacing-lg) 0;">
            <h4 class="mb-2">Informations annuaire</h4>
            
            <div class="form-group">
              <label class="form-label">Profession</label>
              <input type="text" class="form-control" id="edit-profession" value="${membre.profession || ''}">
            </div>
            
            <div class="form-group">
              <label class="form-label">Statut professionnel</label>
              <select class="form-control" id="edit-statut-pro">
                <option value="">-- Sélectionner --</option>
                <option value="emploi" ${membre.statut_professionnel === 'emploi' ? 'selected' : ''}>En emploi</option>
                <option value="etudiant" ${membre.statut_professionnel === 'etudiant' ? 'selected' : ''}>Étudiant</option>
                <option value="recherche_emploi" ${membre.statut_professionnel === 'recherche_emploi' ? 'selected' : ''}>En recherche d'emploi</option>
                <option value="autre" ${membre.statut_professionnel === 'autre' ? 'selected' : ''}>Autre</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Passions / Centres d'intérêt</label>
              <textarea class="form-control" id="edit-passions" rows="3">${membre.passions_centres_interet || ''}</textarea>
            </div>
            
            <div class="d-flex gap-2" style="justify-content: flex-end; margin-top: var(--spacing-lg);">
              <button type="button" class="btn btn-secondary" onclick="App.navigate('profil')">Annuler</button>
              <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  renderMonCompte() {
    const membre = AppState.user;
    if (!membre) return '<div class="alert alert-danger">Utilisateur non connecté</div>';

    const photoUrl = membre.photo_url || null;
    const avatarStyle = photoUrl 
      ? `background-image: url('${photoUrl}'); background-size: cover; background-position: center;`
      : `background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'};`;

    return `
      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-cog"></i> Mon compte</h3>
        </div>
        <div class="card-body">
          <div style="margin-bottom: var(--spacing-xl);">
            <h4 class="mb-3">Photo de profil</h4>
            <div style="display: flex; align-items: center; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
            <div class="member-avatar" id="avatar-profil-preview" style="width: 100px; height: 100px; font-size: 2.5rem; ${avatarStyle}">
              ${!photoUrl ? Utils.getInitials(membre.prenom, membre.nom) : ''}
            </div>
              <div style="flex: 1;">
                <input type="file" id="photo-profil-input" accept="image/*" style="display: none;" onchange="App.handlePhotoUpload(event)">
                <button type="button" class="btn btn-primary" onclick="document.getElementById('photo-profil-input').click()">
                  <i class="fas fa-upload"></i> ${photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                ${photoUrl ? `
                <button type="button" class="btn btn-outline" onclick="App.deletePhotoProfil()" style="margin-left: var(--spacing-sm);">
                  <i class="fas fa-trash"></i> Supprimer
                </button>
                ` : ''}
                <p class="text-muted" style="margin-top: var(--spacing-sm); font-size: 0.85rem;">
                  Formats acceptés: JPG, PNG, GIF, WebP uniquement (max 5MB). Les PDF et autres documents ne sont pas acceptés.
                </p>
              </div>
            </div>
          </div>

          <hr style="margin: var(--spacing-lg) 0;">

          <div style="margin-bottom: var(--spacing-xl);">
            <h4 class="mb-2">Informations de connexion</h4>
            <p><strong>Email:</strong> ${Utils.escapeHtml(membre.email)}</p>
            <p><strong>Nom:</strong> ${Utils.escapeHtml(membre.prenom)} ${Utils.escapeHtml(membre.nom)}</p>
            <p><strong>Rôle:</strong> <span class="badge badge-${membre.role}">${Utils.getRoleLabel(membre.role)}</span></p>
          </div>

          <hr style="margin: var(--spacing-lg) 0;">

          <h4 class="mb-3">Changer mon mot de passe</h4>
          <form id="form-change-password" onsubmit="App.submitChangePassword(event)">
            <div class="form-group">
              <label class="form-label required">Mot de passe actuel</label>
              <input type="password" class="form-control" id="current-password" required 
                     placeholder="Entrez votre mot de passe actuel" autocomplete="current-password">
            </div>
            
            <div class="form-group">
              <label class="form-label required">Nouveau mot de passe</label>
              <input type="password" class="form-control" id="new-password" required 
                     placeholder="Minimum 6 caractères" autocomplete="new-password" minlength="6">
              <small class="form-text text-muted">Le mot de passe doit contenir au moins 6 caractères.</small>
            </div>
            
            <div class="form-group">
              <label class="form-label required">Confirmer le nouveau mot de passe</label>
              <input type="password" class="form-control" id="confirm-password" required 
                     placeholder="Répétez le nouveau mot de passe" autocomplete="new-password" minlength="6">
            </div>
            
            <div class="d-flex gap-2" style="justify-content: flex-end; margin-top: var(--spacing-lg);">
              <button type="button" class="btn btn-secondary" onclick="App.navigate('profil')">Annuler</button>
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-key"></i> Changer le mot de passe
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  renderAnnuaire() {
    const membres = AppState.membres
      .filter(m => m.statut_compte === 'actif')
      .sort((a, b) => a.nom.localeCompare(b.nom));

    return `
      <div class="members-header">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" class="form-control" id="search-annuaire" 
                 placeholder="Rechercher..." onkeyup="App.filterAnnuaire()">
        </div>
      </div>
      
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div id="annuaire-list">
            ${membres.map(m => {
              const isBirthday = Utils.isBirthday(m.date_naissance);
              let birthDisplay = '-';
              if (m.date_naissance) {
                const d = m.date_naissance.toDate ? m.date_naissance.toDate() : new Date(m.date_naissance);
                if (!isNaN(d.getTime())) {
                  birthDisplay = `${d.getDate()} ${d.toLocaleString('fr-FR', { month: 'long' })}`;
                }
              }
              
              const avatarStyleAnnuaire = m.photo_url
                ? `background-image: url('${Utils.escapeHtml(m.photo_url)}'); background-size: cover; background-position: center; position: relative;`
                : `background: ${m.sexe === 'F' ? '#E91E63' : 'var(--primary)'}; position: relative;`;
              return `
                <div class="member-card" data-name="${(m.prenom + ' ' + m.nom).toLowerCase()}">
                  <div class="member-avatar ${isBirthday ? 'birthday-glow' : ''}" 
                       style="${avatarStyleAnnuaire}">
                    ${!m.photo_url ? Utils.getInitials(m.prenom, m.nom) : ''}
                    ${isBirthday ? '<span class="birthday-badge">🎂</span>' : ''}
                  </div>
                  <div class="member-info" style="flex: 2;">
                    <div class="member-name ${isBirthday ? 'birthday-name' : ''}">
                      ${isBirthday ? '🎂 ' : ''}${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)}
                    </div>
                    <div class="text-muted" style="font-size: 0.85rem;">
                      <i class="fas fa-calendar-alt"></i> ${birthDisplay}
                    </div>
                  </div>
                  <div style="flex: 1;">
                    <div style="font-size: 0.9rem;">${m.profession || '-'}</div>
                    <div class="text-muted" style="font-size: 0.8rem;">
                      ${m.statut_professionnel ? Utils.capitalize(m.statut_professionnel.replace('_', ' ')) : ''}
                    </div>
                  </div>
                  <div style="flex: 1.5;">
                    <div class="text-muted" style="font-size: 0.85rem;">
                      <i class="fas fa-heart"></i> ${m.passions_centres_interet || '-'}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <style>
        .birthday-glow { animation: glow 1.5s ease-in-out infinite alternate; }
        .birthday-badge { position: absolute; top: -5px; right: -5px; font-size: 1.2rem; }
        .birthday-name { color: var(--secondary); font-weight: 700; }
        @keyframes glow {
          from { box-shadow: 0 0 5px var(--secondary); }
          to { box-shadow: 0 0 15px var(--secondary); }
        }
      </style>
    `;
  },

  renderStatistiques() {
    const stats = Membres.getStats();
    const mesDisciples = Permissions.hasRole('mentor') ? Membres.getDisciples(AppState.user.id) : [];
    
    return `
      <div class="alert alert-info mb-3">
        <i class="fas fa-info-circle"></i>
        <div class="alert-content">
          <div class="alert-title">Module Statistiques</div>
          <p class="mb-0">Les statistiques détaillées de présence seront disponibles dans la Phase 2 avec le module Programmes.</p>
        </div>
      </div>
      
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fas fa-users"></i></div>
          <div class="stat-content">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total membres actifs</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon success"><i class="fas fa-user-graduate"></i></div>
          <div class="stat-content">
            <div class="stat-value">${stats.parRole.disciples}</div>
            <div class="stat-label">Disciples</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon warning"><i class="fas fa-user-plus"></i></div>
          <div class="stat-content">
            <div class="stat-value">${stats.parRole.nouveaux}</div>
            <div class="stat-label">Nouveaux</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon info"><i class="fas fa-chalkboard-teacher"></i></div>
          <div class="stat-content">
            <div class="stat-value">${stats.parRole.mentors}</div>
            <div class="stat-label">Mentors</div>
          </div>
        </div>
      </div>
      
      ${Permissions.hasRole('berger') ? `
      <div class="card mt-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-chart-pie"></i> Répartition par mentor</h3>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Nombre de disciples</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                ${Membres.getMentors().map(m => {
                  const disciples = Membres.getDisciples(m.id);
                  const percent = stats.total > 0 ? ((disciples.length / stats.total) * 100).toFixed(1) : 0;
                  return `
                    <tr>
                      <td>${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)}</td>
                      <td>${disciples.length}</td>
                      <td>${percent}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ` : ''}
    `;
  }
};
