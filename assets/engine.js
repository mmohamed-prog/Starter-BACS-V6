import { computePriorityScore, classifyPoste, computeLeadScore, clamp, round } from './scoring.js';
import {
  USAGE_RULES,
  SEGMENT_FACTORS,
  GTB_FACTORS,
  DATA_QUALITY,
  PROJECT_INTENT,
  SIZE_BUCKETS,
  AIDE_LIMITS,
  CATALOG_CATEGORY_FACTORS,
  BACS_FRAME
} from './business-rules.js';

function getUsageRule(usage) {
  return USAGE_RULES[usage] || USAGE_RULES.autre;
}

function getSegmentRule(segment) {
  return SEGMENT_FACTORS[segment] || SEGMENT_FACTORS.tertiaire;
}

function getSizeRule(surface) {
  return SIZE_BUCKETS.find(bucket => surface <= bucket.max) || SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
}

function getMaturityLabel(gtb) {
  if (gtb === 'complete') return 'mature';
  if (gtb === 'partielle') return 'intermediaire';
  return 'faible';
}

function inferBacsStage(site) {
  if (site.gtb === 'complete') return 'socle déjà avancé';
  if (site.gtb === 'partielle') return 'socle partiellement couvert';
  return 'socle à structurer';
}

function buildWarnings(site, metrics) {
  const warnings = [];
  warnings.push(`L’assujettissement exact au ${BACS_FRAME.decreeLabel} doit être confirmé avec les systèmes concernés et la puissance nominale utile ; ce pré-diagnostic n’intègre pas ce contrôle juridique complet.`);
  if (!Number.isFinite(metrics.intensity) || metrics.intensity <= 0) warnings.push('Consommation spécifique non exploitable avec les données saisies.');
  if (metrics.intensityRatio < 0.65) warnings.push('La consommation actuelle paraît basse au regard du benchmark : vérifier les données de référence.');
  if (metrics.intensityRatio > 1.45) warnings.push('Le site est nettement au-dessus du benchmark : valider l’historique, les horaires et les usages particuliers.');
  if (site.dataQuality === 'faible') warnings.push('La qualité de données est faible : les ratios et le ROI doivent être confirmés avant arbitrage.');
  if (site.target >= site.act) warnings.push('La cible est supérieure ou égale à l’existant : le potentiel d’économie sera mécaniquement limité.');
  if (site.surface < 500) warnings.push('Petit site : attention aux effets de seuil sur les coûts unitaires et le ROI.');
  return warnings;
}

