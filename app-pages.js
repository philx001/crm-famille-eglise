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

  renderDashboard() {
    const stats = Membres.getStats();
    const user = AppState.user;
    const mesDisciples = user.role !== 'disciple' && user.role !== 'nouveau' 
      ? Membres.getDisciples(user.id) 
      : [];

    return `
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fas fa-users"></i></div>
          <div class="stat-content">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Membres actifs</div>
          </div>
        </div>
        
        ${Permissions.hasRole('mentor') ? `
        <div class="stat-card">
          <div class="stat-icon success"><i class="fas fa-user-friends"></i></div>
          <div class="stat-content">
            <div class="stat-value">${mesDisciples.length}</div>
            <div class="stat-label">Mes disciples</div>
          </div>
        </div>
        ` : ''}
        
        <div class="stat-card">
          <div class="stat-icon warning"><i class="fas fa-user-plus"></i></div>
          <div class="stat-content">
            <div class="stat-value">${stats.parRole.nouveaux}</div>
            <div class="stat-label">Nouveaux</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon info"><i class="fas fa-birthday-cake"></i></div>
          <div class="stat-content">
            <div class="stat-value">${stats.anniversairesAujourdhui.length}</div>
            <div class="stat-label">Anniversaires aujourd'hui</div>
          </div>
        </div>
      </div>
      
      ${stats.anniversairesAujourdhui.length > 0 ? `
      <div class="alert alert-success mb-3">
        <i class="fas fa-birthday-cake"></i>
        <div class="alert-content">
          <div class="alert-title">🎂 Joyeux anniversaire !</div>
          <p class="mb-0">${stats.anniversairesAujourdhui.map(m => `${m.prenom} ${m.nom}`).join(', ')}</p>
        </div>
      </div>
      ` : ''}
      
      <div class="dashboard-section">
        <div class="section-header">
          <h3 class="section-title"><i class="fas fa-bolt"></i> Actions rapides</h3>
        </div>
        <div class="quick-actions">
          <div class="quick-action" onclick="App.navigate('profil')">
            <i class="fas fa-user"></i>
            <span>Mon profil</span>
          </div>
          <div class="quick-action" onclick="App.navigate('annuaire')">
            <i class="fas fa-address-book"></i>
            <span>Annuaire</span>
          </div>
          ${Permissions.canAddDisciple() ? `
          <div class="quick-action" onclick="App.navigate('membres-add')">
            <i class="fas fa-user-plus"></i>
            <span>Ajouter un disciple</span>
          </div>
          ` : ''}
          ${Permissions.canViewStats() ? `
          <div class="quick-action" onclick="App.navigate('statistiques')">
            <i class="fas fa-chart-bar"></i>
            <span>Statistiques</span>
          </div>
          ` : ''}
        </div>
      </div>
      
      ${Permissions.hasRole('mentor') && mesDisciples.length > 0 ? `
      <div class="dashboard-section">
        <div class="section-header">
          <h3 class="section-title"><i class="fas fa-user-friends"></i> Mes disciples</h3>
          <a href="#" onclick="App.navigate('mes-disciples'); return false;" class="btn btn-sm btn-outline">Voir tout</a>
        </div>
        <div class="card">
          <div class="card-body" style="padding: 0;">
            ${mesDisciples.slice(0, 5).map(d => `
              <div class="member-card">
                <div class="member-avatar" style="background: ${d.sexe === 'F' ? '#E91E63' : 'var(--primary)'}">
                  ${Utils.getInitials(d.prenom, d.nom)}
                </div>
                <div class="member-info">
                  <div class="member-name">${Utils.escapeHtml(d.prenom)} ${Utils.escapeHtml(d.nom)}</div>
                  <div class="member-email">${Utils.escapeHtml(d.email)}</div>
                </div>
                <span class="badge badge-${d.role}">${Utils.getRoleLabel(d.role)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      ` : ''}
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

  renderMembreCard(membre) {
    const mentor = membre.mentor_id ? Membres.getById(membre.mentor_id) : null;
    const isBirthday = Utils.isBirthday(membre.date_naissance);
    
    return `
      <div class="member-card" data-id="${membre.id}" data-role="${membre.role}" 
           data-name="${(membre.prenom + ' ' + membre.nom).toLowerCase()}">
        <div class="member-avatar" style="background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'}">
          ${Utils.getInitials(membre.prenom, membre.nom)}
        </div>
        <div class="member-info">
          <div class="member-name">
            ${isBirthday ? '🎂 ' : ''}${Utils.escapeHtml(membre.prenom)} ${Utils.escapeHtml(membre.nom)}
          </div>
          <div class="member-email">${Utils.escapeHtml(membre.email)}</div>
          ${mentor ? `<div class="text-muted" style="font-size: 0.8rem;">Mentor: ${Utils.escapeHtml(mentor.prenom)}</div>` : ''}
        </div>
        <div class="member-meta">
          <span class="badge badge-${membre.role}">${Utils.getRoleLabel(membre.role)}</span>
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
              </select>
            </div>
            
            <div class="form-group" id="mentor-group">
              <label class="form-label required">Mentor</label>
              <select class="form-control" id="membre-mentor" required>
                <option value="${AppState.user.id}">Moi-même (${AppState.user.prenom})</option>
                ${Permissions.hasRole('berger') ? mentors
                  .filter(m => m.id !== AppState.user.id)
                  .map(m => `<option value="${m.id}">${Utils.escapeHtml(m.prenom)} ${Utils.escapeHtml(m.nom)}</option>`)
                  .join('') : ''}
              </select>
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
            <div class="member-avatar" style="width: 60px; height: 60px; font-size: 1.5rem; background: ${membre.sexe === 'F' ? '#E91E63' : 'var(--primary)'}">
              ${Utils.getInitials(membre.prenom, membre.nom)}
            </div>
            <div>
              <h3 class="card-title mb-0">${Utils.escapeHtml(membre.prenom)} ${Utils.escapeHtml(membre.nom)}</h3>
              <span class="badge badge-${membre.role}">${Utils.getRoleLabel(membre.role)}</span>
            </div>
          </div>
          ${canEdit ? `
          <button class="btn btn-primary" onclick="App.editMembre('${membre.id}')">
            <i class="fas fa-edit"></i> Modifier
          </button>
          ` : ''}
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
              
              return `
                <div class="member-card" data-name="${(m.prenom + ' ' + m.nom).toLowerCase()}">
                  <div class="member-avatar ${isBirthday ? 'birthday-glow' : ''}" 
                       style="background: ${m.sexe === 'F' ? '#E91E63' : 'var(--primary)'}; position: relative;">
                    ${Utils.getInitials(m.prenom, m.nom)}
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
