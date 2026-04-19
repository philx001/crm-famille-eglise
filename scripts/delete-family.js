/**
 * Script pour supprimer proprement une famille et toutes ses données.
 * Supprime : membres (utilisateurs + Auth), contenu (programmes, présences, etc.), fichiers Storage, document famille.
 *
 * Usage : node delete-family.js --famille="aaaaaaaaaaa" [--key=chemin/vers/serviceAccountKey.json]
 *         node delete-family.js --famille_id=abc123 [--key=...]
 *
 * --famille : nom ou nom_affichage de la famille (ex: "aaaaaaaaaaa")
 * --famille_id : ID du document Firestore (alternative)
 */

const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const keyFromArg = process.argv.find((a) => a.startsWith('--key='));
const familleFromArg = process.argv.find((a) => a.startsWith('--famille='));
const familleIdFromArg = process.argv.find((a) => a.startsWith('--famille_id='));

const keyPath = keyFromArg ? keyFromArg.replace('--key=', '').trim() : path.join(__dirname, 'serviceAccountKey.json');
const familleNom = familleFromArg ? familleFromArg.replace('--famille=', '').trim() : null;
const familleIdArg = familleIdFromArg ? familleIdFromArg.replace('--famille_id=', '').trim() : null;

async function deleteQueryBatch(db, query, batchSize = 100) {
  let total = 0;
  let snapshot = await query.limit(batchSize).get();
  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snapshot.size;
    snapshot = await query.limit(batchSize).get();
  }
  return total;
}

