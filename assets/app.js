import { createEmptyProject, createEmptySite } from './assets/core/state.js';
import { createStorageService } from './assets/services/storage.js';
import { runBacsAudit } from './assets/engine/bacs-engine.js';
import { validateLead, isBusinessEmail } from './assets/core/validators.js';
import { eur, dec1 } from './assets/core/helpers.js';
import { generatePremiumBacsPdf, generateCommercialProposalPdf } from './assets/services/pdf.js';
import { submitLeadToFormspree } from './assets/services/crm.js';

const FORMSPREE_URL = 'https://formspree.io/f/xzdkveny';
const storage = createStorageService('ecoverta_bacs_v26_chat_premium');

let project = storage.load() || createEmptyProject();
if(!project.activeSiteId) project.activeSiteId = project.sites[0].id;

const state = { currentQuestionIndex: 0, consent: false };

const QUESTIONS = [
  {
    id: 'site_type',
    ask: () => "Quel est le type principal de ce bâtiment ?",
    type: 'choice',
    options: [
      ['Bureaux tertiaires','Bureaux tertiaires'],
      ['Établissement d’enseignement','Établissement d’enseignement'],
      ['Établissement de santé','Établissement de santé'],
      ['Bâtiment public','Bâtiment public'],
      ['Commerces','Commerces'],
      ['Hôtellerie','Hôtellerie']
    ],
    apply: (site, value) => { site.type = value; }
  },
  {
    id: 'maturity',
    ask: () => "Aujourd’hui, votre site est-il déjà équipé d’une GTB / GTC ?",
    type: 'choice',
    options: [
      ['none','Non'],
      ['partial','Partiellement'],
      ['yes','Oui']
    ],
    apply: (site, value) => {
      site._chat = site._chat || {};
      site._chat.maturity = value;
      if(value === 'none'){
        site.existing = { interop:false, hourly:false, logging:false, manual:false };
      }
      if(value === 'partial'){
        site.existing = { interop:true, hourly:false, logging:false, manual:true };
      }
      if(value === 'yes'){
        site.existing = { interop:true, hourly:true, logging:true, manual:true };
      }
    }
  },
  {
    id: 'pain',
    ask: (site) => {
      const m = site._chat?.maturity;
      if(m === 'none') return "Quel est votre besoin principal aujourd’hui ?";
      if(m === 'partial') return "Quel est le principal point de douleur avec votre système actuel ?";
      return "Quel est le principal problème d’exploitation aujourd’hui ?";
    },
    type: 'choice',
    options: [
      ['cost','Factures élevées'],
      ['visibility','Manque de visibilité'],
      ['reg','Contrainte réglementaire'],
      ['ops','Difficulté d’exploitation']
    ],
    apply: (site, value) => {
      site._chat = site._chat || {};
      site._chat.pain = value;
      if(value === 'reg') site.powerKw = Math.max(site.powerKw || 0, 320);
      if(value === 'cost') site.targetClass = 'A';
      if(value === 'ops') site.supervision = 'oui';
    }
  },
  {
    id: 'surface',
    ask: () => "Quelle est la surface approximative du site (m²) ?",
    type: 'number',
    placeholder: 'Ex. 10000',
    apply: (site, value) => { site.surface = Number(value) || site.surface; }
  },
  {
    id: 'base_kwh',
    ask: () => "Disposez-vous d’un ordre de grandeur de consommation annuelle (kWh/an) ?",
    type: 'number',
    placeholder: 'Ex. 3500000',
    apply: (site, value) => { site.baseKwh = Number(value) || site.baseKwh; }
  },
  {
    id: 'power_kw',
    ask: () => "Quelle est la puissance CVC/ECS concernée (kW) ?",
    type: 'number',
    placeholder: 'Ex. 320',
    apply: (site, value) => { site.powerKw = Number(value) || site.powerKw; }
  },
  {
    id: 'objective',
    ask: () => "Quel est votre objectif principal ?",
    type: 'choice',
    options: [
      ['savings','Réduire les coûts'],
      ['compliance','Être conforme'],
      ['portfolio','Structurer le patrimoine'],
      ['works','Préparer des travaux']
    ],
    apply: (site, value) => {
      site._chat = site._chat || {};
      site._chat.objective = value;
      if(value === 'compliance') site.targetClass = 'B';
      if(value === 'savings') site.targetClass = 'A';
      if(value === 'works') site.project = 'Rénovation';
    }
  },
  {
    id: 'price_kwh',
    ask: () => "Quel prix moyen d’énergie voulez-vous retenir (€/kWh) ?",
    type: 'number',
    placeholder: 'Ex. 0,16',
    apply: (site, value) => {
      const normalized = Number(String(value).replace(',','.'));
      site.priceKwh = Number.isFinite(normalized) ? normalized : site.priceKwh;
    }
  }
];

