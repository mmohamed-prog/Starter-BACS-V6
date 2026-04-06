import { cloneCatalog } from './catalog.js';
import { computeSite, buildSalesReadout } from './engine.js';
import { computePortfolio, buildPortfolioReadout } from './multisite.js';
import { saveState, loadState, clearState } from './storage.js';
import { sendLead, buildPayload } from './crm.js';
import { exportPortfolioPdf } from './pdf.js';
import { APP_CONFIG } from './app-config.js';

const state = {
  currentStep: 0,
  portfolio: { name: '', customerType: 'tertiaire', targetYear: '2030', objective: 'economies' },
  currentSite: {
    name: '', segment: 'tertiaire', usage: 'bureaux', surface: 2400, act: 420000, target: 290000,
    price: 0.18, co2: 0.204, gtb: 'non', dataQuality: 'moyenne', projectIntent: 'aucune', aidesPct: 20
  },
  catalog: cloneCatalog(),
  sites: [],
  computedSite: null,
  portfolioResult: null,
  contact: { name: '', email: '', phone: '', company: '', message: '' }
};

const stepsMeta = [
  ['Étape 1 sur 5 — Cadre portefeuille', 'Renseignez le contexte du portefeuille, le type d’actifs concernés et le niveau de priorité donné au sujet BACS.'],
  ['Étape 2 sur 5 — Données site', 'Ajoutez un ou plusieurs sites et précisez les caractéristiques utiles à une première lecture Décret BACS.'],
  ['Étape 3 sur 5 — Leviers BACS', 'Sélectionnez les leviers techniques et organisationnels à intégrer dans l’analyse.'],
  ['Étape 4 sur 5 — Synthèse portefeuille', 'Consultez la lecture d’opportunité, les priorités, les ordres de grandeur économiques et les points de vigilance.'],
  ['Étape 5 sur 5 — Export & suite', 'Téléchargez la note de cadrage et préparez la prochaine étape.']
];

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeSiteId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `site-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureSiteIdentity(site) {
  return { ...site, siteId: site?.siteId || makeSiteId() };
}

function safeBind(selector, eventName, handler) {
  const node = $(selector);
  if (node) node.addEventListener(eventName, handler);
  return node;
}

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { t.style.display = 'none'; }, 2400);
}

function euro(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
}

function setStep(step) {
  state.currentStep = Math.max(0, Math.min(4, step));
  const [title, sub] = stepsMeta[state.currentStep];
  $('#wizardTitle').textContent = title;
  $('#wizardSub').textContent = sub;
  $('#wizardRemain').textContent = `${4 - state.currentStep} étape${4 - state.currentStep > 1 ? 's' : ''} restante${4 - state.currentStep > 1 ? 's' : ''}`;
  $('#progressFill').style.width = `${((state.currentStep + 1) / 5) * 100}%`;

  $$('.panel').forEach((p, i) => p.classList.toggle('active', i === state.currentStep));
  $$('#wizardSteps .step').forEach((s, i) => {
    s.classList.toggle('active', i === state.currentStep);
    s.classList.toggle('done', i < state.currentStep);
  });

  $('#prevBtn').style.visibility = state.currentStep === 0 ? 'hidden' : 'visible';
  $('#nextBtn').style.display = state.currentStep === 4 ? 'none' : 'inline-flex';
  if (state.currentStep === 3) renderPortfolioResults();
  if (state.currentStep === 4) syncContactFields();
}

function readPortfolioFields() {
  state.portfolio.name = $('#portfolioName').value.trim();
  state.portfolio.customerType = $('#customerType').value;
  state.portfolio.targetYear = $('#targetYear').value;
  state.portfolio.objective = $('#objective').value;
}

function readCurrentSiteFields() {
  state.currentSite = {
    name: $('#siteName').value.trim(),
    segment: $('#segment').value,
    usage: $('#usage').value,
    surface: Number($('#surface').value) || 0,
    act: Number($('#act').value) || 0,
    target: Number($('#target').value) || 0,
    price: Number($('#price').value) || 0,
    co2: Number($('#co2').value) || 0,
    gtb: $('#gtb').value,
    dataQuality: $('#dataQuality').value,
    projectIntent: $('#projectIntent').value,
    aidesPct: Number($('#aidesPct').value) || 0
  };
}

function syncPortfolioFields() {
  $('#portfolioName').value = state.portfolio.name;
  $('#customerType').value = state.portfolio.customerType;
  $('#targetYear').value = state.portfolio.targetYear;
  $('#objective').value = state.portfolio.objective;
}

function syncSiteFields() {
  const s = state.currentSite;
  $('#siteName').value = s.name;
  $('#segment').value = s.segment;
  $('#usage').value = s.usage;
  $('#surface').value = s.surface;
  $('#act').value = s.act;
  $('#target').value = s.target;
  $('#price').value = s.price;
  $('#co2').value = s.co2;
  $('#gtb').value = s.gtb;
  $('#dataQuality').value = s.dataQuality;
  $('#projectIntent').value = s.projectIntent;
  $('#aidesPct').value = s.aidesPct;
}

function renderCatalog() {
  const grid = $('#catalogGrid');
  grid.innerHTML = '';
  state.catalog.forEach(item => {
    const card = document.createElement('label');
    card.className = 'measure-card';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.id = String(item.id || '');
    input.checked = !!item.selected;

    const content = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = item.label || 'Mesure BACS';
    const detail = document.createElement('span');
    detail.textContent = `Gain ${Math.round((item.gain || 0) * 100)}% · CAPEX ${item.capexM2 || 0} €/m² · complexité ${item.complexity || 'moyenne'}`;
    const meta = document.createElement('div');
    meta.className = 'measure-meta';
    meta.textContent = `${item.regulatory ? 'Bonus réglementaire' : 'Levier technique'} · ${item.priority === 'quick-win' ? 'quick win' : 'structurant'}`;

    content.append(title, detail, meta);
    card.append(input, content);
    grid.appendChild(card);
  });

  grid.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', e => {
      const target = state.catalog.find(m => m.id === e.target.dataset.id);
      if (target) target.selected = e.target.checked;
      renderMeasureCounters();
      recomputeAllSitesFromCatalog();
    });
  });
  renderMeasureCounters();
}

function renderMeasureCounters() {
  const active = state.catalog.filter(m => m.selected);
  $('#activeMeasuresCount').textContent = String(active.length);
  $('#quickWinCount').textContent = String(active.filter(m => m.priority === 'quick-win').length);
  $('#structuringCount').textContent = String(active.filter(m => m.priority !== 'quick-win').length);
  const fallback = $('#measureFallbackHint');
  if (fallback) {
    fallback.textContent = active.length
      ? `Le calcul utilisera ${active.length} levier${active.length > 1 ? 's' : ''} sélectionné${active.length > 1 ? 's' : ''}.`
      : 'Aucun levier sélectionné : un socle BACS standard est appliqué par défaut pour la simulation.';
  }
}

function getEffectiveCatalog() {
  const active = state.catalog.filter(m => m.selected);
  return active.length ? state.catalog : state.catalog.map((m, idx) => ({ ...m, selected: idx < 4 }));
}

function recomputeAllSitesFromCatalog() {
  if (!state.sites.length) {
    recomputePortfolio();
    renderSummaryCards();
    if (state.currentStep >= 3) renderPortfolioResults();
    return;
  }

  const catalog = getEffectiveCatalog().map(m => ({ ...m }));
  state.sites = state.sites.map(site => ensureSiteIdentity(computeSite(site, catalog.map(item => ({ ...item })) )));
  recomputePortfolio();
  renderSitesList();
  renderSummaryCards();
  if (state.currentStep >= 3) renderPortfolioResults();
}

function computeCurrentSite() {
  readCurrentSiteFields();
  state.currentSite = ensureSiteIdentity(state.currentSite);
  const chosen = getEffectiveCatalog();
  state.computedSite = computeSite(state.currentSite, chosen.map(m => ({ ...m })));
  showToast('Première lecture du site mise à jour.');
  return state.computedSite;
}

function addCurrentSite() {
  const computed = ensureSiteIdentity(computeCurrentSite());
  const existingIndex = state.sites.findIndex(s => s.siteId === computed.siteId);
  if (existingIndex >= 0) state.sites[existingIndex] = computed;
  else state.sites.push(computed);
  recomputePortfolio();
  renderSitesList();
  renderSummaryCards();
  showToast(existingIndex >= 0 ? 'Site mis à jour dans l’analyse.' : 'Site ajouté au portefeuille.');
}

function renderSitesList() {
  const root = $('#portfolioSitesList');
  root.innerHTML = '';

  if (!state.sites.length) {
    const empty = document.createElement('div');
    empty.className = 'site-row';
    const wrapper = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = 'Aucun site ajouté';
    const note = document.createElement('span');
    note.textContent = 'Ajoutez un premier site pour construire le portefeuille.';
    wrapper.append(title, note);
    empty.appendChild(wrapper);
    root.appendChild(empty);
    $('#siteCountPill').textContent = '0 site';
    return;
  }

  state.sites.forEach((site, idx) => {
    const row = document.createElement('div');
    row.className = 'site-row';
    const priority = site.leadScore >= 80 ? 'high' : site.leadScore >= 55 ? 'medium' : 'low';

    const left = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = site.name || `Site ${idx + 1}`;
    const meta = document.createElement('span');
    meta.textContent = `${Math.round(site.surface).toLocaleString('fr-FR')} m² · ROI ${site.roi != null ? site.roi.toFixed(1).replace('.', ',') + ' ans' : 'n/d'} · ${euro(site.savingsEur || 0)}/an · Fiabilité ${site.reliabilityScore || 0}/100`;
    left.append(title, meta);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';
    right.style.flexWrap = 'wrap';
    right.style.alignItems = 'center';

    const tag = document.createElement('span');
    tag.className = `tag ${priority}`;
    tag.textContent = `${site.leadScore}/100`;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-light btn-sm';
    editBtn.type = 'button';
    editBtn.dataset.edit = site.siteId;
    editBtn.textContent = 'Éditer';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-light btn-sm';
    deleteBtn.type = 'button';
    deleteBtn.dataset.delete = site.siteId;
    deleteBtn.textContent = 'Supprimer';

    right.append(tag, editBtn, deleteBtn);
    row.append(left, right);
    root.appendChild(row);
  });

  $('#siteCountPill').textContent = `${state.sites.length} site${state.sites.length > 1 ? 's' : ''}`;

  root.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
    const site = state.sites.find(entry => entry.siteId === btn.dataset.edit);
    if (!site) return;
    state.currentSite = {
      siteId: site.siteId,
      name: site.name || '',
      segment: site.segment || 'tertiaire',
      usage: site.usage || 'bureaux',
      surface: site.surface || 0,
      act: site.act || 0,
      target: site.target || 0,
      price: site.price || 0,
      co2: site.co2 || 0,
      gtb: site.gtb || 'non',
      dataQuality: site.dataQuality || 'moyenne',
      projectIntent: site.projectIntent || 'aucune',
      aidesPct: site.aidesPct || 0
    };
    syncSiteFields();
    setStep(1);
  }));

  root.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => {
    state.sites = state.sites.filter(entry => entry.siteId !== btn.dataset.delete);
    recomputePortfolio();
    renderSitesList();
    renderSummaryCards();
  }));
}

function recomputePortfolio() {
  state.portfolioResult = computePortfolio(state.sites);
}

function renderSummaryCards() {
  const p = state.portfolioResult || computePortfolio(state.sites);
  $('#summarySites').textContent = String(p.siteCount || 0);
  $('#summarySurface').textContent = `${Math.round(p.totalSurface || 0).toLocaleString('fr-FR')} m²`;
  $('#summaryPotential').textContent = p.siteCount ? (p.avgLead >= 80 ? 'Priorité élevée' : p.avgLead >= 55 ? 'À structurer rapidement' : 'À qualifier') : 'À construire';
}

function renderPortfolioResults() {
  recomputePortfolio();
  const p = state.portfolioResult;
  const readout = buildPortfolioReadout(p);
  const score = Math.round(p.avgLead || 0);
  $('#portfolioHeadline').textContent = !p.siteCount ? 'Votre synthèse portefeuille apparaîtra ici.' : p.status === 'prioritaire' ? 'Votre portefeuille appelle une priorisation rapide des premières actions BACS.' : p.status === 'à traiter' ? 'Votre portefeuille nécessite un cadrage des arbitrages BACS à court terme.' : 'Votre portefeuille peut être structuré progressivement.';
  $('#portfolioLead').textContent = readout.join(' ');
  $('#portfolioScore').textContent = String(score);
  $('#scoreRing').style.background = `radial-gradient(closest-side, white 75%, transparent 76% 100%), conic-gradient(var(--brand) 0 ${score}%, #e6eee9 ${score}% 100%)`;
  $('#scoreComment').textContent = score >= 80 ? `Ce score synthétique traduit une priorité d’intervention élevée. Fiabilité moyenne ${Math.round(p.avgReliability || 0)}/100.` : score >= 55 ? `Ce score synthétique indique une priorité d’intervention réelle. Fiabilité moyenne ${Math.round(p.avgReliability || 0)}/100.` : `Ce score synthétique donne une première lecture à qualifier. Fiabilité moyenne ${Math.round(p.avgReliability || 0)}/100.`;
  $('#portfolioStatusPill').textContent = p.status || 'Synthèse';
  $('#kpiSites').textContent = String(p.siteCount || 0);
  $('#kpiSurface').textContent = `${Math.round(p.totalSurface || 0).toLocaleString('fr-FR')} m²`;
  $('#kpiCapex').textContent = euro(p.totalCapex || 0);
  $('#kpiSavings').textContent = euro(p.totalSavings || 0);
  $('#kpiRoi').textContent = p.roi != null ? `${p.roi.toFixed(1).replace('.', ',')} ans` : '—';
  $('#kpiCo2').textContent = `${Math.round((p.totalCo2 || 0) / 1000).toLocaleString('fr-FR')} t`;

  const rankingRoot = $('#rankingList');
  rankingRoot.innerHTML = '';
  (p.ranking || []).forEach(site => {
    const priority = site.leadScore >= 80 ? 'high' : site.leadScore >= 55 ? 'medium' : 'low';
    const row = document.createElement('div');
    row.className = 'site-row';
    row.innerHTML = `<div><b>${escapeHtml(site.name || 'Sans nom')}</b><span>${escapeHtml(site.usage || 'Usage')} · ${Math.round(site.surface).toLocaleString('fr-FR')} m² · ${euro(site.savingsEur || 0)}/an · Fiabilité ${site.reliabilityScore || 0}/100</span></div><span class="tag ${priority}">${site.leadScore}/100</span>`;
    rankingRoot.appendChild(row);
  });
  if (!p.ranking?.length) rankingRoot.innerHTML = '<div class="site-row"><div><b>Aucun résultat</b><span>Ajoutez des sites pour afficher un classement.</span></div></div>';

  const topActionsRoot = $('#topActionsList');
  topActionsRoot.innerHTML = '';
  const allActions = (p.ranking || []).flatMap(site => (site.topActions || []).map(action => ({ ...action, siteName: site.name })));
  const deduped = allActions.sort((a, b) => b.score - a.score).slice(0, 3);
  deduped.forEach(action => {
    const item = document.createElement('div');
    item.className = 'action-item';
    item.innerHTML = `<b>${escapeHtml(action.label)} — ${escapeHtml(action.siteName || 'Site')}</b><span>Priorité ${action.score}/100 · ROI ${Number.isFinite(action.payback) ? action.payback.toFixed(1).replace('.', ',') + ' ans' : 'n/d'} · Gain ${action.gainPct}% · ${escapeHtml(action.rationale || 'levier à étudier')}</span>`;
    topActionsRoot.appendChild(item);
  });
  if (!deduped.length) topActionsRoot.innerHTML = '<div class="action-item"><b>Aucune action affichée</b><span>Calculez au moins un site pour afficher des actions prioritaires.</span></div>';

  const salesRoot = $('#salesReadout');
  salesRoot.innerHTML = '';
  const salesLines = (p.ranking || []).length ? buildSalesReadout(p.ranking[0]).concat(readout) : ['Ajoutez des sites puis calculez pour générer une première lecture de cadrage.'];
  salesLines.forEach(line => {
    const item = document.createElement('div');
    item.className = 'action-item';
    item.innerHTML = `<span>${escapeHtml(line)}</span>`;
    salesRoot.appendChild(item);
  });
}