async function main() {
  console.log('Script : Suppression propre d\'une famille\n');

  const fs = require('fs');
  if (!fs.existsSync(keyPath)) {
    console.error(
      `Fichier de clé introuvable: ${keyPath}\n` +
      'Utilisez: node delete-family.js --famille="nom" --key=chemin/vers/serviceAccountKey.json'
    );
    process.exit(1);
  }

  const key = require(keyPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();
  const auth = admin.auth();
  const bucket = admin.storage().bucket();

  let familleId;
  let familleDoc;

  if (familleIdArg) {
    familleDoc = await db.collection('familles').doc(familleIdArg).get();
    if (!familleDoc.exists) {
      console.error(`Famille avec ID "${familleIdArg}" introuvable.`);
      process.exit(1);
    }
    familleId = familleIdArg;
  } else if (familleNom) {
    const nomLower = familleNom.toLowerCase().trim();
    const snap = await db.collection('familles')
      .where('nom', '==', nomLower)
      .get();
    if (snap.empty) {
      const snap2 = await db.collection('familles')
        .where('nom_affichage', '==', familleNom.trim())
        .get();
      if (snap2.empty) {
        console.error(`Famille "${familleNom}" introuvable (vérifiez le nom exact).`);
        process.exit(1);
      }
      familleDoc = snap2.docs[0];
    } else {
      familleDoc = snap.docs[0];
    }
    familleId = familleDoc.id;
  } else {
    console.error('Indiquez --famille="nom" ou --famille_id=id');
    process.exit(1);
  }

  const data = familleDoc.data();
  const nomAffichage = data.nom_affichage || data.nom || familleId;
  console.log(`Famille trouvée : "${nomAffichage}" (ID: ${familleId})\n`);

  const rep = await ask(`Supprimer définitivement cette famille et TOUTES ses données ? (oui/non) : `);
  if (rep.toLowerCase() !== 'oui') {
    console.log('Annulé.');
    rl.close();
    process.exit(0);
  }

  console.log('\nSuppression en cours...\n');
  let grandTotal = 0;

  // 1. Presences (référencent programme_id)
  const progSnap = await db.collection('programmes').where('famille_id', '==', familleId).get();
  const programmeIds = progSnap.docs.map((d) => d.id);
  if (programmeIds.length > 0) {
    for (let i = 0; i < programmeIds.length; i += 10) {
      const chunk = programmeIds.slice(i, i + 10);
      const q = db.collection('presences').where('programme_id', 'in', chunk);
      const n = await deleteQueryBatch(db, q);
      grandTotal += n;
    }
    if (grandTotal > 0) console.log(`  presences: ${grandTotal} supprimés`);
  }

  // 2. programmes, notifications, sujets_priere, temoignages, documents, document_dossiers
  const collectionsPhase2 = ['programmes', 'notifications', 'sujets_priere', 'temoignages', 'documents', 'document_dossiers'];
  for (const col of collectionsPhase2) {
    const q = db.collection(col).where('famille_id', '==', familleId);
    const n = await deleteQueryBatch(db, q);
    if (n > 0) {
      console.log(`  ${col}: ${n} supprimés`);
      grandTotal += n;
    }
  }

  // 3. suivis_ames (AVANT nouvelles_ames, car référence nouvelle_ame_id)
  const naSnap = await db.collection('nouvelles_ames').where('famille_id', '==', familleId).get();
  const naIds = naSnap.docs.map((d) => d.id);
  if (naIds.length > 0) {
    for (let i = 0; i < naIds.length; i += 10) {
      const chunk = naIds.slice(i, i + 10);
      const q = db.collection('suivis_ames').where('nouvelle_ame_id', 'in', chunk);
      const n = await deleteQueryBatch(db, q);
      if (n > 0) {
        console.log(`  suivis_ames: ${n} supprimés`);
        grandTotal += n;
      }
    }
  }

  // 4. nouvelles_ames, sessions_evangelisation, secteurs_evangelisation, notes
  const collectionsPhase4 = ['nouvelles_ames', 'sessions_evangelisation', 'secteurs_evangelisation', 'notes_personnelles', 'notes_suivi'];
  for (const col of collectionsPhase4) {
    const q = db.collection(col).where('famille_id', '==', familleId);
    const n = await deleteQueryBatch(db, q);
    if (n > 0) {
      console.log(`  ${col}: ${n} supprimés`);
      grandTotal += n;
    }
  }

  // 5. Logs : supprimer ceux des utilisateurs de cette famille
  const usersSnap = await db.collection('utilisateurs').where('famille_id', '==', familleId).get();
  const userIds = usersSnap.docs.map((d) => d.id);
  if (userIds.length > 0) {
    for (let i = 0; i < userIds.length; i += 10) {
      const chunk = userIds.slice(i, i + 10);
      for (const logCol of ['logs_connexion', 'logs_modification']) {
        try {
          const q = db.collection(logCol).where('user_id', 'in', chunk);
          const n = await deleteQueryBatch(db, q);
          if (n > 0) {
            console.log(`  ${logCol}: ${n} supprimés`);
            grandTotal += n;
          }
        } catch (e) {
          if (e.message && e.message.includes('index')) {
            console.warn(`  ${logCol}: index manquant, ignoré`);
          } else {
            throw e;
          }
        }
      }
    }
  }

  // 6. Utilisateurs Firestore + Auth
  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    try {
      await auth.deleteUser(uid);
      process.stdout.write(`  Auth: ${doc.data().prenom || ''} ${doc.data().nom || ''} supprimé\r`);
    } catch (e) {
      console.warn(`  Auth: impossible de supprimer ${uid}: ${e.message}`);
    }
    await db.collection('utilisateurs').doc(uid).delete();
    grandTotal++;
  }
  if (usersSnap.size > 0) console.log(`  utilisateurs: ${usersSnap.size} supprimés`);

  // 7. Storage : documents et temoignages
  try {
    const [docFiles] = await bucket.getFiles({ prefix: `documents/${familleId}/` });
    for (const f of docFiles) {
      await f.delete();
      grandTotal++;
    }
    if (docFiles.length > 0) console.log(`  Storage documents/: ${docFiles.length} fichiers supprimés`);

    const [temFiles] = await bucket.getFiles({ prefix: `temoignages/${familleId}/` });
    for (const f of temFiles) {
      await f.delete();
      grandTotal++;
    }
    if (temFiles.length > 0) console.log(`  Storage temoignages/: ${temFiles.length} fichiers supprimés`);
  } catch (e) {
    console.warn('  Storage:', e.message);
  }

  // 8. Document famille
  await db.collection('familles').doc(familleId).delete();
  grandTotal++;
  console.log(`  familles: document "${nomAffichage}" supprimé`);

  console.log(`\nTerminé. Famille "${nomAffichage}" et toutes ses données ont été supprimées.`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