function save(){ storage.save(project); }
function activeSite(){ return project.sites.find(s => s.id === project.activeSiteId) || project.sites[0]; }
function setActiveSite(id){ project.activeSiteId = id; save(); render(); }

function maturityLabel(site){
  const m = site._chat?.maturity;
  if(m === 'yes') return 'Maturité : GTB existante';
  if(m === 'partial') return 'Maturité : GTB partielle';
  if(m === 'none') return 'Maturité : à équiper';
  return 'Maturité : à qualifier';
}

function getVerdict(result){
  const roi = result.payback;
  const assuj = result.assuj?.isAssujetti;
  const irr = Number.isFinite(roi) && roi > 0 ? (1 / roi) : 0;
  if(assuj && (roi <= 4 || irr >= 0.18)){
    return {
      level:'high',
      label:'Investir maintenant',
      text:'Projet prioritaire : ROI attractif et contrainte réglementaire. Lancer rapidement une AMO et une consultation.',
      tag:'🔥 Priorité'
    };
  }
  if(assuj && roi <= 7){
    return {
      level:'medium',
      label:'Planifier l’investissement',
      text:'Projet pertinent mais à structurer : cadrer le périmètre et planifier sur 12–24 mois.',
      tag:'⚠️ À planifier'
    };
  }
  if(!assuj && roi <= 5){
    return {
      level:'low',
      label:'Optimisation opportuniste',
      text:'Projet intéressant sans contrainte réglementaire immédiate. À intégrer dans une stratégie globale.',
      tag:'⚡ Quick win'
    };
  }
  return {
    level:'neutral',
    label:'Reporter / affiner',
    text:'Projet à faible priorité ou ROI incertain. Nécessite un diagnostic complémentaire avant décision.',
    tag:'📊 À analyser'
  };
}

function answerQuestion(value){
  const site = activeSite();
  const q = QUESTIONS[state.currentQuestionIndex];
  if(!q) return;
  q.apply(site, value);
  site._chatAnswers = site._chatAnswers || [];
  site._chatAnswers.push({ q: q.ask(site), a: value });
  state.currentQuestionIndex = Math.min(state.currentQuestionIndex + 1, QUESTIONS.length - 1);
  save();
  render();
}

function renderTranscript(){
  const host = document.getElementById('chatTranscript');
  const site = activeSite();
  const answers = site._chatAnswers || [];
  const rows = [];
  for(let i=0; i<=Math.min(state.currentQuestionIndex, QUESTIONS.length-1); i++){
    const q = QUESTIONS[i];
    rows.push(`<div class="ev-chat-row ev-chat-row--bot"><div class="ev-chat-bubble ev-chat-bubble--bot">${q.ask(site)}</div></div>`);
    if(answers[i]){
      rows.push(`<div class="ev-chat-row ev-chat-row--user"><div class="ev-chat-bubble ev-chat-bubble--user">${answers[i].a}</div></div>`);
    }
  }
  host.innerHTML = rows.join('');
}

function renderComposer(){
  const host = document.getElementById('chatComposer');
  const q = QUESTIONS[state.currentQuestionIndex];
  if(!q){ host.innerHTML = ''; return; }

  if(q.type === 'choice'){
    host.innerHTML = `<div class="ev-chat-options">${q.options.map(([value,label]) => `<button class="ev-btn ev-btn--ghost" type="button" data-answer="${value}">${label}</button>`).join('')}</div>`;
  } else {
    host.innerHTML = `
      <div class="ev-chat-input-row">
        <input id="composerInput" class="ev-input" placeholder="${q.placeholder || ''}">
        <button id="composerSend" class="ev-btn ev-btn--primary" type="button">Valider</button>
      </div>`;
  }

  host.querySelectorAll('[data-answer]').forEach(btn => btn.addEventListener('click', () => answerQuestion(btn.dataset.answer)));
  host.querySelector('#composerSend')?.addEventListener('click', () => {
    const v = document.getElementById('composerInput').value;
    if(!v) return;
    answerQuestion(v);
  });
}

