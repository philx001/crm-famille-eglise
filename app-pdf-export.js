// ============================================
// MODULE EXPORT PDF
// Génération de rapports PDF côté client
// ============================================

const PDFExport = {
  // Générer le rapport de présences
  async generatePresenceReport(stats, options = {}) {
    const content = this.buildPresenceHTML(stats, options);
    
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      throw new Error('Fenêtre bloquée. Autorisez les popups pour ce site.');
    }
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };
    
    return true;
  },

  buildPresenceHTML(stats, options) {
    const { dateDebut, dateFin, famille } = options;
    const periodeStr = dateDebut && dateFin 
      ? `Du ${Utils.formatDate(dateDebut)} au ${Utils.formatDate(dateFin)}`
      : 'Toutes périodes';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport de Présences - ${Utils.escapeHtml(famille || '')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #333; padding: 15mm; }
    @media print { body { padding: 0; } .no-print { display: none; } }
    .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #2D5A7B; }
    .header h1 { color: #2D5A7B; font-size: 22pt; margin-bottom: 5px; }
    .header .subtitle { font-size: 14pt; color: #666; }
    .header .periode { font-size: 11pt; color: #888; margin-top: 8px; }
    .header .date-generation { font-size: 9pt; color: #aaa; margin-top: 5px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 13pt; color: #2D5A7B; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ddd; }
    .stats-summary { display: flex; justify-content: space-around; margin-bottom: 20px; padding: 15px; background: #f5f7fa; border-radius: 8px; }
    .stat-box { text-align: center; padding: 10px 20px; }
    .stat-value { font-size: 24pt; font-weight: bold; color: #2D5A7B; }
    .stat-value.success { color: #4CAF50; }
    .stat-value.danger { color: #F44336; }
    .stat-value.warning { color: #FF9800; }
    .stat-label { font-size: 9pt; color: #666; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f7fa; font-weight: 600; color: #555; text-transform: uppercase; font-size: 9pt; }
    tr:nth-child(even) { background: #fafafa; }
    .text-center { text-align: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9pt; font-weight: 500; }
    .badge-success { background: #E8F5E9; color: #2E7D32; }
    .badge-danger { background: #FFEBEE; color: #C62828; }
    .badge-warning { background: #FFF3E0; color: #E65100; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; width: 80px; display: inline-block; vertical-align: middle; margin-right: 5px; }
    .progress-fill { height: 100%; border-radius: 4px; }
    .progress-fill.high { background: #4CAF50; }
    .progress-fill.medium { background: #FF9800; }
    .progress-fill.low { background: #F44336; }
    .type-bar { display: flex; align-items: center; margin-bottom: 8px; }
    .type-label { width: 180px; font-size: 10pt; }
    .type-progress { flex: 1; height: 20px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 0 10px; }
    .type-progress-fill { height: 100%; border-radius: 4px; }
    .type-value { width: 50px; text-align: right; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #888; }
    .btn-print { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #2D5A7B; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
    .btn-print:hover { background: #1E3D5C; }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">Imprimer / PDF</button>
  
  <div class="header">
    <h1>Rapport de Présences</h1>
    <div class="subtitle">Famille ${Utils.escapeHtml(famille || '')}</div>
    <div class="periode">${periodeStr}</div>
    <div class="date-generation">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  
  <div class="section">
    <div class="stats-summary">
      <div class="stat-box">
        <div class="stat-value">${stats.global.totalProgrammes}</div>
        <div class="stat-label">Programmes</div>
      </div>
      <div class="stat-box">
        <div class="stat-value success">${stats.global.totalPresencesEffectives}</div>
        <div class="stat-label">Présences</div>
      </div>
      <div class="stat-box">
        <div class="stat-value danger">${stats.global.totalAbsences}</div>
        <div class="stat-label">Absences</div>
      </div>
      <div class="stat-box">
        <div class="stat-value warning">${stats.global.totalExcuses}</div>
        <div class="stat-label">Excusés</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats.global.tauxPresenceGlobal}%</div>
        <div class="stat-label">Taux Global</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <h2 class="section-title">Présence par Type de Programme</h2>
    ${stats.parType.map(t => `
      <div class="type-bar">
        <span class="type-label">${t.label}</span>
        <div class="type-progress">
          <div class="type-progress-fill" style="width: ${t.tauxPresence}%; background: ${t.color}"></div>
        </div>
        <span class="type-value">${t.tauxPresence}%</span>
      </div>
    `).join('')}
  </div>
  
  <div class="section">
    <h2 class="section-title">Détail par Membre</h2>
    <table>
      <thead>
        <tr>
          <th>Membre</th>
          <th>Mentor</th>
          <th class="text-center">Présences</th>
          <th class="text-center">Absences</th>
          <th class="text-center">Excusés</th>
          <th class="text-center">Taux</th>
        </tr>
      </thead>
      <tbody>
        ${stats.parMembre.map(m => `
          <tr>
            <td><strong>${Utils.escapeHtml(m.nomComplet)}</strong></td>
            <td>${Utils.escapeHtml(m.mentor)}</td>
            <td class="text-center"><span class="badge badge-success">${m.nbPresences}</span></td>
            <td class="text-center"><span class="badge badge-danger">${m.nbAbsences}</span></td>
            <td class="text-center"><span class="badge badge-warning">${m.nbExcuses}</span></td>
            <td class="text-center">
              <div class="progress-bar">
                <div class="progress-fill ${m.tauxPresence >= 80 ? 'high' : m.tauxPresence >= 60 ? 'medium' : 'low'}" style="width: ${m.tauxPresence}%"></div>
              </div>
              ${m.tauxPresence}%
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  ${stats.evolution && stats.evolution.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Évolution Mensuelle</h2>
    <table>
      <thead>
        <tr>
          <th>Mois</th>
          <th class="text-center">Programmes</th>
          <th class="text-center">Présences</th>
          <th class="text-center">Taux</th>
        </tr>
      </thead>
      <tbody>
        ${stats.evolution.map(e => `
          <tr>
            <td>${e.label}</td>
            <td class="text-center">${e.nbProgrammes}</td>
            <td class="text-center">${e.nbPresences}</td>
            <td class="text-center">
              <div class="progress-bar">
                <div class="progress-fill ${e.tauxPresence >= 80 ? 'high' : e.tauxPresence >= 60 ? 'medium' : 'low'}" style="width: ${e.tauxPresence}%"></div>
              </div>
              ${e.tauxPresence}%
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}
  
  <div class="footer">
    <p>CRM Famille - Rapport généré automatiquement</p>
  </div>
</body>
</html>`;
  },

  // Générer le rapport liste des membres (PDF via impression navigateur)
  generateMembersReport(membres, options = {}) {
    const famille = options.famille || '';
    const escape = (v) => (typeof Utils !== 'undefined' && Utils.escapeHtml ? Utils.escapeHtml(String(v != null ? v : '')) : String(v != null ? v : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    const formatDate = (date) => {
      if (date == null) return '';
      try {
        const d = date.toDate ? date.toDate() : new Date(date);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch (_) { return ''; }
    };
    const getRoleLabel = (role) => (typeof Utils !== 'undefined' && Utils.getRoleLabel ? Utils.getRoleLabel(role) : role || '');
    const rows = membres.map(m => {
      let mentorName = '';
      try {
        const mentor = m.mentor_id && typeof Membres !== 'undefined' ? Membres.getById(m.mentor_id) : null;
        mentorName = mentor ? `${mentor.prenom || ''} ${mentor.nom || ''}`.trim() : '';
      } catch (_) {}
      return `
        <tr>
          <td>${escape(m.prenom)}</td>
          <td>${escape(m.nom)}</td>
          <td>${escape(m.email)}</td>
          <td>${escape(m.telephone)}</td>
          <td>${escape(getRoleLabel(m.role))}</td>
          <td>${escape(mentorName)}</td>
          <td>${formatDate(m.date_arrivee_icc)}</td>
          <td>${formatDate(m.date_naissance)}</td>
          <td>${m.sexe === 'M' ? 'Homme' : m.sexe === 'F' ? 'Femme' : ''}</td>
          <td>${escape(m.adresse_ville)}</td>
          <td>${escape(m.adresse_code_postal)}</td>
          <td>${escape(m.profession)}</td>
          <td>${escape(m.statut_professionnel ? String(m.statut_professionnel).replace('_', ' ') : '')}</td>
          <td>${escape(m.ministere_service)}</td>
          <td>${m.baptise_immersion === true ? 'Oui' : m.baptise_immersion === false ? 'Non' : ''}</td>
          <td>${escape(Array.isArray(m.formations) ? m.formations.join(', ') : '')}</td>
        </tr>`;
    }).join('');

    const content = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Liste des membres - ${escape(famille)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.35; color: #333; padding: 15mm; }
    @media print { body { padding: 0; } .no-print { display: none; } }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #2D5A7B; }
    .header h1 { color: #2D5A7B; font-size: 20pt; margin-bottom: 5px; }
    .header .subtitle { font-size: 12pt; color: #666; }
    .header .date-generation { font-size: 9pt; color: #888; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
    th, td { padding: 5px 6px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f7fa; font-weight: 600; color: #555; text-transform: uppercase; font-size: 8pt; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #888; }
    .btn-print { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #2D5A7B; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
    .btn-print:hover { background: #1E3D5C; }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  <div class="header">
    <h1>Liste des membres</h1>
    <div class="subtitle">Famille ${escape(famille)}</div>
    <div class="date-generation">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — ${membres.length} membre(s)</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Prénom</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Rôle</th><th>Mentor</th>
        <th>Date arrivée ICC</th><th>Date de naissance</th><th>Sexe</th><th>Ville</th><th>Code postal</th>
        <th>Profession</th><th>Statut pro</th><th>Ministère</th><th>Baptisé immersion</th><th>Formations</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <p>CRM Famille - Liste générée automatiquement</p>
  </div>
</body>
</html>`;

    // Ouvrir une fenêtre vide (about:blank évite les comportements étranges)
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      throw new Error('Fenêtre bloquée. Autorisez les popups pour ce site ou réessayez.');
    }
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    // Attendre le chargement puis proposer l'impression
    printWindow.onload = () => {
      try {
        setTimeout(() => printWindow.print(), 500);
      } catch (_) {}
    };
    return true;
  }
};