export function computeSite(site, catalog) {
  const surface = Math.max(1, Number(site.surface) || 0);
  const act = Math.max(0, Number(site.act) || 0);
  const target = Math.max(0, Number(site.target) || 0);
  const price = Math.max(0, Number(site.price) || 0);
  const co2 = Math.max(0, Number(site.co2) || 0);
  const aidesPct = clamp(Number(site.aidesPct) || 0, AIDE_LIMITS.min, AIDE_LIMITS.max);
  const usageRule = getUsageRule(site.usage);
  const segmentRule = getSegmentRule(site.segment);
  const gtbRule = GTB_FACTORS[site.gtb] || GTB_FACTORS.non;
  const qualityRule = DATA_QUALITY[site.dataQuality] || DATA_QUALITY.moyenne;
  const intentRule = PROJECT_INTENT[site.projectIntent] || PROJECT_INTENT.aucune;
  const sizeRule = getSizeRule(surface);

  const gap = Math.max(0, act - target);
  const gapPct = act > 0 ? (gap / act) * 100 : 0;
  const intensity = surface > 0 ? act / surface : 0;
  const benchmark = usageRule.benchmark;
  const intensityRatio = benchmark > 0 ? intensity / benchmark : 1;
  const maturityLabel = getMaturityLabel(site.gtb);
  const bacsStage = inferBacsStage(site);

  let residual = act;
  const selectedMeasures = [];
  const selectedIds = [];
  const categoryCount = {};

  const eligible = (catalog || []).filter(item => item.selected);
  const effectiveCatalog = eligible.length ? eligible : (catalog || []).slice(0, 4).map(item => ({ ...item, selected: true }));

  const rankedCatalog = effectiveCatalog
    .map(item => {
      const categoryRule = CATALOG_CATEGORY_FACTORS[item.category] || { synergy: 1, repeatPenalty: 1 };
      const adjustedCapexM2 = item.capexM2 * usageRule.capexFactor * sizeRule.capex * gtbRule.capex * qualityRule.capex * intentRule.capex;
      const maturityFit = (site.gtb === 'non' && (item.category === 'pilotage' || item.category === 'instrumentation' || item.regulatory)) || (site.gtb === 'partielle' && item.category !== 'commissionnement');
      const theoreticalSavingsEur = act * item.gain * gtbRule.savings * qualityRule.savings * price;
      const estimatedPayback = theoreticalSavingsEur > 0 ? (adjustedCapexM2 * surface * (1 - aidesPct / 100)) / theoreticalSavingsEur : Infinity;
      const score = computePriorityScore({
        ...item,
        payback: estimatedPayback,
        gainPct: item.gain * 100,
        capexM2: adjustedCapexM2,
        dependsSatisfied: !item.dependencies?.length,
        maturityFit
      });
      return { ...item, adjustedCapexM2, score, maturityFit, categoryRule };
    })
    .sort((a, b) => b.score - a.score);

  rankedCatalog.forEach(item => {
    const depsOk = !item.dependencies?.length || item.dependencies.every(dep => selectedIds.includes(dep));
    if (!depsOk) return;

    const repeats = categoryCount[item.category] || 0;
    const diminishing = repeats > 0 ? Math.max(0.62, item.categoryRule.repeatPenalty ** repeats) : 1;
    const maturityBoost = item.maturityFit ? 1.06 : 0.96;
    const intensityBoost = intensityRatio > 1.2 ? 1.08 : intensityRatio < 0.85 ? 0.9 : 1.0;
    const gainFactor = item.categoryRule.synergy * diminishing * gtbRule.savings * qualityRule.savings * maturityBoost * intensityBoost;

    const gainKwh = Math.max(0, residual * item.gain * gainFactor);
    const savingsEur = gainKwh * price;
    const grossCapex = item.adjustedCapexM2 * surface;
    const aidFactor = item.regulatory ? 1.06 : 1.0;
    const netCapex = grossCapex * (1 - (aidesPct * aidFactor) / 100);
    const payback = savingsEur > 0 ? netCapex / savingsEur : Infinity;
    const finalScore = computePriorityScore({
      ...item,
      payback,
      gainPct: (gainKwh / Math.max(act, 1)) * 100,
      capexM2: item.adjustedCapexM2,
      dependsSatisfied: depsOk,
      maturityFit: item.maturityFit
    });

    const action = {
      id: item.id,
      label: item.label,
      category: classifyPoste(finalScore),
      score: finalScore,
      complexity: item.complexity,
      regulatory: item.regulatory,
      priority: item.priority,
      gainPct: round((gainKwh / Math.max(act, 1)) * 100, 1),
      gainKwh,
      savingsEur,
      capexGross: grossCapex,
      capexNet: Math.max(0, netCapex),
      capexM2: round(item.adjustedCapexM2, 1),
      payback: Number.isFinite(payback) ? payback : null,
      leverage: item.category,
      rationale: item.regulatory ? 'levier de pilotage / conformité BACS' : 'levier d’exploitation et de réglage'
    };

    selectedMeasures.push(action);
    selectedIds.push(item.id);
    categoryCount[item.category] = repeats + 1;
    residual = Math.max(0, residual - gainKwh);
  });

  const totalSavings = selectedMeasures.reduce((sum, m) => sum + m.savingsEur, 0);
  const totalCapexNet = selectedMeasures.reduce((sum, m) => sum + m.capexNet, 0);
  const totalCo2 = selectedMeasures.reduce((sum, m) => sum + (m.gainKwh * co2), 0);
  const roi = totalSavings > 0 ? totalCapexNet / totalSavings : null;
  const progressPct = gap > 0 ? clamp(((act - residual) / gap) * 100, 0, 100) : 100;
  const leadScore = clamp(computeLeadScore({ ...site, gapPct }) + segmentRule.urgencyBonus + intentRule.urgency + gtbRule.maturityPenalty * 0.35);
  const reliabilityScore = clamp(Math.round(qualityRule.reliability + sizeRule.reliability + (act > 0 ? 4 : -8) + (target > 0 ? 3 : -6) - (Math.abs(intensityRatio - 1) > 0.65 ? 6 : 0)));
  const annualSavingsRate = act > 0 ? (totalSavings / (act * price)) * 100 : 0;
  const warnings = buildWarnings(site, { intensity, intensityRatio });
  const nextStep = leadScore >= 80
    ? 'Valider la feuille de route BACS la plus pertinente pour ce site lors d’un échange de cadrage.'
    : leadScore >= 55
      ? 'Relire les hypothèses, confirmer les points sensibles et hiérarchiser les actions à engager.'
      : 'Compléter les données et affiner le périmètre BACS avant arbitrage.';

  return {
    ...site,
    aidesPct,
    gap,
    gapPct: round(gapPct, 1),
    optimizedConsumption: residual,
    investNet: totalCapexNet,
    savingsEur: totalSavings,
    co2Saved: totalCo2,
    roi,
    progressPct,
    leadScore: Math.round(leadScore),
    measures: selectedMeasures,
    topActions: selectedMeasures.slice().sort((a, b) => b.score - a.score).slice(0, 3),
    benchmarkIntensity: benchmark,
    actualIntensity: round(intensity, 1),
    intensityRatio: round(intensityRatio, 2),
    annualSavingsRate: round(annualSavingsRate, 1),
    reliabilityScore,
    warnings,
    maturityLabel,
    bacsStage,
    bacsDisclaimer: `Ce résultat aide à prioriser dans le cadre du ${BACS_FRAME.decreeLabel}, sans se substituer à une vérification d’assujettissement et de conformité.`,
    nextStep,
    capexPerM2: surface > 0 ? round(totalCapexNet / surface, 1) : 0,
    selectedMeasuresCount: selectedMeasures.length
  };
}

