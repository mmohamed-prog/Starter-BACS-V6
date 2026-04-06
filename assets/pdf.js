import { APP_CONFIG } from './app-config.js';

const COLORS = {
  bg: [246, 243, 239],
  ink: [36, 41, 38],
  muted: [92, 105, 101],
  line: [219, 229, 223],
  brand: [24, 180, 91],
  brandSoft: [232, 246, 238],
  dark: [16, 37, 27],
  dark2: [23, 56, 42],
  blue: [44, 123, 152],
  warnSoft: [255, 245, 222],
  warnInk: [133, 93, 0],
  card: [255, 255, 255]
};

function safe(value) {
  return String(value ?? '').trim();
}

function formatInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  const s = String(Math.round(Math.abs(n)));
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${grouped}`;
}

function formatDec(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits).replace('.', ',');
}

function euro(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${formatInt(n)} €`;
}

function kwh(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${formatInt(n)} kWh`;
}

function sqm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${formatInt(n)} m²`;
}

function co2Tons(valueKg) {
  const n = Number(valueKg);
  if (!Number.isFinite(n)) return '-';
  return `${formatInt(n / 1000)} tCO₂/an`;
}

function roi(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/d';
  return `${formatDec(n)} ans`;
}

function reliabilityLabel(score) {
  const s = Number(score || 0);
  if (s >= 80) return 'Fiabilité élevée';
  if (s >= 60) return 'Fiabilité intermédiaire';
  return 'Fiabilité limitée';
}

function priorityLabel(score) {
  const s = Number(score || 0);
  if (s >= 75) return 'Priorité élevée';
  if (s >= 55) return 'Priorité intermédiaire';
  return 'Priorité à confirmer';
}

function drawRoundedBox(doc, x, y, w, h, options = {}) {
  const {
    fill = COLORS.card,
    stroke = COLORS.line,
    radius = 6,
    lineWidth = 0.4
  } = options;
  doc.setFillColor(...fill);
  doc.setDrawColor(...stroke);
  doc.setLineWidth(lineWidth);
  doc.roundedRect(x, y, w, h, radius, radius, 'FD');
}

function drawTopRule(doc, x, y, w, color = COLORS.brand) {
  doc.setDrawColor(...color);
  doc.setLineWidth(1.2);
  doc.line(x, y, x + w, y);
}

function pageHeader(doc, title, subtitle = '') {
  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, 18, 18);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(10.5);
    doc.text(subtitle, 18, 24.5);
  }
  drawTopRule(doc, 18, 28, 174, COLORS.line);
}

function pageFooter(doc) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(18, 287, 192, 287);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.muted);
    doc.text("EcoVertaConsul't - Note de cadrage Décret BACS", 18, 292);
    doc.text(`Page ${i}/${total}`, 192, 292, { align: 'right' });
  }
}

