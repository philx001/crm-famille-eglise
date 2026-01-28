// ============================================
// AUTHENTIFICATION
// ============================================

const Auth = {
  async login(email, password, familleNom) {
    try {
      App.showLoading();

      // Vérifier que la famille existe
      const familleQuery = await db.collection('familles')
        .where('nom', '==', familleNom.toLowerCase().trim())
        .where('statut', '==', 'actif')
        .get();

      if (familleQuery.empty) {
        throw new Error('Famille non trouvée ou inactive');
      }

      const familleDoc = familleQuery.docs[0];
      const familleId = familleDoc.id;

      // Authentification Firebase
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // IMPORTANT : Attendre que Firebase propage l'authentification
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Récupérer les données utilisateur avec l'API compatibilité
      const userDoc = await db.collection('utilisateurs').doc(uid).get();

      if (!userDoc.exists) {
        await auth.signOut();
        throw new Error('Utilisateur non trouvé dans la base de données');
      }

      const userData = userDoc.data();

      // Vérifier appartenance à la famille (sauf admin)
      if (userData.role !== 'admin' && userData.famille_id !== familleId) {
        await auth.signOut();
        throw new Error('Vous n\'appartenez pas à cette famille');
      }

      // Vérifier compte actif
      if (userData.statut_compte !== 'actif') {
        await auth.signOut();
        throw new Error('Votre compte est inactif. Contactez votre Berger.');
      }

      // Mettre à jour dernière connexion
      await db.collection('utilisateurs').doc(uid).update({
        derniere_connexion: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Stocker en local
      AppState.user = { id: uid, ...userData };
      AppState.famille = { id: familleId, ...familleDoc.data() };

      localStorage.setItem('crm_famille_id', familleId);
      localStorage.setItem('crm_famille_nom', familleNom);

      InactivityManager.init();
      App.navigate('dashboard');
      Toast.success(`Bienvenue ${userData.prenom} !`);

    } catch (error) {
      console.error('Erreur de connexion:', error);
      
      // Gérer les erreurs spécifiques à l'authentification
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        Toast.error('Email ou mot de passe incorrect');
      } else if (error.code === 'auth/too-many-requests') {
        Toast.error('Trop de tentatives. Réessayez plus tard.');
      } else if (error.code === 'auth/network-request-failed' || error.code === 'unavailable') {
        ErrorHandler.handle(error, 'Connexion');
      } else if (error.message) {
        Toast.error(error.message);
      } else {
        ErrorHandler.handle(error, 'Connexion');
      }
    } finally {
      App.hideLoading();
    }
  },

  async logout() {
    try {
      InactivityManager.stop();
      await auth.signOut();
      AppState.user = null;
      AppState.famille = null;
      AppState.membres = [];
      localStorage.removeItem('crm_famille_id');
      localStorage.removeItem('crm_famille_nom');
      App.showLoginPage();
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      Toast.error('Erreur lors de la déconnexion');
    }
  },

  async checkAuthState() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const userDoc = await db.collection('utilisateurs').doc(firebaseUser.uid).get();
            
            if (userDoc.exists) {
              const userData = userDoc.data();
              AppState.user = { id: firebaseUser.uid, ...userData };

              const familleId = localStorage.getItem('crm_famille_id') || userData.famille_id;
              if (familleId) {
                const familleDoc = await db.collection('familles').doc(familleId).get();
                if (familleDoc.exists) {
                  AppState.famille = { id: familleId, ...familleDoc.data() };
                }
              }

              InactivityManager.init();
              resolve(true);
              return;
            }
          } catch (error) {
            console.error('Erreur récupération données:', error);
          }
        }
        resolve(false);
      });
    });
  },

  async createMembre(membreData) {
    try {
      App.showLoading();

      if (!Permissions.canAddDisciple()) {
        throw new Error('Permission refusée');
      }

      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      // Créer l'utilisateur
      const userCredential = await auth.createUserWithEmailAndPassword(
        membreData.email,
        tempPassword
      );

      const uid = userCredential.user.uid;

      const newMembre = {
        email: membreData.email.toLowerCase().trim(),
        nom: membreData.nom.trim(),
        prenom: membreData.prenom.trim(),
        famille_id: AppState.famille.id,
        mentor_id: membreData.mentor_id || AppState.user.id,
        role: membreData.role || 'disciple',
        statut_compte: 'actif',
        sexe: null,
        date_naissance: null,
        adresse_ville: null,
        adresse_code_postal: null,
        telephone: null,
        date_arrivee_icc: null,
        formations: [],
        ministere_service: null,
        baptise_immersion: null,
        profession: null,
        statut_professionnel: null,
        passions_centres_interet: null,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('utilisateurs').doc(uid).set(newMembre);

      Toast.success(`${membreData.prenom} a été ajouté avec succès`);
      console.log('Mot de passe temporaire:', tempPassword);
      
      return { id: uid, ...newMembre };

    } catch (error) {
      console.error('Erreur création membre:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        Toast.error('Cet email est déjà utilisé');
      } else {
        Toast.error(error.message || 'Erreur lors de la création');
      }
      throw error;
    } finally {
      App.hideLoading();
    }
  },

  async resetPassword(email) {
    try {
      await auth.sendPasswordResetEmail(email);
      Toast.success('Email de réinitialisation envoyé');
    } catch (error) {
      console.error('Erreur reset password:', error);
      Toast.error('Erreur lors de l\'envoi de l\'email');
    }
  }
};

