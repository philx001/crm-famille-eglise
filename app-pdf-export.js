// ============================================
// MODULE EXPORT PDF
// Génération de rapports PDF côté client
// ============================================

const PDFExport = {
  // Télécharger un document HTML en PDF (comme un fichier, sans ouvrir la boîte d'impression)
  async downloadHtmlAsPdf(htmlContent, filename, options = {}) {
    if (typeof html2pdf === 'undefined') {
      throw new Error('Génération PDF indisponible. Réessayez ou utilisez l\'impression (Ctrl+P).');
    }
    const orientation = options.orientation || 'portrait';
    const isLandscape = orientation === 'landscape';
    const iframeW = isLandscape ? '297mm' : '210mm';
    const iframeH = '1200px';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('style', 'position:fixed;left:-9999px;top:0;width:' + iframeW + ';height:' + iframeH + ';border:none;overflow:auto;');
    iframe.setAttribute('name', 'pdf-export-frame');
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      throw new Error('Impossible de créer le document pour l\'export PDF.');
    }
    doc.open();
    doc.write(htmlContent);
    doc.close();
    const delay = options.delay != null ? options.delay : 700;
    await new Promise(r => { iframe.onload = r; });
    await new Promise(r => setTimeout(r, delay));
    const body = doc.body;
    if (!body) {
      document.body.removeChild(iframe);
      throw new Error('Le contenu du rapport n\'a pas pu être chargé.');
    }
    body.style.overflow = 'visible';
    const opt = {
      margin: 8,
      filename: filename || 'rapport.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: options.scale != null ? options.scale : 1.5, useCORS: true, allowTaint: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orientation },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '#section-detail-membre' }
    };
    try {
      await html2pdf().set(opt).from(body).save();
    } finally {
      try { document.body.removeChild(iframe); } catch (_) {}
    }
    return true;
  },

  // Ouvrir le HTML dans une fenêtre pour impression (secours si le téléchargement direct échoue)
  openForPrint(htmlContent, title) {
    const w = window.open('about:blank', '_blank');
    if (!w) return false;
    w.document.write(htmlContent);
    w.document.close();
    w.document.title = title || 'Rapport';
    w.onload = () => { try { setTimeout(() => w.print(), 400); } catch (_) {} };
    return true;
  },

  // Générer le rapport de présences (téléchargement direct PDF)
  async generatePresenceReport(stats, options = {}) {
    const content = this.buildPresenceHTML(stats, options);
    const filename = `rapport-presences-${new Date().toISOString().slice(0, 10)}.pdf`;
    await this.downloadHtmlAsPdf(content, filename, { orientation: 'landscape', delay: 800, scale: 1.25 });
    return true;
  },

  buildPresenceHTML(stats, options) {
    const { dateDebut, dateFin, famille } = options;
    const periodeStr = dateDebut && dateFin
      ? `Du ${Utils.formatDate(dateDebut)} au ${Utils.formatDate(dateFin)}`
      : 'Toutes périodes';

    const global = stats.global || {};
    const parType = Array.isArray(stats.parType) ? stats.parType : [];
    const parMembre = Array.isArray(stats.parMembre) ? stats.parMembre : [];
    const evolution = Array.isArray(stats.evolution) ? stats.evolution : [];

    const capTaux = (v) => Math.min(100, Math.max(0, Number(v) || 0));

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport de Présences - ${Utils.escapeHtml(famille || '')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; line-height: 1.3; color: #333; padding: 8mm; overflow: visible; }
    @media print { body { padding: 6mm; } } .no-print { display: none !important; }
    .section { page-break-inside: avoid; margin-bottom: 12px; }
    .header { text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #2D5A7B; }
    .header h1 { color: #2D5A7B; font-size: 16pt; margin-bottom: 2px; }
    .header .subtitle { font-size: 11pt; color: #666; }
    .header .periode { font-size: 9pt; color: #888; margin-top: 2px; }
    .header .date-generation { font-size: 8pt; color: #aaa; margin-top: 2px; }
    .section-title { font-size: 11pt; color: #2D5A7B; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #ddd; }
    .stats-summary { display: flex; flex-wrap: wrap; justify-content: space-around; gap: 6px; margin-bottom: 10px; padding: 8px 10px; background: #f5f7fa; border-radius: 6px; }
    .stat-box { text-align: center; padding: 4px 10px; min-width: 0; }
    .stat-value { font-size: 14pt; font-weight: bold; color: #2D5A7B; }
    .stat-value.success { color: #4CAF50; }
    .stat-value.danger { color: #F44336; }
    .stat-value.warning { color: #FF9800; }
    .stat-label { font-size: 7pt; color: #666; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 8pt; table-layout: fixed; }
    th, td { padding: 3px 5px; text-align: left; border-bottom: 1px solid #ddd; overflow: hidden; text-overflow: ellipsis; }
    th { background: #f5f7fa; font-weight: 600; color: #555; text-transform: uppercase; font-size: 7pt; }
    .col-membre { width: 20%; }
    .col-mentor { width: 20%; }
    .col-num { width: 9%; }
    .col-taux { width: 12%; }
    tr:nth-child(even) { background: #fafafa; }
    .text-center { text-align: center; }
    .badge { display: inline-block; padding: 1px 5px; border-radius: 6px; font-size: 7pt; font-weight: 500; }
    .badge-success { background: #E8F5E9; color: #2E7D32; }
    .badge-danger { background: #FFEBEE; color: #C62828; }
    .badge-warning { background: #FFF3E0; color: #E65100; }
    .progress-bar { height: 5px; background: #e0e0e0; border-radius: 3px; overflow: hidden; width: 40px; display: inline-block; vertical-align: middle; margin-right: 3px; }
    .progress-fill { height: 100%; border-radius: 3px; max-width: 100%; }
    .progress-fill.high { background: #4CAF50; }
    .progress-fill.medium { background: #FF9800; }
    .progress-fill.low { background: #F44336; }
    .type-bar { display: flex; align-items: center; margin-bottom: 4px; }
    .type-label { width: 140px; font-size: 8pt; flex-shrink: 0; }
    .type-progress { flex: 1; min-width: 0; height: 12px; background: #e0e0e0; border-radius: 3px; overflow: hidden; margin: 0 6px; }
    .type-progress-fill { height: 100%; border-radius: 3px; max-width: 100%; }
    .type-value { width: 36px; text-align: right; font-weight: 600; flex-shrink: 0; font-size: 8pt; }
    .footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; font-size: 8pt; color: #888; }
    .page-break-before { page-break-before: always; }
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
        <div class="stat-value">${global.totalProgrammes != null ? global.totalProgrammes : 0}</div>
        <div class="stat-label">Programmes</div>
      </div>
      <div class="stat-box">
        <div class="stat-value success">${global.totalPresencesEffectives != null ? global.totalPresencesEffectives : 0}</div>
        <div class="stat-label">Présences</div>
      </div>
      <div class="stat-box">
        <div class="stat-value danger">${global.totalAbsences != null ? global.totalAbsences : 0}</div>
        <div class="stat-label">Absences</div>
      </div>
      <div class="stat-box">
        <div class="stat-value warning">${global.totalExcuses != null ? global.totalExcuses : 0}</div>
        <div class="stat-label">Excusés</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${global.tauxPresenceGlobal != null ? global.tauxPresenceGlobal : 0}%</div>
        <div class="stat-label">Taux Global</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <h2 class="section-title">Présence par Type de Programme</h2>
    ${parType.map(t => {
      const taux = capTaux(t.tauxPresence);
      return `
      <div class="type-bar">
        <span class="type-label">${t.label}</span>
        <div class="type-progress">
          <div class="type-progress-fill" style="width: ${taux}%; background: ${t.color || '#2D5A7B'}"></div>
        </div>
        <span class="type-value">${t.tauxPresence != null ? t.tauxPresence : 0}%</span>
      </div>`;
    }).join('')}
  </div>
  
  <div class="section page-break-before" id="section-detail-membre">
    <h2 class="section-title">Détail par Membre</h2>
    <table>
      <colgroup>
        <col class="col-membre"><col class="col-mentor"><col class="col-num"><col class="col-num"><col class="col-num"><col class="col-taux">
      </colgroup>
      <thead>
        <tr>
          <th>Membre</th>
          <th>Mentor</th>
          <th class="text-center">Prés.</th>
          <th class="text-center">Abs.</th>
          <th class="text-center">Excus.</th>
          <th class="text-center">Taux</th>
        </tr>
      </thead>
      <tbody>
        ${parMembre.length === 0
          ? '<tr><td colspan="6" class="text-center" style="padding:12px;color:#888;">Aucun membre dans cette période.</td></tr>'
          : parMembre.map(m => {
              const taux = capTaux(m.tauxPresence);
              return `
          <tr>
            <td><strong>${Utils.escapeHtml(m.nomComplet || '')}</strong></td>
            <td>${Utils.escapeHtml(m.mentor || '-')}</td>
            <td class="text-center"><span class="badge badge-success">${m.nbPresences != null ? m.nbPresences : 0}</span></td>
            <td class="text-center"><span class="badge badge-danger">${m.nbAbsences != null ? m.nbAbsences : 0}</span></td>
            <td class="text-center"><span class="badge badge-warning">${m.nbExcuses != null ? m.nbExcuses : 0}</span></td>
            <td class="text-center">
              <div class="progress-bar">
                <div class="progress-fill ${m.tauxPresence >= 80 ? 'high' : m.tauxPresence >= 60 ? 'medium' : 'low'}" style="width: ${taux}%"></div>
              </div>
              ${m.tauxPresence != null ? m.tauxPresence : 0}%
            </td>
          </tr>`;
            }).join('')}
      </tbody>
    </table>
  </div>
  
  ${evolution.length > 0 ? `
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
        ${evolution.map(e => {
          const taux = capTaux(e.tauxPresence);
          return `
          <tr>
            <td>${e.label}</td>
            <td class="text-center">${e.nbProgrammes != null ? e.nbProgrammes : 0}</td>
            <td class="text-center">${e.nbPresences != null ? e.nbPresences : 0}</td>
            <td class="text-center">
              <div class="progress-bar">
                <div class="progress-fill ${e.tauxPresence >= 80 ? 'high' : e.tauxPresence >= 60 ? 'medium' : 'low'}" style="width: ${taux}%"></div>
              </div>
              ${e.tauxPresence != null ? e.tauxPresence : 0}%
            </td>
          </tr>`;
        }).join('')}
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
  async generateMembersReport(membres, options = {}) {
    const famille = options.famille || '';
    const reportTitle = options.title || 'Liste des membres';
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
  <title>${escape(reportTitle)} - ${escape(famille)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.35; color: #333; padding: 15mm; }
    @media print { body { padding: 0; } } .no-print { display: none !important; }
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
    <h1>${escape(reportTitle)}</h1>
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
  },

  // Générer le rapport de présences pour un programme spécifique
  async generateProgrammePresenceReport(presencesData, options = {}) {
    const { programme, famille } = options;
    const escape = (v) => String(v != null ? v : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    
    const dateDebut = programme?.date_debut?.toDate ? programme.date_debut.toDate() : new Date(programme?.date_debut || Date.now());
    const dateStr = dateDebut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const heureStr = dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    const getStatutLabel = (statut) => {
      const labels = { present: 'Présent', absent: 'Absent', excuse: 'Excusé', non_renseigne: 'Non renseigné' };
      return labels[statut] || statut;
    };
    const getStatutBadge = (statut) => {
      const badges = {
        present: 'badge-success',
        absent: 'badge-danger',
        excuse: 'badge-warning',
        non_renseigne: 'badge-secondary'
      };
      return badges[statut] || 'badge-secondary';
    };

    // Calculer les stats
    const counts = { present: 0, absent: 0, excuse: 0, non_renseigne: 0 };
    presencesData.forEach(p => { counts[p.statut]++; });
    const total = presencesData.length;
    const taux = total > 0 ? Math.round((counts.present / total) * 100) : 0;

    const rows = presencesData.map(p => `
      <tr>
        <td>${escape(p.membre.prenom)} ${escape(p.membre.nom)}</td>
        <td>${escape(Utils.getRoleLabel(p.membre.role))}</td>
        <td class="text-center"><span class="badge ${getStatutBadge(p.statut)}">${getStatutLabel(p.statut)}</span></td>
        <td>${escape(p.commentaire)}</td>
      </tr>
    `).join('');

    const content = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Présences - ${escape(programme?.nom || 'Programme')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #333; padding: 15mm; }
    @media print { body { padding: 0; } } .no-print { display: none !important; }
    .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #2D5A7B; }
    .header h1 { color: #2D5A7B; font-size: 20pt; margin-bottom: 5px; }
    .header .subtitle { font-size: 12pt; color: #666; }
    .header .date { font-size: 11pt; color: #888; margin-top: 8px; }
    .header .date-generation { font-size: 9pt; color: #aaa; margin-top: 5px; }
    .stats-summary { display: flex; justify-content: center; gap: 30px; margin-bottom: 20px; padding: 15px; background: #f5f7fa; border-radius: 8px; }
    .stat-box { text-align: center; padding: 10px 20px; }
    .stat-value { font-size: 22pt; font-weight: bold; }
    .stat-value.success { color: #4CAF50; }
    .stat-value.danger { color: #F44336; }
    .stat-value.warning { color: #FF9800; }
    .stat-value.primary { color: #2D5A7B; }
    .stat-label { font-size: 9pt; color: #666; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10pt; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f7fa; font-weight: 600; color: #555; text-transform: uppercase; font-size: 9pt; }
    tr:nth-child(even) { background: #fafafa; }
    .text-center { text-align: center; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9pt; font-weight: 500; }
    .badge-success { background: #E8F5E9; color: #2E7D32; }
    .badge-danger { background: #FFEBEE; color: #C62828; }
    .badge-warning { background: #FFF3E0; color: #E65100; }
    .badge-secondary { background: #ECEFF1; color: #546E7A; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #888; }
    .btn-print { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #2D5A7B; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
    .btn-print:hover { background: #1E3D5C; }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">Imprimer / PDF</button>
  
  <div class="header">
    <h1>${escape(programme?.nom || 'Programme')}</h1>
    <div class="subtitle">Famille ${escape(famille)}</div>
    <div class="date">${dateStr} à ${heureStr}</div>
    <div class="date-generation">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  
  <div class="stats-summary">
    <div class="stat-box">
      <div class="stat-value success">${counts.present}</div>
      <div class="stat-label">Présents</div>
    </div>
    <div class="stat-box">
      <div class="stat-value danger">${counts.absent}</div>
      <div class="stat-label">Absents</div>
    </div>
    <div class="stat-box">
      <div class="stat-value warning">${counts.excuse}</div>
      <div class="stat-label">Excusés</div>
    </div>
    <div class="stat-box">
      <div class="stat-value primary">${taux}%</div>
      <div class="stat-label">Taux</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Membre</th>
        <th>Rôle</th>
        <th class="text-center">Statut</th>
        <th>Commentaire</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  
  <div class="footer">
    <p>CRM Famille - ${escape(famille)} - ${total} membre(s)</p>
  </div>
</body>
</html>`;

    const filename = `presences-programme-${new Date().toISOString().slice(0, 10)}.pdf`;
    await this.downloadHtmlAsPdf(content, filename, { delay: 600 });
    return true;
  }
};

// Exposer globalement pour les autres scripts (Statistiques, Nouvelles âmes, Membres, Présences)
if (typeof window !== 'undefined') window.PDFExport = PDFExport;
