
import { clone, getByPath, setByPath, eur, int0, dec1, num } from '../core/helpers.js';
import { createEmptySite } from '../core/state.js';
import { validateSite, validateLead } from '../core/validators.js';

function makeStepCard(step, index, active){
  return `<button class="ev-step ${active ? 'is-active' : ''}" data-go-step="${index}" type="button">
    <span class="ev-step__n">${index+1}</span>
    <span><strong>${step.short}</strong><small>${step.subtitle}</small></span>
  </button>`;
}
function fieldsSite(site){
  return `
  <div class="ev-section-box">
    <div class="ev-section-box__head"><h4>Site actif</h4><span class="ev-chip ev-chip--soft">${site.name}</span></div>
    <div class="ev-grid g3">
      <div class="ev-field"><label>Nom du site</label><input class="ev-input" data-site-bind="name" value="${site.name}"></div>
      <div class="ev-field"><label>Type</label>
        <select class="ev-select" data-site-bind="type">
          ${['Bureaux tertiaires','Établissement d’enseignement','Bâtiment industriel','Établissement de santé','Datacenter','Bâtiment public','Commerces','Hôtellerie','Restauration'].map(v=>`<option value="${v}" ${site.type===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="ev-field"><label>Projet</label>
        <select class="ev-select" data-site-bind="project">
          ${['Neuf','Rénovation','Remplacement'].map(v=>`<option value="${v}" ${site.project===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="ev-field"><label>Zone climatique</label>
        <select class="ev-select" data-site-bind="zone">
          ${['H1','H2','H3'].map(v=>`<option value="${v}" ${site.zone===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="ev-field"><label>Surface (m²)</label><input class="ev-input" type="number" data-site-bind="surface" value="${site.surface}"></div>
      <div class="ev-field"><label>Zones principales</label><input class="ev-input" type="number" data-site-bind="zones" value="${site.zones}"></div>
      <div class="ev-field"><label>Consommation (kWh/an)</label><input class="ev-input" type="number" data-site-bind="baseKwh" value="${site.baseKwh}"></div>
      <div class="ev-field"><label>Prix énergie (€/kWh)</label><input class="ev-input" data-site-bind="priceKwh" value="${String(site.priceKwh).replace('.',',')}"></div>
      <div class="ev-field"><label>Puissance totale (kW)</label><input class="ev-input" type="number" data-site-bind="powerKw" value="${site.powerKw}"></div>
    </div>
  </div>
  <div class="ev-section-box">
    <h4>Systèmes présents</h4>
    <div class="ev-checks">
      ${[
        ['systems.heat','Chauffage'],['systems.cool','Climatisation'],['systems.vent','Ventilation'],
        ['systems.ecs','ECS'],['systems.light','Éclairage'],['systems.other','Autres']
      ].map(([path,label]) => `<label class="ev-check"><input type="checkbox" data-site-bind="${path}" ${getByPath(site,path)?'checked':''}><span>${label}</span></label>`).join('')}
    </div>
  </div>
  `;
}
function fieldsBacs(site){
  return `
  <div class="ev-grid g3">
    <div class="ev-field"><label>Classe visée</label>
      <select class="ev-select" data-site-bind="targetClass">
        ${['C','B','A'].map(v=>`<option value="${v}" ${site.targetClass===v?'selected':''}>${v}</option>`).join('')}
      </select></div>
    <div class="ev-field"><label>Supervision</label>
      <select class="ev-select" data-site-bind="supervision">
        ${[['non','Non'],['partielle','Partielle'],['oui','Oui']].map(([v,l])=>`<option value="${v}" ${site.supervision===v?'selected':''}>${l}</option>`).join('')}
      </select></div>
    <div class="ev-field"><label>Prix CEE (€/MWhc)</label><input class="ev-input" data-site-bind="ceePrice" value="${site.ceePrice}"></div>
  </div>
  <div class="ev-section-box"><h4>Socle BACS existant</h4>
    <div class="ev-checks">
      ${[
        ['existing.interop','Interopérabilité'],
        ['existing.hourly','Mesure horaire / sous-comptage'],
        ['existing.logging','Journalisation ≥ 5 ans'],
        ['existing.manual','Pilotage / planning']
      ].map(([path,label]) => `<label class="ev-check"><input type="checkbox" data-site-bind="${path}" ${getByPath(site,path)?'checked':''}><span>${label}</span></label>`).join('')}
    </div>
  </div>
  <div class="ev-section-box"><h4>Usages pilotés</h4>
    <div class="ev-checks">
      <label class="ev-check"><input type="checkbox" checked disabled><span>Chauffage</span></label>
      ${[
        ['usages.ecs','ECS'],['usages.cool','Climatisation'],['usages.light','Éclairage'],['usages.aux','Auxiliaires']
      ].map(([path,label]) => `<label class="ev-check"><input type="checkbox" data-site-bind="${path}" ${getByPath(site,path)?'checked':''}><span>${label}</span></label>`).join('')}
    </div>
  </div>`;
}
function portfolioSidebar(project, audit, activeSiteId){
  return `<div class="ev-section-box">
    <div class="ev-section-box__head">
      <h4>Portefeuille</h4>
      <button class="ev-btn ev-btn--ghost" data-add-site type="button">+ Ajouter</button>
    </div>
    <div class="ev-list">
      ${project.sites.map((site, idx) => {
        const computed = audit?.sites?.find(s => s.id === site.id);
        return `<button class="ev-list-item ${site.id===activeSiteId?'is-active':''}" data-select-site="${site.id}" type="button">
          <div><strong>${site.name}</strong><small>${site.type} · ${int0(site.surface)} m²</small></div>
          <div class="ev-list-item__meta">${computed ? `P ${computed.result.priorityIndex}/100` : '—'}</div>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}
function renderResults(audit, project){
  const top = audit.ranked.slice(0, 3);
  const phases = {
    year1: audit.ranked.filter(s => s.result.priorityIndex >= 80 || (Number.isFinite(s.result.payback) && s.result.payback <= 3)),
    year2: audit.ranked.filter(s => s.result.assuj.isAssujetti && !s.result.baseOk && !(s.result.priorityIndex >= 80 || (Number.isFinite(s.result.payback) && s.result.payback <= 3))),
    year3: audit.ranked.filter(s => !s.result.assuj.isAssujetti || s.result.baseOk)
  };
  return `
  <div class="ev-grid g2">
    <div class="ev-section-box">
      <h4>Synthèse portefeuille</h4>
      <div class="ev-kpi-grid">
        <div class="ev-kpi"><b>Sites</b><span>${audit.totals.sites}</span></div>
        <div class="ev-kpi"><b>Assujettis</b><span>${audit.totals.assuj}</span></div>
        <div class="ev-kpi"><b>Capex TTC</b><span>${eur(audit.totals.capex)}</span></div>
        <div class="ev-kpi"><b>Économies/an</b><span>${eur(audit.totals.savings)}</span></div>
        <div class="ev-kpi"><b>ROI moyen</b><span>${Number.isFinite(audit.totals.avgRoi) ? dec1(audit.totals.avgRoi)+' ans' : '—'}</span></div>
        <div class="ev-kpi ev-kpi--dark"><b>Priorité</b><span>${audit.totals.avgPriority}/100</span></div>
      </div>
    </div>
    <div class="ev-section-box">
      <h4>Top 3 actions portefeuille</h4>
      <div class="ev-list ev-list--soft">
        ${top.map((site, i) => `<div class="ev-list-item static">
          <div><strong>${i+1}. ${site.name}</strong><small>${site.result.assuj.isAssujetti ? 'Assujetti' : 'Non assujetti'} · ROI ${Number.isFinite(site.result.payback) ? dec1(site.result.payback)+' ans' : '—'}</small></div>
          <div class="ev-badge ${site.result.priorityIndex>=80?'is-danger':Number.isFinite(site.result.payback)&&site.result.payback<=3?'is-success':'is-info'}">${site.result.priorityIndex>=80?'Conformité':Number.isFinite(site.result.payback)&&site.result.payback<=3?'Quick win':'Optimisation'}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>
  <div class="ev-grid g2" style="margin-top:14px">
    <div class="ev-section-box">
      <h4>Classement portefeuille</h4>
      <div class="ev-list">
        ${audit.ranked.map((site, i) => `<div class="ev-list-item static">
          <div><strong>${i+1}. ${site.name}</strong><small>Score ${site.result.globalScore}/100 · ${site.result.assuj.isAssujetti ? 'Assujetti' : 'Non assujetti'} · ROI ${Number.isFinite(site.result.payback) ? dec1(site.result.payback)+' ans' : '—'}</small></div>
          <div class="ev-list-item__meta">${site.result.priorityIndex}/100</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="ev-section-box">
      <h4>Plan d’investissement</h4>
      <div class="ev-phase-card"><strong>Année 1 — Priorités immédiates</strong><small>${phases.year1.length} site(s) · ${eur(phases.year1.reduce((a,s)=>a+s.result.packTtc,0))}</small></div>
      <div class="ev-phase-card"><strong>Année 2 — Mise en conformité</strong><small>${phases.year2.length} site(s) · ${eur(phases.year2.reduce((a,s)=>a+s.result.packTtc,0))}</small></div>
      <div class="ev-phase-card"><strong>Année 3 — Optimisation</strong><small>${phases.year3.length} site(s) · ${eur(phases.year3.reduce((a,s)=>a+s.result.packTtc,0))}</small></div>
    </div>
  </div>`;
}
function renderLead(project){
  return `
  <div class="ev-grid g2">
    <div class="ev-section-box ev-section-box--dark">
      <h4>Déblocage PDF</h4>
      <p>Le PDF est débloqué après validation des informations de contact et consentement.</p>
      <div class="ev-grid g2">
        <div class="ev-field"><label>Prénom</label><input class="ev-input" data-contact-bind="firstName" value="${project.contact.firstName || ''}"></div>
        <div class="ev-field"><label>Nom</label><input class="ev-input" data-contact-bind="lastName" value="${project.contact.lastName || ''}"></div>
        <div class="ev-field"><label>Société</label><input class="ev-input" data-contact-bind="company" value="${project.contact.company || ''}"></div>
        <div class="ev-field"><label>Email professionnel</label><input class="ev-input" data-contact-bind="email" value="${project.contact.email || ''}"></div>
        <div class="ev-field"><label>Téléphone</label><input class="ev-input" data-contact-bind="phone" value="${project.contact.phone || ''}"></div>
        <div class="ev-field"><label>Message</label><input class="ev-input" data-contact-bind="message" value="${project.contact.message || ''}"></div>
      </div>
      <label class="ev-check"><input type="checkbox" data-contact-consent><span>Je consens au traitement de mes données pour être recontacté.</span></label>
      <div class="ev-btn-row">
        <button class="ev-btn ev-btn--primary" data-download-pdf type="button">Télécharger le PDF premium</button>
        <button class="ev-btn ev-btn--ghost" data-send-lead type="button">Envoyer la demande</button>
      </div>
    </div>
    <div class="ev-section-box">
      <h4>Proposition commerciale</h4>
      <div class="ev-grid g2">
        <div class="ev-field"><label>Client</label><input class="ev-input" data-proposal-bind="client" value="${project.proposal.client || ''}"></div>
        <div class="ev-field"><label>Référence mission</label><input class="ev-input" data-proposal-bind="reference" value="${project.proposal.reference || ''}"></div>
        <div class="ev-field"><label>Honoraires HT</label><input class="ev-input" type="number" data-proposal-bind="feeHt" value="${project.proposal.feeHt || 0}"></div>
        <div class="ev-field"><label>Délai mission</label><input class="ev-input" data-proposal-bind="delay" value="${project.proposal.delay || 'À confirmer'}"></div>
      </div>
      <div class="ev-btn-row">
        <button class="ev-btn ev-btn--dark" data-download-proposal type="button">Générer la proposition commerciale</button>
      </div>
    </div>
  </div>`;
}

export function createWizard({ steps, rootEl, stepsNavEl, titleEl, subtitleEl, remainEl, progressFillEl, getProject, setProject, onCompute, onDownloadPdf, onDownloadProposal, onSendLead, onReset }){
  let currentStep = 0;

  function getActiveSite(project){
    return project.sites.find(s => s.id === project.activeSiteId) || project.sites[0];
  }
  function patchProject(path, value){
    const next = clone(getProject());
    setByPath(next, path, value);
    next.meta.updatedAt = new Date().toISOString();
    setProject(next);
  }
  function patchActiveSite(path, value){
    const next = clone(getProject());
    const active = getActiveSite(next);
    setByPath(active, path, value);
    next.meta.updatedAt = new Date().toISOString();
    setProject(next);
  }

  function render(){
    const project = getProject();
    if(!project.activeSiteId) project.activeSiteId = project.sites[0]?.id;
    const audit = onCompute();
    const activeSite = getActiveSite(project);

    titleEl.textContent = `Étape ${currentStep + 1} sur ${steps.length} — ${steps[currentStep].title}`;
    subtitleEl.textContent = steps[currentStep].description;
    const remain = steps.length - currentStep - 1;
    remainEl.textContent = `${remain} étape${remain>1?'s':''} restante${remain>1?'s':''}`;
    progressFillEl.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    stepsNavEl.innerHTML = steps.map((step, i) => makeStepCard(step, i, i === currentStep)).join('');

    rootEl.innerHTML = `
      <div class="ev-grid g-sidebar">
        <aside>${portfolioSidebar(project, audit, activeSite.id)}</aside>
        <section>
          ${currentStep === 0 ? fieldsSite(activeSite) : ''}
          ${currentStep === 1 ? fieldsBacs(activeSite) : ''}
          ${currentStep === 2 ? renderResults(audit, project) : ''}
          ${currentStep === 3 ? renderLead(project) : ''}
          <div class="ev-btn-row" style="margin-top:14px">
            ${currentStep > 0 ? '<button class="ev-btn ev-btn--ghost" data-prev type="button">← Retour</button>' : ''}
            ${currentStep < steps.length - 1 ? '<button class="ev-btn ev-btn--dark" data-next type="button">Étape suivante →</button>' : ''}
            <button class="ev-btn ev-btn--ghost" data-reset type="button">Réinitialiser</button>
          </div>
        </section>
      </div>`;

    bind(rootEl, project, audit);
  }

  function bind(scope, project, audit){
    scope.querySelectorAll('[data-go-step]').forEach(btn => btn.addEventListener('click', () => {
      currentStep = Number(btn.dataset.goStep);
      render();
    }));
    scope.querySelector('[data-prev]')?.addEventListener('click', () => { currentStep -= 1; render(); });
    scope.querySelector('[data-next]')?.addEventListener('click', () => {
      if(currentStep <= 1){
        const err = validateSite(getActiveSite(getProject()));
        if(currentStep === 0 && Object.keys(err).length){ alert(Object.values(err)[0]); return; }
      }
      currentStep += 1; render();
    });
    scope.querySelector('[data-reset]')?.addEventListener('click', () => { onReset(); currentStep = 0; render(); });
    scope.querySelector('[data-add-site]')?.addEventListener('click', () => {
      const next = clone(getProject());
      next.sites.push(createEmptySite(next.sites.length + 1));
      next.activeSiteId = next.sites.at(-1).id;
      setProject(next);
      render();
    });
    scope.querySelectorAll('[data-select-site]').forEach(btn => btn.addEventListener('click', () => {
      patchProject('activeSiteId', btn.dataset.selectSite);
      render();
    }));
    scope.querySelectorAll('[data-site-bind]').forEach(input => {
      input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
        let value = input.type === 'checkbox' ? input.checked : input.value;
        if(['surface','zones','baseKwh','powerKw','ceePrice'].some(k => input.dataset.siteBind.endsWith(k))) value = num(value);
        if(input.dataset.siteBind === 'priceKwh') value = num(value);
        patchActiveSite(input.dataset.siteBind, value);
        render();
      });
    });
    scope.querySelectorAll('[data-contact-bind]').forEach(input => {
      input.addEventListener('input', () => patchProject(`contact.${input.dataset.contactBind}`, input.value));
    });
    scope.querySelectorAll('[data-proposal-bind]').forEach(input => {
      input.addEventListener('input', () => patchProject(`proposal.${input.dataset.proposalBind}`, input.type === 'number' ? num(input.value) || 0 : input.value));
    });
    scope.querySelector('[data-download-pdf]')?.addEventListener('click', async () => {
      const contact = { ...getProject().contact, consent: !!scope.querySelector('[data-contact-consent]')?.checked };
      const errors = validateLead(contact);
      if(Object.keys(errors).length){ alert(Object.values(errors)[0]); return; }
      await onDownloadPdf(audit);
    });
    scope.querySelector('[data-download-proposal]')?.addEventListener('click', async () => {
      const contact = { ...getProject().contact, consent: true };
      if(!contact.company) alert('Renseigne au moins la société pour la proposition.');
      await onDownloadProposal(audit);
    });
    scope.querySelector('[data-send-lead]')?.addEventListener('click', async () => {
      const contact = { ...getProject().contact, consent: !!scope.querySelector('[data-contact-consent]')?.checked };
      const errors = validateLead(contact);
      if(Object.keys(errors).length){ alert(Object.values(errors)[0]); return; }
      await onSendLead(audit);
      alert('Demande envoyée.');
    });
  }

  return { init: render };
}
