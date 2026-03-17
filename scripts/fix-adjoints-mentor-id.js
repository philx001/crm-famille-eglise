/**
 * Script pour remettre mentor_id à null pour tous les adjoints superviseur.
 * Les adjoints sont des comptes de service et ne doivent pas être affectés à un mentor.
 *
 * Usage : node fix-adjoints-mentor-id.js [--key=chemin/vers/serviceAccountKey.json]
 */

const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const keyFromArg = process.argv.find((a) => a.startsWith('--key='));
const keyPath = keyFromArg ? keyFromArg.replace('--key=', '').trim() : path.join(__dirname, 'serviceAccountKey.json');

async function main() {
  console.log('Script : Correction mentor_id des adjoints superviseur\n');

  const fs = require('fs');
  if (!fs.existsSync(keyPath)) {
    console.error(
      `Fichier de clé introuvable: ${keyPath}\n` +
      'Téléchargez la clé de compte de service depuis la console Firebase :\n' +
      '  Paramètres du projet > Comptes de service > Générer une nouvelle clé privée\n' +
      'Puis placez le fichier JSON dans le dossier scripts/ ou indiquez le chemin avec --key='
    );
    process.exit(1);
  }

  const key = require(keyPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();

  const adjointsSnap = await db.collection('utilisateurs')
    .where('role', '==', 'adjoint_superviseur')
    .get();

  const avecMentor = adjointsSnap.docs.filter(doc => doc.data().mentor_id != null);

  if (avecMentor.length === 0) {
    console.log('Aucun adjoint superviseur avec mentor_id à corriger.');
    rl.close();
    process.exit(0);
    return;
  }

  console.log(`${avecMentor.length} adjoint(s) superviseur avec mentor_id à corriger :`);
  avecMentor.forEach(doc => {
    const d = doc.data();
    console.log(`  - ${d.prenom || ''} ${d.nom || ''} (${doc.id})`);
  });

  const rep = await ask('\nMettre mentor_id à null pour ces adjoints ? (oui/non) : ');
  if (rep.toLowerCase() !== 'oui') {
    console.log('Annulé.');
    rl.close();
    process.exit(0);
    return;
  }

  const batch = db.batch();
  avecMentor.forEach(doc => {
    batch.update(doc.ref, {
      mentor_id: null,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();

  console.log(`\n${avecMentor.length} adjoint(s) corrigé(s).`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