function syncContactFields() {
  $('#contactName').value = state.contact.name || '';
  $('#contactEmail').value = state.contact.email || '';
  $('#contactPhone').value = state.contact.phone || '';
  $('#contactCompany').value = state.contact.company || '';
  $('#contactMessage').value = state.contact.message || '';
}

function readContactFields() {
  state.contact = {
    name: $('#contactName').value.trim(),
    email: $('#contactEmail').value.trim(),
    phone: $('#contactPhone').value.trim(),
    company: $('#contactCompany').value.trim(),
    message: $('#contactMessage').value.trim()
  };
}

function validateStep(step) {
  if (step === 0) {
    readPortfolioFields();
    if (!state.portfolio.name) { showToast('Renseignez un nom de portefeuille.'); return false; }
  }
  if (step === 1) {
    if (!state.sites.length) { showToast('Ajoutez au moins un site au portefeuille.'); return false; }
  }
  if (step === 3) {
    if (!state.portfolioResult?.siteCount) { showToast('Aucun résultat portefeuille à exporter.'); return false; }
  }
  return true;
}

function canAccessStep(targetStep) {
  for (let step = 0; step < targetStep; step += 1) {
    if (!validateStep(step)) return false;
  }
  return true;
}

function scrollToWizard() { $('#wizardSection').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function loadDemo() {
  state.portfolio = { name: 'Patrimoine tertiaire — exemple', customerType: 'tertiaire', targetYear: '2030', objective: 'strategie' };
  state.catalog.forEach((m, idx) => { m.selected = idx < 6; });
  const demoCatalog = getEffectiveCatalog().map(m => ({ ...m }));
  state.sites = [
    ensureSiteIdentity(computeSite({ name: 'Site A — Bureaux', segment: 'tertiaire', usage: 'bureaux', surface: 4500, act: 820000, target: 560000, price: 0.18, co2: 0.204, gtb: 'non', dataQuality: 'faible', projectIntent: 'travaux_12m', aidesPct: 20 }, demoCatalog.map(m => ({ ...m })))),
    ensureSiteIdentity(computeSite({ name: 'Site B — Enseignement', segment: 'public', usage: 'enseignement', surface: 6200, act: 1100000, target: 760000, price: 0.16, co2: 0.055, gtb: 'partielle', dataQuality: 'moyenne', projectIntent: 'travaux_24m', aidesPct: 25 }, demoCatalog.map(m => ({ ...m })))),
    ensureSiteIdentity(computeSite({ name: 'Site C — Santé', segment: 'tertiaire', usage: 'sante', surface: 2800, act: 510000, target: 410000, price: 0.19, co2: 0.204, gtb: 'complete', dataQuality: 'bonne', projectIntent: 'audit', aidesPct: 15 }, demoCatalog.map(m => ({ ...m }))))
  ];
  syncPortfolioFields();
  renderCatalog();
  renderSitesList();
  renderSummaryCards();
  recomputePortfolio();
  renderPortfolioResults();
  showToast('Exemple de portefeuille chargé.');
  setStep(3);
}

async function handleSendLead() {
  readContactFields();
  if (!state.portfolioResult?.siteCount) { showToast('Calculez d’abord un portefeuille avant l’envoi.'); return; }
  if (!state.contact.name || !state.contact.email) { showToast('Renseignez au moins le nom et l’email.'); return; }
  if (!$('#consent').checked) { showToast('Merci de cocher le consentement RGPD.'); return; }
  const payload = buildPayload({ contact: state.contact, portfolio: { ...state.portfolioResult, name: state.portfolio.name }, topSite: state.portfolioResult?.ranking?.[0] });
  const btn = $('#sendLeadBtn');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  try {
    const result = await sendLead(payload);
    if (result?.mode === 'mailto') {
      btn.textContent = 'Email prérempli ✔';
      showToast('Votre client mail a été ouvert avec le message prérempli.');
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Envoyer ma demande';
      }, 1200);
    } else {
      btn.textContent = 'Envoyé ✔';
      showToast('Votre demande a bien été prise en compte.');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Envoyer ma demande';
    showToast('Erreur d’envoi. Vérifiez votre connexion.');
  }
}

