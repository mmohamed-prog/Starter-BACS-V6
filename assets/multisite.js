export function computePortfolio(sites) {
  const validSites = (sites || []).filter(site => site && Number.isFinite(site.surface) && site.surface > 0);
  const totalSurface = validSites.reduce((sum, site) => sum + site.surface, 0);
  const totalSavings = validSites.reduce((sum, site) => sum + (site.savingsEur || 0), 0);
  const totalCapex = validSites.reduce((sum, site) => sum + (site.investNet || 0), 0);
  const totalCo2 = validSites.reduce((sum, site) => sum + (site.co2Saved || 0), 0);
  const weightedGap = validSites.reduce((sum, site) => sum + ((site.gapPct || 0) * site.surface), 0);
  const avgGap = totalSurface ? weightedGap / totalSurface : 0;
  const roi = totalSavings > 0 ? totalCapex / totalSavings : null;
  const avgLead = validSites.length ? validSites.reduce((sum, site) => sum + (site.leadScore || 0), 0) / validSites.length : 0;
  const avgReliability = validSites.length ? validSites.reduce((sum, site) => sum + (site.reliabilityScore || 0), 0) / validSites.length : 0;
  const avgSavingsRate = validSites.length ? validSites.reduce((sum, site) => sum + (site.annualSavingsRate || 0), 0) / validSites.length : 0;

  let status = 'à construire';
  if (validSites.length) {
    if (avgLead >= 80 || avgGap >= 25) status = 'prioritaire';
    else if (avgLead >= 55 || avgGap >= 12) status = 'à traiter';
    else status = 'à structurer';
  }

  const ranking = validSites
    .slice()
    .sort((a, b) => ((b.leadScore || 0) * 0.6 + (b.reliabilityScore || 0) * 0.1 + (b.annualSavingsRate || 0) * 0.3) - ((a.leadScore || 0) * 0.6 + (a.reliabilityScore || 0) * 0.1 + (a.annualSavingsRate || 0) * 0.3));

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
    roi,
    status,
    ranking
  };
}

export function buildPortfolioReadout(portfolio) {
  if (!portfolio || !portfolio.siteCount) return ['Aucun site n’a encore été ajouté au portefeuille.'];
  const lines = [];
  lines.push(`${portfolio.siteCount} site(s) analysé(s) pour ${Math.round(portfolio.totalSurface).toLocaleString('fr-FR')} m².`);
  lines.push(portfolio.status === 'prioritaire'
    ? 'Le portefeuille appelle une priorisation rapide des premières actions de pilotage et de mise en conformité.'
    : portfolio.status === 'à traiter'
      ? 'Le portefeuille nécessite un cadrage des arbitrages BACS à court terme.'
      : 'Le portefeuille peut être structuré par phases, avec une attention portée au bon phasage BACS.');

  if (portfolio.roi != null) lines.push(`ROI portefeuille estimé à ${portfolio.roi.toFixed(1).replace('.', ',')} ans.`);
  lines.push(`Niveau de fiabilité moyen : ${Math.round(portfolio.avgReliability || 0)}/100.`);
  lines.push(`Taux moyen d’économie annuelle estimé : ${Math.round(portfolio.avgSavingsRate || 0)}%.`);
  lines.push('Cette synthèse constitue une première lecture d’opportunité dans le cadre du Décret BACS, sans valider à elle seule l’assujettissement réglementaire de chaque site.');
  return lines;
}
