// ============================================
// AUTHENTIFICATION
// ============================================

const Auth = {
  async login(email, password, familleNom) {
    App.showLoading();
    const LOGIN_TIMEOUT_MS = 30000; // 30 s max : évite spinner bloqué sur "Se connecter"
    let loginAborted = false;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        loginAborted = true;
        reject(Object.assign(new Error('Connexion trop longue'), { code: 'auth/timeout' }));
      }, LOGIN_TIMEOUT_MS)
    );
    const loginTask = (async () => {
      try {
        try {
          await auth.signOut();
        } catch (_) {}
        let familleQuery;
        try {
          familleQuery = await db.collection('familles')
            .where('nom', '==', familleNom.toLowerCase().trim())
            .where('statut', '==', 'actif')
            .get();
        } catch (e) {
          console.error('Erreur Firestore (requête familles):', e);
          throw e;
        }
        if (familleQuery.empty) {
          throw new Error('Famille non trouvée ou inactive');
        }
        const familleDoc = familleQuery.docs[0];
        const familleId = familleDoc.id;
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        await new Promise(resolve => setTimeout(resolve, 1000));
        let userDoc;
        try {
          userDoc = await db.collection('utilisateurs').doc(uid).get();
        } catch (e) {
          console.error('Erreur Firestore (lecture utilisateur):', e);
          throw e;
        }
        if (!userDoc.exists) {
          await auth.signOut();
          throw new Error('Utilisateur non trouvé dans la base de données');
        }
        const userData = userDoc.data();
        if (userData.role !== 'admin' && userData.famille_id !== familleId) {
          await auth.signOut();
          throw new Error('Vous n\'appartenez pas à cette famille');
        }
        if (userData.statut_compte !== 'actif') {
          await auth.signOut();
          throw new Error('Votre compte est inactif. Contactez votre Berger.');
        }
        try {
          await db.collection('utilisateurs').doc(uid).update({
            derniere_connexion: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {
          console.error('Erreur Firestore (mise à jour derniere_connexion):', e);
          throw e;
        }
        if (loginAborted) return;
        AppState.user = { id: uid, ...userData };
        AppState.famille = { id: familleId, ...familleDoc.data() };
        localStorage.setItem('crm_famille_id', familleId);
        localStorage.setItem('crm_famille_nom', familleNom);
        InactivityManager.init();
        App.navigate('dashboard');
        Toast.success(`Bienvenue ${userData.prenom} !`);
      } catch (err) {
        throw err;
      }
    })();

    try {
      await Promise.race([loginTask, timeoutPromise]);
    } catch (error) {
      console.error('Erreur de connexion:', error);
      if (error.code === 'auth/timeout' || error.message === 'Connexion trop longue') {
        Toast.error('Connexion trop longue. Vérifiez votre connexion Internet et réessayez.');
        return;
      }
      if (error.code === 'permission-denied' || (error.message && error.message.includes('insufficient permissions'))) {
        Toast.error('Règles Firestore : la lecture des collections familles et utilisateurs (ou la mise à jour du profil) est refusée. Vérifiez les règles dans la console Firebase.');
        return;
      }
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
    const AUTH_TIMEOUT_MS = 20000; // 20 s pour laisser Firebase restaurer la session après F5
    return new Promise((resolve) => {
      let resolved = false;
      const done = (value) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };
      const timeoutId = setTimeout(() => {
        console.warn('Firebase Auth : délai dépassé (' + (AUTH_TIMEOUT_MS / 1000) + ' s). Affichage de la page de connexion.');
        done(false);
      }, AUTH_TIMEOUT_MS);
      auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const userDoc = await db.collection('utilisateurs').doc(firebaseUser.uid).get();
            clearTimeout(timeoutId);
            if (resolved) return;
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
              done(true);
              return;
            }
          } catch (error) {
            console.error('Erreur récupération données:', error);
            clearTimeout(timeoutId);
            done(false);
            return;
          }
        }
        clearTimeout(timeoutId);
        done(false);
      });
    });
  },

  async createMembre(membreData) {
    try {
      App.showLoading();

      if (!Permissions.canAddDisciple()) {
        throw new Error('Permission refusée');
      }

      // Sauvegarder les infos de l'admin AVANT la création (car createUserWithEmailAndPassword va le déconnecter)
      const adminFamilleId = AppState.famille.id;
      const adminFamilleNom = AppState.famille.nom;
      const adminUserId = AppState.user.id;
      const adminMentorId = membreData.mentor_id || adminUserId;

      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      // Créer l'utilisateur Firebase Auth (ATTENTION : ceci connecte le nouveau membre !)
      const userCredential = await auth.createUserWithEmailAndPassword(
        membreData.email,
        tempPassword
      );

      const uid = userCredential.user.uid;

      // Préparer les données du nouveau membre
      const newMembre = {
        email: membreData.email.toLowerCase().trim(),
        nom: membreData.nom.trim(),
        prenom: membreData.prenom.trim(),
        famille_id: adminFamilleId,
        mentor_id: adminMentorId,
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

      // Créer le document Firestore (le nouveau membre est maintenant connecté, les règles permettent request.auth.uid == userId)
      await db.collection('utilisateurs').doc(uid).set(newMembre);

      // Envoyer un email de réinitialisation de mot de passe
      try {
        await auth.sendPasswordResetEmail(membreData.email);
      } catch (emailErr) {
        console.warn('Impossible d\'envoyer l\'email de réinitialisation:', emailErr);
      }

      // Vider l'état AVANT signOut pour éviter que onAuthStateChanged affiche "Session expirée"
      AppState.user = null;
      AppState.famille = null;
      AppState.membres = [];
      InactivityManager.stop();

      // Déconnecter le nouveau membre (l'utilisateur actuel devra se reconnecter)
      await auth.signOut();

      localStorage.removeItem('crm_famille_id');
      localStorage.setItem('crm_famille_nom', adminFamilleNom);

      App.showLoginPage();

      Toast.success(`${membreData.prenom} a été ajouté avec succès. Reconnectez-vous pour continuer.`);
      console.log('Mot de passe temporaire:', tempPassword);
      
      return { id: uid, tempPassword, adminDisconnected: true, ...newMembre };

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
  },

  // Changer le mot de passe de l'utilisateur connecté
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('Utilisateur non connecté');
      }

      // Vérifier que l'ancien mot de passe est correct en réauthentifiant
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);

      // Changer le mot de passe
      await user.updatePassword(newPassword);

      Toast.success('Mot de passe modifié avec succès');
      return true;
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      
      let message = 'Erreur lors du changement de mot de passe';
      if (error.code === 'auth/wrong-password') {
        message = 'Mot de passe actuel incorrect';
      } else if (error.code === 'auth/weak-password') {
        message = 'Le nouveau mot de passe est trop faible (minimum 6 caractères)';
      } else if (error.message) {
        message = error.message;
      }
      
      Toast.error(message);
      throw error;
    }
  },

  // Upload photo de profil
  async uploadPhotoProfil(file) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Vérifier le type de fichier (MIME type strict)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const ext = (file.name.split('.').pop() || '').toLowerCase();

      if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(ext)) {
        throw new Error('Le fichier doit être une image (JPG, PNG, GIF ou WebP uniquement). Les PDF et autres documents ne sont pas acceptés.');
      }

      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('L\'image est trop volumineuse (maximum 5MB)');
      }

      // Créer une référence dans Storage
      const fileExtension = file.name.split('.').pop();
      const fileName = `photo.${fileExtension}`;
      const storageRef = storage.ref(`avatars/${user.uid}/${fileName}`);

      // Upload le fichier (utiliser la même méthode que app-documents.js)
      const uploadTask = storageRef.put(file);
      
      // Attendre la fin de l'upload (utiliser await directement)
      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => reject(error),
          () => resolve() // Upload terminé
        );
      });

      // Récupérer l'URL de téléchargement depuis uploadTask.snapshot.ref (comme dans app-documents.js)
      const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
      
      // Mettre à jour le document utilisateur dans Firestore
      await db.collection('utilisateurs').doc(user.uid).update({
        photo_url: downloadURL,
        photo_updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Mettre à jour AppState.user
      if (AppState.user) {
        AppState.user.photo_url = downloadURL;
      }

      Toast.success('Photo de profil mise à jour avec succès');
      return downloadURL;
    } catch (error) {
      console.error('Erreur upload photo:', error);
      let message = 'Erreur lors de l\'upload de la photo';
      if (error.message) {
        message = error.message;
      }
      Toast.error(message);
      throw error;
    }
  },

  // Supprimer la photo de profil
  async deletePhotoProfil() {
    try {
      const user = auth.currentUser;
      if (!user || !AppState.user?.photo_url) {
        return;
      }

      // Supprimer de Storage
      const storageRef = storage.refFromURL(AppState.user.photo_url);
      await storageRef.delete();

      // Mettre à jour Firestore
      await db.collection('utilisateurs').doc(user.uid).update({
        photo_url: firebase.firestore.FieldValue.delete(),
        photo_updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Mettre à jour AppState
      if (AppState.user) {
        AppState.user.photo_url = null;
      }

      Toast.success('Photo de profil supprimée');
    } catch (error) {
      console.error('Erreur suppression photo:', error);
      // Même si la suppression de Storage échoue, on peut quand même supprimer l'URL dans Firestore
      try {
        await db.collection('utilisateurs').doc(auth.currentUser.uid).update({
          photo_url: firebase.firestore.FieldValue.delete()
        });
        if (AppState.user) {
          AppState.user.photo_url = null;
        }
        Toast.success('Photo de profil supprimée');
      } catch (e) {
        Toast.error('Erreur lors de la suppression de la photo');
      }
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

  // Nouvelles Âmes
  canViewNouvellesAmes() {
    return this.hasRole('mentor');
  },

  canManageNouvellesAmes() {
    return this.hasRole('mentor');
  },

  canConvertNouvelleAme() {
    return this.hasRole('adjoint_berger');
  },

  canDeleteNouvelleAme() {
    return this.hasRole('berger');
  },

  // Évangélisation
  canViewEvangelisation() {
    return this.hasRole('mentor');
  },

  canManageEvangelisation() {
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
