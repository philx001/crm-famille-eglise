/**
 * Script pour supprimer toutes les données test Firestore (et optionnellement les utilisateurs Auth).
 * À lancer en ligne de commande : node reset-firestore-data.js [--key=chemin/vers/serviceAccountKey.json]
 *
 * Prérequis :
 * - Node.js installé
 * - npm install dans ce dossier (scripts/)
 * - Fichier de clé de compte de service Firebase (JSON) téléchargé depuis la Console Firebase
 */

const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// Chemin de la clé par défaut (à côté du script ou à la racine du projet)
const keyFromArg = process.argv.find((a) => a.startsWith('--key='));
const keyPath = keyFromArg
  ? keyFromArg.replace('--key=', '').trim()
  : path.join(__dirname, 'serviceAccountKey.json');

const COLLECTIONS_ORDER = [
  'presences',
  'programmes',
  'notifications',
  'sujets_priere',
  'temoignages',
  'documents',
  'document_dossiers',
  'suivis_ames',
  'nouvelles_ames',
  'sessions_evangelisation',
  'secteurs_evangelisation',
  'notes_personnelles',
  'notes_suivi',
  'logs_connexion',
  'logs_modification',
  'utilisateurs',
  // 'familles' : décommenter si vous voulez aussi supprimer les familles
];

async function deleteAllInCollection(db, collectionName, batchSize = 100) {
  const colRef = db.collection(collectionName);
  let total = 0;
  let snapshot = await colRef.limit(batchSize).get();
  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snapshot.size;
    process.stdout.write(`  ${collectionName}: ${total}\r`);
    snapshot = await colRef.limit(batchSize).get();
  }
  if (total > 0) console.log(`  ${collectionName}: ${total} supprimés`);
  return total;
}

async function main() {
  console.log('Script de réinitialisation des données Firestore\n');
  const fs = require('fs');
  if (!fs.existsSync(keyPath)) {
    console.error(
      `Fichier de clé introuvable: ${keyPath}\n` +
      'Téléchargez une clé de compte de service dans Firebase Console > Paramètres > Comptes de service > Générer une clé.\n' +
      'Puis: node reset-firestore-data.js --key=chemin/vers/serviceAccountKey.json'
    );
    process.exit(1);
  }

  const key = require(keyPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();
  const auth = admin.auth();

  const rep = await ask('Supprimer TOUTES les données Firestore (sans filtrer par famille) ? (oui/non) : ');
  if (rep.toLowerCase() !== 'oui') {
    console.log('Annulé.');
    rl.close();
    process.exit(0);
  }

  console.log('\nSuppression en cours...\n');
  let grandTotal = 0;

  for (const name of COLLECTIONS_ORDER) {
    try {
      const n = await deleteAllInCollection(db, name);
      grandTotal += n;
    } catch (e) {
      console.error(`  Erreur ${name}:`, e.message);
    }
  }

  console.log(`\nTotal documents supprimés: ${grandTotal}`);

  const delAuth = await ask('\nSupprimer aussi tous les utilisateurs Authentication ? (oui/non) : ');
  if (delAuth.toLowerCase() === 'oui') {
    let count = 0;
    let next;
    do {
      const list = await auth.listUsers(1000, next);
      for (const u of list.users) {
        await auth.deleteUser(u.uid);
        count++;
        process.stdout.write(`  Auth: ${count} utilisateurs supprimés\r`);
      }
      next = list.pageToken;
    } while (next);
    console.log(`  Auth: ${count} utilisateurs supprimés`);
  }

  console.log('\nTerminé.');
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