function renderSiteList(audit){
  const host = document.getElementById('siteList');
  host.innerHTML = project.sites.map(site => {
    const computed = audit.sites.find(s => s.id === site.id);
    return `<button class="ev-list-item ${site.id===project.activeSiteId?'is-active':''}" data-site="${site.id}" type="button">
      <div><strong>${site.name}</strong><small>${site.type} · ${site.surface.toLocaleString('fr-FR')} m²</small></div>
      <div class="ev-list-item__meta">${computed ? `P ${computed.result.priorityIndex}/100` : '—'}</div>
    </button>`;
  }).join('');
  host.querySelectorAll('[data-site]').forEach(btn => btn.addEventListener('click', () => {
    setActiveSite(btn.dataset.site);
  }));
}

function renderSummary(audit){
  document.getElementById('sumSites').textContent = audit.totals.sites;
  document.getElementById('sumAssuj').textContent = audit.totals.assuj;
  document.getElementById('sumCapex').textContent = eur(audit.totals.capex);
  document.getElementById('sumPriority').textContent = `${audit.totals.avgPriority}/100`;
}

function renderMain(audit){
  const site = audit.sites.find(s => s.id === project.activeSiteId) || audit.sites[0];
  const R = site.result;
  const verdict = getVerdict(R);

  document.getElementById('siteActiveName').textContent = site.name;
  document.getElementById('maturityChip').textContent = maturityLabel(site);
  document.getElementById('chatProgressLabel').textContent = `Question ${Math.min(state.currentQuestionIndex+1, QUESTIONS.length)}/${QUESTIONS.length}`;
  document.getElementById('chatProgressFill').style.width = `${((Math.min(state.currentQuestionIndex+1, QUESTIONS.length))/QUESTIONS.length)*100}%`;

  renderTranscript();
  renderComposer();

  const box = document.getElementById('verdictBox');
  box.className = `verdict-box ${verdict.level}`;
  document.getElementById('verdictTag').textContent = verdict.tag;
  document.getElementById('verdictTitle').textContent = verdict.label;
  document.getElementById('verdictText').textContent = verdict.text;

  document.getElementById('scoreValue').textContent = R.priorityIndex;
  document.getElementById('scoreTitle').textContent = `${verdict.label}`;
  document.getElementById('scoreText').textContent = verdict.text;
  document.getElementById('effortLevel').textContent = `Effort : ${R.effortLevel}`;

  const deg = (R.priorityIndex/100)*360;
  const color = R.priorityIndex >= 80 ? 'var(--danger)' : R.priorityIndex >= 60 ? 'var(--warn)' : 'var(--brand2)';
  document.getElementById('scoreRing').style.background = `radial-gradient(closest-side,#10251b 74%,transparent 75% 100%), conic-gradient(${color} ${deg}deg,#e8f0eb ${deg}deg)`;

  document.getElementById('decCapex').textContent = eur(R.packNetTtc);
  document.getElementById('decRoi').textContent = Number.isFinite(R.payback) ? `${dec1(R.payback)} ans` : 'n/d';
  document.getElementById('decReg').textContent = R.assuj.isAssujetti ? 'Assujetti' : 'À confirmer';
  document.getElementById('decPriority').textContent = verdict.label;

  const topActions = document.getElementById('topActions');
  topActions.innerHTML = audit.ranked.slice(0,3).map((s,i) => {
    const badge = s.result.priorityIndex > 75 ? '🔥 Priorité haute' : (Number.isFinite(s.result.payback) && s.result.payback <= 5 ? '⚡ Quick win' : '📊 Optimisation');
    return `<div class="ev-list-item static">
      <div><strong>#${i+1} ${s.name}</strong><small>${badge} — ROI ${Number.isFinite(s.result.payback) ? dec1(s.result.payback)+' ans' : 'n/d'}</small></div>
      <div class="ev-list-item__meta">${s.result.priorityIndex}/100</div>
    </div>`;
  }).join('');

  const ranking = document.getElementById('rankingList');
  ranking.innerHTML = audit.ranked.map((s,i) => `<div class="ev-list-item static">
      <div><strong>${i+1}. ${s.name}</strong><small>${s.result.assuj.isAssujetti ? 'Assujetti' : 'Non assujetti'} · Score ${s.result.globalScore}/100 · ROI ${Number.isFinite(s.result.payback) ? dec1(s.result.payback)+' ans' : 'n/d'}</small></div>
      <div class="ev-list-item__meta">${s.result.priorityIndex}/100</div>
    </div>`).join('');

  const year1 = audit.ranked.slice(0,3);
  const year2 = audit.ranked.slice(3,6);
  document.getElementById('phasingBox').innerHTML = `
    <div class="ev-phase-card"><strong>Année 1</strong><small>${year1.map(s=>s.name).join(', ') || '—'}</small></div>
    <div class="ev-phase-card"><strong>Année 2</strong><small>${year2.map(s=>s.name).join(', ') || '—'}</small></div>
  `;
}