async function handleExportPdf() {
  if (!state.portfolioResult?.siteCount) { showToast('Aucun portefeuille à exporter.'); return; }
  try {
    await exportPortfolioPdf({
      portfolioName: state.portfolio.name,
      portfolio: state.portfolioResult
    });
  } catch (error) {
    console.error(error);
    showToast('L’export PDF a échoué.');
  }
}

function resetAll() {
  state.currentStep = 0;
  state.portfolio = { name: '', customerType: 'tertiaire', targetYear: '2030', objective: 'economies' };
  state.currentSite = { siteId: null, name: '', segment: 'tertiaire', usage: 'bureaux', surface: 2400, act: 420000, target: 290000, price: 0.18, co2: 0.204, gtb: 'non', dataQuality: 'moyenne', projectIntent: 'aucune', aidesPct: 20 };
  state.catalog = cloneCatalog();
  state.sites = [];
  state.computedSite = null;
  state.portfolioResult = null;
  state.contact = { name: '', email: '', phone: '', company: '', message: '' };
  clearState();
  $('#consent').checked = false;
  syncPortfolioFields();
  syncSiteFields();
  renderCatalog();
  renderSitesList();
  renderSummaryCards();
  setStep(0);
  showToast('Pré-diagnostic réinitialisé.');
}

