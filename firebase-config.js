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

// Services Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configuration de la persistance locale
db.enablePersistence().catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistance impossible: plusieurs onglets ouverts');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistance non supportée par ce navigateur');
  }
});

// Export pour utilisation dans les autres fichiers
window.firebaseServices = { auth, db, storage };
