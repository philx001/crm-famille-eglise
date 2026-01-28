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
    const options = format === 'full' 
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return d.toLocaleDateString('fr-FR', options);
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

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
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
      'adjoint_berger': 'Adjoint Berger',
      'berger': 'Berger',
      'admin': 'Administrateur'
    };
    return labels[role] || role;
  },

  getRoleLevel(role) {
    const levels = {
      'disciple': 1,
      'nouveau': 1,
      'mentor': 2,
      'adjoint_berger': 3,
      'berger': 4,
      'admin': 5
    };
    return levels[role] || 0;
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