export function buildSalesReadout(siteResult) {
  const lines = [];
  if (!siteResult) return lines;

  if ((siteResult.roi ?? Infinity) <= 4) lines.push('La trajectoire apparaît favorable à un cadrage rapide : les premiers leviers semblent activables avec un temps de retour court.');
  else if ((siteResult.roi ?? Infinity) <= 7) lines.push('La trajectoire semble économiquement défendable, sous réserve de confirmer les hypothèses techniques.');
  else lines.push('La trajectoire paraît plus structurante : le phasage et les contraintes d’exploitation devront être clarifiés.');

  if (siteResult.leadScore >= 80) lines.push('Priorité d’intervention élevée : taille, potentiel et urgence justifient un cadrage rapide.');
  else if (siteResult.leadScore >= 55) lines.push('Priorité d’intervention réelle : une revue de cadrage permettrait de confirmer les premiers arbitrages.');
  else lines.push('Priorité à confirmer : des informations complémentaires sont utiles avant arbitrage.');

  if (siteResult.reliabilityScore < 65) lines.push('Point d’attention : fiabilité des données moyenne à faible, à valider avant engagement.');
  else lines.push('Les données saisies permettent une première lecture relativement exploitable.');

  lines.push(siteResult.bacsDisclaimer);
  if ((siteResult.topActions || []).some(action => action.category === 'quick_win')) lines.push('Des quick wins de pilotage existent pour enclencher une première phase avec friction limitée.');
  if ((siteResult.topActions || []).some(action => action.regulatory)) lines.push('Au moins un levier combine intérêt économique et portée Décret BACS.');
  return lines;
}
