/**
 * Script pour supprimer UNIQUEMENT les documents de contenu (données créées par les membres).
 * Ne touche PAS à : utilisateurs, familles.
 * Les collections restent (vides). Les pages de l'app restent intactes.
 *
 * Usage : node delete-content-data-only.js [--key=chemin/vers/serviceAccountKey.json]
 */

const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const keyFromArg = process.argv.find((a) => a.startsWith('--key='));
const keyPath = keyFromArg
  ? keyFromArg.replace('--key=', '').trim()
  : path.join(__dirname, 'serviceAccountKey.json');

// Collections dont on supprime les documents (PAS utilisateurs, PAS familles)
const CONTENT_COLLECTIONS = [
  'presences',
  'programmes',
  'notifications',
  'sujets_priere',
  'temoignages',
  'documents',
  'suivis_ames',
  'nouvelles_ames',
  'sessions_evangelisation',
  'secteurs_evangelisation',
  'notes_personnelles',
  'notes_suivi',
  'logs_connexion',
  'logs_modification'
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
  console.log('Script : Suppression des données de contenu uniquement\n');
  console.log('Conservé : utilisateurs, familles');
  console.log('Supprimé : documents dans presences, programmes, notifications, etc.\n');

  const fs = require('fs');
  if (!fs.existsSync(keyPath)) {
    console.error(
      `Fichier de clé introuvable: ${keyPath}\n` +
      'Téléchargez une clé dans Firebase Console > Paramètres > Comptes de service > Générer une clé.\n' +
      'Puis: node delete-content-data-only.js --key=chemin/vers/serviceAccountKey.json'
    );
    process.exit(1);
  }

  const key = require(keyPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();

  const rep = await ask('Supprimer tous les documents de contenu (membres et familles conservés) ? (oui/non) : ');
  if (rep.toLowerCase() !== 'oui') {
    console.log('Annulé.');
    rl.close();
    process.exit(0);
  }

  console.log('\nSuppression en cours...\n');
  let grandTotal = 0;

  for (const name of CONTENT_COLLECTIONS) {
    try {
      const n = await deleteAllInCollection(db, name);
      grandTotal += n;
    } catch (e) {
      console.error(`  Erreur ${name}:`, e.message);
    }
  }

  console.log(`\nTotal documents supprimés: ${grandTotal}`);
  console.log('\nTerminé. Membres et familles conservés.');
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
