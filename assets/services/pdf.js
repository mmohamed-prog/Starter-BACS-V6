import { eur, int0, dec1 } from '../core/helpers.js';

function footer(doc){
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(140,150,145);
  doc.text("EcoVertaConsul’t — Starter BACS V7.6 Fusion", 40, h - 16);
}
function cover(doc, project, audit){
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(17,35,27);
  doc.rect(0,0,W,230,'F');
  doc.setFillColor(24,180,91);
  doc.circle(W-80,60,46,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(28);
  doc.text('Starter BACS',40,66);
  doc.setFont('helvetica','normal');
  doc.setFontSize(14);
  doc.text('Synthèse portefeuille multi-sites',40,92);
  doc.text(`Client : ${project.proposal.client || project.contact.company || '—'}`,40,146);
  doc.text(`Contact : ${project.contact.firstName || ''} ${project.contact.lastName || ''}`.trim() || '—',40,164);
  doc.text(`Sites : ${audit.totals.sites}`,40,182);
  footer(doc);
}
function card(doc, x, y, w, h, title, value, dark=false){
  if(dark){
    doc.setFillColor(17,35,27); doc.setTextColor(255,255,255); doc.setDrawColor(17,35,27);
  }else{
    doc.setFillColor(248,252,250); doc.setTextColor(18,39,29); doc.setDrawColor(220,230,225);
  }
  doc.roundedRect(x,y,w,h,12,12,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text(title.toUpperCase(), x+12, y+18);
  doc.setFontSize(18); doc.text(String(value), x+12, y+42);
}
function summaryPage(doc, audit){
  let y = 50;
  doc.setTextColor(18,39,29);
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text('Synthèse portefeuille', 40, y);
  y += 22;
  card(doc, 40, y, 120, 60, 'Sites', audit.totals.sites);
  card(doc, 170, y, 120, 60, 'Assujettis', audit.totals.assuj);
  card(doc, 300, y, 120, 60, 'Score moyen', `${audit.totals.avgScore}/100`);
  card(doc, 430, y, 120, 60, 'Priorité', `${audit.totals.avgPriority}/100`, true);
  y += 84;
  card(doc, 40, y, 160, 60, 'Capex TTC', eur(audit.totals.capex));
  card(doc, 210, y, 160, 60, 'Économies/an', eur(audit.totals.savings));
  card(doc, 380, y, 170, 60, 'ROI moyen', Number.isFinite(audit.totals.avgRoi) ? `${dec1(audit.totals.avgRoi)} ans` : '—');
  y += 92;
  doc.setFillColor(244,250,247);
  doc.roundedRect(40, y, 510, 94, 12, 12, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text('Lecture portefeuille', 54, y + 20);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  const txt = audit.totals.avgPriority >= 80
    ? 'Portefeuille critique : priorité à la conformité et aux quick wins.'
    : audit.totals.avgPriority >= 60
    ? 'Portefeuille à action structurée : hiérarchiser les sites et phaser les investissements.'
    : 'Portefeuille structuré : logique d’optimisation progressive recommandée.';
  doc.text(doc.splitTextToSize(txt, 470), 54, y + 42);
  footer(doc);
}
function sitePage(doc, site, index){
  let y = 50;
  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(18,39,29);
  doc.text(`Site ${index} — ${site.name}`, 40, y);
  y += 18;
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text(`Type : ${site.type} · Projet : ${site.project} · Zone : ${site.zone}`, 40, y);
  y += 14;
  doc.text(`Surface : ${int0(site.surface)} m² · Conso : ${int0(site.baseKwh)} kWh/an · Puissance : ${int0(site.powerKw)} kW`, 40, y);
  y += 24;
  card(doc, 40, y, 120, 60, 'Score', `${site.result.globalScore}/100`);
  card(doc, 170, y, 120, 60, 'Priorité', `${site.result.priorityIndex}/100`, true);
  card(doc, 300, y, 120, 60, 'ROI', Number.isFinite(site.result.payback) ? `${dec1(site.result.payback)} ans` : '—');
  card(doc, 430, y, 120, 60, 'Capex', eur(site.result.packTtc));
  y += 88;
  doc.setFillColor(248,252,250);
  doc.roundedRect(40, y, 510, 120, 12, 12, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text('Lecture du site', 54, y + 20);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text(`Score exploitation : ${site.result.exploitation}/100`, 54, y + 44);
  doc.text(`Score énergétique : ${site.result.energy}/100`, 54, y + 60);
  doc.text(`Score BACS : ${site.result.bacs}/100`, 54, y + 76);
  doc.text(`Assujettissement : ${site.result.assuj.isAssujetti ? 'Oui' : 'Non'} (${site.result.assuj.reason})`, 54, y + 92);
  footer(doc);
}
export async function generatePremiumBacsPdf(project, audit){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  cover(doc, project, audit);
  doc.addPage();
  summaryPage(doc, audit);
  audit.ranked.forEach((site, i) => {
    doc.addPage();
    sitePage(doc, site, i + 1);
  });
  doc.save(`starter-bacs-${new Date().toISOString().slice(0,10)}.pdf`);
}
export async function generateCommercialProposalPdf(project, audit){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  cover(doc, project, audit);
  doc.addPage();
  summaryPage(doc, audit);
  doc.addPage();
  let y = 50;
  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(18,39,29);
  doc.text('Proposition d’accompagnement', 40, y);
  y += 24;
  doc.setFillColor(248,252,250);
  doc.roundedRect(40, y, 510, 180, 12, 12, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Périmètre proposé', 54, y + 20);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  ['Analyse documentaire BACS / GTB','Hiérarchisation portefeuille','Plan d’investissement recommandé','Préconisations pilotage et conformité','Restitution de synthèse'].forEach((line, i) => {
    doc.text(`• ${line}`, 54, y + 44 + i*16);
  });
  y += 206;
  card(doc, 40, y, 160, 60, 'Honoraires HT', eur(project.proposal.feeHt || 0));
  card(doc, 210, y, 160, 60, 'Délai', project.proposal.delay || 'À confirmer');
  card(doc, 380, y, 170, 60, 'Référence', project.proposal.reference || '—');
  footer(doc);
  doc.save(`proposition-bacs-${new Date().toISOString().slice(0,10)}.pdf`);
}