function persist() {
  saveState({
    currentStep: state.currentStep,
    portfolio: state.portfolio,
    currentSite: state.currentSite,
    catalog: state.catalog,
    sites: state.sites,
    contact: state.contact
  });
}

function restore() {
  const saved = loadState();
  if (!saved) { showToast('Aucune sauvegarde locale.'); return; }

  state.currentStep = Number.isFinite(saved.currentStep) ? saved.currentStep : 0;
  state.portfolio = { ...state.portfolio, ...(saved.portfolio || {}) };
  state.currentSite = ensureSiteIdentity({ ...state.currentSite, ...(saved.currentSite || {}) });
  const baseCatalog = cloneCatalog();
  if (Array.isArray(saved.catalog) && saved.catalog.length) {
    const selectedMap = new Map(saved.catalog.map(item => [item.id, !!item.selected]));
    state.catalog = baseCatalog.map(item => ({ ...item, selected: selectedMap.has(item.id) ? selectedMap.get(item.id) : item.selected }));
  } else {
    state.catalog = baseCatalog;
  }
  state.contact = { ...state.contact, ...(saved.contact || {}) };

  const catalogForSites = state.catalog.map(item => ({ ...item }));
  state.sites = Array.isArray(saved.sites)
    ? saved.sites
        .map(site => ensureSiteIdentity({ ...site }))
        .map(site => computeSite(site, catalogForSites.map(item => ({ ...item }))))
    : [];

  syncPortfolioFields();
  syncSiteFields();
  renderCatalog();
  recomputePortfolio();
  renderSitesList();
  renderSummaryCards();
  renderPortfolioResults();
  syncContactFields();
  setStep(state.currentStep || 0);
  showToast('Sauvegarde restaurée.');
}