// ============================================
// PERMISSIONS
// ============================================

const Permissions = {
  hasRole(requiredRole) {
    if (!AppState.user) return false;
    return Utils.getRoleLevel(AppState.user.role) >= Utils.getRoleLevel(requiredRole);
  },

  canViewAllMembers() {
    return this.hasRole('berger');
  },

  canAddDisciple() {
    return this.hasRole('mentor');
  },

  canAddNouveau() {
    return this.hasRole('berger');
  },

  canMarkPresence(discipleId) {
    if (!AppState.user) return false;
    if (this.hasRole('berger')) return true;
    
    const disciple = AppState.membres.find(m => m.id === discipleId);
    return disciple && disciple.mentor_id === AppState.user.id;
  },

  canViewStats() {
    return this.hasRole('mentor');
  },

  canExportPDF() {
    return this.hasRole('mentor');
  },

  canManagePrograms() {
    return this.hasRole('adjoint_berger');
  },

  canManageDocuments() {
    return this.hasRole('adjoint_berger');
  },

  canEditMember(membreId) {
    if (!AppState.user) return false;
    if (membreId === AppState.user.id) return true;
    if (this.hasRole('berger')) return true;
    return false;
  },

  isAdmin() {
    return AppState.user && AppState.user.role === 'admin';
  }
};

// ============================================
// GESTION DES MEMBRES
// ============================================

const Membres = {
  async loadAll() {
    try {
      const familleId = AppState.famille?.id;
      if (!familleId) return [];

      const query = db.collection('utilisateurs')
        .where('famille_id', '==', familleId);

      const snapshot = await query.get();
      AppState.membres = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return AppState.membres;
    } catch (error) {
      console.error('Erreur chargement membres:', error);
      Toast.error('Erreur lors du chargement des membres');
      return [];
    }
  },

  getDisciples(mentorId) {
    return AppState.membres.filter(m => m.mentor_id === mentorId);
  },

  getById(id) {
    return AppState.membres.find(m => m.id === id);
  },

  async update(id, data) {
    try {
      if (!Permissions.canEditMember(id)) {
        throw new Error('Permission refusée');
      }

      await db.collection('utilisateurs').doc(id).update({
        ...data,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      const index = AppState.membres.findIndex(m => m.id === id);
      if (index !== -1) {
        AppState.membres[index] = { ...AppState.membres[index], ...data };
      }

      if (id === AppState.user.id) {
        AppState.user = { ...AppState.user, ...data };
      }

      Toast.success('Profil mis à jour');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour membre:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  async delete(id) {
    try {
      if (!Permissions.hasRole('berger')) {
        throw new Error('Permission refusée');
      }

      await db.collection('utilisateurs').doc(id).update({
        statut_compte: 'inactif',
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      AppState.membres = AppState.membres.filter(m => m.id !== id);
      Toast.success('Membre désactivé');
      return true;
    } catch (error) {
      console.error('Erreur suppression membre:', error);
      Toast.error('Erreur lors de la suppression');
      return false;
    }
  },

  getMentors() {
    return AppState.membres.filter(m => 
      ['mentor', 'berger', 'admin'].includes(m.role) && 
      m.statut_compte === 'actif'
    );
  },

  getStats() {
    const actifs = AppState.membres.filter(m => m.statut_compte === 'actif');
    return {
      total: actifs.length,
      parRole: {
        disciples: actifs.filter(m => m.role === 'disciple').length,
        nouveaux: actifs.filter(m => m.role === 'nouveau').length,
        mentors: actifs.filter(m => m.role === 'mentor').length,
        adjoints: actifs.filter(m => m.role === 'adjoint_berger').length,
        bergers: actifs.filter(m => m.role === 'berger').length,
      },
      anniversairesAujourdhui: actifs.filter(m => Utils.isBirthday(m.date_naissance))
    };
  }
};
