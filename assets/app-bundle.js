(() => {
  // assets/catalog.js
  var MEASURES_CATALOG = [
    { id: "gtb_socle", label: "GTB / BACS socle", gain: 0.11, capexM2: 16, complexity: "medium", regulatory: true, priority: "quick-win", category: "pilotage", active: true },
    { id: "sous_comptage", label: "Sous-comptage et remont\xE9es horaires", gain: 0.04, capexM2: 7, complexity: "low", regulatory: true, priority: "quick-win", category: "instrumentation", active: true },
    { id: "programmation", label: "Calendriers, consignes et arr\xEAt / relance", gain: 0.05, capexM2: 3, complexity: "low", regulatory: true, priority: "quick-win", category: "pilotage", dependencies: ["gtb_socle"], active: true },
    { id: "supervision", label: "Supervision centralis\xE9e", gain: 0.06, capexM2: 9, complexity: "medium", regulatory: true, priority: "quick-win", category: "supervision", dependencies: ["gtb_socle"], active: true },
    { id: "interoperabilite", label: "Interop\xE9rabilit\xE9 et nomenclature des points", gain: 0.03, capexM2: 5, complexity: "medium", regulatory: true, priority: "quick-win", category: "pilotage", active: true },
    { id: "alarmes", label: "Alarmes, d\xE9rives et suivi des d\xE9fauts", gain: 0.04, capexM2: 4, complexity: "low", regulatory: true, priority: "quick-win", category: "supervision", dependencies: ["supervision"], active: true },
    { id: "zonage_sondes", label: "Zonage, sondes et remont\xE9es d\u2019ambiance", gain: 0.05, capexM2: 11, complexity: "medium", regulatory: false, priority: "structurant", category: "cvc", active: true },
    { id: "optim_cvc", label: "Optimisation des s\xE9quences CVC", gain: 0.08, capexM2: 14, complexity: "medium", regulatory: true, priority: "quick-win", category: "cvc", dependencies: ["gtb_socle"], active: true },
    { id: "commissionnement", label: "Commissionnement et re-r\xE9glages", gain: 0.06, capexM2: 6, complexity: "medium", regulatory: false, priority: "structurant", category: "commissionnement", dependencies: ["gtb_socle"], active: true }
  ];
  function cloneCatalog() {
    return MEASURES_CATALOG.map((item) => ({ ...item, selected: false }));
  }

  // assets/scoring.js
  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }
  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }
  function computePriorityScore(poste) {
    let score = 0;
    if (Number.isFinite(poste.payback)) {
      if (poste.payback <= 3) score += 30;
      else if (poste.payback <= 5) score += 24;
      else if (poste.payback <= 8) score += 17;
      else if (poste.payback <= 12) score += 10;
      else score += 4;
    }
    if (poste.gainPct >= 18) score += 24;
    else if (poste.gainPct >= 12) score += 18;
    else if (poste.gainPct >= 7) score += 10;
    else score += 4;
    if (poste.capexM2 <= 15) score += 18;
    else if (poste.capexM2 <= 50) score += 12;
    else if (poste.capexM2 <= 100) score += 7;
    if (poste.complexity === "low") score += 14;
    else if (poste.complexity === "medium") score += 8;
    else score += 3;
    if (poste.regulatory) score += 12;
    if (poste.priority === "quick-win") score += 10;
    if (poste.dependsSatisfied) score += 4;
    if (poste.maturityFit) score += 5;
    return clamp(Math.round(score));
  }
  function classifyPoste(score) {
    if (score >= 78) return "quick_win";
    if (score >= 55) return "prioritaire";
    return "structurant";
  }
  function computeLeadScore(site) {
    let score = 0;
    const gapPct = Number(site.gapPct) || 0;
    if (gapPct >= 30) score += 24;
    else if (gapPct >= 18) score += 16;
    else if (gapPct >= 8) score += 9;
    else score += 4;
    if (site.surface >= 1e4) score += 18;
    else if (site.surface >= 5e3) score += 14;
    else if (site.surface >= 1500) score += 9;
    else score += 5;
    if (site.gtb === "non") score += 14;
    else if (site.gtb === "partielle") score += 7;
    if (site.projectIntent === "travaux_12m") score += 12;
    else if (site.projectIntent === "travaux_24m") score += 8;
    else if (site.projectIntent === "audit") score += 5;
    if (site.segment === "public") score += 8;
    if (site.dataQuality === "bonne") score += 5;
    if (site.dataQuality === "faible") score -= 2;
    return clamp(Math.round(score));
  }

  // assets/business-rules.js
  var USAGE_RULES = {
    bureaux: { benchmark: 185, capexFactor: 1, complexity: 1 },
    enseignement: { benchmark: 150, capexFactor: 0.96, complexity: 0.95 },
    sante: { benchmark: 310, capexFactor: 1.18, complexity: 1.16 },
    commerce: { benchmark: 260, capexFactor: 1.08, complexity: 1.05 },
    hotel: { benchmark: 280, capexFactor: 1.1, complexity: 1.08 },
    mixte: { benchmark: 230, capexFactor: 1.04, complexity: 1.05 },
    autre: { benchmark: 210, capexFactor: 1, complexity: 1 }
  };
  var SEGMENT_FACTORS = {
    tertiaire: { urgencyBonus: 8 },
    public: { urgencyBonus: 10 },
    industrie: { urgencyBonus: 5 }
  };
  var GTB_FACTORS = {
    non: { savings: 1.12, maturityPenalty: 16, capex: 1.08 },
    partielle: { savings: 1, maturityPenalty: 7, capex: 1 },
    complete: { savings: 0.92, maturityPenalty: 0, capex: 0.93 }
  };
  var DATA_QUALITY = {
    faible: { reliability: 52, savings: 0.94, capex: 1.05 },
    moyenne: { reliability: 72, savings: 1, capex: 1 },
    bonne: { reliability: 88, savings: 1.03, capex: 0.98 }
  };
  var PROJECT_INTENT = {
    aucune: { urgency: 0, capex: 1 },
    audit: { urgency: 7, capex: 0.98 },
    travaux_24m: { urgency: 11, capex: 1 },
    travaux_12m: { urgency: 16, capex: 1.03 }
  };
  var SIZE_BUCKETS = [
    { max: 1500, capex: 1.08, reliability: 0 },
    { max: 5e3, capex: 1, reliability: 3 },
    { max: 12e3, capex: 0.95, reliability: 5 },
    { max: Infinity, capex: 0.91, reliability: 7 }
  ];
  var AIDE_LIMITS = { min: 0, max: 60 };
  var CATALOG_CATEGORY_FACTORS = {
    pilotage: { synergy: 1, repeatPenalty: 0.88 },
    instrumentation: { synergy: 0.98, repeatPenalty: 0.9 },
    supervision: { synergy: 1.02, repeatPenalty: 0.9 },
    cvc: { synergy: 1.05, repeatPenalty: 0.9 },
    commissionnement: { synergy: 1.03, repeatPenalty: 0.92 }
  };
  var BACS_FRAME = {
    decreeLabel: "D\xE9cret BACS",
    thresholdKwPrimary: 70,
    thresholdKwLegacy: 290,
    targetDate70Kw: "2027-01-01",
    targetDate290Kw: "2025-01-01"
  };

  // assets/engine.js
  function getUsageRule(usage) {
    return USAGE_RULES[usage] || USAGE_RULES.autre;
  }
  function getSegmentRule(segment) {
    return SEGMENT_FACTORS[segment] || SEGMENT_FACTORS.tertiaire;
  }
  function getSizeRule(surface) {
    return SIZE_BUCKETS.find((bucket) => surface <= bucket.max) || SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
  }
  function getMaturityLabel(gtb) {
    if (gtb === "complete") return "mature";
    if (gtb === "partielle") return "intermediaire";
    return "faible";
  }
  function inferBacsStage(site) {
    if (site.gtb === "complete") return "socle d\xE9j\xE0 avanc\xE9";
    if (site.gtb === "partielle") return "socle partiellement couvert";
    return "socle \xE0 structurer";
  }
  function buildWarnings(site, metrics) {
    const warnings = [];
    warnings.push(`L\u2019assujettissement exact au ${BACS_FRAME.decreeLabel} doit \xEAtre confirm\xE9 avec les syst\xE8mes concern\xE9s et la puissance nominale utile ; ce pr\xE9-diagnostic n\u2019int\xE8gre pas ce contr\xF4le juridique complet.`);
    if (!Number.isFinite(metrics.intensity) || metrics.intensity <= 0) warnings.push("Consommation sp\xE9cifique non exploitable avec les donn\xE9es saisies.");
    if (metrics.intensityRatio < 0.65) warnings.push("La consommation actuelle para\xEEt basse au regard du benchmark : v\xE9rifier les donn\xE9es de r\xE9f\xE9rence.");
    if (metrics.intensityRatio > 1.45) warnings.push("Le site est nettement au-dessus du benchmark : valider l\u2019historique, les horaires et les usages particuliers.");
    if (site.dataQuality === "faible") warnings.push("La qualit\xE9 de donn\xE9es est faible : les ratios et le ROI doivent \xEAtre confirm\xE9s avant arbitrage.");
    if (site.target >= site.act) warnings.push("La cible est sup\xE9rieure ou \xE9gale \xE0 l\u2019existant : le potentiel d\u2019\xE9conomie sera m\xE9caniquement limit\xE9.");
    if (site.surface < 500) warnings.push("Petit site : attention aux effets de seuil sur les co\xFBts unitaires et le ROI.");
    return warnings;
  }
  function computeSite(site, catalog) {
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
    const gapPct = act > 0 ? gap / act * 100 : 0;
    const intensity = surface > 0 ? act / surface : 0;
    const benchmark = usageRule.benchmark;
    const intensityRatio = benchmark > 0 ? intensity / benchmark : 1;
    const maturityLabel = getMaturityLabel(site.gtb);
    const bacsStage = inferBacsStage(site);
    let residual = act;
    const selectedMeasures = [];
    const selectedIds = [];
    const categoryCount = {};
    const eligible = (catalog || []).filter((item) => item.selected);
    const effectiveCatalog = eligible.length ? eligible : (catalog || []).slice(0, 4).map((item) => ({ ...item, selected: true }));
    const rankedCatalog = effectiveCatalog.map((item) => {
      const categoryRule = CATALOG_CATEGORY_FACTORS[item.category] || { synergy: 1, repeatPenalty: 1 };
      const adjustedCapexM2 = item.capexM2 * usageRule.capexFactor * sizeRule.capex * gtbRule.capex * qualityRule.capex * intentRule.capex;
      const maturityFit = site.gtb === "non" && (item.category === "pilotage" || item.category === "instrumentation" || item.regulatory) || site.gtb === "partielle" && item.category !== "commissionnement";
      const theoreticalSavingsEur = act * item.gain * gtbRule.savings * qualityRule.savings * price;
      const estimatedPayback = theoreticalSavingsEur > 0 ? adjustedCapexM2 * surface * (1 - aidesPct / 100) / theoreticalSavingsEur : Infinity;
      const score = computePriorityScore({
        ...item,
        payback: estimatedPayback,
        gainPct: item.gain * 100,
        capexM2: adjustedCapexM2,
        dependsSatisfied: !item.dependencies?.length,
        maturityFit
      });
      return { ...item, adjustedCapexM2, score, maturityFit, categoryRule };
    }).sort((a, b) => b.score - a.score);
    rankedCatalog.forEach((item) => {
      const depsOk = !item.dependencies?.length || item.dependencies.every((dep) => selectedIds.includes(dep));
      if (!depsOk) return;
      const repeats = categoryCount[item.category] || 0;
      const diminishing = repeats > 0 ? Math.max(0.62, item.categoryRule.repeatPenalty ** repeats) : 1;
      const maturityBoost = item.maturityFit ? 1.06 : 0.96;
      const intensityBoost = intensityRatio > 1.2 ? 1.08 : intensityRatio < 0.85 ? 0.9 : 1;
      const gainFactor = item.categoryRule.synergy * diminishing * gtbRule.savings * qualityRule.savings * maturityBoost * intensityBoost;
      const gainKwh = Math.max(0, residual * item.gain * gainFactor);
      const savingsEur = gainKwh * price;
      const grossCapex = item.adjustedCapexM2 * surface;
      const aidFactor = item.regulatory ? 1.06 : 1;
      const netCapex = grossCapex * (1 - aidesPct * aidFactor / 100);
      const payback = savingsEur > 0 ? netCapex / savingsEur : Infinity;
      const finalScore = computePriorityScore({
        ...item,
        payback,
        gainPct: gainKwh / Math.max(act, 1) * 100,
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
        gainPct: round(gainKwh / Math.max(act, 1) * 100, 1),
        gainKwh,
        savingsEur,
        capexGross: grossCapex,
        capexNet: Math.max(0, netCapex),
        capexM2: round(item.adjustedCapexM2, 1),
        payback: Number.isFinite(payback) ? payback : null,
        leverage: item.category,
        rationale: item.regulatory ? "levier de pilotage / conformit\xE9 BACS" : "levier d\u2019exploitation et de r\xE9glage"
      };
      selectedMeasures.push(action);
      selectedIds.push(item.id);
      categoryCount[item.category] = repeats + 1;
      residual = Math.max(0, residual - gainKwh);
    });
    const totalSavings = selectedMeasures.reduce((sum, m) => sum + m.savingsEur, 0);
    const totalCapexNet = selectedMeasures.reduce((sum, m) => sum + m.capexNet, 0);
    const totalCo2 = selectedMeasures.reduce((sum, m) => sum + m.gainKwh * co2, 0);
    const roi2 = totalSavings > 0 ? totalCapexNet / totalSavings : null;
    const progressPct = gap > 0 ? clamp((act - residual) / gap * 100, 0, 100) : 100;
    const leadScore = clamp(computeLeadScore({ ...site, gapPct }) + segmentRule.urgencyBonus + intentRule.urgency + gtbRule.maturityPenalty * 0.35);
    const reliabilityScore = clamp(Math.round(qualityRule.reliability + sizeRule.reliability + (act > 0 ? 4 : -8) + (target > 0 ? 3 : -6) - (Math.abs(intensityRatio - 1) > 0.65 ? 6 : 0)));
    const annualSavingsRate = act > 0 ? totalSavings / (act * price) * 100 : 0;
    const warnings = buildWarnings(site, { intensity, intensityRatio });
    const nextStep = leadScore >= 80 ? "Valider la feuille de route BACS la plus pertinente pour ce site lors d\u2019un \xE9change de cadrage." : leadScore >= 55 ? "Relire les hypoth\xE8ses, confirmer les points sensibles et hi\xE9rarchiser les actions \xE0 engager." : "Compl\xE9ter les donn\xE9es et affiner le p\xE9rim\xE8tre BACS avant arbitrage.";
    return {
      ...site,
      aidesPct,
      gap,
      gapPct: round(gapPct, 1),
      optimizedConsumption: residual,
      investNet: totalCapexNet,
      savingsEur: totalSavings,
      co2Saved: totalCo2,
      roi: roi2,
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
      bacsDisclaimer: `Ce r\xE9sultat aide \xE0 prioriser dans le cadre du ${BACS_FRAME.decreeLabel}, sans se substituer \xE0 une v\xE9rification d\u2019assujettissement et de conformit\xE9.`,
      nextStep,
      capexPerM2: surface > 0 ? round(totalCapexNet / surface, 1) : 0,
      selectedMeasuresCount: selectedMeasures.length
    };
  }
  function buildSalesReadout(siteResult) {
    const lines = [];
    if (!siteResult) return lines;
    if ((siteResult.roi ?? Infinity) <= 4) lines.push("La trajectoire appara\xEEt favorable \xE0 un cadrage rapide : les premiers leviers semblent activables avec un temps de retour court.");
    else if ((siteResult.roi ?? Infinity) <= 7) lines.push("La trajectoire semble \xE9conomiquement d\xE9fendable, sous r\xE9serve de confirmer les hypoth\xE8ses techniques.");
    else lines.push("La trajectoire para\xEEt plus structurante : le phasage et les contraintes d\u2019exploitation devront \xEAtre clarifi\xE9s.");
    if (siteResult.leadScore >= 80) lines.push("Priorit\xE9 d\u2019intervention \xE9lev\xE9e : taille, potentiel et urgence justifient un cadrage rapide.");
    else if (siteResult.leadScore >= 55) lines.push("Priorit\xE9 d\u2019intervention r\xE9elle : une revue de cadrage permettrait de confirmer les premiers arbitrages.");
    else lines.push("Priorit\xE9 \xE0 confirmer : des informations compl\xE9mentaires sont utiles avant arbitrage.");
    if (siteResult.reliabilityScore < 65) lines.push("Point d\u2019attention : fiabilit\xE9 des donn\xE9es moyenne \xE0 faible, \xE0 valider avant engagement.");
    else lines.push("Les donn\xE9es saisies permettent une premi\xE8re lecture relativement exploitable.");
    lines.push(siteResult.bacsDisclaimer);
    if ((siteResult.topActions || []).some((action) => action.category === "quick_win")) lines.push("Des quick wins de pilotage existent pour enclencher une premi\xE8re phase avec friction limit\xE9e.");
    if ((siteResult.topActions || []).some((action) => action.regulatory)) lines.push("Au moins un levier combine int\xE9r\xEAt \xE9conomique et port\xE9e D\xE9cret BACS.");
    return lines;
  }

  // assets/multisite.js
  function computePortfolio(sites) {
    const validSites = (sites || []).filter((site) => site && Number.isFinite(site.surface) && site.surface > 0);
    const totalSurface = validSites.reduce((sum, site) => sum + site.surface, 0);
    const totalSavings = validSites.reduce((sum, site) => sum + (site.savingsEur || 0), 0);
    const totalCapex = validSites.reduce((sum, site) => sum + (site.investNet || 0), 0);
    const totalCo2 = validSites.reduce((sum, site) => sum + (site.co2Saved || 0), 0);
    const weightedGap = validSites.reduce((sum, site) => sum + (site.gapPct || 0) * site.surface, 0);
    const avgGap = totalSurface ? weightedGap / totalSurface : 0;
    const roi2 = totalSavings > 0 ? totalCapex / totalSavings : null;
    const avgLead = validSites.length ? validSites.reduce((sum, site) => sum + (site.leadScore || 0), 0) / validSites.length : 0;
    const avgReliability = validSites.length ? validSites.reduce((sum, site) => sum + (site.reliabilityScore || 0), 0) / validSites.length : 0;
    const avgSavingsRate = validSites.length ? validSites.reduce((sum, site) => sum + (site.annualSavingsRate || 0), 0) / validSites.length : 0;
    let status = "\xE0 construire";
    if (validSites.length) {
      if (avgLead >= 80 || avgGap >= 25) status = "prioritaire";
      else if (avgLead >= 55 || avgGap >= 12) status = "\xE0 traiter";
      else status = "\xE0 structurer";
    }
    const ranking = validSites.slice().sort((a, b) => (b.leadScore || 0) * 0.6 + (b.reliabilityScore || 0) * 0.1 + (b.annualSavingsRate || 0) * 0.3 - ((a.leadScore || 0) * 0.6 + (a.reliabilityScore || 0) * 0.1 + (a.annualSavingsRate || 0) * 0.3));
    return {
      siteCount: validSites.length,
      totalSurface,
      totalSavings,
      totalCapex,
      totalCo2,
      avgGap,
      avgLead,
      avgReliability,
      avgSavingsRate,
      roi: roi2,
      status,
      ranking
    };
  }
  function buildPortfolioReadout(portfolio) {
    if (!portfolio || !portfolio.siteCount) return ["Aucun site n\u2019a encore \xE9t\xE9 ajout\xE9 au portefeuille."];
    const lines = [];
    lines.push(`${portfolio.siteCount} site(s) analys\xE9(s) pour ${Math.round(portfolio.totalSurface).toLocaleString("fr-FR")} m\xB2.`);
    lines.push(portfolio.status === "prioritaire" ? "Le portefeuille appelle une priorisation rapide des premi\xE8res actions de pilotage et de mise en conformit\xE9." : portfolio.status === "\xE0 traiter" ? "Le portefeuille n\xE9cessite un cadrage des arbitrages BACS \xE0 court terme." : "Le portefeuille peut \xEAtre structur\xE9 par phases, avec une attention port\xE9e au bon phasage BACS.");
    if (portfolio.roi != null) lines.push(`ROI portefeuille estim\xE9 \xE0 ${portfolio.roi.toFixed(1).replace(".", ",")} ans.`);
    lines.push(`Niveau de fiabilit\xE9 moyen : ${Math.round(portfolio.avgReliability || 0)}/100.`);
    lines.push(`Taux moyen d\u2019\xE9conomie annuelle estim\xE9 : ${Math.round(portfolio.avgSavingsRate || 0)}%.`);
    lines.push("Cette synth\xE8se constitue une premi\xE8re lecture d\u2019opportunit\xE9 dans le cadre du D\xE9cret BACS, sans valider \xE0 elle seule l\u2019assujettissement r\xE9glementaire de chaque site.");
    return lines;
  }

  // assets/storage.js
  var STORAGE_KEY = "ecoverta_bacs_wizard_v1";
  function saveState(state2) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state2, savedAt: (/* @__PURE__ */ new Date()).toISOString() }));
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // assets/app-config.js
  var APP_CONFIG = {
    calendlyUrl: "https://calendly.com/ecoverta/30min",
    calendlyLabel: "Planifier un \xE9change de cadrage",
    calendlyHelper: "30 min pour qualifier votre feuille de route BACS.",
    contactEmail: "contact@ecovertaconsult.com",
    formspreeEndpoint: "",
    siteName: "EcoVertaConsul't",
    seoTitle: "Pr\xE9-diagnostic D\xE9cret BACS \u2014 note de cadrage initiale | EcoVertaConsul't",
    seoDescription: "\xC9valuez votre situation au regard du D\xE9cret BACS, identifiez les priorit\xE9s d\u2019action et obtenez une premi\xE8re lecture de l\u2019effort de mise en conformit\xE9.",
    seoImage: "https://www.ecovertaconsult.com/pre-diagnostic-decret-bacs/assets/img/site-illustration.png"
  };

  // assets/crm.js
  function openMailFallback(payload) {
    const lines = [
      "Bonjour,",
      "",
      "Voici une demande issue du pr\xE9-diagnostic D\xE9cret BACS EcoVerta.",
      "",
      `Nom : ${payload.name || "\u2014"}`,
      `Email : ${payload.email || "\u2014"}`,
      `T\xE9l\xE9phone : ${payload.phone || "\u2014"}`,
      `Organisation : ${payload.company || "\u2014"}`,
      `Portefeuille : ${payload.portfolio_name || "\u2014"}`,
      `Nombre de sites : ${payload.portfolio_sites || 0}`,
      `Surface : ${payload.portfolio_surface_m2 || 0} m\xB2`,
      `CAPEX net : ${payload.portfolio_capex_net_eur || 0} \u20AC`,
      `\xC9conomies annuelles : ${payload.portfolio_savings_eur_an || 0} \u20AC`,
      `ROI portefeuille : ${payload.portfolio_roi_years ?? "n/d"} ans`,
      `Top site : ${payload.top_site_name || "\u2014"} (${payload.top_site_score || 0}/100)`,
      `Prochaine \xE9tape : ${payload.top_site_next_step || "\u2014"}`,
      "",
      "Message :",
      payload.message || "\u2014"
    ];
    const subject = encodeURIComponent(payload._subject || "Demande EcoVerta");
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${APP_CONFIG.contactEmail || "contact@ecovertaconsult.com"}?subject=${subject}&body=${body}`;
    return { mode: "mailto" };
  }
  async function sendLead(payload) {
    if (!APP_CONFIG.formspreeEndpoint) {
      return openMailFallback(payload);
    }
    const res = await fetch(APP_CONFIG.formspreeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Erreur Formspree");
    return res.json();
  }
  function buildPayload({ contact, portfolio, topSite }) {
    return {
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      message: contact.message || "",
      portfolio_name: portfolio?.name || "",
      portfolio_sites: portfolio?.siteCount || 0,
      portfolio_surface_m2: Math.round(portfolio?.totalSurface || 0),
      portfolio_capex_net_eur: Math.round(portfolio?.totalCapex || 0),
      portfolio_savings_eur_an: Math.round(portfolio?.totalSavings || 0),
      portfolio_roi_years: portfolio?.roi != null ? Number(portfolio.roi.toFixed(1)) : null,
      portfolio_avg_lead: Math.round(portfolio?.avgLead || 0),
      portfolio_avg_reliability: Math.round(portfolio?.avgReliability || 0),
      top_site_name: topSite?.name || "",
      top_site_score: topSite?.leadScore || 0,
      top_site_roi: topSite?.roi != null ? Number(topSite.roi.toFixed(1)) : null,
      top_site_next_step: topSite?.nextStep || "",
      _subject: `Pr\xE9-diagnostic D\xE9cret BACS \u2014 ${portfolio?.name || "Nouveau portefeuille"}`
    };
  }

  // assets/pdf.js
  var COLORS = {
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
    return String(value ?? "").trim();
  }
  function formatInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    const s = String(Math.round(Math.abs(n)));
    const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${n < 0 ? "-" : ""}${grouped}`;
  }
  function formatDec(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return n.toFixed(digits).replace(".", ",");
  }
  function euro(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `${formatInt(n)} \u20AC`;
  }
  function kwh(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `${formatInt(n)} kWh`;
  }
  function sqm(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `${formatInt(n)} m\xB2`;
  }
  function co2Tons(valueKg) {
    const n = Number(valueKg);
    if (!Number.isFinite(n)) return "-";
    return `${formatInt(n / 1e3)} tCO\u2082/an`;
  }
  function roi(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "n/d";
    return `${formatDec(n)} ans`;
  }
  function reliabilityLabel(score) {
    const s = Number(score || 0);
    if (s >= 80) return "Fiabilit\xE9 \xE9lev\xE9e";
    if (s >= 60) return "Fiabilit\xE9 interm\xE9diaire";
    return "Fiabilit\xE9 limit\xE9e";
  }
  function priorityLabel(score) {
    const s = Number(score || 0);
    if (s >= 75) return "Priorit\xE9 \xE9lev\xE9e";
    if (s >= 55) return "Priorit\xE9 interm\xE9diaire";
    return "Priorit\xE9 \xE0 confirmer";
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
    doc.roundedRect(x, y, w, h, radius, radius, "FD");
  }
  function drawTopRule(doc, x, y, w, color = COLORS.brand) {
    doc.setDrawColor(...color);
    doc.setLineWidth(1.2);
    doc.line(x, y, x + w, y);
  }
  function pageHeader(doc, title, subtitle = "") {
    doc.setTextColor(...COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, 18, 18);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
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
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.8);
      doc.setTextColor(...COLORS.muted);
      doc.text("EcoVertaConsul't - Note de cadrage D\xE9cret BACS", 18, 292);
      doc.text(`Page ${i}/${total}`, 192, 292, { align: "right" });
    }
  }
  function metricCard(doc, x, y, w, h, label, value, accent = COLORS.brand) {
    drawRoundedBox(doc, x, y, w, h, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    drawTopRule(doc, x + 4, y + 5, w - 8, accent);
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(label.toUpperCase(), x + 5, y + 12);
    doc.setTextColor(...COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const lines = doc.splitTextToSize(value, w - 10);
    doc.text(lines, x + 5, y + 21);
  }
  function labelPill(doc, x, y, label, options = {}) {
    const fill = options.fill || COLORS.brandSoft;
    const text = options.text || COLORS.dark;
    const width = doc.getTextWidth(label) + 10;
    doc.setFillColor(...fill);
    doc.roundedRect(x, y - 4, width, 8, 4, 4, "F");
    doc.setTextColor(...text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(label, x + 5, y + 1.5);
    return width;
  }
  function bulletList(doc, items, x, y, width, lineHeight = 5.1) {
    let cursor = y;
    items.forEach((item) => {
      const lines = doc.splitTextToSize(`\u2022 ${item}`, width);
      doc.text(lines, x, cursor);
      cursor += lines.length * lineHeight;
    });
    return cursor;
  }
  function infoBox(doc, x, y, w, title, lines, options = {}) {
    const fill = options.fill || COLORS.card;
    const stroke = options.stroke || COLORS.line;
    drawRoundedBox(doc, x, y, w, options.height || 36, { fill, stroke, radius: 6 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...options.titleColor || COLORS.ink);
    doc.setFontSize(10.4);
    doc.text(title, x + 5, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...options.textColor || COLORS.muted);
    doc.setFontSize(9.2);
    let cursor = y + 15;
    lines.forEach((line) => {
      const split = doc.splitTextToSize(line, w - 10);
      doc.text(split, x + 5, cursor);
      cursor += split.length * 4.6;
    });
    return cursor;
  }
  function actionCard(doc, x, y, w, action) {
    drawRoundedBox(doc, x, y, w, 41, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    labelPill(doc, x + 5, y + 9, action.priority === "quick-win" ? "Quick win" : "Action structurante", {
      fill: action.priority === "quick-win" ? COLORS.brandSoft : [237, 244, 248],
      text: action.priority === "quick-win" ? COLORS.dark : COLORS.blue
    });
    doc.setTextColor(...COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.4);
    const titleLines = doc.splitTextToSize(safe(action.label || "Action BACS"), w - 10);
    doc.text(titleLines, x + 5, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(8.8);
    const rationale = doc.splitTextToSize(action.rationale || "Levier prioritaire au regard du pr\xE9-diagnostic.", w - 10);
    doc.text(rationale, x + 5, y + 22 + (titleLines.length - 1) * 4.8);
    const baseY = y + 31;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.ink);
    doc.text(`CAPEX ${euro(action.capexNet || 0)}`, x + 5, baseY);
    doc.text(`Gain ${euro(action.savingsEur || 0)}/an`, x + w / 2, baseY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(`ROI ${roi(action.payback)}`, x + 5, baseY + 5.5);
    doc.text(`Score ${formatInt(action.score || 0)}/100`, x + w / 2, baseY + 5.5);
  }
  function siteNarrative(site) {
    const lines = [];
    if ((site.roi ?? Infinity) <= 4) lines.push("La trajectoire para\xEEt favorable \xE0 un cadrage rapide, avec des premiers leviers activables \xE0 court terme.");
    else if ((site.roi ?? Infinity) <= 7) lines.push("La trajectoire semble \xE9conomiquement d\xE9fendable, sous r\xE9serve de confirmer les hypoth\xE8ses techniques.");
    else lines.push("La trajectoire para\xEEt plus structurante ; le phasage et les contraintes d\u2019exploitation devront \xEAtre clarifi\xE9s.");
    if (site.reliabilityScore >= 80) lines.push("Les donn\xE9es saisies permettent une premi\xE8re lecture relativement robuste.");
    else if (site.reliabilityScore >= 60) lines.push("La lecture est exploitable, mais plusieurs hypoth\xE8ses restent \xE0 confirmer.");
    else lines.push("Le niveau de fiabilit\xE9 reste limit\xE9 et appelle une validation compl\xE9mentaire.");
    return lines;
  }
  async function exportPortfolioPdf(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const portfolio = data.portfolio || {};
    const ranking = Array.isArray(portfolio.ranking) ? portfolio.ranking : [];
    const portfolioName = safe(data.portfolioName || "Portefeuille");
    doc.setFillColor(...COLORS.bg);
    doc.rect(0, 0, 210, 297, "F");
    doc.setFillColor(...COLORS.dark);
    doc.roundedRect(14, 18, 182, 112, 10, 10, "F");
    doc.setFillColor(...COLORS.dark2);
    doc.circle(176, 40, 24, "F");
    doc.setFillColor(27, 207, 112);
    doc.circle(176, 40, 13, "F");
    doc.setFillColor(...COLORS.card);
    doc.roundedRect(18, 22, 44, 10, 5, 5, "F");
    doc.setTextColor(...COLORS.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("EcoVertaConsul't \xB7 D\xE9cret BACS", 23, 28.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(25);
    doc.text("Pr\xE9-diagnostic D\xE9cret BACS", 22, 47);
    doc.setFontSize(16);
    doc.text("Note de cadrage initiale", 22, 57);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12.3);
    const intro = doc.splitTextToSize("Premi\xE8re lecture de situation, de priorit\xE9s d\u2019action et d\u2019effort de mise en conformit\xE9.", 132);
    doc.text(intro, 22, 71);
    drawRoundedBox(doc, 22, 88, 82, 25, { fill: [255, 255, 255], stroke: [255, 255, 255], radius: 6 });
    doc.setTextColor(...COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Portefeuille", 27, 96);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12.3);
    doc.text(portfolioName, 27, 104);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Date", 67, 96);
    doc.setFont("helvetica", "normal");
    doc.text((/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR"), 67, 104);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.4);
    const coverBullets = [
      "Priorit\xE9s d\u2019intervention et ordre de grandeur \xE9conomique",
      "Lecture portefeuille et points de vigilance",
      "Prochaine \xE9tape recommand\xE9e"
    ];
    bulletList(doc, coverBullets, 112, 92, 72, 5.2);
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(10);
    doc.text("Document d\u2019aide \xE0 la d\xE9cision - ne vaut pas validation r\xE9glementaire.", 18, 145);
    doc.setTextColor(...COLORS.brand);
    doc.setFont("helvetica", "bold");
    doc.textWithLink(APP_CONFIG.calendlyLabel || "Planifier un \xE9change de cadrage", 18, 154, { url: APP_CONFIG.calendlyUrl });
    doc.addPage();
    pageHeader(doc, "1. Synth\xE8se ex\xE9cutive", "Premi\xE8re lecture du portefeuille au regard du D\xE9cret BACS");
    const summaryText = portfolio.siteCount ? `Le portefeuille ressort ${safe(portfolio.status || "\xE0 structurer")}, avec une priorit\xE9 moyenne de ${formatInt(Math.round(portfolio.avgLead || 0))}/100 et une fiabilit\xE9 de ${formatInt(Math.round(portfolio.avgReliability || 0))}/100.` : "Aucun site n\u2019est encore int\xE9gr\xE9 au portefeuille.";
    drawRoundedBox(doc, 18, 34, 174, 20, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
    doc.setTextColor(...COLORS.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.2);
    const summaryLines = doc.splitTextToSize(summaryText, 164);
    doc.text(summaryLines, 23, 43);
    metricCard(doc, 18, 60, 54, 24, "Sites analys\xE9s", formatInt(portfolio.siteCount || 0));
    metricCard(doc, 78, 60, 54, 24, "Surface totale", sqm(portfolio.totalSurface || 0));
    metricCard(doc, 138, 60, 54, 24, "Priorit\xE9 moyenne", `${formatInt(Math.round(portfolio.avgLead || 0))}/100`, COLORS.blue);
    metricCard(doc, 18, 90, 54, 24, "CAPEX net estim\xE9", euro(portfolio.totalCapex || 0));
    metricCard(doc, 78, 90, 54, 24, "\xC9conomies annuelles", `${euro(portfolio.totalSavings || 0)}/an`);
    metricCard(doc, 138, 90, 54, 24, "ROI portefeuille", roi(portfolio.roi));
    drawRoundedBox(doc, 18, 122, 84, 42, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(10.8);
    doc.text("Lecture portefeuille", 23, 131);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9.2);
    bulletList(doc, [
      portfolio.status === "prioritaire" ? "Le portefeuille appelle une priorisation rapide des premi\xE8res actions de pilotage et de mise en conformit\xE9." : portfolio.status === "\xE0 traiter" ? "Le portefeuille n\xE9cessite un cadrage des arbitrages BACS \xE0 court terme." : "Le portefeuille peut \xEAtre structur\xE9 par phases, avec une attention port\xE9e au bon phasage BACS.",
      `Fiabilit\xE9 moyenne : ${formatInt(Math.round(portfolio.avgReliability || 0))}/100.`,
      `CO\u2082 \xE9vit\xE9 estim\xE9 : ${co2Tons(portfolio.totalCo2 || 0)}.`
    ], 23, 139, 74, 4.8);
    drawRoundedBox(doc, 108, 122, 84, 42, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(10.8);
    doc.text("Ce que cela signifie", 113, 131);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9.2);
    bulletList(doc, [
      "Le classement croise le niveau d\u2019\xE9quipement, l\u2019effort estim\xE9, la fiabilit\xE9 et la priorit\xE9 d\u2019intervention.",
      "Les montants affich\xE9s constituent des ordres de grandeur de cadrage.",
      "Le pr\xE9-diagnostic n\u2019\xE9tablit pas \xE0 lui seul la conformit\xE9 r\xE9glementaire de chaque site."
    ], 113, 139, 74, 4.8);
    doc.autoTable({
      startY: 172,
      head: [["Site", "Usage", "Surface", "Priorit\xE9", "Fiabilit\xE9", "ROI"]],
      body: ranking.map((site, idx) => [
        safe(site.name || `Site ${idx + 1}`),
        safe(site.usage || "-"),
        sqm(site.surface || 0),
        `${formatInt(site.leadScore || 0)}/100`,
        `${formatInt(site.reliabilityScore || 0)}/100`,
        roi(site.roi)
      ]),
      styles: {
        fontSize: 9,
        cellPadding: { top: 3.3, right: 2.6, bottom: 3.3, left: 2.6 },
        textColor: COLORS.ink,
        valign: "middle"
      },
      headStyles: { fillColor: COLORS.brand, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 251, 249] },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 30 },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 24, halign: "center" },
        5: { cellWidth: 24, halign: "center" }
      },
      margin: { left: 18, right: 18 }
    });
    doc.addPage();
    pageHeader(doc, "2. Cadre r\xE9glementaire et hypoth\xE8ses", "Ce document reste une aide \xE0 la priorisation et au cadrage.");
    infoBox(doc, 18, 34, 84, "Ce que dit le D\xE9cret BACS", [
      "Le D\xE9cret BACS impose la mise en place de syst\xE8mes d\u2019automatisation et de contr\xF4le des b\xE2timents pour certaines installations tertiaires.",
      "Les seuils de puissance et les \xE9ch\xE9ances r\xE9glementaires doivent \xEAtre confirm\xE9s au cas par cas."
    ], { height: 54, titleColor: COLORS.ink, textColor: COLORS.muted });
    infoBox(doc, 108, 34, 84, "Ce que lit ce pr\xE9-diagnostic", [
      "Une premi\xE8re lecture du niveau d\u2019\xE9quipement, du potentiel d\u2019am\xE9lioration et des principaux ordres de grandeur \xE9conomiques.",
      "Un niveau de fiabilit\xE9 d\xE9pendant de la qualit\xE9 des donn\xE9es saisies."
    ], { height: 54, titleColor: COLORS.ink, textColor: COLORS.muted });
    infoBox(doc, 18, 96, 174, "Ce que ce document ne remplace pas", [
      "Ni une visite de site, ni une v\xE9rification r\xE9glementaire d\xE9taill\xE9e, ni un chiffrage d\u2019ex\xE9cution.",
      "Les ROI et CAPEX restent des ordres de grandeur de cadrage destin\xE9s \xE0 prioriser et \xE0 arbitrer."
    ], { height: 34, fill: [255, 255, 255], stroke: COLORS.line });
    drawRoundedBox(doc, 18, 140, 84, 60, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(10.8);
    doc.text("Hypoth\xE8ses de lecture", 23, 149);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9.2);
    bulletList(doc, [
      "Niveau d\u2019\xE9quipement : lecture interne EcoVerta du niveau de pilotage d\xE9clar\xE9.",
      "Fiabilit\xE9 : robustesse de la lecture au regard des donn\xE9es et des ratios calcul\xE9s.",
      "Actions prioritaires : leviers BACS class\xE9s selon ROI, impact et port\xE9e r\xE9glementaire."
    ], 23, 157, 74, 4.8);
    drawRoundedBox(doc, 108, 140, 84, 60, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(10.8);
    doc.text("Prochaine \xE9tape recommand\xE9e", 113, 149);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9.4);
    const stepText = doc.splitTextToSize("Organiser un \xE9change de cadrage pour confirmer le p\xE9rim\xE8tre, les hypoth\xE8ses techniques et la trajectoire de mise en conformit\xE9 la plus pertinente.", 74);
    doc.text(stepText, 113, 157);
    doc.setTextColor(...COLORS.brand);
    doc.setFont("helvetica", "bold");
    doc.textWithLink(APP_CONFIG.calendlyLabel || "Planifier un \xE9change de cadrage", 113, 190, { url: APP_CONFIG.calendlyUrl });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(APP_CONFIG.calendlyHelper || "", 113, 196);
    ranking.forEach((site, idx) => {
      doc.addPage();
      pageHeader(doc, `3.${idx + 1} Lecture par site`, safe(site.name || `Site ${idx + 1}`));
      labelPill(doc, 18, 36, priorityLabel(site.leadScore), { fill: site.leadScore >= 75 ? COLORS.brandSoft : [255, 245, 222], text: site.leadScore >= 75 ? COLORS.dark : COLORS.warnInk });
      labelPill(doc, 60, 36, reliabilityLabel(site.reliabilityScore), { fill: [237, 244, 248], text: COLORS.blue });
      metricCard(doc, 18, 44, 40, 22, "Priorit\xE9", `${formatInt(site.leadScore || 0)}/100`, COLORS.brand);
      metricCard(doc, 62, 44, 40, 22, "Fiabilit\xE9", `${formatInt(site.reliabilityScore || 0)}/100`, COLORS.blue);
      metricCard(doc, 106, 44, 40, 22, "ROI", roi(site.roi), COLORS.brand);
      metricCard(doc, 150, 44, 42, 22, "\xC9conomies / an", `${euro(site.savingsEur || 0)}/an`, COLORS.brand);
      drawRoundedBox(doc, 18, 74, 84, 52, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(10.8);
      doc.text("Caract\xE9ristiques du site", 23, 83);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.muted);
      doc.setFontSize(9.2);
      const facts = [
        `Segment : ${safe(site.segment || "-")} \xB7 Usage : ${safe(site.usage || "-")} \xB7 Surface : ${sqm(site.surface || 0)}`,
        `Conso actuelle : ${kwh(site.act || 0)} \xB7 cible : ${kwh(site.target || 0)}`,
        `GTB / pilotage d\xE9clar\xE9 : ${safe(site.gtb || "-")} \xB7 maturit\xE9 BACS : ${safe(site.bacsStage || "-")}`,
        `Intensit\xE9 : ${formatDec(site.actualIntensity)} kWh/m\xB2 \xB7 benchmark : ${formatDec(site.benchmarkIntensity)} kWh/m\xB2 \xB7 aide retenue : ${formatInt(site.aidesPct)}%`
      ];
      let fy = 91;
      facts.forEach((line) => {
        const split = doc.splitTextToSize(line, 74);
        doc.text(split, 23, fy);
        fy += split.length * 4.8;
      });
      drawRoundedBox(doc, 108, 74, 84, 52, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(10.8);
      doc.text("Lecture de cadrage", 113, 83);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.muted);
      doc.setFontSize(9.2);
      bulletList(doc, siteNarrative(site), 113, 91, 74, 4.8);
      drawTopRule(doc, 18, 135, 174, COLORS.line);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(11);
      doc.text("Actions prioritaires", 18, 144);
      const actions = (site.topActions && site.topActions.length ? site.topActions : site.measures || []).slice(0, 2);
      if (actions[0]) actionCard(doc, 18, 149, 84, actions[0]);
      if (actions[1]) actionCard(doc, 108, 149, 84, actions[1]);
      drawRoundedBox(doc, 18, 196, 174, 28, { fill: [255, 251, 243], stroke: [243, 221, 171], radius: 6 });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.warnInk);
      doc.setFontSize(10.5);
      doc.text("Points de vigilance", 23, 205);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.1);
      const warningText = doc.splitTextToSize((site.warnings || [site.bacsDisclaimer || "Validation compl\xE9mentaire recommand\xE9e."]).slice(0, 2).join(" "), 164);
      doc.text(warningText, 23, 213);
      drawRoundedBox(doc, 18, 230, 174, 34, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.setFontSize(10.8);
      doc.text("Prochaine \xE9tape recommand\xE9e", 23, 239);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.muted);
      doc.setFontSize(9.4);
      const next = doc.splitTextToSize(site.nextStep || "Relire les hypoth\xE8ses et organiser un \xE9change de cadrage.", 164);
      doc.text(next, 23, 247);
    });
    doc.addPage();
    pageHeader(doc, "4. Prochaine \xE9tape recommand\xE9e", "Confirmer les hypoth\xE8ses et pr\xE9parer la suite");
    drawRoundedBox(doc, 18, 36, 174, 22, { fill: COLORS.brandSoft, stroke: COLORS.line, radius: 6 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(11.2);
    const closeIntro = doc.splitTextToSize("Un \xE9change de cadrage permet de confirmer les hypoth\xE8ses, pr\xE9ciser le p\xE9rim\xE8tre technique et hi\xE9rarchiser les actions \xE0 engager.", 164);
    doc.text(closeIntro, 23, 45);
    const steps = [
      ["1. V\xE9rifier le p\xE9rim\xE8tre", "Confirmer l\u2019assujettissement et le p\xE9rim\xE8tre des sites \xE0 partir des syst\xE8mes r\xE9ellement pr\xE9sents et de leur puissance nominale utile."],
      ["2. Valider les hypoth\xE8ses", "Relire les donn\xE9es, les sch\xE9mas de pilotage et les contraintes d\u2019exploitation qui conditionnent le chiffrage et le ROI."],
      ["3. Pr\xE9parer la suite", "Cadrer une \xE9tude, une consultation ou un audit d\xE9taill\xE9 avec un budget et un planning plus robustes."]
    ];
    let boxY = 68;
    steps.forEach(([title, text], idx) => {
      drawRoundedBox(doc, 18, boxY, 174, 30, { fill: COLORS.card, stroke: COLORS.line, radius: 6 });
      labelPill(doc, 23, boxY + 9, title, { fill: idx === 0 ? COLORS.brandSoft : [237, 244, 248], text: idx === 0 ? COLORS.dark : COLORS.blue });
      doc.setTextColor(...COLORS.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.4);
      const lines = doc.splitTextToSize(text, 150);
      doc.text(lines, 23, boxY + 18);
      boxY += 38;
    });
    drawRoundedBox(doc, 18, 190, 174, 54, { fill: COLORS.dark, stroke: COLORS.dark, radius: 8 });
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14.5);
    doc.text("Planifier un \xE9change de cadrage", 23, 205);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.2);
    const ctaText = doc.splitTextToSize("\xC9change de 30 minutes pour relire le pr\xE9-diagnostic, confirmer les hypoth\xE8ses et pr\xE9parer la trajectoire de mise en conformit\xE9 la plus pertinente.", 128);
    doc.text(ctaText, 23, 214);
    doc.setTextColor(...COLORS.brandSoft);
    doc.setFont("helvetica", "bold");
    doc.textWithLink(APP_CONFIG.calendlyLabel || "Planifier un \xE9change de cadrage", 23, 234, { url: APP_CONFIG.calendlyUrl });
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text(APP_CONFIG.contactEmail || "contact@ecovertaconsult.com", 23, 242);
    doc.text("EcoVertaConsul't - La Courneuve (93)", 23, 249);
    pageFooter(doc);
    const fileName = `note-cadrage-bacs-${portfolioName.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "portefeuille"}.pdf`;
    doc.save(fileName);
  }

  // assets/app.js
  var state = {
    currentStep: 0,
    portfolio: { name: "", customerType: "tertiaire", targetYear: "2030", objective: "economies" },
    currentSite: {
      name: "",
      segment: "tertiaire",
      usage: "bureaux",
      surface: 2400,
      act: 42e4,
      target: 29e4,
      price: 0.18,
      co2: 0.204,
      gtb: "non",
      dataQuality: "moyenne",
      projectIntent: "aucune",
      aidesPct: 20
    },
    catalog: cloneCatalog(),
    sites: [],
    computedSite: null,
    portfolioResult: null,
    contact: { name: "", email: "", phone: "", company: "", message: "" }
  };
  var stepsMeta = [
    ["\xC9tape 1 sur 5 \u2014 Cadre portefeuille", "Renseignez le contexte du portefeuille, le type d\u2019actifs concern\xE9s et le niveau de priorit\xE9 donn\xE9 au sujet BACS."],
    ["\xC9tape 2 sur 5 \u2014 Donn\xE9es site", "Ajoutez un ou plusieurs sites et pr\xE9cisez les caract\xE9ristiques utiles \xE0 une premi\xE8re lecture D\xE9cret BACS."],
    ["\xC9tape 3 sur 5 \u2014 Leviers BACS", "S\xE9lectionnez les leviers techniques et organisationnels \xE0 int\xE9grer dans l\u2019analyse."],
    ["\xC9tape 4 sur 5 \u2014 Synth\xE8se portefeuille", "Consultez la lecture d\u2019opportunit\xE9, les priorit\xE9s, les ordres de grandeur \xE9conomiques et les points de vigilance."],
    ["\xC9tape 5 sur 5 \u2014 Export & suite", "T\xE9l\xE9chargez la note de cadrage et pr\xE9parez la prochaine \xE9tape."]
  ];
  var $ = (sel) => document.querySelector(sel);
  var $$ = (sel) => Array.from(document.querySelectorAll(sel));
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function makeSiteId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
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
    const t = $("#toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      t.style.display = "none";
    }, 2400);
  }
  function euro2(v) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
  }
  function setStep(step) {
    state.currentStep = Math.max(0, Math.min(4, step));
    const [title, sub] = stepsMeta[state.currentStep];
    $("#wizardTitle").textContent = title;
    $("#wizardSub").textContent = sub;
    $("#wizardRemain").textContent = `${4 - state.currentStep} \xE9tape${4 - state.currentStep > 1 ? "s" : ""} restante${4 - state.currentStep > 1 ? "s" : ""}`;
    $("#progressFill").style.width = `${(state.currentStep + 1) / 5 * 100}%`;
    $$(".panel").forEach((p, i) => p.classList.toggle("active", i === state.currentStep));
    $$("#wizardSteps .step").forEach((s, i) => {
      s.classList.toggle("active", i === state.currentStep);
      s.classList.toggle("done", i < state.currentStep);
    });
    $("#prevBtn").style.visibility = state.currentStep === 0 ? "hidden" : "visible";
    $("#nextBtn").style.display = state.currentStep === 4 ? "none" : "inline-flex";
    if (state.currentStep === 3) renderPortfolioResults();
    if (state.currentStep === 4) syncContactFields();
  }
  function readPortfolioFields() {
    state.portfolio.name = $("#portfolioName").value.trim();
    state.portfolio.customerType = $("#customerType").value;
    state.portfolio.targetYear = $("#targetYear").value;
    state.portfolio.objective = $("#objective").value;
  }
  function readCurrentSiteFields() {
    state.currentSite = {
      name: $("#siteName").value.trim(),
      segment: $("#segment").value,
      usage: $("#usage").value,
      surface: Number($("#surface").value) || 0,
      act: Number($("#act").value) || 0,
      target: Number($("#target").value) || 0,
      price: Number($("#price").value) || 0,
      co2: Number($("#co2").value) || 0,
      gtb: $("#gtb").value,
      dataQuality: $("#dataQuality").value,
      projectIntent: $("#projectIntent").value,
      aidesPct: Number($("#aidesPct").value) || 0
    };
  }
  function syncPortfolioFields() {
    $("#portfolioName").value = state.portfolio.name;
    $("#customerType").value = state.portfolio.customerType;
    $("#targetYear").value = state.portfolio.targetYear;
    $("#objective").value = state.portfolio.objective;
  }
  function syncSiteFields() {
    const s = state.currentSite;
    $("#siteName").value = s.name;
    $("#segment").value = s.segment;
    $("#usage").value = s.usage;
    $("#surface").value = s.surface;
    $("#act").value = s.act;
    $("#target").value = s.target;
    $("#price").value = s.price;
    $("#co2").value = s.co2;
    $("#gtb").value = s.gtb;
    $("#dataQuality").value = s.dataQuality;
    $("#projectIntent").value = s.projectIntent;
    $("#aidesPct").value = s.aidesPct;
  }
  function renderCatalog() {
    const grid = $("#catalogGrid");
    grid.innerHTML = "";
    state.catalog.forEach((item) => {
      const card = document.createElement("label");
      card.className = "measure-card";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.id = String(item.id || "");
      input.checked = !!item.selected;
      const content = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = item.label || "Mesure BACS";
      const detail = document.createElement("span");
      detail.textContent = `Gain ${Math.round((item.gain || 0) * 100)}% \xB7 CAPEX ${item.capexM2 || 0} \u20AC/m\xB2 \xB7 complexit\xE9 ${item.complexity || "moyenne"}`;
      const meta = document.createElement("div");
      meta.className = "measure-meta";
      meta.textContent = `${item.regulatory ? "Bonus r\xE9glementaire" : "Levier technique"} \xB7 ${item.priority === "quick-win" ? "quick win" : "structurant"}`;
      content.append(title, detail, meta);
      card.append(input, content);
      grid.appendChild(card);
    });
    grid.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        const target = state.catalog.find((m) => m.id === e.target.dataset.id);
        if (target) target.selected = e.target.checked;
        renderMeasureCounters();
        recomputeAllSitesFromCatalog();
      });
    });
    renderMeasureCounters();
  }
  function renderMeasureCounters() {
    const active = state.catalog.filter((m) => m.selected);
    $("#activeMeasuresCount").textContent = String(active.length);
    $("#quickWinCount").textContent = String(active.filter((m) => m.priority === "quick-win").length);
    $("#structuringCount").textContent = String(active.filter((m) => m.priority !== "quick-win").length);
    const fallback = $("#measureFallbackHint");
    if (fallback) {
      fallback.textContent = active.length ? `Le calcul utilisera ${active.length} levier${active.length > 1 ? "s" : ""} s\xE9lectionn\xE9${active.length > 1 ? "s" : ""}.` : "Aucun levier s\xE9lectionn\xE9 : un socle BACS standard est appliqu\xE9 par d\xE9faut pour la simulation.";
    }
  }
  function getEffectiveCatalog() {
    const active = state.catalog.filter((m) => m.selected);
    return active.length ? state.catalog : state.catalog.map((m, idx) => ({ ...m, selected: idx < 4 }));
  }
  function recomputeAllSitesFromCatalog() {
    if (!state.sites.length) {
      recomputePortfolio();
      renderSummaryCards();
      if (state.currentStep >= 3) renderPortfolioResults();
      return;
    }
    const catalog = getEffectiveCatalog().map((m) => ({ ...m }));
    state.sites = state.sites.map((site) => ensureSiteIdentity(computeSite(site, catalog.map((item) => ({ ...item })))));
    recomputePortfolio();
    renderSitesList();
    renderSummaryCards();
    if (state.currentStep >= 3) renderPortfolioResults();
  }
  function computeCurrentSite() {
    readCurrentSiteFields();
    state.currentSite = ensureSiteIdentity(state.currentSite);
    const chosen = getEffectiveCatalog();
    state.computedSite = computeSite(state.currentSite, chosen.map((m) => ({ ...m })));
    showToast("Premi\xE8re lecture du site mise \xE0 jour.");
    return state.computedSite;
  }
  function addCurrentSite() {
    const computed = ensureSiteIdentity(computeCurrentSite());
    const existingIndex = state.sites.findIndex((s) => s.siteId === computed.siteId);
    if (existingIndex >= 0) state.sites[existingIndex] = computed;
    else state.sites.push(computed);
    recomputePortfolio();
    renderSitesList();
    renderSummaryCards();
    showToast(existingIndex >= 0 ? "Site mis \xE0 jour dans l\u2019analyse." : "Site ajout\xE9 au portefeuille.");
  }
  function renderSitesList() {
    const root = $("#portfolioSitesList");
    root.innerHTML = "";
    if (!state.sites.length) {
      const empty = document.createElement("div");
      empty.className = "site-row";
      const wrapper = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = "Aucun site ajout\xE9";
      const note = document.createElement("span");
      note.textContent = "Ajoutez un premier site pour construire le portefeuille.";
      wrapper.append(title, note);
      empty.appendChild(wrapper);
      root.appendChild(empty);
      $("#siteCountPill").textContent = "0 site";
      return;
    }
    state.sites.forEach((site, idx) => {
      const row = document.createElement("div");
      row.className = "site-row";
      const priority = site.leadScore >= 80 ? "high" : site.leadScore >= 55 ? "medium" : "low";
      const left = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = site.name || `Site ${idx + 1}`;
      const meta = document.createElement("span");
      meta.textContent = `${Math.round(site.surface).toLocaleString("fr-FR")} m\xB2 \xB7 ROI ${site.roi != null ? site.roi.toFixed(1).replace(".", ",") + " ans" : "n/d"} \xB7 ${euro2(site.savingsEur || 0)}/an \xB7 Fiabilit\xE9 ${site.reliabilityScore || 0}/100`;
      left.append(title, meta);
      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "8px";
      right.style.flexWrap = "wrap";
      right.style.alignItems = "center";
      const tag = document.createElement("span");
      tag.className = `tag ${priority}`;
      tag.textContent = `${site.leadScore}/100`;
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-light btn-sm";
      editBtn.type = "button";
      editBtn.dataset.edit = site.siteId;
      editBtn.textContent = "\xC9diter";
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-light btn-sm";
      deleteBtn.type = "button";
      deleteBtn.dataset.delete = site.siteId;
      deleteBtn.textContent = "Supprimer";
      right.append(tag, editBtn, deleteBtn);
      row.append(left, right);
      root.appendChild(row);
    });
    $("#siteCountPill").textContent = `${state.sites.length} site${state.sites.length > 1 ? "s" : ""}`;
    root.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => {
      const site = state.sites.find((entry) => entry.siteId === btn.dataset.edit);
      if (!site) return;
      state.currentSite = {
        siteId: site.siteId,
        name: site.name || "",
        segment: site.segment || "tertiaire",
        usage: site.usage || "bureaux",
        surface: site.surface || 0,
        act: site.act || 0,
        target: site.target || 0,
        price: site.price || 0,
        co2: site.co2 || 0,
        gtb: site.gtb || "non",
        dataQuality: site.dataQuality || "moyenne",
        projectIntent: site.projectIntent || "aucune",
        aidesPct: site.aidesPct || 0
      };
      syncSiteFields();
      setStep(1);
    }));
    root.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => {
      state.sites = state.sites.filter((entry) => entry.siteId !== btn.dataset.delete);
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
    $("#summarySites").textContent = String(p.siteCount || 0);
    $("#summarySurface").textContent = `${Math.round(p.totalSurface || 0).toLocaleString("fr-FR")} m\xB2`;
    $("#summaryPotential").textContent = p.siteCount ? p.avgLead >= 80 ? "Priorit\xE9 \xE9lev\xE9e" : p.avgLead >= 55 ? "\xC0 structurer rapidement" : "\xC0 qualifier" : "\xC0 construire";
  }
  function renderPortfolioResults() {
    recomputePortfolio();
    const p = state.portfolioResult;
    const readout = buildPortfolioReadout(p);
    const score = Math.round(p.avgLead || 0);
    $("#portfolioHeadline").textContent = !p.siteCount ? "Votre synth\xE8se portefeuille appara\xEEtra ici." : p.status === "prioritaire" ? "Votre portefeuille appelle une priorisation rapide des premi\xE8res actions BACS." : p.status === "\xE0 traiter" ? "Votre portefeuille n\xE9cessite un cadrage des arbitrages BACS \xE0 court terme." : "Votre portefeuille peut \xEAtre structur\xE9 progressivement.";
    $("#portfolioLead").textContent = readout.join(" ");
    $("#portfolioScore").textContent = String(score);
    $("#scoreRing").style.background = `radial-gradient(closest-side, white 75%, transparent 76% 100%), conic-gradient(var(--brand) 0 ${score}%, #e6eee9 ${score}% 100%)`;
    $("#scoreComment").textContent = score >= 80 ? `Ce score synth\xE9tique traduit une priorit\xE9 d\u2019intervention \xE9lev\xE9e. Fiabilit\xE9 moyenne ${Math.round(p.avgReliability || 0)}/100.` : score >= 55 ? `Ce score synth\xE9tique indique une priorit\xE9 d\u2019intervention r\xE9elle. Fiabilit\xE9 moyenne ${Math.round(p.avgReliability || 0)}/100.` : `Ce score synth\xE9tique donne une premi\xE8re lecture \xE0 qualifier. Fiabilit\xE9 moyenne ${Math.round(p.avgReliability || 0)}/100.`;
    $("#portfolioStatusPill").textContent = p.status || "Synth\xE8se";
    $("#kpiSites").textContent = String(p.siteCount || 0);
    $("#kpiSurface").textContent = `${Math.round(p.totalSurface || 0).toLocaleString("fr-FR")} m\xB2`;
    $("#kpiCapex").textContent = euro2(p.totalCapex || 0);
    $("#kpiSavings").textContent = euro2(p.totalSavings || 0);
    $("#kpiRoi").textContent = p.roi != null ? `${p.roi.toFixed(1).replace(".", ",")} ans` : "\u2014";
    $("#kpiCo2").textContent = `${Math.round((p.totalCo2 || 0) / 1e3).toLocaleString("fr-FR")} t`;
    const rankingRoot = $("#rankingList");
    rankingRoot.innerHTML = "";
    (p.ranking || []).forEach((site) => {
      const priority = site.leadScore >= 80 ? "high" : site.leadScore >= 55 ? "medium" : "low";
      const row = document.createElement("div");
      row.className = "site-row";
      row.innerHTML = `<div><b>${escapeHtml(site.name || "Sans nom")}</b><span>${escapeHtml(site.usage || "Usage")} \xB7 ${Math.round(site.surface).toLocaleString("fr-FR")} m\xB2 \xB7 ${euro2(site.savingsEur || 0)}/an \xB7 Fiabilit\xE9 ${site.reliabilityScore || 0}/100</span></div><span class="tag ${priority}">${site.leadScore}/100</span>`;
      rankingRoot.appendChild(row);
    });
    if (!p.ranking?.length) rankingRoot.innerHTML = '<div class="site-row"><div><b>Aucun r\xE9sultat</b><span>Ajoutez des sites pour afficher un classement.</span></div></div>';
    const topActionsRoot = $("#topActionsList");
    topActionsRoot.innerHTML = "";
    const allActions = (p.ranking || []).flatMap((site) => (site.topActions || []).map((action) => ({ ...action, siteName: site.name })));
    const deduped = allActions.sort((a, b) => b.score - a.score).slice(0, 3);
    deduped.forEach((action) => {
      const item = document.createElement("div");
      item.className = "action-item";
      item.innerHTML = `<b>${escapeHtml(action.label)} \u2014 ${escapeHtml(action.siteName || "Site")}</b><span>Priorit\xE9 ${action.score}/100 \xB7 ROI ${Number.isFinite(action.payback) ? action.payback.toFixed(1).replace(".", ",") + " ans" : "n/d"} \xB7 Gain ${action.gainPct}% \xB7 ${escapeHtml(action.rationale || "levier \xE0 \xE9tudier")}</span>`;
      topActionsRoot.appendChild(item);
    });
    if (!deduped.length) topActionsRoot.innerHTML = '<div class="action-item"><b>Aucune action affich\xE9e</b><span>Calculez au moins un site pour afficher des actions prioritaires.</span></div>';
    const salesRoot = $("#salesReadout");
    salesRoot.innerHTML = "";
    const salesLines = (p.ranking || []).length ? buildSalesReadout(p.ranking[0]).concat(readout) : ["Ajoutez des sites puis calculez pour g\xE9n\xE9rer une premi\xE8re lecture de cadrage."];
    salesLines.forEach((line) => {
      const item = document.createElement("div");
      item.className = "action-item";
      item.innerHTML = `<span>${escapeHtml(line)}</span>`;
      salesRoot.appendChild(item);
    });
  }
  function syncContactFields() {
    $("#contactName").value = state.contact.name || "";
    $("#contactEmail").value = state.contact.email || "";
    $("#contactPhone").value = state.contact.phone || "";
    $("#contactCompany").value = state.contact.company || "";
    $("#contactMessage").value = state.contact.message || "";
  }
  function readContactFields() {
    state.contact = {
      name: $("#contactName").value.trim(),
      email: $("#contactEmail").value.trim(),
      phone: $("#contactPhone").value.trim(),
      company: $("#contactCompany").value.trim(),
      message: $("#contactMessage").value.trim()
    };
  }
  function validateStep(step) {
    if (step === 0) {
      readPortfolioFields();
      if (!state.portfolio.name) {
        showToast("Renseignez un nom de portefeuille.");
        return false;
      }
    }
    if (step === 1) {
      if (!state.sites.length) {
        showToast("Ajoutez au moins un site au portefeuille.");
        return false;
      }
    }
    if (step === 3) {
      if (!state.portfolioResult?.siteCount) {
        showToast("Aucun r\xE9sultat portefeuille \xE0 exporter.");
        return false;
      }
    }
    return true;
  }
  function canAccessStep(targetStep) {
    for (let step = 0; step < targetStep; step += 1) {
      if (!validateStep(step)) return false;
    }
    return true;
  }
  function scrollToWizard() {
    $("#wizardSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function loadDemo() {
    state.portfolio = { name: "Patrimoine tertiaire \u2014 exemple", customerType: "tertiaire", targetYear: "2030", objective: "strategie" };
    state.catalog.forEach((m, idx) => {
      m.selected = idx < 6;
    });
    const demoCatalog = getEffectiveCatalog().map((m) => ({ ...m }));
    state.sites = [
      ensureSiteIdentity(computeSite({ name: "Site A \u2014 Bureaux", segment: "tertiaire", usage: "bureaux", surface: 4500, act: 82e4, target: 56e4, price: 0.18, co2: 0.204, gtb: "non", dataQuality: "faible", projectIntent: "travaux_12m", aidesPct: 20 }, demoCatalog.map((m) => ({ ...m })))),
      ensureSiteIdentity(computeSite({ name: "Site B \u2014 Enseignement", segment: "public", usage: "enseignement", surface: 6200, act: 11e5, target: 76e4, price: 0.16, co2: 0.055, gtb: "partielle", dataQuality: "moyenne", projectIntent: "travaux_24m", aidesPct: 25 }, demoCatalog.map((m) => ({ ...m })))),
      ensureSiteIdentity(computeSite({ name: "Site C \u2014 Sant\xE9", segment: "tertiaire", usage: "sante", surface: 2800, act: 51e4, target: 41e4, price: 0.19, co2: 0.204, gtb: "complete", dataQuality: "bonne", projectIntent: "audit", aidesPct: 15 }, demoCatalog.map((m) => ({ ...m }))))
    ];
    syncPortfolioFields();
    renderCatalog();
    renderSitesList();
    renderSummaryCards();
    recomputePortfolio();
    renderPortfolioResults();
    showToast("Exemple de portefeuille charg\xE9.");
    setStep(3);
  }
  async function handleSendLead() {
    readContactFields();
    if (!state.portfolioResult?.siteCount) {
      showToast("Calculez d\u2019abord un portefeuille avant l\u2019envoi.");
      return;
    }
    if (!state.contact.name || !state.contact.email) {
      showToast("Renseignez au moins le nom et l\u2019email.");
      return;
    }
    if (!$("#consent").checked) {
      showToast("Merci de cocher le consentement RGPD.");
      return;
    }
    const payload = buildPayload({ contact: state.contact, portfolio: { ...state.portfolioResult, name: state.portfolio.name }, topSite: state.portfolioResult?.ranking?.[0] });
    const btn = $("#sendLeadBtn");
    btn.disabled = true;
    btn.textContent = "Envoi en cours\u2026";
    try {
      const result = await sendLead(payload);
      if (result?.mode === "mailto") {
        btn.textContent = "Email pr\xE9rempli \u2714";
        showToast("Votre client mail a \xE9t\xE9 ouvert avec le message pr\xE9rempli.");
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = "Envoyer ma demande";
        }, 1200);
      } else {
        btn.textContent = "Envoy\xE9 \u2714";
        showToast("Votre demande a bien \xE9t\xE9 prise en compte.");
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Envoyer ma demande";
      showToast("Erreur d\u2019envoi. V\xE9rifiez votre connexion.");
    }
  }
  async function handleExportPdf() {
    if (!state.portfolioResult?.siteCount) {
      showToast("Aucun portefeuille \xE0 exporter.");
      return;
    }
    try {
      await exportPortfolioPdf({
        portfolioName: state.portfolio.name,
        portfolio: state.portfolioResult
      });
    } catch (error) {
      console.error(error);
      showToast("L\u2019export PDF a \xE9chou\xE9.");
    }
  }
  function resetAll() {
    state.currentStep = 0;
    state.portfolio = { name: "", customerType: "tertiaire", targetYear: "2030", objective: "economies" };
    state.currentSite = { siteId: null, name: "", segment: "tertiaire", usage: "bureaux", surface: 2400, act: 42e4, target: 29e4, price: 0.18, co2: 0.204, gtb: "non", dataQuality: "moyenne", projectIntent: "aucune", aidesPct: 20 };
    state.catalog = cloneCatalog();
    state.sites = [];
    state.computedSite = null;
    state.portfolioResult = null;
    state.contact = { name: "", email: "", phone: "", company: "", message: "" };
    clearState();
    $("#consent").checked = false;
    syncPortfolioFields();
    syncSiteFields();
    renderCatalog();
    renderSitesList();
    renderSummaryCards();
    setStep(0);
    showToast("Pr\xE9-diagnostic r\xE9initialis\xE9.");
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
    if (!saved) {
      showToast("Aucune sauvegarde locale.");
      return;
    }
    state.currentStep = Number.isFinite(saved.currentStep) ? saved.currentStep : 0;
    state.portfolio = { ...state.portfolio, ...saved.portfolio || {} };
    state.currentSite = ensureSiteIdentity({ ...state.currentSite, ...saved.currentSite || {} });
    const baseCatalog = cloneCatalog();
    if (Array.isArray(saved.catalog) && saved.catalog.length) {
      const selectedMap = new Map(saved.catalog.map((item) => [item.id, !!item.selected]));
      state.catalog = baseCatalog.map((item) => ({ ...item, selected: selectedMap.has(item.id) ? selectedMap.get(item.id) : item.selected }));
    } else {
      state.catalog = baseCatalog;
    }
    state.contact = { ...state.contact, ...saved.contact || {} };
    const catalogForSites = state.catalog.map((item) => ({ ...item }));
    state.sites = Array.isArray(saved.sites) ? saved.sites.map((site) => ensureSiteIdentity({ ...site })).map((site) => computeSite(site, catalogForSites.map((item) => ({ ...item })))) : [];
    syncPortfolioFields();
    syncSiteFields();
    renderCatalog();
    recomputePortfolio();
    renderSitesList();
    renderSummaryCards();
    renderPortfolioResults();
    syncContactFields();
    setStep(state.currentStep || 0);
    showToast("Sauvegarde restaur\xE9e.");
  }
  function bindEvents() {
    ["#heroCalendlyBtn", "#hubCalendlyBtn", "#calendlyBtn"].forEach((selector) => {
      const link = $(selector);
      if (link) link.setAttribute("href", APP_CONFIG.calendlyUrl);
    });
    safeBind("#scrollToWizard", "click", scrollToWizard);
    safeBind("#hubStart", "click", scrollToWizard);
    safeBind("#loadDemo", "click", loadDemo);
    safeBind("#computeSiteBtn", "click", computeCurrentSite);
    safeBind("#addSiteBtn", "click", addCurrentSite);
    safeBind("#nextBtn", "click", () => {
      if (validateStep(state.currentStep)) setStep(state.currentStep + 1);
    });
    safeBind("#prevBtn", "click", () => setStep(state.currentStep - 1));
    safeBind("#resetBtn", "click", resetAll);
    safeBind("#saveLocalBtn", "click", () => {
      readPortfolioFields();
      readCurrentSiteFields();
      readContactFields();
      persist();
      showToast("Sauvegarde locale effectu\xE9e.");
    });
    safeBind("#restoreLocalBtn", "click", restore);
    safeBind("#exportPdfBtn", "click", handleExportPdf);
    safeBind("#sendLeadBtn", "click", handleSendLead);
    $$("#wizardSteps .step").forEach((step, i) => step.addEventListener("click", () => {
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
})();
