// ============================================
// AUTHENTIFICATION
// ============================================

const Auth = {
  async loadFamiliesForLogin() {
    const select = document.getElementById('login-famille');
    if (!select || typeof db === 'undefined') return;
    try {
      const snapshot = await db.collection('familles')
        .where('statut', '==', 'actif')
        .get();
      const saved = localStorage.getItem('crm_famille_nom') || '';
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => (a.nom_affichage || a.nom || '').localeCompare(b.nom_affichage || b.nom || ''));
      docs.forEach(d => {
        const nom = d.nom || d.id;
        const label = d.nom_affichage || nom;
        const opt = document.createElement('option');
        opt.value = nom;
        opt.textContent = label;
        if (saved && (nom === saved || label === saved)) opt.selected = true;
        select.appendChild(opt);
      });
    } catch (e) {
      console.warn('Chargement des familles pour connexion:', e);
    }
  },

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
          throw new Error('Votre compte est inactif. Contactez votre superviseur.');
        }
        try {
          await db.collection('utilisateurs').doc(uid).update({
            derniere_connexion: firebase.firestore.FieldValue.serverTimestamp()
          });
          await db.collection('logs_connexion').add({
            user_id: uid,
            email: userData.email || '',
            prenom: userData.prenom || '',
            nom: userData.nom || '',
            role: userData.role || '',
            famille_id: familleId,
            date: firebase.firestore.FieldValue.serverTimestamp()
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
      // Vider l'état AVANT signOut pour que onAuthStateChanged ne déclenche pas "Session expirée"
      AppState.user = null;
      AppState.famille = null;
      AppState.membres = [];
      localStorage.removeItem('crm_famille_id');
      localStorage.removeItem('crm_famille_nom');
      await auth.signOut();
      App.showLoginPage();
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      Toast.error('Erreur lors de la déconnexion');
    }
  },

  async checkAuthState() {
    const AUTH_TIMEOUT_MS = 10000; // 10 s pour laisser Firebase restaurer la session après F5
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

      const role = membreData.role || 'disciple';
      const canAdd = role === 'nouveau' ? Permissions.canAddNouveau() : Permissions.canAddDisciple();
      if (!canAdd) {
        throw new Error('Permission refusée');
      }

      // Sauvegarder les infos de l'admin AVANT la création (car createUserWithEmailAndPassword va le déconnecter)
      const adminFamilleId = AppState.famille.id;
      const adminFamilleNom = AppState.famille.nom;
      const adminUserId = AppState.user.id;
      const rolesSansMentor = ['superviseur', 'nouveau', 'adjoint_superviseur'];
      const mentorId = rolesSansMentor.includes(role) ? null : (membreData.mentor_id || adminUserId);

      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      // Créer l'utilisateur Firebase Auth (ATTENTION : ceci connecte le nouveau membre !)
      const userCredential = await auth.createUserWithEmailAndPassword(
        membreData.email,
        tempPassword
      );

      const uid = userCredential.user.uid;

      // Préparer les données du nouveau membre (réutilise membreData quand fourni, ex. conversion NA/NC)
      const newMembre = {
        email: membreData.email.toLowerCase().trim(),
        nom: membreData.nom.trim(),
        prenom: membreData.prenom.trim(),
        famille_id: adminFamilleId,
        mentor_id: mentorId,
        role: role,
        statut_compte: 'actif',
        sexe: membreData.sexe ?? null,
        date_naissance: membreData.date_naissance ?? null,
        adresse_ville: membreData.adresse_ville ?? null,
        adresse_code_postal: membreData.adresse_code_postal ?? null,
        indicatif_telephone: membreData.indicatif_telephone ?? null,
        telephone: membreData.telephone ?? null,
        date_arrivee_icc: membreData.date_arrivee_icc ?? null,
        date_arrivee_famille: membreData.date_arrivee_famille ?? null,
        formations: Array.isArray(membreData.formations) ? membreData.formations : [],
        ministere_service: membreData.ministere_service ?? null,
        baptise_immersion: membreData.baptise_immersion ?? null,
        profession: membreData.profession ?? null,
        statut_professionnel: membreData.statut_professionnel ?? null,
        passions_centres_interet: membreData.passions_centres_interet ?? null,
        vehicule: membreData.vehicule ?? false,
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

  async createFamille(nom) {
    if (!AppState.user || AppState.user.role !== 'admin') {
      throw new Error('Réservé à l\'administrateur');
    }
    const nomTrim = (nom || '').trim();
    if (!nomTrim) throw new Error('Nom de famille requis');
    const nomLower = nomTrim.toLowerCase();
    const snapshot = await db.collection('familles').where('nom', '==', nomLower).get();
    if (!snapshot.empty) {
      throw new Error('Une famille avec ce nom existe déjà');
    }
    const docRef = await db.collection('familles').add({
      nom: nomLower,
      nom_affichage: nomTrim,
      statut: 'actif',
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, nom: nomLower, nom_affichage: nomTrim, statut: 'actif' };
  },

  /** Supprimer une famille et toutes ses données Firestore (admin uniquement). Les comptes Auth restent ; pour suppression complète, exécuter scripts/delete-family.js */
  async deleteFamille(familleId) {
    if (!AppState.user || AppState.user.role !== 'admin') {
      throw new Error('Réservé à l\'administrateur');
    }
    const familleDoc = await db.collection('familles').doc(familleId).get();
    if (!familleDoc.exists) throw new Error('Famille non trouvée');
    const nomAffichage = familleDoc.data().nom_affichage || familleDoc.data().nom || familleId;

    const BATCH_SIZE = 500;
    const deleteQueryBatch = async (query) => {
      let total = 0;
      let snapshot = await query.limit(BATCH_SIZE).get();
      while (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        total += snapshot.size;
        snapshot = await query.limit(BATCH_SIZE).get();
      }
      return total;
    };

    // 1. Présences (by programme_id)
    const progSnap = await db.collection('programmes').where('famille_id', '==', familleId).get();
    const programmeIds = progSnap.docs.map((d) => d.id);
    for (let i = 0; i < programmeIds.length; i += 10) {
      const chunk = programmeIds.slice(i, i + 10);
      await deleteQueryBatch(db.collection('presences').where('programme_id', 'in', chunk));
    }

    // 2. programmes, notifications, sujets_priere, temoignages, documents, planning_conducteurs_priere
    const colsPhase2 = ['programmes', 'notifications', 'sujets_priere', 'temoignages', 'documents', 'planning_conducteurs_priere'];
    for (const col of colsPhase2) {
      await deleteQueryBatch(db.collection(col).where('famille_id', '==', familleId));
    }

    // 3. suivis_ames (AVANT nouvelles_ames)
    const naSnap = await db.collection('nouvelles_ames').where('famille_id', '==', familleId).get();
    const naIds = naSnap.docs.map((d) => d.id);
    for (let i = 0; i < naIds.length; i += 10) {
      const chunk = naIds.slice(i, i + 10);
      await deleteQueryBatch(db.collection('suivis_ames').where('nouvelle_ame_id', 'in', chunk));
    }

    // 4. nouvelles_ames, sessions_evangelisation, secteurs_evangelisation, notes_suivi
    const colsPhase4 = ['nouvelles_ames', 'sessions_evangelisation', 'secteurs_evangelisation', 'notes_suivi'];
    for (const col of colsPhase4) {
      await deleteQueryBatch(db.collection(col).where('famille_id', '==', familleId));
    }

    // 5. notes_personnelles (by auteur_id in family users)
    const usersSnap = await db.collection('utilisateurs').where('famille_id', '==', familleId).get();
    const userIds = usersSnap.docs.map((d) => d.id);
    for (let i = 0; i < userIds.length; i += 10) {
      const chunk = userIds.slice(i, i + 10);
      for (const logCol of ['logs_connexion', 'logs_modification']) {
        try {
          await deleteQueryBatch(db.collection(logCol).where('user_id', 'in', chunk));
        } catch (e) {
          if (!e.message || !e.message.includes('index')) throw e;
        }
      }
      for (const uid of chunk) {
        await deleteQueryBatch(db.collection('notes_personnelles').where('auteur_id', '==', uid));
      }
    }

    // 6. utilisateurs Firestore (Auth non supprimé depuis le client)
    // Ne pas supprimer le doc de l'admin connecté (évite de se supprimer soi-même)
    const currentUid = AppState.user?.id;
    for (const doc of usersSnap.docs) {
      if (doc.id === currentUid && doc.data().role === 'admin') continue;
      await db.collection('utilisateurs').doc(doc.id).delete();
    }

    // 7. Storage (documents, temoignages) - si storage disponible
    if (typeof storage !== 'undefined') {
      const deleteFolder = async (path) => {
        try {
          const ref = storage.ref(path);
          const list = await ref.listAll();
          for (const item of list.items) await item.delete();
          for (const prefix of list.prefixes) {
            const sub = await prefix.listAll();
            for (const f of sub.items) await f.delete();
          }
        } catch (e) {
          if (e.code !== 'storage/object-not-found') console.warn('Storage', path, e);
        }
      };
      await deleteFolder(`documents/${familleId}`);
      await deleteFolder(`temoignages/${familleId}`);
    }

    // 8. Document famille
    await db.collection('familles').doc(familleId).delete();
    return { success: true, nomAffichage };
  },

  async createMembreForFamily(familleId, membreData) {
    if (!AppState.user || AppState.user.role !== 'admin') {
      throw new Error('Réservé à l\'administrateur');
    }
    const familleDoc = await db.collection('familles').doc(familleId).get();
    if (!familleDoc.exists) throw new Error('Famille non trouvée');
    const familleNom = familleDoc.data().nom_affichage || familleDoc.data().nom;

    App.showLoading();
    try {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      const userCredential = await auth.createUserWithEmailAndPassword(
        membreData.email,
        tempPassword
      );
      const uid = userCredential.user.uid;

      const newMembre = {
        email: membreData.email.toLowerCase().trim(),
        nom: (membreData.nom || '').trim(),
        prenom: (membreData.prenom || '').trim(),
        famille_id: familleId,
        mentor_id: null,
        role: membreData.role || 'superviseur',
        statut_compte: 'actif',
        sexe: null,
        date_naissance: null,
        adresse_ville: null,
        adresse_code_postal: null,
        indicatif_telephone: null,
        telephone: null,
        date_arrivee_icc: null,
        date_arrivee_famille: null,
        formations: [],
        ministere_service: null,
        baptise_immersion: null,
        profession: null,
        statut_professionnel: null,
        passions_centres_interet: null,
        vehicule: false,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('utilisateurs').doc(uid).set(newMembre);

      try {
        await auth.sendPasswordResetEmail(membreData.email);
      } catch (emailErr) {
        console.warn('Impossible d\'envoyer l\'email de réinitialisation:', emailErr);
      }

      AppState.user = null;
      AppState.famille = null;
      AppState.membres = [];
      InactivityManager.stop();
      await auth.signOut();
      localStorage.removeItem('crm_famille_id');
      localStorage.setItem('crm_famille_nom', familleNom);
      App.showLoginPage();
      Toast.success(`${newMembre.prenom} a été ajouté comme superviseur de la famille. Reconnectez-vous.`);
      console.log('Mot de passe temporaire:', tempPassword);
      return { id: uid, tempPassword, adminDisconnected: true, ...newMembre };
    } catch (error) {
      console.error('Erreur création membre pour famille:', error);
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
    return this.hasRole('superviseur');
  },

  /** Adjoint peut voir la page "Tous les membres" en lecture seule (liste + filtres, pas d'édition/blocage/export). */
  canViewMembersListReadOnly() {
    return this.hasRole('adjoint_superviseur');
  },

  /** True si l'utilisateur est adjoint_superviseur (et pas superviseur/admin) — pour masquer champs personnels. */
  isAdjointSuperviseurOnly() {
    return AppState.user && AppState.user.role === 'adjoint_superviseur';
  },

  canAddDisciple() {
    return this.hasRole('mentor');
  },

  canAddNouveau() {
    return this.hasRole('mentor');
  },

  canMarkPresence(discipleId) {
    if (!AppState.user) return false;
    if (this.hasRole('superviseur')) return true;
    
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
    return this.hasRole('adjoint_superviseur');
  },

  /** Suppression de programmes : superviseur ou admin uniquement (cohérent avec Firestore). */
  canDeletePrograms() {
    return this.hasRole('superviseur') || this.isAdmin();
  },

  /** Peut créer/modifier/supprimer le planning des conducteurs de prière. Lecture pour tous. */
  canManagePlanningConducteurs() {
    return this.hasRole('adjoint_superviseur') || this.hasRole('superviseur') || this.isAdmin();
  },

  /** Disciple ou Nouveau : accès à la page Programmes en lecture seule. */
  canViewProgrammesReadOnly() {
    if (!AppState.user) return false;
    return AppState.user.role === 'disciple' || AppState.user.role === 'nouveau';
  },

  /** Mentor+ : accès à la page de pointage des présences (liste des disciples à pointer). */
  canAccessPresencesPage() {
    return this.hasRole('mentor');
  },

  /** Peut pointer les présences des NA/NC : mentor (uniquement ses NA/NC), rôles supérieurs (adjoint_superviseur, superviseur, admin) pour tous. */
  canPointNANCPresence() {
    return this.hasRole('mentor');
  },

  /** Rôles supérieurs au mentor : peuvent pointer tous les membres et NA/NC (adjoint_superviseur, superviseur, admin). */
  isRoleSuperiorToMentor() {
    return this.hasRole('adjoint_superviseur');
  },

  /** Disciple ou Nouveau : peut pointer uniquement sa propre présence à un programme. */
  canMarkOwnPresence() {
    if (!AppState.user) return false;
    return AppState.user.role === 'disciple' || AppState.user.role === 'nouveau';
  },

  canManageDocuments() {
    return this.hasRole('adjoint_superviseur');
  },

  // Nouvelles Âmes
  canViewNouvellesAmes() {
    return this.hasRole('mentor');
  },

  canManageNouvellesAmes() {
    return this.hasRole('mentor');
  },

  canConvertNouvelleAme() {
    return this.hasRole('adjoint_superviseur');
  },

  canDeleteNouvelleAme() {
    return this.hasRole('superviseur');
  },

  // Évangélisation
  canViewEvangelisation() {
    return this.hasRole('mentor');
  },

  canManageEvangelisation() {
    return this.hasRole('mentor');
  },

  canEditMember(membreId) {
    if (!AppState.user) return false;
    if (membreId === AppState.user.id) return true;
    const membre = AppState.membres?.find(m => m.id === membreId);
    if (membre?.role === 'admin' && !this.isAdmin()) return false; // Seul un admin peut modifier un admin
    if (this.hasRole('superviseur')) return true;
    return false;
  },

  /** Peut modifier uniquement la date d'arrivée dans la famille (mentor sur ses disciples, ou adjoint/superviseur/admin) */
  canEditDateArriveeFamille(membre) {
    if (!AppState.user || !membre) return false;
    if (this.hasRole('adjoint_superviseur') || this.hasRole('superviseur') || this.isAdmin()) return true;
    return this.hasRole('mentor') && membre.mentor_id === AppState.user.id;
  },

  /** Peut bloquer/débloquer (archiver) un membre : superviseur ou admin, pas soi-même */
  canBlockMember(member) {
    if (!AppState.user || !member) return false;
    if (member.id === AppState.user.id) return false;
    return this.hasRole('superviseur') || this.isAdmin();
  },

  /** Peut supprimer définitivement un membre (document Firestore) : admin uniquement. Le superviseur garde l'archivage. */
  canDeleteMemberPermanently(member) {
    if (!AppState.user || !member) return false;
    if (member.id === AppState.user.id) return false;
    return this.isAdmin();
  },

  /** Peut voir la page Archivage des membres */
  canViewArchivesMembres() {
    return this.hasRole('superviseur') || this.isAdmin();
  },

  /** Peut affecter un nouveau membre à n'importe quel mentor (formulaire d'ajout). Adjoint superviseur, superviseur, admin. */
  canAssignToAnyMentor() {
    return this.hasRole('adjoint_superviseur') || this.hasRole('superviseur') || this.isAdmin();
  },

  /** Peut réaffecter ce membre (disciple, nouveau, mentor, admin) à un autre mentor. Adjoint superviseur exclu : compte de service, non affectable. */
  canReassignMentor(membre) {
    if (!AppState.user || !membre) return false;
    if (membre.role === 'adjoint_superviseur') return false;
    const rolesAvecMentor = ['disciple', 'nouveau', 'mentor', 'admin'];
    if (!rolesAvecMentor.includes(membre.role)) return false;
    if (this.hasRole('adjoint_superviseur') || this.hasRole('superviseur') || this.isAdmin()) return true;
    if (this.hasRole('mentor') && membre.mentor_id === AppState.user.id) return true;
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

  /** Disciples d'un mentor. Superviseurs et adjoints exclus : ils ne sont pas des disciples. */
  getDisciples(mentorId) {
    return AppState.membres.filter(m =>
      m.mentor_id === mentorId &&
      m.role !== 'superviseur' &&
      m.role !== 'adjoint_superviseur'
    );
  },

  getById(id) {
    return AppState.membres.find(m => m.id === id);
  },

  async update(id, data) {
    try {
      const membre = this.getById(id);
      const canEditFull = Permissions.canEditMember(id);
      const canEditDateOnly = membre && Permissions.canEditDateArriveeFamille(membre) &&
        Object.keys(data).length === 1 && data.hasOwnProperty('date_arrivee_famille');
      if (!canEditFull && !canEditDateOnly) {
        throw new Error('Permission refusée');
      }
      // Superviseur et adjoint_superviseur : jamais de mentor_id (comptes de service)
      const payload = { ...data };
      const finalRole = payload.role ?? this.getById(id)?.role;
      if (finalRole === 'superviseur' || finalRole === 'adjoint_superviseur') payload.mentor_id = null;

      await db.collection('utilisateurs').doc(id).update({
        ...payload,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      const index = AppState.membres.findIndex(m => m.id === id);
      if (index !== -1) {
        AppState.membres[index] = { ...AppState.membres[index], ...payload };
      }

      if (id === AppState.user.id) {
        AppState.user = { ...AppState.user, ...payload };
      }

      Toast.success('Profil mis à jour');
      return true;
    } catch (error) {
      console.error('Erreur mise à jour membre:', error);
      Toast.error('Erreur lors de la mise à jour');
      return false;
    }
  },

  /**
   * Bloquer (archiver) un membre : compte inactif + date et commentaire d'archivage.
   * Le membre reste en base et apparaît dans "Archivage des membres".
   */
  async block(id, commentaireArchivage) {
    try {
      if (!Permissions.canBlockMember(Membres.getById(id))) {
        throw new Error('Permission refusée');
      }

      const payload = {
        statut_compte: 'inactif',
        date_archivage: firebase.firestore.FieldValue.serverTimestamp(),
        commentaire_archivage: (commentaireArchivage || '').trim() || null,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('utilisateurs').doc(id).update(payload);

      if (typeof AuditLog !== 'undefined') {
        const m = AppState.membres.find(mem => mem.id === id);
        AuditLog.recordModification(AppState.user.id, AppState.user.email, AppState.user.prenom, AppState.user.nom, AppState.user.role, 'archivage_membre', 'utilisateurs', id, m ? `${m.prenom} ${m.nom}` : null);
      }

      const idx = AppState.membres.findIndex(m => m.id === id);
      if (idx !== -1) {
        AppState.membres[idx].statut_compte = 'inactif';
        AppState.membres[idx].date_archivage = new Date();
        AppState.membres[idx].commentaire_archivage = (commentaireArchivage || '').trim() || null;
        AppState.membres[idx].updated_at = new Date();
      }
      Toast.success('Membre bloqué et archivé');
      return true;
    } catch (error) {
      console.error('Erreur blocage membre:', error);
      Toast.error(error.message || 'Erreur lors du blocage');
      return false;
    }
  },

  /**
   * Débloquer un membre : compte à nouveau actif (les champs d'archivage sont conservés pour l'historique).
   */
  async unblock(id) {
    try {
      if (!Permissions.canBlockMember(Membres.getById(id))) {
        throw new Error('Permission refusée');
      }

      await db.collection('utilisateurs').doc(id).update({
        statut_compte: 'actif',
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (typeof AuditLog !== 'undefined') {
        const m = AppState.membres.find(mem => mem.id === id);
        AuditLog.recordModification(AppState.user.id, AppState.user.email, AppState.user.prenom, AppState.user.nom, AppState.user.role, 'deblocage_membre', 'utilisateurs', id, m ? `${m.prenom} ${m.nom}` : null);
      }

      const idx = AppState.membres.findIndex(m => m.id === id);
      if (idx !== -1) {
        AppState.membres[idx].statut_compte = 'actif';
        AppState.membres[idx].updated_at = new Date();
      }
      Toast.success('Membre débloqué');
      return true;
    } catch (error) {
      console.error('Erreur déblocage membre:', error);
      Toast.error(error.message || 'Erreur lors du déblocage');
      return false;
    }
  },

  /** Ancienne méthode : équivalent à block(id, commentaire). Conservée pour compatibilité. */
  async delete(id, commentaireArchivage) {
    return this.block(id, commentaireArchivage);
  },

  /**
   * Supprimer définitivement un membre (document Firestore + présences associées).
   * À utiliser pour retirer un doublon ou un compte obsolète. Le compte Firebase Auth reste à supprimer manuellement si besoin.
   */
  async deletePermanently(id) {
    try {
      if (!Permissions.canDeleteMemberPermanently(Membres.getById(id))) {
        throw new Error('Permission refusée');
      }
      if (id === AppState.user?.id) {
        throw new Error('Vous ne pouvez pas supprimer votre propre compte.');
      }
      const batch = db.batch();
      const presencesSnap = await db.collection('presences').where('disciple_id', '==', id).get();
      presencesSnap.docs.forEach(doc => batch.delete(doc.ref));
      const presencesMentorSnap = await db.collection('presences').where('mentor_id', '==', id).get();
      presencesMentorSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      const m = Membres.getById(id);
      await db.collection('utilisateurs').doc(id).delete();
      const idx = AppState.membres.findIndex(mem => mem.id === id);
      if (idx !== -1) AppState.membres.splice(idx, 1);
      if (typeof AuditLog !== 'undefined' && m) {
        AuditLog.recordModification(AppState.user.id, AppState.user.email, AppState.user.prenom, AppState.user.nom, AppState.user.role, 'suppression_definitive_membre', 'utilisateurs', id, `${m.prenom || ''} ${m.nom || ''}`.trim() || id);
      }
      Toast.success('Membre supprimé définitivement de la base.');
      return true;
    } catch (error) {
      console.error('Erreur suppression définitive:', error);
      Toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  },

  /** Membres actifs visibles (adjoints superviseur masqués sauf pour admin). */
  /** Membres actifs visibles (annuaire, exports). Adjoints superviseur exclus partout : comptes de service. */
  getVisibleActifs() {
    return AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur'
    );
  },

  getMentors() {
    return AppState.membres.filter(m => 
      ['mentor', 'superviseur', 'admin'].includes(m.role) && 
      m.statut_compte === 'actif'
    );
  },

  /** Liste des membres pouvant être choisis comme mentor (pour réaffectation disciple/nouveau).
   * Les adjoints superviseur sont exclus : comptes de service, pas mentors. */
  getPossibleMentorsForReassign() {
    return AppState.membres.filter(m =>
      m.statut_compte === 'actif' &&
      ['mentor', 'superviseur', 'admin'].includes(m.role)
    );
  },

  /** Stats : adjoints superviseur exclus (comptes de service, pas membres réels). */
  getStats() {
    const actifs = AppState.membres.filter(m =>
      m.statut_compte === 'actif' && m.role !== 'adjoint_superviseur'
    );
    return {
      total: actifs.length,
      parRole: {
        disciples: actifs.filter(m => m.role === 'disciple').length,
        nouveaux: actifs.filter(m => m.role === 'nouveau').length,
        mentors: actifs.filter(m => ['mentor', 'admin'].includes(m.role)).length,
        adjoints: 0, // Adjoints exclus des stats (comptes de service)
        superviseurs: actifs.filter(m => m.role === 'superviseur').length,
      },
      anniversairesAujourdhui: actifs.filter(m => Utils.isBirthday(m.date_naissance))
    };
  }
};

// Journal d'activité (logs) — écriture côté client, lecture admin uniquement
const AuditLog = {
  async recordModification(userId, userEmail, userPrenom, userNom, userRole, action, collectionName, documentId, details) {
    try {
      await db.collection('logs_modification').add({
        user_id: userId,
        user_email: userEmail || '',
        user_prenom: userPrenom || '',
        user_nom: userNom || '',
        user_role: userRole || '',
        action,
        collection: collectionName,
        document_id: documentId || null,
        details: details || null,
        date: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn('AuditLog.recordModification:', e);
    }
  }
};