function syncContact(){
  project.contact.firstName = document.getElementById('leadFirstName').value;
  project.contact.lastName = document.getElementById('leadLastName').value;
  project.contact.company = document.getElementById('leadCompany').value;
  project.contact.email = document.getElementById('leadEmail').value;
  project.contact.phone = document.getElementById('leadPhone').value;
  project.contact.message = document.getElementById('leadMessage').value;
  save();
}

function syncProposal(){
  project.proposal.client = document.getElementById('proposalClient').value;
  project.proposal.reference = document.getElementById('proposalRef').value;
  project.proposal.feeHt = Number(document.getElementById('proposalFee').value) || 0;
  project.proposal.delay = document.getElementById('proposalDelay').value;
  save();
}

async function downloadPdf(){
  syncContact();
  const lead = { ...project.contact, consent: document.getElementById('leadConsent').checked };
  const errors = validateLead(lead);
  if(Object.keys(errors).length){ alert(Object.values(errors)[0]); return; }
  const audit = runBacsAudit(project);
  await generatePremiumBacsPdf(project, audit);
}

async function sendLead(){
  syncContact();
  const lead = { ...project.contact, consent: document.getElementById('leadConsent').checked };
  const errors = validateLead(lead);
  if(Object.keys(errors).length){ alert(Object.values(errors)[0]); return; }
  await submitLeadToFormspree(FORMSPREE_URL, {
    source: 'starter-bacs-chat-premium',
    contact: project.contact,
    proposal: project.proposal,
    summary: runBacsAudit(project).totals
  });
  alert('Demande envoyée.');
}

async function downloadProposal(){
  syncContact();
  syncProposal();
  const audit = runBacsAudit(project);
  await generateCommercialProposalPdf(project, audit);
}

function bindStatic(){
  document.getElementById('addSiteBtn').addEventListener('click', () => {
    const site = createEmptySite(project.sites.length + 1);
    project.sites.push(site);
    project.activeSiteId = site.id;
    state.currentQuestionIndex = 0;
    save();
    render();
  });

  ['leadFirstName','leadLastName','leadCompany','leadEmail','leadPhone','leadMessage'].forEach(id => {
    document.getElementById(id).addEventListener('input', syncContact);
  });
  ['proposalClient','proposalRef','proposalFee','proposalDelay'].forEach(id => {
    document.getElementById(id).addEventListener('input', syncProposal);
  });
  document.getElementById('downloadPdfBtn').addEventListener('click', downloadPdf);
  document.getElementById('sendLeadBtn').addEventListener('click', sendLead);
  document.getElementById('downloadProposalBtn').addEventListener('click', downloadProposal);
}

function hydrateInputs(){
  document.getElementById('leadFirstName').value = project.contact.firstName || '';
  document.getElementById('leadLastName').value = project.contact.lastName || '';
  document.getElementById('leadCompany').value = project.contact.company || '';
  document.getElementById('leadEmail').value = project.contact.email || '';
  document.getElementById('leadPhone').value = project.contact.phone || '';
  document.getElementById('leadMessage').value = project.contact.message || '';
  document.getElementById('proposalClient').value = project.proposal.client || '';
  document.getElementById('proposalRef').value = project.proposal.reference || '';
  document.getElementById('proposalFee').value = project.proposal.feeHt || 0;
  document.getElementById('proposalDelay').value = project.proposal.delay || 'À confirmer';
}

function render(){
  const audit = runBacsAudit(project);
  renderSiteList(audit);
  renderSummary(audit);
  renderMain(audit);
  hydrateInputs();
}

bindStatic();
render();
