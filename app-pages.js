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
              <h1 class="login-title">Familles de Disciples - ICC</h1>
              <p class="login-subtitle">Gestion des Groupes de Disciples</p>
            </div>
            
            <form class="login-form" id="login-form">
              <div class="form-group">
                <label class="form-label required" for="login-famille">Famille</label>
                <select class="form-control" id="login-famille" required aria-describedby="login-famille-hint">
                  <option value="">Choisir une famille...</option>
                </select>
                <span id="login-famille-hint" class="form-hint">Le nom de votre groupe (fourni par votre superviseur)</span>
              </div>
              
              <div class="form-group">
                <label class="form-label required" for="login-email">Email</label>
                <input type="email" class="form-control" id="login-email" 
                       placeholder="votre@email.com" required>
              </div>
              
              <div class="form-group">
                <label class="form-label required" for="login-password">Mot de passe</label>
                <div class="password-input-wrap">
                  <input type="password" class="form-control" id="login-password" 
                         placeholder="••••••••" required autocomplete="current-password">
                  <button type="button" class="password-toggle-btn" onclick="App.toggleLoginPasswordVisibility(this)" aria-label="Afficher le mot de passe" title="Afficher / masquer le mot de passe">
                    <i class="fas fa-eye" aria-hidden="true"></i>
                  </button>
                </div>
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
    const isMesDisciples = AppState.currentPage === 'mes-disciples';
    const canSeeFullList = Permissions.canViewAllMembers() || Permissions.canViewMembersListReadOnly();

    if (canSeeFullList) {
      if (isMesDisciples) {
        membres = membres.filter(m => m.mentor_id === AppState.user.id);
      }
    } else {
      membres = membres.filter(m => m.mentor_id === AppState.user.id);
    }

    // Export : superviseur/admin sur "Tous les membres", ou mentor sur "Mes disciples"
    const showExportButtons = Permissions.canViewAllMembers() || (isMesDisciples && Permissions.hasRole('mentor'));

    const integresParPeriode = (typeof NouvellesAmes !== 'undefined' && NouvellesAmes.getIntegresParPeriode)
      ? NouvellesAmes.getIntegresParPeriode()
      : { semaine: 0, mois: 0, trimestre: 0 };
    const statsIntegrationsSection = canSeeFullList && !isMesDisciples ? `
      <div class="card" style="margin-bottom: var(--spacing-lg);">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-plus"></i> Nouvelles âmes intégrées</h3>
        </div>
        <div class="card-body">
          <div class="stats-inline" style="display: flex; flex-wrap: wrap; gap: var(--spacing-lg); align-items: center;">
            <div><strong>Cette semaine :</strong> <span class="badge badge-primary">${integresParPeriode.semaine}</span></div>
            <div><strong>Ce mois :</strong> <span class="badge badge-primary">${integresParPeriode.mois}</span></div>
            <div><strong>Ce trimestre :</strong> <span class="badge badge-primary">${integresParPeriode.trimestre}</span></div>
          </div>
        </div>
      </div>
    ` : '';

    const statsSection = isMesDisciples && membres.length > 0 ? `
      <div class="disciples-stats-section" style="margin-bottom: var(--spacing-lg);">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-bar"></i> Statistiques de présence</h3>
          </div>
          <div class="card-body">
            <div style="min-height: 250px;">
              <canvas id="chart-disciples-presence" style="max-height: 240px;"></canvas>
            </div>
          </div>
        </div>
      </div>
    ` : '';

    return `
      ${statsIntegrationsSection}
      ${statsSection}
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
            <option value="adjoint_superviseur">Adjoints</option>
            <option value="superviseur">Superviseurs</option>
          </select>
          ${(Permissions.canViewAllMembers() || Permissions.canViewMembersListReadOnly()) && !isMesDisciples ? `
          <select class="form-control" id="filter-mentor" onchange="App.filterMembres()" style="width: auto;">
            <option value="">Tous les mentors</option>
            <option value="none">Non affecté</option>
            ${(AppState.membres || []).filter(m => m.statut_compte === 'actif' && ['mentor', 'adjoint_superviseur', 'superviseur'].includes(m.role)).map(m => `<option value="${m.id}">${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)}</option>`).join('')}
          </select>
          ` : ''}
        </div>
        ${showExportButtons ? `
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
    if (!Permissions.canViewAllMembers() && !Permissions.canViewMembersListReadOnly()) return null;
    const role = membre.role;
    if (role === 'superviseur' || role === 'admin') return null;
    if (role === 'nouveau') return 'Non Affecté';
    const superviseurOfFamily = AppState.membres.find(m => m.role === 'superviseur');
    const mentor = membre.mentor_id ? Membres.getById(membre.mentor_id) : null;
    if (role === 'disciple') {
      return mentor ? `${mentor.prenom} ${mentor.nom}` : 'Non Affecté';
    }
    if (role === 'mentor' || role === 'adjoint_superviseur') {
      if (!mentor) return superviseurOfFamily ? `${superviseurOfFamily.prenom} ${superviseurOfFamily.nom}` : 'Non Affecté';
      if (mentor.role === 'superviseur') return `${mentor.prenom} ${mentor.nom}`;
      return `${mentor.prenom} ${mentor.nom}`;
    }
    return mentor ? `${mentor.prenom} ${mentor.nom}` : 'Non Affecté';
  },

  renderMembreCard(membre) {
    const mentor = membre.mentor_id ? Membres.getById(membre.mentor_id) : null;
    const mentorLabel = this.getMentorLabelForMember(membre);
    const isBirthday = Utils.isBirthday(membre.date_naissance);
    const canReassign = Permissions.canReassignMentor(membre);
    const possibleMentors = canReassign ? Membres.getPossibleMentorsForReassign() : [];
    const avatarStyle = membre.photo_url
      ? `background-image: url('${Utils.escapeHtml(membre.photo_url)}'); background-size: cover; background-position: center;`
      : `background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'}`;

    const reassignSelect = canReassign && possibleMentors.length > 0 ? `
      <div class="member-reassign" style="margin-top: 6px;">
        <label class="text-muted" style="font-size: 0.75rem; display: block; margin-bottom: 2px;">Réaffecter à</label>
        <select class="form-control form-control-sm" style="max-width: 180px; font-size: 0.8rem;" 
                onchange="App.reassignMentor('${membre.id}', this.value)" title="Changer de mentor">
          <option value="">— Choisir —</option>
          <option value="none" ${!membre.mentor_id ? 'selected' : ''}>Non affecté</option>
          ${possibleMentors.filter(m => m.id !== membre.id).map(m => `
          <option value="${m.id}" ${membre.mentor_id === m.id ? 'selected' : ''}>${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)} (${Utils.getRoleLabel(m.role)})</option>
          `).join('')}
        </select>
      </div>
    ` : '';

    return `
      <div class="member-card" data-id="${membre.id}" data-role="${membre.role}" 
           data-name="${(membre.prenom + ' ' + membre.nom).toLowerCase()}" data-mentor-id="${membre.mentor_id || ''}">
        <div class="member-avatar" style="${avatarStyle}">
          ${!membre.photo_url ? Utils.getInitials(membre.prenom, membre.nom) : ''}
        </div>
        <div class="member-info">
          <div class="member-name">
            ${isBirthday ? '🎂 ' : ''}${Utils.escapeHtml(membre.prenom)} ${Utils.escapeHtml(membre.nom)}
          </div>
          <div class="member-email">${Permissions.isAdjointSuperviseurOnly() && membre.id !== AppState.user.id ? '—' : Utils.escapeHtml(membre.email)}</div>
          ${reassignSelect}
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
          ${Permissions.canBlockMember(membre) ? `
          <button class="btn btn-icon btn-outline" onclick="App.blockMembre('${membre.id}')" title="Bloquer et archiver">
            <i class="fas fa-lock"></i>
          </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  renderArchivesMembres() {
    if (!Permissions.canViewArchivesMembres()) {
      return '<div class="alert alert-warning">Accès non autorisé.</div>';
    }
    const archives = (AppState.membres || []).filter(m => m.statut_compte === 'inactif');
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-archive"></i> Archivage des membres</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-3">Membres dont le compte a été bloqué (archivés). Vous pouvez les débloquer à tout moment.</p>
          ${archives.length > 0 ? `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Date d'archivage</th>
                  <th>Commentaire</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${archives.map(m => {
                  const dateArch = m.date_archivage && (m.date_archivage.toDate ? m.date_archivage.toDate() : new Date(m.date_archivage));
                  const dateStr = dateArch && !isNaN(dateArch.getTime()) ? Utils.formatDate(dateArch, 'full') : '—';
                  const comment = (m.commentaire_archivage || '').trim() || '—';
                  return `
                <tr>
                  <td><strong>${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)}</strong></td>
                  <td>${Utils.escapeHtml(m.email)}</td>
                  <td><span class="badge badge-${m.role}">${Utils.getRoleLabel(m.role)}</span></td>
                  <td>${dateStr}</td>
                  <td style="max-width: 200px;">${Utils.escapeHtml(comment)}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-success" onclick="App.unblockMembre('${m.id}')" title="Débloquer le compte">
                      <i class="fas fa-unlock"></i> Débloquer
                    </button>
                    <button type="button" class="btn btn-sm btn-outline" onclick="App.viewMembre('${m.id}')" title="Voir le profil"><i class="fas fa-eye"></i></button>
                  </td>
                </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          ` : `
          <div class="empty-state">
            <i class="fas fa-archive"></i>
            <h3>Aucun membre archivé</h3>
            <p>Les membres bloqués apparaîtront ici avec la date et le commentaire d'archivage.</p>
          </div>
          `}
        </div>
      </div>
    `;
  },

  renderAddMembre() {
    const mentors = Membres.getMentors();
    const canAddNouveau = Permissions.canAddNouveau();
    const isAdminOrSuperviseur = Permissions.hasRole('superviseur') || Permissions.isAdmin();

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
                ${isAdminOrSuperviseur ? `
                  <option value="mentor">Mentor</option>
                  <option value="adjoint_superviseur">Adjoint superviseur</option>
                  <option value="superviseur">Superviseur</option>
                ` : ''}
              </select>
            </div>
            
            <div class="form-group" id="mentor-group">
              <label class="form-label">Mentor</label>
              <select class="form-control" id="membre-mentor">
                <option value="${AppState.user.id}">Moi-même (${Utils.escapeHtml(AppState.user.prenom)})</option>
                ${isAdminOrSuperviseur ? mentors
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

    const isOwnProfil = membre.id === AppState.user.id;
    return `
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <div class="card-header" style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-md);">
          ${isOwnProfil ? `<button type="button" class="btn btn-outline btn-sm" onclick="App.navigate('mon-compte')"><i class="fas fa-arrow-left"></i> Retour vers Mon compte</button>` : ''}
          ${!isOwnProfil && Permissions.hasRole('mentor') ? `<button type="button" class="btn btn-outline btn-sm" onclick="App.navigate('mes-disciples')"><i class="fas fa-arrow-left"></i> Retour vers Mes disciples</button>` : ''}
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
            ${!isOwnProfil && Permissions.canBlockMember(membre) && membre.statut_compte === 'actif' ? `
            <button type="button" class="btn btn-outline btn-warning" onclick="App.blockMembre('${membre.id}')" title="Bloquer le compte et archiver">
              <i class="fas fa-lock"></i> Bloquer et archiver
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
              <p><strong>Formations:</strong> ${membre.formations?.length > 0 ? membre.formations.map(f => ({ 'RTT_301': 'RTT (301)' }[f] || f)).join(', ') : '-'}</p>
              <p><strong>Ministère:</strong> ${membre.ministere_service || '-'}</p>
              <p><strong>Baptisé (immersion):</strong> ${membre.baptise_immersion === true ? 'Oui' : membre.baptise_immersion === false ? 'Non' : '-'}</p>
            </div>
            
            <div>
              <h4 class="mb-2">Annuaire</h4>
              <p><strong>Pôle(s) interne(s):</strong> ${Utils.getPolesLabel(membre.pole_interne) || '-'}</p>
              <p><strong>Profession:</strong> ${membre.profession || '-'}</p>
              <p><strong>Statut:</strong> ${membre.statut_professionnel ? Utils.capitalize(membre.statut_professionnel.replace('_', ' ')) : '-'}</p>
              <p><strong>Centres d'intérêt:</strong> ${membre.passions_centres_interet || '-'}</p>
            </div>
          </div>

          ${NotesSuivi.canAddNote() && !(Permissions.isAdjointSuperviseurOnly() && !isOwnProfil) ? `
          <hr style="margin: var(--spacing-lg) 0;">
          <div id="notes-section-membre-${membre.id}">
            <h4 class="mb-2"><i class="fas fa-sticky-note"></i> Notes de suivi</h4>
            <div id="notes-list-membre-${membre.id}" class="notes-list" style="margin-bottom: var(--spacing-md);"></div>
            <div class="notes-add">
              <textarea class="form-control" id="note-input-membre-${membre.id}" rows="2" placeholder="Ajouter une note de suivi..."></textarea>
              <button type="button" class="btn btn-primary btn-sm" onclick="NotesSuivi.addNote('membre', '${membre.id}', document.getElementById('note-input-membre-${membre.id}').value)">
                <i class="fas fa-plus"></i> Ajouter
              </button>
            </div>
          </div>
          ` : ''}
        </div>
        <div class="card-footer text-muted" style="font-size: 0.85rem;">
          Inscrit le ${Utils.formatDate(membre.created_at, 'full')}
          ${membre.derniere_connexion ? ` • Dernière connexion: ${Utils.formatRelativeDate(membre.derniere_connexion)}` : ''}
        </div>
        <div class="rgpd-notice" style="margin-top: var(--spacing-lg); padding: var(--spacing-md); background: var(--bg-tertiary, #f5f5f5); border-radius: var(--radius-md); font-size: 0.8rem; color: var(--text-muted);">
          <strong>Données personnelles (RGPD)</strong><br>
          Les informations de ce profil sont strictement réservées à un usage interne et demeurent confidentielles. Chaque membre dispose d'un droit d'accès, de modification et de suppression de ses propres données personnelles.
        </div>
      </div>
    `;
  },

  renderProfilEdit(membreId = null) {
    const membre = membreId ? Membres.getById(membreId) : AppState.user;
    if (!membre) return '<div class="alert alert-danger">Membre non trouvé</div>';

    const formations = ['BDR', '101', '201', 'IEBI', 'Poimano', 'RTT_301'];
    const formationLabels = { 'RTT_301': 'RTT (301)' };
    const membreFormations = membre.formations || [];
    const today = new Date().toISOString().split('T')[0];
    const minDate = '1900-01-01';

    const getDateValue = (date) => {
      if (!date) return '';
      const d = date.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      if (y < 1900 || y > 2100) return '';
      return d.toISOString().split('T')[0];
    };

    return `
      <div class="card" style="max-width: 700px; margin: 0 auto;">
        <div class="card-header" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-md);">
          <h3 class="card-title mb-0"><i class="fas fa-user-edit"></i> Modifier le profil</h3>
          <div class="d-flex gap-2 profil-edit-actions">
            <button type="button" class="btn btn-secondary" onclick="App.navigate('profil')">Annuler</button>
            <button type="submit" form="form-edit-profil" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
          </div>
        </div>
        <div class="card-body">
          <form id="form-edit-profil" onsubmit="App.submitEditProfil(event, '${membre.id}')">
            ${Permissions.canEditMember(membre.id) && membre.id !== AppState.user.id && (Permissions.hasRole('superviseur') || Permissions.isAdmin()) ? `
            <h4 class="mb-2">Rôle et affectation</h4>
            <div class="form-group">
              <label class="form-label required">Rôle</label>
              <select class="form-control" id="edit-role" onchange="App.toggleMentorFieldEdit()">
                <option value="disciple" ${membre.role === 'disciple' ? 'selected' : ''}>Disciple</option>
                <option value="nouveau" ${membre.role === 'nouveau' ? 'selected' : ''}>Nouveau (sans mentor)</option>
                <option value="mentor" ${membre.role === 'mentor' ? 'selected' : ''}>Mentor</option>
                <option value="adjoint_superviseur" ${membre.role === 'adjoint_superviseur' ? 'selected' : ''}>Adjoint superviseur</option>
                <option value="superviseur" ${membre.role === 'superviseur' ? 'selected' : ''}>Superviseur</option>
                ${Permissions.isAdmin() ? `<option value="admin" ${membre.role === 'admin' ? 'selected' : ''}>Administrateur</option>` : ''}
              </select>
            </div>
            <div class="form-group" id="edit-mentor-group" style="display: ${['nouveau', 'mentor', 'adjoint_superviseur', 'superviseur', 'admin'].includes(membre.role) ? 'none' : 'block'};">
              <label class="form-label">Mentor</label>
              <select class="form-control" id="edit-mentor">
                <option value="">Non affecté</option>
                ${(Membres.getPossibleMentorsForReassign() || []).filter(m => m.id !== membre.id).map(m => `
                <option value="${m.id}" ${membre.mentor_id === m.id ? 'selected' : ''}>${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)} (${Utils.getRoleLabel(m.role)})</option>
                `).join('')}
              </select>
            </div>
            <hr style="margin: var(--spacing-lg) 0;">
            ` : ''}
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
                <input type="date" class="form-control" id="edit-date-naissance" min="${minDate}" max="${today}" value="${getDateValue(membre.date_naissance)}">
              </div>
              <div class="form-group">
                <label class="form-label">Téléphone</label>
                <div class="phone-edit-row" style="display: flex; gap: var(--spacing-sm); align-items: flex-start;">
                  <select class="form-control edit-indicatif" id="edit-indicatif-telephone" title="Indicatif pays">${Utils.INDICATIFS_PAYS.map(ind => `<option value="${Utils.escapeHtml(ind.value)}" ${(membre.indicatif_telephone || '+33') === ind.value ? 'selected' : ''}>${Utils.escapeHtml(ind.label)}</option>`).join('')}</select>
                  <input type="tel" class="form-control edit-numero" id="edit-telephone" placeholder="6 12 34 56 78" value="${Utils.escapeHtml(membre.telephone || '')}">
                </div>
                <span class="form-hint">Ex. France : 6 12 34 56 78 (sans le 0 initial)</span>
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
              <input type="date" class="form-control" id="edit-date-icc" min="${minDate}" max="${today}" value="${getDateValue(membre.date_arrivee_icc)}">
            </div>
            
            <div class="form-group">
              <label class="form-label">Formations suivies</label>
              <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-md);">
                ${formations.map(f => `
                  <div class="form-check">
                    <input type="checkbox" id="formation-${f.replace(/[^a-zA-Z0-9_]/g, '_')}" value="${f}" ${membreFormations.includes(f) ? 'checked' : ''}>
                    <label for="formation-${f.replace(/[^a-zA-Z0-9_]/g, '_')}">${formationLabels[f] || f}</label>
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
              <select class="form-control" id="edit-baptise" onchange="var g=document.getElementById('edit-date-bapteme-group');if(g)g.style.display=this.value==='true'?'block':'none';">
                <option value="">-- Sélectionner --</option>
                <option value="true" ${membre.baptise_immersion === true ? 'selected' : ''}>Oui</option>
                <option value="false" ${membre.baptise_immersion === false ? 'selected' : ''}>Non</option>
              </select>
            </div>
            <div class="form-group" id="edit-date-bapteme-group" style="display: ${membre.baptise_immersion === true ? 'block' : 'none'};">
              <label class="form-label">Date du baptême</label>
              <input type="date" class="form-control" id="edit-date-bapteme" min="${minDate}" max="${today}" value="${getDateValue(membre.date_bapteme)}">
            </div>
            
            <hr style="margin: var(--spacing-lg) 0;">
            <h4 class="mb-2">Pôle(s) interne(s) d'appartenance</h4>
            <p class="text-muted mb-2" style="font-size: 0.9rem;">Choisissez au maximum 2 pôles (obligatoire). Cochez « Aucun » si vous n'appartenez à aucun pôle.</p>
            <div class="form-group" id="pole-interne-group">
              <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-md);">
                ${Utils.POLE_OPTIONS.map(opt => {
                  const isAucun = opt.value === 'aucun';
                  const membrePoles = membre.pole_interne || [];
                  const checked = isAucun ? (membrePoles.length === 0 || (membrePoles.length === 1 && membrePoles[0] === 'aucun')) : membrePoles.includes(opt.value);
                  const id = 'pole-' + opt.value.replace(/_/g, '-');
                  return `
                  <label class="form-check pole-check" style="margin-bottom: 0;" data-pole-value="${Utils.escapeHtml(opt.value)}">
                    <input type="checkbox" id="${id}" value="${Utils.escapeHtml(opt.value)}" ${checked ? 'checked' : ''}
                           onchange="App.togglePoleInterne(this)"
                           data-pole-aucun="${isAucun}">
                    <span>${Utils.escapeHtml(opt.label)}</span>
                  </label>`;
                }).join('')}
              </div>
              <span class="form-hint" id="pole-interne-hint">${(function(){ const p = membre.pole_interne || []; const n = p.filter(x => x !== 'aucun').length; return n === 0 ? 'Aucun pôle' : n + '/2 pôle(s) sélectionné(s)'; })()}</span>
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
                <option value="entrepreneur_autoentrepreneur" ${membre.statut_professionnel === 'entrepreneur_autoentrepreneur' ? 'selected' : ''}>Entrepreneur / Autoentrepreneur</option>
                <option value="autre" ${membre.statut_professionnel === 'autre' ? 'selected' : ''}>Autre</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Passions / Centres d'intérêt</label>
              <textarea class="form-control" id="edit-passions" rows="3">${membre.passions_centres_interet || ''}</textarea>
            </div>
            
            <hr style="margin: var(--spacing-lg) 0;">
            <div class="rgpd-notice" style="padding: var(--spacing-md); background: var(--bg-tertiary, #f5f5f5); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted); margin-bottom: var(--spacing-md);">
              <strong>Données personnelles (RGPD)</strong><br>
              Les informations de ce profil sont strictement réservées à un usage interne et demeurent confidentielles. Chaque membre dispose d'un droit d'accès, de modification et de suppression de ses propres données personnelles.
            </div>
            <div class="form-group">
              <label class="form-check" style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="edit-rgpd-accept" required class="form-control" style="width: auto; margin-top: 3px;">
                <span>J'ai pris connaissance des informations RGPD ci-dessus et j'accepte que mes données soient traitées dans ce cadre.</span>
              </label>
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
          <h4 class="mb-2">Préférences</h4>
          <div class="form-group">
            <label class="form-label">Thème d'affichage</label>
            <select class="form-control" id="pref-theme" onchange="App.setThemePreference(this.value)" style="max-width: 200px;">
              <option value="light" ${(localStorage.getItem('crm_theme') || 'light') === 'light' ? 'selected' : ''}>Clair</option>
              <option value="dark" ${localStorage.getItem('crm_theme') === 'dark' ? 'selected' : ''}>Sombre</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Raccourcis (pages favorites dans le menu)</label>
            <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-sm);">
              ${['dashboard', 'calendrier', 'nouvelles-ames', 'evangelisation', 'statistiques', 'sujets-priere'].map(id => {
                const labels = { dashboard: 'Tableau de bord', calendrier: 'Calendrier', 'nouvelles-ames': 'Nouvelles âmes', evangelisation: 'Évangélisation', statistiques: 'Statistiques', 'sujets-priere': 'Prières' };
                const favs = JSON.parse(localStorage.getItem('crm_raccourcis') || '[]');
                const checked = favs.includes(id);
                return `<label class="form-check" style="margin-bottom: 0;"><input type="checkbox" value="${id}" ${checked ? 'checked' : ''} onchange="App.toggleRaccourci('${id}', this.checked)"><span>${labels[id]}</span></label>`;
              }).join('')}
            </div>
          </div>

          ${Permissions.hasRole('superviseur') ? `
          <hr style="margin: var(--spacing-lg) 0;">
          <h4 class="mb-2">Sauvegarde des données</h4>
          <p class="text-muted mb-2" style="font-size: 0.9rem;">Exporter l'ensemble des données (membres, programmes, nouvelles âmes, sujets de prière) en JSON pour archivage.</p>
          <button type="button" class="btn btn-outline" onclick="App.exportGlobal()">
            <i class="fas fa-download"></i> Exporter les données (JSON)
          </button>
          ` : ''}

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
    const moisLabels = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    const poleOptionsForFilter = [{ value: '', label: 'Tous les pôles' }, ...Utils.POLE_OPTIONS.filter(o => o.value !== 'aucun'), { value: 'aucun', label: 'Aucun' }];
    return `
      <div class="members-header">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" class="form-control" id="search-annuaire" 
                 placeholder="Rechercher..." onkeyup="App.filterAnnuaire()">
        </div>
        <label style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
          <i class="fas fa-layer-group"></i>
          <select class="form-control" id="filter-annuaire-pole" onchange="App.filterAnnuaire()" title="Filtrer par pôle">
            ${poleOptionsForFilter.map(o => `<option value="${o.value}">${Utils.escapeHtml(o.label)}</option>`).join('')}
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
          <i class="fas fa-birthday-cake"></i>
          <select class="form-control" id="filter-annuaire-mois" onchange="App.filterAnnuaire()" title="Filtrer par mois d'anniversaire">
            <option value="">Tous les mois</option>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${String(m).padStart(2, '0')}">${moisLabels[m]}</option>`).join('')}
          </select>
        </label>
      </div>
      
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div id="annuaire-list">
            ${membres.map(m => {
              const isBirthday = Utils.isBirthday(m.date_naissance);
              let birthDisplay = '-';
              let birthMonth = '';
              if (m.date_naissance) {
                const d = m.date_naissance.toDate ? m.date_naissance.toDate() : new Date(m.date_naissance);
                if (!isNaN(d.getTime())) {
                  birthDisplay = `${d.getDate()} ${d.toLocaleString('fr-FR', { month: 'long' })}`;
                  birthMonth = String(d.getMonth() + 1).padStart(2, '0');
                }
              }
              const polesArr = m.pole_interne && Array.isArray(m.pole_interne) ? m.pole_interne.filter(p => p !== 'aucun') : [];
              const dataPoles = polesArr.length > 0 ? polesArr.join(',') : 'aucun';
              const polesLabel = Utils.getPolesLabel(m.pole_interne);
              const avatarStyleAnnuaire = m.photo_url
                ? `background-image: url('${Utils.escapeHtml(m.photo_url)}'); background-size: cover; background-position: center; position: relative;`
                : `background: ${m.sexe === 'F' ? '#E91E63' : 'var(--primary)'}; position: relative;`;
              return `
                <div class="member-card" data-name="${(m.prenom + ' ' + m.nom).toLowerCase()}" data-birth-month="${birthMonth}" data-poles="${Utils.escapeHtml(dataPoles)}">
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
                      <i class="fas fa-layer-group"></i> ${Utils.escapeHtml(polesLabel)}
                    </div>
                    <div class="text-muted" style="font-size: 0.85rem;">
                      <i class="fas fa-calendar-alt"></i> ${birthDisplay}
                    </div>
                    <div class="text-muted" style="font-size: 0.8rem; margin-top: 2px;">
                      ${(m.adresse_ville || m.adresse_code_postal) ? `<i class="fas fa-map-marker-alt"></i> ${[m.adresse_ville, m.adresse_code_postal].filter(Boolean).join(' ')}` : ''}
                    </div>
                    <div class="text-muted" style="font-size: 0.85rem; margin-top: 2px;">
                      <i class="fas fa-phone"></i> ${Utils.escapeHtml(Utils.formatTelephoneDisplay(m))}
                    </div>
                  </div>
                  <div style="flex: 1;">
                    <div style="font-size: 0.9rem;">${Utils.escapeHtml(m.profession || '-')}</div>
                    <div class="text-muted" style="font-size: 0.8rem;">
                      ${m.statut_professionnel ? (m.statut_professionnel === 'entrepreneur_autoentrepreneur' ? 'Entrepreneur / Autoentrepreneur' : Utils.capitalize(m.statut_professionnel.replace('_', ' '))) : ''}
                    </div>
                  </div>
                  <div style="flex: 1.5;">
                    <div class="text-muted" style="font-size: 0.85rem;">
                      <i class="fas fa-heart"></i> ${Utils.escapeHtml(m.passions_centres_interet || '-')}
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
      
      ${Permissions.hasRole('superviseur') ? `
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
  },

  async renderAdminFamilles() {
    if (!Permissions.isAdmin()) return '<div class="alert alert-danger">Accès réservé à l\'administrateur.</div>';
    let families = [];
    try {
      const snapshot = await db.collection('familles').get();
      families = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      families.sort((a, b) => (a.nom_affichage || a.nom || '').localeCompare(b.nom_affichage || b.nom || ''));
    } catch (e) {
      console.error('Erreur chargement familles:', e);
      return '<div class="alert alert-danger">Impossible de charger les familles.</div>';
    }
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-church"></i> Familles</h3>
          <button type="button" class="btn btn-primary" onclick="App.showCreateFamilleModal()">
            <i class="fas fa-plus"></i> Créer une famille
          </button>
        </div>
        <div class="card-body">
          <p class="text-muted mb-3">Les familles ont des données et membres totalement séparés. Créez une famille puis ajoutez son premier superviseur pour qu'il puisse inviter mentors et disciples.</p>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Nom affiché</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${families.length === 0 ? '<tr><td colspan="3" class="text-center text-muted">Aucune famille. Créez-en une.</td></tr>' : families.map(f => `
                  <tr>
                    <td><strong>${Utils.escapeHtml(f.nom_affichage || f.nom || f.id)}</strong></td>
                    <td><span class="badge badge-${f.statut === 'actif' ? 'success' : 'secondary'}">${f.statut || 'actif'}</span></td>
                    <td>
                      <button type="button" class="btn btn-sm btn-outline" data-famille-id="${f.id}" data-famille-nom="${Utils.escapeHtml(f.nom_affichage || f.nom || '')}" onclick="App.showAddSuperviseurModalFromButton(this)">
                        <i class="fas fa-user-plus"></i> Ajouter un superviseur
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async renderLogs() {
    if (!Permissions.isAdmin()) return '<div class="alert alert-danger">Accès réservé à l\'administrateur.</div>';
    let connexions = [];
    let modifications = [];
    try {
      const [snapConnexions, snapModifications] = await Promise.all([
        db.collection('logs_connexion').orderBy('date', 'desc').limit(80).get(),
        db.collection('logs_modification').orderBy('date', 'desc').limit(80).get()
      ]);
      connexions = snapConnexions.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      modifications = snapModifications.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error('Erreur chargement logs:', e);
      return '<div class="alert alert-danger">Impossible de charger le journal d\'activité. Vérifiez les règles Firestore (lecture réservée à l\'admin).</div>';
    }
    const formatLogDate = (d) => {
      if (!d) return '-';
      const t = d.toDate ? d.toDate() : new Date(d);
      return isNaN(t.getTime()) ? '-' : t.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    return `
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-sign-in-alt"></i> Connexions</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr><th>Date</th><th>Membre</th><th>Email</th><th>Famille</th></tr>
              </thead>
              <tbody>
                ${connexions.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">Aucune connexion enregistrée.</td></tr>' : connexions.map(l => `
                  <tr>
                    <td>${formatLogDate(l.date)}</td>
                    <td>${Utils.escapeHtml((l.prenom || '') + ' ' + (l.nom || ''))}</td>
                    <td>${Utils.escapeHtml(l.email || '')}</td>
                    <td><code>${Utils.escapeHtml(l.famille_id || '')}</code></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-edit"></i> Modifications</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr><th>Date</th><th>Par</th><th>Action</th><th>Document</th><th>Détails</th></tr>
              </thead>
              <tbody>
                ${modifications.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">Aucune modification enregistrée.</td></tr>' : modifications.map(l => `
                  <tr>
                    <td>${formatLogDate(l.date)}</td>
                    <td>${Utils.escapeHtml((l.user_prenom || '') + ' ' + (l.user_nom || ''))} <span class="text-muted">${Utils.escapeHtml(l.user_email || '')}</span></td>
                    <td>${Utils.escapeHtml(l.action || '')}</td>
                    <td>${Utils.escapeHtml(l.collection || '')} / ${Utils.escapeHtml(l.document_id || '')}</td>
                    <td>${l.details ? Utils.escapeHtml(String(l.details)) : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p class="text-muted mt-2" style="font-size: 0.85rem;">Dernières 80 entrées par type. Les données sont strictement réservées à l'administrateur.</p>
    `;
  }
};

// ============================================
// PAGES DISCIPLES - Stats et graphiques
// ============================================
const PagesDisciples = {
  async initCharts() {
    if (typeof ChartsHelper === 'undefined') return;
    const canvas = document.getElementById('chart-disciples-presence');
    if (!canvas) return;
    try {
      const stats = await Statistiques.calculatePresenceStats({
        mentorId: AppState.user.id,
        dateDebut: new Date(new Date().setMonth(new Date().getMonth() - 2)),
        dateFin: new Date()
      });
      const parMembre = (stats.parMembre || []).slice(0, 10);
      if (parMembre.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><p>Aucune donnée de présence</p></div>';
        return;
      }
      const labels = parMembre.map(m => m.prenom + ' ' + m.nom.substring(0, 1) + '.');
      const data = parMembre.map(m => m.tauxPresence);
      const colors = data.map(t => t >= 80 ? '#4CAF50' : t >= 50 ? '#FF9800' : '#F44336');
      ChartsHelper.createBar('chart-disciples-presence', labels, data, colors);
    } catch (e) {
      console.error('Erreur init charts disciples:', e);
    }
  }
};
