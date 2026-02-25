/**
 * Script pour garder uniquement les membres listés et supprimer tous les autres.
 * Lit le fichier membres-a-garder.txt (un email par ligne).
 * Réaffecte les disciples et programmes avant suppression. Supprime aussi les comptes Auth.
 *
 * Usage : node delete-members-except-keep-list.js [--key=chemin/vers/serviceAccountKey.json] [--list=chemin/vers/membres-a-garder.txt]
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const keyFromArg = process.argv.find((a) => a.startsWith('--key='));
const listFromArg = process.argv.find((a) => a.startsWith('--list='));
const keyPath = keyFromArg ? keyFromArg.replace('--key=', '').trim() : path.join(__dirname, 'serviceAccountKey.json');
const listPath = listFromArg ? listFromArg.replace('--list=', '').trim() : path.join(__dirname, 'membres-a-garder.txt');

function loadEmailsToKeep(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((e) => e && !e.startsWith('#'));
}

async function main() {
  console.log('Script : Garder certains membres, supprimer les autres\n');

  const emailsToKeep = loadEmailsToKeep(listPath);
  if (emailsToKeep.length === 0) {
    console.error(
      `Aucun email trouvé dans ${listPath}\n` +
      'Créez le fichier membres-a-garder.txt avec un email par ligne (les lignes commençant par # sont ignorées).\n' +
      'Exemple:\n  admin@famille.org\n  superviseur@famille.org'
    );
    process.exit(1);
  }

  console.log(`${emailsToKeep.length} membre(s) à garder :`);
  emailsToKeep.forEach((e) => console.log(`  - ${e}`));
  console.log('');

  if (!fs.existsSync(keyPath)) {
    console.error(
      `Fichier de clé introuvable: ${keyPath}\n` +
      'Utilisez: node delete-members-except-keep-list.js --key=chemin/vers/serviceAccountKey.json'
    );
    process.exit(1);
  }

  const key = require(keyPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();
  const auth = admin.auth();

  // Charger tous les utilisateurs
  const usersSnap = await db.collection('utilisateurs').get();
  const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const keepSet = new Set(emailsToKeep);
  const toKeep = allUsers.filter((u) => u.email && keepSet.has(u.email.trim().toLowerCase()));
  const toDelete = allUsers.filter((u) => !u.email || !keepSet.has(u.email.trim().toLowerCase()));

  if (toKeep.length === 0) {
    console.error('Aucun membre à garder trouvé dans Firestore avec ces emails. Vérifiez membres-a-garder.txt.');
    process.exit(1);
  }

  const repreneur = toKeep[0];
  console.log(`Membre repreneur (pour réaffectations) : ${repreneur.prenom} ${repreneur.nom} (${repreneur.email})\n`);

  if (toDelete.length === 0) {
    console.log('Aucun membre à supprimer. Tous les membres sont dans la liste à garder.');
    rl.close();
    process.exit(0);
  }

  console.log(`${toDelete.length} membre(s) à supprimer :`);
  toDelete.slice(0, 10).forEach((u) => console.log(`  - ${u.prenom} ${u.nom} (${u.email})`));
  if (toDelete.length > 10) console.log(`  ... et ${toDelete.length - 10} autre(s)`);
  console.log('');

  const rep = await ask('Confirmer la suppression de ces membres (et réaffectation des données) ? (oui/non) : ');
  if (rep.toLowerCase() !== 'oui') {
    console.log('Annulé.');
    rl.close();
    process.exit(0);
  }

  const toDeleteIds = new Set(toDelete.map((u) => u.id));
  let totalDeleted = 0;

  console.log('\nTraitement en cours...\n');

  for (const user of toDelete) {
    const uid = user.id;

    // 1. Réaffecter les disciples (mentor_id = uid)
    const disciplesSnap = await db.collection('utilisateurs').where('mentor_id', '==', uid).get();
    const batch1 = db.batch();
    disciplesSnap.docs.forEach((d) => batch1.update(d.ref, { mentor_id: repreneur.id }));
    if (!disciplesSnap.empty) await batch1.commit();

    // 2. Supprimer les presences (disciple_id ou mentor_id)
    const presencesSnap = await db.collection('presences').where('disciple_id', '==', uid).get();
    const batch2 = db.batch();
    presencesSnap.docs.forEach((d) => batch2.delete(d.ref));
    if (!presencesSnap.empty) await batch2.commit();

    const presencesMentorSnap = await db.collection('presences').where('mentor_id', '==', uid).get();
    const batch2b = db.batch();
    presencesMentorSnap.docs.forEach((d) => batch2b.delete(d.ref));
    if (!presencesMentorSnap.empty) await batch2b.commit();

    // 3. Mettre à jour programmes (created_by)
    const progSnap = await db.collection('programmes').where('created_by', '==', uid).get();
    const batch3 = db.batch();
    progSnap.docs.forEach((d) => batch3.update(d.ref, { created_by: repreneur.id }));
    if (!progSnap.empty) await batch3.commit();

    // 4. Supprimer contenu créé par ce membre
    for (const col of ['notifications', 'sujets_priere', 'temoignages']) {
      const snap = await db.collection(col).where('auteur_id', '==', uid).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    }

    const docSnap = await db.collection('documents').where('uploaded_by', '==', uid).get();
    const batchDoc = db.batch();
    docSnap.docs.forEach((d) => batchDoc.delete(d.ref));
    if (!docSnap.empty) await batchDoc.commit();

    const notesSnap = await db.collection('notes_personnelles').where('auteur_id', '==', uid).get();
    const batchNotes = db.batch();
    notesSnap.docs.forEach((d) => batchNotes.delete(d.ref));
    if (!notesSnap.empty) await batchNotes.commit();

    // 5. Réaffecter nouvelles_ames (suivi_par_id)
    const naSnap = await db.collection('nouvelles_ames').where('suivi_par_id', '==', uid).get();
    const batchNA = db.batch();
    naSnap.docs.forEach((d) => batchNA.update(d.ref, { suivi_par_id: repreneur.id }));
    if (!naSnap.empty) await batchNA.commit();

    // 6. Supprimer document utilisateurs
    await db.collection('utilisateurs').doc(uid).delete();

    // 7. Supprimer compte Authentication
    try {
      await auth.deleteUser(uid);
    } catch (e) {
      console.warn(`  Auth: impossible de supprimer ${uid}: ${e.message}`);
    }

    totalDeleted++;
    process.stdout.write(`  Supprimé: ${user.prenom} ${user.nom} (${totalDeleted}/${toDelete.length})\r`);
  }

  console.log(`\n\nTerminé. ${totalDeleted} membre(s) supprimé(s). ${toKeep.length} membre(s) conservé(s).`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