function bindEvents() {
  ['#heroCalendlyBtn', '#hubCalendlyBtn', '#calendlyBtn'].forEach(selector => {
    const link = $(selector);
    if (link) link.setAttribute('href', APP_CONFIG.calendlyUrl);
  });

  safeBind('#scrollToWizard', 'click', scrollToWizard);
  safeBind('#hubStart', 'click', scrollToWizard);
  safeBind('#loadDemo', 'click', loadDemo);
  safeBind('#computeSiteBtn', 'click', computeCurrentSite);
  safeBind('#addSiteBtn', 'click', addCurrentSite);
  safeBind('#nextBtn', 'click', () => { if (validateStep(state.currentStep)) setStep(state.currentStep + 1); });
  safeBind('#prevBtn', 'click', () => setStep(state.currentStep - 1));
  safeBind('#resetBtn', 'click', resetAll);
  safeBind('#saveLocalBtn', 'click', () => { readPortfolioFields(); readCurrentSiteFields(); readContactFields(); persist(); showToast('Sauvegarde locale effectuée.'); });
  safeBind('#restoreLocalBtn', 'click', restore);
  safeBind('#exportPdfBtn', 'click', handleExportPdf);
  safeBind('#sendLeadBtn', 'click', handleSendLead);

  $$('#wizardSteps .step').forEach((step, i) => step.addEventListener('click', () => {
    if (i <= state.currentStep || canAccessStep(i)) setStep(i);
  }));
}

function init() {
  syncPortfolioFields();
  syncSiteFields();
  renderCatalog();
  recomputePortfolio();
  renderSitesList();
  renderSummaryCards();
  setStep(0);
  bindEvents();
}

init();
