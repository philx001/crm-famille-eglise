/**
 * Injecte la version d'app dans index.html au moment du build (Vercel ou local).
 * Remplace __APP_VERSION__ par le commit Git (Vercel) ou un timestamp (local).
 * Aucune modification manuelle de index.html n'est nécessaire à chaque déploiement.
 */
const fs = require('fs');
const path = require('path');

const PLACEHOLDER = '__APP_VERSION__';
const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');

// Version : commit SHA sur Vercel, sinon BUILD_ID, sinon timestamp (local)
const version =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_BUILD_ID ||
  String(Date.now());

let html = fs.readFileSync(indexPath, 'utf8');
const count = (html.match(new RegExp(PLACEHOLDER.replace(/./g, '\\$&'), 'g')) || []).length;
if (count === 0) {
  console.warn('inject-version.js: aucun __APP_VERSION__ trouvé dans index.html');
  process.exit(0);
}
html = html.split(PLACEHOLDER).join(version);
fs.writeFileSync(indexPath, html, 'utf8');
console.log(`inject-version.js: ${count} occurrence(s) remplacée(s) par version=${version}`);
