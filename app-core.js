// ============================================
// CRM ÉGLISE - APPLICATION PRINCIPALE
// ============================================

// État global de l'application
const AppState = {
  user: null,
  famille: null,
  membres: [],
  programmes: [],
  currentPage: 'dashboard',
  isLoading: false,
  inactivityTimer: null,
  INACTIVITY_TIMEOUT: 15 * 60 * 1000, // 15 minutes
};

// Références Firebase (seront définies après chargement)


// Initialiser les références Firebase
   function initFirebase() {
     if (typeof auth === 'undefined' || typeof db === 'undefined') {
       console.error('Firebase not initialized! Check firebase-config.js');
       return false;
     }
     console.log('Firebase initialized successfully');
     return true;
   }

// ============================================
// UTILITAIRES
// ============================================

const Utils = {
  getInitials(prenom, nom) {
    return `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase();
  },

  formatDate(date, format = 'short') {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    if (year < 1900 || year > 2100) return ''; // dates non réalistes
    const options = format === 'full' 
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return d.toLocaleDateString('fr-FR', options);
  },

  /** Valeur pour input type="date" (YYYY-MM-DD), vide si date invalide ou hors 1900–2100. */
  toDateInputValue(date) {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    if (y < 1900 || y > 2100) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /** Bornes min/max pour filtres par date (Programmes, Stats, Nouvelles âmes). Évite années aberrantes. */
  getDateFilterBounds() {
    const today = new Date();
    const min = new Date(2000, 0, 1);
    const max = new Date(today);
    max.setFullYear(max.getFullYear() + 2);
    return {
      min: min.toISOString().split('T')[0],
      max: max.toISOString().split('T')[0]
    };
  },

  /** Bornes pour champs "passé" (date naissance, arrivée ICC, baptême) : 1900 → aujourd'hui. */
  getDatePastBounds() {
    const today = new Date().toISOString().split('T')[0];
    return { min: '1900-01-01', max: today };
  },

  formatRelativeDate(date) {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return Utils.formatDate(d);
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /** Première ligne du contenu (titre affiché si pas de champ titre), max 80 car. */
  getTitleFromContent(text) {
    if (!text || typeof text !== 'string') return 'Sans titre';
    const firstLine = text.trim().split(/\n/)[0] || '';
    return firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine || 'Sans titre';
  },

  /** Premières maxLines lignes du contenu pour affichage condensé. */
  getPreviewLines(text, maxLines) {
    if (!text || typeof text !== 'string') return '';
    const lines = text.trim().split(/\n/).filter(Boolean);
    return lines.slice(0, maxLines).join('\n').slice(0, 200);
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
  },

  /**
   * Retourne le logo et slogan d'une famille pour la sidebar (null si pas de branding).
   */
  getFamilyBranding(famille) {
    if (!famille) return null;
    const nom = ((famille.nom_affichage || famille.nom || '') + '').toLowerCase().normalize('NFD').replace(/\u0301/g, 'e').replace(/[\u0300-\u036f]/g, '');
    if (nom.includes('determin')) {
      const defaultLogoPath = '/assets/logo-determines.png';
      const defaultLogoUrl = (typeof window !== 'undefined' && window.location)
        ? (window.location.origin + defaultLogoPath)
        : 'assets/logo-determines.png';
      return {
        logoUrl: (typeof LOGO_DETERMINES_URL !== 'undefined' && LOGO_DETERMINES_URL) ? LOGO_DETERMINES_URL : defaultLogoUrl,
        sloganTitle: 'LES DÉTERMINÉS',
        sloganSubtitle: 'À ÊTRE DES DISCIPLES DE JÉSUS-CHRIST'
      };
    }
    return null;
  },

  isBirthday(dateNaissance) {
    if (!dateNaissance) return false;
    const d = dateNaissance.toDate ? dateNaissance.toDate() : new Date(dateNaissance);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  },

  getRoleLabel(role) {
    const labels = {
      'disciple': 'Disciple',
      'nouveau': 'Nouveau',
      'mentor': 'Mentor',
      'adjoint_superviseur': 'Adjoint superviseur',
      'superviseur': 'Superviseur',
      'admin': 'Administrateur'
    };
    return labels[role] || role;
  },

  getRoleLevel(role) {
    const levels = {
      'disciple': 1,
      'nouveau': 1,
      'mentor': 2,
      'adjoint_superviseur': 3,
      'superviseur': 4,
      'admin': 5
    };
    return levels[role] || 0;
  },

  // Pôles internes d'appartenance (max 2 par membre)
  POLE_OPTIONS: [
    { value: 'comfrat', label: 'Pôle Comfrat' },
    { value: 'coordination_generale', label: 'Pôle Coordination Générale' },
    { value: 'communication', label: 'Pôle Communication' },
    { value: 'statistiques', label: 'Pôle Statistiques' },
    { value: 'projets', label: 'Pôle Projets' },
    { value: 'spirituel', label: 'Pôle Spirituel' },
    { value: 'evenementiel', label: 'Pôle Evènementiel' },
    { value: 'evangelisation', label: 'Pôle Evangélisation' },
    { value: 'aucun', label: 'Aucun' }
  ],

  getPoleLabel(value) {
    const opt = Utils.POLE_OPTIONS.find(o => o.value === value);
    return opt ? opt.label : value;
  },

  getPolesLabel(poleInterne) {
    if (!poleInterne || !Array.isArray(poleInterne) || poleInterne.length === 0 || (poleInterne.length === 1 && poleInterne[0] === 'aucun')) return 'Aucun';
    return poleInterne.filter(p => p !== 'aucun').map(p => Utils.getPoleLabel(p)).join(', ');
  },

  // Indicatifs téléphoniques (pays)
  INDICATIFS_PAYS: [
    { value: '+33', label: 'France (+33)' },
    { value: '+32', label: 'Belgique (+32)' },
    { value: '+41', label: 'Suisse (+41)' },
    { value: '+1', label: 'Canada / USA (+1)' },
    { value: '+221', label: 'Sénégal (+221)' },
    { value: '+223', label: 'Mali (+223)' },
    { value: '+224', label: 'Guinée (+224)' },
    { value: '+225', label: 'Côte d\'Ivoire (+225)' },
    { value: '+226', label: 'Burkina Faso (+226)' },
    { value: '+227', label: 'Niger (+227)' },
    { value: '+228', label: 'Togo (+228)' },
    { value: '+229', label: 'Bénin (+229)' },
    { value: '+212', label: 'Maroc (+212)' },
    { value: '+213', label: 'Algérie (+213)' },
    { value: '+216', label: 'Tunisie (+216)' },
    { value: '+237', label: 'Cameroun (+237)' },
    { value: '+242', label: 'Congo (+242)' },
    { value: '+243', label: 'RD Congo (+243)' },
    { value: '+261', label: 'Madagascar (+261)' },
    { value: '+262', label: 'La Réunion (+262)' },
    { value: '+44', label: 'Royaume-Uni (+44)' },
    { value: '+49', label: 'Allemagne (+49)' },
    { value: '+39', label: 'Italie (+39)' },
    { value: '+34', label: 'Espagne (+34)' },
    { value: '+351', label: 'Portugal (+351)' },
    { value: '+90', label: 'Turquie (+90)' },
    { value: '', label: 'Autre (numéro complet ci‑dessous)' }
  ],

  formatTelephoneDisplay(membre) {
    const indicatif = membre.indicatif_telephone || '';
    const num = membre.telephone ? String(membre.telephone).trim() : '';
    if (!num) return '-';
    if (indicatif) return indicatif + ' ' + num;
    if (num.startsWith('+')) return num;
    return '+33 ' + num;
  }
};

// ============================================
// GESTION DES TOASTS (NOTIFICATIONS)
// ============================================

const Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 4000) {
    if (!this.container) this.init();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };

    toast.innerHTML = `
      <i class="${icons[type] || icons.info}"></i>
      <span>${Utils.escapeHtml(message)}</span>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(message) { this.show(message, 'success'); },
  error(message) { this.show(message, 'error'); },
  warning(message) { this.show(message, 'warning'); },
  info(message) { this.show(message, 'info'); }
};

// ============================================
// GESTION DES MODALES
// ============================================

const Modal = {
  show(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  hide(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  confirm(title, message, onConfirm) {
    const modalId = 'confirm-modal-' + Date.now();
    const modalHtml = `
      <div class="modal-overlay" id="${modalId}">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">${Utils.escapeHtml(title)}</h3>
            <button class="modal-close" onclick="Modal.hide('${modalId}'); document.getElementById('${modalId}').remove();">&times;</button>
          </div>
          <div class="modal-body">
            <p>${Utils.escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.hide('${modalId}'); document.getElementById('${modalId}').remove();">Annuler</button>
            <button class="btn btn-danger" id="${modalId}-confirm">Confirmer</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    Modal.show(modalId);

    document.getElementById(`${modalId}-confirm`).onclick = () => {
      Modal.hide(modalId);
      document.getElementById(modalId).remove();
      onConfirm();
    };
  }
};

// ============================================
// GESTION DE L'INACTIVITÉ
// ============================================

const InactivityManager = {
  init() {
    this.resetTimer();
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, () => this.resetTimer(), { passive: true });
    });
  },

  resetTimer() {
    if (AppState.inactivityTimer) {
      clearTimeout(AppState.inactivityTimer);
    }

    if (AppState.user) {
      AppState.inactivityTimer = setTimeout(() => {
        this.handleInactivity();
      }, AppState.INACTIVITY_TIMEOUT);
    }
  },

  handleInactivity() {
    Toast.warning('Session expirée pour inactivité');
    Auth.logout();
  },

  stop() {
    if (AppState.inactivityTimer) {
      clearTimeout(AppState.inactivityTimer);
      AppState.inactivityTimer = null;
    }
  }
};

// ============================================
// GESTION GLOBALE DES ERREURS
// ============================================

const ErrorHandler = {
  // Intercepter et traiter les erreurs Firebase/Network
  handle(error, context = '') {
    console.error(`[ErrorHandler${context ? ' - ' + context : ''}]`, error);

    // Erreurs réseau
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded' || 
        error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
      this.showNetworkError();
      return;
    }

    // Session expirée / Non authentifié (VRAIE session expirée)
    if (error.code === 'unauthenticated' || 
        error.code === 'auth/user-token-expired') {
      this.showSessionError();
      return;
    }

    // Erreur Firestore permission (différente de session expirée)
    if (error.code === 'permission-denied') {
      Toast.error('Vous n\'avez pas la permission d\'effectuer cette action. Vérifiez votre rôle dans Firestore.');
      return;
    }

    // Erreur Firestore index manquant (normal lors du premier déploiement)
    if (error.code === 'failed-precondition' && error.message?.includes('index')) {
      // Ne pas afficher de toast pour les index manquants - c'est normal et les URLs sont dans la console
      console.warn('Index Firestore manquant. Créez l\'index en suivant le lien dans l\'erreur ci-dessus.');
      return;
    }

    // Erreur générique
    const message = error.message || 'Une erreur est survenue';
    Toast.error(message);
  },

  // Afficher une erreur réseau avec option de réessai
  showNetworkError() {
    const errorId = 'network-error-' + Date.now();
    const errorHtml = `
      <div class="alert alert-error" id="${errorId}" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 10000; max-width: 500px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <i class="fas fa-wifi"></i>
        <div class="alert-content">
          <div class="alert-title">Problème de connexion</div>
          <p>Impossible de se connecter au serveur. Vérifiez votre connexion Internet.</p>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="btn btn-sm btn-primary" onclick="ErrorHandler.retry()">Réessayer</button>
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('${errorId}').remove()">Fermer</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', errorHtml);
  },

  // Afficher une erreur de session avec option de reconnexion
  showSessionError() {
    // Ne pas afficher si on est déjà sur la page de connexion (déconnexion volontaire ou redirection)
    if (document.getElementById('login-form')) return;
    const errorId = 'session-error-' + Date.now();
    const errorHtml = `
      <div class="alert alert-warning" id="${errorId}" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 10000; max-width: 500px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <i class="fas fa-exclamation-triangle"></i>
        <div class="alert-content">
          <div class="alert-title">Session expirée</div>
          <p>Votre session a expiré. Veuillez vous reconnecter.</p>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="btn btn-sm btn-primary" onclick="ErrorHandler.reconnect()">Se reconnecter</button>
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('${errorId}').remove()">Fermer</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', errorHtml);
  },

  // Réessayer la dernière action (recharger la page)
  retry() {
    window.location.reload();
  },

  // Reconnecter l'utilisateur
  reconnect() {
    Auth.logout();
  },

  // Wrapper pour les promesses Firebase avec gestion d'erreur automatique
  async wrap(promise, context = '') {
    try {
      return await promise;
    } catch (error) {
      this.handle(error, context);
      throw error; // Re-throw pour permettre le traitement spécifique si nécessaire
    }
  }
};