function metricCard(doc, x, y, w, h, label, value, accent = COLORS.brand) {
  drawRoundedBox(doc, x, y, w, h, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
  drawTopRule(doc, x + 4, y + 5, w - 8, accent);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text(label.toUpperCase(), x + 5, y + 12);
  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const lines = doc.splitTextToSize(value, w - 10);
  doc.text(lines, x + 5, y + 21);
}

function labelPill(doc, x, y, label, options = {}) {
  const fill = options.fill || COLORS.brandSoft;
  const text = options.text || COLORS.dark;
  const width = doc.getTextWidth(label) + 10;
  doc.setFillColor(...fill);
  doc.roundedRect(x, y - 4, width, 8, 4, 4, 'F');
  doc.setTextColor(...text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text(label, x + 5, y + 1.5);
  return width;
}

function bulletList(doc, items, x, y, width, lineHeight = 5.1) {
  let cursor = y;
  items.forEach(item => {
    const lines = doc.splitTextToSize(`• ${item}`, width);
    doc.text(lines, x, cursor);
    cursor += lines.length * lineHeight;
  });
  return cursor;
}

function infoBox(doc, x, y, w, title, lines, options = {}) {
  const fill = options.fill || COLORS.card;
  const stroke = options.stroke || COLORS.line;
  drawRoundedBox(doc, x, y, w, options.height || 36, { fill, stroke, radius: 6 });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(options.titleColor || COLORS.ink));
  doc.setFontSize(10.4);
  doc.text(title, x + 5, y + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...(options.textColor || COLORS.muted));
  doc.setFontSize(9.2);
  let cursor = y + 15;
  lines.forEach(line => {
    const split = doc.splitTextToSize(line, w - 10);
    doc.text(split, x + 5, cursor);
    cursor += split.length * 4.6;
  });
  return cursor;
}

function actionCard(doc, x, y, w, action) {
  drawRoundedBox(doc, x, y, w, 41, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
  labelPill(doc, x + 5, y + 9, action.priority === 'quick-win' ? 'Quick win' : 'Action structurante', {
    fill: action.priority === 'quick-win' ? COLORS.brandSoft : [237, 244, 248],
    text: action.priority === 'quick-win' ? COLORS.dark : COLORS.blue
  });
  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.4);
  const titleLines = doc.splitTextToSize(safe(action.label || 'Action BACS'), w - 10);
  doc.text(titleLines, x + 5, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8.8);
  const rationale = doc.splitTextToSize(action.rationale || 'Levier prioritaire au regard du pré-diagnostic.', w - 10);
  doc.text(rationale, x + 5, y + 22 + (titleLines.length - 1) * 4.8);

  const baseY = y + 31;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.ink);
  doc.text(`CAPEX ${euro(action.capexNet || 0)}`, x + 5, baseY);
  doc.text(`Gain ${euro(action.savingsEur || 0)}/an`, x + w / 2, baseY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(`ROI ${roi(action.payback)}`, x + 5, baseY + 5.5);
  doc.text(`Score ${formatInt(action.score || 0)}/100`, x + w / 2, baseY + 5.5);
}

function siteNarrative(site) {
  const lines = [];
  if ((site.roi ?? Infinity) <= 4) lines.push('La trajectoire paraît favorable à un cadrage rapide, avec des premiers leviers activables à court terme.');
  else if ((site.roi ?? Infinity) <= 7) lines.push('La trajectoire semble économiquement défendable, sous réserve de confirmer les hypothèses techniques.');
  else lines.push('La trajectoire paraît plus structurante ; le phasage et les contraintes d’exploitation devront être clarifiés.');
  if (site.reliabilityScore >= 80) lines.push('Les données saisies permettent une première lecture relativement robuste.');
  else if (site.reliabilityScore >= 60) lines.push('La lecture est exploitable, mais plusieurs hypothèses restent à confirmer.');
  else lines.push('Le niveau de fiabilité reste limité et appelle une validation complémentaire.');
  return lines;
}

export async function exportPortfolioPdf(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const portfolio = data.portfolio || {};
  const ranking = Array.isArray(portfolio.ranking) ? portfolio.ranking : [];
  const portfolioName = safe(data.portfolioName || 'Portefeuille');

  // Cover
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(...COLORS.dark);
  doc.roundedRect(14, 18, 182, 112, 10, 10, 'F');
  doc.setFillColor(...COLORS.dark2);
  doc.circle(176, 40, 24, 'F');
  doc.setFillColor(27, 207, 112);
  doc.circle(176, 40, 13, 'F');
  doc.setFillColor(...COLORS.card);
  doc.roundedRect(18, 22, 44, 10, 5, 5, 'F');
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text("EcoVertaConsul't · Décret BACS", 23, 28.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  doc.text('Pré-diagnostic Décret BACS', 22, 47);
  doc.setFontSize(16);
  doc.text('Note de cadrage initiale', 22, 57);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12.3);
  const intro = doc.splitTextToSize('Première lecture de situation, de priorités d’action et d’effort de mise en conformité.', 132);
  doc.text(intro, 22, 71);

  drawRoundedBox(doc, 22, 88, 82, 25, { fill: [255, 255, 255], stroke: [255, 255, 255], radius: 6 });
  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Portefeuille', 27, 96);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12.3);
  doc.text(portfolioName, 27, 104);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Date', 67, 96);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('fr-FR'), 67, 104);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.4);
  const coverBullets = [
    'Priorités d’intervention et ordre de grandeur économique',
    'Lecture portefeuille et points de vigilance',
    'Prochaine étape recommandée'
  ];
  bulletList(doc, coverBullets, 112, 92, 72, 5.2);

  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(10);
  doc.text('Document d’aide à la décision - ne vaut pas validation réglementaire.', 18, 145);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.textWithLink(APP_CONFIG.calendlyLabel || 'Planifier un échange de cadrage', 18, 154, { url: APP_CONFIG.calendlyUrl });

  // Executive summary
  doc.addPage();
  pageHeader(doc, '1. Synthèse exécutive', 'Première lecture du portefeuille au regard du Décret BACS');
  const summaryText = portfolio.siteCount
    ? `Le portefeuille ressort ${safe(portfolio.status || 'à structurer')}, avec une priorité moyenne de ${formatInt(Math.round(portfolio.avgLead || 0))}/100 et une fiabilité de ${formatInt(Math.round(portfolio.avgReliability || 0))}/100.`
    : 'Aucun site n’est encore intégré au portefeuille.';
  drawRoundedBox(doc, 18, 34, 174, 20, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.2);
  const summaryLines = doc.splitTextToSize(summaryText, 164);
  doc.text(summaryLines, 23, 43);

  metricCard(doc, 18, 60, 54, 24, 'Sites analysés', formatInt(portfolio.siteCount || 0));
  metricCard(doc, 78, 60, 54, 24, 'Surface totale', sqm(portfolio.totalSurface || 0));
  metricCard(doc, 138, 60, 54, 24, 'Priorité moyenne', `${formatInt(Math.round(portfolio.avgLead || 0))}/100`, COLORS.blue);
  metricCard(doc, 18, 90, 54, 24, 'CAPEX net estimé', euro(portfolio.totalCapex || 0));
  metricCard(doc, 78, 90, 54, 24, 'Économies annuelles', `${euro(portfolio.totalSavings || 0)}/an`);
  metricCard(doc, 138, 90, 54, 24, 'ROI portefeuille', roi(portfolio.roi));

  drawRoundedBox(doc, 18, 122, 84, 42, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(10.8);
  doc.text('Lecture portefeuille', 23, 131);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9.2);
  bulletList(doc, [
    portfolio.status === 'prioritaire'
      ? 'Le portefeuille appelle une priorisation rapide des premières actions de pilotage et de mise en conformité.'
      : portfolio.status === 'à traiter'
        ? 'Le portefeuille nécessite un cadrage des arbitrages BACS à court terme.'
        : 'Le portefeuille peut être structuré par phases, avec une attention portée au bon phasage BACS.',
    `Fiabilité moyenne : ${formatInt(Math.round(portfolio.avgReliability || 0))}/100.`,
    `CO₂ évité estimé : ${co2Tons(portfolio.totalCo2 || 0)}.`
  ], 23, 139, 74, 4.8);

  drawRoundedBox(doc, 108, 122, 84, 42, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(10.8);
  doc.text('Ce que cela signifie', 113, 131);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9.2);
  bulletList(doc, [
    'Le classement croise le niveau d’équipement, l’effort estimé, la fiabilité et la priorité d’intervention.',
    'Les montants affichés constituent des ordres de grandeur de cadrage.',
    'Le pré-diagnostic n’établit pas à lui seul la conformité réglementaire de chaque site.'
  ], 113, 139, 74, 4.8);

  doc.autoTable({
    startY: 172,
    head: [['Site', 'Usage', 'Surface', 'Priorité', 'Fiabilité', 'ROI']],
    body: ranking.map((site, idx) => [
      safe(site.name || `Site ${idx + 1}`),
      safe(site.usage || '-'),
      sqm(site.surface || 0),
      `${formatInt(site.leadScore || 0)}/100`,
      `${formatInt(site.reliabilityScore || 0)}/100`,
      roi(site.roi)
    ]),
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.3, right: 2.6, bottom: 3.3, left: 2.6 },
      textColor: COLORS.ink,
      valign: 'middle'
    },
    headStyles: { fillColor: COLORS.brand, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 251, 249] },
    columnStyles: {
      0: { cellWidth: 44 },
      1: { cellWidth: 30 },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 24, halign: 'center' }
    },
    margin: { left: 18, right: 18 }
  });

  // Regulatory page
  doc.addPage();
  pageHeader(doc, '2. Cadre réglementaire et hypothèses', 'Ce document reste une aide à la priorisation et au cadrage.');
  infoBox(doc, 18, 34, 84, 'Ce que dit le Décret BACS', [
    'Le Décret BACS impose la mise en place de systèmes d’automatisation et de contrôle des bâtiments pour certaines installations tertiaires.',
    'Les seuils de puissance et les échéances réglementaires doivent être confirmés au cas par cas.'
  ], { height: 54, titleColor: COLORS.ink, textColor: COLORS.muted });
  infoBox(doc, 108, 34, 84, 'Ce que lit ce pré-diagnostic', [
    'Une première lecture du niveau d’équipement, du potentiel d’amélioration et des principaux ordres de grandeur économiques.',
    'Un niveau de fiabilité dépendant de la qualité des données saisies.'
  ], { height: 54, titleColor: COLORS.ink, textColor: COLORS.muted });
  infoBox(doc, 18, 96, 174, 'Ce que ce document ne remplace pas', [
    'Ni une visite de site, ni une vérification réglementaire détaillée, ni un chiffrage d’exécution.',
    'Les ROI et CAPEX restent des ordres de grandeur de cadrage destinés à prioriser et à arbitrer.'
  ], { height: 34, fill: [255, 255, 255], stroke: COLORS.line });

  drawRoundedBox(doc, 18, 140, 84, 60, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(10.8);
  doc.text('Hypothèses de lecture', 23, 149);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9.2);
  bulletList(doc, [
    'Niveau d’équipement : lecture interne EcoVerta du niveau de pilotage déclaré.',
    'Fiabilité : robustesse de la lecture au regard des données et des ratios calculés.',
    'Actions prioritaires : leviers BACS classés selon ROI, impact et portée réglementaire.'
  ], 23, 157, 74, 4.8);

  drawRoundedBox(doc, 108, 140, 84, 60, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10.8);
  doc.text('Prochaine étape recommandée', 113, 149);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9.4);
  const stepText = doc.splitTextToSize('Organiser un échange de cadrage pour confirmer le périmètre, les hypothèses techniques et la trajectoire de mise en conformité la plus pertinente.', 74);
  doc.text(stepText, 113, 157);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.textWithLink(APP_CONFIG.calendlyLabel || 'Planifier un échange de cadrage', 113, 190, { url: APP_CONFIG.calendlyUrl });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(APP_CONFIG.calendlyHelper || '', 113, 196);

  // Site pages
  ranking.forEach((site, idx) => {
    doc.addPage();
    pageHeader(doc, `3.${idx + 1} Lecture par site`, safe(site.name || `Site ${idx + 1}`));
    labelPill(doc, 18, 36, priorityLabel(site.leadScore), { fill: site.leadScore >= 75 ? COLORS.brandSoft : [255, 245, 222], text: site.leadScore >= 75 ? COLORS.dark : COLORS.warnInk });
    labelPill(doc, 60, 36, reliabilityLabel(site.reliabilityScore), { fill: [237, 244, 248], text: COLORS.blue });
    metricCard(doc, 18, 44, 40, 22, 'Priorité', `${formatInt(site.leadScore || 0)}/100`, COLORS.brand);
    metricCard(doc, 62, 44, 40, 22, 'Fiabilité', `${formatInt(site.reliabilityScore || 0)}/100`, COLORS.blue);
    metricCard(doc, 106, 44, 40, 22, 'ROI', roi(site.roi), COLORS.brand);
    metricCard(doc, 150, 44, 42, 22, 'Économies / an', `${euro(site.savingsEur || 0)}/an`, COLORS.brand);

    drawRoundedBox(doc, 18, 74, 84, 52, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(10.8);
    doc.text('Caractéristiques du site', 23, 83);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9.2);
    const facts = [
      `Segment : ${safe(site.segment || '-')} · Usage : ${safe(site.usage || '-')} · Surface : ${sqm(site.surface || 0)}`,
      `Conso actuelle : ${kwh(site.act || 0)} · cible : ${kwh(site.target || 0)}`,
      `GTB / pilotage déclaré : ${safe(site.gtb || '-')} · maturité BACS : ${safe(site.bacsStage || '-')}`,
      `Intensité : ${formatDec(site.actualIntensity)} kWh/m² · benchmark : ${formatDec(site.benchmarkIntensity)} kWh/m² · aide retenue : ${formatInt(site.aidesPct)}%`
    ];
    let fy = 91;
    facts.forEach(line => {
      const split = doc.splitTextToSize(line, 74);
      doc.text(split, 23, fy);
      fy += split.length * 4.8;
    });

    drawRoundedBox(doc, 108, 74, 84, 52, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(10.8);
    doc.text('Lecture de cadrage', 113, 83);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9.2);
    bulletList(doc, siteNarrative(site), 113, 91, 74, 4.8);

    drawTopRule(doc, 18, 135, 174, COLORS.line);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(11);
    doc.text('Actions prioritaires', 18, 144);
    const actions = (site.topActions && site.topActions.length ? site.topActions : site.measures || []).slice(0, 2);
    if (actions[0]) actionCard(doc, 18, 149, 84, actions[0]);
    if (actions[1]) actionCard(doc, 108, 149, 84, actions[1]);

    drawRoundedBox(doc, 18, 196, 174, 28, { fill: [255, 251, 243], stroke: [243, 221, 171], radius: 6 });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.warnInk);
    doc.setFontSize(10.5);
    doc.text('Points de vigilance', 23, 205);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.1);
    const warningText = doc.splitTextToSize((site.warnings || [site.bacsDisclaimer || 'Validation complémentaire recommandée.']).slice(0, 2).join(' '), 164);
    doc.text(warningText, 23, 213);

    drawRoundedBox(doc, 18, 230, 174, 34, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(10.8);
    doc.text('Prochaine étape recommandée', 23, 239);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9.4);
    const next = doc.splitTextToSize(site.nextStep || 'Relire les hypothèses et organiser un échange de cadrage.', 164);
    doc.text(next, 23, 247);
  });

  // Closing page
  doc.addPage();
  pageHeader(doc, '4. Prochaine étape recommandée', 'Confirmer les hypothèses et préparer la suite');
  drawRoundedBox(doc, 18, 36, 174, 22, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11.2);
  const closeIntro = doc.splitTextToSize('Un échange de cadrage permet de confirmer les hypothèses, préciser le périmètre technique et hiérarchiser les actions à engager.', 164);
  doc.text(closeIntro, 23, 45);

  const steps = [
    ['1. Vérifier le périmètre', 'Confirmer l’assujettissement et le périmètre des sites à partir des systèmes réellement présents et de leur puissance nominale utile.'],
    ['2. Valider les hypothèses', 'Relire les données, les schémas de pilotage et les contraintes d’exploitation qui conditionnent le chiffrage et le ROI.'],
    ['3. Préparer la suite', 'Cadrer une étude, une consultation ou un audit détaillé avec un budget et un planning plus robustes.']
  ];
  let boxY = 68;
  steps.forEach(([title, text], idx) => {
    drawRoundedBox(doc, 18, boxY, 174, 30, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    labelPill(doc, 23, boxY + 9, title, { fill: idx === 0 ? COLORS.brandSoft : [237, 244, 248], text: idx === 0 ? COLORS.dark : COLORS.blue });
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.4);
    const lines = doc.splitTextToSize(text, 150);
    doc.text(lines, 23, boxY + 18);
    boxY += 38;
  });

  drawRoundedBox(doc, 18, 190, 174, 54, { fill: COLORS.dark, stroke: COLORS.dark, radius: 8 });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('Planifier un échange de cadrage', 23, 205);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.2);
  const ctaText = doc.splitTextToSize('Échange de 30 minutes pour relire le pré-diagnostic, confirmer les hypothèses et préparer la trajectoire de mise en conformité la plus pertinente.', 128);
  doc.text(ctaText, 23, 214);
  doc.setTextColor(...COLORS.brandSoft);
  doc.setFont('helvetica', 'bold');
  doc.textWithLink(APP_CONFIG.calendlyLabel || 'Planifier un échange de cadrage', 23, 234, { url: APP_CONFIG.calendlyUrl });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text(APP_CONFIG.contactEmail || 'contact@ecovertaconsult.com', 23, 242);
  doc.text("EcoVertaConsul't - La Courneuve (93)", 23, 249);

  pageFooter(doc);
  const fileName = `note-cadrage-bacs-${portfolioName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'portefeuille'}.pdf`;
  doc.save(fileName);
}
