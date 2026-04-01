const TARIFFS = {
  "Bureaux tertiaires":{C:50,B:80,A:105},
  "Établissement d’enseignement":{C:55,B:85,A:110},
  "Bâtiment industriel":{C:60,B:90,A:115},
  "Établissement de santé":{C:70,B:100,A:125},
  "Datacenter":{C:90,B:120,A:150},
  "Bâtiment public":{C:52,B:82,A:108},
  "Commerces":{C:58,B:88,A:112},
  "Hôtellerie":{C:65,B:95,A:120},
  "Restauration":{C:62,B:92,A:118}
};
const CLASS_SAVINGS = {C:0.08,B:0.16,A:0.22};
const OPTS = {interop:0.05,hourly:0.08,logging:0.04,manual:0.06,superv_partielle:0.05,superv_oui:0.10};
const PROJECT_MULT = {"Neuf":1.00,"Rénovation":1.12,"Remplacement":1.07};
const CEE_TABLE = {
  "Bureaux tertiaires":{H1:{B:240,A:360},H2:{B:97,A:233},H3:{B:60,A:150}},
  "Établissement d’enseignement":{H1:{B:100,A:170},H2:{B:23,A:60},H3:{B:20,A:50}},
  "Bâtiment industriel":{H1:{B:80,A:140},H2:{B:20,A:50},H3:{B:15,A:35}},
  "Établissement de santé":{H1:{B:90,A:150},H2:{B:23,A:60},H3:{B:19,A:40}},
  "Datacenter":{H1:{B:0,A:0},H2:{B:0,A:0},H3:{B:0,A:0}},
  "Bâtiment public":{H1:{B:240,A:360},H2:{B:97,A:233},H3:{B:60,A:150}},
  "Commerces":{H1:{B:250,A:520},H2:{B:44,A:150},H3:{B:30,A:90}},
  "Hôtellerie":{H1:{B:200,A:400},H2:{B:23,A:60},H3:{B:20,A:50}},
  "Restauration":{H1:{B:200,A:400},H2:{B:23,A:60},H3:{B:20,A:50}}
};
function clamp(x,min=0,max=100){ return Math.max(min, Math.min(max, x)); }
function usagesCount(site){ return 1 + (site.usages.ecs?1:0) + (site.usages.cool?1:0) + (site.usages.light?1:0) + (site.usages.aux?1:0); }
function evaluateAssujettissement(systems, powerKw){
  const threshold = (new Date() >= new Date('2027-01-01T00:00:00')) ? 70 : 290;
  const major = systems.heat || systems.cool || systems.vent;
  const ecsOK = systems.ecs && (systems.heat || systems.vent || systems.cool);
  const otherOK = systems.other;
  const onlyLight = systems.light && !major && !ecsOK && !otherOK;
  const relevant = major || ecsOK || otherOK;
  if(!relevant) return { isAssujetti:false, threshold, reason: onlyLight ? 'Éclairage seul' : 'Aucun système pertinent' };
  if(powerKw < threshold) return { isAssujetti:false, threshold, reason:`Puissance < ${threshold} kW` };
  return { isAssujetti:true, threshold, reason:'Systèmes concernés + puissance suffisante' };
}
function scoreExploitation(site){
  let score = 100;
  if(site.systems.heat && site.systems.cool) score -= 20;
  if(site.targetClass === 'C') score -= 10;
  if(site.powerKw > 800) score -= 8;
  return clamp(Math.round(score));
}
function scoreEnergy(site){
  const refs = {'Bureaux tertiaires':250,'Établissement d’enseignement':180,'Bâtiment industriel':220,'Établissement de santé':380,'Datacenter':900,'Bâtiment public':230,'Commerces':300,'Hôtellerie':320,'Restauration':360};
  const actual = site.surface > 0 ? site.baseKwh / site.surface : 999;
  const reference = refs[site.type] || 250;
  const ratio = actual / reference;
  if(ratio <= 0.80) return 90;
  if(ratio <= 1.00) return 75;
  if(ratio <= 1.20) return 55;
  if(ratio <= 1.50) return 35;
  return 20;
}
function scoreBacs(site){
  let score = 0;
  if(site.existing.interop) score += 25;
  if(site.existing.hourly) score += 25;
  if(site.existing.logging) score += 25;
  if(site.existing.manual) score += 25;
  return clamp(score);
}
function scorePriority(exploitation, energy, bacs, isBacsRequired){
  let priority = 0;
  priority += (100 - exploitation) * 0.35;
  priority += (100 - energy) * 0.30;
  priority += (100 - bacs) * 0.25;
  if(isBacsRequired) priority += 10;
  return clamp(Math.round(priority));
}
export function computeSite(site, sitesCount = 1){
  const tariffs = TARIFFS[site.type] || TARIFFS['Bureaux tertiaires'];
  const projMult = PROJECT_MULT[site.project] || 1;
  const targetRate = tariffs[site.targetClass] || tariffs.B;
  const baseRate = tariffs.C || 50;

  const existingScore = (site.existing.interop ? 3 : 0) + (site.existing.hourly ? 3 : 0) + (site.existing.logging ? 2 : 0) + (site.existing.manual ? 2 : 0);
  const baseOk = site.existing.interop && site.existing.hourly && site.existing.logging && site.existing.manual;
  const missing = {
    interop: !site.existing.interop,
    hourly: !site.existing.hourly,
    logging: !site.existing.logging,
    manual: !site.existing.manual
  };

  let multMissing = 1;
  if(missing.interop) multMissing *= 1 + OPTS.interop;
  if(missing.hourly) multMissing *= 1 + OPTS.hourly;
  if(missing.logging) multMissing *= 1 + OPTS.logging;
  if(missing.manual) multMissing *= 1 + OPTS.manual;

  let multPerf = 1;
  if(site.supervision === 'partielle') multPerf *= 1 + OPTS.superv_partielle;
  if(site.supervision === 'oui') multPerf *= 1 + OPTS.superv_oui;

  const htConfDelta = (multMissing - 1) * (site.surface * baseRate * projMult);
  const confTtc = Math.max(0, htConfDelta) * 1.20;
  const packHt = (site.surface * targetRate * projMult) * multPerf;
  const packTtc = packHt * 1.20;
  const packMaint = packHt * 0.02;
  const annualSavings = site.baseKwh * (CLASS_SAVINGS[site.targetClass] || 0.12) * site.priceKwh;
  const payback = annualSavings > 0 ? packTtc / annualSavings : NaN;

  let ceeCoef = 0;
  if(CEE_TABLE[site.type] && CEE_TABLE[site.type][site.zone]){
    const t = CEE_TABLE[site.type][site.zone];
    ceeCoef = site.targetClass === 'A' ? (t.A || 0) : (site.targetClass === 'B' ? (t.B || 0) : 0);
  }
  const uses = usagesCount(site);
  const mwhc = Math.max(0, (site.surface * ceeCoef * (uses/5)) / 1000);
  const aidHt = mwhc * site.ceePrice;
  const packNetTtc = Math.max(0, packHt - aidHt) * 1.20;
  const assuj = evaluateAssujettissement(site.systems, site.powerKw);

  const exploitation = scoreExploitation(site);
  const energy = scoreEnergy(site);
  const bacs = scoreBacs(site);
  const priorityIndex = scorePriority(exploitation, energy, bacs, assuj.isAssujetti);
  const impactScore = clamp(Math.round(((100-energy)*0.6)+((100-exploitation)*0.4)));
  const effortScore = clamp(Math.round(((100-bacs)*0.5)+(Math.min(100,20+Object.values(site.systems).filter(Boolean).length*10)*0.3)+(Math.min(100,(sitesCount-1)*10)*0.2)));
  const urgencyScore = assuj.isAssujetti ? (baseOk ? 45 : 92) : 35;

  return {
    existingScore, baseOk, missing, confTtc, packTtc, packMaint, annualSavings, payback,
    aidHt, packNetTtc, mwhc, assuj, exploitation, energy, bacs,
    globalScore: Math.round((exploitation*0.25)+(energy*0.25)+(bacs*0.20)+((100-priorityIndex)*0.30)),
    priorityIndex,
    priorityBand: priorityIndex >= 80 ? 'critique' : priorityIndex >= 55 ? 'élevée' : 'standard',
    impactScore, effortScore, urgencyScore,
    effortLevel: effortScore >= 75 ? 'élevé' : effortScore >= 45 ? 'modéré' : 'faible'
  };
}
export function runBacsAudit(project){
  const computed = project.sites.map(site => ({ ...site, result: computeSite(site, project.sites.length) }));
  const ranked = [...computed].sort((a,b) => b.result.priorityIndex - a.result.priorityIndex);
  const totals = ranked.reduce((acc, site) => {
    acc.sites += 1;
    if(site.result.assuj.isAssujetti) acc.assuj += 1;
    acc.capex += site.result.packTtc;
    acc.savings += site.result.annualSavings;
    acc.score += site.result.globalScore;
    acc.priority += site.result.priorityIndex;
    acc.power += site.powerKw || 0;
    if(Number.isFinite(site.result.payback)){ acc.roi += site.result.payback; acc.roiCount += 1; }
    return acc;
  }, {sites:0,assuj:0,capex:0,savings:0,score:0,priority:0,power:0,roi:0,roiCount:0});
  return {
    sites: computed,
    ranked,
    totals: {
      ...totals,
      avgScore: totals.sites ? Math.round(totals.score / totals.sites) : 0,
      avgPriority: totals.sites ? Math.round(totals.priority / totals.sites) : 0,
      avgRoi: totals.roiCount ? totals.roi / totals.roiCount : NaN
    }
  };
}
