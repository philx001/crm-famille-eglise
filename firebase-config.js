// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCjbbkz_cXT9sd9D0J67k-T_q2NC1udIKE",
  authDomain: "crm-famille-eglise.firebaseapp.com",
  projectId: "crm-famille-eglise",
  storageBucket: "crm-famille-eglise.firebasestorage.app",
  messagingSenderId: "317522564980",
  appId: "1:317522564980:web:35cb69340123414181be21"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);

// Second app : création de comptes Auth sans remplacer la session de l’utilisateur connecté (principal)
let secondaryApp;
try {
  secondaryApp = firebase.app('UserCreate');
} catch (e) {
  secondaryApp = firebase.initializeApp(firebaseConfig, 'UserCreate');
}
const secondaryAuth = firebase.auth(secondaryApp);
// Persistance mémoire uniquement : évite les collisions IndexedDB / événements fantômes sur l’auth [DEFAULT]
window._secondaryAuthPersistenceSet = secondaryAuth
  .setPersistence(firebase.auth.Auth.Persistence.NONE)
  .catch((err) => console.warn('Persistance auth secondaire:', err.message));
window.secondaryAuth = secondaryAuth;

// Services Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Persistance de la session (rester connecté après actualisation)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
  console.warn('Persistance Auth:', err.message);
});

// Configuration de la persistance locale
db.enablePersistence().catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistance impossible: plusieurs onglets ouverts');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistance non supportée par ce navigateur');
  }
});

// Export pour utilisation dans les autres fichiers
window.firebaseServices = { auth, db, storage, secondaryAuth };
